import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { prisma } from '@/lib/prisma';
import { parseVisualBibleDraft, type VisualBibleDraft } from '@/features/visual/service';
import { parseCharacterDrafts, type CharacterDraft } from '@/features/characters/service';
import { buildReferenceProfile, getReferenceInsights } from '@/features/reference/service';
import { getShotKindFromTitle } from '@/lib/shot-taxonomy';
import { getTimelineBundle } from '@/features/timeline/service';
import { getLatestOutlineByTitle } from '@/lib/outline-store';
import {
  getGeneratedMediaEntries,
  replaceGeneratedMediaEntriesForProvider,
  type GeneratedMediaEntry,
  type GeneratedMediaType,
} from '@/features/media/service';

const execFileAsync = promisify(execFile);

export type ProviderKind = 'image-sequence' | 'voice-synthesis' | 'video-assembly';
type RenderExecutionMode = 'mock' | 'remote';

export type RenderJobQuery = {
  provider?: ProviderKind;
  jobId?: string;
};

type RenderJobMeta = {
  version: 1;
  mode: RenderExecutionMode;
  retryCount: number;
  payloadCount: number;
  summary: string[];
  endpoint?: string;
  requestPath?: string;
  responsePath?: string;
  lastError?: string;
  preview?: string;
  executedAt?: string;
  assetCount?: number;
  artifactIndexPath?: string;
  timeoutMs?: number;
};

const DEFAULT_JOB_META: RenderJobMeta = {
  version: 1,
  mode: 'mock',
  retryCount: 0,
  payloadCount: 0,
  summary: [],
};

const PROVIDER_ENV_MAP: Record<ProviderKind, string | undefined> = {
  'image-sequence': process.env.STORYFLOW_IMAGE_PROVIDER_URL,
  'voice-synthesis': process.env.STORYFLOW_VOICE_PROVIDER_URL,
  'video-assembly': process.env.STORYFLOW_VIDEO_PROVIDER_URL,
};

const PROVIDER_API_KEY_ENV_MAP: Record<ProviderKind, string | undefined> = {
  'image-sequence': process.env.STORYFLOW_IMAGE_PROVIDER_API_KEY,
  'voice-synthesis': process.env.STORYFLOW_VOICE_PROVIDER_API_KEY,
  'video-assembly': process.env.STORYFLOW_VIDEO_PROVIDER_API_KEY,
};

const PROVIDER_AUTH_HEADER_ENV_MAP: Record<ProviderKind, string | undefined> = {
  'image-sequence': process.env.STORYFLOW_IMAGE_PROVIDER_AUTH_HEADER,
  'voice-synthesis': process.env.STORYFLOW_VOICE_PROVIDER_AUTH_HEADER,
  'video-assembly': process.env.STORYFLOW_VIDEO_PROVIDER_AUTH_HEADER,
};

const PROVIDER_AUTH_SCHEME_ENV_MAP: Record<ProviderKind, string | undefined> = {
  'image-sequence': process.env.STORYFLOW_IMAGE_PROVIDER_AUTH_SCHEME,
  'voice-synthesis': process.env.STORYFLOW_VOICE_PROVIDER_AUTH_SCHEME,
  'video-assembly': process.env.STORYFLOW_VIDEO_PROVIDER_AUTH_SCHEME,
};

const PROVIDER_TIMEOUT_ENV_MAP: Record<ProviderKind, string | undefined> = {
  'image-sequence': process.env.STORYFLOW_IMAGE_PROVIDER_TIMEOUT_MS,
  'voice-synthesis': process.env.STORYFLOW_VOICE_PROVIDER_TIMEOUT_MS,
  'video-assembly': process.env.STORYFLOW_VIDEO_PROVIDER_TIMEOUT_MS,
};

function pickConfiguredValue(preferred?: string, fallback?: string) {
  if (typeof preferred === 'string' && preferred.trim()) return preferred.trim();
  if (typeof fallback === 'string' && fallback.trim()) return fallback.trim();
  return null;
}

function parseTimeoutMs(value: string | null | undefined, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.round(parsed);
}

function hasReferenceFlavor(text: string | null) {
  if (!text) return false;
  return text.includes('参考构图') || text.includes('情绪参考') || text.includes('动作节奏参考');
}

function summarizeShotKinds(titles: string[]) {
  const counts = new Map<string, number>();
  for (const title of titles) {
    const kind = getShotKindFromTitle(title);
    counts.set(kind, (counts.get(kind) || 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([kind, count]) => `${kind}:${count}`)
    .join(',');
}

function slugifyProjectTitle(title: string) {
  return title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'project';
}

function timestampTag() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

function getVisualBible(project: { outlines?: Array<{ title: string; summary: string }> }): VisualBibleDraft | null {
  const outline = project.outlines ? getLatestOutlineByTitle(project.outlines, 'Visual Bible') : null;
  return outline ? parseVisualBibleDraft(outline.summary) : null;
}

function getCharacterDrafts(project: { outlines?: Array<{ title: string; summary: string }> }): CharacterDraft[] {
  const outline = project.outlines ? getLatestOutlineByTitle(project.outlines, 'Character Drafts') : null;
  return outline ? parseCharacterDrafts(outline.summary) : [];
}

function summarizeCharacters(characters: CharacterDraft[]) {
  if (characters.length === 0) return '暂无角色草案';
  return characters.map((item) => `${item.name}（${item.role}）`).join(' / ');
}

function mergeVisualStyle(base: string, visualBible: VisualBibleDraft | null) {
  if (!visualBible) return base;
  return `${base} | palette: ${visualBible.palette} | tone: ${visualBible.visualTone}`;
}

function mergeCameraMotion(base: string, visualBible: VisualBibleDraft | null) {
  if (!visualBible) return base;
  return `${base} | motion rule: ${visualBible.motionLanguage}`;
}

function mergeEmphasis(base: string, visualBible: VisualBibleDraft | null, characterSummary: string) {
  const visualPart = !visualBible ? base : `${base} | lens: ${visualBible.lensLanguage} | texture: ${visualBible.textureKeywords}`;
  if (!characterSummary || characterSummary === '暂无角色草案') return visualPart;
  return `${visualPart} | characters: ${characterSummary}`;
}

function buildAudioFocus(kind: string, visualBible: VisualBibleDraft | null, characterSummary: string, base: string) {
  const stylePart = !visualBible ? base : `${base} | style cue: ${visualBible.styleName} | scene feel: ${kind}`;
  if (!characterSummary || characterSummary === '暂无角色草案') return stylePart;
  return `${stylePart} | character cue: ${characterSummary}`;
}

export type ShotRenderPreset = {
  shotId: string;
  shotTitle: string;
  kind: string;
  visualStyle: string;
  cameraMotion: string;
  pacing: string;
  emphasis: string;
  audioFocus: string;
  characterSummary?: string;
  visualBibleStyle?: string;
  palette?: string;
  lighting?: string;
  lensLanguage?: string;
  motionLanguage?: string;
  textureKeywords?: string;
};

export function getRenderPresetForShot(
  shot: { id: string; title: string; prompt: string | null; cameraNotes: string | null },
  visualBible: VisualBibleDraft | null = null,
  characters: CharacterDraft[] = [],
): ShotRenderPreset {
  const kind = getShotKindFromTitle(shot.title);
  const characterSummary = summarizeCharacters(characters);

  const presetMap: Record<string, Omit<ShotRenderPreset, 'shotId' | 'shotTitle' | 'kind'>> = {
    空间建立: {
      visualStyle: 'wide cinematic environment',
      cameraMotion: 'slow push or slow pan',
      pacing: 'slow-open',
      emphasis: 'space relation and staging',
      audioFocus: 'ambient hum and scene atmosphere',
    },
    细节观察: {
      visualStyle: 'macro close-up with texture emphasis',
      cameraMotion: 'micro move / focus pull',
      pacing: 'tight-observation',
      emphasis: 'object detail and noticing process',
      audioFocus: 'small tactile sounds and breathing',
    },
    感官压迫: {
      visualStyle: 'tight framing with flicker contrast',
      cameraMotion: 'subtle shake / pressure drift',
      pacing: 'pressure-build',
      emphasis: 'sensory stress and environmental threat',
      audioFocus: 'alarm, rumble, pressure noise',
    },
    情绪落点: {
      visualStyle: 'close-up emotional isolation',
      cameraMotion: 'still hold',
      pacing: 'linger-on-emotion',
      emphasis: 'face, breath, emotional residue',
      audioFocus: 'breath, silence, emotional tail',
    },
    关系压迫: {
      visualStyle: 'compressed over-shoulder confrontation',
      cameraMotion: 'push-in tension',
      pacing: 'locked-tension',
      emphasis: 'eyeline pressure and distance conflict',
      audioFocus: 'silence under tension and reactive movement',
    },
    动作触发: {
      visualStyle: 'action-first directional framing',
      cameraMotion: 'dynamic reframing',
      pacing: 'trigger-acceleration',
      emphasis: 'decision point and motion start',
      audioFocus: 'impact cues and motion hits',
    },
    对白博弈: {
      visualStyle: 'shot-reverse-shot reaction framing',
      cameraMotion: 'controlled conversational cadence',
      pacing: 'dialogue-pressure',
      emphasis: 'spoken power shift and reaction timing',
      audioFocus: 'voice dynamics and silence between lines',
    },
  };

  const base = presetMap[kind] || {
    visualStyle: 'balanced cinematic framing',
    cameraMotion: 'moderate camera movement',
    pacing: 'default',
    emphasis: 'general narrative beat',
    audioFocus: 'general ambience',
  };

  return {
    shotId: shot.id,
    shotTitle: shot.title,
    kind,
    visualStyle: mergeVisualStyle(base.visualStyle, visualBible),
    cameraMotion: mergeCameraMotion(base.cameraMotion, visualBible),
    pacing: base.pacing,
    emphasis: mergeEmphasis(base.emphasis, visualBible, characterSummary),
    audioFocus: buildAudioFocus(kind, visualBible, characterSummary, base.audioFocus),
    characterSummary,
    visualBibleStyle: visualBible?.styleName,
    palette: visualBible?.palette,
    lighting: visualBible?.lighting,
    lensLanguage: visualBible?.lensLanguage,
    motionLanguage: visualBible?.motionLanguage,
    textureKeywords: visualBible?.textureKeywords,
  };
}

function safeJsonParse(text: string | null | undefined) {
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

export function parseRenderJobOutput(outputUrl: string | null) {
  const parsed = safeJsonParse(outputUrl);
  if (parsed && typeof parsed === 'object' && 'version' in parsed) {
    const meta = parsed as Partial<RenderJobMeta>;
    return {
      ...DEFAULT_JOB_META,
      ...meta,
      summary: Array.isArray(meta.summary) ? meta.summary.map((item) => String(item)) : [],
    } satisfies RenderJobMeta;
  }

  if (!outputUrl) return DEFAULT_JOB_META;
  return {
    ...DEFAULT_JOB_META,
    summary: outputUrl.split('|').filter(Boolean),
  } satisfies RenderJobMeta;
}

function serializeRenderJobOutput(meta: Partial<RenderJobMeta>) {
  return JSON.stringify({
    ...DEFAULT_JOB_META,
    ...meta,
    summary: meta.summary || [],
  } satisfies RenderJobMeta);
}

function getProviderEndpoint(provider: ProviderKind) {
  return PROVIDER_ENV_MAP[provider] || null;
}

function getProviderApiKey(provider: ProviderKind) {
  return pickConfiguredValue(PROVIDER_API_KEY_ENV_MAP[provider], process.env.STORYFLOW_PROVIDER_API_KEY);
}

function getProviderAuthHeader(provider: ProviderKind) {
  return pickConfiguredValue(PROVIDER_AUTH_HEADER_ENV_MAP[provider], process.env.STORYFLOW_PROVIDER_AUTH_HEADER) || 'Authorization';
}

function getProviderAuthScheme(provider: ProviderKind) {
  return pickConfiguredValue(PROVIDER_AUTH_SCHEME_ENV_MAP[provider], process.env.STORYFLOW_PROVIDER_AUTH_SCHEME) || 'Bearer';
}

function getProviderTimeoutMs(provider: ProviderKind) {
  return parseTimeoutMs(pickConfiguredValue(PROVIDER_TIMEOUT_ENV_MAP[provider], process.env.STORYFLOW_PROVIDER_TIMEOUT_MS), 300000);
}

function buildProviderHeaders(provider: ProviderKind) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const apiKey = getProviderApiKey(provider);
  if (!apiKey) return headers;

  const authHeader = getProviderAuthHeader(provider);
  const authScheme = getProviderAuthScheme(provider);
  headers[authHeader] = /^(raw|none)$/i.test(authScheme) ? apiKey : `${authScheme} ${apiKey}`.trim();
  return headers;
}

async function getRenderProjectById(projectId: string) {
  return prisma.project.findUnique({
    where: { id: projectId },
    include: {
      scenes: { orderBy: { orderIndex: 'asc' } },
      shots: { orderBy: [{ sceneId: 'asc' }, { orderIndex: 'asc' }] },
      renderJobs: { orderBy: { createdAt: 'desc' } },
      references: { orderBy: { createdAt: 'desc' } },
      outlines: { orderBy: { createdAt: 'desc' } },
    },
  });
}

export async function getRenderProject(projectId?: string) {
  return projectId
    ? getRenderProjectById(projectId)
    : prisma.project.findFirst({
        orderBy: { updatedAt: 'desc' },
        include: {
          scenes: { orderBy: { orderIndex: 'asc' } },
          shots: { orderBy: [{ sceneId: 'asc' }, { orderIndex: 'asc' }] },
          renderJobs: { orderBy: { createdAt: 'desc' } },
          references: { orderBy: { createdAt: 'desc' } },
          outlines: { orderBy: { createdAt: 'desc' } },
        },
      });
}

export async function exportRenderPresets(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      scenes: { orderBy: { orderIndex: 'asc' } },
      shots: { orderBy: [{ sceneId: 'asc' }, { orderIndex: 'asc' }] },
      references: { orderBy: { createdAt: 'desc' } },
      outlines: { orderBy: { createdAt: 'desc' } },
    },
  });

  if (!project) throw new Error('项目不存在');

  const visualBible = getVisualBible(project);
  const characters = getCharacterDrafts(project);
  const referenceProfile = buildReferenceProfile(project.references);
  const presets = project.shots.map((shot) => getRenderPresetForShot(shot, visualBible, characters));

  return {
    projectId: project.id,
    projectTitle: project.title,
    sceneTitles: project.scenes.map((scene) => scene.title),
    visualBible,
    characters,
    referenceProfile,
    presets,
  };
}

export async function exportProviderPayloads(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      scenes: { orderBy: { orderIndex: 'asc' } },
      shots: { orderBy: [{ sceneId: 'asc' }, { orderIndex: 'asc' }] },
      references: { orderBy: { createdAt: 'desc' } },
      outlines: { orderBy: { createdAt: 'desc' } },
    },
  });

  if (!project) throw new Error('项目不存在');

  const visualBible = getVisualBible(project);
  const characters = getCharacterDrafts(project);
  const characterSummary = summarizeCharacters(characters);
  const referenceProfile = buildReferenceProfile(project.references);
  const referenceInsights = getReferenceInsights(project.references);
  const timeline = await getTimelineBundle(projectId).catch(() => null);
  const timelineSceneMap = new Map((timeline?.scenes || []).map((scene) => [scene.id, scene]));
  const timelineShotMap = new Map((timeline?.scenes || []).flatMap((scene) => scene.shots.map((shot) => [shot.id, { ...shot, sceneId: scene.id, sceneTitle: scene.title }])));
  const sceneTitleMap = new Map(project.scenes.map((scene) => [scene.id, scene.title]));
  const presets = project.shots.map((shot) => ({
    shot,
    preset: getRenderPresetForShot(shot, visualBible, characters),
  }));

  const imagePayload = presets.map(({ shot, preset }) => {
    const timelineShot = timelineShotMap.get(shot.id);
    return {
      provider: 'image-sequence',
      shotId: shot.id,
      shotTitle: shot.title,
      sceneTitle: sceneTitleMap.get(shot.sceneId || '') || '未分场',
      prompt: shot.prompt,
      cameraNotes: shot.cameraNotes,
      visualStyle: preset.visualStyle,
      cameraMotion: preset.cameraMotion,
      pacing: preset.pacing,
      emphasis: preset.emphasis,
      palette: preset.palette,
      lighting: preset.lighting,
      textureKeywords: preset.textureKeywords,
      characterSummary,
      referenceTitles: referenceProfile.titles,
      referenceFraming: referenceProfile.framing,
      referenceEmotion: referenceProfile.emotion,
      referenceMovement: referenceProfile.movement,
      referenceNotes: referenceProfile.noteSummary,
      referenceHighlights: referenceProfile.highlights,
      referenceSourceUrls: referenceProfile.sourceUrls,
      referenceLocalPaths: referenceProfile.localPaths,
      plannedDuration: timelineShot?.duration || null,
      timelineStartAt: timelineShot?.startAt || null,
      timelineEndAt: timelineShot?.endAt || null,
      emotionScore: timelineShot?.emotion || null,
      emotionLabel: timelineShot?.emotionLabel || null,
      beatType: timelineShot?.beatType || null,
      beatNote: timelineShot?.note || '',
    };
  });

  const voicePayload = project.scenes.map((scene) => {
    const timelineScene = timelineSceneMap.get(scene.id);
    return {
      provider: 'voice-synthesis',
      sceneId: scene.id,
      sceneTitle: scene.title,
      summary: scene.summary,
      audioPlan: 'dialogue+ambience',
      styleName: visualBible?.styleName || null,
      characterSummary,
      referenceTitles: referenceProfile.titles,
      referenceEmotion: referenceProfile.emotion,
      referenceMovement: referenceProfile.movement,
      referenceNotes: referenceProfile.noteSummary,
      referenceSourceUrls: referenceProfile.sourceUrls,
      referenceLocalPaths: referenceProfile.localPaths,
      targetDuration: timelineScene?.duration || null,
      emotionScore: timelineScene?.emotionScore || null,
      emotionLabel: timelineScene?.emotionLabel || null,
      beatMarkers: timelineScene?.beatMarkers || [],
    };
  });

  const videoPayload = presets.map(({ shot, preset }) => {
    const timelineShot = timelineShotMap.get(shot.id);
    const timelineScene = timelineSceneMap.get(shot.sceneId || '');
    return {
      provider: 'video-assembly',
      shotId: shot.id,
      shotTitle: shot.title,
      sceneTitle: sceneTitleMap.get(shot.sceneId || '') || '未分场',
      visualStyle: preset.visualStyle,
      cameraMotion: preset.cameraMotion,
      pacing: preset.pacing,
      audioFocus: preset.audioFocus,
      referenceReady: hasReferenceFlavor(shot.prompt),
      lensLanguage: preset.lensLanguage,
      motionLanguage: preset.motionLanguage,
      styleName: preset.visualBibleStyle,
      characterSummary,
      referenceTitles: referenceProfile.titles,
      referenceFraming: referenceProfile.framing,
      referenceEmotion: referenceProfile.emotion,
      referenceMovement: referenceProfile.movement,
      referenceHighlights: referenceProfile.highlights,
      plannedDuration: timelineShot?.duration || null,
      timelineStartAt: timelineShot?.startAt || null,
      timelineEndAt: timelineShot?.endAt || null,
      emotionScore: timelineShot?.emotion || null,
      emotionLabel: timelineShot?.emotionLabel || null,
      beatType: timelineShot?.beatType || null,
      beatNote: timelineShot?.note || '',
      sceneDuration: timelineScene?.duration || null,
      sceneEmotionLabel: timelineScene?.emotionLabel || null,
      projectTotalDuration: timeline?.totalSeconds || null,
      projectTotalDurationLabel: timeline?.totalDurationLabel || null,
    };
  });

  return {
    projectId: project.id,
    projectTitle: project.title,
    visualBible,
    characters,
    referenceProfile,
    referenceInsights,
    timelineSummary: timeline
      ? {
          totalSeconds: timeline.totalSeconds,
          totalDurationLabel: timeline.totalDurationLabel,
          warningCount: timeline.warnings.length,
          sceneCount: timeline.scenes.length,
          shotCount: timeline.scenes.reduce((sum, scene) => sum + scene.shots.length, 0),
          beatMarkerCount: timeline.scenes.reduce((sum, scene) => sum + scene.shots.filter((shot) => Boolean(shot.beatType)).length, 0),
        }
      : null,
    providers: {
      imageSequence: imagePayload,
      voiceSynthesis: voicePayload,
      videoAssembly: videoPayload,
    },
  };
}

export async function exportProductionBundle(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      scenes: { orderBy: { orderIndex: 'asc' } },
      shots: { orderBy: [{ sceneId: 'asc' }, { orderIndex: 'asc' }] },
      renderJobs: { orderBy: { createdAt: 'desc' } },
      references: { orderBy: { createdAt: 'desc' } },
      outlines: { orderBy: { createdAt: 'desc' } },
    },
  });

  if (!project) throw new Error('项目不存在');

  const presetsData = await exportRenderPresets(projectId);
  const providerData = await exportProviderPayloads(projectId);
  const generatedMedia = getGeneratedMediaEntries(project);
  const referenceInsights = getReferenceInsights(project.references);
  const bundle = {
    projectId: project.id,
    projectTitle: project.title,
    exportedAt: new Date().toISOString(),
    visualBible: presetsData.visualBible,
    characters: presetsData.characters,
    referenceProfile: providerData.referenceProfile,
    referenceInsights,
    scenes: project.scenes.map((scene) => ({
      id: scene.id,
      title: scene.title,
      summary: scene.summary,
      orderIndex: scene.orderIndex,
    })),
    shots: project.shots.map((shot) => ({
      id: shot.id,
      title: shot.title,
      prompt: shot.prompt,
      cameraNotes: shot.cameraNotes,
      orderIndex: shot.orderIndex,
      sceneId: shot.sceneId,
    })),
    renderJobs: project.renderJobs.map((job) => ({
      id: job.id,
      provider: job.provider,
      status: job.status,
      output: parseRenderJobOutput(job.outputUrl),
    })),
    generatedMedia,
    presets: presetsData.presets,
    providerPayloads: providerData.providers,
  };

  const baseDir = path.join(process.cwd(), 'exports');
  const bundleName = `${timestampTag()}-${slugifyProjectTitle(project.title)}`;
  const bundleDir = path.join(baseDir, bundleName);
  await mkdir(bundleDir, { recursive: true });

  const presetsPath = path.join(bundleDir, 'render-presets.json');
  const providersPath = path.join(bundleDir, 'provider-payloads.json');
  const generatedMediaPath = path.join(bundleDir, 'generated-media-library.json');
  const bundlePath = path.join(bundleDir, 'production-bundle.json');
  const manifestPath = path.join(bundleDir, 'manifest.json');
  const zipPath = path.join(baseDir, `${bundleName}.zip`);

  await writeFile(presetsPath, JSON.stringify(presetsData, null, 2), 'utf8');
  await writeFile(providersPath, JSON.stringify(providerData, null, 2), 'utf8');
  await writeFile(generatedMediaPath, JSON.stringify({ version: 1, items: generatedMedia }, null, 2), 'utf8');
  await writeFile(bundlePath, JSON.stringify(bundle, null, 2), 'utf8');

  const manifest = {
    projectId: project.id,
    projectTitle: project.title,
    exportedAt: bundle.exportedAt,
    bundleDir,
    visualBibleStyle: presetsData.visualBible?.styleName || null,
    characterSummary: summarizeCharacters(presetsData.characters),
    files: [
      'render-presets.json',
      'provider-payloads.json',
      'generated-media-library.json',
      'production-bundle.json',
    ],
    usage: [
      '先看 production-bundle.json 获取全量总览',
      'provider-payloads.json 直接用于对接 image / voice / video provider',
      'generated-media-library.json 可查看本次沉淀出的媒体资产索引',
      'render-presets.json 用于单镜头渲染预设调试与复核',
    ],
  };

  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  await execFileAsync('zip', ['-r', zipPath, bundleName], { cwd: baseDir });

  return {
    bundleDir,
    zipPath,
    files: {
      manifestPath,
      presetsPath,
      providersPath,
      generatedMediaPath,
      bundlePath,
    },
  };
}

function createJobSeedMeta(input: { payloadCount: number; summary: string[] }) {
  return serializeRenderJobOutput({
    mode: 'mock',
    payloadCount: input.payloadCount,
    retryCount: 0,
    summary: input.summary,
  });
}

export async function createRenderJobsForLatestProject(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      scenes: { orderBy: { orderIndex: 'asc' } },
      shots: { orderBy: [{ sceneId: 'asc' }, { orderIndex: 'asc' }] },
      references: { orderBy: { createdAt: 'desc' } },
      outlines: { orderBy: { createdAt: 'desc' } },
    },
  });

  if (!project) throw new Error('项目不存在');
  if (project.shots.length === 0) throw new Error('没有可用于渲染的 shot');

  const payloads = await exportProviderPayloads(projectId);
  const visualBible = getVisualBible(project);
  const characters = getCharacterDrafts(project);
  const characterSummary = summarizeCharacters(characters);
  const shotKindsSummary = summarizeShotKinds(project.shots.map((shot) => shot.title));
  const referenceProfile = buildReferenceProfile(project.references);
  const referenceReadyShots = project.shots.filter((shot) => hasReferenceFlavor(shot.prompt)).length;
  const directorReadyScenes = project.scenes.filter((scene) => (scene.summary || '').includes('导演处理上强调')).length;
  const presetPreview = project.shots.slice(0, 3).map((shot) => {
    const preset = getRenderPresetForShot(shot, visualBible, characters);
    return `${preset.kind}:${preset.visualStyle}`;
  }).join(';');

  await prisma.renderJob.deleteMany({ where: { projectId } });

  await prisma.renderJob.createMany({
    data: [
      {
        projectId,
        status: 'queued',
        provider: 'image-sequence',
        outputUrl: createJobSeedMeta({
          payloadCount: payloads.providers.imageSequence.length,
          summary: [`shots:${project.shots.length}`, `kinds:${shotKindsSummary}`, `style:${visualBible?.styleName || 'none'}`, `references:${referenceProfile.total}`, `characters:${characterSummary}`, `presetPreview:${presetPreview}`],
        }),
      },
      {
        projectId,
        status: 'queued',
        provider: 'voice-synthesis',
        outputUrl: createJobSeedMeta({
          payloadCount: payloads.providers.voiceSynthesis.length,
          summary: [`scenes:${project.scenes.length}`, `directorReady:${directorReadyScenes}`, `style:${visualBible?.styleName || 'none'}`, `references:${referenceProfile.total}`, `characters:${characterSummary}`, 'audioPlan:dialogue+ambience'],
        }),
      },
      {
        projectId,
        status: 'queued',
        provider: 'video-assembly',
        outputUrl: createJobSeedMeta({
          payloadCount: payloads.providers.videoAssembly.length,
          summary: [`referenceReady:${referenceReadyShots}`, `references:${referenceProfile.total}`, `style:${visualBible?.styleName || 'none'}`, `characters:${characterSummary}`, 'presetLinked:true'],
        }),
      },
    ],
  });

  return getRenderProjectById(projectId);
}

function getProviderPayloadByKind(providerPayloads: Awaited<ReturnType<typeof exportProviderPayloads>>['providers'], provider: ProviderKind) {
  if (provider === 'image-sequence') return providerPayloads.imageSequence;
  if (provider === 'voice-synthesis') return providerPayloads.voiceSynthesis;
  return providerPayloads.videoAssembly;
}

async function writeExecutionArtifacts(projectTitle: string, provider: ProviderKind, payload: unknown) {
  const runDir = path.join(process.cwd(), 'exports', 'render-runs', `${timestampTag()}-${slugifyProjectTitle(projectTitle)}`);
  await mkdir(runDir, { recursive: true });
  const requestPath = path.join(runDir, `${provider}-request.json`);
  await writeFile(requestPath, JSON.stringify(payload, null, 2), 'utf8');
  return { runDir, requestPath };
}

async function executeProvider(provider: ProviderKind, project: { id: string; title: string }, payload: unknown[]) {
  const endpoint = getProviderEndpoint(provider);
  const timeoutMs = getProviderTimeoutMs(provider);
  const { runDir, requestPath } = await writeExecutionArtifacts(project.title, provider, payload);
  const responsePath = path.join(runDir, `${provider}-response.json`);

  if (!endpoint) {
    const mockResponse = {
      mode: 'mock',
      provider,
      projectId: project.id,
      generatedAt: new Date().toISOString(),
      itemCount: payload.length,
      message: '未配置真实 provider endpoint，已生成 mock 执行结果，可继续走 QA / 导出闭环。',
    };
    await writeFile(responsePath, JSON.stringify(mockResponse, null, 2), 'utf8');
    return {
      mode: 'mock' as const,
      endpoint: null,
      timeoutMs,
      runDir,
      requestPath,
      responsePath,
      responseBody: mockResponse,
      preview: mockResponse.message,
      summary: [`mode:mock`, `items:${payload.length}`, `timeout:${timeoutMs}ms`, `response:${path.basename(responsePath)}`],
    };
  }

  const headers = buildProviderHeaders(provider);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(`timeout:${timeoutMs}`), timeoutMs);

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        projectId: project.id,
        projectTitle: project.title,
        provider,
        items: payload,
      }),
      cache: 'no-store',
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timer);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`${provider} provider timed out after ${timeoutMs}ms`);
    }
    throw error;
  }
  clearTimeout(timer);

  const rawText = await response.text();
  const responseBody = safeJsonParse(rawText) || rawText;
  await writeFile(responsePath, typeof responseBody === 'string' ? responseBody : JSON.stringify(responseBody, null, 2), 'utf8');

  if (!response.ok) {
    throw new Error(`${provider} provider failed: ${response.status} ${rawText.slice(0, 240)}`);
  }

  return {
    mode: 'remote' as const,
    endpoint,
    timeoutMs,
    runDir,
    requestPath,
    responsePath,
    responseBody,
    preview: rawText.slice(0, 180),
    summary: [`mode:remote`, `items:${payload.length}`, `timeout:${timeoutMs}ms`, `endpoint:${endpoint}`, `response:${path.basename(responsePath)}`],
  };
}

type RenderPayloadRecord = Record<string, unknown>;
type ProviderResponseRecord = Record<string, unknown>;

const PROVIDER_RESPONSE_COLLECTION_KEYS: Record<ProviderKind, string[]> = {
  'image-sequence': ['images', 'image', 'frames', 'items', 'outputs', 'results', 'assets', 'files', 'data', 'output', 'result', 'artifact', 'artifacts', 'file', 'media'],
  'voice-synthesis': ['audios', 'audio', 'items', 'outputs', 'results', 'assets', 'files', 'data', 'output', 'result', 'artifact', 'artifacts', 'file', 'media'],
  'video-assembly': ['videos', 'video', 'clips', 'items', 'outputs', 'results', 'assets', 'files', 'data', 'output', 'result', 'artifact', 'artifacts', 'file', 'media'],
};

const RESPONSE_WRAPPER_KEYS = Array.from(new Set([
  'data',
  'output',
  'outputs',
  'result',
  'results',
  'response',
  'body',
  'payload',
  'artifact',
  'artifacts',
  'file',
  'files',
  'media',
  'items',
  'assets',
  'images',
  'image',
  'videos',
  'video',
  'audios',
  'audio',
  'clips',
  'frames',
]));

const RESPONSE_SUMMARY_KEYS = ['summary', 'message', 'description', 'caption', 'text', 'detail', 'statusText'];
const RESPONSE_SOURCE_URL_KEYS = ['url', 'outputUrl', 'sourceUrl', 'imageUrl', 'videoUrl', 'audioUrl', 'downloadUrl', 'uri', 'src', 'href'];
const RESPONSE_LOCAL_PATH_KEYS = ['localPath', 'path', 'filePath', 'outputPath', 'destination', 'savePath', 'targetPath'];

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function looksLikeUrl(value: string) {
  const normalized = value.trim();
  return /^(https?:\/\/|data:|blob:|\/\/)/i.test(normalized);
}

function looksLikeLocalPath(value: string) {
  const normalized = value.trim();
  return /^([A-Za-z]:[\/]|\/|\.{1,2}[\/])/.test(normalized)
    || /\\/.test(normalized)
    || /\.(png|jpe?g|webp|gif|bmp|svg|mp4|mov|webm|mkv|mp3|wav|m4a|flac|aac|ogg|json)$/i.test(normalized);
}

function toRecord(value: unknown) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as ProviderResponseRecord;
  if (isNonEmptyString(value)) {
    const normalized = value.trim();
    if (looksLikeUrl(normalized)) return { value: normalized, url: normalized } satisfies ProviderResponseRecord;
    if (looksLikeLocalPath(normalized)) return { value: normalized, path: normalized } satisfies ProviderResponseRecord;
    return { value: normalized } satisfies ProviderResponseRecord;
  }
  return {} as ProviderResponseRecord;
}

function pickText(record: ProviderResponseRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (isNonEmptyString(value)) return value.trim();
  }
  return null;
}

function pickTextDeep(value: unknown, keys: string[], depth = 0): string | null {
  if (depth > 5 || value == null) return null;

  if (isNonEmptyString(value)) {
    return keys.includes('value') ? value.trim() : null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const nested = pickTextDeep(item, keys, depth + 1);
      if (nested) return nested;
    }
    return null;
  }

  const record = toRecord(value);
  const direct = pickText(record, keys);
  if (direct) return direct;

  for (const key of RESPONSE_WRAPPER_KEYS) {
    if (!(key in record)) continue;
    const nested = pickTextDeep(record[key], keys, depth + 1);
    if (nested) return nested;
  }

  return null;
}

function resolveSourceUrl(record: ProviderResponseRecord) {
  const direct = pickTextDeep(record, RESPONSE_SOURCE_URL_KEYS);
  if (direct) return direct;
  const fallback = pickTextDeep(record, ['value']);
  return fallback && looksLikeUrl(fallback) ? fallback : null;
}

function resolveLocalPath(record: ProviderResponseRecord) {
  const direct = pickTextDeep(record, RESPONSE_LOCAL_PATH_KEYS);
  if (direct && !looksLikeUrl(direct)) return direct;
  const fallback = pickTextDeep(record, ['value']);
  return fallback && looksLikeLocalPath(fallback) && !looksLikeUrl(fallback) ? fallback : null;
}

function collectResponseRecords(
  value: unknown,
  collectionKeys: string[],
  depth = 0,
  seen = new Set<string>(),
): ProviderResponseRecord[] {
  if (depth > 5 || value == null) return [];

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectResponseRecords(item, collectionKeys, depth + 1, seen));
  }

  if (isNonEmptyString(value)) {
    const normalized = toRecord(value);
    if (Object.keys(normalized).length === 0) return [];
    const signature = JSON.stringify(normalized);
    if (seen.has(signature)) return [];
    seen.add(signature);
    return [normalized];
  }

  const record = toRecord(value);
  for (const key of collectionKeys) {
    if (!(key in record)) continue;
    const nested = collectResponseRecords(record[key], collectionKeys, depth + 1, seen);
    if (nested.length > 0) return nested;
  }

  const hasSummary = Boolean(pickTextDeep(record, RESPONSE_SUMMARY_KEYS));
  const sourceUrl = resolveSourceUrl(record);
  const localPath = resolveLocalPath(record);
  const fallbackValue = pickText(record, ['value']);
  const shouldKeep = hasSummary || Boolean(sourceUrl) || Boolean(localPath) || Boolean(fallbackValue) || (depth === 0 && Object.keys(record).length > 0);
  if (!shouldKeep) return [];

  const signature = JSON.stringify({
    summary: hasSummary ? pickTextDeep(record, RESPONSE_SUMMARY_KEYS) : null,
    sourceUrl,
    localPath,
    fallbackValue,
  });
  if (seen.has(signature)) return [];
  seen.add(signature);
  return [record];
}

function getResponseItems(responseBody: unknown, provider: ProviderKind) {
  if (Array.isArray(responseBody)) {
    return responseBody
      .map((item) => toRecord(item))
      .filter((item) => Object.keys(item).length > 0);
  }

  const items = collectResponseRecords(responseBody, PROVIDER_RESPONSE_COLLECTION_KEYS[provider]);
  if (items.length > 0) return items;

  const fallback = toRecord(responseBody);
  return Object.keys(fallback).length > 0 ? [fallback] : [];
}

function getGeneratedMediaType(provider: ProviderKind): GeneratedMediaType {
  if (provider === 'voice-synthesis') return 'generated-audio';
  if (provider === 'video-assembly') return 'generated-video';
  return 'generated-image';
}

function getGeneratedMediaTitle(provider: ProviderKind, payloadRecord: RenderPayloadRecord, index: number) {
  const shotTitle = typeof payloadRecord.shotTitle === 'string' ? payloadRecord.shotTitle : null;
  const sceneTitle = typeof payloadRecord.sceneTitle === 'string' ? payloadRecord.sceneTitle : null;

  if (provider === 'voice-synthesis') return `${sceneTitle || `Scene ${index + 1}`} 配音轨`;
  if (provider === 'video-assembly') return `${shotTitle || `Shot ${index + 1}`} 视频片段`;
  return `${shotTitle || `Shot ${index + 1}`} 图片结果`;
}

function getGeneratedMediaSummary(provider: ProviderKind, payloadRecord: RenderPayloadRecord, responseRecord: ProviderResponseRecord, mode: RenderExecutionMode) {
  const sceneTitle = typeof payloadRecord.sceneTitle === 'string' ? payloadRecord.sceneTitle : '未分场';
  const shotTitle = typeof payloadRecord.shotTitle === 'string' ? payloadRecord.shotTitle : '未命名镜头';
  const directSummary = pickTextDeep(responseRecord, RESPONSE_SUMMARY_KEYS);
  if (directSummary) return directSummary;
  if (provider === 'voice-synthesis') return `${sceneTitle} 的语音结果已生成并写入媒体索引（${mode === 'remote' ? '真实' : '模拟'}模式）。`;
  if (provider === 'video-assembly') return `${sceneTitle} / ${shotTitle} 的视频片段已生成并写入媒体索引（${mode === 'remote' ? '真实' : '模拟'}模式）。`;
  return `${sceneTitle} / ${shotTitle} 的图片结果已生成并写入媒体索引（${mode === 'remote' ? '真实' : '模拟'}模式）。`;
}

function getGeneratedMediaTags(provider: ProviderKind, payloadRecord: RenderPayloadRecord, mode: RenderExecutionMode) {
  const tags: string[] = [provider, mode];
  const sceneTitle = typeof payloadRecord.sceneTitle === 'string' ? payloadRecord.sceneTitle : null;
  const shotTitle = typeof payloadRecord.shotTitle === 'string' ? payloadRecord.shotTitle : null;
  if (sceneTitle) tags.push(sceneTitle);
  if (shotTitle) tags.push(shotTitle);
  return tags;
}

async function syncGeneratedMediaArtifacts(input: {
  projectId: string;
  provider: ProviderKind;
  jobId: string;
  payload: unknown[];
  runDir: string;
  requestPath: string;
  responsePath: string;
  responseBody: unknown;
  mode: RenderExecutionMode;
}) {
  const outputDir = path.join(input.runDir, 'generated-media');
  await mkdir(outputDir, { recursive: true });

  const responseItems = getResponseItems(input.responseBody, input.provider);
  const fallbackResponseRecord = responseItems.length === 1 ? responseItems[0] : toRecord(input.responseBody);
  const createdAt = new Date().toISOString();
  const entries: GeneratedMediaEntry[] = [];
  const reuseSinglePayload = input.payload.length === 1 && responseItems.length > 1;
  const loopCount = reuseSinglePayload ? responseItems.length : input.payload.length;

  for (let index = 0; index < loopCount; index += 1) {
    const payloadItem = input.payload[reuseSinglePayload ? 0 : index] ?? input.payload[0] ?? {};
    const payloadRecord = toRecord(payloadItem) as RenderPayloadRecord;
    const responseRecord = responseItems[index] || fallbackResponseRecord;
    const baseTitle = getGeneratedMediaTitle(input.provider, payloadRecord, reuseSinglePayload ? 0 : index);
    const title = reuseSinglePayload && index > 0 ? `${baseTitle}（变体 ${index + 1}）` : baseTitle;
    const artifactName = `${String(index + 1).padStart(2, '0')}-${slugifyProjectTitle(title)}.json`;
    const artifactPath = path.join(outputDir, artifactName);
    await writeFile(artifactPath, JSON.stringify({
      provider: input.provider,
      mode: input.mode,
      generatedAt: createdAt,
      payload: payloadRecord,
      response: responseRecord,
      requestPath: input.requestPath,
      responsePath: input.responsePath,
    }, null, 2), 'utf8');

    const shotId = typeof payloadRecord.shotId === 'string' ? payloadRecord.shotId : undefined;
    const sceneId = typeof payloadRecord.sceneId === 'string' ? payloadRecord.sceneId : undefined;
    const sourceUrl = resolveSourceUrl(responseRecord);
    const localPath = resolveLocalPath(responseRecord) || artifactPath;

    entries.push({
      id: `media-${input.provider}-${shotId || sceneId || 'item'}-${index + 1}`,
      provider: input.provider,
      type: getGeneratedMediaType(input.provider),
      title,
      summary: getGeneratedMediaSummary(input.provider, payloadRecord, responseRecord, input.mode),
      tags: getGeneratedMediaTags(input.provider, payloadRecord, input.mode),
      sceneId,
      shotId,
      sourceUrl,
      localPath,
      artifactPath,
      requestPath: input.requestPath,
      responsePath: input.responsePath,
      mode: input.mode,
      createdAt,
    });
  }

  const indexPath = path.join(outputDir, `${input.provider}-media-index.json`);
  await writeFile(indexPath, JSON.stringify({ version: 1, provider: input.provider, generatedAt: createdAt, items: entries }, null, 2), 'utf8');
  await replaceGeneratedMediaEntriesForProvider(input.projectId, input.provider, entries);

  return { entries, indexPath };
}


function buildRenderJobLabel(input?: RenderJobQuery, failedOnly = false) {
  if (input?.jobId) return failedOnly ? '当前没有可重试的指定任务' : '当前没有可执行的指定任务';
  if (input?.provider) {
    const label = input.provider === 'image-sequence' ? '图像任务' : input.provider === 'voice-synthesis' ? '语音任务' : '视频任务';
    return failedOnly ? `当前没有失败的${label}可重试` : `当前没有可执行的${label}`;
  }
  return failedOnly ? '当前没有失败任务可重试' : '当前没有可执行的渲染任务';
}

async function findRenderJobs(projectId: string, statuses: string[], query?: RenderJobQuery) {
  const where: Record<string, unknown> = {
    projectId,
    status: { in: statuses },
  };

  if (query?.provider) where.provider = query.provider;
  if (query?.jobId) where.id = query.jobId;

  return prisma.renderJob.findMany({
    where,
    orderBy: { createdAt: 'asc' },
  });
}

async function executeRenderJob(projectId: string, jobId: string) {
  const project = await getRenderProjectById(projectId);
  if (!project) throw new Error('项目不存在');

  const job = project.renderJobs.find((item) => item.id === jobId);
  if (!job) throw new Error('渲染任务不存在');
  if (!job.provider) throw new Error('渲染任务缺少 provider');

  const provider = job.provider as ProviderKind;
  const existingMeta = parseRenderJobOutput(job.outputUrl);
  const providerPayloads = await exportProviderPayloads(projectId);
  const payload = getProviderPayloadByKind(providerPayloads.providers, provider);

  await prisma.renderJob.update({
    where: { id: jobId },
    data: {
      status: 'running',
      outputUrl: serializeRenderJobOutput({
        ...existingMeta,
        payloadCount: payload.length,
        summary: [...existingMeta.summary, 'status:running'],
      }),
    },
  });

  try {
    const result = await executeProvider(provider, { id: project.id, title: project.title }, payload);
    const mediaArtifacts = await syncGeneratedMediaArtifacts({
      projectId,
      provider,
      jobId,
      payload,
      runDir: result.runDir,
      requestPath: result.requestPath,
      responsePath: result.responsePath,
      responseBody: result.responseBody,
      mode: result.mode,
    });
    const summary = provider === 'video-assembly'
      ? [...result.summary, 'final-cut:preview-ready']
      : provider === 'voice-synthesis'
        ? [...result.summary, 'voice-track:generated']
        : [...result.summary, 'frames:generated'];

    await prisma.renderJob.update({
      where: { id: jobId },
      data: {
        status: 'done',
        outputUrl: serializeRenderJobOutput({
          ...existingMeta,
          mode: result.mode,
          endpoint: result.endpoint || undefined,
          requestPath: result.requestPath,
          responsePath: result.responsePath,
          payloadCount: payload.length,
          retryCount: existingMeta.retryCount,
          preview: result.preview,
          executedAt: new Date().toISOString(),
          lastError: undefined,
          assetCount: mediaArtifacts.entries.length,
          artifactIndexPath: mediaArtifacts.indexPath,
          timeoutMs: result.timeoutMs,
          summary: [...summary, `assets:${mediaArtifacts.entries.length}`],
        }),
      },
    });
  } catch (error) {
    await prisma.renderJob.update({
      where: { id: jobId },
      data: {
        status: 'failed',
        outputUrl: serializeRenderJobOutput({
          ...existingMeta,
          payloadCount: payload.length,
          retryCount: existingMeta.retryCount + 1,
          executedAt: new Date().toISOString(),
          lastError: error instanceof Error ? error.message : 'Unknown error',
          timeoutMs: getProviderTimeoutMs(provider),
          summary: [...existingMeta.summary.filter((item) => item !== 'status:running'), 'status:failed'],
        }),
      },
    });
  }
}

export async function runRenderJobs(projectId: string, query?: RenderJobQuery) {
  const jobs = await findRenderJobs(projectId, ['queued', 'failed'], query);

  if (jobs.length === 0) throw new Error(buildRenderJobLabel(query, false));

  for (const job of jobs) {
    await executeRenderJob(projectId, job.id);
  }

  return getRenderProjectById(projectId);
}

export async function retryFailedRenderJobs(projectId: string, query?: RenderJobQuery) {
  const jobs = await findRenderJobs(projectId, ['failed'], query);

  if (jobs.length === 0) throw new Error(buildRenderJobLabel(query, true));

  for (const job of jobs) {
    await executeRenderJob(projectId, job.id);
  }

  return getRenderProjectById(projectId);
}

export async function advanceRenderJobs(projectId: string, query?: RenderJobQuery) {
  return runRenderJobs(projectId, query);
}

import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { prisma } from '@/lib/prisma';
import { parseVisualBibleDraft, type VisualBibleDraft } from '@/features/visual/service';
import { parseCharacterDrafts, type CharacterDraft } from '@/features/characters/service';
import { getShotKindFromTitle } from '@/lib/shot-taxonomy';

const execFileAsync = promisify(execFile);

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
  const outline = project.outlines?.find((item) => item.title === 'Visual Bible');
  return outline ? parseVisualBibleDraft(outline.summary) : null;
}

function getCharacterDrafts(project: { outlines?: Array<{ title: string; summary: string }> }): CharacterDraft[] {
  const outline = project.outlines?.find((item) => item.title === 'Character Drafts');
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
      pacing: 'pause-response',
      emphasis: 'line delivery and reaction hierarchy',
      audioFocus: 'dialogue clarity and pause tension',
    },
  };

  const fallback = {
    visualStyle: 'balanced cinematic framing',
    cameraMotion: 'moderate camera movement',
    pacing: 'standard-cinematic',
    emphasis: 'general narrative clarity',
    audioFocus: 'balanced dialogue and ambience',
  };

  const selected = presetMap[kind] || fallback;

  return {
    shotId: shot.id,
    shotTitle: shot.title,
    kind,
    visualStyle: mergeVisualStyle(selected.visualStyle, visualBible),
    cameraMotion: mergeCameraMotion(selected.cameraMotion, visualBible),
    pacing: selected.pacing,
    emphasis: mergeEmphasis(selected.emphasis, visualBible, characterSummary),
    audioFocus: buildAudioFocus(kind, visualBible, characterSummary, selected.audioFocus),
    characterSummary,
    visualBibleStyle: visualBible?.styleName,
    palette: visualBible?.palette,
    lighting: visualBible?.lighting,
    lensLanguage: visualBible?.lensLanguage,
    motionLanguage: visualBible?.motionLanguage,
    textureKeywords: visualBible?.textureKeywords,
  };
}

export async function getRenderProject() {
  return prisma.project.findFirst({
    orderBy: { updatedAt: 'desc' },
    include: {
      scenes: { orderBy: { orderIndex: 'asc' } },
      shots: { orderBy: [{ sceneId: 'asc' }, { orderIndex: 'asc' }] },
      renderJobs: { orderBy: { createdAt: 'desc' } },
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
      outlines: { orderBy: { createdAt: 'desc' } },
    },
  });

  if (!project) throw new Error('项目不存在');

  const visualBible = getVisualBible(project);
  const characters = getCharacterDrafts(project);
  const presets = project.shots.map((shot) => getRenderPresetForShot(shot, visualBible, characters));

  return {
    projectId: project.id,
    projectTitle: project.title,
    sceneTitles: project.scenes.map((scene) => scene.title),
    visualBible,
    characters,
    presets,
  };
}

export async function exportProviderPayloads(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      scenes: { orderBy: { orderIndex: 'asc' } },
      shots: { orderBy: [{ sceneId: 'asc' }, { orderIndex: 'asc' }] },
      outlines: { orderBy: { createdAt: 'desc' } },
    },
  });

  if (!project) throw new Error('项目不存在');

  const visualBible = getVisualBible(project);
  const characters = getCharacterDrafts(project);
  const characterSummary = summarizeCharacters(characters);
  const sceneTitleMap = new Map(project.scenes.map((scene) => [scene.id, scene.title]));
  const presets = project.shots.map((shot) => ({
    shot,
    preset: getRenderPresetForShot(shot, visualBible, characters),
  }));

  const imagePayload = presets.map(({ shot, preset }) => ({
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
  }));

  const voicePayload = project.scenes.map((scene) => ({
    provider: 'voice-synthesis',
    sceneId: scene.id,
    sceneTitle: scene.title,
    summary: scene.summary,
    audioPlan: 'dialogue+ambience',
    styleName: visualBible?.styleName || null,
    characterSummary,
  }));

  const videoPayload = presets.map(({ shot, preset }) => ({
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
  }));

  return {
    projectId: project.id,
    projectTitle: project.title,
    visualBible,
    characters,
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
      outlines: { orderBy: { createdAt: 'desc' } },
    },
  });

  if (!project) throw new Error('项目不存在');

  const presetsData = await exportRenderPresets(projectId);
  const providerData = await exportProviderPayloads(projectId);
  const bundle = {
    projectId: project.id,
    projectTitle: project.title,
    exportedAt: new Date().toISOString(),
    visualBible: presetsData.visualBible,
    characters: presetsData.characters,
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
      outputUrl: job.outputUrl,
    })),
    presets: presetsData.presets,
    providerPayloads: providerData.providers,
  };

  const baseDir = path.join(process.cwd(), 'exports');
  const bundleName = `${timestampTag()}-${slugifyProjectTitle(project.title)}`;
  const bundleDir = path.join(baseDir, bundleName);
  await mkdir(bundleDir, { recursive: true });

  const presetsPath = path.join(bundleDir, 'render-presets.json');
  const providersPath = path.join(bundleDir, 'provider-payloads.json');
  const bundlePath = path.join(bundleDir, 'production-bundle.json');
  const manifestPath = path.join(bundleDir, 'manifest.json');
  const zipPath = path.join(baseDir, `${bundleName}.zip`);

  await writeFile(presetsPath, JSON.stringify(presetsData, null, 2), 'utf8');
  await writeFile(providersPath, JSON.stringify(providerData, null, 2), 'utf8');
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
      'production-bundle.json',
    ],
    usage: [
      '先看 production-bundle.json 获取全量总览',
      'provider-payloads.json 直接用于对接 image / voice / video provider',
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
      bundlePath,
    },
  };
}

export async function createRenderJobsForLatestProject(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      scenes: { orderBy: { orderIndex: 'asc' } },
      shots: { orderBy: [{ sceneId: 'asc' }, { orderIndex: 'asc' }] },
      outlines: { orderBy: { createdAt: 'desc' } },
    },
  });

  if (!project) throw new Error('项目不存在');
  if (project.shots.length === 0) throw new Error('没有可用于渲染的 shot');

  await prisma.renderJob.deleteMany({ where: { projectId } });

  const visualBible = getVisualBible(project);
  const characters = getCharacterDrafts(project);
  const characterSummary = summarizeCharacters(characters);
  const shotKindsSummary = summarizeShotKinds(project.shots.map((shot) => shot.title));
  const referenceReadyShots = project.shots.filter((shot) => hasReferenceFlavor(shot.prompt)).length;
  const directorReadyScenes = project.scenes.filter((scene) => (scene.summary || '').includes('导演处理上强调')).length;
  const presetPreview = project.shots.slice(0, 3).map((shot) => {
    const preset = getRenderPresetForShot(shot, visualBible, characters);
    return `${preset.kind}:${preset.visualStyle}`;
  }).join(';');

  await prisma.renderJob.createMany({
    data: [
      {
        projectId,
        status: 'queued',
        provider: 'image-sequence',
        outputUrl: `shots:${project.shots.length}|kinds:${shotKindsSummary}|style:${visualBible?.styleName || 'none'}|characters:${characterSummary}|presetPreview:${presetPreview}`,
      },
      {
        projectId,
        status: 'queued',
        provider: 'voice-synthesis',
        outputUrl: `scenes:${project.scenes.length}|directorReady:${directorReadyScenes}|style:${visualBible?.styleName || 'none'}|characters:${characterSummary}|audioPlan:dialogue+ambience`,
      },
      {
        projectId,
        status: 'queued',
        provider: 'video-assembly',
        outputUrl: `referenceReady:${referenceReadyShots}|style:${visualBible?.styleName || 'none'}|characters:${characterSummary}|presetLinked:true|storyboard-to-video-placeholder`,
      },
    ],
  });

  return getRenderProject();
}

export async function advanceRenderJobs(projectId: string) {
  const jobs = await prisma.renderJob.findMany({
    where: { projectId },
    orderBy: { createdAt: 'asc' },
  });

  if (jobs.length === 0) throw new Error('还没有渲染任务');

  for (const job of jobs) {
    let nextStatus = job.status;
    let nextOutput = job.outputUrl;

    if (job.status === 'queued') nextStatus = 'running';
    else if (job.status === 'running') nextStatus = 'done';

    if (nextStatus === 'done') {
      if (job.provider === 'image-sequence') nextOutput = `${job.outputUrl}|frames:generated`;
      if (job.provider === 'voice-synthesis') nextOutput = `${job.outputUrl}|voice-track:generated`;
      if (job.provider === 'video-assembly') nextOutput = `${job.outputUrl}|final-cut:preview-ready`;
    }

    await prisma.renderJob.update({
      where: { id: job.id },
      data: { status: nextStatus, outputUrl: nextOutput },
    });
  }

  return getRenderProject();
}

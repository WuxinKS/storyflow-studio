import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '@/lib/prisma';
import {
  buildGeneratedMediaLookup,
  getGeneratedMediaEntries,
  getGeneratedMediaForScene,
  getGeneratedMediaForShot,
  type GeneratedMediaEntry,
} from '@/features/media/service';
import { buildReferenceBindingSnapshot } from '@/features/reference/service';
import { getTimelineBundle } from '@/features/timeline/service';

export type FinalCutShotPlan = {
  shotId: string;
  shotTitle: string;
  kind: string;
  duration: number;
  startAt: number;
  endAt: number;
  emotion: string;
  beatType: string | null;
  visualEntry: GeneratedMediaEntry | null;
  visualSourceKind: 'video' | 'image' | 'missing';
  sceneAudioEntry: GeneratedMediaEntry | null;
  referenceTitles: string[];
  referencePromptLine: string | null;
  referenceNote: string | null;
  assemblyState: 'ready-video' | 'image-fallback' | 'missing-visual';
  warnings: string[];
};

export type FinalCutScenePlan = {
  sceneId: string;
  title: string;
  summary: string | null;
  duration: number;
  startAt: number;
  endAt: number;
  emotion: string;
  audioEntry: GeneratedMediaEntry | null;
  readyVideoShots: number;
  imageFallbackShots: number;
  missingVisualShots: number;
  shots: FinalCutShotPlan[];
};

export type FinalCutTimelineItem = {
  orderIndex: number;
  sceneId: string;
  sceneTitle: string;
  shotId: string;
  shotTitle: string;
  kind: string;
  duration: number;
  startAt: number;
  endAt: number;
  visualEntry: GeneratedMediaEntry | null;
  visualSourceKind: 'video' | 'image' | 'missing';
  sceneAudioEntry: GeneratedMediaEntry | null;
  assemblyState: 'ready-video' | 'image-fallback' | 'missing-visual';
  warnings: string[];
};

export type FinalCutPlan = {
  projectId: string;
  projectTitle: string;
  totalDurationLabel: string;
  scenes: FinalCutScenePlan[];
  timelineItems: FinalCutTimelineItem[];
  warnings: string[];
  recommendedActions: string[];
  summary: {
    sceneCount: number;
    shotCount: number;
    readyVideoShots: number;
    imageFallbackShots: number;
    missingVisualShots: number;
    scenesWithAudio: number;
    scenesWithoutAudio: number;
    videoCoverageRate: number;
    visualCoverageRate: number;
    audioCoverageRate: number;
    readyForAssembly: boolean;
    readyForFullVideo: boolean;
    assemblyState: 'ready-full-video' | 'ready-preview' | 'blocked';
  };
};

export type FinalCutAssemblyAsset = {
  source: string | null;
  sourceType: 'local' | 'remote' | 'inline-exported' | 'missing';
  originalSource: string | null;
};

export type FinalCutAssemblyClip = {
  orderIndex: number;
  clipId: string;
  sceneId: string;
  sceneTitle: string;
  shotId: string;
  shotTitle: string;
  kind: string;
  duration: number;
  startAt: number;
  endAt: number;
  visualSourceKind: 'video' | 'image' | 'missing';
  visualAsset: FinalCutAssemblyAsset;
  sceneAudioAsset: FinalCutAssemblyAsset;
  sceneAudioState: 'available' | 'missing';
  assemblyState: 'ready-video' | 'image-fallback' | 'missing-visual';
  warnings: string[];
  referenceTitles: string[];
  referencePromptLine: string | null;
};

export type FinalCutAssemblyAudioSegment = {
  sceneId: string;
  sceneTitle: string;
  duration: number;
  orderIndex: number;
  audioState: 'available' | 'missing';
  audioAsset: FinalCutAssemblyAsset;
};

export type FinalCutAssemblyPackage = {
  version: 1;
  projectId: string;
  projectTitle: string;
  exportedAt: string;
  totalDurationLabel: string;
  assemblyState: FinalCutPlan['summary']['assemblyState'];
  readyForAssembly: boolean;
  readyForFullVideo: boolean;
  clipCount: number;
  audioSegmentCount: number;
  missingVisualClipCount: number;
  missingAudioSceneCount: number;
  usage: string[];
  commands: {
    previewShellFile: string;
    visualSegmentManifestFile: string;
    audioSegmentManifestFile: string;
    previewVideoOutputFile: string;
    previewAudioOutputFile: string;
    previewMuxedOutputFile: string;
  };
  clips: FinalCutAssemblyClip[];
  audioSegments: FinalCutAssemblyAudioSegment[];
};

export type FinalCutAssemblyExport = {
  bundleDir: string;
  package: FinalCutAssemblyPackage;
  files: {
    assemblyPath: string;
    previewScriptPath: string;
    visualSegmentManifestPath: string;
    audioSegmentManifestPath: string;
  };
};

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.svg', '.avif']);
const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.m4a', '.ogg', '.flac', '.aac']);
const VIDEO_EXTENSIONS = new Set(['.mp4', '.webm', '.mov', '.mkv', '.m4v']);
const DATA_URL_PATTERN = /^data:([^;,]+)?(;base64)?,(.*)$/s;

function normalizeText(value: string | null | undefined) {
  return String(value || '').trim();
}

function toPercent(part: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

function slugifyTitle(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'storyflow';
}

function timestampTag() {
  const now = new Date();
  const parts = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ];
  return `${parts[0]}${parts[1]}${parts[2]}-${parts[3]}${parts[4]}${parts[5]}`;
}

function getSourceUrlKind(sourceUrl: string | null | undefined) {
  const normalized = normalizeText(sourceUrl);
  if (!normalized) return null;
  if (normalized.startsWith('data:')) {
    const decoded = decodeDataUrl(normalized);
    return decoded ? getMimeKind(decoded.mime) : null;
  }
  const pathKind = getPathKind(normalized);
  if (pathKind) return pathKind;
  if (/^(https?:\/\/|blob:|\/)/i.test(normalized)) return 'remote';
  return null;
}

function getMimeKind(mime: string) {
  const normalized = normalizeText(mime).toLowerCase();
  if (!normalized) return null;
  if (normalized.startsWith('image/')) return 'image';
  if (normalized.startsWith('audio/')) return 'audio';
  if (normalized.startsWith('video/')) return 'video';
  return null;
}

function hasUsableAsset(entry: GeneratedMediaEntry | null, expectedKind: 'image' | 'audio' | 'video') {
  if (!entry) return false;
  if (getPathKind(entry.localPath) === expectedKind) return true;
  const sourceKind = getSourceUrlKind(entry.sourceUrl);
  if (sourceKind === expectedKind) return true;
  if (sourceKind === 'remote') return true;
  return false;
}

function pickVisualEntry(entries: GeneratedMediaEntry[]) {
  return entries.find((item) => item.type === 'generated-video' && hasUsableAsset(item, 'video'))
    || entries.find((item) => item.type === 'generated-image' && hasUsableAsset(item, 'image'))
    || entries.find((item) => item.type === 'generated-video')
    || entries.find((item) => item.type === 'generated-image')
    || null;
}

function pickSceneAudioEntry(entries: GeneratedMediaEntry[]) {
  return entries.find((item) => item.type === 'generated-audio' && hasUsableAsset(item, 'audio'))
    || entries.find((item) => item.type === 'generated-audio')
    || null;
}

function getVisualSourceKind(entry: GeneratedMediaEntry | null): FinalCutShotPlan['visualSourceKind'] {
  if (!entry) return 'missing';
  if (entry.type === 'generated-video' && hasUsableAsset(entry, 'video')) return 'video';
  if (entry.type === 'generated-image' && hasUsableAsset(entry, 'image')) return 'image';
  return 'missing';
}

function getAssemblyState(kind: FinalCutShotPlan['visualSourceKind']): FinalCutShotPlan['assemblyState'] {
  if (kind === 'video') return 'ready-video';
  if (kind === 'image') return 'image-fallback';
  return 'missing-visual';
}

function buildRecommendedActions(input: {
  missingVisualShots: number;
  imageFallbackShots: number;
  scenesWithoutAudio: number;
  readyForFullVideo: boolean;
  readyForAssembly: boolean;
}) {
  const actions: string[] = [];

  if (input.missingVisualShots > 0) {
    actions.push(`仍有 ${input.missingVisualShots} 个镜头缺少视觉产物，建议先回生成工作台继续执行图像或视频任务。`);
  }
  if (input.imageFallbackShots > 0) {
    actions.push(`当前有 ${input.imageFallbackShots} 个镜头仍在使用图片回退，可继续推进视频生成，提升成片连续性。`);
  }
  if (input.scenesWithoutAudio > 0) {
    actions.push(`当前有 ${input.scenesWithoutAudio} 个场次缺少音轨，建议补跑语音任务再进入最终成片拼装。`);
  }
  if (input.readyForFullVideo) {
    actions.push('当前已经具备完整视频片段与场次音轨，可直接进入最终拼装或导出交付。');
  } else if (input.readyForAssembly) {
    actions.push('当前已具备可预演版本，可先按时间线顺序拼装预演成片，再继续补视频片段。');
  }

  return actions;
}

function getPathKind(filePath: string | null | undefined) {
  const ext = path.extname(normalizeText(filePath).split('?')[0].split('#')[0]).toLowerCase();
  if (VIDEO_EXTENSIONS.has(ext)) return 'video';
  if (IMAGE_EXTENSIONS.has(ext)) return 'image';
  if (AUDIO_EXTENSIONS.has(ext)) return 'audio';
  return null;
}

function decodeDataUrl(value: string) {
  const match = value.match(DATA_URL_PATTERN);
  if (!match) return null;
  const mime = normalizeText(match[1]) || 'application/octet-stream';
  const isBase64 = Boolean(match[2]);
  const payload = match[3] || '';
  const buffer = isBase64 ? Buffer.from(payload, 'base64') : Buffer.from(decodeURIComponent(payload), 'utf8');
  return { mime, buffer };
}

function getExtensionFromMime(mime: string, fallbackKind: 'image' | 'audio' | 'video') {
  const normalized = mime.toLowerCase();
  if (normalized.includes('png')) return '.png';
  if (normalized.includes('jpeg') || normalized.includes('jpg')) return '.jpg';
  if (normalized.includes('webp')) return '.webp';
  if (normalized.includes('gif')) return '.gif';
  if (normalized.includes('svg')) return '.svg';
  if (normalized.includes('wav')) return '.wav';
  if (normalized.includes('mpeg') || normalized.includes('mp3')) return '.mp3';
  if (normalized.includes('mp4')) return fallbackKind === 'audio' ? '.m4a' : '.mp4';
  if (normalized.includes('ogg')) return '.ogg';
  if (normalized.includes('webm')) return '.webm';
  if (normalized.includes('quicktime')) return '.mov';
  return fallbackKind === 'audio' ? '.m4a' : fallbackKind === 'video' ? '.mp4' : '.png';
}

async function resolveAssemblyAsset(input: {
  entry: GeneratedMediaEntry | null;
  expectedKind: 'image' | 'audio' | 'video';
  inlineMediaDir: string;
  fileStem: string;
}): Promise<FinalCutAssemblyAsset> {
  if (!input.entry) {
    return {
      source: null,
      sourceType: 'missing',
      originalSource: null,
    } satisfies FinalCutAssemblyAsset;
  }

  const localPath = normalizeText(input.entry.localPath);
  const sourceUrl = normalizeText(input.entry.sourceUrl);

  if (localPath && getPathKind(localPath) === input.expectedKind) {
    const resolvedLocalPath = path.isAbsolute(localPath) ? localPath : path.resolve(process.cwd(), localPath);
    return {
      source: resolvedLocalPath,
      sourceType: 'local',
      originalSource: localPath,
    } satisfies FinalCutAssemblyAsset;
  }

  if (sourceUrl.startsWith('data:')) {
    const decoded = decodeDataUrl(sourceUrl);
    if (decoded) {
      await mkdir(input.inlineMediaDir, { recursive: true });
      const extension = getExtensionFromMime(decoded.mime, input.expectedKind);
      const inlinePath = path.join(input.inlineMediaDir, `${input.fileStem}${extension}`);
      await writeFile(inlinePath, decoded.buffer);
      return {
        source: inlinePath,
        sourceType: 'inline-exported',
        originalSource: sourceUrl,
      } satisfies FinalCutAssemblyAsset;
    }
  }

  if (sourceUrl) {
    return {
      source: sourceUrl,
      sourceType: 'remote',
      originalSource: sourceUrl,
    } satisfies FinalCutAssemblyAsset;
  }

  return {
    source: null,
    sourceType: 'missing',
    originalSource: localPath || sourceUrl || null,
  } satisfies FinalCutAssemblyAsset;
}

function buildVisualSegmentManifest(clips: FinalCutAssemblyClip[]) {
  return clips.map((clip) => `file 'final-cut-preview-segments/clip-${String(clip.orderIndex).padStart(3, '0')}.mp4'`).join('\n');
}

function buildAudioSegmentManifest(audioSegments: FinalCutAssemblyAudioSegment[]) {
  return audioSegments.map((segment) => `file 'final-cut-audio-segments/scene-${String(segment.orderIndex).padStart(3, '0')}.m4a'`).join('\n');
}

function shQuote(value: string) {
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}

function buildAssemblyShellScript(pkg: FinalCutAssemblyPackage) {
  const missingVisualCount = pkg.missingVisualClipCount;
  const clipCommands = pkg.clips.map((clip) => {
    const segmentName = `clip-${String(clip.orderIndex).padStart(3, '0')}.mp4`;
    const outputPath = `$SEGMENT_DIR/${segmentName}`;
    if (!clip.visualAsset.source) {
      return `# ${clip.shotTitle} 缺少可用视觉源，无法生成 ${segmentName}`;
    }

    if (clip.visualSourceKind === 'video') {
      return `ffmpeg -y -i ${shQuote(clip.visualAsset.source)} -t ${clip.duration} -vf "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,fps=24" -pix_fmt yuv420p -c:v libx264 -preset medium -crf 20 -an "${outputPath}"`;
    }

    return `ffmpeg -y -loop 1 -t ${clip.duration} -i ${shQuote(clip.visualAsset.source)} -vf "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,fps=24" -pix_fmt yuv420p -c:v libx264 -preset medium -crf 20 -an "${outputPath}"`;
  }).join('\n');

  const audioCommands = pkg.audioSegments.map((segment) => {
    const segmentName = `scene-${String(segment.orderIndex).padStart(3, '0')}.m4a`;
    const outputPath = `$AUDIO_DIR/${segmentName}`;
    if (segment.audioAsset.source) {
      return `ffmpeg -y -stream_loop -1 -i ${shQuote(segment.audioAsset.source)} -t ${segment.duration} -vn -c:a aac -b:a 192k "${outputPath}"`;
    }
    return `ffmpeg -y -f lavfi -i anullsrc=channel_layout=stereo:sample_rate=48000 -t ${segment.duration} -c:a aac -b:a 192k "${outputPath}"`;
  }).join('\n');

  return `#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
SEGMENT_DIR="$ROOT_DIR/final-cut-preview-segments"
AUDIO_DIR="$ROOT_DIR/final-cut-audio-segments"
VISUAL_MANIFEST="$ROOT_DIR/${pkg.commands.visualSegmentManifestFile}"
AUDIO_MANIFEST="$ROOT_DIR/${pkg.commands.audioSegmentManifestFile}"
VISUAL_OUTPUT="$ROOT_DIR/${pkg.commands.previewVideoOutputFile}"
AUDIO_OUTPUT="$ROOT_DIR/${pkg.commands.previewAudioOutputFile}"
FINAL_OUTPUT="$ROOT_DIR/${pkg.commands.previewMuxedOutputFile}"

command -v ffmpeg >/dev/null 2>&1 || { echo "需要先安装 ffmpeg"; exit 1; }
cd "$ROOT_DIR"
mkdir -p "$SEGMENT_DIR" "$AUDIO_DIR"

${missingVisualCount > 0 ? `echo "当前仍有 ${missingVisualCount} 个镜头缺少视觉产物，先回 StoryFlow Studio 补齐后再执行装配脚本。"
exit 1
` : ''}echo "[1/3] 生成镜头预演片段"
${clipCommands}

echo "[2/3] 生成场次音轨片段"
${audioCommands}

echo "[3/3] 拼装预演成片"
ffmpeg -y -f concat -safe 0 -i "$VISUAL_MANIFEST" -c copy "$VISUAL_OUTPUT"
ffmpeg -y -f concat -safe 0 -i "$AUDIO_MANIFEST" -c copy "$AUDIO_OUTPUT"
ffmpeg -y -i "$VISUAL_OUTPUT" -i "$AUDIO_OUTPUT" -c:v copy -c:a aac -shortest "$FINAL_OUTPUT"

echo "预演成片已生成：$FINAL_OUTPUT"
`;
}

export async function getFinalCutPlan(projectId?: string): Promise<FinalCutPlan | null> {
  const project = projectId
    ? await prisma.project.findUnique({
        where: { id: projectId },
        include: {
          scenes: { orderBy: { orderIndex: 'asc' } },
          shots: { orderBy: [{ sceneId: 'asc' }, { orderIndex: 'asc' }] },
          outlines: { orderBy: { createdAt: 'desc' } },
          references: { orderBy: { createdAt: 'desc' } },
        },
      })
    : await prisma.project.findFirst({
        orderBy: { updatedAt: 'desc' },
        include: {
          scenes: { orderBy: { orderIndex: 'asc' } },
          shots: { orderBy: [{ sceneId: 'asc' }, { orderIndex: 'asc' }] },
          outlines: { orderBy: { createdAt: 'desc' } },
          references: { orderBy: { createdAt: 'desc' } },
        },
      });

  if (!project) return null;

  const timeline = await getTimelineBundle(project.id);
  if (!timeline) return null;

  const generatedMedia = getGeneratedMediaEntries(project);
  const mediaLookup = buildGeneratedMediaLookup(generatedMedia);
  const referenceBindings = buildReferenceBindingSnapshot(project);

  const scenes = timeline.scenes.map((scene) => {
    const sceneAudioEntry = pickSceneAudioEntry(getGeneratedMediaForScene(mediaLookup, scene.id));
    const sceneHasUsableAudio = hasUsableAsset(sceneAudioEntry, 'audio');

    const shots = scene.shots.map((shot): FinalCutShotPlan => {
      const visualEntry = pickVisualEntry(getGeneratedMediaForShot(mediaLookup, shot.id));
      const visualSourceKind = getVisualSourceKind(visualEntry);
      const referenceBinding = referenceBindings.effectiveShotMap.get(shot.id) || null;
      const warnings: string[] = [];

      if (!visualEntry) {
        warnings.push('缺少视觉产物');
      } else if (visualSourceKind === 'image') {
        warnings.push('当前仍使用图片回退');
      } else if (visualSourceKind === 'missing') {
        warnings.push('已有视觉生成记录，但缺少可直接装配的视觉文件');
      }

      if (!sceneAudioEntry) {
        warnings.push('场次缺少音轨');
      } else if (!sceneHasUsableAudio) {
        warnings.push('场次已有音轨记录，但缺少可直接装配的音轨文件');
      }

      return {
        shotId: shot.id,
        shotTitle: shot.title,
        kind: shot.kind,
        duration: shot.duration,
        startAt: shot.startAt,
        endAt: shot.endAt,
        emotion: shot.emotionLabel,
        beatType: shot.beatType || null,
        visualEntry,
        visualSourceKind,
        sceneAudioEntry,
        referenceTitles: referenceBinding?.referenceTitles || [],
        referencePromptLine: referenceBinding?.promptLine || null,
        referenceNote: referenceBinding?.note || null,
        assemblyState: getAssemblyState(visualSourceKind),
        warnings,
      };
    });

    const readyVideoShots = shots.filter((shot) => shot.visualSourceKind === 'video').length;
    const imageFallbackShots = shots.filter((shot) => shot.visualSourceKind === 'image').length;
    const missingVisualShots = shots.filter((shot) => shot.visualSourceKind === 'missing').length;

    return {
      sceneId: scene.id,
      title: scene.title,
      summary: scene.summary || null,
      duration: scene.duration,
      startAt: scene.startAt,
      endAt: scene.endAt,
      emotion: scene.emotionLabel,
      audioEntry: sceneAudioEntry,
      readyVideoShots,
      imageFallbackShots,
      missingVisualShots,
      shots,
    } satisfies FinalCutScenePlan;
  });

  const timelineItems = scenes.flatMap((scene) =>
    scene.shots.map((shot, index): FinalCutTimelineItem => ({
      orderIndex: index + 1 + scenes
        .filter((candidate) => candidate.startAt < scene.startAt)
        .reduce((sum, candidate) => sum + candidate.shots.length, 0),
      sceneId: scene.sceneId,
      sceneTitle: scene.title,
      shotId: shot.shotId,
      shotTitle: shot.shotTitle,
      kind: shot.kind,
      duration: shot.duration,
      startAt: shot.startAt,
      endAt: shot.endAt,
      visualEntry: shot.visualEntry,
      visualSourceKind: shot.visualSourceKind,
      sceneAudioEntry: shot.sceneAudioEntry,
      assemblyState: shot.assemblyState,
      warnings: shot.warnings,
    })),
  );

  const shotCount = scenes.reduce((sum, scene) => sum + scene.shots.length, 0);
  const readyVideoShots = scenes.reduce((sum, scene) => sum + scene.readyVideoShots, 0);
  const imageFallbackShots = scenes.reduce((sum, scene) => sum + scene.imageFallbackShots, 0);
  const missingVisualShots = scenes.reduce((sum, scene) => sum + scene.missingVisualShots, 0);
  const scenesWithAudio = scenes.filter((scene) => hasUsableAsset(scene.audioEntry, 'audio')).length;
  const scenesWithoutAudio = scenes.length - scenesWithAudio;
  const visualReadyShots = readyVideoShots + imageFallbackShots;
  const readyForAssembly = shotCount > 0 && missingVisualShots === 0;
  const readyForFullVideo = shotCount > 0 && readyVideoShots === shotCount && scenesWithoutAudio === 0;
  const assemblyState = readyForFullVideo ? 'ready-full-video' : readyForAssembly ? 'ready-preview' : 'blocked';
  const warnings = scenes.flatMap((scene) => {
    const items: string[] = [];
    if (!hasUsableAsset(scene.audioEntry, 'audio')) items.push(`场次缺少可装配音轨：${scene.title}`);
    if (scene.missingVisualShots > 0) items.push(`场次仍有 ${scene.missingVisualShots} 个镜头缺少视觉产物：${scene.title}`);
    if (scene.imageFallbackShots > 0) items.push(`场次仍有 ${scene.imageFallbackShots} 个镜头使用图片回退：${scene.title}`);
    return items;
  });
  const recommendedActions = buildRecommendedActions({
    missingVisualShots,
    imageFallbackShots,
    scenesWithoutAudio,
    readyForFullVideo,
    readyForAssembly,
  });

  return {
    projectId: project.id,
    projectTitle: project.title,
    totalDurationLabel: timeline.totalDurationLabel,
    scenes,
    timelineItems,
    warnings,
    recommendedActions,
    summary: {
      sceneCount: scenes.length,
      shotCount,
      readyVideoShots,
      imageFallbackShots,
      missingVisualShots,
      scenesWithAudio,
      scenesWithoutAudio,
      videoCoverageRate: toPercent(readyVideoShots, shotCount),
      visualCoverageRate: toPercent(visualReadyShots, shotCount),
      audioCoverageRate: toPercent(scenesWithAudio, scenes.length),
      readyForAssembly,
      readyForFullVideo,
      assemblyState,
    },
  };
}

export async function exportFinalCutAssemblyPackage(projectId: string, options?: { outputDir?: string }) : Promise<FinalCutAssemblyExport> {
  const plan = await getFinalCutPlan(projectId);
  if (!plan) throw new Error('当前还没有可导出的成片计划');

  const baseDir = options?.outputDir
    ? path.resolve(options.outputDir)
    : path.join(process.cwd(), 'exports', 'final-cut-assemblies', `${timestampTag()}-${slugifyTitle(plan.projectTitle)}`);
  await mkdir(baseDir, { recursive: true });

  const inlineMediaDir = path.join(baseDir, 'final-cut-inline-media');
  const visualSegmentManifestPath = path.join(baseDir, 'final-cut-segments.txt');
  const audioSegmentManifestPath = path.join(baseDir, 'final-cut-audio-segments.txt');
  const previewScriptPath = path.join(baseDir, 'assemble-final-cut.sh');
  const assemblyPath = path.join(baseDir, 'final-cut-assembly.json');

  const clips: FinalCutAssemblyClip[] = [];
  for (const item of plan.timelineItems) {
    const visualAsset = await resolveAssemblyAsset({
      entry: item.visualEntry,
      expectedKind: item.visualSourceKind === 'video' ? 'video' : 'image',
      inlineMediaDir,
      fileStem: `clip-${String(item.orderIndex).padStart(3, '0')}-${slugifyTitle(item.shotTitle)}`,
    });
    const sceneAudioAsset = await resolveAssemblyAsset({
      entry: item.sceneAudioEntry,
      expectedKind: 'audio',
      inlineMediaDir,
      fileStem: `scene-audio-${slugifyTitle(item.sceneTitle)}`,
    });

    const sceneData = plan.scenes.find((scene) => scene.sceneId === item.sceneId);
    const shotData = sceneData?.shots.find((shot) => shot.shotId === item.shotId);
    clips.push({
      orderIndex: item.orderIndex,
      clipId: `clip-${String(item.orderIndex).padStart(3, '0')}`,
      sceneId: item.sceneId,
      sceneTitle: item.sceneTitle,
      shotId: item.shotId,
      shotTitle: item.shotTitle,
      kind: item.kind,
      duration: item.duration,
      startAt: item.startAt,
      endAt: item.endAt,
      visualSourceKind: item.visualSourceKind,
      visualAsset,
      sceneAudioAsset,
      sceneAudioState: sceneAudioAsset.source ? 'available' : 'missing',
      assemblyState: item.assemblyState,
      warnings: item.warnings,
      referenceTitles: shotData?.referenceTitles || [],
      referencePromptLine: shotData?.referencePromptLine || null,
    });
  }

  const audioSegments: FinalCutAssemblyAudioSegment[] = [];
  for (const [index, scene] of plan.scenes.entries()) {
    const audioAsset = await resolveAssemblyAsset({
      entry: scene.audioEntry,
      expectedKind: 'audio',
      inlineMediaDir,
      fileStem: `scene-${String(index + 1).padStart(3, '0')}-${slugifyTitle(scene.title)}-audio`,
    });
    audioSegments.push({
      sceneId: scene.sceneId,
      sceneTitle: scene.title,
      duration: scene.duration,
      orderIndex: index + 1,
      audioState: audioAsset.source ? 'available' : 'missing',
      audioAsset,
    });
  }

  const missingVisualClipCount = clips.filter((clip) => !clip.visualAsset.source).length;
  const missingAudioSceneCount = audioSegments.filter((segment) => !segment.audioAsset.source).length;
  const readyForAssembly = clips.length > 0 && missingVisualClipCount === 0;
  const readyForFullVideo = clips.length > 0 && clips.every((clip) => clip.visualSourceKind === 'video' && Boolean(clip.visualAsset.source)) && missingAudioSceneCount === 0;
  const assemblyState = readyForFullVideo ? 'ready-full-video' : readyForAssembly ? 'ready-preview' : 'blocked';

  const pkg: FinalCutAssemblyPackage = {
    version: 1,
    projectId: plan.projectId,
    projectTitle: plan.projectTitle,
    exportedAt: new Date().toISOString(),
    totalDurationLabel: plan.totalDurationLabel,
    assemblyState,
    readyForAssembly,
    readyForFullVideo,
    clipCount: clips.length,
    audioSegmentCount: audioSegments.length,
    missingVisualClipCount,
    missingAudioSceneCount,
    usage: [
      '先看 final-cut-assembly.json，确认每个镜头最终采用的视频 / 图片回退与场次音轨来源。',
      '执行 assemble-final-cut.sh 需要本机安装 ffmpeg；脚本会自动生成镜头片段、场次音轨段并合成预演成片。',
      '如果脚本提示缺少视觉产物，请先回生成工作台补跑图像或视频任务，再重新导出装配包。',
    ],
    commands: {
      previewShellFile: path.basename(previewScriptPath),
      visualSegmentManifestFile: path.basename(visualSegmentManifestPath),
      audioSegmentManifestFile: path.basename(audioSegmentManifestPath),
      previewVideoOutputFile: 'final-cut-preview-visual.mp4',
      previewAudioOutputFile: 'final-cut-preview-audio.m4a',
      previewMuxedOutputFile: 'final-cut-preview.mp4',
    },
    clips,
    audioSegments,
  };

  await writeFile(visualSegmentManifestPath, `${buildVisualSegmentManifest(clips)}\n`, 'utf8');
  await writeFile(audioSegmentManifestPath, `${buildAudioSegmentManifest(audioSegments)}\n`, 'utf8');
  await writeFile(previewScriptPath, buildAssemblyShellScript(pkg), { encoding: 'utf8', mode: 0o755 });
  await writeFile(assemblyPath, JSON.stringify(pkg, null, 2), 'utf8');

  return {
    bundleDir: baseDir,
    package: pkg,
    files: {
      assemblyPath,
      previewScriptPath,
      visualSegmentManifestPath,
      audioSegmentManifestPath,
    },
  } satisfies FinalCutAssemblyExport;
}

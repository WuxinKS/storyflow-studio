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

function toPercent(part: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

function pickVisualEntry(entries: GeneratedMediaEntry[]) {
  return entries.find((item) => item.type === 'generated-video')
    || entries.find((item) => item.type === 'generated-image')
    || null;
}

function getVisualSourceKind(entry: GeneratedMediaEntry | null): FinalCutShotPlan['visualSourceKind'] {
  if (!entry) return 'missing';
  if (entry.type === 'generated-video') return 'video';
  return 'image';
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
    const sceneAudioEntry = getGeneratedMediaForScene(mediaLookup, scene.id).find((item) => item.type === 'generated-audio') || null;

    const shots = scene.shots.map((shot): FinalCutShotPlan => {
      const visualEntry = pickVisualEntry(getGeneratedMediaForShot(mediaLookup, shot.id));
      const visualSourceKind = getVisualSourceKind(visualEntry);
      const referenceBinding = referenceBindings.effectiveShotMap.get(shot.id) || null;
      const warnings: string[] = [];

      if (!visualEntry) {
        warnings.push('缺少视觉产物');
      } else if (visualSourceKind === 'image') {
        warnings.push('当前仍使用图片回退');
      }

      if (!sceneAudioEntry) {
        warnings.push('场次缺少音轨');
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
  const scenesWithAudio = scenes.filter((scene) => Boolean(scene.audioEntry)).length;
  const scenesWithoutAudio = scenes.length - scenesWithAudio;
  const visualReadyShots = readyVideoShots + imageFallbackShots;
  const readyForAssembly = shotCount > 0 && missingVisualShots === 0;
  const readyForFullVideo = shotCount > 0 && readyVideoShots === shotCount && scenesWithoutAudio === 0;
  const assemblyState = readyForFullVideo ? 'ready-full-video' : readyForAssembly ? 'ready-preview' : 'blocked';
  const warnings = scenes.flatMap((scene) => {
    const items: string[] = [];
    if (!scene.audioEntry) items.push(`场次缺少音轨：${scene.title}`);
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

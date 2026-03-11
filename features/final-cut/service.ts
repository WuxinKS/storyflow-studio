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

export type FinalCutPlan = {
  projectId: string;
  projectTitle: string;
  totalDurationLabel: string;
  scenes: FinalCutScenePlan[];
  warnings: string[];
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

  const shotCount = scenes.reduce((sum, scene) => sum + scene.shots.length, 0);
  const readyVideoShots = scenes.reduce((sum, scene) => sum + scene.readyVideoShots, 0);
  const imageFallbackShots = scenes.reduce((sum, scene) => sum + scene.imageFallbackShots, 0);
  const missingVisualShots = scenes.reduce((sum, scene) => sum + scene.missingVisualShots, 0);
  const scenesWithAudio = scenes.filter((scene) => Boolean(scene.audioEntry)).length;
  const scenesWithoutAudio = scenes.length - scenesWithAudio;
  const visualReadyShots = readyVideoShots + imageFallbackShots;
  const readyForAssembly = shotCount > 0 && missingVisualShots === 0;
  const readyForFullVideo = shotCount > 0 && readyVideoShots === shotCount && scenesWithoutAudio === 0;
  const warnings = scenes.flatMap((scene) => {
    const items: string[] = [];
    if (!scene.audioEntry) items.push(`场次缺少音轨：${scene.title}`);
    if (scene.missingVisualShots > 0) items.push(`场次仍有 ${scene.missingVisualShots} 个镜头缺少视觉产物：${scene.title}`);
    if (scene.imageFallbackShots > 0) items.push(`场次仍有 ${scene.imageFallbackShots} 个镜头使用图片回退：${scene.title}`);
    return items;
  });

  return {
    projectId: project.id,
    projectTitle: project.title,
    totalDurationLabel: timeline.totalDurationLabel,
    scenes,
    warnings,
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
    },
  };
}

import { prisma } from '@/lib/prisma';
import {
  buildGeneratedMediaLookup,
  getGeneratedMediaEntries,
  getGeneratedMediaForScene,
  getGeneratedMediaForShot,
  summarizeGeneratedMediaCounts,
} from '@/features/media/service';
import { buildReferenceBindingSnapshot } from '@/features/reference/service';

export async function getStoryboardProject(projectId?: string) {
  const project = await (projectId
    ? prisma.project.findUnique({
        where: { id: projectId },
        include: {
          scenes: { orderBy: { orderIndex: 'asc' } },
          shots: { orderBy: [{ sceneId: 'asc' }, { orderIndex: 'asc' }] },
          outlines: { orderBy: { createdAt: 'desc' } },
          references: { orderBy: { createdAt: 'desc' } },
        },
      })
    : prisma.project.findFirst({
        orderBy: { updatedAt: 'desc' },
        include: {
          scenes: { orderBy: { orderIndex: 'asc' } },
          shots: { orderBy: [{ sceneId: 'asc' }, { orderIndex: 'asc' }] },
          outlines: { orderBy: { createdAt: 'desc' } },
          references: { orderBy: { createdAt: 'desc' } },
        },
      }));

  if (!project) return null;

  const generatedMedia = getGeneratedMediaEntries(project);
  const mediaLookup = buildGeneratedMediaLookup(generatedMedia);
  const referenceBindings = buildReferenceBindingSnapshot(project);

  return {
    projectId: project.id,
    projectTitle: project.title,
    mediaCounts: summarizeGeneratedMediaCounts(generatedMedia),
    bindingSummary: {
      sceneBoundCount: referenceBindings.sceneBindingCount,
      shotBoundCount: referenceBindings.shotBindingCount,
      effectiveShotBoundCount: referenceBindings.effectiveShotBindingCount,
    },
    scenes: project.scenes.map((scene) => {
      const sceneMedia = getGeneratedMediaForScene(mediaLookup, scene.id);
      const sceneShots = project.shots.filter((shot) => shot.sceneId === scene.id);
      const sceneBinding = referenceBindings.sceneMap.get(scene.id) || null;

      return {
        id: scene.id,
        orderIndex: scene.orderIndex,
        title: scene.title,
        summary: scene.summary,
        mediaCounts: summarizeGeneratedMediaCounts(sceneMedia),
        referenceTitles: sceneBinding?.referenceTitles || [],
        referencePromptLine: sceneBinding?.promptLine || null,
        referenceNote: sceneBinding?.note || '',
        shots: sceneShots.map((shot) => {
          const shotMedia = getGeneratedMediaForShot(mediaLookup, shot.id);
          const effectiveBinding = referenceBindings.effectiveShotMap.get(shot.id) || null;
          return {
            id: shot.id,
            title: shot.title,
            prompt: shot.prompt,
            cameraNotes: shot.cameraNotes,
            mediaCounts: summarizeGeneratedMediaCounts(shotMedia),
            latestMedia: shotMedia[0] || null,
            referenceTitles: effectiveBinding?.referenceTitles || [],
            referencePromptLine: effectiveBinding?.promptLine || null,
            referenceNote: effectiveBinding?.note || '',
            hasDirectReferenceBinding: referenceBindings.shotMap.has(shot.id),
          };
        }),
      };
    }),
  };
}

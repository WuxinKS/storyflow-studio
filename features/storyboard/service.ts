import { prisma } from '@/lib/prisma';
import {
  buildGeneratedMediaLookup,
  getGeneratedMediaEntries,
  getGeneratedMediaForScene,
  getGeneratedMediaForShot,
  summarizeGeneratedMediaCounts,
} from '@/features/media/service';

export async function getStoryboardProject(projectId?: string) {
  const project = await (projectId
    ? prisma.project.findUnique({
        where: { id: projectId },
        include: {
          scenes: { orderBy: { orderIndex: 'asc' } },
          shots: { orderBy: [{ sceneId: 'asc' }, { orderIndex: 'asc' }] },
          outlines: { orderBy: { createdAt: 'desc' } },
        },
      })
    : prisma.project.findFirst({
        orderBy: { updatedAt: 'desc' },
        include: {
          scenes: { orderBy: { orderIndex: 'asc' } },
          shots: { orderBy: [{ sceneId: 'asc' }, { orderIndex: 'asc' }] },
          outlines: { orderBy: { createdAt: 'desc' } },
        },
      }));

  if (!project) return null;

  const generatedMedia = getGeneratedMediaEntries(project);
  const mediaLookup = buildGeneratedMediaLookup(generatedMedia);

  return {
    projectId: project.id,
    projectTitle: project.title,
    mediaCounts: summarizeGeneratedMediaCounts(generatedMedia),
    scenes: project.scenes.map((scene) => {
      const sceneMedia = getGeneratedMediaForScene(mediaLookup, scene.id);
      const sceneShots = project.shots.filter((shot) => shot.sceneId === scene.id);

      return {
        id: scene.id,
        orderIndex: scene.orderIndex,
        title: scene.title,
        summary: scene.summary,
        mediaCounts: summarizeGeneratedMediaCounts(sceneMedia),
        shots: sceneShots.map((shot) => {
          const shotMedia = getGeneratedMediaForShot(mediaLookup, shot.id);
          return {
            id: shot.id,
            title: shot.title,
            prompt: shot.prompt,
            cameraNotes: shot.cameraNotes,
            mediaCounts: summarizeGeneratedMediaCounts(shotMedia),
            latestMedia: shotMedia[0] || null,
          };
        }),
      };
    }),
  };
}

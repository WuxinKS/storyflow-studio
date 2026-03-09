import { prisma } from '@/lib/prisma';

export async function getStoryboardProject() {
  return prisma.project.findFirst({
    orderBy: { updatedAt: 'desc' },
    include: {
      scenes: { orderBy: { orderIndex: 'asc' } },
      shots: { orderBy: [{ sceneId: 'asc' }, { orderIndex: 'asc' }] },
    },
  });
}

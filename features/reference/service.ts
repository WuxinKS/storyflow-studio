import { prisma } from '@/lib/prisma';

export async function getReferenceProject() {
  return prisma.project.findFirst({
    orderBy: { updatedAt: 'desc' },
    include: {
      references: { orderBy: { createdAt: 'desc' } },
    },
  });
}

export async function createReferenceAnalysis(input: {
  projectId: string;
  title: string;
  sourceType: 'image' | 'video';
  framing: string;
  emotion: string;
  movement: string;
  notes: string;
}) {
  const analysis = [
    `标题：${input.title}`,
    `景别/构图：${input.framing}`,
    `情绪：${input.emotion}`,
    `动作/节奏：${input.movement}`,
    `补充说明：${input.notes}`,
  ].join('\n');

  await prisma.referenceAsset.create({
    data: {
      projectId: input.projectId,
      type: input.sourceType,
      notes: analysis,
      sourceUrl: null,
      localPath: null,
    },
  });

  return getReferenceProject();
}

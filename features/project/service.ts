import { prisma } from '@/lib/prisma';

type CreateProjectInput = {
  title: string;
  hook: string;
  genre: string;
  style: string;
  output: 'novel' | 'screenplay' | 'video';
};

export async function createProjectWithIdea(input: CreateProjectInput) {
  return prisma.project.create({
    data: {
      title: input.title,
      premise: input.hook,
      genre: input.genre,
      description: `${input.style} · output:${input.output}`,
      ideaSeeds: {
        create: {
          input: input.hook,
          styleNotes: `${input.style} · output:${input.output}`,
        },
      },
      outlines: {
        create: {
          title: 'Initial Outline Placeholder',
          summary: '初始大纲占位，后续由 Story Engine 自动生成。',
        },
      },
    },
    include: {
      ideaSeeds: true,
      outlines: true,
    },
  });
}

export async function listProjects() {
  return prisma.project.findMany({
    orderBy: { updatedAt: 'desc' },
    include: {
      ideaSeeds: { take: 1, orderBy: { createdAt: 'desc' } },
      outlines: { take: 1, orderBy: { createdAt: 'desc' } },
    },
  });
}

import { prisma } from '@/lib/prisma';

export async function createOutlineVersion(projectId: string, title: string, summary: string) {
  return prisma.outline.create({
    data: { projectId, title, summary },
  });
}

export function getLatestOutlineByTitle<T extends { title: string }>(
  outlines: T[],
  title: string,
) {
  return outlines.find((item) => item.title === title) || null;
}

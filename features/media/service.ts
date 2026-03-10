import { prisma } from '@/lib/prisma';
import { createOutlineVersion, getLatestOutlineByTitle } from '@/lib/outline-store';

export const GENERATED_MEDIA_LIBRARY_TITLE = 'Generated Media Library';

export type GeneratedMediaType = 'generated-image' | 'generated-audio' | 'generated-video';
export type GeneratedMediaMode = 'mock' | 'remote';

export type GeneratedMediaEntry = {
  id: string;
  provider: string;
  type: GeneratedMediaType;
  title: string;
  summary: string;
  tags: string[];
  sceneId?: string;
  shotId?: string;
  sourceUrl?: string | null;
  localPath?: string | null;
  artifactPath?: string | null;
  requestPath?: string | null;
  responsePath?: string | null;
  mode: GeneratedMediaMode;
  createdAt: string;
};

export type GeneratedMediaCounts = {
  total: number;
  images: number;
  audio: number;
  videos: number;
  remote: number;
  mock: number;
};

export type GeneratedMediaLookup = {
  byScene: Map<string, GeneratedMediaEntry[]>;
  byShot: Map<string, GeneratedMediaEntry[]>;
};

function normalizeGeneratedMediaEntry(entry: Partial<GeneratedMediaEntry>) {
  const type = entry.type === 'generated-audio'
    ? 'generated-audio'
    : entry.type === 'generated-video'
      ? 'generated-video'
      : 'generated-image';

  const mode = entry.mode === 'remote' ? 'remote' : 'mock';

  return {
    id: String(entry.id || '').trim(),
    provider: String(entry.provider || '').trim(),
    type,
    title: String(entry.title || '').trim(),
    summary: String(entry.summary || '').trim(),
    tags: Array.isArray(entry.tags) ? entry.tags.map((tag) => String(tag).trim()).filter(Boolean) : [],
    sceneId: entry.sceneId ? String(entry.sceneId) : undefined,
    shotId: entry.shotId ? String(entry.shotId) : undefined,
    sourceUrl: entry.sourceUrl ? String(entry.sourceUrl) : undefined,
    localPath: entry.localPath ? String(entry.localPath) : undefined,
    artifactPath: entry.artifactPath ? String(entry.artifactPath) : undefined,
    requestPath: entry.requestPath ? String(entry.requestPath) : undefined,
    responsePath: entry.responsePath ? String(entry.responsePath) : undefined,
    mode,
    createdAt: String(entry.createdAt || new Date().toISOString()),
  } satisfies GeneratedMediaEntry;
}

export function parseGeneratedMediaLibrary(content: string | null | undefined) {
  if (!content?.trim()) return [] as GeneratedMediaEntry[];

  try {
    const parsed = JSON.parse(content) as { items?: Partial<GeneratedMediaEntry>[] } | Partial<GeneratedMediaEntry>[];
    const items = Array.isArray(parsed) ? parsed : parsed.items || [];
    return items
      .filter(Boolean)
      .map((item) => normalizeGeneratedMediaEntry(item))
      .filter((item) => item.id && item.provider && item.title && item.summary);
  } catch {
    return [] as GeneratedMediaEntry[];
  }
}

export function serializeGeneratedMediaLibrary(entries: GeneratedMediaEntry[]) {
  return JSON.stringify({ version: 1, items: entries }, null, 2);
}

export function getGeneratedMediaEntries(project: { outlines: Array<{ title: string; summary: string }> } | null) {
  if (!project) return [] as GeneratedMediaEntry[];
  const outline = getLatestOutlineByTitle(project.outlines, GENERATED_MEDIA_LIBRARY_TITLE);
  return parseGeneratedMediaLibrary(outline?.summary || '').sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function summarizeGeneratedMediaCounts(entries: GeneratedMediaEntry[]): GeneratedMediaCounts {
  return {
    total: entries.length,
    images: entries.filter((item) => item.type === 'generated-image').length,
    audio: entries.filter((item) => item.type === 'generated-audio').length,
    videos: entries.filter((item) => item.type === 'generated-video').length,
    remote: entries.filter((item) => item.mode === 'remote').length,
    mock: entries.filter((item) => item.mode === 'mock').length,
  };
}

export function buildGeneratedMediaLookup(entries: GeneratedMediaEntry[]): GeneratedMediaLookup {
  const byScene = new Map<string, GeneratedMediaEntry[]>();
  const byShot = new Map<string, GeneratedMediaEntry[]>();

  for (const entry of entries) {
    if (entry.sceneId) {
      const current = byScene.get(entry.sceneId) || [];
      current.push(entry);
      byScene.set(entry.sceneId, current);
    }
    if (entry.shotId) {
      const current = byShot.get(entry.shotId) || [];
      current.push(entry);
      byShot.set(entry.shotId, current);
    }
  }

  return { byScene, byShot };
}

export function getGeneratedMediaForScene(lookup: GeneratedMediaLookup, sceneId: string) {
  return lookup.byScene.get(sceneId) || [];
}

export function getGeneratedMediaForShot(lookup: GeneratedMediaLookup, shotId: string) {
  return lookup.byShot.get(shotId) || [];
}

export async function replaceGeneratedMediaEntriesForProvider(
  projectId: string,
  provider: string,
  entries: GeneratedMediaEntry[],
) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      outlines: { orderBy: { createdAt: 'desc' } },
    },
  });

  if (!project) throw new Error('项目不存在');

  const existingEntries = getGeneratedMediaEntries(project);
  const nextEntries = [
    ...entries,
    ...existingEntries.filter((item) => item.provider !== provider),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  await createOutlineVersion(projectId, GENERATED_MEDIA_LIBRARY_TITLE, serializeGeneratedMediaLibrary(nextEntries));
  return nextEntries;
}

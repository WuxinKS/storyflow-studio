import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { createOutlineVersion, getLatestOutlineByTitle } from '@/lib/outline-store';

export const REFERENCE_BINDINGS_TITLE = 'Reference Bindings';

export type ReferenceNoteDraft = {
  title: string;
  framing: string;
  emotion: string;
  movement: string;
  notes: string;
};

export type ReferenceInsight = ReferenceNoteDraft & {
  id: string;
  sourceType: 'image' | 'video';
  rawNotes: string;
  sourceUrl: string | null;
  localPath: string | null;
  createdAt: string | null;
};

export type ReferenceProfile = {
  total: number;
  imageCount: number;
  videoCount: number;
  titles: string[];
  titleSummary: string;
  sourceUrls: string[];
  localPaths: string[];
  sourceSummary: string;
  hasSourceMedia: boolean;
  framing: string;
  emotion: string;
  movement: string;
  noteSummary: string;
  highlights: string[];
  promptLine: string;
};

export type ReferenceBindingTargetType = 'scene' | 'shot';

export type ReferenceBindingDraft = {
  targetType: ReferenceBindingTargetType;
  targetId: string;
  referenceIds: string[];
  note: string;
  updatedAt: string;
};

export type ResolvedReferenceBinding = {
  targetType: ReferenceBindingTargetType | 'effective-shot';
  targetId: string;
  targetLabel: string;
  sceneId: string | null;
  referenceIds: string[];
  referenceTitles: string[];
  references: ReferenceInsight[];
  note: string;
  promptLine: string | null;
  sourceUrls: string[];
  localPaths: string[];
  sourceSummary: string;
};

export type ReferenceBindingSnapshot = {
  bindings: ResolvedReferenceBinding[];
  sceneBindings: ResolvedReferenceBinding[];
  shotBindings: ResolvedReferenceBinding[];
  sceneMap: Map<string, ResolvedReferenceBinding>;
  shotMap: Map<string, ResolvedReferenceBinding>;
  effectiveShotMap: Map<string, ResolvedReferenceBinding>;
  usageByReferenceId: Map<string, { scenes: string[]; shots: string[] }>;
  sceneBindingCount: number;
  shotBindingCount: number;
  effectiveShotBindingCount: number;
};

function normalizeText(value: string | null | undefined) {
  return String(value || '').trim();
}

function pickLine(lines: string[], label: string) {
  const line = lines.find((item) => item.startsWith(`${label}：`) || item.startsWith(`${label}:`));
  if (!line) return '';
  return line.replace(`${label}：`, '').replace(`${label}:`, '').trim();
}

function uniqueValues(values: string[]) {
  return Array.from(new Set(values.map((item) => normalizeText(item)).filter(Boolean)));
}

function summarizeValues(values: string[], fallback: string, max = 3) {
  const unique = uniqueValues(values);
  return unique.length > 0 ? unique.slice(0, max).join(' / ') : fallback;
}

function summarizeNotes(values: string[], fallback: string, max = 2) {
  const unique = uniqueValues(values);
  return unique.length > 0 ? unique.slice(0, max).join(' / ') : fallback;
}

function summarizeHighlights(insights: ReferenceInsight[]) {
  return insights.slice(0, 3).map((item) => {
    const title = item.title || '未命名参考';
    const framing = item.framing || '构图待补';
    const emotion = item.emotion || '情绪待补';
    return `${title}｜${framing}｜${emotion}`;
  });
}

export function parseReferenceAnalysisNotes(notes: string | null | undefined): ReferenceNoteDraft {
  const raw = normalizeText(notes);
  const lines = raw.split(/\n+/).map((item) => item.trim()).filter(Boolean);
  const title = pickLine(lines, '标题') || '未命名参考';
  const framing = pickLine(lines, '景别/构图') || '近景与特写结合，主体始终明确';
  const emotion = pickLine(lines, '情绪') || '情绪逐步压紧，带一点悬而未决';
  const movement = pickLine(lines, '动作/节奏') || '动作克制，节奏渐进，保留停顿';
  const notesLine = pickLine(lines, '补充说明');
  const extraLines = lines.filter((line) => !['标题：', '标题:', '景别/构图：', '景别/构图:', '情绪：', '情绪:', '动作/节奏：', '动作/节奏:', '补充说明：', '补充说明:'].some((prefix) => line.startsWith(prefix)));
  const mergedNotes = [notesLine, ...extraLines].filter(Boolean).join(' / ');

  return {
    title,
    framing,
    emotion,
    movement,
    notes: mergedNotes || '暂无额外补充说明。',
  };
}

function buildReferenceProfileFromInsights(insights: ReferenceInsight[]): ReferenceProfile {
  const titles = uniqueValues(insights.map((item) => item.title));
  const framing = summarizeValues(insights.map((item) => item.framing), '近景与特写结合，主体始终明确');
  const emotion = summarizeValues(insights.map((item) => item.emotion), '情绪逐步压紧，带一点悬而未决');
  const movement = summarizeValues(insights.map((item) => item.movement), '动作克制，节奏渐进，保留停顿');
  const noteSummary = summarizeNotes(insights.map((item) => item.notes), '暂无额外补充说明。');
  const titleSummary = titles.length > 0 ? titles.slice(0, 3).join(' / ') : '暂无参考标题';
  const highlights = summarizeHighlights(insights);
  const sourceUrls = uniqueValues(insights.map((item) => item.sourceUrl || ''));
  const localPaths = uniqueValues(insights.map((item) => item.localPath || ''));
  const sourceSummary = summarizeValues([...sourceUrls, ...localPaths], '当前主要靠结构化参考笔记驱动', 4);

  return {
    total: insights.length,
    imageCount: insights.filter((item) => item.sourceType === 'image').length,
    videoCount: insights.filter((item) => item.sourceType === 'video').length,
    titles,
    titleSummary,
    sourceUrls,
    localPaths,
    sourceSummary,
    hasSourceMedia: sourceUrls.length > 0 || localPaths.length > 0,
    framing,
    emotion,
    movement,
    noteSummary,
    highlights,
    promptLine: `参考标题：${titleSummary}｜构图：${framing}｜情绪：${emotion}｜节奏：${movement}`,
  };
}

export function buildReferenceProfileFromNotes(referenceNotes: string[]) {
  const insights = referenceNotes
    .map((notes, index) => {
      const parsed = parseReferenceAnalysisNotes(notes);
      return {
        id: `note-${index + 1}`,
        sourceType: 'image' as const,
        rawNotes: notes,
        sourceUrl: null,
        localPath: null,
        createdAt: null,
        ...parsed,
      } satisfies ReferenceInsight;
    });

  return buildReferenceProfileFromInsights(insights);
}

export function getReferenceInsights(
  references: Array<{
    id: string;
    type: string;
    notes: string | null;
    sourceUrl?: string | null;
    localPath?: string | null;
    createdAt?: Date | string | null;
  }>,
) {
  return references.map((item, index) => {
    const parsed = parseReferenceAnalysisNotes(item.notes);
    return {
      id: item.id,
      sourceType: item.type === 'video' ? 'video' : 'image',
      rawNotes: normalizeText(item.notes),
      sourceUrl: item.sourceUrl || null,
      localPath: item.localPath || null,
      createdAt: item.createdAt ? new Date(item.createdAt).toISOString() : null,
      ...parsed,
      title: parsed.title || `参考 ${index + 1}`,
    } satisfies ReferenceInsight;
  });
}

export function buildReferenceProfile(
  references: Array<{
    id: string;
    type: string;
    notes: string | null;
    sourceUrl?: string | null;
    localPath?: string | null;
    createdAt?: Date | string | null;
  }>,
) {
  return buildReferenceProfileFromInsights(getReferenceInsights(references));
}

export function parseReferenceBindings(content: string | null | undefined) {
  if (!content?.trim()) return [] as ReferenceBindingDraft[];

  try {
    const parsed = JSON.parse(content) as { bindings?: Partial<ReferenceBindingDraft>[] } | Partial<ReferenceBindingDraft>[];
    const items = Array.isArray(parsed) ? parsed : parsed.bindings || [];
    const normalized = items
      .map((item) => ({
        targetType: (item.targetType === 'scene' ? 'scene' : 'shot') as ReferenceBindingTargetType,
        targetId: normalizeText(item.targetId),
        referenceIds: uniqueValues(Array.isArray(item.referenceIds) ? item.referenceIds.map((referenceId) => String(referenceId)) : []),
        note: normalizeText(item.note),
        updatedAt: normalizeText(item.updatedAt) || new Date(0).toISOString(),
      }))
      .filter((item) => item.targetId);

    const unique = new Map<string, ReferenceBindingDraft>();
    for (const item of normalized) {
      unique.set(`${item.targetType}:${item.targetId}`, item);
    }

    return Array.from(unique.values());
  } catch {
    return [] as ReferenceBindingDraft[];
  }
}

export function serializeReferenceBindings(bindings: ReferenceBindingDraft[]) {
  return JSON.stringify({ version: 1, bindings }, null, 2);
}

function buildResolvedBinding(input: {
  targetType: ReferenceBindingTargetType | 'effective-shot';
  targetId: string;
  targetLabel: string;
  sceneId?: string | null;
  references: ReferenceInsight[];
  note?: string | null;
}) {
  const referenceIds = uniqueValues(input.references.map((item) => item.id));
  const referenceTitles = uniqueValues(input.references.map((item) => item.title));
  const profile = input.references.length > 0 ? buildReferenceProfileFromInsights(input.references) : null;

  return {
    targetType: input.targetType,
    targetId: input.targetId,
    targetLabel: input.targetLabel,
    sceneId: input.sceneId || null,
    referenceIds,
    referenceTitles,
    references: input.references,
    note: normalizeText(input.note),
    promptLine: profile?.promptLine || null,
    sourceUrls: profile?.sourceUrls || [],
    localPaths: profile?.localPaths || [],
    sourceSummary: profile?.sourceSummary || '当前主要靠结构化参考笔记驱动',
  } satisfies ResolvedReferenceBinding;
}

export function buildReferenceBindingSnapshot(project: {
  references: Array<{
    id: string;
    type: string;
    notes: string | null;
    sourceUrl?: string | null;
    localPath?: string | null;
    createdAt?: Date | string | null;
  }>;
  outlines?: Array<{ title: string; summary: string }>;
  scenes?: Array<{ id: string; title: string }>;
  shots?: Array<{ id: string; title: string; sceneId?: string | null }>;
}) {
  const insights = getReferenceInsights(project.references);
  const insightMap = new Map(insights.map((item) => [item.id, item]));
  const bindingOutline = getLatestOutlineByTitle(project.outlines || [], REFERENCE_BINDINGS_TITLE);
  const bindingDrafts = parseReferenceBindings(bindingOutline?.summary || '');
  const sceneTitleMap = new Map((project.scenes || []).map((scene) => [scene.id, scene.title]));
  const shotMetaMap = new Map((project.shots || []).map((shot) => [shot.id, {
    title: shot.title,
    sceneId: shot.sceneId || null,
    sceneTitle: shot.sceneId ? sceneTitleMap.get(shot.sceneId) || '未分场' : '未分场',
  }]));

  const sceneBindings = bindingDrafts
    .filter((item) => item.targetType === 'scene')
    .map((item) => {
      const references = item.referenceIds.map((referenceId) => insightMap.get(referenceId)).filter(Boolean) as ReferenceInsight[];
      if (references.length === 0) return null;
      return buildResolvedBinding({
        targetType: 'scene',
        targetId: item.targetId,
        targetLabel: sceneTitleMap.get(item.targetId) || '未命名分场',
        sceneId: item.targetId,
        references,
        note: item.note,
      });
    })
    .filter(Boolean) as ResolvedReferenceBinding[];

  const shotBindings = bindingDrafts
    .filter((item) => item.targetType === 'shot')
    .map((item) => {
      const references = item.referenceIds.map((referenceId) => insightMap.get(referenceId)).filter(Boolean) as ReferenceInsight[];
      if (references.length === 0) return null;
      const shotMeta = shotMetaMap.get(item.targetId);
      return buildResolvedBinding({
        targetType: 'shot',
        targetId: item.targetId,
        targetLabel: shotMeta?.title || '未命名镜头',
        sceneId: shotMeta?.sceneId || null,
        references,
        note: item.note,
      });
    })
    .filter(Boolean) as ResolvedReferenceBinding[];

  const sceneMap = new Map(sceneBindings.map((item) => [item.targetId, item]));
  const shotMap = new Map(shotBindings.map((item) => [item.targetId, item]));
  const effectiveShotMap = new Map<string, ResolvedReferenceBinding>();

  for (const [shotId, shotMeta] of shotMetaMap.entries()) {
    const sceneBinding = shotMeta.sceneId ? sceneMap.get(shotMeta.sceneId) || null : null;
    const shotBinding = shotMap.get(shotId) || null;
    const references = uniqueValues([
      ...(sceneBinding?.references || []).map((item) => item.id),
      ...(shotBinding?.references || []).map((item) => item.id),
    ])
      .map((referenceId) => insightMap.get(referenceId))
      .filter(Boolean) as ReferenceInsight[];

    if (references.length === 0) continue;

    effectiveShotMap.set(shotId, buildResolvedBinding({
      targetType: 'effective-shot',
      targetId: shotId,
      targetLabel: shotMeta.title,
      sceneId: shotMeta.sceneId,
      references,
      note: [sceneBinding?.note, shotBinding?.note].filter(Boolean).join(' / '),
    }));
  }

  const usageSceneMap = new Map<string, Set<string>>();
  const usageShotMap = new Map<string, Set<string>>();
  for (const binding of sceneBindings) {
    for (const referenceId of binding.referenceIds) {
      const current = usageSceneMap.get(referenceId) || new Set<string>();
      current.add(binding.targetLabel);
      usageSceneMap.set(referenceId, current);
    }
  }
  for (const binding of shotBindings) {
    for (const referenceId of binding.referenceIds) {
      const current = usageShotMap.get(referenceId) || new Set<string>();
      current.add(binding.targetLabel);
      usageShotMap.set(referenceId, current);
    }
  }

  const usageByReferenceId = new Map<string, { scenes: string[]; shots: string[] }>();
  for (const insight of insights) {
    usageByReferenceId.set(insight.id, {
      scenes: Array.from(usageSceneMap.get(insight.id) || []),
      shots: Array.from(usageShotMap.get(insight.id) || []),
    });
  }

  return {
    bindings: [...sceneBindings, ...shotBindings],
    sceneBindings,
    shotBindings,
    sceneMap,
    shotMap,
    effectiveShotMap,
    usageByReferenceId,
    sceneBindingCount: sceneBindings.length,
    shotBindingCount: shotBindings.length,
    effectiveShotBindingCount: effectiveShotMap.size,
  } satisfies ReferenceBindingSnapshot;
}

const referenceProjectInclude = {
  references: { orderBy: { createdAt: 'desc' } },
  scenes: { orderBy: { orderIndex: 'asc' } },
  shots: { orderBy: [{ sceneId: 'asc' }, { orderIndex: 'asc' }] },
  outlines: { orderBy: { createdAt: 'desc' } },
} satisfies Prisma.ProjectInclude;

export type ReferenceProject = Prisma.ProjectGetPayload<{
  include: typeof referenceProjectInclude;
}>;

export async function getReferenceProject(projectId?: string): Promise<ReferenceProject | null> {
  return projectId
    ? prisma.project.findUnique({
        where: { id: projectId },
        include: referenceProjectInclude,
      })
    : prisma.project.findFirst({
        orderBy: { updatedAt: 'desc' },
        include: referenceProjectInclude,
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
  sourceUrl?: string | null;
  localPath?: string | null;
}) {
  const analysis = [
    `标题：${normalizeText(input.title) || '未命名参考'}`,
    `景别/构图：${normalizeText(input.framing) || '近景与特写结合，主体始终明确'}`,
    `情绪：${normalizeText(input.emotion) || '情绪逐步压紧，带一点悬而未决'}`,
    `动作/节奏：${normalizeText(input.movement) || '动作克制，节奏渐进，保留停顿'}`,
    `补充说明：${normalizeText(input.notes) || '暂无额外补充说明。'}`,
  ].join('\n');

  await prisma.referenceAsset.create({
    data: {
      projectId: input.projectId,
      type: input.sourceType,
      notes: analysis,
      sourceUrl: normalizeText(input.sourceUrl) || null,
      localPath: normalizeText(input.localPath) || null,
    },
  });

  return getReferenceProject(input.projectId);
}

export async function saveReferenceBinding(input: {
  projectId: string;
  targetType: ReferenceBindingTargetType;
  targetId: string;
  referenceIds: string[];
  note?: string | null;
}) {
  const project = await prisma.project.findUnique({
    where: { id: input.projectId },
    include: {
      references: { orderBy: { createdAt: 'desc' } },
      scenes: { orderBy: { orderIndex: 'asc' } },
      shots: { orderBy: [{ sceneId: 'asc' }, { orderIndex: 'asc' }] },
      outlines: { orderBy: { createdAt: 'desc' } },
    },
  });

  if (!project) throw new Error('项目不存在');

  const targetId = normalizeText(input.targetId);
  if (!targetId) throw new Error('缺少绑定目标');

  const targetExists = input.targetType === 'scene'
    ? project.scenes.some((scene) => scene.id === targetId)
    : project.shots.some((shot) => shot.id === targetId);
  if (!targetExists) throw new Error('绑定目标不存在');

  const validReferenceIds = uniqueValues(input.referenceIds || []).filter((referenceId) => project.references.some((reference) => reference.id === referenceId));
  const currentBindings = parseReferenceBindings(getLatestOutlineByTitle(project.outlines, REFERENCE_BINDINGS_TITLE)?.summary || '');
  const nextBindings = currentBindings.filter((item) => !(item.targetType === input.targetType && item.targetId === targetId));

  if (validReferenceIds.length > 0) {
    nextBindings.push({
      targetType: input.targetType,
      targetId,
      referenceIds: validReferenceIds,
      note: normalizeText(input.note),
      updatedAt: new Date().toISOString(),
    });
  }

  await createOutlineVersion(project.id, REFERENCE_BINDINGS_TITLE, serializeReferenceBindings(nextBindings));
  return getReferenceProject(project.id);
}

import { prisma } from '@/lib/prisma';

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

export async function getReferenceProject(projectId?: string) {
  const include = {
    references: { orderBy: { createdAt: 'desc' } },
  } as const;

  return projectId
    ? prisma.project.findUnique({
        where: { id: projectId },
        include,
      })
    : prisma.project.findFirst({
        orderBy: { updatedAt: 'desc' },
        include,
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

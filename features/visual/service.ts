import { prisma } from '@/lib/prisma';
import { getStoryDraftBundle } from '@/features/story/service';
import { getCharacterDraftBundle } from '@/features/characters/service';
import { generateText } from '@/lib/llm';
import { createOutlineVersion, getLatestOutlineByTitle } from '@/lib/outline-store';

export const VISUAL_LOCK_FIELDS = ['palette', 'lighting', 'lensLanguage', 'motionLanguage'] as const;

export type VisualLockField = (typeof VISUAL_LOCK_FIELDS)[number];

export type VisualLocks = Record<VisualLockField, boolean>;

export type VisualBibleDraft = {
  styleName: string;
  visualTone: string;
  palette: string;
  lighting: string;
  lensLanguage: string;
  motionLanguage: string;
  textureKeywords: string;
  sceneDesign: string;
  locks: VisualLocks;
};

const DEFAULT_VISUAL_LOCKS: VisualLocks = {
  palette: false,
  lighting: false,
  lensLanguage: false,
  motionLanguage: false,
};

function normalizeVisualLocks(locks?: Partial<VisualLocks> | null): VisualLocks {
  return {
    ...DEFAULT_VISUAL_LOCKS,
    ...(locks || {}),
  };
}

function buildVisualBibleFallback(input: {
  project: { title: string; premise: string | null; genre: string | null; description: string | null };
}): VisualBibleDraft {
  const genre = input.project.genre || '剧情';
  const description = input.project.description || '电影感、强冲突';

  return {
    styleName: `${genre}电影感写实风格`,
    visualTone: `整体气质强调${description}，画面保持叙事压迫感与人物情绪贴脸观察。`,
    palette: '冷灰、铁锈红、低饱和青蓝作为主色，关键异象时允许白光或高对比色突然刺入。',
    lighting: '以低照度、方向性硬光和局部补光为主，重要异象节点允许极端白光或反常光源主导画面。',
    lensLanguage: '以近景、特写和带环境关系的中近景为主，强调人物被空间压住的感觉。',
    motionLanguage: '镜头运动整体克制，优先缓推、轻微跟随和停顿观察，关键节点再突然加速或失衡。',
    textureKeywords: '金属、灰尘、潮气、旧装置、磨损表面、压抑空气、异响感',
    sceneDesign: '空间设计强调功能性遗迹、年代痕迹与系统性压迫，避免过于空泛的奇观堆砌。',
    locks: normalizeVisualLocks(),
  };
}

function extractJsonBlock(text: string) {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i)?.[1];
  if (fenced) return fenced.trim();
  const objectLike = text.match(/\{[\s\S]*\}/)?.[0];
  return objectLike?.trim() || text.trim();
}

function sanitizeVisualBibleDraft(item: unknown): VisualBibleDraft | null {
  if (!item || typeof item !== 'object') return null;
  const record = item as Record<string, unknown>;
  const draft = {
    styleName: String(record.styleName || '').trim(),
    visualTone: String(record.visualTone || '').trim(),
    palette: String(record.palette || '').trim(),
    lighting: String(record.lighting || '').trim(),
    lensLanguage: String(record.lensLanguage || '').trim(),
    motionLanguage: String(record.motionLanguage || '').trim(),
    textureKeywords: String(record.textureKeywords || '').trim(),
    sceneDesign: String(record.sceneDesign || '').trim(),
    locks: normalizeVisualLocks(),
  } satisfies VisualBibleDraft;

  if (!draft.styleName || !draft.visualTone) return null;
  return draft;
}

async function generateVisualBibleWithLlm(input: {
  project: { title: string; premise: string | null; genre: string | null; description: string | null };
  synopsis: string;
  characterSummary: string;
  referenceSummary: string;
}) {
  const result = await generateText({
    systemPrompt: '你是影视美术与摄影风格设计助手。请输出一个 JSON 对象，字段必须使用英文键名：styleName, visualTone, palette, lighting, lensLanguage, motionLanguage, textureKeywords, sceneDesign。值全部用中文。不要输出额外解释。',
    userPrompt: `项目名：${input.project.title}\n故事前提：${input.project.premise || '暂无'}\n题材：${input.project.genre || '未设定'}\n风格备注：${input.project.description || '暂无'}\n故事梗概：${input.synopsis}\n角色摘要：${input.characterSummary || '暂无'}\n参考摘要：${input.referenceSummary || '暂无'}`,
    temperature: 0.6,
  });

  if (!result) return null;
  try {
    const parsed = JSON.parse(extractJsonBlock(result));
    return sanitizeVisualBibleDraft(parsed);
  } catch {
    return null;
  }
}

function serializeVisualBibleDraft(draft: VisualBibleDraft) {
  const locks = normalizeVisualLocks(draft.locks);
  return [
    '# Visual Bible',
    `StyleName: ${draft.styleName}`,
    `VisualTone: ${draft.visualTone}`,
    `Palette: ${draft.palette}`,
    `Lighting: ${draft.lighting}`,
    `LensLanguage: ${draft.lensLanguage}`,
    `MotionLanguage: ${draft.motionLanguage}`,
    `TextureKeywords: ${draft.textureKeywords}`,
    `SceneDesign: ${draft.sceneDesign}`,
    `LockedPalette: ${String(locks.palette)}`,
    `LockedLighting: ${String(locks.lighting)}`,
    `LockedLensLanguage: ${String(locks.lensLanguage)}`,
    `LockedMotionLanguage: ${String(locks.motionLanguage)}`,
  ].join('\n');
}

export function parseVisualBibleDraft(content: string): VisualBibleDraft | null {
  const lines = content.split(/\n+/).map((item) => item.trim()).filter(Boolean);
  if (lines.length === 0) return null;

  const draft: VisualBibleDraft = {
    styleName: lines.find((line) => line.startsWith('StyleName:'))?.replace('StyleName:', '').trim() || '',
    visualTone: lines.find((line) => line.startsWith('VisualTone:'))?.replace('VisualTone:', '').trim() || '',
    palette: lines.find((line) => line.startsWith('Palette:'))?.replace('Palette:', '').trim() || '',
    lighting: lines.find((line) => line.startsWith('Lighting:'))?.replace('Lighting:', '').trim() || '',
    lensLanguage: lines.find((line) => line.startsWith('LensLanguage:'))?.replace('LensLanguage:', '').trim() || '',
    motionLanguage: lines.find((line) => line.startsWith('MotionLanguage:'))?.replace('MotionLanguage:', '').trim() || '',
    textureKeywords: lines.find((line) => line.startsWith('TextureKeywords:'))?.replace('TextureKeywords:', '').trim() || '',
    sceneDesign: lines.find((line) => line.startsWith('SceneDesign:'))?.replace('SceneDesign:', '').trim() || '',
    locks: normalizeVisualLocks({
      palette: lines.find((line) => line.startsWith('LockedPalette:'))?.replace('LockedPalette:', '').trim() === 'true',
      lighting: lines.find((line) => line.startsWith('LockedLighting:'))?.replace('LockedLighting:', '').trim() === 'true',
      lensLanguage: lines.find((line) => line.startsWith('LockedLensLanguage:'))?.replace('LockedLensLanguage:', '').trim() === 'true',
      motionLanguage: lines.find((line) => line.startsWith('LockedMotionLanguage:'))?.replace('LockedMotionLanguage:', '').trim() === 'true',
    }),
  };

  return draft.styleName ? draft : null;
}

function mergeVisualBibleDraft(
  existing: VisualBibleDraft | null,
  generated: VisualBibleDraft,
  focus: VisualLockField | 'all' = 'all',
): VisualBibleDraft {
  if (!existing) {
    return {
      ...generated,
      locks: normalizeVisualLocks(generated.locks),
    };
  }

  const locks = normalizeVisualLocks(existing.locks);
  const merged: VisualBibleDraft = {
    ...existing,
    locks,
  };

  const keys: Array<keyof Omit<VisualBibleDraft, 'locks'>> = [
    'styleName',
    'visualTone',
    'palette',
    'lighting',
    'lensLanguage',
    'motionLanguage',
    'textureKeywords',
    'sceneDesign',
  ];

  for (const key of keys) {
    const isLocked = key in locks ? locks[key as VisualLockField] : false;
    const shouldUpdate = focus === 'all' || focus === key || !existing[key];

    if (isLocked) {
      merged[key] = existing[key];
      continue;
    }

    if (shouldUpdate) {
      merged[key] = generated[key];
    }
  }

  return merged;
}

async function upsertVisualBibleOutline(projectId: string, summary: string) {
  return createOutlineVersion(projectId, 'Visual Bible', summary);
}

export async function getLatestVisualProject() {
  return prisma.project.findFirst({
    orderBy: { updatedAt: 'desc' },
    include: {
      ideaSeeds: { orderBy: { createdAt: 'desc' }, take: 1 },
      outlines: { orderBy: { createdAt: 'desc' } },
      chapters: { orderBy: { orderIndex: 'asc' } },
      references: { orderBy: { createdAt: 'desc' } },
    },
  });
}

export async function generateVisualBible(projectId: string, options?: { focus?: VisualLockField | 'all' }) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      ideaSeeds: { orderBy: { createdAt: 'desc' }, take: 1 },
      outlines: { orderBy: { createdAt: 'desc' } },
      chapters: { orderBy: { orderIndex: 'asc' } },
      references: { orderBy: { createdAt: 'desc' } },
    },
  });

  if (!project) throw new Error('项目不存在');

  const storyDraft = getStoryDraftBundle(project);
  const characterDrafts = getCharacterDraftBundle(project);
  const currentDraft = getVisualBibleBundle(project);
  const characterSummary = characterDrafts.map((item) => `${item.name} / ${item.role} / ${item.archetype}`).join('；');
  const referenceSummary = project.references.map((item) => item.notes || '').filter(Boolean).join('\n');

  const fallbackDraft = buildVisualBibleFallback({
    project: {
      title: project.title,
      premise: project.premise,
      genre: project.genre,
      description: project.description,
    },
  });

  const llmDraft = await generateVisualBibleWithLlm({
    project: {
      title: project.title,
      premise: project.premise,
      genre: project.genre,
      description: project.description,
    },
    synopsis: storyDraft.synopsis,
    characterSummary,
    referenceSummary,
  }).catch(() => null);

  const generatedDraft = llmDraft || fallbackDraft;
  const draft = mergeVisualBibleDraft(currentDraft, generatedDraft, options?.focus || 'all');
  await upsertVisualBibleOutline(project.id, serializeVisualBibleDraft(draft));

  return prisma.project.findUnique({
    where: { id: project.id },
    include: {
      ideaSeeds: { orderBy: { createdAt: 'desc' }, take: 1 },
      outlines: { orderBy: { createdAt: 'desc' } },
      chapters: { orderBy: { orderIndex: 'asc' } },
      references: { orderBy: { createdAt: 'desc' } },
    },
  });
}

export async function saveVisualBible(projectId: string, draft: VisualBibleDraft) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      outlines: { orderBy: { createdAt: 'desc' } },
    },
  });

  if (!project) throw new Error('项目不存在');

  const cleaned: VisualBibleDraft = {
    styleName: String(draft.styleName || '').trim() || '待补充风格名',
    visualTone: String(draft.visualTone || '').trim() || '待补充整体气质',
    palette: String(draft.palette || '').trim() || '待补充色彩策略',
    lighting: String(draft.lighting || '').trim() || '待补充光线策略',
    lensLanguage: String(draft.lensLanguage || '').trim() || '待补充镜头语言',
    motionLanguage: String(draft.motionLanguage || '').trim() || '待补充运动语言',
    textureKeywords: String(draft.textureKeywords || '').trim() || '待补充材质关键词',
    sceneDesign: String(draft.sceneDesign || '').trim() || '待补充空间设计',
    locks: normalizeVisualLocks(draft.locks),
  };

  await upsertVisualBibleOutline(projectId, serializeVisualBibleDraft(cleaned));

  return prisma.project.findUnique({
    where: { id: projectId },
    include: {
      ideaSeeds: { orderBy: { createdAt: 'desc' }, take: 1 },
      outlines: { orderBy: { createdAt: 'desc' } },
      chapters: { orderBy: { orderIndex: 'asc' } },
      references: { orderBy: { createdAt: 'desc' } },
    },
  });
}

export function getVisualBibleBundle(project: { outlines: Array<{ title: string; summary: string }> }) {
  const outline = getLatestOutlineByTitle(project.outlines, 'Visual Bible');
  return parseVisualBibleDraft(outline?.summary || '');
}

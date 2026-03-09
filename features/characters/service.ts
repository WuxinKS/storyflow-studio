import { prisma } from '@/lib/prisma';
import { getStoryDraftBundle, type StorySceneSeed } from '@/features/story/service';
import { generateText } from '@/lib/llm';
import { createOutlineVersion, getLatestOutlineByTitle } from '@/lib/outline-store';

export const CHARACTER_LOCK_FIELDS = ['name', 'role', 'archetype', 'goal', 'conflict'] as const;

export type CharacterLockField = (typeof CHARACTER_LOCK_FIELDS)[number];

export type CharacterLocks = Record<CharacterLockField, boolean>;

export type CharacterDraft = {
  name: string;
  role: string;
  archetype: string;
  goal: string;
  conflict: string;
  voiceStyle: string;
  visualAnchor: string;
  locks: CharacterLocks;
};

const DEFAULT_CHARACTER_LOCKS: CharacterLocks = {
  name: false,
  role: false,
  archetype: false,
  goal: false,
  conflict: false,
};

function normalizeText(text: string | null | undefined) {
  return (text || '').replace(/\s+/g, ' ').trim();
}

function normalizeCharacterLocks(locks?: Partial<CharacterLocks> | null): CharacterLocks {
  return {
    ...DEFAULT_CHARACTER_LOCKS,
    ...(locks || {}),
  };
}

function cleanCandidateName(name: string) {
  return name
    .replace(/^(叫|名叫|名字叫|主人公|主角)/, '')
    .replace(/(的男生|的女生|的人|的少年|的少女|男生|女生|少年|少女|的人物|角色)$/, '')
    .replace(/[，。！？、；：,.!?:;]+$/g, '')
    .trim();
}

function isValidPersonName(name: string) {
  if (!name) return false;
  if (name.length < 1 || name.length > 6) return false;
  if (/^(一个|一名|主角|主人公|男生|女生|少年|少女|学生|警察|医生|记者|司机|工人|维修工)$/.test(name)) return false;
  if (/[穿越来到进入发现开始正在为了由于因为如果然后]/.test(name)) return false;
  return true;
}

function pickNameFromText(text: string) {
  const normalized = normalizeText(text);
  if (!normalized) return null;

  const patterns: RegExp[] = [
    /(?:一个|一名)(?:叫|名叫|名字叫)([\u4e00-\u9fa5A-Za-z]{1,6})(?:的)?(?:男生|女生|人|少年|少女|学生|警察|医生|记者|司机|工人|维修工)/,
    /(?:一个|一名)叫([\u4e00-\u9fa5A-Za-z]{1,6})的(?:男生|女生|人|少年|少女|学生|警察|医生|记者|司机|工人|维修工)/,
    /(?:主角|主人公)(?:是|为|叫|名叫)?\s*([\u4e00-\u9fa5A-Za-z]{1,6})/,
    /叫([\u4e00-\u9fa5A-Za-z]{1,6})的(?:男生|女生|人|少年|少女|维修工|工人|学生|警察|医生|记者|司机)/,
    /([\u4e00-\u9fa5A-Za-z]{2,4})在.*?(?:穿越|误入|闯入|来到|进入)/,
    /([\u4e00-\u9fa5A-Za-z]{2,4})一边.*?(?:用|拿|举|看|说|直播)/,
  ];

  for (const pattern of patterns) {
    const matched = normalized.match(pattern)?.[1];
    if (!matched) continue;
    const cleaned = cleanCandidateName(matched);
    if (isValidPersonName(cleaned)) return cleaned;
  }

  return null;
}

function inferProtagonistName(project: { premise: string | null; title: string }, scenes: StorySceneSeed[]) {
  const premise = normalizeText(project.premise);
  const sceneText = scenes.map((scene) => `${scene.title} ${scene.summary}`).join(' ');

  const fromPremise = pickNameFromText(premise);
  if (fromPremise) return fromPremise;

  const fromScenes = pickNameFromText(sceneText);
  if (fromScenes) return fromScenes;

  const nounPatterns = [
    [/维修工/, '维修工'],
    [/记者/, '记者'],
    [/警察/, '警察'],
    [/医生/, '医生'],
    [/学生/, '学生'],
    [/男生/, '男生'],
    [/女生/, '女生'],
    [/司机/, '司机'],
  ] as const;

  for (const [pattern, label] of nounPatterns) {
    if (pattern.test(premise) || pattern.test(sceneText)) return label;
  }

  return '主角';
}

function buildCharacterDrafts(input: {
  project: { title: string; premise: string | null; genre: string | null; description: string | null };
  scenes: StorySceneSeed[];
}): CharacterDraft[] {
  const protagonistName = inferProtagonistName(input.project, input.scenes);
  const firstScene = input.scenes[0];
  const conflictScene = input.scenes[3] || input.scenes[1] || input.scenes[0];
  const finalScene = input.scenes[input.scenes.length - 1] || input.scenes[0];
  const genre = input.project.genre || '剧情';
  const style = input.project.description || '电影感、强冲突';

  return [
    {
      name: protagonistName,
      role: 'protagonist',
      archetype: `被卷入异常事件的核心视角人物（${genre}）`,
      goal: firstScene?.goal || '弄清楚异常究竟意味着什么',
      conflict: finalScene?.conflict || '越接近答案，越必须承担代价',
      voiceStyle: '克制、敏感、先压着不说，逼到边缘才开口',
      visualAnchor: `长期处于高压环境，外形应保留疲惫感、警觉感与${style}质地`,
      locks: normalizeCharacterLocks(),
    },
    {
      name: '关键对手',
      role: 'antagonist',
      archetype: '掌握关键信息、控制进入门槛的人物',
      goal: '延缓真相暴露，维持现有秩序或既得利益',
      conflict: conflictScene?.conflict || '既想控制局面，又无法彻底消除异常后果',
      voiceStyle: '说话简短、带判断感，习惯保留信息',
      visualAnchor: '外形应更稳定、整洁、有控制欲，与主角形成明显气场反差',
      locks: normalizeCharacterLocks(),
    },
    {
      name: '关系人物',
      role: 'support',
      archetype: '在协作、阻拦与情感拉扯之间摇摆的关键配角',
      goal: '在保护主角、保护自己或保护系统之间寻找平衡',
      conflict: '立场并不纯粹，越靠近核心越可能被迫选边站',
      voiceStyle: '更有人情味，但会在关键处停顿、犹豫、回避',
      visualAnchor: '气质更柔和一些，但仍被同一高压系统塑形，不能显得过于轻松',
      locks: normalizeCharacterLocks(),
    },
  ];
}

function serializeCharacterDrafts(characters: CharacterDraft[]) {
  return characters
    .map((character, index) => {
      const locks = normalizeCharacterLocks(character.locks);
      return [
        `# Character ${index + 1}: ${character.name}`,
        `Role: ${character.role}`,
        `Archetype: ${character.archetype}`,
        `Goal: ${character.goal}`,
        `Conflict: ${character.conflict}`,
        `VoiceStyle: ${character.voiceStyle}`,
        `VisualAnchor: ${character.visualAnchor}`,
        `LockedName: ${String(locks.name)}`,
        `LockedRole: ${String(locks.role)}`,
        `LockedArchetype: ${String(locks.archetype)}`,
        `LockedGoal: ${String(locks.goal)}`,
        `LockedConflict: ${String(locks.conflict)}`,
      ].join('\n');
    })
    .join('\n\n');
}

function extractJsonBlock(text: string) {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i)?.[1];
  if (fenced) return fenced.trim();
  const plain = text.match(/\[[\s\S]*\]/)?.[0];
  return plain?.trim() || text.trim();
}

function sanitizeCharacterDrafts(items: unknown): CharacterDraft[] {
  if (!Array.isArray(items)) return [];

  return items
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      return {
        name: String(record.name || '').trim(),
        role: String(record.role || '').trim(),
        archetype: String(record.archetype || '').trim(),
        goal: String(record.goal || '').trim(),
        conflict: String(record.conflict || '').trim(),
        voiceStyle: String(record.voiceStyle || '').trim(),
        visualAnchor: String(record.visualAnchor || '').trim(),
        locks: normalizeCharacterLocks(),
      } satisfies CharacterDraft;
    })
    .filter((item): item is CharacterDraft => Boolean(item?.name && item.role));
}

async function generateCharacterDraftsWithLlm(input: {
  project: { title: string; premise: string | null; genre: string | null; description: string | null };
  scenes: StorySceneSeed[];
}) {
  const sceneLines = input.scenes
    .map((scene, index) => `${index + 1}. ${scene.title}｜${scene.summary}｜目标：${scene.goal}｜冲突：${scene.conflict}`)
    .join('\n');

  const result = await generateText({
    systemPrompt: '你是影视角色设计助手。请从故事前提和分场信息中抽出最重要的 3 个角色，输出 JSON 数组。字段必须是英文键名：name, role, archetype, goal, conflict, voiceStyle, visualAnchor。role 只能取 protagonist / antagonist / support。不要输出额外解释。主角如果已有明确名字，必须直接使用人物名字本身，例如“阿佳”，不要输出“叫阿佳的”“某个男生”这种脏名字。',
    userPrompt: `项目名：${input.project.title}\n故事前提：${input.project.premise || '暂无'}\n题材：${input.project.genre || '未设定'}\n风格备注：${input.project.description || '暂无'}\n\n分场信息：\n${sceneLines}`,
    temperature: 0.5,
  });

  if (!result) return [];

  try {
    const parsed = JSON.parse(extractJsonBlock(result));
    const drafts = sanitizeCharacterDrafts(parsed);
    return drafts
      .map((item, index) => ({
        ...item,
        name: index === 0 ? cleanCandidateName(item.name) : item.name,
        locks: normalizeCharacterLocks(item.locks),
      }))
      .filter((item) => item.name);
  } catch {
    return [];
  }
}

export function parseCharacterDrafts(content: string): CharacterDraft[] {
  const blocks = content
    .split(/\n\s*\n/g)
    .map((item) => item.trim())
    .filter(Boolean);

  return blocks
    .map((block, index) => {
      const lines = block.split(/\n+/).map((item) => item.trim()).filter(Boolean);
      const name = lines[0]?.replace(/^#\s*Character\s*\d+\s*:\s*/i, '').trim() || `角色 ${index + 1}`;
      const role = lines.find((line) => line.startsWith('Role:'))?.replace('Role:', '').trim() || 'support';
      const archetype = lines.find((line) => line.startsWith('Archetype:'))?.replace('Archetype:', '').trim() || '';
      const goal = lines.find((line) => line.startsWith('Goal:'))?.replace('Goal:', '').trim() || '';
      const conflict = lines.find((line) => line.startsWith('Conflict:'))?.replace('Conflict:', '').trim() || '';
      const voiceStyle = lines.find((line) => line.startsWith('VoiceStyle:'))?.replace('VoiceStyle:', '').trim() || '';
      const visualAnchor = lines.find((line) => line.startsWith('VisualAnchor:'))?.replace('VisualAnchor:', '').trim() || '';
      const locks = normalizeCharacterLocks({
        name: lines.find((line) => line.startsWith('LockedName:'))?.replace('LockedName:', '').trim() === 'true',
        role: lines.find((line) => line.startsWith('LockedRole:'))?.replace('LockedRole:', '').trim() === 'true',
        archetype: lines.find((line) => line.startsWith('LockedArchetype:'))?.replace('LockedArchetype:', '').trim() === 'true',
        goal: lines.find((line) => line.startsWith('LockedGoal:'))?.replace('LockedGoal:', '').trim() === 'true',
        conflict: lines.find((line) => line.startsWith('LockedConflict:'))?.replace('LockedConflict:', '').trim() === 'true',
      });
      return { name, role, archetype, goal, conflict, voiceStyle, visualAnchor, locks };
    })
    .filter((item) => item.name);
}

function mergeCharacterDraft(existing: CharacterDraft, generated: CharacterDraft) {
  const locks = normalizeCharacterLocks(existing.locks);
  const merged: CharacterDraft = {
    ...generated,
    voiceStyle: generated.voiceStyle || existing.voiceStyle,
    visualAnchor: generated.visualAnchor || existing.visualAnchor,
    locks,
  };

  for (const field of CHARACTER_LOCK_FIELDS) {
    if (locks[field] && normalizeText(existing[field])) {
      merged[field] = existing[field];
    }
  }

  return merged;
}

function mergeCharacterDrafts(existing: CharacterDraft[], generated: CharacterDraft[], targetRole?: string) {
  if (existing.length === 0) {
    return generated.map((item) => ({ ...item, locks: normalizeCharacterLocks(item.locks) }));
  }

  const existingByRole = new Map(existing.map((item) => [item.role, item]));
  const generatedByRole = new Map(generated.map((item) => [item.role, item]));
  const orderedRoles = Array.from(new Set([
    ...generated.map((item) => item.role),
    ...existing.map((item) => item.role),
  ]));

  return orderedRoles
    .map((role, index) => {
      const existingItem = existingByRole.get(role) || existing[index] || null;
      const generatedItem = generatedByRole.get(role) || generated[index] || existingItem;

      if (!existingItem && !generatedItem) return null;
      if (!generatedItem) return existingItem;
      if (!existingItem) return { ...generatedItem, locks: normalizeCharacterLocks(generatedItem.locks) };
      if (targetRole && role !== targetRole) return { ...existingItem, locks: normalizeCharacterLocks(existingItem.locks) };
      return mergeCharacterDraft(existingItem, generatedItem);
    })
    .filter((item): item is CharacterDraft => Boolean(item));
}

async function upsertCharacterOutline(projectId: string, summary: string) {
  return createOutlineVersion(projectId, 'Character Drafts', summary);
}

export async function getLatestCharacterProject() {
  return prisma.project.findFirst({
    orderBy: { updatedAt: 'desc' },
    include: {
      ideaSeeds: { orderBy: { createdAt: 'desc' }, take: 1 },
      outlines: { orderBy: { createdAt: 'desc' } },
      chapters: { orderBy: { orderIndex: 'asc' } },
    },
  });
}

export async function generateCharacterDrafts(projectId: string, options?: { targetRole?: string }) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      ideaSeeds: { orderBy: { createdAt: 'desc' }, take: 1 },
      outlines: { orderBy: { createdAt: 'desc' } },
      chapters: { orderBy: { orderIndex: 'asc' } },
    },
  });

  if (!project) throw new Error('项目不存在');

  const storyDraft = getStoryDraftBundle(project);
  const existingCharacters = getCharacterDraftBundle(project);
  const fallbackCharacters = buildCharacterDrafts({
    project: {
      title: project.title,
      premise: project.premise,
      genre: project.genre,
      description: project.description,
    },
    scenes: storyDraft.scenes,
  });

  const llmCharacters = await generateCharacterDraftsWithLlm({
    project: {
      title: project.title,
      premise: project.premise,
      genre: project.genre,
      description: project.description,
    },
    scenes: storyDraft.scenes,
  }).catch(() => []);

  const generatedCharacters = llmCharacters.length > 0 ? llmCharacters : fallbackCharacters;
  const characters = mergeCharacterDrafts(existingCharacters, generatedCharacters, options?.targetRole);

  await upsertCharacterOutline(project.id, serializeCharacterDrafts(characters));

  return prisma.project.findUnique({
    where: { id: project.id },
    include: {
      ideaSeeds: { orderBy: { createdAt: 'desc' }, take: 1 },
      outlines: { orderBy: { createdAt: 'desc' } },
      chapters: { orderBy: { orderIndex: 'asc' } },
    },
  });
}

export async function saveCharacterDrafts(projectId: string, characters: CharacterDraft[]) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      outlines: { orderBy: { createdAt: 'desc' } },
    },
  });

  if (!project) throw new Error('项目不存在');
  if (!characters.length) throw new Error('缺少角色数据');

  const cleaned = characters.map((item, index) => ({
    name: cleanCandidateName(item.name) || `角色 ${index + 1}`,
    role: normalizeText(item.role) || 'support',
    archetype: normalizeText(item.archetype) || '待补充角色定位',
    goal: normalizeText(item.goal) || '待补充目标',
    conflict: normalizeText(item.conflict) || '待补充冲突',
    voiceStyle: normalizeText(item.voiceStyle) || '待补充说话方式',
    visualAnchor: normalizeText(item.visualAnchor) || '待补充视觉锚点',
    locks: normalizeCharacterLocks(item.locks),
  }));

  await upsertCharacterOutline(projectId, serializeCharacterDrafts(cleaned));

  return prisma.project.findUnique({
    where: { id: projectId },
    include: {
      ideaSeeds: { orderBy: { createdAt: 'desc' }, take: 1 },
      outlines: { orderBy: { createdAt: 'desc' } },
      chapters: { orderBy: { orderIndex: 'asc' } },
    },
  });
}

export function getCharacterDraftBundle(project: { outlines: Array<{ title: string; summary: string }> }) {
  const outline = getLatestOutlineByTitle(project.outlines, 'Character Drafts');
  return parseCharacterDrafts(outline?.summary || '');
}

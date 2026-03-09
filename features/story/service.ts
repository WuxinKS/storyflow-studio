import { prisma } from '@/lib/prisma';
import { generateText } from '@/lib/llm';
import { createOutlineVersion } from '@/lib/outline-store';

export type StorySceneSeed = {
  title: string;
  summary: string;
  goal: string;
  conflict: string;
  emotion: string;
};

export type StoryDraftBundle = {
  synopsis: string;
  beats: string[];
  scenes: StorySceneSeed[];
};

function normalizeText(text: string | null | undefined) {
  return (text || '').replace(/\s+/g, ' ').trim();
}

function clip(text: string, max = 32) {
  return text.length > max ? `${text.slice(0, max).trim()}…` : text;
}

function buildSynopsisFallback(input: {
  title: string;
  premise?: string | null;
  genre?: string | null;
  description?: string | null;
  ideaInput?: string | null;
}) {
  const premise = normalizeText(input.premise || input.ideaInput) || '一个普通人在异常世界中被迫做出改变命运的选择';
  const genre = normalizeText(input.genre) || '类型融合';
  const style = normalizeText(input.description) || '电影感、强冲突、适合影视改编';

  return `《${input.title}》是一部偏${genre}气质的影视项目。故事从“${premise}”出发，主角先在日常秩序中暴露出被压抑的处境，随后因为一个异常线索或意外事件被卷入更大的系统性危机。中段推进会持续放大人物的目标、代价与关系压力，让选择不再停留在口头层面，而必须落实为行动。整体表达上强调${style}，适合继续拆成分场、镜头与下游视听制作任务。`;
}

function buildBeatSheetFallback(input: {
  premise?: string | null;
  ideaInput?: string | null;
  genre?: string | null;
}) {
  const premise = normalizeText(input.premise || input.ideaInput) || '主角被异常事件拖离原本生活';
  const genre = normalizeText(input.genre) || '故事';

  return [
    `开场建立：在${genre}语境里先建立主角的生存处境，并让“${clip(premise, 28)}”作为潜伏问题出现。`,
    '诱发事件：一个异常信号、人物闯入或系统失控，迫使主角停止观望，必须开始确认问题。',
    '主动深入：主角带着局部目标进入更危险的空间或关系现场，逐步发现表面问题背后还有更大代价。',
    '关系加压：关键人物之间出现立场试探、隐瞒或冲突，让行动目标与情感目标发生扭结。',
    '中段反转：主角确认真正威胁，也意识到自己已经无法退回原本秩序。',
    '危机逼近：环境、系统或人物关系同时失控，逼迫主角在保全自己与承担后果之间做出选择。',
    '高潮决断：主角把前面累积的信息、情绪和行动集中到一次不可逆的出手。',
    '尾声落点：结果留下余震，既回应最初问题，也为角色命运和世界状态留出后续空间。',
  ];
}

function buildSceneSeedsFallback(input: {
  premise?: string | null;
  ideaInput?: string | null;
}): StorySceneSeed[] {
  const premise = normalizeText(input.premise || input.ideaInput) || '主角在异常世界里发现改变命运的机会';

  return [
    {
      title: '日常高压',
      summary: `主角先在高压而重复的日常环境里工作或生存，场域规则被建立，同时暗示“${clip(premise, 30)}”并不是空穴来风。`,
      goal: '建立主角处境与空间规则',
      conflict: '主角想维持秩序，但环境已经显出不稳定前兆',
      emotion: '压抑、克制、隐约不安',
    },
    {
      title: '异常显现',
      summary: '一次微小但不合常理的异常信号出现，主角最初试图忽略，却被迫停下手头工作重新确认现场。',
      goal: '让主角首次正视异常',
      conflict: '继续忽略更安全，但确认异常会把人拖入风险',
      emotion: '迟疑、不信、逐渐紧绷',
    },
    {
      title: '深入现场',
      summary: '主角沿着异常线索继续深入，环境细节开始显示出系统失衡、被掩盖的痕迹或危险升级。',
      goal: '把问题从猜测推进到可见证据',
      conflict: '越接近真相越暴露自己，也越难回头',
      emotion: '警觉、逼仄、压迫增强',
    },
    {
      title: '关系施压',
      summary: '关键人物进入同一空间，与主角形成试探、阻拦、协作或对峙，关系压力开始显性化。',
      goal: '把信息冲突升级为人物冲突',
      conflict: '主角需要答案，关键人物却未必愿意交出真相',
      emotion: '试探、对抗、气氛凝滞',
    },
    {
      title: '核心接触',
      summary: '主角终于接触到核心线索、关键装置或真正秘密，但也因此触发更大的风险与追问。',
      goal: '把前面铺垫集中到一次关键发现',
      conflict: '获得答案的同时，也必须承担无法撤销的后果',
      emotion: '震动、决断前夜、余波未落',
    },
  ];
}

function serializeSceneSeeds(seeds: StorySceneSeed[]) {
  return seeds
    .map((seed, index) => [
      `# Scene ${index + 1}: ${seed.title}`,
      `Summary: ${seed.summary}`,
      `Goal: ${seed.goal}`,
      `Conflict: ${seed.conflict}`,
      `Emotion: ${seed.emotion}`,
    ].join('\n'))
    .join('\n\n');
}

function parseSceneSeeds(content: string): StorySceneSeed[] {
  const blocks = content
    .split(/\n\s*\n/g)
    .map((item) => item.trim())
    .filter(Boolean);

  const structured = blocks
    .map((block, index) => {
      const lines = block.split(/\n+/).map((item) => item.trim()).filter(Boolean);
      const title = lines[0]?.replace(/^#\s*Scene\s*\d+\s*:\s*/i, '').trim() || `Scene ${index + 1}`;
      const summary = lines.find((line) => line.startsWith('Summary:'))?.replace('Summary:', '').trim() || '';
      const goal = lines.find((line) => line.startsWith('Goal:'))?.replace('Goal:', '').trim() || '';
      const conflict = lines.find((line) => line.startsWith('Conflict:'))?.replace('Conflict:', '').trim() || '';
      const emotion = lines.find((line) => line.startsWith('Emotion:'))?.replace('Emotion:', '').trim() || '';
      if (!summary) return null;
      return { title, summary, goal, conflict, emotion };
    })
    .filter(Boolean) as StorySceneSeed[];

  if (structured.length > 0) return structured;

  return content
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((summary, index) => ({
      title: `Scene ${index + 1}`,
      summary,
      goal: '推动叙事继续前进',
      conflict: '当前阻力尚未被解决',
      emotion: '情绪持续积压',
    }));
}

function extractJsonBlock(text: string) {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i)?.[1];
  if (fenced) return fenced.trim();
  const arrayLike = text.match(/\[[\s\S]*\]/)?.[0];
  if (arrayLike) return arrayLike.trim();
  return text.trim();
}

async function generateSynopsisWithLlm(input: {
  title: string;
  premise?: string | null;
  genre?: string | null;
  description?: string | null;
  ideaInput?: string | null;
}) {
  const result = await generateText({
    systemPrompt: '你是影视故事开发助手。请输出一段中文 synopsis，只输出正文，不要标题，不要分点。内容要适合后续做分场与镜头改编。',
    userPrompt: `项目名：${input.title}\n故事前提：${input.premise || input.ideaInput || '暂无'}\n题材：${input.genre || '未设定'}\n风格备注：${input.description || '暂无'}`,
    temperature: 0.7,
  });
  return result?.trim() || null;
}

async function generateBeatSheetWithLlm(input: {
  title: string;
  premise?: string | null;
  genre?: string | null;
  description?: string | null;
  synopsis: string;
}) {
  const result = await generateText({
    systemPrompt: '你是影视结构助手。请输出 JSON 数组，每一项是一条中文 beat。只输出 JSON 数组，不要解释。数组长度 6 到 8。',
    userPrompt: `项目名：${input.title}\n故事前提：${input.premise || '暂无'}\n题材：${input.genre || '未设定'}\n风格备注：${input.description || '暂无'}\n故事梗概：${input.synopsis}`,
    temperature: 0.6,
  });

  if (!result) return null;
  try {
    const parsed = JSON.parse(extractJsonBlock(result));
    if (!Array.isArray(parsed)) return null;
    return parsed.map((item) => String(item).trim()).filter(Boolean);
  } catch {
    return null;
  }
}

async function generateSceneSeedsWithLlm(input: {
  title: string;
  premise?: string | null;
  genre?: string | null;
  description?: string | null;
  synopsis: string;
  beats: string[];
}) {
  const result = await generateText({
    systemPrompt: '你是影视分场设计助手。请输出 JSON 数组，每项必须包含英文键名：title, summary, goal, conflict, emotion。值全部用中文。生成 5 个 scene seed。只输出 JSON 数组，不要解释。',
    userPrompt: `项目名：${input.title}\n故事前提：${input.premise || '暂无'}\n题材：${input.genre || '未设定'}\n风格备注：${input.description || '暂无'}\n故事梗概：${input.synopsis}\n剧情节拍：\n${input.beats.map((item, index) => `${index + 1}. ${item}`).join('\n')}`,
    temperature: 0.7,
  });

  if (!result) return null;
  try {
    const parsed = JSON.parse(extractJsonBlock(result));
    if (!Array.isArray(parsed)) return null;
    const scenes = parsed
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const record = item as Record<string, unknown>;
        return {
          title: String(record.title || '').trim(),
          summary: String(record.summary || '').trim(),
          goal: String(record.goal || '').trim(),
          conflict: String(record.conflict || '').trim(),
          emotion: String(record.emotion || '').trim(),
        };
      })
      .filter((item): item is StorySceneSeed => Boolean(item?.title && item?.summary));

    return scenes.length > 0 ? scenes : null;
  } catch {
    return null;
  }
}

async function upsertOutline(projectId: string, title: string, summary: string) {
  return createOutlineVersion(projectId, title, summary);
}

async function upsertChapter(projectId: string, title: string, content: string, orderIndex: number) {
  const existing = await prisma.chapter.findFirst({
    where: { projectId, title },
    orderBy: { createdAt: 'desc' },
  });

  if (existing) {
    return prisma.chapter.update({
      where: { id: existing.id },
      data: { content, orderIndex },
    });
  }

  return prisma.chapter.create({
    data: { projectId, title, content, orderIndex },
  });
}

export async function getLatestProject() {
  return prisma.project.findFirst({
    orderBy: { updatedAt: 'desc' },
    include: {
      ideaSeeds: { orderBy: { createdAt: 'desc' }, take: 1 },
      outlines: { orderBy: { createdAt: 'desc' } },
      chapters: { orderBy: { orderIndex: 'asc' } },
    },
  });
}

export async function createChapter(input: {
  projectId: string;
  title: string;
  content: string;
}) {
  const last = await prisma.chapter.findFirst({
    where: { projectId: input.projectId },
    orderBy: { orderIndex: 'desc' },
  });

  return prisma.chapter.create({
    data: {
      projectId: input.projectId,
      title: input.title,
      content: input.content,
      orderIndex: (last?.orderIndex ?? 0) + 1,
    },
  });
}

export async function generateStoryDraft(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      ideaSeeds: { orderBy: { createdAt: 'desc' }, take: 1 },
      outlines: { orderBy: { createdAt: 'desc' } },
      chapters: { orderBy: { orderIndex: 'asc' } },
    },
  });

  if (!project) throw new Error('项目不存在');

  const input = {
    title: project.title,
    premise: project.premise,
    genre: project.genre,
    description: project.description,
    ideaInput: project.ideaSeeds[0]?.input,
  };

  const fallbackSynopsis = buildSynopsisFallback(input);
  const synopsis = await generateSynopsisWithLlm(input).catch(() => null) || fallbackSynopsis;

  const fallbackBeats = buildBeatSheetFallback(input);
  const beats = await generateBeatSheetWithLlm({
    title: input.title,
    premise: input.premise,
    genre: input.genre,
    description: input.description,
    synopsis,
  }).catch(() => null) || fallbackBeats;

  const fallbackScenes = buildSceneSeedsFallback(input);
  const scenes = await generateSceneSeedsWithLlm({
    title: input.title,
    premise: input.premise,
    genre: input.genre,
    description: input.description,
    synopsis,
    beats,
  }).catch(() => null) || fallbackScenes;

  await upsertOutline(project.id, 'Story Engine Synopsis', synopsis);
  await upsertOutline(project.id, 'Story Engine Beat Sheet', beats.map((item, index) => `${index + 1}. ${item}`).join('\n'));

  const normalChapters = project.chapters.filter((chapter) => !chapter.title.startsWith('Story Engine'));
  await upsertChapter(project.id, 'Story Engine Beat Sheet', beats.join('\n'), normalChapters.length + 1);
  await upsertChapter(project.id, 'Story Engine Scene Seeds', serializeSceneSeeds(scenes), normalChapters.length + 2);

  await prisma.project.update({
    where: { id: project.id },
    data: { stage: 'STORY' },
  });

  return prisma.project.findUnique({
    where: { id: project.id },
    include: {
      ideaSeeds: { orderBy: { createdAt: 'desc' }, take: 1 },
      outlines: { orderBy: { createdAt: 'desc' } },
      chapters: { orderBy: { orderIndex: 'asc' } },
    },
  });
}

export async function generateStoryDraftPart(
  projectId: string,
  part: 'synopsis' | 'beats' | 'scenes',
) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      ideaSeeds: { orderBy: { createdAt: 'desc' }, take: 1 },
      outlines: { orderBy: { createdAt: 'desc' } },
      chapters: { orderBy: { orderIndex: 'asc' } },
    },
  });

  if (!project) throw new Error('项目不存在');

  const input = {
    title: project.title,
    premise: project.premise,
    genre: project.genre,
    description: project.description,
    ideaInput: project.ideaSeeds[0]?.input,
  };

  const existingDraft = getStoryDraftBundle(project);
  const fallbackSynopsis = buildSynopsisFallback(input);
  const synopsis = part === 'synopsis'
    ? await generateSynopsisWithLlm(input).catch(() => null) || fallbackSynopsis
    : normalizeText(existingDraft.synopsis) || fallbackSynopsis;

  const fallbackBeats = buildBeatSheetFallback(input);
  const beats = part === 'synopsis'
    ? existingDraft.beats.length > 0 ? existingDraft.beats : fallbackBeats
    : await generateBeatSheetWithLlm({
        title: input.title,
        premise: input.premise,
        genre: input.genre,
        description: input.description,
        synopsis,
      }).catch(() => null) || (existingDraft.beats.length > 0 ? existingDraft.beats : fallbackBeats);

  const fallbackScenes = buildSceneSeedsFallback(input);
  const scenes = part === 'scenes'
    ? await generateSceneSeedsWithLlm({
        title: input.title,
        premise: input.premise,
        genre: input.genre,
        description: input.description,
        synopsis,
        beats,
      }).catch(() => null) || (existingDraft.scenes.length > 0 ? existingDraft.scenes : fallbackScenes)
    : existingDraft.scenes.length > 0 ? existingDraft.scenes : fallbackScenes;

  if (part === 'synopsis') {
    await upsertOutline(project.id, 'Story Engine Synopsis', synopsis);
  }

  if (part === 'beats') {
    await upsertOutline(project.id, 'Story Engine Synopsis', synopsis);
    await upsertOutline(project.id, 'Story Engine Beat Sheet', beats.map((item, index) => `${index + 1}. ${item}`).join('\n'));
    const normalChapters = project.chapters.filter((chapter) => !chapter.title.startsWith('Story Engine'));
    await upsertChapter(project.id, 'Story Engine Beat Sheet', beats.join('\n'), normalChapters.length + 1);
  }

  if (part === 'scenes') {
    await upsertOutline(project.id, 'Story Engine Synopsis', synopsis);
    await upsertOutline(project.id, 'Story Engine Beat Sheet', beats.map((item, index) => `${index + 1}. ${item}`).join('\n'));
    const normalChapters = project.chapters.filter((chapter) => !chapter.title.startsWith('Story Engine'));
    await upsertChapter(project.id, 'Story Engine Beat Sheet', beats.join('\n'), normalChapters.length + 1);
    await upsertChapter(project.id, 'Story Engine Scene Seeds', serializeSceneSeeds(scenes), normalChapters.length + 2);
  }

  await prisma.project.update({
    where: { id: project.id },
    data: { stage: 'STORY' },
  });

  return prisma.project.findUnique({
    where: { id: project.id },
    include: {
      ideaSeeds: { orderBy: { createdAt: 'desc' }, take: 1 },
      outlines: { orderBy: { createdAt: 'desc' } },
      chapters: { orderBy: { orderIndex: 'asc' } },
    },
  });
}

export function getStoryDraftBundle(project: {
  outlines: Array<{ title: string; summary: string }>;
  chapters: Array<{ title: string; content: string }>;
}): StoryDraftBundle {
  const synopsis = project.outlines.find((item) => item.title === 'Story Engine Synopsis')?.summary
    || project.outlines[0]?.summary
    || '暂无 synopsis';

  const beatChapter = project.chapters.find((item) => item.title === 'Story Engine Beat Sheet');
  const sceneChapter = project.chapters.find((item) => item.title === 'Story Engine Scene Seeds');

  const beats = (beatChapter?.content || '')
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean);

  const scenes = parseSceneSeeds(sceneChapter?.content || '');

  return {
    synopsis,
    beats,
    scenes,
  };
}

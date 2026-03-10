import { prisma } from '@/lib/prisma';
import { generateText } from '@/lib/llm';
import { parseCharacterDrafts, type CharacterDraft } from '@/features/characters/service';
import { isGeneratedNovelChapterTitle, isStoryEngineChapterTitle } from '@/features/story/service';
import { buildReferenceProfileFromNotes } from '@/features/reference/service';
import { normalizeShotKind, type AllowedShotTitle } from '@/lib/shot-taxonomy';

type StructuredSceneSeed = {
  title: string;
  summary: string;
  goal: string;
  conflict: string;
  emotion: string;
};

type ShotSeed = {
  title: AllowedShotTitle;
  prompt: string;
  cameraNotes: string;
};

const TARGET_SCENE_COUNT = 5;
const TARGET_SHOT_COUNT_PER_SCENE = 4;

export async function getLatestProjectWithChapters(projectId?: string) {
  const include = {
    chapters: { orderBy: { orderIndex: 'asc' } },
    scenes: { orderBy: { orderIndex: 'asc' } },
    shots: { orderBy: { orderIndex: 'asc' } },
    references: { orderBy: { createdAt: 'desc' } },
    outlines: { orderBy: { createdAt: 'desc' } },
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

function getCharacterDrafts(project: { outlines?: Array<{ title: string; summary: string }> }): CharacterDraft[] {
  const outline = project.outlines?.find((item) => item.title === 'Character Drafts');
  return outline ? parseCharacterDrafts(outline.summary) : [];
}

function summarizeCharacters(characters: CharacterDraft[]) {
  if (characters.length === 0) return '暂无角色草案';
  return characters
    .map((item) => `${item.name}（${item.role}）：${item.archetype}；目标：${item.goal}；冲突：${item.conflict}`)
    .join('\n');
}

function splitIntoSceneSeeds(content: string) {
  const chunks = content
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (chunks.length > 0) return chunks.slice(0, TARGET_SCENE_COUNT);

  return content
    .split(/[。！？!?]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, TARGET_SCENE_COUNT);
}

function parseStructuredSceneSeeds(content: string): StructuredSceneSeed[] {
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
    .filter(Boolean) as StructuredSceneSeed[];

  if (structured.length > 0) return structured;

  return splitIntoSceneSeeds(content).map((summary, index) => ({
    title: `Scene ${index + 1}`,
    summary,
    goal: '推动叙事继续前进',
    conflict: '当前阻力尚未被解决',
    emotion: '情绪持续积压',
  }));
}

function ensureSceneSeedCount(sceneSeeds: Array<{ raw: string; meta: StructuredSceneSeed | null }>) {
  const base = sceneSeeds.slice(0, TARGET_SCENE_COUNT);
  if (base.length === 0) return base;

  const output = [...base];
  while (output.length < TARGET_SCENE_COUNT) {
    const last = output[output.length - 1];
    const index = output.length;
    output.push({
      raw: last.raw,
      meta: last.meta
        ? {
            ...last.meta,
            title: `${last.meta.title}（延展 ${index + 1}）`,
          }
        : {
            title: `Scene ${index + 1}`,
            summary: last.raw,
            goal: '延续当前叙事推进',
            conflict: '上一场冲突持续发酵',
            emotion: '压力继续累积',
          },
    });
  }

  return output;
}

function extractReferenceHints(referenceNotes: string[]) {
  const profile = buildReferenceProfileFromNotes(referenceNotes);
  return {
    framing: profile.framing,
    emotion: profile.emotion,
    movement: profile.movement,
    titles: profile.titleSummary,
    notes: profile.noteSummary,
  };
}

function normalizeSeed(sceneText: string) {
  return sceneText.replace(/\s+/g, ' ').trim();
}

function clipText(text: string, max = 80) {
  return text.length > max ? `${text.slice(0, max).trim()}…` : text;
}

function splitSceneBeats(sceneText: string) {
  return sceneText
    .split(/[，、；：]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function inferSceneTitle(sceneText: string, sceneIndex: number, preferredTitle?: string) {
  const normalizedPreferred = normalizeSeed(preferredTitle || '');
  if (normalizedPreferred && !/^Scene\s+\d+$/i.test(normalizedPreferred)) {
    return normalizedPreferred;
  }

  const normalized = normalizeSeed(sceneText);

  const locationRules: Array<[RegExp, string]> = [
    [/维修层/, '维修层'],
    [/管道旁|失压管道/, '管道旁'],
    [/控制室/, '控制室'],
    [/走廊/, '走廊'],
    [/通道/, '通道'],
    [/机房/, '机房'],
    [/舱室/, '舱室'],
    [/桥面/, '桥面'],
    [/电梯间/, '电梯间'],
  ];

  for (const [pattern, label] of locationRules) {
    if (pattern.test(normalized)) return label;
  }

  const stateRules: Array<[RegExp, string]> = [
    [/警示灯|一闪一灭|轰鸣|震动/, '异响逼近'],
    [/冷却液|阀门|检修|跪在/, '检修现场'],
    [/发现|察觉|听见/, '察觉异常'],
    [/试图|取出|拔出|核心/, '核心取出前'],
    [/说|问|答|低声|开口|沉默/, '对峙时刻'],
  ];

  for (const [pattern, label] of stateRules) {
    if (pattern.test(normalized)) return label;
  }

  return `场 ${sceneIndex + 1}`;
}

function buildSceneSummaryFallback(
  sceneText: string,
  referenceNotes: string[],
  characterSummary: string,
  seedMeta?: StructuredSceneSeed,
) {
  const normalized = normalizeSeed(sceneText);
  const beats = splitSceneBeats(normalized);
  const opening = beats[0] || clipText(normalized, 24);
  const turning = beats[1] || beats[0] || clipText(normalized, 24);
  const hints = extractReferenceHints(referenceNotes);
  const characterNote = characterSummary && characterSummary !== '暂无角色草案'
    ? `角色层面优先抓住“${characterSummary.split('\n')[0]}”的状态与关系压力。`
    : '';

  if (seedMeta) {
    const core = `这一场围绕“${seedMeta.goal}”展开，核心冲突是“${seedMeta.conflict}”。场面先从“${opening}”进入，再把注意力推向“${turning}”，最终落到“${seedMeta.emotion}”这一情绪状态上。${characterNote}`;
    if (!referenceNotes.length) return core;
    return `${core} 参考锚点来自${hints.titles}，导演处理上强调${hints.framing}，情绪保持${hints.emotion}，整体节奏为${hints.movement}，并补足${hints.notes}。`;
  }

  if (!referenceNotes.length) {
    return `这一场先建立“${opening}”的局面，再把叙事重心推向“${turning}”，镜头重点放在动作触发与情绪变化。${characterNote}`;
  }

  return `这一场以“${opening}”开局，随后把注意力推向“${turning}”。${characterNote} 参考锚点来自${hints.titles}，导演处理上强调${hints.framing}，情绪保持${hints.emotion}，整体节奏为${hints.movement}，并补足${hints.notes}。`;
}

function hasDialogueScene(sceneText: string) {
  return /说|问|答|喊|低声|开口|沉默|对视|回话/.test(sceneText);
}

function hasMotionScene(sceneText: string) {
  return /跑|冲|追|跌|拉|推|转身|抬手|跪|扑|站起|移动|震动|取出|拔出/.test(sceneText);
}

function hasSoloObservationScene(sceneText: string) {
  return /看|盯|望|听|呼吸|心跳|发现|察觉|闪|鸣|液|痕迹|声音/.test(sceneText);
}

function buildShotSeedsFallback(
  sceneText: string,
  referenceNotes: string[],
  characterSummary: string,
  seedMeta?: StructuredSceneSeed,
) {
  const normalized = normalizeSeed(sceneText);
  const base = clipText(normalized, 120) || '镜头占位';
  const beats = splitSceneBeats(normalized);
  const openingBeat = beats[0] || base;
  const actionBeat = beats[1] || beats[0] || base;
  const emotionBeat = seedMeta?.emotion || beats[beats.length - 1] || base;
  const hints = extractReferenceHints(referenceNotes);
  const conflictNote = seedMeta?.conflict ? `当前冲突：${seedMeta.conflict}。` : '';
  const roleNote = characterSummary && characterSummary !== '暂无角色草案'
    ? `角色重点：${characterSummary.split('\n')[0]}。`
    : '';

  const shots: ShotSeed[] = [
    {
      title: '空间建立',
      prompt: `从环境与人物相对位置切入，先交代“${clipText(openingBeat, 36)}”所处的空间、时间与压迫关系，让观众在第一眼读懂场域规则。${conflictNote}${roleNote} 参考构图：${hints.framing}。`,
      cameraNotes: `中远景 / 先交代空间关系与主次层级 / 构图参考：${hints.framing}`,
    },
  ];

  if (hasSoloObservationScene(normalized) && !hasDialogueScene(normalized)) {
    shots.push({
      title: '细节观察',
      prompt: `把注意力压到“${clipText(actionBeat, 36)}”这一细节上，通过视线停留、手部动作或环境异响，让观众跟人物一起完成察觉与确认。${conflictNote}${roleNote} 情绪参考：${hints.emotion}。`,
      cameraNotes: `近景特写 / 细节物件或感官线索 / 强调察觉过程 / 情绪参考：${hints.emotion}`,
    });
  } else {
    shots.push({
      title: '动作触发',
      prompt: `镜头跟进“${clipText(actionBeat, 36)}”这一动作或决定发生的瞬间，不只拍动作本身，还要带出人物为何开始移动或出手。${conflictNote}${roleNote} 动作节奏参考：${hints.movement}。`,
      cameraNotes: `中景推进 / 捕捉动作起点与因果触发 / 节奏参考：${hints.movement}`,
    });
  }

  if (hasDialogueScene(normalized)) {
    shots.push({
      title: '对白博弈',
      prompt: `把“${clipText(base, 42)}”中的对白压力和试探感拍出来，重点不只是台词内容，而是人物说出口之前的停顿、说出口之后的反应，以及谁在这场交流里占上风。${conflictNote}${roleNote} 情绪参考：${hints.emotion}。`,
      cameraNotes: `过肩 / 对切 / 停顿反应镜头 / 强调对白权力关系 / 情绪参考：${hints.emotion}`,
    });
  } else if (hasMotionScene(normalized)) {
    shots.push({
      title: '关系压迫',
      prompt: `把人物之间的距离、视线与压迫感拍清楚，让“${clipText(base, 42)}”里的关系张力被看见，而不是只停留在对白说明。${conflictNote}${roleNote} 情绪参考：${hints.emotion}。`,
      cameraNotes: `双人近景或过肩镜头 / 强调关系博弈与视线压力 / 情绪参考：${hints.emotion}`,
    });
  } else if (hasSoloObservationScene(normalized)) {
    shots.push({
      title: '感官压迫',
      prompt: `让环境里的声响、闪烁、液体痕迹或气压变化成为压迫来源，把“${clipText(String(emotionBeat), 36)}”拍成观众能直接感到不安的感官线索。${conflictNote}${roleNote} 情绪参考：${hints.emotion}。`,
      cameraNotes: `特写或微距 / 强调环境线索与生理压迫感 / 情绪参考：${hints.emotion}`,
    });
  } else {
    shots.push({
      title: '关系压迫',
      prompt: `把人物之间的距离、视线与压迫感拍清楚，让“${clipText(base, 42)}”里的关系张力被看见，而不是只停留在对白说明。${conflictNote}${roleNote} 情绪参考：${hints.emotion}。`,
      cameraNotes: `双人近景或过肩镜头 / 强调关系博弈与视线压力 / 情绪参考：${hints.emotion}`,
    });
  }

  shots.push({
    title: '情绪落点',
    prompt: `收在“${clipText(String(emotionBeat), 36)}”带来的情绪余震上，用更近的观察捕捉人物表情、呼吸或停顿，让这一拍成为 scene 的情绪落点。${roleNote} 情绪参考：${hints.emotion}。`,
    cameraNotes: `特写 / 保留停顿与情绪余波 / 表演重点：${hints.emotion}`,
  });

  return ensureShotCount(shots, sceneText, referenceNotes, characterSummary, seedMeta);
}

function ensureShotCount(
  shots: ShotSeed[],
  sceneText: string,
  referenceNotes: string[],
  characterSummary: string,
  seedMeta?: StructuredSceneSeed,
) {
  const baseShots = shots
    .filter((item) => item.title && item.prompt)
    .slice(0, TARGET_SHOT_COUNT_PER_SCENE)
    .map((item) => ({
      ...item,
      title: normalizeShotKind(item.title),
    }));
  if (baseShots.length === TARGET_SHOT_COUNT_PER_SCENE) return baseShots;

  const normalized = normalizeSeed(sceneText);
  const hints = extractReferenceHints(referenceNotes);
  const emotion = seedMeta?.emotion || '情绪持续积压';
  const conflict = seedMeta?.conflict ? `当前冲突：${seedMeta.conflict}。` : '';
  const roleNote = characterSummary && characterSummary !== '暂无角色草案'
    ? `角色重点：${characterSummary.split('\n')[0]}。`
    : '';

  const fillers: ShotSeed[] = [
    {
      title: '细节观察',
      prompt: `补充观察“${clipText(normalized, 42)}”里的关键细节，让人物的判断过程被看见。${conflict}${roleNote} 情绪参考：${hints.emotion}。`,
      cameraNotes: `近景特写 / 补足细节线索 / 情绪参考：${hints.emotion}`,
    },
    {
      title: '关系压迫',
      prompt: `补充人物之间的视线、距离和压迫感，让“${clipText(normalized, 42)}”不只是事件推进，也形成关系张力。${conflict}${roleNote} 情绪参考：${hints.emotion}。`,
      cameraNotes: `双人近景 / 视线对抗 / 情绪参考：${hints.emotion}`,
    },
    {
      title: '情绪落点',
      prompt: `补充“${emotion}”的余震，用更近的观察收住人物状态，让这一场有明确情绪落点。${roleNote}`,
      cameraNotes: `特写 / 呼吸与停顿 / 情绪落点：${emotion}`,
    },
  ];

  const existingTitles = new Set(baseShots.map((item) => item.title));
  for (const filler of fillers) {
    if (baseShots.length >= TARGET_SHOT_COUNT_PER_SCENE) break;
    const candidate = existingTitles.has(filler.title)
      ? { ...filler, title: normalizeShotKind(`${filler.title}补充`) }
      : { ...filler, title: normalizeShotKind(filler.title) };
    baseShots.push(candidate);
    existingTitles.add(candidate.title);
  }

  while (baseShots.length < TARGET_SHOT_COUNT_PER_SCENE) {
    baseShots.push({
      title: normalizeShotKind(`镜头补充 ${baseShots.length + 1}`),
      prompt: `围绕“${clipText(normalized, 42)}”补足一条人物驱动镜头，让动作、关系或情绪信息完整闭环。${conflict}${roleNote}`,
      cameraNotes: '中近景 / 用于补足叙事闭环',
    });
  }

  return baseShots.slice(0, TARGET_SHOT_COUNT_PER_SCENE);
}

function extractJsonBlock(text: string) {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i)?.[1];
  if (fenced) return fenced.trim();
  const arrayLike = text.match(/\[[\s\S]*\]/)?.[0];
  if (arrayLike) return arrayLike.trim();
  const objectLike = text.match(/\{[\s\S]*\}/)?.[0];
  return objectLike?.trim() || text.trim();
}

async function generateSceneSummaryWithLlm(input: {
  projectTitle: string;
  sceneTitle: string;
  sceneSummarySeed: string;
  goal: string;
  conflict: string;
  emotion: string;
  referenceNotes: string[];
  characterSummary: string;
}) {
  const hints = extractReferenceHints(input.referenceNotes);
  const result = await generateText({
    systemPrompt: '你是影视改编助手。请为单个 scene 输出一段中文导演化摘要，只输出正文，不要分点。要求包含场面推进、冲突核心、情绪落点，并自然融入镜头处理感，同时体现关键角色所承受的关系压力或人物状态。',
    userPrompt: `项目：${input.projectTitle}\n场次标题：${input.sceneTitle}\n分场种子：${input.sceneSummarySeed}\n目标：${input.goal}\n冲突：${input.conflict}\n情绪：${input.emotion}\n角色摘要：${input.characterSummary}\n参考标题：${hints.titles}\n参考构图：${hints.framing}\n参考情绪：${hints.emotion}\n参考节奏：${hints.movement}\n参考补充：${hints.notes}`,
    temperature: 0.7,
  });
  return result?.trim() || null;
}

async function generateShotSeedsWithLlm(input: {
  projectTitle: string;
  sceneTitle: string;
  sceneSummarySeed: string;
  goal: string;
  conflict: string;
  emotion: string;
  referenceNotes: string[];
  characterSummary: string;
}) {
  const hints = extractReferenceHints(input.referenceNotes);
  const result = await generateText({
    systemPrompt: '你是影视分镜助手。请输出 JSON 数组，严格生成 4 个 shot seed。每项必须包含英文键名：title, prompt, cameraNotes。值全部使用中文。shot title 优先从这些类型里选择：空间建立、细节观察、感官压迫、情绪落点、关系压迫、动作触发、对白博弈。不要输出解释。每个 shot 都要体现关键角色状态、视角或关系压力，而不是只描述环境。必须恰好返回 4 项。',
    userPrompt: `项目：${input.projectTitle}\n场次标题：${input.sceneTitle}\n分场种子：${input.sceneSummarySeed}\n目标：${input.goal}\n冲突：${input.conflict}\n情绪：${input.emotion}\n角色摘要：${input.characterSummary}\n参考标题：${hints.titles}\n参考构图：${hints.framing}\n参考情绪：${hints.emotion}\n参考节奏：${hints.movement}\n参考补充：${hints.notes}`,
    temperature: 0.7,
  });

  if (!result) return null;
  try {
    const parsed = JSON.parse(extractJsonBlock(result));
    if (!Array.isArray(parsed)) return null;
    const shots = parsed
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const record = item as Record<string, unknown>;
        return {
          title: normalizeShotKind(String(record.title || '').trim()),
          prompt: String(record.prompt || '').trim(),
          cameraNotes: String(record.cameraNotes || '').trim(),
        };
      })
      .filter((item): item is ShotSeed => Boolean(item && item.title && item.prompt));

    return shots.length > 0 ? shots.slice(0, TARGET_SHOT_COUNT_PER_SCENE) : null;
  } catch {
    return null;
  }
}

async function resolveAdaptationSource(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      chapters: { orderBy: { orderIndex: 'desc' } },
      references: { orderBy: { createdAt: 'desc' }, take: 3 },
      outlines: { orderBy: { createdAt: 'desc' } },
    },
  });

  if (!project) throw new Error('没有可用于改编的章节');

  const latestGeneratedNovelChapter = project.chapters.find((chapter) => isGeneratedNovelChapterTitle(chapter.title));
  if (latestGeneratedNovelChapter) {
    return {
      project,
      sourceType: 'novel-chapter' as const,
      sourceChapter: latestGeneratedNovelChapter,
      sceneSeeds: ensureSceneSeedCount(splitIntoSceneSeeds(latestGeneratedNovelChapter.content || '').map((item) => ({ raw: item, meta: null }))),
    };
  }

  const latestManualChapter = project.chapters.find((chapter) => !isStoryEngineChapterTitle(chapter.title));
  if (latestManualChapter) {
    return {
      project,
      sourceType: 'chapter' as const,
      sourceChapter: latestManualChapter,
      sceneSeeds: ensureSceneSeedCount(splitIntoSceneSeeds(latestManualChapter.content || '').map((item) => ({ raw: item, meta: null }))),
    };
  }

  const storySceneChapter = project.chapters.find((chapter) => chapter.title === 'Story Engine Scene Seeds');
  if (storySceneChapter) {
    const structuredSeeds = parseStructuredSceneSeeds(storySceneChapter.content || '');
    return {
      project,
      sourceType: 'story-scenes' as const,
      sourceChapter: storySceneChapter,
      sceneSeeds: ensureSceneSeedCount(structuredSeeds.map((item) => ({
        raw: item.summary,
        meta: item,
      }))),
    };
  }

  throw new Error('没有可用于改编的章节');
}

export async function generateAdaptationFromLatestChapter(projectId: string) {
  const { project, sourceChapter, sceneSeeds } = await resolveAdaptationSource(projectId);

  await prisma.shot.deleteMany({ where: { projectId } });
  await prisma.scene.deleteMany({ where: { projectId } });

  const referenceNotes = project.references.map((item) => item.notes || '').filter(Boolean);
  const characterSummary = summarizeCharacters(getCharacterDrafts(project));

  for (const [sceneIndex, seed] of sceneSeeds.entries()) {
    const title = inferSceneTitle(seed.raw, sceneIndex, seed.meta?.title);
    const sceneSummary = await generateSceneSummaryWithLlm({
      projectTitle: project.title,
      sceneTitle: title,
      sceneSummarySeed: seed.raw,
      goal: seed.meta?.goal || '推进场面与人物状态',
      conflict: seed.meta?.conflict || '当前阻力尚未解决',
      emotion: seed.meta?.emotion || '情绪持续积压',
      referenceNotes,
      characterSummary,
    }).catch(() => null) || buildSceneSummaryFallback(seed.raw, referenceNotes, characterSummary, seed.meta || undefined);

    const scene = await prisma.scene.create({
      data: {
        projectId,
        chapterId: sourceChapter.id,
        title,
        summary: sceneSummary,
        orderIndex: sceneIndex + 1,
      },
    });

    const llmShots = await generateShotSeedsWithLlm({
      projectTitle: project.title,
      sceneTitle: title,
      sceneSummarySeed: seed.raw,
      goal: seed.meta?.goal || '推进场面与人物状态',
      conflict: seed.meta?.conflict || '当前阻力尚未解决',
      emotion: seed.meta?.emotion || '情绪持续积压',
      referenceNotes,
      characterSummary,
    }).catch(() => null);

    const shotSeeds = ensureShotCount(
      llmShots && llmShots.length > 0 ? llmShots : buildShotSeedsFallback(seed.raw, referenceNotes, characterSummary, seed.meta || undefined),
      seed.raw,
      referenceNotes,
      characterSummary,
      seed.meta || undefined,
    );

    for (const [shotIndex, shot] of shotSeeds.entries()) {
      await prisma.shot.create({
        data: {
          projectId,
          sceneId: scene.id,
          title: `${title} - ${shot.title}`,
          prompt: shot.prompt,
          cameraNotes: shot.cameraNotes,
          orderIndex: shotIndex + 1,
        },
      });
    }
  }

  return prisma.project.findUnique({
    where: { id: projectId },
    include: {
      chapters: { orderBy: { orderIndex: 'asc' } },
      scenes: { orderBy: { orderIndex: 'asc' } },
      shots: { orderBy: [{ sceneId: 'asc' }, { orderIndex: 'asc' }] },
      references: { orderBy: { createdAt: 'desc' } },
      outlines: { orderBy: { createdAt: 'desc' } },
    },
  });
}

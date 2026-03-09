import { prisma } from '@/lib/prisma';
import { getShotKindFromTitle } from '@/lib/shot-taxonomy';
import { createOutlineVersion, getLatestOutlineByTitle } from '@/lib/outline-store';
import { getTimelineBeatTypeLabel } from '@/lib/display';

const SHOT_DURATION_MAP: Record<string, number> = {
  空间建立: 6,
  细节观察: 4,
  感官压迫: 5,
  情绪落点: 4,
  关系压迫: 5,
  动作触发: 3,
  对白博弈: 6,
};

const EMOTION_SCORE_MAP: Record<string, number> = {
  空间建立: 2,
  细节观察: 3,
  感官压迫: 5,
  情绪落点: 3,
  关系压迫: 4,
  动作触发: 5,
  对白博弈: 4,
};

export type TimelineBeatType = 'buffer' | 'key-scene' | 'conflict-peak' | 'climax';

export type TimelineOverride = {
  shotId: string;
  duration?: number;
  emotion?: number;
  beatType?: TimelineBeatType;
  note?: string;
};

function estimateShotDuration(title: string) {
  const kind = getShotKindFromTitle(title);
  return SHOT_DURATION_MAP[kind] || 4;
}

function estimateEmotionScore(title: string) {
  const kind = getShotKindFromTitle(title);
  return EMOTION_SCORE_MAP[kind] || 3;
}

function formatSeconds(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}分 ${seconds}秒`;
}

function parseTimelineOverrides(content: string) {
  if (!content.trim()) return [] as TimelineOverride[];

  try {
    const parsed = JSON.parse(content) as { overrides?: TimelineOverride[] } | TimelineOverride[];
    const overrides = Array.isArray(parsed) ? parsed : parsed.overrides || [];
    return overrides
      .map((item) => ({
        shotId: String(item.shotId || '').trim(),
        duration: typeof item.duration === 'number' && item.duration > 0 ? item.duration : undefined,
        emotion: typeof item.emotion === 'number' ? Math.max(1, Math.min(5, item.emotion)) : undefined,
        beatType: item.beatType,
        note: item.note ? String(item.note).trim() : undefined,
      }))
      .filter((item) => item.shotId);
  } catch {
    return [] as TimelineOverride[];
  }
}

function serializeTimelineOverrides(overrides: TimelineOverride[]) {
  return JSON.stringify({ version: 1, overrides }, null, 2);
}

function getEmotionLabel(score: number) {
  if (score >= 5) return '高压峰值';
  if (score >= 4) return '持续拉紧';
  if (score >= 3) return '中段推进';
  if (score >= 2) return '铺垫观察';
  return '缓冲过渡';
}

export async function getTimelineProject() {
  return prisma.project.findFirst({
    orderBy: { updatedAt: 'desc' },
    include: {
      scenes: { orderBy: { orderIndex: 'asc' } },
      shots: { orderBy: [{ sceneId: 'asc' }, { orderIndex: 'asc' }] },
      outlines: { orderBy: { createdAt: 'desc' } },
    },
  });
}

export async function saveTimelineOverrides(projectId: string, overrides: TimelineOverride[]) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { outlines: { orderBy: { createdAt: 'desc' } } },
  });

  if (!project) throw new Error('项目不存在');

  const cleaned = overrides
    .map((item) => ({
      shotId: String(item.shotId || '').trim(),
      duration: typeof item.duration === 'number' && item.duration > 0 ? item.duration : undefined,
      emotion: typeof item.emotion === 'number' ? Math.max(1, Math.min(5, item.emotion)) : undefined,
      beatType: item.beatType,
      note: item.note ? String(item.note).trim() : undefined,
    }))
    .filter((item) => item.shotId);

  await createOutlineVersion(projectId, 'Timeline Overrides', serializeTimelineOverrides(cleaned));

  return getTimelineBundle(projectId);
}

export async function getTimelineBundle(projectId?: string) {
  const project = projectId
    ? await prisma.project.findUnique({
        where: { id: projectId },
        include: {
          scenes: { orderBy: { orderIndex: 'asc' } },
          shots: { orderBy: [{ sceneId: 'asc' }, { orderIndex: 'asc' }] },
          outlines: { orderBy: { createdAt: 'desc' } },
        },
      })
    : await getTimelineProject();

  if (!project) return null;

  const overrideOutline = getLatestOutlineByTitle(project.outlines, 'Timeline Overrides');
  const overrides = parseTimelineOverrides(overrideOutline?.summary || '');
  const overrideMap = new Map(overrides.map((item) => [item.shotId, item]));

  let accumulated = 0;
  const warnings: Array<{ level: 'warning' | 'info'; label: string; detail: string }> = [];

  const scenes = project.scenes.map((scene) => {
    const sceneShots = project.shots.filter((shot) => shot.sceneId === scene.id);
    const shots = sceneShots.map((shot) => {
      const override = overrideMap.get(shot.id);
      const duration = override?.duration || estimateShotDuration(shot.title);
      const emotion = override?.emotion || estimateEmotionScore(shot.title);
      const startAt = accumulated;
      accumulated += duration;

      return {
        id: shot.id,
        title: shot.title,
        duration,
        startAt,
        endAt: accumulated,
        kind: getShotKindFromTitle(shot.title),
        emotion,
        emotionLabel: getEmotionLabel(emotion),
        beatType: override?.beatType || null,
        note: override?.note || '',
        isManualDuration: Boolean(override?.duration),
      };
    });

    const duration = shots.reduce((sum, shot) => sum + shot.duration, 0);
    const startAt = shots[0]?.startAt ?? accumulated;
    const endAt = shots[shots.length - 1]?.endAt ?? accumulated;
    const emotionScore = shots.length > 0 ? Math.round((shots.reduce((sum, shot) => sum + shot.emotion, 0) / shots.length) * 10) / 10 : 0;
    const beatMarkers = shots.filter((shot) => shot.beatType).map((shot) => `${shot.title}（${getTimelineBeatTypeLabel(shot.beatType)}）`);

    if (duration < 12) {
      warnings.push({ level: 'warning', label: `场次过短：${scene.title}`, detail: `当前仅 ${formatSeconds(duration)}，建议补一条缓冲镜头或情绪停顿。` });
    }
    if (duration > 28) {
      warnings.push({ level: 'warning', label: `场次偏长：${scene.title}`, detail: `当前已到 ${formatSeconds(duration)}，建议压缩重复信息或收紧对白。` });
    }
    if (!beatMarkers.some((item) => item.includes('climax') || item.includes('conflict-peak'))) {
      warnings.push({ level: 'info', label: `缺少峰值标记：${scene.title}`, detail: '建议至少标一个冲突峰值或高潮点，方便判断节奏起伏。' });
    }

    return {
      id: scene.id,
      title: scene.title,
      summary: scene.summary,
      duration,
      startAt,
      endAt,
      shotCount: shots.length,
      emotionScore,
      emotionLabel: getEmotionLabel(Math.round(emotionScore)),
      beatMarkers,
      shots,
    };
  });

  const totalSeconds = scenes.reduce((sum, scene) => sum + scene.duration, 0);
  const emotionCurve = scenes.map((scene) => ({
    sceneId: scene.id,
    title: scene.title,
    score: scene.emotionScore,
    label: scene.emotionLabel,
  }));

  return {
    projectId: project.id,
    projectTitle: project.title,
    totalSeconds,
    totalDurationLabel: formatSeconds(totalSeconds),
    warnings,
    emotionCurve,
    overrides,
    scenes,
  };
}

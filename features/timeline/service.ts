import { prisma } from '@/lib/prisma';
import { getShotKindFromTitle } from '@/lib/shot-taxonomy';

const SHOT_DURATION_MAP: Record<string, number> = {
  空间建立: 6,
  细节观察: 4,
  感官压迫: 5,
  情绪落点: 4,
  关系压迫: 5,
  动作触发: 3,
  对白博弈: 6,
};

export async function getTimelineProject() {
  return prisma.project.findFirst({
    orderBy: { updatedAt: 'desc' },
    include: {
      scenes: { orderBy: { orderIndex: 'asc' } },
      shots: { orderBy: [{ sceneId: 'asc' }, { orderIndex: 'asc' }] },
    },
  });
}

function estimateShotDuration(title: string) {
  const kind = getShotKindFromTitle(title);
  return SHOT_DURATION_MAP[kind] || 4;
}

function formatSeconds(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}分 ${seconds}秒`;
}

export async function getTimelineBundle() {
  const project = await getTimelineProject();
  if (!project) return null;

  let accumulated = 0;
  const scenes = project.scenes.map((scene) => {
    const sceneShots = project.shots.filter((shot) => shot.sceneId === scene.id);
    const shots = sceneShots.map((shot) => {
      const duration = estimateShotDuration(shot.title);
      const startAt = accumulated;
      accumulated += duration;
      return {
        id: shot.id,
        title: shot.title,
        duration,
        startAt,
        endAt: accumulated,
        kind: getShotKindFromTitle(shot.title),
      };
    });

    const duration = shots.reduce((sum, shot) => sum + shot.duration, 0);
    const startAt = shots[0]?.startAt ?? accumulated;
    const endAt = shots[shots.length - 1]?.endAt ?? accumulated;

    return {
      id: scene.id,
      title: scene.title,
      summary: scene.summary,
      duration,
      startAt,
      endAt,
      shotCount: shots.length,
      shots,
    };
  });

  const totalSeconds = scenes.reduce((sum, scene) => sum + scene.duration, 0);

  return {
    projectId: project.id,
    projectTitle: project.title,
    totalSeconds,
    totalDurationLabel: formatSeconds(totalSeconds),
    scenes,
  };
}

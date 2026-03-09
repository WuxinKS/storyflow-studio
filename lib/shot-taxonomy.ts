export const ALLOWED_SHOT_TITLES = ['空间建立', '细节观察', '感官压迫', '情绪落点', '关系压迫', '动作触发', '对白博弈'] as const;

export type AllowedShotTitle = (typeof ALLOWED_SHOT_TITLES)[number];

export function normalizeShotKind(kind: string): AllowedShotTitle {
  const normalized = kind.trim();

  if (ALLOWED_SHOT_TITLES.includes(normalized as AllowedShotTitle)) {
    return normalized as AllowedShotTitle;
  }

  const exactMap: Record<string, AllowedShotTitle> = {
    真相揭晓: '对白博弈',
    真相揭露: '对白博弈',
    信息揭晓: '对白博弈',
    真相反转: '对白博弈',
    对峙时刻: '关系压迫',
    察觉异常: '细节观察',
    检修现场: '动作触发',
    异响逼近: '感官压迫',
    核心取出前: '动作触发',
    镜头补充: '细节观察',
  };

  if (exactMap[normalized]) return exactMap[normalized];
  if (/真相|揭晓|揭露|反转/.test(normalized)) return '对白博弈';
  if (/对白|对话|台词/.test(normalized)) return '对白博弈';
  if (/对峙|博弈|试探|关系|压迫/.test(normalized)) return '关系压迫';
  if (/察觉|发现|线索|观察|细节/.test(normalized)) return '细节观察';
  if (/异响|警示|震动|轰鸣|感官/.test(normalized)) return '感官压迫';
  if (/动作|追逐|触发|出手|取出|现场/.test(normalized)) return '动作触发';
  if (/情绪|余震|沉默|落点/.test(normalized)) return '情绪落点';
  if (/空间|建立|环境|场域/.test(normalized)) return '空间建立';

  return '细节观察';
}

export function getShotKindFromTitle(title: string): AllowedShotTitle {
  const rawKind = title.split(' - ').pop() || title;
  return normalizeShotKind(rawKind);
}

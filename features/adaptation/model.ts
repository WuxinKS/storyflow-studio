export type AdaptationTask = {
  sourceChapterId: string;
  target: 'scene' | 'shot';
  goal: string;
};

export const sampleAdaptationTask: AdaptationTask = {
  sourceChapterId: 'chapter-1',
  target: 'shot',
  goal: '将章节拆成适合短视频节奏的 8 个镜头。',
};

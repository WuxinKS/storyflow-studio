export type StoryboardShot = {
  id: string;
  title: string;
  purpose: string;
};

export const sampleShots: StoryboardShot[] = [
  {
    id: 'shot-1',
    title: '主角抬手特写',
    purpose: '建立人物紧张状态与视觉记忆点。',
  },
  {
    id: 'shot-2',
    title: '环境压迫镜头',
    purpose: '突出空间限制和冲突氛围。',
  },
];

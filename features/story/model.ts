export type StoryAsset = {
  id: string;
  name: string;
  type: 'character' | 'world' | 'outline';
  summary: string;
};

export const sampleStoryAssets: StoryAsset[] = [
  {
    id: 'hero',
    name: '主角原型',
    type: 'character',
    summary: '具备明确欲望、缺陷与成长路线的核心角色。',
  },
  {
    id: 'world',
    name: '世界观母设定',
    type: 'world',
    summary: '承载题材气质、社会规则与冲突来源的背景系统。',
  },
  {
    id: 'outline',
    name: '主线大纲',
    type: 'outline',
    summary: '从起点、升级、反转到结局的剧情主脉络。',
  },
];

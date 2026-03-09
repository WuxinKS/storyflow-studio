export type ProjectDraft = {
  title: string;
  hook: string;
  genre: string;
  style: string;
  output: 'novel' | 'screenplay' | 'video';
};

export const PROJECT_DRAFT_KEY = 'storyflow.projectDraft';

export const defaultProjectDraft: ProjectDraft = {
  title: '灵感成片 Demo',
  hook: '一个底层角色在极端世界里获得改变命运的机会。',
  genre: '科幻 / 奇幻',
  style: '电影感、强冲突、适合影视改编',
  output: 'video',
};

export const appMeta = {
  name: 'StoryFlow Studio',
  tagline: '一句话到成片',
  description:
    '围绕一句话创意、小说正文、自动分镜、图片 / 视频生成与成片交付，组织真正可落地的创作主链。',
};

export type NavigationGroupKey = 'overview' | 'core' | 'support';
export type NavigationPriority = 'overview' | 'core' | 'support';

export type NavigationGroup = {
  key: NavigationGroupKey;
  label: string;
  summary: string;
};

export type NavigationItem = {
  href: string;
  label: string;
  section: string;
  group: NavigationGroupKey;
  priority: NavigationPriority;
  summary: string;
  step: number | null;
  relatedHref?: string;
};

export const navigationGroups: NavigationGroup[] = [
  { key: 'overview', label: '总览', summary: '先看项目状态和下一步。' },
  { key: 'core', label: '主流程', summary: '沿主链推进，不分心。' },
  { key: 'support', label: '辅助工具', summary: '精修、诊断、交付时再打开。' },
];

export const navigation: NavigationItem[] = [
  { href: '/', label: '总览', section: 'Overview', group: 'overview', priority: 'overview', summary: '统一看当前项目、下一步和主流程进度。', step: null },

  { href: '/idea-lab', label: '创意工坊', section: 'Kickoff', group: 'core', priority: 'core', summary: '从一句话启动项目。', step: 1 },
  { href: '/story-setup', label: '故事设定', section: 'Story', group: 'core', priority: 'core', summary: '稳定 premise、梗概和节拍。', step: 2 },
  { href: '/character-studio', label: '角色与视觉', section: 'World', group: 'core', priority: 'core', summary: '锁角色锚点和视觉方向。', step: 3 },
  { href: '/adaptation-lab', label: '自动分镜', section: 'Storyboard', group: 'core', priority: 'core', summary: '把正文拆成 scene / shot。', step: 4 },
  { href: '/render-studio', label: '生成工作台', section: 'Render', group: 'core', priority: 'core', summary: '生成图片、音轨和视频。', step: 5 },
  { href: '/final-cut', label: '成片预演', section: 'Final Cut', group: 'core', priority: 'core', summary: '检查成片预演是否可拼。', step: 6 },
  { href: '/delivery-center', label: '交付中心', section: 'Delivery', group: 'core', priority: 'core', summary: '导出 bundle 和最终交付。', step: 7 },

  { href: '/chapter-studio', label: '章节工作台', section: 'Novel', group: 'support', priority: 'support', summary: '手写或精修正文。', step: null, relatedHref: '/story-setup' },
  { href: '/visual-bible', label: '视觉圣经', section: 'Visual', group: 'support', priority: 'support', summary: '统一风格、镜头和材质。', step: null, relatedHref: '/character-studio' },
  { href: '/reference-lab', label: '参考实验室', section: 'Reference', group: 'support', priority: 'support', summary: '补参考并做定向绑定。', step: null, relatedHref: '/character-studio' },
  { href: '/storyboard', label: '分镜板', section: 'Storyboard Detail', group: 'support', priority: 'support', summary: '逐镜头精修提示词。', step: null, relatedHref: '/adaptation-lab' },
  { href: '/timeline', label: '时间线', section: 'Timeline', group: 'support', priority: 'support', summary: '校节奏和时长。', step: null, relatedHref: '/adaptation-lab' },
  { href: '/assets', label: '资产中心', section: 'Assets', group: 'support', priority: 'support', summary: '回看全部资产沉淀。', step: null, relatedHref: '/render-studio' },
  { href: '/render-runs', label: '运行诊断', section: 'Diagnostics', group: 'support', priority: 'support', summary: '排查 Provider 与任务异常。', step: null, relatedHref: '/render-studio' },
  { href: '/qa-panel', label: '质量检查', section: 'QA', group: 'support', priority: 'support', summary: '交付前先看阻断项。', step: null, relatedHref: '/final-cut' },
  { href: '/settings', label: '设置', section: 'Settings', group: 'support', priority: 'support', summary: '查看模型与 Provider 配置。', step: null, relatedHref: '/delivery-center' },
];

export function getNavigationItem(pathname: string) {
  return navigation.find((item) => item.href === pathname) || navigation[0];
}

export function getNavigationGroup(key: NavigationGroupKey) {
  return navigationGroups.find((group) => group.key === key) || navigationGroups[0];
}

export function getPrimaryNavigation() {
  return navigation.filter((item) => item.priority === 'core');
}

export function getSupportNavigation() {
  return navigation.filter((item) => item.priority === 'support');
}

export function getRelatedPrimaryNavigation(pathname: string) {
  const currentItem = getNavigationItem(pathname);
  if (currentItem.priority === 'core') return currentItem;
  if (!currentItem.relatedHref) return null;
  return navigation.find((item) => item.href === currentItem.relatedHref) || null;
}

export function getAdjacentNavigation(pathname: string) {
  const workflowItems = getPrimaryNavigation();
  const currentItem = getNavigationItem(pathname);
  const activeHref = currentItem.priority === 'core'
    ? currentItem.href
    : currentItem.relatedHref || '';
  const currentIndex = workflowItems.findIndex((item) => item.href === activeHref);

  if (currentIndex < 0) {
    return {
      previous: null,
      next: workflowItems[0] || null,
    };
  }

  return {
    previous: workflowItems[currentIndex - 1] || null,
    next: workflowItems[currentIndex + 1] || null,
  };
}

export function getNavigationByGroup() {
  return navigationGroups.map((group) => ({
    ...group,
    items: navigation.filter((item) => item.group === group.key),
  }));
}

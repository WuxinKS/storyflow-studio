export const appMeta = {
  name: 'StoryFlow Studio',
  tagline: '把一句想法推进成可交付成片',
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
  { key: 'overview', label: '总览', summary: '先看当前项目、下一步动作和整体进度。' },
  { key: 'core', label: '主流程', summary: '优先沿着这条链推进，一句话到成片就在这里闭环。' },
  { key: 'support', label: '辅助工具', summary: '只有在精修、诊断和交付时再按需打开。' },
];

export const navigation: NavigationItem[] = [
  { href: '/', label: '总览', section: 'Overview', group: 'overview', priority: 'overview', summary: '统一查看当前项目、下一步动作和主流程进度。', step: null },

  { href: '/idea-lab', label: '创意工坊', section: 'Kickoff', group: 'core', priority: 'core', summary: '从一句话创意启动项目，并决定是否一键推进整条主链。', step: 1 },
  { href: '/story-setup', label: '故事设定', section: 'Story', group: 'core', priority: 'core', summary: '先稳定 premise、梗概、节拍和故事基础，再继续进入正文。', step: 2 },
  { href: '/character-studio', label: '角色与视觉', section: 'World', group: 'core', priority: 'core', summary: '锁定角色认知和视觉方向，让后续分镜与生成不再漂移。', step: 3 },
  { href: '/adaptation-lab', label: '自动分镜', section: 'Storyboard', group: 'core', priority: 'core', summary: '把小说正文拆成 scene / shot，形成后续生成的核心输入。', step: 4 },
  { href: '/render-studio', label: '生成工作台', section: 'Render', group: 'core', priority: 'core', summary: '执行图片、音轨和视频任务，并把产物回流到统一媒体链。', step: 5 },
  { href: '/final-cut', label: '成片预演', section: 'Final Cut', group: 'core', priority: 'core', summary: '先判断能不能拼，再按时间线检查成片预演结果。', step: 6 },
  { href: '/delivery-center', label: '交付中心', section: 'Delivery', group: 'core', priority: 'core', summary: '集中查看 bundle、预演成片、日志和最终交付包。', step: 7 },

  { href: '/chapter-studio', label: '章节工作台', section: 'Novel', group: 'support', priority: 'support', summary: '用于手写、改写或精修正文，不是主流程入口。', step: null, relatedHref: '/story-setup' },
  { href: '/visual-bible', label: '视觉圣经', section: 'Visual', group: 'support', priority: 'support', summary: '专门统一色彩、光线、镜头语言和材质关键词。', step: null, relatedHref: '/character-studio' },
  { href: '/reference-lab', label: '参考实验室', section: 'Reference', group: 'support', priority: 'support', summary: '只有需要定向绑定参考时再打开。', step: null, relatedHref: '/character-studio' },
  { href: '/storyboard', label: '分镜板', section: 'Storyboard Detail', group: 'support', priority: 'support', summary: '适合逐镜头精调提示词、导演语言和参考信息。', step: null, relatedHref: '/adaptation-lab' },
  { href: '/timeline', label: '时间线', section: 'Timeline', group: 'support', priority: 'support', summary: '适合校节奏、修时长和检查高潮点分布。', step: null, relatedHref: '/adaptation-lab' },
  { href: '/assets', label: '资产中心', section: 'Assets', group: 'support', priority: 'support', summary: '统一查看角色、参考、图片、音频和视频沉淀。', step: null, relatedHref: '/render-studio' },
  { href: '/render-runs', label: '运行诊断', section: 'Diagnostics', group: 'support', priority: 'support', summary: 'Provider 出错、轮询异常或结果不落库时再看。', step: null, relatedHref: '/render-studio' },
  { href: '/qa-panel', label: '质量检查', section: 'QA', group: 'support', priority: 'support', summary: '交付前统一看阻断项、成熟度和风险提示。', step: null, relatedHref: '/final-cut' },
  { href: '/settings', label: '设置', section: 'Settings', group: 'support', priority: 'support', summary: '模型、Provider、导出目录和联调配置都放这里。', step: null, relatedHref: '/delivery-center' },
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

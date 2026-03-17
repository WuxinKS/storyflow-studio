export const appMeta = {
  name: 'StoryFlow Studio',
  tagline: '把一句想法推进成可交付成片',
  description:
    '围绕故事、分镜、生成和交付四段流程，组织一句话创意到成片的完整创作链。',
};

export type NavigationGroupKey = 'overview' | 'intake' | 'story' | 'production' | 'delivery';

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
  summary: string;
  step: number | null;
};

export const navigationGroups: NavigationGroup[] = [
  { key: 'overview', label: '总控台', summary: '看全局状态、主链入口和最近交付。' },
  { key: 'intake', label: '项目启动', summary: '从一句话定义项目目标和输出方向。' },
  { key: 'story', label: '内容定义', summary: '稳定故事、角色、视觉和参考输入。' },
  { key: 'production', label: '制作执行', summary: '把故事推进到镜头、时间线和生成执行。' },
  { key: 'delivery', label: '验收交付', summary: '检查质量、成片预演和最终交付物。' },
];

export const navigation: NavigationItem[] = [
  { href: '/', label: '总览', section: 'Overview', group: 'overview', summary: '总控主链、项目状态和交付总览。', step: null },
  { href: '/idea-lab', label: '创意工坊', section: 'Kickoff', group: 'intake', summary: '定义题材、风格和目标输出，启动新项目。', step: 1 },
  { href: '/story-setup', label: '故事设定', section: 'Story', group: 'story', summary: '稳定 premise、梗概、节拍和分场基础。', step: 2 },
  { href: '/chapter-studio', label: '章节工作台', section: 'Novel', group: 'story', summary: '把故事骨架扩展成可改写的长文本正文。', step: 3 },
  { href: '/character-studio', label: '角色工作台', section: 'Character', group: 'story', summary: '锁定主角、对手和关键配角的角色认知。', step: 4 },
  { href: '/visual-bible', label: '视觉圣经', section: 'Visual', group: 'story', summary: '统一色彩、光线、镜头语言和运动约束。', step: 5 },
  { href: '/reference-lab', label: '参考实验室', section: 'Reference', group: 'story', summary: '整理参考镜头，并绑定到场次或镜头。', step: 6 },
  { href: '/adaptation-lab', label: '改编实验室', section: 'Adaptation', group: 'production', summary: '把小说和故事结构拆成 scene 与 shot。', step: 7 },
  { href: '/storyboard', label: '分镜板', section: 'Storyboard', group: 'production', summary: '按镜头查看构图、提示词和视觉预演。', step: 8 },
  { href: '/timeline', label: '时间线', section: 'Timeline', group: 'production', summary: '检查节奏、高潮点和镜头时长分布。', step: 9 },
  { href: '/assets', label: '资产中心', section: 'Assets', group: 'production', summary: '沉淀角色、场景、道具和生成媒体资产。', step: 10 },
  { href: '/render-studio', label: '生成工作台', section: 'Render', group: 'production', summary: '执行图像、语音和视频任务，并沉淀工件。', step: 11 },
  { href: '/render-runs', label: '运行诊断', section: 'Diagnostics', group: 'production', summary: '回看 provider 请求、响应和轮询状态。', step: 12 },
  { href: '/qa-panel', label: '质量检查', section: 'QA', group: 'delivery', summary: '识别阻断项、过期链路和交付成熟度。', step: 13 },
  { href: '/final-cut', label: '成片预演', section: 'Final Cut', group: 'delivery', summary: '把镜头和音轨拼成可复验的预演成片。', step: 14 },
  { href: '/delivery-center', label: '交付中心', section: 'Delivery', group: 'delivery', summary: '集中查看 bundle、zip 和最终交付物。', step: 15 },
  { href: '/settings', label: '设置', section: 'Settings', group: 'delivery', summary: '检查模型、provider、导出目录和运行配置。', step: 16 },
];

export function getNavigationItem(pathname: string) {
  return navigation.find((item) => item.href === pathname) || navigation[0];
}

export function getNavigationGroup(key: NavigationGroupKey) {
  return navigationGroups.find((group) => group.key === key) || navigationGroups[0];
}

export function getAdjacentNavigation(pathname: string) {
  const workflowItems = navigation.filter((item) => item.step !== null);
  const currentIndex = workflowItems.findIndex((item) => item.href === pathname);
  if (currentIndex < 0) {
    return {
      previous: workflowItems[0] || null,
      next: workflowItems[1] || null,
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

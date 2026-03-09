export const dashboardHighlights = [
  '双入口：想法驱动 + 参考驱动',
  '统一故事资产：世界观、角色、章节、scene、shot',
  '导演参考模式：从截图/样片反推镜头语言与提示词',
  '已接通 PostgreSQL + Prisma，支持真实项目/章节读写',
];

export type StageStatus = 'done' | 'active' | 'planned';

export type Stage = {
  name: string;
  description: string;
  status: StageStatus;
};

export const pipelineStages: Stage[] = [
  { name: 'Idea', description: '输入创意、关键词与目标输出', status: 'done' },
  { name: 'Story', description: '生成世界观、角色、大纲与章节', status: 'active' },
  { name: 'Adaptation', description: '把长文本改编成 scene / shot', status: 'active' },
  { name: 'Storyboard', description: '编辑镜头与生成分镜', status: 'planned' },
  { name: 'Render', description: '生成视频、配音与导出成片', status: 'planned' },
];

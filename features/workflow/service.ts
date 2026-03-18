import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getLatestOutlineByTitle } from '@/lib/outline-store';
import { getGeneratedMediaEntries, summarizeGeneratedMediaCounts } from '@/features/media/service';
import { PIPELINE_RUN_LOG_TITLE, parsePipelineRunLog } from '@/features/pipeline/service';
import { isGeneratedNovelChapterTitle, isStoryEngineChapterTitle } from '@/features/story/service';

export type WorkflowStageStatus = 'completed' | 'active' | 'pending' | 'attention';

export type WorkflowStageCard = {
  key: string;
  title: string;
  href: string;
  status: WorkflowStageStatus;
  summary: string;
  detail: string;
  badges: string[];
  supportLinks: Array<{
    label: string;
    href: string;
  }>;
};

export type WorkflowSupportTool = {
  label: string;
  href: string;
  summary: string;
  badge: string;
};

export type WorkflowGuide = {
  project: {
    id: string;
    title: string;
    premise: string;
    stage: string;
  };
  progress: {
    completedStages: number;
    totalStages: number;
    ratio: number;
    label: string;
  };
  counts: {
    chapters: number;
    aiChapters: number;
    scenes: number;
    shots: number;
    references: number;
    renderJobs: number;
    generatedMedia: number;
    generatedVideos: number;
  };
  nextAction: {
    title: string;
    href: string;
    description: string;
    buttonLabel: string;
  };
  latestRun: {
    status: 'completed' | 'failed' | null;
    mode: 'prepare' | 'full' | null;
    completedSteps: number;
    failedSteps: number;
    finishedAt: string | null;
    previewReady: boolean;
    bundleReady: boolean;
    qaReady: boolean;
  };
  stages: WorkflowStageCard[];
  supportTools: WorkflowSupportTool[];
};

type WorkflowProject = Awaited<ReturnType<typeof getWorkflowProject>>;

async function getWorkflowProject(projectId?: string) {
  const include = Prisma.validator<Prisma.ProjectInclude>()({
    chapters: { orderBy: { orderIndex: 'asc' } },
    scenes: { orderBy: { orderIndex: 'asc' } },
    shots: { orderBy: [{ sceneId: 'asc' }, { orderIndex: 'asc' }] },
    renderJobs: { orderBy: { createdAt: 'desc' } },
    references: { orderBy: { createdAt: 'desc' } },
    outlines: { orderBy: { createdAt: 'desc' } },
  });

  return projectId
    ? prisma.project.findUnique({
        where: { id: projectId },
        include,
      })
    : prisma.project.findFirst({
        orderBy: { updatedAt: 'desc' },
        include,
      });
}

function toPercent(part: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

function stageStatusValue(status: WorkflowStageStatus) {
  if (status === 'completed') return 3;
  if (status === 'attention') return 2;
  if (status === 'active') return 1;
  return 0;
}

function summarizeRenderJobs(project: WorkflowProject) {
  const jobs = project?.renderJobs || [];
  return {
    total: jobs.length,
    queued: jobs.filter((job) => job.status === 'queued').length,
    running: jobs.filter((job) => job.status === 'running').length,
    done: jobs.filter((job) => job.status === 'done').length,
    failed: jobs.filter((job) => job.status === 'failed').length,
  };
}

function buildLatestRunState(project: WorkflowProject) {
  const latestRunOutline = getLatestOutlineByTitle(project?.outlines || [], PIPELINE_RUN_LOG_TITLE);
  const latestRun = parsePipelineRunLog(latestRunOutline?.summary || '');

  return {
    status: latestRun?.status || null,
    mode: latestRun?.mode || null,
    completedSteps: latestRun?.steps.filter((step) => step.status === 'completed').length || 0,
    failedSteps: latestRun?.steps.filter((step) => step.status === 'failed').length || 0,
    finishedAt: latestRun?.finishedAt || null,
    previewReady: Boolean(latestRun?.steps.some((step) => step.key === 'final-cut-assemble' && step.status === 'completed')),
    bundleReady: Boolean(latestRun?.steps.some((step) => step.key === 'production-bundle' && step.status === 'completed')),
    qaReady: Boolean(latestRun?.steps.some((step) => step.key === 'qa-summary' && step.status === 'completed')),
  } as const;
}

function buildStageCards(project: WorkflowProject) {
  if (!project) return [] as WorkflowStageCard[];

  const visibleChapters = project.chapters.filter((chapter) => !isStoryEngineChapterTitle(chapter.title));
  const aiChapters = visibleChapters.filter((chapter) => isGeneratedNovelChapterTitle(chapter.title));
  const hasStorySynopsis = Boolean(getLatestOutlineByTitle(project.outlines, 'Story Engine Synopsis'));
  const hasBeatSheet = Boolean(getLatestOutlineByTitle(project.outlines, 'Story Engine Beat Sheet'));
  const hasCharacterDrafts = Boolean(getLatestOutlineByTitle(project.outlines, 'Character Drafts'));
  const hasVisualBible = Boolean(getLatestOutlineByTitle(project.outlines, 'Visual Bible'));
  const generatedMedia = getGeneratedMediaEntries(project);
  const mediaCounts = summarizeGeneratedMediaCounts(generatedMedia);
  const render = summarizeRenderJobs(project);
  const latestRun = buildLatestRunState(project);

  const kickoffComplete = Boolean(project.title.trim() && (project.premise || '').trim());
  const storyComplete = hasStorySynopsis && visibleChapters.length > 0;
  const worldComplete = hasCharacterDrafts && hasVisualBible;
  const storyboardComplete = project.scenes.length > 0 && project.shots.length > 0;
  const renderComplete = render.done > 0 && mediaCounts.total > 0;
  const finalCutComplete = latestRun.previewReady;
  const deliveryComplete = latestRun.bundleReady;

  return [
    {
      key: 'kickoff',
      title: '项目启动',
      href: '/idea-lab',
      status: kickoffComplete ? 'completed' : 'active',
      summary: kickoffComplete ? '项目方向已经明确。' : '先把一句话创意、题材和输出目标说清楚。',
      detail: kickoffComplete ? `当前项目已经锁定为“${project.title}”。` : '项目还没有稳定前提，先别急着进入后面的生成页。',
      badges: [
        project.premise ? '已有一句话创意' : '待补创意',
        project.genre ? `题材 ${project.genre}` : '题材未设定',
      ],
      supportLinks: [],
    },
    {
      key: 'story',
      title: '小说与故事',
      href: '/story-setup',
      status: storyComplete ? 'completed' : kickoffComplete ? 'active' : 'pending',
      summary: storyComplete ? '故事骨架和正文已经具备。' : '先把 synopsis、节拍和至少一章正文拉出来。',
      detail: storyComplete
        ? `当前已有 ${visibleChapters.length} 章可用正文，其中 AI 正文 ${aiChapters.length} 章。`
        : hasStorySynopsis
          ? '故事骨架已经生成，但正文还不够，适合继续补 AI 小说章节或手写章节。'
          : '先从故事设定页生成故事骨架，再进入章节阶段。',
      badges: [
        hasStorySynopsis ? '已有梗概' : '待生成梗概',
        hasBeatSheet ? '已有节拍' : '待生成节拍',
        `正文 ${visibleChapters.length}`,
      ],
      supportLinks: [
        { label: '章节工作台', href: '/chapter-studio' },
      ],
    },
    {
      key: 'world',
      title: '角色与视觉',
      href: '/character-studio',
      status: worldComplete ? 'completed' : storyComplete ? 'active' : 'pending',
      summary: worldComplete ? '角色和风格约束已经成型。' : '先把角色认知和视觉圣经稳定下来。',
      detail: worldComplete
        ? '后面的自动分镜、图片和视频生成都会围绕这套角色 / 视觉共识继续。'
        : `${hasCharacterDrafts ? '角色草案已具备，继续补视觉圣经。' : '角色草案还没稳定。'}${hasVisualBible ? '视觉圣经已具备。' : ' 视觉圣经还没建立。'}`,
      badges: [
        hasCharacterDrafts ? '角色已生成' : '待生成角色',
        hasVisualBible ? '视觉已建立' : '待建立视觉',
        project.references.length > 0 ? `参考 ${project.references.length}` : '参考可后补',
      ],
      supportLinks: [
        { label: '视觉圣经', href: '/visual-bible' },
        { label: '参考实验室', href: '/reference-lab' },
      ],
    },
    {
      key: 'storyboard',
      title: '自动分镜',
      href: '/adaptation-lab',
      status: storyboardComplete ? 'completed' : worldComplete || storyComplete ? 'active' : 'pending',
      summary: storyboardComplete ? 'scene / shot 结构已经具备。' : '把长文本拆成 scene / shot，再决定镜头节奏。',
      detail: storyboardComplete
        ? `当前已有 ${project.scenes.length} 个分场、${project.shots.length} 个镜头。`
        : project.scenes.length > 0
          ? `当前只有 ${project.scenes.length} 个分场，还需要继续补镜头。`
          : '还没有结构化的分场与镜头，先从自动分镜开始。',
      badges: [
        `分场 ${project.scenes.length}`,
        `镜头 ${project.shots.length}`,
        project.shots.length > 0 ? '可继续进生成' : '待完成拆镜',
      ],
      supportLinks: [
        { label: '分镜板', href: '/storyboard' },
        { label: '时间线', href: '/timeline' },
      ],
    },
    {
      key: 'render',
      title: '图片 / 音轨 / 视频生成',
      href: '/render-studio',
      status: render.failed > 0 ? 'attention' : renderComplete ? 'completed' : storyboardComplete ? 'active' : 'pending',
      summary: render.failed > 0
        ? '当前有失败任务，先处理阻塞项。'
        : renderComplete
          ? '已经有生成结果回流。'
          : '开始让镜头变成图片、音频和视频结果。',
      detail: render.failed > 0
        ? `当前失败 ${render.failed} 个、执行中 ${render.running} 个、排队 ${render.queued} 个。`
        : renderComplete
          ? `已沉淀 ${mediaCounts.total} 条媒体结果，其中视频 ${mediaCounts.videos} 条。`
          : render.total > 0
            ? `当前已有 ${render.total} 个渲染任务，但还没沉淀出足够的媒体结果。`
            : '还没有渲染任务，进入生成工作台后就能开始跑图片 / 音轨 / 视频。',
      badges: [
        `任务 ${render.total}`,
        `产物 ${mediaCounts.total}`,
        `视频 ${mediaCounts.videos}`,
      ],
      supportLinks: [
        { label: '运行诊断', href: '/render-runs' },
        { label: '资产中心', href: '/assets' },
      ],
    },
    {
      key: 'final-cut',
      title: '成片预演与交付',
      href: '/final-cut',
      status: deliveryComplete ? 'completed' : finalCutComplete || renderComplete ? 'active' : 'pending',
      summary: deliveryComplete
        ? '预演成片和交付包已经准备好。'
        : finalCutComplete
          ? '预演成片已经生成，可以继续交付。'
          : renderComplete
            ? '已经到了该检查 final cut 的阶段。'
            : '等生成结果稳定后，再进入成片预演。',
      detail: deliveryComplete
        ? '当前已经具备成片预演和交付包，适合做最终复验或导出。'
        : latestRun.previewReady
          ? 'final cut 预演已经跑过，下一步更适合进交付中心确认成品。'
          : mediaCounts.videos > 0
            ? '已经有视频片段可用，建议进入 final cut 检查装配状态。'
            : '当前还没有足够的视频结果，成片阶段先不用着急打开太多辅助页。',
      badges: [
        latestRun.previewReady ? '预演已生成' : '预演待生成',
        latestRun.bundleReady ? '交付包已导出' : '交付包待导出',
        latestRun.qaReady ? 'QA 已复验' : 'QA 待复验',
      ],
      supportLinks: [
        { label: '质量检查', href: '/qa-panel' },
        { label: '交付中心', href: '/delivery-center' },
        { label: '设置', href: '/settings' },
      ],
    },
  ] satisfies WorkflowStageCard[];
}

function buildNextAction(project: WorkflowProject, stages: WorkflowStageCard[]) {
  if (!project) {
    return {
      title: '先创建第一个项目',
      href: '/idea-lab',
      description: '把一句话创意写下来，系统才能开始生成小说、分镜和视频链路。',
      buttonLabel: '开始创建项目',
    };
  }

  const render = summarizeRenderJobs(project);
  const generatedMedia = getGeneratedMediaEntries(project);
  const mediaCounts = summarizeGeneratedMediaCounts(generatedMedia);
  const hasCharacterDrafts = Boolean(getLatestOutlineByTitle(project.outlines, 'Character Drafts'));
  const hasVisualBible = Boolean(getLatestOutlineByTitle(project.outlines, 'Visual Bible'));
  const hasStorySynopsis = Boolean(getLatestOutlineByTitle(project.outlines, 'Story Engine Synopsis'));
  const visibleChapters = project.chapters.filter((chapter) => !isStoryEngineChapterTitle(chapter.title));
  const latestRun = buildLatestRunState(project);

  if (!(project.premise || '').trim()) {
    return {
      title: '先把项目目标说清楚',
      href: '/idea-lab',
      description: '先补一句话创意、题材和输出方向，后面的主流程才不会飘。',
      buttonLabel: '回到创意工坊',
    };
  }

  if (!hasStorySynopsis || visibleChapters.length === 0) {
    return {
      title: '先把故事正文拉出来',
      href: hasStorySynopsis ? '/chapter-studio' : '/story-setup',
      description: hasStorySynopsis ? '故事骨架已经有了，现在最缺的是可继续改编的正文。' : '先生成故事梗概和结构节拍，再继续进入正文。',
      buttonLabel: hasStorySynopsis ? '去章节工作台' : '去故事设定',
    };
  }

  if (!hasCharacterDrafts || !hasVisualBible) {
    return {
      title: '先稳定角色和视觉共识',
      href: !hasCharacterDrafts ? '/character-studio' : '/visual-bible',
      description: '角色和视觉是后面自动分镜、图片与视频生成的共同约束，越早稳定越省返工。',
      buttonLabel: !hasCharacterDrafts ? '去角色工作台' : '去视觉圣经',
    };
  }

  if (project.scenes.length === 0 || project.shots.length === 0) {
    return {
      title: '开始自动分镜',
      href: '/adaptation-lab',
      description: '先把小说和故事结构拆成 scene / shot，后面生成阶段才有清晰输入。',
      buttonLabel: '去自动分镜',
    };
  }

  if (render.failed > 0) {
    return {
      title: '先清理失败任务',
      href: '/render-studio',
      description: `当前有 ${render.failed} 个失败任务，会直接卡住后面的成片链。`,
      buttonLabel: '去处理生成失败',
    };
  }

  if (mediaCounts.total === 0 || render.total === 0) {
    return {
      title: '开始生成图片、音轨和视频',
      href: '/render-studio',
      description: '现在已经具备分镜输入，可以正式推进图片、语音和视频任务。',
      buttonLabel: '去生成工作台',
    };
  }

  if (!latestRun.previewReady) {
    return {
      title: '进入成片预演',
      href: '/final-cut',
      description: mediaCounts.videos > 0 ? '已经有视频片段，适合检查 final cut 装配状态。' : '先用当前视觉结果做预演，确认节奏和结构。',
      buttonLabel: '去成片预演',
    };
  }

  if (!latestRun.bundleReady) {
    return {
      title: '导出交付包',
      href: '/delivery-center',
      description: '预演已经跑通，下一步更适合整理 bundle、日志和最终交付文件。',
      buttonLabel: '去交付中心',
    };
  }

  const lastStage = stages[stages.length - 1];
  return {
    title: '查看最终交付结果',
    href: lastStage?.href || '/delivery-center',
    description: '当前主流程已经基本闭环，可以继续复验、导出或开始下一轮精修。',
    buttonLabel: '查看交付结果',
  };
}

function buildSupportTools(project: WorkflowProject) {
  if (!project) return [] as WorkflowSupportTool[];

  const visibleChapters = project.chapters.filter((chapter) => !isStoryEngineChapterTitle(chapter.title));
  const generatedMedia = getGeneratedMediaEntries(project);
  const mediaCounts = summarizeGeneratedMediaCounts(generatedMedia);
  const render = summarizeRenderJobs(project);

  return [
    {
      label: '章节工作台',
      href: '/chapter-studio',
      summary: '适合手动改写正文、补章节，或者把 AI 正文继续精修成人写版本。',
      badge: visibleChapters.length > 0 ? `${visibleChapters.length} 章可用` : '待补正文',
    },
    {
      label: '视觉圣经',
      href: '/visual-bible',
      summary: '专门统一色彩、镜头语言、材质和运动风格，减少后面画风漂移。',
      badge: getLatestOutlineByTitle(project.outlines, 'Visual Bible') ? '已建立' : '待建立',
    },
    {
      label: '参考实验室',
      href: '/reference-lab',
      summary: '只有当你需要给某个场次或镜头做定向参考时再打开。',
      badge: project.references.length > 0 ? `${project.references.length} 条参考` : '暂无参考',
    },
    {
      label: '分镜板',
      href: '/storyboard',
      summary: '适合逐镜头细调提示词、构图和导演语言，而不是作为主入口。',
      badge: project.shots.length > 0 ? `${project.shots.length} 镜头` : '待生成镜头',
    },
    {
      label: '时间线',
      href: '/timeline',
      summary: '只有需要校节奏、时长和高潮点时再进，不用一开始就打开。',
      badge: project.scenes.length > 0 ? `${project.scenes.length} 个分场` : '待生成结构',
    },
    {
      label: '资产中心',
      href: '/assets',
      summary: '统一收口角色、参考、图片、音轨和视频资产，适合中后段回看。',
      badge: mediaCounts.total > 0 ? `${mediaCounts.total} 条产物` : '待沉淀资产',
    },
    {
      label: '运行诊断',
      href: '/render-runs',
      summary: '只有当 Provider 出错、轮询异常或结果不落库时再打开。',
      badge: render.failed > 0 ? `${render.failed} 个失败` : '按需查看',
    },
    {
      label: '质量检查',
      href: '/qa-panel',
      summary: '适合进入交付前统一排查阻断项，而不是日常主入口。',
      badge: mediaCounts.videos > 0 ? '可开始复验' : '等待成片结果',
    },
    {
      label: '设置',
      href: '/settings',
      summary: '模型、Provider、导出目录和调试配置都放这里，需要时再进。',
      badge: '按需配置',
    },
  ] satisfies WorkflowSupportTool[];
}

export async function getWorkflowGuide(projectId?: string): Promise<WorkflowGuide | null> {
  const project = await getWorkflowProject(projectId);
  if (!project) return null;

  const visibleChapters = project.chapters.filter((chapter) => !isStoryEngineChapterTitle(chapter.title));
  const aiChapters = visibleChapters.filter((chapter) => isGeneratedNovelChapterTitle(chapter.title));
  const generatedMedia = getGeneratedMediaEntries(project);
  const mediaCounts = summarizeGeneratedMediaCounts(generatedMedia);
  const stages = buildStageCards(project);
  const completedStages = stages.filter((stage) => stage.status === 'completed').length;
  const nextAction = buildNextAction(project, stages);
  const latestRun = buildLatestRunState(project);

  return {
    project: {
      id: project.id,
      title: project.title,
      premise: project.premise || project.description || '还没有项目摘要',
      stage: project.stage,
    },
    progress: {
      completedStages,
      totalStages: stages.length,
      ratio: toPercent(completedStages, stages.length),
      label: `主流程完成 ${completedStages} / ${stages.length}`,
    },
    counts: {
      chapters: visibleChapters.length,
      aiChapters: aiChapters.length,
      scenes: project.scenes.length,
      shots: project.shots.length,
      references: project.references.length,
      renderJobs: project.renderJobs.length,
      generatedMedia: mediaCounts.total,
      generatedVideos: mediaCounts.videos,
    },
    nextAction,
    latestRun,
    stages,
    supportTools: buildSupportTools(project),
  };
}

export function getStageToneLabel(status: WorkflowStageStatus) {
  if (status === 'completed') return '已完成';
  if (status === 'attention') return '需处理';
  if (status === 'active') return '当前应做';
  return '稍后再做';
}

export function getWorkflowPrimaryStage(guide: WorkflowGuide) {
  return guide.stages.reduce((current, stage) => {
    if (!current) return stage;
    return stageStatusValue(stage.status) > stageStatusValue(current.status) ? stage : current;
  }, guide.stages[0] || null);
}

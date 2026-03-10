import path from 'node:path';
import { prisma } from '@/lib/prisma';
import { createOutlineVersion } from '@/lib/outline-store';
import { generateStoryDraft, isGeneratedNovelChapterTitle } from '@/features/story/service';
import { generateCharacterDrafts } from '@/features/characters/service';
import { generateVisualBible } from '@/features/visual/service';
import { generateAdaptationFromLatestChapter } from '@/features/adaptation/service';
import { getQaReport } from '@/features/qa/service';
import { createRenderJobsForLatestProject, exportProductionBundle, runRenderJobs } from '@/features/render/service';

export const PIPELINE_RUN_LOG_TITLE = 'Pipeline Run Log';

export type PipelineRunMode = 'prepare' | 'full';
export type PipelineStepStatus = 'completed' | 'failed' | 'skipped';

export type PipelineStep = {
  key: string;
  label: string;
  status: PipelineStepStatus;
  detail: string;
  startedAt: string;
  endedAt: string;
};

export type PipelineRunLog = {
  version: 1;
  projectId: string;
  mode: PipelineRunMode;
  status: 'completed' | 'failed';
  startedAt: string;
  finishedAt: string;
  steps: PipelineStep[];
  error?: string;
};

function nowIso() {
  return new Date().toISOString();
}

function createStep(input: Omit<PipelineStep, 'startedAt' | 'endedAt'> & { startedAt?: string; endedAt?: string }) {
  return {
    startedAt: input.startedAt || nowIso(),
    endedAt: input.endedAt || nowIso(),
    ...input,
  } satisfies PipelineStep;
}

function serializePipelineRunLog(log: PipelineRunLog) {
  return JSON.stringify(log, null, 2);
}

export function parsePipelineRunLog(summary: string | null | undefined) {
  if (!summary) return null;
  try {
    const parsed = JSON.parse(summary) as Partial<PipelineRunLog>;
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.steps)) return null;
    return {
      version: 1,
      projectId: String(parsed.projectId || ''),
      mode: parsed.mode === 'prepare' ? 'prepare' : 'full',
      status: parsed.status === 'failed' ? 'failed' : 'completed',
      startedAt: String(parsed.startedAt || ''),
      finishedAt: String(parsed.finishedAt || ''),
      steps: parsed.steps.map((step) => ({
        key: String(step.key || ''),
        label: String(step.label || ''),
        status: step.status === 'failed' ? 'failed' : step.status === 'skipped' ? 'skipped' : 'completed',
        detail: String(step.detail || ''),
        startedAt: String(step.startedAt || ''),
        endedAt: String(step.endedAt || ''),
      })),
      error: parsed.error ? String(parsed.error) : undefined,
    } satisfies PipelineRunLog;
  } catch {
    return null;
  }
}

async function getPipelineProject(projectId: string) {
  return prisma.project.findUnique({
    where: { id: projectId },
    include: {
      chapters: { orderBy: { orderIndex: 'asc' } },
      scenes: { orderBy: { orderIndex: 'asc' } },
      shots: { orderBy: [{ sceneId: 'asc' }, { orderIndex: 'asc' }] },
      renderJobs: { orderBy: { createdAt: 'desc' } },
      references: { orderBy: { createdAt: 'desc' } },
      outlines: { orderBy: { createdAt: 'desc' } },
    },
  });
}

async function recordPipelineRun(log: PipelineRunLog) {
  await createOutlineVersion(log.projectId, PIPELINE_RUN_LOG_TITLE, serializePipelineRunLog(log));
}

export async function runProjectPipeline(projectId: string, options?: { mode?: PipelineRunMode }) {
  const mode = options?.mode || 'full';
  const steps: PipelineStep[] = [];
  const startedAt = nowIso();
  let finalError: string | undefined;

  const runStep = async <T>(key: string, label: string, work: () => Promise<T>, describe: (result: T) => string) => {
    const stepStartedAt = nowIso();
    try {
      const result = await work();
      steps.push(createStep({
        key,
        label,
        status: 'completed',
        detail: describe(result),
        startedAt: stepStartedAt,
        endedAt: nowIso(),
      }));
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      steps.push(createStep({
        key,
        label,
        status: 'failed',
        detail: message,
        startedAt: stepStartedAt,
        endedAt: nowIso(),
      }));
      throw error;
    }
  };

  try {
    const storyProject = await runStep('story-draft', '故事骨架', () => generateStoryDraft(projectId), () => '已生成故事梗概、结构节拍、分场种子，并同步刷新 AI 小说章节。');

    const aiChapterCount = storyProject?.chapters.filter((chapter) => isGeneratedNovelChapterTitle(chapter.title)).length || 0;
    steps.push(createStep({
      key: 'novel-chapters',
      label: '小说章节',
      status: 'completed',
      detail: `已同步生成 ${aiChapterCount} 章 AI 小说正文。`,
    }));

    await runStep('characters', '角色草案', () => generateCharacterDrafts(projectId), () => '已生成并更新角色草案。');
    await runStep('visual-bible', '视觉圣经', () => generateVisualBible(projectId), () => '已生成并更新视觉圣经。');

    await runStep('adaptation', '自动分镜', () => generateAdaptationFromLatestChapter(projectId), (project) => {
      const sceneCount = project?.scenes.length || 0;
      const shotCount = project?.shots.length || 0;
      return `已生成 ${sceneCount} 个分场、${shotCount} 个镜头。`;
    });
    await prisma.project.update({ where: { id: projectId }, data: { stage: 'ADAPTATION' } });

    await runStep('render-jobs', '渲染任务', () => createRenderJobsForLatestProject(projectId), (project) => {
      const jobCount = project?.renderJobs.length || 0;
      return `已创建 ${jobCount} 个渲染任务。`;
    });

    if (mode === 'full') {
      const renderProject = await runStep('render-execution', '执行生成', () => runRenderJobs(projectId), (project) => {
        const done = project?.renderJobs.filter((job) => job.status === 'done').length || 0;
        const failed = project?.renderJobs.filter((job) => job.status === 'failed').length || 0;
        return failed > 0 ? `已执行渲染任务，但仍有 ${failed} 个任务失败。` : `已完成 ${done} 个渲染任务执行。`;
      });
      if (renderProject?.renderJobs.some((job) => job.status === 'failed')) {
        throw new Error('部分渲染任务执行失败，请到生成工作台查看错误详情。');
      }

      const bundle = await runStep('production-bundle', '导出交付包', () => exportProductionBundle(projectId), (result) => {
        return `已生成交付包 ${path.basename(result.zipPath)}，目录 ${result.bundleDir}。`;
      });

      await runStep('qa-summary', '质量结论', () => getQaReport(projectId, { bundleExport: bundle }), (report) => {
        if (!report) return '当前还没有可用 QA 数据。';
        const blockerText = report.summary.blockerLabels.join(' / ') || '无阻断项';
        return `成熟度：${report.summary.maturity}｜通过 ${report.summary.passed}/${report.summary.total}｜阻断项：${report.summary.blockerCount}（${blockerText}）。`;
      });
    } else {
      steps.push(createStep({
        key: 'render-execution',
        label: '执行生成',
        status: 'skipped',
        detail: '当前模式只准备到渲染任务，不自动执行。',
      }));
      steps.push(createStep({
        key: 'production-bundle',
        label: '导出交付包',
        status: 'skipped',
        detail: '当前模式只准备到渲染任务，不自动导出交付包。',
      }));
      steps.push(createStep({
        key: 'qa-summary',
        label: '质量结论',
        status: 'skipped',
        detail: '当前模式只准备到渲染任务，不自动生成 QA 结论。',
      }));
    }

    await prisma.project.update({ where: { id: projectId }, data: { stage: 'RENDER' } });
  } catch (error) {
    finalError = error instanceof Error ? error.message : 'Unknown error';
  }

  const finishedAt = nowIso();
  const run: PipelineRunLog = {
    version: 1,
    projectId,
    mode,
    status: finalError ? 'failed' : 'completed',
    startedAt,
    finishedAt,
    steps,
    error: finalError,
  };

  await recordPipelineRun(run);
  const project = await getPipelineProject(projectId);

  if (finalError) {
    throw new Error(finalError);
  }

  return { project, run };
}

import { prisma } from '@/lib/prisma';
import { getProjectStageLabel } from '@/lib/display';
import { PIPELINE_RUN_LOG_TITLE, parsePipelineRunLog } from '@/features/pipeline/service';
import {
  isGeneratedNovelChapterTitle,
  isStoryEngineChapterTitle,
} from '@/features/story/service';
import { PipelineRunButton } from '@/components/pipeline-run-button';
import { buildProjectHref } from '@/lib/project-links';
import { buildLocalMediaPreviewHref } from '@/lib/media-preview';
import { getDeliveryCenterData } from '@/features/delivery/service';
import Link from 'next/link';

export async function PipelineCommandCenter({ projectId }: { projectId?: string }) {
  const project = await (projectId
    ? prisma.project.findUnique({
        where: { id: projectId },
        include: {
          chapters: { orderBy: { orderIndex: 'asc' } },
          scenes: { orderBy: { orderIndex: 'asc' } },
          shots: { orderBy: [{ sceneId: 'asc' }, { orderIndex: 'asc' }] },
          renderJobs: { orderBy: { createdAt: 'desc' } },
          references: { orderBy: { createdAt: 'desc' } },
          outlines: { orderBy: { createdAt: 'desc' } },
        },
      })
    : prisma.project.findFirst({
        orderBy: { updatedAt: 'desc' },
        include: {
          chapters: { orderBy: { orderIndex: 'asc' } },
          scenes: { orderBy: { orderIndex: 'asc' } },
          shots: { orderBy: [{ sceneId: 'asc' }, { orderIndex: 'asc' }] },
          renderJobs: { orderBy: { createdAt: 'desc' } },
          references: { orderBy: { createdAt: 'desc' } },
          outlines: { orderBy: { createdAt: 'desc' } },
        },
      })).catch(() => null);

  if (!project) {
    return (
      <div className="snapshot-card">
        <p className="eyebrow">主链控制台</p>
        <h3>还没有可执行项目</h3>
        <p>先去创意工坊创建项目；创建后，这里会直接提供一句话到渲染任务的一键主链入口。</p>
      </div>
    );
  }

  const visibleChapters = project.chapters.filter((chapter) => !isStoryEngineChapterTitle(chapter.title));
  const aiChapterCount = visibleChapters.filter((chapter) => isGeneratedNovelChapterTitle(chapter.title)).length;
  const latestRunOutline = project.outlines.find((outline) => outline.title === PIPELINE_RUN_LOG_TITLE) || null;
  const latestRun = parsePipelineRunLog(latestRunOutline?.summary);
  const completedSteps = latestRun?.steps.filter((step) => step.status === 'completed').length || 0;
  const failedSteps = latestRun?.steps.filter((step) => step.status === 'failed').length || 0;
  const deliveryData = await getDeliveryCenterData(project.id, 1).catch(() => null);
  const latestBundle = deliveryData?.bundles[0] || null;

  return (
    <div className="page-stack">
      <div className="snapshot-card">
        <p className="eyebrow">主链控制台</p>
        <h3>{project.title}</h3>
        <p>从一句话出发，自动串起故事骨架、小说章节、角色、视觉、自动分镜、渲染执行、交付包导出和 QA 结论。若已配置真实 Provider，就能更接近真正的一键成片闭环。</p>
        <div className="meta-list">
          <span>当前阶段：{getProjectStageLabel(project.stage)}</span>
          <span>可用章节：{visibleChapters.length}</span>
          <span>AI 小说：{aiChapterCount}</span>
          <span>分场：{project.scenes.length}</span>
          <span>镜头：{project.shots.length}</span>
          <span>渲染任务：{project.renderJobs.length}</span>
        </div>
        <PipelineRunButton projectId={project.id} />
        <div className="action-row wrap-row">
          <Link href={buildProjectHref('/story-setup', project.id)} className="button-ghost">查看故事设定</Link>
          <Link href={buildProjectHref('/render-studio', project.id)} className="button-secondary">查看生成工作台</Link>
          <Link href={buildProjectHref('/qa-panel', project.id)} className="button-secondary">查看 QA</Link>
        </div>
      </div>

      {latestRun ? (
        <>
          <div className="asset-grid three-up">
            <div className="asset-tile">
              <span className="label">最近一次运行</span>
              <h4>{latestRun.status === 'completed' ? '已完成' : '执行失败'}</h4>
              <p>模式：{latestRun.mode === 'full' ? '完整主链' : '准备到渲染任务'}，结束时间：{latestRun.finishedAt || '未知'}。</p>
              <div className="meta-list">
                <span>完成步骤：{completedSteps}</span>
                <span>失败步骤：{failedSteps}</span>
                <span>总步骤：{latestRun.steps.length}</span>
              </div>
            </div>
            {latestRun.error ? (
              <div className="asset-tile">
                <span className="label">失败原因</span>
                <h4>需要处理</h4>
                <p>{latestRun.error}</p>
              </div>
            ) : null}
            {latestBundle ? (
              <div className="asset-tile">
                <span className="label">最近成片工件</span>
                <h4>{latestBundle.files.finalCutPreviewPath ? '预演成片已就绪' : '预演成片未就绪'}</h4>
                <p>最近导出：{latestBundle.exportedAt || '未知'}；可直接打开成片、日志或跳转交付中心继续复验。</p>
                <div className="action-row wrap-row compact-row">
                  {latestBundle.files.finalCutPreviewPath ? (
                    <a className="button-ghost" href={buildLocalMediaPreviewHref(latestBundle.files.finalCutPreviewPath)} target="_blank" rel="noreferrer">打开预演成片</a>
                  ) : null}
                  {latestBundle.files.finalCutPreviewLogPath ? (
                    <a className="button-ghost" href={buildLocalMediaPreviewHref(latestBundle.files.finalCutPreviewLogPath)} target="_blank" rel="noreferrer">查看拼装日志</a>
                  ) : null}
                  <Link href={buildProjectHref('/delivery-center', project.id)} className="button-ghost">打开交付中心</Link>
                </div>
              </div>
            ) : null}
          </div>

          <div className="asset-grid three-up">
            {latestRun.steps.map((step) => (
              <div key={step.key} className="asset-tile">
                <span className="label">{step.status === 'completed' ? '已完成' : step.status === 'skipped' ? '已跳过' : '失败'}</span>
                <h4>{step.label}</h4>
                <p>{step.detail}</p>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

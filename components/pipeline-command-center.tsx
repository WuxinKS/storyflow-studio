import Link from 'next/link';
import { PipelineRunButton } from '@/components/pipeline-run-button';
import { SectionCard } from '@/components/section-card';
import { getStageToneLabel, getWorkflowGuide } from '@/features/workflow/service';
import { buildProjectHref } from '@/lib/project-links';

export async function PipelineCommandCenter({ projectId }: { projectId?: string }) {
  const guide = await getWorkflowGuide(projectId).catch(() => null);

  if (!guide) {
    return (
      <div className="snapshot-card">
        <p className="eyebrow">主流程</p>
        <h3>先创建项目，再按主流程推进</h3>
        <p>这里会只保留一句话到成片真正需要的主流程步骤，先让人知道从哪里开始，而不是先看到一堆功能入口。</p>
        <div className="action-row wrap-row">
          <Link href="/idea-lab" className="button-primary">去创建项目</Link>
        </div>
      </div>
    );
  }

  const nextHref = buildProjectHref(guide.nextAction.href, guide.project.id);

  return (
    <div className="page-stack">
      <div className="workflow-command-grid">
        <section className="snapshot-card workflow-command-card">
          <div className="workflow-command-head">
            <div>
              <p className="eyebrow">主流程控制台</p>
              <h3>{guide.project.title}</h3>
            </div>
            <span className="status-pill status-pill-subtle">{guide.progress.label}</span>
          </div>

          <p>
            现在首页只保留一个核心问题：<strong>下一步先做什么。</strong>
            先沿着主流程把项目推到下一个阶段，辅助工具只在真的需要时再打开。
          </p>

          <div className="meta-list">
            <span>正文 {guide.counts.chapters}</span>
            <span>AI 正文 {guide.counts.aiChapters}</span>
            <span>分场 {guide.counts.scenes}</span>
            <span>镜头 {guide.counts.shots}</span>
            <span>任务 {guide.counts.renderJobs}</span>
            <span>产物 {guide.counts.generatedMedia}</span>
          </div>

          <div className="asset-tile workflow-next-card">
            <span className="label">当前建议</span>
            <h4>{guide.nextAction.title}</h4>
            <p>{guide.nextAction.description}</p>
            <div className="action-row wrap-row">
              <Link href={nextHref} className="button-primary">{guide.nextAction.buttonLabel}</Link>
              <Link href={buildProjectHref('/final-cut', guide.project.id)} className="button-ghost">查看成片预演</Link>
            </div>
          </div>

          <details className="workflow-disclosure">
            <summary>方向很清楚时，再打开自动推进</summary>
            <div className="workflow-disclosure-body">
              <div className="workflow-run-panel">
                <span className="label">自动推进</span>
                <h4>方向清楚时，可以直接一键推进</h4>
                <p>如果你已经确认要走完整链路，可以直接跑自动流程；如果还在调整素材，就按上面的“当前建议”一步步推进。</p>
                <PipelineRunButton projectId={guide.project.id} />
              </div>
            </div>
          </details>
        </section>

        <aside className="workflow-command-side">
          <div className="workflow-kpi-grid">
            <div className="asset-tile workflow-kpi-card">
              <span className="label">主流程进度</span>
              <h4>{guide.progress.ratio}%</h4>
              <div className="progress-strip">
                <span className="progress-fill" style={{ width: `${guide.progress.ratio}%` }} />
              </div>
              <p>已完成 {guide.progress.completedStages} / {guide.progress.totalStages} 个主流程阶段。</p>
            </div>

            <div className="asset-tile workflow-kpi-card">
              <span className="label">故事基础</span>
              <h4>{guide.counts.chapters}</h4>
              <p>当前已经有 {guide.counts.chapters} 章可用正文，可继续支撑自动分镜。</p>
            </div>

            <div className="asset-tile workflow-kpi-card">
              <span className="label">镜头结构</span>
              <h4>{guide.counts.shots}</h4>
              <p>镜头越完整，后面的图片、语音和视频生成越不需要反复返工。</p>
            </div>

            <div className="asset-tile workflow-kpi-card">
              <span className="label">最近自动流程</span>
              <h4>{guide.latestRun.status === 'completed' ? '已完成' : guide.latestRun.status === 'failed' ? '有失败' : '尚未运行'}</h4>
              <p>
                {guide.latestRun.status
                  ? `最近一次 ${guide.latestRun.mode === 'full' ? '完整链' : '准备链'} 执行完成 ${guide.latestRun.completedSteps} 步。`
                  : '还没有自动流程记录，适合先按主流程手动推进。'}
              </p>
            </div>
          </div>
        </aside>
      </div>

      <details className="workflow-disclosure">
        <summary>展开完整 7 步主流程地图</summary>
        <div className="workflow-disclosure-body">
          <SectionCard
            eyebrow="Main Flow"
            title="先按这 7 步推进"
            description="每次只盯住一个主阶段。真正会让人迷路的辅助页，都被放到后面按需打开。"
          >
            <div className="workflow-stage-grid">
              {guide.stages.map((stage) => (
                <article key={stage.key} className={`asset-tile workflow-stage-card workflow-stage-${stage.status}`}>
                  <div className="workflow-stage-head">
                    <div>
                      <span className="label">{getStageToneLabel(stage.status)}</span>
                      <h4>{stage.title}</h4>
                    </div>
                    <span className="status-pill status-pill-subtle">{stage.badges[0] || '主流程'}</span>
                  </div>

                  <p>{stage.summary}</p>
                  <p className="muted-copy">{stage.detail}</p>

                  {stage.badges.length > 0 ? (
                    <div className="tag-list">
                      {stage.badges.map((badge) => (
                        <span key={`${stage.key}-${badge}`} className="tag-chip">{badge}</span>
                      ))}
                    </div>
                  ) : null}

                  <div className="action-row wrap-row compact-row">
                    <Link href={buildProjectHref(stage.href, guide.project.id)} className="button-secondary">进入这一阶段</Link>
                    {stage.supportLinks.map((item) => (
                      <Link key={`${stage.key}-${item.href}`} href={buildProjectHref(item.href, guide.project.id)} className="button-ghost">
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </SectionCard>
        </div>
      </details>

      <details className="workflow-disclosure">
        <summary>按需查看辅助工具入口</summary>
        <div className="workflow-disclosure-body">
          <SectionCard
            eyebrow="Support"
            title="这些工具只在需要时打开"
            description="当你已经知道自己在主流程的哪一步，再打开这些工具会顺很多。"
          >
            <div className="workflow-support-grid">
              {guide.supportTools.map((tool) => (
                <div key={tool.href} className="asset-tile workflow-support-card">
                  <div className="workflow-stage-head">
                    <div>
                      <span className="label">辅助工具</span>
                      <h4>{tool.label}</h4>
                    </div>
                    <span className="status-pill status-pill-subtle">{tool.badge}</span>
                  </div>
                  <p>{tool.summary}</p>
                  <div className="action-row wrap-row compact-row">
                    <Link href={buildProjectHref(tool.href, guide.project.id)} className="button-ghost">按需打开</Link>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </details>
    </div>
  );
}

import Link from 'next/link';
import { PipelineCommandCenter } from '@/components/pipeline-command-center';
import { ProjectList } from '@/components/project-list';
import { normalizeProjectId } from '@/lib/project-links';

export default async function HomePage({
  searchParams,
}: {
  searchParams?: Promise<{ projectId?: string | string[] }>;
}) {
  const projectId = normalizeProjectId((await searchParams)?.projectId);

  return (
    <div className="page-stack">
      <section className="dashboard-hero">
        <div className="dashboard-hero-copy">
          <p className="eyebrow">Studio Overview</p>
          <h1>先知道下一步，再打开对应页面。</h1>
          <p>
            首页现在只做两件事：先告诉你当前项目的下一步，再让你切项目。
            主流程以外的工具不在这里抢注意力。
          </p>
          <div className="action-row wrap-row">
            <Link href="/idea-lab" className="button-primary">开始新项目</Link>
            <Link href={projectId ? `/?projectId=${projectId}` : '/'} className="button-secondary">刷新当前下一步</Link>
            <Link href={projectId ? `/final-cut?projectId=${projectId}` : '/final-cut'} className="button-ghost">直接看成片预演</Link>
          </div>
        </div>

        <div className="dashboard-hero-side">
          <div className="stat-panel">
            <div className="stat-chip">1 个主入口</div>
            <div className="stat-chip">7 个主流程阶段</div>
            <div className="stat-chip">辅助工具按需打开</div>
            <div className="stat-chip">下一步动作优先展示</div>
          </div>

          <div className="dashboard-lanes">
            <div className="dashboard-lane">
              <span>01</span>
              <div>
                <strong>先定义项目</strong>
                <p>把一句话创意、题材和目标输出固定下来。</p>
              </div>
            </div>
            <div className="dashboard-lane">
              <span>02</span>
              <div>
                <strong>只推进当前阶段</strong>
                <p>每次只盯住当前这一页的主任务，不并行打开一堆工具页。</p>
              </div>
            </div>
            <div className="dashboard-lane">
              <span>03</span>
              <div>
                <strong>最后看成片与交付</strong>
                <p>生成完成后再去 final cut、QA 和 delivery，不提前分神。</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <PipelineCommandCenter projectId={projectId} />
      <ProjectList />
    </div>
  );
}

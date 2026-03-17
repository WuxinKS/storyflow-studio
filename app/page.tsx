import { DeliveryCenterData } from '@/components/delivery-center-data';
import { Pipeline } from '@/components/pipeline';
import { PipelineCommandCenter } from '@/components/pipeline-command-center';
import { ProjectContextBar } from '@/components/project-context-bar';
import { ProjectList } from '@/components/project-list';
import { ProjectSnapshot } from '@/components/project-snapshot';
import { ProjectVersionPanel } from '@/components/project-version-panel';
import { SectionCard } from '@/components/section-card';
import Link from 'next/link';
import { normalizeProjectId } from '@/lib/project-links';
import { dashboardHighlights, pipelineStages } from '@/lib/sample-data';

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
          <h1>先把主链看清楚，再继续优化细节。</h1>
          <p>
            这一版首页不再做信息堆叠，而是把项目启动、主链执行、成片预演和交付复验放进同一条清晰流程里。
          </p>
          <div className="action-row wrap-row">
            <Link href="/idea-lab" className="button-primary">开始新项目</Link>
            <Link href={projectId ? `/render-studio?projectId=${projectId}` : '/render-studio'} className="button-secondary">继续生成</Link>
            <Link href={projectId ? `/final-cut?projectId=${projectId}` : '/final-cut'} className="button-ghost">查看成片预演</Link>
          </div>
        </div>

        <div className="dashboard-hero-side">
          <div className="stat-panel">
            {dashboardHighlights.map((item) => (
              <div key={item} className="stat-chip">{item}</div>
            ))}
          </div>
          <div className="dashboard-lanes">
            <div className="dashboard-lane">
              <span>01</span>
              <div>
                <strong>定义项目</strong>
                <p>先锁定题材、风格、目标输出。</p>
              </div>
            </div>
            <div className="dashboard-lane">
              <span>02</span>
              <div>
                <strong>推进主链</strong>
                <p>故事、角色、视觉、改编和生成顺序清晰。</p>
              </div>
            </div>
            <div className="dashboard-lane">
              <span>03</span>
              <div>
                <strong>交付复验</strong>
                <p>QA、预演成片和交付包统一闭环。</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <ProjectContextBar currentPath="/" projectId={projectId} />
      <ProjectSnapshot />
      <PipelineCommandCenter projectId={projectId} />

      <SectionCard
        eyebrow="工作流地图"
        title="当前制作流程"
        description="把创意输入、制作执行和交付验收三个阶段摆在同一屏里，避免在页面之间来回找入口。"
      >
        <Pipeline stages={pipelineStages} />
      </SectionCard>

      <div className="asset-grid three-up">
        <div className="asset-tile">
          <span className="label">项目启动</span>
          <h4>先把方向说清楚</h4>
          <p>从创意工坊进入，定义 premise、题材、风格和目标输出，再决定是否一键跑完整主链。</p>
          <div className="action-row wrap-row compact-row">
            <Link href="/idea-lab" className="button-secondary">进入创意工坊</Link>
            <Link href={projectId ? `/story-setup?projectId=${projectId}` : '/story-setup'} className="button-ghost">查看故事设定</Link>
          </div>
        </div>
        <div className="asset-tile">
          <span className="label">制作执行</span>
          <h4>把故事推到镜头与生成</h4>
          <p>当故事和视觉稳定后，直接去改编、时间线和生成工作台，避免在同一阶段反复跳转。</p>
          <div className="action-row wrap-row compact-row">
            <Link href={projectId ? `/adaptation-lab?projectId=${projectId}` : '/adaptation-lab'} className="button-secondary">进入改编实验室</Link>
            <Link href={projectId ? `/render-studio?projectId=${projectId}` : '/render-studio'} className="button-ghost">进入生成工作台</Link>
          </div>
        </div>
        <div className="asset-tile">
          <span className="label">验收交付</span>
          <h4>最后看质量和成片</h4>
          <p>用 QA、成片预演和交付中心收束结果，确保你看到的是可复验、可交付的最终状态。</p>
          <div className="action-row wrap-row compact-row">
            <Link href={projectId ? `/qa-panel?projectId=${projectId}` : '/qa-panel'} className="button-secondary">查看 QA</Link>
            <Link href={projectId ? `/delivery-center?projectId=${projectId}` : '/delivery-center'} className="button-ghost">打开交付中心</Link>
          </div>
        </div>
      </div>

      <div className="dashboard-split">
        <SectionCard
          eyebrow="交付复验"
          title="最近交付"
          description="把最近的 bundle、payload、媒体索引和预演成片放在一起，减少切页查找成本。"
        >
          <DeliveryCenterData projectId={projectId} limit={3} />
        </SectionCard>

        <ProjectVersionPanel projectId={projectId} />
      </div>

      <ProjectList />
    </div>
  );
}

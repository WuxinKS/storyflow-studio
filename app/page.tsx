import { DeliveryCenterData } from '@/components/delivery-center-data';
import { Pipeline } from '@/components/pipeline';
import { PipelineCommandCenter } from '@/components/pipeline-command-center';
import { ProjectContextBar } from '@/components/project-context-bar';
import { ProjectList } from '@/components/project-list';
import { ProjectSnapshot } from '@/components/project-snapshot';
import { ProjectVersionPanel } from '@/components/project-version-panel';
import { SectionCard } from '@/components/section-card';
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
      <SectionCard
        title="总览"
        description="把一句话创意、小说生成、自动分镜、图片与视频生产统一在一个工作台中。"
      >
        <div className="hero-grid">
          <div className="hero-copy">
            <h3>从一句创意，走到小说、分镜与成片。</h3>
            <p>
              StoryFlow Studio 聚合故事引擎、小说引擎、改编引擎、分镜引擎和生成执行链，
              目标是把 AI 写作与 AI 影视生产整合成同一条创作流水线。
            </p>
          </div>
          <div className="stat-panel">
            {dashboardHighlights.map((item) => (
              <div key={item} className="stat-chip">{item}</div>
            ))}
          </div>
        </div>
      </SectionCard>

      <ProjectContextBar currentPath="/" projectId={projectId} />
      <ProjectSnapshot />
      <PipelineCommandCenter projectId={projectId} />
      <ProjectVersionPanel projectId={projectId} />

      <SectionCard
        title="交付中心"
        description="最近导出的交付包、manifest、provider payload 与 zip 会集中沉淀在这里，方便直接复验和交付。"
      >
        <DeliveryCenterData projectId={projectId} limit={3} />
      </SectionCard>

      <ProjectList />

      <SectionCard
        title="制作流水线"
        description="当前阶段重点是继续补齐从一句话到交付包的主链控制力，并把环境配置、执行链与质检闭环收紧。"
      >
        <Pipeline stages={pipelineStages} />
      </SectionCard>
    </div>
  );
}

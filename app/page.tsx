import { Pipeline } from '@/components/pipeline';
import { ProjectList } from '@/components/project-list';
import { ProjectSnapshot } from '@/components/project-snapshot';
import { SectionCard } from '@/components/section-card';
import { dashboardHighlights, pipelineStages } from '@/lib/sample-data';

export default function HomePage() {
  return (
    <div className="page-stack">
      <SectionCard
        title="Dashboard"
        description="把想法、设定、分镜、参考素材和视频生产统一在一个工作台中。"
      >
        <div className="hero-grid">
          <div className="hero-copy">
            <h3>从一句创意，走到一支成片。</h3>
            <p>
              StoryFlow Studio 聚合故事引擎、改编引擎、分镜引擎和参考解析引擎，
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

      <ProjectSnapshot />
      <ProjectList />

      <SectionCard
        title="Production Pipeline"
        description="当前阶段重点是搭建产品骨架，并先跑通想法驱动主链入口。"
      >
        <Pipeline stages={pipelineStages} />
      </SectionCard>
    </div>
  );
}

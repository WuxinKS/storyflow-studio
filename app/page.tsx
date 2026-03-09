import { Pipeline } from '@/components/pipeline';
import { PipelineCommandCenter } from '@/components/pipeline-command-center';
import { ProjectList } from '@/components/project-list';
import { ProjectSnapshot } from '@/components/project-snapshot';
import { SectionCard } from '@/components/section-card';
import { dashboardHighlights, pipelineStages } from '@/lib/sample-data';

export default function HomePage() {
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

      <ProjectSnapshot />
      <PipelineCommandCenter />
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

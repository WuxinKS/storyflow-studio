import { ReferenceAnalysisForm } from '@/components/reference-analysis-form';
import { getReferenceProject } from '@/features/reference/service';
import { getProjectStageLabel, getReferenceSourceTypeLabel } from '@/lib/display';

function parseNotes(notes: string | null) {
  if (!notes) return [];
  return notes.split('\n').filter(Boolean);
}

export async function ReferenceLabData() {
  const project = await getReferenceProject().catch(() => null);

  if (!project) {
    return (
      <div className="asset-tile">
        <span className="label">空状态</span>
        <h4>暂无项目</h4>
        <p>先创建项目，再记录参考图或参考视频分析。</p>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <div className="snapshot-card">
        <p className="eyebrow">参考工作台</p>
        <h3>{project.title}</h3>
        <p>把参考图、截图或样片拆成可复用的镜头语言、情绪标签和风格卡。</p>
        <div className="meta-list">
          <span>参考条目：{project.references.length}</span>
          <span>项目阶段：{getProjectStageLabel(project.stage)}</span>
        </div>
      </div>

      <ReferenceAnalysisForm projectId={project.id} />

      <div className="asset-grid">
        {project.references.length === 0 ? (
          <div className="asset-tile">
            <span className="label">空状态</span>
            <h4>还没有参考分析</h4>
            <p>先录入一个参考镜头，后续可以把它迁移到分镜板或改编实验室。</p>
          </div>
        ) : (
          project.references.map((item) => (
            <div key={item.id} className="asset-tile ref-tile">
              <span className="label">{getReferenceSourceTypeLabel(item.type)}</span>
              <h4>参考卡片</h4>
              <div className="tag-list">
                {parseNotes(item.notes).map((line) => (
                  <span key={line} className="tag-chip">{line}</span>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

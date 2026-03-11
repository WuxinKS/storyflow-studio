import { ReferenceAnalysisForm } from '@/components/reference-analysis-form';
import {
  buildReferenceProfile,
  getReferenceInsights,
  getReferenceProject,
} from '@/features/reference/service';
import { getProjectStageLabel, getReferenceSourceTypeLabel } from '@/lib/display';

export async function ReferenceLabData({ projectId }: { projectId?: string }) {
  const project = await getReferenceProject(projectId).catch(() => null);

  if (!project) {
    return (
      <div className="asset-tile">
        <span className="label">空状态</span>
        <h4>暂无项目</h4>
        <p>先创建项目，再记录参考图或参考视频分析。</p>
      </div>
    );
  }

  const insights = getReferenceInsights(project.references);
  const profile = buildReferenceProfile(project.references);

  return (
    <div className="page-stack">
      <div className="snapshot-card">
        <p className="eyebrow">参考工作台</p>
        <h3>{project.title}</h3>
        <p>把参考图、截图或样片拆成可复用的镜头语言、情绪标签和风格卡，并直接为改编与渲染链提供参考约束。</p>
        <div className="meta-list">
          <span>参考条目：{project.references.length}</span>
          <span>图片：{profile.imageCount}</span>
          <span>视频：{profile.videoCount}</span>
          <span>项目阶段：{getProjectStageLabel(project.stage)}</span>
        </div>
      </div>

      <ReferenceAnalysisForm projectId={project.id} />

      <div className="asset-grid three-up">
        <div className="asset-tile">
          <span className="label">构图画像</span>
          <h4>当前构图偏好</h4>
          <p>{profile.framing}</p>
        </div>
        <div className="asset-tile">
          <span className="label">情绪画像</span>
          <h4>当前情绪方向</h4>
          <p>{profile.emotion}</p>
        </div>
        <div className="asset-tile">
          <span className="label">节奏画像</span>
          <h4>当前动作 / 节奏</h4>
          <p>{profile.movement}</p>
        </div>
      </div>

      <div className="asset-grid three-up">
        <div className="asset-tile">
          <span className="label">参考锚点</span>
          <h4>主要参考标题</h4>
          <p>{profile.titleSummary}</p>
        </div>
        <div className="asset-tile">
          <span className="label">补充说明</span>
          <h4>可迁移说明</h4>
          <p>{profile.noteSummary}</p>
        </div>
        <div className="asset-tile">
          <span className="label">参考源</span>
          <h4>{profile.hasSourceMedia ? '已带入真实参考源' : '当前仅结构化笔记'}</h4>
          <p>{profile.sourceSummary}</p>
        </div>
      </div>

      <div className="asset-grid">
        {insights.length === 0 ? (
          <div className="asset-tile">
            <span className="label">空状态</span>
            <h4>还没有参考分析</h4>
            <p>先录入一个参考镜头，后续会把它直接迁移到改编实验室和渲染工作台。</p>
          </div>
        ) : (
          insights.map((item) => (
            <div key={item.id} className="asset-tile ref-tile scene-tile">
              <span className="label">{getReferenceSourceTypeLabel(item.sourceType)}</span>
              <h4>{item.title}</h4>
              <p>{item.notes}</p>
              <div className="tag-list">
                <span className="tag-chip">构图：{item.framing}</span>
                <span className="tag-chip">情绪：{item.emotion}</span>
                <span className="tag-chip">节奏：{item.movement}</span>
                {item.sourceUrl ? <span className="tag-chip">已记录 URL</span> : null}
                {item.localPath ? <span className="tag-chip">已记录本地路径</span> : null}
              </div>
              {item.sourceUrl ? <p>参考 URL：{item.sourceUrl}</p> : null}
              {item.localPath ? <p>本地路径：{item.localPath}</p> : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

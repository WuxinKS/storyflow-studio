import { ReferenceAnalysisForm } from '@/components/reference-analysis-form';
import { ReferenceBindingForm } from '@/components/reference-binding-form';
import {
  buildReferenceBindingSnapshot,
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
  const bindings = buildReferenceBindingSnapshot(project);

  return (
    <div className="page-stack">
      <div className="snapshot-card">
        <p className="eyebrow">参考工作台</p>
        <h3>{project.title}</h3>
        <p>把参考图、截图或样片拆成可复用的镜头语言、情绪标签和风格卡，并直接为改编、分镜与渲染链提供全局约束和镜头级定向参考。</p>
        <div className="meta-list">
          <span>参考条目：{project.references.length}</span>
          <span>图片：{profile.imageCount}</span>
          <span>视频：{profile.videoCount}</span>
          <span>定向分场：{bindings.sceneBindingCount}</span>
          <span>定向镜头：{bindings.shotBindingCount}</span>
          <span>生效镜头：{bindings.effectiveShotBindingCount}</span>
          <span>项目阶段：{getProjectStageLabel(project.stage)}</span>
        </div>
      </div>

      <ReferenceAnalysisForm projectId={project.id} />

      {insights.length > 0 && (project.scenes.length > 0 || project.shots.length > 0) ? (
        <ReferenceBindingForm
          projectId={project.id}
          references={insights.map((item) => ({ id: item.id, title: item.title }))}
          scenes={project.scenes.map((scene) => ({ id: scene.id, title: scene.title }))}
          shots={project.shots.map((shot) => ({ id: shot.id, title: shot.title, sceneTitle: project.scenes.find((scene) => scene.id === shot.sceneId)?.title || '未分场' }))}
        />
      ) : null}

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

      <div className="asset-grid three-up">
        <div className="asset-tile">
          <span className="label">定向绑定</span>
          <h4>分场绑定</h4>
          <p>当前已有 {bindings.sceneBindingCount} 个分场直接绑定了参考素材，可把同一场的镜头风格拉到一条线上。</p>
        </div>
        <div className="asset-tile">
          <span className="label">定向绑定</span>
          <h4>镜头绑定</h4>
          <p>当前已有 {bindings.shotBindingCount} 个镜头直接绑定了参考素材，适合做关键镜头、高潮镜头和特定构图控制。</p>
        </div>
        <div className="asset-tile">
          <span className="label">生效覆盖</span>
          <h4>镜头生效数</h4>
          <p>综合分场继承与镜头直绑后，当前共有 {bindings.effectiveShotBindingCount} 个镜头已经带上定向参考。</p>
        </div>
      </div>

      <div className="asset-grid">
        {bindings.bindings.length === 0 ? (
          <div className="asset-tile">
            <span className="label">空状态</span>
            <h4>还没有定向绑定</h4>
            <p>录入参考后，可以把指定参考绑定到分场或镜头，让后续渲染与分镜更精确地继承某个样片的构图、情绪和节奏。</p>
          </div>
        ) : (
          bindings.bindings.map((binding) => (
            <div key={`${binding.targetType}-${binding.targetId}`} className="asset-tile scene-tile">
              <span className="label">{binding.targetType === 'scene' ? '分场绑定' : '镜头绑定'}</span>
              <h4>{binding.targetLabel}</h4>
              <p>{binding.promptLine || '当前绑定尚未形成提示词摘要。'}</p>
              {binding.note ? <p><strong>绑定说明：</strong>{binding.note}</p> : null}
              <div className="tag-list">
                {binding.referenceTitles.map((title) => (
                  <span key={`${binding.targetId}-${title}`} className="tag-chip">{title}</span>
                ))}
              </div>
              <p>参考源：{binding.sourceSummary}</p>
            </div>
          ))
        )}
      </div>

      <div className="asset-grid">
        {insights.length === 0 ? (
          <div className="asset-tile">
            <span className="label">空状态</span>
            <h4>还没有参考分析</h4>
            <p>先录入一个参考镜头，后续会把它直接迁移到改编实验室、分镜板和渲染工作台。</p>
          </div>
        ) : (
          insights.map((item) => {
            const usage = bindings.usageByReferenceId.get(item.id);
            return (
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
                {usage && (usage.scenes.length > 0 || usage.shots.length > 0) ? (
                  <>
                    {usage.scenes.length > 0 ? <p>已绑分场：{usage.scenes.join(' / ')}</p> : null}
                    {usage.shots.length > 0 ? <p>已绑镜头：{usage.shots.join(' / ')}</p> : null}
                  </>
                ) : (
                  <p>当前还没有定向绑定，默认只参与全局参考画像。</p>
                )}
                {item.sourceUrl ? <p>参考 URL：{item.sourceUrl}</p> : null}
                {item.localPath ? <p>本地路径：{item.localPath}</p> : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

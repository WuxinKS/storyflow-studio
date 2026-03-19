import Link from 'next/link';
import { ReferenceAnalysisForm } from '@/components/reference-analysis-form';
import { ReferenceBindingForm } from '@/components/reference-binding-form';
import { SectionCard } from '@/components/section-card';
import {
  buildReferenceBindingSnapshot,
  buildReferenceProfile,
  getReferenceInsights,
  getReferenceProject,
} from '@/features/reference/service';
import { getProjectStageLabel, getReferenceSourceTypeLabel } from '@/lib/display';
import { buildProjectHref } from '@/lib/project-links';

function getBindingCoverageLabel(effectiveCount: number) {
  if (effectiveCount >= 8) return '覆盖充分';
  if (effectiveCount >= 3) return '局部覆盖';
  if (effectiveCount > 0) return '刚开始绑定';
  return '待建立覆盖';
}

function truncateText(value: string, limit: number) {
  if (value.length <= limit) return value;
  return `${value.slice(0, limit).trim()}…`;
}

function getReferenceMission(input: {
  referenceCount: number;
  hasTargets: boolean;
  effectiveShotBindingCount: number;
  projectId: string;
}) {
  if (input.referenceCount === 0) {
    return {
      status: '待录入首张参考卡',
      title: '先录入第一张参考卡',
      guidance: '先给项目建立第一条参考约束，后面的参考画像和定向绑定才会有基础。',
      actionHref: '#reference-intake',
      actionLabel: '去录入参考卡',
    };
  }

  if (!input.hasTargets) {
    return {
      status: '待建立可绑定目标',
      title: '先回自动分镜补 scene / shot',
      guidance: '没有分场或镜头目标时，参考只能停留在全局画像层，先回自动分镜补结构更有效。',
      actionHref: buildProjectHref('/adaptation-lab', input.projectId),
      actionLabel: '回到自动分镜',
    };
  }

  if (input.effectiveShotBindingCount === 0) {
    return {
      status: '建议做关键绑定',
      title: '把关键参考绑定到镜头',
      guidance: '先把最关键的构图、情绪或节奏参考绑给重点镜头，后面的图片和视频生成会更稳。',
      actionHref: '#reference-binding',
      actionLabel: '去做定向绑定',
    };
  }

  return {
    status: '参考约束已可下游使用',
    title: '回到分镜板继续精修',
    guidance: '全局画像和关键绑定已经建立，这一页先收口，让参考约束跟着分镜和生成继续往下走。',
    actionHref: buildProjectHref('/storyboard', input.projectId),
    actionLabel: '回到分镜板',
  };
}

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
  const bindingCoverageLabel = getBindingCoverageLabel(bindings.effectiveShotBindingCount);
  const hasTargets = project.scenes.length > 0 || project.shots.length > 0;
  const referenceMission = getReferenceMission({
    referenceCount: profile.total,
    hasTargets,
    effectiveShotBindingCount: bindings.effectiveShotBindingCount,
    projectId: project.id,
  });
  const showBindingAsPrimary = profile.total > 0 && hasTargets && bindings.effectiveShotBindingCount === 0;
  const previewInsights = insights.slice(0, 3);
  const overflowInsights = insights.slice(previewInsights.length);

  return (
    <div className="page-stack">
      <div className="reference-command-grid">
        <section className="snapshot-card reference-command-card">
          <div className="reference-panel-head">
            <div>
              <p className="eyebrow">Reference Command</p>
              <h3>{project.title}</h3>
            </div>
            <span className="status-pill status-pill-subtle">{bindingCoverageLabel}</span>
          </div>

          <p>
            这里不只是“存参考图”，而是把截图、样片和视频参考拆成能被改编、分镜、图片生成和视频生成直接消费的约束卡。
            我们先沉淀全局风格，再把关键参考绑定到具体分场和镜头。
          </p>

          <div className="meta-list">
            <span>项目阶段 {getProjectStageLabel(project.stage)}</span>
            <span>参考条目 {profile.total}</span>
            <span>图片 {profile.imageCount}</span>
            <span>视频 {profile.videoCount}</span>
            <span>分场绑定 {bindings.sceneBindingCount}</span>
            <span>镜头绑定 {bindings.shotBindingCount}</span>
            <span>生效镜头 {bindings.effectiveShotBindingCount}</span>
          </div>

          <div className="asset-tile reference-focus-card">
            <span className="label">当前主任务</span>
            <h4>{referenceMission.title}</h4>
            <p>{referenceMission.guidance}</p>
            <div className="action-row wrap-row">
              <a href={referenceMission.actionHref} className="button-primary">{referenceMission.actionLabel}</a>
            </div>
            <details className="workflow-disclosure">
              <summary>需要时打开其他相关入口</summary>
              <div className="workflow-disclosure-body">
                <div className="action-row wrap-row">
                  <Link href={buildProjectHref('/visual-bible', project.id)} className="button-ghost">返回视觉圣经</Link>
                  <Link href={buildProjectHref('/storyboard', project.id)} className="button-secondary">查看分镜板</Link>
                  <Link href={buildProjectHref('/render-studio', project.id)} className="button-secondary">查看生成工作台</Link>
                  <Link href={buildProjectHref('/render-runs', project.id)} className="button-secondary">查看运行诊断</Link>
                </div>
              </div>
            </details>
          </div>
        </section>

        <aside className="reference-command-side">
          <div className="reference-kpi-grid">
            <div className="asset-tile reference-kpi-card">
              <span className="label">全局画像</span>
              <h4>{profile.total > 0 ? '已建立' : '待录入'}</h4>
              <p>{profile.total > 0 ? profile.promptLine : '先录入 1-3 个关键参考，后续画像就会自动成型。'} </p>
            </div>

            <div className="asset-tile reference-kpi-card">
              <span className="label">真实素材</span>
              <h4>{profile.hasSourceMedia ? '已带源' : '仅结构笔记'}</h4>
              <p>{profile.sourceSummary}</p>
            </div>

            <div className="asset-tile reference-kpi-card">
              <span className="label">定向覆盖</span>
              <h4>{bindings.effectiveShotBindingCount}</h4>
              <p>综合分场继承与镜头直绑后，已有 {bindings.effectiveShotBindingCount} 个镜头能带着参考约束进入生成链。</p>
            </div>

            <div className="asset-tile reference-kpi-card">
              <span className="label">主要参考</span>
              <h4>{profile.titleSummary}</h4>
              <p>{profile.noteSummary}</p>
            </div>
          </div>
        </aside>
      </div>

      <SectionCard
        eyebrow="Capture"
        title="参考采集与绑定"
        description="默认只做当前最需要的输入动作，另一个动作按需展开。"
      >
        <div className="reference-ops-grid">
          <div id={showBindingAsPrimary ? 'reference-binding' : 'reference-intake'}>
            {showBindingAsPrimary ? (
              <ReferenceBindingForm
                projectId={project.id}
                references={insights.map((item) => ({ id: item.id, title: item.title }))}
                scenes={project.scenes.map((scene) => ({ id: scene.id, title: scene.title }))}
                shots={project.shots.map((shot) => ({
                  id: shot.id,
                  title: shot.title,
                  sceneTitle: project.scenes.find((scene) => scene.id === shot.sceneId)?.title || '未分场',
                }))}
                currentBindings={bindings.bindings.map((binding) => ({
                  targetType: binding.targetType === 'scene' ? 'scene' : 'shot',
                  targetId: binding.targetId,
                  targetLabel: binding.targetLabel,
                  referenceIds: binding.referenceIds,
                  referenceTitles: binding.referenceTitles,
                  note: binding.note,
                  promptLine: binding.promptLine,
                }))}
              />
            ) : (
              <ReferenceAnalysisForm projectId={project.id} />
            )}
          </div>

          <details className="workflow-disclosure">
            <summary>{showBindingAsPrimary ? '需要时继续录入参考卡' : '需要时打开定向绑定'}</summary>
            <div className="workflow-disclosure-body">
              {showBindingAsPrimary ? (
                <div id="reference-intake">
                  <ReferenceAnalysisForm projectId={project.id} />
                </div>
              ) : insights.length > 0 && hasTargets ? (
                <div id="reference-binding">
                  <ReferenceBindingForm
                    projectId={project.id}
                    references={insights.map((item) => ({ id: item.id, title: item.title }))}
                    scenes={project.scenes.map((scene) => ({ id: scene.id, title: scene.title }))}
                    shots={project.shots.map((shot) => ({
                      id: shot.id,
                      title: shot.title,
                      sceneTitle: project.scenes.find((scene) => scene.id === shot.sceneId)?.title || '未分场',
                    }))}
                    currentBindings={bindings.bindings.map((binding) => ({
                      targetType: binding.targetType === 'scene' ? 'scene' : 'shot',
                      targetId: binding.targetId,
                      targetLabel: binding.targetLabel,
                      referenceIds: binding.referenceIds,
                      referenceTitles: binding.referenceTitles,
                      note: binding.note,
                      promptLine: binding.promptLine,
                    }))}
                  />
                </div>
              ) : (
                <div className="asset-tile reference-empty-card">
                  <span className="label">绑定前置条件</span>
                  <h4>先准备参考或镜头</h4>
                  <p>只有当参考卡与分场 / 镜头已经存在时，系统才会开放定向绑定入口。</p>
                </div>
              )}
            </div>
          </details>
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Profile"
        title="全局参考画像"
        description="这里是项目级风格总结，帮助我们快速判断当前参考更偏什么构图、情绪与节奏。"
      >
        <div className="reference-profile-grid">
          <div className="asset-tile reference-profile-card">
            <span className="label">构图画像</span>
            <h4>{profile.framing}</h4>
            <p>这是当前最常出现的景别 / 构图取向，会直接影响分镜和生图提示词。</p>
          </div>

          <div className="asset-tile reference-profile-card">
            <span className="label">情绪画像</span>
            <h4>{profile.emotion}</h4>
            <p>这部分会和故事张力一起进入镜头提示与情绪曲线设计。</p>
          </div>

          <div className="asset-tile reference-profile-card">
            <span className="label">节奏画像</span>
            <h4>{profile.movement}</h4>
            <p>动作与节奏描述会优先进入导演语言和镜头运动约束。</p>
          </div>

          <div className="asset-tile reference-profile-card">
            <span className="label">高频锚点</span>
            <h4>{profile.titleSummary}</h4>
            {profile.highlights.length > 0 ? (
              <div className="reference-highlight-list">
                {profile.highlights.map((item) => (
                  <span key={item} className="tag-chip">{item}</span>
                ))}
              </div>
            ) : (
              <p>当前还没有足够的参考卡来形成稳定锚点。</p>
            )}
          </div>
        </div>
      </SectionCard>

      <details className="workflow-disclosure">
        <summary>按需查看定向绑定覆盖</summary>
        <div className="workflow-disclosure-body">
          <SectionCard
            eyebrow="Coverage"
            title="定向绑定覆盖"
            description="全局画像之外，我们还需要把关键参考推给关键场次和关键镜头，确保后续生成不跑偏。"
          >
            <div className="reference-binding-grid">
              <div className="asset-tile reference-binding-card">
                <span className="label">分场绑定</span>
                <h4>{bindings.sceneBindingCount}</h4>
                <p>适合给同一场的整体气质、色彩和构图方向设总约束。</p>
              </div>

              <div className="asset-tile reference-binding-card">
                <span className="label">镜头绑定</span>
                <h4>{bindings.shotBindingCount}</h4>
                <p>适合高潮镜头、关键情绪镜头或需要精准复用样片构图的场景。</p>
              </div>

              <div className="asset-tile reference-binding-card">
                <span className="label">生效镜头</span>
                <h4>{bindings.effectiveShotBindingCount}</h4>
                <p>这是最终真正会带着参考约束进入渲染链的镜头数量。</p>
              </div>
            </div>

            <div className="reference-binding-stack">
              {bindings.bindings.length === 0 ? (
                <div className="asset-tile">
                  <span className="label">空状态</span>
                  <h4>还没有定向绑定</h4>
                  <p>录入参考后，把它们绑定到分场或镜头，后续分镜与生成就会更精准。</p>
                </div>
              ) : (
                bindings.bindings.map((binding) => (
                  <div key={`${binding.targetType}-${binding.targetId}`} className="asset-tile reference-binding-detail-card">
                    <div className="reference-binding-detail-head">
                      <div>
                        <span className="label">{binding.targetType === 'scene' ? '分场绑定' : '镜头绑定'}</span>
                        <h4>{binding.targetLabel}</h4>
                      </div>
                      <span className="status-pill status-pill-subtle">{binding.referenceTitles.length} 条参考</span>
                    </div>
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
          </SectionCard>
        </div>
      </details>

      <SectionCard
        eyebrow="Library"
        title="默认先看关键参考卡"
        description="先看最常用的几张参考卡，完整卡库按需展开。"
      >
        <div className="reference-card-grid">
          {previewInsights.length === 0 ? (
            <div className="asset-tile">
              <span className="label">空状态</span>
              <h4>还没有参考分析</h4>
              <p>先录入一个参考镜头，后续会把它直接迁移到改编实验室、分镜板和渲染工作台。</p>
            </div>
          ) : (
            previewInsights.map((item) => {
              const usage = bindings.usageByReferenceId.get(item.id);

              return (
                <div key={item.id} className="asset-tile reference-card scene-tile">
                  <div className="reference-card-head">
                    <div>
                      <span className="label">{getReferenceSourceTypeLabel(item.sourceType)}</span>
                      <h4>{item.title}</h4>
                    </div>
                    <span className="status-pill status-pill-subtle">
                      {usage && (usage.scenes.length > 0 || usage.shots.length > 0) ? '已参与定向绑定' : '仅参与全局画像'}
                    </span>
                  </div>

                  <p>{truncateText(item.notes, 110)}</p>

                  <div className="tag-list">
                    <span className="tag-chip">构图：{item.framing}</span>
                    <span className="tag-chip">情绪：{item.emotion}</span>
                    <span className="tag-chip">节奏：{item.movement}</span>
                    {item.sourceUrl ? <span className="tag-chip">已记录 URL</span> : null}
                    {item.localPath ? <span className="tag-chip">已记录本地路径</span> : null}
                  </div>

                  {usage && (usage.scenes.length > 0 || usage.shots.length > 0) ? (
                    <div className="reference-usage-grid">
                      {usage.scenes.length > 0 ? <p><strong>已绑分场：</strong>{usage.scenes.join(' / ')}</p> : null}
                      {usage.shots.length > 0 ? <p><strong>已绑镜头：</strong>{usage.shots.join(' / ')}</p> : null}
                    </div>
                  ) : (
                    <p>当前还没有定向绑定，默认只参与全局参考画像。</p>
                  )}

                  {item.sourceUrl ? <p><strong>参考 URL：</strong>{truncateText(item.sourceUrl, 72)}</p> : null}
                  {item.localPath ? <p><strong>本地路径：</strong>{truncateText(item.localPath, 72)}</p> : null}
                </div>
              );
            })
          )}
        </div>

        {overflowInsights.length > 0 ? (
          <details className="workflow-disclosure">
            <summary>展开剩余 {overflowInsights.length} 张参考卡</summary>
            <div className="workflow-disclosure-body">
              <div className="reference-card-grid">
                {overflowInsights.map((item) => {
                  const usage = bindings.usageByReferenceId.get(item.id);

                  return (
                    <div key={`${item.id}-overflow`} className="asset-tile reference-card scene-tile">
                      <div className="reference-card-head">
                        <div>
                          <span className="label">{getReferenceSourceTypeLabel(item.sourceType)}</span>
                          <h4>{item.title}</h4>
                        </div>
                        <span className="status-pill status-pill-subtle">
                          {usage && (usage.scenes.length > 0 || usage.shots.length > 0) ? '已参与定向绑定' : '仅参与全局画像'}
                        </span>
                      </div>

                      <p>{item.notes}</p>

                      <div className="tag-list">
                        <span className="tag-chip">构图：{item.framing}</span>
                        <span className="tag-chip">情绪：{item.emotion}</span>
                        <span className="tag-chip">节奏：{item.movement}</span>
                        {item.sourceUrl ? <span className="tag-chip">已记录 URL</span> : null}
                        {item.localPath ? <span className="tag-chip">已记录本地路径</span> : null}
                      </div>

                      {usage && (usage.scenes.length > 0 || usage.shots.length > 0) ? (
                        <div className="reference-usage-grid">
                          {usage.scenes.length > 0 ? <p><strong>已绑分场：</strong>{usage.scenes.join(' / ')}</p> : null}
                          {usage.shots.length > 0 ? <p><strong>已绑镜头：</strong>{usage.shots.join(' / ')}</p> : null}
                        </div>
                      ) : (
                        <p>当前还没有定向绑定，默认只参与全局参考画像。</p>
                      )}

                      {item.sourceUrl ? <p><strong>参考 URL：</strong>{item.sourceUrl}</p> : null}
                      {item.localPath ? <p><strong>本地路径：</strong>{item.localPath}</p> : null}
                    </div>
                  );
                })}
              </div>
            </div>
          </details>
        ) : null}
      </SectionCard>
    </div>
  );
}

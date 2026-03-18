import Link from 'next/link';
import { SectionCard } from '@/components/section-card';
import { VisualGenerateButton } from '@/components/visual-generate-button';
import { VisualBibleEditor } from '@/components/visual-bible-editor';
import { SyncNoticeCard } from '@/components/sync-notice-card';
import { buildReferenceProfile } from '@/features/reference/service';
import { getSyncStatus } from '@/features/sync/service';
import { getLatestVisualProject, getVisualBibleBundle } from '@/features/visual/service';
import { getProjectStageLabel } from '@/lib/display';
import { buildProjectHref } from '@/lib/project-links';

function getLockedFieldLabels(visualBible: NonNullable<ReturnType<typeof getVisualBibleBundle>>) {
  const labels: string[] = [];
  if (visualBible.locks.palette) labels.push('色彩策略');
  if (visualBible.locks.lighting) labels.push('光线策略');
  if (visualBible.locks.lensLanguage) labels.push('镜头语言');
  if (visualBible.locks.motionLanguage) labels.push('运动语言');
  return labels;
}

function splitKeywords(value: string) {
  return value
    .split(/[、，,/]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getVisualReadinessLabel(hasBible: boolean, lockedCount: number) {
  if (!hasBible) return '待生成';
  if (lockedCount >= 3) return '视觉定稿中';
  if (lockedCount > 0) return '视觉已成型';
  return '待锁定关键字段';
}

export async function VisualBibleData({ projectId }: { projectId?: string }) {
  const project = await getLatestVisualProject(projectId).catch(() => null);

  if (!project) {
    return (
      <div className="asset-tile">
        <span className="label">空状态</span>
        <h4>暂无项目</h4>
        <p>先创建项目，再来生成视觉圣经。</p>
      </div>
    );
  }

  const visualBible = getVisualBibleBundle(project);
  const syncStatus = await getSyncStatus(project.id).catch(() => null);
  const referenceProfile = buildReferenceProfile(project.references);
  const lockedFields = visualBible ? getLockedFieldLabels(visualBible) : [];
  const keywordList = visualBible ? splitKeywords(visualBible.textureKeywords) : [];
  const lockedRate = Math.round((lockedFields.length / 4) * 100);
  const readinessLabel = getVisualReadinessLabel(Boolean(visualBible), lockedFields.length);

  return (
    <div className="page-stack">
      <div className="visual-command-grid">
        <section className="snapshot-card visual-command-card">
          <div className="visual-panel-head">
            <div>
              <p className="eyebrow">Visual Command</p>
              <h3>{project.title}</h3>
            </div>
            <span className="status-pill status-pill-subtle">{readinessLabel}</span>
          </div>

          <p>
            这一站的目标是把故事世界观、角色气质和参考素材收束成一套稳定的视觉总控，
            让后面的改编、分镜、图片生成和视频生成都围绕同一种影像语言推进。
          </p>

          <div className="meta-list">
            <span>项目阶段 {getProjectStageLabel(project.stage)}</span>
            <span>参考条目 {referenceProfile.total}</span>
            <span>图片 {referenceProfile.imageCount}</span>
            <span>视频 {referenceProfile.videoCount}</span>
            <span>已锁字段 {lockedFields.length} / 4</span>
          </div>

          <VisualGenerateButton projectId={project.id} />

          <div className="action-row wrap-row">
            <Link href={buildProjectHref('/story-setup', project.id)} className="button-ghost">返回故事设定</Link>
            <Link href={buildProjectHref('/reference-lab', project.id)} className="button-secondary">管理参考素材</Link>
            <Link href={buildProjectHref('/adaptation-lab', project.id)} className="button-secondary">继续进入改编</Link>
          </div>
        </section>

        <aside className="visual-command-side">
          <div className="visual-kpi-grid">
            <div className="asset-tile visual-kpi-card">
              <span className="label">锁定覆盖</span>
              <h4>{lockedRate}%</h4>
              <div className="progress-strip">
                <span className="progress-fill progress-fill-accent-2" style={{ width: `${lockedRate}%` }} />
              </div>
              <p>{lockedFields.length === 0 ? '当前还没有锁定关键字段。' : `${lockedFields.length} 个关键视觉字段已进入保护状态。`}</p>
            </div>

            <div className="asset-tile visual-kpi-card">
              <span className="label">参考输入</span>
              <h4>{referenceProfile.total > 0 ? '已接入' : '待补参考'}</h4>
              <p>{referenceProfile.total > 0 ? referenceProfile.promptLine : '建议先补 3-5 个关键参考，让视觉圣经更稳。'}</p>
            </div>

            <div className="asset-tile visual-kpi-card">
              <span className="label">主风格</span>
              <h4>{visualBible?.styleName || '尚未生成'}</h4>
              <p>{visualBible?.visualTone || '先生成第一版视觉圣经，再逐步锁定光色和镜头规则。'} </p>
            </div>

            <div className="asset-tile visual-kpi-card">
              <span className="label">下游注入</span>
              <h4>{visualBible ? '已就绪' : '待建立'}</h4>
              <p>{visualBible ? '当前视觉规则可继续喂给改编、分镜和生成工作台。' : '先建立统一视觉系统，再进入下游环节。'} </p>
            </div>
          </div>
        </aside>
      </div>

      {syncStatus ? (
        <div className="asset-grid">
          <SyncNoticeCard card={syncStatus.cards.visual} />
        </div>
      ) : null}

      {!visualBible ? (
        <div className="asset-tile">
          <span className="label">空状态</span>
          <h4>还没有视觉圣经</h4>
          <p>点击上方按钮，基于当前故事、角色和参考条目生成第一版视觉总控。</p>
        </div>
      ) : (
        <>
          <SectionCard
            eyebrow="Readiness"
            title="视觉准备度"
            description="先看这套视觉规则是否足够稳定，再决定是继续锁定、补参考，还是直接推进改编与分镜。"
          >
            <div className="visual-health-grid">
              <div className="asset-tile visual-highlight-card">
                <span className="label">项目前提</span>
                <h4>{project.premise || '暂无故事前提'}</h4>
                <p>{project.description || '当前还没有额外风格备注，建议补一条更明确的创作方向。'} </p>
              </div>

              <div className="asset-tile visual-highlight-card">
                <span className="label">参考画像</span>
                <h4>{referenceProfile.total > 0 ? '参考已沉淀' : '暂无参考画像'}</h4>
                <p>{referenceProfile.total > 0 ? referenceProfile.promptLine : '当前会更多依赖故事与角色信息来推导视觉系统。'} </p>
              </div>

              <div className="asset-tile visual-highlight-card">
                <span className="label">锁定策略</span>
                <h4>{lockedFields.length > 0 ? '关键字段已保护' : '建议开始锁定'}</h4>
                {lockedFields.length > 0 ? (
                  <div className="tag-list">
                    {lockedFields.map((field) => (
                      <span key={field} className="tag-chip">{field}</span>
                    ))}
                  </div>
                ) : (
                  <p>建议至少先锁定色彩和镜头语言，避免后续重生时漂移。</p>
                )}
              </div>
            </div>
          </SectionCard>

          <SectionCard
            eyebrow="System"
            title="视觉总控面板"
            description="把真正影响生成链的规则拆成四组：基调、光色、摄影和场景材质。"
          >
            <div className="visual-system-grid">
              <div className="asset-tile visual-system-card">
                <span className="label">视觉基调</span>
                <h4>{visualBible.styleName}</h4>
                <p>{visualBible.visualTone}</p>
              </div>

              <div className="asset-tile visual-system-card">
                <span className="label">光色规则</span>
                <div className="shot-list">
                  <div className="shot-item">
                    <strong>色彩策略</strong>
                    <span>{visualBible.palette}</span>
                  </div>
                  <div className="shot-item">
                    <strong>光线策略</strong>
                    <span>{visualBible.lighting}</span>
                  </div>
                </div>
              </div>

              <div className="asset-tile visual-system-card">
                <span className="label">摄影规则</span>
                <div className="shot-list">
                  <div className="shot-item">
                    <strong>镜头语言</strong>
                    <span>{visualBible.lensLanguage}</span>
                  </div>
                  <div className="shot-item">
                    <strong>运动语言</strong>
                    <span>{visualBible.motionLanguage}</span>
                  </div>
                </div>
              </div>

              <div className="asset-tile visual-system-card">
                <span className="label">材质与空间</span>
                <p>{visualBible.sceneDesign}</p>
                {keywordList.length > 0 ? (
                  <div className="tag-list">
                    {keywordList.map((item) => (
                      <span key={item} className="tag-chip">{item}</span>
                    ))}
                  </div>
                ) : (
                  <p>当前还没有提炼出材质关键词。</p>
                )}
              </div>
            </div>
          </SectionCard>

          <SectionCard
            eyebrow="Editor"
            title="视觉定稿台"
            description="这里负责最后的人工修订、字段锁定和局部重生，确保下游模型吃到的是稳定约束。"
          >
            <VisualBibleEditor projectId={project.id} initialDraft={visualBible} />
          </SectionCard>
        </>
      )}
    </div>
  );
}

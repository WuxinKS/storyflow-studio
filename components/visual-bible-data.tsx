import Link from 'next/link';
import { VisualGenerateButton } from '@/components/visual-generate-button';
import { VisualBibleEditor } from '@/components/visual-bible-editor';
import { SyncNoticeCard } from '@/components/sync-notice-card';
import { getSyncStatus } from '@/features/sync/service';
import { getLatestVisualProject, getVisualBibleBundle } from '@/features/visual/service';

function getLockedFieldLabels(visualBible: NonNullable<ReturnType<typeof getVisualBibleBundle>>) {
  const labels: string[] = [];
  if (visualBible.locks.palette) labels.push('色彩策略');
  if (visualBible.locks.lighting) labels.push('光线策略');
  if (visualBible.locks.lensLanguage) labels.push('镜头语言');
  if (visualBible.locks.motionLanguage) labels.push('运动语言');
  return labels;
}

export async function VisualBibleData() {
  const project = await getLatestVisualProject().catch(() => null);

  if (!project) {
    return (
      <div className="asset-tile">
        <span className="label">empty</span>
        <h4>暂无项目</h4>
        <p>先创建项目，再来生成视觉圣经。</p>
      </div>
    );
  }

  const visualBible = getVisualBibleBundle(project);
  const syncStatus = await getSyncStatus(project.id).catch(() => null);
  const lockedFields = visualBible ? getLockedFieldLabels(visualBible) : [];

  return (
    <div className="page-stack">
      <div className="snapshot-card">
        <p className="eyebrow">视觉圣经</p>
        <h3>{project.title}</h3>
        <p>{project.premise || '暂无故事前提'}</p>
        <div className="meta-list">
          <span>参考条目：{project.references.length}</span>
          <span>当前阶段：{project.stage}</span>
        </div>
        <VisualGenerateButton projectId={project.id} />
        <div className="action-row">
          <Link href="/story-setup" className="button-ghost">返回故事设定</Link>
          <Link href="/adaptation-lab" className="button-secondary">继续进入改编</Link>
        </div>
      </div>

      {syncStatus ? (
        <div className="asset-grid">
          <SyncNoticeCard card={syncStatus.cards.visual} />
        </div>
      ) : null}

      <div className="asset-grid three-up">
        <div className="asset-tile">
          <span className="label">当前说明</span>
          <h4>视觉系统 v2</h4>
          <p>当前版本已支持视觉圣经生成、手动修订保存、关键视觉字段锁定，以及保留锁定项的整套 / 局部重生。</p>
        </div>
        <div className="asset-tile">
          <span className="label">当前用途</span>
          <h4>作为全片视觉总控</h4>
          <p>现在已经可以在定稿后锁住色彩、光线、镜头语言与运动语言，再持续注入改编、分镜和生成阶段。</p>
        </div>
        <div className="asset-tile">
          <span className="label">当前状态</span>
          <h4>已接入 GPT-5.4 + 锁定保护</h4>
          <p>视觉圣经内容当前先走 GPT-5.4，之后可人工修订覆盖保存，并对关键字段做强保护。</p>
        </div>
      </div>

      {!visualBible ? (
        <div className="asset-tile">
          <span className="label">empty</span>
          <h4>还没有视觉圣经</h4>
          <p>点击上方按钮，基于当前故事、角色与参考条目生成第一版视觉总控。</p>
        </div>
      ) : (
        <>
          <div className="asset-grid two-up">
            <div className="asset-tile scene-tile">
              <span className="label">风格总览</span>
              <h4>{visualBible.styleName}</h4>
              {lockedFields.length > 0 ? (
                <div className="tag-list">
                  {lockedFields.map((field) => (
                    <span key={field} className="tag-chip">已锁定：{field}</span>
                  ))}
                </div>
              ) : null}
              <div className="shot-list">
                <div className="shot-item">
                  <strong>整体气质</strong>
                  <span>{visualBible.visualTone}</span>
                </div>
                <div className="shot-item">
                  <strong>色彩策略</strong>
                  <span>{visualBible.palette}</span>
                </div>
                <div className="shot-item">
                  <strong>光线策略</strong>
                  <span>{visualBible.lighting}</span>
                </div>
                <div className="shot-item">
                  <strong>空间设计</strong>
                  <span>{visualBible.sceneDesign}</span>
                </div>
              </div>
            </div>

            <div className="asset-tile scene-tile">
              <span className="label">摄影语言</span>
              <h4>镜头与运动规则</h4>
              <div className="shot-list">
                <div className="shot-item">
                  <strong>镜头语言</strong>
                  <span>{visualBible.lensLanguage}</span>
                </div>
                <div className="shot-item">
                  <strong>运动语言</strong>
                  <span>{visualBible.motionLanguage}</span>
                </div>
                <div className="shot-item">
                  <strong>材质关键词</strong>
                  <span>{visualBible.textureKeywords}</span>
                </div>
              </div>
            </div>
          </div>

          <VisualBibleEditor projectId={project.id} initialDraft={visualBible} />
        </>
      )}
    </div>
  );
}

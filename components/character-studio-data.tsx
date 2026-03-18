import Link from 'next/link';
import { CharacterGenerateButton } from '@/components/character-generate-button';
import { CharacterEditor } from '@/components/character-editor';
import { SectionCard } from '@/components/section-card';
import { SyncNoticeCard } from '@/components/sync-notice-card';
import { getCharacterDraftBundle, getLatestCharacterProject } from '@/features/characters/service';
import { getSyncStatus } from '@/features/sync/service';
import { getProjectStageLabel } from '@/lib/display';
import { buildProjectHref } from '@/lib/project-links';

function roleLabel(role: string) {
  if (role === 'protagonist') return '主角';
  if (role === 'antagonist') return '对手';
  return '关键配角';
}

function getLockedFieldLabels(character: ReturnType<typeof getCharacterDraftBundle>[number]) {
  const labels: string[] = [];
  if (character.locks?.name) labels.push('角色名');
  if (character.locks?.role) labels.push('角色定位');
  if (character.locks?.archetype) labels.push('角色原型');
  if (character.locks?.goal) labels.push('剧情目标');
  if (character.locks?.conflict) labels.push('核心冲突');
  return labels;
}

function getCharacterReadinessLabel(characterCount: number, lockedCount: number) {
  if (characterCount === 0) return '待生成';
  if (lockedCount >= 4) return '角色定稿中';
  if (lockedCount > 0) return '角色已成型';
  return '待锁定关键字段';
}

export async function CharacterStudioData({ projectId }: { projectId?: string }) {
  const project = await getLatestCharacterProject(projectId).catch(() => null);

  if (!project) {
    return (
      <div className="asset-tile">
        <span className="label">空状态</span>
        <h4>暂无项目</h4>
        <p>先去创意页创建项目，再来生成角色草案。</p>
      </div>
    );
  }

  const characters = getCharacterDraftBundle(project);
  const syncStatus = await getSyncStatus(project.id).catch(() => null);
  const totalLockedFields = characters.reduce((sum, character) => sum + getLockedFieldLabels(character).length, 0);
  const roleCounts = {
    protagonist: characters.filter((item) => item.role === 'protagonist').length,
    antagonist: characters.filter((item) => item.role === 'antagonist').length,
    support: characters.filter((item) => item.role !== 'protagonist' && item.role !== 'antagonist').length,
  };
  const voiceReadyCount = characters.filter((item) => item.voiceStyle.trim()).length;
  const anchorReadyCount = characters.filter((item) => item.visualAnchor.trim()).length;
  const readinessLabel = getCharacterReadinessLabel(characters.length, totalLockedFields);

  return (
    <div className="page-stack">
      <div className="character-command-grid">
        <section className="snapshot-card character-command-card">
          <div className="character-panel-head">
            <div>
              <p className="eyebrow">Character Command</p>
              <h3>{project.title}</h3>
            </div>
            <span className="status-pill status-pill-subtle">{readinessLabel}</span>
          </div>

          <p>
            这一站负责把故事里的关键人物固定下来，让后面的改编、分镜、图片生成和视频生成都围绕同一批角色认知来工作，
            不再在下游临时猜人物。
          </p>

          <div className="meta-list">
            <span>角色草案 {characters.length}</span>
            <span>项目阶段 {getProjectStageLabel(project.stage)}</span>
            <span>主角 {roleCounts.protagonist}</span>
            <span>对手 {roleCounts.antagonist}</span>
            <span>配角 {roleCounts.support}</span>
            <span>已锁字段 {totalLockedFields}</span>
          </div>

          <CharacterGenerateButton projectId={project.id} />

          <div className="action-row wrap-row">
            <Link href={buildProjectHref('/story-setup', project.id)} className="button-ghost">返回故事设定</Link>
            <Link href={buildProjectHref('/visual-bible', project.id)} className="button-secondary">查看视觉圣经</Link>
            <Link href={buildProjectHref('/adaptation-lab', project.id)} className="button-secondary">继续进入改编</Link>
          </div>
        </section>

        <aside className="character-command-side">
          <div className="character-kpi-grid">
            <div className="asset-tile character-kpi-card">
              <span className="label">角色覆盖</span>
              <h4>{characters.length}</h4>
              <p>当前已经沉淀出 {characters.length} 张角色卡，可直接进入故事与镜头链路。</p>
            </div>

            <div className="asset-tile character-kpi-card">
              <span className="label">锁定程度</span>
              <h4>{totalLockedFields}</h4>
              <p>关键字段一旦锁定，后续整套或局部重生都不会覆盖这些角色设定。</p>
            </div>

            <div className="asset-tile character-kpi-card">
              <span className="label">声线就绪</span>
              <h4>{voiceReadyCount}</h4>
              <p>{voiceReadyCount} / {characters.length || 1} 个角色已经写入说话方式。</p>
            </div>

            <div className="asset-tile character-kpi-card">
              <span className="label">视觉锚点</span>
              <h4>{anchorReadyCount}</h4>
              <p>{anchorReadyCount} / {characters.length || 1} 个角色已经具备可延续到视觉阶段的外形锚点。</p>
            </div>
          </div>
        </aside>
      </div>

      {syncStatus ? (
        <div className="asset-grid">
          <SyncNoticeCard card={syncStatus.cards.character} />
        </div>
      ) : null}

      {characters.length === 0 ? (
        <div className="asset-tile">
          <span className="label">空状态</span>
          <h4>还没有角色草案</h4>
          <p>点击上方按钮，基于当前故事草案自动生成角色卡初稿。</p>
        </div>
      ) : (
        <>
          <SectionCard
            eyebrow="Readiness"
            title="角色准备度"
            description="先确认角色结构是否完整，再决定是继续锁定、补声线，还是直接推进改编。"
          >
            <div className="character-health-grid">
              <div className="asset-tile character-highlight-card">
                <span className="label">故事前提</span>
                <h4>{project.premise || '暂无故事前提'}</h4>
                <p>角色草案会持续围绕这个前提做重生和修订。</p>
              </div>

              <div className="asset-tile character-highlight-card">
                <span className="label">角色分工</span>
                <h4>主角 / 对手 / 配角</h4>
                <div className="tag-list">
                  <span className="tag-chip">主角 {roleCounts.protagonist}</span>
                  <span className="tag-chip">对手 {roleCounts.antagonist}</span>
                  <span className="tag-chip">配角 {roleCounts.support}</span>
                </div>
              </div>

              <div className="asset-tile character-highlight-card">
                <span className="label">锁定状态</span>
                <h4>{totalLockedFields > 0 ? '已有关键保护' : '建议开始锁定'}</h4>
                <p>{totalLockedFields > 0 ? `当前共有 ${totalLockedFields} 个字段已被锁定。` : '建议优先锁定角色名、定位和剧情目标，避免下游漂移。'} </p>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            eyebrow="Cast"
            title="角色卡总览"
            description="每张卡只保留真正影响后续生成的设定：定位、目标、冲突、声线和视觉锚点。"
          >
            <div className="character-card-grid">
              {characters.map((character) => {
                const lockedFields = getLockedFieldLabels(character);

                return (
                  <article key={`${character.role}-${character.name}`} className="asset-tile scene-tile character-card">
                    <div className="character-card-head">
                      <div>
                        <span className="label">{roleLabel(character.role)}</span>
                        <h4>{character.name}</h4>
                      </div>
                      <span className="status-pill status-pill-subtle">{lockedFields.length > 0 ? `${lockedFields.length} 项已锁定` : '可继续定稿'}</span>
                    </div>

                    <p>{character.archetype}</p>

                    {lockedFields.length > 0 ? (
                      <div className="tag-list">
                        {lockedFields.map((field) => (
                          <span key={`${character.role}-${field}`} className="tag-chip">{field}</span>
                        ))}
                      </div>
                    ) : null}

                    <div className="shot-list">
                      <div className="shot-item">
                        <strong>剧情目标</strong>
                        <span>{character.goal}</span>
                      </div>
                      <div className="shot-item">
                        <strong>核心冲突</strong>
                        <span>{character.conflict}</span>
                      </div>
                      <div className="shot-item">
                        <strong>说话方式</strong>
                        <span>{character.voiceStyle}</span>
                      </div>
                      <div className="shot-item">
                        <strong>视觉锚点</strong>
                        <span>{character.visualAnchor}</span>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </SectionCard>

          <SectionCard
            eyebrow="Editor"
            title="角色定稿台"
            description="这里负责逐个角色做人工修订、锁定和局部重生，确保故事主角群稳定传递到下游。"
          >
            <CharacterEditor projectId={project.id} initialCharacters={characters} />
          </SectionCard>
        </>
      )}
    </div>
  );
}

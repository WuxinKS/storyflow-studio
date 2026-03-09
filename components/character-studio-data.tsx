import Link from 'next/link';
import { CharacterGenerateButton } from '@/components/character-generate-button';
import { CharacterEditor } from '@/components/character-editor';
import { SyncNoticeCard } from '@/components/sync-notice-card';
import { getCharacterDraftBundle, getLatestCharacterProject } from '@/features/characters/service';
import { getSyncStatus } from '@/features/sync/service';
import { getProjectStageLabel } from '@/lib/display';

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

export async function CharacterStudioData() {
  const project = await getLatestCharacterProject().catch(() => null);

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

  return (
    <div className="page-stack">
      <div className="snapshot-card">
        <p className="eyebrow">角色工作台</p>
        <h3>{project.title}</h3>
        <p>{project.premise || '暂无故事前提'}</p>
        <div className="meta-list">
          <span>角色草案数：{characters.length}</span>
          <span>当前阶段：{getProjectStageLabel(project.stage)}</span>
        </div>
        <CharacterGenerateButton projectId={project.id} />
        <div className="action-row">
          <Link href="/story-setup" className="button-ghost">返回故事设定</Link>
          <Link href="/adaptation-lab" className="button-secondary">继续进入改编</Link>
        </div>
      </div>

      {syncStatus ? (
        <div className="asset-grid">
          <SyncNoticeCard card={syncStatus.cards.character} />
        </div>
      ) : null}

      <div className="asset-grid three-up">
        <div className="asset-tile">
          <span className="label">当前说明</span>
          <h4>角色系统 v2</h4>
          <p>当前版本已支持角色草案生成、手动修订保存、关键字段锁定，以及保留锁定项的整套 / 局部重生。</p>
        </div>
        <div className="asset-tile">
          <span className="label">当前能力</span>
          <h4>锁定与局部控制已接通</h4>
          <p>现在可以锁定角色名、定位、原型、目标和冲突，让重生时只更新你愿意放开的字段。</p>
        </div>
        <div className="asset-tile">
          <span className="label">当前作用</span>
          <h4>先做上游统一</h4>
          <p>现在的重点是让故事、角色、改编三层开始共享同一批可人工定稿的角色认知，而不是只在镜头阶段临时猜角色。</p>
        </div>
      </div>

      <div className="asset-grid">
        {characters.length === 0 ? (
          <div className="asset-tile">
            <span className="label">空状态</span>
            <h4>还没有角色草案</h4>
            <p>点击上方按钮，基于当前故事草案自动生成角色卡初稿。</p>
          </div>
        ) : (
          characters.map((character) => {
            const lockedFields = getLockedFieldLabels(character);
            return (
              <div key={`${character.role}-${character.name}`} className="asset-tile scene-tile">
                <span className="label">{roleLabel(character.role)}</span>
                <h4>{character.name}</h4>
                <p>{character.archetype}</p>
                {lockedFields.length > 0 ? (
                  <div className="tag-list">
                    {lockedFields.map((field) => (
                      <span key={`${character.role}-${field}`} className="tag-chip">已锁定：{field}</span>
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
              </div>
            );
          })
        )}
      </div>

      <CharacterEditor projectId={project.id} initialCharacters={characters} />
    </div>
  );
}

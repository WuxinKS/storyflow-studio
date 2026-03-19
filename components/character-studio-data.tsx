import Link from 'next/link';
import { CharacterGenerateButton } from '@/components/character-generate-button';
import { CharacterEditor } from '@/components/character-editor';
import { SectionCard } from '@/components/section-card';
import { SyncNoticeCard } from '@/components/sync-notice-card';
import { getCharacterDraftBundle, getLatestCharacterProject } from '@/features/characters/service';
import { getSyncStatus } from '@/features/sync/service';
import { getVisualBibleBundle } from '@/features/visual/service';
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

function getCharacterMission(input: {
  characterCount: number;
  totalLockedFields: number;
  hasVisualBible: boolean;
  projectId: string;
}) {
  if (input.characterCount === 0) {
    return {
      status: '待生成角色卡',
      title: '先生成首版角色卡',
      guidance: '让系统先给出主角、对手和关键配角初稿，再开始人工定稿。',
      kind: 'generate' as const,
    };
  }

  if (input.totalLockedFields < 6) {
    return {
      status: '待锁定核心角色',
      title: '先锁定主角和对手',
      guidance: '优先锁角色名、定位、目标和冲突，避免后面自动分镜和生成链漂移。',
      kind: 'link' as const,
      actionHref: '#character-editor',
      actionLabel: '去角色定稿台',
    };
  }

  if (!input.hasVisualBible) {
    return {
      status: '待统一视觉规则',
      title: '补齐视觉统一规则',
      guidance: '角色已经稳定，下一步把色彩、光线和镜头语言统一成同一套视觉认知。',
      kind: 'link' as const,
      actionHref: buildProjectHref('/visual-bible', input.projectId),
      actionLabel: '去补视觉规则',
    };
  }

  return {
    status: '可进入自动分镜',
    title: '进入自动分镜',
    guidance: '角色和视觉已经能稳定承接故事，下一步可以正式拆成 scene / shot。',
    kind: 'link' as const,
    actionHref: buildProjectHref('/adaptation-lab', input.projectId),
    actionLabel: '进入自动分镜',
  };
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
  const visualBible = getVisualBibleBundle(project);
  const visualLockCount = visualBible ? Object.values(visualBible.locks).filter(Boolean).length : 0;
  const castPreview = characters.slice(0, 3);
  const remainingCast = characters.slice(castPreview.length);
  const characterMission = getCharacterMission({
    characterCount: characters.length,
    totalLockedFields,
    hasVisualBible: Boolean(visualBible?.styleName),
    projectId: project.id,
  });

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

          <div className="asset-tile character-focus-card">
            <span className="label">当前主任务</span>
            <h4>{characterMission.title}</h4>
            <p>{characterMission.guidance}</p>
            {characterMission.kind === 'generate' ? (
              <CharacterGenerateButton projectId={project.id} mode="create" />
            ) : (
              <div className="page-stack">
                <div className="action-row wrap-row">
                  <a href={characterMission.actionHref} className="button-primary">{characterMission.actionLabel}</a>
                </div>
                <details className="workflow-disclosure">
                  <summary>需要时刷新角色卡</summary>
                  <div className="workflow-disclosure-body">
                    <CharacterGenerateButton projectId={project.id} mode="refresh" />
                  </div>
                </details>
              </div>
            )}
          </div>

          <div className="action-row wrap-row">
            <Link href={buildProjectHref('/story-setup', project.id)} className="button-ghost">返回故事设定</Link>
            <Link href={buildProjectHref('/visual-bible', project.id)} className="button-secondary">查看视觉圣经</Link>
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

            <div className="asset-tile character-kpi-card">
              <span className="label">视觉统一</span>
              <h4>{visualBible ? '已建立' : '待补齐'}</h4>
              <p>{visualBible ? `当前已锁 ${visualLockCount} 项视觉规则，可继续把人物送进自动分镜。` : '建议先补一版视觉圣经，让角色外形和镜头气质统一。'} </p>
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
          <p>先生成首版角色卡，再开始锁定主角、对手和关键配角。</p>
        </div>
      ) : (
        <>
          <SectionCard
            eyebrow="Readiness"
            title="角色与视觉只看这三件事"
            description="这一页先确认角色是否齐、关键字段是否锁、视觉是否已经统一。"
          >
            <div className="character-health-grid">
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
                <h4>{totalLockedFields > 0 ? `${totalLockedFields} 项已锁定` : '建议开始锁定'}</h4>
                <p>{totalLockedFields > 0 ? '被锁定的字段在后续刷新中会继续保留。' : '建议优先锁定角色名、定位、目标和冲突。'} </p>
              </div>

              <div className="asset-tile character-highlight-card">
                <span className="label">视觉统一</span>
                <h4>{visualBible?.styleName || '还没有视觉圣经'}</h4>
                <p>{visualBible ? '角色外形锚点已经可以和色彩、光线、镜头语言共用一套世界观。' : '建议在进入自动分镜前，先补一版视觉规则。'} </p>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            eyebrow="Cast"
            title="先看关键角色卡"
            description="默认先展示最关键的几张卡，完整角色库和定稿台按需再展开。"
          >
            <div className="character-card-grid">
              {castPreview.map((character) => {
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
          {remainingCast.length > 0 ? (
            <details className="workflow-disclosure">
              <summary>展开剩余 {remainingCast.length} 张角色卡</summary>
              <div className="workflow-disclosure-body">
                <div className="character-card-grid">
                  {remainingCast.map((character) => {
                    const lockedFields = getLockedFieldLabels(character);

                    return (
                      <article key={`${character.role}-${character.name}-rest`} className="asset-tile scene-tile character-card">
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
                              <span key={`${character.role}-${field}-rest`} className="tag-chip">{field}</span>
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
              </div>
            </details>
          ) : null}

          <details className="workflow-disclosure">
            <summary>查看视觉统一摘要</summary>
            <div className="workflow-disclosure-body">
              <SectionCard
                eyebrow="Visual Continuity"
                title="视觉统一摘要"
                description="不用立刻跳页，也能先判断角色是否已经连上统一的视觉规则。"
                actions={<Link href={buildProjectHref('/visual-bible', project.id)} className="button-ghost">打开视觉圣经</Link>}
              >
                {visualBible ? (
                  <div className="asset-grid two-up">
                    <div className="asset-tile">
                      <span className="label">风格名</span>
                      <h4>{visualBible.styleName}</h4>
                      <p>{visualBible.visualTone}</p>
                    </div>
                    <div className="asset-tile">
                      <span className="label">核心规则</span>
                      <div className="shot-list">
                        <div className="shot-item">
                          <strong>色彩</strong>
                          <span>{visualBible.palette}</span>
                        </div>
                        <div className="shot-item">
                          <strong>光线</strong>
                          <span>{visualBible.lighting}</span>
                        </div>
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
                  </div>
                ) : (
                  <div className="asset-tile">
                    <span className="label">空状态</span>
                    <h4>还没有视觉统一规则</h4>
                    <p>角色已经有了外形锚点，但还没有统一成一套色彩、光线和镜头语言规则。</p>
                  </div>
                )}
              </SectionCard>
            </div>
          </details>

          <details id="character-editor" className="workflow-disclosure module-anchor">
            <summary>打开角色定稿台</summary>
            <div className="workflow-disclosure-body">
              <SectionCard
                eyebrow="Editor"
                title="角色定稿台"
                description="这里负责逐个角色做人工修订、锁定和局部重生，确保故事主角群稳定传递到下游。"
              >
                <CharacterEditor projectId={project.id} initialCharacters={characters} />
              </SectionCard>
            </div>
          </details>
        </>
      )}
    </div>
  );
}

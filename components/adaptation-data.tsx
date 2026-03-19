import Link from 'next/link';
import { AdaptationGenerateButton } from '@/components/adaptation-generate-button';
import { SectionCard } from '@/components/section-card';
import { SyncNoticeCard } from '@/components/sync-notice-card';
import { getLatestProjectWithChapters } from '@/features/adaptation/service';
import { isGeneratedNovelChapterTitle, isStoryEngineChapterTitle } from '@/features/story/service';
import { getSyncStatus } from '@/features/sync/service';
import { buildProjectHref } from '@/lib/project-links';

function extractReferenceTitle(notes: string | null) {
  return notes?.split('\n').find((line) => line.startsWith('标题：'))?.replace('标题：', '').trim() || '未命名参考';
}

function hasDirectorLanguage(text: string | null) {
  if (!text) return false;
  return text.includes('导演处理上强调') || text.includes('镜头重点放在');
}

function getShotKind(title: string) {
  return title.split(' - ').pop() || title;
}

function toPercent(part: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

function truncateText(value: string, limit: number) {
  if (value.length <= limit) return value;
  return `${value.slice(0, limit).trim()}…`;
}

function resolveAdaptationSource(chapters: Array<{ title: string }>) {
  const latestAiChapter = chapters.find((chapter) => isGeneratedNovelChapterTitle(chapter.title));
  if (latestAiChapter) {
    return {
      label: 'AI 小说正文',
      detail: latestAiChapter.title,
      guidance: '这是当前最优先的改编来源，最适合直接拆成可执行的 scene / shot。',
    };
  }

  const latestManualChapter = chapters.find((chapter) => !isStoryEngineChapterTitle(chapter.title));
  if (latestManualChapter) {
    return {
      label: '手写 / 普通章节',
      detail: latestManualChapter.title,
      guidance: '当前会从人工正文继续做结构化拆解，适合人工打磨后的精确改编。',
    };
  }

  const sceneSeedChapter = chapters.find((chapter) => chapter.title === 'Story Engine Scene Seeds');
  if (sceneSeedChapter) {
    return {
      label: '结构分场种子',
      detail: sceneSeedChapter.title,
      guidance: '当前只能从结构层继续往下推，适合先搭出镜头骨架。',
    };
  }

  return {
    label: '暂无可用源',
    detail: '请先生成小说或故事结构。',
    guidance: '先回到故事和章节环节补正文，再来做导演级拆解。',
  };
}

function getAdaptationMission(input: {
  hasSource: boolean;
  hasOutput: boolean;
  projectId: string;
}) {
  if (!input.hasSource) {
    return {
      status: '待补可改编正文',
      title: '先回去补故事正文',
      guidance: '自动分镜优先吃正文，没有可改编文本时，这一页先不要继续往下推。',
      kind: 'link' as const,
      actionHref: buildProjectHref('/story-setup', input.projectId),
      actionLabel: '回到故事设定',
    };
  }

  if (!input.hasOutput) {
    return {
      status: '待生成自动分镜',
      title: '先生成首版自动分镜',
      guidance: '把最新正文拆成 scene / shot，后面图片和视频生成才会有稳定输入。',
      kind: 'generate' as const,
    };
  }

  return {
    status: '可进入分镜板',
    title: '进入分镜板精修',
    guidance: 'scene / shot 已经生成，这里可以先交给分镜板做逐镜头精修和参考绑定。',
    kind: 'link' as const,
    actionHref: buildProjectHref('/storyboard', input.projectId),
    actionLabel: '进入分镜板',
  };
}

export async function AdaptationData({ projectId }: { projectId?: string }) {
  const project = await getLatestProjectWithChapters(projectId).catch(() => null);

  if (!project) {
    return (
      <div className="asset-tile">
        <span className="label">空状态</span>
        <h4>暂无可改编项目</h4>
        <p>先去创意工坊和章节工作台创建项目与章节。</p>
      </div>
    );
  }

  const adaptationSource = resolveAdaptationSource(project.chapters);
  const groupedShots = project.scenes.map((scene) => ({
    scene,
    shots: project.shots.filter((shot) => shot.sceneId === scene.id),
  }));
  const references = project.references ?? [];
  const syncStatus = await getSyncStatus(project.id).catch(() => null);
  const directorReadyCount = project.scenes.filter((scene) => hasDirectorLanguage(scene.summary)).length;
  const dynamicShotKinds = Array.from(new Set(project.shots.map((shot) => getShotKind(shot.title)))).filter(Boolean);
  const shotCount = project.shots.length;
  const directorRate = toPercent(directorReadyCount, project.scenes.length);
  const averageShotsPerScene = project.scenes.length > 0 ? Math.round((shotCount / project.scenes.length) * 10) / 10 : 0;
  const hasAdaptationSource = adaptationSource.label !== '暂无可用源';
  const hasAdaptationOutput = project.scenes.length > 0 && shotCount > 0;
  const scenePreview = groupedShots.slice(0, 3);
  const overflowSceneGroups = groupedShots.slice(scenePreview.length);
  const adaptationMission = getAdaptationMission({
    hasSource: hasAdaptationSource,
    hasOutput: hasAdaptationOutput,
    projectId: project.id,
  });

  return (
    <div className="page-stack">
      <div className="adapt-command-grid">
        <section className="snapshot-card adapt-command-card">
          <div className="adapt-panel-head">
            <div>
              <p className="eyebrow">Adaptation Command</p>
              <h3>{project.title}</h3>
            </div>
            <span className="status-pill status-pill-subtle">{adaptationSource.label}</span>
          </div>

          <p>
            这一站的重点不再是“看一堆 scene / shot 文本”，而是先确认改编源、再判断拆解质量，最后决定是否进入分镜板。
          </p>

          <div className="meta-list">
            <span>来源 {adaptationSource.detail}</span>
            <span>分场 {project.scenes.length}</span>
            <span>镜头 {shotCount}</span>
            <span>参考 {references.length}</span>
            <span>镜头类型 {dynamicShotKinds.length}</span>
          </div>

          <div className="asset-tile adapt-focus-card">
            <span className="label">当前主任务</span>
            <h4>{adaptationMission.title}</h4>
            <p>{adaptationMission.guidance}</p>
            {adaptationMission.kind === 'generate' ? (
              <AdaptationGenerateButton projectId={project.id} mode="create" />
            ) : (
              <div className="page-stack">
                <div className="action-row wrap-row">
                  <a href={adaptationMission.actionHref} className="button-primary">{adaptationMission.actionLabel}</a>
                </div>
                {hasAdaptationSource ? (
                  <details className="workflow-disclosure">
                    <summary>需要时刷新自动分镜</summary>
                    <div className="workflow-disclosure-body">
                      <AdaptationGenerateButton projectId={project.id} mode="refresh" />
                    </div>
                  </details>
                ) : null}
              </div>
            )}
          </div>

          <div className="action-row wrap-row">
            <Link href={buildProjectHref('/chapter-studio', project.id)} className="button-ghost">返回章节工作台</Link>
            <Link href={buildProjectHref('/reference-lab', project.id)} className="button-secondary">管理参考素材</Link>
          </div>
        </section>

        <aside className="adapt-command-side">
          <div className="adapt-kpi-grid">
            <div className="asset-tile adapt-kpi-card">
              <span className="label">导演语言覆盖</span>
              <h4>{directorRate}%</h4>
              <div className="progress-strip">
                <span className="progress-fill progress-fill-accent-2" style={{ width: `${directorRate}%` }} />
              </div>
              <p>{directorReadyCount} / {project.scenes.length} 个分场已经是导演语言增强版。</p>
            </div>

            <div className="asset-tile adapt-kpi-card">
              <span className="label">镜头密度</span>
              <h4>{averageShotsPerScene}</h4>
              <p>当前每场平均约 {averageShotsPerScene} 个镜头，适合继续判断是否需要补镜头层次。</p>
            </div>

            <div className="asset-tile adapt-kpi-card">
              <span className="label">参考注入</span>
              <h4>{references.length > 0 ? '已接入' : '待补参考'}</h4>
              <p>{references.length > 0 ? '构图、情绪和动作节奏已经能注入改编链。' : '建议先去参考实验室补几张关键参考。'}</p>
            </div>

            <div className="asset-tile adapt-kpi-card">
              <span className="label">当前来源</span>
              <h4>{adaptationSource.label}</h4>
              <p>{adaptationSource.guidance}</p>
            </div>
          </div>
        </aside>
      </div>

      {syncStatus ? (
        <div className="asset-grid">
          <SyncNoticeCard card={syncStatus.cards.adaptation} />
        </div>
      ) : null}

      <SectionCard
        eyebrow="Readiness"
        title="自动分镜先看这四件事"
        description="不再先读大段文本，而是先判断来源、输出密度、参考和镜头语言是否可用。"
      >
        <div className="adapt-readiness-grid">
          <div className="asset-tile adapt-highlight-card">
            <span className="label">改编源</span>
            <h4>{adaptationSource.detail}</h4>
            <p>{adaptationSource.guidance}</p>
          </div>

          <div className="asset-tile adapt-highlight-card">
            <span className="label">参考素材</span>
            <h4>{references[0] ? extractReferenceTitle(references[0].notes) : '暂无参考条目'}</h4>
            <p>{references[0]?.notes?.split('\n').slice(1, 3).join(' / ') || '当前没有参考分析，系统会按基础规则生成。'}</p>
          </div>

          <div className="asset-tile adapt-highlight-card">
            <span className="label">输出逻辑</span>
            <h4>小说优先，结构回退</h4>
            <p>当前会优先吃正文，其次吃普通章节，最后才回退 Story Engine 分场种子。</p>
          </div>

          <div className="asset-tile adapt-highlight-card">
            <span className="label">镜头类型</span>
            <h4>{dynamicShotKinds.length > 0 ? `${dynamicShotKinds.length} 类` : '暂无镜头类型'}</h4>
            {dynamicShotKinds.length > 0 ? (
              <div className="tag-list">
                {dynamicShotKinds.map((kind) => (
                  <span key={kind} className="tag-chip">{kind}</span>
                ))}
              </div>
            ) : (
              <p>先跑出改编结果后，这里会显示当前镜头语言分布。</p>
            )}
          </div>
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Scene Breakdown"
        title="场次总览"
        description="默认先看前三场是否成立，只有需要时再展开每场镜头细节和剩余场次。"
      >
        <div className="adapt-scene-grid">
          {scenePreview.length === 0 ? (
            <div className="asset-tile">
              <span className="label">空状态</span>
              <h4>还没有分场 / 镜头</h4>
              <p>点击上方按钮，基于当前优先源自动生成第一版结构化改编结果。</p>
            </div>
          ) : (
            scenePreview.map(({ scene, shots }) => (
              <section key={scene.id} className="snapshot-card adapt-scene-card">
                <div className="adapt-scene-head">
                  <div className="adapt-scene-copy">
                    <p className="eyebrow">Scene {String(scene.orderIndex).padStart(2, '0')}</p>
                    <h3>{scene.title}</h3>
                    <p>{scene.summary ? truncateText(scene.summary, 110) : '暂无摘要'}</p>
                  </div>

                  <div className="adapt-scene-side">
                    <span className="status-pill status-pill-subtle">{hasDirectorLanguage(scene.summary) ? '导演语言增强' : '基础拆解版'}</span>
                    <div className="meta-list">
                      <span>镜头数 {shots.length}</span>
                      <span>状态 {hasDirectorLanguage(scene.summary) ? '可直接分镜' : '建议继续增强'}</span>
                    </div>
                  </div>
                </div>

                {shots.length > 0 ? (
                  <details className="workflow-disclosure">
                    <summary>查看本场 {shots.length} 个镜头</summary>
                    <div className="workflow-disclosure-body">
                      <div className="adapt-shot-grid">
                        {shots.map((shot, index) => (
                              <div key={shot.id} className="asset-tile adapt-shot-card">
                                <span className="label">镜头 {String(index + 1).padStart(2, '0')}</span>
                                <h4>{shot.title}</h4>
                                <p>{truncateText(shot.cameraNotes || shot.prompt || '暂无镜头备注', 80)}</p>
                                <p><strong>提示词：</strong>{truncateText(shot.prompt || '暂无镜头提示词', 90)}</p>
                              </div>
                            ))}
                          </div>
                    </div>
                  </details>
                ) : null}
              </section>
            ))
          )}
        </div>
        {overflowSceneGroups.length > 0 ? (
          <details className="workflow-disclosure">
            <summary>展开剩余 {overflowSceneGroups.length} 场</summary>
            <div className="workflow-disclosure-body">
              <div className="adapt-scene-grid">
                {overflowSceneGroups.map(({ scene, shots }) => (
                  <section key={`${scene.id}-rest`} className="snapshot-card adapt-scene-card">
                    <div className="adapt-scene-head">
                      <div className="adapt-scene-copy">
                        <p className="eyebrow">Scene {String(scene.orderIndex).padStart(2, '0')}</p>
                        <h3>{scene.title}</h3>
                        <p>{scene.summary ? truncateText(scene.summary, 110) : '暂无摘要'}</p>
                      </div>

                      <div className="adapt-scene-side">
                        <span className="status-pill status-pill-subtle">{hasDirectorLanguage(scene.summary) ? '导演语言增强' : '基础拆解版'}</span>
                        <div className="meta-list">
                          <span>镜头数 {shots.length}</span>
                          <span>状态 {hasDirectorLanguage(scene.summary) ? '可直接分镜' : '建议继续增强'}</span>
                        </div>
                      </div>
                    </div>

                    {shots.length > 0 ? (
                      <details className="workflow-disclosure">
                        <summary>查看本场 {shots.length} 个镜头</summary>
                        <div className="workflow-disclosure-body">
                          <div className="adapt-shot-grid">
                            {shots.map((shot, index) => (
                              <div key={`${shot.id}-rest`} className="asset-tile adapt-shot-card">
                                <span className="label">镜头 {String(index + 1).padStart(2, '0')}</span>
                                <h4>{shot.title}</h4>
                                <p>{truncateText(shot.cameraNotes || shot.prompt || '暂无镜头备注', 80)}</p>
                                <p><strong>提示词：</strong>{truncateText(shot.prompt || '暂无镜头提示词', 90)}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </details>
                    ) : null}
                  </section>
                ))}
              </div>
            </div>
          </details>
        ) : null}
      </SectionCard>
    </div>
  );
}

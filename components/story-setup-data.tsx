import Link from 'next/link';
import {
  getLatestProject,
  getStoryDraftBundle,
  isGeneratedNovelChapterTitle,
  isStoryEngineChapterTitle,
} from '@/features/story/service';
import { SectionCard } from '@/components/section-card';
import { getSyncStatus } from '@/features/sync/service';
import { StoryGenerateButton } from '@/components/story-generate-button';
import { SyncNoticeCard } from '@/components/sync-notice-card';
import { getProjectStageLabel } from '@/lib/display';
import { buildProjectHref } from '@/lib/project-links';

function truncateText(value: string, limit: number) {
  if (value.length <= limit) return value;
  return `${value.slice(0, limit).trim()}…`;
}

function getStoryMission(input: {
  hasSynopsis: boolean;
  hasBeats: boolean;
  hasScenes: boolean;
  hasAiNovel: boolean;
  projectId: string;
}) {
  if (!input.hasSynopsis) {
    return {
      status: '待建立方向',
      title: '先生成故事梗概',
      guidance: '先把故事总方向拉出来，确认 premise、冲突和人物命运有没有站稳。',
      kind: 'generate' as const,
      primaryAction: 'generate-synopsis' as const,
      primaryLabel: '生成故事梗概',
      primaryLoadingLabel: '正在生成故事梗概…',
      helperText: '这一步只定总方向，暂时不动节拍和正文。',
    };
  }

  if (!input.hasBeats) {
    return {
      status: '待拉清节奏',
      title: '把故事推进成节拍',
      guidance: '现在已经有故事方向，下一步先把起承转合和关键反转拉清楚。',
      kind: 'generate' as const,
      primaryAction: 'generate-beats' as const,
      primaryLabel: '生成结构节拍',
      primaryLoadingLabel: '正在生成结构节拍…',
      helperText: '只补节拍层，不会重做下游正文。',
    };
  }

  if (!input.hasScenes) {
    return {
      status: '待拆成场次',
      title: '把节拍拆成分场种子',
      guidance: '把故事节拍落成可执行的场次，后面角色、自动分镜和图片生成才有明确抓手。',
      kind: 'generate' as const,
      primaryAction: 'generate-scenes' as const,
      primaryLabel: '生成分场种子',
      primaryLoadingLabel: '正在生成分场种子…',
      helperText: '这一步会把结构变成场次，不会直接重写完整小说。',
    };
  }

  if (!input.hasAiNovel) {
    return {
      status: '待补正文',
      title: '生成可改编的 AI 小说正文',
      guidance: '角色与自动分镜优先吃正文，所以这里先把故事骨架推成一版可读正文。',
      kind: 'generate' as const,
      primaryAction: 'generate-chapters' as const,
      primaryLabel: '生成 AI 小说正文',
      primaryLoadingLabel: '正在生成 AI 小说正文…',
      helperText: '有了正文后，后续自动分镜会更稳定。',
    };
  }

  return {
    status: '故事包已就绪',
    title: '进入角色与视觉',
    guidance: '梗概、节拍、分场和 AI 正文已经齐了，这一页先交棒给角色与视觉去继续统一人物和风格。',
    kind: 'link' as const,
    actionHref: buildProjectHref('/character-studio', input.projectId),
    actionLabel: '进入角色与视觉',
  };
}

export async function StorySetupData({ projectId }: { projectId?: string }) {
  const project = await getLatestProject(projectId).catch(() => null);

  if (!project) {
    return (
      <div className="asset-grid">
        <div className="asset-tile">
          <span className="label">空状态</span>
          <h4>还没有可用项目</h4>
          <p>先去创意工坊创建项目，故事设定页才能展示世界观和故事草案数据。</p>
        </div>
      </div>
    );
  }

  const idea = project.ideaSeeds[0];
  const visibleChapters = project.chapters.filter((item) => !isStoryEngineChapterTitle(item.title));
  const aiChapterCount = visibleChapters.filter((item) => isGeneratedNovelChapterTitle(item.title)).length;
  const manualChapterCount = visibleChapters.length - aiChapterCount;
  const storyDraft = getStoryDraftBundle(project);
  const syncStatus = await getSyncStatus(project.id).catch(() => null);
  const ideaInput = idea?.input?.trim() || '';
  const hasIdeaInput = Boolean(ideaInput);
  const hasSynopsis = project.outlines.some((item) => item.title === 'Story Engine Synopsis');
  const hasBeats = project.chapters.some((item) => item.title === 'Story Engine Beat Sheet');
  const hasScenes = project.chapters.some((item) => item.title === 'Story Engine Scene Seeds');
  const hasAiNovel = aiChapterCount > 0;
  const storyPackageCount = [hasSynopsis, hasBeats, hasScenes, hasAiNovel].filter(Boolean).length;
  const storyPackagePercent = Math.round((storyPackageCount / 4) * 100);
  const storyMission = getStoryMission({
    hasSynopsis,
    hasBeats,
    hasScenes,
    hasAiNovel,
    projectId: project.id,
  });
  const previewScenes = storyDraft.scenes.slice(0, 2);
  const overflowSceneCount = Math.max(storyDraft.scenes.length - previewScenes.length, 0);
  const packageCards = [
    {
      label: '故事梗概',
      ready: hasSynopsis,
      title: hasSynopsis ? '方向已稳定' : '待生成',
      detail: hasSynopsis
        ? storyDraft.synopsis
        : '先明确故事总方向，再决定节拍和分场。',
    },
    {
      label: '结构节拍',
      ready: hasBeats,
      title: hasBeats ? `${storyDraft.beats.length} 条节拍` : '待生成',
      detail: hasBeats
        ? '当前已经可以判断故事节奏是否顺畅。'
        : '把起承转合拉清楚，后续人物和改编才更稳。',
    },
    {
      label: '分场种子',
      ready: hasScenes,
      title: hasScenes ? `${storyDraft.scenes.length} 个场次` : '待生成',
      detail: hasScenes
        ? '现在已经能直接预览场次目标、冲突和情绪。'
        : '先拆成场次，再继续自动分镜和图片生成。',
    },
    {
      label: 'AI 小说正文',
      ready: hasAiNovel,
      title: hasAiNovel ? `${aiChapterCount} 章正文` : '待生成',
      detail: hasAiNovel
        ? '自动分镜会优先以这版正文作为主输入。'
        : '有了正文后，角色与自动分镜会更稳定。',
    },
  ];

  return (
    <div className="page-stack">
      <div className="story-control-grid">
        <section className="snapshot-card story-command-card">
          <div className="story-layer-head">
            <div>
              <p className="eyebrow">Story Mission</p>
              <h3>{project.title}</h3>
            </div>
            <span className="status-pill status-pill-subtle">{storyMission.status}</span>
          </div>
          <p>{project.premise || '暂无故事前提'}</p>
          <div className="meta-list">
            <span>题材：{project.genre || '未设定'}</span>
            <span>阶段：{getProjectStageLabel(project.stage)}</span>
            <span>手写章节：{manualChapterCount}</span>
            <span>AI 小说：{aiChapterCount}</span>
          </div>
          <div className="asset-tile story-focus-card">
            <span className="label">当前主任务</span>
            <h4>{storyMission.title}</h4>
            <p>{storyMission.guidance}</p>
            {storyMission.kind === 'generate' ? (
              <StoryGenerateButton
                projectId={project.id}
                primaryAction={storyMission.primaryAction}
                primaryLabel={storyMission.primaryLabel}
                primaryLoadingLabel={storyMission.primaryLoadingLabel}
                helperText={storyMission.helperText}
              />
            ) : (
              <div className="page-stack">
                <div className="action-row wrap-row">
                  <a href={storyMission.actionHref} className="button-primary">{storyMission.actionLabel}</a>
                </div>
                <details className="workflow-disclosure">
                  <summary>刚改过故事？这里刷新正文</summary>
                  <div className="workflow-disclosure-body">
                    <StoryGenerateButton
                      projectId={project.id}
                      primaryAction="generate-chapters"
                      primaryLabel="按最新故事刷新 AI 小说"
                      primaryLoadingLabel="正在刷新 AI 小说…"
                      helperText="如果上游梗概或分场已经调整，这里刷新一次正文即可。"
                    />
                  </div>
                </details>
              </div>
            )}
          </div>
          <div className="action-row wrap-row">
            <Link href={buildProjectHref('/idea-lab', project.id)} className="button-ghost">修改创意</Link>
            <Link href={buildProjectHref('/chapter-studio', project.id)} className="button-secondary">查看小说章节</Link>
          </div>
        </section>

        <aside className="story-command-side">
          <div className="story-health-grid">
            <div className="asset-tile">
              <span className="label">世界观输入</span>
              <h4>{hasIdeaInput ? '已写入' : '待补充'}</h4>
              <p>{ideaInput || '先把故事输入写清楚，后面的梗概和角色才不会飘。'}</p>
            </div>
            <div className="asset-tile">
              <span className="label">故事包进度</span>
              <h4>{storyPackageCount} / 4</h4>
              <div className="progress-strip">
                <span className="progress-fill progress-fill-accent-2" style={{ width: `${storyPackagePercent}%` }} />
              </div>
              <p>这一页只看四件事：梗概、节拍、分场、正文。</p>
            </div>
            <div className="asset-tile">
              <span className="label">下一站</span>
              <h4>{hasAiNovel ? '角色与视觉' : '先补正文'}</h4>
              <p>{hasAiNovel ? '故事包已经能交给角色与视觉继续稳定人物和风格。' : '正文没出来前，自动分镜与生成链的稳定性都会打折。'} </p>
            </div>
          </div>
        </aside>
      </div>

      {syncStatus ? (
        <div className="asset-grid">
          <SyncNoticeCard card={syncStatus.cards.story} />
        </div>
      ) : null}

      <SectionCard
        eyebrow="Story Package"
        title="这一页只确认四件事"
        description="不再堆满故事层级报告，只判断故事包是否能安全交给下游。"
      >
        <div className="asset-grid">
          {packageCards.map((item) => (
            <div key={item.label} className="asset-tile story-package-card">
              <div className="story-layer-head">
                <div>
                  <span className="label">{item.label}</span>
                  <h4>{item.title}</h4>
                </div>
                <span className="status-pill status-pill-subtle">{item.ready ? '已就绪' : '待处理'}</span>
              </div>
              <p>{item.detail}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Scene Preview"
        title="先看前两场有没有跑偏"
        description="默认只检查最前面的场次方向、冲突和情绪是否成立，完整分场按需再展开。"
      >
        {storyDraft.scenes.length > 0 ? (
          <div className="page-stack">
            <div className="scene-seed-grid">
              {previewScenes.map((scene, index) => (
                <div key={`${index}-${scene.title}`} className="asset-tile scene-seed-card">
                  <span className="label">场次 {index + 1}</span>
                  <h4>{scene.title}</h4>
                  <p>{truncateText(scene.summary, 110)}</p>
                  <div className="meta-list">
                    <span>目标：{scene.goal}</span>
                    <span>冲突：{scene.conflict}</span>
                    <span>情绪：{scene.emotion}</span>
                  </div>
                </div>
              ))}
            </div>
            {overflowSceneCount > 0 ? (
              <details className="workflow-disclosure">
                <summary>展开剩余 {overflowSceneCount} 场分场种子</summary>
                <div className="workflow-disclosure-body">
                  <div className="scene-seed-grid">
                    {storyDraft.scenes.slice(previewScenes.length).map((scene, index) => (
                      <div key={`${index}-${scene.title}-all`} className="asset-tile scene-seed-card">
                        <span className="label">场次 {previewScenes.length + index + 1}</span>
                        <h4>{scene.title}</h4>
                        <p>{scene.summary}</p>
                        <div className="meta-list">
                          <span>目标：{scene.goal}</span>
                          <span>冲突：{scene.conflict}</span>
                          <span>情绪：{scene.emotion}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </details>
            ) : null}
          </div>
        ) : (
          <div className="asset-tile">
            <span className="label">空状态</span>
            <h4>还没有分场种子</h4>
            <p>先完成故事梗概和结构节拍，再把节拍拆成场次。</p>
          </div>
        )}
      </SectionCard>

      <details className="workflow-disclosure">
        <summary>需要时查看下游接力方式</summary>
        <div className="workflow-disclosure-body">
          <SectionCard
            eyebrow="Downstream"
            title="完成这一页后，下游会怎么接力"
            description="只要这四件事稳定，后面就不再反复猜故事。"
          >
            <div className="asset-grid three-up">
              <div className="asset-tile">
                <span className="label">角色与视觉</span>
                <h4>人物和风格会继承故事骨架</h4>
                <p>角色卡、视觉圣经都会直接吃这里的梗概和分场，不再各自猜故事。</p>
              </div>
              <div className="asset-tile">
                <span className="label">自动分镜</span>
                <h4>正文会优先进入 scene / shot</h4>
                <p>只要 AI 小说正文生成出来，自动分镜就能更稳定地拆成场次与镜头。</p>
              </div>
              <div className="asset-tile">
                <span className="label">建议推进</span>
                <h4>一页只做一步</h4>
                <p>先补齐故事包，再进角色与视觉，然后再去自动分镜和生成工作台。</p>
              </div>
            </div>
          </SectionCard>
        </div>
      </details>
    </div>
  );
}

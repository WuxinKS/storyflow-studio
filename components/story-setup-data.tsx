import Link from 'next/link';
import {
  getLatestProject,
  getStoryDraftBundle,
  isGeneratedNovelChapterTitle,
  isStoryEngineChapterTitle,
} from '@/features/story/service';
import { getSyncStatus } from '@/features/sync/service';
import { StoryGenerateButton } from '@/components/story-generate-button';
import { SyncNoticeCard } from '@/components/sync-notice-card';
import { getProjectStageLabel } from '@/lib/display';

export async function StorySetupData() {
  const project = await getLatestProject().catch(() => null);

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

  return (
    <div className="page-stack">
      <div className="story-setup-grid">
        <div className="snapshot-card">
          <p className="eyebrow">最新项目</p>
          <h3>{project.title}</h3>
          <p>{project.premise || '暂无故事前提'}</p>
          <div className="meta-list">
            <span>题材：{project.genre || '未设定'}</span>
            <span>阶段：{getProjectStageLabel(project.stage)}</span>
            <span>手写章节：{manualChapterCount}</span>
            <span>AI 小说：{aiChapterCount}</span>
          </div>
          <StoryGenerateButton projectId={project.id} />
          <div className="action-row wrap-row">
            <Link href="/idea-lab" className="button-ghost">修改创意</Link>
            <Link href="/chapter-studio" className="button-secondary">查看小说章节</Link>
            <Link href="/adaptation-lab" className="button-secondary">进入改编工作台</Link>
          </div>
        </div>
      </div>

      {syncStatus ? (
        <div className="asset-grid">
          <SyncNoticeCard card={syncStatus.cards.story} />
        </div>
      ) : null}

      <div className="asset-grid three-up">
        <div className="asset-tile">
          <span className="label">世界观</span>
          <h4>世界观起点</h4>
          <p>{idea?.input || '待补充世界观输入'}</p>
        </div>
        <div className="asset-tile">
          <span className="label">风格</span>
          <h4>风格备注</h4>
          <p>{idea?.styleNotes || project.description || '待补充风格与输出策略'}</p>
        </div>
        <div className="asset-tile">
          <span className="label">故事引擎</span>
          <h4>分层重生 + 小说正文已接通</h4>
          <p>当前已支持按层重生故事梗概、结构节拍与分场种子，并直接批量生成 AI 小说章节，方便继续通往分镜与视频。</p>
        </div>
      </div>

      <div className="asset-grid three-up">
        <div className="asset-tile scene-tile">
          <span className="label">第 1 层</span>
          <h4>故事梗概</h4>
          <p>{storyDraft.synopsis}</p>
          <div className="meta-list">
            <span>作用：定义故事总方向</span>
            <span>建议：先定这一层，再继续下游</span>
          </div>
        </div>
        <div className="asset-tile scene-tile">
          <span className="label">第 2 层</span>
          <h4>结构节拍</h4>
          <div className="shot-list">
            {storyDraft.beats.length > 0 ? storyDraft.beats.map((beat, index) => (
              <div key={`${index}-${beat.slice(0, 12)}`} className="shot-item">
                <strong>节拍 {index + 1}</strong>
                <span>{beat}</span>
              </div>
            )) : <p>还没有生成结构节拍。</p>}
          </div>
        </div>
        <div className="asset-tile scene-tile">
          <span className="label">第 3 层</span>
          <h4>分场种子</h4>
          <div className="shot-list">
            {storyDraft.scenes.length > 0 ? storyDraft.scenes.slice(0, 3).map((scene, index) => (
              <div key={`${index}-${scene.title}`} className="shot-item">
                <strong>场次 {index + 1} · {scene.title}</strong>
                <span>{scene.summary}</span>
                <span>目标：{scene.goal}</span>
              </div>
            )) : <p>还没有生成分场种子。</p>}
          </div>
        </div>
      </div>

      <div className="asset-grid two-up">
        <div className="asset-tile">
          <span className="label">层级控制</span>
          <h4>分层控制逻辑</h4>
          <p>如果只是故事方向不满意，优先只重生故事梗概；如果大方向可以、但结构不顺，优先只重生结构节拍；如果只是想调整改编前分场骨架，优先只重生分场种子。</p>
        </div>
        <div className="asset-tile">
          <span className="label">依赖关系</span>
          <h4>层级依赖关系</h4>
          <p>故事梗概决定故事总方向，结构节拍负责推进节奏，分场种子负责给改编实验室提供可拆镜的场次骨架。越上层改动越大，越下层改动越局部。</p>
        </div>
      </div>

      <div className="asset-grid">
        <div className="asset-tile scene-tile">
          <span className="label">全部分场</span>
          <h4>完整分场种子列表</h4>
          <div className="shot-list">
            {storyDraft.scenes.length > 0 ? storyDraft.scenes.map((scene, index) => (
              <div key={`${index}-${scene.title}-full`} className="shot-item">
                <strong>场次 {index + 1} · {scene.title}</strong>
                <span>{scene.summary}</span>
                <span>目标：{scene.goal}</span>
                <span>冲突：{scene.conflict}</span>
                <span>情绪：{scene.emotion}</span>
              </div>
            )) : <p>还没有生成分场种子。</p>}
          </div>
        </div>
      </div>

      <div className="asset-grid three-up">
        <div className="asset-tile">
          <span className="label">角色</span>
          <h4>角色卡（下一步）</h4>
          <p>后续角色系统会继续围绕这三层故事草案工作，而不是只从最终镜头里反推角色。</p>
        </div>
        <div className="asset-tile">
          <span className="label">视觉</span>
          <h4>视觉圣经（下一步）</h4>
          <p>后续视觉总控也会更明确地读取 story layers，保证风格与结构一起稳定下来。</p>
        </div>
        <div className="asset-tile">
          <span className="label">建议路线</span>
          <h4>当前建议</h4>
          <p>先在这里把三层故事草案调顺，再批量生成 AI 小说正文，最后进入改编实验室做下游分镜和渲染准备。</p>
        </div>
      </div>
    </div>
  );
}

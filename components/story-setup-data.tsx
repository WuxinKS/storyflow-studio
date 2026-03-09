import Link from 'next/link';
import { getLatestProject, getStoryDraftBundle } from '@/features/story/service';
import { getSyncStatus } from '@/features/sync/service';
import { StoryGenerateButton } from '@/components/story-generate-button';
import { SyncNoticeCard } from '@/components/sync-notice-card';

export async function StorySetupData() {
  const project = await getLatestProject().catch(() => null);

  if (!project) {
    return (
      <div className="asset-grid">
        <div className="asset-tile">
          <span className="label">empty</span>
          <h4>还没有可用项目</h4>
          <p>先去 Idea Lab 创建项目，Story Setup 才能展示世界观和故事 draft 数据。</p>
        </div>
      </div>
    );
  }

  const idea = project.ideaSeeds[0];
  const chapterCount = project.chapters.filter((item) => !item.title.startsWith('Story Engine')).length;
  const storyDraft = getStoryDraftBundle(project);
  const syncStatus = await getSyncStatus(project.id).catch(() => null);

  return (
    <div className="page-stack">
      <div className="story-setup-grid">
        <div className="snapshot-card">
          <p className="eyebrow">Latest Project</p>
          <h3>{project.title}</h3>
          <p>{project.premise || '暂无 premise'}</p>
          <div className="meta-list">
            <span>题材：{project.genre || '未设定'}</span>
            <span>阶段：{project.stage}</span>
            <span>原始章节数：{chapterCount}</span>
          </div>
          <StoryGenerateButton projectId={project.id} />
          <div className="action-row">
            <Link href="/idea-lab" className="button-ghost">修改创意</Link>
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
          <span className="label">world</span>
          <h4>世界观起点</h4>
          <p>{idea?.input || '待补充世界观输入'}</p>
        </div>
        <div className="asset-tile">
          <span className="label">style</span>
          <h4>风格备注</h4>
          <p>{idea?.styleNotes || project.description || '待补充风格与输出策略'}</p>
        </div>
        <div className="asset-tile">
          <span className="label">story engine</span>
          <h4>分层重生已接通</h4>
          <p>当前已支持按层重生 synopsis、beat sheet 与 scene seeds，不再只能整套一键重跑。</p>
        </div>
      </div>

      <div className="asset-grid three-up">
        <div className="asset-tile scene-tile">
          <span className="label">layer 1</span>
          <h4>Synopsis｜故事梗概</h4>
          <p>{storyDraft.synopsis}</p>
          <div className="meta-list">
            <span>作用：定义故事总方向</span>
            <span>建议：先定这一层，再继续下游</span>
          </div>
        </div>
        <div className="asset-tile scene-tile">
          <span className="label">layer 2</span>
          <h4>Beat Sheet｜结构节拍</h4>
          <div className="shot-list">
            {storyDraft.beats.length > 0 ? storyDraft.beats.map((beat, index) => (
              <div key={`${index}-${beat.slice(0, 12)}`} className="shot-item">
                <strong>Beat {index + 1}</strong>
                <span>{beat}</span>
              </div>
            )) : <p>还没有生成 beats。</p>}
          </div>
        </div>
        <div className="asset-tile scene-tile">
          <span className="label">layer 3</span>
          <h4>Scene Seeds｜分场种子</h4>
          <div className="shot-list">
            {storyDraft.scenes.length > 0 ? storyDraft.scenes.slice(0, 3).map((scene, index) => (
              <div key={`${index}-${scene.title}`} className="shot-item">
                <strong>Scene {index + 1} · {scene.title}</strong>
                <span>{scene.summary}</span>
                <span>目标：{scene.goal}</span>
              </div>
            )) : <p>还没有生成 scene seeds。</p>}
          </div>
        </div>
      </div>

      <div className="asset-grid two-up">
        <div className="asset-tile">
          <span className="label">layer control</span>
          <h4>分层控制逻辑</h4>
          <p>如果只是故事方向不满意，优先只重生 synopsis；如果大方向可以、但结构不顺，优先只重生 beat sheet；如果只是想调整改编前分场骨架，优先只重生 scene seeds。</p>
        </div>
        <div className="asset-tile">
          <span className="label">dependency</span>
          <h4>层级依赖关系</h4>
          <p>synopsis 决定故事总方向，beat sheet 负责推进结构节奏，scene seeds 负责给 Adaptation 提供可拆镜的场次骨架。越上层改动越大，越下层改动越局部。</p>
        </div>
      </div>

      <div className="asset-grid">
        <div className="asset-tile scene-tile">
          <span className="label">all scene seeds</span>
          <h4>完整分场种子列表</h4>
          <div className="shot-list">
            {storyDraft.scenes.length > 0 ? storyDraft.scenes.map((scene, index) => (
              <div key={`${index}-${scene.title}-full`} className="shot-item">
                <strong>Scene {index + 1} · {scene.title}</strong>
                <span>{scene.summary}</span>
                <span>目标：{scene.goal}</span>
                <span>冲突：{scene.conflict}</span>
                <span>情绪：{scene.emotion}</span>
              </div>
            )) : <p>还没有生成 scene seeds。</p>}
          </div>
        </div>
      </div>

      <div className="asset-grid three-up">
        <div className="asset-tile">
          <span className="label">character</span>
          <h4>角色卡（下一步）</h4>
          <p>后续角色系统会继续围绕这三层 story draft 工作，而不是只从最终镜头里反推角色。</p>
        </div>
        <div className="asset-tile">
          <span className="label">visual</span>
          <h4>视觉圣经（下一步）</h4>
          <p>后续视觉总控也会更明确地读取 story layers，保证风格与结构一起稳定下来。</p>
        </div>
        <div className="asset-tile">
          <span className="label">roadmap</span>
          <h4>当前建议</h4>
          <p>先在这里把三层 story draft 调顺，再进入 Adaptation Lab 做下游改编，这样比先改镜头再回头修故事更省成本。</p>
        </div>
      </div>
    </div>
  );
}

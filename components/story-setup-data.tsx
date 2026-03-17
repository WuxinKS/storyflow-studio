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

  return (
    <div className="page-stack">
      <div className="story-control-grid">
        <div className="snapshot-card story-command-card">
          <p className="eyebrow">当前项目</p>
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
            <Link href={buildProjectHref('/idea-lab', project.id)} className="button-ghost">修改创意</Link>
            <Link href={buildProjectHref('/chapter-studio', project.id)} className="button-secondary">查看小说章节</Link>
            <Link href={buildProjectHref('/adaptation-lab', project.id)} className="button-secondary">进入改编工作台</Link>
          </div>
        </div>

        <div className="story-health-grid">
          <div className="asset-tile">
            <span className="label">世界观输入</span>
            <h4>{idea?.input ? '已写入' : '待补充'}</h4>
            <p>{idea?.input || '先明确世界观输入，后面的梗概和角色会更稳定。'}</p>
          </div>
          <div className="asset-tile">
            <span className="label">风格方向</span>
            <h4>{project.genre || '未定义题材'}</h4>
            <p>{idea?.styleNotes || project.description || '建议补齐风格、节奏和输出取向。'}</p>
          </div>
          <div className="asset-tile">
            <span className="label">正文状态</span>
            <h4>{aiChapterCount} 章 AI 小说</h4>
            <p>{manualChapterCount > 0 ? `另有 ${manualChapterCount} 章人工章节，可一起进入改编链。` : '当前还没有人工章节，适合先用 AI 正文拉出初稿。'}</p>
          </div>
        </div>
      </div>

      {syncStatus ? (
        <div className="asset-grid">
          <SyncNoticeCard card={syncStatus.cards.story} />
        </div>
      ) : null}

      <SectionCard
        eyebrow="Story Layers"
        title="三层故事骨架"
        description="故事设定页的核心不是堆信息，而是先把上游三层稳定下来，减少下游返工。"
      >
        <div className="story-layer-grid">
          <div className="asset-tile story-layer-card">
            <div className="story-layer-head">
              <span className="story-layer-index">01</span>
              <div>
                <p className="eyebrow">Synopsis</p>
                <h4>故事梗概</h4>
              </div>
            </div>
            <p>{storyDraft.synopsis}</p>
            <div className="meta-list">
              <span>定义故事总方向</span>
              <span>建议优先稳定</span>
            </div>
          </div>

          <div className="asset-tile story-layer-card">
            <div className="story-layer-head">
              <span className="story-layer-index">02</span>
              <div>
                <p className="eyebrow">Beats</p>
                <h4>结构节拍</h4>
              </div>
            </div>
            <div className="story-beat-list">
              {storyDraft.beats.length > 0 ? storyDraft.beats.map((beat, index) => (
                <div key={`${index}-${beat.slice(0, 12)}`} className="story-beat-item">
                  <strong>节拍 {index + 1}</strong>
                  <span>{beat}</span>
                </div>
              )) : <p>还没有生成结构节拍。</p>}
            </div>
          </div>

          <div className="asset-tile story-layer-card">
            <div className="story-layer-head">
              <span className="story-layer-index">03</span>
              <div>
                <p className="eyebrow">Scene Seeds</p>
                <h4>分场种子</h4>
              </div>
            </div>
            <div className="story-seed-preview-list">
              {storyDraft.scenes.length > 0 ? storyDraft.scenes.slice(0, 3).map((scene, index) => (
                <div key={`${index}-${scene.title}`} className="story-seed-preview-item">
                  <strong>场次 {index + 1} · {scene.title}</strong>
                  <span>{scene.summary}</span>
                  <small>目标：{scene.goal}</small>
                </div>
              )) : <p>还没有生成分场种子。</p>}
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Scene Seeds"
        title="完整分场种子"
        description="这里直接看每个场次的目标、冲突和情绪，方便快速判断是否适合进入改编。"
      >
        <div className="scene-seed-grid">
          {storyDraft.scenes.length > 0 ? storyDraft.scenes.map((scene, index) => (
            <div key={`${index}-${scene.title}-full`} className="asset-tile scene-seed-card">
              <span className="label">场次 {index + 1}</span>
              <h4>{scene.title}</h4>
              <p>{scene.summary}</p>
              <div className="meta-list">
                <span>目标：{scene.goal}</span>
                <span>冲突：{scene.conflict}</span>
                <span>情绪：{scene.emotion}</span>
              </div>
            </div>
          )) : <p>还没有生成分场种子。</p>}
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Impact"
        title="下游会继承这些设定"
        description="这里改动的内容会直接传到角色、视觉、改编和生成链，所以页面重点是判断影响，而不是单纯看文案。"
      >
        <div className="asset-grid three-up">
          <div className="asset-tile">
            <span className="label">层级控制</span>
            <h4>重生逻辑</h4>
            <p>方向不满意就优先重生梗概；结构不顺再动节拍；只想改改编基础时，再局部重生分场种子。</p>
          </div>
          <div className="asset-tile">
            <span className="label">角色与视觉</span>
            <h4>后续模块会继续读取</h4>
            <p>角色与视觉不会只从镜头反推，而是继续围绕这里的故事骨架继承设定。</p>
          </div>
          <div className="asset-tile">
            <span className="label">建议路线</span>
            <h4>当前建议</h4>
            <p>先把三层骨架调顺，再批量生成小说正文，最后进入改编实验室和生成链。</p>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

import Link from 'next/link';
import {
  getLatestProject,
  isGeneratedNovelChapterTitle,
  isStoryEngineChapterTitle,
} from '@/features/story/service';
import { ChapterCreateForm } from '@/components/chapter-create-form';
import { NovelGenerateButton } from '@/components/novel-generate-button';
import { getProjectStageLabel } from '@/lib/display';
import { buildProjectHref } from '@/lib/project-links';

export async function ChapterStudioData({ projectId }: { projectId?: string }) {
  const project = await getLatestProject(projectId).catch(() => null);

  if (!project) {
    return (
      <div className="asset-tile">
        <span className="label">空状态</span>
        <h4>没有可用项目</h4>
        <p>先去创意工坊创建项目，再回来生成小说章节与手写正文。</p>
      </div>
    );
  }

  const visibleChapters = project.chapters.filter((chapter) => !isStoryEngineChapterTitle(chapter.title));
  const aiChapters = visibleChapters.filter((chapter) => isGeneratedNovelChapterTitle(chapter.title));
  const manualChapters = visibleChapters.filter((chapter) => !isGeneratedNovelChapterTitle(chapter.title));
  const hiddenInternalCount = project.chapters.length - visibleChapters.length;

  return (
    <div className="page-stack">
      <div className="snapshot-card">
        <p className="eyebrow">章节工作台</p>
        <h3>{project.title}</h3>
        <p>{project.premise || '暂无简介'}</p>
        <div className="meta-list">
          <span>可用章节：{visibleChapters.length}</span>
          <span>AI 小说：{aiChapters.length}</span>
          <span>手写章节：{manualChapters.length}</span>
          <span>当前阶段：{getProjectStageLabel(project.stage)}</span>
        </div>
        <NovelGenerateButton projectId={project.id} />
        <div className="action-row">
          <Link href={buildProjectHref('/story-setup', project.id)} className="button-ghost">返回设定中心</Link>
          <Link href={buildProjectHref('/adaptation-lab', project.id)} className="button-secondary">进入改编工作台</Link>
        </div>
      </div>

      <ChapterCreateForm projectId={project.id} />

      <div className="asset-grid three-up">
        <div className="asset-tile">
          <span className="label">AI 正文</span>
          <h4>自动小说链已接通</h4>
          <p>故事骨架生成后，可直接批量生成 AI 小说正文，用于长文本创作和后续章节精修。</p>
        </div>
        <div className="asset-tile">
          <span className="label">手写编辑</span>
          <h4>保留人工创作入口</h4>
          <p>你可以随时手写新章节，或把 AI 章节内容复制出来继续人工改写，保持创作控制权。</p>
        </div>
        <div className="asset-tile">
          <span className="label">内部材料</span>
          <h4>结构稿已自动隐藏</h4>
          <p>{hiddenInternalCount > 0 ? `已隐藏 ${hiddenInternalCount} 条 Story Engine 内部结构稿，避免干扰章节创作视图。` : '当前没有额外隐藏的内部结构稿。'}</p>
        </div>
      </div>

      {visibleChapters.length === 0 ? (
        <div className="asset-grid">
          <div className="asset-tile">
            <span className="label">空状态</span>
            <h4>还没有可用章节</h4>
            <p>先在故事设定页生成故事骨架，或直接在这里新增手写章节。</p>
          </div>
        </div>
      ) : null}

      <div className="page-stack">
        <div className="snapshot-card">
          <p className="eyebrow">AI 小说章节</p>
          <h4>自动生成正文</h4>
          <p>这些章节由故事梗概、结构节拍和分场种子自动串联生成，更适合作为长文本初稿与后续精修底稿。</p>
        </div>
        <div className="asset-grid">
          {aiChapters.length === 0 ? (
            <div className="asset-tile">
              <span className="label">待生成</span>
              <h4>还没有 AI 小说章节</h4>
              <p>点击上方“生成 AI 小说章节”即可按当前故事结构批量生成正文。</p>
            </div>
          ) : (
            aiChapters.map((chapter) => (
              <div key={chapter.id} className="asset-tile">
                <span className="label">AI 小说</span>
                <h4>{chapter.title}</h4>
                <p>{chapter.content.slice(0, 160) || '暂无内容'}</p>
                <div className="action-row compact-row">
                  <Link href={buildProjectHref('/adaptation-lab', project.id)} className="button-secondary">送去自动分镜</Link>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="page-stack">
        <div className="snapshot-card">
          <p className="eyebrow">手写章节</p>
          <h4>人工创作与精修</h4>
          <p>这里保留所有你手动创建的章节，方便把 AI 初稿继续改写成更接近最终作品的版本。</p>
        </div>
        <div className="asset-grid">
          {manualChapters.length === 0 ? (
            <div className="asset-tile">
              <span className="label">可选</span>
              <h4>还没有手写章节</h4>
              <p>如果你想保留人工重写版本，可以直接在上方新增手写章节。</p>
            </div>
          ) : (
            manualChapters.map((chapter) => (
              <div key={chapter.id} className="asset-tile">
                <span className="label">手写章节</span>
                <h4>{chapter.title}</h4>
                <p>{chapter.content.slice(0, 160) || '暂无内容'}</p>
                <div className="action-row compact-row">
                  <Link href={buildProjectHref('/adaptation-lab', project.id)} className="button-secondary">用于改编</Link>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

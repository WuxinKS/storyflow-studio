import Link from 'next/link';
import { getLatestProject } from '@/features/story/service';
import { ChapterCreateForm } from '@/components/chapter-create-form';
import { getProjectStageLabel } from '@/lib/display';

export async function ChapterStudioData() {
  const project = await getLatestProject().catch(() => null);

  if (!project) {
    return (
      <div className="asset-tile">
        <span className="label">空状态</span>
        <h4>没有可用项目</h4>
        <p>先去创意工坊创建项目，再回来写章节。</p>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <div className="snapshot-card">
        <p className="eyebrow">章节工作台</p>
        <h3>{project.title}</h3>
        <p>{project.premise || '暂无简介'}</p>
        <div className="meta-list">
          <span>章节总数：{project.chapters.length}</span>
          <span>当前阶段：{getProjectStageLabel(project.stage)}</span>
        </div>
        <div className="action-row">
          <Link href="/story-setup" className="button-ghost">返回设定中心</Link>
          <Link href="/adaptation-lab" className="button-secondary">进入改编工作台</Link>
        </div>
      </div>

      <ChapterCreateForm projectId={project.id} />

      <div className="asset-grid">
        {project.chapters.length === 0 ? (
          <div className="asset-tile">
            <span className="label">空状态</span>
            <h4>还没有章节</h4>
            <p>先创建第一章，后续再接 AI 自动生成与改写。</p>
          </div>
        ) : (
          project.chapters.map((chapter) => (
            <div key={chapter.id} className="asset-tile">
              <span className="label">第 {chapter.orderIndex} 章</span>
              <h4>{chapter.title}</h4>
              <p>{chapter.content.slice(0, 120) || '暂无内容'}</p>
              <div className="action-row compact-row">
                <Link href="/adaptation-lab" className="button-secondary">用于改编</Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

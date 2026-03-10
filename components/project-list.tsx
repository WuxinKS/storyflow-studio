import Link from 'next/link';
import { listProjects } from '@/features/project/service';
import { getProjectStageLabel } from '@/lib/display';
import { buildProjectHref } from '@/lib/project-links';

export async function ProjectList() {
  const projects = await listProjects().catch(() => []);

  return (
    <div className="section-card">
      <div className="section-header">
        <div>
          <p className="eyebrow">数据库快照</p>
          <h2>项目列表</h2>
        </div>
        <p>这里展示已经写入 Prisma 数据层的项目。现在可以直接点进任意项目，保持整条工作流都锁定在同一个 project 上。</p>
      </div>

      <div className="asset-grid">
        {projects.length === 0 ? (
          <div className="asset-tile">
            <span className="label">空状态</span>
            <h4>暂无数据库项目</h4>
            <p>先执行 Prisma 初始化，再在创意工坊里创建第一个项目。</p>
          </div>
        ) : (
          projects.map((project) => (
            <div key={project.id} className="asset-tile">
              <span className="label">{getProjectStageLabel(project.stage)}</span>
              <h4>{project.title}</h4>
              <p>{project.premise || project.description || '暂无摘要'}</p>
              <div className="action-row wrap-row">
                <Link href={buildProjectHref('/story-setup', project.id)} className="button-ghost">进入设定</Link>
                <Link href={buildProjectHref('/render-studio', project.id)} className="button-secondary">查看生成</Link>
                <Link href={buildProjectHref('/qa-panel', project.id)} className="button-secondary">查看 QA</Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

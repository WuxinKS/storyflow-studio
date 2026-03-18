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
          <p className="eyebrow">项目切换</p>
          <h2>选择你要继续推进的项目</h2>
        </div>
        <p>这里只负责切换当前项目。真正该做的下一步，会在进入项目后由总览页直接告诉你。</p>
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
                <Link href={buildProjectHref('/', project.id)} className="button-secondary">继续主流程</Link>
                <Link href={buildProjectHref('/final-cut', project.id)} className="button-ghost">看成片预演</Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

import { listProjects } from '@/features/project/service';

export async function ProjectList() {
  const projects = await listProjects().catch(() => []);

  return (
    <div className="section-card">
      <div className="section-header">
        <div>
          <p className="eyebrow">Database Snapshot</p>
          <h2>Projects</h2>
        </div>
        <p>这里展示已经写入 Prisma 数据层的项目。若数据库未初始化，会优雅回退为空列表。</p>
      </div>

      <div className="asset-grid">
        {projects.length === 0 ? (
          <div className="asset-tile">
            <span className="label">empty</span>
            <h4>暂无数据库项目</h4>
            <p>先执行 Prisma 初始化，再在 Idea Lab 里创建第一个项目。</p>
          </div>
        ) : (
          projects.map((project) => (
            <div key={project.id} className="asset-tile">
              <span className="label">{project.stage}</span>
              <h4>{project.title}</h4>
              <p>{project.premise || project.description || '暂无摘要'}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

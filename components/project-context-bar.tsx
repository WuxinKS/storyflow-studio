import Link from 'next/link';
import { listProjects } from '@/features/project/service';
import { getProjectStageLabel } from '@/lib/display';
import { getAdjacentNavigation, getNavigationItem } from '@/lib/app-meta';
import { buildProjectHref, normalizeProjectId } from '@/lib/project-links';

export async function ProjectContextBar({
  currentPath,
  projectId,
}: {
  currentPath: string;
  projectId?: string;
}) {
  const projects = await listProjects().catch(() => []);
  if (projects.length === 0) return null;

  const normalizedProjectId = normalizeProjectId(projectId);
  const currentProject = normalizedProjectId ? projects.find((project) => project.id === normalizedProjectId) || null : null;
  const fallbackProject = projects[0] || null;
  const effectiveProject = currentProject || fallbackProject;
  const currentItem = getNavigationItem(currentPath);
  const adjacent = getAdjacentNavigation(currentPath);

  return (
    <section className="project-context-card">
      <div className="project-context-head">
        <div>
          <p className="eyebrow">当前项目</p>
          <h3>{effectiveProject?.title || '暂无项目'}</h3>
          <p className="project-context-copy">
            {effectiveProject?.premise
              || effectiveProject?.description
              || '先固定当前项目，再沿着同一条主链推进故事、生成和交付。'}
          </p>
        </div>
        <div className="project-context-status">
          <span className="status-pill status-pill-subtle">
            {effectiveProject ? getProjectStageLabel(effectiveProject.stage) : '未锁定项目'}
          </span>
          <span className="context-inline-note">{currentItem.label}</span>
        </div>
      </div>

      <div className="project-context-actions">
        {adjacent.previous ? (
          <Link href={buildProjectHref(adjacent.previous.href, effectiveProject?.id)} className="button-ghost">
            上一步：{adjacent.previous.label}
          </Link>
        ) : null}
        {adjacent.next ? (
          <Link href={buildProjectHref(adjacent.next.href, effectiveProject?.id)} className="button-secondary">
            下一步：{adjacent.next.label}
          </Link>
        ) : null}
        <Link href={buildProjectHref('/render-studio', effectiveProject?.id)} className="button-ghost">
          去生成工作台
        </Link>
        <Link href={buildProjectHref('/delivery-center', effectiveProject?.id)} className="button-ghost">
          看交付中心
        </Link>
      </div>

      <div className="project-chip-row">
        {projects.slice(0, 8).map((project) => (
          <Link
            key={project.id}
            href={buildProjectHref(currentPath, project.id)}
            className={project.id === effectiveProject?.id ? 'tag-chip tag-chip-active' : 'tag-chip'}
          >
            {project.title}
          </Link>
        ))}
      </div>
    </section>
  );
}

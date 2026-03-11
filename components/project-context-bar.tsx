import Link from 'next/link';
import { listProjects } from '@/features/project/service';
import { getProjectStageLabel } from '@/lib/display';
import { buildProjectHref, normalizeProjectId } from '@/lib/project-links';

const WORKSPACE_LINKS = [
  { href: '/story-setup', label: '故事' },
  { href: '/chapter-studio', label: '小说' },
  { href: '/character-studio', label: '角色' },
  { href: '/visual-bible', label: '视觉' },
  { href: '/reference-lab', label: '参考' },
  { href: '/adaptation-lab', label: '改编' },
  { href: '/storyboard', label: '分镜' },
  { href: '/timeline', label: '时间线' },
  { href: '/assets', label: '资产' },
  { href: '/render-studio', label: '生成' },
  { href: '/render-runs', label: '诊断' },
  { href: '/qa-panel', label: 'QA' },
  { href: '/delivery-center', label: '交付' },
  { href: '/settings', label: '设置' },
] as const;

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

  return (
    <div className="snapshot-card">
      <div className="snapshot-header">
        <div>
          <p className="eyebrow">项目上下文</p>
          <h3>{currentProject?.title || fallbackProject?.title || '暂无项目'}</h3>
        </div>
        <span className="status-pill status-pill-subtle">
          {currentProject
            ? getProjectStageLabel(currentProject.stage)
            : normalizedProjectId
              ? '指定项目不存在'
              : '默认最新项目'}
        </span>
      </div>
      <p>
        {currentProject?.premise
          || currentProject?.description
          || (normalizedProjectId ? '当前 projectId 未命中任何项目，可直接点下方项目切换。' : fallbackProject?.premise || fallbackProject?.description)
          || '可直接在这里切换项目并保持整条工作流上下文一致。'}
      </p>
      <div className="action-row wrap-row">
        {WORKSPACE_LINKS.map((item) => (
          <Link
            key={item.href}
            href={buildProjectHref(item.href, effectiveProject?.id)}
            className={item.href === currentPath ? 'button-secondary' : 'button-ghost'}
          >
            {item.label}
          </Link>
        ))}
      </div>
      <div className="tag-list">
        {projects.slice(0, 8).map((project) => (
          <Link key={project.id} href={buildProjectHref(currentPath, project.id)} className="tag-chip">
            {project.id === effectiveProject?.id ? `当前：${project.title}` : project.title}
          </Link>
        ))}
      </div>
    </div>
  );
}

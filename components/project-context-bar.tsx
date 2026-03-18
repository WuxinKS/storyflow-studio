import Link from 'next/link';
import { listProjects } from '@/features/project/service';
import { getStageToneLabel, getWorkflowGuide } from '@/features/workflow/service';
import { getNavigationItem, getRelatedPrimaryNavigation } from '@/lib/app-meta';
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
  if (!effectiveProject) return null;

  const currentItem = getNavigationItem(currentPath);
  const relatedPrimary = getRelatedPrimaryNavigation(currentPath);
  const workflow = await getWorkflowGuide(effectiveProject.id).catch(() => null);
  const currentStage = workflow?.stages.find((stage) => stage.href === (currentItem.priority === 'support' ? relatedPrimary?.href : currentItem.href)) || null;
  const nextAction = workflow?.nextAction || null;
  const currentBadges = currentStage?.badges.slice(0, 3) || [];

  return (
    <section className="project-context-card workflow-context-card">
      <div className="project-context-head">
        <div>
          <p className="eyebrow">当前项目</p>
          <h3>{effectiveProject.title}</h3>
          <p className="project-context-copy">
            {workflow?.project.premise
              || effectiveProject.premise
              || effectiveProject.description
              || '先固定当前项目，再沿着同一条主流程推进。'}
          </p>
        </div>

        <div className="project-context-status">
          <span className="status-pill status-pill-subtle">{workflow?.progress.label || '主流程未就绪'}</span>
          <span className="context-inline-note">
            {currentItem.priority === 'support'
              ? `当前在辅助工具：${currentItem.label}`
              : `当前主流程：${currentItem.label}`}
          </span>
        </div>
      </div>

      <div className="workflow-context-grid">
        <div className="asset-tile workflow-context-panel">
          <span className="label">当前所处阶段</span>
          <h4>{currentStage?.title || relatedPrimary?.label || currentItem.label}</h4>
          <p>{currentStage?.detail || currentItem.summary}</p>
          <div className="tag-list">
            {currentBadges.map((badge) => (
              <span key={`${currentStage?.key || currentItem.href}-${badge}`} className="tag-chip">{badge}</span>
            ))}
            {currentStage ? (
              <span className="tag-chip tag-chip-active">{getStageToneLabel(currentStage.status)}</span>
            ) : null}
          </div>
        </div>

        <div className="asset-tile workflow-context-panel">
          <span className="label">下一步建议</span>
          <h4>{nextAction?.title || '继续主流程'}</h4>
          <p>{nextAction?.description || '按当前主流程继续往下一步推进。'}</p>
          <div className="action-row wrap-row compact-row">
            {nextAction ? (
              <Link href={buildProjectHref(nextAction.href, effectiveProject.id)} className="button-primary">
                {nextAction.buttonLabel}
              </Link>
            ) : null}
            {currentItem.priority === 'support' && relatedPrimary ? (
              <Link href={buildProjectHref(relatedPrimary.href, effectiveProject.id)} className="button-ghost">
                返回主流程：{relatedPrimary.label}
              </Link>
            ) : (
              <Link href={buildProjectHref('/final-cut', effectiveProject.id)} className="button-ghost">
                查看成片预演
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="project-chip-row">
        {projects.slice(0, 8).map((project) => (
          <Link
            key={project.id}
            href={buildProjectHref(currentPath, project.id)}
            className={project.id === effectiveProject.id ? 'tag-chip tag-chip-active' : 'tag-chip'}
          >
            {project.title}
          </Link>
        ))}
      </div>
    </section>
  );
}

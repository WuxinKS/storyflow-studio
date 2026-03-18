import Link from 'next/link';
import { ReactNode } from 'react';
import { ProjectContextBar } from '@/components/project-context-bar';
import { getAdjacentNavigation, getNavigationGroup, getNavigationItem, getRelatedPrimaryNavigation } from '@/lib/app-meta';
import { buildProjectHref } from '@/lib/project-links';

export function ModulePage({
  title,
  lead,
  bullets,
  currentPath,
  projectId,
  children,
}: {
  title: string;
  lead: string;
  bullets: string[];
  currentPath?: string;
  projectId?: string;
  children?: ReactNode;
}) {
  const currentItem = currentPath ? getNavigationItem(currentPath) : null;
  const currentGroup = currentItem ? getNavigationGroup(currentItem.group) : null;
  const adjacent = currentPath ? getAdjacentNavigation(currentPath) : { previous: null, next: null };
  const relatedPrimary = currentPath ? getRelatedPrimaryNavigation(currentPath) : null;
  const showWorkflowAdjacent = currentItem?.priority === 'core' || currentItem?.priority === 'overview';

  return (
    <div className="page-stack module-page">
      <section className="module-hero">
        <div className="module-hero-copy">
          <div className="module-hero-meta">
            <span className="shell-route-chip">{currentGroup?.label || '模块'}</span>
            <span className="shell-route-meta">
              {currentItem?.priority === 'core'
                ? `第 ${String(currentItem.step || 0).padStart(2, '0')} 步`
                : currentItem?.priority === 'support'
                  ? '辅助工具'
                  : '全局视图'}
            </span>
          </div>
          <h1>{title}</h1>
          <p className="module-lead">{lead}</p>
        </div>

        <div className="module-hero-side">
          <div className="module-checklist">
            {bullets.map((item, index) => (
              <div key={item} className="module-check-item">
                <span>{String(index + 1).padStart(2, '0')}</span>
                <p>{item}</p>
              </div>
            ))}
          </div>
          <div className="action-row wrap-row">
            {showWorkflowAdjacent && adjacent.previous ? (
              <Link href={buildProjectHref(adjacent.previous.href, projectId)} className="button-ghost">
                上一步：{adjacent.previous.label}
              </Link>
            ) : null}
            {showWorkflowAdjacent && adjacent.next ? (
              <Link href={buildProjectHref(adjacent.next.href, projectId)} className="button-secondary">
                下一步：{adjacent.next.label}
              </Link>
            ) : null}
            {currentItem?.priority === 'support' && relatedPrimary ? (
              <Link href={buildProjectHref(relatedPrimary.href, projectId)} className="button-ghost">
                返回主流程：{relatedPrimary.label}
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      {currentPath ? <ProjectContextBar currentPath={currentPath} projectId={projectId} /> : null}

      <div className="module-content">
        {children}
      </div>
    </div>
  );
}

"use client";

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { appMeta, getAdjacentNavigation, getNavigationGroup, getNavigationItem, getRelatedPrimaryNavigation } from '@/lib/app-meta';
import { buildProjectHref } from '@/lib/project-links';

export function ShellHeader() {
  const pathname = usePathname() || '/';
  const searchParams = useSearchParams();
  const projectId = searchParams.get('projectId');
  const currentItem = getNavigationItem(pathname);
  const currentGroup = getNavigationGroup(currentItem.group);
  const adjacent = getAdjacentNavigation(pathname);
  const relatedPrimary = getRelatedPrimaryNavigation(pathname);
  const isOverview = pathname === '/';
  const showWorkflowAdjacent = currentItem.priority === 'core' || currentItem.priority === 'overview';

  return (
    <header className={isOverview ? 'shell-header' : 'shell-header shell-header-compact'}>
      <div className="shell-header-main">
        <div className="shell-header-kicker">
          <span className="shell-route-chip">{currentGroup.label}</span>
          <span className="shell-route-meta">
            {currentItem.priority === 'core'
              ? `第 ${String(currentItem.step || 0).padStart(2, '0')} 步`
              : currentItem.priority === 'support'
                ? '辅助工具'
                : '全局入口'}
          </span>
        </div>
        <h2>{isOverview ? currentItem.label || appMeta.name : appMeta.name}</h2>
        <p>
          {isOverview
            ? currentItem.summary || appMeta.description
            : currentItem.priority === 'support' && relatedPrimary
              ? `当前页面：${currentItem.label}。这是辅助工具，主流程对应阶段是“${relatedPrimary.label}”。`
              : `当前页面：${currentItem.label}。${currentItem.summary}`}
        </p>
      </div>

      <div className="shell-header-actions">
        {showWorkflowAdjacent && adjacent.previous ? (
          <Link href={buildProjectHref(adjacent.previous.href, projectId) as never} className="button-ghost">
            上一步：{adjacent.previous.label}
          </Link>
        ) : null}
        {showWorkflowAdjacent && adjacent.next ? (
          <Link href={buildProjectHref(adjacent.next.href, projectId) as never} className="button-secondary">
            下一步：{adjacent.next.label}
          </Link>
        ) : null}
        {currentItem.priority === 'support' && relatedPrimary ? (
          <Link href={buildProjectHref(relatedPrimary.href, projectId) as never} className="button-ghost">
            返回主流程：{relatedPrimary.label}
          </Link>
        ) : null}
        <Link href={buildProjectHref('/idea-lab', projectId) as never} className="button-primary">
          开始新项目
        </Link>
      </div>
    </header>
  );
}

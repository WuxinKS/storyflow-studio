"use client";

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { appMeta, getAdjacentNavigation, getNavigationGroup, getNavigationItem } from '@/lib/app-meta';
import { buildProjectHref } from '@/lib/project-links';

export function ShellHeader() {
  const pathname = usePathname() || '/';
  const searchParams = useSearchParams();
  const projectId = searchParams.get('projectId');
  const currentItem = getNavigationItem(pathname);
  const currentGroup = getNavigationGroup(currentItem.group);
  const adjacent = getAdjacentNavigation(pathname);
  const isOverview = pathname === '/';

  return (
    <header className={isOverview ? 'shell-header' : 'shell-header shell-header-compact'}>
      <div className="shell-header-main">
        <div className="shell-header-kicker">
          <span className="shell-route-chip">{currentGroup.label}</span>
          <span className="shell-route-meta">{currentItem.step ? `第 ${String(currentItem.step).padStart(2, '0')} 站` : '全局入口'}</span>
        </div>
        <h2>{isOverview ? currentItem.label || appMeta.name : appMeta.name}</h2>
        <p>{isOverview ? currentItem.summary || appMeta.description : `当前页面：${currentItem.label}。${currentItem.summary}`}</p>
      </div>

      <div className="shell-header-actions">
        {adjacent.previous ? (
          <Link href={buildProjectHref(adjacent.previous.href, projectId) as never} className="button-ghost">
            上一步：{adjacent.previous.label}
          </Link>
        ) : null}
        {adjacent.next ? (
          <Link href={buildProjectHref(adjacent.next.href, projectId) as never} className="button-secondary">
            下一步：{adjacent.next.label}
          </Link>
        ) : null}
        <Link href={buildProjectHref('/idea-lab', projectId) as never} className="button-primary">
          开始新项目
        </Link>
      </div>
    </header>
  );
}

"use client";

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  appMeta,
  getAdjacentNavigation,
  getNavigationByGroup,
  getNavigationItem,
  getRelatedPrimaryNavigation,
} from '@/lib/app-meta';
import { buildProjectHref } from '@/lib/project-links';

export function Sidebar() {
  const pathname = usePathname() || '/';
  const searchParams = useSearchParams();
  const projectId = searchParams.get('projectId');
  const groupedNavigation = getNavigationByGroup();
  const currentItem = getNavigationItem(pathname);
  const adjacent = getAdjacentNavigation(pathname);
  const relatedPrimary = getRelatedPrimaryNavigation(pathname);
  const primaryFollowUp = currentItem.priority === 'support'
    ? relatedPrimary
    : adjacent.next;
  const overviewGroup = groupedNavigation.find((group) => group.key === 'overview');
  const coreGroup = groupedNavigation.find((group) => group.key === 'core');
  const supportGroup = groupedNavigation.find((group) => group.key === 'support');

  const renderNavLink = (item: NonNullable<typeof coreGroup>['items'][number]) => {
    const href = buildProjectHref(item.href, projectId) as string;
    const isActive = pathname === item.href;
    const shortNote = item.step ? item.section : item.relatedHref ? '按需打开' : '全局入口';

    return (
      <Link
        key={item.href}
        href={href as never}
        className={isActive ? 'nav-link nav-link-active' : 'nav-link'}
      >
        <div className="nav-link-copy">
          <div className="nav-link-title-row">
            <span>{item.label}</span>
            {item.step ? <small>#{String(item.step).padStart(2, '0')}</small> : <small>{shortNote}</small>}
          </div>
          <p className={isActive ? undefined : 'nav-link-note'}>{isActive ? item.summary : shortNote}</p>
        </div>
      </Link>
    );
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-frame">
        <div className="brand">
          <div className="brand-badge">SF</div>
          <div>
            <p className="eyebrow">创作操作系统</p>
            <h1>{appMeta.name}</h1>
            <p className="sidebar-brand-copy">{appMeta.tagline}</p>
          </div>
        </div>

        <div className="sidebar-status-card sidebar-flow-card">
          <span className="status-pill">{currentItem.priority === 'support' ? '当前在辅助工具' : '当前在主流程'}</span>
          <h3>{currentItem.label}</h3>
          <p>{currentItem.priority === 'support'
            ? `${currentItem.label} 负责补强主链。做完以后，优先回到 ${relatedPrimary?.label || '主流程'} 继续推进。`
            : currentItem.summary}
          </p>
          <div className="action-row wrap-row compact-row">
            <Link
              href={buildProjectHref(primaryFollowUp?.href || '/', projectId) as never}
              className="button-primary"
            >
              {currentItem.priority === 'support'
                ? `回主流程：${primaryFollowUp?.label || '总览'}`
                : primaryFollowUp
                  ? `下一步：${primaryFollowUp.label}`
                  : '查看总览'}
            </Link>
            <Link href={buildProjectHref('/', projectId) as never} className="button-ghost">看总览</Link>
          </div>
        </div>

        <nav className="nav-list" aria-label="主要导航">
          {overviewGroup ? (
            <section className="nav-group">
              <div className="nav-group-head">
                <p className="eyebrow">{overviewGroup.label}</p>
                <span>{overviewGroup.summary}</span>
              </div>
              <div className="nav-group-items">
                {overviewGroup.items.map(renderNavLink)}
              </div>
            </section>
          ) : null}

          {coreGroup ? (
            <section className="nav-group">
              <div className="nav-group-head">
                <p className="eyebrow">{coreGroup.label}</p>
                <span>{coreGroup.summary}</span>
              </div>
              <div className="nav-group-items">
                {coreGroup.items.map(renderNavLink)}
              </div>
            </section>
          ) : null}

          {supportGroup ? (
            <details className="workflow-disclosure sidebar-nav-disclosure" open={currentItem.group === 'support'}>
              <summary>按需工具（{supportGroup.items.length}）</summary>
              <div className="workflow-disclosure-body">
                <div className="nav-group-items">
                  {supportGroup.items.map(renderNavLink)}
                </div>
              </div>
            </details>
          ) : null}
        </nav>

        <div className="sidebar-footer">
          <p className="eyebrow">当前上下文</p>
          <p>{projectId ? `projectId: ${projectId}` : '未锁定项目，可先去创意工坊创建或从总览切换项目。'}</p>
          <div className="action-row wrap-row compact-row">
            <Link href={buildProjectHref('/idea-lab', projectId) as never} className="button-primary">新建项目</Link>
            <Link href={buildProjectHref('/', projectId) as never} className="button-ghost">看下一步</Link>
          </div>
        </div>
      </div>
    </aside>
  );
}

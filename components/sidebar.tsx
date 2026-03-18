"use client";

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { appMeta, getNavigationByGroup } from '@/lib/app-meta';
import { buildProjectHref } from '@/lib/project-links';

export function Sidebar() {
  const pathname = usePathname() || '/';
  const searchParams = useSearchParams();
  const projectId = searchParams.get('projectId');
  const groupedNavigation = getNavigationByGroup();

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

        <div className="sidebar-status-card">
          <span className="status-pill">主流程优先</span>
          <p>先沿着主流程推进项目；只有需要精修、诊断或导出时，再打开辅助工具。</p>
        </div>

        <nav className="nav-list" aria-label="主要导航">
          {groupedNavigation.map((group) => (
            <section key={group.key} className="nav-group">
              <div className="nav-group-head">
                <p className="eyebrow">{group.label}</p>
                <span>{group.summary}</span>
              </div>
              <div className="nav-group-items">
                {group.items.map((item) => {
                  const href = buildProjectHref(item.href, projectId) as string;
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={href as never}
                      className={isActive ? 'nav-link nav-link-active' : 'nav-link'}
                    >
                      <div className="nav-link-copy">
                        <div className="nav-link-title-row">
                          <span>{item.label}</span>
                          {item.step ? <small>#{String(item.step).padStart(2, '0')}</small> : <small>按需</small>}
                        </div>
                        <p>{item.summary}</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
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

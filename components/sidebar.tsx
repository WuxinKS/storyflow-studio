"use client";

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { navigation } from '@/lib/app-meta';
import { buildProjectHref } from '@/lib/project-links';

export function Sidebar() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get('projectId');

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-badge">SF</div>
        <div>
          <p className="eyebrow">AI 导演工作台</p>
          <h1>StoryFlow Studio</h1>
        </div>
      </div>
      <nav className="nav-list">
        {navigation.map((item) => (
          <Link key={item.href} href={buildProjectHref(item.href, projectId) as never} className="nav-link">
            <span>{item.label}</span>
            <small>{item.section}</small>
          </Link>
        ))}
      </nav>
    </aside>
  );
}

import Link from 'next/link';
import { navigation } from '@/lib/app-meta';

export function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-badge">SF</div>
        <div>
          <p className="eyebrow">AI Director Workspace</p>
          <h1>StoryFlow Studio</h1>
        </div>
      </div>
      <nav className="nav-list">
        {navigation.map((item) => (
          <Link key={item.href} href={item.href as never} className="nav-link">
            <span>{item.label}</span>
            <small>{item.section}</small>
          </Link>
        ))}
      </nav>
    </aside>
  );
}

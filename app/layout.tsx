import './globals.css';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Sidebar } from '@/components/sidebar';
import { appMeta } from '@/lib/app-meta';

export const metadata: Metadata = {
  title: appMeta.name,
  description: appMeta.description,
};

function SidebarFallback() {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-badge">SF</div>
        <div>
          <p className="eyebrow">AI 导演工作台</p>
          <h1>StoryFlow Studio</h1>
        </div>
      </div>
    </aside>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <div className="app-shell">
          <Suspense fallback={<SidebarFallback />}>
            <Sidebar />
          </Suspense>
          <main className="content-shell">
            <header className="topbar">
              <div>
                <p className="eyebrow">创作操作系统</p>
                <h2>{appMeta.tagline}</h2>
              </div>
              <div className="status-pill">主链已打通</div>
            </header>
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}

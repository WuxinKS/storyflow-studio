import './globals.css';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Sidebar } from '@/components/sidebar';
import { ShellHeader } from '@/components/shell-header';
import { appMeta } from '@/lib/app-meta';

export const metadata: Metadata = {
  title: appMeta.name,
  description: appMeta.description,
};

function SidebarFallback() {
  return (
    <aside className="sidebar">
      <div className="sidebar-frame">
        <div className="brand">
          <div className="brand-badge">SF</div>
          <div>
            <p className="eyebrow">创作操作系统</p>
            <h1>{appMeta.name}</h1>
          </div>
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
            <Suspense fallback={null}>
              <ShellHeader />
            </Suspense>
            <div className="content-body">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}

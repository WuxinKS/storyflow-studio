import './globals.css';
import type { Metadata } from 'next';
import { Sidebar } from '@/components/sidebar';
import { appMeta } from '@/lib/app-meta';

export const metadata: Metadata = {
  title: appMeta.name,
  description: appMeta.description,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <div className="app-shell">
          <Sidebar />
          <main className="content-shell">
            <header className="topbar">
              <div>
                <p className="eyebrow">Creative Operating System</p>
                <h2>{appMeta.tagline}</h2>
              </div>
              <div className="status-pill">Planning MVP</div>
            </header>
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}

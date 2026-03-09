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

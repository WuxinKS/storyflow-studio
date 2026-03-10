import { ReactNode } from 'react';
import { ProjectContextBar } from '@/components/project-context-bar';
import { SectionCard } from '@/components/section-card';

export function ModulePage({
  title,
  lead,
  bullets,
  currentPath,
  projectId,
  children,
}: {
  title: string;
  lead: string;
  bullets: string[];
  currentPath?: string;
  projectId?: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-stack">
      <SectionCard title={title} description={lead}>
        <ul className="bullet-list">
          {bullets.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        {currentPath ? <ProjectContextBar currentPath={currentPath} projectId={projectId} /> : null}
        {children}
      </SectionCard>
    </div>
  );
}

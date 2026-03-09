import { ReactNode } from 'react';
import { SectionCard } from '@/components/section-card';

export function ModulePage({
  title,
  lead,
  bullets,
  children,
}: {
  title: string;
  lead: string;
  bullets: string[];
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
        {children}
      </SectionCard>
    </div>
  );
}

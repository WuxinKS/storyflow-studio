import { ReactNode } from 'react';

export function SectionCard({
  eyebrow = '工作台模块',
  title,
  description,
  actions,
  children,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="section-card">
      <div className="section-header">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
        </div>
        <div className="section-header-side">
          <p>{description}</p>
          {actions ? <div className="section-header-actions">{actions}</div> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

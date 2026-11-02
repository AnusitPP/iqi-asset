import type { ReactNode } from 'react';
export function PageHeader({
  title,
  description,
  eyebrow,
  action,
}: {
  title: string;
  description: string;
  eyebrow?: string;
  action?: ReactNode;
}) {
  return (
    <header className="portal-page-heading">
      <div>
        {eyebrow && <span className="portal-eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action && <div className="portal-page-action">{action}</div>}
    </header>
  );
}

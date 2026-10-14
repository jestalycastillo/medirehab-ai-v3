import type { ReactNode } from "react";

export function PortalPage({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`portal-page ${className}`}>{children}</div>;
}

export function PortalPageHeader({ title, eyebrow, description, actions, back }: {
  title: string;
  eyebrow?: string;
  description?: string;
  actions?: ReactNode;
  back?: ReactNode;
}) {
  return (
    <header className="portal-page-header">
      <div>{back}{eyebrow && <span className="portal-page-eyebrow">{eyebrow}</span>}<h1>{title}</h1>{description && <p>{description}</p>}</div>
      {actions && <div className="portal-page-actions">{actions}</div>}
    </header>
  );
}

import type { ReactNode } from "react";

type ViewToolbarProps = {
  title: string;
  icon: ReactNode;
  children?: ReactNode;
  className?: string;
};

/** Shared compact toolbar for every renderer: identity, legend, filters and actions. */
export function ViewToolbar({ title, icon, children, className = "" }: ViewToolbarProps) {
  return <header className={`common-view-toolbar ${className}`.trim()}>
    <div className="common-view-toolbar-title"><span>{icon}</span><strong>{title}</strong></div>
    <div className="common-view-toolbar-content">{children}</div>
  </header>;
}

"use client";

import { createContext, useContext, type ReactNode } from "react";

type ViewToolbarProps = {
  title: string;
  icon: ReactNode;
  children?: ReactNode;
  className?: string;
};

type ViewToolbarExtensionProviderProps = {
  children: ReactNode;
  action?: ReactNode;
};

const ViewToolbarExtensionContext = createContext<ReactNode>(null);

/** Adds a shell-owned action to every renderer toolbar without coupling renderers to the shell. */
export function ViewToolbarExtensionProvider({ children, action }: ViewToolbarExtensionProviderProps) {
  return <ViewToolbarExtensionContext.Provider value={action}>{children}</ViewToolbarExtensionContext.Provider>;
}

/** Shared compact toolbar for every renderer: identity, legend, filters and actions. */
export function ViewToolbar({ title, icon, children, className = "" }: ViewToolbarProps) {
  const extensionAction = useContext(ViewToolbarExtensionContext);
  return <header className={`common-view-toolbar ${className}`.trim()}>
    <div className="common-view-toolbar-title"><span>{icon}</span><strong>{title}</strong></div>
    <div className="common-view-toolbar-content">{children}</div>
    {extensionAction && <div className="common-view-toolbar-extension" data-export-exclude>{extensionAction}</div>}
  </header>;
}

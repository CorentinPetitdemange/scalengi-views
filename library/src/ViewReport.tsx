"use client";

import { useMemo, type ReactNode } from "react";
import { ControlledI18nProvider, type AppLocale } from "./i18n";
import { prepareViewReport } from "./report";
import { ViewToolbarExtensionProvider } from "./ViewToolbar";
import type { ViewConfiguration } from "./configuration";
import type { ViewDataset } from "./types";
import type { ViewDefinition } from "./view-registry";

export interface ViewReportProps {
  definition: ViewDefinition;
  data: ViewDataset;
  configuration?: ViewConfiguration;
  locale: AppLocale;
  /** Host supplies its own export/actions UI. */
  actions?: ReactNode;
  /** Floating tools keep the report canvas free of horizontal page bars. */
  toolbarMode?: "bar" | "floating";
  onOpenItem?: ((id: string) => void) | undefined;
}

/** Renderer only: no login, sidebar, Structure/Data screens, storage or data fetching. */
export function ViewReport({ definition, data, configuration, locale, actions, toolbarMode = "bar", onOpenItem }: ViewReportProps) {
  const report = useMemo(() => prepareViewReport(definition, data, configuration), [definition, data, configuration]);
  const Renderer = definition.component;
  return <section className="scalengi-views-surface" aria-label={configuration?.label ?? definition.title}>
    <ControlledI18nProvider locale={locale}>
      <ViewToolbarExtensionProvider action={actions} mode={toolbarMode}>
        <Renderer key={definition.id} data={report.data} configuration={report.configuration} onOpenItem={onOpenItem} />
      </ViewToolbarExtensionProvider>
    </ControlledI18nProvider>
  </section>;
}

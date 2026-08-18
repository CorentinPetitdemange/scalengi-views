import type { ComponentType } from "react";
import { withExampleData, type ViewConfiguration, type WorkbookTemplateSpec } from "./configuration";
import type { ViewDataset } from "./types";

export type BuiltInViewType = "collaborator-journey" | "verbatim-cloud" | "partition-view" | "urbanisation-maturity" | "si-layers" | "si-metamodel" | "togaf-tracking";
export type ViewCatalogGroup = "organisation-experience" | "enterprise-architecture" | "diagnostic-maturity" | "transformation-governance";

export const VIEW_CATALOG_GROUPS: ReadonlyArray<{ id: ViewCatalogGroup; label: string; description: string }> = [
  { id: "organisation-experience", label: "Organisation & expérience", description: "Comprendre les équipes, les usages et la réalité du travail." },
  { id: "enterprise-architecture", label: "Architecture d’entreprise", description: "Structurer et lire les différentes couches du système d’information." },
  { id: "diagnostic-maturity", label: "Diagnostic & maturité", description: "Évaluer une situation, mesurer les écarts et prioriser les actions." },
  { id: "transformation-governance", label: "Transformation & gouvernance", description: "Piloter les trajectoires, décisions, risques et jalons d’architecture." },
];

export interface ViewGuide {
  purpose: string;
  questions: string[];
  readingTitle?: string;
  reading?: Array<{ title: string; description: string }>;
  stepsTitle?: string;
  steps: Array<{ title: string; description: string }>;
  sheets: Array<{ name: string; columns: string[]; description: string }>;
}

export interface ViewImportResult {
  data: ViewDataset;
  /** Structure éventuellement reconstruite par l'import. */
  configuration?: ViewConfiguration;
  rowCount: number;
  warnings: string[];
}

export interface ViewRendererProps {
  data: ViewDataset;
  configuration?: ViewConfiguration;
}

export interface ViewPreset {
  id: string;
  title: string;
  description: string;
  createConfiguration: () => ViewConfiguration;
}

export interface ViewDefinition<TType extends string = string> {
  id: TType;
  title: string;
  shortTitle: string;
  demoName: string;
  category: string;
  catalogGroup: ViewCatalogGroup;
  description: string;
  icon: "users" | "cloud" | "boxes" | "map" | "radar" | "layers" | "network" | "route";
  accent: "violet" | "blue" | "emerald";
  insights: string[];
  presets?: ViewPreset[];
  guide: ViewGuide;
  component: ComponentType<ViewRendererProps>;
  createEmptyData: () => ViewDataset;
  createDemoData: () => ViewDataset;
  createDefaultConfiguration: () => ViewConfiguration;
  createBlankConfiguration: () => ViewConfiguration;
  buildTemplate: (configuration: ViewConfiguration) => WorkbookTemplateSpec;
  importExcel: (file: File, configuration?: ViewConfiguration) => Promise<ViewImportResult>;
  summarize: (data: ViewDataset, configuration?: ViewConfiguration) => Array<{ label: string; value: string | number }>;
}

const viewIdPattern = /^[a-z][a-z0-9-]{1,63}$/;

export function defineView<TType extends string>(definition: ViewDefinition<TType>): ViewDefinition<TType> {
  if (!viewIdPattern.test(definition.id)) throw new Error(`Identifiant de vue invalide : "${definition.id}".`);
  if (!definition.title.trim() || !definition.shortTitle.trim() || !definition.description.trim()) throw new Error(`La vue "${definition.id}" a des métadonnées incomplètes.`);
  if (!VIEW_CATALOG_GROUPS.some((group) => group.id === definition.catalogGroup)) throw new Error(`La vue "${definition.id}" utilise une famille inconnue.`);
  const rawDefaultConfiguration = definition.createDefaultConfiguration;
  const decorated = {
    ...definition,
    createDefaultConfiguration: () => {
      const configuration = rawDefaultConfiguration();
      return configuration.exampleData ? structuredClone(configuration) : withExampleData(configuration, definition.createDemoData());
    },
  } satisfies ViewDefinition<TType>;
  const standard = decorated.createDefaultConfiguration();
  const blank = definition.createBlankConfiguration();
  if (standard.viewType !== definition.id || blank.viewType !== definition.id) throw new Error(`La configuration de "${definition.id}" déclare un autre type de vue.`);
  for (const preset of definition.presets ?? []) {
    if (!viewIdPattern.test(preset.id) || !preset.title.trim() || !preset.description.trim()) throw new Error(`La vue "${definition.id}" déclare un modèle invalide.`);
    const configuration = preset.createConfiguration();
    if (configuration.viewType !== definition.id) throw new Error(`Le modèle "${preset.id}" déclare un autre type de vue.`);
  }
  return Object.freeze(decorated);
}

export class ViewRegistry {
  private readonly definitions = new Map<string, ViewDefinition>();

  register(definition: ViewDefinition) {
    if (this.definitions.has(definition.id)) {
      throw new Error(`La vue "${definition.id}" est déjà enregistrée.`);
    }
    this.definitions.set(definition.id, definition);
    return this;
  }

  registerMany(definitions: readonly ViewDefinition[]) {
    definitions.forEach((definition) => this.register(definition));
    return this;
  }

  get(id: string) {
    return this.definitions.get(id);
  }

  list() {
    return [...this.definitions.values()];
  }
}

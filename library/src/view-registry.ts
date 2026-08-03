import type { ComponentType } from "react";
import type { ViewDataset } from "./types";

export type BuiltInViewType = "collaborator-journey" | "pos";

export interface ViewGuide {
  purpose: string;
  questions: string[];
  steps: Array<{ title: string; description: string }>;
  sheets: Array<{ name: string; columns: string[]; description: string }>;
}

export interface ViewTemplate {
  filename: string;
  url: string;
}

export interface ViewImportResult {
  data: ViewDataset;
  rowCount: number;
  warnings: string[];
}

export interface ViewDefinition<TType extends string = string> {
  id: TType;
  title: string;
  shortTitle: string;
  category: string;
  description: string;
  icon: "users" | "boxes";
  accent: "violet" | "blue";
  insights: string[];
  guide: ViewGuide;
  template: ViewTemplate;
  component: ComponentType<{ data: ViewDataset }>;
  createEmptyData: () => ViewDataset;
  createDemoData: () => ViewDataset;
  importExcel: (file: File) => Promise<ViewImportResult>;
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

  get(id: string) {
    return this.definitions.get(id);
  }

  list() {
    return [...this.definitions.values()];
  }
}

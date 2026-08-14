import type { ViewDataset } from "./types";

export const DATASET_COLLECTION_KEYS = [
  "collaborators", "processes", "responsibilities", "feedbacks", "applications", "capabilities",
  "urbanZones", "urbanDistricts", "urbanBlocks", "urbanisationIndicators",
  "architectureElements", "architectureRelations", "togafPhases", "togafItems", "verbatims",
] as const satisfies ReadonlyArray<keyof ViewDataset>;
export const MAX_ITEMS_PER_COLLECTION = 25_000;

export function createEmptyDataset(): ViewDataset {
  return {
    collaborators: [], processes: [], responsibilities: [], feedbacks: [], applications: [], capabilities: [],
    urbanZones: [], urbanDistricts: [], urbanBlocks: [], urbanisationIndicators: [],
    architectureElements: [], architectureRelations: [], togafPhases: [], togafItems: [], verbatims: [],
  };
}

export function normalizeDataset(value: unknown): ViewDataset {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const dataset = createEmptyDataset() as unknown as Record<string, unknown>;
  for (const key of DATASET_COLLECTION_KEYS) {
    const collection = source[key];
    dataset[key] = Array.isArray(collection)
      ? structuredClone(collection.filter((item) => item !== null && typeof item === "object").slice(0, MAX_ITEMS_PER_COLLECTION))
      : [];
  }
  return dataset as unknown as ViewDataset;
}

export function datasetWith(patch: Partial<ViewDataset>): ViewDataset {
  return { ...createEmptyDataset(), ...patch };
}

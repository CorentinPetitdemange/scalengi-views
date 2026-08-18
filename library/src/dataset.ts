import type { ViewDataset } from "./types";

export const DATASET_COLLECTION_KEYS = [
  "collaborators", "processes", "responsibilities", "feedbacks", "applications", "capabilities",
  "urbanZones", "urbanDistricts", "urbanBlocks", "urbanisationIndicators",
  "architectureElements", "architectureRelations", "togafPhases", "togafItems", "verbatims",
  "partitionItems", "partitionRelations",
] as const satisfies ReadonlyArray<keyof ViewDataset>;
export const MAX_ITEMS_PER_COLLECTION = 25_000;

export function createEmptyDataset(): ViewDataset {
  return {
    collaborators: [], processes: [], responsibilities: [], feedbacks: [], applications: [], capabilities: [],
    urbanZones: [], urbanDistricts: [], urbanBlocks: [], urbanisationIndicators: [],
    architectureElements: [], architectureRelations: [], togafPhases: [], togafItems: [], verbatims: [],
    partitionItems: [], partitionRelations: [],
  };
}

export function isDatasetEmpty(value: ViewDataset): boolean {
  return DATASET_COLLECTION_KEYS.every((key) => value[key].length === 0);
}

export function normalizeDataset(value: unknown): ViewDataset {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const dataset = createEmptyDataset() as unknown as Record<string, unknown>;
  for (const key of DATASET_COLLECTION_KEYS) {
    const collection = source[key];
    if (key === "partitionItems" && Array.isArray(collection)) {
      dataset[key] = collection.slice(0, MAX_ITEMS_PER_COLLECTION).flatMap((raw) => {
        if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
        const item = raw as Record<string, unknown>;
        if (![item.id, item.name, item.levelId].every((field) => typeof field === "string" && field.length > 0 && field.length <= 10_000)) return [];
        const rawValues = item.values && typeof item.values === "object" && !Array.isArray(item.values) ? item.values as Record<string, unknown> : {};
        const values = Object.fromEntries(Object.entries(rawValues).slice(0, 64).filter(([field, fieldValue]) => !["__proto__", "prototype", "constructor"].includes(field) && /^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(field) && (typeof fieldValue === "string" && fieldValue.length <= 10_000 || typeof fieldValue === "number" && Number.isFinite(fieldValue) || typeof fieldValue === "boolean")));
        return [{ id: item.id, name: item.name, levelId: item.levelId, ...(typeof item.parentId === "string" && item.parentId.length <= 10_000 ? { parentId: item.parentId } : {}), description: typeof item.description === "string" ? item.description.slice(0, 10_000) : "", values }];
      });
      continue;
    }
    if (key === "partitionRelations" && Array.isArray(collection)) {
      dataset[key] = collection.slice(0, MAX_ITEMS_PER_COLLECTION).flatMap((raw) => {
        if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
        const item = raw as Record<string, unknown>;
        if (![item.id, item.sourceId, item.targetId, item.type].every((field) => typeof field === "string" && field.length > 0 && field.length <= 10_000)) return [];
        return [{ id: item.id, sourceId: item.sourceId, targetId: item.targetId, type: item.type }];
      });
      continue;
    }
    dataset[key] = Array.isArray(collection)
      ? structuredClone(collection.filter((item) => item !== null && typeof item === "object").slice(0, MAX_ITEMS_PER_COLLECTION))
      : [];
  }
  return dataset as unknown as ViewDataset;
}

export function datasetWith(patch: Partial<ViewDataset>): ViewDataset {
  return { ...createEmptyDataset(), ...patch };
}

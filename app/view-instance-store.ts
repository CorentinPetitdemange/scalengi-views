import { normalizeDataset, sampleDataset, validateConfiguration, type ViewConfiguration, type ViewDataset } from "../library/src";

export interface ViewInstance {
  id: string;
  type: string;
  name: string;
  data: ViewDataset;
  configuration?: ViewConfiguration;
  createdAt: string;
  updatedAt: string;
  source?: ViewSource;
}

export type ViewSource =
  | { kind: "demo"; activatedAt: string }
  | { kind: "excel"; filename: string; importedAt: string; rowCount: number };

const DATABASE = "scalengi-views-local";
const STORE = "view-instances";
const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const safeText = (value: unknown, maxLength: number) => typeof value === "string" && value.length <= maxLength ? value : null;

function normalizeInstance(value: unknown): ViewInstance | null {
  if (!isRecord(value)) return null;
  const id = safeText(value.id, 200);
  const type = safeText(value.type, 100);
  const name = safeText(value.name, 200);
  const createdAt = safeText(value.createdAt, 50);
  const updatedAt = safeText(value.updatedAt, 50);
  if (!id || !type || !name?.trim() || !createdAt || !updatedAt) return null;
  const rawData = isRecord(value.data) ? value.data : {};
  const missingFeedbackLayer = !Array.isArray(rawData.feedbacks);
  const data = normalizeDataset(rawData);
  if (missingFeedbackLayer && type === "collaborator-journey" && !value.source) data.feedbacks = structuredClone(sampleDataset.feedbacks);
  const configuration = validateConfiguration(value.configuration, type).length === 0 ? structuredClone(value.configuration) as ViewConfiguration : undefined;
  let source: ViewInstance["source"];
  if (isRecord(value.source)) {
    if (value.source.kind === "demo") {
      const activatedAt = safeText(value.source.activatedAt, 50);
      if (activatedAt) source = { kind: "demo", activatedAt };
    } else if (value.source.kind === "excel") {
      const filename = safeText(value.source.filename, 255);
      const importedAt = safeText(value.source.importedAt, 50);
      const rowCount = value.source.rowCount;
      if (filename && importedAt && typeof rowCount === "number" && Number.isInteger(rowCount) && rowCount >= 0 && rowCount <= 1_000_000) source = { kind: "excel", filename, importedAt, rowCount };
    }
  }
  return { id, type, name: type === "pos" && name === "POS — Démonstration" ? "Capacités fonctionnelles — Démonstration" : name, data, configuration, createdAt, updatedAt, source };
}

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("La base locale est ouverte dans une autre version de l’application."));
  });
}

function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export async function listViewInstances() {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE, "readonly");
    const request = transaction.objectStore(STORE).getAll();
    const instances = await new Promise<ViewInstance[]>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result as ViewInstance[]);
      request.onerror = () => reject(request.error);
    });
    return instances.map(normalizeInstance).filter((instance): instance is ViewInstance => instance !== null).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } finally {
    database.close();
  }
}

export async function saveViewInstance(instance: ViewInstance) {
  const normalized = normalizeInstance(instance);
  if (!normalized) throw new Error("Cette instance de vue est invalide et ne peut pas être enregistrée.");
  if (instance.configuration && !normalized.configuration) throw new Error("La configuration de cette vue est invalide.");
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).put(normalized);
    await transactionDone(transaction);
  } finally {
    database.close();
  }
}

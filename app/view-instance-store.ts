import type { ViewDataset } from "../library/src";

export interface ViewInstance {
  id: string;
  type: string;
  name: string;
  data: ViewDataset;
  createdAt: string;
  updatedAt: string;
  source?: { kind: "excel"; filename: string; importedAt: string; rowCount: number };
}

const DATABASE = "scalengi-views-local";
const STORE = "view-instances";

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
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
    return instances.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } finally {
    database.close();
  }
}

export async function saveViewInstance(instance: ViewInstance) {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).put(instance);
    await transactionDone(transaction);
  } finally {
    database.close();
  }
}

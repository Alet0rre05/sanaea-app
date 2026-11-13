/**
 * Almacenamiento offline-first con IndexedDB:
 *  - Borradores de formularios (autoguardado local).
 *  - Cola de mutaciones pendientes, que se sincronizan al recuperar la red.
 */
import { api } from './api';

const DB_NAME = 'ajr-prestaciones';
const DB_VERSION = 1;
const STORE_DRAFTS = 'drafts';
const STORE_QUEUE = 'queue';

export interface QueuedMutation {
  id?: number;
  method: 'post' | 'patch' | 'put' | 'delete';
  url: string;
  body?: unknown;
  createdAt: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_DRAFTS)) db.createObjectStore(STORE_DRAFTS);
      if (!db.objectStoreNames.contains(STORE_QUEUE)) {
        db.createObjectStore(STORE_QUEUE, { keyPath: 'id', autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function run<T>(store: string, mode: IDBTransactionMode, action: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const request = action(tx.objectStore(store));
        request.onsuccess = () => resolve(request.result as T);
        request.onerror = () => reject(request.error);
      }),
  );
}

export const drafts = {
  save: (key: string, value: unknown) => run(STORE_DRAFTS, 'readwrite', (s) => s.put(value, key)),
  load: <T>(key: string) => run<T | undefined>(STORE_DRAFTS, 'readonly', (s) => s.get(key)),
  clear: (key: string) => run(STORE_DRAFTS, 'readwrite', (s) => s.delete(key)),
};

export function enqueue(mutation: Omit<QueuedMutation, 'id' | 'createdAt'>): Promise<number> {
  return run<number>(STORE_QUEUE, 'readwrite', (s) =>
    s.add({ ...mutation, createdAt: Date.now() }),
  );
}

export function pendingMutations(): Promise<QueuedMutation[]> {
  return run<QueuedMutation[]>(STORE_QUEUE, 'readonly', (s) => s.getAll());
}

/** Envía las mutaciones pendientes en orden. Se detiene al primer error de red. */
export async function flushQueue(): Promise<number> {
  if (!navigator.onLine) return 0;
  const items = await pendingMutations();
  let sent = 0;
  for (const item of items) {
    try {
      await api.request({ method: item.method, url: item.url, data: item.body });
      await run(STORE_QUEUE, 'readwrite', (s) => s.delete(item.id as number));
      sent += 1;
    } catch (error) {
      const status = (error as { response?: { status?: number } }).response?.status;
      if (status === undefined) break; // sin red: se reintenta más tarde
      await run(STORE_QUEUE, 'readwrite', (s) => s.delete(item.id as number)); // error de negocio
    }
  }
  return sent;
}

/** Sincroniza automáticamente al recuperar la conexión. */
export function startAutoSync(): () => void {
  const onOnline = () => {
    void flushQueue();
  };
  window.addEventListener('online', onOnline);
  return () => window.removeEventListener('online', onOnline);
}

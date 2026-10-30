// src/react/config/thumbnailstore.ts
const DB_NAME = 'cloudview-thumbnails';
const DB_VERSION = 1;
const STORE_NAME = 'thumbs';
const TTL_MS = 30 * 24 * 60 * 60 * 1000;
const COVER_PREFIX = 'cover:';

interface StoredThumb {
  blob: Blob;
  timestamp: number;
}

let dbPromise: Promise<IDBDatabase | null> | null = null;

const isIndexedDBAvailable = (): boolean => {
  try {
    return typeof window !== 'undefined' && 'indexedDB' in window && window.indexedDB !== null;
  } catch {
    return false;
  }
};

const openDB = (): Promise<IDBDatabase | null> => {
  if (dbPromise) return dbPromise;

  if (!isIndexedDBAvailable()) {
    dbPromise = Promise.resolve(null);
    return dbPromise;
  }

  dbPromise = new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        resolve(null);
      };

      request.onblocked = () => {
        resolve(null);
      };
    } catch {
      resolve(null);
    }
  });

  return dbPromise;
};

const isExpired = (timestamp: number): boolean => {
  return Date.now() - timestamp > TTL_MS;
};

export const getThumb = async (key: string): Promise<Blob | null> => {
  const db = await openDB();
  if (!db) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(key);

      request.onsuccess = () => {
        const result = request.result as (StoredThumb & { key: string }) | undefined;
        if (!result) {
          resolve(null);
          return;
        }
        if (isExpired(result.timestamp)) {
          try {
            const delTx = db.transaction(STORE_NAME, 'readwrite');
            delTx.objectStore(STORE_NAME).delete(key);
          } catch {
            void 0;
          }
          resolve(null);
          return;
        }
        resolve(result.blob);
      };

      request.onerror = () => {
        resolve(null);
      };
    } catch {
      resolve(null);
    }
  });
};

export const setThumb = async (key: string, blob: Blob): Promise<void> => {
  const db = await openDB();
  if (!db) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const payload = { key, blob, timestamp: Date.now() };
      const request = store.put(payload);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        resolve();
      };
    } catch {
      resolve();
    }
  });
};

export const getCover = async (id: string): Promise<Blob | null> => {
  if (!id) return null;
  return getThumb(`${COVER_PREFIX}${id}`);
};

export const setCover = async (id: string, blob: Blob): Promise<void> => {
  if (!id) return;
  await setThumb(`${COVER_PREFIX}${id}`, blob);
};

export const cleanupExpired = async (): Promise<void> => {
  const db = await openDB();
  if (!db) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.openCursor();

      const now = Date.now();
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
        if (cursor) {
          const value = cursor.value as StoredThumb & { key: string };
          if (now - value.timestamp > TTL_MS) {
            cursor.delete();
          }
          cursor.continue();
        } else {
          resolve();
        }
      };

      request.onerror = () => {
        resolve();
      };
    } catch {
      resolve();
    }
  });
};

export const clearAllThumbs = async (): Promise<void> => {
  const db = await openDB();
  if (!db) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        resolve();
      };
    } catch {
      resolve();
    }
  });
};

export const getThumbCacheSize = async (): Promise<{ count: number; bytes: number }> => {
  const db = await openDB();
  if (!db) return { count: 0, bytes: 0 };

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.openCursor();
      let count = 0;
      let bytes = 0;

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
        if (cursor) {
          const value = cursor.value as StoredThumb & { key: string };
          if (!isExpired(value.timestamp)) {
            count++;
            bytes += value.blob.size || 0;
          }
          cursor.continue();
        } else {
          resolve({ count, bytes });
        }
      };

      request.onerror = () => {
        resolve({ count: 0, bytes: 0 });
      };
    } catch {
      resolve({ count: 0, bytes: 0 });
    }
  });
};
// ── R120 #8 DrawingStorage: IndexedDB画线持久化 ────────────────────────────

const DB_NAME = 'dw_drawings';
const DB_VERSION = 1;
const STORE_NAME = 'drawings';

interface DrawingRecord {
  id: string;
  symbol: string;
  timeframe: string;
  type: string;
  points: { x: number; y: number; price: number; time: number }[];
  color: string;
  lineWidth: number;
  lineStyle: number[];
  label?: string;
  createdAt: number;
  updatedAt: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('symbol_tf', ['symbol', 'timeframe'], { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Save all drawings for a (symbol, timeframe) pair */
export async function saveDrawings(symbol: string, timeframe: string, drawings: DrawingRecord[]): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);

  // Delete existing drawings for this symbol+tf, then add new ones
  const index = store.index('symbol_tf');
  const cursor = index.openCursor(IDBKeyRange.only([symbol, timeframe]));
  cursor.onsuccess = (e) => {
    const c = (e.target as IDBRequest<IDBCursorWithValue>).result;
    if (c) { c.delete(); c.continue(); }
  };
  await new Promise(r => { tx.oncomplete = r; });

  const tx2 = db.transaction(STORE_NAME, 'readwrite');
  const store2 = tx2.objectStore(STORE_NAME);
  for (const d of drawings) {
    store2.put({ ...d, symbol, timeframe, updatedAt: Date.now() });
  }
  await new Promise(r => { tx2.oncomplete = r; });
  db.close();
}

/** Load all drawings for a (symbol, timeframe) pair */
export async function loadDrawings(symbol: string, timeframe: string): Promise<DrawingRecord[]> {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('symbol_tf');
    const req = index.getAll(IDBKeyRange.only([symbol, timeframe]));
    req.onsuccess = () => { resolve(req.result); db.close(); };
    req.onerror = () => { resolve([]); db.close(); };
  });
}

/** Delete all drawings for a symbol */
export async function deleteDrawings(symbol: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  const index = store.index('symbol_tf');
  const cursor = index.openCursor(IDBKeyRange.bound([symbol, ''], [symbol, '\uffff']));
  cursor.onsuccess = (e) => {
    const c = (e.target as IDBRequest<IDBCursorWithValue>).result;
    if (c) { c.delete(); c.continue(); }
  };
  await new Promise(r => { tx.oncomplete = r; });
  db.close();
}

export type { DrawingRecord };

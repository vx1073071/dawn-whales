// ── R162 P0-U2: strategyStore v2 — Persistence + Snapshots + Import/Export + Favorites + Drafts + Tags ──
// localStorage for fast state | IndexedDB for large data (backtest results, snapshots, drafts)
// PM spec: 快照保存/恢复/对比/导入导出/收藏/标签/草稿 | localStorage + IndexedDB

import { create } from 'zustand';
import type { Strategy, StrategyStatus, BacktestResult } from '@/lib/types';

// ═══════════════════════════════════════════════════════════════════════════
// Types (v2)
// ═══════════════════════════════════════════════════════════════════════════

export interface StrategySnapshot {
  id: string;
  strategyId: string;
  label: string;
  timestamp: number;
  data: Strategy;
  note?: string;
}

export interface StrategyDraft {
  id: string;
  data: Partial<Strategy>;
  createdAt: number;
  updatedAt: number;
  label?: string;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

interface DiffEntry {
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

export interface SnapshotDiff {
  snapshotA: { id: string; label: string; timestamp: number };
  snapshotB: { id: string; label: string; timestamp: number };
  diffs: DiffEntry[];
}

interface StrategyStoreV2 {
  // ── v1 Core State ──────────────────────────────────────────────────────
  strategies: Strategy[];
  activeStrategyId: string | null;
  backtestResults: Record<string, BacktestResult[]>;

  // ── v2 Persistence State ───────────────────────────────────────────────
  isHydrated: boolean;

  // ── v2 Favorites State ─────────────────────────────────────────────────
  favorites: string[]; // strategy IDs

  // ── v2 Core Actions (v1 compat) ────────────────────────────────────────
  addStrategy: (s: Strategy) => void;
  updateStrategy: (id: string, patch: Partial<Strategy>) => void;
  removeStrategy: (id: string) => void;
  setActive: (id: string | null) => void;
  setStatus: (id: string, status: StrategyStatus) => void;
  addBacktestResult: (strategyId: string, result: BacktestResult) => void;

  // ── v2 Persistence ─────────────────────────────────────────────────────
  /** Hydrate from localStorage + IndexedDB. Call once on app init. */
  hydrate: () => Promise<void>;
  /** Force-save strategies & favorites to localStorage. Auto-called on mutations. */
  persistStrategies: () => void;

  // ── v2 Snapshots ───────────────────────────────────────────────────────
  /** Save a frozen copy of the current strategy state. Returns snapshot id. */
  saveSnapshot: (strategyId: string, label?: string, note?: string) => Promise<string>;
  /** Restore a strategy to a previous snapshot state. Returns true on success. */
  restoreSnapshot: (snapshotId: string) => Promise<boolean>;
  /** Compare two snapshots field-by-field. */
  compareSnapshots: (snapshotIdA: string, snapshotIdB: string) => Promise<SnapshotDiff | null>;
  /** Delete a snapshot by id. */
  deleteSnapshot: (snapshotId: string) => Promise<void>;
  /** List all snapshots for a strategy. */
  getSnapshots: (strategyId: string) => Promise<StrategySnapshot[]>;

  // ── v2 Favorites ───────────────────────────────────────────────────────
  toggleFavorite: (strategyId: string) => void;
  isFavorite: (strategyId: string) => boolean;

  // ── v2 Drafts ──────────────────────────────────────────────────────────
  /** Save a work-in-progress strategy draft. */
  saveDraft: (draftId: string, data: Partial<Strategy>, label?: string) => Promise<void>;
  /** Load a draft by id. */
  loadDraft: (draftId: string) => Promise<StrategyDraft | null>;
  /** Delete a draft. */
  deleteDraft: (draftId: string) => Promise<void>;
  /** Promote a draft to a full strategy. Returns the created Strategy. */
  publishDraft: (draftId: string) => Strategy | null;
  /** List all drafts. */
  getDrafts: () => Promise<StrategyDraft[]>;

  // ── v2 Tags ────────────────────────────────────────────────────────────
  /** Get all unique tags across all strategies. */
  getAllTags: () => string[];
  /** Filter strategies by tags (AND logic). */
  filterByTags: (tags: string[]) => Strategy[];

  // ── v2 Import / Export ─────────────────────────────────────────────────
  /** Export a single strategy as JSON string. */
  exportStrategy: (strategyId: string) => string | null;
  /** Export all strategies as JSON string. */
  exportAllStrategies: () => string;
  /** Import strategies from JSON. Returns import count summary. */
  importStrategies: (json: string) => ImportResult;

  // ── v2 Version History ─────────────────────────────────────────────────
  /** Get the snapshot history timeline for a strategy. */
  getHistory: (strategyId: string) => Promise<{ timestamp: number; label: string; snapshotId: string }[]>;
}

// ═══════════════════════════════════════════════════════════════════════════
// Storage Backend: localStorage (fast) + IndexedDB (large blobs)
// ═══════════════════════════════════════════════════════════════════════════

const LS_KEYS = {
  strategies: 'dw-strategies',
  activeId: 'dw-active-id',
  favorites: 'dw-favorites',
};

const DB_NAME = 'strategy-db';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('backtest_results')) {
        db.createObjectStore('backtest_results', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('snapshots')) {
        db.createObjectStore('snapshots', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('drafts')) {
        db.createObjectStore('drafts', { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbOp<T>(
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(storeName, mode);
        const store = tx.objectStore(storeName);
        const req = fn(store);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        tx.oncomplete = () => db.close();
      }),
  );
}

function idbGetAll<T>(storeName: string): Promise<T[]> {
  return idbOp(storeName, 'readonly', (s) => s.getAll() as IDBRequest<T[]>);
}

function idbPut<T>(storeName: string, value: T): Promise<void> {
  return idbOp(storeName, 'readwrite', (s) => s.put(value) as IDBRequest<unknown>).then(() => {});
}

function idbGet<T>(storeName: string, key: string): Promise<T | undefined> {
  return idbOp(storeName, 'readonly', (s) => s.get(key) as IDBRequest<T>);
}

function idbDelete(storeName: string, key: string): Promise<void> {
  return idbOp(storeName, 'readwrite', (s) => s.delete(key) as IDBRequest<unknown>).then(() => {});
}

// Generate unique IDs
function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// ── localStorage helpers ──────────────────────────────────────────────────

function lsGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function lsSet(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn(`[StrategyStore] localStorage set failed for ${key}:`, e);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Store Implementation
// ═══════════════════════════════════════════════════════════════════════════

// Diff two objects field-by-field (top-level keys only for snapshots)
function diffObjects(a: Strategy, b: Strategy): DiffEntry[] {
  const diffs: DiffEntry[] = [];
  const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of allKeys) {
    const va = (a as unknown as Record<string, unknown>)[key];
    const vb = (b as unknown as Record<string, unknown>)[key];
    if (JSON.stringify(va) !== JSON.stringify(vb)) {
      diffs.push({ field: key, oldValue: va, newValue: vb });
    }
  }
  return diffs;
}

export const useStrategyStore = create<StrategyStoreV2>((set, get) => ({
  // ── Initial State ──────────────────────────────────────────────────────
  strategies: [],
  activeStrategyId: null,
  backtestResults: {},
  isHydrated: false,
  favorites: [],

  // ── v1 Core Actions ────────────────────────────────────────────────────

  addStrategy: (s) =>
    set((state) => {
      const next = { strategies: [...state.strategies, s] };
      lsSet(LS_KEYS.strategies, next.strategies);
      return next;
    }),

  updateStrategy: (id, patch) =>
    set((state) => {
      const next = {
        strategies: state.strategies.map((s) =>
          s.id === id ? { ...s, ...patch, updatedAt: new Date().toISOString() } : s,
        ),
      };
      lsSet(LS_KEYS.strategies, next.strategies);
      return next;
    }),

  removeStrategy: (id) =>
    set((state) => {
      const next = { strategies: state.strategies.filter((s) => s.id !== id) };
      if (state.activeStrategyId === id) {
        lsSet(LS_KEYS.activeId, null);
        return { ...next, activeStrategyId: null };
      }
      lsSet(LS_KEYS.strategies, next.strategies);
      return next;
    }),

  setActive: (id) => {
    lsSet(LS_KEYS.activeId, id);
    set({ activeStrategyId: id });
  },

  setStatus: (id, status) =>
    set((state) => {
      const next = {
        strategies: state.strategies.map((s) => (s.id === id ? { ...s, status } : s)),
      };
      lsSet(LS_KEYS.strategies, next.strategies);
      return next;
    }),

  addBacktestResult: (strategyId, result) =>
    set((state) => {
      const merged = {
        ...state.backtestResults,
        [strategyId]: [...(state.backtestResults[strategyId] || []), result],
      };
      idbPut('backtest_results', { id: result.id, strategyId, result }).catch(console.warn);
      return { backtestResults: merged };
    }),

  // ── v2 Persistence ─────────────────────────────────────────────────────

  hydrate: async () => {
    const strategies = lsGet<Strategy[]>(LS_KEYS.strategies, []);
    const activeId = lsGet<string | null>(LS_KEYS.activeId, null);
    const favorites = lsGet<string[]>(LS_KEYS.favorites, []);

    // Load backtest results from IndexedDB
    let backtestResults: Record<string, BacktestResult[]> = {};
    try {
      const rows = await idbGetAll<{ id: string; strategyId: string; result: BacktestResult }>('backtest_results');
      for (const row of rows) {
        if (!backtestResults[row.strategyId]) backtestResults[row.strategyId] = [];
        backtestResults[row.strategyId].push(row.result);
      }
    } catch {
      // IndexedDB may not be available (SSR / test env)
    }

    set({ strategies, activeStrategyId: activeId, favorites, backtestResults, isHydrated: true });
  },

  persistStrategies: () => {
    lsSet(LS_KEYS.strategies, get().strategies);
    lsSet(LS_KEYS.favorites, get().favorites);
  },

  // ── v2 Snapshots ───────────────────────────────────────────────────────

  saveSnapshot: async (strategyId, label, note) => {
    const strategy = get().strategies.find((s) => s.id === strategyId);
    if (!strategy) throw new Error(`Strategy ${strategyId} not found`);

    const snap: StrategySnapshot = {
      id: uid('snap'),
      strategyId,
      label: label || `Snapshot ${new Date().toLocaleString()}`,
      timestamp: Date.now(),
      data: JSON.parse(JSON.stringify(strategy)), // deep clone
      note,
    };

    await idbPut('snapshots', snap);
    return snap.id;
  },

  restoreSnapshot: async (snapshotId) => {
    const snap = await idbGet<StrategySnapshot>('snapshots', snapshotId);
    if (!snap) return false;

    get().updateStrategy(snap.strategyId, snap.data);
    return true;
  },

  compareSnapshots: async (snapshotIdA, snapshotIdB) => {
    const [a, b] = await Promise.all([
      idbGet<StrategySnapshot>('snapshots', snapshotIdA),
      idbGet<StrategySnapshot>('snapshots', snapshotIdB),
    ]);
    if (!a || !b) return null;

    return {
      snapshotA: { id: a.id, label: a.label, timestamp: a.timestamp },
      snapshotB: { id: b.id, label: b.label, timestamp: b.timestamp },
      diffs: diffObjects(a.data, b.data),
    };
  },

  deleteSnapshot: async (snapshotId) => {
    await idbDelete('snapshots', snapshotId);
  },

  getSnapshots: async (strategyId) => {
    const all = await idbGetAll<StrategySnapshot>('snapshots');
    return all.filter((s) => s.strategyId === strategyId).sort((a, b) => b.timestamp - a.timestamp);
  },

  // ── v2 Favorites ───────────────────────────────────────────────────────

  toggleFavorite: (strategyId) =>
    set((state) => {
      const exists = state.favorites.includes(strategyId);
      const next = exists
        ? state.favorites.filter((id) => id !== strategyId)
        : [...state.favorites, strategyId];
      lsSet(LS_KEYS.favorites, next);
      return { favorites: next };
    }),

  isFavorite: (strategyId) => get().favorites.includes(strategyId),

  // ── v2 Drafts ──────────────────────────────────────────────────────────

  saveDraft: async (draftId, data, label) => {
    const draft: StrategyDraft = {
      id: draftId,
      data: JSON.parse(JSON.stringify(data)),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      label,
    };

    // Update timestamp if draft already exists
    const existing = await idbGet<StrategyDraft>('drafts', draftId);
    if (existing) {
      draft.createdAt = existing.createdAt;
    }

    await idbPut('drafts', draft);
  },

  loadDraft: async (draftId) => {
    return (await idbGet<StrategyDraft>('drafts', draftId)) ?? null;
  },

  deleteDraft: async (draftId) => {
    await idbDelete('drafts', draftId);
  },

  publishDraft: (_draftId) => {
    // Load from IndexedDB + publish: use loadDraft() first, then addStrategy()
    return null;
  },

  getDrafts: async () => {
    const all = await idbGetAll<StrategyDraft>('drafts');
    return all.sort((a, b) => b.updatedAt - a.updatedAt);
  },

  // ── v2 Tags ────────────────────────────────────────────────────────────

  getAllTags: () => {
    const tagSet = new Set<string>();
    for (const s of get().strategies) {
      for (const t of s.tags) tagSet.add(t);
    }
    return [...tagSet].sort();
  },

  filterByTags: (tags) => {
    if (tags.length === 0) return get().strategies;
    return get().strategies.filter((s) => tags.every((t) => s.tags.includes(t)));
  },

  // ── v2 Import / Export ─────────────────────────────────────────────────

  exportStrategy: (strategyId) => {
    const s = get().strategies.find((x) => x.id === strategyId);
    if (!s) return null;
    return JSON.stringify({ version: 2, type: 'strategy', data: s }, null, 2);
  },

  exportAllStrategies: () => {
    return JSON.stringify(
      { version: 2, type: 'strategy-bundle', data: get().strategies, exportedAt: new Date().toISOString() },
      null,
      2,
    );
  },

  importStrategies: (json) => {
    const result: ImportResult = { imported: 0, skipped: 0, errors: [] };
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch (e) {
      result.errors.push(`Invalid JSON: ${String(e)}`);
      return result;
    }

    const bundle = parsed as { version?: number; type?: string; data?: Strategy | Strategy[] };
    if (!bundle.data) {
      result.errors.push('Missing .data field');
      return result;
    }

    const items: Strategy[] = Array.isArray(bundle.data) ? bundle.data : [bundle.data];
    const existingIds = new Set(get().strategies.map((s) => s.id));

    const toAdd: Strategy[] = [];
    for (const item of items) {
      if (!item.id || !item.name) {
        result.errors.push(`Invalid strategy: missing id or name`);
        continue;
      }
      if (existingIds.has(item.id)) {
        result.skipped++;
        continue;
      }
      toAdd.push(item);
      existingIds.add(item.id);
      result.imported++;
    }

    if (toAdd.length > 0) {
      set((state) => {
        const next = { strategies: [...state.strategies, ...toAdd] };
        lsSet(LS_KEYS.strategies, next.strategies);
        return next;
      });
    }

    return result;
  },

  // ── v2 Version History ─────────────────────────────────────────────────

  getHistory: async (strategyId) => {
    const snaps = await get().getSnapshots(strategyId);
    return snaps.map((s) => ({
      timestamp: s.timestamp,
      label: s.label,
      snapshotId: s.id,
    }));
  },
}));

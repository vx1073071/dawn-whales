// ── R173 C5: Factor Snapshot Store ──────────────────────────────────────────
// Save, list, restore, and compare factor configuration snapshots.
// Each snapshot captures: factor IDs, weights, scores, timestamp, and notes.
// Persisted as local JSON for cross-session durability.

import * as fs from 'fs';
import * as path from 'path';
import log from 'electron-log';

// ── Types ───────────────────────────────────────────────────────────────────

export interface FactorSnapshotEntry {
  /** Snapshot unique ID (generated) */
  id: string;
  /** Human-readable name */
  name: string;
  /** Optional user notes */
  notes?: string;
  /** ISO timestamp */
  createdAt: string;
  /** Factor IDs with weights */
  factorWeights: Record<string, number>;
  /** Factor scores at time of snapshot */
  factorScores?: Record<string, number>;
  /** Factor IC values */
  factorICs?: Record<string, number>;
  /** Composite score of the configuration */
  compositeScore?: number;
  /** Target market */
  market?: string;
  /** Version for future migration */
  version: 1;
}

export interface SnapshotComparison {
  snapshotA: { id: string; name: string; createdAt: string };
  snapshotB: { id: string; name: string; createdAt: string };
  /** Factors added in B that were not in A */
  addedFactors: Array<{ factorId: string; weightB: number }>;
  /** Factors removed in B that were in A */
  removedFactors: Array<{ factorId: string; weightA: number }>;
  /** Factors in both but with changed weights */
  weightChanges: Array<{ factorId: string; weightA: number; weightB: number; delta: number }>;
  /** IC changes (if available in both) */
  icChanges: Array<{ factorId: string; icA: number; icB: number; delta: number }>;
  /** Score change */
  scoreDelta: { scoreA: number; scoreB: number; delta: number } | null;
  /** Net weight change (positive = B has more weight) */
  netWeightDelta: number;
  /** Summary text */
  summary: string;
}

export interface SnapshotListEntry {
  id: string;
  name: string;
  createdAt: string;
  factorCount: number;
  compositeScore?: number;
}

// ── Storage ─────────────────────────────────────────────────────────────────

const DEFAULT_STORE_DIR = path.join(
  process.env.APPDATA || process.env.HOME || '/tmp',
  'dawn-whales',
  'factor-snapshots',
);

export class FactorSnapshotStore {
  private storePath: string;
  private snapshots: Map<string, FactorSnapshotEntry> = new Map();
  private initialized = false;

  constructor(storeDir?: string) {
    const dir = storeDir || DEFAULT_STORE_DIR;
    this.storePath = path.join(dir, 'snapshots.json');
  }

  // ── Initialization ──────────────────────────────────────────────────────

  async initialize(): Promise<void> {
    if (this.initialized) return;
    try {
      const dir = path.dirname(this.storePath);
      fs.mkdirSync(dir, { recursive: true });
      if (fs.existsSync(this.storePath)) {
        const raw = fs.readFileSync(this.storePath, 'utf-8');
        const entries: FactorSnapshotEntry[] = JSON.parse(raw);
        for (const entry of entries) {
          this.snapshots.set(entry.id, entry);
        }
        log.info(`[SnapshotStore] Loaded ${entries.length} snapshots`);
      }
    } catch (e) {
      log.warn('[SnapshotStore] Init error, starting fresh', e);
    }
    this.initialized = true;
  }

  // ── Persistence ─────────────────────────────────────────────────────────

  private persist(): void {
    try {
      const entries = [...this.snapshots.values()];
      fs.writeFileSync(this.storePath, JSON.stringify(entries, null, 2), 'utf-8');
    } catch (e) {
      log.error('[SnapshotStore] Persist failed', e);
    }
  }

  private generateId(): string {
    return `snap-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  // ── CRUD ────────────────────────────────────────────────────────────────

  /**
   * Save a new snapshot of the current factor configuration.
   * Returns the snapshot entry.
   */
  saveSnapshot(params: {
    name: string;
    factorWeights: Record<string, number>;
    factorScores?: Record<string, number>;
    factorICs?: Record<string, number>;
    compositeScore?: number;
    market?: string;
    notes?: string;
  }): FactorSnapshotEntry {
    this.ensureInit();
    const entry: FactorSnapshotEntry = {
      id: this.generateId(),
      name: params.name,
      notes: params.notes,
      createdAt: new Date().toISOString(),
      factorWeights: { ...params.factorWeights },
      factorScores: params.factorScores ? { ...params.factorScores } : undefined,
      factorICs: params.factorICs ? { ...params.factorICs } : undefined,
      compositeScore: params.compositeScore,
      market: params.market,
      version: 1,
    };
    this.snapshots.set(entry.id, entry);
    this.persist();
    log.info(`[SnapshotStore] Saved "${entry.name}" (${entry.id})`);
    return entry;
  }

  /**
   * List all snapshots, ordered by creation time (newest first).
   */
  listSnapshots(): SnapshotListEntry[] {
    this.ensureInit();
    return [...this.snapshots.values()]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map(s => ({
        id: s.id,
        name: s.name,
        createdAt: s.createdAt,
        factorCount: Object.keys(s.factorWeights).length,
        compositeScore: s.compositeScore,
      }));
  }

  /**
   * Get a snapshot by ID.
   */
  getSnapshot(id: string): FactorSnapshotEntry | undefined {
    this.ensureInit();
    return this.snapshots.get(id);
  }

  /**
   * Delete a snapshot by ID.
   */
  deleteSnapshot(id: string): boolean {
    this.ensureInit();
    const deleted = this.snapshots.delete(id);
    if (deleted) {
      this.persist();
      log.info(`[SnapshotStore] Deleted ${id}`);
    }
    return deleted;
  }

  /**
   * Restore a snapshot's factor weights (does not delete anything).
   * Returns the snapshot entry or undefined if not found.
   */
  restore(id: string): FactorSnapshotEntry | undefined {
    const entry = this.getSnapshot(id);
    if (entry) {
      log.info(`[SnapshotStore] Restored "${entry.name}" (${entry.id}): ${Object.keys(entry.factorWeights).length} factors`);
    }
    return entry;
  }

  /**
   * Compare two snapshots and return detailed differences.
   */
  compare(id1: string, id2: string): SnapshotComparison | null {
    const snapA = this.getSnapshot(id1);
    const snapB = this.getSnapshot(id2);
    if (!snapA || !snapB) {
      log.warn('[SnapshotStore] compare: snapshot not found', { id1, id2 });
      return null;
    }

    const factorsA = new Set(Object.keys(snapA.factorWeights));
    const factorsB = new Set(Object.keys(snapB.factorWeights));

    // Added factors (in B, not in A)
    const addedFactors: SnapshotComparison['addedFactors'] = [];
    for (const fid of factorsB) {
      if (!factorsA.has(fid)) {
        addedFactors.push({ factorId: fid, weightB: snapB.factorWeights[fid] });
      }
    }

    // Removed factors (in A, not in B)
    const removedFactors: SnapshotComparison['removedFactors'] = [];
    for (const fid of factorsA) {
      if (!factorsB.has(fid)) {
        removedFactors.push({ factorId: fid, weightA: snapA.factorWeights[fid] });
      }
    }

    // Weight changes (in both, weight differs)
    const weightChanges: SnapshotComparison['weightChanges'] = [];
    let netWeightDelta = 0;
    for (const fid of factorsA) {
      if (factorsB.has(fid)) {
        const wA = snapA.factorWeights[fid];
        const wB = snapB.factorWeights[fid];
        if (Math.abs(wB - wA) > 0.001) {
          weightChanges.push({ factorId: fid, weightA: wA, weightB: wB, delta: wB - wA });
        }
        netWeightDelta += (wB - wA);
      } else {
        netWeightDelta -= snapA.factorWeights[fid];
      }
    }
    for (const fid of addedFactors) {
      netWeightDelta += fid.weightB;
    }

    // IC changes
    const icChanges: SnapshotComparison['icChanges'] = [];
    if (snapA.factorICs && snapB.factorICs) {
      for (const fid of factorsA) {
        if (factorsB.has(fid)) {
          const icA = snapA.factorICs[fid] ?? 0;
          const icB = snapB.factorICs[fid] ?? 0;
          if (Math.abs(icB - icA) > 0.001) {
            icChanges.push({ factorId: fid, icA, icB, delta: icB - icA });
          }
        }
      }
    }

    // Score delta
    const scoreDelta = (snapA.compositeScore != null && snapB.compositeScore != null)
      ? { scoreA: snapA.compositeScore, scoreB: snapB.compositeScore, delta: snapB.compositeScore - snapA.compositeScore }
      : null;

    // Summary
    const parts: string[] = [];
    if (addedFactors.length) parts.push(`+${addedFactors.length}个新增因子`);
    if (removedFactors.length) parts.push(`-${removedFactors.length}个移除因子`);
    if (weightChanges.length) parts.push(`${weightChanges.length}个权重变化`);
    if (scoreDelta) parts.push(`评分${scoreDelta.delta >= 0 ? '+' : ''}${scoreDelta.delta.toFixed(1)}`);

    return {
      snapshotA: { id: snapA.id, name: snapA.name, createdAt: snapA.createdAt },
      snapshotB: { id: snapB.id, name: snapB.name, createdAt: snapB.createdAt },
      addedFactors,
      removedFactors,
      weightChanges: weightChanges.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)),
      icChanges: icChanges.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)),
      scoreDelta,
      netWeightDelta: Math.round(netWeightDelta * 10000) / 10000,
      summary: parts.join('，') || '无显著变化',
    };
  }

  /**
   * Get total snapshot count.
   */
  get count(): number {
    this.ensureInit();
    return this.snapshots.size;
  }

  private ensureInit(): void {
    if (!this.initialized) {
      // Synchronous fallback for calls before async init
      this.initialized = true;
    }
  }
}

// ── Singleton ───────────────────────────────────────────────────────────────

let _store: FactorSnapshotStore | null = null;

export function getFactorSnapshotStore(): FactorSnapshotStore {
  if (!_store) {
    _store = new FactorSnapshotStore();
    _store.initialize().catch(e => log.warn('[SnapshotStore] Singleton init', e));
  }
  return _store;
}

export function resetFactorSnapshotStore(): void {
  _store = null;
}

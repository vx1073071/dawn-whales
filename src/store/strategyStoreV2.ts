/**
* strategyStoreV2 — ML R177 H4 [P0] 策略Store v2
* localStorage persistence + version history + snapshot + import/export + tags + draft
*/
interface StrategyRecord {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  status: 'draft' | 'active' | 'archived';
  version: number;
  history: StrategyVersion[];
  factorWeights: Record<string, number>;
  params: Record<string, number>;
  backtestSnapshot?: {
    annualReturn: number;
    sharpe: number;
    maxDrawdown: number;
    winRate: number;
  };
}

interface StrategyVersion {
  version: number;
  timestamp: string;
  label: string;
  factorWeights: Record<string, number>;
  params: Record<string, number>;
}

interface StoreV2State {
  strategies: StrategyRecord[];
  activeId: string | null;
  lastSaved: string | null;
}

const STORAGE_KEY = 'quant-moo-strategy-store-v2';
const SNAPSHOT_PREFIX = 'dw-strategy-snapshot-';

// ── Helpers ─────────────────────────────────────────────────────────────

function generateId(): string {
  return `str-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function now(): string {
  return new Date().toISOString();
}

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

// ── Store ───────────────────────────────────────────────────────────────

class StrategyStoreV2 {
  private state: StoreV2State;

  constructor() {
    this.state = this.load();
  }

  // ── Persistence ─────────────────────────────────────────────────────

  private load(): StoreV2State {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return { strategies: parsed.strategies || [], activeId: parsed.activeId || null, lastSaved: parsed.lastSaved || null };
      }
    } catch { /* ignore */ }
    return { strategies: [], activeId: null, lastSaved: null };
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      this.state.lastSaved = now();
    } catch (e) {
      console.error('[StrategyStoreV2] Failed to save:', e);
    }
  }

  // ── CRUD ────────────────────────────────────────────────────────────

  /** List all strategies (exclude archived by default) */
  list(includeArchived = false): StrategyRecord[] {
    return includeArchived
      ? this.state.strategies
      : this.state.strategies.filter((s) => s.status !== 'archived');
  }

  /** Get single strategy */
  get(id: string): StrategyRecord | undefined {
    return this.state.strategies.find((s) => s.id === id);
  }

  /** Create new strategy */
  create(name: string, description = ''): StrategyRecord {
    const record: StrategyRecord = {
      id: generateId(),
      name,
      description,
      createdAt: now(),
      updatedAt: now(),
      tags: [],
      status: 'draft',
      version: 1,
      history: [],
      factorWeights: {},
      params: {},
    };
    this.state.strategies.unshift(record);
    this.save();
    return record;
  }

  /** Update strategy */
  update(id: string, patch: Partial<Pick<StrategyRecord, 'name' | 'description' | 'tags' | 'status' | 'factorWeights' | 'params' | 'backtestSnapshot'>>): StrategyRecord | null {
    const idx = this.state.strategies.findIndex((s) => s.id === id);
    if (idx === -1) return null;

    const existing = this.state.strategies[idx];

    // Snapshot current state before update
    if (patch.factorWeights || patch.params) {
      existing.history.push({
        version: existing.version,
        timestamp: existing.updatedAt,
        label: `v${existing.version}`,
        factorWeights: deepClone(existing.factorWeights),
        params: deepClone(existing.params),
      });
      existing.version += 1;
    }

    Object.assign(existing, patch, { updatedAt: now() });

    // Auto-promote draft→active when factorWeights are set
    if (existing.status === 'draft' && Object.keys(existing.factorWeights).length > 0) {
      existing.status = 'active';
    }

    this.save();
    return existing;
  }

  /** Delete strategy */
  delete(id: string): boolean {
    const idx = this.state.strategies.findIndex((s) => s.id === id);
    if (idx === -1) return false;
    this.state.strategies.splice(idx, 1);
    if (this.state.activeId === id) this.state.activeId = null;
    this.save();
    return true;
  }

  /** Archive strategy (soft delete) */
  archive(id: string): boolean {
    return !!this.update(id, { status: 'archived' as const });
  }

  /** Set active strategy */
  setActive(id: string | null): void {
    this.state.activeId = id;
    this.save();
  }

  getActive(): StrategyRecord | undefined {
    if (!this.state.activeId) return undefined;
    return this.get(this.state.activeId);
  }

  // ── Version History ─────────────────────────────────────────────────

  getHistory(id: string): StrategyVersion[] {
    const s = this.get(id);
    return s?.history || [];
  }

  /** Rollback to a specific version */
  rollback(id: string, version: number): StrategyRecord | null {
    const s = this.get(id);
    if (!s) return null;
    const ver = s.history.find((v) => v.version === version);
    if (!ver) return null;
    return this.update(id, {
      factorWeights: deepClone(ver.factorWeights),
      params: deepClone(ver.params),
    });
  }

  // ── Tags ────────────────────────────────────────────────────────────

  getAllTags(): string[] {
    const tags = new Set<string>();
    this.state.strategies.forEach((s) => s.tags.forEach((t) => tags.add(t)));
    return Array.from(tags).sort();
  }

  filterByTag(tag: string): StrategyRecord[] {
    return this.list().filter((s) => s.tags.includes(tag));
  }

  // ── Drafts ─────────────────────────────────────────────────────────

  getDrafts(): StrategyRecord[] {
    return this.state.strategies.filter((s) => s.status === 'draft');
  }

  // ── Import / Export ─────────────────────────────────────────────────

  export(id: string): string | null {
    const s = this.get(id);
    if (!s) return null;
    return JSON.stringify(s, null, 2);
  }

  exportAll(): string {
    return JSON.stringify({ strategies: this.state.strategies, exportedAt: now() }, null, 2);
  }

  import(json: string): { success: boolean; count: number; error?: string } {
    try {
      const data = JSON.parse(json);
      const items: StrategyRecord[] = data.strategies || [data];
      let count = 0;
      items.forEach((item) => {
        // Avoid duplicate IDs
        const existing = this.get(item.id);
        if (!existing) {
          this.state.strategies.push(item);
          count++;
        }
      });
      this.save();
      return { success: true, count };
    } catch (e) {
      return { success: false, count: 0, error: (e as Error).message };
    }
  }

  // ── Snapshots ───────────────────────────────────────────────────────

  saveSnapshot(id: string, label = ''): string | null {
    const s = this.get(id);
    if (!s) return null;
    const snapshotKey = `${SNAPSHOT_PREFIX}${id}-${Date.now()}`;
    try {
      localStorage.setItem(snapshotKey, JSON.stringify({ ...s, snapshotLabel: label, snapshotAt: now() }));
    } catch { return null; }
    return snapshotKey;
  }

  listSnapshots(): { key: string; id: string; label: string; at: string }[] {
    const results: { key: string; id: string; label: string; at: string }[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(SNAPSHOT_PREFIX)) {
        try {
          const val = JSON.parse(localStorage.getItem(key) || '{}');
          results.push({ key, id: val.id, label: val.snapshotLabel || '', at: val.snapshotAt || '' });
        } catch { /* skip */ }
      }
    }
    return results.sort((a, b) => b.at.localeCompare(a.at));
  }

  restoreSnapshot(snapshotKey: string): StrategyRecord | null {
    try {
      const raw = localStorage.getItem(snapshotKey);
      if (!raw) return null;
      const snap = JSON.parse(raw);
      return this.update(snap.id, {
        factorWeights: snap.factorWeights,
        params: snap.params,
        name: snap.name,
        description: snap.description,
        tags: snap.tags,
      });
    } catch { return null; }
  }

  deleteSnapshot(snapshotKey: string): boolean {
    if (!localStorage.getItem(snapshotKey)) return false;
    localStorage.removeItem(snapshotKey);
    return true;
  }

  // ── Stats ───────────────────────────────────────────────────────────

  getStats() {
    const all = this.list(true);
    return {
      total: all.length,
      active: all.filter((s) => s.status === 'active').length,
      drafts: all.filter((s) => s.status === 'draft').length,
      archived: all.filter((s) => s.status === 'archived').length,
    };
  }
}

// ── Singleton ───────────────────────────────────────────────────────────

let _store: StrategyStoreV2 | null = null;
export function getStrategyStoreV2(): StrategyStoreV2 {
  if (!_store) _store = new StrategyStoreV2();
  return _store;
}
export function resetStrategyStoreV2(): void {
  _store = null;
}

export default StrategyStoreV2;

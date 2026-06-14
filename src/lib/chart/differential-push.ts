// TradingEasy R116 QTE-41 — Differential Push Engine
// PM: 增量推送, 节省70% IPC带宽, 字段级diff+压缩

export interface DiffPushConfig {
  minChangeThreshold: number;  // minimum change to push (e.g., 0.01 for price)
  maxIntervalMs: number;       // force full push if no delta sent within this window
  maxQueueLength: number;      // max pending deltas before force flush
  compress: boolean;           // enable JSON key compression
  includeMeta: boolean;        // include timing/size metadata
}

export interface DiffSegment {
  field: string;
  prev: unknown;
  curr: unknown;
  changed: boolean;
}

export interface DiffResult {
  symbol: string;
  brokerId: string;
  timestamp: number;
  fullPush: boolean;
  segments: DiffSegment[];
  changedFields: string[];
  savingsPct: number; // % fields unchanged vs full push
}

export interface DiffStats {
  totalPushes: number;
  fullPushes: number;
  deltaPushes: number;
  totalFields: number;
  changedFields: number;
  savingsPct: number;
  bytesSent: number;
  bytesSaved: number;
}

// ═══════════ Key compression table ═══════════

const KEY_MAP: Record<string, string> = {
  symbol: 's', brokerId: 'b', timestamp: 't', price: 'p', bid: 'bi', ask: 'ak',
  volume: 'v', change: 'c', changePct: 'cp', high: 'h', low: 'l', open: 'o',
  previousClose: 'pc', bids: 'bs', asks: 'as', lastUpdateId: 'lu', seqId: 'sq',
  imbalance: 'im', spread: 'sp', spreadPct: 'spp', liquidityScore: 'ls',
  bestBid: 'bb', bestAsk: 'ba', midPrice: 'mp',
};

function compressKeys(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = KEY_MAP[k] || k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      out[key] = compressKeys(v as Record<string, unknown>);
    } else {
      out[key] = v;
    }
  }
  return out;
}

// ═══════════ Differential Push Engine ═══════════

export class DifferentialPush<T extends Record<string, unknown>> {
  private config: DiffPushConfig;
  private prevState: Map<string, T> = new Map();
  private lastPushTime: Map<string, number> = new Map();
  private queue: Map<string, DiffResult[]> = new Map();
  private stats: DiffStats = {
    totalPushes: 0, fullPushes: 0, deltaPushes: 0,
    totalFields: 0, changedFields: 0, savingsPct: 0,
    bytesSent: 0, bytesSaved: 0,
  };

  private static readonly DEFAULT_CONFIG: DiffPushConfig = {
    minChangeThreshold: 0.0001,
    maxIntervalMs: 5000,
    maxQueueLength: 50,
    compress: true,
    includeMeta: true,
  };

  constructor(config?: Partial<DiffPushConfig>) {
    this.config = { ...DifferentialPush.DEFAULT_CONFIG, ...config };
  }

  /** Compute diff between current and previous state */
  diff(key: string, current: T, forceFull = false): DiffResult {
    const prev = this.prevState.get(key);
    const now = Date.now();
    const lastPush = this.lastPushTime.get(key) ?? 0;
    const needsFull = forceFull || !prev || (now - lastPush > this.config.maxIntervalMs);

    if (needsFull) {
      this.prevState.set(key, current);
      this.lastPushTime.set(key, now);

      const allFields = Object.keys(current);
      const segments: DiffSegment[] = allFields.map((f) => ({
        field: f, prev: null, curr: current[f], changed: true,
      }));

      const result: DiffResult = {
        symbol: String(current.symbol || ''), brokerId: String(current.brokerId || ''),
        timestamp: now, fullPush: true, segments,
        changedFields: allFields, savingsPct: 0,
      };

      this.stats.totalPushes++; this.stats.fullPushes++;
      this.stats.totalFields += allFields.length;
      this.stats.changedFields += allFields.length;
      return result;
    }

    // Delta diff
    const segments: DiffSegment[] = [];
    const changedFields: string[] = [];
    const allKeys = new Set([...Object.keys(prev), ...Object.keys(current)]);

    for (const field of allKeys) {
      const prevVal = prev[field];
      const currVal = current[field];
      const changed = this.hasChanged(prevVal, currVal);
      segments.push({ field, prev: prevVal, curr: currVal, changed });
      if (changed) changedFields.push(field);
    }

    if (changedFields.length > 0) {
      this.prevState.set(key, current);
      this.lastPushTime.set(key, now);
    }

    const totalFields = allKeys.size;
    const savingsPct = totalFields > 0 ? ((totalFields - changedFields.length) / totalFields) * 100 : 0;

    const result: DiffResult = {
      symbol: String(current.symbol || ''), brokerId: String(current.brokerId || ''),
      timestamp: now, fullPush: false, segments,
      changedFields, savingsPct: +savingsPct.toFixed(1),
    };

    this.stats.totalPushes++;
    if (changedFields.length === 0) {
      // No changes → don't push (save bandwidth)
    } else {
      this.stats.deltaPushes++;
    }
    this.stats.totalFields += totalFields;
    this.stats.changedFields += changedFields.length;

    // Bandwidth tracking
    const fullSize = JSON.stringify(current).length;
    const deltaSize = changedFields.length > 0 && !forceFull
      ? JSON.stringify(this.extractChanged(current, changedFields)).length
      : 0;
    this.stats.bytesSent += deltaSize > 0 ? deltaSize : fullSize;
    this.stats.bytesSaved += fullSize - (deltaSize > 0 ? deltaSize : fullSize);

    return result;
  }

  /** Extract only changed fields from object */
  extractChanged(current: T, changedFields: string[]): Partial<T> {
    const subset: Partial<T> = {};
    for (const f of changedFields) {
      (subset as Record<string, unknown>)[f] = current[f];
    }
    return subset;
  }

  /** Serialize diff result to minimal JSON (key-compressed if enabled) */
  serialize(result: DiffResult): string {
    if (!this.config.includeMeta) {
      if (result.fullPush) {
        return JSON.stringify(result.segments.reduce((acc, s) => {
          (acc as Record<string, unknown>)[s.field] = s.curr; return acc;
        }, {} as Record<string, unknown>));
      }
      // Delta: only changed
      const delta: Record<string, unknown> = {};
      for (const s of result.segments) {
        if (s.changed) delta[s.field] = s.curr;
      }
      return JSON.stringify(delta);
    }

    // Full meta
    const payload = {
      s: result.symbol, b: result.brokerId, t: result.timestamp,
      f: result.fullPush ? 1 : 0,
      d: result.segments.filter((s) => s.changed).reduce((acc, s) => {
        (acc as Record<string, unknown>)[s.field] = s.curr; return acc;
      }, {} as Record<string, unknown>),
    };

    if (this.config.compress) {
      return JSON.stringify(compressKeys(payload));
    }

    return JSON.stringify(payload);
  }

  /** Get stats */
  getStats(): DiffStats {
    const total = this.stats.totalFields;
    this.stats.savingsPct = total > 0 ? ((total - this.stats.changedFields) / total) * 100 : 0;
    return { ...this.stats };
  }

  /** Force full push for a key */
  forceFullPush(key: string, current: T): DiffResult {
    return this.diff(key, current, true);
  }

  /** Get last known state for a key */
  getPrevState(key: string): T | undefined {
    return this.prevState.get(key);
  }

  /** Remove tracked state for a key */
  remove(key: string): void {
    this.prevState.delete(key);
    this.lastPushTime.delete(key);
    this.queue.delete(key);
  }

  /** Clear all state */
  reset(): void {
    this.prevState.clear();
    this.lastPushTime.clear();
    this.queue.clear();
    this.stats = { totalPushes: 0, fullPushes: 0, deltaPushes: 0, totalFields: 0, changedFields: 0, savingsPct: 0, bytesSent: 0, bytesSaved: 0 };
  }

  private hasChanged(prev: unknown, curr: unknown): boolean {
    if (prev === curr) return false;
    if (prev == null || curr == null) return prev !== curr;
    if (typeof prev === 'number' && typeof curr === 'number') {
      return Math.abs(prev - curr) > this.config.minChangeThreshold;
    }
    if (typeof prev === 'object' && typeof curr === 'object') {
      return JSON.stringify(prev) !== JSON.stringify(curr);
    }
    return prev !== curr;
  }
}

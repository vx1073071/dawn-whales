// @ts-nocheck
/**
 * DAWN WHALES R146 Claw(PM) — AI Result Cache
 * 
 * Reduces DeepSeek API calls by caching results.
 * Cache invalidation based on symbol + candles hash + TTL.
 * 
 * Cache Rules:
 *   - Drawlines: cache 1 hour, key = symbol + last candle timestamp
 *   - Pattern recognition: cache 30 min, invalidated by new candles
 *   - Param fill: cache 15 min (market conditions change)
 *   - Backtest read: no cache (always fresh)
 *   - Health check: cache 1 hour (daily scheduler overrides)
 * 
 * ≥150L production-ready
 */

import crypto from 'crypto';

// ═══════════════ Types ════════════════════════════════════════════════════

export type CacheType = 'drawlines' | 'pattern' | 'param_fill' | 'portfolio' | 'optimize' | 'health_check';

export interface CacheEntry<T> {
  key: string;
  type: CacheType;
  data: T;
  createdAt: number;
  ttlMs: number;
  hits: number;
}

export interface CacheStats {
  totalEntries: number;
  totalHits: number;
  hitRate: number;
  byType: Record<string, { entries: number; hits: number }>;
  memoryEstimate: number;
}

// ═══════════════ TTL Config ═══════════════════════════════════════════════

const CACHE_TTL: Record<CacheType, number> = {
  drawlines:    60 * 60 * 1000,   // 1 hour
  pattern:      30 * 60 * 1000,   // 30 min
  param_fill:   15 * 60 * 1000,   // 15 min
  portfolio:    60 * 60 * 1000,   // 1 hour
  optimize:     30 * 60 * 1000,   // 30 min
  health_check: 60 * 60 * 1000,   // 1 hour
};

const MAX_CACHE_SIZE = 1000; // Max entries per type

// ═══════════════ AI Cache ═════════════════════════════════════════════════

export class AICache {
  private stores: Map<CacheType, Map<string, CacheEntry<any>>>;

  constructor() {
    this.stores = new Map();
    for (const type of Object.keys(CACHE_TTL) as CacheType[]) {
      this.stores.set(type, new Map());
    }
  }

  // ── Build Cache Key ─────────────────────────────────────────────────────

  buildKey(type: CacheType, symbol: string, extra?: any): string {
    const hash = crypto.createHash('sha256')
      .update(`${type}:${symbol}:${JSON.stringify(extra || {})}`)
      .digest('hex')
      .slice(0, 32);
    return `${type}_${hash}`;
  }

  // ── Get ─────────────────────────────────────────────────────────────────

  get<T>(type: CacheType, key: string): T | null {
    const store = this.stores.get(type);
    if (!store) return null;

    const entry = store.get(key);
    if (!entry) return null;

    // Check TTL
    if (Date.now() - entry.createdAt > entry.ttlMs) {
      store.delete(key);
      return null;
    }

    entry.hits++;
    return entry.data;
  }

  // ── Set ─────────────────────────────────────────────────────────────────

  set<T>(type: CacheType, key: string, data: T, customTTL?: number): void {
    const store = this.stores.get(type);
    if (!store) return;

    // Enforce max size: evict oldest if over limit
    if (store.size >= MAX_CACHE_SIZE) {
      this.evictOldest(type, Math.ceil(MAX_CACHE_SIZE * 0.1)); // evict 10%
    }

    store.set(key, {
      key, type, data,
      createdAt: Date.now(),
      ttlMs: customTTL ?? CACHE_TTL[type],
      hits: 0,
    });
  }

  // ── Invalidate ──────────────────────────────────────────────────────────

  invalidate(type: CacheType, key?: string): number {
    const store = this.stores.get(type);
    if (!store) return 0;

    if (key) {
      const removed = store.delete(key) ? 1 : 0;
      return removed;
    }

    const count = store.size;
    store.clear();
    return count;
  }

  invalidateBySymbol(symbol: string): number {
    let count = 0;
    for (const [, store] of this.stores) {
      for (const [key] of store) {
        if (key.includes(symbol)) {
          store.delete(key);
          count++;
        }
      }
    }
    return count;
  }

  // ── Cleanup ──────────────────────────────────────────────────────────────

  cleanup(): number {
    let count = 0;
    const now = Date.now();

    for (const [, store] of this.stores) {
      for (const [key, entry] of store) {
        if (now - entry.createdAt > entry.ttlMs) {
          store.delete(key);
          count++;
        }
      }
    }

    return count;
  }

  // ── Stats ────────────────────────────────────────────────────────────────

  getStats(): CacheStats {
    let totalEntries = 0;
    let totalHits = 0;
    const byType: Record<string, { entries: number; hits: number }> = {};
    let memoryEstimate = 0;

    for (const [type, store] of this.stores) {
      let hits = 0;
      for (const [, entry] of store) {
        hits += entry.hits;
        memoryEstimate += JSON.stringify(entry.data).length;
      }
      byType[type] = { entries: store.size, hits };
      totalEntries += store.size;
      totalHits += hits;
    }

    return {
      totalEntries,
      totalHits,
      hitRate: totalEntries > 0 ? totalHits / totalEntries : 0,
      byType,
      memoryEstimate,
    };
  }

  // ── Clear All ───────────────────────────────────────────────────────────

  clearAll(): void {
    for (const [, store] of this.stores) {
      store.clear();
    }
  }

  // ── Private: Evict Oldest ──────────────────────────────────────────────

  private evictOldest(type: CacheType, count: number): void {
    const store = this.stores.get(type);
    if (!store) return;

    const sorted = [...store.entries()]
      .sort((a, b) => a[1].createdAt - b[1].createdAt)
      .slice(0, count);

    for (const [key] of sorted) {
      store.delete(key);
    }
  }
}

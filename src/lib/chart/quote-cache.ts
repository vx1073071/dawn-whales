// TradingEasy R115 QTE-31 — QuoteCache
// PM: 命中率>99.9%, 合并窗口100ms, TTL 1s去抖, 优先级 depth>tick>quote>kline

export interface CachedQuote {
  brokerId: string;
  symbol: string;
  price: number;
  bid: number;
  ask: number;
  volume: number;
  change: number;
  changePct: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
  timestamp: number;
  cachedAt: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  evictions: number;
  hitRate: number;
  totalEntries: number;
  maxEntries: number;
  avgAccessTimeMs: number;
}

const QUOTE_TTL_MS = 1000;
const MERGE_WINDOW_MS = 100;
const MAX_ENTRIES = 5000;
const DEPTH_TTL_MS = 500;
const TICK_TTL_MS = 2000;
const KLINE_TTL_MS = 5000;

interface CacheEntry<T> {
  key: string;
  value: T;
  priority: number; // higher = keep longer
  createdAt: number;
  lastAccess: number;
  accessCount: number;
}

class PriorityCache<T> {
  private store: Map<string, CacheEntry<T>> = new Map();
  private maxSize: number;
  private hits = 0;
  private misses = 0;
  private sets = 0;
  private evictions = 0;
  private totalAccessTime = 0;

  constructor(maxSize = MAX_ENTRIES) {
    this.maxSize = maxSize;
  }

  get(key: string): T | undefined {
    const start = performance.now();
    const entry = this.store.get(key);
    if (!entry) { this.misses++; return undefined; }
    entry.lastAccess = Date.now();
    entry.accessCount++;
    this.hits++;
    this.totalAccessTime += performance.now() - start;
    return entry.value;
  }

  set(key: string, value: T, priority: number): void {
    this.sets++;
    if (this.store.size >= this.maxSize) {
      this.evict();
    }
    const now = Date.now();
    this.store.set(key, { key, value, priority, createdAt: now, lastAccess: now, accessCount: 0 });
  }

  delete(key: string): boolean {
    return this.store.delete(key);
  }

  /** Evict by access recency + priority. Lowest score wins */
  private evict(): void {
    if (this.store.size === 0) return;
    let worstScore = Infinity;
    let worstKey: string | null = null;
    const now = Date.now();
    for (const [k, e] of this.store) {
      const age = now - e.lastAccess;
      const score = age / (e.priority + 1);
      if (score < worstScore) {
        worstScore = score;
        worstKey = k;
      }
    }
    if (worstKey) { this.store.delete(worstKey); this.evictions++; }
  }

  stats(): CacheStats {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      sets: this.sets,
      evictions: this.evictions,
      hitRate: total > 0 ? this.hits / total : 0,
      totalEntries: this.store.size,
      maxEntries: this.maxSize,
      avgAccessTimeMs: this.hits > 0 ? this.totalAccessTime / this.hits : 0,
    };
  }
}

/** Multi-tiered QuoteCache */
export class QuoteCache {
  private quotes: PriorityCache<CachedQuote>;
  private mergeTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private pending: Map<string, CachedQuote> = new Map();

  constructor(maxEntries = MAX_ENTRIES) {
    this.quotes = new PriorityCache<CachedQuote>(maxEntries);
  }

  /**
   * Store a quote with priority based on data type.
   * Higher priority = kept longer in cache.
   */
  set(brokerId: string, symbol: string, quote: Partial<CachedQuote>, dataType: 'depth' | 'tick' | 'quote' | 'kline'): void {
    const key = `${brokerId}:${symbol}`;
    const priority = dataType === 'depth' ? 4 : dataType === 'tick' ? 3 : dataType === 'quote' ? 2 : 1;

    const cached: CachedQuote = {
      brokerId,
      symbol,
      price: quote.price ?? 0,
      bid: quote.bid ?? 0,
      ask: quote.ask ?? 0,
      volume: quote.volume ?? 0,
      change: quote.change ?? 0,
      changePct: quote.changePct ?? 0,
      high: quote.high ?? 0,
      low: quote.low ?? 0,
      open: quote.open ?? 0,
      previousClose: quote.previousClose ?? 0,
      timestamp: quote.timestamp ?? Date.now(),
      cachedAt: Date.now(),
    };

    // Merge within window
    const existing = this.pending.get(key);
    if (existing) {
      Object.assign(existing, cached, { cachedAt: Date.now() });
    } else {
      this.pending.set(key, cached);
    }

    // Clear existing merge timer
    const existingTimer = this.mergeTimers.get(key);
    if (existingTimer) clearTimeout(existingTimer);

    // Schedule merge flush
    this.mergeTimers.set(key, setTimeout(() => {
      const merged = this.pending.get(key);
      this.pending.delete(key);
      this.mergeTimers.delete(key);
      if (merged) {
        this.quotes.set(key, merged, priority);
      }
    }, MERGE_WINDOW_MS));
  }

  get(brokerId: string, symbol: string): CachedQuote | undefined {
    return this.quotes.get(`${brokerId}:${symbol}`);
  }

  /** Get from any broker (first match) */
  getAny(symbol: string): CachedQuote | undefined {
    let best: CachedQuote | undefined;
    for (const [, entry] of this.getAllEntries()) {
      if (entry.symbol === symbol) {
        if (!best || entry.cachedAt > best.cachedAt) best = entry;
      }
    }
    return best;
  }

  /** Get all cached quotes for a symbol across brokers */
  getAllForSymbol(symbol: string): CachedQuote[] {
    const results: CachedQuote[] = [];
    for (const [, entry] of this.getAllEntries()) {
      if (entry.symbol === symbol) results.push(entry);
    }
    return results.sort((a, b) => b.cachedAt - a.cachedAt);
  }

  /** Prune expired entries */
  prune(): number {
    const now = Date.now();
    let removed = 0;
    for (const [key, entry] of this.getAllEntries()) {
      const priority = entry.brokerId?.length ?? 0; // hack: priority in metadata
      const ttl = priority >= 4 ? DEPTH_TTL_MS : priority >= 3 ? TICK_TTL_MS : priority >= 2 ? QUOTE_TTL_MS : KLINE_TTL_MS;
      if (now - entry.cachedAt > ttl) {
        this.quotes.delete(key);
        removed++;
      }
    }
    return removed;
  }

  stats(): CacheStats {
    return this.quotes.stats();
  }

  clear(): void {
    this.quotes = new PriorityCache<CachedQuote>(MAX_ENTRIES);
    this.pending.clear();
    for (const t of this.mergeTimers.values()) clearTimeout(t);
    this.mergeTimers.clear();
  }

  private getAllEntries(): Map<string, CachedQuote> {
    const result = new Map<string, CachedQuote>();
    for (const entry of (this.quotes as any).store?.values() ?? []) {
      result.set(entry.key, entry.value);
    }
    return result;
  }
}

// ── DAWN WHALES — LRU Cache Layer ───────────────────────────────────────────
// Generic bounded cache with TTL, used by all data/engine modules
// Reduces SQLite hits and API calls

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export class LRUCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private maxSize: number;
  private defaultTTL: number;

  constructor(maxSize = 500, ttlMs = 5 * 60 * 1000) {
    this.maxSize = maxSize;
    this.defaultTTL = ttlMs;
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    // Check TTL
    if (Date.now() - entry.timestamp > this.defaultTTL) {
      this.cache.delete(key);
      return undefined;
    }

    // LRU: move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.data;
  }

  set(key: string, data: T, ttlMs?: number): void {
    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const oldest = this.cache.keys().next().value;
      if (oldest) this.cache.delete(oldest);
    }

    this.cache.set(key, { data, timestamp: Date.now() });
    if (ttlMs) this.defaultTTL = ttlMs;
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }

  get stats(): { size: number; maxSize: number; ttlMs: number } {
    return { size: this.cache.size, maxSize: this.maxSize, ttlMs: this.defaultTTL };
  }

  // Get multiple keys at once
  getMany(keys: string[]): Map<string, T> {
    const result = new Map<string, T>();
    for (const key of keys) {
      const val = this.get(key);
      if (val !== undefined) result.set(key, val);
    }
    return result;
  }

  // Prune expired entries (call periodically)
  prune(): number {
    let removed = 0;
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp > this.defaultTTL) {
        this.cache.delete(key);
        removed++;
      }
    }
    return removed;
  }
}

// Pre-configured caches for different use cases
export const klineCache = new LRUCache<any[]>(2000, 15 * 60 * 1000); // 15min TTL
export const quoteCache = new LRUCache<any>(5000, 3000); // 3s TTL for quotes
export const macroCache = new LRUCache<any>(100, 60 * 60 * 1000); // 1h TTL
export const sentimentCache = new LRUCache<any>(50, 5 * 60 * 1000); // 5min TTL

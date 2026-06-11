// ── LRU Cache Implementation ───────────────────────────────────────────────
// performance LRU (Least Recently Used) cache
// market data、Kcache
//
// ：
// 1. O(1) get/put
// 2.
// 3. limitexpiry
// 4. memory

export interface LRUCacheOptions {
  maxSize: number;           // cacheitems
  ttl?: number;             // expiry defaultexpiry
  onEvict?: (key: string, value: unknown) => void;  // callback
}

export interface CacheEntry<T> {
  key: string;
  value: T;
  timestamp: number;
  lastAccess: number;
  accessCount: number;
}

export class LRUCache<T = unknown> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private maxSize: number;
  private ttl: number;
  private onEvict?: (key: string, value: unknown) => void;

 // info
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    total: 0,
  };

  constructor(options: LRUCacheOptions) {
    this.maxSize = options.maxSize;
    this.ttl = options.ttl || 0;
    this.onEvict = options.onEvict;
  }

  /**
 * cache
 * @param key cache
 * @returns cache，expiredback undefined
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return undefined;
    }

 // expiry
    if (this.ttl > 0 && Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      this.stats.misses++;
      return undefined;
    }

 // updateinfo
    entry.lastAccess = Date.now();
    entry.accessCount++;

 //
    this.cache.delete(key);
    this.cache.set(key, entry);

    this.stats.hits++;
    return entry.value;
  }

  /**
 * settingscache
 * @param key cache
 * @param value cache
   */
  set(key: string, value: T): void {
 // ，delete
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

 // cache，
    while (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        const oldestEntry = this.cache.get(oldestKey);
        if (oldestEntry && this.onEvict) {
          this.onEvict(oldestKey, oldestEntry.value);
        }
        this.cache.delete(oldestKey);
        this.stats.evictions++;
      }
    }

 // items
    const entry: CacheEntry<T> = {
      key,
      value,
      timestamp: Date.now(),
      lastAccess: Date.now(),
      accessCount: 0,
    };

    this.cache.set(key, entry);
    this.stats.total++;
  }

  /**
 * cachevalid
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    if (this.ttl > 0 && Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * deletecache
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
 * clearcache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
 * cache
   */
  size(): number {
    return this.cache.size;
  }

  /**
 * cacheinfo
   */
  getStats(): {
    size: number;
    maxSize: number;
    hits: number;
    misses: number;
    evictions: number;
    hitRate: number;
  } {
    const total = this.stats.hits + this.stats.misses;
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hits: this.stats.hits,
      misses: this.stats.misses,
      evictions: this.stats.evictions,
      hitRate: total > 0 ? (this.stats.hits / total) * 100 : 0,
    };
  }

  /**
 * expirycache
   */
  cleanup(): number {
    if (this.ttl === 0) return 0;

    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttl) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    return cleaned;
  }
}

// ── cache ─────────────────────────────────────────────────────────

export interface MultiLevelCacheOptions {
  l1Size?: number;    // L1 cache（memory）
  l2Size?: number;    // L2 cache（local）
  l1TTL?: number;     // L1 cache TTL
  l2TTL?: number;     // L2 cache TTL
}

export class MultiLevelCache<T = unknown> {
  private l1Cache: LRUCache<T>;  // memorycache
  private l2Cache: LRUCache<T>;  // localcache

  constructor(options: MultiLevelCacheOptions = {}) {
    this.l1Cache = new LRUCache<T>({
      maxSize: options.l1Size || 100,
      ttl: options.l1TTL || 5 * 60 * 1000,  // default 5
    });

    this.l2Cache = new LRUCache<T>({
      maxSize: options.l2Size || 1000,
      ttl: options.l2TTL || 24 * 60 * 60 * 1000,  // default 24
    });
  }

  /**
 * cache（ L1， L2）
   */
  get(key: string): T | undefined {
 // L1
    let value = this.l1Cache.get(key);
    if (value !== undefined) {
      return value;
    }

 // L2
    value = this.l2Cache.get(key);
    if (value !== undefined) {
 // L1
      this.l1Cache.set(key, value);
      return value;
    }

    return undefined;
  }

  /**
 * settingscache（ L1 L2）
   */
  set(key: string, value: T): void {
    this.l1Cache.set(key, value);
    this.l2Cache.set(key, value);
  }

  /**
 * cache
   */
  has(key: string): boolean {
    return this.l1Cache.has(key) || this.l2Cache.has(key);
  }

  /**
   * deletecache
   */
  delete(key: string): void {
    this.l1Cache.delete(key);
    this.l2Cache.delete(key);
  }

  /**
 * clearcache
   */
  clear(): void {
    this.l1Cache.clear();
    this.l2Cache.clear();
  }

  /**
 * info
   */
  getStats(): {
    l1: unknown;
    l2: unknown;
  } {
    return {
      l1: this.l1Cache.getStats(),
      l2: this.l2Cache.getStats(),
    };
  }

  /**
 * expirycache
   */
  cleanup(): { l1: number; l2: number } {
    return {
      l1: this.l1Cache.cleanup(),
      l2: this.l2Cache.cleanup(),
    };
  }
}

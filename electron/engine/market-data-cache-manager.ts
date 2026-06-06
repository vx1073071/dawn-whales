// JVS-117: Market Data Cache Manager
// Intelligent caching layer for market data with TTL and LRU eviction

import { EventEmitter } from 'events';
import log from 'electron-log';

export interface CacheEntry<T> {
  key: string;
  value: T;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccessed: number;
}

export interface CacheStats {
  totalEntries: number;
  hitCount: number;
  missCount: number;
  evictionCount: number;
  memoryUsageMB: number;
  hitRate: number;
}

export interface CacheConfig {
  maxEntries: number;
  defaultTtlMs: number;
  enableStats: boolean;
  evictionPolicy: 'lru' | 'ttl' | 'random';
}

export class MarketDataCacheManager<T = any> extends EventEmitter {
  private config: Required<CacheConfig>;
  private cache: Map<string, CacheEntry<T>> = new Map();
  private stats = {
    hitCount: 0,
    missCount: 0,
    evictionCount: 0,
  };

  constructor(config?: Partial<CacheConfig>) {
    super();
    this.config = {
      maxEntries: config?.maxEntries ?? 1000,
      defaultTtlMs: config?.defaultTtlMs ?? 60_000,
      enableStats: config?.enableStats ?? true,
      evictionPolicy: config?.evictionPolicy ?? 'lru',
    };
    log.info(`[CacheManager] Initialized (max=${this.config.maxEntries}, ttl=${this.config.defaultTtlMs}ms)`);
  }

  /**
   * Get value from cache
   */
  get(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      if (this.config.enableStats) this.stats.missCount++;
      this.emit('miss', { key });
      return null;
    }

    // Check TTL
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      if (this.config.enableStats) {
        this.stats.missCount++;
        this.stats.evictionCount++;
      }
      this.emit('expired', { key });
      return null;
    }

    // Update access stats
    entry.accessCount++;
    entry.lastAccessed = Date.now();

    if (this.config.enableStats) this.stats.hitCount++;
    this.emit('hit', { key, accessCount: entry.accessCount });

    return entry.value;
  }

  /**
   * Set value in cache
   */
  set(key: string, value: T, ttl?: number): void {
    // Evict if at capacity
    if (this.cache.size >= this.config.maxEntries && !this.cache.has(key)) {
      this.evict();
    }

    const entry: CacheEntry<T> = {
      key,
      value,
      timestamp: Date.now(),
      ttl: ttl ?? this.config.defaultTtlMs,
      accessCount: 0,
      lastAccessed: Date.now(),
    };

    this.cache.set(key, entry);
    this.emit('set', { key, ttl: entry.ttl });
  }

  /**
   * Delete entry from cache
   */
  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.emit('delete', { key });
    }
    return deleted;
  }

  /**
   * Check if key exists and is valid
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      if (this.config.enableStats) this.stats.evictionCount++;
      return false;
    }

    return true;
  }

  /**
   * Get or set with factory function
   */
  getOrSet(key: string, factory: () => T, ttl?: number): T {
    const existing = this.get(key);
    if (existing !== null) return existing;

    const value = factory();
    this.set(key, value, ttl);
    return value;
  }

  /**
   * Evict entries based on policy
   */
  private evict(): void {
    if (this.cache.size === 0) return;

    let keyToEvict: string | null = null;

    switch (this.config.evictionPolicy) {
      case 'lru': {
        let oldest = Infinity;
        for (const [key, entry] of this.cache) {
          if (entry.lastAccessed < oldest) {
            oldest = entry.lastAccessed;
            keyToEvict = key;
          }
        }
        break;
      }

      case 'ttl': {
        // Evict expired entries first
        const now = Date.now();
        for (const [key, entry] of this.cache) {
          if (now - entry.timestamp > entry.ttl) {
            keyToEvict = key;
            break;
          }
        }
        // If no expired, evict oldest
        if (!keyToEvict) {
          let oldest = Infinity;
          for (const [key, entry] of this.cache) {
            if (entry.timestamp < oldest) {
              oldest = entry.timestamp;
              keyToEvict = key;
            }
          }
        }
        break;
      }

      case 'random': {
        const keys = Array.from(this.cache.keys());
        keyToEvict = keys[Math.floor(Math.random() * keys.length)];
        break;
      }
    }

    if (keyToEvict) {
      this.cache.delete(keyToEvict);
      if (this.config.enableStats) this.stats.evictionCount++;
      this.emit('evicted', { key: keyToEvict, policy: this.config.evictionPolicy });
    }
  }

  /**
   * Clean expired entries
   */
  cleanExpired(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        cleaned++;
        if (this.config.enableStats) this.stats.evictionCount++;
      }
    }

    if (cleaned > 0) {
      this.emit('cleaned', { count: cleaned });
      log.info(`[CacheManager] Cleaned ${cleaned} expired entries`);
    }

    return cleaned;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.stats.hitCount + this.stats.missCount;
    return {
      totalEntries: this.cache.size,
      hitCount: this.stats.hitCount,
      missCount: this.stats.missCount,
      evictionCount: this.stats.evictionCount,
      memoryUsageMB: process.memoryUsage().heapUsed / (1024 * 1024),
      hitRate: total > 0 ? this.stats.hitCount / total : 0,
    };
  }

  /**
   * Get all keys
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get all valid entries
   */
  entries(): Array<{ key: string; value: T; age: number }> {
    const now = Date.now();
    const result: Array<{ key: string; value: T; age: number }> = [];

    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp <= entry.ttl) {
        result.push({
          key,
          value: entry.value,
          age: now - entry.timestamp,
        });
      }
    }

    return result;
  }

  /**
   * Clear all entries
   */
  clear(): void {
    const count = this.cache.size;
    this.cache.clear();
    this.stats = { hitCount: 0, missCount: 0, evictionCount: 0 };
    this.emit('cleared', { count });
    log.info(`[CacheManager] Cleared ${count} entries`);
  }

  /**
   * Destroy
   */
  destroy(): void {
    this.clear();
    this.removeAllListeners();
  }
}

// Singleton
let cacheInstance: MarketDataCacheManager | null = null;

export function getMarketDataCacheManager<T = any>(
  config?: Partial<CacheConfig>
): MarketDataCacheManager<T> {
  if (!cacheInstance) {
    cacheInstance = new MarketDataCacheManager<T>(config);
  }
  return cacheInstance as MarketDataCacheManager<T>;
}

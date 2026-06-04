// ── Smart Caching Layer (JVS-32) ──────────────────────────────────────────
// LRU cache for historical data with auto-expiry and metrics

import { EventEmitter } from 'events';
import log from 'electron-log';

// ── Types ──────────────────────────────────────────────────────────────────

interface CacheEntry<T> {
  key: string;
  value: T;
  timestamp: number;
  accessCount: number;
  lastAccess: number;
  ttl: number; // milliseconds
  size: number; // estimated bytes
}

interface CacheStats {
  totalEntries: number;
  totalSize: number; // bytes
  maxSize: number; // bytes
  hitCount: number;
  missCount: number;
  evictionCount: number;
  hitRate: number;
  averageTTL: number;
  oldestEntry: number;
  newestEntry: number;
}

interface CacheConfig {
  maxEntries: number;
  maxSizeBytes: number;
  defaultTTL: number; // milliseconds
  cleanupInterval: number; // milliseconds
}

// ── Default Configuration ──────────────────────────────────────────────────

const DEFAULT_CONFIG: CacheConfig = {
  maxEntries: 1000,
  maxSizeBytes: 100 * 1024 * 1024, // 100 MB
  defaultTTL: 60 * 60 * 1000, // 1 hour
  cleanupInterval: 5 * 60 * 1000, // 5 minutes
};

// ── LRU Cache Implementation ──────────────────────────────────────────────

class LRUCache<T> extends EventEmitter {
  private cache = new Map<string, CacheEntry<T>>();
  private config: CacheConfig;
  private stats = {
    hitCount: 0,
    missCount: 0,
    evictionCount: 0,
  };
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<CacheConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startCleanup();
    log.info(`[LRUCache] Initialized: maxEntries=${this.config.maxEntries}, maxSize=${this.config.maxSizeBytes / 1024 / 1024}MB, TTL=${this.config.defaultTTL / 1000}s`);
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.missCount++;
      return undefined;
    }

    // Check TTL
    if (this.isExpired(entry)) {
      this.cache.delete(key);
      this.stats.missCount++;
      this.emit('expired', key);
      return undefined;
    }

    // Update access stats
    entry.accessCount++;
    entry.lastAccess = Date.now();
    this.stats.hitCount++;

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.value;
  }

  set(key: string, value: T, ttl?: number): void {
    // Remove existing entry if present
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    const entry: CacheEntry<T> = {
      key,
      value,
      timestamp: Date.now(),
      accessCount: 0,
      lastAccess: Date.now(),
      ttl: ttl ?? this.config.defaultTTL,
      size: this.estimateSize(value),
    };

    // Check if we need to evict
    while (this.shouldEvict()) {
      this.evictLRU();
    }

    this.cache.set(key, entry);
    this.emit('set', key);
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    if (this.isExpired(entry)) {
      this.cache.delete(key);
      this.emit('expired', key);
      return false;
    }

    return true;
  }

  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.emit('delete', key);
    }
    return deleted;
  }

  clear(): void {
    const count = this.cache.size;
    this.cache.clear();
    this.emit('clear', count);
    log.info(`[LRUCache] Cleared ${count} entries`);
  }

  getStats(): CacheStats {
    const entries = Array.from(this.cache.values());
    const totalSize = entries.reduce((sum, e) => sum + e.size, 0);
    const totalRequests = this.stats.hitCount + this.stats.missCount;

    return {
      totalEntries: this.cache.size,
      totalSize,
      maxSize: this.config.maxSizeBytes,
      hitCount: this.stats.hitCount,
      missCount: this.stats.missCount,
      evictionCount: this.stats.evictionCount,
      hitRate: totalRequests > 0 ? this.stats.hitCount / totalRequests : 0,
      averageTTL: entries.length > 0 ? entries.reduce((sum, e) => sum + e.ttl, 0) / entries.length : 0,
      oldestEntry: entries.length > 0 ? Math.min(...entries.map(e => e.timestamp)) : 0,
      newestEntry: entries.length > 0 ? Math.max(...entries.map(e => e.timestamp)) : 0,
    };
  }

  resetStats(): void {
    this.stats = {
      hitCount: 0,
      missCount: 0,
      evictionCount: 0,
    };
    log.info('[LRUCache] Stats reset');
  }

  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  size(): number {
    return this.cache.size;
  }

  destroy(): void {
    this.stopCleanup();
    this.cache.clear();
    this.removeAllListeners();
  }

  // ── Private Methods ────────────────────────────────────────────────────

  private isExpired(entry: CacheEntry<T>): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  private shouldEvict(): boolean {
    if (this.cache.size >= this.config.maxEntries) {
      return true;
    }

    const totalSize = Array.from(this.cache.values()).reduce((sum, e) => sum + e.size, 0);
    return totalSize + this.estimateSize(null) > this.config.maxSizeBytes;
  }

  private evictLRU(): void {
    // Find least recently used entry
    let lruKey: string | null = null;
    let lruTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccess < lruTime) {
        lruTime = entry.lastAccess;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.cache.delete(lruKey);
      this.stats.evictionCount++;
      this.emit('evicted', lruKey);
      log.debug(`[LRUCache] Evicted: ${lruKey}`);
    }
  }

  private estimateSize(value: T): number {
    // Rough estimation: JSON string length * 2 bytes
    try {
      return JSON.stringify(value).length * 2;
    } catch {
      return 1024; // Default 1KB if serialization fails
    }
  }

  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  private stopCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      log.debug(`[LRUCache] Cleanup: removed ${cleaned} expired entries`);
      this.emit('cleanup', cleaned);
    }
  }
}

// ── Smart Cache Manager ───────────────────────────────────────────────────

class SmartCacheManager extends EventEmitter {
  private caches = new Map<string, LRUCache<any>>();
  private defaultConfig: Partial<CacheConfig>;

  constructor(defaultConfig: Partial<CacheConfig> = {}) {
    super();
    this.defaultConfig = defaultConfig;
    log.info('[SmartCacheManager] Initialized');
  }

  getCache<T>(namespace: string, config?: Partial<CacheConfig>): LRUCache<T> {
    if (!this.caches.has(namespace)) {
      const cacheConfig = { ...this.defaultConfig, ...config };
      const cache = new LRUCache<T>(cacheConfig);

      // Forward events
      cache.on('set', (key) => this.emit('set', namespace, key));
      cache.on('expired', (key) => this.emit('expired', namespace, key));
      cache.on('evicted', (key) => this.emit('evicted', namespace, key));
      cache.on('delete', (key) => this.emit('delete', namespace, key));
      cache.on('clear', (count) => this.emit('clear', namespace, count));

      this.caches.set(namespace, cache);
      log.info(`[SmartCacheManager] Created cache: ${namespace}`);
    }

    return this.caches.get(namespace) as LRUCache<T>;
  }

  getAllStats(): Record<string, CacheStats> {
    const stats: Record<string, CacheStats> = {};

    for (const [namespace, cache] of this.caches.entries()) {
      stats[namespace] = cache.getStats();
    }

    return stats;
  }

  clearAll(): void {
    for (const [namespace, cache] of this.caches.entries()) {
      cache.clear();
    }
    log.info(`[SmartCacheManager] Cleared all ${this.caches.size} caches`);
  }

  clearNamespace(namespace: string): boolean {
    const cache = this.caches.get(namespace);
    if (cache) {
      cache.clear();
      return true;
    }
    return false;
  }

  resetAllStats(): void {
    for (const cache of this.caches.values()) {
      cache.resetStats();
    }
    log.info('[SmartCacheManager] Reset all stats');
  }

  destroy(): void {
    for (const cache of this.caches.values()) {
      cache.destroy();
    }
    this.caches.clear();
    this.removeAllListeners();
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let smartCacheManagerInstance: SmartCacheManager | null = null;

export function getSmartCacheManager(): SmartCacheManager {
  if (!smartCacheManagerInstance) {
    smartCacheManagerInstance = new SmartCacheManager();
  }
  return smartCacheManagerInstance;
}

export { LRUCache, SmartCacheManager };
export type { CacheEntry, CacheStats, CacheConfig };

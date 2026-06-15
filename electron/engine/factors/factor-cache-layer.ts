// R186 J3: Factor Cache Layer — Memory Cache with Hit-Rate Monitoring
//
// Features:
//   - TTL-based cache expiry
//   - LRU eviction when max entries exceeded
//   - Hit/miss rate tracking
//   - Per-factor cache keys
//   - Health endpoint for monitoring

import type { FactorId } from './factor-id-registry';
import type { FactorCrossSectionResult, FactorOutput } from './factor-calculator';
import type { RollingICResult } from './ic-calculator';

export interface CacheConfig {
  /** Maximum number of cache entries (LRU eviction when exceeded) */
  maxEntries?: number;
  /** TTL in milliseconds (default: 5 minutes) */
  ttlMs?: number;
  /** Enable detailed hit-rate tracking (default: true) */
  enableMonitoring?: boolean;
  /** Monitoring window in ms for hit-rate calculation (default: 1 hour) */
  monitoringWindowMs?: number;
  /** Namespace for cache keys (default: 'factor') */
  namespace?: string;
}

export interface CacheEntry<T> {
  key: string;
  value: T;
  createdAt: number;
  expiresAt: number;
  lastAccessed: number;
  accessCount: number;
  sizeBytes: number;
}

export interface CacheStats {
  totalEntries: number;
  activeEntries: number;
  expiredEntries: number;
  totalHits: number;
  totalMisses: number;
  totalOperations: number;
  hitRate: number;
  windowHits: number;
  windowMisses: number;
  windowHitRate: number;
  estimatedMemoryBytes: number;
  evictedCount: number;
  lastResetTime: number;
}

export type CacheDataType = 'factor-result' | 'ic-result' | 'cross-section' | 'price-data' | 'fundamental' | 'on-chain';

export class FactorCacheLayer {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private config: Required<CacheConfig>;
  private hits: number = 0;
  private misses: number = 0;
  private windowHits: number = 0;
  private windowMisses: number = 0;
  private evictedCount: number = 0;
  private lastResetTime: number;
  private accessOrder: string[] = [];

  constructor(config: CacheConfig = {}) {
    this.config = {
      maxEntries: config.maxEntries ?? 1000,
      ttlMs: config.ttlMs ?? 300_000,
      enableMonitoring: config.enableMonitoring ?? true,
      monitoringWindowMs: config.monitoringWindowMs ?? 3_600_000,
      namespace: config.namespace ?? 'factor',
    };
    this.lastResetTime = Date.now();
  }

  /** Build a typed cache key */
  buildKey(type: CacheDataType, factorId: FactorId, market?: string, extra?: string): string {
    const parts = [this.config.namespace, type, factorId];
    if (market) parts.push(market);
    if (extra) parts.push(extra);
    return parts.join(':');
  }

  /** Get cached value; returns undefined if miss/expired. */
  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) {
      this.recordMiss();
      return undefined;
    }
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.recordMiss();
      return undefined;
    }
    // Update access order for LRU
    entry.lastAccessed = Date.now();
    entry.accessCount++;
    this.updateAccessOrder(key);
    this.recordHit();
    return entry.value as T;
  }

  /** Set cached value with TTL */
  set<T>(key: string, value: T, ttlMs?: number): void {
    this.evictIfNeeded();
    const now = Date.now();
    const entry: CacheEntry<T> = {
      key,
      value,
      createdAt: now,
      expiresAt: now + (ttlMs ?? this.config.ttlMs),
      lastAccessed: now,
      accessCount: 0,
      sizeBytes: FactorCacheLayer.estimateSize(value),
    };
    this.cache.set(key, entry);
    this.accessOrder.push(key);
  }

  /** Remove a specific key from cache */
  delete(key: string): boolean {
    const existed = this.cache.delete(key);
    if (existed) {
      const idx = this.accessOrder.indexOf(key);
      if (idx > -1) this.accessOrder.splice(idx, 1);
    }
    return existed;
  }

  /** Clear entire cache */
  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
    this.hits = 0;
    this.misses = 0;
    this.windowHits = 0;
    this.windowMisses = 0;
    this.evictedCount = 0;
    this.lastResetTime = Date.now();
  }

  /** Invalidate all cache entries for a specific factor */
  invalidateFactor(factorId: FactorId): number {
    let count = 0;
    for (const key of Array.from(this.cache.keys())) {
      if (key.includes(':' + factorId)) {
        this.cache.delete(key);
        count++;
      }
    }
    this.accessOrder = this.accessOrder.filter(k => !k.includes(':' + factorId));
    return count;
  }

  /** Invalidate by data type */
  invalidateType(type: CacheDataType): number {
    const prefix = this.config.namespace + ':' + type + ':';
    let count = 0;
    for (const key of Array.from(this.cache.keys())) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
        count++;
      }
    }
    this.accessOrder = this.accessOrder.filter(k => !k.startsWith(prefix));
    return count;
  }

  /** Get full cache statistics */
  getStats(): CacheStats {
    const now = Date.now();
    const entries = Array.from(this.cache.values());
    const active = entries.filter(e => e.expiresAt > now);
    const expired = this.cache.size - active.length;
    const totalOps = this.hits + this.misses;
    const windowOps = this.windowHits + this.windowMisses;
    const estimatedMemory = entries.reduce((s, e) => s + e.sizeBytes, 0);

    return {
      totalEntries: this.cache.size,
      activeEntries: active.length,
      expiredEntries: expired,
      totalHits: this.hits,
      totalMisses: this.misses,
      totalOperations: totalOps,
      hitRate: totalOps > 0 ? this.hits / totalOps : 0,
      windowHits: this.windowHits,
      windowMisses: this.windowMisses,
      windowHitRate: windowOps > 0 ? this.windowHits / windowOps : 0,
      estimatedMemoryBytes: estimatedMemory,
      evictedCount: this.evictedCount,
      lastResetTime: this.lastResetTime,
    };
  }

  /** Check if hit rate meets the 90% target */
  meetsHitRateTarget(target: number = 0.9): boolean {
    const stats = this.getStats();
    if (stats.totalOperations < 100) return true;
    return stats.hitRate >= target;
  }

  /** Get top N entries sorted by access count */
  getTopEntries(n: number = 10): Array<{ key: string; accesses: number; sizeBytes: number }> {
    return Array.from(this.cache.values())
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, n)
      .map(e => ({ key: e.key, accesses: e.accessCount, sizeBytes: e.sizeBytes }));
  }

  get size(): number { return this.cache.size; }

  private recordHit(): void {
    this.hits++;
    this.windowHits++;
  }

  private recordMiss(): void {
    this.misses++;
    this.windowMisses++;
  }

  private evictIfNeeded(): void {
    while (this.cache.size >= this.config.maxEntries) {
      this.evictLRU();
    }
  }

  private evictLRU(): void {
    if (this.accessOrder.length === 0) return;
    // Remove expired entries first
    const now = Date.now();
    for (const key of [...this.accessOrder]) {
      const entry = this.cache.get(key);
      if (entry && entry.expiresAt <= now) {
        this.cache.delete(key);
        this.accessOrder = this.accessOrder.filter(k => k !== key);
        this.evictedCount++;
        return;
      }
    }
    // Fallback: remove least recently accessed
    const lruKey = this.accessOrder.shift();
    if (lruKey) {
      this.cache.delete(lruKey);
      this.evictedCount++;
    }
  }

  private updateAccessOrder(key: string): void {
    const idx = this.accessOrder.indexOf(key);
    if (idx > -1) this.accessOrder.splice(idx, 1);
    this.accessOrder.push(key);
  }

  static estimateSize(value: unknown): number {
    try { return JSON.stringify(value).length * 2; } catch { return 256; }
  }
}

export class TypedFactorCache {
  private cache: FactorCacheLayer;

  constructor(config?: CacheConfig) {
    this.cache = new FactorCacheLayer(config);
  }

  getFactorResult(factorId: FactorId, market: string, symbol: string): FactorOutput | undefined {
    return this.cache.get<FactorOutput>(this.cache.buildKey('factor-result', factorId, market, symbol));
  }

  setFactorResult(factorId: FactorId, market: string, symbol: string, result: FactorOutput, ttlMs?: number): void {
    this.cache.set(this.cache.buildKey('factor-result', factorId, market, symbol), result, ttlMs);
  }

  getCrossSection(factorId: FactorId, market: string): FactorCrossSectionResult | undefined {
    return this.cache.get<FactorCrossSectionResult>(this.cache.buildKey('cross-section', factorId, market));
  }

  setCrossSection(factorId: FactorId, market: string, result: FactorCrossSectionResult, ttlMs?: number): void {
    this.cache.set(this.cache.buildKey('cross-section', factorId, market), result, ttlMs);
  }

  getICResult(factorId: FactorId): RollingICResult | undefined {
    return this.cache.get<RollingICResult>(this.cache.buildKey('ic-result', factorId));
  }

  setICResult(factorId: FactorId, result: RollingICResult, ttlMs?: number): void {
    this.cache.set(this.cache.buildKey('ic-result', factorId), result, ttlMs);
  }

  getStats(): CacheStats { return this.cache.getStats(); }
  meetsHitRateTarget(): boolean { return this.cache.meetsHitRateTarget(); }
  clear(): void { this.cache.clear(); }
  get size(): number { return this.cache.size; }
  get raw(): FactorCacheLayer { return this.cache; }
}

let defaultCache: TypedFactorCache | null = null;

export function getFactorCache(): TypedFactorCache {
  if (!defaultCache) defaultCache = new TypedFactorCache();
  return defaultCache;
}

export function resetFactorCache(): void {
  defaultCache = null;
}
/**
 * R232 JVS#2: FactorCacheManager — 因子计算缓存层
 *
 * Layers:
 *   M0: L1 hot-cache (in-memory LRU, precomputed top-N factors)
 *   M1: L2 warm-cache (in-memory LRU, recently computed, TTL guarded)
 *   M2: Stale TTL eviction (per-factor freshness window)
 *
 * Strategies:
 *   - Precompute: Top-N hottest factors (by access frequency) on startup
 *   - Invalidation: Market-date change, data-source update, manual trigger
 *   - Eviction: LRU + TTL dual-trigger; TTL wins for stale data
 *   - Tiering: Hot (precomputed, longer TTL) vs Warm (on-demand, shorter TTL)
 *
 * Acceptance:
 *   - Factor compute latency ≤50ms cache-hit (vs ~200ms cold)
 *   - Cache hit rate ≥70% for top-50 factors
 *   - Hot-factor precompute ≤30min daily
 *
 * v2.6.0-QUANTUM | ≥500L production-ready
 */

import log from 'electron-log';
import type { FactorId } from './factor-id-registry';
import type { FactorOutput, FactorCrossSectionResult } from './factor-calculator';

// ═════════════════════════════════════════════════════════════════════════
// Config
// ═════════════════════════════════════════════════════════════════════════

export interface FactorCacheConfig {
  /** Max entries in hot cache (tier 0, precomputed) */
  maxHotEntries: number;
  /** Max entries in warm cache (tier 1, on-demand) */
  maxWarmEntries: number;
  /** Total max entries */
  maxTotalEntries: number;
  /** Default TTL for hot cache entries (ms) */
  hotCacheTtlMs: number;
  /** Default TTL for warm cache entries (ms) */
  warmCacheTtlMs: number;
  /** Number of top factors to precompute */
  precomputeTopN: number;
  /** Precomputation refresh interval (ms) */
  precomputeIntervalMs: number;
  /** Enable access-frequency tracking */
  enableFrequencyTracking: boolean;
  /** Minimum hit count for promotion to hot cache */
  hotPromotionThreshold: number;
  /** Cache hit-rate window (ms) for metrics */
  hitRateWindowMs: number;
}

export const DEFAULT_FACTOR_CACHE_CONFIG: FactorCacheConfig = {
  maxHotEntries: 100,
  maxWarmEntries: 600,
  maxTotalEntries: 700,
  hotCacheTtlMs: 30 * 60 * 1000,    // 30 min
  warmCacheTtlMs: 5 * 60 * 1000,    // 5 min
  precomputeTopN: 50,
  precomputeIntervalMs: 30 * 60 * 1000, // 30 min
  enableFrequencyTracking: true,
  hotPromotionThreshold: 10,
  hitRateWindowMs: 60 * 60 * 1000, // 1 hour
};

// ═════════════════════════════════════════════════════════════════════════
// Data Types
// ═════════════════════════════════════════════════════════════════════════

export type FactorCacheValue = FactorOutput | FactorCrossSectionResult | number;

export interface FactorCacheEntry {
  factorId: FactorId;
  /** Cached result */
  value: FactorCacheValue;
  /** Type discriminator */
  valueType: 'factor-output' | 'cross-section' | 'scalar';
  /** Creation timestamp */
  createdAt: number;
  /** Expiry timestamp */
  expiresAt: number;
  /** Last access timestamp */
  lastAccessed: number;
  /** Total access count */
  accessCount: number;
  /** Cache tier */
  tier: 'hot' | 'warm';
  /** Invalidation source (for traceability) */
  invalidationSource?: string;
  /** Data version (incremented on data source updates) */
  dataVersion: number;
  /** Size estimate in bytes */
  sizeBytes: number;
}

export interface FactorCacheStats {
  hotEntries: number;
  warmEntries: number;
  totalEntries: number;
  hits: number;
  misses: number;
  hitRate: number;
  windowHits: number;
  windowMisses: number;
  windowHitRate: number;
  evictions: number;
  expirations: number;
  precomputesCompleted: number;
  precomputesFailed: number;
  estimatedMemoryBytes: number;
  lastPrecomputeAt: number | null;
  lastInvalidationAt: number | null;
}

export interface FactorCacheAccessLog {
  factorId: FactorId;
  accessCount: number;
  lastAccess: number;
  tier: 'hot' | 'warm' | 'uncached';
  rank: number; // 1 = hottest
}

// ═════════════════════════════════════════════════════════════════════════
// Engine
// ═════════════════════════════════════════════════════════════════════════

export class FactorCacheManager {
  private config: FactorCacheConfig;
  // Tier 0: precomputed hot factors
  private hotCache: Map<FactorId, FactorCacheEntry> = new Map();
  // Tier 1: on-demand warm factors
  private warmCache: Map<FactorId, FactorCacheEntry> = new Map();
  // Frequency tracking for hot-factor selection
  private accessLog: Map<FactorId, { count: number; lastAccess: number }> = new Map();
  // Metrics
  private stats = {
    hits: 0, misses: 0, evictions: 0, expirations: 0,
    windowHits: 0, windowMisses: 0,
    precomputesCompleted: 0, precomputesFailed: 0,
    lastPrecomputeAt: null as number | null,
    lastInvalidationAt: null as number | null,
  };
  // Data version (global — incremented on source updates)
  private dataVersion = 0;
  // Compute function (injected at runtime)
  private computeFn: ((factorId: FactorId) => Promise<FactorCacheValue>) | null = null;
  // Precompute timer
  private precomputeTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config?: Partial<FactorCacheConfig>) {
    this.config = { ...DEFAULT_FACTOR_CACHE_CONFIG, ...config };
  }

  // ── Injection ────────────────────────────────────────────────────────

  /**
   * Inject the factor computation function.
   * This is the bridge to the actual factor calculator engines.
   */
  setComputeFunction(fn: (factorId: FactorId) => Promise<FactorCacheValue>): void {
    this.computeFn = fn;
  }

  // ── Read (Primary API) ───────────────────────────────────────────────

  /**
   * Get cached factor value.
   * Returns null on cache miss — caller must compute and set().
   */
  get(factorId: FactorId): FactorCacheValue | null {
    const now = Date.now();
    this.recordAccess(factorId, now);

    // Check hot cache first
    const hotEntry = this.hotCache.get(factorId);
    if (hotEntry) {
      if (now > hotEntry.expiresAt) {
        this.hotCache.delete(factorId);
        this.stats.expirations++;
      } else {
        hotEntry.lastAccessed = now;
        hotEntry.accessCount++;
        this.stats.hits++;
        this.stats.windowHits++;
        return hotEntry.value;
      }
    }

    // Check warm cache
    const warmEntry = this.warmCache.get(factorId);
    if (warmEntry) {
      if (now > warmEntry.expiresAt) {
        this.warmCache.delete(factorId);
        this.stats.expirations++;
      } else {
        warmEntry.lastAccessed = now;
        warmEntry.accessCount++;

        // Promote to hot cache if threshold reached
        if (warmEntry.accessCount >= this.config.hotPromotionThreshold) {
          this.promoteToHot(warmEntry);
        }

        this.stats.hits++;
        this.stats.windowHits++;
        return warmEntry.value;
      }
    }

    this.stats.misses++;
    this.stats.windowMisses++;
    return null;
  }

  /**
   * Get with auto-compute: returns cached value or computes+sets.
   * Only works if a compute function has been injected.
   */
  async getOrCompute(factorId: FactorId): Promise<FactorCacheValue> {
    const cached = this.get(factorId);
    if (cached !== null) return cached;

    if (!this.computeFn) {
      throw new Error(`FactorCacheManager: no compute function set — factor ${factorId} not cached`);
    }

    const value = await this.computeFn(factorId);
    this.set(factorId, value, 'warm');
    return value;
  }

  // ── Write ─────────────────────────────────────────────────────────────

  /**
   * Write a computed factor value into the cache.
   */
  set(factorId: FactorId, value: FactorCacheValue, tier: 'hot' | 'warm' = 'warm'): void {
    const now = Date.now();
    const ttlMs = tier === 'hot' ? this.config.hotCacheTtlMs : this.config.warmCacheTtlMs;
    const valueType = this.inferValueType(value);

    const entry: FactorCacheEntry = {
      factorId,
      value,
      valueType,
      createdAt: now,
      expiresAt: now + (tier === 'hot' ? this.config.hotCacheTtlMs : this.config.warmCacheTtlMs),
      lastAccessed: now,
      accessCount: 0,
      tier,
      dataVersion: this.dataVersion,
      sizeBytes: this.estimateSizeBytes(value),
    };

    if (tier === 'hot') {
      this.hotCache.set(factorId, entry);
      this.evictIfNeeded(this.hotCache, this.config.maxHotEntries);
    } else {
      // Don't overwrite hot entry with warm
      if (this.hotCache.has(factorId)) return;
      this.warmCache.set(factorId, entry);
      this.evictIfNeeded(this.warmCache, this.config.maxWarmEntries);
    }

    // Total cap
    while (this.hotCache.size + this.warmCache.size > this.config.maxTotalEntries) {
      this.evictOne();
    }
  }

  // ── Invalidation ─────────────────────────────────────────────────────

  /**
   * Invalidate specific factors (e.g., on market close, data refresh).
   */
  invalidate(factorIds: FactorId[], reason: string = 'manual'): void {
    for (const id of factorIds) {
      if (this.hotCache.has(id)) {
        const entry = this.hotCache.get(id)!;
        entry.invalidationSource = reason;
      }
      this.hotCache.delete(id);
      this.warmCache.delete(id);
    }
    this.stats.lastInvalidationAt = Date.now();
    log.info(`[FactorCacheManager] Invalidated ${factorIds.length} factors (reason: ${reason})`);
  }

  /**
   * Invalidate by category (e.g., CRYPTO, US, HK).
   */
  invalidateByPrefix(prefix: string, reason: string = 'category-reset'): void {
    const toInvalidate: FactorId[] = [];
    for (const [id] of this.hotCache) { if (id.startsWith(prefix)) toInvalidate.push(id); }
    for (const [id] of this.warmCache) { if (id.startsWith(prefix)) toInvalidate.push(id); }
    this.invalidate(toInvalidate, reason);
  }

  /**
   * Invalidate all caches (e.g., new trading day).
   */
  invalidateAll(reason: string = 'full-reset'): void {
    const hotCount = this.hotCache.size;
    const warmCount = this.warmCache.size;
    this.hotCache.clear();
    this.warmCache.clear();
    this.dataVersion++;
    this.stats.lastInvalidationAt = Date.now();
    log.info(`[FactorCacheManager] Full invalidation: ${hotCount} hot + ${warmCount} warm cleared (reason: ${reason}, version: ${this.dataVersion})`);
  }

  // ── Precomputation ───────────────────────────────────────────────────

  /**
   * Start periodic precomputation of top-N factors.
   */
  startPrecomputation(): void {
    if (this.precomputeTimer) return;

    this.precomputeTopFactors();
    this.precomputeTimer = setInterval(() => {
      this.precomputeTopFactors();
    }, this.config.precomputeIntervalMs);

    log.info(`[FactorCacheManager] Precomputation started (top ${this.config.precomputeTopN}, every ${this.config.precomputeIntervalMs}ms)`);
  }

  /**
   * Stop periodic precomputation.
   */
  stopPrecomputation(): void {
    if (this.precomputeTimer) {
      clearInterval(this.precomputeTimer);
      this.precomputeTimer = null;
    }
    log.info('[FactorCacheManager] Precomputation stopped');
  }

  /**
   * Manually trigger precomputation of top factors.
   */
  async precomputeTopFactors(): Promise<number> {
    if (!this.computeFn) {
      log.warn('[FactorCacheManager] Skipped precomputation — no compute function set');
      return 0;
    }

    const topFactors = this.getHotFactorIds();
    const toCompute = topFactors.slice(0, this.config.precomputeTopN);

    let completed = 0;
    for (const factorId of toCompute) {
      try {
        const value = await this.computeFn(factorId);
        this.set(factorId, value, 'hot');
        completed++;
      } catch (err: any) {
        this.stats.precomputesFailed++;
        log.error(`[FactorCacheManager] Precompute failed: ${factorId} — ${err.message}`);
      }
    }

    this.stats.precomputesCompleted++;
    this.stats.lastPrecomputeAt = Date.now();

    if (completed > 0) {
      log.info(`[FactorCacheManager] Precomputed ${completed}/${toCompute.length} hot factors`);
    }

    return completed;
  }

  // ── Hot Factor Selection ─────────────────────────────────────────────

  /**
   * Get the hottest factor IDs (by access frequency, most accessed first).
   */
  getHotFactorIds(): FactorId[] {
    const entries = Array.from(this.accessLog.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .map(([id]) => id);
    return entries;
  }

  /**
   * Get access-frequency report (top 100 factors).
   */
  getAccessLog(): FactorCacheAccessLog[] {
    const sorted = Array.from(this.accessLog.entries())
      .sort((a, b) => b[1].count - a[1].count);

    return sorted.slice(0, 100).map(([id, data], index) => ({
      factorId: id,
      accessCount: data.count,
      lastAccess: data.lastAccess,
      tier: this.hotCache.has(id) ? 'hot' : this.warmCache.has(id) ? 'warm' : 'uncached',
      rank: index + 1,
    }));
  }

  // ── Metrics ───────────────────────────────────────────────────────────

  getStats(): FactorCacheStats {
    let totalSizeBytes = 0;
    for (const [, e] of this.hotCache) totalSizeBytes += e.sizeBytes;
    for (const [, e] of this.warmCache) totalSizeBytes += e.sizeBytes;

    const totalOps = this.stats.hits + this.stats.misses;
    const windowOps = this.stats.windowHits + this.stats.windowMisses;

    return {
      hotEntries: this.hotCache.size,
      warmEntries: this.warmCache.size,
      totalEntries: this.hotCache.size + this.warmCache.size,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: totalOps > 0 ? this.stats.hits / totalOps : 0,
      windowHits: this.stats.windowHits,
      windowMisses: this.stats.windowMisses,
      windowHitRate: windowOps > 0 ? this.stats.windowHits / windowOps : 0,
      evictions: this.stats.evictions,
      expirations: this.stats.expirations,
      precomputesCompleted: this.stats.precomputesCompleted,
      precomputesFailed: this.stats.precomputesFailed,
      estimatedMemoryBytes: totalSizeBytes,
      lastPrecomputeAt: this.stats.lastPrecomputeAt,
      lastInvalidationAt: this.stats.lastInvalidationAt,
    };
  }

  /**
   * Check if hit rate meets ≥70% acceptance criterion.
   */
  isHitRateAcceptable(): boolean {
    const total = this.stats.windowHits + this.stats.windowMisses;
    if (total < 20) return true; // Not enough data
    return this.stats.windowHits / total >= 0.7;
  }

  /**
   * Get estimated compute time saved (cache hit vs cold).
   * Assumes ~200ms cold compute vs ~0ms cache hit.
   */
  getEstimatedTimeSavedMs(): number {
    return this.stats.hits * 200;
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────

  destroy(): void {
    this.stopPrecomputation();
    this.hotCache.clear();
    this.warmCache.clear();
    this.accessLog.clear();
  }

  // ── Internal ──────────────────────────────────────────────────────────

  private promoteToHot(entry: FactorCacheEntry): void {
    this.warmCache.delete(entry.factorId);
    const newEntry: FactorCacheEntry = {
      ...entry,
      tier: 'hot',
      createdAt: Date.now(),
      expiresAt: Date.now() + this.config.hotCacheTtlMs,
    };
    this.hotCache.set(entry.factorId, newEntry);
    this.evictIfNeeded(this.hotCache, this.config.maxHotEntries);
  }

  private evictIfNeeded(cache: Map<FactorId, FactorCacheEntry>, max: number): void {
    while (cache.size > max) {
      this.evictOneFrom(cache);
    }
  }

  private evictOne(): void {
    // Prefer evicting from warm cache
    if (this.warmCache.size > 0) {
      this.evictOneFrom(this.warmCache);
    } else if (this.hotCache.size > 0) {
      this.evictOneFrom(this.hotCache);
    }
  }

  private evictOneFrom(cache: Map<FactorId, FactorCacheEntry>): void {
    let oldestKey: FactorId | null = null;
    let oldestTs = Infinity;

    for (const [key, entry] of cache) {
      if (entry.lastAccessed < oldestTs) {
        oldestTs = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      cache.delete(oldestKey);
      this.stats.evictions++;
    }
  }

  private recordAccess(factorId: FactorId, now: number): void {
    const existing = this.accessLog.get(factorId);
    if (existing) {
      existing.count++;
      existing.lastAccess = now;
    } else {
      this.accessLog.set(factorId, { count: 1, lastAccess: now });
    }
    // Cap size
    if (this.accessLog.size > 1000) {
      let oldest: FactorId | null = null;
      let oldestTs = Infinity;
      for (const [id, data] of this.accessLog) {
        if (data.lastAccess < oldestTs) { oldestTs = data.lastAccess; oldest = id; }
      }
      if (oldest) this.accessLog.delete(oldest);
    }
  }

  private inferValueType(value: FactorCacheValue): FactorCacheEntry['valueType'] {
    if (typeof value === 'number') return 'scalar';
    if (typeof value === 'object' && value !== null) {
      if ('scores' in (value as any)) return 'cross-section';
      return 'factor-output';
    }
    return 'scalar';
  }

  private estimateSizeBytes(value: FactorCacheValue): number {
    try {
      return JSON.stringify(value).length * 2; // UTF-16 estimate
    } catch {
      return 1024;
    }
  }
}

// ═════════════════════════════════════════════════════════════════════════
// Singleton
// ═════════════════════════════════════════════════════════════════════════

let defaultFactorCache: FactorCacheManager | null = null;

export function getFactorCacheManager(config?: Partial<FactorCacheConfig>): FactorCacheManager {
  if (!defaultFactorCache) {
    defaultFactorCache = new FactorCacheManager(config);
  }
  return defaultFactorCache;
}

export function resetFactorCacheManager(): void {
  if (defaultFactorCache) {
    defaultFactorCache.destroy();
    defaultFactorCache = null;
  }
}

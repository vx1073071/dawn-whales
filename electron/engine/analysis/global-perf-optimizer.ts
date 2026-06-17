// ── R275 JVS-3 🚀 全局性能优化器 (GlobalPerfOptimizer) ──
// Batch fetch / cache invalidation / lazy-load / memoize / GC hints / bundle analyzer

export interface CacheEntry<T> {
  key: string; value: T; timestamp: number; ttlMs: number; hits: number;
}

export interface BatchRequestConfig {
  maxBatchSize: number;
  maxWaitMs: number; // max time to wait before flushing
  flushIntervalMs: number;
}

export interface PerformanceSnapshot {
  timestamp: number;
  cacheSize: number; cacheHits: number; cacheMisses: number; cacheHitRate: number;
  avgLookupTimeMs: number; maxLookupTimeMs: number;
  activeSubscriptions: number;
  memoryEstimateMB: number;
  garbageCollections: number;
  apiLatencyMs: { p50: number; p90: number; p99: number };
}

export interface MemoizeConfig {
  ttlMs?: number; maxSize?: number; keyFn?: (...args: any[]) => string;
}

export interface LRUCache<K, V> {
  get(key: K): V | undefined;
  set(key: K, value: V, ttlMs?: number): void;
  delete(key: K): boolean;
  clear(): void;
  size(): number;
  keys(): K[];
}

export interface SubscriptionGroup {
  id: string; symbols: string[]; callbacks: ((data: any) => void)[];
  lastEmit: number; emitCount: number; throttleMs: number;
}

// ═══════════════════════════════════════════════════════════
// 1. Cache Layer
// ═══════════════════════════════════════════════════════════

class TTLCache<V> implements LRUCache<string, V> {
  private store = new Map<string, CacheEntry<V>>();
  private hits = 0; private misses = 0; private lookups = 0;
  private totalLookupMs = 0; private maxLookupMs = 0;

  get(key: string): V | undefined {
    const t0 = Date.now();
    this.lookups++;
    const entry = this.store.get(key);
    if (!entry) { this.misses++; return undefined; }
    if (Date.now() - entry.timestamp > entry.ttlMs) { this.store.delete(key); this.misses++; return undefined; }
    entry.hits++;
    this.hits++;
    const elapsed = Date.now() - t0;
    this.totalLookupMs += elapsed; this.maxLookupMs = Math.max(this.maxLookupMs, elapsed);
    return entry.value;
  }

  set(key: string, value: V, ttlMs = 300000): void {
    this.store.set(key, { key, value, timestamp: Date.now(), ttlMs, hits: 0 });
  }

  delete(key: string): boolean { return this.store.delete(key); }
  clear(): void { this.store.clear(); this.hits = 0; this.misses = 0; }
  size(): number { return this.store.size; }
  keys(): string[] { return [...this.store.keys()]; }

  /** Bulk invalidate by prefix */
  invalidateByPrefix(prefix: string): number {
    let count = 0;
    for (const key of this.store.keys()) { if (key.startsWith(prefix)) { this.store.delete(key); count++; } }
    return count;
  }

  /** Get entries expiring within ms */
  getExpiringSoon(withinMs = 60000): string[] {
    const now = Date.now();
    return [...this.store.entries()].filter(([, v]) => (v.timestamp + v.ttlMs - now) < withinMs).map(([k]) => k);
  }

  stats(): { hits: number; misses: number; hitRate: number; avgMs: number; maxMs: number; size: number } {
    const total = this.hits + this.misses;
    return { hits: this.hits, misses: this.misses, hitRate: total > 0 ? this.hits / total : 0, avgMs: this.lookups > 0 ? this.totalLookupMs / this.lookups : 0, maxMs: this.maxLookupMs, size: this.size() };
  }
}

// ═══════════════════════════════════════════════════════════
// 2. Batch Request Queue
// ═══════════════════════════════════════════════════════════

class BatchRequestQueue<T, R> {
  private pending: { request: T; resolve: (v: R) => void; reject: (e: Error) => void }[] = [];
  private config: BatchRequestConfig;
  private executor: (batch: T[]) => Promise<R[]>;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private flushing = false;

  constructor(executor: (batch: T[]) => Promise<R[]>, config?: Partial<BatchRequestConfig>) {
    this.executor = executor;
    this.config = { maxBatchSize: 50, maxWaitMs: 100, flushIntervalMs: 0, ...config };
  }

  enqueue(request: T): Promise<R> {
    return new Promise((resolve, reject) => {
      this.pending.push({ request, resolve: resolve as any, reject });
      if (this.pending.length >= this.config.maxBatchSize) this.flush();
      else if (!this.timer) { this.timer = setTimeout(() => this.flush(), this.config.maxWaitMs); }
    });
  }

  private async flush(): Promise<void> {
    if (this.flushing || this.pending.length === 0) return;
    this.flushing = true;
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    const batch = this.pending.splice(0);
    try {
      const results = await this.executor(batch.map(b => b.request));
      batch.forEach((b, i) => b.resolve(results[i]));
    } catch (e) {
      batch.forEach(b => b.reject(e as Error));
    }
    this.flushing = false;
  }

  pendingSize(): number { return this.pending.length; }
}

// ═══════════════════════════════════════════════════════════
// 3. Memoize
// ═══════════════════════════════════════════════════════════

function defaultKeyFn(args: any[]): string { return JSON.stringify(args); }

// ═══════════════════════════════════════════════════════════
// 4. Subscription Throttler
// ═══════════════════════════════════════════════════════════

class SubscriptionThrottler {
  private groups = new Map<string, SubscriptionGroup>();

  subscribe(id: string, symbols: string[], callback: (data: any) => void, throttleMs = 200): () => void {
    const group = this.groups.get(id) || { id, symbols: [], callbacks: [], lastEmit: 0, emitCount: 0, throttleMs };
    group.symbols = [...new Set([...group.symbols, ...symbols])];
    group.callbacks.push(callback);
    group.throttleMs = throttleMs;
    this.groups.set(id, group);
    return () => this.unsubscribe(id, callback);
  }

  private unsubscribe(id: string, callback: (data: any) => void): void {
    const group = this.groups.get(id);
    if (!group) return;
    group.callbacks = group.callbacks.filter(cb => cb !== callback);
    if (group.callbacks.length === 0) this.groups.delete(id);
  }

  emit(id: string, data: any): void {
    const group = this.groups.get(id);
    if (!group) return;
    const now = Date.now();
    if (now - group.lastEmit < group.throttleMs) return;
    group.lastEmit = now; group.emitCount++;
    for (const cb of group.callbacks) { try { cb(data); } catch { /* silent */ } }
  }

  getGroups(): SubscriptionGroup[] { return [...this.groups.values()]; }
  groupCount(): number { return this.groups.size; }
}

// ═══════════════════════════════════════════════════════════
// 5. Garbage Collection Hints
// ═══════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════
// Engine
// ═══════════════════════════════════════════════════════════

export class GlobalPerfOptimizer {
  private cache = new TTLCache<any>();
  private batchQueues = new Map<string, BatchRequestQueue<any, any>>();
  private throttler = new SubscriptionThrottler();
  private gcCounter = 0;
  private metrics: PerformanceSnapshot[] = [];

  reset(): void { this.cache.clear(); this.batchQueues.clear(); this.throttler = new SubscriptionThrottler(); this.metrics = []; }

  // ═══════ Cache API ═══════

  cacheGet<T>(key: string): T | undefined { return this.cache.get(key); }
  cacheSet<T>(key: string, value: T, ttlMs?: number): void { this.cache.set(key, value, ttlMs); }
  cacheDelete(key: string): boolean { return this.cache.delete(key); }
  cacheClear(): void { this.cache.clear(); }
  cacheSize(): number { return this.cache.size(); }
  cacheInvalidatePrefix(prefix: string): number { return this.cache.invalidateByPrefix(prefix); }

  // ═══════ Batch API ═══════

  /** Register a batch executor and get a batched version */
  createBatcher<T, R>(name: string, executor: (batch: T[]) => Promise<R[]>, config?: Partial<BatchRequestConfig>): (req: T) => Promise<R> {
    const queue = new BatchRequestQueue<T, R>(executor, config);
    this.batchQueues.set(name, queue);
    return (req: T) => queue.enqueue(req);
  }

  // ═══════ Subscription API ═══════

  throttleSubscribe(id: string, symbols: string[], callback: (data: any) => void, throttleMs = 200): () => void {
    return this.throttler.subscribe(id, symbols, callback, throttleMs);
  }

  throttleEmit(id: string, data: any): void { this.throttler.emit(id, data); }

  // ═══════ Memoize factory ═══════

  /** Create a memoized function with TTL */
  memoize<F extends (...args: any[]) => any>(fn: F, config?: MemoizeConfig): F {
    const cache = new Map<string, { value: ReturnType<F>; ts: number }>();
    const ttl = config?.ttlMs || 300000;
    const maxSize = config?.maxSize || 1000;
    const keyFn = config?.keyFn || ((...args: any[]) => JSON.stringify(args));

    return ((...args: Parameters<F>): ReturnType<F> => {
      const key = keyFn(...args);
      const cached = cache.get(key);
      if (cached && Date.now() - cached.ts < ttl) return cached.value;
      if (cache.size >= maxSize) { const firstKey = cache.keys().next().value; if (firstKey !== undefined) cache.delete(firstKey); }
      const result = fn(...args);
      cache.set(key, { value: result, ts: Date.now() });
      return result;
    }) as F;
  }

  // ═══════ Metrics ═══════

  snapshot(): PerformanceSnapshot {
    const cacheStats = this.cache.stats();
    const snapshot: PerformanceSnapshot = {
      timestamp: Date.now(),
      cacheSize: cacheStats.size, cacheHits: cacheStats.hits, cacheMisses: cacheStats.misses,
      cacheHitRate: Number(cacheStats.hitRate.toFixed(3)),
      avgLookupTimeMs: Number(cacheStats.avgMs.toFixed(3)),
      maxLookupTimeMs: cacheStats.maxMs,
      activeSubscriptions: this.throttler.groupCount(),
      memoryEstimateMB: Math.round(process.memoryUsage?.()?.heapUsed / 1024 / 1024 || cacheStats.size * 0.001),
      garbageCollections: this.gcCounter,
      apiLatencyMs: { p50: 0, p90: 0, p99: 0 },
    };
    this.metrics.push(snapshot);
    return snapshot;
  }

  getMetrics(): PerformanceSnapshot[] { return this.metrics.slice(-60); }

  /** Notify after GC (can be called from gc hook) */
  notifyGC(): void { this.gcCounter++; }

  /** Garbage collect expired entries */
  gc(): number {
    const expired = this.cache.getExpiringSoon(0);
    for (const key of expired) this.cache.delete(key);
    this.gcCounter++;
    return expired.length;
  }
}

// ═══════ Singleton ═══════

let gpoInstance: GlobalPerfOptimizer | null = null;
export function getGlobalPerfOptimizer(): GlobalPerfOptimizer {
  if (!gpoInstance) gpoInstance = new GlobalPerfOptimizer();
  return gpoInstance;
}
export function resetGlobalPerfOptimizer(): void { gpoInstance = null; }

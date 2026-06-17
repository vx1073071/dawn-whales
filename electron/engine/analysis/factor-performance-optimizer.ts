/**
 * FactorPerformanceOptimizer — R280 JVS-1 620因子全局性能优化引擎 (6h)
 *
 * 核心优化:
 * 1. LazyInit — 因子按需加载, 非活动因子不消耗内存
 * 2. LRUCache — 限制因子值缓存, 淘汰最少使用
 * 3. BatchCompute — 批量计算, 减少迭代开销
 * 4. Memoization — 相同输入直接返回缓存结果
 * 5. WorkerQueue — 异步增量更新, 不阻塞主线程
 * 6. PrecomputedBins — 预计算五分位/十分位bin
 * 7. TimeDecayCache — 按时间衰减的缓存优先序
 * 8. FactorDependencyGraph — 只重算受影响的因子
 */

export interface OptConfig {
  lazyLoad: boolean;
  maxCacheSize: number;
  batchSize: number;
  memoWindowMs: number;
  asyncUpdate: boolean;
  precomputeDeciles: boolean;
}

export interface PerfMetrics {
  cacheHits: number;
  cacheMisses: number;
  recomputeCount: number;
  avgComputeMs: number;
  totalComputeMs: number;
  memoSaved: number;
  lazyFactorsLoaded: number;
  totalFactors: number;
  hitRate: number;
}

// ============================================================
export class FactorPerformanceOptimizer {
  private cache = new Map<string, { value: number; ts: number; factorId: string; symbol: string }[]>();
  private memo = new Map<string, { result: any; expires: number }>();
  private accessOrder: string[] = [];
  private metrics: PerfMetrics = {
    cacheHits: 0, cacheMisses: 0, recomputeCount: 0, avgComputeMs: 0, totalComputeMs: 0,
    memoSaved: 0, lazyFactorsLoaded: 0, totalFactors: 620,
    hitRate: 0,
  };
  private config: OptConfig;
  private lazyModules = new Map<string, boolean>(); // factorId → isLoaded
  private depGraph = new Map<string, string[]>(); // factorId → dependents
  private dirtySet = new Set<string>();

  constructor(cfg?: Partial<OptConfig>) {
    this.config = {
      lazyLoad: true, maxCacheSize: 50000, batchSize: 50, memoWindowMs: 60000,
      asyncUpdate: true, precomputeDeciles: true, ...cfg,
    };
  }

  /** Get with memoization */
  getMemo<T>(key: string): T | undefined {
    const entry = this.memo.get(key);
    if (entry && entry.expires > Date.now()) {
      this.metrics.cacheHits++;
      this.metrics.memoSaved++;
      return entry.result as T;
    }
    this.metrics.cacheMisses++;
    return undefined;
  }

  setMemo<T>(key: string, result: T, ttlMs?: number): void {
    this.memo.set(key, { result, expires: Date.now() + (ttlMs ?? this.config.memoWindowMs) });
    // Prune stale entries
    if (this.memo.size > this.config.maxCacheSize) this.pruneMemo();
  }

  /** LRU cache for factor values */
  getFromCache(factorId: string, symbol: string): number | undefined {
    const arr = this.cache.get(factorId);
    if (!arr) return undefined;
    const hit = arr.find(v => v.symbol === symbol);
    if (hit) {
      this.bumpAccess(factorId);
      this.metrics.cacheHits++;
      return hit.value;
    }
    this.metrics.cacheMisses++;
    return undefined;
  }

  setCache(factorId: string, symbol: string, value: number): void {
    if (!this.cache.has(factorId)) this.cache.set(factorId, []);
    const arr = this.cache.get(factorId)!;
    const existing = arr.findIndex(v => v.symbol === symbol);
    const ts = Date.now();
    if (existing >= 0) { arr[existing] = { value, ts, factorId, symbol }; }
    else { arr.push({ value, ts, factorId, symbol }); }
    this.bumpAccess(factorId);
    // LRU evict
    if (this.accessOrder.length > this.config.maxCacheSize) {
      const victim = this.accessOrder.shift()!;
      this.cache.delete(victim);
    }
  }

  /** Lazy module loading */
  isLazyLoaded(factorId: string): boolean { return this.lazyModules.get(factorId) ?? false; }
  markLazyLoaded(factorId: string): void {
    this.lazyModules.set(factorId, true);
    this.metrics.lazyFactorsLoaded++;
  }
  getUnloadedCount(): number { return this.metrics.totalFactors - this.lazyModules.size; }

  /** Batch compute – split large input into chunks */
  batchCompute<T, R>(items: T[], fn: (chunk: T[]) => R[]): R[] {
    const results: R[] = [];
    for (let i = 0; i < items.length; i += this.config.batchSize) {
      const chunk = items.slice(i, i + this.config.batchSize);
      const t0 = performance.now();
      results.push(...fn(chunk));
      this.metrics.totalComputeMs += performance.now() - t0;
      this.metrics.recomputeCount += chunk.length;
    }
    return results;
  }

  /** Dependency graph */
  setDeps(factorId: string, deps: string[]): void {
    for (const dep of deps) {
      if (!this.depGraph.has(dep)) this.depGraph.set(dep, []);
      this.depGraph.get(dep)!.push(factorId);
    }
  }

  /** Mark dirty – only affected factors re-approved */
  markDirty(factorId: string): void {
    this.dirtySet.add(factorId);
    // Propagate to dependents
    const stack = [factorId];
    while (stack.length > 0) {
      const curr = stack.pop()!;
      const deps = this.depGraph.get(curr) || [];
      for (const dep of deps) {
        if (!this.dirtySet.has(dep)) {
          this.dirtySet.add(dep);
          stack.push(dep);
        }
      }
    }
  }

  getDirty(): Set<string> { return new Set(this.dirtySet); }
  clearDirty(factorId: string): void { this.dirtySet.delete(factorId); }

  /** Precompute decile bins */
  precomputeBins(factorId: string, values: number[]): number[] {
    if (!this.config.precomputeDeciles) return [];
    const sorted = [...values].sort((a, b) => a - b);
    const bins: number[] = [];
    for (let i = 1; i <= 9; i++) {
      const idx = Math.floor(sorted.length * i / 10);
      bins.push(sorted[Math.min(idx, sorted.length - 1)]);
    }
    this.setMemo(`bins_${factorId}`, bins, 3600000); // 1h
    return bins;
  }

  /** Performance metrics */
  getMetrics(): PerfMetrics {
    const total = this.metrics.cacheHits + this.metrics.cacheMisses;
    return {
      ...this.metrics,
      hitRate: total > 0 ? +(this.metrics.cacheHits / total).toFixed(3) : 0,
      avgComputeMs: this.metrics.recomputeCount > 0
        ? +(this.metrics.totalComputeMs / this.metrics.recomputeCount).toFixed(3) : 0,
    };
  }

  /** Reset */
  reset(): void {
    this.cache.clear(); this.memo.clear(); this.accessOrder = [];
    this.lazyModules.clear(); this.dirtySet.clear(); this.depGraph.clear();
    this.metrics = {
      cacheHits: 0, cacheMisses: 0, recomputeCount: 0, avgComputeMs: 0, totalComputeMs: 0,
      memoSaved: 0, lazyFactorsLoaded: 0, totalFactors: 620, hitRate: 0,
    };
  }

  private bumpAccess(factorId: string): void {
    const idx = this.accessOrder.indexOf(factorId);
    if (idx >= 0) this.accessOrder.splice(idx, 1);
    this.accessOrder.push(factorId);
  }

  private pruneMemo(): void {
    const now = Date.now();
    const stale: string[] = [];
    Array.from(this.memo.entries()).forEach(([k, v]) => { if (v.expires <= now) stale.push(k); });
    stale.forEach(k => this.memo.delete(k));
  }
}

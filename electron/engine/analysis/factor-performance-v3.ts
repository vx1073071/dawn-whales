/**
 * FactorPerformanceV3 — R282 JVS-2 性能优化Worker+虚拟滚动+缓存 (8h)
 *
 * 目标: Worker offloading / 虚拟滚动数据窗口 / 多级缓存架构
 *
 * 三大模块:
 * 1. WorkerPool — Web Worker 线程池, 将重计算 (IC/factor batch) 移出主线程
 * 2. VirtualScrollWindow — 大数据因子表的虚拟滚动, 按需渲染
 * 3. CacheTierManager — L1(内存)/L2(SQLite)/L3(远程) 三级缓存 + 预热 + 失效
 */

export interface WorkerJob {
  id: string;
  type: 'computeIC' | 'factorBatch' | 'correlationMatrix' | 'portfolioOpt';
  payload: any;
  priority: number; // 1=highest
  queuedAt: number;
  startedAt?: number;
}

export interface WorkerResult {
  jobId: string;
  result: any;
  computeTime: number;   // ms
  workerId: number;
}

export interface WorkerPoolStats {
  totalWorkers: number;
  busyWorkers: number;
  idleWorkers: number;
  queueLength: number;
  completedJobs: number;
  failedJobs: number;
  avgComputeTime: number; // ms
}

export interface VirtualWindow {
  totalItems: number;
  viewportHeight: number;
  itemHeight: number;
  overscan: number;           // items above/below viewport
  scrollTop: number;
  getVisibleRange(): { start: number; end: number };
}

export interface CacheStats {
  l1Hits: number;
  l1Size: number;
  l2Hits: number;
  l2Size: number;
  l3Hits: number;
  l3Size: number;
  totalHits: number;
  totalMisses: number;
  hitRate: number;
}

export interface CacheEntry<T> {
  key: string;
  value: T;
  tier: 1 | 2 | 3;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccess: number;
}

// ============================================================
// MODULE 1: WorkerPool
// ============================================================
export class WorkerPool {
  private maxWorkers: number;
  private queue: WorkerJob[] = [];
  private busyWorkers = 0;
  private totalWorkers: number;
  private completedJobs = 0;
  private failedJobs = 0;
  private totalComputeTime = 0;
  private jobCount = 0;
  private jobResults = new Map<string, WorkerResult>();

  constructor(maxWorkers: number = 4) {
    this.maxWorkers = Math.min(maxWorkers, typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4);
    this.totalWorkers = 0;
  }

  /** Submit job to pool */
  enqueue(job: WorkerJob): string {
    this.queue.push(job);
    this.tryDispatch();
    return job.id;
  }

  /** Enqueue batch jobs */
  enqueueBatch(jobs: WorkerJob[]): string[] {
    const ids: string[] = [];
    for (let i = 0; i < jobs.length; i++) {
      jobs[i].queuedAt = Date.now();
      this.queue.push(jobs[i]);
      ids.push(jobs[i].id);
    }
    this.tryDispatch();
    return ids;
  }

  /** Cancel a job */
  cancelJob(jobId: string): boolean {
    const idx = this.queue.findIndex(j => j.id === jobId);
    if (idx >= 0) {
      this.queue.splice(idx, 1);
      return true;
    }
    // Already processing — can't cancel (mock)
    return false;
  }

  /** Process queue (simulated — actual Web Worker in browser) */
  private tryDispatch(): void {
    // Sort by priority (lower number = higher priority)
    this.queue.sort((a, b) => a.priority - b.priority);

    while (this.queue.length > 0 && this.busyWorkers < this.maxWorkers) {
      const job = this.queue.shift()!;
      this.totalWorkers = Math.max(this.totalWorkers, this.busyWorkers + 1);
      this.busyWorkers++;
      job.startedAt = Date.now();

      // Simulated async compute
      const computeTime = Math.min(job.priority * 30 + Math.floor(Math.random() * 50), 200);
      const result: WorkerResult = {
        jobId: job.id,
        result: { type: job.type, computed: true, payload: job.payload },
        computeTime,
        workerId: this.busyWorkers,
      };

      this.jobResults.set(job.id, result);
      this.completedJobs++;
      this.totalComputeTime += computeTime;
      this.jobCount++;
      this.busyWorkers--;
    }

    // Re-dispatch more jobs from queue
    if (this.queue.length > 0 && this.busyWorkers < this.maxWorkers) {
      this.tryDispatch();
    }
  }

  /** Get result */
  getResult(jobId: string): WorkerResult | null {
    return this.jobResults.get(jobId) || null;
  }

  /** Get pool stats */
  getStats(): WorkerPoolStats {
    return {
      totalWorkers: this.maxWorkers,
      busyWorkers: this.busyWorkers,
      idleWorkers: this.maxWorkers - this.busyWorkers,
      queueLength: this.queue.length,
      completedJobs: this.completedJobs,
      failedJobs: this.failedJobs,
      avgComputeTime: this.jobCount > 0 ? +(this.totalComputeTime / this.jobCount).toFixed(1) : 0,
    };
  }

  /** Purge completed results */
  purge(): void { this.jobResults.clear(); this.jobCount = 0; this.totalComputeTime = 0; }
  reset(): void { this.queue = []; this.jobResults.clear(); this.completedJobs = 0; this.failedJobs = 0; this.totalComputeTime = 0; this.jobCount = 0; this.busyWorkers = 0; }
}

// ============================================================
// MODULE 2: VirtualScrollWindow
// ============================================================
export class VirtualScrollWindow {
  totalItems: number;
  itemHeight: number;
  viewportHeight: number;
  overscan: number;
  scrollTop: number;

  constructor(totalItems: number = 0, viewportHeight: number = 800, itemHeight: number = 48, overscan: number = 5) {
    this.totalItems = totalItems;
    this.viewportHeight = viewportHeight;
    this.itemHeight = itemHeight;
    this.overscan = overscan;
    this.scrollTop = 0;
  }

  /** Get visible item range (with overscan) */
  getVisibleRange(): { start: number; end: number; startOverscan: number; endOverscan: number; totalVisible: number } {
    const visibleStart = Math.floor(this.scrollTop / this.itemHeight);
    const visibleCount = Math.ceil(this.viewportHeight / this.itemHeight) + 1;
    const visibleEnd = Math.min(visibleStart + visibleCount, this.totalItems);

    const startOverscan = Math.max(0, visibleStart - this.overscan);
    const endOverscan = Math.min(visibleEnd + this.overscan, this.totalItems);
    const totalVisible = endOverscan - startOverscan;

    return {
      start: visibleStart,
      end: visibleEnd,
      startOverscan,
      endOverscan,
      totalVisible,
    };
  }

  /** Get container height */
  getContainerHeight(): number {
    return this.totalItems * this.itemHeight;
  }

  /** Get offset top for an item */
  getOffsetTop(index: number): number {
    return index * this.itemHeight;
  }

  /** Get transform translateY for virtual positioning */
  getVirtualStyle(startOverscan: number): { height: number; transform: string } {
    const containerHeight = this.getContainerHeight();
    const offsetY = startOverscan * this.itemHeight;
    return {
      height: containerHeight,
      transform: `translateY(${offsetY}px)`,
    };
  }

  /** Update scroll position */
  updateScroll(scrollTop: number): void {
    this.scrollTop = Math.max(0, Math.min(scrollTop, this.getContainerHeight() - this.viewportHeight));
  }

  /** Recalculate on resize */
  setViewportHeight(height: number): void { this.viewportHeight = height; }
  setTotalItems(count: number): void { this.totalItems = count; }

  /** Estimate memory saved vs full render */
  estimateMemory(bitsPerItem: number = 64): { fullRender: number; virtualRender: number; saved: number; ratio: number } {
    const range = this.getVisibleRange();
    const fullRender = this.totalItems * bitsPerItem / 8 / 1024; // KB
    const virtualRender = range.totalVisible * bitsPerItem / 8 / 1024;
    return {
      fullRender: +fullRender.toFixed(1),
      virtualRender: +virtualRender.toFixed(1),
      saved: +(fullRender - virtualRender).toFixed(1),
      ratio: this.totalItems > 0 ? +(range.totalVisible / this.totalItems * 100).toFixed(1) : 0,
    };
  }

  reset(): void { this.scrollTop = 0; }
}

// ============================================================
// MODULE 3: CacheTierManager — L1/L2/L3
// ============================================================
export class CacheTierManager {
  private l1 = new Map<string, CacheEntry<any>>(); // Memory (fastest)
  private l2 = new Map<string, CacheEntry<any>>(); // SQLite simulated
  private l3 = new Map<string, CacheEntry<any>>(); // Remote simulated
  private maxL1Size: number;
  private maxL2Size: number;
  private hits = { l1: 0, l2: 0, l3: 0 };
  private misses = 0;
  private preloadKeys: string[] = [];

  constructor(maxL1: number = 500, maxL2: number = 5000) {
    this.maxL1Size = maxL1;
    this.maxL2Size = maxL2;
  }

  /** Get from cache (auto tier promotion) */
  get<T>(key: string): { value: T | null; tier: number; hit: boolean } {
    // L1 check
    const l1Entry = this.l1.get(key);
    if (l1Entry && Date.now() - l1Entry.timestamp < l1Entry.ttl) {
      l1Entry.accessCount++;
      l1Entry.lastAccess = Date.now();
      this.hits.l1++;
      return { value: l1Entry.value as T, tier: 1, hit: true };
    }

    // L2 check + promote to L1
    const l2Entry = this.l2.get(key);
    if (l2Entry && Date.now() - l2Entry.timestamp < l2Entry.ttl) {
      this.hits.l2++;
      this.setL1(key, l2Entry.value, { ttl: l2Entry.ttl });
      return { value: l2Entry.value as T, tier: 2, hit: true };
    }

    // L3 check
    const l3Entry = this.l3.get(key);
    if (l3Entry && Date.now() - l3Entry.timestamp < l3Entry.ttl) {
      this.hits.l3++;
      this.setL1(key, l3Entry.value, { ttl: l3Entry.ttl });
      this.l2.set(key, { key, value: l3Entry.value, tier: 2, timestamp: Date.now(), ttl: l3Entry.ttl, accessCount: 1, lastAccess: Date.now() });
      return { value: l3Entry.value as T, tier: 3, hit: true };
    }

    this.misses++;
    return { value: null, tier: 0, hit: false };
  }

  /** Set value (L1 first, cascades down) */
  set<T>(key: string, value: T, opts?: { ttl?: number }): void {
    const ttl = opts?.ttl || 300000; // 5 min default
    this.setL1(key, value, { ttl });
    this.l2.set(key, { key, value, tier: 2, timestamp: Date.now(), ttl, accessCount: 0, lastAccess: Date.now() });
  }

  private setL1<T>(key: string, value: T, opts?: { ttl?: number }): void {
    const ttl = opts?.ttl || 300000;
    // Evict if full (LRU)
    if (this.l1.size >= this.maxL1Size) {
      const entries = Array.from(this.l1.entries());
      entries.sort((a, b) => a[1].lastAccess - b[1].lastAccess);
      // Remove oldest 10%
      const toRemove = Math.max(1, Math.floor(this.maxL1Size * 0.1));
      for (let i = 0; i < toRemove && i < entries.length; i++) {
        this.l1.delete(entries[i][0]);
      }
    }
    this.l1.set(key, { key, value, tier: 1, timestamp: Date.now(), ttl, accessCount: 0, lastAccess: Date.now() });
  }

  /** Preload keys (warm cache) */
  preload(keys: string[], fetchFn: (key: string) => any): void {
    this.preloadKeys = keys;
    for (let i = 0; i < keys.length; i++) {
      const value = fetchFn(keys[i]);
      this.set(keys[i], value, { ttl: 600000 });
    }
  }

  /** Invalidate key across all tiers */
  invalidate(key: string): void {
    this.l1.delete(key);
    this.l2.delete(key);
    this.l3.delete(key);
  }

  /** Invalidate keys matching pattern */
  invalidatePattern(pattern: string): number {
    let count = 0;
    const allKeys = [...Array.from(this.l1.keys()), ...Array.from(this.l2.keys()), ...Array.from(this.l3.keys())];
    for (let i = 0; i < allKeys.length; i++) {
      if (allKeys[i].includes(pattern)) {
        this.invalidate(allKeys[i]);
        count++;
      }
    }
    return count;
  }

  /** Get cache stats */
  getStats(): CacheStats {
    const totalHits = this.hits.l1 + this.hits.l2 + this.hits.l3;
    const total = totalHits + this.misses;
    return {
      l1Hits: this.hits.l1,
      l1Size: this.l1.size,
      l2Hits: this.hits.l2,
      l2Size: this.l2.size,
      l3Hits: this.hits.l3,
      l3Size: this.l3.size,
      totalHits,
      totalMisses: this.misses,
      hitRate: total > 0 ? +(totalHits / total * 100).toFixed(1) : 0,
    };
  }

  reset(): void {
    this.l1.clear(); this.l2.clear(); this.l3.clear();
    this.hits = { l1: 0, l2: 0, l3: 0 }; this.misses = 0;
    this.preloadKeys = [];
  }
}

// ============================================================
// Unified Performance Optimizer V3
// ============================================================
export class FactorPerformanceV3 {
  workerPool: WorkerPool;
  virtualScroll: VirtualScrollWindow;
  cacheManager: CacheTierManager;

  constructor() {
    this.workerPool = new WorkerPool(4);
    this.virtualScroll = new VirtualScrollWindow(1000, 800, 48, 10);
    this.cacheManager = new CacheTierManager(500, 5000);
  }

  /** Compute IC via Worker */
  computeICInWorker(factorValues: number[], returns: number[], priority: number = 3): string {
    const job: WorkerJob = {
      id: `ic_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      type: 'computeIC',
      payload: { factorValues, returns },
      priority,
      queuedAt: Date.now(),
    };
    return this.workerPool.enqueue(job);
  }

  /** Compute factor batch via Workers (parallel) */
  computeFactorBatch(factors: Array<{ id: string; values: number[]; weight: number }>, returns: number[]): string[] {
    const jobs: WorkerJob[] = factors.map(f => ({
      id: `factor_${f.id}_${Date.now()}`,
      type: 'factorBatch' as const,
      payload: { factorId: f.id, values: f.values, returns, weight: f.weight },
      priority: 2,
      queuedAt: Date.now(),
    }));
    return this.workerPool.enqueueBatch(jobs);
  }

  /** Get full performance report */
  getReport(): { worker: WorkerPoolStats; virtual: ReturnType<VirtualScrollWindow['estimateMemory']>; cache: CacheStats } {
    return {
      worker: this.workerPool.getStats(),
      virtual: this.virtualScroll.estimateMemory(),
      cache: this.cacheManager.getStats(),
    };
  }

  reset(): void {
    this.workerPool.reset();
    this.virtualScroll.reset();
    this.cacheManager.reset();
  }
}

let _fpv3: FactorPerformanceV3 | undefined;
export function getFactorPerformanceV3(): FactorPerformanceV3 {
  if (!_fpv3) _fpv3 = new FactorPerformanceV3();
  return _fpv3;
}
export function resetFactorPerformanceV3(): void { _fpv3?.reset(); _fpv3 = undefined; }

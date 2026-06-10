// JVS-50-01: Performance Optimization Module
// Memory optimization (-15%), query optimization (<50ms), cache optimization (>95%)

import { EventEmitter } from 'events';

export interface PerformanceMetrics {
  memoryUsage: number;
  queryTimeMs: number;
  cacheHitRate: number;
  timestamp: number;
}

export interface OptimizationConfig {
  maxMemoryMB: number;
  queryTimeoutMs: number;
  cacheHitRateTarget: number;
  enableProfiling: boolean;
}

export class PerformanceOptimizer extends EventEmitter {
  private metrics: PerformanceMetrics[] = [];
  private config: OptimizationConfig;
  private isProfiling: boolean = false;

  constructor(config?: Partial<OptimizationConfig>) {
    super();
    this.config = {
      maxMemoryMB: config?.maxMemoryMB ?? 400,
      queryTimeoutMs: config?.queryTimeoutMs ?? 50,
      cacheHitRateTarget: config?.cacheHitRateTarget ?? 0.95,
      enableProfiling: config?.enableProfiling ?? true,
    };
  }

  /**
   * Start performance profiling
   */
  startProfiling(): void {
    if (this.isProfiling) return;
    this.isProfiling = true;
    this.emit('profiling:start');
  }

  /**
   * Stop performance profiling
   */
  stopProfiling(): void {
    if (!this.isProfiling) return;
    this.isProfiling = false;
    this.emit('profiling:stop');
  }

  /**
   * Record performance metrics
   */
  recordMetrics(metrics: Omit<PerformanceMetrics, 'timestamp'>): void {
    const metric: PerformanceMetrics = {
      ...metrics,
      timestamp: Date.now(),
    };

    this.metrics.push(metric);

    // Keep only last 1000 metrics
    if (this.metrics.length > 1000) {
      this.metrics.shift();
    }

    // Emit warning if performance degrades
    if (metrics.memoryUsage > this.config.maxMemoryMB * 0.9) {
      this.emit('warning:memory', { usage: metrics.memoryUsage });
    }

    if (metrics.queryTimeMs > this.config.queryTimeoutMs) {
      this.emit('warning:query', { timeMs: metrics.queryTimeMs });
    }

    if (metrics.cacheHitRate < this.config.cacheHitRateTarget) {
      this.emit('warning:cache', { hitRate: metrics.cacheHitRate });
    }
  }

  /**
   * Get current performance metrics
   */
  getCurrentMetrics(): PerformanceMetrics | null {
    if (this.metrics.length === 0) return null;
    return this.metrics[this.metrics.length - 1];
  }

  /**
   * Get performance statistics
   */
  getStatistics(): {
    avgQueryTime: number;
    avgCacheHitRate: number;
    avgMemoryMB: number;
    totalRecords: number;
  } {
    if (this.metrics.length === 0) {
      return {
        avgQueryTime: 0,
        avgCacheHitRate: 0,
        avgMemoryMB: 0,
        totalRecords: 0,
      };
    }

    const sum = this.metrics.reduce(
      (acc, m) => ({
        queryTime: acc.queryTime + m.queryTimeMs,
        cacheHit: acc.cacheHit + m.cacheHitRate,
        memory: acc.memory + m.memoryUsage,
      }),
      { queryTime: 0, cacheHit: 0, memory: 0 }
    );

    return {
      avgQueryTime: sum.queryTime / this.metrics.length,
      avgCacheHitRate: sum.cacheHit / this.metrics.length,
      avgMemoryMB: sum.memory / this.metrics.length,
      totalRecords: this.metrics.length,
    };
  }

  /**
   * Optimize memory usage by cleaning old data
   */
  optimizeMemory(): number {
    const beforeCount = this.metrics.length;
    const cutoff = Date.now() - 60 * 60 * 1000; // Keep last hour

    this.metrics = this.metrics.filter((m) => m.timestamp > cutoff);

    const cleaned = beforeCount - this.metrics.length;
    this.emit('memory:cleaned', { cleaned });
    return cleaned;
  }

  /**
   * Get performance report
   */
  getReport(): {
    metrics: PerformanceMetrics[];
    statistics: ReturnType<PerformanceOptimizer['getStatistics']>;
    config: OptimizationConfig;
  } {
    return {
      metrics: [...this.metrics],
      statistics: this.getStatistics(),
      config: { ...this.config },
    };
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.metrics = [];
    this.emit('reset');
  }
}

// Singleton instance
let optimizerInstance: PerformanceOptimizer | null = null;

export function getPerformanceOptimizer(
  config?: Partial<OptimizationConfig>
): PerformanceOptimizer {
  if (!optimizerInstance) {
    optimizerInstance = new PerformanceOptimizer(config);
  }
  return optimizerInstance;
}

// Performance monitoring utilities
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private queryTimes: Map<string, number[]> = new Map();
  private cacheHits: Map<string, { hits: number; misses: number }> = new Map();

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  /**
   * Record query execution time
   */
  recordQuery(queryKey: string, timeMs: number): void {
    if (!this.queryTimes.has(queryKey)) {
      this.queryTimes.set(queryKey, []);
    }
    const times = this.queryTimes.get(queryKey)!;
    times.push(timeMs);

    // Keep only last 100 queries
    if (times.length > 100) {
      times.shift();
    }
  }

  /**
   * Record cache hit/miss
   */
  recordCacheAccess(key: string, hit: boolean): void {
    if (!this.cacheHits.has(key)) {
      this.cacheHits.set(key, { hits: 0, misses: 0 });
    }
    const cache = this.cacheHits.get(key)!;
    if (hit) {
      cache.hits++;
    } else {
      cache.misses++;
    }
  }

  /**
   * Get average query time for a key
   */
  getAverageQueryTime(key: string): number {
    const times = this.queryTimes.get(key);
    if (!times || times.length === 0) return 0;
    return times.reduce((sum, t) => sum + t, 0) / times.length;
  }

  /**
   * Get cache hit rate for a key
   */
  getCacheHitRate(key: string): number {
    const cache = this.cacheHits.get(key);
    if (!cache) return 0;
    const total = cache.hits + cache.misses;
    return total > 0 ? cache.hits / total : 0;
  }

  /**
   * Get overall statistics
   */
  getOverallStats(): {
    totalQueries: number;
    avgQueryTime: number;
    avgCacheHitRate: number;
  } {
    let totalQueries = 0;
    let totalQueryTime = 0;
    let totalCacheHits = 0;
    let totalCacheAccesses = 0;

    for (const times of this.queryTimes.values()) {
      totalQueries += times.length;
      totalQueryTime += times.reduce((sum, t) => sum + t, 0);
    }

    for (const cache of this.cacheHits.values()) {
      totalCacheHits += cache.hits;
      totalCacheAccesses += cache.hits + cache.misses;
    }

    return {
      totalQueries,
      avgQueryTime: totalQueries > 0 ? totalQueryTime / totalQueries : 0,
      avgCacheHitRate:
        totalCacheAccesses > 0 ? totalCacheHits / totalCacheAccesses : 0,
    };
  }

  /**
   * Reset all monitoring data
   */
  reset(): void {
    this.queryTimes.clear();
    this.cacheHits.clear();
  }
}

// ── J-51-03: Engine Cold Start Optimizer ──────────────────────────────────

export interface EngineInitRecord {
  engineName: string;
  initTimeMs: number;
  memoryDeltaMB: number;
  priority: 'critical' | 'important' | 'lazy';
  timestamp: number;
}

export interface ColdStartReport {
  totalInitTimeMs: number;
  engineCount: number;
  criticalEngines: EngineInitRecord[];
  lazyEngines: EngineInitRecord[];
  memoryUsedMB: number;
  recommendations: string[];
}

/**
 * Tracks and optimizes engine initialization order for cold start performance.
 * Critical engines (data providers, IPC) load first; lazy engines (AI, analytics) defer.
 */
export class ColdStartOptimizer {
  private records: EngineInitRecord[] = [];
  private targetMs: number;

  constructor(targetMs: number = 2000) {
    this.targetMs = targetMs;
  }

  /**
   * Record an engine's initialization time and memory impact
   */
  recordInit(engineName: string, initTimeMs: number, memoryDeltaMB: number, priority: EngineInitRecord['priority'] = 'important'): void {
    this.records.push({
      engineName,
      initTimeMs,
      memoryDeltaMB,
      priority,
      timestamp: Date.now(),
    });
  }

  /**
   * Get engines sorted by priority (critical first, then important, then lazy)
   * Within each priority, sorted by initTime descending (slowest first for parallel loading)
   */
  getInitOrder(): EngineInitRecord[] {
    const priorityOrder: Record<string, number> = { critical: 0, important: 1, lazy: 2 };
    return [...this.records].sort((a, b) => {
      const pa = priorityOrder[a.priority] ?? 1;
      const pb = priorityOrder[b.priority] ?? 1;
      if (pa !== pb) return pa - pb;
      return b.initTimeMs - a.initTimeMs;
    });
  }

  /**
   * Get cold start report with optimization recommendations
   */
  getReport(): ColdStartReport {
    const critical = this.records.filter(r => r.priority === 'critical');
    const lazy = this.records.filter(r => r.priority === 'lazy');
    const totalInit = this.records.reduce((sum, r) => sum + r.initTimeMs, 0);
    const totalMemory = this.records.reduce((sum, r) => sum + r.memoryDeltaMB, 0);

    const recommendations: string[] = [];

    if (totalInit > this.targetMs) {
      recommendations.push(`Total init ${totalInit}ms exceeds target ${this.targetMs}ms`);
    }

    const slowEngines = this.records.filter(r => r.initTimeMs > 200);
    if (slowEngines.length > 0) {
      recommendations.push(`${slowEngines.length} engines >200ms: ${slowEngines.map(e => e.engineName).join(', ')}`);
    }

    if (totalMemory > 350) {
      recommendations.push(`Memory ${totalMemory}MB approaching 400MB limit`);
    }

    const lazyCandidates = this.records.filter(r => r.priority === 'important' && r.initTimeMs > 150);
    if (lazyCandidates.length > 0) {
      recommendations.push(`Consider deferring: ${lazyCandidates.map(e => e.engineName).join(', ')}`);
    }

    return {
      totalInitTimeMs: totalInit,
      engineCount: this.records.length,
      criticalEngines: critical,
      lazyEngines: lazy,
      memoryUsedMB: totalMemory,
      recommendations,
    };
  }

  /**
   * Simulate lazy loading: move non-critical engines to deferred queue
   */
  getDeferredEngines(): string[] {
    return this.records
      .filter(r => r.priority === 'lazy')
      .map(r => r.engineName);
  }

  /**
   * Get estimated cold start time with lazy loading
   */
  getEstimatedColdStartMs(): number {
    return this.records
      .filter(r => r.priority !== 'lazy')
      .reduce((sum, r) => sum + r.initTimeMs, 0);
  }

  /**
   * Reset all records
   */
  reset(): void {
    this.records = [];
  }
}

// ── J-51-03: Memory Leak Detector ────────────────────────────────────────

export interface MemorySnapshot {
  engineName: string;
  heapUsedMB: number;
  timestamp: number;
}

export interface LeakDetectionResult {
  engineName: string;
  growthRateMBPerMin: number;
  isLeaking: boolean;
  snapshots: number;
  recommendation: string;
}

/**
 * Monitors engine memory usage over time to detect potential memory leaks.
 * Uses linear regression on memory snapshots to identify growth trends.
 */
export class MemoryLeakDetector {
  private snapshots: Map<string, MemorySnapshot[]> = new Map();
  private thresholdMBPerMin: number;
  private maxSnapshots: number;

  constructor(thresholdMBPerMin: number = 1.0, maxSnapshots: number = 100) {
    this.thresholdMBPerMin = thresholdMBPerMin;
    this.maxSnapshots = maxSnapshots;
  }

  /**
   * Record a memory snapshot for an engine
   */
  recordSnapshot(engineName: string, heapUsedMB: number): void {
    if (!this.snapshots.has(engineName)) {
      this.snapshots.set(engineName, []);
    }
    const snaps = this.snapshots.get(engineName)!;
    snaps.push({ engineName, heapUsedMB, timestamp: Date.now() });
    if (snaps.length > this.maxSnapshots) {
      snaps.shift();
    }
  }

  /**
   * Analyze memory growth for an engine using simple linear regression
   */
  analyzeEngine(engineName: string): LeakDetectionResult {
    const snaps = this.snapshots.get(engineName);
    if (!snaps || snaps.length < 3) {
      return {
        engineName,
        growthRateMBPerMin: 0,
        isLeaking: false,
        snapshots: snaps?.length ?? 0,
        recommendation: 'Insufficient data (need ≥3 snapshots)',
      };
    }

    const t0 = snaps[0].timestamp;
    // Use index as x-axis when timestamps are too close (< 1s apart)
    const timeSpan = snaps[snaps.length - 1].timestamp - t0;
    const xs = timeSpan > 1000
      ? snaps.map(s => (s.timestamp - t0) / 60000) // minutes
      : snaps.map((_, i) => i); // use index as proxy

    const ys = snaps.map(s => s.heapUsedMB);

    const n = xs.length;
    const sumX = xs.reduce((a, b) => a + b, 0);
    const sumY = ys.reduce((a, b) => a + b, 0);
    const sumXY = xs.reduce((a, x, i) => a + x * ys[i], 0);
    const sumX2 = xs.reduce((a, x) => a + x * x, 0);

    const denominator = n * sumX2 - sumX * sumX;
    if (denominator === 0) {
      return { engineName, growthRateMBPerMin: 0, isLeaking: false, snapshots: n, recommendation: 'All snapshots at same time' };
    }
    const slope = (n * sumXY - sumX * sumY) / denominator;
    const isLeaking = slope > this.thresholdMBPerMin;

    return {
      engineName,
      growthRateMBPerMin: Math.round(slope * 1000) / 1000,
      isLeaking,
      snapshots: n,
      recommendation: isLeaking
        ? `Potential leak: ${slope.toFixed(3)} MB/min growth. Investigate ${engineName}.`
        : `Healthy: ${slope.toFixed(3)} MB/min growth.`,
    };
  }

  /**
   * Analyze all tracked engines
   */
  analyzeAll(): LeakDetectionResult[] {
    const results: LeakDetectionResult[] = [];
    for (const engineName of this.snapshots.keys()) {
      results.push(this.analyzeEngine(engineName));
    }
    return results.sort((a, b) => b.growthRateMBPerMin - a.growthRateMBPerMin);
  }

  /**
   * Get engines that are potentially leaking
   */
  getLeakingEngines(): LeakDetectionResult[] {
    return this.analyzeAll().filter(r => r.isLeaking);
  }

  /**
   * Reset all snapshots
   */
  reset(): void {
    this.snapshots.clear();
  }
}

// Singleton
let coldStartOptimizer: ColdStartOptimizer | null = null;
let memoryLeakDetector: MemoryLeakDetector | null = null;

export function getColdStartOptimizer(targetMs?: number): ColdStartOptimizer {
  if (!coldStartOptimizer) coldStartOptimizer = new ColdStartOptimizer(targetMs);
  return coldStartOptimizer;
}

export function getMemoryLeakDetector(): MemoryLeakDetector {
  if (!memoryLeakDetector) memoryLeakDetector = new MemoryLeakDetector();
  return memoryLeakDetector;
}

export function resetPerformanceTools(): void {
  coldStartOptimizer?.reset();
  memoryLeakDetector?.reset();
  coldStartOptimizer = null;
  memoryLeakDetector = null;
  optimizerInstance = null;
}

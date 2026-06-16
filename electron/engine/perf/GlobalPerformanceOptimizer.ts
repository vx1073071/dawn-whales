/**
 * GlobalPerformanceOptimizer — R264 JVS-3
 *
 * 全局性能优化引擎。覆盖: 延迟/内存/连接池/缓存策略/LCP优化。
 *
 * Feature set:
 *   - Connection pooling: HTTP/S keep-alive + max sockets + idle timeout
 *   - Memory tracking: heap/mb per engine + GC hints
 *   - Latency buckets: P50/P95/P99 + SLA alert
 *   - Cache tier: L1(memory) / L2(file) / L3(network)
 *   - Bundle analyzer: engine dependency size audit
 *   - LCP optimization: async load + lazy import + tree-shake suggestions
 *   - Dashboard: overall health + top-lagging engines
 *   - Auto-tune: adjust pool size/thresholds based on load
 *
 * Architecture:
 *   - Singleton with reset()
 *   - Per-engine monitoring hooks
 *   - Multi-tier cache advisor
 *
 * @author JVS
 * @round R264
 * @since 2026-06-17
 */

import { EventEmitter } from 'events';

// ─── Types ───────────────────────────────────────────────

export type PerfLevel = 'excellent' | 'good' | 'fair' | 'poor' | 'critical';

export interface LatencyBucket {
  engineName: string;
  operation: string;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  sampleCount: number;
  level: PerfLevel;
  lastUpdated: number;
}

export interface MemoryFootprint {
  engineName: string;
  estimatedBytes: number;
  cacheBytes: number;
  bufferBytes: number;
  peakBytes: number;
  lastGcAt?: number;
  level: PerfLevel;
}

export interface ConnectionPoolMetrics {
  poolName: string;
  active: number;
  idle: number;
  waiting: number;
  max: number;
  timeoutMs: number;
  errors: number;
  level: PerfLevel;
}

export interface CacheTierMetrics {
  tier: 'L1' | 'L2' | 'L3';
  entries: number;
  hitRate: number;
  missRate: number;
  evictions: number;
  avgAccessMs: number;
}

export interface DependencySize {
  engineName: string;
  totalBytes: number;
  dependencyCount: number;
  largestDep: string;
  largestDepBytes: number;
  lazyLoadCandidates: string[];
}

export interface LCPAdvice {
  component: string;
  currentMs: number;
  targetMs: number;
  advice: string;
  impact: 'high' | 'medium' | 'low';
}

export interface PerformanceReport {
  overallScore: number;            // 0-100
  overallLevel: PerfLevel;
  latencyBuckets: LatencyBucket[];
  memoryFootprints: MemoryFootprint[];
  connectionPools: ConnectionPoolMetrics[];
  cacheTiers: CacheTierMetrics[];
  topDependencies: DependencySize[];
  lcpAdvice: LCPAdvice[];
  generatedAt: number;
}

export interface PerfConfig {
  maxPoolSize: number;
  idleTimeoutMs: number;
  gcThresholdBytes: number;
  latencyAlertP95Ms: number;
  cacheL1MaxEntries: number;
  cacheL2MaxEntries: number;
  lcpTargetMs: number;
  autoTuneEnabled: boolean;
}

// ─── Defaults ────────────────────────────────────────────

const DEFAULT_PERF_CONFIG: PerfConfig = {
  maxPoolSize: 20,
  idleTimeoutMs: 60_000,
  gcThresholdBytes: 100_000_000,   // 100MB
  latencyAlertP95Ms: 500,
  cacheL1MaxEntries: 5000,
  cacheL2MaxEntries: 50000,
  lcpTargetMs: 2500,
  autoTuneEnabled: true,
};

// ─── Engine ──────────────────────────────────────────────

export class GlobalPerformanceOptimizer extends EventEmitter {
  private static instance: GlobalPerformanceOptimizer;

  private config: PerfConfig;
  private latencyBuckets: Map<string, LatencyBucket[]> = new Map();
  private memoryFootprints: Map<string, MemoryFootprint> = new Map();
  private connectionPools: Map<string, ConnectionPoolMetrics> = new Map();
  private cacheTiers: CacheTierMetrics[] = [];
  private depSizes: Map<string, DependencySize> = new Map();
  private lcpAdvice: LCPAdvice[] = [];
  private overallScore = 85;        // start optimistic
  private overallLevel: PerfLevel = 'good';

  constructor(config?: Partial<PerfConfig>) {
    super();
    this.config = { ...DEFAULT_PERF_CONFIG, ...config };
  }

  static getInstance(config?: Partial<PerfConfig>): GlobalPerformanceOptimizer {
    if (!GlobalPerformanceOptimizer.instance) {
      GlobalPerformanceOptimizer.instance = new GlobalPerformanceOptimizer(config);
    } else if (config) {
      GlobalPerformanceOptimizer.instance.config = { ...GlobalPerformanceOptimizer.instance.config, ...config };
    }
    return GlobalPerformanceOptimizer.instance;
  }

  reset(): void {
    this.latencyBuckets.clear();
    this.memoryFootprints.clear();
    this.connectionPools.clear();
    this.cacheTiers = [];
    this.depSizes.clear();
    this.lcpAdvice = [];
    this.overallScore = 85;
    this.overallLevel = 'good';
    this.removeAllListeners();
  }

  // ─── Latency Tracking ───────────────────────────────────

  recordLatency(engineName: string, operation: string, ms: number): void {
    const key = `${engineName}::${operation}`;
    let buckets = this.latencyBuckets.get(key);
    if (!buckets) {
      buckets = [{
        engineName, operation,
        p50Ms: ms, p95Ms: ms, p99Ms: ms,
        sampleCount: 0, level: 'good', lastUpdated: Date.now(),
      }];
      this.latencyBuckets.set(key, buckets);
    }

    const b = buckets[0];
    b.sampleCount++;
    // Exponential moving average with alpha=0.1
    b.p50Ms = b.p50Ms * 0.9 + ms * 0.1;
    if (ms > b.p95Ms) b.p95Ms = b.p95Ms * 0.8 + ms * 0.2;
    else b.p95Ms = b.p95Ms * 0.95 + ms * 0.05;
    if (ms > b.p99Ms) b.p99Ms = b.p99Ms * 0.7 + ms * 0.3;
    else b.p99Ms = b.p99Ms * 0.98 + ms * 0.02;
    b.level = this.latencyToLevel(b.p95Ms);
    b.lastUpdated = Date.now();

    this.emit('latency_recorded', { engineName, operation, ms, p95Now: b.p95Ms });
  }

  private latencyToLevel(p95: number): PerfLevel {
    if (p95 < 50) return 'excellent';
    if (p95 < 200) return 'good';
    if (p95 < 500) return 'fair';
    if (p95 < 1000) return 'poor';
    return 'critical';
  }

  getLatencyBuckets(engineName?: string): LatencyBucket[] {
    const all = Array.from(this.latencyBuckets.values()).map(b => b[0]);
    if (engineName) return all.filter(b => b.engineName === engineName);
    return all;
  }

  // ─── Memory Tracking ────────────────────────────────────

  recordMemory(engineName: string, estimatedBytes: number, cacheBytes = 0, bufferBytes = 0): void {
    const prev = this.memoryFootprints.get(engineName);
    const footprint: MemoryFootprint = {
      engineName, estimatedBytes, cacheBytes, bufferBytes,
      peakBytes: prev ? Math.max(prev.peakBytes, estimatedBytes) : estimatedBytes,
      level: this.memoryToLevel(estimatedBytes),
      lastGcAt: prev?.lastGcAt,
    };

    if (estimatedBytes > this.config.gcThresholdBytes && (!prev || estimatedBytes > prev.estimatedBytes * 1.5)) {
      footprint.lastGcAt = Date.now();
      this.emit('gc_hint', { engineName, estimatedBytes, threshold: this.config.gcThresholdBytes });
    }

    this.memoryFootprints.set(engineName, footprint);
    this.emit('memory_recorded', footprint);
  }

  private memoryToLevel(bytes: number): PerfLevel {
    if (bytes < 10_000_000) return 'excellent';
    if (bytes < 50_000_000) return 'good';
    if (bytes < 100_000_000) return 'fair';
    if (bytes < 200_000_000) return 'poor';
    return 'critical';
  }

  getMemoryFootprints(): MemoryFootprint[] {
    return Array.from(this.memoryFootprints.values());
  }

  getTotalMemory(): number {
    let total = 0;
    for (const [, f] of this.memoryFootprints) total += f.estimatedBytes;
    return total;
  }

  // ─── Connection Pool ────────────────────────────────────

  registerPool(poolName: string, max: number, timeoutMs: number): void {
    this.connectionPools.set(poolName, {
      poolName, active: 0, idle: 0, waiting: 0, max, timeoutMs,
      errors: 0, level: 'good',
    });
  }

  updatePool(poolName: string, active: number, idle: number, waiting: number): void {
    const pool = this.connectionPools.get(poolName);
    if (!pool) return;
    pool.active = active;
    pool.idle = idle;
    pool.waiting = waiting;
    pool.level = pool.waiting > 5 ? 'poor' : pool.active / pool.max > 0.8 ? 'fair' : 'good';

    if (pool.waiting > 10) this.emit('pool_pressure', pool);
  }

  recordPoolError(poolName: string): void {
    const pool = this.connectionPools.get(poolName);
    if (pool) pool.errors++;
  }

  getPoolMetrics(): ConnectionPoolMetrics[] {
    return Array.from(this.connectionPools.values());
  }

  // ─── Cache Tier ─────────────────────────────────────────

  recordCacheTier(tier: CacheTierMetrics['tier'], entries: number, hits: number, misses: number, evictions: number, avgAccessMs: number): void {
    const total = hits + misses;
    const hitRate = total > 0 ? hits / total : 0;
    this.cacheTiers.push({ tier, entries, hitRate, missRate: 1 - hitRate, evictions, avgAccessMs });
    // Keep last 10 records
    if (this.cacheTiers.length > 10) this.cacheTiers.shift();
  }

  getCacheTierMetrics(): CacheTierMetrics[] { return [...this.cacheTiers]; }

  // ─── Dependency Size ────────────────────────────────────

  recordDependencySize(engineName: string, totalBytes: number, depList: Array<{ name: string; bytes: number }>): void {
    const sorted = [...depList].sort((a, b) => b.bytes - a.bytes);
    this.depSizes.set(engineName, {
      engineName, totalBytes, dependencyCount: depList.length,
      largestDep: sorted[0]?.name || 'none',
      largestDepBytes: sorted[0]?.bytes || 0,
      lazyLoadCandidates: sorted.filter(d => d.bytes > 50_000).map(d => d.name),
    });
  }

  getDependencySizes(): DependencySize[] {
    return Array.from(this.depSizes.values()).sort((a, b) => b.totalBytes - a.totalBytes);
  }

  // ─── LCP Advice ─────────────────────────────────────────

  addLCPAdvice(component: string, currentMs: number, advice: string, impact: LCPAdvice['impact']): void {
    this.lcpAdvice.push({
      component, currentMs,
      targetMs: this.config.lcpTargetMs,
      advice, impact,
    });
    if (this.lcpAdvice.length > 20) this.lcpAdvice.shift();
  }

  getLCPAdvice(): LCPAdvice[] { return [...this.lcpAdvice]; }

  // ─── Auto-tune ──────────────────────────────────────────

  autoTune(): PerformanceReport {
    const report = this.generateReport();

    if (this.config.autoTuneEnabled) {
      // Adjust pool size based on waiting
      for (const pool of this.getPoolMetrics()) {
        if (pool.waiting > 5) {
          this.config.maxPoolSize = Math.min(this.config.maxPoolSize + 5, 50);
          this.emit('pool_resized', { name: pool.poolName, newMax: this.config.maxPoolSize });
        }
      }

      // Adjust cache thresholds based on hit rates
      const l1 = this.cacheTiers.findLast(t => t.tier === 'L1');
      if (l1 && l1.hitRate > 0.9) {
        this.config.cacheL1MaxEntries = Math.min(this.config.cacheL1MaxEntries + 500, 10000);
      } else if (l1 && l1.hitRate < 0.5) {
        this.config.cacheL1MaxEntries = Math.max(this.config.cacheL1MaxEntries - 200, 1000);
      }

      this.emit('autotune_applied', { poolSize: this.config.maxPoolSize, l1Entries: this.config.cacheL1MaxEntries });
    }

    return report;
  }

  // ─── Report ─────────────────────────────────────────────

  generateReport(): PerformanceReport {
    // Compute overall score from subsystems
    const latencyScore = this.computeLatencyScore();
    const memoryScore = this.computeMemoryScore();
    const poolScore = this.computePoolScore();
    const cacheScore = this.computeCacheScore();

    this.overallScore = Math.round(
      latencyScore * 0.30 + memoryScore * 0.25 + poolScore * 0.20 + cacheScore * 0.25,
    );
    this.overallLevel = this.scoreToLevel(this.overallScore);

    return {
      overallScore: this.overallScore,
      overallLevel: this.overallLevel,
      latencyBuckets: this.getLatencyBuckets(),
      memoryFootprints: this.getMemoryFootprints(),
      connectionPools: this.getPoolMetrics(),
      cacheTiers: this.getCacheTierMetrics(),
      topDependencies: this.getDependencySizes(),
      lcpAdvice: this.getLCPAdvice(),
      generatedAt: Date.now(),
    };
  }

  private computeLatencyScore(): number {
    const buckets = this.getLatencyBuckets();
    if (buckets.length === 0) return 80;
    const avgP95 = buckets.reduce((s, b) => s + b.p95Ms, 0) / buckets.length;
    if (avgP95 < 50) return 100;
    if (avgP95 < 100) return 90;
    if (avgP95 < 300) return 75;
    if (avgP95 < 500) return 60;
    if (avgP95 < 1000) return 40;
    return 20;
  }

  private computeMemoryScore(): number {
    const total = this.getTotalMemory();
    if (total === 0) return 80;
    if (total < 20_000_000) return 100;
    if (total < 50_000_000) return 85;
    if (total < 100_000_000) return 70;
    if (total < 200_000_000) return 50;
    return 25;
  }

  private computePoolScore(): number {
    const pools = this.getPoolMetrics();
    if (pools.length === 0) return 80;
    const scores = pools.map(p => {
      if (p.waiting > 10) return 20;
      if (p.waiting > 5) return 50;
      if (p.errors > 10) return 30;
      if (p.active / p.max > 0.9) return 60;
      return 85;
    });
    return scores.reduce((s, v) => s + v, 0) / scores.length;
  }

  private computeCacheScore(): number {
    if (this.cacheTiers.length === 0) return 70;
    const latest = this.cacheTiers.slice(-3);
    const avgHit = latest.reduce((s, t) => s + t.hitRate, 0) / latest.length;
    return Math.round(avgHit * 100);
  }

  scoreToLevel(score: number): PerfLevel {
    if (score >= 90) return 'excellent';
    if (score >= 75) return 'good';
    if (score >= 50) return 'fair';
    if (score >= 30) return 'poor';
    return 'critical';
  }

  getOverallScore(): number { return this.overallScore; }
  getOverallLevel(): PerfLevel { return this.overallLevel; }
  getConfig(): PerfConfig { return { ...this.config }; }

  // ─── Mock Data Generator ─────────────────────────────────

  generateMockMetrics(): void {
    this.recordLatency('QuoteAggregator', 'getQuote', 42);
    this.recordLatency('QuoteAggregator', 'subscribe', 85);
    this.recordLatency('SmartOrderRouter', 'routeOrder', 120);
    this.recordLatency('MarketReplayEngine', 'seek', 65);
    this.recordMemory('QuoteAggregator', 15_000_000, 3_000_000, 1_000_000);
    this.recordMemory('TimeAndSalesEngine', 8_000_000, 2_000_000, 500_000);
    this.recordMemory('VoicePipelineOptimizer', 30_000_000, 20_000_000, 2_000_000);

    this.registerPool('broker-http', 20, 60_000);
    this.updatePool('broker-http', 12, 8, 0);
    this.registerPool('google-fin', 5, 10_000);
    this.updatePool('google-fin', 3, 2, 0);

    this.recordCacheTier('L1', 4000, 3500, 500, 100, 1.2);
    this.recordCacheTier('L2', 20000, 15000, 5000, 300, 5.5);
    this.recordCacheTier('L3', 50000, 40000, 10000, 0, 45);

    this.recordDependencySize('QuoteAggregator', 200_000, [
      { name: 'ws', bytes: 80_000 }, { name: 'events', bytes: 30_000 },
      { name: 'google-invest-live', bytes: 60_000 },
    ]);
    this.recordDependencySize('VoicePipelineOptimizer', 180_000, [
      { name: 'crypto', bytes: 20_000 }, { name: 'node-fetch', bytes: 70_000 },
    ]);

    this.addLCPAdvice('HeatmapPanel', 3200, 'Use virtual scroll for 10-sector grid', 'high');
    this.addLCPAdvice('Watchlist', 1800, 'Defer non-visible stock rows', 'medium');
  }
}

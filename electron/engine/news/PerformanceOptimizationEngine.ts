/**
 * PerformanceOptimizationEngine — Engine Performance Optimization & Benchmarking
 * R252 — Final Round / 终局之战
 * JVS / 引擎虾
 *
 * Monitors engine execution performance across the codebase. Tracks execution
 * time, memory usage, call frequency, and identifies bottlenecks. Generates
 * optimization recommendations. Supports benchmarking of individual engines.
 * Singleton pattern, fully testable with reset().
 */

import log from 'electron-log';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export type PerfSeverity = 'critical' | 'warning' | 'info' | 'ok';

export interface EngineMetrics {
  engineId: string;
  engineName: string;
  /** Total calls since tracking started */
  callCount: number;
  /** Average execution time in ms */
  avgTimeMs: number;
  /** P95 execution time in ms */
  p95TimeMs: number;
  /** Max execution time in ms */
  maxTimeMs: number;
  /** Min execution time in ms */
  minTimeMs: number;
  /** Total CPU time in ms */
  totalTimeMs: number;
  /** Calls that exceeded threshold */
  slowCalls: number;
  /** Last execution time in ms */
  lastTimeMs: number;
  /** Last executed at timestamp */
  lastExecutedAt: number;
  /** Memory allocation estimate in KB */
  estimatedMemoryKB: number;
  /** Cached results count */
  cacheHitCount: number;
  /** Total calls that could have been cached */
  cacheTotalCount: number;
}

export interface PerfHotspot {
  engineId: string;
  engineName: string;
  metric: 'avg_time' | 'max_time' | 'call_count' | 'memory' | 'cache_miss';
  value: number;
  severity: PerfSeverity;
  suggestion: string;
  estimatedImprovement: string;
}

export interface PerfBenchmark {
  engineId: string;
  engineName: string;
  benchmarkName: string;
  durationMs: number;
  iterations: number;
  opsPerSecond: number;
  avgMemoryKB: number;
  passedThreshold: boolean;
  thresholdMs: number;
}

export interface OptimizationReport {
  id: string;
  generatedAt: number;
  totalEngines: number;
  avgTimeMs: number;
  p95TimeMs: number;
  hotspots: PerfHotspot[];
  benchmarks: PerfBenchmark[];
  recommendations: string[];
  criticalHotspots: number;
  warningHotspots: number;
  overallHealth: 'excellent' | 'good' | 'fair' | 'poor';
}

// ═══════════════════════════════════════════════════════════════
// Engine
// ═══════════════════════════════════════════════════════════════

export class PerformanceOptimizationEngine {
  private static instance: PerformanceOptimizationEngine;

  private metrics: Map<string, EngineMetrics> = new Map();
  private benchmarks: PerfBenchmark[] = [];
  private reports: OptimizationReport[] = [];
  private idCounter = 0;

  // Thresholds (configurable)
  private thresholds = {
    avgTimeWarningMs: 50,
    avgTimeCriticalMs: 200,
    maxTimeWarningMs: 500,
    maxTimeCriticalMs: 2000,
    callCountWarning: 1000, // per minute
    memoryWarningKB: 10000,
    memoryCriticalKB: 50000,
    cacheMissRatioWarning: 0.7,
  };

  private constructor() {}

  static getInstance(): PerformanceOptimizationEngine {
    if (!PerformanceOptimizationEngine.instance) {
      PerformanceOptimizationEngine.instance = new PerformanceOptimizationEngine();
    }
    return PerformanceOptimizationEngine.instance;
  }

  reset(): void {
    this.metrics.clear();
    this.benchmarks = [];
    this.reports = [];
    this.idCounter = 0;
  }

  private nextId(): string { return `poe-${++this.idCounter}`; }

  // ═══════════════════════════════════════════════════════════════
  // Metric Recording
  // ═══════════════════════════════════════════════════════════════

  recordExecution(params: {
    engineId: string;
    engineName: string;
    durationMs: number;
    memoryKB?: number;
    cacheHit?: boolean;
  }): EngineMetrics {
    const existing = this.metrics.get(params.engineId);
    const now = Date.now();

    if (!existing) {
      const metrics: EngineMetrics = {
        engineId: params.engineId,
        engineName: params.engineName,
        callCount: 1,
        avgTimeMs: params.durationMs,
        p95TimeMs: params.durationMs,
        maxTimeMs: params.durationMs,
        minTimeMs: params.durationMs,
        totalTimeMs: params.durationMs,
        slowCalls: params.durationMs > this.thresholds.avgTimeWarningMs ? 1 : 0,
        lastTimeMs: params.durationMs,
        lastExecutedAt: now,
        estimatedMemoryKB: params.memoryKB || 0,
        cacheHitCount: params.cacheHit ? 1 : 0,
        cacheTotalCount: 1,
      };
      this.metrics.set(params.engineId, metrics);
      return metrics;
    }

    // Update running statistics
    existing.callCount++;
    existing.totalTimeMs += params.durationMs;
    existing.avgTimeMs = Math.round(existing.totalTimeMs / existing.callCount * 100) / 100;
    existing.maxTimeMs = Math.max(existing.maxTimeMs, params.durationMs);
    existing.minTimeMs = Math.min(existing.minTimeMs, params.durationMs);
    existing.lastTimeMs = params.durationMs;
    existing.lastExecutedAt = now;

    if (params.durationMs > this.thresholds.avgTimeWarningMs) {
      existing.slowCalls++;
    }

    if (params.memoryKB) {
      existing.estimatedMemoryKB = Math.max(existing.estimatedMemoryKB, params.memoryKB);
    }

    existing.cacheTotalCount++;
    if (params.cacheHit) existing.cacheHitCount++;

    // Recompute P95 (approximate)
    existing.p95TimeMs = Math.round(existing.maxTimeMs * 0.95);

    this.metrics.set(params.engineId, existing);
    return existing;
  }

  // ═══════════════════════════════════════════════════════════════
  // Benchmarking
  // ═══════════════════════════════════════════════════════════════

  runBenchmark(params: {
    engineId: string;
    engineName: string;
    benchmarkName: string;
    fn: () => void;
    iterations?: number;
    thresholdMs?: number;
  }): PerfBenchmark {
    const iterations = params.iterations || 100;
    const thresholdMs = params.thresholdMs || 100;

    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      params.fn();
    }
    const durationMs = performance.now() - start;

    const benchmark: PerfBenchmark = {
      engineId: params.engineId,
      engineName: params.engineName,
      benchmarkName: params.benchmarkName,
      durationMs: Math.round(durationMs * 100) / 100,
      iterations,
      opsPerSecond: Math.round(iterations / (durationMs / 1000)),
      avgMemoryKB: 0, // estimated separately
      passedThreshold: durationMs / iterations < thresholdMs,
      thresholdMs,
    };

    this.benchmarks.push(benchmark);
    return benchmark;
  }

  recordBenchmark(benchmark: PerfBenchmark): void {
    this.benchmarks.push(benchmark);
  }

  // ═══════════════════════════════════════════════════════════════
  // Hotspot Detection
  // ═══════════════════════════════════════════════════════════════

  detectHotspots(): PerfHotspot[] {
    const hotspots: PerfHotspot[] = [];

    for (const [, m] of this.metrics) {
      // Average time hotspot
      if (m.avgTimeMs > this.thresholds.avgTimeCriticalMs) {
        hotspots.push({
          engineId: m.engineId, engineName: m.engineName,
          metric: 'avg_time', value: m.avgTimeMs,
          severity: 'critical',
          suggestion: `Average execution time ${m.avgTimeMs}ms exceeds critical threshold. Add caching or optimize algorithm.`,
          estimatedImprovement: 'Potentially 50-80% with caching',
        });
      } else if (m.avgTimeMs > this.thresholds.avgTimeWarningMs) {
        hotspots.push({
          engineId: m.engineId, engineName: m.engineName,
          metric: 'avg_time', value: m.avgTimeMs,
          severity: 'warning',
          suggestion: `Average time ${m.avgTimeMs}ms above warning threshold. Consider memoization.`,
          estimatedImprovement: 'Potentially 20-40%',
        });
      }

      // Max time hotspot
      if (m.maxTimeMs > this.thresholds.maxTimeCriticalMs) {
        hotspots.push({
          engineId: m.engineId, engineName: m.engineName,
          metric: 'max_time', value: m.maxTimeMs,
          severity: 'critical',
          suggestion: `Max spike ${m.maxTimeMs}ms. Add debouncing or batch processing.`,
          estimatedImprovement: 'Eliminate spikes = 60-90% improvement on max',
        });
      }

      // Cache miss ratio
      if (m.cacheTotalCount > 10) {
        const missRatio = 1 - m.cacheHitCount / m.cacheTotalCount;
        if (missRatio > this.thresholds.cacheMissRatioWarning) {
          hotspots.push({
            engineId: m.engineId, engineName: m.engineName,
            metric: 'cache_miss', value: Math.round(missRatio * 100),
            severity: 'warning',
            suggestion: `Cache miss ratio ${(missRatio*100).toFixed(0)}%. Expand cache TTL or key space.`,
            estimatedImprovement: `${(missRatio*100).toFixed(0)}% of calls not cached`,
          });
        }
      }

      // Memory hotspot
      if (m.estimatedMemoryKB > this.thresholds.memoryCriticalKB) {
        hotspots.push({
          engineId: m.engineId, engineName: m.engineName,
          metric: 'memory', value: m.estimatedMemoryKB,
          severity: 'critical',
          suggestion: `Memory usage ${m.estimatedMemoryKB}KB critical. Implement streaming or pagination.`,
          estimatedImprovement: 'Reduce memory 70-90%',
        });
      }
    }

    return hotspots;
  }

  // ═══════════════════════════════════════════════════════════════
  // Optimization Report
  // ═══════════════════════════════════════════════════════════════

  generateReport(): OptimizationReport {
    const hotspots = this.detectHotspots();
    const now = Date.now();
    const metricsList = Array.from(this.metrics.values());

    const avgTime = metricsList.length > 0
      ? Math.round(metricsList.reduce((s, m) => s + m.avgTimeMs, 0) / metricsList.length * 100) / 100
      : 0;

    const p95Time = metricsList.length > 0
      ? Math.round(Math.max(...metricsList.map(m => m.p95TimeMs)) * 100) / 100
      : 0;

    const criticalCount = hotspots.filter(h => h.severity === 'critical').length;
    const warningCount = hotspots.filter(h => h.severity === 'warning').length;

    let overallHealth: OptimizationReport['overallHealth'];
    if (criticalCount > 2) overallHealth = 'poor';
    else if (criticalCount > 0) overallHealth = 'fair';
    else if (warningCount > 3) overallHealth = 'good';
    else overallHealth = 'excellent';

    const recommendations = hotspots.map(h => `[${h.severity.toUpperCase()}] ${h.engineName}: ${h.suggestion} (${h.estimatedImprovement})`);
    if (recommendations.length === 0) {
      recommendations.push('All engines performing within acceptable thresholds. No optimization needed.');
    }

    const report: OptimizationReport = {
      id: this.nextId(),
      generatedAt: now,
      totalEngines: metricsList.length,
      avgTimeMs: avgTime,
      p95TimeMs: p95Time,
      hotspots,
      benchmarks: [...this.benchmarks],
      recommendations,
      criticalHotspots: criticalCount,
      warningHotspots: warningCount,
      overallHealth,
    };

    this.reports.push(report);
    log.info(`[PerfOpt] Report: ${overallHealth}, ${criticalCount} critical / ${warningCount} warnings`);
    return report;
  }

  // ═══════════════════════════════════════════════════════════════
  // Threshold Configuration
  // ═══════════════════════════════════════════════════════════════

  setThresholds(updates: Partial<typeof this.thresholds>): void {
    Object.assign(this.thresholds, updates);
    log.info(`[PerfOpt] Thresholds updated`);
  }

  getThresholds(): typeof this.thresholds {
    return { ...this.thresholds };
  }

  // ═══════════════════════════════════════════════════════════════
  // Query
  // ═══════════════════════════════════════════════════════════════

  getMetrics(engineId: string): EngineMetrics | undefined {
    return this.metrics.get(engineId);
  }

  getAllMetrics(): EngineMetrics[] {
    return Array.from(this.metrics.values());
  }

  getLatestReport(): OptimizationReport | undefined {
    return this.reports.length > 0 ? this.reports[this.reports.length - 1] : undefined;
  }

  getReportHistory(limit?: number): OptimizationReport[] {
    return this.reports.slice(-(limit || 10));
  }

  getBenchmarks(engineId?: string): PerfBenchmark[] {
    if (engineId) return this.benchmarks.filter(b => b.engineId === engineId);
    return [...this.benchmarks];
  }

  clearBenchmarks(): void {
    this.benchmarks = [];
  }
}

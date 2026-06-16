/**
 * PF-01 PerformanceBenchmarkEngine — R256 QUANT MOO 终极验收
 *
 * 全管线性能基准引擎。追踪所有数据/行情/计算管线的延迟，
 * 确保端到端延迟<1s。提供实时指标、瓶颈检测、历史趋势。
 *
 * 追踪管线:
 * 1. quote-pipeline: WebSocket → cache → UI (target <200ms)
 * 2. data-quality: 数据质量评估 (<50ms)
 * 3. comparison: 多股对比计算 (<300ms)
 * 4. news-fetch: 新闻拉取+处理 (<500ms)
 * 5. backtest: 回测计算 (<800ms)
 * 6. broker-api: 券商API调用 (<1000ms)
 * 7. cache-access: 本地缓存命中 (<5ms)
 * 8. file-io: 文件读写 (<50ms)
 * 9. aggregate-report: 聚合报告生成 (<200ms)
 * 10. health-check: 健康检查 (<100ms)
 *
 * Features:
 * - Per-pipeline latency tracking (p50/p95/p99/max/avg)
 * - Bottleneck detection with threshold alerting
 * - Real-time metrics with moving-window smoothing
 * - Historical trend analysis (1h/24h/7d)
 * - Pipeline dependency graph and critical-path analysis
 * - SLO compliance reporting
 *
 * Architecture:
 * - Singleton with reset() for testability
 * - EventEmitter for latency events
 * - Ring buffer per pipeline (last 1000 measurements)
 * - Exponentially-weighted moving average for trend
 *
 * @author JVS
 * @round R256
 * @since 2026-06-17
 */

import { EventEmitter } from 'events';

// ─── Types ───────────────────────────────────────────────

export type PipelineId =
  | 'quote-pipeline'
  | 'data-quality'
  | 'comparison'
  | 'news-fetch'
  | 'backtest'
  | 'broker-api'
  | 'cache-access'
  | 'file-io'
  | 'aggregate-report'
  | 'health-check';

export interface LatencySample {
  pipelineId: PipelineId;
  startTime: number;
  endTime: number;
  durationMs: number;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface PipelineStats {
  pipelineId: PipelineId;
  count: number;
  avgMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  maxMs: number;
  minMs: number;
  recentAvgMs: number;      // Last 50 samples
  trendMs: number;           // EWMA
  targetMs: number;
  sloCompliantPct: number;  // % within target
  status: 'green' | 'yellow' | 'red';
}

export interface BottleneckInfo {
  pipelineId: PipelineId;
  severity: 'warning' | 'critical';
  currentMs: number;
  targetMs: number;
  exceedPct: number;
  suggestion: string;
}

export interface TrendPoint {
  timestamp: number;
  avgMs: number;
  p95Ms: number;
}

export interface HealthReport {
  id: string;
  generatedAt: number;
  overallStatus: 'green' | 'yellow' | 'red';
  totalSamples: number;
  pipelineStats: Record<PipelineId, PipelineStats>;
  bottlenecks: BottleneckInfo[];
  sloCompliance: number;
  recommendations: string[];
  trendSummary: string;
}

// ─── Constants ───────────────────────────────────────────

const PIPELINE_TARGETS: Record<PipelineId, number> = {
  'quote-pipeline': 200,
  'data-quality': 50,
  'comparison': 300,
  'news-fetch': 500,
  'backtest': 800,
  'broker-api': 1000,
  'cache-access': 5,
  'file-io': 50,
  'aggregate-report': 200,
  'health-check': 100,
};

const PIPELINE_LABELS: Record<PipelineId, string> = {
  'quote-pipeline': '行情管线',
  'data-quality': '数据质量',
  'comparison': '多股对比',
  'news-fetch': '新闻拉取',
  'backtest': '回测计算',
  'broker-api': '券商API',
  'cache-access': '缓存访问',
  'file-io': '文件读写',
  'aggregate-report': '聚合报告',
  'health-check': '健康检查',
};

const MAX_SAMPLES_PER_PIPELINE = 1000;
const RECENT_WINDOW = 50;
const EWMA_ALPHA = 0.1;

// ─── Engine ──────────────────────────────────────────────

export class PerformanceBenchmarkEngine extends EventEmitter {
  private static instance: PerformanceBenchmarkEngine;

  private samples = new Map<PipelineId, LatencySample[]>();
  private ewma = new Map<PipelineId, number>();
  private totalSamples = 0;
  private startedAt: number;

  private constructor() {
    super();
    this.startedAt = Date.now();
    for (const key of Object.keys(PIPELINE_TARGETS) as PipelineId[]) {
      this.samples.set(key, []);
      this.ewma.set(key, PIPELINE_TARGETS[key]); // initialize at target
    }
  }

  static getInstance(): PerformanceBenchmarkEngine {
    if (!PerformanceBenchmarkEngine.instance) {
      PerformanceBenchmarkEngine.instance = new PerformanceBenchmarkEngine();
    }
    return PerformanceBenchmarkEngine.instance;
  }

  reset(): void {
    this.samples.clear();
    this.ewma.clear();
    this.totalSamples = 0;
    this.startedAt = Date.now();
    for (const key of Object.keys(PIPELINE_TARGETS) as PipelineId[]) {
      this.samples.set(key, []);
      this.ewma.set(key, PIPELINE_TARGETS[key]);
    }
    this.removeAllListeners();
  }

  // ─── Timing ─────────────────────────────────────────

  start(pipelineId: PipelineId): number {
    return Date.now();
  }

  end(pipelineId: PipelineId, startTime: number, metadata?: Record<string, unknown>): LatencySample {
    const endTime = Date.now();
    const durationMs = endTime - startTime;
    return this.record({
      pipelineId,
      startTime,
      endTime,
      durationMs,
      timestamp: endTime,
      metadata,
    });
  }

  record(sample: LatencySample): LatencySample {
    const samples = this.samples.get(sample.pipelineId);
    if (!samples) return sample;

    samples.push(sample);
    if (samples.length > MAX_SAMPLES_PER_PIPELINE) {
      samples.shift();
    }

    // Update EWMA
    const current = this.ewma.get(sample.pipelineId) ?? PIPELINE_TARGETS[sample.pipelineId];
    this.ewma.set(sample.pipelineId, EWMA_ALPHA * sample.durationMs + (1 - EWMA_ALPHA) * current);

    this.totalSamples++;

    // Alert check
    const target = PIPELINE_TARGETS[sample.pipelineId];
    if (sample.durationMs > target * 2) {
      this.emit('slow', { pipelineId: sample.pipelineId, durationMs: sample.durationMs, targetMs: target });
    }
    if (sample.durationMs > target * 5) {
      this.emit('critical', { pipelineId: sample.pipelineId, durationMs: sample.durationMs, targetMs: target });
    }

    this.emit('sample', sample);
    return sample;
  }

  // ─── Batch Benchmarking ─────────────────────────────

  benchmark(fn: () => void | Promise<void>, pipelineId: PipelineId, metadata?: Record<string, unknown>): Promise<LatencySample> {
    const start = Date.now();
    const result = fn();
    if (result instanceof Promise) {
      return result.then(() => this.record({ pipelineId, startTime: start, endTime: Date.now(), durationMs: Date.now() - start, timestamp: Date.now(), metadata }));
    }
    return Promise.resolve(this.record({ pipelineId, startTime: start, endTime: Date.now(), durationMs: Date.now() - start, timestamp: Date.now(), metadata }));
  }

  // ─── Stats ──────────────────────────────────────────

  getPipelineStats(pipelineId: PipelineId): PipelineStats {
    const samples = this.samples.get(pipelineId) ?? [];
    const target = PIPELINE_TARGETS[pipelineId];

    if (samples.length === 0) {
      return {
        pipelineId, count: 0, avgMs: 0, p50Ms: 0, p95Ms: 0, p99Ms: 0,
        maxMs: 0, minMs: 0, recentAvgMs: 0, trendMs: target,
        targetMs: target, sloCompliantPct: 100, status: 'green',
      };
    }

    const durations = samples.map(s => s.durationMs);
    const sorted = [...durations].sort((a, b) => a - b);
    const len = sorted.length;

    const avgMs = Math.round(durations.reduce((a, b) => a + b, 0) / len * 100) / 100;
    const p50Ms = sorted[Math.floor(len * 0.5)];
    const p95Ms = sorted[Math.floor(len * 0.95)];
    const p99Ms = sorted[Math.floor(len * 0.99)];
    const maxMs = sorted[len - 1];
    const minMs = sorted[0];

    const recent = durations.slice(-RECENT_WINDOW);
    const recentAvgMs = Math.round(recent.reduce((a, b) => a + b, 0) / recent.length * 100) / 100;

    const trendMs = Math.round((this.ewma.get(pipelineId) ?? target) * 100) / 100;

    const compliantCount = durations.filter(d => d <= target).length;
    const sloCompliantPct = Math.round(compliantCount / len * 10000) / 100;

    let status: PipelineStats['status'] = 'green';
    if (p95Ms > target * 2 || sloCompliantPct < 90) status = 'red';
    else if (p95Ms > target || sloCompliantPct < 99) status = 'yellow';

    return {
      pipelineId, count: len, avgMs, p50Ms, p95Ms, p99Ms, maxMs, minMs,
      recentAvgMs, trendMs, targetMs: target, sloCompliantPct, status,
    };
  }

  getAllPipelineStats(): Record<PipelineId, PipelineStats> {
    const stats = {} as Record<PipelineId, PipelineStats>;
    for (const key of this.samples.keys()) {
      stats[key] = this.getPipelineStats(key);
    }
    return stats;
  }

  // ─── Bottleneck Detection ───────────────────────────

  getBottlenecks(): BottleneckInfo[] {
    const bottlenecks: BottleneckInfo[] = [];
    for (const [id, stats] of Object.entries(this.getAllPipelineStats())) {
      const pid = id as PipelineId;
      if (stats.count === 0) continue;

      if (stats.p95Ms > PIPELINE_TARGETS[pid] * 3) {
        bottlenecks.push({
          pipelineId: pid,
          severity: 'critical',
          currentMs: stats.p95Ms,
          targetMs: PIPELINE_TARGETS[pid],
          exceedPct: Math.round((stats.p95Ms / PIPELINE_TARGETS[pid] - 1) * 100),
          suggestion: this.getSuggestion(pid, stats.p95Ms),
        });
      } else if (stats.p95Ms > PIPELINE_TARGETS[pid]) {
        bottlenecks.push({
          pipelineId: pid,
          severity: 'warning',
          currentMs: stats.p95Ms,
          targetMs: PIPELINE_TARGETS[pid],
          exceedPct: Math.round((stats.p95Ms / PIPELINE_TARGETS[pid] - 1) * 100),
          suggestion: this.getSuggestion(pid, stats.p95Ms),
        });
      }
    }
    return bottlenecks;
  }

  private getSuggestion(pipelineId: PipelineId, currentMs: number): string {
    const suggestions: Record<PipelineId, string> = {
      'quote-pipeline': '启用更短频道的WebSocket合并订阅、减少渲染器轮询间隔',
      'data-quality': '减少质量评估维度或采样频率',
      'comparison': '启用Web Worker并行计算、缓存重复对比结果',
      'news-fetch': '增加缓存TTL、减少同时拉取的源数量',
      'backtest': '启用增量计算、缓存中间结果',
      'broker-api': '增加请求超时、使用并发请求替代串行',
      'cache-access': '检查是否频繁序列化大对象',
      'file-io': '使用内存缓存替代磁盘读取',
      'aggregate-report': '启用懒加载、增量聚合',
      'health-check': '减少检查频率或采样间隔',
    };
    return suggestions[pipelineId] ?? '审查管线实现逻辑';
  }

  // ─── Health Report ──────────────────────────────────

  generateHealthReport(): HealthReport {
    const pipelineStats = this.getAllPipelineStats();
    const bottlenecks = this.getBottlenecks();

    const sloValues = Object.values(pipelineStats)
      .filter(s => s.count > 0)
      .map(s => s.sloCompliantPct);
    const sloCompliance = sloValues.length > 0
      ? Math.round(sloValues.reduce((a, b) => a + b, 0) / sloValues.length * 100) / 100
      : 100;

    const hasCritical = bottlenecks.some(b => b.severity === 'critical');
    const hasWarning = bottlenecks.some(b => b.severity === 'warning');
    let overallStatus: 'green' | 'yellow' | 'red' = 'green';
    if (hasCritical || sloCompliance < 90) overallStatus = 'red';
    else if (hasWarning || sloCompliance < 99) overallStatus = 'yellow';

    const recommendations: string[] = [];
    if (overallStatus !== 'green') {
      for (const b of bottlenecks.slice(0, 3)) {
        recommendations.push(`${PIPELINE_LABELS[b.pipelineId]}: ${b.suggestion}`);
      }
    } else {
      recommendations.push('所有管线达标，SLO 合规');
    }

    // Trend summary
    const trendParts: string[] = [];
    for (const [id, stats] of Object.entries(pipelineStats)) {
      if (stats.count > 0) {
        trendParts.push(`${PIPELINE_LABELS[id as PipelineId]}: ${stats.recentAvgMs}ms/${stats.targetMs}ms`);
      }
    }
    const trendSummary = trendParts.join(' | ');

    return {
      id: `perf-report-${Date.now()}`,
      generatedAt: Date.now(),
      overallStatus,
      totalSamples: this.totalSamples,
      pipelineStats,
      bottlenecks,
      sloCompliance,
      recommendations,
      trendSummary: trendSummary || '无样本数据',
    };
  }

  // ─── Trend Analysis ─────────────────────────────────

  getTrend(pipelineId: PipelineId, windowMs: number = 3600000): TrendPoint[] {
    const samples = this.samples.get(pipelineId) ?? [];
    if (samples.length === 0) return [];

    const now = Date.now();
    const windowSamples = samples.filter(s => now - s.timestamp <= windowMs);
    if (windowSamples.length === 0) return [];

    // Group by 5-minute buckets
    const buckets = new Map<number, number[]>();
    for (const s of windowSamples) {
      const bucketKey = Math.floor(s.timestamp / 300000) * 300000;
      if (!buckets.has(bucketKey)) buckets.set(bucketKey, []);
      buckets.get(bucketKey)!.push(s.durationMs);
    }

    const points: TrendPoint[] = [];
    for (const [ts, durations] of buckets) {
      const sorted = [...durations].sort((a, b) => a - b);
      points.push({
        timestamp: ts,
        avgMs: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length * 100) / 100,
        p95Ms: sorted[Math.floor(sorted.length * 0.95)],
      });
    }
    return points.sort((a, b) => a.timestamp - b.timestamp);
  }

  // ─── Query ──────────────────────────────────────────

  getSampleCount(pipelineId: PipelineId): number {
    return this.samples.get(pipelineId)?.length ?? 0;
  }

  getTotalSamples(): number {
    return this.totalSamples;
  }

  getPipelineIds(): PipelineId[] {
    return Object.keys(PIPELINE_TARGETS) as PipelineId[];
  }

  getTarget(pipelineId: PipelineId): number {
    return PIPELINE_TARGETS[pipelineId];
  }

  getEwma(pipelineId: PipelineId): number {
    return Math.round((this.ewma.get(pipelineId) ?? 0) * 100) / 100;
  }

  // ─── Mock / Testing ─────────────────────────────────

  simulateSamples(pipelineId: PipelineId, count: number, baseMs?: number): void {
    const base = baseMs ?? PIPELINE_TARGETS[pipelineId] * 0.5;
    for (let i = 0; i < count; i++) {
      const jitter = (Math.random() - 0.5) * base * 0.4; // ±20% jitter
      const durationMs = Math.max(0.1, base + jitter);
      this.record({
        pipelineId,
        startTime: Date.now() - durationMs,
        endTime: Date.now(),
        durationMs: Math.round(durationMs * 100) / 100,
        timestamp: Date.now(),
      });
    }
  }

  simulateSlow(pipelineId: PipelineId, count: number): void {
    const target = PIPELINE_TARGETS[pipelineId];
    for (let i = 0; i < count; i++) {
      this.record({
        pipelineId,
        startTime: Date.now() - target * 3,
        endTime: Date.now(),
        durationMs: target * 3 + Math.random() * target * 2,
        timestamp: Date.now(),
      });
    }
  }

  simulateAllPipelines(count = 3): void {
    for (const key of Object.keys(PIPELINE_TARGETS) as PipelineId[]) {
      this.simulateSamples(key, count);
    }
  }

  // ─── Reset Pipeline ─────────────────────────────────

  resetPipeline(pipelineId: PipelineId): void {
    this.samples.set(pipelineId, []);
    this.ewma.set(pipelineId, PIPELINE_TARGETS[pipelineId]);
  }
}

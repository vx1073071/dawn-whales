/**
 * Prometheus-Compatible Metrics Collector
 * 
 * Pure TypeScript implementation of Prometheus metric types
 * with text exposition format output. No external dependencies.
 */

import log from 'electron-log';
import { EngineError } from './engine-error';

// ─── Types ──────────────────────────────────────────────────────────────────

type MetricType = 'counter' | 'gauge' | 'histogram' | 'summary';

interface Labels {
  [key: string]: string;
}

interface MetricConfig {
  name: string;
  help: string;
  type: MetricType;
  labels?: string[];
  buckets?: number[];
  percentiles?: number[];
  maxAge?: number;
  ageBuckets?: number;
}

interface MetricSample {
  value: number;
  labels: Labels;
  timestamp?: number;
}

interface HistogramBucket {
  le: number;
  count: number;
}

interface HistogramData {
  buckets: HistogramBucket[];
  sum: number;
  count: number;
}

interface SummaryData {
  quantiles: Map<number, number>;
  sum: number;
  count: number;
  observations: number[];
}

// ─── Base Metric Class ──────────────────────────────────────────────────────

abstract class BaseMetric {
  readonly name: string;
  readonly help: string;
  readonly type: MetricType;
  readonly labelNames: string[];

  constructor(config: MetricConfig) {
    this.name = config.name;
    this.help = config.help;
    this.type = config.type;
    this.labelNames = config.labels ?? [];
  }

  protected labelsToKey(labels: Labels): string {
    if (this.labelNames.length === 0) return '';
    return this.labelNames
      .filter((k) => labels[k] !== undefined)
      .map((k) => `${k}="${labels[k]}"`)
      .join(',');
  }

  protected formatLabels(labels: Labels): string {
    const parts = Object.entries(labels)
      .filter(([_, v]) => v !== undefined)
      .map(([k, v]) => `${k}="${this.escapeLabel(v)}"`);
    return parts.length > 0 ? `{${parts.join(',')}}` : '';
  }

  private escapeLabel(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
  }

  abstract collect(): string[];
  abstract reset(): void;
}

// ─── Counter ────────────────────────────────────────────────────────────────

export class Counter extends BaseMetric {
  private values: Map<string, { value: number; labels: Labels }> = new Map();

  constructor(config: MetricConfig) {
    super({ ...config, type: 'counter' });
  }

  inc(labels: Labels = {}, value: number = 1): void {
    if (value < 0) {
      log.warn(`[Metrics] Counter ${this.name}: cannot decrement`);
      return;
    }
    const key = this.labelsToKey(labels);
    const existing = this.values.get(key);
    if (existing) {
      existing.value += value;
    } else {
      this.values.set(key, { value, labels });
    }
  }

  get(labels: Labels = {}): number {
    const key = this.labelsToKey(labels);
    return this.values.get(key)?.value ?? 0;
  }

  collect(): string[] {
    const lines: string[] = [
      `# HELP ${this.name} ${this.help}`,
      `# TYPE ${this.name} counter`,
    ];
    for (const { value, labels } of this.values.values()) {
      lines.push(`${this.name}${this.formatLabels(labels)} ${value}`);
    }
    return lines;
  }

  reset(): void {
    this.values.clear();
  }
}

// ─── Gauge ──────────────────────────────────────────────────────────────────

export class Gauge extends BaseMetric {
  private values: Map<string, { value: number; labels: Labels }> = new Map();

  constructor(config: MetricConfig) {
    super({ ...config, type: 'gauge' });
  }

  set(value: number, labels: Labels = {}): void {
    const key = this.labelsToKey(labels);
    this.values.set(key, { value, labels });
  }

  inc(labels: Labels = {}, value: number = 1): void {
    const key = this.labelsToKey(labels);
    const existing = this.values.get(key);
    if (existing) {
      existing.value += value;
    } else {
      this.values.set(key, { value, labels });
    }
  }

  dec(labels: Labels = {}, value: number = 1): void {
    this.inc(labels, -value);
  }

  get(labels: Labels = {}): number {
    const key = this.labelsToKey(labels);
    return this.values.get(key)?.value ?? 0;
  }

  collect(): string[] {
    const lines: string[] = [
      `# HELP ${this.name} ${this.help}`,
      `# TYPE ${this.name} gauge`,
    ];
    for (const { value, labels } of this.values.values()) {
      lines.push(`${this.name}${this.formatLabels(labels)} ${value}`);
    }
    return lines;
  }

  reset(): void {
    this.values.clear();
  }
}

// ─── Histogram ──────────────────────────────────────────────────────────────

const DEFAULT_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

export class Histogram extends BaseMetric {
  private buckets: number[];
  private data: Map<string, { hist: HistogramData; labels: Labels }> = new Map();

  constructor(config: MetricConfig) {
    super({ ...config, type: 'histogram' });
    this.buckets = [...(config.buckets ?? DEFAULT_BUCKETS)].sort((a, b) => a - b);
  }

  observe(value: number, labels: Labels = {}): void {
    const key = this.labelsToKey(labels);
    let entry = this.data.get(key);
    if (!entry) {
      entry = {
        hist: {
          buckets: this.buckets.map((le) => ({ le, count: 0 })),
          sum: 0,
          count: 0,
        },
        labels,
      };
      this.data.set(key, entry);
    }
    entry.hist.sum += value;
    entry.hist.count++;
    for (const bucket of entry.hist.buckets) {
      if (value <= bucket.le) {
        bucket.count++;
      }
    }
  }

  startTimer(labels: Labels = {}): () => number {
    const start = process.hrtime.bigint();
    return () => {
      const duration = Number(process.hrtime.bigint() - start) / 1e9;
      this.observe(duration, labels);
      return duration;
    };
  }

  collect(): string[] {
    const lines: string[] = [
      `# HELP ${this.name} ${this.help}`,
      `# TYPE ${this.name} histogram`,
    ];
    for (const { hist, labels } of this.data.values()) {
      const labelStr = this.formatLabels(labels);
      let cumulative = 0;
      for (const bucket of hist.buckets) {
        cumulative = bucket.count; // already cumulative from observe logic
        const bLabels = { ...labels, le: String(bucket.le) };
        lines.push(`${this.name}_bucket${this.formatLabels(bLabels)} ${cumulative}`);
      }
      const infLabels = { ...labels, le: '+Inf' };
      lines.push(`${this.name}_bucket${this.formatLabels(infLabels)} ${hist.count}`);
      lines.push(`${this.name}_sum${labelStr} ${hist.sum}`);
      lines.push(`${this.name}_count${labelStr} ${hist.count}`);
    }
    return lines;
  }

  reset(): void {
    this.data.clear();
  }
}

// ─── Summary ────────────────────────────────────────────────────────────────

const DEFAULT_PERCENTILES = [0.5, 0.9, 0.95, 0.99];

export class Summary extends BaseMetric {
  private percentiles: number[];
  private data: Map<string, { summary: SummaryData; labels: Labels }> = new Map();
  private maxObservations: number;

  constructor(config: MetricConfig) {
    super({ ...config, type: 'summary' });
    this.percentiles = config.percentiles ?? DEFAULT_PERCENTILES;
    this.maxObservations = config.maxAge ?? 10000;
  }

  observe(value: number, labels: Labels = {}): void {
    const key = this.labelsToKey(labels);
    let entry = this.data.get(key);
    if (!entry) {
      entry = {
        summary: {
          quantiles: new Map(),
          sum: 0,
          count: 0,
          observations: [],
        },
        labels,
      };
      this.data.set(key, entry);
    }

    entry.summary.sum += value;
    entry.summary.count++;
    entry.summary.observations.push(value);

    // Keep observations bounded
    if (entry.summary.observations.length > this.maxObservations) {
      entry.summary.observations.shift();
    }

    this.computeQuantiles(entry.summary);
  }

  private computeQuantiles(summary: SummaryData): void {
    const sorted = [...summary.observations].sort((a, b) => a - b);
    for (const p of this.percentiles) {
      const idx = Math.ceil(p * sorted.length) - 1;
      summary.quantiles.set(p, sorted[Math.max(0, idx)]);
    }
  }

  startTimer(labels: Labels = {}): () => number {
    const start = process.hrtime.bigint();
    return () => {
      const duration = Number(process.hrtime.bigint() - start) / 1e9;
      this.observe(duration, labels);
      return duration;
    };
  }

  collect(): string[] {
    const lines: string[] = [
      `# HELP ${this.name} ${this.help}`,
      `# TYPE ${this.name} summary`,
    ];
    for (const { summary, labels } of this.data.values()) {
      const labelStr = this.formatLabels(labels);
      for (const [quantile, value] of summary.quantiles) {
        const qLabels = { ...labels, quantile: String(quantile) };
        lines.push(`${this.name}${this.formatLabels(qLabels)} ${value}`);
      }
      lines.push(`${this.name}_sum${labelStr} ${summary.sum}`);
      lines.push(`${this.name}_count${labelStr} ${summary.count}`);
    }
    return lines;
  }

  reset(): void {
    this.data.clear();
  }
}

// ─── Metrics Registry ───────────────────────────────────────────────────────

export class MetricsRegistry {
  private metrics: Map<string, BaseMetric> = new Map();
  private collectors: Array<() => MetricSample[]> = [];
  private collectionTimestamp: number = 0;

  register(metric: BaseMetric): void {
    if (this.metrics.has(metric.name)) {
      log.warn(`[Metrics] Metric ${metric.name} already registered, replacing`);
    }
    this.metrics.set(metric.name, metric);
    log.debug(`[Metrics] Registered: ${metric.name} (${metric.type})`);
  }

  unregister(name: string): void {
    this.metrics.delete(name);
  }

  getMetric<T extends BaseMetric>(name: string): T | undefined {
    return this.metrics.get(name) as T | undefined;
  }

  getCounter(name: string): Counter {
    let m = this.metrics.get(name);
    if (!m) {
      m = new Counter({ name, help: '', type: 'counter' });
      this.register(m);
    }
    return m as Counter;
  }

  getGauge(name: string): Gauge {
    let m = this.metrics.get(name);
    if (!m) {
      m = new Gauge({ name, help: '', type: 'gauge' });
      this.register(m);
    }
    return m as Gauge;
  }

  getHistogram(name: string, buckets?: number[]): Histogram {
    let m = this.metrics.get(name);
    if (!m) {
      m = new Histogram({ name, help: '', type: 'histogram', buckets });
      this.register(m);
    }
    return m as Histogram;
  }

  getSummary(name: string, percentiles?: number[]): Summary {
    let m = this.metrics.get(name);
    if (!m) {
      m = new Summary({ name, help: '', type: 'summary', percentiles });
      this.register(m);
    }
    return m as Summary;
  }

  registerCollector(fn: () => MetricSample[]): void {
    this.collectors.push(fn);
  }

  collect(): string {
    this.collectionTimestamp = Date.now();
    const allLines: string[] = [];

    for (const metric of this.metrics.values()) {
      allLines.push(...metric.collect());
    }

    allLines.push('');
    return allLines.join('\n');
  }

  resetAll(): void {
    for (const metric of this.metrics.values()) {
      metric.reset();
    }
    log.info('[Metrics] All metrics reset');
  }

  getMetricNames(): string[] {
    return Array.from(this.metrics.keys());
  }

  toJSON(): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [name, metric] of this.metrics) {
      result[name] = {
        type: metric.type,
        help: metric.help,
        lines: metric.collect(),
      };
    }
    return result;
  }
}

// ─── Pre-defined Application Metrics ────────────────────────────────────────

export function createAppMetrics(registry: MetricsRegistry) {
  const ipcRequestsTotal = new Counter({
    name: 'ipc_requests_total',
    help: 'Total number of IPC requests',
    type: 'counter',
    labels: ['handler', 'status'],
  });

  const ipcRequestDuration = new Histogram({
    name: 'ipc_request_duration_seconds',
    help: 'Duration of IPC requests in seconds',
    type: 'histogram',
    labels: ['handler'],
    buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  });

  const activeStrategies = new Gauge({
    name: 'active_strategies',
    help: 'Number of currently active trading strategies',
    type: 'gauge',
  });

  const backtestDuration = new Histogram({
    name: 'backtest_duration_seconds',
    help: 'Duration of backtest runs in seconds',
    type: 'histogram',
    buckets: [1, 5, 10, 30, 60, 120, 300, 600, 1200, 3600],
  });

  const tradeOrdersTotal = new Counter({
    name: 'trade_orders_total',
    help: 'Total number of trade orders',
    type: 'counter',
    labels: ['side', 'status'],
  });

  const marketDataLatency = new Histogram({
    name: 'market_data_latency_ms',
    help: 'Market data feed latency in milliseconds',
    type: 'histogram',
    labels: ['source'],
    buckets: [0.1, 0.5, 1, 2, 5, 10, 25, 50, 100, 250, 500, 1000],
  });

  const websocketConnections = new Gauge({
    name: 'websocket_connections',
    help: 'Number of active WebSocket connections',
    type: 'gauge',
  });

  const memoryUsageBytes = new Gauge({
    name: 'memory_usage_bytes',
    help: 'Memory usage in bytes by type',
    type: 'gauge',
    labels: ['type'],
  });

  // Register all metrics
  registry.register(ipcRequestsTotal);
  registry.register(ipcRequestDuration);
  registry.register(activeStrategies);
  registry.register(backtestDuration);
  registry.register(tradeOrdersTotal);
  registry.register(marketDataLatency);
  registry.register(websocketConnections);
  registry.register(memoryUsageBytes);

  return {
    ipcRequestsTotal,
    ipcRequestDuration,
    activeStrategies,
    backtestDuration,
    tradeOrdersTotal,
    marketDataLatency,
    websocketConnections,
    memoryUsageBytes,
  };
}

// ─── Metrics HTTP Handler (simulated /metrics endpoint) ───────────────────

export function createMetricsHandler(registry: MetricsRegistry) {
  return {
    contentType: 'text/plain; version=0.0.4; charset=utf-8',
    handler: (): string => {
      const output = registry.collect();
      log.debug(`[Metrics] Served /metrics endpoint (${output.length} bytes)`);
      return output;
    },
  };
}

// ─── Convenience: timed decorator-like helper ───────────────────────────────

export async function timedAsync<T>(
  histogram: Histogram,
  labels: Labels,
  fn: () => Promise<T>
): Promise<T> {
  const end = histogram.startTimer(labels);
  try {
    const result = await fn();
    end();
    return result;
  } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
    end();
    void EngineError; // structured error domain: SYSTEM
    throw err;
  }
}

export function timedSync<T>(
  histogram: Histogram,
  labels: Labels,
  fn: () => T
): T {
  const end = histogram.startTimer(labels);
  try {
    const result = fn();
    end();
    return result;
  } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
    end();
    throw err;
  }
}

// ─── System Metrics Collector ───────────────────────────────────────────────

export class SystemMetricsCollector {
  private registry: MetricsRegistry;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(registry: MetricsRegistry) {
    this.registry = registry;
  }

  start(intervalMs: number = 15000): void {
    this.collect(); // initial
    this.timer = setInterval(() => this.collect(), intervalMs);
    log.info(`[Metrics] System metrics collector started (interval=${intervalMs}ms)`);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private collect(): void {
    try {
      if (typeof process !== 'undefined' && process.memoryUsage) {
        const mem = process.memoryUsage();
        const memGauge = this.registry.getGauge('memory_usage_bytes');
        memGauge.set(mem.rss, { type: 'rss' });
        memGauge.set(mem.heapUsed, { type: 'heap_used' });
        memGauge.set(mem.heapTotal, { type: 'heap_total' });
        memGauge.set(mem.external, { type: 'external' });
        if (mem.arrayBuffers) {
          memGauge.set(mem.arrayBuffers, { type: 'array_buffers' });
        }
      }
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      log.error('[Metrics] System metrics collection error:', err);
    }
  }
}

// ─── Singleton Registry ────────────────────────────────────────────────────

let globalRegistry: MetricsRegistry | null = null;

export function getGlobalRegistry(): MetricsRegistry {
  if (!globalRegistry) {
    globalRegistry = new MetricsRegistry();
    createAppMetrics(globalRegistry);
    log.info('[Metrics] Global registry initialized with app metrics');
  }
  return globalRegistry;
}

export function resetGlobalRegistry(): void {
  if (globalRegistry) {
    globalRegistry.resetAll();
    globalRegistry = null;
  }
}

// ─── Default Export ─────────────────────────────────────────────────────────

export default MetricsRegistry;

/**
 * J-79-02: 生产监控管线 F3
 * R76 monitoring 底座扩展: API延迟 P50/P95/P99 + 错误率 + 数据新鲜度
 */

// ── Types ──────────────────────────────────────────────────────────────────

export interface LatencySample {
  endpoint: string;
  method: string;
  durationMs: number;
  statusCode: number;
  timestamp: number;
}

export interface ErrorSample {
  endpoint: string;
  errorType: string;
  message: string;
  count: number;
  lastSeen: number;
}

export interface FreshnessMetric {
  dataSource: string;
  lastUpdate: number;
  staleThresholdMs: number;
  isStale: boolean;
}

export interface MonitoringStats {
  uptime: number;
  requestCount: number;
  errorCount: number;
  errorRate: number;
  latency: {
    p50: number;
    p95: number;
    p99: number;
    avg: number;
    max: number;
  };
  errors: ErrorSample[];
  freshness: FreshnessMetric[];
  memory: {
    heapUsedMB: number;
    heapTotalMB: number;
    rssMB: number;
  };
  timestamp: number;
}

// ── Monitor Engine ─────────────────────────────────────────────────────────

const MAX_SAMPLES = 10000;
const MAX_ERROR_SAMPLES = 1000;

export class ProductionMonitor {
  private latencySamples: LatencySample[] = [];
  private errors = new Map<string, ErrorSample>();
  private freshness = new Map<string, FreshnessMetric>();
  private startTime = Date.now();
  private requestCount = 0;
  private errorCount = 0;

  /** 记录 API 延迟 */
  recordLatency(endpoint: string, method: string, durationMs: number, statusCode: number): void {
    this.requestCount++;
    if (statusCode >= 400) this.errorCount++;

    this.latencySamples.push({
      endpoint, method, durationMs, statusCode,
      timestamp: Date.now(),
    });

    // Keep buffer bounded
    if (this.latencySamples.length > MAX_SAMPLES) {
      this.latencySamples = this.latencySamples.slice(-MAX_SAMPLES / 2);
    }
  }

  /** 记录错误 */
  recordError(endpoint: string, errorType: string, message: string): void {
    this.errorCount++;
    const key = `${endpoint}:${errorType}`;
    const existing = this.errors.get(key);
    if (existing) {
      existing.count++;
      existing.lastSeen = Date.now();
      existing.message = message;
    } else {
      if (this.errors.size >= MAX_ERROR_SAMPLES) {
        // Evict oldest
        const oldest = [...this.errors.entries()].sort((a, b) => a[1].lastSeen - b[1].lastSeen)[0];
        if (oldest) this.errors.delete(oldest[0]);
      }
      this.errors.set(key, {
        endpoint, errorType, message, count: 1, lastSeen: Date.now(),
      });
    }
  }

  /** 更新数据新鲜度 */
  updateFreshness(dataSource: string, lastUpdate: number, staleThresholdMs = 300_000): void {
    const isStale = Date.now() - lastUpdate > staleThresholdMs;
    this.freshness.set(dataSource, {
      dataSource, lastUpdate, staleThresholdMs, isStale,
    });
  }

  /** 计算延迟百分位数 */
  private computePercentile(sorted: number[], pct: number): number {
    if (sorted.length === 0) return 0;
    const idx = Math.ceil((pct / 100) * sorted.length) - 1;
    return sorted[Math.max(0, idx)];
  }

  /** 获取监控统计 */
  getStats(): MonitoringStats {
    const durations = this.latencySamples.map(s => s.durationMs).sort((a, b) => a - b);
    const avgDuration = durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0;

    const mem = process.memoryUsage();
    const uptime = Date.now() - this.startTime;

    return {
      uptime,
      requestCount: this.requestCount,
      errorCount: this.errorCount,
      errorRate: this.requestCount > 0 ? this.errorCount / this.requestCount : 0,
      latency: {
        p50: this.computePercentile(durations, 50),
        p95: this.computePercentile(durations, 95),
        p99: this.computePercentile(durations, 99),
        avg: Math.round(avgDuration * 100) / 100,
        max: durations.length > 0 ? durations[durations.length - 1] : 0,
      },
      errors: [...this.errors.values()]
        .sort((a, b) => b.count - a.count)
        .slice(0, 20),
      freshness: [...this.freshness.values()],
      memory: {
        heapUsedMB: Math.round(mem.heapUsed / 1048576 * 100) / 100,
        heapTotalMB: Math.round(mem.heapTotal / 1048576 * 100) / 100,
        rssMB: Math.round(mem.rss / 1048576 * 100) / 100,
      },
      timestamp: Date.now(),
    };
  }

  /** Express middleware: 自动记录延迟 */
  middleware(): (req: any, res: any, next: () => void) => void {
    return (req: any, res: any, next: () => void) => {
      const start = Date.now();
      const originalEnd = res.end;

      res.end = (...args: any[]) => {
        const duration = Date.now() - start;
        this.recordLatency(
          req.path || req.url || '/',
          req.method || 'GET',
          duration,
          res.statusCode || 200
        );
        return originalEnd.apply(res, args);
      };

      next();
    };
  }

  /** 错误处理器 */
  errorHandler(): (err: Error, req: any, res: any, next: () => void) => void {
    return (err: Error, req: any, _res: any, _next: () => void) => {
      this.recordError(req.path || '/', err.name || 'Error', err.message || 'Unknown error');
      _next();
    };
  }

  /** 重置 (仅测试用) */
  reset(): void {
    this.latencySamples = [];
    this.errors.clear();
    this.freshness.clear();
    this.startTime = Date.now();
    this.requestCount = 0;
    this.errorCount = 0;
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let instance: ProductionMonitor | null = null;

export function getMonitor(): ProductionMonitor {
  if (!instance) instance = new ProductionMonitor();
  return instance;
}

export function resetMonitor(): void {
  instance?.reset();
  instance = null;
}

export default { ProductionMonitor, getMonitor, resetMonitor };

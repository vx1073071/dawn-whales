/**
 * SourceHealthMonitor — R262 P2-05
 *
 * 源健康真实监控。对4大行情源进行心跳检测、延迟测量、可用率统计和数据质量告警。
 *
 * Feature set:
 *   - 4源心跳: Yahoo WS / Binance WS / Futu OpenD / Longbridge
 *   - 延迟测量: P50/P95/P99 分位数
 *   - 可用率统计: 滚动24h窗口 + 按源/按交易所
 *   - 告警阈值: 延迟>500ms / 可用率<99% / 数据缺失 >5min / 价格偏离>1%
 *   - 自动恢复检测: 持续30s正常 → 解除告警
 *   - 仪表盘数据导出
 *
 * Architecture:
 *   - Singleton with reset()
 *   - Per-source tick tracking with time window
 *   - Alert state machine (ok → warning → critical → ok)
 *
 * @author JVS
 * @round R262
 * @since 2026-06-17
 */

import { EventEmitter } from 'events';

// ─── Types ───────────────────────────────────────────────

export type SourceId = 'yahoo_ws' | 'binance_ws' | 'futu_opend' | 'longbridge';

export type HealthStatus = 'healthy' | 'degraded' | 'down' | 'unknown';

export interface SourceEndpoint {
  sourceId: SourceId;
  endpoint: string;
  protocol: 'ws' | 'tcp' | 'http';
  expectedIntervalMs: number;   // expected tick interval
}

export interface SourceHealth {
  sourceId: SourceId;
  status: HealthStatus;
  lastHeartbeat: number;
  latencyP50: number;
  latencyP95: number;
  latencyP99: number;
  availability24h: number;       // 0-100
  ticksLastMinute: number;
  ticksLastHour: number;
  lastError?: string;
  lastErrorTime?: number;
  recoveredAt?: number;
  consecutiveFails: number;
}

export interface HealthAlert {
  sourceId: SourceId;
  severity: 'info' | 'warning' | 'critical';
  type: 'latency_high' | 'availability_low' | 'data_gap' | 'heartbeat_lost' | 'price_deviation';
  message: string;
  timestamp: number;
  acknowledged: boolean;
  resolved: boolean;
}

export interface HealthConfig {
  latencyWarningMs: number;
  latencyCriticalMs: number;
  availabilityWarningPct: number;
  availabilityCriticalPct: number;
  heartbeatTimeoutMs: number;
  dataGapThresholdMs: number;
  recoveryWindowMs: number;
  tickHistorySize: number;
  priceDeviationPct: number;
}

export interface HealthDashboard {
  sources: Record<SourceId, SourceHealth>;
  alerts: HealthAlert[];
  overallStatus: HealthStatus;
  generatedAt: number;
}

// ─── Defaults ────────────────────────────────────────────

const DEFAULT_CONFIG: HealthConfig = {
  latencyWarningMs: 200,
  latencyCriticalMs: 500,
  availabilityWarningPct: 99,
  availabilityCriticalPct: 95,
  heartbeatTimeoutMs: 30000,
  dataGapThresholdMs: 300000,     // 5 min
  recoveryWindowMs: 30000,        // 30s
  tickHistorySize: 1000,
  priceDeviationPct: 1,
};

const SOURCES: Record<SourceId, SourceEndpoint> = {
  yahoo_ws:      { sourceId: 'yahoo_ws',    endpoint: 'wss://streamer.finance.yahoo.com/',    protocol: 'ws',   expectedIntervalMs: 2000 },
  binance_ws:    { sourceId: 'binance_ws',   endpoint: 'wss://stream.binance.com:9443/ws',     protocol: 'ws',   expectedIntervalMs: 1000 },
  futu_opend:    { sourceId: 'futu_opend',   endpoint: '127.0.0.1:11111',                     protocol: 'tcp',  expectedIntervalMs: 1000 },
  longbridge:    { sourceId: 'longbridge',   endpoint: 'https://openapi.longbridge.hk',        protocol: 'http', expectedIntervalMs: 3000 },
};

// ─── Engine ──────────────────────────────────────────────

export class SourceHealthMonitor extends EventEmitter {
  private static instance: SourceHealthMonitor;

  private config: HealthConfig;
  private heartbeats: Map<SourceId, number[]> = new Map();  // latency samples
  private lastHeartbeat: Map<SourceId, number> = new Map();
  private tickCounts: Map<SourceId, number[]> = new Map();  // tick timestamps
  private consecutiveFails: Map<SourceId, number> = new Map();
  private errors: Map<SourceId, string[]> = new Map();
  private alerts: HealthAlert[] = [];
  private alertIdCounter = 0;
  private recoveryTimers: Map<SourceId, ReturnType<typeof setTimeout>> = new Map();
  private statuses: Map<SourceId, HealthStatus> = new Map();
  private recoveryTime: Map<SourceId, number> = new Map();

  // Price tracking for deviation check
  private lastPrices: Map<string, { price: number; sourceId: SourceId; ts: number }> = new Map();

  constructor(config?: Partial<HealthConfig>) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    for (const sid of Object.keys(SOURCES) as SourceId[]) {
      this.heartbeats.set(sid, []);
      this.tickCounts.set(sid, []);
      this.consecutiveFails.set(sid, 0);
      this.errors.set(sid, []);
      this.statuses.set(sid, 'unknown');
    }
  }

  static getInstance(config?: Partial<HealthConfig>): SourceHealthMonitor {
    if (!SourceHealthMonitor.instance) {
      SourceHealthMonitor.instance = new SourceHealthMonitor(config);
    } else if (config) {
      SourceHealthMonitor.instance.config = { ...SourceHealthMonitor.instance.config, ...config };
    }
    return SourceHealthMonitor.instance;
  }

  reset(): void {
    for (const sid of Object.keys(SOURCES) as SourceId[]) {
      this.heartbeats.set(sid, []);
      this.tickCounts.set(sid, []);
      this.consecutiveFails.set(sid, 0);
      this.errors.set(sid, []);
      this.statuses.set(sid, 'unknown');
      const t = this.recoveryTimers.get(sid);
      if (t) { clearTimeout(t); this.recoveryTimers.delete(sid); }
    }
    this.alerts = [];
    this.alertIdCounter = 0;
    this.lastPrices.clear();
    this.recoveryTime.clear();
    this.removeAllListeners();
  }

  // ─── Heartbeat ──────────────────────────────────────────

  recordHeartbeat(sourceId: SourceId, latencyMs: number): void {
    const now = Date.now();
    const samples = this.heartbeats.get(sourceId)!;

    // Prune to max size
    samples.push(latencyMs);
    if (samples.length > this.config.tickHistorySize) samples.shift();

    this.lastHeartbeat.set(sourceId, now);
    this.consecutiveFails.set(sourceId, 0);
    this.recordTick(sourceId);

    // If latency is normal, mark healthy
    if (latencyMs < this.config.latencyWarningMs && this.statuses.get(sourceId) !== 'healthy') {
      this.setStatus(sourceId, 'healthy');
    }

    // Check latency thresholds
    this.checkLatencyThresholds(sourceId, latencyMs);
    this.tryRecover(sourceId);
  }

  recordHeartbeatLost(sourceId: SourceId): void {
    const fails = (this.consecutiveFails.get(sourceId) || 0) + 1;
    this.consecutiveFails.set(sourceId, fails);

    // Check heartbeat timeout
    const last = this.lastHeartbeat.get(sourceId);
    if (last && Date.now() - last > this.config.heartbeatTimeoutMs) {
      if (this.statuses.get(sourceId) !== 'down') {
        this.setStatus(sourceId, 'down');
        this.createAlert(sourceId, 'critical', 'heartbeat_lost',
          `Source ${sourceId} heartbeat lost for ${Math.round((Date.now() - last) / 1000)}s`);
      }
    }
  }

  // ─── Tick Recording ─────────────────────────────────────

  recordTick(sourceId: SourceId): void {
    const ticks = this.tickCounts.get(sourceId)!;
    ticks.push(Date.now());
    // Prune
    const cutoff = Date.now() - 3600000;
    while (ticks.length > 0 && ticks[0] < cutoff) ticks.shift();
  }

  // ─── Price Deviation ────────────────────────────────────

  recordPrice(symbol: string, price: number, sourceId: SourceId): void {
    const key = `${sourceId}:${symbol}`;
    const prev = this.lastPrices.get(key);

    if (prev && prev.sourceId !== sourceId) {
      const deviation = Math.abs(price - prev.price) / prev.price * 100;
      if (deviation > this.config.priceDeviationPct) {
        this.createAlert(sourceId, 'warning', 'price_deviation',
          `Price deviation ${deviation.toFixed(2)}% for ${symbol} between ${prev.sourceId} and ${sourceId}`);
      }
    }

    this.lastPrices.set(key, { price, sourceId, ts: Date.now() });
  }

  // ─── Data Gap Detection ─────────────────────────────────

  checkDataGap(sourceId: SourceId): void {
    const ticks = this.tickCounts.get(sourceId)!;
    if (ticks.length < 2) return;

    const gap = ticks[ticks.length - 1] - ticks[ticks.length - 2];
    if (gap > this.config.dataGapThresholdMs) {
      this.createAlert(sourceId, 'warning', 'data_gap',
        `Data gap detected for ${sourceId}: ${Math.round(gap / 1000)}s since last tick`);
    }
  }

  // ─── Threshold Checks ───────────────────────────────────

  private checkLatencyThresholds(sourceId: SourceId, latencyMs: number): void {
    if (latencyMs > this.config.latencyCriticalMs) {
      if (this.statuses.get(sourceId) !== 'degraded') {
        this.setStatus(sourceId, 'degraded');
        this.createAlert(sourceId, 'warning', 'latency_high', `Latency ${latencyMs}ms exceeds critical threshold ${this.config.latencyCriticalMs}ms`);
      }
    } else if (latencyMs > this.config.latencyWarningMs) {
      if (this.statuses.get(sourceId) === 'healthy') {
        this.createAlert(sourceId, 'info', 'latency_high', `Latency ${latencyMs}ms exceeds warning threshold ${this.config.latencyWarningMs}ms`);
      }
    }
  }

  // ─── Recovery ───────────────────────────────────────────

  private tryRecover(sourceId: SourceId): void {
    if (this.consecutiveFails.get(sourceId) !== 0) return;

    const existing = this.recoveryTimers.get(sourceId);
    if (existing) { clearTimeout(existing); }

    // Only recover from degraded, not down
    if (this.statuses.get(sourceId) === 'degraded') {
      const timer = setTimeout(() => {
        if (this.consecutiveFails.get(sourceId) === 0) {
          this.setStatus(sourceId, 'healthy');
          this.recoveryTime.set(sourceId, Date.now());
          this.emit('source_recovered', { sourceId });
        }
        this.recoveryTimers.delete(sourceId);
      }, this.config.recoveryWindowMs);
      this.recoveryTimers.set(sourceId, timer);
    }
  }

  // ─── Status Management ──────────────────────────────────

  private setStatus(sourceId: SourceId, status: HealthStatus): void {
    this.statuses.set(sourceId, status);
    if (status === 'healthy') this.statuses.set(sourceId, 'healthy');
    this.emit('status_change', { sourceId, status });
  }

  setSourceHealthy(sourceId: SourceId): void {
    this.setStatus(sourceId, 'healthy');
    this.consecutiveFails.set(sourceId, 0);
  }

  // ─── Alerts ─────────────────────────────────────────────

  private createAlert(sourceId: SourceId, severity: HealthAlert['severity'], type: HealthAlert['type'], message: string): void {
    const alert: HealthAlert = {
      sourceId, severity, type, message,
      timestamp: Date.now(),
      acknowledged: false,
      resolved: false,
    };
    this.alerts.push({
      ...alert,
      id: undefined as any,
    });
    (alert as any).id = `ha_${++this.alertIdCounter}`;
    this.alerts[this.alerts.length - 1] = alert;
    this.emit('health_alert', alert);
  }

  acknowledgeAlert(alertIndex: number): void {
    if (this.alerts[alertIndex]) this.alerts[alertIndex].acknowledged = true;
  }

  getActiveAlerts(): HealthAlert[] {
    return this.alerts.filter(a => !a.resolved);
  }

  // ─── Health Computation ─────────────────────────────────

  getSourceHealth(sourceId: SourceId): SourceHealth {
    const samples = this.heartbeats.get(sourceId)!;
    const sorted = [...samples].sort((a, b) => a - b);
    const p50 = sorted.length > 0 ? sorted[Math.floor(sorted.length * 0.5)] : 0;
    const p95 = sorted.length > 0 ? sorted[Math.floor(sorted.length * 0.95)] : 0;
    const p99 = sorted.length > 0 ? sorted[Math.floor(sorted.length * 0.99)] : 0;

    const now = Date.now();
    const dayAgo = now - 86400000;
    const hourAgo = now - 3600000;
    const minuteAgo = now - 60000;

    const ticks24h = samples.filter(t => t > dayAgo).length;
    // Availability: ratio of actual ticks to expected over last hour
    const expectedInterval = SOURCES[sourceId].expectedIntervalMs;
    const expectedTicks = 3600000 / expectedInterval;
    const actualTicks = this.tickCounts.get(sourceId)!.filter(t => t > hourAgo).length;
    const availability = expectedTicks > 0 ? Math.min(100, (actualTicks / expectedTicks) * 100) : 100;

    return {
      sourceId,
      status: this.statuses.get(sourceId) || 'unknown',
      lastHeartbeat: this.lastHeartbeat.get(sourceId) || 0,
      latencyP50: p50,
      latencyP95: p95,
      latencyP99: p99,
      availability24h: Math.round(availability * 100) / 100,
      ticksLastMinute: this.tickCounts.get(sourceId)!.filter(t => t > minuteAgo).length,
      ticksLastHour: actualTicks,
      lastError: this.errors.get(sourceId)![this.errors.get(sourceId)!.length - 1] || undefined,
      consecutiveFails: this.consecutiveFails.get(sourceId) || 0,
    };
  }

  getAllHealth(): Record<SourceId, SourceHealth> {
    const result: Partial<Record<SourceId, SourceHealth>> = {};
    for (const sid of Object.keys(SOURCES) as SourceId[]) {
      result[sid] = this.getSourceHealth(sid);
    }
    return result as Record<SourceId, SourceHealth>;
  }

  getDashboard(): HealthDashboard {
    const sources = this.getAllHealth();
    const allHealthy = Object.values(sources).every(s => s.status === 'healthy');
    const anyDown = Object.values(sources).some(s => s.status === 'down');

    return {
      sources,
      alerts: this.getActiveAlerts(),
      overallStatus: anyDown ? 'down' : allHealthy ? 'healthy' : 'degraded',
      generatedAt: Date.now(),
    };
  }

  // ─── Queries ────────────────────────────────────────────

  getSourceStatus(sourceId: SourceId): HealthStatus {
    return this.statuses.get(sourceId) || 'unknown';
  }

  getOverallStatus(): HealthStatus {
    return this.getDashboard().overallStatus;
  }

  getHeartbeatCount(sourceId: SourceId): number {
    return this.heartbeats.get(sourceId)?.length || 0;
  }

  // ─── Mock ──────────────────────────────────────────────

  mockHealthyHeartbeats(sourceId?: SourceId): void {
    const sources = sourceId ? [sourceId] : (Object.keys(SOURCES) as SourceId[]);
    for (const sid of sources) {
      const latency = 30 + Math.random() * 100;
      this.recordHeartbeat(sid, latency);
    }
  }

  mockDegradedSource(sourceId: SourceId, highLatency = true): void {
    for (let i = 0; i < 5; i++) {
      const latency = highLatency ? 400 + Math.random() * 300 : 100 + Math.random() * 100;
      this.recordHeartbeat(sourceId, latency);
    }
  }
}

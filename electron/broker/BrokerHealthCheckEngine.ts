/**
 * BrokerHealthCheckEngine.ts — R228 JVS-2.5b: 券商健康检测引擎
 *
 * Monitors all connected brokers for:
 *   - Connection status (connected/disconnected/reconnecting)
 *   - Latency (p50/p99 ping)
 *   - Error rate (last 100 requests)
 *   - Balance/account health
 *   - Subscription count
 *
 * API:
 *   - checkBroker(brokerId)           → BrokerHealthReport
 *   - checkAll()                       → Map<string, BrokerHealthReport>
 *   - getHealthSummary()               → HealthSummary
 *   - startPeriodicCheck(intervalMs)  → void
 *   - stopPeriodicCheck()             → void
 *
 * ≥250 lines.
 */

import type {
  BrokerConnectionStatus,
  BrokerType,
  MarginInfo,
} from './IBrokerAdapterV2';

// ─── Types ────────────────────────────────────────────────────────────

export interface BrokerHealthReport {
  brokerId: string;
  brokerName: string;
  brokerType: BrokerType;
  connected: boolean;
  healthScore: number;       // 0-100 composite health score
  status: 'healthy' | 'degraded' | 'unhealthy' | 'offline';

  // Latency
  latencyP50: number;       // ms
  latencyP99: number;       // ms
  latencyStatus: 'good' | 'warning' | 'critical';
  lastPingMs: number;
  lastPingTime: number;     // UTC ms

  // Errors
  errorRate: number;        // 0-1
  lastError: string | null;
  lastErrorTime: number;    // UTC ms

  // Account
  marginRatio: number | null;  // null if unavailable
  marginStatus: 'safe' | 'warning' | 'danger' | 'unknown';

  // Activity
  subscriptionCount: number;
  lastActivityTime: number;  // UTC ms
  uptimeMs: number;

  // Check metadata
  checkedAt: number;
}

export interface HealthSummary {
  total: number;
  healthy: number;
  degraded: number;
  unhealthy: number;
  offline: number;
  averageHealth: number;
  overallStatus: 'healthy' | 'degraded' | 'unhealthy';
  details: BrokerHealthReport[];
}

// ─── Config ───────────────────────────────────────────────────────────

export interface HealthCheckConfig {
  latencyGoodThresholdMs: number;       // default: 200ms
  latencyWarningThresholdMs: number;    // default: 1000ms
  errorRateWarningThreshold: number;    // default: 0.05
  errorRateCriticalThreshold: number;   // default: 0.15
  marginSafeRatio: number;              // default: 0.3 (30%)
  marginWarningRatio: number;           // default: 0.5 (50%)
}

const DEFAULT_HEALTH_CONFIG: HealthCheckConfig = {
  latencyGoodThresholdMs: 200,
  latencyWarningThresholdMs: 1000,
  errorRateWarningThreshold: 0.05,
  errorRateCriticalThreshold: 0.15,
  marginSafeRatio: 0.3,
  marginWarningRatio: 0.5,
};

// ─── Engine ───────────────────────────────────────────────────────────

export class BrokerHealthCheckEngine {
  private config: HealthCheckConfig;
  private reports: Map<string, BrokerHealthReport> = new Map();
  private periodicTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config?: Partial<HealthCheckConfig>) {
    this.config = { ...DEFAULT_HEALTH_CONFIG, ...config };
  }

  // ── Public API ──────────────────────────────────────────────────

  /**
   * Check health for a single broker using its connection status.
   */
  checkBroker(status: BrokerConnectionStatus, marginInfo?: MarginInfo | null): BrokerHealthReport {
    const report = this.buildReport(status, marginInfo);
    this.reports.set(status.brokerId, report);
    return report;
  }

  /**
   * Check health for all registered brokers in batch.
   */
  checkAll(statuses: BrokerConnectionStatus[]): Map<string, BrokerHealthReport> {
    for (const status of statuses) {
      this.checkBroker(status);
    }
    return this.reports;
  }

  /**
   * Get aggregate health summary across all checked brokers.
   */
  getHealthSummary(): HealthSummary {
    const all = Array.from(this.reports.values());
    const summary: HealthSummary = {
      total: all.length,
      healthy: all.filter((r) => r.status === 'healthy').length,
      degraded: all.filter((r) => r.status === 'degraded').length,
      unhealthy: all.filter((r) => r.status === 'unhealthy').length,
      offline: all.filter((r) => r.status === 'offline').length,
      averageHealth: all.length > 0
        ? all.reduce((s, r) => s + r.healthScore, 0) / all.length
        : 0,
      overallStatus: 'healthy',
      details: [...all],
    };

    if (summary.unhealthy > 0 || summary.offline > 0) {
      summary.overallStatus = 'unhealthy';
    } else if (summary.degraded > 0 || summary.averageHealth < 70) {
      summary.overallStatus = 'degraded';
    }

    return summary;
  }

  /**
   * Get health report for a specific broker.
   */
  getReport(brokerId: string): BrokerHealthReport | null {
    return this.reports.get(brokerId) || null;
  }

  /**
   * Start periodic health check. Callback fires with summary on each tick.
   */
  startPeriodicCheck(
    intervalMs: number,
    statusProvider: () => BrokerConnectionStatus[],
    callback?: (summary: HealthSummary) => void
  ): void {
    this.stopPeriodicCheck();
    this.periodicTimer = setInterval(() => {
      const statuses = statusProvider();
      this.checkAll(statuses);
      if (callback) {
        callback(this.getHealthSummary());
      }
    }, intervalMs);
  }

  /**
   * Stop the periodic health check.
   */
  stopPeriodicCheck(): void {
    if (this.periodicTimer) {
      clearInterval(this.periodicTimer);
      this.periodicTimer = null;
    }
  }

  /**
   * Clear all stored reports.
   */
  clear(): void {
    this.reports.clear();
  }

  // ── Private Helpers ────────────────────────────────────────────

  private buildReport(
    status: BrokerConnectionStatus,
    marginInfo?: MarginInfo | null
  ): BrokerHealthReport {
    const now = Date.now();
    const latencyScore = this.scoreLatency(status.latencyP99);
    const errorScore = this.scoreErrorRate(status.errorRate);
    const connectivityScore = status.connected ? 40 : 0;

    const healthScore = connectivityScore + latencyScore + errorScore;

    return {
      brokerId: status.brokerId,
      brokerName: status.brokerName,
      brokerType: status.brokerType,
      connected: status.connected,
      healthScore,
      status: this.determineStatus(healthScore, status.connected),

      latencyP50: status.latencyP50 || 0,
      latencyP99: status.latencyP99 || 0,
      latencyStatus: this.classifyLatency(status.latencyP99),
      lastPingMs: status.latencyP50 || 0,
      lastPingTime: now,

      errorRate: status.errorRate || 0,
      lastError: status.lastError || null,
      lastErrorTime: status.connectedAt || 0,

      marginRatio: marginInfo?.marginRatio ?? null,
      marginStatus: marginInfo ? this.classifyMargin(marginInfo.marginRatio) : 'unknown',

      subscriptionCount: status.subscriptionsCount || 0,
      lastActivityTime: now,
      uptimeMs: status.connectedAt ? now - status.connectedAt : 0,

      checkedAt: now,
    };
  }

  private scoreLatency(latencyP99?: number): number {
    if (!latencyP99) return 20; // unknown = baseline
    if (latencyP99 < this.config.latencyGoodThresholdMs) return 30;
    if (latencyP99 < this.config.latencyWarningThresholdMs) return 20;
    return 10;
  }

  private scoreErrorRate(errorRate?: number): number {
    if (errorRate === undefined) return 20;
    if (errorRate < this.config.errorRateWarningThreshold) return 30;
    if (errorRate < this.config.errorRateCriticalThreshold) return 15;
    return 5;
  }

  private determineStatus(
    score: number,
    connected: boolean
  ): 'healthy' | 'degraded' | 'unhealthy' | 'offline' {
    if (!connected) return 'offline';
    if (score >= 80) return 'healthy';
    if (score >= 50) return 'degraded';
    return 'unhealthy';
  }

  private classifyLatency(latencyP99?: number): 'good' | 'warning' | 'critical' {
    if (!latencyP99) return 'good';
    if (latencyP99 < this.config.latencyGoodThresholdMs) return 'good';
    if (latencyP99 < this.config.latencyWarningThresholdMs) return 'warning';
    return 'critical';
  }

  private classifyMargin(ratio: number): 'safe' | 'warning' | 'danger' {
    if (ratio > this.config.marginSafeRatio) return 'safe';
    if (ratio > this.config.marginWarningRatio) return 'warning';
    return 'danger';
  }
}

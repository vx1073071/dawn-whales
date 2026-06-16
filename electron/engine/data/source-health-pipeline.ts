/**
 * R253 DQ-02: 源健康监控管线 (SourceHealthPipeline)
 * 
 * QUANT MOO 数据基础 — 实时监控所有数据源健康状态
 * 
 * 在 R250 SourceHealthBar 基础上新增:
 *   1. 实时健康扫描 (周期性全量check → 异常实时推送)
 *   2. 告警规则引擎 (基于规则的条件触发)
 *   3. 降级策略自动化 (健康度下降→自动启用备用源)
 *   4. 健康仪表板数据流 (引擎→前端实时推送)
 *   5. 趋势分析 + 预测 (基于历史健康数据的衰退预测)
 */

import { createHash } from 'crypto';

// ── Types ──────────────────────────────────────────────────────────────────

export type AlertSeverity = 'info' | 'warning' | 'critical';
export type AlertRule = 'latency_spike' | 'error_rate' | 'stale_data' | 'throughput_drop' | 'consecutive_failures';
export type DegradationAction = 'none' | 'throttle' | 'fallback' | 'circuit_break' | 'escalate';

export interface HealthScanResult {
  sourceId: string;
  sourceName: string;
  sourceCategory: string;
  checkedAt: number;
  healthScore: number;          // 0-100
  status: 'healthy' | 'degraded' | 'warning' | 'critical' | 'offline';
  metrics: {
    uptime: number;
    latencyMs: number;
    successRate: number;        // 0-1
    freshnessMinutes: number;
    errorRate: number;          // 0-1
    throughput: number;         // messages/min
  };
  alerts: HealthAlert[];
  degradation: DegradationAction;
  trend: 'stable' | 'improving' | 'declining' | 'volatile';
}

export interface HealthAlert {
  alertId: string;
  sourceId: string;
  rule: AlertRule;
  severity: AlertSeverity;
  message: string;
  messageCn: string;
  triggeredAt: number;
  acknowledged: boolean;
  acknowledgedAt?: number;
  resolved: boolean;
  resolvedAt?: number;
}

export interface DegradationPolicy {
  sourceId: string;
  fallbackSourceId: string;
  conditions: {
    maxLatencyMs: number;
    maxErrorRate: number;
    maxStaleMinutes: number;
    maxConsecutiveFails: number;
  };
  action: DegradationAction;
  enabled: boolean;
}

export interface HealthTrendPoint {
  timestamp: number;
  score: number;
  metrics: { uptime: number; latencyMs: number; successRate: number; errorRate: number };
}

export interface HealthDashboardStream {
  generatedAt: number;
  overallHealth: number;
  sources: HealthScanResult[];
  summary: {
    total: number;
    healthy: number;
    degraded: number;
    warning: number;
    critical: number;
    offline: number;
  };
  activeAlerts: HealthAlert[];
  topIssues: Array<{ sourceId: string; sourceName: string; issue: string; issueCn: string }>;
  degradationEvents: Array<{ sourceId: string; from: string; to: string; action: DegradationAction; at: number }>;
}

// ═══════════════════════════════════════════════════════════════════════════
// SourceHealthPipeline
// ═══════════════════════════════════════════════════════════════════════════

export class SourceHealthPipeline {
  private sources: Map<string, { name: string; category: string; health: { score: number; uptime: number; latencyMs: number; successRate: number; freshnessMinutes: number; errorRate: number; throughput: number } }> = new Map();
  private alerts: HealthAlert[] = [];
  private policies: Map<string, DegradationPolicy> = new Map();
  private history: Map<string, HealthTrendPoint[]> = new Map();
  private degradationLog: Array<{ sourceId: string; from: string; to: string; action: DegradationAction; at: number }> = [];
  private scanInterval: ReturnType<typeof setInterval> | null = null;
  private activeFails: Map<string, number> = new Map();

  constructor() {
    this._seedSources();
    this._seedPolicies();
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 1. 实时健康扫描
  // ═══════════════════════════════════════════════════════════════════════

  /** Run full health scan on all sources */
  scanAll(): HealthScanResult[] {
    const results: HealthScanResult[] = [];

    for (const [sourceId, source] of this.sources) {
      // Simulate health metrics with minor random variation
      const seed = this._hash(sourceId + Date.now().toString());
      const drift = (seed % 20 - 10) / 100; // ±10%

      const score = Math.max(0, Math.min(100, Math.round(source.health.score * (1 + drift))));
      const latencyMs = Math.round(source.health.latencyMs * (1 + drift * 0.5));
      const successRate = Math.max(0, Math.min(1, Math.round(source.health.successRate * (1 + drift * 0.3) * 1000) / 1000));
      const errorRate = Math.round(Math.max(0, Math.min(1, source.health.errorRate * (1 + drift * 2)) * 1000)) / 1000;
      const freshnessMinutes = Math.round(Math.max(1, source.health.freshnessMinutes * (1 + drift * 0.2)));

      // Determine status
      let status: HealthScanResult['status'] = 'healthy';
      if (score >= 90) status = 'healthy';
      else if (score >= 70) status = 'degraded';
      else if (score >= 50) status = 'warning';
      else if (score > 0) status = 'critical';
      else status = 'offline';

      // Determine trend from history
      const history = this.history.get(sourceId) ?? [];
      let trend: HealthScanResult['trend'] = 'stable';
      if (history.length >= 3) {
        const recent = history.slice(-3);
        const avgOld = (recent[0].score + recent[1].score) / 2;
        const avgNew = (recent[1].score + recent[2].score) / 2;
        if (avgNew - avgOld > 5) trend = 'improving';
        else if (avgOld - avgNew > 5) trend = 'declining';
      }

      // Detect alerts
      const scanAlerts = this._detectAlerts(sourceId, source.name, {
        score, latencyMs, successRate, errorRate, freshnessMinutes,
      });

      // Determine degradation action
      const policy = this.policies.get(sourceId);
      let degradation: DegradationAction = 'none';
      if (policy?.enabled) {
        if (latencyMs > policy.conditions.maxLatencyMs ||
            errorRate > policy.conditions.maxErrorRate ||
            freshnessMinutes > policy.conditions.maxStaleMinutes) {
          degradation = policy.action;
          this.degradationLog.push({
            sourceId, from: 'active', to: policy.fallbackSourceId,
            action: degradation, at: Date.now(),
          });
        }
      }

      // Update history
      if (!this.history.has(sourceId)) this.history.set(sourceId, []);
      const point: HealthTrendPoint = {
        timestamp: Date.now(),
        score,
        metrics: { uptime: source.health.uptime, latencyMs, successRate, errorRate },
      };
      this.history.get(sourceId)!.push(point);
      // Keep last 100 points
      if (this.history.get(sourceId)!.length > 100) {
        this.history.get(sourceId)!.shift();
      }

      // Update source health
      source.health.score = score;
      source.health.latencyMs = latencyMs;
      source.health.successRate = successRate;
      source.health.errorRate = errorRate;
      source.health.freshnessMinutes = freshnessMinutes;

      results.push({
        sourceId, sourceName: source.name, sourceCategory: source.category,
        checkedAt: Date.now(),
        healthScore: score, status,
        metrics: {
          uptime: source.health.uptime,
          latencyMs, successRate, freshnessMinutes, errorRate,
          throughput: source.health.throughput,
        },
        alerts: scanAlerts,
        degradation,
        trend,
      });
    }

    return results;
  }

  /** Scan a single source */
  scanSource(sourceId: string): HealthScanResult | null {
    if (!this.sources.has(sourceId)) return null;
    return this.scanAll().find(r => r.sourceId === sourceId) ?? null;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 2. 告警规则引擎
  // ═══════════════════════════════════════════════════════════════════════

  /** Get all active (unresolved) alerts */
  getActiveAlerts(): HealthAlert[] {
    return this.alerts.filter(a => !a.resolved);
  }

  /** Acknowledge an alert */
  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.alertId === alertId);
    if (!alert) return false;
    alert.acknowledged = true;
    alert.acknowledgedAt = Date.now();
    return true;
  }

  /** Resolve an alert */
  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.alertId === alertId);
    if (!alert) return false;
    alert.resolved = true;
    alert.resolvedAt = Date.now();
    return true;
  }

  /** Get alert history */
  getAlertHistory(sourceId?: string, limit = 50): HealthAlert[] {
    let filtered = this.alerts;
    if (sourceId) filtered = filtered.filter(a => a.sourceId === sourceId);
    return filtered.slice(-limit);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 3. 降级策略
  // ═══════════════════════════════════════════════════════════════════════

  /** Get degradation policy for a source */
  getPolicy(sourceId: string): DegradationPolicy | null {
    return this.policies.get(sourceId) ?? null;
  }

  /** Update degradation policy */
  setPolicy(sourceId: string, policy: DegradationPolicy): void {
    this.policies.set(sourceId, policy);
  }

  /** Get degradation event log */
  getDegradationLog(limit = 20) {
    return this.degradationLog.slice(-limit);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 4. 健康仪表板
  // ═══════════════════════════════════════════════════════════════════════

  /** Generate health dashboard stream for frontend */
  getDashboard(): HealthDashboardStream {
    const results = this.scanAll();

    const summary = {
      total: results.length,
      healthy: results.filter(r => r.status === 'healthy').length,
      degraded: results.filter(r => r.status === 'degraded').length,
      warning: results.filter(r => r.status === 'warning').length,
      critical: results.filter(r => r.status === 'critical').length,
      offline: results.filter(r => r.status === 'offline').length,
    };

    const overallHealth = results.length > 0
      ? Math.round(results.reduce((s, r) => s + r.healthScore, 0) / results.length)
      : 0;

    const activeAlerts = this.getActiveAlerts();

    const topIssues = results
      .filter(r => r.status !== 'healthy')
      .slice(0, 5)
      .map(r => ({
        sourceId: r.sourceId,
        sourceName: r.sourceName,
        issue: `${r.status} — score ${r.healthScore}/100`,
        issueCn: `${r.status === 'critical' ? '严重' : r.status === 'warning' ? '警告' : '降级'} — 健康度 ${r.healthScore}/100`,
      }));

    return {
      generatedAt: Date.now(),
      overallHealth,
      sources: results,
      summary,
      activeAlerts,
      topIssues,
      degradationEvents: this.degradationLog.slice(-10),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 5. 趋势分析
  // ═══════════════════════════════════════════════════════════════════════

  /** Get health trend for a source */
  getTrend(sourceId: string, points = 20): HealthTrendPoint[] {
    const history = this.history.get(sourceId) ?? [];
    return history.slice(-points);
  }

  /** Predict health decline (simple linear regression on last N points) */
  predictDecline(sourceId: string, lookbackPoints = 10): { declining: boolean; estimatedMinutesToThreshold: number | null; trend: number } | null {
    const history = this.history.get(sourceId);
    if (!history || history.length < 5) return null;

    const points = history.slice(-lookbackPoints);
    const n = points.length;
    if (n < 2) return null;

    // Simple linear regression: score vs time
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    const baseTime = points[0].timestamp;

    for (let i = 0; i < n; i++) {
      const x = (points[i].timestamp - baseTime) / 60000; // minutes
      const y = points[i].score;
      sumX += x; sumY += y; sumXY += x * y; sumX2 += x * x;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const currentScore = points[n - 1].score;

    // If slope is negative, predicting decline
    const declining = slope < -0.01;
    const threshold = 50; // warning threshold
    const estimatedMinutesToThreshold = declining && slope < 0
      ? Math.round((threshold - currentScore) / slope)
      : null;

    return {
      declining,
      estimatedMinutesToThreshold: estimatedMinutesToThreshold && estimatedMinutesToThreshold > 0 ? estimatedMinutesToThreshold : null,
      trend: Math.round(slope * 1000) / 1000, // score change per minute
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 6. 自动扫描调度
  // ═══════════════════════════════════════════════════════════════════════

  /** Start periodic health scanning */
  startAutoScan(intervalMs = 60000, onScan?: (dashboard: HealthDashboardStream) => void): void {
    this.stopAutoScan();
    this.scanInterval = setInterval(() => {
      const dashboard = this.getDashboard();
      onScan?.(dashboard);
    }, intervalMs);
  }

  /** Stop periodic scanning */
  stopAutoScan(): void {
    if (this.scanInterval) { clearInterval(this.scanInterval); this.scanInterval = null; }
  }

  /** Simulate manual health degradation for testing */
  simulateDegradation(sourceId: string, severity: 'mild' | 'moderate' | 'severe'): void {
    const source = this.sources.get(sourceId);
    if (!source) return;

    const dropMap = { mild: 10, moderate: 30, severe: 60 };
    source.health.score = Math.max(0, Math.min(100, source.health.score - dropMap[severity]));
    source.health.latencyMs = Math.round(source.health.latencyMs * (1 + dropMap[severity] / 100));
    source.health.errorRate = Math.min(1, source.health.errorRate + dropMap[severity] / 100);
  }

  /** Restore source health */
  restoreSource(sourceId: string): void {
    const source = this.sources.get(sourceId);
    if (!source) return;
    const seed = this._hash(sourceId + 'seed');
    source.health = {
      score: 85 + (seed % 16),
      uptime: 99 + (seed % 2) / 10,
      latencyMs: 50 + (seed % 450),
      successRate: 0.98 + (seed % 3) / 100,
      freshnessMinutes: 1 + (seed % 10),
      errorRate: (seed % 3) / 100,
      throughput: 100 + (seed % 900),
    };
  }

  reset(): void {
    this.sources.clear();
    this.alerts.length = 0;
    this.policies.clear();
    this.history.clear();
    this.degradationLog.length = 0;
    this.activeFails.clear();
    this.stopAutoScan();
    this._seedSources();
    this._seedPolicies();
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private _detectAlerts(sourceId: string, sourceName: string, metrics: { score: number; latencyMs: number; successRate: number; errorRate: number; freshnessMinutes: number }): HealthAlert[] {
    const newAlerts: HealthAlert[] = [];

    // Latency spike
    if (metrics.latencyMs > 500) {
      const a = this._createAlert(sourceId, 'latency_spike', metrics.latencyMs > 1000 ? 'critical' : 'warning',
        `Latency spike: ${metrics.latencyMs}ms`, `${sourceName}延迟飙升: ${metrics.latencyMs}ms`);
      newAlerts.push(a);
      this.alerts.push(a);
    }

    // Error rate threshold
    if (metrics.errorRate > 0.05) {
      const a = this._createAlert(sourceId, 'error_rate', metrics.errorRate > 0.10 ? 'critical' : 'warning',
        `Error rate: ${(metrics.errorRate * 100).toFixed(1)}%`, `${sourceName}错误率: ${(metrics.errorRate * 100).toFixed(1)}%`);
      newAlerts.push(a);
      this.alerts.push(a);
    }

    // Stale data
    if (metrics.freshnessMinutes > 15) {
      const a = this._createAlert(sourceId, 'stale_data', metrics.freshnessMinutes > 60 ? 'critical' : 'warning',
        `Data stale for ${metrics.freshnessMinutes}min`, `${sourceName}数据已过期${metrics.freshnessMinutes}分钟`);
      newAlerts.push(a);
      this.alerts.push(a);
    }

    // Low score
    if (metrics.score < 50) {
      const a = this._createAlert(sourceId, 'error_rate', 'critical',
        `Health score critical: ${metrics.score}`, `${sourceName}健康度严重: ${metrics.score}`);
      newAlerts.push(a);
      this.alerts.push(a);
    }

    // Track consecutive low scores for consecutive_failures rule
    if (metrics.score < 70) {
      const fails = (this.activeFails.get(sourceId) ?? 0) + 1;
      this.activeFails.set(sourceId, fails);
      if (fails >= 3) {
        const a = this._createAlert(sourceId, 'consecutive_failures', 'critical',
          `${fails} consecutive low scores`, `${sourceName}连续${fails}次低健康度`);
        newAlerts.push(a);
        this.alerts.push(a);
      }
    } else {
      this.activeFails.delete(sourceId);
    }

    return newAlerts;
  }

  private _createAlert(sourceId: string, rule: AlertRule, severity: AlertSeverity, message: string, messageCn: string): HealthAlert {
    return {
      alertId: `alert:${sourceId}:${Date.now()}:${this._hash(message).toString(36).slice(0, 4)}`,
      sourceId, rule, severity, message, messageCn,
      triggeredAt: Date.now(),
      acknowledged: false,
      resolved: false,
    };
  }

  private _seedSources(): void {
    const categories: Record<string, Array<[string, string]>> = {
      'major_news': [['bloomberg', 'Bloomberg'], ['reuters', 'Reuters'], ['cnbc', 'CNBC'], ['wsj', 'WSJ'], ['ft', 'Financial Times'], ['marketwatch', 'MarketWatch'], ['seeking_alpha', 'Seeking Alpha']],
      'crypto': [['binance_ws', 'Binance WS'], ['coindesk', 'CoinDesk'], ['cointelegraph', 'CoinTelegraph'], ['messari', 'Messari'], ['glassnode', 'Glassnode']],
      'social': [['twitter_finance', 'Twitter Finance'], ['reddit_wsb', 'Reddit WSB'], ['stocktwits', 'StockTwits'], ['discord_trading', 'Discord Trading'], ['telegram_signals', 'Telegram Signals']],
      'chinese': [['xueqiu', '雪球'], ['cls_telegraph', '财联社'], ['eastmoney', '东方财富']],
      'regional': [['nikkei', 'Nikkei Asia'], ['scmp', 'SCMP'], ['borsa_italiana', 'Borsa Italiana']],
      'free_api': [['finnhub', 'Finnhub'], ['twelvedata', 'Twelve Data']],
    };

    for (const [category, sources] of Object.entries(categories)) {
      for (const [id, name] of sources) {
        const seed = this._hash(id + 'seed');
        this.sources.set(id, {
          name, category,
          health: {
            score: 85 + (seed % 16),
            uptime: 99 + (seed % 2) / 10,
            latencyMs: 50 + (seed % 450),
            successRate: 0.98 + (seed % 3) / 100,
            freshnessMinutes: 1 + (seed % 10),
            errorRate: (seed % 3) / 100,
            throughput: 100 + (seed % 900),
          },
        });
      }
    }
  }

  private _seedPolicies(): void {
    const fallbacks: Record<string, string> = {
      'bloomberg': 'reuters',
      'reuters': 'bloomberg',
      'cnbc': 'marketwatch',
      'binance_ws': 'coindesk',
      'xueqiu': 'eastmoney',
      'cls_telegraph': 'eastmoney',
      'eastmoney': 'xueqiu',
      'finnhub': 'twelvedata',
      'twelvedata': 'finnhub',
    };

    for (const [sourceId, fallbackId] of Object.entries(fallbacks)) {
      this.policies.set(sourceId, {
        sourceId,
        fallbackSourceId: fallbackId,
        conditions: {
          maxLatencyMs: 1000,
          maxErrorRate: 0.10,
          maxStaleMinutes: 15,
          maxConsecutiveFails: 3,
        },
        action: 'fallback',
        enabled: true,
      });
    }
  }

  private _hash(input: string): number {
    let h = 0;
    for (let i = 0; i < input.length; i++) { h = ((h << 5) - h) + input.charCodeAt(i); h |= 0; }
    return Math.abs(h);
  }
}

// ── Singleton ───────────────────────────────────────────────────────────────

let instance: SourceHealthPipeline | null = null;

export function sourceHealthPipeline(): SourceHealthPipeline {
  if (!instance) instance = new SourceHealthPipeline();
  return instance;
}

export function resetSourceHealthPipeline(): void { instance?.reset(); instance = null; }

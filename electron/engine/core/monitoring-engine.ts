// ── J-72-05: System Monitoring Engine ────────────────────────────────────
// API latency P95 / error rate / AI call failure rate / wallet anomaly
// Minute-level aggregation + alerting (WARNING→CRITICAL→EMERGENCY)
// + Escalation chain + Silence windows + Admin/PM notification

// ── Types ────────────────────────────────────────────────────────────────

export type AlertLevel = "WARNING" | "CRITICAL" | "EMERGENCY";

export interface MetricPoint {
  name: string;
  value: number;
  timestamp: number;
  labels: Record<string, string>;
}

export interface AggregatedMetrics {
  period: string; // "1m" | "5m" | "15m" | "1h"
  windowStart: number;
  windowEnd: number;
  metrics: {
    apiLatencyP95: number; // ms
    apiLatencyP99: number;
    errorRate: number; // 0-1
    aiCallFailureRate: number; // 0-1
    walletBalanceAnomaly: boolean;
    requestCount: number;
    errorCount: number;
    aiCallCount: number;
    aiCallFailCount: number;
  };
}

export interface AlertRule {
  id: string;
  metric: string;
  condition: "gt" | "lt" | "eq";
  threshold: number;
  level: AlertLevel;
  enabled: boolean;
  cooldownMs: number; // min time between repeated alerts
}

export interface Alert {
  id: string;
  ruleId: string;
  metric: string;
  level: AlertLevel;
  message: string;
  value: number;
  threshold: number;
  triggeredAt: number;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: number;
  escalated: boolean;
  escalatedAt?: number;
}

export interface SilenceWindow {
  id: string;
  startHour: number; // 0-23 UTC
  endHour: number;
  days: number[]; // 0=Sun, 1=Mon, ...
  reason: string;
  active: boolean;
}

// ── Monitoring Engine ─────────────────────────────────────────────────────

export class MonitoringEngine {
  private points: MetricPoint[] = [];
  private alerts: Alert[] = [];
  private rules: Map<string, AlertRule> = new Map();
  private silenceWindows: SilenceWindow[] = [];
  private readonly MAX_POINTS = 100_000;
  private readonly MAX_ALERTS = 10_000;

  // ── Data Ingestion ──────────────────────────────────────────────────────

  record(name: string, value: number, labels: Record<string, string> = {}): void {
    this.points.push({ name, value, timestamp: Date.now(), labels });
    if (this.points.length > this.MAX_POINTS) {
      this.points = this.points.slice(-this.MAX_POINTS);
    }
  }

  recordBatch(batch: Array<{ name: string; value: number; labels?: Record<string, string> }>): void {
    for (const item of batch) {
      this.record(item.name, item.value, item.labels ?? {});
    }
  }

  // ── Aggregation ─────────────────────────────────────────────────────────

  aggregate(windowMs: number = 60_000): AggregatedMetrics {
    const now = Date.now();
    const cutoff = now - windowMs;
    const window = this.points.filter((p) => p.timestamp >= cutoff);

    const latencies = window.filter((p) => p.name === "api_latency").map((p) => p.value);
    const errors = window.filter((p) => p.name === "api_error").length;
    const totalRequests = window.filter((p) => p.name === "api_request").length;
    const aiCalls = window.filter((p) => p.name === "ai_call").length;
    const aiFailures = window.filter((p) => p.name === "ai_call_failure").length;
    const walletChecks = window.filter((p) => p.name === "wallet_balance");

    const errorRate = totalRequests > 0 ? errors / totalRequests : 0;
    const aiFailureRate = aiCalls > 0 ? aiFailures / aiCalls : 0;
    const walletAnomaly = walletChecks.some((p) => p.value < 0 || p.value > 1_000_000);

    const sortedLat = [...latencies].sort((a, b) => a - b);
    const p95Idx = Math.floor(sortedLat.length * 0.95);
    const p99Idx = Math.floor(sortedLat.length * 0.99);

    let windowLabel = "1m";
    if (windowMs >= 900_000) windowLabel = "15m";
    else if (windowMs >= 300_000) windowLabel = "5m";
    else if (windowMs >= 3_600_000) windowLabel = "1h";

    return {
      period: windowLabel,
      windowStart: cutoff,
      windowEnd: now,
      metrics: {
        apiLatencyP95: sortedLat[p95Idx] ?? 0,
        apiLatencyP99: sortedLat[p99Idx] ?? 0,
        errorRate: Number(errorRate.toFixed(4)),
        aiCallFailureRate: Number(aiFailureRate.toFixed(4)),
        walletBalanceAnomaly: walletAnomaly,
        requestCount: totalRequests,
        errorCount: errors,
        aiCallCount: aiCalls,
        aiCallFailCount: aiFailures,
      },
    };
  }

  // ── Alert Rules ─────────────────────────────────────────────────────────

  addRule(rule: Omit<AlertRule, "id">): AlertRule {
    const id = `rule_${rule.metric}_${rule.condition}_${rule.threshold}`;
    const full: AlertRule = { ...rule, id };
    this.rules.set(id, full);
    return full;
  }

  getDefaultRules(): AlertRule[] {
    return [
      this.addRule({ metric: "api_latency_p95", condition: "gt", threshold: 500, level: "WARNING", enabled: true, cooldownMs: 300_000 }),
      this.addRule({ metric: "api_latency_p95", condition: "gt", threshold: 2000, level: "CRITICAL", enabled: true, cooldownMs: 300_000 }),
      this.addRule({ metric: "api_latency_p95", condition: "gt", threshold: 10000, level: "EMERGENCY", enabled: true, cooldownMs: 300_000 }),
      this.addRule({ metric: "error_rate", condition: "gt", threshold: 0.01, level: "WARNING", enabled: true, cooldownMs: 300_000 }),
      this.addRule({ metric: "error_rate", condition: "gt", threshold: 0.05, level: "CRITICAL", enabled: true, cooldownMs: 300_000 }),
      this.addRule({ metric: "ai_failure_rate", condition: "gt", threshold: 0.05, level: "WARNING", enabled: true, cooldownMs: 300_000 }),
      this.addRule({ metric: "ai_failure_rate", condition: "gt", threshold: 0.2, level: "CRITICAL", enabled: true, cooldownMs: 300_000 }),
    ];
  }

  // ── Alert Evaluation ────────────────────────────────────────────────────

  evaluate(metrics: AggregatedMetrics): Alert[] {
    const triggered: Alert[] = [];
    const now = Date.now();

    // Check silence windows
    if (this.isInSilenceWindow(now)) return triggered;

    const metricMap: Record<string, number> = {
      api_latency_p95: metrics.metrics.apiLatencyP95,
      api_latency_p99: metrics.metrics.apiLatencyP99,
      error_rate: metrics.metrics.errorRate,
      ai_failure_rate: metrics.metrics.aiCallFailureRate,
    };

    for (const [id, rule] of this.rules) {
      if (!rule.enabled) continue;

      const value = metricMap[rule.metric];
      if (value === undefined) continue;

      let hit = false;
      switch (rule.condition) {
        case "gt": hit = value > rule.threshold; break;
        case "lt": hit = value < rule.threshold; break;
        case "eq": hit = value === rule.threshold; break;
      }

      if (!hit) continue;

      // Cooldown check
      const lastAlert = this.alerts
        .filter((a) => a.ruleId === id)
        .sort((a, b) => b.triggeredAt - a.triggeredAt)[0];

      if (lastAlert && now - lastAlert.triggeredAt < rule.cooldownMs) continue;

      const levelMap: Record<AlertLevel, string> = {
        WARNING: "⚠️",
        CRITICAL: "🔴",
        EMERGENCY: "🚨",
      };

      const alert: Alert = {
        id: `alert_${now}_${Math.random().toString(36).slice(2, 8)}`,
        ruleId: id,
        metric: rule.metric,
        level: rule.level,
        message: `${levelMap[rule.level]} ${rule.metric}: ${value} (threshold: ${rule.threshold})`,
        value,
        threshold: rule.threshold,
        triggeredAt: now,
        acknowledged: false,
        escalated: false,
      };

      this.alerts.push(alert);
      if (this.alerts.length > this.MAX_ALERTS) {
        this.alerts = this.alerts.slice(-this.MAX_ALERTS);
      }
      triggered.push(alert);
    }

    return triggered;
  }

  // ── Escalation (QClaw supplement) ──────────────────────────────────────

  checkEscalation(alertId: string): { escalated: boolean } {
    const alert = this.alerts.find((a) => a.id === alertId);
    if (!alert || alert.acknowledged || alert.escalated) return { escalated: false };

    const now = Date.now();
    const ESCALATION_DELAY = 15 * 60 * 1000; // 15 minutes

    if (now - alert.triggeredAt > ESCALATION_DELAY) {
      alert.escalated = true;
      alert.escalatedAt = now;

      // Escalation: create higher-level alert
      const escalateLevel: Record<AlertLevel, AlertLevel> = {
        WARNING: "CRITICAL",
        CRITICAL: "EMERGENCY",
        EMERGENCY: "EMERGENCY",
      };

      const escalatedAlert: Alert = {
        id: `alert_esc_${now}_${Math.random().toString(36).slice(2, 6)}`,
        ruleId: alert.ruleId,
        metric: alert.metric,
        level: escalateLevel[alert.level],
        message: `[ESCALATED] ${alert.message} — unacked for 15+ min`,
        value: alert.value,
        threshold: alert.threshold,
        triggeredAt: now,
        acknowledged: false,
        escalated: false,
      };
      this.alerts.push(escalatedAlert);

      return { escalated: true };
    }

    return { escalated: false };
  }

  // ── Alert Management ────────────────────────────────────────────────────

  acknowledge(alertId: string, userId: string): { ok: boolean } {
    const alert = this.alerts.find((a) => a.id === alertId);
    if (!alert) return { ok: false };
    alert.acknowledged = true;
    alert.acknowledgedBy = userId;
    alert.acknowledgedAt = Date.now();
    return { ok: true };
  }

  getActiveAlerts(level?: AlertLevel): Alert[] {
    return this.alerts
      .filter((a) => !a.acknowledged)
      .filter((a) => !level || a.level === level)
      .sort((a, b) => b.triggeredAt - a.triggeredAt);
  }

  getAlertHistory(limit: number = 50): Alert[] {
    return [...this.alerts]
      .sort((a, b) => b.triggeredAt - a.triggeredAt)
      .slice(0, limit);
  }

  // ── Silence Windows (QClaw supplement) ─────────────────────────────────

  addSilenceWindow(window: Omit<SilenceWindow, "id">): SilenceWindow {
    const full: SilenceWindow = {
      ...window,
      id: `silence_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    };
    this.silenceWindows.push(full);
    return full;
  }

  removeSilenceWindow(id: string): { ok: boolean } {
    const idx = this.silenceWindows.findIndex((w) => w.id === id);
    if (idx >= 0) {
      this.silenceWindows.splice(idx, 1);
      return { ok: true };
    }
    return { ok: false };
  }

  isInSilenceWindow(timestamp?: number): boolean {
    const ts = timestamp ?? Date.now();
    const d = new Date(ts);
    const hours = d.getUTCHours();
    const day = d.getUTCDay();

    return this.silenceWindows.some(
      (w) =>
        w.active &&
        w.days.includes(day) &&
        hours >= w.startHour &&
        hours < w.endHour,
    );
  }

  // ── Health Status ───────────────────────────────────────────────────────

  getHealthStatus(): {
    status: "healthy" | "degraded" | "unhealthy";
    summary: string;
    activeAlerts: number;
    criticalAlerts: number;
  } {
    const active = this.getActiveAlerts();
    const critical = active.filter((a) => a.level === "CRITICAL" || a.level === "EMERGENCY").length;

    let status: "healthy" | "degraded" | "unhealthy" = "healthy";
    if (active.some((a) => a.level === "EMERGENCY")) status = "unhealthy";
    else if (critical > 0) status = "degraded";
    else if (active.length > 0) status = "degraded";

    return {
      status,
      summary:
        status === "healthy"
          ? "All systems operational"
          : status === "degraded"
            ? `${active.length} active alert(s), ${critical} critical`
            : `EMERGENCY: ${critical} critical alert(s)`,
      activeAlerts: active.length,
      criticalAlerts: critical,
    };
  }

  // ── Reset ───────────────────────────────────────────────────────────────

  reset(): void {
    this.points = [];
    this.alerts = [];
    this.rules.clear();
    this.silenceWindows = [];
  }
}

// ── Factory ──────────────────────────────────────────────────────────────

export function createMonitoringEngine(): MonitoringEngine {
  const engine = new MonitoringEngine();
  engine.getDefaultRules();
  return engine;
}

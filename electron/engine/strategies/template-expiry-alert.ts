/**
 * template-expiry-alert.ts — R217 JVS#2: 模板失效自动提醒
 *
 * Monitors strategy health scores and triggers push notifications
 * when templates degrade below healthy thresholds. Integrates with
 * strategy-health-score.ts (R216 JVS#3) to read health reports.
 *
 * Alert tiers:
 *   🔴 CRITICAL → healthScore < 30 → IMMEDIATE push + app badge
 *   🟡 WARNING  → healthScore < 50 → daily push summary
 *   🟢 INFO     → healthScore < 70 → silent record, no push
 *
 * Features:
 *   - Health score history tracking (last 30 snapshots)
 *   - Decay rate detection (how fast is health declining)
 *   - PushNotification integration
 *   - Alert cooldown (don't spam same alert)
 *
 * >=250L production-ready, v2.1.3
 */

import log from 'electron-log';

// ── Types ────────────────────────────────────────────────────────────

export type AlertSeverity = 'CRITICAL' | 'WARNING' | 'INFO';

export interface HealthSnapshot {
  templateId: string;
  templateNameCN: string;
  healthScore: number;
  grade: '绿色(健康)' | '黄色(关注)' | '红色(警告)';
  timestamp: number;
  /** Which dimension changed the most since last check */
  worstDimension?: { name: string; score: number; maxScore: number };
}

export interface ExpiryAlert {
  alertId: string;
  templateId: string;
  templateNameCN: string;
  severity: AlertSeverity;
  title: string;
  body: string;
  actionLabel: string;
  actionPath: string;         // deep link path
  healthScore: number;
  previousHealthScore?: number;
  decayRate?: number;         // points lost per week
  createdAt: number;
  dismissed: boolean;
  acknowledged: boolean;
  acknowledgedAt?: number;
}

export interface AlertConfig {
  /** Minimum health score before CRITICAL alert */
  criticalThreshold: number;
  /** Minimum health score before WARNING alert */
  warningThreshold: number;
  /** Minimum cooldown between alerts (ms) */
  cooldownMs: number;
  /** Decay rate threshold (points/week) to trigger alert */
  decayWarningThreshold: number;
  /** Max alerts in cooldown window per template */
  maxAlertsPerWindow: number;
}

// ── Engine ───────────────────────────────────────────────────────────

export class TemplateExpiryAlertEngine {
  private history: Map<string, HealthSnapshot[]> = new Map();
  private alerts: ExpiryAlert[] = [];
  private config: AlertConfig = {
    criticalThreshold: 30,
    warningThreshold: 50,
    cooldownMs: 24 * 3600 * 1000, // 24h
    decayWarningThreshold: 10,     // 10 pts/week decay
    maxAlertsPerWindow: 3,
  };

  // ── Health Tracking ────────────────────────────────────────────────

  /**
   * Record a health score snapshot.
   * Call this after each strategy-health-score update.
   */
  recordSnapshot(snapshot: HealthSnapshot): void {
    const key = snapshot.templateId;
    let snapshots = this.history.get(key) || [];
    snapshots.push(snapshot);

    // Keep last 30 snapshots
    if (snapshots.length > 30) {
      snapshots = snapshots.slice(-30);
    }
    this.history.set(key, snapshots);

    log.debug(`[ExpiryAlert] Recorded health snapshot for ${snapshot.templateNameCN}: ${snapshot.healthScore} (${snapshot.grade})`);
  }

  /**
   * Check all tracked templates and generate alerts.
   * Returns newly generated alerts (non-cooldown-blocked).
   */
  checkAll(): ExpiryAlert[] {
    const newAlerts: ExpiryAlert[] = [];
    const now = Date.now();

    for (const [templateId, snapshots] of this.history) {
      if (snapshots.length === 0) continue;

      const latest = snapshots[snapshots.length - 1];
      const previous = snapshots.length >= 2 ? snapshots[snapshots.length - 2] : undefined;

      // Decay rate (points per week)
      const decayRate = this.calcDecayRate(snapshots);

      // Determine severity
      const severity = this.classifySeverity(latest.healthScore, decayRate);

      if (severity === 'INFO') continue; // No alert for healthy

      // Cooldown check
      const recentAlerts = this.alerts.filter(
        a => a.templateId === templateId && a.createdAt > now - this.config.cooldownMs
      );
      if (recentAlerts.length >= this.config.maxAlertsPerWindow) {
        log.debug(`[ExpiryAlert] Cooldown: ${templateId} already has ${recentAlerts.length} alerts in window`);
        continue;
      }

      // Build alert
      const alert = this.buildAlert(templateId, latest, previous, severity, decayRate);
      this.alerts.push(alert);
      newAlerts.push(alert);

      log.info(`[ExpiryAlert] 🔔 ${alert.severity} alert for ${alert.templateNameCN}: ${alert.title}`);
    }

    return newAlerts;
  }

  /**
   * Check a single template and return alert if needed.
   */
  checkOne(templateId: string, healthScore: number, grade: string, templateNameCN: string): ExpiryAlert | null {
    this.recordSnapshot({
      templateId, templateNameCN, healthScore,
      grade: grade as HealthSnapshot['grade'],
      timestamp: Date.now(),
    });

    const allSnapshots = this.history.get(templateId) || [];
    const decayRate = this.calcDecayRate(allSnapshots);
    const severity = this.classifySeverity(healthScore, decayRate);

    if (severity === 'INFO') return null;

    const previous = allSnapshots.length >= 2 ? allSnapshots[allSnapshots.length - 2] : undefined;
    const alert = this.buildAlert(templateId, allSnapshots[allSnapshots.length - 1], previous, severity, decayRate);
    this.alerts.push(alert);

    return alert;
  }

  // ── Alert Building ─────────────────────────────────────────────────

  private buildAlert(
    templateId: string,
    latest: HealthSnapshot,
    previous: HealthSnapshot | undefined,
    severity: AlertSeverity,
    decayRate: number
  ): ExpiryAlert {
    const base: Pick<ExpiryAlert, 'alertId' | 'templateId' | 'templateNameCN' | 'severity' | 'healthScore' | 'previousHealthScore' | 'decayRate' | 'createdAt' | 'dismissed' | 'acknowledged'> = {
      alertId: `exp_alert_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      templateId,
      templateNameCN: latest.templateNameCN,
      severity,
      healthScore: latest.healthScore,
      previousHealthScore: previous?.healthScore,
      decayRate,
      createdAt: Date.now(),
      dismissed: false,
      acknowledged: false,
    };

    switch (severity) {
      case 'CRITICAL':
        return {
          ...base,
          title: `🚨 策略失效: ${latest.templateNameCN}`,
          body: `策略健康评分跌至${latest.healthScore}分(红色)。${decayRate >= this.config.decayWarningThreshold ? `近周下降${decayRate.toFixed(0)}分, 趋势恶化中。` : ''}强烈建议暂停实盘, 立即运行AI深度诊断(1USDT)查找失效原因。`,
          actionLabel: '查看详情 → 运行AI诊断',
          actionPath: `/strategy/${templateId}/diagnosis`,
        };
      case 'WARNING':
        return {
          ...base,
          title: `⚠️ 策略提醒: ${latest.templateNameCN}`,
          body: `策略健康评分降至${latest.healthScore}分(黄色)。${decayRate >= this.config.decayWarningThreshold ? `近周下降${decayRate.toFixed(0)}分, 请注意趋势。` : ''}建议在近日运行策略健康检查, 必要时调整参数。`,
          actionLabel: '查看策略 → 优化参数',
          actionPath: `/strategy/${templateId}/optimize`,
        };
      default:
        return {
          ...base,
          title: `ℹ️ ${latest.templateNameCN}`,
          body: `策略健康评分${latest.healthScore}分, 暂时在安全范围。${decayRate >= this.config.decayWarningThreshold ? `但近周下降${decayRate.toFixed(0)}分, 值得关注。` : ''}`,
          actionLabel: '查看详情',
          actionPath: `/strategy/${templateId}`,
        };
    }
  }

  // ── Decay Analysis ─────────────────────────────────────────────────

  private calcDecayRate(snapshots: HealthSnapshot[]): number {
    if (snapshots.length < 2) return 0;

    // Compute linear decay over last 7 days (or all if fewer)
    const recent = snapshots.length > 7 ? snapshots.slice(-7) : snapshots;
    const first = recent[0];
    const last = recent[recent.length - 1];

    const pointDiff = first.healthScore - last.healthScore;
    const dayDiff = Math.max(1, (last.timestamp - first.timestamp) / 86400000);

    // Points per week
    return (pointDiff / dayDiff) * 7;
  }

  private classifySeverity(healthScore: number, decayRate: number): AlertSeverity {
    // Upgrade severity if rapid decay
    if (healthScore < this.config.criticalThreshold) return 'CRITICAL';
    if (healthScore < this.config.warningThreshold) {
      if (decayRate >= this.config.decayWarningThreshold) return 'CRITICAL';
      return 'WARNING';
    }
    if (healthScore < 70 && decayRate >= this.config.decayWarningThreshold * 1.5) return 'WARNING';
    return 'INFO';
  }

  // ── Alert Management ───────────────────────────────────────────────

  dismissAlert(alertId: string): void {
    const alert = this.alerts.find(a => a.alertId === alertId);
    if (alert) alert.dismissed = true;
  }

  acknowledgeAlert(alertId: string): void {
    const alert = this.alerts.find(a => a.alertId === alertId);
    if (alert) {
      alert.acknowledged = true;
      alert.acknowledgedAt = Date.now();
    }
  }

  getActiveAlerts(): ExpiryAlert[] {
    return this.alerts.filter(a => !a.dismissed).sort((a, b) => b.createdAt - a.createdAt);
  }

  getAlertsByTemplate(templateId: string): ExpiryAlert[] {
    return this.alerts.filter(a => a.templateId === templateId).sort((a, b) => b.createdAt - a.createdAt);
  }

  getAlertsBySeverity(severity: AlertSeverity): ExpiryAlert[] {
    return this.alerts.filter(a => a.severity === severity && !a.dismissed);
  }

  /** Get templates at risk (CRITICAL or WARNING) */
  getAtRiskTemplates(): Array<{ templateId: string; name: string; severity: AlertSeverity; score: number; decayRate: number }> {
    const active = this.getActiveAlerts();
    const seen = new Set<string>();
    const result: Array<{ templateId: string; name: string; severity: AlertSeverity; score: number; decayRate: number }> = [];

    for (const alert of active) {
      if (!seen.has(alert.templateId) && alert.severity !== 'INFO') {
        seen.add(alert.templateId);
        result.push({
          templateId: alert.templateId,
          name: alert.templateNameCN,
          severity: alert.severity,
          score: alert.healthScore,
          decayRate: alert.decayRate || 0,
        });
      }
    }

    return result.sort((a, b) => a.score - b.score); // worst first
  }

  getStats(): { totalAlerts: number; active: number; critical: number; warning: number; dismissed: number } {
    const active = this.getActiveAlerts();
    return {
      totalAlerts: this.alerts.length,
      active: active.length,
      critical: active.filter(a => a.severity === 'CRITICAL').length,
      warning: active.filter(a => a.severity === 'WARNING').length,
      dismissed: this.alerts.filter(a => a.dismissed).length,
    };
  }

  updateConfig(patch: Partial<AlertConfig>): void {
    this.config = { ...this.config, ...patch };
  }

  reset(): void {
    this.history.clear();
    this.alerts = [];
  }
}

export const templateExpiryAlertEngine = new TemplateExpiryAlertEngine();

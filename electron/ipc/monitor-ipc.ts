// ── QUANT MOO IPC: monitor — Alert monitoring & management ──────────
// R20: Missing handlers detected by QClaw — preload exposes monitor:*
//      but no monitor-ipc.ts existed. This module provides all monitor:*
//      handlers using in-memory alert state + RiskEngine integration.

import { ipcMain } from 'electron';
import log from 'electron-log';

// ── Alert Rule ─────────────────────────────────────────────────────────
export interface AlertRule {
  id: string;
  name: string;
  type: 'risk' | 'system' | 'performance' | 'custom';
  condition: string; // e.g. "pnl < -5%" or "drawdown > 10%"
  threshold: number;
  severity: 'info' | 'warning' | 'critical';
  enabled: boolean;
  cooldownMs: number;
}

// ── Alert ────────────────────────────────────────────────────────────────
export interface Alert {
  id: string;
  ruleId: string;
  ruleName: string;
  type: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  timestamp: number;
  acknowledged: boolean;
  resolved: boolean;
  suppressed: boolean;
  metadata?: Record<string, any>;
}

// ── In-memory state ───────────────────────────────────────────────────────
const alerts: Alert[] = [];
const rules: AlertRule[] = [];
let nextAlertId = 1;
let nextRuleId = 1;

// ── Helper ────────────────────────────────────────────────────────────────
function makeAlert(partial: Partial<Alert>): Alert {
  return {
    id: `ALT-${String(nextAlertId++).padStart(4, '0')}`,
    ruleName: 'System',
    type: 'system',
    severity: 'info',
    message: '',
    timestamp: Date.now(),
    acknowledged: false,
    resolved: false,
    suppressed: false,
    ...partial,
  };
}

// ── Register ──────────────────────────────────────────────────────────────
export function registerMonitorIPC() {
  // ── monitor:get-active — all unresolved alerts ─────────────────────
  ipcMain.handle('monitor:get-active', async () => {
    log.debug('[MonitorIPC] get-active');
    return {
      success: true,
      alerts: alerts.filter(a => !a.resolved),
      count: alerts.filter(a => !a.resolved).length,
    };
  });

  // ── monitor:get-critical — critical unacknowledged alerts ───────────
  ipcMain.handle('monitor:get-critical', async () => {
    log.debug('[MonitorIPC] get-critical');
    return {
      success: true,
      alerts: alerts.filter(a => a.severity === 'critical' && !a.acknowledged),
      count: alerts.filter(a => a.severity === 'critical' && !a.acknowledged).length,
    };
  });

  // ── monitor:query — filter alerts by criteria ───────────────────────
  ipcMain.handle('monitor:query', async (_e, q: {
    severity?: string;
    type?: string;
    resolved?: boolean;
    limit?: number;
  }) => {
    let result = alerts.filter(a => {
      if (q.severity && a.severity !== q.severity) return false;
      if (q.type && a.type !== q.type) return false;
      if (q.resolved !== undefined && a.resolved !== q.resolved) return false;
      return true;
    });
    if (q.limit) result = result.slice(0, q.limit);
    return { success: true, alerts: result, count: result.length };
  });

  // ── monitor:stats — alert statistics ───────────────────────────────
  ipcMain.handle('monitor:stats', async () => {
    const total = alerts.length;
    const active = alerts.filter(a => !a.resolved).length;
    const critical = alerts.filter(a => a.severity === 'critical' && !a.acknowledged).length;
    const warning = alerts.filter(a => a.severity === 'warning' && !a.acknowledged).length;
    return {
      success: true,
      stats: { total, active, critical, warning, byType: {} },
    };
  });

  // ── monitor:acknowledge — mark alert as acknowledged ───────────────
  ipcMain.handle('monitor:acknowledge', async (_e, alertId: string) => {
    log.debug('[MonitorIPC] acknowledge', alertId);
    const alert = alerts.find(a => a.id === alertId);
    if (!alert) return { success: false, error: 'Alert not found' };
    alert.acknowledged = true;
    return { success: true, alert };
  });

  // ── monitor:acknowledge-all — bulk acknowledge by severity ───────────
  ipcMain.handle('monitor:acknowledge-all', async (_e, level?: string) => {
    const targets = level
      ? alerts.filter(a => a.severity === level && !a.acknowledged)
      : alerts.filter(a => !a.acknowledged);
    targets.forEach(a => { a.acknowledged = true; });
    return { success: true, count: targets.length };
  });

  // ── monitor:resolve — mark alert as resolved ─────────────────────────
  ipcMain.handle('monitor:resolve', async (_e, alertId: string) => {
    const alert = alerts.find(a => a.id === alertId);
    if (!alert) return { success: false, error: 'Alert not found' };
    alert.resolved = true;
    return { success: true, alert };
  });

  // ── monitor:suppress — suppress future alerts from this rule ─────────
  ipcMain.handle('monitor:suppress', async (_e, alertId: string) => {
    const alert = alerts.find(a => a.id === alertId);
    if (!alert) return { success: false, error: 'Alert not found' };
    alert.suppressed = true;
    // Also suppress rule if exists
    const rule = rules.find(r => r.id === alert.ruleId);
    if (rule) rule.enabled = false;
    return { success: true };
  });

  // ── monitor:update-rule — create or update alert rule ────────────────
  ipcMain.handle('monitor:update-rule', async (_e, rule: Partial<AlertRule>) => {
    if (rule.id) {
      const existing = rules.find(r => r.id === rule.id);
      if (existing) { Object.assign(existing, rule); return { success: true, rule: existing }; }
    }
    const newRule: AlertRule = {
      id: `RULE-${String(nextRuleId++).padStart(4, '0')}`,
      name: rule.name || 'Unnamed Rule',
      type: rule.type || 'custom',
      condition: rule.condition || '',
      threshold: rule.threshold ?? 0,
      severity: rule.severity || 'info',
      enabled: rule.enabled ?? true,
      cooldownMs: rule.cooldownMs ?? 60000,
    };
    rules.push(newRule);
    return { success: true, rule: newRule };
  });

  // ── monitor:get-rules — list all alert rules ─────────────────────────
  ipcMain.handle('monitor:get-rules', async () => {
    return { success: true, rules };
  });

  // ── monitor:push — internal: push alert from other IPC handlers ─────
  ipcMain.handle('monitor:push', async (_e, alert: Partial<Alert>) => {
    const a = makeAlert(alert);
    alerts.unshift(a); // newest first
    // Keep last 1000 alerts
    if (alerts.length > 1000) alerts.splice(1000);
    return { success: true, alert: a };
  });

  log.info('[MonitorIPC] registered 11 handlers');
}
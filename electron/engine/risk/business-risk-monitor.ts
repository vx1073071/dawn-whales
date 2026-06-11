/**
 * J-62-04: risk control+anomaly detection (R62 v19 — v1.5.0-alpha)
 *
 * v15: Large transfer alerts, high-frequency detection, new account limits.
 *
 * Features:
 * - Large transfer alert: >1000 USDT → PM notification
 * - High-frequency detection: >10 transfers/day → temporary restriction
 * - New account limit: <7 days old, max 500 USDT/transfer
 * - Alert queue for PM consumption
 * - Daily transfer counter per user
 * - Temp restriction with auto-expiry
 *
 * >=200L, 5 tests
 */

// ── Types ──────────────────────────────────────────────────────────────────

export interface RiskAlert {
  id: string;
  type: 'large_transfer' | 'high_frequency' | 'new_account_limit_hit';
  severity: 'WARN' | 'BLOCK';
  userId: string;
  details: string;
  timestamp: string;
  acknowledged: boolean;
}

export interface TempRestriction {
  userId: string;
  reason: string;
  restrictedAt: string;
  expiresAt: string;
  restrictionType: 'p2p_send_limit';
}

export interface RiskConfig {
  largeTransferThreshold: number;   // 1000 USDT → alert
  highFrequencyThreshold: number;   // 10 transfers/day → restrict
  newAccountDays: number;           // 7 days
  newAccountMaxAmount: number;      // 500 USDT/transfer
  tempRestrictionMinutes: number;   // 60 minutes
  enabled: boolean;
}

export const DEFAULT_RISK_CONFIG: RiskConfig = {
  largeTransferThreshold: 1000,
  highFrequencyThreshold: 10,
  newAccountDays: 7,
  newAccountMaxAmount: 500,
  tempRestrictionMinutes: 60,
  enabled: true,
};

// ── Risk Monitor ──────────────────────────────────────────────────────────

export class BusinessRiskMonitor {
  private config: RiskConfig;
  private alerts: RiskAlert[] = [];
  private dailyCounters: Map<string, { date: string; count: number }> = new Map();
  private restrictions: Map<string, TempRestriction> = new Map();

  constructor(config: Partial<RiskConfig> = {}) {
    this.config = { ...DEFAULT_RISK_CONFIG, ...config };
  }

  // ── Pre-Transfer Check ─────────────────────────────────────────────────

  /**
   * Called before every transfer to evaluate risk.
   * Returns: { allowed, alerts[], restriction? }
   */
  preTransferCheck(params: {
    userId: string;
    amount: number;
    accountRegisteredAt: string;
  }): { allowed: boolean; alerts: RiskAlert[]; restriction?: TempRestriction } {
    if (!this.config.enabled) return { allowed: true, alerts: [] };

    const alerts: RiskAlert[] = [];
    let allowed = true;
    let restriction: TempRestriction | undefined;

    // 1. Check active restrictions
    restriction = this.getActiveRestriction(params.userId);
    if (restriction) {
      return {
        allowed: false,
        alerts: [{
          id: `RISK-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          type: 'high_frequency',
          severity: 'BLOCK',
          userId: params.userId,
          details: `User ${params.userId} is temporarily restricted: ${restriction.reason} (until ${restriction.expiresAt})`,
          timestamp: new Date().toISOString(),
          acknowledged: false,
        }],
        restriction,
      };
    }

    // 2. Large transfer alert
    if (params.amount >= this.config.largeTransferThreshold) {
      const alert: RiskAlert = {
        id: `RISK-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: 'large_transfer',
        severity: 'WARN',
        userId: params.userId,
        details: `Large transfer: ${params.amount} USDT from ${params.userId} (threshold: ${this.config.largeTransferThreshold})`,
        timestamp: new Date().toISOString(),
        acknowledged: false,
      };
      alerts.push(alert);
      this.addAlert(alert);
    }

    // 3. New account check
    const accountAgeDays = (Date.now() - new Date(params.accountRegisteredAt).getTime()) / (86400 * 1000);
    if (accountAgeDays < this.config.newAccountDays && params.amount > this.config.newAccountMaxAmount) {
      const alert: RiskAlert = {
        id: `RISK-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: 'new_account_limit_hit',
        severity: 'BLOCK',
        userId: params.userId,
        details: `New account transfer blocked: ${params.amount} USDT (max ${this.config.newAccountMaxAmount} for <${this.config.newAccountDays} day accounts)`,
        timestamp: new Date().toISOString(),
        acknowledged: false,
      };
      alerts.push(alert);
      this.addAlert(alert);
      allowed = false;
    }

    return { allowed, alerts, restriction };
  }

  // ── Post-Transfer Tracking ─────────────────────────────────────────────

  /**
   * Called after each successful transfer to update counters.
   */
  recordTransfer(userId: string, amount: number): void {
    const today = new Date().toISOString().substring(0, 10);
    const counter = this.dailyCounters.get(userId);

    if (!counter || counter.date !== today) {
      this.dailyCounters.set(userId, { date: today, count: 1 });
      return;
    }

    counter.count++;
    this.dailyCounters.set(userId, counter);

    // High-frequency check
    if (counter.count > this.config.highFrequencyThreshold) {
      this.restrictUser(userId, `High frequency: ${counter.count} transfers today`);
      this.addAlert({
        id: `RISK-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: 'high_frequency',
        severity: 'BLOCK',
        userId,
        details: `High frequency restriction: ${counter.count} transfers today (>${this.config.highFrequencyThreshold})`,
        timestamp: new Date().toISOString(),
        acknowledged: false,
      });
    }
  }

  // ── Restrictions ───────────────────────────────────────────────────────

  private restrictUser(userId: string, reason: string): TempRestriction {
    const restriction: TempRestriction = {
      userId,
      reason,
      restrictedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + this.config.tempRestrictionMinutes * 60000).toISOString(),
      restrictionType: 'p2p_send_limit',
    };
    this.restrictions.set(userId, restriction);
    return restriction;
  }

  getActiveRestriction(userId: string): TempRestriction | undefined {
    const r = this.restrictions.get(userId);
    if (!r) return undefined;
    if (new Date(r.expiresAt).getTime() <= Date.now()) {
      // Expired, clean up
      this.restrictions.delete(userId);
      return undefined;
    }
    return r;
  }

  clearRestriction(userId: string): void {
    this.restrictions.delete(userId);
  }

  // ── Alerts ─────────────────────────────────────────────────────────────

  private addAlert(alert: RiskAlert): void {
    this.alerts.push(alert);
  }

  getAlerts(filter?: {
    acknowledged?: boolean;
    type?: string;
    userId?: string;
    limit?: number;
  }): RiskAlert[] {
    let results = [...this.alerts].reverse();
    if (filter?.acknowledged !== undefined) results = results.filter(a => a.acknowledged === filter.acknowledged);
    if (filter?.type) results = results.filter(a => a.type === filter.type);
    if (filter?.userId) results = results.filter(a => a.userId === filter.userId);
    return results.slice(0, filter?.limit ?? 50);
  }

  acknowledgeAlert(alertId: string): void {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) alert.acknowledged = true;
  }

  getUnacknowledgedCount(): number {
    return this.alerts.filter(a => !a.acknowledged).length;
  }

  // ── Daily Counters ─────────────────────────────────────────────────────

  getDailyCount(userId: string): number {
    const today = new Date().toISOString().substring(0, 10);
    const counter = this.dailyCounters.get(userId);
    if (counter && counter.date === today) return counter.count;
    return 0;
  }

  // ── Config ─────────────────────────────────────────────────────────────

  updateConfig(patch: Partial<RiskConfig>): RiskConfig {
    Object.assign(this.config, patch);
    return this.config;
  }

  getConfig(): RiskConfig {
    return { ...this.config };
  }

  // ── Reset ──────────────────────────────────────────────────────────────

  reset(): void {
    this.alerts = [];
    this.dailyCounters.clear();
    this.restrictions.clear();
    this.config = { ...DEFAULT_RISK_CONFIG };
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let _riskMonitor: BusinessRiskMonitor | null = null;

export function getBusinessRiskMonitor(): BusinessRiskMonitor {
  if (!_riskMonitor) _riskMonitor = new BusinessRiskMonitor();
  return _riskMonitor;
}

export function resetBusinessRiskMonitor(): void {
  _riskMonitor?.reset();
  _riskMonitor = null;
}

export default { BusinessRiskMonitor, getBusinessRiskMonitor, resetBusinessRiskMonitor, DEFAULT_RISK_CONFIG };

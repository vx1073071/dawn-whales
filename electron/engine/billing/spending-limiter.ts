// ── R219-auto#2 (L17): 消费上限保护 — 每日/月限额+超额拦截+提醒 ──────────
// 用户设定消费上限，系统自动拦截超额支出
// 80% 警告 + 90% 强提醒 + 100% 拦截

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type LimitPeriod = 'daily' | 'weekly' | 'monthly';

export interface SpendingLimit {
  period: LimitPeriod;
  amountUSDT: number;
  enabled: boolean;
  /** Per-service limits (optional overrides) */
  serviceLimits?: Record<string, number>; // touchpointId → max USDT
}

export interface SpendingRecord {
  id: string;
  userId: string;
  timestamp: number;
  amountUSDT: number;
  touchpointId: string;
  touchpointLabel: string;
  templateId?: string;
  description: string;
}

export interface SpendingSummary {
  userId: string;
  period: LimitPeriod;
  periodStart: number;         // unix ms
  periodEnd: number;
  totalSpent: number;
  limit: number;
  limitEnabled: boolean;
  remaining: number;
  percentUsed: number;
  status: 'ok' | 'warning' | 'critical' | 'blocked';
  breakdown: Record<string, number>; // touchpointId → spent
  transactions: number;
  lastTransactionAt: number | null;
}

export interface SpendCheckResult {
  allowed: boolean;
  reason?: string;
  remaining: number;
  limit: number;
  percentUsed: number;
  status: 'ok' | 'warning' | 'critical' | 'blocked';
  warningMessage?: string;
}

export interface SpendingAlert {
  id: string;
  userId: string;
  level: 'info' | 'warning' | 'critical' | 'blocked';
  title: string;
  message: string;
  timestamp: number;
  acknowledged: boolean;
  amountUSDT: number;
  limit: number;
  percentUsed: number;
  period: LimitPeriod;
}

export interface SpendingLimiterConfig {
  /** Default daily limit for new users */
  defaultDailyLimit: number;
  /** Default monthly limit for new users */
  defaultMonthlyLimit: number;
  /** Warn at this % threshold */
  warningThreshold: number;     // e.g., 0.80
  /** Strong alert at this % threshold */
  criticalThreshold: number;    // e.g., 0.90
  /** Max alert history per user */
  maxAlertHistory: number;
  /** Auto-reset alerts on new period */
  autoResetAlerts: boolean;
}

const DEFAULT_CONFIG: SpendingLimiterConfig = {
  defaultDailyLimit: 10,
  defaultMonthlyLimit: 50,
  warningThreshold: 0.80,
  criticalThreshold: 0.90,
  maxAlertHistory: 100,
  autoResetAlerts: true,
};

// ═══════════════════════════════════════════════════════════════════════════
// SPENDING LIMITER
// ═══════════════════════════════════════════════════════════════════════════

export class SpendingLimiter {
  private config: SpendingLimiterConfig;
  private limits = new Map<string, SpendingLimit[]>();    // userId → limits[]
  private spending = new Map<string, SpendingRecord[]>();  // userId → records
  private alerts = new Map<string, SpendingAlert[]>();     // userId → alerts
  private recordCounter = 0;
  private alertCounter = 0;

  constructor(config?: Partial<SpendingLimiterConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // LIMIT CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════════

  /** Set spending limit for a user */
  setLimit(userId: string, limit: SpendingLimit): void {
    if (!this.limits.has(userId)) {
      this.limits.set(userId, []);
    }
    // Replace existing limit for same period
    const existing = this.limits.get(userId)!;
    const idx = existing.findIndex(l => l.period === limit.period);
    if (idx >= 0) {
      existing[idx] = limit;
    } else {
      existing.push(limit);
    }
  }

  /** Set multiple limits at once */
  setLimits(userId: string, limits: SpendingLimit[]): void {
    this.limits.set(userId, limits);
  }

  /** Get user's limits */
  getLimits(userId: string): SpendingLimit[] {
    return this.limits.get(userId) ?? [];
  }

  /** Get limit for a specific period */
  getLimit(userId: string, period: LimitPeriod): SpendingLimit {
    const limits = this.limits.get(userId) ?? [];
    const found = limits.find(l => l.period === period && l.enabled);
    if (found) return found;
    // Default limit
    return {
      period,
      amountUSDT: period === 'daily'
        ? this.config.defaultDailyLimit
        : period === 'weekly'
          ? this.config.defaultDailyLimit * 5
          : this.config.defaultMonthlyLimit,
      enabled: true,
    };
  }

  /** Disable all limits for a user */
  disableAllLimits(userId: string): void {
    const limits = this.limits.get(userId);
    if (limits) {
      for (const l of limits) l.enabled = false;
    }
  }

  /** Enable/disable a specific limit */
  toggleLimit(userId: string, period: LimitPeriod, enabled: boolean): void {
    const limit = this.getLimit(userId, period);
    limit.enabled = enabled;
    this.setLimit(userId, limit);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // SPENDING RECORDS
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Record a spending event.
   */
  recordSpending(
    userId: string,
    amountUSDT: number,
    touchpointId: string,
    options?: {
      touchpointLabel?: string;
      templateId?: string;
      description?: string;
    },
  ): SpendingRecord {
    const record: SpendingRecord = {
      id: `spend_${++this.recordCounter}`,
      userId,
      timestamp: Date.now(),
      amountUSDT,
      touchpointId,
      touchpointLabel: options?.touchpointLabel ?? touchpointId,
      templateId: options?.templateId,
      description: options?.description ?? `${touchpointId}: ${amountUSDT}USDT`,
    };

    if (!this.spending.has(userId)) {
      this.spending.set(userId, []);
    }
    this.spending.get(userId)!.push(record);

    return record;
  }

  /** Get spending records for a user */
  getSpendingRecords(userId: string, options?: { limit?: number; since?: number }): SpendingRecord[] {
    let records = this.spending.get(userId) ?? [];
    records = [...records].sort((a, b) => b.timestamp - a.timestamp);

    if (options?.since) {
      records = records.filter(r => r.timestamp >= options.since);
    }
    if (options?.limit) {
      records = records.slice(0, options.limit);
    }
    return records;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // CORE: CHECK IF SPEND IS ALLOWED
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Check if a user can spend `amountUSDT` right now.
   * This is the core guard — call BEFORE every AI service charge.
   *
   * Returns a SpendCheckResult indicating:
   * - allowed: whether the spend can proceed
   * - warningMessage: if at 80%+ threshold, emit a warning
   * - status: ok/warning/critical/blocked
   */
  checkSpend(userId: string, amountUSDT: number, touchpointId?: string): SpendCheckResult {
    const now = new Date();

    // Check daily limit
    const dailySummary = this.getSummary(userId, 'daily');
    const monthlySummary = this.getSummary(userId, 'monthly');

    // Service-specific limit (if set)
    const dailyLimit = this.getLimit(userId, 'daily');
    const monthlyLimit = this.getLimit(userId, 'monthly');

    // Service limit override
    if (touchpointId && dailyLimit.serviceLimits?.[touchpointId]) {
      const serviceCap = dailyLimit.serviceLimits[touchpointId];
      const serviceSpent = dailySummary.breakdown[touchpointId] ?? 0;
      if (serviceSpent + amountUSDT > serviceCap) {
        return {
          allowed: false,
          reason: `此服务(${touchpointId})每日限额${serviceCap}USDT已超`,
          remaining: 0, limit: serviceCap,
          percentUsed: 100, status: 'blocked',
          warningMessage: `${touchpointId}已达每日限额${serviceCap}USDT`,
        };
      }
    }

    // Daily check
    if (dailyLimit.enabled) {
      const dailyAfter = dailySummary.totalSpent + amountUSDT;
      if (dailyAfter > dailyLimit.amountUSDT) {
        return {
          allowed: false,
          reason: `每日限额${dailyLimit.amountUSDT}USDT已超`,
          remaining: 0, limit: dailyLimit.amountUSDT,
          percentUsed: 100, status: 'blocked',
          warningMessage: `您已到达每日消费上限${dailyLimit.amountUSDT}USDT`,
        };
      }
    }

    // Monthly check
    if (monthlyLimit.enabled) {
      const monthlyAfter = monthlySummary.totalSpent + amountUSDT;
      if (monthlyAfter > monthlyLimit.amountUSDT) {
        return {
          allowed: false,
          reason: `月限额${monthlyLimit.amountUSDT}USDT已超`,
          remaining: 0, limit: monthlyLimit.amountUSDT,
          percentUsed: 100, status: 'blocked',
          warningMessage: `您已到达月度消费上限${monthlyLimit.amountUSDT}USDT`,
        };
      }
    }

    // Warning thresholds (daily)
    if (dailyLimit.enabled) {
      const dailyPct = dailySummary.totalSpent / Math.max(0.01, dailyLimit.amountUSDT);
      const dailyAfterPct = (dailySummary.totalSpent + amountUSDT) / dailyLimit.amountUSDT;

      if (dailyAfterPct >= 1) {
        return {
          allowed: false, reason: '已达每日上限',
          remaining: 0, limit: dailyLimit.amountUSDT,
          percentUsed: 100, status: 'blocked',
        };
      } else if (dailyPct >= this.config.criticalThreshold) {
        return {
          allowed: true,
          remaining: dailyLimit.amountUSDT - dailySummary.totalSpent,
          limit: dailyLimit.amountUSDT,
          percentUsed: Math.round(dailyPct * 100),
          status: 'critical',
          warningMessage: `⚠️ 今日已消费${Math.round(dailyPct*100)}%，接近每日上限`,
        };
      } else if (dailyPct >= this.config.warningThreshold) {
        return {
          allowed: true,
          remaining: dailyLimit.amountUSDT - dailySummary.totalSpent,
          limit: dailyLimit.amountUSDT,
          percentUsed: Math.round(dailyPct * 100),
          status: 'warning',
          warningMessage: `今日已消费${Math.round(dailyPct*100)}%`,
        };
      }
    }

    // Monthly warning
    if (monthlyLimit.enabled) {
      const monthlyPct = monthlySummary.totalSpent / Math.max(0.01, monthlyLimit.amountUSDT);
      if (monthlyPct >= this.config.criticalThreshold) {
        return {
          allowed: true,
          remaining: monthlyLimit.amountUSDT - monthlySummary.totalSpent,
          limit: monthlyLimit.amountUSDT,
          percentUsed: Math.round(monthlyPct * 100),
          status: 'critical',
          warningMessage: `⚠️ 本月已消费${Math.round(monthlyPct*100)}%，接近月度上限`,
        };
      }
    }

    return {
      allowed: true,
      remaining: dailyLimit.enabled
        ? dailyLimit.amountUSDT - dailySummary.totalSpent
        : monthlyLimit.amountUSDT - monthlySummary.totalSpent,
      limit: dailyLimit.enabled ? dailyLimit.amountUSDT : monthlyLimit.amountUSDT,
      percentUsed: dailyLimit.enabled
        ? Math.round((dailySummary.totalSpent / dailyLimit.amountUSDT) * 100)
        : Math.round((monthlySummary.totalSpent / monthlyLimit.amountUSDT) * 100),
      status: 'ok',
    };
  }

  /**
   * Attempt to spend. Returns { allowed, record } or blocked.
   * Use this as the single entry point for all AI service charges.
   */
  attemptSpend(
    userId: string,
    amountUSDT: number,
    touchpointId: string,
    options?: {
      touchpointLabel?: string;
      templateId?: string;
      description?: string;
    },
  ): { allowed: true; record: SpendingRecord } | { allowed: false; reason: string; check: SpendCheckResult } {
    const check = this.checkSpend(userId, amountUSDT, touchpointId);
    if (!check.allowed) {
      return { allowed: false, reason: check.reason ?? '超限', check };
    }

    const record = this.recordSpending(userId, amountUSDT, touchpointId, options);

    // Generate alerts if needed
    if (check.status === 'warning' || check.status === 'critical') {
      this.createSpendingAlert(userId, check, amountUSDT);
    }

    return { allowed: true, record };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════════════

  /** Get spending summary for a period */
  getSummary(userId: string, period: LimitPeriod): SpendingSummary {
    const limit = this.getLimit(userId, period);
    const range = this.getPeriodRange(period);
    const records = this.spending.get(userId) ?? [];

    const periodRecords = records.filter(r => r.timestamp >= range.start && r.timestamp < range.end);
    const totalSpent = periodRecords.reduce((s, r) => s + r.amountUSDT, 0);
    const remaining = limit.enabled ? Math.max(0, limit.amountUSDT - totalSpent) : Infinity;
    const percentUsed = limit.enabled && limit.amountUSDT > 0
      ? (totalSpent / limit.amountUSDT) * 100
      : 0;

    let status: SpendingSummary['status'] = 'ok';
    if (limit.enabled && percentUsed >= 100) status = 'blocked';
    else if (limit.enabled && percentUsed >= this.config.criticalThreshold * 100) status = 'critical';
    else if (limit.enabled && percentUsed >= this.config.warningThreshold * 100) status = 'warning';

    // Breakdown by touchpoint
    const breakdown: Record<string, number> = {};
    for (const r of periodRecords) {
      breakdown[r.touchpointId] = (breakdown[r.touchpointId] ?? 0) + r.amountUSDT;
    }

    return {
      userId, period,
      periodStart: range.start, periodEnd: range.end,
      totalSpent: Math.round(totalSpent * 100) / 100,
      limit: limit.amountUSDT,
      limitEnabled: limit.enabled,
      remaining: Math.round(remaining * 100) / 100,
      percentUsed: Math.round(percentUsed * 10) / 10,
      status, breakdown,
      transactions: periodRecords.length,
      lastTransactionAt: periodRecords.length > 0
        ? Math.max(...periodRecords.map(r => r.timestamp))
        : null,
    };
  }

  /** Get all summaries for a user */
  getAllSummaries(userId: string): SpendingSummary[] {
    return (['daily', 'weekly', 'monthly'] as LimitPeriod[])
      .map(p => this.getSummary(userId, p));
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ALERTS
  // ═══════════════════════════════════════════════════════════════════════

  private createSpendingAlert(userId: string, check: SpendCheckResult, amountUSDT: number): void {
    const dailyLimit = this.getLimit(userId, 'daily');
    const alerts = this.alerts.get(userId) ?? [];
    if (this.alerts.has(userId)) {
      this.alerts.set(userId, alerts);
    } else {
      this.alerts.set(userId, alerts);
    }

    // Don't spam - check last alert
    const lastAlert = alerts[alerts.length - 1];
    if (lastAlert && Date.now() - lastAlert.timestamp < 1800_000) return; // 30 min cooldown

    const alert: SpendingAlert = {
      id: `alert_${++this.alertCounter}`,
      userId,
      level: check.status as SpendingAlert['level'],
      title: check.status === 'critical' ? '消费接近上限' : '消费提醒',
      message: check.warningMessage ?? (check.status === 'critical' ? '今日消费接近上限' : '消费提醒'),
      timestamp: Date.now(),
      acknowledged: false,
      amountUSDT: check.percentUsed,
      limit: dailyLimit.amountUSDT,
      percentUsed: check.percentUsed,
      period: 'daily',
    };

    alerts.push(alert);

    // Trim history
    if (alerts.length > this.config.maxAlertHistory) {
      alerts.splice(0, alerts.length - this.config.maxAlertHistory);
    }
  }

  getAlerts(userId: string, options?: { acknowledged?: boolean; limit?: number }): SpendingAlert[] {
    let alerts = [...(this.alerts.get(userId) ?? [])];
    if (options?.acknowledged !== undefined) {
      alerts = alerts.filter(a => a.acknowledged === options.acknowledged);
    }
    alerts.sort((a, b) => b.timestamp - a.timestamp);
    if (options?.limit) alerts = alerts.slice(0, options.limit);
    return alerts;
  }

  acknowledgeAlert(alertId: string, userId: string): boolean {
    const alerts = this.alerts.get(userId);
    if (!alerts) return false;
    const alert = alerts.find(a => a.id === alertId);
    if (!alert) return false;
    alert.acknowledged = true;
    return true;
  }

  acknowledgeAllAlerts(userId: string): number {
    const alerts = this.alerts.get(userId);
    if (!alerts) return 0;
    let count = 0;
    for (const a of alerts) {
      if (!a.acknowledged) { a.acknowledged = true; count++; }
    }
    return count;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ADMIN
  // ═══════════════════════════════════════════════════════════════════════

  /** Admin: override a user's spending limit */
  adminSetLimit(userId: string, period: LimitPeriod, amountUSDT: number): void {
    this.setLimit(userId, { period, amountUSDT, enabled: true });
  }

  /** Admin: reset current period spending (emergency unlock) */
  adminResetPeriod(userId: string, period: LimitPeriod): void {
    const range = this.getPeriodRange(period);
    const records = this.spending.get(userId);
    if (records) {
      this.spending.set(
        userId,
        records.filter(r => r.timestamp < range.start || r.timestamp >= range.end),
      );
    }
  }

  /** Admin: view all users' summaries */
  adminGetAllUserSummaries(period: LimitPeriod): SpendingSummary[] {
    const summaries: SpendingSummary[] = [];
    for (const [userId] of Array.from(this.spending)) {
      summaries.push(this.getSummary(userId, period));
    }
    return summaries.sort((a, b) => b.percentUsed - a.percentUsed);
  }

  /** Get config */
  getConfig(): SpendingLimiterConfig { return { ...this.config }; }

  /** Update config */
  updateConfig(updates: Partial<SpendingLimiterConfig>): void {
    Object.assign(this.config, updates);
  }

  /** Reset for testing */
  reset(): void {
    this.limits.clear();
    this.spending.clear();
    this.alerts.clear();
    this.recordCounter = 0;
    this.alertCounter = 0;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PRIVATE
  // ═══════════════════════════════════════════════════════════════════════

  private getPeriodRange(period: LimitPeriod): { start: number; end: number } {
    const now = new Date();
    let start: Date, end: Date;

    if (period === 'daily') {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      end = new Date(start.getTime() + 86400000);
    } else if (period === 'weekly') {
      const day = now.getDay();
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (day === 0 ? 6 : day - 1));
      end = new Date(start.getTime() + 7 * 86400000);
    } else { // monthly
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    }

    return { start: start.getTime(), end: end.getTime() };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════

let _instance: SpendingLimiter | null = null;

export function getSpendingLimiter(config?: Partial<SpendingLimiterConfig>): SpendingLimiter {
  if (!_instance) _instance = new SpendingLimiter(config);
  return _instance;
}

export function resetSpendingLimiter(): void {
  _instance?.reset();
  _instance = null;
}

// ═══════════════════════════════════════════════════════════════════════════
// QUICK GUARD: Single-call check before any AI charge
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Quick guard — call this before every AI service charge.
 * Returns true if the spend is allowed, false if blocked.
 *
 * Usage:
 *   const guard = checkSpendingGuard(userId, 1.5, 'AI_DEEP_DIAGNOSIS');
 *   if (!guard.allowed) return { error: guard.reason };
 *   // ... proceed with AI service ...
 *   guard.record(); // confirm the spend
 */
export function checkSpendingGuard(userId: string, amountUSDT: number, touchpointId: string): {
  allowed: boolean;
  reason?: string;
  check: SpendCheckResult;
  record: () => SpendingRecord;
} {
  const limiter = getSpendingLimiter();
  const check = limiter.checkSpend(userId, amountUSDT, touchpointId);

  return {
    allowed: check.allowed,
    reason: check.reason,
    check,
    record: () => limiter.recordSpending(userId, amountUSDT, touchpointId),
  };
}

export default { SpendingLimiter, getSpendingLimiter, resetSpendingLimiter, checkSpendingGuard };

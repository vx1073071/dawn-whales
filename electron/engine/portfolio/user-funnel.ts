/**
 * J-80-01: 用户漏斗埋点 F4
 * v1.9.0 GA — Growth analytics: registration→activation→deposit→payment funnel
 *
 * @analytics tag: no personal data collection, aggregated counts only
 * API: /api/analytics/funnel returns funnel-report.json data
 */

// ── Types ──────────────────────────────────────────────────────────────────

export type FunnelStage = 'registration' | 'activation' | 'first_deposit' | 'first_payment';

export interface FunnelStep {
  stage: FunnelStage;
  label: string;
  total: number;
  dropped: number;
  dropRate: number;
  conversionRate: number;
}

export interface FunnelReport {
  generatedAt: number;
  periodDays: number;
  steps: FunnelStep[];
  totalEntered: number;
  totalCompleted: number;
  overallConversion: number;
  biggestDropStage: FunnelStage | null;
  biggestDropRate: number;
}

interface FunnelRecord {
  userId: string;
  registration: number;
  activation: number | null;
  firstDeposit: number | null;
  firstPayment: number | null;
}

// ── Engine ─────────────────────────────────────────────────────────────────

export class UserFunnelTracker {
  private records = new Map<string, FunnelRecord>();
  private periodDays = 30;

  constructor(periodDays = 30) {
    this.periodDays = periodDays;
  }

  /** Record user registration */
  trackRegistration(userId: string, timestamp = Date.now()): void {
    if (this.records.has(userId)) return;
    this.records.set(userId, {
      userId,
      registration: timestamp,
      activation: null,
      firstDeposit: null,
      firstPayment: null,
    });
  }

  /** Record first AI analysis (activation) */
  trackActivation(userId: string, timestamp = Date.now()): void {
    const r = this.records.get(userId);
    if (!r) {
      this.records.set(userId, {
        userId,
        registration: timestamp,
        activation: timestamp,
        firstDeposit: null,
        firstPayment: null,
      });
      return;
    }
    if (r.activation === null) r.activation = timestamp;
  }

  /** Record first deposit */
  trackFirstDeposit(userId: string, amount: number, timestamp = Date.now()): void {
    const r = this.records.get(userId);
    if (!r) {
      this.records.set(userId, {
        userId,
        registration: timestamp,
        activation: null,
        firstDeposit: timestamp,
        firstPayment: null,
      });
      return;
    }
    if (r.firstDeposit === null) r.firstDeposit = timestamp;
  }

  /** Record first payment */
  trackFirstPayment(userId: string, amount: number, timestamp = Date.now()): void {
    const r = this.records.get(userId);
    if (!r) {
      this.records.set(userId, {
        userId,
        registration: timestamp,
        activation: null,
        firstDeposit: null,
        firstPayment: timestamp,
      });
      return;
    }
    if (r.firstPayment === null) r.firstPayment = timestamp;
  }

  /** Generate funnel report for the current period */
  generateReport(sinceMs?: number): FunnelReport {
    const now = Date.now();
    const cutoff = sinceMs ?? now - this.periodDays * 86400000;

    const activeRecords = [...this.records.values()].filter((r) => r.registration >= cutoff);

    const steps: FunnelStep[] = [
      this.buildStep(activeRecords, 'registration', '注册', null),
      this.buildStep(activeRecords, 'activation', '激活(首次AI分析)', 'registration'),
      this.buildStep(activeRecords, 'first_deposit', '首次充值', 'activation'),
      this.buildStep(activeRecords, 'first_payment', '首次付费', 'first_deposit'),
    ];

    const totalEntered = steps[0].total;
    const lastStep = steps[steps.length - 1];
    const totalCompleted = lastStep.total;
    const overallConversion = totalEntered > 0 ? totalCompleted / totalEntered : 0;

    let biggestDropStage: FunnelStage | null = null;
    let biggestDropRate = 0;
    for (const s of steps) {
      if (s.dropRate > biggestDropRate) {
        biggestDropRate = s.dropRate;
        biggestDropStage = s.stage;
      }
    }

    return {
      generatedAt: now,
      periodDays: this.periodDays,
      steps,
      totalEntered,
      totalCompleted,
      overallConversion: Math.round(overallConversion * 10000) / 10000,
      biggestDropStage,
      biggestDropRate: Math.round(biggestDropRate * 10000) / 10000,
    };
  }

  private buildStep(
    records: FunnelRecord[],
    stage: FunnelStage,
    label: string,
    prevStage: FunnelStage | null,
  ): FunnelStep {
    const prevTotal = prevStage ? records.filter((r) => r[prevStage] !== null).length : records.length;

    const total = records.filter((r) => r[stage] !== null).length;
    const dropped = records.filter((r) => {
      if (r[stage] !== null) return false;
      if (prevStage === null) return false;
      return r[prevStage] !== null;
    }).length;

    const dropRate = prevTotal > 0 ? dropped / prevTotal : 0;
    const conversionRate = prevTotal > 0 ? total / prevTotal : total > 0 ? 1 : 0;

    return {
      stage,
      label,
      total,
      dropped,
      dropRate: Math.round(dropRate * 10000) / 10000,
      conversionRate: Math.round(conversionRate * 10000) / 10000,
    };
  }

  /** Get user count at each stage */
  getStageCounts(): Record<FunnelStage, number> {
    const records = [...this.records.values()];
    return {
      registration: records.length,
      activation: records.filter((r) => r.activation !== null).length,
      first_deposit: records.filter((r) => r.firstDeposit !== null).length,
      first_payment: records.filter((r) => r.firstPayment !== null).length,
    };
  }

  /** Reset all data */
  reset(): void {
    this.records.clear();
  }

  /** Export raw data (for debugging, no user PII) */
  export(): { totalRecords: number; stageCounts: Record<FunnelStage, number> } {
    return {
      totalRecords: this.records.size,
      stageCounts: this.getStageCounts(),
    };
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let instance: UserFunnelTracker | null = null;

export function getFunnelTracker(): UserFunnelTracker {
  if (!instance) instance = new UserFunnelTracker();
  return instance;
}

export function resetFunnelTracker(): void {
  instance?.reset();
  instance = null;
}

export default { UserFunnelTracker, getFunnelTracker, resetFunnelTracker };

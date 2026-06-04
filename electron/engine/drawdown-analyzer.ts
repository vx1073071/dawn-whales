// ── Q33: Drawdown Analyzer ─────────────────────────────────────────────────────
// Max drawdown + recovery time + duration analysis
// Underwater periods + pain ratio + attribution

import log from 'electron-log';

// ── Types ──────────────────────────────────────────────────────────────────

export interface DrawdownEvent {
  startDate: string;
  endDate: string;
  peakValue: number;
  troughValue: number;
  maxDrawdown: number;    // Absolute loss
  maxDrawdownPct: number; // Percentage
  recoveryDays: number;
  durationDays: number;
}

export interface UnderwaterPeriod {
  startDate: string;
  endDate: string;
  peakValue: number;
  troughValue: number;
  underwaterPct: number;
  isRecovered: boolean;
  recoveryDate?: string;
  daysUnderwater: number;
}

export interface DrawdownReport {
  // Summary
  peakValue: number;
  currentValue: number;
  maxDrawdownPct: number;
  maxDrawdownAbsolute: number;
  currentDrawdownPct: number;
  currentDrawdownAbsolute: number;

  // Events
  drawdownEvents: DrawdownEvent[];
  totalDrawdownPeriods: number;
  averageRecoveryDays: number;
  longestRecoveryDays: number;

  // Current underwater
  currentUnderwater: UnderwaterPeriod | null;
  daysSincePeak: number;

  // Risk metrics
  painRatio: number;        // avg return / avg drawdown
  ulcerIndex: number;       // RMS of drawdowns
  underwaterPeriods: number; // Count of periods >5% drawdown
  maxDaysUnderwater: number;

  // Attribution
  drawdownByStrategy: Record<string, number>;
  drawdownByAsset: Record<string, number>;

  // Recommendations
  riskWarnings: string[];
  timestamp: number;
}

// ── Drawdown Analyzer ───────────────────────────────────────────────────

export class DrawdownAnalyzer {
  constructor() {
    log.info('[DrawdownAnalyzer] Initialized');
  }

  // ── Build Underwater Periods ────────────────────────────────────────

  buildUnderwaterPeriods(
    equityCurve: Array<{ date: string; value: number }>
  ): UnderwaterPeriod[] {
    if (equityCurve.length < 2) return [];

    const periods: UnderwaterPeriod[] = [];
    let peak = equityCurve[0].value;
    let peakDate = equityCurve[0].date;
    let inDrawdown = false;
    let drawdownStart = '';
    let trough = peak;
    let troughDate = '';
    let troughValue = peak;

    for (const { date, value } of equityCurve) {
      if (value > peak) {
        // New peak — close any drawdown period
        if (inDrawdown && trough < peak) {
          periods.push({
            startDate: drawdownStart,
            endDate: date,
            peakValue: peak,
            troughValue: trough,
            underwaterPct: Math.round(((peak - trough) / peak) * 10000) / 100,
            isRecovered: true,
            recoveryDate: date,
            daysUnderwater: this.daysBetween(drawdownStart, date),
          });
        }
        peak = value;
        peakDate = date;
        trough = value;
        inDrawdown = false;
      } else if (value < trough) {
        trough = value;
        troughDate = date;
        inDrawdown = true;
        if (!drawdownStart) drawdownStart = peakDate;
      }
    }

    // Open drawdown
    if (inDrawdown) {
      periods.push({
        startDate: drawdownStart,
        endDate: equityCurve[equityCurve.length - 1].date,
        peakValue: peak,
        troughValue: trough,
        underwaterPct: Math.round(((peak - trough) / peak) * 10000) / 100,
        isRecovered: false,
        daysUnderwater: this.daysBetween(drawdownStart, equityCurve[equityCurve.length - 1].date),
      });
    }

    return periods;
  }

  // ── Drawdown Events ─────────────────────────────────────────────────

  extractDrawdownEvents(periods: UnderwaterPeriod[]): DrawdownEvent[] {
    return periods.map(p => ({
      startDate: p.startDate,
      endDate: p.endDate,
      peakValue: p.peakValue,
      troughValue: p.troughValue,
      maxDrawdown: Math.round((p.peakValue - p.troughValue) * 100) / 100,
      maxDrawdownPct: p.underwaterPct,
      recoveryDays: p.recoveryDate
        ? this.daysBetween(p.endDate, p.recoveryDate)
        : this.daysBetween(p.startDate, p.endDate),
      durationDays: p.daysUnderwater,
    }));
  }

  // ── Ulcer Index ──────────────────────────────────────────────────────

  calcUlcerIndex(equityCurve: Array<{ value: number }>): number {
    if (equityCurve.length < 2) return 0;
    const peak = Math.max(...equityCurve.map(e => e.value));
    const ddSquares = equityCurve.map(e =>
      ((peak - e.value) / peak) ** 2
    );
    return Math.sqrt(ddSquares.reduce((s, v) => s + v, 0) / equityCurve.length) * 100;
  }

  // ── Pain Ratio ──────────────────────────────────────────────────────

  calcPainRatio(equityCurve: Array<{ value: number; date: string }>): number {
    if (equityCurve.length < 2) return 0;

    // Total return
    const totalReturn = (equityCurve[equityCurve.length - 1].value - equityCurve[0].value)
      / equityCurve[0].value;

    // Average drawdown
    const periods = this.buildUnderwaterPeriods(equityCurve);
    const avgDD = periods.length > 0
      ? periods.reduce((s, p) => s + p.underwaterPct, 0) / periods.length
      : 0;

    return avgDD > 0 ? (totalReturn / avgDD) : 0;
  }

  // ── Full Report ─────────────────────────────────────────────────────

  generateReport(
    equityCurve: Array<{ date: string; value: number }>,
    attribution?: {
      byStrategy?: Record<string, number>;
      byAsset?: Record<string, number>;
    }
  ): DrawdownReport {
    if (equityCurve.length === 0) return this.emptyReport();

    const periods = this.buildUnderwaterPeriods(equityCurve);
    const events = this.extractDrawdownEvents(periods);
    const peak = Math.max(...equityCurve.map(e => e.value));
    const current = equityCurve[equityCurve.length - 1].value;

    // Current drawdown
    let currentUnderwater: UnderwaterPeriod | null = null;
    let daysSincePeak = 0;
    for (const p of periods) {
      if (!p.isRecovered) {
        currentUnderwater = p;
        daysSincePeak = this.daysBetween(
          equityCurve[equityCurve.length - 1].date,  // Use latest as proxy
          p.startDate
        );
        break;
      }
    }

    // Stats
    const majorDDs = events.filter(e => e.maxDrawdownPct > 5);
    const recoveries = events.filter(e => e.recoveryDays > 0);
    const avgRecovery = recoveries.length > 0
      ? recoveries.reduce((s, e) => s + e.recoveryDays, 0) / recoveries.length
      : 0;

    const ulcerIndex = this.calcUlcerIndex(equityCurve);
    const painRatio = this.calcPainRatio(equityCurve);

    const warnings: string[] = [];
    const maxDD = events.reduce((max, e) =>
      e.maxDrawdownPct > (max?.maxDrawdownPct ?? 0) ? e : max
    , events[0]);

    if (maxDD && maxDD.maxDrawdownPct > 20) {
      warnings.push(`🔴 Severe drawdown: ${maxDD.maxDrawdownPct.toFixed(1)}% — recovery may take months`);
    } else if (maxDD && maxDD.maxDrawdownPct > 10) {
      warnings.push(`⚠️ Large drawdown: ${maxDD.maxDrawdownPct.toFixed(1)}%`);
    }
    if (avgRecovery > 60) {
      warnings.push(`⚠️ Slow recovery: avg ${avgRecovery.toFixed(0)} days to break even`);
    }
    if (currentUnderwater) {
      warnings.push(`📉 Currently underwater: ${currentUnderwater.underwaterPct.toFixed(1)}% from peak`);
    }
    if (ulcerIndex > 15) {
      warnings.push(`⚠️ High ulcer index (${ulcerIndex.toFixed(1)}): frequent large drawdowns`);
    }

    return {
      peakValue: Math.round(peak * 100) / 100,
      currentValue: Math.round(current * 100) / 100,
      maxDrawdownPct: maxDD?.maxDrawdownPct ?? 0,
      maxDrawdownAbsolute: Math.round((maxDD?.maxDrawdown ?? 0) * 100) / 100,
      currentDrawdownPct: Math.round(((peak - current) / peak) * 10000) / 100,
      currentDrawdownAbsolute: Math.round((peak - current) * 100) / 100,
      drawdownEvents: events,
      totalDrawdownPeriods: events.length,
      averageRecoveryDays: Math.round(avgRecovery),
      longestRecoveryDays: Math.max(0, ...events.map(e => e.recoveryDays)),
      currentUnderwater,
      daysSincePeak,
      painRatio: Math.round(painRatio * 100) / 100,
      ulcerIndex: Math.round(ulcerIndex * 100) / 100,
      underwaterPeriods: majorDDs.length,
      maxDaysUnderwater: Math.max(0, ...events.map(e => e.durationDays)),
      drawdownByStrategy: attribution?.byStrategy ?? {},
      drawdownByAsset: attribution?.byAsset ?? {},
      riskWarnings: warnings,
      timestamp: Date.now(),
    };
  }

  // ── Helpers ─────────────────────────────────────────────────────────

  private daysBetween(date1: string, date2: string): number {
    const d1 = new Date(date1).getTime();
    const d2 = new Date(date2).getTime();
    return Math.max(0, Math.round((d2 - d1) / (1000 * 60 * 60 * 24)));
  }

  private emptyReport(): DrawdownReport {
    return {
      peakValue: 0, currentValue: 0, maxDrawdownPct: 0, maxDrawdownAbsolute: 0,
      currentDrawdownPct: 0, currentDrawdownAbsolute: 0,
      drawdownEvents: [], totalDrawdownPeriods: 0, averageRecoveryDays: 0,
      longestRecoveryDays: 0, currentUnderwater: null, daysSincePeak: 0,
      painRatio: 0, ulcerIndex: 0, underwaterPeriods: 0, maxDaysUnderwater: 0,
      drawdownByStrategy: {}, drawdownByAsset: {}, riskWarnings: [], timestamp: Date.now(),
    };
  }
}

export default DrawdownAnalyzer;
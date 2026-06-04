// ── Q34: Calendar Effects Analyzer ────────────────────────────────────────────
// Day-of-week / Month / Quarter / Holiday effects with statistical testing

import log from 'electron-log';

// ── Types ──────────────────────────────────────────────────────────────────

export interface CalendarEffect {
  name: string;
  category: 'day_of_week' | 'month' | 'quarter' | 'holiday' | 'turn_of_month';
  value: string;            // e.g. "Monday" or "January"
  avgReturn: number;
  nSamples: number;
  winRate: number;
  tStat: number;
  pValue: number;
  isSignificant: boolean;
  significanceLevel: '99%' | '95%' | '90%' | 'none';
}

export interface HolidayEffect {
  holiday: string;
  region: 'CN' | 'HK' | 'US';
  effectBefore: number;   // Return in N days before
  effectAfter: number;    // Return in N days after
  nOccurrences: number;
  avgImpact: number;
  isSignificant: boolean;
}

export interface TurnOfMonthEffect {
  window: string;           // e.g. "last2-first2"
  avgReturn: number;
  nSamples: number;
  winRate: number;
  tStat: number;
  isSignificant: boolean;
}

export interface CalendarReport {
  symbol: string;
  period: { start: string; end: string };
  effects: CalendarEffect[];
  holidayEffects: HolidayEffect[];
  turnOfMonth: TurnOfMonthEffect | null;
  strongestPositive: CalendarEffect | null;
  strongestNegative: CalendarEffect | null;
  tradingRecommendations: string[];
  timestamp: number;
}

// ── Holidays (major CN/HK/US) ──────────────────────────────────────────

const HOLIDAYS_2025: Record<string, string[]> = {
  CN: ['2025-01-01', '2025-01-28', '2025-01-29', '2025-01-30', '2025-01-31', '2025-02-01', '2025-02-02', '2025-02-03', '2025-02-04', '2025-04-04', '2025-04-05', '2025-04-06', '2025-05-01', '2025-05-02', '2025-05-03', '2025-05-04', '2025-05-05', '2025-06-01', '2025-06-02', '2025-06-08', '2025-10-01', '2025-10-02', '2025-10-03', '2025-10-04', '2025-10-05', '2025-10-06', '2025-10-07'],
  HK: ['2025-01-01', '2025-01-29', '2025-01-30', '2025-01-31', '2025-02-01', '2025-02-03', '2025-04-04', '2025-04-18', '2025-04-19', '2025-04-20', '2025-04-21', '2025-05-01', '2025-05-05', '2025-05-31', '2025-07-01', '2025-09-06', '2025-09-07', '2025-09-08', '2025-10-01', '2025-10-02', '2025-10-07', '2025-10-29'],
  US: ['2025-01-01', '2025-01-20', '2025-02-17', '2025-04-18', '2025-05-26', '2025-06-19', '2025-07-04', '2025-09-01', '2025-11-27', '2025-11-28', '2025-12-25'],
};

const HOLIDAYS_2026: Record<string, string[]> = {
  CN: ['2026-01-01', '2026-01-26', '2026-01-27', '2026-01-28', '2026-01-29', '2026-01-30', '2026-01-31', '2026-02-01', '2026-02-02', '2026-02-03', '2026-02-04', '2026-04-04', '2026-04-05', '2026-04-06', '2026-05-01', '2026-05-02', '2026-05-03', '2026-05-04', '2026-05-05', '2026-06-01', '2026-06-02', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07'],
  HK: ['2026-01-01', '2026-01-28', '2026-01-29', '2026-01-30', '2026-01-31', '2026-02-01', '2026-02-02', '2026-02-03', '2026-04-03', '2026-04-05', '2026-04-06', '2026-04-07', '2026-05-01', '2026-05-03', '2026-05-05', '2026-05-31', '2026-07-01', '2026-09-07', '2026-09-08', '2026-10-01', '2026-10-02', '2026-10-07', '2026-10-24'],
  US: ['2026-01-01', '2026-01-19', '2026-02-16', '2026-04-03', '2026-05-25', '2026-06-19', '2026-07-03', '2026-09-07', '2026-11-26', '2026-11-27', '2026-12-25'],
};

// ── Helpers ────────────────────────────────────────────────────────────

function tTest(values: number[], mu0 = 0): { tStat: number; pValue: number } {
  const n = values.length;
  if (n < 2) return { tStat: 0, pValue: 1 };
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1));
  const se = sd / Math.sqrt(n);
  const tStat = se > 0 ? (mean - mu0) / se : 0;
  // Approximate p-value using normal distribution
  const pValue = 2 * (1 - normalCDF(Math.abs(tStat)));
  return { tStat: Math.round(tStat * 100) / 100, pValue: Math.round(Math.max(0, Math.min(1, pValue)) * 1000) / 1000 };
}

// Standard error function approximation (Abramowitz & Stegun, formula 7.1.26)
export function normalCDF(x: number): number {
  if (!isFinite(x)) return x > 0 ? 1 : 0;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);
  const t = 1 / (1 + 0.2316419 * x);
  const d = 0.3989422804;
  const p = 0.319381530;
  const b = [-0.356563782, 1.781477937, -1.821255978, 1.330274429];
  const poly = 1 - d * Math.exp(-x * x * 0.5) * t * (
    p + t * (b[0] + t * (b[1] + t * (b[2] + t * b[3])))
  );
  return sign < 0 ? 1 - poly : poly;
}

export function normalPDF(x: number, mean = 0, sigma = 1): number {
  if (!isFinite(x) || !isFinite(mean) || !isFinite(sigma) || sigma <= 0) return 0;
  const z = (x - mean) / sigma;
  return Math.exp(-0.5 * z * z) / (sigma * Math.sqrt(2 * Math.PI));
}

function significanceLevel(pValue: number): CalendarEffect['significanceLevel'] {
  if (pValue < 0.01) return '99%';
  if (pValue < 0.05) return '95%';
  if (pValue < 0.10) return '90%';
  return 'none';
}

function getDayOfWeek(dateStr: string): number {
  return new Date(dateStr).getDay(); // 0 = Sunday
}

function getMonth(dateStr: string): number {
  return new Date(dateStr).getMonth(); // 0-11
}

function isHoliday(dateStr: string, region: 'CN' | 'HK' | 'US'): boolean {
  const allHolidays = [...(HOLIDAYS_2025[region] ?? []), ...(HOLIDAYS_2026[region] ?? [])];
  return allHolidays.includes(dateStr);
}

function isNearHoliday(dateStr: string, days = 3, region: 'CN' | 'HK' | 'US'): boolean {
  const d = new Date(dateStr).getTime();
  const allHolidays = [...(HOLIDAYS_2025[region] ?? []), ...(HOLIDAYS_2026[region] ?? [])];
  return allHolidays.some(h => {
    const hd = new Date(h).getTime();
    return Math.abs(d - hd) <= days * 24 * 3600 * 1000;
  });
}

function isTurnOfMonth(dateStr: string): boolean {
  const d = new Date(dateStr);
  const day = d.getDate();
  return day <= 3 || day >= 28;
}

// ── Calendar Analyzer ────────────────────────────────────────────────────

export class CalendarEffectsAnalyzer {
  constructor() {
    log.info('[CalendarEffectsAnalyzer] Initialized');
  }

  // ── Day of Week ─────────────────────────────────────────────────────

  analyzeDayOfWeek(returns: Array<{ date: string; return: number }>): CalendarEffect[] {
    const byDay: number[][] = Array.from({ length: 7 }, () => []);
    const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    for (const { date, return: ret } of returns) {
      const dow = getDayOfWeek(date);
      byDay[dow].push(ret);
    }

    return byDay.map((vals, i) => {
      if (vals.length < 5) return null;
      const { tStat, pValue } = tTest(vals);
      const wins = vals.filter(v => v > 0).length;
      return {
        name: DAY_NAMES[i],
        category: 'day_of_week' as const,
        value: DAY_NAMES[i],
        avgReturn: Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10000) / 100,
        nSamples: vals.length,
        winRate: Math.round((wins / vals.length) * 10000) / 100,
        tStat,
        pValue,
        isSignificant: pValue < 0.05,
        significanceLevel: significanceLevel(pValue),
      };
    }).filter((e): e is CalendarEffect => e !== null);
  }

  // ── Month of Year ───────────────────────────────────────────────────

  analyzeMonthOfYear(returns: Array<{ date: string; return: number }>): CalendarEffect[] {
    const byMonth: number[][] = Array.from({ length: 12 }, () => []);
    const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    for (const { date, return: ret } of returns) {
      const m = getMonth(date);
      byMonth[m].push(ret);
    }

    return byMonth.map((vals, i) => {
      if (vals.length < 3) return null;
      const { tStat, pValue } = tTest(vals);
      const wins = vals.filter(v => v > 0).length;
      return {
        name: MONTH_NAMES[i],
        category: 'month' as const,
        value: MONTH_NAMES[i],
        avgReturn: Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10000) / 100,
        nSamples: vals.length,
        winRate: Math.round((wins / vals.length) * 10000) / 100,
        tStat,
        pValue,
        isSignificant: pValue < 0.05,
        significanceLevel: significanceLevel(pValue),
      };
    }).filter((e): e is CalendarEffect => e !== null);
  }

  // ── Quarter Effects ───────────────────────────────────────────────

  analyzeQuarterEffects(returns: Array<{ date: string; return: number }>): CalendarEffect[] {
    const byQ: number[][] = Array.from({ length: 4 }, () => []);

    for (const { date, return: ret } of returns) {
      const q = Math.floor(getMonth(date) / 3);
      byQ[q].push(ret);
    }

    return byQ.map((vals, i) => {
      if (vals.length < 3) return null;
      const { tStat, pValue } = tTest(vals);
      const wins = vals.filter(v => v > 0).length;
      return {
        name: `Q${i + 1}`,
        category: 'quarter' as const,
        value: `Q${i + 1}`,
        avgReturn: Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10000) / 100,
        nSamples: vals.length,
        winRate: Math.round((wins / vals.length) * 10000) / 100,
        tStat,
        pValue,
        isSignificant: pValue < 0.05,
        significanceLevel: significanceLevel(pValue),
      };
    }).filter((e): e is CalendarEffect => e !== null);
  }

  // ── Holiday Effects ───────────────────────────────────────────────

  analyzeHolidayEffects(
    returns: Array<{ date: string; return: number }>,
    region: 'CN' | 'HK' | 'US' = 'HK',
    windowDays = 3
  ): HolidayEffect[] {
    const effects: HolidayEffect[] = [];
    const beforeReturns: Map<string, number[]> = new Map();
    const afterReturns: Map<string, number[]> = new Map();

    for (const { date, return: ret } of returns) {
      if (!isNearHoliday(date, windowDays, region)) continue;

      const holidays = [...(HOLIDAYS_2025[region] ?? []), ...(HOLIDAYS_2026[region] ?? [])];
      for (const h of holidays) {
        const hd = new Date(h).getTime();
        const dd = new Date(date).getTime();
        const diffDays = (dd - hd) / (24 * 3600 * 1000);

        if (diffDays >= -windowDays && diffDays < 0) {
          const key = `${h}-before`;
          const arr = beforeReturns.get(key) ?? [];
          arr.push(ret);
          beforeReturns.set(key, arr);
        } else if (diffDays > 0 && diffDays <= windowDays) {
          const key = `${h}-after`;
          const arr = afterReturns.get(key) ?? [];
          arr.push(ret);
          afterReturns.set(key, arr);
        }
      }
    }

    const allKeys = new Set([...beforeReturns.keys(), ...afterReturns.keys()]);
    for (const key of allKeys) {
      const [, holiday, period] = key.split('-');
      const bef = beforeReturns.get(key) ?? [];
      const aft = afterReturns.get(key) ?? [];
      const [effectBefore, effectAfter] = period === 'before'
        ? [bef, []]
        : [[], aft];
      const avgBefore = effectBefore.length > 0
        ? effectBefore.reduce((a, b) => a + b, 0) / effectBefore.length
        : 0;
      const avgAfter = effectAfter.length > 0
        ? effectAfter.reduce((a, b) => a + b, 0) / effectAfter.length
        : 0;
      const n = Math.max(effectBefore.length, effectAfter.length);
      if (n > 0) {
        const { pValue } = tTest([...effectBefore, ...effectAfter]);
        effects.push({
          holiday: holiday ?? key,
          region,
          effectBefore: Math.round(avgBefore * 10000) / 100,
          effectAfter: Math.round(avgAfter * 10000) / 100,
          nOccurrences: n,
          avgImpact: Math.round(((avgBefore + avgAfter) / 2) * 10000) / 100,
          isSignificant: pValue < 0.1,
        });
      }
    }

    return effects;
  }

  // ── Turn of Month ──────────────────────────────────────────────────

  analyzeTurnOfMonth(returns: Array<{ date: string; return: number }>): TurnOfMonthEffect | null {
    const tomReturns: number[] = [];
    const otherReturns: number[] = [];

    for (const { date, return: ret } of returns) {
      if (isTurnOfMonth(date)) tomReturns.push(ret);
      else otherReturns.push(ret);
    }

    if (tomReturns.length < 5 || otherReturns.length < 5) return null;

    const tomAvg = tomReturns.reduce((a, b) => a + b, 0) / tomReturns.length;
    const { tStat, pValue } = tTest(tomReturns);
    const wins = tomReturns.filter(v => v > 0).length;

    return {
      window: 'last3-first2 days',
      avgReturn: Math.round(tomAvg * 10000) / 100,
      nSamples: tomReturns.length,
      winRate: Math.round((wins / tomReturns.length) * 10000) / 100,
      tStat,
      isSignificant: pValue < 0.1,
    };
  }

  // ── Full Report ─────────────────────────────────────────────────────

  generateReport(
    symbol: string,
    returns: Array<{ date: string; return: number }>
  ): CalendarReport {
    log.info(`[CalendarEffects] Analyzing ${returns.length} periods for ${symbol}`);

    const dayEffects = this.analyzeDayOfWeek(returns);
    const monthEffects = this.analyzeMonthOfYear(returns);
    const quarterEffects = this.analyzeQuarterEffects(returns);
    const holidayEffects = this.analyzeHolidayEffects(returns);
    const tomEffect = this.analyzeTurnOfMonth(returns);

    const allEffects = [...dayEffects, ...monthEffects, ...quarterEffects];

    const strongestPositive = [...allEffects]
      .filter(e => e.avgReturn > 0)
      .sort((a, b) => b.avgReturn - a.avgReturn)[0] ?? null;

    const strongestNegative = [...allEffects]
      .filter(e => e.avgReturn < 0)
      .sort((a, b) => a.avgReturn - b.avgReturn)[0] ?? null;

    const recommendations: string[] = [];
    if (strongestPositive) {
      recommendations.push(`📈 Best period: ${strongestPositive.name} (${strongestPositive.avgReturn}%)`);
    }
    if (strongestNegative) {
      recommendations.push(`📉 Worst period: ${strongestNegative.name} (${strongestNegative.avgReturn}%)`);
    }
    const significant = allEffects.filter(e => e.isSignificant);
    if (significant.length > 0) {
      recommendations.push(`✅ Found ${significant.length} statistically significant effects (p<0.05)`);
    }
    if (tomEffect?.isSignificant) {
      recommendations.push(`📅 Turn-of-month effect detected: avg ${tomEffect.avgReturn}% during window`);
    }

    return {
      symbol,
      period: {
        start: returns[0]?.date ?? '',
        end: returns[returns.length - 1]?.date ?? '',
      },
      effects: allEffects,
      holidayEffects,
      turnOfMonth: tomEffect,
      strongestPositive,
      strongestNegative,
      tradingRecommendations: recommendations,
      timestamp: Date.now(),
    };
  }
}

export default CalendarEffectsAnalyzer;
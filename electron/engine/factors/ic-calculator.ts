// ══ R185 J3: IC Calculation Framework — Rolling IC + Signal Light Data Source ══
// Computes Information Coefficient (Spearman Rank IC) for factor→forward-return
// prediction quality. Serves as data source for the signal light (🟢🟡🔴⚪) system.
//
// IC Interpretation:
//   IC > 0.05   → Strong predictive power (🟢 GREEN)
//   IC 0.02-0.05 → Moderate predictive power (🟡 YELLOW)
//   IC 0-0.02   → Weak predictive power (🔴 RED)
//   IC < 0      → Inverse predictive power (🔴 RED, negative IC)
//   No data     → Unknown (⚪ GRAY)
//
// Reference: Grinold & Kahn, "Active Portfolio Management"

import type { FactorId } from './factor-id-registry';
import { resolveFactorId, getFactorMeta } from './factor-id-registry';

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

/** A single IC observation: factor value → forward return correlation */
export interface ICDataPoint {
  /** Date of the observation (Unix ms) */
  date: number;
  /** Factor value at this date */
  factorValue: number;
  /** Forward return (e.g., 1M, 3M, 6M) corresponding to this factor value */
  forwardReturn: number;
  /** Symbol the observation belongs to */
  symbol: string;
}

/** Rolling IC result for a single factor */
export interface RollingICResult {
  factorId: FactorId;
  /** Start date of the window (Unix ms) */
  windowStart: number;
  /** End date of the window (Unix ms) */
  windowEnd: number;
  /** Number of data points used */
  sampleCount: number;
  /** Spearman Rank IC */
  ic: number;
  /** Pearson IC (for comparison) */
  icPearson: number;
  /** Information Ratio = IC / std(IC). Requires IC history. */
  ir?: number;
  /** Standard deviation of IC (requires IC history) */
  icStdDev?: number;
  /** t-statistic of IC */
  tStat?: number;
  /** p-value (approximate, from t-distribution) */
  pValue?: number;
  /** IC values in the rolling window (for time-series analysis) */
  icHistory?: number[];
  /** Signal light level based on IC */
  signalLight: SignalLightLevel;
}

/** Signal light levels */
export type SignalLightLevel = 'green' | 'yellow' | 'red' | 'gray';

/** Configuration for rolling IC computation */
export interface ICCalculatorConfig {
  /** Factor IDs to compute IC for */
  factorIds: FactorId[];
  /** Rolling window size in days (default 252 = ~1 year) */
  windowDays?: number;
  /** Min data points for a valid IC computation (default 30) */
  minDataPoints?: number;
  /** Forward return horizon in days (default 20 = ~1 month) */
  forwardDays?: number;
  /** Cache TTL in ms (default 5 min) */
  cacheTtlMs?: number;
}

/** Batch IC result for multiple factors */
export interface BatchICResult {
  /** Computation timestamp */
  timestamp: number;
  /** IC results per factor */
  results: RollingICResult[];
  /** Window configuration */
  windowDays: number;
  forwardDays: number;
}

// ═══════════════════════════════════════════════════════════════════
// IC CALCULATOR
// ═══════════════════════════════════════════════════════════════════

export class ICCalculator {
  private factorIds: FactorId[];
  private windowDays: number;
  private minDataPoints: number;
  private forwardDays: number;
  private cacheTtlMs: number;
  private cache: Map<string, { result: RollingICResult; timestamp: number }> = new Map();

  constructor(config: ICCalculatorConfig) {
    this.factorIds = config.factorIds.map(resolveFactorId);
    this.windowDays = config.windowDays ?? 252;
    this.minDataPoints = config.minDataPoints ?? 30;
    this.forwardDays = config.forwardDays ?? 20;
    this.cacheTtlMs = config.cacheTtlMs ?? 300_000;
  }

  /**
   * Compute Spearman Rank correlation coefficient.
   * Non-parametric measure of monotonic relationship.
   */
  static spearmanRankCorrelation(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length < 3) return 0;

    // Rank x values
    const rankX = ICCalculator.rank(x);
    const rankY = ICCalculator.rank(y);

    // Pearson correlation of ranks = Spearman correlation
    return ICCalculator.pearsonCorrelation(rankX, rankY);
  }

  /**
   * Compute Pearson correlation coefficient.
   */
  static pearsonCorrelation(x: number[], y: number[]): number {
    const n = x.length;
    if (n < 2 || n !== y.length) return 0;

    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((a, xi, i) => a + xi * y[i], 0);
    const sumX2 = x.reduce((a, xi) => a + xi * xi, 0);
    const sumY2 = y.reduce((a, yi) => a + yi * yi, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt(
      (n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY)
    );

    if (denominator === 0 || !isFinite(denominator)) return 0;
    const r = numerator / denominator;
    return Math.max(-1, Math.min(1, r));
  }

  /**
   * Rank array values (1-based, average rank for ties).
   * Returns ranks in same order as input.
   */
  static rank(values: number[]): number[] {
    const indexed = values.map((v, i) => ({ v, i }));
    indexed.sort((a, b) => a.v - b.v);

    const ranks = new Array<number>(values.length);
    let i = 0;
    while (i < indexed.length) {
      let j = i;
      while (j < indexed.length && indexed[j].v === indexed[i].v) j++;
      const avgRank = (i + j + 1) / 2; // 1-based average
      for (let k = i; k < j; k++) {
        ranks[indexed[k].i] = avgRank;
      }
      i = j;
    }
    return ranks;
  }

  /**
   * Compute t-statistic from IC.
   * t = IC * sqrt(n - 2) / sqrt(1 - IC^2)
   */
  static tStatistic(ic: number, n: number): number {
    if (n <= 2 || Math.abs(ic) >= 1) return 0;
    return ic * Math.sqrt(n - 2) / Math.sqrt(1 - ic * ic);
  }

  /**
   * Determine signal light level from IC.
   */
  static getSignalLight(ic: number, sampleCount: number): SignalLightLevel {
    if (sampleCount < 30) return 'gray';
    if (isNaN(ic)) return 'gray';
    if (ic > 0.05) return 'green';
    if (ic >= 0.02) return 'yellow';
    return 'red';
  }

  /**
   * Compute IC for a single factor from a time-series of data points.
   */
  computeIC(
    factorId: string,
    data: ICDataPoint[],
    windowStart?: number,
    windowEnd?: number,
  ): RollingICResult {
    const resolvedId = resolveFactorId(factorId);
    const meta = getFactorMeta(resolvedId);

    // Filter to window
    let windowed = data;
    if (windowStart !== undefined) {
      windowed = data.filter(d => d.date >= windowStart);
    }
    if (windowEnd !== undefined) {
      windowed = windowed.filter(d => d.date <= windowEnd);
    }

    const actualStart = windowed.length > 0 ? windowed[0].date : (windowStart ?? 0);
    const actualEnd = windowed.length > 0 ? windowed[windowed.length - 1].date : (windowEnd ?? Date.now());

    if (windowed.length < this.minDataPoints) {
      return {
        factorId: resolvedId,
        windowStart: actualStart,
        windowEnd: actualEnd,
        sampleCount: windowed.length,
        ic: 0,
        icPearson: 0,
        signalLight: 'gray',
      };
    }

    const factorValues = windowed.map(d => d.factorValue);
    const forwardReturns = windowed.map(d => d.forwardReturn);

    const ic = ICCalculator.spearmanRankCorrelation(factorValues, forwardReturns);
    const icPearson = ICCalculator.pearsonCorrelation(factorValues, forwardReturns);
    const tStat = ICCalculator.tStatistic(ic, windowed.length);

    const result: RollingICResult = {
      factorId: resolvedId,
      windowStart: actualStart,
      windowEnd: actualEnd,
      sampleCount: windowed.length,
      ic,
      icPearson,
      tStat: isFinite(tStat) ? tStat : undefined,
      signalLight: ICCalculator.getSignalLight(ic, windowed.length),
    };

    return result;
  }

  /**
   * Compute rolling IC with IC history (for IR calculation).
   */
  computeRollingIC(
    factorId: string,
    data: ICDataPoint[],
    windowStart: number,
    windowEnd: number,
    subWindowDays?: number,
  ): RollingICResult {
    const resolvedId = resolveFactorId(factorId);
    const baseResult = this.computeIC(resolvedId, data, windowStart, windowEnd);

    // Compute IC history in sub-windows for IR
    const subWindow = subWindowDays ?? 20; // ~1 month sub-windows
    const icHistory: number[] = [];
    let subStart = windowStart;

    while (subStart < windowEnd) {
      const subEnd = Math.min(subStart + subWindow * 86400000, windowEnd);
      const subData = data.filter(d => d.date >= subStart && d.date <= subEnd);
      if (subData.length >= this.minDataPoints) {
        const subIC = ICCalculator.spearmanRankCorrelation(
          subData.map(d => d.factorValue),
          subData.map(d => d.forwardReturn),
        );
        icHistory.push(isFinite(subIC) ? subIC : 0);
      }
      subStart = subEnd;
    }

    if (icHistory.length >= 2) {
      const icMean = icHistory.reduce((a, b) => a + b, 0) / icHistory.length;
      const icVar = icHistory.reduce((a, b) => a + (b - icMean) ** 2, 0) / icHistory.length;
      const icStd = Math.sqrt(icVar);
      baseResult.icStdDev = icStd;
      baseResult.ir = icStd > 0 ? icMean / icStd : 0;
      baseResult.icHistory = icHistory;
    }

    return baseResult;
  }

  /**
   * Compute batch IC for all configured factors.
   */
  computeBatchIC(dataMap: Record<string, ICDataPoint[]>): BatchICResult {
    const timestamp = Date.now();
    const results: RollingICResult[] = [];

    for (const factorId of this.factorIds) {
      // Check cache
      const cacheKey = `${factorId}:${this.windowDays}:${this.forwardDays}`;
      const cached = this.cache.get(cacheKey);
      if (cached && timestamp - cached.timestamp < this.cacheTtlMs) {
        results.push(cached.result);
        continue;
      }

      const data = dataMap[factorId] ?? [];
      const windowStart = timestamp - this.windowDays * 86400000;
      const result = this.computeRollingIC(factorId, data, windowStart, timestamp);
      results.push(result);

      // Update cache
      this.cache.set(cacheKey, { result, timestamp });
    }

    return {
      timestamp,
      results,
      windowDays: this.windowDays,
      forwardDays: this.forwardDays,
    };
  }

  /**
   * Get signal light summary (count per level) for all factors.
   */
  getSignalLightSummary(results: RollingICResult[]): Record<SignalLightLevel, number> {
    const summary: Record<SignalLightLevel, number> = { green: 0, yellow: 0, red: 0, gray: 0 };
    for (const r of results) {
      summary[r.signalLight] = (summary[r.signalLight] || 0) + 1;
    }
    return summary;
  }

  /**
   * Get top N factors by IC.
   */
  getTopFactors(results: RollingICResult[], n: number): RollingICResult[] {
    return [...results]
      .filter(r => r.sampleCount >= this.minDataPoints)
      .sort((a, b) => b.ic - a.ic)
      .slice(0, n);
  }

  /**
   * Get bottom N factors by IC (potential candidates for review).
   */
  getBottomFactors(results: RollingICResult[], n: number): RollingICResult[] {
    return [...results]
      .filter(r => r.sampleCount >= this.minDataPoints)
      .sort((a, b) => a.ic - b.ic)
      .slice(0, n);
  }

  /**
   * Clear cache.
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache size.
   */
  getCacheSize(): number {
    return this.cache.size;
  }
}

// ═══════════════════════════════════════════════════════════════════
// SIGNAL LIGHT HELPERS
// ═══════════════════════════════════════════════════════════════════

/** Signal light colors for UI */
export const SIGNAL_LIGHT_COLORS: Record<SignalLightLevel, { color: string; hex: string; label: string; emoji: string }> = {
  green:  { color: 'green',  hex: '#22c55e', label: 'Strong', emoji: '🟢' },
  yellow: { color: 'yellow', hex: '#eab308', label: 'Moderate', emoji: '🟡' },
  red:    { color: 'red',    hex: '#ef4444', label: 'Weak / Inverse', emoji: '🔴' },
  gray:   { color: 'gray',   hex: '#9ca3af', label: 'No Data', emoji: '⚪' },
};

/** Get signal light emoji for an IC value */
export function getSignalLightEmoji(ic: number, sampleCount: number): string {
  const level = ICCalculator.getSignalLight(ic, sampleCount);
  return SIGNAL_LIGHT_COLORS[level].emoji;
}

/** Get signal light color hex for an IC value */
export function getSignalLightColor(ic: number, sampleCount: number): string {
  const level = ICCalculator.getSignalLight(ic, sampleCount);
  return SIGNAL_LIGHT_COLORS[level].hex;
}

/** Get signal light label for an IC value */
export function getSignalLightLabel(ic: number, sampleCount: number): string {
  const level = ICCalculator.getSignalLight(ic, sampleCount);
  return SIGNAL_LIGHT_COLORS[level].label;
}

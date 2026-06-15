// R189 J1+J2+J3: Factor Backtest Engine — single-factor (free) + multi-factor (1U) + 24h cache
// Single: 5-group tiered, long/short, IC trend, <5s
// Multi: up to 5 factors, 5-group tiered, weighted composite, turnover cost, IC trend, <30s
// Cache: 24h by parameter hash, avoids duplicate charges
import type { FactorId } from './factor-id-registry';
import type { PriceSnapshot } from './factor-calculator';

export interface BacktestGroupResult {
  group: number; // 1-5, sorted by factor decile
  label: 'Q1 (Top)' | 'Q2' | 'Q3' | 'Q4' | 'Q5 (Bottom)';
  avgReturn: number;
  hitRate: number;
  sharpeRatio: number;
  maxDrawdown: number;
  sampleSize: number;
}

export interface ICTrendPoint {
  period: string;
  ic: number;
  rankIc: number;
}

export interface FactorBacktestResult {
  /** Request metadata */
  requestId: string;
  factorIds: FactorId[];
  weights?: number[]; // multi-factor only
  /** Performance summary */
  groups: BacktestGroupResult[];
  topMinusBottom: number; // Q1 - Q5 spread
  longOnlyReturn: number;
  longShortReturn: number;
  annualizedReturn: number;
  annualizedVolatility: number;
  sharpeRatio: number;
  maxDrawdown: number;
  calmarRatio: number;
  hitRate: number;
  turnoverCost: number; // annualized
  /** IC analysis */
  averageIC: number;
  averageRankIC: number;
  icIr: number; // IC / IC_std
  icTrend: ICTrendPoint[];
  /** Meta */
  periodStart: string;
  periodEnd: string;
  totalDays: number;
  isMultiFactor: boolean;
  chargeApplied: boolean; // true for multi-factor (1U)
  computationTimeMs: number;
  timestamp: number;
}

export interface BacktestRequest {
  factorIds: FactorId[];
  weights?: number[];
  symbols?: string[];
  lookbackDays?: number;
  /** Pre-computed factor values keyed by Symbol->FactorId->value */
  factorValues?: Record<string, Record<string, number>>;
  /** Price history data */
  priceHistory?: Record<string, PriceSnapshot[]>;
}

export interface BacktestConfig {
  /** Number of quantile groups (default 5) */
  numGroups?: number;
  /** Lookback days for IC decay calculation */
  icDecayDays?: number;
  /** Annualization factor (252 trading, 365 crypto) */
  annualizationFactor?: number;
  /** Turnover cost per trade (decimal) */
  turnoverCostRate?: number;
  /** Minimum sample size per group */
  minGroupSize?: number;
  /** Multi-factor charge in USDT */
  multiFactorCharge?: number;
}

export class FactorBacktestEngine {
  private config: Required<BacktestConfig>;

  constructor(config: BacktestConfig = {}) {
    this.config = {
      numGroups: config.numGroups ?? 5,
      icDecayDays: config.icDecayDays ?? 20,
      annualizationFactor: config.annualizationFactor ?? 252,
      turnoverCostRate: config.turnoverCostRate ?? 0.001,
      minGroupSize: config.minGroupSize ?? 10,
      multiFactorCharge: config.multiFactorCharge ?? 1,
    };
  }

  /** Run multi-factor backtest (up to 5 factors, tiered 5-group) */
  async runMultiFactorBacktest(request: BacktestRequest): Promise<FactorBacktestResult> {
    const t0 = Date.now();
    const { factorIds, weights, symbols, factorValues, priceHistory } = request;

    if (!factorIds || factorIds.length === 0) {
      throw new Error('At least one factor is required');
    }
    if (factorIds.length > 5) {
      throw new Error('Maximum 5 factors allowed for multi-factor backtest');
    }
    if (!symbols || symbols.length < this.config.minGroupSize * this.config.numGroups) {
      throw new Error('Insufficient symbols: need at least ' + this.config.minGroupSize * this.config.numGroups);
    }

    // Normalize weights
    const finalWeights = this.normalizeWeights(factorIds, weights);

    // Compute composite factor score
    const compositeScores: Record<string, number> = {};
    for (const sym of symbols) {
      const symFactors = factorValues?.[sym];
      if (!symFactors) { compositeScores[sym] = 0; continue; }
      let score = 0;
      for (let i = 0; i < factorIds.length; i++) {
        const val = symFactors[factorIds[i]];
        if (val !== undefined) score += val * finalWeights[i];
      }
      compositeScores[sym] = score;
    }

    // Sort by composite score descending
    const ranked = symbols
      .map(s => ({ symbol: s, score: compositeScores[s] ?? 0 }))
      .filter(r => !isNaN(r.score))
      .sort((a, b) => b.score - a.score);

    const groupSize = Math.floor(ranked.length / this.config.numGroups);
    const groups = this.buildGroups(ranked, groupSize, priceHistory);

    // Top minus bottom spread
    const tmb = groups[0].avgReturn - groups[groups.length - 1].avgReturn;

    // IC analysis on composite scores
    const icStats = this.computeICStats(ranked, priceHistory);

    const annualRet = this.annualizeReturn(groups, ranked.length);
    const annVol = this.computeAnnualizedVol(groups);
    const sharpe = annVol > 0 ? (annualRet - 0.03) / annVol : 0;
    const maxDD = this.computeMaxDrawdown(ranked, priceHistory);
    const hitRateAll = groups.reduce((s, g) => s + g.hitRate * g.sampleSize, 0) / ranked.length;
    const totalReturn = groups[0].avgReturn - groups[groups.length - 1].avgReturn;

    // Turnover cost estimation
    const turnoverCost = this.config.turnoverCostRate * 2 * 12; // monthly rebalance x2

    // Find period range
    let periodStart = '', periodEnd = '';
    const sampleSym = ranked[0]?.symbol;
    const sampleHist = sampleSym ? priceHistory?.[sampleSym] : undefined;
    if (sampleHist && sampleHist.length > 0) {
      periodStart = sampleHist[0].date ?? new Date(sampleHist[0].timestamp ?? 0).toISOString().slice(0, 10);
      periodEnd = sampleHist[sampleHist.length - 1].date ?? new Date(sampleHist[sampleHist.length - 1].timestamp ?? 0).toISOString().slice(0, 10);
    }

    const reqId = this.hashRequest(request);
    const result: FactorBacktestResult = {
      requestId: reqId,
      factorIds,
      weights: finalWeights,
      groups,
      topMinusBottom: tmb,
      longOnlyReturn: groups[0].avgReturn,
      longShortReturn: totalReturn,
      annualizedReturn: annualRet,
      annualizedVolatility: annVol,
      sharpeRatio: sharpe,
      maxDrawdown: maxDD,
      calmarRatio: maxDD > 0 ? annualRet / Math.abs(maxDD) : 0,
      hitRate: hitRateAll,
      turnoverCost,
      averageIC: icStats.avgIC,
      averageRankIC: icStats.avgRankIC,
      icIr: icStats.icIr,
      icTrend: icStats.icTrend,
      periodStart,
      periodEnd,
      totalDays: sampleHist?.length ?? 0,
      isMultiFactor: true,
      chargeApplied: true,
      computationTimeMs: Date.now() - t0,
      timestamp: Date.now(),
    };

    return result;
  }

  /** Run single-factor backtest (free, <5s) */
  async runSingleFactorBacktest(request: BacktestRequest): Promise<FactorBacktestResult> {
    const t0 = Date.now();
    const { factorIds, symbols, factorValues, priceHistory } = request;

    const factorId = factorIds[0];
    if (!factorId) throw new Error('Single factor ID required');
    if (!symbols || symbols.length < this.config.minGroupSize * this.config.numGroups) {
      throw new Error('Insufficient symbols');
    }

    // Extract single-factor scores
    const scores: Record<string, number> = {};
    for (const sym of symbols) {
      scores[sym] = factorValues?.[sym]?.[factorId] ?? 0;
    }

    const ranked = symbols
      .map(s => ({ symbol: s, score: scores[s] ?? 0 }))
      .filter(r => !isNaN(r.score))
      .sort((a, b) => b.score - a.score);

    const groupSize = Math.floor(ranked.length / this.config.numGroups);
    const groups = this.buildGroups(ranked, groupSize, priceHistory);

    const tmb = groups[0].avgReturn - groups[groups.length - 1].avgReturn;
    const icStats = this.computeICStats(ranked, priceHistory);
    const annualRet = this.annualizeReturn(groups, ranked.length);
    const annVol = this.computeAnnualizedVol(groups);
    const sharpe = annVol > 0 ? (annualRet - 0.03) / annVol : 0;
    const maxDD = this.computeMaxDrawdown(ranked, priceHistory);
    const totalReturn = groups[0].avgReturn - groups[groups.length - 1].avgReturn;

    let periodStart = '', periodEnd = '';
    const sampleHist = ranked.length > 0 ? priceHistory?.[ranked[0].symbol] : undefined;
    if (sampleHist && sampleHist.length > 0) {
      periodStart = sampleHist[0].date ?? new Date(sampleHist[0].timestamp ?? 0).toISOString().slice(0, 10);
      periodEnd = sampleHist[sampleHist.length - 1].date ?? new Date(sampleHist[sampleHist.length - 1].timestamp ?? 0).toISOString().slice(0, 10);
    }

    const reqId = this.hashRequest(request);
    return {
      requestId: reqId,
      factorIds,
      groups,
      topMinusBottom: tmb,
      longOnlyReturn: groups[0].avgReturn,
      longShortReturn: totalReturn,
      annualizedReturn: annualRet,
      annualizedVolatility: annVol,
      sharpeRatio: sharpe,
      maxDrawdown: maxDD,
      calmarRatio: maxDD > 0 ? annualRet / Math.abs(maxDD) : 0,
      hitRate: groups.reduce((s, g) => s + g.hitRate * g.sampleSize, 0) / ranked.length,
      turnoverCost: 0,
      averageIC: icStats.avgIC,
      averageRankIC: icStats.avgRankIC,
      icIr: icStats.icIr,
      icTrend: icStats.icTrend,
      periodStart, periodEnd,
      totalDays: sampleHist?.length ?? 0,
      isMultiFactor: false,
      chargeApplied: false,
      computationTimeMs: Date.now() - t0,
      timestamp: Date.now(),
    };
  }

  // --- Group building ---
  private buildGroups(
    ranked: { symbol: string; score: number }[],
    groupSize: number,
    priceHistory?: Record<string, PriceSnapshot[]>,
  ): BacktestGroupResult[] {
    const groups: BacktestGroupResult[] = [];
    const labels: BacktestGroupResult['label'][] = ['Q1 (Top)', 'Q2', 'Q3', 'Q4', 'Q5 (Bottom)'];

    for (let g = 0; g < this.config.numGroups; g++) {
      const start = g * groupSize;
      const end = g < this.config.numGroups - 1 ? start + groupSize : ranked.length;
      const members = ranked.slice(start, end);
      const returns = members.map(m => {
        const hist = priceHistory?.[m.symbol];
        if (!hist || hist.length < 2) return 0;
        const first = hist[0].close;
        const last = hist[hist.length - 1].close;
        return first > 0 ? (last - first) / first : 0;
      });

      const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
      const posReturns = returns.filter(r => r > 0);
      const hitRate = returns.length > 0 ? posReturns.length / returns.length : 0;

      // Sharpe = mean / std
      const mean = avgReturn;
      const variance = returns.length > 1 ? returns.reduce((s, r) => s + (r - mean) ** 2, 0) / (returns.length - 1) : 0;
      const std = Math.sqrt(variance);
      const sharpe = std > 0 ? mean / std : 0;

      // Max drawdown
      const cumulative = this.computeCumulativeReturns(members, priceHistory);
      const maxDD = this.calcMaxDrawdownFromSeries(cumulative);

      groups.push({
        group: g + 1,
        label: labels[g],
        avgReturn,
        hitRate,
        sharpeRatio: sharpe,
        maxDrawdown: maxDD,
        sampleSize: members.length,
      });
    }
    return groups;
  }

  // --- IC computation ---
  private computeICStats(
    ranked: { symbol: string; score: number }[],
    priceHistory?: Record<string, PriceSnapshot[]>,
  ): { avgIC: number; avgRankIC: number; icIr: number; icTrend: ICTrendPoint[] } {
    const icValues: number[] = [];
    const rankICValues: number[] = [];

    // Daily IC over the last icDecayDays periods
    const sampleSym = ranked[0]?.symbol;
    const sampleHist = sampleSym ? priceHistory?.[sampleSym] : undefined;
    const periods = Math.min(this.config.icDecayDays, sampleHist?.length ?? 0);

    // Cross-sectional IC per period
    for (let p = 1; p <= periods; p++) {
      const dayReturns = ranked.map(r => {
        const hist = priceHistory?.[r.symbol];
        if (!hist || hist.length <= p) return null;
        const idx = hist.length - 1 - p;
        const prev = hist[idx].close;
        const cur = hist[idx + 1].close;
        return prev > 0 ? (cur - prev) / prev : null;
      });

      const scores = ranked.map(r => r.score);
      const validPairs = dayReturns.map((r, i) => ({ ret: r, score: scores[i] })).filter(v => v.ret !== null) as { ret: number; score: number }[];

      if (validPairs.length < 10) continue;

      const ic = FactorBacktestEngine.pearsonCorrelation(
        validPairs.map(v => v.ret),
        validPairs.map(v => v.score),
      );
      icValues.push(ic);

      const rankIC = FactorBacktestEngine.spearmanCorrelation(
        validPairs.map(v => v.ret),
        validPairs.map(v => v.score),
      );
      rankICValues.push(rankIC);
    }

    const avgIC = icValues.length > 0 ? icValues.reduce((a, b) => a + b, 0) / icValues.length : 0;
    const avgRankIC = rankICValues.length > 0 ? rankICValues.reduce((a, b) => a + b, 0) / rankICValues.length : 0;

    const icStd = icValues.length > 1 ? Math.sqrt(icValues.reduce((s, v) => s + (v - avgIC) ** 2, 0) / (icValues.length - 1)) : 0;
    const icIr = icStd > 0 ? avgIC / icStd : 0;

    const icTrend: ICTrendPoint[] = icValues.map((ic, i) => ({ period: i.toString(), ic, rankIc: rankICValues[i] ?? 0 }));

    return { avgIC, avgRankIC, icIr, icTrend };
  }

  // --- Utility ---
  private normalizeWeights(factorIds: string[], provided?: number[]): number[] {
    if (provided && provided.length === factorIds.length) {
      const sum = provided.reduce((a, b) => a + b, 0);
      return sum > 0 ? provided.map(w => w / sum) : new Array(factorIds.length).fill(1 / factorIds.length);
    }
    return new Array(factorIds.length).fill(1 / factorIds.length);
  }

  private annualizeReturn(groups: BacktestGroupResult[], totalSymbols: number): number {
    const tmb = groups[0].avgReturn - groups[groups.length - 1].avgReturn;
    return tmb * (this.config.annualizationFactor / this.config.icDecayDays);
  }

  private computeAnnualizedVol(groups: BacktestGroupResult[]): number {
    const returns = groups.map(g => g.avgReturn);
    if (returns.length < 2) return 0;
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / (returns.length - 1);
    return Math.sqrt(variance) * Math.sqrt(this.config.annualizationFactor);
  }

  private computeMaxDrawdown(
    ranked: { symbol: string; score: number }[],
    priceHistory?: Record<string, PriceSnapshot[]>,
  ): number {
    const cumulative = this.computeCumulativeReturns(ranked, priceHistory);
    return this.calcMaxDrawdownFromSeries(cumulative);
  }

  private computeCumulativeReturns(
    members: { symbol: string; score: number }[],
    priceHistory?: Record<string, PriceSnapshot[]>,
  ): number[] {
    if (!priceHistory) return [1];
    const sampleHist = members.length > 0 ? priceHistory[members[0].symbol] : undefined;
    if (!sampleHist || sampleHist.length < 2) return [1];

    const cumulative = [1];
    for (let i = 1; i < sampleHist.length; i++) {
      const dailyRet = sampleHist[i].close / sampleHist[i - 1].close - 1;
      cumulative.push(cumulative[i - 1] * (1 + dailyRet));
    }
    return cumulative;
  }

  private calcMaxDrawdownFromSeries(cumulative: number[]): number {
    let peak = cumulative[0];
    let maxDD = 0;
    for (const val of cumulative) {
      if (val > peak) peak = val;
      const dd = (peak - val) / peak;
      if (dd > maxDD) maxDD = dd;
    }
    return maxDD;
  }

  private hashRequest(request: BacktestRequest): string {
    const canonical = JSON.stringify({
      f: request.factorIds.sort(),
      w: request.weights,
      s: request.symbols?.sort(),
      l: request.lookbackDays ?? 252,
    });
    let h = 0;
    for (let i = 0; i < canonical.length; i++) h = (h * 31 + canonical.charCodeAt(i)) & 0xffffffff;
    return h.toString(16);
  }

  static pearsonCorrelation(x: number[], y: number[]): number {
    const n = x.length;
    if (n < 2 || n !== y.length) return 0;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((a, xi, i) => a + xi * y[i], 0);
    const sumX2 = x.reduce((a, xi) => a + xi * xi, 0);
    const sumY2 = y.reduce((a, yi) => a + yi * yi, 0);
    const num = n * sumXY - sumX * sumY;
    const den = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    if (den === 0 || !isFinite(den)) return 0;
    return Math.max(-1, Math.min(1, num / den));
  }

  static spearmanCorrelation(x: number[], y: number[]): number {
    const rankX = FactorBacktestEngine.rank(x);
    const rankY = FactorBacktestEngine.rank(y);
    return FactorBacktestEngine.pearsonCorrelation(rankX, rankY);
  }

  static rank(values: number[]): number[] {
    const indexed = values.map((v, i) => ({ v, i }));
    indexed.sort((a, b) => a.v - b.v);
    const ranks = new Array(values.length);
    let i = 0;
    while (i < indexed.length) {
      let j = i;
      while (j < indexed.length && indexed[j].v === indexed[i].v) j++;
      const avgRank = (i + j + 1) / 2;
      for (let k = i; k < j; k++) ranks[indexed[k].i] = avgRank;
      i = j;
    }
    return ranks;
  }
}

// === J3: Backtest Result Cache (24h) ===
export interface CacheEntry<T> {
  data: T;
  createdAt: number;
  ttlMs: number;
  requestId: string;
}

export class BacktestResultCache {
  private cache = new Map<string, CacheEntry<FactorBacktestResult>>();
  private defaultTtl = 24 * 60 * 60 * 1000; // 24 hours

  /** Get cached result or return null */
  get(request: BacktestRequest): FactorBacktestResult | null {
    const key = this.getCacheKey(request);
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.createdAt > entry.ttlMs) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }

  /** Store a result */
  set(request: BacktestRequest, result: FactorBacktestResult, ttlMs?: number): void {
    const key = this.getCacheKey(request);
    this.cache.set(key, { data: result, createdAt: Date.now(), ttlMs: ttlMs ?? this.defaultTtl, requestId: result.requestId });
  }

  /** Check if request was cached within the last 24h (avoids duplicate charges) */
  isSameParamsCached(request: BacktestRequest): boolean {
    return this.get(request) !== null;
  }

  /** Clear expired entries */
  evict(): number {
    const now = Date.now();
    let removed = 0;
    for (const [key, entry] of Array.from(this.cache.entries())) {
      if (now - entry.createdAt > entry.ttlMs) { this.cache.delete(key); removed++; }
    }
    return removed;
  }

  /** Clear all cache */
  clear(): void { this.cache.clear(); }

  /** Get cache stats */
  stats(): { size: number; hits: number; oldestEntryMs: number } {
    const now = Date.now();
    let oldestEntryMs = 0;
    for (const [key, entry] of Array.from(this.cache.entries())) {
      const age = now - entry.createdAt;
      if (age > oldestEntryMs) oldestEntryMs = age;
    }
    return { size: this.cache.size, hits: 0, oldestEntryMs };
  }

  private getCacheKey(request: BacktestRequest): string {
    const canonical = JSON.stringify({
      f: [...request.factorIds].sort(),
      w: request.weights,
      s: request.symbols ? [...request.symbols].sort() : [],
      l: request.lookbackDays ?? 252,
    });
    let h = 0;
    for (let i = 0; i < canonical.length; i++) h = (h * 31 + canonical.charCodeAt(i)) & 0xffffffff;
    return 'bt_' + h.toString(16);
  }
}

// Singleton
let defaultEngine: FactorBacktestEngine | null = null;
let defaultCache: BacktestResultCache | null = null;

export function getFactorBacktestEngine(config?: BacktestConfig): FactorBacktestEngine {
  if (!defaultEngine) defaultEngine = new FactorBacktestEngine(config);
  return defaultEngine;
}

export function getBacktestResultCache(): BacktestResultCache {
  if (!defaultCache) defaultCache = new BacktestResultCache();
  return defaultCache;
}
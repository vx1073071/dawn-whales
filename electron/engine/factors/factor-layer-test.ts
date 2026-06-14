// ── R165 P1-R3: Factor Layer Test — 分层回测引擎 ─────────────────────────
// Sorts stocks into N groups by factor value, computes group returns,
// top-minus-bottom spread, long-short P&L, and turnover cost.
//
// Methods:
//   LayerTestEngine.runLayerTest(factorValues, returns, config) → LayerTestResult
//   - Group stocks into N quantile buckets by factor rank
//   - Compute equal-weighted return per group per period
//   - Top - Bottom = Long-Short spread
//   - Track cumulative returns, IR, hit rate, max drawdown
//   - Include turnover cost based on signal stability
//
// Usage:
//   const engine = new LayerTestEngine({ numGroups: 10, rebalanceFrequency: 'monthly', turnoverCostBps: 3 });
//   const result = engine.runLayerTest(factorValues, forwardReturns, marketData);

import log from 'electron-log';

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface LayerTestConfig {
  /** Number of quantile groups (5 or 10, default: 10) */
  numGroups: number;
  /** Rebalance frequency */
  rebalanceFrequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  /** Turnover cost in basis points (default: 3bps) */
  turnoverCostBps: number;
  /** Minimum stocks per group (groups with fewer are merged) */
  minStocksPerGroup: number;
  /** If true, compute long-short spread (Top - Bottom group return) */
  enableLongShort: boolean;
  /** Number of periods to skip at start (for look-ahead bias prevention) */
  skipPeriods: number;
  /** If true, weight by market cap instead of equal-weight */
  capWeighted: boolean;
}

export const DEFAULT_LAYER_TEST_CONFIG: LayerTestConfig = {
  numGroups: 10,
  rebalanceFrequency: 'monthly',
  turnoverCostBps: 3,
  minStocksPerGroup: 3,
  enableLongShort: true,
  skipPeriods: 0,
  capWeighted: false,
};

export interface GroupReturn {
  groupId: number;
  groupLabel: string;   // e.g. "G1 (Top)" / "G10 (Bottom)"
  avgReturn: number;    // average period return
  cumulativeReturn: number; // total cumulative return
  annualizedReturn: number;
  annualizedVol: number;
  sharpeRatio: number;
  maxDrawdown: number;
  hitRate: number;      // % of periods with positive return
  avgTurnoverPct: number; // average turnover / period
}

export interface LongShortSpread {
  topGroupLabel: string;
  bottomGroupLabel: string;
  avgSpread: number;           // avg(Top - Bottom) per period
  cumulativeSpread: number;    // cumulative long-short return
  annualizedSpread: number;
  spreadVol: number;
  informationRatio: number;    // annualized spread / spread vol
  hitRate: number;             // % of periods where Top > Bottom
  maxDrawdown: number;         // max peak-to-trough of cumulative spread
  tStat: number;               // spread / stdErr
  monotonicityCorr: number;    // rank correlation between group order and return
  annualTurnoverCost: number;  // total turnover cost bps / year
  netIR: number;               // IR after turnover cost
}

export interface LayerTestResult {
  config: LayerTestConfig;
  factorName: string;
  periodLabel: string;
  numStocks: number;
  numPeriods: number;
  groups: GroupReturn[];
  longShort?: LongShortSpread;
  spreadSeries: number[];       // Top-Bottom return per period
  cumulativeSpreads: number[];  // cumulative long-short equity curve
  turnoverSeries: number[];     // turnover % per period
  summary: string;
}

export interface LayerTestInput {
  /** Factor values: Map<date(string "YYYY-MM-DD"), Map<symbol, factor_value>> */
  factorValues: Map<string, Map<string, number>>;
  /** Forward returns (next period): Map<date, Map<symbol, return>> */
  forwardReturns: Map<string, Map<string, number>>;
  /** Market caps for cap-weighted mode: Map<date, Map<symbol, marketCap>> */
  marketCaps?: Map<string, Map<string, number>>;
}

// ═══════════════════════════════════════════════════════════════════════════
// Layer Test Engine
// ═══════════════════════════════════════════════════════════════════════════

export class LayerTestEngine {
  private config: LayerTestConfig;

  constructor(config?: Partial<LayerTestConfig>) {
    this.config = { ...DEFAULT_LAYER_TEST_CONFIG, ...config };
    this.validateConfig();
    log.info(`[LayerTestEngine] Initialized: ${this.config.numGroups} groups, ${this.config.rebalanceFrequency}`);
  }

  /**
   * Run factor layer test: sort stocks by factor into groups, compute returns,
   * and analyze top-bottom spread with turnover costs.
   */
  runLayerTest(input: LayerTestInput, factorName = 'factor'): LayerTestResult {
    const { factorValues, forwardReturns, marketCaps } = input;

    // Get sorted dates
    const dates = Array.from(factorValues.keys()).sort();
    if (dates.length < 2) {
      return this.emptyResult(factorName, '1980-01 → 2099-12');
    }

    // Skip periods (look-ahead bias prevention)
    const activeDates = dates.slice(this.config.skipPeriods);
    if (activeDates.length < 2) {
      return this.emptyResult(factorName, `${dates[0]} → ${dates[dates.length - 1]}`);
    }

    const periodLabel = `${activeDates[0]} → ${activeDates[activeDates.length - 1]}`;
    const N = this.config.numGroups;

    // Initialize accumulators
    const groupReturns: number[][] = Array.from({ length: N }, () => []);
    const spreadSeries: number[] = [];
    const cumulativeSpreads: number[] = [];
    const turnoverSeries: number[] = [];
    let cumSpread = 1.0;
    let totalStocks = 0;

    // Track previous period's group assignments for turnover calculation
    let prevAssignments = new Map<string, number>();

    for (let t = 0; t < activeDates.length - 1; t++) {
      const date = activeDates[t];
      const nextDate = activeDates[t + 1];

      const factorMap = factorValues.get(date);
      const returnMap = forwardReturns.get(date);
      if (!factorMap || !returnMap || factorMap.size === 0 || returnMap.size === 0) continue;

      const capMap = marketCaps?.get(date);

      // Build stock list with factor values and forward returns
      interface StockEntry {
        symbol: string;
        factorVal: number;
        fwdReturn: number;
        marketCap: number;
      }

      const stocks: StockEntry[] = [];
      for (const [sym, fval] of factorMap) {
        const ret = returnMap.get(sym);
        if (ret === undefined || isNaN(fval) || isNaN(ret)) continue;
        stocks.push({
          symbol: sym,
          factorVal: fval,
          fwdReturn: ret,
          marketCap: capMap?.get(sym) ?? 1,
        });
      }

      if (stocks.length < this.config.minStocksPerGroup * N) continue;
      totalStocks = Math.max(totalStocks, stocks.length);

      // Sort by factor value ascending → G1=lowest, GN=highest
      stocks.sort((a, b) => a.factorVal - b.factorVal);

      // Assign to groups
      const groupSize = Math.floor(stocks.length / N);
      const remainder = stocks.length % N;
      const assignments = new Map<string, number>();

      let cursor = 0;
      for (let g = 0; g < N; g++) {
        const size = groupSize + (g < remainder ? 1 : 0);
        for (let i = 0; i < size; i++) {
          assignments.set(stocks[cursor + i].symbol, g);
        }
        cursor += size;
      }

      // Compute group returns (equal-weighted or cap-weighted)
      const periodGroupReturns: number[] = new Array(N).fill(0);
      const periodGroupCounts: number[] = new Array(N).fill(0);

      for (const stock of stocks) {
        const g = assignments.get(stock.symbol)!;
        const weight = this.config.capWeighted ? stock.marketCap : 1;
        periodGroupReturns[g] += stock.fwdReturn * weight;
        periodGroupCounts[g] += weight;
      }

      for (let g = 0; g < N; g++) {
        if (periodGroupCounts[g] > 0) {
          periodGroupReturns[g] /= periodGroupCounts[g];
          groupReturns[g].push(periodGroupReturns[g]);
        }
      }

      // Long-Short spread: Top group (highest factor) - Bottom group (lowest factor)
      const topRet = periodGroupReturns[N - 1];
      const botRet = periodGroupReturns[0];
      const spread = topRet - botRet;

      // Turnover cost: % of stocks that changed group assignment
      let changed = 0;
      let total = 0;
      if (prevAssignments.size > 0) {
        const symbols = new Set([...prevAssignments.keys(), ...assignments.keys()]);
        for (const sym of symbols) {
          total++;
          if (prevAssignments.get(sym) !== assignments.get(sym)) {
            changed++;
          }
        }
      } else {
        total = assignments.size;
        changed = assignments.size; // first period, all considered "changed"
      }

      const turnoverPct = total > 0 ? changed / total : 0;
      turnoverSeries.push(turnoverPct);

      // Apply turnover cost to spread
      const costBps = turnoverPct * this.config.turnoverCostBps * 2; // buy + sell
      const netSpread = spread - costBps / 10000;

      spreadSeries.push(netSpread);
      cumSpread *= (1 + netSpread);
      cumulativeSpreads.push(cumSpread);

      prevAssignments = assignments;
    }

    // Calculate group statistics
    const groups: GroupReturn[] = [];
    const cumRetByGroup: number[] = new Array(N).fill(1);

    for (let g = 0; g < N; g++) {
      const rets = groupReturns[g];
      const periods = rets.length;

      if (periods === 0) {
        groups.push({
          groupId: g + 1, groupLabel: `G${g + 1}`,
          avgReturn: 0, cumulativeReturn: 0, annualizedReturn: 0,
          annualizedVol: 0, sharpeRatio: 0, maxDrawdown: 0,
          hitRate: 0, avgTurnoverPct: 0,
        });
        continue;
      }

      const avgR = rets.reduce((s, r) => s + r, 0) / periods;
      const cumR = rets.reduce((p, r) => p * (1 + r), 1) - 1;
      const annR = this.annualize(avgR);
      const stdR = Math.sqrt(rets.reduce((s, r) => s + (r - avgR) ** 2, 0) / periods);
      const annVol = stdR * Math.sqrt(this.periodsPerYear());
      const sharpe = annVol > 0 ? annR / annVol : 0;

      // Cumulative equity curve for max drawdown
      let peak = 0;
      let cum = 1;
      let mdd = 0;
      for (const r of rets) {
        cum *= (1 + r);
        if (cum > peak) peak = cum;
        const dd = (cum - peak) / peak;
        if (dd < mdd) mdd = dd;
      }

      const hitRate = rets.filter((r) => r > 0).length / periods;
      const avgTO = turnoverSeries.length > 0
        ? turnoverSeries.reduce((s, t) => s + t, 0) / turnoverSeries.length
        : 0;

      const label = g === 0 ? `G${g + 1} (Bottom)` : g === N - 1 ? `G${g + 1} (Top)` : `G${g + 1}`;

      groups.push({
        groupId: g + 1,
        groupLabel: label,
        avgReturn: Math.round(avgR * 10000) / 100,
        cumulativeReturn: Math.round(cumR * 10000) / 100,
        annualizedReturn: Math.round(annR * 10000) / 100,
        annualizedVol: Math.round(annVol * 10000) / 100,
        sharpeRatio: Math.round(sharpe * 100) / 100,
        maxDrawdown: Math.round(mdd * 10000) / 100,
        hitRate: Math.round(hitRate * 100) / 100,
        avgTurnoverPct: Math.round(avgTO * 10000) / 100,
      });
    }

    // Long-Short statistics
    let longShort: LongShortSpread | undefined;
    if (this.config.enableLongShort && spreadSeries.length > 0) {
      const avgSpread = spreadSeries.reduce((s, r) => s + r, 0) / spreadSeries.length;
      const spreadVol = Math.sqrt(
        spreadSeries.reduce((s, r) => s + (r - avgSpread) ** 2, 0) / spreadSeries.length
      );
      const annSpread = this.annualize(avgSpread);
      const annSpreadVol = spreadVol * Math.sqrt(this.periodsPerYear());
      const ir = annSpreadVol > 0 ? annSpread / annSpreadVol : 0;
      const hitRate = spreadSeries.filter((r) => r > 0).length / spreadSeries.length;
      const tStat = spreadVol > 0 ? avgSpread / (spreadVol / Math.sqrt(spreadSeries.length)) : 0;

      // Max drawdown of cumulative spread
      let peak = 0, mdd = 0;
      for (const cs of cumulativeSpreads) {
        if (cs > peak) peak = cs;
        const dd = (cs - peak) / peak;
        if (dd < mdd) mdd = dd;
      }

      // Monotonicity: rank correlation between group order and avg return
      const groupOrder = groups.map((_, i) => i + 1);
      const groupReturnVals = groups.map((g) => g.avgReturn);
      const monoCorr = this.spearmanRankCorrelation(groupOrder, groupReturnVals);

      // Annual turnover cost
      const annTO = turnoverSeries.length > 0
        ? turnoverSeries.reduce((s, t) => s + t, 0) / turnoverSeries.length
        : 0;
      const annTurnoverCostBps = annTO * this.config.turnoverCostBps * 2 * this.periodsPerYear();

      const netIR = annSpreadVol > 0
        ? (annSpread - annTurnoverCostBps / 10000) / annSpreadVol
        : 0;

      longShort = {
        topGroupLabel: `G${N} (Top)`,
        bottomGroupLabel: 'G1 (Bottom)',
        avgSpread: Math.round(avgSpread * 10000) / 100,
        cumulativeSpread: Math.round((cumulativeSpreads[cumulativeSpreads.length - 1] - 1) * 10000) / 100,
        annualizedSpread: Math.round(annSpread * 10000) / 100,
        spreadVol: Math.round(annSpreadVol * 10000) / 100,
        informationRatio: Math.round(ir * 100) / 100,
        hitRate: Math.round(hitRate * 100) / 100,
        maxDrawdown: Math.round(mdd * 10000) / 100,
        tStat: Math.round(tStat * 100) / 100,
        monotonicityCorr: Math.round(monoCorr * 100) / 100,
        annualTurnoverCost: Math.round(annTurnoverCostBps),
        netIR: Math.round(netIR * 100) / 100,
      };
    }

    // Build summary
    const summary = longShort
      ? `${N}组分层，多空年化利差${longShort.annualizedSpread}% | IR=${longShort.informationRatio} | 单调性=${longShort.monotonicityCorr} | 换手成本${longShort.annualTurnoverCost}bps | 净IR=${longShort.netIR}`
      : `${N}组分层回测完成`;

    return {
      config: { ...this.config },
      factorName,
      periodLabel,
      numStocks: totalStocks,
      numPeriods: spreadSeries.length,
      groups,
      longShort,
      spreadSeries: spreadSeries.map((s) => Math.round(s * 1000000) / 10000),
      cumulativeSpreads: cumulativeSpreads.map((cs) => Math.round(cs * 10000) / 100),
      turnoverSeries: turnoverSeries.map((t) => Math.round(t * 10000) / 100),
      summary,
    };
  }

  /**
   * Batch layer test — run same config on multiple factors.
   */
  runBatchLayerTest(
    inputs: Array<{ name: string; data: LayerTestInput }>,
  ): LayerTestResult[] {
    return inputs.map(({ name, data }) => this.runLayerTest(data, name));
  }

  /**
   * Quick monotonicity check: if Top group avg return > Bottom group avg return,
   * the factor has directional predictive power.
   */
  quickMonotonicityCheck(
    factorValues: Map<string, number>,
    forwardReturns: Map<string, number>,
    numGroups = 5,
  ): { monoScore: number; spread: number; isMonotonic: boolean } {
    const entries = Array.from(factorValues.entries())
      .filter(([sym, fv]) => !isNaN(fv) && forwardReturns.has(sym) && !isNaN(forwardReturns.get(sym)!));

    if (entries.length < numGroups * this.config.minStocksPerGroup) {
      return { monoScore: 0, spread: 0, isMonotonic: false };
    }

    entries.sort((a, b) => a[1] - b[1]);
    const size = Math.floor(entries.length / numGroups);

    const groupReturns: number[] = [];
    for (let g = 0; g < numGroups; g++) {
      const start = g * size;
      const end = g === numGroups - 1 ? entries.length : (g + 1) * size;
      const groupEntries = entries.slice(start, end);
      const avgRet = groupEntries.reduce((s, e) => s + forwardReturns.get(e[0])!, 0) / groupEntries.length;
      groupReturns.push(avgRet);
    }

    const spread = groupReturns[numGroups - 1] - groupReturns[0];
    const monoScore = this.spearmanRankCorrelation(
      Array.from({ length: numGroups }, (_, i) => i + 1),
      groupReturns,
    );

    return {
      monoScore,
      spread: Math.round(spread * 10000) / 100,
      isMonotonic: monoScore > 0.7 && spread > 0,
    };
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private periodsPerYear(): number {
    switch (this.config.rebalanceFrequency) {
      case 'daily': return 252;
      case 'weekly': return 52;
      case 'monthly': return 12;
      case 'quarterly': return 4;
    }
  }

  private annualize(periodReturn: number): number {
    const ppy = this.periodsPerYear();
    return (1 + periodReturn) ** ppy - 1;
  }

  private spearmanRankCorrelation(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length < 2) return 0;

    const rank = (arr: number[]) => {
      const indexed = arr.map((v, i) => ({ v, i }));
      indexed.sort((a, b) => a.v - b.v);
      const r = new Array<number>(arr.length);
      for (let i = 0; i < indexed.length; i++) {
        r[indexed[i].i] = i + 1;
      }
      return r;
    };

    const rx = rank(x);
    const ry = rank(y);
    const n = x.length;
    let sumD2 = 0;
    for (let i = 0; i < n; i++) {
      sumD2 += (rx[i] - ry[i]) ** 2;
    }

    return 1 - (6 * sumD2) / (n * (n * n - 1));
  }

  private emptyResult(factorName: string, periodLabel: string): LayerTestResult {
    return {
      config: { ...this.config },
      factorName,
      periodLabel,
      numStocks: 0,
      numPeriods: 0,
      groups: [],
      spreadSeries: [],
      cumulativeSpreads: [],
      turnoverSeries: [],
      summary: '数据不足，无法执行分层回测',
    };
  }

  private validateConfig(): void {
    if (this.config.numGroups !== 5 && this.config.numGroups !== 10) {
      log.warn(`[LayerTestEngine] Non-standard numGroups=${this.config.numGroups}, rounding to nearest standard`);
      this.config.numGroups = this.config.numGroups <= 7 ? 5 : 10;
    }
    if (this.config.minStocksPerGroup < 1) {
      this.config.minStocksPerGroup = 1;
    }
  }

  getConfig(): LayerTestConfig {
    return { ...this.config };
  }

  updateConfig(patch: Partial<LayerTestConfig>): void {
    this.config = { ...this.config, ...patch };
    this.validateConfig();
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Factory & Singleton
// ═══════════════════════════════════════════════════════════════════════════

let _defaultEngine: LayerTestEngine | null = null;

export function getLayerTestEngine(): LayerTestEngine {
  if (!_defaultEngine) {
    _defaultEngine = new LayerTestEngine();
  }
  return _defaultEngine;
}

export function createLayerTestEngine(config?: Partial<LayerTestConfig>): LayerTestEngine {
  return new LayerTestEngine(config);
}

export function resetLayerTestEngine(): void {
  _defaultEngine = null;
}

export default {
  LayerTestEngine,
  getLayerTestEngine,
  createLayerTestEngine,
  resetLayerTestEngine,
};

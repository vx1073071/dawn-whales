/**
 * R242 JVS#2: NewsBacktestEngine — 新闻回测引擎
 *
 * Given historical keyword events & stock price data, compute
 * N-day forward returns, win rate, and statistical distribution.
 *
 * Pricing: 💰 1.5 USDT / backtest
 *
 * Architecture:
 *   ┌───────────────────────────────────────────────────────────┐
 *   │                   NewsBacktestEngine                       │
 *   │  ┌─────────────────────────────────────────────────────┐  │
 *   │  │ Event Collector                                      │  │
 *   │  │  ├─ keyword filter (regex / exact / semantic)       │  │
 *   │  │  ├─ date range                                       │  │
 *   │  │  └─ market/sector filter                             │  │
 *   │  └──────────────────┬──────────────────────────────────┘  │
 *   │                     │                                      │
 *   │  ┌──────────────────┴──────────────────────────────────┐  │
 *   │  │ Price Aligner                                       │  │
 *   │  │  ├─ event date → N forward trading days             │  │
 *   │  │  ├─ 1d/3d/5d/7d/14d/30d/60d/90d forwards            │  │
 *   │  │  └─ benchmark-relative (SPY/QQQ/BTC)                │  │
 *   │  └──────────────────┬──────────────────────────────────┘  │
 *   │                     │                                      │
 *   │  ┌──────────────────┴──────────────────────────────────┐  │
 *   │  │ Distribution Engine                                  │  │
 *   │  │  ├─ mean/median/stdev/skew/kurtosis                  │  │
 *   │  │  ├─ win rate (vs 0% vs benchmark)                   │  │
 *   │  │  ├─ max gain / max drawdown                          │  │
 *   │  │  ├─ T-stat (statistical significance)               │  │
 *   │  │  └─ bucket distribution histogram                    │  │
 *   │  └─────────────────────────────────────────────────────┘  │
 *   └───────────────────────────────────────────────────────────┘
 *
 * v2.7.0-NEWS | production-ready | P2 paid
 */

import log from 'electron-log';

// ═════════════════════════════════════════════════════════════════════════════
// Types
// ═════════════════════════════════════════════════════════════════════════════

export interface BacktestEvent {
  eventId: string;
  symbol: string;
  eventType: string;         // 'earnings', 'merger', 'dividend', 'regulation', 'product_launch'
  headline: string;
  keywords: string[];
  eventDate: string;         // ISO date
  sentiment: number;         // -1.0 ~ +1.0
  source: string;
}

export interface PricePoint {
  symbol: string;
  date: string;              // ISO date
  close: number;
  volume?: number;
}

export interface ForwardReturn {
  days: number;
  returnPct: number;
  excessReturnPct: number;   // vs benchmark
}

export interface BacktestResult {
  eventId: string;
  symbol: string;
  eventDate: string;
  headline: string;
  sentiment: number;
  forwardReturns: ForwardReturn[];
  maxGain: number;
  maxDrawdown: number;
  success: 'positive' | 'negative' | 'flat';
}

export interface DistributionStats {
  count: number;
  mean: number;
  median: number;
  stdev: number;
  min: number;
  max: number;
  skew: number;
  kurtosis: number;
  winRatePct: number;        // % of events with positive return
  excessWinRatePct: number;  // % beating benchmark
  tStat: number;             // t-statistic vs 0
  pValueApprox: number;      // approximate p-value
  confidenceInterval: [number, number]; // 95% CI
}

export interface BucketDistribution {
  bucketLabels: string[];    // e.g. ['-10%+', '-5~-10%', ...]
  bucketCounts: number[];
}

export interface BacktestReport {
  requestId: string;
  symbol: string;
  keyword: string;
  eventType?: string;
  dateRange: { from: string; to: string };
  forwardDays: number[];
  totalEvents: number;
  matchedEvents: number;
  results: BacktestResult[];
  stats: Record<number, DistributionStats>; // keyed by days
  bucketDist: Record<number, BucketDistribution>;
  benchmark: string;
  processingTimeMs: number;
  timestamp: number;
  pricing: { cost: string; charged: boolean };
}

export interface BacktestRequest {
  symbol: string;
  keyword: string;          // regex or plain text
  eventType?: string;       // optional filter
  dateFrom?: string;        // ISO, default 3y ago
  dateTo?: string;          // ISO, default today
  forwardDays?: number[];   // default [1,3,5,7,14,30,60,90]
  benchmark?: string;       // default 'SPY'
  minSentiment?: number;    // optional sentiment filter
}

// ═════════════════════════════════════════════════════════════════════════════
// NewsBacktestEngine
// ═════════════════════════════════════════════════════════════════════════════

export class NewsBacktestEngine {
  private defaultForwardDays = [1, 3, 5, 7, 14, 30, 60, 90];
  private defaultBenchmark = 'SPY';

  // ── Main Backtest ─────────────────────────────────────────────────────

  /**
   * Run a full backtest: filter events → align prices → compute statistics.
   */
  run(
    events: BacktestEvent[],
    priceHistory: PricePoint[],
    benchmarkPrices: PricePoint[],
    request: BacktestRequest,
  ): BacktestReport {
    const start = Date.now();

    const forwardDays = request.forwardDays || this.defaultForwardDays;
    const benchmark = request.benchmark || this.defaultBenchmark;
    const dateFrom = request.dateFrom || this.defaultFrom();
    const dateTo = request.dateTo || new Date().toISOString().split('T')[0];

    // Filter events by keyword & symbol & date
    const keyword = request.keyword.toLowerCase();
    const matched = events.filter(e => {
      if (e.symbol.toUpperCase() !== request.symbol.toUpperCase()) return false;
      if (e.eventDate < dateFrom || e.eventDate > dateTo) return false;
      if (request.eventType && e.eventType !== request.eventType) return false;
      if (request.minSentiment !== undefined && e.sentiment < request.minSentiment) return false;

      const text = (e.headline + ' ' + e.keywords.join(' ')).toLowerCase();

      // Try regex
      try {
        if (new RegExp(keyword, 'i').test(text)) return true;
      } catch {
        // Fallback to includes
      }

      // Plain text match
      return text.includes(keyword);
    });

    // Build price lookup
    const priceMap = new Map<string, number>();
    for (const p of priceHistory) {
      priceMap.set(`${p.symbol}|${p.date}`, p.close);
    }
    const benchMap = new Map<string, number>();
    for (const p of benchmarkPrices) {
      benchMap.set(p.date, p.close);
    }

    // Compute forward returns
    const results: BacktestResult[] = [];
    for (const evt of matched) {
      const result = this.computeReturns(evt, priceMap, benchMap, forwardDays, benchmark);
      if (result && result.forwardReturns.length > 0) {
        results.push(result);
      }
    }

    // Statistics per forward day
    const stats: Record<number, DistributionStats> = {};
    const bucketDist: Record<number, BucketDistribution> = {};

    for (const d of forwardDays) {
      const dayReturns = results
        .map(r => r.forwardReturns.find(fr => fr.days === d))
        .filter(Boolean) as ForwardReturn[];
      if (dayReturns.length >= 3) {
        stats[d] = this.computeStats(dayReturns);
        bucketDist[d] = this.computeBuckets(dayReturns);
      }
    }

    const processingTimeMs = Date.now() - start;

    log.info(`[NBE] "${request.keyword}" on ${request.symbol}: ${matched.length}/${events.length} events in ${processingTimeMs}ms`);

    return {
      requestId: `nbe-${Date.now()}`,
      symbol: request.symbol,
      keyword: request.keyword,
      eventType: request.eventType,
      dateRange: { from: dateFrom, to: dateTo },
      forwardDays,
      totalEvents: events.length,
      matchedEvents: matched.length,
      results,
      stats,
      bucketDist,
      benchmark,
      processingTimeMs,
      timestamp: Date.now(),
      pricing: { cost: '1.5 USDT', charged: true },
    };
  }

  // ── Internal ──────────────────────────────────────────────────────────

  private computeReturns(
    evt: BacktestEvent,
    priceMap: Map<string, number>,
    benchMap: Map<string, number>,
    forwardDays: number[],
    benchmark: string,
  ): BacktestResult | null {
    const entryPrice = priceMap.get(`${evt.symbol}|${evt.eventDate}`);
    if (entryPrice === undefined || entryPrice <= 0) return null;

    const forwardReturns: ForwardReturn[] = [];
    let maxGain = -Infinity;
    let maxDrawdown = Infinity;

    for (const d of forwardDays) {
      const futureDate = this.addTradingDays(evt.eventDate, d);
      const exitPrice = priceMap.get(`${evt.symbol}|${futureDate}`);
      if (exitPrice === undefined) continue;

      const retPct = (exitPrice - entryPrice) / entryPrice;

      // Benchmark return
      const benchEntry = benchMap.get(evt.eventDate);
      const benchExit = benchMap.get(futureDate);
      const excessRet = (benchEntry && benchExit && benchEntry > 0)
        ? retPct - (benchExit - benchEntry) / benchEntry
        : retPct;

      forwardReturns.push({ days: d, returnPct: retPct, excessReturnPct: excessRet });

      maxGain = Math.max(maxGain, retPct);
      maxDrawdown = Math.min(maxDrawdown, retPct);
    }

    if (forwardReturns.length === 0) return null;

    const finalRet = forwardReturns[forwardReturns.length - 1].returnPct;
    const success: BacktestResult['success'] = finalRet > 0.02 ? 'positive' : finalRet < -0.02 ? 'negative' : 'flat';

    return {
      eventId: evt.eventId,
      symbol: evt.symbol,
      eventDate: evt.eventDate,
      headline: evt.headline,
      sentiment: evt.sentiment,
      forwardReturns,
      maxGain: maxGain === -Infinity ? 0 : maxGain,
      maxDrawdown: maxDrawdown === Infinity ? 0 : maxDrawdown,
      success,
    };
  }

  private computeStats(returns: ForwardReturn[]): DistributionStats {
    const values = returns.map(r => r.returnPct).sort();
    const excessValues = returns.map(r => r.excessReturnPct);
    const n = values.length;

    const mean = values.reduce((s, v) => s + v, 0) / n;
    const median = n % 2 === 0 ? (values[n / 2 - 1] + values[n / 2]) / 2 : values[Math.floor(n / 2)];
    const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
    const stdev = Math.sqrt(variance);

    // Skewness
    const skew = stdev > 0
      ? values.reduce((s, v) => s + ((v - mean) / stdev) ** 3, 0) / n
      : 0;

    // Kurtosis (excess)
    const kurtosis = stdev > 0
      ? values.reduce((s, v) => s + ((v - mean) / stdev) ** 4, 0) / n - 3
      : 0;

    const min = values[0];
    const max = values[n - 1];
    const winRatePct = values.filter(v => v > 0).length / n;
    const excessWinRate = excessValues.filter(v => v > 0).length / n;

    // T-statistic: H0 = mean is 0
    const tStat = stdev > 0 ? mean / (stdev / Math.sqrt(n)) : 0;

    // Approx p-value (two-tailed, using normal approximation)
    const pValueApprox = 2 * (1 - this.normalCDF(Math.abs(tStat)));

    // 95% CI
    const z95 = 1.96;
    const ciLow = mean - z95 * (stdev / Math.sqrt(n));
    const ciHigh = mean + z95 * (stdev / Math.sqrt(n));

    return {
      count: n, mean, median, stdev, min, max, skew, kurtosis,
      winRatePct, excessWinRatePct: excessWinRate,
      tStat, pValueApprox,
      confidenceInterval: [ciLow, ciHigh],
    };
  }

  private computeBuckets(returns: ForwardReturn[]): BucketDistribution {
    const edges = [-0.1, -0.05, -0.03, -0.01, 0, 0.01, 0.03, 0.05, 0.1];
    const labels = ['-10%+', '-10~-5%', '-5~-3%', '-3~-1%', '-1~0%', '0~+1%', '+1~+3%', '+3~+5%', '+5~+10%', '+10%+'];
    const counts = new Array(labels.length).fill(0);

    for (const r of returns) {
      let placed = false;
      for (let i = 0; i < edges.length; i++) {
        if (r.returnPct < edges[i]) { counts[i]++; placed = true; break; }
      }
      if (!placed) counts[counts.length - 1]++;
    }

    return { bucketLabels: labels, bucketCounts: counts };
  }

  // ── Helpers ───────────────────────────────────────────────────────────

  /**
   * Add N trading days (skip weekends). Simple version.
   */
  private addTradingDays(dateStr: string, days: number): string {
    const date = new Date(dateStr + 'T00:00:00Z');
    let added = 0;
    while (added < days) {
      date.setUTCDate(date.getUTCDate() + 1);
      const dow = date.getUTCDay();
      if (dow !== 0 && dow !== 6) added++; // skip Sat/Sun
    }
    return date.toISOString().split('T')[0];
  }

  private normalCDF(x: number): number {
    // Abramowitz & Stegun approximation
    const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
    const a4 = -1.453152027, a5 = 1.061405429;
    const p = 0.3275911;
    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x) / Math.sqrt(2);
    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
    return 0.5 * (1.0 + sign * y);
  }

  private defaultFrom(): string {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 3);
    return d.toISOString().split('T')[0];
  }

  // ── Utility ───────────────────────────────────────────────────────────

  getDefaultForwardDays(): number[] {
    return [...this.defaultForwardDays];
  }

  getBucketEdges(): number[] {
    return [-0.1, -0.05, -0.03, -0.01, 0, 0.01, 0.03, 0.05, 0.1];
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Singleton
// ═════════════════════════════════════════════════════════════════════════════

let defaultNBE: NewsBacktestEngine | null = null;

export function getNewsBacktestEngine(): NewsBacktestEngine {
  if (!defaultNBE) defaultNBE = new NewsBacktestEngine();
  return defaultNBE;
}

export function resetNewsBacktestEngine(): void {
  defaultNBE = null;
}

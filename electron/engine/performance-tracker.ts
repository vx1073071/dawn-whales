/**
 * PerformanceTracker - 交易绩效追踪引擎
 *
 * Dawn Whales Project (J-32-03)
 *
 * Tracks individual trade records and computes comprehensive performance
 * metrics including Sharpe, Sortino, Calmar ratios, profit factor,
 * maximum drawdown, win rate, expectancy, and full equity curve.
 *
 * All annualised metrics assume 252 trading days per year and
 * per-trade returns as the sampling frequency.
 */

import log from 'electron-log';

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface TradeRecord {
  code: string;
  side: 'long' | 'short';
  entryPrice: number;
  exitPrice: number;
  qty: number;
  pnl: number;
  pnlPct: number;
  entryTime: number;
  exitTime: number;
  holdingMinutes: number;
}

export interface PerformanceMetrics {
  totalTrades: number;
  winRate: number;          // 0-1
  avgWin: number;
  avgLoss: number;
  profitFactor: number;     // sum(wins) / sum(losses)
  sharpe: number;           // annualized
  sortino: number;          // annualized (downside only)
  calmar: number;           // annual return / max drawdown
  maxDrawdown: number;      // percentage
  avgHoldingMinutes: number;
  bestTrade: number;        // best trade PnL
  worstTrade: number;       // worst trade PnL
  expectancy: number;       // expected value per trade
  totalPnl: number;
}

export interface EquityCurve {
  timestamp: number;
  equity: number;
  drawdownPct: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Standard trading days per year used for annualisation. */
const TRADING_DAYS_PER_YEAR = 252;

/** Minutes in a trading day (6.5 h for US equities). */
const MINUTES_PER_TRADING_DAY = 390;

/** Trades-per-year estimate used when time-spacing is unreliable. */
const DEFAULT_TRADES_PER_YEAR = TRADING_DAYS_PER_YEAR;

/** Small epsilon to avoid division by zero. */
const EPS = 1e-12;

// ---------------------------------------------------------------------------
// Helper / standalone functions
// ---------------------------------------------------------------------------

/**
 * Compute annualised Sharpe ratio from an array of per-trade returns.
 *
 * @param returns       Array of fractional returns (e.g. 0.02 = 2 %).
 * @param riskFreeRate  Annualised risk-free rate (default 0).
 * @returns             Annualised Sharpe ratio.
 */
export function calculateSharpe(
  returns: number[],
  riskFreeRate: number = 0,
): number {
  if (returns.length < 2) {
    return 0;
  }

  const n = returns.length;
  const tradesPerYear = n > 1 ? n : DEFAULT_TRADES_PER_YEAR;

  // Per-period risk-free adjustment
  const rfPerPeriod = riskFreeRate / tradesPerYear;

  const excessReturns = returns.map((r) => r - rfPerPeriod);

  const mean = excessReturns.reduce((s, v) => s + v, 0) / n;

  const variance =
    excessReturns.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1);

  const stdDev = Math.sqrt(variance);

  if (stdDev < EPS) {
    return 0;
  }

  const sharpe = (mean / stdDev) * Math.sqrt(tradesPerYear);

  return sharpe;
}

/**
 * Compute annualised Sortino ratio from an array of per-trade returns.
 *
 * Unlike Sharpe, Sortino only penalises downside deviation (returns below
 * the risk-free rate).
 *
 * @param returns       Array of fractional returns.
 * @param riskFreeRate  Annualised risk-free rate (default 0).
 * @returns             Annualised Sortino ratio.
 */
export function calculateSortino(
  returns: number[],
  riskFreeRate: number = 0,
): number {
  if (returns.length < 2) {
    return 0;
  }

  const n = returns.length;
  const tradesPerYear = n > 1 ? n : DEFAULT_TRADES_PER_YEAR;

  const rfPerPeriod = riskFreeRate / tradesPerYear;

  const excessReturns = returns.map((r) => r - rfPerPeriod);

  const mean = excessReturns.reduce((s, v) => s + v, 0) / n;

  // Downside deviation: only count negative excess returns
  const downsideSquaredSum = excessReturns.reduce((s, v) => {
    if (v < 0) {
      return s + v * v;
    }
    return s;
  }, 0);

  const downsideDeviation = Math.sqrt(downsideSquaredSum / (n - 1));

  if (downsideDeviation < EPS) {
    // No downside → infinite risk-adjusted return; clamp to 0 for safety
    return mean > 0 ? Number.MAX_SAFE_INTEGER / 1000 : 0;
  }

  const sortino = (mean / downsideDeviation) * Math.sqrt(tradesPerYear);

  return sortino;
}

/**
 * Compute maximum drawdown from an equity curve array.
 *
 * @param equityCurve  Array of equity values in chronological order.
 * @returns            Maximum drawdown as a positive fraction (e.g. 0.15 = 15 %).
 */
export function calculateMaxDrawdown(equityCurve: number[]): number {
  if (equityCurve.length < 2) {
    return 0;
  }

  let peak = equityCurve[0];
  let maxDd = 0;

  for (let i = 1; i < equityCurve.length; i++) {
    const value = equityCurve[i];

    if (value > peak) {
      peak = value;
    }

    const drawdown = (peak - value) / peak;

    if (drawdown > maxDd) {
      maxDd = drawdown;
    }
  }

  return maxDd;
}

// ---------------------------------------------------------------------------
// Internal utility helpers
// ---------------------------------------------------------------------------

/**
 * Sum an array of numbers.
 */
function sum(arr: number[]): number {
  return arr.reduce((s, v) => s + v, 0);
}

/**
 * Arithmetic mean of an array.
 */
function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return sum(arr) / arr.length;
}

/**
 * Standard deviation (sample, Bessel-corrected).
 */
function stdDev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const variance = arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

/**
 * Extract per-trade fractional returns from TradeRecord[].
 */
function tradeReturns(trades: TradeRecord[]): number[] {
  return trades.map((t) => t.pnlPct);
}

/**
 * Estimate the number of trading periods per year based on trade timestamps.
 * Falls back to DEFAULT_TRADES_PER_YEAR when there is insufficient data.
 */
function estimateTradesPerYear(trades: TradeRecord[]): number {
  if (trades.length < 2) {
    return DEFAULT_TRADES_PER_YEAR;
  }

  // Sort by entry time
  const sorted = [...trades].sort((a, b) => a.entryTime - b.entryTime);

  const firstEntry = sorted[0].entryTime;
  const lastEntry = sorted[sorted.length - 1].entryTime;

  const spanMs = lastEntry - firstEntry;

  if (spanMs <= 0) {
    return DEFAULT_TRADES_PER_YEAR;
  }

  const spanMinutes = spanMs / (1000 * 60);

  if (spanMinutes < MINUTES_PER_TRADING_DAY) {
    // All trades within a single day – extrapolate
    return DEFAULT_TRADES_PER_YEAR;
  }

  const tradingDaysSpanned = spanMinutes / MINUTES_PER_TRADING_DAY;
  const tradesPerDay = trades.length / tradingDaysSpanned;

  return tradesPerDay * TRADING_DAYS_PER_YEAR;
}

/**
 * Build a chronological equity curve from trades.
 * Assumes an initial equity of 1.0 (100 %).
 */
function buildEquityValues(trades: TradeRecord[]): number[] {
  const sorted = [...trades].sort((a, b) => a.exitTime - b.exitTime);

  const equity: number[] = [1.0]; // starting equity

  for (const t of sorted) {
    const prev = equity[equity.length - 1];
    equity.push(prev * (1 + t.pnlPct));
  }

  return equity;
}

// ---------------------------------------------------------------------------
// PerformanceTracker class
// ---------------------------------------------------------------------------

export class PerformanceTracker {
  /** Internal trade log. */
  private trades: TradeRecord[] = [];

  /** Label used in log messages. */
  private readonly label: string;

  /**
   * @param label  Optional label for log context (default: 'PerformanceTracker').
   */
  constructor(label: string = 'PerformanceTracker') {
    this.label = label;
    log.info(`[${this.label}] initialised`);
  }

  // -----------------------------------------------------------------------
  // Mutation
  // -----------------------------------------------------------------------

  /**
   * Add a single trade record.
   */
  addTrade(trade: TradeRecord): void {
    this.validateTrade(trade);
    this.trades.push(trade);

    log.debug(
      `[${this.label}] trade added: ${trade.code} ${trade.side} ` +
        `pnl=${trade.pnl.toFixed(2)} pnlPct=${(trade.pnlPct * 100).toFixed(2)}%`,
    );
  }

  /**
   * Add multiple trade records at once.
   */
  addTrades(trades: TradeRecord[]): void {
    for (const t of trades) {
      this.addTrade(t);
    }

    log.info(`[${this.label}] ${trades.length} trades added (total: ${this.trades.length})`);
  }

  /**
   * Clear all stored trades and reset state.
   */
  reset(): void {
    const count = this.trades.length;
    this.trades = [];
    log.info(`[${this.label}] reset – ${count} trades cleared`);
  }

  // -----------------------------------------------------------------------
  // Getters – filtered trade sets
  // -----------------------------------------------------------------------

  /**
   * Return all trades that ended with a positive PnL.
   */
  getWinningTrades(): TradeRecord[] {
    return this.trades.filter((t) => t.pnl > 0);
  }

  /**
   * Return all trades that ended with a negative PnL.
   */
  getLosingTrades(): TradeRecord[] {
    return this.trades.filter((t) => t.pnl < 0);
  }

  // -----------------------------------------------------------------------
  // Metric computations (accept optional external trade set)
  // -----------------------------------------------------------------------

  /**
   * Win rate (0 – 1).
   */
  getWinRate(trades?: TradeRecord[]): number {
    const t = trades ?? this.trades;

    if (t.length === 0) {
      return 0;
    }

    const wins = t.filter((tr) => tr.pnl > 0).length;

    return wins / t.length;
  }

  /**
   * Profit factor: gross profit / gross loss.
   * Returns 0 when there are no losing trades to avoid Infinity.
   */
  getProfitFactor(trades?: TradeRecord[]): number {
    const t = trades ?? this.trades;

    if (t.length === 0) {
      return 0;
    }

    const grossProfit = sum(t.filter((tr) => tr.pnl > 0).map((tr) => tr.pnl));
    const grossLoss = Math.abs(
      sum(t.filter((tr) => tr.pnl < 0).map((tr) => tr.pnl)),
    );

    if (grossLoss < EPS) {
      // No losses → technically infinite, but return a capped value
      return grossProfit > 0 ? 9999 : 0;
    }

    return grossProfit / grossLoss;
  }

  /**
   * Expected value per trade (weighted average PnL).
   */
  getExpectancy(trades?: TradeRecord[]): number {
    const t = trades ?? this.trades;

    if (t.length === 0) {
      return 0;
    }

    const totalPnl = sum(t.map((tr) => tr.pnl));

    return totalPnl / t.length;
  }

  /**
   * Maximum drawdown as a positive fraction (e.g. 0.12 = 12 %).
   */
  getMaxDrawdown(trades?: TradeRecord[]): number {
    const t = trades ?? this.trades;

    if (t.length < 1) {
      return 0;
    }

    const equityValues = buildEquityValues(t);

    return calculateMaxDrawdown(equityValues);
  }

  /**
   * Annualised Sharpe ratio.
   */
  getSharpe(trades?: TradeRecord[]): number {
    const t = trades ?? this.trades;

    if (t.length < 2) {
      return 0;
    }

    const returns = tradeReturns(t);
    const tpy = estimateTradesPerYear(t);

    return this._sharpeWithTpy(returns, tpy);
  }

  /**
   * Annualised Sortino ratio.
   */
  getSortino(trades?: TradeRecord[]): number {
    const t = trades ?? this.trades;

    if (t.length < 2) {
      return 0;
    }

    const returns = tradeReturns(t);
    const tpy = estimateTradesPerYear(t);

    return this._sortinoWithTpy(returns, tpy);
  }

  /**
   * Annualised Calmar ratio (annual return / max drawdown).
   */
  getCalmar(trades?: TradeRecord[]): number {
    const t = trades ?? this.trades;

    if (t.length < 2) {
      return 0;
    }

    const tpy = estimateTradesPerYear(t);

    // Total return over the observed window
    const equityValues = buildEquityValues(t);
    const totalReturn = equityValues[equityValues.length - 1] / equityValues[0] - 1;

    // Annualise return
    const numPeriods = t.length;
    const yearsElapsed = numPeriods / tpy;

    if (yearsElapsed < EPS) {
      return 0;
    }

    const annualReturn = totalReturn / yearsElapsed;

    const maxDd = this.getMaxDrawdown(t);

    if (maxDd < EPS) {
      // No drawdown → return capped value if profitable
      return annualReturn > 0 ? 9999 : 0;
    }

    return annualReturn / maxDd;
  }

  // -----------------------------------------------------------------------
  // Aggregate metrics
  // -----------------------------------------------------------------------

  /**
   * Build the full equity curve with drawdown annotations.
   */
  getEquityCurve(): EquityCurve[] {
    if (this.trades.length === 0) {
      return [];
    }

    const sorted = [...this.trades].sort((a, b) => a.exitTime - b.exitTime);

    const curve: EquityCurve[] = [];

    let equity = 1.0;
    let peak = 1.0;

    // Initial point
    curve.push({
      timestamp: sorted[0].entryTime,
      equity: 1.0,
      drawdownPct: 0,
    });

    for (const t of sorted) {
      equity *= (1 + t.pnlPct);

      if (equity > peak) {
        peak = equity;
      }

      const drawdownPct = peak > EPS ? (peak - equity) / peak : 0;

      curve.push({
        timestamp: t.exitTime,
        equity,
        drawdownPct,
      });
    }

    return curve;
  }

  /**
   * Compute a full PerformanceMetrics snapshot.
   */
  getMetrics(): PerformanceMetrics {
    const trades = this.trades;

    if (trades.length === 0) {
      log.warn(`[${this.label}] getMetrics called with no trades`);

      return {
        totalTrades: 0,
        winRate: 0,
        avgWin: 0,
        avgLoss: 0,
        profitFactor: 0,
        sharpe: 0,
        sortino: 0,
        calmar: 0,
        maxDrawdown: 0,
        avgHoldingMinutes: 0,
        bestTrade: 0,
        worstTrade: 0,
        expectancy: 0,
        totalPnl: 0,
      };
    }

    const winningTrades = this.getWinningTrades();
    const losingTrades = this.getLosingTrades();

    const wins = winningTrades.map((t) => t.pnl);
    const losses = losingTrades.map((t) => t.pnl);

    const avgWin = wins.length > 0 ? mean(wins) : 0;
    const avgLoss = losses.length > 0 ? mean(losses) : 0;

    const totalPnl = sum(trades.map((t) => t.pnl));
    const avgHoldingMinutes = mean(trades.map((t) => t.holdingMinutes));

    const bestTrade = Math.max(...trades.map((t) => t.pnl));
    const worstTrade = Math.min(...trades.map((t) => t.pnl));

    const metrics: PerformanceMetrics = {
      totalTrades: trades.length,
      winRate: this.getWinRate(),
      avgWin,
      avgLoss: Math.abs(avgLoss),
      profitFactor: this.getProfitFactor(),
      sharpe: this.getSharpe(),
      sortino: this.getSortino(),
      calmar: this.getCalmar(),
      maxDrawdown: this.getMaxDrawdown(),
      avgHoldingMinutes,
      bestTrade,
      worstTrade,
      expectancy: this.getExpectancy(),
      totalPnl,
    };

    log.info(
      `[${this.label}] metrics: ${metrics.totalTrades} trades | ` +
        `winRate=${(metrics.winRate * 100).toFixed(1)}% | ` +
        `pf=${metrics.profitFactor.toFixed(2)} | ` +
        `sharpe=${metrics.sharpe.toFixed(2)} | ` +
        `maxDD=${(metrics.maxDrawdown * 100).toFixed(1)}% | ` +
        `totalPnl=${metrics.totalPnl.toFixed(2)}`,
    );

    return metrics;
  }

  // -----------------------------------------------------------------------
  // Internal helpers
  // -----------------------------------------------------------------------

  /**
   * Sharpe ratio with explicit trades-per-year for annualisation.
   */
  private _sharpeWithTpy(returns: number[], tpy: number): number {
    if (returns.length < 2) {
      return 0;
    }

    const n = returns.length;
    const m = mean(returns);
    const sd = stdDev(returns);

    if (sd < EPS) {
      return 0;
    }

    return (m / sd) * Math.sqrt(tpy);
  }

  /**
   * Sortino ratio with explicit trades-per-year for annualisation.
   */
  private _sortinoWithTpy(returns: number[], tpy: number): number {
    if (returns.length < 2) {
      return 0;
    }

    const n = returns.length;
    const m = mean(returns);

    // Downside deviation (target = 0)
    const downsideSquared = returns
      .filter((r) => r < 0)
      .reduce((s, r) => s + r * r, 0);

    const dd = Math.sqrt(downsideSquared / (n - 1));

    if (dd < EPS) {
      return m > 0 ? 9999 : 0;
    }

    return (m / dd) * Math.sqrt(tpy);
  }

  /**
   * Basic validation for incoming trade records.
   * Logs warnings but does not throw – we prefer resilience.
   */
  private validateTrade(trade: TradeRecord): void {
    if (!trade.code || trade.code.trim() === '') {
      log.warn(`[${this.label}] trade record has empty code`);
    }

    if (trade.side !== 'long' && trade.side !== 'short') {
      log.warn(
        `[${this.label}] trade record has invalid side: "${trade.side}"`,
      );
    }

    if (trade.entryPrice <= 0) {
      log.warn(
        `[${this.label}] trade ${trade.code}: entryPrice=${trade.entryPrice} is non-positive`,
      );
    }

    if (trade.qty <= 0) {
      log.warn(
        `[${this.label}] trade ${trade.code}: qty=${trade.qty} is non-positive`,
      );
    }

    if (trade.exitTime < trade.entryTime) {
      log.warn(
        `[${this.label}] trade ${trade.code}: exitTime < entryTime`,
      );
    }

    if (Number.isNaN(trade.pnl) || Number.isNaN(trade.pnlPct)) {
      log.warn(
        `[${this.label}] trade ${trade.code}: NaN detected in pnl/pnlPct`,
      );
    }

    if (Math.abs(trade.pnlPct) > 1) {
      log.warn(
        `[${this.label}] trade ${trade.code}: pnlPct=${trade.pnlPct} ` +
          `exceeds ±100% – verify this is fractional, not percentage`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Default export
// ---------------------------------------------------------------------------

export default PerformanceTracker;

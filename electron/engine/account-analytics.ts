/**
 * Account Analytics Engine (J-42-03)
 *
 * Cross-account analysis engine for portfolio aggregation, performance
 * comparison, risk metrics, and consolidated reporting across multiple
 * trading accounts.
 *
 * Uses inline EventEmitter polyfill (no Node `events` import).
 */

import log from 'electron-log';

// ============================================================================
// Inline EventEmitter Polyfill
// ============================================================================

type EventListener = (...args: any[]) => void;

class SimpleEventEmitter {
  private _listeners: Map<string, EventListener[]> = new Map();

  on(event: string, listener: EventListener): this {
    const list = this._listeners.get(event) ?? [];
    list.push(listener);
    this._listeners.set(event, list);
    return this;
  }

  off(event: string, listener: EventListener): this {
    const list = this._listeners.get(event);
    if (list) {
      this._listeners.set(
        event,
        list.filter((fn) => fn !== listener)
      );
    }
    return this;
  }

  once(event: string, listener: EventListener): this {
    const wrapped: EventListener = (...args) => {
      this.off(event, wrapped);
      listener(...args);
    };
    return this.on(event, wrapped);
  }

  emit(event: string, ...args: any[]): boolean {
    const list = this._listeners.get(event);
    if (!list || list.length === 0) return false;
    for (const fn of [...list]) {
      try {
        fn(...args);
      } catch (err) {
        log.error('[EventEmitter] Listener error:', err);
      }
    }
    return true;
  }

  removeAllListeners(event?: string): this {
    if (event) {
      this._listeners.delete(event);
    } else {
      this._listeners.clear();
    }
    return this;
  }

  listenerCount(event: string): number {
    return this._listeners.get(event)?.length ?? 0;
  }
}

// ============================================================================
// Types & Interfaces
// ============================================================================

/** Position data within an account */
export interface PositionData {
  symbol: string;
  quantity: number;
  avgCost: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPnl: number;
  realizedPnl: number;
}

/** Trade record for performance calculation */
export interface TradeRecord {
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  timestamp: number;
  pnl?: number;
}

/** Complete account data snapshot */
export interface AccountData {
  accountName: string;
  accountType: string;
  totalValue: number;
  cashBalance: number;
  positions: PositionData[];
  trades?: TradeRecord[];
  initialCapital: number;
  /** Equity curve: array of { timestamp, equity } for time-series analysis */
  equityCurve?: EquityPoint[];
}

export interface EquityPoint {
  timestamp: number;
  equity: number;
}

export interface AccountSummary {
  accountId: string;
  accountName: string;
  accountType: string;
  totalValue: number;
  totalPnl: number;
  pnlPct: number;
  positionsCount: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
}

export interface AccountComparison {
  accounts: string[];
  totalValue: number;
  totalPnl: number;
  correlation: number;
  diversificationScore: number;
  riskAdjustedReturn: number;
}

export interface AssetAllocation {
  symbol: string;
  totalValue: number;
  weight: number;
  accounts: string[];
  pnl: number;
}

export interface ConsolidatedPosition {
  symbol: string;
  totalQuantity: number;
  avgCost: number;
  currentPrice: number;
  totalMarketValue: number;
  totalUnrealizedPnl: number;
  totalRealizedPnl: number;
  accountCount: number;
  accounts: string[];
}

export interface PerformanceMetrics {
  totalReturn: number;
  annualizedReturn: number;
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdown: number;
  winRate: number;
  profitFactor: number;
  calmarRatio: number;
}

export interface RiskMetrics {
  volatility: number;
  downsideVolatility: number;
  valueAtRisk95: number;
  conditionalVaR95: number;
  maxDrawdown: number;
  maxDrawdownDuration: number;
  betaExposure: number;
  concentrationRisk: number;
}

export interface CorrelationMatrix {
  accounts: string[];
  matrix: number[][];
}

export interface AnalyticsReport {
  timestamp: number;
  accountCount: number;
  summaries: AccountSummary[];
  comparison: AccountComparison;
  assetAllocation: AssetAllocation[];
  consolidatedPositions: ConsolidatedPosition[];
  performance: PerformanceMetrics;
  risk: RiskMetrics;
  correlationMatrix: CorrelationMatrix;
  diversificationScore: number;
  ranking: AccountSummary[];
}

// ============================================================================
// AccountAnalytics Engine
// ============================================================================

const TRADING_DAYS_PER_YEAR = 252;
const RISK_FREE_RATE_DAILY = 0.02 / TRADING_DAYS_PER_YEAR; // ~2% annual

export class AccountAnalytics extends SimpleEventEmitter {
  private accountData: Map<string, AccountData> = new Map();

  constructor() {
    super();
    log.info('[AccountAnalytics] Engine initialized');
  }

  // --------------------------------------------------------------------------
  // Account Data Management
  // --------------------------------------------------------------------------

  /**
   * Add or update account data.
   */
  addAccountData(accountId: string, data: AccountData): void {
    const isNew = !this.accountData.has(accountId);
    this.accountData.set(accountId, data);
    log.info(`[AccountAnalytics] Account ${isNew ? 'added' : 'updated'}: ${accountId} (${data.accountName})`);
    this.emit(isNew ? 'account-added' : 'account-updated', accountId);
  }

  /**
   * Remove account data. Returns true if the account existed.
   */
  removeAccountData(accountId: string): boolean {
    if (!this.accountData.has(accountId)) {
      log.warn(`[AccountAnalytics] Cannot remove unknown account: ${accountId}`);
      return false;
    }
    this.accountData.delete(accountId);
    log.info(`[AccountAnalytics] Account removed: ${accountId}`);
    this.emit('account-removed', accountId);
    return true;
  }

  // --------------------------------------------------------------------------
  // Account Summary
  // --------------------------------------------------------------------------

  /**
   * Get summary for a single account. Returns `undefined` when the account is
   * not known — this matches the convention used elsewhere in the analytics
   * layer (e.g. "summary" consumers treat unknown accounts as missing) and
   * lets callers distinguish "no data" from "errored summary" without a
   * try/catch.
   */
  getAccountSummary(accountId: string): AccountSummary | undefined {
    const data = this.accountData.get(accountId);
    if (!data) {
      return undefined;
    }

    const totalPnl = this.calcTotalPnl(data);
    const pnlPct = data.initialCapital > 0
      ? (totalPnl / data.initialCapital) * 100
      : 0;
    const sharpeRatio = this.calcSharpeRatio(data);
    const maxDrawdown = this.calcMaxDrawdown(data);
    const winRate = this.calcWinRate(data);

    return {
      accountId,
      accountName: data.accountName,
      accountType: data.accountType,
      totalValue: data.totalValue,
      totalPnl,
      pnlPct,
      positionsCount: data.positions.length,
      sharpeRatio,
      maxDrawdown,
      winRate,
    };
  }

  /**
   * Get summaries for all accounts.
   */
  getAllAccountSummaries(): AccountSummary[] {
    const summaries: AccountSummary[] = [];
    for (const [id] of this.accountData) {
      summaries.push(this.getAccountSummary(id));
    }
    return summaries;
  }

  // --------------------------------------------------------------------------
  // Cross-Account Comparison
  // --------------------------------------------------------------------------

  /**
   * Compare a set of accounts.
   */
  compareAccounts(accountIds: string[]): AccountComparison {
    const validIds = accountIds.filter((id) => this.accountData.has(id));
    if (validIds.length === 0) {
      return {
        accounts: [],
        totalValue: 0,
        totalPnl: 0,
        correlation: 0,
        diversificationScore: 0,
        riskAdjustedReturn: 0,
      };
    }

    let totalValue = 0;
    let totalPnl = 0;

    for (const id of validIds) {
      const d = this.accountData.get(id)!;
      totalValue += d.totalValue;
      totalPnl += this.calcTotalPnl(d);
    }

    const correlation = this.calcPairwiseCorrelation(validIds);
    const diversificationScore = this.calcDiversificationScore(validIds);
    const riskAdjustedReturn = totalValue > 0
      ? totalPnl / totalValue / (this.calcPortfolioVolatility(validIds) || 1)
      : 0;

    return {
      accounts: validIds,
      totalValue,
      totalPnl,
      correlation,
      diversificationScore,
      riskAdjustedReturn,
    };
  }

  // --------------------------------------------------------------------------
  // Asset Allocation
  // --------------------------------------------------------------------------

  /**
   * Get aggregated asset allocation across all accounts.
   */
  getAssetAllocation(): AssetAllocation[] {
    const symbolMap = new Map<string, { totalValue: number; accounts: Set<string>; pnl: number }>();

    let grandTotal = 0;

    for (const [id, data] of this.accountData) {
      for (const pos of data.positions) {
        const entry = symbolMap.get(pos.symbol) ?? { totalValue: 0, accounts: new Set<string>(), pnl: 0 };
        entry.totalValue += pos.marketValue;
        entry.accounts.add(id);
        entry.pnl += pos.unrealizedPnl + pos.realizedPnl;
        symbolMap.set(pos.symbol, entry);
        grandTotal += pos.marketValue;
      }
    }

    const allocations: AssetAllocation[] = [];
    for (const [symbol, entry] of symbolMap) {
      allocations.push({
        symbol,
        totalValue: entry.totalValue,
        weight: grandTotal > 0 ? entry.totalValue / grandTotal : 0,
        accounts: Array.from(entry.accounts),
        pnl: entry.pnl,
      });
    }

    return allocations.sort((a, b) => b.weight - a.weight);
  }

  // --------------------------------------------------------------------------
  // Consolidated Positions
  // --------------------------------------------------------------------------

  /**
   * Get consolidated positions across all accounts.
   */
  getConsolidatedPositions(): ConsolidatedPosition[] {
    const posMap = new Map<string, {
      totalQuantity: number;
      totalCost: number;
      currentPrice: number;
      totalMarketValue: number;
      totalUnrealizedPnl: number;
      totalRealizedPnl: number;
      accounts: Set<string>;
    }>();

    for (const [id, data] of this.accountData) {
      for (const pos of data.positions) {
        const entry = posMap.get(pos.symbol) ?? {
          totalQuantity: 0,
          totalCost: 0,
          currentPrice: 0,
          totalMarketValue: 0,
          totalUnrealizedPnl: 0,
          totalRealizedPnl: 0,
          accounts: new Set<string>(),
        };
        entry.totalQuantity += pos.quantity;
        entry.totalCost += pos.avgCost * pos.quantity;
        entry.currentPrice = pos.currentPrice; // last seen price
        entry.totalMarketValue += pos.marketValue;
        entry.totalUnrealizedPnl += pos.unrealizedPnl;
        entry.totalRealizedPnl += pos.realizedPnl;
        entry.accounts.add(id);
        posMap.set(pos.symbol, entry);
      }
    }

    const consolidated: ConsolidatedPosition[] = [];
    for (const [symbol, e] of posMap) {
      const avgCost = e.totalQuantity > 0 ? e.totalCost / e.totalQuantity : 0;
      consolidated.push({
        symbol,
        totalQuantity: e.totalQuantity,
        avgCost,
        currentPrice: e.currentPrice,
        totalMarketValue: e.totalMarketValue,
        totalUnrealizedPnl: e.totalUnrealizedPnl,
        totalRealizedPnl: e.totalRealizedPnl,
        accountCount: e.accounts.size,
        accounts: Array.from(e.accounts),
      });
    }

    return consolidated.sort((a, b) => b.totalMarketValue - a.totalMarketValue);
  }

  // --------------------------------------------------------------------------
  // Performance Metrics
  // --------------------------------------------------------------------------

  /**
   * Get performance metrics. If accountId provided, scoped to that account;
   * otherwise aggregated across all accounts.
   */
  getPerformanceMetrics(accountId?: string): PerformanceMetrics {
    const equityCurve = this.buildEquityCurve(accountId);
    const trades = this.collectTrades(accountId);

    if (equityCurve.length < 2) {
      // Fallback: compute from static data
      return this.staticPerformanceMetrics(accountId);
    }

    const returns = this.calcReturns(equityCurve);
    const totalReturn = equityCurve.length >= 2
      ? (equityCurve[equityCurve.length - 1].equity - equityCurve[0].equity) / equityCurve[0].equity
      : 0;

    const n = returns.length;
    const annualizedReturn = n > 0
      ? Math.pow(1 + totalReturn, TRADING_DAYS_PER_YEAR / Math.max(n, 1)) - 1
      : 0;

    const avgReturn = returns.reduce((s, r) => s + r, 0) / Math.max(n, 1);
    const variance = returns.reduce((s, r) => s + (r - avgReturn) ** 2, 0) / Math.max(n, 1);
    const volatility = Math.sqrt(variance);

    const downsideReturns = returns.filter((r) => r < RISK_FREE_RATE_DAILY);
    const downsideVariance = downsideReturns.length > 0
      ? downsideReturns.reduce((s, r) => s + (r - RISK_FREE_RATE_DAILY) ** 2, 0) / downsideReturns.length
      : 0;
    const downsideVol = Math.sqrt(downsideVariance);

    const excessReturn = avgReturn - RISK_FREE_RATE_DAILY;
    const sharpeRatio = volatility > 0 ? (excessReturn / volatility) * Math.sqrt(TRADING_DAYS_PER_YEAR) : 0;
    const sortinoRatio = downsideVol > 0 ? (excessReturn / downsideVol) * Math.sqrt(TRADING_DAYS_PER_YEAR) : 0;

    const maxDrawdown = this.calcMaxDrawdownFromCurve(equityCurve);
    const calmarRatio = maxDrawdown > 0 ? annualizedReturn / (maxDrawdown / 100) : 0;

    const winRate = this.calcWinRateFromTrades(trades);
    const profitFactor = this.calcProfitFactor(trades);

    return {
      totalReturn,
      annualizedReturn,
      sharpeRatio,
      sortinoRatio,
      maxDrawdown,
      winRate,
      profitFactor,
      calmarRatio,
    };
  }

  // --------------------------------------------------------------------------
  // Risk Metrics
  // --------------------------------------------------------------------------

  /**
   * Get risk metrics. If accountId provided, scoped to that account.
   */
  getRiskMetrics(accountId?: string): RiskMetrics {
    const equityCurve = this.buildEquityCurve(accountId);

    if (equityCurve.length < 2) {
      return this.staticRiskMetrics(accountId);
    }

    const returns = this.calcReturns(equityCurve);
    const n = returns.length;
    const avgReturn = returns.reduce((s, r) => s + r, 0) / Math.max(n, 1);
    const variance = returns.reduce((s, r) => s + (r - avgReturn) ** 2, 0) / Math.max(n, 1);
    const volatility = Math.sqrt(variance) * Math.sqrt(TRADING_DAYS_PER_YEAR);

    const downsideReturns = returns.filter((r) => r < 0);
    const downsideVol = downsideReturns.length > 0
      ? Math.sqrt(downsideReturns.reduce((s, r) => s + r * r, 0) / downsideReturns.length) * Math.sqrt(TRADING_DAYS_PER_YEAR)
      : 0;

    // Historical VaR (95%)
    const sorted = [...returns].sort((a, b) => a - b);
    const varIdx = Math.floor(sorted.length * 0.05);
    const valueAtRisk95 = sorted.length > 0 ? Math.abs(sorted[varIdx]) : 0;

    // CVaR (Expected Shortfall)
    const tailReturns = sorted.slice(0, Math.max(varIdx, 1));
    const conditionalVaR95 = tailReturns.length > 0
      ? Math.abs(tailReturns.reduce((s, r) => s + r, 0) / tailReturns.length)
      : valueAtRisk95;

    const maxDrawdown = this.calcMaxDrawdownFromCurve(equityCurve);
    const maxDrawdownDuration = this.calcMaxDrawdownDuration(equityCurve);

    // Beta exposure: simplified as proportion of equity in positions
    const betaExposure = this.calcBetaExposure(accountId);

    // Concentration risk (Herfindahl index of position weights)
    const concentrationRisk = this.calcConcentrationRisk(accountId);

    return {
      volatility,
      downsideVolatility: downsideVol,
      valueAtRisk95,
      conditionalVaR95,
      maxDrawdown,
      maxDrawdownDuration,
      betaExposure,
      concentrationRisk,
    };
  }

  // --------------------------------------------------------------------------
  // Correlation Matrix
  // --------------------------------------------------------------------------

  /**
   * Get pairwise correlation matrix across all accounts based on equity returns.
   */
  getCorrelationMatrix(): CorrelationMatrix {
    const ids = Array.from(this.accountData.keys());
    const n = ids.length;
    const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));

    const returnSeries = new Map<string, number[]>();
    for (const id of ids) {
      const curve = this.buildEquityCurve(id);
      returnSeries.set(id, this.calcReturns(curve));
    }

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) {
          matrix[i][j] = 1;
        } else {
          const rI = returnSeries.get(ids[i]) ?? [];
          const rJ = returnSeries.get(ids[j]) ?? [];
          matrix[i][j] = this.pearsonCorrelation(rI, rJ);
        }
      }
    }

    return { accounts: ids, matrix };
  }

  // --------------------------------------------------------------------------
  // Diversification Score
  // --------------------------------------------------------------------------

  /**
   * Compute a diversification score (0–1) for the entire portfolio.
   * Higher = more diversified.
   * Based on: 1 - average pairwise correlation, weighted by account size.
   */
  getDiversificationScore(): number {
    const ids = Array.from(this.accountData.keys());
    if (ids.length <= 1) return 0;

    const { matrix } = this.getCorrelationMatrix();
    let sumCorr = 0;
    let count = 0;

    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        sumCorr += matrix[i][j];
        count++;
      }
    }

    const avgCorr = count > 0 ? sumCorr / count : 0;
    // Score: 1 = perfectly uncorrelated, 0 = perfectly correlated
    return Math.max(0, Math.min(1, (1 - avgCorr) / 2));
  }

  // --------------------------------------------------------------------------
  // Account Ranking
  // --------------------------------------------------------------------------

  /**
   * Get all account summaries sorted by a composite performance score.
   * Score = 0.4 * pnlPct + 0.3 * sharpeRatio + 0.2 * winRate + 0.1 * (100 - maxDrawdown)
   */
  getAccountRanking(): AccountSummary[] {
    const summaries = this.getAllAccountSummaries();
    return summaries.sort((a, b) => {
      const scoreA = 0.4 * a.pnlPct + 0.3 * a.sharpeRatio + 0.2 * a.winRate + 0.1 * (100 - a.maxDrawdown);
      const scoreB = 0.4 * b.pnlPct + 0.3 * b.sharpeRatio + 0.2 * b.winRate + 0.1 * (100 - b.maxDrawdown);
      return scoreB - scoreA;
    });
  }

  // --------------------------------------------------------------------------
  // Report Generation
  // --------------------------------------------------------------------------

  /**
   * Generate a comprehensive analytics report.
   */
  generateReport(): AnalyticsReport {
    const summaries = this.getAllAccountSummaries();
    const ids = Array.from(this.accountData.keys());
    const comparison = this.compareAccounts(ids);
    const assetAllocation = this.getAssetAllocation();
    const consolidatedPositions = this.getConsolidatedPositions();
    const performance = this.getPerformanceMetrics();
    const risk = this.getRiskMetrics();
    const correlationMatrix = this.getCorrelationMatrix();
    const diversificationScore = this.getDiversificationScore();
    const ranking = this.getAccountRanking();

    const report: AnalyticsReport = {
      timestamp: Date.now(),
      accountCount: this.accountData.size,
      summaries,
      comparison,
      assetAllocation,
      consolidatedPositions,
      performance,
      risk,
      correlationMatrix,
      diversificationScore,
      ranking,
    };

    log.info(`[AccountAnalytics] Report generated: ${ids.length} accounts, ${consolidatedPositions.length} positions`);
    this.emit('report-generated', report);
    return report;
  }

  // --------------------------------------------------------------------------
  // Utility / Cleanup
  // --------------------------------------------------------------------------

  /** Get the number of tracked accounts. */
  get accountCount(): number {
    return this.accountData.size;
  }

  /** Check if an account exists. */
  hasAccount(accountId: string): boolean {
    return this.accountData.has(accountId);
  }

  /** Get all account IDs. */
  getAccountIds(): string[] {
    return Array.from(this.accountData.keys());
  }

  /** Clear all data and listeners. */
  destroy(): void {
    this.accountData.clear();
    this.removeAllListeners();
    log.info('[AccountAnalytics] Destroyed');
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  private calcTotalPnl(data: AccountData): number {
    let posPnl = 0;
    for (const p of data.positions) {
      posPnl += p.unrealizedPnl + p.realizedPnl;
    }
    if (data.trades) {
      for (const t of data.trades) {
        if (t.pnl !== undefined) {
          posPnl += t.pnl;
        }
      }
    }
    // If trades pnl is already included in positions, we avoid double counting
    // by preferring position-level pnl
    if (data.trades && data.trades.some((t) => t.pnl !== undefined) && data.positions.length === 0) {
      return data.trades.reduce((s, t) => s + (t.pnl ?? 0), 0);
    }
    return posPnl;
  }

  private calcSharpeRatio(data: AccountData): number {
    if (data.equityCurve && data.equityCurve.length >= 2) {
      const returns = this.calcReturns(data.equityCurve);
      const avg = returns.reduce((s, r) => s + r, 0) / returns.length;
      const variance = returns.reduce((s, r) => s + (r - avg) ** 2, 0) / returns.length;
      const vol = Math.sqrt(variance);
      return vol > 0 ? ((avg - RISK_FREE_RATE_DAILY) / vol) * Math.sqrt(TRADING_DAYS_PER_YEAR) : 0;
    }
    // Fallback: simple estimate
    const totalPnl = this.calcTotalPnl(data);
    const ret = data.initialCapital > 0 ? totalPnl / data.initialCapital : 0;
    return ret > 0 ? ret / 0.15 : 0; // assume 15% vol as fallback
  }

  private calcMaxDrawdown(data: AccountData): number {
    if (data.equityCurve && data.equityCurve.length >= 2) {
      return this.calcMaxDrawdownFromCurve(data.equityCurve);
    }
    // Fallback: estimate from total pnl
    const totalPnl = this.calcTotalPnl(data);
    if (totalPnl < 0 && data.initialCapital > 0) {
      return Math.abs(totalPnl / data.initialCapital) * 100;
    }
    return 0;
  }

  private calcMaxDrawdownFromCurve(curve: EquityPoint[]): number {
    let peak = -Infinity;
    let maxDd = 0;
    for (const pt of curve) {
      if (pt.equity > peak) peak = pt.equity;
      const dd = peak > 0 ? ((peak - pt.equity) / peak) * 100 : 0;
      if (dd > maxDd) maxDd = dd;
    }
    return maxDd;
  }

  private calcMaxDrawdownDuration(curve: EquityPoint[]): number {
    let peak = -Infinity;
    let peakIdx = 0;
    let maxDuration = 0;
    for (let i = 0; i < curve.length; i++) {
      if (curve[i].equity > peak) {
        peak = curve[i].equity;
        peakIdx = i;
      }
      const duration = i - peakIdx;
      if (duration > maxDuration) maxDuration = duration;
    }
    return maxDuration;
  }

  private calcWinRate(data: AccountData): number {
    if (data.trades && data.trades.length > 0) {
      return this.calcWinRateFromTrades(data.trades);
    }
    // Fallback from positions
    if (data.positions.length === 0) return 0;
    const winners = data.positions.filter((p) => p.unrealizedPnl > 0 || p.realizedPnl > 0).length;
    return (winners / data.positions.length) * 100;
  }

  private calcWinRateFromTrades(trades: TradeRecord[]): number {
    const withPnl = trades.filter((t) => t.pnl !== undefined);
    if (withPnl.length === 0) return 0;
    const wins = withPnl.filter((t) => (t.pnl ?? 0) > 0).length;
    return (wins / withPnl.length) * 100;
  }

  private calcProfitFactor(trades: TradeRecord[]): number {
    const withPnl = trades.filter((t) => t.pnl !== undefined);
    let gains = 0;
    let losses = 0;
    for (const t of withPnl) {
      if ((t.pnl ?? 0) > 0) gains += t.pnl!;
      else losses += Math.abs(t.pnl!);
    }
    return losses > 0 ? gains / losses : gains > 0 ? Infinity : 0;
  }

  private buildEquityCurve(accountId?: string): EquityPoint[] {
    if (accountId) {
      const data = this.accountData.get(accountId);
      if (!data || !data.equityCurve) return [];
      return data.equityCurve;
    }
    // Merge all account equity curves by timestamp
    const allCurves: EquityPoint[][] = [];
    for (const [, data] of this.accountData) {
      if (data.equityCurve && data.equityCurve.length > 0) {
        allCurves.push(data.equityCurve);
      }
    }
    if (allCurves.length === 0) return [];

    // Collect all unique timestamps and sum equity at each
    const timestampMap = new Map<number, number>();
    for (const curve of allCurves) {
      for (const pt of curve) {
        timestampMap.set(pt.timestamp, (timestampMap.get(pt.timestamp) ?? 0) + pt.equity);
      }
    }

    return Array.from(timestampMap.entries())
      .map(([timestamp, equity]) => ({ timestamp, equity }))
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  private collectTrades(accountId?: string): TradeRecord[] {
    const trades: TradeRecord[] = [];
    const iterate = (data: AccountData) => {
      if (data.trades) trades.push(...data.trades);
    };
    if (accountId) {
      const data = this.accountData.get(accountId);
      if (data) iterate(data);
    } else {
      for (const [, data] of this.accountData) iterate(data);
    }
    return trades;
  }

  private calcReturns(curve: EquityPoint[]): number[] {
    if (curve.length < 2) return [];
    const returns: number[] = [];
    for (let i = 1; i < curve.length; i++) {
      const prev = curve[i - 1].equity;
      returns.push(prev > 0 ? (curve[i].equity - prev) / prev : 0);
    }
    return returns;
  }

  private calcPairwiseCorrelation(ids: string[]): number {
    if (ids.length < 2) return 0;
    const { matrix } = this.getCorrelationMatrix();
    const idxSet = new Set(ids.map((id) => Array.from(this.accountData.keys()).indexOf(id)));
    let sum = 0;
    let count = 0;
    const allIds = Array.from(this.accountData.keys());
    for (let i = 0; i < allIds.length; i++) {
      for (let j = i + 1; j < allIds.length; j++) {
        if (idxSet.has(i) && idxSet.has(j)) {
          sum += matrix[i][j];
          count++;
        }
      }
    }
    return count > 0 ? sum / count : 0;
  }

  private calcDiversificationScore(ids: string[]): number {
    if (ids.length <= 1) return 0;

    // Based on position overlap: less overlap = higher diversification
    const symbolSets = new Map<string, Set<string>>();
    for (const id of ids) {
      const data = this.accountData.get(id);
      if (data) {
        symbolSets.set(id, new Set(data.positions.map((p) => p.symbol)));
      }
    }

    let totalOverlap = 0;
    let totalPairs = 0;
    const idArr = Array.from(symbolSets.keys());
    for (let i = 0; i < idArr.length; i++) {
      for (let j = i + 1; j < idArr.length; j++) {
        const setA = symbolSets.get(idArr[i])!;
        const setB = symbolSets.get(idArr[j])!;
        const union = new Set([...setA, ...setB]);
        const intersection = new Set([...setA].filter((s) => setB.has(s)));
        const overlap = union.size > 0 ? intersection.size / union.size : 0;
        totalOverlap += overlap;
        totalPairs++;
      }
    }

    const avgOverlap = totalPairs > 0 ? totalOverlap / totalPairs : 0;
    return 1 - avgOverlap;
  }

  private calcPortfolioVolatility(ids: string[]): number {
    const curve = this.buildEquityCurve();
    if (curve.length < 2) return 0.15; // default assumption
    const returns = this.calcReturns(curve);
    const avg = returns.reduce((s, r) => s + r, 0) / returns.length;
    const variance = returns.reduce((s, r) => s + (r - avg) ** 2, 0) / returns.length;
    return Math.sqrt(variance) * Math.sqrt(TRADING_DAYS_PER_YEAR);
  }

  private calcBetaExposure(accountId?: string): number {
    let totalValue = 0;
    let positionValue = 0;
    const iterate = (data: AccountData) => {
      totalValue += data.totalValue;
      for (const p of data.positions) {
        positionValue += p.marketValue;
      }
    };
    if (accountId) {
      const data = this.accountData.get(accountId);
      if (data) iterate(data);
    } else {
      for (const [, data] of this.accountData) iterate(data);
    }
    return totalValue > 0 ? positionValue / totalValue : 0;
  }

  private calcConcentrationRisk(accountId?: string): number {
    const positions: PositionData[] = [];
    if (accountId) {
      const data = this.accountData.get(accountId);
      if (data) positions.push(...data.positions);
    } else {
      for (const [, data] of this.accountData) positions.push(...data.positions);
    }
    if (positions.length === 0) return 0;
    const totalValue = positions.reduce((s, p) => s + p.marketValue, 0);
    if (totalValue === 0) return 0;
    // Herfindahl index
    return positions.reduce((s, p) => {
      const w = p.marketValue / totalValue;
      return s + w * w;
    }, 0);
  }

  private pearsonCorrelation(x: number[], y: number[]): number {
    const n = Math.min(x.length, y.length);
    if (n < 2) return 0;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
    for (let i = 0; i < n; i++) {
      sumX += x[i];
      sumY += y[i];
      sumXY += x[i] * y[i];
      sumX2 += x[i] * x[i];
      sumY2 += y[i] * y[i];
    }
    const denom = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    return denom > 0 ? (n * sumXY - sumX * sumY) / denom : 0;
  }

  private staticPerformanceMetrics(accountId?: string): PerformanceMetrics {
    let totalValue = 0;
    let totalCapital = 0;
    let winCount = 0;
    let totalCount = 0;
    let gains = 0;
    let losses = 0;

    const iterate = (data: AccountData) => {
      totalValue += data.totalValue;
      totalCapital += data.initialCapital;
      for (const p of data.positions) {
        totalCount++;
        if (p.unrealizedPnl + p.realizedPnl > 0) {
          winCount++;
          gains += p.unrealizedPnl + p.realizedPnl;
        } else {
          losses += Math.abs(p.unrealizedPnl + p.realizedPnl);
        }
      }
    };

    if (accountId) {
      const data = this.accountData.get(accountId);
      if (data) iterate(data);
    } else {
      for (const [, data] of this.accountData) iterate(data);
    }

    const totalReturn = totalCapital > 0 ? (totalValue - totalCapital) / totalCapital : 0;
    const winRate = totalCount > 0 ? (winCount / totalCount) * 100 : 0;
    const profitFactor = losses > 0 ? gains / losses : gains > 0 ? Infinity : 0;

    return {
      totalReturn,
      annualizedReturn: totalReturn, // no time info, assume same
      sharpeRatio: totalReturn > 0 ? totalReturn / 0.15 : 0,
      sortinoRatio: totalReturn > 0 ? totalReturn / 0.10 : 0,
      maxDrawdown: totalReturn < 0 ? Math.abs(totalReturn) * 100 : 0,
      winRate,
      profitFactor,
      calmarRatio: 0,
    };
  }

  private staticRiskMetrics(accountId?: string): RiskMetrics {
    const concentrationRisk = this.calcConcentrationRisk(accountId);
    const betaExposure = this.calcBetaExposure(accountId);
    const maxDrawdown = accountId
      ? this.calcMaxDrawdown(this.accountData.get(accountId)!)
      : Math.max(...Array.from(this.accountData.values()).map((d) => this.calcMaxDrawdown(d)), 0);

    return {
      volatility: 0.15,
      downsideVolatility: 0.10,
      valueAtRisk95: 0,
      conditionalVaR95: 0,
      maxDrawdown,
      maxDrawdownDuration: 0,
      betaExposure,
      concentrationRisk,
    };
  }
}

// ============================================================================
// Factory
// ============================================================================

export function createAccountAnalytics(): AccountAnalytics {
  return new AccountAnalytics();
}

export default AccountAnalytics;

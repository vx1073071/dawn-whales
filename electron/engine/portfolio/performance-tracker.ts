/**
 * J-35-03: PerformanceTracker Engine
 * Tracks portfolio performance metrics including Sharpe, Sortino, and Calmar ratios
 */

import log from 'electron-log';

export interface PerformanceMetrics {
  totalReturn: number;
  annualizedReturn: number;
  sharpe: number;
  sortino: number;
  calmar: number;
  maxDrawdown: number;
  maxDrawdownDuration: number; // in days
  winRate: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
}

export interface TradeRecord {
  symbol: string;
  side: 'BUY' | 'SELL';
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  pnl: number;
  pnlPct: number;
  entryTime: number;
  exitTime: number;
  holdingDays: number;
}

export interface EquityPoint {
  timestamp: number;
  equity: number;
  drawdown: number;
  drawdownPct: number;
}

export class PerformanceTracker {
  private trades: TradeRecord[] = [];
  private equityCurve: EquityPoint[] = [];
  private peakEquity: number = 0;
  private currentEquity: number = 0;
  private initialEquity: number = 0;
  private riskFreeRate: number = 0.02; // 2% annual risk-free rate

  constructor(initialEquity: number = 100000) {
    this.initialEquity = initialEquity;
    this.currentEquity = initialEquity;
    this.peakEquity = initialEquity;
    log.info(`[PerformanceTracker] Initialized with initial equity: ${initialEquity}`);
  }

  // ── Trade Recording ──────────────────────────────────────────────────────

  addTrade(trade: TradeRecord): void {
    this.trades.push(trade);
    log.info(`[PerformanceTracker] Added trade: ${trade.symbol} ${trade.side} PnL: ${trade.pnl.toFixed(2)}`);
  }

  addTrades(trades: TradeRecord[]): void {
    this.trades.push(...trades);
    log.info(`[PerformanceTracker] Added ${trades.length} trades`);
  }

  updateEquity(equity: number): void {
    this.currentEquity = equity;
    if (equity > this.peakEquity) {
      this.peakEquity = equity;
    }

    const drawdown = this.peakEquity - equity;
    const drawdownPct = this.peakEquity > 0 ? (drawdown / this.peakEquity) * 100 : 0;

    this.equityCurve.push({
      timestamp: Date.now(),
      equity,
      drawdown,
      drawdownPct,
    });
  }

  // ── Performance Metrics ──────────────────────────────────────────────────

  getMetrics(): PerformanceMetrics {
    const totalReturn = this.calculateTotalReturn();
    const annualizedReturn = this.calculateAnnualizedReturn();
    const sharpe = this.calculateSharpeRatio();
    const sortino = this.calculateSortinoRatio();
    const calmar = this.calculateCalmarRatio();
    const maxDrawdown = this.calculateMaxDrawdown();
    const maxDrawdownDuration = this.calculateMaxDrawdownDuration();
    const winRate = this.calculateWinRate();
    const profitFactor = this.calculateProfitFactor();
    const avgWin = this.calculateAvgWin();
    const avgLoss = this.calculateAvgLoss();

    const winningTrades = this.trades.filter(t => t.pnl > 0);
    const losingTrades = this.trades.filter(t => t.pnl < 0);

    return {
      totalReturn,
      annualizedReturn,
      sharpe,
      sortino,
      calmar,
      maxDrawdown,
      maxDrawdownDuration,
      winRate,
      profitFactor,
      avgWin,
      avgLoss,
      totalTrades: this.trades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
    };
  }

  calculateTotalReturn(): number {
    if (this.initialEquity === 0) return 0;
    return ((this.currentEquity - this.initialEquity) / this.initialEquity) * 100;
  }

  calculateAnnualizedReturn(): number {
    if (this.equityCurve.length < 2) return 0;

    const firstPoint = this.equityCurve[0];
    const lastPoint = this.equityCurve[this.equityCurve.length - 1];
    const daysDiff = (lastPoint.timestamp - firstPoint.timestamp) / (1000 * 60 * 60 * 24);

    if (daysDiff === 0) return 0;

    const totalReturn = (lastPoint.equity - firstPoint.equity) / firstPoint.equity;
    const years = daysDiff / 365;

    return (Math.pow(1 + totalReturn, 1 / years) - 1) * 100;
  }

  calculateSharpeRatio(): number {
    if (this.equityCurve.length < 2) return 0;

    const returns = this.calculateDailyReturns();
    if (returns.length === 0) return 0;

    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const stdDev = this.calculateStdDev(returns);

    if (stdDev === 0) return 0;

    const dailyRiskFree = this.riskFreeRate / 252;
    const sharpe = (avgReturn - dailyRiskFree) / stdDev;

    // Annualize
    return sharpe * Math.sqrt(252);
  }

  calculateSortinoRatio(): number {
    if (this.equityCurve.length < 2) return 0;

    const returns = this.calculateDailyReturns();
    if (returns.length === 0) return 0;

    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const negativeReturns = returns.filter(r => r < 0);

    if (negativeReturns.length === 0) return Infinity;

    const downsideDeviation = this.calculateStdDev(negativeReturns);
    if (downsideDeviation === 0) return 0;

    const dailyRiskFree = this.riskFreeRate / 252;
    const sortino = (avgReturn - dailyRiskFree) / downsideDeviation;

    // Annualize
    return sortino * Math.sqrt(252);
  }

  calculateCalmarRatio(): number {
    const annualizedReturn = this.calculateAnnualizedReturn();
    const maxDrawdown = this.calculateMaxDrawdown();

    if (maxDrawdown === 0) return 0;

    return annualizedReturn / maxDrawdown;
  }

  calculateMaxDrawdown(): number {
    if (this.equityCurve.length === 0) return 0;

    let maxDrawdown = 0;
    for (const point of this.equityCurve) {
      if (point.drawdownPct > maxDrawdown) {
        maxDrawdown = point.drawdownPct;
      }
    }

    return maxDrawdown;
  }

  calculateMaxDrawdownDuration(): number {
    if (this.equityCurve.length < 2) return 0;

    let maxDuration = 0;
    let currentDuration = 0;
    let inDrawdown = false;

    for (const point of this.equityCurve) {
      if (point.drawdown > 0) {
        if (!inDrawdown) {
          inDrawdown = true;
          currentDuration = 1;
        } else {
          currentDuration++;
        }
      } else {
        if (inDrawdown) {
          maxDuration = Math.max(maxDuration, currentDuration);
          inDrawdown = false;
          currentDuration = 0;
        }
      }
    }

    // Check if still in drawdown
    if (inDrawdown) {
      maxDuration = Math.max(maxDuration, currentDuration);
    }

    return maxDuration;
  }

  calculateWinRate(): number {
    if (this.trades.length === 0) return 0;

    const winningTrades = this.trades.filter(t => t.pnl > 0);
    return (winningTrades.length / this.trades.length) * 100;
  }

  calculateProfitFactor(): number {
    const winningTrades = this.trades.filter(t => t.pnl > 0);
    const losingTrades = this.trades.filter(t => t.pnl < 0);

    const totalProfit = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
    const totalLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0));

    if (totalLoss === 0) return Infinity;

    return totalProfit / totalLoss;
  }

  calculateAvgWin(): number {
    const winningTrades = this.trades.filter(t => t.pnl > 0);
    if (winningTrades.length === 0) return 0;

    const totalWin = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
    return totalWin / winningTrades.length;
  }

  calculateAvgLoss(): number {
    const losingTrades = this.trades.filter(t => t.pnl < 0);
    if (losingTrades.length === 0) return 0;

    const totalLoss = losingTrades.reduce((sum, t) => sum + Math.abs(t.pnl), 0);
    return totalLoss / losingTrades.length;
  }

  // ── Helper Methods ───────────────────────────────────────────────────────

  private calculateDailyReturns(): number[] {
    const returns: number[] = [];
    for (let i = 1; i < this.equityCurve.length; i++) {
      const prev = this.equityCurve[i - 1].equity;
      const curr = this.equityCurve[i].equity;
      if (prev > 0) {
        returns.push((curr - prev) / prev);
      }
    }
    return returns;
  }

  private calculateStdDev(values: number[]): number {
    if (values.length === 0) return 0;

    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    const variance = squaredDiffs.reduce((sum, v) => sum + v, 0) / values.length;

    return Math.sqrt(variance);
  }

  // ── Queries ──────────────────────────────────────────────────────────────

  getTrades(): TradeRecord[] {
    return [...this.trades];
  }

  getEquityCurve(): EquityPoint[] {
    return [...this.equityCurve];
  }

  getCurrentEquity(): number {
    return this.currentEquity;
  }

  getPeakEquity(): number {
    return this.peakEquity;
  }

  // ── Control ──────────────────────────────────────────────────────────────

  setRiskFreeRate(rate: number): void {
    this.riskFreeRate = rate;
    log.info(`[PerformanceTracker] Risk-free rate set to ${rate}`);
  }

  reset(): void {
    this.trades = [];
    this.equityCurve = [];
    this.peakEquity = this.initialEquity;
    this.currentEquity = this.initialEquity;
    log.info('[PerformanceTracker] Reset to initial state');
  }

  clearTrades(): void {
    this.trades = [];
    log.info('[PerformanceTracker] Trades cleared');
  }

  clearEquityCurve(): void {
    this.equityCurve = [];
    this.peakEquity = this.initialEquity;
    this.currentEquity = this.initialEquity;
    log.info('[PerformanceTracker] Equity curve cleared');
  }
}

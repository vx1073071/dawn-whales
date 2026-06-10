import { EngineError, ErrorCode } from '../errors';
/**
 * Portfolio Risk Engine
 * Dawn Whales Project (J-39-03, R39)
 *
 * Portfolio-level risk calculations: VaR, CVaR, correlation matrix, stress testing.
 *
 * Uses inline EventEmitter polyfill for jsdom compatibility.
 */

import log from 'electron-log';

// ============================================================================
// EventEmitter Polyfill
// ============================================================================

type EventListener = (...args: unknown[]) => void;

class EventEmitterPolyfill {
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
      const idx = list.indexOf(listener);
      if (idx !== -1) list.splice(idx, 1);
      if (list.length === 0) this._listeners.delete(event);
    }
    return this;
  }

  once(event: string, listener: EventListener): this {
    const wrapper = (...args: unknown[]) => {
      this.off(event, wrapper);
      listener(...args);
    };
    return this.on(event, wrapper);
  }

  emit(event: string, ...args: unknown[]): boolean {
    const list = this._listeners.get(event);
    if (!list || list.length === 0) return false;
    for (const fn of [...list]) {
      try { fn(...args); } catch (err) {
        log.error('[PortfolioRiskEngine] Event listener error:', err);
      }
    }
    return true;
  }

  removeAllListeners(event?: string): this {
    if (event) { this._listeners.delete(event); }
    else { this._listeners.clear(); }
    return this;
  }

  listenerCount(event: string): number {
    return this._listeners.get(event)?.length ?? 0;
  }
}

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface Position {
  symbol: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  marketValue: number;
  weight: number; // Portfolio weight (0-1)
}

export interface Portfolio {
  positions: Position[];
  totalValue: number;
  cashPosition: number;
  timestamp: number;
}

export interface VaRResult {
  var_95: number; // 95% confidence VaR
  var_99: number; // 99% confidence VaR
  cvar_95: number; // 95% CVaR (Expected Shortfall)
  cvar_99: number; // 99% CVaR
  horizon: number; // Days
  method: 'historical' | 'parametric' | 'monte_carlo';
  calculatedAt: number;
}

export interface CorrelationMatrix {
  symbols: string[];
  matrix: number[][]; // Correlation coefficients
  calculatedAt: number;
}

export interface StressScenario {
  name: string;
  description: string;
  shocks: Record<string, number>; // Symbol -> shock percentage
}

export interface StressTestResult {
  scenario: StressScenario;
  portfolioLoss: number;
  positionImpacts: {
    symbol: string;
    shock: number;
    impact: number;
    newPrice: number;
  }[];
  totalValueAfter: number;
  testedAt: number;
}

export interface RiskMetrics {
  portfolioVaR: VaRResult;
  correlationMatrix: CorrelationMatrix;
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdown: number;
  beta: number;
  trackingError: number;
  informationRatio: number;
  calculatedAt: number;
}

export interface RiskBudget {
  symbol: string;
  currentWeight: number;
  targetWeight: number;
  riskContribution: number; // % of total portfolio risk
  riskBudget: number; // Allocated risk budget
  deviation: number; // currentWeight - targetWeight
}

export interface HistoricalReturn {
  symbol: string;
  date: string;
  return: number;
}

// ============================================================================
// Portfolio Risk Engine
// ============================================================================

export class PortfolioRiskEngine extends EventEmitterPolyfill {
  private portfolio: Portfolio | null = null;
  private historicalReturns: Map<string, HistoricalReturn[]> = new Map();
  private riskFreeRate = 0.02; // 2% annual risk-free rate
  private benchmarkReturns: number[] = [];

  constructor() {
    super();
    log.info('[PortfolioRiskEngine] Initialized');
  }

  // ── Portfolio Management ──────────────────────────────────────────

  /**
   * Set current portfolio
   */
  setPortfolio(portfolio: Portfolio): void {
    this.portfolio = portfolio;
    log.info(`[PortfolioRiskEngine] Portfolio set: ${portfolio.positions.length} positions, $${portfolio.totalValue}`);
    this.emit('portfolio:updated', portfolio);
  }

  /**
   * Get current portfolio
   */
  getPortfolio(): Portfolio | null {
    return this.portfolio;
  }

  /**
   * Add historical returns data
   */
  addHistoricalReturns(symbol: string, returns: HistoricalReturn[]): void {
    if (!this.historicalReturns.has(symbol)) {
      this.historicalReturns.set(symbol, []);
    }
    this.historicalReturns.get(symbol)!.push(...returns);
  }

  /**
   * Set benchmark returns
   */
  setBenchmarkReturns(returns: number[]): void {
    this.benchmarkReturns = returns;
  }

  /**
   * Set risk-free rate
   */
  setRiskFreeRate(rate: number): void {
    this.riskFreeRate = rate;
  }

  // ── Value at Risk (VaR) ──────────────────────────────────────────

  /**
   * Calculate historical VaR
   */
  calculateHistoricalVaR(horizon = 1, confidence = 95): VaRResult {
    if (!this.portfolio) {
      throw new EngineError("Portfolio not set", { code: ErrorCode.ENGINE_INTERNAL_ERROR });
    }

    // Get portfolio returns
    const portfolioReturns = this.calculatePortfolioReturns();
    if (portfolioReturns.length === 0) {
      return this.emptyVaRResult(horizon, 'historical');
    }

    // Sort returns
    const sorted = [...portfolioReturns].sort((a, b) => a - b);

    // Calculate VaR at different confidence levels
    const var_95 = this.percentile(sorted, 5); // 5th percentile for 95% VaR
    const var_99 = this.percentile(sorted, 1); // 1st percentile for 99% VaR

    // Scale by sqrt(horizon)
    const horizonScale = Math.sqrt(horizon);
    const scaled_var_95 = var_95 * horizonScale * this.portfolio.totalValue;
    const scaled_var_99 = var_99 * horizonScale * this.portfolio.totalValue;

    // Calculate CVaR (Expected Shortfall)
    const cvar_95 = this.calculateCVaR(sorted, 5) * horizonScale * this.portfolio.totalValue;
    const cvar_99 = this.calculateCVaR(sorted, 1) * horizonScale * this.portfolio.totalValue;

    return {
      var_95: Math.abs(scaled_var_95),
      var_99: Math.abs(scaled_var_99),
      cvar_95: Math.abs(cvar_95),
      cvar_99: Math.abs(cvar_99),
      horizon,
      method: 'historical',
      calculatedAt: Date.now(),
    };
  }

  /**
   * Calculate parametric VaR (assuming normal distribution)
   */
  calculateParametricVaR(horizon = 1): VaRResult {
    if (!this.portfolio) {
      throw new EngineError("Portfolio not set", { code: ErrorCode.ENGINE_INTERNAL_ERROR });
    }

    const portfolioReturns = this.calculatePortfolioReturns();
    if (portfolioReturns.length === 0) {
      return this.emptyVaRResult(horizon, 'parametric');
    }

    const mean = portfolioReturns.reduce((s, r) => s + r, 0) / portfolioReturns.length;
    const variance = portfolioReturns.reduce((s, r) => s + (r - mean) ** 2, 0) / portfolioReturns.length;
    const std = Math.sqrt(variance);

    // Z-scores for confidence levels
    const z_95 = 1.645;
    const z_99 = 2.326;

    const horizonScale = Math.sqrt(horizon);
    const var_95 = (mean - z_95 * std) * horizonScale * this.portfolio.totalValue;
    const var_99 = (mean - z_99 * std) * horizonScale * this.portfolio.totalValue;

    // CVaR approximation
    const cvar_95 = (mean - std * 2.06) * horizonScale * this.portfolio.totalValue;
    const cvar_99 = (mean - std * 2.67) * horizonScale * this.portfolio.totalValue;

    return {
      var_95: Math.abs(var_95),
      var_99: Math.abs(var_99),
      cvar_95: Math.abs(cvar_95),
      cvar_99: Math.abs(cvar_99),
      horizon,
      method: 'parametric',
      calculatedAt: Date.now(),
    };
  }

  private calculatePortfolioReturns(): number[] {
    if (!this.portfolio) return [];

    const symbols = this.portfolio.positions.map(p => p.symbol);
    const weights = this.portfolio.positions.map(p => p.weight);

    // Get common dates
    const allDates = new Set<string>();
    for (const symbol of symbols) {
      const returns = this.historicalReturns.get(symbol) ?? [];
      for (const r of returns) {
        allDates.add(r.date);
      }
    }

    const dates = Array.from(allDates).sort();
    const portfolioReturns: number[] = [];

    for (const date of dates) {
      let weightedReturn = 0;
      for (let i = 0; i < symbols.length; i++) {
        const returns = this.historicalReturns.get(symbols[i]) ?? [];
        const dayReturn = returns.find(r => r.date === date);
        if (dayReturn) {
          weightedReturn += dayReturn.return * weights[i];
        }
      }
      portfolioReturns.push(weightedReturn);
    }

    return portfolioReturns;
  }

  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const index = Math.floor(sorted.length * p / 100);
    return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
  }

  private calculateCVaR(sorted: number[], p: number): number {
    const cutoffIndex = Math.floor(sorted.length * p / 100);
    const tail = sorted.slice(0, Math.max(1, cutoffIndex));
    return tail.reduce((s, v) => s + v, 0) / tail.length;
  }

  private emptyVaRResult(horizon: number, method: VaRResult['method']): VaRResult {
    return {
      var_95: 0,
      var_99: 0,
      cvar_95: 0,
      cvar_99: 0,
      horizon,
      method,
      calculatedAt: Date.now(),
    };
  }

  // ── Correlation Matrix ────────────────────────────────────────────

  /**
   * Calculate correlation matrix
   */
  calculateCorrelationMatrix(): CorrelationMatrix {
    if (!this.portfolio) {
      throw new EngineError("Portfolio not set", { code: ErrorCode.ENGINE_INTERNAL_ERROR });
    }

    const symbols = this.portfolio.positions.map(p => p.symbol);
    const matrix: number[][] = [];

    // Get returns for each symbol
    const returnsMap = new Map<string, number[]>();
    for (const symbol of symbols) {
      const returns = (this.historicalReturns.get(symbol) ?? []).map(r => r.return);
      returnsMap.set(symbol, returns);
    }

    // Calculate correlations
    for (let i = 0; i < symbols.length; i++) {
      matrix[i] = [];
      for (let j = 0; j < symbols.length; j++) {
        if (i === j) {
          matrix[i][j] = 1.0; // Perfect correlation with self
        } else {
          const returns_i = returnsMap.get(symbols[i]) ?? [];
          const returns_j = returnsMap.get(symbols[j]) ?? [];
          matrix[i][j] = this.pearsonCorrelation(returns_i, returns_j);
        }
      }
    }

    return {
      symbols,
      matrix,
      calculatedAt: Date.now(),
    };
  }

  private pearsonCorrelation(x: number[], y: number[]): number {
    const n = Math.min(x.length, y.length);
    if (n < 2) return 0;

    const meanX = x.slice(0, n).reduce((s, v) => s + v, 0) / n;
    const meanY = y.slice(0, n).reduce((s, v) => s + v, 0) / n;

    let numerator = 0;
    let denomX = 0;
    let denomY = 0;

    for (let i = 0; i < n; i++) {
      const dx = x[i] - meanX;
      const dy = y[i] - meanY;
      numerator += dx * dy;
      denomX += dx * dx;
      denomY += dy * dy;
    }

    const denom = Math.sqrt(denomX * denomY);
    return denom > 0 ? numerator / denom : 0;
  }

  // ── Stress Testing ────────────────────────────────────────────────

  /**
   * Run stress test scenario
   */
  runStressTest(scenario: StressScenario): StressTestResult {
    if (!this.portfolio) {
      throw new EngineError("Portfolio not set", { code: ErrorCode.ENGINE_INTERNAL_ERROR });
    }

    const positionImpacts: StressTestResult['positionImpacts'] = [];
    let totalLoss = 0;

    for (const position of this.portfolio.positions) {
      // Resolve per-symbol shock first; fall back to wildcard '*' if present
      let shock = scenario.shocks[position.symbol];
      if (shock === undefined) {
        shock = scenario.shocks['*'] ?? 0;
      }
      const newPrice = position.currentPrice * (1 + shock / 100);
      const impact = (newPrice - position.currentPrice) * position.quantity;

      positionImpacts.push({
        symbol: position.symbol,
        shock,
        impact,
        newPrice,
      });

      totalLoss += impact;
    }

    return {
      scenario,
      portfolioLoss: totalLoss,
      positionImpacts,
      totalValueAfter: this.portfolio.totalValue + totalLoss,
      testedAt: Date.now(),
    };
  }

  /**
   * Get predefined stress scenarios
   */
  getPredefinedScenarios(): StressScenario[] {
    return [
      {
        name: 'Market Crash',
        description: '2008-style market crash',
        shocks: { '*': -40 }, // 40% drop across all positions
      },
      {
        name: 'Mild Correction',
        description: '10% market correction',
        shocks: { '*': -10 },
      },
      {
        name: 'Tech Crash',
        description: 'Tech sector specific crash',
        shocks: { 'BTCUSDT': -50, 'ETHUSDT': -60 },
      },
    ];
  }

  // ── Risk Metrics ──────────────────────────────────────────────────

  /**
   * Calculate comprehensive risk metrics
   */
  calculateRiskMetrics(): RiskMetrics {
    if (!this.portfolio) {
      throw new EngineError("Portfolio not set", { code: ErrorCode.ENGINE_INTERNAL_ERROR });
    }

    const portfolioReturns = this.calculatePortfolioReturns();

    // VaR
    const portfolioVaR = this.calculateHistoricalVaR(1, 95);

    // Correlation matrix
    const correlationMatrix = this.calculateCorrelationMatrix();

    // Sharpe Ratio
    const sharpeRatio = this.calculateSharpeRatio(portfolioReturns);

    // Sortino Ratio
    const sortinoRatio = this.calculateSortinoRatio(portfolioReturns);

    // Max Drawdown
    const maxDrawdown = this.calculateMaxDrawdown(portfolioReturns);

    // Beta (if benchmark available)
    const beta = this.calculateBeta(portfolioReturns);

    // Tracking Error
    const trackingError = this.calculateTrackingError(portfolioReturns);

    // Information Ratio
    const informationRatio = this.calculateInformationRatio(portfolioReturns);

    return {
      portfolioVaR,
      correlationMatrix,
      sharpeRatio,
      sortinoRatio,
      maxDrawdown,
      beta,
      trackingError,
      informationRatio,
      calculatedAt: Date.now(),
    };
  }

  private calculateSharpeRatio(returns: number[]): number {
    if (returns.length === 0) return 0;

    const meanReturn = returns.reduce((s, r) => s + r, 0) / returns.length;
    const variance = returns.reduce((s, r) => s + (r - meanReturn) ** 2, 0) / returns.length;
    const std = Math.sqrt(variance);

    if (std === 0) return 0;

    const annualizedReturn = meanReturn * 252;
    const annualizedStd = std * Math.sqrt(252);

    return (annualizedReturn - this.riskFreeRate) / annualizedStd;
  }

  private calculateSortinoRatio(returns: number[]): number {
    if (returns.length === 0) return 0;

    const meanReturn = returns.reduce((s, r) => s + r, 0) / returns.length;
    const downsideReturns = returns.filter(r => r < 0);

    if (downsideReturns.length === 0) return 0;

    const downsideVariance = downsideReturns.reduce((s, r) => s + r ** 2, 0) / downsideReturns.length;
    const downsideStd = Math.sqrt(downsideVariance);

    if (downsideStd === 0) return 0;

    const annualizedReturn = meanReturn * 252;
    const annualizedDownsideStd = downsideStd * Math.sqrt(252);

    return (annualizedReturn - this.riskFreeRate) / annualizedDownsideStd;
  }

  private calculateMaxDrawdown(returns: number[]): number {
    if (returns.length === 0) return 0;

    let cumulative = 1;
    let peak = 1;
    let maxDrawdown = 0;

    for (const r of returns) {
      cumulative *= (1 + r);
      peak = Math.max(peak, cumulative);
      const drawdown = (peak - cumulative) / peak;
      maxDrawdown = Math.max(maxDrawdown, drawdown);
    }

    return maxDrawdown * 100; // Return as percentage
  }

  private calculateBeta(portfolioReturns: number[]): number {
    if (this.benchmarkReturns.length === 0 || portfolioReturns.length === 0) {
      return 0;
    }

    const n = Math.min(portfolioReturns.length, this.benchmarkReturns.length);
    const portfolio = portfolioReturns.slice(0, n);
    const benchmark = this.benchmarkReturns.slice(0, n);

    const meanP = portfolio.reduce((s, r) => s + r, 0) / n;
    const meanB = benchmark.reduce((s, r) => s + r, 0) / n;

    let covariance = 0;
    let varianceB = 0;

    for (let i = 0; i < n; i++) {
      const dp = portfolio[i] - meanP;
      const db = benchmark[i] - meanB;
      covariance += dp * db;
      varianceB += db * db;
    }

    return varianceB > 0 ? covariance / varianceB : 0;
  }

  private calculateTrackingError(portfolioReturns: number[]): number {
    if (this.benchmarkReturns.length === 0 || portfolioReturns.length === 0) {
      return 0;
    }

    const n = Math.min(portfolioReturns.length, this.benchmarkReturns.length);
    const diffs: number[] = [];

    for (let i = 0; i < n; i++) {
      diffs.push(portfolioReturns[i] - this.benchmarkReturns[i]);
    }

    const meanDiff = diffs.reduce((s, d) => s + d, 0) / n;
    const variance = diffs.reduce((s, d) => s + (d - meanDiff) ** 2, 0) / n;

    return Math.sqrt(variance) * Math.sqrt(252) * 100; // Annualized percentage
  }

  private calculateInformationRatio(portfolioReturns: number[]): number {
    if (this.benchmarkReturns.length === 0 || portfolioReturns.length === 0) {
      return 0;
    }

    const trackingError = this.calculateTrackingError(portfolioReturns);
    if (trackingError === 0) return 0;

    const n = Math.min(portfolioReturns.length, this.benchmarkReturns.length);
    const activeReturn = portfolioReturns.slice(0, n).reduce((s, r, i) =>
      s + (r - this.benchmarkReturns[i]), 0) / n;

    const annualizedActiveReturn = activeReturn * 252;
    return annualizedActiveReturn / (trackingError / 100);
  }

  // ── Risk Budgeting ────────────────────────────────────────────────

  /**
   * Calculate risk budget allocation
   */
  calculateRiskBudget(targetWeights?: Record<string, number>): RiskBudget[] {
    if (!this.portfolio) {
      throw new EngineError("Portfolio not set", { code: ErrorCode.ENGINE_INTERNAL_ERROR });
    }

    const budgets: RiskBudget[] = [];

    for (const position of this.portfolio.positions) {
      const targetWeight = targetWeights?.[position.symbol] ?? position.weight;
      const riskContribution = position.weight * 100; // Simplified: weight = risk contribution

      budgets.push({
        symbol: position.symbol,
        currentWeight: position.weight,
        targetWeight,
        riskContribution,
        riskBudget: targetWeight * 100,
        deviation: position.weight - targetWeight,
      });
    }

    return budgets;
  }

  // ── Utilities ─────────────────────────────────────────────────────

  /**
   * Clear all data
   */
  clearAll(): void {
    this.portfolio = null;
    this.historicalReturns.clear();
    this.benchmarkReturns = [];
  }

  /**
   * Reset engine
   */
  reset(): void {
    this.clearAll();
    this.removeAllListeners();
  }

  /**
   * Destroy engine
   */
  destroy(): void {
    this.reset();
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let engineInstance: PortfolioRiskEngine | null = null;

export function getPortfolioRiskEngine(): PortfolioRiskEngine {
  if (!engineInstance) {
    engineInstance = new PortfolioRiskEngine();
  }
  return engineInstance;
}

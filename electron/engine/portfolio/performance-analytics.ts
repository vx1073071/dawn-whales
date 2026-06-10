/**
 * JVS-91: Performance Analytics Dashboard
 * 
 * Comprehensive performance analytics and attribution
 * Features:
 * - Performance metrics (returns, risk-adjusted returns)
 * - Performance attribution (sector, factor, security level)
 * - Benchmark comparison
 * - Drawdown analysis
 * - Rolling performance metrics
 * - Performance vs benchmark decomposition
 */

import { EventEmitter } from 'events';
import log from 'electron-log';

export interface PerformanceMetrics {
  totalReturn: number;         // Total return percentage
  annualizedReturn: number;    // Annualized return
  volatility: number;          // Annualized volatility
  sharpeRatio: number;         // Sharpe ratio
  sortinoRatio: number;       // Sortino ratio
  maxDrawdown: number;         // Maximum drawdown
  maxDrawdownDuration: number; // Duration of max drawdown (days)
  calmarRatio: number;         // Calmar ratio
  treynorRatio: number;        // Treynor ratio
  informationRatio: number;    // Information ratio vs benchmark
  trackingError: number;       // Tracking error vs benchmark
  alpha: number;               // Alpha vs benchmark
  beta: number;                // Beta vs benchmark
  timestamp: number;
}

export interface PerformanceAttribution {
  symbol: string;
  weight: number;
  return: number;
  contribution: number;     // Contribution to portfolio return
  allocationEffect: number; // Allocation effect
  selectionEffect: number;  // Selection effect
  interactionEffect: number; // Interaction effect
  totalEffect: number;      // Total effect
  timestamp: number;
}

export interface RollingPerformance {
  period: number;           // Rolling period (days)
  returns: number[];        // Rolling returns
  volatilities: number[];   // Rolling volatilities
  sharpeRatios: number[];   // Rolling Sharpe ratios
  timestamp: number;
}

export interface DrawdownAnalysis {
  currentDrawdown: number;  // Current drawdown percentage
  maxDrawdown: number;      // Maximum drawdown
  maxDrawdownStart: number; // Start date of max drawdown
  maxDrawdownEnd: number;   // End date of max drawdown
  maxDrawdownDuration: number; // Duration in days
  drawdowns: Array<{
    start: number;
    end: number;
    depth: number;
    duration: number;
    recovered: boolean;
  }>;
  timestamp: number;
}

export interface BenchmarkComparison {
  portfolioReturn: number;
  benchmarkReturn: number;
  excessReturn: number;     // Portfolio - Benchmark
  alpha: number;            // Risk-adjusted excess return
  beta: number;             // Sensitivity to benchmark
  trackingError: number;    // Tracking error
  informationRatio: number; // Information ratio
  correlation: number;      // Correlation with benchmark
  timestamp: number;
}

export interface PerformanceAnalyticsConfig {
  enabled: boolean;
  benchmark: string;        // Benchmark symbol
  riskFreeRate: number;     // Risk-free rate (annual)
  rollingPeriods: number[]; // Rolling periods (days)
  checkInterval: number;    // Check interval (milliseconds)
}

const DEFAULT_CONFIG: PerformanceAnalyticsConfig = {
  enabled: true,
  benchmark: '000300.SH',   // CSI 300
  riskFreeRate: 0.03,       // 3% annual
  rollingPeriods: [20, 60, 120, 252], // 20, 60, 120, 252 days
  checkInterval: 60000,     // 1 minute
};

export class PerformanceAnalyticsDashboard extends EventEmitter {
  private config: PerformanceAnalyticsConfig;
  private checkTimer?: NodeJS.Timeout;
  private performanceHistory: PerformanceMetrics[] = [];
  private maxHistory = 100;

  constructor(config?: Partial<PerformanceAnalyticsConfig>) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Start performance monitoring
   */
  start(): void {
    if (this.checkTimer) {
      this.stop();
    }

    this.checkTimer = setInterval(() => {
      this.updateAnalytics();
    }, this.config.checkInterval);

    log.info(`[PerformanceAnalytics] Started with interval ${this.config.checkInterval}ms`);
  }

  /**
   * Stop performance monitoring
   */
  stop(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = undefined;
      log.info('[PerformanceAnalytics] Stopped');
    }
  }

  /**
   * Calculate performance metrics
   */
  calculateMetrics(returns: number[], benchmarkReturns?: number[]): PerformanceMetrics {
    const totalReturn = this.calculateTotalReturn(returns);
    const annualizedReturn = this.calculateAnnualizedReturn(returns);
    const volatility = this.calculateVolatility(returns);
    const sharpeRatio = this.calculateSharpeRatio(returns);
    const sortinoRatio = this.calculateSortinoRatio(returns);
    const maxDrawdown = this.calculateMaxDrawdown(returns);
    const maxDrawdownDuration = this.calculateMaxDrawdownDuration(returns);
    const calmarRatio = this.calculateCalmarRatio(annualizedReturn, maxDrawdown);

    let treynorRatio = 0;
    let informationRatio = 0;
    let trackingError = 0;
    let alpha = 0;
    let beta = 0;

    if (benchmarkReturns && benchmarkReturns.length > 0) {
      beta = this.calculateBeta(returns, benchmarkReturns);
      trackingError = this.calculateTrackingError(returns, benchmarkReturns);
      const benchmarkReturn = this.calculateAnnualizedReturn(benchmarkReturns);
      alpha = annualizedReturn - (this.config.riskFreeRate + beta * (benchmarkReturn - this.config.riskFreeRate));
      informationRatio = trackingError > 0 ? (annualizedReturn - benchmarkReturn) / trackingError : 0;
      treynorRatio = beta > 0 ? (annualizedReturn - this.config.riskFreeRate) / beta : 0;
    }

    return {
      totalReturn,
      annualizedReturn,
      volatility,
      sharpeRatio,
      sortinoRatio,
      maxDrawdown,
      maxDrawdownDuration,
      calmarRatio,
      treynorRatio,
      informationRatio,
      trackingError,
      alpha,
      beta,
      timestamp: Date.now(),
    };
  }

  /**
   * Calculate performance attribution
   */
  calculateAttribution(
    portfolioWeights: Map<string, number>,
    portfolioReturns: Map<string, number>,
    benchmarkWeights: Map<string, number>,
    benchmarkReturns: Map<string, number>
  ): PerformanceAttribution[] {
    const attributions: PerformanceAttribution[] = [];
    const allSymbols = new Set([...portfolioWeights.keys(), ...benchmarkWeights.keys()]);

    for (const symbol of allSymbols) {
      const weight = portfolioWeights.get(symbol) || 0;
      const return_ = portfolioReturns.get(symbol) || 0;
      const benchmarkWeight = benchmarkWeights.get(symbol) || 0;
      const benchmarkReturn = benchmarkReturns.get(symbol) || 0;

      const contribution = weight * return_;
      const benchmarkContribution = benchmarkWeight * benchmarkReturn;

      // Brinson attribution
      const allocationEffect = (weight - benchmarkWeight) * benchmarkReturn;
      const selectionEffect = benchmarkWeight * (return_ - benchmarkReturn);
      const interactionEffect = (weight - benchmarkWeight) * (return_ - benchmarkReturn);
      const totalEffect = contribution - benchmarkContribution;

      attributions.push({
        symbol,
        weight,
        return: return_,
        contribution,
        allocationEffect,
        selectionEffect,
        interactionEffect,
        totalEffect,
        timestamp: Date.now(),
      });
    }

    return attributions;
  }

  /**
   * Calculate rolling performance
   */
  calculateRollingPerformance(returns: number[], periods?: number[]): RollingPerformance[] {
    const rollingPeriods = periods || this.config.rollingPeriods;
    const results: RollingPerformance[] = [];

    for (const period of rollingPeriods) {
      if (returns.length < period) continue;

      const rollingReturns: number[] = [];
      const rollingVolatilities: number[] = [];
      const rollingSharpeRatios: number[] = [];

      for (let i = period; i < returns.length; i++) {
        const windowReturns = returns.slice(i - period, i);
        const windowReturn = this.calculateTotalReturn(windowReturns);
        const windowVolatility = this.calculateVolatility(windowReturns);
        const windowSharpe = windowVolatility > 0
          ? (this.calculateAnnualizedReturn(windowReturns) - this.config.riskFreeRate) / windowVolatility
          : 0;

        rollingReturns.push(windowReturn);
        rollingVolatilities.push(windowVolatility);
        rollingSharpeRatios.push(windowSharpe);
      }

      results.push({
        period,
        returns: rollingReturns,
        volatilities: rollingVolatilities,
        sharpeRatios: rollingSharpeRatios,
        timestamp: Date.now(),
      });
    }

    return results;
  }

  /**
   * Analyze drawdowns
   */
  analyzeDrawdowns(returns: number[]): DrawdownAnalysis {
    const drawdowns: Array<{
      start: number;
      end: number;
      depth: number;
      duration: number;
      recovered: boolean;
    }> = [];

    let peak = returns[0];
    let maxDrawdown = 0;
    let maxDrawdownStart = 0;
    let maxDrawdownEnd = 0;
    let maxDrawdownDuration = 0;
    let currentDrawdown = 0;
    let drawdownStart = 0;

    for (let i = 0; i < returns.length; i++) {
      const cumulativeReturn = this.calculateTotalReturn(returns.slice(0, i + 1));

      if (cumulativeReturn > peak) {
        peak = cumulativeReturn;
        if (currentDrawdown > 0) {
          // Drawdown recovered
          drawdowns.push({
            start: drawdownStart,
            end: i,
            depth: currentDrawdown,
            duration: i - drawdownStart,
            recovered: true,
          });
          currentDrawdown = 0;
        }
      } else {
        const drawdown = (peak - cumulativeReturn) / peak * 100;
        if (drawdown > currentDrawdown) {
          currentDrawdown = drawdown;
          if (currentDrawdown === 0) {
            drawdownStart = i;
          }
        }

        if (drawdown > maxDrawdown) {
          maxDrawdown = drawdown;
          maxDrawdownStart = drawdownStart;
          maxDrawdownEnd = i;
          maxDrawdownDuration = i - drawdownStart;
        }
      }
    }

    // Add current drawdown if not recovered
    if (currentDrawdown > 0) {
      drawdowns.push({
        start: drawdownStart,
        end: returns.length - 1,
        depth: currentDrawdown,
        duration: returns.length - 1 - drawdownStart,
        recovered: false,
      });
    }

    return {
      currentDrawdown,
      maxDrawdown,
      maxDrawdownStart,
      maxDrawdownEnd,
      maxDrawdownDuration,
      drawdowns,
      timestamp: Date.now(),
    };
  }

  /**
   * Compare with benchmark
   */
  compareWithBenchmark(returns: number[], benchmarkReturns: number[]): BenchmarkComparison {
    const portfolioReturn = this.calculateAnnualizedReturn(returns);
    const benchmarkReturn = this.calculateAnnualizedReturn(benchmarkReturns);
    const excessReturn = portfolioReturn - benchmarkReturn;
    const beta = this.calculateBeta(returns, benchmarkReturns);
    const trackingError = this.calculateTrackingError(returns, benchmarkReturns);
    const informationRatio = trackingError > 0 ? excessReturn / trackingError : 0;
    const correlation = this.calculateCorrelation(returns, benchmarkReturns);
    const alpha = portfolioReturn - (this.config.riskFreeRate + beta * (benchmarkReturn - this.config.riskFreeRate));

    return {
      portfolioReturn,
      benchmarkReturn,
      excessReturn,
      alpha,
      beta,
      trackingError,
      informationRatio,
      correlation,
      timestamp: Date.now(),
    };
  }

  // ── Helper Methods ─────────────────────────────────────────────────────

  private calculateTotalReturn(returns: number[]): number {
    if (returns.length === 0) return 0;
    return returns.reduce((acc, r) => acc * (1 + r), 1) - 1;
  }

  private calculateAnnualizedReturn(returns: number[]): number {
    if (returns.length === 0) return 0;
    const totalReturn = this.calculateTotalReturn(returns);
    const years = returns.length / 252; // Assuming daily returns
    return Math.pow(1 + totalReturn, 1 / years) - 1;
  }

  private calculateVolatility(returns: number[]): number {
    if (returns.length === 0) return 0;
    const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
    const variance = returns.reduce((s, r) => s + Math.pow(r - mean, 2), 0) / returns.length;
    return Math.sqrt(variance) * Math.sqrt(252); // Annualize
  }

  private calculateSharpeRatio(returns: number[]): number {
    const annualizedReturn = this.calculateAnnualizedReturn(returns);
    const volatility = this.calculateVolatility(returns);
    return volatility > 0 ? (annualizedReturn - this.config.riskFreeRate) / volatility : 0;
  }

  private calculateSortinoRatio(returns: number[]): number {
    const annualizedReturn = this.calculateAnnualizedReturn(returns);
    const downsideReturns = returns.filter(r => r < 0);
    if (downsideReturns.length === 0) return 0;

    const downsideVariance = downsideReturns.reduce((s, r) => s + Math.pow(r, 2), 0) / downsideReturns.length;
    const downsideDeviation = Math.sqrt(downsideVariance) * Math.sqrt(252);

    return downsideDeviation > 0 ? (annualizedReturn - this.config.riskFreeRate) / downsideDeviation : 0;
  }

  private calculateMaxDrawdown(returns: number[]): number {
    if (returns.length === 0) return 0;

    let peak = returns[0];
    let maxDrawdown = 0;

    for (const ret of returns) {
      const cumulativeReturn = this.calculateTotalReturn([ret]);
      if (cumulativeReturn > peak) {
        peak = cumulativeReturn;
      }
      const drawdown = (peak - cumulativeReturn) / peak;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    return maxDrawdown * 100;
  }

  private calculateMaxDrawdownDuration(returns: number[]): number {
    if (returns.length === 0) return 0;

    let peak = returns[0];
    let maxDuration = 0;
    let currentDuration = 0;

    for (const ret of returns) {
      const cumulativeReturn = this.calculateTotalReturn([ret]);
      if (cumulativeReturn > peak) {
        peak = cumulativeReturn;
        currentDuration = 0;
      } else {
        currentDuration++;
        if (currentDuration > maxDuration) {
          maxDuration = currentDuration;
        }
      }
    }

    return maxDuration;
  }

  private calculateCalmarRatio(annualizedReturn: number, maxDrawdown: number): number {
    return maxDrawdown > 0 ? annualizedReturn / (maxDrawdown / 100) : 0;
  }

  private calculateBeta(returns: number[], benchmarkReturns: number[]): number {
    if (returns.length !== benchmarkReturns.length || returns.length === 0) {
      return 0;
    }

    const n = returns.length;
    const meanR = returns.reduce((s, r) => s + r, 0) / n;
    const meanB = benchmarkReturns.reduce((s, r) => s + r, 0) / n;

    let covariance = 0;
    let variance = 0;

    for (let i = 0; i < n; i++) {
      covariance += (returns[i] - meanR) * (benchmarkReturns[i] - meanB);
      variance += Math.pow(benchmarkReturns[i] - meanB, 2);
    }

    return variance > 0 ? covariance / variance : 0;
  }

  private calculateTrackingError(returns: number[], benchmarkReturns: number[]): number {
    if (returns.length !== benchmarkReturns.length || returns.length === 0) {
      return 0;
    }

    const excessReturns = returns.map((r, i) => r - benchmarkReturns[i]);
    const mean = excessReturns.reduce((s, r) => s + r, 0) / excessReturns.length;
    const variance = excessReturns.reduce((s, r) => s + Math.pow(r - mean, 2), 0) / excessReturns.length;

    return Math.sqrt(variance) * Math.sqrt(252); // Annualize
  }

  private calculateCorrelation(returns1: number[], returns2: number[]): number {
    if (returns1.length !== returns2.length || returns1.length === 0) {
      return 0;
    }

    const n = returns1.length;
    const mean1 = returns1.reduce((s, r) => s + r, 0) / n;
    const mean2 = returns2.reduce((s, r) => s + r, 0) / n;

    let covariance = 0;
    let variance1 = 0;
    let variance2 = 0;

    for (let i = 0; i < n; i++) {
      covariance += (returns1[i] - mean1) * (returns2[i] - mean2);
      variance1 += Math.pow(returns1[i] - mean1, 2);
      variance2 += Math.pow(returns2[i] - mean2, 2);
    }

    return (variance1 > 0 && variance2 > 0)
      ? covariance / Math.sqrt(variance1 * variance2)
      : 0;
  }

  /**
   * Update analytics
   */
  private updateAnalytics(): void {
    // This method should be called periodically to update analytics
    // Implementation would integrate with portfolio data
    log.info('[PerformanceAnalytics] Updating analytics...');
  }

  /**
   * Get performance history
   */
  getHistory(): PerformanceMetrics[] {
    return [...this.performanceHistory];
  }

  /**
   * Get summary
   */
  getSummary(): {
    totalMetrics: number;
    latestMetrics: PerformanceMetrics | null;
  } {
    return {
      totalMetrics: this.performanceHistory.length,
      latestMetrics: this.performanceHistory.length > 0
        ? this.performanceHistory[this.performanceHistory.length - 1]
        : null,
    };
  }
}

// Singleton
let performanceAnalyticsInstance: PerformanceAnalyticsDashboard | null = null;

export function getPerformanceAnalyticsDashboard(config?: Partial<PerformanceAnalyticsConfig>): PerformanceAnalyticsDashboard {
  if (!performanceAnalyticsInstance) {
    performanceAnalyticsInstance = new PerformanceAnalyticsDashboard(config);
  }
  return performanceAnalyticsInstance;
}

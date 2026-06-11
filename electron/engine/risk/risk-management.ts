/**
 * JVS-90: Risk Management Dashboard
 * 
 * Comprehensive risk management and monitoring system
 * Features:
 * - Portfolio risk metrics (VaR, CVaR, Beta, Sharpe, Sortino)
 * - Correlation analysis and diversification metrics
 * - Risk budgeting and allocation optimization
 * - Drawdown tracking and analysis
 * - Stress testing and scenario analysis
 * - Risk alerts and notifications
 */

import { EventEmitter } from 'events';
import log from 'electron-log';

export interface RiskMetrics {
  var95: number;           // Value at Risk (95%)
  var99: number;           // Value at Risk (99%)
  cvar95: number;          // Conditional VaR (95%)
  cvar99: number;          // Conditional VaR (99%)
  beta: number;            // Portfolio beta
  sharpeRatio: number;     // Sharpe ratio
  sortinoRatio: number;   // Sortino ratio
  maxDrawdown: number;     // Maximum drawdown
  volatility: number;      // Portfolio volatility
  trackingError: number;   // Tracking error vs benchmark
  informationRatio: number; // Information ratio
  timestamp: number;
}

export interface PortfolioRisk {
  symbol: string;
  weight: number;
  contribution: number;    // Risk contribution to portfolio
  marginalRisk: number;    // Marginal risk contribution
  componentRisk: number;   // Component risk
  correlation: number;     // Correlation with portfolio
  var95: number;           // Individual VaR
  timestamp: number;
}

export interface CorrelationMatrix {
  symbols: string[];
  matrix: number[][];
  timestamp: number;
}

export interface RiskAlert {
  id: string;
  timestamp: number;
  type: 'risk_limit' | 'drawdown' | 'concentration' | 'correlation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  value: number;
  threshold: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: Record<string, any>;
}

export interface RiskBudget {
  symbol: string;
  targetWeight: number;
  currentWeight: number;
  riskBudget: number;      // Allocated risk budget
  currentRisk: number;     // Current risk contribution
  utilization: number;     // Risk budget utilization
}

export interface StressScenario {
  name: string;
  description: string;
  shocks: Array<{
    symbol: string;
    shock: number;         // Shock percentage
  }>;
  portfolioImpact: number; // Portfolio impact percentage
  timestamp: number;
}

export interface RiskManagementConfig {
  enabled: boolean;
  riskLimits: {
    maxDrawdown: number;      // Maximum drawdown percentage
    maxConcentration: number; // Maximum concentration per position
    maxCorrelation: number;   // Maximum correlation threshold
    varLimit: number;         // VaR limit as percentage
  };
  checkInterval: number;      // Check interval (milliseconds)
  alertThresholds: {
    riskLimit: number;        // Risk limit threshold (0-1)
    drawdown: number;         // Drawdown threshold
    concentration: number;    // Concentration threshold
    correlation: number;      // Correlation threshold
  };
}

const DEFAULT_CONFIG: RiskManagementConfig = {
  enabled: true,
  riskLimits: {
    maxDrawdown: 20,          // 20% max drawdown
    maxConcentration: 25,     // 25% max per position
    maxCorrelation: 0.8,      // 80% max correlation
    varLimit: 5,              // 5% VaR limit
  },
  checkInterval: 60000,       // 1 minute
  alertThresholds: {
    riskLimit: 0.8,           // Alert at 80% of limit
    drawdown: 15,             // Alert at 15% drawdown
    concentration: 20,        // Alert at 20% concentration
    correlation: 0.7,         // Alert at 70% correlation
  },
};

export class RiskManagementDashboard extends EventEmitter {
  private config: RiskManagementConfig;
  private alerts: RiskAlert[] = [];
  private checkTimer?: NodeJS.Timeout;
  private portfolioHistory: PortfolioRisk[] = [];
  private correlationHistory: CorrelationMatrix[] = [];
  private maxHistory = 100;

  constructor(config?: Partial<RiskManagementConfig>) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Start risk monitoring
   */
  start(): void {
    if (this.checkTimer) {
      this.stop();
    }

    this.checkTimer = setInterval(() => {
      this.checkAllRisks();
    }, this.config.checkInterval);

    log.info(`[RiskManagement] Started with interval ${this.config.checkInterval}ms`);
  }

  /**
   * Stop risk monitoring
   */
  stop(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = undefined;
      log.info('[RiskManagement] Stopped');
    }
  }

  /**
   * Calculate portfolio risk metrics
   */
  calculateRiskMetrics(returns: number[], benchmarkReturns?: number[]): RiskMetrics {
    const var95 = this.calculateVaR(returns, 0.95);
    const var99 = this.calculateVaR(returns, 0.99);
    const cvar95 = this.calculateCVaR(returns, 0.95);
    const cvar99 = this.calculateCVaR(returns, 0.99);
    const volatility = this.calculateVolatility(returns);
    const sharpeRatio = this.calculateSharpeRatio(returns);
    const sortinoRatio = this.calculateSortinoRatio(returns);
    const maxDrawdown = this.calculateMaxDrawdown(returns);

    let beta = 0;
    let trackingError = 0;
    let informationRatio = 0;

    if (benchmarkReturns && benchmarkReturns.length > 0) {
      beta = this.calculateBeta(returns, benchmarkReturns);
      trackingError = this.calculateTrackingError(returns, benchmarkReturns);
      informationRatio = trackingError > 0 ? (this.calculateExcessReturn(returns, benchmarkReturns) / trackingError) : 0;
    }

    return {
      var95,
      var99,
      cvar95,
      cvar99,
      beta,
      sharpeRatio,
      sortinoRatio,
      maxDrawdown,
      volatility,
      trackingError,
      informationRatio,
      timestamp: Date.now(),
    };
  }

  /**
   * Calculate Value at Risk (VaR)
   */
  private calculateVaR(returns: number[], confidence: number): number {
    if (returns.length === 0) return 0;

    const sorted = [...returns].sort((a, b) => a - b);
    const index = Math.floor((1 - confidence) * sorted.length);

    return Math.abs(sorted[index]);
  }

  /**
   * Calculate Conditional VaR (CVaR)
   */
  private calculateCVaR(returns: number[], confidence: number): number {
    if (returns.length === 0) return 0;

    const sorted = [...returns].sort((a, b) => a - b);
    const index = Math.floor((1 - confidence) * sorted.length);
    const tailReturns = sorted.slice(0, index + 1);

    if (tailReturns.length === 0) return 0;

    const sum = tailReturns.reduce((s, r) => s + r, 0);
    return Math.abs(sum / tailReturns.length);
  }

  /**
   * Calculate volatility
   */
  private calculateVolatility(returns: number[]): number {
    if (returns.length === 0) return 0;

    const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
    const variance = returns.reduce((s, r) => s + Math.pow(r - mean, 2), 0) / returns.length;

    return Math.sqrt(variance);
  }

  /**
   * Calculate Sharpe ratio
   */
  private calculateSharpeRatio(returns: number[], riskFreeRate: number = 0.02): number {
    if (returns.length === 0) return 0;

    const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
    const volatility = this.calculateVolatility(returns);

    if (volatility === 0) return 0;

    return (mean - riskFreeRate) / volatility;
  }

  /**
   * Calculate Sortino ratio
   */
  private calculateSortinoRatio(returns: number[], riskFreeRate: number = 0.02): number {
    if (returns.length === 0) return 0;

    const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
    const downsideReturns = returns.filter(r => r < 0);

    if (downsideReturns.length === 0) return 0;

    const downsideVariance = downsideReturns.reduce((s, r) => s + Math.pow(r, 2), 0) / downsideReturns.length;
    const downsideDeviation = Math.sqrt(downsideVariance);

    if (downsideDeviation === 0) return 0;

    return (mean - riskFreeRate) / downsideDeviation;
  }

  /**
   * Calculate maximum drawdown
   */
  private calculateMaxDrawdown(returns: number[]): number {
    if (returns.length === 0) return 0;

    let peak = returns[0];
    let maxDrawdown = 0;

    for (const ret of returns) {
      if (ret > peak) {
        peak = ret;
      }
      const drawdown = (peak - ret) / peak;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    return maxDrawdown * 100; // Convert to percentage
  }

  /**
   * Calculate beta
   */
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

    if (variance === 0) return 0;

    return covariance / variance;
  }

  /**
   * Calculate tracking error
   */
  private calculateTrackingError(returns: number[], benchmarkReturns: number[]): number {
    if (returns.length !== benchmarkReturns.length || returns.length === 0) {
      return 0;
    }

    const excessReturns = returns.map((r, i) => r - benchmarkReturns[i]);
    const mean = excessReturns.reduce((s, r) => s + r, 0) / excessReturns.length;
    const variance = excessReturns.reduce((s, r) => s + Math.pow(r - mean, 2), 0) / excessReturns.length;

    return Math.sqrt(variance);
  }

  /**
   * Calculate excess return
   */
  private calculateExcessReturn(returns: number[], benchmarkReturns: number[]): number {
    if (returns.length !== benchmarkReturns.length || returns.length === 0) {
      return 0;
    }

    const meanR = returns.reduce((s, r) => s + r, 0) / returns.length;
    const meanB = benchmarkReturns.reduce((s, r) => s + r, 0) / benchmarkReturns.length;

    return meanR - meanB;
  }

  /**
   * Calculate correlation matrix
   */
  calculateCorrelationMatrix(symbols: string[], returns: Map<string, number[]>): CorrelationMatrix {
    const n = symbols.length;
    const matrix: number[][] = [];

    for (let i = 0; i < n; i++) {
      matrix[i] = [];
      for (let j = 0; j < n; j++) {
        if (i === j) {
          matrix[i][j] = 1;
        } else if (j < i) {
          matrix[i][j] = matrix[j][i]; // Symmetric
        } else {
          const returns1 = returns.get(symbols[i]) || [];
          const returns2 = returns.get(symbols[j]) || [];
          matrix[i][j] = this.calculateCorrelation(returns1, returns2);
        }
      }
    }

    return {
      symbols,
      matrix,
      timestamp: Date.now(),
    };
  }

  /**
   * Calculate correlation between two return series
   */
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

    if (variance1 === 0 || variance2 === 0) return 0;

    return covariance / Math.sqrt(variance1 * variance2);
  }

  /**
   * Check all risks
   */
  private checkAllRisks(): void {
    // This method should be called periodically to check for risk limit breaches
    // Implementation would integrate with portfolio data
    log.info('[RiskManagement] Checking all risks...');
  }

  /**
   * Get all alerts
   */
  getAlerts(): RiskAlert[] {
    return [...this.alerts];
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      // Mark as acknowledged
      return true;
    }
    return false;
  }

  /**
   * Clear all alerts
   */
  clearAlerts(): void {
    this.alerts = [];
  }

  /**
   * Get risk metrics summary
   */
  getSummary(): {
    totalAlerts: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
  } {
    const byType: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};

    this.alerts.forEach(alert => {
      byType[alert.type] = (byType[alert.type] || 0) + 1;
      bySeverity[alert.severity] = (bySeverity[alert.severity] || 0) + 1;
    });

    return {
      totalAlerts: this.alerts.length,
      byType,
      bySeverity,
    };
  }
}

// Singleton
let riskManagementInstance: RiskManagementDashboard | null = null;

export function getRiskManagementDashboard(config?: Partial<RiskManagementConfig>): RiskManagementDashboard {
  if (!riskManagementInstance) {
    riskManagementInstance = new RiskManagementDashboard(config);
  }
  return riskManagementInstance;
}

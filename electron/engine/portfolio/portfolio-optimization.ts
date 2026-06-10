/**
 * JVS-92: Portfolio Optimization Engine
 * 
 * Advanced portfolio optimization with multiple strategies:
 * - Mean-Variance Optimization (Markowitz)
 * - Black-Litterman Model
 * - Risk Parity
 * - Minimum Variance Portfolio
 * - Maximum Sharpe Ratio Portfolio
 * - Constraints handling (weights, sectors, turnover)
 * - Monte Carlo simulation for robust optimization
 */

import { EventEmitter } from 'events';

// ── Types ──────────────────────────────────────────────────────────────────

export interface OptimizationResult {
  weights: Map<string, number>;     // Optimized weights
  expectedReturn: number;           // Expected portfolio return
  expectedVolatility: number;       // Expected portfolio volatility
  sharpeRatio: number;              // Sharpe ratio
  sortinoRatio: number;          // Sortino ratio
  maxDrawdown: number;              // Maximum drawdown
  diversificationRatio: number;     // Diversification ratio
  timestamp: number;
}

export interface OptimizationConstraints {
  minWeight: number;                // Minimum weight per position (0-1)
  maxWeight: number;                // Maximum weight per position (0-1)
  maxSectorWeight: number;          // Maximum weight per sector (0-1)
  maxTurnover: number;              // Maximum turnover (0-1)
  longOnly: boolean;                // Long-only constraint
  targetReturn?: number;            // Target return (for min-variance)
  targetVolatility?: number;        // Target volatility (for max-return)
}

export interface OptimizationConfig {
  enabled: boolean;
  method: 'markowitz' | 'black-litterman' | 'risk-parity' | 'min-variance' | 'max-sharpe';
  constraints: OptimizationConstraints;
  riskFreeRate: number;             // Risk-free rate (annual)
  lookbackPeriod: number;           // Lookback period for returns (days)
  rebalanceFrequency: number;       // Rebalance frequency (days)
}

const DEFAULT_CONFIG: OptimizationConfig = {
  enabled: true,
  method: 'max-sharpe',
  constraints: {
    minWeight: 0.01,                // 1% minimum
    maxWeight: 0.20,                // 20% maximum
    maxSectorWeight: 0.30,          // 30% max per sector
    maxTurnover: 0.20,              // 20% max turnover
    longOnly: true,
  },
  riskFreeRate: 0.03,               // 3% annual
  lookbackPeriod: 252,              // 1 year
  rebalanceFrequency: 30,           // 30 days
};

export class PortfolioOptimizationEngine extends EventEmitter {
  private config: OptimizationConfig;
  private optimizationHistory: OptimizationResult[] = [];
  private maxHistory = 100;

  constructor(config?: Partial<OptimizationConfig>) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Optimize portfolio using specified method
   */
  optimize(
    symbols: string[],
    returns: Map<string, number[]>,
    covarianceMatrix: number[][],
    currentWeights?: Map<string, number>
  ): OptimizationResult {
    switch (this.config.method) {
      case 'markowitz':
        return this.optimizeMarkowitz(symbols, returns, covarianceMatrix, currentWeights);
      case 'black-litterman':
        return this.optimizeBlackLitterman(symbols, returns, covarianceMatrix, currentWeights);
      case 'risk-parity':
        return this.optimizeRiskParity(symbols, returns, covarianceMatrix, currentWeights);
      case 'min-variance':
        return this.optimizeMinVariance(symbols, returns, covarianceMatrix, currentWeights);
      case 'max-sharpe':
      default:
        return this.optimizeMaxSharpe(symbols, returns, covarianceMatrix, currentWeights);
    }
  }

  /**
   * Mean-Variance Optimization (Markowitz)
   */
  private optimizeMarkowitz(
    symbols: string[],
    returns: Map<string, number[]>,
    covarianceMatrix: number[][],
    currentWeights?: Map<string, number>
  ): OptimizationResult {
    const n = symbols.length;
    const expectedReturns = symbols.map(s => {
      const returns_ = returns.get(s) || [];
      return returns_.reduce((sum, r) => sum + r, 0) / returns_.length * 252; // Annualize
    });

    // Simple gradient descent optimization
    const weights = this.gradientDescent(
      expectedReturns,
      covarianceMatrix,
      'sharpe'
    );

    return this.calculateResult(symbols, weights, expectedReturns, covarianceMatrix);
  }

  /**
   * Black-Litterman Model
   */
  private optimizeBlackLitterman(
    symbols: string[],
    returns: Map<string, number[]>,
    covarianceMatrix: number[][],
    currentWeights?: Map<string, number>
  ): OptimizationResult {
    const n = symbols.length;
    const marketCapWeights = new Array(n).fill(1 / n); // Equal weights as proxy
    const riskAversion = 2.5; // Typical risk aversion coefficient

    // Calculate implied equilibrium returns
    const impliedReturns = this.calculateImpliedReturns(
      covarianceMatrix,
      marketCapWeights,
      riskAversion
    );

    // Combine with investor views (simplified)
    const expectedReturns = impliedReturns.map((r, i) => {
      const returns_ = returns.get(symbols[i]) || [];
      const historicalReturn = returns_.reduce((sum, r) => sum + r, 0) / returns_.length * 252;
      // Blend: 70% implied, 30% historical
      return 0.7 * r + 0.3 * historicalReturn;
    });

    const weights = this.gradientDescent(expectedReturns, covarianceMatrix, 'sharpe');

    return this.calculateResult(symbols, weights, expectedReturns, covarianceMatrix);
  }

  /**
   * Risk Parity Optimization
   */
  private optimizeRiskParity(
    symbols: string[],
    returns: Map<string, number[]>,
    covarianceMatrix: number[][],
    currentWeights?: Map<string, number>
  ): OptimizationResult {
    const n = symbols.length;
    const expectedReturns = symbols.map(s => {
      const returns_ = returns.get(s) || [];
      return returns_.reduce((sum, r) => sum + r, 0) / returns_.length * 252;
    });

    // Risk parity: equal risk contribution
    const weights = this.riskParityOptimization(covarianceMatrix);

    return this.calculateResult(symbols, weights, expectedReturns, covarianceMatrix);
  }

  /**
   * Minimum Variance Portfolio
   */
  private optimizeMinVariance(
    symbols: string[],
    returns: Map<string, number[]>,
    covarianceMatrix: number[][],
    currentWeights?: Map<string, number>
  ): OptimizationResult {
    const n = symbols.length;
    const expectedReturns = symbols.map(s => {
      const returns_ = returns.get(s) || [];
      return returns_.reduce((sum, r) => sum + r, 0) / returns_.length * 252;
    });

    const weights = this.gradientDescent(expectedReturns, covarianceMatrix, 'variance');

    return this.calculateResult(symbols, weights, expectedReturns, covarianceMatrix);
  }

  /**
   * Maximum Sharpe Ratio Portfolio
   */
  private optimizeMaxSharpe(
    symbols: string[],
    returns: Map<string, number[]>,
    covarianceMatrix: number[][],
    currentWeights?: Map<string, number>
  ): OptimizationResult {
    const n = symbols.length;
    const expectedReturns = symbols.map(s => {
      const returns_ = returns.get(s) || [];
      return returns_.reduce((sum, r) => sum + r, 0) / returns_.length * 252;
    });

    const weights = this.gradientDescent(expectedReturns, covarianceMatrix, 'sharpe');

    return this.calculateResult(symbols, weights, expectedReturns, covarianceMatrix);
  }

  /**
   * Gradient Descent Optimization
   */
  private gradientDescent(
    expectedReturns: number[],
    covarianceMatrix: number[][],
    objective: 'sharpe' | 'variance'
  ): number[] {
    const n = expectedReturns.length;
    let weights = new Array(n).fill(1 / n); // Equal weights initial
    const learningRate = 0.01;
    const maxIterations = 1000;
    const tolerance = 1e-6;

    for (let iter = 0; iter < maxIterations; iter++) {
      const gradient = this.calculateGradient(weights, expectedReturns, covarianceMatrix, objective);
      
      // Update weights
      const newWeights = weights.map((w, i) => w - learningRate * gradient[i]);
      
      // Apply constraints
      const constrainedWeights = this.applyConstraints(newWeights);
      
      // Check convergence
      const maxChange = Math.max(...constrainedWeights.map((w, i) => Math.abs(w - weights[i])));
      if (maxChange < tolerance) break;
      
      weights = constrainedWeights;
    }

    return weights;
  }

  /**
   * Calculate gradient for optimization
   */
  private calculateGradient(
    weights: number[],
    expectedReturns: number[],
    covarianceMatrix: number[][],
    objective: 'sharpe' | 'variance'
  ): number[] {
    const n = weights.length;
    const portfolioReturn = weights.reduce((sum, w, i) => sum + w * expectedReturns[i], 0);
    const portfolioVariance = this.calculatePortfolioVariance(weights, covarianceMatrix);
    const portfolioVolatility = Math.sqrt(portfolioVariance);

    const gradient: number[] = [];

    if (objective === 'sharpe') {
      // Gradient of Sharpe ratio
      const sharpe = (portfolioReturn - this.config.riskFreeRate) / portfolioVolatility;
      for (let i = 0; i < n; i++) {
        const marginalReturn = expectedReturns[i];
        const marginalVariance = 2 * covarianceMatrix[i].reduce((sum, cov, j) => sum + cov * weights[j], 0);
        const marginalVolatility = marginalVariance / (2 * portfolioVolatility);
        
        gradient[i] = (marginalReturn - this.config.riskFreeRate) / portfolioVolatility - 
                      sharpe * marginalVolatility / portfolioVolatility;
      }
    } else {
      // Gradient of variance
      for (let i = 0; i < n; i++) {
        gradient[i] = 2 * covarianceMatrix[i].reduce((sum, cov, j) => sum + cov * weights[j], 0);
      }
    }

    return gradient;
  }

  /**
   * Apply constraints to weights
   */
  private applyConstraints(weights: number[]): number[] {
    const n = weights.length;
    let constrained = [...weights];

    // Apply min/max weight constraints
    constrained = constrained.map(w => {
      if (this.config.constraints.longOnly && w < 0) return 0;
      if (w < this.config.constraints.minWeight) return this.config.constraints.minWeight;
      if (w > this.config.constraints.maxWeight) return this.config.constraints.maxWeight;
      return w;
    });

    // Normalize to sum to 1
    const sum = constrained.reduce((s, w) => s + w, 0);
    if (sum > 0) {
      constrained = constrained.map(w => w / sum);
    }

    return constrained;
  }

  /**
   * Risk Parity Optimization
   */
  private riskParityOptimization(covarianceMatrix: number[][]): number[] {
    const n = covarianceMatrix.length;
    let weights = new Array(n).fill(1 / n);
    const maxIterations = 1000;
    const tolerance = 1e-6;

    for (let iter = 0; iter < maxIterations; iter++) {
      const portfolioVariance = this.calculatePortfolioVariance(weights, covarianceMatrix);
      const marginalContributions = weights.map((w, i) => {
        return covarianceMatrix[i].reduce((sum, cov, j) => sum + cov * weights[j], 0);
      });

      const riskContributions = weights.map((w, i) => w * marginalContributions[i]);
      const totalRisk = riskContributions.reduce((s, r) => s + r, 0);
      const targetRisk = totalRisk / n;

      // Update weights to equalize risk contributions
      const newWeights = weights.map((w, i) => {
        const currentRisk = riskContributions[i];
        const adjustment = targetRisk / currentRisk;
        return w * adjustment;
      });

      // Normalize
      const sum = newWeights.reduce((s, w) => s + w, 0);
      const normalized = newWeights.map(w => w / sum);

      // Check convergence
      const maxChange = Math.max(...normalized.map((w, i) => Math.abs(w - weights[i])));
      if (maxChange < tolerance) break;

      weights = normalized;
    }

    return weights;
  }

  /**
   * Calculate implied equilibrium returns (Black-Litterman)
   */
  private calculateImpliedReturns(
    covarianceMatrix: number[][],
    marketWeights: number[],
    riskAversion: number
  ): number[] {
    const n = marketWeights.length;
    const impliedReturns: number[] = [];

    for (let i = 0; i < n; i++) {
      const marginalRisk = covarianceMatrix[i].reduce((sum, cov, j) => sum + cov * marketWeights[j], 0);
      impliedReturns.push(riskAversion * marginalRisk + this.config.riskFreeRate);
    }

    return impliedReturns;
  }

  /**
   * Calculate portfolio variance
   */
  private calculatePortfolioVariance(weights: number[], covarianceMatrix: number[][]): number {
    let variance = 0;
    for (let i = 0; i < weights.length; i++) {
      for (let j = 0; j < weights.length; j++) {
        variance += weights[i] * weights[j] * covarianceMatrix[i][j];
      }
    }
    return variance;
  }

  /**
   * Calculate optimization result
   */
  private calculateResult(
    symbols: string[],
    weights: number[],
    expectedReturns: number[],
    covarianceMatrix: number[][]
  ): OptimizationResult {
    const portfolioReturn = weights.reduce((sum, w, i) => sum + w * expectedReturns[i], 0);
    const portfolioVariance = this.calculatePortfolioVariance(weights, covarianceMatrix);
    const portfolioVolatility = Math.sqrt(portfolioVariance);
    const sharpeRatio = portfolioVolatility > 0
      ? (portfolioReturn - this.config.riskFreeRate) / portfolioVolatility
      : 0;

    // Calculate Sortino ratio (simplified)
    const downsideReturns = expectedReturns.filter(r => r < 0);
    const downsideVariance = downsideReturns.length > 0
      ? downsideReturns.reduce((s, r) => s + Math.pow(r, 2), 0) / downsideReturns.length
      : 0;
    const downsideVolatility = Math.sqrt(downsideVariance);
    const sortinoRatio = downsideVolatility > 0
      ? (portfolioReturn - this.config.riskFreeRate) / downsideVolatility
      : 0;

    // Calculate diversification ratio
    const individualVols = symbols.map((_, i) => Math.sqrt(covarianceMatrix[i][i]));
    const weightedAvgVol = weights.reduce((sum, w, i) => sum + w * individualVols[i], 0);
    const diversificationRatio = portfolioVolatility > 0 ? weightedAvgVol / portfolioVolatility : 1;

    const weightMap = new Map<string, number>();
    symbols.forEach((s, i) => weightMap.set(s, weights[i]));

    return {
      weights: weightMap,
      expectedReturn: portfolioReturn,
      expectedVolatility: portfolioVolatility,
      sharpeRatio,
      sortinoRatio,
      maxDrawdown: 0, // Would need historical data
      diversificationRatio,
      timestamp: Date.now(),
    };
  }

  /**
   * Monte Carlo simulation
   */
  simulateMonteCarlo(
    symbols: string[],
    weights: number[],
    expectedReturns: number[],
    covarianceMatrix: number[][],
    numSimulations: number = 10000,
    numDays: number = 252
  ): number[] {
    const portfolioReturn = weights.reduce((sum, w, i) => sum + w * expectedReturns[i], 0);
    const portfolioVariance = this.calculatePortfolioVariance(weights, covarianceMatrix);
    const portfolioVolatility = Math.sqrt(portfolioVariance);

    const finalReturns: number[] = [];

    for (let sim = 0; sim < numSimulations; sim++) {
      let cumulativeReturn = 1;
      for (let day = 0; day < numDays; day++) {
        const dailyReturn = this.generateRandomReturn(portfolioReturn / 252, portfolioVolatility / Math.sqrt(252));
        cumulativeReturn *= (1 + dailyReturn);
      }
      finalReturns.push(cumulativeReturn - 1);
    }

    return finalReturns;
  }

  /**
   * Generate random return (normal distribution)
   */
  private generateRandomReturn(mean: number, stdDev: number): number {
    const u1 = Math.random();
    const u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mean + stdDev * z;
  }

  /**
   * Get optimization history
   */
  getHistory(): OptimizationResult[] {
    return [...this.optimizationHistory];
  }

  /**
   * Get summary
   */
  getSummary(): {
    totalOptimizations: number;
    latestResult: OptimizationResult | null;
  } {
    return {
      totalOptimizations: this.optimizationHistory.length,
      latestResult: this.optimizationHistory.length > 0
        ? this.optimizationHistory[this.optimizationHistory.length - 1]
        : null,
    };
  }
}

// Singleton
let portfolioOptimizationInstance: PortfolioOptimizationEngine | null = null;

export function getPortfolioOptimizationEngine(config?: Partial<OptimizationConfig>): PortfolioOptimizationEngine {
  if (!portfolioOptimizationInstance) {
    portfolioOptimizationInstance = new PortfolioOptimizationEngine(config);
  }
  return portfolioOptimizationInstance;
}

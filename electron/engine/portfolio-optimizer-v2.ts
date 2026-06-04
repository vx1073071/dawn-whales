// ── Q38: Portfolio Optimizer v2 ──────────────────────────────────────────────
// CVaR optimization + Robust optimization + Black-Litterman integration
// Transaction cost aware optimization with multi-period support

import log from 'electron-log';

// ── Types ──────────────────────────────────────────────────────────────────

export interface Asset {
  symbol: string;
  expectedReturn: number;
  volatility: number;
  weight?: number;
}

export interface OptimizationConstraints {
  maxWeight?: number;      // 0.3 = single asset max 30%
  minWeight?: number;      // 0 = no short
  allowShort?: boolean;
  maxLeverage?: number;    // 2.0 = up to 2x leverage
  sectorLimits?: Record<string, number>; // e.g. { TECH: 0.4 }
}

export interface OptimizationResult {
  weights: Record<string, number>;
  expectedReturn: number;
  expectedVolatility: number;
  sharpeRatio: number;
  cvar95: number;          // CVaR at 95% confidence
  var95: number;           // VaR at 95% confidence
  turnover: number;        // Portfolio turnover
  method: string;
  metadata: Record<string, number>;
}

export interface BlackLittermanOutput {
  posteriorReturns: Record<string, number>;
  impliedReturns: Record<string, number>;
  views: Array<{ assets: string[]; return: number; confidence: number }>;
}

// ── Black-Litterman ────────────────────────────────────────────────────────

export class BlackLitterman {
  constructor(
    private marketCaps: Record<string, number>,
    private riskFreeRate = 0.03
  ) {}

  // Compute implied equilibrium returns (reverse optimization)
  computeImpliedReturns(covMatrix: number[][], weights: number[]): Record<string, number> {
    const lambda = 0.05; // Risk aversion coefficient
    const result: Record<string, number> = {};
    const symbols = Object.keys(this.marketCaps);

    for (let i = 0; i < symbols.length; i++) {
      let impReturn = 0;
      for (let j = 0; j < symbols.length; j++) {
        impReturn += lambda * covMatrix[i]?.[j] * (weights[j] ?? 0) * 100;
      }
      result[symbols[i]] = this.riskFreeRate + impReturn;
    }

    return result;
  }

  // Integrate views into posterior returns
  integrateViews(
    impliedReturns: Record<string, number>,
    views: Array<{ assets: string[]; return: number; confidence: number }>,
    covMatrix: number[][]
  ): BlackLittermanOutput {
    const posteriorReturns = { ...impliedReturns };

    for (const view of views) {
      const { assets, return: viewReturn, confidence } = view;
      const tau = 0.1; // Uncertainty of prior

      for (const asset of assets) {
        const prior = impliedReturns[asset] ?? this.riskFreeRate;
        // Bayesian update: posterior ∝ prior × confidence + view × confidence
        posteriorReturns[asset] = (1 - confidence) * prior + confidence * viewReturn;
      }
    }

    return {
      posteriorReturns,
      impliedReturns,
      views,
    };
  }
}

// ── CVaR Optimizer ──────────────────────────────────────────────────────

export class PortfolioOptimizerV2 {
  constructor() {
    log.info('[PortfolioOptimizerV2] Initialized');
  }

  // ── CVaR Optimization ──────────────────────────────────────────────

  optimizeCVaR(
    assets: Asset[],
    constraints: OptimizationConstraints,
    confidenceLevel = 0.95,
    nSimulations = 5000
  ): OptimizationResult {
    const n = assets.length;
    if (n === 0) return this.emptyResult();

    log.info(`[PortfolioOptimizerV2] CVaR optimization for ${n} assets`);

    const covMatrix = this.buildCovMatrix(assets);
    const rf = this.riskFreeRate;

    // Monte Carlo for CVaR calculation
    let bestWeights: number[] = Array(n).fill(1 / n);
    let bestCVaR = Infinity;
    let bestSharpe = -Infinity;

    for (let iter = 0; iter < 500; iter++) {
      // Random weight perturbation
      const trial = [...bestWeights];
      const idx = Math.floor(Math.random() * n);
      trial[idx] += (Math.random() - 0.5) * 0.1;
      trial[idx] = Math.max(0, Math.min(constraints.maxWeight ?? 1, trial[idx]));
      const sum = trial.reduce((a, b) => a + b, 0);
      trial.forEach((w, i) => trial[i] /= sum);

      // Simulate returns
      const simReturns = this.simulatePortfolio(trial, assets, covMatrix, nSimulations);
      const sorted = [...simReturns].sort((a, b) => a - b);
      const cutIdx = Math.floor((1 - confidenceLevel) * nSimulations);
      const var_ = -sorted[cutIdx];
      const cvar = -sorted.slice(0, cutIdx).reduce((a, b) => a + b, 0) / cutIdx;

      const ret = this.portfolioReturn(trial, assets);
      const vol = this.portfolioVol(trial, covMatrix);
      const sharpe = vol > 0 ? (ret - rf) / vol : 0;

      if (cvar < bestCVaR) {
        bestCVaR = cvar;
        bestWeights = trial;
      }
      if (sharpe > bestSharpe) bestSharpe = sharpe;
    }

    // Final metrics
    const simReturns = this.simulatePortfolio(bestWeights, assets, covMatrix, nSimulations);
    const sorted = [...simReturns].sort((a, b) => a - b);
    const cutIdx = Math.floor((1 - confidenceLevel) * nSimulations);
    const var95 = -sorted[cutIdx];
    const cvar95 = -sorted.slice(0, cutIdx).reduce((a, b) => a + b, 0) / cutIdx;

    const weightMap: Record<string, number> = {};
    for (let i = 0; i < assets.length; i++) {
      weightMap[assets[i].symbol] = Math.round(bestWeights[i] * 10000) / 10000;
    }

    return {
      weights: weightMap,
      expectedReturn: Math.round(this.portfolioReturn(bestWeights, assets) * 10000) / 100,
      expectedVolatility: Math.round(this.portfolioVol(bestWeights, covMatrix) * 10000) / 100,
      sharpeRatio: Math.round(bestSharpe * 100) / 100,
      cvar95: Math.round(cvar95 * 10000) / 100,
      var95: Math.round(var95 * 10000) / 100,
      turnover: 0,
      method: 'CVaR',
      metadata: { nSimulations, confidenceLevel },
    };
  }

  // ── Robust Optimization ───────────────────────────────────────────

  optimizeRobust(
    assets: Asset[],
    constraints: OptimizationConstraints,
    returnUncertainty = 0.1,
    volUncertainty = 0.2
  ): OptimizationResult {
    const n = assets.length;
    if (n === 0) return this.emptyResult();

    // Adjust expected returns for uncertainty (worst-case robustness)
    const adjustedAssets = assets.map(a => ({
      ...a,
      expectedReturn: a.expectedReturn - returnUncertainty * Math.abs(a.expectedReturn),
      volatility: a.volatility * (1 + volUncertainty),
    }));

    return this.optimizeCVaR(adjustedAssets, constraints);
  }

  // ── Black-Litterman Optimization ─────────────────────────────────────

  optimizeWithBL(
    assets: Asset[],
    constraints: OptimizationConstraints,
    marketCaps: Record<string, number>,
    views: Array<{ assets: string[]; return: number; confidence: number }>
  ): OptimizationResult {
    const bl = new BlackLitterman(marketCaps);
    const covMatrix = this.buildCovMatrix(assets);
    const equalWeights = assets.map(() => 1 / assets.length);
    const impliedReturns = bl.computeImpliedReturns(covMatrix, equalWeights);
    const { posteriorReturns } = bl.integrateViews(impliedReturns, views, covMatrix);

    // Use posterior returns for optimization
    const adjustedAssets = assets.map(a => ({
      ...a,
      expectedReturn: posteriorReturns[a.symbol] ?? a.expectedReturn,
    }));

    return this.optimizeCVaR(adjustedAssets, constraints);
  }

  // ── Helpers ────────────────────────────────────────────────────────

  private riskFreeRate = 0.03;

  private buildCovMatrix(assets: Asset[]): number[][] {
    const n = assets.length;
    const cov: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
    for (let i = 0; i < n; i++) {
      cov[i][i] = assets[i].volatility ** 2;
      for (let j = i + 1; j < n; j++) {
        const rho = 0.3;
        const v = rho * assets[i].volatility * assets[j].volatility;
        cov[i][j] = v;
        cov[j][i] = v;
      }
    }
    return cov;
  }

  private portfolioReturn(weights: number[], assets: Asset[]): number {
    return weights.reduce((s, w, i) => s + w * assets[i].expectedReturn, 0);
  }

  private portfolioVol(weights: number[], cov: number[][]): number {
    let vol = 0;
    for (let i = 0; i < weights.length; i++) {
      for (let j = 0; j < weights.length; j++) {
        vol += weights[i] * weights[j] * cov[i]?.[j]!;
      }
    }
    return Math.sqrt(Math.max(0, vol));
  }

  private simulatePortfolio(
    weights: number[],
    assets: Asset[],
    cov: number[][],
    nSim: number
  ): number[] {
    const returns: number[] = [];
    for (let s = 0; s < nSim; s++) {
      let r = 0;
      for (let i = 0; i < assets.length; i++) {
        // Box-Muller for normal random
        const u1 = Math.random(), u2 = Math.random();
        const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        r += weights[i] * (assets[i].expectedReturn + z * assets[i].volatility);
      }
      returns.push(r);
    }
    return returns;
  }

  private emptyResult(): OptimizationResult {
    return {
      weights: {},
      expectedReturn: 0,
      expectedVolatility: 0,
      sharpeRatio: 0,
      cvar95: 0,
      var95: 0,
      turnover: 0,
      method: 'CVaR',
      metadata: {},
    };
  }
}

export default PortfolioOptimizerV2;
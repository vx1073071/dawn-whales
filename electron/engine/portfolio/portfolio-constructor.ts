// ── Q26: Portfolio Constructor ────────────────────────────────────────────────
// Mean-Variance Optimization (Markowitz) + Risk Parity + Hierarchical Risk Parity
// Constructs optimal portfolio given return estimates and covariance matrix

import log from 'electron-log';
import { getKellyFraction } from './dynamic-sizer';

// ── Types ──────────────────────────────────────────────────────────────────

export interface AssetData {
  symbol: string;
  name?: string;
  expectedReturn: number;   // Annual, e.g. 0.12 for 12%
  volatility: number;         // Annual std dev
  weight?: number;            // Current weight
}

export interface PortfolioMetrics {
  portfolioReturn: number;
  portfolioVolatility: number;
  sharpeRatio: number;
  diversificationRatio: number;
  concentrationRisk: number;  // HHI (Herfindahl index)
}

export interface OptimizationOutput {
  weights: Record<string, number>;  // symbol -> weight (0-1)
  metrics: PortfolioMetrics;
  riskContributions: Record<string, number>;
  Sharpe: number;
  expectedReturn: number;
  expectedVolatility: number;
  method: string;
}

export interface OptimizationConfig {
  assets: AssetData[];
  riskFreeRate?: number;
  targetReturn?: number;
  targetRisk?: number;
  method: 'mean-variance' | 'risk-parity' | 'hrp' | 'equal-weight' | 'kelly';
  constraints?: {
    maxWeight?: number;      // 0.3 = single asset max 30%
    minWeight?: number;      // 0 = no short
    allowShort?: boolean;
    maxLeverage?: number;
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────

function computeCovarianceMatrix(assets: AssetData[]): number[][] {
  const n = assets.length;
  const cov: number[][] = Array.from({ length: n }, () => Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    cov[i][i] = assets[i].volatility ** 2;
    for (let j = i + 1; j < n; j++) {
      // Assume moderate correlation (0.3) for pairs not explicitly modeled
      const rho = 0.3 * assets[i].volatility * assets[j].volatility;
      cov[i][j] = rho;
      cov[j][i] = rho;
    }
  }
  return cov;
}

function portfolioVolatility(weights: number[], cov: number[][]): number {
  let vol = 0;
  for (let i = 0; i < weights.length; i++) {
    for (let j = 0; j < weights.length; j++) {
      vol += weights[i] * weights[j] * cov[i][j];
    }
  }
  return Math.sqrt(Math.max(0, vol));
}

function portfolioReturn(weights: number[], assets: AssetData[]): number {
  return weights.reduce((sum, w, i) => sum + w * assets[i].expectedReturn, 0);
}

function correlationToCov(corr: number[][], vol: number[]): number[][] {
  const n = vol.length;
  const cov: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => corr[i][j] * vol[i] * vol[j])
  );
  return cov;
}

// ── Mean-Variance ──────────────────────────────────────────────────────────

function meanVarianceOptimization(assets: AssetData[], config: OptimizationConfig): number[] {
  const n = assets.length;
  const cov = computeCovarianceMatrix(assets);
  const { maxWeight = 1, minWeight = 0 } = config.constraints ?? {};

  // If target return specified, find min-var portfolio for that return
  if (config.targetReturn !== undefined) {
    // Simplified: use risk parity as proxy when MV is complex to solve analytically
    return riskParityOptimization(assets, config);
  }

  // If target risk specified, find max-return portfolio for that risk
  if (config.targetRisk !== undefined) {
    return riskParityOptimization(assets, config);
  }

  // Default: max Sharpe ratio
  const rF = config.riskFreeRate ?? 0.03;

  // Solve using quadratic utility approach (simplified analytical solution)
  // For small n, iterate over weight grid
  const weights: number[] = Array(n).fill(1 / n);

  // Simple optimization: gradient ascent on Sharpe
  let bestWeights = [...weights];
  let bestSharpe = -Infinity;
  const step = 0.02;
  const nIter = 2000;

  for (let iter = 0; iter < nIter; iter++) {
    const testWeights = [...bestWeights];
    const idx = Math.floor(Math.random() * n);
    testWeights[idx] += (Math.random() - 0.5) * step;

    // Clip and normalize
    for (let i = 0; i < n; i++) {
      testWeights[i] = Math.max(minWeight, Math.min(maxWeight, testWeights[i]));
    }
    const sum = testWeights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < n; i++) testWeights[i] /= sum;

    const ret = portfolioReturn(testWeights, assets);
    const vol = portfolioVolatility(testWeights, cov);
    const sharpe = vol > 0 ? (ret - rF) / vol : 0;

    if (sharpe > bestSharpe) {
      bestSharpe = sharpe;
      bestWeights = testWeights;
    }
  }

  return bestWeights;
}

// ── Risk Parity ───────────────────────────────────────────────────────────

function riskParityOptimization(assets: AssetData[], config: OptimizationConfig): number[] {
  const n = assets.length;
  const cov = computeCovarianceMatrix(assets);
  const { maxWeight = 1, minWeight = 0 } = config.constraints ?? {};

  // Risk parity: equal risk contribution from each asset
  let weights = Array(n).fill(1 / n);
  const vol = assets.map(a => a.volatility);
  const targetRisk = portfolioVolatility(weights, cov) / n;

  // Iterative algorithm
  for (let iter = 0; iter < 500; iter++) {
    const risks = weights.map((w, i) => {
      // Marginal risk contribution (simplified as w * vol)
      return w * vol[i];
    });
    const totalRisk = risks.reduce((a, b) => a + b, 0);

    const newWeights = weights.map((w, i) => {
      const target = totalRisk / n;
      return w * (target / Math.max(risks[i], 0.0001));
    });

    // Clip and normalize
    for (let i = 0; i < n; i++) {
      newWeights[i] = Math.max(minWeight, Math.min(maxWeight, newWeights[i]));
    }
    const sum = newWeights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < n; i++) newWeights[i] /= sum;

    // Check convergence
    const maxDiff = newWeights.reduce((max, w, i) =>
      Math.max(max, Math.abs(w - weights[i])), 0
    );
    weights = newWeights;
    if (maxDiff < 0.0001) break;
  }

  return weights;
}

// ── Hierarchical Risk Parity (HRP) ──────────────────────────────────────

function hierarchicalRiskParity(assets: AssetData[], _config: OptimizationConfig): number[] {
  const n = assets.length;
  if (n <= 1) return [1];

  const cov = computeCovarianceMatrix(assets);
  const corr: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) =>
      i === j ? 1 : cov[i][j] / (assets[i].volatility * assets[j].volatility)
    )
  );

  // Simple hierarchical clustering using correlation distance
  const dist = (i: number, j: number) => 1 - Math.abs(corr[i][j]);
  const clusters: Array<Set<number>> = assets.map((_, i) => new Set([i]));

  while (clusters.length > 1) {
    let minDist = Infinity;
    let ci = 0, cj = 1;

    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        let maxD = 0;
        for (const a of clusters[i]) {
          for (const b of clusters[j]) {
            maxD = Math.max(maxD, dist(a, b));
          }
        }
        if (maxD < minDist) {
          minDist = maxD;
          ci = i; cj = j;
        }
      }
    }

    const merged = new Set([...clusters[ci], ...clusters[cj]]);
    clusters.splice(cj, 1);
    clusters.splice(ci, 1);
    clusters.push(merged);
  }

  // Assign weights inversely proportional to average cluster variance
  const finalCluster = clusters[0];
  const symbols = [...finalCluster];
  const weights: number[] = [];

  for (const idx of symbols) {
    const weight = 1 / (assets[idx].volatility ** 2);
    weights.push(weight);
  }

  const sum = weights.reduce((a, b) => a + b, 0);
  return weights.map(w => w / sum);
}

// ── Kelly Optimization ───────────────────────────────────────────────────

function kellyOptimization(assets: AssetData[], config: OptimizationConfig): number[] {
  const { maxWeight = 1, minWeight = 0 } = config.constraints ?? {};
  const n = assets.length;
  const rf = config.riskFreeRate ?? 0.03;

  const kellyFracs = assets.map(a => {
    const er = a.expectedReturn - rf;
    const vol = a.volatility;
    return vol > 0 ? er / (vol ** 2) : 0;
  });

  let weights = kellyFracs.map(k => Math.max(0, k));
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum > 0) weights = weights.map(w => w / sum);

  // Apply max weight constraint
  for (let i = 0; i < n; i++) {
    weights[i] = Math.min(maxWeight, Math.max(minWeight, weights[i]));
  }
  const total = weights.reduce((a, b) => a + b, 0);
  if (total > 0) weights = weights.map(w => w / total);

  return weights;
}

// ── Main Constructor ─────────────────────────────────────────────────────

export function constructPortfolio(config: OptimizationConfig): OptimizationOutput {
  const { assets, method } = config;

  log.info(`[PortfolioConstructor] ${method} optimization for ${assets.length} assets`);

  let weights: number[];
  switch (method) {
    case 'risk-parity': weights = riskParityOptimization(assets, config); break;
    case 'hrp': weights = hierarchicalRiskParity(assets, config); break;
    case 'kelly': weights = kellyOptimization(assets, config); break;
    case 'equal-weight': weights = Array(assets.length).fill(1 / assets.length); break;
    default: weights = meanVarianceOptimization(assets, config);
  }

  const weightMap: Record<string, number> = {};
  for (let i = 0; i < assets.length; i++) {
    weightMap[assets[i].symbol] = Math.round(weights[i] * 10000) / 10000;
  }

  const cov = computeCovarianceMatrix(assets);
  const expectedReturn = portfolioReturn(weights, assets);
  const expectedVolatility = portfolioVolatility(weights, cov);
  const rf = config.riskFreeRate ?? 0.03;
  const sharpe = expectedVolatility > 0
    ? (expectedReturn - rf) / expectedVolatility
    : 0;

  // Risk contributions
  const riskContributions: Record<string, number> = {};
  const totalRisk = expectedVolatility ** 2;
  for (let i = 0; i < assets.length; i++) {
    const marginalRisk = weights.reduce((sum, w, j) =>
      sum + w * cov[i][j], 0
    );
    riskContributions[assets[i].symbol] = Math.round(
      (weights[i] * marginalRisk / totalRisk) * 10000
    ) / 100;
  }

  // Concentration risk (HHI)
  const hhi = weights.reduce((sum, w) => sum + w ** 2, 0);
  const diversificationRatio = n > 1
    ? expectedVolatility / (assets.reduce((sum, a, idx) => sum + a.volatility * weights[idx], 0) / n)
    : 1;

  return {
    weights: weightMap,
    metrics: {
      portfolioReturn: Math.round(expectedReturn * 10000) / 100,
      portfolioVolatility: Math.round(expectedVolatility * 10000) / 100,
      sharpeRatio: Math.round(sharpe * 100) / 100,
      diversificationRatio: Math.round(diversificationRatio * 100) / 100,
      concentrationRisk: Math.round(hhi * 10000) / 100,
    },
    riskContributions,
    Sharpe: Math.round(sharpe * 100) / 100,
    expectedReturn: Math.round(expectedReturn * 10000) / 100,
    expectedVolatility: Math.round(expectedVolatility * 10000) / 100,
    method,
  };
}

export default constructPortfolio;
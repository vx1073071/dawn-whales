/**
 * Portfolio Optimizer - Mean-variance optimization and risk parity engine.
 * JVS-97
 *
 * All matrix operations are implemented manually (no external linear-algebra libs).
 * Optimization uses projected gradient descent with constraint handling.
 * Efficient frontier approximation uses Monte Carlo sampling.
 */

import log from 'electron-log';
import { EngineError, ErrorCode } from '../errors';


// ─── Interfaces ────────────────────────────────────────────────────────────────

export interface Asset {
  id: string;
  name: string;
  expectedReturn: number;
  volatility: number;
}

export interface PortfolioAllocation {
  assetId: string;
  weight: number;
  expectedContribution: number;
  riskContribution: number;
}

export interface OptimizationResult {
  allocations: PortfolioAllocation[];
  expectedReturn: number;
  expectedVolatility: number;
  sharpeRatio: number;
  diversificationRatio: number;
  method: string;
  durationMs: number;
}

export interface OptimizationConfig {
  method: 'mean_variance' | 'risk_parity' | 'min_variance' | 'max_sharpe' | 'equal_weight';
  riskFreeRate: number;
  constraints?: {
    maxWeight?: number;
    minWeight?: number;
    maxAssets?: number;
  };
}

export interface PortfolioAnalysis {
  diversification: number;
  concentration: number;
  herfindahlIndex: number;
}

// ─── Matrix Utilities ──────────────────────────────────────────────────────────

type Matrix = number[][];
type Vector = number[];

function zeros(n: number): Vector {
  return new Array(n).fill(0);
}

function zerosMatrix(rows: number, cols: number): Matrix {
  const m: Matrix = [];
  for (let i = 0; i < rows; i++) {
    m.push(new Array(cols).fill(0));
  }
  return m;
}

function cloneVector(v: Vector): Vector {
  return v.slice();
}

function dot(a: Vector, b: Vector): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    s += a[i] * b[i];
  }
  return s;
}

function vecAdd(a: Vector, b: Vector): Vector {
  return a.map((v, i) => v + b[i]);
}

function vecSub(a: Vector, b: Vector): Vector {
  return a.map((v, i) => v - b[i]);
}

function vecScale(v: Vector, s: number): Vector {
  return v.map((x) => x * s);
}

function vecNorm(v: Vector): number {
  return Math.sqrt(dot(v, v));
}

/** Matrix-vector multiply: M * v */
function matVec(M: Matrix, v: Vector): Vector {
  const n = M.length;
  const result: Vector = zeros(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let j = 0; j < n; j++) {
      s += M[i][j] * v[j];
    }
    result[i] = s;
  }
  return result;
}

/** Quadratic form: v^T * M * v */
function quadraticForm(v: Vector, M: Matrix): number {
  const Mv = matVec(M, v);
  return dot(v, Mv);
}

/** Build covariance matrix from correlation matrix + volatilities */
function buildCovarianceMatrix(corrMatrix: number[][], vols: number[]): Matrix {
  const n = vols.length;
  const cov = zerosMatrix(n, n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      cov[i][j] = corrMatrix[i][j] * vols[i] * vols[j];
    }
  }
  return cov;
}

/** Sum of a vector */
function vecSum(v: Vector): number {
  let s = 0;
  for (const x of v) s += x;
  return s;
}

/** Simple seeded pseudo-random (xorshift32) for reproducible Monte Carlo */
function xorshift32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s ^= s << 13;
    s ^= s >> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

/** Box-Muller transform for normal random variates */
function normalRandom(rng: () => number): number {
  let u1 = rng();
  let u2 = rng();
  if (u1 < 1e-15) u1 = 1e-15;
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

// ─── Projection onto simplex / constraints ─────────────────────────────────────

/**
 * Project weights onto the simplex: sum(w) = 1, w_i >= 0.
 * Uses the sorting-based algorithm.
 */
function projectSimplex(v: Vector): Vector {
  const n = v.length;
  const u = cloneVector(v).sort((a, b) => b - a);
  let cssv = 0;
  let rho = 0;
  for (let j = 0; j < n; j++) {
    cssv += u[j];
    if (u[j] - (cssv - 1) / (j + 1) > 0) {
      rho = j;
    }
  }
  let cumsum = 0;
  for (let j = 0; j <= rho; j++) cumsum += u[j];
  const theta = (cumsum - 1) / (rho + 1);
  return v.map((x) => Math.max(x - theta, 0));
}

/**
 * Project weights onto constrained simplex with min/max bounds.
 * Alternating projections approach.
 */
function projectConstrained(
  w: Vector,
  minWeight: number,
  maxWeight: number
): Vector {
  const n = w.length;
  let proj = cloneVector(w);

  for (let iter = 0; iter < 100; iter++) {
    // Clamp to bounds
    for (let i = 0; i < n; i++) {
      proj[i] = Math.max(minWeight, Math.min(maxWeight, proj[i]));
    }
    // Project onto simplex (sum = 1)
    // Adjust for minWeight floor
    const excess = vecSum(proj) - 1;
    if (Math.abs(excess) < 1e-12) break;

    // Distribute excess proportionally among non-clamped assets
    const freeIndices: number[] = [];
    for (let i = 0; i < n; i++) {
      if (proj[i] > minWeight + 1e-12 && proj[i] < maxWeight - 1e-12) {
        freeIndices.push(i);
      }
    }
    if (freeIndices.length === 0) {
      // All clamped, distribute evenly
      const adj = excess / n;
      for (let i = 0; i < n; i++) proj[i] -= adj;
    } else {
      const adj = excess / freeIndices.length;
      for (const i of freeIndices) proj[i] -= adj;
    }
  }

  // Final clamp
  for (let i = 0; i < n; i++) {
    proj[i] = Math.max(0, Math.min(1, proj[i]));
  }
  // Re-normalize
  const s = vecSum(proj);
  if (s > 1e-15) {
    for (let i = 0; i < n; i++) proj[i] /= s;
  }
  return proj;
}

// ─── Optimization Methods ──────────────────────────────────────────────────────

const GRADIENT_ITERATIONS = 2000;
const GRADIENT_LR = 0.01;
const MONTE_CARLO_SAMPLES = 10000;
const FRONTIER_DEFAULT_POINTS = 20;

/**
 * Minimum variance portfolio via gradient descent.
 * min w^T Σ w  s.t. sum(w)=1, w>=0
 */
function optimizeMinVariance(
  covMatrix: Matrix,
  n: number,
  constraints: OptimizationConfig['constraints']
): Vector {
  const minW = constraints?.minWeight ?? 0;
  const maxW = constraints?.maxWeight ?? 1;

  // Start from equal weight
  let w = new Array(n).fill(1 / n);
  const lr = GRADIENT_LR;

  for (let iter = 0; iter < GRADIENT_ITERATIONS; iter++) {
    // Gradient: 2 * Σ * w
    const grad = vecScale(matVec(covMatrix, w), 2);

    // Adaptive learning rate (decay)
    const stepLr = lr / (1 + iter * 0.001);

    // Gradient step
    w = vecSub(w, vecScale(grad, stepLr));

    // Project onto constraints
    w = projectConstrained(w, minW, maxW);
  }

  return w;
}

/**
 * Maximum Sharpe ratio portfolio via gradient descent.
 * max (w^T μ - rf) / sqrt(w^T Σ w)
 * Equivalent to minimizing negative Sharpe.
 */
function optimizeMaxSharpe(
  returns: Vector,
  covMatrix: Matrix,
  n: number,
  riskFreeRate: number,
  constraints: OptimizationConfig['constraints']
): Vector {
  const minW = constraints?.minWeight ?? 0;
  const maxW = constraints?.maxWeight ?? 1;

  let w = new Array(n).fill(1 / n);
  const lr = GRADIENT_LR;

  for (let iter = 0; iter < GRADIENT_ITERATIONS; iter++) {
    const portReturn = dot(w, returns);
    const portVar = quadraticForm(w, covMatrix);
    const portVol = Math.sqrt(Math.max(portVar, 1e-15));
    const excessReturn = portReturn - riskFreeRate;

    // Gradient of Sharpe = (μ * σ - (μ'w - rf) * Σw / σ) / σ^2
    const SigmaW = matVec(covMatrix, w);
    const grad: Vector = zeros(n);
    for (let i = 0; i < n; i++) {
      grad[i] =
        (returns[i] * portVol - excessReturn * SigmaW[i] / portVol) /
        (portVar + 1e-15);
    }

    const stepLr = lr / (1 + iter * 0.001);

    // Ascend (maximize Sharpe → add gradient)
    w = vecAdd(w, vecScale(grad, stepLr));
    w = projectConstrained(w, minW, maxW);
  }

  return w;
}

/**
 * Mean-variance optimization (Markowitz).
 * min w^T Σ w - λ * (w^T μ - rf)
 * where λ controls risk aversion. We use λ=1 as default.
 */
function optimizeMeanVariance(
  returns: Vector,
  covMatrix: Matrix,
  n: number,
  riskFreeRate: number,
  constraints: OptimizationConfig['constraints']
): Vector {
  const minW = constraints?.minWeight ?? 0;
  const maxW = constraints?.maxWeight ?? 1;
  const lambda = 1.0; // risk aversion parameter

  let w = new Array(n).fill(1 / n);
  const lr = GRADIENT_LR;

  for (let iter = 0; iter < GRADIENT_ITERATIONS; iter++) {
    // Objective: w^T Σ w - λ * (w^T μ)
    // Gradient: 2Σw - λμ
    const SigmaW = matVec(covMatrix, w);
    const grad: Vector = zeros(n);
    for (let i = 0; i < n; i++) {
      grad[i] = 2 * SigmaW[i] - lambda * returns[i];
    }

    const stepLr = lr / (1 + iter * 0.001);
    w = vecSub(w, vecScale(grad, stepLr));
    w = projectConstrained(w, minW, maxW);
  }

  return w;
}

/**
 * Risk parity portfolio.
 * Goal: each asset contributes equally to total portfolio risk.
 * RC_i = w_i * (Σw)_i / σ_p  should equal σ_p / n for all i.
 * Minimize: Σ (w_i*(Σw)_i - (w^T Σ w)/n)^2
 */
function optimizeRiskParity(
  covMatrix: Matrix,
  n: number,
  constraints: OptimizationConfig['constraints']
): Vector {
  const minW = constraints?.minWeight ?? 0;
  const maxW = constraints?.maxWeight ?? 1;

  // Start from inverse-volatility weighting
  const diagVar: Vector = [];
  for (let i = 0; i < n; i++) diagVar.push(Math.sqrt(covMatrix[i][i]));
  let invVolSum = 0;
  for (const v of diagVar) invVolSum += 1 / (v + 1e-15);
  let w: Vector = diagVar.map((v) => (1 / (v + 1e-15)) / invVolSum);

  const lr = 0.005;

  for (let iter = 0; iter < GRADIENT_ITERATIONS * 2; iter++) {
    const SigmaW = matVec(covMatrix, w);
    const portVar = dot(w, SigmaW);
    const targetRC = portVar / n;

    // Gradient of risk parity objective
    const grad: Vector = zeros(n);
    for (let i = 0; i < n; i++) {
      const rci = w[i] * SigmaW[i];
      const diff = rci - targetRC;
      // d/dw_i of (w_i*(Σw)_i - target)^2
      // = 2*(rci - target) * (Σw_i + w_i * Σ_ii ... approximation)
      grad[i] = 2 * diff * (SigmaW[i] + w[i] * covMatrix[i][i]);
    }

    const stepLr = lr / (1 + iter * 0.0005);
    w = vecSub(w, vecScale(grad, stepLr));
    w = projectConstrained(w, minW, maxW);
  }

  return w;
}

/**
 * Equal weight portfolio.
 */
function equalWeight(n: number): Vector {
  return new Array(n).fill(1 / n);
}

/**
 * Apply maxAssets constraint: keep top-N assets by weight, redistribute.
 */
function applyMaxAssets(
  w: Vector,
  maxAssets: number
): Vector {
  if (maxAssets >= w.length) return w;

  const indexed = w.map((weight, idx) => ({ weight, idx }));
  indexed.sort((a, b) => b.weight - a.weight);

  const result = zeros(w.length);
  let topSum = 0;
  for (let i = 0; i < maxAssets; i++) {
    result[indexed[i].idx] = indexed[i].weight;
    topSum += indexed[i].weight;
  }
  // Re-normalize
  if (topSum > 1e-15) {
    for (let i = 0; i < result.length; i++) {
      result[i] /= topSum;
    }
  }
  return result;
}

// ─── Portfolio Metrics ─────────────────────────────────────────────────────────

function computePortfolioReturn(w: Vector, returns: Vector): number {
  return dot(w, returns);
}

function computePortfolioVolatility(w: Vector, covMatrix: Matrix): number {
  return Math.sqrt(Math.max(quadraticForm(w, covMatrix), 0));
}

function computeSharpe(
  portReturn: number,
  portVol: number,
  riskFreeRate: number
): number {
  if (portVol < 1e-15) return 0;
  return (portReturn - riskFreeRate) / portVol;
}

function computeDiversificationRatio(
  w: Vector,
  vols: number[],
  portVol: number
): number {
  if (portVol < 1e-15) return 1;
  const weightedVolSum = dot(w, vols);
  return weightedVolSum / portVol;
}

function computeRiskContributions(
  w: Vector,
  covMatrix: Matrix
): Vector {
  const SigmaW = matVec(covMatrix, w);
  const portVar = dot(w, SigmaW);
  const rc: Vector = zeros(w.length);
  for (let i = 0; i < w.length; i++) {
    rc[i] = (w[i] * SigmaW[i]) / (portVar + 1e-15);
  }
  return rc;
}

// ─── Main Class ────────────────────────────────────────────────────────────────

export class PortfolioOptimizer {
  /**
   * Optimize a portfolio given assets, correlation matrix, and configuration.
   */
  optimize(
    assets: Asset[],
    correlationMatrix: number[][],
    config: OptimizationConfig
  ): OptimizationResult {
    const start = performance.now();
    const n = assets.length;

    log.info(`[PortfolioOptimizer] Starting optimization: method=${config.method}, assets=${n}`);

    if (n === 0) {
      log.warn('[PortfolioOptimizer] No assets provided');
      return this.emptyResult(config.method, start);
    }

    if (n === 1) {
      return this.singleAssetResult(assets[0], config);
    }

    this.validateCorrelationMatrix(correlationMatrix, n);

    const vols = assets.map((a) => a.volatility);
    const returns = assets.map((a) => a.expectedReturn);
    const covMatrix = buildCovarianceMatrix(correlationMatrix, vols);

    let w: Vector;

    switch (config.method) {
      case 'equal_weight':
        w = equalWeight(n);
        break;
      case 'min_variance':
        w = optimizeMinVariance(covMatrix, n, config.constraints);
        break;
      case 'max_sharpe':
        w = optimizeMaxSharpe(returns, covMatrix, n, config.riskFreeRate, config.constraints);
        break;
      case 'mean_variance':
        w = optimizeMeanVariance(returns, covMatrix, n, config.riskFreeRate, config.constraints);
        break;
      case 'risk_parity':
        w = optimizeRiskParity(covMatrix, n, config.constraints);
        break;
      default:
        log.warn(`[PortfolioOptimizer] Unknown method: ${config.method}, falling back to equal_weight`);
        w = equalWeight(n);
    }

    // Apply maxAssets constraint if specified
    if (config.constraints?.maxAssets && config.constraints.maxAssets < n) {
      w = applyMaxAssets(w, config.constraints.maxAssets);
    }

    // Build result
    const result = this.buildResult(assets, w, returns, covMatrix, vols, config, start);
    log.info(
      `[PortfolioOptimizer] Optimization complete: return=${result.expectedReturn.toFixed(4)}, ` +
      `vol=${result.expectedVolatility.toFixed(4)}, sharpe=${result.sharpeRatio.toFixed(4)}, ` +
      `duration=${result.durationMs.toFixed(1)}ms`
    );
    return result;
  }

  /**
   * Compute the efficient frontier using Monte Carlo sampling.
   * Generates random portfolios and keeps those near the efficient frontier.
   */
  efficientFrontier(
    assets: Asset[],
    corrMatrix: number[][],
    points: number = FRONTIER_DEFAULT_POINTS
  ): OptimizationResult[] {
    const start = performance.now();
    const n = assets.length;

    log.info(`[PortfolioOptimizer] Computing efficient frontier: assets=${n}, points=${points}`);

    if (n === 0) return [];

    const vols = assets.map((a) => a.volatility);
    const returns = assets.map((a) => a.expectedReturn);
    const covMatrix = buildCovarianceMatrix(corrMatrix, vols);

    // Find min-return and max-return portfolios for range
    const minRet = Math.min(...returns);
    const maxRet = Math.max(...returns);
    const targetReturns: number[] = [];
    for (let i = 0; i < points; i++) {
      targetReturns.push(minRet + (maxRet - minRet) * (i / (points - 1)));
    }

    // Monte Carlo: generate random portfolios and bucket by return
    const rng = xorshift32(42);
    const buckets: Map<number, { w: Vector; vol: number }> = new Map();

    // Initialize buckets with infinity
    for (let i = 0; i < points; i++) {
      buckets.set(i, { w: zeros(n), vol: Infinity });
    }

    for (let sample = 0; sample < MONTE_CARLO_SAMPLES; sample++) {
      // Generate random weights (Dirichlet via exponential)
      const rawW: Vector = zeros(n);
      for (let i = 0; i < n; i++) {
        rawW[i] = -Math.log(Math.max(rng(), 1e-15));
      }
      const s = vecSum(rawW);
      const w = rawW.map((x) => x / s);

      const portRet = dot(w, returns);
      const portVol = computePortfolioVolatility(w, covMatrix);

      // Find closest target return bucket
      let bestBucket = 0;
      let bestDist = Infinity;
      for (let i = 0; i < points; i++) {
        const dist = Math.abs(portRet - targetReturns[i]);
        if (dist < bestDist) {
          bestDist = dist;
          bestBucket = i;
        }
      }

      const current = buckets.get(bestBucket)!;
      if (portVol < current.vol) {
        buckets.set(bestBucket, { w, vol: portVol });
      }
    }

    // Also add optimized min-variance and max-sharpe portfolios
    const minVarW = optimizeMinVariance(covMatrix, n, undefined);
    const maxSharpeW = optimizeMaxSharpe(returns, covMatrix, n, 0, undefined);

    // Build results
    const results: OptimizationResult[] = [];
    const config: OptimizationConfig = { method: 'mean_variance', riskFreeRate: 0 };

    for (let i = 0; i < points; i++) {
      const bucket = buckets.get(i)!;
      if (bucket.vol === Infinity) {
        // No sample landed here, use interpolated equal weight
        bucket.w = new Array(n).fill(1 / n);
      }
      results.push(
        this.buildResult(assets, bucket.w, returns, covMatrix, vols, config, start)
      );
    }

    // Sort by expected return
    results.sort((a, b) => a.expectedReturn - b.expectedReturn);

    log.info(
      `[PortfolioOptimizer] Efficient frontier computed: ${results.length} points, ` +
      `duration=${(performance.now() - start).toFixed(1)}ms`
    );
    return results;
  }

  /**
   * Analyze an existing portfolio's diversification characteristics.
   */
  analyzePortfolio(
    allocations: PortfolioAllocation[],
    corrMatrix: number[][]
  ): PortfolioAnalysis {
    log.info(`[PortfolioOptimizer] Analyzing portfolio: ${allocations.length} assets`);

    const n = allocations.length;
    if (n === 0) {
      return { diversification: 0, concentration: 0, herfindahlIndex: 0 };
    }

    const weights = allocations.map((a) => a.weight);

    // Herfindahl-Hirschman Index (HHI): sum of squared weights
    // Ranges from 1/n (most diversified) to 1 (most concentrated)
    let hhi = 0;
    for (const w of weights) {
      hhi += w * w;
    }

    // Concentration: normalized HHI
    // 0 = perfectly diversified (equal weight), 1 = single asset
    const concentration = n > 1 ? (hhi - 1 / n) / (1 - 1 / n) : 1;

    // Diversification ratio using correlation structure
    // DR = weighted average of individual vols / portfolio vol
    // We need to reconstruct from allocations and corrMatrix
    const riskContribs = allocations.map((a) => a.riskContribution);
    const rcEntropy = this.computeEntropy(riskContribs);
    const maxEntropy = Math.log(n);

    // Diversification score: 0 to 1 based on risk contribution entropy
    const diversification = maxEntropy > 0 ? rcEntropy / maxEntropy : 0;

    log.info(
      `[PortfolioOptimizer] Analysis: diversification=${diversification.toFixed(4)}, ` +
      `concentration=${concentration.toFixed(4)}, HHI=${hhi.toFixed(4)}`
    );

    return {
      diversification: Math.min(1, Math.max(0, diversification)),
      concentration: Math.min(1, Math.max(0, concentration)),
      herfindahlIndex: hhi,
    };
  }

  /**
   * Rebalance a portfolio from current weights to target weights.
   * Only adjusts assets that have drifted beyond the threshold.
   *
   * @param current - Current portfolio allocations
   * @param target - Target portfolio allocations
   * @param threshold - Minimum drift (absolute weight difference) to trigger rebalance for an asset
   * @returns New allocations after rebalancing
   */
  rebalance(
    current: PortfolioAllocation[],
    target: PortfolioAllocation[],
    threshold: number
  ): PortfolioAllocation[] {
    log.info(
      `[PortfolioOptimizer] Rebalancing: current=${current.length}, target=${target.length}, threshold=${threshold}`
    );

    // Build lookup maps
    const currentMap = new Map<string, PortfolioAllocation>();
    for (const a of current) currentMap.set(a.assetId, a);

    const targetMap = new Map<string, PortfolioAllocation>();
    for (const a of target) targetMap.set(a.assetId, a);

    // Collect all asset IDs
    const allIds = new Set<string>([
      ...currentMap.keys(),
      ...targetMap.keys(),
    ]);

    const result: PortfolioAllocation[] = [];
    let adjustmentSum = 0;

    for (const id of allIds) {
      const c = currentMap.get(id);
      const t = targetMap.get(id);

      const currentWeight = c?.weight ?? 0;
      const targetWeight = t?.weight ?? 0;
      const drift = Math.abs(currentWeight - targetWeight);

      let newWeight: number;

      if (drift >= threshold) {
        // Rebalance this asset to target
        newWeight = targetWeight;
        log.debug(
          `[PortfolioOptimizer] Rebalancing ${id}: ${currentWeight.toFixed(4)} → ${targetWeight.toFixed(4)} (drift=${drift.toFixed(4)})`
        );
      } else {
        // Keep current weight
        newWeight = currentWeight;
        log.debug(
          `[PortfolioOptimizer] Holding ${id}: ${currentWeight.toFixed(4)} (drift=${drift.toFixed(4)} < threshold)`
        );
      }

      adjustmentSum += newWeight;

      result.push({
        assetId: id,
        weight: newWeight,
        expectedContribution: t?.expectedContribution ?? c?.expectedContribution ?? 0,
        riskContribution: t?.riskContribution ?? c?.riskContribution ?? 0,
      });
    }

    // Normalize weights to sum to 1
    if (adjustmentSum > 1e-15) {
      for (const alloc of result) {
        alloc.weight /= adjustmentSum;
      }
    }

    // Sort by weight descending
    result.sort((a, b) => b.weight - a.weight);

    log.info(`[PortfolioOptimizer] Rebalance complete: ${result.length} allocations`);
    return result;
  }

  // ─── Private Helpers ───────────────────────────────────────────────────────

  /**
   * Build an OptimizationResult from weight vector.
   */
  private buildResult(
    assets: Asset[],
    w: Vector,
    returns: Vector,
    covMatrix: Matrix,
    vols: number[],
    config: OptimizationConfig,
    startTime: number
  ): OptimizationResult {
    const n = assets.length;
    const portReturn = computePortfolioReturn(w, returns);
    const portVol = computePortfolioVolatility(w, covMatrix);
    const sharpe = computeSharpe(portReturn, portVol, config.riskFreeRate);
    const divRatio = computeDiversificationRatio(w, vols, portVol);
    const riskContribs = computeRiskContributions(w, covMatrix);

    const allocations: PortfolioAllocation[] = assets.map((asset, i) => ({
      assetId: asset.id,
      weight: w[i],
      expectedContribution: w[i] * returns[i],
      riskContribution: riskContribs[i],
    }));

    return {
      allocations,
      expectedReturn: portReturn,
      expectedVolatility: portVol,
      sharpeRatio: sharpe,
      diversificationRatio: divRatio,
      method: config.method,
      durationMs: performance.now() - startTime,
    };
  }

  /**
   * Return an empty result when no assets are provided.
   */
  private emptyResult(method: string, startTime: number): OptimizationResult {
    return {
      allocations: [],
      expectedReturn: 0,
      expectedVolatility: 0,
      sharpeRatio: 0,
      diversificationRatio: 1,
      method,
      durationMs: performance.now() - startTime,
    };
  }

  /**
   * Return a result for a single asset.
   */
  private singleAssetResult(
    asset: Asset,
    config: OptimizationConfig
  ): OptimizationResult {
    const start = performance.now();
    const sharpe = computeSharpe(
      asset.expectedReturn,
      asset.volatility,
      config.riskFreeRate
    );

    return {
      allocations: [
        {
          assetId: asset.id,
          weight: 1,
          expectedContribution: asset.expectedReturn,
          riskContribution: 1,
        },
      ],
      expectedReturn: asset.expectedReturn,
      expectedVolatility: asset.volatility,
      sharpeRatio: sharpe,
      diversificationRatio: 1,
      method: config.method,
      durationMs: performance.now() - start,
    };
  }

  /**
   * Validate that the correlation matrix has correct dimensions and properties.
   */
  private validateCorrelationMatrix(matrix: number[][], expectedSize: number): void {
    if (matrix.length !== expectedSize) {
      throw new EngineError(ErrorCode.PORTFOLIO_CALC_FAILED, `Correlation matrix rows (${matrix.length}) do not match asset count (${expectedSize})`);
    }
    for (let i = 0; i < expectedSize; i++) {
      if (matrix[i].length !== expectedSize) {
        throw new EngineError(ErrorCode.PORTFOLIO_CALC_FAILED, `Correlation matrix row ${i} has ${matrix[i].length} columns, expected ${expectedSize}`);
      }
      // Diagonal should be 1
      if (Math.abs(matrix[i][i] - 1) > 1e-6) {
        log.warn(
          `[PortfolioOptimizer] Correlation matrix diagonal [${i}][${i}] = ${matrix[i][i]}, expected 1`
        );
      }
      // Symmetry check
      for (let j = i + 1; j < expectedSize; j++) {
        if (Math.abs(matrix[i][j] - matrix[j][i]) > 1e-6) {
          log.warn(
            `[PortfolioOptimizer] Correlation matrix not symmetric: [${i}][${j}]=${matrix[i][j]} vs [${j}][${i}]=${matrix[j][i]}`
          );
        }
      }
    }
  }

  /**
   * Compute Shannon entropy of a probability distribution (vector summing to ~1).
   */
  private computeEntropy(v: Vector): number {
    let entropy = 0;
    for (const x of v) {
      if (x > 1e-15) {
        entropy -= x * Math.log(x);
      }
    }
    return entropy;
  }
}

export default PortfolioOptimizer;

// ── Standalone export for main.ts import ───────────────────────────────────
export function optimizePortfolio(assets: Asset[], config?: OptimizationConfig): OptimizationResult {
  const optimizer = new PortfolioOptimizer();
  return optimizer.optimize(assets, config);
}
export function generateEfficientFrontier(assets: Asset[], points?: number): { returns: number[]; risks: number[]; portfolios: PortfolioAllocation[][] } {
  const optimizer = new PortfolioOptimizer();
  return optimizer.generateEfficientFrontier(assets, points);
}
export function riskParityPortfolio(assets: Asset[]): OptimizationResult {
  const optimizer = new PortfolioOptimizer();
  return optimizer.riskParity(assets);
}
export function batchOptimizePortfolios(assetsList: Asset[][], configs?: OptimizationConfig[]): OptimizationResult[] {
  const optimizer = new PortfolioOptimizer();
  return assetsList.map((assets, i) => optimizer.optimize(assets, configs?.[i]));
}

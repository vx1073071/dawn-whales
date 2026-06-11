/**
 * JVS-92: Bayesian Optimizer
 * 
 * Strategy parameter tuning using surrogate models (simplified Gaussian Process).
 * Implements Expected Improvement, Upper Confidence Bound, and Probability of Improvement
 * acquisition functions with RBF kernel and Latin Hypercube Sampling for initial exploration.
 * 
 * No external dependencies — all matrix operations are implemented inline.
 */

import log from 'electron-log';
import { normalCDF } from '../utils/math';
import { EngineError, ErrorCode } from '../../errors';


// ============================================================================
// Interfaces
// ============================================================================

export interface Parameter {
  name: string;
  min: number;
  max: number;
  type: 'int' | 'float' | 'categorical';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  values?: any[];
}

export interface Observation {
  params: Record<string, number>;
  value: number;
  timestamp: string;
}

export interface AcquisitionConfig {
  type: 'ei' | 'ucb' | 'pi';
  xi?: number;
  kappa?: number;
}

export interface BOConfig {
  parameters: Parameter[];
  objectiveFunction: (params: Record<string, number>) => number;
  nInitialSamples: number;
  nIterations: number;
  acquisition: AcquisitionConfig;
  maximize: boolean;
  randomSeed?: number;
}

export interface BOResult {
  bestParams: Record<string, number>;
  bestValue: number;
  observations: Observation[];
  iterationHistory: { iteration: number; bestValue: number; currentValue: number }[];
  durationMs: number;
  surrogateModel: { mean: number[]; std: number[] };
}

export interface SuggestContext {
  parameters: Parameter[];
  acquisition: AcquisitionConfig;
  maximize: boolean;
}

// ============================================================================
// Seeded Pseudo-Random Number Generator (Mulberry32)
// ============================================================================

class SeededRNG {
  private state: number;

  constructor(seed: number) {
    this.state = seed | 0;
  }

  /** Returns a float in [0, 1) */
  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Returns a float in [min, max) */
  nextRange(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Returns an integer in [min, max] (inclusive) */
  nextInt(min: number, max: number): number {
    return Math.floor(this.nextRange(min, max + 1));
  }

  /** Returns a standard normal sample via Box-Muller transform */
  nextGaussian(): number {
    const u1 = this.next();
    const u2 = this.next();
    return Math.sqrt(-2.0 * Math.log(u1 + 1e-12)) * Math.cos(2.0 * Math.PI * u2);
  }

  /** Fisher-Yates shuffle (in-place) */
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}

// ============================================================================
// Matrix Utilities (no external deps)
// ============================================================================

/** Create an n×n identity matrix */
function eye(n: number): number[][] {
  const mat: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) mat[i][i] = 1;
  return mat;
}

/** Create an n×m zero matrix */
function zeros(n: number, m: number): number[][] {
  return Array.from({ length: n }, () => new Array(m).fill(0));
}

/** Create a zero vector of length n */
function zerosVec(n: number): number[] {
  return new Array(n).fill(0);
}

/** Matrix-vector multiply: A @ x */
function matVec(A: number[][], x: number[]): number[] {
  const n = A.length;
  const result = zerosVec(n);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let j = 0; j < A[i].length; j++) {
      sum += A[i][j] * x[j];
    }
    result[i] = sum;
  }
  return result;
}

/** Vector dot product */
function dot(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

/** Vector subtraction a - b */
function vecSub(a: number[], b: number[]): number[] {
  return a.map((v, i) => v - b[i]);
}

/** Vector addition a + b */
function vecAdd(a: number[], b: number[]): number[] {
  return a.map((v, i) => v + b[i]);
}

/** Scalar-vector multiply */
function scalarVec(s: number, v: number[]): number[] {
  return v.map((x) => x * s);
}

/** Euclidean norm */
function vecNorm(v: number[]): number {
  return Math.sqrt(dot(v, v));
}

/**
 * Cholesky decomposition of a symmetric positive-definite matrix.
 * Returns lower triangular L such that A = L @ L^T.
 * Falls back to adding jitter if the matrix is near-singular.
 */
function cholesky(A: number[][]): number[][] {
  const n = A.length;
  const L: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  const jitterValues = [1e-8, 1e-6, 1e-4, 1e-2];

  for (let jitterIdx = 0; jitterIdx < jitterValues.length; jitterIdx++) {
    const jitter = jitterIdx === 0 ? 0 : jitterValues[jitterIdx];
    let success = true;

    for (let i = 0; i < n; i++) {
      for (let j = 0; j <= i; j++) {
        let sum = 0;
        for (let k = 0; k < j; k++) {
          sum += L[i][k] * L[j][k];
        }

        if (i === j) {
          const diag = A[i][i] + jitter - sum;
          if (diag <= 0) {
            success = false;
            break;
          }
          L[i][j] = Math.sqrt(diag);
        } else {
          if (Math.abs(L[j][j]) < 1e-15) {
            success = false;
            break;
          }
          L[i][j] = (A[i][j] - sum) / L[j][j];
        }
      }
      if (!success) break;
    }

    if (success) {
      if (jitter > 0) {
        log.debug(`[BayesianOptimizer] Cholesky: added jitter ${jitter}`);
      }
      return L;
    }

    // Reset L for retry
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        L[i][j] = 0;
      }
    }
  }

  log.warn('[BayesianOptimizer] Cholesky failed even with jitter, using diagonal fallback');
  for (let i = 0; i < n; i++) {
    L[i][i] = Math.sqrt(Math.abs(A[i][i]) + 1);
  }
  return L;
}

/**
 * Solve L @ x = b where L is lower triangular (forward substitution).
 */
function solveLower(L: number[][], b: number[]): number[] {
  const n = L.length;
  const x = zerosVec(n);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let j = 0; j < i; j++) {
      sum += L[i][j] * x[j];
    }
    x[i] = (b[i] - sum) / (L[i][i] || 1e-10);
  }
  return x;
}

/**
 * Solve L^T @ x = b where L is lower triangular (back substitution).
 */
function solveUpper(L: number[][], b: number[]): number[] {
  const n = L.length;
  const x = zerosVec(n);
  for (let i = n - 1; i >= 0; i--) {
    let sum = 0;
    for (let j = i + 1; j < n; j++) {
      sum += L[j][i] * x[j];
    }
    x[i] = (b[i] - sum) / (L[i][i] || 1e-10);
  }
  return x;
}

/**
 * Solve A @ x = b using Cholesky decomposition: A = L @ L^T.
 */
function choleskySolve(A: number[][], b: number[]): number[] {
  const L = cholesky(A);
  const y = solveLower(L, b);
  const x = solveUpper(L, y);
  return x;
}

/**
 * Compute log determinant of a positive-definite matrix from its Cholesky factor.
 */
function logDeterminant(A: number[][]): number {
  const L = cholesky(A);
  let logDet = 0;
  for (let i = 0; i < L.length; i++) {
    logDet += 2 * Math.log(Math.abs(L[i][i]) + 1e-15);
  }
  return logDet;
}

/** Matrix transpose */
function transpose(A: number[][]): number[][] {
  if (A.length === 0) return [];
  const rows = A.length;
  const cols = A[0].length;
  const result: number[][] = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      result[j][i] = A[i][j];
    }
  }
  return result;
}

/** Matrix-matrix multiply */
function matMul(A: number[][], B: number[][]): number[][] {
  const rows = A.length;
  const cols = B[0].length;
  const inner = B.length;
  const result: number[][] = Array.from({ length: rows }, () => new Array(cols).fill(0));
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      let sum = 0;
      for (let k = 0; k < inner; k++) {
        sum += A[i][k] * B[k][j];
      }
      result[i][j] = sum;
    }
  }
  return result;
}

// ============================================================================
// Standard Normal CDF / PDF (for acquisition functions)
// ============================================================================

/**
 * Standard normal CDF Φ(z) using Abramowitz & Stegun approximation.
 * Accuracy: ~1.5e-7 absolute error.
 */


/** Standard normal PDF φ(z) */
function normalPDF(z: number): number {
  return Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
}

// ============================================================================
// BayesianOptimizer Class
// ============================================================================

export class BayesianOptimizer {
  // State
  private observations: Observation[] = [];
  private parameters: Parameter[] = [];
  private acquisition: AcquisitionConfig = { type: 'ei', xi: 0.01 };
  private maximize = true;
  private rng: SeededRNG;

  // Surrogate model state
  private kernelLengthScale: number = 1.0;
  private kernelVariance: number = 1.0;
  private noiseVariance: number = 1e-6;
  private surrogateFitted = false;
  private surrogateMean: number[] = [];
  private surrogateStd: number[] = [];

  // Normalization bounds (for mapping params to [0,1]^d)
  private normBounds: { min: number; max: number }[] = [];

  constructor() {
    this.rng = new SeededRNG(Date.now());
  }

  // ==========================================================================
  // Public API
  // ==========================================================================

  /**
   * Run a full Bayesian Optimization loop.
   */
  optimize(config: BOConfig): BOResult {
    const startTime = performance.now();
    log.info(`[BayesianOptimizer] Starting optimization with ${config.nInitialSamples} initial + ${config.nIterations} BO iterations`);

    this.parameters = config.parameters;
    this.acquisition = config.acquisition;
    this.maximize = config.maximize;
    this.observations = [];

    if (config.randomSeed !== undefined) {
      this.rng = new SeededRNG(config.randomSeed);
    }

    // Validate parameters
    this.validateParameters(config.parameters);

    // Build normalization bounds
    this.buildNormBounds();

    const iterationHistory: { iteration: number; bestValue: number; currentValue: number }[] = [];

    // Phase 1: Latin Hypercube Sampling for initial exploration
    log.info(`[BayesianOptimizer] Phase 1: Latin Hypercube Sampling (${config.nInitialSamples} samples)`);
    const initialSamples = this.latinHypercubeSample(config.nInitialSamples);

    for (let i = 0; i < initialSamples.length; i++) {
      const paramVec = initialSamples[i];
      const paramRecord = this.vecToParams(paramVec);
      let value: number;
      try {
        value = config.objectiveFunction(paramRecord);
      } catch (err) {
        log.warn(`[BayesianOptimizer] Objective function threw at sample ${i}: ${(err as Error).message}`);
        value = this.maximize ? -Infinity : Infinity;
      }
      this.observeInternal(paramRecord, value);

      const best = this.getBestInternal();
      iterationHistory.push({
        iteration: i + 1,
        bestValue: best.value,
        currentValue: value,
      });
    }

    log.info(`[BayesianOptimizer] Initial best: ${this.getBestInternal().value}`);

    // Phase 2: Bayesian Optimization iterations
    log.info(`[BayesianOptimizer] Phase 2: Bayesian Optimization (${config.nIterations} iterations)`);

    for (let i = 0; i < config.nIterations; i++) {
      // Fit surrogate
      this.fitSurrogate();

      // Optimize acquisition to find next point
      const nextVec = this.optimizeAcquisition();
      const nextParams = this.vecToParams(nextVec);

      let value: number;
      try {
        value = config.objectiveFunction(nextParams);
      } catch (err) {
        log.warn(`[BayesianOptimizer] Objective function threw at iteration ${i}: ${(err as Error).message}`);
        value = this.maximize ? -Infinity : Infinity;
      }

      this.observeInternal(nextParams, value);

      const best = this.getBestInternal();
      iterationHistory.push({
        iteration: config.nInitialSamples + i + 1,
        bestValue: best.value,
        currentValue: value,
      });

      if ((i + 1) % 10 === 0 || i === config.nIterations - 1) {
        log.info(`[BayesianOptimizer] Iteration ${i + 1}/${config.nIterations}: current=${value.toFixed(6)}, best=${best.value.toFixed(6)}`);
      }
    }

    const durationMs = performance.now() - startTime;
    const best = this.getBestInternal();

    log.info(`[BayesianOptimizer] Optimization complete. Best value: ${best.value.toFixed(6)} in ${durationMs.toFixed(1)}ms`);

    const result: BOResult = {
      bestParams: best.params,
      bestValue: best.value,
      observations: [...this.observations],
      iterationHistory,
      durationMs,
      surrogateModel: {
        mean: [...this.surrogateMean],
        std: [...this.surrogateStd],
      },
    };

    return result;
  }

  /**
   * Get the next suggested parameters to evaluate.
   * Requires prior observations or a configured context.
   */
  suggest(): Record<string, number> {
    if (this.parameters.length === 0) {
      throw new EngineError(ErrorCode.PORTFOLIO_CALC_FAILED, '[BayesianOptimizer] No parameters configured. Call optimize() first or set parameters via observe() context.');
    }

    if (this.observations.length === 0) {
      // No data yet — random sample
      const vec = this.randomSample();
      return this.vecToParams(vec);
    }

    // Fit surrogate and optimize acquisition
    this.fitSurrogate();
    const nextVec = this.optimizeAcquisition();
    return this.vecToParams(nextVec);
  }

  /**
   * Record a new observation (params → objective value).
   */
  observe(params: Record<string, number>, value: number): void {
    this.observeInternal(params, value);
    log.debug(`[BayesianOptimizer] Observation recorded: value=${value.toFixed(6)}, total=${this.observations.length}`);
  }

  /**
   * Get the best observed parameters and value.
   */
  getBest(): { params: Record<string, number>; value: number } {
    return this.getBestInternal();
  }

  /**
   * Get all observations.
   */
  getHistory(): Observation[] {
    return [...this.observations];
  }

  // ==========================================================================
  // Internal: Observation management
  // ==========================================================================

  private observeInternal(params: Record<string, number>, value: number): void {
    const obs: Observation = {
      params: { ...params },
      value,
      timestamp: new Date().toISOString(),
    };
    this.observations.push(obs);
    this.surrogateFitted = false;
  }

  private getBestInternal(): { params: Record<string, number>; value: number } {
    if (this.observations.length === 0) {
      return { params: {}, value: this.maximize ? -Infinity : Infinity };
    }

    let best = this.observations[0];
    for (let i = 1; i < this.observations.length; i++) {
      const obs = this.observations[i];
      if (this.maximize ? obs.value > best.value : obs.value < best.value) {
        best = obs;
      }
    }
    return { params: { ...best.params }, value: best.value };
  }

  // ==========================================================================
  // Parameter Validation
  // ==========================================================================

  private validateParameters(params: Parameter[]): void {
    if (params.length === 0) {
      throw new EngineError(ErrorCode.PORTFOLIO_CALC_FAILED, '[BayesianOptimizer] At least one parameter is required');
    }
    for (const p of params) {
      if (p.type === 'categorical') {
        if (!p.values || p.values.length === 0) {
          throw new EngineError(ErrorCode.PORTFOLIO_CALC_FAILED, `[BayesianOptimizer] Categorical parameter "${p.name}" must have values`);
        }
      } else {
        if (p.min >= p.max) {
          throw new EngineError(ErrorCode.PORTFOLIO_CALC_FAILED, `[BayesianOptimizer] Parameter "${p.name}": min must be < max (got min=${p.min}, max=${p.max})`);
        }
      }
    }
  }

  // ==========================================================================
  // Normalization (map parameters to [0,1]^d for kernel computation)
  // ==========================================================================

  private buildNormBounds(): void {
    this.normBounds = [];
    for (const p of this.parameters) {
      if (p.type === 'categorical' && p.values && p.values.length > 0) {
        this.normBounds.push({ min: 0, max: p.values.length - 1 });
      } else {
        this.normBounds.push({ min: p.min, max: p.max });
      }
    }
  }

  /** Normalize a parameter vector to [0, 1]^d */
  private normalize(vec: number[]): number[] {
    return vec.map((v, i) => {
      const { min, max } = this.normBounds[i];
      const range = max - min;
      if (range === 0) return 0;
      return (v - min) / range;
    });
  }

  /** Denormalize from [0,1]^d back to original scale */
  private denormalize(norm: number[]): number[] {
    return norm.map((v, i) => {
      const { min, max } = this.normBounds[i];
      const raw = v * (max - min) + min;
      const param = this.parameters[i];
      if (param.type === 'int') {
        return Math.round(Math.max(min, Math.min(max, raw)));
      }
      if (param.type === 'categorical') {
        return Math.round(Math.max(0, Math.min((param.values?.length ?? 1) - 1, raw)));
      }
      return Math.max(min, Math.min(max, raw));
    });
  }

  /** Convert parameter vector to Record<string, number> */
  private vecToParams(vec: number[]): Record<string, number> {
    const result: Record<string, number> = {};
    for (let i = 0; i < this.parameters.length; i++) {
      const p = this.parameters[i];
      let val = vec[i];
      if (p.type === 'int') {
        val = Math.round(val);
      }
      if (p.type === 'categorical' && p.values) {
        const idx = Math.round(Math.max(0, Math.min(p.values.length - 1, val)));
        val = typeof p.values[idx] === 'number' ? p.values[idx] : idx;
      }
      result[p.name] = val;
    }
    return result;
  }

  /** Convert Record<string, number> to parameter vector */
  private paramsToVec(params: Record<string, number>): number[] {
    return this.parameters.map((p) => {
      const val = params[p.name];
      if (val === undefined) {
        throw new EngineError(ErrorCode.PORTFOLIO_CALC_FAILED, `[BayesianOptimizer] Missing parameter "${p.name}"`);
      }
      return val;
    });
  }

  // ==========================================================================
  // Latin Hypercube Sampling
  // ==========================================================================

  /**
   * Generate n space-filling samples using Latin Hypercube Sampling.
   * Each dimension is divided into n equal strata, and one sample is drawn
   * from each stratum per dimension, then randomly permuted.
   */
  latinHypercubeSample(n: number): number[][] {
    const d = this.parameters.length;
    if (n <= 0) return [];

    log.debug(`[BayesianOptimizer] Latin Hypercube Sampling: n=${n}, d=${d}`);

    // Generate LHS matrix: each column is a random permutation of [0..n-1] + uniform jitter
    const samples: number[][] = [];

    for (let i = 0; i < n; i++) {
      samples.push(new Array(d).fill(0));
    }

    for (let j = 0; j < d; j++) {
      // Create permuted indices
      const indices = Array.from({ length: n }, (_, i) => i);
      this.rng.shuffle(indices);

      for (let i = 0; i < n; i++) {
        // Stratified sample: uniform within [indices[i]/n, (indices[i]+1)/n]
        const u = (indices[i] + this.rng.next()) / n;
        // Map from [0,1] to parameter range
        const param = this.parameters[j];
        if (param.type === 'categorical' && param.values) {
          const catIdx = Math.floor(u * param.values.length);
          samples[i][j] = Math.min(catIdx, param.values.length - 1);
        } else if (param.type === 'int') {
          samples[i][j] = Math.round(param.min + u * (param.max - param.min));
        } else {
          samples[i][j] = param.min + u * (param.max - param.min);
        }
      }
    }

    return samples;
  }

  /** Generate a single random sample within parameter bounds */
  private randomSample(): number[] {
    return this.parameters.map((p) => {
      if (p.type === 'categorical' && p.values) {
        return this.rng.nextInt(0, p.values.length - 1);
      }
      if (p.type === 'int') {
        return this.rng.nextInt(p.min, p.max);
      }
      return this.rng.nextRange(p.min, p.max);
    });
  }

  // ==========================================================================
  // Gaussian Process Surrogate Model (Simplified)
  // ==========================================================================

  /**
   * RBF (Squared Exponential) kernel:
   *   k(a, b) = σ² * exp(-||a - b||² / (2 * l²))
   * 
   * where l = length scale, σ² = signal variance.
   * Both inputs are expected to be in normalized [0,1]^d space.
   */
  kernel(a: number[], b: number[]): number {
    const d = a.length;
    let sqDist = 0;
    for (let i = 0; i < d; i++) {
      const diff = a[i] - b[i];
      sqDist += diff * diff;
    }
    return this.kernelVariance * Math.exp(-sqDist / (2 * this.kernelLengthScale * this.kernelLengthScale));
  }

  /**
   * Compute the full kernel matrix K(X, X) + noise * I.
   */
  private computeKernelMatrix(X: number[][]): number[][] {
    const n = X.length;
    const K: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));

    for (let i = 0; i < n; i++) {
      for (let j = i; j < n; j++) {
        const kij = this.kernel(X[i], X[j]);
        K[i][j] = kij;
        K[j][i] = kij;
      }
      K[i][i] += this.noiseVariance; // nugget / noise term
    }

    return K;
  }

  /**
   * Estimate kernel hyperparameters using simple heuristics.
   * - Length scale: median of pairwise distances (normalized space)
   * - Signal variance: variance of observed values
   * - Noise variance: small fixed value (regularization)
   */
  private estimateHyperparameters(Xnorm: number[][], Y: number[]): void {
    const n = Xnorm.length;

    // Length scale: median pairwise distance heuristic
    if (n >= 2) {
      const dists: number[] = [];
      const maxPairs = Math.min(n * (n - 1) / 2, 500); // cap for performance
      let count = 0;
      for (let i = 0; i < n && count < maxPairs; i++) {
        for (let j = i + 1; j < n && count < maxPairs; j++) {
          let sqDist = 0;
          for (let d = 0; d < Xnorm[i].length; d++) {
            const diff = Xnorm[i][d] - Xnorm[j][d];
            sqDist += diff * diff;
          }
          dists.push(Math.sqrt(sqDist));
          count++;
        }
      }
      dists.sort((a, b) => a - b);
      const medianDist = dists[Math.floor(dists.length / 2)] || 0.5;
      // Length scale ~ median distance / sqrt(2)
      this.kernelLengthScale = Math.max(medianDist / Math.SQRT2, 0.01);
    } else {
      this.kernelLengthScale = 0.5;
    }

    // Signal variance: variance of Y values
    if (n >= 2) {
      const meanY = Y.reduce((s, v) => s + v, 0) / n;
      const varY = Y.reduce((s, v) => s + (v - meanY) ** 2, 0) / (n - 1);
      this.kernelVariance = Math.max(varY, 1e-6);
    } else {
      this.kernelVariance = 1.0;
    }

    // Noise variance: small regularization
    this.noiseVariance = 1e-6 * this.kernelVariance;

    log.debug(
      `[BayesianOptimizer] Hyperparameters: lengthScale=${this.kernelLengthScale.toFixed(4)}, ` +
      `variance=${this.kernelVariance.toFixed(6)}, noise=${this.noiseVariance.toFixed(10)}`
    );
  }

  /**
   * Fit the Gaussian Process surrogate model.
   * 
   * Steps:
   * 1. Normalize input data to [0,1]^d
   * 2. Estimate kernel hyperparameters
   * 3. Compute kernel matrix K + σ²I
   * 4. Precompute K^{-1} @ Y for predictions
   * 5. Compute posterior mean and std at observed points
   */
  fitSurrogate(): void {
    const n = this.observations.length;
    if (n === 0) {
      log.warn('[BayesianOptimizer] Cannot fit surrogate: no observations');
      return;
    }

    // Build normalized input matrix and output vector
    const Xnorm: number[][] = [];
    const Y: number[] = [];

    for (const obs of this.observations) {
      const vec = this.paramsToVec(obs.params);
      Xnorm.push(this.normalize(vec));
      // If minimizing, negate values so we always maximize internally
      Y.push(this.maximize ? obs.value : -obs.value);
    }

    // Estimate hyperparameters
    this.estimateHyperparameters(Xnorm, Y);

    // Compute kernel matrix
    const K = this.computeKernelMatrix(Xnorm);

    // Solve for alpha = K^{-1} @ Y (using Cholesky)
    const alpha = choleskySolve(K, Y);

    // Compute posterior mean and std at training points (for diagnostics)
    this.surrogateMean = [];
    this.surrogateStd = [];

    for (let i = 0; i < n; i++) {
      // Mean at training point should be close to Y[i] (interpolation property)
      const kStar: number[] = [];
      for (let j = 0; j < n; j++) {
        kStar.push(this.kernel(Xnorm[i], Xnorm[j]));
      }
      const mean = dot(kStar, alpha);

      // Variance: k(x*, x*) - k*^T K^{-1} k*
      const v = choleskySolve(K, kStar);
      const var_ = this.kernel(Xnorm[i], Xnorm[i]) - dot(kStar, v);
      const std = Math.sqrt(Math.max(var_, 1e-10));

      this.surrogateMean.push(this.maximize ? mean : -mean);
      this.surrogateStd.push(std);
    }

    // Store for prediction
    this._gpData = { Xnorm, Y, alpha, K };
    this.surrogateFitted = true;

    log.debug(`[BayesianOptimizer] Surrogate fitted with ${n} observations`);
  }

  /** Stored GP data for predictions */
  private _gpData: {
    Xnorm: number[][];
    Y: number[];
    alpha: number[];
    K: number[][];
  } | null = null;

  /**
   * Predict mean and std at a new point (in original parameter space).
   * Returns [mean, std] in the internal (maximization) frame.
   */
  private predict(xVec: number[]): [number, number] {
    if (!this.surrogateFitted || !this._gpData) {
      // No model — return prior
      return [0, Math.sqrt(this.kernelVariance)];
    }

    const { Xnorm, alpha, K } = this._gpData;
    const xNorm = this.normalize(xVec);
    const n = Xnorm.length;

    // k(x*, X)
    const kStar: number[] = [];
    for (let i = 0; i < n; i++) {
      kStar.push(this.kernel(xNorm, Xnorm[i]));
    }

    // Posterior mean: k*^T @ alpha
    const mean = dot(kStar, alpha);

    // Posterior variance: k(x*, x*) - k*^T K^{-1} k*
    const v = choleskySolve(K, kStar);
    const variance = this.kernel(xNorm, xNorm) - dot(kStar, v);
    const std = Math.sqrt(Math.max(variance, 1e-10));

    return [mean, std];
  }

  // ==========================================================================
  // Acquisition Functions
  // ==========================================================================

  /**
   * Compute acquisition function value at a given point.
   * 
   * Supported:
   * - EI (Expected Improvement): E[max(f(x) - f_best - ξ, 0)]
   * - UCB (Upper Confidence Bound): μ(x) + κ * σ(x)
   * - PI (Probability of Improvement): P(f(x) > f_best + ξ)
   * 
   * The input x is in original parameter space; normalization happens internally.
   */
  acquisitionFunction(x: number[]): number {
    const [mean, std] = this.predict(x);

    if (std < 1e-10) {
      // Essentially zero uncertainty — no improvement possible
      return 0;
    }

    const best = this.getBestInternal();
    const fBest = this.maximize ? best.value : -best.value;

    const xi = this.acquisition.xi ?? 0.01;
    const kappa = this.acquisition.kappa ?? 2.0;

    switch (this.acquisition.type) {
      case 'ei': {
        // Expected Improvement
        const z = (mean - fBest - xi) / std;
        const ei = (mean - fBest - xi) * normalCDF(z) + std * normalPDF(z);
        return Math.max(ei, 0);
      }

      case 'ucb': {
        // Upper Confidence Bound
        return mean + kappa * std;
      }

      case 'pi': {
        // Probability of Improvement
        const z = (mean - fBest - xi) / std;
        return normalCDF(z);
      }

      default:
        log.warn(`[BayesianOptimizer] Unknown acquisition type: ${this.acquisition.type}, falling back to EI`);
        const z = (mean - fBest - 0.01) / std;
        return (mean - fBest - 0.01) * normalCDF(z) + std * normalPDF(z);
    }
  }

  // ==========================================================================
  // Acquisition Optimization (Random Search + Local Refinement)
  // ==========================================================================

  /**
   * Find the maximum of the acquisition function.
   * 
   * Strategy:
   * 1. Random search: evaluate acquisition at many random points
   * 2. Local refinement: from the best random point, do small perturbations
   * 3. Return the best found point
   */
  optimizeAcquisition(): number[] {
    const d = this.parameters.length;

    // Phase 1: Random search
    const nRandom = Math.max(1000, 500 * d); // scale with dimensionality
    let bestVec = this.randomSample();
    let bestAcq = this.acquisitionFunction(bestVec);

    for (let i = 0; i < nRandom; i++) {
      const candidate = this.randomSample();
      const acqVal = this.acquisitionFunction(candidate);
      if (acqVal > bestAcq) {
        bestAcq = acqVal;
        bestVec = candidate;
      }
    }

    // Phase 2: Local refinement (coordinate-wise hill climbing)
    const refineVec = [...bestVec];
    let refineAcq = bestAcq;
    const nRefineRounds = 3;
    const nRefineSteps = 20;

    for (let round = 0; round < nRefineRounds; round++) {
      const stepScale = 0.1 / (round + 1); // decreasing step size

      for (let dim = 0; dim < d; dim++) {
        const param = this.parameters[dim];

        // Try perturbations in this dimension
        for (let step = 0; step < nRefineSteps; step++) {
          const candidate = [...refineVec];
          const range = (param.max - param.min) * stepScale;
          const delta = (this.rng.next() - 0.5) * 2 * range;

          candidate[dim] += delta;

          // Clamp to bounds
          if (param.type === 'categorical' && param.values) {
            candidate[dim] = Math.max(0, Math.min(param.values.length - 1, Math.round(candidate[dim])));
          } else if (param.type === 'int') {
            candidate[dim] = Math.round(Math.max(param.min, Math.min(param.max, candidate[dim])));
          } else {
            candidate[dim] = Math.max(param.min, Math.min(param.max, candidate[dim]));
          }

          const acqVal = this.acquisitionFunction(candidate);
          if (acqVal > refineAcq) {
            refineAcq = acqVal;
            for (let k = 0; k < d; k++) refineVec[k] = candidate[k];
          }
        }
      }
    }

    // Phase 3: Also try perturbing around observed best points (exploitation bias)
    if (this.observations.length > 0) {
      const topK = Math.min(5, this.observations.length);
      const sorted = [...this.observations].sort((a, b) => {
        const va = this.maximize ? a.value : -a.value;
        const vb = this.maximize ? b.value : -b.value;
        return vb - va;
      });

      for (let t = 0; t < topK; t++) {
        const baseVec = this.paramsToVec(sorted[t].params);
        for (let trial = 0; trial < 50; trial++) {
          const candidate = baseVec.map((v, dim) => {
            const param = this.parameters[dim];
            const range = (param.max - param.min) * 0.05;
            const perturbed = v + (this.rng.next() - 0.5) * 2 * range;
            if (param.type === 'categorical' && param.values) {
              return Math.max(0, Math.min(param.values.length - 1, Math.round(perturbed)));
            }
            if (param.type === 'int') {
              return Math.round(Math.max(param.min, Math.min(param.max, perturbed)));
            }
            return Math.max(param.min, Math.min(param.max, perturbed));
          });

          const acqVal = this.acquisitionFunction(candidate);
          if (acqVal > refineAcq) {
            refineAcq = acqVal;
            for (let k = 0; k < d; k++) refineVec[k] = candidate[k];
          }
        }
      }
    }

    log.debug(`[BayesianOptimizer] Acquisition optimized: value=${refineAcq.toFixed(6)}`);
    return refineVec;
  }

  // ==========================================================================
  // Utility: Reset state
  // ==========================================================================

  /**
   * Reset all observations and surrogate state.
   */
  reset(): void {
    this.observations = [];
    this.surrogateFitted = false;
    this.surrogateMean = [];
    this.surrogateStd = [];
    this._gpData = null;
    log.info('[BayesianOptimizer] State reset');
  }

  /**
   * Configure parameters and acquisition without running optimization.
   * Useful for manual suggest/observe loops.
   */
  configure(params: Parameter[], acquisition: AcquisitionConfig, maximize: boolean, seed?: number): void {
    this.parameters = params;
    this.acquisition = acquisition;
    this.maximize = maximize;
    this.validateParameters(params);
    this.buildNormBounds();
    if (seed !== undefined) {
      this.rng = new SeededRNG(seed);
    }
    log.info(`[BayesianOptimizer] Configured with ${params.length} parameters, acquisition=${acquisition.type}, maximize=${maximize}`);
  }

  /**
   * Get the number of observations recorded so far.
   */
  get observationCount(): number {
    return this.observations.length;
  }

  /**
   * Get the current surrogate model diagnostics.
   */
  getSurrogateDiagnostics(): { fitted: boolean; mean: number[]; std: number[]; hyperparameters: { lengthScale: number; variance: number; noise: number } } {
    return {
      fitted: this.surrogateFitted,
      mean: [...this.surrogateMean],
      std: [...this.surrogateStd],
      hyperparameters: {
        lengthScale: this.kernelLengthScale,
        variance: this.kernelVariance,
        noise: this.noiseVariance,
      },
    };
  }

  // ==========================================================================
  // Batch Suggestion (for parallel evaluation)
  // ==========================================================================

  /**
   * Suggest a batch of points for parallel evaluation.
   * Uses the "Kriging Believer" heuristic: after suggesting each point,
   * temporarily add it to the model with its predicted mean, then re-fit.
   */
  suggestBatch(batchSize: number): Record<string, number>[] {
    if (this.parameters.length === 0) {
      throw new EngineError(ErrorCode.PORTFOLIO_CALC_FAILED, '[BayesianOptimizer] No parameters configured');
    }

    const batch: Record<string, number>[] = [];
    const tempObservations: Observation[] = [];

    for (let i = 0; i < batchSize; i++) {
      if (this.observations.length === 0 && i === 0) {
        // First point: random
        const vec = this.randomSample();
        const params = this.vecToParams(vec);
        batch.push(params);

        // Kriging believer: add phantom observation at predicted mean
        this.fitSurrogate();
        const [predMean] = this.predict(vec);
        tempObservations.push({
          params,
          value: this.maximize ? predMean : -predMean,
          timestamp: new Date().toISOString(),
        });
        this.observeInternal(params, this.maximize ? predMean : -predMean);
      } else {
        this.fitSurrogate();
        const vec = this.optimizeAcquisition();
        const params = this.vecToParams(vec);
        batch.push(params);

        // Kriging believer
        const [predMean] = this.predict(vec);
        tempObservations.push({
          params,
          value: this.maximize ? predMean : -predMean,
          timestamp: new Date().toISOString(),
        });
        this.observeInternal(params, this.maximize ? predMean : -predMean);
      }
    }

    // Remove temporary observations
    for (const temp of tempObservations) {
      const idx = this.observations.indexOf(temp);
      if (idx >= 0) {
        this.observations.splice(idx, 1);
      }
    }
    this.surrogateFitted = false;

    log.info(`[BayesianOptimizer] Batch suggestion: ${batchSize} points generated`);
    return batch;
  }

  // ==========================================================================
  // Constrained Optimization Support
  // ==========================================================================

  /**
   * Optimize with a constraint function.
   * Points that violate the constraint (constraintFn returns false) are penalized.
   */
  optimizeWithConstraint(
    config: BOConfig,
    constraintFn: (params: Record<string, number>) => boolean,
    penaltyValue?: number,
  ): BOResult {
    const penalty = penaltyValue ?? (this.maximize ? -1e10 : 1e10);

    const wrappedObjective = (params: Record<string, number>): number => {
      if (!constraintFn(params)) {
        return penalty;
      }
      return config.objectiveFunction(params);
    };

    const wrappedConfig: BOConfig = {
      ...config,
      objectiveFunction: wrappedObjective,
    };

    return this.optimize(wrappedConfig);
  }

  // ==========================================================================
  // Multi-Objective Support (Weighted Sum Scalarization)
  // ==========================================================================

  /**
   * Optimize multiple objectives using weighted sum scalarization.
   * Each objective function is evaluated and combined as: sum(weights[i] * f_i(x)).
   */
  optimizeMultiObjective(
    parameters: Parameter[],
    objectives: ((params: Record<string, number>) => number)[],
    weights: number[],
    nInitialSamples: number,
    nIterations: number,
    acquisition: AcquisitionConfig,
    maximize: boolean,
    randomSeed?: number,
  ): BOResult {
    if (objectives.length !== weights.length) {
      throw new EngineError(ErrorCode.PORTFOLIO_CALC_FAILED, '[BayesianOptimizer] objectives and weights must have same length');
    }

    // Normalize weights
    const wSum = weights.reduce((s, w) => s + Math.abs(w), 0);
    const normWeights = weights.map((w) => w / wSum);

    const scalarized = (params: Record<string, number>): number => {
      let total = 0;
      for (let i = 0; i < objectives.length; i++) {
        total += normWeights[i] * objectives[i](params);
      }
      return total;
    };

    return this.optimize({
      parameters,
      objectiveFunction: scalarized,
      nInitialSamples,
      nIterations,
      acquisition,
      maximize,
      randomSeed,
    });
  }

  // ==========================================================================
  // Statistical Summary
  // ==========================================================================

  /**
   * Get a statistical summary of the optimization progress.
   */
  getSummary(): {
    totalObservations: number;
    bestValue: number;
    bestParams: Record<string, number>;
    meanValue: number;
    stdValue: number;
    minValue: number;
    maxValue: number;
    improvementRate: number;
  } {
    if (this.observations.length === 0) {
      return {
        totalObservations: 0,
        bestValue: this.maximize ? -Infinity : Infinity,
        bestParams: {},
        meanValue: 0,
        stdValue: 0,
        minValue: Infinity,
        maxValue: -Infinity,
        improvementRate: 0,
      };
    }

    const values = this.observations.map((o) => o.value);
    const best = this.getBestInternal();
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / Math.max(values.length - 1, 1);

    // Compute improvement rate: fraction of observations that improved on the running best
    let improvements = 0;
    let runningBest = values[0];
    for (let i = 1; i < values.length; i++) {
      const improved = this.maximize ? values[i] > runningBest : values[i] < runningBest;
      if (improved) improvements++;
      runningBest = improved ? values[i] : runningBest;
    }

    return {
      totalObservations: this.observations.length,
      bestValue: best.value,
      bestParams: best.params,
      meanValue: mean,
      stdValue: Math.sqrt(variance),
      minValue: Math.min(...values),
      maxValue: Math.max(...values),
      improvementRate: improvements / Math.max(this.observations.length - 1, 1),
    };
  }
}

// ============================================================================
// Default export
// ============================================================================

export default BayesianOptimizer;

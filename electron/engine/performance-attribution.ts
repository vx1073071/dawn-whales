/**
 * Performance Attribution Engine
 * Analyzes strategy performance and attributes returns to factors.
 * JVS-46-03
 */

import log from 'electron-log';

// ─── Inline EventEmitter Polyfill ───────────────────────────────────────────

type EventListener = (...args: any[]) => void;

class EventEmitter {
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
      this._listeners.set(event, list.filter(l => l !== listener));
    }
    return this;
  }

  emit(event: string, ...args: any[]): boolean {
    const list = this._listeners.get(event);
    if (!list || list.length === 0) return false;
    for (const fn of list) {
      try {
        fn(...args);
      } catch (err) {
        log.error(`[EventEmitter] Error in listener for "${event}":`, err);
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

// ─── Interfaces ─────────────────────────────────────────────────────────────

export interface AttributionResult {
  totalReturn: number;
  marketReturn: number;
  alpha: number;
  beta: number;
  factorAttributions: { factor: string; contribution: number }[];
  sharpe: number;
  sortino: number;
  maxDrawdown: number;
}

export interface FactorModel {
  factors: string[];
  weights: number[];
  rSquared: number;
}

interface DailyReturn {
  date: string;
  value: number;
}

interface InternalMetrics {
  alpha: number;
  beta: number;
  rSquared: number;
}

// ─── Helper: Math Utilities ─────────────────────────────────────────────────

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function variance(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1);
}

function stddev(arr: number[]): number {
  return Math.sqrt(variance(arr));
}

function covariance(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length < 2) return 0;
  const mx = mean(x);
  const my = mean(y);
  return x.reduce((s, xi, i) => s + (xi - mx) * (y[i] - my), 0) / (x.length - 1);
}

function correlation(x: number[], y: number[]): number {
  const sx = stddev(x);
  const sy = stddev(y);
  if (sx === 0 || sy === 0) return 0;
  return covariance(x, y) / (sx * sy);
}

function downsideDeviation(returns: number[], riskFreeRate: number = 0): number {
  const downside = returns
    .map(r => r - riskFreeRate)
    .filter(d => d < 0)
    .map(d => d * d);
  if (downside.length === 0) return 0;
  return Math.sqrt(downside.reduce((s, v) => s + v, 0) / returns.length);
}

function computeMaxDrawdown(returns: number[]): number {
  if (returns.length === 0) return 0;
  let cumulative = 1;
  let peak = 1;
  let maxDd = 0;
  for (const r of returns) {
    cumulative *= (1 + r);
    if (cumulative > peak) peak = cumulative;
    const dd = (peak - cumulative) / peak;
    if (dd > maxDd) maxDd = dd;
  }
  return maxDd;
}

function compoundReturn(returns: number[]): number {
  if (returns.length === 0) return 0;
  let cumulative = 1;
  for (const r of returns) {
    cumulative *= (1 + r);
  }
  return cumulative - 1;
}

/**
 * Simple OLS linear regression: y = a + b*x
 * Returns { intercept, slope, rSquared }
 */
function simpleLinearRegression(x: number[], y: number[]): {
  intercept: number;
  slope: number;
  rSquared: number;
} {
  const n = Math.min(x.length, y.length);
  if (n < 2) return { intercept: 0, slope: 0, rSquared: 0 };

  const mx = mean(x.slice(0, n));
  const my = mean(y.slice(0, n));

  let ssXY = 0;
  let ssXX = 0;
  let ssTot = 0;

  for (let i = 0; i < n; i++) {
    ssXY += (x[i] - mx) * (y[i] - my);
    ssXX += (x[i] - mx) ** 2;
    ssTot += (y[i] - my) ** 2;
  }

  const slope = ssXX === 0 ? 0 : ssXY / ssXX;
  const intercept = my - slope * mx;

  let ssRes = 0;
  for (let i = 0; i < n; i++) {
    const predicted = intercept + slope * x[i];
    ssRes += (y[i] - predicted) ** 2;
  }

  const rSquared = ssTot === 0 ? 0 : 1 - ssRes / ssTot;
  return { intercept, slope, rSquared };
}

/**
 * Multiple linear regression via normal equation: y = X * beta + epsilon
 * X columns should NOT include intercept (it is prepended internally).
 * Returns { weights (including intercept at index 0), rSquared }
 */
function multipleLinearRegression(X: number[][], y: number[]): {
  weights: number[];
  rSquared: number;
} {
  const n = y.length;
  if (n === 0 || X.length === 0 || X[0].length === 0) {
    return { weights: [], rSquared: 0 };
  }

  const k = X[0].length;
  // Build augmented matrix with intercept column
  const cols = k + 1;

  // X'X matrix
  const XtX: number[][] = Array.from({ length: cols }, () => new Array(cols).fill(0));
  const Xty: number[] = new Array(cols).fill(0);

  for (let i = 0; i < n; i++) {
    const row = [1, ...X[i]]; // prepend 1 for intercept
    for (let a = 0; a < cols; a++) {
      Xty[a] += row[a] * y[i];
      for (let b = 0; b < cols; b++) {
        XtX[a][b] += row[a] * row[b];
      }
    }
  }

  // Solve via Gaussian elimination with partial pivoting
  const aug: number[][] = XtX.map((r, i) => [...r, Xty[i]]);
  for (let col = 0; col < cols; col++) {
    let maxRow = col;
    let maxVal = Math.abs(aug[col][col]);
    for (let row = col + 1; row < cols; row++) {
      if (Math.abs(aug[row][col]) > maxVal) {
        maxVal = Math.abs(aug[row][col]);
        maxRow = row;
      }
    }
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];

    const pivot = aug[col][col];
    if (Math.abs(pivot) < 1e-12) continue;

    for (let row = col + 1; row < cols; row++) {
      const factor = aug[row][col] / pivot;
      for (let j = col; j <= cols; j++) {
        aug[row][j] -= factor * aug[col][j];
      }
    }
  }

  // Back substitution
  const weights = new Array(cols).fill(0);
  for (let i = cols - 1; i >= 0; i--) {
    if (Math.abs(aug[i][i]) < 1e-12) continue;
    let sum = aug[i][cols];
    for (let j = i + 1; j < cols; j++) {
      sum -= aug[i][j] * weights[j];
    }
    weights[i] = sum / aug[i][i];
  }

  // R-squared
  const my = mean(y);
  let ssTot = 0;
  let ssRes = 0;
  for (let i = 0; i < n; i++) {
    const row = [1, ...X[i]];
    let predicted = 0;
    for (let j = 0; j < cols; j++) {
      predicted += row[j] * weights[j];
    }
    ssRes += (y[i] - predicted) ** 2;
    ssTot += (y[i] - my) ** 2;
  }
  const rSquared = ssTot === 0 ? 0 : 1 - ssRes / ssTot;

  return { weights, rSquared };
}

// ─── Extract returns from performance data ──────────────────────────────────

function extractReturns(data: any[]): number[] {
  if (!Array.isArray(data) || data.length === 0) return [];

  // If numeric array, treat as raw returns
  if (typeof data[0] === 'number') return data as number[];

  // If objects with a return/value field
  return data.map((item: any) => {
    if (typeof item === 'number') return item;
    if (item && typeof item === 'object') {
      if ('return' in item) return Number(item.return) || 0;
      if ('value' in item) return Number(item.value) || 0;
      if ('pnl' in item) return Number(item.pnl) || 0;
    }
    return 0;
  });
}

function extractFactorReturns(factorData: any[]): number[] {
  return extractReturns(factorData);
}

// ─── Performance Attribution Engine ─────────────────────────────────────────

export class PerformanceAttributionEngine extends EventEmitter {
  private attributionHistory: AttributionResult[] = [];
  private factorModels: FactorModel[] = [];
  private factorExposures: Map<string, number> = new Map();
  private internalMetrics: InternalMetrics[] = [];
  private readonly riskFreeRate: number;
  private readonly annualizationFactor: number;

  constructor(options?: { riskFreeRate?: number; annualizationFactor?: number }) {
    super();
    this.riskFreeRate = options?.riskFreeRate ?? 0.02;
    this.annualizationFactor = options?.annualizationFactor ?? 252;
    log.info('[PerformanceAttributionEngine] Initialized', {
      riskFreeRate: this.riskFreeRate,
      annualizationFactor: this.annualizationFactor,
    });
  }

  /**
   * Perform performance attribution: decompose strategy returns into
   * market (benchmark) contribution, alpha, and factor contributions.
   */
  attribute(performance: any[], benchmark: any[]): AttributionResult {
    log.info('[attribute] Starting attribution', {
      performanceLength: performance?.length,
      benchmarkLength: benchmark?.length,
    });

    const strategyReturns = extractReturns(performance);
    const benchmarkReturns = extractReturns(benchmark);

    // Align lengths
    const len = Math.min(strategyReturns.length, benchmarkReturns.length);
    const sr = strategyReturns.slice(0, len);
    const br = benchmarkReturns.slice(0, len);

    if (len < 2) {
      log.warn('[attribute] Insufficient data points for attribution', { len });
      const empty: AttributionResult = {
        totalReturn: 0,
        marketReturn: 0,
        alpha: 0,
        beta: 0,
        factorAttributions: [],
        sharpe: 0,
        sortino: 0,
        maxDrawdown: 0,
      };
      this.emit('attribution:empty', empty);
      return empty;
    }

    // Core metrics
    const totalReturn = compoundReturn(sr);
    const marketReturn = compoundReturn(br);

    // CAPM regression: strategy = alpha + beta * benchmark
    const reg = simpleLinearRegression(br, sr);
    const alpha = reg.intercept;
    const beta = reg.slope;

    // Risk metrics
    const sharpe = this.computeSharpe(sr);
    const sortino = this.computeSortino(sr);
    const maxDrawdown = computeMaxDrawdown(sr);

    // Factor attribution: attribute excess return to benchmark sensitivity
    const excessReturns = sr.map((r, i) => r - br[i]);
    const benchmarkContribution = beta * marketReturn;
    const alphaContribution = alpha * len; // annualized alpha contribution
    const residualContribution = totalReturn - benchmarkContribution - alphaContribution;

    const factorAttributions: { factor: string; contribution: number }[] = [
      { factor: 'market', contribution: benchmarkContribution },
      { factor: 'alpha', contribution: alphaContribution },
      { factor: 'residual', contribution: residualContribution },
    ];

    const result: AttributionResult = {
      totalReturn,
      marketReturn,
      alpha,
      beta,
      factorAttributions,
      sharpe,
      sortino,
      maxDrawdown,
    };

    // Store history
    this.attributionHistory.push(result);
    this.internalMetrics.push({ alpha, beta, rSquared: reg.rSquared });

    log.info('[attribute] Attribution complete', {
      totalReturn: totalReturn.toFixed(6),
      alpha: alpha.toFixed(6),
      beta: beta.toFixed(4),
      sharpe: sharpe.toFixed(4),
      maxDrawdown: maxDrawdown.toFixed(4),
    });

    this.emit('attribution:complete', result);
    return result;
  }

  /**
   * Fit a multi-factor model to performance data.
   * Uses multiple linear regression: performance = w0 + w1*f1 + w2*f2 + ... + epsilon
   */
  fitFactorModel(performance: any[], factors: any[][]): FactorModel {
    log.info('[fitFactorModel] Fitting factor model', {
      performanceLength: performance?.length,
      factorCount: factors?.length,
    });

    const strategyReturns = extractReturns(performance);

    if (!factors || factors.length === 0) {
      log.warn('[fitFactorModel] No factors provided');
      const empty: FactorModel = { factors: [], weights: [], rSquared: 0 };
      this.emit('factorModel:empty', empty);
      return empty;
    }

    // Extract returns for each factor
    const factorReturnsArrays: number[][] = factors.map(f => extractFactorReturns(f));

    // Align all to the same length
    const lengths = [strategyReturns.length, ...factorReturnsArrays.map(f => f.length)];
    const minLen = Math.min(...lengths);

    if (minLen < 2 + factors.length) {
      log.warn('[fitFactorModel] Insufficient data for factor model', {
        minLen,
        required: 2 + factors.length,
      });
      const empty: FactorModel = {
        factors: factors.map((_, i) => `factor_${i}`),
        weights: new Array(factors.length).fill(0),
        rSquared: 0,
      };
      this.emit('factorModel:empty', empty);
      return empty;
    }

    const y = strategyReturns.slice(0, minLen);

    // Build X matrix: each row is a time step, each column is a factor
    const X: number[][] = [];
    for (let t = 0; t < minLen; t++) {
      const row: number[] = [];
      for (let f = 0; f < factorReturnsArrays.length; f++) {
        row.push(factorReturnsArrays[f][t]);
      }
      X.push(row);
    }

    const regression = multipleLinearRegression(X, y);

    // Weights exclude intercept (index 0)
    const factorWeights = regression.weights.slice(1);
    const factorNames = factors.map((_, i) => `factor_${i}`);

    const model: FactorModel = {
      factors: factorNames,
      weights: factorWeights,
      rSquared: Math.max(0, Math.min(1, regression.rSquared)), // clamp to [0,1]
    };

    // Store model
    this.factorModels.push(model);

    // Update factor exposures
    for (let i = 0; i < factorNames.length; i++) {
      this.factorExposures.set(factorNames[i], factorWeights[i] ?? 0);
    }

    // Store internal metrics
    this.internalMetrics.push({
      alpha: regression.weights[0] ?? 0,
      beta: factorWeights.length > 0 ? factorWeights[0] : 0,
      rSquared: model.rSquared,
    });

    log.info('[fitFactorModel] Factor model fitted', {
      factorCount: factorNames.length,
      rSquared: model.rSquared.toFixed(4),
      weights: factorWeights.map(w => w.toFixed(4)),
    });

    this.emit('factorModel:fitted', model);
    return model;
  }

  /**
   * Get the current exposure (weight) for a named factor.
   * Returns 0 if the factor is not found.
   */
  getFactorExposure(factor: string): number {
    const exposure = this.factorExposures.get(factor) ?? 0;
    log.debug('[getFactorExposure]', { factor, exposure });
    return exposure;
  }

  /**
   * Get aggregate metrics across all attribution runs.
   */
  getMetrics(): { avgAlpha: number; avgBeta: number; avgRSquared: number } {
    if (this.internalMetrics.length === 0) {
      log.debug('[getMetrics] No metrics available');
      return { avgAlpha: 0, avgBeta: 0, avgRSquared: 0 };
    }

    const n = this.internalMetrics.length;
    const avgAlpha = this.internalMetrics.reduce((s, m) => s + m.alpha, 0) / n;
    const avgBeta = this.internalMetrics.reduce((s, m) => s + m.beta, 0) / n;
    const avgRSquared = this.internalMetrics.reduce((s, m) => s + m.rSquared, 0) / n;

    const result = { avgAlpha, avgBeta, avgRSquared };
    log.debug('[getMetrics]', {
      count: n,
      avgAlpha: avgAlpha.toFixed(6),
      avgBeta: avgBeta.toFixed(4),
      avgRSquared: avgRSquared.toFixed(4),
    });
    return result;
  }

  /**
   * Reset all stored history, models, and exposures.
   */
  reset(): void {
    log.info('[reset] Clearing all attribution data');
    this.attributionHistory = [];
    this.factorModels = [];
    this.factorExposures.clear();
    this.internalMetrics = [];
    this.emit('reset');
  }

  // ─── Private: Risk Metric Calculations ──────────────────────────────────

  /**
   * Annualized Sharpe ratio: (mean_return - rf) / stddev * sqrt(ann_factor)
   */
  private computeSharpe(returns: number[]): number {
    if (returns.length < 2) return 0;
    const dailyRf = this.riskFreeRate / this.annualizationFactor;
    const excessReturns = returns.map(r => r - dailyRf);
    const m = mean(excessReturns);
    const s = stddev(excessReturns);
    if (s === 0) return 0;
    return (m / s) * Math.sqrt(this.annualizationFactor);
  }

  /**
   * Annualized Sortino ratio: (mean_return - rf) / downside_dev * sqrt(ann_factor)
   */
  private computeSortino(returns: number[]): number {
    if (returns.length < 2) return 0;
    const dailyRf = this.riskFreeRate / this.annualizationFactor;
    const m = mean(returns) - dailyRf;
    const dd = downsideDeviation(returns, dailyRf);
    if (dd === 0) return 0;
    return (m / dd) * Math.sqrt(this.annualizationFactor);
  }

  // ─── Additional Utility Methods ─────────────────────────────────────────

  /**
   * Get the full attribution history.
   */
  getAttributionHistory(): ReadonlyArray<AttributionResult> {
    return [...this.attributionHistory];
  }

  /**
   * Get all fitted factor models.
   */
  getFactorModels(): ReadonlyArray<FactorModel> {
    return [...this.factorModels];
  }

  /**
   * Get the number of attribution runs performed.
   */
  getRunCount(): number {
    return this.attributionHistory.length;
  }

  /**
   * Compute rolling beta over a window.
   */
  computeRollingBeta(
    performance: any[],
    benchmark: any[],
    window: number = 21,
  ): number[] {
    const sr = extractReturns(performance);
    const br = extractReturns(benchmark);
    const len = Math.min(sr.length, br.length);
    const result: number[] = [];

    for (let i = window - 1; i < len; i++) {
      const windowSr = sr.slice(i - window + 1, i + 1);
      const windowBr = br.slice(i - window + 1, i + 1);
      const reg = simpleLinearRegression(windowBr, windowSr);
      result.push(reg.slope);
    }

    log.debug('[computeRollingBeta]', { window, resultLength: result.length });
    return result;
  }

  /**
   * Compute rolling Sharpe ratio over a window.
   */
  computeRollingSharpe(performance: any[], window: number = 21): number[] {
    const sr = extractReturns(performance);
    const result: number[] = [];

    for (let i = window - 1; i < sr.length; i++) {
      const windowReturns = sr.slice(i - window + 1, i + 1);
      result.push(this.computeSharpe(windowReturns));
    }

    log.debug('[computeRollingSharpe]', { window, resultLength: result.length });
    return result;
  }

  /**
   * Compute information ratio: (portfolio_return - benchmark_return) / tracking_error
   */
  computeInformationRatio(performance: any[], benchmark: any[]): number {
    const sr = extractReturns(performance);
    const br = extractReturns(benchmark);
    const len = Math.min(sr.length, br.length);
    if (len < 2) return 0;

    const activeReturns = sr.slice(0, len).map((r, i) => r - br[i]);
    const trackingError = stddev(activeReturns);
    if (trackingError === 0) return 0;

    const annualizedActive = mean(activeReturns) * this.annualizationFactor;
    const annualizedTE = trackingError * Math.sqrt(this.annualizationFactor);
    return annualizedActive / annualizedTE;
  }

  /**
   * Compute Calmar ratio: annualized return / max drawdown
   */
  computeCalmarRatio(performance: any[]): number {
    const sr = extractReturns(performance);
    if (sr.length < 2) return 0;
    const annualizedReturn = mean(sr) * this.annualizationFactor;
    const mdd = computeMaxDrawdown(sr);
    if (mdd === 0) return 0;
    return annualizedReturn / mdd;
  }

  /**
   * Decompose returns into systematic and idiosyncratic components
   * given a benchmark.
   */
  decomposeReturns(
    performance: any[],
    benchmark: any[],
  ): { systematic: number[]; idiosyncratic: number[] } {
    const sr = extractReturns(performance);
    const br = extractReturns(benchmark);
    const len = Math.min(sr.length, br.length);
    if (len < 2) return { systematic: [], idiosyncratic: [] };

    const reg = simpleLinearRegression(br.slice(0, len), sr.slice(0, len));

    const systematic: number[] = [];
    const idiosyncratic: number[] = [];

    for (let i = 0; i < len; i++) {
      const sys = reg.intercept + reg.slope * br[i];
      systematic.push(sys);
      idiosyncratic.push(sr[i] - sys);
    }

    return { systematic, idiosyncratic };
  }

  /**
   * Compute tail ratio: |95th percentile return| / |5th percentile return|
   * Values > 1 indicate fatter right tail (desirable).
   */
  computeTailRatio(performance: any[]): number {
    const sr = extractReturns(performance).slice().sort((a, b) => a - b);
    if (sr.length < 20) return 0;

    const p5 = sr[Math.floor(sr.length * 0.05)];
    const p95 = sr[Math.floor(sr.length * 0.95)];

    if (p5 === 0) return 0;
    return Math.abs(p95) / Math.abs(p5);
  }

  /**
   * Compute win rate: percentage of positive-return periods.
   */
  computeWinRate(performance: any[]): number {
    const sr = extractReturns(performance);
    if (sr.length === 0) return 0;
    const wins = sr.filter(r => r > 0).length;
    return wins / sr.length;
  }

  /**
   * Compute profit factor: gross profit / gross loss.
   */
  computeProfitFactor(performance: any[]): number {
    const sr = extractReturns(performance);
    const grossProfit = sr.filter(r => r > 0).reduce((s, r) => s + r, 0);
    const grossLoss = Math.abs(sr.filter(r => r < 0).reduce((s, r) => s + r, 0));
    if (grossLoss === 0) return grossProfit > 0 ? Infinity : 0;
    return grossProfit / grossLoss;
  }
}

// ─── Default Export ─────────────────────────────────────────────────────────

export default PerformanceAttributionEngine;

/**
 * JVS-100: Monte Carlo Simulator
 * Simulate portfolio outcomes with probability distributions.
 *
 * Features:
 *  - Geometric Brownian Motion path generation
 *  - Normal, Lognormal, and Fat-tail (Student-t) distributions
 *  - VaR / CVaR computation at 95% confidence
 *  - Per-path max drawdown tracking
 *  - Scenario comparison and sensitivity analysis
 *  - Seedable PRNG (Mulberry32) for reproducibility
 */

import log from 'electron-log';

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface SimConfig {
  initialCapital: number;
  expectedReturn: number;
  volatility: number;
  horizon: number;
  simulations: number;
  distribution: 'normal' | 'lognormal' | 'fat_tail';
  riskFreeRate: number;
}

export interface SimStatistics {
  mean: number;
  median: number;
  stdDev: number;
  percentile5: number;
  percentile25: number;
  percentile75: number;
  percentile95: number;
  min: number;
  max: number;
}

export interface SimResult {
  finalValues: number[];
  statistics: SimStatistics;
  var95: number;
  cvar95: number;
  probabilityOfProfit: number;
  probabilityOfLoss10pct: number;
  maxDrawdowns: number[];
  equityCurves: number[][];
  durationMs: number;
}

export interface PathResult {
  path: number[];
  finalValue: number;
  maxDrawdown: number;
  totalReturn: number;
}

export interface ScenarioResult {
  name: string;
  config: Partial<SimConfig>;
  result: SimResult;
}

export interface ScenarioComparison {
  scenarios: ScenarioResult[];
  best: string;
  worst: string;
  comparison: Record<string, number>;
}

export interface SensitivityPoint {
  param: number;
  mean: number;
  var95: number;
  probProfit: number;
}

// ─── Seedable PRNG (Mulberry32) ───────────────────────────────────────────────

/**
 * Mulberry32 – fast 32-bit seeded PRNG.
 * Returns a function that produces values in [0, 1).
 */
function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── MonteCarloSimulator ──────────────────────────────────────────────────────

export class MonteCarloSimulator {
  private rng: () => number;
  private seed: number;

  /**
   * @param seed  Optional seed for reproducibility. Defaults to a random value.
   */
  constructor(seed?: number) {
    this.seed = seed ?? Math.floor(Math.random() * 2 ** 31);
    this.rng = mulberry32(this.seed);
    log.info(`[MonteCarloSimulator] Initialised with seed=${this.seed}`);
  }

  // ─── Random Number Generators ─────────────────────────────────────────────

  /**
   * Box-Muller transform – generates standard normal variates N(0,1).
   */
  randomNormal(): number {
    let u1 = this.rng();
    let u2 = this.rng();
    // Guard against log(0)
    while (u1 === 0) {
      u1 = this.rng();
    }
    const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return z;
  }

  /**
   * Student-t approximation via ratio of normal to chi-squared.
   * Uses df=5 for moderate fat tails (kurtosis ≈ 6).
   */
  randomFatTail(): number {
    const df = 5;
    const z = this.randomNormal();
    // Generate chi-squared(df) via sum of squared normals
    let chi2 = 0;
    for (let i = 0; i < df; i++) {
      const n = this.randomNormal();
      chi2 += n * n;
    }
    // t = z / sqrt(chi2 / df)
    const t = z / Math.sqrt(chi2 / df);
    return t;
  }

  /**
   * Generate a lognormal return: exp(mu + sigma * Z).
   */
  private randomLognormal(mu: number, sigma: number): number {
    const z = this.randomNormal();
    return Math.exp(mu + sigma * z);
  }

  /**
   * Reset the PRNG to a new or existing seed for reproducibility.
   */
  reseed(seed: number): void {
    this.seed = seed;
    this.rng = mulberry32(this.seed);
    log.info(`[MonteCarloSimulator] Reseeded to ${this.seed}`);
  }

  /**
   * Get the current seed value.
   */
  getSeed(): number {
    return this.seed;
  }

  // ─── Path Generation ──────────────────────────────────────────────────────

  /**
   * Generate a single price path using Geometric Brownian Motion.
   *
   * @param S0     Initial price / capital
   * @param mu     Annualised expected return (drift)
   * @param sigma  Annualised volatility
   * @param dt     Time step in years (e.g. 1/252 for daily)
   * @param steps  Number of steps to simulate
   * @returns      Array of portfolio values at each step (length = steps + 1)
   */
  geometricBrownianMotion(
    S0: number,
    mu: number,
    sigma: number,
    dt: number,
    steps: number,
  ): number[] {
    const path: number[] = new Array(steps + 1);
    path[0] = S0;

    const drift = (mu - 0.5 * sigma * sigma) * dt;
    const diffusion = sigma * Math.sqrt(dt);

    for (let t = 1; t <= steps; t++) {
      const z = this.randomNormal();
      const logReturn = drift + diffusion * z;
      path[t] = path[t - 1] * Math.exp(logReturn);
    }

    return path;
  }

  /**
   * Generate a single path using the configured distribution.
   */
  private generateSinglePath(
    config: SimConfig,
    steps: number,
    dt: number,
  ): PathResult {
    const { initialCapital, expectedReturn, volatility, distribution } = config;

    const path: number[] = new Array(steps + 1);
    path[0] = initialCapital;

    const drift = (expectedReturn - 0.5 * volatility * volatility) * dt;
    const diffusion = volatility * Math.sqrt(dt);

    for (let t = 1; t <= steps; t++) {
      let z: number;

      switch (distribution) {
        case 'normal':
          z = this.randomNormal();
          break;
        case 'lognormal': {
          // Use lognormal multiplicative return directly
          const lnReturn = this.randomLognormal(drift, diffusion);
          path[t] = path[t - 1] * lnReturn;
          continue; // skip the standard GBM step below
        }
        case 'fat_tail':
          z = this.randomFatTail();
          break;
        default:
          z = this.randomNormal();
          break;
      }

      const logReturn = drift + diffusion * z;
      path[t] = path[t - 1] * Math.exp(logReturn);
    }

    const finalValue = path[steps];
    const maxDrawdown = this.computeMaxDrawdown(path);
    const totalReturn = (finalValue - initialCapital) / initialCapital;

    return { path, finalValue, maxDrawdown, totalReturn };
  }

  /**
   * Generate all simulation paths.
   */
  generatePaths(config: SimConfig): PathResult[] {
    const { simulations, horizon } = config;
    const steps = Math.round(horizon);
    const dt = 1.0; // Each step = 1 year (or adjust as needed)

    log.info(
      `[MonteCarloSimulator] Generating ${simulations} paths, ` +
        `${steps} steps each, distribution=${config.distribution}`,
    );

    const paths: PathResult[] = new Array(simulations);

    for (let i = 0; i < simulations; i++) {
      paths[i] = this.generateSinglePath(config, steps, dt);
    }

    return paths;
  }

  // ─── Full Simulation ──────────────────────────────────────────────────────

  /**
   * Run a full Monte Carlo simulation.
   */
  simulate(config: SimConfig): SimResult {
    const startTime = performance.now();

    log.info(
      `[MonteCarloSimulator] Starting simulation: ` +
        `capital=${config.initialCapital}, return=${config.expectedReturn}, ` +
        `vol=${config.volatility}, horizon=${config.horizon}, ` +
        `sims=${config.simulations}, dist=${config.distribution}`,
    );

    // Validate config
    this.validateConfig(config);

    const pathResults = this.generatePaths(config);
    const n = pathResults.length;

    // Extract final values
    const finalValues: number[] = new Array(n);
    const maxDrawdowns: number[] = new Array(n);
    const equityCurves: number[][] = new Array(n);

    for (let i = 0; i < n; i++) {
      finalValues[i] = pathResults[i].finalValue;
      maxDrawdowns[i] = pathResults[i].maxDrawdown;
      equityCurves[i] = pathResults[i].path;
    }

    // Compute statistics
    const statistics = this.computeStatistics(finalValues);

    // VaR and CVaR
    const losses = this.computeLosses(finalValues, config.initialCapital);
    const var95 = this.computeVaR(losses, 0.95);
    const cvar95 = this.computeCVaR(losses, 0.95);

    // Probability metrics
    const profitCount = finalValues.filter((v) => v > config.initialCapital).length;
    const loss10Threshold = config.initialCapital * 0.9;
    const loss10Count = finalValues.filter((v) => v < loss10Threshold).length;

    const probabilityOfProfit = profitCount / n;
    const probabilityOfLoss10pct = loss10Count / n;

    const durationMs = performance.now() - startTime;

    log.info(
      `[MonteCarloSimulator] Simulation complete in ${durationMs.toFixed(1)}ms: ` +
        `mean=${statistics.mean.toFixed(2)}, median=${statistics.median.toFixed(2)}, ` +
        `VaR95=${var95.toFixed(4)}, CVaR95=${cvar95.toFixed(4)}, ` +
        `P(profit)=${(probabilityOfProfit * 100).toFixed(1)}%`,
    );

    return {
      finalValues,
      statistics,
      var95,
      cvar95,
      probabilityOfProfit,
      probabilityOfLoss10pct,
      maxDrawdowns,
      equityCurves,
      durationMs,
    };
  }

  // ─── Scenario Comparison ──────────────────────────────────────────────────

  /**
   * Compare multiple scenario results and identify best/worst by mean outcome.
   */
  compareScenarios(scenarios: ScenarioResult[]): ScenarioComparison {
    if (scenarios.length === 0) {
      throw new Error('[MonteCarloSimulator] No scenarios to compare');
    }

    log.info(`[MonteCarloSimulator] Comparing ${scenarios.length} scenarios`);

    const comparison: Record<string, number> = {};
    let bestName = scenarios[0].name;
    let bestMean = scenarios[0].result.statistics.mean;
    let worstName = scenarios[0].name;
    let worstMean = scenarios[0].result.statistics.mean;

    for (const scenario of scenarios) {
      const mean = scenario.result.statistics.mean;
      comparison[scenario.name] = mean;

      if (mean > bestMean) {
        bestMean = mean;
        bestName = scenario.name;
      }
      if (mean < worstMean) {
        worstMean = mean;
        worstName = scenario.name;
      }
    }

    log.info(
      `[MonteCarloSimulator] Best scenario: "${bestName}" (mean=${bestMean.toFixed(2)}), ` +
        `Worst scenario: "${worstName}" (mean=${worstMean.toFixed(2)})`,
    );

    return { scenarios, best: bestName, worst: worstName, comparison };
  }

  // ─── Sensitivity Analysis ─────────────────────────────────────────────────

  /**
   * Vary a single parameter and observe impact on key metrics.
   *
   * @param baseConfig  Base simulation config
   * @param paramName   Name of the SimConfig numeric field to vary
   * @param values      Array of values to test for that parameter
   */
  sensitivityAnalysis(
    baseConfig: SimConfig,
    paramName: string,
    values: number[],
  ): SensitivityPoint[] {
    log.info(
      `[MonteCarloSimulator] Sensitivity analysis on "${paramName}" ` +
        `with ${values.length} values`,
    );

    const validParams = [
      'initialCapital',
      'expectedReturn',
      'volatility',
      'horizon',
      'simulations',
      'riskFreeRate',
    ];

    if (!validParams.includes(paramName)) {
      throw new Error(
        `[MonteCarloSimulator] Invalid parameter "${paramName}". ` +
          `Valid: ${validParams.join(', ')}`,
      );
    }

    const results: SensitivityPoint[] = [];

    for (const val of values) {
      // Reset seed for each run so the only variable is the parameter
      this.reseed(this.seed);

      const modifiedConfig: SimConfig = {
        ...baseConfig,
        [paramName]: val,
      };

      const result = this.simulate(modifiedConfig);

      results.push({
        param: val,
        mean: result.statistics.mean,
        var95: result.var95,
        probProfit: result.probabilityOfProfit,
      });
    }

    return results;
  }

  // ─── Statistical Helpers ───────────────────────────────────────────────────

  /**
   * Compute descriptive statistics for an array of values.
   */
  private computeStatistics(values: number[]): SimStatistics {
    const sorted = [...values].sort((a, b) => a - b);
    const n = sorted.length;

    const mean = sorted.reduce((s, v) => s + v, 0) / n;
    const median = this.percentile(sorted, 0.5);
    const variance =
      sorted.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1);
    const stdDev = Math.sqrt(variance);

    return {
      mean,
      median,
      stdDev,
      percentile5: this.percentile(sorted, 0.05),
      percentile25: this.percentile(sorted, 0.25),
      percentile75: this.percentile(sorted, 0.75),
      percentile95: this.percentile(sorted, 0.95),
      min: sorted[0],
      max: sorted[n - 1],
    };
  }

  /**
   * Linear interpolation percentile on a **sorted** array.
   */
  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    if (sorted.length === 1) return sorted[0];

    const idx = p * (sorted.length - 1);
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    const frac = idx - lo;

    if (lo === hi) return sorted[lo];
    return sorted[lo] * (1 - frac) + sorted[hi] * frac;
  }

  /**
   * Compute losses as negative returns (as positive numbers).
   * loss = max(0, initialCapital - finalValue) / initialCapital
   */
  private computeLosses(finalValues: number[], initialCapital: number): number[] {
    return finalValues.map((v) => {
      const ret = (v - initialCapital) / initialCapital;
      return -ret; // positive = loss, negative = gain
    });
  }

  /**
   * Value at Risk at the given confidence level.
   * VaR is the loss threshold that is not exceeded with probability `confidence`.
   *
   * @param losses      Array of loss values (positive = loss)
   * @param confidence  Confidence level (e.g. 0.95)
   */
  private computeVaR(losses: number[], confidence: number): number {
    const sorted = [...losses].sort((a, b) => a - b);
    return this.percentile(sorted, confidence);
  }

  /**
   * Conditional Value at Risk (Expected Shortfall) at the given confidence level.
   * CVaR = average of losses exceeding VaR.
   *
   * @param losses      Array of loss values (positive = loss)
   * @param confidence  Confidence level (e.g. 0.95)
   */
  private computeCVaR(losses: number[], confidence: number): number {
    const sorted = [...losses].sort((a, b) => a - b);
    const varThreshold = this.computeVaR(losses, confidence);

    // Average all losses >= VaR
    const tailLosses = sorted.filter((l) => l >= varThreshold);
    if (tailLosses.length === 0) return varThreshold;

    return tailLosses.reduce((s, v) => s + v, 0) / tailLosses.length;
  }

  /**
   * Compute maximum drawdown for a price path.
   * Drawdown = (peak - trough) / peak, reported as a positive fraction.
   */
  private computeMaxDrawdown(path: number[]): number {
    if (path.length < 2) return 0;

    let peak = path[0];
    let maxDD = 0;

    for (let i = 1; i < path.length; i++) {
      if (path[i] > peak) {
        peak = path[i];
      }
      const dd = (peak - path[i]) / peak;
      if (dd > maxDD) {
        maxDD = dd;
      }
    }

    return maxDD;
  }

  // ─── Config Validation ────────────────────────────────────────────────────

  /**
   * Validate simulation configuration parameters.
   */
  private validateConfig(config: SimConfig): void {
    if (config.initialCapital <= 0) {
      throw new Error(
        `[MonteCarloSimulator] initialCapital must be > 0, got ${config.initialCapital}`,
      );
    }
    if (config.volatility < 0) {
      throw new Error(
        `[MonteCarloSimulator] volatility must be >= 0, got ${config.volatility}`,
      );
    }
    if (config.horizon <= 0) {
      throw new Error(
        `[MonteCarloSimulator] horizon must be > 0, got ${config.horizon}`,
      );
    }
    if (config.simulations < 1) {
      throw new Error(
        `[MonteCarloSimulator] simulations must be >= 1, got ${config.simulations}`,
      );
    }
    if (config.simulations > 1_000_000) {
      log.warn(
        `[MonteCarloSimulator] Very large simulation count: ${config.simulations}. ` +
          `This may take a while.`,
      );
    }
    const validDist = ['normal', 'lognormal', 'fat_tail'];
    if (!validDist.includes(config.distribution)) {
      throw new Error(
        `[MonteCarloSimulator] Invalid distribution "${config.distribution}". ` +
          `Valid: ${validDist.join(', ')}`,
      );
    }
  }

  // ─── Utility: Sharpe Ratio ────────────────────────────────────────────────

  /**
   * Compute the annualised Sharpe ratio from simulation results.
   */
  computeSharpeRatio(result: SimResult, riskFreeRate: number): number {
    const excessReturn = result.statistics.mean - riskFreeRate;
    if (result.statistics.stdDev === 0) return 0;
    return excessReturn / result.statistics.stdDev;
  }

  // ─── Utility: Sortino Ratio ───────────────────────────────────────────────

  /**
   * Compute the Sortino ratio using only downside deviation.
   */
  computeSortinoRatio(
    finalValues: number[],
    initialCapital: number,
    riskFreeRate: number,
  ): number {
    const returns = finalValues.map(
      (v) => (v - initialCapital) / initialCapital,
    );
    const meanReturn =
      returns.reduce((s, r) => s + r, 0) / returns.length;
    const excessReturn = meanReturn - riskFreeRate;

    // Downside deviation: only negative returns
    const downsideReturns = returns.filter((r) => r < riskFreeRate);
    if (downsideReturns.length === 0) return Infinity;

    const downsideVariance =
      downsideReturns.reduce(
        (s, r) => s + (r - riskFreeRate) ** 2,
        0,
      ) / downsideReturns.length;
    const downsideDev = Math.sqrt(downsideVariance);

    if (downsideDev === 0) return 0;
    return excessReturn / downsideDev;
  }

  // ─── Utility: Convergence Check ───────────────────────────────────────────

  /**
   * Check whether the simulation has converged by comparing
   * rolling means of batches. Returns the coefficient of variation
   * across batch means (lower = more converged).
   */
  convergenceCheck(finalValues: number[], batchSize?: number): number {
    const n = finalValues.length;
    const bs = batchSize ?? Math.max(1, Math.floor(n / 10));
    const numBatches = Math.floor(n / bs);

    if (numBatches < 2) {
      log.warn('[MonteCarloSimulator] Not enough data for convergence check');
      return Infinity;
    }

    const batchMeans: number[] = [];
    for (let i = 0; i < numBatches; i++) {
      const start = i * bs;
      let sum = 0;
      for (let j = start; j < start + bs; j++) {
        sum += finalValues[j];
      }
      batchMeans.push(sum / bs);
    }

    const overallMean =
      batchMeans.reduce((s, m) => s + m, 0) / batchMeans.length;
    const variance =
      batchMeans.reduce((s, m) => s + (m - overallMean) ** 2, 0) /
      (batchMeans.length - 1);
    const cv = Math.sqrt(variance) / Math.abs(overallMean);

    log.info(
      `[MonteCarloSimulator] Convergence check: ${numBatches} batches, ` +
        `CV=${cv.toFixed(6)}`,
    );

    return cv;
  }

  // ─── Utility: Confidence Interval ─────────────────────────────────────────

  /**
   * Compute a confidence interval for the mean using the CLT.
   *
   * @param confidence  Confidence level (e.g. 0.95)
   */
  confidenceInterval(
    finalValues: number[],
    confidence: number = 0.95,
  ): { lower: number; upper: number; margin: number } {
    const n = finalValues.length;
    const mean = finalValues.reduce((s, v) => s + v, 0) / n;
    const variance =
      finalValues.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1);
    const se = Math.sqrt(variance / n);

    // z-score approximation for common confidence levels
    const zMap: Record<number, number> = {
      0.9: 1.645,
      0.95: 1.96,
      0.99: 2.576,
    };
    const z = zMap[confidence] ?? 1.96;

    const margin = z * se;
    return {
      lower: mean - margin,
      upper: mean + margin,
      margin,
    };
  }

  // ─── Utility: Histogram ───────────────────────────────────────────────────

  /**
   * Build a histogram of final values for visualisation.
   *
   * @param bins  Number of bins (default 50)
   */
  histogram(
    finalValues: number[],
    bins: number = 50,
  ): { binEdges: number[]; counts: number[]; densities: number[] } {
    const sorted = [...finalValues].sort((a, b) => a - b);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const range = max - min;

    if (range === 0) {
      return {
        binEdges: [min, min],
        counts: [finalValues.length],
        densities: [1],
      };
    }

    const binWidth = range / bins;
    const binEdges: number[] = new Array(bins + 1);
    for (let i = 0; i <= bins; i++) {
      binEdges[i] = min + i * binWidth;
    }

    const counts: number[] = new Array(bins).fill(0);
    for (const v of finalValues) {
      let idx = Math.floor((v - min) / binWidth);
      if (idx >= bins) idx = bins - 1;
      counts[idx]++;
    }

    const total = finalValues.length;
    const densities = counts.map((c) => c / (total * binWidth));

    return { binEdges, counts, densities };
  }
}

// ─── Default export & convenience factory ─────────────────────────────────────

export default MonteCarloSimulator;

/**
 * Convenience factory to create a simulator with a specific seed.
 */
export function createSimulator(seed?: number): MonteCarloSimulator {
  return new MonteCarloSimulator(seed);
}

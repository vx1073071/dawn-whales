/**
 * Volatility Models Engine
 * 
 * Implements historical volatility, EWMA, Parkinson, Garman-Klass,
 * GARCH(1,1) fitting, forecasting, term structure, correlation,
 * and volatility cone calculations.
 * 
 * All math is implemented manually without external dependencies.
 * Annualization uses sqrt(252) trading days convention.
 */

import log from 'electron-log';
import { normalCDF } from '../utils/math';

// =============================================================================
// Interfaces
// =============================================================================

export interface VolatilityResult {
  value: number;
  type: string;
  annualized: boolean;
  window?: number;
  confidence?: number;
}

export interface GARCHParams {
  omega: number;
  alpha: number;
  beta: number;
  returns: number[];
}

export interface GARCHResult {
  forecasts: number[];
  fittedValues: number[];
  residuals: number[];
  params: { omega: number; alpha: number; beta: number };
  logLikelihood: number;
  aic: number;
  bic: number;
}

export interface VolSurface {
  date: string;
  underlying: number;
  points: {
    strike: number;
    expiry: string;
    iv: number;
    delta: number;
  }[];
}

// =============================================================================
// Constants
// =============================================================================

const TRADING_DAYS_PER_YEAR = 252;
const SQRT_252 = Math.sqrt(TRADING_DAYS_PER_YEAR);
const TWO_PI = 2 * Math.PI;
const LOG_TWO_PI = Math.log(TWO_PI);

// Default GARCH(1,1) parameters for initialization
const DEFAULT_OMEGA = 0.000002;
const DEFAULT_ALPHA = 0.09;
const DEFAULT_BETA = 0.88;

// Optimization step sizes
const GRADIENT_STEP = 1e-6;
const MAX_ITERATIONS = 500;
const CONVERGENCE_TOL = 1e-8;

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Compute the arithmetic mean of an array of numbers.
 */
function mean(arr: number[]): number {
  if (arr.length === 0) {
    return 0;
  }
  let sum = 0;
  for (let i = 0; i < arr.length; i++) {
    sum += arr[i];
  }
  return sum / arr.length;
}

/**
 * Compute sample variance of an array.
 */
function variance(arr: number[]): number {
  if (arr.length < 2) {
    return 0;
  }
  const m = mean(arr);
  let sumSq = 0;
  for (let i = 0; i < arr.length; i++) {
    const diff = arr[i] - m;
    sumSq += diff * diff;
  }
  return sumSq / (arr.length - 1);
}

/**
 * Compute sample standard deviation.
 */
function stdDev(arr: number[]): number {
  return Math.sqrt(variance(arr));
}

/**
 * Compute the natural log returns from a price series.
 */
function logReturns(prices: number[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    if (prices[i - 1] > 0) {
      returns.push(Math.log(prices[i] / prices[i - 1]));
    } else {
      returns.push(0);
    }
  }
  return returns;
}

/**
 * Compute the standard normal CDF using Abramowitz & Stegun approximation.
 * Accurate to ~1.5e-7.
 */

/**
 * Compute the standard normal PDF.
 */
function normalPDF(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(TWO_PI);
}

/**
 * Compute quantile (percentile) of a sorted array using linear interpolation.
 */
function quantile(sortedArr: number[], q: number): number {
  if (sortedArr.length === 0) return 0;
  if (sortedArr.length === 1) return sortedArr[0];

  const pos = q * (sortedArr.length - 1);
  const lower = Math.floor(pos);
  const upper = Math.ceil(pos);
  const frac = pos - lower;

  if (lower === upper) {
    return sortedArr[lower];
  }
  return sortedArr[lower] * (1 - frac) + sortedArr[upper] * frac;
}

/**
 * Sort an array of numbers in ascending order (non-mutating).
 */
function sortedCopy(arr: number[]): number[] {
  return [...arr].sort((a, b) => a - b);
}

/**
 * Compute the covariance between two arrays.
 */
function covariance(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 2) return 0;

  const mx = mean(x.slice(0, n));
  const my = mean(y.slice(0, n));

  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += (x[i] - mx) * (y[i] - my);
  }
  return sum / (n - 1);
}

/**
 * Compute the Pearson correlation coefficient between two arrays.
 */
function correlation(x: number[], y: number[]): number {
  const sx = stdDev(x);
  const sy = stdDev(y);
  if (sx === 0 || sy === 0) return 0;
  return covariance(x, y) / (sx * sy);
}

/**
 * Black-Scholes implied volatility approximation using Newton-Raphson.
 * Used internally for VolSurface calculations.
 */
function blackScholesCallPrice(S: number, K: number, T: number, r: number, sigma: number): number {
  if (T <= 0 || sigma <= 0) {
    return Math.max(S - K, 0);
  }
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  return S * normalCDF(d1) - K * Math.exp(-r * T) * normalCDF(d2);
}

/**
 * Black-Scholes vega (derivative of price w.r.t. volatility).
 */
function blackScholesVega(S: number, K: number, T: number, r: number, sigma: number): number {
  if (T <= 0 || sigma <= 0) return 0;
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
  return S * normalPDF(d1) * Math.sqrt(T);
}

/**
 * Black-Scholes delta for a call option.
 */
function blackScholesDelta(S: number, K: number, T: number, r: number, sigma: number): number {
  if (T <= 0 || sigma <= 0) {
    return S > K ? 1 : 0;
  }
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
  return normalCDF(d1);
}

/**
 * Compute implied volatility using Newton-Raphson iteration.
 */
function impliedVolatility(
  marketPrice: number,
  S: number,
  K: number,
  T: number,
  r: number,
  maxIter: number = 100,
  tol: number = 1e-8
): number {
  // Initial guess using Brenner-Subrahmanyam approximation
  let sigma = Math.sqrt(TWO_PI / T) * (marketPrice / S);
  if (sigma <= 0 || !isFinite(sigma)) {
    sigma = 0.2;
  }

  for (let i = 0; i < maxIter; i++) {
    const price = blackScholesCallPrice(S, K, T, r, sigma);
    const vega = blackScholesVega(S, K, T, r, sigma);

    if (Math.abs(vega) < 1e-12) break;

    const diff = price - marketPrice;
    if (Math.abs(diff) < tol) break;

    sigma -= diff / vega;

    // Clamp sigma to reasonable range
    if (sigma <= 0.001) sigma = 0.001;
    if (sigma > 5.0) sigma = 5.0;
  }

  return sigma;
}

// =============================================================================
// GARCH(1,1) Log-Likelihood and Optimization
// =============================================================================

/**
 * Compute the log-likelihood of GARCH(1,1) given parameters and returns.
 * 
 * The GARCH(1,1) model:
 *   sigma_t^2 = omega + alpha * r_{t-1}^2 + beta * sigma_{t-1}^2
 * 
 * Log-likelihood:
 *   L = -0.5 * sum( log(sigma_t^2) + r_t^2 / sigma_t^2 + log(2*pi) )
 */
function garchLogLikelihood(
  omega: number,
  alpha: number,
  beta: number,
  returns: number[]
): { likelihood: number; sigmas: number[] } {
  const n = returns.length;
  if (n < 2) {
    return { likelihood: -Infinity, sigmas: [] };
  }

  // Initialize with sample variance
  const sampleVar = variance(returns);
  let sigma2 = sampleVar > 0 ? sampleVar : 1e-8;

  const sigmas: number[] = [Math.sqrt(sigma2)];
  let logL = 0;

  // First observation contribution
  logL += -0.5 * (LOG_TWO_PI + Math.log(sigma2) + (returns[0] * returns[0]) / sigma2);

  for (let t = 1; t < n; t++) {
    // GARCH(1,1) variance update
    sigma2 = omega + alpha * returns[t - 1] * returns[t - 1] + beta * sigma2;

    // Enforce positivity and stationarity
    if (sigma2 < 1e-12) sigma2 = 1e-12;
    if (sigma2 > 100) sigma2 = 100;

    sigmas.push(Math.sqrt(sigma2));

    logL += -0.5 * (LOG_TWO_PI + Math.log(sigma2) + (returns[t] * returns[t]) / sigma2);
  }

  if (!isFinite(logL)) {
    logL = -1e15;
  }

  return { likelihood: logL, sigmas };
}

/**
 * Compute numerical gradient of the GARCH log-likelihood.
 */
function garchGradient(
  omega: number,
  alpha: number,
  beta: number,
  returns: number[]
): [number, number, number] {
  const base = garchLogLikelihood(omega, alpha, beta, returns).likelihood;

  const lOmega = garchLogLikelihood(omega + GRADIENT_STEP, alpha, beta, returns).likelihood;
  const lAlpha = garchLogLikelihood(omega, alpha + GRADIENT_STEP, beta, returns).likelihood;
  const lBeta = garchLogLikelihood(omega, alpha, beta + GRADIENT_STEP, returns).likelihood;

  return [
    (lOmega - base) / GRADIENT_STEP,
    (lAlpha - base) / GRADIENT_STEP,
    (lBeta - base) / GRADIENT_STEP
  ];
}

/**
 * Project GARCH parameters to feasible region.
 * Constraints: omega > 0, alpha >= 0, beta >= 0, alpha + beta < 1
 */
function projectParams(omega: number, alpha: number, beta: number): [number, number, number] {
  // Enforce positivity
  let w = Math.max(omega, 1e-10);
  let a = Math.max(alpha, 1e-8);
  let b = Math.max(beta, 1e-8);

  // Enforce stationarity: alpha + beta < 1
  const sum = a + b;
  if (sum >= 0.9999) {
    const scale = 0.9999 / sum;
    a *= scale;
    b *= scale;
  }

  return [w, a, b];
}

/**
 * Fit GARCH(1,1) parameters using gradient ascent with Armijo line search.
 */
function fitGARCH11(
  returns: number[],
  initOmega: number,
  initAlpha: number,
  initBeta: number
): { omega: number; alpha: number; beta: number; logLikelihood: number; sigmas: number[] } {
  let [omega, alpha, beta] = projectParams(initOmega, initAlpha, initBeta);
  let bestResult = garchLogLikelihood(omega, alpha, beta, returns);
  let bestLogL = bestResult.likelihood;

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    const grad = garchGradient(omega, alpha, beta, returns);

    // Check gradient norm for convergence
    const gradNorm = Math.sqrt(grad[0] * grad[0] + grad[1] * grad[1] + grad[2] * grad[2]);
    if (gradNorm < CONVERGENCE_TOL) {
      log.debug(`GARCH(1,1) converged at iteration ${iter}, gradient norm: ${gradNorm}`);
      break;
    }

    // Armijo line search
    let stepSize = 1.0;
    const armijoC = 1e-4;
    const directionalDeriv = grad[0] * grad[0] + grad[1] * grad[1] + grad[2] * grad[2];

    let newOmega = omega;
    let newAlpha = alpha;
    let newBeta = beta;
    let newLogL = bestLogL;
    let found = false;

    for (let ls = 0; ls < 20; ls++) {
      const trialOmega = omega + stepSize * grad[0];
      const trialAlpha = alpha + stepSize * grad[1];
      const trialBeta = beta + stepSize * grad[2];

      const [pOmega, pAlpha, pBeta] = projectParams(trialOmega, trialAlpha, trialBeta);
      const trialResult = garchLogLikelihood(pOmega, pAlpha, pBeta, returns);

      // Armijo condition: f(x + s*d) >= f(x) + c * s * ||grad||^2
      if (trialResult.likelihood >= bestLogL + armijoC * stepSize * directionalDeriv) {
        newOmega = pOmega;
        newAlpha = pAlpha;
        newBeta = pBeta;
        newLogL = trialResult.likelihood;
        found = true;
        break;
      }

      stepSize *= 0.5;
    }

    if (!found) {
      // Try a small fixed step
      const tinyStep = 1e-5;
      const trialOmega = omega + tinyStep * grad[0];
      const trialAlpha = alpha + tinyStep * grad[1];
      const trialBeta = beta + tinyStep * grad[2];
      const [pOmega, pAlpha, pBeta] = projectParams(trialOmega, trialAlpha, trialBeta);
      const trialResult = garchLogLikelihood(pOmega, pAlpha, pBeta, returns);

      if (trialResult.likelihood > bestLogL) {
        newOmega = pOmega;
        newAlpha = pAlpha;
        newBeta = pBeta;
        newLogL = trialResult.likelihood;
      } else {
        log.debug(`GARCH(1,1) line search failed at iteration ${iter}, stopping.`);
        break;
      }
    }

    // Check convergence on parameter change
    const paramChange = Math.abs(newOmega - omega) + Math.abs(newAlpha - alpha) + Math.abs(newBeta - beta);
    omega = newOmega;
    alpha = newAlpha;
    beta = newBeta;
    bestLogL = newLogL;

    if (paramChange < CONVERGENCE_TOL) {
      log.debug(`GARCH(1,1) converged on parameters at iteration ${iter}`);
      break;
    }
  }

  const finalResult = garchLogLikelihood(omega, alpha, beta, returns);

  return {
    omega,
    alpha,
    beta,
    logLikelihood: finalResult.likelihood,
    sigmas: finalResult.sigmas
  };
}

// =============================================================================
// VolatilityModels Class
// =============================================================================

export class VolatilityModels {
  // ---------------------------------------------------------------------------
  // Historical Volatility
  // ---------------------------------------------------------------------------

  /**
   * Compute historical volatility as the standard deviation of log returns,
   * annualized by sqrt(252).
   * 
   * @param returns - Array of log returns (or simple returns treated as log returns)
   * @param window - Rolling window size. If omitted, uses full sample.
   * @returns VolatilityResult with annualized volatility
   */
  public historicalVol(returns: number[], window?: number): VolatilityResult {
    log.info(`Computing historical volatility, ${returns.length} observations, window=${window ?? 'full'}`);

    if (returns.length < 2) {
      log.warn('historicalVol: insufficient data (need >= 2 returns)');
      return {
        value: 0,
        type: 'historical',
        annualized: true,
        window: window ?? returns.length,
        confidence: 0
      };
    }

    const w = window ?? returns.length;
    const effectiveWindow = Math.min(w, returns.length);

    // Use the last `effectiveWindow` observations
    const subset = returns.slice(returns.length - effectiveWindow);
    const m = mean(subset);

    // Sample variance with Bessel's correction
    let sumSq = 0;
    for (let i = 0; i < subset.length; i++) {
      const diff = subset[i] - m;
      sumSq += diff * diff;
    }
    const sampleVar = subset.length > 1 ? sumSq / (subset.length - 1) : 0;
    const dailyVol = Math.sqrt(sampleVar);
    const annualizedVol = dailyVol * SQRT_252;

    // Approximate confidence interval using chi-squared distribution approximation
    // For large n: sqrt(2/(n-1)) gives approximate relative SE of std dev
    const n = subset.length;
    const relSE = n > 1 ? Math.sqrt(1 / (2 * (n - 1))) : 1;
    const confidence = Math.max(0, Math.min(1, 1 - 2 * relSE));

    log.info(`Historical vol: daily=${dailyVol.toFixed(6)}, annualized=${annualizedVol.toFixed(6)}, confidence=${confidence.toFixed(4)}`);

    return {
      value: annualizedVol,
      type: 'historical',
      annualized: true,
      window: effectiveWindow,
      confidence
    };
  }

  // ---------------------------------------------------------------------------
  // EWMA Volatility
  // ---------------------------------------------------------------------------

  /**
   * Compute exponentially weighted moving average (EWMA) volatility.
   * 
   * The EWMA variance is:
   *   sigma_t^2 = lambda * sigma_{t-1}^2 + (1 - lambda) * r_t^2
   * 
   * @param returns - Array of returns
   * @param lambda - Decay factor (default 0.94, RiskMetrics standard)
   * @returns VolatilityResult with annualized EWMA volatility
   */
  public ewmaVol(returns: number[], lambda: number = 0.94): VolatilityResult {
    log.info(`Computing EWMA volatility, ${returns.length} observations, lambda=${lambda}`);

    if (returns.length < 2) {
      log.warn('ewmaVol: insufficient data (need >= 2 returns)');
      return {
        value: 0,
        type: 'ewma',
        annualized: true,
        window: returns.length,
        confidence: 0
      };
    }

    // Validate lambda
    if (lambda <= 0 || lambda >= 1) {
      log.warn(`ewmaVol: lambda ${lambda} out of (0,1), clamping to 0.94`);
      lambda = 0.94;
    }

    // Initialize variance with first observation squared
    let sigma2 = returns[0] * returns[0];

    // Iterate through returns updating EWMA variance
    for (let t = 1; t < returns.length; t++) {
      sigma2 = lambda * sigma2 + (1 - lambda) * returns[t] * returns[t];
    }

    const dailyVol = Math.sqrt(sigma2);
    const annualizedVol = dailyVol * SQRT_252;

    // EWMA effective window ≈ 1 / (1 - lambda)
    const effectiveWindow = Math.round(1 / (1 - lambda));

    // Confidence approximation based on effective sample size
    const relSE = Math.sqrt(1 / (2 * Math.min(effectiveWindow, returns.length)));
    const confidence = Math.max(0, Math.min(1, 1 - 2 * relSE));

    log.info(`EWMA vol: daily=${dailyVol.toFixed(6)}, annualized=${annualizedVol.toFixed(6)}`);

    return {
      value: annualizedVol,
      type: 'ewma',
      annualized: true,
      window: Math.min(effectiveWindow, returns.length),
      confidence
    };
  }

  // ---------------------------------------------------------------------------
  // Parkinson Volatility
  // ---------------------------------------------------------------------------

  /**
   * Compute Parkinson volatility estimator using high and low prices.
   * 
   * Parkinson formula:
   *   sigma^2 = (1 / (4 * N * ln(2))) * sum( (ln(H_t / L_t))^2 )
   * 
   * This is approximately 5x more efficient than close-to-close estimators.
   * 
   * @param high - Array of high prices
   * @param low - Array of low prices
   * @returns VolatilityResult with annualized Parkinson volatility
   */
  public parkinsonVol(high: number[], low: number[]): VolatilityResult {
    log.info(`Computing Parkinson volatility, ${high.length} observations`);

    const n = Math.min(high.length, low.length);
    if (n < 1) {
      log.warn('parkinsonVol: insufficient data (need >= 1 observation)');
      return {
        value: 0,
        type: 'parkinson',
        annualized: true,
        window: 0,
        confidence: 0
      };
    }

    const fourLn2 = 4 * Math.log(2);
    let sumSqLogHL = 0;
    let validCount = 0;

    for (let i = 0; i < n; i++) {
      if (high[i] > 0 && low[i] > 0 && low[i] <= high[i]) {
        const logHL = Math.log(high[i] / low[i]);
        sumSqLogHL += logHL * logHL;
        validCount++;
      }
    }

    if (validCount === 0) {
      log.warn('parkinsonVol: no valid high/low pairs');
      return {
        value: 0,
        type: 'parkinson',
        annualized: true,
        window: 0,
        confidence: 0
      };
    }

    // Daily variance estimate
    const dailyVar = sumSqLogHL / (fourLn2 * validCount);
    const dailyVol = Math.sqrt(dailyVar);
    const annualizedVol = dailyVol * SQRT_252;

    // Confidence based on sample size
    const relSE = Math.sqrt(1 / (2 * validCount));
    const confidence = Math.max(0, Math.min(1, 1 - 2 * relSE));

    log.info(`Parkinson vol: daily=${dailyVol.toFixed(6)}, annualized=${annualizedVol.toFixed(6)}, valid pairs=${validCount}`);

    return {
      value: annualizedVol,
      type: 'parkinson',
      annualized: true,
      window: validCount,
      confidence
    };
  }

  // ---------------------------------------------------------------------------
  // Garman-Klass Volatility
  // ---------------------------------------------------------------------------

  /**
   * Compute Garman-Klass volatility estimator using OHLC data.
   * 
   * Garman-Klass formula:
   *   sigma^2 = (1/N) * sum( 0.5 * (ln(H/L))^2 - (2*ln(2) - 1) * (ln(C/O))^2 )
   * 
   * This is ~8x more efficient than close-to-close for typical parameters.
   * 
   * @param open - Array of open prices
   * @param high - Array of high prices
   * @param low - Array of low prices
   * @param close - Array of close prices
   * @returns VolatilityResult with annualized Garman-Klass volatility
   */
  public garmanKlassVol(
    open: number[],
    high: number[],
    low: number[],
    close: number[]
  ): VolatilityResult {
    log.info(`Computing Garman-Klass volatility, ${open.length} observations`);

    const n = Math.min(open.length, high.length, low.length, close.length);
    if (n < 1) {
      log.warn('garmanKlassVol: insufficient data');
      return {
        value: 0,
        type: 'garman-klass',
        annualized: true,
        window: 0,
        confidence: 0
      };
    }

    const twoLn2Minus1 = 2 * Math.log(2) - 1;
    let sum = 0;
    let validCount = 0;

    for (let i = 0; i < n; i++) {
      if (open[i] > 0 && high[i] > 0 && low[i] > 0 && close[i] > 0 &&
          low[i] <= high[i] && low[i] <= open[i] && high[i] >= open[i] &&
          low[i] <= close[i] && high[i] >= close[i]) {
        const logHL = Math.log(high[i] / low[i]);
        const logCO = Math.log(close[i] / open[i]);

        sum += 0.5 * logHL * logHL - twoLn2Minus1 * logCO * logCO;
        validCount++;
      }
    }

    if (validCount === 0) {
      log.warn('garmanKlassVol: no valid OHLC bars');
      return {
        value: 0,
        type: 'garman-klass',
        annualized: true,
        window: 0,
        confidence: 0
      };
    }

    // Daily variance estimate
    const dailyVar = sum / validCount;
    // Garman-Klass can occasionally produce negative estimates; clamp to zero
    const clampedVar = Math.max(dailyVar, 0);
    const dailyVol = Math.sqrt(clampedVar);
    const annualizedVol = dailyVol * SQRT_252;

    // Confidence based on sample size
    const relSE = Math.sqrt(1 / (2 * validCount));
    const confidence = Math.max(0, Math.min(1, 1 - 2 * relSE));

    log.info(`Garman-Klass vol: daily=${dailyVol.toFixed(6)}, annualized=${annualizedVol.toFixed(6)}, valid bars=${validCount}`);

    return {
      value: annualizedVol,
      type: 'garman-klass',
      annualized: true,
      window: validCount,
      confidence
    };
  }

  // ---------------------------------------------------------------------------
  // GARCH(1,1) Fitting
  // ---------------------------------------------------------------------------

  /**
   * Fit a GARCH(1,1) model to returns data using maximum likelihood estimation.
   * 
   * Model specification:
   *   r_t = epsilon_t * sigma_t
   *   sigma_t^2 = omega + alpha * r_{t-1}^2 + beta * sigma_{t-1}^2
   * 
   * Optimization uses gradient ascent with Armijo line search and
   * parameter projection to enforce stationarity (alpha + beta < 1).
   * 
   * @param params - GARCHParams with initial parameter guesses and returns
   * @returns GARCHResult with fitted parameters, fitted values, residuals, and info criteria
   */
  public garch11(params: GARCHParams): GARCHResult {
    log.info(`Fitting GARCH(1,1), ${params.returns.length} observations`);
    log.debug(`Initial params: omega=${params.omega}, alpha=${params.alpha}, beta=${params.beta}`);

    const returns = params.returns;
    const n = returns.length;

    if (n < 10) {
      log.warn('garch11: insufficient data for reliable estimation (need >= 10)');
      // Return with initial params
      return this.buildGARCHResult(
        params.omega, params.alpha, params.beta,
        returns, -Infinity
      );
    }

    // Use provided initial values or defaults
    const initOmega = params.omega > 0 ? params.omega : DEFAULT_OMEGA;
    const initAlpha = params.alpha > 0 && params.alpha < 1 ? params.alpha : DEFAULT_ALPHA;
    const initBeta = params.beta > 0 && params.beta < 1 ? params.beta : DEFAULT_BETA;

    // Fit via MLE
    const fitted = fitGARCH11(returns, initOmega, initAlpha, initBeta);

    log.info(`GARCH(1,1) fitted: omega=${fitted.omega.toFixed(8)}, alpha=${fitted.alpha.toFixed(6)}, beta=${fitted.beta.toFixed(6)}`);
    log.info(`Log-likelihood: ${fitted.logLikelihood.toFixed(4)}`);
    log.info(`Persistence (alpha+beta): ${(fitted.alpha + fitted.beta).toFixed(6)}`);

    return this.buildGARCHResult(
      fitted.omega, fitted.alpha, fitted.beta,
      returns, fitted.logLikelihood
    );
  }

  /**
   * Build a complete GARCHResult from fitted parameters.
   */
  private buildGARCHResult(
    omega: number,
    alpha: number,
    beta: number,
    returns: number[],
    logLikelihood: number
  ): GARCHResult {
    const n = returns.length;
    const { sigmas } = garchLogLikelihood(omega, alpha, beta, returns);

    // Compute fitted values (conditional variances) and residuals (standardized returns)
    const fittedValues: number[] = sigmas.map(s => s * s);
    const residuals: number[] = returns.map((r, i) => {
      const s = sigmas[i];
      return s > 0 ? r / s : 0;
    });

    // Generate forecasts: E[sigma_{t+h}^2] using recursive formula
    // sigma_{t+1}^2 = omega + alpha * r_t^2 + beta * sigma_t^2
    // sigma_{t+h}^2 = omega * (1 - (alpha+beta)^h) / (1 - alpha - beta) + (alpha+beta)^h * sigma_{t+1}^2
    const forecasts = this.generateGARCHForecasts(
      omega, alpha, beta, returns, sigmas, 30
    );

    // Information criteria
    const k = 3; // number of parameters
    const aic = -2 * logLikelihood + 2 * k;
    const bic = -2 * logLikelihood + k * Math.log(n);

    return {
      forecasts,
      fittedValues,
      residuals,
      params: { omega, alpha, beta },
      logLikelihood,
      aic,
      bic
    };
  }

  /**
   * Generate GARCH(1,1) variance forecasts for a given horizon.
   * Uses the recursive formula for multi-step ahead forecasts.
   */
  private generateGARCHForecasts(
    omega: number,
    alpha: number,
    beta: number,
    returns: number[],
    sigmas: number[],
    horizon: number
  ): number[] {
    const n = returns.length;
    if (n === 0 || sigmas.length === 0) return [];

    const persistence = alpha + beta;
    const lastReturn = returns[n - 1];
    const lastSigma2 = sigmas[sigmas.length - 1] ** 2;

    // One-step ahead forecast
    const sigma1_2 = omega + alpha * lastReturn * lastReturn + beta * lastSigma2;

    const forecasts: number[] = [Math.sqrt(Math.max(sigma1_2, 0))];

    // Unconditional variance (long-run)
    const uncondVar = persistence < 1 ? omega / (1 - persistence) : lastSigma2;

    for (let h = 2; h <= horizon; h++) {
      // Multi-step forecast using mean-reversion formula
      // sigma_{t+h}^2 = uncondVar + persistence^(h-1) * (sigma_{t+1}^2 - uncondVar)
      const sigmaH2 = uncondVar + Math.pow(persistence, h - 1) * (sigma1_2 - uncondVar);
      forecasts.push(Math.sqrt(Math.max(sigmaH2, 0)));
    }

    return forecasts;
  }

  // ---------------------------------------------------------------------------
  // Volatility Forecasting
  // ---------------------------------------------------------------------------

  /**
   * Forecast volatility for a given horizon using specified method.
   * 
   * Methods:
   * - 'historical': Uses rolling historical vol, assumes constant forward
   * - 'ewma': Uses EWMA model, projects forward with decay
   * - 'garch': Fits GARCH(1,1) and generates multi-step forecasts
   * - 'realized': Uses realized vol from high-frequency-style decomposition
   * 
   * @param returns - Array of historical returns
   * @param horizon - Number of periods to forecast
   * @param method - Forecasting method (default 'historical')
   * @returns Array of forecasted volatilities (annualized)
   */
  public forecastVolatility(
    returns: number[],
    horizon: number,
    method: string = 'historical'
  ): number[] {
    log.info(`Forecasting volatility: method=${method}, horizon=${horizon}, obs=${returns.length}`);

    if (returns.length < 2 || horizon < 1) {
      return new Array(horizon).fill(0);
    }

    switch (method.toLowerCase()) {
      case 'garch':
        return this.forecastGARCH(returns, horizon);

      case 'ewma':
        return this.forecastEWMA(returns, horizon);

      case 'realized':
        return this.forecastRealized(returns, horizon);

      case 'historical':
      default:
        return this.forecastHistorical(returns, horizon);
    }
  }

  /**
   * Historical volatility forecast: assumes constant volatility equal to
   * the most recent rolling estimate.
   */
  private forecastHistorical(returns: number[], horizon: number): number[] {
    const vol = this.historicalVol(returns);
    return new Array(horizon).fill(vol.value);
  }

  /**
   * EWMA volatility forecast: projects forward using the EWMA variance
   * with mean-reversion toward unconditional variance.
   */
  private forecastEWMA(returns: number[], horizon: number): number[] {
    const lambda = 0.94;
    let sigma2 = returns[0] * returns[0];

    for (let t = 1; t < returns.length; t++) {
      sigma2 = lambda * sigma2 + (1 - lambda) * returns[t] * returns[t];
    }

    // Unconditional variance approximation
    const sampleVar = variance(returns);
    const forecasts: number[] = [];

    for (let h = 1; h <= horizon; h++) {
      // Mean revert toward unconditional variance
      const weight = Math.pow(lambda, h);
      const forecastVar = sampleVar + weight * (sigma2 - sampleVar);
      forecasts.push(Math.sqrt(Math.max(forecastVar, 0)) * SQRT_252);
    }

    return forecasts;
  }

  /**
   * GARCH(1,1) volatility forecast.
   */
  private forecastGARCH(returns: number[], horizon: number): number[] {
    const result = this.garch11({
      omega: DEFAULT_OMEGA,
      alpha: DEFAULT_ALPHA,
      beta: DEFAULT_BETA,
      returns
    });

    // Take the first `horizon` forecasts, annualize them
    const forecasts: number[] = [];
    for (let i = 0; i < horizon; i++) {
      const dailyVol = i < result.forecasts.length
        ? result.forecasts[i]
        : result.forecasts[result.forecasts.length - 1];
      forecasts.push(dailyVol * SQRT_252);
    }

    return forecasts;
  }

  /**
   * Realized volatility forecast using variance decomposition.
   * Uses a simple AR(1)-like model on realized variance.
   */
  private forecastRealized(returns: number[], horizon: number): number[] {
    // Compute realized variance over rolling windows
    const windowSize = Math.min(21, returns.length); // ~1 month
    const rvSeries: number[] = [];

    for (let i = windowSize; i <= returns.length; i++) {
      const subset = returns.slice(i - windowSize, i);
      const m = mean(subset);
      let sumSq = 0;
      for (const r of subset) {
        sumSq += (r - m) * (r - m);
      }
      rvSeries.push(sumSq / (subset.length - 1));
    }

    if (rvSeries.length < 2) {
      const vol = this.historicalVol(returns);
      return new Array(horizon).fill(vol.value);
    }

    // Fit AR(1) on realized variance: RV_t = a + b * RV_{t-1} + e_t
    const x: number[] = [];
    const y: number[] = [];
    for (let i = 1; i < rvSeries.length; i++) {
      x.push(rvSeries[i - 1]);
      y.push(rvSeries[i]);
    }

    const mx = mean(x);
    const my = mean(y);
    let num = 0;
    let den = 0;
    for (let i = 0; i < x.length; i++) {
      num += (x[i] - mx) * (y[i] - my);
      den += (x[i] - mx) * (x[i] - mx);
    }

    const b = den > 0 ? num / den : 0.5;
    const a = my - b * mx;

    // Generate forecasts
    const forecasts: number[] = [];
    let currentRV = rvSeries[rvSeries.length - 1];
    const longRunRV = (1 - b) > 0 ? a / (1 - b) : currentRV;

    for (let h = 1; h <= horizon; h++) {
      // AR(1) forecast: E[RV_{t+h}] = a * (1 + b + ... + b^{h-1}) + b^h * RV_t
      //                = longRunRV + b^h * (RV_t - longRunRV)
      const forecastRV = longRunRV + Math.pow(b, h) * (currentRV - longRunRV);
      const dailyVol = Math.sqrt(Math.max(forecastRV, 0));
      forecasts.push(dailyVol * SQRT_252);
    }

    return forecasts;
  }

  // ---------------------------------------------------------------------------
  // Volatility Term Structure
  // ---------------------------------------------------------------------------

  /**
   * Compute the volatility term structure across multiple windows.
   * For each window, computes the annualized historical volatility.
   * 
   * @param returns - Array of returns
   * @param windows - Array of window sizes (in periods)
   * @returns Array of { window, vol } pairs sorted by window size
   */
  public volatilityTermStructure(
    returns: number[],
    windows: number[]
  ): { window: number; vol: number }[] {
    log.info(`Computing volatility term structure, ${windows.length} windows, ${returns.length} obs`);

    if (returns.length < 2) {
      return windows.map(w => ({ window: w, vol: 0 }));
    }

    const results: { window: number; vol: number }[] = [];

    for (const w of windows) {
      if (w < 2) {
        results.push({ window: w, vol: 0 });
        continue;
      }

      const effectiveWindow = Math.min(w, returns.length);
      const subset = returns.slice(returns.length - effectiveWindow);
      const m = mean(subset);

      let sumSq = 0;
      for (const r of subset) {
        sumSq += (r - m) * (r - m);
      }
      const sampleVar = subset.length > 1 ? sumSq / (subset.length - 1) : 0;
      const dailyVol = Math.sqrt(sampleVar);
      const annualizedVol = dailyVol * SQRT_252;

      results.push({ window: w, vol: annualizedVol });
    }

    // Sort by window size
    results.sort((a, b) => a.window - b.window);

    log.debug(`Term structure: ${JSON.stringify(results.map(r => `${r.window}d=${(r.vol * 100).toFixed(2)}%`))}`);

    return results;
  }

  // ---------------------------------------------------------------------------
  // Correlation Matrix
  // ---------------------------------------------------------------------------

  /**
   * Compute the pairwise Pearson correlation matrix for multiple return series.
   * 
   * @param returnsArrays - Array of return series (each a number[])
   * @returns NxN correlation matrix where N = returnsArrays.length
   */
  public correlationMatrix(returnsArrays: number[][]): number[][] {
    log.info(`Computing correlation matrix for ${returnsArrays.length} series`);

    const n = returnsArrays.length;
    if (n === 0) return [];
    if (n === 1) return [[1]];

    // Pre-compute means and standard deviations
    const means: number[] = [];
    const stds: number[] = [];

    for (let i = 0; i < n; i++) {
      means.push(mean(returnsArrays[i]));
      stds.push(stdDev(returnsArrays[i]));
    }

    // Build correlation matrix
    const matrix: number[][] = [];
    for (let i = 0; i < n; i++) {
      matrix.push(new Array(n).fill(0));
      matrix[i][i] = 1; // Self-correlation is always 1
    }

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const corr = this.computePairwiseCorrelation(
          returnsArrays[i], returnsArrays[j],
          means[i], means[j],
          stds[i], stds[j]
        );
        matrix[i][j] = corr;
        matrix[j][i] = corr;
      }
    }

    log.debug(`Correlation matrix computed (${n}x${n})`);

    return matrix;
  }

  /**
   * Compute pairwise correlation with pre-computed statistics.
   */
  private computePairwiseCorrelation(
    x: number[],
    y: number[],
    mx: number,
    my: number,
    sx: number,
    sy: number
  ): number {
    if (sx === 0 || sy === 0) return 0;

    const n = Math.min(x.length, y.length);
    if (n < 2) return 0;

    let sum = 0;
    for (let i = 0; i < n; i++) {
      sum += (x[i] - mx) * (y[i] - my);
    }

    return (sum / (n - 1)) / (sx * sy);
  }

  // ---------------------------------------------------------------------------
  // Volatility Cone
  // ---------------------------------------------------------------------------

  /**
   * Compute the volatility cone: distribution of realized volatility
   * across different time horizons.
   * 
   * For each window size, computes rolling annualized volatility and
   * returns the distribution statistics (median, quartiles, min, max).
   * 
   * @param returns - Array of returns
   * @param windows - Array of window sizes (in periods)
   * @param quantiles - Optional quantile levels (default [0.25, 0.75])
   * @returns Array of cone statistics for each window
   */
  public volatilityCone(
    returns: number[],
    windows: number[],
    quantiles?: number[]
  ): { window: number; median: number; q25: number; q75: number; min: number; max: number }[] {
    log.info(`Computing volatility cone, ${windows.length} windows, ${returns.length} obs`);

    if (returns.length < 2) {
      return windows.map(w => ({
        window: w, median: 0, q25: 0, q75: 0, min: 0, max: 0
      }));
    }

    const sortedWindows = [...windows].sort((a, b) => a - b);
    const cone: { window: number; median: number; q25: number; q75: number; min: number; max: number }[] = [];

    for (const w of sortedWindows) {
      if (w < 2) {
        cone.push({ window: w, median: 0, q25: 0, q75: 0, min: 0, max: 0 });
        continue;
      }

      // Compute rolling volatilities for this window
      const rollingVols = this.computeRollingVolatilities(returns, w);

      if (rollingVols.length === 0) {
        cone.push({ window: w, median: 0, q25: 0, q75: 0, min: 0, max: 0 });
        continue;
      }

      // Sort for quantile computation
      const sorted = sortedCopy(rollingVols);

      const medianVal = quantile(sorted, 0.5);
      const q25Val = quantile(sorted, 0.25);
      const q75Val = quantile(sorted, 0.75);
      const minVal = sorted[0];
      const maxVal = sorted[sorted.length - 1];

      cone.push({
        window: w,
        median: medianVal,
        q25: q25Val,
        q75: q75Val,
        min: minVal,
        max: maxVal
      });
    }

    log.debug(`Volatility cone computed for ${sortedWindows.length} windows`);

    return cone;
  }

  /**
   * Compute rolling annualized volatilities for a given window size.
   */
  private computeRollingVolatilities(returns: number[], window: number): number[] {
    const vols: number[] = [];

    if (returns.length < window) return vols;

    for (let i = window; i <= returns.length; i++) {
      const subset = returns.slice(i - window, i);
      const m = mean(subset);

      let sumSq = 0;
      for (const r of subset) {
        sumSq += (r - m) * (r - m);
      }

      const sampleVar = subset.length > 1 ? sumSq / (subset.length - 1) : 0;
      const dailyVol = Math.sqrt(sampleVar);
      vols.push(dailyVol * SQRT_252);
    }

    return vols;
  }

  // ---------------------------------------------------------------------------
  // Volatility Surface (bonus utility)
  // ---------------------------------------------------------------------------

  /**
   * Construct an implied volatility surface from option market data.
   * Uses Black-Scholes Newton-Raphson to back out implied vols.
   * 
   * @param underlying - Current underlying price
   * @param date - Valuation date
   * @param options - Array of option data with strike, expiry, market price, risk-free rate
   * @returns VolSurface with implied volatilities and deltas
   */
  public buildVolSurface(
    underlying: number,
    date: string,
    options: {
      strike: number;
      expiry: string;
      marketPrice: number;
      riskFreeRate: number;
      timeToExpiry: number;
    }[]
  ): VolSurface {
    log.info(`Building volatility surface: date=${date}, underlying=${underlying}, ${options.length} options`);

    const points: VolSurface['points'] = [];

    for (const opt of options) {
      if (opt.timeToExpiry <= 0 || underlying <= 0 || opt.strike <= 0) {
        continue;
      }

      const iv = impliedVolatility(
        opt.marketPrice,
        underlying,
        opt.strike,
        opt.timeToExpiry,
        opt.riskFreeRate
      );

      const delta = blackScholesDelta(
        underlying,
        opt.strike,
        opt.timeToExpiry,
        opt.riskFreeRate,
        iv
      );

      points.push({
        strike: opt.strike,
        expiry: opt.expiry,
        iv,
        delta
      });
    }

    log.info(`Vol surface built with ${points.length} valid points`);

    return {
      date,
      underlying,
      points
    };
  }

  // ---------------------------------------------------------------------------
  // Realized Volatility (bonus utility)
  // ---------------------------------------------------------------------------

  /**
   * Compute realized volatility from intraday returns using the
   * sum-of-squared-returns estimator.
   * 
   * RV = sum(r_i^2) for intraday returns r_i
   * 
   * @param intradayReturns - Array of intraday (high-frequency) returns
   * @param tradingPeriodsPerDay - Number of intraday periods per day (e.g., 78 for 5-min bars)
   * @returns VolatilityResult with annualized realized volatility
   */
  public realizedVol(
    intradayReturns: number[],
    tradingPeriodsPerDay: number = 78
  ): VolatilityResult {
    log.info(`Computing realized volatility, ${intradayReturns.length} intraday returns, ${tradingPeriodsPerDay} periods/day`);

    if (intradayReturns.length < 1) {
      return {
        value: 0,
        type: 'realized',
        annualized: true,
        window: 0,
        confidence: 0
      };
    }

    // Realized variance = sum of squared returns
    let sumSq = 0;
    for (const r of intradayReturns) {
      sumSq += r * r;
    }

    // Scale to daily: multiply by (periods_per_day / n_obs)
    const daysCovered = intradayReturns.length / tradingPeriodsPerDay;
    const dailyVar = daysCovered > 0 ? sumSq / daysCovered : sumSq;
    const dailyVol = Math.sqrt(dailyVar);
    const annualizedVol = dailyVol * SQRT_252;

    // Confidence: based on number of days covered
    const effectiveDays = Math.max(1, Math.floor(daysCovered));
    const relSE = Math.sqrt(1 / (2 * effectiveDays));
    const confidence = Math.max(0, Math.min(1, 1 - 2 * relSE));

    log.info(`Realized vol: daily=${dailyVol.toFixed(6)}, annualized=${annualizedVol.toFixed(6)}, days=${daysCovered.toFixed(2)}`);

    return {
      value: annualizedVol,
      type: 'realized',
      annualized: true,
      window: Math.ceil(daysCovered),
      confidence
    };
  }

  // ---------------------------------------------------------------------------
  // Utility: Compute Log Returns from Price Series
  // ---------------------------------------------------------------------------

  /**
   * Convert a price series to log returns.
   * Convenience method for use with the other volatility functions.
   * 
   * @param prices - Array of prices
   * @returns Array of log returns
   */
  public computeLogReturns(prices: number[]): number[] {
    return logReturns(prices);
  }

  // ---------------------------------------------------------------------------
  // Summary / Diagnostics
  // ---------------------------------------------------------------------------

  /**
   * Compute a comprehensive volatility summary for a returns series.
   * Includes multiple estimators and diagnostic statistics.
   */
  public volatilitySummary(returns: number[]): {
    historical: VolatilityResult;
    ewma: VolatilityResult;
    skewness: number;
    kurtosis: number;
    jarqueBera: number;
    normalityPValue: number;
  } {
    log.info(`Computing volatility summary for ${returns.length} observations`);

    const historical = this.historicalVol(returns);
    const ewma = this.ewmaVol(returns);

    // Skewness: E[(X - mu)^3] / sigma^3
    const m = mean(returns);
    const s = stdDev(returns);
    const n = returns.length;

    let skewness = 0;
    let kurtosis = 0;

    if (s > 0 && n >= 3) {
      let m3 = 0;
      let m4 = 0;
      for (const r of returns) {
        const z = (r - m) / s;
        const z2 = z * z;
        m3 += z2 * z;
        m4 += z2 * z2;
      }
      skewness = (n / ((n - 1) * (n - 2))) * m3;
      // Excess kurtosis with bias correction
      if (n >= 4) {
        const rawKurt = m4 / n;
        kurtosis = ((n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3))) * m4 / n -
                   (3 * (n - 1) * (n - 1)) / ((n - 2) * (n - 3));
        // Simplified: just use sample excess kurtosis
        kurtosis = (m4 / n) - 3; // basic excess kurtosis
      }
    }

    // Jarque-Bera test: JB = (n/6) * (S^2 + K^2/4)
    const jarqueBera = (n / 6) * (skewness * skewness + (kurtosis * kurtosis) / 4);

    // Approximate p-value using chi-squared(2) survival function
    // P(X > x) ≈ exp(-x/2) for chi-squared(2)
    const normalityPValue = Math.exp(-jarqueBera / 2);

    return {
      historical,
      ewma,
      skewness,
      kurtosis,
      jarqueBera,
      normalityPValue
    };
  }
}

// =============================================================================
// Default Export
// =============================================================================

export default VolatilityModels;

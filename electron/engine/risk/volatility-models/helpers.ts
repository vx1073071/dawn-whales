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


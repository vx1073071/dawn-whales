// electron/engine/utils/math.ts — Math utility functions
// [R92] Created to resolve missing import from calendar-effects.ts

/**
 * Error function approximation (Abramowitz & Stegun, formula 7.1.26).
 * Max error: 1.5e-7.
 */
function erf(x: number): number {
  const sign = x >= 0 ? 1 : -1;
  const absX = Math.abs(x);
  const t = 1.0 / (1.0 + 0.3275911 * absX);
  const poly = ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t;
  return sign * (1.0 - poly * Math.exp(-absX * absX));
}

/**
 * Cumulative distribution function for the standard normal distribution.
 * CDF(x) = 0.5 * (1 + erf(x / sqrt(2)))
 */
export function normalCDF(x: number): number {
  return 0.5 * (1.0 + erf(x / Math.SQRT2));
}

/**
 * Probability density function for the standard normal distribution.
 */
export function normalPDF(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

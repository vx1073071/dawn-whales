// ── DAWN WHALES — Math Utilities (R83 unified) ─────────────────────────────
// Canonical implementations extracted from 8 engine files.
// All duplicates in bayesian-optimizer, calendar-effects, options-pricing,
// options-strategy-builder, rar-optimizer, tca-v3, vol-forecast, volatility-models
// have been consolidated here.

/**
 * Standard normal CDF Φ(x) using polynomial approximation.
 * Equivalent to: 0.5 * (1 + erf(x / sqrt(2)))
 */
export function normalCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);
  const t = 1.0 / (1.0 + p * absX);
  const t2 = t * t;
  const t3 = t2 * t;
  const t4 = t3 * t;
  const t5 = t4 * t;

  const y = 1.0 - (a1 * t + a2 * t2 + a3 * t3 + a4 * t4 + a5 * t5) * Math.exp(-(absX * absX) / 2);
  return 0.5 * (1.0 + sign * y);
}

/** Standard normal PDF φ(x) */
export function normalPDF(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

/** Arithmetic mean */
export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Sample standard deviation (n-1) */
export function stddev(values: number[], avg?: number): number {
  if (values.length <= 1) return 0;
  const m = avg ?? mean(values);
  const variance = values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/** Population standard deviation (n) */
export function stddevPopulation(values: number[], avg?: number): number {
  if (values.length === 0) return 0;
  const m = avg ?? mean(values);
  const variance = values.reduce((sum, v) => sum + (v - m) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/** Clamp value between min and max */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Round to decimal places */
export function round(value: number, decimals: number = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

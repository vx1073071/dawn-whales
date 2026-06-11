import { EngineError, ErrorCode } from '../../errors';
// ── Risk Metrics Calculator (JVS-46) ────────────────────────────────────────
// VaR / CVaR / Sharpe / Sortino / Information Ratio / Max Drawdown
// IPC: em:calc-risk-metrics

import log from 'electron-log';

// ── Types ──────────────────────────────────────────────────────────────────

export interface RiskMetricsResult {
  // Return metrics
  totalReturn: number;          // total return %
  annualizedReturn: number;     // annualized return %
  
  // Risk metrics
  volatility: number;           // annualized volatility %
  downsideVolatility: number;   // downside volatility %
  
  // VaR / CVaR
  var95: number;                // 95% VaR (parametric)
  var99: number;                // 99% VaR (parametric)
  cvar95: number;               // 95% CVaR / Expected Shortfall
  cvar99: number;               // 99% CVaR
  var95Historical: number;      // 95% VaR (historical)
  var99Historical: number;      // 99% VaR (historical)
  
  // Risk-adjusted returns
  sharpeRatio: number;          // Sharpe Ratio (Rf = riskFreeRate)
  sortinoRatio: number;        // Sortino Ratio
  informationRatio: number;     // Information Ratio (vs benchmark)
  calmarRatio: number;          // Calmar Ratio
  
  // Drawdown
  maxDrawdown: number;          // Maximum Drawdown %
  maxDrawdownDuration: number;  // Max DD duration (days)
  currentDrawdown: number;      // Current DD %
  
  // Monte Carlo VaR
  monteCarloVaR95?: number;     // MC VaR 95%
  monteCarloVaR99?: number;     // MC VaR 99%
  monteCarloSimulations?: number;
}

export interface RiskMetricsParams {
  returns: number[];            // Daily returns (percentage)
  riskFreeRate?: number;        // Annual risk-free rate (default 0.02 = 2%)
  benchmarkReturns?: number[];  // Benchmark daily returns (for IR)
  tradingDaysPerYear?: number;  // Default 252
  monteCarloSims?: number;      // Default 10000
}

// ── Core Risk Metrics ──────────────────────────────────────────────────────

export function calculateRiskMetrics(params: RiskMetricsParams): RiskMetricsResult {
  const {
    returns,
    riskFreeRate = 0.02,
    benchmarkReturns,
    tradingDaysPerYear = 252,
    monteCarloSims = 10000,
  } = params;

  if (!returns || returns.length === 0) {
    throw new EngineError("Returns array is required and must not be empty", { code: ErrorCode.ENGINE_VALIDATION_ERROR });
  }

  const n = returns.length;
  const dailyRf = riskFreeRate / tradingDaysPerYear;

  // ── Basic return stats ─────────────────────────────────────────────
  const totalReturn = returns.reduce((acc, r) => acc * (1 + r / 100), 1) - 1;
  const years = n / tradingDaysPerYear;
  const annualizedReturn = years > 0 ? (Math.pow(1 + totalReturn, 1 / years) - 1) * 100 : 0;

  const meanReturn = returns.reduce((a, b) => a + b, 0) / n;
  const variance = returns.reduce((acc, r) => acc + Math.pow(r - meanReturn, 2), 0) / (n - 1);
  const stdDev = Math.sqrt(variance);
  const annualizedVol = stdDev * Math.sqrt(tradingDaysPerYear);

  // Downside deviation (target = 0)
  const downsideReturns = returns.filter(r => r < 0);
  const downsideVariance = downsideReturns.length > 0
    ? downsideReturns.reduce((acc, r) => acc + r * r, 0) / n
    : 0;
  const downsideDev = Math.sqrt(downsideVariance);
  const annualizedDownsideVol = downsideDev * Math.sqrt(tradingDaysPerYear);

  // ── Parametric VaR / CVaR ─────────────────────────────────────────
  const z95 = 1.6449;
  const z99 = 2.3263;
  const var95 = -(meanReturn - z95 * stdDev) * Math.sqrt(1);  // 1-day VaR
  const var99 = -(meanReturn - z99 * stdDev) * Math.sqrt(1);
  
  // CVaR = E[Loss | Loss > VaR]
  // For normal distribution: CVaR = VaR + φ(z) / (1-α) * σ
  const phiZ95 = Math.exp(-0.5 * z95 * z95) / Math.sqrt(2 * Math.PI);
  const phiZ99 = Math.exp(-0.5 * z99 * z99) / Math.sqrt(2 * Math.PI);
  const cvar95 = var95 + (phiZ95 / 0.05) * stdDev;
  const cvar99 = var99 + (phiZ99 / 0.01) * stdDev;

  // ── Historical VaR ────────────────────────────────────────────────
  const sortedReturns = [...returns].sort((a, b) => a - b);
  const var95Hist = -sortedReturns[Math.floor(n * 0.05)] || 0;
  const var99Hist = -sortedReturns[Math.floor(n * 0.01)] || 0;

  // ── Monte Carlo VaR ───────────────────────────────────────────────
  let mcVaR95 = 0;
  let mcVaR99 = 0;
  try {
    const mcResults = monteCarloSimulation(meanReturn, stdDev, monteCarloSims);
    const mcSorted = mcResults.sort((a, b) => a - b);
    mcVaR95 = -mcSorted[Math.floor(monteCarloSims * 0.05)] || 0;
    mcVaR99 = -mcSorted[Math.floor(monteCarloSims * 0.01)] || 0;
  } catch (err) {
    log.warn('[RiskMetrics] Monte Carlo failed:', err);
  }

  // ── Risk-adjusted returns ─────────────────────────────────────────
  const excessReturn = annualizedReturn - riskFreeRate * 100;
  const sharpeRatio = annualizedVol > 0 ? excessReturn / annualizedVol : 0;
  const sortinoRatio = annualizedDownsideVol > 0 ? excessReturn / annualizedDownsideVol : 0;

  // Information Ratio
  let informationRatio = 0;
  if (benchmarkReturns && benchmarkReturns.length > 0) {
    const minLen = Math.min(returns.length, benchmarkReturns.length);
    const activeReturns = returns.slice(0, minLen).map((r, i) => r - benchmarkReturns[i]);
    const activeMean = activeReturns.reduce((a, b) => a + b, 0) / minLen;
    const activeVariance = activeReturns.reduce((acc, r) => acc + Math.pow(r - activeMean, 2), 0) / (minLen - 1);
    const trackingError = Math.sqrt(activeVariance) * Math.sqrt(tradingDaysPerYear);
    informationRatio = trackingError > 0 ? (activeMean * tradingDaysPerYear) / trackingError : 0;
  }

  // ── Drawdown ──────────────────────────────────────────────────────
  const { maxDrawdown, maxDrawdownDuration, currentDrawdown } = calculateDrawdown(returns);

  // Calmar Ratio
  const calmarRatio = maxDrawdown > 0 ? annualizedReturn / maxDrawdown : 0;

  return {
    totalReturn: round(totalReturn * 100, 2),
    annualizedReturn: round(annualizedReturn, 2),
    volatility: round(annualizedVol, 2),
    downsideVolatility: round(annualizedDownsideVol, 2),
    var95: round(var95, 4),
    var99: round(var99, 4),
    cvar95: round(cvar95, 4),
    cvar99: round(cvar99, 4),
    var95Historical: round(var95Hist, 4),
    var99Historical: round(var99Hist, 4),
    sharpeRatio: round(sharpeRatio, 3),
    sortinoRatio: round(sortinoRatio, 3),
    informationRatio: round(informationRatio, 3),
    calmarRatio: round(calmarRatio, 3),
    maxDrawdown: round(maxDrawdown, 2),
    maxDrawdownDuration,
    currentDrawdown: round(currentDrawdown, 2),
    monteCarloVaR95: round(mcVaR95, 4),
    monteCarloVaR99: round(mcVaR99, 4),
    monteCarloSimulations: monteCarloSims,
  };
}

// ── Drawdown Calculation ───────────────────────────────────────────────────

function calculateDrawdown(returns: number[]): {
  maxDrawdown: number;
  maxDrawdownDuration: number;
  currentDrawdown: number;
} {
  let peak = 1;
  let maxDD = 0;
  let currentDD = 0;
  let maxDDDuration = 0;
  let currentDDDuration = 0;
  let inDD = false;

  let cumulative = 1;
  for (let i = 0; i < returns.length; i++) {
    cumulative *= (1 + returns[i] / 100);

    if (cumulative > peak) {
      peak = cumulative;
      if (inDD) {
        maxDDDuration = Math.max(maxDDDuration, currentDDDuration);
        currentDDDuration = 0;
        inDD = false;
      }
    } else {
      inDD = true;
      currentDDDuration++;
    }

    const dd = (peak - cumulative) / peak * 100;
    if (dd > maxDD) maxDD = dd;
    currentDD = dd;
  }

  if (inDD) {
    maxDDDuration = Math.max(maxDDDuration, currentDDDuration);
  }

  return {
    maxDrawdown: maxDD,
    maxDrawdownDuration: maxDDDuration,
    currentDrawdown: currentDD,
  };
}

// ── Monte Carlo Simulation ─────────────────────────────────────────────────

function monteCarloSimulation(
  meanReturn: number,
  stdDev: number,
  simulations: number
): number[] {
  const results: number[] = [];

  for (let i = 0; i < simulations; i++) {
    // Box-Muller transform for normal distribution
    const u1 = Math.random();
    const u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    const simulatedReturn = meanReturn + z * stdDev;
    results.push(simulatedReturn);
  }

  return results;
}

// ── Utility ────────────────────────────────────────────────────────────────

function round(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

// ── Quick single-metric helpers ────────────────────────────────────────────

export function calcSharpeRatio(returns: number[], riskFreeRate: number = 0.02, tradingDays: number = 252): number {
  const n = returns.length;
  if (n < 2) return 0;
  const mean = returns.reduce((a, b) => a + b, 0) / n;
  const variance = returns.reduce((acc, r) => acc + Math.pow(r - mean, 2), 0) / (n - 1);
  const stdDev = Math.sqrt(variance) * Math.sqrt(tradingDays);
  const annualizedReturn = mean * tradingDays;
  return stdDev > 0 ? (annualizedReturn - riskFreeRate) / stdDev : 0;
}

export function calcMaxDrawdown(returns: number[]): number {
  return calculateDrawdown(returns).maxDrawdown;
}

export function calcVaR(returns: number[], confidence: number = 0.95): number {
  const sorted = [...returns].sort((a, b) => a - b);
  const idx = Math.floor(sorted.length * (1 - confidence));
  return -sorted[idx] || 0;
}

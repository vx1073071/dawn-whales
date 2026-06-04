// ── Q54: Risk-Adjusted Return Optimizer ──────────────────────────────────────
// MAR ratio / Probabilistic Sharpe / Kelly-optimal sizing
// Return distribution optimization + Multi-objective ranking

import log from 'electron-log';

// ── Types ──────────────────────────────────────────────────────────────────

export interface ReturnDistribution {
  returns: number[];
  mean: number;
  volatility: number;
  skewness: number;
  kurtosis: number;
  VaR5: number;
  CVaR5: number;
  minReturn: number;
  maxReturn: number;
}

export interface RiskAdjustedMetrics {
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  MARRatio: number;        // Return / Max Drawdown
  probabilisticSharpe: number; // Prob(Sharpe > threshold)
  tailSharpe: number;     // Sharpe using CVaR instead of vol
  upsideRatio: number;     // Upside vol / downside vol
  gainToPain: number;     // Sum(gains) / Sum(|losses|)
  adjustedSharpe: number;  // Skew/kurtosis adjusted
}

export interface KellyResult {
  kellyFraction: number;   // Full Kelly
  halfKelly: number;       // Half Kelly (more conservative)
  quarterKelly: number;    // Quarter Kelly
  winRate: number;
  avgWin: number;
  avgLoss: number;
  payoffRatio: number;
  riskOfRuin: number;      // Probability of losing X%
  optimizedSize: number;  // Kelly-scaled position size
}

export interface RAROptimizerResult {
  strategyId: string;
  metrics: RiskAdjustedMetrics;
  kelly: KellyResult;
  returnDist: ReturnDistribution;
  rankings: {
    sharpeRank: number;
    calmarRank: number;
    sortinoRank: number;
    marRank: number;
    overallRank: number;
  };
  recommendations: string[];
  timestamp: number;
}

// ── Helpers ─────────────────────────────────────────────────────────────

function calcSkewness(data: number[]): number {
  const n = data.length;
  if (n < 3) return 0;
  const mean = data.reduce((a, b) => a + b, 0) / n;
  const m2 = data.reduce((s, r) => s + (r - mean) ** 2, 0) / n;
  const m3 = data.reduce((s, r) => s + (r - mean) ** 3, 0) / n;
  const sd = Math.sqrt(m2);
  return sd > 0 ? m3 / (sd ** 3) : 0;
}

function calcKurtosis(data: number[]): number {
  const n = data.length;
  if (n < 4) return 0;
  const mean = data.reduce((a, b) => a + b, 0) / n;
  const m2 = data.reduce((s, r) => s + (r - mean) ** 2, 0) / n;
  const m4 = data.reduce((s, r) => s + (r - mean) ** 4, 0) / n;
  return m2 > 0 ? m4 / (m2 ** 2) - 3 : 0;
}

function normalCDF(x: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);
  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
}

// ── RAR Optimizer ────────────────────────────────────────────────────────

export class RAROptimizer {
  constructor() {
    log.info('[RAROptimizer] Initialized');
  }

  // ── Analyze Strategy ───────────────────────────────────────────────

  analyze(
    strategyId: string,
    returns: number[],
    maxDrawdown: number,
    annualReturn?: number
  ): RAROptimizerResult {
    if (returns.length === 0) return this.emptyResult(strategyId);

    log.info(`[RAROptimizer] Analyzing ${strategyId}, ${returns.length} returns`);

    const n = returns.length;
    const mean = returns.reduce((a, b) => a + b, 0) / n;
    const annMean = mean * 252;
    const vol = Math.sqrt(returns.reduce((s, r) => s + (r - mean) ** 2, 0) / (n - 1)) * Math.sqrt(252);

    // Return distribution
    const sorted = [...returns].sort((a, b) => a - b);
    const VaR5 = sorted[Math.floor(n * 0.05)] ?? -0.02;
    const tail = sorted.slice(0, Math.max(1, Math.floor(n * 0.05)));
    const CVaR5 = tail.reduce((s, r) => s + r, 0) / tail.length;

    const returnDist: ReturnDistribution = {
      returns,
      mean: Math.round(mean * 10000) / 10000,
      volatility: Math.round(vol * 10000) / 10000,
      skewness: Math.round(calcSkewness(returns) * 1000) / 1000,
      kurtosis: Math.round(calcKurtosis(returns) * 1000) / 1000,
      VaR5: Math.round(VaR5 * 10000) / 10000,
      CVaR5: Math.round(CVaR5 * 10000) / 10000,
      minReturn: Math.round(sorted[0] * 10000) / 10000,
      maxReturn: Math.round(sorted[sorted.length - 1] * 10000) / 10000,
    };

    // Risk-adjusted metrics
    const downside = returns.filter(r => r < 0);
    const downsideVol = downside.length > 0
      ? Math.sqrt(downside.reduce((s, r) => s + r ** 2, 0) / downside.length) * Math.sqrt(252)
      : 0.01;

    const rf = 0.0;
    const excessReturn = annMean - rf;

    const sharpe = vol > 0 ? excessReturn / vol : 0;
    const sortino = downsideVol > 0 ? excessReturn / downsideVol : 0;
    const calmar = maxDrawdown > 0 ? annMean / Math.abs(maxDrawdown) : 0;
    const marRatio = maxDrawdown > 0 ? annMean / Math.abs(maxDrawdown) : 0;

    // Probabilistic Sharpe (Prosperan)
    const trackSharpe = returns.length;
    const probSharpe = Math.max(0, normalCDF(
      sharpe * Math.sqrt(trackSharpe / 12) / Math.sqrt(1 + sharpe ** 2 * (trackSharpe - 1) / (trackSharpe - 3))
    ));

    // Tail Sharpe (using CVaR)
    const tailSharpe = Math.abs(CVaR5) > 0 ? excessReturn / Math.abs(CVaR5 * Math.sqrt(252)) : 0;

    // Adjusted Sharpe (skew/kurtosis)
    const skew = calcSkewness(returns);
    const kurt = calcKurtosis(returns);
    const adjustedSharpe = sharpe * (1 + skew / 6 * sharpe - kurt / 24 * sharpe ** 2);

    // Upside ratio
    const upside = returns.filter(r => r > 0);
    const upsideVol = upside.length > 0
      ? Math.sqrt(upside.reduce((s, r) => s + r ** 2, 0) / upside.length) * Math.sqrt(252)
      : 0.01;
    const upsideRatio = downsideVol > 0 ? upsideVol / downsideVol : 1;

    // Gain to pain
    const totalGain = returns.filter(r => r > 0).reduce((s, r) => s + r, 0);
    const totalPain = Math.abs(returns.filter(r => r < 0).reduce((s, r) => s + r, 0));
    const gainToPain = totalPain > 0 ? totalGain / totalPain : 0;

    const metrics: RiskAdjustedMetrics = {
      sharpeRatio: Math.round(sharpe * 100) / 100,
      sortinoRatio: Math.round(sortino * 100) / 100,
      calmarRatio: Math.round(calmar * 100) / 100,
      MARRatio: Math.round(marRatio * 100) / 100,
      probabilisticSharpe: Math.round(probSharpe * 100) / 100,
      tailSharpe: Math.round(tailSharpe * 100) / 100,
      upsideRatio: Math.round(upsideRatio * 100) / 100,
      gainToPain: Math.round(gainToPain * 100) / 100,
      adjustedSharpe: Math.round(adjustedSharpe * 100) / 100,
    };

    // Kelly
    const wins = returns.filter(r => r > 0);
    const losses = returns.filter(r => r < 0);
    const winRate = returns.length > 0 ? wins.length / returns.length : 0;
    const avgWin = wins.length > 0 ? wins.reduce((a, b) => a + b, 0) / wins.length : 0;
    const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((a, b) => a + b, 0) / losses.length) : 0.01;
    const payoffRatio = avgLoss > 0 ? avgWin / avgLoss : 1;

    const p = winRate, q = 1 - p, b = payoffRatio;
    const kellyF = p > 0 && q > 0 && b > 0 ? (p * b - q) / b : 0;
    const kellyFraction = Math.max(0, Math.min(1, kellyF));

    // Risk of ruin (simplified)
    const kellyLossProb = Math.pow(q, 10); // P(lose 2^N after N Kelly bets)
    const riskOfRuin = Math.pow(Math.abs(q - b * p), 10);

    const kelly: KellyResult = {
      kellyFraction: Math.round(kellyFraction * 1000) / 1000,
      halfKelly: Math.round(kellyFraction * 0.5 * 1000) / 1000,
      quarterKelly: Math.round(kellyFraction * 0.25 * 1000) / 1000,
      winRate: Math.round(winRate * 1000) / 1000,
      avgWin: Math.round(avgWin * 10000) / 10000,
      avgLoss: Math.round(avgLoss * 10000) / 10000,
      payoffRatio: Math.round(payoffRatio * 100) / 100,
      riskOfRuin: Math.round(riskOfRuin * 1000) / 1000,
      optimizedSize: Math.round(kellyFraction * 0.25 * 1000) / 1000, // Conservative quarter Kelly
    };

    // Rankings
    const rankings = {
      sharpeRank: 0,
      calmarRank: 0,
      sortinoRank: 0,
      marRank: 0,
      overallRank: 0,
    };

    const recommendations: string[] = [];
    if (sharpe > 1.5) recommendations.push('✅ Excellent risk-adjusted return (Sharpe > 1.5)');
    if (sharpe < 0.5 && sharpe > 0) recommendations.push('⚠️ Low Sharpe — strategy needs improvement');
    if (sharpe < 0) recommendations.push('🚨 Negative Sharpe — review strategy viability');
    if (kellyFraction > 0.5) recommendations.push('⚠️ High Kelly fraction — consider reducing position size');
    if (skew < -0.5) recommendations.push('⚠️ Negative skew — strategy has occasional large losses');
    if (kurt > 5) recommendations.push('⚠️ High kurtosis — fat tails / extreme events');
    if (gainToPain > 2) recommendations.push(`📈 High gain-to-pain ratio: ${gainToPain.toFixed(2)}`);
    if (recommendations.length === 0) recommendations.push('✅ Risk-adjusted metrics within acceptable range');

    return {
      strategyId,
      metrics,
      kelly,
      returnDist,
      rankings,
      recommendations,
      timestamp: Date.now(),
    };
  }

  // ── Multi-Strategy Comparison ──────────────────────────────────────

  compareStrategies(
    results: RAROptimizerResult[]
  ): Array<{ strategyId: string; overallScore: number; rank: number }> {
    if (results.length === 0) return [];

    // Normalize each metric to 0-1 and rank
    const sharpeScores = results.map(r => r.metrics.sharpeRatio);
    const calmarScores = results.map(r => r.metrics.calmarRatio);
    const sortinoScores = results.map(r => r.metrics.sortinoRatio);
    const marScores = results.map(r => r.metrics.MARRatio);

    const maxSharpe = Math.max(...sharpeScores, 1);
    const maxCalmar = Math.max(...calmarScores, 1);
    const maxSortino = Math.max(...sortinoScores, 1);
    const maxMAR = Math.max(...marScores, 1);

    return results.map((r, i) => {
      const overallScore = (
        (r.metrics.sharpeRatio / maxSharpe) * 0.3 +
        (r.metrics.calmarRatio / maxCalmar) * 0.3 +
        (r.metrics.sortinoRatio / maxSortino) * 0.2 +
        (r.metrics.MARRatio / maxMAR) * 0.2
      ) * 100;

      r.rankings = {
        sharpeRank: results.filter(x => x.metrics.sharpeRatio > r.metrics.sharpeRatio).length + 1,
        calmarRank: results.filter(x => x.metrics.calmarRatio > r.metrics.calmarRatio).length + 1,
        sortinoRank: results.filter(x => x.metrics.sortinoRatio > r.metrics.sortinoRatio).length + 1,
        marRank: results.filter(x => x.metrics.MARRatio > r.metrics.MARRatio).length + 1,
        overallRank: 0,
      };

      return {
        strategyId: r.strategyId,
        overallScore: Math.round(overallScore * 10) / 10,
        rank: 0,
      };
    }).sort((a, b) => b.overallScore - a.overallScore)
      .map((item, idx) => ({ ...item, rank: idx + 1 }));
  }

  private emptyResult(strategyId: string): RAROptimizerResult {
    return {
      strategyId,
      metrics: { sharpeRatio: 0, sortinoRatio: 0, calmarRatio: 0, MARRatio: 0, probabilisticSharpe: 0, tailSharpe: 0, upsideRatio: 0, gainToPain: 0, adjustedSharpe: 0 },
      kelly: { kellyFraction: 0, halfKelly: 0, quarterKelly: 0, winRate: 0, avgWin: 0, avgLoss: 0, payoffRatio: 0, riskOfRuin: 0, optimizedSize: 0 },
      returnDist: { returns: [], mean: 0, volatility: 0, skewness: 0, kurtosis: 0, VaR5: 0, CVaR5: 0, minReturn: 0, maxReturn: 0 },
      rankings: { sharpeRank: 0, calmarRank: 0, sortinoRank: 0, marRank: 0, overallRank: 0 },
      recommendations: [],
      timestamp: Date.now(),
    };
  }
}

export default RAROptimizer;
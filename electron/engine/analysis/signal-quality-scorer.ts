// ── Q63: Signal Quality Scorer ────────────────────────────────────────────────
// Scores the quality/reliability of trading signals before execution
// Evaluates: consistency, edge persistence, data quality, false signal rate

import log from 'electron-log';
import { EngineError } from '../../../electron/engine/core/engine-error';
void EngineError; // [EngineError:SYSTEM] structured error tracking

// ── Types ──────────────────────────────────────────────────────────────────

export interface QualityScore {
  overall: number;              // 0-100
  grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';

  // Sub-scores
  edgeStrength: number;         // 0-100: how strong is the edge
  consistency: number;           // 0-100: how consistent across events
  dataQuality: number;          // 0-100: data reliability
  persistence: number;           // 0-100: does it persist over time
  specificity: number;           // 0-100: how precise are entry/exit rules

  // Diagnostics
  estimatedWinRate: number;     // 0-1
  expectedSharpe: number;
  signalReliability: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNCERTAIN';
  warnings: string[];
  recommendation: 'EXECUTE' | 'PROCEED_WITH_CAUTION' | 'REJECT';
}

export interface BacktestEvidence {
  totalTrades: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  sharpeRatio: number;
  maxDrawdown: number;
  calmarRatio: number;
  expectancy: number;
  consecutiveWins: number;
  consecutiveLosses: number;
  recoveryFactor: number;
}

export interface SignalQualityReport {
  signalType: string;
  timestamp: number;
  quality: QualityScore;
  backtestEvidence: BacktestEvidence | null;
  marketConditionFit: 'TRENDING' | 'RANGE_BOUND' | 'VOLATILE' | 'ALL';
  timeOfDayFit: 'OPEN' | 'MID' | 'CLOSE' | 'ALL';
  recentPerformance: number;    // last 20 trades win rate
  trendConfirmation: boolean;
  volumeConfirmation: boolean;
  consensusScore: number;      // 0-1: multiple indicators agree
  compositeScore: number;      // 0-100 final score
}

// ── Scoring Helpers ───────────────────────────────────────────────────────

function gradeFromScore(score: number): QualityScore['grade'] {
  if (score >= 95) return 'A+';
  if (score >= 85) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

function percentileRank(value: number, values: number[]): number {
  if (values.length === 0) return 50;
  const sorted = [...values].sort((a, b) => a - b);
  const below = sorted.filter(v => v < value).length;
  return Math.round(below / sorted.length * 100);
}

// ── Signal Quality Scorer ────────────────────────────────────────────────

export class SignalQualityScorer {
  constructor() {
    log.info('[SignalQualityScorer] Initialized');
  }

  // ── Score a Signal ──────────────────────────────────────────────────

  score(
    signalType: string,
    marketContext?: {
      trendStrength?: number;      // 0-1
      volatility?: number;         // 0-1 (low to high)
      volumeRatio?: number;         // current/avg
      marketRegime?: 'TRENDING' | 'RANGE' | 'VOLATILE' | 'NEUTRAL';
    },
    backtestHistory?: Array<{
      outcome: 'WIN' | 'LOSS' | 'BREAKEVEN';
      pnl: number;
      drawdown: number;
      holdDays: number;
    }>,
    signalParams?: {
      specificity?: 'HIGH' | 'MEDIUM' | 'LOW';
      entryPrecision?: number;      // 0-1 (how tight is the entry rule)
      ruleClarity?: number;         // 0-1 (how clear is the rule)
    }
  ): SignalQualityReport {
    log.info(`[SignalQualityScorer] Scoring: ${signalType}`);

    // Evidence from backtest
    let evidence: BacktestEvidence | null = null;
    let estimatedWinRate = 0.5;
    let expectedSharpe = 0;
    let recentPerf = 0.5;

    if (backtestHistory && backtestHistory.length > 0) {
      const wins = backtestHistory.filter(t => t.outcome === 'WIN');
      const losses = backtestHistory.filter(t => t.outcome === 'LOSS');
      const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + t.pnl, 0) / wins.length : 0;
      const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((s, t) => s + t.pnl, 0) / losses.length) : 1;

      const pnlValues = backtestHistory.map(t => t.pnl);
      const mean = pnlValues.reduce((a, b) => a + b, 0) / pnlValues.length;
      const stdDev = Math.sqrt(pnlValues.reduce((s, v) => s + (v - mean) ** 2, 0) / pnlValues.length);
      const maxDD = Math.min(...pnlValues.map((_, i) =>
        Math.min(...pnlValues.slice(0, i + 1))
      ));

      estimatedWinRate = wins.length / backtestHistory.length;
      expectedSharpe = stdDev > 0 ? (mean / stdDev) * Math.sqrt(252 / (backtestHistory.reduce((s, t) => s + t.holdDays, 0) / backtestHistory.length)) : 0;
      recentPerf = backtestHistory.slice(-20).filter(t => t.outcome === 'WIN').length / Math.max(backtestHistory.slice(-20).length, 1);

      evidence = {
        totalTrades: backtestHistory.length,
        winRate: Math.round(estimatedWinRate * 100) / 100,
        avgWin: Math.round(avgWin * 100) / 100,
        avgLoss: Math.round(avgLoss * 100) / 100,
        profitFactor: avgLoss > 0 ? Math.round((avgWin * wins.length) / (avgLoss * losses.length) * 100) / 100 : 0,
        sharpeRatio: Math.round(expectedSharpe * 100) / 100,
        maxDrawdown: Math.round(maxDD * 100) / 100,
        calmarRatio: Math.abs(maxDD) > 0 ? Math.round((mean * 252) / Math.abs(maxDD) * 100) / 100 : 0,
        expectancy: Math.round((estimatedWinRate * avgWin - (1 - estimatedWinRate) * avgLoss) * 100) / 100,
        consecutiveWins: this.maxConsecutive(backtestHistory, 'WIN'),
        consecutiveLosses: this.maxConsecutive(backtestHistory, 'LOSS'),
        recoveryFactor: Math.abs(maxDD) > 0 ? Math.round((pnlValues.reduce((a, b) => a + b, 0)) / Math.abs(maxDD) * 100) / 100 : 0,
      };
    }

    // Edge strength
    const edgeStrength = evidence
      ? Math.min(100, Math.round((evidence.expectancy > 0 ? evidence.expectancy / 100 * 100 : 0) +
          (evidence.winRate > 0.5 ? (evidence.winRate - 0.5) * 100 : 0) +
          (evidence.profitFactor > 1 ? (evidence.profitFactor - 1) * 30 : 0)))
      : (marketContext?.trendStrength ?? 0.5) * 50 + 30;

    // Consistency
    const consistency = evidence
      ? Math.min(100, Math.round(
          (1 - Math.abs(evidence.winRate - estimatedWinRate)) * 50 +
          (evidence.profitFactor > 1.5 ? 30 : evidence.profitFactor > 1 ? 20 : 0) +
          (evidence.recentPerf ?? 0) * 20
        ))
      : 60;

    // Data quality
    const dataQuality = marketContext
      ? Math.min(100, Math.round(80 +
          ((marketContext.volumeRatio ?? 1) > 0.8 && (marketContext.volumeRatio ?? 1) < 2 ? 10 : 0) +
          ((marketContext.volatility ?? 0.5) < 0.8 ? 10 : -10)))
      : 75;

    // Persistence
    const persistence = evidence
      ? Math.min(100, Math.round(
          (evidence.totalTrades > 100 ? 40 : evidence.totalTrades > 30 ? 25 : 10) +
          (evidence.sharpeRatio > 1.5 ? 30 : evidence.sharpeRatio > 1 ? 20 : evidence.sharpeRatio > 0.5 ? 10 : 0) +
          (evidence.maxDrawdown > -0.10 ? 20 : evidence.maxDrawdown > -0.20 ? 10 : 0) +
          (evidence.calmarRatio > 2 ? 10 : evidence.calmarRatio > 1 ? 5 : 0)
        ))
      : 50;

    // Specificity
    const specificity = signalParams
      ? Math.min(100, Math.round(
          (signalParams.specificity === 'HIGH' ? 40 : signalParams.specificity === 'MEDIUM' ? 25 : 10) +
          (signalParams.entryPrecision ?? 0.5) * 30 +
          (signalParams.ruleClarity ?? 0.5) * 30
        ))
      : 60;

    // Composite
    const overall = Math.round(
      edgeStrength * 0.30 +
      consistency * 0.20 +
      dataQuality * 0.15 +
      persistence * 0.20 +
      specificity * 0.15
    );

    // Warnings
    const warnings: string[] = [];
    if (evidence && evidence.totalTrades < 30) warnings.push('Limited backtest data (<30 trades) — confidence reduced');
    if (evidence && evidence.maxDrawdown < -0.20) warnings.push('High drawdown in backtest (>20%) — verify risk controls');
    if (evidence && evidence.sharpeRatio < 0.5) warnings.push('Low Sharpe ratio — signal may not justify execution costs');
    if (marketContext && marketContext.marketRegime === 'VOLATILE') warnings.push('High volatility regime — consider reducing position size');
    if (recentPerf < estimatedWinRate - 0.15) warnings.push('Recent performance deterioration — possible edge decay');
    if (specificity < 50) warnings.push('Low rule specificity — may produce false signals');

    // Recommendation
    let recommendation: QualityScore['recommendation'];
    if (overall >= 80 && warnings.length <= 1) recommendation = 'EXECUTE';
    else if (overall >= 60 || (overall >= 50 && warnings.length <= 2)) recommendation = 'PROCEED_WITH_CAUTION';
    else recommendation = 'REJECT';

    const quality: QualityScore = {
      overall,
      grade: gradeFromScore(overall),
      edgeStrength: Math.round(edgeStrength),
      consistency: Math.round(consistency),
      dataQuality: Math.round(dataQuality),
      persistence: Math.round(persistence),
      specificity: Math.round(specificity),
      estimatedWinRate: Math.round(estimatedWinRate * 100) / 100,
      expectedSharpe: Math.round(expectedSharpe * 100) / 100,
      signalReliability: overall >= 75 ? 'HIGH' : overall >= 55 ? 'MEDIUM' : overall >= 35 ? 'LOW' : 'UNCERTAIN',
      warnings,
      recommendation,
    };

    // Market fit
    const marketFit = marketContext?.marketRegime ?? 'ALL';

    // Consensus
    const consensusScore = marketContext
      ? Math.round(((marketContext.trendStrength ?? 0.5) * 0.4 +
          (marketContext.volumeRatio ?? 1 > 1 ? 0.3 : 0.1) +
          (marketContext.volatility ?? 0.5 < 0.6 ? 0.3 : 0.1)) * 100) / 100
      : 0.5;

    return {
      signalType,
      timestamp: Date.now(),
      quality,
      backtestEvidence: evidence,
      marketConditionFit: (marketFit as SignalQualityReport['marketConditionFit']),
      timeOfDayFit: 'ALL',
      recentPerformance: Math.round(recentPerf * 100) / 100,
      trendConfirmation: (marketContext?.trendStrength ?? 0) > 0.5,
      volumeConfirmation: (marketContext?.volumeRatio ?? 1) > 1.1,
      consensusScore: Math.round(consensusScore * 100) / 100,
      compositeScore: overall,
    };
  }

  // ── Batch Score ─────────────────────────────────────────────────────

  scoreMultiple(
    signals: Array<{
      signalType: string;
      marketContext?: SignalQualityReport extends { marketContext?: infer C } ? C : never;
      backtestHistory?: SignalQualityReport extends { backtestEvidence?: infer E } ? E extends null ? never : E['backtestHistory'] : never;
      signalParams?: SignalQualityReport extends { signalParams?: infer P } ? P : never;
    }>
  ): SignalQualityReport[] {
    return signals.map(s => this.score(
      s.signalType,
      s.marketContext as Parameters<typeof this.score>[1],
      s.backtestHistory as Parameters<typeof this.score>[2],
      s.signalParams as Parameters<typeof this.score>[3]
    ));
  }

  // ── Compare Signals ──────────────────────────────────────────────────

  compare(a: SignalQualityReport, b: SignalQualityReport): SignalQualityReport[] {
    return [a, b].sort((x, y) => y.compositeScore - x.compositeScore);
  }

  private maxConsecutive(
    history: Array<{ outcome: string }>,
    target: string
  ): number {
    let max = 0, current = 0;
    for (const t of history) {
      if (t.outcome === target) { current++; max = Math.max(max, current); }
      else current = 0;
    }
    return max;
  }
}

export default SignalQualityScorer;
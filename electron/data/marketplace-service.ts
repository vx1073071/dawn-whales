// ── Marketplace Service — strategy marketplace ───────────────────────────────
// / /
// JVS WP: Sprint 1

import log from 'electron-log';
import type { DatabaseManager } from './database';
import i18n from '../i18n/main-i18n';
import { EngineError } from './engine/core/engine-error';


// ── config ──────────────────────────────────────────────────────────────

interface ScoringWeights {
  annualReturn: number;    // annualized returnweight
  sharpeRatio: number;     // Sharpe ratioweight
  maxDrawdown: number;     // max drawdownweight
  winRate: number;         // win rateweight
  tradeCount: number;      // trade countweight（sample size）
}

const DEFAULT_WEIGHTS: ScoringWeights = {
  annualReturn: 0.30,      // 30% — return is core
  sharpeRatio: 0.25,       // 25% — risk-adjusted return
  maxDrawdown: 0.25,       // 25% — drawdown control
  winRate: 0.10,           // 10% — win rate
  tradeCount: 0.10,        // 10% — sample size
};

// ── parameter ────────────────────────────────────────────────────

interface ScoringBenchmarks {
 // annualized return： / / /
  annualReturnExcellent: number;   // 30%+ →
  annualReturnGood: number;        // 15%+ → 80
  annualReturnFair: number;        // 5%+ → 60
  
  // Sharpe ratio
  sharpeExcellent: number;         // 2.0+ →
  sharpeGood: number;              // 1.5+ → 80
  sharpeFair: number;              // 1.0+ → 60
  
 // max drawdown
  drawdownExcellent: number;       // -5% →
  drawdownGood: number;            // -10% → 80
  drawdownFair: number;            // -20% → 60
  
  // win rate
  winRateExcellent: number;        // 60%+ →
  winRateGood: number;             // 50%+ → 80
  winRateFair: number;             // 40%+ → 60
  
 // trade count（sample size）
  tradeCountExcellent: number;     // 100+ →
  tradeCountGood: number;          // 50+ → 80
  tradeCountFair: number;          // 20+ → 60
  tradeCountMin: number;           // <10 → ，
}

const DEFAULT_BENCHMARKS: ScoringBenchmarks = {
  annualReturnExcellent: 30,
  annualReturnGood: 15,
  annualReturnFair: 5,
  
  sharpeExcellent: 2.0,
  sharpeGood: 1.5,
  sharpeFair: 1.0,
  
  drawdownExcellent: -5,
  drawdownGood: -10,
  drawdownFair: -20,
  
  winRateExcellent: 60,
  winRateGood: 50,
  winRateFair: 40,
  
  tradeCountExcellent: 100,
  tradeCountGood: 50,
  tradeCountFair: 20,
  tradeCountMin: 10,
};

// ── ──────────────────────────────────────────────────────────────

interface ScoreBreakdown {
  totalScore: number;           // 0-100
  dimensions: {
    annualReturn: number;       // 0-100
    sharpeRatio: number;        // 0-100
    maxDrawdown: number;        // 0-100
    winRate: number;            // 0-100
    tradeCount: number;         // 0-100
  };
  grade: string;                // S/A/B/C/D/F
  recommendation: string;
  warnings: string[];           // hint
}

// ── ──────────────────────────────────────────────────────────

interface VerificationResult {
  verified: boolean;
  confidence: number;           // 0-1
  backtestMetrics: {
    annualReturn: number;
    sharpeRatio: number;
    maxDrawdown: number;
    winRate: number;
    totalTrades: number;
  };
  liveMetrics: {
    annualReturn: number;
    sharpeRatio: number;
    maxDrawdown: number;
    winRate: number;
    totalTrades: number;
  } | null;
  deviation: {
    annualReturn: number;
    sharpeRatio: number;
    maxDrawdown: number;
    winRate: number;
  } | null;
  badge: 'gold' | 'silver' | 'bronze' | 'unverified';
  reason: string;
}

// ── Marketplace Service ───────────────────────────────────────────────────

export class MarketplaceService {
  private db: DatabaseManager;
  private weights: ScoringWeights;
  private benchmarks: ScoringBenchmarks;

  constructor(db: DatabaseManager, weights?: Partial<ScoringWeights>, benchmarks?: Partial<ScoringBenchmarks>) {
    this.db = db;
    this.weights = { ...DEFAULT_WEIGHTS, ...weights };
    this.benchmarks = { ...DEFAULT_BENCHMARKS, ...benchmarks };
    log.info('[MarketplaceService] Initialized');
  }

 // ── ──────────────────────────────────────────────────────

  /**
 * strategy/policy (0-100)
 * backtest result + user +
   */
  calculateStrategyScore(strategyId: string): ScoreBreakdown {
 // 1. backtest result
    const backtests = this.db.getBacktestResults(strategyId);
    if (!backtests || backtests.length === 0) {
      return {
        totalScore: 0,
        dimensions: { annualReturn: 0, sharpeRatio: 0, maxDrawdown: 0, winRate: 0, tradeCount: 0 },
        grade: 'F',
        recommendation: i18n.t('marketplace.k1'),
        warnings: [i18n.t('marketplace.k2')],
      };
    }

 // backtest
    const latest = backtests[0] as unknown;
    const annualReturn = latest.annual_return || 0;
    const sharpeRatio = latest.sharpe_ratio || 0;
    const maxDrawdown = latest.max_drawdown || 0;
    const winRate = latest.win_rate || 0;
    const totalTrades = latest.total_trades || 0;

 // 2. (0-100)
    const scoreAnnualReturn = this.scoreAnnualReturn(annualReturn);
    const scoreSharpe = this.scoreSharpeRatio(sharpeRatio);
    const scoreDrawdown = this.scoreMaxDrawdown(maxDrawdown);
    const scoreWinRate = this.scoreWinRate(winRate);
    const scoreTradeCount = this.scoreTradeCount(totalTrades);

 // 3.
    const totalScore = Math.round(
      scoreAnnualReturn * this.weights.annualReturn +
      scoreSharpe * this.weights.sharpeRatio +
      scoreDrawdown * this.weights.maxDrawdown +
      scoreWinRate * this.weights.winRate +
      scoreTradeCount * this.weights.tradeCount
    );

 // 4. /
    const verification = this.verifyPerformance(strategyId);
    let adjustedScore = totalScore;
    if (verification.verified) {
      if (verification.confidence >= 0.8) {
        adjustedScore = Math.min(100, totalScore + 5);  // 5
      } else if (verification.confidence >= 0.5) {
        adjustedScore = Math.min(100, totalScore + 2);  // 2
      }
    }

 // 5.
    const grade = this.scoreToGrade(adjustedScore);
    const recommendation = this.generateRecommendation(adjustedScore, verification);
    const warnings = this.generateWarnings(latest, verification, totalTrades);

    return {
      totalScore: adjustedScore,
      dimensions: {
        annualReturn: scoreAnnualReturn,
        sharpeRatio: scoreSharpe,
        maxDrawdown: scoreDrawdown,
        winRate: scoreWinRate,
        tradeCount: scoreTradeCount,
      },
      grade,
      recommendation,
      warnings,
    };
  }

 // ── ────────────────────────────────────────────────────

  private scoreAnnualReturn(value: number): number {
    const b = this.benchmarks;
    if (value >= b.annualReturnExcellent) return 100;
    if (value >= b.annualReturnGood) return 80 + (value - b.annualReturnGood) / (b.annualReturnExcellent - b.annualReturnGood) * 20;
    if (value >= b.annualReturnFair) return 60 + (value - b.annualReturnFair) / (b.annualReturnGood - b.annualReturnFair) * 20;
    if (value >= 0) return 40 + value / b.annualReturnFair * 20;
    return Math.max(0, 40 + value * 2);
  }

  private scoreSharpeRatio(value: number): number {
    const b = this.benchmarks;
    if (value >= b.sharpeExcellent) return 100;
    if (value >= b.sharpeGood) return 80 + (value - b.sharpeGood) / (b.sharpeExcellent - b.sharpeGood) * 20;
    if (value >= b.sharpeFair) return 60 + (value - b.sharpeFair) / (b.sharpeGood - b.sharpeFair) * 20;
    if (value >= 0) return 40 + value / b.sharpeFair * 20;
    return Math.max(0, 40 + value * 20);
  }

  private scoreMaxDrawdown(value: number): number {
 // value ， -15 15%
    const b = this.benchmarks;
    if (value >= b.drawdownExcellent) return 100;
    if (value >= b.drawdownGood) return 80 + (value - b.drawdownGood) / (b.drawdownExcellent - b.drawdownGood) * 20;
    if (value >= b.drawdownFair) return 60 + (value - b.drawdownFair) / (b.drawdownGood - b.drawdownFair) * 20;
    if (value >= -30) return 40 + (value + 30) / (b.drawdownFair + 30) * 20;
    return Math.max(0, 40 + (value + 30));  // -30%
  }

  private scoreWinRate(value: number): number {
    const b = this.benchmarks;
    if (value >= b.winRateExcellent) return 100;
    if (value >= b.winRateGood) return 80 + (value - b.winRateGood) / (b.winRateExcellent - b.winRateGood) * 20;
    if (value >= b.winRateFair) return 60 + (value - b.winRateFair) / (b.winRateGood - b.winRateFair) * 20;
    if (value >= 30) return 40 + (value - 30) / (b.winRateFair - 30) * 20;
    return Math.max(0, value * 1.3);
  }

  private scoreTradeCount(value: number): number {
    const b = this.benchmarks;
    if (value >= b.tradeCountExcellent) return 100;
    if (value >= b.tradeCountGood) return 80 + (value - b.tradeCountGood) / (b.tradeCountExcellent - b.tradeCountGood) * 20;
    if (value >= b.tradeCountFair) return 60 + (value - b.tradeCountFair) / (b.tradeCountGood - b.tradeCountFair) * 20;
    if (value >= b.tradeCountMin) return 40 + (value - b.tradeCountMin) / (b.tradeCountFair - b.tradeCountMin) * 20;
    return Math.max(0, value * 4);  // <10
  }

 // ── ──────────────────────────────────────────────────────

  /**
 * strategy/policy：backtest result vs
 * back + +
   */
  verifyPerformance(strategyId: string): VerificationResult {
 // 1. backtest
    const backtests = this.db.getBacktestResults(strategyId);
    if (!backtests || backtests.length === 0) {
      return {
        verified: false,
        confidence: 0,
        backtestMetrics: { annualReturn: 0, sharpeRatio: 0, maxDrawdown: 0, winRate: 0, totalTrades: 0 },
        liveMetrics: null,
        deviation: null,
        badge: 'unverified',
        reason: i18n.t('marketplace.k3'),
      };
    }

    const latest = backtests[0] as unknown;
    const backtestMetrics = {
      annualReturn: latest.annual_return || 0,
      sharpeRatio: latest.sharpe_ratio || 0,
      maxDrawdown: latest.max_drawdown || 0,
      winRate: latest.win_rate || 0,
      totalTrades: latest.total_trades || 0,
    };

 // 2. transaction history
    const trades = this.db.getTrades(strategyId, 200);
    const executedTrades = trades.filter((t: unknown) => t.status === 'filled' && t.executed_at);

    if (executedTrades.length < 5) {
      return {
        verified: false,
        confidence: 0,
        backtestMetrics,
        liveMetrics: null,
        deviation: null,
        badge: 'unverified',
        reason: i18n.t('marketplace.k4'),
      };
    }

 // 3. metric
    const liveMetrics = this.calculateLiveMetrics(executedTrades);

 // 4.
    const deviation = {
      annualReturn: this.calcDeviation(backtestMetrics.annualReturn, liveMetrics.annualReturn),
      sharpeRatio: this.calcDeviation(backtestMetrics.sharpeRatio, liveMetrics.sharpeRatio),
      maxDrawdown: this.calcDeviation(backtestMetrics.maxDrawdown, liveMetrics.maxDrawdown),
      winRate: this.calcDeviation(backtestMetrics.winRate, liveMetrics.winRate),
    };

 // 5. (0-1)
    const confidence = this.calculateConfidence(deviation, executedTrades.length);
    const verified = confidence >= 0.5;

 // 6.
    const badge = this.assignBadge(confidence, deviation);

 // 7.
    const reason = this.generateVerificationReason(confidence, deviation, executedTrades.length);

    return { verified, confidence, backtestMetrics, liveMetrics, deviation, badge, reason };
  }

  private calculateLiveMetrics(trades: unknown[]): {
    annualReturn: number;
    sharpeRatio: number;
    maxDrawdown: number;
    winRate: number;
    totalTrades: number;
  } {
 // ： trades pnl pnl_pct
    const wins = trades.filter((t: unknown) => t.pnl > 0);
    const losses = trades.filter((t: unknown) => t.pnl <= 0);
    const winRate = trades.length > 0 ? (wins.length / trades.length) * 100 : 0;

 //
    const totalPnl = trades.reduce((sum: number, t: unknown) => sum + (t.pnl || 0), 0);
    const avgPnlPct = trades.length > 0
      ? trades.reduce((sum: number, t: unknown) => sum + (t.pnl_pct || 0), 0) / trades.length
      : 0;

 // position/holding 1 ）
    const firstTrade = trades[trades.length - 1] as unknown;
    const lastTrade = trades[0] as unknown;
    const days = firstTrade && lastTrade
      ? Math.max(1, (new Date(lastTrade.executed_at).getTime() - new Date(firstTrade.executed_at).getTime()) / 86400000)
      : 1;
    const annualReturn = (totalPnl / 100000) * (365 / days) * 100;  // 10

 // Sharpe standard deviation）
    const dailyReturns = trades.map((t: unknown) => t.pnl_pct || 0);
    const avgReturn = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
    const stdReturn = Math.sqrt(
      dailyReturns.reduce((sum, r) => sum + (r - avgReturn) ** 2, 0) / Math.max(1, dailyReturns.length - 1)
    );
    const sharpeRatio = stdReturn > 0 ? (avgReturn * 252) / (stdReturn * Math.sqrt(252)) : 0;

 // max drawdown
    let peak = 100000;
    let maxDD = 0;
    let equity = 100000;
    for (const t of trades.reverse()) {
      equity += t.pnl || 0;
      if (equity > peak) peak = equity;
      const dd = (peak - equity) / peak;
      if (dd > maxDD) maxDD = dd;
    }

    return {
      annualReturn: Math.round(annualReturn * 100) / 100,
      sharpeRatio: Math.round(sharpeRatio * 100) / 100,
      maxDrawdown: Math.round(-maxDD * 10000) / 100,
      winRate: Math.round(winRate * 10) / 10,
      totalTrades: trades.length,
    };
  }

  private calcDeviation(backtest: number, live: number): number {
    if (backtest === 0) return live === 0 ? 0 : 100;
    return Math.abs((live - backtest) / Math.abs(backtest)) * 100;
  }

  private calculateConfidence(deviation: unknown, tradeCount: number): number {
 // + →
    const avgDeviation = (
      deviation.annualReturn +
      deviation.sharpeRatio +
      deviation.maxDrawdown +
      deviation.winRate
    ) / 4;

 // ： 10% 0.1
    let confidence = 1.0 - (avgDeviation / 100) * 0.5;

 //
    if (tradeCount >= 50) confidence += 0.1;
    else if (tradeCount >= 20) confidence += 0.05;
    else if (tradeCount < 10) confidence -= 0.2;

    return Math.max(0, Math.min(1, Math.round(confidence * 100) / 100));
  }

  private assignBadge(confidence: number, deviation: unknown): 'gold' | 'silver' | 'bronze' | 'unverified' {
    const avgDeviation = (
      deviation.annualReturn +
      deviation.sharpeRatio +
      deviation.maxDrawdown +
      deviation.winRate
    ) / 4;

    if (confidence >= 0.8 && avgDeviation <= 15) return 'gold';      // 🥇 backtest
    if (confidence >= 0.6 && avgDeviation <= 30) return 'silver';    // 🥈
    if (confidence >= 0.4) return 'bronze';                          // 🥉
    return 'unverified';
  }

  private generateVerificationReason(confidence: number, deviation: unknown, tradeCount: number): string {
    if (confidence >= 0.8) return i18n.t('marketplace.k5');
    if (confidence >= 0.6) return i18n.t('marketplace.k6');
    if (confidence >= 0.4) return i18n.t('marketplace.k7');
    return i18n.t('marketplace.k8');
  }

 // ── ──────────────────────────────────────────────────────

  private scoreToGrade(score: number): string {
    if (score >= 90) return 'S';
    if (score >= 80) return 'A';
    if (score >= 70) return 'B';
    if (score >= 60) return 'C';
    if (score >= 40) return 'D';
    return 'F';
  }

  private generateRecommendation(score: number, verification: VerificationResult): string {
    if (score >= 85 && verification.badge === 'gold') {
      return i18n.t('marketplace.k9');
    }
    if (score >= 75) {
      return i18n.t('marketplace.k10');
    }
    if (score >= 60) {
      return i18n.t('marketplace.k11');
    }
    if (score >= 40) {
      return i18n.t('marketplace.k12');
    }
    return i18n.t('marketplace.k13');
  }

  private generateWarnings(backtest: unknown, verification: VerificationResult, tradeCount: number): string[] {
    const warnings: string[] = [];

    if (tradeCount < 20) {
      warnings.push(i18n.t('marketplace.k14'));
    }
    if (backtest.max_drawdown && backtest.max_drawdown < -25) {
      warnings.push(i18n.t('marketplace.k15'));
    }
    if (backtest.sharpe_ratio && backtest.sharpe_ratio < 0.5) {
      warnings.push(i18n.t('marketplace.k16'));
    }
    if (verification.badge === 'unverified') {
      warnings.push(i18n.t('marketplace.k17'));
    } else if (verification.confidence < 0.6) {
      warnings.push(i18n.t('marketplace.k18'));
    }

    return warnings;
  }

 // ── update ────────────────────────────────────────────────────

  /**
 * updatereleasestrategy/policy performance
   */
  updateAllScores(): { updated: number; errors: string[] } {
    const strategies = this.db.getMarketplaceStrategies('rating', 1000);
    let updated = 0;
    const errors: string[] = [];

    for (const s of strategies) {
      try {
        const score = this.calculateStrategyScore(s.id);
        const verification = this.verifyPerformance(s.id);

        this.db.saveStrategyPerformance({
          strategyId: s.id,
          period: 'all',
          annualReturn: score.totalScore,  // metric
          sharpeRatio: score.dimensions.sharpeRatio / 100 * 3,  // restore 0-3 Sharpe
          maxDrawdown: 0,  // restore
          winRate: score.dimensions.winRate,
          totalTrades: 0,
          verified: verification.verified,
        });

        updated++;
      } catch (e) {
        errors.push(`${s.id}: ${e.message}`);
      }
    }

    log.info(`[MarketplaceService] Updated ${updated} strategies, ${errors.length} errors`);
    return { updated, errors };
  }
}

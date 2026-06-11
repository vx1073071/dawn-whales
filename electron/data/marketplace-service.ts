// ── Marketplace Service — 策略市场业务逻辑 ───────────────────────────────
// 评分算法 / 收益验证 / 综合评估
// JVS WP: Sprint 1

import log from 'electron-log';
import type { DatabaseManager } from './database';
import i18n from '../../src/i18n';
import { EngineError } from './engine/core/engine-error';


// ── 评分配置 ──────────────────────────────────────────────────────────────

interface ScoringWeights {
  annualReturn: number;    // 年化收益率权重
  sharpeRatio: number;     // 夏普比率权重
  maxDrawdown: number;     // 最大回撤权重（负向）
  winRate: number;         // 胜率权重
  tradeCount: number;      // 交易次数权重（样本量）
}

const DEFAULT_WEIGHTS: ScoringWeights = {
  annualReturn: 0.30,      // 30% — 收益是核心
  sharpeRatio: 0.25,       // 25% — 风险调整后收益
  maxDrawdown: 0.25,       // 25% — 回撤控制
  winRate: 0.10,           // 10% — 胜率
  tradeCount: 0.10,        // 10% — 样本量（交易越多越可信）
};

// ── 评分维度标准化参数 ────────────────────────────────────────────────────

interface ScoringBenchmarks {
  // 年化收益率：优秀 / 良好 / 及格 / 差
  annualReturnExcellent: number;   // 30%+ → 满分
  annualReturnGood: number;        // 15%+ → 80分
  annualReturnFair: number;        // 5%+ → 60分
  
  // 夏普比率
  sharpeExcellent: number;         // 2.0+ → 满分
  sharpeGood: number;              // 1.5+ → 80分
  sharpeFair: number;              // 1.0+ → 60分
  
  // 最大回撤（负值，越小越好）
  drawdownExcellent: number;       // -5% → 满分
  drawdownGood: number;            // -10% → 80分
  drawdownFair: number;            // -20% → 60分
  
  // 胜率
  winRateExcellent: number;        // 60%+ → 满分
  winRateGood: number;             // 50%+ → 80分
  winRateFair: number;             // 40%+ → 60分
  
  // 交易次数（样本量可信度）
  tradeCountExcellent: number;     // 100+ → 满分
  tradeCountGood: number;          // 50+ → 80分
  tradeCountFair: number;          // 20+ → 60分
  tradeCountMin: number;           // <10 → 样本不足，大幅扣分
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

// ── 评分结果 ──────────────────────────────────────────────────────────────

interface ScoreBreakdown {
  totalScore: number;           // 0-100 总分
  dimensions: {
    annualReturn: number;       // 0-100
    sharpeRatio: number;        // 0-100
    maxDrawdown: number;        // 0-100
    winRate: number;            // 0-100
    tradeCount: number;         // 0-100
  };
  grade: string;                // S/A/B/C/D/F
  recommendation: string;       // 推荐语
  warnings: string[];           // 风险提示
}

// ── 收益验证结果 ──────────────────────────────────────────────────────────

interface VerificationResult {
  verified: boolean;
  confidence: number;           // 0-1 可信度
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
    annualReturn: number;       // 偏差百分比
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

  // ── 评分算法 ──────────────────────────────────────────────────────

  /**
   * 计算策略综合评分 (0-100)
   * 基于回测结果 + 用户评分 + 实盘验证（如有）
   */
  calculateStrategyScore(strategyId: string): ScoreBreakdown {
    // 1. 获取最新回测结果
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

    // 取最近一次回测
    const latest = backtests[0] as unknown;
    const annualReturn = latest.annual_return || 0;
    const sharpeRatio = latest.sharpe_ratio || 0;
    const maxDrawdown = latest.max_drawdown || 0;  // 负值
    const winRate = latest.win_rate || 0;
    const totalTrades = latest.total_trades || 0;

    // 2. 各维度评分 (0-100)
    const scoreAnnualReturn = this.scoreAnnualReturn(annualReturn);
    const scoreSharpe = this.scoreSharpeRatio(sharpeRatio);
    const scoreDrawdown = this.scoreMaxDrawdown(maxDrawdown);
    const scoreWinRate = this.scoreWinRate(winRate);
    const scoreTradeCount = this.scoreTradeCount(totalTrades);

    // 3. 加权总分
    const totalScore = Math.round(
      scoreAnnualReturn * this.weights.annualReturn +
      scoreSharpe * this.weights.sharpeRatio +
      scoreDrawdown * this.weights.maxDrawdown +
      scoreWinRate * this.weights.winRate +
      scoreTradeCount * this.weights.tradeCount
    );

    // 4. 实盘验证加分/扣分
    const verification = this.verifyPerformance(strategyId);
    let adjustedScore = totalScore;
    if (verification.verified) {
      if (verification.confidence >= 0.8) {
        adjustedScore = Math.min(100, totalScore + 5);  // 高可信度加5分
      } else if (verification.confidence >= 0.5) {
        adjustedScore = Math.min(100, totalScore + 2);  // 中可信度加2分
      }
    }

    // 5. 评级
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

  // ── 维度评分函数 ────────────────────────────────────────────────────

  private scoreAnnualReturn(value: number): number {
    const b = this.benchmarks;
    if (value >= b.annualReturnExcellent) return 100;
    if (value >= b.annualReturnGood) return 80 + (value - b.annualReturnGood) / (b.annualReturnExcellent - b.annualReturnGood) * 20;
    if (value >= b.annualReturnFair) return 60 + (value - b.annualReturnFair) / (b.annualReturnGood - b.annualReturnFair) * 20;
    if (value >= 0) return 40 + value / b.annualReturnFair * 20;
    return Math.max(0, 40 + value * 2);  // 负收益快速扣分
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
    // value 是负数，如 -15 表示 15% 回撤
    const b = this.benchmarks;
    if (value >= b.drawdownExcellent) return 100;
    if (value >= b.drawdownGood) return 80 + (value - b.drawdownGood) / (b.drawdownExcellent - b.drawdownGood) * 20;
    if (value >= b.drawdownFair) return 60 + (value - b.drawdownFair) / (b.drawdownGood - b.drawdownFair) * 20;
    if (value >= -30) return 40 + (value + 30) / (b.drawdownFair + 30) * 20;
    return Math.max(0, 40 + (value + 30));  // 超过 -30% 快速扣分
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
    return Math.max(0, value * 4);  // <10 笔交易严重扣分
  }

  // ── 收益验证 ──────────────────────────────────────────────────────

  /**
   * 验证策略收益：对比回测结果 vs 实盘交易
   * 返回验证结果 + 可信度 + 徽章
   */
  verifyPerformance(strategyId: string): VerificationResult {
    // 1. 获取回测数据
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

    // 2. 获取实盘交易记录
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

    // 3. 计算实盘指标
    const liveMetrics = this.calculateLiveMetrics(executedTrades);

    // 4. 计算偏差
    const deviation = {
      annualReturn: this.calcDeviation(backtestMetrics.annualReturn, liveMetrics.annualReturn),
      sharpeRatio: this.calcDeviation(backtestMetrics.sharpeRatio, liveMetrics.sharpeRatio),
      maxDrawdown: this.calcDeviation(backtestMetrics.maxDrawdown, liveMetrics.maxDrawdown),
      winRate: this.calcDeviation(backtestMetrics.winRate, liveMetrics.winRate),
    };

    // 5. 计算可信度 (0-1)
    const confidence = this.calculateConfidence(deviation, executedTrades.length);
    const verified = confidence >= 0.5;

    // 6. 徽章
    const badge = this.assignBadge(confidence, deviation);

    // 7. 原因
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
    // 简化计算：基于 trades 表的 pnl 和 pnl_pct
    const wins = trades.filter((t: unknown) => t.pnl > 0);
    const losses = trades.filter((t: unknown) => t.pnl <= 0);
    const winRate = trades.length > 0 ? (wins.length / trades.length) * 100 : 0;

    // 总收益
    const totalPnl = trades.reduce((sum: number, t: unknown) => sum + (t.pnl || 0), 0);
    const avgPnlPct = trades.length > 0
      ? trades.reduce((sum: number, t: unknown) => sum + (t.pnl_pct || 0), 0) / trades.length
      : 0;

    // 年化（简化：假设平均持仓 1 天）
    const firstTrade = trades[trades.length - 1] as unknown;
    const lastTrade = trades[0] as unknown;
    const days = firstTrade && lastTrade
      ? Math.max(1, (new Date(lastTrade.executed_at).getTime() - new Date(firstTrade.executed_at).getTime()) / 86400000)
      : 1;
    const annualReturn = (totalPnl / 100000) * (365 / days) * 100;  // 假设初始资金 10 万

    // 夏普（简化：日收益率标准差）
    const dailyReturns = trades.map((t: unknown) => t.pnl_pct || 0);
    const avgReturn = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
    const stdReturn = Math.sqrt(
      dailyReturns.reduce((sum, r) => sum + (r - avgReturn) ** 2, 0) / Math.max(1, dailyReturns.length - 1)
    );
    const sharpeRatio = stdReturn > 0 ? (avgReturn * 252) / (stdReturn * Math.sqrt(252)) : 0;

    // 最大回撤（简化：基于累计收益曲线）
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
      maxDrawdown: Math.round(-maxDD * 10000) / 100,  // 负值
      winRate: Math.round(winRate * 10) / 10,
      totalTrades: trades.length,
    };
  }

  private calcDeviation(backtest: number, live: number): number {
    if (backtest === 0) return live === 0 ? 0 : 100;
    return Math.abs((live - backtest) / Math.abs(backtest)) * 100;
  }

  private calculateConfidence(deviation: unknown, tradeCount: number): number {
    // 偏差越小 + 交易越多 → 可信度越高
    const avgDeviation = (
      deviation.annualReturn +
      deviation.sharpeRatio +
      deviation.maxDrawdown +
      deviation.winRate
    ) / 4;

    // 偏差惩罚：每 10% 偏差扣 0.1 可信度
    let confidence = 1.0 - (avgDeviation / 100) * 0.5;

    // 交易数量加成
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

    if (confidence >= 0.8 && avgDeviation <= 15) return 'gold';      // 🥇 实盘与回测高度一致
    if (confidence >= 0.6 && avgDeviation <= 30) return 'silver';    // 🥈 实盘表现良好
    if (confidence >= 0.4) return 'bronze';                          // 🥉 有实盘数据但偏差较大
    return 'unverified';                                             // 未验证
  }

  private generateVerificationReason(confidence: number, deviation: unknown, tradeCount: number): string {
    if (confidence >= 0.8) return i18n.t('marketplace.k5');
    if (confidence >= 0.6) return i18n.t('marketplace.k6');
    if (confidence >= 0.4) return i18n.t('marketplace.k7');
    return i18n.t('marketplace.k8');
  }

  // ── 辅助函数 ──────────────────────────────────────────────────────

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

  // ── 批量更新评分 ────────────────────────────────────────────────────

  /**
   * 批量更新所有已发布策略的 performance 表
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
          annualReturn: score.totalScore,  // 用总分作为综合指标
          sharpeRatio: score.dimensions.sharpeRatio / 100 * 3,  // 还原为 0-3 夏普
          maxDrawdown: 0,  // 从评分维度无法直接还原
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

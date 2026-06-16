/**
 * P1-13 BacktestAIInterpretationEngine — AI Backtest Interpretation Engine
 * R247 — AI Intelligence Sprint
 * JVS / 引擎虾
 *
 * Provides human-readable AI interpretation of backtest results:
 * Executive summary, highlights, judgment interpretation (bullish/bearish/neutral),
 * optimization suggestions, and comparison analysis.
 * Singleton pattern, fully testable with reset().
 */

import log from 'electron-log';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

/** Backtest input data */
export interface BacktestInput {
  /** Strategy name */
  strategyName: string;
  /** Symbol universe */
  symbols: string[];
  /** Market */
  market: string;
  /** Date range */
  dateRange: { start: string; end: string };
  /** Key metrics */
  metrics: BacktestMetrics;
  /** Trade list */
  trades?: BacktestTrade[];
  /** Benchmark metrics (optional, for comparison) */
  benchmark?: BacktestMetrics;
  /** Benchmark name */
  benchmarkName?: string;
}

/** Core backtest metrics */
export interface BacktestMetrics {
  totalReturn: number; // decimal, e.g. 0.15 = 15%
  annualizedReturn: number;
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdown: number;
  volatility: number;
  winRate: number;
  profitFactor: number;
  calmarRatio: number;
  totalTrades: number;
  avgHoldingDays: number;
  /** Additional data */
  alpha?: number;
  beta?: number;
  informationRatio?: number;
  trackingError?: number;
  monthlyReturns?: number[];
  yearlyReturns?: number[];
}

/** A single trade record */
export interface BacktestTrade {
  id: string;
  symbol: string;
  side: 'long' | 'short';
  entryDate: string;
  exitDate: string;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  pnl: number;
  pnlPct: number;
  holdingDays: number;
  tags?: string[];
}

/** AI interpretation result */
export interface AIInterpretation {
  /** Unique id */
  id: string;
  /** Input backtest reference */
  backtestInput: BacktestInput;
  /** Generated at */
  generatedAt: number;
  /** Model version used */
  modelVersion: string;

  /** Executive summary (2-3 sentences) */
  summary: string;
  /** Sentiment judgment */
  sentiment: 'bullish' | 'bearish' | 'neutral';
  /** Sentiment confidence 0-1 */
  sentimentConfidence: number;
  /** Sentiment reasoning */
  sentimentReasoning: string;

  /** Key highlights (3-5 bullet points) */
  highlights: string[];
  /** Risk warnings */
  riskWarnings: string[];

  /** Metric interpretation */
  metricInsights: MetricInsight[];
  /** Optimization suggestions */
  optimizationSuggestions: OptimizationSuggestion[];

  /** Comparison vs benchmark (if provided) */
  benchmarkComparison?: BenchmarkComparison;

  /** Overall score 0-100 */
  overallScore: number;
  /** Score breakdown */
  scoreBreakdown: Record<string, number>;

  /** Recommended action */
  recommendedAction: 'go_live' | 'optimize' | 'paper_trade' | 'discard' | 'review';
  /** Action reasoning */
  actionReasoning: string;
}

/** Interpretation of a single metric */
export interface MetricInsight {
  metricName: string;
  value: number;
  formattedValue: string;
  rating: 'excellent' | 'good' | 'average' | 'poor' | 'critical';
  interpretation: string;
}

/** Optimization suggestion */
export interface OptimizationSuggestion {
  id: string;
  category: 'risk' | 'return' | 'efficiency' | 'diversification' | 'entry_exit' | 'sizing';
  title: string;
  description: string;
  expectedImpact: 'high' | 'medium' | 'low';
  priority: number; // 1=highest
}

/** Benchmark comparison */
export interface BenchmarkComparison {
  benchmarkName: string;
  returnDiff: number;
  sharpeDiff: number;
  drawdownDiff: number;
  winRateDiff: number;
  outperformance: boolean;
  summary: string;
}

// ═══════════════════════════════════════════════════════════════
// Rating thresholds
// ═══════════════════════════════════════════════════════════════

const SHARPE_THRESHOLDS = { excellent: 2.0, good: 1.5, average: 1.0, poor: 0.5 };
const WIN_RATE_THRESHOLDS = { excellent: 0.65, good: 0.55, average: 0.45, poor: 0.35 };
const DRAWDOWN_THRESHOLDS = { excellent: 0.05, good: 0.10, average: 0.20, poor: 0.30 };
const RETURN_THRESHOLDS = { excellent: 0.30, good: 0.15, average: 0.05, poor: 0.0 };
const CALMAR_THRESHOLDS = { excellent: 3.0, good: 2.0, average: 1.0, poor: 0.5 };
const SORTINO_THRESHOLDS = { excellent: 2.5, good: 1.8, average: 1.0, poor: 0.5 };

// ═══════════════════════════════════════════════════════════════
// Engine
// ═══════════════════════════════════════════════════════════════

export class BacktestAIInterpretationEngine {
  private static instance: BacktestAIInterpretationEngine;

  /** All generated interpretations */
  private interpretations: Map<string, AIInterpretation> = new Map();
  /** ID counter */
  private idCounter = 0;

  private constructor() {}

  static getInstance(): BacktestAIInterpretationEngine {
    if (!BacktestAIInterpretationEngine.instance) {
      BacktestAIInterpretationEngine.instance = new BacktestAIInterpretationEngine();
    }
    return BacktestAIInterpretationEngine.instance;
  }

  /** Reset for testing */
  reset(): void {
    this.interpretations.clear();
    this.idCounter = 0;
  }

  // ═══════════════════════════════════════════════════════════════
  // Rating
  // ═══════════════════════════════════════════════════════════════

  /**
   * Rate a metric value against thresholds.
   * Higher is better for positive metrics (sharpe, return);
   * lower is better for negative metrics (drawdown).
   */
  private rateMetric(
    value: number,
    thresholds: Record<string, number>,
    lowerIsBetter: boolean = false,
  ): MetricInsight['rating'] {
    const levels = ['excellent', 'good', 'average', 'poor'] as const;
    if (!lowerIsBetter) {
      for (const level of levels) {
        if (value >= thresholds[level]) return level;
      }
      return 'critical';
    } else {
      // Lower is better: check in reverse
      for (const level of levels) {
        if (value <= thresholds[level]) return level;
      }
      return 'critical';
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Metric Insights
  // ═══════════════════════════════════════════════════════════════

  /** Generate insights for all metrics */
  private generateMetricInsights(m: BacktestMetrics): MetricInsight[] {
    const insights: MetricInsight[] = [];

    // Sharpe
    insights.push({
      metricName: 'sharpeRatio',
      value: m.sharpeRatio,
      formattedValue: m.sharpeRatio.toFixed(2),
      rating: this.rateMetric(m.sharpeRatio, SHARPE_THRESHOLDS),
      interpretation: this.interpretSharpe(m.sharpeRatio),
    });

    // Sortino
    if (m.sortinoRatio != null) {
      insights.push({
        metricName: 'sortinoRatio',
        value: m.sortinoRatio,
        formattedValue: m.sortinoRatio.toFixed(2),
        rating: this.rateMetric(m.sortinoRatio, SORTINO_THRESHOLDS),
        interpretation: this.interpretSortino(m.sortinoRatio),
      });
    }

    // Win rate
    insights.push({
      metricName: 'winRate',
      value: m.winRate,
      formattedValue: `${(m.winRate * 100).toFixed(1)}%`,
      rating: this.rateMetric(m.winRate, WIN_RATE_THRESHOLDS),
      interpretation: this.interpretWinRate(m.winRate),
    });

    // Max drawdown
    insights.push({
      metricName: 'maxDrawdown',
      value: m.maxDrawdown,
      formattedValue: `${(m.maxDrawdown * 100).toFixed(2)}%`,
      rating: this.rateMetric(m.maxDrawdown, DRAWDOWN_THRESHOLDS, true),
      interpretation: this.interpretDrawdown(m.maxDrawdown),
    });

    // Total return
    insights.push({
      metricName: 'totalReturn',
      value: m.totalReturn,
      formattedValue: `${(m.totalReturn * 100).toFixed(2)}%`,
      rating: this.rateMetric(m.totalReturn, RETURN_THRESHOLDS),
      interpretation: this.interpretReturn(m.totalReturn),
    });

    // Calmar
    insights.push({
      metricName: 'calmarRatio',
      value: m.calmarRatio,
      formattedValue: m.calmarRatio.toFixed(2),
      rating: this.rateMetric(m.calmarRatio, CALMAR_THRESHOLDS),
      interpretation: this.interpretCalmar(m.calmarRatio),
    });

    // Profit factor
    insights.push({
      metricName: 'profitFactor',
      value: m.profitFactor,
      formattedValue: m.profitFactor.toFixed(2),
      rating: this.rateMetric(m.profitFactor, { excellent: 2.0, good: 1.5, average: 1.2, poor: 1.0 }),
      interpretation: this.interpretProfitFactor(m.profitFactor),
    });

    return insights;
  }

  private interpretSharpe(v: number): string {
    if (v >= 2.0) return 'Excellent risk-adjusted returns. Strategy delivers strong returns per unit of risk.';
    if (v >= 1.5) return 'Good risk-adjusted returns. Acceptable for most institutional standards.';
    if (v >= 1.0) return 'Adequate risk-adjusted returns. Returns compensate for the risk taken.';
    if (v >= 0.5) return 'Below-average risk-adjusted returns. The strategy may not justify its risk.';
    return 'Poor risk-adjusted returns. Consider risk reduction or return enhancement.';
  }

  private interpretSortino(v: number): string {
    if (v >= 2.5) return 'Excellent downside risk management. Strong returns relative to downside deviation.';
    if (v >= 1.8) return 'Good downside performance. Strategy handles drawdowns well.';
    if (v >= 1.0) return 'Acceptable downside risk profile.';
    return 'Poor downside risk management. Downside volatility exceeds acceptable levels.';
  }

  private interpretWinRate(v: number): string {
    if (v >= 0.65) return 'Very high win rate suggests robust entry/exit logic. Ensure no overfitting.';
    if (v >= 0.55) return 'Solid win rate. Strategy has a consistent edge.';
    if (v >= 0.45) return 'Average win rate. Relies on risk/reward ratio for profitability.';
    return 'Low win rate. Must ensure winners are significantly larger than losers.';
  }

  private interpretDrawdown(v: number): string {
    if (v <= 0.05) return 'Minimal drawdown. Excellent capital preservation.';
    if (v <= 0.10) return 'Controlled drawdown. Acceptable for most investors.';
    if (v <= 0.20) return 'Moderate drawdown. May cause concern for conservative investors.';
    if (v <= 0.30) return 'Significant drawdown. Consider adding stop-losses or position sizing rules.';
    return 'Severe drawdown. Strategy carries unacceptably high downside risk.';
  }

  private interpretReturn(v: number): string {
    if (v >= 0.30) return 'Strong absolute returns. Strategy significantly outperformed cash.';
    if (v >= 0.15) return 'Good returns. Above typical market averages.';
    if (v >= 0.05) return 'Modest returns. In line with conservative benchmarks.';
    if (v >= 0.0) return 'Flat performance. Barely broke even.';
    return 'Negative returns. Strategy lost money over the backtest period.';
  }

  private interpretCalmar(v: number): string {
    if (v >= 3.0) return 'Excellent return-to-drawdown efficiency. Strong recovery from dips.';
    if (v >= 2.0) return 'Good return-to-drawdown ratio. Acceptable reward for the risk endured.';
    if (v >= 1.0) return 'Average Calmar ratio. Drawdown periods are proportionally significant.';
    return 'Poor Calmar ratio. Drawdowns heavily impact overall returns.';
  }

  private interpretProfitFactor(v: number): string {
    if (v >= 2.0) return 'Excellent. Gross profits are 2x+ larger than gross losses.';
    if (v >= 1.5) return 'Good. Profits meaningfully exceed losses.';
    if (v >= 1.2) return 'Acceptable. Small edge over break-even.';
    return 'Concerning. Profits barely exceed losses, any degradation could flip to negative.';
  }

  // ═══════════════════════════════════════════════════════════════
  // Highlights & Risk Warnings
  // ═══════════════════════════════════════════════════════════════

  /** Generate key highlights */
  private generateHighlights(input: BacktestInput): string[] {
    const m = input.metrics;
    const highlights: string[] = [];

    // Top metric highlight
    const insights = this.generateMetricInsights(m);
    const excellent = insights.filter(i => i.rating === 'excellent');
    if (excellent.length > 0) {
      highlights.push(`Top performer: ${excellent[0].formattedValue} ${excellent[0].metricName} — ${excellent[0].rating}`);
    }

    // Return highlight
    if (m.totalReturn > 0) {
      highlights.push(`Generated ${(m.totalReturn * 100).toFixed(1)}% total return over ${input.dateRange.start} to ${input.dateRange.end}`);
    } else {
      highlights.push(`Strategy lost ${(Math.abs(m.totalReturn) * 100).toFixed(1)}% during the backtest period — needs improvement`);
    }

    // Win rate + profit factor combo
    highlights.push(`${(m.winRate * 100).toFixed(0)}% win rate across ${m.totalTrades} trades with ${m.profitFactor.toFixed(2)}x profit factor`);

    // Trade analytics
    if (input.trades && input.trades.length > 0) {
      const profitable = input.trades.filter(t => t.pnl > 0);
      const avgWin = profitable.length > 0
        ? profitable.reduce((s, t) => s + t.pnl, 0) / profitable.length
        : 0;
      const losers = input.trades.filter(t => t.pnl <= 0);
      const avgLoss = losers.length > 0
        ? Math.abs(losers.reduce((s, t) => s + t.pnl, 0) / losers.length)
        : 0;
      highlights.push(`Average win: ${avgWin.toFixed(2)} USDT vs Average loss: ${avgLoss.toFixed(2)} USDT (${(avgWin / (avgLoss || 1)).toFixed(1)}x R/R ratio)`);
    }

    // Holding period
    highlights.push(`Average holding period: ${m.avgHoldingDays.toFixed(1)} days with ${m.maxDrawdown > 0.15 ? 'moderate' : 'controlled'} drawdown risk`);

    return highlights.slice(0, 5);
  }

  /** Generate risk warnings */
  private generateRiskWarnings(input: BacktestInput): string[] {
    const m = input.metrics;
    const warnings: string[] = [];

    if (m.maxDrawdown > 0.20) {
      warnings.push(`Max drawdown of ${(m.maxDrawdown * 100).toFixed(1)}% exceeds 20% threshold — consider stop-loss rules`);
    }

    if (m.sharpeRatio < 0.8) {
      warnings.push(`Sharpe ratio of ${m.sharpeRatio.toFixed(2)} is below acceptable threshold (<0.8) — risk not adequately compensated`);
    }

    if (m.totalTrades < 30) {
      warnings.push(`Low trade count (${m.totalTrades}) may lead to over-optimized results — verify on out-of-sample data`);
    }

    if (m.winRate > 0.80) {
      warnings.push(`Exceptionally high win rate (${(m.winRate * 100).toFixed(0)}%) — check for look-ahead bias or survivorship bias`);
    }

    if (m.profitFactor < 1.2) {
      warnings.push(`Profit factor of ${m.profitFactor.toFixed(2)} is marginal — small strategy degradation could erase edge`);
    }

    if (m.volatility > 0.40) {
      warnings.push(`High volatility (${(m.volatility * 100).toFixed(1)}%) — unsuitable for risk-averse investors`);
    }

    if (m.avgHoldingDays < 1) {
      warnings.push(`Ultra-short holding period (<1 day) — transaction costs may significantly reduce real returns`);
    }

    return warnings;
  }

  // ═══════════════════════════════════════════════════════════════
  // Score & Sentiment
  // ═══════════════════════════════════════════════════════════════

  /** Calculate overall score 0-100 */
  private calculateScore(input: BacktestInput, insights: MetricInsight[]): { score: number; breakdown: Record<string, number> } {
    const ratingScores: Record<string, number> = {
      excellent: 100,
      good: 75,
      average: 50,
      poor: 25,
      critical: 0,
    };

    // Weighted scoring
    const weights: Record<string, number> = {
      sharpeRatio: 0.20,
      winRate: 0.15,
      maxDrawdown: 0.15,
      totalReturn: 0.15,
      profitFactor: 0.10,
      calmarRatio: 0.10,
      sortinoRatio: 0.10,
    };

    let totalScore = 0;
    let totalWeight = 0;
    const breakdown: Record<string, number> = {};

    for (const insight of insights) {
      const w = weights[insight.metricName] || 0.05;
      const s = ratingScores[insight.rating] || 0;
      totalScore += s * w;
      totalWeight += w;
      breakdown[insight.metricName] = s;
    }

    // Normalize
    const normalizedScore = totalWeight > 0 ? Math.round(totalScore / totalWeight) : 50;

    // Adjust for trade count
    let adjustedScore = normalizedScore;
    if (input.metrics.totalTrades < 30) adjustedScore -= 5;
    if (input.metrics.totalTrades < 15) adjustedScore -= 10;

    return {
      score: Math.max(0, Math.min(100, adjustedScore)),
      breakdown,
    };
  }

  /** Determine sentiment */
  private determineSentiment(input: BacktestInput): {
    sentiment: AIInterpretation['sentiment'];
    confidence: number;
    reasoning: string;
  } {
    const m = input.metrics;

    // Bullish signals
    let bullishPoints = 0;
    let bearishPoints = 0;

    if (m.totalReturn > 0.15) bullishPoints += 2;
    else if (m.totalReturn > 0.05) bullishPoints += 1;
    else if (m.totalReturn > 0) { /* flat, no points */ }
    else bearishPoints += 2;

    if (m.sharpeRatio >= 1.5) bullishPoints += 2;
    else if (m.sharpeRatio >= 1.2) bullishPoints += 1;
    else if (m.sharpeRatio < 0.8) bearishPoints += 1;

    if (m.winRate >= 0.55) bullishPoints += 1;
    else if (m.winRate < 0.45) bearishPoints += 1;

    if (m.maxDrawdown <= 0.10) bullishPoints += 2;
    else if (m.maxDrawdown <= 0.20) bullishPoints += 1;
    else if (m.maxDrawdown > 0.30) bearishPoints += 2;

    if (m.profitFactor >= 1.5) bullishPoints += 1;
    else if (m.profitFactor < 1.0) bearishPoints += 2;

    if (m.calmarRatio >= 2.0) bullishPoints += 1;

    const total = bullishPoints + bearishPoints;
    const diff = bullishPoints - bearishPoints;

    let sentiment: AIInterpretation['sentiment'];
    let confidence: number;
    let reasoning: string;

    if (diff >= 3) {
      sentiment = 'bullish';
      confidence = Math.min(0.9, 0.5 + diff * 0.1);
      reasoning = `Strong bullish signals across key metrics: ${(m.totalReturn * 100).toFixed(1)}% return, Sharpe ${m.sharpeRatio.toFixed(2)}, ${(m.winRate * 100).toFixed(0)}% win rate. Strategy shows robust performance.`;
    } else if (diff >= 1) {
      sentiment = 'bullish';
      confidence = 0.5 + diff * 0.1;
      reasoning = `Moderately positive: strategy shows promise but some metrics are borderline. ${m.maxDrawdown > 0.15 ? 'Drawdowns remain a concern.' : 'Risk metrics are within acceptable range.'}`;
    } else if (diff >= -1) {
      sentiment = 'neutral';
      confidence = 0.6;
      reasoning = `Mixed signals — strategy has both strengths and weaknesses. Consider targeted optimization before deployment.`;
    } else if (diff >= -3) {
      sentiment = 'bearish';
      confidence = 0.5 + Math.abs(diff) * 0.1;
      reasoning = `Strategy underperforms in key areas: ${m.totalReturn <= 0 ? 'negative returns, ' : ''}${m.sharpeRatio < 1 ? 'low risk-adjusted returns, ' : ''}${m.maxDrawdown > 0.20 ? 'high drawdowns. ' : ''}Significant revisions recommended.`;
    } else {
      sentiment = 'bearish';
      confidence = 0.85;
      reasoning = `Strong bearish signals. Strategy fails across multiple critical metrics. Back to the drawing board recommended.`;
    }

    return { sentiment, confidence: Math.min(confidence, 0.95), reasoning };
  }

  // ═══════════════════════════════════════════════════════════════
  // Optimization Suggestions
  // ═══════════════════════════════════════════════════════════════

  /** Generate optimization suggestions */
  private generateSuggestions(input: BacktestInput): OptimizationSuggestion[] {
    const m = input.metrics;
    const suggestions: OptimizationSuggestion[] = [];
    let sid = 0;

    if (m.maxDrawdown > 0.20) {
      suggestions.push({
        id: `opt-${++sid}`,
        category: 'risk',
        title: 'Implement trailing stop-loss',
        description: `Current max drawdown ${(m.maxDrawdown * 100).toFixed(1)}% exceeds target. Add trailing stop at 2x ATR to limit downside.`,
        expectedImpact: 'high',
        priority: 1,
      });
    }

    if (m.winRate < 0.45) {
      suggestions.push({
        id: `opt-${++sid}`,
        category: 'entry_exit',
        title: 'Tighten entry criteria',
        description: `Low ${(m.winRate * 100).toFixed(0)}% win rate. Add confirmation filters (volume, trend alignment) to improve entry quality.`,
        expectedImpact: 'high',
        priority: 2,
      });
    }

    if (m.profitFactor < 1.5) {
      suggestions.push({
        id: `opt-${++sid}`,
        category: 'sizing',
        title: 'Optimize position sizing',
        description: `Current profit factor ${m.profitFactor.toFixed(2)}. Consider Kelly criterion or volatility-adjusted position sizing.`,
        expectedImpact: 'medium',
        priority: 3,
      });
    }

    if (m.sharpeRatio < 1.0) {
      suggestions.push({
        id: `opt-${++sid}`,
        category: 'diversification',
        title: 'Diversify across uncorrelated assets',
        description: `Low Sharpe ${m.sharpeRatio.toFixed(2)}. Adding uncorrelated instruments may improve risk-adjusted returns.`,
        expectedImpact: 'medium',
        priority: 4,
      });
    }

    if (m.totalTrades < 30) {
      suggestions.push({
        id: `opt-${++sid}`,
        category: 'efficiency',
        title: 'Extend backtest period',
        description: `Only ${m.totalTrades} trades. Extend backtest to >100 trades for statistical significance.`,
        expectedImpact: 'medium',
        priority: 5,
      });
    }

    return suggestions;
  }

  // ═══════════════════════════════════════════════════════════════
  // Benchmark Comparison
  // ═══════════════════════════════════════════════════════════════

  /** Generate benchmark comparison */
  private generateBenchmarkComparison(input: BacktestInput): BenchmarkComparison | undefined {
    if (!input.benchmark || !input.benchmarkName) return undefined;

    const m = input.metrics;
    const b = input.benchmark;

    const returnDiff = m.totalReturn - b.totalReturn;
    const sharpeDiff = m.sharpeRatio - b.sharpeRatio;
    const drawdownDiff = m.maxDrawdown - b.maxDrawdown;
    const winRateDiff = m.winRate - b.winRate;
    const outperformance = returnDiff > 0 && sharpeDiff > 0;

    let summary: string;
    if (outperformance) {
      summary = `${input.strategyName} outperformed ${input.benchmarkName} by ${(returnDiff * 100).toFixed(1)}% with better risk-adjusted returns (Sharpe +${sharpeDiff.toFixed(2)}).`;
    } else if (returnDiff > 0) {
      summary = `${input.strategyName} delivered higher returns (+${(returnDiff * 100).toFixed(1)}%) but with comparable or worse risk metrics vs ${input.benchmarkName}.`;
    } else {
      summary = `${input.strategyName} underperformed ${input.benchmarkName} by ${(Math.abs(returnDiff) * 100).toFixed(1)}%. Consider whether the strategy adds value over passive ${input.benchmarkName}.`;
    }

    return {
      benchmarkName: input.benchmarkName,
      returnDiff,
      sharpeDiff,
      drawdownDiff,
      winRateDiff,
      outperformance,
      summary,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // Action Recommendation
  // ═══════════════════════════════════════════════════════════════

  /** Determine recommended action */
  private determineAction(input: BacktestInput, score: number): {
    action: AIInterpretation['recommendedAction'];
    reasoning: string;
  } {
    const m = input.metrics;

    if (score >= 80 && m.totalTrades >= 50) {
      return {
        action: 'go_live',
        reasoning: `Strategy scores ${score}/100 with ${m.totalTrades} trades. All critical metrics meet thresholds. Ready for live deployment with monitored risk limits.`,
      };
    }
    if (score >= 65) {
      return {
        action: 'optimize',
        reasoning: `Score ${score}/100 — good foundation with room for improvement. Address optimization suggestions above before going live.`,
      };
    }
    if (score >= 45) {
      return {
        action: 'paper_trade',
        reasoning: `Score ${score}/100 — moderate performance. Deploy in paper trading first to gather more real-time data before committing capital.`,
      };
    }
    if (score >= 25) {
      return {
        action: 'review',
        reasoning: `Score ${score}/100 — below acceptable threshold. Review strategy logic, market regime, and parameter settings. Consider major revisions.`,
      };
    }
    return {
      action: 'discard',
      reasoning: `Score ${score}/100 — fails across most metrics. Strategy is not viable in current form. Consider a completely different approach.`,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // Main Interpretation
  // ═══════════════════════════════════════════════════════════════

  /**
   * Generate AI interpretation for a backtest.
   * This is the primary external API.
   */
  interpret(input: BacktestInput, modelVersion?: string): AIInterpretation {
    const m = input.metrics;
    const now = Date.now();

    // Generate all components
    const metricInsights = this.generateMetricInsights(m);
    const highlights = this.generateHighlights(input);
    const riskWarnings = this.generateRiskWarnings(input);
    const { score, breakdown } = this.calculateScore(input, metricInsights);
    const { sentiment, confidence, reasoning } = this.determineSentiment(input);
    const optimizationSuggestions = this.generateSuggestions(input);
    const benchmarkComparison = this.generateBenchmarkComparison(input);
    const { action, reasoning: actionReasoning } = this.determineAction(input, score);

    // Executive summary
    const summary = this.generateSummary(input, sentiment, score, highlights);

    const interpretation: AIInterpretation = {
      id: `interp-${++this.idCounter}`,
      backtestInput: input,
      generatedAt: now,
      modelVersion: modelVersion || 'whale-interpreter-v1',

      summary,
      sentiment,
      sentimentConfidence: confidence,
      sentimentReasoning: reasoning,

      highlights,
      riskWarnings,
      metricInsights,
      optimizationSuggestions,
      benchmarkComparison,

      overallScore: score,
      scoreBreakdown: breakdown,

      recommendedAction: action,
      actionReasoning,
    };

    this.interpretations.set(interpretation.id, interpretation);
    log.info(`[BacktestAI] Generated interpretation ${interpretation.id}: ${input.strategyName} — ${sentiment} (${score}/100)`);
    return interpretation;
  }

  /** Generate executive summary */
  private generateSummary(input: BacktestInput, sentiment: string, score: number, highlights: string[]): string {
    const m = input.metrics;
    const returnStr = m.totalReturn >= 0
      ? `returned ${(m.totalReturn * 100).toFixed(1)}%`
      : `lost ${(Math.abs(m.totalReturn) * 100).toFixed(1)}%`;

    const sentimentLabel = sentiment === 'bullish' ? 'promising' : sentiment === 'bearish' ? 'concerning' : 'mixed';

    return `${input.strategyName} ${returnStr} over ${input.dateRange.start} to ${input.dateRange.end} ` +
      `(${m.totalTrades} trades). Overall assessment is ${sentimentLabel} ` +
      `with a composite score of ${score}/100. ` +
      `${highlights.length > 0 ? `Key finding: ${highlights[0]}.` : ''}`;
  }

  // ═══════════════════════════════════════════════════════════════
  // Query
  // ═══════════════════════════════════════════════════════════════

  /** Get a specific interpretation */
  getInterpretation(id: string): AIInterpretation | undefined {
    return this.interpretations.get(id);
  }

  /** Get all interpretations */
  getAllInterpretations(): AIInterpretation[] {
    return Array.from(this.interpretations.values()).sort((a, b) => b.generatedAt - a.generatedAt);
  }

  /** Get interpretations for a specific strategy name */
  getByStrategy(strategyName: string): AIInterpretation[] {
    return Array.from(this.interpretations.values())
      .filter(i => i.backtestInput.strategyName === strategyName)
      .sort((a, b) => b.generatedAt - a.generatedAt);
  }

  /** Compare two interpretations */
  compare(
    interpId1: string,
    interpId2: string,
  ): { interpretation1: AIInterpretation; interpretation2: AIInterpretation; winner: string; analysis: string } | null {
    const i1 = this.interpretations.get(interpId1);
    const i2 = this.interpretations.get(interpId2);
    if (!i1 || !i2) return null;

    const winner = i1.overallScore > i2.overallScore
      ? i1.backtestInput.strategyName
      : i2.backtestInput.strategyName;

    const scoreDiff = Math.abs(i1.overallScore - i2.overallScore);
    let analysis: string;
    if (scoreDiff >= 20) {
      analysis = `${winner} is clearly superior with a ${scoreDiff}-point score advantage.`;
    } else if (scoreDiff >= 10) {
      analysis = `${winner} has a moderate edge (${scoreDiff} pts). Consider specific metric trade-offs.`;
    } else {
      analysis = `Strategies are close (${scoreDiff} pts apart). Review specific strengths in each before deciding.`;
    }

    return { interpretation1: i1, interpretation2: i2, winner, analysis };
  }

  /** Get stats */
  getStats(): { totalInterpretations: number; avgScore: number } {
    const all = Array.from(this.interpretations.values());
    return {
      totalInterpretations: all.length,
      avgScore: all.length > 0
        ? Math.round(all.reduce((s, i) => s + i.overallScore, 0) / all.length * 10) / 10
        : 0,
    };
  }
}

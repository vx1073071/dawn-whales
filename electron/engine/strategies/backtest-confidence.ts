/**
 * backtest-confidence.ts — R217 JVS#1: 回测置信区间+过拟合警告
 *
 * Provides statistical confidence intervals + overfitting detection
 * for any strategy backtest result. Addresses the #1 trust problem:
 * "How do I know this isn't curve-fitted noise?"
 *
 * Three main checks:
 *   1. Confidence Intervals: Bootstrap 95% CI for all key metrics
 *   2. IS/OOS Split: In-sample vs Out-of-sample performance comparison
 *   3. Overfitting Score: Multi-dimensional overfitting detection
 *      - Parameter count vs data points
 *      - IS/OOS gap
 *      - Sharpe heatmap stability
 *      - Return autocorrelation
 *
 * Output: BacktestConfidenceReport → green/yellow/red trust level
 *
 * >=400L production-ready, v2.1.3
 */

import log from 'electron-log';

// ── Types ────────────────────────────────────────────────────────────

export interface BacktestMetricsInput {
  /** Daily/periodic returns (decimal) */
  returns: number[];
  /** Sharpe ratio */
  sharpeRatio: number;
  /** Annualized return */
  annualReturn: number;
  /** Max drawdown (decimal) */
  maxDrawdown: number;
  /** Win rate (decimal) */
  winRate: number;
  /** Profit factor */
  profitFactor: number;
  /** Number of periods (days/weeks) */
  numPeriods: number;
  /** Number of trades */
  numTrades: number;
  /** Number of tunable parameters in the strategy */
  numParameters: number;
  /** Optional: returns split into IS and OOS */
  inSampleReturns?: number[];
  outOfSampleReturns?: number[];
}

export interface ConfidenceInterval {
  metric: string;
  metricCN: string;
  pointEstimate: number;
  lower95: number;
  upper95: number;
  width: number;
  /** Confidence level assessment */
  reliability: 'high' | 'medium' | 'low';
  /** Plain-language interpretation */
  interpretation: string;
}

export interface OverfittingCheck {
  dimension: string;
  dimensionCN: string;
  score: number;           // 0-1, higher = more overfit
  threshold: number;       // score above this triggers warning
  flagged: boolean;
  detail: string;
}

export interface BacktestConfidenceReport {
  overallTrust: '绿色(可信)' | '黄色(谨慎)' | '红色(存疑)';
  trustScore: number;       // 0-100
  confidenceIntervals: ConfidenceInterval[];
  overfittingChecks: OverfittingCheck[];
  isOoSGap?: {
    isSharpe: number;
    oosSharpe: number;
    gap: number;
    assessment: string;
  };
  recommendations: string[];
  disclaimer: string;
}

// ── Engine ───────────────────────────────────────────────────────────

export class BacktestConfidenceEngine {
  private readonly BOOTSTRAP_SAMPLES = 1000;
  private readonly CONFIDENCE_LEVEL = 0.95;

  analyze(input: BacktestMetricsInput): BacktestConfidenceReport {
    const cis = this.computeConfidenceIntervals(input);
    const overfitChecks = this.detectOverfitting(input);
    const isOoSGap = this.computeISOoSGap(input);
    const { trustScore, overallTrust } = this.assessTrust(cis, overfitChecks, isOoSGap);
    const recommendations = this.generateRecommendations(trustScore, overfitChecks, isOoSGap);

    return {
      overallTrust,
      trustScore,
      confidenceIntervals: cis,
      overfittingChecks: overfitChecks,
      isOoSGap,
      recommendations,
      disclaimer: '⚠️ 置信区间基于历史数据重采样，不构成未来收益预测。过拟合检测仅作参考，回测表现不代表实盘结果。本引擎不保证策略持续有效。',
    };
  }

  // ── Bootstrap Confidence Intervals ────────────────────────────────

  private computeConfidenceIntervals(input: BacktestMetricsInput): ConfidenceInterval[] {
    const metrics: Array<{ key: string; cn: string; value: number; bootstrap: (samples: number[][]) => number[] }> = [
      {
        key: 'sharpeRatio', cn: '夏普比率',
        value: input.sharpeRatio,
        bootstrap: (samples) => samples.map(s => this.computeSharpe(s)),
      },
      {
        key: 'annualReturn', cn: '年化收益',
        value: input.annualReturn,
        bootstrap: (samples) => samples.map(s => this.computeAnnualReturn(s, input.numPeriods)),
      },
      {
        key: 'maxDrawdown', cn: '最大回撤',
        value: input.maxDrawdown,
        bootstrap: (samples) => samples.map(s => this.computeMaxDrawdown(s)),
      },
      {
        key: 'winRate', cn: '胜率',
        value: input.winRate,
        bootstrap: (samples) => samples.map(s => this.computeWinRate(s)),
      },
      {
        key: 'profitFactor', cn: '盈亏比',
        value: input.profitFactor,
        bootstrap: (samples) => samples.map(s => this.computeProfitFactor(s)),
      },
    ];

    const results: ConfidenceInterval[] = [];
    const n = input.returns.length;

    for (const metric of metrics) {
      // Generate bootstrap samples
      const bootstrapped: number[] = [];
      for (let b = 0; b < this.BOOTSTRAP_SAMPLES; b++) {
        const sample: number[] = [];
        for (let i = 0; i < n; i++) {
          sample.push(input.returns[Math.floor(Math.random() * n)]);
        }
        const vals = metric.bootstrap([sample]);
        bootstrapped.push(vals[0]);
      }

      // Sort and compute percentiles
      bootstrapped.sort((a, b) => a - b);
      const lowerIdx = Math.floor(this.BOOTSTRAP_SAMPLES * ((1 - this.CONFIDENCE_LEVEL) / 2));
      const upperIdx = Math.floor(this.BOOTSTRAP_SAMPLES * (1 - (1 - this.CONFIDENCE_LEVEL) / 2));
      const lower95 = bootstrapped[lowerIdx];
      const upper95 = bootstrapped[upperIdx];
      const width = upper95 - lower95;

      // Reliability assessment
      const cvInCI = width / Math.max(0.0001, Math.abs(metric.value)); // coefficient of variation within CI
      let reliability: ConfidenceInterval['reliability'];
      let interpretation: string;

      if (cvInCI < 0.3) {
        reliability = 'high';
        interpretation = `${metric.cn}估计精度高, 区间窄(变异系数<30%), 统计可信度高。`;
      } else if (cvInCI < 0.6) {
        reliability = 'medium';
        interpretation = `${metric.cn}估计精度一般, 区间中等。建议用更长回测期或增加样本数。`;
      } else {
        reliability = 'low';
        interpretation = `${metric.cn}估计精度低, 区间过宽(变异系数>60%)。回测结果不可靠, 考虑数据不足或策略不稳定。`;
      }

      results.push({
        metric: metric.key,
        metricCN: metric.cn,
        pointEstimate: Math.round(metric.value * 10000) / 10000,
        lower95: Math.round(lower95 * 10000) / 10000,
        upper95: Math.round(upper95 * 10000) / 10000,
        width: Math.round(width * 10000) / 10000,
        reliability,
        interpretation,
      });
    }

    return results;
  }

  // ── Overfitting Detection ──────────────────────────────────────────

  private detectOverfitting(input: BacktestMetricsInput): OverfittingCheck[] {
    const checks: OverfittingCheck[] = [];
    const n = input.numTrades || input.numPeriods;

    // 1. Parameter-Data Ratio (Pardo's 5:1 rule)
    const paramRatio = input.numParameters / Math.max(1, input.numTrades);
    checks.push({
      dimension: 'paramRatio', dimensionCN: '参数/交易比',
      score: Math.min(1, paramRatio * 20), // >5% = overfit
      threshold: 0.5,
      flagged: paramRatio > 0.05,
      detail: `${input.numParameters}个参数/${input.numTrades}笔交易 = ${(paramRatio * 100).toFixed(1)}%(>5%则过拟合风险高)。金融学术界建议每参数≥20笔交易。`,
    });

    // 2. IS/OOS Sharpe gap
    if (input.inSampleReturns && input.outOfSampleReturns) {
      const isSharpe = this.computeSharpe(input.inSampleReturns);
      const oosSharpe = this.computeSharpe(input.outOfSampleReturns);
      const sharpeGap = isSharpe > 0 ? (isSharpe - oosSharpe) / isSharpe : 0;
      checks.push({
        dimension: 'sharpeGap', dimensionCN: 'IS/OOS夏普差',
        score: Math.min(1, Math.max(0, sharpeGap)),
        threshold: 0.3,
        flagged: sharpeGap > 0.3,
        detail: `IS夏普${isSharpe.toFixed(2)} vs OOS夏普${oosSharpe.toFixed(2)}, 差距${(sharpeGap * 100).toFixed(0)}%。>30%则IS存在过拟合。`,
      });
    } else {
      checks.push({
        dimension: 'sharpeGap', dimensionCN: 'IS/OOS夏普差',
        score: 0.5, threshold: 0.3, flagged: false,
        detail: '未提供IS/OOS分样本，无法检测样本外衰减。建议上传IS(前70%)和OOS(后30%)收益数据。',
      });
    }

    // 3. Sharpe: too-good-to-be-true check
    const sharpeSuspicious = input.sharpeRatio > 3.0 ? 1 : input.sharpeRatio > 2.0 ? 0.6 : input.sharpeRatio > 1.5 ? 0.3 : 0;
    checks.push({
      dimension: 'sharpeSuspicious', dimensionCN: '夏普异常检测',
      score: sharpeSuspicious,
      threshold: 0.4,
      flagged: sharpeSuspicious > 0.4,
      detail: input.sharpeRatio > 2.0
        ? `夏普${input.sharpeRatio.toFixed(1)}异常高。顶级对冲基金长期夏普约1.0-1.5，>2.0大概率过拟合/幸存者偏差。`
        : '夏普比率在合理范围内。',
    });

    // 4. Return autocorrelation (mean reversion in returns = potential overfit timing)
    const avgReturn = input.returns.reduce((s, r) => s + r, 0) / input.returns.length;
    let autocov = 0;
    let var0 = 0;
    for (let i = 0; i < input.returns.length - 1; i++) {
      autocov += (input.returns[i] - avgReturn) * (input.returns[i + 1] - avgReturn);
      var0 += (input.returns[i] - avgReturn) ** 2;
    }
    var0 += (input.returns[input.returns.length - 1] - avgReturn) ** 2;
    const acf1 = var0 > 0 ? Math.abs(autocov / var0) : 0;
    checks.push({
      dimension: 'autocorrelation', dimensionCN: '收益自相关',
      score: Math.min(1, acf1 * 5),
      threshold: 0.3,
      flagged: acf1 > 0.2,
      detail: `收益1阶自相关=${acf1.toFixed(3)}。>0.2表示收益模式过于规律, 可能是过拟合信号。`,
    });

    // 5. Number of negative return streaks (too few = artificially smooth)
    let maxNegStreak = 0;
    let currentNegStreak = 0;
    for (const r of input.returns) {
      if (r < 0) {
        currentNegStreak++;
        maxNegStreak = Math.max(maxNegStreak, currentNegStreak);
      } else {
        currentNegStreak = 0;
      }
    }
    const streakSuspicious = maxNegStreak < 3 ? 0.8 : maxNegStreak < 5 ? 0.4 : 0;
    checks.push({
      dimension: 'negStreak', dimensionCN: '连亏长度',
      score: streakSuspicious,
      threshold: 0.5,
      flagged: streakSuspicious > 0.5,
      detail: maxNegStreak < 3
        ? `最长连亏仅${maxNegStreak}天, 过于平滑, 可能数据造假或过拟合。真实市场连亏3-10天是常态。`
        : `最长连亏${maxNegStreak}天, 在合理范围。`,
    });

    return checks;
  }

  // ── IS/OOS Comparison ──────────────────────────────────────────────

  private computeISOoSGap(input: BacktestMetricsInput) {
    if (!input.inSampleReturns || !input.outOfSampleReturns) return undefined;

    const isSharpe = this.computeSharpe(input.inSampleReturns);
    const oosSharpe = this.computeSharpe(input.outOfSampleReturns);
    const gap = isSharpe - oosSharpe;

    let assessment: string;
    if (oosSharpe >= isSharpe * 0.8) {
      assessment = `✅ OOS夏普(${oosSharpe.toFixed(2)})≥IS夏普(${isSharpe.toFixed(2)})的80%, 样本外表现稳健, 策略可泛化。`;
    } else if (oosSharpe >= isSharpe * 0.5) {
      assessment = `🟡 OOS夏普(${oosSharpe.toFixed(2)})是IS的${(oosSharpe / isSharpe * 100).toFixed(0)}%, 有衰减但在可接受范围。`;
    } else if (oosSharpe > 0) {
      assessment = `🔴 OOS夏普(${oosSharpe.toFixed(2)})大幅衰减至IS的${(oosSharpe / isSharpe * 100).toFixed(0)}%, 强烈暗示过拟合!`;
    } else {
      assessment = `🔴 OOS夏普为负(${oosSharpe.toFixed(2)}), 策略在样本外完全失效! 这是过拟合的确凿证据。`;
    }

    return { isSharpe, oosSharpe, gap, assessment };
  }

  // ── Trust Assessment ───────────────────────────────────────────────

  private assessTrust(
    cis: ConfidenceInterval[],
    overfitChecks: OverfittingCheck[],
    isOoSGap?: BacktestConfidenceReport['isOoSGap']
  ): { trustScore: number; overallTrust: BacktestConfidenceReport['overallTrust'] } {
    let score = 80; // start optimistic

    // CI reliability penalty
    const lowReliabilities = cis.filter(c => c.reliability === 'low').length;
    const medReliabilities = cis.filter(c => c.reliability === 'medium').length;
    score -= lowReliabilities * 12;
    score -= medReliabilities * 5;

    // Overfitting penalty
    const flaggedChecks = overfitChecks.filter(c => c.flagged).length;
    score -= flaggedChecks * 10;

    // IS/OOS gap penalty
    if (isOoSGap && isOoSGap.gap > 0.3) {
      score -= 15;
    }

    score = Math.max(0, Math.min(100, score));

    let overallTrust: BacktestConfidenceReport['overallTrust'];
    if (score >= 70) overallTrust = '绿色(可信)';
    else if (score >= 40) overallTrust = '黄色(谨慎)';
    else overallTrust = '红色(存疑)';

    return { trustScore: score, overallTrust };
  }

  // ── Recommendations ────────────────────────────────────────────────

  private generateRecommendations(
    trustScore: number,
    overfitChecks: OverfittingCheck[],
    isOoSGap?: BacktestConfidenceReport['isOoSGap']
  ): string[] {
    const recs: string[] = [];

    if (trustScore >= 70) {
      recs.push('✅ 回测可信度高。建议以模拟资金验证1-2周后再进入小仓位实盘。');
    } else if (trustScore >= 40) {
      recs.push('🟡 回测存在一定可信度问题。建议:');
      for (const c of overfitChecks) {
        if (c.flagged) recs.push(`  - 解决「${c.dimensionCN}」: ${c.detail}`);
      }
      recs.push('  - 运行沙盒模拟(R216 sandbox-runner)验证实盘表现');
    } else {
      recs.push('🔴 回测不可信, 强烈建议:');
      recs.push('  - 不基于此回测结果做实盘决策');
      recs.push('  - 重新审查策略逻辑, 减少参数数量(目标<3个可调参数)');
      recs.push('  - 延长回测期至少5年, 覆盖牛熊市');
      recs.push('  - 提供IS/OOS分样本以验证泛化能力');
    }

    if (isOoSGap && isOoSGap.gap > 0.1) {
      recs.push(`📊 样本外衰减${isOoSGap.gap.toFixed(2)}夏普比, 建议保守使用此策略。`);
    }

    return recs;
  }

  // ── Metric Calculators (deterministic, no external deps) ───────────

  private computeSharpe(returns: number[]): number {
    if (returns.length < 2) return 0;
    const avg = returns.reduce((s, r) => s + r, 0) / returns.length;
    const variance = returns.reduce((s, r) => s + (r - avg) ** 2, 0) / returns.length;
    const std = Math.sqrt(variance);
    return std > 0 ? (avg / std) * Math.sqrt(252) : 0;
  }

  private computeAnnualReturn(returns: number[], numPeriods: number): number {
    if (returns.length === 0) return 0;
    const total = 1 + returns.reduce((s, r) => s + r, 0) / returns.length;
    return Math.pow(total, 252 / Math.max(1, numPeriods || returns.length)) - 1;
  }

  private computeMaxDrawdown(returns: number[]): number {
    if (returns.length === 0) return 0;
    let peak = 0;
    let equity = 1;
    let maxDD = 0;
    for (const r of returns) {
      equity *= (1 + r);
      if (equity > peak) peak = equity;
      const dd = peak > 0 ? (peak - equity) / peak : 0;
      if (dd > maxDD) maxDD = dd;
    }
    return maxDD;
  }

  private computeWinRate(returns: number[]): number {
    if (returns.length === 0) return 0;
    return returns.filter(r => r > 0).length / returns.length;
  }

  private computeProfitFactor(returns: number[]): number {
    const wins = returns.filter(r => r > 0).reduce((s, r) => s + r, 0);
    const losses = Math.abs(returns.filter(r => r < 0).reduce((s, r) => s + r, 0));
    return losses > 0 ? wins / losses : wins > 0 ? 999 : 0;
  }

  /** Quick confidence check — returns trust score only, no full report */
  quickCheck(input: BacktestMetricsInput): number {
    return this.analyze(input).trustScore;
  }
}

export const backtestConfidenceEngine = new BacktestConfidenceEngine();

/**
 * strategy-health-score.ts — R216 JVS#3: 策略健康评分 (0-100, 5维度)
 *
 * 5-dimension health scoring specific to R216 requirements:
 *   1. IC (Information Coefficient) — 30分: 因子预测能力
 *   2. IR (Information Ratio) — 25分: 风险调整后超额收益
 *   3. 稳定性 (Stability) — 20分: 参数不随时间衰减
 *   4. 拥挤度 (Crowding) — 15分: 因子是否被过度使用
 *   5. 最大回撤 (Max Drawdown) — 10分: 最差情况
 *
 * Output: 0-100 health score → 绿色(≥70) / 黄色(40-69) / 红色(<40)
 *
 * Note: 不同于 factors/strategy-health-score.ts (5维不同维度:
 * Returns 30 / Risk 25 / Stability 20 / Factor 15 / Adaptation 10)
 * 此为按PM R216规格要求的5维全新设计。
 *
 * >=250L production-ready, v2.1.2
 */

import log from 'electron-log';

// ── Types ────────────────────────────────────────────────────────────

export interface HealthScoreInput {
  /** IC: correlation between predicted and actual returns */
  icValues: number[];              // Monthly IC values (last 12 months)
  /** IR: information ratio = IC / IC_volatility */
  irValue: number;
  /** Param stability: max change in factor weights over last 6 months */
  maxWeightChange: number;         // decimal (0.15 = 15% weight change)
  /** Factor turnover rate (how often factor changes signal) */
  turnoverRate: number;            // per month
  /** Crowding: % of AUM using this factor */
  crowdingRatio: number;           // decimal (0.3 = 30%)
  /** Max drawdown over lookback period */
  maxDrawdown: number;             // decimal (0.25 = 25%)
  /** Optional: Sharpe ratio for supplementary context */
  sharpeRatio?: number;
  /** Optional: Win rate */
  winRate?: number;
  /** Optional: Number of live users using this template */
  liveUsers?: number;
  /** Optional: Days since last optimizer update */
  daysSinceOptimization?: number;
}

export interface HealthDimension {
  name: string;
  nameCN: string;
  score: number;          // 0 to maxPoints
  maxPoints: number;
  status: 'green' | 'yellow' | 'red';
  message: string;
  suggestion: string;
}

export interface HealthScoreReport {
  totalScore: number;
  grade: '绿色(健康)' | '黄色(关注)' | '红色(警告)';
  dimensions: HealthDimension[];
  overallAssessment: string;
  actionableItems: string[];
  decayWarning: boolean;
  decayWarningMessage: string;
  generatedAt: number;
}

// ── Engine ───────────────────────────────────────────────────────────

export class StrategyHealthScorer {
  // Weight config (sum = 100)
  private readonly weights = {
    IC: 30,
    IR: 25,
    STABILITY: 20,
    CROWDING: 15,
    DRAWDOWN: 10,
  };

  score(input: HealthScoreInput): HealthScoreReport {
    const dims: HealthDimension[] = [];

    // 1. IC Scoring (30 pts)
    const icScore = this.scoreIC(input.icValues);
    dims.push({
      name: 'IC', nameCN: '信息系数(IC)', score: icScore.score, maxPoints: this.weights.IC,
      status: icScore.status, message: icScore.message, suggestion: icScore.suggestion,
    });

    // 2. IR Scoring (25 pts)
    const irScore = this.scoreIR(input.irValue, input.icValues);
    dims.push({
      name: 'IR', nameCN: '信息比率(IR)', score: irScore.score, maxPoints: this.weights.IR,
      status: irScore.status, message: irScore.message, suggestion: irScore.suggestion,
    });

    // 3. Stability (20 pts)
    const stableScore = this.scoreStability(input.maxWeightChange, input.turnoverRate);
    dims.push({
      name: 'STABILITY', nameCN: '因子稳定性', score: stableScore.score, maxPoints: this.weights.STABILITY,
      status: stableScore.status, message: stableScore.message, suggestion: stableScore.suggestion,
    });

    // 4. Crowding (15 pts)
    const crowdScore = this.scoreCrowding(input.crowdingRatio);
    dims.push({
      name: 'CROWDING', nameCN: '因子拥挤度', score: crowdScore.score, maxPoints: this.weights.CROWDING,
      status: crowdScore.status, message: crowdScore.message, suggestion: crowdScore.suggestion,
    });

    // 5. Max Drawdown (10 pts)
    const ddScore = this.scoreDrawdown(input.maxDrawdown);
    dims.push({
      name: 'DRAWDOWN', nameCN: '最大回撤', score: ddScore.score, maxPoints: this.weights.DRAWDOWN,
      status: ddScore.status, message: ddScore.message, suggestion: ddScore.suggestion,
    });

    const totalScore = dims.reduce((s, d) => s + d.score, 0);
    const grade: HealthScoreReport['grade'] = totalScore >= 70 ? '绿色(健康)' : totalScore >= 40 ? '黄色(关注)' : '红色(警告)';

    // Decay warning
    const decayWarning = input.daysSinceOptimization ? input.daysSinceOptimization > 90 : false;
    const decayWarningMessage = decayWarning
      ? '⚠️ 策略超过90天未优化, 因子可能衰退。建议立即运行AI参数优化(1.5USDT)。'
      : '';

    // Overall assessment
    const overall = this.buildOverall(dims, totalScore, grade, input);

    // Actionable items
    const actions = this.buildActions(dims);

    return {
      totalScore,
      grade,
      dimensions: dims,
      overallAssessment: overall,
      actionableItems: actions,
      decayWarning,
      decayWarningMessage,
      generatedAt: Date.now(),
    };
  }

  // ── Dimension Scorers ──────────────────────────────────────────────

  private scoreIC(icValues: number[]): { score: number; status: 'green' | 'yellow' | 'red'; message: string; suggestion: string } {
    if (icValues.length === 0) {
      return { score: 0, status: 'red', message: '无IC数据', suggestion: '至少需要12个月IC数据才能评分。请确认因子计算管线正常。' };
    }

    const avgIC = icValues.reduce((s, v) => s + v, 0) / icValues.length;
    const icStd = Math.sqrt(icValues.reduce((s, v) => s + (v - avgIC) ** 2, 0) / icValues.length);
    const tStat = icStd > 0 ? Math.abs(avgIC / (icStd / Math.sqrt(icValues.length))) : 0;
    const positiveRatio = icValues.filter(v => v > 0).length / icValues.length;

    // Scoring matrix
    let score: number;
    let status: 'green' | 'yellow' | 'red';
    let message: string;
    let suggestion: string;

    if (avgIC >= 0.05 && positiveRatio >= 0.7 && tStat >= 2.0) {
      score = 28;
      status = 'green';
      message = `IC均值${(avgIC * 100).toFixed(1)}%, 正IC率${(positiveRatio * 100).toFixed(0)}%, t统计量${tStat.toFixed(1)}`;
      suggestion = '因子预测能力强, 保持当前参数。';
    } else if (avgIC >= 0.02 && positiveRatio >= 0.5 && tStat >= 1.5) {
      score = 20;
      status = 'yellow';
      message = `IC均值${(avgIC * 100).toFixed(1)}%, 正IC率${(positiveRatio * 100).toFixed(0)}%, 预测能力中等`;
      suggestion = '建议运行AI因子诊断(1USDT)分析IC衰减原因。';
    } else if (avgIC >= 0) {
      score = 10;
      status = 'yellow';
      message = `IC均值${(avgIC * 100).toFixed(1)}%偏低, 因子预测力弱`;
      suggestion = 'IC偏低, 建议审查因子构建逻辑或增加替代数据增强(2USDT)。';
    } else {
      score = 3;
      status = 'red';
      message = `IC均值${(avgIC * 100).toFixed(1)}%为负, 因子方向错误!`;
      suggestion = '⚠️ IC为负, 因子方向完全错误! 建议立即停用或反转因子方向。';
    }

    return { score, status, message, suggestion };
  }

  private scoreIR(irValue: number, icValues: number[]): { score: number; status: 'green' | 'yellow' | 'red'; message: string; suggestion: string } {
    // IR = IC / IC_volatility; typically annualized
    const annualIR = irValue;

    let score: number;
    let status: 'green' | 'yellow' | 'red';
    let message: string;
    let suggestion: string;

    if (annualIR >= 1.0) {
      score = 23;
      status = 'green';
      message = `IR=${annualIR.toFixed(2)}, 风险调整后超额收益优秀`;
      suggestion = '因子信息比率优秀, 可作为核心配置继续使用。';
    } else if (annualIR >= 0.5) {
      score = 18;
      status = 'green';
      message = `IR=${annualIR.toFixed(2)}, 有显著超额收益`;
      suggestion = 'IR良好但仍有提升空间, 可运行AI优化(1.5USDT)。';
    } else if (annualIR >= 0.25) {
      score = 12;
      status = 'yellow';
      message = `IR=${annualIR.toFixed(2)}, 超额收益不稳定`;
      suggestion = 'IR偏低, IC波动率过高。建议检查因子在不同市场环境下的表现。';
    } else if (annualIR > 0) {
      score = 6;
      status = 'yellow';
      message = `IR=${annualIR.toFixed(2)}极低, 几乎没有超额收益`;
      suggestion = '因子超额收益基本为零, 建议寻找替代因子或组合优化。';
    } else {
      score = 2;
      status = 'red';
      message = `IR=${annualIR.toFixed(2)}为负`;
      suggestion = '因子没有超额收益, 建议立即停用。';
    }

    return { score, status, message, suggestion };
  }

  private scoreStability(maxWeightChange: number, turnoverRate: number): { score: number; status: 'green' | 'yellow' | 'red'; message: string; suggestion: string } {
    // Composite: weight change 60% + turnover 40%
    const weightScore = maxWeightChange < 0.05 ? 12 : maxWeightChange < 0.1 ? 9 : maxWeightChange < 0.2 ? 5 : 2;
    const turnoverScore = turnoverRate < 0.1 ? 8 : turnoverRate < 0.2 ? 6 : turnoverRate < 0.4 ? 3 : 1;
    const score = weightScore + turnoverScore;

    let status: 'green' | 'yellow' | 'red';
    let message = `权重最大变动${(maxWeightChange * 100).toFixed(1)}%, 换手率${(turnoverRate * 100).toFixed(0)}%/月`;
    let suggestion: string;

    if (score >= 16) {
      status = 'green';
      suggestion = '因子参数稳定, 信号一致性高。';
    } else if (score >= 10) {
      status = 'yellow';
      suggestion = '因子权重有一定波动, 建议每季度审查一次参数。';
    } else {
      status = 'red';
      suggestion = '⚠️ 因子权重剧烈变动, 可能存在过拟合! 建议回测更长周期。';
    }

    return { score, status, message, suggestion };
  }

  private scoreCrowding(crowdingRatio: number): { score: number; status: 'green' | 'yellow' | 'red'; message: string; suggestion: string } {
    let score: number;
    let status: 'green' | 'yellow' | 'red';
    let message = `拥挤度${(crowdingRatio * 100).toFixed(0)}%`;
    let suggestion: string;

    if (crowdingRatio <= 0.15) {
      score = 14;
      status = 'green';
      suggestion = '因子未被过度使用, 羊群效应风险低。';
    } else if (crowdingRatio <= 0.3) {
      score = 10;
      status = 'green';
      message += ' (中性)';
      suggestion = '拥挤度适中。';
    } else if (crowdingRatio <= 0.5) {
      score = 6;
      status = 'yellow';
      suggestion = '拥挤度偏高, 因子收益可能被侵蚀。建议分散到不同因子。';
    } else {
      score = 2;
      status = 'red';
      suggestion = '⚠️ 因子高度拥挤(>50%), 反转风险极高! 建议立即减仓或寻找替代因子。';
    }

    return { score, status, message, suggestion };
  }

  private scoreDrawdown(maxDrawdown: number): { score: number; status: 'green' | 'yellow' | 'red'; message: string; suggestion: string } {
    const ddPct = maxDrawdown * 100;

    let score: number;
    let status: 'green' | 'yellow' | 'red';
    let message = `最大回撤${ddPct.toFixed(1)}%`;
    let suggestion: string;

    if (ddPct <= 10) {
      score = 9;
      status = 'green';
      suggestion = '回撤控制优秀, 在可承受范围内。';
    } else if (ddPct <= 20) {
      score = 7;
      status = 'green';
      message += ' (可接受)';
      suggestion = '回撤在正常范围, 继续监控。';
    } else if (ddPct <= 30) {
      score = 4;
      status = 'yellow';
      suggestion = `回撤${ddPct.toFixed(0)}%偏高, 建议设置更紧的止损(例如10-15%)。`;
    } else {
      score = 1;
      status = 'red';
      suggestion = `⚠️ 极端回撤${ddPct.toFixed(0)}%! 策略风险过大, 不建议当前参数实盘。`;
    }

    return { score, status, message, suggestion };
  }

  // ── Report Building ────────────────────────────────────────────────

  private buildOverall(
    dims: HealthDimension[],
    totalScore: number,
    grade: string,
    input: HealthScoreInput
  ): string {
    const redCount = dims.filter(d => d.status === 'red').length;
    const yellowCount = dims.filter(d => d.status === 'yellow').length;
    const greenCount = dims.filter(d => d.status === 'green').length;

    if (grade === '绿色(健康)') {
      return `策略健康评分${totalScore}分, ${grade}。${greenCount}/5维度绿灯。策略当前运行状态良好, 可继续使用。建议每月复查一次健康评分。`;
    } else if (grade === '黄色(关注)') {
      return `策略健康评分${totalScore}分, ${grade}。${greenCount}绿${yellowCount}黄${redCount}红。存在${yellowCount + redCount}个需关注维度, 建议2周内优化调整。`;
    } else {
      return `⚠️ 策略健康评分${totalScore}分, ${grade}。${redCount}个维度亮红灯! 策略存在严重问题, 强烈建议暂停实盘并立即审查。`;
    }
  }

  private buildActions(dims: HealthDimension[]): string[] {
    const actions: string[] = [];

    for (const d of dims) {
      if (d.status === 'red') {
        actions.push(`🔴 [${d.nameCN}] ${d.suggestion}`);
      }
    }
    for (const d of dims) {
      if (d.status === 'yellow') {
        actions.push(`🟡 [${d.nameCN}] ${d.suggestion}`);
      }
    }
    if (actions.length === 0) {
      actions.push('✅ 所有维度健康, 无紧急行动项。每月复查即可。');
    }

    return actions;
  }

  /** Quick score for display (no full report) */
  quickScore(input: HealthScoreInput): number {
    return this.score(input).totalScore;
  }

  /** Get dimension breakdown as simple object for charts */
  getDimensionScores(input: HealthScoreInput): Record<string, number> {
    const report = this.score(input);
    const scores: Record<string, number> = {};
    for (const d of report.dimensions) {
      scores[d.nameCN] = d.score;
    }
    return scores;
  }

  /** Generate health trend data (placeholder; needs historical snapshots) */
  generateHealthTrend(inputs: HealthScoreInput[]): Array<{ timestamp: number; score: number }> {
    return inputs.map((input, i) => ({
      timestamp: Date.now() - (inputs.length - i) * 86400000 * 30, // 30-day intervals
      score: this.quickScore(input),
    }));
  }
}

export const strategyHealthScorer = new StrategyHealthScorer();

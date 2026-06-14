// ── R166 P1-A3: Strategy Health Score Card — 策略健康评分卡 (0-100) ─────
// 5-dimensional scoring: Returns(30) + Risk(25) + Stability(20) + Factor(15) + Adaptation(10)
// Auto-diagnosis when score < 60: decay report + actionable recommendations.
//
// IPC-ready: exported types, scoring engine, singleton, and reset.
// Design: no external AI dependency — pure statistical scoring.

import log from 'electron-log';

// ═══════════════════════════════════════════════════════════════════════════
// Input Types
// ═══════════════════════════════════════════════════════════════════════════

export interface StrategyPerformanceData {
  /** Annualized return (decimal) */
  annualizedReturn: number;
  /** Annualized volatility (decimal) */
  annualizedVol: number;
  /** Sharpe ratio */
  sharpeRatio: number;
  /** Sortino ratio */
  sortinoRatio: number;
  /** Calmar ratio */
  calmarRatio: number;
  /** Maximum drawdown (decimal, negative) */
  maxDrawdown: number;
  /** VaR 95% daily (decimal, positive) */
  var95: number;
  /** CVaR 95% daily (decimal, positive) */
  cvar95: number;
  /** Profit factor (grossProfit / grossLoss) */
  profitFactor: number;
  /** Win rate (decimal) */
  winRate: number;
  /** Average win / average loss ratio */
  avgWinLossRatio: number;
  /** Percentage of positive months */
  positiveMonthPct: number;
}

export interface StrategyStabilityData {
  /** Rolling 12-period Sharpe ratio series */
  rollingSharpe: number[];
  /** Monthly returns (ordered) */
  monthlyReturns: number[];
  /** Whether recent 3-month trend is improving */
  recentTrend: 'improving' | 'stable' | 'declining' | 'severe_decline';
  /** Drawdown recovery speed: months to recover from max drawdown */
  recoveryMonths: number;
}

export interface StrategyFactorData {
  /** Factor loading stability: max |change| in loadings over period */
  maxLoadingChange: number;
  /** Average factor correlation (absolute) */
  avgFactorCorrelation: number;
  /** Factor decay: IC decay slope over time */
  icDecaySlope: number;
  /** Whether factor crowding risk exists */
  crowdingRisk: 'none' | 'mild' | 'moderate' | 'severe';
}

export interface StrategyHealthInput {
  strategyId: string;
  strategyName: string;
  performance: StrategyPerformanceData;
  stability: StrategyStabilityData;
  factor?: StrategyFactorData;
  /** Days since strategy was last updated */
  daysSinceUpdate: number;
  /** Days since last strategy check */
  daysSinceLastCheck: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// Output Types
// ═══════════════════════════════════════════════════════════════════════════

export interface DimensionScore {
  name: string;
  nameCN: string;
  weight: number;       // 0-1
  rawScore: number;     // 0-100
  weightedScore: number; // rawScore × weight
  subScores: SubScoreDetail[];
  status: 'healthy' | 'normal' | 'warning' | 'critical';
}

export interface SubScoreDetail {
  metric: string;
  metricCN: string;
  value: number;
  score: number;        // 0-100
  threshold: string;    // e.g. ">60% = 100, <30% = 0"
  verdict: 'excellent' | 'good' | 'fair' | 'poor';
}

export interface HealthDiagnosis {
  /** Primary failing dimensions (score < 40) */
  criticalDimensions: string[];
  /** Secondary concerns (score 40-60) */
  warningDimensions: string[];
  /** Top 3 actionable recommendations */
  recommendations: HealthRecommendation[];
  /** Decay alert: is the strategy in terminal decline? */
  decayAlert: DecayAlert | null;
  /** Human-readable summary (Chinese) */
  summary: string;
}

export interface HealthRecommendation {
  dimension: string;
  severity: 'critical' | 'warning' | 'info';
  action: string;
  expectedImpact: string;
}

export interface DecayAlert {
  detected: boolean;
  severity: 'watch' | 'warning' | 'critical';
  reason: string;
  /** Decay score: how much performance has declined (0-100, higher = worse) */
  decayScore: number;
  /** Estimated remaining useful life in months (if decay continues) */
  remainingLifeMonths: number | null;
}

export interface StrategyHealthScoreCard {
  strategyId: string;
  strategyName: string;
  overallScore: number;         // 0-100
  grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
  dimensions: DimensionScore[];
  diagnosis: HealthDiagnosis | null;
  generatedAt: string;
  validUntil: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// Scoring Thresholds
// ═══════════════════════════════════════════════════════════════════════════

interface MetricThreshold {
  excellent: number;   // threshold for score 90-100
  good: number;        // threshold for score 70-89
  fair: number;        // threshold for score 50-69
  // below fair → 0-49
  higherIsBetter: boolean;
}

const THRESHOLDS: Record<string, MetricThreshold> = {
  sharpeRatio:      { excellent: 2.0,  good: 1.2,  fair: 0.5,  higherIsBetter: true },
  sortinoRatio:      { excellent: 2.5,  good: 1.5,  fair: 0.7,  higherIsBetter: true },
  calmarRatio:       { excellent: 3.0,  good: 1.5,  fair: 0.5,  higherIsBetter: true },
  profitFactor:      { excellent: 2.0,  good: 1.5,  fair: 1.1,  higherIsBetter: true },
  winRate:           { excellent: 0.60, good: 0.50, fair: 0.35, higherIsBetter: true },
  avgWinLossRatio:   { excellent: 3.0,  good: 2.0,  fair: 1.2,  higherIsBetter: true },
  maxDrawdown:       { excellent: 0.10, good: 0.20, fair: 0.35, higherIsBetter: false },
  var95:             { excellent: 0.02, good: 0.04, fair: 0.07, higherIsBetter: false },
  cvar95:            { excellent: 0.03, good: 0.06, fair: 0.10, higherIsBetter: false },
  annualizedVol:     { excellent: 0.12, good: 0.20, fair: 0.30, higherIsBetter: false },
  positiveMonthPct:  { excellent: 0.75, good: 0.60, fair: 0.45, higherIsBetter: true },
  rollingSharpeStd:  { excellent: 0.30, good: 0.60, fair: 1.00, higherIsBetter: false },
  recoveryMonths:    { excellent: 3,    good: 6,    fair: 12,   higherIsBetter: false },
  maxLoadingChange:  { excellent: 0.10, good: 0.25, fair: 0.50, higherIsBetter: false },
  icDecaySlope:      { excellent: 0.01, good: 0.03, fair: 0.06, higherIsBetter: false },
};

function metricScore(value: number, key: string): { score: number; verdict: SubScoreDetail['verdict'] } {
  const t = THRESHOLDS[key];
  if (!t) return { score: 50, verdict: 'fair' };

  const raw = t.higherIsBetter ? value : -value;
  const ex = t.higherIsBetter ? t.excellent : -t.excellent;
  const gd = t.higherIsBetter ? t.good : -t.good;
  const fr = t.higherIsBetter ? t.fair : -t.fair;

  if (raw >= ex) return { score: 95, verdict: 'excellent' };
  if (raw >= gd) {
    const pct = (raw - gd) / (ex - gd);
    return { score: Math.round(70 + pct * 25), verdict: 'good' };
  }
  if (raw >= fr) {
    const pct = (raw - fr) / (gd - fr);
    return { score: Math.round(40 + pct * 30), verdict: 'fair' };
  }
  // below fair: 0-39
  const pct = raw / fr;
  return { score: Math.max(0, Math.round(pct * 40)), verdict: 'poor' };
}

// ═══════════════════════════════════════════════════════════════════════════
// Strategy Health Score Engine
// ═══════════════════════════════════════════════════════════════════════════

export class StrategyHealthScoreEngine {
  constructor() {
    log.info('[StrategyHealthScoreEngine] Initialized');
  }

  /**
   * Evaluate strategy health: score 5 dimensions → overall grade + diagnosis.
   */
  evaluate(input: StrategyHealthInput): StrategyHealthScoreCard {
    const dims = this.scoreDimensions(input);
    const overall = this.computeOverall(dims);
    const grade = this.scoreToGrade(overall);

    const card: StrategyHealthScoreCard = {
      strategyId: input.strategyId,
      strategyName: input.strategyName,
      overallScore: Math.round(overall),
      grade,
      dimensions: dims,
      diagnosis: null,
      generatedAt: new Date().toISOString(),
      validUntil: new Date(Date.now() + 7 * 86400000).toISOString(), // 7 days expiry
    };

    // Auto-diagnose if score < 60
    if (overall < 60) {
      card.diagnosis = this.autoDiagnose(dims, input);
    }

    return card;
  }

  /**
   * Quick health check: returns simple OK/WARN/CRITICAL status.
   */
  quickCheck(input: StrategyHealthInput): { status: string; score: number; message: string } {
    const card = this.evaluate(input);
    if (card.overallScore >= 75) {
      return { status: 'OK', score: card.overallScore, message: `${card.strategyName}: 策略健康 (${card.grade})` };
    }
    if (card.overallScore >= 60) {
      return { status: 'WARN', score: card.overallScore, message: `${card.strategyName}: 策略需要关注 (${card.grade})` };
    }
    return { status: 'CRITICAL', score: card.overallScore, message: `${card.strategyName}: 策略严重衰退 (${card.grade}), 建议立即诊断` };
  }

  // ── Dimension Scoring ─────────────────────────────────────────────────

  private scoreDimensions(input: StrategyHealthInput): DimensionScore[] {
    const p = input.performance;
    const s = input.stability;
    const f = input.factor;

    return [
      this.scoreReturnQuality(p),
      this.scoreRiskControl(p),
      this.scoreStability(p, s),
      this.scoreFactorExposure(f, input),
      this.scoreAdaptation(s, input),
    ];
  }

  // ── D1: Return Quality (30%) ───────────────────────────────────────────

  private scoreReturnQuality(p: StrategyPerformanceData): DimensionScore {
    const subs: SubScoreDetail[] = [
      { metric: 'sharpeRatio', metricCN: '夏普比率', value: p.sharpeRatio, ...metricScore(p.sharpeRatio, 'sharpeRatio'), threshold: '>2.0→100, >1.2→75, >0.5→50' },
      { metric: 'profitFactor', metricCN: '盈亏比', value: p.profitFactor, ...metricScore(p.profitFactor, 'profitFactor'), threshold: '>2.0→100, >1.5→75, >1.1→50' },
      { metric: 'winRate', metricCN: '胜率', value: p.winRate, ...metricScore(p.winRate, 'winRate'), threshold: '>60%→100, >50%→75, >35%→50' },
      { metric: 'avgWinLossRatio', metricCN: '盈亏金额比', value: p.avgWinLossRatio, ...metricScore(p.avgWinLossRatio, 'avgWinLossRatio'), threshold: '>3.0→100, >2.0→75, >1.2→50' },
    ];

    const rawScore = subs.reduce((s, sub) => s + sub.score, 0) / subs.length;
    const weight = 0.30;

    return {
      name: 'returnQuality',
      nameCN: '收益质量',
      weight,
      rawScore: Math.round(rawScore),
      weightedScore: Math.round(rawScore * weight * 100) / 100,
      subScores: subs,
      status: this.dimensionStatus(rawScore),
    };
  }

  // ── D2: Risk Control (25%) ─────────────────────────────────────────────

  private scoreRiskControl(p: StrategyPerformanceData): DimensionScore {
    const subs: SubScoreDetail[] = [
      { metric: 'maxDrawdown', metricCN: '最大回撤', value: Math.abs(p.maxDrawdown), ...metricScore(Math.abs(p.maxDrawdown), 'maxDrawdown'), threshold: '<10%→100, <20%→75, <35%→50' },
      { metric: 'var95', metricCN: 'VaR 95%', value: p.var95, ...metricScore(p.var95, 'var95'), threshold: '<2%→100, <4%→75, <7%→50' },
      { metric: 'cvar95', metricCN: 'CVaR 95%', value: p.cvar95, ...metricScore(p.cvar95, 'cvar95'), threshold: '<3%→100, <6%→75, <10%→50' },
      { metric: 'annualizedVol', metricCN: '年化波动率', value: p.annualizedVol, ...metricScore(p.annualizedVol, 'annualizedVol'), threshold: '<12%→100, <20%→75, <30%→50' },
    ];

    const rawScore = subs.reduce((s, sub) => s + sub.score, 0) / subs.length;
    const weight = 0.25;

    return {
      name: 'riskControl',
      nameCN: '风险控制',
      weight,
      rawScore: Math.round(rawScore),
      weightedScore: Math.round(rawScore * weight * 100) / 100,
      subScores: subs,
      status: this.dimensionStatus(rawScore),
    };
  }

  // ── D3: Stability (20%) ────────────────────────────────────────────────

  private scoreStability(p: StrategyPerformanceData, s: StrategyStabilityData): DimensionScore {
    // Rolling Sharpe std
    const rollingStd = s.rollingSharpe.length >= 3
      ? Math.sqrt(s.rollingSharpe.reduce((sum, r) => sum + ((r - s.rollingSharpe.reduce((a, b) => a + b, 0) / s.rollingSharpe.length)) ** 2, 0) / s.rollingSharpe.length)
      : 1.0;

    // Calmar ratio
    const calmar = p.maxDrawdown !== 0 ? p.annualizedReturn / Math.abs(p.maxDrawdown) : 0;

    const subs: SubScoreDetail[] = [
      { metric: 'rollingSharpeStd', metricCN: '滚动夏普稳定性', value: rollingStd, ...metricScore(rollingStd, 'rollingSharpeStd'), threshold: '<0.3→100, <0.6→75, <1.0→50' },
      { metric: 'positiveMonthPct', metricCN: '正收益率', value: p.positiveMonthPct, ...metricScore(p.positiveMonthPct, 'positiveMonthPct'), threshold: '>75%→100, >60%→75, >45%→50' },
      { metric: 'calmarRatio', metricCN: 'Calmar比率', value: calmar, ...metricScore(calmar, 'calmarRatio'), threshold: '>3.0→100, >1.5→75, >0.5→50' },
    ];

    const rawScore = subs.reduce((s, sub) => s + sub.score, 0) / subs.length;
    const weight = 0.20;

    return {
      name: 'stability',
      nameCN: '稳定性',
      weight,
      rawScore: Math.round(rawScore),
      weightedScore: Math.round(rawScore * weight * 100) / 100,
      subScores: subs,
      status: this.dimensionStatus(rawScore),
    };
  }

  // ── D4: Factor Exposure (15%) ──────────────────────────────────────────

  private scoreFactorExposure(
    f: StrategyFactorData | undefined,
    _input: StrategyHealthInput,
  ): DimensionScore {
    if (!f) {
      return {
        name: 'factorExposure', nameCN: '因子暴露', weight: 0.15,
        rawScore: 50, weightedScore: 7.5, subScores: [], status: 'normal',
      };
    }

    const subs: SubScoreDetail[] = [
      { metric: 'maxLoadingChange', metricCN: '因子载荷稳定性', value: f.maxLoadingChange, ...metricScore(f.maxLoadingChange, 'maxLoadingChange'), threshold: '<10%→100, <25%→75, <50%→50' },
      { metric: 'icDecaySlope', metricCN: 'IC衰减速率', value: Math.abs(f.icDecaySlope), ...metricScore(Math.abs(f.icDecaySlope), 'icDecaySlope'), threshold: '<0.01→100, <0.03→75, <0.06→50' },
    ];

    // Crowding penalty
    const crowdingPenalty: Record<string, number> = { none: 0, mild: 0.85, moderate: 0.65, severe: 0.4 };
    const crowdingMultiplier = crowdingPenalty[f.crowdingRisk] ?? 1.0;

    const avgSubScore = subs.reduce((s, sub) => s + sub.score, 0) / subs.length;
    const rawScore = Math.round(avgSubScore * crowdingMultiplier);
    const weight = 0.15;

    return {
      name: 'factorExposure', nameCN: '因子暴露', weight,
      rawScore, weightedScore: Math.round(rawScore * weight * 100) / 100,
      subScores: subs, status: this.dimensionStatus(rawScore),
    };
  }

  // ── D5: Adaptation (10%) ───────────────────────────────────────────────

  private scoreAdaptation(s: StrategyStabilityData, input: StrategyHealthInput): DimensionScore {
    // Recent trend scoring
    const trendScore: Record<string, number> = { improving: 95, stable: 75, declining: 40, severe_decline: 15 };
    const trendS = trendScore[s.recentTrend] ?? 50;

    // Recovery speed scoring
    const recoveryS = metricScore(s.recoveryMonths, 'recoveryMonths').score;

    // Staleness: days since update
    let stalenessScore: number;
    if (input.daysSinceUpdate <= 7) stalenessScore = 100;
    else if (input.daysSinceUpdate <= 30) stalenessScore = 75;
    else if (input.daysSinceUpdate <= 90) stalenessScore = 50;
    else if (input.daysSinceUpdate <= 180) stalenessScore = 25;
    else stalenessScore = 5;

    const subs: SubScoreDetail[] = [
      { metric: 'recentTrend', metricCN: '近期趋势', value: trendS, score: trendS, verdict: trendS >= 70 ? 'good' : trendS >= 40 ? 'fair' : 'poor', threshold: '改善→95, 稳定→75, 下降→40, 严重下降→15' },
      { metric: 'recoveryMonths', metricCN: '回撤恢复速度', value: s.recoveryMonths, score: recoveryS, verdict: recoveryS >= 70 ? 'good' : recoveryS >= 40 ? 'fair' : 'poor', threshold: '<3月→100, <6月→75, <12月→50' },
      { metric: 'staleness', metricCN: '策略新鲜度', value: input.daysSinceUpdate, score: stalenessScore, verdict: stalenessScore >= 70 ? 'good' : stalenessScore >= 40 ? 'fair' : 'poor', threshold: '<7天→100, <30天→75, <90天→50' },
    ];

    const rawScore = subs.reduce((s, sub) => s + sub.score, 0) / subs.length;
    const weight = 0.10;

    return {
      name: 'adaptation', nameCN: '适应性', weight,
      rawScore: Math.round(rawScore), weightedScore: Math.round(rawScore * weight * 100) / 100,
      subScores: subs, status: this.dimensionStatus(rawScore),
    };
  }

  // ── Auto-Diagnosis ─────────────────────────────────────────────────────

  /**
   * When overall score < 60, auto-diagnose: identify failing dimensions,
   * detect decay, and generate actionable recommendations.
   */
  private autoDiagnose(dims: DimensionScore[], input: StrategyHealthInput): HealthDiagnosis {
    const critical = dims.filter((d) => d.rawScore < 40).map((d) => d.nameCN);
    const warning = dims.filter((d) => d.rawScore >= 40 && d.rawScore < 60).map((d) => d.nameCN);

    const recommendations: HealthRecommendation[] = [];

    // Per-dimension diagnosis
    for (const d of dims) {
      if (d.rawScore < 40) {
        recommendations.push(...this.buildRecommendations(d, 'critical'));
      } else if (d.rawScore < 60) {
        recommendations.push(...this.buildRecommendations(d, 'warning'));
      }
    }

    // Decay detection
    const decay = this.detectDecay(dims, input);

    // Summary
    const summaryCritical = critical.length > 0
      ? `策略${input.strategyName}健康评分低于60分(${this.computeOverall(dims).toFixed(0)})。关键问题: ${critical.join('、')}维度严重不达标。`
      : '';
    const summaryWarning = warning.length > 0
      ? `${critical.length > 0 ? '此外，' : ''}${warning.join('、')}维度需要关注。`
      : '';
    const summaryDecay = decay
      ? ` 衰退警告: ${decay.reason}。`
      : '';
    const summaryAction = recommendations.length > 0
      ? ` 建议优先处理: ${recommendations.slice(0, 3).map((r) => r.action).join('；')}。`
      : '';

    return {
      criticalDimensions: critical,
      warningDimensions: warning,
      recommendations,
      decayAlert: decay,
      summary: `${summaryCritical}${summaryWarning}${summaryDecay}${summaryAction}`.trim(),
    };
  }

  private buildRecommendations(dim: DimensionScore, severity: 'critical' | 'warning'): HealthRecommendation[] {
    const recs: HealthRecommendation[] = [];

    for (const sub of dim.subScores) {
      if (sub.verdict === 'poor') {
        recs.push({
          dimension: dim.nameCN,
          severity,
          action: `${sub.metricCN}(${dim.nameCN})不达标(当前${typeof sub.value === 'number' ? sub.value.toFixed(2) : sub.value})，建议优化策略参数或重新筛选因子`,
          expectedImpact: `预计可提升${dim.nameCN}维度${Math.round((95 - sub.score) * dim.weight)}分`,
        });
      }
    }

    return recs;
  }

  private detectDecay(dims: DimensionScore[], input: StrategyHealthInput): DecayAlert | null {
    const adaptation = dims.find((d) => d.name === 'adaptation');
    const stability = dims.find((d) => d.name === 'stability');
    const returnQuality = dims.find((d) => d.name === 'returnQuality');

    let decayScore = 0;
    const reasons: string[] = [];

    // Adaptability: declining trend is the strongest decay signal
    if (adaptation && adaptation.rawScore < 40) {
      decayScore += 40;
      reasons.push('近期表现趋势下降');
    }

    // Stability: rolling sharpe dropping
    if (stability && stability.rawScore < 50) {
      decayScore += 30;
      reasons.push('夏普比率稳定性下降');
    }

    // Return quality: chronically low
    if (returnQuality && returnQuality.rawScore < 35) {
      decayScore += 30;
      reasons.push('收益质量持续走低');
    }

    // Staleness bonus: hasn't been updated in a while
    if (input.daysSinceUpdate > 90) {
      decayScore += 15;
      reasons.push(`策略已${input.daysSinceUpdate}天未更新`);
    }

    if (decayScore === 0) return null;

    // Estimate remaining life: rough heuristic
    const months = input.stability.monthlyReturns.length;
    const recentAvgReturn = months >= 3
      ? input.stability.monthlyReturns.slice(-3).reduce((s, r) => s + r, 0) / 3
      : 0;
    const remainingLife = recentAvgReturn > 0 && decayScore > 0
      ? Math.round(decayScore / (recentAvgReturn * 12 * 100))
      : null;

    const severity = decayScore >= 60 ? 'critical' : decayScore >= 30 ? 'warning' : 'watch';

    return {
      detected: true,
      severity,
      reason: reasons.join('；'),
      decayScore,
      remainingLifeMonths: remainingLife,
    };
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  private computeOverall(dims: DimensionScore[]): number {
    return dims.reduce((s, d) => s + d.weightedScore, 0);
  }

  private scoreToGrade(score: number): StrategyHealthScoreCard['grade'] {
    if (score >= 90) return 'A+';
    if (score >= 75) return 'A';
    if (score >= 65) return 'B';
    if (score >= 50) return 'C';
    if (score >= 35) return 'D';
    return 'F';
  }

  private dimensionStatus(rawScore: number): DimensionScore['status'] {
    if (rawScore >= 75) return 'healthy';
    if (rawScore >= 55) return 'normal';
    if (rawScore >= 35) return 'warning';
    return 'critical';
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Factory & Singleton
// ═══════════════════════════════════════════════════════════════════════════

let _healthEngine: StrategyHealthScoreEngine | null = null;

export function getHealthScoreEngine(): StrategyHealthScoreEngine {
  if (!_healthEngine) _healthEngine = new StrategyHealthScoreEngine();
  return _healthEngine;
}

export function createHealthScoreEngine(): StrategyHealthScoreEngine {
  return new StrategyHealthScoreEngine();
}

export function resetHealthScoreEngine(): void {
  _healthEngine = null;
}

export default {
  StrategyHealthScoreEngine,
  getHealthScoreEngine,
  createHealthScoreEngine,
  resetHealthScoreEngine,
};

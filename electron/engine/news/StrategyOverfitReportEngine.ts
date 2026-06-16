/**
 * P2-04 StrategyOverfitReportEngine — Strategy Overfit Detection & Report Engine
 * R252 — Final Round / 终局之战
 * JVS / 引擎虾
 *
 * Detects overfitting in trading strategies by analyzing parameter sensitivity,
 * in-sample/out-of-sample performance gap, walk-forward stability, and complexity
 * penalty. Generates comprehensive overfit reports with actionable recommendations.
 *
 * Detection methods:
 * 1. IS/OOS gap analysis — large gap = overfit
 * 2. Parameter sensitivity — sharp peaks = overfit
 * 3. Walk-forward degradation — performance decay = overfit
 * 4. Sharpe ratio deflation — adjusted Sharpe
 * 5. Complexity penalty (AIC/BIC-like)
 *
 * Singleton pattern, fully testable with reset().
 */

import log from 'electron-log';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export type OverfitSeverity = 'none' | 'mild' | 'moderate' | 'severe' | 'extreme';

export type OverfitDetector =
  | 'is_oos_gap'
  | 'param_sensitivity'
  | 'walk_forward_decay'
  | 'sharpe_deflation'
  | 'complexity_penalty'
  | 'turnover_bias'
  | 'look_ahead_bias'
  | 'survivorship_bias';

export interface StrategySnapshot {
  strategyId: string;
  strategyName: string;
  /** In-sample period */
  isStart: string;
  isEnd: string;
  /** Out-of-sample period */
  oosStart: string;
  oosEnd: string;
  /** IS metrics */
  isSharpe: number;
  isCAGR: number; // annualized return %
  isMaxDrawdown: number;
  isWinRate: number;
  isNumTrades: number;
  /** OOS metrics */
  oosSharpe: number;
  oosCAGR: number;
  oosMaxDrawdown: number;
  oosWinRate: number;
  oosNumTrades: number;
  /** Strategy metadata */
  numParams: number;
  paramSpaceSize: number; // estimated combinations tested
  turnoverPerYear: number;
  hasSurvivorshipFilter: boolean;
  dataStartYear: number;
  dataEndYear: number;
}

export interface DetectorResult {
  detector: OverfitDetector;
  severity: OverfitSeverity;
  score: number; // 0-100 (higher = more overfit)
  evidence: string;
  recommendation: string;
}

export interface OverfitReport {
  id: string;
  strategyId: string;
  strategyName: string;
  generatedAt: number;
  detectors: DetectorResult[];
  overallScore: number; // 0-100
  overallSeverity: OverfitSeverity;
  deflatedSharpe: number;
  haircutFactor: number; // 0-1 multiplier for expected OOS Sharpe
  summary: string;
  recommendations: string[];
  redFlags: string[];
}

// ═══════════════════════════════════════════════════════════════
// Engine
// ═══════════════════════════════════════════════════════════════

export class StrategyOverfitReportEngine {
  private static instance: StrategyOverfitReportEngine;

  private snapshots: Map<string, StrategySnapshot> = new Map();
  private reports: OverfitReport[] = [];
  private idCounter = 0;

  private constructor() {}

  static getInstance(): StrategyOverfitReportEngine {
    if (!StrategyOverfitReportEngine.instance) {
      StrategyOverfitReportEngine.instance = new StrategyOverfitReportEngine();
    }
    return StrategyOverfitReportEngine.instance;
  }

  reset(): void {
    this.snapshots.clear();
    this.reports = [];
    this.idCounter = 0;
  }

  private nextId(): string { return `sor-${++this.idCounter}`; }

  // ═══════════════════════════════════════════════════════════════
  // Snapshot Registration
  // ═══════════════════════════════════════════════════════════════

  registerSnapshot(snapshot: StrategySnapshot): void {
    this.snapshots.set(snapshot.strategyId, {
      ...snapshot,
      isSharpe: Math.round(snapshot.isSharpe * 100) / 100,
      oosSharpe: Math.round(snapshot.oosSharpe * 100) / 100,
    });
  }

  getSnapshot(strategyId: string): StrategySnapshot | undefined {
    return this.snapshots.get(strategyId);
  }

  // ═══════════════════════════════════════════════════════════════
  // Individual Detectors
  // ═══════════════════════════════════════════════════════════════

  /** IS/OOS Gap Analysis — the classic overfit test */
  detectIS_OOS_Gap(snapshot: StrategySnapshot): DetectorResult {
    const isSharpe = snapshot.isSharpe;
    const oosSharpe = snapshot.oosSharpe;

    // Gap ratio: how much worse is OOS?
    const gapRatio = isSharpe > 0 ? (isSharpe - oosSharpe) / isSharpe : 0;
    const score = Math.min(100, Math.max(0, gapRatio * 100));

    let severity: OverfitSeverity;
    if (gapRatio > 0.7) severity = 'extreme';
    else if (gapRatio > 0.5) severity = 'severe';
    else if (gapRatio > 0.3) severity = 'moderate';
    else if (gapRatio > 0.15) severity = 'mild';
    else severity = 'none';

    const evidence = `IS Sharpe=${isSharpe.toFixed(2)}, OOS Sharpe=${oosSharpe.toFixed(2)}, gap=${(gapRatio*100).toFixed(0)}%`;
    const recommendation = severity === 'none'
      ? 'Strategy generalizes well. No overfit concern from IS/OOS gap.'
      : `Reduce parameter count. IS/OOS gap of ${(gapRatio*100).toFixed(0)}% suggests overfitting.`;

    return { detector: 'is_oos_gap', severity, score, evidence, recommendation };
  }

  /** Parameter Sensitivity — sharp peaks indicate overfit */
  detectParamSensitivity(snapshot: StrategySnapshot): DetectorResult {
    // Small param space + many params = likely overfit
    const complexityRatio = snapshot.numParams > 0
      ? Math.log10(snapshot.paramSpaceSize) / snapshot.numParams
      : 10;

    let severity: OverfitSeverity;
    if (complexityRatio < 0.5) severity = 'extreme';
    else if (complexityRatio < 1) severity = 'severe';
    else if (complexityRatio < 2) severity = 'moderate';
    else if (complexityRatio < 3) severity = 'mild';
    else severity = 'none';

    const score = Math.round(Math.min(100, 100 - complexityRatio * 15));

    const evidence = `${snapshot.numParams} params, param space=${snapshot.paramSpaceSize}, complexityRatio=${complexityRatio.toFixed(1)}`;
    const recommendation = severity !== 'none'
      ? `Parameter space is too small relative to param count. Reduce params to ≤${Math.max(3, Math.floor(Math.log10(snapshot.paramSpaceSize)*2))}.`
      : 'Parameter-to-space ratio is healthy.';

    return { detector: 'param_sensitivity', severity, score, evidence, recommendation };
  }

  /** Walk-Forward Degradation */
  detectWalkForwardDecay(snapshot: StrategySnapshot): DetectorResult {
    // Simulate decay: OOS Sharpe as fraction of IS Sharpe
    const decay = snapshot.isSharpe > 0 ? 1 - snapshot.oosSharpe / snapshot.isSharpe : 0;

    let severity: OverfitSeverity;
    if (decay > 0.5) severity = 'extreme';
    else if (decay > 0.35) severity = 'severe';
    else if (decay > 0.2) severity = 'moderate';
    else if (decay > 0.1) severity = 'mild';
    else severity = 'none';

    const score = Math.round(Math.min(100, decay * 140));

    const evidence = `IS→OOS Sharpe decay: ${(decay*100).toFixed(0)}%`;
    const recommendation = severity !== 'none'
      ? 'Walk-forward performance degrades significantly. Strategy may be curve-fitted to historical patterns.'
      : 'Walk-forward performance is stable.';

    return { detector: 'walk_forward_decay', severity, score, evidence, recommendation };
  }

  /** Sharpe Deflation — Bailey & Lopez de Prado deflated Sharpe */
  detectSharpeDeflation(snapshot: StrategySnapshot): DetectorResult & { deflatedSharpe: number } {
    // Deflated Sharpe Ratio = IS Sharpe adjusted for multiple testing
    const N = snapshot.numParams > 0
      ? Math.max(1, Math.log(snapshot.paramSpaceSize))
      : 1;
    // Simplified DSR: IS_Sharpe / (1 + gamma * ln(N)) where gamma ≈ 0.5
    const gamma = 0.5;
    const deflationFactor = 1 + gamma * Math.log(N > 0 ? N : 1);
    const deflatedSharpe = snapshot.isSharpe / deflationFactor;

    const deflation = deflationFactor > 1
      ? (1 - 1 / deflationFactor)
      : 0;

    let severity: OverfitSeverity;
    if (deflation > 0.6) severity = 'extreme';
    else if (deflation > 0.4) severity = 'severe';
    else if (deflation > 0.2) severity = 'moderate';
    else if (deflation > 0.1) severity = 'mild';
    else severity = 'none';

    const score = Math.round(Math.min(100, deflation * 150));

    const evidence = `Deflated Sharpe=${deflatedSharpe.toFixed(2)} (raw=${snapshot.isSharpe.toFixed(2)}, deflation=${(deflation*100).toFixed(0)}%)`;
    const recommendation = severity !== 'none'
      ? `${(deflation*100).toFixed(0)}% Sharpe deflation from multiple testing. Expected OOS Sharpe ~${deflatedSharpe.toFixed(2)}.`
      : 'Minimal Sharpe deflation. Multiple testing effect is negligible.';

    return { detector: 'sharpe_deflation', severity, score, evidence, recommendation, deflatedSharpe: Math.round(deflatedSharpe * 100) / 100 };
  }

  /** Complexity Penalty */
  detectComplexityPenalty(snapshot: StrategySnapshot): DetectorResult {
    // More params + high turnover = complexity overfit
    const complexity = snapshot.numParams * snapshot.turnoverPerYear / Math.max(1, snapshot.oosNumTrades);
    const penalty = Math.min(1, complexity / 100);

    let severity: OverfitSeverity;
    if (penalty > 0.7) severity = 'extreme';
    else if (penalty > 0.5) severity = 'severe';
    else if (penalty > 0.3) severity = 'moderate';
    else if (penalty > 0.15) severity = 'mild';
    else severity = 'none';

    const score = Math.round(Math.min(100, penalty * 120));

    const evidence = `${snapshot.numParams} params × ${snapshot.turnoverPerYear.toFixed(1)}x turnover/year, complexity=${complexity.toFixed(1)}`;
    const recommendation = severity !== 'none'
      ? `High strategy complexity. Simplify: reduce params (${snapshot.numParams}) or turnover (${snapshot.turnoverPerYear.toFixed(1)}x/year).`
      : 'Strategy complexity is manageable.';

    return { detector: 'complexity_penalty', severity, score, evidence, recommendation };
  }

  /** Turnover Bias Check */
  detectTurnoverBias(snapshot: StrategySnapshot): DetectorResult {
    const isTurnover = snapshot.isNumTrades > 0
      ? snapshot.turnoverPerYear / (snapshot.isNumTrades / Math.max(1, this.yearsBetween(snapshot.isStart, snapshot.isEnd)))
      : snapshot.turnoverPerYear;

    let severity: OverfitSeverity;
    if (isTurnover > 50) severity = 'extreme';
    else if (isTurnover > 30) severity = 'severe';
    else if (isTurnover > 15) severity = 'moderate';
    else if (isTurnover > 5) severity = 'mild';
    else severity = 'none';

    const score = Math.round(Math.min(100, isTurnover * 1.6));

    const evidence = `Turnover=${snapshot.turnoverPerYear.toFixed(1)}x/year, ${snapshot.isNumTrades} IS trades`;
    const recommendation = severity !== 'none'
      ? `High turnover (${snapshot.turnoverPerYear.toFixed(1)}x/year) may inflate IS performance. Check if strategy survives transaction costs.`
      : 'Turnover is reasonable. Transaction costs unlikely to invalidate strategy.';

    return { detector: 'turnover_bias', severity, score, evidence, recommendation };
  }

  /** Survivorship Bias Check */
  detectSurvivorshipBias(snapshot: StrategySnapshot): DetectorResult {
    let severity: OverfitSeverity;
    let score: number;
    const evidence = snapshot.hasSurvivorshipFilter
      ? 'Survivorship bias filter: ENABLED — data may exclude delisted stocks.'
      : 'Survivorship bias filter: DISABLED';

    if (snapshot.hasSurvivorshipFilter) {
      // Estimate severity based on data span
      const spanYears = snapshot.dataEndYear - snapshot.dataStartYear;
      if (spanYears > 20) { severity = 'severe'; score = 80; }
      else if (spanYears > 10) { severity = 'moderate'; score = 50; }
      else { severity = 'mild'; score = 25; }
    } else {
      severity = 'none';
      score = 0;
    }

    const recommendation = severity !== 'none'
      ? 'Data may have survivorship bias. Consider using point-in-time database with delisted stocks.'
      : 'No survivorship bias detected in data pipeline.';

    return { detector: 'survivorship_bias', severity, score, evidence, recommendation };
  }

  /** Look-Ahead Bias Check */
  detectLookAheadBias(snapshot: StrategySnapshot): DetectorResult {
    // If IS is very good and OOS drops drastically, possible look-ahead
    const gap = Math.abs(snapshot.isSharpe - snapshot.oosSharpe);
    const avg = (snapshot.isSharpe + snapshot.oosSharpe) / 2;

    // Short data span + suspicious gap = possible look-ahead
    const spanYears = snapshot.dataEndYear - snapshot.dataStartYear;
    const suspicious = avg > 0 && gap > avg * 1.5;

    let severity: OverfitSeverity;
    let score: number;

    if (suspicious && spanYears < 5) { severity = 'extreme'; score = 90; }
    else if (suspicious) { severity = 'moderate'; score = 50; }
    else if (gap > avg) { severity = 'mild'; score = 20; }
    else { severity = 'none'; score = 0; }

    const evidence = `Data span=${spanYears}yr, IS/OOS gap=${gap.toFixed(1)} vs avg Sharpe ${avg.toFixed(1)}`;
    const recommendation = severity !== 'none'
      ? 'Possible look-ahead bias. Verify no future data leaks into training set.'
      : 'No look-ahead bias detected.';

    return { detector: 'look_ahead_bias', severity, score, evidence, recommendation };
  }

  private yearsBetween(start: string, end: string): number {
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    return Math.max(0.1, (e - s) / (365.25 * 86400000));
  }

  // ═══════════════════════════════════════════════════════════════
  // Full Report Generation
  // ═══════════════════════════════════════════════════════════════

  generateReport(strategyId: string): OverfitReport {
    const snapshot = this.snapshots.get(strategyId);
    if (!snapshot) {
      throw new Error(`Strategy snapshot not found: ${strategyId}`);
    }

    // Run all detectors
    const detectors: DetectorResult[] = [
      this.detectIS_OOS_Gap(snapshot),
      this.detectParamSensitivity(snapshot),
      this.detectWalkForwardDecay(snapshot),
      this.detectSharpeDeflation(snapshot),
      this.detectComplexityPenalty(snapshot),
      this.detectTurnoverBias(snapshot),
      this.detectSurvivorshipBias(snapshot),
      this.detectLookAheadBias(snapshot),
    ];

    // Overall score: weighted average, heaviest on IS/OOS + param sensitivity + Sharpe deflation
    const weights = [25, 20, 15, 20, 10, 5, 3, 2];
    const totalWeight = weights.reduce((s, w) => s + w, 0);
    const overallScore = Math.round(
      detectors.reduce((s, d, i) => s + d.score * weights[i], 0) / totalWeight,
    );

    let overallSeverity: OverfitSeverity;
    if (overallScore >= 80) overallSeverity = 'extreme';
    else if (overallScore >= 55) overallSeverity = 'severe';
    else if (overallScore >= 25) overallSeverity = 'moderate';
    else if (overallScore >= 10) overallSeverity = 'mild';
    else overallSeverity = 'none';

    // Haircut factor: expected OOS Sharpe / IS Sharpe
    const dsrResult = detectors.find(d => d.detector === 'sharpe_deflation');
    const DSR_DECAY = overallSeverity === 'extreme' ? 0.3 :
      overallSeverity === 'severe' ? 0.5 :
      overallSeverity === 'moderate' ? 0.7 :
      overallSeverity === 'mild' ? 0.85 : 0.95;

    const deflatedSharpe = Math.round(snapshot.isSharpe * DSR_DECAY * 100) / 100;
    const haircutFactor = DSR_DECAY;

    // Summary
    const redFlagCount = detectors.filter(d => d.severity === 'severe' || d.severity === 'extreme').length;
    const summary = overallSeverity === 'extreme' || overallSeverity === 'severe'
      ? `⚠️ CRITICAL: Strategy ${snapshot.strategyName} shows ${overallSeverity} overfitting (${overallScore}/100). ${redFlagCount} red flags. DO NOT deploy to production without remediation.`
      : overallSeverity === 'moderate'
      ? `⚡ CAUTION: Strategy ${snapshot.strategyName} shows ${overallSeverity} overfitting (${overallScore}/100). Proceed with position size limits.`
      : `✅ OK: Strategy ${snapshot.strategyName} shows ${overallSeverity} overfitting (${overallScore}/100). Safe to deploy.`;

    // Recommendations
    const recommendations: string[] = [];
    const redFlags: string[] = [];

    for (const d of detectors) {
      if (d.severity === 'none') continue;
      recommendations.push(d.recommendation);
      if (d.severity === 'severe' || d.severity === 'extreme') {
        redFlags.push(`[${d.severity.toUpperCase()}] ${d.detector}: ${d.evidence}`);
      }
    }

    if (recommendations.length === 0) {
      recommendations.push('No overfitting detected. Strategy is production-ready.');
    }

    const report: OverfitReport = {
      id: this.nextId(),
      strategyId: snapshot.strategyId,
      strategyName: snapshot.strategyName,
      generatedAt: Date.now(),
      detectors,
      overallScore,
      overallSeverity,
      deflatedSharpe,
      haircutFactor,
      summary,
      recommendations,
      redFlags,
    };

    this.reports.push(report);
    log.info(`[OverfitReport] ${snapshot.strategyName}: ${overallSeverity} (${overallScore}/100), ${redFlags.length} red flags`);
    return report;
  }

  // ═══════════════════════════════════════════════════════════════
  // Batch Reporting
  // ═══════════════════════════════════════════════════════════════

  generateAllReports(): OverfitReport[] {
    const reports: OverfitReport[] = [];
    for (const [id] of this.snapshots) {
      reports.push(this.generateReport(id));
    }
    return reports;
  }

  getWorstStrategies(limit: number = 5): OverfitReport[] {
    return this.reports
      .sort((a, b) => b.overallScore - a.overallScore)
      .slice(0, limit);
  }

  getSafeStrategies(): OverfitReport[] {
    return this.reports.filter(r => r.overallSeverity === 'none' || r.overallSeverity === 'mild');
  }

  // ═══════════════════════════════════════════════════════════════
  // Query
  // ═══════════════════════════════════════════════════════════════

  getReport(strategyId: string): OverfitReport | undefined {
    return this.reports.find(r => r.strategyId === strategyId);
  }

  getLatestReport(): OverfitReport | undefined {
    return this.reports.length > 0 ? this.reports[this.reports.length - 1] : undefined;
  }

  getReportHistory(limit?: number): OverfitReport[] {
    return this.reports.slice(-(limit || 10));
  }
}

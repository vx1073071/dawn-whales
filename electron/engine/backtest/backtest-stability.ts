// ── Q64: Backtest Stability Checker ─────────────────────────────────────────────
// Validates backtest robustness: tests for overfitting, walk-forward stability,
// sensitivity to parameter changes, and out-of-sample degradation

import log from 'electron-log';

// ── Types ──────────────────────────────────────────────────────────────────

export interface StabilityResult {
  overallStable: boolean;
  stabilityScore: number;      // 0-100
  grade: 'A' | 'B' | 'C' | 'D' | 'F';

  // Overfitting indicators
  isOverfitted: boolean;
  overfittingRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'SEVERE';
  trainOOSGap: number;        // IS vs OOS performance gap (bps)
  paramSensitivity: number;    // 0-100 (higher = more sensitive = worse)

  // Walk-forward stability
  wfConsistency: number;      // 0-100: how consistent across W/F windows
  avgIS: number;
  avgOOS: number;
  oosRatio: number;          // avgOOS / avgIS
  worstWindow: { start: number; end: number; return: number; drawdown: number } | null;

  // Parameter stability
  paramRobustness: 'ROBUST' | 'MODERATE' | 'FRAGILE';
  optimalParams: Record<string, number>;
  paramRanges: Record<string, { min: number; max: number; stable: boolean }>;

  // Recommendations
  suggestions: string[];
  timestamp: number;
}

export interface SensitivityResult {
  param: string;
  baseline: number;
  isSensitive: boolean;       // true if >20% change in output per 10% change in input
  sensitivityRatio: number;   // %output / %input
  stableRange: { min: number; max: number };
  fragileRegion: string | null;
}

export interface WalkForwardResult {
  windowIndex: number;
  startDate: string;
  endDate: string;
  isInSample: boolean;
  totalReturn: number;        // %
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  trades: number;
  paramSet: Record<string, number>;
}

// ── Stability Checker ─────────────────────────────────────────────────────

export class BacktestStabilityChecker {
  constructor() {
    log.info('[BacktestStabilityChecker] Initialized');
  }

  // ── Full Stability Analysis ─────────────────────────────────────────

  analyzeStability(params: {
    // Backtest results
    isReturns: number[];           // In-sample daily returns (sorted by date)
    oosReturns: number[];         // Out-of-sample daily returns
    paramGridResults?: Array<{
      params: Record<string, number>;
      isReturn: number;
      oosReturn: number;
      sharpeIS: number;
      sharpeOOS: number;
    }>;
    walkForwardResults?: WalkForwardResult[];

    // Metadata
    isPeriodDays?: number;
    oosPeriodDays?: number;
    tradingDays?: number;
  }): StabilityResult {
    log.info('[BacktestStabilityChecker] Analyzing stability...');

    const {
      isReturns, oosReturns,
      paramGridResults,
      walkForwardResults,
      isPeriodDays = 252,
      oosPeriodDays = 60,
      tradingDays = 252,
    } = params;

    // ── IS vs OOS gap ──────────────────────────────────────────────
    const isAnnReturn = isReturns.reduce((a, b) => a + b, 0) * (tradingDays / isPeriodDays);
    const oosAnnReturn = oosReturns.reduce((a, b) => a + b, 0) * (tradingDays / oosPeriodDays);
    const trainOOSGap = Math.round((isAnnReturn - oosAnnReturn) * 100); // in %-points

    // ── Overfitting risk ────────────────────────────────────────────
    const oosRatio = isAnnReturn !== 0 ? oosAnnReturn / isAnnReturn : 0;
    let overfittingRisk: StabilityResult['overfittingRisk'];
    if (trainOOSGap > 15 || oosRatio < 0.3) overfittingRisk = 'SEVERE';
    else if (trainOOSGap > 8 || oosRatio < 0.5) overfittingRisk = 'HIGH';
    else if (trainOOSGap > 4 || oosRatio < 0.7) overfittingRisk = 'MEDIUM';
    else overfittingRisk = 'LOW';

    const isOverfitted = overfittingRisk === 'HIGH' || overfittingRisk === 'SEVERE';

    // ── Parameter sensitivity ────────────────────────────────────────
    let paramSensitivity = 50; // default
    if (paramGridResults && paramGridResults.length > 1) {
      const results = paramGridResults;
      const bestResult = [...results].sort((a, b) => b.sharpeOOS - a.sharpeOOS)[0];
      const worstResult = [...results].sort((a, b) => a.sharpeOOS - b.sharpeOOS)[0];
      const range = bestResult.sharpeOOS - worstResult.sharpeOOS;
      const stability = Math.max(0, 100 - range * 10);
      paramSensitivity = Math.round(stability);
    }

    // ── Walk-forward consistency ────────────────────────────────────
    let wfConsistency = 70;
    let avgIS = isAnnReturn;
    let avgOOS = oosAnnReturn;
    let worstWindow: StabilityResult['worstWindow'] = null;

    if (walkForwardResults && walkForwardResults.length > 1) {
      const oosWindows = walkForwardResults.filter(w => !w.isInSample);
      if (oosWindows.length > 0) {
        avgOOS = oosWindows.reduce((s, w) => s + w.totalReturn, 0) / oosWindows.length;
        const oosReturns2 = oosWindows.map(w => w.totalReturn);
        const mean = avgOOS;
        const variance = oosReturns2.reduce((s, v) => s + (v - mean) ** 2, 0) / oosReturns2.length;
        const stdDev = Math.sqrt(variance);
        const cv = stdDev / Math.abs(mean);
        wfConsistency = Math.max(0, Math.min(100, Math.round((1 - Math.min(cv, 1)) * 100)));
        worstWindow = [...oosWindows].sort((a, b) => a.totalReturn - b.totalReturn)[0] ?? null;
      }

      const isWindows = walkForwardResults.filter(w => w.isInSample);
      if (isWindows.length > 0) {
        avgIS = isWindows.reduce((s, w) => s + w.totalReturn, 0) / isWindows.length;
      }
    }

    const wfOOSRatio = avgIS > 0 ? avgOOS / avgIS : 0;

    // ── Param robustness ────────────────────────────────────────────
    let paramRobustness: StabilityResult['paramRobustness'] = 'MODERATE';
    const optimalParams: Record<string, number> = {};
    const paramRanges: Record<string, { min: number; max: number; stable: boolean }> = {};

    if (paramGridResults && paramGridResults.length > 0) {
      const sorted = [...paramGridResults].sort((a, b) => b.sharpeOOS - a.sharpeOOS);
      const topResults = sorted.slice(0, Math.max(3, Math.ceil(sorted.length * 0.1)));

      // Find param ranges where OOS Sharpe stays within 20% of best
      for (const paramKey of Object.keys(topResults[0]?.params ?? {})) {
        const values = topResults.map(r => r.params[paramKey]).filter(v => v !== undefined);
        if (values.length > 1) {
          const min = Math.min(...values);
          const max = Math.max(...values);
          const rangeSpan = max - min;
          paramRanges[paramKey] = {
            min,
            max,
            stable: rangeSpan > 0 && rangeSpan / ((min + max) / 2) < 0.5,
          };
          optimalParams[paramKey] = values.reduce((a, b) => a + b, 0) / values.length;
        }
      }

      const stableCount = Object.values(paramRanges).filter(r => r.stable).length;
      paramRobustness = stableCount === Object.keys(paramRanges).length ? 'ROBUST'
        : stableCount > 0 ? 'MODERATE' : 'FRAGILE';
    }

    // ── Composite score ──────────────────────────────────────────────
    const overfitPenalty = overfittingRisk === 'SEVERE' ? 0 : overfittingRisk === 'HIGH' ? 10
      : overfittingRisk === 'MEDIUM' ? 5 : 0;
    const oosBonus = wfOOSRatio > 0.8 ? 20 : wfOOSRatio > 0.6 ? 15 : wfOOSRatio > 0.4 ? 8 : 0;
    const consistencyBonus = wfConsistency > 80 ? 15 : wfConsistency > 60 ? 10 : 5;
    const paramBonus = paramRobustness === 'ROBUST' ? 15 : paramRobustness === 'MODERATE' ? 8 : 0;

    const stabilityScore = Math.max(0, Math.min(100,
      70 - overfitPenalty +
      Math.round(wfConsistency * 0.15) +
      Math.round((100 - paramSensitivity) * 0.10) +
      oosBonus + consistencyBonus + paramBonus
    ));

    let grade: StabilityResult['grade'];
    if (stabilityScore >= 85) grade = 'A';
    else if (stabilityScore >= 70) grade = 'B';
    else if (stabilityScore >= 50) grade = 'C';
    else if (stabilityScore >= 30) grade = 'D';
    else grade = 'F';

    // ── Suggestions ─────────────────────────────────────────────────
    const suggestions: string[] = [];
    if (isOverfitted) suggestions.push('⚠️ SEVERE overfitting detected — strategy may not survive OOS');
    if (trainOOSGap > 8) suggestions.push('Large IS/OOS gap — reduce model complexity or add constraints');
    if (paramSensitivity < 40) suggestions.push('High parameter sensitivity — widen parameter ranges for robustness');
    if (wfConsistency < 50) suggestions.push('Poor walk-forward consistency — strategy may be regime-dependent');
    if (wfOOSRatio < 0.4) suggestions.push('OOS returns significantly below IS — strong overfitting signal');
    if (worstWindow && worstWindow.return < -20) {
      suggestions.push(`Worst walk-forward window: ${worstWindow.start}-${worstWindow.end} with ${worstWindow.return.toFixed(1)}% return — investigate regime change`);
    }
    if (paramRobustness === 'FRAGILE') suggestions.push('Parameters are fragile — try ensemble approach or reduce param count');
    if (suggestions.length === 0) suggestions.push('✅ Stability metrics within acceptable range — monitor regularly');

    return {
      overallStable: !isOverfitted && stabilityScore >= 60,
      stabilityScore,
      grade,
      isOverfitted,
      overfittingRisk,
      trainOOSGap: Math.round(trainOOSGap * 100) / 100,
      paramSensitivity,
      wfConsistency,
      avgIS: Math.round(avgIS * 100) / 100,
      avgOOS: Math.round(avgOOS * 100) / 100,
      oosRatio: Math.round(wfOOSRatio * 100) / 100,
      worstWindow: worstWindow ? {
        ...worstWindow,
        return: Math.round(worstWindow.return * 100) / 100,
        drawdown: Math.round(worstWindow.drawdown * 100) / 100,
      } : null,
      paramRobustness,
      optimalParams,
      paramRanges,
      suggestions,
      timestamp: Date.now(),
    };
  }

  // ── Sensitivity Analysis ─────────────────────────────────────────

  analyzeSensitivity(
    paramName: string,
    paramValues: number[],
    outputByValue: number[]   // e.g. Sharpe for each param value
  ): SensitivityResult {
    if (paramValues.length !== outputByValue.length || paramValues.length < 2) {
      return {
        param: paramName, baseline: 0, isSensitive: false,
        sensitivityRatio: 0, stableRange: { min: 0, max: 0 }, fragileRegion: null,
      };
    }

    const baselineIdx = Math.floor(paramValues.length / 2);
    const baseline = outputByValue[baselineIdx];

    // Calculate sensitivity: % change in output per % change in input
    const sensitivities = paramValues
      .map((v, i) => {
        if (i === baselineIdx || v === 0) return 0;
        const pctInput = Math.abs((v - paramValues[baselineIdx]) / paramValues[baselineIdx]);
        const pctOutput = baseline !== 0 ? Math.abs((outputByValue[i] - baseline) / baseline) : 0;
        return pctOutput / pctInput;
      });

    const maxSens = Math.max(...sensitivities);
    const avgSens = sensitivities.reduce((a, b) => a + b, 0) / sensitivities.length;
    const sensitivityRatio = Math.round(avgSens * 100) / 100;

    // Find stable range: where output within 20% of max
    const maxOutput = Math.max(...outputByValue);
    const threshold = maxOutput * 0.8;
    const stableIndices = outputByValue
      .map((o, i) => o >= threshold ? paramValues[i] : null)
      .filter((v): v is number => v !== null);

    return {
      param: paramName,
      baseline: Math.round(baseline * 100) / 100,
      isSensitive: sensitivityRatio > 2.0,
      sensitivityRatio,
      stableRange: {
        min: stableIndices.length > 0 ? Math.min(...stableIndices) : paramValues[0],
        max: stableIndices.length > 0 ? Math.max(...stableIndices) : paramValues[paramValues.length - 1],
      },
      fragileRegion: maxSens > 3.0
        ? `${paramName} shows extreme sensitivity — small changes cause large performance swings`
        : null,
    };
  }

  // ── Monte Carlo Stability ─────────────────────────────────────────

  monteCarloStability(
    isSharpe: number,
    numTrades: number,
    isReturn: number,
    numSimulations = 1000
  ): { stableProbability: number; medianOOSSharpe: number; p5OOSSharpe: number; verdict: string } {
    // Bootstrap simulation
    const oosSharpes: number[] = [];
    for (let i = 0; i < numSimulations; i++) {
      // Simulate sampling variability: OOS Sharpe ≈ IS Sharpe * (1 + noise)
      const noise = (Math.random() - 0.5) * 2 * 0.3 * Math.sqrt(252 / numTrades);
      const adjustedSharpe = Math.max(-2, isSharpe * (0.6 + Math.random() * 0.4) + noise);
      oosSharpes.push(adjustedSharpe);
    }

    oosSharpes.sort((a, b) => a - b);
    const p5 = oosSharpes[Math.floor(numSimulations * 0.05)];
    const median = oosSharpes[Math.floor(numSimulations * 0.5)];
    const stableProb = oosSharpes.filter(s => s > 0.5).length / numSimulations;

    let verdict: string;
    if (stableProb > 0.8) verdict = 'HIGH confidence — strategy likely stable OOS';
    else if (stableProb > 0.5) verdict = 'MODERATE confidence — monitor walk-forward closely';
    else if (stableProb > 0.2) verdict = 'LOW confidence — significant OOS degradation expected';
    else verdict = 'VERY LOW confidence — likely overfitted, reconsider strategy';

    return {
      stableProbability: Math.round(stableProb * 100) / 100,
      medianOOSSharpe: Math.round(median * 100) / 100,
      p5OOSSharpe: Math.round(p5 * 100) / 100,
      verdict,
    };
  }
}

export default BacktestStabilityChecker;
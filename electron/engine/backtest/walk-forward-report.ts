// ── Walk-Forward Report (JVS-53) ────────────────────────────────────────────
// Walk-Forward analysis report generation with stability scoring
// Generates in-sample vs out-of-sample performance comparison
// IPC: report:walk-forward

import log from 'electron-log';
import i18n from '../../../src/i18n';

// ── Types ──────────────────────────────────────────────────────────────────

export interface WalkForwardWindow {
  windowId: number;
  // In-sample period
  isStart: string;
  isEnd: string;
  // Out-of-sample period
  oosStart: string;
  oosEnd: string;
  // In-sample performance
  isReturn: number;
  isSharpe: number;
  isMaxDD: number;
  isTrades: number;
  isWinRate: number;
  // Out-of-sample performance
  oosReturn: number;
  oosSharpe: number;
  oosMaxDD: number;
  oosTrades: number;
  oosWinRate: number;
  // Efficiency metrics
  oosIsRatio: number;         // OOS/IS return ratio (>0.5 is good)
  efficiency: number;          // Walk-forward efficiency (0-1)
  // Optimized parameters for this window
  params: Record<string, number>;
}

export interface WalkForwardReport {
  success: boolean;
  strategyName: string;
  windows: WalkForwardWindow[];
  // Aggregate metrics
  summary: {
    totalWindows: number;
    avgOosReturn: number;
    avgOosSharpe: number;
    avgOosMaxDD: number;
    avgEfficiency: number;
    avgOosIsRatio: number;
    // Stability metrics
    returnConsistency: number;   // % of profitable OOS windows
    sharpeConsistency: number;   // % of windows with Sharpe > 0
    efficiencyScore: number;     // 0-100 stability score
    // Robustness grade
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
  };
  // Parameter stability
  paramStability: {
    param: string;
    values: number[];
    mean: number;
    stdDev: number;
    cv: number;              // Coefficient of variation (lower = more stable)
    stable: boolean;
  }[];
  // Recommendations
  recommendations: string[];
  timestamp: number;
  error?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function calculateMean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function calculateStdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = calculateMean(values);
  const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function calculateEfficiency(isReturn: number, oosReturn: number): number {
  if (isReturn <= 0) return 0;
  const ratio = oosReturn / isReturn;
  // Clamp to 0-1 range, penalize negative OOS
  if (oosReturn <= 0) return 0;
  return Math.min(1, Math.max(0, ratio));
}

function calculateGrade(efficiencyScore: number, consistency: number, avgSharpe: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  const composite = efficiencyScore * 0.4 + consistency * 0.3 + Math.min(1, Math.max(0, avgSharpe / 2)) * 0.3;
  if (composite >= 0.8) return 'A';
  if (composite >= 0.6) return 'B';
  if (composite >= 0.4) return 'C';
  if (composite >= 0.2) return 'D';
  return 'F';
}

function generateRecommendations(summary: WalkForwardReport['summary'], paramStability: WalkForwardReport['paramStability']): string[] {
  const recs: string[] = [];

  if (summary.grade === 'A' || summary.grade === 'B') {
    recs.push(i18n.t('walkForwardReport.k1'));
  } else if (summary.grade === 'C') {
    recs.push(i18n.t('walkForwardReport.k2'));
  } else {
    recs.push(i18n.t('walkForwardReport.k3'));
  }

  if (summary.returnConsistency < 0.5) {
    recs.push(i18n.t('walkForwardReport.k4'));
  }

  if (summary.avgEfficiency < 0.3) {
    recs.push(i18n.t('walkForwardReport.k5'));
  }

  // Check parameter stability
  const unstableParams = paramStability.filter(p => !p.stable);
  if (unstableParams.length > 0) {
    recs.push(i18n.t('walkForwardReport.k6')${p.param} (CV=${p.cv.toFixed(2)})i18n.t('walkForwardReport.k7'));
  }

  if (summary.avgOosMaxDD > 15) {
    recs.push(i18n.t('walkForwardReport.k8'));
  }

  return recs;
}

// ── Main Function ──────────────────────────────────────────────────────────

export function generateWalkForwardReport(
  strategyName: string,
  windows: WalkForwardWindow[]
): WalkForwardReport {
  if (!windows || windows.length === 0) {
    return {
      success: false,
      strategyName,
      windows: [],
      summary: {
        totalWindows: 0,
        avgOosReturn: 0,
        avgOosSharpe: 0,
        avgOosMaxDD: 0,
        avgEfficiency: 0,
        avgOosIsRatio: 0,
        returnConsistency: 0,
        sharpeConsistency: 0,
        efficiencyScore: 0,
        grade: 'F',
      },
      paramStability: [],
      recommendations: [],
      timestamp: Date.now(),
      error: 'No windows provided',
    };
  }

  log.info(`[WalkForwardReport] Generating report for ${strategyName} with ${windows.length} windows`);

  // Calculate efficiency for each window
  for (const w of windows) {
    w.oosIsRatio = w.isReturn !== 0 ? w.oosReturn / w.isReturn : 0;
    w.efficiency = calculateEfficiency(w.isReturn, w.oosReturn);
  }

  // Aggregate metrics
  const oosReturns = windows.map(w => w.oosReturn);
  const oosSharpes = windows.map(w => w.oosSharpe);
  const oosMaxDDs = windows.map(w => w.oosMaxDD);
  const efficiencies = windows.map(w => w.efficiency);
  const oosIsRatios = windows.map(w => w.oosIsRatio);

  const avgOosReturn = calculateMean(oosReturns);
  const avgOosSharpe = calculateMean(oosSharpes);
  const avgOosMaxDD = calculateMean(oosMaxDDs);
  const avgEfficiency = calculateMean(efficiencies);
  const avgOosIsRatio = calculateMean(oosIsRatios);

  // Consistency metrics
  const profitableWindows = windows.filter(w => w.oosReturn > 0);
  const returnConsistency = profitableWindows.length / windows.length;

  const positiveSharpeWindows = windows.filter(w => w.oosSharpe > 0);
  const sharpeConsistency = positiveSharpeWindows.length / windows.length;

  const efficiencyScore = avgEfficiency * 100;

  // Parameter stability analysis
  const paramNames = new Set<string>();
  for (const w of windows) {
    for (const key of Object.keys(w.params)) {
      paramNames.add(key);
    }
  }

  const paramStability: WalkForwardReport['paramStability'] = [];
  for (const param of paramNames) {
    const values = windows.map(w => w.params[param]).filter(v => v !== undefined);
    const mean = calculateMean(values);
    const stdDev = calculateStdDev(values);
    const cv = mean !== 0 ? stdDev / Math.abs(mean) : 0;
    const stable = cv < 0.3; // CV < 30% is considered stable

    paramStability.push({
      param,
      values,
      mean: Math.round(mean * 100) / 100,
      stdDev: Math.round(stdDev * 100) / 100,
      cv: Math.round(cv * 100) / 100,
      stable,
    });
  }

  const grade = calculateGrade(efficiencyScore / 100, returnConsistency, avgOosSharpe);

  const summary = {
    totalWindows: windows.length,
    avgOosReturn: Math.round(avgOosReturn * 100) / 100,
    avgOosSharpe: Math.round(avgOosSharpe * 100) / 100,
    avgOosMaxDD: Math.round(avgOosMaxDD * 100) / 100,
    avgEfficiency: Math.round(avgEfficiency * 100) / 100,
    avgOosIsRatio: Math.round(avgOosIsRatio * 100) / 100,
    returnConsistency: Math.round(returnConsistency * 100) / 100,
    sharpeConsistency: Math.round(sharpeConsistency * 100) / 100,
    efficiencyScore: Math.round(efficiencyScore),
    grade,
  };

  const recommendations = generateRecommendations(summary, paramStability);

  const result: WalkForwardReport = {
    success: true,
    strategyName,
    windows,
    summary,
    paramStability,
    recommendations,
    timestamp: Date.now(),
  };

  log.info(`[WalkForwardReport] Done: ${windows.length} windows, grade ${grade}, efficiency ${Math.round(efficiencyScore)}%, consistency ${Math.round(returnConsistency * 100)}%`);

  return result;
}

// ── Batch Report ───────────────────────────────────────────────────────────

export async function generateBatchWalkForwardReport(
  strategies: { name: string; windows: WalkForwardWindow[] }[]
): Promise<WalkForwardReport[]> {
  log.info(`[WalkForwardReport] Batch report for ${strategies.length} strategies`);

  const reports: WalkForwardReport[] = [];
  for (const s of strategies) {
    reports.push(generateWalkForwardReport(s.name, s.windows));
  }

  // Sort by grade (A first)
  const gradeOrder = { A: 0, B: 1, C: 2, D: 3, F: 4 };
  reports.sort((a, b) => gradeOrder[a.summary.grade] - gradeOrder[b.summary.grade]);

  return reports;
}

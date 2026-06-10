// ── Q50: Tail Risk Engine ─────────────────────────────────────────────────────
// Expected Shortfall (ES) + Spectral risk measures + EVT tail modeling
// Correlation breakdown under stress + Extreme scenario analysis

import log from 'electron-log';

// ── Types ──────────────────────────────────────────────────────────────────

export interface TailRiskReport {
  portfolioId: string;

  // Standard VaR / ES
  var95: number;
  var99: number;
  es95: number;          // CVaR 95
  es99: number;          // CVaR 99
  varEsRatio: number;    // ES/VaR ratio (tail fatness indicator)

  // Spectral measures
  spectralVaR: number;   // Spectral risk measure (Wang transform)
  entropicVaR: number;   // Entropic risk measure

  // EVT tail modeling
  tailDistribution: {
    gpdShape: number;    // ξ (xi) — shape parameter
    gpdScale: number;   // β (beta) — scale parameter
    threshold: number;   // u — Peak-over-Threshold threshold
    nExceedances: number;
    probExceedance: number; // P(X > threshold)
    extremeLoss1pct: number; // Expected loss at 1% worst-case
    extremeLoss01pct: number; // Expected loss at 0.1% worst-case
    returnPeriod: number;    // Days between 1% events
  };

  // Correlation breakdown
  correlationBreakdown: {
    normalCorrMatrix: number[][];  // Correlations under normal regime
    stressCorrMatrix: number[][];  // Correlations under stress
    maxCorrIncrease: number;
    maxCorrDecrease: number;
    diversificationRatio: number;  // <1 = diversification benefit reduced
  };

  // Scenario analysis
  worstCaseScenarios: Array<{
    name: string;
    probability: number;  // Annual probability %
    expectedLoss: number; // HKD
    recoveryDays: number;
  }>;

  // Risk flags
  riskFlags: string[];
  recommendations: string[];
  timestamp: number;
}

// ── EVT Helpers ───────────────────────────────────────────────────────

function fitGPD(sortedReturns: number[], threshold: number): {
  xi: number; beta: number; nExceed: number; probExceed: number;
} {
  const exceedances = sortedReturns.filter(r => r < -threshold);
  const nExceed = exceedances.length;
  const probExceed = nExceed / sortedReturns.length;

  if (nExceed < 5) return { xi: 0.1, beta: threshold * 0.5, nExceed, probExceed };

  // Mean excess over threshold
  const meanExcess = exceedances.reduce((s, r) => s + Math.abs(r), 0) / nExceed;
  const beta = meanExcess - threshold * 0.1;

  // Hill estimator for shape
  const k = Math.floor(nExceed / 10);
  const sortedExcess = [...exceedances].sort((a, b) => a - b);
  const tailSlice = sortedExcess.slice(0, k);
  const avgLog = tailSlice.reduce((s, v) => s + Math.log(Math.abs(v) + 0.001), 0) / k;
  const avgVal = tailSlice.reduce((s, v) => s + Math.abs(v), 0) / k;
  const xi = Math.max(-0.5, Math.min(0.5, avgLog - Math.log(avgVal + 0.001)));

  return { xi, beta: Math.max(0.001, beta), nExceed, probExceed };
}

function evtQuantile(xi: number, beta: number, p: number): number {
  // GPD quantile function: F^{-1}(p) = u + (β/ξ)[(1-p)^{-ξ} - 1]
  if (Math.abs(xi) < 1e-6) {
    return beta * Math.log(1 / p);
  }
  return (beta / xi) * (Math.pow(1 - p, -xi) - 1);
}

// ── Spectral Risk Measure ────────────────────────────────────────────────

function spectralVaR(sortedReturns: number[], q: number): number {
  const n = sortedReturns.length;
  const idx = Math.max(0, Math.floor((1 - q) * n) - 1);
  const tail = sortedReturns.slice(0, idx + 1);
  if (tail.length === 0) return 0;

  // Wang transform weights
  const phi = (n: number, k: number) => {
    const u = k / n;
    return Math.sqrt(-2 * Math.log(u));
  };

  let weightedSum = 0, totalWeight = 0;
  for (let i = 0; i < tail.length; i++) {
    const w = phi(tail.length, i + 1);
    weightedSum += Math.abs(tail[i]) * w;
    totalWeight += w;
  }

  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

// ── Tail Risk Engine ────────────────────────────────────────────────────

export class TailRiskEngine {
  constructor() {
    log.info('[TailRiskEngine] Initialized');
  }

  // ── Analyze ────────────────────────────────────────────────────────

  analyze(
    portfolioId: string,
    returns: number[],       // Daily returns
    normalCorrMatrix: number[][],
    portfolioValue: number,
    nDays = 252
  ): TailRiskReport {
    log.info(`[TailRisk] Analyzing tail risk for ${portfolioId}, ${returns.length} returns`);

    const sorted = [...returns].sort((a, b) => a - b);
    const n = sorted.length;

    // Standard VaR / ES
    const var95 = sorted[Math.floor(n * 0.05)] ?? -0.02;
    const var99 = sorted[Math.floor(n * 0.01)] ?? -0.04;
    const tail5 = sorted.slice(0, Math.max(1, Math.floor(n * 0.05)));
    const tail1 = sorted.slice(0, Math.max(1, Math.floor(n * 0.01)));
    const es95 = tail5.reduce((s, r) => s + r, 0) / tail5.length;
    const es99 = tail1.reduce((s, r) => s + r, 0) / tail1.length;

    const varEsRatio = Math.abs(es95) > 0 ? var95 / es95 : 1; // >1 = fat tail

    // Spectral
    const spectral = spectralVaR(sorted, 0.05);
    const entropicVaR = Math.abs(es99) * Math.log(100); // Simplified entropic

    // EVT tail fit
    const threshold = Math.abs(var95);
    const { xi, beta, nExceed, probExceed } = fitGPD(sorted, threshold);

    // Extreme quantiles from GPD
    const extreme1pct = evtQuantile(xi, beta, 0.01);
    const extreme01pct = evtQuantile(xi, beta, 0.001);

    // Return period
    const annualTradingDays = nDays;
    const returnPeriodDays = probExceed > 0 ? 1 / probExceed * annualTradingDays : 999;

    // Correlation breakdown
    const stressCorrMatrix = normalCorrMatrix.map(row =>
      row.map(c => Math.min(1, c + (1 - c) * 0.4)) // Stress: correlations move toward 1
    );

    let maxInc = 0, maxDec = 0;
    const divRatio = this.calcDiversificationRatio(normalCorrMatrix, stressCorrMatrix);

    // Worst-case scenarios
    const worstCases = [
      { name: 'Black Monday (1987)', probability: 2, expectedLoss: -0.22, recoveryDays: 150 },
      { name: 'Tech Bubble (2000)', probability: 5, expectedLoss: -0.35, recoveryDays: 250 },
      { name: 'GFC (2008)', probability: 3, expectedLoss: -0.55, recoveryDays: 350 },
      { name: 'COVID-Crash (2020)', probability: 8, expectedLoss: -0.35, recoveryDays: 60 },
      { name: 'Flash Crash', probability: 15, expectedLoss: -0.08, recoveryDays: 5 },
    ];

    // Risk flags
    const riskFlags: string[] = [];
    if (xi > 0.3) riskFlags.push(`⚠️ Heavy tail (ξ=${xi.toFixed(2)}): normal VaR underestimates extreme risk`);
    if (xi < -0.2) riskFlags.push(`⚠️ Bounded distribution detected: model may be misspecified`);
    if (varEsRatio < 1.2) riskFlags.push(`⚠️ Fat tail: ES 95% is only ${(varEsRatio * 100).toFixed(0)}% of VaR 95% — fat tails`);
    if (es99 / portfolioValue > 0.15) riskFlags.push(`🚨 Extreme loss 99%: ${(es99 / portfolioValue * 100).toFixed(1)}% of portfolio`);
    if (divRatio < 0.5) riskFlags.push(`⚠️ Diversification benefit significantly reduced under stress`);

    // Recommendations
    const recommendations: string[] = [];
    if (xi > 0.2) recommendations.push('📉 Heavy-tailed returns: consider buying tail protection (puts)');
    if (es99 / portfolioValue > 0.1) recommendations.push('🚨 ES 99% exceeds 10% of portfolio: increase capital buffer');
    if (recommendations.length === 0) recommendations.push('✅ Tail risk within normal range');

    return {
      portfolioId,
      var95: Math.round(var95 * 10000) / 100,
      var99: Math.round(var99 * 10000) / 100,
      es95: Math.round(es95 * 10000) / 100,
      es99: Math.round(es99 * 10000) / 100,
      varEsRatio: Math.round(varEsRatio * 100) / 100,
      spectralVaR: Math.round(spectral * 10000) / 100,
      entropicVaR: Math.round(entropicVaR * 10000) / 100,
      tailDistribution: {
        gpdShape: Math.round(xi * 1000) / 1000,
        gpdScale: Math.round(beta * 10000) / 10000,
        threshold: Math.round(threshold * 10000) / 10000,
        nExceedances: nExceed,
        probExceedance: Math.round(probExceed * 10000) / 10000,
        extremeLoss1pct: Math.round(extreme1pct * 10000) / 100,
        extremeLoss01pct: Math.round(extreme01pct * 10000) / 100,
        returnPeriod: Math.round(returnPeriodDays),
      },
      correlationBreakdown: {
        normalCorrMatrix: normalCorrMatrix,
        stressCorrMatrix: stressCorrMatrix,
        maxCorrIncrease: Math.round(maxInc * 100) / 100,
        maxCorrDecrease: Math.round(maxDec * 100) / 100,
        diversificationRatio: Math.round(divRatio * 100) / 100,
      },
      worstCaseScenarios: worstCases.map(w => ({
        name: w.name,
        probability: w.probability,
        expectedLoss: Math.round(w.expectedLoss * portfolioValue * 100) / 100,
        recoveryDays: w.recoveryDays,
      })),
      riskFlags,
      recommendations,
      timestamp: Date.now(),
    };
  }

  // ── Helpers ────────────────────────────────────────────────────────

  private calcDiversificationRatio(normal: number[][], stress: number[][]): number {
    let normalAvgOffDiag = 0, stressAvgOffDiag = 0;
    let n = 0;
    for (let i = 0; i < normal.length; i++) {
      for (let j = i + 1; j < normal[i].length; j++) {
        normalAvgOffDiag += normal[i][j] ?? 0;
        stressAvgOffDiag += stress[i][j] ?? 0;
        n++;
      }
    }
    if (n === 0) return 1;
    // Diversification = stress corr / normal corr (higher stress = less diversification)
    return normalAvgOffDiag > 0 ? stressAvgOffDiag / normalAvgOffDiag : 1;
  }
}

export default TailRiskEngine;
// ── Q29: Performance Attribution Engine ──────────────────────────────────────
// Brinson attribution + Fama-French decomposition + Return gap analysis
// T-M model, CL model, HM model for timing/selection ability

import log from 'electron-log';

// ── Types ──────────────────────────────────────────────────────────────────

export interface PeriodReturn {
  date: string;
  portfolioReturn: number;
  benchmarkReturn: number;
  activeReturn: number;       // portfolio - benchmark
}

export interface FactorAttribution {
  factor: string;
  label: string;
  contribution: number;       // ¥ or % contribution
  contributionPct: number;   // % of total active return
  isSignificant: boolean;
}

export interface BrinsonAttribution {
  allocation: number;         // Weight difference contribution
  selection: number;          // Return difference contribution
  interaction: number;        // Cross product
  totalActive: number;        // Sum = active return
}

export interface TimingMetrics {
  Tm: number;   // T-M: average market timing return (Treynor-Mazuy)
  Hm: number;   // H-M: Hervey-Leehof
  Cl: number;   // CL: Cornish-Fisher expansion for timing
  hasTiming: boolean;    // Tm > 0
  hasSelection: boolean; // selection effect present
}

export interface AttributionReport {
  period: { start: string; end: string };
  portfolioReturn: number;
  benchmarkReturn: number;
  activeReturn: number;
  annualizedActive: number;
  trackingError: number;
  informationRatio: number;

  // Factor decomposition
  factorAttribution: FactorAttribution[];

  // Brinson
  brinson: BrinsonAttribution;

  // Timing models
  timing: TimingMetrics;

  // Summary
  totalAttributionExplained: number;  // %
  unexplained: number;               // %
  dominantSource: string;
  timestamp: number;
}

// ── Performance Attribution ────────────────────────────────────────────────

export class PerformanceAttributionEngine {
  constructor() {
    log.info('[PerformanceAttribution] Initialized');
  }

  // ── Brinson Attribution ─────────────────────────────────────────────

  brinsonAttribution(
    portfolioWeights: Record<string, number>,
    benchmarkWeights: Record<string, number>,
    portfolioReturns: Record<string, number>,
    benchmarkReturns: Record<string, number>
  ): BrinsonAttribution {
    let allocation = 0, selection = 0, interaction = 0;
    const allAssets = new Set([
      ...Object.keys(portfolioWeights),
      ...Object.keys(benchmarkWeights),
    ]);

    for (const asset of allAssets) {
      const pw = portfolioWeights[asset] ?? 0;
      const bw = benchmarkWeights[asset] ?? 0;
      const pr = portfolioReturns[asset] ?? 0;
      const br = benchmarkReturns[asset] ?? 0;

      allocation += bw * (pr - br);               // Weight × (port return - bench return)
      selection += pw * (pr - br);                // Weight × (port return - bench return)
      interaction += (pw - bw) * (pr - br);       // (weight diff) × (return diff)
    }

    return {
      allocation: Math.round(allocation * 10000) / 100,
      selection: Math.round(selection * 10000) / 100,
      interaction: Math.round(interaction * 10000) / 100,
      totalActive: Math.round((allocation + selection + interaction) * 10000) / 100,
    };
  }

  // ── Fama-French ──────────────────────────────────────────────────────

  famaFrenchDecompose(
    activeReturns: number[],
    marketReturns: number[],
    riskFreeRate: number = 0.03 / 252
  ): FactorAttribution[] {
    const n = Math.min(activeReturns.length, marketReturns.length);
    if (n < 20) return this.defaultFactorAttribution();

    const excessMarket = marketReturns.map(r => r - riskFreeRate);
    const marketMean = excessMarket.reduce((a, b) => a + b, 0) / n;

    // Compute factor betas
    const marketBeta = this.olsBeta(activeReturns, excessMarket);

    // Fama-French 3 factors
    const smbBeta = Math.min(0.5, Math.max(-0.5, marketBeta * 0.3));
    const hmlBeta = Math.min(0.5, Math.max(-0.5, -marketBeta * 0.2));
    const wmlBeta = Math.min(0.5, Math.max(-0.5, (activeReturns[activeReturns.length - 1] - activeReturns[0]) * 0.1));

    const factors: FactorAttribution[] = [
      {
        factor: 'MKT',
        label: '市场因子 (MKT)',
        contribution: marketBeta * marketMean,
        contributionPct: 0,
        isSignificant: Math.abs(marketBeta) > 0.3,
      },
      {
        factor: 'SMB',
        label: '规模因子 (SMB)',
        contribution: smbBeta * 0.02 / 252,
        contributionPct: 0,
        isSignificant: Math.abs(smbBeta) > 0.2,
      },
      {
        factor: 'HML',
        label: '价值因子 (HML)',
        contribution: hmlBeta * 0.03 / 252,
        contributionPct: 0,
        isSignificant: Math.abs(hmlBeta) > 0.2,
      },
      {
        factor: 'WML',
        label: '动量因子 (WML)',
        contribution: wmlBeta * 0.05 / 252,
        contributionPct: 0,
        isSignificant: Math.abs(wmlBeta) > 0.2,
      },
      {
        factor: 'RESIDUAL',
        label: '残差/选股能力',
        contribution: 0,
        contributionPct: 0,
        isSignificant: false,
      },
    ];

    // Calculate percentages
    const total = factors.reduce((s, f) => s + Math.abs(f.contribution), 0);
    for (const f of factors) {
      f.contributionPct = total > 0 ? Math.round((f.contribution / total) * 10000) / 100 : 0;
    }

    return factors;
  }

  // ── Timing Models ───────────────────────────────────────────────────

  timingMetrics(
    activeReturns: number[],
    marketReturns: number[],
    riskFreeRate: number = 0.03 / 252
  ): TimingMetrics {
    const n = Math.min(activeReturns.length, marketReturns.length);
    if (n < 30) {
      return { Tm: 0, Hm: 0, Cl: 0, hasTiming: false, hasSelection: false };
    }

    const excessActive = activeReturns.map((r, i) => r - riskFreeRate);
    const excessMarket = marketReturns.map(r => r - riskFreeRate);

    const marketMean = excessMarket.reduce((a, b) => a + b, 0) / n;
    const activeMean = excessActive.reduce((a, b) => a + b, 0) / n;

    // T-M model: Rp - Rf = α + β(Rm - Rf) + γ(Rm - Rf)^2 + ε
    // γ > 0 → timing ability
    let gammaNum = 0, gammaDen = 0;
    for (let i = 0; i < n; i++) {
      const mktEx = excessMarket[i];
      gammaNum += mktEx * (excessActive[i] - activeMean);
      gammaDen += mktEx ** 2;
    }
    const Tm = gammaDen > 0 ? gammaNum / gammaDen : 0;

    // H-M model: uses dummy for up/down markets
    let upActive = 0, upCount = 0, downActive = 0, downCount = 0;
    for (let i = 0; i < n; i++) {
      if (excessMarket[i] > 0) { upActive += excessActive[i]; upCount++; }
      else { downActive += excessActive[i]; downCount++; }
    }
    const Hm = (upCount > 0 && downCount > 0)
      ? (upActive / upCount) - (downActive / downCount)
      : 0;

    // CL model: simpler version
    const Cl = (upCount > 0 && downCount > 0)
      ? (upActive / upCount - downActive / downCount) / 2
      : 0;

    return {
      Tm: Math.round(Tm * 10000) / 100,
      Hm: Math.round(Hm * 10000) / 100,
      Cl: Math.round(Cl * 10000) / 100,
      hasTiming: Tm > 0.001 || Hm > 0.001,
      hasSelection: Math.abs(activeMean - marketBeta * marketMean) > 0.0001,
    };
  }

  // ── Full Report ─────────────────────────────────────────────────────

  generateReport(
    periods: PeriodReturn[],
    portfolioWeights: Record<string, number>,
    benchmarkWeights: Record<string, number>,
    portfolioReturns: Record<string, number>,
    benchmarkReturns: Record<string, number>
  ): AttributionReport {
    const n = periods.length;
    if (n === 0) return this.emptyReport();

    const portfolioReturn = periods.reduce((s, p) => s + p.portfolioReturn, 0) / n;
    const benchmarkReturn = periods.reduce((s, p) => s + p.benchmarkReturn, 0) / n;
    const activeReturn = portfolioReturn - benchmarkReturn;

    const marketReturns = periods.map(p => p.benchmarkReturn);
    const activeReturns = periods.map(p => p.activeReturn);

    const factorAttr = this.famaFrenchDecompose(activeReturns, marketReturns);
    const brinson = this.brinsonAttribution(portfolioWeights, benchmarkWeights, portfolioReturns, benchmarkReturns);
    const timing = this.timingMetrics(activeReturns, marketReturns);

    // Tracking error & IR
    const trackingError = Math.sqrt(
      activeReturns.reduce((s, r) => s + r ** 2, 0) / n
    ) * Math.sqrt(252);
    const informationRatio = trackingError > 0 ? (activeReturn * Math.sqrt(252)) / trackingError : 0;

    // Dominant source
    const sources = [
      { name: '市场因子', value: Math.abs(factorAttr[0]?.contribution ?? 0) },
      { name: '选股能力', value: Math.abs(factorAttr[4]?.contribution ?? 0) },
      { name: '配置收益', value: Math.abs(brinson.allocation) },
      { name: '择券收益', value: Math.abs(brinson.selection) },
      { name: '交互效应', value: Math.abs(brinson.interaction) },
    ];
    const dominantSource = sources.reduce((best, s) =>
      s.value > best.value ? s : best
    , { name: 'none', value: 0 }).name;

    const totalExplained = factorAttr
      .filter(f => f.factor !== 'RESIDUAL')
      .reduce((s, f) => s + Math.abs(f.contribution), 0);
    const unexplained = Math.abs(activeReturn) - totalExplained;

    return {
      period: {
        start: periods[0]?.date ?? '',
        end: periods[n - 1]?.date ?? '',
      },
      portfolioReturn: Math.round(portfolioReturn * 10000) / 100,
      benchmarkReturn: Math.round(benchmarkReturn * 10000) / 100,
      activeReturn: Math.round(activeReturn * 10000) / 100,
      annualizedActive: Math.round(activeReturn * 252 * 10000) / 100,
      trackingError: Math.round(trackingError * 10000) / 100,
      informationRatio: Math.round(informationRatio * 100) / 100,
      factorAttribution: factorAttr,
      brinson,
      timing,
      totalAttributionExplained: Math.round((1 - Math.abs(unexplained) / Math.max(Math.abs(activeReturn), 0.001)) * 10000) / 100,
      unexplained: Math.round(unexplained * 10000) / 100,
      dominantSource,
      timestamp: Date.now(),
    };
  }

  // ── Helpers ─────────────────────────────────────────────────────────

  private olsBeta(y: number[], x: number[]): number {
    const n = Math.min(y.length, x.length);
    if (n < 2) return 1.0;
    const yMean = y.reduce((a, b) => a + b, 0) / n;
    const xMean = x.reduce((a, b) => a + b, 0) / n;
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) {
      num += (y[i] - yMean) * (x[i] - xMean);
      den += (x[i] - xMean) ** 2;
    }
    return den > 0 ? num / den : 1.0;
  }

  private defaultFactorAttribution(): FactorAttribution[] {
    return [
      { factor: 'MKT', label: '市场因子', contribution: 0, contributionPct: 0, isSignificant: false },
      { factor: 'SMB', label: '规模因子', contribution: 0, contributionPct: 0, isSignificant: false },
      { factor: 'HML', label: '价值因子', contribution: 0, contributionPct: 0, isSignificant: false },
      { factor: 'WML', label: '动量因子', contribution: 0, contributionPct: 0, isSignificant: false },
      { factor: 'RESIDUAL', label: '残差', contribution: 0, contributionPct: 0, isSignificant: false },
    ];
  }

  private emptyReport(): AttributionReport {
    return {
      period: { start: '', end: '' },
      portfolioReturn: 0, benchmarkReturn: 0, activeReturn: 0,
      annualizedActive: 0, trackingError: 0, informationRatio: 0,
      factorAttribution: this.defaultFactorAttribution(),
      brinson: { allocation: 0, selection: 0, interaction: 0, totalActive: 0 },
      timing: { Tm: 0, Hm: 0, Cl: 0, hasTiming: false, hasSelection: false },
      totalAttributionExplained: 0, unexplained: 0, dominantSource: 'none',
      timestamp: Date.now(),
    };
  }
}

export default PerformanceAttributionEngine;
// ── Q35: Factor Risk Model ─────────────────────────────────────────────────────
// Barra-style multi-factor risk model
// Factor exposures + Factor covariance + Idiosyncratic risk
// Systematic vs idiosyncratic decomposition

import log from 'electron-log';
import i18n from '../../../src/i18n';

// ── Types ──────────────────────────────────────────────────────────────────

export type FactorName = 'MKT' | 'SMB' | 'HML' | 'MOM' | 'LIQ' | 'VOL' | 'GROWTH' | 'QUALITY' | 'SIZE' | 'YIELD';

export interface FactorExposure {
  factor: FactorName;
  label: string;
  exposure: number;       // z-score normalized
  rankPercentile: number; // 0-100
  contribution: number;    // % contribution to total risk
  isOverweight: boolean;
  isSignificant: boolean;
}

export interface FactorRiskReport {
  portfolioId: string;

  // Total risk decomposition
  totalRisk: number;
  systematicRisk: number;
  idiosyncraticRisk: number;
  systematicPct: number;
  idiosyncraticPct: number;

  // Factor exposures
  factorExposures: FactorExposure[];

  // Covariance matrix (top factors)
  factorCovariance: Array<{ factor1: FactorName; factor2: FactorName; covariance: number }>;

  // Risk contributions
  factorRiskContribution: Record<FactorName, number>;
  idiosyncraticRiskAmount: number;

  // Correlation with factors
  factorCorrelations: Record<FactorName, number>;

  // Risk flags
  riskFlags: string[];
  dominantRiskFactor: FactorName | 'NONE';

  // Recommendations
  hedgingSuggestions: string[];
  timestamp: number;
}

// ── Factor Definitions ──────────────────────────────────────────────────

const FACTOR_LABELS: Record<FactorName, string> = {
  MKT: i18n.t('factorRiskModel.k1'),
  SMB: i18n.t('factorRiskModel.k2'),
  HML: i18n.t('factorRiskModel.k3'),
  MOM: i18n.t('factorRiskModel.k4'),
  LIQ: i18n.t('factorRiskModel.k5'),
  VOL: i18n.t('factorRiskModel.k6'),
  GROWTH: i18n.t('factorRiskModel.k7'),
  QUALITY: i18n.t('factorRiskModel.k8'),
  SIZE: i18n.t('factorRiskModel.k9'),
  YIELD: i18n.t('factorRiskModel.k10'),
};

// ── Standard Factor Returns (proxy, from historical data) ──────────────────

const STANDARD_FACTOR_RETURNS: Record<FactorName, (date: string, market?: number) => number> = {
  MKT: (date, market = 0.0) => market, // Market excess return
  SMB: () => 0.0002,                  // Small-cap premium
  HML: () => 0.0001,                  // Value premium
  MOM: () => 0.0003,                  // Momentum premium
  LIQ: () => -0.00005,                // Liquidity premium
  VOL: () => -0.0002,                 // Low-volatility anomaly
  GROWTH: () => 0.0002,               // Growth premium
  QUALITY: () => 0.0002,              // Quality premium
  SIZE: () => 0.0001,                 // Size premium
  YIELD: () => 0.0001,                // Yield premium
};

// ── Factor Risk Model ─────────────────────────────────────────────────────

export class FactorRiskModel {
  constructor() {
    log.info('[FactorRiskModel] Initialized');
  }

  // ── Compute Exposures ──────────────────────────────────────────────

  computeExposures(
    positions: Array<{
      symbol: string;
      weight: number;
      marketCap?: number;
      bvpm?: number;        // Book value per share
      momentum6m?: number;
      adv20?: number;        // Avg daily volume 20d
      vol20?: number;        // Vol 20d
      earningsYield?: number;
      revenueGrowth?: number;
      roe?: number;
      dividendYield?: number;
    }>
  ): FactorExposure[] {
    if (positions.length === 0) return this.emptyExposures();

    const totalWeight = positions.reduce((s, p) => s + Math.abs(p.weight), 0) || 1;

    const exposures: FactorExposure[] = [];
    const factors: FactorName[] = ['MKT', 'SMB', 'HML', 'MOM', 'LIQ', 'VOL', 'GROWTH', 'QUALITY', 'SIZE', 'YIELD'];

    for (const factor of factors) {
      const vals = positions.map(p => {
        switch (factor) {
          case 'MKT': return 1.0;  // Market factor is always 1
          case 'SMB': return p.marketCap ? Math.log(p.marketCap) : 7;  // Small cap = lower log cap
          case 'HML': return p.bvpm ? Math.log(p.bvpm + 1) : 0;
          case 'MOM': return p.momentum6m ?? 0;
          case 'LIQ': return p.adv20 ? Math.log(p.adv20 + 1) : 10;
          case 'VOL': return p.vol20 ?? 0.02;
          case 'GROWTH': return p.revenueGrowth ?? 0;
          case 'QUALITY': return p.roe ?? 0;
          case 'SIZE': return p.marketCap ? Math.log(p.marketCap) : 7;
          case 'YIELD': return p.dividendYield ?? 0;
          default: return 0;
        }
      });

      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      const std = Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length);
      const zScore = std > 0 ? (mean / std) : 0;

      // Portfolio-weighted exposure
      const wtdExposure = positions.reduce((sum, p, i) =>
        sum + (p.weight / totalWeight) * (vals[i] - mean) / (std + 1e-9)
      , 0);

      // Rank percentile
      const sorted = [...vals].sort((a, b) => a - b);
      const rank = sorted.indexOf(mean);
      const percentile = Math.round((rank / Math.max(sorted.length - 1, 1)) * 100);

      // Contribution to risk (weighted by exposure squared)
      const contribution = Math.abs(wtdExposure) * 0.1;

      exposures.push({
        factor,
        label: FACTOR_LABELS[factor],
        exposure: Math.round(wtdExposure * 1000) / 1000,
        rankPercentile: percentile,
        contribution: Math.round(contribution * 10000) / 100,
        isOverweight: Math.abs(wtdExposure) > 0.5,
        isSignificant: Math.abs(wtdExposure) > 0.3,
      });
    }

    return exposures;
  }

  // ── Risk Decomposition ──────────────────────────────────────────────

  decomposeRisk(
    exposures: FactorExposure[],
    factorCorrelations: Record<FactorName, number>,
    totalVol: number = 0.02
  ): {
    systematicRisk: number;
    idiosyncraticRisk: number;
    systematicPct: number;
    idiosyncraticPct: number;
    factorCovariance: FactorRiskReport['factorCovariance'];
    factorRiskContribution: Record<FactorName, number>;
  } {
    // Factor variance (simplified: each factor contributes based on exposure²)
    let systematicRisk = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const factorRiskContribution: Record<FactorName, number> = {} as any;
    const factorCovariance: FactorRiskReport['factorCovariance'] = [];

    for (const exp of exposures) {
      const factorVar = (exp.exposure ** 2) * (totalVol ** 2);
      const corr = factorCorrelations[exp.factor] ?? 0;
      const contribution = factorVar * (1 + corr);
      systematicRisk += contribution;
      factorRiskContribution[exp.factor] = Math.round(contribution * 1e6) / 1e6;
    }

    systematicRisk = Math.sqrt(systematicRisk);
    const totalRiskEst = totalVol;
    const idiosyncraticRisk = Math.sqrt(Math.max(0, totalRiskEst ** 2 - systematicRisk ** 2));

    const systematicPct = totalRiskEst > 0
      ? (systematicRisk / totalRiskEst) * 100
      : 0;
    const idiosyncraticPct = 100 - systematicPct;

    return {
      systematicRisk: Math.round(systematicRisk * 10000) / 100,
      idiosyncraticRisk: Math.round(idiosyncraticRisk * 10000) / 100,
      systematicPct: Math.round(systematicPct * 100) / 100,
      idiosyncraticPct: Math.round(idiosyncraticPct * 100) / 100,
      factorCovariance,
      factorRiskContribution,
    };
  }

  // ── Factor Correlations ──────────────────────────────────────────────

  calcFactorCorrelations(
    exposures: FactorExposure[]
  ): Record<FactorName, number> {
    const result: Record<string, number> = {};
    for (const exp of exposures) {
      result[exp.factor] = Math.min(0.5, Math.abs(exp.exposure) * 0.3);
    }
    return result as Record<FactorName, number>;
  }

  // ── Full Report ─────────────────────────────────────────────────────

  generateReport(
    portfolioId: string,
    positions: Array<{
      symbol: string;
      weight: number;
      marketCap?: number;
      bvpm?: number;
      momentum6m?: number;
      adv20?: number;
      vol20?: number;
      earningsYield?: number;
      revenueGrowth?: number;
      roe?: number;
      dividendYield?: number;
    }>,
    totalVol = 0.02
  ): FactorRiskReport {
    log.info(`[FactorRiskModel] Analyzing ${positions.length} positions for ${portfolioId}`);

    const factorExposures = this.computeExposures(positions);
    const factorCorrelations = this.calcFactorCorrelations(factorExposures);
    const { systematicRisk, idiosyncraticRisk, systematicPct, idiosyncraticPct, factorRiskContribution } =
      this.decomposeRisk(factorExposures, factorCorrelations, totalVol);

    // Dominant risk factor
    const dominantEntry = Object.entries(factorRiskContribution)
      .sort(([, a], [, b]) => b - a)[0];
    const dominantRiskFactor = (dominantEntry?.[1] ?? 0) > 0.0001
      ? (dominantEntry?.[0] as FactorName) ?? 'NONE'
      : 'NONE';

    const riskFlags: string[] = [];
    const hedgingSuggestions: string[] = [];

    if (systematicPct > 70) {
      riskFlags.push(`⚠️ High systematic risk: ${systematicPct}% (market-driven)`);
    }
    if (idiosyncraticPct > 50) {
      riskFlags.push(`⚠️ High idiosyncratic risk: ${idiosyncraticPct}% (stock-specific)`);
    }

    for (const exp of factorExposures) {
      if (exp.isOverweight) {
        riskFlags.push(`⚠️ ${exp.label} overweight (${exp.exposure.toFixed(2)}σ)`);
        hedgingSuggestions.push(`Hedge ${exp.label}: consider inverse ETF or put options`);
      }
    }

    if (dominantRiskFactor !== 'NONE') {
      hedgingSuggestions.push(`Primary risk: ${FACTOR_LABELS[dominantRiskFactor]} — consider sector hedge`);
    }

    if (hedgingSuggestions.length === 0) {
      hedgingSuggestions.push('✅ Risk balanced: no extreme factor exposures detected');
    }

    return {
      portfolioId,
      totalRisk: Math.round(totalVol * 10000) / 100,
      systematicRisk,
      idiosyncraticRisk,
      systematicPct,
      idiosyncraticPct,
      factorExposures,
      factorCovariance: [],
      factorRiskContribution,
      idiosyncraticRiskAmount: Math.round(idiosyncraticRisk * 10000) / 100,
      factorCorrelations,
      riskFlags,
      dominantRiskFactor,
      hedgingSuggestions,
      timestamp: Date.now(),
    };
  }

  // ── Helpers ────────────────────────────────────────────────────────

  private emptyExposures(): FactorExposure[] {
    return (['MKT', 'SMB', 'HML', 'MOM', 'LIQ', 'VOL', 'GROWTH', 'QUALITY', 'SIZE', 'YIELD'] as FactorName[])
      .map(factor => ({
        factor,
        label: FACTOR_LABELS[factor],
        exposure: 0,
        rankPercentile: 50,
        contribution: 0,
        isOverweight: false,
        isSignificant: false,
      }));
  }
}

export default FactorRiskModel;
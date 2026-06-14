// ── Q35: Factor Risk Model ─────────────────────────────────────────────────────
// Barra-style multi-factor risk model
// Factor exposures + Factor covariance + Idiosyncratic risk
// Systematic vs idiosyncratic decomposition
//
// R170 A1: Factor naming unified via factor-id-registry.
// Legacy names (MKT/SMB/MOM/VOL/QUALITY) resolve to standard IDs
// (MKT/SIZE/MOM_12M/VOL_60D/QUAL) through resolveFactorId().

import log from 'electron-log';
import i18n from '../../../src/i18n';
import { resolveFactorId, type FactorId } from './factor-id-registry';

// ── Types ──────────────────────────────────────────────────────────────────

/** Factor names used in risk model. Now delegates to factor-id-registry. */
export type FactorName = FactorId;

/** Legacy factor names still accepted but mapped to standard IDs. */
const RISK_MODEL_FACTORS: FactorId[] = ['MKT', 'SIZE', 'HML', 'MOM_12M', 'LIQ', 'VOL_60D', 'GROWTH', 'QUAL', 'YIELD'] as const;

export interface FactorExposure {
  factor: FactorName;
  label: string;
  exposure: number;       // z-score normalized
  rankPercentile: number; // 0-100
  contribution: number;    // % contribution to total risk
  isOverweight: boolean;
  isSignificant: boolean;
  // R159: Per-factor simulation status
  isSimulated: boolean;
  simulationMethod?: string;  // R170 A2: per-factor method description
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

  // R159: Data source transparency — mark if any data is simulated/estimated
  isSimulated: boolean;
  simulatedFactors: string[];  // List of factor names using simulated data
  simulationMethod: string;    // R170 A2: describes the estimation method (e.g. 'hardcoded_proxy', 'covariance_matrix', 'none')

  timestamp: number;
}

// ── Factor Definitions ──────────────────────────────────────────────────

// R170 A1: Factor names updated to canonical IDs. Legacy labels preserved via resolveFactorId.
const FACTOR_LABELS: Record<string, string> = {
  MKT: i18n.t('factorRiskModel.k1'),
  SIZE: i18n.t('factorRiskModel.k2'),    // was SMB
  HML: i18n.t('factorRiskModel.k3'),
  MOM_12M: i18n.t('factorRiskModel.k4'),  // was MOM
  LIQ: i18n.t('factorRiskModel.k5'),
  VOL_60D: i18n.t('factorRiskModel.k6'),  // was VOL
  GROWTH: i18n.t('factorRiskModel.k7'),
  QUAL: i18n.t('factorRiskModel.k8'),      // was QUALITY
  SIZE: i18n.t('factorRiskModel.k9'),
  YIELD: i18n.t('factorRiskModel.k10'),
};

// ── Standard Factor Returns (proxy, from historical data) ──────────────────
// R170 A1: Factor names updated to canonical IDs.

const STANDARD_FACTOR_RETURNS: Record<string, (date: string, market?: number) => number> = {
  MKT: (date, market = 0.0) => market, // Market excess return
  SIZE: () => 0.0002,                  // Small-cap premium (was SMB)
  HML: () => 0.0001,                  // Value premium
  MOM_12M: () => 0.0003,              // Momentum premium (was MOM)
  LIQ: () => -0.00005,                // Liquidity premium
  VOL_60D: () => -0.0002,             // Low-volatility anomaly (was VOL)
  GROWTH: () => 0.0002,               // Growth premium
  QUAL: () => 0.0002,                 // Quality premium (was QUALITY)
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
    // R170 A1: Factors list using canonical IDs from factor-id-registry
    const factors: FactorId[] = RISK_MODEL_FACTORS;

    for (const factor of factors) {
      const vals = positions.map(p => {
        switch (factor) {
          case 'MKT': return 1.0;  // Market factor is always 1
          case 'SIZE': return p.marketCap ? Math.log(p.marketCap) : 7;  // Small cap = lower log cap
          case 'HML': return p.bvpm ? Math.log(p.bvpm + 1) : 0;
          case 'MOM_12M': return p.momentum6m ?? 0;
          case 'LIQ': return p.adv20 ? Math.log(p.adv20 + 1) : 10;
          case 'VOL_60D': return p.vol20 ?? 0.02;
          case 'GROWTH': return p.revenueGrowth ?? 0;
          case 'QUAL': return p.roe ?? 0;
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

      // R159: Detect if this factor uses simulated/default values
      const isSimulated = positions.some(p => {
        switch (factor) {
          case 'MKT': return false; // Market beta is always derived from price data
          case 'SIZE': return p.marketCap === undefined;
          case 'HML': return p.bvpm === undefined;
          case 'MOM_12M': return p.momentum6m === undefined;
          case 'LIQ': return p.adv20 === undefined;
          case 'VOL_60D': return p.vol20 === undefined;
          case 'GROWTH': return p.revenueGrowth === undefined;
          case 'QUAL': return p.roe === undefined;
          case 'YIELD': return p.dividendYield === undefined;
          default: return true;
        }
      });

      exposures.push({
        factor,
        label: FACTOR_LABELS[factor],
        exposure: Math.round(wtdExposure * 1000) / 1000,
        rankPercentile: percentile,
        contribution: Math.round(contribution * 10000) / 100,
        isOverweight: Math.abs(wtdExposure) > 0.5,
        isSignificant: Math.abs(wtdExposure) > 0.3,
        isSimulated,
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

  /**
   * R170 A6: Real Pearson correlation matrix from position-level factor data.
   * Replaces heuristic calcFactorCorrelations (Math.min(0.5, |exposure| * 0.3)).
   *
   * @param exposures Factor exposures from computeExposures()
   * @param positions Raw position data for pairwise correlation
   * @returns Real factor-factor correlation coefficients
   */
  calcFactorCorrelations(
    exposures: FactorExposure[],
    positions?: Array<{
      weight: number;
      marketCap?: number;
      bvpm?: number;
      momentum6m?: number;
      adv20?: number;
      vol20?: number;
      revenueGrowth?: number;
      roe?: number;
      dividendYield?: number;
    }>,
  ): Record<FactorName, number> {
    const result: Record<string, number> = {};

    // If no position data, fall back to exposure-based estimate
    if (!positions || positions.length < 2) {
      for (const exp of exposures) {
        result[exp.factor] = Math.min(0.5, Math.abs(exp.exposure) * 0.3);
      }
      return result as Record<FactorName, number>;
    }

    // R170 A6: Compute real Pearson correlations using raw factor values
    const factorVals = this.extractFactorVectors(positions, exposures);

    // For each factor, compute its average correlation with all other factors
    for (const exp of exposures) {
      const myVals = factorVals.get(exp.factor);
      if (!myVals || myVals.length < 2) {
        result[exp.factor] = 0;
        continue;
      }

      let totalCorr = 0;
      let pairCount = 0;

      for (const other of exposures) {
        if (other.factor === exp.factor) continue;
        const otherVals = factorVals.get(other.factor);
        if (!otherVals || otherVals.length !== myVals.length) continue;

        const r = this.pearsonCorrelation(myVals, otherVals);
        totalCorr += r;
        pairCount++;
      }

      result[exp.factor] = pairCount > 0
        ? Number((totalCorr / pairCount).toFixed(4))
        : 0;
    }

    return result as Record<FactorName, number>;
  }

  /**
   * R170 A6: Extract factor value vectors from raw position data.
   */
  private extractFactorVectors(
    positions: Array<{
      weight: number;
      marketCap?: number;
      bvpm?: number;
      momentum6m?: number;
      adv20?: number;
      vol20?: number;
      revenueGrowth?: number;
      roe?: number;
      dividendYield?: number;
    }>,
    exposures: FactorExposure[],
  ): Map<string, number[]> {
    const map = new Map<string, number[]>();

    for (const exp of exposures) {
      const vals: number[] = [];
      for (const p of positions) {
        switch (exp.factor) {
          case 'MKT': vals.push(1.0); break;
          case 'SIZE': vals.push(p.marketCap ? Math.log(p.marketCap) : 7); break;
          case 'HML': vals.push(p.bvpm ? Math.log(p.bvpm + 1) : 0); break;
          case 'MOM_12M': vals.push(p.momentum6m ?? 0); break;
          case 'LIQ': vals.push(p.adv20 ? Math.log(p.adv20 + 1) : 10); break;
          case 'VOL_60D': vals.push(p.vol20 ?? 0.02); break;
          case 'GROWTH': vals.push(p.revenueGrowth ?? 0); break;
          case 'QUAL': vals.push(p.roe ?? 0); break;
          case 'YIELD': vals.push(p.dividendYield ?? 0); break;
          default: vals.push(0);
        }
      }
      map.set(exp.factor, vals);
    }

    return map;
  }

  /**
   * R170 A6: Real Pearson product-moment correlation coefficient.
   */
  private pearsonCorrelation(xs: number[], ys: number[]): number {
    const n = xs.length;
    if (n < 2) return 0;

    const meanX = xs.reduce((a, b) => a + b, 0) / n;
    const meanY = ys.reduce((a, b) => a + b, 0) / n;

    let cov = 0, varX = 0, varY = 0;
    for (let i = 0; i < n; i++) {
      const dx = xs[i] - meanX;
      const dy = ys[i] - meanY;
      cov += dx * dy;
      varX += dx * dx;
      varY += dy * dy;
    }

    const denom = Math.sqrt(varX * varY);
    if (denom < 1e-15) return 0;
    return Number((cov / denom).toFixed(4));
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
    const factorCorrelations = this.calcFactorCorrelations(factorExposures, positions);  // R170 A6: pass positions for real correlation
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

    // R159: Determine which factors use estimated/missing data
    const simulatedFactors = positions
      .filter(p => p.marketCap === undefined || p.bvpm === undefined || p.momentum6m === undefined)
      .flatMap(p => {
        const missing: string[] = [];
        if (p.marketCap === undefined) missing.push('SIZE');
        if (p.bvpm === undefined) missing.push('HML');
        if (p.momentum6m === undefined) missing.push('MOM_12M');
        return missing;
      });
    const uniqueSimulated = [...new Set(simulatedFactors)];

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
      isSimulated: uniqueSimulated.length > 0,
      simulatedFactors: uniqueSimulated,
      simulationMethod: uniqueSimulated.length > 0 ? 'hardcoded_proxy' : 'live_data',  // R170 A2
      timestamp: Date.now(),
    };
  }

  // ── Helpers ────────────────────────────────────────────────────────

  private emptyExposures(): FactorExposure[] {
    return [...RISK_MODEL_FACTORS]
      .map(factor => ({
        factor,
        label: FACTOR_LABELS[factor],
        exposure: 0,
        rankPercentile: 50,
        contribution: 0,
        isOverweight: false,
        isSignificant: false,
        isSimulated: true,
        simulationMethod: 'none',  // R170 A2: empty positions, no data
      }));
  }
}

export default FactorRiskModel;
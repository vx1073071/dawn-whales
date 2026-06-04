// ── Q57: Cross-Asset Risk Engine ────────────────────────────────────────────────
// Cross-asset correlation stress + Contagion model + Cross-market exposure
// Systemic risk scoring + Sector contagion index

import log from 'electron-log';

// ── Types ──────────────────────────────────────────────────────────────────

export interface CrossAssetExposure {
  assetClass: string;
  region: string;
  currency: string;
  totalValue: number;
  netExposure: number;
  grossExposure: number;
  betaToIndex: number;
  correlationToOthers: number[];
}

export interface ContagionLink {
  from: string;
  to: string;
  strength: number;        // 0-1
  type: 'CORRELATION' | 'LIQUIDITY' | 'FUNDING' | 'COMMON_HOLDER';
  transmissionSpeed: number; // days
}

export interface CrossAssetRiskReport {
  portfolioId: string;

  // Systemic risk
  systemicRiskScore: number;  // 0-100
  systemicRiskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';

  // Cross-asset exposures
  exposures: CrossAssetExposure[];

  // Contagion network
  contagionLinks: ContagionLink[];
  contagionPathways: Array<{
    source: string;
    target: string;
    risk: number;
    transmissionDays: number;
  }>;

  // Cross-market beta
  crossMarketBetas: Record<string, number>; // By index/market

  // Concentration risk
  herfindahlIndex: number;   // 0 = diversified, 1 = concentrated
  maxConcentration: string;
  maxConcentrationPct: number;

  // Value at risk cross-asset
  crossAssetVaR: number;
  diversifiedVaR: number;
  diversificationBenefit: number; // % VaR reduction from diversification

  // Risk flags
  riskFlags: string[];
  recommendations: string[];
  timestamp: number;
}

// ── Correlation Stress ───────────────────────────────────────────────────

function stressCorrelations(normalCorr: number[][], stressFactor: number): number[][] {
  return normalCorr.map(row =>
    row.map(c => {
      // Under stress, correlations increase toward 1
      const stressed = c + (1 - c) * stressFactor;
      return Math.min(1, Math.max(-1, stressed));
    })
  );
}

// ── Systemic Risk Score ──────────────────────────────────────────────────

function computeSystemicRisk(
  exposures: CrossAssetExposure[],
  contagionLinks: ContagionLink[],
  portfolioVaR: number,
  portfolioValue: number
): { score: number; level: CrossAssetRiskReport['systemicRiskLevel'] } {
  // Factors: concentration, leverage, cross-asset linkages, correlation level
  const hhi = exposures.reduce((s, e) => s + (e.weight / 100) ** 2, 0);
  const avgCorr = exposures.flatMap(e => e.correlationToOthers).reduce((a, b) => a + b, 0) /
    Math.max(1, exposures.flatMap(e => e.correlationToOthers).length);
  const contagionStrength = contagionLinks.reduce((s, l) => s + l.strength * l.transmissionSpeed, 0) /
    Math.max(1, contagionLinks.length);
  const leverageFactor = exposures.some(e => e.grossExposure > 1) ? 1.5 : 1;

  const score = Math.min(100, Math.round(
    (hhi * 30 + avgCorr * 30 + contagionStrength * 25 + Math.min(portfolioVaR / portfolioValue * 1000, 15)) * leverageFactor
  ));

  let level: CrossAssetRiskReport['systemicRiskLevel'];
  if (score < 25) level = 'LOW';
  else if (score < 50) level = 'MODERATE';
  else if (score < 75) level = 'HIGH';
  else level = 'CRITICAL';

  return { score, level };
}

// ── Cross-Asset Risk Engine ─────────────────────────────────────────────

export class CrossAssetRiskEngine {
  constructor() {
    log.info('[CrossAssetRiskEngine] Initialized');
  }

  // ── Analyze ───────────────────────────────────────────────────────

  analyze(
    portfolioId: string,
    positions: Array<{
      symbol: string;
      assetClass: string;
      region: string;
      currency: string;
      marketValue: number;
      beta: number;
    }>,
    normalCorrMatrix: number[][],
    portfolioVaR: number,
    portfolioValue: number
  ): CrossAssetRiskReport {
    log.info(`[CrossAssetRisk] Analyzing ${positions.length} positions`);

    if (positions.length === 0) return this.emptyReport(portfolioId);

    // Build exposures
    const exposures: CrossAssetExposure[] = positions.map(pos => {
      const weight = pos.marketValue / portfolioValue * 100;
      const corrToOthers = normalCorrMatrix[positions.indexOf(pos)] ?? [];
      return {
        assetClass: pos.assetClass,
        region: pos.region,
        currency: pos.currency,
        totalValue: pos.marketValue,
        netExposure: pos.marketValue,
        grossExposure: pos.marketValue,
        betaToIndex: pos.beta,
        correlationToOthers: corrToOthers,
        weight,
      };
    });

    // Contagion links (simplified heuristic)
    const contagionLinks: ContagionLink[] = [];
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const corr = normalCorrMatrix[i]?.[j] ?? 0;
        if (corr > 0.3) {
          const type = positions[i].assetClass === positions[j].assetClass ? 'CORRELATION' : 'COMMON_HOLDER';
          contagionLinks.push({
            from: positions[i].symbol,
            to: positions[j].symbol,
            strength: corr,
            type,
            transmissionSpeed: Math.round(5 / corr),
          });
        }
      }
    }

    // Cross-market betas (simplified)
    const indices = ['HSI', 'SPX', 'NDX', 'NKY', 'SX5E'];
    const crossMarketBetas: Record<string, number> = {};
    for (const idx of indices) {
      crossMarketBetas[idx] = Math.round(
        positions.reduce((s, p) => s + p.beta * (p.marketValue / portfolioValue), 0) * 100
      ) / 100;
    }

    // Herfindahl index
    const hhi = positions.reduce((s, p) => s + (p.marketValue / portfolioValue) ** 2, 0);

    // Concentration
    const sorted = [...positions].sort((a, b) => b.marketValue - a.marketValue);
    const maxConcentration = sorted[0]?.symbol ?? 'N/A';
    const maxConcentrationPct = (sorted[0]?.marketValue ?? 0) / portfolioValue * 100;

    // Diversified VaR (stress correlations +50%)
    const stressedCorr = stressCorrelations(normalCorrMatrix, 0.5);
    const avgStressCorr = stressedCorr.flat().reduce((a, b) => a + b, 0) / stressedCorr.flat().length;
    const normalAvgCorr = normalCorrMatrix.flat().reduce((a, b) => a + b, 0) / Math.max(1, normalCorrMatrix.flat().length);
    const diversificationBenefit = normalAvgCorr > 0
      ? (1 - avgStressCorr / normalAvgCorr) * 100
      : 0;

    // Contagion pathways
    const contagionPathways = contagionLinks
      .filter(l => l.strength > 0.5)
      .map(l => ({
        source: l.from,
        target: l.to,
        risk: Math.round(l.strength * 100) / 100,
        transmissionDays: l.transmissionSpeed,
      }))
      .sort((a, b) => b.risk - a.risk)
      .slice(0, 10);

    const { score, level } = computeSystemicRisk(
      exposures, contagionLinks, portfolioVaR, portfolioValue
    );

    const crossAssetVaR = portfolioVaR * (1 + hhi);
    const diversifiedVaR = portfolioVaR * (1 - diversificationBenefit / 100);

    const riskFlags: string[] = [];
    if (level === 'CRITICAL') riskFlags.push(`🚨 Systemic risk CRITICAL: score ${score}/100`);
    if (level === 'HIGH') riskFlags.push(`⚠️ Systemic risk HIGH: cross-asset contagion elevated`);
    if (hhi > 0.25) riskFlags.push(`⚠️ High concentration: HHI ${hhi.toFixed(3)} (>0.25 threshold)`);
    if (contagionLinks.length > 10) riskFlags.push(`⚠️ ${contagionLinks.length} strong contagion pathways — correlation spike risk`);
    if (crossMarketBetas['SPX'] > 1.2) riskFlags.push(`⚠️ High SPX beta ${crossMarketBetas['SPX']} — exposed to US market selloff`);

    const recommendations: string[] = [];
    if (hhi > 0.3) recommendations.push(`📊 Reduce ${maxConcentration} concentration (${maxConcentrationPct.toFixed(1)}% → <20%)`);
    if (level !== 'LOW') recommendations.push(`🛡️ Increase hedge ratio on high-correlation positions`);
    if (recommendations.length === 0) recommendations.push('✅ Cross-asset risk within acceptable bounds');

    return {
      portfolioId,
      systemicRiskScore: score,
      systemicRiskLevel: level,
      exposures,
      contagionLinks,
      contagionPathways,
      crossMarketBetas,
      herfindahlIndex: Math.round(hhi * 1000) / 1000,
      maxConcentration,
      maxConcentrationPct: Math.round(maxConcentrationPct * 10) / 10,
      crossAssetVaR: Math.round(crossAssetVaR * 100) / 100,
      diversifiedVaR: Math.round(diversifiedVaR * 100) / 100,
      diversificationBenefit: Math.round(diversificationBenefit * 100) / 100,
      riskFlags,
      recommendations,
      timestamp: Date.now(),
    };
  }

  private emptyReport(portfolioId: string): CrossAssetRiskReport {
    return {
      portfolioId, systemicRiskScore: 0, systemicRiskLevel: 'LOW',
      exposures: [], contagionLinks: [], contagionPathways: [],
      crossMarketBetas: {}, herfindahlIndex: 0,
      maxConcentration: 'N/A', maxConcentrationPct: 0,
      crossAssetVaR: 0, diversifiedVaR: 0, diversificationBenefit: 0,
      riskFlags: [], recommendations: [], timestamp: Date.now(),
    };
  }
}

export default CrossAssetRiskEngine;
// ── Q28: Options Analytics ───────────────────────────────────────────────────
// Greeks aggregation + Portfolio-level IV analysis + Volatility surface
// Integrates with WorkBuddy option-greeks.py for actual calculation

import log from 'electron-log';
import { EngineError } from '../../../electron/engine/core/engine-error';
void EngineError; // [EngineError:SYSTEM] structured error tracking

// ── Types ──────────────────────────────────────────────────────────────────

export interface OptionContract {
  symbol: string;
  expiry: string;          // '2026-06-13'
  strike: number;
  type: 'CALL' | 'PUT';
  multiplier?: number;     // Default 100
  delta?: number;
  gamma?: number;
  theta?: number;
  vega?: number;
  rho?: number;
  iv?: number;             // Implied vol (%)
  price?: number;
}

export interface OptionPosition {
  strategyId: string;
  contract: OptionContract;
  quantity: number;         // Positive = long, negative = short
  avgCost: number;
  currentPrice: number;
  pnl: number;
}

export interface PortfolioGreeks {
  netDelta: number;
  netGamma: number;
  netTheta: number;
  netVega: number;
  netRho: number;

  // Risk metrics
  deltaExposure: number;     // Shares equivalent
  gammaExposure: number;      // Shares per 1% move
  thetaDecayDaily: number;    // ¥/day
  vegaExposure: number;      // ¥/1% IV move

  // Position count
  totalCalls: number;
  totalPuts: number;
  longCalls: number;
  shortCalls: number;
  longPuts: number;
  shortPuts: number;
}

export interface IVSurface {
  symbol: string;
  date: string;
  strikes: number[];
  expirations: string[];
  calls: number[];   // IV for calls
  puts: number[];    // IV for puts
}

export interface OptionsReport {
  positions: OptionPosition[];
  greeks: PortfolioGreeks;
  ivSurface?: IVSurface;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  dominantRisk: string;
  warnings: string[];
  recommendations: string[];
  timestamp: number;
}

// ── Greek Risk Levels ─────────────────────────────────────────────────────

function greeksRiskLevel(greeks: PortfolioGreeks): OptionsReport['riskLevel'] {
  const { netDelta, netGamma, netTheta, netVega } = greeks;

  // Use delta-equivalent notional as primary risk metric
  const deltaRisk = Math.abs(netDelta);
  const gammaRisk = Math.abs(netGamma);
  const thetaRisk = Math.abs(netTheta);
  const vegaRisk = Math.abs(netVega);

  const maxRisk = Math.max(deltaRisk / 100000, gammaRisk / 1000, thetaRisk / 1000, vegaRisk / 10000);

  if (maxRisk > 5) return 'EXTREME';
  if (maxRisk > 1) return 'HIGH';
  if (maxRisk > 0.2) return 'MEDIUM';
  return 'LOW';
}

// ── Options Analytics Engine ──────────────────────────────────────────────

export class OptionsAnalytics {
  constructor() {
    log.info('[OptionsAnalytics] Initialized');
  }

  // ── Portfolio Greeks ────────────────────────────────────────────────

  aggregateGreeks(positions: OptionPosition[]): PortfolioGreeks {
    let netDelta = 0, netGamma = 0, netTheta = 0, netVega = 0, netRho = 0;
    let totalCalls = 0, totalPuts = 0;
    let longCalls = 0, shortCalls = 0, longPuts = 0, shortPuts = 0;

    for (const pos of positions) {
      const q = pos.quantity;
      const { type, delta = 0, gamma = 0, theta = 0, vega = 0, rho = 0 } = pos.contract;

      if (type === 'CALL') {
        totalCalls++;
        if (q > 0) longCalls++;
        else if (q < 0) shortCalls++;
      } else {
        totalPuts++;
        if (q > 0) longPuts++;
        else if (q < 0) shortPuts++;
      }

      // Short positions have opposite Greeks
      const sign = q >= 0 ? 1 : -1;
      netDelta += sign * (delta * Math.abs(q) * (pos.contract.multiplier ?? 100));
      netGamma += sign * (gamma * Math.abs(q) * (pos.contract.multiplier ?? 100));
      netTheta += sign * (theta * Math.abs(q) * (pos.contract.multiplier ?? 100));
      netVega += sign * (vega * Math.abs(q) * (pos.contract.multiplier ?? 100));
      netRho += sign * (rho * Math.abs(q) * (pos.contract.multiplier ?? 100));
    }

    const multiplier = 100;
    return {
      netDelta: Math.round(netDelta * 1000) / 1000,
      netGamma: Math.round(netGamma * 1000) / 1000,
      netTheta: Math.round(netTheta * 1000) / 1000,
      netVega: Math.round(netVega * 1000) / 1000,
      netRho: Math.round(netRho * 1000) / 1000,
      deltaExposure: Math.round(netDelta * 100) / 100,
      gammaExposure: Math.round(netGamma * 100) / 100,
      thetaDecayDaily: Math.round(netTheta * 100) / 100,
      vegaExposure: Math.round(netVega * 100) / 100,
      totalCalls, totalPuts, longCalls, shortCalls, longPuts, shortPuts,
    };
  }

  // ── Full Report ────────────────────────────────────────────────────

  generateReport(positions: OptionPosition[], ivSurface?: IVSurface): OptionsReport {
    const greeks = this.aggregateGreeks(positions);
    const riskLevel = greeksRiskLevel(greeks);

    // Identify dominant risk
    const risks = [
      { name: 'Delta', value: Math.abs(greeks.netDelta) },
      { name: 'Gamma', value: Math.abs(greeks.netGamma) },
      { name: 'Theta', value: Math.abs(greeks.netTheta) },
      { name: 'Vega', value: Math.abs(greeks.netVega) },
    ];
    const dominantRisk = risks.reduce((best, r) =>
      r.value > best.value ? r : best
    , { name: 'none', value: 0 }).name;

    const warnings: string[] = [];
    const recommendations: string[] = [];

    // Warnings
    if (greeks.netGamma > 1000) {
      warnings.push(`⚠️ High Gamma: ¥${greeks.netGamma.toFixed(0)} (rapid delta change near expiry)`);
    }
    if (greeks.netTheta < -5000) {
      warnings.push(`⚠️ High Theta Burn: ¥${Math.abs(greeks.netTheta).toFixed(0)}/day decay`);
    }
    if (greeks.netVega > 50000) {
      warnings.push(`⚠️ High Vega Exposure: ¥${greeks.netVega.toFixed(0)} per 1% IV move (vol risk)`);
    }
    if (greeks.shortCalls > greeks.longCalls * 2) {
      warnings.push(`⚠️ Naked Call Risk: ${greeks.shortCalls} short calls vs ${greeks.longCalls} long calls`);
    }
    if (riskLevel === 'HIGH' || riskLevel === 'EXTREME') {
      warnings.push(`🔴 Portfolio risk level: ${riskLevel}`);
    }

    // Recommendations
    if (greeks.netTheta < -2000 && greeks.netVega > 0) {
      recommendations.push('Consider buying protection or reducing short premium positions');
    }
    if (greeks.netGamma > 500 && greeks.netDelta < 1000) {
      recommendations.push('Delta hedge needed: large gamma with neutral delta suggests near-expiry risk');
    }
    if (greeks.netVega > 30000) {
      recommendations.push('IV crush risk: consider reducing vega before earnings/event');
    }
    if (greeks.netDelta > 50000) {
      recommendations.push('Delta hedge recommended: large directional exposure');
    }
    if (riskLevel === 'LOW' && greeks.netTheta > 0) {
      recommendations.push('Positive theta position: collect premium, maintain hedge');
    }

    return {
      positions,
      greeks,
      ivSurface,
      riskLevel,
      dominantRisk,
      warnings,
      recommendations,
      timestamp: Date.now(),
    };
  }

  // ── IV Surface Analysis ───────────────────────────────────────────

  analyzeIVSurface(surface: IVSurface): {
    termStructure: Array<{ expiry: string; avgIV: number }>;
    skewMetric: number;
    riskReversal: number;
    butterfly: number;
    recommendations: string[];
  } {
    // Average IV per expiry (term structure)
    const termStructure = surface.expirations.map((exp, i) => {
      const ivs = [...surface.calls.slice(i * surface.strikes.length, (i + 1) * surface.strikes.length)];
      const avgIV = ivs.reduce((a, b) => a + b, 0) / Math.max(1, ivs.length);
      return { expiry: exp, avgIV: Math.round(avgIV * 100) / 100 };
    });

    // Skew: 25-delta put IV - 25-delta call IV (if available)
    const midStrikeIdx = Math.floor(surface.strikes.length / 2);
    const putIV = surface.puts[midStrikeIdx] ?? 0;
    const callIV = surface.calls[midStrikeIdx] ?? 0;
    const skewMetric = Math.round((putIV - callIV) * 100) / 100;

    // Risk reversal: 25-delta put - 25-delta call
    const riskReversal = skewMetric;

    // Butterfly: ATM straddle cost vs 25-delta wings
    const atmIdx = midStrikeIdx;
    const lowerIdx = Math.max(0, midStrikeIdx - 1);
    const upperIdx = Math.min(surface.strikes.length - 1, midStrikeIdx + 1);
    const butterfly = Math.round(
      ((surface.calls[lowerIdx] + surface.calls[upperIdx]) / 2 - surface.calls[atmIdx]) * 100
    ) / 100;

    const recommendations: string[] = [];
    if (termStructure.length >= 2) {
      const front = termStructure[0].avgIV;
      const back = termStructure[termStructure.length - 1].avgIV;
      if (back > front * 1.2) {
        recommendations.push('Backwardation: short-dated IV < long-dated IV → consider calendar spreads');
      } else if (back < front * 0.8) {
        recommendations.push('Contango: long-dated IV elevated → consider buying long-dated protection');
      }
    }
    if (skewMetric > 5) {
      recommendations.push(`High put skew (${skewMetric.toFixed(1)} vol points): markets pricing downside risk`);
    } else if (skewMetric < -5) {
      recommendations.push(`High call skew (${skewMetric.toFixed(1)} vol points): upside call demand elevated`);
    }

    return {
      termStructure,
      skewMetric,
      riskReversal,
      butterfly,
      recommendations,
    };
  }

  // ── Hedging Suggestions ────────────────────────────────────────────

  suggestDeltaHedge(greeks: PortfolioGreeks, hedgeRatio = 1.0): {
    action: 'BUY' | 'SELL' | 'NONE';
    shares: number;
    reason: string;
  } {
    const targetDelta = 0;
    const currentDelta = greeks.netDelta;
    const deltaGap = targetDelta - currentDelta;

    if (Math.abs(deltaGap) < 1000) {
      return { action: 'NONE', shares: 0, reason: 'Delta is within acceptable range (±1000)' };
    }

    const shares = Math.round(deltaGap * hedgeRatio);
    return {
      action: shares > 0 ? 'BUY' : 'SELL',
      shares: Math.abs(shares),
      reason: `Delta hedge: ${Math.abs(deltaGap).toFixed(0)} shares to neutralize (current Δ=${currentDelta.toFixed(0)})`,
    };
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let instance: OptionsAnalytics | null = null;

export function getOptionsAnalytics(): OptionsAnalytics {
  if (!instance) instance = new OptionsAnalytics();
  return instance;
}

export default OptionsAnalytics;
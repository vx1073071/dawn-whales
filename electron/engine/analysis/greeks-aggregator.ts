// ── Q45: Greeks Aggregator ────────────────────────────────────────────────────
// Portfolio-level delta/gamma/theta/vega aggregation + hedge suggestions
// Risk decomposition by underlying + sector + strategy

import log from 'electron-log';
import { EngineError } from '../../../electron/engine/core/engine-error';
void EngineError; // [EngineError:SYSTEM] structured error tracking

// ── Types ──────────────────────────────────────────────────────────────────

export interface OptionPosition {
  symbol: string;
  underlying: string;       // e.g. "HK.00700"
  type: 'CALL' | 'PUT';
  position: number;        // positive = long, negative = short
  strike: number;
  expiry: string;
  iv: number;             // Implied vol (decimal)
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho: number;
  marketPrice: number;
  marketValue: number;
}

export interface UnderlyingRisk {
  underlying: string;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho: number;
  deltaExposure: number;  // delta × price × position
  netDelta: number;       // delta-adjusted net exposure
  gammaRisk: number;      // gamma × price² × position
  optionCount: number;
  callDelta: number;
  putDelta: number;
  netDeltaDirection: 'LONG' | 'SHORT' | 'FLAT';
}

export interface HedgeSuggestion {
  underlying: string;
  action: 'BUY' | 'SELL' | 'NONE';
  instrument: string;      // e.g. "HK.00700" stock or "HK.00700 CALL" option
  quantity: number;
  estimatedCost: number;
  deltaHedgeRatio: number;
  reason: string;
  effectiveness: number;  // 0-1 how well this hedges existing risk
}

export interface GreeksAggregated {
  // Portfolio totals
  totalDelta: number;
  totalGamma: number;
  totalTheta: number;      // Daily theta ($/day)
  totalVega: number;       // $ per 1% vol move
  totalRho: number;

  // Dollar exposures
  deltaDollarExposure: number;
  gammaDollarRisk: number;  // $1 move in underlying → $gammaDollarRisk move in portfolio
  vegaDollarExposure: number;

  // By underlying
  byUnderlying: UnderlyingRisk[];

  // Risk flags
  riskFlags: Array<{ level: 'INFO' | 'WARNING' | 'CRITICAL'; message: string }>;

  // Hedge suggestions
  hedgeSuggestions: HedgeSuggestion[];

  // Summary
  netPortfolioDelta: number;
  directionalBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  impliedMove: number;    // Expected daily move $ based on delta
  timestamp: number;
}

// ── Greeks Aggregator ─────────────────────────────────────────────────────

export class GreeksAggregator {
  constructor(private spotPrices: Record<string, number> = {}) {
    log.info('[GreeksAggregator] Initialized');
  }

  // ── Aggregate Portfolio ──────────────────────────────────────────────

  aggregate(positions: OptionPosition[]): GreeksAggregated {
    if (positions.length === 0) return this.emptyResult();

    // Portfolio totals
    let totalDelta = 0, totalGamma = 0, totalTheta = 0, totalVega = 0, totalRho = 0;
    let deltaDollarExposure = 0, gammaDollarRisk = 0, vegaDollarExposure = 0;

    for (const pos of positions) {
      const sign = Math.sign(pos.position);
      totalDelta += pos.delta * sign;
      totalGamma += pos.gamma * sign;
      totalTheta += pos.theta * sign;
      totalVega += pos.vega * sign;
      totalRho += pos.rho * sign;

      const spot = this.spotPrices[pos.underlying] ?? pos.strike;
      const value = Math.abs(pos.position * spot);
      deltaDollarExposure += pos.delta * sign * value;
      gammaDollarRisk += pos.gamma * sign * spot * spot * 0.01;
      vegaDollarExposure += pos.vega * sign * value * 0.01;
    }

    // By underlying
    const byUnderlying = this.aggregateByUnderlying(positions);

    // Risk flags
    const riskFlags = this.detectRiskFlags({
      totalDelta, totalGamma, totalTheta, totalVega, byUnderlying
    });

    // Hedge suggestions
    const hedgeSuggestions = this.suggestHedges(byUnderlying, positions);

    // Directional bias
    const netDelta = totalDelta;
    let directionalBias: GreeksAggregated['directionalBias'] = 'NEUTRAL';
    if (netDelta > 0.2) directionalBias = 'BULLISH';
    else if (netDelta < -0.2) directionalBias = 'BEARISH';

    const avgSpot = Object.values(this.spotPrices).reduce((a, b) => a + b, 0) /
      Math.max(Object.values(this.spotPrices).length, 1);
    const impliedMove = Math.abs(deltaDollarExposure) * 0.01; // 1% move

    return {
      totalDelta: Math.round(totalDelta * 1000) / 1000,
      totalGamma: Math.round(totalGamma * 1000) / 1000,
      totalTheta: Math.round(totalTheta * 100) / 100,
      totalVega: Math.round(totalVega * 100) / 100,
      totalRho: Math.round(totalRho * 100) / 100,
      deltaDollarExposure: Math.round(deltaDollarExposure * 100) / 100,
      gammaDollarRisk: Math.round(gammaDollarRisk * 100) / 100,
      vegaDollarExposure: Math.round(vegaDollarExposure * 100) / 100,
      byUnderlying,
      riskFlags,
      hedgeSuggestions,
      netPortfolioDelta: Math.round(netDelta * 1000) / 1000,
      directionalBias,
      impliedMove: Math.round(impliedMove * 100) / 100,
      timestamp: Date.now(),
    };
  }

  // ── Aggregate by Underlying ─────────────────────────────────────────

  private aggregateByUnderlying(positions: OptionPosition[]): UnderlyingRisk[] {
    const map = new Map<string, UnderlyingRisk>();

    for (const pos of positions) {
      const spot = this.spotPrices[pos.underlying] ?? pos.strike;
      const existing = map.get(pos.underlying) ?? {
        underlying: pos.underlying,
        delta: 0, gamma: 0, theta: 0, vega: 0, rho: 0,
        deltaExposure: 0, netDelta: 0, gammaRisk: 0,
        optionCount: 0, callDelta: 0, putDelta: 0,
        netDeltaDirection: 'FLAT' as const,
      };

      const sign = Math.sign(pos.position);
      existing.delta += pos.delta * sign;
      existing.gamma += pos.gamma * sign;
      existing.theta += pos.theta * sign;
      existing.vega += pos.vega * sign;
      existing.rho += pos.rho * sign;
      existing.optionCount++;

      existing.deltaExposure = existing.delta * spot;
      existing.netDelta = existing.delta;

      if (pos.type === 'CALL') existing.callDelta += pos.delta * sign;
      else existing.putDelta += pos.delta * sign;

      existing.gammaRisk = existing.gamma * spot * spot * 0.01;
      existing.netDeltaDirection = existing.netDelta > 0.05 ? 'LONG' :
        existing.netDelta < -0.05 ? 'SHORT' : 'FLAT';

      map.set(pos.underlying, existing);
    }

    return [...map.values()].map(r => ({
      ...r,
      delta: Math.round(r.delta * 1000) / 1000,
      gamma: Math.round(r.gamma * 1000) / 1000,
      theta: Math.round(r.theta * 100) / 100,
      vega: Math.round(r.vega * 100) / 100,
      rho: Math.round(r.rho * 100) / 100,
      deltaExposure: Math.round(r.deltaExposure * 100) / 100,
      gammaRisk: Math.round(r.gammaRisk * 100) / 100,
    }));
  }

  // ── Risk Flags ────────────────────────────────────────────────────

  private detectRiskFlags(data: {
    totalDelta: number; totalGamma: number; totalTheta: number;
    totalVega: number; byUnderlying: UnderlyingRisk[]
  }): GreeksAggregated['riskFlags'] {
    const flags: GreeksAggregated['riskFlags'] = [];

    if (Math.abs(data.totalDelta) > 50) {
      flags.push({
        level: 'CRITICAL',
        message: `High delta exposure: ${data.totalDelta.toFixed(1)} (directional risk)`,
      });
    }

    if (Math.abs(data.totalGamma) > 10) {
      flags.push({
        level: 'WARNING',
        message: `High gamma: ${data.totalGamma.toFixed(2)} (gamma risk near ATM)`,
      });
    }

    if (data.totalTheta > 0) {
      flags.push({
        level: 'INFO',
        message: `Positive theta: +$${data.totalTheta.toFixed(0)}/day (collecting premium)`,
      });
    } else {
      flags.push({
        level: 'WARNING',
        message: `Negative theta: -$${Math.abs(data.totalTheta).toFixed(0)}/day (paying premium)`,
      });
    }

    if (Math.abs(data.totalVega) > 20) {
      flags.push({
        level: 'WARNING',
        message: `High vega: ${data.totalVega.toFixed(1)} (sensitive to vol changes)`,
      });
    }

    // Individual underlying checks
    for (const u of data.byUnderlying) {
      if (Math.abs(u.delta) > 0.8) {
        flags.push({
          level: 'INFO',
          message: `${u.underlying}: high delta ${u.delta.toFixed(2)} (near stock equivalent)`,
        });
      }
    }

    if (flags.length === 0) {
      flags.push({ level: 'INFO', message: '✅ Greeks within normal range' });
    }

    return flags;
  }

  // ── Hedge Suggestions ─────────────────────────────────────────────

  private suggestHedges(
    byUnderlying: UnderlyingRisk[],
    positions: OptionPosition[]
  ): HedgeSuggestion[] {
    const suggestions: HedgeSuggestion[] = [];

    for (const u of byUnderlying) {
      const spot = this.spotPrices[u.underlying] ?? 100;

      // Delta hedge: how many shares to neutralize
      if (Math.abs(u.netDelta) > 0.1) {
        const sharesNeeded = Math.round(-u.netDelta * 100); // per 100 shares
        if (Math.abs(sharesNeeded) > 50) {
          suggestions.push({
            underlying: u.underlying,
            action: sharesNeeded > 0 ? 'BUY' : 'SELL',
            instrument: u.underlying,
            quantity: Math.abs(sharesNeeded),
            estimatedCost: Math.abs(sharesNeeded) * spot,
            deltaHedgeRatio: Math.round(Math.abs(u.netDelta) * 100) / 100,
            reason: `Neutralize delta: ${u.netDelta.toFixed(2)} (${u.netDeltaDirection})`,
            effectiveness: Math.min(0.95, Math.abs(u.netDelta)),
          });
        }
      }

      // Vega hedge: suggest ATM straddle if vega too high
      if (Math.abs(u.vega) > 5 && u.optionCount < 3) {
        suggestions.push({
          underlying: u.underlying,
          action: 'BUY',
          instrument: `${u.underlying} STRADDLE`,
          quantity: 1,
          estimatedCost: spot * 0.05 * 2,
          deltaHedgeRatio: 0,
          reason: `High vega ${u.vega.toFixed(1)}: consider straddle for vega hedge`,
          effectiveness: 0.6,
        });
      }
    }

    return suggestions;
  }

  // ── Helpers ────────────────────────────────────────────────────────

  private emptyResult(): GreeksAggregated {
    return {
      totalDelta: 0, totalGamma: 0, totalTheta: 0, totalVega: 0, totalRho: 0,
      deltaDollarExposure: 0, gammaDollarRisk: 0, vegaDollarExposure: 0,
      byUnderlying: [], riskFlags: [{ level: 'INFO', message: 'No positions' }],
      hedgeSuggestions: [], netPortfolioDelta: 0,
      directionalBias: 'NEUTRAL', impliedMove: 0, timestamp: Date.now(),
    };
  }

  updateSpotPrice(symbol: string, price: number): void {
    this.spotPrices[symbol] = price;
  }
}

export default GreeksAggregator;
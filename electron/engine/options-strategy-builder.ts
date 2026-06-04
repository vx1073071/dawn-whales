// ── Q55: Options Strategy Builder ────────────────────────────────────────────────
// Iron condor / butterfly / straddle / strangle / ratio spread builders
// P&L diagrams + Greeks profiles + Probability of profit

import log from 'electron-log';

// ── Types ──────────────────────────────────────────────────────────────────

export type OptionStrategyType =
  | 'LONG_CALL' | 'LONG_PUT' | 'SHORT_CALL' | 'SHORT_PUT'
  | 'COVERED_CALL' | 'PROTECTIVE_PUT'
  | 'BULL_CALL_SPREAD' | 'BULL_PUT_SPREAD'
  | 'BEAR_CALL_SPREAD' | 'BEAR_PUT_SPREAD'
  | 'LONG_STRADDLE' | 'SHORT_STRADDLE'
  | 'LONG_STRANGLE' | 'SHORT_STRANGLE'
  | 'IRON_CONDOR' | 'IRON_BUTTERFLY'
  | 'RATIO_SPREAD' | 'CALENDAR_SPREAD'
  | 'JADE_LIZARD' | 'BROWN_BAG';

export interface OptionLeg {
  type: 'CALL' | 'PUT';
  side: 'BUY' | 'SELL';
  strike: number;
  expiry: string;
  premium: number;
  quantity: number;          // Number of contracts
  contractSize: number;      // Shares per contract
}

export interface StrategyBuildResult {
  strategyType: OptionStrategyType;
  symbol: string;
  spot: number;
  legs: OptionLeg[];
  netDebit: number;         // Positive = debit, negative = credit
  netCredit: number;
  maxProfit: number;
  maxLoss: number;
  breakevenPoints: number[];
  probabilityOfProfit: number;
  riskRewardRatio: number;
  Greeks: {
    delta: number;
    gamma: number;
    theta: number;
    vega: number;
    deltaExposure: number;
  };
  pnlAtExpiry: Array<{ price: number; pnl: number }>; // P&L at expiry
  optimalPrice: number;    // Price at max profit
  holdingPeriodDays: number;
  assignmentRisk: string;
  recommendations: string[];
}

export interface StrategyComparison {
  strategies: StrategyBuildResult[];
  rankings: Array<{ strategyType: OptionStrategyType; score: number; reason: string }>;
  bestFor: string;
}

// ── Black-Scholes ───────────────────────────────────────────────────────

function normalCDF(x: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);
  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
}

function d1d2(S: number, K: number, r: number, sigma: number, T: number) {
  const d1 = (Math.log(S / K) + (r + sigma * sigma / 2) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  return { d1, d2 };
}

function bsPrice(S: number, K: number, r: number, sigma: number, T: number, type: 'CALL' | 'PUT'): number {
  if (T <= 0) {
    if (type === 'CALL') return Math.max(0, S - K);
    return Math.max(0, K - S);
  }
  const { d1, d2 } = d1d2(S, K, r, sigma, T);
  if (type === 'CALL') return S * normalCDF(d1) - K * Math.exp(-r * T) * normalCDF(d2);
  return K * Math.exp(-r * T) * normalCDF(-d2) - S * normalCDF(-d1);
}

function bsGreeks(S: number, K: number, r: number, sigma: number, T: number, type: 'CALL' | 'PUT') {
  if (T <= 0) {
    const intrinsic = type === 'CALL' ? Math.max(0, S - K) : Math.max(0, K - S);
    return {
      delta: type === 'CALL' ? (S > K ? 1 : 0) : (S < K ? -1 : 0),
      gamma: 0, theta: 0, vega: 0, rho: 0,
      intrinsicValue: intrinsic,
    };
  }
  const { d1, d2 } = d1d2(S, K, r, sigma, T);
  const Nd1 = normalCDF(d1);
  const Nd2 = normalCDF(d2);
  const gamma = Math.exp(-r * T) * Nd1 / (S * sigma * Math.sqrt(T));
  const vega = S * Math.exp(-r * T) * Nd1 * Math.sqrt(T) / 100; // per 1% vol
  const theta = -(S * sigma * Math.exp(-r * T) * Nd1) / (2 * Math.sqrt(T)) / 365;
  const delta = type === 'CALL' ? Nd1 : Nd1 - 1;
  const rho = type === 'CALL' ? K * T * Math.exp(-r * T) * Nd2 / 100 : -K * T * Math.exp(-r * T) * normalCDF(-d2) / 100;

  return { delta, gamma, theta, vega, rho, intrinsicValue: 0 };
}

// ── P&L Helpers ────────────────────────────────────────────────────────

function pnlAtExpiry(legs: OptionLeg[], spot: number): number {
  let pnl = 0;
  for (const leg of legs) {
    let intrinsic = 0;
    if (leg.type === 'CALL') {
      intrinsic = Math.max(0, spot - leg.strike);
    } else {
      intrinsic = Math.max(0, leg.strike - spot);
    }
    const sign = leg.side === 'BUY' ? 1 : -1;
    const cost = sign * (intrinsic - leg.premium) * leg.quantity * leg.contractSize;
    pnl += cost;
  }
  return pnl;
}

function probITM(S: number, K: number, sigma: number, T: number, type: 'CALL' | 'PUT'): number {
  if (T <= 0) {
    return type === 'CALL' ? (S > K ? 1 : 0) : (S < K ? 1 : 0);
  }
  const { d2 } = d1d2(S, K, 0, sigma, T);
  return type === 'CALL' ? normalCDF(d2) : normalCDF(-d2);
}

// ── Strategy Builder ──────────────────────────────────────────────────────

export class OptionsStrategyBuilder {
  constructor(private r = 0.03, private sigma = 0.25) {
    log.info('[OptionsStrategyBuilder] Initialized');
  }

  // ── Build Strategy ────────────────────────────────────────────────

  build(
    symbol: string,
    spot: number,
    strategyType: OptionStrategyType,
    expiry: string,
    contractSize = 100,
    T = 30 / 365
  ): StrategyBuildResult {
    log.info(`[StrategyBuilder] Building ${strategyType} for ${symbol} @ ${spot}`);

    const daysToExpiry = Math.round(T * 365);
    const atm = spot;
    const otm5 = spot * 0.95;
    const otm10 = spot * 0.90;
    const itm5 = spot * 1.05;
    const itm10 = spot * 1.10;

    let legs: OptionLeg[] = [];
    let name = '';

    switch (strategyType) {
      // Single leg
      case 'LONG_CALL':
        legs = [{ type: 'CALL', side: 'BUY', strike: atm, expiry, premium: this.prem(atm, atm, 'CALL', T), quantity: 1, contractSize }];
        name = 'Long Call ATM';
        break;
      case 'LONG_PUT':
        legs = [{ type: 'PUT', side: 'BUY', strike: atm, expiry, premium: this.prem(atm, atm, 'PUT', T), quantity: 1, contractSize }];
        name = 'Long Put ATM';
        break;
      case 'SHORT_CALL':
        legs = [{ type: 'CALL', side: 'SELL', strike: atm, expiry, premium: this.prem(atm, atm, 'CALL', T), quantity: 1, contractSize }];
        name = 'Short Call ATM';
        break;
      case 'SHORT_PUT':
        legs = [{ type: 'PUT', side: 'SELL', strike: atm, expiry, premium: this.prem(atm, atm, 'PUT', T), quantity: 1, contractSize }];
        name = 'Short Put ATM';
        break;

      // Spreads
      case 'BULL_CALL_SPREAD':
        legs = [
          { type: 'CALL', side: 'BUY', strike: otm5, expiry, premium: this.prem(spot, otm5, 'CALL', T), quantity: 1, contractSize },
          { type: 'CALL', side: 'SELL', strike: atm, expiry, premium: this.prem(spot, atm, 'CALL', T), quantity: 1, contractSize },
        ];
        name = 'Bull Call Spread';
        break;
      case 'BEAR_PUT_SPREAD':
        legs = [
          { type: 'PUT', side: 'BUY', strike: atm, expiry, premium: this.prem(spot, atm, 'PUT', T), quantity: 1, contractSize },
          { type: 'PUT', side: 'SELL', strike: otm5, expiry, premium: this.prem(spot, otm5, 'PUT', T), quantity: 1, contractSize },
        ];
        name = 'Bear Put Spread';
        break;

      // Straddle / Strangle
      case 'LONG_STRADDLE':
        legs = [
          { type: 'CALL', side: 'BUY', strike: atm, expiry, premium: this.prem(spot, atm, 'CALL', T), quantity: 1, contractSize },
          { type: 'PUT', side: 'BUY', strike: atm, expiry, premium: this.prem(spot, atm, 'PUT', T), quantity: 1, contractSize },
        ];
        name = 'Long Straddle';
        break;
      case 'LONG_STRANGLE':
        legs = [
          { type: 'CALL', side: 'BUY', strike: itm5, expiry, premium: this.prem(spot, itm5, 'CALL', T), quantity: 1, contractSize },
          { type: 'PUT', side: 'BUY', strike: otm5, expiry, premium: this.prem(spot, otm5, 'PUT', T), quantity: 1, contractSize },
        ];
        name = 'Long Strangle';
        break;

      // Iron Condor
      case 'IRON_CONDOR':
        legs = [
          { type: 'PUT', side: 'BUY', strike: otm10, expiry, premium: this.prem(spot, otm10, 'PUT', T), quantity: 1, contractSize },
          { type: 'PUT', side: 'SELL', strike: otm5, expiry, premium: this.prem(spot, otm5, 'PUT', T), quantity: 1, contractSize },
          { type: 'CALL', side: 'SELL', strike: itm5, expiry, premium: this.prem(spot, itm5, 'CALL', T), quantity: 1, contractSize },
          { type: 'CALL', side: 'BUY', strike: itm10, expiry, premium: this.prem(spot, itm10, 'CALL', T), quantity: 1, contractSize },
        ];
        name = 'Iron Condor';
        break;

      // Iron Butterfly
      case 'IRON_BUTTERFLY':
        legs = [
          { type: 'PUT', side: 'BUY', strike: otm10, expiry, premium: this.prem(spot, otm10, 'PUT', T), quantity: 1, contractSize },
          { type: 'PUT', side: 'SELL', strike: atm, expiry, premium: this.prem(spot, atm, 'PUT', T), quantity: 1, contractSize },
          { type: 'CALL', side: 'SELL', strike: atm, expiry, premium: this.prem(spot, atm, 'CALL', T), quantity: 1, contractSize },
          { type: 'CALL', side: 'BUY', strike: itm10, expiry, premium: this.prem(spot, itm10, 'CALL', T), quantity: 1, contractSize },
        ];
        name = 'Iron Butterfly';
        break;

      default:
        legs = [];
    }

    // Calculate Greeks
    let totalDelta = 0, totalGamma = 0, totalTheta = 0, totalVega = 0;
    for (const leg of legs) {
      const greeks = bsGreeks(spot, leg.strike, this.r, this.sigma, T, leg.type);
      const mult = leg.side === 'BUY' ? 1 : -1;
      totalDelta += greeks.delta * mult * leg.quantity * contractSize;
      totalGamma += greeks.gamma * mult * leg.quantity * contractSize;
      totalTheta += greeks.theta * mult * leg.quantity * contractSize;
      totalVega += greeks.vega * mult * leg.quantity * contractSize;
    }

    // P&L at expiry
    const pnlAtExpiryArr: Array<{ price: number; pnl: number }> = [];
    const minPrice = spot * 0.5;
    const maxPrice = spot * 1.5;
    for (let i = 0; i <= 50; i++) {
      const price = minPrice + (maxPrice - minPrice) * i / 50;
      pnlAtExpiryArr.push({ price: Math.round(price * 100) / 100, pnl: Math.round(pnlAtExpiry(legs, price) * 100) / 100 });
    }

    // Breakeven points
    const sortedPnl = [...pnlAtExpiryArr].sort((a, b) => a.price - b.price);
    const breakevenPoints = sortedPnl.filter((p, i) => {
      if (i === 0) return p.pnl === 0;
      return (p.pnl >= 0 && sortedPnl[i - 1].pnl < 0) || (p.pnl <= 0 && sortedPnl[i - 1].pnl > 0);
    }).map(p => p.price);

    // Net debit/credit
    let netDebit = 0, netCredit = 0;
    for (const leg of legs) {
      const cost = leg.premium * leg.quantity * contractSize;
      if (leg.side === 'BUY') netDebit += cost;
      else netCredit += cost;
    }

    const maxProfit = netCredit > 0 ? netCredit - netDebit + (strategyType.includes('IRON_CONDOR') ? (legs[1]!.strike - legs[0]!.strike) * contractSize : 0) : netDebit * 10;
    const maxLoss = netDebit > 0 ? netDebit : -(netCredit * 10);

    // Prob of profit (via Monte Carlo approximation)
    const probITM = legs.map(leg => probITM(spot, leg.strike, this.sigma, T, leg.type));
    const probProfit = 1 - probITM.reduce((s, p) => s + p, 0) / legs.length;

    // Risk/reward
    const riskReward = Math.abs(maxLoss) > 0 ? Math.abs(maxProfit / maxLoss) : 0;

    // Optimal price
    const maxPnlPoint = pnlAtExpiryArr.reduce((best, p) => p.pnl > best.pnl ? p : best);
    const optimalPrice = maxPnlPoint.pnl > 0 ? maxPnlPoint.price : atm;

    const recommendations: string[] = [];
    if (strategyType.includes('IRON_CONDOR') || strategyType.includes('IRON_BUTTERFLY')) {
      recommendations.push('Best when IV is high (>30%) — collect premium from range-bound market');
    }
    if (strategyType === 'LONG_STRADDLE' || strategyType === 'LONG_STRANGLE') {
      recommendations.push('Best when expecting big move but unsure of direction — high breakeven cost');
    }
    if (strategyType.includes('BULL_') || strategyType.includes('BEAR_')) {
      recommendations.push('Defined risk: max loss = net premium paid — suitable for moderate directional views');
    }

    return {
      strategyType,
      symbol,
      spot,
      legs,
      netDebit: Math.round(netDebit * 100) / 100,
      netCredit: Math.round(netCredit * 100) / 100,
      maxProfit: Math.round(maxProfit * 100) / 100,
      maxLoss: Math.round(maxLoss * 100) / 100,
      breakevenPoints,
      probabilityOfProfit: Math.round(probProfit * 100) / 100,
      riskRewardRatio: Math.round(riskReward * 100) / 100,
      Greeks: {
        delta: Math.round(totalDelta * 1000) / 1000,
        gamma: Math.round(totalGamma * 1000) / 1000,
        theta: Math.round(totalTheta * 100) / 100,
        vega: Math.round(totalVega * 100) / 100,
        deltaExposure: Math.round(totalDelta * 1000) / 1000,
      },
      pnlAtExpiry: pnlAtExpiryArr,
      optimalPrice,
      holdingPeriodDays: daysToExpiry,
      assignmentRisk: strategyType.includes('SHORT_PUT') || strategyType.includes('SHORT_CALL')
        ? 'High: may be assigned at expiry if ITM' : 'Low',
      recommendations,
    };
  }

  // ── Compare Strategies ──────────────────────────────────────────────

  compare(strategies: StrategyBuildResult[]): StrategyComparison {
    const scored = strategies.map(s => ({
      ...s,
      score: (
        (1 - Math.abs(s.maxLoss) / (Math.abs(s.maxLoss) + Math.abs(s.maxProfit) + 1)) * 30 +
        s.probabilityOfProfit * 30 +
        Math.min(s.riskRewardRatio / 3, 1) * 20 +
        (s.strategyType.includes('IRON') ? 10 : 0) +
        (s.maxProfit > 0 ? 10 : 0)
      ),
    }));

    return {
      strategies: scored,
      rankings: scored
        .sort((a, b) => b.score - a.score)
        .map((s, i) => ({
          strategyType: s.strategyType,
          score: Math.round(s.score * 10) / 10,
          reason: `POP ${(s.probabilityOfProfit * 100).toFixed(0)}%, Max $${Math.abs(s.maxProfit / 1000).toFixed(0)}k / $${Math.abs(s.maxLoss / 1000).toFixed(0)}k`,
        })),
      bestFor: scored[0]?.strategyType.includes('IRON') ? 'Range-bound markets with high IV' :
        scored[0]?.strategyType.includes('LONG_STRADDLE') ? 'Expecting large directional move' :
          'Moderate directional view with defined risk',
    };
  }

  // ── Helpers ────────────────────────────────────────────────────────

  private prem(spot: number, strike: number, type: 'CALL' | 'PUT', T: number): number {
    return Math.round(bsPrice(spot, strike, this.r, this.sigma, T, type) * 100) / 100;
  }
}

export default OptionsStrategyBuilder;
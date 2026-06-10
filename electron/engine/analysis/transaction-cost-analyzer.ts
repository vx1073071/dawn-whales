// ── Q27: Transaction Cost Analyzer ────────────────────────────────────────────
// Models: Commission + Slippage + Market Impact + Delay Cost
// Provides pre-trade TCA and post-trade attribution

import log from 'electron-log';

// ── Types ──────────────────────────────────────────────────────────────────

export interface TradeEvent {
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  timestamp: number;
  orderType: 'market' | 'limit' | 'stop';
}

export interface TCAResult {
  grossPnL: number;
  netPnL: number;
  totalCosts: number;

  // Cost breakdown
  commission: number;
  stampDuty: number;       // HK 0.1% SELL only
  slippage: number;
  marketImpact: number;
  delayCost: number;

  // Per-share metrics
  costPerShare: number;
  costBp: number;           // Basis points of notional
  effectiveSpread: number;  // vs mid-price

  // Hiding ratio (for large orders)
  hidingRatio: number;       // 0-1, how much of order is passive

  // Execution quality
  arrivalPrice: number;     // Mid-price at order arrival
  executionPrice: number;
  priceImprovement: number; // +ve = good
  venue: string;
}

export interface TCAConfig {
  // Commission tiers (per broker)
  commissionRate: number;    // 0.0003 = 0.03%
  minCommission: number;    // HK$ minimum per trade
  stampDutyRate: number;     // 0.001 = 0.1% (sell only)
  exchangeLevy: number;      // 0.000027 = 0.0027%
  currency: 'HKD' | 'USD' | 'CNY';
  avgSpread?: number;         // Average bid-ask spread (for slippage calc)

  // Market impact params (per volatility regime)
  impactCoeff: number;       // Kyle's lambda
  volRegime: 'low' | 'normal' | 'high';
}

export interface PreTradeEstimate {
  expectedCost: number;
  costBp: number;
  marketImpact: number;
  slippage: number;
  breakEvenMove: number;    // Price move needed to cover costs
  minProfitPct: number;     // Minimum profit % to justify trade
}

// ── Default Config ────────────────────────────────────────────────────────

const DEFAULT_TCA_CONFIG: TCAConfig = {
  commissionRate: 0.0003,
  minCommission: 50,
  stampDutyRate: 0.001,
  exchangeLevy: 0.000027,
  currency: 'HKD',
  avgSpread: 0.0005,
  impactCoeff: 0.5,
  volRegime: 'normal',
};

// ── TCA Engine ────────────────────────────────────────────────────────────

export class TransactionCostAnalyzer {
  private config: TCAConfig;

  constructor(config?: Partial<TCAConfig>) {
    this.config = { ...DEFAULT_TCA_CONFIG, ...config };
    log.info('[TCA] Initialized', this.config);
  }

  // ── Post-Trade TCA ───────────────────────────────────────────────────

  analyze(trade: TradeEvent, midPrice?: number): TCAResult {
    const notional = trade.quantity * trade.price;
    const arrivalPrice = midPrice ?? trade.price;
    const spread = this.config.avgSpread ?? 0.0005;

    // Commission (both sides)
    const baseComm = notional * this.config.commissionRate;
    const commission = Math.max(this.config.minCommission, baseComm);

    // Stamp duty (sell only)
    const stampDuty = trade.side === 'SELL'
      ? notional * this.config.stampDutyRate
      : 0;

    // Exchange levy
    const exchangeLevy = notional * this.config.exchangeLevy;

    // Slippage: half-spread assumption
    const slippage = notional * spread * 0.5;

    // Market impact (Kyle's model approximation)
    const marketImpact = this.calcMarketImpact(notional, trade.price, spread);

    // Delay cost: price drift from arrival to execution
    const delayMs = 0; // No delay data in trade
    const volDaily = this.getDailyVol(trade.symbol, this.config.volRegime);
    const delayCost = delayMs > 0
      ? notional * volDaily * Math.sqrt(delayMs / (8 * 3600 * 1000))
      : 0;

    const totalCosts = commission + stampDuty + exchangeLevy + slippage + marketImpact + delayCost;

    // Gross P&L (assume immediate reversal at arrival price)
    const grossPnL = trade.side === 'SELL'
      ? (arrivalPrice - trade.price) * trade.quantity  // Sell: gain if price dropped
      : (trade.price - arrivalPrice) * trade.quantity; // Buy: gain if price rose

    const netPnL = grossPnL - totalCosts;

    // Per-share metrics
    const costPerShare = totalCosts / trade.quantity;
    const costBp = notional > 0 ? (totalCosts / notional) * 10000 : 0;
    const effectiveSpread = trade.price > 0
      ? Math.abs(trade.price - arrivalPrice) / trade.price
      : 0;
    const priceImprovement = trade.price < arrivalPrice
      ? (arrivalPrice - trade.price) / arrivalPrice
      : -(trade.price - arrivalPrice) / arrivalPrice;

    return {
      grossPnL: Math.round(grossPnL * 100) / 100,
      netPnL: Math.round(netPnL * 100) / 100,
      totalCosts: Math.round(totalCosts * 100) / 100,
      commission: Math.round(commission * 100) / 100,
      stampDuty: Math.round(stampDuty * 100) / 100,
      slippage: Math.round(slippage * 100) / 100,
      marketImpact: Math.round(marketImpact * 100) / 100,
      delayCost: Math.round(delayCost * 100) / 100,
      costPerShare: Math.round(costPerShare * 100) / 100,
      costBp: Math.round(costBp * 10) / 10,
      effectiveSpread: Math.round(effectiveSpread * 10000) / 100,
      hidingRatio: 0.5, // Simplified
      arrivalPrice,
      executionPrice: trade.price,
      priceImprovement: Math.round(priceImprovement * 10000) / 100,
      venue: 'FUTU',
    };
  }

  // ── Pre-Trade Estimate ──────────────────────────────────────────────

  estimatePreTrade(
    symbol: string,
    side: 'BUY' | 'SELL',
    quantity: number,
    price: number,
    orderType: 'market' | 'limit' | 'stop' = 'market'
  ): PreTradeEstimate {
    const notional = quantity * price;
    const spread = this.config.avgSpread ?? 0.0005;
    const vol = this.getDailyVol(symbol, this.config.volRegime);

    // Commission
    const baseComm = notional * this.config.commissionRate;
    const commission = Math.max(this.config.minCommission, baseComm);
    const stampDuty = side === 'SELL' ? notional * this.config.stampDutyRate : 0;
    const exchangeLevy = notional * this.config.exchangeLevy;
    const fixedCosts = commission + stampDuty + exchangeLevy;

    // Slippage estimate (larger for market orders)
    const slippageMultiplier = orderType === 'market' ? 1.0 : 0.2;
    const slippage = notional * spread * 0.5 * slippageMultiplier;

    // Market impact estimate
    const marketImpact = this.calcMarketImpact(notional, price, spread) * slippageMultiplier;

    // Break-even: price must move this much to cover costs
    const totalCostEstimate = fixedCosts + slippage + marketImpact;
    const breakEvenMove = totalCostEstimate / quantity;
    const minProfitPct = totalCostEstimate / notional;

    return {
      expectedCost: Math.round(totalCostEstimate * 100) / 100,
      costBp: Math.round((totalCostEstimate / notional) * 10000 * 10) / 10,
      marketImpact: Math.round(marketImpact * 100) / 100,
      slippage: Math.round(slippage * 100) / 100,
      breakEvenMove: Math.round(breakEvenMove * 100) / 100,
      minProfitPct: Math.round(minProfitPct * 10000) / 100,
    };
  }

  // ── Batch TCA ───────────────────────────────────────────────────────

  analyzeBatch(trades: TradeEvent[], midPrices?: Map<string, number>): TCAResult[] {
    return trades.map(t => this.analyze(t, midPrices?.get(t.symbol)));
  }

  // ── Cost Summary ────────────────────────────────────────────────────

  summarizeBatch(results: TCAResult[]): {
    totalNetPnL: number;
    totalCosts: number;
    avgCostBp: number;
    winRate: number;
    profitPerTrade: number;
  } {
    if (results.length === 0) {
      return { totalNetPnL: 0, totalCosts: 0, avgCostBp: 0, winRate: 0, profitPerTrade: 0 };
    }

    const totalNetPnL = results.reduce((s, r) => s + r.netPnL, 0);
    const totalCosts = results.reduce((s, r) => s + r.totalCosts, 0);
    const avgCostBp = results.reduce((s, r) => s + r.costBp, 0) / results.length;
    const wins = results.filter(r => r.netPnL > 0).length;
    const winRate = wins / results.length;
    const profitPerTrade = totalNetPnL / results.length;

    return {
      totalNetPnL: Math.round(totalNetPnL * 100) / 100,
      totalCosts: Math.round(totalCosts * 100) / 100,
      avgCostBp: Math.round(avgCostBp * 10) / 10,
      winRate: Math.round(winRate * 10000) / 100,
      profitPerTrade: Math.round(profitPerTrade * 100) / 100,
    };
  }

  // ── Private Helpers ─────────────────────────────────────────────────

  private getDailyVol(symbol: string, regime: TCAConfig['volRegime']): number {
    // Simplified vol from regime
    const baseVol: Record<string, number> = {
      low: 0.008,      // 0.8% daily
      normal: 0.015,   // 1.5%
      high: 0.030,     // 3.0%
    };
    return baseVol[regime] ?? 0.015;
  }

  private calcMarketImpact(notional: number, price: number, spread: number): number {
    const { impactCoeff } = this.config;
    // Almgren-Chriss style: impact ∝ participation rate × vol
    // impact ≈ λ × participation_rate × price
    // participation = notional / (daily_volume_estimate)
    // Assume daily volume = 10% of market cap
    const dailyVolumeEst = price * 1000000; // Simplified
    const participation = notional / dailyVolumeEst;
    const vol = this.getDailyVol('', 'normal');
    const impact = impactCoeff * participation * vol * price;
    return impact * spread * 10; // Scale to realistic range
  }

  getConfig(): TCAConfig {
    return { ...this.config };
  }
}

// ── Singleton ─────────────────────────────────────────────────────────────

let instance: TransactionCostAnalyzer | null = null;

export function getTCA(): TransactionCostAnalyzer {
  if (!instance) instance = new TransactionCostAnalyzer();
  return instance;
}

export default TransactionCostAnalyzer;
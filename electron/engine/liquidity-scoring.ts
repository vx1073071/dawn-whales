// ── Q58: Liquidity Scoring Engine ────────────────────────────────────────────────
// Liquidity score 0-100 + Trading urgency classification + Market impact estimation
// ADV-based tiering + Order book depth analysis + VWAP deviation scoring

import log from 'electron-log';

// ── Types ──────────────────────────────────────────────────────────────────

export type LiquidityTier = 'TIER1' | 'TIER2' | 'TIER3' | 'TIER4' | 'ILLIQUID';
export type TradingUrgency = 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';

export interface LiquidityScore {
  symbol: string;
  overallScore: number;     // 0-100 (higher = more liquid)
  tier: LiquidityTier;
  urgency: TradingUrgency;

  // Components
  advScore: number;         // ADV score 0-25
  spreadScore: number;      // Bid-ask spread score 0-25
  depthScore: number;       // Order book depth score 0-25
  impactScore: number;      // Market impact score 0-25

  // Metrics
  adv: number;              // Average daily volume
  advHKD: number;
  avgSpreadBps: number;
  bidAskSpreadBps: number;
  marketImpactBps: number;  // Expected impact per 1% ADV traded
  liquidationDays: number;   // Days to liquidate full position
  priceRevertBps: number;  // Expected price reversion after trade

  // Trading recommendations
  maxOrderPctADV: number;  // Max order as % of ADV
  optimalAlgo: 'VWAP' | 'TWAP' | 'POV' | 'IS' | 'ADAPTIVE';
  urgencyNote: string;
  timestamp: number;
}

export interface LiquidityScreening {
  criteria: {
    minScore: number;
    minADV?: number;
    maxSpreadBps?: number;
    allowedTiers?: LiquidityTier[];
  };
  candidates: Array<{
    symbol: string;
    score: number;
    tier: LiquidityTier;
    reason: string;
  }>;
  recommendation: string;
}

// ── Liquidity Scoring Engine ─────────────────────────────────────────────

export class LiquidityScoringEngine {
  constructor() {
    log.info('[LiquidityScoringEngine] Initialized');
  }

  // ── Score Symbol ─────────────────────────────────────────────────

  score(
    symbol: string,
    adv: number,           // Shares per day (30-day avg)
    price: number,        // Current price HKD
    bidAskSpread: number, // Spread in price units
    bidDepth: number,     // Bid side depth (shares)
    askDepth: number,     // Ask side depth (shares)
    avgDailyValue: number // ADV in HKD
  ): LiquidityScore {
    const advHKD = avgDailyValue;

    // ADV score (0-25): higher ADV = more liquid
    // Tier 1: >50M HKD/day → 25, Tier 5: <1M → 5
    const advScore = Math.min(25, Math.max(0,
      advHKD > 50_000_000 ? 25 :
        advHKD > 10_000_000 ? 20 :
          advHKD > 5_000_000 ? 15 :
            advHKD > 1_000_000 ? 10 : 5
    ));

    // Spread score (0-25): tighter spread = more liquid
    const spreadBps = (bidAskSpread / price) * 10000;
    const spreadScore = Math.min(25, Math.max(0,
      spreadBps < 5 ? 25 :
        spreadBps < 10 ? 22 :
          spreadBps < 20 ? 18 :
            spreadBps < 50 ? 12 :
              spreadBps < 100 ? 6 : 2
    ));

    // Depth score (0-25): depth relative to ADV
    const totalDepth = bidDepth + askDepth;
    const depthRatio = totalDepth / Math.max(adv, 1);
    const depthScore = Math.min(25, Math.max(0,
      depthRatio > 5 ? 25 :
        depthRatio > 2 ? 20 :
          depthRatio > 1 ? 15 :
            depthRatio > 0.5 ? 10 : 5
    ));

    // Market impact score (0-25): inverse of expected impact
    // Kyle's lambda: impact ≈ 0.1 * (trade_size / ADV)
    const impactPerPctADV = 0.1; // Kyle's lambda (simplified)
    const impactBps = impactPerPctADV * 100; // bps per 100% ADV
    const marketImpactBps = impactBps;
    const impactScore = Math.min(25, Math.max(0,
      impactBps < 5 ? 25 :
        impactBps < 10 ? 20 :
          impactBps < 20 ? 15 :
            impactBps < 50 ? 8 : 3
    ));

    // Overall score
    const overallScore = Math.round(advScore + spreadScore + depthScore + impactScore);

    // Tier
    let tier: LiquidityTier;
    if (overallScore >= 90) tier = 'TIER1';
    else if (overallScore >= 75) tier = 'TIER2';
    else if (overallScore >= 60) tier = 'TIER3';
    else if (overallScore >= 40) tier = 'TIER4';
    else tier = 'ILLIQUID';

    // Urgency
    let urgency: TradingUrgency;
    let urgencyNote: string;
    if (advHKD < 1_000_000) {
      urgency = 'CRITICAL';
      urgencyNote = 'Ultra-thin ADV — avoid large orders, use dark pools';
    } else if (advHKD < 5_000_000) {
      urgency = 'HIGH';
      urgencyNote = 'Low liquidity — split orders over multiple days';
    } else if (advHKD < 20_000_000) {
      urgency = 'NORMAL';
      urgencyNote = 'Moderate liquidity — standard VWAP/TWAP';
    } else {
      urgency = 'LOW';
      urgencyNote = 'High liquidity — aggressive execution possible';
    }

    // Days to liquidate
    const liquidationDays = advHKD > 0
      ? Math.ceil(100_000_000 / advHKD * 10) / 10  // Assume 100M HKD position
      : 999;

    // Price reversion (Almgren-Chriss)
    const priceRevertBps = impactBps * 0.5; // Half the impact reverts

    // Max order as % of ADV
    const maxOrderPctADV = Math.max(5, Math.min(50, (10 - tier === 'TIER1' ? 0 : tier === 'TIER2' ? 10 : tier === 'TIER3' ? 20 : 30)));

    // Optimal algo
    let optimalAlgo: LiquidityScore['optimalAlgo'];
    if (urgency === 'CRITICAL') optimalAlgo = 'ADAPTIVE';
    else if (urgency === 'HIGH') optimalAlgo = 'TWAP';
    else if (tier === 'TIER1') optimalAlgo = 'VWAP';
    else if (tier === 'TIER2') optimalAlgo = 'POV';
    else optimalAlgo = 'IS';

    return {
      symbol,
      overallScore,
      tier,
      urgency,
      advScore: Math.round(advScore * 10) / 10,
      spreadScore: Math.round(spreadScore * 10) / 10,
      depthScore: Math.round(depthScore * 10) / 10,
      impactScore: Math.round(impactScore * 10) / 10,
      adv,
      advHKD: Math.round(advHKD * 100) / 100,
      avgSpreadBps: Math.round(spreadBps * 10) / 10,
      bidAskSpreadBps: Math.round(spreadBps * 10) / 10,
      marketImpactBps: Math.round(marketImpactBps * 10) / 10,
      liquidationDays: Math.round(liquidationDays * 10) / 10,
      priceRevertBps: Math.round(priceRevertBps * 10) / 10,
      maxOrderPctADV: Math.round(maxOrderPctADV * 10) / 10,
      optimalAlgo,
      urgencyNote,
      timestamp: Date.now(),
    };
  }

  // ── Score from Market Data ────────────────────────────────────────

  scoreFromMarketData(
    symbol: string,
    price: number,
    orderBook: { bidQty: number; askQty: number; bidPrice: number; askPrice: number },
    trades: Array<{ price: number; volume: number; timestamp: number }>,
    days = 30
  ): LiquidityScore {
    const spread = orderBook.askPrice - orderBook.bidPrice;
    const totalBidDepth = orderBook.bidQty;
    const totalAskDepth = orderBook.askQty;
    const avgVolume = trades.reduce((s, t) => s + t.volume, 0) / Math.max(trades.length, 1) * days;
    const avgValue = avgVolume * price;

    return this.score(
      symbol, avgVolume, price, spread,
      totalBidDepth, totalAskDepth, avgValue
    );
  }

  // ── Screen Candidates ─────────────────────────────────────────────

  screen(
    symbols: Array<{ symbol: string; adv: number; price: number; spread: number; depth: number }>,
    criteria: LiquidityScreening['criteria']
  ): LiquidityScreening {
    const scored = symbols.map(s => {
      const score = this.score(s.symbol, s.adv, s.price, s.spread, s.depth, s.depth * 0.9, s.adv * s.price);
      let reason = '';
      if (score.overallScore >= criteria.minScore) reason = 'Passes minimum liquidity threshold';
      else if (score.urgency === 'CRITICAL') reason = 'Too illiquid — avoid';
      else reason = `Score ${score.overallScore} below minimum ${criteria.minScore}`;

      return {
        symbol: s.symbol,
        score: score.overallScore,
        tier: score.tier,
        reason,
      };
    });

    const passed = scored.filter(s => s.score >= criteria.minScore);

    return {
      criteria,
      candidates: scored,
      recommendation: passed.length > 0
        ? `${passed.length}/${symbols.length} candidates pass liquidity screen`
        : 'No candidates meet liquidity criteria',
    };
  }

  // ── Impact Estimate ───────────────────────────────────────────────

  estimateImpact(
    symbol: string,
    tradeValueHKD: number,
    advHKD: number,
    participationRate = 0.2 // % of ADV to trade
  ): { estimatedImpactBps: number; estimatedCostHKD: number; recommendation: string } {
    const KyleLambda = 0.1; // HK stock average
    const tradeSizePctADV = (tradeValueHKD / advHKD) * participationRate;
    const impactBps = KyleLambda * tradeSizePctADV * 100;
    const costHKD = tradeValueHKD * impactBps / 10000;

    let recommendation: string;
    if (impactBps < 5) recommendation = '✅ Low impact — execute normally';
    else if (impactBps < 15) recommendation = '⚠️ Moderate impact — consider algo execution';
    else recommendation = '🚨 High impact — split over multiple days';

    return {
      estimatedImpactBps: Math.round(impactBps * 10) / 10,
      estimatedCostHKD: Math.round(costHKD * 100) / 100,
      recommendation,
    };
  }
}

export default LiquidityScoringEngine;
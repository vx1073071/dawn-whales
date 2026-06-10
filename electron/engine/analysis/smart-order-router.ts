// ── Q63: Smart Order Router ─────────────────────────────────────────────────
// Optimal order execution routing based on market microstructure
// Venue selection + Smart routing algorithm + Liquidity aggregation + Fill optimization

import log from 'electron-log';

// ── Types ──────────────────────────────────────────────────────────────────

export type OrderRouterAlgo = 'VWAP' | 'TWAP' | 'POV' | 'IS' | 'ADAPTIVE' | 'GHOST' | 'SIDECAR';
export type OrderSide = 'BUY' | 'SELL';
export type Venue = 'FUTU_HK' | 'FUTU_US' | 'MOOMOO' | 'MOMENT' | 'DARK_POOL' | 'LIGHTPOOL';

export interface VenueQuote {
  venue: Venue;
  bidPrice: number;
  askPrice: number;
  bidSize: number;
  askSize: number;
  latencyUs: number;          // Microseconds
  feeRate: number;           // bps
  rebateBps: number;          // Maker rebate
  reliabilityScore: number;   // 0-1
}

export interface RoutingDecision {
  symbol: string;
  side: OrderSide;
  algo: OrderRouterAlgo;
  totalQuantity: number;
  estimatedCost: number;      // HKD total cost
  estimatedSlippage: number;  // bps
  venues: Array<{
    venue: Venue;
    quantity: number;
    participationRate: number;
    expectedFillRate: number;
    cost: number;
    startTime: string;
    endTime: string;
  }>;
  darkPoolCandidates: Venue[];
  executionWindow: number;    // minutes
  recommendation: string;
  timestamp: number;
}

export interface RouteOptimization {
  symbol: string;
  quantity: number;
  side: OrderSide;
  benchmarkPrice: number;
  deadline: string;           // ISO timestamp

  // Optimal venues
  primaryVenue: Venue;
  darkVenue: Venue | null;
  backupVenue: Venue;

  // Algo selection
  selectedAlgo: OrderRouterAlgo;
  algoParams: Record<string, number>;
  participationRate: number;

  // Cost breakdown
  costs: {
    commission: number;
    exchangeFee: number;
    clearingFee: number;
    slippage: number;
    marketImpact: number;
    opportunityCost: number;
    total: number;
  };

  // Comparison vs naive routing
  savings: number;            // vs send-all-to-primary
  savingsBps: number;
  timestamp: number;
}

// ── Venue Score ─────────────────────────────────────────────────────────

function scoreVenue(
  venue: VenueQuote,
  side: OrderSide,
  orderSize: number,
  urgency: number              // 0-1 (higher = more urgent)
): number {
  // Spread score (wider = worse)
  const spread = venue.askPrice - venue.bidPrice;
  const spreadBps = (spread / venue.bidPrice) * 10000;
  const spreadScore = Math.max(0, 25 - spreadBps * 2);

  // Depth score
  const depth = side === 'BUY' ? venue.askSize : venue.bidSize;
  const depthScore = Math.min(25, depth / 1000 * 5);

  // Latency score
  const latencyScore = Math.max(0, 25 - venue.latencyUs / 1000);

  // Fee score
  const feeScore = Math.max(0, 25 - venue.feeRate * 5);

  // Reliability score
  const reliabilityScore = venue.reliabilityScore * 25;

  // Urgency modifier: urgent orders prioritize speed over cost
  const costWeight = (1 - urgency) * 0.5;
  const speedWeight = urgency * 0.5;

  return spreadScore * costWeight + depthScore * 0.25 +
    latencyScore * speedWeight + feeScore * 0.15 + reliabilityScore * 0.1;
}

// ── Smart Order Router ─────────────────────────────────────────────────

export class SmartOrderRouter {
  constructor() {
    log.info('[SmartOrderRouter] Initialized');
  }

  // ── Route Order ─────────────────────────────────────────────────────

  route(
    symbol: string,
    side: OrderSide,
    quantity: number,
    venues: VenueQuote[],
    algo: OrderRouterAlgo = 'ADAPTIVE',
    urgency: number = 0.5,     // 0 = patient, 1 = aggressive
    timeLimit: number = 60     // minutes
  ): RoutingDecision {
    log.info(`[SmartOrderRouter] Routing ${side} ${quantity} ${symbol} via ${algo}`);

    if (venues.length === 0) {
      return this.emptyDecision(symbol, side, quantity, algo);
    }

    // Score venues
    const scored = venues.map(v => ({
      ...v,
      score: scoreVenue(v, side, quantity, urgency),
    })).sort((a, b) => b.score - a.score);

    const primary = scored[0];
    const backup = scored[1] ?? scored[0];

    // Dark pool candidates
    const darkPools = venues.filter(v =>
      v.venue === 'DARK_POOL' || v.venue === 'LIGHTPOOL'
    ).sort((a, b) => b.score - a.score);

    // Split quantities based on algo
    let primaryQty, darkQty, backupQty: number;
    const isAggressive = urgency > 0.6;

    if (isAggressive) {
      primaryQty = quantity * 0.7;
      darkQty = quantity * 0.2;
      backupQty = quantity * 0.1;
    } else {
      primaryQty = quantity * 0.5;
      darkQty = quantity * 0.35;
      backupQty = quantity * 0.15;
    }

    // VWAP: slice over time
    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + timeLimit * 60000);
    const sliceInterval = algo === 'TWAP' ? timeLimit / 10 : timeLimit / 20;

    const venuePlan = [
      {
        venue: primary.venue,
        quantity: primaryQty,
        participationRate: Math.min(0.1, primaryQty / quantity),
        expectedFillRate: primary.venue === 'DARK_POOL' ? 0.4 : 0.85,
        cost: primaryQty * primary.askPrice * (primary.feeRate / 10000 + 0.0001),
        startTime: startTime.toISOString(),
        endTime: new Date(startTime.getTime() + sliceInterval * 60000).toISOString(),
      },
    ];

    if (darkPools.length > 0) {
      venuePlan.push({
        venue: darkPools[0].venue,
        quantity: darkQty,
        participationRate: 0.05,
        expectedFillRate: 0.4,
        cost: darkQty * (darkPools[0].bidPrice + darkPools[0].askPrice) / 2 * (darkPools[0].feeRate / 10000),
        startTime: startTime.toISOString(),
        endTime: new Date(startTime.getTime() + timeLimit * 60000).toISOString(),
      });
    }

    if (backup) {
      venuePlan.push({
        venue: backup.venue,
        quantity: backupQty,
        participationRate: 0.05,
        expectedFillRate: backup.venue === 'DARK_POOL' ? 0.35 : 0.8,
        cost: backupQty * backup.askPrice * (backup.feeRate / 10000 + 0.0001),
        startTime: new Date(startTime.getTime() + sliceInterval * 30000).toISOString(),
        endTime: endTime.toISOString(),
      });
    }

    // Estimated costs
    const estimatedSlippage = isAggressive ? 5 + urgency * 15 : 2 + urgency * 8;
    const estimatedCost = venuePlan.reduce((s, v) => s + v.cost, 0) +
      quantity * primary.askPrice * estimatedSlippage / 10000;

    let recommendation: string;
    if (urgency > 0.8) recommendation = '⚡ Aggressive — immediate fill via primary + dark pool';
    else if (urgency > 0.5) recommendation = '📊 Balanced — mix primary/depth with moderate speed';
    else recommendation = '🐢 Patient — maximize dark pool usage, minimize market impact';

    return {
      symbol, side, algo: algo as OrderRouterAlgo,
      totalQuantity: quantity,
      estimatedCost: Math.round(estimatedCost * 100) / 100,
      estimatedSlippage: Math.round(estimatedSlippage * 10) / 10,
      venues: venuePlan,
      darkPoolCandidates: darkPools.map(d => d.venue),
      executionWindow: timeLimit,
      recommendation,
      timestamp: Date.now(),
    };
  }

  // ── Optimize Route ───────────────────────────────────────────────────

  optimize(
    symbol: string,
    quantity: number,
    side: OrderSide,
    benchmarkPrice: number,
    deadline: string,
    venues: VenueQuote[]
  ): RouteOptimization {
    const baseRouting = this.route(symbol, side, quantity, venues, 'ADAPTIVE', 0.5, 60);
    const primary = baseRouting.venues[0];

    // Cost breakdown
    const commission = quantity * benchmarkPrice * 0.001; // 0.1% typical
    const exchangeFee = quantity * benchmarkPrice * 0.0005;
    const clearingFee = quantity * benchmarkPrice * 0.0002;
    const slippage = quantity * benchmarkPrice * baseRouting.estimatedSlippage / 10000;
    const marketImpact = quantity * benchmarkPrice * 0.0005; // Half spread typical
    const opportunityCost = quantity * benchmarkPrice * 0.0001;

    const total = commission + exchangeFee + clearingFee + slippage + marketImpact + opportunityCost;

    // Savings vs naive (all to primary at market)
    const naiveCost = quantity * benchmarkPrice * (primary?.venues[0]?.cost ?? 0) / (primary?.venues[0]?.quantity ?? 1);
    const savings = Math.max(0, naiveCost - total);
    const savingsBps = benchmarkPrice > 0 ? (savings / (quantity * benchmarkPrice)) * 10000 : 0;

    // Algo params
    const algoParams: Record<string, number> = {
      participationRate: 0.1,
      darkPoolRatio: baseRouting.darkPoolCandidates.length > 0 ? 0.3 : 0,
      urgencyThreshold: 0.7,
      maxVenueLatency: 5000,
    };

    return {
      symbol, quantity, side, benchmarkPrice, deadline,
      primaryVenue: (primary?.venue as Venue) ?? 'FUTU_HK',
      darkVenue: baseRouting.darkPoolCandidates[0] ?? null,
      backupVenue: (primary?.venue as Venue) ?? 'MOOMOO',
      selectedAlgo: 'ADAPTIVE',
      algoParams,
      participationRate: 0.1,
      costs: {
        commission: Math.round(commission * 100) / 100,
        exchangeFee: Math.round(exchangeFee * 100) / 100,
        clearingFee: Math.round(clearingFee * 100) / 100,
        slippage: Math.round(slippage * 100) / 100,
        marketImpact: Math.round(marketImpact * 100) / 100,
        opportunityCost: Math.round(opportunityCost * 100) / 100,
        total: Math.round(total * 100) / 100,
      },
      savings: Math.round(savings * 100) / 100,
      savingsBps: Math.round(savingsBps * 10) / 10,
      timestamp: Date.now(),
    };
  }

  private emptyDecision(
    symbol: string, side: OrderSide, quantity: number, algo: OrderRouterAlgo
  ): RoutingDecision {
    return {
      symbol, side, algo, totalQuantity: quantity,
      estimatedCost: 0, estimatedSlippage: 0,
      venues: [], darkPoolCandidates: [],
      executionWindow: 0, recommendation: 'No venues available', timestamp: Date.now(),
    };
  }
}

export default SmartOrderRouter;
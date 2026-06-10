// ── Q31: Market Microstructure Analyzer ──────────────────────────────────────
// Order flow imbalance + VPIN + Roll model + Amihud illiquidity + Spread decomposition
// Intraday microstructure metrics for HFT/liquidity analysis

import log from 'electron-log';

// ── Types ──────────────────────────────────────────────────────────────────

export interface TickData {
  timestamp: number;
  price: number;
  volume: number;
  bidPrice?: number;
  askPrice?: number;
  bidSize?: number;
  askSize?: number;
  direction?: 'BUY' | 'SELL' | 'UNKNOWN';  // Trade direction
}

export interface OrderFlowMetrics {
  vpin: number;              // Volume-synchronized Probability of Informed Trading
  ofi: number;               // Order Flow Imbalance
  buyVolume: number;
  sellVolume: number;
  tradeIntensity: number;    // Trades per second
  volumeWeight: number;      // Volume imbalance ratio
}

export interface SpreadMetrics {
  quotedSpread: number;       // Ask - Bid
  effectiveSpread: number;    // 2 × |trade price - midpoint|
  realizedSpread: number;     // Effective - Adverse selection
  priceImpact: number;       // Part of spread due to info asymmetry
  informationAsymmetry: number;
  spreadDecomposition: {
    orderProcessingCost: number;
    adverseSelectionCost: number;
    inventoryCost: number;
  };
}

export interface RollModel {
  roll: number;              // Roll spread estimator
  rollImpliedSpread: number; // 2 × sqrt(-covariance)
  serialCovariance: number;
  tradeDirection: 'up' | 'down' | 'uncertain';
  priceImpact: number;        // per unit volume
}

export interface AmihudIlliquidity {
  illiquidity: number;        // |return| / volume (price impact per dollar)
  tradingReluctance: number;  // Volume needed to move price 1%
  marketDepthProxy: number;   // Inverse of illiquidity
  regime: 'LIQUID' | 'NORMAL' | 'ILLIQUID';
}

export interface MicrostructureReport {
  symbol: string;
  period: { start: number; end: number };
  nTicks: number;

  // Order flow
  orderFlow: OrderFlowMetrics;

  // Spread
  spread: SpreadMetrics;

  // Roll model
  rollModel: RollModel;

  // Illiquidity
  amihud: AmihudIlliquidity;

  // Summary
  estimatedMarketImpact: number;
  liquidityScore: number;   // 0-100
  recommendations: string[];
  timestamp: number;
}

// ── Helpers ─────────────────────────────────────────────────────────────

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length);
}

// ── VPIN Calculation ──────────────────────────────────────────────────────

function calcVPIN(ticks: TickData[], bucketSize = 50): number {
  const n = ticks.length;
  if (n < bucketSize * 2) return 0.5; // Neutral

  const buyVolumes: number[] = [];
  const sellVolumes: number[] = [];

  for (let i = 0; i < Math.floor(n / bucketSize); i++) {
    let bv = 0, sv = 0;
    const start = i * bucketSize;
    for (let j = start; j < start + bucketSize && j < n; j++) {
      const t = ticks[j];
      const vol = t.volume;
      if (t.direction === 'BUY') bv += vol;
      else if (t.direction === 'SELL') sv += vol;
      else {
        // Undefined: use mid-point direction
        if (t.price >= (t.bidPrice! + t.askPrice!) / 2) bv += vol;
        else sv += vol;
      }
    }
    buyVolumes.push(bv);
    sellVolumes.push(sv);
  }

  const vpinValues = buyVolumes.map((bv, i) =>
    Math.abs(bv - sellVolumes[i]) / (bv + sellVolumes[i] + 1e-9)
  );

  return vpinValues.reduce((a, b) => a + b, 0) / vpinValues.length;
}

// ── Order Flow Imbalance ─────────────────────────────────────────────────

function calcOFI(ticks: TickData[]): OrderFlowMetrics {
  let buyVolume = 0, sellVolume = 0;
  let ofi = 0;
  const midPrices: number[] = [];

  for (const t of ticks) {
    midPrices.push(t.price);
    const vol = t.volume;
    if (t.direction === 'BUY') {
      buyVolume += vol;
      ofi += vol;
    } else if (t.direction === 'SELL') {
      sellVolume += vol;
      ofi -= vol;
    } else {
      // Infer from tick rule
      if (t.price > (midPrices[midPrices.length - 2] ?? t.price)) {
        buyVolume += vol; ofi += vol;
      } else if (t.price < (midPrices[midPrices.length - 2] ?? t.price)) {
        sellVolume += vol; ofi -= vol;
      }
    }
  }

  const durationSec = ticks.length > 1
    ? (ticks[ticks.length - 1].timestamp - ticks[0].timestamp) / 1000
    : 1;
  const tradeIntensity = ticks.length / Math.max(durationSec, 1);
  const totalVol = buyVolume + sellVolume;
  const volumeWeight = totalVol > 0 ? (buyVolume - sellVolume) / totalVol : 0;

  return {
    vpin: calcVPIN(ticks),
    ofi: Math.round(ofi * 100) / 100,
    buyVolume: Math.round(buyVolume * 100) / 100,
    sellVolume: Math.round(sellVolume * 100) / 100,
    tradeIntensity: Math.round(tradeIntensity * 100) / 100,
    volumeWeight: Math.round(volumeWeight * 10000) / 100,
  };
}

// ── Spread Decomposition ────────────────────────────────────────────────

function calcSpreadMetrics(ticks: TickData[]): SpreadMetrics {
  const midPrices: number[] = ticks.map(t =>
    t.bidPrice !== undefined && t.askPrice !== undefined
      ? (t.bidPrice + t.askPrice) / 2
      : t.price
  );

  const spreads: number[] = ticks
    .filter(t => t.bidPrice !== undefined && t.askPrice !== undefined)
    .map(t => t.askPrice! - t.bidPrice!);

  const quotedSpread = spreads.length > 0 ? median(spreads) : 0;

  const effectiveSpreads: number[] = ticks
    .filter(t => t.bidPrice !== undefined && t.askPrice !== undefined)
    .map((t, i) => 2 * Math.abs(t.price - midPrices[i]));

  const effectiveSpread = effectiveSpreads.length > 0 ? median(effectiveSpreads) : quotedSpread;

  // Roll model realized spread
  const returns = midPrices.slice(1).map((p, i) => p - midPrices[i]);
  const serialCov = returns.length > 1 ? stdDev(returns.slice(0, -1) as any) : 0;

  const rollSpread = 2 * Math.sqrt(Math.max(0, -serialCov));
  const priceImpact = rollSpread / 2;
  const adverseSelection = effectiveSpread - priceImpact;

  // Decomposition
  const orderProcessingCost = priceImpact * 0.4;
  const inventoryCost = priceImpact * 0.3;
  const adverseSelectionCost = priceImpact * 0.3 + Math.max(0, adverseSelection);

  return {
    quotedSpread: Math.round(quotedSpread * 10000) / 10000,
    effectiveSpread: Math.round(effectiveSpread * 10000) / 10000,
    realizedSpread: Math.round((effectiveSpread - adverseSelection) * 10000) / 10000,
    priceImpact: Math.round(priceImpact * 10000) / 10000,
    informationAsymmetry: Math.round(adverseSelection * 10000) / 10000,
    spreadDecomposition: {
      orderProcessingCost: Math.round(orderProcessingCost * 10000) / 10000,
      adverseSelectionCost: Math.round(adverseSelectionCost * 10000) / 10000,
      inventoryCost: Math.round(inventoryCost * 10000) / 10000,
    },
  };
}

// ── Roll Model ──────────────────────────────────────────────────────────

function calcRollModel(prices: number[]): RollModel {
  const n = prices.length;
  if (n < 5) {
    return { roll: 0, rollImpliedSpread: 0, serialCovariance: 0, tradeDirection: 'uncertain', priceImpact: 0 };
  }

  const returns: number[] = [];
  for (let i = 1; i < n; i++) returns.push(prices[i] - prices[i - 1]);

  // Serial covariance of returns
  const meanRet = returns.reduce((a, b) => a + b, 0) / returns.length;
  let cov = 0;
  for (let i = 1; i < returns.length; i++) {
    cov += (returns[i] - meanRet) * (returns[i - 1] - meanRet);
  }
  cov /= Math.max(1, returns.length - 1);

  const roll = 2 * Math.sqrt(Math.max(0, -cov));
  const rollImpliedSpread = 2 * roll;
  const priceImpact = roll / 2;

  const lastReturn = returns[returns.length - 1];
  const tradeDirection: RollModel['tradeDirection'] = lastReturn > 0 ? 'up' : lastReturn < 0 ? 'down' : 'uncertain';

  return {
    roll: Math.round(roll * 10000) / 10000,
    rollImpliedSpread: Math.round(rollImpliedSpread * 10000) / 10000,
    serialCovariance: Math.round(cov * 10000) / 10000,
    tradeDirection,
    priceImpact: Math.round(priceImpact * 10000) / 10000,
  };
}

// ── Amihud Illiquidity ───────────────────────────────────────────────────

function calcAmihud(ticks: TickData[]): AmihudIlliquidity {
  const returns: number[] = [];
  const volumes: number[] = [];

  for (let i = 1; i < ticks.length; i++) {
    const ret = Math.abs(ticks[i].price - ticks[i - 1].price) / ticks[i - 1].price;
    returns.push(ret);
    volumes.push(ticks[i].volume);
  }

  if (returns.length === 0) {
    return { illiquidity: 0, tradingReluctance: 0, marketDepthProxy: 0, regime: 'NORMAL' };
  }

  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;

  // Amihud ratio: |return| / volume
  const illiquidity = avgVolume > 0 ? avgReturn / avgVolume : 0;
  const tradingReluctance = avgReturn > 0 ? 1 / (illiquidity + 1e-9) : 0;
  const marketDepthProxy = 1 / (illiquidity + 1e-9);

  let regime: AmihudIlliquidity['regime'];
  if (illiquidity < 0.001) regime = 'LIQUID';
  else if (illiquidity < 0.01) regime = 'NORMAL';
  else regime = 'ILLIQUID';

  return {
    illiquidity: Math.round(illiquidity * 1e8) / 1e8,
    tradingReluctance: Math.round(tradingReluctance * 100) / 100,
    marketDepthProxy: Math.round(marketDepthProxy * 100) / 100,
    regime,
  };
}

// ── Main Entry ─────────────────────────────────────────────────────────────

export function analyzeMicrostructure(
  symbol: string,
  ticks: TickData[]
): MicrostructureReport {
  log.info(`[Microstructure] Analyzing ${ticks.length} ticks for ${symbol}`);

  if (ticks.length === 0) {
    return emptyReport(symbol);
  }

  const prices = ticks.map(t => t.price);
  const orderFlow = calcOFI(ticks);
  const spread = calcSpreadMetrics(ticks);
  const rollModel = calcRollModel(prices);
  const amihud = calcAmihud(ticks);

  // Estimate market impact (per 1000 shares)
  const priceMove = Math.abs(prices[prices.length - 1] - prices[0]);
  const avgVol = ticks.reduce((s, t) => s + t.volume, 0) / ticks.length;
  const estImpact = avgVol > 0 ? (priceMove / avgVol) * 1000 : 0;

  // Liquidity score (0-100)
  let liquidityScore = 50;
  liquidityScore -= Math.min(50, amihud.illiquidity * 10000);
  liquidityScore += Math.min(30, (spread.quotedSpread < 0.001 ? 30 : 15));
  liquidityScore = Math.max(0, Math.min(100, Math.round(liquidityScore)));

  const recommendations: string[] = [];
  if (amihud.regime === 'ILLIQUID') recommendations.push('⚠️ Illiquid conditions: reduce order size, use TWAP');
  if (spread.informationAsymmetry > spread.quotedSpread * 0.5) recommendations.push('⚠️ High adverse selection cost: informed flow detected');
  if (orderFlow.vpin > 0.6) recommendations.push('⚠️ High VPIN (>0.6): elevated informed trading risk');
  if (spread.quotedSpread > 0.005) recommendations.push('Wide spread: consider passive order placement');
  if (liquidityScore > 75) recommendations.push('✅ Liquidity is favorable for execution');

  return {
    symbol,
    period: {
      start: ticks[0].timestamp,
      end: ticks[ticks.length - 1].timestamp,
    },
    nTicks: ticks.length,
    orderFlow,
    spread,
    rollModel,
    amihud,
    estimatedMarketImpact: Math.round(estImpact * 10000) / 10000,
    liquidityScore,
    recommendations,
    timestamp: Date.now(),
  };
}

function emptyReport(symbol: string): MicrostructureReport {
  return {
    symbol,
    period: { start: 0, end: 0 },
    nTicks: 0,
    orderFlow: { vpin: 0.5, ofi: 0, buyVolume: 0, sellVolume: 0, tradeIntensity: 0, volumeWeight: 0 },
    spread: { quotedSpread: 0, effectiveSpread: 0, realizedSpread: 0, priceImpact: 0, informationAsymmetry: 0, spreadDecomposition: { orderProcessingCost: 0, adverseSelectionCost: 0, inventoryCost: 0 } },
    rollModel: { roll: 0, rollImpliedSpread: 0, serialCovariance: 0, tradeDirection: 'uncertain', priceImpact: 0 },
    amihud: { illiquidity: 0, tradingReluctance: 0, marketDepthProxy: 0, regime: 'NORMAL' },
    estimatedMarketImpact: 0,
    liquidityScore: 0,
    recommendations: ['Insufficient data for analysis'],
    timestamp: Date.now(),
  };
}

export default analyzeMicrostructure;
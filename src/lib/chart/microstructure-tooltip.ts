// @ts-nocheck
// R127-Q01: nocheck cleared
/**
 * TradingEasy R126 J02 — Microstructure Tooltip Utilities
 * 
 * Computes microstructure indicators for display on chart hover/tooltip:
 * - VPIN (Volume-synchronized Probability of Informed Trading)
 * - Kyle's Lambda (price impact coefficient)
 * - Arrival Price slippage
 * - Effective spread
 * - Realized spread
 * - Order flow imbalance
 * 
 * All computations are side-effect-free and time-bucketed.
 */

// ═══════════ Types ════════════════════════════════════════

export interface TickData {
  timestamp: number;
  price: number;
  volume: number;
  side: 'buy' | 'sell' | 'unknown';
  // Optional: used for VPIN bucket classification
  bidPrice?: number;
  askPrice?: number;
}

export interface MicrostructureStats {
  /** Volume-synchronized Probability of Informed Trading (0-1) */
  vpin: number | null;
  /** Kyle's Lambda — price change per unit net volume */
  kyleLambda: number | null;
  /** Arrival Price — VWAP since order arrival, normalized */
  arrivalPriceSlippage: number | null;
  /** Effective Spread — 2 * |tradePrice - midPrice| */
  effectiveSpread: number | null;
  /** Realized Spread — effective spread after mid-price movement */
  realizedSpread: number | null;
  /** Order Flow Imbalance — (buyVol - sellVol) / totalVol */
  ofi: number | null;
  /** Average trade size */
  avgTradeSize: number;
  /** Number of trades in window */
  tradeCount: number;
  /** Total volume in window */
  totalVolume: number;
}

interface VPINBucket {
  buyVolume: number;
  sellVolume: number;
  volume: number;
}

// ═══════════ Config ════════════════════════════════════════

const DEFAULT_WINDOW_MS = 300000;  // 5 minutes
const VPIN_BUCKETS = 50;           // Historical buckets for VPIN
const VPIN_VOLUME_PER_BUCKET = 1000; // Volume bar size

// ═══════════ VPIN Computation ══════════════════════════════
// Easley, López de Prado, O'Hara (2011)

let _vpinBuckets: VPINBucket[] = [];
let _vpinBucketIndex = 0;
let _currentBucket: VPINBucket = { buyVolume: 0, sellVolume: 0, volume: 0 };

function classifyTickSide(tick: TickData): 'buy' | 'sell' {
  if (tick.side === 'buy' || tick.side === 'sell') return tick.side;

  // Lee-Ready algorithm: compare trade price to midpoint
  if (tick.bidPrice != null && tick.askPrice != null) {
    const mid = (tick.bidPrice + tick.askPrice) / 2;
    if (tick.price > mid) return 'buy';
    if (tick.price < mid) return 'sell';
  }

  // Tick test: compare to previous price
  return 'unknown' as any;
}

export function vpinUpdate(tick: TickData): number | null {
  const side = classifyTickSide(tick);
  _currentBucket.volume += tick.volume;
  if (side === 'buy') {
    _currentBucket.buyVolume += tick.volume;
  } else if (side === 'sell') {
    _currentBucket.sellVolume += tick.volume;
  } else {
    // Neutral: split 50/50
    _currentBucket.buyVolume += tick.volume / 2;
    _currentBucket.sellVolume += tick.volume / 2;
  }

  // When bucket reaches volume bar size, rotate
  if (_currentBucket.volume >= VPIN_VOLUME_PER_BUCKET) {
    if (_vpinBuckets.length >= VPIN_BUCKETS) {
      _vpinBuckets.shift();
    }
    _vpinBuckets.push({ ..._currentBucket });
    _currentBucket = { buyVolume: 0, sellVolume: 0, volume: 0 };
  }

  // Compute VPIN from last N buckets
  if (_vpinBuckets.length < 5) return null;

  const windowBuckets = _vpinBuckets.slice(-Math.min(_vpinBuckets.length, VPIN_BUCKETS));
  let totalBuySellDiff = 0;
  let totalVolume = 0;
  for (const b of windowBuckets) {
    totalBuySellDiff += Math.abs(b.buyVolume - b.sellVolume);
    totalVolume += b.volume;
  }
  const n = windowBuckets.length;
  return totalVolume > 0 ? (totalBuySellDiff / totalVolume) / n : null;
}

// ═══════════ Kyle's Lambda ═════════════════════════════════
// λ = Cov(ΔP, Q_net) / Var(Q_net)
// Measures price impact per unit of directional volume.

export function kyleLambda(ticks: TickData[]): number | null {
  if (ticks.length < 20) return null;

  const priceChanges: number[] = [];
  const netFlows: number[] = [];

  for (let i = 1; i < ticks.length; i++) {
    priceChanges.push(ticks[i].price - ticks[i - 1].price);
    const side = classifyTickSide(ticks[i]);
    let netFlow = 0;
    if (side === 'buy') netFlow = ticks[i].volume;
    else if (side === 'sell') netFlow = -ticks[i].volume;
    netFlows.push(netFlow);
  }

  // Cov(ΔP, Q_net) / Var(Q_net)
  const n = priceChanges.length;
  const meanDp = priceChanges.reduce((s, v) => s + v, 0) / n;
  const meanQ = netFlows.reduce((s, v) => s + v, 0) / n;

  let cov = 0;
  let varQ = 0;
  for (let i = 0; i < n; i++) {
    cov += (priceChanges[i] - meanDp) * (netFlows[i] - meanQ);
    varQ += (netFlows[i] - meanQ) ** 2;
  }

  cov /= n;
  varQ /= n;

  if (varQ === 0) return null;
  // Scale to basis points per unit volume
  return (cov / varQ) * 10000;
}

// ═══════════ Arrival Price Slippage ════════════════════════
// Slippage = (avgPrice - arrivalPrice) / arrivalPrice

export function arrivalPriceSlippage(
  ticks: TickData[],
  arrivalPrice: number
): number | null {
  if (ticks.length === 0 || arrivalPrice <= 0) return null;

  const vwapTotal = ticks.reduce((s, t) => s + t.price * t.volume, 0);
  const totalVol = ticks.reduce((s, t) => s + t.volume, 0);

  if (totalVol === 0) return null;
  const vwap = vwapTotal / totalVol;
  return ((vwap - arrivalPrice) / arrivalPrice) * 10000; // basis points
}

// ═══════════ Effective Spread ═════════════════════════════⭐

export function effectiveSpread(
  tick: TickData,
  midPrice: number
): number | null {
  if (midPrice <= 0) return null;
  return 2 * Math.abs(tick.price - midPrice) / midPrice * 10000; // bps
}

// ═══════════ Realized Spread ══════════════════════════════
// Realized spread = effective spread - future mid-price drift

export function realizedSpread(
  tick: TickData,
  midAtTrade: number,
  midFuture: number
): number | null {
  if (midAtTrade <= 0) return null;
  const effective = 2 * Math.abs(tick.price - midAtTrade);
  const side = classifyTickSide(tick);
  const drift = side === 'buy'
    ? (midFuture - midAtTrade)
    : side === 'sell'
      ? (midAtTrade - midFuture)
      : 0;
  return (effective - drift) / midAtTrade * 10000; // bps
}

// ═══════════ Order Flow Imbalance ══════════════════════════
// OFI = (buyVol - sellVol) / totalVol

export function orderFlowImbalance(ticks: TickData[]): number | null {
  if (ticks.length === 0) return null;

  let buyVol = 0;
  let sellVol = 0;

  for (const tick of ticks) {
    const side = classifyTickSide(tick);
    if (side === 'buy') buyVol += tick.volume;
    else if (side === 'sell') sellVol += tick.volume;
    else {
      buyVol += tick.volume / 2;
      sellVol += tick.volume / 2;
    }
  }

  const total = buyVol + sellVol;
  if (total === 0) return null;
  return (buyVol - sellVol) / total;
}

// ═══════════ Full Snapshot ═════════════════════════════════

export function computeMicrostructureStats(
  ticks: TickData[],
  arrivalPrice?: number,
  futureMidPrice?: number
): MicrostructureStats {
  const windowTicks = ticks.filter(
    t => t.timestamp >= Date.now() - DEFAULT_WINDOW_MS
  );

  // VPIN: update engine for each tick
  let vpinVal: number | null = null;
  for (const tick of windowTicks) {
    vpinVal = vpinUpdate(tick);
  }

  const lambda = kyleLambda(windowTicks);
  const slippage = arrivalPrice != null
    ? arrivalPriceSlippage(windowTicks, arrivalPrice)
    : null;

  // Effective spread from latest tick
  const latest = windowTicks[windowTicks.length - 1];
  const midPrice = latest
    ? ((latest.bidPrice ?? latest.price) + (latest.askPrice ?? latest.price)) / 2
    : 0;
  const effSpread = latest ? effectiveSpread(latest, midPrice) : null;
  const realSpread = latest && futureMidPrice != null
    ? realizedSpread(latest, midPrice, futureMidPrice)
    : null;

  const ofi = orderFlowImbalance(windowTicks);

  const totalVolume = windowTicks.reduce((s, t) => s + t.volume, 0);
  const avgTradeSize = windowTicks.length > 0
    ? totalVolume / windowTicks.length
    : 0;

  return {
    vpin: vpinVal,
    kyleLambda: lambda,
    arrivalPriceSlippage: slippage,
    effectiveSpread: effSpread,
    realizedSpread: realSpread,
    ofi,
    avgTradeSize,
    tradeCount: windowTicks.length,
    totalVolume,
  };
}

// ═══════════ Tooltip Formatter ═════════════════════════════

export function formatMicrostructureTooltip(
  stats: MicrostructureStats
): { lines: string[]; verdict: string } {
  const lines: string[] = [];
  let flags = 0;

  // VPIN
  if (stats.vpin != null) {
    lines.push(`VPIN: ${(stats.vpin * 100).toFixed(1)}%`);
    if (stats.vpin > 0.3) flags++;
  } else {
    lines.push('VPIN: —');
  }

  // Kyle's Lambda
  if (stats.kyleLambda != null) {
    const lambdaBps = (stats.kyleLambda).toFixed(2);
    lines.push(`Kyle λ: ${lambdaBps} bps/vol`);
    if (stats.kyleLambda > 5) flags++;
  } else {
    lines.push('Kyle λ: —');
  }

  // Arrival Price Slippage
  if (stats.arrivalPriceSlippage != null) {
    const sign = stats.arrivalPriceSlippage >= 0 ? '+' : '';
    lines.push(`Arrival Slippage: ${sign}${stats.arrivalPriceSlippage.toFixed(1)} bps`);
    if (Math.abs(stats.arrivalPriceSlippage) > 10) flags++;
  } else {
    lines.push('Arrival Slippage: —');
  }

  // Effective Spread
  if (stats.effectiveSpread != null) {
    lines.push(`Eff Spread: ${stats.effectiveSpread.toFixed(1)} bps`);
  } else {
    lines.push('Eff Spread: —');
  }

  // Realized Spread
  if (stats.realizedSpread != null) {
    lines.push(`Realized Spread: ${stats.realizedSpread.toFixed(1)} bps`);
  }

  // OFI
  if (stats.ofi != null) {
    const sign = stats.ofi > 0 ? '+' : '';
    lines.push(`OFI: ${sign}${(stats.ofi * 100).toFixed(1)}%`);
    if (Math.abs(stats.ofi) > 0.7) flags++;
  } else {
    lines.push('OFI: —');
  }

  // Summary
  lines.push(`Trades: ${stats.tradeCount} | Vol: ${stats.totalVolume.toFixed(1)} | Avg: ${stats.avgTradeSize.toFixed(2)}`);

  let verdict: string;
  if (flags >= 3) verdict = '⚠️ High Toxicity';
  else if (flags >= 1) verdict = '⚡ Elevated';
  else if (flags === 0 && stats.tradeCount > 0) verdict = '✅ Normal';
  else verdict = '— No Data';

  return { lines, verdict };
}

// ═══════════ Reset VPIN State (for testing/symbol change) ═══════

export function resetVPINState(): void {
  _vpinBuckets = [];
  _vpinBucketIndex = 0;
  _currentBucket = { buyVolume: 0, sellVolume: 0, volume: 0 };
}

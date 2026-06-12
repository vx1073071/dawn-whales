// DAWN WHALES R114 QTE-11 — DepthAnalyzer Engine
// PM: 订单簿深度分析, Imbalance >0.3预测 / Wall Detection >3x / Spoofing >5x @5s
// Liquidity Score / Slippage预估 / 重构图表检测

import type { OrderBookLevel, DepthAnalysis } from './orderbook-engine';

// ═══════════ Types ═══════════

export interface SpoofEvent {
  price: number;
  size: number;
  side: 'bid' | 'ask';
  placedAt: number;
  removedAt: number;
  lifetimeMs: number;
}

export interface SlippageEstimate {
  symbol: string;
  buyPrice: number;  // avg execution price for market buy (size volume)
  sellPrice: number; // avg execution price for market sell
  buySlipPct: number;
  sellSlipPct: number;
  timestamp: number;
}

export interface DepthSnapshot {
  timestamp: number;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  imbalance: number;
}

export interface ReplayEvent {
  type: 'add' | 'remove' | 'change';
  price: number;
  size: number;
  prevSize?: number;
  side: 'bid' | 'ask';
  timestamp: number;
}

// ═══════════ Spoofing Detection ═══════════

class SpoofDetector {
  private pendingOrders: Map<string, { price: number; size: number; side: 'bid' | 'ask'; placedAt: number }> = new Map();
  private spoofEvents: SpoofEvent[] = [];
  private readonly minLifetimeMs = 500;
  private readonly maxLifetimeMs = 5000;
  private readonly sizeMultiplier = 5;

  feed(events: ReplayEvent[]): SpoofEvent[] {
    const detected: SpoofEvent[] = [];
    for (const evt of events) {
      const key = `${evt.price}:${evt.side}`;
      if (evt.type === 'add') {
        this.pendingOrders.set(key, {
          price: evt.price,
          size: evt.size,
          side: evt.side,
          placedAt: evt.timestamp,
        });
      } else if (evt.type === 'remove') {
        const pending = this.pendingOrders.get(key);
        if (pending) {
          const lifetime = evt.timestamp - pending.placedAt;
          if (
            lifetime >= this.minLifetimeMs &&
            lifetime <= this.maxLifetimeMs &&
            pending.size > this.getAvgSize(evt.side) * this.sizeMultiplier
          ) {
            const event: SpoofEvent = {
              price: pending.price,
              size: pending.size,
              side: pending.side,
              placedAt: pending.placedAt,
              removedAt: evt.timestamp,
              lifetimeMs: lifetime,
            };
            detected.push(event);
            this.spoofEvents.push(event);
          }
          this.pendingOrders.delete(key);
        }
      }
    }
    return detected;
  }

  private getAvgSize(side: 'bid' | 'ask'): number {
    const entries = Array.from(this.pendingOrders.values()).filter((o) => o.side === side);
    if (entries.length === 0) return 1;
    return entries.reduce((s, o) => s + o.size, 0) / entries.length;
  }

  windowEvents(windowMs: number): SpoofEvent[] {
    const now = Date.now();
    return this.spoofEvents.filter((e) => now - e.placedAt <= windowMs);
  }

  reset(): void {
    this.pendingOrders.clear();
    this.spoofEvents = [];
  }
}

// ═══════════ Slippage Estimator ═══════════

function estimateSlippage(
  bids: OrderBookLevel[],
  asks: OrderBookLevel[],
  orderSize: number,
  symbol: string
): SlippageEstimate {
  const bestBid = bids[0]?.price ?? 0;
  const bestAsk = asks[0]?.price ?? 0;

  // Market buy: walk up asks
  let buyRemaining = orderSize;
  let buyCost = 0;
  let buyFilled = 0;
  for (const l of asks) {
    const fill = Math.min(l.size, buyRemaining);
    buyCost += fill * l.price;
    buyFilled += fill;
    buyRemaining -= fill;
    if (buyRemaining <= 0) break;
  }
  const buyPrice = buyFilled > 0 ? buyCost / buyFilled : bestAsk;
  const buySlipPct = bestAsk > 0 ? ((buyPrice - bestAsk) / bestAsk) * 100 : 0;

  // Market sell: walk down bids
  let sellRemaining = orderSize;
  let sellRevenue = 0;
  let sellFilled = 0;
  for (const l of bids) {
    const fill = Math.min(l.size, sellRemaining);
    sellRevenue += fill * l.price;
    sellFilled += fill;
    sellRemaining -= fill;
    if (sellRemaining <= 0) break;
  }
  const sellPrice = sellFilled > 0 ? sellRevenue / sellFilled : bestBid;
  const sellSlipPct = bestBid > 0 ? ((bestBid - sellPrice) / bestBid) * 100 : 0;

  return {
    symbol,
    buyPrice: +buyPrice.toFixed(8),
    sellPrice: +sellPrice.toFixed(8),
    buySlipPct: +buySlipPct.toFixed(4),
    sellSlipPct: +sellSlipPct.toFixed(4),
    timestamp: Date.now(),
  };
}

// ═══════════ Depth History Stack ═══════════

class DepthHistoryStack {
  private snapshots: DepthSnapshot[] = [];
  private readonly maxSize: number;

  constructor(maxSize = 20) {
    this.maxSize = maxSize;
  }

  push(bids: OrderBookLevel[], asks: OrderBookLevel[], imbalance: number): void {
    this.snapshots.push({
      timestamp: Date.now(),
      bids: bids.map((l) => ({ ...l })),
      asks: asks.map((l) => ({ ...l })),
      imbalance,
    });
    if (this.snapshots.length > this.maxSize) {
      this.snapshots.shift();
    }
  }

  /** Detect imbalance shift > threshold over lookback windows */
  detectImbalanceShift(currentImbalance: number, threshold = 0.3, windowMs = 5000): boolean {
    const now = Date.now();
    for (const snap of [...this.snapshots].reverse()) {
      if (now - snap.timestamp > windowMs) break;
      if (Math.abs(currentImbalance - snap.imbalance) > threshold) return true;
    }
    return false;
  }

  /** Detect chart pattern: depth cluster build-up (accumulation before breakout) */
  detectClusterBuildUp(thresholdPct = 20): boolean {
    if (this.snapshots.length < 3) return false;
    const recent = this.snapshots.slice(-3);
    const firstVol = recent[0].bids.reduce((s, l) => s + l.size, 0) +
      recent[0].asks.reduce((s, l) => s + l.size, 0);
    const lastVol = recent[2].bids.reduce((s, l) => s + l.size, 0) +
      recent[2].asks.reduce((s, l) => s + l.size, 0);
    return firstVol > 0 && ((lastVol - firstVol) / firstVol) * 100 > thresholdPct;
  }

  last(): DepthSnapshot | undefined {
    return this.snapshots[this.snapshots.length - 1];
  }

  all(): readonly DepthSnapshot[] {
    return this.snapshots;
  }

  reset(): void {
    this.snapshots = [];
  }
}

// ═══════════ DepthAnalyzer (composite) ═══════════

export class DepthAnalyzer {
  private spoofDetector: SpoofDetector;
  private historyStack: DepthHistoryStack;
  private lastAnalysis: DepthAnalysis | null = null;

  constructor(historySize = 20) {
    this.spoofDetector = new SpoofDetector();
    this.historyStack = new DepthHistoryStack(historySize);
  }

  analyze(bids: OrderBookLevel[], asks: OrderBookLevel[]): DepthAnalysis {
    const analysis = this.computeImmediate(bids, asks);
    this.historyStack.push(bids, asks, analysis.imbalance);
    this.lastAnalysis = analysis;
    return analysis;
  }

  private computeImmediate(bids: OrderBookLevel[], asks: OrderBookLevel[]): DepthAnalysis {
    const bestBid = bids[0]?.price ?? 0;
    const bestAsk = asks[0]?.price ?? 0;
    const spread = bestAsk - bestBid;
    const mid = (bestBid + bestAsk) / 2;
    const spreadPct = mid > 0 ? (spread / mid) * 100 : 0;

    let bidVol = 0, askVol = 0;
    for (const l of bids) bidVol += l.size;
    for (const l of asks) askVol += l.size;
    const totalVol = bidVol + askVol;
    const imbalance = totalVol === 0 ? 0 : (bidVol - askVol) / totalVol;

    // Wall detection
    const avgBid = bids.length > 0 ? bidVol / bids.length : 0;
    const avgAsk = asks.length > 0 ? askVol / asks.length : 0;
    let wallBid: number | null = null, wallBidSize = 0;
    let wallAsk: number | null = null, wallAskSize = 0;
    for (const l of bids) {
      if (l.size > avgBid * 3 && l.size > wallBidSize) { wallBid = l.price; wallBidSize = l.size; }
    }
    for (const l of asks) {
      if (l.size > avgAsk * 3 && l.size > wallAskSize) { wallAsk = l.price; wallAskSize = l.size; }
    }

    const depthScore = Math.min(100, totalVol / 100_000 * 100);
    const levelScore = Math.min(100, (bids.length + asks.length) / 40 * 100);
    const sScore = spreadPct < 0.01 ? 100 : spreadPct < 0.05 ? 80 : spreadPct < 0.1 ? 60 : spreadPct < 0.5 ? 40 : 20;
    const liquidityScore = Math.round((depthScore + levelScore + sScore) / 3);

    return {
      imbalance: +imbalance.toFixed(4),
      wallBid, wallBidSize,
      wallAsk, wallAskSize,
      liquidityScore,
      spread: +spread.toFixed(8),
      spreadPct: +spreadPct.toFixed(4),
      bidDepth: bidVol,
      askDepth: askVol,
      timestamp: Date.now(),
    };
  }

  feedReplay(events: ReplayEvent[]): SpoofEvent[] {
    return this.spoofDetector.feed(events);
  }

  estimateSlippage(bids: OrderBookLevel[], asks: OrderBookLevel[], orderSize: number, symbol: string): SlippageEstimate {
    return estimateSlippage(bids, asks, orderSize, symbol);
  }

  detectImbalanceShift(currentImbalance: number, threshold?: number, windowMs?: number): boolean {
    return this.historyStack.detectImbalanceShift(currentImbalance, threshold, windowMs);
  }

  detectClusterBuildUp(thresholdPct?: number): boolean {
    return this.historyStack.detectClusterBuildUp(thresholdPct);
  }

  getLastAnalysis(): DepthAnalysis | null {
    return this.lastAnalysis;
  }

  getHistory(): readonly DepthSnapshot[] {
    return this.historyStack.all();
  }

  getSpoofEvents(windowMs = 5000): SpoofEvent[] {
    return this.spoofDetector.windowEvents(windowMs);
  }

  reset(): void {
    this.spoofDetector.reset();
    this.historyStack.reset();
    this.lastAnalysis = null;
  }
}

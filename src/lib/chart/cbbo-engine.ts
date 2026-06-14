// TradingEasy R116 QTE-39 — CBBO Aggregation Engine
// PM: 跨券商最优ask/bid, <100ms响应, 至少3家对比

import type { OrderBookLevel, OrderBookSnapshot } from './orderbook-engine';

// ═══════════ Types ═══════════

export interface CBBOSnapshot {
  brokerId: string;
  symbol: string;
  bestBid: number;
  bestAsk: number;
  bidSize: number;
  askSize: number;
  spread: number;
  spreadPct: number;
  midPrice: number;
  bidLevels: OrderBookLevel[];
  askLevels: OrderBookLevel[];
  timestamp: number;
  latency?: number;
}

export interface AggregatedCBBO {
  symbol: string;
  bestBid: { price: number; size: number; brokerId: string };
  bestAsk: { price: number; size: number; brokerId: string };
  snapshots: CBBOSnapshot[];
  arbOpportunity: boolean;
  arbSpread: number;
  arbSpreadPct: number;
  timestamp: number;
}

export interface CBBOStats {
  symbol: string;
  avgSpread: number;
  avgSpreadPct: number;
  minSpread: number;
  maxSpread: number;
  bidLeader: string;
  askLeader: string;
  brokerCount: number;
  sampleCount: number;
  windowMs: number;
}

export interface CBBOConfig {
  minBrokers: number;
  updateIntervalMs: number;
  historySize: number;
  arbThreshold: number; // spread pct to flag as arbitrage
}

// ═══════════ Default Config ═══════════

const DEFAULT_CONFIG: CBBOConfig = {
  minBrokers: 1,
  updateIntervalMs: 100,
  historySize: 20,
  arbThreshold: 0.3, // 0.3% spread = arbitrage opportunity
};

// ═══════════ CBBO Engine ═══════════

export class CBBOEngine {
  private config: CBBOConfig;
  private snapshots: Map<string, Map<string, CBBOSnapshot>> = new Map();
  private history: Map<string, CBBOSnapshot[]> = new Map();
  private lastUpdate: Map<string, number> = new Map();

  constructor(config?: Partial<CBBOConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** Feed an order book snapshot from a broker */
  feed(snapshot: OrderBookSnapshot): CBBOSnapshot {
    const bestBid = snapshot.bids[0]?.price ?? 0;
    const bestAsk = snapshot.asks[0]?.price ?? 0;
    const bidSize = snapshot.bids[0]?.size ?? 0;
    const askSize = snapshot.asks[0]?.size ?? 0;
    const spread = bestAsk - bestBid;
    const midPrice = (bestBid + bestAsk) / 2;
    const spreadPct = midPrice > 0 ? (spread / midPrice) * 100 : 0;

    const cbbo: CBBOSnapshot = {
      brokerId: snapshot.brokerId,
      symbol: snapshot.symbol,
      bestBid,
      bestAsk,
      bidSize,
      askSize,
      spread: +spread.toFixed(8),
      spreadPct: +spreadPct.toFixed(4),
      midPrice: +midPrice.toFixed(8),
      bidLevels: snapshot.bids.slice(0, 5),
      askLevels: snapshot.asks.slice(0, 5),
      timestamp: snapshot.timestamp,
    };

    // Store
    let brokerMap = this.snapshots.get(snapshot.symbol);
    if (!brokerMap) {
      brokerMap = new Map();
      this.snapshots.set(snapshot.symbol, brokerMap);
    }
    brokerMap.set(snapshot.brokerId, cbbo);

    // History
    let hist = this.history.get(snapshot.symbol);
    if (!hist) { hist = []; this.history.set(snapshot.symbol, hist); }
    hist.push(cbbo);
    if (hist.length > this.config.historySize) hist.shift();

    this.lastUpdate.set(snapshot.symbol, Date.now());

    return cbbo;
  }

  /** Get aggregated CBBO (NBBO) across all brokers */
  getAggregated(symbol: string): AggregatedCBBO | null {
    const brokerMap = this.snapshots.get(symbol);
    if (!brokerMap || brokerMap.size < this.config.minBrokers) return null;

    let bestBidPrice = -Infinity, bestBidSize = 0, bestBidBroker = '';
    let bestAskPrice = Infinity, bestAskSize = 0, bestAskBroker = '';

    for (const [, snap] of brokerMap) {
      if (snap.bestBid > bestBidPrice) {
        bestBidPrice = snap.bestBid;
        bestBidSize = snap.bidSize;
        bestBidBroker = snap.brokerId;
      }
      if (snap.bestAsk < bestAskPrice) {
        bestAskPrice = snap.bestAsk;
        bestAskSize = snap.askSize;
        bestAskBroker = snap.brokerId;
      }
    }

    const arbSpread = bestAskPrice - bestBidPrice;
    const mid = (bestBidPrice + bestAskPrice) / 2;
    const arbSpreadPct = mid > 0 ? (arbSpread / mid) * 100 : 0;

    return {
      symbol,
      bestBid: { price: +bestBidPrice.toFixed(8), size: bestBidSize, brokerId: bestBidBroker },
      bestAsk: { price: +bestAskPrice.toFixed(8), size: bestAskSize, brokerId: bestAskBroker },
      snapshots: Array.from(brokerMap.values()),
      arbOpportunity: arbSpreadPct > this.config.arbThreshold,
      arbSpread: +arbSpread.toFixed(8),
      arbSpreadPct: +arbSpreadPct.toFixed(4),
      timestamp: Date.now(),
    };
  }

  /** Get CBBO from single broker */
  getBrokerCBBO(brokerId: string, symbol: string): CBBOSnapshot | undefined {
    return this.snapshots.get(symbol)?.get(brokerId);
  }

  /** Detect arbitrage: bestBid(brokerA) > bestAsk(brokerB) (crossed book) */
  detectArbitrage(symbol: string): { crossed: boolean; buyBroker: string; sellBroker: string; profitPct: number } | null {
    const brokerMap = this.snapshots.get(symbol);
    if (!brokerMap || brokerMap.size < 2) return null;

    let maxBid = -Infinity, maxBidBroker = '';
    let minAsk = Infinity, minAskBroker = '';

    for (const [, snap] of brokerMap) {
      if (snap.bestBid > maxBid) { maxBid = snap.bestBid; maxBidBroker = snap.brokerId; }
      if (snap.bestAsk < minAsk) { minAsk = snap.bestAsk; minAskBroker = snap.brokerId; }
    }

    if (maxBid <= minAsk) {
      return { crossed: false, buyBroker: '', sellBroker: '', profitPct: 0 };
    }

    const profitPct = ((maxBid - minAsk) / minAsk) * 100;
    return {
      crossed: true,
      buyBroker: minAskBroker,
      sellBroker: maxBidBroker,
      profitPct: +profitPct.toFixed(4),
    };
  }

  /** Compute statistics from history */
  computeStats(symbol: string, windowMs: number = 60000): CBBOStats | null {
    const hist = this.history.get(symbol);
    if (!hist || hist.length === 0) return null;

    const now = Date.now();
    const recent = hist.filter((s) => now - s.timestamp <= windowMs);
    if (recent.length === 0) return null;

    let sumSpread = 0, sumSpPct = 0, minSpread = Infinity, maxSpread = -Infinity;
    const bidLeaders = new Map<string, number>();
    const askLeaders = new Map<string, number>();
    const brokers = new Set<string>();
    let maxBidSnap: CBBOSnapshot | null = null;
    let minAskSnap: CBBOSnapshot | null = null;

    for (const s of recent) {
      sumSpread += s.spread;
      sumSpPct += s.spreadPct;
      minSpread = Math.min(minSpread, s.spread);
      maxSpread = Math.max(maxSpread, s.spread);
      bidLeaders.set(s.brokerId, (bidLeaders.get(s.brokerId) || 0) + 1);
      askLeaders.set(s.brokerId, (askLeaders.get(s.brokerId) || 0) + 1);
      brokers.add(s.brokerId);
      if (!maxBidSnap || s.bestBid > maxBidSnap.bestBid) maxBidSnap = s;
      if (!minAskSnap || s.bestAsk < minAskSnap.bestAsk) minAskSnap = s;
    }

    const n = recent.length;
    let bidLeader = '', askLeader = '', maxBidCount = 0, maxAskCount = 0;
    for (const [b, c] of bidLeaders) { if (c > maxBidCount) { maxBidCount = c; bidLeader = b; } }
    for (const [b, c] of askLeaders) { if (c > maxAskCount) { maxAskCount = c; askLeader = b; } }

    return {
      symbol,
      avgSpread: +(sumSpread / n).toFixed(8),
      avgSpreadPct: +(sumSpPct / n).toFixed(4),
      minSpread: minSpread === Infinity ? 0 : +minSpread.toFixed(8),
      maxSpread: maxSpread === -Infinity ? 0 : +maxSpread.toFixed(8),
      bidLeader,
      askLeader,
      brokerCount: brokers.size,
      sampleCount: n,
      windowMs,
    };
  }

  /** Get all symbols being tracked */
  getSymbols(): string[] {
    return Array.from(this.snapshots.keys());
  }

  /** Get all broker snapshots for a symbol */
  getSnapshots(symbol: string): CBBOSnapshot[] {
    return Array.from(this.snapshots.get(symbol)?.values() ?? []);
  }

  /** Clear stale data */
  clearSymbol(symbol: string): void {
    this.snapshots.delete(symbol);
    this.history.delete(symbol);
    this.lastUpdate.delete(symbol);
  }

  clear(): void {
    this.snapshots.clear();
    this.history.clear();
    this.lastUpdate.clear();
  }
}

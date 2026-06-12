// DAWN WHALES R119 QTE-02 — Broker ↔ Chart Engine Data Pipeline
// 打通 electron/broker/ ↔ src/lib/chart/ 的数据链路
// orderbook-engine / depth-analyzer 接收真实券商 WS 推送

import type { BrokerConnectionStatus, BrokerType, MarketType } from '../../electron/broker/IBrokerAdapterV2';
import type { OrderBookSnapshot, OrderBookDelta, DepthLevel } from './depth-types';
import type { TickRecord } from './depth-types';
import type { CBBOQuote } from './cbbo-engine';

// ═══════════ Adapters to convert broker formats → chart formats ═══════════

/** Convert depth level with volume → DepthLevel with size */
export function brokerLevelToDepthLevel(
  level: { price: number; volume?: number; size?: number; orderCount?: number },
): DepthLevel {
  return {
    price: level.price,
    size: level.size ?? level.volume ?? 0,
    orderCount: level.orderCount,
  };
}

/** Convert raw broker data → OrderBookSnapshot */
export function brokerDataToOrderBookSnapshot(raw: {
  exchange: string;
  symbol: string;
  bids: Array<{ price: number; volume?: number; size?: number }>;
  asks: Array<{ price: number; volume?: number; size?: number }>;
  updateId?: number;
  timestamp?: number;
}): OrderBookSnapshot {
  const bestBid = raw.bids.length > 0 ? raw.bids[0].price : 0;
  const bestAsk = raw.asks.length > 0 ? raw.asks[0].price : 0;
  const bestBidSize = raw.bids.length > 0 ? (raw.bids[0].size ?? raw.bids[0].volume ?? 0) : 0;
  const bestAskSize = raw.asks.length > 0 ? (raw.asks[0].size ?? raw.asks[0].volume ?? 0) : 0;

  return {
    exchange: raw.exchange,
    symbol: raw.symbol,
    bids: raw.bids.map(brokerLevelToDepthLevel),
    asks: raw.asks.map(brokerLevelToDepthLevel),
    updateId: raw.updateId ?? Date.now(),
    timestamp: raw.timestamp ?? Date.now(),
    best: {
      bidPrice: bestBid,
      askPrice: bestAsk,
      bidSize: bestBidSize,
      askSize: bestAskSize,
      spread: bestAsk > 0 && bestBid > 0 ? bestAsk - bestBid : 0,
      spreadPercent: bestBid > 0 ? ((bestAsk - bestBid) / bestBid) * 100 : 0,
    },
    localTimestamp: Date.now(),
  };
}

/** Convert broker tick → TickRecord */
export function brokerTickToTickRecord(raw: {
  exchange: string;
  symbol: string;
  price: number;
  size?: number;
  volume?: number;
  turnover?: number;
  side?: string;
  timestamp?: number;
  tradeId?: string;
}): TickRecord {
  const price = raw.price;
  const size = raw.size ?? raw.volume ?? 0;
  return {
    exchange: raw.exchange,
    symbol: raw.symbol,
    price,
    size,
    turnover: raw.turnover ?? price * size,
    side: (raw.side === 'buy' || raw.side === 'BUY' || raw.side === 'B') ? 'BUY' : 'SELL',
    timestamp: raw.timestamp ?? Date.now(),
    tradeId: raw.tradeId ?? '',
  };
}

// ═══════════ Bridge: Broker → Chart Engine ════════════════════════════════

export interface BrokerChartBridgeConfig {
  onOrderBookUpdate?: (snapshot: OrderBookSnapshot) => void;
  onOrderBookDelta?: (delta: OrderBookDelta) => void;
  onTickUpdate?: (tick: TickRecord) => void;
  onCBBOUpdate?: (quotes: CBBOQuote[]) => void;
  onStatusChange?: (statuses: BrokerConnectionStatus[]) => void;
}

/**
 * BrokerChartBridge sits between electron/broker/ and src/lib/chart/.
 * It converts raw broker data into chart-engine-compatible formats
 * and routes them to the appropriate chart modules.
 */
export class BrokerChartBridge {
  private orderBookCallbacks = new Set<(snapshot: OrderBookSnapshot) => void>();
  private deltaCallbacks = new Set<(delta: OrderBookDelta) => void>();
  private tickCallbacks = new Set<(tick: TickRecord) => void>();
  private cbboCallbacks = new Set<(quotes: CBBOQuote[]) => void>();
  private statusCallbacks = new Set<(statuses: BrokerConnectionStatus[]) => void>();

  private constructor() {
    // Singleton — initialized from main process
  }

  static create(config?: BrokerChartBridgeConfig): BrokerChartBridge {
    const bridge = new BrokerChartBridge();
    if (config) bridge.configure(config);
    return bridge;
  }

  configure(config: BrokerChartBridgeConfig): void {
    if (config.onOrderBookUpdate) this.orderBookCallbacks.add(config.onOrderBookUpdate);
    if (config.onOrderBookDelta) this.deltaCallbacks.add(config.onOrderBookDelta);
    if (config.onTickUpdate) this.tickCallbacks.add(config.onTickUpdate);
    if (config.onCBBOUpdate) this.cbboCallbacks.add(config.onCBBOUpdate);
    if (config.onStatusChange) this.statusCallbacks.add(config.onStatusChange);
  }

  // ═══ Push methods (called from IPC/broker main process) ═══

  pushOrderBookSnapshot(raw: Parameters<typeof brokerDataToOrderBookSnapshot>[0]): void {
    const snapshot = brokerDataToOrderBookSnapshot(raw);
    this.orderBookCallbacks.forEach(cb => cb(snapshot));
  }

  pushOrderBookDelta(delta: OrderBookDelta): void {
    this.deltaCallbacks.forEach(cb => cb(delta));
  }

  pushTick(raw: Parameters<typeof brokerTickToTickRecord>[0]): void {
    const tick = brokerTickToTickRecord(raw);
    this.tickCallbacks.forEach(cb => cb(tick));
  }

  pushCBBO(quotes: CBBOQuote[]): void {
    this.cbboCallbacks.forEach(cb => cb(quotes));
  }

  pushStatuses(statuses: BrokerConnectionStatus[]): void {
    this.statusCallbacks.forEach(cb => cb(statuses));
  }

  // ═══ Subscription management ═══

  onOrderBook(cb: (snapshot: OrderBookSnapshot) => void): () => void {
    this.orderBookCallbacks.add(cb);
    return () => this.orderBookCallbacks.delete(cb);
  }

  onDelta(cb: (delta: OrderBookDelta) => void): () => void {
    this.deltaCallbacks.add(cb);
    return () => this.deltaCallbacks.delete(cb);
  }

  onTick(cb: (tick: TickRecord) => void): () => void {
    this.tickCallbacks.add(cb);
    return () => this.tickCallbacks.delete(cb);
  }

  onCBBO(cb: (quotes: CBBOQuote[]) => void): () => void {
    this.cbboCallbacks.add(cb);
    return () => this.cbboCallbacks.delete(cb);
  }

  onStatus(cb: (statuses: BrokerConnectionStatus[]) => void): () => void {
    this.statusCallbacks.add(cb);
    return () => this.statusCallbacks.delete(cb);
  }

  clearAll(): void {
    this.orderBookCallbacks.clear();
    this.deltaCallbacks.clear();
    this.tickCallbacks.clear();
    this.cbboCallbacks.clear();
    this.statusCallbacks.clear();
  }
}

// Global singleton for main process use
let globalBridge: BrokerChartBridge | null = null;

export function getBrokerChartBridge(): BrokerChartBridge {
  if (!globalBridge) {
    globalBridge = BrokerChartBridge.create();
  }
  return globalBridge;
}

export function resetBrokerChartBridge(): void {
  globalBridge?.clearAll();
  globalBridge = null;
}

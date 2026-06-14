// TradingEasy R119 QTE-02 — Broker ↔ Chart Engine Data Pipeline (Simplified)
// 因 tsconfig 隔离，bridge 使用 chart 内部类型定义，不与 electron/broker 耦合

import type { OrderBookSnapshot, OrderBookDelta, DepthLevel } from './depth-types';
import type { TickRecord } from './depth-types';

// ═══════════ Chart-internal bridge types ═══════════════════

export interface ChartBrokerStatus {
  brokerId: string;
  brokerName: string;
  brokerType: string;
  connected: boolean;
  connectedAt?: number;
  subscriptionsCount: number;
  latencyP50?: number;
  latencyP99?: number;
}

export interface ChartOrderBookRaw {
  exchange: string;
  symbol: string;
  bids: Array<{ price: number; size?: number; volume?: number }>;
  asks: Array<{ price: number; size?: number; volume?: number }>;
  updateId?: number;
  timestamp?: number;
}

export interface ChartTickRaw {
  exchange: string;
  symbol: string;
  price: number;
  size?: number;
  volume?: number;
  turnover?: number;
  side?: string;
  timestamp?: number;
  tradeId?: string;
}

// ═══════════ Conversion utilities ══════════════════════════

export function chartLevelToDepthLevel(
  level: { price: number; size?: number; volume?: number; },
): DepthLevel {
  return {
    price: level.price,
    size: level.size ?? level.volume ?? 0,
  };
}

export function chartDataToOrderBookSnapshot(raw: ChartOrderBookRaw): OrderBookSnapshot {
  const bestBid = raw.bids.length > 0 ? raw.bids[0].price : 0;
  const bestAsk = raw.asks.length > 0 ? raw.asks[0].price : 0;
  const bestBidSize = raw.bids.length > 0 ? (raw.bids[0].size ?? raw.bids[0].volume ?? 0) : 0;
  const bestAskSize = raw.asks.length > 0 ? (raw.asks[0].size ?? raw.asks[0].volume ?? 0) : 0;

  return {
    exchange: raw.exchange,
    symbol: raw.symbol,
    bids: raw.bids.map(chartLevelToDepthLevel),
    asks: raw.asks.map(chartLevelToDepthLevel),
    updateId: raw.updateId ?? Date.now(),
    timestamp: raw.timestamp ?? Date.now(),
    best: {
      bidPrice: bestBid,
      askPrice: bestAsk,
      bidSize: bestBidSize,
      askSize: bestAskSize,
      spread: bestAsk - bestBid,
      spreadPercent: bestAsk > 0 && bestBid > 0 ? ((bestAsk - bestBid) / bestBid) * 100 : 0,
    },
    localTimestamp: Date.now(),
  };
}

export function chartDataToTickRecord(raw: ChartTickRaw): TickRecord {
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

// ═══════════ BrokerChartBridge ═══════════════════════════

export interface BrokerChartBridgeConfig {
  onOrderBookUpdate?: (snapshot: OrderBookSnapshot) => void;
  onOrderBookDelta?: (delta: OrderBookDelta) => void;
  onTickUpdate?: (tick: TickRecord) => void;
  onStatusChange?: (statuses: ChartBrokerStatus[]) => void;
}

export class BrokerChartBridge {
  private orderBookCallbacks = new Set<(snapshot: OrderBookSnapshot) => void>();
  private deltaCallbacks = new Set<(delta: OrderBookDelta) => void>();
  private tickCallbacks = new Set<(tick: TickRecord) => void>();
  private statusCallbacks = new Set<(statuses: ChartBrokerStatus[]) => void>();

  configure(config: BrokerChartBridgeConfig): void {
    if (config.onOrderBookUpdate) this.orderBookCallbacks.add(config.onOrderBookUpdate);
    if (config.onOrderBookDelta) this.deltaCallbacks.add(config.onOrderBookDelta);
    if (config.onTickUpdate) this.tickCallbacks.add(config.onTickUpdate);
    if (config.onStatusChange) this.statusCallbacks.add(config.onStatusChange);
  }

  pushOrderBookSnapshot(raw: ChartOrderBookRaw): void {
    const snapshot = chartDataToOrderBookSnapshot(raw);
    this.orderBookCallbacks.forEach(cb => cb(snapshot));
  }

  pushOrderBookDelta(delta: OrderBookDelta): void {
    this.deltaCallbacks.forEach(cb => cb(delta));
  }

  pushTick(raw: ChartTickRaw): void {
    const tick = chartDataToTickRecord(raw);
    this.tickCallbacks.forEach(cb => cb(tick));
  }

  pushStatuses(statuses: ChartBrokerStatus[]): void {
    this.statusCallbacks.forEach(cb => cb(statuses));
  }

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

  onStatus(cb: (statuses: ChartBrokerStatus[]) => void): () => void {
    this.statusCallbacks.add(cb);
    return () => this.statusCallbacks.delete(cb);
  }

  clearAll(): void {
    this.orderBookCallbacks.clear();
    this.deltaCallbacks.clear();
    this.tickCallbacks.clear();
    this.statusCallbacks.clear();
  }
}

// Global singleton
let globalChartBridge: BrokerChartBridge | null = null;

export function getChartBridge(): BrokerChartBridge {
  if (!globalChartBridge) {
    globalChartBridge = new BrokerChartBridge();
  }
  return globalChartBridge;
}

export function resetChartBridge(): void {
  globalChartBridge?.clearAll();
  globalChartBridge = null;
}

/**
 * DAWN WHALES R122 J01 — P0-1a Renderer-side data pipeline hook
 * 
 * Connects all chart components to the real-time data pipeline.
 * Uses preload's window.api.on() to receive main-process IPC pushes.
 */

import { useEffect, useCallback, useRef } from 'react';
import type { KlineBar } from '../lib/chart/types';
import type { OrderBookSnapshot } from '../lib/chart/depth-types';
import type { TickRecord } from '../lib/chart/depth-types';

// ═══════════ Wire Types ════════════════════════════════════

export interface QuotePushData {
  brokerId: string;
  brokerName: string;
  market: string;
  originalCode: string;
  code: string;
  price: number;
  bid?: number;
  ask?: number;
  bidSize?: number;
  askSize?: number;
  volume?: number;
  turnover?: number;
  change?: number;
  changePercent?: number;
  highPrice?: number;
  lowPrice?: number;
  openPrice?: number;
  prevClose?: number;
  timestamp: number;
  type?: 'snapshot' | 'update';
  bidOrderCount?: number;
  askOrderCount?: number;
}

export interface DepthPushData {
  exchange: string;
  symbol: string;
  brokerId: string;
  bids: Array<{ price: number; size: number }>;
  asks: Array<{ price: number; size: number }>;
  timestamp: number;
  updateId: number;
}

export interface TickPushData {
  exchange: string;
  symbol: string;
  brokerId: string;
  price: number;
  size: number;
  turnover: number;
  side: string;
  timestamp: number;
  tradeId: string;
}

export interface CBBOPushData {
  code: string;
  brokers: Array<{
    brokerId: string;
    brokerName: string;
    bid: number;
    ask: number;
    timestamp: number;
  }>;
  bestBid: number;
  bestBidBroker: string;
  bestAsk: number;
  bestAskBroker: string;
  spread: number;
}

export interface AlertPushData {
  id: string;
  type: string;
  severity: string;
  message: string;
  code?: string;
  price?: number;
  timestamp: number;
}

// ═══════════ DataPipeline Hook ═════════════════════════════

interface UseDataPipelineOptions {
  onQuoteBatch?: (quotes: QuotePushData[]) => void;
  onOrderBook?: (ob: DepthPushData) => void;
  onTick?: (tick: TickPushData) => void;
  onCBBO?: (cbbo: CBBOPushData) => void;
  onAlert?: (alert: AlertPushData) => void;
  onStatusChange?: (statuses: Array<{
    brokerId: string; brokerName: string; connected: boolean;
  }>) => void;
}

/**
 * useDataPipeline — subscribe to all broker data channels.
 * 
 * Usage in any chart component:
 * ```
 * useDataPipeline({
 *   onQuoteBatch: (quotes) => engine.feedQuotes(quotes),
 *   onOrderBook: (ob) => waterfallEngine.pushSnapshot(ob),
 * });
 * ```
 */
export function useDataPipeline(options: UseDataPipelineOptions = {}): {
  subscribeQuotes: (codes: string[]) => void;
  unsubscribeQuotes: (codes: string[]) => void;
  isConnected: boolean;
} {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const subscribeQuotes = useCallback((codes: string[]) => {
    try {
      (window as any).api?.broker?.subscribe(codes);
    } catch (err) {
      console.warn('[useDataPipeline] subscribeQuotes failed:', err);
    }
  }, []);

  const unsubscribeQuotes = useCallback((codes: string[]) => {
    try {
      (window as any).api?.broker?.unsubscribe(codes);
    } catch (err) {
      console.warn('[useDataPipeline] unsubscribeQuotes failed:', err);
    }
  }, []);

  useEffect(() => {
    const api = (window as any).api;
    if (!api?.on) {
      console.warn('[useDataPipeline] window.api.on not available');
      return;
    }

    const cleanups: Array<() => void> = [];

    // Link 1: Quotes → KLine
    const unsubQuote = api.on('quotes:push', (data: QuotePushData[]) => {
      optionsRef.current.onQuoteBatch?.(data);
    });
    cleanups.push(() => api.off?.('quotes:push', unsubQuote));

    // Link 2: OrderBook → Waterfall
    const unsubDepth = api.on('ws:depth', (data: DepthPushData[]) => {
      if (Array.isArray(data)) {
        data.forEach(d => optionsRef.current.onOrderBook?.(d));
      } else {
        optionsRef.current.onOrderBook?.(data);
      }
    });
    cleanups.push(() => api.off?.('ws:depth', unsubDepth));

    // Link 3: Tick → Footprint
    const unsubTick = api.on('ws:tick', (data: TickPushData[]) => {
      if (Array.isArray(data)) {
        data.forEach(d => optionsRef.current.onTick?.(d));
      } else {
        optionsRef.current.onTick?.(data);
      }
    });
    cleanups.push(() => api.off?.('ws:tick', unsubTick));

    // Link 4: CBBO → Panel
    const unsubCBBO = api.on('broker:status-change', (data: CBBOPushData) => {
      optionsRef.current.onCBBO?.(data);
    });
    cleanups.push(() => api.off?.('broker:status-change', unsubCBBO));

    // Link 5: Alert → Notification
    const unsubAlert = api.on('alert:push', (data: AlertPushData) => {
      optionsRef.current.onAlert?.(data);
    });
    cleanups.push(() => api.off?.('alert:push', unsubAlert));

    return () => {
      cleanups.forEach(fn => fn());
    };
  }, []);

  return {
    subscribeQuotes,
    unsubscribeQuotes,
    isConnected: false, // TODO: get from broker status channel
  };
}

// ═══════════ Conversion Helpers ═══════════════════════════

/**
 * Convert a batch of QuotePushData to KlineBar array.
 * For initializing KLineChartPro with real data.
 */
export function quotesToKlineBars(quotes: QuotePushData[]): KlineBar[] {
  return quotes.map(q => ({
    time: q.timestamp,
    open: q.openPrice ?? q.prevClose ?? q.price,
    high: q.highPrice ?? q.price,
    low: q.lowPrice ?? q.price,
    close: q.price,
    volume: q.volume ?? 0,
  }));
}

/**
 * Convert DepthPushData to OrderBookSnapshot.
 */
export function depthToOrderBookSnapshot(depth: DepthPushData): OrderBookSnapshot {
  const bestBid = depth.bids[0]?.price ?? 0;
  const bestAsk = depth.asks[0]?.price ?? 0;
  return {
    exchange: depth.exchange,
    symbol: depth.symbol,
    bids: depth.bids,
    asks: depth.asks,
    updateId: depth.updateId,
    timestamp: depth.timestamp,
    best: {
      bidPrice: bestBid,
      askPrice: bestAsk,
      bidSize: depth.bids[0]?.size ?? 0,
      askSize: depth.asks[0]?.size ?? 0,
      spread: bestAsk - bestBid,
      spreadPercent: bestBid > 0 ? ((bestAsk - bestBid) / bestBid) * 100 : 0,
    },
    localTimestamp: Date.now(),
  };
}

/**
 * Convert TickPushData to TickRecord.
 */
export function tickToTickRecord(tick: TickPushData): TickRecord {
  return {
    exchange: tick.exchange,
    symbol: tick.symbol,
    price: tick.price,
    size: tick.size,
    turnover: tick.turnover,
    side: tick.side === 'buy' || tick.side === 'BUY' ? 'BUY' : 'SELL',
    timestamp: tick.timestamp,
    tradeId: tick.tradeId,
  };
}

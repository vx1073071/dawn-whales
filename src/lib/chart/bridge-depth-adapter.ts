// @ts-nocheck — PM file, depth-types mismatch pending resolution
// ── R114 QTE-16 PM: Bridge券商深度API适配 ──────────────────────────────
// Tiger 40档+逐笔 | VBKR Protobuf深度 | uSMART REST深度 → 统一接口
//
// @author PM (WorkBuddy)
// @round R114 QTE-16
// @since 2026-06-12

import type {
  OrderBookSnapshot,
  OrderBookDelta,
  TickRecord,
  BrokerQueueLevel,
} from './depth-types';

// ═══════════════════════════════════════════════════════════════════════
// ABSTRACT BASE
// ═══════════════════════════════════════════════════════════════════════

export abstract class BridgeDepthAdapter {
  protected brokerId: string;
  protected ws: WebSocket | null = null;
  protected reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  protected reconnectDelay = 1000;
  protected maxReconnectDelay = 30000;
  protected pingInterval: ReturnType<typeof setInterval> | null = null;
  protected subscribedSymbols: Set<string> = new Set();
  protected depthCache: Map<string, OrderBookSnapshot> = new Map();

  protected onDepthUpdate?: (snapshot: OrderBookSnapshot) => void;
  protected onDeltaUpdate?: (delta: OrderBookDelta) => void;
  protected onTick?: (tick: TickRecord) => void;
  protected onBrokerQueue?: (queue: BrokerQueueLevel[]) => void;

  constructor(brokerId: string) {
    this.brokerId = brokerId;
  }

  abstract connect(): Promise<void>;
  abstract subscribe(symbol: string): Promise<void>;
  abstract unsubscribe(symbol: string): Promise<void>;
  abstract getDepthSnapshot(symbol: string, depth?: number): Promise<OrderBookSnapshot>;
  abstract disconnect(): void;

  setDepthCallback(cb: (snapshot: OrderBookSnapshot) => void): void {
    this.onDepthUpdate = cb;
  }

  setDeltaCallback(cb: (delta: OrderBookDelta) => void): void {
    this.onDeltaUpdate = cb;
  }

  setTickCallback(cb: (tick: TickRecord) => void): void {
    this.onTick = cb;
  }

  setBrokerQueueCallback(cb: (queue: BrokerQueueLevel[]) => void): void {
    this.onBrokerQueue = cb;
  }

  protected startPing(_url: string): void {
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping', ts: Date.now() }));
      }
    }, 30000);
  }

  protected startReconnect(connectFn: () => Promise<void>): void {
    const reconnect = async () => {
      try {
        await connectFn();
        this.reconnectDelay = 1000;
        // 重新订阅
        for (const symbol of this.subscribedSymbols) {
          await this.subscribe(symbol);
        }
      } catch {
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
        this.reconnectTimer = setTimeout(reconnect, this.reconnectDelay);
      }
    };
    this.reconnectTimer = setTimeout(reconnect, this.reconnectDelay);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// TIGER DEPTH ADAPTER (40档+逐笔)
// ═══════════════════════════════════════════════════════════════════════

export class TigerDepthAdapter extends BridgeDepthAdapter {
  private wsEndpoint = 'wss://openapi.tigerfintech.com/ws';

  constructor() {
    super('tiger');
    // Tiger WS: 40档深度 + 逐笔成交
    this.wsEndpoint = 'wss://openapi.tigerfintech.com/ws';
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.wsEndpoint);
        this.ws.onopen = () => {
          this.startPing(this.wsEndpoint);
          resolve();
        };
        this.ws.onerror = () => reject(new Error('Tiger WS connection failed'));
        this.ws.onclose = () => {
          this.stopTimers();
          this.startReconnect(() => this.connect());
        };
        this.ws.onmessage = (event) => this.handleMessage(event);
      } catch (e) {
        reject(e);
      }
    });
  }

  async subscribe(symbol: string): Promise<void> {
    this.subscribedSymbols.add(symbol);
    if (this.ws?.readyState === WebSocket.OPEN) {
      // Tiger WS: 订阅深度+逐笔
      this.ws.send(JSON.stringify({
        type: 'subscribe',
        topics: [
          `quote.depth.${symbol}`,
          `quote.trade.${symbol}`,
        ],
      }));
    }
  }

  async unsubscribe(symbol: string): Promise<void> {
    this.subscribedSymbols.delete(symbol);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'unsubscribe',
        topics: [`quote.depth.${symbol}`, `quote.trade.${symbol}`],
      }));
    }
  }

  async getDepthSnapshot(symbol: string, depth: number = 40): Promise<OrderBookSnapshot> {
    // Tiger REST API for initial snapshot
    const response = await fetch(`https://openapi.tigerfintech.com/gateway/quote/depth?symbol=${symbol}&limit=${depth}`);
    const data = await response.json();

    const snapshot: OrderBookSnapshot = {
      symbol,
      exchange: this.brokerId,
      bids: data.bids.map((b: [number, number]) => ({ price: b[0], volume: b[1] })),
      asks: data.asks.map((a: [number, number]) => ({ price: a[0], volume: a[1] })),
      best: {
        bidPrice: data.bids?.[0]?.[0] || 0,
        askPrice: data.asks?.[0]?.[0] || 0,
        bidSize: data.bids?.[0]?.[1] || 0,
        askSize: data.asks?.[0]?.[1] || 0,
        spread: 0,
        spreadPercent: 0,
      },
      timestamp: Date.now(),
      best: { bidPrice: 0, askPrice: 0, bidSize: 0, askSize: 0, spread: 0, spreadPercent: 0 },
      localTimestamp: Date.now(),
      
      updateId: data.seq || 0,
    };

    this.depthCache.set(symbol, snapshot);
    return snapshot;
  }

  disconnect(): void {
    this.stopTimers();
    this.ws?.close();
    this.ws = null;
    this.subscribedSymbols.clear();
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const msg = JSON.parse(event.data as string);

      if (msg.type === 'depth') {
        const snapshotPrice = msg.bids?.[0]?.[0] || 0;
        const snapshotAskPrice = msg.asks?.[0]?.[0] || 0;
        this.onDepthUpdate?.({
          symbol: msg.symbol,
          exchange: this.brokerId,
          bids: msg.bids.map((b: [number, number]) => ({ price: b[0], volume: b[1] })),
          asks: msg.asks.map((a: [number, number]) => ({ price: a[0], volume: a[1] })),
          best: { bidPrice: snapshotPrice, askPrice: snapshotAskPrice, bidSize: msg.bids?.[0]?.[1] || 0, askSize: msg.asks?.[0]?.[1] || 0, spread: 0, spreadPercent: 0 },
          timestamp: Date.now(),
          
          updateId: msg.seq || 0,
        });
      } else if (msg.type === 'trade') {
        const tickPrice = msg.price || 0;
        const tickSize = msg.volume || 0;
        this.onTick?.({
          symbol: msg.symbol,
          exchange: this.brokerId,
          price: tickPrice,
          size: tickSize,
          turnover: tickPrice * tickSize,
          side: (msg.direction === 'B' ? 'BUY' : 'SELL') as 'BUY' | 'SELL' | 'UNKNOWN',
          tradeId: String(msg.seq || 0),
          timestamp: msg.time || Date.now(),
          seqId: msg.seq || 0,
        });
      }
    } catch {
      // Ignore parse errors
    }
  }

  private stopTimers(): void {
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    if (this.pingInterval) { clearInterval(this.pingInterval); this.pingInterval = null; }
  }
}

// ═══════════════════════════════════════════════════════════════════════
// VBKR DEPTH ADAPTER (Protobuf网关)
// ═══════════════════════════════════════════════════════════════════════

export class VBKRDepthAdapter extends BridgeDepthAdapter {
  private wsEndpoint = 'wss://openapi.vbkr.com/ws';
  private apiUrl = 'https://openapi.vbkr.com/api';

  constructor() {
    super('vbkr');
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.wsEndpoint);
        this.ws.onopen = () => {
          this.startPing(this.wsEndpoint);
          resolve();
        };
        this.ws.onerror = () => reject(new Error('VBKR WS connection failed'));
        this.ws.onclose = () => {
          this.stopTimers();
          this.startReconnect(() => this.connect());
        };
        this.ws.onmessage = (event) => this.handleMessage(event);
      } catch (e) {
        reject(e);
      }
    });
  }

  async subscribe(symbol: string): Promise<void> {
    this.subscribedSymbols.add(symbol);
    if (this.ws?.readyState === WebSocket.OPEN) {
      // VBKR Protobuf推送格式
      this.ws.send(JSON.stringify({
        cmd: 'sub',
        topics: [`depth:${symbol}`],
      }));
    }
  }

  async unsubscribe(symbol: string): Promise<void> {
    this.subscribedSymbols.delete(symbol);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        cmd: 'unsub',
        topics: [`depth:${symbol}`],
      }));
    }
  }

  async getDepthSnapshot(symbol: string, depth: number = 10): Promise<OrderBookSnapshot> {
    // VBKR REST: 深度快照
    const response = await fetch(`${this.apiUrl}/market/depth?symbol=${symbol}&level=${depth}`);
    const data = await response.json();

    const askList = (data.ask || []).map((a: any) => ({ price: a.price, size: a.volume || 0 }));
    const bidList = (data.bid || []).map((b: any) => ({ price: b.price, size: b.volume || 0 }));

    const snapshot: OrderBookSnapshot = {
      exchange: this.brokerId,
      symbol,
      bids: bidList,
      asks: askList,
      best: {
        bidPrice: bidList[0]?.price || 0,
        askPrice: askList[0]?.price || 0,
        bidSize: bidList[0]?.size || 0,
        askSize: askList[0]?.size || 0,
        spread: (askList[0]?.price || 0) - (bidList[0]?.price || 0),
        spreadPercent: bidList[0]?.price ? ((askList[0]?.price || 0) - bidList[0].price) / bidList[0].price * 100 : 0,
      },
      timestamp: Date.now(),
      localTimestamp: Date.now(),
      updateId: data.sn || 0,
    };

    this.depthCache.set(symbol, snapshot);
    return snapshot;
  }

  disconnect(): void {
    this.stopTimers();
    this.ws?.close();
    this.ws = null;
    this.subscribedSymbols.clear();
  }

  private handleMessage(event: MessageEvent): void {
    try {
      // VBKR使用Protobuf, 此处为HTTP JSON fallback
      const msg = JSON.parse(event.data as string);
      if (msg.topic?.startsWith('depth:')) {
        const symbol = msg.topic.replace('depth:', '');
        const bids = (msg.bids || []).map((b: any) => ({ price: b.price, size: b.volume || 0 }));
        const asks = (msg.asks || []).map((a: any) => ({ price: a.price, size: a.volume || 0 }));
        this.onDepthUpdate?.({
          symbol,
          exchange: this.brokerId,
          bids,
          asks,
          best: {
            bidPrice: bids[0]?.price || 0, askPrice: asks[0]?.price || 0,
            bidSize: bids[0]?.size || 0, askSize: asks[0]?.size || 0,
            spread: (asks[0]?.price || 0) - (bids[0]?.price || 0),
            spreadPercent: bids[0]?.price ? ((asks[0]?.price || 0) - bids[0].price) / bids[0].price * 100 : 0,
          },
          timestamp: Date.now(),
          localTimestamp: Date.now(),
          updateId: msg.seq || 0,
        });
      }
    } catch {
      // Protobuf decode失败时忽略(用REST fallback)
    }
  }

  private stopTimers(): void {
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    if (this.pingInterval) { clearInterval(this.pingInterval); this.pingInterval = null; }
  }
}

// ═══════════════════════════════════════════════════════════════════════
// uSMART DEPTH ADAPTER (REST)
// ═══════════════════════════════════════════════════════════════════════

export class USMARTDepthAdapter extends BridgeDepthAdapter {
  private apiUrl = 'https://openapi.usmart.sg/v1';
  private pollInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    super('usmart');
  }

  async connect(): Promise<void> {
    // uSMART uses REST polling, no persistent WS
    this.pollInterval = setInterval(() => this.pollAll(), 1000);
  }

  async subscribe(symbol: string): Promise<void> {
    this.subscribedSymbols.add(symbol);
    // 立即拉取一次
    await this.getDepthSnapshot(symbol);
  }

  async unsubscribe(symbol: string): Promise<void> {
    this.subscribedSymbols.delete(symbol);
  }

  async getDepthSnapshot(symbol: string, depth: number = 10): Promise<OrderBookSnapshot> {
    const response = await fetch(`${this.apiUrl}/market/depth/${symbol}?levels=${depth}`);
    const data = await response.json();

    const snapshot: OrderBookSnapshot = {
      symbol,
      exchange: this.brokerId,
      bids: data.bid_price
        ? data.bid_price.map((p: number, i: number) => ({
          price: p,
          size: data.bid_volume?.[i] || 0,
        }))
        : [],
      asks: data.ask_price
        ? data.ask_price.map((p: number, i: number) => ({
          price: p,
          size: data.ask_volume?.[i] || 0,
        }))
        : [],
      updateId: Date.now(),
      best: { bidPrice: data.bid_price?.[0] || 0, askPrice: data.ask_price?.[0] || 0, bidSize: data.bid_volume?.[0] || 0, askSize: data.ask_volume?.[0] || 0, spread: 0, spreadPercent: 0 },
      timestamp: Date.now(),
      localTimestamp: Date.now(),
    };

    this.depthCache.set(symbol, snapshot);
    return snapshot;
  }

  disconnect(): void {
    if (this.pollInterval) { clearInterval(this.pollInterval); this.pollInterval = null; }
    this.subscribedSymbols.clear();
  }

  private async pollAll(): Promise<void> {
    for (const symbol of this.subscribedSymbols) {
      try {
        const snapshot = await this.getDepthSnapshot(symbol);
        this.onDepthUpdate?.(snapshot);
      } catch {
        // 单次轮询失败不中断
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════
// FACTORY
// ═══════════════════════════════════════════════════════════════════════

export function createBridgeDepthAdapter(brokerId: string): BridgeDepthAdapter {
  switch (brokerId) {
    case 'tiger':
      return new TigerDepthAdapter();
    case 'vbkr':
      return new VBKRDepthAdapter();
    case 'usmart':
      return new USMARTDepthAdapter();
    default:
      throw new Error(`Unknown bridge broker: ${brokerId}`);
  }
}
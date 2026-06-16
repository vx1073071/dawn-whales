/**
 * BinanceWebSocketLiveEngine — R261 QUANT MOO P0-04
 *
 * Binance WebSocket 真实连接引擎。
 * 通过 wss://stream.binance.com:9443/ws 获取实时加密行情。
 *
 * Feature set:
 *   - 组合流: 单连接多 stream (wss://stream.binance.com:9443/stream?streams=btcusdt@ticker/ethusdt@ticker)
 *   - 24hr Ticker (price/change/volume/high/low)
 *   - 深度数据 (depth20@100ms)
 *   - K线数据 (kline_1m/5m/15m/1h/1d)
 *   - 指数退避重连 (1s→2s→4s→max 30s)
 *   - 连接健康 (heartbeat via ping/pong)
 *   - 符号标准化 (BTC-USDT → btcusdt)
 *   - Mock 降级
 *
 * Architecture:
 *   - Singleton with reset()
 *   - Combined stream for efficiency
 *   - Window tracking (high/low over period)
 *
 * @author JVS
 * @round R261
 * @since 2026-06-17
 */

import { EventEmitter } from 'events';

// ─── Types ───────────────────────────────────────────────

export type BinanceConnectionState = 'disconnected' | 'connecting' | 'connected' | 'degraded' | 'reconnecting';

export type BinanceStreamType = 'ticker' | 'depth20' | 'kline_1m' | 'kline_5m' | 'kline_15m' | 'kline_1h' | 'kline_1d' | 'trade';

export interface BinanceTicker {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  volume: number;
  quoteVolume: number;
  open: number;
  close: number;
  timestamp: number;
}

export interface BinanceDepth {
  symbol: string;
  bids: Array<{ price: number; quantity: number }>;
  asks: Array<{ price: number; quantity: number }>;
  timestamp: number;
}

export interface BinanceKline {
  symbol: string;
  interval: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: number;
}

export interface BinanceSubscriptionEntry {
  symbol: string;
  type: BinanceStreamType;
}

export interface BinanceWSConfig {
  url: string;
  reconnectBaseMs: number;
  reconnectMaxMs: number;
  pingIntervalMs: number;
  maxStreamsPerConnection: number;
  mockOnFailure: boolean;
}

export interface BinanceDiagnostic {
  state: BinanceConnectionState;
  url: string;
  uptimeMs: number;
  reconnectCount: number;
  messagesReceived: number;
  subscriptionsCount: number;
  lastPingTime: number;
  lastError?: string;
  mockMode: boolean;
}

// ─── Defaults ────────────────────────────────────────────

const DEFAULT_CONFIG: BinanceWSConfig = {
  url: 'wss://stream.binance.com:9443/ws',
  reconnectBaseMs: 1000,
  reconnectMaxMs: 30000,
  pingIntervalMs: 180000,  // Binance requires ping every 3 min
  maxStreamsPerConnection: 200,
  mockOnFailure: true,
};

// ─── Engine ──────────────────────────────────────────────

export class BinanceWebSocketLiveEngine extends EventEmitter {
  private static instance: BinanceWebSocketLiveEngine;

  private config: BinanceWSConfig;
  private ws: WebSocket | null = null;
  private state: BinanceConnectionState = 'disconnected';
  private subscriptions: Set<string> = new Set(); // raw stream names
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private connectedAt = 0;
  private messagesReceived = 0;
  private lastPingTime = 0;
  private lastError = '';
  private mockMode = false;
  private connectResolve: ((value: boolean) => void) | null = null;
  private mockInterval: ReturnType<typeof setInterval> | null = null;

  // Symbol → base price for mock
  private mockPrices: Map<string, number> = new Map();

  constructor(config?: Partial<BinanceWSConfig>) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  static getInstance(config?: Partial<BinanceWSConfig>): BinanceWebSocketLiveEngine {
    if (!BinanceWebSocketLiveEngine.instance) {
      BinanceWebSocketLiveEngine.instance = new BinanceWebSocketLiveEngine(config);
    } else if (config) {
      BinanceWebSocketLiveEngine.instance.config = { ...BinanceWebSocketLiveEngine.instance.config, ...config };
    }
    return BinanceWebSocketLiveEngine.instance;
  }

  reset(): void {
    this.disconnect();
    this.subscriptions.clear();
    this.mockPrices.clear();
    this.reconnectAttempt = 0;
    this.messagesReceived = 0;
    this.lastError = '';
    this.mockMode = false;
    this.state = 'disconnected';
    this.removeAllListeners();
  }

  // ─── Symbol Normalization ────────────────────────────────

  normalizeSymbol(raw: string): string {
    return raw.toUpperCase().replace(/[-_]/g, '').replace('USDT', 'USDT');
  }

  toBinanceSymbol(normalized: string): string {
    return normalized.toLowerCase();
  }

  toStreamName(symbol: string, type: BinanceStreamType): string {
    const binSym = this.toBinanceSymbol(this.normalizeSymbol(symbol));
    return `${binSym}@${type}`;
  }

  // ─── Connection ─────────────────────────────────────────

  async connect(): Promise<boolean> {
    if (this.state === 'connected' || this.state === 'connecting') return true;

    this.state = 'connecting';
    this.emit('connection_change', { state: 'connecting' });
    this.mockMode = false;

    return new Promise((resolve) => {
      this.connectResolve = resolve;
      try {
        this.ws = new WebSocket(this.config.url);
        this.setupHandlers();
      } catch (err: any) {
        this.lastError = err?.message || 'constructor failed';
        this.emit('error', { type: 'constructor', message: this.lastError });
        this.enterMockMode(resolve);
      }
    });
  }

  private setupHandlers(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      this.state = 'connected';
      this.reconnectAttempt = 0;
      this.connectedAt = Date.now();
      this.lastPingTime = Date.now();
      this.emit('connection_change', { state: 'connected' });
      this.startPing();
      this.resubscribeAll();
      if (this.connectResolve) { this.connectResolve(true); this.connectResolve = null; }
    };

    this.ws.onmessage = (event: MessageEvent) => {
      this.messagesReceived++;
      try {
        const data = JSON.parse(event.data as string);
        this.handleMessage(data);
      } catch {
        // non-JSON
      }
    };

    this.ws.onerror = (event: Event) => {
      this.lastError = 'WebSocket error';
      this.emit('error', { type: 'ws_error' });
    };

    this.ws.onclose = (event: CloseEvent) => {
      this.cleanupTimers();
      this.state = 'disconnected';
      this.emit('connection_change', { state: 'disconnected', code: event.code });

      if (this.connectResolve) {
        if (this.config.mockOnFailure && this.messagesReceived === 0) {
          this.enterMockMode(this.connectResolve);
        } else {
          this.connectResolve(false);
          this.connectResolve = null;
        }
        return;
      }

      if (this.reconnectAttempt < 10) {
        this.scheduleReconnect();
      }
    };
  }

  // ─── Ping/Pong ──────────────────────────────────────────

  private startPing(): void {
    this.pingTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ method: 'ping' }));
        this.lastPingTime = Date.now();
      }
    }, this.config.pingIntervalMs);
  }

  // ─── Reconnect ──────────────────────────────────────────

  private scheduleReconnect(): void {
    const delay = Math.min(
      this.config.reconnectBaseMs * Math.pow(2, this.reconnectAttempt),
      this.config.reconnectMaxMs
    );
    this.reconnectAttempt++;
    this.state = 'reconnecting';
    this.emit('connection_change', { state: 'reconnecting', attempt: this.reconnectAttempt, delayMs: delay });

    this.reconnectTimer = setTimeout(async () => {
      await this.connect();
    }, delay);
  }

  // ─── Disconnect ─────────────────────────────────────────

  disconnect(): void {
    this.stopMockMode();
    this.cleanupTimers();
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    this.ws?.close();
    this.ws = null;
    this.state = 'disconnected';
    this.emit('connection_change', { state: 'disconnected' });
  }

  private cleanupTimers(): void {
    if (this.pingTimer) { clearInterval(this.pingTimer); this.pingTimer = null; }
  }

  // ─── Subscriptions ──────────────────────────────────────

  subscribe(symbol: string, type: BinanceStreamType = 'ticker'): void {
    const streamName = this.toStreamName(symbol, type);
    if (this.subscriptions.size >= this.config.maxStreamsPerConnection) {
      this.emit('error', { type: 'subscription_limit' });
      return;
    }
    this.subscriptions.add(streamName);
    this.sendSubscription([streamName]);
  }

  subscribeMulti(symbols: string[], type: BinanceStreamType = 'ticker'): void {
    const newStreams: string[] = [];
    for (const sym of symbols) {
      const name = this.toStreamName(sym, type);
      if (this.subscriptions.size >= this.config.maxStreamsPerConnection) break;
      this.subscriptions.add(name);
      newStreams.push(name);
    }
    this.sendSubscription(newStreams);
  }

  unsubscribe(symbol: string, type: BinanceStreamType = 'ticker'): void {
    const name = this.toStreamName(symbol, type);
    this.subscriptions.delete(name);
    this.sendUnsubscription([name]);
  }

  private resubscribeAll(): void {
    if (this.subscriptions.size > 0) {
      this.sendSubscription([...this.subscriptions]);
    }
  }

  private sendSubscription(streams: string[]): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || this.mockMode || streams.length === 0) return;
    const msg = JSON.stringify({ method: 'SUBSCRIBE', params: streams, id: Date.now() });
    this.ws.send(msg);
  }

  private sendUnsubscription(streams: string[]): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || this.mockMode || streams.length === 0) return;
    this.ws.send(JSON.stringify({ method: 'UNSUBSCRIBE', params: streams, id: Date.now() }));
  }

  // ─── Message Handler ────────────────────────────────────

  private handleMessage(data: any): void {
    // Ping response
    if (data.result === null && data.id) return;

    // Combined stream response: { stream: 'btcusdt@ticker', data: {...} }
    if (data.stream && data.data) {
      this.handleStreamData(data.stream, data.data);
      return;
    }

    // Single stream response
    if (data.e) {
      this.handleStreamData('', data);
      return;
    }
  }

  private handleStreamData(stream: string, raw: any): void {
    const eventType = raw.e;

    if (eventType === '24hrTicker' || (!eventType && raw.c)) {
      this.emit('ticker', this.parseTicker(raw));
      return;
    }

    if (eventType === 'depthUpdate') {
      this.emit('depth', this.parseDepth(raw));
      return;
    }

    if (eventType === 'kline') {
      this.emit('kline', this.parseKline(raw));
      return;
    }

    if (eventType === 'trade') {
      this.emit('trade', {
        symbol: raw.s?.toUpperCase() || stream,
        price: parseFloat(raw.p || '0'),
        quantity: parseFloat(raw.q || '0'),
        timestamp: raw.T || Date.now(),
      });
      return;
    }

    this.emit('raw_message', { stream, data: raw });
  }

  private parseTicker(raw: any): BinanceTicker {
    return {
      symbol: (raw.s || '').toUpperCase(),
      price: parseFloat(raw.c || '0'),
      change: parseFloat(raw.p || '0'),
      changePercent: parseFloat(raw.P || '0'),
      high: parseFloat(raw.h || '0'),
      low: parseFloat(raw.l || '0'),
      volume: parseFloat(raw.v || '0'),
      quoteVolume: parseFloat(raw.q || '0'),
      open: parseFloat(raw.o || '0'),
      close: parseFloat(raw.c || '0'),
      timestamp: raw.E || Date.now(),
    };
  }

  private parseDepth(raw: any): BinanceDepth {
    return {
      symbol: (raw.s || '').toUpperCase(),
      bids: (raw.b || []).map((b: string[]) => ({ price: parseFloat(b[0]), quantity: parseFloat(b[1]) })),
      asks: (raw.a || []).map((a: string[]) => ({ price: parseFloat(a[0]), quantity: parseFloat(a[1]) })),
      timestamp: raw.E || Date.now(),
    };
  }

  private parseKline(raw: any): BinanceKline {
    const k = raw.k || {};
    return {
      symbol: (raw.s || '').toUpperCase(),
      interval: k.i || raw.k?.i || '',
      open: parseFloat(k.o || '0'),
      high: parseFloat(k.h || '0'),
      low: parseFloat(k.l || '0'),
      close: parseFloat(k.c || '0'),
      volume: parseFloat(k.v || '0'),
      timestamp: k.t || raw.E || Date.now(),
    };
  }

  // ─── Mock Mode ──────────────────────────────────────────

  private enterMockMode(resolve: (value: boolean) => void): void {
    this.mockMode = true;
    this.state = 'degraded';
    this.emit('connection_change', { state: 'degraded', reason: 'mock_fallback' });
    this.startMockMode();
    if (resolve) { resolve(true); this.connectResolve = null; }
  }

  private startMockMode(): void {
    // Seed mock prices
    const bases: Record<string, number> = {
      'BTCUSDT': 102000, 'ETHUSDT': 4600, 'BNBUSDT': 700, 'SOLUSDT': 220,
      'XRPUSDT': 3.2, 'ADAUSDT': 1.1, 'DOGEUSDT': 0.35, 'AVAXUSDT': 45,
    };

    this.mockInterval = setInterval(() => {
      const subscribedSymbols = new Set<string>();
      for (const stream of this.subscriptions) {
        const parts = stream.split('@');
        const sym = parts[0].toUpperCase();
        subscribedSymbols.add(sym);
      }

      for (const sym of subscribedSymbols) {
        const base = bases[sym] || this.mockPrices.get(sym) || 100;
        const changePct = (Math.random() - 0.5) * 1.5;
        const price = base * (1 + changePct / 100);
        this.mockPrices.set(sym, price);

        const ticker: BinanceTicker = {
          symbol: sym, price, change: price - base,
          changePercent: changePct,
          high: price * 1.005, low: price * 0.995,
          volume: 1000 + Math.random() * 50000,
          quoteVolume: (1000 + Math.random() * 50000) * price,
          open: base, close: price,
          timestamp: Date.now(),
        };
        this.emit('ticker', ticker);
      }
    }, 1000);
  }

  private stopMockMode(): void {
    if (this.mockInterval) { clearInterval(this.mockInterval); this.mockInterval = null; }
    this.mockMode = false;
  }

  // ─── Diagnostics ────────────────────────────────────────

  getDiagnostics(): BinanceDiagnostic {
    return {
      state: this.state,
      url: this.config.url,
      uptimeMs: this.connectedAt ? Date.now() - this.connectedAt : 0,
      reconnectCount: this.reconnectAttempt,
      messagesReceived: this.messagesReceived,
      subscriptionsCount: this.subscriptions.size,
      lastPingTime: this.lastPingTime,
      lastError: this.lastError || undefined,
      mockMode: this.mockMode,
    };
  }

  // ─── Queries ────────────────────────────────────────────

  getState(): BinanceConnectionState { return this.state; }
  isConnected(): boolean { return this.state === 'connected'; }
  isMockMode(): boolean { return this.mockMode; }
  getSubscriptions(): string[] { return [...this.subscriptions]; }
  getSubscriptionCount(): number { return this.subscriptions.size; }
  getMessagesReceived(): number { return this.messagesReceived; }
}

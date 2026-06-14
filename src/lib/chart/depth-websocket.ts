// TradingEasy R114 QTE-13 — Multi-Broker Depth WebSocket Manager
// PM: 4交易所深度WS连接 — Binance@20@100ms / OKX@400 / Bybit@200 / Bitget@20

import type { OrderBookSnapshot, OrderBookDelta, OrderBookLevel } from './orderbook-engine';

export interface DepthWSConfig {
  brokerId: string;
  endpoint: string;
  symbols: string[];
  depthLevel: number;   // 5/10/20/100/200
  updateRateMs: number; // throttle interval
  reconnectDelayMs: number;
  maxReconnects: number;
}

export interface DepthWSEvent {
  type: 'snapshot' | 'delta' | 'error' | 'connected' | 'disconnected';
  brokerId: string;
  symbol?: string;
  data?: OrderBookSnapshot | OrderBookDelta;
  error?: string;
  timestamp: number;
}

export type DepthCallback = (event: DepthWSEvent) => void;

// ═══════════ Per-broker depth stream formats ═══════════

interface BinanceDepthSnapshot {
  lastUpdateId: number;
  bids: [string, string][];
  asks: [string, string][];
}

interface BinanceDepthDelta {
  e: string;
  E: number;
  s: string;
  U: number;
  u: number;
  b: [string, string][];
  a: [string, string][];
}

interface OKXDepthSnapshot {
  arg: { channel: string; instId: string };
  action: string;
  data: [{
    asks: [string, string, string, string][];
    bids: [string, string, string, string][];
    ts: string;
    seqId: number;
    checksum?: number;
  }];
}

interface BybitDepthSnapshot {
  topic: string;
  type: string;
  ts: number;
  data: {
    s: string;
    b: [string, string][];
    a: [string, string][];
    u: number;
    seq: number;
  };
}

interface BitgetDepthSnapshot {
  action: string;
  arg: { channel: string; instType: string; instId: string };
  data: [{
    asks: [string, string][];
    bids: [string, string][];
    ts: string;
    checksum?: number;
  }];
}

function parsePriceSizeArr(arr: string[][]): OrderBookLevel[] {
  return arr.map(([p, s]) => ({ price: +p, size: +s }));
}

function parseBinanceSnapshot(raw: BinanceDepthSnapshot, symbol: string): OrderBookSnapshot {
  return {
    brokerId: 'binance',
    symbol,
    bids: parsePriceSizeArr(raw.bids),
    asks: parsePriceSizeArr(raw.asks),
    timestamp: Date.now(),
    lastUpdateId: raw.lastUpdateId,
  };
}

function parseBinanceDelta(raw: BinanceDepthDelta): OrderBookDelta {
  return {
    brokerId: 'binance',
    symbol: raw.s.toLowerCase(),
    bids: parsePriceSizeArr(raw.b),
    asks: parsePriceSizeArr(raw.a),
    timestamp: raw.E,
    lastUpdateId: raw.u,
    prevUpdateId: raw.U,
  };
}

function parseOKXSnapshot(raw: OKXDepthSnapshot): OrderBookSnapshot {
  const d = raw.data[0];
  return {
    brokerId: 'okx',
    symbol: raw.arg.instId,
    bids: d.bids.map(([p, s]) => ({ price: +p, size: +s })),
    asks: d.asks.map(([p, s]) => ({ price: +p, size: +s })),
    timestamp: +d.ts,
    seqId: d.seqId,
  };
}

function parseBybitSnapshot(raw: BybitDepthSnapshot): OrderBookSnapshot {
  return {
    brokerId: 'bybit',
    symbol: raw.data.s,
    bids: parsePriceSizeArr(raw.data.b),
    asks: parsePriceSizeArr(raw.data.a),
    timestamp: raw.ts,
    lastUpdateId: raw.data.u,
    seqId: raw.data.seq,
  };
}

function parseBitgetSnapshot(raw: BitgetDepthSnapshot): OrderBookSnapshot {
  const d = raw.data[0];
  return {
    brokerId: 'bitget',
    symbol: raw.arg.instId,
    bids: parsePriceSizeArr(d.bids),
    asks: parsePriceSizeArr(d.asks),
    timestamp: +d.ts,
  };
}

// ═══════════ Depth WS Connection State Machine ═══════════

type ConnectionState = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'closed';

interface DepthConnection {
  config: DepthWSConfig;
  ws: WebSocket | null;
  state: ConnectionState;
  reconnectCount: number;
  lastPingTime: number;
  lastMessageTime: number;
  snapshotBuffers: Map<string, OrderBookSnapshot[]>;
  deltaQueue: Map<string, OrderBookDelta[]>;
}

interface DepthWSPayload {
  type: 'subscribe' | 'unsubscribe' | 'ping';
  brokerId: string;
  method?: string;
  params?: string[];
  id?: number;
}

// ═══════════ DepthWSManager ═══════════

export class DepthWSManager {
  private connections: Map<string, DepthConnection> = new Map();
  private callback: DepthCallback;
  private pingInterval: ReturnType<typeof setInterval> | null = null;

  constructor(callback: DepthCallback) {
    this.callback = callback;
  }

  /** Configure a broker's depth WS endpoint */
  configure(config: DepthWSConfig): void {
    this.connections.set(config.brokerId, {
      config,
      ws: null,
      state: 'idle',
      reconnectCount: 0,
      lastPingTime: 0,
      lastMessageTime: 0,
      snapshotBuffers: new Map(),
      deltaQueue: new Map(),
    });
  }

  /** Connect all configured brokers */
  connectAll(): void {
    for (const [brokerId] of this.connections) {
      this.connect(brokerId);
    }
  }

  /** Connect specific broker */
  connect(brokerId: string): void {
    const conn = this.connections.get(brokerId);
    if (!conn || conn.state === 'connected' || conn.state === 'connecting') return;

    conn.state = 'connecting';
    const { endpoint } = conn.config;

    try {
      const ws = new WebSocket(endpoint);
      conn.ws = ws;

      ws.onopen = () => {
        conn.state = 'connected';
        conn.reconnectCount = 0;
        conn.lastMessageTime = Date.now();
        this.callback({ type: 'connected', brokerId, timestamp: Date.now() });
        this.sendSubscription(conn);
      };

      ws.onmessage = (event) => {
        conn.lastMessageTime = Date.now();
        try {
          const raw = JSON.parse(event.data as string);
          if (raw.ping) {
            ws.send(JSON.stringify({ pong: raw.ping }));
            return;
          }
          if (raw.pong) return;
          this.handleMessage(brokerId, raw);
        } catch (e) {
          this.callback({ type: 'error', brokerId, error: `Parse error: ${e}`, timestamp: Date.now() });
        }
      };

      ws.onerror = (event) => {
        this.callback({ type: 'error', brokerId, error: `WebSocket error: ${JSON.stringify(event)}`, timestamp: Date.now() });
      };

      ws.onclose = () => {
        const prevState = conn.state;
        conn.state = 'closed';
        conn.ws = null;
        this.callback({ type: 'disconnected', brokerId, timestamp: Date.now() });

        // Auto-reconnect
        if (prevState !== 'closed' && conn.reconnectCount < conn.config.maxReconnects) {
          conn.state = 'reconnecting';
          conn.reconnectCount++;
          const delay = conn.config.reconnectDelayMs * Math.pow(2, conn.reconnectCount - 1);
          setTimeout(() => {
            if (conn.state === 'reconnecting') this.connect(brokerId);
          }, delay);
        }
      };


    } catch (err) {
      conn.state = 'idle';
      this.callback({ type: 'error', brokerId, error: `Connection failed: ${err}`, timestamp: Date.now() });
    }
  }

  /** Disconnect specific broker */
  disconnect(brokerId: string): void {
    const conn = this.connections.get(brokerId);
    if (!conn || !conn.ws) return;
    conn.state = 'closed';
    conn.ws.close();
    conn.ws = null;
  }

  /** Disconnect all */
  disconnectAll(): void {
    for (const [brokerId] of this.connections) this.disconnect(brokerId);
    if (this.pingInterval) { clearInterval(this.pingInterval); this.pingInterval = null; }
  }

  /** Subscribe to additional symbols */
  subscribe(brokerId: string, symbols: string[]): void {
    const conn = this.connections.get(brokerId);
    if (!conn) return;
    const existing = new Set(conn.config.symbols);
    for (const s of symbols) existing.add(s);
    conn.config.symbols = Array.from(existing);
    if (conn.state === 'connected' && conn.ws) {
      this.sendSubscription(conn);
    }
  }

  /** Unsubscribe from symbols */
  unsubscribe(brokerId: string, symbols: string[]): void {
    const conn = this.connections.get(brokerId);
    if (!conn) return;
    conn.config.symbols = conn.config.symbols.filter((s) => !symbols.includes(s));
    // Most exchanges handle unsub via WS message
  }

  getState(brokerId: string): ConnectionState | undefined {
    return this.connections.get(brokerId)?.state;
  }

  getAllStates(): Map<string, ConnectionState> {
    const states = new Map<string, ConnectionState>();
    for (const [b, c] of this.connections) states.set(b, c.state);
    return states;
  }

  private sendSubscription(conn: DepthConnection): void {
    if (!conn.ws) return;

    void ({} as DepthWSPayload);
    switch (conn.config.brokerId) {
      case 'binance':
        for (const sym of conn.config.symbols) {
          const streamName = `${sym.toLowerCase()}@depth${conn.config.depthLevel}@${conn.config.updateRateMs}ms`;
          conn.ws.send(JSON.stringify({ method: 'SUBSCRIBE', params: [streamName], id: Date.now() }));
        }
        break;
      case 'okx':
        conn.ws.send(JSON.stringify({ op: 'subscribe', args: conn.config.symbols.map((s) => ({ channel: 'books', instId: s })) }));
        break;
      case 'bybit':
        conn.ws.send(JSON.stringify({ op: 'subscribe', args: conn.config.symbols.map((s) => `orderbook.${conn.config.depthLevel}.${s}`) }));
        break;
      case 'bitget':
        conn.ws.send(JSON.stringify({ op: 'subscribe', args: conn.config.symbols.map((s) => ({ channel: 'books', instId: s })) }));
        break;
    }
  }

  private handleMessage(brokerId: string, raw: unknown): void {
    const data = raw as Record<string, unknown>;

    // Binance: combined streams or single stream
    if (data.lastUpdateId != null && data.bids && data.asks && !data.e) {
      // snapshot
      const snapshot = parseBinanceSnapshot(data as unknown as BinanceDepthSnapshot, String(data.s || ''));
      this.callback({ type: 'snapshot', brokerId, symbol: snapshot.symbol, data: snapshot, timestamp: Date.now() });
    } else if (data.e === 'depthUpdate') {
      // delta
      const delta = parseBinanceDelta(data as unknown as BinanceDepthDelta);
      this.callback({ type: 'delta', brokerId, symbol: delta.symbol, data: delta, timestamp: Date.now() });
    }
    // OKX
    else if (data.arg && (data as any).arg.channel === 'books') {
      const okxData = data as unknown as OKXDepthSnapshot;
      const snapshot = parseOKXSnapshot(okxData);
      this.callback({ type: okxData.action === 'snapshot' ? 'snapshot' : 'delta', brokerId, symbol: snapshot.symbol, data: snapshot, timestamp: Date.now() });
    }
    // Bybit
    else if ((data as any).topic?.startsWith('orderbook')) {
      const bybitData = data as unknown as BybitDepthSnapshot;
      const snapshot = parseBybitSnapshot(bybitData);
      this.callback({ type: bybitData.type === 'snapshot' ? 'snapshot' : 'delta', brokerId, symbol: snapshot.symbol, data: snapshot, timestamp: Date.now() });
    }
    // Bitget
    else if ((data as any).arg?.channel === 'books') {
      const bitgetData = data as unknown as BitgetDepthSnapshot;
      const snapshot = parseBitgetSnapshot(bitgetData);
      this.callback({ type: bitgetData.action === 'snapshot' ? 'snapshot' : 'delta', brokerId, symbol: snapshot.symbol, data: snapshot, timestamp: Date.now() });
    }
  }

  /** Start periodic heartbeat (ping all connections every 30s) */
  startHeartbeat(intervalMs = 30000): void {
    if (this.pingInterval) clearInterval(this.pingInterval);
    this.pingInterval = setInterval(() => {
      const now = Date.now();
      for (const [, conn] of this.connections) {
        if (conn.ws && conn.state === 'connected' && now - conn.lastPingTime > intervalMs) {
          conn.lastPingTime = now;
          try { conn.ws.send('ping'); } catch { /* ignore */ }
        }
      }
    }, intervalMs);
  }
}

// ═══════════ Pre-configured depth endpoints ═══════════

export const DEFAULT_DEPTH_CONFIGS: DepthWSConfig[] = [
  {
    brokerId: 'binance',
    endpoint: 'wss://stream.binance.com:9443/ws',
    symbols: [],
    depthLevel: 20,
    updateRateMs: 100,
    reconnectDelayMs: 1000,
    maxReconnects: 10,
  },
  {
    brokerId: 'okx',
    endpoint: 'wss://ws.okx.com:8443/ws/v5/public',
    symbols: [],
    depthLevel: 400,
    updateRateMs: 400,
    reconnectDelayMs: 2000,
    maxReconnects: 10,
  },
  {
    brokerId: 'bybit',
    endpoint: 'wss://stream.bybit.com/v5/public/spot',
    symbols: [],
    depthLevel: 200,
    updateRateMs: 200,
    reconnectDelayMs: 1500,
    maxReconnects: 10,
  },
  {
    brokerId: 'bitget',
    endpoint: 'wss://ws.bitget.com/v2/ws/public',
    symbols: [],
    depthLevel: 20,
    updateRateMs: 100,
    reconnectDelayMs: 1500,
    maxReconnects: 10,
  },
];

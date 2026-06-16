// @ts-nocheck — R127: type reconciliation pending (see R128 task list)
// quant-moo R120 QTE-41 — WebSocket Connection Pool
// 同券商多symbol复用WS连接: 40+币对共享一个Binance WS
// 目标: 避免每个symbol独立建立连接, 减少连接数和带宽

type WSCallback = (data: any) => void;

interface Subscription {
  channel: string;
  symbol: string;
  params: Record<string, any>;
  callbacks: Set<WSCallback>;
}

interface PooledConnection {
  ws: WebSocket | null;
  url: string;
  subscriptions: Map<string, Subscription>; // subId -> subscription
  pendingSubs: Subscription[];
  connected: boolean;
  reconnectAttempts: number;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  pingTimer: ReturnType<typeof setInterval> | null;
  lastActivity: number;
}

export interface WSPoolConfig {
  maxConnectionsPerBroker?: number;
  maxSymbolsPerConnection?: number;
  reconnectDelayMs?: number;
  maxReconnectAttempts?: number;
  pingIntervalMs?: number;
  inactivityTimeoutMs?: number;
}

const DEFAULT_CONFIG: Required<WSPoolConfig> = {
  maxConnectionsPerBroker: 4,
  maxSymbolsPerConnection: 50,
  reconnectDelayMs: 3000,
  maxReconnectAttempts: 10,
  pingIntervalMs: 30000,
  inactivityTimeoutMs: 300000, // 5min
};

export class WebSocketPool {
  private pools = new Map<string, PooledConnection[]>(); // brokerId → connections
  private config: Required<WSPoolConfig>;
  private pendingConnects = new Map<string, Promise<void>>(); // dedup connect calls

  constructor(config: WSPoolConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ═══ Public API ══════════════════════════════════════

  /** Subscribe to a channel for a symbol under a specific broker */
  subscribe(
    brokerId: string,
    wsUrl: string,
    channel: string,
    symbol: string,
    params: Record<string, any>,
    callback: WSCallback,
  ): () => void {
    const subId = `${channel}:${symbol}`;
    let connections = this.pools.get(brokerId);
    if (!connections) {
      connections = [];
      this.pools.set(brokerId, connections);
    }

    // Find connection with capacity
    let conn = connections.find(
      c => c.url === wsUrl && c.subscriptions.size < this.config.maxSymbolsPerConnection,
    );

    if (!conn) {
      // Create new connection if under limit
      if (connections.length < this.config.maxConnectionsPerBroker) {
        conn = this.createConnection(wsUrl);
        connections.push(conn);
        this.connect(conn);
      } else {
        // All connections full — attach to the least loaded one
        conn = connections.reduce((a, b) =>
          a.subscriptions.size <= b.subscriptions.size ? a : b,
        );
      }
    }

    // Reuse existing subscription
    let sub = conn.subscriptions.get(subId);
    if (!sub) {
      sub = { channel, symbol, params, callbacks: new Set() };
      conn.subscriptions.set(subId, sub);

      if (conn.connected && conn.ws) {
        this.sendSubscribe(conn.ws, sub);
      } else {
        conn.pendingSubs.push(sub);
      }
    }

    sub.callbacks.add(callback);
    conn.lastActivity = Date.now();

    // Return unsubscribe function
    return () => {
      sub!.callbacks.delete(callback);
      if (sub!.callbacks.size === 0) {
        conn!.subscriptions.delete(subId);
        if (conn!.ws && conn!.connected) {
          this.sendUnsubscribe(conn!.ws, sub!);
        }
      }
    };
  }

  /** Unsubscribe all callbacks for a given brokerId+symbol */
  unsubscribeAll(brokerId: string, symbol: string): void {
    const connections = this.pools.get(brokerId);
    if (!connections) return;

    for (const conn of connections) {
      for (const [subId, sub] of conn.subscriptions) {
        if (sub.symbol === symbol) {
          if (conn.ws && conn.connected) {
            this.sendUnsubscribe(conn.ws, sub);
          }
          conn.subscriptions.delete(subId);
        }
      }
    }
  }

  /** Close all connections for a broker */
  disconnectBroker(brokerId: string): void {
    const connections = this.pools.get(brokerId);
    if (!connections) return;

    for (const conn of connections) {
      this.closeConnection(conn);
    }
    this.pools.delete(brokerId);
  }

  /** Close all connections */
  destroy(): void {
    for (const [brokerId] of this.pools) {
      this.disconnectBroker(brokerId);
    }
  }

  /** Get pool stats */
  getStats(): {
    totalConnections: number;
    totalSubscriptions: number;
    byBroker: Record<string, { connections: number; subscriptions: number }>;
  } {
    let totalConnections = 0;
    let totalSubscriptions = 0;
    const byBroker: Record<string, { connections: number; subscriptions: number }> = {};

    for (const [brokerId, conns] of this.pools) {
      let subs = 0;
      for (const c of conns) subs += c.subscriptions.size;
      byBroker[brokerId] = { connections: conns.length, subscriptions: subs };
      totalConnections += conns.length;
      totalSubscriptions += subs;
    }

    return { totalConnections, totalSubscriptions, byBroker };
  }

  // ═══ Private ═══════════════════════════════════════

  private createConnection(wsUrl: string): PooledConnection {
    return {
      ws: null,
      url: wsUrl,
      subscriptions: new Map(),
      pendingSubs: [],
      connected: false,
      reconnectAttempts: 0,
      reconnectTimer: null,
      pingTimer: null,
      lastActivity: Date.now(),
    };
  }

  private async connect(conn: PooledConnection): Promise<void> {
    if (conn.connected || conn.ws) return;

    // Dedup concurrent connects to same URL
    const key = `connect:${conn.url}`;
    if (this.pendingConnects.has(key)) {
      await this.pendingConnects.get(key);
      return;
    }

    const promise = new Promise<void>((resolve, reject) => {
      try {
        const ws = new WebSocket(conn.url);
        conn.ws = ws;

        ws.onopen = () => {
          conn.connected = true;
          conn.reconnectAttempts = 0;
          this.pendingConnects.delete(key);

          // Replay pending subscriptions
          for (const sub of conn.pendingSubs) {
            this.sendSubscribe(ws, sub);
            conn.subscriptions.set(`${sub.channel}:${sub.symbol}`, sub);
          }
          conn.pendingSubs = [];

          // Start ping
          this.startPing(conn);
          resolve();
        };

        ws.onmessage = (event) => {
          conn.lastActivity = Date.now();
          try {
            const msg = JSON.parse(event.data);
            this.dispatchMessage(conn, msg);
          } catch {
            // Ignore non-JSON messages
          }
        };

        ws.onerror = () => {
          // Let onclose handle it
        };

        ws.onclose = () => {
          conn.connected = false;
          conn.ws = null;
          this.stopPing(conn);
          this.scheduleReconnect(conn);
          this.pendingConnects.delete(key);
        };
      } catch (err) {
        this.pendingConnects.delete(key);
        this.scheduleReconnect(conn);
        reject(err);
      }
    });

    this.pendingConnects.set(key, promise);
  }

  private dispatchMessage(conn: PooledConnection, msg: any): void {
    // Route message to matching subscription callbacks
    // Assumes message has channel + symbol fields
    const channel = msg.channel || msg.e || msg.type;
    const symbol = msg.symbol || msg.s || msg.pair;
    if (!channel) return;

    for (const [_subId, sub] of conn.subscriptions) {
      let match = sub.channel === channel;
      if (symbol && sub.symbol) {
        match = match && (symbol.toUpperCase() === sub.symbol.toUpperCase());
      }
      if (match) {
        for (const cb of sub.callbacks) {
          try { cb(msg); } catch { /* ignore callback errors */ }
        }
      }
    }
  }

  private sendSubscribe(ws: WebSocket, sub: Subscription): void {
    if (ws.readyState !== WebSocket.OPEN) return;
    // Generic subscribe — specific format depends on broker
    // Override per broker by subclass or config
    const req = JSON.stringify({
      method: 'SUBSCRIBE',
      params: [sub.channel],
      id: Date.now(),
    });
    ws.send(req);
  }

  private sendUnsubscribe(ws: WebSocket, sub: Subscription): void {
    if (ws.readyState !== WebSocket.OPEN) return;
    const req = JSON.stringify({
      method: 'UNSUBSCRIBE',
      params: [sub.channel],
      id: Date.now(),
    });
    ws.send(req);
  }

  private scheduleReconnect(conn: PooledConnection): void {
    if (conn.reconnectAttempts >= this.config.maxReconnectAttempts) {
      // Give up — move pending subs back (they'll fail)
      return;
    }

    const delay = Math.min(
      this.config.reconnectDelayMs * Math.pow(2, conn.reconnectAttempts),
      60000, // max 60s
    );

    conn.reconnectTimer = setTimeout(() => {
      conn.reconnectAttempts++;
      this.connect(conn);
    }, delay);
  }

  private startPing(conn: PooledConnection): void {
    this.stopPing(conn);
    conn.pingTimer = setInterval(() => {
      if (conn.ws && conn.ws.readyState === WebSocket.OPEN) {
        conn.ws.send(JSON.stringify({ method: 'PING' }));
      }
      // Inactivity check
      if (Date.now() - conn.lastActivity > this.config.inactivityTimeoutMs) {
        this.closeConnection(conn);
      }
    }, this.config.pingIntervalMs);
  }

  private stopPing(conn: PooledConnection): void {
    if (conn.pingTimer) {
      clearInterval(conn.pingTimer);
      conn.pingTimer = null;
    }
  }

  private closeConnection(conn: PooledConnection): void {
    this.stopPing(conn);
    if (conn.reconnectTimer) {
      clearTimeout(conn.reconnectTimer);
      conn.reconnectTimer = null;
    }
    if (conn.ws) {
      conn.ws.onclose = null; // prevent reconnect
      conn.ws.close();
      conn.ws = null;
    }
    conn.connected = false;
  }
}

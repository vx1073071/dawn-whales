
/**
 * QUANT MOO R129 J02 — WebSocket Push Service
 * 
 * Server-side WS server for pushing real-time updates to desktop clients.
 * Handles: connection/auth/heartbeat/reconnection + broker quote pushes.
 * 
 * Communication protocol:
 *   Server → Client: JSON { type, payload, timestamp }
 *   Client → Server: JSON { type, payload } (subscribe, ping)
 * 
 * Auth: JWT token via ws auth query param (?token=xxx)
 */

import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';

// ═══════════════ Types ════════════════════════════════════

type WSPayload = Record<string, unknown>;

interface WSMessage {
  type: string;
  payload: WSPayload;
  timestamp?: number;
}

interface AuthenticatedSocket extends WebSocket {
  userId?: string;
  subscribedBrokers?: Set<string>;
  subscribedSymbols?: Set<string>;
  lastHeartbeat?: number;
  isAlive?: boolean;
}

interface WSPushServiceConfig {
  /** JWT secret for authenticating ws connections */
  jwtSecret: string;
  /** Heartbeat interval in ms (default 30000) */
  heartbeatIntervalMs: number;
  /** Connection timeout in ms (default 120000) */
  connectionTimeoutMs: number;
  /** Max concurrent connections */
  maxConnections: number;
}

// ═══════════════ Service ═════════════════════════════════

export class WSPushService {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, AuthenticatedSocket> = new Map();
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private readonly config: WSPushServiceConfig;

  constructor(config: WSPushServiceConfig) {
    this.config = {
      heartbeatIntervalMs: 30000,
      connectionTimeoutMs: 120000,
      maxConnections: 1000,
      ...config,
    };
  }

  // ── Server Lifecycle ──────────────────────────────────

  /** Initialize WS server on existing HTTP server */
  initialize(httpServer: HttpServer, path = '/ws'): void {
    this.wss = new WebSocketServer({ server: httpServer, path });

    this.wss.on('connection', (socket: AuthenticatedSocket, req) => {
      if (this.clients.size >= this.config.maxConnections) {
        socket.close(1013, 'Max connections reached');
        return;
      }

      // Auth: extract JWT from query params
      const url = new URL(req.url || '/', `http://${req.headers.host}`);
      const token = url.searchParams.get('token');
      if (!token) {
        socket.close(4001, 'Missing auth token');
        return;
      }

      const userId = this.verifyToken(token);
      if (!userId) {
        socket.close(4002, 'Invalid auth token');
        return;
      }

      socket.userId = userId;
      socket.subscribedBrokers = new Set();
      socket.subscribedSymbols = new Set();
      socket.isAlive = true;
      socket.lastHeartbeat = Date.now();

      const connId = `${userId}-${Date.now()}`;
      this.clients.set(connId, socket);

      // Send welcome
      this.send(socket, {
        type: 'connected',
        payload: { connectionId: connId, serverTime: Date.now() },
      });

      // Handle incoming messages
      socket.on('message', (data) => {
        try {
          const msg: WSMessage = JSON.parse(data.toString());
          this.handleMessage(socket, msg);
        } catch {
          this.send(socket, { type: 'error', payload: { message: 'Invalid JSON' } });
        }
      });

      // Heartbeat pong
      socket.on('pong', () => {
        socket.isAlive = true;
        socket.lastHeartbeat = Date.now();
      });

      socket.on('close', () => {
        this.clients.delete(connId);
      });

      socket.on('error', () => {
        this.clients.delete(connId);
      });
    });

    // Start heartbeat
    this.heartbeatTimer = setInterval(() => {
      this.clients.forEach((socket, id) => {
        if (!socket.isAlive) {
          const sinceLastBeat = Date.now() - (socket.lastHeartbeat || 0);
          if (sinceLastBeat > this.config.connectionTimeoutMs) {
            socket.terminate();
            this.clients.delete(id);
            return;
          }
        }
        socket.isAlive = false;
        socket.ping();
      });
    }, this.config.heartbeatIntervalMs);
  }

  // ── Server Broadcast ═════════════════════════════════

  /** Push to all clients */
  broadcast(type: string, payload: WSPayload): void {
    this.clients.forEach((socket) => {
      this.send(socket, { type, payload });
    });
  }

  /** Push to specific user */
  sendToUser(userId: string, type: string, payload: WSPayload): void {
    this.clients.forEach((socket) => {
      if (socket.userId === userId) {
        this.send(socket, { type, payload });
      }
    });
  }

  /** Push to clients subscribed to a broker */
  sendToBrokerSubscribers(brokerId: string, type: string, payload: WSPayload): void {
    this.clients.forEach((socket) => {
      if (socket.subscribedBrokers?.has(brokerId)) {
        this.send(socket, { type, payload });
      }
    });
  }

  // ── Public Push Methods (called by broker adapters) ──

  pushQuote(userId: string, quote: { brokerId: string; symbol: string; price: number; change: number; changePct: number; timestamp: number }): void {
    this.sendToUser(userId, 'quote:update', quote as unknown as WSPayload);
  }

  pushOrderUpdate(userId: string, order: { brokerId: string; orderId: string; symbol: string; status: string; filledQuantity: number; filledPrice: number }): void {
    this.sendToUser(userId, 'order:update', order as unknown as WSPayload);
  }

  pushTrade(userId: string, trade: { brokerId: string; symbol: string; side: string; quantity: number; price: number; timestamp: number }): void {
    this.sendToUser(userId, 'trade:executed', trade as unknown as WSPayload);
  }

  pushNotification(userId: string, notification: { level: 'info' | 'warning' | 'error'; message: string; timestamp: number }): void {
    this.sendToUser(userId, 'notification:push', notification as unknown as WSPayload);
  }

  // ── Status ──────────────────────────────────────────

  getStats(): { totalConnections: number; connectionsByUser: Record<string, number> } {
    const byUser: Record<string, number> = {};
    this.clients.forEach((s) => {
      if (s.userId) {
        byUser[s.userId] = (byUser[s.userId] || 0) + 1;
      }
    });
    return {
      totalConnections: this.clients.size,
      connectionsByUser: byUser,
    };
  }

  // ── Shutdown ────────────────────────────────────────

  async shutdown(): Promise<void> {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this.clients.forEach((socket) => {
      socket.close(1001, 'Server shutting down');
    });
    this.clients.clear();
    if (this.wss) {
      return new Promise((resolve) => {
        this.wss!.close(() => resolve());
      });
    }
  }

  // ═══════════════ Private ═════════════════════════════

  private handleMessage(socket: AuthenticatedSocket, msg: WSMessage): void {
    switch (msg.type) {
      case 'subscribe:broker': {
        const brokerId = msg.payload?.brokerId as string;
        if (brokerId) socket.subscribedBrokers?.add(brokerId);
        this.send(socket, { type: 'subscribed:broker', payload: { brokerId } });
        break;
      }
      case 'unsubscribe:broker': {
        const brokerId = msg.payload?.brokerId as string;
        if (brokerId) socket.subscribedBrokers?.delete(brokerId);
        this.send(socket, { type: 'unsubscribed:broker', payload: { brokerId } });
        break;
      }
      case 'subscribe:symbols': {
        const symbols = msg.payload?.symbols as string[];
        if (symbols) symbols.forEach((s) => socket.subscribedSymbols?.add(s));
        this.send(socket, { type: 'subscribed:symbols', payload: { symbols } });
        break;
      }
      case 'ping': {
        this.send(socket, { type: 'pong', payload: { serverTime: Date.now() } });
        break;
      }
      default:
        // Forward to broker handler if applicable
        break;
    }
  }

  private send(socket: AuthenticatedSocket, msg: WSMessage): void {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ ...msg, timestamp: msg.timestamp || Date.now() }));
    }
  }

  private verifyToken(token: string): string | null {
    try {
      // JWT verification — imported from jwt module
      // Uses HS256 with the configured secret
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, this.config.jwtSecret) as { sub?: string };
      return decoded.sub || null;
    } catch {
      return null;
    }
  }
}

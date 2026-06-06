// JVS-112: 实时WebSocket连接管理
// 支持多客户端连接、连接状态监控、自动重连机制

import WebSocket from 'ws';
import { EventEmitter } from 'events';
import log from 'electron-log';

export interface WebSocketClient {
  id: string;
  ws: WebSocket;
  connectedAt: Date;
  lastPing: Date;
  subscriptions: Set<string>;
}

export interface WebSocketManagerConfig {
  port?: number;
  pingInterval?: number;
  pingTimeout?: number;
  maxClients?: number;
}

export class WebSocketManager extends EventEmitter {
  private wss: WebSocket.Server | null = null;
  private clients: Map<string, WebSocketClient> = new Map();
  private pingInterval: NodeJS.Timeout | null = null;
  private config: Required<WebSocketManagerConfig>;
  private isRunning = false;

  constructor(config?: WebSocketManagerConfig) {
    super();
    this.config = {
      port: config?.port ?? 8765,
      pingInterval: config?.pingInterval ?? 30000,
      pingTimeout: config?.pingTimeout ?? 10000,
      maxClients: config?.maxClients ?? 100,
    };
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      log.warn('[WS Manager] Already running');
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        this.wss = new WebSocket.Server({ port: this.config.port });

        this.wss.on('listening', () => {
          log.info(`[WS Manager] WebSocket server listening on port ${this.config.port}`);
          this.isRunning = true;
          this.startPingInterval();
          this.emit('started');
          resolve();
        });

        this.wss.on('connection', (ws: WebSocket) => {
          this.handleConnection(ws);
        });

        this.wss.on('error', (error) => {
          log.error('[WS Manager] Server error:', error);
          this.emit('error', error);
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  async stop(): Promise<void> {
    if (!this.isRunning || !this.wss) {
      return;
    }

    this.stopPingInterval();

    // Close all client connections
    for (const [id, client] of this.clients) {
      try {
        client.ws.close(1000, 'Server shutting down');
      } catch (error) {
        log.error(`[WS Manager] Error closing client ${id}:`, error);
      }
    }

    this.clients.clear();

    return new Promise((resolve) => {
      this.wss!.close(() => {
        this.isRunning = false;
        this.wss = null;
        log.info('[WS Manager] Server stopped');
        this.emit('stopped');
        resolve();
      });
    });
  }

  private handleConnection(ws: WebSocket): void {
    if (this.clients.size >= this.config.maxClients) {
      log.warn('[WS Manager] Max clients reached, rejecting connection');
      ws.close(1013, 'Max clients reached');
      return;
    }

    const clientId = this.generateClientId();
    const client: WebSocketClient = {
      id: clientId,
      ws,
      connectedAt: new Date(),
      lastPing: new Date(),
      subscriptions: new Set(),
    };

    this.clients.set(clientId, client);
    log.info(`[WS Manager] Client connected: ${clientId} (total: ${this.clients.size})`);
    this.emit('client:connected', clientId);

    ws.on('message', (data) => {
      this.handleMessage(clientId, data.toString());
    });

    ws.on('close', (code, reason) => {
      this.handleDisconnection(clientId, code, reason.toString());
    });

    ws.on('error', (error) => {
      log.error(`[WS Manager] Client ${clientId} error:`, error);
      this.emit('client:error', clientId, error);
    });

    ws.on('pong', () => {
      client.lastPing = new Date();
    });
  }

  private handleMessage(clientId: string, message: string): void {
    try {
      const data = JSON.parse(message);
      log.debug(`[WS Manager] Message from ${clientId}:`, data);

      // Handle subscription requests
      if (data.type === 'subscribe' && data.channel) {
        const client = this.clients.get(clientId);
        if (client) {
          client.subscriptions.add(data.channel);
          log.info(`[WS Manager] Client ${clientId} subscribed to ${data.channel}`);
          
          // Send confirmation
          this.sendToClient(clientId, {
            type: 'subscribed',
            channel: data.channel,
          });
        }
      } else if (data.type === 'unsubscribe' && data.channel) {
        const client = this.clients.get(clientId);
        if (client) {
          client.subscriptions.delete(data.channel);
          log.info(`[WS Manager] Client ${clientId} unsubscribed from ${data.channel}`);
          
          this.sendToClient(clientId, {
            type: 'unsubscribed',
            channel: data.channel,
          });
        }
      } else {
        // Forward to event emitter for other handlers
        this.emit('message', clientId, data);
      }
    } catch (error) {
      log.error(`[WS Manager] Error parsing message from ${clientId}:`, error);
    }
  }

  private handleDisconnection(clientId: string, code: number, reason: string): void {
    this.clients.delete(clientId);
    log.info(`[WS Manager] Client disconnected: ${clientId} (code: ${code}, reason: ${reason})`);
    this.emit('client:disconnected', clientId, code, reason);
  }

  private startPingInterval(): void {
    this.pingInterval = setInterval(() => {
      for (const [id, client] of this.clients) {
        const timeSinceLastPing = Date.now() - client.lastPing.getTime();
        
        if (timeSinceLastPing > this.config.pingTimeout) {
          log.warn(`[WS Manager] Client ${id} ping timeout, terminating`);
          client.ws.terminate();
          this.clients.delete(id);
          this.emit('client:timeout', id);
        } else {
          try {
            client.ws.ping();
          } catch (error) {
            log.error(`[WS Manager] Error pinging client ${id}:`, error);
          }
        }
      }
    }, this.config.pingInterval);
  }

  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Public API

  sendToClient(clientId: string, data: any): boolean {
    const client = this.clients.get(clientId);
    if (!client || client.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      client.ws.send(JSON.stringify(data));
      return true;
    } catch (error) {
      log.error(`[WS Manager] Error sending to ${clientId}:`, error);
      return false;
    }
  }

  broadcast(channel: string, data: any): number {
    const message = JSON.stringify({ type: 'data', channel: channel, data });
    let sentCount = 0;

    for (const [id, client] of this.clients) {
      if (client.ws.readyState === WebSocket.OPEN && client.subscriptions.has(channel)) {
        try {
          client.ws.send(message);
          sentCount++;
        } catch (error) {
          log.error(`[WS Manager] Error broadcasting to ${id}:`, error);
        }
      }
    }

    return sentCount;
  }

  getStats(): {
    totalClients: number;
    channels: Map<string, number>;
    uptime: number;
  } {
    const channels = new Map<string, number>();
    
    for (const client of this.clients.values()) {
      for (const channel of client.subscriptions) {
        channels.set(channel, (channels.get(channel) || 0) + 1);
      }
    }

    return {
      totalClients: this.clients.size,
      channels,
      uptime: this.isRunning ? Date.now() - (this.wss?.address() as any)?.port : 0,
    };
  }

  getClientCount(): number {
    return this.clients.size;
  }

  isClientConnected(clientId: string): boolean {
    const client = this.clients.get(clientId);
    return client !== undefined && client.ws.readyState === WebSocket.OPEN;
  }

  getClientSubscriptions(clientId: string): string[] {
    const client = this.clients.get(clientId);
    return client ? Array.from(client.subscriptions) : [];
  }

  getSubscribedClients(channel: string): string[] {
    const clients: string[] = [];
    for (const [id, client] of this.clients) {
      if (client.subscriptions.has(channel)) {
        clients.push(id);
      }
    }
    return clients;
  }
}

// Singleton instance
let managerInstance: WebSocketManager | null = null;

export function getWebSocketManager(config?: WebSocketManagerConfig): WebSocketManager {
  if (!managerInstance) {
    managerInstance = new WebSocketManager(config);
  }
  return managerInstance;
}

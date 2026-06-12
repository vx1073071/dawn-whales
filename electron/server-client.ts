// ── R129-M01 server-client.ts — 桌面端服务器通信客户端 ──────────────────
// PM: JWT认证 + 30s心跳 + 指数退避重连 + 信号发送
// 桌面端通过此模块与 Express 服务器通信 (24h跟单)

import { EventEmitter } from 'events';

// ═══════════ Types ═══════════

export type ServerStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface ServerConfig {
  url: string;          // e.g. 'https://api.dawnwhales.com'
  apiKey: string;       // AES-256-GCM encrypted on wire
  jwtToken?: string;    // JWT from server after auth
  refreshToken?: string;
}

export interface SignalPayload {
  signalId: string;
  symbol: string;
  side: 'buy' | 'sell';
  price: number;
  amount: number;
  strategyId: string;
  brokerId: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface ServerEventMap {
  status: [ServerStatus, string?];           // status, error msg
  signal: [SignalPayload];                    // incoming signal from server
  heartbeat: [{ latency: number }];           // heartbeat response
  authResult: [{ success: boolean; error?: string }];
}

// ═══════════ ServerClient ═══════════

export class ServerClient extends EventEmitter {
  private config: ServerConfig;
  private status: ServerStatus = 'disconnected';
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private readonly maxReconnectDelay = 30_000; // 30s max backoff
  private readonly baseReconnectDelay = 1_000; // 1s base
  private ws: WebSocket | null = null;

  constructor(config: Partial<ServerConfig> = {}) {
    super();
    this.config = {
      url: config.url || 'https://localhost:3000',
      apiKey: config.apiKey || '',
      jwtToken: config.jwtToken,
      refreshToken: config.refreshToken,
    };
  }

  // ── Public API ──

  setConfig(patch: Partial<ServerConfig>) {
    Object.assign(this.config, patch);
  }

  getConfig(): ServerConfig {
    return { ...this.config };
  }

  getStatus(): ServerStatus {
    return this.status;
  }

  isConnected(): boolean {
    return this.status === 'connected';
  }

  // ── Connect / Disconnect ──

  async connect(): Promise<boolean> {
    if (this.status === 'connected' || this.status === 'connecting') return true;

    this.setStatus('connecting');
    this.reconnectAttempt = 0;

    try {
      // Step 1: Authenticate via REST (JWT)
      const jwtData = await this.authenticate();
      if (!jwtData) {
        this.setStatus('error', 'Authentication failed');
        this.scheduleReconnect();
        return false;
      }

      // Step 2: Open WebSocket
      const wsUrl = this.config.url
        .replace('https://', 'wss://')
        .replace('http://', 'ws://')
        + `/ws?token=${this.config.jwtToken}`;

      this.ws = new WebSocket(wsUrl);

      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          this.setStatus('error', 'WebSocket connection timeout');
          resolve(false);
        }, 10_000);

        this.ws!.onopen = () => {
          clearTimeout(timeout);
          this.setStatus('connected');
          this.reconnectAttempt = 0;
          this.startHeartbeat();
          resolve(true);
        };

        this.ws!.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            this.handleServerMessage(msg);
          } catch { /* ignore invalid JSON */ }
        };

        this.ws!.onclose = (event) => {
          this.stopHeartbeat();
          this.ws = null;
          if (this.status === 'connected') {
            this.setStatus('disconnected', `Connection closed: ${event.code}`);
            this.scheduleReconnect();
          }
        };

        this.ws!.onerror = () => {
          clearTimeout(timeout);
          this.stopHeartbeat();
          this.ws = null;
          this.setStatus('error', 'WebSocket error');
          resolve(false);
          this.scheduleReconnect();
        };
      });
    } catch (err: any) {
      this.setStatus('error', err.message || 'Connection failed');
      this.scheduleReconnect();
      return false;
    }
  }

  disconnect() {
    this.cancelReconnect();
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    this.setStatus('disconnected');
  }

  // ── Send signal to server ──

  async sendSignal(signal: Omit<SignalPayload, 'signalId' | 'timestamp'>): Promise<{ success: boolean; error?: string }> {
    if (!this.isConnected()) return { success: false, error: 'Not connected to server' };

    const payload: SignalPayload = {
      ...signal,
      signalId: `s-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
    };

    try {
      const resp = await fetch(`${this.config.url}/api/signal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.jwtToken}`,
          'X-API-Key': this.config.apiKey,
        },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: resp.statusText }));
        return { success: false, error: err.error || `HTTP ${resp.status}` };
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error' };
    }
  }

  // ── Private methods ──

  private async authenticate(): Promise<{ accessToken: string; refreshToken: string } | null> {
    try {
      const resp = await fetch(`${this.config.url}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': this.config.apiKey },
        body: JSON.stringify({ apiKey: this.config.apiKey }),
      });

      if (!resp.ok) {
        this.emit('authResult', { success: false, error: `Auth failed: HTTP ${resp.status}` });
        return null;
      }

      const data = await resp.json();
      this.config.jwtToken = data.accessToken;
      this.config.refreshToken = data.refreshToken;
      this.emit('authResult', { success: true });
      return data;
    } catch (err: any) {
      this.emit('authResult', { success: false, error: err.message });
      return null;
    }
  }

  private async refreshJWT(): Promise<boolean> {
    if (!this.config.refreshToken) return false;
    try {
      const resp = await fetch(`${this.config.url}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: this.config.refreshToken }),
      });
      if (!resp.ok) return false;
      const data = await resp.json();
      this.config.jwtToken = data.accessToken;
      this.config.refreshToken = data.refreshToken || this.config.refreshToken;
      return true;
    } catch {
      return false;
    }
  }

  // ── Heartbeat ──

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(async () => {
      if (!this.isConnected()) return;
      const start = Date.now();
      try {
        const resp = await fetch(`${this.config.url}/api/heartbeat`, {
          headers: { 'Authorization': `Bearer ${this.config.jwtToken}` },
        });
        if (resp.status === 401) {
          // Token expired, try refresh
          const refreshed = await this.refreshJWT();
          if (!refreshed) {
            this.disconnect();
            this.scheduleReconnect();
          }
          return;
        }
        const latency = Date.now() - start;
        this.emit('heartbeat', { latency });
      } catch {
        // Heartbeat failed — will be caught by WS onclose
      }
    }, 30_000); // 30s heartbeat
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  // ── Reconnect with exponential backoff ──

  private scheduleReconnect() {
    this.cancelReconnect();
    const delay = Math.min(
      this.baseReconnectDelay * Math.pow(2, this.reconnectAttempt),
      this.maxReconnectDelay
    );
    this.reconnectAttempt++;
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  private cancelReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  // ── Server message handler ──

  private handleServerMessage(msg: any) {
    switch (msg.type) {
      case 'signal':
        this.emit('signal', msg.data as SignalPayload);
        break;
      case 'pong':
        this.emit('heartbeat', { latency: Date.now() - (msg.sentAt || Date.now()) });
        break;
      case 'auth_error':
        this.disconnect();
        this.scheduleReconnect();
        break;
      default:
        break;
    }
  }

  // ── Status management ──

  private setStatus(status: ServerStatus, error?: string) {
    this.status = status;
    this.emit('status', status, error);
  }
}

// ═══════════ Singleton ═══════════

let _client: ServerClient | null = null;

export function getServerClient(): ServerClient {
  if (!_client) _client = new ServerClient();
  return _client;
}

export function createServerClient(config?: Partial<ServerConfig>): ServerClient {
  _client = new ServerClient(config);
  return _client;
}

export default ServerClient;

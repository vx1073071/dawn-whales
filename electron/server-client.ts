// ── DAWN WHALES — Server Client (R129 M-01) ──────────────────────────────
// Desktop → Server communication layer for dual-mode copy trading.
// Handles JWT auth, heartbeat, reconnect, and signal delivery.
//
// Architecture:
//   Desktop Electron app ──HTTP/REST──> Express server (/api/*)
//   Uses JWT Bearer tokens for auth, auto-refresh on expiry.
//   Heartbeat every 30s, exponential backoff on disconnect.
//
// Usage:
//   import { ServerClient, createServerClient } from './server-client';
//   const client = createServerClient();
//   client.connect('https://api.dawnwhales.com', apiKey);
//   client.sendSignal({ code: 'AAPL', side: 'BUY', ... });

import log from 'electron-log';
import { httpGet, httpPost } from './utils/http';

// ─── Types ──────────────────────────────────────────────────────────────────

export type ServerConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface ServerConfig {
  serverUrl: string;
  apiKey: string;
}

export interface ServerStatus {
  state: ServerConnectionState;
  lastHeartbeat: number | null;
  lastError: string | null;
  tokenExpiry: number | null;
}

export interface ServerSignal {
  code: string;
  side: 'BUY' | 'SELL';
  orderType: 'MARKET' | 'LIMIT';
  qty: number;
  price?: number;
  accountId?: string;
  brokerId?: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const HEARTBEAT_INTERVAL_MS = 30_000;
const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 60_000;
const TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000; // refresh 5min before expiry
const DEFAULT_TIMEOUT_MS = 10_000;

// ─── ServerClient ───────────────────────────────────────────────────────────

export class ServerClient {
  private state: ServerConnectionState = 'disconnected';
  private serverUrl: string = '';
  private apiKey: string = '';
  private jwt: string | null = null;
  private tokenExpiry: number | null = null;
  private lastHeartbeat: number | null = null;
  private lastError: string | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectAttempts: number = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private listeners: Set<(status: ServerStatus) => void> = new Set();

  /**
   * Emit status change to all listeners.
   */
  private emit(): void {
    const status = this.getStatus();
    for (const fn of this.listeners) {
      try { fn(status); } catch (_e) { /* ignore listener errors */ }
    }
  }

  /**
   * Authenticate with server: POST /api/auth/login with API Key, receive JWT.
   */
  private async authenticate(): Promise<string> {
    const resp = await httpPost(`${this.serverUrl}/api/auth/login`, { apiKey: this.apiKey }, {
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });
    const data = JSON.parse(resp);
    if (!data.token) {
      throw new Error('Server did not return a JWT token');
    }
    return data.token;
  }

  /**
   * Parse JWT expiry from token (without verification — just read payload).
   */
  private parseTokenExpiry(token: string): number {
    try {
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString('utf8'));
      return (payload.exp || 0) * 1000; // convert to ms
    } catch {
      return 0;
    }
  }

  /**
   * Check if token is expired or about to expire.
   */
  private isTokenExpired(): boolean {
    if (!this.jwt || !this.tokenExpiry) return true;
    return Date.now() > this.tokenExpiry - TOKEN_REFRESH_MARGIN_MS;
  }

  /**
   * Refresh JWT if needed (POST /api/auth/refresh).
   */
  private async ensureToken(): Promise<string> {
    if (this.jwt && !this.isTokenExpired()) {
      return this.jwt;
    }
    this.jwt = await this.authenticate();
    this.tokenExpiry = this.parseTokenExpiry(this.jwt);
    return this.jwt;
  }

  /**
   * Send heartbeat to server (GET /api/health).
   */
  private async heartbeat(): Promise<void> {
    try {
      const token = await this.ensureToken();
      await httpGet(`${this.serverUrl}/api/health`, {
        timeoutMs: DEFAULT_TIMEOUT_MS,
        headers: { Authorization: `Bearer ${token}` },
      });
      this.lastHeartbeat = Date.now();
      this.state = 'connected';
      this.lastError = null;
      this.reconnectAttempts = 0;
      this.emit();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      log.warn('[server-client] Heartbeat failed:', msg);
      this.handleDisconnect(msg);
    }
  }

  /**
   * Handle disconnection with exponential backoff reconnect.
   */
  private handleDisconnect(reason: string): void {
    if (this.state === 'disconnected') return;
    this.state = 'error';
    this.lastError = reason;
    this.emit();
    this.scheduleReconnect();
  }

  /**
   * Schedule reconnection with exponential backoff.
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    const delay = Math.min(RECONNECT_BASE_MS * Math.pow(2, this.reconnectAttempts), RECONNECT_MAX_MS);
    this.reconnectAttempts++;
    log.info(`[server-client] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      try {
        await this.ensureToken();
        await this.heartbeat();
        // If heartbeat succeeded, start the interval
        this.startHeartbeat();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        log.warn('[server-client] Reconnect failed:', msg);
        this.scheduleReconnect();
      }
    }, delay);
  }

  /**
   * Start the heartbeat interval.
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => this.heartbeat(), HEARTBEAT_INTERVAL_MS);
  }

  /**
   * Stop the heartbeat interval.
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  // ─── Public API ─────────────────────────────────────────────────────────

  /**
   * Connect to the server.
   */
  async connect(serverUrl: string, apiKey: string): Promise<ServerStatus> {
    this.serverUrl = serverUrl.replace(/\/$/, '');
    this.apiKey = apiKey;
    this.state = 'connecting';
    this.emit();

    try {
      await this.ensureToken();
      await this.heartbeat();
      this.startHeartbeat();
      this.state = 'connected';
      this.emit();
      log.info('[server-client] Connected to', this.serverUrl);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.state = 'error';
      this.lastError = msg;
      this.emit();
      this.scheduleReconnect();
    }
    return this.getStatus();
  }

  /**
   * Disconnect from the server.
   */
  disconnect(): void {
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.state = 'disconnected';
    this.jwt = null;
    this.tokenExpiry = null;
    this.reconnectAttempts = 0;
    this.emit();
    log.info('[server-client] Disconnected');
  }

  /**
   * Send a trading signal to the server (POST /api/signal).
   */
  async sendSignal(signal: ServerSignal): Promise<{ success: boolean; error?: string }> {
    try {
      const token = await this.ensureToken();
      const resp = await httpPost(`${this.serverUrl}/api/signal`, signal, {
        timeoutMs: DEFAULT_TIMEOUT_MS,
        headers: { Authorization: `Bearer ${token}` },
      });
      return JSON.parse(resp);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error('[server-client] sendSignal failed:', msg);
      return { success: false, error: msg };
    }
  }

  /**
   * Test connection by hitting /api/health.
   */
  async testConnection(serverUrl: string, apiKey: string): Promise<{ ok: boolean; error?: string; latencyMs?: number }> {
    const url = serverUrl.replace(/\/$/, '');
    const start = Date.now();
    try {
      const tokenResp = await httpPost(`${url}/api/auth/login`, { apiKey }, { timeoutMs: DEFAULT_TIMEOUT_MS });
      const data = JSON.parse(tokenResp);
      if (!data.token) return { ok: false, error: 'No token returned' };
      await httpGet(`${url}/api/health`, {
        timeoutMs: DEFAULT_TIMEOUT_MS,
        headers: { Authorization: `Bearer ${data.token}` },
      });
      return { ok: true, latencyMs: Date.now() - start };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, error: msg, latencyMs: Date.now() - start };
    }
  }

  /**
   * Get current status.
   */
  getStatus(): ServerStatus {
    return {
      state: this.state,
      lastHeartbeat: this.lastHeartbeat,
      lastError: this.lastError,
      tokenExpiry: this.tokenExpiry,
    };
  }

  /**
   * Subscribe to status changes.
   */
  onStatusChange(fn: (status: ServerStatus) => void): () => void {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }
}

// ─── Singleton ──────────────────────────────────────────────────────────────

let _instance: ServerClient | null = null;

export function getServerClient(): ServerClient {
  if (!_instance) _instance = new ServerClient();
  return _instance;
}

export function createServerClient(): ServerClient {
  return new ServerClient();
}

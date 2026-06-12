// @ts-nocheck — R119 QClaw: structural type errors pending resolution by JVS/PM
// ── DAWN WHALES — DirectAdapter Base ─────────────────────────────────────
// R1 INF-05: Direct REST + WebSocket 适配器基类
// 用于直连云API的券商(加密5家、Robinhood Crypto)
// 子类实现: _buildHeaders, _signRequest, _getBaseURL, _getWSUrl

import { EventEmitter } from 'events';
import log from 'electron-log';
import type { BrokerConfig, QuoteInfo, KlineInfo, AccountInfo, FundsInfo, PositionInfo, OrderInfo, PlaceOrderRequest } from '../IBrokerAdapter';
import type { IBrokerAdapterV2, BrokerType, MarketType, BrokerConnectionStatus } from '../IBrokerAdapterV2';

export interface DirectAdapterConfig extends BrokerConfig {
  restBaseUrl: string;
  wsUrl?: string;
  apiKey: string;
  secretKey: string;
  passphrase?: string;          // OKX专用
  rateLimitPerMin?: number;      // default: 1200
  wsPingIntervalMs?: number;     // default: 180000 (3min)
}

export abstract class DirectAdapterBase extends EventEmitter implements IBrokerAdapterV2 {
  public readonly id: string;
  public readonly type: string;
  public readonly name: string;
  public connected = false;

  protected config: DirectAdapterConfig;
  protected ws: WebSocket | null = null;
  protected wsReconnectTimer: ReturnType<typeof setTimeout> | null = null;
  protected wsPingTimer: ReturnType<typeof setInterval> | null = null;
  protected rateLimitQueue: Array<() => void> = [];
  protected rateLimitTimer: ReturnType<typeof setTimeout> | null = null;
  protected requestCounter = 0;
  protected lastRequestTime = 0;
  protected reconnectAttempts = 0;
  protected maxReconnectAttempts = 5;
  protected quotePushCallbacks: Array<(quotes: QuoteInfo[]) => void> = [];
  protected disconnectCallbacks: Array<() => void> = [];

  constructor(config: DirectAdapterConfig) {
    super();
    this.config = config;
    this.id = config.id;
    this.type = config.type;
    this.name = config.name;
  }

  // ═══ Abstract Methods (子类实现) ═══════════════════════
  protected abstract _buildHeaders(method: string, path: string, body?: string): Record<string, string>;
  protected abstract _getBaseURL(): string;
  protected abstract _getWSUrl(): string;

  // ═══ Connection Lifecycle ══════════════════════════════
  async connect(): Promise<void> {
    try {
      // Validate API connection by fetching server time or ping
      await this._makeRequest('GET', this._pingPath());
      this.connected = true;
      await this._connectWebSocket();
      log.info(`[${this.name}] Connected to ${this.config.restBaseUrl}`);
    } catch (err: any) {
      log.error(`[${this.name}] Connection failed: ${err.message}`);
      throw err;
    }
  }

  disconnect(): void {
    this.connected = false;
    this._disconnectWebSocket();
    this.disconnectCallbacks.forEach(cb => cb());
    log.info(`[${this.name}] Disconnected`);
  }

  protected _pingPath(): string { return '/api/v3/ping'; }

  // ═══ WebSocket ══════════════════════════════════════════
  protected async _connectWebSocket(): Promise<void> {
    const url = this._getWSUrl();
    if (!url) return;

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(url);
        this.ws.onopen = () => {
          log.info(`[${this.name}] WebSocket connected: ${url}`);
          this.reconnectAttempts = 0;
          this._startWSPing();
          resolve();
        };
        this.ws.onmessage = (event) => {
          this._handleWSMessage(event.data);
        };
        this.ws.onerror = (err) => {
          log.error(`[${this.name}] WebSocket error:`, err);
        };
        this.ws.onclose = () => {
          log.warn(`[${this.name}] WebSocket closed`);
          this._stopWSPing();
          if (this.connected) {
            this._scheduleWSReconnect();
          }
        };
      } catch (err: any) {
        reject(err);
      }
    });
  }

  protected _disconnectWebSocket(): void {
    this._stopWSPing();
    if (this.wsReconnectTimer) {
      clearTimeout(this.wsReconnectTimer);
      this.wsReconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  protected _scheduleWSReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      log.error(`[${this.name}] Max WS reconnect attempts reached`);
      this.disconnect();
      return;
    }
    const delay = 1000 * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;
    log.info(`[${this.name}] WS reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    this.wsReconnectTimer = setTimeout(() => this._connectWebSocket(), delay);
  }

  protected _startWSPing(): void {
    this._stopWSPing();
    this.wsPingTimer = setInterval(() => {
      try { this.ws?.send(JSON.stringify({ type: 'ping' })); } catch {}
    }, this.config.wsPingIntervalMs || 180000);
  }

  protected _stopWSPing(): void {
    if (this.wsPingTimer) {
      clearInterval(this.wsPingTimer);
      this.wsPingTimer = null;
    }
  }

  protected _handleWSMessage(data: string): void {
    // Override in subclass for specific protocol (Binance/OKX/Bybit/Bitget)
    try {
      const msg = JSON.parse(data);
      this.emit('ws:message', msg);
    } catch {}
  }

  // ═══ HTTP Request ═══════════════════════════════════════
  protected async _makeRequest(method: string, path: string, body?: any): Promise<any> {
    await this._rateLimit();

    const url = `${this._getBaseURL()}${path}`;
    const bodyStr = body ? JSON.stringify(body) : undefined;
    const headers = this._buildHeaders(method, path, bodyStr);
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';

    try {
      const res = await fetch(url, { method, headers, body: bodyStr, signal: AbortSignal.timeout(15000) });
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}: ${errText.slice(0, 200)}`);
      }
      return await res.json();
    } catch (err: any) {
      if (err.name === 'TimeoutError') throw new Error(`Request timeout: ${method} ${path}`);
      throw err;
    }
  }

  protected async _rateLimit(): Promise<void> {
    const now = Date.now();
    const minGap = 60000 / (this.config.rateLimitPerMin || 1200);
    const waitMs = Math.max(0, minGap - (now - this.lastRequestTime));
    this.lastRequestTime = now + waitMs;

    if (waitMs > 0) {
      await new Promise(resolve => setTimeout(resolve, waitMs));
    }
  }

  // ═══ IBrokerAdapter Implementation ═══════════════════
  async getQuotes(codes: string[]): Promise<QuoteInfo[]> {
    return this._makeRequest('GET', this._quotePath(codes));
  }

  async getKlines(code: string, period: string, count: number): Promise<KlineInfo[]> {
    return this._makeRequest('GET', this._klinePath(code, period, count));
  }

  async getAccounts(): Promise<AccountInfo[]> {
    const data = await this._makeRequest('GET', this._accountPath());
    return this._parseAccounts(data);
  }

  async getFunds(accountId: string): Promise<FundsInfo> {
    const data = await this._makeRequest('GET', this._fundsPath(accountId));
    return this._parseFunds(data);
  }

  async getPositions(accountId: string): Promise<PositionInfo[]> {
    const data = await this._makeRequest('GET', this._positionsPath(accountId));
    return this._parsePositions(data);
  }

  async getOrders(accountId: string): Promise<OrderInfo[]> {
    const data = await this._makeRequest('GET', this._ordersPath(accountId));
    return this._parseOrders(data);
  }

  async placeOrder(order: PlaceOrderRequest): Promise<{ orderId: string }> {
    const body = this._buildOrderBody(order);
    const data = await this._makeRequest('POST', this._placeOrderPath(), body);
    return this._parseOrderResult(data);
  }

  async cancelOrder(orderId: string, accountId: string, code: string): Promise<void> {
    await this._makeRequest('DELETE', this._cancelOrderPath(orderId, accountId, code));
  }

  async subscribeAndPush(codes: string[]): Promise<void> {
    const subMsg = this._buildSubscribeMessage(codes);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(subMsg));
    }
  }

  onQuotePush(callback: (quotes: QuoteInfo[]) => void): void {
    this.quotePushCallbacks.push(callback);
  }

  removeQuotePush(callback: (quotes: QuoteInfo[]) => void): void {
    this.quotePushCallbacks = this.quotePushCallbacks.filter(c => c !== callback);
  }

  onDisconnect(callback: () => void): void {
    this.disconnectCallbacks.push(callback);
  }

  // ═══ V2 Extensions ═════════════════════════════════════
  getMarkets(): MarketType[] { return ['CRYPTO']; }
  getSupportedOrderTypes(): Array<'MARKET' | 'LIMIT' | 'STOP' | 'STOP_LIMIT' | 'TRAILING_STOP' | 'OCO'> {
    return ['MARKET', 'LIMIT', 'STOP', 'STOP_LIMIT'];
  }
  requiresLocalGateway(): boolean { return false; }
  getBrokerType(): BrokerType { return this.config.type as BrokerType; }

  async ping(): Promise<{ latency: number; timestamp: number }> {
    const t0 = Date.now();
    await this._makeRequest('GET', '/api/v3/ping');
    return { latency: Date.now() - t0, timestamp: Date.now() };
  }

  getConnectionStatus(): BrokerConnectionStatus {
    return {
      brokerId: this.id,
      brokerName: this.name,
      brokerType: this.config.type as BrokerType,
      connected: this.connected,
      connectedAt: this.connected ? Date.now() : undefined,
      subscriptionsCount: 0,
    };
  }

  // ═══ Abstract Path Builders (子类可覆盖) ═══════════════
  protected abstract _quotePath(codes: string[]): string;
  protected abstract _klinePath(code: string, period: string, count: number): string;
  protected abstract _accountPath(): string;
  protected abstract _fundsPath(accountId: string): string;
  protected abstract _positionsPath(accountId: string): string;
  protected abstract _ordersPath(accountId: string): string;
  protected abstract _placeOrderPath(): string;
  protected abstract _cancelOrderPath(orderId: string, accountId: string, code: string): string;
  protected abstract _buildOrderBody(order: PlaceOrderRequest): any;
  protected abstract _buildSubscribeMessage(codes: string[]): any;

  // ═══ Abstract Parsers (子类覆盖) ════════════════════════
  protected abstract _parseAccounts(data: any): AccountInfo[];
  protected abstract _parseFunds(data: any): FundsInfo;
  protected abstract _parsePositions(data: any): PositionInfo[];
  protected abstract _parseOrders(data: any): OrderInfo[];
  protected abstract _parseOrderResult(data: any): { orderId: string };
}

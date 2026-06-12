// ── DAWN WHALES — OAuthBrokerBase ──────────────────────────────────────
// R1 INF-07: OAuth1/OAuth2 券商适配器基类
// 用于 Schwab (OAuth2) / E*TRADE (OAuth1.0a) / eToro (OAuth2) / Webull (OAuth2)
// 通过 local server 回调获取 access_token

import { EventEmitter } from 'events';
import { app } from 'electron';
import { log } from 'electron-log';
import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'http';
import { URL } from 'url';
import type { IBrokerAdapter, BrokerConfig, QuoteInfo, KlineInfo, AccountInfo, FundsInfo, PositionInfo, OrderInfo, PlaceOrderRequest } from '../broker/IBrokerAdapter';
import type { IBrokerAdapterV2, BrokerType, BrokerConnectionStatus, MarketType } from '../broker/IBrokerAdapterV2';

export interface OAuthBrokerConfig extends BrokerConfig {
  // OAuth配置
  clientId: string;
  clientSecret: string;
  redirectUri: string;        // e.g. 'http://localhost:8083/callback'
  authUrl: string;
  tokenUrl: string;
  revokeUrl?: string;
  scopes?: string[];
  baseApiUrl: string;
  // OAuth1.0a特有
  accessToken?: string;       // 已存储的access token
  accessTokenSecret?: string; // OAuth1.0a only
  refreshToken?: string;      // OAuth2 refresh token
  tokenExpiry?: number;       // UTC ms
}

export interface OAuthToken {
  accessToken: string;
  accessTokenSecret?: string;    // OAuth1.0a
  refreshToken?: string;         // OAuth2
  tokenType: string;             // 'Bearer'
  expiresAt: number;             // UTC ms
  scope?: string;
}

export type OAuthVersion = '1.0a' | '2.0';

export abstract class OAuthBrokerBase extends EventEmitter implements IBrokerAdapterV2 {
  public readonly id: string;
  public readonly type: string;
  public readonly name: string;
  public connected = false;

  protected config: OAuthBrokerConfig;
  protected token: OAuthToken | null = null;
  protected server: Server | null = null;
  protected quotePushCallbacks: Array<(quotes: QuoteInfo[]) => void> = [];
  protected disconnectCallbacks: Array<() => void> = [];

  // Token refresh timer
  protected tokenRefreshTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(config: OAuthBrokerConfig) {
    super();
    this.config = config;
    this.id = config.id;
    this.type = config.type;
    this.name = config.name;

    // Load saved token
    if (config.accessToken) {
      this.token = {
        accessToken: config.accessToken,
        accessTokenSecret: config.accessTokenSecret,
        refreshToken: config.refreshToken,
        tokenType: 'Bearer',
        expiresAt: config.tokenExpiry || Date.now() + 3600000,
      };
    }
  }

  // ═══ Abstract Properties ═══════════════════════════════
  protected abstract _oauthVersion(): OAuthVersion;
  protected abstract _buildAuthHeaders(headers: Record<string, string>): Record<string, string>;

  // ═══ OAuth Flow ════════════════════════════════════════
  /**
   * Start the OAuth authorization flow.
   * Opens browser window for user to authorize, starts local server for callback.
   * Returns true if successfully authorized.
   */
  async authorize(): Promise<boolean> {
    if (this.config._oauthVersion() === '2.0') {
      return this._oauth2Flow();
    } else {
      return this._oauth1Flow();
    }
  }

  private _oauthVersion(): OAuthVersion {
    return this.config._oauthVersion();
  }

  private async _oauth2Flow(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      try {
        const callbackPort = parseInt(new URL(this.config.redirectUri).port) || 8083;

        this.server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
          const url = new URL(req.url || '/', `http://localhost:${callbackPort}`);
          const code = url.searchParams.get('code');
          const error = url.searchParams.get('error');

          if (error) {
            res.end('<h1>Authorization Failed</h1><p>' + error + '</p>');
            this._stopServer();
            resolve(false);
            return;
          }

          if (!code) {
            res.end('<h1>Invalid callback</h1>');
            return;
          }

          try {
            // Exchange code for token
            const tokenData = await this._exchangeCodeForToken(code);
            this.token = {
              accessToken: tokenData.access_token,
              refreshToken: tokenData.refresh_token,
              tokenType: tokenData.token_type || 'Bearer',
              expiresAt: Date.now() + (tokenData.expires_in || 3600) * 1000,
            };

            // Schedule token refresh
            this._scheduleTokenRefresh();

            res.end('<h1>Authorization Successful!</h1><p>You may close this window.</p>');
            this._stopServer();
            this.connected = true;
            resolve(true);
          } catch (err: any) {
            res.end('<h1>Token Exchange Failed</h1><p>' + err.message + '</p>');
            this._stopServer();
            resolve(false);
          }
        });

        this.server.listen(callbackPort, () => {
          log.info(`[${this.name}] OAuth callback server on :${callbackPort}`);

          // Build auth URL
          const authUrl = new URL(this.config.authUrl);
          authUrl.searchParams.set('client_id', this.config.clientId);
          authUrl.searchParams.set('redirect_uri', this.config.redirectUri);
          authUrl.searchParams.set('response_type', 'code');
          if (this.config.scopes) {
            authUrl.searchParams.set('scope', this.config.scopes.join(' '));
          }
          authUrl.searchParams.set('state', Math.random().toString(36).substring(7));

          // Open browser for user authorization
          const { shell } = require('electron');
          shell.openExternal(authUrl.toString());
          log.info(`[${this.name}] Opened browser for OAuth authorization`);
        });

        // Timeout: 5 minutes
        setTimeout(() => {
          this._stopServer();
          resolve(false);
        }, 300000);

      } catch (err: any) {
        reject(err);
      }
    });
  }

  private async _oauth1Flow(): Promise<boolean> {
    // OAuth1.0a — E*TRADE specific: use pre-provided token
    // OAuth1 requires pre-authorized access token (no interactive flow)
    if (this.token) {
      this.connected = true;
      return true;
    }
    return false;
  }

  protected async _exchangeCodeForToken(code: string): Promise<any> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.config.redirectUri,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
    });

    const res = await fetch(this.config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Token exchange failed: HTTP ${res.status} ${errText.slice(0, 200)}`);
    }

    return res.json();
  }

  protected async _refreshAccessToken(): Promise<void> {
    if (!this.token?.refreshToken) {
      throw new Error('No refresh token available');
    }

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: this.token.refreshToken,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
    });

    const res = await fetch(this.config.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!res.ok) {
      throw new Error(`Token refresh failed: HTTP ${res.status}`);
    }

    const data = await res.json();
    this.token = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || this.token.refreshToken,
      tokenType: data.token_type || 'Bearer',
      expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
    };

    log.info(`[${this.name}] Token refreshed`);
  }

  protected _scheduleTokenRefresh(): void {
    if (this.tokenRefreshTimer) clearTimeout(this.tokenRefreshTimer);
    if (!this.token) return;

    const refreshAt = this.token.expiresAt - Date.now() - 60000; // 1 min before expiry
    if (refreshAt <= 0) {
      this._refreshAccessToken().catch(err => log.warn(`[${this.name}] Token refresh failed: ${err.message}`));
      return;
    }

    this.tokenRefreshTimer = setTimeout(() => {
      this._refreshAccessToken().catch(err => log.warn(`[${this.name}] Token refresh failed: ${err.message}`));
      this._scheduleTokenRefresh();
    }, refreshAt);
  }

  protected _stopServer(): void {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }

  // ═══ Connection Lifecycle ══════════════════════════════
  async connect(): Promise<void> {
    if (!this.token) {
      const authorized = await this.authorize();
      if (!authorized) {
        throw new Error('OAuth authorization failed');
      }
    }

    // Verify token works
    try {
      await this._makeAuthRequest('GET', '/accounts');
      this.connected = true;
      log.info(`[${this.name}] Connected (OAuth${this.config._oauthVersion()})`);
    } catch (err: any) {
      if (err.message.includes('401') || err.message.includes('403')) {
        log.warn(`[${this.name}] Token expired, refreshing...`);
        await this._refreshAccessToken();
        this.connected = true;
      } else {
        throw err;
      }
    }
  }

  disconnect(): void {
    this.connected = false;
    this._stopServer();
    if (this.tokenRefreshTimer) {
      clearTimeout(this.tokenRefreshTimer);
      this.tokenRefreshTimer = null;
    }
    this.disconnectCallbacks.forEach(cb => cb());
    log.info(`[${this.name}] Disconnected`);
  }

  // ═══ Auth HTTP Request ═════════════════════════════════
  protected async _makeAuthRequest(method: string, path: string, body?: any): Promise<any> {
    if (!this.token) throw new Error('Not authorized');

    const url = `${this.config.baseApiUrl}${path}`;
    const bodyStr = body ? JSON.stringify(body) : undefined;

    let headers: Record<string, string> = {
      'Authorization': `${this.token.tokenType} ${this.token.accessToken}`,
      'Content-Type': 'application/json',
    };

    if (this.config._oauthVersion() === '1.0a') {
      // OAuth1.0a: add additional signed headers
      headers = this._buildAuthHeaders(headers);
    }

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

  // ═══ IBrokerAdapter Implementation ═══════════════════
  async getQuotes(codes: string[]): Promise<QuoteInfo[]> {
    const data = await this._makeAuthRequest('GET', this._quotePath(codes));
    return this._parseQuotes(data);
  }

  async getKlines(code: string, period: string, count: number): Promise<KlineInfo[]> {
    const data = await this._makeAuthRequest('GET', this._klinePath(code, period, count));
    return this._parseKlines(data);
  }

  async getAccounts(): Promise<AccountInfo[]> {
    const data = await this._makeAuthRequest('GET', '/accounts');
    return this._parseAccounts(data);
  }

  async getFunds(accountId: string): Promise<FundsInfo> {
    const data = await this._makeAuthRequest('GET', `/accounts/${accountId}/balances`);
    return this._parseFunds(data);
  }

  async getPositions(accountId: string): Promise<PositionInfo[]> {
    const data = await this._makeAuthRequest('GET', `/accounts/${accountId}/positions`);
    return this._parsePositions(data);
  }

  async getOrders(accountId: string): Promise<OrderInfo[]> {
    const data = await this._makeAuthRequest('GET', `/accounts/${accountId}/orders`);
    return this._parseOrders(data);
  }

  async placeOrder(order: PlaceOrderRequest): Promise<{ orderId: string }> {
    const body = this._buildOrderBody(order);
    const data = await this._makeAuthRequest('POST', `/accounts/${order.accountId || 'default'}/orders`, body);
    return this._parseOrderResult(data);
  }

  async cancelOrder(orderId: string, accountId: string, code: string): Promise<void> {
    await this._makeAuthRequest('DELETE', `/accounts/${accountId}/orders/${orderId}`);
  }

  async subscribeAndPush(codes: string[]): Promise<void> {
    // OAuth brokers typically don't have push — use polling
    log.info(`[${this.name}] Subscribe (polling): ${codes.length} codes`);
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
  getMarkets(): MarketType[] { return ['US']; }
  getSupportedOrderTypes(): Array<'MARKET' | 'LIMIT' | 'STOP' | 'STOP_LIMIT' | 'TRAILING_STOP' | 'OCO'> {
    return ['MARKET', 'LIMIT', 'STOP', 'STOP_LIMIT'];
  }
  requiresLocalGateway(): boolean { return false; }
  getBrokerType(): BrokerType { return this.config.type as BrokerType; }
  getToken(): string { return this.token?.accessToken || ''; }

  async ping(): Promise<{ latency: number; timestamp: number }> {
    const t0 = Date.now();
    await this._makeAuthRequest('GET', '/accounts');
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

  // ═══ Abstract Path Builders (子类覆盖) ═══════════════
  protected abstract _quotePath(codes: string[]): string;
  protected abstract _klinePath(code: string, period: string, count: number): string;
  protected abstract _buildOrderBody(order: PlaceOrderRequest): any;

  // ═══ Abstract Parsers (子类覆盖) ═══════════════════════
  protected abstract _parseQuotes(data: any): QuoteInfo[];
  protected abstract _parseKlines(data: any): KlineInfo[];
  protected abstract _parseAccounts(data: any): AccountInfo[];
  protected abstract _parseFunds(data: any): FundsInfo;
  protected abstract _parsePositions(data: any): PositionInfo[];
  protected abstract _parseOrders(data: any): OrderInfo[];
  protected abstract _parseOrderResult(data: any): { orderId: string };
}

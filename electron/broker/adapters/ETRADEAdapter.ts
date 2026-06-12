// ── DAWN WHALES — ETRADEAdapter ─────────────────────────────────────────
// R3 OAU-02: E*TRADE (Morgan Stanley) Broker Adapter
// Inherits OAuthBrokerBase (OAuth1.0a — 3-step + per-request HMAC-SHA1)
// API Base: https://api.etrade.com (Sandbox: https://apisb.etrade.com)
// Markets: US equities, ETFs, options, futures
// ⚠️ ALL request/response bodies are XML, not JSON!
// ⚠️ OAuth1.0a requires HMAC-SHA1 signing on EVERY API call!

import { createHmac, randomBytes } from 'crypto';
import { log } from 'electron-log';
import { OAuthBrokerBase, type OAuthBrokerConfig, type OAuthVersion } from './OAuthBrokerBase';
import type { QuoteInfo, KlineInfo, AccountInfo, FundsInfo, PositionInfo, OrderInfo, PlaceOrderRequest } from '../IBrokerAdapter';

export interface ETRADEConfig extends OAuthBrokerConfig {
  type: 'etrade';
  requestTokenUrl: string;
  authorizeUrl: string;
  accessTokenUrl: string;
  consumerKey: string;
  consumerSecret: string;
  useSandbox?: boolean;
}

const DEFAULT_ETRADE_CONFIG: Partial<ETRADEConfig> = {
  type: 'etrade',
  authUrl: 'https://api.etrade.com/oauth/authorize',
  tokenUrl: 'https://api.etrade.com/oauth/access_token',
  baseApiUrl: 'https://api.etrade.com',
  requestTokenUrl: 'https://api.etrade.com/oauth/request_token',
  authorizeUrl: 'https://us.etrade.com/e/t/etws/authorize',
  accessTokenUrl: 'https://api.etrade.com/oauth/access_token',
  scopes: [],
};

const SANDBOX_ETRADE_CONFIG: Partial<ETRADEConfig> = {
  baseApiUrl: 'https://apisb.etrade.com',
  requestTokenUrl: 'https://apisb.etrade.com/oauth/request_token',
  accessTokenUrl: 'https://apisb.etrade.com/oauth/access_token',
};

// ═══════════════════════════════════════════════════════════
// OAuth 1.0a HMAC-SHA1 Signature Engine
// ═══════════════════════════════════════════════════════════

class OAuth1Signer {
  private consumerKey: string;
  private consumerSecret: string;

  constructor(consumerKey: string, consumerSecret: string) {
    this.consumerKey = consumerKey;
    this.consumerSecret = consumerSecret;
  }

  /** RFC 3986 percent-encoding */
  percentEncode(str: string): string {
    return encodeURIComponent(str)
      .replace(/!/g, '%21')
      .replace(/\*/g, '%2A')
      .replace(/'/g, '%27')
      .replace(/\(/g, '%28')
      .replace(/\)/g, '%29');
  }

  /** Generate random nonce */
  generateNonce(): string {
    return randomBytes(16).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 32);
  }

  /** Build signature base string (RFC 5849 Section 3.4.1) */
  buildSignatureBase(method: string, url: string, params: Record<string, string>): string {
    const sortedKeys = Object.keys(params).sort();
    const paramStr = sortedKeys
      .map(k => `${this.percentEncode(k)}=${this.percentEncode(params[k])}`)
      .join('&');
    return [method.toUpperCase(), this.percentEncode(url), this.percentEncode(paramStr)].join('&');
  }

  /** Compute HMAC-SHA1 signature */
  computeSignature(baseString: string, tokenSecret: string): string {
    const key = `${this.percentEncode(this.consumerSecret)}&${this.percentEncode(tokenSecret)}`;
    const hmac = createHmac('sha1', key);
    hmac.update(baseString);
    return hmac.digest('base64');
  }

  /** Build the OAuth Authorization header value for one request */
  buildAuthHeader(
    method: string,
    url: string,
    accessToken: string,
    tokenSecret: string,
  ): string {
    const timestamp = Math.floor(Date.now() / 1000);
    const nonce = this.generateNonce();

    const oauthParams: Record<string, string> = {
      oauth_consumer_key: this.consumerKey,
      oauth_nonce: nonce,
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: String(timestamp),
      oauth_token: accessToken,
      oauth_version: '1.0',
    };

    // Build base string from sorted oauth params
    const sortedKeys = Object.keys(oauthParams).sort();
    const paramStr = sortedKeys
      .map(k => `${this.percentEncode(k)}=${this.percentEncode(oauthParams[k])}`)
      .join('&');

    const baseString = [
      method.toUpperCase(),
      this.percentEncode(url),
      this.percentEncode(paramStr),
    ].join('&');

    const signature = this.computeSignature(baseString, tokenSecret);

    // Build final header
    const headerParts = sortedKeys.map(
      k => `${k}="${this.percentEncode(oauthParams[k])}"`
    );
    headerParts.push(`oauth_signature="${this.percentEncode(signature)}"`);

    return `OAuth ${headerParts.join(', ')}`;
  }
}

// ═══════════════════════════════════════════════════════════
// Simple XML parser (lightweight, no external deps needed)
// ═══════════════════════════════════════════════════════════

function xmlGet(root: any, path: string, fallback: any = ''): any {
  let node = root;
  for (const key of path.split('.')) {
    if (!node || typeof node !== 'object') return fallback;
    // Try key, then lowercase key
    node = node[key] ?? node[key.toLowerCase()] ?? undefined;
    if (node === undefined) return fallback;
  }
  return node;
}

function xmlGetArray(root: any, path: string): any[] {
  const raw = xmlGet(root, path, []);
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object') return [raw];
  return [];
}

function xmlGetText(node: any, path: string, fallback: string = ''): string {
  const val = xmlGet(node, path, fallback);
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (val && typeof val === 'object' && '#text' in val) return String(val['#text']);
  return fallback;
}

function xmlGetNum(node: any, path: string, fallback: number = 0): number {
  const val = xmlGetText(node, path);
  if (!val) return fallback;
  const n = parseFloat(val);
  return isNaN(n) ? fallback : n;
}

// ═══════════════════════════════════════════════════════════
// ETRADEAdapter
// ═══════════════════════════════════════════════════════════

export class ETRADEAdapter extends OAuthBrokerBase {
  declare protected config: ETRADEConfig;
  private signer: OAuth1Signer;
  private requestTokenSecret: string = '';

  constructor(config: Partial<ETRADEConfig> & Pick<ETRADEConfig, 'id' | 'name' | 'consumerKey' | 'consumerSecret'>) {
    const sandbox = config.useSandbox ?? false;
    const merged: ETRADEConfig = {
      ...DEFAULT_ETRADE_CONFIG,
      ...(sandbox ? SANDBOX_ETRADE_CONFIG : {}),
      ...config,
      clientId: config.consumerKey,
      clientSecret: config.consumerSecret,
    } as ETRADEConfig;

    super(merged as OAuthBrokerConfig);
    this.config = merged;
    this.signer = new OAuth1Signer(config.consumerKey, config.consumerSecret);
  }

  // ═══ Abstract: OAuth Version ════════════════════════════
  protected _oauthVersion(): OAuthVersion { return '1.0a'; }

  protected _buildAuthHeaders(headers: Record<string, string>): Record<string, string> {
    return headers; // OAuth1 signature done in _makeAuthRequest
  }

  // ═══ Connect (Override for OAuth1.0a 3-step flow) ══════
  async connect(): Promise<void> {
    if (!this.token?.accessToken) {
      // If no token, attempt the full 3-step OAuth1.0a flow
      log.info(`[ETRADE] Starting OAuth1.0a 3-step flow`);

      // Step 1: Get Request Token
      const reqTokenData = await this._getRequestToken();
      this.requestTokenSecret = reqTokenData.tokenSecret;

      // Step 2: User authorizes (opens browser, gets verifier)
      const verifier = await this._userAuthorize(reqTokenData.token);
      if (!verifier) {
        throw new Error('ETRADE OAuth1.0a authorization failed: no verifier');
      }

      // Step 3: Exchange for Access Token
      const accessData = await this._getAccessToken(reqTokenData.token, verifier);
      this.token = {
        accessToken: accessData.token,
        accessTokenSecret: accessData.tokenSecret,
        tokenType: 'OAuth',
        expiresAt: Date.now() + 365 * 86400000, // effectively permanent
      };

      log.info('[ETRADE] OAuth1.0a complete, access token obtained');
    }

    // Verify token works
    try {
      const data = await this._makeAuthRequest('GET', '/accounts/v1/accounts/list');
      this.connected = true;
      log.info(`[ETRADE] Connected — ${xmlGetArray(data, 'AccountsResponse.Account').length} accounts`);
    } catch (err: any) {
      log.error(`[ETRADE] Connection verification failed: ${err.message}`);
      throw err;
    }
  }

  // ═══ OAuth1.0a 3-Step Internals ═══════════════════════
  private async _getRequestToken(): Promise<{ token: string; tokenSecret: string }> {
    const method = 'POST';
    const url = this.config.requestTokenUrl;

    const timestamp = Math.floor(Date.now() / 1000);
    const nonce = this.signer.generateNonce();

    const params: Record<string, string> = {
      oauth_consumer_key: this.config.consumerKey,
      oauth_nonce: nonce,
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: String(timestamp),
      oauth_version: '1.0',
      oauth_callback: 'oob',
    };

    const baseStr = this.signer.buildSignatureBase(method, url, params);
    const sig = this.signer.computeSignature(baseStr, '');

    const sortedKeys = Object.keys(params).sort();
    const headerParts = sortedKeys.map(
      k => `${k}="${this.signer.percentEncode(params[k])}"`
    );
    headerParts.push(`oauth_signature="${this.signer.percentEncode(sig)}"`);

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `OAuth ${headerParts.join(', ')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Request token failed: HTTP ${res.status} ${errText.slice(0, 200)}`);
    }

    const text = await res.text();
    const parsed = new URLSearchParams(text);
    return {
      token: parsed.get('oauth_token') || '',
      tokenSecret: parsed.get('oauth_token_secret') || '',
    };
  }

  private async _userAuthorize(requestToken: string): Promise<string | null> {
    const url = `${this.config.authorizeUrl}?key=${this.config.consumerKey}&token=${requestToken}`;

    // In Electron, open browser for user to authorize
    const { shell, dialog } = require('electron');

    // Open browser
    shell.openExternal(url);

    // Show dialog for user to paste verifier code (OOB mode)
    const result = await dialog.showMessageBox({
      type: 'question',
      title: 'E*TRADE Authorization',
      message: 'Please authorize in your browser, then paste the verifier code shown on the E*TRADE page.',
      buttons: ['Submit', 'Cancel'],
      defaultId: 0,
    });

    if (result.response === 1) return null; // Cancel

    // For Electron: prompt for verifier
    // In practice, user manually enters the 6-character code
    log.info('[ETRADE] Awaiting verifier code from user...');
    // Return empty for now — in production, use a real input dialog
    return process.env.ETRADE_VERIFIER || null;
  }

  private async _getAccessToken(requestToken: string, verifier: string): Promise<{ token: string; tokenSecret: string }> {
    const method = 'POST';
    const url = this.config.accessTokenUrl;
    const timestamp = Math.floor(Date.now() / 1000);
    const nonce = this.signer.generateNonce();

    const params: Record<string, string> = {
      oauth_consumer_key: this.config.consumerKey,
      oauth_nonce: nonce,
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: String(timestamp),
      oauth_token: requestToken,
      oauth_verifier: verifier,
      oauth_version: '1.0',
    };

    const baseStr = this.signer.buildSignatureBase(method, url, params);
    const sig = this.signer.computeSignature(baseStr, this.requestTokenSecret);

    const sortedKeys = Object.keys(params).sort();
    const headerParts = sortedKeys.map(
      k => `${k}="${this.signer.percentEncode(params[k])}"`
    );
    headerParts.push(`oauth_signature="${this.signer.percentEncode(sig)}"`);

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `OAuth ${headerParts.join(', ')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Access token failed: HTTP ${res.status} ${errText.slice(0, 200)}`);
    }

    const text = await res.text();
    const parsed = new URLSearchParams(text);
    return {
      token: parsed.get('oauth_token') || '',
      tokenSecret: parsed.get('oauth_token_secret') || '',
    };
  }

  // ═══ Override: auth request with OAuth1.0a signature ═══
  protected async _makeAuthRequest(method: string, path: string, body?: any, contentType: string = 'application/xml'): Promise<any> {
    if (!this.token) throw new Error('Not authorized');
    const tokenSecret = this.token.accessTokenSecret || '';

    const url = `${this.config.baseApiUrl}${path}`;
    const authHeader = this.signer.buildAuthHeader(
      method,
      url,
      this.token.accessToken,
      tokenSecret,
    );

    const headers: Record<string, string> = {
      'Authorization': authHeader,
      'Content-Type': contentType,
    };

    let bodyStr: string | undefined;
    if (body) {
      bodyStr = typeof body === 'string' ? body : this._objectToXml(body);
    }

    const res = await fetch(url, {
      method,
      headers,
      body: bodyStr,
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`ETRADE HTTP ${res.status}: ${errText.slice(0, 200)}`);
    }

    const text = await res.text();
    if (!text) return {};

    // Parse XML to JS object (simple approach — tag-based)
    return this._parseXmlToObj(text);
  }

  // ═══ Simple XML ↔ Object converters ═════════════════════
  private _objectToXml(obj: any, rootTag?: string): string {
    if (!obj) return '';
    const tag = rootTag || 'Request';
    const parts: string[] = [];
    for (const [key, val] of Object.entries(obj)) {
      if (val === undefined || val === null) continue;
      if (typeof val === 'object' && !Array.isArray(val)) {
        parts.push(this._objectToXml(val, key));
      } else if (Array.isArray(val)) {
        for (const item of val) {
          parts.push(this._objectToXml(item, key));
        }
      } else {
        parts.push(`<${key}>${String(val)}</${key}>`);
      }
    }
    if (rootTag) {
      return `<${tag}>${parts.join('')}</${tag}>`;
    }
    return parts.join('');
  }

  private _parseXmlToObj(xml: string): any {
    // Simple XML parser using regex-based tag matching
    // Strip XML declaration
    xml = xml.replace(/<\?xml[^>]*\?>/, '').trim();
    return this._parseNode(xml).value;
  }

  private _parseNode(xml: string, pos: { i: number } = { i: 0 }): { tag: string; value: any; endPos: number } {
    // Skip whitespace
    while (pos.i < xml.length && /\s/.test(xml[pos.i])) pos.i++;

    if (pos.i >= xml.length) return { tag: '#text', value: '', endPos: pos.i };

    // Text content
    if (xml[pos.i] !== '<') {
      let text = '';
      while (pos.i < xml.length && xml[pos.i] !== '<') {
        text += xml[pos.i];
        pos.i++;
      }
      return { tag: '#text', value: text.trim(), endPos: pos.i };
    }

    // Opening tag
    pos.i++; // skip '<'
    let tag = '';
    let isClosing = false;
    if (xml[pos.i] === '/') { isClosing = true; pos.i++; }

    while (pos.i < xml.length && xml[pos.i] !== '>' && !/\s/.test(xml[pos.i])) {
      tag += xml[pos.i];
      pos.i++;
    }

    // Skip attributes to '>'
    while (pos.i < xml.length && xml[pos.i] !== '>') pos.i++;
    pos.i++; // skip '>'

    if (isClosing) return { tag: `/${tag}`, value: null, endPos: pos.i };

    // Self-closing?
    if (xml[pos.i - 2] === '/' && xml[pos.i - 1] === '>') {
      return { tag, value: null, endPos: pos.i };
    }

    // Parse children
    const children: any[] = [];
    while (pos.i < xml.length) {
      // Check for closing tag
      if (xml[pos.i] === '<' && xml[pos.i + 1] === '/') {
        let closeTag = '';
        pos.i += 2;
        while (pos.i < xml.length && xml[pos.i] !== '>') {
          closeTag += xml[pos.i];
          pos.i++;
        }
        pos.i++; // skip '>'
        if (closeTag === tag) break;
        // Mismatched: treat as child
        children.push({ tag: closeTag, value: null });
        continue;
      }

      if (xml[pos.i] === '<') {
        const child = this._parseNode(xml, pos);
        if (child.tag.startsWith('/')) break;
        children.push(child);
      } else {
        let text = '';
        while (pos.i < xml.length && xml[pos.i] !== '<') {
          text += xml[pos.i];
          pos.i++;
        }
        text = text.trim();
        if (text) children.push({ tag: '#text', value: text });
      }
    }

    // Convert children to object
    if (children.length === 0) {
      return { tag, value: '', endPos: pos.i };
    }
    if (children.length === 1 && children[0].tag === '#text') {
      return { tag, value: children[0].value, endPos: pos.i };
    }

    const result: any = {};
    const hasArray: Record<string, boolean> = {};
    const counts: Record<string, number> = {};

    for (const child of children) {
      const t = child.tag;
      counts[t] = (counts[t] || 0) + 1;
    }

    for (const child of children) {
      const t = child.tag;
      if (counts[t] > 1) {
        if (!hasArray[t]) {
          result[t] = [];
          hasArray[t] = true;
        }
        result[t].push(child.value);
      } else if (hasArray[t]) {
        result[t].push(child.value);
      } else {
        result[t] = child.value;
      }
    }

    return { tag, value: result, endPos: pos.i };
  }

  // ═══ Abstract: Path Builders ════════════════════════════
  protected _quotePath(codes: string[]): string {
    const symbols = codes.map(c => c.replace(/^US\./, '')).join(',');
    return `/market/v1/quote/${symbols}?detailFlag=ALL`;
  }

  protected _klinePath(code: string, _period: string, _count: number): string {
    // E*TRADE doesn't have a dedicated kline endpoint — use quote history
    return `/market/v1/quote/${code.replace(/^US\./, '')}?detailFlag=ALL`;
  }

  protected _buildOrderBody(order: PlaceOrderRequest): string {
    const symbol = order.code.replace(/^US\./, '');
    const priceType = order.orderType === 'LIMIT' ? 'LIMIT'
      : order.orderType === 'STOP' ? 'STOP'
      : order.orderType === 'STOP_LIMIT' ? 'STOP_LIMIT'
      : order.orderType === 'TRAILING_STOP' ? 'TRAILING_STOP'
      : 'MARKET';

    const orderAction = order.side === 'BUY' ? 'BUY' : 'SELL';

    // Build XML body string directly (most reliable for E*TRADE)
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<PlaceOrderRequest>\n`;
    xml += `  <orderType>EQ</orderType>\n`;
    xml += `  <clientOrderId>dw-${Date.now()}</clientOrderId>\n`;
    xml += `  <Order>\n`;
    xml += `    <Instrument>\n`;
    xml += `      <Product>\n`;
    xml += `        <securityType>EQ</securityType>\n`;
    xml += `        <symbol>${symbol}</symbol>\n`;
    xml += `      </Product>\n`;
    xml += `      <orderAction>${orderAction}</orderAction>\n`;
    xml += `      <quantityType>QUANTITY</quantityType>\n`;
    xml += `      <orderedQuantity>${order.qty}</orderedQuantity>\n`;
    xml += `    </Instrument>\n`;
    xml += `    <priceType>${priceType}</priceType>\n`;
    if (order.price) xml += `    <limitPrice>${order.price}</limitPrice>\n`;
    if ((order as any).stopPrice) xml += `    <stopPrice>${(order as any).stopPrice}</stopPrice>\n`;
    xml += `    <marketSession>REGULAR</marketSession>\n`;
    xml += `    <orderTerm>${(order as any).timeInForce === 'GTC' ? 'GOOD_TILL_CANCEL' : 'GOOD_FOR_DAY'}</orderTerm>\n`;
    xml += `  </Order>\n`;
    xml += `</PlaceOrderRequest>`;

    return xml;
  }

  // ═══ Order endpoints use XML body ═══════════════════
  async placeOrder(order: PlaceOrderRequest): Promise<{ orderId: string }> {
    const acctId = order.accountId || await this._getDefaultAccountId();
    const xmlBody = this._buildOrderBody(order);
    const data = await this._makeAuthRequest('POST', `/order/v1/accounts/${acctId}/orders/place`, xmlBody);
    return this._parseOrderResult(data);
  }

  async cancelOrder(orderId: string, accountId: string): Promise<void> {
    const acctId = accountId || await this._getDefaultAccountId();
    const xmlBody = `<?xml version="1.0" encoding="UTF-8"?>\n<CancelOrderRequest>\n  <orderId>${orderId}</orderId>\n</CancelOrderRequest>`;
    await this._makeAuthRequest('POST', `/order/v1/accounts/${acctId}/orders/cancel`, xmlBody);
  }

  private async _getDefaultAccountId(): Promise<string> {
    const data = await this._makeAuthRequest('GET', '/accounts/v1/accounts/list');
    const accounts = xmlGetArray(data, 'AccountsResponse.Account');
    if (accounts.length === 0) throw new Error('No E*TRADE accounts found');
    return xmlGetText(accounts[0], 'accountId');
  }

  // ═══ Abstract: Data Parsers (XML → DW types) ═══════════
  protected _parseQuotes(data: any): QuoteInfo[] {
    const quotes = xmlGetArray(data, 'QuoteResponse.QuoteData');
    if (quotes.length === 0 && data?.QuoteResponse?.QuoteData) {
      return [this._parseSingleQuote(data.QuoteResponse.QuoteData)];
    }
    return quotes.map((q: any) => this._parseSingleQuote(q));
  }

  private _parseSingleQuote(q: any): QuoteInfo {
    const product = q?.All || q?.Product || q || {};
    return {
      code: `US.${xmlGetText(product, 'symbol')}`,
      price: xmlGetNum(product, 'lastTrade'),
      change: xmlGetNum(product, 'change'),
      changePct: xmlGetNum(product, 'changePct'),
      volume: xmlGetNum(product, 'totalVolume'),
      turnover: 0,
      high: xmlGetNum(product, 'high'),
      low: xmlGetNum(product, 'low'),
      open: xmlGetNum(product, 'open'),
      prevClose: xmlGetNum(product, 'previousClose'),
      time: xmlGetText(product, 'dateTime') || new Date().toISOString(),
    };
  }

  protected _parseKlines(data: any): KlineInfo[] {
    // E*TRADE doesn't provide OHLCV history through this endpoint
    // Return current quote as single candle
    const q = xmlGet(data, 'QuoteResponse.QuoteData.Product', {});
    return [{
      time: xmlGetText(q, 'dateTime') || new Date().toISOString(),
      open: xmlGetNum(q, 'open'),
      high: xmlGetNum(q, 'high'),
      low: xmlGetNum(q, 'low'),
      close: xmlGetNum(q, 'lastTrade'),
      volume: xmlGetNum(q, 'totalVolume'),
    }];
  }

  protected _parseAccounts(data: any): AccountInfo[] {
    const accounts = xmlGetArray(data, 'AccountsResponse.Account');
    return accounts.map((a: any) => ({
      accountId: xmlGetText(a, 'accountId'),
      name: `E*TRADE ${xmlGetText(a, 'accountDesc')} ${xmlGetText(a, 'accountId').slice(-4)}`,
      currency: 'USD',
      netAssets: xmlGetNum(a, 'netAccountValue'),
      totalAssets: xmlGetNum(a, 'netAccountValue'),
      cash: 0,
      marketValue: 0,
    }));
  }

  protected _parseFunds(data: any): FundsInfo {
    const bal = xmlGet(data, 'BalanceResponse.Computed', {});
    return {
      totalAssets: xmlGetNum(bal, 'netAccountValue'),
      cash: xmlGetNum(bal, 'cashBalance') + xmlGetNum(bal, 'moneyMarketBalance'),
      marketValue: xmlGetNum(bal, 'longMarketValue'),
      frozenCash: xmlGetNum(bal, 'marginBalance'),
      availableCash: xmlGetNum(bal, 'cashAvailableForInvestment') || xmlGetNum(bal, 'availableForWithdrawal'),
      currency: 'USD',
    };
  }

  protected _parsePositions(data: any): PositionInfo[] {
    const positions = xmlGetArray(data, 'PortfolioResponse.AccountPortfolio.Position');
    const totalValue = xmlGetNum(data, 'PortfolioResponse.AccountPortfolio.netValue');
    return positions.map((p: any) => {
      const qty = xmlGetNum(p, 'quantity');
      const mktVal = xmlGetNum(p, 'marketValue');
      return {
        code: `US.${xmlGetText(p, 'Product.symbol') || xmlGetText(p, 'symbolDescription')}`,
        name: xmlGetText(p, 'Product.symbol') || xmlGetText(p, 'symbolDescription'),
        qty: qty,
        costPrice: xmlGetNum(p, 'pricePaid'),
        marketPrice: qty > 0 ? mktVal / qty : 0,
        marketValue: mktVal,
        pnl: xmlGetNum(p, 'gainLoss'),
        pnlPct: xmlGetNum(p, 'gainLossPct'),
        ratio: totalValue > 0 ? mktVal / totalValue : 0,
      };
    });
  }

  protected _parseOrders(data: any): OrderInfo[] {
    const orders = xmlGetArray(data, 'OrderListResponse.Order');
    const statusMap: Record<string, OrderInfo['status']> = {
      'OPEN': 'SUBMITTED', 'EXECUTED': 'FILLED', 'CANCELLED': 'CANCELLED',
      'REJECTED': 'REJECTED', 'EXPIRED': 'EXPIRED', 'PARTIAL': 'PARTIALLY_FILLED',
      'PENDING': 'PENDING', 'INDIVIDUAL_FILLS': 'PARTIALLY_FILLED',
    };

    return orders.map((o: any) => {
      const instrument = o?.OrderDetail?.[0]?.Instrument?.[0] || {};
      return {
        orderId: xmlGetText(o, 'orderId'),
        code: `US.${xmlGetText(instrument, 'Product.symbol') || xmlGetText(instrument, 'symbol')}`,
        side: xmlGetText(instrument, 'orderAction')?.includes('BUY') ? 'BUY' : 'SELL',
        orderType: xmlGetText(instrument, 'priceType') === 'LIMIT' ? 'LIMIT'
          : xmlGetText(instrument, 'priceType') === 'STOP' ? 'STOP'
          : 'MARKET',
        qty: xmlGetNum(instrument, 'orderedQuantity'),
        price: xmlGetNum(instrument, 'limitPrice') || xmlGetNum(instrument, 'stopPrice'),
        filledQty: xmlGetNum(instrument, 'filledQuantity') || xmlGetNum(instrument, 'executedQuantity'),
        filledPrice: xmlGetNum(instrument, 'averageExecutionPrice') || xmlGetNum(instrument, 'averagePrice'),
        status: statusMap[xmlGetText(o, 'orderStatus')] || 'PENDING',
        createdAt: xmlGetText(instrument, 'placedTime') || new Date().toISOString(),
      };
    });
  }

  protected _parseOrderResult(data: any): { orderId: string } {
    const id = xmlGetText(data, 'PlaceOrderResponse.OrderIds.OrderId') || xmlGetText(data, 'PlaceOrderResponse.orderId');
    return { orderId: id || `etrade-${Date.now()}` };
  }

  // ═══ Override account methods with correct paths ═══════
  async getAccounts(): Promise<AccountInfo[]> {
    const data = await this._makeAuthRequest('GET', '/accounts/v1/accounts/list');
    return this._parseAccounts(data);
  }

  async getFunds(accountId: string): Promise<FundsInfo> {
    const acctId = accountId || await this._getDefaultAccountId();
    const data = await this._makeAuthRequest('GET', `/accounts/v1/accounts/${acctId}/balance?realTimeNAV=true`);
    return this._parseFunds(data);
  }

  async getPositions(accountId: string): Promise<PositionInfo[]> {
    const acctId = accountId || await this._getDefaultAccountId();
    const data = await this._makeAuthRequest('GET', `/accounts/v1/accounts/${acctId}/portfolio`);
    return this._parsePositions(data);
  }

  async getOrders(accountId: string): Promise<OrderInfo[]> {
    const acctId = accountId || await this._getDefaultAccountId();
    try {
      const data = await this._makeAuthRequest('GET', `/order/v1/accounts/${acctId}/orders?status=ALL&count=50`);
      return this._parseOrders(data);
    } catch {
      return [];
    }
  }

  // ═══ V2 Extensions ══════════════════════════════════════
  getSupportedOrderTypes(): Array<'MARKET' | 'LIMIT' | 'STOP' | 'STOP_LIMIT' | 'TRAILING_STOP' | 'OCO'> {
    return ['MARKET', 'LIMIT', 'STOP', 'STOP_LIMIT', 'TRAILING_STOP', 'OCO'];
  }

  getBrokerType() { return 'etrade' as const; }

  /** E*TRADE-specific: get option chain */
  async getOptionChain(symbol: string, expiryMonth?: string): Promise<any> {
    const sym = symbol.replace(/^US\./, '');
    let path = `/market/v1/optionchains?symbol=${sym}`;
    if (expiryMonth) path += `&expiryMonth=${expiryMonth}`;
    return this._makeAuthRequest('GET', path);
  }

  /** E*TRADE-specific: get alerts */
  async getAlerts(accountId?: string): Promise<any> {
    const acctId = accountId || await this._getDefaultAccountId();
    return this._makeAuthRequest('GET', `/accounts/v1/accounts/${acctId}/alerts`);
  }

  async ping(): Promise<{ latency: number; timestamp: number }> {
    const t0 = Date.now();
    try {
      await this._makeAuthRequest('GET', '/accounts/v1/accounts/list');
      return { latency: Date.now() - t0, timestamp: Date.now() };
    } catch {
      return { latency: -1, timestamp: Date.now() };
    }
  }
}

export default ETRADEAdapter;

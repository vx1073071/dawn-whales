// ── DAWN WHALES — CryptoAdapterBase ──────────────────────────────────────
// R1 INF-08: HMAC签名 + WebSocket订阅 + 统一解析 基类
// 用于 Binance/OKX/Bybit/Bitget 4家加密货币交易所
// 继承 DirectAdapterBase, 添加HMAC签名和WS stream统一管理

import { createHmac } from 'crypto';
import { log } from 'electron-log';
import { DirectAdapterBase, type DirectAdapterConfig } from './DirectAdapterBase';
import type { IBrokerAdapterV2, BrokerType, MarketType, TradingPairInfo, OrderBookInfo, TaggedQuoteInfo } from '../broker/IBrokerAdapterV2';
import type { QuoteInfo, AccountInfo, FundsInfo, PositionInfo, OrderInfo } from '../broker/IBrokerAdapter';

export enum CryptoExchange {
  BINANCE = 'binance',
  OKX = 'okx',
  BYBIT = 'bybit',
  BITGET = 'bitget',
}

// ═══ Crypto-specific Config ═════════════════════════════
export interface CryptoAdapterConfig extends DirectAdapterConfig {
  exchange: CryptoExchange;
  // HMAC签名配置
  signatureHeader: string;       // e.g. 'X-MBX-APIKEY' (Binance), 'OK-ACCESS-KEY' (OKX)
  signatureTimestampHeader: string; // e.g. 'timestamp' (Binance), 'OK-ACCESS-TIMESTAMP' (OKX)
  signatureRequiredHeaders: string[]; // e.g. ['X-MBX-APIKEY'] for Binance
  // WS stream配置
  wsCombinedStreams?: boolean;   // Binance: /ws?streams=A/B/C
  wsPerStream?: boolean;         // OKX: one connection per channel
  // 交易对管理
  tradingPairsCacheMs?: number;  // default: 300000 (5min)
}

// ═══ HMAC Signature Helpers ═════════════════════════════
export interface CryptoSignatureParams {
  method: string;
  path: string;
  queryString?: string;
  body?: string;
  timestamp: number;
  recvWindow?: number;
}

export abstract class CryptoAdapterBase extends DirectAdapterBase {
  protected exchangeConfig: CryptoAdapterConfig;
  protected tradingPairsCache: TradingPairInfo[] | null = null;
  protected tradingPairsCacheAt = 0;

  constructor(config: CryptoAdapterConfig) {
    super(config);
    this.exchangeConfig = config;
  }

  // ═══ HMAC Signing ═════════════════════════════════════
  /**
   * Generate HMAC-SHA256 signature for REST API authentication.
   * Pattern: Binance/Bybit/Bitget use HMAC-SHA256
   * OKX uses HMAC-SHA256 with OK-ACCESS-SIGN header
   */
  protected _hmacSign(queryString: string): string {
    return createHmac('sha256', this.config.secretKey)
      .update(queryString)
      .digest('hex');
  }

  /**
   * Build standard HMAC-signed headers.
   * Subclasses can override for exchange-specific header names.
   */
  protected _buildHeaders(method: string, path: string, body?: string): Record<string, string> {
    const timestamp = Date.now();
    const recvWindow = 5000;

    const params: CryptoSignatureParams = {
      method,
      path,
      body,
      timestamp,
      recvWindow,
    };

    const { queryString, signature } = this._signRequest(params);

    return {
      [this.exchangeConfig.signatureHeader]: this.config.apiKey,
      [this.exchangeConfig.signatureTimestampHeader]: String(timestamp),
      'X-RECV-WINDOW': String(recvWindow),
      'Signature': signature,
    };
  }

  /**
   * Generate query string + signature from params.
   * Must be implemented per-exchange (param ordering differs).
   */
  protected abstract _signRequest(params: CryptoSignatureParams): { queryString: string; signature: string };

  // ═══ WebSocket Stream Parsing ══════════════════════════
  /**
   * Parse raw WebSocket message into TaggedQuoteInfo.
   * Each exchange has different stream format:
   * - Binance: { e: "24hrTicker", s: "BTCUSDT", c: "...", ... }
   * - OKX: { arg: { channel: "tickers", instId: "BTC-USDT" }, data: [...] }
   * - Bybit: { topic: "tickers.BTCUSDT", data: { ... } }
   * - Bitget: { action: "snapshot", arg: { instId: "BTCUSDT" }, data: [...] }
   */
  protected abstract _parseWSQuote(raw: any): TaggedQuoteInfo | null;

  /**
   * Build WebSocket subscribe message for given codes.
   * - Binance: { method: "SUBSCRIBE", params: ["btcusdt@ticker"], id: 1 }
   * - OKX: { op: "subscribe", args: [{ channel: "tickers", instId: "BTC-USDT" }] }
   * - Bybit: { op: "subscribe", args: ["tickers.BTCUSDT"] }
   * - Bitget: { op: "subscribe", args: [{ instType: "SPOT", channel: "ticker", instId: "BTCUSDT" }] }
   */
  protected abstract _buildSubscribeMessage(codes: string[]): any;

  // ═══ Trading Pair Management ═══════════════════════════
  async getTradingPairs(): Promise<TradingPairInfo[]> {
    const now = Date.now();
    const cacheMs = this.exchangeConfig.tradingPairsCacheMs || 300000;
    if (this.tradingPairsCache && (now - this.tradingPairsCacheAt) < cacheMs) {
      return this.tradingPairsCache!;
    }

    try {
      const data = await this._makeRequest('GET', this._tradingPairsPath());
      this.tradingPairsCache = this._parseTradingPairs(data);
      this.tradingPairsCacheAt = now;
      return this.tradingPairsCache!;
    } catch (err: any) {
      if (this.tradingPairsCache) {
        log.warn(`[${this.name}] Trading pairs fetch failed, using cache: ${err.message}`);
        return this.tradingPairsCache;
      }
      throw err;
    }
  }

  getDepth(symbol: string, limit = 20): Promise<any> {
    return this._makeRequest('GET', this._depthPath(symbol, limit));
  }

  // ═══ Abstract Path Builders ════════════════════════════
  protected abstract _tradingPairsPath(): string;
  protected abstract _depthPath(symbol: string, limit: number): string;
  protected abstract _parseTradingPairs(data: any): TradingPairInfo[];

  // ═══ V2 Extensions ═════════════════════════════════════
  getMarkets(): MarketType[] { return ['CRYPTO']; }

  getBrokerType(): BrokerType {
    return this.config.type as BrokerType;
  }

  // ═══ Unified API path overrides (per-exchange implementation) ═══
  protected abstract _quotePath(codes: string[]): string;
  protected abstract _klinePath(code: string, period: string, count: number): string;
  protected abstract _accountPath(): string;
  protected abstract _fundsPath(accountId: string): string;
  protected abstract _positionsPath(accountId: string): string;
  protected abstract _ordersPath(accountId: string): string;
  protected abstract _placeOrderPath(): string;
  protected abstract _cancelOrderPath(orderId: string, accountId: string, code: string): string;
  protected abstract _buildOrderBody(order: any): any;
  protected abstract _parseAccounts(data: any): AccountInfo[];
  protected abstract _parseFunds(data: any): FundsInfo;
  protected abstract _parsePositions(data: any): PositionInfo[];
  protected abstract _parseOrders(data: any): OrderInfo[];
  protected abstract _parseOrderResult(data: any): { orderId: string };

  // Override WS handler
  protected _handleWSMessage(data: string): void {
    try {
      const msg = JSON.parse(data);
      const tagged = this._parseWSQuote(msg);
      if (tagged) {
        this.quotePushCallbacks.forEach(cb => cb([tagged]));
      }
      this.emit('ws:message', msg);
    } catch (err) {
      log.warn(`[${this.name}] WS message parse error:`, err);
    }
  }
}

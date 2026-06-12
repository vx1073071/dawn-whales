/**
 * Robinhood Crypto Adapter — Robinhood Crypto适配器
 * 实现 IBrokerAdapter 统一接口
 *
 * API文档: 非公开 (ED25519签名 + REST)
 * 签名: x-api-key + x-signature + x-timestamp
 * Base URL: https://trading.robinhood.com
 * 注意: 仅Crypto, 无K线/无WS推送(需polling)
 */

import * as crypto from 'crypto';
import type {
  IBrokerAdapter, BrokerCredentials, Quote, Kline, OrderRequest, OrderResult,
  Position, Account, Trade, DataCallback, MarketDataEvent, Market,
} from '../types';

const REST_BASE = 'https://trading.robinhood.com';

interface RHCredentials extends BrokerCredentials {
  privateKey: string; // ED25519 base64 private key
}

export class RobinhoodCryptoAdapter implements IBrokerAdapter {
  readonly name = 'Robinhood Crypto';
  readonly markets: Market[] = ['CRYPTO'];
  readonly supportsRealTime = false; // No WebSocket, polling only

  private creds?: RHCredentials;
  private connected = false;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private quoteListeners = new Map<string, DataCallback[]>();

  async connect(credentials: RHCredentials): Promise<void> {
    this.creds = credentials;
    // Test connectivity
    const res = await this.request('GET', '/api/v1/accounts/');
    if (!res.ok) throw new Error(`Robinhood Crypto connection failed: ${res.status}`);
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    if (this.pollTimer) { clearInterval(this.pollTimer); this.pollTimer = null; }
    this.quoteListeners.clear();
  }

  isConnected(): boolean { return this.connected; }

  // ── ED25519 签名 ──

  private sign(method: string, path: string, body: string, timestamp: string): string {
    if (!this.creds?.privateKey) throw new Error('ED25519 private key required');
    const message = `${this.creds.apiKey}${timestamp}${method}${path}${body}`;
    const sign = crypto.sign(null, Buffer.from(message), {
      key: crypto.createPrivateKey({ key: Buffer.from(this.creds.privateKey, 'base64'), format: 'der', type: 'pkcs8' }),
      dsaEncoding: 'ieee-p1363',
    });
    return sign.toString('base64');
  }

  async getQuote(symbol: string): Promise<Quote> {
    const res = await this.request('GET', `/marketdata/forex/quotes/${symbol}/`);
    const d = await res.json();
    return {
      symbol: d.symbol,
      bid: parseFloat(d.bid_price),
      ask: parseFloat(d.ask_price),
      last: parseFloat(d.mark_price || 0),
      volume: 0,
      change: 0,
      changePercent: 0,
      timestamp: Date.now(),
    };
  }

  async getKlines(symbol: string, interval: string, limit?: number): Promise<Kline[]> {
    // Robinhood Crypto does not provide Klines — return empty
    void symbol; void interval; void limit;
    return [];
  }

  async subscribeMarketData(symbols: string[], callback: DataCallback): Promise<void> {
    // No WebSocket — use polling at 5s intervals
    for (const sym of symbols) {
      const list = this.quoteListeners.get(sym) || [];
      list.push(callback);
      this.quoteListeners.set(sym, list);
    }
    if (!this.pollTimer) {
      this.pollTimer = setInterval(async () => {
        for (const [sym, callbacks] of this.quoteListeners) {
          try {
            const quote = await this.getQuote(sym);
            const evt: MarketDataEvent = { type: 'QUOTE', symbol: sym, data: quote, timestamp: Date.now() };
            callbacks.forEach(cb => cb(evt));
          } catch { /* skip failed polls */ }
        }
      }, 5000);
    }
  }

  async unsubscribeMarketData(symbols: string[]): Promise<void> {
    for (const sym of symbols) this.quoteListeners.delete(sym);
  }

  async placeOrder(order: OrderRequest): Promise<OrderResult> {
    const body = JSON.stringify({
      account_number: this.creds?.accountId,
      client_order_id: order.clientOrderId || `dw-${Date.now()}`,
      side: order.side === 'BUY' ? 'buy' : 'sell',
      type: order.type === 'MARKET' ? 'market' : 'limit',
      symbol: order.symbol,
      quantity: String(order.quantity),
      ...(order.price && { limit_price: String(order.price) }),
    });
    const res = await this.signedRequest('POST', '/api/v1/crypto/trading/orders/', body);
    const d = await res.json();
    return this.mapOrder(d);
  }

  async cancelOrder(orderId: string): Promise<void> {
    await this.signedRequest('POST', `/api/v1/crypto/trading/orders/${orderId}/cancel/`, '');
  }

  async modifyOrder(_orderId: string, _updates: Partial<OrderRequest>): Promise<OrderResult> {
    throw new Error('Robinhood modify: cancel + place new');
  }

  async getOrder(orderId: string): Promise<OrderResult | null> {
    const res = await this.signedRequest('GET', `/api/v1/crypto/trading/orders/${orderId}/`, '');
    const d = await res.json();
    return d ? this.mapOrder(d) : null;
  }

  async getAccount(): Promise<Account> {
    const res = await this.signedRequest('GET', `/api/v1/crypto/trading/accounts/${this.creds?.accountId || ''}/`, '');
    const d = await res.json();
    return {
      accountId: d.account_number,
      currency: 'USD',
      cash: parseFloat(d.buying_power || '0'),
      marketValue: parseFloat(d.portfolio_value || '0'),
      totalEquity: parseFloat(d.equity || '0'),
      buyingPower: parseFloat(d.buying_power || '0'),
    };
  }

  async getPositions(): Promise<Position[]> {
    const res = await this.signedRequest('GET', '/api/v1/crypto/trading/holdings/', '');
    const results = await res.json();
    return (results.results || []).map((h: { currency: { code: string }; quantity: string; cost_basis: string; price: string }) => ({
      symbol: `${h.currency.code}-USD`,
      quantity: parseFloat(h.quantity),
      avgCost: parseFloat(h.cost_basis),
      marketPrice: parseFloat(h.price),
      marketValue: parseFloat(h.quantity) * parseFloat(h.price),
      unrealizedPnl: (parseFloat(h.price) - parseFloat(h.cost_basis)) * parseFloat(h.quantity),
      unrealizedPnlPercent: parseFloat(h.cost_basis) > 0 ? ((parseFloat(h.price) - parseFloat(h.cost_basis)) / parseFloat(h.cost_basis)) * 100 : 0,
    }));
  }

  async getOrders(_status?: string): Promise<OrderResult[]> {
    const res = await this.signedRequest('GET', '/api/v1/crypto/trading/orders/', '');
    const d = await res.json();
    return (d.results || []).map((o: never) => this.mapOrder(o));
  }

  async getTrades(_startTime?: Date, _endTime?: Date): Promise<Trade[]> {
    const orders = await this.getOrders();
    return orders.filter(o => o.status === 'FILLED').map(o => ({
      tradeId: o.orderId,
      orderId: o.orderId,
      symbol: o.symbol,
      side: o.side,
      quantity: o.filledQuantity,
      price: o.avgPrice,
      fee: 0,
      timestamp: o.timestamp,
    }));
  }

  private async request(method: string, path: string): Promise<Response> {
    return fetch(`${REST_BASE}${path}`, { method });
  }

  private async signedRequest(method: string, path: string, body: string): Promise<Response> {
    if (!this.creds?.apiKey) throw new Error('RH credentials required');
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = this.sign(method, path, body, timestamp);
    return fetch(`${REST_BASE}${path}`, {
      method,
      headers: {
        'x-api-key': this.creds.apiKey,
        'x-signature': signature,
        'x-timestamp': timestamp,
        'Content-Type': 'application/json',
      },
      body: body || undefined,
    });
  }

  private mapOrder(d: { id: string; client_order_id?: string; state: string; symbol: string; side: string; type: string; quantity: string; cumulative_quantity: string; average_price: string; created_at: string }): OrderResult {
    const sMap: Record<string, string> = {
      confirmed: 'PENDING', filled: 'FILLED', partially_filled: 'PARTIAL',
      canceled: 'CANCELLED', rejected: 'REJECTED', failed: 'REJECTED',
    };
    return {
      orderId: d.id,
      clientOrderId: d.client_order_id,
      status: (sMap[d.state] || 'PENDING') as OrderResult['status'],
      symbol: d.symbol,
      side: d.side.toUpperCase() as OrderResult['side'],
      type: (d.type === 'market' ? 'MARKET' : 'LIMIT') as OrderResult['type'],
      quantity: parseFloat(d.quantity),
      filledQuantity: parseFloat(d.cumulative_quantity),
      avgPrice: parseFloat(d.average_price),
      timestamp: new Date(d.created_at).getTime(),
    };
  }
}

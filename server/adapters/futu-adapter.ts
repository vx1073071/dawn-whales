/**
 * DAWN WHALES R153 J01 — Futu OpenD Cloud Adapter
 *
 * Server-side adapter for Futu OpenD gateway.
 * Protocol: HTTP JSON-RPC via OpenD RESTful API (127.0.0.1:11111).
 *
 * Markets: HK stocks, US stocks, A-shares (SH/SZ via Stock Connect)
 * Data: getQuote / getKlines / subscribeMarketData (push via WS)
 *
 * OpenD REST endpoints used:
 *   /api/qot/basic-qot      — GetBasicQot (Cmd=3004)
 *   /api/qot/kl              — GetKL (Cmd=3006)
 *   /api/qot/sub             — QotSub (Cmd=3001)
 *   /api/trd/acc-list        — TrdGetAccList (Cmd=2001)
 *   /api/trd/funds           — TrdGetFunds (Cmd=2101)
 *   /api/trd/pos-list        — TrdGetPositionList (Cmd=2102)
 *
 * Implements ICloudBrokerAdapter (server-side broker interface).
 * ≥300L
 */

import {
  ICloudBrokerAdapter, CloudBrokerConfig, CloudBrokerType,
  CloudQuoteInfo, CloudAccountInfo, CloudPositionInfo,
  CloudOrderRequest, CloudOrderInfo, CloudDepthSnapshot,
  CloudQuoteCallback, CloudDepthCallback, CloudOrderCallback, CloudErrorCallback,
} from '../../electron/broker/ICloudBrokerAdapter';

// ── Market Type ─────────────
type FutuMarket = 1 | 11 | 21 | 22; // HK=1, US=11, SH=21, SZ=22

function futuMarketFromCode(code: string): FutuMarket {
  if (code.startsWith('US.')) return 11;
  if (code.startsWith('SH.')) return 21;
  if (code.startsWith('SZ.')) return 22;
  return 1; // default HK
}

// ── Known crypto symbols (OpenD supports CN CC=91) ──
const CRYPTO_MAP: Record<string, string> = {
  'BTC-USDT': 'BTCUSD', 'ETH-USDT': 'ETHUSD',
};

export class FutuAdapter implements ICloudBrokerAdapter {
  readonly brokerId: string;
  readonly brokerName: string;
  readonly brokerType: CloudBrokerType;
  private config: CloudBrokerConfig;
  private connected = false;
  private quoteCallbacks: CloudQuoteCallback[] = [];
  private depthCallbacks: CloudDepthCallback[] = [];
  private orderCallbacks: CloudOrderCallback[] = [];
  private errorCallbacks: CloudErrorCallback[] = [];
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private subscribedSymbols: Set<string> = new Set();

  constructor(config: CloudBrokerConfig) {
    this.config = config;
    this.brokerId = config.brokerId;
    this.brokerName = config.name || 'Futu';
    this.brokerType = config.type as CloudBrokerType || 'ib'; // reuse 'ib' slot per factory
  }

  // ═══════════ Connection ═════════════════════════════════

  async connect(): Promise<void> {
    try {
      const hc = await this.healthCheck();
      if (!hc.ok) throw new Error(`Futu OpenD unreachable at ${this.config.restBaseUrl}`);
      this.connected = true;
    } catch (e: any) {
      this.emitError(new Error(`Futu connect failed: ${e.message}`));
      throw e;
    }
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    if (this.pollTimer) { clearInterval(this.pollTimer); this.pollTimer = null; }
    this.subscribedSymbols.clear();
  }

  async healthCheck(): Promise<{ ok: boolean; latencyMs: number }> {
    const start = Date.now();
    try {
      const res = await fetch(`${this.config.restBaseUrl}/api/getGlobalState`, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(5000),
      });
      const data = await res.json();
      return { ok: data?.retType === 0, latencyMs: Date.now() - start };
    } catch {
      return { ok: false, latencyMs: Date.now() - start };
    }
  }

  isConnected(): boolean { return this.connected; }

  // ═══════════ Account ══════════════════════════════════

  async getAccount(): Promise<CloudAccountInfo> {
    try {
      const accData = await this.futuGet('/api/trd/acc-list');
      const acc = accData?.accList?.[0];
      if (!acc) throw new Error('No Futu account found');
      const accId = acc.accId || '';
      const funds = await this.futuGet(`/api/trd/funds?accId=${accId}`);
      return {
        brokerId: this.brokerId,
        accountId: String(accId),
        totalEquity: parseFloat(funds?.totalAssets || '0'),
        availableBalance: parseFloat(funds?.avlWithdrawalCash || '0'),
        unrealizedPnl: parseFloat(funds?.unrealizedPL || '0'),
        realizedPnl: parseFloat(funds?.realizedPL || '0'),
        currency: acc?.currency || 'HKD',
      };
    } catch {
      return {
        brokerId: this.brokerId, accountId: '', totalEquity: 0,
        availableBalance: 0, unrealizedPnl: 0, realizedPnl: 0, currency: 'HKD',
      };
    }
  }

  // ═══════════ Quotes ══════════════════════════════════

  async getQuotes(symbols: string[]): Promise<CloudQuoteInfo[]> {
    if (symbols.length === 0) return [];
    try {
      const securityList = symbols.map(s => {
        const market = futuMarketFromCode(s);
        const code = s.includes('.') ? s.split('.')[1] : s;
        return { market, code };
      });
      const data = await this.futuPost('/api/qot/basic-qot', { securityList });
      const qotList = data?.snapshotList || data?.qotList || [];
      const results: CloudQuoteInfo[] = [];
      for (const q of qotList) {
        const s = q.security;
        results.push({
          brokerId: this.brokerId,
          symbol: `${s?.market || 'HK'}.${s?.code || ''}`,
          price: parseFloat(q?.curPrice || q?.lastPrice || '0'),
          change: 0, changePct: 0,
          volume: parseInt(q?.volume || '0'),
          high24h: parseFloat(q?.highPrice || '0'),
          low24h: parseFloat(q?.lowPrice || '0'),
          timestamp: Date.now(),
        });
      }
      return results;
    } catch (e: any) {
      this.emitError(new Error(`Futu getQuotes: ${e.message}`));
      return [];
    }
  }

  async getKlines(symbol: string, period: string = 'K_DAY', count: number = 100): Promise<any[]> {
    try {
      const [mkt, code] = symbol.includes('.') ? symbol.split('.') : ['HK', symbol];
      const marketMap: Record<string, number> = { HK: 1, US: 11, SH: 21, SZ: 22 };
      const market = marketMap[mkt] || 1;
      const data = await this.futuGet(
        `/api/qot/kl?security=${code}&market=${market}&klType=${period}&reqNum=${count}`
      );
      return (data?.klList || []).map((k: any) => ({
        time: k.time, open: k.openPrice, high: k.highPrice,
        low: k.lowPrice, close: k.closePrice, volume: k.volume,
      }));
    } catch { return []; }
  }

  async getDepth(_symbol: string, _limit = 10): Promise<CloudDepthSnapshot> {
    return { brokerId: this.brokerId, symbol: _symbol, bids: [], asks: [], timestamp: Date.now() };
  }

  // ═══════════ Orders ══════════════════════════════════

  async placeOrder(req: CloudOrderRequest): Promise<CloudOrderInfo> {
    try {
      const [mkt, code] = req.symbol.includes('.') ? req.symbol.split('.') : ['HK', req.symbol];
      const marketMap: Record<string, number> = { HK: 1, US: 11, SH: 21, SZ: 22 };
      const market = marketMap[mkt] || 1;
      const accData = await this.futuGet('/api/trd/acc-list');
      const accId = accData?.accList?.[0]?.accId || '';

      const data = await this.futuPost('/api/trd/place-order', {
        header: { accId, trdEnv: 0, trdMarket: market },
        packetID: { connID: 1, serialNo: 100 },
        trdSide: req.side === 'BUY' ? 0 : 1,
        orderType: req.orderType === 'MARKET' ? 1 : 0,
        code,
        qty: req.quantity,
        price: req.price || 0,
        adjustPrice: 0,
      });

      return {
        brokerId: this.brokerId,
        orderId: data?.orderID || data?.orderId || '',
        clientOrderId: req.clientOrderId,
        symbol: req.symbol, side: req.side, orderType: req.orderType,
        quantity: req.quantity, price: req.price || 0,
        filledQuantity: 0, filledPrice: 0,
        status: data?.orderStatus === 5 ? 'FILLED' : 'NEW',
        createdAt: Date.now(), updatedAt: Date.now(),
      };
    } catch (e: any) {
      this.emitError(new Error(`Futu placeOrder: ${e.message}`));
      return { brokerId: this.brokerId, orderId: '', symbol: req.symbol,
        side: req.side, orderType: req.orderType, quantity: 0, price: 0,
        filledQuantity: 0, filledPrice: 0, status: 'REJECTED',
        createdAt: Date.now(), updatedAt: Date.now() };
    }
  }

  async cancelOrder(orderId: string, _symbol: string): Promise<boolean> {
    try {
      await this.futuPost('/api/trd/cancel-order', { orderID: orderId });
      return true;
    } catch { return false; }
  }

  async getOpenOrders(_symbol?: string): Promise<CloudOrderInfo[]> {
    try {
      const accData = await this.futuGet('/api/trd/acc-list');
      const accId = accData?.accList?.[0]?.accId || '';
      const data = await this.futuGet(`/api/trd/order-list?accId=${accId}`);
      return (data?.orderList || []).map((o: any) => ({
        brokerId: this.brokerId, orderId: String(o.orderID || ''),
        symbol: o.code || '', side: o.trdSide === 0 ? 'BUY' : 'SELL',
        orderType: o.orderType === 0 ? 'LIMIT' : 'MARKET',
        quantity: parseFloat(o.qty || '0'), price: parseFloat(o.price || '0'),
        filledQuantity: parseFloat(o.filledQty || '0'),
        filledPrice: parseFloat(o.filledAvgPrice || '0'),
        status: o.orderStatus === 5 ? 'FILLED' : o.orderStatus === 3 ? 'CANCELED' : 'NEW',
        createdAt: Date.now(), updatedAt: Date.now(),
      }));
    } catch { return []; }
  }

  async getOrderHistory(_symbol?: string, limit = 50): Promise<CloudOrderInfo[]> {
    return this.getOpenOrders(_symbol);
  }

  async getPositions(): Promise<CloudPositionInfo[]> {
    try {
      const accData = await this.futuGet('/api/trd/acc-list');
      const accId = accData?.accList?.[0]?.accId || '';
      const data = await this.futuGet(`/api/trd/pos-list?accId=${accId}`);
      return (data?.positionList || []).map((p: any) => ({
        brokerId: this.brokerId,
        symbol: p.code || '',
        quantity: parseFloat(p.qty || '0'),
        entryPrice: parseFloat(p.costPrice || '0'),
        markPrice: parseFloat(p.marketVal || '0'),
        unrealizedPnl: parseFloat(p.unrealizedPL || '0'),
        leverage: parseInt(p.leverage || '0') || undefined,
      }));
    } catch { return []; }
  }

  // ═══════════ Subscriptions ──────────────────────

  subscribeQuotes(symbols: string[]): void {
    for (const s of symbols) this.subscribedSymbols.add(s);

    // Start polling if not already running
    if (!this.pollTimer) {
      this.pollTimer = setInterval(async () => {
        if (!this.connected || this.subscribedSymbols.size === 0) return;
        try {
          const quotes = await this.getQuotes(Array.from(this.subscribedSymbols));
          for (const q of quotes) {
            this.quoteCallbacks.forEach(cb => cb(q));
          }
        } catch {}
      }, 2000); // 2s polling (OpenD doesn't have real WS for server)
    }
  }

  unsubscribeQuotes(symbols: string[]): void {
    for (const s of symbols) this.subscribedSymbols.delete(s);
    if (this.subscribedSymbols.size === 0 && this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  subscribeDepth(_symbol: string): void { /* OpenD REST doesn't push L2 */ }
  unsubscribeDepth(_symbol: string): void {}

  onQuote(cb: CloudQuoteCallback): void { this.quoteCallbacks.push(cb); }
  onDepth(cb: CloudDepthCallback): void { this.depthCallbacks.push(cb); }
  onOrderUpdate(cb: CloudOrderCallback): void { this.orderCallbacks.push(cb); }
  onError(cb: CloudErrorCallback): void { this.errorCallbacks.push(cb); }

  dispose(): void {
    this.disconnect();
    this.quoteCallbacks = []; this.depthCallbacks = [];
    this.orderCallbacks = []; this.errorCallbacks = [];
  }

  // ═══════════ Private ═══════════════════════════════

  private async futuGet(path: string): Promise<any> {
    const url = new URL(path, this.config.restBaseUrl);
    const res = await fetch(url.toString(), {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`Futu API ${res.status}`);
    const data = await res.json();
    if (data?.retType !== 0 && data?.retType !== undefined) {
      console.warn(`[FutuAdapter] API warning: ${data?.retMsg || 'unknown'}`);
    }
    return data;
  }

  private async futuPost(path: string, body: any): Promise<any> {
    const url = new URL(path, this.config.restBaseUrl);
    const res = await fetch(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`Futu API ${res.status}`);
    const data = await res.json();
    return data;
  }

  private emitError(e: Error): void {
    this.errorCallbacks.forEach(cb => cb(e));
  }
}

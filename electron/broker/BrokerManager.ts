// ── BrokerManager — 多券商统一管理器 ────────────────────────────────────────
// 管理多个券商适配器，提供统一接口给上层调用

import log from 'electron-log';
import {
  IBrokerAdapter,
  BrokerConfig,
  QuotePushCallback,
  QuoteInfo,
  AccountInfo,
  FundsInfo,
  PositionInfo,
  OrderInfo,
  KlineInfo,
  PlaceOrderRequest,
} from './IBrokerAdapter';
import { FutuOpenDClient } from './futu-opend';

export interface BrokerStatus {
  id: string;
  name: string;
  type: string;
  connected: boolean;
  accountCount: number;
  lastError?: string;
}

export class BrokerManager {
  private adapters = new Map<string, IBrokerAdapter>();
  private configs: BrokerConfig[] = [];
  private pushCallbacks: QuotePushCallback[] = [];
  private activeBrokerId: string | null = null;

  // ── Config Management ──────────────────────────────────────────────

  loadConfigs(configs: BrokerConfig[]) {
    this.configs = configs.filter((c) => c.enabled);
    log.info('[BrokerManager] Loaded', this.configs.length, 'broker configs');
  }

  getConfigs(): BrokerConfig[] {
    return [...this.configs];
  }

  addConfig(config: BrokerConfig) {
    this.configs.push(config);
    log.info('[BrokerManager] Added broker config:', config.id);
  }

  removeConfig(id: string) {
    this.configs = this.configs.filter((c) => c.id !== id);
    this.disconnect(id);
    log.info('[BrokerManager] Removed broker config:', id);
  }

  // ── Adapter Factory ────────────────────────────────────────────────

  private createAdapter(config: BrokerConfig): IBrokerAdapter {
    switch (config.type) {
      case 'futu':
      case 'moomoo':
        // Futu and Moomoo share the same OpenD protocol
        return new FutuBrokerAdapter(config);
      default:
        throw new Error(`Unsupported broker type: ${config.type}`);
    }
  }

  // ── Connection ─────────────────────────────────────────────────────

  async connect(brokerId?: string): Promise<void> {
    if (brokerId) {
      const config = this.configs.find((c) => c.id === brokerId);
      if (!config) throw new Error(`Broker config not found: ${brokerId}`);

      const adapter = this.createAdapter(config);
      adapter.onQuotePush((quotes) => this.broadcastQuotes(quotes));
      adapter.onDisconnect(() => {
        log.warn(`[BrokerManager] ${brokerId} disconnected`);
        if (this.activeBrokerId === brokerId) this.activeBrokerId = null;
      });

      await adapter.connect();
      this.adapters.set(brokerId, adapter);
      this.activeBrokerId = brokerId;
      log.info(`[BrokerManager] Connected ${brokerId}`);
      return;
    }

    // Connect all enabled brokers
    for (const config of this.configs) {
      if (this.adapters.has(config.id)) continue;
      try {
        const adapter = this.createAdapter(config);
        adapter.onQuotePush((quotes) => this.broadcastQuotes(quotes));
        adapter.onDisconnect(() => {
          log.warn(`[BrokerManager] ${config.id} disconnected`);
          if (this.activeBrokerId === config.id) this.activeBrokerId = null;
        });
        await adapter.connect();
        this.adapters.set(config.id, adapter);
        if (!this.activeBrokerId) this.activeBrokerId = config.id;
        log.info(`[BrokerManager] Connected ${config.id}`);
      } catch (err: any) {
        log.error(`[BrokerManager] Failed to connect ${config.id}:`, err.message);
      }
    }
  }

  async disconnect(brokerId?: string): Promise<void> {
    if (brokerId) {
      const adapter = this.adapters.get(brokerId);
      if (adapter) {
        await adapter.disconnect();
        this.adapters.delete(brokerId);
        if (this.activeBrokerId === brokerId) this.activeBrokerId = null;
      }
      return;
    }

    for (const [id, adapter] of this.adapters) {
      await adapter.disconnect();
      log.info(`[BrokerManager] Disconnected ${id}`);
    }
    this.adapters.clear();
    this.activeBrokerId = null;
  }

  // ── Active Broker ──────────────────────────────────────────────────

  setActiveBroker(id: string) {
    if (!this.adapters.has(id)) throw new Error(`Broker not connected: ${id}`);
    this.activeBrokerId = id;
    log.info('[BrokerManager] Active broker:', id);
  }

  getActiveBroker(): IBrokerAdapter | null {
    if (!this.activeBrokerId) return null;
    return this.adapters.get(this.activeBrokerId) || null;
  }

  getActiveBrokerId(): string | null {
    return this.activeBrokerId;
  }

  // ── Status ─────────────────────────────────────────────────────────

  getStatus(): BrokerStatus[] {
    return this.configs.map((c) => {
      const adapter = this.adapters.get(c.id);
      return {
        id: c.id,
        name: c.name,
        type: c.type,
        connected: adapter?.connected ?? false,
        accountCount: 0, // populated lazily
      };
    });
  }

  // ── Sprint1: Expose adapters map for broker switching ─────────────────
  getAdapters(): Map<string, IBrokerAdapter> {
    return this.adapters;
  }

  // ── Push ───────────────────────────────────────────────────────────

  onQuotePush(callback: QuotePushCallback) {
    this.pushCallbacks.push(callback);
  }

  private broadcastQuotes(quotes: QuoteInfo[]) {
    for (const cb of this.pushCallbacks) {
      try { cb(quotes); } catch (e: any) { log.warn('[BrokerManager] Push callback error:', e.message); }
    }
  }

  async subscribeAndPush(brokerId: string | undefined, codes: string[]): Promise<void> {
    const adapter = brokerId ? this.adapters.get(brokerId) : this.getActiveBroker();
    if (!adapter) throw new Error('No broker connected');
    await adapter.subscribeAndPush(codes);
  }

  // ── Market Data (delegated to active or specified broker) ──────────

  async getQuotes(codes: string[], brokerId?: string): Promise<QuoteInfo[]> {
    const adapter = brokerId ? this.adapters.get(brokerId) : this.getActiveBroker();
    if (!adapter) throw new Error('No broker connected');
    return adapter.getQuotes(codes);
  }

  async getKlines(code: string, period: string, count: number, brokerId?: string): Promise<KlineInfo[]> {
    const adapter = brokerId ? this.adapters.get(brokerId) : this.getActiveBroker();
    if (!adapter) throw new Error('No broker connected');
    return adapter.getKlines(code, period, count);
  }

  // ── Trading (delegated to active or specified broker) ──────────────

  async getAccounts(brokerId?: string): Promise<AccountInfo[]> {
    const adapter = brokerId ? this.adapters.get(brokerId) : this.getActiveBroker();
    if (!adapter) throw new Error('No broker connected');
    return adapter.getAccounts();
  }

  async getFunds(accountId: string, brokerId?: string): Promise<FundsInfo | null> {
    const adapter = brokerId ? this.adapters.get(brokerId) : this.getActiveBroker();
    if (!adapter) throw new Error('No broker connected');
    return adapter.getFunds(accountId);
  }

  async getPositions(accountId: string, brokerId?: string): Promise<PositionInfo[]> {
    const adapter = brokerId ? this.adapters.get(brokerId) : this.getActiveBroker();
    if (!adapter) throw new Error('No broker connected');
    return adapter.getPositions(accountId);
  }

  async getOrders(accountId: string, brokerId?: string): Promise<OrderInfo[]> {
    const adapter = brokerId ? this.adapters.get(brokerId) : this.getActiveBroker();
    if (!adapter) throw new Error('No broker connected');
    return adapter.getOrders(accountId);
  }

  async placeOrder(order: PlaceOrderRequest, brokerId?: string): Promise<{ orderId: string }> {
    const adapter = brokerId ? this.adapters.get(brokerId) : this.getActiveBroker();
    if (!adapter) throw new Error('No broker connected');
    return adapter.placeOrder(order);
  }

  async cancelOrder(orderId: string, accountId: string, code: string, brokerId?: string): Promise<void> {
    const adapter = brokerId ? this.adapters.get(brokerId) : this.getActiveBroker();
    if (!adapter) throw new Error('No broker connected');
    return adapter.cancelOrder(orderId, accountId, code);
  }
}

// ── FutuBrokerAdapter — wraps FutuOpenDClient to implement IBrokerAdapter ───

class FutuBrokerAdapter implements IBrokerAdapter {
  readonly config: BrokerConfig;
  private client: FutuOpenDClient;
  private _connected = false;

  constructor(config: BrokerConfig) {
    this.config = config;
    this.client = new FutuOpenDClient(config.host, config.port);
  }

  get connected() { return this._connected; }

  async connect(): Promise<void> {
    await this.client.connect();
    this._connected = true;
  }

  async disconnect(): Promise<void> {
    this.client.disconnect();
    this._connected = false;
  }

  onQuotePush(callback: QuotePushCallback) {
    this.client.onQuotePush((quotes) => callback(quotes as QuoteInfo[]));
  }

  onDisconnect(callback: () => void) {
    this.client.onDisconnect(callback);
  }

  async subscribeAndPush(codes: string[]): Promise<void> {
    await this.client.subscribeAndPush(codes);
  }

  async getQuotes(codes: string[]): Promise<QuoteInfo[]> {
    return this.client.getQuotes(codes) as Promise<QuoteInfo[]>;
  }

  async getKlines(code: string, period: string, count: number): Promise<KlineInfo[]> {
    return this.client.getKlines(code, period, count) as Promise<KlineInfo[]>;
  }

  async getAccounts(): Promise<AccountInfo[]> {
    return this.client.getAccounts() as Promise<AccountInfo[]>;
  }

  async getFunds(accountId: string): Promise<FundsInfo | null> {
    return this.client.getFunds(accountId) as Promise<FundsInfo | null>;
  }

  async getPositions(accountId: string): Promise<PositionInfo[]> {
    return this.client.getPositions(accountId) as Promise<PositionInfo[]>;
  }

  async getOrders(accountId: string): Promise<OrderInfo[]> {
    return this.client.getOrders(accountId) as Promise<OrderInfo[]>;
  }

  async placeOrder(order: PlaceOrderRequest): Promise<{ orderId: string }> {
    return this.client.placeOrder({
      ...order,
      trdEnv: order.trdEnv || 'REAL',
    });
  }

  async cancelOrder(orderId: string, accountId: string, code: string): Promise<void> {
    await this.client.cancelOrder(orderId, accountId, code);
  }
}

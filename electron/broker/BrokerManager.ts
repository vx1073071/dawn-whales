// ── DAWN WHALES — Broker Manager (Multi-Broker) ──────────────────────────────
// Sprint 1: 多券商统一管理器

import log from 'electron-log';
import { FutuOpenDClient } from './futu-opend';
import type { BrokerConfig, IBrokerAdapter, QuoteInfo, KlineInfo, AccountInfo, FundsInfo, PositionInfo, OrderInfo, PlaceOrderRequest } from './IBrokerAdapter';

// ── Futu/Moomoo Adapter (wrapper around FutuOpenDClient) ─────────────────

class FutuBrokerAdapter implements IBrokerAdapter {
  readonly id: string;
  readonly type: string;
  readonly name: string;
  private client: FutuOpenDClient | null = null;
  private _connected = false;
  private config: BrokerConfig;
  private quoteCallbacks: Array<(quotes: QuoteInfo[]) => void> = [];
  private disconnectCallbacks: Array<() => void> = [];

  constructor(config: BrokerConfig) {
    this.id = config.id;
    this.type = config.type;
    this.name = config.name;
    this.config = config;
  }

  get connected(): boolean { return this._connected && (this.client?.connected ?? false); }

  async connect(): Promise<void> {
    // Clean up old client to prevent socket leak
    if (this.client) {
      this.client.disconnect();
      this.client = null;
    }
    this.quoteCallbacks = [];
    this.disconnectCallbacks = [];

    this.client = new FutuOpenDClient(this.config.host, this.config.port);
    await this.client.connect();
    this._connected = true;

    this.client.onQuotePush((quotes) => {
      for (const cb of this.quoteCallbacks) cb(quotes);
    });

    this.client.onDisconnect(() => {
      this._connected = false;
      for (const cb of this.disconnectCallbacks) cb();
    });
  }

  disconnect(): void {
    this.client?.disconnect();
    this._connected = false;
  }

  onQuotePush(callback: (quotes: QuoteInfo[]) => void): void {
    this.quoteCallbacks.push(callback);
  }

  removeQuotePush(callback: (quotes: QuoteInfo[]) => void): void {
    this.quoteCallbacks = this.quoteCallbacks.filter((cb) => cb !== callback);
  }

  onDisconnect(callback: () => void): void {
    this.disconnectCallbacks.push(callback);
  }

  async getQuotes(codes: string[]): Promise<QuoteInfo[]> {
    return this.client?.getQuotes(codes) ?? [];
  }

  async getKlines(code: string, period: string, count: number): Promise<KlineInfo[]> {
    return this.client?.getKlines(code, period, count) ?? [];
  }

  async getAccounts(): Promise<AccountInfo[]> {
    return this.client?.getAccounts() ?? [];
  }

  async getFunds(accountId: string): Promise<FundsInfo> {
    return this.client?.getFunds(accountId) ?? { totalAssets: 0, cash: 0, marketValue: 0, frozenCash: 0, availableCash: 0, currency: 'USD' };
  }

  async getPositions(accountId: string): Promise<PositionInfo[]> {
    return this.client?.getPositions(accountId) ?? [];
  }

  async getOrders(accountId: string): Promise<OrderInfo[]> {
    return this.client?.getOrders(accountId) ?? [];
  }

  async placeOrder(order: PlaceOrderRequest): Promise<{ orderId: string }> {
    if (!this.client) throw new Error('Not connected');
    return this.client.placeOrder(order);
  }

  async cancelOrder(orderId: string, accountId: string, code: string): Promise<void> {
    if (!this.client) throw new Error('Not connected');
    return this.client.cancelOrder(orderId, accountId, code);
  }

  async subscribeAndPush(codes: string[]): Promise<void> {
    if (!this.client) throw new Error('Not connected');
    return this.client.subscribeAndPush(codes);
  }
}

// ── Broker Manager ─────────────────────────────────────────────────────────

export class BrokerManager {
  private brokers: Map<string, IBrokerAdapter> = new Map();
  private configs: Map<string, BrokerConfig> = new Map();
  private activeBrokerId: string | null = null;
  private quoteCallbacks: Array<(quotes: QuoteInfo[]) => void> = [];

  loadConfigs(configs: BrokerConfig[]): void {
    for (const cfg of configs) {
      this.configs.set(cfg.id, cfg);
      log.info(`[BrokerManager] Loaded config: ${cfg.id} (${cfg.type})`);
    }
  }

  addConfig(config: BrokerConfig): void {
    this.configs.set(config.id, config);
  }

  removeConfig(brokerId: string): void {
    this.configs.delete(brokerId);
    this.disconnect(brokerId);
  }

  async connect(brokerId: string): Promise<void> {
    const config = this.configs.get(brokerId);
    if (!config) throw new Error(`Broker config not found: ${brokerId}`);

    // Disconnect old adapter to prevent socket leak
    if (this.brokers.has(brokerId)) {
      this.disconnect(brokerId);
    }

    const adapter = this.createAdapter(config);
    await adapter.connect();
    this.brokers.set(brokerId, adapter);
    this.activeBrokerId = brokerId;

    // Forward adapter quotes to BrokerManager callbacks
    adapter.onQuotePush((quotes) => {
      for (const cb of this.quoteCallbacks) cb(quotes);
    });

    log.info(`[BrokerManager] Connected: ${brokerId}`);
  }

  disconnect(brokerId?: string): void {
    const id = brokerId || this.activeBrokerId;
    if (id) {
      this.brokers.get(id)?.disconnect();
      this.brokers.delete(id);
      if (this.activeBrokerId === id) this.activeBrokerId = null;
      log.info(`[BrokerManager] Disconnected: ${id}`);
    }
  }

  setActiveBroker(brokerId: string): void {
    if (this.brokers.has(brokerId)) {
      this.activeBrokerId = brokerId;
      log.info(`[BrokerManager] Active broker: ${brokerId}`);
    }
  }

  getActiveBroker(): IBrokerAdapter | null {
    if (!this.activeBrokerId) return null;
    return this.brokers.get(this.activeBrokerId) || null;
  }

  getBroker(brokerId: string): IBrokerAdapter | null {
    return this.brokers.get(brokerId) || null;
  }

  getStatus(): Array<{ id: string; name: string; type: string; connected: boolean; active: boolean }> {
    return Array.from(this.configs.values()).map((cfg) => ({
      id: cfg.id,
      name: cfg.name,
      type: cfg.type,
      connected: this.brokers.get(cfg.id)?.connected ?? false,
      active: this.activeBrokerId === cfg.id,
    }));
  }

  onQuotePush(callback: (quotes: QuoteInfo[]) => void): void {
    this.quoteCallbacks.push(callback);
  }

  removeQuotePush(callback: (quotes: QuoteInfo[]) => void): void {
    this.quoteCallbacks = this.quoteCallbacks.filter((cb) => cb !== callback);
  }

  clearCallbacks(): void {
    this.quoteCallbacks = [];
  }

  async subscribeAndPush(brokerId: string, codes: string[]): Promise<void> {
    const broker = this.brokers.get(brokerId);
    if (broker) await broker.subscribeAndPush(codes);
  }

  private createAdapter(config: BrokerConfig): IBrokerAdapter {
    // All Futu/moomoo share the same OpenD protocol
    if (config.type === 'moomoo') {
      const { MoomooBrokerAdapter } = require('./moomoo-adapter');
      return new MoomooBrokerAdapter(config);
    }
    return new FutuBrokerAdapter(config);
  }
}

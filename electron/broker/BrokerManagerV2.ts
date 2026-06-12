// ── DAWN WHALES — BrokerManagerV2 ───────────────────────────────────────
// R1 INF-02: 多券商并发连接管理器 (无activeBrokerId概念)
// 所有已连接券商同时活跃, per-broker独立订阅+聚合查询

import { log } from 'electron-log';
import type { IBrokerAdapterV2, BrokerConnectionStatus, TaggedQuoteInfo, TaggedPositionInfo, TaggedOrderInfo, TaggedPlaceOrderRequest, BrokerConfig, BrokerType, MarketType } from './IBrokerAdapterV2';
import type { AccountInfo, FundsInfo, PositionInfo, OrderInfo, QuoteInfo, KlineInfo, PlaceOrderRequest, IBrokerAdapter } from './IBrokerAdapter';
import { getCredentialManager } from './CredentialManager';
import { DirectAdapterBase } from './adapters/DirectAdapterBase';

export interface BrokerManagerV2Config {
  maxConcurrentConnections?: number;    // default: 20
  connectionTimeoutMs?: number;         // default: 30000
  healthCheckIntervalMs?: number;       // default: 60000
  autoReconnect?: boolean;              // default: true
  maxReconnectAttempts?: number;        // default: 5
  reconnectBackoffMs?: number;          // base, default: 1000
}

const DEFAULT_CONFIG: Required<BrokerManagerV2Config> = {
  maxConcurrentConnections: 20,
  connectionTimeoutMs: 30000,
  healthCheckIntervalMs: 60000,
  autoReconnect: true,
  maxReconnectAttempts: 5,
  reconnectBackoffMs: 1000,
};

type QuoteCallback = (quotes: TaggedQuoteInfo[]) => void;
type StatusChangeCallback = (status: BrokerConnectionStatus) => void;

interface BrokerEntry {
  config: BrokerConfig;
  adapter: IBrokerAdapter;
  createFn: () => IBrokerAdapter;
  status: BrokerConnectionStatus;
  quoteCallbacks: Set<QuoteCallback>;
  statusCallbacks: Set<StatusChangeCallback>;
  reconnectAttempts: number;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
}

export class BrokerManagerV2 {
  private brokers = new Map<string, BrokerEntry>();
  private config: Required<BrokerManagerV2Config>;
  private healthCheckTimer: ReturnType<typeof setInterval> | null = null;
  private globalQuoteCallbacks = new Set<QuoteCallback>();
  private globalStatusCallbacks = new Set<StatusChangeCallback>();
  private adapterFactory = new Map<BrokerType, (config: BrokerConfig) => IBrokerAdapter>();

  constructor(config: BrokerManagerV2Config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ═══ Adapter Factory ════════════════════════════════════
  registerAdapterFactory(type: BrokerType, factory: (config: BrokerConfig) => IBrokerAdapter): void {
    this.adapterFactory.set(type, factory);
    log.info(`[BrokerManagerV2] Registered factory for: ${type}`);
  }

  // ═══ Connection Management ══════════════════════════════
  async connect(config: BrokerConfig): Promise<void> {
    if (this.brokers.has(config.id)) {
      log.warn(`[BrokerManagerV2] Already connected: ${config.id}`);
      return;
    }

    let adapter: IBrokerAdapter;

    // R119 #37: Inject secrets from secure storage before creating adapter
    const credMgr = getCredentialManager();
    const secureConfig = await credMgr.injectSecrets(config);

    if (this.adapterFactory.has(secureConfig.type)) {
      adapter = this.adapterFactory.get(secureConfig.type)!(secureConfig);
    } else {
      throw new Error(`[BrokerManagerV2] No adapter factory for type: ${config.type}`);
    }

    const entry: BrokerEntry = {
      config,
      adapter,
      createFn: () => adapter,
      status: {
        brokerId: config.id,
        brokerName: config.name,
        brokerType: config.type,
        connected: false,
        subscriptionsCount: 0,
      },
      quoteCallbacks: new Set(),
      statusCallbacks: new Set(),
      reconnectAttempts: 0,
      reconnectTimer: null,
    };

    this.brokers.set(config.id, entry);

    try {
      await adapter.connect();
      entry.status.connected = true;
      entry.status.connectedAt = Date.now();
      entry.reconnectAttempts = 0;
      log.info(`[BrokerManagerV2] Connected: ${config.id} (${config.type})`);

      // Wire quote push -> Tagged
      adapter.onQuotePush((quotes) => {
        this.handleQuotes(config.id, quotes);
      });

      adapter.onDisconnect(() => {
        this.handleDisconnect(config.id);
      });
    } catch (err: any) {
      log.error(`[BrokerManagerV2] Connect failed: ${config.id} — ${err.message}`);
      if (this.config.autoReconnect) {
        this.scheduleReconnect(config.id);
      }
      throw err;
    }

    this.notifyStatus(entry);

    // Start health checks if not running
    if (!this.healthCheckTimer) {
      this.startHealthChecks();
    }
  }

  async connectMany(configs: BrokerConfig[]): Promise<Array<{ brokerId: string; success: boolean; error?: string }>> {
    const results: Array<{ brokerId: string; success: boolean; error?: string }> = [];
    const pending: Array<() => Promise<void>> = [];

    for (const cfg of configs) {
      pending.push(async () => {
        try {
          await this.connect(cfg);
          results.push({ brokerId: cfg.id, success: true });
        } catch (err: any) {
          results.push({ brokerId: cfg.id, success: false, error: err.message });
        }
      });
    }

    // Concurrent with limit
    const limit = this.config.maxConcurrentConnections;
    for (let i = 0; i < pending.length; i += limit) {
      await Promise.all(pending.slice(i, i + limit).map(fn => fn()));
    }

    return results;
  }

  async disconnect(brokerId: string): Promise<void> {
    const entry = this.brokers.get(brokerId);
    if (!entry) return;

    this.clearReconnect(brokerId);
    entry.adapter.disconnect();
    entry.status.connected = false;
    this.brokers.delete(brokerId);
    this.notifyStatus(entry);
    log.info(`[BrokerManagerV2] Disconnected: ${brokerId}`);
  }

  async disconnectAll(): Promise<void> {
    const ids = Array.from(this.brokers.keys());
    await Promise.all(ids.map(id => this.disconnect(id)));
  }

  // ═══ Subscription Management ══════════════════════════
  async subscribe(brokerId: string, codes: string[]): Promise<void> {
    const entry = this.brokers.get(brokerId);
    if (!entry || !entry.status.connected) {
      throw new Error(`[BrokerManagerV2] Broker not connected: ${brokerId}`);
    }
    await entry.adapter.subscribeAndPush(codes);
    entry.status.subscriptionsCount = codes.length;
    log.info(`[BrokerManagerV2] Subscribed ${brokerId}: ${codes.length} codes`);
  }

  async subscribeAll(codes: string[]): Promise<void> {
    const promises: Promise<void>[] = [];
    for (const [id] of this.brokers) {
      promises.push(this.subscribe(id, codes).catch(err => {
        log.warn(`[BrokerManagerV2] Subscribe failed for ${id}: ${err.message}`);
      }));
    }
    await Promise.all(promises);
  }

  async getSubscriptions(brokerId: string): Promise<string[]> {
    const entry = this.brokers.get(brokerId);
    return entry ? Array.from(entry.quoteCallbacks).length > 0 ? ['*'] : [] : [];
  }

  // ═══ Aggregated Queries ═══════════════════════════════
  async getAggregatedFunds(): Promise<Array<TaggedPositionInfo & { currency: string; netAssets: number; cash: number }>> {
    const allFunds: Array<any> = [];
    for (const [brokerId, entry] of this.brokers) {
      if (!entry.status.connected) continue;
      try {
        const accounts = await entry.adapter.getAccounts();
        for (const acc of accounts) {
          const funds = await entry.adapter.getFunds(acc.accountId);
          allFunds.push({
            brokerId,
            brokerName: entry.config.name,
            brokerType: entry.config.type,
            accountId: acc.accountId,
            currency: funds.currency,
            netAssets: acc.netAssets,
            cash: funds.cash,
            marketValue: funds.marketValue,
            frozenCash: funds.frozenCash,
            availableCash: funds.availableCash,
          });
        }
      } catch (err: any) {
        log.warn(`[BrokerManagerV2] getAggregatedFunds failed for ${brokerId}: ${err.message}`);
      }
    }
    return allFunds;
  }

  async getAggregatedPositions(): Promise<TaggedPositionInfo[]> {
    const allPositions: TaggedPositionInfo[] = [];
    for (const [brokerId, entry] of this.brokers) {
      if (!entry.status.connected) continue;
      try {
        const accounts = await entry.adapter.getAccounts();
        for (const acc of accounts) {
          const positions = await entry.adapter.getPositions(acc.accountId);
          for (const pos of positions) {
            allPositions.push({
              code: pos.code,
              name: pos.name,
              qty: pos.qty,
              costPrice: pos.costPrice,
              marketPrice: pos.marketPrice,
              marketValue: pos.marketValue,
              pnl: pos.pnl,
              pnlPct: pos.pnlPct,
              ratio: pos.ratio,
              brokerId,
              brokerName: entry.config.name,
              brokerType: entry.config.type,
              market: this.inferMarket(pos.code),
              standardCode: pos.code,
              currency: acc.currency,
            });
          }
        }
      } catch (err: any) {
        log.warn(`[BrokerManagerV2] getAggregatedPositions failed for ${brokerId}: ${err.message}`);
      }
    }
    return allPositions;
  }

  async getAggregatedOrders(accountId?: string): Promise<TaggedOrderInfo[]> {
    const allOrders: TaggedOrderInfo[] = [];
    for (const [brokerId, entry] of this.brokers) {
      if (!entry.status.connected) continue;
      try {
        const accounts = accountId
          ? [{ accountId }]
          : await entry.adapter.getAccounts();
        for (const acc of accounts) {
          const orders = await entry.adapter.getOrders(acc.accountId);
          for (const ord of orders) {
            allOrders.push({
              orderId: ord.orderId,
              code: ord.code,
              side: ord.side,
              orderType: ord.orderType,
              qty: ord.qty,
              price: ord.price,
              filledQty: ord.filledQty,
              filledPrice: ord.filledPrice,
              status: ord.status as any,
              createdAt: ord.createdAt,
              brokerId,
              brokerName: entry.config.name,
              brokerType: entry.config.type,
              standardCode: ord.code,
            });
          }
        }
      } catch (err: any) {
        log.warn(`[BrokerManagerV2] getAggregatedOrders failed for ${brokerId}: ${err.message}`);
      }
    }
    return allOrders;
  }

  // ═══ Event Callbacks ════════════════════════════════════
  onGlobalQuote(callback: QuoteCallback): void {
    this.globalQuoteCallbacks.add(callback);
  }

  removeGlobalQuote(callback: QuoteCallback): void {
    this.globalQuoteCallbacks.delete(callback);
  }

  onGlobalStatusChange(callback: StatusChangeCallback): void {
    this.globalStatusCallbacks.add(callback);
  }

  removeGlobalStatusChange(callback: StatusChangeCallback): void {
    this.globalStatusCallbacks.delete(callback);
  }

  // ═══ Status Management ═══════════════════════════════
  getStatus(brokerId: string): BrokerConnectionStatus | null {
    return this.brokers.get(brokerId)?.status ?? null;
  }

  getAllStatuses(): BrokerConnectionStatus[] {
    return Array.from(this.brokers.values()).map(e => ({ ...e.status }));
  }

  getConnectedBrokers(): string[] {
    return Array.from(this.brokers.entries())
      .filter(([_, e]) => e.status.connected)
      .map(([id]) => id);
  }

  getConnectedCount(): number {
    return this.getConnectedBrokers().length;
  }

  // ═══ Private Helpers ═══════════════════════════════════
  private handleQuotes(brokerId: string, rawQuotes: QuoteInfo[]): void {
    const entry = this.brokers.get(brokerId);
    if (!entry) return;

    const tagged: TaggedQuoteInfo[] = rawQuotes.map(q => ({
      code: q.code,
      price: q.price,
      change: q.change,
      changePct: q.changePct,
      volume: q.volume,
      turnover: q.turnover,
      high: q.high,
      low: q.low,
      open: q.open,
      prevClose: q.prevClose,
      time: q.time,
      brokerId,
      brokerName: entry.config.name,
      brokerType: entry.config.type,
      market: this.inferMarket(q.code),
      originalCode: q.code,
      standardCode: q.code, // CodeNormalizer处理
      timestamp: Date.now(),
    }));

    // Per-broker callbacks
    entry.quoteCallbacks.forEach(cb => cb(tagged));
    // Global callbacks (QuoteAggregator listens here)
    this.globalQuoteCallbacks.forEach(cb => cb(tagged));
  }

  private handleDisconnect(brokerId: string): void {
    const entry = this.brokers.get(brokerId);
    if (!entry) return;

    entry.status.connected = false;
    this.notifyStatus(entry);

    if (this.config.autoReconnect) {
      this.scheduleReconnect(brokerId);
    }
  }

  private scheduleReconnect(brokerId: string): void {
    const entry = this.brokers.get(brokerId);
    if (!entry) return;

    if (entry.reconnectAttempts >= this.config.maxReconnectAttempts) {
      log.error(`[BrokerManagerV2] Max reconnect attempts reached: ${brokerId}`);
      return;
    }

    const delay = this.config.reconnectBackoffMs * Math.pow(2, entry.reconnectAttempts);
    entry.reconnectAttempts++;

    log.info(`[BrokerManagerV2] Reconnecting ${brokerId} in ${delay}ms (attempt ${entry.reconnectAttempts})`);
    entry.reconnectTimer = setTimeout(async () => {
      try {
        // Re-create adapter
        const newAdapter = entry.createFn();
        entry.adapter = newAdapter;
        await newAdapter.connect();
        entry.status.connected = true;
        entry.status.connectedAt = Date.now();
        entry.reconnectAttempts = 0;
        this.notifyStatus(entry);

        newAdapter.onQuotePush((quotes) => {
          this.handleQuotes(brokerId, quotes);
        });
        newAdapter.onDisconnect(() => {
          this.handleDisconnect(brokerId);
        });

        log.info(`[BrokerManagerV2] Reconnected: ${brokerId}`);
      } catch (err: any) {
        log.warn(`[BrokerManagerV2] Reconnect failed: ${brokerId} — ${err.message}`);
        this.scheduleReconnect(brokerId);
      }
    }, delay);
  }

  private clearReconnect(brokerId: string): void {
    const entry = this.brokers.get(brokerId);
    if (entry?.reconnectTimer) {
      clearTimeout(entry.reconnectTimer);
      entry.reconnectTimer = null;
    }
  }

  private startHealthChecks(): void {
    this.healthCheckTimer = setInterval(() => {
      for (const [brokerId, entry] of this.brokers) {
        if (!entry.status.connected) continue;
        // Use V2 ping if available
        const adapter = entry.adapter as IBrokerAdapterV2;
        adapter.ping?.().then(result => {
          entry.status.latencyP50 = result.latency;
          entry.status.latencyP99 = result.latency * 1.5;
        }).catch(() => {});
      }
    }, this.config.healthCheckIntervalMs);
  }

  private notifyStatus(entry: BrokerEntry): void {
    const status = { ...entry.status };
    entry.statusCallbacks.forEach(cb => cb(status));
    this.globalStatusCallbacks.forEach(cb => cb(status));
  }

  private inferMarket(code: string): MarketType {
    if (code.startsWith('US.')) return 'US';
    if (code.startsWith('HK.')) return 'HK';
    if (code.startsWith('SH.') || code.startsWith('SZ.')) return 'CN';
    if (code.startsWith('SG.')) return 'SG';
    if (code.startsWith('JP.')) return 'JP';
    // Crypto: no prefix or contains USDT/BTC/ETH
    if (code.includes('USDT') || code.includes('BTC') || code.includes('ETH')) return 'CRYPTO';
    if (code.includes('EURGBP') || code.includes('GBPUSD')) return 'UK';
    return 'US';
  }

  // ═══ R119: Status & Observability ══════════════════════
  
  /** Get full connection status map (all brokers) */
  getConnectionStatus(): Map<string, BrokerConnectionStatus> {
    const map = new Map<string, BrokerConnectionStatus>();
    for (const [id, entry] of this.brokers) {
      map.set(id, { ...entry.status });
    }
    return map;
  }

  /** Subscribe to status changes for a specific broker */
  onStatusChange(brokerId: string, callback: StatusChangeCallback): void {
    const entry = this.brokers.get(brokerId);
    if (entry) {
      entry.statusCallbacks.add(callback);
    }
  }

  /** Remove status change listener */
  removeStatusChange(brokerId: string, callback: StatusChangeCallback): void {
    const entry = this.brokers.get(brokerId);
    if (entry) {
      entry.statusCallbacks.delete(callback);
    }
  }

  /** Get current max connection limit */
  getMaxConnections(): number {
    return this.config.maxConcurrentConnections;
  }

  // ═══ R119: Adapter Factory Bulk Registration ══════════
  
  /**
   * Register all known adapter factories for production use.
   * Uses lazy require() to avoid circular deps at module load time.
   */
  registerAllFactories(): void {
    // Crypto (P0) — CryptoAdapterBase subclasses
    this.adapterFactory.set('binance', (cfg) => {
      const { BinanceAdapter } = require('./adapters/CryptoAdapterBase');
      return new BinanceAdapter(cfg);
    });
    this.adapterFactory.set('okx', (cfg) => {
      const { OKXAdapter } = require('./adapters/CryptoAdapterBase');
      return new OKXAdapter(cfg);
    });
    this.adapterFactory.set('bybit', (cfg) => {
      const { BybitAdapter } = require('./adapters/CryptoAdapterBase');
      return new BybitAdapter(cfg);
    });
    this.adapterFactory.set('bitget', (cfg) => {
      const { BitgetAdapter } = require('./adapters/CryptoAdapterBase');
      return new BitgetAdapter(cfg);
    });

    // HK/US (P0) — existing adapters
    this.adapterFactory.set('futu', (cfg) => {
      const { FutuOpenDAdapter } = require('./futu-opend');
      return new FutuOpenDAdapter(cfg);
    });
    this.adapterFactory.set('moomoo', (cfg) => {
      const { MoomooAdapter } = require('./moomoo-adapter');
      return new MoomooAdapter(cfg);
    });
    this.adapterFactory.set('ib', (cfg) => {
      const { IBAdapter } = require('./ib-adapter');
      return new IBAdapter(cfg);
    });
    this.adapterFactory.set('longbridge', (cfg) => {
      const { LongbridgeAdapter } = require('./longbridge-adapter');
      return new LongbridgeAdapter(cfg);
    });

    // OAuth & Bridge (P1)
    this.adapterFactory.set('tiger', (cfg) => {
      const { TigerAdapter } = require('./adapters/BridgeAdapterBase');
      return new TigerAdapter(cfg);
    });
    this.adapterFactory.set('schwab', (cfg) => {
      const { SchwabAdapter } = require('./adapters/SchwabAdapter');
      return new SchwabAdapter(cfg);
    });
    this.adapterFactory.set('etrade', (cfg) => {
      const { ETRADEAdapter } = require('./adapters/ETRADEAdapter');
      return new ETRADEAdapter(cfg);
    });
    this.adapterFactory.set('webull', (cfg) => {
      const { WebullAdapter } = require('./adapters/WebullAdapter');
      return new WebullAdapter(cfg);
    });
    this.adapterFactory.set('etoro', (cfg) => {
      const { eToroAdapter } = require('./adapters/eToroAdapter');
      return new eToroAdapter(cfg);
    });
    this.adapterFactory.set('robinhood', (cfg) => {
      const { RobinhoodAdapter } = require('./adapters/BridgeAdapterBase');
      return new RobinhoodAdapter(cfg);
    });

    // Bridge (P2)
    this.adapterFactory.set('vbkr', (cfg) => {
      const { VBKRAdapter } = require('./adapters/BridgeAdapterBase');
      return new VBKRAdapter(cfg);
    });
    this.adapterFactory.set('usmart', (cfg) => {
      const { USmartAdapter } = require('./adapters/BridgeAdapterBase');
      return new USmartAdapter(cfg);
    });
    this.adapterFactory.set('mt5', (cfg) => {
      const { MT5Adapter } = require('./adapters/BridgeAdapterBase');
      return new MT5Adapter(cfg);
    });

    log.info(`[BrokerManagerV2] Registered ${this.adapterFactory.size} adapter factories`);
  }

  // Cleanup
  destroy(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
    this.disconnectAll();
  }
}

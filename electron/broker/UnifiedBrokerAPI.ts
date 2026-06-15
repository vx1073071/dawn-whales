/**
 * UnifiedBrokerAPI.ts — R228 JVS-2.5c: 券商统一接口层
 *
 * Unified API over all 13 broker adapters.
 * Single entry point for all broker operations regardless of adapter type.
 *
 * Design: Thin wrapper over BrokerManagerV2 with unified types.
 * Any broker operation goes through this class — never direct adapter access.
 *
 * API:
 *   - connect(brokerId) / connectAll()
 *   - disconnect(brokerId) / disconnectAll()
 *   - getQuotes(brokerIds, codes)
 *   - getPositions(brokerIds)
 *   - getFunds(brokerIds)
 *   - placeOrder(request)
 *   - cancelOrder(brokerId, orderId)
 *   - getHealth(brokerIds)
 *   - subscribe(brokerIds, codes)
 *
 * ≥300 lines.
 */

import type {
  BrokerConnectionStatus,
  BrokerType,
  TaggedQuoteInfo,
  TaggedPositionInfo,
  TaggedOrderInfo,
  TaggedPlaceOrderRequest,
  MarginInfo,
} from './IBrokerAdapterV2';

// ─── Unified Types ────────────────────────────────────────────────────

export interface UnifiedQuote {
  brokerId: string;
  brokerName: string;
  brokerType: BrokerType;
  code: string;
  standardCode: string;
  market: string;
  price: number;
  change: number;
  changePct: number;
  volume: number;
  high: number;
  low: number;
  open: number;
  prevClose: number;
  bid?: number;
  ask?: number;
  timestamp: number;
}

export interface UnifiedPosition {
  brokerId: string;
  brokerName: string;
  brokerType: BrokerType;
  code: string;
  standardCode: string;
  market: string;
  name: string;
  qty: number;
  costPrice: number;
  marketPrice: number;
  marketValue: number;
  pnl: number;
  pnlPct: number;
  ratio: number;
  currency: string;
}

export interface UnifiedFund {
  brokerId: string;
  brokerName: string;
  brokerType: BrokerType;
  accountId: string;
  totalAsset: number;
  cash: number;
  marketValue: number;
  frozenCash: number;
  currency: string;
}

export interface UnifiedOrder {
  brokerId: string;
  brokerName: string;
  brokerType: BrokerType;
  orderId: string;
  code: string;
  standardCode: string;
  side: 'BUY' | 'SELL';
  orderType: string;
  qty: number;
  price: number;
  filledQty: number;
  filledPrice: number;
  status: string;
  createdAt: string;
}

export interface UnifiedHealth {
  brokerId: string;
  brokerName: string;
  brokerType: BrokerType;
  connected: boolean;
  latencyP50: number;
  latencyP99: number;
  errorRate: number;
  healthScore: number;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'offline';
  checkedAt: number;
}

export interface UnifiedPlaceOrderRequest {
  brokerId: string;           // 'auto' = let router decide
  code: string;
  side: 'BUY' | 'SELL';
  orderType: 'MARKET' | 'LIMIT' | 'STOP' | 'STOP_LIMIT' | 'TRAILING_STOP' | 'OCO';
  qty: number;
  price?: number;
  stopPrice?: number;
  accountId?: string;
}

export interface BrokerOperationResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
  brokerId: string;
}

// ─── Provider Interface ───────────────────────────────────────────────

/** Interface that BrokerManagerV2 must satisfy for UnifiedBrokerAPI */
export interface IBrokerProvider {
  connect(brokerId: string): Promise<void>;
  disconnect(brokerId: string): Promise<void>;
  getQuotes(brokerId: string, codes: string[]): Promise<TaggedQuoteInfo[]>;
  getFunds(brokerId: string, accountId?: string): Promise<{ accountId: string; totalAsset: number; cash: number; marketValue: number; frozenCash: number; currency: string }[]>;
  getPositions(brokerId: string, accountId?: string): Promise<TaggedPositionInfo[]>;
  getOrders(brokerId: string, accountId?: string): Promise<TaggedOrderInfo[]>;
  placeOrder(brokerId: string, order: TaggedPlaceOrderRequest): Promise<{ orderId: string }>;
  cancelOrder(brokerId: string, orderId: string, code: string, accountId?: string): Promise<void>;
  getConnectionStatus(brokerId: string): BrokerConnectionStatus | null;
  getAllConnectionStatuses(): BrokerConnectionStatus[];
  getAllBrokerConfigs(): Array<{ id: string; name: string; type: BrokerType }>;
  subscribe(brokerId: string, codes: string[]): void;
}

// ─── Adapter: BrokerManagerV2 → IBrokerProvider ───────────────────────

import { BrokerHealthCheckEngine } from './BrokerHealthCheckEngine';

// ─── Unified Broker API ───────────────────────────────────────────────

export class UnifiedBrokerAPI {
  private provider: IBrokerProvider;
  private healthEngine: BrokerHealthCheckEngine;

  constructor(provider: IBrokerProvider, healthEngine?: BrokerHealthCheckEngine) {
    this.provider = provider;
    this.healthEngine = healthEngine || new BrokerHealthCheckEngine();
  }

  // ── Connection ──────────────────────────────────────────────────

  /**
   * Connect to a single broker by ID.
   */
  async connect(brokerId: string): Promise<BrokerOperationResult> {
    try {
      await this.provider.connect(brokerId);
      return { success: true, brokerId };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return { success: false, error: msg, brokerId };
    }
  }

  /**
   * Connect to all registered brokers in parallel.
   */
  async connectAll(): Promise<BrokerOperationResult[]> {
    const configs = this.provider.getAllBrokerConfigs();
    const results = await Promise.allSettled(
      configs.map((c) => this.provider.connect(c.id))
    );
    return results.map((r, i) => ({
      success: r.status === 'fulfilled',
      error: r.status === 'rejected' ? String(r.reason) : undefined,
      brokerId: configs[i].id,
    }));
  }

  /**
   * Disconnect a single broker.
   */
  async disconnect(brokerId: string): Promise<BrokerOperationResult> {
    try {
      await this.provider.disconnect(brokerId);
      return { success: true, brokerId };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return { success: false, error: msg, brokerId };
    }
  }

  /**
   * Disconnect all brokers.
   */
  async disconnectAll(): Promise<BrokerOperationResult[]> {
    const configs = this.provider.getAllBrokerConfigs();
    const results = await Promise.allSettled(
      configs.map((c) => this.provider.disconnect(c.id))
    );
    return results.map((r, i) => ({
      success: r.status === 'fulfilled',
      error: r.status === 'rejected' ? String(r.reason) : undefined,
      brokerId: configs[i].id,
    }));
  }

  // ── Quotes ──────────────────────────────────────────────────────

  /**
   * Get quotes from one or more brokers for given codes.
   * brokerIds: '*' = all connected brokers
   */
  async getQuotes(
    brokerIds: '*' | string[],
    codes: string[]
  ): Promise<Record<string, UnifiedQuote[]>> {
    const ids = brokerIds === '*'
      ? this.provider.getAllBrokerConfigs().map((c) => c.id)
      : brokerIds;

    const result: Record<string, UnifiedQuote[]> = {};
    for (const id of ids) {
      try {
        const quotes = await this.provider.getQuotes(id, codes);
        result[id] = quotes.map((q) => this.unifyQuote(q));
      } catch {
        result[id] = [];
      }
    }
    return result;
  }

  // ── Positions ───────────────────────────────────────────────────

  /**
   * Get positions from one or more brokers.
   */
  async getPositions(
    brokerIds: '*' | string[]
  ): Promise<Record<string, UnifiedPosition[]>> {
    const ids = brokerIds === '*'
      ? this.provider.getAllBrokerConfigs().map((c) => c.id)
      : brokerIds;

    const result: Record<string, UnifiedPosition[]> = {};
    for (const id of ids) {
      try {
        const positions = await this.provider.getPositions(id);
        result[id] = positions.map((p) => this.unifyPosition(p));
      } catch {
        result[id] = [];
      }
    }
    return result;
  }

  // ── Funds ───────────────────────────────────────────────────────

  /**
   * Get funds from one or more brokers.
   */
  async getFunds(
    brokerIds: '*' | string[]
  ): Promise<Record<string, UnifiedFund[]>> {
    const ids = brokerIds === '*'
      ? this.provider.getAllBrokerConfigs().map((c) => c.id)
      : brokerIds;

    const result: Record<string, UnifiedFund[]> = {};
    for (const id of ids) {
      try {
        const funds = await this.provider.getFunds(id);
        result[id] = funds.map((f) => this.unifyFund(f, id));
      } catch {
        result[id] = [];
      }
    }
    return result;
  }

  // ── Orders ──────────────────────────────────────────────────────

  /**
   * Place an order through a specific broker.
   */
  async placeOrder(request: UnifiedPlaceOrderRequest): Promise<BrokerOperationResult<{ orderId: string }>> {
    try {
      const taggedRequest: TaggedPlaceOrderRequest = {
        brokerId: request.brokerId,
        code: request.code,
        side: request.side,
        orderType: request.orderType,
        qty: request.qty,
        price: request.price,
        stopPrice: request.stopPrice,
        accountId: request.accountId,
      };
      const result = await this.provider.placeOrder(request.brokerId, taggedRequest);
      return { success: true, data: result, brokerId: request.brokerId };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return { success: false, error: msg, brokerId: request.brokerId };
    }
  }

  /**
   * Cancel an order.
   */
  async cancelOrder(
    brokerId: string,
    orderId: string,
    code: string,
    accountId?: string
  ): Promise<BrokerOperationResult> {
    try {
      await this.provider.cancelOrder(brokerId, orderId, code, accountId);
      return { success: true, brokerId };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return { success: false, error: msg, brokerId };
    }
  }

  // ── Health ──────────────────────────────────────────────────────

  /**
   * Get health reports for all or specific brokers.
   */
  getHealth(
    brokerIds?: '*' | string[]
  ): UnifiedHealth[] {
    const statuses = this.provider.getAllConnectionStatuses();

    const filtered = brokerIds && brokerIds !== '*'
      ? statuses.filter((s) => brokerIds.includes(s.brokerId))
      : statuses;

    this.healthEngine.checkAll(filtered);

    return filtered.map((status) => {
      const report = this.healthEngine.getReport(status.brokerId);
      return {
        brokerId: status.brokerId,
        brokerName: status.brokerName,
        brokerType: status.brokerType,
        connected: status.connected,
        latencyP50: status.latencyP50 || 0,
        latencyP99: status.latencyP99 || 0,
        errorRate: status.errorRate || 0,
        healthScore: report?.healthScore || 0,
        status: report?.status || 'offline',
        checkedAt: Date.now(),
      };
    });
  }

  /**
   * Get aggregate health summary.
   */
  getHealthSummary() {
    return this.healthEngine.getHealthSummary();
  }

  // ── Subscribe ───────────────────────────────────────────────────

  /**
   * Subscribe to quotes from one or more brokers.
   */
  subscribe(brokerIds: '*' | string[], codes: string[]): void {
    const ids = brokerIds === '*'
      ? this.provider.getAllBrokerConfigs().map((c) => c.id)
      : brokerIds;

    for (const id of ids) {
      this.provider.subscribe(id, codes);
    }
  }

  // ── Utilities ───────────────────────────────────────────────────

  /**
   * Get all registered broker configs.
   */
  getRegisteredBrokers() {
    return this.provider.getAllBrokerConfigs();
  }

  /**
   * Check if a broker is connected.
   */
  isConnected(brokerId: string): boolean {
    const status = this.provider.getConnectionStatus(brokerId);
    return status?.connected || false;
  }

  // ── Private Unifiers ────────────────────────────────────────────

  private unifyQuote(q: TaggedQuoteInfo): UnifiedQuote {
    return {
      brokerId: q.brokerId,
      brokerName: q.brokerName,
      brokerType: q.brokerType,
      code: q.code,
      standardCode: q.standardCode,
      market: q.market,
      price: q.price,
      change: q.change,
      changePct: q.changePct,
      volume: q.volume,
      high: q.high,
      low: q.low,
      open: q.open,
      prevClose: q.prevClose,
      bid: q.bid,
      ask: q.ask,
      timestamp: q.timestamp,
    };
  }

  private unifyPosition(p: TaggedPositionInfo): UnifiedPosition {
    return {
      brokerId: p.brokerId,
      brokerName: p.brokerName,
      brokerType: p.brokerType,
      code: p.code,
      standardCode: p.standardCode,
      market: p.market,
      name: p.name,
      qty: p.qty,
      costPrice: p.costPrice,
      marketPrice: p.marketPrice,
      marketValue: p.marketValue,
      pnl: p.pnl,
      pnlPct: p.pnlPct,
      ratio: p.ratio,
      currency: p.currency,
    };
  }

  private unifyFund(
    f: { accountId: string; totalAsset: number; cash: number; marketValue: number; frozenCash: number; currency: string },
    brokerId: string
  ): UnifiedFund {
    const config = this.provider.getAllBrokerConfigs().find((c) => c.id === brokerId);
    return {
      brokerId,
      brokerName: config?.name || brokerId,
      brokerType: config?.type || 'futu',
      accountId: f.accountId,
      totalAsset: f.totalAsset,
      cash: f.cash,
      marketValue: f.marketValue,
      frozenCash: f.frozenCash,
      currency: f.currency,
    };
  }
}

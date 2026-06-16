// ── QUANT MOO — Unified Account Manager (Cross-Broker) ─────────────────────
// J-28-02: Manages multiple broker connections simultaneously.
// Aggregates accounts, positions, funds, and P&L across Futu, Moomoo, and IB.
// All currency values are normalized to USD using hardcoded FX rates.

import log from 'electron-log';
import type { BrokerManager } from './BrokerManager';
import type {
  IBrokerAdapter,
  AccountInfo,
  FundsInfo,
  PositionInfo,
  PlaceOrderRequest,
} from './IBrokerAdapter';
import { EngineError, ErrorDomain, ErrorCode } from '../engine/core/engine-error';

// ── FX Rates (Hardcoded, to USD) ─────────────────────────────────────────────

const FX_RATES_TO_USD: Record<string, number> = {
  USD: 1.0,
  HKD: 0.1282,     // ~7.80 HKD/USD
  CNY: 0.1380,     // ~7.25 CNY/USD
  CNH: 0.1380,
  JPY: 0.00667,    // ~150 JPY/USD
  GBP: 1.2600,
  EUR: 1.0800,
  AUD: 0.6500,
  SGD: 0.7400,
  KRW: 0.000735,
  TWD: 0.0310,
  CAD: 0.7350,
  NZD: 0.6100,
  INR: 0.0120,
  THB: 0.0280,
};

// ── Interfaces ───────────────────────────────────────────────────────────────

export interface ConnectionResult {
  brokerId: string;
  brokerName: string;
  brokerType: string;
  success: boolean;
  error?: string;
  durationMs: number;
}

export interface AggregatedAccountData {
  brokerId: string;
  brokerName: string;
  brokerType: string;
  accountId: string;
  currency: string;
  totalAssetsUSD: number;
  cashUSD: number;
  marketValueUSD: number;
  connected: boolean;
}

export interface AggregatedPosition {
  code: string;
  name: string;
  totalQty: number;
  avgCost: number;
  marketPrice: number;
  totalValue: number;
  totalPnl: number;
  pnlPct: number;
  brokers: { brokerId: string; qty: number; cost: number; pnl: number }[];
}

export interface AggregatedFunds {
  totalAssetsUSD: number;
  totalCashUSD: number;
  totalMarketValueUSD: number;
  dailyPnlUSD: number;
  brokerCount: number;
  connectedBrokers: number;
}

export interface DailyPnL {
  totalUSD: number;
  byBroker: { brokerId: string; pnl: number; currency: string }[];
}

export interface BrokerStatusReport {
  id: string;
  name: string;
  type: string;
  connected: boolean;
  accountCount: number;
  lastUpdated: string;
}

export interface UnifiedReport {
  timestamp: string;
  funds: AggregatedFunds;
  positions: AggregatedPosition[];
  brokerStatus: BrokerStatusReport[];
  dailyPnl: DailyPnL;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function safeNum(val: unknown, fallback = 0): number {
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (typeof val === 'string') {
    const n = Number(val);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ── Per-Broker Cache Entry ───────────────────────────────────────────────────

interface BrokerCacheEntry {
  accounts: AggregatedAccountData[];
  positions: PositionInfo[];
  funds: AggregatedFunds;
  dailyPnl: number;
  lastUpdated: string;
  accountCount: number;
}

// ── UnifiedAccountManager ────────────────────────────────────────────────────

/**
 * UnifiedAccountManager orchestrates multiple broker connections, providing
 * a single aggregated view of all accounts, positions, funds, and P&L.
 *
 * Features:
 * - Parallel connect/disconnect across Futu, Moomoo, and IB
 * - Currency normalization to USD via hardcoded FX rates
 * - Position merging by stock code across brokers
 * - Order routing to preferred or best-available broker
 * - Per-broker error isolation (one broker failure does not affect others)
 * - Lightweight caching with configurable TTL
 * - Comprehensive reporting via getReport()
 */
export class UnifiedAccountManager {
  private brokerManager: BrokerManager;

  /** Per-broker cached data to reduce redundant API calls */
  private cache: Map<string, BrokerCacheEntry> = new Map();

  /** Cache TTL in milliseconds (default 30s) */
  private cacheTtlMs = 30_000;

  /** Track connection timestamps for status reporting */
  private connectionTimestamps: Map<string, string> = new Map();

  /** Track brokers that are currently connecting (prevent double-connect) */
  private connectingBrokers: Set<string> = new Set();

  /** Auto-reconnect configuration per broker */
  private autoReconnectMap: Map<string, boolean> = new Map();

  /** Reconnect retry counts */
  private reconnectRetries: Map<string, number> = new Map();

  /** Maximum reconnect attempts before giving up */
  private maxReconnectAttempts = 3;

  /** Reconnect delay in milliseconds */
  private reconnectDelayMs = 5_000;

  // ── Constructor ──────────────────────────────────────────────────────────

  constructor(brokerManager: BrokerManager) {
    this.brokerManager = brokerManager;
    log.info('[UnifiedAccountManager] Initialized');
  }

  // ── Currency Conversion ──────────────────────────────────────────────────

  /**
   * Convert an amount from a given currency to USD.
   * Uses hardcoded FX rates. Returns the original amount with a warning
   * if the currency is not recognized.
   */
  convertToUSD(amount: number, fromCurrency: string): number {
    const currency = (fromCurrency || 'USD').toUpperCase();
    const rate = FX_RATES_TO_USD[currency];
    if (rate === undefined) {
      log.warn(`[UAM] Unknown currency "${fromCurrency}", treating as 1:1 USD`);
      return amount;
    }
    return amount * rate;
  }

  /**
   * Get the FX rate for a currency pair (from → USD).
   * Returns undefined if the currency is not in the rate table.
   */
  getFxRate(fromCurrency: string): number | undefined {
    return FX_RATES_TO_USD[(fromCurrency || 'USD').toUpperCase()];
  }

  // ── Cache Management ─────────────────────────────────────────────────────

  /**
   * Check if a cache entry is still valid (not expired).
   */
  private isCacheValid(brokerId: string): boolean {
    const entry = this.cache.get(brokerId);
    if (!entry) return false;
    const entryTime = new Date(entry.lastUpdated).getTime();
    return (Date.now() - entryTime) < this.cacheTtlMs;
  }

  /**
   * Invalidate cache for a specific broker or all brokers.
   */
  invalidateCache(brokerId?: string): void {
    if (brokerId) {
      this.cache.delete(brokerId);
      log.debug(`[UAM] Cache invalidated for broker: ${brokerId}`);
    } else {
      this.cache.clear();
      log.debug('[UAM] All cache invalidated');
    }
  }

  /**
   * Set the cache TTL in milliseconds.
   */
  setCacheTtl(ms: number): void {
    this.cacheTtlMs = Math.max(0, ms);
    log.info(`[UAM] Cache TTL set to ${this.cacheTtlMs}ms`);
  }

  // ── Connection Management ────────────────────────────────────────────────

  /**
   * Connect all enabled brokers in parallel.
   * Each broker connection is independent — if one fails, others continue.
   * Returns a ConnectionResult per broker indicating success/failure.
   */
  async connectAll(): Promise<ConnectionResult[]> {
    const statusList = this.brokerManager.getStatus();
    const enabledConfigs = statusList;

    if (enabledConfigs.length === 0) {
      log.warn('[UAM] No broker configs found. Nothing to connect.');
      return [];
    }

    log.info(`[UAM] Connecting ${enabledConfigs.length} broker(s)...`);

    const promises = enabledConfigs.map((cfg) => this.connectSingleBroker(cfg.id));
    const results = await Promise.allSettled(promises);

    const connectionResults: ConnectionResult[] = results.map((result, idx) => {
      const brokerId = enabledConfigs[idx].id;
      const brokerName = enabledConfigs[idx].name;
      const brokerType = enabledConfigs[idx].type;

      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          brokerId,
          brokerName,
          brokerType,
          success: false,
          error: String(result.reason),
          durationMs: 0,
        };
      }
    });

    const succeeded = connectionResults.filter((r) => r.success).length;
    const failed = connectionResults.filter((r) => !r.success).length;
    log.info(`[UAM] Connection complete: ${succeeded} succeeded, ${failed} failed`);

    return connectionResults;
  }

  /**
   * Connect a single broker by ID, with timing and error capture.
   */
  private async connectSingleBroker(brokerId: string): Promise<ConnectionResult> {
    const startTime = Date.now();

    // Prevent double-connect
    if (this.connectingBrokers.has(brokerId)) {
      log.warn(`[UAM] Broker "${brokerId}" is already connecting, skipping duplicate request.`);
      return {
        brokerId,
        brokerName: brokerId,
        brokerType: 'unknown',
        success: false,
        error: 'Connection already in progress',
        durationMs: 0,
      };
    }

    this.connectingBrokers.add(brokerId);

    try {
      // Check if already connected
      const existingAdapter = this.brokerManager.getBroker(brokerId);
      if (existingAdapter?.connected) {
        log.info(`[UAM] Broker "${brokerId}" already connected.`);
        this.connectionTimestamps.set(brokerId, new Date().toISOString());
        this.registerDisconnectHandler(brokerId);

        const status = this.brokerManager.getStatus().find((s) => s.id === brokerId);
        return {
          brokerId,
          brokerName: status?.name ?? brokerId,
          brokerType: status?.type ?? 'unknown',
          success: true,
          durationMs: Date.now() - startTime,
        };
      }

      await this.brokerManager.connect(brokerId);
      this.connectionTimestamps.set(brokerId, new Date().toISOString());
      this.reconnectRetries.delete(brokerId);
      this.registerDisconnectHandler(brokerId);

      const status = this.brokerManager.getStatus().find((s) => s.id === brokerId);
      log.info(`[UAM] Broker "${brokerId}" connected in ${Date.now() - startTime}ms`);

      return {
        brokerId,
        brokerName: status?.name ?? brokerId,
        brokerType: status?.type ?? 'unknown',
        success: true,
        durationMs: Date.now() - startTime,
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      log.error(`[UAM] Failed to connect broker "${brokerId}": ${errorMsg}`);

      const status = this.brokerManager.getStatus().find((s) => s.id === brokerId);
      return {
        brokerId,
        brokerName: status?.name ?? brokerId,
        brokerType: status?.type ?? 'unknown',
        success: false,
        error: errorMsg,
        durationMs: Date.now() - startTime,
      };
    } finally {
      this.connectingBrokers.delete(brokerId);
    }
  }

  /**
   * Register an auto-reconnect handler for a broker.
   * When the broker disconnects unexpectedly, it will attempt to reconnect.
   */
  private registerDisconnectHandler(brokerId: string): void {
    const adapter = this.brokerManager.getBroker(brokerId);
    if (!adapter) return;

    adapter.onDisconnect(() => {
      log.warn(`[UAM] Broker "${brokerId}" disconnected unexpectedly.`);
      this.cache.delete(brokerId);
      this.connectionTimestamps.delete(brokerId);

      const autoReconnect = this.autoReconnectMap.get(brokerId) ?? true;
      if (autoReconnect) {
        this.attemptReconnect(brokerId);
      }
    });
  }

  /**
   * Attempt to reconnect a broker with exponential backoff.
   * Retries up to maxReconnectAttempts times.
   */
  private async attemptReconnect(brokerId: string): Promise<void> {
    const retries = this.reconnectRetries.get(brokerId) ?? 0;

    if (retries >= this.maxReconnectAttempts) {
      log.error(`[UAM] Broker "${brokerId}" exceeded max reconnect attempts (${this.maxReconnectAttempts}). Giving up.`);
      return;
    }

    this.reconnectRetries.set(brokerId, retries + 1);
    const delay = this.reconnectDelayMs * Math.pow(2, retries);

    log.info(`[UAM] Reconnecting broker "${brokerId}" in ${delay}ms (attempt ${retries + 1}/${this.maxReconnectAttempts})...`);

    setTimeout(async () => {
      try {
        await this.connectSingleBroker(brokerId);
        log.info(`[UAM] Broker "${brokerId}" reconnected successfully.`);
      } catch (err) {
        log.error(`[UAM] Reconnect failed for "${brokerId}": ${err}`);
        this.attemptReconnect(brokerId);
      }
    }, delay);
  }

  /**
   * Enable or disable auto-reconnect for a specific broker.
   */
  setAutoReconnect(brokerId: string, enabled: boolean): void {
    this.autoReconnectMap.set(brokerId, enabled);
    log.info(`[UAM] Auto-reconnect for "${brokerId}": ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Disconnect all brokers and clear all state.
   */
  disconnectAll(): void {
    const statusList = this.brokerManager.getStatus();

    for (const status of statusList) {
      try {
        this.brokerManager.disconnect(status.id);
        log.info(`[UAM] Disconnected broker: ${status.id}`);
      } catch (err) {
        log.error(`[UAM] Error disconnecting broker "${status.id}": ${err}`);
      }
    }

    this.cache.clear();
    this.connectionTimestamps.clear();
    this.connectingBrokers.clear();
    this.reconnectRetries.clear();

    log.info('[UAM] All brokers disconnected. State cleared.');
  }

  /**
   * Disconnect a single broker.
   */
  disconnectBroker(brokerId: string): void {
    try {
      this.brokerManager.disconnect(brokerId);
      this.cache.delete(brokerId);
      this.connectionTimestamps.delete(brokerId);
      this.autoReconnectMap.set(brokerId, false);
      log.info(`[UAM] Disconnected broker: ${brokerId}`);
    } catch (err) {
      log.error(`[UAM] Error disconnecting broker "${brokerId}": ${err}`);
    }
  }

  // ── Account Aggregation ──────────────────────────────────────────────────

  /**
   * Get all accounts across all connected brokers, with USD-normalized values.
   * Each account includes broker metadata and connection status.
   */
  async getAggregatedAccounts(): Promise<AggregatedAccountData[]> {
    const connectedBrokers = this.getConnectedBrokers();
    const allAccounts: AggregatedAccountData[] = [];

    for (const broker of connectedBrokers) {
      try {
        // Use cache if valid
        if (this.isCacheValid(broker.id) && this.cache.get(broker.id)!.accounts.length > 0) {
          allAccounts.push(...this.cache.get(broker.id)!.accounts);
          continue;
        }

        const accounts: AccountInfo[] = await broker.adapter.getAccounts();

        for (const acct of accounts) {
          let funds: FundsInfo | undefined;
          try {
            funds = await broker.adapter.getFunds(acct.accountId);
          } catch (fundsErr) {
            log.warn(`[UAM] Failed to fetch funds for account ${acct.accountId} on ${broker.id}: ${fundsErr}`);
          }

          const currency = acct.currency || funds?.currency || 'USD';
          const totalAssets = safeNum(funds?.totalAssets ?? acct.totalAssets);
          const cash = safeNum(funds?.cash ?? acct.cash);
          const marketValue = safeNum(funds?.marketValue ?? acct.marketValue);

          allAccounts.push({
            brokerId: broker.id,
            brokerName: broker.name,
            brokerType: broker.adapter.type,
            accountId: acct.accountId,
            currency,
            totalAssetsUSD: round2(this.convertToUSD(totalAssets, currency)),
            cashUSD: round2(this.convertToUSD(cash, currency)),
            marketValueUSD: round2(this.convertToUSD(marketValue, currency)),
            connected: broker.adapter.connected,
          });
        }
      } catch (err) {
        log.error(`[UAM] Error fetching accounts from "${broker.id}": ${err}`);
      }
    }

    // Update cache
    this.updateAccountCache(allAccounts);

    log.info(`[UAM] Retrieved ${allAccounts.length} accounts from ${connectedBrokers.length} broker(s)`);
    return allAccounts;
  }

  /**
   * Update the account cache for each broker.
   */
  private updateAccountCache(accounts: AggregatedAccountData[]): void {
    // Group accounts by brokerId
    const byBroker = new Map<string, AggregatedAccountData[]>();
    for (const acct of accounts) {
      const list = byBroker.get(acct.brokerId) ?? [];
      list.push(acct);
      byBroker.set(acct.brokerId, list);
    }

    for (const [brokerId, brokerAccounts] of byBroker.entries()) {
      const existing = this.cache.get(brokerId);
      if (existing) {
        existing.accounts = brokerAccounts;
        existing.lastUpdated = new Date().toISOString();
        existing.accountCount = brokerAccounts.length;
      } else {
        this.cache.set(brokerId, {
          accounts: brokerAccounts,
          positions: [],
          funds: {
            totalAssetsUSD: 0,
            totalCashUSD: 0,
            totalMarketValueUSD: 0,
            dailyPnlUSD: 0,
            brokerCount: 1,
            connectedBrokers: 1,
          },
          dailyPnl: 0,
          lastUpdated: new Date().toISOString(),
          accountCount: brokerAccounts.length,
        });
      }
    }
  }

  // ── Position Aggregation ─────────────────────────────────────────────────

  /**
   * Aggregate positions across all connected brokers.
   * Positions with the same stock code are merged:
   *  - totalQty: sum of quantities
   *  - avgCost: weighted average cost
   *  - marketPrice: from the broker with the largest position
   *  - totalPnl, pnlPct: computed from merged data
   *  - brokers: per-broker breakdown with individual P&L
   */
  async getAggregatedPositions(): Promise<AggregatedPosition[]> {
    const connectedBrokers = this.getConnectedBrokers();

    interface PositionAccum {
      name: string;
      totalQty: number;
      totalCostBasis: number;
      marketPrice: number;
      maxQty: number;
      totalValue: number;
      brokers: { brokerId: string; qty: number; cost: number; pnl: number }[];
    }

    const positionMap = new Map<string, PositionAccum>();

    for (const broker of connectedBrokers) {
      try {
        const accounts: AccountInfo[] = await broker.adapter.getAccounts();

        for (const acct of accounts) {
          let positions: PositionInfo[];
          try {
            positions = await broker.adapter.getPositions(acct.accountId);
          } catch (posErr) {
            log.warn(`[UAM] Failed to fetch positions for account ${acct.accountId} on ${broker.id}: ${posErr}`);
            continue;
          }

          for (const pos of positions) {
            const code = pos.code;
            const qty = safeNum(pos.qty);
            const costPrice = safeNum(pos.costPrice);
            const marketPrice = safeNum(pos.marketPrice);
            const marketValue = safeNum(pos.marketValue);
            const pnl = safeNum(pos.pnl);

            if (qty <= 0) continue;

            const costBasis = qty * costPrice;
            const existing = positionMap.get(code);

            if (existing) {
              existing.totalQty += qty;
              existing.totalCostBasis += costBasis;
              existing.totalValue += marketValue;

              if (qty > existing.maxQty) {
                existing.marketPrice = marketPrice;
                existing.maxQty = qty;
              }

              existing.brokers.push({
                brokerId: broker.id,
                qty,
                cost: costPrice,
                pnl,
              });
            } else {
              positionMap.set(code, {
                name: pos.name || code,
                totalQty: qty,
                totalCostBasis: costBasis,
                marketPrice,
                maxQty: qty,
                totalValue: marketValue,
                brokers: [{ brokerId: broker.id, qty, cost: costPrice, pnl }],
              });
            }
          }
        }
      } catch (err) {
        log.error(`[UAM] Error fetching positions from "${broker.id}": ${err}`);
      }
    }

    // Build results
    const results: AggregatedPosition[] = [];

    for (const [code, data] of positionMap.entries()) {
      const avgCost = data.totalQty > 0
        ? data.totalCostBasis / data.totalQty
        : 0;

      const totalCost = data.totalCostBasis;
      const totalPnl = data.totalValue - totalCost;
      const pnlPct = totalCost > 0
        ? (totalPnl / totalCost) * 100
        : 0;

      results.push({
        code,
        name: data.name,
        totalQty: data.totalQty,
        avgCost: round2(avgCost),
        marketPrice: data.marketPrice,
        totalValue: round2(data.totalValue),
        totalPnl: round2(totalPnl),
        pnlPct: round2(pnlPct),
        brokers: data.brokers,
      });
    }

    // Sort by absolute total value descending
    results.sort((a, b) => Math.abs(b.totalValue) - Math.abs(a.totalValue));

    log.info(`[UAM] Aggregated ${results.length} unique positions from ${connectedBrokers.length} broker(s)`);
    return results;
  }

  // ── Funds Aggregation ────────────────────────────────────────────────────

  /**
   * Aggregate funds (total assets, cash, market value) across all brokers.
   * All values normalized to USD. Includes daily P&L and broker counts.
   */
  async getAggregatedFunds(): Promise<AggregatedFunds> {
    const accounts = await this.getAggregatedAccounts();
    const statusList = this.brokerManager.getStatus();
    const totalBrokerCount = statusList.length;
    const connectedBrokerCount = statusList.filter((s) => s.connected).length;

    let totalAssetsUSD = 0;
    let totalCashUSD = 0;
    let totalMarketValueUSD = 0;

    for (const acct of accounts) {
      totalAssetsUSD += acct.totalAssetsUSD;
      totalCashUSD += acct.cashUSD;
      totalMarketValueUSD += acct.marketValueUSD;
    }

    // Fetch daily P&L separately
    const dailyPnl = await this.getDailyPnL();

    const funds: AggregatedFunds = {
      totalAssetsUSD: round2(totalAssetsUSD),
      totalCashUSD: round2(totalCashUSD),
      totalMarketValueUSD: round2(totalMarketValueUSD),
      dailyPnlUSD: round2(dailyPnl.totalUSD),
      brokerCount: totalBrokerCount,
      connectedBrokers: connectedBrokerCount,
    };

    log.info(
      `[UAM] Funds summary: $${funds.totalAssetsUSD.toLocaleString()} total assets, ` +
      `$${funds.totalCashUSD.toLocaleString()} cash, ` +
      `${funds.connectedBrokers}/${funds.brokerCount} brokers connected`
    );

    return funds;
  }

  // ── Daily P&L ────────────────────────────────────────────────────────────

  /**
   * Compute daily P&L across all connected brokers.
   * Uses position unrealized P&L as a proxy for daily P&L when
   * intraday data is not directly available from the broker API.
   */
  async getDailyPnL(): Promise<DailyPnL> {
    const connectedBrokers = this.getConnectedBrokers();
    const byBroker: DailyPnL['byBroker'] = [];
    let totalUSD = 0;

    for (const broker of connectedBrokers) {
      try {
        const accounts: AccountInfo[] = await broker.adapter.getAccounts();
        let brokerPnl = 0;
        let brokerCurrency = 'USD';

        for (const acct of accounts) {
          let positions: PositionInfo[];
          try {
            positions = await broker.adapter.getPositions(acct.accountId);
          } catch {
            continue;
          }

          brokerCurrency = acct.currency || 'USD';

          for (const pos of positions) {
            brokerPnl += safeNum(pos.pnl);
          }
        }

        const pnlUSD = this.convertToUSD(brokerPnl, brokerCurrency);
        totalUSD += pnlUSD;

        byBroker.push({
          brokerId: broker.id,
          pnl: round2(brokerPnl),
          currency: brokerCurrency,
        });
      } catch (err) {
        log.error(`[UAM] Error computing daily P&L for "${broker.id}": ${err}`);
        byBroker.push({
          brokerId: broker.id,
          pnl: 0,
          currency: 'USD',
        });
      }
    }

    const result: DailyPnL = {
      totalUSD: round2(totalUSD),
      byBroker,
    };

    log.info(`[UAM] Daily P&L: $${result.totalUSD.toLocaleString()} across ${byBroker.length} broker(s)`);
    return result;
  }

  // ── Broker Status ────────────────────────────────────────────────────────

  /**
   * Get connection status for all configured brokers.
   * Includes account count and last updated timestamp per broker.
   */
  getBrokerStatus(): BrokerStatusReport[] {
    const statusList = this.brokerManager.getStatus();
    const reports: BrokerStatusReport[] = [];

    for (const status of statusList) {
      const cachedEntry = this.cache.get(status.id);
      const lastUpdated = this.connectionTimestamps.get(status.id)
        ?? cachedEntry?.lastUpdated
        ?? '';

      reports.push({
        id: status.id,
        name: status.name,
        type: status.type,
        connected: status.connected,
        accountCount: cachedEntry?.accountCount ?? 0,
        lastUpdated,
      });
    }

    return reports;
  }

  // ── Order Routing ────────────────────────────────────────────────────────

  /**
   * Route an order to the best available broker.
   *
   * Routing strategy:
   * 1. If preferredBrokerId is provided and that broker is connected, use it.
   * 2. Otherwise, select the broker with the best connectivity (first connected).
   * 3. For SELL orders, prefer brokers that hold the position.
   *
   * Returns the orderId and the brokerId that was used.
   */
  async routeOrder(
    order: PlaceOrderRequest,
    preferredBrokerId?: string,
  ): Promise<{ orderId: string; brokerId: string }> {
    log.info(`[UAM] Routing order: ${order.side} ${order.qty} x ${order.code} (${order.orderType})`);

    // 1. Try preferred broker
    if (preferredBrokerId) {
      const adapter = this.brokerManager.getBroker(preferredBrokerId);
      if (adapter?.connected) {
        try {
          const result = await adapter.placeOrder(order);
          log.info(`[UAM] Order routed to preferred broker "${preferredBrokerId}": orderId=${result.orderId}`);
          return { orderId: result.orderId, brokerId: preferredBrokerId };
        } catch (err) {
          log.warn(`[UAM] Preferred broker "${preferredBrokerId}" rejected order: ${err}. Trying fallback...`);
        }
      } else {
        log.warn(`[UAM] Preferred broker "${preferredBrokerId}" not available. Trying fallback...`);
      }
    }

    // 2. For SELL orders, find brokers that hold the position
    if (order.side === 'SELL') {
      const brokersWithPosition = await this.findBrokersWithPosition(order.code);
      for (const brokerEntry of brokersWithPosition) {
        try {
          const result = await brokerEntry.adapter.placeOrder(order);
          log.info(`[UAM] SELL order routed to "${brokerEntry.id}" (holds position): orderId=${result.orderId}`);
          return { orderId: result.orderId, brokerId: brokerEntry.id };
        } catch (err) {
          log.warn(`[UAM] Broker "${brokerEntry.id}" rejected SELL order: ${err}`);
        }
      }
    }

    // 3. Fallback: try any connected broker
    const connectedBrokers = this.getConnectedBrokers();
    for (const broker of connectedBrokers) {
      // Skip preferred (already tried) and position brokers (already tried for SELL)
      if (broker.id === preferredBrokerId) continue;

      try {
        const result = await broker.adapter.placeOrder(order);
        log.info(`[UAM] Order routed to fallback broker "${broker.id}": orderId=${result.orderId}`);
        return { orderId: result.orderId, brokerId: broker.id };
      } catch (err) {
        log.warn(`[UAM] Fallback broker "${broker.id}" rejected order: ${err}`);
      }
    }

    throw new EngineError(ErrorDomain.TRADE, ErrorCode.ORDER_REJECTED, `[UAM] No broker available to route order: ${order.side} ${order.qty} x ${order.code}`);
  }

  /**
   * Find connected brokers that hold a specific position.
   * Returns brokers sorted by quantity held (descending).
   */
  private async findBrokersWithPosition(
    code: string,
  ): Promise<{ id: string; adapter: IBrokerAdapter; qty: number }[]> {
    const connectedBrokers = this.getConnectedBrokers();
    const holders: { id: string; adapter: IBrokerAdapter; qty: number }[] = [];

    for (const broker of connectedBrokers) {
      try {
        const accounts = await broker.adapter.getAccounts();
        let totalQty = 0;

        for (const acct of accounts) {
          const positions = await broker.adapter.getPositions(acct.accountId);
          const pos = positions.find((p) => p.code === code);
          if (pos) {
            totalQty += safeNum(pos.qty);
          }
        }

        if (totalQty > 0) {
          holders.push({ id: broker.id, adapter: broker.adapter, qty: totalQty });
        }
      } catch {
        // Skip brokers we can't query
      }
    }

    // Sort by quantity descending
    holders.sort((a, b) => b.qty - a.qty);
    return holders;
  }

  // ── Comprehensive Report ─────────────────────────────────────────────────

  /**
   * Generate a comprehensive unified report containing:
   * - Aggregated funds summary
   * - All positions merged by code
   * - Broker status for all configured brokers
   * - Daily P&L breakdown
   *
   * This is the main entry point for the UI to display a full dashboard view.
   */
  async getReport(): Promise<UnifiedReport> {
    log.info('[UAM] Generating unified report...');
    const startTime = Date.now();

    // Fetch all data in parallel where possible
    const [funds, positions, dailyPnl] = await Promise.all([
      this.getAggregatedFunds(),
      this.getAggregatedPositions(),
      this.getDailyPnL(),
    ]);

    const brokerStatus = this.getBrokerStatus();

    const report: UnifiedReport = {
      timestamp: new Date().toISOString(),
      funds,
      positions,
      brokerStatus,
      dailyPnl,
    };

    const elapsed = Date.now() - startTime;
    log.info(
      `[UAM] Report generated in ${elapsed}ms: ` +
      `${funds.connectedBrokers}/${funds.brokerCount} brokers, ` +
      `${positions.length} positions, ` +
      `$${funds.totalAssetsUSD.toLocaleString()} total assets`
    );

    return report;
  }

  // ── Internal: Get Connected Brokers ──────────────────────────────────────

  /**
   * Retrieve connected broker adapters from BrokerManager.
   * Filters out brokers that are not currently connected.
   */
  private getConnectedBrokers(): { id: string; name: string; adapter: IBrokerAdapter }[] {
    const statusList = this.brokerManager.getStatus();
    const connected: { id: string; name: string; adapter: IBrokerAdapter }[] = [];

    for (const status of statusList) {
      if (!status.connected) continue;

      const adapter = this.brokerManager.getBroker(status.id);
      if (adapter) {
        connected.push({ id: status.id, name: status.name, adapter });
      } else {
        log.warn(`[UAM] Broker "${status.id}" shows connected but adapter not found.`);
      }
    }

    return connected;
  }

  // ── Utility: Broker-Specific Queries ─────────────────────────────────────

  /**
   * Get positions for a specific broker only.
   */
  async getBrokerPositions(brokerId: string): Promise<AggregatedPosition[]> {
    const adapter = this.brokerManager.getBroker(brokerId);
    if (!adapter?.connected) {
      log.warn(`[UAM] Broker "${brokerId}" not connected for position query.`);
      return [];
    }

    const positions: AggregatedPosition[] = [];

    try {
      const accounts = await adapter.getAccounts();

      interface PosAccum {
        name: string;
        totalQty: number;
        totalCostBasis: number;
        marketPrice: number;
        totalValue: number;
      }

      const posMap = new Map<string, PosAccum>();

      for (const acct of accounts) {
        const acctPositions = await adapter.getPositions(acct.accountId);

        for (const pos of acctPositions) {
          const code = pos.code;
          const qty = safeNum(pos.qty);
          const costPrice = safeNum(pos.costPrice);
          const marketValue = safeNum(pos.marketValue);

          if (qty <= 0) continue;

          const costBasis = qty * costPrice;
          const existing = posMap.get(code);

          if (existing) {
            existing.totalQty += qty;
            existing.totalCostBasis += costBasis;
            existing.totalValue += marketValue;
          } else {
            posMap.set(code, {
              name: pos.name || code,
              totalQty: qty,
              totalCostBasis: costBasis,
              marketPrice: safeNum(pos.marketPrice),
              totalValue: marketValue,
            });
          }
        }
      }

      for (const [code, data] of posMap.entries()) {
        const avgCost = data.totalQty > 0 ? data.totalCostBasis / data.totalQty : 0;
        const totalPnl = data.totalValue - data.totalCostBasis;
        const pnlPct = data.totalCostBasis > 0 ? (totalPnl / data.totalCostBasis) * 100 : 0;

        positions.push({
          code,
          name: data.name,
          totalQty: data.totalQty,
          avgCost: round2(avgCost),
          marketPrice: data.marketPrice,
          totalValue: round2(data.totalValue),
          totalPnl: round2(totalPnl),
          pnlPct: round2(pnlPct),
          brokers: [{ brokerId, qty: data.totalQty, cost: round2(avgCost), pnl: round2(totalPnl) }],
        });
      }

      positions.sort((a, b) => Math.abs(b.totalValue) - Math.abs(a.totalValue));
    } catch (err) {
      log.error(`[UAM] Error fetching positions for broker "${brokerId}": ${err}`);
    }

    return positions;
  }

  /**
   * Get funds summary for a specific broker only.
   */
  async getBrokerFunds(brokerId: string): Promise<AggregatedFunds | null> {
    const adapter = this.brokerManager.getBroker(brokerId);
    if (!adapter?.connected) {
      log.warn(`[UAM] Broker "${brokerId}" not connected for funds query.`);
      return null;
    }

    try {
      const accounts = await adapter.getAccounts();
      let totalAssetsUSD = 0;
      let totalCashUSD = 0;
      let totalMarketValueUSD = 0;

      for (const acct of accounts) {
        let funds: FundsInfo;
        try {
          funds = await adapter.getFunds(acct.accountId);
        } catch {
          continue;
        }

        const currency = funds.currency || acct.currency || 'USD';
        totalAssetsUSD += this.convertToUSD(safeNum(funds.totalAssets), currency);
        totalCashUSD += this.convertToUSD(safeNum(funds.cash), currency);
        totalMarketValueUSD += this.convertToUSD(safeNum(funds.marketValue), currency);
      }

      // Compute daily P&L for this broker
      let dailyPnlRaw = 0;
      let dailyPnlCurrency = 'USD';
      for (const acct of accounts) {
        try {
          const posList = await adapter.getPositions(acct.accountId);
          dailyPnlCurrency = acct.currency || 'USD';
          for (const pos of posList) {
            dailyPnlRaw += safeNum(pos.pnl);
          }
        } catch {
          // skip
        }
      }

      return {
        totalAssetsUSD: round2(totalAssetsUSD),
        totalCashUSD: round2(totalCashUSD),
        totalMarketValueUSD: round2(totalMarketValueUSD),
        dailyPnlUSD: round2(this.convertToUSD(dailyPnlRaw, dailyPnlCurrency)),
        brokerCount: 1,
        connectedBrokers: 1,
      };
    } catch (err) {
      log.error(`[UAM] Error fetching funds for broker "${brokerId}": ${err}`);
      return null;
    }
  }

  // ── Utility: Health Check ────────────────────────────────────────────────

  /**
   * Perform a health check across all configured brokers.
   * Returns a map of brokerId → health status.
   */
  async healthCheck(): Promise<Map<string, { healthy: boolean; latencyMs: number; error?: string }>> {
    const statusList = this.brokerManager.getStatus();
    const results = new Map<string, { healthy: boolean; latencyMs: number; error?: string }>();

    for (const status of statusList) {
      const startTime = Date.now();
      const adapter = this.brokerManager.getBroker(status.id);

      if (!adapter) {
        results.set(status.id, {
          healthy: false,
          latencyMs: Date.now() - startTime,
          error: 'Adapter not found',
        });
        continue;
      }

      if (!adapter.connected) {
        results.set(status.id, {
          healthy: false,
          latencyMs: Date.now() - startTime,
          error: 'Not connected',
        });
        continue;
      }

      try {
        // Simple health check: try to fetch accounts
        await adapter.getAccounts();
        results.set(status.id, {
          healthy: true,
          latencyMs: Date.now() - startTime,
        });
      } catch (err) {
        results.set(status.id, {
          healthy: false,
          latencyMs: Date.now() - startTime,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return results;
  }

  // ── Utility: Position Search ─────────────────────────────────────────────

  /**
   * Search for a specific position by code across all connected brokers.
   * Returns per-broker breakdown if found.
   */
  async findPosition(code: string): Promise<AggregatedPosition | null> {
    const positions = await this.getAggregatedPositions();
    return positions.find((p) => p.code === code) ?? null;
  }

  /**
   * Get total exposure (market value) for a specific stock code across all brokers.
   */
  async getExposure(code: string): Promise<{ totalValue: number; totalQty: number; brokers: string[] }> {
    const position = await this.findPosition(code);

    if (!position) {
      return { totalValue: 0, totalQty: 0, brokers: [] };
    }

    return {
      totalValue: position.totalValue,
      totalQty: position.totalQty,
      brokers: position.brokers.map((b) => b.brokerId),
    };
  }

  // ── Utility: Account Lookup ──────────────────────────────────────────────

  /**
   * Find an account by ID across all brokers.
   */
  async findAccount(accountId: string): Promise<AggregatedAccountData | null> {
    const accounts = await this.getAggregatedAccounts();
    return accounts.find((a) => a.accountId === accountId) ?? null;
  }

  /**
   * Get the broker ID that owns a given account.
   */
  async getBrokerForAccount(accountId: string): Promise<string | null> {
    const account = await this.findAccount(accountId);
    return account?.brokerId ?? null;
  }

  // ── Utility: Summary Stats ───────────────────────────────────────────────

  /**
   * Get a quick summary of the unified account state.
   * Lighter than getReport() — only returns key metrics.
   */
  async getQuickSummary(): Promise<{
    totalAssetsUSD: number;
    dailyPnlUSD: number;
    connectedBrokers: number;
    totalBrokers: number;
    positionCount: number;
  }> {
    const [funds, positions] = await Promise.all([
      this.getAggregatedFunds(),
      this.getAggregatedPositions(),
    ]);

    return {
      totalAssetsUSD: funds.totalAssetsUSD,
      dailyPnlUSD: funds.dailyPnlUSD,
      connectedBrokers: funds.connectedBrokers,
      totalBrokers: funds.brokerCount,
      positionCount: positions.length,
    };
  }
}

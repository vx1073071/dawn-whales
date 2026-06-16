/**
 * MarketDataPermissionEngine — R257 QUANT MOO 行情分层 Phase 1
 *
 * Live / Pro / Institutional 三级行情权限系统。
 *
 * 三层定价:
 *   Live (免费):   延时 15min, L1 bid/ask, 5自选
 *   Pro ($9.99/月): 实时, L2 10档, 无限自选, 异动推送, 基础筛选
 *   Institutional ($199/月): 全源实时, L2/L3, API 接入, 回测数据, 多账户
 *
 * Architecture:
 *   - Singleton with reset()
 *   - Permission matrix: source × level × field
 *   - Per-user quota tracker
 *   - Deferred billing integration hook
 *   - Mock data for tests
 *
 * @author JVS
 * @round R257
 * @since 2026-06-17
 */

import { EventEmitter } from 'events';

// ─── Types ───────────────────────────────────────────────

export type PermissionLevel = 'live' | 'pro' | 'institutional';

export type DataSourceId = 'yahoo_ws' | 'binance_ws' | 'futu' | 'ib_tws' | 'google_finance' | 'longbridge' | 'moomoo';

export type QuoteField = 'price' | 'bid' | 'ask' | 'volume' | 'high' | 'low' | 'open' | 'prevClose' |
  'depth_bid' | 'depth_ask' | 'depth_full' | 'tick_history' | 'backtest_data' | 'order_flow' |
  'change' | 'change_pct' | 'market_cap' | 'pe_ratio' | 'spread' | 'timestamp';

export type DeliveryMode = 'realtime' | 'delayed_5s' | 'delayed_15min' | 'end_of_day';

export interface PermissionMatrix {
  level: PermissionLevel;
  maxSources: number;
  maxWatchlist: number;
  maxAlerts: number;
  deliveryMode: DeliveryMode;
  allowedFields: QuoteField[];
  allowedSources: DataSourceId[];
  maxApiCallsPerDay: number;
  priceMonthlyUSDT: number;
  label: string;
  canScreen: boolean;
  canBacktest: boolean;
  canApi: boolean;
}

export interface UserSubscription {
  userId: string;
  level: PermissionLevel;
  subscribedAt: number;
  expiresAt: number | null; // null = lifetime or free
  autoRenew: boolean;
  paymentMethod: string;
}

export interface AccessCheckResult {
  allowed: boolean;
  reason?: string;
  requiredLevel: PermissionLevel;
  currentLevel: PermissionLevel;
  field: QuoteField;
  source: DataSourceId;
}

export interface QuotaState {
  userId: string;
  apiCallsToday: number;
  alertsToday: number;
  watchlistSize: number;
  sourcesActive: number;
  lastReset: number;
}

export interface PermissionConfig {
  livePriceUSDT?: number;       // default 0
  proPriceUSDT?: number;        // default 9.99
  institutionalPriceUSDT?: number; // default 199
  quotaResetHourUTC?: number;   // default 0
}

// ─── Permission Matrix Definition ────────────────────────

const LIVE_MATRIX: PermissionMatrix = {
  level: 'live',
  maxSources: 1,
  maxWatchlist: 5,
  maxAlerts: 3,
  deliveryMode: 'delayed_15min',
  allowedFields: ['price', 'bid', 'ask', 'volume', 'high', 'low', 'open', 'prevClose', 'change', 'change_pct'],
  allowedSources: ['yahoo_ws'],
  maxApiCallsPerDay: 100,
  priceMonthlyUSDT: 0,
  label: 'Live',
  canScreen: false,
  canBacktest: false,
  canApi: false,
};

const PRO_MATRIX: PermissionMatrix = {
  level: 'pro',
  maxSources: 3,
  maxWatchlist: 500,
  maxAlerts: 50,
  deliveryMode: 'realtime',
  allowedFields: ['price', 'bid', 'ask', 'volume', 'high', 'low', 'open', 'prevClose',
    'depth_bid', 'depth_ask', 'depth_full', 'tick_history',
    'change', 'change_pct', 'market_cap', 'pe_ratio', 'spread', 'timestamp'],
  allowedSources: ['yahoo_ws', 'binance_ws', 'futu', 'ib_tws', 'google_finance'],
  maxApiCallsPerDay: 10000,
  priceMonthlyUSDT: 9.99,
  label: 'Pro',
  canScreen: true,
  canBacktest: true,
  canApi: false,
};

const INSTITUTIONAL_MATRIX: PermissionMatrix = {
  level: 'institutional',
  maxSources: 7,
  maxWatchlist: 99999,
  maxAlerts: 99999,
  deliveryMode: 'realtime',
  allowedFields: ['price', 'bid', 'ask', 'volume', 'high', 'low', 'open', 'prevClose',
    'depth_bid', 'depth_ask', 'depth_full', 'tick_history', 'backtest_data', 'order_flow',
    'change', 'change_pct', 'market_cap', 'pe_ratio', 'spread', 'timestamp'],
  allowedSources: ['yahoo_ws', 'binance_ws', 'futu', 'ib_tws', 'google_finance', 'longbridge', 'moomoo'],
  maxApiCallsPerDay: 1000000,
  priceMonthlyUSDT: 199,
  label: 'Institutional',
  canScreen: true,
  canBacktest: true,
  canApi: true,
};

// ─── Engine ──────────────────────────────────────────────

export class MarketDataPermissionEngine extends EventEmitter {
  private static instance: MarketDataPermissionEngine;

  private subscriptions: Map<string, UserSubscription> = new Map();
  private quotas: Map<string, QuotaState> = new Map();
  private config: PermissionConfig;

  constructor(config?: PermissionConfig) {
    super();
    this.config = {
      livePriceUSDT: 0,
      proPriceUSDT: 9.99,
      institutionalPriceUSDT: 199,
      quotaResetHourUTC: 0,
      ...config,
    };
  }

  static getInstance(config?: PermissionConfig): MarketDataPermissionEngine {
    if (!MarketDataPermissionEngine.instance) {
      MarketDataPermissionEngine.instance = new MarketDataPermissionEngine(config);
    }
    return MarketDataPermissionEngine.instance;
  }

  reset(): void {
    this.subscriptions.clear();
    this.quotas.clear();
    this.removeAllListeners();
  }

  // ─── Permission Levels ─────────────────────────────────

  getMatrix(level: PermissionLevel): PermissionMatrix {
    switch (level) {
      case 'live': return { ...LIVE_MATRIX };
      case 'pro': return { ...PRO_MATRIX, priceMonthlyUSDT: this.config.proPriceUSDT ?? 9.99 };
      case 'institutional': return { ...INSTITUTIONAL_MATRIX, priceMonthlyUSDT: this.config.institutionalPriceUSDT ?? 199 };
    }
  }

  getAllLevels(): PermissionMatrix[] {
    return [this.getMatrix('live'), this.getMatrix('pro'), this.getMatrix('institutional')];
  }

  // ─── Subscription Management ───────────────────────────

  subscribe(userId: string, level: PermissionLevel, autoRenew = false, expiresAt: number | null = null): UserSubscription {
    const now = Date.now();
    const sub: UserSubscription = {
      userId,
      level,
      subscribedAt: now,
      expiresAt: expiresAt ?? (level === 'live' ? null : now + 30 * 24 * 3600 * 1000),
      autoRenew,
      paymentMethod: 'usdt_wallet',
    };
    this.subscriptions.set(userId, sub);
    this.ensureQuota(userId);
    this.emit('subscribed', sub);
    return sub;
  }

  upgrade(userId: string, toLevel: PermissionLevel): UserSubscription {
    const currentLevel = this.getLevel(userId);
    if (currentLevel === 'pro' && toLevel === 'institutional') {
      this.emit('upgrade', { userId, from: currentLevel, to: toLevel });
    } else if (currentLevel === 'live' && toLevel === 'pro') {
      this.emit('upgrade', { userId, from: currentLevel, to: toLevel });
    }
    return this.subscribe(userId, toLevel);
  }

  downgrade(userId: string): UserSubscription {
    return this.subscribe(userId, 'live');
  }

  getSubscription(userId: string): UserSubscription {
    if (!this.subscriptions.has(userId)) {
      this.subscribe(userId, 'live'); // default to live
    }
    return this.subscriptions.get(userId)!;
  }

  getLevel(userId: string): PermissionLevel {
    return this.getSubscription(userId).level;
  }

  isActive(userId: string): boolean {
    const sub = this.getSubscription(userId);
    if (sub.expiresAt === null) return true; // live never expires
    return Date.now() < sub.expiresAt;
  }

  // ─── Access Control ────────────────────────────────────

  checkAccess(userId: string, source: DataSourceId, field: QuoteField): AccessCheckResult {
    const level = this.getLevel(userId);
    const matrix = this.getMatrix(level);

    if (!matrix.allowedSources.includes(source)) {
      return {
        allowed: false,
        reason: `Source "${source}" not available on ${level} tier. Requires Pro or higher.`,
        requiredLevel: 'pro',
        currentLevel: level,
        field,
        source,
      };
    }

    if (!matrix.allowedFields.includes(field)) {
      const required: PermissionLevel = field.startsWith('depth_') || field === 'tick_history' ? 'pro' : 'institutional';

      return {
        allowed: false,
        reason: `Field "${field}" not available on ${level} tier. Requires ${required} or higher.`,
        requiredLevel: required,
        currentLevel: level,
        field,
        source,
      };
    }

    return { allowed: true, requiredLevel: level, currentLevel: level, field, source };
  }

  checkSource(userId: string, source: DataSourceId): boolean {
    const matrix = this.getMatrix(this.getLevel(userId));
    return matrix.allowedSources.includes(source);
  }

  checkField(userId: string, field: QuoteField): boolean {
    const matrix = this.getMatrix(this.getLevel(userId));
    return matrix.allowedFields.includes(field);
  }

  getAvailableSources(userId: string): DataSourceId[] {
    return this.getMatrix(this.getLevel(userId)).allowedSources;
  }

  getAvailableFields(userId: string): QuoteField[] {
    return this.getMatrix(this.getLevel(userId)).allowedFields;
  }

  // ─── Quota Management ──────────────────────────────────

  private ensureQuota(userId: string): QuotaState {
    const now = Date.now();
    const today = new Date();
    today.setUTCHours(this.config.quotaResetHourUTC!, 0, 0, 0);
    const resetTs = today.getTime();

    if (!this.quotas.has(userId)) {
      this.quotas.set(userId, {
        userId,
        apiCallsToday: 0,
        alertsToday: 0,
        watchlistSize: 0,
        sourcesActive: 0,
        lastReset: resetTs,
      });
    }

    const q = this.quotas.get(userId)!;
    if (q.lastReset < resetTs) {
      q.apiCallsToday = 0;
      q.alertsToday = 0;
      q.lastReset = resetTs;
    }

    return q;
  }

  canAddWatchlist(userId: string): boolean {
    const q = this.ensureQuota(userId);
    const matrix = this.getMatrix(this.getLevel(userId));
    return q.watchlistSize < matrix.maxWatchlist;
  }

  addWatchlist(userId: string, count = 1): boolean {
    const q = this.ensureQuota(userId);
    const matrix = this.getMatrix(this.getLevel(userId));
    if (q.watchlistSize + count > matrix.maxWatchlist) {
      this.emit('quota_exceeded', { userId, quota: 'watchlist', current: q.watchlistSize, max: matrix.maxWatchlist });
      return false;
    }
    q.watchlistSize += count;
    return true;
  }

  canAddAlert(userId: string): boolean {
    const q = this.ensureQuota(userId);
    const matrix = this.getMatrix(this.getLevel(userId));
    return q.alertsToday < matrix.maxAlerts;
  }

  addAlert(userId: string): boolean {
    const q = this.ensureQuota(userId);
    const matrix = this.getMatrix(this.getLevel(userId));
    if (q.alertsToday >= matrix.maxAlerts) {
      this.emit('quota_exceeded', { userId, quota: 'alerts', current: q.alertsToday, max: matrix.maxAlerts });
      return false;
    }
    q.alertsToday++;
    return true;
  }

  canUseApi(userId: string): boolean {
    const q = this.ensureQuota(userId);
    const matrix = this.getMatrix(this.getLevel(userId));
    if (!matrix.canApi) return false;
    return q.apiCallsToday < matrix.maxApiCallsPerDay;
  }

  recordApiCall(userId: string): void {
    const q = this.ensureQuota(userId);
    q.apiCallsToday++;
  }

  canActivateSource(userId: string): boolean {
    const q = this.ensureQuota(userId);
    const matrix = this.getMatrix(this.getLevel(userId));
    return q.sourcesActive < matrix.maxSources;
  }

  activateSource(userId: string): boolean {
    const q = this.ensureQuota(userId);
    const matrix = this.getMatrix(this.getLevel(userId));
    if (q.sourcesActive >= matrix.maxSources) {
      this.emit('quota_exceeded', { userId, quota: 'sources', current: q.sourcesActive, max: matrix.maxSources });
      return false;
    }
    q.sourcesActive++;
    return true;
  }

  deactivateSource(userId: string): void {
    const q = this.ensureQuota(userId);
    q.sourcesActive = Math.max(0, q.sourcesActive - 1);
  }

  getQuota(userId: string): QuotaState {
    return this.ensureQuota(userId);
  }

  // ─── Query ─────────────────────────────────────────────

  getDeliveryMode(userId: string): DeliveryMode {
    return this.getMatrix(this.getLevel(userId)).deliveryMode;
  }

  getMaxWatchlist(userId: string): number {
    return this.getMatrix(this.getLevel(userId)).maxWatchlist;
  }

  getMaxAlerts(userId: string): number {
    return this.getMatrix(this.getLevel(userId)).maxAlerts;
  }

  getPrice(level: PermissionLevel): number {
    return this.getMatrix(level).priceMonthlyUSDT;
  }

  canScreen(userId: string): boolean {
    return this.getMatrix(this.getLevel(userId)).canScreen;
  }

  canBacktest(userId: string): boolean {
    return this.getMatrix(this.getLevel(userId)).canBacktest;
  }

  canApi(userId: string): boolean {
    return this.getMatrix(this.getLevel(userId)).canApi;
  }

  getUserCount(): number {
    return this.subscriptions.size;
  }

  getUserCountByLevel(level: PermissionLevel): number {
    return [...this.subscriptions.values()].filter(s => s.level === level).length;
  }

  getActiveSubscribers(): number {
    return [...this.subscriptions.values()].filter(s => this.isActive(s.userId)).length;
  }

  // ─── Revenue Estimation ────────────────────────────────

  estimateMonthlyRevenue(): { totalUSDT: number; breakdown: Record<PermissionLevel, number> } {
    let total = 0;
    const breakdown: Record<PermissionLevel, number> = { live: 0, pro: 0, institutional: 0 };
    for (const sub of this.subscriptions.values()) {
      if (this.isActive(sub.userId)) {
        const price = this.getPrice(sub.level);
        breakdown[sub.level] += price;
        total += price;
      }
    }
    return { totalUSDT: Math.round(total * 100) / 100, breakdown };
  }

  // ─── Mock Helpers ──────────────────────────────────────

  createMockUsers(): void {
    this.subscribe('mock_live_001', 'live');
    this.subscribe('mock_pro_001', 'pro', true);
    this.subscribe('mock_inst_001', 'institutional', true);
    this.subscribe('mock_pro_002', 'pro', false);
  }
}

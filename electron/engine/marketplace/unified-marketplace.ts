// ── R176 G5: Unified Marketplace Engine ──────────────────────────────────────
// Single marketplace for 3 product categories:
//   1. Factor Bundles     (因子策略包) — curated factor combos with weights
//   2. Strategy Models    (策略模型)    — user-created strategy templates
//   3. Signal Subscriptions (信号订阅) — real-time factor signal feeds
//
// Each product: summary card, IC/return/Sharpe, subscriber count, price, subscribe.
// Filters: category, price range, provider, free trial availability.
//
// Connects to: D1 billing gateway, D4 signal pipeline, C5 snapshot store

import log from 'electron-log';
import { EventEmitter } from 'events';
import { getFactorBillingGateway, TOUCHPOINT_CONFIGS, type BillingTouchpoint } from '../factors/factor-billing-gateway';
import { getFactorSignalPipeline } from '../factors/factor-signal-pipeline';
import { getFactorSnapshotStore } from '../factors/factor-snapshot-store';

// ── Types ───────────────────────────────────────────────────────────────────

export type ProductCategory = 'factor_bundle' | 'strategy_model' | 'signal_subscription';

export type ProductStatus = 'listed' | 'unlisted' | 'archived' | 'draft';

export type ProductTier = 'free' | 'basic' | 'pro' | 'enterprise';

export interface ProductMetrics {
  annualReturn: number;      // % annualized
  sharpeRatio: number;
  maxDrawdown: number;       // % negative
  winRate: number;           // % positive days
  cumulativeReturn: number;  // % total
  ic?: number;               // Information coefficient (for factor bundles)
  benchmarkBeat: number;     // % over benchmark
  backtestDays: number;      // Number of trading days in backtest
}

export interface ProductPricing {
  tier: ProductTier;
  priceUSDT: number;
  freeTrialDays: number;
  subscriptionPeriod: 'one_time' | 'monthly' | 'quarterly' | 'yearly';
  revenueShare?: number;     // Platform share ratio (0.3 = 30%)
}

export interface MarketplaceProduct {
  id: string;
  category: ProductCategory;
  title: string;
  description: string;
  author: string;
  authorId: string;
  status: ProductStatus;
  tags: string[];
  market: string;            // HK | US | CRYPTO | ALL
  metrics: ProductMetrics;
  pricing: ProductPricing;
  subscriberCount: number;
  ratingAvg: number;         // 0-5
  ratingCount: number;
  createdAt: string;
  updatedAt: string;
  /** Factor bundle specific */
  factorIds?: string[];
  factorWeights?: Record<string, number>;
  /** Signal specific */
  signalTypes?: string[];
  /** Strategy specific */
  strategyDSL?: string;
  snapshotId?: string;
}

export interface ProductFilter {
  category?: ProductCategory;
  market?: string;
  tier?: ProductTier;
  priceMin?: number;
  priceMax?: number;
  minRating?: number;
  freeTrial?: boolean;
  search?: string;
}

export interface ProductSortOption {
  field: 'rating' | 'return' | 'new' | 'subscribers' | 'price' | 'sharpe' | 'ic';
  descending: boolean;
}

export interface Subscription {
  subscriptionId: string;
  userId: string;
  productId: string;
  category: ProductCategory;
  status: 'active' | 'expired' | 'cancelled' | 'trial';
  startedAt: string;
  expiresAt: string;
  paidUSDT: number;
  autoRenew: boolean;
}

// ── Seed Products ───────────────────────────────────────────────────────────

const SEED_PRODUCTS: MarketplaceProduct[] = [
  // Factor Bundles (因子策略包)
  {
    id: 'bundle-growth-defensive',
    category: 'factor_bundle',
    title: '成长+防守稳健组合',
    description: '高成长因子(0.25)+低波动因子(0.25)+质量因子(0.20)+12月动量(0.15)+流动性(0.10)+RSI(0.05)，攻守兼备',
    author: 'Dawn Whales',
    authorId: 'dawn-whales-official',
    status: 'listed',
    tags: ['稳健', '成长', '低波动', '大盘'],
    market: 'ALL',
    metrics: { annualReturn: 14.2, sharpeRatio: 1.15, maxDrawdown: -18.5, winRate: 62, cumulativeReturn: 68.4, ic: 0.042, benchmarkBeat: 6.2, backtestDays: 756 },
    pricing: { tier: 'basic', priceUSDT: 9.9, freeTrialDays: 3, subscriptionPeriod: 'one_time' },
    subscriberCount: 1284,
    ratingAvg: 4.2,
    ratingCount: 312,
    createdAt: '2026-05-01T00:00:00Z',
    updatedAt: '2026-06-10T00:00:00Z',
    factorIds: ['GROWTH', 'VOL_60D', 'QUAL', 'MOM_12M', 'LIQ', 'RSI_14'],
    factorWeights: { GROWTH: 0.25, VOL_60D: 0.25, QUAL: 0.20, MOM_12M: 0.15, LIQ: 0.10, RSI_14: 0.05 },
  },
  {
    id: 'bundle-momentum-rocket',
    category: 'factor_bundle',
    title: '动量火箭组合',
    description: '纯动量策略: 12月动量(0.25)+趋势确认(0.20)+ADX(0.15)+MACD(0.15)+流动性(0.15)+1月动量(0.10)',
    author: 'Dawn Whales',
    authorId: 'dawn-whales-official',
    status: 'listed',
    tags: ['动量', '趋势', '进攻', '高收益'],
    market: 'US',
    metrics: { annualReturn: 22.3, sharpeRatio: 1.28, maxDrawdown: -25.8, winRate: 45, cumulativeReturn: 112.5, ic: 0.045, benchmarkBeat: 14.3, backtestDays: 756 },
    pricing: { tier: 'basic', priceUSDT: 9.9, freeTrialDays: 3, subscriptionPeriod: 'one_time' },
    subscriberCount: 2047,
    ratingAvg: 4.5,
    ratingCount: 589,
    createdAt: '2026-04-15T00:00:00Z',
    updatedAt: '2026-06-12T00:00:00Z',
    factorIds: ['MOM_12M', 'MA_20_60', 'ADX', 'EMA_12_26', 'LIQ', 'MOM_1M'],
    factorWeights: { MOM_12M: 0.25, MA_20_60: 0.20, ADX: 0.15, EMA_12_26: 0.15, LIQ: 0.15, MOM_1M: 0.10 },
  },
  {
    id: 'bundle-high-dividend',
    category: 'factor_bundle',
    title: '高股息收息组合',
    description: '股息核心: 股息率(0.30)+价值(0.20)+质量(0.20)+大盘规模(0.15)+低波动(0.10)+保守(0.05)',
    author: 'Dawn Whales',
    authorId: 'dawn-whales-official',
    status: 'listed',
    tags: ['股息', '收息', '价值', '稳健'],
    market: 'HK',
    metrics: { annualReturn: 9.5, sharpeRatio: 1.38, maxDrawdown: -14.0, winRate: 65, cumulativeReturn: 42.8, ic: 0.035, benchmarkBeat: 3.5, backtestDays: 756 },
    pricing: { tier: 'free', priceUSDT: 0, freeTrialDays: 0, subscriptionPeriod: 'one_time' },
    subscriberCount: 876,
    ratingAvg: 4.0,
    ratingCount: 221,
    createdAt: '2026-03-20T00:00:00Z',
    updatedAt: '2026-06-01T00:00:00Z',
    factorIds: ['YIELD', 'HML', 'QUAL', 'SIZE', 'VOL_60D', 'CMA'],
    factorWeights: { YIELD: 0.30, HML: 0.20, QUAL: 0.20, SIZE: 0.15, VOL_60D: 0.10, CMA: 0.05 },
  },
  // Strategy Models (策略模型)
  {
    id: 'strategy-mean-reversion',
    category: 'strategy_model',
    title: '均值回归量化模型',
    description: '基于RSI+布林带的均值回归策略，适合震荡市。历史胜率68%，年化Sharpe 1.55。',
    author: 'AlphaQuant Labs',
    authorId: 'alpha-quant',
    status: 'listed',
    tags: ['量化', '均值回归', '震荡市', '高胜率'],
    market: 'US',
    metrics: { annualReturn: 15.8, sharpeRatio: 1.55, maxDrawdown: -12.3, winRate: 68, cumulativeReturn: 78.5, benchmarkBeat: 7.8, backtestDays: 1008 },
    pricing: { tier: 'pro', priceUSDT: 19.9, freeTrialDays: 3, subscriptionPeriod: 'monthly', revenueShare: 0.3 },
    subscriberCount: 452,
    ratingAvg: 4.7,
    ratingCount: 178,
    createdAt: '2026-02-10T00:00:00Z',
    updatedAt: '2026-06-08T00:00:00Z',
    strategyDSL: '{"type":"mean_reversion","factors":["RSI_14","BOLL"],"params":{"rsi_low":30,"rsi_high":70}}',
  },
  {
    id: 'strategy-trend-following',
    category: 'strategy_model',
    title: '自适应趋势跟踪模型',
    description: 'ADX+EMA信号驱动的自适应趋势策略，动态调整仓位。适合单边市场。',
    author: 'TrendMaster Pro',
    authorId: 'trend-master',
    status: 'listed',
    tags: ['趋势', '自适应', '仓位管理', '高收益'],
    market: 'US',
    metrics: { annualReturn: 26.4, sharpeRatio: 1.42, maxDrawdown: -22.1, winRate: 51, cumulativeReturn: 132.0, benchmarkBeat: 18.4, backtestDays: 1008 },
    pricing: { tier: 'enterprise', priceUSDT: 49.9, freeTrialDays: 7, subscriptionPeriod: 'quarterly', revenueShare: 0.25 },
    subscriberCount: 87,
    ratingAvg: 4.3,
    ratingCount: 42,
    createdAt: '2026-01-05T00:00:00Z',
    updatedAt: '2026-05-30T00:00:00Z',
    strategyDSL: '{"type":"trend_following","factors":["ADX","EMA_12_26","MA_20_60"],"params":{"adx_threshold":25}}',
  },
  // Signal Subscriptions (信号订阅)
  {
    id: 'signal-momentum-breakout',
    category: 'signal_subscription',
    title: '动量突破信号流',
    description: '每日扫描全市场动量突破信号，包括IC突破、趋势确认、成交量放大。平均3-5条/日。',
    author: 'Dawn Whales',
    authorId: 'dawn-whales-official',
    status: 'listed',
    tags: ['动量', '突破', '实时', '每日'],
    market: 'ALL',
    metrics: { annualReturn: 18.2, sharpeRatio: 1.35, maxDrawdown: -16.7, winRate: 58, cumulativeReturn: 0, benchmarkBeat: 10.2, backtestDays: 504 },
    pricing: { tier: 'pro', priceUSDT: 4.9, freeTrialDays: 7, subscriptionPeriod: 'monthly' },
    subscriberCount: 3201,
    ratingAvg: 4.4,
    ratingCount: 892,
    createdAt: '2026-04-01T00:00:00Z',
    updatedAt: '2026-06-14T00:00:00Z',
    signalTypes: ['factor_breakout', 'factor_recommendation'],
  },
  {
    id: 'signal-crowding-alert',
    category: 'signal_subscription',
    title: '拥挤预警信号流',
    description: '实时监控因子拥挤度变化，包括估值溢价、仓位集中度、换手率异常。平均1-2条/周。',
    author: 'Dawn Whales',
    authorId: 'dawn-whales-official',
    status: 'listed',
    tags: ['拥挤', '预警', '风控', '每周'],
    market: 'ALL',
    metrics: { annualReturn: 0, sharpeRatio: 0, maxDrawdown: 0, winRate: 0, cumulativeReturn: 0, benchmarkBeat: 0, backtestDays: 504 },
    pricing: { tier: 'free', priceUSDT: 0, freeTrialDays: 0, subscriptionPeriod: 'monthly' },
    subscriberCount: 5643,
    ratingAvg: 4.1,
    ratingCount: 1123,
    createdAt: '2026-03-15T00:00:00Z',
    updatedAt: '2026-06-14T00:00:00Z',
    signalTypes: ['crowding_signal', 'decay_warning'],
  },
  {
    id: 'bundle-value-quality',
    category: 'factor_bundle',
    title: '价值+质量双因子组合',
    description: '深度价值: HML(0.30)+QUAL(0.25)+RMW(0.20)+CMA(0.15)+YIELD(0.10)。适合熊市和震荡市。',
    author: 'Dawn Whales',
    authorId: 'dawn-whales-official',
    status: 'listed',
    tags: ['价值', '质量', '防御', '低估值'],
    market: 'HK',
    metrics: { annualReturn: 12.1, sharpeRatio: 1.22, maxDrawdown: -16.0, winRate: 60, cumulativeReturn: 54.3, ic: 0.038, benchmarkBeat: 4.1, backtestDays: 756 },
    pricing: { tier: 'basic', priceUSDT: 9.9, freeTrialDays: 3, subscriptionPeriod: 'one_time' },
    subscriberCount: 945,
    ratingAvg: 4.3,
    ratingCount: 267,
    createdAt: '2026-05-20T00:00:00Z',
    updatedAt: '2026-06-10T00:00:00Z',
    factorIds: ['HML', 'QUAL', 'RMW', 'CMA', 'YIELD'],
    factorWeights: { HML: 0.30, QUAL: 0.25, RMW: 0.20, CMA: 0.15, YIELD: 0.10 },
  },
];

// ── Engine ──────────────────────────────────────────────────────────────────

export class UnifiedMarketplaceEngine extends EventEmitter {
  private products: Map<string, MarketplaceProduct> = new Map();
  private subscriptions: Map<string, Subscription> = new Map();
  private userSubscriptions: Map<string, Set<string>> = new Map(); // userId → subscriptionIds

  static readonly EVENTS = {
    PRODUCT_LISTED: 'marketplace:productListed',
    PRODUCT_UPDATED: 'marketplace:productUpdated',
    PRODUCT_PURCHASED: 'marketplace:productPurchased',
    SUBSCRIPTION_EXPIRED: 'marketplace:subscriptionExpired',
  } as const;

  constructor() {
    super();
    // Load seed data
    for (const p of SEED_PRODUCTS) {
      this.products.set(p.id, p);
    }
    log.info(`[Marketplace] Initialized with ${this.products.size} seed products`);
  }

  // ── Product Listing ────────────────────────────────────────────────────

  /** List products with optional filters and sorting. */
  listProducts(filter?: ProductFilter, sort?: ProductSortOption): MarketplaceProduct[] {
    let results = [...this.products.values()].filter(p => p.status === 'listed');

    if (filter) {
      if (filter.category) results = results.filter(p => p.category === filter.category);
      if (filter.market && filter.market !== 'ALL') {
        results = results.filter(p => p.market === filter.market || p.market === 'ALL');
      }
      if (filter.tier) results = results.filter(p => p.pricing.tier === filter.tier);
      if (filter.priceMin != null) results = results.filter(p => p.pricing.priceUSDT >= filter.priceMin!);
      if (filter.priceMax != null) results = results.filter(p => p.pricing.priceUSDT <= filter.priceMax!);
      if (filter.minRating != null) results = results.filter(p => p.ratingAvg >= filter.minRating!);
      if (filter.freeTrial) results = results.filter(p => p.pricing.freeTrialDays > 0);
      if (filter.search) {
        const q = filter.search.toLowerCase();
        results = results.filter(p =>
          p.title.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.tags.some(t => t.toLowerCase().includes(q)),
        );
      }
    }

    const s = sort || { field: 'rating', descending: true };
    results.sort((a, b) => {
      const fields: Record<string, (p: MarketplaceProduct) => number> = {
        rating: p => p.ratingAvg,
        return: p => p.metrics.annualReturn,
        new: p => new Date(p.createdAt).getTime(),
        subscribers: p => p.subscriberCount,
        price: p => p.pricing.priceUSDT,
        sharpe: p => p.metrics.sharpeRatio,
        ic: p => p.metrics.ic ?? 0,
      };
      const fn = fields[s.field] || fields.rating;
      const va = fn(a); const vb = fn(b);
      return s.descending ? vb - va : va - vb;
    });

    return results;
  }

  /** Get a single product by ID. */
  getProduct(id: string): MarketplaceProduct | undefined {
    return this.products.get(id);
  }

  /** Get products by category. */
  getProductsByCategory(category: ProductCategory): MarketplaceProduct[] {
    return this.listProducts({ category });
  }

  /** List a new product (author creates listing). */
  listProduct(product: MarketplaceProduct): MarketplaceProduct {
    this.products.set(product.id, product);
    this.emit(UnifiedMarketplaceEngine.EVENTS.PRODUCT_LISTED, product);
    log.info(`[Marketplace] Listed: ${product.title} (${product.category})`);
    return product;
  }

  /** Update an existing product. */
  updateProduct(id: string, updates: Partial<MarketplaceProduct>): MarketplaceProduct | null {
    const product = this.products.get(id);
    if (!product) return null;
    Object.assign(product, updates, { updatedAt: new Date().toISOString() });
    this.emit(UnifiedMarketplaceEngine.EVENTS.PRODUCT_UPDATED, product);
    return product;
  }

  /** Archive/unlist a product. */
  unlistProduct(id: string): boolean {
    const product = this.products.get(id);
    if (!product) return false;
    product.status = 'archived';
    product.updatedAt = new Date().toISOString();
    return true;
  }

  // ── Subscriptions ──────────────────────────────────────────────────────

  /**
   * Subscribe/purchase a product.
   * Routes through FactorBillingGateway for payment processing.
   * R179 G29: Price cross-validation + block AI auto-subscription.
   */
  async subscribe(userId: string, productId: string, opts?: {
    caller?: 'HUMAN' | 'AI' | 'SCHEDULER';
    humanConfirmCode?: string;
  }): Promise<{
    success: boolean;
    subscription?: Subscription;
    error?: string;
    charged?: number;
  }> {
    // R179 G29: Block AI auto-subscription
    if (opts?.caller === 'AI') {
      log.warn(`[Marketplace] AI subscription attempt blocked: user=${userId.slice(0,8)} product=${productId}`);
      return { success: false, error: 'AI-GATED: 自动订阅已禁用。请通过交易界面手动确认订阅。' };
    }

    const product = this.products.get(productId);
    if (!product) return { success: false, error: '产品不存在' };
    if (product.status !== 'listed') return { success: false, error: '产品已下架' };

    // R179 G29: Price cross-validation — ensure charged amount matches product price
    const expectedPrice = product.pricing.priceUSDT;
    if (expectedPrice < 0) {
      return { success: false, error: '产品价格异常' };
    }

    // Check for existing active subscription
    const userSubs = this.userSubscriptions.get(userId);
    if (userSubs) {
      for (const subId of userSubs) {
        const sub = this.subscriptions.get(subId);
        if (sub && sub.productId === productId && sub.status === 'active') {
          return { success: false, error: '已订阅该产品' };
        }
      }
    }

    // Route billing through D1 gateway
    const billingTouchpoint: BillingTouchpoint = product.category === 'signal_subscription'
      ? 'SIGNAL_SUBSCRIBE'
      : product.category === 'strategy_model'
        ? 'STRATEGY_MARKET'
        : 'AI_RECOMMENDATION';

    const billing = getFactorBillingGateway();
    const billingResult = await billing.attemptAccess(userId, billingTouchpoint);

    if (!billingResult.ok) {
      return { success: false, error: billingResult.message };
    }

    // R179 G29: Price cross-validation — charged amount must match product price
    if (billingResult.charged && billingResult.amountCharged !== expectedPrice) {
      log.error(`[Marketplace] Price mismatch: charged=${billingResult.amountCharged} expected=${expectedPrice}`);
      return { success: false, error: `价格验证失败: 扣费${billingResult.amountCharged}U ≠ 定价${expectedPrice}U` };
    }

    // Create subscription
    const subId = `sub-${userId}-${productId}-${Date.now()}`;
    const now = new Date();
    const isTrial = product.pricing.freeTrialDays > 0 && billingResult.charged === false;
    const periodDays = isTrial
      ? product.pricing.freeTrialDays
      : this.periodDays(product.pricing.subscriptionPeriod);

    const expiresAt = new Date(now.getTime() + periodDays * 24 * 3600 * 1000);

    const subscription: Subscription = {
      subscriptionId: subId,
      userId,
      productId,
      category: product.category,
      status: isTrial ? 'trial' : 'active',
      startedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      paidUSDT: billingResult.amountCharged,
      autoRenew: product.pricing.subscriptionPeriod !== 'one_time',
    };

    this.subscriptions.set(subId, subscription);
    if (!this.userSubscriptions.has(userId)) {
      this.userSubscriptions.set(userId, new Set());
    }
    this.userSubscriptions.get(userId)!.add(subId);

    // Update subscriber count
    product.subscriberCount++;
    this.emit(UnifiedMarketplaceEngine.EVENTS.PRODUCT_PURCHASED, { subscription, product });

    log.info(`[Marketplace] ${userId} subscribed to ${productId} (${subscription.status}, ${periodDays}d)`);

    return { success: true, subscription, charged: billingResult.amountCharged };
  }

  /** Get all subscriptions for a user. */
  getUserSubscriptions(userId: string): Subscription[] {
    const ids = this.userSubscriptions.get(userId);
    if (!ids) return [];
    return [...ids].map(id => this.subscriptions.get(id)!).filter(Boolean);
  }

  /** Check if user has active subscription to a product. */
  hasActiveSubscription(userId: string, productId: string): boolean {
    return this.getUserSubscriptions(userId).some(
      s => s.productId === productId && (s.status === 'active' || s.status === 'trial'),
    );
  }

  /** Cancel a subscription. */
  cancelSubscription(subscriptionId: string): boolean {
    const sub = this.subscriptions.get(subscriptionId);
    if (!sub) return false;
    sub.status = 'cancelled';
    sub.autoRenew = false;
    return true;
  }

  // ── Stats ──────────────────────────────────────────────────────────────

  getStats(): {
    totalProducts: number;
    byCategory: Record<ProductCategory, number>;
    totalSubscribers: number;
    totalRevenue: number;
  } {
    const byCategory: Record<ProductCategory, number> = {
      factor_bundle: 0, strategy_model: 0, signal_subscription: 0,
    };
    let totalRevenue = 0;
    for (const product of this.products.values()) {
      if (product.status === 'listed') byCategory[product.category]++;
    }
    for (const sub of this.subscriptions.values()) {
      totalRevenue += sub.paidUSDT;
    }

    return {
      totalProducts: Object.values(byCategory).reduce((a, b) => a + b, 0),
      byCategory,
      totalSubscribers: new Set([...this.subscriptions.values()].map(s => s.userId)).size,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
    };
  }

  reset(): void {
    this.products.clear();
    this.subscriptions.clear();
    this.userSubscriptions.clear();
    for (const p of SEED_PRODUCTS) this.products.set(p.id, p);
    this.removeAllListeners();
    log.info('[Marketplace] Reset');
  }

  private periodDays(period: string): number {
    switch (period) {
      case 'monthly': return 30;
      case 'quarterly': return 90;
      case 'yearly': return 365;
      default: return 0; // one_time
    }
  }
}

// ── Singleton ───────────────────────────────────────────────────────────────

let _marketplace: UnifiedMarketplaceEngine | null = null;

export function getUnifiedMarketplace(): UnifiedMarketplaceEngine {
  if (!_marketplace) _marketplace = new UnifiedMarketplaceEngine();
  return _marketplace;
}

export function resetUnifiedMarketplace(): void {
  _marketplace?.reset();
  _marketplace = null;
}

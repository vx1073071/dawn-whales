/**
 * R246 P1-03: 因子市场桥接 (FactorMarketplaceBridge)
 * 
 * 桥接三端:
 *   FactorTrialEngine (R245) → 因子数据 + 试吃体验
 *   StrategyMarketplaceAPI → 市场展示 + 上架 + 搜索
 *   支付 → 买断解锁 (9.9U/因子)
 * 
 * Flow:
 *   User browses factor catalog → preview (IC/IR/one-liner)
 *     → trial (30d free) → buy → unlock full data
 * 
 * 定价: 9.9U/因子 (永久买断) + 平台抽成 20%
 * 批量: 50因子包 3U/月 或 149全量 12U/月
 */

import { createHash } from 'crypto';

// ── Types ──────────────────────────────────────────────────────────────────

export interface FactorListing {
  listingId: string;
  factorId: string;
  factorName: string;
  factorNameCn: string;
  domain: string;
  oneLiner: string;
  ic: number;
  ir: number;
  applicableMarkets: string[];
  stars: number;               // 1-5 rating
  purchaseCount: number;
  trialCount: number;
  addedAt: number;
  updatedAt: number;
  creatorId: string;           // 'system' for built-in, userId for UGC
  status: 'active' | 'pending' | 'delisted';
  pricing: {
    buyoutPrice: number;       // 9.9U
    subscriptionIncluded: boolean; // Free tier: false, Pro: true
    royaltyPercent: number;    // Creator split (80% to creator, 20% to platform)
  };
}

export interface PurchaseRecord {
  purchaseId: string;
  userId: string;
  listingId: string;
  factorId: string;
  priceU: number;
  royaltyU: number;           // Paid to creator
  platformFeeU: number;       // Platform cut
  purchasedAt: number;
  type: 'buyout' | 'subscription';
}

export interface FactorSearchQuery {
  keyword?: string;
  domain?: string;
  market?: string;
  minIC?: number;
  minIR?: number;
  minStars?: number;
  sort?: 'popular' | 'newest' | 'ic' | 'price';
  limit?: number;
  offset?: number;
}

export interface MarketplaceStats {
  totalListings: number;
  totalPurchases: number;
  totalRevenueU: number;
  platformRevenueU: number;
  creatorPayoutsU: number;
  avgPriceU: number;
  topSellerFactorId: string;
  topSellerRevenueU: number;
}

export interface FactorReview {
  reviewId: string;
  userId: string;
  factorId: string;
  stars: number;               // 1-5
  comment: string;
  trialBased: boolean;         // Did user trial before reviewing?
  createdAt: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// FactorMarketplaceBridge
// ═══════════════════════════════════════════════════════════════════════════

export class FactorMarketplaceBridge {
  private listings: Map<string, FactorListing> = new Map();
  private purchases: PurchaseRecord[] = [];
  private reviews: Map<string, FactorReview[]> = new Map(); // factorId→reviews
  private userPurchases: Map<string, Set<string>> = new Map(); // userId→factorId set

  constructor() {
    this._seedBuiltInFactors();
  }

  // ── Catalog / Discovery ────────────────────────────────────────────────

  /** List all active marketplace listings */
  listListings(query?: FactorSearchQuery): FactorListing[] {
    let results = Array.from(this.listings.values()).filter(l => l.status === 'active');

    if (query?.keyword) {
      const kw = query.keyword.toLowerCase();
      results = results.filter(l =>
        l.factorName.toLowerCase().includes(kw) ||
        l.factorNameCn.includes(kw) ||
        l.oneLiner.toLowerCase().includes(kw) ||
        l.domain.includes(kw),
      );
    }
    if (query?.domain) results = results.filter(l => l.domain === query.domain);
    if (query?.market) results = results.filter(l => l.applicableMarkets.includes(query.market!));
    if (query?.minIC) results = results.filter(l => l.ic >= query.minIC!);
    if (query?.minIR) results = results.filter(l => l.ir >= query.minIR!);
    if (query?.minStars) results = results.filter(l => l.stars >= query.minStars!);

    switch (query?.sort) {
      case 'newest':  results.sort((a, b) => b.addedAt - a.addedAt); break;
      case 'ic':      results.sort((a, b) => b.ic - a.ic); break;
      case 'price':   results.sort((a, b) => a.pricing.buyoutPrice - b.pricing.buyoutPrice); break;
      case 'popular':
      default:        results.sort((a, b) => b.purchaseCount - a.purchaseCount); break;
    }

    const offset = query?.offset ?? 0;
    const limit = query?.limit ?? 20;
    return results.slice(offset, offset + limit);
  }

  /** Get a single listing detail */
  getListing(factorId: string): FactorListing | null {
    return this.listings.get(factorId) ?? null;
  }

  /** Get featured/top factors */
  getFeatured(limit = 6): FactorListing[] {
    return Array.from(this.listings.values())
      .filter(l => l.status === 'active')
      .sort((a, b) => (b.purchaseCount * 0.5 + b.trialCount * 0.3 + b.stars * 0.2 * 100) - (a.purchaseCount * 0.5 + a.trialCount * 0.3 + a.stars * 0.2 * 100))
      .slice(0, limit);
  }

  // ── Purchase / Unlock ──────────────────────────────────────────────────

  /**
   * Purchase a factor (buyout).
   * 9.9U buyout → 80% to creator, 20% to platform.
   */
  purchase(userId: string, factorId: string): {
    success: boolean;
    purchase: PurchaseRecord | null;
    error?: string;
    userOwnsNow: string[];
  } {
    const listing = this.listings.get(factorId);
    if (!listing || listing.status !== 'active') {
      return { success: false, purchase: null, error: 'Factor not available', userOwnsNow: this._getOwned(userId) };
    }

    if (this._userOwns(userId, factorId)) {
      return { success: false, purchase: null, error: 'Already owned', userOwnsNow: this._getOwned(userId) };
    }

    const price = listing.pricing.buyoutPrice;
    const platformFee = Math.round(price * 0.2 * 100) / 100;
    const royalty = Math.round((price - platformFee) * 100) / 100;

    const purchase: PurchaseRecord = {
      purchaseId: `purchase:${userId}:${factorId}:${Date.now()}`,
      userId, listingId: listing.listingId, factorId,
      priceU: price, royaltyU: royalty, platformFeeU: platformFee,
      purchasedAt: Date.now(),
      type: 'buyout',
    };

    this.purchases.push(purchase);
    listing.purchaseCount++;

    // Track ownership
    let owned = this.userPurchases.get(userId);
    if (!owned) { owned = new Set(); this.userPurchases.set(userId, owned); }
    owned.add(factorId);

    return { success: true, purchase, userOwnsNow: this._getOwned(userId) };
  }

  /** Check if user owns a factor */
  userOwns(userId: string, factorId: string): boolean {
    return this._userOwns(userId, factorId);
  }

  /** Get all factors owned by a user */
  getUserOwned(userId: string): string[] {
    return this._getOwned(userId);
  }

  // ── Reviews ────────────────────────────────────────────────────────────

  /** Add a review for a factor */
  addReview(userId: string, factorId: string, stars: number, comment: string, trialBased = false): FactorReview | null {
    if (!this.listings.has(factorId)) return null;
    if (stars < 1 || stars > 5) return null;

    const review: FactorReview = {
      reviewId: `review:${userId}:${factorId}:${Date.now()}`,
      userId, factorId, stars, comment, trialBased,
      createdAt: Date.now(),
    };

    let revs = this.reviews.get(factorId);
    if (!revs) { revs = []; this.reviews.set(factorId, revs); }
    revs.push(review);

    // Update listing stars
    const listing = this.listings.get(factorId)!;
    const allRevs = revs.map(r => r.stars);
    listing.stars = Math.round(allRevs.reduce((a, b) => a + b, 0) / allRevs.length);

    return review;
  }

  /** Get reviews for a factor */
  getReviews(factorId: string): FactorReview[] {
    return this.reviews.get(factorId) ?? [];
  }

  // ── Creator tools ──────────────────────────────────────────────────────

  /**
   * Submit a new factor for listing (UGC).
   * Goes into 'pending' status until approved.
   */
  submitForListing(
    creatorId: string,
    factor: {
      factorId: string; factorName: string; factorNameCn: string;
      domain: string; oneLiner: string; ic: number; ir: number;
      applicableMarkets: string[]; buyoutPrice?: number;
    },
  ): FactorListing {
    const listing: FactorListing = {
      listingId: `listing:${factor.factorId}:${Date.now()}`,
      factorId: factor.factorId,
      factorName: factor.factorName,
      factorNameCn: factor.factorNameCn,
      domain: factor.domain,
      oneLiner: factor.oneLiner,
      ic: factor.ic,
      ir: factor.ir,
      applicableMarkets: factor.applicableMarkets,
      stars: 0,
      purchaseCount: 0,
      trialCount: 0,
      addedAt: Date.now(),
      updatedAt: Date.now(),
      creatorId,
      status: 'pending',
      pricing: {
        buyoutPrice: factor.buyoutPrice ?? 9.9,
        subscriptionIncluded: false,
        royaltyPercent: 80,
      },
    };
    this.listings.set(listing.factorId, listing);
    return listing;
  }

  /** Approve a pending listing */
  approveListing(factorId: string): boolean {
    const listing = this.listings.get(factorId);
    if (!listing || listing.status !== 'pending') return false;
    listing.status = 'active';
    listing.updatedAt = Date.now();
    return true;
  }

  /** Delist a factor */
  delistListing(factorId: string): boolean {
    const listing = this.listings.get(factorId);
    if (!listing) return false;
    listing.status = 'delisted';
    listing.updatedAt = Date.now();
    return true;
  }

  // ── Stats ───────────────────────────────────────────────────────────────

  getStats(): MarketplaceStats {
    let totalRevenue = 0, platformRevenue = 0, creatorPayouts = 0;
    for (const p of this.purchases) {
      totalRevenue += p.priceU;
      platformRevenue += p.platformFeeU;
      creatorPayouts += p.royaltyU;
    }

    // Find top seller
    const factorRevenue: Map<string, number> = new Map();
    for (const p of this.purchases) {
      factorRevenue.set(p.factorId, (factorRevenue.get(p.factorId) ?? 0) + p.priceU);
    }
    let topFactor = '', topRevenue = 0;
    for (const [fid, rev] of factorRevenue) {
      if (rev > topRevenue) { topRevenue = rev; topFactor = fid; }
    }

    return {
      totalListings: this.listings.size,
      totalPurchases: this.purchases.length,
      totalRevenueU: Math.round(totalRevenue * 100) / 100,
      platformRevenueU: Math.round(platformRevenue * 100) / 100,
      creatorPayoutsU: Math.round(creatorPayouts * 100) / 100,
      avgPriceU: this.purchases.length > 0 ? Math.round(totalRevenue / this.purchases.length * 100) / 100 : 9.9,
      topSellerFactorId: topFactor,
      topSellerRevenueU: Math.round(topRevenue * 100) / 100,
    };
  }

  /** Get creator revenue breakdown */
  getCreatorRevenue(creatorId: string): {
    totalRevenueU: number; sales: number; avgRating: number;
    listings: { factorId: string; sales: number; revenueU: number }[];
  } {
    const creatorListings = Array.from(this.listings.values()).filter(l => l.creatorId === creatorId);
    const breakdown: { factorId: string; sales: number; revenueU: number }[] = [];
    let totalRev = 0;

    for (const listing of creatorListings) {
      const sales = this.purchases.filter(p => p.factorId === listing.factorId);
      const rev = sales.reduce((s, p) => s + p.royaltyU, 0);
      totalRev += rev;
      breakdown.push({ factorId: listing.factorId, sales: sales.length, revenueU: Math.round(rev * 100) / 100 });
    }

    const ratings = creatorListings.map(l => l.stars).filter(s => s > 0);
    const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;

    return {
      totalRevenueU: Math.round(totalRev * 100) / 100,
      sales: this.purchases.filter(p => creatorListings.some(l => l.factorId === p.factorId)).length,
      avgRating: Math.round(avgRating * 10) / 10,
      listings: breakdown,
    };
  }

  /** Track trial (called by FactorTrialEngine) */
  trackTrial(factorId: string): void {
    const listing = this.listings.get(factorId);
    if (listing) listing.trialCount++;
  }

  /** Reset */
  reset(): void {
    this.listings.clear();
    this.purchases.length = 0;
    this.reviews.clear();
    this.userPurchases.clear();
    this._seedBuiltInFactors();
  }

  // ── Private ─────────────────────────────────────────────────────────────

  private _seedBuiltInFactors(): void {
    const builtIns: Array<{
      factorId: string; factorName: string; factorNameCn: string;
      domain: string; oneLiner: string; ic: number; ir: number;
      applicableMarkets: string[];
    }> = [
      { factorId: 'MOMENTUM_12M', factorName: '12M Momentum', factorNameCn: '12月动量', domain: 'momentum', oneLiner: '过去一年涨得好的股票，未来1月大概率继续好', ic: 0.08, ir: 0.55, applicableMarkets: ['US', 'HK'] },
      { factorId: 'MOMENTUM_3M', factorName: '3M Momentum', factorNameCn: '3月动量', domain: 'momentum', oneLiner: '最近3个月强势的股票，下个月大概率继续强势', ic: 0.06, ir: 0.42, applicableMarkets: ['US', 'HK'] },
      { factorId: 'MOMENTUM_1M', factorName: '1M Momentum', factorNameCn: '1月动量', domain: 'momentum', oneLiner: '短期趋势跟踪，适合快速轮动策略', ic: 0.04, ir: 0.30, applicableMarkets: ['US', 'HK'] },
      { factorId: 'VALUE_EARNINGS_YIELD', factorName: 'Earnings Yield', factorNameCn: '盈利收益率', domain: 'value', oneLiner: '低市盈率的股票长期跑赢高市盈率', ic: 0.04, ir: 0.30, applicableMarkets: ['US', 'HK', 'A'] },
      { factorId: 'VALUE_DIVIDEND_YIELD', factorName: 'Dividend Yield', factorNameCn: '股息率', domain: 'value', oneLiner: '高股息股票在市场不好时更抗跌', ic: 0.03, ir: 0.25, applicableMarkets: ['US', 'HK', 'A'] },
      { factorId: 'VALUE_FCF_YIELD', factorName: 'FCF Yield', factorNameCn: '自由现金流收益率', domain: 'value', oneLiner: '现金流比利润更真实，FCF高的公司更值钱', ic: 0.05, ir: 0.33, applicableMarkets: ['US', 'HK'] },
      { factorId: 'QUALITY_ROE', factorName: 'ROE', factorNameCn: '净资产收益率', domain: 'quality', oneLiner: 'ROE高的公司更赚钱，股价长期更稳', ic: 0.06, ir: 0.40, applicableMarkets: ['US', 'HK', 'A'] },
      { factorId: 'QUALITY_FCF_STABILITY', factorName: 'FCF Stability', factorNameCn: '现金流稳定性', domain: 'quality', oneLiner: '现金流稳定的公司财务造假风险低', ic: 0.04, ir: 0.28, applicableMarkets: ['US', 'HK'] },
      { factorId: 'GROWTH_EPS_3Y', factorName: '3Y EPS Growth', factorNameCn: '3年盈利增长', domain: 'growth', oneLiner: '利润连续3年增长的公司，股价跟涨概率高', ic: 0.05, ir: 0.32, applicableMarkets: ['US', 'HK'] },
      { factorId: 'VOL_HISTORICAL', factorName: 'Historical Vol', factorNameCn: '历史波动率', domain: 'volatility', oneLiner: '低波动股票长期夏普比率更高', ic: -0.03, ir: 0.25, applicableMarkets: ['US', 'HK', 'CRYPTO'] },
      { factorId: 'SENT_EARNINGS_SURPRISE', factorName: 'Earnings Surprise', factorNameCn: '财报超预期', domain: 'sentiment', oneLiner: '财报超预期的公司，后一周平均多涨2-3%', ic: 0.07, ir: 0.38, applicableMarkets: ['US', 'HK'] },
      { factorId: 'TECH_RSI', factorName: 'RSI Signal', factorNameCn: 'RSI信号', domain: 'technical', oneLiner: 'RSI<30超卖反弹，RSI>70超买回调', ic: 0.02, ir: 0.15, applicableMarkets: ['US', 'HK', 'CRYPTO'] },
      { factorId: 'CRYPTO_VOLUME', factorName: 'Crypto Volume', factorNameCn: '加密交易量', domain: 'crypto_specific', oneLiner: '链上交易量暴增通常预示价格剧烈波动', ic: 0.06, ir: 0.35, applicableMarkets: ['CRYPTO'] },
      { factorId: 'MACRO_INTEREST_RATE', factorName: 'Interest Rate Sensitivity', factorNameCn: '利率敏感度', domain: 'macro', oneLiner: '加息利好银行，降息利好科技地产', ic: 0.05, ir: 0.30, applicableMarkets: ['US', 'HK'] },
      { factorId: 'MACRO_INFLATION', factorName: 'Inflation Sensitivity', factorNameCn: '通胀敏感度', domain: 'macro', oneLiner: '高通胀利好商品和原材料股', ic: 0.04, ir: 0.22, applicableMarkets: ['US', 'HK'] },
    ];

    for (const b of builtIns) {
      this.listings.set(b.factorId, {
        listingId: `listing:builtin:${b.factorId}`,
        ...b,
        stars: Math.round((3 + b.ic * 30 + b.ir * 2) * 10) / 10,
        purchaseCount: Math.floor(Math.random() * 200) + 10,
        trialCount: Math.floor(Math.random() * 500) + 50,
        addedAt: Date.now() - 86400000 * 30, // 30 days ago
        updatedAt: Date.now(),
        creatorId: 'system',
        status: 'active',
        pricing: { buyoutPrice: 9.9, subscriptionIncluded: false, royaltyPercent: 80 },
      });
    }
  }

  private _userOwns(userId: string, factorId: string): boolean {
    return this.userPurchases.get(userId)?.has(factorId) ?? false;
  }

  private _getOwned(userId: string): string[] {
    return Array.from(this.userPurchases.get(userId) ?? []);
  }
}

// ── Singleton ───────────────────────────────────────────────────────────────

let instance: FactorMarketplaceBridge | null = null;

export function factorMarketplaceBridge(): FactorMarketplaceBridge {
  if (!instance) instance = new FactorMarketplaceBridge();
  return instance;
}

export function resetFactorMarketplaceBridge(): void { instance = null; }

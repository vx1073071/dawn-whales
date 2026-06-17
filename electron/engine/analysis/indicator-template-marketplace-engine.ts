// ── R270 JVS-2 指标模板市场引擎 (IndicatorTemplateMarketplaceEngine) ──
// 模板CRUD/评分/搜索/分类/交易/版本/评论

export interface IndicatorTemplate {
  id: string; name: string; description: string; authorId: string; authorName: string;
  category: string; tags: string[];
  indicators: IndicatorConfig[]; // the actual indicator definitions
  price: number; // USDT
  currency: 'USDT';
  version: number; createdAt: number; updatedAt: number;
  downloads: number; purchases: number; rating: number; ratingCount: number;
  status: 'draft' | 'published' | 'archived';
  thumbnail?: string; layout?: TemplateLayout;
}

export interface IndicatorConfig {
  type: string; // indicator type key
  params: Record<string, number | string>;
  pane: 'main' | 'sub1' | 'sub2' | 'sub3';
  visible: boolean;
  color?: string; lineWidth?: number; lineStyle?: 'solid' | 'dashed' | 'dotted';
}

export interface TemplateLayout {
  panes: number[]; // pane ratios
  crosshair?: { enabled: boolean; color?: string };
}

export interface TemplateReview {
  id: string; templateId: string; userId: string; userName: string;
  rating: number; comment: string; createdAt: number;
}

export interface MarketplaceConfig {
  platformFee: number; // 30% platform cut
  minPrice: number; maxPrice: number;
  featuredLimit: number;
}

const DEFAULT_MARKET_CONFIG: MarketplaceConfig = {
  platformFee: 0.3, minPrice: 1, maxPrice: 500, featuredLimit: 10,
};

// ═══════════════════════════════════════════════════════════
// Engine
// ═══════════════════════════════════════════════════════════

export class IndicatorTemplateMarketplaceEngine {
  private templates: Map<string, IndicatorTemplate> = new Map();
  private reviews: Map<string, TemplateReview[]> = new Map();
  private config: MarketplaceConfig;
  private purchases: Map<string, Set<string>> = new Map(); // userId → templateIds
  private creatorBalances: Map<string, number> = new Map(); // creatorId → earnings

  constructor(config?: Partial<MarketplaceConfig>) { this.config = { ...DEFAULT_MARKET_CONFIG, ...config }; }
  reset(): void { this.templates.clear(); this.reviews.clear(); this.purchases.clear(); this.creatorBalances.clear(); }

  // ═══════════ CRUD ═══════════

  create(authorId: string, authorName: string, data: Partial<IndicatorTemplate> & { name: string; description: string; category: string; indicators: IndicatorConfig[]; price: number }): IndicatorTemplate {
    const template: IndicatorTemplate = {
      id: crypto.randomUUID(), name: data.name, description: data.description,
      authorId, authorName, category: data.category, tags: data.tags || [],
      indicators: data.indicators, price: Math.min(this.config.maxPrice, Math.max(this.config.minPrice, data.price)),
      currency: 'USDT', version: 1, createdAt: Date.now(), updatedAt: Date.now(),
      downloads: 0, purchases: 0, rating: 0, ratingCount: 0,
      status: 'published', thumbnail: data.thumbnail, layout: data.layout,
    };
    this.templates.set(template.id, template);
    return template;
  }

  update(templateId: string, authorId: string, data: Partial<IndicatorTemplate>): IndicatorTemplate | null {
    const tmpl = this.templates.get(templateId);
    if (!tmpl || tmpl.authorId !== authorId) return null;
    Object.assign(tmpl, data, { updatedAt: Date.now(), version: tmpl.version + 1 });
    this.templates.set(templateId, tmpl);
    return tmpl;
  }

  delete(templateId: string, authorId: string): boolean {
    const tmpl = this.templates.get(templateId);
    if (!tmpl || tmpl.authorId !== authorId) return false;
    tmpl.status = 'archived'; this.templates.set(templateId, tmpl);
    return true;
  }

  get(templateId: string): IndicatorTemplate | undefined { return this.templates.get(templateId); }

  // ═══════════ Search ═══════════

  search(query: string, options?: { category?: string; tags?: string[]; minRating?: number; maxPrice?: number; sort?: 'popular' | 'rating' | 'newest' | 'price_asc' | 'price_desc'; page?: number; pageSize?: number }): { items: IndicatorTemplate[]; total: number; page: number; pages: number } {
    let results = [...this.templates.values()].filter((t) => t.status === 'published');
    if (query) { const q = query.toLowerCase(); results = results.filter((t) => t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q) || t.authorName.toLowerCase().includes(q) || t.tags.some((tag) => tag.toLowerCase().includes(q))); }
    if (options?.category) results = results.filter((t) => t.category === options.category);
    if (options?.tags?.length) results = results.filter((t) => options.tags!.some((tag) => t.tags.includes(tag)));
    if (options?.minRating) results = results.filter((t) => t.rating >= options.minRating!);
    if (options?.maxPrice) results = results.filter((t) => t.price <= options.maxPrice!);

    const sort = options?.sort || 'popular';
    results.sort((a, b) => {
      switch (sort) {
        case 'rating': return b.rating - a.rating;
        case 'newest': return b.createdAt - a.createdAt;
        case 'price_asc': return a.price - b.price;
        case 'price_desc': return b.price - a.price;
        default: return (b.downloads + b.purchases * 2) - (a.downloads + a.purchases * 2);
      }
    });

    const total = results.length;
    const pageSize = options?.pageSize || 20;
    const pages = Math.ceil(total / pageSize);
    const page = Math.min(options?.page || 1, Math.max(1, pages));
    return { items: results.slice((page - 1) * pageSize, page * pageSize), total, page, pages };
  }

  // ═══════════ Featured ═══════════

  getFeatured(): IndicatorTemplate[] {
    return [...this.templates.values()].filter((t) => t.status === 'published').sort((a, b) => (b.rating * b.ratingCount) - (a.rating * a.ratingCount)).slice(0, this.config.featuredLimit);
  }

  getByCategory(): Map<string, number> {
    const cats = new Map<string, number>();
    for (const t of this.templates.values()) { if (t.status === 'published') cats.set(t.category, (cats.get(t.category) || 0) + 1); }
    return cats;
  }

  // ═══════════ Purchase ═══════════

  purchase(templateId: string, userId: string): { success: boolean; template?: IndicatorTemplate; creatorRevenue?: number; platformRevenue?: number } {
    const tmpl = this.templates.get(templateId);
    if (!tmpl || tmpl.status !== 'published') return { success: false };

    // Check already purchased
    if (this.purchases.get(userId)?.has(templateId)) return { success: false };

    // Calculate revenue split
    const platformRevenue = Math.round(tmpl.price * this.config.platformFee * 100) / 100;
    const creatorRevenue = Math.round((tmpl.price - platformRevenue) * 100) / 100;

    // Record purchase
    if (!this.purchases.has(userId)) this.purchases.set(userId, new Set());
    this.purchases.get(userId)!.add(templateId);

    tmpl.purchases++;
    this.templates.set(templateId, tmpl);

    // Update creator balance
    this.creatorBalances.set(tmpl.authorId, (this.creatorBalances.get(tmpl.authorId) || 0) + creatorRevenue);

    return { success: true, template: tmpl, creatorRevenue, platformRevenue };
  }

  getUserTemplates(userId: string): IndicatorTemplate[] {
    const purchased = this.purchases.get(userId) || new Set();
    return [...this.templates.values()].filter((t) => purchased.has(t.id));
  }

  getCreatorTemplates(creatorId: string): IndicatorTemplate[] {
    return [...this.templates.values()].filter((t) => t.authorId === creatorId);
  }

  getCreatorBalance(creatorId: string): number { return this.creatorBalances.get(creatorId) || 0; }

  // ═══════════ Reviews ═══════════

  addReview(templateId: string, userId: string, userName: string, rating: number, comment: string): TemplateReview | null {
    const tmpl = this.templates.get(templateId);
    if (!tmpl || tmpl.status !== 'published') return null;
    const existing = (this.reviews.get(templateId) || []).find((r) => r.userId === userId);
    if (existing) return null;

    const review: TemplateReview = { id: crypto.randomUUID(), templateId, userId, userName, rating: Math.min(5, Math.max(1, Math.round(rating))), comment, createdAt: Date.now() };
    if (!this.reviews.has(templateId)) this.reviews.set(templateId, []);
    this.reviews.get(templateId)!.push(review);

    // Update template rating
    const allReviews = this.reviews.get(templateId)!;
    tmpl.rating = allReviews.reduce((s, r) => s + r.rating, 0) / allReviews.length;
    tmpl.ratingCount = allReviews.length;
    this.templates.set(templateId, tmpl);

    return review;
  }

  getReviews(templateId: string, page = 1, pageSize = 10): { reviews: TemplateReview[]; total: number; pages: number } {
    const all = this.reviews.get(templateId) || [];
    const total = all.length;
    const pages = Math.ceil(total / pageSize);
    return { reviews: all.slice((page - 1) * pageSize, page * pageSize), total, pages };
  }

  // ═══════════ Categories & Tags ═══════════

  getCategories(): string[] { const cats = new Set<string>(); for (const t of this.templates.values()) { if (t.status === 'published') cats.add(t.category); } return [...cats]; }

  getPopularTags(limit = 20): { tag: string; count: number }[] {
    const tagCount = new Map<string, number>();
    for (const t of this.templates.values()) { if (t.status !== 'published') continue; for (const tag of t.tags) tagCount.set(tag, (tagCount.get(tag) || 0) + 1); }
    return [...tagCount.entries()].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count).slice(0, limit);
  }

  // ═══════════ Download (apply template) ═══════════

  download(templateId: string, userId: string): IndicatorTemplate | null {
    const tmpl = this.templates.get(templateId);
    if (!tmpl || tmpl.status !== 'published') return null;
    // Check if user has purchased
    if (tmpl.price > 0 && !this.purchases.get(userId)?.has(templateId)) return null;
    tmpl.downloads++;
    this.templates.set(templateId, tmpl);
    return tmpl;
  }

  // ═══════════ Marketplace Stats ═══════════

  stats(): {
    totalTemplates: number; publishedCount: number;
    totalPurchases: number; totalRevenue: number; platformRevenue: number;
    topCreators: { authorId: string; authorName: string; revenue: number }[];
    topTemplates: { id: string; name: string; purchases: number; rating: number }[];
  } {
    const published = [...this.templates.values()].filter((t) => t.status === 'published');
    const totalPurchases = published.reduce((s, t) => s + t.purchases, 0);
    const totalRevenue = published.reduce((s, t) => s + t.price * t.purchases, 0);
    const platformRevenue = Math.round(totalRevenue * this.config.platformFee * 100) / 100;

    const creatorMap = new Map<string, { name: string; revenue: number }>();
    for (const t of published) {
      const existing = creatorMap.get(t.authorId) || { name: t.authorName, revenue: 0 };
      existing.revenue += t.price * t.purchases * (1 - this.config.platformFee);
      creatorMap.set(t.authorId, existing);
    }
    const topCreators = [...creatorMap.entries()].map(([id, data]) => ({ authorId: id, authorName: data.name, revenue: Math.round(data.revenue * 100) / 100 })).sort((a, b) => b.revenue - a.revenue).slice(0, 10);

    const topTemplates = published.map((t) => ({ id: t.id, name: t.name, purchases: t.purchases, rating: t.rating })).sort((a, b) => b.purchases - a.purchases).slice(0, 10);

    return { totalTemplates: this.templates.size, publishedCount: published.length, totalPurchases, totalRevenue, platformRevenue, topCreators, topTemplates };
  }

  // ═══════════ Seed demo data ═══════════

  seedDemo(creatorId: string, creatorName: string): IndicatorTemplate[] {
    const demos = [
      { name: 'MACD趋势黄金组合', desc: 'MACD + EMA 多周期共振', cat: '趋势', tags: ['MACD', 'EMA', '趋势', '多周期'], indicators: [{ type: 'MACD', params: { fast: 12, slow: 26, signal: 9 }, pane: 'sub1', visible: true }, { type: 'EMA', params: { period: 50 }, pane: 'main', visible: true }], price: 5 },
      { name: '成交量超级组合', desc: 'VWAP + VFI + VolumeOsc 三重验证', cat: '成交量', tags: ['成交量', 'VWAP', 'VFI'], indicators: [{ type: 'VWAP', params: {}, pane: 'main', visible: true }, { type: 'VFI', params: {}, pane: 'sub1', visible: true }], price: 3 },
    ];
    return demos.map((d) => this.create(creatorId, creatorName, d));
  }
}

// ═══════════ Singleton ═══════════

let itmInstance: IndicatorTemplateMarketplaceEngine | null = null;
export function getIndicatorTemplateMarketplaceEngine(config?: Partial<MarketplaceConfig>): IndicatorTemplateMarketplaceEngine {
  if (!itmInstance) itmInstance = new IndicatorTemplateMarketplaceEngine(config);
  return itmInstance;
}
export function resetIndicatorTemplateMarketplaceEngine(): void { itmInstance = null; }

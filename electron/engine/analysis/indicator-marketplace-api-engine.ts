// ── R271 JVS-3 指标模板市场API引擎 (IndicatorMarketplaceAPIEngine) ──
// 服务器端市场引擎: REST endpoints建模 + 数据持久化 + 交易结算 + 内容审核

export interface MarketplaceUser {
  id: string; name: string; email?: string;
  walletBalance: number; // USDT
  role: 'user' | 'creator' | 'admin';
  createdAt: number;
}

export interface TemplateRecord {
  id: string; name: string; description: string;
  authorId: string; authorName: string;
  category: string; tags: string[];
  indicators: IndicatorConfigRecord[];
  price: number; currency: 'USDT';
  version: number; createdAt: number; updatedAt: number;
  downloads: number; purchases: number; rating: number; ratingCount: number;
  status: 'draft' | 'pending_review' | 'published' | 'rejected' | 'archived';
  approvalNote?: string; approvedBy?: string; approvedAt?: number;
  thumbnail?: string; layout?: unknown;
}

export interface IndicatorConfigRecord {
  type: string; params: Record<string, number | string>;
  pane: string; visible: boolean;
  color?: string; lineWidth?: number; lineStyle?: string;
}

export interface PurchaseRecord {
  id: string; templateId: string; templateName: string;
  buyerId: string; buyerName: string;
  creatorId: string; creatorName: string;
  price: number; platformFee: number; creatorRevenue: number;
  status: 'pending' | 'completed' | 'refunded';
  txId?: string; // payment transaction ID
  createdAt: number; completedAt?: number;
}

export interface ReviewRecord {
  id: string; templateId: string; userId: string; userName: string;
  rating: number; comment: string; likes: number; reported: boolean;
  createdAt: number;
}

export interface APIResponse<T = unknown> {
  success: boolean; data?: T; error?: string; message?: string;
  pagination?: { page: number; pageSize: number; total: number; pages: number };
}

export interface MarketplaceConfigAPI {
  platformFee: number; // % as decimal (0.3 = 30%)
  minPrice: number; maxPrice: number;
  minWithdrawal: number; // USDT
  moderationRequired: boolean;
  featuredLimit: number;
  reviewMinChars: number; reviewMaxChars: number;
}

const DEFAULT_API_CONFIG: MarketplaceConfigAPI = {
  platformFee: 0.3, minPrice: 1, maxPrice: 500,
  minWithdrawal: 10, moderationRequired: true, featuredLimit: 10,
  reviewMinChars: 10, reviewMaxChars: 500,
};

// ═══════════════════════════════════════════════════════════
// Data Store (in-memory for development; production = PostgreSQL)
// ═══════════════════════════════════════════════════════════

class MarketStore {
  users = new Map<string, MarketplaceUser>();
  templates = new Map<string, TemplateRecord>();
  purchases = new Map<string, PurchaseRecord[]>();
  reviews = new Map<string, ReviewRecord[]>();

  // user → purchased template IDs
  userPurchases = new Map<string, Set<string>>();
}

// ═══════════════════════════════════════════════════════════
// Engine
// ═══════════════════════════════════════════════════════════

export class IndicatorMarketplaceAPIEngine {
  private store = new MarketStore();
  private config: MarketplaceConfigAPI;

  constructor(config?: Partial<MarketplaceConfigAPI>) { this.config = { ...DEFAULT_API_CONFIG, ...config }; }

  reset(): void { this.store = new MarketStore(); }

  // ═══════════ Template CRUD Endpoints ═══════════

  /** POST /api/marketplace/templates */
  createTemplate(authorId: string, authorName: string, data: {
    name: string; description: string; category: string; tags?: string[];
    indicators: IndicatorConfigRecord[]; price: number; thumbnail?: string;
  }): APIResponse<TemplateRecord> {
    if (data.price < this.config.minPrice || data.price > this.config.maxPrice) {
      return { success: false, error: `Price must be ${this.config.minPrice}-${this.config.maxPrice} USDT` };
    }
    if (!data.name || !data.description || !data.category || !data.indicators?.length) {
      return { success: false, error: 'Missing required fields: name, description, category, indicators' };
    }

    const template: TemplateRecord = {
      id: crypto.randomUUID(), name: data.name, description: data.description,
      authorId, authorName, category: data.category, tags: data.tags || [],
      indicators: data.indicators, price: data.price, currency: 'USDT',
      version: 1, createdAt: Date.now(), updatedAt: Date.now(),
      downloads: 0, purchases: 0, rating: 0, ratingCount: 0,
      status: this.config.moderationRequired ? 'pending_review' : 'published',
      thumbnail: data.thumbnail,
    };

    this.store.templates.set(template.id, template);
    return { success: true, data: template, message: this.config.moderationRequired ? 'Template submitted for review' : 'Template published' };
  }

  /** PUT /api/marketplace/templates/:id */
  updateTemplate(templateId: string, authorId: string, data: Partial<TemplateRecord>): APIResponse<TemplateRecord> {
    const tmpl = this.store.templates.get(templateId);
    if (!tmpl) return { success: false, error: 'Template not found' };
    if (tmpl.authorId !== authorId) return { success: false, error: 'Not authorized' };
    if (tmpl.status === 'rejected') return { success: false, error: 'Cannot update rejected template — create new' };

    const allowedFields: (keyof TemplateRecord)[] = ['name', 'description', 'category', 'tags', 'indicators', 'price', 'thumbnail'];
    for (const key of allowedFields) {
      if (data[key] !== undefined) (tmpl as any)[key] = data[key];
    }
    tmpl.version++; tmpl.updatedAt = Date.now();
    if (this.config.moderationRequired) tmpl.status = 'pending_review';

    this.store.templates.set(templateId, tmpl);
    return { success: true, data: tmpl };
  }

  /** DELETE /api/marketplace/templates/:id */
  deleteTemplate(templateId: string, authorId: string): APIResponse<null> {
    const tmpl = this.store.templates.get(templateId);
    if (!tmpl) return { success: false, error: 'Template not found' };
    if (tmpl.authorId !== authorId) return { success: false, error: 'Not authorized' };
    tmpl.status = 'archived';
    this.store.templates.set(templateId, tmpl);
    return { success: true, message: 'Template archived' };
  }

  /** GET /api/marketplace/templates/:id */
  getTemplate(templateId: string): APIResponse<TemplateRecord> {
    const tmpl = this.store.templates.get(templateId);
    if (!tmpl) return { success: false, error: 'Template not found' };
    return { success: true, data: tmpl };
  }

  // ═══════════ Search Endpoints ═══════════

  /** GET /api/marketplace/search?q=...&category=...&sort=... */
  search(query: string, options?: {
    category?: string; tags?: string[]; minRating?: number; maxPrice?: number;
    sort?: 'popular' | 'rating' | 'newest' | 'price_asc' | 'price_desc';
    page?: number; pageSize?: number;
  }): APIResponse<TemplateRecord[]> {
    let results = [...this.store.templates.values()].filter((t) => t.status === 'published');
    if (query) {
      const q = query.toLowerCase();
      results = results.filter((t) => t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q) || t.tags.some((tag) => tag.toLowerCase().includes(q)));
    }
    if (options?.category) results = results.filter((t) => t.category === options.category);
    if (options?.tags?.length) results = results.filter((t) => options.tags!.some((tag) => t.tags.includes(tag)));
    if (options?.minRating) results = results.filter((t) => t.rating >= options.minRating!);
    if (options?.maxPrice) results = results.filter((t) => t.price <= options.maxPrice!);

    const sort = options?.sort || 'popular';
    results.sort((a, b) => {
      switch (sort) { case 'rating': return b.rating - a.rating; case 'newest': return b.createdAt - a.createdAt; case 'price_asc': return a.price - b.price; case 'price_desc': return b.price - a.price; default: return (b.downloads + b.purchases * 2) - (a.downloads + a.purchases * 2); }
    });

    const total = results.length;
    const pageSize = options?.pageSize || 20;
    const pages = Math.ceil(total / pageSize);
    const page = Math.min(options?.page || 1, pages || 1);
    results = results.slice((page - 1) * pageSize, page * pageSize);

    return { success: true, data: results, pagination: { page, pageSize, total, pages } };
  }

  /** GET /api/marketplace/featured */
  getFeatured(): APIResponse<TemplateRecord[]> {
    const featured = [...this.store.templates.values()].filter((t) => t.status === 'published').sort((a, b) => (b.rating * b.ratingCount) - (a.rating * a.ratingCount)).slice(0, this.config.featuredLimit);
    return { success: true, data: featured };
  }

  /** GET /api/marketplace/categories */
  getCategories(): APIResponse<string[]> {
    const cats = new Set<string>();
    for (const t of this.store.templates.values()) { if (t.status === 'published') cats.add(t.category); }
    return { success: true, data: [...cats] };
  }

  // ═══════════ Purchase Endpoints ═══════════

  /** POST /api/marketplace/purchase */
  purchase(templateId: string, buyerId: string, buyerName: string): APIResponse<PurchaseRecord> {
    if (!this.store.users.has(buyerId)) return { success: false, error: 'User not found' };

    const tmpl = this.store.templates.get(templateId);
    if (!tmpl || tmpl.status !== 'published') return { success: false, error: 'Template not available' };
    if (tmpl.authorId === buyerId) return { success: false, error: 'Cannot purchase your own template' };

    // Check duplicate
    if (this.store.userPurchases.get(buyerId)?.has(templateId)) return { success: false, error: 'Already purchased' };

    const buyer = this.store.users.get(buyerId)!;
    if (buyer.walletBalance < tmpl.price) return { success: false, error: `Insufficient balance: need ${tmpl.price} USDT, have ${buyer.walletBalance}` };

    // Deduct
    const platformRevenue = Math.round(tmpl.price * this.config.platformFee * 100) / 100;
    const creatorRevenue = Math.round((tmpl.price - platformRevenue) * 100) / 100;
    buyer.walletBalance -= tmpl.price;
    this.store.users.set(buyerId, buyer);

    // Credit creator
    const creator = this.store.users.get(tmpl.authorId);
    if (creator) { creator.walletBalance += creatorRevenue; this.store.users.set(tmpl.authorId, creator); }

    const purchase: PurchaseRecord = {
      id: crypto.randomUUID(), templateId, templateName: tmpl.name,
      buyerId, buyerName, creatorId: tmpl.authorId, creatorName: tmpl.authorName,
      price: tmpl.price, platformFee: platformRevenue, creatorRevenue,
      status: 'completed', createdAt: Date.now(), completedAt: Date.now(),
    };

    if (!this.store.purchases.has(templateId)) this.store.purchases.set(templateId, []);
    this.store.purchases.get(templateId)!.push(purchase);

    if (!this.store.userPurchases.has(buyerId)) this.store.userPurchases.set(buyerId, new Set());
    this.store.userPurchases.get(buyerId)!.add(templateId);

    tmpl.purchases++; this.store.templates.set(templateId, tmpl);

    return { success: true, data: purchase, message: 'Purchase completed' };
  }

  /** GET /api/marketplace/purchases/:userId */
  getUserPurchases(userId: string): APIResponse<PurchaseRecord[]> {
    const all: PurchaseRecord[] = [];
    for (const [, records] of this.store.purchases) { all.push(...records.filter((r) => r.buyerId === userId)); }
    return { success: true, data: all };
  }

  /** GET /api/marketplace/library/:userId */
  getLibrary(userId: string): APIResponse<TemplateRecord[]> {
    const purchased = this.store.userPurchases.get(userId) || new Set();
    const templates = [...this.store.templates.values()].filter((t) => purchased.has(t.id));
    return { success: true, data: templates };
  }

  // ═══════════ Review Endpoints ═══════════

  /** POST /api/marketplace/reviews */
  addReview(templateId: string, userId: string, userName: string, rating: number, comment: string): APIResponse<ReviewRecord> {
    const tmpl = this.store.templates.get(templateId);
    if (!tmpl || tmpl.status !== 'published') return { success: false, error: 'Template not available' };
    if (!this.store.userPurchases.get(userId)?.has(templateId)) return { success: false, error: 'Must purchase before reviewing' };

    const existing = (this.store.reviews.get(templateId) || []).find((r) => r.userId === userId);
    if (existing) return { success: false, error: 'Already reviewed' };

    if (comment.length < this.config.reviewMinChars || comment.length > this.config.reviewMaxChars) {
      return { success: false, error: `Review must be ${this.config.reviewMinChars}-${this.config.reviewMaxChars} characters` };
    }

    const review: ReviewRecord = { id: crypto.randomUUID(), templateId, userId, userName, rating: Math.min(5, Math.max(1, Math.round(rating))), comment, likes: 0, reported: false, createdAt: Date.now() };

    if (!this.store.reviews.has(templateId)) this.store.reviews.set(templateId, []);
    this.store.reviews.get(templateId)!.push(review);

    const all = this.store.reviews.get(templateId)!;
    tmpl.rating = all.reduce((s, r) => s + r.rating, 0) / all.length;
    tmpl.ratingCount = all.length;
    this.store.templates.set(templateId, tmpl);

    return { success: true, data: review };
  }

  /** GET /api/marketplace/reviews/:templateId?page=1 */
  getReviews(templateId: string, page = 1, pageSize = 10): APIResponse<ReviewRecord[]> {
    const all = this.store.reviews.get(templateId) || [];
    const total = all.length;
    const pages = Math.ceil(total / pageSize);
    const data = all.slice((page - 1) * pageSize, page * pageSize);
    return { success: true, data, pagination: { page, pageSize, total, pages } };
  }

  // ═══════════ Moderation Endpoints ═══════════

  /** POST /api/admin/marketplace/approve/:templateId */
  approveTemplate(templateId: string, adminId: string): APIResponse<TemplateRecord> {
    const tmpl = this.store.templates.get(templateId);
    if (!tmpl) return { success: false, error: 'Template not found' };
    if (tmpl.status !== 'pending_review') return { success: false, error: 'Not pending review' };
    tmpl.status = 'published'; tmpl.approvedBy = adminId; tmpl.approvedAt = Date.now();
    this.store.templates.set(templateId, tmpl);
    return { success: true, data: tmpl };
  }

  /** POST /api/admin/marketplace/reject/:templateId */
  rejectTemplate(templateId: string, adminId: string, note: string): APIResponse<TemplateRecord> {
    const tmpl = this.store.templates.get(templateId);
    if (!tmpl) return { success: false, error: 'Template not found' };
    if (tmpl.status !== 'pending_review') return { success: false, error: 'Not pending review' };
    tmpl.status = 'rejected'; tmpl.approvalNote = note; tmpl.approvedBy = adminId; tmpl.approvedAt = Date.now();
    this.store.templates.set(templateId, tmpl);
    return { success: true, data: tmpl };
  }

  // ═══════════ Creator Dashboard ═══════════

  /** GET /api/creator/dashboard/:creatorId */
  getCreatorDashboard(creatorId: string): APIResponse<{
    templates: TemplateRecord[];
    totalRevenue: number; totalPurchases: number;
    pendingWithdrawal: number;
    reviews: ReviewRecord[];
  }> {
    const templates = [...this.store.templates.values()].filter((t) => t.authorId === creatorId);
    let totalRevenue = 0; let totalPurchases = 0;
    const allReviews: ReviewRecord[] = [];
    for (const t of templates) {
      totalPurchases += t.purchases;
      totalRevenue += t.purchases * t.price * (1 - this.config.platformFee);
      const reviews = this.store.reviews.get(t.id) || [];
      allReviews.push(...reviews);
    }
    return {
      success: true,
      data: { templates, totalRevenue: Math.round(totalRevenue * 100) / 100, totalPurchases, pendingWithdrawal: 0, reviews: allReviews },
    };
  }

  // ═══════════ Marketplace Admin Stats ═══════════

  /** GET /api/admin/marketplace/stats */
  getAdminStats(): APIResponse<{
    totalTemplates: number; publishedTemplates: number; pendingReview: number;
    totalPurchases: number; totalRevenue: number; platformRevenue: number;
    topCreators: { authorId: string; authorName: string; revenue: number; templates: number }[];
    topTemplates: { id: string; name: string; purchases: number; rating: number }[];
    categoryDistribution: Record<string, number>;
  }> {
    const published = [...this.store.templates.values()].filter((t) => t.status === 'published');
    const pending = [...this.store.templates.values()].filter((t) => t.status === 'pending_review');

    const creatorMap = new Map<string, { name: string; revenue: number; templates: number }>();
    for (const t of published) {
      const entry = creatorMap.get(t.authorId) || { name: t.authorName, revenue: 0, templates: 0 };
      entry.revenue += t.price * t.purchases * (1 - this.config.platformFee);
      entry.templates++;
      creatorMap.set(t.authorId, entry);
    }

    const categoryDist: Record<string, number> = {};
    for (const t of published) { categoryDist[t.category] = (categoryDist[t.category] || 0) + 1; }

    const topCreators = [...creatorMap.entries()].map(([id, d]) => ({ authorId: id, authorName: d.name, revenue: Math.round(d.revenue * 100) / 100, templates: d.templates })).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
    const topTemplates = published.map((t) => ({ id: t.id, name: t.name, purchases: t.purchases, rating: t.rating })).sort((a, b) => b.purchases - a.purchases).slice(0, 10);

    return {
      success: true,
      data: {
        totalTemplates: this.store.templates.size,
        publishedTemplates: published.length,
        pendingReview: pending.length,
        totalPurchases: published.reduce((s, t) => s + t.purchases, 0),
        totalRevenue: published.reduce((s, t) => s + t.price * t.purchases, 0),
        platformRevenue: published.reduce((s, t) => s + t.price * t.purchases * this.config.platformFee, 0),
        topCreators, topTemplates, categoryDistribution: categoryDist,
      },
    };
  }

  // ═══════════ User Management (for testing) ═══════════

  createUser(id: string, name: string, balance = 1000, role: MarketplaceUser['role'] = 'user'): MarketplaceUser {
    const user: MarketplaceUser = { id, name, walletBalance: balance, role, createdAt: Date.now() };
    this.store.users.set(id, user);
    return user;
  }

  getUser(id: string): MarketplaceUser | undefined { return this.store.users.get(id); }

  // ═══════════ Seed ═══════════

  seed(creatorId: string, creatorName: string): APIResponse<TemplateRecord[]> {
    const demos = [
      { name: 'MACD+EMA Pro', desc: '双线趋势确认，多周期共振', cat: '趋势', tags: ['MACD', 'EMA'], indicators: [{ type: 'MACD', params: { fast: 12, slow: 26, signal: 9 }, pane: 'sub1', visible: true }], price: 8 },
      { name: 'Bollinger Band Scalping', desc: '快速逃顶抄底+窄幅突破', cat: '波动', tags: ['BOLL', 'scalping'], indicators: [{ type: 'BOLL', params: { period: 20, deviation: 2 }, pane: 'main', visible: true }], price: 5 },
      { name: 'Volume Surge Detector', desc: '放量暴涨+缩量下杀检测', cat: '成交量', tags: ['volume', 'surge'], indicators: [{ type: 'VFI', params: {}, pane: 'sub1', visible: true }], price: 3 },
    ];
    const created = demos.map((d) => {
      const result = this.createTemplate(creatorId, creatorName, d);
      return result.data!;
    });
    return { success: true, data: created };
  }
}

// ═══════════ Singleton ═══════════

let imaInstance: IndicatorMarketplaceAPIEngine | null = null;
export function getIndicatorMarketplaceAPIEngine(config?: Partial<MarketplaceConfigAPI>): IndicatorMarketplaceAPIEngine {
  if (!imaInstance) imaInstance = new IndicatorMarketplaceAPIEngine(config);
  return imaInstance;
}
export function resetIndicatorMarketplaceAPIEngine(): void { imaInstance = null; }

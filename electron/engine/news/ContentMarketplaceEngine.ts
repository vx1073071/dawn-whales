/**
 * ContentMarketplaceEngine — R246 P1-02
 * 
 * 内容市场后端引擎。管理创作者内容的完整生命周期：
 * 上架/下架、评分与评论、全文搜索、个性化推荐、
 * 创作者等级集成、分类浏览、购买与下载统计。
 * 
 * Pricing: 内容定价由创作者设定，平台提成按创作者等级
 *   L1: 30% | L2: 20% | L3: 10% 平台提成
 */

import log from 'electron-log';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export type ContentType = 'strategy' | 'indicator' | 'template' | 'report' | 'course';
export type ContentStatus = 'draft' | 'published' | 'archived' | 'suspended';
export type CreatorLevel = 'L1' | 'L2' | 'L3';

export interface ContentItem {
  /** Unique content ID */
  id: string;
  /** Creator user ID */
  creatorId: string;
  /** Creator display name */
  creatorName: string;
  /** Creator level */
  creatorLevel: CreatorLevel;
  /** Content title */
  title: string;
  /** Content description */
  description: string;
  /** Content type */
  type: ContentType;
  /** Categories */
  categories: string[];
  /** Tags for search */
  tags: string[];
  /** Price in USDT */
  price: number;
  /** Platform commission rate (0.1-0.3) */
  commissionRate: number;
  /** Thumbnail URL */
  thumbnailUrl?: string;
  /** Content file URL */
  fileUrl?: string;
  /** Current status */
  status: ContentStatus;
  /** Version */
  version: string;
  /** Created timestamp */
  createdAt: number;
  /** Updated timestamp */
  updatedAt: number;
  /** Published timestamp */
  publishedAt?: number;
  /** Total sales count */
  salesCount: number;
  /** Total revenue earned (creator share) */
  totalRevenue: number;
  /** Average rating 1-5 */
  avgRating: number;
  /** Number of ratings */
  ratingCount: number;
  /** Number of reviews */
  reviewCount: number;
  /** View count */
  viewCount: number;
  /** Download count */
  downloadCount: number;
  /** Supported markets */
  markets: string[];
  /** Language */
  language: string;
}

export interface ContentReview {
  /** Review ID */
  id: string;
  /** Content ID */
  contentId: string;
  /** Reviewer user ID */
  reviewerId: string;
  /** Reviewer name */
  reviewerName: string;
  /** Rating 1-5 */
  rating: number;
  /** Review text */
  text: string;
  /** Created at */
  createdAt: number;
  /** Helpful vote count */
  helpfulCount: number;
}

export interface SearchQuery {
  /** Search keywords */
  keywords?: string;
  /** Filter by type */
  type?: ContentType;
  /** Filter by categories */
  categories?: string[];
  /** Filter by tags */
  tags?: string[];
  /** Filter by creator level */
  creatorLevel?: CreatorLevel;
  /** Price range */
  priceMin?: number;
  priceMax?: number;
  /** Minimum rating */
  minRating?: number;
  /** Markets filter */
  markets?: string[];
  /** Language filter */
  language?: string;
  /** Sort field */
  sortBy?: 'relevance' | 'rating' | 'sales' | 'price' | 'newest' | 'popular';
  /** Sort direction */
  sortOrder?: 'asc' | 'desc';
  /** Pagination */
  page?: number;
  pageSize?: number;
}

export interface SearchResult {
  /** Matching items */
  items: ContentItem[];
  /** Total matches */
  total: number;
  /** Current page */
  page: number;
  /** Page size */
  pageSize: number;
  /** Total pages */
  totalPages: number;
  /** Search query echo */
  query: SearchQuery;
}

export interface RecommendationRequest {
  /** Target user ID */
  userId: string;
  /** User's watchlist symbols (for relevance) */
  symbols?: string[];
  /** User's preferred markets */
  markets?: string[];
  /** Exclude content IDs (already purchased) */
  excludeIds?: string[];
  /** Maximum results */
  limit?: number;
}

export interface CreatorStats {
  /** Creator user ID */
  creatorId: string;
  /** Creator level */
  level: CreatorLevel;
  /** Total published content */
  totalContent: number;
  /** Total sales */
  totalSales: number;
  /** Total revenue (creator share) */
  totalRevenue: number;
  /** Platform commission earned */
  totalCommission: number;
  /** Average rating across all content */
  avgRating: number;
  /** Total reviews received */
  totalReviews: number;
}

// ═══════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════

/** Platform commission rates by creator level */
const COMMISSION_RATES: Record<CreatorLevel, number> = {
  L1: 0.30,
  L2: 0.20,
  L3: 0.10,
};

/** Default page size */
const DEFAULT_PAGE_SIZE = 20;

/** Max page size */
const MAX_PAGE_SIZE = 100;

/** Minimum price allowed */
const MIN_PRICE = 0.99;

// ═══════════════════════════════════════════════════════════════
// Engine
// ═══════════════════════════════════════════════════════════════

export class ContentMarketplaceEngine {
  private static instance: ContentMarketplaceEngine;

  /** Content store (keyed by id) */
  private content: Map<string, ContentItem> = new Map();
  /** Reviews store */
  private reviews: Map<string, ContentReview[]> = new Map();
  /** Tag index: tag → content IDs */
  private tagIndex: Map<string, Set<string>> = new Map();
  /** Category index: category → content IDs */
  private categoryIndex: Map<string, Set<string>> = new Map();
  /** ID counter */
  private idCounter = 0;

  private constructor() {}

  static getInstance(): ContentMarketplaceEngine {
    if (!ContentMarketplaceEngine.instance) {
      ContentMarketplaceEngine.instance = new ContentMarketplaceEngine();
    }
    return ContentMarketplaceEngine.instance;
  }

  // ═════════════════════════════════════════════════════════
  // Content Publishing
  // ═════════════════════════════════════════════════════════

  /**
   * Publish (list) new content to the marketplace.
   */
  publish(params: {
    creatorId: string; creatorName: string; creatorLevel: CreatorLevel;
    title: string; description: string; type: ContentType;
    categories: string[]; tags: string[]; price: number;
    thumbnailUrl?: string; fileUrl?: string;
    markets?: string[]; language?: string;
  }): ContentItem {
    this.idCounter++;
    const now = Date.now();
    const price = Math.max(MIN_PRICE, Math.round(params.price * 100) / 100);

    const item: ContentItem = {
      id: `content-${this.idCounter}`,
      creatorId: params.creatorId,
      creatorName: params.creatorName,
      creatorLevel: params.creatorLevel,
      title: params.title,
      description: params.description,
      type: params.type,
      categories: params.categories,
      tags: params.tags.map(t => t.toLowerCase()),
      price,
      commissionRate: COMMISSION_RATES[params.creatorLevel],
      thumbnailUrl: params.thumbnailUrl,
      fileUrl: params.fileUrl,
      status: 'published',
      version: '1.0.0',
      createdAt: now,
      updatedAt: now,
      publishedAt: now,
      salesCount: 0,
      totalRevenue: 0,
      avgRating: 0,
      ratingCount: 0,
      reviewCount: 0,
      viewCount: 0,
      downloadCount: 0,
      markets: params.markets || ['US', 'HK', 'CRYPTO'],
      language: params.language || 'en',
    };

    this.content.set(item.id, item);
    this.indexItem(item);

    log.info(`[ContentMarketplace] Published: ${item.id} "${item.title}" by ${item.creatorName}`);
    return item;
  }

  /**
   * Unpublish (delist) content.
   */
  unpublish(contentId: string): boolean {
    const item = this.content.get(contentId);
    if (!item) return false;
    item.status = 'archived';
    item.updatedAt = Date.now();
    return true;
  }

  /**
   * Suspend content (admin action).
   */
  suspend(contentId: string, reason?: string): boolean {
    const item = this.content.get(contentId);
    if (!item) return false;
    item.status = 'suspended';
    item.updatedAt = Date.now();
    log.info(`[ContentMarketplace] Suspended ${contentId}: ${reason || 'no reason'}`);
    return true;
  }

  /**
   * Update content metadata.
   */
  update(contentId: string, updates: Partial<Pick<ContentItem,
    'title' | 'description' | 'price' | 'categories' | 'tags' |
    'thumbnailUrl' | 'fileUrl' | 'version'
  >>): ContentItem | null {
    const item = this.content.get(contentId);
    if (!item || item.status !== 'published') return null;

    const oldTags = item.tags;
    const oldCats = item.categories;

    Object.assign(item, updates, { updatedAt: Date.now() });

    // Rebuild indices if tags/categories changed
    if (updates.tags && JSON.stringify(updates.tags) !== JSON.stringify(oldTags)) {
      this.reindexItemTags(item, oldTags);
    }
    if (updates.categories && JSON.stringify(updates.categories) !== JSON.stringify(oldCats)) {
      this.reindexItemCategories(item, oldCats);
    }

    return item;
  }

  // ═════════════════════════════════════════════════════════
  // Ratings & Reviews
  // ═════════════════════════════════════════════════════════

  /**
   * Add or update a rating + review.
   */
  rate(contentId: string, params: {
    reviewerId: string; reviewerName: string;
    rating: number; text?: string;
  }): ContentReview {
    const item = this.content.get(contentId);
    if (!item) throw new Error(`Content ${contentId} not found`);

    const rating = Math.max(1, Math.min(5, Math.round(params.rating)));
    const review: ContentReview = {
      id: `review-${contentId}-${params.reviewerId}`,
      contentId,
      reviewerId: params.reviewerId,
      reviewerName: params.reviewerName,
      rating,
      text: params.text || '',
      createdAt: Date.now(),
      helpfulCount: 0,
    };

    // Store review
    if (!this.reviews.has(contentId)) {
      this.reviews.set(contentId, []);
    }
    const reviews = this.reviews.get(contentId)!;
    const existingIdx = reviews.findIndex(r => r.reviewerId === params.reviewerId);
    if (existingIdx >= 0) {
      // Update existing review - adjust rating
      const oldRating = reviews[existingIdx].rating;
      reviews[existingIdx] = review;
      // Recalculate avg: remove oldRating, add new rating (which is already in the array now)
      const totalRating = reviews.reduce((s, r) => s + r.rating, 0);
      item.avgRating = Math.round((totalRating / reviews.length) * 10) / 10;
    } else {
      reviews.push(review);
      item.reviewCount = reviews.length;
      item.ratingCount++;
      const total = reviews.reduce((s, r) => s + r.rating, 0);
      item.avgRating = Math.round((total / reviews.length) * 10) / 10;
    }

    log.info(`[ContentMarketplace] ${params.reviewerName} rated ${contentId}: ${rating}/5`);
    return review;
  }

  /**
   * Get reviews for content.
   */
  getReviews(contentId: string, page: number = 1, pageSize: number = 20): {
    reviews: ContentReview[]; total: number;
  } {
    const all = this.reviews.get(contentId) || [];
    const sorted = all.sort((a, b) => b.createdAt - a.createdAt);
    const start = (page - 1) * pageSize;
    return {
      reviews: sorted.slice(start, start + pageSize),
      total: all.length,
    };
  }

  /**
   * Mark a review as helpful.
   */
  markHelpful(reviewId: string): boolean {
    for (const [, reviews] of this.reviews) {
      const r = reviews.find(rv => rv.id === reviewId);
      if (r) {
        r.helpfulCount++;
        return true;
      }
    }
    return false;
  }

  // ═════════════════════════════════════════════════════════
  // Search
  // ═════════════════════════════════════════════════════════

  /**
   * Search marketplace content.
   */
  search(query: SearchQuery): SearchResult {
    const page = query.page || 1;
    const pageSize = Math.min(MAX_PAGE_SIZE, query.pageSize || DEFAULT_PAGE_SIZE);

    // Start with all published content
    let candidates = Array.from(this.content.values())
      .filter(c => c.status === 'published');

    // Keyword search (title, description, tags)
    if (query.keywords) {
      const kw = query.keywords.toLowerCase();
      candidates = candidates.filter(c =>
        c.title.toLowerCase().includes(kw) ||
        c.description.toLowerCase().includes(kw) ||
        c.tags.some(t => t.includes(kw))
      );
    }

    // Type filter
    if (query.type) {
      candidates = candidates.filter(c => c.type === query.type);
    }

    // Category filter
    if (query.categories && query.categories.length > 0) {
      candidates = candidates.filter(c =>
        c.categories.some(cat => query.categories!.includes(cat))
      );
    }

    // Tag filter
    if (query.tags && query.tags.length > 0) {
      candidates = candidates.filter(c =>
        c.tags.some(t => query.tags!.includes(t))
      );
    }

    // Creator level filter
    if (query.creatorLevel) {
      candidates = candidates.filter(c => c.creatorLevel === query.creatorLevel);
    }

    // Price range
    if (query.priceMin !== undefined) {
      candidates = candidates.filter(c => c.price >= query.priceMin!);
    }
    if (query.priceMax !== undefined) {
      candidates = candidates.filter(c => c.price <= query.priceMax!);
    }

    // Min rating
    if (query.minRating !== undefined) {
      candidates = candidates.filter(c => c.avgRating >= query.minRating!);
    }

    // Market filter
    if (query.markets && query.markets.length > 0) {
      candidates = candidates.filter(c =>
        c.markets.some(m => query.markets!.includes(m))
      );
    }

    // Language
    if (query.language) {
      candidates = candidates.filter(c => c.language === query.language);
    }

    // Sort
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;
    switch (query.sortBy || 'relevance') {
      case 'rating':
        candidates.sort((a, b) => sortOrder * (a.avgRating - b.avgRating));
        break;
      case 'sales':
        candidates.sort((a, b) => sortOrder * (a.salesCount - b.salesCount));
        break;
      case 'price':
        candidates.sort((a, b) => sortOrder * (a.price - b.price));
        break;
      case 'newest':
        candidates.sort((a, b) => sortOrder * (a.publishedAt! - b.publishedAt!));
        break;
      case 'popular':
        candidates.sort((a, b) => sortOrder * (a.downloadCount - b.downloadCount));
        break;
      default: // relevance: by keyword match score
        if (query.keywords) {
          const kw = query.keywords.toLowerCase();
          candidates.sort((a, b) => sortOrder * (
            this.relevanceScore(b, kw) - this.relevanceScore(a, kw)
          ));
        }
        break;
    }

    const total = candidates.length;
    const totalPages = Math.ceil(total / pageSize);
    const start = (page - 1) * pageSize;

    return {
      items: candidates.slice(start, start + pageSize),
      total,
      page,
      pageSize,
      totalPages,
      query,
    };
  }

  /**
   * Quick keyword search (returns top matches only).
   */
  quickSearch(keywords: string, limit: number = 10): ContentItem[] {
    return this.search({ keywords, pageSize: limit, sortBy: 'relevance' }).items;
  }

  // ═════════════════════════════════════════════════════════
  // Recommendations
  // ═════════════════════════════════════════════════════════

  /**
   * Generate personalized recommendations.
   */
  recommend(req: RecommendationRequest): ContentItem[] {
    const limit = req.limit || 10;
    const exclude = new Set(req.excludeIds || []);

    let candidates = Array.from(this.content.values())
      .filter(c => c.status === 'published' && !exclude.has(c.id));

    if (candidates.length === 0) return [];

    // Score each candidate
    const scored = candidates.map(c => ({
      item: c,
      score: this.computeRecommendationScore(c, req),
    }));

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, limit).map(s => s.item);
  }

  // ═════════════════════════════════════════════════════════
  // Purchase & Stats
  // ═════════════════════════════════════════════════════════

  /**
   * Record a purchase.
   */
  recordPurchase(contentId: string): { item: ContentItem; creatorShare: number; commission: number } | null {
    const item = this.content.get(contentId);
    if (!item || item.status !== 'published') return null;

    const commission = Math.round(item.price * item.commissionRate * 100) / 100;
    const creatorShare = Math.round((item.price - commission) * 100) / 100;

    item.salesCount++;
    item.totalRevenue = Math.round((item.totalRevenue + creatorShare) * 100) / 100;

    return { item, creatorShare, commission };
  }

  /**
   * Record a view.
   */
  recordView(contentId: string): boolean {
    const item = this.content.get(contentId);
    if (!item) return false;
    item.viewCount++;
    return true;
  }

  /**
   * Record a download.
   */
  recordDownload(contentId: string): boolean {
    const item = this.content.get(contentId);
    if (!item) return false;
    item.downloadCount++;
    return true;
  }

  // ═════════════════════════════════════════════════════════
  // Creator Dashboard
  // ═════════════════════════════════════════════════════════

  /**
   * Get creator statistics.
   */
  getCreatorStats(creatorId: string, level: CreatorLevel): CreatorStats {
    const items = Array.from(this.content.values())
      .filter(c => c.creatorId === creatorId);

    const totalContent = items.length;
    const totalSales = items.reduce((s, c) => s + c.salesCount, 0);
    const totalRevenue = items.reduce((s, c) => s + c.totalRevenue, 0);
    const totalCommission = items.reduce(
      (s, c) => s + Math.round(c.salesCount * c.price * c.commissionRate * 100) / 100, 0
    );
    const avgRating = items.length > 0
      ? Math.round((items.reduce((s, c) => s + c.avgRating, 0) / items.length) * 10) / 10
      : 0;
    const totalReviews = items.reduce((s, c) => s + c.reviewCount, 0);

    return {
      creatorId, level, totalContent, totalSales, totalRevenue,
      totalCommission, avgRating, totalReviews,
    };
  }

  /**
   * Get all content by a creator.
   */
  getCreatorContent(creatorId: string): ContentItem[] {
    return Array.from(this.content.values())
      .filter(c => c.creatorId === creatorId)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  // ═════════════════════════════════════════════════════════
  // Browse
  // ═════════════════════════════════════════════════════════

  /**
   * Browse by category.
   */
  browseCategory(category: string, page: number = 1, pageSize: number = 20): SearchResult {
    return this.search({ categories: [category], page, pageSize, sortBy: 'popular' });
  }

  /**
   * Browse latest.
   */
  browseLatest(page: number = 1, pageSize: number = 20): SearchResult {
    return this.search({ page, pageSize, sortBy: 'newest' });
  }

  /**
   * Browse top-rated.
   */
  browseTopRated(page: number = 1, pageSize: number = 20): SearchResult {
    return this.search({ page, pageSize, sortBy: 'rating' });
  }

  /**
   * Get single content item.
   */
  getContent(contentId: string): ContentItem | undefined {
    return this.content.get(contentId);
  }

  // ═════════════════════════════════════════════════════════
  // Internal: Indexing
  // ═════════════════════════════════════════════════════════

  private indexItem(item: ContentItem): void {
    for (const tag of item.tags) {
      if (!this.tagIndex.has(tag)) this.tagIndex.set(tag, new Set());
      this.tagIndex.get(tag)!.add(item.id);
    }
    for (const cat of item.categories) {
      if (!this.categoryIndex.has(cat)) this.categoryIndex.set(cat, new Set());
      this.categoryIndex.get(cat)!.add(item.id);
    }
  }

  private reindexItemTags(item: ContentItem, oldTags: string[]): void {
    for (const tag of oldTags) {
      this.tagIndex.get(tag)?.delete(item.id);
    }
    for (const tag of item.tags) {
      if (!this.tagIndex.has(tag)) this.tagIndex.set(tag, new Set());
      this.tagIndex.get(tag)!.add(item.id);
    }
  }

  private reindexItemCategories(item: ContentItem, oldCats: string[]): void {
    for (const cat of oldCats) {
      this.categoryIndex.get(cat)?.delete(item.id);
    }
    for (const cat of item.categories) {
      if (!this.categoryIndex.has(cat)) this.categoryIndex.set(cat, new Set());
      this.categoryIndex.get(cat)!.add(item.id);
    }
  }

  // ═════════════════════════════════════════════════════════
  // Internal: Scoring
  // ═════════════════════════════════════════════════════════

  private relevanceScore(item: ContentItem, keyword: string): number {
    let score = 0;
    if (item.title.toLowerCase().includes(keyword)) score += 10;
    if (item.description.toLowerCase().includes(keyword)) score += 5;
    score += item.tags.filter(t => t.includes(keyword)).length * 3;
    // Boost by rating and sales
    score += item.avgRating * 0.5;
    score += Math.min(item.salesCount, 100) * 0.01;
    return score;
  }

  private computeRecommendationScore(item: ContentItem, req: RecommendationRequest): number {
    let score = item.avgRating * 2;
    score += Math.min(item.salesCount, 50) * 0.1;
    score += Math.log(item.viewCount + 1) * 0.5;

    // Boost for matching markets
    if (req.markets) {
      const marketMatch = item.markets.filter(m => req.markets!.includes(m)).length;
      score += marketMatch * 5;
    }

    // Boost for popular creators (L3)
    if (item.creatorLevel === 'L3') score += 3;
    else if (item.creatorLevel === 'L2') score += 1;

    // Freshness boost
    const ageInDays = item.publishedAt
      ? (Date.now() - item.publishedAt) / (24 * 3600_000)
      : 365;
    score += Math.max(0, 10 - ageInDays) * 0.5;

    return score;
  }

  /** Reset all state (for testing) */
  reset(): void {
    this.content.clear();
    this.reviews.clear();
    this.tagIndex.clear();
    this.categoryIndex.clear();
    this.idCounter = 0;
  }
}

export default ContentMarketplaceEngine;

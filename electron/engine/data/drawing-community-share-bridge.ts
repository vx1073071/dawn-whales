/**
 * R267: DrawingCommunityShareBridge — 画线社区分享桥接
 * 
 * 功能:
 *   1. 画线+策略→社区分享 (chart screenshot + drawing data)
 *   2. 分享类型: drawing/strategy/template/analysis
 *   3. 点赞+收藏+评论计数
 *   4. 社区Feed (热门/最新/我的)
 *   5. 分享模板市场 (可复用画线模板)
 *   6. 分享统计 (浏览量/点赞/采用次数)
 */

import { createHash } from 'crypto';

// ── Types ──────────────────────────────────────────────────────────────────

export interface CommunityShare {
  shareId: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  symbol: string;
  title: string;
  titleCn: string;
  description: string;
  descriptionCn: string;
  type: ShareType;
  content: ShareContent;
  chartSnapshot?: string;    // base64 or URL
  tags: string[];
  visibility: 'public' | 'followers' | 'private';
  stats: ShareStats;
  createdAt: number;
  updatedAt: number;
}

export type ShareType = 'drawing' | 'strategy' | 'template' | 'analysis' | 'question';

export interface ShareContent {
  drawings?: SharedDrawingData[];
  strategy?: SharedStrategyData;
  analysis?: string;
  analysisCn?: string;
  question?: string;
  questionCn?: string;
}

export interface SharedDrawingData {
  drawingId: string;
  type: string;
  category: string;
  state: Record<string, any>;
  label?: string;
  note?: string;
}

export interface SharedStrategyData {
  strategyId: string;
  type: string;
  entry: { price: number; condition: string; conditionCn: string };
  stopLoss: { price: number; percent: number };
  takeProfit: { price: number; percent?: number };
  riskReward: number;
  confidence: number;
}

export interface ShareStats {
  views: number;
  likes: number;
  bookmarks: number;
  comments: number;
  adoptions: number;       // times strategy was adopted
  shares: number;          // re-shares
}

export interface ShareComment {
  commentId: string;
  shareId: string;
  authorId: string;
  authorName: string;
  text: string;
  createdAt: number;
  editedAt?: number;
}

export interface DrawingTemplate {
  templateId: string;
  name: string;
  nameCn: string;
  description: string;
  descriptionCn: string;
  type: string;
  category: string;
  drawings: SharedDrawingData[];
  tags: string[];
  authorId: string;
  authorName: string;
  downloads: number;
  rating: number;       // 1-5
  ratingsCount: number;
  createdAt: number;
}

export interface CommunityFeed {
  shares: CommunityShare[];
  total: number;
  page: number;
  pageSize: number;
  sort: 'hot' | 'new' | 'trending';
}

// ═══════════════════════════════════════════════════════════════════════════
// DrawingCommunityShareBridge
// ═══════════════════════════════════════════════════════════════════════════

export class DrawingCommunityShareBridge {
  private shares: Map<string, CommunityShare> = new Map();
  private templates: Map<string, DrawingTemplate> = new Map();
  private comments: Map<string, ShareComment[]> = new Map();
  private stats_ = { totalShares: 0, totalTemplates: 0, totalComments: 0 };

  constructor() {}

  // ── Public API: Sharing ─────────────────────────────────────────────────

  /**
   * Create a community share post.
   */
  share(params: {
    authorId: string;
    authorName: string;
    symbol: string;
    title: string;
    titleCn: string;
    description: string;
    descriptionCn: string;
    type: ShareType;
    content: ShareContent;
    tags?: string[];
    visibility?: CommunityShare['visibility'];
    authorAvatar?: string;
  }): CommunityShare {
    const now = Date.now();
    const share: CommunityShare = {
      shareId: `share:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
      authorId: params.authorId,
      authorName: params.authorName,
      authorAvatar: params.authorAvatar,
      symbol: params.symbol,
      title: params.title,
      titleCn: params.titleCn,
      description: params.description,
      descriptionCn: params.descriptionCn,
      type: params.type,
      content: params.content,
      tags: params.tags ?? [],
      visibility: params.visibility ?? 'public',
      stats: { views: 0, likes: 0, bookmarks: 0, comments: 0, adoptions: 0, shares: 0 },
      createdAt: now,
      updatedAt: now,
    };

    this.shares.set(share.shareId, share);
    this.stats_.totalShares++;
    return share;
  }

  // ── Public API: Template Publishing ─────────────────────────────────────

  /**
   * Publish drawings as a reusable template in the marketplace.
   */
  publishTemplate(params: {
    name: string;
    nameCn: string;
    description: string;
    descriptionCn: string;
    type: string;
    category: string;
    drawings: SharedDrawingData[];
    tags: string[];
    authorId: string;
    authorName: string;
  }): DrawingTemplate {
    const template: DrawingTemplate = {
      templateId: `tmpl:${Date.now()}:${Math.random().toString(36).slice(2, 6)}`,
      name: params.name,
      nameCn: params.nameCn,
      description: params.description,
      descriptionCn: params.descriptionCn,
      type: params.type,
      category: params.category,
      drawings: params.drawings,
      tags: params.tags,
      authorId: params.authorId,
      authorName: params.authorName,
      downloads: 0,
      rating: 0,
      ratingsCount: 0,
      createdAt: Date.now(),
    };

    this.templates.set(template.templateId, template);
    this.stats_.totalTemplates++;
    return template;
  }

  // ── Public API: Interactions ────────────────────────────────────────────

  /** Like a share */
  like(shareId: string): boolean {
    const share = this.shares.get(shareId);
    if (!share) return false;
    share.stats.likes++;
    return true;
  }

  /** Unlike */
  unlike(shareId: string): boolean {
    const share = this.shares.get(shareId);
    if (!share) return false;
    share.stats.likes = Math.max(0, share.stats.likes - 1);
    return true;
  }

  /** Bookmark */
  bookmark(shareId: string): boolean {
    const share = this.shares.get(shareId);
    if (!share) return false;
    share.stats.bookmarks++;
    return true;
  }

  /** View increment */
  view(shareId: string): boolean {
    const share = this.shares.get(shareId);
    if (!share) return false;
    share.stats.views++;
    return true;
  }

  /** Adopt a strategy (user implements it) */
  adopt(shareId: string): boolean {
    const share = this.shares.get(shareId);
    if (!share) return false;
    share.stats.adoptions++;
    return true;
  }

  /** Re-share */
  reshare(shareId: string): boolean {
    const share = this.shares.get(shareId);
    if (!share) return false;
    share.stats.shares++;
    return true;
  }

  /** Download a template */
  downloadTemplate(templateId: string): DrawingTemplate | null {
    const tmpl = this.templates.get(templateId);
    if (!tmpl) return null;
    tmpl.downloads++;
    return tmpl;
  }

  /** Rate a template */
  rateTemplate(templateId: string, rating: number): boolean {
    if (rating < 1 || rating > 5) return false;
    const tmpl = this.templates.get(templateId);
    if (!tmpl) return false;

    const totalRating = tmpl.rating * tmpl.ratingsCount + rating;
    tmpl.ratingsCount++;
    tmpl.rating = +(totalRating / tmpl.ratingsCount).toFixed(1);
    return true;
  }

  // ── Public API: Comments ────────────────────────────────────────────────

  /** Add a comment */
  addComment(params: {
    shareId: string;
    authorId: string;
    authorName: string;
    text: string;
  }): ShareComment | null {
    const share = this.shares.get(params.shareId);
    if (!share) return null;

    const comment: ShareComment = {
      commentId: `cmt:${Date.now()}:${Math.random().toString(36).slice(2, 6)}`,
      shareId: params.shareId,
      authorId: params.authorId,
      authorName: params.authorName,
      text: params.text,
      createdAt: Date.now(),
    };

    const shareComments = this.comments.get(params.shareId) ?? [];
    shareComments.push(comment);
    this.comments.set(params.shareId, shareComments);
    share.stats.comments++;
    this.stats_.totalComments++;
    return comment;
  }

  /** Get comments for a share */
  getComments(shareId: string, limit?: number): ShareComment[] {
    const comments = this.comments.get(shareId) ?? [];
    return limit ? comments.slice(-limit).reverse() : [...comments].reverse();
  }

  // ── Public API: Feed ────────────────────────────────────────────────────

  /**
   * Get community feed with sorting.
   */
  getFeed(params: {
    sort?: 'hot' | 'new' | 'trending';
    symbol?: string;
    tags?: string[];
    page?: number;
    pageSize?: number;
  }): CommunityFeed {
    const sort = params.sort ?? 'new';
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;

    // Filter
    let filtered = Array.from(this.shares.values())
      .filter(s => s.visibility === 'public');

    if (params.symbol) {
      filtered = filtered.filter(s => s.symbol === params.symbol);
    }
    if (params.tags && params.tags.length > 0) {
      filtered = filtered.filter(s => params.tags!.some(t => s.tags.includes(t)));
    }

    // Sort
    switch (sort) {
      case 'hot':
        filtered.sort((a, b) => (b.stats.likes + b.stats.comments * 2 + b.stats.adoptions * 3) -
          (a.stats.likes + a.stats.comments * 2 + a.stats.adoptions * 3));
        break;
      case 'trending':
        filtered.sort((a, b) => (b.stats.views + b.stats.likes * 5) - (a.stats.views + a.stats.likes * 5));
        break;
      case 'new':
      default:
        filtered.sort((a, b) => b.createdAt - a.createdAt);
        break;
    }

    const total = filtered.length;
    const start = (page - 1) * pageSize;
    const shares = filtered.slice(start, start + pageSize);

    return { shares, total, page, pageSize, sort };
  }

  // ── Public API: Query ───────────────────────────────────────────────────

  /** Get share by ID */
  getShare(shareId: string): CommunityShare | null { return this.shares.get(shareId) ?? null; }

  /** Get shares by author */
  getSharesByAuthor(authorId: string): CommunityShare[] {
    return Array.from(this.shares.values()).filter(s => s.authorId === authorId);
  }

  /** Get shares by symbol */
  getSharesBySymbol(symbol: string): CommunityShare[] {
    return Array.from(this.shares.values()).filter(s => s.symbol === symbol);
  }

  /** Get trending tags */
  getTrendingTags(limit = 10): Array<{ tag: string; count: number }> {
    const tagCounts: Map<string, number> = new Map();
    for (const share of this.shares.values()) {
      for (const tag of share.tags) {
        tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
      }
    }
    return Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /** Get templates */
  getTemplates(params?: {
    category?: string;
    sort?: 'popular' | 'new' | 'rating';
    limit?: number;
  }): DrawingTemplate[] {
    let list = Array.from(this.templates.values());

    if (params?.category) list = list.filter(t => t.category === params.category);

    const sort = params?.sort ?? 'popular';
    switch (sort) {
      case 'popular': list.sort((a, b) => b.downloads - a.downloads); break;
      case 'rating': list.sort((a, b) => b.rating - a.rating); break;
      case 'new': list.sort((a, b) => b.createdAt - a.createdAt); break;
    }

    return params?.limit ? list.slice(0, params.limit) : list;
  }

  /** Get stats */
  getStats() { return { ...this.stats_ }; }

  /** Reset */
  reset(): void {
    this.shares.clear();
    this.templates.clear();
    this.comments.clear();
    this.stats_ = { totalShares: 0, totalTemplates: 0, totalComments: 0 };
  }
}

export const drawingCommunityShareBridge = new DrawingCommunityShareBridge();

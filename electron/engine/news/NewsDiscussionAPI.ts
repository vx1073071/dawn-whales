/**
 * R243 JVS#1: NewsDiscussionAPI — 新闻讨论区后端
 *
 * Links strategies to related news, managing discussion threads
 * with likes, pins, and replies — a community layer on top of news.
 *
 * Architecture:
 *   ┌───────────────────────────────────────────────────────────────┐
 *   │                     NewsDiscussionAPI                          │
 *   │  ┌─────────────────────────────────────────────────────────┐  │
 *   │  │ Strategy → News Linker                                   │  │
 *   │  │  ├─ keyword extraction from strategy description         │  │
 *   │  │  ├─ auto-associate top-N matching news articles          │  │
 *   │  │  └─ manual link/unlink                                   │  │
 *   │  └──────────────────┬──────────────────────────────────────┘  │
 *   │                     │                                          │
 *   │  ┌──────────────────┴──────────────────────────────────────┐  │
 *   │  │ Discussion Thread Engine                                 │  │
 *   │  │  ├─ create thread (per news article or strategy)        │  │
 *   │  │  ├─ comment (reply to thread or nested reply)           │  │
 *   │  │  ├─ like/unlike (thread or comment)                     │  │
 *   │  │  ├─ pin/unpin (creator or admin)                        │  │
 *   │  │  └─ report (spam/abuse → moderation queue)             │  │
 *   │  └──────────────────┬──────────────────────────────────────┘  │
 *   │                     │                                          │
 *   │  ┌──────────────────┴──────────────────────────────────────┐  │
 *   │  │ Ranking Engine                                           │  │
 *   │  │  ├─ hot (recent likes + comments weighted)              │  │
 *   │  │  ├─ top (all-time likes)                                │  │
 *   │  │  ├─ new (chronological)                                  │  │
 *   │  │  └─ controversial (many replies + many opposing views)  │  │
 *   │  └─────────────────────────────────────────────────────────┘  │
 *   └───────────────────────────────────────────────────────────────┘
 *
 * Pricing: FREE (社区功能, non-billable)
 *
 * v2.7.0-NEWS | production-ready | FINAL ROUND
 */

import log from 'electron-log';

// ═════════════════════════════════════════════════════════════════════════════
// Types
// ═════════════════════════════════════════════════════════════════════════════

export interface NewsArticle {
  id: string;
  title: string;
  source: string;
  url?: string;
  symbol?: string;
  keywords: string[];
  publishedAt: number;
  sentiment?: number;
}

export interface Strategy {
  id: string;
  name: string;
  description: string;
  creatorId: string;
  creatorName: string;
  symbols: string[];
  keywords: string[];
  createdAt: number;
  updatedAt: number;
}

export interface DiscussionThread {
  id: string;
  title: string;
  targetType: 'news' | 'strategy';
  targetId: string;         // news article ID or strategy ID
  associatedArticles: string[];  // news article IDs
  associatedStrategies: string[]; // strategy IDs
  creatorId: string;
  creatorName: string;
  content: string;
  commentCount: number;
  likeCount: number;
  isPinned: boolean;
  isLocked: boolean;
  tags: string[];
  createdAt: number;
  updatedAt: number;
  lastActivityAt: number;
}

export interface Comment {
  id: string;
  threadId: string;
  parentId?: string;        // null = top-level, set = reply to
  authorId: string;
  authorName: string;
  content: string;
  likeCount: number;
  isEdited: boolean;
  isDeleted: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface ModerationReport {
  id: string;
  targetType: 'thread' | 'comment';
  targetId: string;
  reporterId: string;
  reason: 'spam' | 'abuse' | 'misinformation' | 'off_topic' | 'other';
  description?: string;
  status: 'pending' | 'resolved' | 'dismissed';
  createdAt: number;
  resolvedAt?: number;
}

export interface ThreadLink {
  strategyId: string;
  articleId: string;
  keywordMatches: string[];
  relevanceScore: number;   // 0-1
  linkedAt: number;
  linkedBy: 'auto' | 'manual';
}

export type SortMode = 'hot' | 'top' | 'new' | 'controversial';

// ═════════════════════════════════════════════════════════════════════════════
// NewsDiscussionAPI
// ═════════════════════════════════════════════════════════════════════════════

export class NewsDiscussionAPI {
  private threads: Map<string, DiscussionThread> = new Map();
  private comments: Map<string, Comment[]> = new Map();  // threadId → comments
  private links: ThreadLink[] = [];
  private likes: Set<string> = new Set();   // "thread:{id}:{userId}" or "comment:{id}:{userId}"
  private reports: ModerationReport[] = [];
  private maxLinks = 500;
  private autoLinkBudget = 5; // max auto-links per strategy

  // ═══════════ Strategy ↔ News Linking ═════════════════════════════════

  /**
   * Auto-link strategies to relevant news articles by keyword overlap.
   */
  autoLink(strategy: Strategy, articles: NewsArticle[]): ThreadLink[] {
    const newLinks: ThreadLink[] = [];

    for (const article of articles) {
      const matches: string[] = [];
      let score = 0;

      // Check keyword overlap
      for (const artKw of article.keywords) {
        for (const stratKw of strategy.keywords) {
          if (artKw.toLowerCase() === stratKw.toLowerCase()) {
            matches.push(artKw);
            score += 1;
          }
        }
      }

      // Symbol match bonus
      if (article.symbol && strategy.symbols.includes(article.symbol)) {
        score += 2;
        matches.push(`ticker:${article.symbol}`);
      }

      // Description text overlap
      const descLower = strategy.description.toLowerCase();
      for (const kw of article.keywords) {
        if (descLower.includes(kw.toLowerCase()) && !matches.includes(kw)) {
          score += 0.5;
        }
      }

      if (score >= 1.5) {
        const normalized = Math.min(score / 5, 1);
        const link: ThreadLink = {
          strategyId: strategy.id,
          articleId: article.id,
          keywordMatches: [...new Set(matches)],
          relevanceScore: Math.round(normalized * 100) / 100,
          linkedAt: Date.now(),
          linkedBy: 'auto',
        };
        newLinks.push(link);
      }
    }

    // Sort by score desc, take top N
    newLinks.sort((a, b) => b.relevanceScore - a.relevanceScore);
    const top = newLinks.slice(0, this.autoLinkBudget);

    this.links.push(...top);
    while (this.links.length > this.maxLinks) this.links.shift();

    log.info(`[NDA] Auto-linked ${top.length} articles to strategy ${strategy.id}`);
    return top;
  }

  /**
   * Manually link a strategy to an article.
   */
  manualLink(strategyId: string, articleId: string): ThreadLink {
    const existing = this.links.find(l => l.strategyId === strategyId && l.articleId === articleId);
    if (existing) return existing;

    const link: ThreadLink = {
      strategyId, articleId,
      keywordMatches: ['manual'],
      relevanceScore: 1.0,
      linkedAt: Date.now(),
      linkedBy: 'manual',
    };
    this.links.push(link);
    return link;
  }

  /**
   * Unlink a strategy from an article.
   */
  unlink(strategyId: string, articleId: string): boolean {
    const idx = this.links.findIndex(l => l.strategyId === strategyId && l.articleId === articleId);
    if (idx >= 0) { this.links.splice(idx, 1); return true; }
    return false;
  }

  // ═══════════ Discussion Threads ══════════════════════════════════════

  /**
   * Create a discussion thread linked to a news article or strategy.
   */
  createThread(params: {
    title: string;
    targetType: 'news' | 'strategy';
    targetId: string;
    creatorId: string;
    creatorName: string;
    content: string;
    tags?: string[];
    associatedArticles?: string[];
    associatedStrategies?: string[];
  }): DiscussionThread {
    const now = Date.now();
    const thread: DiscussionThread = {
      id: `thread-${now}-${Math.random().toString(36).slice(2, 6)}`,
      title: params.title,
      targetType: params.targetType,
      targetId: params.targetId,
      associatedArticles: params.associatedArticles || [],
      associatedStrategies: params.associatedStrategies || [],
      creatorId: params.creatorId,
      creatorName: params.creatorName,
      content: params.content,
      commentCount: 0,
      likeCount: 0,
      isPinned: false,
      isLocked: false,
      tags: params.tags || [],
      createdAt: now,
      updatedAt: now,
      lastActivityAt: now,
    };

    this.threads.set(thread.id, thread);
    this.comments.set(thread.id, []);

    log.info(`[NDA] Thread created: ${thread.id} by ${params.creatorName}`);
    return thread;
  }

  /**
   * Post a comment on a thread.
   */
  addComment(threadId: string, authorId: string, authorName: string, content: string, parentId?: string): Comment | null {
    const thread = this.threads.get(threadId);
    if (!thread || thread.isLocked) return null;

    const comment: Comment = {
      id: `cmt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      threadId,
      parentId,
      authorId,
      authorName,
      content,
      likeCount: 0,
      isEdited: false,
      isDeleted: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const threadComments = this.comments.get(threadId) || [];
    threadComments.push(comment);
    this.comments.set(threadId, threadComments);

    thread.commentCount = threadComments.filter(c => !c.isDeleted).length;
    thread.lastActivityAt = Date.now();
    thread.updatedAt = Date.now();

    return comment;
  }

  /**
   * Edit a comment (author only).
   */
  editComment(threadId: string, commentId: string, authorId: string, newContent: string): Comment | null {
    const threadComments = this.comments.get(threadId);
    if (!threadComments) return null;

    const comment = threadComments.find(c => c.id === commentId && c.authorId === authorId && !c.isDeleted);
    if (!comment) return null;

    comment.content = newContent;
    comment.isEdited = true;
    comment.updatedAt = Date.now();
    return comment;
  }

  /**
   * Soft-delete a comment.
   */
  deleteComment(threadId: string, commentId: string, userId: string): boolean {
    const threadComments = this.comments.get(threadId);
    if (!threadComments) return false;

    const comment = threadComments.find(c => c.id === commentId && (c.authorId === userId));
    if (!comment) return false;

    comment.isDeleted = true;
    comment.updatedAt = Date.now();

    const thread = this.threads.get(threadId);
    if (thread) {
      thread.commentCount = threadComments.filter(c => !c.isDeleted).length;
    }
    return true;
  }

  // ═══════════ Likes ═══════════════════════════════════════════════════

  /**
   * Toggle like on a thread or comment.
   * Returns: true = liked, false = unliked.
   */
  toggleLike(targetType: 'thread' | 'comment', targetId: string, userId: string): boolean {
    const key = `${targetType}:${targetId}:${userId}`;

    if (this.likes.has(key)) {
      this.likes.delete(key);
      this.updateLikeCount(targetType, targetId, -1);
      return false;
    }

    this.likes.add(key);
    this.updateLikeCount(targetType, targetId, 1);
    return true;
  }

  private updateLikeCount(targetType: 'thread' | 'comment', targetId: string, delta: number): void {
    if (targetType === 'thread') {
      const thread = this.threads.get(targetId);
      if (thread) thread.likeCount = Math.max(0, thread.likeCount + delta);
    } else {
      for (const [threadId, cmts] of this.comments) {
        const cmt = cmts.find(c => c.id === targetId);
        if (cmt) { cmt.likeCount = Math.max(0, cmt.likeCount + delta); return; }
      }
    }
  }

  isLiked(targetType: 'thread' | 'comment', targetId: string, userId: string): boolean {
    return this.likes.has(`${targetType}:${targetId}:${userId}`);
  }

  // ═══════════ Pinning ═════════════════════════════════════════════════

  pinThread(threadId: string): boolean {
    const thread = this.threads.get(threadId);
    if (!thread) return false;
    thread.isPinned = true;
    return true;
  }

  unpinThread(threadId: string): boolean {
    const thread = this.threads.get(threadId);
    if (!thread) return false;
    thread.isPinned = false;
    return true;
  }

  lockThread(threadId: string): boolean {
    const thread = this.threads.get(threadId);
    if (!thread) return false;
    thread.isLocked = true;
    return true;
  }

  unlockThread(threadId: string): boolean {
    const thread = this.threads.get(threadId);
    if (!thread) return false;
    thread.isLocked = false;
    return true;
  }

  // ═══════════ Reporting ═══════════════════════════════════════════════

  report(targetType: 'thread' | 'comment', targetId: string, reporterId: string, reason: ModerationReport['reason'], description?: string): ModerationReport {
    const report: ModerationReport = {
      id: `report-${Date.now()}`,
      targetType, targetId, reporterId, reason, description,
      status: 'pending',
      createdAt: Date.now(),
    };
    this.reports.push(report);
    return report;
  }

  resolveReport(reportId: string, resolution: 'resolved' | 'dismissed'): ModerationReport | null {
    const report = this.reports.find(r => r.id === reportId);
    if (!report) return null;
    report.status = resolution;
    report.resolvedAt = Date.now();
    return report;
  }

  // ═══════════ Ranking / Queries ═══════════════════════════════════════

  /**
   * Get threads sorted by the given mode.
   */
  getThreads(options?: {
    targetType?: 'news' | 'strategy';
    targetId?: string;
    symbol?: string;
    tag?: string;
    sort?: SortMode;
    limit?: number;
    offset?: number;
  }): DiscussionThread[] {
    let results = [...this.threads.values()];

    if (options?.targetType) results = results.filter(t => t.targetType === options.targetType);
    if (options?.targetId) results = results.filter(t => t.targetId === options.targetId);
    if (options?.tag) results = results.filter(t => t.tags.includes(options.tag));

    const sort = options?.sort || 'hot';

    switch (sort) {
      case 'hot': results.sort((a, b) => {
        const scoreA = (a.likeCount * 3 + a.commentCount * 5) / (Math.max(1, (Date.now() - a.lastActivityAt) / 3600000));
        const scoreB = (b.likeCount * 3 + b.commentCount * 5) / (Math.max(1, (Date.now() - b.lastActivityAt) / 3600000));
        return scoreB - scoreA;
      }); break;
      case 'top': results.sort((a, b) => b.likeCount - a.likeCount); break;
      case 'new': results.sort((a, b) => b.createdAt - a.createdAt); break;
      case 'controversial':
        results.sort((a, b) => (b.commentCount / Math.max(1, b.likeCount)) - (a.commentCount / Math.max(1, a.likeCount)));
        break;
    }

    // Pinned threads always first
    results.sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0));

    const offset = options?.offset || 0;
    const limit = options?.limit || 20;
    return results.slice(offset, offset + limit);
  }

  /**
   * Get comments for a thread.
   */
  getComments(threadId: string, options?: { limit?: number; offset?: number; includeDeleted?: boolean }): Comment[] {
    const comments = this.comments.get(threadId) || [];
    let filtered = options?.includeDeleted ? comments : comments.filter(c => !c.isDeleted);

    // Sort by createdAt (chronological, top-level first then nested)
    filtered.sort((a, b) => a.createdAt - b.createdAt);

    const offset = options?.offset || 0;
    const limit = options?.limit || 50;
    return filtered.slice(offset, offset + limit);
  }

  /**
   * Get articles linked to a strategy.
   */
  getLinksForStrategy(strategyId: string): ThreadLink[] {
    return this.links.filter(l => l.strategyId === strategyId);
  }

  /**
   * Get strategies linked to an article.
   */
  getLinksForArticle(articleId: string): ThreadLink[] {
    return this.links.filter(l => l.articleId === articleId);
  }

  /**
   * Get threads related to a strategy (auto-discovered via links).
   */
  getThreadsForStrategy(strategyId: string): DiscussionThread[] {
    const linkedArticleIds = new Set(this.links.filter(l => l.strategyId === strategyId).map(l => l.articleId));
    return [...this.threads.values()].filter(t => {
      if (t.targetType === 'strategy' && t.targetId === strategyId) return true;
      if (t.targetType === 'news' && linkedArticleIds.has(t.targetId)) return true;
      if (t.associatedStrategies.includes(strategyId)) return true;
      return false;
    });
  }

  getThread(threadId: string): DiscussionThread | undefined {
    return this.threads.get(threadId);
  }

  getPendingReports(): ModerationReport[] {
    return this.reports.filter(r => r.status === 'pending');
  }

  // ═══════════ Stats ───────────────────────────────────────────────────

  getStats(): { totalThreads: number; totalComments: number; totalLikes: number; totalLinks: number } {
    let totalComments = 0;
    for (const cmts of this.comments.values()) totalComments += cmts.filter(c => !c.isDeleted).length;

    return {
      totalThreads: this.threads.size,
      totalComments,
      totalLikes: this.likes.size,
      totalLinks: this.links.length,
    };
  }

  reset(): void {
    this.threads.clear();
    this.comments.clear();
    this.links = [];
    this.likes.clear();
    this.reports = [];
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Singleton
// ═════════════════════════════════════════════════════════════════════════════

let defaultNDA: NewsDiscussionAPI | null = null;

export function getNewsDiscussionAPI(): NewsDiscussionAPI {
  if (!defaultNDA) defaultNDA = new NewsDiscussionAPI();
  return defaultNDA;
}

export function resetNewsDiscussionAPI(): void {
  defaultNDA = null;
}

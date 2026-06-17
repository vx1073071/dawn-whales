/**
 * R271 社区分享IPC桥接 v5.0
 * 
 * 增强 DrawingCommunityShareBridge:
 *   IPC实时Feed更新推送 (new/hot/trending)
 *   社交通知 (like/comment/adopt/reshare)
 *   模板市场同步 (publish/download/rate)
 *   用户动态流
 *   热门标签聚合
 */
import { EventEmitter } from 'events';

// ── Types ──────────────────────────────────────────────────────────────────

export type CommunityIpcChannel =
  | 'community:feed'       | 'community:notification'
  | 'community:template'   | 'community:user'
  | 'community:social';

export interface CommunityIpcEvent {
  channel: CommunityIpcChannel;
  eventType: string;
  data: unknown;
  timestamp: number;
}

export interface CommunityNotification {
  id: string;
  userId: string;
  type: 'like' | 'comment' | 'adopt' | 'reshare' | 'bookmark' | 'follow' | 'mention';
  targetId: string;
  targetType: 'drawing' | 'strategy' | 'template' | 'analysis' | 'question' | 'comment';
  actorId: string;
  actorName: string;
  actorAvatar?: string;
  message: string;
  messageCn: string;
  isRead: boolean;
  createdAt: number;
}

export interface FeedItem {
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
  previewImage?: string;
  tags: string[];
  stats: { likes: number; views: number; bookmarks: number; comments: number; adoptions: number; reshares: number };
  hotScore: number;
  createdAt: number;
}

export type ShareType = 'drawing' | 'strategy' | 'template' | 'analysis' | 'question';
export type FeedSort = 'hot' | 'new' | 'trending';
export type TemplateRating = 1 | 2 | 3 | 4 | 5;

// ── IPC Bridge ─────────────────────────────────────────────────────────────

export class CommunityIpcV5Bridge extends EventEmitter {
  private feed_: FeedItem[] = [];
  private notifications_: CommunityNotification[] = [];
  private listeners_: Map<CommunityIpcChannel, Set<(ev: CommunityIpcEvent) => void>> = new Map();
  private watchedTags_: Set<string> = new Set();
  private userSubscriptions_: Map<string, Set<string>> = new Map(); // userId → Set<shareId>
  private hotCache_: { items: FeedItem[]; computedAt: number } = { items: [], computedAt: 0 };
  private readonly HOT_CACHE_MS = 60000; // 1 min

  // ── Channel Bus ────────────────────────────────────────────────────────

  onChannel(channel: CommunityIpcChannel, handler: (ev: CommunityIpcEvent) => void): () => void {
    if (!this.listeners_.has(channel)) this.listeners_.set(channel, new Set());
    this.listeners_.get(channel)!.add(handler);
    return () => this.listeners_.get(channel)?.delete(handler);
  }

  private _emit(channel: CommunityIpcChannel, eventType: string, data: unknown): void {
    const ev: CommunityIpcEvent = { channel, eventType, data, timestamp: Date.now() };
    const handlers = this.listeners_.get(channel);
    if (handlers) for (const h of handlers) h(ev);
    // Cross-notify: feed updates → notification channel
    if (channel === 'community:feed') {
      const nh = this.listeners_.get('community:notification');
      if (nh) for (const h of nh) h(ev);
    }
  }

  // ── Feed Management ──────────────────────────────────────────────────

  publishToFeed(item: Omit<FeedItem, 'hotScore'>): FeedItem {
    const feedItem: FeedItem = {
      ...item,
      hotScore: this._calcHotScore(item.stats, item.createdAt),
    };
    this.feed_.push(feedItem);

    // Invalidate hot cache
    this.hotCache_.computedAt = 0;

    // Notify tag watchers
    for (const tag of item.tags) {
      if (this.watchedTags_.has(tag)) {
        this._emit('community:feed', 'tag-match', { feed: feedItem, tag });
      }
    }

    this._emit('community:feed', 'new-item', feedItem);
    return feedItem;
  }

  getFeed(sort: FeedSort, limit = 20, offset = 0): FeedItem[] {
    let items: FeedItem[];

    switch (sort) {
      case 'hot':
        if (this.hotCache_.computedAt > 0 && Date.now() - this.hotCache_.computedAt < this.HOT_CACHE_MS) {
          items = this.hotCache_.items;
        } else {
          items = [...this.feed_].sort((a, b) => b.hotScore - a.hotScore);
          this.hotCache_ = { items, computedAt: Date.now() };
        }
        break;
      case 'new':
        items = [...this.feed_].sort((a, b) => b.createdAt - a.createdAt);
        break;
      case 'trending': {
        const now = Date.now();
        const recent = this.feed_.filter(f => now - f.createdAt < 7 * 24 * 3600000);
        items = recent.sort((a, b) => {
          const recencyA = 1 / (1 + (now - a.createdAt) / 3600000);
          const recencyB = 1 / (1 + (now - b.createdAt) / 3600000);
          return (b.stats.likes * recencyB) - (a.stats.likes * recencyA);
        });
        break;
      }
      default:
        items = [...this.feed_];
    }

    return items.slice(offset, offset + limit);
  }

  /**
   * Hot score formula:
   *   likes × 3 + comments × 5 + adoptions × 8 + reshares × 4 + views × 0.5
   *   ÷ ageInHours^1.5
   */
  private _calcHotScore(stats: FeedItem['stats'], createdAt: number): number {
    const ageHours = Math.max(1, (Date.now() - createdAt) / 3600000);
    const raw = stats.likes * 3 + stats.comments * 5 + stats.adoptions * 8 + stats.reshares * 4 + stats.views * 0.5 + stats.bookmarks * 2;
    return Math.round(raw / Math.pow(ageHours, 1.5));
  }

  getFeedByTag(tag: string, limit = 20): FeedItem[] {
    return this.feed_.filter(f => f.tags.includes(tag)).slice(0, limit);
  }

  getFeedBySymbol(symbol: string, limit = 20): FeedItem[] {
    return this.feed_.filter(f => f.symbol === symbol).slice(0, limit);
  }

  getFeedByUser(userId: string, limit = 20): FeedItem[] {
    return this.feed_.filter(f => f.authorId === userId).slice(0, limit);
  }

  // ── Social Interactions → Real-time IPC ───────────────────────────────

  likeFeedItem(shareId: string, userId: string): boolean {
    const item = this.feed_.find(f => f.shareId === shareId);
    if (!item) return false;
    item.stats.likes++;
    this.hotCache_.computedAt = 0; // invalidate

    // Notify author
    if (userId !== item.authorId) {
      this._createNotification(item.authorId, 'like', shareId, item.type, userId, item.authorName, item.authorName, item.titleCn);
    }

    this._emit('community:social', 'like', { shareId, userId, totalLikes: item.stats.likes });
    return true;
  }

  viewFeedItem(shareId: string): boolean {
    const item = this.feed_.find(f => f.shareId === shareId);
    if (!item) return false;
    item.stats.views++;
    this.hotCache_.computedAt = 0;
    this._emit('community:social', 'view', { shareId, totalViews: item.stats.views });
    return true;
  }

  bookmarkFeedItem(shareId: string, userId: string): boolean {
    const item = this.feed_.find(f => f.shareId === shareId);
    if (!item) return false;
    item.stats.bookmarks++;
    this.hotCache_.computedAt = 0;
    if (userId !== item.authorId) {
      this._createNotification(item.authorId, 'bookmark', shareId, item.type, userId, item.authorName, item.authorName, item.titleCn);
    }
    this._emit('community:social', 'bookmark', { shareId, userId, totalBookmarks: item.stats.bookmarks });
    return true;
  }

  adoptFeedItem(shareId: string, userId: string): boolean {
    const item = this.feed_.find(f => f.shareId === shareId);
    if (!item) return false;
    item.stats.adoptions++;
    this.hotCache_.computedAt = 0;
    if (userId !== item.authorId) {
      this._createNotification(item.authorId, 'adopt', shareId, item.type, userId, item.authorName, item.authorName, item.titleCn);
    }
    this._emit('community:social', 'adopt', { shareId, userId, totalAdoptions: item.stats.adoptions });
    return true;
  }

  reshareFeedItem(shareId: string, userId: string): boolean {
    const item = this.feed_.find(f => f.shareId === shareId);
    if (!item) return false;
    item.stats.reshares++;
    this.hotCache_.computedAt = 0;
    if (userId !== item.authorId) {
      this._createNotification(item.authorId, 'reshare', shareId, item.type, userId, item.authorName, item.authorName, item.titleCn);
    }
    this._emit('community:social', 'reshare', { shareId, userId, totalReshares: item.stats.reshares });
    return true;
  }

  commentOnFeedItem(shareId: string, comment: { userId: string; userName: string; text: string; textCn?: string }): CommunityNotification | null {
    const item = this.feed_.find(f => f.shareId === shareId);
    if (!item) return null;
    item.stats.comments++;
    this.hotCache_.computedAt = 0;
    this._emit('community:social', 'comment', { shareId, userId: comment.userId, totalComments: item.stats.comments, text: comment.text });

    if (comment.userId !== item.authorId) {
      return this._createNotification(item.authorId, 'comment', shareId, item.type, comment.userId, comment.userName, comment.userName, item.titleCn, comment.text);
    }
    return null;
  }

  // ── Notifications Pipeline ────────────────────────────────────────────

  private _createNotification(
    userId: string, type: CommunityNotification['type'],
    targetId: string, targetType: CommunityNotification['targetType'],
    actorId: string, actorName: string,
    authorName: string, targetTitle: string,
    commentText?: string,
  ): CommunityNotification {
    const msgMap: Record<string, { en: string; cn: string }> = {
      like: { en: `${authorName} liked your ${targetType}`, cn: `${authorName} 赞了你的${targetType}` },
      comment: { en: `${authorName} commented: "${commentText?.slice(0, 50)}..."`, cn: `${authorName} 评论了你的${targetType}："${commentText?.slice(0, 50)}..."` },
      adopt: { en: `${authorName} adopted your strategy`, cn: `${authorName} 采纳了你的策略` },
      reshare: { en: `${authorName} reshared your ${targetType}`, cn: `${authorName} 转发了你的分享` },
      bookmark: { en: `${authorName} bookmarked your ${targetType}`, cn: `${authorName} 收藏了你的分享` },
      follow: { en: `${authorName} followed you`, cn: `${authorName} 关注了你` },
      mention: { en: `${authorName} mentioned you`, cn: `${authorName} 提到了你` },
    };

    const messages = msgMap[type] || { en: `${authorName} interacted with your ${targetType}`, cn: `${authorName} 与你的${targetType}互动` };

    const notification: CommunityNotification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      userId, type, targetId, targetType,
      actorId, actorName,
      message: messages.en,
      messageCn: messages.cn,
      isRead: false,
      createdAt: Date.now(),
    };

    this.notifications_.push(notification);
    this._emit('community:notification', 'new', notification);
    return notification;
  }

  getNotifications(userId: string, unreadOnly = false, limit = 50): CommunityNotification[] {
    let items = this.notifications_.filter(n => n.userId === userId);
    if (unreadOnly) items = items.filter(n => !n.isRead);
    return items.sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
  }

  markNotificationRead(notificationId: string): boolean {
    const n = this.notifications_.find(n => n.id === notificationId);
    if (!n) return false;
    n.isRead = true;
    this._emit('community:notification', 'read', { notificationId });
    return true;
  }

  getUnreadCount(userId: string): number {
    return this.notifications_.filter(n => n.userId === userId && !n.isRead).length;
  }

  // ── Template Market Sync ──────────────────────────────────────────────

  publishTemplate(params: {
    authorId: string; authorName: string;
    name: string; nameCn: string;
    description: string; descriptionCn: string;
    symbol: string; tags: string[];
    previewImage?: string;
    templateData: unknown;
    price?: number; // 0 = free
  }): FeedItem {
    const feedItem = this.publishToFeed({
      shareId: `tmpl_${Date.now()}`,
      authorId: params.authorId,
      authorName: params.authorName,
      symbol: params.symbol,
      title: params.name,
      titleCn: params.nameCn,
      description: params.description,
      descriptionCn: params.descriptionCn,
      type: 'template',
      previewImage: params.previewImage,
      tags: [...params.tags, 'template', params.price && params.price > 0 ? 'paid' : 'free'],
      stats: { likes: 0, views: 0, bookmarks: 0, comments: 0, adoptions: 0, reshares: 0 },
      createdAt: Date.now(),
    });

    this._emit('community:template', 'published', { feedItem, price: params.price || 0, templateData: params.templateData });
    return feedItem;
  }

  rateTemplate(templateId: string, userId: string, rating: TemplateRating): boolean {
    const item = this.feed_.find(f => f.shareId === templateId);
    if (!item) return false;
    this._emit('community:template', 'rated', { templateId, userId, rating });
    return true;
  }

  downloadTemplate(templateId: string, userId: string): boolean {
    const item = this.feed_.find(f => f.shareId === templateId);
    if (!item) return false;
    item.stats.adoptions++;
    this.hotCache_.computedAt = 0;
    this._emit('community:template', 'downloaded', { templateId, userId });
    return true;
  }

  // ── User Dynamic Feed ─────────────────────────────────────────────────

  getUserFeed(userId: string): FeedItem[] {
    return this.feed_.filter(f => f.authorId === userId).sort((a, b) => b.createdAt - a.createdAt);
  }

  followUser(followerId: string, followeeId: string, followerName: string, followeeName: string): void {
    const notification = this._createNotification(followeeId, 'follow', followeeId, 'drawing', followerId, followerName, followeeName, followeeName);
    this._notifyUserStream(followerId, followeeId);
  }

  getUserFollowingFeed(userId: string, limit = 20): FeedItem[] {
    // Get feed from users this user follows (mocked since no DB)
    return this.getFeed('new', limit);
  }

  private _notifyUserStream(userId: string, _targetId: string): void {
    this._emit('community:user', 'follow', { userId, targetId: _targetId, timestamp: Date.now() });
  }

  // ── Tag Watch ─────────────────────────────────────────────────────────

  watchTag(tag: string): void {
    this.watchedTags_.add(tag);
  }

  unwatchTag(tag: string): void {
    this.watchedTags_.delete(tag);
  }

  getTrendingTags(limit = 10): Array<{ tag: string; count: number; hotScore: number }> {
    const tagCount: Map<string, { count: number; totalLikes: number }> = new Map();
    const now = Date.now();
    const recent = this.feed_.filter(f => now - f.createdAt < 7 * 24 * 3600000);

    for (const item of recent) {
      for (const tag of item.tags) {
        const existing = tagCount.get(tag) || { count: 0, totalLikes: 0 };
        existing.count++;
        existing.totalLikes += item.stats.likes;
        tagCount.set(tag, existing);
      }
    }

    return Array.from(tagCount.entries())
      .map(([tag, stats]) => ({ tag, count: stats.count, hotScore: stats.count + stats.totalLikes * 0.5 }))
      .sort((a, b) => b.hotScore - a.hotScore)
      .slice(0, limit);
  }

  // ── Stats ─────────────────────────────────────────────────────────────

  getStats() {
    const now = Date.now();
    const dayAgo = now - 24 * 3600000;
    return {
      totalShares: this.feed_.length,
      dailyShares: this.feed_.filter(f => f.createdAt > dayAgo).length,
      totalNotifications: this.notifications_.length,
      totalUnread: this.notifications_.filter(n => !n.isRead).length,
      activeTags: this.watchedTags_.size,
      hotItems: this.getFeed('hot', 5),
    };
  }

  reset(): void {
    this.feed_ = [];
    this.notifications_ = [];
    this.listeners_ = new Map();
    this.watchedTags_ = new Set();
    this.userSubscriptions_ = new Map();
    this.hotCache_ = { items: [], computedAt: 0 };
  }
}

export const communityIpcV5Bridge = new CommunityIpcV5Bridge();

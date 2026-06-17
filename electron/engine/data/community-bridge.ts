/**
 * R259 P1-09: 社区桥接 (CommunityBridge)
 * 
 * 社区/社交功能数据桥接 — 用户行为与互动数据管道
 * 
 * 功能:
 *   1. 用户策略分享数据 (信号公开/隐私控制)
 *   2. 社区热度排行 (热门策略/热门讨论)
 *   3. 跟随/订阅关系图
 *   4. 社区事件通知 (follow/unfollow/like/comment)
 *   5. 排行榜生成 (收益率/胜率/夏普)
 * 
 * 下游: community UI, leaderboard, social feed
 */

import { createHash } from 'crypto';

// ── Types ──────────────────────────────────────────────────────────────────

export type SocialAction = 'follow' | 'unfollow' | 'like' | 'comment' | 'share' | 'copy_strategy';

export interface SocialEvent {
  eventId: string;
  actorId: string;          // who did it
  targetId: string;         // who/what received it
  targetType: 'user' | 'strategy' | 'signal' | 'comment';
  action: SocialAction;
  metadata?: Record<string, string>;
  timestamp: number;
}

export interface UserProfile {
  userId: string;
  username: string;
  displayName: string;
  avatar?: string;
  bio?: string;
  followers: number;
  following: number;
  totalLikes: number;
  strategiesShared: number;
  winRate?: number;
  totalReturn?: number;
  joinedAt: number;
}

export interface SharedStrategy {
  shareId: string;
  ownerId: string;
  ownerName: string;
  strategyName: string;
  strategyType: string;
  visibility: 'public' | 'followers' | 'private';
  description: string;
  descriptionCn: string;
  metrics: {
    totalReturn: number;
    winRate: number;
    sharpeRatio: number;
    maxDrawdown: number;
    tradesCount: number;
  };
  likes: number;
  copies: number;
  comments: number;
  sharedAt: number;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  displayName: string;
  score: number;
  category: LeaderboardCategory;
  metrics: Record<string, number>;
}

export type LeaderboardCategory = 'total_return' | 'win_rate' | 'sharpe' | 'popularity' | 'consistency';

export interface CommunityStats {
  totalUsers: number;
  totalStrategies: number;
  totalFollows: number;
  totalLikes: number;
  totalCopies: number;
  activeToday: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// CommunityBridge
// ═══════════════════════════════════════════════════════════════════════════

export class CommunityBridge {
  private events: SocialEvent[] = [];
  private profiles: Map<string, UserProfile> = new Map();
  private strategies: Map<string, SharedStrategy> = new Map();
  private follows: Map<string, Set<string>> = new Map(); // userId → followerIds
  private likes: Map<string, Set<string>> = new Map();   // strategyId → userIds
  private leaderboards: Map<LeaderboardCategory, LeaderboardEntry[]> = new Map();
  private stats_: CommunityStats = {
    totalUsers: 0, totalStrategies: 0, totalFollows: 0,
    totalLikes: 0, totalCopies: 0, activeToday: 0,
  };

  constructor() {}

  // ── Public API: User Profiles ───────────────────────────────────────────

  /** Register a user profile */
  registerUser(profile: UserProfile): UserProfile {
    this.profiles.set(profile.userId, { ...profile });
    this.stats_.totalUsers = this.profiles.size;
    return profile;
  }

  /** Get user profile */
  getUser(userId: string): UserProfile | null {
    return this.profiles.get(userId) ?? null;
  }

  /** Update user profile metrics */
  updateUserMetrics(userId: string, metrics: Partial<Pick<UserProfile, 'winRate' | 'totalReturn' | 'followers' | 'following'>>): boolean {
    const profile = this.profiles.get(userId);
    if (!profile) return false;
    Object.assign(profile, metrics);
    return true;
  }

  // ── Public API: Social Actions ──────────────────────────────────────────

  /** Follow a user */
  follow(actorId: string, targetId: string): SocialEvent {
    // Add follower
    const followers = this.follows.get(targetId) ?? new Set();
    followers.add(actorId);
    this.follows.set(targetId, followers);

    // Update profiles
    const target = this.profiles.get(targetId);
    if (target) target.followers++;

    const actor = this.profiles.get(actorId);
    if (actor) actor.following++;

    this.stats_.totalFollows++;

    return this._recordEvent(actorId, targetId, 'user', 'follow');
  }

  /** Unfollow a user */
  unfollow(actorId: string, targetId: string): SocialEvent {
    const followers = this.follows.get(targetId);
    if (followers) followers.delete(actorId);

    const target = this.profiles.get(targetId);
    if (target && target.followers > 0) target.followers--;

    const actor = this.profiles.get(actorId);
    if (actor && actor.following > 0) actor.following--;

    return this._recordEvent(actorId, targetId, 'user', 'unfollow');
  }

  /** Like a strategy */
  like(actorId: string, strategyId: string): SocialEvent {
    const likers = this.likes.get(strategyId) ?? new Set();
    if (likers.has(actorId)) {
      return this._recordEvent(actorId, strategyId, 'strategy', 'like');
    }
    likers.add(actorId);
    this.likes.set(strategyId, likers);

    const strategy = this.strategies.get(strategyId);
    if (strategy) strategy.likes++;

    const actor = this.profiles.get(actorId);
    if (actor) actor.totalLikes++;

    this.stats_.totalLikes++;

    return this._recordEvent(actorId, strategyId, 'strategy', 'like');
  }

  /** Unlike a strategy */
  unlike(actorId: string, strategyId: string): SocialEvent {
    const likers = this.likes.get(strategyId);
    if (likers) likers.delete(actorId);

    const strategy = this.strategies.get(strategyId);
    if (strategy && strategy.likes > 0) strategy.likes--;

    return this._recordEvent(actorId, strategyId, 'strategy', 'like');
  }

  /** Check if user follows another */
  isFollowing(followerId: string, targetId: string): boolean {
    return this.follows.get(targetId)?.has(followerId) ?? false;
  }

  /** Check if user liked a strategy */
  hasLiked(userId: string, strategyId: string): boolean {
    return this.likes.get(strategyId)?.has(userId) ?? false;
  }

  /** Get followers count */
  getFollowerCount(userId: string): number {
    return this.follows.get(userId)?.size ?? 0;
  }

  /** Get followers list */
  getFollowers(userId: string): string[] {
    return Array.from(this.follows.get(userId) ?? []);
  }

  // ── Public API: Shared Strategies ───────────────────────────────────────

  /** Share a strategy to the community */
  shareStrategy(params: {
    ownerId: string;
    ownerName: string;
    strategyName: string;
    strategyType: string;
    visibility: SharedStrategy['visibility'];
    description: string;
    descriptionCn: string;
    metrics: SharedStrategy['metrics'];
  }): SharedStrategy {
    const share: SharedStrategy = {
      shareId: `share:${params.ownerId}:${Date.now()}:${this._hash(params.strategyName).toString(36).slice(0, 6)}`,
      ...params,
      likes: 0,
      copies: 0,
      comments: 0,
      sharedAt: Date.now(),
    };

    this.strategies.set(share.shareId, share);
    this.stats_.totalStrategies++;

    const owner = this.profiles.get(params.ownerId);
    if (owner) owner.strategiesShared++;

    return share;
  }

  /** Copy a strategy */
  copyStrategy(strategyId: string, copierId: string): SocialEvent | null {
    const strategy = this.strategies.get(strategyId);
    if (!strategy) return null;

    strategy.copies++;
    this.stats_.totalCopies++;

    return this._recordEvent(copierId, strategyId, 'strategy', 'copy_strategy');
  }

  /** Comment on a strategy */
  comment(userId: string, strategyId: string, text: string): SocialEvent {
    const strategy = this.strategies.get(strategyId);
    if (strategy) strategy.comments++;

    return this._recordEvent(userId, strategyId, 'comment', 'comment', { text });
  }

  /** Get public strategies feed */
  getStrategyFeed(sort: 'latest' | 'popular' | 'trending' = 'latest', limit = 20): SharedStrategy[] {
    const public_ = Array.from(this.strategies.values())
      .filter(s => s.visibility === 'public');

    switch (sort) {
      case 'popular':
        return public_.sort((a, b) => (b.likes + b.copies * 2) - (a.likes + a.copies * 2)).slice(0, limit);
      case 'trending':
        return public_.sort((a, b) => {
          const aScore = (a.likes + a.copies * 3 + a.comments * 0.5) / (Date.now() - a.sharedAt + 1) * 1e8;
          const bScore = (b.likes + b.copies * 3 + b.comments * 0.5) / (Date.now() - b.sharedAt + 1) * 1e8;
          return bScore - aScore;
        }).slice(0, limit);
      default:
        return public_.sort((a, b) => b.sharedAt - a.sharedAt).slice(0, limit);
    }
  }

  /** Get strategies by user */
  getUserStrategies(userId: string): SharedStrategy[] {
    return Array.from(this.strategies.values())
      .filter(s => s.ownerId === userId)
      .sort((a, b) => b.sharedAt - a.sharedAt);
  }

  /** Get a single strategy */
  getStrategy(shareId: string): SharedStrategy | null {
    return this.strategies.get(shareId) ?? null;
  }

  // ── Public API: Leaderboard ─────────────────────────────────────────────

  /**
   * Generate leaderboard from user profiles.
   */
  generateLeaderboard(category: LeaderboardCategory, limit = 20): LeaderboardEntry[] {
    const users = Array.from(this.profiles.values());
    let entries: Array<{ userId: string; username: string; displayName: string; score: number; metrics: Record<string, number> }> = [];

    switch (category) {
      case 'total_return':
        entries = users
          .filter(u => u.totalReturn !== undefined)
          .map(u => ({
            userId: u.userId, username: u.username, displayName: u.displayName,
            score: u.totalReturn ?? 0,
            metrics: { totalReturn: u.totalReturn ?? 0 },
          }))
          .sort((a, b) => b.score - a.score);
        break;

      case 'win_rate':
        entries = users
          .filter(u => u.winRate !== undefined)
          .map(u => ({
            userId: u.userId, username: u.username, displayName: u.displayName,
            score: u.winRate ?? 0,
            metrics: { winRate: u.winRate ?? 0 },
          }))
          .sort((a, b) => b.score - a.score);
        break;

      case 'popularity':
        entries = users.map(u => ({
          userId: u.userId, username: u.username, displayName: u.displayName,
          score: u.followers * 2 + u.totalLikes,
          metrics: { followers: u.followers, totalLikes: u.totalLikes, strategies: u.strategiesShared },
        }))
          .sort((a, b) => b.score - a.score);
        break;

      case 'consistency':
        entries = users
          .filter(u => u.winRate !== undefined)
          .map(u => ({
            userId: u.userId, username: u.username, displayName: u.displayName,
            score: (u.winRate ?? 0) * (u.strategiesShared > 0 ? Math.log(u.strategiesShared) : 1),
            metrics: { winRate: u.winRate ?? 0, strategies: u.strategiesShared },
          }))
          .sort((a, b) => b.score - a.score);
        break;

      default:
        break;
    }

    const ranked = entries.slice(0, limit).map((e, i) => ({
      rank: i + 1,
      ...e,
      category,
    }));

    this.leaderboards.set(category, ranked);
    return ranked;
  }

  /** Get cached leaderboard */
  getLeaderboard(category: LeaderboardCategory): LeaderboardEntry[] {
    return this.leaderboards.get(category) ?? [];
  }

  // ── Public API: Query ───────────────────────────────────────────────────

  /** Get social events feed */
  getEventFeed(limit = 50): SocialEvent[] {
    return this.events.slice(-limit).reverse();
  }

  /** Get community stats */
  getCommunityStats(): CommunityStats {
    return { ...this.stats_, activeToday: this._countActiveToday() };
  }

  /** Reset */
  reset(): void {
    this.events = [];
    this.profiles.clear();
    this.strategies.clear();
    this.follows.clear();
    this.likes.clear();
    this.leaderboards.clear();
    this.stats_ = { totalUsers: 0, totalStrategies: 0, totalFollows: 0, totalLikes: 0, totalCopies: 0, activeToday: 0 };
  }

  // ── Private ─────────────────────────────────────────────────────────────

  private _recordEvent(
    actorId: string,
    targetId: string,
    targetType: SocialEvent['targetType'],
    action: SocialAction,
    metadata?: Record<string, string>,
  ): SocialEvent {
    const event: SocialEvent = {
      eventId: `soc:${action}:${actorId.slice(0, 6)}:${targetId.slice(0, 6)}:${Date.now()}`,
      actorId,
      targetId,
      targetType,
      action,
      metadata,
      timestamp: Date.now(),
    };
    this.events.push(event);
    if (this.events.length > 1000) this.events.shift();
    return event;
  }

  private _countActiveToday(): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const cutoff = today.getTime();
    const activeUsers = new Set<string>();
    for (const event of this.events) {
      if (event.timestamp >= cutoff) {
        activeUsers.add(event.actorId);
      }
    }
    return activeUsers.size;
  }

  private _hash(input: string): number {
    const h = createHash('sha256').update(input).digest('hex');
    return parseInt(h.slice(0, 8), 16);
  }
}

export const communityBridge = new CommunityBridge();

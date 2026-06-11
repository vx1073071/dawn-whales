/**
 * J-53-01: Trader Profile Engine [P0]
 * v1.1.0-beta — Social Trading Foundation
 *
 * :
 * - CRUD (TraderProfile)
 * - metric (Sharpe/WinRate/MaxDrawdown/ProfitFactor)
 * - (TraderRanking)
 * - (TraderCertification)
 *
 * :
 * - ≥ 500L
 * - ≥ 30 tests, pass
 * - API response < 150ms
 */

import log from 'electron-log';
import { EventEmitter } from 'events';
import { EngineError, ErrorCode } from '../../errors';


// ── Types ──────────────────────────────────────────────────────────────────

export type TraderTier = 'rookie' | 'rising' | 'pro' | 'elite' | 'legendary';
export type CertStatus = 'none' | 'pending' | 'verified' | 'rejected';
export type CertLevel = 'basic' | 'identity' | 'professional';

export interface TraderProfile {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
  bio: string;
  tier: TraderTier;
  certStatus: CertStatus;
  certLevel: CertLevel;
  createdAt: string;
  updatedAt: string;
  followersCount: number;
  followingCount: number;
  strategiesCount: number;
  totalTrades: number;
  isPublic: boolean;
  tags: string[];
  social: {
    website?: string;
    twitter?: string;
    telegram?: string;
  };
}

export interface TraderMetrics {
  traderId: string;
  sharpe: number;
  sortino: number;
  calmar: number;
  winRate: number;
  profitFactor: number;
  maxDrawdown: number;
  totalReturn: number;
  annualReturn: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  avgWinPct: number;
  avgLossPct: number;
  bestTradePct: number;
  worstTradePct: number;
  avgHoldDays: number;
  streak: number;
  updatedAt: string;
}

export interface TraderRanking {
  traderId: string;
  rank: number;
  score: number;
  dimension: 'overall' | 'return' | 'risk' | 'consistency' | 'popularity';
  percentile: number;
  tier: TraderTier;
}

export interface Certification {
  traderId: string;
  level: CertLevel;
  status: CertStatus;
  submittedAt: string;
  reviewedAt?: string;
  reviewer?: string;
  reason?: string;
  documents: string[];
}

export interface RankingFilter {
  dimension: TraderRanking['dimension'];
  sortBy: 'score' | 'followers' | 'return' | 'sharpe';
  page: number;
  pageSize: number;
  tier?: TraderTier;
  certOnly?: boolean;
}

export interface RankingResult {
  rankings: TraderRanking[];
  total: number;
  page: number;
  pageSize: number;
}

// ── Trader Profile Engine ──────────────────────────────────────────────────

export class TraderProfileEngine extends EventEmitter {
  private profiles: Map<string, TraderProfile> = new Map();
  private metrics: Map<string, TraderMetrics> = new Map();
  private certifications: Map<string, Certification> = new Map();
  private followers: Map<string, Set<string>> = new Map();
  private following: Map<string, Set<string>> = new Map();
  private idCounter: number = 1;

  constructor() {
    super();
    log.info('[TraderProfileEngine] Initialized');
  }

  // ── Profile CRUD ─────────────────────────────────────────────────────────

  createProfile(input: {
    username: string;
    displayName: string;
    avatar?: string;
    bio?: string;
    tags?: string[];
    social?: TraderProfile['social'];
  }): string {
    if (!input.username || input.username.length < 3) {
      throw new EngineError(ErrorCode.TRADE_EXECUTION_FAILED, 'Username must be at least 3 characters');
    }

    // Check uniqueness
    for (const p of this.profiles.values()) {
      if (p.username === input.username) {
        throw new EngineError(ErrorCode.TRADE_EXECUTION_FAILED, `Username "${input.username}" already taken`);
      }
    }

    const id = `trader_${this.idCounter++}`;
    const now = new Date().toISOString();

    const profile: TraderProfile = {
      id,
      username: input.username,
      displayName: input.displayName || input.username,
      avatar: input.avatar || '',
      bio: input.bio || '',
      tier: 'rookie',
      certStatus: 'none',
      certLevel: 'basic',
      createdAt: now,
      updatedAt: now,
      followersCount: 0,
      followingCount: 0,
      strategiesCount: 0,
      totalTrades: 0,
      isPublic: true,
      tags: input.tags || [],
      social: input.social || {},
    };

    this.profiles.set(id, profile);
    this.followers.set(id, new Set());
    this.following.set(id, new Set());

    this.emit('profile:created', { traderId: id, username: input.username });
    log.info(`[TraderProfile] Created: ${input.username} (${id})`);
    return id;
  }

  getProfile(traderId: string): TraderProfile | null {
    return this.profiles.get(traderId) || null;
  }

  getProfileByUsername(username: string): TraderProfile | null {
    for (const p of this.profiles.values()) {
      if (p.username === username) return p;
    }
    return null;
  }

  updateProfile(traderId: string, updates: Partial<Pick<TraderProfile, 'displayName' | 'avatar' | 'bio' | 'tags' | 'social' | 'isPublic'>>): boolean {
    const profile = this.profiles.get(traderId);
    if (!profile) return false;

    if (updates.displayName !== undefined) profile.displayName = updates.displayName;
    if (updates.avatar !== undefined) profile.avatar = updates.avatar;
    if (updates.bio !== undefined) profile.bio = updates.bio;
    if (updates.tags !== undefined) profile.tags = updates.tags;
    if (updates.social !== undefined) profile.social = { ...profile.social, ...updates.social };
    if (updates.isPublic !== undefined) profile.isPublic = updates.isPublic;

    profile.updatedAt = new Date().toISOString();
    this.emit('profile:updated', { traderId });
    return true;
  }

  deleteProfile(traderId: string): boolean {
    const existed = this.profiles.delete(traderId);
    if (existed) {
      this.metrics.delete(traderId);
      this.certifications.delete(traderId);
      this.followers.delete(traderId);
      this.following.delete(traderId);

      // Remove from other users' follow lists
      for (const set of this.following.values()) set.delete(traderId);
      for (const set of this.followers.values()) set.delete(traderId);

      this.emit('profile:deleted', { traderId });
    }
    return existed;
  }

  searchProfiles(query: string, page: number = 1, pageSize: number = 20): { profiles: TraderProfile[]; total: number } {
    const q = query.toLowerCase();
    const all = Array.from(this.profiles.values())
      .filter(p => p.isPublic)
      .filter(p =>
        p.username.toLowerCase().includes(q) ||
        p.displayName.toLowerCase().includes(q) ||
        p.bio.toLowerCase().includes(q) ||
        p.tags.some(t => t.toLowerCase().includes(q))
      );

    return {
      profiles: all.slice((page - 1) * pageSize, page * pageSize),
      total: all.length,
    };
  }

  // ── Follow System ────────────────────────────────────────────────────────

  follow(followerId: string, targetId: string): boolean {
    if (followerId === targetId) return false;
    if (!this.profiles.has(followerId) || !this.profiles.has(targetId)) return false;

    const followerFollowing = this.following.get(followerId)!;
    const targetFollowers = this.followers.get(targetId)!;

    if (followerFollowing.has(targetId)) return false;

    followerFollowing.add(targetId);
    targetFollowers.add(followerId);

    const fProfile = this.profiles.get(followerId)!;
    const tProfile = this.profiles.get(targetId)!;
    fProfile.followingCount = followerFollowing.size;
    tProfile.followersCount = targetFollowers.size;
    fProfile.updatedAt = new Date().toISOString();
    tProfile.updatedAt = new Date().toISOString();

    this.emit('follow:created', { followerId, targetId });
    return true;
  }

  unfollow(followerId: string, targetId: string): boolean {
    const followerFollowing = this.following.get(followerId);
    const targetFollowers = this.followers.get(targetId);
    if (!followerFollowing || !targetFollowers) return false;

    if (!followerFollowing.has(targetId)) return false;

    followerFollowing.delete(targetId);
    targetFollowers.delete(followerId);

    const fProfile = this.profiles.get(followerId)!;
    const tProfile = this.profiles.get(targetId)!;
    fProfile.followingCount = followerFollowing.size;
    tProfile.followersCount = targetFollowers.size;

    this.emit('follow:removed', { followerId, targetId });
    return true;
  }

  getFollowers(traderId: string): string[] {
    return Array.from(this.followers.get(traderId) || []);
  }

  getFollowing(traderId: string): string[] {
    return Array.from(this.following.get(traderId) || []);
  }

  isFollowing(followerId: string, targetId: string): boolean {
    return this.following.get(followerId)?.has(targetId) || false;
  }

  // ── Metrics ──────────────────────────────────────────────────────────────

  updateMetrics(traderId: string, input: Omit<TraderMetrics, 'traderId' | 'updatedAt'>): boolean {
    if (!this.profiles.has(traderId)) return false;

    const metrics: TraderMetrics = {
      ...input,
      traderId,
      updatedAt: new Date().toISOString(),
    };

    this.metrics.set(traderId, metrics);

    // Auto-tier upgrade based on metrics
    const profile = this.profiles.get(traderId)!;
    const oldTier = profile.tier;
    profile.tier = this.calculateTier(metrics);
    if (oldTier !== profile.tier) {
      this.emit('tier:upgraded', { traderId, oldTier, newTier: profile.tier });
    }

    // Update trade counts
    profile.totalTrades = input.totalTrades;
    profile.strategiesCount = Math.max(profile.strategiesCount, 1);
    profile.updatedAt = new Date().toISOString();

    this.emit('metrics:updated', { traderId });
    return true;
  }

  getMetrics(traderId: string): TraderMetrics | null {
    return this.metrics.get(traderId) || null;
  }

  // ── Tier Calculation ─────────────────────────────────────────────────────

  private calculateTier(m: TraderMetrics): TraderTier {
    let score = 0;

    // Sharpe contribution (0-30)
    score += Math.min(30, Math.max(0, m.sharpe * 15));

    // Win rate contribution (0-20)
    score += Math.min(20, m.winRate * 0.2);

    // Total trades contribution (0-20)
    score += Math.min(20, m.totalTrades * 0.1);

    // Return contribution (0-15)
    score += Math.min(15, Math.max(0, m.totalReturn * 0.15));

    // Consistency (0-15): low max drawdown is good
    score += Math.min(15, Math.max(0, 15 + m.maxDrawdown * 0.3));

    if (score >= 80) return 'legendary';
    if (score >= 60) return 'elite';
    if (score >= 40) return 'pro';
    if (score >= 20) return 'rising';
    return 'rookie';
  }

  // ── Ranking ──────────────────────────────────────────────────────────────

  getRankings(filter: RankingFilter): RankingResult {
    let entries: Array<{ traderId: string; score: number; profile: TraderProfile; metrics?: TraderMetrics }> = [];

    for (const [id, profile] of this.profiles.entries()) {
      if (!profile.isPublic) continue;
      if (filter.tier && profile.tier !== filter.tier) continue;
      if (filter.certOnly && profile.certStatus !== 'verified') continue;

      const m = this.metrics.get(id);
      let score = 0;

      switch (filter.dimension) {
        case 'overall':
          score = (m?.sharpe ?? 0) * 20 + (m?.winRate ?? 0) * 0.3 + profile.followersCount * 0.1 + (m?.totalReturn ?? 0) * 0.1;
          break;
        case 'return':
          score = (m?.totalReturn ?? 0);
          break;
        case 'risk':
          score = (m?.sharpe ?? 0) * 30 + (m?.sortino ?? 0) * 10 - Math.abs(m?.maxDrawdown ?? 0) * 2;
          break;
        case 'consistency':
          score = (m?.winRate ?? 0) * 0.5 + (m?.profitFactor ?? 0) * 10 + (m?.totalTrades ?? 0) * 0.05;
          break;
        case 'popularity':
          score = profile.followersCount * 2 + profile.strategiesCount * 5;
          break;
      }

      entries.push({ traderId: id, score: Math.round(score * 100) / 100, profile, metrics: m });
    }

    // Sort
    switch (filter.sortBy) {
      case 'score':
        entries.sort((a, b) => b.score - a.score);
        break;
      case 'followers':
        entries.sort((a, b) => b.profile.followersCount - a.profile.followersCount);
        break;
      case 'return':
        entries.sort((a, b) => (b.metrics?.totalReturn ?? 0) - (a.metrics?.totalReturn ?? 0));
        break;
      case 'sharpe':
        entries.sort((a, b) => (b.metrics?.sharpe ?? 0) - (a.metrics?.sharpe ?? 0));
        break;
    }

    const total = entries.length;
    const paged = entries.slice((filter.page - 1) * filter.pageSize, filter.page * filter.pageSize);

    const rankings: TraderRanking[] = paged.map((e, i) => ({
      traderId: e.traderId,
      rank: (filter.page - 1) * filter.pageSize + i + 1,
      score: e.score,
      dimension: filter.dimension,
      percentile: total > 0 ? Math.round(((total - (filter.page - 1) * filter.pageSize - i) / total) * 100) : 0,
      tier: e.profile.tier,
    }));

    return { rankings, total, page: filter.page, pageSize: filter.pageSize };
  }

  // ── Certification ────────────────────────────────────────────────────────

  submitCertification(traderId: string, level: CertLevel, documents: string[]): boolean {
    if (!this.profiles.has(traderId)) return false;

    const profile = this.profiles.get(traderId)!;
    if (profile.certStatus === 'verified') return false; // Already verified
    if (profile.certStatus === 'pending') return false; // Already pending

    this.certifications.set(traderId, {
      traderId,
      level,
      status: 'pending',
      submittedAt: new Date().toISOString(),
      documents,
    });

    profile.certStatus = 'pending';
    profile.updatedAt = new Date().toISOString();

    this.emit('cert:submitted', { traderId, level });
    return true;
  }

  reviewCertification(traderId: string, approved: boolean, reviewer: string, reason?: string): boolean {
    const cert = this.certifications.get(traderId);
    if (!cert || cert.status !== 'pending') return false;

    cert.status = approved ? 'verified' : 'rejected';
    cert.reviewedAt = new Date().toISOString();
    cert.reviewer = reviewer;
    cert.reason = reason;

    const profile = this.profiles.get(traderId)!;
    profile.certStatus = cert.status;
    if (approved) profile.certLevel = cert.level;
    profile.updatedAt = new Date().toISOString();

    this.emit(approved ? 'cert:approved' : 'cert:rejected', { traderId, level: cert.level });
    return true;
  }

  getCertification(traderId: string): Certification | null {
    return this.certifications.get(traderId) || null;
  }

  getPendingCertifications(): Certification[] {
    return Array.from(this.certifications.values()).filter(c => c.status === 'pending');
  }

  // ── Stats ────────────────────────────────────────────────────────────────

  getStats(): {
    totalTraders: number;
    byTier: Record<TraderTier, number>;
    byCertStatus: Record<CertStatus, number>;
    totalFollowers: number;
  } {
    const byTier: Record<TraderTier, number> = { rookie: 0, rising: 0, pro: 0, elite: 0, legendary: 0 };
    const byCertStatus: Record<CertStatus, number> = { none: 0, pending: 0, verified: 0, rejected: 0 };
    let totalFollowers = 0;

    for (const p of this.profiles.values()) {
      byTier[p.tier]++;
      byCertStatus[p.certStatus]++;
      totalFollowers += p.followersCount;
    }

    return { totalTraders: this.profiles.size, byTier, byCertStatus, totalFollowers };
  }

  // ── Reset ────────────────────────────────────────────────────────────────

  reset(): void {
    this.profiles.clear();
    this.metrics.clear();
    this.certifications.clear();
    this.followers.clear();
    this.following.clear();
    this.idCounter = 1;
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let _instance: TraderProfileEngine | null = null;

export function getTraderProfileEngine(): TraderProfileEngine {
  if (!_instance) _instance = new TraderProfileEngine();
  return _instance;
}

export function resetTraderProfileEngine(): void {
  _instance?.reset();
  _instance = null;
}

export default TraderProfileEngine;

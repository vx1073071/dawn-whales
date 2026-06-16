/**
 * R249 P1-03: 因子市场完善 (R248 P1-03 续)
 * 
 * 在 R246 FactorMarketplaceBridge + R248 FactorMarketplaceEnhancer 基础上新增:
 *   - 因子评价体系 (star rating + text review)
 *   - UGC提交→审核→上架 (submit→approve/reject→list)
 *   - 精选因子 (editor-featured curation)
 *   - 因子更新日志 (release notes / changelog)
 *   - 评论点赞 (review helpfulness voting)
 */

import { createHash } from 'crypto';

// ── Types ──────────────────────────────────────────────────────────────────

export interface FactorReview {
  reviewId: string;
  factorId: string;
  userId: string;
  rating: number;              // 1-5 stars
  title: string;
  body: string;
  helpfulCount: number;
  helpfulVoters: string[];     // userIds who voted helpful
  language: string;
  createdAt: number;
  updatedAt: number;
}

export interface ReviewStats {
  factorId: string;
  avgRating: number;
  totalReviews: number;
  distribution: Record<number, number>; // 1-5 star → count
  mostHelpfulReview: FactorReview | null;
  recentReviews: FactorReview[];
}

export interface UGCSubmission {
  submissionId: string;
  factorId: string;
  creatorId: string;
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
  name: string;
  nameCn: string;
  domain: string;
  description: string;
  descriptionCn: string;
  ic: number;
  sharpe: number;
  backtest: {
    totalReturn: number;
    maxDrawdown: number;
    winRate: number;
  };
  buyoutPrice: number;
  proPriceMonthly: number;
  applicableMarkets: string[];
  submittedAt: number;
  reviewedAt?: number;
  reviewerId?: string;
  rejectReason?: string;
  revisions: UGCRevision[];
}

export interface UGCRevision {
  revisedAt: number;
  changes: string;
  reviewerId: string;
}

export interface UGCQueue {
  pending: UGCSubmission[];
  approved: UGCSubmission[];
  rejected: UGCSubmission[];
  totalSubmissions: number;
  approvalRate: number;
}

export interface FeaturedFactor {
  factorId: string;
  featureId: string;
  title: string;
  titleCn: string;
  reason: string;
  reasonCn: string;
  curatedAt: number;
  curatorId: string;
  expiresAt?: number;
  sortOrder: number;
}

export interface FactorChangelogEntry {
  changelogId: string;
  factorId: string;
  version: string;
  releaseDate: number;
  changes: string[];
  changesCn: string[];
  severity: 'major' | 'minor' | 'patch';
  authorId: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// FactorMarketplaceCompletion
// ═══════════════════════════════════════════════════════════════════════════

export class FactorMarketplaceCompletion {
  // Reviews
  private reviews: Map<string, FactorReview[]> = new Map();
  // UGC Submissions
  private submissions: Map<string, UGCSubmission> = new Map();
  // Featured
  private featured: Map<string, FeaturedFactor> = new Map();
  // Changelog
  private changelogs: Map<string, FactorChangelogEntry[]> = new Map();
  // Stats
  private stats_ = { totalReviews: 0, totalSubmissionsSubmitted: 0, totalSubmissionsApproved: 0, totalSubmissionsRejected: 0 };

  constructor() {}

  // ═══════════════════════════════════════════════════════════════════════
  // REVIEWS — 因子评价体系
  // ═══════════════════════════════════════════════════════════════════════

  /** Submit a review for a factor */
  submitReview(
    factorId: string,
    userId: string,
    data: { rating: number; title: string; body: string; language?: string },
  ): FactorReview {
    const rating = Math.max(1, Math.min(5, Math.round(data.rating)));

    const review: FactorReview = {
      reviewId: `rev:${factorId}:${userId}:${Date.now()}`,
      factorId, userId,
      rating, title: data.title, body: data.body,
      helpfulCount: 0,
      helpfulVoters: [],
      language: data.language ?? 'en',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const existing = this.reviews.get(factorId) ?? [];
    // Replace existing review from same user
    const idx = existing.findIndex(r => r.userId === userId);
    if (idx >= 0) {
      review.helpfulCount = existing[idx].helpfulCount;
      review.helpfulVoters = existing[idx].helpfulVoters;
      existing[idx] = review;
    } else {
      existing.push(review);
    }

    this.reviews.set(factorId, existing);
    this.stats_.totalReviews++;
    return review;
  }

  /** Vote a review as helpful */
  voteHelpful(factorId: string, reviewId: string, userId: string): boolean {
    const factorReviews = this.reviews.get(factorId);
    if (!factorReviews) return false;

    const review = factorReviews.find(r => r.reviewId === reviewId);
    if (!review) return false;
    if (review.helpfulVoters.includes(userId)) return false; // already voted

    review.helpfulCount++;
    review.helpfulVoters.push(userId);
    return true;
  }

  /** Get review stats for a factor */
  getReviewStats(factorId: string): ReviewStats {
    const factorReviews = this.reviews.get(factorId) ?? [];

    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let totalRating = 0;
    for (const r of factorReviews) {
      distribution[r.rating]++;
      totalRating += r.rating;
    }

    const avgRating = factorReviews.length > 0
      ? Math.round(totalRating / factorReviews.length * 10) / 10
      : 0;

    const sorted = [...factorReviews].sort((a, b) => b.helpfulCount - a.helpfulCount);
    const mostHelpful = sorted[0] ?? null;
    const recent = [...factorReviews]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 5);

    return {
      factorId,
      avgRating,
      totalReviews: factorReviews.length,
      distribution,
      mostHelpfulReview: mostHelpful,
      recentReviews: recent,
    };
  }

  /** Get all reviews for a factor */
  getReviews(factorId: string, options?: { page?: number; pageSize?: number; sortBy?: 'recent' | 'helpful' | 'highest' | 'lowest' }): {
    reviews: FactorReview[];
    total: number;
    page: number;
    pageSize: number;
    avgRating: number;
  } {
    const all = [...(this.reviews.get(factorId) ?? [])];
    const total = all.length;

    switch (options?.sortBy) {
      case 'helpful': all.sort((a, b) => b.helpfulCount - a.helpfulCount); break;
      case 'highest': all.sort((a, b) => b.rating - a.rating); break;
      case 'lowest': all.sort((a, b) => a.rating - b.rating); break;
      case 'recent':
      default: all.sort((a, b) => b.createdAt - a.createdAt); break;
    }

    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 10;
    const start = (page - 1) * pageSize;
    const reviews = all.slice(start, start + pageSize);

    const avgRating = total > 0
      ? Math.round(all.reduce((s, r) => s + r.rating, 0) / total * 10) / 10
      : 0;

    return { reviews, total, page, pageSize, avgRating };
  }

  /** Search reviews by keyword */
  searchReviews(
    keyword: string,
    options?: { factorId?: string; minRating?: number; page?: number; pageSize?: number },
  ): { reviews: FactorReview[]; total: number } {
    let all: FactorReview[] = [];
    for (const [fid, reviews] of this.reviews) {
      if (options?.factorId && fid !== options.factorId) continue;
      all.push(...reviews);
    }

    const kw = keyword.toLowerCase();
    all = all.filter(r =>
      (r.title.toLowerCase().includes(kw) || r.body.toLowerCase().includes(kw)) &&
      (options?.minRating === undefined || r.rating >= options.minRating),
    );

    all.sort((a, b) => b.createdAt - a.createdAt);

    const pageSize = options?.pageSize ?? 10;
    const start = ((options?.page ?? 1) - 1) * pageSize;
    return { reviews: all.slice(start, start + pageSize), total: all.length };
  }

  /** Delete a review (by author or moderator) */
  deleteReview(factorId: string, reviewId: string): boolean {
    const reviews = this.reviews.get(factorId);
    if (!reviews) return false;
    const idx = reviews.findIndex(r => r.reviewId === reviewId);
    if (idx < 0) return false;
    reviews.splice(idx, 1);
    return true;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // UGC SUBMISSIONS — 创作者提交因子
  // ═══════════════════════════════════════════════════════════════════════

  /** Submit a new factor for marketplace review */
  submitFactor(
    creatorId: string,
    data: {
      factorId: string; name: string; nameCn: string; domain: string;
      description: string; descriptionCn: string;
      ic: number; sharpe: number;
      backtest: { totalReturn: number; maxDrawdown: number; winRate: number };
      buyoutPrice: number; proPriceMonthly: number;
      applicableMarkets: string[];
    },
  ): UGCSubmission {
    const submission: UGCSubmission = {
      submissionId: `ugc:${data.factorId}:${Date.now()}`,
      factorId: data.factorId,
      creatorId,
      status: 'pending',
      name: data.name, nameCn: data.nameCn, domain: data.domain,
      description: data.description, descriptionCn: data.descriptionCn,
      ic: data.ic, sharpe: data.sharpe,
      backtest: data.backtest,
      buyoutPrice: data.buyoutPrice, proPriceMonthly: data.proPriceMonthly,
      applicableMarkets: data.applicableMarkets,
      submittedAt: Date.now(),
      revisions: [],
    };

    this.submissions.set(submission.submissionId, submission);
    this.stats_.totalSubmissionsSubmitted++;
    return submission;
  }

  /** Approve a submission */
  approveSubmission(submissionId: string, reviewerId: string): UGCSubmission | null {
    const sub = this.submissions.get(submissionId);
    if (!sub || sub.status !== 'pending') return null;

    sub.status = 'approved';
    sub.reviewedAt = Date.now();
    sub.reviewerId = reviewerId;
    this.stats_.totalSubmissionsApproved++;
    return sub;
  }

  /** Reject a submission with reason */
  rejectSubmission(submissionId: string, reviewerId: string, reason: string): UGCSubmission | null {
    const sub = this.submissions.get(submissionId);
    if (!sub || sub.status !== 'pending') return null;

    sub.status = 'rejected';
    sub.rejectReason = reason;
    sub.reviewedAt = Date.now();
    sub.reviewerId = reviewerId;
    this.stats_.totalSubmissionsRejected++;
    return sub;
  }

  /** Suspend an approved listing */
  suspendSubmission(submissionId: string, reason: string): UGCSubmission | null {
    const sub = this.submissions.get(submissionId);
    if (!sub || sub.status !== 'approved') return null;
    sub.status = 'suspended';
    sub.revisions.push({ revisedAt: Date.now(), changes: `Suspended: ${reason}`, reviewerId: 'system' });
    return sub;
  }

  /** Request revision */
  requestRevision(submissionId: string, reviewerId: string, changes: string): UGCSubmission | null {
    const sub = this.submissions.get(submissionId);
    if (!sub || sub.status !== 'pending') return null;
    sub.revisions.push({ revisedAt: Date.now(), changes, reviewerId });
    return sub;
  }

  /** Get UGC queue */
  getUGCQueue(): UGCQueue {
    const all = Array.from(this.submissions.values());
    const pending = all.filter(s => s.status === 'pending');
    const approved = all.filter(s => s.status === 'approved');
    const rejected = all.filter(s => s.status === 'rejected');

    return {
      pending,
      approved,
      rejected,
      totalSubmissions: all.length,
      approvalRate: all.length > 0
        ? Math.round(approved.length / all.length * 1000) / 10
        : 0,
    };
  }

  /** Get a specific submission */
  getSubmission(submissionId: string): UGCSubmission | null {
    return this.submissions.get(submissionId) ?? null;
  }

  /** Get creator's submissions */
  getCreatorSubmissions(creatorId: string): UGCSubmission[] {
    return Array.from(this.submissions.values()).filter(s => s.creatorId === creatorId);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // FEATURED — 精选因子
  // ═══════════════════════════════════════════════════════════════════════

  /** Feature a factor */
  featureFactor(
    factorId: string,
    data: {
      title: string; titleCn: string; reason: string; reasonCn: string;
      curatorId: string; sortOrder?: number; expiresAt?: number;
    },
  ): FeaturedFactor {
    const feature: FeaturedFactor = {
      featureId: `feature:${factorId}:${Date.now()}`,
      factorId,
      title: data.title, titleCn: data.titleCn,
      reason: data.reason, reasonCn: data.reasonCn,
      curatedAt: Date.now(),
      curatorId: data.curatorId,
      sortOrder: data.sortOrder ?? 0,
      expiresAt: data.expiresAt,
    };

    this.featured.set(feature.featureId, feature);
    return feature;
  }

  /** Remove a featured factor */
  unfeatureFactor(featureId: string): boolean {
    return this.featured.delete(featureId);
  }

  /** Get all featured factors (sorted, non-expired) */
  getFeatured(): FeaturedFactor[] {
    const now = Date.now();
    return Array.from(this.featured.values())
      .filter(f => !f.expiresAt || f.expiresAt > now)
      .sort((a, b) => a.sortOrder - b.sortOrder || b.curatedAt - a.curatedAt);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // CHANGELOG — 因子更新日志
  // ═══════════════════════════════════════════════════════════════════════

  /** Publish a changelog entry */
  publishChangelog(
    factorId: string,
    data: {
      version: string; changes: string[]; changesCn: string[];
      severity: 'major' | 'minor' | 'patch'; authorId: string;
    },
  ): FactorChangelogEntry {
    const entry: FactorChangelogEntry = {
      changelogId: `changelog:${factorId}:${data.version}:${Date.now()}`,
      factorId,
      version: data.version,
      releaseDate: Date.now(),
      changes: data.changes,
      changesCn: data.changesCn,
      severity: data.severity,
      authorId: data.authorId,
    };

    const existing = this.changelogs.get(factorId) ?? [];
    existing.push(entry);
    this.changelogs.set(factorId, existing);
    return entry;
  }

  /** Get changelog for a factor */
  getChangelog(factorId: string): FactorChangelogEntry[] {
    return (this.changelogs.get(factorId) ?? [])
      .sort((a, b) => b.releaseDate - a.releaseDate || this._compareVersions(b.version, a.version));
  }

  /** Get all changelogs across all factors */
  getAllChangelogs(limit = 20): FactorChangelogEntry[] {
    const all: FactorChangelogEntry[] = [];
    for (const entries of this.changelogs.values()) all.push(...entries);
    return all.sort((a, b) => b.releaseDate - a.releaseDate).slice(0, limit);
  }

  /** Get latest changelog entry for a factor */
  getLatestVersion(factorId: string): FactorChangelogEntry | null {
    const logs = this.getChangelog(factorId);
    return logs[0] ?? null;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // STATS
  // ═══════════════════════════════════════════════════════════════════════

  getStats() {
    return { ...this.stats_ };
  }

  private _compareVersions(a: string, b: string): number {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
      if (diff !== 0) return diff;
    }
    return 0;
  }

  reset(): void {
    this.reviews.clear();
    this.submissions.clear();
    this.featured.clear();
    this.changelogs.clear();
    this.stats_ = { totalReviews: 0, totalSubmissionsSubmitted: 0, totalSubmissionsApproved: 0, totalSubmissionsRejected: 0 };
  }
}

// ── Singleton ───────────────────────────────────────────────────────────────

let instance: FactorMarketplaceCompletion | null = null;

export function factorMarketplaceCompletion(): FactorMarketplaceCompletion {
  if (!instance) instance = new FactorMarketplaceCompletion();
  return instance;
}

export function resetFactorMarketplaceCompletion(): void { instance = null; }

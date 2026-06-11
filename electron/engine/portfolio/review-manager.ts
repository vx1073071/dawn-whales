/**
 * J-52-02: Review Manager (R52 P0)
 * strategy/policy + +
 *
 * Features:
 * - Create/edit/delete reviews
 * - Review audit workflow (pending → approved/rejected/flagged)
 * - Verified purchase validation
 * - Helpful/not-helpful voting
 * - Rating distribution per strategy
 * - Review moderation queue
 *
 * ≥400L, 25+ tests
 */

import log from 'electron-log';

// ── Types ──────────────────────────────────────────────────────────────────

export type ReviewStatus = 'pending' | 'approved' | 'rejected' | 'flagged';
export type ReviewSortBy = 'newest' | 'oldest' | 'highest' | 'lowest' | 'helpful';

export interface Review {
  id: string;
  strategyId: string;
  userId: string;
  userName: string;
  rating: number; // 0-5
  title: string;
  content: string;
  status: ReviewStatus;
  helpful: number;
  notHelpful: number;
  verifiedPurchase: boolean;
  editedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewInput {
  strategyId: string;
  userId: string;
  userName: string;
  rating: number;
  title?: string;
  content?: string;
  verifiedPurchase?: boolean;
}

export interface ReviewFilter {
  strategyId?: string;
  userId?: string;
  status?: ReviewStatus;
  minRating?: number;
  maxRating?: number;
  verifiedOnly?: boolean;
  sortBy?: ReviewSortBy;
  page?: number;
  pageSize?: number;
}

export interface ReviewResult {
  reviews: Review[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface RatingDistribution {
  strategyId: string;
  average: number;
  count: number;
  distribution: Record<number, number>; // 1→count, 2→count, ..., 5→count
  averageVerified: number;
  countVerified: number;
}

export interface ModerationStats {
  pending: number;
  approved: number;
  rejected: number;
  flagged: number;
  total: number;
}

// ── Review Manager ─────────────────────────────────────────────────────────

export class ReviewManager {
  private reviews: Map<string, Review> = new Map();
  private strategyReviews: Map<string, Set<string>> = new Map(); // strategyId → Set<reviewId>
  private userReviews: Map<string, Set<string>> = new Map(); // userId → Set<reviewId>
  private votes: Map<string, Set<string>> = new Map(); // reviewId → Set<userId> who voted helpful
  private notHelpfulVotes: Map<string, Set<string>> = new Map(); // reviewId → Set<userId>
  private idCounter = 1;

  constructor() {
    log.info('[ReviewManager] Initialized');
  }

  // ── Create Review ──────────────────────────────────────────────────────────

  createReview(input: ReviewInput): Review | null {
    // Validation
    if (!input.strategyId || !input.userId || !input.userName) {
      log.warn('[ReviewManager] Missing required fields');
      return null;
    }
    if (input.rating < 0 || input.rating > 5 || !Number.isInteger(input.rating)) {
      log.warn(`[ReviewManager] Invalid rating: ${input.rating}`);
      return null;
    }
    if (input.title && input.title.length > 200) {
      log.warn('[ReviewManager] Title too long (max 200 chars)');
      return null;
    }
    if (input.content && input.content.length > 2000) {
      log.warn('[ReviewManager] Content too long (max 2000 chars)');
      return null;
    }

    // Check for duplicate (user can only review a strategy once)
    const existing = this.getUserReviewForStrategy(input.userId, input.strategyId);
    if (existing) {
      log.warn(`[ReviewManager] User ${input.userId} already reviewed strategy ${input.strategyId}`);
      return null;
    }

    const now = new Date().toISOString();
    const review: Review = {
      id: `rev_${this.idCounter++}`,
      strategyId: input.strategyId,
      userId: input.userId,
      userName: input.userName,
      rating: input.rating,
      title: input.title || '',
      content: input.content || '',
      status: 'pending', // All new reviews start as pending
      helpful: 0,
      notHelpful: 0,
      verifiedPurchase: input.verifiedPurchase ?? false,
      createdAt: now,
      updatedAt: now,
    };

    this.reviews.set(review.id, review);

    // Index by strategy
    if (!this.strategyReviews.has(input.strategyId)) {
      this.strategyReviews.set(input.strategyId, new Set());
    }
    this.strategyReviews.get(input.strategyId)!.add(review.id);

    // Index by user
    if (!this.userReviews.has(input.userId)) {
      this.userReviews.set(input.userId, new Set());
    }
    this.userReviews.get(input.userId)!.add(review.id);

    log.info(`[ReviewManager] Review created: ${review.id} for strategy ${input.strategyId} by ${input.userName}`);
    return review;
  }

  // ── Edit Review ──────────────────────────────────────────────────────────

  editReview(reviewId: string, userId: string, updates: { rating?: number; title?: string; content?: string }): boolean {
    const review = this.reviews.get(reviewId);
    if (!review) {
      log.warn(`[ReviewManager] Review not found: ${reviewId}`);
      return false;
    }
    if (review.userId !== userId) {
      log.warn(`[ReviewManager] User ${userId} cannot edit review ${reviewId} (owned by ${review.userId})`);
      return false;
    }

    if (updates.rating !== undefined) {
      if (updates.rating < 0 || updates.rating > 5 || !Number.isInteger(updates.rating)) return false;
      review.rating = updates.rating;
    }
    if (updates.title !== undefined) {
      if (updates.title.length > 200) return false;
      review.title = updates.title;
    }
    if (updates.content !== undefined) {
      if (updates.content.length > 2000) return false;
      review.content = updates.content;
    }

    const now = new Date().toISOString();
    review.editedAt = now;
    review.updatedAt = now;
    // Re-queue for moderation if edited
    if (review.status === 'approved') {
      review.status = 'pending';
    }

    log.info(`[ReviewManager] Review ${reviewId} edited by ${userId}`);
    return true;
  }

  // ── Delete Review ──────────────────────────────────────────────────────────

  deleteReview(reviewId: string, userId: string): boolean {
    const review = this.reviews.get(reviewId);
    if (!review) return false;
    if (review.userId !== userId) {
      log.warn(`[ReviewManager] User ${userId} cannot delete review ${reviewId}`);
      return false;
    }

    this.reviews.delete(reviewId);
    this.strategyReviews.get(review.strategyId)?.delete(reviewId);
    this.userReviews.get(review.userId)?.delete(reviewId);
    this.votes.delete(reviewId);
    this.notHelpfulVotes.delete(reviewId);

    log.info(`[ReviewManager] Review ${reviewId} deleted by ${userId}`);
    return true;
  }

  // ── Review Audit ──────────────────────────────────────────────────────────

  approveReview(reviewId: string): boolean {
    const review = this.reviews.get(reviewId);
    if (!review) return false;
    if (review.status !== 'pending' && review.status !== 'flagged') {
      log.warn(`[ReviewManager] Review ${reviewId} cannot be approved (status: ${review.status})`);
      return false;
    }
    review.status = 'approved';
    review.updatedAt = new Date().toISOString();
    log.info(`[ReviewManager] Review ${reviewId} approved`);
    return true;
  }

  rejectReview(reviewId: string): boolean {
    const review = this.reviews.get(reviewId);
    if (!review) return false;
    if (review.status !== 'pending' && review.status !== 'flagged') return false;
    review.status = 'rejected';
    review.updatedAt = new Date().toISOString();
    log.info(`[ReviewManager] Review ${reviewId} rejected`);
    return true;
  }

  flagReview(reviewId: string): boolean {
    const review = this.reviews.get(reviewId);
    if (!review) return false;
    if (review.status === 'rejected') return false;
    review.status = 'flagged';
    review.updatedAt = new Date().toISOString();
    log.info(`[ReviewManager] Review ${reviewId} flagged for moderation`);
    return true;
  }

  /**
   * Get moderation queue (pending + flagged reviews)
   */
  getModerationQueue(): Review[] {
    return Array.from(this.reviews.values())
      .filter(r => r.status === 'pending' || r.status === 'flagged')
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  getModerationStats(): ModerationStats {
    const all = Array.from(this.reviews.values());
    return {
      pending: all.filter(r => r.status === 'pending').length,
      approved: all.filter(r => r.status === 'approved').length,
      rejected: all.filter(r => r.status === 'rejected').length,
      flagged: all.filter(r => r.status === 'flagged').length,
      total: all.length,
    };
  }

  // ── Voting ──────────────────────────────────────────────────────────────────

  markHelpful(reviewId: string, userId: string): boolean {
    const review = this.reviews.get(reviewId);
    if (!review) return false;
    if (review.userId === userId) return false; // Can't vote own review

    if (!this.votes.has(reviewId)) this.votes.set(reviewId, new Set());
    const voters = this.votes.get(reviewId)!;

    if (voters.has(userId)) {
      // Toggle off
      voters.delete(userId);
      review.helpful = Math.max(0, review.helpful - 1);
    } else {
      voters.add(userId);
      review.helpful++;
      // Remove from not-helpful if previously voted
      const nhVoters = this.notHelpfulVotes.get(reviewId);
      if (nhVoters?.has(userId)) {
        nhVoters.delete(userId);
        review.notHelpful = Math.max(0, review.notHelpful - 1);
      }
    }
    review.updatedAt = new Date().toISOString();
    return true;
  }

  markNotHelpful(reviewId: string, userId: string): boolean {
    const review = this.reviews.get(reviewId);
    if (!review) return false;
    if (review.userId === userId) return false;

    if (!this.notHelpfulVotes.has(reviewId)) this.notHelpfulVotes.set(reviewId, new Set());
    const voters = this.notHelpfulVotes.get(reviewId)!;

    if (voters.has(userId)) {
      voters.delete(userId);
      review.notHelpful = Math.max(0, review.notHelpful - 1);
    } else {
      voters.add(userId);
      review.notHelpful++;
      // Remove from helpful if previously voted
      const hVoters = this.votes.get(reviewId);
      if (hVoters?.has(userId)) {
        hVoters.delete(userId);
        review.helpful = Math.max(0, review.helpful - 1);
      }
    }
    review.updatedAt = new Date().toISOString();
    return true;
  }

  // ── Query Reviews ──────────────────────────────────────────────────────────

  getReview(id: string): Review | null {
    return this.reviews.get(id) || null;
  }

  getUserReviewForStrategy(userId: string, strategyId: string): Review | null {
    const userRevs = this.userReviews.get(userId);
    if (!userRevs) return null;
    for (const revId of userRevs) {
      const rev = this.reviews.get(revId);
      if (rev && rev.strategyId === strategyId) return rev;
    }
    return null;
  }

  getReviews(filter: ReviewFilter): ReviewResult {
    const {
      strategyId,
      userId,
      status = 'approved',
      minRating,
      maxRating,
      verifiedOnly,
      sortBy = 'helpful',
      page = 1,
      pageSize = 20,
    } = filter;

    let reviews = Array.from(this.reviews.values());

    // Filters
    if (strategyId) reviews = reviews.filter(r => r.strategyId === strategyId);
    if (userId) reviews = reviews.filter(r => r.userId === userId);
    if (status) reviews = reviews.filter(r => r.status === status);
    if (minRating !== undefined) reviews = reviews.filter(r => r.rating >= minRating);
    if (maxRating !== undefined) reviews = reviews.filter(r => r.rating <= maxRating);
    if (verifiedOnly) reviews = reviews.filter(r => r.verifiedPurchase);

    // Sort
    switch (sortBy) {
      case 'newest':
        reviews.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case 'oldest':
        reviews.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        break;
      case 'highest':
        reviews.sort((a, b) => b.rating - a.rating);
        break;
      case 'lowest':
        reviews.sort((a, b) => a.rating - b.rating);
        break;
      case 'helpful':
        reviews.sort((a, b) => (b.helpful - b.notHelpful) - (a.helpful - a.notHelpful));
        break;
    }

    const total = reviews.length;
    const totalPages = Math.ceil(total / pageSize);
    const start = (page - 1) * pageSize;
    const paged = reviews.slice(start, start + pageSize);

    return { reviews: paged, total, page, pageSize, totalPages };
  }

  /**
   * Get rating distribution for a strategy (only approved reviews)
   */
  getRatingDistribution(strategyId: string): RatingDistribution {
    const reviews = Array.from(this.reviews.values())
      .filter(r => r.strategyId === strategyId && r.status === 'approved');

    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let totalRating = 0;
    let verifiedRating = 0;
    let verifiedCount = 0;

    for (const review of reviews) {
      const r = Math.max(1, Math.min(5, Math.round(review.rating)));
      distribution[r] = (distribution[r] || 0) + 1;
      totalRating += review.rating;
      if (review.verifiedPurchase) {
        verifiedRating += review.rating;
        verifiedCount++;
      }
    }

    const count = reviews.length;
    return {
      strategyId,
      average: count > 0 ? Math.round((totalRating / count) * 100) / 100 : 0,
      count,
      distribution,
      averageVerified: verifiedCount > 0 ? Math.round((verifiedRating / verifiedCount) * 100) / 100 : 0,
      countVerified: verifiedCount,
    };
  }

  /**
   * Get top reviewers (most reviews)
   */
  getTopReviewers(limit: number = 10): { userId: string; userName: string; reviewCount: number; avgRating: number }[] {
    const userMap = new Map<string, { userName: string; count: number; totalRating: number }>();
    for (const review of this.reviews.values()) {
      const existing = userMap.get(review.userId) || { userName: review.userName, count: 0, totalRating: 0 };
      existing.count++;
      existing.totalRating += review.rating;
      userMap.set(review.userId, existing);
    }
    return Array.from(userMap.entries())
      .map(([userId, data]) => ({
        userId,
        userName: data.userName,
        reviewCount: data.count,
        avgRating: Math.round((data.totalRating / data.count) * 100) / 100,
      }))
      .sort((a, b) => b.reviewCount - a.reviewCount)
      .slice(0, limit);
  }

  // ── Clear ────────────────────────────────────────────────────────────────

  clearAll(): void {
    this.reviews.clear();
    this.strategyReviews.clear();
    this.userReviews.clear();
    this.votes.clear();
    this.notHelpfulVotes.clear();
    this.idCounter = 1;
    log.info('[ReviewManager] Cleared all reviews');
  }

  get reviewCount(): number {
    return this.reviews.size;
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let _instance: ReviewManager | null = null;

export function getReviewManager(): ReviewManager {
  if (!_instance) {
    _instance = new ReviewManager();
  }
  return _instance;
}

export function resetReviewManager(): void {
  if (_instance) {
    _instance.clearAll();
  }
  _instance = null;
}

export default ReviewManager;

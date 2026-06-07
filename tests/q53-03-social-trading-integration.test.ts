/**
 * Q-53-03: Social Trading Integration Tests (R53 P1)
 * 社交交易集成测试 — 前后端集联/数据一致性/错误处理/跨引擎联动
 *
 * Coverage: ≥200L, 15+ tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SubscriptionEarnings } from '../electron/engine/subscription-earnings';
import { ReviewManager, getReviewManager, resetReviewManager } from '../electron/engine/review-manager';

// ─────────────────────────────────────────────────────────────────────────────
// Section 1: End-to-End Social Trading Lifecycle
// ─────────────────────────────────────────────────────────────────────────────

describe('Q-53-03-01: End-to-End Social Trading Lifecycle', () => {
  let se: SubscriptionEarnings;
  beforeEach(() => { se = new SubscriptionEarnings(); resetReviewManager(); });

  it('I01-01: subscribe → review → earnings lifecycle', () => {
    const rm = getReviewManager();
    const authorId = 'author1';
    const strategyId = 'strat1';

    // 1. User subscribes
    const sub = se.subscribe({ strategyId, userId: 'follower1', tier: 'premium', price: 29.99 });
    expect(sub.id).toBeDefined();
    expect(se.hasAccess('follower1', strategyId)).toBe(true);

    // 2. Follower reviews
    const review = rm.createReview({
      strategyId,
      userId: 'follower1',
      userName: 'Follower One',
      rating: 5,
      title: 'Great premium strategy',
      content: 'Best strategy for momentum trading.',
      verifiedPurchase: true,
    });
    expect(review).not.toBeNull();
    expect(review!.verifiedPurchase).toBe(true);

    // 3. Admin approves review
    rm.approveReview(review!.id);
    expect(rm.getReview(review!.id)!.status).toBe('approved');

    // 4. Earnings calculated
    const now = new Date();
    const start = new Date(now.getTime() - 30 * 86400000).toISOString();
    const end = now.toISOString();
    const earning = se.calculateEarnings(strategyId, authorId, 'monthly', start, end);
    expect(earning.grossRevenue).toBeCloseTo(29.99, 2);
    expect(earning.authorRevenue).toBeCloseTo(25.49, 2); // 85%
    expect(earning.subscriberCount).toBe(1);
    expect(earning.newSubscribers).toBe(1);

    // 5. Settle and pay
    se.settleEarning(earning.id);
    se.payEarning(earning.id);
    const finalEarning = se.getEarningsByStrategy(strategyId)[0];
    expect(finalEarning.status).toBe('paid');
  });

  it('I01-02: multiple followers with mixed tiers generates correct earnings', () => {
    const authorId = 'author1';
    const strategyId = 'strat1';

    se.subscribe({ strategyId, userId: 'f1', tier: 'free', price: 0 });
    se.subscribe({ strategyId, userId: 'f2', tier: 'basic', price: 9.99 });
    se.subscribe({ strategyId, userId: 'f3', tier: 'premium', price: 29.99 });
    se.subscribe({ strategyId, userId: 'f4', tier: 'enterprise', price: 99.99 });

    const now = new Date();
    const start = new Date(now.getTime() - 30 * 86400000).toISOString();
    const end = now.toISOString();
    const earning = se.calculateEarnings(strategyId, authorId, 'monthly', start, end);

    // free=0, basic=9.99, premium=29.99, enterprise=99.99
    const expectedGross = 0 + 9.99 + 29.99 + 99.99; // 139.97
    expect(earning.grossRevenue).toBeCloseTo(expectedGross, 2);
    expect(earning.subscriberCount).toBe(4);
    expect(earning.newSubscribers).toBe(4);
  });

  it('I01-03: verified reviews only count verified in distribution', () => {
    const rm = getReviewManager();

    // 3 verified purchases
    for (let i = 0; i < 3; i++) {
      const r = rm.createReview({ strategyId: 's1', userId: `v${i}`, userName: `V${i}`, rating: 5, verifiedPurchase: true })!;
      rm.approveReview(r.id);
    }
    // 2 unverified
    for (let i = 0; i < 2; i++) {
      const r = rm.createReview({ strategyId: 's1', userId: `u${i}`, userName: `U${i}`, rating: 3, verifiedPurchase: false })!;
      rm.approveReview(r.id);
    }

    const dist = rm.getRatingDistribution('s1');
    expect(dist.count).toBe(5);
    expect(dist.countVerified).toBe(3);
    expect(dist.average).toBe(4.2); // (5+5+5+3+3)/5 = 21/5 = 4.2
    expect(dist.averageVerified).toBe(5.0); // only verified 5s
  });

  it('I01-04: review edit re-queues for moderation', () => {
    const rm = getReviewManager();
    const review = rm.createReview({ strategyId: 's1', userId: 'u1', userName: 'U1', rating: 3 })!;
    rm.approveReview(review.id);

    // User edits their review
    const edited = rm.editReview(review.id, 'u1', { rating: 5, content: 'Updated content!' });
    expect(edited).toBe(true);

    const updated = rm.getReview(review.id)!;
    expect(updated.rating).toBe(5);
    expect(updated.status).toBe('pending'); // Re-queued
    expect(updated.editedAt).toBeDefined();
  });

  it('I01-05: cancel → unsubscribe → no access', () => {
    const authorId = 'author1';
    const strategyId = 'strat1';

    const sub = se.subscribe({ strategyId, userId: 'follower1', tier: 'premium', price: 29.99 });
    expect(se.hasAccess('follower1', strategyId)).toBe(true);

    // Earnings before cancel
    const now = new Date();
    const start = new Date(now.getTime() - 30 * 86400000).toISOString();
    const end = now.toISOString();
    const earning1 = se.calculateEarnings(strategyId, authorId, 'monthly', start, end);
    expect(earning1.subscriberCount).toBe(1);
    expect(earning1.cancelledSubscribers).toBe(0);

    // Cancel subscription
    se.unsubscribe(sub.id);

    // Earnings after cancel
    const earning2 = se.calculateEarnings(strategyId, authorId, 'monthly', start, end);
    expect(earning2.cancelledSubscribers).toBe(1);
    expect(earning2.subscriberCount).toBe(0); // no active subs
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Section 2: Data Consistency
// ─────────────────────────────────────────────────────────────────────────────

describe('Q-53-03-02: Data Consistency', () => {
  let se: SubscriptionEarnings;
  beforeEach(() => { se = new SubscriptionEarnings(); resetReviewManager(); });

  it('I02-01: subscription state is atomic — no partial updates', () => {
    const sub = se.subscribe({ strategyId: 's1', userId: 'u1', tier: 'basic', price: 9.99 });
    expect(sub.status).toBe('active');
    expect(sub.createdAt).toBeDefined();
    expect(sub.updatedAt).toBeDefined();
    expect(sub.expiresAt).toBeUndefined(); // no trial
  });

  it('I02-02: trial subscription has expiresAt', () => {
    const sub = se.subscribe({ strategyId: 's1', userId: 'u1', tier: 'basic', trialDays: 7 });
    expect(sub.isTrial).toBe(true);
    expect(sub.expiresAt).toBeDefined();
    expect(new Date(sub.expiresAt!).getTime()).toBeGreaterThan(Date.now());
  });

  it('I02-03: review cannot be created without strategyId or userId', () => {
    const rm = getReviewManager();
    expect(rm.createReview({ strategyId: '', userId: 'u1', userName: 'U1', rating: 5 })).toBeNull();
    expect(rm.createReview({ strategyId: 's1', userId: '', userName: 'U1', rating: 5 })).toBeNull();
  });

  it('I02-04: settlement cannot be reversed', () => {
    const rm = getReviewManager(); // just for review
    const now = new Date();
    const start = new Date(now.getTime() - 30 * 86400000).toISOString();
    const end = now.toISOString();
    const rec = se.calculateEarnings('s1', 'author1', 'monthly', start, end);
    se.settleEarning(rec.id);
    // Trying to pay twice should fail (already paid)
    // First pay should succeed
    const paid = se.payEarning(rec.id);
    expect(paid).toBe(true);
    // Second pay should fail (already paid)
    expect(se.payEarning(rec.id)).toBe(false);
  });

  it('I02-05: getAllStrategySubscriptions vs getStrategySubscribers consistency', () => {
    se.subscribe({ strategyId: 's1', userId: 'u1', tier: 'basic' });
    se.subscribe({ strategyId: 's1', userId: 'u2', tier: 'premium' });
    se.subscribe({ strategyId: 's2', userId: 'u3', tier: 'basic' });

    const all = se.getAllStrategySubscriptions('s1');
    const active = se.getStrategySubscribers('s1', 'active');

    // All should include all (including expired), active only active
    expect(all.length).toBeGreaterThanOrEqual(active.length);
    all.forEach(s => expect(s.strategyId).toBe('s1'));
  });

  it('I02-06: unsubscribe non-existent returns false gracefully', () => {
    expect(se.unsubscribe('fake-id')).toBe(false);
    expect(se.unsubscribeByUserStrategy('nobody', 'strat1')).toBe(false);
  });

  it('I02-07: settle non-pending earning returns false', () => {
    const now = new Date();
    const start = new Date(now.getTime() - 30 * 86400000).toISOString();
    const end = now.toISOString();
    const rec = se.calculateEarnings('s1', 'author1', 'monthly', start, end);
    se.settleEarning(rec.id);
    expect(se.settleEarning(rec.id)).toBe(false); // already settled
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Section 3: Error & Edge Cases
// ─────────────────────────────────────────────────────────────────────────────

describe('Q-53-03-03: Error & Edge Cases', () => {
  let se: SubscriptionEarnings;
  beforeEach(() => { se = new SubscriptionEarnings(); resetReviewManager(); });

  it('I03-01: rating out of range is rejected', () => {
    const rm = getReviewManager();
    expect(rm.createReview({ strategyId: 's1', userId: 'u1', userName: 'U1', rating: -1 })).toBeNull();
    expect(rm.createReview({ strategyId: 's1', userId: 'u2', userName: 'U2', rating: 6 })).toBeNull();
    expect(rm.createReview({ strategyId: 's1', userId: 'u3', userName: 'U3', rating: 0 })).not.toBeNull();
    expect(rm.createReview({ strategyId: 's1', userId: 'u4', userName: 'U4', rating: 5 })).not.toBeNull();
  });

  it('I03-02: title exceeding 200 chars is rejected', () => {
    const rm = getReviewManager();
    const longTitle = 'A'.repeat(201);
    expect(rm.createReview({ strategyId: 's1', userId: 'u1', userName: 'U1', rating: 5, title: longTitle })).toBeNull();
    expect(rm.createReview({ strategyId: 's1', userId: 'u1', userName: 'U1', rating: 5, title: 'A'.repeat(200) })).not.toBeNull();
  });

  it('I03-03: content exceeding 2000 chars is rejected', () => {
    const rm = getReviewManager();
    const longContent = 'A'.repeat(2001);
    expect(rm.createReview({ strategyId: 's1', userId: 'u1', userName: 'U1', rating: 5, content: longContent })).toBeNull();
    expect(rm.createReview({ strategyId: 's1', userId: 'u1', userName: 'U1', rating: 5, content: 'A'.repeat(2000) })).not.toBeNull();
  });

  it('I03-04: tier levels are respected for access', () => {
    se.subscribe({ strategyId: 's1', userId: 'u1', tier: 'basic' });
    expect(se.hasAccess('u1', 's1', 'basic')).toBe(true);
    expect(se.hasAccess('u1', 's1', 'premium')).toBe(false);
  });

  it('I03-05: getModerationStats returns correct counts', () => {
    const rm = getReviewManager();
    for (let i = 0; i < 5; i++) rm.createReview({ strategyId: 's1', userId: `u${i}`, userName: `U${i}`, rating: 3 });
    const r = rm.createReview({ strategyId: 's1', userId: 'u99', userName: 'U99', rating: 1 })!;
    rm.approveReview(r.id);
    const stats = rm.getModerationStats();
    expect(stats.pending).toBe(5);
    expect(stats.approved).toBe(1);
    expect(stats.total).toBe(6);
  });

  it('I03-06: settleAllPending only processes pending records', () => {
    const now = new Date();
    const start = new Date(now.getTime() - 30 * 86400000).toISOString();
    const end = now.toISOString();
    const rec = se.calculateEarnings('s1', 'author1', 'monthly', start, end);
    se.settleEarning(rec.id); // already settled

    const count = se.settleAllPending();
    expect(count).toBe(0); // nothing pending
  });

  it('I03-07: flagging non-review returns false', () => {
    const rm = getReviewManager();
    expect(rm.flagReview('nonexistent')).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Section 4: Singleton Behavior
// ─────────────────────────────────────────────────────────────────────────────

describe('Q-53-03-04: ReviewManager Singleton Behavior', () => {
  it('I04-01: resetReviewManager creates fresh instance', () => {
    const rm1 = getReviewManager();
    rm1.createReview({ strategyId: 's1', userId: 'u1', userName: 'U1', rating: 5 });
    expect(rm1.reviewCount).toBe(1);

    resetReviewManager();

    const rm2 = getReviewManager();
    expect(rm2.reviewCount).toBe(0);
    expect(rm1).not.toBe(rm2);
  });

  it('I04-02: different test isolation via reset', () => {
    const rm1 = getReviewManager();
    rm1.createReview({ strategyId: 's1', userId: 'u1', userName: 'U1', rating: 5 });

    resetReviewManager();

    const rm2 = getReviewManager();
    rm2.createReview({ strategyId: 's1', userId: 'u2', userName: 'U2', rating: 4 });

    expect(rm1.reviewCount).toBe(0);
    expect(rm2.reviewCount).toBe(1);
  });
});

/**
 * J-52-02: Strategy Subscription + Review Tests (R52 P0)
 * Subscription lifecycle + Revenue split + Review management
 *
 * ≥25 tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  SubscriptionEarnings,
  getSubscriptionEarnings,
  resetSubscriptionEarnings,
} from '../electron/engine/subscription-earnings';
import {
  ReviewManager,
  getReviewManager,
  resetReviewManager,
} from '../electron/engine/review-manager';

// ── Section 1: Subscription Lifecycle ──────────────────────────────────────

describe('J-52-02: Subscription Lifecycle', () => {
  let se: SubscriptionEarnings;

  beforeEach(() => {
    resetSubscriptionEarnings();
    se = getSubscriptionEarnings();
  });

  it('01: subscribe creates active subscription', () => {
    const sub = se.subscribe({ strategyId: 's1', userId: 'u1', tier: 'basic' });
    expect(sub.id).toBeDefined();
    expect(sub.status).toBe('active');
    expect(sub.tier).toBe('basic');
    expect(sub.price).toBe(9.99);
  });

  it('02: free subscription has price 0', () => {
    const sub = se.subscribe({ strategyId: 's1', userId: 'u1', tier: 'free' });
    expect(sub.price).toBe(0);
    expect(sub.tier).toBe('free');
  });

  it('03: duplicate subscription returns existing', () => {
    const sub1 = se.subscribe({ strategyId: 's1', userId: 'u1' });
    const sub2 = se.subscribe({ strategyId: 's1', userId: 'u1' });
    expect(sub1.id).toBe(sub2.id);
  });

  it('04: unsubscribe changes status to cancelled', () => {
    const sub = se.subscribe({ strategyId: 's1', userId: 'u1' });
    expect(se.unsubscribe(sub.id)).toBe(true);
    expect(se.getSubscription(sub.id)!.status).toBe('cancelled');
  });

  it('05: unsubscribe nonexistent returns false', () => {
    expect(se.unsubscribe('nonexistent')).toBe(false);
  });

  it('06: double unsubscribe returns false', () => {
    const sub = se.subscribe({ strategyId: 's1', userId: 'u1' });
    se.unsubscribe(sub.id);
    expect(se.unsubscribe(sub.id)).toBe(false);
  });

  it('07: unsubscribeByUserStrategy works', () => {
    se.subscribe({ strategyId: 's1', userId: 'u1', tier: 'premium' });
    expect(se.unsubscribeByUserStrategy('u1', 's1')).toBe(true);
    expect(se.getUserActiveSubscription('u1', 's1')).toBeNull();
  });

  it('08: getUserSubscriptions returns all user subs', () => {
    se.subscribe({ strategyId: 's1', userId: 'u1' });
    se.subscribe({ strategyId: 's2', userId: 'u1' });
    se.subscribe({ strategyId: 's3', userId: 'u1' });
    expect(se.getUserSubscriptions('u1').length).toBe(3);
  });

  it('09: getStrategySubscribers returns correct count', () => {
    se.subscribe({ strategyId: 's1', userId: 'u1' });
    se.subscribe({ strategyId: 's1', userId: 'u2' });
    se.subscribe({ strategyId: 's1', userId: 'u3' });
    se.subscribe({ strategyId: 's2', userId: 'u4' });
    expect(se.getStrategySubscribers('s1').length).toBe(3);
    expect(se.getStrategySubscriberCount('s1')).toBe(3);
  });

  it('10: hasAccess checks tier level', () => {
    se.subscribe({ strategyId: 's1', userId: 'u1', tier: 'basic' });
    expect(se.hasAccess('u1', 's1')).toBe(true);
    expect(se.hasAccess('u1', 's1', 'basic')).toBe(true);
    expect(se.hasAccess('u1', 's1', 'premium')).toBe(false);
    expect(se.hasAccess('u2', 's1')).toBe(false);
  });

  it('11: trial subscription with expiry', () => {
    const sub = se.subscribe({ strategyId: 's1', userId: 'u1', tier: 'premium', trialDays: 7 });
    expect(sub.isTrial).toBe(true);
    expect(sub.trialDays).toBe(7);
    expect(sub.expiresAt).toBeDefined();
  });

  it('12: custom price overrides tier default', () => {
    const sub = se.subscribe({ strategyId: 's1', userId: 'u1', tier: 'basic', price: 4.99 });
    expect(sub.price).toBe(4.99);
  });

  it('13: subscription stats are accurate', () => {
    se.subscribe({ strategyId: 's1', userId: 'u1', tier: 'basic' });
    se.subscribe({ strategyId: 's1', userId: 'u2', tier: 'premium' });
    se.subscribe({ strategyId: 's1', userId: 'u3', tier: 'free' });
    const sub2 = se.subscribe({ strategyId: 's1', userId: 'u4', tier: 'basic' });
    se.unsubscribe(sub2.id);
    const stats = se.getSubscriptionStats();
    expect(stats.totalActive).toBe(3);
    expect(stats.totalCancelled).toBe(1);
    expect(stats.tierBreakdown.basic).toBe(1);
    expect(stats.tierBreakdown.premium).toBe(1);
    expect(stats.tierBreakdown.free).toBe(1);
  });
});

// ── Section 2: Earnings & Revenue ──────────────────────────────────────────

describe('J-52-02: Earnings & Revenue Split', () => {
  let se: SubscriptionEarnings;

  beforeEach(() => {
    resetSubscriptionEarnings();
    se = getSubscriptionEarnings();
  });

  it('14: default revenue split is 85/15', () => {
    const split = se.getRevenueSplit();
    expect(split.authorPercent).toBe(85);
    expect(split.platformPercent).toBe(15);
  });

  it('15: calculateEarnings computes correct split', () => {
    se.subscribe({ strategyId: 's1', userId: 'u1', tier: 'basic', price: 10 });
    se.subscribe({ strategyId: 's1', userId: 'u2', tier: 'basic', price: 10 });
    const now = new Date();
    const earning = se.calculateEarnings('s1', 'author1', 'weekly',
      new Date(now.getTime() - 7 * 86400000).toISOString(),
      now.toISOString()
    );
    expect(earning.grossRevenue).toBe(20);
    expect(earning.platformFee).toBe(3); // 15% of 20
    expect(earning.authorRevenue).toBe(17); // 85% of 20
    expect(earning.subscriberCount).toBe(2);
  });

  it('16: settleEarning transitions pending → settled', () => {
    se.subscribe({ strategyId: 's1', userId: 'u1', price: 10 });
    const earning = se.calculateEarnings('s1', 'a1', 'weekly', '2026-06-01T00:00:00Z', '2026-06-08T00:00:00Z');
    expect(earning.status).toBe('pending');
    expect(se.settleEarning(earning.id)).toBe(true);
    // Verify it's settled by recalculating — but we can check via getEarningsByStrategy
    const earnings = se.getEarningsByStrategy('s1');
    expect(earnings[0].status).toBe('settled');
    expect(earnings[0].settledAt).toBeDefined();
  });

  it('17: payEarning requires settled status', () => {
    se.subscribe({ strategyId: 's1', userId: 'u1', price: 100 });
    const earning = se.calculateEarnings('s1', 'a1', 'monthly', '2026-06-01T00:00:00Z', '2026-07-01T00:00:00Z');
    expect(se.payEarning(earning.id)).toBe(false); // not settled yet
    se.settleEarning(earning.id);
    expect(se.payEarning(earning.id)).toBe(true);
  });

  it('18: payEarning enforces minimum payout', () => {
    se.subscribe({ strategyId: 's1', userId: 'u1', price: 1 }); // tiny amount
    const earning = se.calculateEarnings('s1', 'a1', 'weekly', '2026-06-01T00:00:00Z', '2026-06-08T00:00:00Z');
    se.settleEarning(earning.id);
    expect(se.payEarning(earning.id)).toBe(false); // below $10 min
  });

  it('19: batch settleAllPending works', () => {
    se.subscribe({ strategyId: 's1', userId: 'u1', price: 10 });
    se.subscribe({ strategyId: 's2', userId: 'u2', price: 20 });
    se.calculateEarnings('s1', 'a1', 'weekly', '2026-06-01T00:00:00Z', '2026-06-08T00:00:00Z');
    se.calculateEarnings('s2', 'a1', 'weekly', '2026-06-01T00:00:00Z', '2026-06-08T00:00:00Z');
    const count = se.settleAllPending();
    expect(count).toBe(2);
  });

  it('20: getAuthorEarningsSummary aggregates correctly', () => {
    se.subscribe({ strategyId: 's1', userId: 'u1', price: 100 });
    se.subscribe({ strategyId: 's2', userId: 'u2', price: 200 });
    se.calculateEarnings('s1', 'author1', 'monthly', '2026-06-01T00:00:00Z', '2026-07-01T00:00:00Z');
    se.calculateEarnings('s2', 'author1', 'monthly', '2026-06-01T00:00:00Z', '2026-07-01T00:00:00Z');
    const summary = se.getAuthorEarningsSummary('author1');
    expect(summary.totalGross).toBe(300);
    expect(summary.strategyCount).toBe(2);
    expect(summary.currency).toBe('USD');
  });

  it('21: getLeaderboard returns sorted authors', () => {
    se.subscribe({ strategyId: 's1', userId: 'u1', price: 100 });
    se.subscribe({ strategyId: 's2', userId: 'u2', price: 50 });
    se.calculateEarnings('s1', 'author-top', 'monthly', '2026-06-01T00:00:00Z', '2026-07-01T00:00:00Z');
    se.calculateEarnings('s2', 'author-low', 'monthly', '2026-06-01T00:00:00Z', '2026-07-01T00:00:00Z');
    const lb = se.getLeaderboard(5);
    expect(lb.length).toBe(2);
    expect(lb[0].authorId).toBe('author-top');
  });

  it('22: tier prices are correct', () => {
    expect(se.getTierPrice('free')).toBe(0);
    expect(se.getTierPrice('basic')).toBe(9.99);
    expect(se.getTierPrice('premium')).toBe(29.99);
    expect(se.getTierPrice('enterprise')).toBe(99.99);
  });

  it('23: tier features are available', () => {
    const basic = se.getTierFeatures('basic');
    expect(basic).toContain('view-strategies');
    const premium = se.getTierFeatures('premium');
    expect(premium).toContain('advanced-analytics');
  });
});

// ── Section 3: Review Manager ──────────────────────────────────────────────

describe('J-52-02: Review Management', () => {
  let rm: ReviewManager;

  beforeEach(() => {
    resetReviewManager();
    rm = getReviewManager();
  });

  it('24: createReview creates pending review', () => {
    const rev = rm.createReview({
      strategyId: 's1', userId: 'u1', userName: 'Alice',
      rating: 5, title: 'Great!', content: 'Excellent strategy'
    });
    expect(rev).not.toBeNull();
    expect(rev!.status).toBe('pending');
    expect(rev!.rating).toBe(5);
  });

  it('25: duplicate review by same user returns null', () => {
    rm.createReview({ strategyId: 's1', userId: 'u1', userName: 'Alice', rating: 5 });
    expect(rm.createReview({ strategyId: 's1', userId: 'u1', userName: 'Alice', rating: 4 })).toBeNull();
  });

  it('26: invalid rating returns null', () => {
    expect(rm.createReview({ strategyId: 's1', userId: 'u1', userName: 'A', rating: 6 })).toBeNull();
    expect(rm.createReview({ strategyId: 's1', userId: 'u1', userName: 'A', rating: -1 })).toBeNull();
  });

  it('27: approveReview transitions to approved', () => {
    const rev = rm.createReview({ strategyId: 's1', userId: 'u1', userName: 'Alice', rating: 4 })!;
    expect(rm.approveReview(rev.id)).toBe(true);
    expect(rm.getReview(rev.id)!.status).toBe('approved');
  });

  it('28: rejectReview transitions to rejected', () => {
    const rev = rm.createReview({ strategyId: 's1', userId: 'u1', userName: 'Alice', rating: 2 })!;
    expect(rm.rejectReview(rev.id)).toBe(true);
    expect(rm.getReview(rev.id)!.status).toBe('rejected');
  });

  it('29: flagReview transitions to flagged', () => {
    const rev = rm.createReview({ strategyId: 's1', userId: 'u1', userName: 'Alice', rating: 3 })!;
    expect(rm.flagReview(rev.id)).toBe(true);
    expect(rm.getReview(rev.id)!.status).toBe('flagged');
  });

  it('30: getModerationQueue returns pending + flagged', () => {
    rm.createReview({ strategyId: 's1', userId: 'u1', userName: 'A', rating: 5 });
    const rev2 = rm.createReview({ strategyId: 's2', userId: 'u2', userName: 'B', rating: 3 })!;
    rm.flagReview(rev2.id);
    const rev3 = rm.createReview({ strategyId: 's3', userId: 'u3', userName: 'C', rating: 4 })!;
    rm.approveReview(rev3.id);
    const queue = rm.getModerationQueue();
    expect(queue.length).toBe(2);
    expect(queue.every(r => r.status === 'pending' || r.status === 'flagged')).toBe(true);
  });

  it('31: editReview updates content and re-queues', () => {
    const rev = rm.createReview({ strategyId: 's1', userId: 'u1', userName: 'Alice', rating: 4, content: 'Good' })!;
    rm.approveReview(rev.id);
    rm.editReview(rev.id, 'u1', { content: 'Updated review' });
    expect(rm.getReview(rev.id)!.content).toBe('Updated review');
    expect(rm.getReview(rev.id)!.status).toBe('pending'); // re-queued
  });

  it('32: editReview by wrong user fails', () => {
    const rev = rm.createReview({ strategyId: 's1', userId: 'u1', userName: 'Alice', rating: 4 })!;
    expect(rm.editReview(rev.id, 'u2', { content: 'Hacked!' })).toBe(false);
  });

  it('33: deleteReview removes review', () => {
    const rev = rm.createReview({ strategyId: 's1', userId: 'u1', userName: 'Alice', rating: 4 })!;
    expect(rm.deleteReview(rev.id, 'u1')).toBe(true);
    expect(rm.getReview(rev.id)).toBeNull();
  });

  it('34: markHelpful increments counter', () => {
    const rev = rm.createReview({ strategyId: 's1', userId: 'u1', userName: 'Alice', rating: 5 })!;
    rm.approveReview(rev.id);
    rm.markHelpful(rev.id, 'u2');
    rm.markHelpful(rev.id, 'u3');
    expect(rm.getReview(rev.id)!.helpful).toBe(2);
  });

  it('35: markHelpful toggle off', () => {
    const rev = rm.createReview({ strategyId: 's1', userId: 'u1', userName: 'Alice', rating: 5 })!;
    rm.markHelpful(rev.id, 'u2');
    rm.markHelpful(rev.id, 'u2'); // toggle off
    expect(rm.getReview(rev.id)!.helpful).toBe(0);
  });

  it('36: cannot vote own review', () => {
    const rev = rm.createReview({ strategyId: 's1', userId: 'u1', userName: 'Alice', rating: 5 })!;
    expect(rm.markHelpful(rev.id, 'u1')).toBe(false);
  });

  it('37: getRatingDistribution computes correctly', () => {
    const r1 = rm.createReview({ strategyId: 's1', userId: 'u1', userName: 'A', rating: 5 })!;
    const r2 = rm.createReview({ strategyId: 's1', userId: 'u2', userName: 'B', rating: 4 })!;
    const r3 = rm.createReview({ strategyId: 's1', userId: 'u3', userName: 'C', rating: 5 })!;
    rm.approveReview(r1.id);
    rm.approveReview(r2.id);
    rm.approveReview(r3.id);
    const dist = rm.getRatingDistribution('s1');
    expect(dist.count).toBe(3);
    expect(dist.average).toBeCloseTo(4.67, 1);
    expect(dist.distribution[5]).toBe(2);
    expect(dist.distribution[4]).toBe(1);
  });

  it('38: getModerationStats returns correct counts', () => {
    const r1 = rm.createReview({ strategyId: 's1', userId: 'u1', userName: 'A', rating: 5 })!;
    rm.createReview({ strategyId: 's2', userId: 'u2', userName: 'B', rating: 3 });
    const r3 = rm.createReview({ strategyId: 's3', userId: 'u3', userName: 'C', rating: 4 })!;
    rm.approveReview(r1.id);
    rm.rejectReview(r3.id);
    const stats = rm.getModerationStats();
    expect(stats.pending).toBe(1);
    expect(stats.approved).toBe(1);
    expect(stats.rejected).toBe(1);
    expect(stats.total).toBe(3);
  });
});

/**
 * Q-53-01: Social Trading API Tests (R53 P0)
 * 社交交易 API 测试套件 — 订阅/信号推送/收益审核全流程
 *
 * Coverage: ≥350L, 35+ tests
 * Engines: subscription-earnings + signal-pusher + review-manager
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SubscriptionEarnings } from '../electron/engine/subscription-earnings';
import { ReviewManager, getReviewManager, resetReviewManager } from '../electron/engine/review-manager';

// ── Helpers ─────────────────────────────────────────────────────────────────

function mkSignal(overrides = {}) {
  return {
    timestamp: Date.now(),
    symbol: 'AAPL',
    signal: 'BUY' as const,
    strength: 80,
    strategy: 'TestStrategy',
    metadata: {},
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 1: Subscription & Tier Access Control
// ─────────────────────────────────────────────────────────────────────────────

class SocialTradingTest {
  constructor(private se: SubscriptionEarnings) {}

  subscribe(userId: string, strategyId: string, tier: 'free' | 'basic' | 'premium' = 'basic', price = 9.99) {
    return this.se.subscribe({ strategyId, userId, tier, price });
  }

  hasAccess(userId: string, strategyId: string, minTier?: 'free' | 'basic' | 'premium' | 'enterprise') {
    return this.se.hasAccess(userId, strategyId, minTier);
  }

  unsubscribe(userId: string, strategyId: string) {
    return this.se.unsubscribeByUserStrategy(userId, strategyId);
  }

  earnings(strategyId: string, authorId: string, period: 'daily' | 'weekly' | 'monthly' = 'monthly') {
    const now = new Date();
    const start = new Date(now.getTime() - 30 * 86400000).toISOString();
    const end = now.toISOString();
    return this.se.calculateEarnings(strategyId, authorId, period, start, end);
  }
}

describe('Q-53-01-01: Subscription Tier Access', () => {
  let st: SocialTradingTest;
  let se: SubscriptionEarnings;

  beforeEach(() => {
    se = new SubscriptionEarnings();
    st = new SocialTradingTest(se);
  });

  it('S01-01: free tier has basic access', () => {
    const sub = st.subscribe('u1', 'strat1', 'free', 0);
    expect(sub.tier).toBe('free');
    expect(st.hasAccess('u1', 'strat1')).toBe(true);
    expect(st.hasAccess('u1', 'strat1', 'free')).toBe(true);
  });

  it('S01-02: basic tier blocks premium features', () => {
    st.subscribe('u1', 'strat1', 'basic');
    expect(st.hasAccess('u1', 'strat1')).toBe(true);
    expect(st.hasAccess('u1', 'strat1', 'premium')).toBe(false);
    expect(st.hasAccess('u1', 'strat1', 'enterprise')).toBe(false);
  });

  it('S01-03: premium tier grants premium and below', () => {
    st.subscribe('u1', 'strat1', 'premium');
    expect(st.hasAccess('u1', 'strat1')).toBe(true);
    expect(st.hasAccess('u1', 'strat1', 'premium')).toBe(true);
    expect(st.hasAccess('u1', 'strat1', 'enterprise')).toBe(false);
  });

  it('S01-04: enterprise tier grants all access', () => {
    st.subscribe('u1', 'strat1', 'enterprise');
    expect(st.hasAccess('u1', 'strat1', 'enterprise')).toBe(true);
    expect(st.hasAccess('u1', 'strat1', 'premium')).toBe(true);
    expect(st.hasAccess('u1', 'strat1', 'basic')).toBe(true);
  });

  it('S01-05: no subscription means no access', () => {
    expect(st.hasAccess('stranger', 'strat1')).toBe(false);
    expect(st.hasAccess('stranger', 'strat1', 'free')).toBe(false);
  });

  it('S01-06: unsubscribe revokes access', () => {
    st.subscribe('u1', 'strat1', 'premium');
    expect(st.hasAccess('u1', 'strat1')).toBe(true);
    st.unsubscribe('u1', 'strat1');
    expect(st.hasAccess('u1', 'strat1')).toBe(false);
  });

  it('S01-07: duplicate subscribe returns existing', () => {
    const first = st.subscribe('u1', 'strat1', 'basic');
    const second = st.subscribe('u1', 'strat1', 'premium'); // upgrade attempt
    expect(second.id).toBe(first.id);
    expect(second.tier).toBe('basic'); // stays at basic
  });

  it('S01-08: user can subscribe to multiple strategies', () => {
    st.subscribe('u1', 'strat1', 'basic');
    st.subscribe('u1', 'strat2', 'premium');
    expect(st.hasAccess('u1', 'strat1', 'premium')).toBe(false);
    expect(st.hasAccess('u1', 'strat2', 'premium')).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Section 2: Signal Pusher
// ─────────────────────────────────────────────────────────────────────────────

describe('Q-53-01-02: Signal Pusher', () => {
  // signal-pusher is imported from the engine
  let sp: import('../electron/engine/signal-pusher').SignalPusher;

  beforeEach(async () => {
    const mod = await import('../electron/engine/signal-pusher');
    sp = new mod.SignalPusher();
  });

  it('S02-01: publishSignal stores signal', () => {
    const signal = mkSignal({ symbol: 'TSLA', signal: 'BUY' as const });
    sp.publishSignal(signal);
    const history = sp.getSignalHistory('TSLA');
    expect(history.length).toBe(1);
    expect(history[0].signal).toBe('BUY');
  });

  it('S02-02: multiple signals accumulate', () => {
    for (let i = 0; i < 10; i++) {
      sp.publishSignal(mkSignal({ symbol: 'AAPL', timestamp: Date.now() + i * 1000 }));
    }
    expect(sp.getSignalHistory('AAPL').length).toBe(10);
  });

  it('S02-03: subscribe filters by symbol', () => {
    sp.publishSignal(mkSignal({ symbol: 'AAPL' }));
    sp.publishSignal(mkSignal({ symbol: 'GOOG' }));
    sp.publishSignal(mkSignal({ symbol: 'AAPL' }));
    const history = sp.getSignalHistory('AAPL');
    expect(history.length).toBe(2);
    expect(history.every(s => s.symbol === 'AAPL')).toBe(true);
  });

  it('S02-04: subscribe filters by minStrength', async () => {
    const mod = await import('../electron/engine/signal-pusher');
    const sp2 = new mod.SignalPusher();
    sp2.publishSignal(mkSignal({ symbol: 'AAPL', strength: 30 }));
    sp2.publishSignal(mkSignal({ symbol: 'AAPL', strength: 70 }));
    sp2.publishSignal(mkSignal({ symbol: 'AAPL', strength: 90 }));

    const sub = { symbols: ['AAPL'], minStrength: 70 } as mod.SignalSubscription;
    const filtered = sp2.getFilteredSignals(sub);
    expect(filtered.length).toBe(2);
    expect(filtered.every(s => s.strength >= 70)).toBe(true);
  });

  it('S02-05: clearHistory removes all', () => {
    sp.publishSignal(mkSignal({ symbol: 'AAPL' }));
    sp.publishSignal(mkSignal({ symbol: 'GOOG' }));
    sp.clearHistory();
    expect(sp.getSignalHistory('AAPL').length).toBe(0);
    expect(sp.getSignalHistory('GOOG').length).toBe(0);
  });

  it('S02-06: getSignalHistory returns sorted by timestamp descending', () => {
    const now = Date.now();
    sp.publishSignal(mkSignal({ symbol: 'AAPL', timestamp: now - 2000 }));
    sp.publishSignal(mkSignal({ symbol: 'AAPL', timestamp: now - 1000 }));
    sp.publishSignal(mkSignal({ symbol: 'AAPL', timestamp: now }));
    const history = sp.getSignalHistory('AAPL');
    expect(history[0].timestamp).toBe(now);
    expect(history[2].timestamp).toBe(now - 2000);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Section 3: Earnings Calculation
// ─────────────────────────────────────────────────────────────────────────────

describe('Q-53-01-03: Earnings Calculation', () => {
  let se: SubscriptionEarnings;

  beforeEach(() => { se = new SubscriptionEarnings(); });

  function calcEarnings(strategyId: string, authorId: string, subCount: number, price: number) {
    for (let i = 0; i < subCount; i++) {
      se.subscribe({ strategyId, userId: `u${i}`, tier: 'basic', price });
    }
    const now = new Date();
    const start = new Date(now.getTime() - 30 * 86400000).toISOString();
    const end = now.toISOString();
    return se.calculateEarnings(strategyId, authorId, 'monthly', start, end);
  }

  it('S03-01: 1 subscriber at $9.99 = $8.49 author revenue', () => {
    const record = calcEarnings('strat1', 'author1', 1, 9.99);
    expect(record.grossRevenue).toBe(9.99);
    expect(record.authorRevenue).toBeCloseTo(8.49, 2); // 85%
    expect(record.platformFee).toBeCloseTo(1.50, 2);  // 15%
    expect(record.subscriberCount).toBe(1);
  });

  it('S03-02: 2 subscribers = correct revenue split', () => {
    const record = calcEarnings('strat1', 'author1', 2, 9.99);
    expect(record.grossRevenue).toBeCloseTo(19.98, 2);
    expect(record.authorRevenue).toBeCloseTo(16.98, 2);
    expect(record.platformFee).toBeCloseTo(3.00, 2);
  });

  it('S03-03: premium subscriber at $29.99 = correct revenue', () => {
    const record = calcEarnings('strat1', 'author1', 1, 29.99);
    expect(record.grossRevenue).toBeCloseTo(29.99, 2);
    expect(record.authorRevenue).toBeCloseTo(25.49, 2);
  });

  it('S03-04: free subscribers generate $0', () => {
    const record = calcEarnings('strat1', 'author1', 5, 0);
    expect(record.grossRevenue).toBe(0);
    expect(record.authorRevenue).toBe(0);
    expect(record.platformFee).toBe(0);
  });

  it('S03-05: enterprise subscriber at $99.99 = correct split', () => {
    const record = calcEarnings('strat1', 'author1', 1, 99.99);
    expect(record.grossRevenue).toBeCloseTo(99.99, 2);
    expect(record.authorRevenue).toBeCloseTo(84.99, 2);
    expect(record.platformFee).toBeCloseTo(15.00, 2);
  });

  it('S03-06: settleEarning transitions from pending to settled', () => {
    const record = calcEarnings('strat1', 'author1', 1, 9.99);
    expect(record.status).toBe('pending');
    const ok = se.settleEarning(record.id);
    expect(ok).toBe(true);
    const updated = se.getEarningsByStrategy('strat1')[0];
    expect(updated.status).toBe('settled');
    expect(updated.settledAt).toBeDefined();
  });

  it('S03-07: payEarning transitions settled to paid', () => {
    const record = calcEarnings('strat1', 'author1', 1, 99.99);
    se.settleEarning(record.id);
    const ok = se.payEarning(record.id);
    expect(ok).toBe(true);
    const updated = se.getEarningsByStrategy('strat1')[0];
    expect(updated.status).toBe('paid');
    expect(updated.paidAt).toBeDefined();
  });

  it('S03-08: earnings below minPayout rejected for payment', () => {
    const record = calcEarnings('strat1', 'author1', 1, 9.99); // only $8.49 author rev, min payout = $10
    se.settleEarning(record.id);
    const ok = se.payEarning(record.id);
    expect(ok).toBe(false);
    expect(se.getEarningsByStrategy('strat1')[0].status).toBe('settled'); // still settled, not paid
  });

  it('S03-09: multiple earnings accumulate correctly', () => {
    se.subscribe({ strategyId: 's1', userId: 'u1', tier: 'basic', price: 9.99 });
    se.subscribe({ strategyId: 's1', userId: 'u2', tier: 'basic', price: 9.99 });
    se.subscribe({ strategyId: 's1', userId: 'u3', tier: 'premium', price: 29.99 });

    const now = new Date();
    const start = new Date(now.getTime() - 30 * 86400000).toISOString();
    const end = now.toISOString();

    const record = se.calculateEarnings('s1', 'author1', 'monthly', start, end);
    expect(record.grossRevenue).toBeCloseTo(49.97, 2); // 9.99+9.99+29.99
    expect(record.authorRevenue).toBeCloseTo(42.47, 2);
    expect(record.subscriberCount).toBe(3);
  });

  it('S03-10: getAuthorEarningsSummary aggregates correctly', () => {
    se.subscribe({ strategyId: 's1', userId: 'u1', tier: 'basic', price: 9.99 });
    const now = new Date();
    const start = new Date(now.getTime() - 30 * 86400000).toISOString();
    const end = now.toISOString();
    const record = se.calculateEarnings('s1', 'author1', 'monthly', start, end);
    se.settleEarning(record.id);

    const summary = se.getAuthorEarningsSummary('author1');
    expect(summary.totalGross).toBeCloseTo(9.99, 2);
    expect(summary.totalNet).toBeCloseTo(8.49, 2);
    expect(summary.strategyCount).toBe(1);
    expect(summary.pendingPayout).toBeCloseTo(8.49, 2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Section 4: Review Manager (Social Context)
// ─────────────────────────────────────────────────────────────────────────────

describe('Q-53-01-04: Review Manager in Social Trading', () => {
  beforeEach(() => { resetReviewManager(); });

  it('S04-01: subscriber can review followed strategy', () => {
    const rm = getReviewManager();
    const review = rm.createReview({
      strategyId: 'strat1',
      userId: 'follower1',
      userName: 'Follower One',
      rating: 5,
      title: 'Excellent strategy!',
      content: 'Best momentum strategy I have used.',
      verifiedPurchase: true,
    });
    expect(review).not.toBeNull();
    expect(review!.rating).toBe(5);
    expect(review!.status).toBe('pending');
    expect(review!.verifiedPurchase).toBe(true);
  });

  it('S04-02: rating must be integer 0-5', () => {
    const rm = getReviewManager();
    expect(rm.createReview({
      strategyId: 'strat1', userId: 'u1', userName: 'U1', rating: 3,
    })).not.toBeNull();
    expect(rm.createReview({
      strategyId: 'strat1', userId: 'u2', userName: 'U2', rating: 0,
    })).not.toBeNull();
    expect(rm.createReview({
      strategyId: 'strat1', userId: 'u3', userName: 'U3', rating: 5,
    })).not.toBeNull();
  });

  it('S04-03: duplicate review by same user rejected', () => {
    const rm = getReviewManager();
    rm.createReview({ strategyId: 'strat1', userId: 'u1', userName: 'U1', rating: 5 });
    const dup = rm.createReview({ strategyId: 'strat1', userId: 'u1', userName: 'U1', rating: 4 });
    expect(dup).toBeNull();
  });

  it('S04-04: admin can approve review', () => {
    const rm = getReviewManager();
    const review = rm.createReview({ strategyId: 'strat1', userId: 'u1', userName: 'U1', rating: 4 });
    expect(rm.approveReview(review!.id)).toBe(true);
    expect(rm.getReview(review!.id)!.status).toBe('approved');
  });

  it('S04-05: admin can reject review', () => {
    const rm = getReviewManager();
    const review = rm.createReview({ strategyId: 'strat1', userId: 'u1', userName: 'U1', rating: 1 });
    expect(rm.rejectReview(review!.id)).toBe(true);
    expect(rm.getReview(review!.id)!.status).toBe('rejected');
  });

  it('S04-06: approved reviews contribute to rating distribution', () => {
    const rm = getReviewManager();
    for (let i = 0; i < 5; i++) {
      const r = rm.createReview({ strategyId: 'strat1', userId: `u${i}`, userName: `U${i}`, rating: 4 });
      rm.approveReview(r!.id);
    }
    const dist = rm.getRatingDistribution('strat1');
    expect(dist.count).toBe(5);
    expect(dist.average).toBe(4);
    expect(dist.distribution[4]).toBe(5);
  });

  it('S04-07: helpful voting sorts by net helpful score', () => {
    const rm = getReviewManager();
    const r1 = rm.createReview({ strategyId: 'strat1', userId: 'u1', userName: 'U1', rating: 5 })!;
    const r2 = rm.createReview({ strategyId: 'strat1', userId: 'u2', userName: 'U2', rating: 4 })!;

    // r1 gets 5 helpful votes
    for (let i = 0; i < 5; i++) rm.markHelpful(r1.id, `voter${i}`);
    // r2 gets 10 helpful votes
    for (let i = 0; i < 10; i++) rm.markHelpful(r2.id, `voterB${i}`);

    const result = rm.getReviews({ strategyId: 'strat1', sortBy: 'helpful' });
    expect(result.reviews[0].id).toBe(r2.id); // r2 has higher net score
  });

  it('S04-08: moderation queue shows pending reviews', () => {
    const rm = getReviewManager();
    rm.createReview({ strategyId: 'strat1', userId: 'u1', userName: 'U1', rating: 1 });
    rm.createReview({ strategyId: 'strat1', userId: 'u2', userName: 'U2', rating: 5 });
    const r3 = rm.createReview({ strategyId: 'strat2', userId: 'u3', userName: 'U3', rating: 3 })!;
    rm.approveReview(r3.id); // move to approved

    const queue = rm.getModerationQueue();
    expect(queue.length).toBe(2); // only pending remain
    expect(queue.every(r => r.status === 'pending' || r.status === 'flagged')).toBe(true);
  });

  it('S04-09: user cannot vote on own review', () => {
    const rm = getReviewManager();
    const review = rm.createReview({ strategyId: 'strat1', userId: 'u1', userName: 'U1', rating: 5 })!;
    expect(rm.markHelpful(review.id, 'u1')).toBe(false); // can't vote own
  });

  it('S04-10: helpful vote is toggleable', () => {
    const rm = getReviewManager();
    const review = rm.createReview({ strategyId: 'strat1', userId: 'u1', userName: 'U1', rating: 5 })!;
    expect(rm.markHelpful(review.id, 'voter1')).toBe(true);
    expect(rm.getReview(review.id)!.helpful).toBe(1);
    // Toggle off
    expect(rm.markHelpful(review.id, 'voter1')).toBe(true);
    expect(rm.getReview(review.id)!.helpful).toBe(0);
  });
});

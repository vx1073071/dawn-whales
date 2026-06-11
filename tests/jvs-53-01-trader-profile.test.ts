/**
 * J-53-01: Trader Profile Engine Tests
 * 30+ tests covering: CRUD, follow, metrics, tier, ranking, certification
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  TraderProfileEngine,
  getTraderProfileEngine,
  resetTraderProfileEngine,
} from '../electron/engine/analysis/trader-profile-engine';

function mkInput(overrides: Record<string, any> = {}) {
  return {
    username: 'testtrader',
    displayName: 'Test Trader',
    bio: 'A test trader profile',
    tags: ['momentum', 'swing'],
    ...overrides,
  };
}

function mkMetrics(overrides: Record<string, any> = {}) {
  return {
    sharpe: 1.5,
    sortino: 2.0,
    calmar: 1.2,
    winRate: 55,
    profitFactor: 1.8,
    maxDrawdown: -15,
    totalReturn: 120,
    annualReturn: 40,
    totalTrades: 200,
    winningTrades: 110,
    losingTrades: 90,
    avgWinPct: 3.5,
    avgLossPct: -2.1,
    bestTradePct: 25,
    worstTradePct: -8,
    avgHoldDays: 5,
    streak: 3,
    ...overrides,
  };
}

// ── Section 1: Profile CRUD ─────────────────────────────────────────────

describe('J-53-01-01: Profile CRUD', () => {
  let engine: TraderProfileEngine;
  beforeEach(() => {
    resetTraderProfileEngine();
    engine = getTraderProfileEngine();
  });

  it('A01: createProfile returns valid id', () => {
    const id = engine.createProfile(mkInput());
    expect(id).toBeDefined();
    expect(id.startsWith('trader_')).toBe(true);
  });

  it('A02: created profile has correct fields', () => {
    const id = engine.createProfile(mkInput({ username: 'alpha1', displayName: 'Alpha One' }));
    const p = engine.getProfile(id)!;
    expect(p.username).toBe('alpha1');
    expect(p.displayName).toBe('Alpha One');
    expect(p.tier).toBe('rookie');
    expect(p.certStatus).toBe('none');
    expect(p.followersCount).toBe(0);
    expect(p.isPublic).toBe(true);
  });

  it('A03: rejects short username', () => {
    expect(() => engine.createProfile(mkInput({ username: 'ab' }))).toThrow('at least 3');
  });

  it('A04: rejects duplicate username', () => {
    engine.createProfile(mkInput({ username: 'duplicate' }));
    expect(() => engine.createProfile(mkInput({ username: 'duplicate' }))).toThrow('already taken');
  });

  it('A05: getProfileByUsername works', () => {
    engine.createProfile(mkInput({ username: 'findme' }));
    const p = engine.getProfileByUsername('findme');
    expect(p).not.toBeNull();
    expect(p!.username).toBe('findme');
  });

  it('A06: updateProfile updates fields', () => {
    const id = engine.createProfile(mkInput({ username: 'upd1' }));
    const ok = engine.updateProfile(id, { bio: 'Updated bio', tags: ['alpha'] });
    expect(ok).toBe(true);
    expect(engine.getProfile(id)!.bio).toBe('Updated bio');
    expect(engine.getProfile(id)!.tags).toEqual(['alpha']);
  });

  it('A07: updateProfile returns false for non-existent', () => {
    expect(engine.updateProfile('nonexistent', { bio: 'x' })).toBe(false);
  });

  it('A08: deleteProfile removes everything', () => {
    const id = engine.createProfile(mkInput({ username: 'del1' }));
    expect(engine.deleteProfile(id)).toBe(true);
    expect(engine.getProfile(id)).toBeNull();
  });

  it('A09: searchProfiles finds by username', () => {
    engine.createProfile(mkInput({ username: 'searchme' }));
    engine.createProfile(mkInput({ username: 'other' }));
    const r = engine.searchProfiles('searchme');
    expect(r.total).toBe(1);
    expect(r.profiles[0].username).toBe('searchme');
  });

  it('A10: searchProfiles finds by tag', () => {
    engine.createProfile(mkInput({ username: 'tag1', tags: ['momentum'] }));
    engine.createProfile(mkInput({ username: 'tag2', tags: ['value'] }));
    const r = engine.searchProfiles('momentum');
    expect(r.total).toBe(1);
  });
});

// ── Section 2: Follow System ────────────────────────────────────────────

describe('J-53-01-02: Follow System', () => {
  let engine: TraderProfileEngine;
  let a: string, b: string;

  beforeEach(() => {
    resetTraderProfileEngine();
    engine = getTraderProfileEngine();
    a = engine.createProfile(mkInput({ username: 'user_a' }));
    b = engine.createProfile(mkInput({ username: 'user_b' }));
  });

  it('B01: follow succeeds', () => {
    expect(engine.follow(a, b)).toBe(true);
    expect(engine.getProfile(b)!.followersCount).toBe(1);
    expect(engine.getProfile(a)!.followingCount).toBe(1);
  });

  it('B02: cannot follow self', () => {
    expect(engine.follow(a, a)).toBe(false);
  });

  it('B03: cannot follow twice', () => {
    engine.follow(a, b);
    expect(engine.follow(a, b)).toBe(false);
  });

  it('B04: unfollow works', () => {
    engine.follow(a, b);
    expect(engine.unfollow(a, b)).toBe(true);
    expect(engine.getProfile(b)!.followersCount).toBe(0);
  });

  it('B05: isFollowing checks correctly', () => {
    expect(engine.isFollowing(a, b)).toBe(false);
    engine.follow(a, b);
    expect(engine.isFollowing(a, b)).toBe(true);
  });

  it('B06: getFollowers/getFollowing return correct lists', () => {
    engine.follow(a, b);
    expect(engine.getFollowers(b)).toContain(a);
    expect(engine.getFollowing(a)).toContain(b);
  });
});

// ── Section 3: Metrics & Tier ───────────────────────────────────────────

describe('J-53-01-03: Metrics & Tier', () => {
  let engine: TraderProfileEngine;
  let id: string;

  beforeEach(() => {
    resetTraderProfileEngine();
    engine = getTraderProfileEngine();
    id = engine.createProfile(mkInput({ username: 'metric_trader' }));
  });

  it('C01: updateMetrics stores metrics', () => {
    expect(engine.updateMetrics(id, mkMetrics())).toBe(true);
    const m = engine.getMetrics(id)!;
    expect(m.sharpe).toBe(1.5);
    expect(m.winRate).toBe(55);
    expect(m.traderId).toBe(id);
  });

  it('C02: getMetrics returns null for unknown', () => {
    expect(engine.getMetrics('unknown')).toBeNull();
  });

  it('C03: tier upgrades for high performance', () => {
    engine.updateMetrics(id, mkMetrics({
      sharpe: 3.0,
      winRate: 70,
      totalTrades: 500,
      totalReturn: 300,
      maxDrawdown: -5,
    }));
    const p = engine.getProfile(id)!;
    expect(['elite', 'legendary']).toContain(p.tier);
  });

  it('C04: tier stays rookie for low performance', () => {
    engine.updateMetrics(id, mkMetrics({
      sharpe: 0.2,
      winRate: 30,
      totalTrades: 5,
      totalReturn: -10,
      maxDrawdown: -50,
    }));
    expect(engine.getProfile(id)!.tier).toBe('rookie');
  });

  it('C05: profile totalTrades updates from metrics', () => {
    engine.updateMetrics(id, mkMetrics({ totalTrades: 150 }));
    expect(engine.getProfile(id)!.totalTrades).toBe(150);
  });
});

// ── Section 4: Ranking ──────────────────────────────────────────────────

describe('J-53-01-04: Ranking', () => {
  let engine: TraderProfileEngine;

  beforeEach(() => {
    resetTraderProfileEngine();
    engine = getTraderProfileEngine();

    // Create 5 traders with varying performance
    for (let i = 0; i < 5; i++) {
      const id = engine.createProfile(mkInput({ username: `rank_${i}` }));
      engine.updateMetrics(id, mkMetrics({
        sharpe: 0.5 + i * 0.5,
        winRate: 40 + i * 5,
        totalReturn: 20 + i * 30,
        totalTrades: 50 + i * 20,
      }));
    }
  });

  it('D01: ranking returns all public traders', () => {
    const r = engine.getRankings({ dimension: 'overall', sortBy: 'score', page: 1, pageSize: 10 });
    expect(r.total).toBe(5);
    expect(r.rankings.length).toBe(5);
  });

  it('D02: ranking sorted by score descending', () => {
    const r = engine.getRankings({ dimension: 'overall', sortBy: 'score', page: 1, pageSize: 10 });
    for (let i = 0; i < r.rankings.length - 1; i++) {
      expect(r.rankings[i].score).toBeGreaterThanOrEqual(r.rankings[i + 1].score);
    }
  });

  it('D03: pagination works', () => {
    const r = engine.getRankings({ dimension: 'overall', sortBy: 'score', page: 1, pageSize: 3 });
    expect(r.rankings.length).toBe(3);
    expect(r.total).toBe(5);
  });

  it('D04: rank numbers are sequential', () => {
    const r = engine.getRankings({ dimension: 'return', sortBy: 'return', page: 1, pageSize: 10 });
    expect(r.rankings[0].rank).toBe(1);
    expect(r.rankings[4].rank).toBe(5);
  });

  it('D05: filter by tier', () => {
    const r = engine.getRankings({ dimension: 'overall', sortBy: 'score', page: 1, pageSize: 10, tier: 'rookie' });
    // Low performers are rookie
    expect(r.rankings.every(rk => rk.tier === 'rookie')).toBe(true);
  });
});

// ── Section 5: Certification ────────────────────────────────────────────

describe('J-53-01-05: Certification', () => {
  let engine: TraderProfileEngine;
  let id: string;

  beforeEach(() => {
    resetTraderProfileEngine();
    engine = getTraderProfileEngine();
    id = engine.createProfile(mkInput({ username: 'cert_trader' }));
  });

  it('E01: submit certification moves to pending', () => {
    expect(engine.submitCertification(id, 'identity', ['doc1.pdf'])).toBe(true);
    expect(engine.getProfile(id)!.certStatus).toBe('pending');
  });

  it('E02: approve certification sets verified', () => {
    engine.submitCertification(id, 'identity', ['doc1.pdf']);
    expect(engine.reviewCertification(id, true, 'admin', 'All good')).toBe(true);
    expect(engine.getProfile(id)!.certStatus).toBe('verified');
    expect(engine.getProfile(id)!.certLevel).toBe('identity');
  });

  it('E03: reject certification sets rejected', () => {
    engine.submitCertification(id, 'professional', ['doc1.pdf']);
    expect(engine.reviewCertification(id, false, 'admin', 'Insufficient docs')).toBe(true);
    expect(engine.getProfile(id)!.certStatus).toBe('rejected');
  });

  it('E04: cannot submit when already pending', () => {
    engine.submitCertification(id, 'basic', ['doc.pdf']);
    expect(engine.submitCertification(id, 'identity', ['doc2.pdf'])).toBe(false);
  });

  it('E05: cannot submit when already verified', () => {
    engine.submitCertification(id, 'basic', ['doc.pdf']);
    engine.reviewCertification(id, true, 'admin');
    expect(engine.submitCertification(id, 'identity', ['doc2.pdf'])).toBe(false);
  });

  it('E06: getPendingCertifications lists pending', () => {
    engine.submitCertification(id, 'identity', ['doc.pdf']);
    const pending = engine.getPendingCertifications();
    expect(pending.length).toBe(1);
    expect(pending[0].traderId).toBe(id);
  });

  it('E07: certOnly ranking filter works', () => {
    engine.submitCertification(id, 'identity', ['doc.pdf']);
    engine.reviewCertification(id, true, 'admin');

    const id2 = engine.createProfile(mkInput({ username: 'nocert' }));

    const r = engine.getRankings({ dimension: 'overall', sortBy: 'score', page: 1, pageSize: 10, certOnly: true });
    expect(r.total).toBe(1);
    expect(r.rankings[0].traderId).toBe(id);
  });
});

// ── Section 6: Stats & Singleton ────────────────────────────────────────

describe('J-53-01-06: Stats & Singleton', () => {
  beforeEach(() => { resetTraderProfileEngine(); });

  it('F01: getStats returns correct counts', () => {
    const engine = getTraderProfileEngine();
    engine.createProfile(mkInput({ username: 'stat1' }));
    engine.createProfile(mkInput({ username: 'stat2' }));

    const stats = engine.getStats();
    expect(stats.totalTraders).toBe(2);
    expect(stats.byTier.rookie).toBe(2);
    expect(stats.byCertStatus.none).toBe(2);
  });

  it('F02: singleton returns same instance', () => {
    const a = getTraderProfileEngine();
    const b = getTraderProfileEngine();
    expect(a).toBe(b);
  });

  it('F03: reset creates fresh instance', () => {
    const engine = getTraderProfileEngine();
    engine.createProfile(mkInput({ username: 'willreset' }));
    resetTraderProfileEngine();
    const fresh = getTraderProfileEngine();
    expect(fresh.getStats().totalTraders).toBe(0);
  });
});

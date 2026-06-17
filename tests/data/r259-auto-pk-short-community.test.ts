/**
 * R259 autoclaw 综合测试 — 对比PK桥接 + 卖空数据管线 + 社区桥接
 * 3模块 × 各~17断言 → ~51个测试
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ComparisonPkBridge, comparisonPkBridge } from '../../electron/engine/data/comparison-pk-bridge';
import type { PkEntry } from '../../electron/engine/data/comparison-pk-bridge';
import { ShortSellingPipeline, shortSellingPipeline } from '../../electron/engine/data/short-selling-pipeline';
import type { ShortSellingRecord } from '../../electron/engine/data/short-selling-pipeline';
import { CommunityBridge, communityBridge } from '../../electron/engine/data/community-bridge';

// ── Helpers ────────────────────────────────────────────────────────────────
function makeEntry(sym: string, changePct: number, overrides?: Partial<PkEntry>): PkEntry {
  return {
    symbol: sym, name: sym, nameCn: sym,
    market: 'US', price: 100 + changePct, changePercent: changePct,
    volumeRatio: 1.5,
    pe: 20 + changePct, rsi: 50 + changePct * 2,
    macdSignal: changePct > 2 ? 'bullish' : changePct < -2 ? 'bearish' : 'neutral',
    sentimentScore: changePct / 10, beta: 1.0,
    ...overrides,
  };
}

function makeShortRec(sym: string, ratio: number, prevRatio?: number, date = '2026-06-17'): ShortSellingRecord {
  return {
    symbol: sym, name: sym, nameCn: sym, date,
    shortVolume: ratio * 100000, totalVolume: 1000000,
    shortRatio: ratio, shortTurnover: ratio * 5000000,
    previousShortRatio: prevRatio,
    changeFromPrev: prevRatio !== undefined ? ratio - prevRatio : undefined,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// P1-07: ComparisonPkBridge 测试
// ═══════════════════════════════════════════════════════════════════════════

describe('R259 P1-07 ComparisonPkBridge', () => {
  let bridge: ComparisonPkBridge;
  beforeEach(() => { bridge = new ComparisonPkBridge(); });

  describe('compare', () => {
    it('should compare two entries and declare winner', () => {
      const a = makeEntry('AAPL', 3.5);
      const b = makeEntry('MSFT', -1.2);
      const result = bridge.compare([a, b]);

      expect(result.symbols).toHaveLength(2);
      expect(result.winner).toBe('AAPL');
      expect(result.dimensions.length).toBe(7);
      expect(result.compositeScores.AAPL).toBeGreaterThan(result.compositeScores.MSFT);
    });

    it('should generate 7 dimension scores', () => {
      const result = bridge.compare([makeEntry('TSLA', 8), makeEntry('F', -3)]);
      const dimNames = result.dimensions.map(d => d.dimension);
      expect(dimNames).toContain('price');
      expect(dimNames).toContain('momentum');
      expect(dimNames).toContain('volume');
      expect(dimNames).toContain('valuation');
      expect(dimNames).toContain('technical');
      expect(dimNames).toContain('sentiment');
      expect(dimNames).toContain('risk');
    });

    it('should rank entries by composite score', () => {
      const entries = [makeEntry('A', -5), makeEntry('B', 3), makeEntry('C', -1)];
      const result = bridge.compare(entries);

      expect(result.ranking[0]).toBe('B');
      expect(result.compositeScores.B).toBeGreaterThan(result.compositeScores.C);
    });
  });

  describe('quickCompare', () => {
    it('should quickly compare two symbols', () => {
      const result = bridge.quickCompare(makeEntry('NVDA', 6), makeEntry('AMD', -2));
      expect(result.winner).toBe('NVDA');
    });
  });

  describe('groups', () => {
    it('should create and retrieve groups', () => {
      bridge.createGroup({
        groupName: 'Tech Giants', groupNameCn: '科技龙头',
        category: 'sector', symbols: ['AAPL', 'MSFT', 'GOOGL'],
      });

      const groups = bridge.getGroups();
      expect(groups.length).toBe(1);
      expect(groups[0].symbols).toContain('AAPL');
    });

    it('should filter groups by category', () => {
      bridge.createGroup({ groupName: 'Tech', groupNameCn: '科技', category: 'sector', symbols: ['AAPL'] });
      bridge.createGroup({ groupName: 'My List', groupNameCn: '我的', category: 'watchlist', symbols: ['TSLA'] });

      expect(bridge.getGroups('sector').length).toBe(1);
      expect(bridge.getGroups('watchlist').length).toBe(1);
    });

    it('should delete groups', () => {
      const g = bridge.createGroup({ groupName: 'X', groupNameCn: 'X', category: 'custom', symbols: ['A'] });
      expect(bridge.deleteGroup(g.groupId)).toBe(true);
      expect(bridge.getGroups()).toHaveLength(0);
    });
  });

  describe('radar data', () => {
    it('should generate radar chart data', () => {
      const result = bridge.compare([makeEntry('TSLA', 8), makeEntry('GM', -3)]);
      const radar = bridge.getRadarData(result.pkId);
      expect(radar).not.toBeNull();
      if (radar) {
        expect(radar.length).toBe(2);
        expect(radar[0].values.length).toBe(7);
      }
    });
  });

  describe('dimensions config', () => {
    it('should return dimension config with weights', () => {
      const dims = bridge.getDimensions();
      expect(dims.length).toBe(7);
      expect(dims[0].weight).toBeGreaterThan(0);
    });
  });

  describe('history', () => {
    it('should store and retrieve PK results', () => {
      bridge.compare([makeEntry('A', 2), makeEntry('B', 1)]);
      bridge.compare([makeEntry('C', -2), makeEntry('D', -1)]);

      const history = bridge.getHistory();
      expect(history.length).toBe(2);
    });
  });

  describe('prebuilt singleton', () => {
    it('should be available', () => {
      const stats = comparisonPkBridge.getStats();
      expect(typeof stats.totalPks).toBe('number');
      comparisonPkBridge.reset();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// P1-08: ShortSellingPipeline 测试
// ═══════════════════════════════════════════════════════════════════════════

describe('R259 P1-08 ShortSellingPipeline', () => {
  let pipe: ShortSellingPipeline;
  beforeEach(() => { pipe = new ShortSellingPipeline(); });

  describe('ingestion', () => {
    it('should ingest records and track stats', () => {
      pipe.ingest([
        makeShortRec('0700.HK', 18, 12),
        makeShortRec('9988.HK', 25, 20),
        makeShortRec('0005.HK', 8, 10),
      ]);

      const stats = pipe.getStats();
      expect(stats.totalRecords).toBe(3);
    });

    it('should detect short spike signals', () => {
      pipe.ingest([makeShortRec('0700.HK', 18, 12)]); // +6pp, ratio >10%

      const signals = pipe.getSignals();
      expect(signals.length).toBeGreaterThanOrEqual(1);
      expect(signals.some(s => s.signalType === 'short_spike')).toBe(true);
    });

    it('should detect crowding signals', () => {
      pipe.ingest([makeShortRec('9988.HK', 32, 28)]); // >30%

      const signals = pipe.getSignals();
      expect(signals.some(s => s.signalType === 'high_crowding')).toBe(true);
    });

    it('should detect declining short signals', () => {
      pipe.ingest([makeShortRec('0005.HK', 8, 15)]); // -7pp from 15%

      const signals = pipe.getSignals();
      expect(signals.some(s => s.signalType === 'declining_short')).toBe(true);
    });

    it('should not signal for normal activity', () => {
      pipe.ingest([makeShortRec('0016.HK', 5, 6)]); // low ratio, small change

      const signals = pipe.getSignals();
      expect(signals.length).toBe(0);
    });
  });

  describe('short squeeze detection', () => {
    it('should detect squeeze risk when price rises against high short', () => {
      pipe.ingest([makeShortRec('0700.HK', 28)]); // 28% short

      const result = pipe.checkShortSqueeze('0700.HK', 420, 380);
      expect(result.squeezeRisk).toBe(true);
      expect(result.squeezeScore).toBeGreaterThan(0.2);
    });

    it('should report no squeeze when price is falling', () => {
      pipe.ingest([makeShortRec('0700.HK', 28)]);

      const result = pipe.checkShortSqueeze('0700.HK', 350, 380);
      expect(result.squeezeRisk).toBe(false);
    });

    it('should handle unknown symbols', () => {
      const result = pipe.checkShortSqueeze('UNKNOWN', 100, 90);
      expect(result.squeezeRisk).toBe(false);
    });
  });

  describe('summaries', () => {
    it('should generate daily summary', () => {
      pipe.ingest([
        makeShortRec('0700.HK', 18, 12, '2026-06-17'),
        makeShortRec('9988.HK', 25, 20, '2026-06-17'),
      ]);

      const summary = pipe.generateSummary('2026-06-17');
      expect(summary.totalRecords).toBe(2);
      expect(summary.topShorted.length).toBeLessThanOrEqual(10);
      expect(summary.signalsGenerated).toBeGreaterThanOrEqual(0);
    });
  });

  describe('query', () => {
    it('should get history for symbol', () => {
      pipe.ingest([
        makeShortRec('0700.HK', 18, 12, '2026-06-16'),
        makeShortRec('0700.HK', 22, 18, '2026-06-17'),
      ]);

      const history = pipe.getHistory('0700.HK');
      expect(history.length).toBe(2);
      expect(history[0].date).toBe('2026-06-17');
    });

    it('should get latest record', () => {
      pipe.ingest([makeShortRec('9988.HK', 25, 20)]);
      const latest = pipe.getLatest('9988.HK');
      expect(latest?.shortRatio).toBe(25);
    });

    it('should get most shorted', () => {
      pipe.ingest([
        makeShortRec('A.HK', 10), makeShortRec('B.HK', 30), makeShortRec('C.HK', 20),
      ]);

      const top = pipe.getMostShorted(2);
      expect(top.length).toBe(2);
      expect(top[0].symbol).toBe('B.HK');
    });

    it('should filter signals by type', () => {
      pipe.ingest([makeShortRec('0700.HK', 32, 25)]); // crowding + spike

      const crowding = pipe.getSignals(undefined, 'high_crowding');
      expect(crowding.length).toBeGreaterThanOrEqual(1);
      expect(crowding[0].signalType).toBe('high_crowding');
    });
  });

  describe('persistent short', () => {
    it('should detect persistent short over consecutive days', () => {
      // Need 3+ days >15%
      pipe.ingest([makeShortRec('0700.HK', 16, 14, '2026-06-15')]);
      pipe.ingest([makeShortRec('0700.HK', 18, 16, '2026-06-16')]);
      pipe.ingest([makeShortRec('0700.HK', 20, 18, '2026-06-17')]);

      const signals = pipe.getSignals(undefined, 'persistent_short');
      // The 3rd day should trigger persistent
      expect(signals.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('prebuilt singleton', () => {
    it('should be available', () => {
      const stats = shortSellingPipeline.getStats();
      expect(typeof stats.totalRecords).toBe('number');
      shortSellingPipeline.reset();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// P1-09: CommunityBridge 测试
// ═══════════════════════════════════════════════════════════════════════════

describe('R259 P1-09 CommunityBridge', () => {
  let bridge: CommunityBridge;
  beforeEach(() => { bridge = new CommunityBridge(); });

  describe('user profiles', () => {
    it('should register and retrieve users', () => {
      bridge.registerUser({
        userId: 'u1', username: 'trader1', displayName: 'Trader One',
        followers: 0, following: 0, totalLikes: 0, strategiesShared: 0,
        joinedAt: Date.now(),
      });

      const user = bridge.getUser('u1');
      expect(user?.username).toBe('trader1');
    });

    it('should update user metrics', () => {
      bridge.registerUser({
        userId: 'u1', username: 'trader1', displayName: 'Trader One',
        followers: 0, following: 0, totalLikes: 0, strategiesShared: 0,
        joinedAt: Date.now(),
      });

      bridge.updateUserMetrics('u1', { winRate: 0.65, totalReturn: 25.5 });
      const user = bridge.getUser('u1');
      expect(user?.winRate).toBe(0.65);
      expect(user?.totalReturn).toBe(25.5);
    });
  });

  describe('follow system', () => {
    it('should follow and unfollow', () => {
      bridge.registerUser({ userId: 'a', username: 'a', displayName: 'A', followers: 0, following: 0, totalLikes: 0, strategiesShared: 0, joinedAt: 0 });
      bridge.registerUser({ userId: 'b', username: 'b', displayName: 'B', followers: 0, following: 0, totalLikes: 0, strategiesShared: 0, joinedAt: 0 });

      bridge.follow('a', 'b');
      expect(bridge.isFollowing('a', 'b')).toBe(true);
      expect(bridge.getFollowerCount('b')).toBe(1);

      bridge.unfollow('a', 'b');
      expect(bridge.isFollowing('a', 'b')).toBe(false);
    });
  });

  describe('strategy sharing', () => {
    it('should share a strategy', () => {
      bridge.registerUser({ userId: 'u1', username: 'u1', displayName: 'U1', followers: 0, following: 0, totalLikes: 0, strategiesShared: 0, joinedAt: 0 });

      const s = bridge.shareStrategy({
        ownerId: 'u1', ownerName: 'U1',
        strategyName: 'Golden Cross', strategyType: 'trend_following',
        visibility: 'public',
        description: '50/200 MA crossover', descriptionCn: '50/200均线金叉',
        metrics: { totalReturn: 35, winRate: 0.68, sharpeRatio: 1.8, maxDrawdown: 12, tradesCount: 50 },
      });

      expect(s.shareId).toMatch(/^share:u1:/);
      expect(s.likes).toBe(0);
      expect(s.copies).toBe(0);
    });

    it('should like and unlike strategies', () => {
      bridge.registerUser({ userId: 'u1', username: 'u1', displayName: 'U1', followers: 0, following: 0, totalLikes: 0, strategiesShared: 0, joinedAt: 0 });

      const s = bridge.shareStrategy({
        ownerId: 'u1', ownerName: 'U1',
        strategyName: 'MA Cross', strategyType: 'trend_following',
        visibility: 'public',
        description: 'test', descriptionCn: '测试',
        metrics: { totalReturn: 10, winRate: 0.6, sharpeRatio: 1.0, maxDrawdown: 5, tradesCount: 20 },
      });

      bridge.like('u1', s.shareId);
      expect(bridge.hasLiked('u1', s.shareId)).toBe(true);

      bridge.unlike('u1', s.shareId);
      expect(bridge.hasLiked('u1', s.shareId)).toBe(false);
    });

    it('should copy strategies', () => {
      bridge.registerUser({ userId: 'u1', username: 'u1', displayName: 'U1', followers: 0, following: 0, totalLikes: 0, strategiesShared: 0, joinedAt: 0 });
      bridge.registerUser({ userId: 'u2', username: 'u2', displayName: 'U2', followers: 0, following: 0, totalLikes: 0, strategiesShared: 0, joinedAt: 0 });

      const s = bridge.shareStrategy({
        ownerId: 'u1', ownerName: 'U1',
        strategyName: 'RSI Reversal', strategyType: 'mean_reversion',
        visibility: 'public',
        description: 'test', descriptionCn: '测试',
        metrics: { totalReturn: 15, winRate: 0.55, sharpeRatio: 0.9, maxDrawdown: 8, tradesCount: 30 },
      });

      bridge.copyStrategy(s.shareId, 'u2');
      const copied = bridge.getStrategy(s.shareId);
      expect(copied?.copies).toBe(1);
    });

    it('should return strategy feed', () => {
      bridge.registerUser({ userId: 'u1', username: 'u1', displayName: 'U1', followers: 0, following: 0, totalLikes: 0, strategiesShared: 0, joinedAt: 0 });

      bridge.shareStrategy({
        ownerId: 'u1', ownerName: 'U1',
        strategyName: 'S1', strategyType: 'trend', visibility: 'public',
        description: 'a', descriptionCn: 'a',
        metrics: { totalReturn: 10, winRate: 0.5, sharpeRatio: 1, maxDrawdown: 5, tradesCount: 10 },
      });
      bridge.shareStrategy({
        ownerId: 'u1', ownerName: 'U1',
        strategyName: 'S2', strategyType: 'momentum', visibility: 'private',
        description: 'b', descriptionCn: 'b',
        metrics: { totalReturn: 20, winRate: 0.6, sharpeRatio: 2, maxDrawdown: 3, tradesCount: 20 },
      });

      const feed = bridge.getStrategyFeed();
      expect(feed.length).toBe(1); // only public
    });
  });

  describe('leaderboard', () => {
    it('should generate return leaderboard', () => {
      bridge.registerUser({ userId: 'a', username: 'a', displayName: 'A', followers: 5, following: 2, totalLikes: 10, strategiesShared: 3, winRate: 0.7, totalReturn: 50, joinedAt: 0 });
      bridge.registerUser({ userId: 'b', username: 'b', displayName: 'B', followers: 3, following: 1, totalLikes: 5, strategiesShared: 1, winRate: 0.55, totalReturn: 20, joinedAt: 0 });

      const board = bridge.generateLeaderboard('total_return');
      expect(board.length).toBe(2);
      expect(board[0].userId).toBe('a');
      expect(board[0].rank).toBe(1);
    });

    it('should generate popularity leaderboard', () => {
      bridge.registerUser({ userId: 'a', username: 'a', displayName: 'A', followers: 100, following: 5, totalLikes: 200, strategiesShared: 10, joinedAt: 0 });
      bridge.registerUser({ userId: 'b', username: 'b', displayName: 'B', followers: 10, following: 3, totalLikes: 30, strategiesShared: 2, joinedAt: 0 });

      const board = bridge.generateLeaderboard('popularity');
      expect(board.length).toBe(2);
      expect(board[0].userId).toBe('a');
    });
  });

  describe('community stats', () => {
    it('should track community stats', () => {
      bridge.registerUser({ userId: 'a', username: 'a', displayName: 'A', followers: 0, following: 0, totalLikes: 0, strategiesShared: 0, joinedAt: 0 });

      const stats = bridge.getCommunityStats();
      expect(stats.totalUsers).toBe(1);
    });
  });

  describe('comments', () => {
    it('should add comments to strategies', () => {
      bridge.registerUser({ userId: 'a', username: 'a', displayName: 'A', followers: 0, following: 0, totalLikes: 0, strategiesShared: 0, joinedAt: 0 });

      const s = bridge.shareStrategy({
        ownerId: 'a', ownerName: 'A',
        strategyName: 'Test', strategyType: 'trend', visibility: 'public',
        description: 'test', descriptionCn: '测试',
        metrics: { totalReturn: 5, winRate: 0.5, sharpeRatio: 0.5, maxDrawdown: 3, tradesCount: 5 },
      });

      bridge.comment('a', s.shareId, 'Great strategy!');
      const strategy = bridge.getStrategy(s.shareId);
      expect(strategy?.comments).toBe(1);
    });
  });

  describe('event feed', () => {
    it('should return social events feed', () => {
      bridge.registerUser({ userId: 'a', username: 'a', displayName: 'A', followers: 0, following: 0, totalLikes: 0, strategiesShared: 0, joinedAt: 0 });
      bridge.registerUser({ userId: 'b', username: 'b', displayName: 'B', followers: 0, following: 0, totalLikes: 0, strategiesShared: 0, joinedAt: 0 });

      bridge.follow('a', 'b');
      const feed = bridge.getEventFeed();
      expect(feed.length).toBeGreaterThanOrEqual(1);
      expect(feed[0].action).toBe('follow');
    });
  });

  describe('prebuilt singleton', () => {
    it('should be available', () => {
      const stats = communityBridge.getCommunityStats();
      expect(typeof stats.totalUsers).toBe('number');
      communityBridge.reset();
    });
  });
});

/**
 * J-66-04 Tests: 创作者排行榜API (R66 v19)
 *
 * 3 tests: ranking, dimension switch, tier filter
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  CreatorLeaderboardEngine, getLeaderboard, resetLeaderboard,
} from '../electron/engine/portfolio/creator-leaderboard-api';
import type { CreatorSnapshot } from '../electron/engine/portfolio/creator-leaderboard-api';

function makeSnapshot(overrides: Partial<CreatorSnapshot> = {}): CreatorSnapshot {
  return {
    userId: 'u-' + Math.random().toString(36).substring(2, 5),
    nickname: 'Creator_' + Math.random().toString(36).substring(2, 5),
    tier: 'bronze', totalRevenue: 1000, revenue30d: 100,
    sharpeRatio: 1.0, subscribers: 10, templateSales: 5,
    ...overrides,
  };
}

describe('J-66-04: Creator Leaderboard API', () => {
  let lb: CreatorLeaderboardEngine;

  beforeEach(() => {
    resetLeaderboard();
    lb = getLeaderboard();
  });

  it('01: ranking by total revenue', () => {
    lb.updateSnapshot(makeSnapshot({ userId: 'u1', totalRevenue: 5000 }));
    lb.updateSnapshot(makeSnapshot({ userId: 'u2', totalRevenue: 3000 }));
    lb.updateSnapshot(makeSnapshot({ userId: 'u3', totalRevenue: 8000 }));

    const board = lb.getLeaderboard('total_revenue', 'all', 'all', 3);
    expect(board.entries.length).toBe(3);
    expect(board.entries[0].userId).toBe('u3'); // highest
    expect(board.entries[0].rank).toBe(1);
    expect(board.entries[2].userId).toBe('u2'); // lowest
  });

  it('02: ranking by different dimensions', () => {
    lb.updateSnapshot(makeSnapshot({ userId: 'a', subscribers: 100, totalRevenue: 1000 }));
    lb.updateSnapshot(makeSnapshot({ userId: 'b', subscribers: 50, totalRevenue: 5000 }));

    const byRevenue = lb.getLeaderboard('total_revenue', 'all', 'all', 2);
    expect(byRevenue.entries[0].userId).toBe('b');

    const bySubs = lb.getLeaderboard('subscribers', 'all', 'all', 2);
    expect(bySubs.entries[0].userId).toBe('a');
  });

  it('03: L1/L2/L3 tier filter', () => {
    lb.updateSnapshot(makeSnapshot({ userId: 'l1a', tier: 'bronze', totalRevenue: 100 }));
    lb.updateSnapshot(makeSnapshot({ userId: 'l1b', tier: 'silver', totalRevenue: 200 }));
    lb.updateSnapshot(makeSnapshot({ userId: 'l2a', tier: 'gold', totalRevenue: 500 }));
    lb.updateSnapshot(makeSnapshot({ userId: 'l3a', tier: 'diamond', totalRevenue: 1000 }));

    const l1Board = lb.getLeaderboard('total_revenue', 'all', 'L1');
    expect(l1Board.entries.length).toBe(2);
    expect(l1Board.entries.every(e => e.tier === 'bronze' || e.tier === 'silver')).toBe(true);

    const l3Board = lb.getLeaderboard('total_revenue', 'all', 'L3');
    expect(l3Board.entries.length).toBe(1);
    expect(l3Board.entries[0].userId).toBe('l3a');

    // Position change tracking
    const board2 = lb.getLeaderboard('total_revenue', 'all', 'all');
    expect(board2.entries[0].userId).toBe('l3a');
  });

  it('04: all leaderboards returns 5 dimensions', () => {
    lb.updateSnapshot(makeSnapshot({ userId: 'x', totalRevenue: 500, revenue30d: 50, sharpeRatio: 1.5, subscribers: 20, templateSales: 3 }));
    const all = lb.getAllLeaderboards('all', 'all', 5);
    expect(Object.keys(all).length).toBe(5);
    expect(all.total_revenue.entries.length).toBe(1);
    expect(all.subscribers.entries.length).toBe(1);
  });

  it('05: getCreatorRank finds creator by dimension', () => {
    lb.updateSnapshot(makeSnapshot({ userId: 'creatorX', totalRevenue: 9999 }));
    lb.updateSnapshot(makeSnapshot({ userId: 'creatorY', totalRevenue: 100 }));
    const rank = lb.getCreatorRank('creatorX');
    expect(rank).toBeTruthy();
    expect(rank!.rank).toBe(1);
  });
});

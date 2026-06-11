/**
 * J-66-04 [P1]: creatorAPI (R66 v19 — v1.6.0 GA)
 *
 * : /30/Sharpe/subscribe/
 * L1-L3 ,
 *
 * >=150L, 3 tests
 */

import type { CreatorTier } from './creator-tier-engine';

// ── Types ──────────────────────────────────────────────────────────────────

export type LeaderboardDimension = 'total_revenue' | 'revenue_30d' | 'sharpe' | 'subscribers' | 'template_sales';
export type TimeWindow = 'all' | '30d' | '7d';
export type TierFilter = 'L1' | 'L2' | 'L3' | 'all';

export interface CreatorRankEntry {
  rank: number;
  userId: string;
  nickname: string;
  tier: CreatorTier;
  value: number;
  change: number;            // position change since last period
  dimension: LeaderboardDimension;
}

export interface LeaderboardSlice {
  dimension: LeaderboardDimension;
  window: TimeWindow;
  tierFilter: TierFilter;
  entries: CreatorRankEntry[];
  total: number;
  updatedAt: string;
}

// ── L1/L2/L3 mapping ─────────────────────────────────────────────────────

function toTierFilter(tier: CreatorTier): TierFilter {
  if (tier === 'bronze' || tier === 'silver') return 'L1';
  if (tier === 'gold' || tier === 'platinum') return 'L2';
  return 'L3';
}

// ── Leaderboard Engine ────────────────────────────────────────────────────

export interface CreatorSnapshot {
  userId: string;
  nickname: string;
  tier: CreatorTier;
  totalRevenue: number;
  revenue30d: number;
  sharpeRatio: number;
  subscribers: number;
  templateSales: number;
}

export class CreatorLeaderboardEngine {
  private snapshots: Map<string, CreatorSnapshot> = new Map();
  private previousRankings: Map<string, Map<string, number>> = new Map(); // dim→userId→prevRank

  // ── Data Input ──────────────────────────────────────────────────────────

  updateSnapshot(snapshot: CreatorSnapshot): void {
    this.snapshots.set(snapshot.userId, snapshot);
  }

  updateSnapshots(snapshots: CreatorSnapshot[]): void {
    for (const s of snapshots) this.updateSnapshot(s);
  }

  // ── Ranking ─────────────────────────────────────────────────────────────

  getLeaderboard(
    dimension: LeaderboardDimension = 'total_revenue',
    window: TimeWindow = 'all',
    tierFilter: TierFilter = 'all',
    limit: number = 20,
  ): LeaderboardSlice {
    // Save current rankings for change calculation
    const prevKey = `${dimension}:${window}`;
    const prev = this.previousRankings.get(prevKey);

    // Filter by tier
    let entries = [...this.snapshots.values()];
    if (tierFilter !== 'all') {
      entries = entries.filter(s => toTierFilter(s.tier) === tierFilter);
    }

    // Get value based on dimension + window
    const getValue = (s: CreatorSnapshot): number => {
      switch (dimension) {
        case 'total_revenue': return s.totalRevenue;
        case 'revenue_30d': return s.revenue30d;
        case 'sharpe': return s.sharpeRatio;
        case 'subscribers': return s.subscribers;
        case 'template_sales': return s.templateSales;
        default: return 0;
      }
    };

    // Sort descending
    entries.sort((a, b) => getValue(b) - getValue(a));

    // Build ranking
    const ranked: CreatorRankEntry[] = entries.slice(0, limit).map((s, i) => {
      const rank = i + 1;
      const prevRank = prev?.get(s.userId);
      const change = prevRank !== undefined ? prevRank - rank : 0;

      return {
        rank, userId: s.userId, nickname: s.nickname, tier: s.tier,
        value: getValue(s), change, dimension,
      };
    });

    // Save current rankings for next time
    const currentMap = new Map<string, number>();
    ranked.forEach(r => currentMap.set(r.userId, r.rank));
    this.previousRankings.set(prevKey, currentMap);

    return {
      dimension, window, tierFilter,
      entries: ranked,
      total: entries.length,
      updatedAt: new Date().toISOString(),
    };
  }

  // ── Multiple Dimensions ─────────────────────────────────────────────────

  getAllLeaderboards(window: TimeWindow = 'all', tierFilter: TierFilter = 'all', limit: number = 10): Record<LeaderboardDimension, LeaderboardSlice> {
    const dimensions: LeaderboardDimension[] = ['total_revenue', 'revenue_30d', 'sharpe', 'subscribers', 'template_sales'];
    const result = {} as Record<LeaderboardDimension, LeaderboardSlice>;
    for (const dim of dimensions) {
      result[dim] = this.getLeaderboard(dim, window, tierFilter, limit);
    }
    return result;
  }

  // ── Queries ─────────────────────────────────────────────────────────────

  getCreatorRank(userId: string, dimension: LeaderboardDimension = 'total_revenue'): CreatorRankEntry | null {
    const lb = this.getLeaderboard(dimension, 'all', 'all', 1000);
    return lb.entries.find(e => e.userId === userId) ?? null;
  }

  getTopCreators(dimension: LeaderboardDimension = 'total_revenue', limit: number = 5): CreatorRankEntry[] {
    return this.getLeaderboard(dimension, 'all', 'all', limit).entries;
  }

  // ── Stats ──────────────────────────────────────────────────────────────

  getStats(): { totalCreators: number; dimensions: number; tiers: Record<TierFilter, number> } {
    const all = [...this.snapshots.values()];
    const tiers: Record<TierFilter, number> = { L1: 0, L2: 0, L3: 0, all: all.length };
    for (const s of all) tiers[toTierFilter(s.tier)]++;
    return { totalCreators: all.length, dimensions: 5, tiers };
  }

  // ── Reset ──────────────────────────────────────────────────────────────

  reset(): void {
    this.snapshots.clear();
    this.previousRankings.clear();
  }
}

// ── Singleton ────────────────────────────────────────────────────────────

let _leaderboard: CreatorLeaderboardEngine | null = null;

export function getLeaderboard(): CreatorLeaderboardEngine {
  if (!_leaderboard) _leaderboard = new CreatorLeaderboardEngine();
  return _leaderboard;
}

export function resetLeaderboard(): void {
  _leaderboard?.reset();
  _leaderboard = null;
}

export default { CreatorLeaderboardEngine, getLeaderboard, resetLeaderboard };

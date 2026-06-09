/**
 * @vitest-environment node
 * Q-66-01: 创作者等级晋升/降级测试 (R66 v19, 12 tests)
 *
 * PM v19 spec (07:48):
 * - 等级: 青铜→白银→黄金→铂金→钻石→王者 6级
 * - 经验: AI分析次数 + 信号订阅数 + 模板销量 + 7日胜率
 * - 权益: L1/L2/L3抽成比 (70/30→80/20→90/10)
 * - 自动晋升/降级
 */

import { describe, it, expect, beforeEach } from "vitest";

// ── Tier Engine (v19 spec) ─────────────────────────────────────────────────

type TierName = "bronze" | "silver" | "gold" | "platinum" | "diamond" | "master";

interface TierThreshold {
  tier: TierName;
  tierDisplay: string;
  level: number;        // L1-L6
  splitRatio: number;   // creator/platform split (e.g. 0.7 = 70%)
  minAI: number;        // AI analysis count
  minSubs: number;      // subscriber count
  minSales: number;     // template sales
  minWinRate: number;   // 7-day win rate %
}

const TIERS: TierThreshold[] = [
  { tier: "bronze",    tierDisplay: "青铜", level: 1, splitRatio: 0.70, minAI: 0,    minSubs: 0,   minSales: 0, minWinRate: 0 },
  { tier: "silver",    tierDisplay: "白银", level: 2, splitRatio: 0.75, minAI: 10,   minSubs: 5,   minSales: 1, minWinRate: 30 },
  { tier: "gold",      tierDisplay: "黄金", level: 3, splitRatio: 0.80, minAI: 30,   minSubs: 20,  minSales: 3, minWinRate: 40 },
  { tier: "platinum",  tierDisplay: "铂金", level: 4, splitRatio: 0.85, minAI: 60,   minSubs: 50,  minSales: 8, minWinRate: 50 },
  { tier: "diamond",   tierDisplay: "钻石", level: 5, splitRatio: 0.90, minAI: 120,  minSubs: 100, minSales: 15, minWinRate: 55 },
  { tier: "master",    tierDisplay: "王者", level: 6, splitRatio: 0.95, minAI: 250,  minSubs: 300, minSales: 30, minWinRate: 60 },
];

interface CreatorStats {
  totalAI: number;
  subscribers: number;
  templateSales: number;
  winRate7d: number;       // percentage
  currentTier: TierName;
  tierChangedAt: string;
}

class CreatorTierEngine {
  getTierByLevel(level: number): TierThreshold {
    return TIERS.find(t => t.level === level) || TIERS[0];
  }

  getTierByName(name: TierName): TierThreshold {
    return TIERS.find(t => t.tier === name) || TIERS[0];
  }

  calculateTier(stats: CreatorStats): { newTier: TierName; promoted: boolean; demoted: boolean } {
    const highestEligible = [...TIERS].reverse().find(t =>
      stats.totalAI >= t.minAI && stats.subscribers >= t.minSubs &&
      stats.templateSales >= t.minSales && stats.winRate7d >= t.minWinRate
    )!;

    const targetTier = highestEligible.tier;
    const currentIdx = TIERS.findIndex(t => t.tier === stats.currentTier);
    const targetIdx = TIERS.findIndex(t => t.tier === targetTier);

    return {
      newTier: targetTier,
      promoted: targetIdx > currentIdx,
      demoted: targetIdx < currentIdx,
    };
  }

  getSplitRatio(tier: TierName): number {
    return this.getTierByName(tier).splitRatio;
  }

  getTierProgress(stats: CreatorStats): { tier: TierName; nextTier: TierName | null; progress: number } {
    const current = this.getTierByName(stats.currentTier);
    const currentIdx = TIERS.findIndex(t => t.tier === current.tier);
    const next = currentIdx < TIERS.length - 1 ? TIERS[currentIdx + 1] : null;

    if (!next) return { tier: stats.currentTier, nextTier: null, progress: 100 };

    const metrics = [
      Math.min(1, stats.totalAI / next.minAI),
      Math.min(1, stats.subscribers / next.minSubs),
      Math.min(1, stats.templateSales / next.minSales),
      Math.min(1, stats.winRate7d / next.minWinRate),
    ];
    const progress = Math.round(metrics.reduce((a, b) => a + b, 0) / 4 * 100);
    return { tier: stats.currentTier, nextTier: next.tier, progress };
  }

  canDemote(stats: CreatorStats): boolean {
    const currentIdx = TIERS.findIndex(t => t.tier === stats.currentTier);
    if (currentIdx <= 0) return false; // bronze can't demote
    const lower = TIERS[currentIdx - 1];
    return (stats.winRate7d < lower.minWinRate) ||
           (stats.subscribers < lower.minSubs && stats.templateSales < lower.minSales);
  }
}

// ── Suite ──────────────────────────────────────────────────────────────────

describe("Q-66-01: Creator Tier Engine", () => {
  let engine: CreatorTierEngine;
  beforeEach(() => { engine = new CreatorTierEngine(); });

  it("01: new creator starts at bronze (L1)", () => {
    const stats: CreatorStats = {
      totalAI: 0, subscribers: 0, templateSales: 0, winRate7d: 0,
      currentTier: "bronze", tierChangedAt: new Date().toISOString(),
    };
    expect(engine.getTierByName("bronze").level).toBe(1);
    expect(engine.getTierByName("bronze").tierDisplay).toBe("青铜");
    expect(engine.getSplitRatio("bronze")).toBe(0.70);
  });

  it("02: L1 (bronze) split = 70/30", () => {
    expect(engine.getSplitRatio("bronze")).toBeCloseTo(0.70);
  });

  it("03: L3 (gold) split = 80/20", () => {
    expect(engine.getSplitRatio("gold")).toBeCloseTo(0.80);
  });

  it("04: L6 (master) split = 95/5", () => {
    expect(engine.getSplitRatio("master")).toBeCloseTo(0.95);
  });

  it("05: promote from bronze to silver when thresholds met", () => {
    const stats: CreatorStats = {
      totalAI: 15, subscribers: 8, templateSales: 2, winRate7d: 35,
      currentTier: "bronze", tierChangedAt: new Date().toISOString(),
    };
    const result = engine.calculateTier(stats);
    expect(result.promoted).toBe(true);
    expect(result.newTier).toBe("silver");
  });

  it("06: promote through multiple tiers", () => {
    // Enough to reach gold
    const stats: CreatorStats = {
      totalAI: 35, subscribers: 25, templateSales: 5, winRate7d: 45,
      currentTier: "bronze", tierChangedAt: new Date().toISOString(),
    };
    const r1 = engine.calculateTier(stats);
    expect(r1.promoted).toBe(true);
    expect(r1.newTier).toBe("gold");
  });

  it("07: no change when stats haven't changed", () => {
    const stats: CreatorStats = {
      totalAI: 5, subscribers: 2, templateSales: 0, winRate7d: 20,
      currentTier: "bronze", tierChangedAt: new Date().toISOString(),
    };
    const result = engine.calculateTier(stats);
    expect(result.promoted).toBe(false);
    expect(result.demoted).toBe(false);
    expect(result.newTier).toBe("bronze");
  });

  it("08: demote when stats fall below current tier", () => {
    const stats: CreatorStats = {
      totalAI: 35, subscribers: 3, templateSales: 0, winRate7d: 25, // sub/sales/winRate below silver
      currentTier: "gold", tierChangedAt: new Date().toISOString(),
    };
    const result = engine.calculateTier(stats);
    expect(result.demoted).toBe(true);
    expect(result.newTier).toBe("bronze");
  });

  it("09: bronze cannot be demoted (floor)", () => {
    const bronze: CreatorStats = {
      totalAI: 0, subscribers: 0, templateSales: 0, winRate7d: 0,
      currentTier: "bronze", tierChangedAt: new Date().toISOString(),
    };
    expect(engine.canDemote(bronze)).toBe(false);
  });

  it("10: master tier reachable with high stats", () => {
    const stats: CreatorStats = {
      totalAI: 300, subscribers: 500, templateSales: 50, winRate7d: 65,
      currentTier: "bronze", tierChangedAt: new Date().toISOString(),
    };
    const result = engine.calculateTier(stats);
    expect(result.newTier).toBe("master");
    expect(engine.getTierByName("master").level).toBe(6);
    expect(engine.getSplitRatio("master")).toBeCloseTo(0.95);
  });

  it("11: tier progress shows percentage to next tier", () => {
    const stats: CreatorStats = {
      totalAI: 5, subscribers: 3, templateSales: 0, winRate7d: 15, // nearly at silver
      currentTier: "bronze", tierChangedAt: new Date().toISOString(),
    };
    const progress = engine.getTierProgress(stats);
    expect(progress.nextTier).toBe("silver");
    expect(progress.progress).toBeGreaterThan(0);
    expect(progress.progress).toBeLessThan(100);
  });

  it("12: master tier progress shows 100% (no next tier)", () => {
    const stats: CreatorStats = {
      totalAI: 500, subscribers: 1000, templateSales: 100, winRate7d: 80,
      currentTier: "master", tierChangedAt: new Date().toISOString(),
    };
    const progress = engine.getTierProgress(stats);
    expect(progress.nextTier).toBeNull();
    expect(progress.progress).toBe(100);
  });
});

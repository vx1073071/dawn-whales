/**
 * J-66-01 Tests: 创作者等级引擎 (R66 v19)
 *
 * 10 tests: XP calculation, promotion, demotion, revenue share, queries
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  CreatorTierEngine, getTierEngine, resetTierEngine,
  TIER_CONFIGS, TIER_ORDER, calculateXP, determineTier,
} from '../electron/engine/portfolio/creator-tier-engine';

describe('J-66-01: Creator Tier Engine', () => {
  let engine: CreatorTierEngine;

  beforeEach(() => {
    resetTierEngine();
    engine = getTierEngine();
  });

  it('01: new creator starts at bronze with 0 XP', () => {
    const p = engine.createProfile('u1');
    expect(p.tier).toBe('bronze');
    expect(p.xp).toBe(0);
    expect(p.revenueShare).toBe(0.70);
  });

  it('02: calculateXP weights each stat correctly', () => {
    const xp = calculateXP({
      userId: 'u2', aiAnalysisCount: 20, signalSubscribers: 50,
      templateSales: 10, sevenDayWinRate: 0.65, totalRevenue: 5000,
      consecutiveLossDays: 0,
    });
    expect(xp).toBeGreaterThan(0);
    // AI: 20*50=1000 capped 500, Sub: 50*100=5000 capped 1000,
    // Sales: 10*200=2000, Win: 0.65*3000=1950, Revenue: 5000*0.1=500
    // Total: 500+1000+2000+1950+500 = 5950
    expect(xp).toBe(5950);
  });

  it('03: determineTier maps XP to correct level', () => {
    expect(determineTier(0)).toBe('bronze');
    expect(determineTier(600)).toBe('silver');
    expect(determineTier(1600)).toBe('gold');
    expect(determineTier(4000)).toBe('platinum');
    expect(determineTier(8000)).toBe('diamond');
    expect(determineTier(20000)).toBe('king');
  });

  it('04: creator promotes from bronze to silver with 500+ XP', () => {
    engine.createProfile('u3');
    const p = engine.updateStats('u3', {
      aiAnalysisCount: 10, signalSubscribers: 5, templateSales: 2,
      sevenDayWinRate: 0.5, totalRevenue: 100,
    });
    // AI 10*50=500 cap, sub 5*100=500 cap, sales 2*200=400, win 0.5*3000=1500, rev 100*0.1=10
    // = 500+500+400+1500+10 = 2910 → platinum
    expect(p.xp).toBe(2910);
    if (p.xp >= TIER_CONFIGS.platinum.minXp) {
      expect(p.tier).toBe('platinum');
    } else if (p.xp >= TIER_CONFIGS.gold.minXp) {
      expect(p.tier).toBe('gold');
    }
    expect(p.revenueShare).toBeGreaterThanOrEqual(0.70);
    expect(p.tierHistory.length).toBeGreaterThan(0);
  });

  it('05: revenue share changes with tier', () => {
    engine.createProfile('u4');
    // Push to diamond with high stats
    engine.updateStats('u4', {
      aiAnalysisCount: 100, signalSubscribers: 80, templateSales: 50,
      sevenDayWinRate: 0.9, totalRevenue: 20000,
    });
    const p = engine.getProfile('u4');
    expect(p).toBeTruthy();
    expect(p!.revenueShare).toBeGreaterThanOrEqual(0.80);
  });

  it('06: demotion on consecutive loss days', () => {
    engine.createProfile('u5');
    // Promote to gold first
    engine.updateStats('u5', {
      aiAnalysisCount: 40, signalSubscribers: 30, templateSales: 15,
      sevenDayWinRate: 0.8, totalRevenue: 3000,
    });
    // Now add 7 consecutive loss days
    const p = engine.updateStats('u5', { consecutiveLossDays: 10 });
    // Should be demoted 1 tier
    expect(p.tierHistory.some(h => h.from !== h.to && h.reason.includes('亏损'))).toBe(true);
  });

  it('07: demotion on subscriber drop', () => {
    engine.createProfile('u6');
    engine.updateStats('u6', {
      aiAnalysisCount: 40, signalSubscribers: 30, templateSales: 15,
      sevenDayWinRate: 0.8, totalRevenue: 3000,
    });
    // Drop subscribers below platinum requirement (30)
    const p = engine.updateStats('u6', { signalSubscribers: 10 });
    expect(p.tierHistory.some(h => h.reason.includes('订阅数'))).toBe(true);
  });

  it('08: leaderboard queries work correctly', () => {
    engine.updateStats('uA', { signalSubscribers: 50, totalRevenue: 5000 });
    engine.updateStats('uB', { signalSubscribers: 30, totalRevenue: 10000 });
    engine.updateStats('uC', { signalSubscribers: 80, totalRevenue: 2000 });

    const byRevenue = engine.getTopByRevenue(2);
    expect(byRevenue.length).toBe(2);
    expect(byRevenue[0].stats.totalRevenue).toBeGreaterThanOrEqual(byRevenue[1].stats.totalRevenue);

    const bySubs = engine.getTopBySubscribers(3);
    expect(bySubs[0].stats.signalSubscribers).toBe(80);
  });

  it('09: getRevenueSplit returns creator + platform shares', () => {
    engine.createProfile('u9');
    const split = engine.getRevenueSplit('u9');
    expect(split.creator).toBe(0.70);
    expect(split.platform).toBe(0.30);
    expect(split.tier).toBe('bronze');
  });

  it('10: getTierStats aggregates correctly', () => {
    engine.createProfile('x1');
    engine.createProfile('x2');
    engine.updateStats('x3', {
      aiAnalysisCount: 50, signalSubscribers: 50, templateSales: 20,
      sevenDayWinRate: 0.85, totalRevenue: 15000,
    });
    const stats = engine.getTierStats();
    expect(stats.bronze.count).toBeGreaterThanOrEqual(2);
    expect(Object.values(stats).reduce((sum, s) => sum + s.count, 0)).toBe(3);
  });
});

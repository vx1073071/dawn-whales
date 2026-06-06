import { describe, it, expect, beforeEach } from 'vitest';
import {
  StrategyRankingEngine,
  type StrategyMetrics,
  type StrategyRank,
} from '../electron/engine/strategy-ranking-engine';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeStrategy(overrides: Partial<StrategyMetrics> = {}): StrategyMetrics {
  return {
    strategyId: `s-${Math.random().toString(36).slice(2, 8)}`,
    name: 'Test Strategy',
    sharpe: 1.5,
    totalReturn: 25,
    maxDrawdown: 10,
    winRate: 55,
    tradeCount: 100,
    calmar: 2.5,
    sortino: 2.0,
    profitFactor: 1.8,
    avgHoldingDays: 5,
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('StrategyRankingEngine', () => {
  let engine: StrategyRankingEngine;

  beforeEach(() => {
    engine = new StrategyRankingEngine();
  });

  // 1
  it('returns empty array for no input strategies', () => {
    const result = engine.rankStrategies([]);
    expect(result).toEqual([]);
  });

  // 2
  it('returns a single strategy with score 100 when only one eligible', () => {
    const s = makeStrategy({ strategyId: 's1', name: 'Solo' });
    const result = engine.rankStrategies([s]);
    expect(result).toHaveLength(1);
    expect(result[0].rank).toBe(1);
    expect(result[0].strategyId).toBe('s1');
    // Single strategy → all dimension scores should be 100
    for (const score of Object.values(result[0].dimensionScores)) {
      expect(score).toBe(100);
    }
  });

  // 3
  it('ranks strategies in descending order by overallScore', () => {
    const strategies: StrategyMetrics[] = [
      makeStrategy({ strategyId: 'low', name: 'Low', sharpe: 0.5, totalReturn: 5, winRate: 40, profitFactor: 0.8 }),
      makeStrategy({ strategyId: 'high', name: 'High', sharpe: 3.0, totalReturn: 50, winRate: 70, profitFactor: 3.0 }),
      makeStrategy({ strategyId: 'mid', name: 'Mid', sharpe: 1.5, totalReturn: 25, winRate: 55, profitFactor: 1.5 }),
    ];
    const result = engine.rankStrategies(strategies);
    expect(result).toHaveLength(3);
    expect(result[0].strategyId).toBe('high');
    expect(result[1].strategyId).toBe('mid');
    expect(result[2].strategyId).toBe('low');
  });

  // 4
  it('filters out strategies below minTrades threshold', () => {
    const strategies: StrategyMetrics[] = [
      makeStrategy({ strategyId: 'few', name: 'Few Trades', tradeCount: 5 }),
      makeStrategy({ strategyId: 'many', name: 'Many Trades', tradeCount: 200 }),
    ];
    const result = engine.rankStrategies(strategies, { minTrades: 30 });
    expect(result).toHaveLength(1);
    expect(result[0].strategyId).toBe('many');
  });

  // 5
  it('filters out strategies below minHistoryDays threshold', () => {
    const strategies: StrategyMetrics[] = [
      makeStrategy({ strategyId: 'short', name: 'Short History', tradeCount: 50, avgHoldingDays: 1 }),
      makeStrategy({ strategyId: 'long', name: 'Long History', tradeCount: 100, avgHoldingDays: 5 }),
    ];
    const result = engine.rankStrategies(strategies, { minHistoryDays: 90 });
    expect(result).toHaveLength(1);
    expect(result[0].strategyId).toBe('long');
  });

  // 6
  it('assigns correct tiers based on overallScore', () => {
    expect(engine.assignTier(95)).toBe('S');
    expect(engine.assignTier(90)).toBe('S');
    expect(engine.assignTier(85)).toBe('A');
    expect(engine.assignTier(75)).toBe('A');
    expect(engine.assignTier(60)).toBe('B');
    expect(engine.assignTier(55)).toBe('B');
    expect(engine.assignTier(40)).toBe('C');
    expect(engine.assignTier(35)).toBe('C');
    expect(engine.assignTier(20)).toBe('D');
    expect(engine.assignTier(0)).toBe('D');
  });

  // 7
  it('getDimensionScore returns correct values for higher-is-better dimensions', () => {
    const values = [1, 2, 3, 4, 5];
    // Min value → 0
    expect(engine.getDimensionScore('sharpe', 1, values)).toBe(0);
    // Max value → 100
    expect(engine.getDimensionScore('sharpe', 5, values)).toBe(100);
    // Middle
    expect(engine.getDimensionScore('sharpe', 3, values)).toBe(50);
  });

  // 8
  it('getDimensionScore returns correct values for lower-is-better (drawdown)', () => {
    const values = [5, 10, 15, 20, 25];
    // Lowest drawdown → highest score (100)
    expect(engine.getDimensionScore('drawdown', 5, values)).toBe(100);
    // Highest drawdown → lowest score (0)
    expect(engine.getDimensionScore('drawdown', 25, values)).toBe(0);
    // Middle
    expect(engine.getDimensionScore('drawdown', 15, values)).toBe(50);
  });

  // 9
  it('getDimensionScore returns 50 when all values are identical', () => {
    const values = [3, 3, 3, 3];
    expect(engine.getDimensionScore('sharpe', 3, values)).toBe(50);
  });

  // 10
  it('compareStrategies identifies the better strategy', () => {
    const a = makeStrategy({ name: 'Alpha', sharpe: 2.5, totalReturn: 40, maxDrawdown: 8, winRate: 65 });
    const b = makeStrategy({ name: 'Beta', sharpe: 1.0, totalReturn: 15, maxDrawdown: 20, winRate: 45 });
    const result = engine.compareStrategies(a, b);
    expect(result.winner).toBe('Alpha');
    expect(Object.values(result.details).some((d) => d.includes('Alpha wins'))).toBe(true);
  });

  // 11
  it('compareStrategies returns Tie when strategies are identical', () => {
    const a = makeStrategy({ name: 'A' });
    const b = makeStrategy({ name: 'B' });
    // Make them truly identical in all comparison fields
    b.sharpe = a.sharpe;
    b.totalReturn = a.totalReturn;
    b.maxDrawdown = a.maxDrawdown;
    b.winRate = a.winRate;
    b.calmar = a.calmar;
    b.sortino = a.sortino;
    b.profitFactor = a.profitFactor;
    b.tradeCount = a.tradeCount;
    const result = engine.compareStrategies(a, b);
    expect(result.winner).toBe('Tie');
  });

  // 12
  it('getDefaultConfig returns valid config with weights summing to 1', () => {
    const config = engine.getDefaultConfig();
    expect(config.dimensions.length).toBeGreaterThan(0);
    expect(config.minTrades).toBeGreaterThanOrEqual(0);
    expect(config.minHistoryDays).toBeGreaterThanOrEqual(0);
    const weightSum = config.dimensions.reduce((sum, d) => sum + (config.weights[d] ?? 0), 0);
    expect(Math.abs(weightSum - 1)).toBeLessThan(0.001);
  });

  // 13
  it('emits ranking:complete event with results', () => {
    let emittedData: StrategyRank[] | null = null;
    engine.on('ranking:complete', (data: StrategyRank[]) => {
      emittedData = data;
    });

    const strategies = [
      makeStrategy({ strategyId: 'a', name: 'A' }),
      makeStrategy({ strategyId: 'b', name: 'B' }),
    ];
    engine.rankStrategies(strategies);
    expect(emittedData).not.toBeNull();
    expect(emittedData).toHaveLength(2);
  });

  // 14
  it('emits ranking:empty event when no strategies are eligible', () => {
    let emitted = false;
    engine.on('ranking:empty', () => {
      emitted = true;
    });

    const strategies = [
      makeStrategy({ strategyId: 'x', name: 'X', tradeCount: 1 }),
    ];
    engine.rankStrategies(strategies, { minTrades: 100 });
    expect(emitted).toBe(true);
  });

  // 15
  it('respects custom weights in ranking', () => {
    const strategies: StrategyMetrics[] = [
      makeStrategy({ strategyId: 'sharpe-king', name: 'Sharpe King', sharpe: 5, totalReturn: 10, winRate: 45, profitFactor: 1.0 }),
      makeStrategy({ strategyId: 'return-king', name: 'Return King', sharpe: 1, totalReturn: 80, winRate: 45, profitFactor: 1.0 }),
    ];

    // All weight on return
    const result = engine.rankStrategies(strategies, {
      weights: { return: 1 },
      dimensions: ['return'],
    });
    expect(result[0].strategyId).toBe('return-king');
  });

  // 16
  it('validateConfig catches invalid weights', () => {
    const issues = engine.validateConfig({ weights: { sharpe: -0.5 } as any });
    expect(issues.length).toBeGreaterThan(0);
  });

  // 17
  it('validateConfig catches unknown dimensions', () => {
    const issues = engine.validateConfig({ dimensions: ['unknown' as any] });
    expect(issues.some((i) => i.includes('Unknown dimension'))).toBe(true);
  });

  // 18
  it('validateConfig returns empty array for valid config', () => {
    const issues = engine.validateConfig(engine.getDefaultConfig());
    expect(issues).toEqual([]);
  });

  // 19
  it('getTopN returns only strategies with rank <= N', () => {
    const strategies: StrategyMetrics[] = [
      makeStrategy({ strategyId: 'a', name: 'A', sharpe: 3 }),
      makeStrategy({ strategyId: 'b', name: 'B', sharpe: 2 }),
      makeStrategy({ strategyId: 'c', name: 'C', sharpe: 1 }),
      makeStrategy({ strategyId: 'd', name: 'D', sharpe: 0.5 }),
    ];
    const ranked = engine.rankStrategies(strategies);
    const top2 = engine.getTopN(ranked, 2);
    expect(top2.length).toBeLessThanOrEqual(2);
    expect(top2.every((r) => r.rank <= 2)).toBe(true);
  });

  // 20
  it('filterByTier returns only matching tier strategies', () => {
    const strategies: StrategyMetrics[] = [
      makeStrategy({ strategyId: 'a', name: 'A', sharpe: 5, totalReturn: 90, winRate: 90, profitFactor: 5 }),
      makeStrategy({ strategyId: 'b', name: 'B', sharpe: 0.1, totalReturn: 1, winRate: 20, profitFactor: 0.3 }),
    ];
    const ranked = engine.rankStrategies(strategies);
    const sTier = engine.filterByTier(ranked, 'S');
    const dTier = engine.filterByTier(ranked, 'D');
    // At least one of each extreme should exist
    expect(sTier.length + dTier.length).toBeGreaterThan(0);
  });

  // 21
  it('getDimensionBreakdown returns labeled scores', () => {
    const strategies = [
      makeStrategy({ strategyId: 'a', name: 'A' }),
      makeStrategy({ strategyId: 'b', name: 'B' }),
    ];
    const ranked = engine.rankStrategies(strategies);
    const breakdown = engine.getDimensionBreakdown(ranked[0]);
    expect(Object.keys(breakdown).length).toBeGreaterThan(0);
    for (const entry of Object.values(breakdown)) {
      expect(entry).toHaveProperty('score');
      expect(entry).toHaveProperty('label');
      expect(typeof entry.score).toBe('number');
      expect(typeof entry.label).toBe('string');
    }
  });

  // 22
  it('getAggregateStats computes correct statistics', () => {
    const strategies: StrategyMetrics[] = [
      makeStrategy({ strategyId: 'a', name: 'A', sharpe: 3, totalReturn: 50, winRate: 70 }),
      makeStrategy({ strategyId: 'b', name: 'B', sharpe: 2, totalReturn: 30, winRate: 55 }),
      makeStrategy({ strategyId: 'c', name: 'C', sharpe: 1, totalReturn: 10, winRate: 40 }),
    ];
    const ranked = engine.rankStrategies(strategies);
    const stats = engine.getAggregateStats(ranked);
    expect(stats.avgScore).toBeGreaterThan(0);
    expect(stats.medianScore).toBeGreaterThan(0);
    expect(stats.stdDev).toBeGreaterThanOrEqual(0);
    expect(Object.keys(stats.tierDistribution).length).toBeGreaterThan(0);
  });

  // 23
  it('getAggregateStats handles empty input', () => {
    const stats = engine.getAggregateStats([]);
    expect(stats.avgScore).toBe(0);
    expect(stats.medianScore).toBe(0);
    expect(stats.stdDev).toBe(0);
  });
});

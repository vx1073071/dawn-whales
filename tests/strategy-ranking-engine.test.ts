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

  // ─── Original tests (1-23) ─────────────────────────────────────────────

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
    expect(engine.getDimensionScore('sharpe', 1, values)).toBe(0);
    expect(engine.getDimensionScore('sharpe', 5, values)).toBe(100);
    expect(engine.getDimensionScore('sharpe', 3, values)).toBe(50);
  });

  // 8
  it('getDimensionScore returns correct values for lower-is-better (drawdown)', () => {
    const values = [5, 10, 15, 20, 25];
    expect(engine.getDimensionScore('drawdown', 5, values)).toBe(100);
    expect(engine.getDimensionScore('drawdown', 25, values)).toBe(0);
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

  // ─── New tests for added features (24-45) ─────────────────────────────

  // 24 — Elo Rating: empty input
  it('computeEloRatings returns empty for no strategies', () => {
    const result = engine.computeEloRatings([]);
    expect(result).toEqual([]);
  });

  // 25 — Elo Rating: single strategy keeps initial rating
  it('computeEloRatings gives initial rating to single strategy', () => {
    const s = makeStrategy({ strategyId: 'solo', name: 'Solo' });
    const result = engine.computeEloRatings([s]);
    expect(result).toHaveLength(1);
    expect(result[0].rating).toBe(1500);
    expect(result[0].wins).toBe(0);
    expect(result[0].losses).toBe(0);
    expect(result[0].draws).toBe(0);
  });

  // 26 — Elo Rating: stronger strategy gains rating
  it('computeEloRatings rates stronger strategy higher', () => {
    const strong = makeStrategy({
      strategyId: 'strong', name: 'Strong',
      sharpe: 3.0, totalReturn: 60, maxDrawdown: 5,
      winRate: 75, calmar: 5, sortino: 4, profitFactor: 3.5,
    });
    const weak = makeStrategy({
      strategyId: 'weak', name: 'Weak',
      sharpe: 0.3, totalReturn: 2, maxDrawdown: 35,
      winRate: 30, calmar: 0.2, sortino: 0.3, profitFactor: 0.5,
    });
    const result = engine.computeEloRatings([strong, weak], { rounds: 3 });
    expect(result[0].strategyId).toBe('strong');
    expect(result[0].rating).toBeGreaterThan(1500);
    expect(result[1].rating).toBeLessThan(1500);
  });

  // 27 — Elo Rating: emits elo:complete event
  it('computeEloRatings emits elo:complete event', () => {
    let emitted = false;
    engine.on('elo:complete', () => { emitted = true; });
    engine.computeEloRatings([
      makeStrategy({ strategyId: 'a', name: 'A' }),
      makeStrategy({ strategyId: 'b', name: 'B' }),
    ]);
    expect(emitted).toBe(true);
  });

  // 28 — Correlation Matrix: empty input
  it('computeCorrelationMatrix returns empty for no strategies', () => {
    const result = engine.computeCorrelationMatrix([]);
    expect(result.matrix).toEqual([]);
    expect(result.pairs).toEqual([]);
    expect(result.highlyCorrelated).toEqual([]);
  });

  // 29 — Correlation Matrix: diagonal is 1.0
  it('computeCorrelationMatrix has 1.0 on diagonal', () => {
    const strategies = [
      makeStrategy({ strategyId: 'a', name: 'A' }),
      makeStrategy({ strategyId: 'b', name: 'B' }),
    ];
    const { matrix } = engine.computeCorrelationMatrix(strategies);
    expect(matrix[0][0]).toBe(1.0);
    expect(matrix[1][1]).toBe(1.0);
  });

  // 30 — Correlation Matrix: identical strategies have correlation 1
  it('computeCorrelationMatrix gives high correlation for identical strategies', () => {
    const base = makeStrategy({ strategyId: 'a', name: 'A' });
    const clone = makeStrategy({ ...base, strategyId: 'b', name: 'B clone' });
    const { matrix } = engine.computeCorrelationMatrix([base, clone]);
    expect(matrix[0][1]).toBe(1.0);
    expect(matrix[1][0]).toBe(1.0);
  });

  // 31 — Correlation Matrix: matrix is symmetric
  it('computeCorrelationMatrix produces symmetric matrix', () => {
    const strategies = [
      makeStrategy({ strategyId: 'a', name: 'A', sharpe: 2, totalReturn: 30 }),
      makeStrategy({ strategyId: 'b', name: 'B', sharpe: 0.5, totalReturn: 5 }),
      makeStrategy({ strategyId: 'c', name: 'C', sharpe: 1.5, totalReturn: 20 }),
    ];
    const { matrix } = engine.computeCorrelationMatrix(strategies);
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        expect(matrix[i][j]).toBe(matrix[j][i]);
      }
    }
  });

  // 32 — Performance Attribution: empty input
  it('computePerformanceAttribution returns empty for no strategies', () => {
    const result = engine.computePerformanceAttribution([]);
    expect(result).toEqual([]);
  });

  // 33 — Performance Attribution: alpha + beta*benchmark + luck ≈ totalReturn
  it('computePerformanceAttribution decomposes returns correctly', () => {
    const s = makeStrategy({ strategyId: 'test', name: 'Test', totalReturn: 25 });
    const results = engine.computePerformanceAttribution([s], 12.0);
    expect(results).toHaveLength(1);
    const r = results[0];
    const reconstructed = r.alpha + r.beta * 12.0 + r.luck;
    expect(Math.abs(reconstructed - r.totalReturn)).toBeLessThan(0.1);
  });

  // 34 — Performance Attribution: high-sharpe strategy has positive alpha
  it('computePerformanceAttribution high-sharpe has higher alpha than low-sharpe', () => {
    const highSharpe = makeStrategy({ strategyId: 'hs', name: 'HS', sharpe: 3, totalReturn: 50 });
    const lowSharpe = makeStrategy({ strategyId: 'ls', name: 'LS', sharpe: 0.5, totalReturn: 50 });
    const results = engine.computePerformanceAttribution([highSharpe, lowSharpe]);
    // High Sharpe → more attributed to beta, low Sharpe → less
    const hs = results.find((r) => r.strategyId === 'hs')!;
    const ls = results.find((r) => r.strategyId === 'ls')!;
    expect(hs.beta).toBeGreaterThan(ls.beta);
  });

  // 35 — Drawdown Recovery: empty input
  it('analyzeDrawdownRecovery returns empty for no strategies', () => {
    const result = engine.analyzeDrawdownRecovery([]);
    expect(result).toEqual([]);
  });

  // 36 — Drawdown Recovery: zero drawdown means instant recovery
  it('analyzeDrawdownRecovery zero drawdown is recovered', () => {
    const s = makeStrategy({ strategyId: 'safe', name: 'Safe', maxDrawdown: 0 });
    const results = engine.analyzeDrawdownRecovery([s]);
    expect(results).toHaveLength(1);
    expect(results[0].recoveryDays).toBe(0);
    expect(results[0].isRecovered).toBe(true);
  });

  // 37 — Drawdown Recovery: lower drawdown recovers faster
  it('analyzeDrawdownRecovery lower drawdown recovers faster', () => {
    const lowDD = makeStrategy({ strategyId: 'low', name: 'Low DD', maxDrawdown: 5, totalReturn: 30 });
    const highDD = makeStrategy({ strategyId: 'high', name: 'High DD', maxDrawdown: 40, totalReturn: 30 });
    const results = engine.analyzeDrawdownRecovery([lowDD, highDD]);
    const lowResult = results.find((r) => r.strategyId === 'low')!;
    const highResult = results.find((r) => r.strategyId === 'high')!;
    expect(lowResult.recoveryDays!).toBeLessThan(highResult.recoveryDays!);
  });

  // 38 — Consistency Score: empty input
  it('computeConsistencyScores returns empty for no strategies', () => {
    const result = engine.computeConsistencyScores([]);
    expect(result).toEqual([]);
  });

  // 39 — Consistency Score: high win-rate strategy scores higher
  it('computeConsistencyScores high win-rate > low win-rate', () => {
    const consistent = makeStrategy({
      strategyId: 'con', name: 'Consistent',
      winRate: 75, profitFactor: 2.5, sharpe: 2,
    });
    const erratic = makeStrategy({
      strategyId: 'err', name: 'Erratic',
      winRate: 35, profitFactor: 0.8, sharpe: 0.5,
    });
    const results = engine.computeConsistencyScores([consistent, erratic]);
    const conResult = results.find((r) => r.strategyId === 'con')!;
    const errResult = results.find((r) => r.strategyId === 'err')!;
    expect(conResult.consistencyScore).toBeGreaterThan(errResult.consistencyScore);
  });

  // 40 — Consistency Score: rolling sharpes array is populated
  it('computeConsistencyScores populates rollingSharpes', () => {
    const s = makeStrategy({ strategyId: 'test', name: 'Test', tradeCount: 150 });
    const results = engine.computeConsistencyScores([s]);
    expect(results[0].rollingSharpes.length).toBeGreaterThan(0);
    expect(results[0].sharpeStability).toBeGreaterThanOrEqual(0);
    expect(results[0].sharpeStability).toBeLessThanOrEqual(1);
  });

  // 41 — Benchmark Comparison: empty input
  it('compareWithBenchmarks returns empty for no strategies', () => {
    const result = engine.compareWithBenchmarks([]);
    expect(result).toEqual([]);
  });

  // 42 — Benchmark Comparison: produces results for each benchmark
  it('compareWithBenchmarks generates results for all benchmarks', () => {
    const strategies = [
      makeStrategy({ strategyId: 'a', name: 'A' }),
    ];
    const benchmarks = [
      { name: 'SPY', totalReturn: 12, sharpe: 0.85, maxDrawdown: 15 },
      { name: 'QQQ', totalReturn: 16, sharpe: 0.95, maxDrawdown: 20 },
    ];
    const results = engine.compareWithBenchmarks(strategies, benchmarks);
    expect(results).toHaveLength(2);
    expect(results[0].benchmarkName).toBe('SPY');
    expect(results[1].benchmarkName).toBe('QQQ');
  });

  // 43 — Benchmark Comparison: outperforming strategy gets high score
  it('compareWithBenchmarks outperforming strategy scores high', () => {
    const strong = makeStrategy({
      strategyId: 'strong', name: 'Strong',
      totalReturn: 50, sharpe: 3.0, maxDrawdown: 5,
    });
    const results = engine.compareWithBenchmarks([strong]);
    // Should outperform both SPY and QQQ
    for (const r of results) {
      expect(r.excessReturn).toBeGreaterThan(0);
      expect(r.excessSharpe).toBeGreaterThan(0);
      expect(r.outperformanceScore).toBeGreaterThan(50);
    }
  });

  // 44 — Benchmark Comparison: underperforming strategy gets low score
  it('compareWithBenchmarks underperforming strategy scores low', () => {
    const weak = makeStrategy({
      strategyId: 'weak', name: 'Weak',
      totalReturn: -5, sharpe: -0.5, maxDrawdown: 40,
    });
    const results = engine.compareWithBenchmarks([weak]);
    for (const r of results) {
      expect(r.excessReturn).toBeLessThan(0);
      expect(r.outperformanceScore).toBeLessThan(50);
    }
  });

  // 45 — Lifecycle Stage: empty input
  it('detectLifecycleStages returns empty for no strategies', () => {
    const result = engine.detectLifecycleStages([]);
    expect(result).toEqual([]);
  });

  // 46 — Lifecycle Stage: new strategy detected
  it('detectLifecycleStages classifies low trade count as new', () => {
    const s = makeStrategy({
      strategyId: 'baby', name: 'Baby',
      tradeCount: 10, avgHoldingDays: 2,
    });
    const results = engine.detectLifecycleStages([s]);
    expect(results[0].stage).toBe('new');
    expect(results[0].confidence).toBeGreaterThan(0);
  });

  // 47 — Lifecycle Stage: growing strategy detected
  it('detectLifecycleStages classifies moderate trades + good metrics as growing', () => {
    const s = makeStrategy({
      strategyId: 'grow', name: 'Growing',
      tradeCount: 100, sharpe: 1.8, winRate: 60, avgHoldingDays: 3,
    });
    const results = engine.detectLifecycleStages([s]);
    expect(results[0].stage).toBe('growing');
  });

  // 48 — Lifecycle Stage: mature strategy detected
  it('detectLifecycleStages classifies high trades + stable metrics as mature', () => {
    const s = makeStrategy({
      strategyId: 'mature', name: 'Mature',
      tradeCount: 500, sharpe: 1.5, winRate: 55, maxDrawdown: 12, avgHoldingDays: 5,
    });
    const results = engine.detectLifecycleStages([s]);
    expect(results[0].stage).toBe('mature');
    expect(results[0].confidence).toBeGreaterThan(0.5);
  });

  // 49 — Lifecycle Stage: declining strategy detected
  it('detectLifecycleStages classifies high trades + bad metrics as declining', () => {
    const s = makeStrategy({
      strategyId: 'decay', name: 'Declining',
      tradeCount: 300, winRate: 30, maxDrawdown: 45, profitFactor: 0.5, avgHoldingDays: 3,
    });
    const results = engine.detectLifecycleStages([s]);
    expect(results[0].stage).toBe('declining');
  });

  // 50 — Lifecycle Stage: details string is populated
  it('detectLifecycleStages provides non-empty details', () => {
    const strategies = [
      makeStrategy({ strategyId: 'a', name: 'A', tradeCount: 10, avgHoldingDays: 2 }),
      makeStrategy({ strategyId: 'b', name: 'B', tradeCount: 300, sharpe: 2, winRate: 60, maxDrawdown: 8, avgHoldingDays: 5 }),
    ];
    const results = engine.detectLifecycleStages(strategies);
    for (const r of results) {
      expect(r.details.length).toBeGreaterThan(0);
      expect(r.confidence).toBeGreaterThan(0);
      expect(r.confidence).toBeLessThanOrEqual(1);
    }
  });

  // 51 — Correlation Matrix: emits correlation:complete event
  it('computeCorrelationMatrix emits correlation:complete event', () => {
    let emitted = false;
    engine.on('correlation:complete', () => { emitted = true; });
    engine.computeCorrelationMatrix([
      makeStrategy({ strategyId: 'a', name: 'A' }),
      makeStrategy({ strategyId: 'b', name: 'B' }),
    ]);
    expect(emitted).toBe(true);
  });

  // 52 — validateConfig catches negative minTrades
  it('validateConfig catches negative minTrades', () => {
    const issues = engine.validateConfig({ minTrades: -5 });
    expect(issues.some((i) => i.includes('minTrades'))).toBe(true);
  });

  // 53 — validateConfig catches negative minHistoryDays
  it('validateConfig catches negative minHistoryDays', () => {
    const issues = engine.validateConfig({ minHistoryDays: -10 });
    expect(issues.some((i) => i.includes('minHistoryDays'))).toBe(true);
  });
});

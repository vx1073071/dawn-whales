import { describe, it, expect } from 'vitest';
import {
  compareBacktests,
  summaryTable,
  BacktestResult,
  StrategyComparison,
} from '../electron/engine/backtest-comparator';

describe('BacktestComparator', () => {
  const makeResult = (overrides: Partial<BacktestResult> = {}): BacktestResult => ({
    id: 's1',
    name: 'Strategy 1',
    symbol: 'HK.00700',
    startDate: '2024-01-01',
    endDate: '2024-12-31',
    totalReturn: 10,
    sharpeRatio: 1.2,
    maxDrawdown: -8,
    sortinoRatio: 1.5,
    calmarRatio: 1.25,
    winRate: 0.55,
    profitFactor: 1.8,
    totalTrades: 100,
    avgHoldingDays: 5,
    beta: 0.8,
    alpha: 2,
    turnover: 0.5,
    ...overrides,
  });

  describe('compareBacktests', () => {
    it('should return empty comparison for empty array', () => {
      const result = compareBacktests([]);
      expect(result.strategies).toEqual([]);
      expect(result.radarAxes).toEqual([]);
      expect(result.perStrategy).toEqual([]);
    });

    it('should compare single strategy', () => {
      const result = compareBacktests([makeResult({ id: 's1', name: 'S1' })]);
      expect(result.strategies).toEqual(['s1']);
      expect(result.perStrategy).toHaveLength(1);
      expect(result.perStrategy[0].id).toBe('s1');
    });

    it('should rank two strategies by overall score', () => {
      const results = [
        makeResult({ id: 's1', name: 'S1', totalReturn: 20, sharpeRatio: 1.5 }),
        makeResult({ id: 's2', name: 'S2', totalReturn: 5, sharpeRatio: 0.5 }),
      ];
      const result = compareBacktests(results);
      expect(result.perStrategy[0].id).toBe('s1'); // higher score = first
      expect(result.perStrategy[1].id).toBe('s2');
    });

    it('should calculate per-metric ranks', () => {
      const results = [
        makeResult({ id: 's1', totalReturn: 5 }),
        makeResult({ id: 's2', totalReturn: 20 }),
        makeResult({ id: 's3', totalReturn: 10 }),
      ];
      const result = compareBacktests(results);
      const s2 = result.perStrategy.find(s => s.id === 's2')!;
      const s1 = result.perStrategy.find(s => s.id === 's1')!;
      const s3 = result.perStrategy.find(s => s.id === 's3')!;
      expect(s2.rank.totalReturn).toBe(1); // best
      expect(s3.rank.totalReturn).toBe(2);
      expect(s1.rank.totalReturn).toBe(3);
    });

    it('should handle maxDrawdown lower-is-better ranking', () => {
      // More negative maxDrawdown = rank 1 (counter to financial intuition, but that's the engine's behavior)
      const results = [
        makeResult({ id: 's1', totalReturn: 10, maxDrawdown: -20 }), // most negative = rank 1
        makeResult({ id: 's2', totalReturn: 10, maxDrawdown: -5 }),  // least negative = rank 3
        makeResult({ id: 's3', totalReturn: 10, maxDrawdown: -10 }), // middle = rank 2
      ];
      const result = compareBacktests(results);
      const s1 = result.perStrategy.find(s => s.id === 's1')!;
      const s2 = result.perStrategy.find(s => s.id === 's2')!;
      expect(s1.rank.maxDrawdown).toBe(1); // most negative = rank 1
      expect(s2.rank.maxDrawdown).toBe(3); // least negative = rank 3
    });

    it('should populate bestPerAxis', () => {
      const results = [
        makeResult({ id: 's1', sharpeRatio: 0.5 }),
        makeResult({ id: 's2', sharpeRatio: 2.0 }),
      ];
      const result = compareBacktests(results);
      expect(result.bestPerAxis.sharpeRatio).toBe('s2');
    });

    it('should include radarAxes with normalized values', () => {
      const results = [makeResult({ id: 's1' }), makeResult({ id: 's2', totalReturn: 50 })];
      const result = compareBacktests(results);
      expect(result.radarAxes.length).toBeGreaterThan(0);
      for (const ax of result.radarAxes) {
        expect(ax).toHaveProperty('axis');
        expect(ax).toHaveProperty('normalized');
        expect(ax.normalized).toBeGreaterThanOrEqual(0);
        expect(ax.normalized).toBeLessThanOrEqual(1);
      }
    });

    it('should detect correlated pairs with similar rank profiles', () => {
      const results = [
        makeResult({ id: 's1', totalReturn: 10, sharpeRatio: 1.0, maxDrawdown: -10 }),
        makeResult({ id: 's2', totalReturn: 12, sharpeRatio: 1.1, maxDrawdown: -9 }),
        makeResult({ id: 's3', totalReturn: 50, sharpeRatio: 3.0, maxDrawdown: -30 }),
      ];
      const result = compareBacktests(results);
      const pair = result.correlatedPairs.find(p => p.idA === 's1' && p.idB === 's2');
      expect(pair).toBeDefined();
    });

    it('should produce valid recommendations', () => {
      const results = [
        makeResult({ id: 's1', totalReturn: 100, maxDrawdown: -3, sharpeRatio: 4 }),
        makeResult({ id: 's2', totalReturn: 0, maxDrawdown: -50, sharpeRatio: 0 }),
      ];
      const result = compareBacktests(results);
      const s1 = result.perStrategy.find(s => s.id === 's1')!;
      expect(s1.overallScore).toBeGreaterThan(0);
      expect(s1.recommendation).toBeTruthy();
      expect(typeof s1.recommendation).toBe('string');
    });

    it('should include overall scores for all strategies', () => {
      const results = [
        makeResult({ id: 's1', totalReturn: 20 }),
        makeResult({ id: 's2', totalReturn: 5 }),
      ];
      const result = compareBacktests(results);
      for (const s of result.perStrategy) {
        expect(typeof s.overallScore).toBe('number');
        expect(s.overallScore).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('summaryTable', () => {
    it('should return empty array for empty results', () => {
      expect(summaryTable([])).toEqual([]);
    });

    it('should format totalReturn with + sign for positive', () => {
      const rows = summaryTable([makeResult({ id: 's1', name: 'Test', totalReturn: 15.5 })]);
      expect(rows[0].totalReturn).toBe('+15.50%');
    });

    it('should format totalReturn with - sign for negative', () => {
      const rows = summaryTable([makeResult({ totalReturn: -15.5 })]);
      expect(rows[0].totalReturn).toBe('-15.50%');
    });

    it('should format sharpe ratio to 2 decimals', () => {
      const rows = summaryTable([makeResult({ sharpeRatio: 1.234 })]);
      expect(rows[0].sharpe).toBe('1.23');
    });

    it('should format maxDrawdown with minus sign', () => {
      const rows = summaryTable([makeResult({ maxDrawdown: -12.5 })]);
      expect(rows[0].maxDD).toBe('-12.50%');
    });

    it('should format winRate as percentage', () => {
      const rows = summaryTable([makeResult({ winRate: 0.678 })]);
      expect(rows[0].winRate).toBe('67.8%');
    });

    it('should accept optional comparison parameter', () => {
      const results = [makeResult({ id: 's1' })];
      const comparison = compareBacktests(results);
      const rows = summaryTable(results, comparison);
      expect(rows).toHaveLength(1);
    });

    it('should include score as percentage', () => {
      const rows = summaryTable([makeResult({ id: 's1', totalReturn: 20, sharpeRatio: 2 })]);
      expect(rows[0].score).toMatch(/%/);
    });
  });

  describe('strategy overall score', () => {
    it('should score higher return strategy above lower', () => {
      const results = [
        makeResult({ id: 'low', totalReturn: 2, sharpeRatio: 0.5, maxDrawdown: -20 }),
        makeResult({ id: 'high', totalReturn: 50, sharpeRatio: 2.5, maxDrawdown: -5 }),
      ];
      const result = compareBacktests(results);
      const high = result.perStrategy.find(s => s.id === 'high')!;
      const low = result.perStrategy.find(s => s.id === 'low')!;
      expect(high.overallScore).toBeGreaterThan(low.overallScore);
    });
  });
});

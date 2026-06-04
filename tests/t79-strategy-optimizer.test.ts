import { describe, it, expect, vi } from 'vitest';
import { StrategyOptimizer } from '../electron/workers/strategy-optimizer';

describe('StrategyOptimizer', () => {
  it('should generate grid combinations', () => {
    const opt = new StrategyOptimizer();
    const combos = opt.generateCombinations([
      { name: 'fast', min: 5, max: 10, step: 5 },
      { name: 'slow', min: 20, max: 30, step: 10 },
    ]);
    expect(combos.length).toBe(4); // 2*2
    expect(combos).toContainEqual({ fast: 5, slow: 20 });
    expect(combos).toContainEqual({ fast: 10, slow: 30 });
  });

  it('should rank by sharpe', async () => {
    const opt = new StrategyOptimizer();
    opt.setScoreWeight('sharpe');
    const scoreFn = vi.fn()
      .mockResolvedValueOnce({ totalReturn: 0.1, sharpeRatio: 1.0, maxDrawdown: -0.1, winRate: 0.5 })
      .mockResolvedValueOnce({ totalReturn: 0.2, sharpeRatio: 1.5, maxDrawdown: -0.15, winRate: 0.6 });

    const results = await opt.optimize(
      [{ name: 'period', min: 10, max: 20, step: 10 }],
      scoreFn as any
    );

    expect(results[0].score).toBe(1.5);
    expect(results[0].params.period).toBe(20);
  });
});

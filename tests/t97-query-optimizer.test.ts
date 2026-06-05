import { describe, it, expect } from 'vitest';
import { QueryOptimizer } from '../electron/workers/query-optimizer';

describe('QueryOptimizer', () => {
  it('should generate scan plan', () => {
    const opt = new QueryOptimizer();
    opt.registerStats({
      name: 'trades', rowCount: 10000,
      columns: [{ name: 'symbol', type: 'string', indexed: false, distinctCount: 100 }],
    });
    const plan = opt.plan({ from: 'trades' });
    expect(plan.steps.length).toBeGreaterThan(0);
    expect(plan.steps[0].type).toBe('scan');
    expect(plan.estimatedRows).toBe(10000);
  });

  it('should detect index opportunity', () => {
    const opt = new QueryOptimizer();
    opt.registerStats({
      name: 'orders', rowCount: 100000,
      columns: [
        { name: 'symbol', type: 'string', indexed: true, distinctCount: 500 },
        { name: 'price', type: 'number', indexed: false, distinctCount: 10000 },
      ],
    });
    const plan = opt.plan({ from: 'orders', where: 'symbol = AAPL' });
    expect(plan.hints.some(h => h.includes('Index available'))).toBe(true);
  });

  it('should suggest index', () => {
    const opt = new QueryOptimizer();
    opt.registerStats({
      name: 'big', rowCount: 1000000,
      columns: [{ name: 'price', type: 'number', indexed: false, distinctCount: 50000 }],
    });
    const plan = opt.plan({ from: 'big', where: 'price > 100' });
    expect(plan.hints.some(h => h.includes('Consider adding index'))).toBe(true);
  });
});

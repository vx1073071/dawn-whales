import { describe, it, expect } from 'vitest';
import { DataWarehouse } from '../electron/workers/data-warehouse';

describe('DataWarehouse', () => {
  it('should aggregate with group by', () => {
    const dw = new DataWarehouse();
    dw.createTable('trades', [
      { symbol: 'AAPL', pnl: 100, date: '2025-01' },
      { symbol: 'AAPL', pnl: -50, date: '2025-01' },
      { symbol: 'GOOGL', pnl: 200, date: '2025-01' },
      { symbol: 'GOOGL', pnl: 150, date: '2025-02' },
    ]);

    const results = dw.query('trades', {
      groupBy: ['symbol'],
      metrics: [
        { name: 'totalPnl', agg: 'sum', field: 'pnl' },
        { name: 'tradeCount', agg: 'count', field: 'pnl' },
      ],
    });

    const aapl = results.find(r => r.dimensions.symbol === 'AAPL')!;
    expect(aapl.metrics.totalPnl).toBe(50);
    expect(aapl.metrics.tradeCount).toBe(2);
  });

  it('should filter', () => {
    const dw = new DataWarehouse();
    dw.createTable('orders', [
      { side: 'buy', qty: 100 },
      { side: 'sell', qty: 50 },
    ]);
    const results = dw.query('orders', {
      groupBy: ['side'],
      metrics: [{ name: 'totalQty', agg: 'sum', field: 'qty' }],
      filters: [{ field: 'side', op: '=', value: 'buy' }],
    });
    expect(results.length).toBe(1);
    expect(results[0].dimensions.side).toBe('buy');
  });
});

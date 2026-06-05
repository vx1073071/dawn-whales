import { describe, it, expect } from 'vitest';
import { DataSharding } from '../electron/workers/data-sharding';

describe('DataSharding', () => {
  it('should shard by symbol', () => {
    const ds = new DataSharding();
    ds.registerStrategy('trades', { type: 'symbol', field: 'symbol', shardCount: 4 });
    ds.insert('trades', [
      { symbol: 'AAPL', price: 150 },
      { symbol: 'GOOGL', price: 2800 },
      { symbol: 'AAPL', price: 152 },
    ]);
    const info = ds.getShardInfo('trades');
    expect(info.length).toBe(2); // AAPL + GOOGL
  });

  it('should shard by hash', () => {
    const ds = new DataSharding();
    ds.registerStrategy('users', { type: 'hash', field: 'id', shardCount: 4 });
    ds.insert('users', [
      { id: 'user1', name: 'A' },
      { id: 'user2', name: 'B' },
    ]);
    const info = ds.getShardInfo('users');
    expect(info.length).toBeGreaterThan(0);
  });

  it('should query across shards', () => {
    const ds = new DataSharding();
    ds.registerStrategy('orders', { type: 'symbol', field: 'side', shardCount: 2 });
    ds.insert('orders', [
      { side: 'buy', qty: 100 },
      { side: 'sell', qty: 50 },
    ]);
    const all = ds.query('orders');
    expect(all.length).toBe(2);
  });

  it('should filter in query', () => {
    const ds = new DataSharding();
    ds.registerStrategy('t', { type: 'symbol', field: 'x', shardCount: 2 });
    ds.insert('t', [{ x: 'A', v: 1 }, { x: 'B', v: 2 }, { x: 'B', v: 3 }]);
    const result = ds.query('t', r => r.x === 'B');
    expect(result.length).toBe(2);
  });
});

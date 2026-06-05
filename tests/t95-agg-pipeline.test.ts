import { describe, it, expect } from 'vitest';
import { AggregationPipeline } from '../electron/workers/agg-pipeline';

describe('AggregationPipeline', () => {
  it('should aggregate with sum', () => {
    const ap = new AggregationPipeline();
    ap.addLevel({
      name: '1min', windowMs: 60000,
      fields: [{ source: 'price', agg: 'sum', target: 'total_price' }],
    });
    ap.feed('AAPL', 100000, { price: 100 });
    ap.feed('AAPL', 100010, { price: 150 });
    const buckets = ap.getBuckets('1min');
    expect(buckets[0].values.total_price).toBe(250);
  });

  it('should do multi-level', () => {
    const ap = new AggregationPipeline();
    ap.addLevel({ name: '1s', windowMs: 1000, fields: [{ source: 'v', agg: 'max', target: 'max_v' }] });
    ap.addLevel({ name: '5s', windowMs: 5000, fields: [{ source: 'v', agg: 'avg', target: 'avg_v' }] });

    ap.feed('x', 0, { v: 10 });
    ap.feed('x', 500, { v: 20 });
    ap.feed('x', 1000, { v: 30 });

    const s1 = ap.getBuckets('1s');
    const s5 = ap.getBuckets('5s');
    expect(s1.length).toBeGreaterThan(0);
    expect(s5.length).toBeGreaterThan(0);
    expect(s5[0].values.avg_v).toBe(20); // avg of 10,20,30
  });
});

import { describe, it, expect } from 'vitest';
import { DataLineage } from '../electron/workers/data-lineage';

describe('DataLineage', () => {
  it('should trace upstream', () => {
    const dl = new DataLineage();
    dl.trackSource('raw_ticks', 'OpenD Stream');
    dl.trackTransform('t1', 'Clean', ['raw_ticks'], ['clean_ticks'], 'remove nulls');
    dl.trackTransform('t2', 'Aggregate', ['clean_ticks'], ['1min_bars'], 'OHLC');

    const up = dl.trace('1min_bars', 'upstream');
    expect(up.nodes.length).toBeGreaterThanOrEqual(2);
    expect(up.edges.length).toBeGreaterThan(0);
  });

  it('should do impact analysis', () => {
    const dl = new DataLineage();
    dl.trackSource('raw', 'Source');
    dl.trackTransform('a', 'A', ['raw'], ['mid'], '');
    dl.trackTransform('b', 'B', ['mid'], ['output'], '');

    const impact = dl.impactAnalysis('raw');
    expect(impact.affectedTables).toContain('output');
  });
});

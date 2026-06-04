import { describe, it, expect } from 'vitest';
import { TimeSeries } from '../electron/workers/time-series';

describe('TimeSeries', () => {
  it('should store and rotate', () => {
    const ts = new TimeSeries(5);
    for (let i = 1; i <= 7; i++) ts.push(i);
    const arr = ts.toArray();
    expect(arr.length).toBe(5);
    expect(arr[0].value).toBe(3);
    expect(arr[4].value).toBe(7);
  });

  it('should compute stats', () => {
    const ts = new TimeSeries(10);
    ts.push(10); ts.push(20); ts.push(30);
    const st = ts.stats();
    expect(st.count).toBe(3);
    expect(st.min).toBe(10);
    expect(st.max).toBe(30);
    expect(st.avg).toBe(20);
    expect(st.sum).toBe(60);
  });

  it('should filter by time window', () => {
    const ts = new TimeSeries(10);
    const now = Date.now();
    ts.push(1); ts.push(2); ts.push(3);
    const pts = ts.window(0, Date.now());
    expect(pts.length).toBe(3);
  });
});

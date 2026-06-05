import { describe, it, expect, vi } from 'vitest';
import { StreamBatchProcessor } from '../electron/workers/stream-batch';

describe('StreamBatchProcessor', () => {
  it('should process stream immediately', () => {
    const sbp = new StreamBatchProcessor();
    const fn = vi.fn();
    sbp.onStream(fn);
    sbp.ingest({ id: 'e1', timestamp: Date.now(), data: { price: 100 } });
    expect(fn).toHaveBeenCalled();
  });

  it('should batch process', async () => {
    const sbp = new StreamBatchProcessor();
    sbp.addBatchWindow('1min', 60000, 'ohlc');
    sbp.registerBatchHandler('ohlc', async (events) => ({
      high: Math.max(...events.map(e => e.data.price)),
      low: Math.min(...events.map(e => e.data.price)),
      count: events.length,
    }));

    const now = Date.now();
    sbp.ingest({ id: '1', timestamp: now, data: { price: 100 } });
    sbp.ingest({ id: '2', timestamp: now, data: { price: 200 } });
    sbp.ingest({ id: '3', timestamp: now, data: { price: 150 } });

    const result = await sbp.processBatch('1min');
    expect(result.aggregations.high).toBe(200);
    expect(result.aggregations.low).toBe(100);
    expect(result.aggregations.count).toBe(3);
  });

  it('should clean buffer after batch', async () => {
    const sbp = new StreamBatchProcessor();
    sbp.addBatchWindow('short', 20_000, 'test'); // 20s window — captures events from last 20s
    sbp.registerBatchHandler('test', async () => ({ count: 0 }));

    // Ingest event 10s ago (well within the 20s window)
    const now = Date.now();
    sbp.ingest({ id: 'old', timestamp: now - 10_000, data: {} });
    expect(sbp.getBufferSize()).toBe(1);

    await sbp.processBatch('short');
    // Old event was processed and removed from buffer
    expect(sbp.getBufferSize()).toBe(0);
  });
});

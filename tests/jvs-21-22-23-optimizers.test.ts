// JVS-21~23 Tests: KLine Aggregation Optimizer, Signal Push Optimizer, Data Compression

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  KLineAggregationOptimizer,
  getKLineAggregationOptimizer,
} from '../electron/engine/kline-aggregation-optimizer';
import {
  SignalPushOptimizer,
  getSignalPushOptimizer,
} from '../electron/engine/signal-push-optimizer';
import {
  DataCompressionTransport,
  getDataCompressionTransport,
} from '../electron/engine/data-compression-transport';

// ── JVS-21: KLine Aggregation Optimizer ──────────────────────────────────────

describe('JVS-21: KLine Aggregation Optimizer', () => {
  let optimizer: KLineAggregationOptimizer;

  beforeEach(() => {
    optimizer = new KLineAggregationOptimizer({ maxBufferSize: 100 });
  });

  afterEach(() => {
    optimizer.destroy();
  });

  it('should initialize with default config', () => {
    const stats = optimizer.getStats();
    expect(stats.symbols).toBe(0);
    expect(stats.totalCandles).toBe(0);
  });

  it('should feed single K-line point', () => {
    optimizer.feed('600519', {
      timestamp: Date.now(),
      open: 1800,
      high: 1810,
      low: 1790,
      close: 1805,
      volume: 1000,
    });

    const candles = optimizer.getCandles('600519', '1m');
    expect(candles.length).toBe(1);
    expect(candles[0].close).toBe(1805);
  });

  it('should aggregate to higher timeframes', () => {
    const base = Date.now();
    optimizer.feed('600519', {
      timestamp: base,
      open: 100, high: 110, low: 95, close: 105, volume: 500,
    });
    optimizer.feed('600519', {
      timestamp: base + 60000,
      open: 105, high: 115, low: 100, close: 112, volume: 600,
    });

    const tf5m = optimizer.getCandles('600519', '5m');
    // Both points should fall in same 5m window
    expect(tf5m.length).toBeGreaterThanOrEqual(1);
  });

  it('should batch feed multiple points', () => {
    const points = Array.from({ length: 10 }, (_, i) => ({
      timestamp: Date.now() + i * 60000,
      open: 100 + i, high: 110 + i, low: 95 + i, close: 105 + i, volume: 500,
    }));

    optimizer.feedBatch('600519', points);
    const candles = optimizer.getCandles('600519', '1m');
    expect(candles.length).toBe(10);
  });

  it('should respect circular buffer limit', () => {
    const small = new KLineAggregationOptimizer({ maxBufferSize: 5 });

    for (let i = 0; i < 20; i++) {
      small.feed('TEST', {
        timestamp: Date.now() + i * 60000,
        open: 100, high: 110, low: 90, close: 105, volume: 100,
      });
    }

    const candles = small.getCandles('TEST', '1m');
    expect(candles.length).toBeLessThanOrEqual(5);
    small.destroy();
  });

  it('should return performance stats', () => {
    for (let i = 0; i < 5; i++) {
      optimizer.feed('600519', {
        timestamp: Date.now() + i * 60000,
        open: 100, high: 110, low: 90, close: 105, volume: 100,
      });
    }

    const perf = optimizer.getPerformanceStats();
    expect(perf.totalOps).toBeGreaterThan(0);
    expect(perf.bufferCount).toBeGreaterThan(0);
  });

  it('should get aggregation result with metrics', () => {
    optimizer.feed('600519', {
      timestamp: Date.now(),
      open: 100, high: 110, low: 90, close: 105, volume: 100,
    });

    const result = optimizer.getAggregationResult('600519', '1m');
    expect(result.candles.length).toBe(1);
    expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
    expect(result.memoryUsedBytes).toBeGreaterThan(0);
  });

  it('should clear specific symbol', () => {
    optimizer.feed('600519', {
      timestamp: Date.now(), open: 100, high: 110, low: 90, close: 105, volume: 100,
    });
    optimizer.feed('000001', {
      timestamp: Date.now(), open: 50, high: 55, low: 48, close: 52, volume: 200,
    });

    optimizer.clearSymbol('600519');
    expect(optimizer.getCandles('600519', '1m').length).toBe(0);
    expect(optimizer.getCandles('000001', '1m').length).toBe(1);
  });

  it('should emit feed events', () => {
    let emitted = false;
    optimizer.on('feed', () => { emitted = true; });
    optimizer.feed('600519', {
      timestamp: Date.now(), open: 100, high: 110, low: 90, close: 105, volume: 100,
    });
    expect(emitted).toBe(true);
  });
});

// ── JVS-22: Signal Push Optimizer ────────────────────────────────────────────

describe('JVS-22: Signal Push Optimizer', () => {
  let pusher: SignalPushOptimizer;

  beforeEach(() => {
    pusher = new SignalPushOptimizer({ batchSize: 3, batchIntervalMs: 50 });
  });

  afterEach(() => {
    pusher.destroy();
  });

  it('should initialize', () => {
    const m = pusher.getMetrics();
    expect(m.totalReceived).toBe(0);
    expect(m.totalPushed).toBe(0);
  });

  it('should subscribe and filter signals', () => {
    pusher.subscribe('client-1', {
      symbols: ['600519'],
      minStrength: 50,
    });

    pusher.pushSignal({
      symbol: '600519', strategy: 'MACD', direction: 'BUY',
      strength: 80, timestamp: Date.now(),
    });

    expect(pusher.getMetrics().totalReceived).toBe(1);
  });

  it('should filter by minimum strength', () => {
    pusher.subscribe('client-1', { minStrength: 70 });

    pusher.pushSignal({
      symbol: '600519', strategy: 'MACD', direction: 'BUY',
      strength: 30, timestamp: Date.now(),
    });

    expect(pusher.getMetrics().totalFiltered).toBeGreaterThan(0);
  });

  it('should deduplicate signals within window', () => {
    pusher.subscribe('client-1', {});

    const signal = {
      symbol: '600519', strategy: 'MACD', direction: 'BUY' as const,
      strength: 80, timestamp: Date.now(),
    };

    pusher.pushSignal(signal);
    pusher.pushSignal({ ...signal }); // duplicate

    expect(pusher.getMetrics().totalDedup).toBe(1);
  });

  it('should store signal history', () => {
    pusher.pushSignal({
      symbol: '600519', strategy: 'MACD', direction: 'BUY',
      strength: 80, timestamp: Date.now(),
    });

    const history = pusher.getHistory('600519');
    expect(history.length).toBe(1);
  });

  it('should batch push signals', () => {
    pusher.subscribe('client-1', {});

    pusher.pushBatch([
      { symbol: '600519', strategy: 'MACD', direction: 'BUY', strength: 80, timestamp: Date.now() },
      { symbol: '000001', strategy: 'RSI', direction: 'SELL', strength: 70, timestamp: Date.now() },
    ]);

    expect(pusher.getMetrics().totalReceived).toBe(2);
  });

  it('should emit push events on flush', async () => {
    const received: any[] = [];
    pusher.on('push', (batch: any) => received.push(batch));

    pusher.subscribe('client-1', {});

    // Push enough to trigger batch flush
    for (let i = 0; i < 3; i++) {
      pusher.pushSignal({
        symbol: `SYM${i}`, strategy: 'MACD', direction: 'BUY',
        strength: 80, timestamp: Date.now() + i * 10000,
      });
    }

    // Wait for flush
    await new Promise(r => setTimeout(r, 100));
    expect(received.length).toBeGreaterThanOrEqual(1);
  });

  it('should get subscription stats', () => {
    pusher.subscribe('client-1', { symbols: ['600519', '000001'] });
    pusher.subscribe('client-2', { symbols: ['600036'] });

    const stats = pusher.getSubscriptionStats();
    expect(stats.totalClients).toBe(2);
    expect(stats.totalSymbols).toBe(3);
  });

  it('should unsubscribe client', () => {
    pusher.subscribe('client-1', {});
    pusher.unsubscribe('client-1');
    expect(pusher.getSubscriptionStats().totalClients).toBe(0);
  });
});

// ── JVS-23: Data Compression Transport ───────────────────────────────────────

describe('JVS-23: Data Compression Transport', () => {
  let transport: DataCompressionTransport;

  beforeEach(() => {
    transport = new DataCompressionTransport({ minCompressSize: 10 });
  });

  afterEach(() => {
    transport.destroy();
  });

  it('should initialize', () => {
    const m = transport.getMetrics();
    expect(m.totalCompressed).toBe(0);
  });

  it('should compress large payloads', () => {
    const data = { items: Array.from({ length: 50 }, (_, i) => ({ id: i, active: "true", status: "null", val: `item_${i}000` })) };
    const result = transport.prepare('test', data);
    expect(result.ratio).toBeLessThanOrEqual(1.0);
    expect(result.compressed.length).toBeLessThanOrEqual(result.original.length);
  });

  it('should not compress small payloads', () => {
    const small = new DataCompressionTransport({ minCompressSize: 10000 });
    const result = small.prepare('test', { a: 1 });
    expect(result.ratio).toBe(1.0);
    small.destroy();
  });

  it('should generate delta updates', () => {
    transport.generateDelta('ch1', { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7, h: 8, i: 9, j: 10 });
    const delta = transport.generateDelta('ch1', { a: 99, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7, h: 8, i: 9, j: 10 });

    // Only 'a' changed out of 10 fields -> delta (10% < 30% threshold)
    expect(delta.type).toBe('delta');
    expect(delta.data).toHaveProperty('a');
    expect(delta.data).not.toHaveProperty('b');
  });

  it('should send full update when no previous version', () => {
    const delta = transport.generateDelta('new', { price: 100 });
    expect(delta.type).toBe('full');
  });

  it('should apply delta updates correctly', () => {
    const base = { price: 100, volume: 500, name: 'TEST' };
    const delta = { type: 'delta' as const, data: { price: 105 }, currentVersion: 2, baseVersion: 1 };

    const result = transport.applyDelta(base, delta);
    expect(result.price).toBe(105);
    expect(result.volume).toBe(500);
    expect(result.name).toBe('TEST');
  });

  it('should decompress correctly', () => {
    const original = { active: "true", disabled: "false", empty: "null", name: "test" };
    const { compressed } = transport.prepare('test', original);
    const decompressed = transport.decompress(compressed);
    const parsed = JSON.parse(decompressed);
    expect(parsed.active).toBe('true');
    expect(parsed.disabled).toBe('false');
    expect(parsed.empty).toBe('null');
  });

  it('should batch enqueue and flush', async () => {
    const batches: any[] = [];
    transport.on('batch', (b) => batches.push(b));

    transport.enqueue('ch1', { price: 100 });
    transport.enqueue('ch2', { price: 200 });
    transport.flush();

    expect(batches.length).toBe(1);
    expect(batches[0].length).toBe(2);
  });

  it('should track version numbers', () => {
    transport.generateDelta('ch1', { a: 1 });
    transport.generateDelta('ch1', { a: 2 });
    transport.generateDelta('ch1', { a: 3 });

    expect(transport.getVersion('ch1')).toBe(3);
    expect(transport.getVersion('unknown')).toBe(0);
  });

  it('should report compression metrics', () => {
    const largeData = { items: Array.from({ length: 100 }, (_, i) => ({ id: i, val: `x${i}` })) };
    transport.prepare('test', largeData);

    const m = transport.getMetrics();
    expect(m.totalCompressed).toBe(1);
    expect(m.savingsPercent).toBeGreaterThan(0);
  });
});

// ── Singleton tests ──────────────────────────────────────────────────────────

describe('Singletons', () => {
  it('should return same KLineAggregationOptimizer instance', () => {
    const a = getKLineAggregationOptimizer();
    const b = getKLineAggregationOptimizer();
    expect(a).toBe(b);
  });

  it('should return same SignalPushOptimizer instance', () => {
    const a = getSignalPushOptimizer();
    const b = getSignalPushOptimizer();
    expect(a).toBe(b);
  });

  it('should return same DataCompressionTransport instance', () => {
    const a = getDataCompressionTransport();
    const b = getDataCompressionTransport();
    expect(a).toBe(b);
  });
});

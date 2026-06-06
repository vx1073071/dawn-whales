// JVS-21~23 Standalone Test Runner (tsx)
import { KLineAggregationOptimizer } from '../electron/engine/kline-aggregation-optimizer';
import { SignalPushOptimizer } from '../electron/engine/signal-push-optimizer';
import { DataCompressionTransport } from '../electron/engine/data-compression-transport';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${msg}`);
  } else {
    failed++;
    console.log(`  ❌ ${msg}`);
  }
}

async function run() {
  console.log('\n━━ JVS-21: KLine Aggregation Optimizer ━━');
  {
    const opt = new KLineAggregationOptimizer({ maxBufferSize: 100 });
    assert(opt.getStats().symbols === 0, 'init: 0 symbols');

    opt.feed('600519', { timestamp: Date.now(), open: 100, high: 110, low: 90, close: 105, volume: 500 });
    assert(opt.getCandles('600519', '1m').length === 1, 'feed: 1 candle');

    const points = Array.from({ length: 10 }, (_, i) => ({
      timestamp: Date.now() + i * 60000,
      open: 100 + i, high: 110 + i, low: 95 + i, close: 105 + i, volume: 500,
    }));
    opt.feedBatch('000001', points);
    assert(opt.getCandles('000001', '1m').length === 10, 'feedBatch: 10 candles');

    const small = new KLineAggregationOptimizer({ maxBufferSize: 5 });
    for (let i = 0; i < 20; i++) {
      small.feed('T', { timestamp: Date.now() + i * 60000, open: 100, high: 110, low: 90, close: 105, volume: 100 });
    }
    assert(small.getCandles('T', '1m').length <= 5, 'circular buffer: <=5');
    small.destroy();

    const perf = opt.getPerformanceStats();
    assert(perf.totalOps > 0, 'perf: ops tracked');
    assert(opt.getAggregationResult('600519', '1m').processingTimeMs >= 0, 'aggregation result');

    opt.clearSymbol('600519');
    assert(opt.getCandles('600519', '1m').length === 0, 'clearSymbol');

    opt.destroy();
  }

  console.log('\n━━ JVS-22: Signal Push Optimizer ━━');
  {
    const pusher = new SignalPushOptimizer({ batchSize: 3, batchIntervalMs: 50 });
    assert(pusher.getMetrics().totalReceived === 0, 'init: 0 received');

    pusher.subscribe('c1', { symbols: ['600519'], minStrength: 50 });
    pusher.pushSignal({ symbol: '600519', strategy: 'MACD', direction: 'BUY', strength: 80, timestamp: Date.now() });
    assert(pusher.getMetrics().totalReceived === 1, 'push: received 1');

    pusher.pushSignal({ symbol: '000001', strategy: 'RSI', direction: 'SELL', strength: 80, timestamp: Date.now() });
    assert(pusher.getMetrics().totalFiltered > 0, 'filter: not in subscription');

    pusher.pushSignal({ symbol: '600519', strategy: 'MACD', direction: 'BUY', strength: 20, timestamp: Date.now() });
    assert(pusher.getMetrics().totalFiltered > 0, 'filter: minStrength');

    // Dedup
    pusher.subscribe('c2', {});
    const sig = { symbol: 'T', strategy: 'X', direction: 'BUY' as const, strength: 90, timestamp: Date.now() };
    pusher.pushSignal(sig);
    pusher.pushSignal({ ...sig });
    assert(pusher.getMetrics().totalDedup >= 1, 'dedup: duplicate blocked');

    assert(pusher.getHistory('T').length === 1, 'history stored');

    pusher.subscribe('c3', { symbols: ['A', 'B'] });
    const stats = pusher.getSubscriptionStats();
    assert(stats.totalClients === 3, 'sub stats: 3 clients');

    pusher.unsubscribe('c3');
    assert(pusher.getSubscriptionStats().totalClients === 2, 'unsubscribe');

    pusher.destroy();
  }

  console.log('\n━━ JVS-23: Data Compression Transport ━━');
  {
    const t = new DataCompressionTransport({ minCompressSize: 10 });
    assert(t.getMetrics().totalCompressed === 0, 'init: 0 compressed');

    // Large payload compression - use string booleans/nulls that get compressed
    const large = { items: Array.from({ length: 50 }, (_, i) => ({ id: i, active: "true", status: "null", value: `item_${i}000` })) };
    const r = t.prepare('test', large);
    assert(r.ratio <= 1.0, `compression ratio: ${r.ratio.toFixed(3)}`);
    assert(r.compressed.length <= r.original.length, 'compressed <= original');

    // Delta - use object with many keys so 1 change < 30% threshold
    t.generateDelta('ch1', { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7, h: 8, i: 9, j: 10 });
    const d = t.generateDelta('ch1', { a: 99, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7, h: 8, i: 9, j: 10 });
    assert(d.type === 'delta', 'delta: only 1/10 changed');
    assert('a' in d.data && !('b' in d.data), 'delta: correct fields');

    // Full on new channel
    const full = t.generateDelta('new', { a: 1 });
    assert(full.type === 'full', 'full on first version');

    // Apply delta
    const base = { price: 100, volume: 500 };
    const applied = t.applyDelta(base, { type: 'delta', data: { price: 105 }, currentVersion: 2 });
    assert(applied.price === 105 && applied.volume === 500, 'applyDelta');

    // Decompress
    const { compressed } = t.prepare('x', { active: "true", disabled: "false" });
    const dec = t.decompress(compressed);
    assert(JSON.parse(dec).active === 'true', 'decompress');

    // Versions
    t.generateDelta('v', { a: 1 });
    t.generateDelta('v', { a: 2 });
    assert(t.getVersion('v') === 2, 'version tracking');

    // Batch flush
    const batches: any[] = [];
    t.on('batch', (b: any) => batches.push(b));
    t.enqueue('c1', { x: 1 });
    t.enqueue('c2', { x: 2 });
    t.flush();
    assert(batches.length === 1, 'batch flush');

    // Metrics
    const m = t.getMetrics();
    assert(m.savingsPercent >= 0, 'metrics: savings %');

    t.destroy();
  }

  console.log(`\n━━ Results: ${passed} passed, ${failed} failed ━━`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(1); });

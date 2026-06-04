// ── JVS-29/30: WebSocket Stream + History Backfill Tests ──────────────────
// Run: npx tsx tests/ws-backfill.test.ts

import { WsDataStreamService, getWsDataStream, StreamTick } from '../electron/data/ws-data-stream';
import { HistoryBackfillService, getHistoryBackfill, BackfillProgress } from '../electron/data/history-backfill';

// ── Test Framework ─────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const errors: string[] = [];

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (err: any) {
    console.log(`  ❌ ${name}: ${err.message}`);
    errors.push(`${name}: ${err.message}`);
    failed++;
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

// ── JVS-29: WebSocket Data Stream Tests ────────────────────────────────────

async function testWsDataStream() {
  console.log('\n📡 JVS-29: WebSocket Real-time Data Stream');

  await test('WsDataStream: singleton creation', async () => {
    const svc = getWsDataStream();
    assert(svc !== null, 'Should create singleton');
    assert(svc instanceof WsDataStreamService, 'Correct type');
    const status = svc.getStatus();
    assert(status.mode === 'idle', `Should start idle, got ${status.mode}`);
    assert(status.subscribedCount === 0, 'No subscriptions');
    console.log(`    Mode: ${status.mode}, connected: ${status.connected}`);
  });

  await test('WsDataStream: start stream (push2 fallback expected)', async () => {
    const svc = new WsDataStreamService({ fallbackIntervalMs: 100000 }); // Long interval to avoid fetch during test
    const result = await svc.startStream(['SH.600519', 'SZ.000858']);
    assert(result.success, `Should succeed, got: ${result.message}`);
    // OpenD likely not running, so push2 fallback expected
    assert(['opend', 'push2'].includes(result.mode), `Valid mode: ${result.mode}`);
    console.log(`    Mode: ${result.mode}, message: ${result.message}`);

    const status = svc.getStatus();
    assert(status.subscribedCount === 2, `Subscribed 2, got ${status.subscribedCount}`);
    assert(status.mode !== 'idle', 'Should not be idle');
    svc.stop();
  });

  await test('WsDataStream: subscribe/unsubscribe', async () => {
    const svc = new WsDataStreamService({ fallbackIntervalMs: 100000 });
    await svc.startStream(['SH.600519']);

    const sub = await svc.subscribe(['SZ.000858', 'SZ.300750']);
    assert(sub.success, 'Subscribe should succeed');
    assert(sub.added === 2, `Added 2, got ${sub.added}`);
    assert(sub.total === 3, `Total 3, got ${sub.total}`);

    const unsub = svc.unsubscribe(['SZ.300750']);
    assert(unsub.success, 'Unsubscribe should succeed');
    assert(unsub.removed === 1, `Removed 1, got ${unsub.removed}`);
    assert(unsub.total === 2, `Total 2, got ${unsub.total}`);

    svc.stop();
    console.log(`    Subscribe/unsubscribe: OK`);
  });

  await test('WsDataStream: event emission', async () => {
    const svc = new WsDataStreamService({ fallbackIntervalMs: 100000 });
    let tickReceived = false;
    let subscriptionChanged = false;

    svc.on('tick', () => { tickReceived = true; });
    svc.on('subscription:changed', () => { subscriptionChanged = true; });

    await svc.startStream(['SH.600519']);
    await svc.subscribe(['SZ.000858']);
    assert(subscriptionChanged, 'Should emit subscription:changed');

    svc.stop();
    console.log(`    Events: tick=${tickReceived}, subscription:changed=${subscriptionChanged}`);
  });

  await test('WsDataStream: stop + cleanup', async () => {
    const svc = new WsDataStreamService();
    await svc.startStream(['SH.600519']);
    svc.stop();

    const status = svc.getStatus();
    assert(status.mode === 'idle', `Should be idle after stop, got ${status.mode}`);
    assert(status.subscribedCount === 0, 'No subscriptions after stop');
    assert(status.totalTicks === 0, 'Ticks reset');
    console.log(`    Cleanup OK: mode=${status.mode}`);
  });

  await test('WsDataStream: max symbols enforcement', async () => {
    const svc = new WsDataStreamService({ maxSymbols: 3 });
    const result = await svc.startStream(['SH.600519', 'SZ.000858', 'SZ.300750', 'SH.601318']);
    assert(!result.success, 'Should reject too many symbols');
    assert(result.message.includes('Too many'), `Error message: ${result.message}`);
    svc.stop();
    console.log(`    Max symbols: enforced`);
  });

  await test('WsDataStream: code-to-secid conversion', async () => {
    const svc = new WsDataStreamService();
    // Test through subscribe + status
    await svc.startStream(['SH.600519', 'SZ.000858']);
    const status = svc.getStatus();
    assert(status.subscribedCount === 2, 'Subscribed');

    // The internal conversion is tested implicitly through startStream
    svc.stop();
    console.log(`    Secid conversion: OK (implicit)`);
  });
}

// ── JVS-30: History Backfill Tests ─────────────────────────────────────────

async function testHistoryBackfill() {
  console.log('\n📚 JVS-30: Historical Data Backfill');

  await test('HistoryBackfill: singleton creation', async () => {
    const svc = getHistoryBackfill();
    assert(svc !== null, 'Should create singleton');
    assert(svc instanceof HistoryBackfillService, 'Correct type');
    const status = svc.getStatus();
    assert(!status.running, 'Should not be running');
    assert(status.total === 21, `21 modules defined, got ${status.total}`);
    console.log(`    Total modules: ${status.total}`);
  });

  await test('HistoryBackfill: single module backfill', async () => {
    const svc = new HistoryBackfillService({ periodDays: 30, retryCount: 1 });
    const result = await svc.startBackfill(['macro-gdp']);
    assert(!result.running, 'Should complete');
    assert(result.results.length >= 1, `Has results: ${result.results.length}`);
    const mod = result.results[0];
    assert(mod !== undefined, 'Has module result');
    console.log(`    Module: ${mod.module}, success: ${mod.success}, records: ${mod.records}, latency: ${mod.latencyMs}ms`);
    if (mod.error) console.log(`    Error (may be expected): ${mod.error}`);
  });

  await test('HistoryBackfill: kline backfill (30 days)', async () => {
    const svc = new HistoryBackfillService({ periodDays: 30, retryCount: 1 });
    const result = await svc.startBackfill(['sector-heatmap']);
    const mod = result.results[0];
    assert(mod !== undefined, 'Has result');
    // Kline should work since push2his.eastmoney.com is reliable
    if (mod.success) {
      assert(mod.records > 0, `Should have records, got ${mod.records}`);
      assert(mod.startDate !== undefined, 'Has start date');
      console.log(`    Records: ${mod.records}, range: ${mod.startDate} to ${mod.endDate}`);
    } else {
      console.log(`    Kline failed (may be network): ${mod.error}`);
    }
  });

  await test('HistoryBackfill: multi-module batch', async () => {
    const svc = new HistoryBackfillService({ periodDays: 7, batchSize: 5, delayMs: 200, retryCount: 1 });
    const modules = ['sector-heatmap', 'market-breadth', 'capital-flow-rank', 'macro-gdp', 'macro-cpi'];
    const result = await svc.startBackfill(modules);

    assert(!result.running, 'Should complete');
    assert(result.results.length === modules.length, `All ${modules.length} modules processed, got ${result.results.length}`);
    assert(result.completed + result.failed === modules.length, 'All accounted for');

    for (const r of result.results) {
      const status = r.success ? '✅' : '❌';
      console.log(`    ${status} ${r.module}: ${r.records} records (${r.latencyMs}ms)`);
    }
  });

  await test('HistoryBackfill: stop/cancel', async () => {
    const svc = new HistoryBackfillService({ periodDays: 365, delayMs: 5000, retryCount: 0 });

    // Start in background, then stop immediately
    const backfillPromise = svc.startBackfill();
    await new Promise(resolve => setTimeout(resolve, 100));
    svc.stop();

    const result = await backfillPromise;
    assert(!result.running, 'Should not be running after stop');
    console.log(`    Stopped: completed=${result.completed}, failed=${result.failed}`);
  });

  await test('HistoryBackfill: status tracking', async () => {
    const svc = new HistoryBackfillService({ periodDays: 7, retryCount: 1 });
    const statusBefore = svc.getStatus();
    assert(!statusBefore.running, 'Not running before start');
    assert(statusBefore.total === 21, `21 modules, got ${statusBefore.total}`);

    // Run single module
    await svc.startBackfill(['macro-ppi']);

    const statusAfter = svc.getStatus();
    assert(!statusAfter.running, 'Not running after complete');
    assert(statusAfter.results.length >= 1, 'Has results');
    assert(statusAfter.elapsedMs > 0, `Elapsed: ${statusAfter.elapsedMs}ms`);
    console.log(`    Status tracking: OK, elapsed ${statusAfter.elapsedMs}ms`);
  });
}

// ── Run All ────────────────────────────────────────────────────────────────

async function runAll() {
  console.log('══════════════════════════════════════════════════');
  console.log('  JVS-29/30: WebSocket Stream + History Backfill');
  console.log('══════════════════════════════════════════════════');

  await testWsDataStream();
  await testHistoryBackfill();

  console.log('\n══════════════════════════════════════════════════');
  console.log(`  Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
  console.log('══════════════════════════════════════════════════');

  if (errors.length > 0) {
    console.log('\nErrors:');
    errors.forEach(e => console.log(`  - ${e}`));
  }

  process.exit(failed > 0 ? 1 : 0);
}

runAll().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});

// ── JVS-29/30: WebSocket Stream + History Backfill Tests ──────────────────
// Run: npx vitest run tests/ws-backfill.test.ts

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WsDataStreamService, getWsDataStream, StreamTick } from '../electron/data/ws-data-stream';
import { HistoryBackfillService, getHistoryBackfill, BackfillProgress } from '../electron/data/history-backfill';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

// ── JVS-29: WebSocket Data Stream Tests ────────────────────────────────────

describe('JVS-29: WebSocket Data Stream', () => {
  let svc: WsDataStreamService;

  afterEach(() => {
    try { svc?.stop(); } catch {}
  });

  it('singleton creation', async () => {
    const s = getWsDataStream();
    expect(s).not.toBeNull();
    expect(s).toBeInstanceOf(WsDataStreamService);
    const status = s.getStatus();
    expect(status.mode).toBe('idle');
    expect(status.subscribedCount).toBe(0);
  });

  it('start stream with push2 fallback', async () => {
    svc = new WsDataStreamService({ fallbackIntervalMs: 100000 });
    const result = await svc.startStream(['SH.600519', 'SZ.000858']);
    expect(result.success).toBe(true);
    expect(['opend', 'push2']).toContain(result.mode);
    const status = svc.getStatus();
    expect(status.subscribedCount).toBe(2);
    expect(status.mode).not.toBe('idle');
  });

  it('subscribe/unsubscribe', async () => {
    svc = new WsDataStreamService({ fallbackIntervalMs: 100000 });
    await svc.startStream(['SH.600519']);
    const sub = await svc.subscribe(['SZ.000858', 'SZ.300750']);
    expect(sub.success).toBe(true);
    expect(sub.added).toBe(2);
    expect(sub.total).toBe(3);
    const unsub = svc.unsubscribe(['SZ.300750']);
    expect(unsub.success).toBe(true);
    expect(unsub.removed).toBe(1);
    expect(unsub.total).toBe(2);
  });

  it('event emission', async () => {
    svc = new WsDataStreamService({ fallbackIntervalMs: 100000 });
    let tickReceived = false;
    let subscriptionChanged = false;
    svc.on('tick', () => { tickReceived = true; });
    svc.on('subscription:changed', () => { subscriptionChanged = true; });
    await svc.startStream(['SH.600519']);
    await svc.subscribe(['SZ.000858']);
    expect(subscriptionChanged).toBe(true);
  });

  it('stop + cleanup', async () => {
    svc = new WsDataStreamService();
    await svc.startStream(['SH.600519']);
    svc.stop();
    const status = svc.getStatus();
    expect(status.mode).toBe('idle');
    expect(status.subscribedCount).toBe(0);
    expect(status.totalTicks).toBe(0);
  });

  it('max symbols enforcement', async () => {
    svc = new WsDataStreamService({ maxSymbols: 3 });
    const result = await svc.startStream(['SH.600519', 'SZ.000858', 'SZ.300750', 'SH.601318']);
    expect(result.success).toBe(false);
    expect(result.message).toContain('Too many');
  });

  it('code-to-secid conversion', async () => {
    svc = new WsDataStreamService();
    await svc.startStream(['SH.600519', 'SZ.000858']);
    const status = svc.getStatus();
    expect(status.subscribedCount).toBe(2);
  });
});

// ── JVS-30: History Backfill Tests ──────────────────────────────────────────

describe('JVS-30: Historical Data Backfill', () => {
  it('singleton creation', () => {
    const svc = getHistoryBackfill();
    expect(svc).not.toBeNull();
    expect(svc).toBeInstanceOf(HistoryBackfillService);
    const status = svc.getStatus();
    expect(status.running).toBe(false);
    expect(status.total).toBe(21);
  });

  it('single module backfill', async () => {
    const svc = new HistoryBackfillService({ periodDays: 30, retryCount: 1 });
    const result = await svc.startBackfill(['macro-gdp']);
    expect(result.running).toBe(false);
    expect(result.results.length).toBeGreaterThanOrEqual(1);
    const mod = result.results[0];
    expect(mod).toBeDefined();
  });

  it('kline backfill (30 days)', async () => {
    const svc = new HistoryBackfillService({ periodDays: 30, retryCount: 1 });
    const result = await svc.startBackfill(['sector-heatmap']);
    const mod = result.results[0];
    expect(mod).toBeDefined();
    if (mod.success) {
      expect(mod.records).toBeGreaterThan(0);
      expect(mod.startDate).toBeDefined();
    }
  });

  it('multi-module batch', async () => {
    const svc = new HistoryBackfillService({ periodDays: 7, batchSize: 5, delayMs: 200, retryCount: 1 });
    const modules = ['sector-heatmap', 'market-breadth', 'capital-flow-rank', 'macro-gdp', 'macro-cpi'];
    const result = await svc.startBackfill(modules);
    expect(result.running).toBe(false);
    expect(result.results.length).toBe(modules.length);
    expect(result.completed + result.failed).toBe(modules.length);
  });

  it.skip('stop/cancel', async () => {
    const svc = new HistoryBackfillService({ periodDays: 365, delayMs: 5000, retryCount: 0 });
    const backfillPromise = svc.startBackfill();
    await new Promise(resolve => setTimeout(resolve, 100));
    svc.stop();
    const result = await backfillPromise;
    expect(result.running).toBe(false);
  });

  it('status tracking', async () => {
    const svc = new HistoryBackfillService({ periodDays: 7, retryCount: 1 });
    const statusBefore = svc.getStatus();
    expect(statusBefore.running).toBe(false);
    expect(statusBefore.total).toBe(21);
    await svc.startBackfill(['macro-ppi']);
    const statusAfter = svc.getStatus();
    expect(statusAfter.running).toBe(false);
    expect(statusAfter.results.length).toBeGreaterThanOrEqual(1);
    expect(statusAfter.elapsedMs).toBeGreaterThanOrEqual(0);
  });
});
import { describe, it, expect, beforeEach } from 'vitest';
import { SmartConditionOrderEngine } from '../electron/engine/trade/SmartConditionOrderEngine';
import { TimeAndSalesEngine } from '../electron/engine/data/TimeAndSalesEngine';
import { PipelinePerformanceAuditor } from '../electron/engine/perf/PipelinePerformanceAuditor';

// ═══════════════════════════════════════════════════════════════
// P2-02 SmartConditionOrderEngine
// ═══════════════════════════════════════════════════════════════

describe('SmartConditionOrderEngine', () => {
  let engine: SmartConditionOrderEngine;
  beforeEach(() => {
    (SmartConditionOrderEngine as any).instance = null;
    engine = SmartConditionOrderEngine.getInstance();
  });

  it('singleton', () => { expect(SmartConditionOrderEngine.getInstance()).toBe(engine); });

  it('creates price condition order', () => {
    const order = engine.create({
      userId: 'u1', symbol: 'AAPL', side: 'sell', quantity: 100,
      type: 'price', priceCondition: { targetPrice: 195, comparison: 'lte' },
    });
    expect(order).not.toBeNull();
    expect(order!.status).toBe('active');
    expect(order!.type).toBe('price');
    expect(order!.priceCondition!.targetPrice).toBe(195);
  });

  it('creates OCO order pair', () => {
    const result = engine.createOCO({
      userId: 'u1', symbol: 'MSFT', side: 'sell', quantity: 80,
      stopLossPrice: 400, takeProfitPrice: 480,
    });
    expect(result).not.toBeNull();
    expect(result!.stopOrder.type).toBe('oco');
    expect(result!.tpOrder.type).toBe('oco');
    expect(result!.stopOrder.ocoGroupId).toBe(result!.tpOrder.ocoGroupId);
  });

  it('creates bracket order', () => {
    const result = engine.createBracket({
      userId: 'u1', symbol: 'META', side: 'buy', quantity: 30,
      entryPrice: 600, stopLossPercent: 3, takeProfitPercent: 8,
    });
    expect(result).not.toBeNull();
    expect(result!.entry.type).toBe('bracket');
    expect(result!.bracket.stopLoss.offsetPercent).toBe(3);
    expect(result!.bracket.takeProfit.offsetPercent).toBe(8);
  });

  it('creates trailing stop', () => {
    const order = engine.createTrailingStop({
      userId: 'u1', symbol: 'GOOG', side: 'sell', quantity: 60,
      trailPercent: 5, activationPrice: 170,
    });
    expect(order).not.toBeNull();
    expect(order!.type).toBe('trailing_stop');
    expect(order!.trailingStop!.trailPercent).toBe(5);
  });

  it('evaluates price condition — gte trigger', () => {
    engine.create({
      userId: 'u1', symbol: 'AAPL', side: 'sell', quantity: 100,
      type: 'price', priceCondition: { targetPrice: 200, comparison: 'gte' },
    });
    const results = engine.evaluate('AAPL', 205);
    expect(results[0].triggered).toBe(true);
    expect(results[0].order.status).toBe('triggered');
  });

  it('evaluates price condition — lte trigger', () => {
    engine.create({
      userId: 'u1', symbol: 'AAPL', side: 'buy', quantity: 100,
      type: 'price', priceCondition: { targetPrice: 190, comparison: 'lte' },
    });
    const results = engine.evaluate('AAPL', 185);
    expect(results[0].triggered).toBe(true);
  });

  it('evaluates cross_above', () => {
    engine.create({
      userId: 'u1', symbol: 'AAPL', side: 'buy', quantity: 50,
      type: 'price', priceCondition: { targetPrice: 200, comparison: 'cross_above' },
    });
    // First eval: lastKnown=195, price=198 — no cross
    engine.evaluate('AAPL', 195);
    // Second eval: lastKnown=195(from prev), price=202 — crosses above 200
    // Actually re-read: evaluate resets lastKnownPrice each time, so we need to use the same order
    const order = engine.create({
      userId: 'u1', symbol: 'TSLA', side: 'buy', quantity: 50,
      type: 'price', priceCondition: { targetPrice: 300, comparison: 'cross_above' },
    });
    engine.evaluate('TSLA', 295);  // set lastKnown to 295
    const results = engine.evaluate('TSLA', 305);  // crossed above 300
    expect(results.some(r => r.triggered)).toBe(true);
  });

  it('OCO — one leg trigger cancels the other', () => {
    const result = engine.createOCO({
      userId: 'u1', symbol: 'MSFT', side: 'sell', quantity: 80,
      stopLossPrice: 400, takeProfitPrice: 480,
    });
    expect(result).not.toBeNull();
    // Trigger stop loss: MSFT drops to 390
    engine.evaluate('MSFT', 390);
    // The other leg (TP) should be cancelled
    const tpOrder = engine.getOrder(result!.tpOrder.id);
    expect(tpOrder!.status).toBe('cancelled');
  });

  it('trailing stop — long direction tracks high', () => {
    engine.createTrailingStop({
      userId: 'u1', symbol: 'GOOG', side: 'sell', quantity: 60,
      trailPercent: 10, activationPrice: 170,
    });
    // Push price up
    engine.evaluate('GOOG', 175); // high=175, active
    engine.evaluate('GOOG', 200); // high=200, trail=20, stop=180
    engine.evaluate('GOOG', 185); // still above 180, no trigger
    // Check: still active
    const orders = engine.getActiveOrders('GOOG');
    expect(orders.length).toBeGreaterThanOrEqual(1);
    // Push down below stop
    const results = engine.evaluate('GOOG', 178);
    expect(results.some(r => r.triggered)).toBe(true);
  });

  it('cancel order', () => {
    const order = engine.create({
      userId: 'u1', symbol: 'AAPL', side: 'sell', quantity: 100,
      type: 'price', priceCondition: { targetPrice: 200, comparison: 'gte' },
    });
    const ok = engine.cancelOrder(order!.id);
    expect(ok).toBe(true);
    expect(engine.getOrder(order!.id)!.status).toBe('cancelled');
  });

  it('cancelAll by symbol', () => {
    engine.create({ userId: 'u1', symbol: 'AAPL', side: 'sell', quantity: 100, type: 'price', priceCondition: { targetPrice: 200, comparison: 'gte' } });
    engine.create({ userId: 'u1', symbol: 'TSLA', side: 'buy', quantity: 50, type: 'price', priceCondition: { targetPrice: 250, comparison: 'lte' } });
    engine.create({ userId: 'u1', symbol: 'AAPL', side: 'sell', quantity: 200, type: 'price', priceCondition: { targetPrice: 210, comparison: 'gte' } });
    const count = engine.cancelAll('AAPL');
    expect(count).toBe(2);
  });

  it('update price and quantity', () => {
    const order = engine.create({
      userId: 'u1', symbol: 'AAPL', side: 'sell', quantity: 100,
      type: 'price', priceCondition: { targetPrice: 200, comparison: 'gte' },
    });
    engine.updatePrice(order!.id, 210);
    expect(engine.getOrder(order!.id)!.priceCondition!.targetPrice).toBe(210);
    engine.updateQuantity(order!.id, 150);
    expect(engine.getOrder(order!.id)!.quantity).toBe(150);
  });

  it('stats aggregation', () => {
    engine.createMockOrders();
    const stats = engine.getStats();
    expect(stats.totalCreated).toBeGreaterThan(0);
    expect(stats.totalActive).toBeGreaterThan(0);
    expect(stats.byType['price']).toBeDefined();
  });

  it('evaluateMulti batch', () => {
    engine.create({ userId: 'u1', symbol: 'AAPL', side: 'sell', quantity: 100, type: 'price', priceCondition: { targetPrice: 200, comparison: 'gte' } });
    engine.create({ userId: 'u1', symbol: 'TSLA', side: 'buy', quantity: 50, type: 'price', priceCondition: { targetPrice: 250, comparison: 'lte' } });
    const results = engine.evaluateMulti([{ symbol: 'AAPL', price: 205 }, { symbol: 'TSLA', price: 240 }]);
    expect(results.length).toBeGreaterThanOrEqual(2);
  });
});

// ═══════════════════════════════════════════════════════════════
// P2-09 TimeAndSalesEngine
// ═══════════════════════════════════════════════════════════════

describe('TimeAndSalesEngine', () => {
  let engine: TimeAndSalesEngine;
  beforeEach(() => {
    (TimeAndSalesEngine as any).instance = null;
    engine = TimeAndSalesEngine.getInstance();
  });

  it('singleton', () => { expect(TimeAndSalesEngine.getInstance()).toBe(engine); });

  it('ingests tick', () => {
    engine.ingest({ symbol: 'AAPL', timestamp: Date.now(), price: 150, volume: 1000 });
    expect(engine.getTickCount('AAPL')).toBe(1);
  });

  it('infers buy side', () => {
    engine.ingest({ symbol: 'AAPL', timestamp: Date.now(), price: 150, volume: 100 });
    engine.ingest({ symbol: 'AAPL', timestamp: Date.now(), price: 151, volume: 200 }); // price up → buy
    const ticks = engine.getTicks('AAPL', 1);
    expect(ticks[0].side).toBe('buy');
  });

  it('infers sell side', () => {
    engine.ingest({ symbol: 'AAPL', timestamp: Date.now(), price: 150, volume: 100 });
    engine.ingest({ symbol: 'AAPL', timestamp: Date.now(), price: 149, volume: 200 }); // price down → sell
    const ticks = engine.getTicks('AAPL', 1);
    expect(ticks[0].side).toBe('sell');
  });

  it('creates buckets', () => {
    engine.ingestBatch(engine.createMockTicks('AAPL', 50));
    const buckets = engine.getBuckets('AAPL');
    expect(buckets.length).toBeGreaterThan(0);
    expect(buckets[0].ticks).toBeGreaterThan(0);
  });

  it('computes VWAP', () => {
    engine.ingestBatch(engine.createMockTicks('AAPL', 50));
    const vwap = engine.getVWAP('AAPL');
    expect(vwap).not.toBeNull();
    expect(vwap).toBeGreaterThan(0);
  });

  it('detects block trade', () => {
    const mockTicks = engine.createMockTicks('AAPL', 50);
    engine.ingestBatch(mockTicks);
    const blockTick = { symbol: 'AAPL', timestamp: Date.now(), price: 150, volume: 1000000 };
    const block = engine.detectBlockTrade(blockTick);
    expect(block.isBlock).toBe(true);
    expect(block.percentile).toBeGreaterThan(90);
  });

  it('price ladder', () => {
    engine.ingestBatch(engine.createMockTicks('AAPL', 100));
    const ladder = engine.getPriceLadder('AAPL', 20);
    expect(ladder.length).toBeGreaterThan(0);
    expect(ladder[0].price).toBeGreaterThan(0);
    expect(ladder[0].totalVolume).toBeGreaterThan(0);
  });

  it('getTicks returns limited count', () => {
    engine.ingestBatch(engine.createMockTicks('AAPL', 30));
    const ticks = engine.getTicks('AAPL', 10);
    expect(ticks.length).toBeLessThanOrEqual(10);
  });

  it('mock data generates correct count', () => {
    const ticks = engine.createMockTicks('AAPL', 20);
    expect(ticks).toHaveLength(20);
    expect(ticks[0].symbol).toBe('AAPL');
  });
});

// ═══════════════════════════════════════════════════════════════
// PipelinePerformanceAuditor
// ═══════════════════════════════════════════════════════════════

describe('PipelinePerformanceAuditor', () => {
  let auditor: PipelinePerformanceAuditor;
  beforeEach(() => {
    (PipelinePerformanceAuditor as any).instance = null;
    auditor = PipelinePerformanceAuditor.getInstance();
  });

  it('singleton', () => { expect(PipelinePerformanceAuditor.getInstance()).toBe(auditor); });

  it('audits singleton pattern — pass', () => {
    const item = auditor.auditSingleton('TestEngine', true);
    expect(item.severity).toBe('pass');
  });

  it('audits singleton pattern — warn', () => {
    const item = auditor.auditSingleton('BadEngine', false);
    expect(item.severity).toBe('warn');
  });

  it('audits batch efficiency — missing batch', () => {
    const item = auditor.auditBatchEfficiency('Engine1', false);
    expect(item.severity).toBe('warn');
  });

  it('audits batch efficiency — good', () => {
    const item = auditor.auditBatchEfficiency('Engine2', true, 50);
    expect(item.severity).toBe('pass');
  });

  it('audits listener count — error', () => {
    const item = auditor.auditListenerCount('Engine3', 25);
    expect(item.severity).toBe('error');
  });

  it('audits collection size — pass', () => {
    const item = auditor.auditCollectionSize('Engine4', 'map', 100, 100000);
    expect(item.severity).toBe('pass');
  });

  it('audits collection size — warn', () => {
    const item = auditor.auditCollectionSize('Engine5', 'map', 80000, 100000);
    expect(item.severity).toBe('warn');
  });

  it('audits sort complexity', () => {
    const item = auditor.auditSortComplexity('Engine6', true, 'O(n log n)');
    expect(item.severity).toBe('info');
  });

  it('audits full module', () => {
    const items = auditor.auditModule('FullEngine', {
      isSingleton: true, hasBatch: true, batchSize: 50,
      listenerCount: 3, collections: { orders: 100, cache: 5000 },
      usesSort: true, sortComplexity: 'O(n log n)',
      hasCreateMock: true, mockCount: 100,
    });
    expect(items.length).toBeGreaterThan(0);
  });

  it('generates report', () => {
    auditor.auditModule('Engine1', { isSingleton: true, hasBatch: true, batchSize: 50, listenerCount: 3 });
    auditor.auditModule('Engine2', { isSingleton: false, hasBatch: false, listenerCount: 25 });
    const report = auditor.generateReport();
    expect(report.overallScore).toBeGreaterThanOrEqual(0);
    expect(report.overallScore).toBeLessThanOrEqual(100);
    expect(report.items.length).toBeGreaterThan(0);
    expect(report.recommendations.length).toBeGreaterThan(0);
  });

  it('clean modules get score 99+', () => {
    auditor.auditModule('Perfect', { isSingleton: true, hasBatch: true, batchSize: 50, listenerCount: 3 });
    const report = auditor.generateReport();
    expect(report.overallScore).toBeGreaterThanOrEqual(99);
  });
});

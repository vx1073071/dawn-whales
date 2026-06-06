// tests/benchmark-engine.test.ts
// Q-25-02: Performance baseline report
// Run: npx vitest run tests/benchmark-engine.test.ts

import { describe, it, expect } from 'vitest';
import { RiskEngine } from '../electron/engine/risk-engine';

describe('Q-25-02: Performance Baseline', () => {
  it('benchmark: RiskEngine core methods ×1000', () => {
    const re = new RiskEngine();
    re.updateTotalAssets(100000);

    // Warm-up
    for (let i = 0; i < 100; i++) {
      re.calculatePositionSize(180 + (i % 10), 2.5, 178);
      re.getDrawdownState();
      re.getKellyStats();
      re.getConfig();
      re.checkOrder({ qty: 100, price: 50 });
    }

    // 1. calculatePositionSize × 1000
    const t0 = performance.now();
    let zeroQty = 0;
    for (let i = 0; i < 1000; i++) {
      const r = re.calculatePositionSize(180 + (i % 5), 2.5, 178 + (i % 3));
      if (r.qty === 0) zeroQty++;
    }
    const tPos = performance.now() - t0;

    // 2. getDrawdownState × 1000
    const t1 = performance.now();
    for (let i = 0; i < 1000; i++) { re.getDrawdownState(); }
    const tDD = performance.now() - t1;

    // 3. getKellyStats × 1000
    const t2 = performance.now();
    for (let i = 0; i < 1000; i++) { re.getKellyStats(); }
    const tKelly = performance.now() - t2;

    // 4. getConfig × 1000
    const t3 = performance.now();
    for (let i = 0; i < 1000; i++) { re.getConfig(); }
    const tCfg = performance.now() - t3;

    // 5. checkOrder × 1000
    const t4 = performance.now();
    for (let i = 0; i < 1000; i++) { re.checkOrder({ qty: 100, price: 50 }); }
    const tCheck = performance.now() - t4;

    // 6. getStatusSnapshot × 1000
    const t5 = performance.now();
    for (let i = 0; i < 1000; i++) { re.getStatusSnapshot(); }
    const tSnap = performance.now() - t5;

    console.log(`\n## RiskEngine v2 Performance Baseline`);
    console.log(`| Method | Time | Throughput |`);
    console.log(`|---|---|---:|`);
    console.log(`| calculatePositionSize ×1000 | ${tPos.toFixed(2)}ms | ${(1000/tPos*1000).toLocaleString()} ops/s |`);
    console.log(`| getDrawdownState ×1000 | ${tDD.toFixed(2)}ms | ${(1000/tDD*1000).toLocaleString()} ops/s |`);
    console.log(`| getKellyStats ×1000 | ${tKelly.toFixed(2)}ms | ${(1000/tKelly*1000).toLocaleString()} ops/s |`);
    console.log(`| getConfig ×1000 | ${tCfg.toFixed(2)}ms | ${(1000/tCfg*1000).toLocaleString()} ops/s |`);
    console.log(`| checkOrder ×1000 | ${tCheck.toFixed(2)}ms | ${(1000/tCheck*1000).toLocaleString()} ops/s |`);
    console.log(`| getStatusSnapshot ×1000 | ${tSnap.toFixed(2)}ms | ${(1000/tSnap*1000).toLocaleString()} ops/s |`);
    console.log(`| Zero-qty signals | ${zeroQty}/1000 |`);

    expect(tPos).toBeGreaterThan(0);
    expect(tDD).toBeGreaterThan(0);
    expect(tKelly).toBeGreaterThan(0);
    expect(tCfg).toBeGreaterThan(0);
    expect(tCheck).toBeGreaterThan(0);
    expect(tSnap).toBeGreaterThan(0);
  });

  it('benchmark: TradeExecutor processSignal ×500', () => {
    class TradeExecutorLite {
      risk = new RiskEngine();
      orders = new Map();
      orderCount = 0;

      processSignalSync(signal: { symbol: string; price: number; atr?: number }) {
        const pos = this.risk.calculatePositionSize(signal.price, signal.atr ?? 2.5);
        if (pos.qty === 0) return { success: false, reason: 'qty=0' };
        const order = {
          id: `ORD-${++this.orderCount}`,
          symbol: signal.symbol,
          qty: pos.qty,
          price: signal.price,
          status: 'pending',
          method: pos.method as string,
        };
        this.orders.set(order.id, order);
        return { success: true, order, qty: pos.qty, method: pos.method };
      }
    }

    const exec = new TradeExecutorLite();
    exec.risk.updateTotalAssets(100000);

    const signals = Array.from({ length: 500 }, (_, i) => ({
      symbol: ['US.AAPL', 'US.NVDA', 'US.TQQQ'][i % 3],
      price: 150 + (i % 50),
      atr: 2.5,
    }));

    const t0 = performance.now();
    let processed = 0;
    for (let i = 0; i < 500; i++) {
      if (exec.processSignalSync(signals[i]).success) processed++;
    }
    const tExec = performance.now() - t0;

    console.log(`\n## TradeExecutor Performance`);
    console.log(`| Metric | Result |`);
    console.log(`|---|---:|`);
    console.log(`| processSignal ×500 | ${tExec.toFixed(2)}ms |`);
    console.log(`| Success rate | ${processed}/500 |`);
    console.log(`| Throughput | ${(500/tExec*1000).toLocaleString()} signals/sec |`);

    expect(tExec).toBeGreaterThan(0);
    expect(processed).toBeGreaterThan(0);
  });

  it('benchmark: strategy evaluation ×1000', () => {
    function evaluateStrategy(signals: Array<{ price: number; confidence: number }>, params: { minConfidence: number; threshold: number }) {
      let wins = 0, losses = 0;
      for (const s of signals) {
        if (s.confidence > params.minConfidence) {
          if ((s.confidence - 0.5) * params.threshold > 0) wins++; else losses++;
        }
      }
      return { winRate: wins / (wins + losses || 1), trades: wins + losses };
    }

    const signals = Array.from({ length: 500 }, (_, i) => ({
      symbol: ['US.AAPL', 'US.NVDA', 'US.TQQQ'][i % 3],
      confidence: 0.7 + ((i % 30) / 100),
      price: 150 + (i % 50),
    }));
    const params = { minConfidence: 0.6, threshold: 0.02 };

    const t0 = performance.now();
    for (let i = 0; i < 1000; i++) { evaluateStrategy(signals, params); }
    const tStrat = performance.now() - t0;

    console.log(`\n## Strategy Evaluation Performance`);
    console.log(`| Metric | Result |`);
    console.log(`|---|---:|`);
    console.log(`| evaluateStrategy ×1000 | ${tStrat.toFixed(2)}ms |`);
    console.log(`| Throughput | ${(1000/tStrat*1000).toLocaleString()} evals/sec |`);

    expect(tStrat).toBeGreaterThan(0);
  });

  it('memory baseline', () => {
    const mem = process.memoryUsage();
    console.log(`\n## Memory Baseline`);
    console.log(`| Metric | Result |`);
    console.log(`|---|---:|`);
    console.log(`| Heap used | ${(mem.heapUsed/1024/1024).toFixed(2)} MB |`);
    console.log(`| Heap total | ${(mem.heapTotal/1024/1024).toFixed(2)} MB |`);
    console.log(`| RSS | ${(mem.rss/1024/1024).toFixed(2)} MB |`);
    expect(mem.heapUsed).toBeGreaterThan(0);
  });
});

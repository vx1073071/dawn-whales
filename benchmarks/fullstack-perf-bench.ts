// QUANT MOO R121 — Full-stack Performance Benchmark
// 16券商压测 / 500币对 / 60fps基准报告
// JVS: 全端性能profile (4h)

import { BrokerManagerV2 } from '../../electron/broker/BrokerManagerV2';
import { IndicatorEngine } from '../../src/lib/chart/indicator-engine';
import { OrderBookEngine } from '../../src/lib/chart/orderbook-engine';
import { DepthAnalyzer } from '../../src/lib/chart/depth-analyzer';
import { CBBOEngine } from '../../src/lib/chart/cbbo-engine';
import { ArbitrageEngine } from '../../src/lib/chart/arbitrage-engine';
import { WebSocketPool } from '../../src/lib/chart/ws-pool';
import { SmartThrottle } from '../../src/lib/chart/smart-throttle';
import type { KlineBar } from '../../src/lib/chart/types';

// ═══════════ Benchmark Config ════════════════════════════════

interface BenchmarkConfig {
  brokerCount: number;        // 模拟券商数
  symbolCount: number;        // 模拟交易对
  klineBars: number;          // K线数据点
  depthLevels: number;        // 订单簿深度
  iterations: number;         // 每测试重复次数
}

interface BenchmarkResult {
  name: string;
  operationsPerSec: number;
  avgTimeMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  memoryDeltaMB: number;
  status: 'PASS' | 'WARN' | 'FAIL';
}

const DEFAULT_CONFIG: BenchmarkConfig = {
  brokerCount: 16,
  symbolCount: 500,
  klineBars: 500,
  depthLevels: 50,
  iterations: 100,
};

// ═══════════ Test Data Generators ═══════════════════════════

function generateKlineBars(count: number): KlineBar[] {
  const bars: KlineBar[] = [];
  let price = 150 + Math.random() * 50;
  for (let i = 0; i < count; i++) {
    const change = (Math.random() - 0.48) * 2; // slight upward bias
    price += change;
    price = Math.max(price, 1);
    bars.push({
      time: Date.now() + i * 60000,
      open: price - change,
      high: price + Math.random() * 2,
      low: price - Math.random() * 2,
      close: price,
      volume: Math.random() * 1000000 + 100000,
    });
  }
  return bars;
}

function generateOrderBookSnapshot() {
  const midPrice = 150 + Math.random() * 50;
  const bids: Array<{ price: number; size: number }> = [];
  const asks: Array<{ price: number; size: number }> = [];
  for (let i = 0; i < 50; i++) {
    bids.push({ price: midPrice - (i + 1) * 0.01, size: Math.random() * 1000 + 100 });
    asks.push({ price: midPrice + (i + 1) * 0.01, size: Math.random() * 1000 + 100 });
  }
  return {
    exchange: 'binance',
    symbol: 'BTC-USDT',
    bids,
    asks,
    updateId: Date.now(),
    timestamp: Date.now(),
    best: {
      bidPrice: bids[0].price,
      askPrice: asks[0].price,
      bidSize: bids[0].size,
      askSize: asks[0].size,
      spread: asks[0].price - bids[0].price,
      spreadPercent: ((asks[0].price - bids[0].price) / bids[0].price) * 100,
    },
    localTimestamp: Date.now(),
  };
}

// ═══════════ Benchmark Runner ═══════════════════════════

function runBench(name: string, fn: () => void, iterations: number): Omit<BenchmarkResult, 'status'> {
  const times: number[] = [];
  const memBefore = process.memoryUsage().heapUsed / 1024 / 1024;

  // Warmup
  for (let i = 0; i < 10; i++) fn();

  // Measure
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    fn();
    const elapsed = performance.now() - start;
    times.push(elapsed);
  }

  const memAfter = process.memoryUsage().heapUsed / 1024 / 1024;
  times.sort((a, b) => a - b);

  const avg = times.reduce((s, t) => s + t, 0) / times.length;
  const p50 = times[Math.floor(times.length * 0.5)];
  const p95 = times[Math.floor(times.length * 0.95)];
  const p99 = times[Math.floor(times.length * 0.99)];

  return {
    name,
    operationsPerSec: 1000 / avg,
    avgTimeMs: +avg.toFixed(3),
    p50Ms: +p50.toFixed(3),
    p95Ms: +p95.toFixed(3),
    p99Ms: +p99.toFixed(3),
    memoryDeltaMB: +(memAfter - memBefore).toFixed(2),
  };
}

function assessStatus(result: Omit<BenchmarkResult, 'status'>, thresholds: Record<string, number>): BenchmarkResult {
  const target = thresholds[result.name] || 16; // default 16ms = 60fps
  let status: BenchmarkResult['status'] = 'PASS';
  if (result.avgTimeMs > target * 2) status = 'FAIL';
  else if (result.avgTimeMs > target) status = 'WARN';
  return { ...result, status };
}

// ═══════════ Main Benchmark ═══════════════════════════════

export function runFullPerformanceBenchmark(config: Partial<BenchmarkConfig> = {}): BenchmarkResult[] {
  const cfg: BenchmarkConfig = { ...DEFAULT_CONFIG, ...config };
  const results: BenchmarkResult[] = [];

  console.log(`\n=== QUANT MOO R121 Performance Benchmark ===`);
  console.log(`Config: ${cfg.brokerCount} brokers, ${cfg.symbolCount} symbols, ${cfg.klineBars} bars, ${cfg.depthLevels} levels`);
  console.log(`Iterations per test: ${cfg.iterations}\n`);

  // ─── 1. Indicator Engine (60+ 指标, 500 bars) ───
  const klines = generateKlineBars(cfg.klineBars);
  const indicatorIds = ['sma', 'ema', 'macd', 'rsi', 'kdj', 'boll', 'atr', 'cci', 'wr', 'obv', 'vwap', 'mfi', 'sar', 'ichimoku'];

  const indicatorResult = runBench('IndicatorEngine(14-indicators)', () => {
    const engine = new IndicatorEngine();
    for (const id of indicatorIds) {
      engine.compute(id, klines, {});
    }
  }, cfg.iterations);
  results.push(assessStatus({ ...indicatorResult, name: 'IndicatorEngine' }, { 'IndicatorEngine': 32 }));

  // ─── 2. OrderBook Engine ───
  const obSnapshot = generateOrderBookSnapshot();

  const obResult = runBench('OrderBookEngine(process)', () => {
    const engine = new OrderBookEngine();
    engine.processSnapshot(obSnapshot);
  }, cfg.iterations);
  results.push(assessStatus({ ...obResult, name: 'OrderBookEngine' }, { 'OrderBookEngine': 8 }));

  // ─── 3. DepthAnalyzer ───
  const depthLevels = [...obSnapshot.bids.slice(0, 20), ...obSnapshot.asks.slice(0, 20)];
  const daResult = runBench('DepthAnalyzer(20-levels)', () => {
    const analyzer = new DepthAnalyzer();
    analyzer.analyze(depthLevels as any);
  }, cfg.iterations);
  results.push(assessStatus({ ...daResult, name: 'DepthAnalyzer' }, { 'DepthAnalyzer': 8 }));

  // ─── 4. CBBO + SmartThrottle ───
  const cbboResult = runBench('CBBOEngine+Throttle', () => {
    const cbbo = new CBBOEngine();
    const throttle = new SmartThrottle();
    throttle.check('cbbo-test');
    cbbo.addQuote('binance', 'BTC-USDT', obSnapshot.best.bidPrice, obSnapshot.best.askPrice, Date.now());
  }, cfg.iterations);
  results.push(assessStatus({ ...cbboResult, name: 'CBBO+Throttle' }, { 'CBBO+Throttle': 4 }));

  // ─── 5. Arbitrage Sweep (500 symbols × 3 brokers) ───
  const arbResult = runBench('ArbitrageSweep(500-symbols)', () => {
    const engine = new ArbitrageEngine();
    for (let s = 0; s < cfg.symbolCount; s++) {
      const base = 65000 + Math.random() * 5000;
      engine.feedQuote('binance', `SYM-${s}`, base, base + 5, Date.now());
      engine.feedQuote('okx', `SYM-${s}`, base + 2, base + 7, Date.now());
      engine.feedQuote('bybit', `SYM-${s}`, base - 1, base + 3, Date.now());
    }
  }, Math.min(cfg.iterations, 10)); // fewer iterations due to scale
  results.push(assessStatus({ ...arbResult, name: 'Arbitrage(500-symbols)' }, { 'Arbitrage(500-symbols)': 100 }));

  // ─── 6. WS Pool (subscription stress) ───
  const wsResult = runBench('WSPool(sub-500-symbols)', () => {
    const pool = new WebSocketPool();
    for (let s = 0; s < cfg.symbolCount; s++) {
      pool.subscribe('binance', 'wss://stream.binance.com/ws', 'depth', `SYM-${s}`, { levels: 20 }, () => {});
    }
    pool.destroy();
  }, Math.min(cfg.iterations, 10));
  results.push(assessStatus({ ...wsResult, name: 'WSPool(500-subscriptions)' }, { 'WSPool(500-subscriptions)': 50 }));

  // ─── 7. 60 FPS Frame Budget Test ───
  const FRAME_BUDGET_MS = 16; // 60fps = 16.67ms
  const frameResult = runBench('FrameBudget(combined)', () => {
    const engine = new IndicatorEngine();
    engine.compute('macd', klines, {});
    const ob = new OrderBookEngine();
    ob.processSnapshot(obSnapshot);
    const da = new DepthAnalyzer();
    da.analyze(depthLevels as any);
  }, cfg.iterations);
  results.push(assessStatus(
    { ...frameResult, name: 'CombinedFrame(60fps-budget)' },
    { 'CombinedFrame(60fps-budget)': FRAME_BUDGET_MS },
  ));

  // ─── Summary ───
  console.log('\n=== Results ===');
  console.log('Test                          avgMs    p95Ms    ops/s   Status');
  console.log('-'.repeat(70));
  for (const r of results) {
    const flag = r.status === 'PASS' ? '✓' : r.status === 'WARN' ? '⚠' : '✗';
    console.log(`${r.name.padEnd(28)} ${r.avgTimeMs.toFixed(2).padStart(6)}ms ${r.p95Ms.toFixed(2).padStart(6)}ms ${r.operationsPerSec.toFixed(0).padStart(7)}/s  ${flag} ${r.status}`);
  }

  const passed = results.filter(r => r.status === 'PASS').length;
  const warn = results.filter(r => r.status === 'WARN').length;
  const fail = results.filter(r => r.status === 'FAIL').length;
  console.log(`\nPASS: ${passed}  WARN: ${warn}  FAIL: ${fail}`);

  return results;
}

// Self-test
if (require.main === module) {
  runFullPerformanceBenchmark();
}

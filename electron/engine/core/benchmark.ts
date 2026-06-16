// ── QUANT MOO — Performance Benchmark (J1: Backtest Engine) ──────────────
// backtest enginethroughput

import { BacktestEngine } from '../backtest/backtest-engine';
import { BacktestEnhancer } from '../backtest/backtest-enhancer';
import { performance } from 'perf_hooks';

interface BenchResult {
  name: string;
  bars: number;
  durationMs: number;
  throughput: number; // bars/sec
  memMB: number;
}

export async function runBenchmarks(): Promise<BenchResult[]> {
  const results: BenchResult[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const engine = new BacktestEngine(null as any); // Engine uses klines inline, no DB needed

  const sizes = [50, 100, 200, 500, 1000, 2000, 5000];
  const configs = [
    { type: 'ma_cross', fast: 5, slow: 20 },
    { type: 'rsi', oversold: 30, overbought: 70 },
    { type: 'macd', fast: 12, slow: 26, signal: 9 },
    { type: 'bollinger', period: 20, stddev: 2 },
  ];

  for (const size of sizes) {
    const klines = generateBenchKlines(size);

    for (const cfg of configs) {
      const memBefore = process.memoryUsage().heapUsed / 1024 / 1024;
      const start = performance.now();

      const config = {
        strategyId: cfg.type,
        symbol: 'US.BENCH',
        period: 'daily',
        initialCapital: 100000,
        klines,
      };

      await engine.run(config);

      const duration = performance.now() - start;
      const memAfter = process.memoryUsage().heapUsed / 1024 / 1024;

      results.push({
        name: `${cfg.type}_${size}bars`,
        bars: size,
        durationMs: Math.round(duration * 100) / 100,
        throughput: Math.round((size / (duration / 1000))),
        memMB: Math.round((memAfter - memBefore) * 100) / 100,
      });
    }
  }

  return results;
}

export async function runEnhancerBenchmarks(): Promise<BenchResult[]> {
  const results: BenchResult[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const engine = new BacktestEngine(null as any);
  const enhancer = new BacktestEnhancer(engine);
  const klines = generateBenchKlines(500);

  // Multi-period
  const periods = [
    { label: 'Q1', startIdx: 0, endIdx: 125 },
    { label: 'Q2', startIdx: 125, endIdx: 250 },
    { label: 'Q3', startIdx: 250, endIdx: 375 },
    { label: 'Q4', startIdx: 375, endIdx: 499 },
  ];

  const start = performance.now();
  await enhancer.multiPeriodBacktest(klines, { strategyId: 'ma_cross', symbol: 'US.BENCH' }, periods);
  results.push({
    name: 'multi_period_500bars',
    bars: 500,
    durationMs: Math.round((performance.now() - start) * 100) / 100,
    throughput: 0,
    memMB: 0,
  });

  // Parameter sweep
  const paramStart = performance.now();
  await enhancer.parameterSweep(klines, { strategyId: 'ma_cross', symbol: 'US.BENCH' }, {
    fastPeriod: { min: 3, max: 20, step: 2 },
    slowPeriod: { min: 10, max: 60, step: 5 },
  }, 50);
  results.push({
    name: 'param_sweep_50combos',
    bars: 500,
    durationMs: Math.round((performance.now() - paramStart) * 100) / 100,
    throughput: 0,
    memMB: 0,
  });

  // Walk-forward
  const wfaStart = performance.now();
  await enhancer.walkForwardAnalysis(klines, { strategyId: 'ma_cross', symbol: 'US.BENCH' }, {
    fastPeriod: { min: 3, max: 15, step: 3 },
    slowPeriod: { min: 10, max: 40, step: 10 },
  }, 200, 100, 3);
  results.push({
    name: 'wfa_3windows',
    bars: 500,
    durationMs: Math.round((performance.now() - wfaStart) * 100) / 100,
    throughput: 0,
    memMB: 0,
  });

  return results;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function generateBenchKlines(count: number): any[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const klines: any[] = [];
  let price = 100;
  const now = Math.floor(Date.now() / 1000);
  for (let i = 0; i < count; i++) {
    const change = (Math.random() - 0.48) * 0.03 * price;
    price += change;
    klines.push({
      time: now - (count - i) * 86400,
      open: price,
      high: price * (1 + Math.random() * 0.02),
      low: price * (1 - Math.random() * 0.02),
      close: price,
      volume: 1000000 + Math.random() * 5000000,
    });
  }
  return klines;
}

#!/usr/bin/env node
// Performance benchmark for backtest engine v2
// Target: 5000 bars < 500ms

import { BacktestEngine } from '../electron/engine/backtest-engine.js';

function generateKlines(count: number): any[] {
  const data: any[] = [];
  let price = 100;
  const now = Math.floor(Date.now() / 1000);
  const daySeconds = 86400;
  
  for (let i = 0; i < count; i++) {
    const volatility = 0.02;
    const change = (Math.random() - 0.5) * volatility * price * 2;
    const open = price;
    const close = price + change;
    const high = Math.max(open, close) + Math.random() * volatility * price * 0.5;
    const low = Math.min(open, close) - Math.random() * volatility * price * 0.5;
    const volume = Math.floor(1000000 + Math.random() * 5000000);
    
    data.push({
      time: now - (count - i) * daySeconds,
      open: +open.toFixed(2),
      high: +high.toFixed(2),
      low: +low.toFixed(2),
      close: +close.toFixed(2),
      volume,
    });
    price = close;
  }
  return data;
}

const strategies = [
  { type: 'ma_cross', params: { shortPeriod: 10, longPeriod: 30 } },
  { type: 'rsi', params: { rsiPeriod: 14, oversold: 30, overbought: 70 } },
  { type: 'macd', params: { macdFast: 12, macdSlow: 26, macdSignal: 9 } },
  { type: 'momentum', params: { lookback: 20, threshold: 5 } },
  { type: 'bollinger', params: { bbPeriod: 20, bbStdDev: 2 } },
];

const barCounts = [200, 500, 1000, 2000, 5000];

async function runBenchmark() {
  console.log('=== Backtest Engine v2 Performance Benchmark ===\n');
  
  const results: any[] = [];
  
  for (const barCount of barCounts) {
    const klines = generateKlines(barCount);
    
    for (const strategy of strategies) {
      const engine = new BacktestEngine();
      const t0 = performance.now();
      
      const result = await engine.run({
        symbol: 'US.TQQQ',
        initialCapital: 100000,
        commission: 0.001,
        slippage: 0.0005,
        strategy: strategy as any,
        klines,
      });
      
      const elapsed = performance.now() - t0;
      
      results.push({
        bars: barCount,
        strategy: strategy.type,
        ms: Math.round(elapsed * 10) / 10,
        trades: result.result?.totalTrades || 0,
        return: result.result?.totalReturn || 0,
      });
    }
  }
  
  // Print results table
  console.log('Bars   | Strategy   | Time(ms) | Trades | Return(%)');
  console.log('-------|------------|----------|--------|----------');
  
  for (const r of results) {
    const bars = String(r.bars).padEnd(6);
    const strategy = r.strategy.padEnd(10);
    const ms = String(r.ms).padEnd(8);
    const trades = String(r.trades).padEnd(6);
    const ret = r.return.toFixed(2).padEnd(8);
    console.log(`${bars} | ${strategy} | ${ms} | ${trades} | ${ret}`);
  }
  
  // Check 5K target
  const fiveKResults = results.filter(r => r.bars === 5000);
  const maxTime = Math.max(...fiveKResults.map(r => r.ms));
  const avgTime = fiveKResults.reduce((s, r) => s + r.ms, 0) / fiveKResults.length;
  
  console.log('\n=== 5000 bars Summary ===');
  console.log(`Max time: ${maxTime}ms`);
  console.log(`Avg time: ${Math.round(avgTime * 10) / 10}ms`);
  console.log(`Target: < 500ms`);
  console.log(`Status: ${maxTime < 500 ? 'PASS ✅' : 'FAIL ❌'}`);
}

runBenchmark().catch(console.error);

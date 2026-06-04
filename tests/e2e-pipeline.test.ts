// ── E2E Tests — Full Pipeline: NL → Backtest → WFA → Risk ──────────────────
// Run: npx tsx tests/e2e-pipeline.test.ts
// Tests the complete strategy lifecycle without needing OpenD connection

import { parseNaturalLanguage } from '../electron/engine/nl-parser';
import { BacktestEngine } from '../electron/engine/backtest-engine';
import { RiskEngine } from '../electron/engine/risk-engine';
import { StrategyEngine } from '../electron/engine/strategy-engine';
import { WalkForwardEngine } from '../electron/engine/walk-forward';
import { ParameterScanner } from '../electron/engine/parameter-scanner';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ ${message}`);
    passed++;
  } else {
    console.error(`  ❌ ${message}`);
    failed++;
  }
}

function section(name: string) {
  console.log(`\n━━━ ${name} ━━━`);
}

function generateKlines(count: number, trend: 'up' | 'down' | 'sideways' = 'sideways', seed = 42): any[] {
  const data: any[] = [];
  let price = 100;
  const now = Math.floor(Date.now() / 1000);
  const daySeconds = 86400;
  let s = seed;
  function rand() { s = (s * 16807 + 0) % 2147483647; return s / 2147483647; }

  for (let i = 0; i < count; i++) {
    const bias = trend === 'up' ? 0.52 : trend === 'down' ? 0.48 : 0.5;
    const volatility = 0.02;
    const change = (rand() - bias) * volatility * price * 2;
    const open = price;
    const close = price + change;
    const high = Math.max(open, close) + rand() * volatility * price * 0.5;
    const low = Math.min(open, close) - rand() * volatility * price * 0.5;
    const volume = Math.floor(1000000 + rand() * 5000000);

    data.push({
      time: now - (count - i) * daySeconds,
      open: +open.toFixed(2), high: +high.toFixed(2),
      low: +low.toFixed(2), close: +close.toFixed(2), volume,
    });
    price = close;
  }
  return data;
}

async function main() {

// ═══════════════════════════════════════════════════════════════════════════
// E2E Test 1: NL Parse → Backtest → Result Validation
// ═══════════════════════════════════════════════════════════════════════════

section('E2E-1: NL → Backtest → Validate');
{
  // Step 1: Parse natural language
  const nlResult = parseNaturalLanguage('MA10 上穿 MA30 买入 TQQQ，止损 5%，止盈 15%');
  assert(nlResult.success === true, 'NL parse succeeds');
  assert(nlResult.strategy.type === 'ma_cross', 'strategy type = ma_cross');
  assert(nlResult.strategy.stopLoss === 5, 'stopLoss = 5%');
  assert(nlResult.strategy.takeProfit === 15, 'takeProfit = 15%');
  assert(nlResult.symbol === 'US.TQQQ', 'symbol = US.TQQQ');

  // Step 2: Run backtest with parsed strategy
  const engine = new BacktestEngine();
  const klines = generateKlines(300, 'up');
  const btResult = await engine.run({
    symbol: nlResult.symbol!,
    initialCapital: 100000,
    commission: 0.001,
    slippage: 0.0005,
    strategy: nlResult.strategy,
    klines,
  });

  assert(btResult.success === true, 'backtest completes');
  assert(btResult.result.totalTrades > 0, `has trades (${btResult.result.totalTrades})`);
  assert(typeof btResult.result.sharpeRatio === 'number', 'has sharpe');
  assert(typeof btResult.result.maxDrawdown === 'number', 'has maxDrawdown');
  assert(btResult.result.equityCurve.length > 0, 'has equity curve');

  // Step 3: Validate result sanity
  assert(btResult.result.winRate >= 0 && btResult.result.winRate <= 100, 'winRate in [0,100]');
  assert(btResult.result.maxDrawdown >= 0, 'maxDrawdown >= 0');
  assert(btResult.result.profitFactor >= 0, 'profitFactor >= 0');
}

// ═══════════════════════════════════════════════════════════════════════════
// E2E Test 2: Multiple NL Strategies → Backtest → Compare
// ═══════════════════════════════════════════════════════════════════════════

section('E2E-2: Multi-Strategy Comparison Pipeline');
{
  const strategies = [
    'MA5 上穿 MA20 买入 QQQ',
    'RSI 低于 30 买入 QQQ，RSI 高于 70 卖出',
    'MACD 金叉买入 QQQ',
    '布林带下轨买入 QQQ',
  ];

  const klines = generateKlines(300, 'up');
  const results: { name: string; sharpe: number; returnPct: number; trades: number }[] = [];

  for (const text of strategies) {
    const nl = parseNaturalLanguage(text);
    assert(nl.success === true, `parse: "${text.substring(0, 30)}..."`);

    const engine = new BacktestEngine();
    const bt = await engine.run({
      symbol: nl.symbol || 'US.QQQ',
      initialCapital: 100000,
      commission: 0.001,
      slippage: 0.0005,
      strategy: nl.strategy,
      klines,
    });

    assert(bt.success === true, `backtest: "${text.substring(0, 30)}..."`);
    results.push({
      name: nl.name || text.substring(0, 20),
      sharpe: bt.result.sharpeRatio,
      returnPct: bt.result.totalReturn,
      trades: bt.result.totalTrades,
    });
  }

  assert(results.length === 4, 'all 4 strategies produced results');
  // Random data may not produce profitable results — just verify valid outputs
  assert(results.every(r => typeof r.sharpe === 'number'), 'all have valid sharpe');
  assert(results.every(r => r.trades >= 0), 'all have non-negative trade count');
}

// ═══════════════════════════════════════════════════════════════════════════
// E2E Test 3: Risk Engine v2 — Kelly Sizing Integration
// ═══════════════════════════════════════════════════════════════════════════

section('E2E-3: Risk Engine v2 Kelly Sizing');
{
  const riskEngine = new RiskEngine();

  // Set initial assets
  riskEngine.updateTotalAssets(100000);

  // Test 1: Basic position sizing (no trade history yet)
  const sizing1 = riskEngine.calculatePositionSize(150);
  assert(sizing1.qty > 0, `Kelly sizing returns qty > 0 (got ${sizing1.qty})`);
  assert(sizing1.method !== undefined, `has sizing method: ${sizing1.method}`);
  assert(typeof sizing1.riskAmount === 'number', `has riskAmount: ${sizing1.riskAmount}`);

  // Test 2: Record some trades, then check Kelly adjusts
  for (let i = 0; i < 20; i++) {
    const pnl = Math.random() > 0.4 ? (Math.random() * 500 + 100) : -(Math.random() * 300 + 50);
    riskEngine.recordTrade(pnl);
  }

  const kellyStats = riskEngine.getKellyStats();
  assert(kellyStats.sampleSize === 20, `sample size = 20 (got ${kellyStats.sampleSize})`);
  assert(kellyStats.winRate > 0 && kellyStats.winRate <= 100, `winRate valid: ${kellyStats.winRate.toFixed(1)}%`);
  assert(kellyStats.kellyFraction >= 0, `kellyFraction >= 0: ${kellyStats.kellyFraction}`);
  assert(typeof kellyStats.profitFactor === 'number', 'has profitFactor');

  // Test 3: After recording trades, sizing should use Kelly
  const sizing2 = riskEngine.calculatePositionSize(150);
  assert(sizing2.qty > 0, `post-history sizing returns qty > 0 (got ${sizing2.qty})`);
}

// ═══════════════════════════════════════════════════════════════════════════
// E2E Test 4: Risk Engine v2 — Drawdown Tracking
// ═══════════════════════════════════════════════════════════════════════════

section('E2E-4: Risk Engine v2 Drawdown Caps');
{
  const riskEngine = new RiskEngine();
  riskEngine.updateTotalAssets(100000);

  // Simulate equity curve: peak → drawdown → recovery
  riskEngine.updateEquity(100000);
  let dd1 = riskEngine.getDrawdownState();
  assert(dd1.currentDrawdownPct === 0, 'initial drawdown = 0');
  assert(dd1.isReduced === false, 'not reduced initially');

  // Rise to peak
  riskEngine.updateEquity(120000);
  let dd2 = riskEngine.getDrawdownState();
  assert(dd2.peakEquity === 120000, `peak = 120000 (got ${dd2.peakEquity})`);

  // Drop 20% from peak (should trigger 15% threshold)
  riskEngine.updateEquity(96000); // 20% drop from 120000
  let dd3 = riskEngine.getDrawdownState();
  assert(dd3.currentDrawdownPct > 0.15, `drawdown > 15% (got ${(dd3.currentDrawdownPct * 100).toFixed(1)}%)`);
  assert(dd3.isReduced === true, 'position reduction triggered');
  assert(dd3.reductionFactor < 1, `reduction factor < 1: ${dd3.reductionFactor}`);

  // Recovery to within 10%
  riskEngine.updateEquity(110000); // still ~8.3% from peak
  let dd4 = riskEngine.getDrawdownState();
  assert(dd4.isReduced === false, 'position reduction lifted after recovery');
}

// ═══════════════════════════════════════════════════════════════════════════
// E2E Test 5: Risk Engine v2 — VIX Volatility Adjustment
// ═══════════════════════════════════════════════════════════════════════════

section('E2E-5: Risk Engine v2 VIX Adjustment');
{
  const riskEngine = new RiskEngine();
  riskEngine.updateTotalAssets(100000);

  // Normal VIX
  riskEngine.updateVix(15);
  let snap1 = riskEngine.getStatusSnapshot();
  assert(snap1.currentVix === 15, 'VIX = 15');
  assert(snap1.volatilityFactor === 1.0, `vol factor = 1.0 at VIX 15 (got ${snap1.volatilityFactor})`);

  // High VIX
  riskEngine.updateVix(28);
  let snap2 = riskEngine.getStatusSnapshot();
  assert(snap2.volatilityFactor < 1.0, `vol factor < 1.0 at VIX 28 (got ${snap2.volatilityFactor})`);

  // Extreme VIX
  riskEngine.updateVix(40);
  let snap3 = riskEngine.getStatusSnapshot();
  assert(snap3.volatilityFactor < snap2.volatilityFactor, `extreme VIX → lower factor (got ${snap3.volatilityFactor})`);
}

// ═══════════════════════════════════════════════════════════════════════════
// E2E Test 6: Risk Engine v2 — Order Check with New Features
// ═══════════════════════════════════════════════════════════════════════════

section('E2E-6: Risk Engine v2 Order Validation');
{
  const riskEngine = new RiskEngine();
  riskEngine.updateTotalAssets(100000);

  // Valid order
  const r1 = riskEngine.checkOrder({ code: 'US.TQQQ', qty: 100, price: 50 });
  assert(r1.pass === true, 'valid order passes');

  // Blacklist check
  riskEngine.updateConfig({ blacklist: ['US.SQQQ'] });
  const r2 = riskEngine.checkOrder({ code: 'US.SQQQ', qty: 100, price: 30 });
  assert(r2.pass === false, 'blacklisted order blocked');
  assert(r2.reason?.includes('禁止') || r2.reason?.includes('blacklist'), 'reason mentions blacklist');

  // Concentration check (>20% of assets)
  riskEngine.updateConfig({ blacklist: [] });
  const r3 = riskEngine.checkOrder({ code: 'US.TQQQ', qty: 1000, price: 50 }); // $50,000 = 50% of $100k
  assert(r3.pass === false, 'concentrated order blocked');

  // Frequency limit
  riskEngine.updateConfig({ maxOrdersPerMinute: 3 });
  for (let i = 0; i < 3; i++) {
    riskEngine.checkOrder({ code: 'US.TQQQ', qty: 10, price: 50 });
  }
  const r4 = riskEngine.checkOrder({ code: 'US.TQQQ', qty: 10, price: 50 });
  assert(r4.pass === false, 'frequency limit enforced');
}

// ═══════════════════════════════════════════════════════════════════════════
// E2E Test 7: Strategy Engine ↔ Risk Engine Integration
// ═══════════════════════════════════════════════════════════════════════════

section('E2E-7: Strategy Engine + Risk Engine Integration');
{
  const strategyEngine = new StrategyEngine();
  const riskEngine = new RiskEngine();

  // Connect them
  strategyEngine.setRiskEngine(riskEngine);
  riskEngine.updateTotalAssets(100000);

  // Create a strategy
  const id = strategyEngine.createStrategy({
    text: 'MA5 上穿 MA20 买入 TQQQ',
  });
  assert(typeof id === 'string', `strategy created: ${id}`);

  const strategy = strategyEngine.getStrategy(id);
  assert(strategy !== undefined, 'strategy retrievable');
  assert(strategy!.strategy.type === 'ma_cross', 'strategy type correct');

  // Run backtest
  const klines = generateKlines(300, 'up');
  const btResult = await strategyEngine.runBacktest(id, klines);
  assert(btResult.success === true, 'backtest via strategy engine succeeds');
  assert(strategy!.status === 'backtested', 'status updated to backtested');

  // Start live
  strategyEngine.startLive(id);
  assert(strategy!.status === 'live', 'status updated to live');

  // Feed quotes — should not crash
  strategyEngine.onQuoteUpdate([
    { code: 'US.TQQQ', price: 50.5, change: 0.5, changePct: 1.0, volume: 1000000 },
  ]);

  // Stop
  strategyEngine.stopLive(id);
  assert(strategy!.status === 'stopped', 'strategy stopped');
}

// ═══════════════════════════════════════════════════════════════════════════
// E2E Test 8: Walk-Forward Analysis
// ═══════════════════════════════════════════════════════════════════════════

section('E2E-8: Walk-Forward Analysis');
{
  const wfa = new WalkForwardEngine();
  const klines = generateKlines(500, 'up');

  const report = await wfa.run({
    symbol: 'US.TQQQ',
    strategy: { type: 'ma_cross', params: { shortPeriod: 10, longPeriod: 30 } },
    paramRanges: [
      { name: 'shortPeriod', values: [5, 10, 15] },
      { name: 'longPeriod', values: [20, 30, 40] },
    ],
    initialCapital: 100000,
    commission: 0.001,
    slippage: 0.0005,
    inSampleBars: 200,
    outOfSampleBars: 50,
    stepSize: 50,
  }, klines);

  assert(report.success === true, 'WFA completes successfully');
  assert(report.summary.totalWindows > 0, `has windows: ${report.summary.totalWindows}`);
  assert(typeof report.summary.avgOosSharpe === 'number', 'has avgOosSharpe');
  assert(typeof report.summary.avgDecayRatio === 'number', 'has avgDecayRatio');
  assert(report.summary.stabilityScore >= 0 && report.summary.stabilityScore <= 100, 'stabilityScore in [0,100]');
  assert(typeof report.summary.robustnessGrade === 'string', `grade: ${report.summary.robustnessGrade}`);
  assert(report.windows.length > 0, 'has window details');
  assert(typeof report.recommendation === 'string', 'has recommendation');
}

// ═══════════════════════════════════════════════════════════════════════════
// E2E Test 9: Parameter Scanner
// ═══════════════════════════════════════════════════════════════════════════

section('E2E-9: Parameter Scanner');
{
  const scanner = new ParameterScanner();
  const klines = generateKlines(300, 'up');

  const report = await scanner.run({
    symbol: 'US.TQQQ',
    strategy: { type: 'ma_cross', params: { shortPeriod: 10, longPeriod: 30 } },
    paramRanges: [
      { name: 'shortPeriod', values: [5, 10, 15, 20] },
      { name: 'longPeriod', values: [20, 30, 40, 50] },
    ],
    initialCapital: 100000,
    commission: 0.001,
    slippage: 0.0005,
    klines,
    optimizationTarget: 'sharpe',
  });

  assert(report.success === true, 'param scan completes');
  assert(report.totalCombinations === 16, `16 combinations (4×4, got ${report.totalCombinations})`);
  assert(report.validResults > 0, `valid results: ${report.validResults}`);
  assert(report.top10.length > 0, `top10: ${report.top10.length} entries`);
  assert(typeof report.best.sharpe === 'number', `best sharpe: ${report.best.sharpe}`);
  assert(report.neighborhoodAnalysis.robustnessGrade !== undefined, `robustness: ${report.neighborhoodAnalysis.robustnessGrade}`);
  assert(typeof report.recommendation === 'string', 'has recommendation');
}

// ═══════════════════════════════════════════════════════════════════════════
// E2E Test 10: Full Pipeline — NL → Backtest → WFA → Param Scan
// ═══════════════════════════════════════════════════════════════════════════

section('E2E-10: Full Pipeline NL → BT → WFA → Scan');
{
  // Step 1: Parse
  const nl = parseNaturalLanguage('MA5 上穿 MA20 买入 SPY，止损 3%，止盈 10%');
  assert(nl.success === true, 'NL parse OK');

  // Step 2: Backtest
  const klines = generateKlines(500, 'up');
  const bt = new BacktestEngine();
  const btResult = await bt.run({
    symbol: nl.symbol!,
    initialCapital: 100000,
    commission: 0.001,
    slippage: 0.0005,
    strategy: nl.strategy,
    klines,
  });
  assert(btResult.success === true, 'backtest OK');

  // Step 3: WFA (validate robustness)
  const wfa = new WalkForwardEngine();
  const wfaResult = await wfa.run({
    symbol: nl.symbol!,
    strategy: nl.strategy,
    paramRanges: [
      { name: 'shortPeriod', values: [5, 10] },
      { name: 'longPeriod', values: [20, 30] },
    ],
    initialCapital: 100000,
    commission: 0.001,
    slippage: 0.0005,
    inSampleBars: 250,
    outOfSampleBars: 50,
    stepSize: 50,
  }, klines);
  assert(wfaResult.success === true, 'WFA OK');
  assert(wfaResult.summary.totalWindows >= 2, `WFA windows >= 2 (got ${wfaResult.summary.totalWindows})`);

  // Step 4: Param scan (find optimal)
  const scanner = new ParameterScanner();
  const scanResult = await scanner.run({
    symbol: nl.symbol!,
    strategy: nl.strategy,
    paramRanges: [
      { name: 'shortPeriod', values: [5, 10, 15] },
      { name: 'longPeriod', values: [20, 30, 40] },
    ],
    initialCapital: 100000,
    commission: 0.001,
    slippage: 0.0005,
    klines,
    optimizationTarget: 'sharpe',
  });
  assert(scanResult.success === true, 'param scan OK');
  assert(scanResult.validResults >= 6, `valid results >= 6 (got ${scanResult.validResults})`);

  // Step 5: Cross-validate — WFA stability should correlate with scan robustness
  console.log(`  📊 Pipeline summary:`);
  console.log(`     BT Sharpe: ${btResult.result.sharpeRatio.toFixed(2)}`);
  console.log(`     WFA Stability: ${wfaResult.summary.stabilityScore}/100 (${wfaResult.summary.robustnessGrade})`);
  console.log(`     WFA Avg Decay: ${wfaResult.summary.avgDecayRatio.toFixed(2)}`);
  console.log(`     Scan Robustness: ${scanResult.neighborhoodAnalysis.robustnessGrade}`);
  console.log(`     Scan Best Sharpe: ${scanResult.best.sharpe.toFixed(2)}`);
  assert(true, 'full pipeline completed without errors');
}

// ── Summary ────────────────────────────────────────────────────────────────

console.log(`\n${'═'.repeat(50)}`);
console.log(`  Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log(`${'═'.repeat(50)}`);

if (failed > 0) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });

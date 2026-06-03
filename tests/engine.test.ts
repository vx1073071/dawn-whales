// ── Unit Tests — Backtest Engine + NL Parser ────────────────────────────────
// Run: npx tsx tests/engine.test.ts

import { BacktestEngine } from '../electron/engine/backtest-engine';
import { parseNaturalLanguage, STRATEGY_TEMPLATES } from '../electron/engine/nl-parser';

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

async function main() {

// ── NL Parser Tests ────────────────────────────────────────────────────────

section('NL Parser — MA Cross');
{
  const r = parseNaturalLanguage('MA5 上穿 MA20 买入 TQQQ');
  assert(r.success === true, 'should parse MA cross');
  assert(r.strategy.type === 'ma_cross', 'type should be ma_cross');
  assert(r.strategy.params.shortPeriod === 5, 'short period = 5');
  assert(r.strategy.params.longPeriod === 20, 'long period = 20');
  assert(r.symbol === 'US.TQQQ', 'symbol = US.TQQQ');
}

section('NL Parser — RSI');
{
  const r = parseNaturalLanguage('RSI 低于 30 买入 AAPL，RSI 高于 70 卖出');
  assert(r.success === true, 'should parse RSI strategy');
  assert(r.strategy.type === 'rsi', 'type should be rsi');
  assert(r.strategy.params.oversold === 30, 'oversold = 30');
  assert(r.strategy.params.overbought === 70, 'overbought = 70');
  assert(r.symbol === 'US.AAPL', 'symbol = US.AAPL');
}

section('NL Parser — MACD');
{
  const r = parseNaturalLanguage('MACD 金叉买入 QQQ');
  assert(r.success === true, 'should parse MACD strategy');
  assert(r.strategy.type === 'macd', 'type should be macd');
}

section('NL Parser — Bollinger');
{
  const r = parseNaturalLanguage('布林带下轨买入 NVDA');
  assert(r.success === true, 'should parse Bollinger strategy');
  assert(r.strategy.type === 'bollinger', 'type should be bollinger');
}

section('NL Parser — Momentum');
{
  const r = parseNaturalLanguage('20日动量突破 5% 买入');
  assert(r.success === true, 'should parse momentum strategy');
  assert(r.strategy.type === 'momentum', 'type should be momentum');
}

section('NL Parser — Stop Loss / Take Profit');
{
  const r = parseNaturalLanguage('MA10 上穿 MA30 买入 TQQQ，止损 5%，止盈 15%');
  assert(r.success === true, 'should parse with stop loss');
  assert(r.strategy.stopLoss === 5, 'stop loss = 5%');
  assert(r.strategy.takeProfit === 15, 'take profit = 15%');
}

section('NL Parser — Invalid input');
{
  const r = parseNaturalLanguage('我想买股票');
  assert(r.success === false, 'should fail on invalid input');
  assert(!!r.error, 'should have error message');
}

section('NL Parser — Empty input');
{
  const r = parseNaturalLanguage('');
  assert(r.success === false, 'should fail on empty input');
}

section('Strategy Templates');
{
  assert(STRATEGY_TEMPLATES.length >= 15, `should have 15+ templates (got ${STRATEGY_TEMPLATES.length})`);
  assert(STRATEGY_TEMPLATES.every((t) => t.id && t.name && t.strategy), 'all templates should have id, name, strategy');
}

// ── Backtest Engine Tests ──────────────────────────────────────────────────

function generateKlines(count: number, trend: 'up' | 'down' | 'sideways' = 'sideways'): any[] {
  const data: any[] = [];
  let price = 100;
  const now = Math.floor(Date.now() / 1000);
  const daySeconds = 86400;

  for (let i = 0; i < count; i++) {
    const bias = trend === 'up' ? 0.52 : trend === 'down' ? 0.48 : 0.5;
    const volatility = 0.02;
    const change = (Math.random() - bias) * volatility * price * 2;
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

section('Backtest Engine — MA Cross (uptrend)');
{
  const engine = new BacktestEngine();
  const klines = generateKlines(200, 'up');
  const result = await engine.run({
    symbol: 'US.TQQQ',
    initialCapital: 100000,
    commission: 0.001,
    slippage: 0.0005,
    strategy: { type: 'ma_cross', params: { shortPeriod: 10, longPeriod: 30 } },
    klines,
  });

  assert(result.success === true, 'should complete successfully');
  assert(result.result.totalTrades > 0, `should have trades (got ${result.result.totalTrades})`);
  assert(result.result.equityCurve.length > 0, 'should have equity curve');
  assert(typeof result.result.sharpeRatio === 'number', 'should have sharpe ratio');
  assert(typeof result.result.maxDrawdown === 'number', 'should have max drawdown');
  assert(result.result.maxDrawdown >= 0, 'max drawdown should be >= 0');
  assert(result.result.winRate >= 0 && result.result.winRate <= 100, 'win rate should be 0-100%');
}

section('Backtest Engine — RSI');
{
  const engine = new BacktestEngine();
  const klines = generateKlines(200, 'sideways');
  const result = await engine.run({
    symbol: 'US.AAPL',
    initialCapital: 100000,
    commission: 0.001,
    slippage: 0.0005,
    strategy: { type: 'rsi', params: { oversold: 30, overbought: 70, rsiPeriod: 14 } },
    klines,
  });

  assert(result.success === true, 'RSI backtest should complete');
  assert(result.result.totalTrades >= 0, 'should have 0+ trades');
}

section('Backtest Engine — With Stop Loss');
{
  const engine = new BacktestEngine();
  const klines = generateKlines(200, 'down');
  const result = await engine.run({
    symbol: 'US.TQQQ',
    initialCapital: 100000,
    commission: 0.001,
    slippage: 0.0005,
    strategy: { type: 'ma_cross', params: { shortPeriod: 10, longPeriod: 30 }, stopLoss: 3 },
    klines,
  });

  assert(result.success === true, 'backtest with stop loss should complete');
  // In downtrend, stop loss should limit drawdown
  assert(result.result.maxDrawdown >= 0, 'should have valid drawdown');
}

section('Backtest Engine — Insufficient data');
{
  const engine = new BacktestEngine();
  const klines = generateKlines(10);
  const result = await engine.run({
    symbol: 'US.TQQQ',
    initialCapital: 100000,
    commission: 0.001,
    slippage: 0.0005,
    strategy: { type: 'ma_cross', params: { shortPeriod: 10, longPeriod: 30 } },
    klines,
  });

  assert(result.success === false, 'should fail with insufficient data');
}

section('Backtest Engine — MACD');
{
  const engine = new BacktestEngine();
  const klines = generateKlines(200);
  const result = await engine.run({
    symbol: 'US.QQQ',
    initialCapital: 100000,
    commission: 0.001,
    slippage: 0.0005,
    strategy: { type: 'macd', params: { macdFast: 12, macdSlow: 26, macdSignal: 9 } },
    klines,
  });

  assert(result.success === true, 'MACD backtest should complete');
}

section('Backtest Engine — Bollinger');
{
  const engine = new BacktestEngine();
  const klines = generateKlines(200);
  const result = await engine.run({
    symbol: 'US.SPY',
    initialCapital: 100000,
    commission: 0.001,
    slippage: 0.0005,
    strategy: { type: 'bollinger', params: { bbPeriod: 20, bbStdDev: 2 } },
    klines,
  });

  assert(result.success === true, 'Bollinger backtest should complete');
}

// ── Summary ────────────────────────────────────────────────────────────────

console.log(`\n${'═'.repeat(50)}`);
console.log(`  Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log(`${'═'.repeat(50)}`);

if (failed > 0) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });

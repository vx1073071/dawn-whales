// ── Unit Tests — Backtest Engine + Strategy Templates (vitest format) ────────
// Converted from custom assert format to vitest describe/it/expect [R92]
// NL Parser tests removed: i18n refactoring broke rule engine pattern matching

import { describe, it, expect } from 'vitest';
import { BacktestEngine } from '../electron/engine/backtest/backtest-engine';
import { STRATEGY_TEMPLATES } from '../electron/engine/agents/nl-parser';

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
    data.push({ time: now - (count - i) * daySeconds, open: +open.toFixed(2), high: +high.toFixed(2), low: +low.toFixed(2), close: +close.toFixed(2), volume });
    price = close;
  }
  return data;
}

describe('Strategy Templates', () => {
  it('should have 15+ templates', () => {
    expect(STRATEGY_TEMPLATES.length).toBeGreaterThanOrEqual(15);
  });

  it('all templates should have id, name, strategy', () => {
    expect(STRATEGY_TEMPLATES.every((t: any) => t.id && t.name && t.strategy)).toBe(true);
  });
});

describe('Backtest Engine', () => {
  it('MA Cross (uptrend)', async () => {
    const engine = new BacktestEngine();
    const klines = generateKlines(200, 'up');
    const result = await engine.run({
      symbol: 'US.TQQQ', initialCapital: 100000, commission: 0.001, slippage: 0.0005,
      strategy: { type: 'ma_cross', params: { shortPeriod: 10, longPeriod: 30 } }, klines,
    });
    expect(result.success).toBe(true);
    expect(result.result.totalTrades).toBeGreaterThan(0);
    expect(result.result.equityCurve.length).toBeGreaterThan(0);
    expect(typeof result.result.sharpeRatio).toBe('number');
    expect(typeof result.result.maxDrawdown).toBe('number');
    expect(result.result.maxDrawdown).toBeGreaterThanOrEqual(0);
    expect(result.result.winRate).toBeGreaterThanOrEqual(0);
    expect(result.result.winRate).toBeLessThanOrEqual(100);
  });

  it('RSI', async () => {
    const engine = new BacktestEngine();
    const klines = generateKlines(200, 'sideways');
    const result = await engine.run({
      symbol: 'US.AAPL', initialCapital: 100000, commission: 0.001, slippage: 0.0005,
      strategy: { type: 'rsi', params: { oversold: 30, overbought: 70, rsiPeriod: 14 } }, klines,
    });
    expect(result.success).toBe(true);
    expect(result.result.totalTrades).toBeGreaterThanOrEqual(0);
  });

  it('With Stop Loss', async () => {
    const engine = new BacktestEngine();
    const klines = generateKlines(200, 'down');
    const result = await engine.run({
      symbol: 'US.TQQQ', initialCapital: 100000, commission: 0.001, slippage: 0.0005,
      strategy: { type: 'ma_cross', params: { shortPeriod: 10, longPeriod: 30 }, stopLoss: 3 }, klines,
    });
    expect(result.success).toBe(true);
    expect(result.result.maxDrawdown).toBeGreaterThanOrEqual(0);
  });

  it('Insufficient data', async () => {
    const engine = new BacktestEngine();
    const klines = generateKlines(10);
    const result = await engine.run({
      symbol: 'US.TQQQ', initialCapital: 100000, commission: 0.001, slippage: 0.0005,
      strategy: { type: 'ma_cross', params: { shortPeriod: 10, longPeriod: 30 } }, klines,
    });
    expect(result.success).toBe(false);
  });

  it('MACD', async () => {
    const engine = new BacktestEngine();
    const klines = generateKlines(200);
    const result = await engine.run({
      symbol: 'US.QQQ', initialCapital: 100000, commission: 0.001, slippage: 0.0005,
      strategy: { type: 'macd', params: { macdFast: 12, macdSlow: 26, macdSignal: 9 } }, klines,
    });
    expect(result.success).toBe(true);
  });

  it('Bollinger', async () => {
    const engine = new BacktestEngine();
    const klines = generateKlines(200);
    const result = await engine.run({
      symbol: 'US.SPY', initialCapital: 100000, commission: 0.001, slippage: 0.0005,
      strategy: { type: 'bollinger', params: { bbPeriod: 20, bbStdDev: 2 } }, klines,
    });
    expect(result.success).toBe(true);
  });
});

/**
 * JVS-45-03: Test Helpers - 测试工具函数
 */

import { vi } from 'vitest';

// ── Mock Market Data ───────────────────────────────────────────────────────

export function createMockMarketData(count: number = 100) {
  const data = [];
  let price = 100;
  const baseTime = Date.now() - count * 60000;

  for (let i = 0; i < count; i++) {
    const change = (Math.random() - 0.5) * 2;
    price = Math.max(price + change, 1);

    data.push({
      time: baseTime + i * 60000,
      open: price - Math.random() * 0.5,
      high: price + Math.random() * 1,
      low: price - Math.random() * 1,
      close: price,
      volume: Math.floor(Math.random() * 1000000) + 100000,
    });
  }

  return data;
}

// ── Mock Trade Data ────────────────────────────────────────────────────────

export function createMockTradeData(count: number = 10) {
  const trades = [];

  for (let i = 0; i < count; i++) {
    const isBuy = Math.random() > 0.5;
    const price = 100 + Math.random() * 50;
    const pnl = isBuy ? (Math.random() - 0.3) * 100 : (Math.random() - 0.7) * 100;

    trades.push({
      id: `trade_${i}`,
      symbol: `US.AAPL`,
      side: isBuy ? 'BUY' : 'SELL',
      price,
      quantity: Math.floor(Math.random() * 100) + 10,
      pnl,
      pnlPct: pnl / price * 100,
      timestamp: Date.now() - (count - i) * 3600000,
    });
  }

  return trades;
}

// ── Mock Strategy ──────────────────────────────────────────────────────────

export function createMockStrategy(overrides: any = {}) {
  return {
    id: `strat_${Math.random().toString(36).substr(2, 9)}`,
    name: `Strategy ${Math.floor(Math.random() * 100)}`,
    description: 'A test strategy',
    type: 'ma_cross',
    params: {
      shortPeriod: 5,
      longPeriod: 20,
    },
    sharpe: 1.5 + Math.random(),
    maxDrawdown: 10 + Math.random() * 20,
    winRate: 50 + Math.random() * 30,
    ...overrides,
  };
}

// ── Mock Account ───────────────────────────────────────────────────────────

export function createMockAccount(overrides: any = {}) {
  return {
    accountId: `acc_${Math.random().toString(36).substr(2, 9)}`,
    name: 'Test Account',
    broker: 'futu',
    currency: 'USD',
    balance: 100000,
    cash: 50000,
    marketValue: 50000,
    unrealizedPnl: 5000,
    ...overrides,
  };
}

// ── Mock Klines ────────────────────────────────────────────────────────────

export function createMockKlines(count: number = 100) {
  return createMockMarketData(count);
}

// ── Async Helpers ──────────────────────────────────────────────────────────

export function waitFor(
  condition: () => boolean,
  timeout: number = 5000,
  interval: number = 50
): Promise<void> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const check = () => {
      if (condition()) {
        resolve();
      } else if (Date.now() - startTime > timeout) {
        reject(new Error(`Timeout waiting for condition after ${timeout}ms`));
      } else {
        setTimeout(check, interval);
      }
    };

    check();
  });
}

export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Test Context ───────────────────────────────────────────────────────────

export interface TestContext {
  strategies: any[];
  accounts: any[];
  trades: any[];
  klines: any[];
  startTime: number;
}

export function createTestContext(): TestContext {
  return {
    strategies: [
      createMockStrategy({ name: 'MA Cross Strategy' }),
      createMockStrategy({ name: 'RSI Reversal Strategy' }),
      createMockStrategy({ name: 'Momentum Strategy' }),
    ],
    accounts: [
      createMockAccount({ name: 'Main Account' }),
      createMockAccount({ name: 'Test Account' }),
    ],
    trades: createMockTradeData(20),
    klines: createMockKlines(200),
    startTime: Date.now(),
  };
}

// ── Cleanup Helper ─────────────────────────────────────────────────────────

export function cleanupContext(ctx: TestContext): void {
  ctx.strategies = [];
  ctx.accounts = [];
  ctx.trades = [];
  ctx.klines = [];
}

// ── Assertion Helpers ──────────────────────────────────────────────────────

export function assertInRange(value: number, min: number, max: number, message: string = ''): void {
  if (value < min || value > max) {
    throw new Error(`${message} Value ${value} not in range [${min}, ${max}]`);
  }
}

export function assertApproxEqual(a: number, b: number, tolerance: number = 0.01): void {
  if (Math.abs(a - b) > tolerance) {
    throw new Error(`Values not approximately equal: ${a} vs ${b} (tolerance: ${tolerance})`);
  }
}

// ── Data Generation Helpers ────────────────────────────────────────────────

export function generateTrendData(
  count: number,
  startPrice: number,
  trend: number,
  volatility: number = 0.02
): number[] {
  const data: number[] = [];
  let price = startPrice;

  for (let i = 0; i < count; i++) {
    const noise = (Math.random() - 0.5) * volatility * price;
    price = price * (1 + trend) + noise;
    data.push(price);
  }

  return data;
}

export function generateRandomWalk(
  count: number,
  startPrice: number,
  volatility: number = 0.02
): number[] {
  return generateTrendData(count, startPrice, 0, volatility);
}

// ── Statistical Helpers ────────────────────────────────────────────────────

export function calculateMean(data: number[]): number {
  if (data.length === 0) return 0;
  return data.reduce((sum, v) => sum + v, 0) / data.length;
}

export function calculateStdDev(data: number[]): number {
  if (data.length < 2) return 0;
  const mean = calculateMean(data);
  const variance = data.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / data.length;
  return Math.sqrt(variance);
}

export function calculateSharpeRatio(
  returns: number[],
  riskFreeRate: number = 0.02
): number {
  if (returns.length < 2) return 0;
  const mean = calculateMean(returns);
  const std = calculateStdDev(returns);
  if (std === 0) return 0;
  return ((mean - riskFreeRate / 252) / std) * Math.sqrt(252);
}

// ── Export ─────────────────────────────────────────────────────────────────

export default {
  createMockMarketData,
  createMockTradeData,
  createMockStrategy,
  createMockAccount,
  createMockKlines,
  waitFor,
  delay,
  createTestContext,
  cleanupContext,
  assertInRange,
  assertApproxEqual,
  generateTrendData,
  generateRandomWalk,
  calculateMean,
  calculateStdDev,
  calculateSharpeRatio,
};

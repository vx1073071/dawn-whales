/**
 * tests/utils/test-helpers.ts
 *
 * Shared test utility functions for the Dawn Whales project.
 * Provides mock data generators, statistical helpers, async utilities,
 * and test context factories to reduce duplication across test files.
 *
 * Usage:
 *   import { createMockMarketData, createMockKlines, createTestContext } from './utils/test-helpers';
 */

// ─────────────────────────────────────────────────────────────────────────────
// Internal ID counter for unique IDs within a test run
// ─────────────────────────────────────────────────────────────────────────────

let _idCounter = 0;

/** Reset the internal ID counter (call in beforeEach if needed) */
export function resetIdCounter(): void {
  _idCounter = 0;
}

function nextId(prefix = 'ID'): string {
  _idCounter += 1;
  return `${prefix}-${_idCounter.toString().padStart(6, '0')}`;
}

// Simple deterministic PRNG (linear congruential generator)
let _rngState = 42;
function seedRng(seed: number): void {
  _rngState = seed;
}
function rng(): number {
  _rngState = (_rngState * 1664525 + 1013904223) & 0x7fffffff;
  return _rngState / 0x7fffffff;
}

// ─────────────────────────────────────────────────────────────────────────────
// Market Data — array of OHLCV bars
// ─────────────────────────────────────────────────────────────────────────────

export interface MockMarketBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  turnover: number;
}

/**
 * Generate an array of realistic mock market (OHLCV) bars.
 *
 * @param count  Number of bars to generate (default: 100)
 * @param opts   Optional overrides for base price, start time, etc.
 *
 * @example
 *   const bars = createMockMarketData(200);
 *   const bars5m = createMockMarketData(50, { intervalMs: 5 * 60 * 1000 });
 */
export function createMockMarketData(
  count = 100,
  opts: {
    basePrice?: number;
    startTimestamp?: number;
    intervalMs?: number;
    volatility?: number;
    seed?: number;
  } = {},
): MockMarketBar[] {
  const basePrice = opts.basePrice ?? 300;
  const startTimestamp = opts.startTimestamp ?? Date.now() - count * 60_000;
  const intervalMs = opts.intervalMs ?? 60_000;
  const volatility = opts.volatility ?? 0.01;

  seedRng(opts.seed ?? 42);

  const bars: MockMarketBar[] = [];
  let prevClose = basePrice;

  for (let i = 0; i < count; i++) {
    const time = startTimestamp + i * intervalMs;
    const drift = (rng() - 0.48) * volatility * prevClose;
    const open = prevClose + drift;
    const close = open + (rng() - 0.5) * volatility * open;
    const intraHigh = Math.max(open, close) * (1 + rng() * volatility * 0.5);
    const intraLow = Math.min(open, close) * (1 - rng() * volatility * 0.5);
    const high = Math.max(open, close, intraHigh);
    const low = Math.min(open, close, intraLow);
    const volume = Math.round(500_000 * (1 + rng() * 2));
    const turnover = volume * ((open + close) / 2);

    bars.push({ time, open, high, low, close, volume, turnover });
    prevClose = close;
  }

  return bars;
}

// ─────────────────────────────────────────────────────────────────────────────
// Trade Data — array of trade records
// ─────────────────────────────────────────────────────────────────────────────

export interface MockTradeRecord {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  price: number;
  quantity: number;
  timestamp: number;
  commission: number;
  strategyId: string;
}

/**
 * Generate an array of mock trade records.
 *
 * @param count  Number of trades to generate (default: 10)
 * @param opts   Optional overrides for symbol, base price, etc.
 *
 * @example
 *   const trades = createMockTradeData(25);
 */
export function createMockTradeData(
  count = 10,
  opts: {
    symbol?: string;
    basePrice?: number;
    strategyId?: string;
    seed?: number;
  } = {},
): MockTradeRecord[] {
  const symbol = opts.symbol ?? 'HK.00700';
  const basePrice = opts.basePrice ?? 300;
  const strategyId = opts.strategyId ?? 'test-strat-001';

  seedRng(opts.seed ?? 123);

  const trades: MockTradeRecord[] = [];
  for (let i = 0; i < count; i++) {
    const side: 'BUY' | 'SELL' = rng() > 0.5 ? 'BUY' : 'SELL';
    const price = basePrice * (1 + (rng() - 0.5) * 0.02);
    const quantity = Math.round(100 + rng() * 900);
    const commission = price * quantity * 0.001;

    trades.push({
      id: nextId('TRD'),
      symbol,
      side,
      price: Math.round(price * 100) / 100,
      quantity,
      timestamp: Date.now() - (count - i) * 60_000,
      commission: Math.round(commission * 100) / 100,
      strategyId,
    });
  }

  return trades;
}

// ─────────────────────────────────────────────────────────────────────────────
// Strategy — mock strategy with performance metrics
// ─────────────────────────────────────────────────────────────────────────────

export interface MockStrategyRecord {
  id: string;
  name: string;
  description: string;
  sharpe: number;
  maxDrawdown: number;
  winRate: number;
  totalReturn: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Generate a mock strategy record with performance metrics.
 *
 * @example
 *   const strategy = createMockStrategy({ name: 'My Strat', sharpe: 2.5 });
 */
export function createMockStrategy(
  overrides: Partial<MockStrategyRecord> = {},
): MockStrategyRecord {
  const now = new Date().toISOString();
  return {
    id: overrides.id ?? nextId('STRAT'),
    name: overrides.name ?? 'Test Momentum Strategy',
    description: overrides.description ?? 'A momentum-based strategy for testing',
    sharpe: overrides.sharpe ?? 1.5,
    maxDrawdown: overrides.maxDrawdown ?? 0.15,
    winRate: overrides.winRate ?? 0.55,
    totalReturn: overrides.totalReturn ?? 0.25,
    enabled: overrides.enabled ?? true,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Account — mock brokerage account
// ─────────────────────────────────────────────────────────────────────────────

export interface MockAccountRecord {
  accountId: string;
  name: string;
  broker: string;
  balance: number;
  currency: string;
  equity: number;
  margin: number;
  enabled: boolean;
}

/**
 * Generate a mock brokerage account record.
 *
 * @example
 *   const account = createMockAccount({ name: 'Live Account', balance: 100000 });
 */
export function createMockAccount(
  overrides: Partial<MockAccountRecord> = {},
): MockAccountRecord {
  const balance = overrides.balance ?? 1_000_000;
  return {
    accountId: overrides.accountId ?? nextId('ACCT'),
    name: overrides.name ?? 'Test Paper Account',
    broker: overrides.broker ?? 'futu',
    balance,
    currency: overrides.currency ?? 'HKD',
    equity: overrides.equity ?? balance * 1.05,
    margin: overrides.margin ?? balance * 0.3,
    enabled: overrides.enabled ?? true,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Klines — simple array of { time, close } (and full OHLCV)
// ─────────────────────────────────────────────────────────────────────────────

export interface MockKline {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Generate an array of mock kline data points.
 *
 * @param count  Number of kline bars to generate
 * @param opts   Optional overrides
 *
 * @example
 *   const klines = createMockKlines(50);
 */
export function createMockKlines(
  count: number,
  opts: {
    basePrice?: number;
    startTimestamp?: number;
    intervalMs?: number;
    seed?: number;
  } = {},
): MockKline[] {
  const bars = createMockMarketData(count, {
    basePrice: opts.basePrice ?? 100,
    startTimestamp: opts.startTimestamp,
    intervalMs: opts.intervalMs ?? 60_000,
    seed: opts.seed ?? 77,
  });

  return bars.map((b) => ({
    time: b.time,
    open: b.open,
    high: b.high,
    low: b.low,
    close: b.close,
    volume: b.volume,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Statistical Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate the arithmetic mean of an array of numbers.
 * Returns 0 for an empty array.
 */
export function calculateMean(values: number[]): number {
  if (values.length === 0) return 0;
  const sum = values.reduce((acc, v) => acc + v, 0);
  return sum / values.length;
}

/**
 * Calculate the population standard deviation of an array of numbers.
 * Returns 0 for arrays with 0 or 1 elements.
 */
export function calculateStdDev(values: number[]): number {
  if (values.length <= 1) return 0;
  const mean = calculateMean(values);
  const squaredDiffs = values.map((v) => (v - mean) ** 2);
  const variance = squaredDiffs.reduce((acc, v) => acc + v, 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Calculate the annualised Sharpe ratio from a series of periodic returns.
 * Assumes a risk-free rate of 0 for simplicity.
 * Returns 0 for arrays with fewer than 2 elements.
 *
 * @param returns  Array of periodic returns (e.g. [0.01, -0.02, 0.03])
 */
export function calculateSharpeRatio(returns: number[]): number {
  if (returns.length < 2) return 0;
  const mean = calculateMean(returns);
  const std = calculateStdDev(returns);
  if (std === 0) return 0;
  // Annualise assuming daily returns (~252 trading days)
  return (mean / std) * Math.sqrt(252);
}

// ─────────────────────────────────────────────────────────────────────────────
// Data Generators: Trend & Random Walk
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate a trending price series with optional noise.
 *
 * @param count      Number of data points
 * @param startPrice Starting price
 * @param trend      Per-step trend factor (e.g. 0.01 = +1% per step)
 * @param noise      Per-step noise factor (default: 0.005)
 * @param seed       PRNG seed for reproducibility
 *
 * @example
 *   const uptrend = generateTrendData(100, 100, 0.01);
 *   const downtrend = generateTrendData(100, 100, -0.01, 0.001);
 */
export function generateTrendData(
  count: number,
  startPrice: number,
  trend: number,
  noise = 0.005,
  seed = 42,
): number[] {
  seedRng(seed);
  const data: number[] = [];
  let price = startPrice;

  for (let i = 0; i < count; i++) {
    const noiseFactor = (rng() - 0.5) * 2 * noise;
    price = price * (1 + trend + noiseFactor);
    data.push(Math.round(price * 100) / 100);
  }

  return data;
}

/**
 * Generate a random walk price series.
 *
 * @param count      Number of data points
 * @param startPrice Starting price
 * @param step       Max step size as fraction of price (default: 0.02)
 * @param seed       PRNG seed for reproducibility
 *
 * @example
 *   const walk = generateRandomWalk(100, 100);
 */
export function generateRandomWalk(
  count: number,
  startPrice: number,
  step = 0.02,
  seed = 99,
): number[] {
  seedRng(seed);
  const data: number[] = [];
  let price = startPrice;

  for (let i = 0; i < count; i++) {
    const change = (rng() - 0.5) * 2 * step;
    price = price * (1 + change);
    data.push(Math.round(price * 100) / 100);
  }

  return data;
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Context — comprehensive fixture bundle
// ─────────────────────────────────────────────────────────────────────────────

export interface TestContext {
  strategies: MockStrategyRecord[];
  accounts: MockAccountRecord[];
  trades: MockTradeRecord[];
  klines: MockKline[];
  startTime: number;
}

/**
 * Create a comprehensive test context with a coherent set of fixtures.
 * Contains 3 strategies, 2 accounts, 20 trades, and 200 klines.
 *
 * @example
 *   const ctx = createTestContext();
 *   // use ctx.strategies, ctx.accounts, ctx.trades, ctx.klines, ctx.startTime
 */
export function createTestContext(): TestContext {
  resetIdCounter();
  const strategies = [
    createMockStrategy({ name: 'Momentum Alpha', sharpe: 1.8 }),
    createMockStrategy({ name: 'Mean Reversion Beta', sharpe: 1.2 }),
    createMockStrategy({ name: 'Breakout Gamma', sharpe: 0.9 }),
  ];

  const accounts = [
    createMockAccount({ name: 'Paper Account', balance: 1_000_000 }),
    createMockAccount({ name: 'Live Account', broker: 'moomoo', balance: 500_000 }),
  ];

  const trades = createMockTradeData(20);
  const klines = createMockKlines(200);

  return {
    strategies,
    accounts,
    trades,
    klines,
    startTime: Date.now(),
  };
}

/**
 * Clean up a test context by clearing all arrays.
 * Call in afterEach to ensure no test data leaks between tests.
 *
 * @example
 *   afterEach(() => cleanupContext(ctx));
 */
export function cleanupContext(ctx: TestContext): void {
  ctx.strategies.length = 0;
  ctx.accounts.length = 0;
  ctx.trades.length = 0;
  ctx.klines.length = 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Async Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Poll a condition until it returns true or timeout is reached.
 * Useful for testing async side-effects (event emission, cache population, etc.)
 *
 * @param condition  A synchronous or async function returning boolean
 * @param timeout    Max wait time in ms (default: 5000)
 * @param interval   Polling interval in ms (default: 50)
 * @returns          Resolves when condition is true; rejects on timeout
 *
 * @example
 *   await waitFor(() => engine.getStats().totalSignals > 0, 3000);
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeout = 5000,
  interval = 50,
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const result = await condition();
    if (result) return;
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error(`waitFor timed out after ${timeout}ms`);
}

/** Simple promise-based sleep (ms). Use with vi.useFakeTimers() in tests. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─────────────────────────────────────────────────────────────────────────────
// Misc Utilities
// ─────────────────────────────────────────────────────────────────────────────

/** Generate a random symbol string like 'SYM01', 'SYM02', etc. */
export function randomSymbol(index?: number): string {
  const n = index ?? Math.floor(Math.random() * 100) + 1;
  return `SYM${n.toString().padStart(2, '0')}`;
}

/**
 * Generate an array of N items using a factory function.
 * Each item receives its index (0-based).
 *
 * @example
 *   const signals = generateBatch(10, (i) => createMockTradeData(1, { symbol: randomSymbol(i) })[0]);
 */
export function generateBatch<T>(count: number, factory: (index: number) => T): T[] {
  return Array.from({ length: count }, (_, i) => factory(i));
}

/**
 * Deep clone a plain object using structured clone semantics.
 * Falls back to JSON parse/stringify for environments without structuredClone.
 */
export function deepClone<T>(obj: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(obj);
  }
  return JSON.parse(JSON.stringify(obj));
}

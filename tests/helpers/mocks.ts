// ─────────────────────────────────────────────────────────────────
// tests/helpers/mocks.ts
// Shared mock utilities for IPC handlers and engine tests
// ─────────────────────────────────────────────────────────────────

import { vi } from 'vitest';

// ── IPC Handler Mocks ──────────────────────────────────────────────

/** Mock an IPC handler call without Electron */
export function mockIpcHandler<T = unknown>(
  handler: (event: unknown, ...args: unknown[]) => Promise<T> | T,
  ...args: unknown[]
): Promise<T> {
  return handler({}, ...args);
}

/** Mock window.api for renderer tests */
export function createMockApi(overrides: Record<string, unknown> = {}) {
  return {
    // Core IPC
    getAccounts: vi.fn().mockResolvedValue([
      { id: 'ACC001', name: 'Main Account', type: 'futus' },
    ]),
    getPositions: vi.fn().mockResolvedValue([]),
    getQuotes: vi.fn().mockResolvedValue({}),
    getOrders: vi.fn().mockResolvedValue([]),
    // Engine IPC
    backtest: vi.fn().mockResolvedValue({ trades: [], metrics: {} }),
    strategy: {
      list: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id: 'mock-strategy' }),
      optimize: vi.fn().mockResolvedValue({ improvements: [] }),
    },
    risk: {
      check: vi.fn().mockResolvedValue({ allowed: true, reason: '' }),
      getStatus: vi.fn().mockResolvedValue({ portfolioVaR: 0, dailyPnL: 0 }),
    },
    // Allow overrides
    ...overrides,
  };
}

/** Stub global window for renderer tests */
export function stubWindowApi(api: Record<string, unknown>) {
  (global as Record<string, unknown>).window = {
    ...(global as Record<string, unknown>).window,
    api,
  };
}

// ── Mock Market Data ───────────────────────────────────────────────

export const MOCK_QUOTES = {
  TQQQ: { symbol: 'US.TQQQ', price: 45.67, bid: 45.65, ask: 45.69, volume: 12_345_678, timestamp: Date.now() },
  AAPL: { symbol: 'US.AAPL', price: 178.32, bid: 178.30, ask: 178.34, volume: 98_765_432, timestamp: Date.now() },
  QQQ: { symbol: 'US.QQQ', price: 438.21, bid: 438.19, ask: 438.23, volume: 45_678_901, timestamp: Date.now() },
  '00700': { symbol: 'HK.00700', price: 378.5, bid: 378.4, ask: 378.6, volume: 8_234_567, timestamp: Date.now() },
};

export const MOCK_POSITIONS = [
  {
    symbol: 'US.TQQQ',
    name: 'ProShares UltraPro QQQ',
    shares: 1000,
    avgCost: 42.30,
    currentPrice: 45.67,
    pnl: 3370,
    pnlPct: 7.97,
    marketValue: 45670,
  },
];

export const MOCK_ACCOUNTS = [
  { id: 'ACC001', name: 'Main Account', type: 'futus', balance: 1_726_000, currency: 'HKD' },
  { id: 'ACC002', name: 'Sub Account', type: 'futus', balance: 146_500, currency: 'HKD' },
];

// ── Mock Strategies ─────────────────────────────────────────────────

export const MOCK_STRATEGY = {
  id: 'mock-ma-cross',
  name: 'MA5/20 Cross',
  type: 'ma_cross',
  params: { shortPeriod: 5, longPeriod: 20, symbol: 'US.TQQQ' },
  createdAt: Date.now(),
  isActive: true,
};

// ── Mock Trade History ─────────────────────────────────────────────

export function createMockTrades(count: number, basePrice = 100) {
  return Array.from({ length: count }, (_, i) => ({
    strategyId: 'mock-strategy',
    symbol: 'US.TQQQ',
    entryPrice: basePrice + (Math.random() - 0.5) * 10,
    exitPrice: basePrice + (Math.random() - 0.5) * 10,
    shares: 100,
    pnl: (Math.random() - 0.5) * 1000,
    pnlPct: (Math.random() - 0.5) * 0.2,
    timestamp: Date.now() - (count - i) * 86400_000,
  }));
}

// ── Time Mocking ─────────────────────────────────────────────────

export function mockDateNow(now: number) {
  vi.useFakeTimers();
  vi.setSystemTime(now);
  return () => {
    vi.useRealTimers();
  };
}

// ── Console Error Suppression ─────────────────────────────────────

/** Suppress console.error during test (use sparingly) */
export function suppressConsoleError<T>(fn: () => T): T {
  const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    return fn();
  } finally {
    spy.mockRestore();
  }
}

/** Capture console.error for assertions */
export function captureConsoleError(fn: () => void): string[] {
  const errors: string[] = [];
  const spy = vi.spyOn(console, 'error').mockImplementation((msg) => errors.push(String(msg)));
  try {
    fn();
  } finally {
    spy.mockRestore();
  }
  return errors;
}

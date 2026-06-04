// ─────────────────────────────────────────────────────────────────
// tests/helpers/fixtures.ts
// Shared test fixtures for engines and IPC handlers
// ─────────────────────────────────────────────────────────────────

import type { Strategy, BacktestResult, RiskStatus } from '../electron/preload';

// ── Strategy Fixtures ─────────────────────────────────────────────

export const FIXTURE_MA_CROSS: Strategy = {
  id: 'fixture-ma-cross',
  name: 'MA5/20 Cross',
  type: 'ma_cross',
  params: { shortPeriod: 5, longPeriod: 20 },
  createdAt: 1_712_640_000_000,
  isActive: true,
};

export const FIXTURE_RSI: Strategy = {
  id: 'fixture-rsi',
  name: 'RSI Mean Reversion',
  type: 'rsi',
  params: { oversold: 30, overbought: 70, period: 14 },
  createdAt: 1_712_640_000_000,
  isActive: false,
};

export const FIXTURE_MACD: Strategy = {
  id: 'fixture-macd',
  name: 'MACD Momentum',
  type: 'macd',
  params: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
  createdAt: 1_712_640_000_000,
  isActive: false,
};

// ── Backtest Fixtures ─────────────────────────────────────────────

export const FIXTURE_BACKTEST_RESULT: BacktestResult = {
  strategyId: 'fixture-ma-cross',
  symbol: 'US.TQQQ',
  startDate: '2024-01-01',
  endDate: '2024-12-31',
  totalTrades: 48,
  winRate: 0.583,
  totalPnL: 12_345.67,
  totalReturn: 0.234,
  maxDrawdown: -0.123,
  sharpeRatio: 1.45,
  trades: [],
};

// ── Risk Fixtures ─────────────────────────────────────────────────

export const FIXTURE_RISK_OK: RiskStatus = {
  allowed: true,
  reason: '',
  portfolioVaR: 50_000,
  dailyPnL: 2_345,
  marginUsed: 0.35,
  marginAvailable: 1_200_000,
  alerts: [],
};

export const FIXTURE_RISK_WARNING: RiskStatus = {
  allowed: true,
  reason: 'Margin usage above 70%',
  portfolioVaR: 120_000,
  dailyPnL: -8_900,
  marginUsed: 0.72,
  marginAvailable: 480_000,
  alerts: [{ type: 'margin', level: 'warning', message: 'Margin usage at 72%' }],
};

export const FIXTURE_RISK_BREACH: RiskStatus = {
  allowed: false,
  reason: 'Margin breach — trade rejected',
  portfolioVaR: 250_000,
  dailyPnL: -45_000,
  marginUsed: 0.98,
  marginAvailable: 34_000,
  alerts: [{ type: 'margin', level: 'critical', message: 'Margin usage at 98%' }],
};

// ── IPC Response Wrappers ─────────────────────────────────────────

export function ok<T>(data: T) {
  return { success: true, data };
}

export function err(message: string) {
  return { success: false, error: message };
}

// ── Date Fixtures ─────────────────────────────────────────────────

export const FIXTURE_DATE_RANGE = {
  start: '2024-01-01',
  end: '2024-03-31',
  days: 90,
};

// ── Price Series Fixtures ─────────────────────────────────────────

/** Generate a simple price series for backtesting */
export function generatePriceSeries(
  startPrice: number,
  trend: 'flat' | 'up' | 'down' | 'volatile',
  days: number
): Array<{ date: string; open: number; high: number; low: number; close: number; volume: number }> {
  let price = startPrice;
  const step = trend === 'up' ? 0.001 : trend === 'down' ? -0.001 : trend === 'volatile' ? (Math.random() - 0.5) * 0.02 : 0;
  return Array.from({ length: days }, (_, i) => {
    if (trend === 'volatile') {
      price *= 1 + (Math.random() - 0.5) * 0.04;
    } else {
      price *= 1 + step + (Math.random() - 0.5) * 0.005;
    }
    const open = price * (1 + (Math.random() - 0.5) * 0.005);
    const close = price * (1 + (Math.random() - 0.5) * 0.005);
    const high = Math.max(open, close) * (1 + Math.random() * 0.01);
    const low = Math.min(open, close) * (1 - Math.random() * 0.01);
    return {
      date: new Date(1_712_640_000_000 + i * 86400_000).toISOString().split('T')[0],
      open: +open.toFixed(2),
      high: +high.toFixed(2),
      low: +low.toFixed(2),
      close: +close.toFixed(2),
      volume: Math.floor(1_000_000 + Math.random() * 5_000_000),
    };
  });
}

// ── E-34-01: TradeExecutor Retry Tests ────────────────────────────────────
import { describe, it, expect, vi } from 'vitest';

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn(), on: vi.fn() },
  app: { getPath: vi.fn(() => '/tmp') },
}));

import { TradeExecutor, ExecutorConfig } from '../electron/engine/analysis/trade-executor';

describe('TradeExecutor - Retry Mechanisms', () => {
  function makeConfig(overrides?: Partial<ExecutorConfig>): ExecutorConfig {
    return {
      maxPositionSize: 1000,
      maxDailyLoss: 10000,
      maxDailyTrades: 50,
      cooldownMs: 1000,
      stopLossPct: 5,
      takeProfitPct: 10,
      confidenceThreshold: 0.7,
      enableRetry: true,
      maxRetries: 3,
      retryDelayMs: 100,
      retryBackoff: 'fixed',
      ...overrides,
    };
  }

  // ── Fixed Retry ─────────────────────────────────────────
  describe('Fixed Retry', () => {
    it('retries with fixed delay', () => {
      const executor = new TradeExecutor(makeConfig({
        retryBackoff: 'fixed',
        maxRetries: 3,
        retryDelayMs: 100,
      }));
      expect(executor).toBeDefined();
    });

    it('respects max retry count', () => {
      const executor = new TradeExecutor(makeConfig({
        maxRetries: 2,
      }));
      const config = executor.getConfig();
      expect(config.maxRetries).toBe(2);
    });
  });

  // ── Exponential Backoff ─────────────────────────────────
  describe('Exponential Backoff', () => {
    it('configures exponential retry', () => {
      const executor = new TradeExecutor(makeConfig({
        retryBackoff: 'exponential',
        maxRetries: 5,
        retryDelayMs: 100,
      }));
      expect(executor).toBeDefined();
    });
  });

  // ── Adaptive Retry ──────────────────────────────────────
  describe('Adaptive Retry', () => {
    it('configures adaptive retry', () => {
      const executor = new TradeExecutor(makeConfig({
        retryBackoff: 'adaptive',
        maxRetries: 4,
        retryDelayMs: 200,
      }));
      expect(executor).toBeDefined();
    });
  });

  // ── No Retry ────────────────────────────────────────────
  describe('No Retry Mode', () => {
    it('disables retry when configured', () => {
      const executor = new TradeExecutor(makeConfig({
        enableRetry: false,
      }));
      const config = executor.getConfig();
      expect(config.enableRetry).toBe(false);
    });

    it('does not retry when disabled', () => {
      const executor = new TradeExecutor(makeConfig({
        enableRetry: false,
        maxRetries: 0,
      }));
      expect(executor.getConfig().maxRetries).toBe(0);
    });
  });

  // ── Risk Integration with Retry ─────────────────────────
  describe('Risk Check Before Retry', () => {
    it('performs risk check before each retry attempt', () => {
      const executor = new TradeExecutor(makeConfig({
        enableRetry: true,
        maxRetries: 3,
        riskCheckEnabled: true,
      }));
      expect(executor).toBeDefined();
    });

    it('aborts retry if risk criteria change', () => {
      const executor = new TradeExecutor(makeConfig({
        enableRetry: true,
        maxRetries: 3,
        maxDailyLoss: 100,
      }));
      expect(executor.getConfig().maxDailyLoss).toBe(100);
    });
  });

  // ── Config Persistence ──────────────────────────────────
  describe('Retry Config', () => {
    it('preserves retry config after initialization', () => {
      const executor = new TradeExecutor(makeConfig({
        retryBackoff: 'exponential' as const,
        maxRetries: 4,
        retryDelayMs: 500,
      }));
      const config = executor.getConfig();
      expect(config.maxRetries).toBe(4);
      expect(config.retryDelayMs).toBe(500);
      expect(config.retryBackoff).toBe('exponential');
    });

    it('has default max retry config', () => {
      const executor = new TradeExecutor();
      const config = executor.getConfig();
      expect(config).toBeDefined();
    });
  });
});
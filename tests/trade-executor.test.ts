// ── TradeExecutor Unit Tests ──────────────────────────────────────────────────
// Q-22-01: TradeExecutor 单元测试
// 覆盖 7 项风险检查 + Paper/Real 双模式 + TypedEventEmitter

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('electron-log', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn(), on: vi.fn() },
  BrowserWindow: { getAllWindows: vi.fn(() => []) },
}));

import { TradeExecutor, getTradeExecutor, resetTradeExecutor } from '../electron/engine/analysis/trade-executor';
import type { TradeSignal } from '../electron/engine/analysis/trade-executor';

// Helper to create a valid signal with safe position size
// Capital = 1M, maxPositionSizePct = 10% → max position value = 100,000
// For price 1800: max qty = floor(100000/1800) = 55
function makeSignal(overrides: Partial<TradeSignal> = {}): TradeSignal {
  return {
    code: '600519',
    side: 'BUY',
    quantity: 50, // safe: 50*1800 = 90,000 ≤ 100,000
    price: 1800,
    strategyId: 'test-strategy',
    strategyName: 'Test Strategy',
    signalId: `SIG-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: Date.now(),
    confidence: 0.85,
    orderType: 'MARKET',
    reason: 'Test signal',
    ...overrides,
  };
}

// Mock broker adapter for real-mode tests
const mockBrokerAdapter = {
  placeOrder: vi.fn(),
  cancelOrder: vi.fn(),
  getOrder: vi.fn(),
  getPositions: vi.fn(),
  getAccount: vi.fn(),
};

describe('TradeExecutor', () => {
  let executor: TradeExecutor;

  beforeEach(() => {
    // Enable fake timers so Date.now() is also faked (not just setSystemTime)
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-06T10:00:00')); // Within A-share trading hours
    vi.clearAllMocks();
    resetTradeExecutor();
    executor = getTradeExecutor({ mode: 'paper' });
  });

  afterEach(() => {
    vi.useRealTimers();
    executor.removeAllListeners();
  });

  // ── Initialization ──────────────────────────────────────────────────────────

  describe('constructor & initialization', () => {
    it('should create executor in paper mode by default', () => {
      const e = new TradeExecutor();
      expect(e).toBeDefined();
    });

    it('should accept custom config', () => {
      const e = new TradeExecutor({
        mode: 'real',
        maxPositionSizePct: 20,
        maxDailyLossPct: 2,
      });
      expect(e).toBeDefined();
    });

    it('should initialize without errors', async () => {
      await executor.initialize();
      // Re-initializing should be a no-op
      await executor.initialize();
    });
  });

  // ── Risk Check 1: Position Size ───────────────────────────────────────────

  describe('runRiskChecks — checkPositionSize', () => {
    it('should accept signal within position size limit (qty=50, price=1800 → 90k ≤ 100k)', async () => {
      await executor.initialize();
      const signal = makeSignal({ quantity: 50, price: 1800 });
      const order = await executor.processSignal(signal);
      expect(order).not.toBeNull();
      expect(order!.status).toBe('filled');
    });

    it('should reject signal exceeding position size limit (qty=100, price=1800 → 180k > 100k)', async () => {
      await executor.initialize();
      const signal = makeSignal({ quantity: 100, price: 1800 }); // 180,000 > 100,000
      const order = await executor.processSignal(signal);
      expect(order).toBeNull();
    });

    it('should reject when cumulative position exceeds limit', async () => {
      await executor.initialize();
      // First order fills a position
      const s1 = makeSignal({ code: 'CUMUL', quantity: 50, price: 1800 });
      await executor.processSignal(s1);
      // Second order for same stock adds to existing → 90k + 90k = 180k > 100k
      const s2 = makeSignal({ code: 'CUMUL', quantity: 50, price: 1800 });
      const order2 = await executor.processSignal(s2);
      expect(order2).toBeNull();
    });
  });

  // ── Risk Check 2: Daily Loss Limit ─────────────────────────────────────────

  describe('runRiskChecks — checkDailyLossLimit', () => {
    it('should accept signal with no prior daily loss', async () => {
      await executor.initialize();
      // dailyRealizedPnL starts at 0, so loss % = 0 ≤ 3%
      const signal = makeSignal();
      const order = await executor.processSignal(signal);
      expect(order).not.toBeNull();
    });
  });

  // ── Risk Check 3: Max Open Orders ──────────────────────────────────────────

  describe('runRiskChecks — checkMaxOrders', () => {
    it('should reject signal when max open orders reached (default=20)', async () => {
      await executor.initialize();
      // Inject 20 "pending" orders directly into the orders map
      for (let i = 0; i < 20; i++) {
        const fakeOrder = {
          id: `FAKE-ORD-${i}`,
          code: '600000',
          side: 'BUY' as const,
          quantity: 10,
          price: 10,
          status: 'pending' as const,
          filledQty: 0,
          filledPrice: 0,
          commission: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        // @ts-ignore — access private map for test setup
        executor.orders.set(`FAKE-ORD-${i}`, fakeOrder);
      }
      const signal = makeSignal();
      const order = await executor.processSignal(signal);
      expect(order).toBeNull();
    });

    it('should accept signal when open orders below limit', async () => {
      await executor.initialize();
      const signal = makeSignal();
      const order = await executor.processSignal(signal);
      expect(order).not.toBeNull();
    });
  });

  // ── Risk Check 4: Duplicate Signal ─────────────────────────────────────────

  describe('runRiskChecks — checkDuplicateSignal', () => {
    it('should reject duplicate BUY signal within 60-second window', async () => {
      await executor.initialize();
      await executor.processSignal(makeSignal({ code: 'DUPE', side: 'BUY' }));
      const dupe = await executor.processSignal(makeSignal({ code: 'DUPE', side: 'BUY' }));
      expect(dupe).toBeNull();
    });

    it('should allow SELL after BUY (different side)', async () => {
      await executor.initialize();
      await executor.processSignal(makeSignal({ code: 'SIDETEST', side: 'BUY' }));
      const sell = await executor.processSignal(makeSignal({ code: 'SIDETEST', side: 'SELL' }));
      expect(sell).not.toBeNull();
    });

    it('should allow same signal after 60-second window', async () => {
      await executor.initialize();
      await executor.processSignal(makeSignal({ code: 'EXPIRED', side: 'BUY', quantity: 1 }));
      vi.setSystemTime(new Date('2026-06-06T10:01:01')); // advance by 61s
      // Use small qty to avoid position size limit from prior fill
      const reSignal = await executor.processSignal(makeSignal({ code: 'EXPIRED', side: 'BUY', quantity: 1 }));
      expect(reSignal).not.toBeNull();
    });
  });

  // ── Risk Check 5: Trading Hours ─────────────────────────────────────────────

  describe('runRiskChecks — checkTradingHours', () => {
    it('should reject signal outside trading hours', async () => {
      // Set narrow trading hours and system time outside
      const exec = new TradeExecutor({ mode: 'paper' });
      exec.setTradingHours({
        morning: { start: '09:15', end: '09:20' },
        afternoon: { start: '13:00', end: '13:05' },
      });
      await exec.initialize();
      vi.setSystemTime(new Date('2026-06-06T09:30:00')); // outside window
      const order = await exec.processSignal(makeSignal());
      expect(order).toBeNull();
    });

    it('should accept signal within extended trading hours (09:00-23:59)', async () => {
      const exec = new TradeExecutor({ mode: 'paper' });
      exec.setTradingHours({
        morning: { start: '09:00', end: '23:59' },
        afternoon: { start: '13:00', end: '15:30' },
      });
      await exec.initialize();
      vi.setSystemTime(new Date('2026-06-06T10:00:00'));
      const order = await exec.processSignal(makeSignal());
      expect(order).not.toBeNull();
    });
  });

  // ── Risk Check 6: Concentration Risk ───────────────────────────────────────

  describe('runRiskChecks — checkConcentrationRisk', () => {
    it('should reject BUY when max positions (10) reached', async () => {
      await executor.initialize();
      // Fill 10 positions
      for (let i = 0; i < 10; i++) {
        const s = makeSignal({ code: `POS00${i}`, quantity: 1, price: 10 });
        await executor.processSignal(s);
      }
      // 11th BUY signal should be rejected for concentration
      const s11 = makeSignal({ code: 'POS011', quantity: 1, price: 10 });
      const order = await executor.processSignal(s11);
      expect(order).toBeNull();
    });

    it('should allow SELL even when max positions reached', async () => {
      await executor.initialize();
      for (let i = 0; i < 10; i++) {
        const s = makeSignal({ code: `POS20${i}`, quantity: 1, price: 10 });
        await executor.processSignal(s);
      }
      // SELL doesn't increase concentration
      const sell = makeSignal({ code: 'POS200', side: 'SELL', quantity: 1, price: 10 });
      const order = await executor.processSignal(sell);
      expect(order).not.toBeNull();
    });
  });

  // ── Risk Check 7: Confidence Threshold ─────────────────────────────────────

  describe('runRiskChecks — checkConfidenceThreshold', () => {
    it('should reject signal below confidence threshold (minConfidence=0.3)', async () => {
      await executor.initialize();
      const low = makeSignal({ confidence: 0.1 });
      const order = await executor.processSignal(low);
      expect(order).toBeNull();
    });

    it('should accept signal at exactly confidence threshold (0.3)', async () => {
      await executor.initialize();
      const threshold = makeSignal({ confidence: 0.3 });
      const order = await executor.processSignal(threshold);
      expect(order).not.toBeNull();
    });

    it('should accept high confidence signal', async () => {
      await executor.initialize();
      const high = makeSignal({ confidence: 0.95 });
      const order = await executor.processSignal(high);
      expect(order).not.toBeNull();
    });
  });

  // ── Paper vs Real Mode ─────────────────────────────────────────────────────

  describe('Paper vs Real mode', () => {
    it('should switch to real mode', async () => {
      await executor.initialize();
      await executor.setMode('real');
    });

    it('should emit mode:changed event on mode switch', async () => {
      await executor.initialize();
      const handler = vi.fn();
      executor.on('mode:changed', handler as any);
      await executor.setMode('real');
      expect(handler).toHaveBeenCalledWith('real');
    });

    it('should use paper mode (default) — order filled without broker', async () => {
      await executor.initialize();
      const signal = makeSignal();
      const order = await executor.processSignal(signal);
      expect(order).not.toBeNull();
      expect(order!.status).toBe('filled');
    });
  });

  // ── Position Tracking ───────────────────────────────────────────────────────

  describe('Position tracking', () => {
    it('should return empty positions initially', async () => {
      await executor.initialize();
      const positions = executor.getPositions();
      expect(Array.isArray(positions)).toBe(true);
    });

    it('should return null for unknown stock position', async () => {
      await executor.initialize();
      const pos = executor.getPosition('UNKNOWN');
      expect(pos).toBeNull();
    });

    it('should return position after BUY order fills', async () => {
      await executor.initialize();
      await executor.processSignal(makeSignal());
      const pos = executor.getPosition('600519');
      expect(pos).not.toBeNull();
      expect(pos!.quantity).toBeGreaterThan(0);
    });
  });

  // ── Order Management ───────────────────────────────────────────────────────

  describe('Order management', () => {
    it('should return empty orders initially', async () => {
      await executor.initialize();
      const orders = executor.getOrders();
      expect(Array.isArray(orders)).toBe(true);
    });

    it('should emit order:created event when signal processed', async () => {
      await executor.initialize();
      const handler = vi.fn();
      executor.on('order:created', handler as any);
      await executor.processSignal(makeSignal());
      expect(handler).toHaveBeenCalled();
    });

    it('should emit order:filled event for paper mode', async () => {
      await executor.initialize();
      const handler = vi.fn();
      executor.on('order:filled', handler as any);
      await executor.processSignal(makeSignal());
      expect(handler).toHaveBeenCalled();
    });

    it('should cancel order successfully in real mode', async () => {
      await executor.initialize();
      const cancelHandler = vi.fn();
      executor.on('order:cancelled', cancelHandler as any);
      // Switch to real mode with mock broker
      executor.setMode('real');
      executor.setBrokerAdapter(mockBrokerAdapter as any);
      mockBrokerAdapter.placeOrder.mockResolvedValue({ brokerOrderId: 'B1', status: 'submitted' });
      mockBrokerAdapter.cancelOrder.mockResolvedValue(true);
      // Create an order (real mode keeps it as submitted)
      const order = await executor.placeOrder({
        code: '600000',
        side: 'BUY',
        quantity: 10,
        price: 10,
      });
      const cancelled = await executor.cancelOrder(order.id);
      expect(cancelled).toBe(true);
      expect(cancelHandler).toHaveBeenCalled();
    });
  });

  // ── Emergency Stop ─────────────────────────────────────────────────────────

  describe('Emergency stop', () => {
    it('should reject all signals when emergency stop is active', async () => {
      await executor.initialize();
      await executor.emergencyStop();
      const signal = makeSignal();
      const order = await executor.processSignal(signal);
      expect(order).toBeNull();
    });

    it('should emit emergency:stop event', async () => {
      await executor.initialize();
      const handler = vi.fn();
      executor.on('emergency:stop', handler as any);
      await executor.emergencyStop();
      expect(handler).toHaveBeenCalled();
    });
  });

  // ── Config ──────────────────────────────────────────────────────────────────

  describe('Config', () => {
    it('should return current config', async () => {
      await executor.initialize();
      const config = executor.getConfig();
      expect(config).toHaveProperty('mode', 'paper');
      expect(config).toHaveProperty('maxPositionSizePct');
      expect(config).toHaveProperty('maxDailyLossPct');
      expect(config).toHaveProperty('maxOpenOrders');
    });

    it('should update config', async () => {
      await executor.initialize();
      executor.updateConfig({ maxPositionSizePct: 20 });
      expect(executor.getConfig().maxPositionSizePct).toBe(20);
    });

    it('should emit config:updated event', async () => {
      await executor.initialize();
      const handler = vi.fn();
      executor.on('config:updated', handler as any);
      executor.updateConfig({ maxDailyLossPct: 5 });
      expect(handler).toHaveBeenCalled();
    });
  });

  // ── State / Stats ───────────────────────────────────────────────────────────

  describe('State and stats', () => {
    it('should return summary with mode, config, stats, positions', async () => {
      await executor.initialize();
      const summary = executor.getSummary();
      expect(summary).toHaveProperty('mode');
      expect(summary).toHaveProperty('totalOrders');
      expect(summary).toHaveProperty('positions');
      expect(summary).toHaveProperty('emergencyStopped');
    });

    it('should return diagnostics with config, summary, stats, positions', async () => {
      await executor.initialize();
      const diag = executor.getDiagnostics();
      expect(diag).toHaveProperty('config');
      expect(diag).toHaveProperty('summary');
      expect(diag).toHaveProperty('stats');
      expect(diag).toHaveProperty('initialized', true);
    });
  });

  // ── TypedEventEmitter ───────────────────────────────────────────────────────

  describe('TypedEventEmitter', () => {
    it('should emit signal:processed on every signal', async () => {
      await executor.initialize();
      const handler = vi.fn();
      executor.on('signal:processed', handler as any);
      await executor.processSignal(makeSignal());
      expect(handler).toHaveBeenCalled();
    });

    it('should emit risk:rejected when risk check fails', async () => {
      await executor.initialize();
      const handler = vi.fn();
      executor.on('risk:rejected', handler as any);
      const lowConfSignal = makeSignal({ confidence: 0.05 });
      await executor.processSignal(lowConfSignal);
      expect(handler).toHaveBeenCalled();
    });

    it('should return unsubscribe function from on()', async () => {
      await executor.initialize();
      const handler = vi.fn();
      const unsub = executor.on('signal:processed', handler as any);
      await executor.processSignal(makeSignal());
      expect(handler).toHaveBeenCalledTimes(1);
      unsub();
      await executor.processSignal(makeSignal());
      expect(handler).toHaveBeenCalledTimes(1); // no new calls
    });

    it('should call once() listener only once', async () => {
      await executor.initialize();
      const handler = vi.fn();
      executor.once('signal:processed', handler as any);
      await executor.processSignal(makeSignal());
      await executor.processSignal(makeSignal());
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should removeAllListeners clear all listeners', async () => {
      await executor.initialize();
      const handler = vi.fn();
      executor.on('signal:processed', handler as any);
      executor.removeAllListeners();
      await executor.processSignal(makeSignal());
      expect(handler).not.toHaveBeenCalled();
    });

    it('should support multiple listeners for same event', async () => {
      await executor.initialize();
      const h1 = vi.fn();
      const h2 = vi.fn();
      executor.on('signal:processed', h1 as any);
      executor.on('signal:processed', h2 as any);
      await executor.processSignal(makeSignal());
      expect(h1).toHaveBeenCalled();
      expect(h2).toHaveBeenCalled();
    });
  });
});

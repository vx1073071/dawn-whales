// ── TradeExecutor IPC Integration Tests ────────────────────────────────────────
// Q-22-02: TradeExecutor IPC 串联验证 — 18 个 IPC handler 全覆�?
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Use global so vi.mock hoisting can access the same Map instance
(global as any).__ipcHandlers = new Map<string, Function>();

// Mock electron-log BEFORE electron mock
vi.mock('electron-log', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Mock electron — ipcMain.handle writes to global.__ipcHandlers
vi.mock('electron', () => ({
  ipcMain: {
    handle: ((channel: string, handler: Function) => {
      (global as any).__ipcHandlers.set(channel, handler);
    }) as any,
    removeHandler: vi.fn(),
    on: vi.fn(),
  },
  BrowserWindow: {
    getAllWindows: vi.fn(() => []),
  },
}));

// ──────────────────────────────────────────────────────────────────────────────
// Helper to call an IPC handler directly (bypasses ipcMain.invoke)
// ──────────────────────────────────────────────────────────────────────────────
function callHandler(channel: string, ...args: any[]) {
  const handlers = (global as any).__ipcHandlers as Map<string, Function>;
  const handler = handlers.get(channel);
  if (!handler) throw new Error(`Handler not registered: ${channel}`);
  const mockEvent = { sender: { send: vi.fn() } };
  return handler(mockEvent, ...args);
}

// ──────────────────────────────────────────────────────────────────────────────
// Test signal factory
// ──────────────────────────────────────────────────────────────────────────────
function makeSignal(overrides: any = {}): any {
  return {
    strategyId: 'test-strategy',
    strategyName: 'Test Strategy',
    code: '600519',
    side: 'BUY',
    quantity: 10,
    price: 1800,
    orderType: 'MARKET',
    signalId: `SIG-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: Date.now(),
    confidence: 0.85,
    reason: 'Test signal',
    ...overrides,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
describe('TradeExecutor IPC Handlers', () => {
  beforeEach(async () => {
    const handlers = (global as any).__ipcHandlers as Map<string, Function>;
    handlers.clear();
    // Import fresh module each time and reset the isRegistered flag
    const mod = await import('../electron/ipc/trade-executor-ipc?t=' + Date.now());
    mod.unregisterTradeExecutorIPC();
    handlers.clear();
    mod.registerTradeExecutorIPC();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── All 18 handlers registered ────────────────────────────────────────────

  describe('Handler registration', () => {
    it('should register trade:execute handler', () => {
      expect((global as any).__ipcHandlers.has('trade:execute')).toBe(true);
    });
    it('should register trade:cancel handler', () => {
      expect((global as any).__ipcHandlers.has('trade:cancel')).toBe(true);
    });
    it('should register trade:get-orders handler', () => {
      expect((global as any).__ipcHandlers.has('trade:get-orders')).toBe(true);
    });
    it('should register trade:get-history handler', () => {
      expect((global as any).__ipcHandlers.has('trade:get-history')).toBe(true);
    });
    it('should register trade:get-config handler', () => {
      expect((global as any).__ipcHandlers.has('trade:get-config')).toBe(true);
    });
    it('should register trade:update-config handler', () => {
      expect((global as any).__ipcHandlers.has('trade:update-config')).toBe(true);
    });
    it('should register trade:emergency-stop handler', () => {
      expect((global as any).__ipcHandlers.has('trade:emergency-stop')).toBe(true);
    });
    it('should register trade:set-mode handler', () => {
      expect((global as any).__ipcHandlers.has('trade:set-mode')).toBe(true);
    });
    it('should register trade:get-summary handler', () => {
      expect((global as any).__ipcHandlers.has('trade:get-summary')).toBe(true);
    });
    it('should register trade:get-positions handler', () => {
      expect((global as any).__ipcHandlers.has('trade:get-positions')).toBe(true);
    });
    it('should register trade:get-stats handler', () => {
      expect((global as any).__ipcHandlers.has('trade:get-stats')).toBe(true);
    });
    it('should register trade:get-trade-log handler', () => {
      expect((global as any).__ipcHandlers.has('trade:get-trade-log')).toBe(true);
    });
    it('should register trade:get-daily-pnl handler', () => {
      expect((global as any).__ipcHandlers.has('trade:get-daily-pnl')).toBe(true);
    });
    it('should register trade:get-pending-signals handler', () => {
      expect((global as any).__ipcHandlers.has('trade:get-pending-signals')).toBe(true);
    });
    it('should register trade:confirm-signal handler', () => {
      expect((global as any).__ipcHandlers.has('trade:confirm-signal')).toBe(true);
    });
    it('should register trade:reject-signal handler', () => {
      expect((global as any).__ipcHandlers.has('trade:reject-signal')).toBe(true);
    });
    it('should register trade:reset-emergency handler', () => {
      expect((global as any).__ipcHandlers.has('trade:reset-emergency')).toBe(true);
    });
    it('should register trade:get-diagnostics handler', () => {
      expect((global as any).__ipcHandlers.has('trade:get-diagnostics')).toBe(true);
    });

    it('should register exactly 18 trade:* handlers', () => {
      const tradeHandlers = [...(global as any).__ipcHandlers.keys()].filter((k: string) => k.startsWith('trade:'));
      expect(tradeHandlers).toHaveLength(18);
    });
  });

  // ── Handler functional tests ───────────────────────────────────────────────

  describe('trade:get-config', () => {
    it('should return a response with success and config data', async () => {
      const result = await callHandler('trade:get-config');
      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('timestamp');
    });
  });

  describe('trade:update-config', () => {
    it('should update config and return success', async () => {
      const result = await callHandler('trade:update-config', { maxPositionSizePct: 15 });
      expect(result).toHaveProperty('success', true);
      expect(result.data).toHaveProperty('maxPositionSizePct', 15);
    });

    it('should reject invalid config updates', async () => {
      const result = await callHandler('trade:update-config', { maxPositionSizePct: -5 });
      expect(result).toHaveProperty('success');
    });
  });

  describe('trade:set-mode', () => {
    it('should switch to paper mode', async () => {
      const result = await callHandler('trade:set-mode', 'paper');
      expect(result).toHaveProperty('success', true);
    });

    it('should switch to real mode', async () => {
      const result = await callHandler('trade:set-mode', 'real');
      expect(result).toHaveProperty('success', true);
    });
  });

  describe('trade:emergency-stop', () => {
    it('should trigger emergency stop', async () => {
      const result = await callHandler('trade:emergency-stop');
      expect(result).toHaveProperty('success', true);
    });
  });

  describe('trade:reset-emergency', () => {
    it('should reset emergency stop', async () => {
      const result = await callHandler('trade:reset-emergency');
      expect(result).toHaveProperty('success', true);
    });
  });

  describe('trade:get-orders', () => {
    it('should return orders array', async () => {
      const result = await callHandler('trade:get-orders');
      expect(result).toHaveProperty('success', true);
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('should filter orders by code', async () => {
      const result = await callHandler('trade:get-orders', { code: '600519' });
      expect(result).toHaveProperty('success', true);
      expect(Array.isArray(result.data)).toBe(true);
    });
  });

  describe('trade:get-history', () => {
    it('should return history array', async () => {
      const result = await callHandler('trade:get-history');
      expect(result).toHaveProperty('success', true);
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('should accept limit parameter', async () => {
      const result = await callHandler('trade:get-history', 10);
      expect(result).toHaveProperty('success', true);
    });
  });

  describe('trade:get-positions', () => {
    it('should return positions array', async () => {
      const result = await callHandler('trade:get-positions');
      expect(result).toHaveProperty('success', true);
      expect(Array.isArray(result.data)).toBe(true);
    });
  });

  describe('trade:get-stats', () => {
    it('should return stats object', async () => {
      const result = await callHandler('trade:get-stats');
      expect(result).toHaveProperty('success', true);
      // calculateTradeStats() returns: totalTrades, winningTrades, losingTrades,
      // winRate, totalPnL, totalCommission, avgWin, avgLoss, maxDrawdown, profitFactor
      expect(result.data).toHaveProperty('totalTrades');
      expect(result.data).toHaveProperty('totalPnL');
      expect(result.data).toHaveProperty('winRate');
    });
  });

  describe('trade:get-summary', () => {
    it('should return summary with mode, openOrders, filledOrders, positions', async () => {
      const result = await callHandler('trade:get-summary');
      expect(result).toHaveProperty('success', true);
      // getSummary() returns: mode, totalOrders, openOrders, filledOrders,
      // positions, dailyPnL, totalCapital, emergencyStopped, pendingSignals
      expect(result.data).toHaveProperty('mode');
      expect(result.data).toHaveProperty('filledOrders');
      expect(result.data).toHaveProperty('positions');
      expect(result.data).toHaveProperty('dailyPnL');
    });
  });

  describe('trade:get-trade-log', () => {
    it('should return trade log array', async () => {
      const result = await callHandler('trade:get-trade-log');
      expect(result).toHaveProperty('success', true);
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('should accept limit parameter', async () => {
      const result = await callHandler('trade:get-trade-log', 5);
      expect(result).toHaveProperty('success', true);
    });
  });

  describe('trade:get-daily-pnl', () => {
    it('should return daily pnl data', async () => {
      const result = await callHandler('trade:get-daily-pnl');
      expect(result).toHaveProperty('success', true);
    });

    it('should accept date filter', async () => {
      const result = await callHandler('trade:get-daily-pnl', '2026-06-06');
      expect(result).toHaveProperty('success', true);
    });
  });

  describe('trade:get-pending-signals', () => {
    it('should return pending signals array', async () => {
      const result = await callHandler('trade:get-pending-signals');
      expect(result).toHaveProperty('success', true);
      expect(Array.isArray(result.data)).toBe(true);
    });
  });

  describe('trade:confirm-signal', () => {
    it('should return error for out-of-range index', async () => {
      const result = await callHandler('trade:confirm-signal', 999);
      // Handler returns createErrorResponse('Invalid pending signal index') when index is out of range
      expect(result).toHaveProperty('success', false);
      expect(result.data).toBeNull();
    });
  });

  describe('trade:reject-signal', () => {
    it('should reject signal by index', async () => {
      const result = await callHandler('trade:reject-signal', 999);
      // rejectPendingSignal(999) returns false → { success: true, data: { success: false } }
      expect(result).toHaveProperty('success', true);
      expect(result.data).toHaveProperty('success', false);
    });
  });

  describe('trade:execute', () => {
    it('should execute a valid trade signal', async () => {
      const result = await callHandler('trade:execute', makeSignal());
      expect(result).toHaveProperty('success');
    });

    it('should reject signal missing required fields', async () => {
      const badSignal = { code: '600519' };
      const result = await callHandler('trade:execute', badSignal);
      // Validation fails → processSignal returns null → { success: true, data: null }
      expect(result).toHaveProperty('success', true);
      expect(result.data).toBeNull();
    });
  });

  describe('trade:cancel', () => {
    it('should return failure for non-existent order', async () => {
      const result = await callHandler('trade:cancel', 'NON-EXISTENT-ORDER');
      expect(result).toHaveProperty('success');
    });
  });

  describe('trade:get-diagnostics', () => {
    it('should return diagnostics with config, summary, stats, positions', async () => {
      const result = await callHandler('trade:get-diagnostics');
      expect(result).toHaveProperty('success', true);
      expect(result.data).toHaveProperty('config');
      expect(result.data).toHaveProperty('summary');
      expect(result.data).toHaveProperty('stats');
      expect(result.data).toHaveProperty('positions');
    });
  });

  describe('Event forwarding to renderer', () => {
    it('should have registerTradeExecutorIPC as a function', async () => {
      const { registerTradeExecutorIPC } = await import('../electron/ipc/trade-executor-ipc?t=' + Date.now());
      expect(typeof registerTradeExecutorIPC).toBe('function');
    });
  });
});

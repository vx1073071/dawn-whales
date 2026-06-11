import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('electron-log', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn(), on: vi.fn() },
  BrowserWindow: { getAllWindows: vi.fn(() => []) },
}));

import { getTradeExecutor, resetTradeExecutor } from '../electron/engine/analysis/trade-executor';

describe('DEBUG signal', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-06T10:00:00+08:00'));
    resetTradeExecutor();
  });

  it('basic signal test', async () => {
    const executor = getTradeExecutor({
      mode: 'paper',
      requireConfirmation: false, // Skip confirmation step for direct execution
      // Use 24/7 trading hours to avoid dependency on system clock in jsdom
      tradingHours: {
        morning: { start: '00:00', end: '23:59' },
        afternoon: { start: '00:00', end: '23:59' },
      },
    });
    await executor.initialize();
    console.log('requireConfirmation:', executor.getConfig().requireConfirmation);
    console.log('initialized:', (executor as any).initialized);
    const signal = {
      code: '600519', side: 'BUY' as const, quantity: 50, price: 1800,
      strategyId: 's1', strategyName: 'S1',
      signalId: 'SIG-1', timestamp: Date.now(), confidence: 0.85,
      orderType: 'MARKET' as const,
      reason: 'Test signal',
    };
    // Test validateSignal directly
    const validateResult = (executor as any).validateSignal(signal);
    console.log('validateSignal:', validateResult);

    // Test runRiskChecks directly
    const riskCheck = await (executor as any).runRiskChecks(signal);
    console.log('riskCheck passed:', riskCheck.passed);
    console.log('riskCheck reason:', riskCheck.reason);
    riskCheck.checks.forEach((c: any) => {
      if (!c.passed) console.log('  FAILED:', c.name, 'value:', c.value, 'limit:', c.limit);
    });

    // Test the full flow
    const order = await executor.processSignal(signal);
    console.log('Order result:', JSON.stringify(order));
    expect(order).not.toBeNull();
  });
});

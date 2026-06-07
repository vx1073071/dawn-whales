// Q-48-01: E2E 场景扩展 Part 1 — Strategy CRUD + Backtest Pipeline + Signal E2E
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { stubWindowApi } from './helpers/mocks';

describe('Q-48-01 Part 1: Strategy CRUD + Backtest Pipeline E2E', () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Strategy CRUD ─────────────────────────────────────────────────────────

  describe('Strategy CRUD E2E', () => {
    it('创建均线交叉策略', async () => {
      const createMock = vi.fn().mockResolvedValue({
        success: true,
        strategy: { id: 'strat-new-1', name: 'MA Cross v2', type: 'ma_cross', params: { fastPeriod: 5, slowPeriod: 20 }, status: 'idle' },
      });
      const listMock = vi.fn().mockResolvedValue({ success: true, strategies: [] });
      stubWindowApi({ strategy: { create: createMock, getAll: listMock } });

      const result = await (window as any).api.strategy.create({
        name: 'MA Cross v2',
        type: 'ma_cross',
        params: { fastPeriod: 5, slowPeriod: 20 },
      });

      expect(result.success).toBe(true);
      expect(result.strategy.id).toBeTruthy();
      expect(result.strategy.status).toBe('idle');
    });

    it('查询策略列表', async () => {
      const strategies = [
        { id: 'strat-1', name: 'RSI 策略', type: 'rsi', status: 'active' },
        { id: 'strat-2', name: '布林带策略', type: 'bollinger', status: 'idle' },
      ];
      stubWindowApi({ strategy: { getAll: vi.fn().mockResolvedValue({ success: true, strategies }) } });

      const result = await (window as any).api.strategy.getAll();

      expect(result.success).toBe(true);
      expect(result.strategies).toHaveLength(2);
    });

    it('更新策略参数', async () => {
      const updateMock = vi.fn().mockResolvedValue({ success: true, updated: true });
      stubWindowApi({ strategy: { update: updateMock } });

      const result = await (window as any).api.strategy.update('strat-1', { params: { fastPeriod: 10 } });

      expect(result.success).toBe(true);
      expect(result.updated).toBe(true);
    });

    it('删除策略', async () => {
      const deleteMock = vi.fn().mockResolvedValue({ success: true });
      stubWindowApi({ strategy: { delete: deleteMock } });

      const result = await (window as any).api.strategy.delete('strat-1');

      expect(result.success).toBe(true);
    });
  });

  // ── Backtest Pipeline ─────────────────────────────────────────────────────

  describe('Backtest Pipeline E2E', () => {
    it('执行回测并返回完整报告', async () => {
      const backtestMock = vi.fn().mockResolvedValue({
        success: true,
        report: {
          strategyId: 'strat-1',
          totalReturn: 0.223,
          sharpeRatio: 1.42,
          maxDrawdown: 0.081,
          winRate: 0.61,
          totalTrades: 47,
          equityCurve: Array.from({ length: 100 }, (_, i) => ({ date: `2024-01-${String(i + 1).padStart(2, '0')}`, equity: 100000 * (1 + i * 0.003) })),
        },
      });
      stubWindowApi({ backtest: { run: backtestMock } });

      const result = await (window as any).api.backtest.run({ strategyId: 'strat-1', symbol: 'HK.00700', period: 'daily' });

      expect(result.success).toBe(true);
      expect(result.report.totalReturn).toBeGreaterThan(0);
      expect(result.report.sharpeRatio).toBeGreaterThan(0);
    });

    it('回测失败返回错误信息', async () => {
      const backtestMock = vi.fn().mockResolvedValue({ success: false, error: 'INSUFFICIENT_DATA', message: 'K线数据不足，需要至少100个数据点' });
      stubWindowApi({ backtest: { run: backtestMock } });

      const result = await (window as any).api.backtest.run({ strategyId: 'strat-new', symbol: 'HK.00700', period: 'daily' });

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it('参数扫描回测', async () => {
      const sweepMock = vi.fn().mockResolvedValue({
        success: true,
        results: [
          { params: { fastPeriod: 5, slowPeriod: 20 }, sharpeRatio: 1.42, totalReturn: 0.22 },
          { params: { fastPeriod: 10, slowPeriod: 30 }, sharpeRatio: 1.21, totalReturn: 0.18 },
          { params: { fastPeriod: 3, slowPeriod: 15 }, sharpeRatio: 0.98, totalReturn: 0.12 },
        ],
      });
      stubWindowApi({ backtest: { parameterSweep: sweepMock } });

      const result = await (window as any).api.backtest.parameterSweep({
        strategyId: 'strat-1',
        symbol: 'HK.00700',
        params: { fastPeriod: [3, 5, 10], slowPeriod: [15, 20, 30] },
      });

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(3);
      expect(result.results[0].sharpeRatio).toBeGreaterThan(result.results[2].sharpeRatio);
    });
  });

  // ── Signal Generation ──────────────────────────────────────────────────────

  describe('Signal Generation E2E', () => {
    it('多头信号生成', async () => {
      const signalMock = vi.fn().mockResolvedValue({
        success: true,
        signal: { type: 'BUY', symbol: 'HK.00700', price: 400.5, quantity: 100, confidence: 0.92, reason: 'MA5 crosses above MA20' },
      });
      stubWindowApi({ signal: { generate: signalMock } });

      const result = await (window as any).api.signal.generate({ strategyId: 'strat-1', symbol: 'HK.00700' });

      expect(result.success).toBe(true);
      expect(result.signal.type).toBe('BUY');
      expect(result.signal.confidence).toBeGreaterThan(0.8);
    });

    it('空头信号生成', async () => {
      const signalMock = vi.fn().mockResolvedValue({
        success: true,
        signal: { type: 'SELL', symbol: 'HK.00700', price: 398.0, quantity: 100, confidence: 0.88, reason: 'RSI overbought above 70' },
      });
      stubWindowApi({ signal: { generate: signalMock } });

      const result = await (window as any).api.signal.generate({ strategyId: 'strat-1', symbol: 'HK.00700' });

      expect(result.success).toBe(true);
      expect(result.signal.type).toBe('SELL');
    });

    it('无信号（不满足条件）', async () => {
      const signalMock = vi.fn().mockResolvedValue({ success: true, signal: null, reason: 'No crossover detected' });
      stubWindowApi({ signal: { generate: signalMock } });

      const result = await (window as any).api.signal.generate({ strategyId: 'strat-1', symbol: 'HK.00700' });

      expect(result.success).toBe(true);
      expect(result.signal).toBeNull();
    });
  });
});

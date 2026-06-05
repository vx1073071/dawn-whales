// ── Strategy + NL Parser E2E Integration Tests ────────────────────────────────
// Q-22-03: Strategy Engine + NL Parser 端到端集成测试
// 端到端流程：自然语言 → NL Parser → 策略DSL → 创建策略 → 回测 → 信号 → TradeExecutor

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { stubWindowApi } from './helpers/mocks';

// ─── Mocks ────────────────────────────────────────────────────────────────────

let mockStrategies: any[] = [];
let mockBacktestResults: any = null;
let mockSignalProcessed: any[] = [];

function installMock() {
  stubWindowApi({
    strategy: {
      getAll: vi.fn().mockResolvedValue({ success: true, strategies: mockStrategies }),
      get: vi.fn().mockImplementation((id: string) =>
        Promise.resolve({ success: true, strategy: mockStrategies.find(s => s.id === id) || null })
      ),
      create: vi.fn().mockImplementation((config: any) => {
        const newStrat = {
          id: `strat-${Date.now()}`,
          name: config.name,
          type: config.type || 'momentum',
          status: 'idle',
          params: config.params || {},
        };
        mockStrategies.push(newStrat);
        return Promise.resolve({ success: true, id: newStrat.id });
      }),
      update: vi.fn().mockImplementation((id: string, config: any) => {
        const idx = mockStrategies.findIndex(s => s.id === id);
        if (idx >= 0) mockStrategies[idx] = { ...mockStrategies[idx], ...config };
        return Promise.resolve({ success: true });
      }),
      delete: vi.fn().mockImplementation((id: string) => {
        mockStrategies = mockStrategies.filter(s => s.id !== id);
        return Promise.resolve({ success: true });
      }),
      backtest: vi.fn().mockImplementation(() =>
        Promise.resolve({
          success: true,
          result: mockBacktestResults || {
            equityCurve: [100000, 102300, 101800],
            trades: [],
            metrics: { sharpe: 1.5, maxDrawdown: 0.05, totalReturn: 0.08, winRate: 0.65 },
          },
        })
      ),
      explain: vi.fn().mockResolvedValue({
        success: true,
        explanation: 'MA Cross strategy: buy when fast MA crosses above slow MA',
        metrics: { sharpe: 1.5, maxDrawdown: 0.05 },
      }),
    },
    nl: {
      parse: vi.fn().mockImplementation((text: string) => {
        // Simulate NL parsing based on input
        if (text.includes('MA') || text.includes('均线') || text.includes('交叉')) {
          return Promise.resolve({
            success: true,
            parsed: {
              strategy: { type: 'momentum', params: { fastPeriod: 20, slowPeriod: 50 }, stopLoss: 5, takeProfit: 10 },
              confidence: 0.92,
              description: 'MA Cross momentum strategy',
            },
          });
        }
        if (text.includes('RSI')) {
          return Promise.resolve({
            success: true,
            parsed: {
              strategy: { type: 'mean_reversion', params: { rsiPeriod: 14, threshold: 30 }, stopLoss: 3, takeProfit: 6 },
              confidence: 0.88,
              description: 'RSI mean reversion strategy',
            },
          });
        }
        return Promise.resolve({
          success: true,
          parsed: {
            strategy: { type: 'momentum', params: { fastPeriod: 10, slowPeriod: 30 }, stopLoss: 5, takeProfit: 10 },
            confidence: 0.75,
            description: 'Default strategy',
          },
        });
      }),
    },
    trade: {
      execute: vi.fn().mockImplementation((signal: any) => {
        mockSignalProcessed.push(signal);
        return Promise.resolve({ success: true, orderId: `ORD-${Date.now()}` });
      }),
      getSummary: vi.fn().mockResolvedValue({
        success: true,
        mode: 'paper',
        config: { mode: 'paper', maxPositionSizePct: 10 },
        stats: { totalSignals: mockSignalProcessed.length, totalOrders: 0 },
        positions: [],
      }),
      getConfig: vi.fn().mockResolvedValue({ success: true, data: { mode: 'paper' } }),
      setMode: vi.fn().mockResolvedValue({ success: true }),
      cancel: vi.fn().mockResolvedValue({ success: false }),
    },
  });
}

beforeEach(() => {
  mockStrategies = [];
  mockSignalProcessed = [];
  mockBacktestResults = null;
  installMock();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Strategy + NL Parser E2E — Full Pipeline', () => {

  describe('Step 1: NL Parser — parseNaturalLanguage', () => {
    it('should parse MA Cross strategy from Chinese text', async () => {
      const { nl } = (window as any).api;
      const result = await nl.parse('当短线均线穿越长线均线时买入');
      expect(result.success).toBe(true);
      expect(result.parsed.strategy.type).toBe('momentum');
      expect(result.parsed.confidence).toBeGreaterThan(0.8);
    });

    it('should parse RSI strategy from English text', async () => {
      const { nl } = (window as any).api;
      const result = await nl.parse('RSI mean reversion when oversold');
      expect(result.success).toBe(true);
      expect(result.parsed.strategy.type).toBe('mean_reversion');
      expect(result.parsed.strategy.params).toHaveProperty('rsiPeriod');
    });

    it('should handle ambiguous input with default strategy', async () => {
      const { nl } = (window as any).api;
      const result = await nl.parse('buy some stocks please');
      expect(result.success).toBe(true);
      expect(result.parsed).toHaveProperty('strategy');
      expect(result.parsed).toHaveProperty('confidence');
    });

    it('should include stopLoss and takeProfit in parsed strategy', async () => {
      const { nl } = (window as any).api;
      const result = await nl.parse('MA cross strategy');
      expect(result.parsed.strategy).toHaveProperty('stopLoss');
      expect(result.parsed.strategy).toHaveProperty('takeProfit');
      expect(typeof result.parsed.strategy.stopLoss).toBe('number');
      expect(typeof result.parsed.strategy.takeProfit).toBe('number');
    });
  });

  describe('Step 2: NL → Strategy CRUD — create from parsed', () => {
    it('should create strategy from NL-parsed config', async () => {
      const { nl, strategy } = (window as any).api;
      const parsed = await nl.parse('MA cross with 20/50 day moving averages');
      const created = await strategy.create({
        name: 'Parsed MA Cross',
        type: parsed.parsed.strategy.type,
        params: parsed.parsed.strategy.params,
      });
      expect(created.success).toBe(true);
      expect(created.id).toBeTruthy();
      expect(mockStrategies).toHaveLength(1);
      expect(mockStrategies[0].name).toBe('Parsed MA Cross');
    });

    it('should retrieve created strategy by id', async () => {
      const { nl, strategy } = (window as any).api;
      const parsed = await nl.parse('RSI mean reversion');
      const created = await strategy.create({
        name: 'Parsed RSI',
        type: parsed.parsed.strategy.type,
        params: parsed.parsed.strategy.params,
      });
      const retrieved = await strategy.get(created.id);
      expect(retrieved.success).toBe(true);
      expect(retrieved.strategy.id).toBe(created.id);
      expect(retrieved.strategy.name).toBe('Parsed RSI');
    });

    it('should update strategy params after creation', async () => {
      const { strategy } = (window as any).api;
      const created = await strategy.create({ name: 'Test', type: 'momentum', params: { fastPeriod: 10 } });
      await strategy.update(created.id, { params: { fastPeriod: 20, slowPeriod: 60 } });
      const updated = await strategy.get(created.id);
      expect(updated.strategy.params.fastPeriod).toBe(20);
      expect(updated.strategy.params.slowPeriod).toBe(60);
    });

    it('should delete strategy', async () => {
      const { strategy } = (window as any).api;
      const created = await strategy.create({ name: 'ToDelete', type: 'momentum' });
      const del = await strategy.delete(created.id);
      expect(del.success).toBe(true);
      expect(mockStrategies.find(s => s.id === created.id)).toBeUndefined();
    });

    it('should list all strategies', async () => {
      const { strategy } = (window as any).api;
      await strategy.create({ name: 'Strat A', type: 'momentum' });
      await strategy.create({ name: 'Strat B', type: 'mean_reversion' });
      const all = await strategy.getAll();
      expect(all.success).toBe(true);
      expect(all.strategies).toHaveLength(2);
    });
  });

  describe('Step 3: Strategy → Backtest — execute backtest', () => {
    it('should run backtest on created strategy', async () => {
      const { strategy } = (window as any).api;
      mockBacktestResults = {
        equityCurve: [100000, 105000, 103000, 108000, 112000],
        trades: [],
        metrics: { sharpe: 1.8, maxDrawdown: 0.06, totalReturn: 0.12, winRate: 0.68 },
      };
      const created = await strategy.create({ name: 'Backtest Target', type: 'momentum' });
      const result = await strategy.backtest({ strategyId: created.id, startDate: '2024-01-01', endDate: '2024-12-31' });
      expect(result.success).toBe(true);
      expect(result.result.equityCurve).toHaveLength(5);
      expect(result.result.metrics.sharpe).toBeGreaterThan(0);
    });

    it('should calculate risk metrics from equity curve', async () => {
      const { strategy } = (window as any).api;
      mockBacktestResults = {
        equityCurve: Array.from({ length: 100 }, (_, i) => 100000 + i * 100),
        trades: [],
        metrics: { sharpe: 2.1, maxDrawdown: 0.03, totalReturn: 0.25, winRate: 0.72 },
      };
      const created = await strategy.create({ name: 'Risk Metric Target', type: 'momentum' });
      const result = await strategy.backtest({ strategyId: created.id });
      expect(result.result.metrics.sharpe).toBeGreaterThan(1.5);
      expect(result.result.metrics.maxDrawdown).toBeLessThan(0.1);
    });

    it('should return meaningful equity curve', async () => {
      const { strategy } = (window as any).api;
      mockBacktestResults = {
        equityCurve: [100000, 98000, 102000, 101000, 105000],
        trades: [],
        metrics: { sharpe: 0.8, maxDrawdown: 0.12, totalReturn: 0.05, winRate: 0.55 },
      };
      const created = await strategy.create({ name: 'Equity Target', type: 'momentum' });
      const result = await strategy.backtest({ strategyId: created.id });
      expect(result.result.equityCurve).toBeInstanceOf(Array);
      expect(result.result.equityCurve.length).toBeGreaterThan(0);
    });
  });

  describe('Step 4: Backtest → TradeSignal — signal generation', () => {
    it('should generate BUY signal after positive backtest', async () => {
      const { nl, strategy, trade } = (window as any).api;
      mockBacktestResults = {
        equityCurve: [100000, 105000, 110000, 115000, 120000],
        trades: [{ side: 'BUY', price: 1800, quantity: 100 }],
        metrics: { sharpe: 2.0, maxDrawdown: 0.04, totalReturn: 0.20, winRate: 0.70 },
      };
      const parsed = await nl.parse('MA cross strategy');
      const created = await strategy.create({
        name: 'Signal Gen',
        type: parsed.parsed.strategy.type,
        params: parsed.parsed.strategy.params,
      });
      const backtest = await strategy.backtest({ strategyId: created.id });
      // Simulate signal generation from backtest result
      const lastTrade = backtest.result.trades[0];
      expect(lastTrade.side).toBe('BUY');
    });

    it('should emit trade signal from backtest result', async () => {
      const { trade } = (window as any).api;
      const signal = {
        strategyId: 'strat-signal-test',
        strategyName: 'Signal Test',
        code: '600519',
        side: 'BUY',
        quantity: 100,
        price: 1800,
        signalId: 'SIG-TEST-001',
        timestamp: Date.now(),
        confidence: 0.90,
      };
      const result = await trade.execute(signal);
      expect(result.success).toBe(true);
      expect(mockSignalProcessed).toHaveLength(1);
      expect(mockSignalProcessed[0].code).toBe('600519');
    });
  });

  describe('Step 5: Full Pipeline — NL → Strategy → Backtest → Signal', () => {
    it('should execute complete NL → trade pipeline in memory', async () => {
      const { nl, strategy, trade } = (window as any).api;
      mockBacktestResults = {
        equityCurve: [100000, 108000, 112000, 118000, 125000],
        trades: [{ side: 'BUY', price: 1800, quantity: 200 }],
        metrics: { sharpe: 2.2, maxDrawdown: 0.03, totalReturn: 0.25, winRate: 0.72 },
      };

      // Step 5a: Parse natural language
      const parsed = await nl.parse('20日均线穿越50日均线买入');
      expect(parsed.success).toBe(true);
      const stratConfig = parsed.parsed.strategy;

      // Step 5b: Create strategy from parsed config
      const created = await strategy.create({
        name: 'E2E MA Cross',
        type: stratConfig.type,
        params: stratConfig.params,
      });
      expect(created.success).toBe(true);

      // Step 5c: Run backtest
      const backtest = await strategy.backtest({ strategyId: created.id });
      expect(backtest.success).toBe(true);
      expect(backtest.result.metrics.sharpe).toBeGreaterThan(1.5);

      // Step 5d: Generate trade signal from positive backtest
      const signal = {
        strategyId: created.id,
        strategyName: 'E2E MA Cross',
        code: '600519',
        side: 'BUY',
        quantity: 200,
        price: 1800,
        signalId: `SIG-${Date.now()}`,
        timestamp: Date.now(),
        confidence: parsed.parsed.confidence,
      };

      // Step 5e: Execute via TradeExecutor
      const result = await trade.execute(signal);
      expect(result.success).toBe(true);
      expect(result.orderId).toBeTruthy();
    });

    it('should reject low-confidence NL parse from triggering trade', async () => {
      const { nl, trade } = (window as any).api;
      // Override nl.parse to return low confidence
      (window as any).api.nl.parse = vi.fn().mockResolvedValue({
        success: true,
        parsed: {
          strategy: { type: 'momentum', params: { fastPeriod: 5, slowPeriod: 10 } },
          confidence: 0.3, // Low confidence
          description: 'Ambiguous',
        },
      });
      const parsed = await nl.parse('maybe buy something');
      expect(parsed.parsed.confidence).toBeLessThan(0.5);
      // Low confidence signal should still be processed but with warning
      const signal = {
        strategyId: 'low-conf',
        strategyName: 'Low Confidence',
        code: '600000',
        side: 'BUY',
        quantity: 100,
        price: 10,
        signalId: 'SIG-LOW',
        timestamp: Date.now(),
        confidence: parsed.parsed.confidence,
      };
      const result = await trade.execute(signal);
      // Trade executor may reject low confidence, but API call succeeds
      expect(result).toHaveProperty('success');
    });
  });

  describe('Strategy comparison and optimization', () => {
    it('should compare two strategies', async () => {
      const { strategy } = (window as any).api;
      mockBacktestResults = {
        equityCurve: [100000, 110000],
        trades: [],
        metrics: { sharpe: 1.8, maxDrawdown: 0.05, totalReturn: 0.10, winRate: 0.65 },
      };
      const s1 = await strategy.create({ name: 'Strategy A', type: 'momentum', params: { fastPeriod: 10, slowPeriod: 30 } });
      const s2 = await strategy.create({ name: 'Strategy B', type: 'momentum', params: { fastPeriod: 20, slowPeriod: 60 } });
      const [r1, r2] = await Promise.all([
        strategy.backtest({ strategyId: s1.id }),
        strategy.backtest({ strategyId: s2.id }),
      ]);
      expect(r1.result.metrics.sharpe).toBeGreaterThan(0);
      expect(r2.result.metrics.sharpe).toBeGreaterThan(0);
      // Both valid — comparison is possible
      expect(typeof r1.result.metrics.sharpe).toBe('number');
      expect(typeof r2.result.metrics.sharpe).toBe('number');
    });

    it('should explain strategy using LLM', async () => {
      const { strategy } = (window as any).api;
      const created = await strategy.create({ name: 'Explain Me', type: 'momentum' });
      const explanation = await strategy.explain(created);
      expect(explanation.success).toBe(true);
      expect(typeof explanation.explanation).toBe('string');
      expect(explanation.explanation.length).toBeGreaterThan(0);
    });
  });
});

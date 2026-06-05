/**
 * Strategy + Backtest IPC Tests (Q-21-03)
 * Tests strategy CRUD and backtest execution via IPC.
 * Uses mocks.ts stubWindowApi.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { stubWindowApi } from './helpers/mocks';

// ─── Mock window.api ──────────────────────────────────────────────────────────
let mockStrategies: any[] = [
  { id: 'strat-1', name: 'Momentum MA Cross', type: 'momentum', status: 'active', params: { fastPeriod: 10, slowPeriod: 30 } },
  { id: 'strat-2', name: 'Mean Reversion RSI', type: 'mean_reversion', status: 'idle', params: { rsiPeriod: 14, threshold: 30 } },
];

let mockBacktestResults: any = {
  equityCurve: [100000, 102300, 101800, 104500, 106200, 105800, 108900],
  trades: [],
  metrics: { sharpe: 1.42, maxDrawdown: 0.08, totalReturn: 0.089, winRate: 0.62 },
};

let mockParsedStrategy: any = {
  strategy: {
    type: 'momentum',
    params: { fastPeriod: 20, slowPeriod: 50 },
    stopLoss: 5,
    takeProfit: 10,
    description: 'MA Cross momentum strategy',
  },
  confidence: 0.92,
};

function installMock() {
  stubWindowApi({
    strategy: {
      getAll: vi.fn().mockResolvedValue({ success: true, strategies: mockStrategies }),
      get: vi.fn().mockImplementation((id: string) =>
        Promise.resolve({ success: true, strategy: mockStrategies.find(s => s.id === id) || null })
      ),
      create: vi.fn().mockImplementation((config: any) => {
        const newStrat = { id: `strat-${Date.now()}`, name: config.name, type: config.type || 'momentum', status: 'idle', params: config.params || {} };
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
      backtest: vi.fn().mockResolvedValue({ success: true, ...mockBacktestResults }),
      optimize: vi.fn().mockResolvedValue({ success: true, bestParams: { fastPeriod: 15, slowPeriod: 40 }, improvements: [] }),
      compare: vi.fn().mockResolvedValue({ success: true, comparisons: [] }),
      templates: vi.fn().mockResolvedValue({ success: true, templates: [] }),
      explain: vi.fn().mockResolvedValue({ success: true, explanation: 'Trend-following strategy based on moving average crossover.' }),
      autoTune: vi.fn().mockResolvedValue({ success: true, params: { fastPeriod: 18, slowPeriod: 45 } }),
      correlation: vi.fn().mockResolvedValue({ success: true, matrix: {} }),
      startLive: vi.fn().mockResolvedValue({ success: true }),
      stopLive: vi.fn().mockResolvedValue({ success: true }),
      multiFactor: vi.fn().mockResolvedValue({ success: true, factors: {} }),
    },
    backtest: {
      run: vi.fn().mockResolvedValue({ success: true, equityCurve: mockBacktestResults.equityCurve, metrics: mockBacktestResults.metrics }),
      multiPeriod: vi.fn().mockResolvedValue({ success: true, results: [] }),
      paramSweep: vi.fn().mockResolvedValue({ success: true, best: { fastPeriod: 15 }, grid: [] }),
      walkForward: vi.fn().mockResolvedValue({ success: true, results: [] }),
      riskMetrics: vi.fn().mockResolvedValue({ success: true, sharpe: 1.42, maxDrawdown: 0.08 }),
      parallel: vi.fn().mockResolvedValue({ success: true, results: [] }),
      'param-scan': vi.fn().mockResolvedValue({ success: true, results: [] }),
      'walk-forward-parallel': vi.fn().mockResolvedValue({ success: true, results: [] }),
      'multi-timeframe': vi.fn().mockResolvedValue({ success: true, results: [] }),
    },
    nl: {
      parse: vi.fn().mockResolvedValue({ success: true, parsed: mockParsedStrategy }),
      templates: vi.fn().mockResolvedValue({ success: true, templates: [] }),
    },
  });
}

beforeEach(() => { installMock(); });

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Strategy IPC — CRUD', () => {

  it('getAll returns strategy list', async () => {
    const result = await (window as any).api.strategy.getAll();
    expect(result).toMatchObject({ success: true });
    expect(result.strategies).toHaveLength(2);
  });

  it('get returns a single strategy', async () => {
    const result = await (window as any).api.strategy.get('strat-1');
    expect(result).toMatchObject({ success: true });
    expect(result.strategy.id).toBe('strat-1');
  });

  it('get returns null for unknown id', async () => {
    const result = await (window as any).api.strategy.get('unknown');
    expect(result).toMatchObject({ success: true });
    expect(result.strategy).toBeNull();
  });

  it('create adds a new strategy', async () => {
    const before = (window as any).api.strategy.getAll();
    const result = await (window as any).api.strategy.create({ name: 'New Strategy', type: 'momentum', params: {} });
    expect(result).toMatchObject({ success: true });
    expect(result.id).toBeDefined();
  });

  it('update modifies strategy params', async () => {
    const result = await (window as any).api.strategy.update('strat-1', { params: { fastPeriod: 15, slowPeriod: 45 } });
    expect(result).toMatchObject({ success: true });
  });

  it('delete removes strategy', async () => {
    const result = await (window as any).api.strategy.delete('strat-1');
    expect(result).toMatchObject({ success: true });
  });

});

describe('Strategy IPC — Advanced', () => {

  it('templates returns strategy templates', async () => {
    const result = await (window as any).api.strategy.templates();
    expect(result).toMatchObject({ success: true });
    expect(result.templates).toBeDefined();
  });

  it('explain returns strategy explanation', async () => {
    const result = await (window as any).api.strategy.explain({ strategyId: 'strat-1' });
    expect(result).toMatchObject({ success: true });
    expect(typeof result.explanation).toBe('string');
  });

  it('autoTune returns tuned parameters', async () => {
    const result = await (window as any).api.strategy.autoTune({ strategyId: 'strat-1', targetMetric: 'sharpe' });
    expect(result).toMatchObject({ success: true });
    expect(result.params).toBeDefined();
  });

  it('correlation returns correlation matrix', async () => {
    const result = await (window as any).api.strategy.correlation({ strategyIds: ['strat-1', 'strat-2'] });
    expect(result).toMatchObject({ success: true });
    expect(result.matrix).toBeDefined();
  });

  it('startLive activates strategy', async () => {
    const result = await (window as any).api.strategy.startLive('strat-1');
    expect(result).toMatchObject({ success: true });
  });

  it('stopLive deactivates strategy', async () => {
    const result = await (window as any).api.strategy.stopLive('strat-1');
    expect(result).toMatchObject({ success: true });
  });

  it('multiFactor returns factor exposures', async () => {
    const result = await (window as any).api.strategy.multiFactor({ strategyId: 'strat-1' });
    expect(result).toMatchObject({ success: true });
    expect(result.factors).toBeDefined();
  });

});

describe('Backtest IPC', () => {

  it('strategy.backtest returns equity curve and metrics', async () => {
    const result = await (window as any).api.strategy.backtest({ strategyId: 'strat-1', startDate: '2024-01-01', endDate: '2024-12-31' });
    expect(result).toMatchObject({ success: true });
    expect(result.equityCurve).toBeDefined();
    expect(Array.isArray(result.equityCurve)).toBe(true);
    expect(result.metrics).toBeDefined();
    expect(result.metrics.sharpe).toBeGreaterThan(0);
  });

  it('backtest:run returns results', async () => {
    const result = await (window as any).api.backtest.run({ strategyId: 'strat-1' });
    expect(result).toMatchObject({ success: true });
    expect(result.equityCurve).toBeDefined();
  });

  it('backtest:paramSweep returns best params', async () => {
    const result = await (window as any).api.backtest.paramSweep({ strategyId: 'strat-1', paramGrid: {} });
    expect(result).toMatchObject({ success: true });
    expect(result.best).toBeDefined();
  });

  it('backtest:walkForward returns OOS results', async () => {
    const result = await (window as any).api.backtest.walkForward({ strategyId: 'strat-1' });
    expect(result).toMatchObject({ success: true });
    expect(result.results).toBeDefined();
  });

  it('backtest:riskMetrics returns risk metrics', async () => {
    const result = await (window as any).api.backtest.riskMetrics([100, 105, 103, 108, 110]);
    expect(result).toMatchObject({ success: true });
    expect(typeof result.sharpe).toBe('number');
    expect(typeof result.maxDrawdown).toBe('number');
  });

  it('backtest:parallel returns parallel results', async () => {
    const result = await (window as any).api.backtest.parallel({ configs: [{}, {}] });
    expect(result).toMatchObject({ success: true });
    expect(result.results).toBeDefined();
  });

  it('backtest:param-scan returns scan results', async () => {
    const result = await (window as any).api.backtest['param-scan']({ strategyId: 'strat-1' });
    expect(result).toMatchObject({ success: true });
    expect(result.results).toBeDefined();
  });

  it('backtest:walk-forward-parallel returns parallel walk-forward', async () => {
    const result = await (window as any).api.backtest['walk-forward-parallel']({ strategyId: 'strat-1' });
    expect(result).toMatchObject({ success: true });
    expect(result.results).toBeDefined();
  });

  it('backtest:multi-timeframe returns multi-TF results', async () => {
    const result = await (window as any).api.backtest['multi-timeframe']({ strategyId: 'strat-1' });
    expect(result).toMatchObject({ success: true });
    expect(result.results).toBeDefined();
  });

});

describe('NL Parser + Strategy Flow', () => {

  it('nl:parse converts natural language to strategy config', async () => {
    const result = await (window as any).api.nl.parse({ text: '当腾讯股价向上穿越20日均线买入，跌破50日均线卖出，止损5%，止盈10%' });
    expect(result).toMatchObject({ success: true });
    expect(result.parsed.strategy).toBeDefined();
    expect(result.parsed.strategy.type).toBeDefined();
    expect(result.parsed.confidence).toBeGreaterThan(0);
  });

  it('nl:templates returns available templates', async () => {
    const result = await (window as any).api.nl.templates();
    expect(result).toMatchObject({ success: true });
    expect(result.templates).toBeDefined();
  });

  it('full flow: nl:parse → create → backtest', async () => {
    // Step 1: Parse
    const parsed = await (window as any).api.nl.parse({ text: 'momentum MA cross strategy' });
    expect(parsed).toMatchObject({ success: true });
    expect(parsed.parsed.strategy.type).toBe('momentum');

    // Step 2: Create strategy from parsed config
    const created = await (window as any).api.strategy.create({
      name: 'NL Parsed Strategy',
      type: parsed.parsed.strategy.type,
      params: parsed.parsed.strategy.params,
    });
    expect(created).toMatchObject({ success: true });
    expect(created.id).toBeDefined();

    // Step 3: Run backtest
    const backtested = await (window as any).api.strategy.backtest({ strategyId: created.id });
    expect(backtested).toMatchObject({ success: true });
    expect(Array.isArray(backtested.equityCurve)).toBe(true);
  });

});

describe('Strategy Compare', () => {

  it('strategy:compare returns comparison table', async () => {
    const result = await (window as any).api.strategy.compare({ strategyIds: ['strat-1', 'strat-2'] });
    expect(result).toMatchObject({ success: true });
    expect(result.comparisons).toBeDefined();
  });

  it('strategy:optimize returns best parameters', async () => {
    const result = await (window as any).api.strategy.optimize({ strategyId: 'strat-1', targetMetric: 'sharpe' });
    expect(result).toMatchObject({ success: true });
    expect(result.bestParams).toBeDefined();
  });

});

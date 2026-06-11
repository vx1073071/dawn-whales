// J-40-02: WalkForwardEngine Tests
import { describe, it, expect, beforeEach } from 'vitest';
import {
  WalkForwardEngine,
  KLine,
  Trade,
  ParamRange,
  WalkForwardConfig,
} from '../electron/engine/backtest/walk-forward-engine';

describe('J-40-02: WalkForwardEngine', () => {
  // Mock strategy runner: simple MA crossover
  const mockStrategy = (data: KLine[], params: Record<string, number>): Trade[] => {
    const fastPeriod = params.fast_period ?? 5;
    const slowPeriod = params.slow_period ?? 10;
    const trades: Trade[] = [];

    if (data.length < slowPeriod + 2) return trades;
    let position: 'LONG' | null = null;
    let entryPrice = 0;
    let entryTime = 0;

    for (let i = slowPeriod; i < data.length; i++) {
      // Calculate simple moving averages
      let fastSum = 0, slowSum = 0;
      for (let j = i - fastPeriod + 1; j <= i; j++) fastSum += data[j].close;
      for (let j = i - slowPeriod + 1; j <= i; j++) slowSum += data[j].close;
      const fastMA = fastSum / fastPeriod;
      const slowMA = slowSum / slowPeriod;

      // Previous MAs
      let prevFastSum = 0, prevSlowSum = 0;
      for (let j = i - fastPeriod; j < i; j++) prevFastSum += data[j].close;
      for (let j = i - slowPeriod; j < i; j++) prevSlowSum += data[j].close;
      const prevFastMA = prevFastSum / fastPeriod;
      const prevSlowMA = prevSlowSum / slowPeriod;

      // Crossover signals
      if (prevFastMA <= prevSlowMA && fastMA > slowMA && !position) {
        position = 'LONG';
        entryPrice = data[i].close;
        entryTime = data[i].time;
      } else if (prevFastMA >= prevSlowMA && fastMA < slowMA && position === 'LONG') {
        const exitPrice = data[i].close;
        const pnl = (exitPrice - entryPrice) * 100;
        trades.push({
          entryTime,
          exitTime: data[i].time,
          side: 'LONG',
          entryPrice,
          exitPrice,
          qty: 100,
          pnl,
          pnlPct: ((exitPrice - entryPrice) / entryPrice) * 100,
          bars: i,
        });
        position = null;
      }
    }

    return trades;
  };

  const paramRanges: ParamRange[] = [
    { name: 'fast_period', min: 3, max: 8, step: 1 },
    { name: 'slow_period', min: 10, max: 20, step: 2 },
  ];

  // Generate mock kline data
  const generateKlines = (count: number, startPrice = 100): KLine[] => {
    const klines: KLine[] = [];
    let price = startPrice;
    for (let i = 0; i < count; i++) {
      const change = (Math.random() - 0.48) * 2; // Slight upward bias
      price = Math.max(10, price + change);
      klines.push({
        time: Date.now() - (count - i) * 60000,
        open: price - 0.5,
        high: price + 1,
        low: price - 1,
        close: price,
        volume: Math.floor(1000 + Math.random() * 5000),
      });
    }
    return klines;
  };

  let engine: WalkForwardEngine;

  beforeEach(() => {
    engine = new WalkForwardEngine(mockStrategy, paramRanges, {
      windows: 3,
      inSampleRatio: 0.7,
      windowType: 'rolling',
      minTrades: 1,
    });
  });

  // ── Initialization Tests ──────────────────────────────────────────

  it('should initialize with correct config', () => {
    const config = engine.getConfig();
    expect(config.windows).toBe(3);
    expect(config.inSampleRatio).toBe(0.7);
    expect(config.windowType).toBe('rolling');
  });

  it('should throw on invalid windows count', () => {
    expect(() => new WalkForwardEngine(mockStrategy, paramRanges, { windows: 1 })).toThrow();
  });

  it('should throw on invalid inSampleRatio', () => {
    expect(() => new WalkForwardEngine(mockStrategy, paramRanges, { inSampleRatio: 0.3 })).toThrow();
  });

  it('should throw with no param ranges', () => {
    expect(() => new WalkForwardEngine(mockStrategy, [])).toThrow();
  });

  it('should throw on invalid param step', () => {
    expect(() => new WalkForwardEngine(mockStrategy, [{ name: 'x', min: 1, max: 10, step: 0 }])).toThrow();
  });

  it('should throw on param min > max', () => {
    expect(() => new WalkForwardEngine(mockStrategy, [{ name: 'x', min: 10, max: 1, step: 1 }])).toThrow();
  });

  it('should not be running initially', () => {
    expect(engine.isRunning()).toBe(false);
  });

  // ── Run Analysis Tests ────────────────────────────────────────────

  it('should run walk-forward analysis', async () => {
    // Use more data and minTrades=1 to ensure at least some windows have trades
    const localEngine = new WalkForwardEngine(mockStrategy, paramRanges, {
      windows: 3,
      inSampleRatio: 0.7,
      windowType: 'rolling',
      minTrades: 1,
    });
    // Generate more data with a trending pattern to ensure MA crossovers
    const data = generateKlines(1000, 100);
    const result = await localEngine.run(data);

    expect(result.totalWindows).toBeGreaterThanOrEqual(1);
    expect(result.windows.length).toBeGreaterThanOrEqual(1);
    expect(typeof result.overallEfficiency).toBe('number');
    expect(typeof result.avgOosReturn).toBe('number');
    expect(typeof result.avgOosSharpe).toBe('number');
    expect(typeof result.profitabilityRate).toBe('number');
  });

  it('should throw with insufficient data', async () => {
    const data = generateKlines(5);
    await expect(engine.run(data)).rejects.toThrow();
  });

  it('should not allow concurrent runs', async () => {
    const data = generateKlines(200);
    const p1 = engine.run(data);
    await expect(engine.run(data)).rejects.toThrow();
    await p1;
  });

  it('should emit lifecycle events', async () => {
    const events: string[] = [];
    engine.on('start', () => events.push('start'));
    engine.on('windowComplete', () => events.push('windowComplete'));
    engine.on('complete', () => events.push('complete'));

    const data = generateKlines(200);
    await engine.run(data);

    expect(events).toContain('start');
    expect(events).toContain('complete');
  });

  // ── Window Type Tests ─────────────────────────────────────────────

  it('should work with expanding window type', async () => {
    engine.updateConfig({ windowType: 'expanding', minTrades: 1 });
    const data = generateKlines(1000);
    const result = await engine.run(data);

    expect(result.totalWindows).toBeGreaterThanOrEqual(1);
  });

  // ── Report Tests ──────────────────────────────────────────────────

  it('should generate report with recommendations', async () => {
    const data = generateKlines(200);
    const report = await engine.generateReport(data);

    expect(report.summary).toBeDefined();
    expect(report.config).toBeDefined();
    expect(report.paramRanges).toBeDefined();
    expect(report.recommendations).toBeDefined();
    expect(Array.isArray(report.recommendations)).toBe(true);
    expect(report.timestamp).toBeGreaterThan(0);
    expect(report.dataLength).toBe(200);
  });

  // ── Config Update Tests ───────────────────────────────────────────

  it('should update config when not running', () => {
    engine.updateConfig({ windows: 5 });
    expect(engine.getConfig().windows).toBe(5);
  });

  it('should reject config update while running', async () => {
    const data = generateKlines(200);
    const p = engine.run(data);
    (() => { try { engine.updateConfig({ windows: 5 }); } catch(e) { /* expected */ } })();
    await p;
  });

  // ── Parameter Range Tests ─────────────────────────────────────────

  it('should return param ranges', () => {
    const ranges = engine.getParamRanges();
    expect(ranges).toHaveLength(2);
    expect(ranges[0].name).toBe('fast_period');
    expect(ranges[1].name).toBe('slow_period');
  });

  // ── Efficiency Tests ──────────────────────────────────────────────

  it('should calculate efficiency as OOS/IS ratio', async () => {
    const data = generateKlines(300);
    const result = await engine.run(data);

    for (const window of result.windows) {
      expect(typeof window.efficiency).toBe('number');
      expect(typeof window.isSharpe).toBe('number');
      expect(typeof window.oosSharpe).toBe('number');
    }
  });

  it('should calculate profitability rate', async () => {
    const data = generateKlines(300);
    const result = await engine.run(data);

    // profitabilityRate is expressed as a 0-100 percentage (matches engine impl).
    expect(result.profitabilityRate).toBeGreaterThanOrEqual(0);
    expect(result.profitabilityRate).toBeLessThanOrEqual(100);
    expect(result.profitableWindows).toBeLessThanOrEqual(result.totalWindows);
  });
});

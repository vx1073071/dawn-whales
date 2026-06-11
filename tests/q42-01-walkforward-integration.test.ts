// ── QClaw R42: WalkForwardEngine Integration Tests ──────────────────────────────────
// Tests WalkForwardEngine integration scenarios:
//   - Report generation and field validity (including when 0 windows produced)
//   - Config validation and update
//   - Post-run state and re-entrancy
//   - Multiple optimization objectives
//   - Error handling
//   - Large datasets
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WalkForwardEngine, type ParamRange, type KLine, type Trade } from '../electron/engine/backtest/walk-forward-engine';

// ── Helpers ──────────────────────────────────────────────────────────────────

function generateKLines(count: number, basePrice = 100, seed = 42): KLine[] {
  const klines: KLine[] = [];
  let price = basePrice;
  let s = seed;
  const rand = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < count; i++) {
    const change = (rand() - 0.48) * 2;
    const open = price;
    const close = price + change;
    klines.push({
      time: Date.now() + i * 86400000,
      open: +open.toFixed(2),
      high: +(Math.max(open, close) + rand() * 0.5).toFixed(2),
      low: +(Math.min(open, close) - rand() * 0.5).toFixed(2),
      close: +close.toFixed(2),
      volume: Math.floor(rand() * 1000000),
    });
    price = close;
  }
  return klines;
}

function simpleStrategy(data: KLine[], params: Record<string, number>): Trade[] {
  const fast = params.fastPeriod ?? 5;
  const slow = params.slowPeriod ?? 20;
  if (data.length < slow + 2) return [];
  const trades: Trade[] = [];
  let inPosition = false, entryPrice = 0, entryTime = 0, entryIdx = 0;
  const sma = (end: number, period: number) => {
    let sum = 0;
    const start = Math.max(0, end - period + 1);
    for (let i = start; i <= end; i++) sum += data[i].close;
    return sum / (end - start + 1);
  };
  for (let i = slow; i < data.length; i++) {
    const f = sma(i, fast), s2 = sma(i, slow);
    const fp = sma(i - 1, fast), sp = sma(i - 1, slow);
    if (!inPosition && fp <= sp && f > s2) { inPosition = true; entryPrice = data[i].close; entryTime = data[i].time; entryIdx = i; }
    else if (inPosition && fp >= sp && f < s2) {
      inPosition = false;
      const pnl = data[i].close - entryPrice;
      trades.push({ entryTime, exitTime: data[i].time, side: 'LONG', entryPrice, exitPrice: data[i].close, qty: 1, pnl, pnlPct: (pnl / entryPrice) * 100, bars: i - entryIdx });
    }
  }
  return trades;
}

const defaultParamRanges: ParamRange[] = [
  { name: 'fastPeriod', min: 3, max: 10, step: 7 },
  { name: 'slowPeriod', min: 15, max: 30, step: 15 },
];

// ── Tests ───────────────────────────────────────────────────────────────────────

describe('WalkForwardEngine Integration', () => {

  // ── 1. Config validation ─────────────────────────────────────────────────────

  it('should throw on windows < 2', () => {
    expect(() => new WalkForwardEngine(simpleStrategy, defaultParamRanges, { windows: 1, inSampleRatio: 0.7, windowType: 'rolling', minTrades: 1, optimizationObjective: 'sharpe' }))
      .toThrow('windows must be >= 2');
  });

  it('should throw on invalid inSampleRatio', () => {
    expect(() => new WalkForwardEngine(simpleStrategy, defaultParamRanges, { windows: 2, inSampleRatio: 0.3, windowType: 'rolling', minTrades: 1, optimizationObjective: 'sharpe' }))
      .toThrow(/inSampleRatio.*between/);
    expect(() => new WalkForwardEngine(simpleStrategy, defaultParamRanges, { windows: 2, inSampleRatio: 0.95, windowType: 'rolling', minTrades: 1, optimizationObjective: 'sharpe' }))
      .toThrow(/inSampleRatio.*between/);
  });

  it('should throw on minTrades < 1', () => {
    expect(() => new WalkForwardEngine(simpleStrategy, defaultParamRanges, { windows: 2, inSampleRatio: 0.7, windowType: 'rolling', minTrades: 0, optimizationObjective: 'sharpe' }))
      .toThrow(/minTrades must be >= 1/);
  });

  // ── 2. Initialization ───────────────────────────────────────────────────────

  it('should initialize with correct config', () => {
    const engine = new WalkForwardEngine(simpleStrategy, defaultParamRanges, {
      windows: 3, inSampleRatio: 0.7, windowType: 'rolling', minTrades: 1, optimizationObjective: 'sharpe',
    });
    const cfg = engine.getConfig();
    expect(cfg.windows).toBe(3);
    expect(cfg.inSampleRatio).toBe(0.7);
    expect(cfg.windowType).toBe('rolling');
    expect(cfg.optimizationObjective).toBe('sharpe');
    expect(cfg.minTrades).toBe(1);
  });

  it('should return correct param ranges', () => {
    const engine = new WalkForwardEngine(simpleStrategy, defaultParamRanges, {
      windows: 2, inSampleRatio: 0.7, windowType: 'rolling', minTrades: 1, optimizationObjective: 'sharpe',
    });
    const ranges = engine.getParamRanges();
    expect(ranges).toHaveLength(2);
    expect(ranges[0].name).toBe('fastPeriod');
    expect(ranges[1].name).toBe('slowPeriod');
  });

  it('should not be running at start', () => {
    const engine = new WalkForwardEngine(simpleStrategy, defaultParamRanges, {
      windows: 2, inSampleRatio: 0.7, windowType: 'rolling', minTrades: 1, optimizationObjective: 'sharpe',
    });
    expect(engine.isRunning()).toBe(false);
  });

  // ── 3. Run and report ────────────────────────────────────────────────────────

  it('should reject run with insufficient data', async () => {
    const engine = new WalkForwardEngine(simpleStrategy, defaultParamRanges, {
      windows: 3, inSampleRatio: 0.7, windowType: 'rolling', minTrades: 1, optimizationObjective: 'sharpe',
    });
    await expect(engine.run(generateKLines(5))).rejects.toThrow(/insufficient/i);
  });

  it('should complete run without throwing (windows may be 0)', async () => {
    const engine = new WalkForwardEngine(simpleStrategy, defaultParamRanges, {
      windows: 3, inSampleRatio: 0.7, windowType: 'rolling', minTrades: 1, optimizationObjective: 'sharpe',
    });
    // Using seed=42 with 3 windows — may produce 0 windows if strategy generates few trades
    const result = await engine.run(generateKLines(300, 100, 42));
    expect(result).toBeDefined();
    expect(typeof result.totalWindows).toBe('number');
    expect(typeof result.profitableWindows).toBe('number');
    expect(typeof result.overallEfficiency).toBe('number');
    expect(Array.isArray(result.windows)).toBe(true);
  });

  it('should generate report without throwing (0 windows is valid)', async () => {
    const engine = new WalkForwardEngine(simpleStrategy, defaultParamRanges, {
      windows: 3, inSampleRatio: 0.7, windowType: 'rolling', minTrades: 1, optimizationObjective: 'sharpe',
    });
    await engine.run(generateKLines(300, 100, 42));
    const report = await engine.generateReport(generateKLines(300, 100, 42));
    expect(report).toBeDefined();
    // WalkForwardReport has { summary, config, paramRanges, timestamp, dataLength, recommendations }
    // summary is the WalkForwardResult with totalWindows/profitableWindows/windows
    expect(report.summary).toBeDefined();
    expect(typeof report.summary.totalWindows === 'number' || report.summary.totalWindows === 0).toBe(true);
    expect(Array.isArray(report.summary.windows)).toBe(true);
  });

  // ── 4. Objectives ───────────────────────────────────────────────────────────

  it('should complete run with sharpe objective', async () => {
    const engine = new WalkForwardEngine(simpleStrategy, defaultParamRanges, {
      windows: 2, inSampleRatio: 0.7, windowType: 'rolling', minTrades: 1, optimizationObjective: 'sharpe',
    });
    const result = await engine.run(generateKLines(200, 100, 42));
    expect(result).toBeDefined();
  });

  it('should complete run with return objective', async () => {
    const engine = new WalkForwardEngine(simpleStrategy, defaultParamRanges, {
      windows: 2, inSampleRatio: 0.7, windowType: 'rolling', minTrades: 1, optimizationObjective: 'return',
    });
    const result = await engine.run(generateKLines(200, 100, 42));
    expect(result).toBeDefined();
  });

  it('should complete run with drawdown objective', async () => {
    const engine = new WalkForwardEngine(simpleStrategy, defaultParamRanges, {
      windows: 2, inSampleRatio: 0.7, windowType: 'rolling', minTrades: 1, optimizationObjective: 'drawdown',
    });
    const result = await engine.run(generateKLines(200, 100, 42));
    expect(result).toBeDefined();
  });

  // ── 5. Post-run state ─────────────────────────────────────────────────────

  it('should not be running after completion', async () => {
    const engine = new WalkForwardEngine(simpleStrategy, defaultParamRanges, {
      windows: 2, inSampleRatio: 0.7, windowType: 'rolling', minTrades: 1, optimizationObjective: 'sharpe',
    });
    await engine.run(generateKLines(200));
    expect(engine.isRunning()).toBe(false);
  });

  it('should allow re-run after previous run completes', async () => {
    const engine = new WalkForwardEngine(simpleStrategy, defaultParamRanges, {
      windows: 2, inSampleRatio: 0.7, windowType: 'rolling', minTrades: 1, optimizationObjective: 'sharpe',
    });
    await engine.run(generateKLines(200));
    const result2 = await engine.run(generateKLines(200));
    expect(result2).toBeDefined();
  });

  // ── 6. Config updates ──────────────────────────────────────────────────────

  it('should allow config update when idle', () => {
    const engine = new WalkForwardEngine(simpleStrategy, defaultParamRanges, {
      windows: 2, inSampleRatio: 0.7, windowType: 'rolling', minTrades: 1, optimizationObjective: 'sharpe',
    });
    engine.updateConfig({ windows: 4, optimizationObjective: 'return' });
    const cfg = engine.getConfig();
    expect(cfg.windows).toBe(4);
    expect(cfg.optimizationObjective).toBe('return');
  });

  it('should re-run with updated config', async () => {
    const engine = new WalkForwardEngine(simpleStrategy, defaultParamRanges, {
      windows: 2, inSampleRatio: 0.7, windowType: 'rolling', minTrades: 1, optimizationObjective: 'sharpe',
    });
    await engine.run(generateKLines(200));
    engine.updateConfig({ windows: 3 });
    const cfg = engine.getConfig();
    expect(cfg.windows).toBe(3);
    const result2 = await engine.run(generateKLines(200));
    expect(result2).toBeDefined();
  });

  // ── 7. Events ──────────────────────────────────────────────────────────────

  it('should emit complete event after run finishes', async () => {
    const engine = new WalkForwardEngine(simpleStrategy, defaultParamRanges, {
      windows: 2, inSampleRatio: 0.7, windowType: 'rolling', minTrades: 1, optimizationObjective: 'sharpe',
    });
    let completed = false;
    engine.on('complete', () => { completed = true; });
    await engine.run(generateKLines(200));
    expect(completed).toBe(true);
  });

  // ── 8. Empty strategy ──────────────────────────────────────────────────────

  it('should handle strategy returning no trades', async () => {
    const emptyStrategy = (): Trade[] => [];
    const engine = new WalkForwardEngine(emptyStrategy, defaultParamRanges, {
      windows: 3, inSampleRatio: 0.7, windowType: 'rolling', minTrades: 1, optimizationObjective: 'sharpe',
    });
    const result = await engine.run(generateKLines(300));
    expect(result).toBeDefined();
    expect(Array.isArray(result.windows)).toBe(true);
    // All windows filtered by minTrades is valid
    expect(result.totalWindows).toBeGreaterThanOrEqual(0);
  });

  // ── 9. Large dataset ────────────────────────────────────────────────────────

  it('should handle 1000 bars without crashing', async () => {
    const engine = new WalkForwardEngine(simpleStrategy, defaultParamRanges, {
      windows: 5, inSampleRatio: 0.75, windowType: 'rolling', minTrades: 1, optimizationObjective: 'sharpe',
    });
    const result = await engine.run(generateKLines(1000));
    expect(result).toBeDefined();
    expect(typeof result.totalWindows).toBe('number');
  });

  // ── 10. createDefaultWalkForwardEngine ──────────────────────────────────────

  it('createDefaultWalkForwardEngine should work out of the box', async () => {
    const { createDefaultWalkForwardEngine } = await import('../electron/engine/backtest/walk-forward-engine');
    const engine = createDefaultWalkForwardEngine();
    expect(engine).toBeDefined();
    expect(engine.isRunning()).toBe(false);
    const result = await engine.run(generateKLines(200));
    expect(result).toBeDefined();
  });
});

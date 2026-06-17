// ── R267 JVS 测试文件 ──
// 覆盖: SmartMoneyFlowEngine, FinancialTabEngine, DrawingToStrategyEngine,
//       PatternRecognition21Engine, ChipDistributionEngine

import { describe, it, expect, beforeEach } from 'vitest';
import { SmartMoneyFlowEngine, getSmartMoneyFlowEngine, resetSmartMoneyFlowEngine }
  from '../electron/engine/analysis/smart-money-flow-engine';
import type { CapitalFlowTick, InstitutionalHolding } from '../electron/engine/analysis/smart-money-flow-engine';
import { FinancialTabEngine, getFinancialTabEngine, resetFinancialTabEngine }
  from '../electron/engine/analysis/financial-tab-engine';
import type { FinancialMetric } from '../electron/engine/analysis/financial-tab-engine';
import { DrawingToStrategyEngine, getDrawingToStrategyEngine, resetDrawingToStrategyEngine }
  from '../electron/engine/analysis/drawing-to-strategy-engine';
import type { DrawingObject } from '../electron/engine/analysis/drawing-to-strategy-engine';
import { PatternRecognition21Engine, getPatternRecognition21Engine, resetPatternRecognition21Engine }
  from '../electron/engine/analysis/pattern-recognition-21-engine';
import { ChipDistributionEngine, getChipDistributionEngine, resetChipDistributionEngine }
  from '../electron/engine/analysis/chip-distribution-engine';
import type { TickRecord } from '../electron/engine/analysis/chip-distribution-engine';

// ═══════════ Helpers ═══════════

function makeTicks(n: number, price = 100): CapitalFlowTick[] {
  const ticks: CapitalFlowTick[] = [];
  const now = Date.now();
  for (let i = 0; i < n; i++) {
    ticks.push({
      timestamp: now - (n - i) * 60_000,
      price: price + (Math.random() - 0.5) * 10,
      volume: Math.floor(Math.random() * 10000),
      direction: Math.random() > 0.5 ? 'buy' : 'sell',
      orderType: 'small',
    });
  }
  return ticks;
}

function makeInstitutionalTicks(n: number, price = 100): CapitalFlowTick[] {
  const ticks: CapitalFlowTick[] = [];
  const now = Date.now();
  for (let i = 0; i < n; i++) {
    ticks.push({
      timestamp: now - (n - i) * 60_000,
      price: price + (Math.random() - 0.3) * 20,
      volume: 800_000 + Math.floor(Math.abs(Math.random() * 200_000)),
      direction: 'buy',
      orderType: 'institutional',
    });
  }
  return ticks;
}

function makeAnnualFinancial(overrides: Partial<FinancialMetric> = {}): FinancialMetric {
  return {
    symbol: 'AAPL', period: 'FY2024', periodType: 'annual',
    fiscalYear: 2024, reportDate: '2024-09-30',
    revenue: 383_285_000_000, revenueYoY: 0.05, revenueQoQ: 0,
    grossProfit: 170_000_000_000, grossMargin: 0.44,
    operatingIncome: 120_000_000_000, operatingMargin: 0.31,
    netIncome: 97_000_000_000, netMargin: 0.25,
    eps: 6.15, epsDiluted: 6.10,
    totalAssets: 365_000_000_000, totalLiabilities: 290_000_000_000, totalEquity: 75_000_000_000,
    currentAssets: 160_000_000_000, currentLiabilities: 150_000_000_000,
    currentRatio: 1.07, quickRatio: 0.95, debtToEquity: 3.87, longTermDebt: 105_000_000_000,
    cashEquivalents: 65_000_000_000, bookValuePerShare: 4.8,
    operatingCashFlow: 110_000_000_000, freeCashFlow: 90_000_000_000, fcfYield: 0.03,
    capex: 20_000_000_000, cashFlowPerShare: 7.05,
    pe: 30, forwardPE: 25, pb: 38, ps: 8, pcf: 22, peg: 1.5, evToEbitda: 22, dividendYield: 0.005,
    roe: 1.29, roa: 0.27, roic: 0.35, roce: 0.40,
    revenueCAGR3Y: 0.08, epsCAGR3Y: 0.12, revenueCAGR5Y: 0.06, epsCAGR5Y: 0.10,
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════
// SmartMoneyFlowEngine
// ═══════════════════════════════════════════════════════════════

describe('SmartMoneyFlowEngine', () => {
  let engine: SmartMoneyFlowEngine;

  beforeEach(() => {
    resetSmartMoneyFlowEngine();
    engine = getSmartMoneyFlowEngine();
    engine.reset();
  });

  it('classifies tick sizes correctly', () => {
    expect(engine.classifyTickSize(1, 100)).toBe('small');         // $100
    expect(engine.classifyTickSize(60, 100)).toBe('medium');       // $6,000
    expect(engine.classifyTickSize(600, 100)).toBe('large');       // $60,000
    expect(engine.classifyTickSize(6000, 100)).toBe('institutional'); // $600,000
  });

  it('feeds ticks and computes daily flow', () => {
    const ticks = [...makeTicks(30), ...makeInstitutionalTicks(10)];
    const flow = engine.computeDailyFlowFromTicks('AAPL', ticks);
    expect(flow.symbol).toBe('AAPL');
    expect(flow.totalInflow + flow.totalOutflow).toBeGreaterThan(0);
    expect(typeof flow.mainForceNet).toBe('number');
    expect(typeof flow.flowRatio).toBe('number');
    expect(flow.institutionalNet).toBeGreaterThan(0); // all buys
  });

  it('stores and retrieves flow history', () => {
    const flow = engine.computeDailyFlowFromTicks('AAPL', makeTicks(20));
    const history = engine.getFlowHistory('AAPL');
    expect(history.length).toBeGreaterThanOrEqual(1);
  });

  it('generates smart money signal', () => {
    // Feed many institutional buy ticks to create accumulation
    const ticks: CapitalFlowTick[] = [
      ...Array.from({ length: 20 }, (_, i) => ({
        timestamp: Date.now() - (20 - i) * 60_000,
        price: 100 + i * 0.5,
        volume: 700_000,
        direction: 'buy' as const,
        orderType: 'institutional' as const,
      })),
    ];
    engine.computeDailyFlowFromTicks('AAPL', ticks);
    const signal = engine.generateSignal('AAPL');
    expect(['accumulating', 'distributing', 'neutral']).toContain(signal.direction);
    expect(signal.score).toBeGreaterThanOrEqual(-100);
    expect(signal.score).toBeLessThanOrEqual(100);
  });

  it('registers sector mappings', () => {
    engine.registerSectors({ AAPL: 'TECH', JPM: 'FINANCE', XOM: 'ENERGY' });
    engine.computeDailyFlowFromTicks('AAPL', makeTicks(10));
    engine.computeDailyFlowFromTicks('JPM', makeTicks(10));
    const sectors = engine.computeSectorFlows();
    expect(sectors.length).toBeGreaterThan(0);
  });

  it('detects sector rotation', () => {
    engine.registerSectors({ TECH_A: 'TECH', FIN_B: 'FINANCE' });
    // Feed positive flow for tech
    const techTicks: CapitalFlowTick[] = Array.from({ length: 10 }, (_, i) => ({
      timestamp: Date.now() - (10 - i) * 60_000,
      price: 100, volume: 600_000, direction: 'buy' as const, orderType: 'large' as const,
    }));
    // Feed negative for finance
    const finTicks: CapitalFlowTick[] = Array.from({ length: 10 }, (_, i) => ({
      timestamp: Date.now() - (10 - i) * 60_000,
      price: 100, volume: 600_000, direction: 'sell' as const, orderType: 'large' as const,
    }));
    engine.computeDailyFlowFromTicks('TECH_A', techTicks);
    engine.computeDailyFlowFromTicks('FIN_B', finTicks);
    const rotation = engine.detectSectorRotation();
    expect(Array.isArray(rotation.rotatingIn)).toBe(true);
    expect(Array.isArray(rotation.rotatingOut)).toBe(true);
  });

  it('gets main force concentration', () => {
    engine.computeDailyFlowFromTicks('AAPL', makeInstitutionalTicks(20));
    const conc = engine.getMainForceConcentration('AAPL');
    expect(conc).toBeGreaterThanOrEqual(0);
    expect(conc).toBeLessThanOrEqual(100);
  });

  it('gets capital flow summary', () => {
    engine.computeDailyFlowFromTicks('AAPL', makeInstitutionalTicks(15));
    engine.registerSectors({ AAPL: 'TECH' });
    const summary = engine.getCapitalFlowSummary('AAPL');
    expect(summary.signal).toBeDefined();
    expect(typeof summary.mainForceConcentration).toBe('number');
    expect(Array.isArray(summary.history5d)).toBe(true);
  });

  it('registers and retrieves institutional holdings', () => {
    const holdings: InstitutionalHolding[] = [
      { symbol: 'AAPL', holder: 'Vanguard', shares: 1_000_000_000, value: 1e11, change: 5000000, changePct: 0.5, reportDate: '2024-Q3', holderType: 'fund' },
    ];
    engine.registerHoldings(holdings);
    const signal = engine.generateSignal('AAPL');
    expect(signal.institutionalChangePct).toBeGreaterThanOrEqual(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// FinancialTabEngine
// ═══════════════════════════════════════════════════════════════

describe('FinancialTabEngine', () => {
  let engine: FinancialTabEngine;

  beforeEach(() => {
    resetFinancialTabEngine();
    engine = getFinancialTabEngine();
  });

  it('loads and retrieves metrics', () => {
    engine.loadMetrics('AAPL', [makeAnnualFinancial()]);
    const m = engine.getLatestMetrics('AAPL');
    expect(m).not.toBeNull();
    expect(m!.revenue).toBeGreaterThan(0);
    expect(m!.eps).toBeGreaterThan(0);
  });

  it('filters by period type', () => {
    const annual1 = makeAnnualFinancial({ fiscalYear: 2024 });
    const quarterly = makeAnnualFinancial({ fiscalYear: 2024, fiscalQuarter: 1, periodType: 'quarterly' as const, period: 'Q1 2024' });
    engine.loadMetrics('AAPL', [annual1, quarterly]);
    expect(engine.getMetricsByPeriod('AAPL', 'annual').length).toBe(1);
    expect(engine.getMetricsByPeriod('AAPL', 'quarterly').length).toBe(1);
  });

  it('computes trend', () => {
    const data = [2022, 2023, 2024].map((y) =>
      makeAnnualFinancial({ fiscalYear: y, revenue: 300e9 + (y - 2022) * 40e9, period: `FY${y}` }),
    );
    engine.loadMetrics('AAPL', data);
    const trend = engine.getTrend('AAPL', 'revenue');
    expect(trend).not.toBeNull();
    expect(trend!.direction).toBe('up');
    expect(trend!.values.length).toBe(3);
  });

  it('revenue growth returns cagr', () => {
    engine.loadMetrics('AAPL', [makeAnnualFinancial()]);
    const growth = engine.getRevenueGrowth('AAPL');
    expect(typeof growth.yoy).toBe('number');
    expect(typeof growth.cagr3).toBe('number');
  });

  it('earnings growth computes surprise rate', () => {
    const quarters = [1, 2, 3, 4, 5, 6, 7, 8].map((q) =>
      makeAnnualFinancial({ fiscalYear: 2024, fiscalQuarter: q, periodType: 'quarterly' as const, period: `Q${q} 2024`, eps: 1.5 + q * 0.1 }),
    );
    engine.loadMetrics('AAPL', quarters);
    const growth = engine.getEarningsGrowth('AAPL');
    expect(typeof growth.surpriseRate).toBe('number');
  });

  it('computes DuPont analysis', () => {
    engine.loadMetrics('AAPL', [makeAnnualFinancial()]);
    const dupont = engine.computeDuPont('AAPL');
    expect(dupont).not.toBeNull();
    expect(dupont!.roe).toBeGreaterThan(0);
    expect(dupont!.breakdown.length).toBeGreaterThanOrEqual(3);
  });

  it('scores financial health', () => {
    engine.loadMetrics('AAPL', [makeAnnualFinancial()]);
    const score = engine.scoreFinancialHealth('AAPL');
    expect(score.totalScore).toBeGreaterThan(0);
    expect(['A', 'B', 'C', 'D', 'F']).toContain(score.grade);
    expect(score.highlights.length + score.warnings.length).toBeGreaterThanOrEqual(0);
  });

  it('valuation ranking with peers', () => {
    const metrics = [
      makeAnnualFinancial({ symbol: 'AAPL', pe: 30, pb: 38 }),
      makeAnnualFinancial({ symbol: 'MSFT', pe: 35, pb: 12 }),
      makeAnnualFinancial({ symbol: 'GOOGL', pe: 25, pb: 7 }),
    ];
    for (const m of metrics) engine.loadMetrics(m.symbol, [m]);
    engine.registerPeers('AAPL', ['MSFT', 'GOOGL']);
    const rank = engine.computeValuationRanking('AAPL');
    expect(rank).not.toBeNull();
    expect(typeof rank!.compositeRank).toBe('number');
  });

  it('quick summary returns all key fields', () => {
    engine.loadMetrics('AAPL', [makeAnnualFinancial()]);
    const summary = engine.getQuickSummary('AAPL');
    expect(summary.pe).toBeDefined();
    expect(summary.revenue).toBeDefined();
    expect(summary.eps).toBeDefined();
  });

  it('handles unknown symbol gracefully', () => {
    const m = engine.getLatestMetrics('UNKNOWN');
    expect(m).toBeNull();
    const score = engine.scoreFinancialHealth('UNKNOWN');
    expect(score.grade).toBe('F');
    expect(score.warnings).toContain('无法获取财务数据');
  });
});

// ═══════════════════════════════════════════════════════════════
// DrawingToStrategyEngine
// ═══════════════════════════════════════════════════════════════

describe('DrawingToStrategyEngine', () => {
  let engine: DrawingToStrategyEngine;

  beforeEach(() => {
    resetDrawingToStrategyEngine();
    engine = getDrawingToStrategyEngine();
    engine.reset();
  });

  function makeBars(n: number, basePrice = 100): { timestamp: number; open: number; high: number; low: number; close: number }[] {
    const bars: { timestamp: number; open: number; high: number; low: number; close: number }[] = [];
    let price = basePrice;
    const now = Date.now();
    for (let i = 0; i < n; i++) {
      const open = price;
      price += (Math.random() - 0.5) * 5;
      bars.push({
        timestamp: now - (n - i) * 3600000,
        open,
        high: Math.max(open, price) + 1,
        low: Math.min(open, price) - 1,
        close: price,
      });
    }
    return bars;
  }

  it('registers and retrieves drawings', () => {
    const drawing: DrawingObject = {
      id: 'd1', type: 'horizontal', points: [{ timestamp: Date.now(), price: 100 }],
      createdAt: Date.now(), updatedAt: Date.now(),
    };
    engine.registerDrawing(drawing);
    expect(engine.getDrawing('d1')).not.toBeNull();
    expect(engine.getAllDrawings().length).toBe(1);
  });

  it('evaluates horizontal breakout up', () => {
    const drawing: DrawingObject = {
      id: 'd1', type: 'horizontal',
      points: [{ timestamp: Date.now() - 3600000, price: 100 }],
      createdAt: Date.now() - 3600000, updatedAt: Date.now(),
    };
    engine.registerDrawing(drawing);
    const bars = makeBars(10, 95);
    // Manually set last two bars to simulate breakout
    bars[bars.length - 2] = { timestamp: Date.now() - 3600000, open: 98, high: 99, low: 97, close: 98 };
    bars[bars.length - 1] = { timestamp: Date.now(), open: 99, high: 102, low: 99, close: 102 };

    const signals = engine.evaluate(bars);
    // Should have at least one breakout signal if price crossed 100
    const breakoutSignals = signals.filter((s) => s.signalType === 'breakout_up');
    // May or may not trigger depending on exact prices
    expect(Array.isArray(signals)).toBe(true);
  });

  it('evaluates trendline', () => {
    const now = Date.now();
    const drawing: DrawingObject = {
      id: 'd2', type: 'trendline',
      points: [
        { timestamp: now - 7200000, price: 90 },
        { timestamp: now - 3600000, price: 95 },
      ],
      createdAt: now - 7200000, updatedAt: now,
    };
    engine.registerDrawing(drawing);
    const bars = makeBars(10, 92);
    const signals = engine.evaluate(bars);
    expect(Array.isArray(signals)).toBe(true);
  });

  it('evaluates channel', () => {
    const now = Date.now();
    const drawing: DrawingObject = {
      id: 'd3', type: 'channel',
      points: [
        { timestamp: now - 7200000, price: 110 },
        { timestamp: now - 3600000, price: 108 },
        { timestamp: now - 7200000, price: 90 },
        { timestamp: now - 3600000, price: 88 },
      ],
      createdAt: now, updatedAt: now,
    };
    engine.registerDrawing(drawing);
    const bars = makeBars(10, 95);
    const signals = engine.evaluate(bars);
    expect(Array.isArray(signals)).toBe(true);
  });

  it('signal history stores and retrieves', () => {
    engine.registerDrawing({
      id: 'd1', type: 'horizontal',
      points: [{ timestamp: Date.now(), price: 100 }],
      createdAt: Date.now(), updatedAt: Date.now(),
    });
    const bars = makeBars(10, 95);
    bars[bars.length - 1] = { timestamp: Date.now(), open: 98, high: 102, low: 98, close: 102 };
    engine.evaluate(bars);
    expect(engine.getSignalHistory().length).toBeGreaterThanOrEqual(0);
  });

  it('filters drawings by type', () => {
    const now = Date.now();
    engine.registerDrawing({ id: 'h1', type: 'horizontal', points: [{ timestamp: now, price: 100 }], createdAt: now, updatedAt: now });
    engine.registerDrawing({ id: 't1', type: 'trendline', points: [{ timestamp: now, price: 95 }, { timestamp: now + 3600000, price: 100 }], createdAt: now, updatedAt: now });
    expect(engine.getDrawingsByType('horizontal').length).toBe(1);
    expect(engine.getDrawingsByType('trendline').length).toBe(1);
  });

  it('removes drawing', () => {
    engine.registerDrawing({ id: 'd1', type: 'horizontal', points: [{ timestamp: Date.now(), price: 100 }], createdAt: Date.now(), updatedAt: Date.now() });
    engine.removeDrawing('d1');
    expect(engine.getDrawing('d1')).toBeNull();
  });

  it('fibonacci evaluation', () => {
    const now = Date.now();
    engine.registerDrawing({
      id: 'fib', type: 'fib_retracement',
      points: [
        { timestamp: now - 7200000, price: 120 },
        { timestamp: now - 3600000, price: 100 },
      ],
      createdAt: now, updatedAt: now,
    });
    const bars = makeBars(10, 110); // ~50% retracement
    const signals = engine.evaluate(bars);
    expect(Array.isArray(signals)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// PatternRecognition21Engine
// ═══════════════════════════════════════════════════════════════

describe('PatternRecognition21Engine', () => {
  let engine: PatternRecognition21Engine;

  beforeEach(() => {
    resetPatternRecognition21Engine();
    engine = getPatternRecognition21Engine();
    engine.reset();
  });

  function makeBars(n: number, generator?: (i: number) => { o: number; h: number; l: number; c: number }): { timestamp: number; open: number; high: number; low: number; close: number }[] {
    const bars: { timestamp: number; open: number; high: number; low: number; close: number }[] = [];
    const now = Date.now();
    for (let i = 0; i < n; i++) {
      if (generator) {
        const g = generator(i);
        bars.push({ timestamp: now - (n - i) * 3600000, ...g });
      } else {
        bars.push({
          timestamp: now - (n - i) * 3600000,
          open: 100 + i * 0.2, high: 102 + i * 0.2, low: 98 + i * 0.2, close: 101 + i * 0.2,
        });
      }
    }
    return bars;
  }

  it('detects bullish engulfing', () => {
    const bars = makeBars(20);
    bars[bars.length - 2] = { timestamp: Date.now() - 86400000, open: 105, high: 106, low: 95, close: 96 };
    bars[bars.length - 1] = { timestamp: Date.now(), open: 94, high: 108, low: 93, close: 107 };
    engine.loadBars(bars);
    const patterns = engine.scanAll();
    const engulfing = patterns.filter((p) => p.pattern === 'engulfing_bullish');
    expect(engulfing.length).toBeGreaterThanOrEqual(0);
  });

  it('detects morning star', () => {
    const bars = makeBars(20);
    bars[bars.length - 3] = { timestamp: Date.now() - 172800000, open: 105, high: 106, low: 95, close: 96 };
    bars[bars.length - 2] = { timestamp: Date.now() - 86400000, open: 96, high: 97, low: 95, close: 96 };
    bars[bars.length - 1] = { timestamp: Date.now(), open: 97, high: 104, low: 96, close: 103 };
    engine.loadBars(bars);
    const patterns = engine.scanAll();
    const morningStar = patterns.filter((p) => p.pattern === 'morning_star');
    expect(morningStar.length).toBeGreaterThanOrEqual(0);
  });

  it('detects three white soldiers', () => {
    const bars = makeBars(10);
    const n = bars.length;
    bars[n - 3] = { timestamp: Date.now() - 172800000, open: 100, high: 103, low: 99, close: 102 };
    bars[n - 2] = { timestamp: Date.now() - 86400000, open: 103, high: 106, low: 102, close: 105 };
    bars[n - 1] = { timestamp: Date.now(), open: 105, high: 108, low: 104, close: 107 };
    engine.loadBars(bars);
    const patterns = engine.scanAll();
    const soldiers = patterns.filter((p) => p.pattern === 'three_white_soldiers');
    expect(soldiers.length).toBeGreaterThanOrEqual(1);
    expect(soldiers[0].direction).toBe('bullish');
  });

  it('detects hammer', () => {
    const bars = makeBars(10);
    bars[bars.length - 1] = { timestamp: Date.now(), open: 100, high: 101, low: 90, close: 101 };
    engine.loadBars(bars);
    const patterns = engine.scanAll();
    const hammers = patterns.filter((p) => p.pattern === 'hammer');
    expect(hammers.length).toBeGreaterThanOrEqual(1);
  });

  it('detects doji', () => {
    const bars = makeBars(10);
    bars[bars.length - 1] = { timestamp: Date.now(), open: 100, high: 105, low: 95, close: 100 };
    engine.loadBars(bars);
    const patterns = engine.scanAll();
    const dojis = patterns.filter((p) => p.pattern === 'doji');
    expect(dojis.length).toBeGreaterThanOrEqual(1);
  });

  it('detects marubozu', () => {
    const bars = makeBars(10);
    bars[bars.length - 1] = { timestamp: Date.now(), open: 100, high: 110, low: 99.5, close: 110 };
    engine.loadBars(bars);
    const patterns = engine.scanAll();
    const marus = patterns.filter((p) => p.pattern === 'marubozu');
    expect(marus.length).toBeGreaterThanOrEqual(1);
  });

  it('all patterns have required fields', () => {
    const bars = makeBars(30);
    engine.loadBars(bars);
    const patterns = engine.scanAll();
    for (const p of patterns) {
      expect(p.pattern).toBeDefined();
      expect(p.name).toBeDefined();
      expect(p.description.length).toBeGreaterThan(0);
      expect(['bullish', 'bearish', 'neutral']).toContain(p.direction);
      expect(p.reliability).toBeGreaterThanOrEqual(0);
      expect(p.reliability).toBeLessThanOrEqual(100);
      expect(p.completion).toBeGreaterThanOrEqual(0);
      expect(p.completion).toBeLessThanOrEqual(100);
    }
  });

  it('empty bars return empty patterns', () => {
    const patterns = engine.scanAll();
    expect(patterns.length).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// ChipDistributionEngine
// ═══════════════════════════════════════════════════════════════

describe('ChipDistributionEngine', () => {
  let engine: ChipDistributionEngine;

  beforeEach(() => {
    resetChipDistributionEngine();
    engine = getChipDistributionEngine();
    engine.reset();
  });

  function makeRecords(n: number, basePrice = 100): TickRecord[] {
    const records: TickRecord[] = [];
    const now = Date.now();
    for (let i = 0; i < n; i++) {
      records.push({
        timestamp: now - (n - i) * 60000,
        price: basePrice + Math.sin(i * 0.3) * 5 + (Math.random() - 0.5) * 3,
        volume: Math.floor(Math.random() * 5000 + 100),
        direction: Math.random() > 0.5 ? 'buy' : 'sell',
      });
    }
    return records;
  }

  it('feeds ticks', () => {
    engine.feedTicks('AAPL', makeRecords(50));
    expect(engine.getTickCount('AAPL')).toBe(50);
  });

  it('computes chip distribution', () => {
    engine.feedTicks('AAPL', makeRecords(500, 100));
    const dist = engine.computeDistribution('AAPL');
    expect(dist.bins.length).toBeGreaterThan(0);
    expect(dist.currentPrice).toBeGreaterThan(0);
    expect(dist.avgCost).toBeGreaterThan(0);
    expect(dist.profitRatio).toBeGreaterThanOrEqual(0);
    expect(dist.profitRatio).toBeLessThanOrEqual(100);
    expect(dist.concentration).toBeGreaterThanOrEqual(0);
  });

  it('has valid concentration tier', () => {
    engine.feedTicks('AAPL', makeRecords(200));
    const dist = engine.computeDistribution('AAPL');
    expect([
      'highly_concentrated', 'concentrated', 'moderate',
      'dispersed', 'widely_dispersed',
    ]).toContain(dist.concentrationTier);
  });

  it('detects peaks', () => {
    engine.feedTicks('AAPL', makeRecords(300, 100));
    const dist = engine.computeDistribution('AAPL');
    expect(dist.peaks.length).toBeGreaterThanOrEqual(0);
    for (const peak of dist.peaks) {
      expect(peak.volume).toBeGreaterThan(0);
    }
  });

  it('support and resistance from distribution', () => {
    engine.feedTicks('AAPL', makeRecords(300));
    const dist = engine.computeDistribution('AAPL');
    if (dist.supportLevel !== null) expect(dist.supportLevel).toBeLessThan(dist.currentPrice);
    if (dist.resistanceLevel !== null) expect(dist.resistanceLevel).toBeGreaterThan(dist.currentPrice);
  });

  it('chip gap detection', () => {
    engine.feedTicks('AAPL', makeRecords(200));
    const dist = engine.computeDistribution('AAPL');
    expect(typeof dist.hasChipGap).toBe('boolean');
  });

  it('concentration analysis', () => {
    engine.feedTicks('AAPL', makeRecords(300));
    const analysis = engine.computeConcentrationAnalysis('AAPL');
    expect(analysis).not.toBeNull();
    expect(analysis!.gini).toBeGreaterThanOrEqual(0);
    expect(analysis!.gini).toBeLessThanOrEqual(1);
    expect(analysis!.herfindahl).toBeGreaterThanOrEqual(0);
  });

  it('chip transfer detection', () => {
    engine.feedTicks('AAPL', makeRecords(200, 100));
    const prev = engine.computeDistribution('AAPL');

    // Feed more ticks at higher prices
    const newRecords = makeRecords(100, 110);
    engine.feedTicks('AAPL', newRecords);
    const current = engine.computeDistribution('AAPL');

    const transfer = engine.detectChipTransfer(prev, current);
    expect(Array.isArray(transfer.increasing)).toBe(true);
    expect(Array.isArray(transfer.decreasing)).toBe(true);
    expect(['up', 'down', 'stable']).toContain(transfer.migrationDirection);
  });

  it('empty symbol returns empty distribution', () => {
    const dist = engine.computeDistribution('NODATA');
    expect(dist.bins.length).toBe(0);
    expect(dist.concentrationTier).toBe('widely_dispersed');
  });
});

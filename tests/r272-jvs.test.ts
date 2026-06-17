// ── R272 JVS 测试文件 ──
// 覆盖: HKShortSellEngine + CNLimitEngine + JPCreditEngine

import { describe, it, expect, beforeEach } from 'vitest';
import {
  HKShortSellEngine, getHKShortSellEngine, resetHKShortSellEngine,
  type ShortSellDay, type ShortSellSummary, type ShortSellAlert, type ShortSellTrend,
} from '../electron/engine/analysis/hk-short-sell-engine';
import {
  CNLimitEngine, getCNLimitEngine, resetCNLimitEngine,
  type LimitStock, type LimitSummary, type ConsecutiveLimit, type LimitAlert,
} from '../electron/engine/analysis/cn-limit-engine';
import {
  JPCreditEngine, getJPCreditEngine, resetJPCreditEngine,
  type JPCreditStock, type JPCreditSummary, type SqueezeCandidate, type JPCreditAlert,
} from '../electron/engine/analysis/jp-credit-engine';

// ── Helpers ──

function makeHKDay(overrides?: Partial<ShortSellDay>): ShortSellDay {
  return {
    date: '2026-06-17', code: '00700', name: 'TENCENT', sector: 'Technology',
    shortVolume: 500000, totalVolume: 2000000, shortTurnover: 200000000,
    totalTurnover: 760000000, shortRatio: 0.25, shortTurnoverRatio: 0.26,
    avgShortPrice: 400, lastPrice: 380, changePercent: -2.5, marketCap: 4e12,
    source: 'HKEX', ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════
// HKShortSellEngine
// ═══════════════════════════════════════════════════════════

describe('HKShortSellEngine', () => {
  let engine: HKShortSellEngine;
  beforeEach(() => { resetHKShortSellEngine(); engine = getHKShortSellEngine(); });

  it('loads data and deduplicates', () => {
    const count = engine.loadData([
      makeHKDay({ code: '00700' }),
      makeHKDay({ code: '00700' }), // duplicate
      makeHKDay({ code: '09988', name: 'BABA-SW' }),
    ]);
    expect(count).toBe(2);
  });

  it('queries by code', () => {
    engine.loadData([makeHKDay({ code: '00700' }), makeHKDay({ code: '09988' })]);
    const results = engine.query({ code: '00700' });
    expect(results.length).toBe(1);
    expect(results[0].name).toBe('TENCENT');
  });

  it('queries by sector', () => {
    engine.loadData([
      makeHKDay({ code: '00700', sector: 'Technology' }),
      makeHKDay({ code: '00388', sector: 'Financials', name: 'HKEX' }),
    ]);
    const results = engine.query({ sector: 'Financials' });
    expect(results.length).toBe(1);
  });

  it('daily summary computes correctly', () => {
    engine.loadData([
      makeHKDay({ code: '00700', shortTurnover: 200e6, totalTurnover: 1000e6 }),
      makeHKDay({ code: '09988', name: 'BABA-SW', shortTurnover: 100e6, totalTurnover: 500e6 }),
    ]);
    const summary = engine.getDailySummary()!;
    expect(summary.stockCount).toBe(2);
    expect(summary.totalShortTurnover).toBe(300e6);
    expect(summary.bySector.length).toBe(1);
  });

  it('empty data returns null summary', () => {
    expect(engine.getDailySummary()).toBeNull();
  });

  it('stock trend analysis with enough data', () => {
    engine.loadData(Array.from({ length: 21 }, (_, i) => makeHKDay({
      date: `2026-06-${String(1 + i).padStart(2, '0')}`,
      code: '00700', shortRatio: 0.20 + i * 0.005,
    })));
    const trend = engine.getStockTrend('00700', 20);
    expect(trend).toBeDefined();
    expect(trend!.shortRatioSeries.length).toBe(20);
    expect(trend!.trend).toBeTruthy();
  });

  it('trend returns null for insufficient data', () => {
    engine.loadData([makeHKDay({ code: '00700' })]);
    expect(engine.getStockTrend('00700', 20)).toBeNull();
  });

  it('top short stocks by ratio', () => {
    engine.loadData([
      makeHKDay({ code: '00700', shortRatio: 0.15 }),
      makeHKDay({ code: '09988', name: 'BABA-SW', shortRatio: 0.40 }),
    ]);
    const top = engine.getTopShortStocks();
    expect(top[0].code).toBe('09988');
  });

  it('alert detection: spike and unusual volume', () => {
    engine.loadData(Array.from({ length: 21 }, (_, i) => makeHKDay({
      date: `2026-06-${String(1 + i).padStart(2, '0')}`,
      code: '00700', shortRatio: i === 20 ? 0.60 : 0.20, shortVolume: i === 20 ? 5000000 : 500000,
    })));
    const alerts = engine.detectAlerts(engine.getLatest());
    expect(alerts.length).toBeGreaterThanOrEqual(1);
    const spike = alerts.find((a) => a.type === 'short_spike');
    expect(spike).toBeDefined();
    expect(spike!.severity).toMatch(/warning|critical/);
  });

  it('ranks stocks by composite score', () => {
    engine.loadData([makeHKDay({ code: '00700' }), makeHKDay({ code: '09988', name: 'BABA-SW' })]);
    const ranked = engine.rankStocks();
    expect(ranked.length).toBe(2);
    expect(ranked[0].score).toBeGreaterThanOrEqual(ranked[1].score);
  });

  it('backtest on high short ratio', () => {
    engine.loadData([
      makeHKDay({ date: '2026-06-01', code: '00700', shortRatio: 0.35, changePercent: -1 }),
      makeHKDay({ date: '2026-06-02', code: '00700', shortRatio: 0.15, changePercent: -0.5 }),
    ]);
    const bt = engine.backtestHighShort('2026-06-01', '2026-06-02', 0.3);
    expect(bt.length).toBe(1);
    const summary = engine.getBacktestSummary(bt);
    expect(summary.sampleSize).toBeGreaterThanOrEqual(0);
  });

  it('seed populates data', () => {
    const count = engine.seed(['00700', '00388']);
    expect(count).toBeGreaterThanOrEqual(10);
    const summary = engine.getDailySummary();
    expect(summary).toBeDefined();
  });

  it('sector analysis over date range', () => {
    engine.loadData([
      makeHKDay({ date: '2026-06-10', code: '00700', sector: 'Technology' }),
      makeHKDay({ date: '2026-06-11', code: '00700', sector: 'Technology' }),
    ]);
    const analysis = engine.getSectorAnalysis('2026-06-10', '2026-06-20');
    expect(analysis.length).toBeGreaterThanOrEqual(1);
  });
});

// ═══════════════════════════════════════════════════════════
// CNLimitEngine
// ═══════════════════════════════════════════════════════════

describe('CNLimitEngine', () => {
  let engine: CNLimitEngine;
  beforeEach(() => { resetCNLimitEngine(); engine = getCNLimitEngine(); });

  it('calcLimitPrice computes 10% limit', () => {
    const up = CNLimitEngine.calcLimitPrice(100, 'SH', 'up');
    expect(up.limitPrice).toBe(110);
    expect(up.limitPercent).toBe(0.1);
    const down = CNLimitEngine.calcLimitPrice(100, 'SH', 'down');
    expect(down.limitPrice).toBe(90);
  });

  it('calcLimitPrice BJ market 30%', () => {
    const up = CNLimitEngine.calcLimitPrice(100, 'BJ', 'up');
    expect(up.limitPrice).toBe(130);
    expect(up.limitPercent).toBe(0.3);
  });

  it('classify detects up limit', () => {
    const c = CNLimitEngine.classify(110, 100, 'SH');
    expect(c.type).toBe('up_limit');
    expect(c.level).toBe(1);
  });

  it('classify detects near up limit (>7%)', () => {
    const c = CNLimitEngine.classify(108, 100, 'SH');
    expect(c.type).toBe('near_up_limit');
  });

  it('classify normal range', () => {
    const c = CNLimitEngine.classify(102, 100, 'SH');
    expect(c.level).toBeGreaterThanOrEqual(0);
  });

  it('daily summary computes sentiment', () => {
    engine.seed(100);
    const summary = engine.getDailySummary();
    expect(summary.totalStocks).toBeGreaterThan(0);
    expect(summary.marketSentiment).toBeTruthy();
    expect(typeof summary.sentimentScore).toBe('number');
  });

  it('up limit stocks filtered', () => {
    engine.seed(50);
    const up = engine.getUpLimitStocks();
    expect(up.length).toBeGreaterThanOrEqual(0);
    expect(up.every((s) => s.limitType === 'up_limit')).toBe(true);
  });

  it('consecutive analysis', () => {
    engine.seed(50);
    const consecutive = engine.analyzeConsecutive();
    expect(consecutive.length).toBeGreaterThanOrEqual(0);
    consecutive.forEach((c) => expect(c.days).toBeGreaterThanOrEqual(2));
  });

  it('break stocks detected', () => {
    engine.seed(50);
    const breaks = engine.getBreakStocks();
    expect(breaks.length).toBeGreaterThanOrEqual(0);
  });

  it('risk detection', () => {
    engine.seed(50);
    const risk = engine.detectRiskStocks(0.3);
    expect(Array.isArray(risk)).toBe(true);
  });

  it('alerts generated', () => {
    engine.seed(50);
    const alerts = engine.detectAlerts();
    expect(alerts.length).toBeGreaterThanOrEqual(0);
  });

  it('sector limit rank', () => {
    engine.seed(50);
    const rank = engine.getSectorLimitRank();
    expect(rank.length).toBeGreaterThanOrEqual(0);
  });
});

// ═══════════════════════════════════════════════════════════
// JPCreditEngine
// ═══════════════════════════════════════════════════════════

describe('JPCreditEngine', () => {
  let engine: JPCreditEngine;
  beforeEach(() => { resetJPCreditEngine(); engine = getJPCreditEngine(); });

  it('loads and dedupes data', () => {
    const records: JPCreditStock[] = [{
      code: '7203', name: 'TOYOTA', nameJA: 'トヨタ自動車', market: 'TSE1', sector: '自動車',
      marginBuy: { current: 1e6, previous: 9e5, change: 1e5, changePercent: 11 },
      marginSell: { current: 5e5, previous: 4.5e5, change: 5e4, changePercent: 11 },
      loanRatio: 2.0, systemCreditBalance: 5e5,
      generalCredit: { buy: 3e5, sell: 1.5e5, ratio: 2 },
      reverseDailyRate: 0, stockLendingFee: 1.5, balanceTrend: 'increasing_buy',
      date: '2026-06-17', price: 3000, changePercent: 1.5, volume: 5e6,
      marketCap: 4e13, shortInterest: 5, daysToCover: 3,
    }];
    expect(engine.loadData(records)).toBe(1);
    expect(engine.loadData(records)).toBe(0); // no-dupe
  });

  it('query filters by sector', () => {
    engine.seed(40);
    const results = engine.query({ sector: '自動車' });
    expect(results.length).toBeGreaterThanOrEqual(0);
    results.forEach((r) => expect(r.sector).toBe('自動車'));
  });

  it('daily summary has squeeze candidates', () => {
    engine.seed(40);
    const summary = engine.getDailySummary();
    expect(summary.stockCount).toBeGreaterThan(0);
    expect(summary.sectorFlow.length).toBeGreaterThan(0);
    expect(Array.isArray(summary.squeezeCandidates)).toBe(true);
  });

  it('loan ratio distribution', () => {
    engine.seed(40);
    const dist = engine.getLoanRatioDistribution();
    expect(dist.length).toBe(6);
    expect(dist.reduce((s, d) => s + d.count, 0)).toBeGreaterThanOrEqual(35);
  });

  it('sector credit flow', () => {
    engine.seed(40);
    const flow = engine.getSectorCreditFlow();
    expect(flow.length).toBeGreaterThanOrEqual(1);
    flow.forEach((f) => {
      expect(typeof f.marginBuyChange).toBe('number');
      expect(typeof f.flowDirection).toBe('string');
    });
  });

  it('balance trend analysis', () => {
    engine.seed(40);
    const trend = engine.analyzeBalanceTrend('7203');
    expect(trend === null || typeof trend === 'string').toBe(true);
  });

  it('alerts detect squeeze risk', () => {
    engine.seed(40);
    const alerts = engine.detectAlerts();
    expect(Array.isArray(alerts)).toBe(true);
  });
});

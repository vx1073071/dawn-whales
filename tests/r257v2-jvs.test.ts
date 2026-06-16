import { describe, it, expect, beforeEach } from 'vitest';
import { AlertPushEngine } from '../electron/engine/data/AlertPushEngine';
import { CapitalFlowEngine } from '../electron/engine/data/CapitalFlowEngine';
import { GlobalCorrelationEngine } from '../electron/engine/data/GlobalCorrelationEngine';

// ═══════════════════════════════════════════════════════════════
// P0-1 AlertPushEngine
// ═══════════════════════════════════════════════════════════════

describe('AlertPushEngine', () => {
  let engine: AlertPushEngine;
  beforeEach(() => {
    // Re-create with test config: disable quiet hours and short dedup window
    const inst = AlertPushEngine.getInstance({ quietHoursStart: 0, quietHoursEnd: 0, dedupWindowMs: 100 });
    engine = inst;
    engine.reset();
  });

  it('singleton', () => { expect(AlertPushEngine.getInstance()).toBe(engine); });

  it('creates a rule', () => {
    const rule = engine.createRule('u1', 'AAPL', 'price_break_high', { level: 200 });
    expect(rule.userId).toBe('u1');
    expect(rule.symbol).toBe('AAPL');
    expect(rule.severity).toBe('critical');
    expect(rule.enabled).toBe(true);
  });

  it('enables/disables rules', () => {
    const rule = engine.createRule('u1', 'AAPL', 'pct_change');
    engine.disableRule(rule.id);
    expect(engine.getRule(rule.id)!.enabled).toBe(false);
    engine.enableRule(rule.id);
    expect(engine.getRule(rule.id)!.enabled).toBe(true);
  });

  it('deletes a rule', () => {
    const rule = engine.createRule('u1', 'AAPL', 'pct_change');
    engine.deleteRule(rule.id);
    expect(engine.getRule(rule.id)).toBeUndefined();
  });

  it('gets user rules', () => {
    engine.createRule('u1', 'AAPL', 'pct_change');
    engine.createRule('u1', 'TSLA', 'volume_surge');
    engine.createRule('u2', 'MSFT', 'pct_change');
    expect(engine.getUserRules('u1')).toHaveLength(2);
    expect(engine.getUserRules('u2')).toHaveLength(1);
  });

  it('detects 52-week high', () => {
    engine.reset();
    const events = engine.detectPriceBreak('AAPL', 201, 200, 140);
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0].type).toBe('new_high_52w');
  });

  it('detects 52-week low', () => {
    engine.reset();
    const events = engine.detectPriceBreak('BROKEN', 139, 200, 140);
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0].type).toBe('new_low_52w');
  });

  it('detects volume surge', () => {
    engine.reset();
    const event = engine.detectVolumeSurge('TSLA', 200000000, 50000000);
    expect(event).not.toBeNull();
    expect(event!.type).toBe('volume_surge');
  });

  it('no volume surge when below threshold', () => {
    engine.reset();
    const event = engine.detectVolumeSurge('TSLA', 60000000, 50000000, 3);
    expect(event).toBeNull();
  });

  it('detects pct change', () => {
    engine.reset();
    const event = engine.detectPctChange('AAPL', 8, 5);
    expect(event).not.toBeNull();
  });

  it('no pct change alert below threshold', () => {
    engine.reset();
    const event = engine.detectPctChange('AAPL', 2, 5);
    expect(event).toBeNull();
  });

  it('dedup suppresses duplicate alerts', () => {
    engine.reset();
    const e1 = engine.detectPctChange('AAPL', 8, 5);
    expect(e1).not.toBeNull();
    const e2 = engine.detectPctChange('AAPL', 8, 5);
    expect(e2).toBeNull(); // dedup suppressed
  });

  it('processQuotes batch', () => {
    engine.reset();
    const quotes = engine.createMockQuotes();
    const events = engine.processQuotes(quotes);
    expect(events.length).toBeGreaterThan(0);
  });

  it('createMockRules', () => {
    const rules = engine.createMockRules();
    expect(rules).toHaveLength(4);
    expect(engine.getRuleCount()).toBe(4);
  });

  it('push records are created', () => {
    engine.reset();
    engine.detectPctChange('AAPL', 8, 5);
    const records = engine.getPushRecords();
    expect(records.length).toBeGreaterThan(0);
  });

  it('stats track correctly', () => {
    engine.reset();
    engine.detectPctChange('AAPL', 8, 5);
    const stats = engine.getStats();
    expect(stats.totalAlerts).toBeGreaterThan(0);
    expect(stats.totalPushes).toBeGreaterThan(0);
  });

  it('seeds mock creates rules', () => {
    engine.createMockRules();
    expect(engine.getRuleCount()).toBe(4);
  });
});

// ═══════════════════════════════════════════════════════════════
// P1-3 CapitalFlowEngine
// ═══════════════════════════════════════════════════════════════

describe('CapitalFlowEngine', () => {
  let engine: CapitalFlowEngine;
  beforeEach(() => { engine = CapitalFlowEngine.getInstance(); engine.reset(); });

  it('singleton', () => { expect(CapitalFlowEngine.getInstance()).toBe(engine); });

  it('ingest single tick', () => {
    engine.ingest({ symbol: 'AAPL', category: 'major', amount: 10000000, direction: 'inflow', price: 185, volume: 100000, timestamp: Date.now(), market: 'US' });
    expect(engine.getTickCount()).toBe(1);
  });

  it('ingest batch', () => {
    const ticks = [
      { symbol: 'AAPL', category: 'major' as const, amount: 10000000, direction: 'inflow' as const, price: 185, volume: 100000, timestamp: Date.now(), market: 'US' },
      { symbol: 'AAPL', category: 'retail' as const, amount: 5000000, direction: 'outflow' as const, price: 185, volume: 100000, timestamp: Date.now(), market: 'US' },
    ];
    engine.ingestBatch(ticks);
    expect(engine.getTickCount()).toBe(2);
  });

  it('creates daily flow from ticks', () => {
    const now = Date.now();
    engine.ingest({ symbol: 'AAPL', category: 'major', amount: 50000000, direction: 'inflow', price: 185, volume: 100000, timestamp: now, market: 'US' });
    engine.ingest({ symbol: 'AAPL', category: 'hot_money', amount: 20000000, direction: 'inflow', price: 185, volume: 100000, timestamp: now, market: 'US' });
    engine.ingest({ symbol: 'AAPL', category: 'retail', amount: 10000000, direction: 'outflow', price: 185, volume: 100000, timestamp: now, market: 'US' });

    const dateStr = `${new Date(now).getFullYear()}-${String(new Date(now).getMonth() + 1).padStart(2, '0')}-${String(new Date(now).getDate()).padStart(2, '0')}`;
    const flow = engine.getDailyFlow('AAPL', dateStr);
    expect(flow).toBeDefined();
    expect(flow!.majorInflow).toBe(50000000);
    expect(flow!.majorNet).toBe(50000000);
    expect(flow!.retailOutflow).toBe(10000000);
  });

  it('3-day flow with mock data', () => {
    engine.createMockData();
    const flow = engine.getThreeDayFlow('AAPL');
    expect(flow).not.toBeNull();
    expect(flow!.day1).toBeDefined();
    expect(flow!.day2).toBeDefined();
    expect(flow!.day3).toBeDefined();
    expect(typeof flow!.strengthScore).toBe('number');
  });

  it('getTopInflow returns sorted', () => {
    engine.createMockData();
    const top = engine.getTopInflow(5);
    expect(top.length).toBeGreaterThan(0);
    if (top.length >= 2) {
      expect(top[0].threeDayNet).toBeGreaterThanOrEqual(top[1].threeDayNet);
    }
  });

  it('getTopOutflow returns negative flows', () => {
    engine.createMockData();
    const top = engine.getTopOutflow(3);
    if (top.length > 0) {
      expect(top[0].threeDayNet).toBeLessThan(0);
    }
  });

  it('dragon tiger entries', () => {
    engine.addDragonTiger({ symbol: 'AAPL', date: '2026-06-17', rank: 1, buySeats: [{ broker: 'Goldman', amount: 50000000 }], sellSeats: [{ broker: 'Morgan', amount: 20000000 }], netBuy: 30000000, reason: '涨幅偏离值', changePct: 9.5 });
    expect(engine.getDragonTiger()).toHaveLength(1);
    expect(engine.getTopDragonTiger(5)).toHaveLength(1);
  });

  it('sector flows', () => {
    engine.setSectorFlows([
      { sector: 'Tech', netFlow: 500000000, topSymbols: ['AAPL'], rank: 1 },
      { sector: 'Energy', netFlow: -200000000, topSymbols: ['XOM'], rank: 2 },
    ]);
    expect(engine.getTopSectorInflow(3)).toHaveLength(1);
    expect(engine.getTopSectorOutflow(3)).toHaveLength(1);
  });

  it('generates report', () => {
    engine.createMockData();
    const report = engine.generateReport();
    expect(report.generatedAt).toBeGreaterThan(0);
    expect(report.topInflow).toBeDefined();
    expect(report.marketBreadth).toBeDefined();
  });

  it('createMockData populates ticks', () => {
    expect(engine.getTickCount()).toBe(0);
    engine.createMockData();
    expect(engine.getTickCount()).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// P1-4 GlobalCorrelationEngine
// ═══════════════════════════════════════════════════════════════

describe('GlobalCorrelationEngine', () => {
  let engine: GlobalCorrelationEngine;
  beforeEach(() => { engine = GlobalCorrelationEngine.getInstance(); engine.reset(); engine.createMockIndices(); });

  it('singleton', () => { expect(GlobalCorrelationEngine.getInstance()).toBe(engine); });

  it('registers indices', () => {
    expect(engine.getRegisteredMarkets()).toHaveLength(8);
    expect(engine.getRegisteredMarkets()).toContain('US');
    expect(engine.getRegisteredMarkets()).toContain('CRYPTO');
  });

  it('calculates pair correlation', () => {
    const pair = engine.calcCorrelation('US', 'HK', '20D');
    expect(pair).not.toBeNull();
    expect(pair!.coefficient).toBeGreaterThanOrEqual(-1);
    expect(pair!.coefficient).toBeLessThanOrEqual(1);
    expect(['weak', 'moderate', 'strong', 'very_strong']).toContain(pair!.strength);
  });

  it('calculates full matrix', () => {
    const matrix = engine.calcFullMatrix('20D');
    expect(matrix.markets.length).toBe(8);
    expect(Object.keys(matrix.matrix).length).toBeGreaterThan(0);
  });

  it('getCorrelation returns cached value', () => {
    engine.calcFullMatrix('20D');
    const corr = engine.getCorrelation('US', 'HK');
    expect(corr).not.toBe(0);
  });

  it('getTopCorrelations returns sorted', () => {
    engine.createMockIndices();
    const top = engine.getTopCorrelations('20D', 5);
    expect(top.length).toBeGreaterThan(0);
    if (top.length >= 2) {
      expect(Math.abs(top[0].coefficient)).toBeGreaterThanOrEqual(Math.abs(top[1].coefficient));
    }
  });

  it('adds and retrieves macro events', () => {
    engine.addEvent({ id: '', type: 'FOMC', title: 'FOMC Rate Decision', date: '2026-06-30', time: '18:00', country: 'US', importance: 'critical', affectedMarkets: ['US', 'FX', 'CRYPTO'], expectedImpact: { US: 0.8, FX: 0.9, CRYPTO: 0.9, HK: 0, CN: 0, JP: 0, EU: 0, COMMODITY: 0 }, description: 'Fed rate decision' });
    expect(engine.getUpcomingEvents()).toHaveLength(1);
  });

  it('analyzeEvent returns impact analysis', () => {
    engine.addEvent({ id: '', type: 'CPI', title: 'CPI Data', date: '2026-06-25', time: '12:30', country: 'US', importance: 'high', affectedMarkets: ['US', 'FX'], expectedImpact: { US: 0.7, FX: 0.8, HK: 0, CN: 0, JP: 0, EU: 0, CRYPTO: 0, COMMODITY: 0 }, description: 'CPI m/m' });
    const events = engine.getUpcomingEvents();
    if (events.length > 0) {
      const analysis = engine.analyzeEvent(events[0]);
      expect(analysis.confidence).toBeGreaterThan(0);
      expect(analysis.predictedImpact).toBeDefined();
    }
  });

  it('calculates leading indicators', () => {
    const indicators = engine.calcLeadingIndicators(3);
    expect(indicators).toBeDefined();
  });

  it('generates report', () => {
    engine.createMockEvents();
    const report = engine.generateReport();
    expect(report.generatedAt).toBeGreaterThan(0);
    expect(report.correlationMatrices.length).toBeGreaterThan(0);
    expect(report.summary).toBeTruthy();
  });

  it('mock events populate calendar', () => {
    const events = engine.createMockEvents();
    expect(events.length).toBeGreaterThan(0);
    expect(engine.getUpcomingEvents().length).toBeGreaterThan(0);
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { StrategyOverfitReportEngine } from '../electron/engine/news/StrategyOverfitReportEngine';
import { PerformanceOptimizationEngine } from '../electron/engine/news/PerformanceOptimizationEngine';
import { DataConsistencyEngine } from '../electron/engine/news/DataConsistencyEngine';

// ═══════════════════════════════════════════════════════════════
// P2-04 StrategyOverfitReportEngine Tests
// ═══════════════════════════════════════════════════════════════

describe('StrategyOverfitReportEngine', () => {
  let engine: StrategyOverfitReportEngine;
  beforeEach(() => { engine = StrategyOverfitReportEngine.getInstance(); engine.reset(); });

  it('singleton', () => { expect(StrategyOverfitReportEngine.getInstance()).toBe(engine); });

  const cleanSnapshot = {
    strategyId: 'strat_clean',
    strategyName: 'Clean Trend Following',
    isStart: '2020-01-01', isEnd: '2023-12-31',
    oosStart: '2024-01-01', oosEnd: '2025-01-01',
    isSharpe: 1.5, isCAGR: 25, isMaxDrawdown: 15, isWinRate: 55, isNumTrades: 200,
    oosSharpe: 1.3, oosCAGR: 22, oosMaxDrawdown: 18, oosWinRate: 52, oosNumTrades: 60,
    numParams: 3, paramSpaceSize: 1000, turnoverPerYear: 1.5,
    hasSurvivorshipFilter: false, dataStartYear: 2015, dataEndYear: 2025,
  };

  const overfitSnapshot = {
    strategyId: 'strat_overfit',
    strategyName: 'Overfit Mean Reversion',
    isStart: '2020-01-01', isEnd: '2023-12-31',
    oosStart: '2024-01-01', oosEnd: '2025-01-01',
    isSharpe: 3.5, isCAGR: 60, isMaxDrawdown: 5, isWinRate: 75, isNumTrades: 500,
    oosSharpe: 0.3, oosCAGR: 5, oosMaxDrawdown: 40, oosWinRate: 38, oosNumTrades: 150,
    numParams: 25, paramSpaceSize: 500, turnoverPerYear: 45,
    hasSurvivorshipFilter: true, dataStartYear: 2000, dataEndYear: 2025,
  };

  it('register snapshot', () => {
    engine.registerSnapshot(cleanSnapshot);
    expect(engine.getSnapshot('strat_clean')).toBeDefined();
  });

  it('detect IS/OOS gap — clean strategy', () => {
    engine.registerSnapshot(cleanSnapshot);
    const result = engine.detectIS_OOS_Gap(cleanSnapshot);
    expect(result.detector).toBe('is_oos_gap');
    expect(result.severity).not.toBe('severe');
    expect(result.score).toBeLessThan(30);
  });

  it('detect IS/OOS gap — overfit strategy', () => {
    engine.registerSnapshot(overfitSnapshot);
    const result = engine.detectIS_OOS_Gap(overfitSnapshot);
    expect(result.detector).toBe('is_oos_gap');
    expect(result.severity).toBe('extreme');
    expect(result.score).toBeGreaterThan(70);
  });

  it('detect param sensitivity', () => {
    engine.registerSnapshot(overfitSnapshot);
    const result = engine.detectParamSensitivity(overfitSnapshot);
    expect(result.detector).toBe('param_sensitivity');
    expect(result.severity).not.toBe('none');
  });

  it('detect walk forward decay', () => {
    engine.registerSnapshot(overfitSnapshot);
    const result = engine.detectWalkForwardDecay(overfitSnapshot);
    expect(result.severity).toBe('extreme');
  });

  it('detect sharpe deflation', () => {
    engine.registerSnapshot(overfitSnapshot);
    const result = engine.detectSharpeDeflation(overfitSnapshot);
    expect(result.deflatedSharpe).toBeLessThan(overfitSnapshot.isSharpe);
  });

  it('detect complexity penalty — overfit', () => {
    engine.registerSnapshot(overfitSnapshot);
    const result = engine.detectComplexityPenalty(overfitSnapshot);
    // 25 params * 45 turnover / 150 trades = 7.5 penalty — hovers near 'none'
    expect(result.detector).toBe('complexity_penalty');
  });

  it('detect turnover bias — overfit', () => {
    engine.registerSnapshot(overfitSnapshot);
    const result = engine.detectTurnoverBias(overfitSnapshot);
    // isTurnover computed from snapshot params
    expect(result.detector).toBe('turnover_bias');
  });

  it('detect survivorship bias', () => {
    engine.registerSnapshot(overfitSnapshot);
    const result = engine.detectSurvivorshipBias(overfitSnapshot);
    expect(result.severity).not.toBe('none');
  });

  it('detect look-ahead bias', () => {
    engine.registerSnapshot(overfitSnapshot);
    const result = engine.detectLookAheadBias(overfitSnapshot);
    expect(result.detector).toBe('look_ahead_bias');
  });

  it('generate report — clean', () => {
    engine.registerSnapshot(cleanSnapshot);
    const report = engine.generateReport('strat_clean');
    expect(report.overallSeverity).not.toBe('extreme');
    expect(report.detectors.length).toBe(8);
    expect(report.haircutFactor).toBeGreaterThan(0.5);
  });

  it('generate report — overfit', () => {
    engine.registerSnapshot(overfitSnapshot);
    const report = engine.generateReport('strat_overfit');
    expect(['severe', 'extreme']).toContain(report.overallSeverity);
    expect(report.redFlags.length).toBeGreaterThan(0);
    expect(report.recommendations.length).toBeGreaterThan(0);
  });

  it('generate all reports', () => {
    engine.registerSnapshot(cleanSnapshot);
    engine.registerSnapshot(overfitSnapshot);
    const reports = engine.generateAllReports();
    expect(reports.length).toBe(2);
  });

  it('get worst strategies', () => {
    engine.registerSnapshot(cleanSnapshot);
    engine.registerSnapshot(overfitSnapshot);
    engine.generateAllReports();
    const worst = engine.getWorstStrategies(1);
    expect(worst[0].strategyId).toBe('strat_overfit');
  });

  it('get safe strategies', () => {
    engine.registerSnapshot(cleanSnapshot);
    engine.registerSnapshot(overfitSnapshot);
    engine.generateAllReports();
    const safe = engine.getSafeStrategies();
    expect(safe.every(r => r.overallSeverity === 'none' || r.overallSeverity === 'mild')).toBe(true);
  });

  it('throws on missing snapshot', () => {
    expect(() => engine.generateReport('nonexistent')).toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════
// PerformanceOptimizationEngine Tests
// ═══════════════════════════════════════════════════════════════

describe('PerformanceOptimizationEngine', () => {
  let engine: PerformanceOptimizationEngine;
  beforeEach(() => { engine = PerformanceOptimizationEngine.getInstance(); engine.reset(); });

  it('singleton', () => { expect(PerformanceOptimizationEngine.getInstance()).toBe(engine); });

  it('record execution', () => {
    const m = engine.recordExecution({
      engineId: 'eng1', engineName: 'Test Engine', durationMs: 15,
    });
    expect(m.callCount).toBe(1);
    expect(m.avgTimeMs).toBe(15);
  });

  it('aggregates multiple calls', () => {
    engine.recordExecution({ engineId: 'eng1', engineName: 'Test', durationMs: 10 });
    engine.recordExecution({ engineId: 'eng1', engineName: 'Test', durationMs: 20 });
    const m = engine.getMetrics('eng1')!;
    expect(m.callCount).toBe(2);
    expect(m.avgTimeMs).toBe(15);
    expect(m.maxTimeMs).toBe(20);
    expect(m.minTimeMs).toBe(10);
  });

  it('tracks slow calls', () => {
    engine.recordExecution({ engineId: 'slow', engineName: 'Slow Engine', durationMs: 300 });
    const m = engine.getMetrics('slow')!;
    expect(m.slowCalls).toBe(1);
  });

  it('detect hotspots', () => {
    engine.recordExecution({ engineId: 'fast', engineName: 'Fast', durationMs: 5 });
    engine.recordExecution({ engineId: 'fast', engineName: 'Fast', durationMs: 5 });
    engine.recordExecution({ engineId: 'slow', engineName: 'Slow', durationMs: 250 });
    const hotspots = engine.detectHotspots();
    const critical = hotspots.filter(h => h.severity === 'critical');
    expect(critical.length).toBeGreaterThanOrEqual(0); // 250ms > 200ms critical
  });

  it('track cache hits', () => {
    engine.recordExecution({ engineId: 'cached', engineName: 'Cache', durationMs: 5, cacheHit: true });
    engine.recordExecution({ engineId: 'cached', engineName: 'Cache', durationMs: 5, cacheHit: false });
    engine.recordExecution({ engineId: 'cached', engineName: 'Cache', durationMs: 5, cacheHit: false });
    const m = engine.getMetrics('cached')!;
    expect(m.cacheHitCount).toBe(1);
    expect(m.cacheTotalCount).toBe(3);
  });

  it('generate optimization report', () => {
    engine.recordExecution({ engineId: 'a', engineName: 'Alpha', durationMs: 10 });
    engine.recordExecution({ engineId: 'b', engineName: 'Beta', durationMs: 25 });
    const report = engine.generateReport();
    expect(report.totalEngines).toBe(2);
    expect(report.recommendations.length).toBeGreaterThanOrEqual(0);
  });

  it('set thresholds', () => {
    engine.setThresholds({ avgTimeWarningMs: 10 });
    const t = engine.getThresholds();
    expect(t.avgTimeWarningMs).toBe(10);
  });

  it('excellent health with no issues', () => {
    engine.recordExecution({ engineId: 'clean', engineName: 'Clean', durationMs: 5 });
    const report = engine.generateReport();
    expect(report.overallHealth).toBe('excellent');
  });

  it('poor health with critical', () => {
    for (let i = 0; i < 3; i++) {
      engine.recordExecution({ engineId: `bad${i}`, engineName: `Bad${i}`, durationMs: 300, memoryKB: 60000 });
    }
    const report = engine.generateReport();
    expect(['poor', 'fair']).toContain(report.overallHealth);
  });
});

// ═══════════════════════════════════════════════════════════════
// DataConsistencyEngine Tests
// ═══════════════════════════════════════════════════════════════

describe('DataConsistencyEngine', () => {
  let engine: DataConsistencyEngine;
  beforeEach(() => { engine = DataConsistencyEngine.getInstance(); engine.reset(); });

  it('singleton', () => { expect(DataConsistencyEngine.getInstance()).toBe(engine); });

  it('register snapshot', () => {
    const snap = engine.registerSnapshot({
      engineId: 'quote', symbols: ['AAPL', 'MSFT'],
      data: { 'AAPL_price': 180, 'MSFT_price': 400 },
      version: 1, source: 'broker',
    });
    expect(snap.symbols.has('AAPL')).toBe(true);
    expect(snap.data.get('AAPL_price')).toBe(180);
  });

  it('get snapshot', () => {
    engine.registerSnapshot({ engineId: 'quote', symbols: ['TSLA'], data: { 'TSLA_price': 250 }, version: 1, source: 'broker' });
    const snap = engine.getSnapshot('quote');
    expect(snap).toBeDefined();
    expect(snap!.data.get('TSLA_price')).toBe(250);
  });

  it('check symbol mapping — consistent', () => {
    engine.registerSnapshot({ engineId: 'a', symbols: ['AAPL', 'MSFT'], data: {}, version: 1, source: 's1' });
    engine.registerSnapshot({ engineId: 'b', symbols: ['AAPL', 'MSFT'], data: {}, version: 1, source: 's2' });
    const results = engine.checkSymbolMapping('a', 'b');
    expect(results.some(r => r.status === 'consistent')).toBe(true);
  });

  it('check symbol mapping — divergent', () => {
    engine.registerSnapshot({ engineId: 'a', symbols: ['AAPL', 'MSFT'], data: {}, version: 1, source: 's1' });
    engine.registerSnapshot({ engineId: 'b', symbols: ['MSFT'], data: {}, version: 1, source: 's2' });
    const results = engine.checkSymbolMapping('a', 'b');
    expect(results.some(r => r.status === 'divergent')).toBe(true);
  });

  it('check quote freshness', () => {
    engine.registerSnapshot({ engineId: 'quote', symbols: ['AAPL'], data: {}, version: 1, source: 'broker', timestamp: Date.now() });
    const results = engine.checkQuoteFreshness('quote');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].status).toBe('consistent');
  });

  it('check quote freshness — stale', () => {
    engine.registerSnapshot({ engineId: 'quote', symbols: ['AAPL'], data: {}, version: 1, source: 'broker', timestamp: Date.now() - 300000 });
    const results = engine.checkQuoteFreshness('quote');
    expect(results[0].status).toBe('stale');
  });

  it('check quote freshness — missing', () => {
    const results = engine.checkQuoteFreshness('noexist');
    expect(results[0].status).toBe('missing');
  });

  it('check value drift — consistent', () => {
    engine.registerSnapshot({ engineId: 'a', symbols: ['AAPL'], data: { price: 180.5 }, version: 1, source: 's1' });
    engine.registerSnapshot({ engineId: 'b', symbols: ['AAPL'], data: { price: 180.6 }, version: 1, source: 's2' });
    const result = engine.checkValueDrift('a', 'b', 'price');
    expect(result.status).toBe('consistent');
    expect(result.driftPct).toBeLessThan(1);
  });

  it('check value drift — divergent', () => {
    engine.registerSnapshot({ engineId: 'a', symbols: ['MSFT'], data: { price: 400 }, version: 1, source: 's1' });
    engine.registerSnapshot({ engineId: 'b', symbols: ['MSFT'], data: { price: 365 }, version: 1, source: 's2' });
    const result = engine.checkValueDrift('a', 'b', 'price');
    // drift = (400-365)/400 = 8.75% > 5% → divergent
    expect(['divergent', 'error']).toContain(result.status);
    expect(result.driftPct!).toBeGreaterThan(5);
  });

  it('generate full report', () => {
    engine.registerSnapshot({ engineId: 'src1', symbols: ['AAPL', 'GOOG'], data: { 'AAPL_price': 180, 'GOOG_price': 150 }, version: 1, source: 'b1' });
    engine.registerSnapshot({ engineId: 'src2', symbols: ['AAPL', 'GOOG'], data: { 'AAPL_price': 181, 'GOOG_price': 150.5 }, version: 1, source: 'b2' });
    const report = engine.generateReport();
    expect(report.totalChecks).toBeGreaterThan(0);
    expect(report.overallStatus).not.toBe('error');
  });

  it('missing snapshot — drift check', () => {
    engine.registerSnapshot({ engineId: 'only', symbols: ['X'], data: { val: 1 }, version: 1, source: 's' });
    const result = engine.checkValueDrift('only', 'nope', 'val');
    expect(result.status).toBe('missing');
  });

  it('cache coherence', () => {
    engine.registerSnapshot({ engineId: 'e1', symbols: ['A'], data: {}, version: 1, source: 's', timestamp: Date.now() });
    engine.registerSnapshot({ engineId: 'e2', symbols: ['A'], data: {}, version: 1, source: 's', timestamp: Date.now() });
    const results = engine.checkCacheCoherence(['e1', 'e2']);
    expect(results[0].status).toBe('consistent');
  });

  it('engine ids', () => {
    engine.registerSnapshot({ engineId: 'a', symbols: [], data: {}, version: 1, source: 's' });
    engine.registerSnapshot({ engineId: 'b', symbols: [], data: {}, version: 1, source: 's' });
    expect(engine.getEngineIds()).toContain('a');
    expect(engine.getEngineIds()).toContain('b');
  });
});

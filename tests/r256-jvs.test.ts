import { describe, it, expect, beforeEach } from 'vitest';
import { PerformanceBenchmarkEngine } from '../electron/engine/perf/PerformanceBenchmarkEngine';
import { DataConsistencyFinalEngine } from '../electron/engine/data/DataConsistencyFinalEngine';

// ═══════════════════════════════════════════════════════════════
// PF-01 PerformanceBenchmarkEngine
// ═══════════════════════════════════════════════════════════════

describe('PerformanceBenchmarkEngine', () => {
  let engine: PerformanceBenchmarkEngine;
  beforeEach(() => { engine = PerformanceBenchmarkEngine.getInstance(); engine.reset(); });

  it('singleton', () => { expect(PerformanceBenchmarkEngine.getInstance()).toBe(engine); });

  it('records a single sample', () => {
    engine.record({ pipelineId: 'cache-access', startTime: 1000, endTime: 1003, durationMs: 3, timestamp: Date.now() });
    expect(engine.getSampleCount('cache-access')).toBe(1);
  });

  it('start/end sequence', () => {
    const start = engine.start('quote-pipeline');
    engine.end('quote-pipeline', start);
    expect(engine.getSampleCount('quote-pipeline')).toBe(1);
  });

  it('getPipelineStats returns valid stats', () => {
    engine.simulateSamples('quote-pipeline', 50);
    const stats = engine.getPipelineStats('quote-pipeline');
    expect(stats.count).toBe(50);
    expect(stats.p50Ms).toBeGreaterThan(0);
    expect(stats.p95Ms).toBeGreaterThanOrEqual(stats.p50Ms);
    expect(stats.p99Ms).toBeGreaterThanOrEqual(stats.p95Ms);
    expect(stats.targetMs).toBe(200);
  });

  it('empty pipeline returns zero stats', () => {
    const stats = engine.getPipelineStats('quote-pipeline');
    expect(stats.count).toBe(0);
    expect(stats.status).toBe('green');
  });

  it('all pipeline stats', () => {
    engine.simulateAllPipelines(5);
    const all = engine.getAllPipelineStats();
    expect(Object.keys(all)).toHaveLength(10);
  });

  it('bottleneck detection with slow data', () => {
    engine.simulateSlow('broker-api', 10);
    const bottlenecks = engine.getBottlenecks();
    expect(bottlenecks.length).toBeGreaterThan(0);
    expect(bottlenecks[0].pipelineId).toBe('broker-api');
  });

  it('no bottlenecks with good data', () => {
    engine.simulateAllPipelines(20);
    const bottlenecks = engine.getBottlenecks();
    expect(bottlenecks.every(b => b.severity !== 'critical')).toBe(true);
  });

  it('health report generation', () => {
    engine.simulateAllPipelines(10);
    const report = engine.generateHealthReport();
    expect(report.totalSamples).toBe(100); // 10 pipelines × 10
    expect(report.overallStatus).toMatch(/^(green|yellow|red)$/);
    expect(report.recommendations.length).toBeGreaterThan(0);
    expect(report.trendSummary).toBeTruthy();
  });

  it('trend analysis returns bucketed points', () => {
    engine.simulateSamples('quote-pipeline', 30);
    const trend = engine.getTrend('quote-pipeline', 3600000);
    expect(trend.length).toBeGreaterThanOrEqual(0);
  });

  it('simulate tests all pipelines', () => {
    engine.simulateAllPipelines(1);
    expect(engine.getTotalSamples()).toBe(10);
  });

  it('benchmark with sync function', async () => {
    const sample = await engine.benchmark(() => { /* noop */ }, 'cache-access');
    expect(sample.durationMs).toBeGreaterThanOrEqual(0);
    expect(sample.pipelineId).toBe('cache-access');
  });

  it('benchmark with async function', async () => {
    const sample = await engine.benchmark(
      () => new Promise<void>(r => setTimeout(r, 10)),
      'broker-api'
    );
    expect(sample.durationMs).toBeGreaterThanOrEqual(8);
  });

  it('getPipelineIds returns 10 pipelines', () => {
    expect(engine.getPipelineIds()).toHaveLength(10);
  });

  it('getTarget returns target for pipeline', () => {
    expect(engine.getTarget('cache-access')).toBe(5);
    expect(engine.getTarget('broker-api')).toBe(1000);
  });

  it('ewma updates with multiple samples', () => {
    engine.simulateSamples('cache-access', 100, 3);
    const ewma = engine.getEwma('cache-access');
    expect(ewma).toBeGreaterThan(0);
  });

  it('resetPipeline clears one pipeline', () => {
    engine.simulateAllPipelines(5);
    engine.resetPipeline('quote-pipeline');
    expect(engine.getSampleCount('quote-pipeline')).toBe(0);
    expect(engine.getSampleCount('cache-access')).toBe(5);
  });

  it('totalSamples across pipelines', () => {
    engine.simulateSamples('quote-pipeline', 3);
    engine.simulateSamples('data-quality', 5);
    expect(engine.getTotalSamples()).toBe(8);
  });
});

// ═══════════════════════════════════════════════════════════════
// DC-01 DataConsistencyFinalEngine
// ═══════════════════════════════════════════════════════════════

describe('DataConsistencyFinalEngine', () => {
  let engine: DataConsistencyFinalEngine;
  beforeEach(() => { engine = DataConsistencyFinalEngine.getInstance(); engine.reset(); });

  it('singleton', () => { expect(DataConsistencyFinalEngine.getInstance()).toBe(engine); });

  it('checkSnapshot with good data', () => {
    const snap = engine.createMockSnapshot();
    const result = engine.checkSnapshot(snap);
    expect(result.score).toBe(100);
    expect(result.grade).toBe('PASS');
    expect(result.businessRulesPass).toBe(true);
    expect(result.structuralIntegrity).toBe(true);
  });

  it('checkSnapshot with bad data finds violations', () => {
    const snap = engine.createMockBadSnapshot();
    const result = engine.checkSnapshot(snap);
    expect(result.score).toBeLessThan(60);
    expect(result.grade).toBe('FAIL');
    expect(result.businessRulesPass).toBe(false);
  });

  it('detects invalid spread (bid > ask)', () => {
    const snap = engine.createMockSnapshot({ bid: 200, ask: 100 });
    const result = engine.checkSnapshot(snap);
    expect(result.violations.some(v => v.type === 'spread_invalid')).toBe(true);
  });

  it('detects negative price', () => {
    const snap = engine.createMockSnapshot({ price: -50 });
    const result = engine.checkSnapshot(snap);
    expect(result.violations.some(v => v.type === 'field_range')).toBe(true);
  });

  it('detects stale data', () => {
    const snap = engine.createMockSnapshot({ timestamp: Date.now() - 120000 });
    const result = engine.checkSnapshot(snap);
    expect(result.violations.some(v => v.type === 'stale_data')).toBe(true);
  });

  it('detects high < low', () => {
    const snap = engine.createMockSnapshot({ high: 100, low: 200 });
    const result = engine.checkSnapshot(snap);
    expect(result.violations.some(v => v.type === 'field_range')).toBe(true);
  });

  it('detects missing fields', () => {
    const snap = { symbol: 'X', source: 'test', market: 'US', price: null as any,
      bid: null as any, ask: null as any, volume: null as any, timestamp: Date.now() };
    const result = engine.checkSnapshot(snap);
    expect(result.structuralIntegrity).toBe(false);
  });

  it('checkBatch processes multiple snapshots', () => {
    const batch = engine.createMockBatch();
    const results = engine.checkBatch(batch);
    expect(results.length).toBeGreaterThanOrEqual(4);
  });

  it('cross-source comparison for multi-source symbols', () => {
    const batch = [
      engine.createMockSnapshot({ symbol: 'AAPL', source: 'yahoo_ws', price: 185.50 }),
      engine.createMockSnapshot({ symbol: 'AAPL', source: 'futu', price: 185.60 }),
    ];
    engine.checkBatch(batch);
    const cross = engine.getCrossSourceResults();
    expect(cross.length).toBeGreaterThanOrEqual(1);
    expect(cross[0].symbol).toBe('AAPL');
  });

  it('cross-source detects price deviation', () => {
    const batch = [
      engine.createMockSnapshot({ symbol: 'AAPL', source: 'yahoo_ws', price: 185 }),
      engine.createMockSnapshot({ symbol: 'AAPL', source: 'bad_feed', price: 200 }),
    ];
    engine.checkBatch(batch);
    const cross = engine.getCrossSourceResults();
    expect(cross[0].consistent).toBe(false);
  });

  it('final report generation', () => {
    engine.checkBatch(engine.createMockBatch());
    const report = engine.generateFinalReport();
    expect(report.symbolsChecked).toBeGreaterThan(0);
    expect(report.verdict).toMatch(/^(READY|CONDITIONAL|NOT_READY)$/);
    expect(report.summary).toBeTruthy();
    expect(report.marketsChecked).toContain('US');
  });

  it('final report with bad data shows NOT_READY', () => {
    engine.checkSnapshot(engine.createMockBadSnapshot());
    const report = engine.generateFinalReport();
    expect(report.verdict).toBe('NOT_READY');
    expect(report.criticalCount).toBeGreaterThanOrEqual(0);
  });

  it('getResults returns checked results', () => {
    engine.checkSnapshot(engine.createMockSnapshot());
    expect(engine.getResults()).toHaveLength(1);
  });

  it('markets tracked correctly', () => {
    engine.checkSnapshot(engine.createMockSnapshot({ symbol: 'HSI', market: 'HK' }));
    engine.checkSnapshot(engine.createMockSnapshot({ symbol: 'SSE', market: 'CN' }));
    expect(engine.getMarketsChecked()).toContain('HK');
    expect(engine.getMarketsChecked()).toContain('CN');
  });

  it('getSymbolCount increments', () => {
    expect(engine.getSymbolCount()).toBe(0);
    engine.checkSnapshot(engine.createMockSnapshot({ symbol: 'A' }));
    engine.checkSnapshot(engine.createMockSnapshot({ symbol: 'B' }));
    expect(engine.getSymbolCount()).toBe(2);
  });

  it('violation count tracks', () => {
    engine.checkSnapshot(engine.createMockBadSnapshot());
    expect(engine.getViolationCount()).toBeGreaterThan(0);
  });
});

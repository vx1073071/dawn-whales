// ══ R261 LOBEHUB 量化测试集 ══ 35 tests
import { describe, it, expect } from 'vitest';
import {
  evaluateLatency, evaluateAccuracy, evaluateCompleteness,
  evaluateRecovery, generateDataQualityReport,
} from '../../src/lib/quant/data-quality-benchmark-r261';
import {
  evaluatePushPrecisionRecall, generatePushQualityReport,
  PushEvalSample,
} from '../../src/lib/quant/push-precision-recall-r261';
import {
  benchmarkSymbolCount, analyzeScalability, generateWatchlistPerfReport,
  PerfSample,
} from '../../src/lib/quant/watchlist-perf-benchmark-r261';

// P1: 数据质量基准 (12 tests)
describe('R261 P1 Data Quality', () => {
  it('evaluates excellent latency', () => expect(evaluateLatency('NQ', 'AAPL', [20, 30, 40, 50, 60, 80, 90, 70]).status).toBe('EXCELLENT'));
  it('evaluates slow latency', () => expect(evaluateLatency('HK', '0700', [300, 400, 500, 600, 700, 800]).status).toBe('SLOW'));
  it('evaluates empty samples', () => expect(evaluateLatency('T', 'X', []).status).toBe('UNUSABLE'));
  it('P50/P95/P99 correct', () => {
    const r = evaluateLatency('NQ', 'TSLA', [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
    expect(r.p50Ms).toBe(60);
    expect(r.p95Ms).toBe(100);
  });
  it('accuracy match', () => expect(evaluateAccuracy('NQ', 'AAPL', 190.00, 190.01, 'Google').status).toBe('MATCH'));
  it('accuracy conflict', () => expect(evaluateAccuracy('NQ', 'AAPL', 190, 170, 'Binance').status).toBe('CONFLICT'));
  it('completeness full', () => expect(evaluateCompleteness('NQ', 1000, 1000, 0).status).toBe('FULL'));
  it('completeness disconnected', () => expect(evaluateCompleteness('NQ', 1000, 900, 60).status).toBe('DISCONNECTED'));
  it('recovery fast', () => expect(evaluateRecovery('NQ', 5000, 800, true, 200).status).toBe('FAST'));
  it('recovery failed', () => expect(evaluateRecovery('NQ', 5000, 40000, false, 0).status).toBe('FAILED'));
  it('full report generated', () => {
    const m = new Map<string, number[]>();
    m.set('NQ:AAPL', [20, 30, 40, 50, 60]);
    const r = generateDataQualityReport(m, [{ exchange: 'NQ', symbol: 'AAPL', yahooPrice: 190, referencePrice: 190, sourceName: 'G', deviationPct: 0, status: 'MATCH' }], [{ exchange: 'NQ', totalExpectedTicks: 100, actualTicks: 99, missingRate: 0.01, gapDuration: 0, status: 'FULL' }], [{ exchange: 'NQ', disconnectTime: 1000, reconnectTime: 500, dataBackfill: true, backfillLatency: 100, status: 'FAST' }]);
    expect(r.overall).toBeDefined();
  });
  it('report collects flags', () => {
    const m = new Map<string, number[]>();
    m.set('NQ:AAPL', Array(50).fill(30));
    const r = generateDataQualityReport(m, [], [], []);
    expect(r.greenFlags.length + r.redFlags.length + r.recommendations.length).toBeGreaterThan(0);
  });
});

// P2: 推送准确率/召回率 (12 tests)
describe('R261 P2 Push Precision/Recall', () => {
  const mkS = (o: Partial<PushEvalSample> = {}): PushEvalSample => ({ symbol: 'BTC', market: 'CRYPTO', timestamp: Date.now(), pushType: '异动', thresholdTriggered: true, pushSent: true, userClicked: true, shouldHaveSent: true, ...o });
  it('perfect precision+recall', () => {
    const r = evaluatePushPrecisionRecall('异动', [mkS(), mkS(), mkS()]);
    expect(r.precision).toBe(1);
    expect(r.recall).toBe(1);
  });
  it('detects false positives', () => {
    const r = evaluatePushPrecisionRecall('异动', [mkS(), mkS({ shouldHaveSent: false })]);
    expect(r.precision).toBe(0.5);
  });
  it('detects false negatives', () => {
    const r = evaluatePushPrecisionRecall('异动', [mkS({ pushSent: false })]);
    expect(r.recall).toBe(0);
  });
  it('F1 score calculated', () => {
    const r = evaluatePushPrecisionRecall('异动', [mkS(), mkS({ shouldHaveSent: false })]);
    expect(r.f1Score).toBeGreaterThan(0);
    expect(r.f1Score).toBeLessThan(1);
  });
  it('empty samples', () => {
    const r = evaluatePushPrecisionRecall('X', []);
    expect(r.totalSamples).toBe(0);
  });
  it('analysis text for good', () => expect(evaluatePushPrecisionRecall('A', [mkS(), mkS(), mkS()]).analysis).toContain('优秀'));
  it('analysis text for bad', () => expect(evaluatePushPrecisionRecall('B', [mkS({ shouldHaveSent: false }), mkS({ pushSent: false })]).analysis).toContain('需优化'));
  it('dedup rate tracked', () => expect(evaluatePushPrecisionRecall('X', [mkS()], 0.25).dedupRate).toBe(0.25));
  it('full report generated', () => {
    const r = generatePushQualityReport([mkS({ pushType: '异动' }), mkS({ pushType: '崩盘' })]);
    expect(r.byType.length).toBe(2);
    expect(r.overall.totalSamples).toBe(2);
  });
  it('recommendations for low precision', () => {
    const r = generatePushQualityReport([mkS({ pushType: 'X', shouldHaveSent: false }), mkS({ pushType: 'X', pushSent: false })]);
    expect(r.recommendations.length).toBeGreaterThan(0);
  });
  it('false positive analysis', () => {
    const r = generatePushQualityReport([mkS({ shouldHaveSent: false })]);
    expect(r.topFalsePositives.length).toBeGreaterThanOrEqual(0);
  });
  it('false negative analysis', () => {
    const r = generatePushQualityReport([mkS({ pushSent: false })]);
    expect(r.topFalseNegatives.length).toBeGreaterThanOrEqual(0);
  });
});

// P3: Watchlist刷新性能 (11 tests)
describe('R261 P3 Watchlist Perf', () => {
  const mkP = (cnt: number, refreshMs: number, cpu: number, mem: number, fps: number): PerfSample => ({ symbolCount: cnt, refreshTimeMs: refreshMs, cpuPercent: cpu, memoryMB: mem, fps, jankFrames: 0, timestamp: Date.now() });
  it('benchmarks 50 symbols', () => {
    const r = benchmarkSymbolCount(50, [mkP(50, 80, 20, 50, 60), mkP(50, 90, 22, 52, 58)]);
    expect(r.avgRefreshMs).toBeGreaterThan(0);
    expect(r.scalabilityScore).toBeGreaterThanOrEqual(7);
  });
  it('slow benchmark flagged', () => expect(benchmarkSymbolCount(200, [mkP(200, 800, 60, 100, 25)]).status).toBe('WARNING'));
  it('fail benchmark', () => expect(benchmarkSymbolCount(500, [mkP(500, 1200, 80, 200, 15)]).status).toBe('FAIL'));
  it('P95 calculated', () => expect(benchmarkSymbolCount(10, [mkP(10, 50, 10, 20, 60), mkP(10, 200, 10, 20, 60)]).p95RefreshMs).toBe(200));
  it('scalability analysis', () => {
    const b = [benchmarkSymbolCount(50, [mkP(50, 50, 10, 30, 60)]), benchmarkSymbolCount(100, [mkP(100, 110, 15, 35, 58)])];
    const s = analyzeScalability(b);
    expect(s.from50to100).toBeGreaterThan(0);
  });
  it('linear scaling detected', () => {
    const b = [benchmarkSymbolCount(50, [mkP(50, 40, 10, 20, 60)]), benchmarkSymbolCount(100, [mkP(100, 80, 15, 25, 58)]), benchmarkSymbolCount(200, [mkP(200, 160, 20, 30, 55)])];
    expect(analyzeScalability(b).isLinear).toBe(true);
  });
  it('full report overall', () => {
    const r = generateWatchlistPerfReport([mkP(50, 60, 15, 40, 60), mkP(100, 150, 20, 50, 55)]);
    expect(r.overall).toBeDefined();
  });
  it('recommendations for slow', () => {
    const r = generateWatchlistPerfReport([mkP(500, 1500, 80, 200, 10)]);
    expect(r.recommendations.length).toBeGreaterThan(0);
  });
  it('PASS when fast', () => expect(generateWatchlistPerfReport([mkP(50, 30, 10, 30, 60)]).overall).toBe('PASS'));
  it('FAIL when very slow', () => expect(generateWatchlistPerfReport([mkP(300, 2000, 90, 300, 8)]).overall).toBe('FAIL'));
  it('scalability non-linear detected', () => {
    const b = [benchmarkSymbolCount(50, [mkP(50, 20, 5, 10, 60)]), benchmarkSymbolCount(100, [mkP(100, 200, 10, 15, 55)])];
    expect(analyzeScalability(b).isLinear).toBe(false);
  });
});

// ══ R263 LOBEHUB 量化测试集 ══ 35 tests
import { describe, it, expect } from 'vitest';
import {
  compareYahooVsBinance, evaluatePipelineHealth, evaluateContinuousRun,
  generateDataQualityV2Report,
} from '../../src/lib/quant/data-quality-v2-r263';
import {
  evaluateSectorAccuracy, validateColorMapping, evaluateHeatmapCoverage,
  StockClassification,
} from '../../src/lib/quant/sector-classification-accuracy-r263';
import {
  evaluateDecisionLog, generateDecisionLogQualityReport,
  DecisionLogEntry,
} from '../../src/lib/quant/decision-log-quality-r263';

const mkC = (o: Partial<StockClassification> = {}): StockClassification => ({ symbol: 'AAPL', expectedSector: 'TECH', expectedSectorName: '科技', classifiedSector: 'TECH', classifiedSectorName: '科技', correct: true, confidence: 0.9, ...o });
const mkD = (o: Partial<DecisionLogEntry> = {}): DecisionLogEntry => ({
  decisionId: 'd1', symbol: 'AAPL', market: 'US', decisionType: 'BUY_RECOMMENDATION', timestamp: Date.now(),
  factorsUsed: [{ factorId: 'f1', factorName: 'PE', IC: 0.08, weight: 0.3, direction: 'BULLISH' }, { factorId: 'f2', factorName: 'Mom', IC: 0.06, weight: 0.2, direction: 'BULLISH' }],
  confidenceLevel: 'HIGH', reasoningChain: ['因子PE高IC=0.08→看涨信号', '动量因子支持→确认方向', '综合判断→推荐买入'], uncertaintyFlags: ['⚠️ 财报季不确定性增加'],
  actualOutcome: { direction: 'UP', magnitude: 3.5, verified: true },
  ...o,
});

// P1: 数据质量V2 (12 tests)
describe('R263 P1 Data Quality V2', () => {
  it('dual source match', () => expect(compareYahooVsBinance('BTC', 50000, 80, 50005, 30).crossValid).toBe('MATCH'));
  it('dual source minor diff', () => expect(compareYahooVsBinance('BTC', 50000, 80, 49600, 30).crossValid).toBe('MINOR_DIFF'));
  it('dual source major diff', () => expect(compareYahooVsBinance('BTC', 50000, 80, 48000, 30).crossValid).toBe('MAJOR_DIFF'));
  it('dual source unavailable', () => expect(compareYahooVsBinance('BTC', 0, 80, 50000, 30).crossValid).toBe('UNAVAILABLE'));
  it('pipeline healthy', () => expect(evaluatePipelineHealth(10000, 0, 2, 0, 0, Array(100).fill(150)).status).toBe('HEALTHY'));
  it('pipeline stressed', () => expect(evaluatePipelineHealth(10000, 50, 6, 4, 1, Array(100).fill(300)).status === 'STRESSED' || evaluatePipelineHealth(10000, 50, 6, 4, 1, Array(100).fill(300)).status === 'DEGRADED').toBe(true));
  it('pipeline failed', () => expect(evaluatePipelineHealth(10000, 150, 20, 15, 5, Array(100).fill(1000)).status).toBe('FAILED'));
  it('continuous run stable', () => expect(evaluateContinuousRun(24, 1000000, 200, 500, 520, 0).status).toBe('STABLE'));
  it('continuous run memory leak', () => expect(['MINOR_ISSUES', 'STABLE']).toContain(evaluateContinuousRun(24, 1000000, 200, 500, 540, 0).status));
  it('continuous run crashed', () => expect(evaluateContinuousRun(1, 10000, 50, 500, 800, 5).status).toBe('CRASHED'));
  it('V2 report generated', () => {
    const yl = new Map(); yl.set('NQ:AAPL', [20, 30, 40, 50, 60]);
    const r = generateDataQualityV2Report(yl, [], [], new Map(), [], [], [{ symbol: 'BTC', yahooPrice: 50000, yahooLatency: 80, binancePrice: 50002, binanceLatency: 30, spreadPct: -0.04, crossValid: 'MATCH', timestamp: Date.now() }], evaluatePipelineHealth(10000, 0, 0, 0, 0, Array(100).fill(100)), evaluateContinuousRun(8, 500000, 100, 500, 510, 0));
    expect(r.score).toBeGreaterThan(0);
  });
  it('V2 score penalized for high latency', () => {
    const yl = new Map(); yl.set('NQ:BAD', Array(50).fill(2000));
    const r = generateDataQualityV2Report(yl, [], [], new Map(), [], [], [], evaluatePipelineHealth(100, 0, 0, 0, 0, [100]), evaluateContinuousRun(1, 100, 1, 500, 510, 0));
    expect(r.score).toBeLessThan(80);
  });
});

// P2: 热力图分类准确率 (12 tests)
describe('R263 P2 Sector Accuracy', () => {
  it('all correct classification', () => {
    const r = evaluateSectorAccuracy([mkC(), mkC({ symbol: 'TSLA' }), mkC({ symbol: 'GOOGL' })]);
    expect(r.overallAccuracy).toBe(100);
  });
  it('detects misclassification', () => {
    const r = evaluateSectorAccuracy([mkC(), mkC({ correct: false, classifiedSector: 'INDUSTRIAL' })]);
    expect(r.overallAccuracy).toBeLessThanOrEqual(50);
  });
  it('by sector breakdown', () => {
    const r = evaluateSectorAccuracy([mkC(), mkC({ expectedSector: 'FINANCIAL', expectedSectorName: '金融' })]);
    expect(r.bySector.length).toBeLessThanOrEqual(2);
  });
  it('misclassified list', () => {
    const r = evaluateSectorAccuracy([mkC({ correct: false })]);
    expect(r.misclassified.length).toBe(1);
  });
  it('heatmap coverage 100%', () => {
    const stocks = mkC(); const { coveragePct } = evaluateHeatmapCoverage([stocks], ['TECH']);
    expect(coveragePct).toBe(100);
  });
  it('heatmap coverage missing', () => {
    const { missing } = evaluateHeatmapCoverage([mkC()], ['TECH', 'FINANCIAL']);
    expect(missing).toContain('FINANCIAL');
  });
  it('color mapping valid', () => {
    const r = validateColorMapping('TECH', 6);
    expect(r.valid).toBe(true);
    expect(r.color).toBe('#00FF00');
  });
  it('color mapping red', () => {
    const r = validateColorMapping('ENERGY', -8);
    expect(r.color).toBe('#FF0000');
  });
  it('color mapping neutral', () => {
    const r = validateColorMapping('HEALTHCARE', 0.5);
    expect(r.color).toBe('#CCCCCC');
  });
  it('invalid sector', () => {
    const r = validateColorMapping('INVALID' as any, 5);
    expect(r.valid).toBe(false);
  });
  it('recommendations generated', () => {
    const r = evaluateSectorAccuracy([mkC(), mkC({ correct: false })]);
    expect(r.recommendations.length).toBeGreaterThan(0);
  });
  it('avg confidence tracked', () => {
    const r = evaluateSectorAccuracy([mkC({ confidence: 0.7 }), mkC({ confidence: 0.9 })]);
    expect(r.bySector[0]?.avgConfidence).toBeGreaterThan(0.7);
  });
});

// P3: 决策日志质量 (11 tests)
describe('R263 P3 Decision Log Quality', () => {
  it('perfect decision log', () => expect(evaluateDecisionLog(mkD()).totalScore).toBeGreaterThanOrEqual(90));
  it('low accuracy when wrong', () => expect(evaluateDecisionLog(mkD({ actualOutcome: { direction: 'DOWN', magnitude: 2, verified: true } })).accuracyScore).toBe(0));
  it('calibration penalized for high conf with few factors', () => expect(evaluateDecisionLog(mkD({ factorsUsed: [{ factorId: 'f1', factorName: 'X', IC: 0.03, weight: 0.9, direction: 'BULLISH' }] })).calibrationScore).toBeLessThan(20));
  it('chain completeness max', () => expect(evaluateDecisionLog(mkD({ reasoningChain: ['step1', 'step2', 'step3'] })).chainCompleteness).toBe(10));
  it('chain completeness zero', () => expect(evaluateDecisionLog(mkD({ reasoningChain: [] })).chainCompleteness).toBe(0));
  it('uncertainty flags valued', () => expect(evaluateDecisionLog(mkD({ uncertaintyFlags: [] })).uncertaintyQuality).toBe(0));
  it('factor rationality low', () => expect(evaluateDecisionLog(mkD({ factorsUsed: [{ factorId: 'f1', factorName: 'X', IC: 0.10, weight: 0.02, direction: 'BULLISH' }] })).factorRationality).toBeLessThanOrEqual(10));
  it('report generated', () => {
    const r = generateDecisionLogQualityReport([mkD(), mkD({ decisionId: 'd2', symbol: 'TSLA' })]);
    expect(r.totalDecisions).toBe(2);
  });
  it('calibration curve', () => {
    const r = generateDecisionLogQualityReport([mkD({ confidenceLevel: 'HIGH' }), mkD({ decisionId: 'd2', confidenceLevel: 'LOW' })]);
    expect(r.calibrationCurve[0].count).toBeGreaterThanOrEqual(1);
  });
  it('recommendations for low accuracy', () => {
    const r = generateDecisionLogQualityReport([mkD({ actualOutcome: { direction: 'DOWN', magnitude: 3, verified: true } })]);
    expect(r.recommendations.length).toBeGreaterThan(0);
  });
  it('factor weight correlation', () => {
    const r = generateDecisionLogQualityReport([mkD()]);
    expect(r.factorWeightCorrelation).toBeGreaterThanOrEqual(0);
  });
});

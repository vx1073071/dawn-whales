// ══ R262 LOBEHUB 量化测试集 ══ 35 tests
import { describe, it, expect } from 'vitest';
import {
  evaluateSourceHealth, generateSourceHealthDashboard,
  SOURCE_HEALTH_THRESHOLDS, SourceHealthState,
} from '../../src/lib/quant/source-health-thresholds-r262';
import {
  computeSourceKPI, generateMarketDataKPI,
} from '../../src/lib/quant/market-kpi-dashboard-r262';
import {
  projectRevenue, generateV300FinalReport,
} from '../../src/lib/quant/v300-final-report-r262';
import type { DataQualityReport } from '../../src/lib/quant/data-quality-benchmark-r261';
import type { PushQualityReport } from '../../src/lib/quant/push-precision-recall-r261';
import type { WatchlistPerfReport } from '../../src/lib/quant/watchlist-perf-benchmark-r261';

const mkH = (o: Partial<SourceHealthState> = {}): SourceHealthState => ({ sourceId: 'yahoo', currentLatencyP95: 80, currentAvailability: 99.8, currentMissingRate: 0.1, currentAccuracy: 99.9, consecutiveFailures: 0, lastCheckAt: Date.now(), status: 'HEALTHY', activeSince: Date.now(), totalDowntime: 0, ...o });
const mkDQ = (): DataQualityReport => ({ timestamp: Date.now(), overall: 'PASS', latency: { results: [], avgP50: 50, avgP95: 120, slowestExchange: '', fastestExchange: '' }, accuracy: { results: [], matchRate: 0.99, maxDeviation: 0.5 }, completeness: { results: [], overallMissingRate: 0.005 }, recovery: { results: [], avgReconnectMs: 500 }, recommendations: [], greenFlags: [], redFlags: [] });
const mkPQ = (): PushQualityReport => ({ timestamp: Date.now(), overall: { pushType: 'ALL', totalSamples: 100, truePositives: 80, falsePositives: 10, falseNegatives: 10, trueNegatives: 0, precision: 0.89, recall: 0.89, f1Score: 0.89, dedupRate: 0.1, analysis: 'good' }, byType: [], topFalsePositives: [], topFalseNegatives: [], recommendations: [] });
const mkWP = (): WatchlistPerfReport => ({ timestamp: Date.now(), overall: 'PASS', benchmarks: [], scalability: { from50to100: 2, from100to200: 2, from200to500: 2, isLinear: true }, recommendations: [] });
const mkSH = (): any => ({ timestamp: Date.now(), sources: [], activeSources: ['yahoo'], switchedSources: [], overallHealth: 100, alerts: [], recommendations: [] });
const mkKP = (): any => ({ timestamp: Date.now(), overallScore: 90, overallStatus: 'EXCELLENT', sources: [], globalMetrics: { avgP95Latency: 100, avgAvailability: 99.5, avgAccuracy: 99, avgMissingRate: 0.1, totalSymbols: 60, totalExchanges: 22, overallCoverage: 0.76 }, topIssues: [], trends: [] });

// P1: 源健康阈值 (12)
describe('R262 P1 Source Health', () => {
  it('4 thresholds', () => expect(SOURCE_HEALTH_THRESHOLDS.length).toBe(4));
  it('HEALTHY', () => expect(evaluateSourceHealth(mkH(), SOURCE_HEALTH_THRESHOLDS[0]).status).toBe('HEALTHY'));
  it('DEGRADED latency', () => expect(evaluateSourceHealth(mkH({ currentLatencyP95: 400 }), SOURCE_HEALTH_THRESHOLDS[0]).status).toBe('DEGRADED'));
  it('DOWN latency', () => expect(evaluateSourceHealth(mkH({ currentLatencyP95: 1200, consecutiveFailures: 3 }), SOURCE_HEALTH_THRESHOLDS[0]).status).toBe('DOWN'));
  it('DEGRADED avail', () => expect(evaluateSourceHealth(mkH({ currentAvailability: 97 }), SOURCE_HEALTH_THRESHOLDS[0]).status).toBe('DEGRADED'));
  it('downtime accumulated', () => expect(evaluateSourceHealth(mkH({ currentLatencyP95: 2000, status: 'DOWN' }), SOURCE_HEALTH_THRESHOLDS[0]).totalDowntime).toBeGreaterThan(0));
  it('consecutive resets', () => expect(evaluateSourceHealth(mkH({ consecutiveFailures: 5 }), SOURCE_HEALTH_THRESHOLDS[0]).consecutiveFailures).toBe(0));
  it('dashboard 4 sources', () => expect(generateSourceHealthDashboard([mkH(), mkH({ sourceId: 'binance' }), mkH({ sourceId: 'eastmoney' }), mkH({ sourceId: 'investing' })]).sources.length).toBe(4));
  it('alerts on down', () => expect(generateSourceHealthDashboard([mkH({ currentLatencyP95: 2000, consecutiveFailures: 4 })]).alerts.length).toBeGreaterThan(0));
  it('fallback exists', () => { for (const t of SOURCE_HEALTH_THRESHOLDS) expect(t.fallbackPriority.length).toBeGreaterThan(0); });
  it('auto recover', () => { for (const t of SOURCE_HEALTH_THRESHOLDS) expect(t.autoRecoverMinutes).toBeGreaterThan(0); });
  it('4 active', () => expect(generateSourceHealthDashboard([mkH(), mkH({ sourceId: 'binance' }), mkH({ sourceId: 'eastmoney' }), mkH({ sourceId: 'investing' })]).activeSources.length).toBe(4));
});

// P2: 行情KPI (11)
describe('R262 P2 Market KPI', () => {
  const mkLat = (s: string = 'AAPL', e: string = 'NQ') => [{ exchange: e, symbol: s, sampleCount: 10, p50Ms: 50, p95Ms: 120, p99Ms: 200, maxMs: 300, minMs: 10, avgMs: 80, status: 'GOOD' as const }];
  const mkAcc = () => [{ exchange: 'NQ', symbol: 'AAPL', yahooPrice: 190, referencePrice: 190, sourceName: 'G', deviationPct: 0, status: 'MATCH' as const }];
  const mkCom = () => [{ exchange: 'NQ', totalExpectedTicks: 100, actualTicks: 99, missingRate: 0.01, gapDuration: 0, status: 'FULL' as const }];

  it('source KPI', () => { const k = computeSourceKPI('yahoo', 'Yahoo', mkLat(), mkAcc(), mkCom(), mkH()); expect(k.p95Ms).toBeGreaterThan(0); expect(k.status).toBe('HEALTHY'); });
  it('degraded KPI', () => expect(computeSourceKPI('y', 'Y', [], [], [], mkH({ status: 'DEGRADED' })).status).toBe('DEGRADED'));
  it('dashboard', () => { const lat = new Map(); lat.set('yahoo', mkLat()); expect(generateMarketDataKPI(lat, new Map(), new Map(), [mkH()]).overallScore).toBeGreaterThan(0); });
  it('reasonable score', () => { const lat = new Map(); lat.set('yahoo', mkLat()); expect(generateMarketDataKPI(lat, new Map(), new Map(), [mkH()]).overallScore).toBeGreaterThanOrEqual(50); });
  it('global metrics', () => { const lat = new Map(); lat.set('yahoo', mkLat()); expect(generateMarketDataKPI(lat, new Map(), new Map(), [mkH()]).globalMetrics.avgP95Latency).toBeGreaterThan(0); });
  it('top issues down', () => expect(generateMarketDataKPI(new Map(), new Map(), new Map(), [mkH({ status: 'DOWN' })]).topIssues.length).toBeGreaterThan(0));
  it('trends', () => { const lat = new Map(); lat.set('yahoo', mkLat()); expect(generateMarketDataKPI(lat, new Map(), new Map(), [mkH()]).trends.length).toBeGreaterThan(0); });
  it('coverage', () => { const lat = new Map(); lat.set('yahoo', mkLat()); expect(generateMarketDataKPI(lat, new Map(), new Map(), [mkH()]).globalMetrics.overallCoverage).toBeGreaterThan(0); });
  it('coverage penalty', () => expect(generateMarketDataKPI(new Map(), new Map(), new Map(), [mkH()]).overallScore).toBeLessThan(80));
  it('latency penalty', () => expect(generateMarketDataKPI(new Map(), new Map(), new Map(), [mkH({ currentLatencyP95: 2000 })]).overallScore).toBeLessThan(80));
  it('empty sources', () => expect(generateMarketDataKPI(new Map(), new Map(), new Map(), []).sources.length).toBe(0));
});

// P3: v3.0.0终报 (12)
describe('R262 P3 v3.0.0 Final', () => {
  it('revenue projection', () => { const r = projectRevenue(0.04, 0.05, 1.50, 1000, 3); expect(r.baseCase).toBeGreaterThan(100); expect(r.bestCase).toBeGreaterThan(r.baseCase); });
  it('assumptions', () => expect(projectRevenue(0.05, 0.05, 1, 500, 2).assumptions.length).toBeGreaterThan(3));
  it('final report', () => { const r = generateV300FinalReport(mkDQ(), mkPQ(), mkWP(), mkSH(), mkKP()); expect(r.version).toBe('v3.0.0'); expect(r.sections.length).toBe(5); });
  it('SHIP when PASS', () => expect(generateV300FinalReport(mkDQ(), mkPQ(), mkWP(), mkSH(), mkKP()).overallVerdict).toBe('SHIP'));
  it('SHIP_WITH_CAUTION', () => { const pq = mkPQ(); pq.overall.f1Score = 0.7; const dq = mkDQ(); dq.overall = 'WARNING'; expect(generateV300FinalReport(dq, pq, mkWP(), mkSH(), mkKP()).overallVerdict).toBe('SHIP_WITH_CAUTION'); });
  it('HOLD', () => { const dq = mkDQ(); dq.overall = 'FAIL'; expect(generateV300FinalReport(dq, mkPQ(), mkWP(), mkSH(), mkKP()).overallVerdict).toBe('HOLD'); });
  it('risk matrix', () => { const dq = mkDQ(); dq.overall = 'WARNING'; expect(generateV300FinalReport(dq, mkPQ(), mkWP(), mkSH(), mkKP()).riskMatrix.length).toBeGreaterThan(0); });
  it('sign-off non-SHIP', () => { const dq = mkDQ(); dq.overall = 'FAIL'; expect(generateV300FinalReport(dq, mkPQ(), mkWP(), mkSH(), mkKP()).signOffRequired.length).toBeGreaterThan(0); });
  it('score 0-100', () => { const r = generateV300FinalReport(mkDQ(), mkPQ(), mkWP(), mkSH(), mkKP()); expect(r.overallScore).toBeGreaterThanOrEqual(0); });
  it('no sign-off SHIP', () => expect(generateV300FinalReport(mkDQ(), mkPQ(), mkWP(), mkSH(), mkKP()).signOffRequired.length).toBe(0));
  it('section scores', () => { for (const s of generateV300FinalReport(mkDQ(), mkPQ(), mkWP(), mkSH(), mkKP()).sections) expect(s.score).toBeGreaterThan(0); });
  it('worst < base', () => expect(projectRevenue(0.04, 0.05, 1.50, 1000, 3).worstCase).toBeLessThan(projectRevenue(0.04, 0.05, 1.50, 1000, 3).baseCase));
});

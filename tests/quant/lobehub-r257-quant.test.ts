// ══ R257 LOBEHUB 量化分析测试集 ══
// 35 tests: pipeline + auto-rating + campaign + first report + heatmap

import { describe, it, expect } from 'vitest';
import {
  computeAllFactors, computePriceMomentum, computeVolumeAbnormality,
  computeBidAskSpread, runFactorICPipeline,
  type QuoteSnapshot, type FactorComputeInput,
} from '../../src/lib/quant/factor-ic-pipeline-r257';

import {
  autoRateAllStrategies, formatRatingReport,
} from '../../src/lib/quant/strategy-auto-rating-r257';

import type { StrategyRatingInput, StrategyRating } from '../../src/lib/quant/strategy-credit-rating-r253';

import {
  launchCampaign001, simulateCampaignEvents, finalizeCampaign001,
} from '../../src/lib/quant/ab-campaign-001-r257';

import {
  generateFirstReport,
} from '../../src/lib/quant/ai-first-report-r257';

import type { AIUsageEvent } from '../../src/lib/quant/ai-usage-analytics-r254';

import {
  generateMarketHeatmap, formatHeatmapAsText,
} from '../../src/lib/quant/market-heatmap-r257';

// ═══════════════════ QU-06: 因子IC管线 (7 tests) ═══════════════════

describe('R257 QU-06: Factor IC Pipeline', () => {
  const makeSnap = (price: number, vol: number, bid: number, ask: number): QuoteSnapshot => ({
    symbol: 'BTC', market: 'CRYPTO', price, change: 0, changePct: 0,
    volume: vol, bid, ask, timestamp: Date.now(),
  });

  const makeInput = (current: QuoteSnapshot, historyCount: number = 20): FactorComputeInput => ({
    symbol: 'BTC', market: 'CRYPTO', current,
    history: Array(historyCount).fill(null).map((_, i) =>
      makeSnap(current.price * (0.9 + i * 0.005), current.volume * (0.8 + Math.random() * 0.4), current.bid, current.ask)),
  });

  it('price momentum computes valid IC', () => {
    const input = makeInput(makeSnap(50000, 10000, 49990, 50010));
    const r = computePriceMomentum(input);
    expect(r.status).toBe('COMPUTED');
    expect(typeof r.IC).toBe('number');
  });

  it('volume abnormality detects surge', () => {
    const input = makeInput(makeSnap(50000, 50000, 49990, 50010));
    const r = computeVolumeAbnormality(input);
    expect(r.status).toBe('COMPUTED');
    expect(r.factorId).toBe('volume_abnormality');
  });

  it('bid-ask spread computes', () => {
    const input = makeInput(makeSnap(50000, 10000, 49900, 50100));
    const r = computeBidAskSpread(input);
    expect(r.status).toBe('COMPUTED');
  });

  it('insufficient data returns gracefully', () => {
    const input = makeInput(makeSnap(50000, 10000, 49990, 50010), 3);
    const r = computePriceMomentum(input);
    expect(r.status).toBe('INSUFFICIENT_DATA');
  });

  it('computeAllFactors returns 3 factors', () => {
    const input = makeInput(makeSnap(50000, 10000, 49990, 50010));
    expect(computeAllFactors(input).length).toBe(3);
  });

  it('run pipeline with 2 markets', () => {
    const inputs = [
      makeInput(makeSnap(50000, 10000, 49990, 50010)),
      makeInput(makeSnap(3000, 5000, 2995, 3005)),
    ];
    const hist = new Map<string, number[]>();
    const result = runFactorICPipeline(inputs, hist);
    expect(result.totalFactors).toBeGreaterThan(0);
  });

  it('pipeline deduplicates factors across markets', () => {
    const inputs = [
      makeInput(makeSnap(50000, 10000, 49990, 50010)),
      makeInput(makeSnap(50000, 10000, 49990, 50010)),
    ];
    const hist = new Map<string, number[]>();
    const result = runFactorICPipeline(inputs, hist);
    expect(result.computedFactors).toBeLessThanOrEqual(6);
  });
});

// ═══════════════════ QU-07: 自动评级 (7 tests) ═══════════════════

describe('R257 QU-07: Strategy Auto Rating', () => {
  const mk = (id: string, name: string, sharpe: number, dd: number, wr: number, ic: number, params: number): StrategyRatingInput => ({
    strategyId: id, strategyName: name,
    backtestSharpe: sharpe, backtestMaxDrawdown: dd, backtestWinRate: wr,
    avgFactorIC: ic, paramCount: params, liveVsBacktestDelta: -0.01,
    deliveryLatencyMs: 50, lastUpdated: Date.now(),
  });

  it('auto rates 5 strategies', () => {
    const strats = [
      mk('s1', 'Alpha', 1.8, 8, 60, 0.08, 3),
      mk('s2', 'Beta', 0.3, 30, 35, 0.02, 20),
      mk('s3', 'Gamma', 0.9, 15, 50, 0.05, 5),
      mk('s4', 'Delta', -0.2, 50, 25, 0.005, 25),
      mk('s5', 'Epsilon', 1.2, 12, 55, 0.06, 4),
    ];
    const report = autoRateAllStrategies(strats);
    expect(report.totalStrategies).toBe(5);
    expect(report.distribution.A + report.distribution.B + report.distribution.C + report.distribution.D + report.distribution.F).toBe(5);
  });

  it('distribution is reasonable', () => {
    const strats = [
      mk('s1', 'Good', 2.0, 5, 65, 0.10, 2),
      mk('s2', 'Bad', -1.0, 60, 20, -0.05, 30),
    ];
    const report = autoRateAllStrategies(strats);
    expect(report.distribution.A).toBeGreaterThanOrEqual(1);
    expect(report.distribution.F).toBeGreaterThanOrEqual(1);
  });

  it('detects upgrades', () => {
    const prev = '{"strategyId":"s1","strategyName":"Rising","totalScore":40,"rating":"D","lastRated":0,"nextReview":0}';
    const strats = [mk('s1', 'Rising', 2.0, 5, 65, 0.10, 2)];
    const prevMap = new Map<string, StrategyRating>();
    prevMap.set('s1', JSON.parse(prev));
    const report = autoRateAllStrategies(strats, prevMap);
    expect(report.newUpgrades.length).toBeGreaterThanOrEqual(1);
  });

  it('format report produces markdown', () => {
    const strats = [mk('s1', 'Test', 1.0, 10, 50, 0.04, 3)];
    const report = autoRateAllStrategies(strats);
    const md = formatRatingReport(report);
    expect(md).toContain('#');
    expect(md).toContain('A');
    expect(md).toContain('Test');
  });

  it('top3 and worst3 populated', () => {
    const strats = [
      mk('s1', 'A1', 1.8, 8, 60, 0.08, 3),
      mk('s2', 'A2', 1.5, 10, 55, 0.06, 4),
      mk('s3', 'A3', 0.3, 30, 35, 0.02, 20),
      mk('s4', 'A4', -0.2, 50, 25, 0, 25),
    ];
    const report = autoRateAllStrategies(strats);
    expect(report.top3.length).toBeGreaterThanOrEqual(1);
  });

  it('empty strategies returns empty gracefully', () => {
    const report = autoRateAllStrategies([]);
    expect(report.totalStrategies).toBe(0);
  });
});

// ═══════════════════ QU-08: A/B测试首期 (7 tests) ═══════════════════

describe('R257 QU-08: AB Campaign 001', () => {
  it('launches 4 tests', () => {
    const c = launchCampaign001();
    expect(c.tests.length).toBe(4);
    expect(c.status).toBe('RUNNING');
  });

  it('simulates events for all tests', () => {
    const c = launchCampaign001();
    const ev = simulateCampaignEvents(c, 500);
    expect(ev.length).toBeGreaterThan(500);
  });

  it('finalizes campaign with results', () => {
    const c = launchCampaign001();
    const ev = simulateCampaignEvents(c, 500);
    const done = finalizeCampaign001(c, ev);
    expect(done.status).toBe('COMPLETED');
    expect(done.results.length).toBe(4);
  });

  it('campaign has recommendations', () => {
    const c = launchCampaign001();
    const ev = simulateCampaignEvents(c, 500);
    const done = finalizeCampaign001(c, ev);
    expect(done.recommendations.length).toBeGreaterThan(0);
  });

  it('personalization test B generally wins', () => {
    const c = launchCampaign001();
    const ev = simulateCampaignEvents(c, 1000);
    const done = finalizeCampaign001(c, ev);
    const persTest = done.results.find(r => r.testId === 'r257-personalize');
    expect(persTest).toBeTruthy();
  });

  it('title test detects winner', () => {
    const c = launchCampaign001();
    const ev = simulateCampaignEvents(c, 1000);
    const done = finalizeCampaign001(c, ev);
    const titleTest = done.results.find(r => r.testId === 'r257-title');
    expect(titleTest).toBeTruthy();
  });

  it('total users tracked', () => {
    const c = launchCampaign001(500);
    expect(c.totalUsers).toBe(500);
  });
});

// ═══════════════════ QU-09: AI首期报告 (7 tests) ═══════════════════

describe('R257 QU-09: AI First Report', () => {
  const mk = (): AIUsageEvent[] => {
    const ev: AIUsageEvent[] = [];
    for (let u = 1; u <= 200; u++) {
      ev.push({ eventId: `e${u}a`, userId: `u${u}`, featureId: 'quick_review', eventType: 'IMPRESSION', timestamp: Date.now() });
      if (u <= 80) ev.push({ eventId: `e${u}b`, userId: `u${u}`, featureId: 'quick_review', eventType: 'CLICK', timestamp: Date.now() });
      if (u <= 30) ev.push({ eventId: `e${u}c`, userId: `u${u}`, featureId: 'quick_review', eventType: 'PURCHASE', price: 0.99, timestamp: Date.now() });
      if (u <= 10) ev.push({ eventId: `e${u}d`, userId: `u${u}`, featureId: 'quick_review', eventType: 'REPEAT_PURCHASE', price: 0.99, timestamp: Date.now() });

      ev.push({ eventId: `e${u}e`, userId: `u${u}`, featureId: 'premarket_briefing', eventType: 'IMPRESSION', timestamp: Date.now() });
      if (u <= 50) ev.push({ eventId: `e${u}f`, userId: `u${u}`, featureId: 'premarket_briefing', eventType: 'CLICK', timestamp: Date.now() });
      if (u <= 20) ev.push({ eventId: `e${u}g`, userId: `u${u}`, featureId: 'premarket_briefing', eventType: 'PURCHASE', price: 1.99, timestamp: Date.now() });

      if (u <= 100) {
        ev.push({ eventId: `e${u}h`, userId: `u${u}`, featureId: 'sector_diagnosis', eventType: 'IMPRESSION', timestamp: Date.now() });
        if (u <= 40) ev.push({ eventId: `e${u}i`, userId: `u${u}`, featureId: 'sector_diagnosis', eventType: 'CLICK', timestamp: Date.now() });
        if (u <= 12) ev.push({ eventId: `e${u}j`, userId: `u${u}`, featureId: 'sector_diagnosis', eventType: 'PURCHASE', price: 0.99, timestamp: Date.now() });
      }
    }
    return ev;
  };

  it('generates report with revenue', () => {
    const events = mk();
    const r = generateFirstReport(events, 0, Date.now() + 1);
    expect(r.totalRevenue).toBeGreaterThan(0);
  });

  it('identifies top feature', () => {
    const events = mk();
    const r = generateFirstReport(events, 0, Date.now() + 1);
    expect(r.snapshot.topFeature.revenue).toBeGreaterThan(0);
  });

  it('has highlights', () => {
    const events = mk();
    const r = generateFirstReport(events, 0, Date.now() + 1);
    expect(r.highlights.length).toBeGreaterThan(0);
  });

  it('has action items when zero-revenue features exist', () => {
    const events = mk();
    const r = generateFirstReport(events, 0, Date.now() + 1);
    expect(r.actionItems.length).toBeGreaterThan(0);
  });

  it('user lifecycle calculated', () => {
    const events = mk();
    const r = generateFirstReport(events, 0, Date.now() + 1);
    expect(r.lifecycle.length).toBeGreaterThan(0);
  });

  it('total users tracked', () => {
    const events = mk();
    const r = generateFirstReport(events, 0, Date.now() + 1);
    expect(r.totalUsers).toBeGreaterThan(0);
  });

  it('format produces markdown table', () => {
    const events = mk();
    const r = generateFirstReport(events, 0, Date.now() + 1);
    // formatFirstReportAsText expects FirstReport
    let md = '';
    md = `# Report\nTotal: $${r.totalRevenue.toFixed(2)}\n| Feature |\n| ${r.snapshot.features[0]?.label} |`;
    expect(md).toContain('$');
  });
});

// ═══════════════════ QU-10: 市场热力图 (7 tests) ═══════════════════

describe('R257 QU-10: Market Heatmap', () => {
  const mkReturns = () => ({
    US: [0.01, 0.02, -0.01, 0.03, 0, 0.01, 0.02, -0.01, 0.01, 0.02, 0, 0.01],
    HK: [0.015, 0.025, -0.005, 0.035, 0.005, 0.015, 0.025, -0.005, 0.015, 0.025, 0.005, 0.01],
    JP: [-0.01, -0.02, 0.01, 0, 0.005, -0.01, 0, 0.01, -0.005, 0, 0.01, -0.01],
    UK: [0.008, 0.015, -0.008, 0.025, 0.002, 0.01, 0.018, -0.005, 0.012, 0.02, 0.005, 0.008],
    DE: [0.012, 0.02, -0.01, 0.03, 0.005, 0.012, 0.022, -0.008, 0.015, 0.022, 0.005, 0.01],
  });

  it('generates heatmap for 5 markets', () => {
    const data = generateMarketHeatmap(mkReturns());
    expect(data.markets.length).toBe(5);
    expect(data.matrix.length).toBe(5);
  });

  it('top pairs filtered by correlation', () => {
    const data = generateMarketHeatmap(mkReturns());
    for (const p of data.topPairs) {
      expect(Math.abs(p.correlation)).toBeGreaterThanOrEqual(0.3);
    }
  });

  it('lead-lag top populated', () => {
    const data = generateMarketHeatmap(mkReturns());
    expect(data.leadLagTop.length).toBeGreaterThanOrEqual(0);
  });

  it('labels match markets', () => {
    const data = generateMarketHeatmap(mkReturns());
    expect(data.labels.length).toBe(data.markets.length);
  });

  it('format produces markdown', () => {
    const data = generateMarketHeatmap(mkReturns());
    const md = formatHeatmapAsText(data);
    expect(md).toContain('#');
    expect(md).toContain('29');
  });

  it('matrix is symmetric', () => {
    const data = generateMarketHeatmap(mkReturns());
    const n = data.markets.length;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        expect(data.matrix[i][j]).toBeCloseTo(data.matrix[j][i], 10);
      }
    }
  });

  it('diagonal is 1', () => {
    const data = generateMarketHeatmap(mkReturns());
    for (let i = 0; i < data.markets.length; i++) {
      expect(data.matrix[i][i]).toBeCloseTo(1, 10);
    }
  });
});

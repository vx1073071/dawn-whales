// ── R274 JVS 测试文件 ── 覆盖: CrossMarketLinkageEngine + FXRiskEngine + HKIndicatorsEngine + CNIndicatorsEngine

import { describe, it, expect, beforeEach } from 'vitest';
import { CrossMarketLinkageEngine, getCrossMarketLinkageEngine, resetCrossMarketLinkageEngine, type LinkedMarket } from '../electron/engine/analysis/cross-market-linkage-engine';
import { FXRiskEngine, getFXRiskEngine, resetFXRiskEngine } from '../electron/engine/analysis/fx-risk-engine';
import { HKIndicatorsEngine, getHKIndicatorsEngine, resetHKIndicatorsEngine } from '../electron/engine/analysis/hk-6-indicators-engine';
import { CNIndicatorsEngine, getCNIndicatorsEngine, resetCNIndicatorsEngine } from '../electron/engine/analysis/cn-6-indicators-engine';

// ═══════════════════════════════════════════════
// CrossMarketLinkageEngine
// ═══════════════════════════════════════════════

describe('CrossMarketLinkageEngine', () => {
  let e: CrossMarketLinkageEngine;
  beforeEach(() => { resetCrossMarketLinkageEngine(); e = getCrossMarketLinkageEngine(); });

  it('seed creates all pairwise linkages', () => {
    e.seed();
    const linkage = e.getLinkage('US', 'HK');
    expect(linkage.length).toBeGreaterThanOrEqual(1);
    expect(linkage[0].correlation).toBeGreaterThan(0.7);
  });

  it('loadLinkages bulk import', () => {
    const count = e.seed();
    const all = e.getAllPairwiseLinkages();
    expect(all.length).toBeGreaterThan(20);
  });

  it('strongest linkage found', () => {
    e.seed();
    const best = e.getStrongestLinkage();
    expect(best).toBeDefined();
    expect(Math.abs(best!.linkage.correlation)).toBeGreaterThan(0.5);
  });

  it('estimateImpact computes target move', () => {
    e.seed();
    const impact = e.estimateImpact('US', 'HK', 2);
    expect(impact.targetMovePercent).toBeGreaterThan(0);
    expect(impact.beta).toBeGreaterThan(0);
  });

  it('ripple effect simulates cross-market', () => {
    e.seed();
    const ripples = e.computeRippleEffect('US', 3);
    expect(ripples.length).toBeGreaterThanOrEqual(3);
    expect(ripples[0].delayMinutes).toBeGreaterThan(0);
    expect(typeof ripples[0].impactPercent).toBe('number');
  });

  it('whoIsOpen returns markets at UTC hour', () => {
    e.seed();
    const atUTC1 = e.whoIsOpen(1);
    expect(atUTC1).toContain('HK');
    expect(atUTC1).toContain('CN');
  });

  it('nextToOpen returns next market', () => {
    e.seed();
    const next = e.nextToOpen(22); // late UTC, US closed
    expect(next).toBeDefined();
  });

  it('trade overlaps are defined', () => {
    e.seed();
    const overlaps = e.getTradeOverlaps();
    expect(overlaps.length).toBeGreaterThanOrEqual(4);
  });

  it('heatmap builds correlation matrix', () => {
    e.seed();
    const hm = e.buildHeatmap()!;
    expect(hm.correlationMatrix.length).toBe(7);
    expect(hm.strongestPair.correlation).toBeGreaterThanOrEqual(hm.weakestPair.correlation);
    expect(hm.clusterMarkets.length).toBeGreaterThan(0);
  });

  it('sector linkages created', () => {
    e.seed();
    const sl = e.getSectorLinkages('US', 'tech');
    expect(sl.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════
// FXRiskEngine
// ═══════════════════════════════════════════════

describe('FXRiskEngine', () => {
  let e: FXRiskEngine;
  beforeEach(() => { resetFXRiskEngine(); e = getFXRiskEngine(); });

  it('seed computes risk snapshots', () => {
    const snaps = e.seed();
    expect(snaps.length).toBe(10);
    expect(snaps[0].var95).toBeGreaterThan(0);
    expect(snaps[0].riskLevel).toBeTruthy();
  });

  it('VaR levels: 99% > 95%', () => {
    e.seed();
    const snap = e.getSnapshot('USD/JPY')!;
    expect(snap.var99).toBeGreaterThanOrEqual(snap.var95);
  });

  it('CVaR > VaR', () => {
    e.seed();
    const snap = e.getSnapshot('USD/TRY')!;
    expect(snap.cvar95).toBeGreaterThanOrEqual(snap.var95);
  });

  it('portfolio exposure', () => {
    e.seed();
    const exp = e.computeExposure([
      { pair: 'USD/JPY', notionalUSD: 50000 },
      { pair: 'EUR/USD', notionalUSD: 30000 },
    ])!;
    expect(exp.totalExposureUSD).toBeGreaterThan(0);
    expect(exp.totalVaR95).toBeGreaterThan(0);
    expect(exp.stressTestResults.length).toBe(5);
  });

  it('monte carlo simulation', () => {
    e.seed();
    const mc = e.monteCarloSimulate('USD/JPY', 10, 5000)!;
    expect(mc.trials).toBe(5000);
    expect(mc.percentiles.p95).toBeGreaterThan(mc.percentiles.p5);
    expect(typeof mc.probabilityOfLoss).toBe('number');
  });

  it('alerts detect high risk', () => {
    e.seed();
    const alerts = e.detectAlerts();
    expect(Array.isArray(alerts)).toBe(true);
  });

  it('invert rate pair', () => {
    e.seed();
    const snap = e.getSnapshot('USD/JPY')!;
    const inv = e.invertRate(snap);
    expect(inv.pair).toBe('JPY/USD');
    expect(inv.rate).toBeCloseTo(1 / snap.rate, 5);
  });
});

// ═══════════════════════════════════════════════
// HKIndicatorsEngine
// ═══════════════════════════════════════════════

describe('HKIndicatorsEngine', () => {
  let e: HKIndicatorsEngine;
  beforeEach(() => { resetHKIndicatorsEngine(); e = getHKIndicatorsEngine(); });

  it('seed loads all 6 indicators', () => {
    e.seed();
    expect(e.getLatestAHPremium()).toBeDefined();
    expect(e.getLatestShortSell()).toBeDefined();
    expect(e.getLatestCBBC()).toBeDefined();
    expect(e.getLatestWarrant()).toBeDefined();
    expect(e.getLatestSouthBound()).toBeDefined();
    expect(e.getLatestNorthBound()).toBeDefined();
  });

  it('AH premium analysis returns signal', () => {
    e.seed();
    const analysis = e.analyzeAHPremium();
    expect(analysis.avgPremium).toBeGreaterThan(0);
    expect(['A_premium_widening', 'H_recovering', 'stable']).toContain(analysis.trend);
  });

  it('short sell analysis', () => {
    e.seed();
    const analysis = e.analyzeShortSell();
    expect(analysis.ratio).toBeGreaterThan(0);
    expect(typeof analysis.signal).toBe('string');
  });

  it('warrant sentiment', () => {
    e.seed();
    const ws = e.getWarrantSentiment();
    expect(ws.callPutRatio).toBeGreaterThan(0.5);
    expect(['bullish', 'bearish', 'neutral']).toContain(ws.sentiment);
  });

  it('south bond analysis', () => {
    e.seed();
    const sb = e.analyzeSouthBound();
    expect(typeof sb.net30d).toBe('number');
    expect(sb.consecutive).toBeGreaterThanOrEqual(0);
  });

  it('north bond composition', () => {
    e.seed();
    const nb = e.analyzeNorthBoundComposition();
    expect(nb.total).toBeDefined();
    expect(['smart', 'passive', 'mixed']).toContain(nb.quality);
  });

  it('dashboard aggregates all 6', () => {
    e.seed();
    const db = e.getDashboard()!;
    expect(db.ah).toBeDefined();
    expect(db.shortSell).toBeDefined();
    expect(db.cbbc).toBeDefined();
    expect(db.warrant).toBeDefined();
    expect(db.south).toBeDefined();
    expect(db.north).toBeDefined();
  });

  it('arbitrage opportunities', () => {
    e.seed();
    const arb = e.detectArbitrageOpportunities();
    expect(Array.isArray(arb)).toBe(true);
  });
});

// ═══════════════════════════════════════════════
// CNIndicatorsEngine
// ═══════════════════════════════════════════════

describe('CNIndicatorsEngine', () => {
  let e: CNIndicatorsEngine;
  beforeEach(() => { resetCNIndicatorsEngine(); e = getCNIndicatorsEngine(); });

  it('seed loads all 6 indicators', () => {
    e.seed();
    expect(e.getLatestMargin()).toBeDefined();
    expect(e.getLatestDragonTiger()).toBeDefined();
    expect(e.getLatestIPOBreak()).toBeDefined();
    expect(e.getLatestETF()).toBeDefined();
    expect(e.getLatestNorthHoldings()).toBeDefined();
    expect(e.getLatestFundPosition()).toBeDefined();
  });

  it('margin analysis returns balance + leverage', () => {
    e.seed();
    const m = e.analyzeMargin();
    expect(m.balance).toBeGreaterThan(10000);
    expect(m.leverage).toBeGreaterThan(1);
  });

  it('short balance ratio', () => {
    e.seed();
    const sr = e.getShortBalanceRatio();
    expect(sr.margin).toBeGreaterThan(0);
    expect(sr.ratio).toBeGreaterThan(0);
  });

  it('dragon tiger institution analysis', () => {
    e.seed();
    const dt = e.analyzeDragonTiger();
    expect(typeof dt.institutionNet).toBe('number');
    expect(dt.hotSectors.length).toBeGreaterThan(0);
  });

  it('IPO break rate analysis', () => {
    e.seed();
    const ipo = e.analyzeIPOBreak();
    expect(ipo.breakRate).toBeGreaterThanOrEqual(0);
    expect(ipo.historicalPercentile).toBeGreaterThanOrEqual(0);
  });

  it('ETF smart money signal', () => {
    e.seed();
    const etf = e.analyzeETF();
    expect(etf.netSub).toBeDefined();
    expect(['BOTTOM_BUILDING', 'DISTRIBUTING', 'HOLDING']).toContain(etf.smartMoneyDirection);
  });

  it('north holdings sector analysis', () => {
    e.seed();
    const nh = e.analyzeNorthHoldings();
    expect(nh.totalValue).toBeGreaterThan(10000);
    expect(nh.topSector).toBeTruthy();
  });

  it('fund position 88 rule check', () => {
    e.seed();
    const fp = e.analyzeFundPosition();
    expect(fp.avgPos).toBeGreaterThan(70);
    expect(fp.cash).toBeGreaterThan(0);
  });

  it('dashboard aggregates all 6', () => {
    e.seed();
    const db = e.getDashboard()!;
    expect(db.margin).toBeDefined();
    expect(db.dragonTiger).toBeDefined();
    expect(db.ipo).toBeDefined();
    expect(db.etf).toBeDefined();
    expect(db.north).toBeDefined();
    expect(db.fund).toBeDefined();
  });
});

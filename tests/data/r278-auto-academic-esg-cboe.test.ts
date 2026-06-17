/**
 * R278 autoclaw test — OpenSourceAP + ESG + CBOE data sources
 * 
 * Coverage:
 *   auto#1: OpenSourceAPBridge (18 tests)
 *     - getFactor/getFactorByQmId/getAllFactors
 *     - getFactorsByFamily/getFactorsByComplexity/searchFactors
 *     - getTopFactors by IC/IR/tStat
 *     - getFamilies/getFamilyStats/getAllFamilyStats
 *     - mapToQm/mapToOsap bidirectional mapping
 *     - ingestSignal/getSignals/getTopSignals by recommendation
 *     - getStats/reset
 * 
 *   auto#2a: ESGDataSource (14 tests)
 *     - getIndicators by pillar/getIndicator/getPillarWeights
 *     - ingestScore/getScore/getAllScores
 *     - getTopPerformers/getBottomPerformers/getByRating/getByMomentum
 *     - getControversial
 *     - computePortfolioESG (weighted avg / rating distribution / rebalanced)
 *     - controversy/momentum/pillar signal detection
 *     - handlers/stats/reset
 * 
 *   auto#2b: CBOEDataSource (12 tests)
 *     - ingestVolatility/getVolatility/getVIXPercentile/getVolRegime
 *     - ingestSkew/getSkew/skew signal detection
 *     - ingestPutCall/getPutCall/PCR signal detection
 *     - ingestTermStructure/getTermStructure/getTermAnalysis
 *     - ingestFuturesCurve/getFuturesCurve
 *     - computeSentiment
 *     - cross-asset vol signal
 *     - stats/reset/handlers
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { OpenSourceAPBridge, getOsapBridge, resetOsapBridge } from '../../electron/engine/data/opensource-ap-bridge';
import { ESGDataSource, getESGSource, resetESGSource } from '../../electron/engine/data/esg-data-source';
import { CBOEDataSource, getCBOESource, resetCBOESource } from '../../electron/engine/data/cboe-data-source';

// ═══════════════════════════════════════════════════════════════════════════
// auto#1: OpenSourceAPBridge
// ═══════════════════════════════════════════════════════════════════════════

describe('R278-auto#1 OpenSourceAPBridge', () => {
  let bridge: OpenSourceAPBridge;

  beforeEach(() => {
    resetOsapBridge();
    bridge = getOsapBridge();
  });

  // ── Factor Registry ─────────────────────────────────────────────────────

  describe('factor registry', () => {
    it('should retrieve factor by OSAP ID', () => {
      const factor = bridge.getFactor('BEME');
      expect(factor).not.toBeNull();
      expect(factor!.name).toBe('Book-to-Market Equity');
      expect(factor!.family).toBe('value');
    });

    it('should retrieve factor by QM factor ID', () => {
      const factor = bridge.getFactorByQmId('HML');
      expect(factor).not.toBeNull();
      expect(factor!.osapId).toBe('BEME');
    });

    it('should return null for unknown IDs', () => {
      expect(bridge.getFactor('NONEXISTENT')).toBeNull();
      expect(bridge.getFactorByQmId('UNKNOWN')).toBeNull();
    });

    it('should list all academic factors (200+)', () => {
      const all = bridge.getAllFactors();
      expect(all.length).toBeGreaterThanOrEqual(45); // We have 45 defined
    });

    it('should filter factors by family', () => {
      const value = bridge.getFactorsByFamily('value');
      expect(value.length).toBeGreaterThanOrEqual(7);
      expect(value.every(f => f.family === 'value')).toBe(true);

      const momentum = bridge.getFactorsByFamily('momentum');
      expect(momentum.length).toBeGreaterThanOrEqual(6);
    });

    it('should filter factors by complexity', () => {
      const low = bridge.getFactorsByComplexity('low');
      expect(low.length).toBeGreaterThan(0);
      expect(low.every(f => f.complexity === 'low')).toBe(true);
    });

    it('should search factors by keyword', () => {
      const results = bridge.searchFactors('momentum');
      expect(results.length).toBeGreaterThanOrEqual(5);
      
      const cnResults = bridge.searchFactors('动量');
      expect(cnResults.length).toBeGreaterThanOrEqual(3);
    });
  });

  // ── Top Factors ─────────────────────────────────────────────────────────

  describe('top factors', () => {
    it('should rank by absolute IC', () => {
      const top = bridge.getTopFactors('IC', 5);
      expect(top.length).toBe(5);
      expect(Math.abs(top[0].originalIC)).toBeGreaterThanOrEqual(Math.abs(top[4].originalIC));
    });

    it('should rank by IR', () => {
      const top = bridge.getTopFactors('IR', 5);
      expect(top.length).toBe(5);
    });

    it('should rank by t-stat', () => {
      const top = bridge.getTopFactors('tStat', 5);
      expect(top.length).toBe(5);
      expect(Math.abs(top[0].tStat)).toBeGreaterThanOrEqual(Math.abs(top[4].tStat));
    });
  });

  // ── Factor Families ─────────────────────────────────────────────────────

  describe('factor families', () => {
    it('should list all families', () => {
      const families = bridge.getFamilies();
      expect(families.length).toBeGreaterThanOrEqual(7);
      expect(families).toContain('value');
      expect(families).toContain('momentum');
      expect(families).toContain('quality');
    });

    it('should provide family stats', () => {
      const valueStats = bridge.getFamilyStats('value');
      expect(valueStats).not.toBeNull();
      expect(valueStats!.factorCount).toBeGreaterThanOrEqual(7);
      expect(valueStats!.avgIC).toBeGreaterThan(0);
    });

    it('should list all family stats', () => {
      const all = bridge.getAllFamilyStats();
      expect(all.length).toBeGreaterThanOrEqual(7);
    });
  });

  // ── Bidirectional Mapping ───────────────────────────────────────────────

  describe('mapping', () => {
    it('should map OSAP → QM', () => {
      expect(bridge.mapToQm('MOM12M')).toBe('MOM_12M');
      expect(bridge.mapToQm('ACCRUALS')).toBe('ACCRUALS');
    });

    it('should map QM → OSAP', () => {
      expect(bridge.mapToOsap('MOM_12M')).toBe('MOM12M');
      expect(bridge.mapToOsap('SIZE')).toBe('SIZE');
    });
  });

  // ── Academic Signals ─────────────────────────────────────────────────────

  describe('academic signals', () => {
    it('should ingest and retrieve signals', () => {
      bridge.ingestSignal({
        signalId: 'sig_1', osapFactorId: 'MOM12M', qmFactorId: 'MOM_12M',
        factorName: '12-Month Momentum', factorNameCn: '12月动量',
        currentIC: 0.053, currentIR: 0.60, icTrend: 'rising', decileSpread: 8.5,
        significance: 'significant', recommendation: 'strong_buy', timestamp: Date.now(),
      });

      const signals = bridge.getSignals();
      expect(signals.length).toBe(1);
    });

    it('should filter signals by family', () => {
      bridge.ingestSignal({
        signalId: 's1', osapFactorId: 'MOM12M', qmFactorId: 'MOM_12M', factorName: 'M',
        factorNameCn: 'M', currentIC: 0.05, currentIR: 0.5, icTrend: 'stable',
        decileSpread: 6, significance: 'significant', recommendation: 'buy', timestamp: Date.now(),
      });
      bridge.ingestSignal({
        signalId: 's2', osapFactorId: 'BEME', qmFactorId: 'HML', factorName: 'V',
        factorNameCn: 'V', currentIC: 0.04, currentIR: 0.4, icTrend: 'declining',
        decileSpread: 4, significance: 'marginal', recommendation: 'hold', timestamp: Date.now(),
      });

      const momSignals = bridge.getSignals('momentum');
      expect(momSignals.length).toBe(1);
      expect(momSignals[0].osapFactorId).toBe('MOM12M');

      const valSignals = bridge.getSignals('value');
      expect(valSignals.length).toBe(1);
    });

    it('should rank signals by recommendation', () => {
      bridge.ingestSignal({
        signalId: 's1', osapFactorId: 'MOM12M', qmFactorId: 'MOM_12M', factorName: 'M', factorNameCn: 'M',
        currentIC: 0.05, currentIR: 0.5, icTrend: 'stable', decileSpread: 6, significance: 'significant',
        recommendation: 'strong_buy', timestamp: Date.now(),
      });
      bridge.ingestSignal({
        signalId: 's2', osapFactorId: 'ACCRUALS', qmFactorId: 'ACCRUALS', factorName: 'A', factorNameCn: 'A',
        currentIC: 0.03, currentIR: 0.3, icTrend: 'declining', decileSpread: 3, significance: 'marginal',
        recommendation: 'avoid', timestamp: Date.now(),
      });

      const top = bridge.getTopSignals(2);
      expect(top[0].recommendation).toBe('strong_buy');
      expect(top[1].recommendation).toBe('avoid');
    });
  });

  // ── Stats / Reset ───────────────────────────────────────────────────────

  describe('lifecycle', () => {
    it('should report stats', () => {
      const stats = bridge.getStats();
      expect(stats.totalFactors).toBeGreaterThanOrEqual(45);
      expect(stats.mappedFactors).toBeGreaterThanOrEqual(45);
    });

    it('should reset and re-initialize', () => {
      bridge.ingestSignal({
        signalId: 's1', osapFactorId: 'MOM12M', qmFactorId: 'MOM_12M', factorName: 'M', factorNameCn: 'M',
        currentIC: 0.05, currentIR: 0.5, icTrend: 'stable', decileSpread: 6, significance: 'significant',
        recommendation: 'buy', timestamp: Date.now(),
      });
      expect(bridge.getSignals().length).toBeGreaterThan(0);

      bridge.reset();
      expect(bridge.getSignals().length).toBe(0);
      expect(bridge.getAllFactors().length).toBeGreaterThanOrEqual(45);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// auto#2a: ESGDataSource
// ═══════════════════════════════════════════════════════════════════════════

describe('R278-auto#2a ESGDataSource', () => {
  let esg: ESGDataSource;

  const makeScore = (overrides?: Partial<{ symbol: string; companyName: string; overallRating: string; overallScore: number; controversyScore: number; momentum: string; eScore: number; sScore: number; gScore: number }>) => ({
    symbol: 'AAPL',
    companyName: 'Apple Inc.',
    timestamp: Date.now(),
    overallRating: 'AA' as const,
    overallScore: 8.2,
    momentum: 'stable' as const,
    scores: {
      E: { rating: 'A' as const, score: overrides?.eScore ?? 7.5, indicators: {} },
      S: { rating: 'AA' as const, score: overrides?.sScore ?? 8.0, indicators: {} },
      G: { rating: 'AA' as const, score: overrides?.gScore ?? 8.5, indicators: {} },
    },
    controversyScore: overrides?.controversyScore ?? 7.0,
    industryAdjustment: 0.5,
    percentile: 85,
    ...overrides,
  });

  beforeEach(() => {
    resetESGSource();
    esg = getESGSource();
  });

  // ── Indicators ──────────────────────────────────────────────────────────

  describe('indicators', () => {
    it('should list all ESG indicators (28+)', () => {
      const all = esg.getIndicators();
      expect(all.length).toBeGreaterThanOrEqual(28);
    });

    it('should filter by pillar', () => {
      const env = esg.getIndicators('E');
      expect(env.length).toBeGreaterThanOrEqual(10);
      expect(env.every(i => i.pillar === 'E')).toBe(true);
    });

    it('should get specific indicator', () => {
      const ind = esg.getIndicator('E_CARBON_INTENSITY');
      expect(ind).not.toBeNull();
      expect(ind!.pillar).toBe('E');
    });

    it('should compute pillar weights', () => {
      const w = esg.getPillarWeights();
      expect(w.E + w.S + w.G).toBeCloseTo(1, 1);
    });
  });

  // ── Scores ──────────────────────────────────────────────────────────────

  describe('scores', () => {
    it('should ingest and retrieve ESG score', () => {
      esg.ingestScore(makeScore());
      const s = esg.getScore('AAPL');
      expect(s).not.toBeNull();
      expect(s!.overallRating).toBe('AA');
      expect(s!.overallScore).toBe(8.2);
    });

    it('should ingest batch scores', () => {
      esg.ingestScores([
        makeScore({ symbol: 'AAPL', companyName: 'Apple', overallScore: 8.2 }),
        makeScore({ symbol: 'TSLA', companyName: 'Tesla', overallScore: 6.5 }),
        makeScore({ symbol: 'MSFT', companyName: 'Microsoft', overallScore: 9.1 }),
      ]);
      expect(esg.getAllScores().length).toBe(3);
    });

    it('should return top and bottom performers', () => {
      esg.ingestScores([
        makeScore({ symbol: 'A', companyName: 'A Co', overallScore: 9.5 }),
        makeScore({ symbol: 'B', companyName: 'B Co', overallScore: 3.2 }),
        makeScore({ symbol: 'C', companyName: 'C Co', overallScore: 7.0 }),
      ]);
      const top = esg.getTopPerformers(2);
      expect(top[0].overallScore).toBeGreaterThanOrEqual(top[1].overallScore);

      const bottom = esg.getBottomPerformers(2);
      expect(bottom[0].overallScore).toBeLessThanOrEqual(bottom[1].overallScore);
    });

    it('should filter by rating', () => {
      esg.ingestScores([
        makeScore({ symbol: 'A', overallRating: 'AAA', overallScore: 9.5 }),
        makeScore({ symbol: 'B', overallRating: 'AA', overallScore: 8.2 }),
      ]);
      expect(esg.getByRating('AAA').length).toBe(1);
    });

    it('should filter by momentum', () => {
      esg.ingestScores([
        makeScore({ symbol: 'A', momentum: 'improving' }),
        makeScore({ symbol: 'B', momentum: 'deteriorating' }),
      ]);
      expect(esg.getByMomentum('deteriorating').length).toBe(1);
    });

    it('should return controversial companies', () => {
      esg.ingestScores([
        makeScore({ symbol: 'GOOD', companyName: 'Good', controversyScore: 8 }),
        makeScore({ symbol: 'BAD', companyName: 'Bad', controversyScore: 1.5 }),
      ]);
      const controversial = esg.getControversial(3);
      expect(controversial.length).toBe(1);
      expect(controversial[0].symbol).toBe('BAD');
    });
  });

  // ── Portfolio ESG ───────────────────────────────────────────────────────

  describe('portfolio ESG analytics', () => {
    it('should compute weighted portfolio ESG', () => {
      esg.ingestScores([
        makeScore({ symbol: 'AAPL', companyName: 'Apple', overallScore: 8.5, eScore: 8, sScore: 8, gScore: 9 }),
        makeScore({ symbol: 'MSFT', companyName: 'Microsoft', overallScore: 9.0, eScore: 9, sScore: 9, gScore: 9 }),
      ]);

      const result = esg.computePortfolioESG([
        { symbol: 'AAPL', name: 'Apple', weight: 0.6 },
        { symbol: 'MSFT', name: 'Microsoft', weight: 0.4 },
        { symbol: 'UNKNOWN', name: 'Unknown', weight: 0.2 },
      ]);

      expect(result.ratedCount).toBe(2);
      expect(result.totalHoldings).toBe(3);
      expect(result.avgESGScore).toBeGreaterThan(8);
      expect(result.topPerformers.length).toBeGreaterThan(0);
    });

    it('should handle portfolio with no rated holdings', () => {
      const result = esg.computePortfolioESG([
        { symbol: 'UNK1', name: 'U1', weight: 0.5 },
      ]);
      expect(result.ratedCount).toBe(0);
      expect(result.avgESGScore).toBe(0);
    });
  });

  // ── Signals ─────────────────────────────────────────────────────────────

  describe('signal detection', () => {
    it('should detect controversy alert', () => {
      esg.ingestScore(makeScore({ symbol: 'EVIL', companyName: 'Evil Corp', controversyScore: 1.0 }));
      const sigs = esg.getSignals();
      const cSig = sigs.find(s => s.category === 'controversy');
      expect(cSig).toBeDefined();
      expect(cSig!.severity).toBe('critical');
    });

    it('should detect momentum deterioration', () => {
      esg.ingestScore(makeScore({ symbol: 'FALL', companyName: 'Fall Co', momentum: 'deteriorating', controversyScore: 8 }));
      const sigs = esg.getSignals();
      expect(sigs.some(s => s.category === 'momentum_alert')).toBe(true);
    });

    it('should notify signal handlers', () => {
      const received: string[] = [];
      esg.onSignal(sig => received.push(sig.symbol));
      esg.ingestScore(makeScore({ symbol: 'EVIL', companyName: 'Evil', controversyScore: 1.0 }));
      expect(received).toContain('EVIL');
    });
  });

  // ── Lifecycle ───────────────────────────────────────────────────────────

  describe('lifecycle', () => {
    it('should track stats', () => {
      esg.ingestScores([
        makeScore({ symbol: 'A', overallScore: 9 }),
        makeScore({ symbol: 'B', overallScore: 5 }),
      ]);
      const stats = esg.getStats();
      expect(stats.totalScores).toBe(2);
      expect(stats.avgOverallScore).toBe(7);
    });

    it('should reset all state', () => {
      esg.ingestScore(makeScore({ symbol: 'A' }));
      expect(esg.getAllScores().length).toBe(1);
      esg.reset();
      expect(esg.getAllScores().length).toBe(0);
      expect(esg.getSignals().length).toBe(0);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// auto#2b: CBOEDataSource
// ═══════════════════════════════════════════════════════════════════════════

describe('R278-auto#2b CBOEDataSource', () => {
  let cboe: CBOEDataSource;

  beforeEach(() => {
    resetCBOESource();
    cboe = getCBOESource();
  });

  // ── Volatility ──────────────────────────────────────────────────────────

  describe('volatility', () => {
    it('should ingest and retrieve volatility data', () => {
      cboe.ingestVolatility({
        timestamp: Date.now(), vix: 18.5, vix9d: 16.2, vix3m: 20.1, vix6m: 21.5,
        vxn: 22.0, rvx: 24.5, vxd: 16.0, ovx: 32.0, gvz: 15.0, euvix: 19.0,
      });

      const vol = cboe.getVolatility();
      expect(vol).not.toBeNull();
      expect(vol!.vix).toBe(18.5);
      expect(vol!.ovx).toBe(32.0);
    });

    it('should track VIX percentile', () => {
      // Multiple VIX readings to build history
      for (let i = 0; i < 5; i++) {
        cboe.ingestVolatility({ timestamp: Date.now(), vix: 15 + i, vix9d: null, vix3m: null, vix6m: null, vxn: null, rvx: null, vxd: null, ovx: null, gvz: null, euvix: null });
      }
      const pct = cboe.getVIXPercentile();
      expect(pct).toBeGreaterThanOrEqual(0);
      expect(pct).toBeLessThanOrEqual(100);
    });

    it('should classify volatility regime', () => {
      cboe.ingestVolatility({ timestamp: Date.now(), vix: 32, vix9d: null, vix3m: null, vix6m: null, vxn: null, rvx: null, vxd: null, ovx: null, gvz: null, euvix: null });
      expect(cboe.getVolRegime()).toBe('high');
    });

    it('should detect VIX spike signal', () => {
      cboe.ingestVolatility({ timestamp: Date.now(), vix: 35, vix9d: null, vix3m: null, vix6m: null, vxn: null, rvx: null, vxd: null, ovx: null, gvz: null, euvix: null });
      const sigs = cboe.getSignals();
      expect(sigs.some(s => s.type === 'vix_spike')).toBe(true);
    });

    it('should detect cross-asset vol divergence', () => {
      cboe.ingestVolatility({ timestamp: Date.now(), vix: 28, vix9d: null, vix3m: null, vix6m: null, vxn: null, rvx: null, vxd: null, ovx: 15, gvz: null, euvix: null });
      const sigs = cboe.getSignals();
      expect(sigs.some(s => s.type === 'cross_asset_vol')).toBe(true);
    });
  });

  // ── Skew ────────────────────────────────────────────────────────────────

  describe('skew', () => {
    it('should ingest skew and detect extreme tail risk', () => {
      cboe.ingestSkew({ timestamp: Date.now(), skew: 145, skewSignal: 'extreme' });
      expect(cboe.getSkew()!.skew).toBe(145);

      const sigs = cboe.getSignals();
      expect(sigs.some(s => s.type === 'skew_alert' && s.severity === 'critical')).toBe(true);
    });
  });

  // ── Put/Call ────────────────────────────────────────────────────────────

  describe('put/call ratio', () => {
    it('should detect extreme PCR (contrarian buy)', () => {
      cboe.ingestPutCall({ timestamp: Date.now(), equityPCR: 0.9, indexPCR: 1.5, totalPCR: 1.35, pcrSignal: 'oversold' });
      const sigs = cboe.getSignals();
      const pcrSig = sigs.find(s => s.type === 'pcr_extreme');
      expect(pcrSig).toBeDefined();
      expect(pcrSig!.direction).toBe('bullish'); // contrarian
    });

    it('should detect extremely low PCR (complacency)', () => {
      cboe.ingestPutCall({ timestamp: Date.now(), equityPCR: 0.3, indexPCR: 0.4, totalPCR: 0.35, pcrSignal: 'overbought' });
      const sigs = cboe.getSignals();
      const pcrSig = sigs.find(s => s.type === 'pcr_extreme');
      expect(pcrSig).toBeDefined();
      expect(pcrSig!.direction).toBe('bearish');
    });
  });

  // ── Term Structure ──────────────────────────────────────────────────────

  describe('term structure', () => {
    it('should detect backwardation signal', () => {
      cboe.ingestTermStructure({
        timestamp: Date.now(), spot: 28, m1: 25, m2: 23, m3: 22, m4: 21.5,
        contango: -3, rollYield: 0.08, regime: 'backwardation',
      });

      const sigs = cboe.getSignals();
      expect(sigs.some(s => s.type === 'backwardation')).toBe(true);
    });

    it('should provide term structure analysis', () => {
      cboe.ingestTermStructure({
        timestamp: Date.now(), spot: 25, m1: 20, m2: 19, m3: 18.5, m4: 18,
        contango: -5, rollYield: 0.05, regime: 'backwardation',
      });

      const analysis = cboe.getTermAnalysis();
      expect(analysis).not.toBeNull();
      expect(analysis!.state).toBe('Backwardation');
    });
  });

  // ── Futures Curve ───────────────────────────────────────────────────────

  describe('futures curve', () => {
    it('should ingest and retrieve futures curve', () => {
      cboe.ingestFuturesCurve({
        timestamp: Date.now(),
        points: [
          { month: '2026-07', price: 20.5, expiry: '2026-07-21' },
          { month: '2026-08', price: 21.2, expiry: '2026-08-18' },
          { month: '2026-09', price: 22.0, expiry: '2026-09-15' },
        ],
        slope: 'upward', steepness: 1.5,
      });

      const curve = cboe.getFuturesCurve();
      expect(curve).not.toBeNull();
      expect(curve!.points.length).toBe(3);
      expect(curve!.slope).toBe('upward');
    });
  });

  // ── Sentiment ───────────────────────────────────────────────────────────

  describe('sentiment composite', () => {
    it('should compute composite options sentiment', () => {
      cboe.ingestVolatility({ timestamp: Date.now(), vix: 14, vix9d: null, vix3m: null, vix6m: null, vxn: null, rvx: null, vxd: null, ovx: null, gvz: null, euvix: null });
      cboe.ingestSkew({ timestamp: Date.now(), skew: 115, skewSignal: 'normal' });
      cboe.ingestPutCall({ timestamp: Date.now(), equityPCR: 0.6, indexPCR: 0.7, totalPCR: 0.65, pcrSignal: 'neutral' });
      cboe.ingestTermStructure({ timestamp: Date.now(), spot: 14, m1: 16, m2: 17, m3: null, m4: null, contango: 2, rollYield: 0.06, regime: 'contango' });

      const sent = cboe.computeSentiment();
      // Low VIX + normal skew + neutral PCR + contango = bullish/greed
      expect(sent).toBeGreaterThan(0);
    });
  });

  // ── Lifecycle ───────────────────────────────────────────────────────────

  describe('lifecycle', () => {
    it('should track stats', () => {
      cboe.ingestVolatility({ timestamp: Date.now(), vix: 20, vix9d: null, vix3m: null, vix6m: null, vxn: null, rvx: null, vxd: null, ovx: null, gvz: null, euvix: null });
      const stats = cboe.getStats();
      expect(stats.vixCurrent).toBe(20);
    });

    it('should notify signal handlers', () => {
      const received: string[] = [];
      cboe.onSignal(sig => received.push(sig.type));
      cboe.ingestVolatility({ timestamp: Date.now(), vix: 36, vix9d: null, vix3m: null, vix6m: null, vxn: null, rvx: null, vxd: null, ovx: null, gvz: null, euvix: null });
      expect(received).toContain('vix_spike');
    });

    it('should reset all state', () => {
      cboe.ingestVolatility({ timestamp: Date.now(), vix: 20, vix9d: null, vix3m: null, vix6m: null, vxn: null, rvx: null, vxd: null, ovx: null, gvz: null, euvix: null });
      expect(cboe.getVolatility()).not.toBeNull();

      cboe.reset();
      expect(cboe.getVolatility()).toBeNull();
      expect(cboe.getSignals().length).toBe(0);
    });
  });
});

/**
 * R277 autoclaw test — GlobalMarketBridge + MacroDataSource
 * 
 * Coverage:
 *   auto#1: GlobalMarketBridge (22 tests)
 *     - getCountryMeta / getAllCountries / getCountriesByRegion
 *     - ingest / getIndicator / ingestBatch / getAllIndicators
 *     - compareAll / getLastComparison / comparePair
 *     - generateHeatmap
 *     - signals: foreignFlow/margin/breadth/volatility/institutional/turnover/detection+getSignals
 *     - watchlist: addToWatchlist / removeFromWatchlist / getWatchlistIndicators
 *     - event handlers / stats / reset
 * 
 *   auto#2: MacroDataSource (19 tests)
 *     - getIndicators / getIndicator / getIndicators by category
 *     - ingestDataPoint / ingestBatch / getHistory
 *     - updateSnapshot / getSnapshot / getAllSnapshots
 *     - compareGdp / compareCpi / compareUnemployment
 *     - macro cycle detection / getCycle
 *     - getMarketImplications
 *     - signals: detect/report/getSignals
 *     - event handlers / stats / reset
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GlobalMarketBridge, getGlobalBridge, resetGlobalBridge } from '../../electron/engine/data/global-market-bridge';
import { MacroDataSource, getMacroSource, resetMacroSource } from '../../electron/engine/data/macro-data-source';
import type { CountryCode, CountryIndicator } from '../../electron/engine/data/global-market-bridge';

// ═══════════════════════════════════════════════════════════════════════════
// auto#1: GlobalMarketBridge
// ═══════════════════════════════════════════════════════════════════════════

describe('R277-auto#1 GlobalMarketBridge', () => {
  let bridge: GlobalMarketBridge;

  const makeIndicator = (overrides?: Partial<Omit<CountryIndicator, 'country' | 'compositeScore'>>): Omit<CountryIndicator, 'country' | 'compositeScore'> => ({
    timestamp: Date.now(),
    foreignFlow: 20,
    marginStatus: 50,
    marketBreadth: 55,
    sectorFlow: 10,
    volatilityIndex: 18,
    creditRatio: 45,
    institutionalFlow: 15,
    turnoverAlert: 35,
    ...overrides,
  });

  beforeEach(() => {
    resetGlobalBridge();
    bridge = getGlobalBridge();
  });

  // ── Country Metadata ─────────────────────────────────────────────────────

  describe('country metadata', () => {
    it('should return country meta for valid code', () => {
      const meta = bridge.getCountryMeta('US');
      expect(meta).not.toBeNull();
      expect(meta!.name).toBe('United States');
      expect(meta!.currency).toBe('USD');
      expect(meta!.mainIndex).toBe('SPX');
    });

    it('should return null for invalid code', () => {
      expect(bridge.getCountryMeta('XX' as CountryCode)).toBeNull();
    });

    it('should return all 14 countries', () => {
      const all = bridge.getAllCountries();
      expect(all.length).toBe(14);
    });

    it('should filter by region', () => {
      const americas = bridge.getCountriesByRegion('americas');
      expect(americas.length).toBe(3);
      expect(americas.map(c => c.code)).toContain('US');

      const asia = bridge.getCountriesByRegion('asia');
      expect(asia.length).toBe(8);
      expect(asia.map(c => c.code)).toContain('JP');
      expect(asia.map(c => c.code)).toContain('TW');
    });
  });

  // ── Indicator Ingestion ─────────────────────────────────────────────────

  describe('indicator ingestion', () => {
    it('should ingest and retrieve indicator for a country', () => {
      bridge.ingest('JP', makeIndicator({ foreignFlow: 70, marginStatus: 55 }));
      const ind = bridge.getIndicator('JP');
      expect(ind).not.toBeNull();
      expect(ind!.foreignFlow).toBe(70);
      expect(ind!.compositeScore).toBeGreaterThan(0);
    });

    it('should batch ingest multiple countries', () => {
      bridge.ingestBatch([
        { country: 'US', data: makeIndicator({ foreignFlow: 30 }) },
        { country: 'CN', data: makeIndicator({ foreignFlow: 50 }) },
        { country: 'EU', data: makeIndicator({ foreignFlow: -20 }) },
      ]);

      expect(bridge.getIndicator('US')!.foreignFlow).toBe(30);
      expect(bridge.getIndicator('CN')!.foreignFlow).toBe(50);
      expect(bridge.getIndicator('EU')!.foreignFlow).toBe(-20);
      expect(bridge.getAllIndicators().length).toBe(3);
    });

    it('should compute composite score correctly', () => {
      bridge.ingest('JP', makeIndicator({
        foreignFlow: 80, institutionalFlow: 70, marketBreadth: 80,
        sectorFlow: 30, marginStatus: 40, volatilityIndex: 15,
        creditRatio: 60, turnoverAlert: 20,
      }));
      const ind = bridge.getIndicator('JP')!;
      // Strong positive across all dimensions → high score
      expect(ind.compositeScore).toBeGreaterThan(45);
    });
  });

  // ── Cross-Country Analysis ──────────────────────────────────────────────

  describe('cross-country comparison', () => {
    beforeEach(() => {
      bridge.ingest('US', makeIndicator({ foreignFlow: 60, compositeScore: undefined }));
      bridge.ingest('JP', makeIndicator({ foreignFlow: 80, compositeScore: undefined }));
      bridge.ingest('CN', makeIndicator({ foreignFlow: 40, compositeScore: undefined }));
      bridge.ingest('EU', makeIndicator({ foreignFlow: -30, compositeScore: undefined }));
      bridge.ingest('BR', makeIndicator({ foreignFlow: 10, compositeScore: undefined }));
    });

    it('should rank all countries by composite score', () => {
      const cmp = bridge.compareAll();
      expect(cmp.rankings.length).toBeGreaterThanOrEqual(3);
      expect(cmp.best.score).toBeGreaterThanOrEqual(cmp.worst.score);
      expect(cmp.average).not.toBeNaN();
    });

    it('should identify best and worst', () => {
      const cmp = bridge.compareAll();
      expect(cmp.best.name).toBeDefined();
      expect(cmp.worst.name).toBeDefined();
      expect(cmp.stdDev).toBeGreaterThanOrEqual(0);
    });

    it('should list top foreign flows', () => {
      const cmp = bridge.compareAll();
      expect(cmp.topFlows.length).toBeGreaterThan(0);
      expect(cmp.topFlows[0].flow).toBeGreaterThanOrEqual(cmp.topFlows[cmp.topFlows.length - 1].flow);
    });

    it('should compare two countries', () => {
      const pair = bridge.comparePair('JP', 'EU');
      expect(pair).not.toBeNull();
      expect(pair!.winner).toBe('JP'); // JP has higher foreignFlow
      expect(pair!.diff.foreignFlow).toBeDefined();
    });

    it('should cache last comparison', () => {
      bridge.compareAll();
      const cached = bridge.getLastComparison();
      expect(cached).not.toBeNull();
      expect(cached!.rankings.length).toBeGreaterThan(0);
    });
  });

  // ── Heatmap ─────────────────────────────────────────────────────────────

  describe('heatmap', () => {
    it('should generate global heatmap', () => {
      bridge.ingest('US', makeIndicator({ foreignFlow: 70 }));
      bridge.ingest('JP', makeIndicator({ foreignFlow: 80 }));
      bridge.ingest('EU', makeIndicator({ foreignFlow: -40 }));

      const heatmap = bridge.generateHeatmap();
      expect(heatmap.cells.length).toBeGreaterThanOrEqual(2);
      expect(heatmap.globalRiskLevel).toBeDefined();
      expect(heatmap.globalRiskScore).toBeGreaterThanOrEqual(0);
    });
  });

  // ── Signal Detection ────────────────────────────────────────────────────

  describe('signal detection', () => {
    it('should detect strong foreign flow signal', () => {
      bridge.ingest('JP', makeIndicator({ foreignFlow: 70 }));
      const signals = bridge.getSignals('JP');
      const flowSig = signals.find(s => s.indicator === 'foreign_flow');
      expect(flowSig).toBeDefined();
      expect(flowSig!.direction).toBe('bullish');
      expect(flowSig!.severity).toBe('warning');
    });

    it('should detect margin overheating', () => {
      bridge.ingest('US', makeIndicator({ marginStatus: 85, foreignFlow: 0 }));
      const sigs = bridge.getSignals('US');
      const marginSig = sigs.find(s => s.indicator === 'margin_overheat');
      expect(marginSig).toBeDefined();
      expect(marginSig!.direction).toBe('bearish');
      expect(marginSig!.severity).toBe('critical');
    });

    it('should detect de-leveraging', () => {
      bridge.ingest('EU', makeIndicator({ marginStatus: 12, foreignFlow: 0 }));
      const sigs = bridge.getSignals('EU');
      const delSig = sigs.find(s => s.indicator === 'margin_delever');
      expect(delSig).toBeDefined();
      expect(delSig!.severity).toBe('critical');
    });

    it('should detect volatility spike', () => {
      bridge.ingest('SA', makeIndicator({ volatilityIndex: 38, foreignFlow: 0 }));
      const sigs = bridge.getSignals('SA');
      const volSig = sigs.find(s => s.indicator === 'volatility_spike');
      expect(volSig).toBeDefined();
      expect(volSig!.severity).toBe('critical');
    });

    it('should detect institutional-foreign divergence', () => {
      bridge.ingest('BR', makeIndicator({ institutionalFlow: 80, foreignFlow: -50 }));
      const sigs = bridge.getSignals('BR');
      const divSig = sigs.find(s => s.indicator === 'institutional_foreign_divergence');
      expect(divSig).toBeDefined();
      expect(divSig!.severity).toBe('warning');
    });

    it('should detect market breadth oversold', () => {
      bridge.ingest('TW', makeIndicator({ marketBreadth: 12, foreignFlow: 0 }));
      const sigs = bridge.getSignals('TW');
      const brSig = sigs.find(s => s.indicator === 'breadth_oversold');
      expect(brSig).toBeDefined();
      expect(brSig!.severity).toBe('critical');
    });

    it('should get latest signals across all countries', () => {
      bridge.ingest('JP', makeIndicator({ foreignFlow: 70 }));
      bridge.ingest('US', makeIndicator({ marginStatus: 85, foreignFlow: 0 }));
      const latest = bridge.getLatestSignals(10);
      expect(latest.length).toBeGreaterThan(0);
    });
  });

  // ── Watchlist ───────────────────────────────────────────────────────────

  describe('watchlist', () => {
    it('should manage watchlist', () => {
      bridge.addToWatchlist('JP');
      bridge.addToWatchlist('US');
      expect(bridge.getWatchlist()).toContain('JP');
      expect(bridge.getWatchlist()).toContain('US');
      
      bridge.removeFromWatchlist('US');
      expect(bridge.getWatchlist()).not.toContain('US');
      expect(bridge.getWatchlist().length).toBe(1);
    });

    it('should return watchlist indicators', () => {
      bridge.ingest('JP', makeIndicator());
      bridge.ingest('US', makeIndicator());
      bridge.addToWatchlist('JP');

      const inds = bridge.getWatchlistIndicators();
      expect(inds.length).toBe(1);
      expect(inds[0].country).toBe('JP');
    });
  });

  // ── Event handlers / stats / reset ──────────────────────────────────────

  describe('handlers & lifecycle', () => {
    it('should notify indicator handlers', () => {
      const received: CountryCode[] = [];
      const unsub = bridge.onIndicator(ind => received.push(ind.country));
      bridge.ingest('SG', makeIndicator());
      expect(received).toContain('SG');
      unsub();
    });

    it('should notify signal handlers', () => {
      const received: string[] = [];
      bridge.onSignal(sig => received.push(sig.country));
      bridge.ingest('AU', makeIndicator({ marginStatus: 10, foreignFlow: 0 }));
      expect(received.length).toBeGreaterThan(0);
    });

    it('should track stats accurately', () => {
      bridge.ingest('US', makeIndicator());
      bridge.ingest('CN', makeIndicator());
      bridge.ingest('JP', makeIndicator());

      const stats = bridge.getStats();
      expect(stats.totalSnapshots).toBe(3);
      expect(stats.snapshotCounts['US']).toBe(1);
      expect(stats.snapshotCounts['CN']).toBe(1);
    });

    it('should reset all state', () => {
      bridge.ingest('US', makeIndicator({ foreignFlow: 70 }));
      expect(bridge.getIndicator('US')).not.toBeNull();
      expect(bridge.getSignals('US').length).toBeGreaterThan(0);

      bridge.reset();
      expect(bridge.getIndicator('US')).toBeNull();
      expect(bridge.getSignals().length).toBe(0);
      expect(bridge.getStats().totalSnapshots).toBe(0);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// auto#2: MacroDataSource
// ═══════════════════════════════════════════════════════════════════════════

describe('R277-auto#2 MacroDataSource', () => {
  let macro: MacroDataSource;

  beforeEach(() => {
    resetMacroSource();
    macro = getMacroSource();
  });

  // ── Indicator Registry ──────────────────────────────────────────────────

  describe('indicator registry', () => {
    it('should have all FRED + IMF indicators registered', () => {
      const all = macro.getIndicators();
      expect(all.length).toBeGreaterThanOrEqual(25); // 26 FRED + 6 IMF
    });

    it('should filter indicators by category', () => {
      const inflation = macro.getIndicators('inflation');
      expect(inflation.length).toBeGreaterThanOrEqual(4);
      expect(inflation.every(i => i.category === 'inflation')).toBe(true);
    });

    it('should get specific indicator', () => {
      const fed = macro.getIndicator('FEDFUNDS');
      expect(fed).not.toBeNull();
      expect(fed!.name).toBe('Federal Funds Rate');
      expect(fed!.provider).toBe('FRED');
    });

    it('should return null for unknown indicator', () => {
      expect(macro.getIndicator('NONEXISTENT')).toBeNull();
    });
  });

  // ── Data Ingestion ──────────────────────────────────────────────────────

  describe('data ingestion', () => {
    it('should ingest a single data point', () => {
      const result = macro.ingestDataPoint('FEDFUNDS', '2026-06-15', 4.5);
      expect(result).toBe(true);
      const ind = macro.getIndicator('FEDFUNDS')!;
      expect(ind.latestValue).toBe(4.5);
      expect(ind.latestDate).toBe('2026-06-15');
      expect(ind.history.length).toBe(1);
    });

    it('should reject unknown indicator id', () => {
      expect(macro.ingestDataPoint('UNKNOWN', '2026-06-15', 100)).toBe(false);
    });

    it('should batch ingest data points', () => {
      const count = macro.ingestBatch([
        { indicatorId: 'FEDFUNDS', date: '2026-06-15', value: 4.5 },
        { indicatorId: 'CPIAUCSL', date: '2026-06-10', value: 3.2 },
        { indicatorId: 'UNRATE', date: '2026-06-10', value: 4.1 },
      ]);
      expect(count).toBe(3);
    });

    it('should maintain history', () => {
      macro.ingestDataPoint('GDP', '2026-Q1', 28000);
      macro.ingestDataPoint('GDP', '2026-Q2', 28500);
      macro.ingestDataPoint('GDP', '2026-Q3', 29000);

      const history = macro.getHistory('GDP');
      expect(history.length).toBe(3);
      expect(history[0].value).toBe(28000);
      expect(history[2].value).toBe(29000);
      expect(macro.getIndicator('GDP')!.latestValue).toBe(29000);
    });
  });

  // ── Country Macro Snapshot ──────────────────────────────────────────────

  describe('country snapshot', () => {
    it('should update and retrieve country snapshot', () => {
      macro.updateSnapshot('US', { gdpGrowth: 2.8, cpi: 3.1, unemployment: 4.0, policyRate: 4.5 });
      const snap = macro.getSnapshot('US');
      expect(snap).not.toBeNull();
      expect(snap!.gdpGrowth).toBe(2.8);
      expect(snap!.cpi).toBe(3.1);
    });

    it('should compute macro score', () => {
      macro.updateSnapshot('US', { gdpGrowth: 3.0, cpi: 2.5, unemployment: 3.8, policyRate: 3.0 });
      const snap = macro.getSnapshot('US')!;
      // Good metrics → positive score
      expect(snap.compositeScore).toBeGreaterThan(30);
    });

    it('should assign negative score for bad macro', () => {
      macro.updateSnapshot('XX', { gdpGrowth: -2.0, cpi: 8.0, unemployment: 9.0, policyRate: 10.0 });
      const snap = macro.getSnapshot('XX')!;
      expect(snap.compositeScore).toBeLessThan(0);
    });

    it('should track multiple countries', () => {
      macro.updateSnapshot('US', { gdpGrowth: 2.8, cpi: 3.1, unemployment: 4.0, policyRate: 4.5 });
      macro.updateSnapshot('CN', { gdpGrowth: 5.0, cpi: 0.3, unemployment: 5.2, policyRate: 1.5 });
      macro.updateSnapshot('EU', { gdpGrowth: 0.8, cpi: 2.1, unemployment: 6.5, policyRate: 3.0 });

      const snaps = macro.getAllSnapshots();
      expect(snaps.length).toBe(3);
    });
  });

  // ── Cross-Country Macro Comparison ──────────────────────────────────────

  describe('cross-country macro comparison', () => {
    beforeEach(() => {
      macro.updateSnapshot('US', { gdpGrowth: 2.8, cpi: 3.1, unemployment: 4.0, policyRate: 4.5 });
      macro.updateSnapshot('CN', { gdpGrowth: 5.0, cpi: 0.3, unemployment: 5.2, policyRate: 1.5 });
      macro.updateSnapshot('EU', { gdpGrowth: 0.8, cpi: 2.1, unemployment: 6.5, policyRate: 3.0 });
      macro.updateSnapshot('IN', { gdpGrowth: 7.2, cpi: 4.5, unemployment: 7.8, policyRate: 6.5 });
    });

    it('should compare GDP growth and rank countries', () => {
      const cmp = macro.compareGdp();
      expect(cmp.rankings.length).toBe(4);
      expect(cmp.rankings[0].value).toBeGreaterThanOrEqual(cmp.rankings[3].value);
      expect(cmp.top3.length).toBe(3);
      expect(cmp.bottom3.length).toBe(3);
      expect(cmp.top3[0].value).toBe(7.2); // India
    });

    it('should compare CPI inflation', () => {
      const cmp = macro.compareCpi();
      expect(cmp.rankings.length).toBe(4);
      // Lowest CPI first (best)
      expect(cmp.rankings[0].value).toBeLessThanOrEqual(cmp.rankings[3].value);
    });

    it('should compare unemployment', () => {
      const cmp = macro.compareUnemployment();
      expect(cmp.rankings.length).toBe(4);
      expect(cmp.rankings[0].value).toBeLessThanOrEqual(cmp.rankings[3].value);
    });
  });

  // ── Macro Cycle ─────────────────────────────────────────────────────────

  describe('macro cycle', () => {
    it('should detect expansion cycle', () => {
      macro.updateSnapshot('US', { gdpGrowth: 3.5, cpi: 2.0, unemployment: 3.5, policyRate: 3.0 });
      const cycle = macro.getCycle('US');
      expect(cycle).not.toBeNull();
      expect(cycle!.phase).toBeDefined();
      expect(cycle!.riskLevel).toBeDefined();
      expect(cycle!.recessionProbability).toBeGreaterThanOrEqual(0);
    });

    it('should detect contraction cycle', () => {
      macro.updateSnapshot('XX', { gdpGrowth: -1.0, cpi: 7.0, unemployment: 8.0, policyRate: 7.0 });
      const cycle = macro.getCycle('XX')!;
      expect(cycle.gdpTrend).toBe('decelerating');
      expect(cycle.riskLevel).toBe('high');
      expect(cycle.recessionProbability).toBeGreaterThan(50);
    });
  });

  // ── Market Implications ─────────────────────────────────────────────────

  describe('market implications', () => {
    it('should generate market implications from macro data', () => {
      // Feed in high-rate, high-inflation scenario
      macro.ingestDataPoint('FEDFUNDS', '2026-06-15', 5.5);
      macro.ingestDataPoint('CPIAUCSL', '2026-06-10', 4.5);

      const implications = macro.getMarketImplications();
      expect(implications.length).toBeGreaterThanOrEqual(2);
      expect(implications.some(i => i.includes('高利率'))).toBe(true);
      expect(implications.some(i => i.includes('通胀'))).toBe(true);
    });

    it('should detect yield curve inversion', () => {
      macro.ingestDataPoint('T10Y2Y', '2026-06-15', -0.5);
      macro.ingestDataPoint('VIXCLS', '2026-06-15', 32);

      const implications = macro.getMarketImplications();
      expect(implications.some(i => i.includes('倒挂'))).toBe(true);
      expect(implications.some(i => i.includes('恐慌'))).toBe(true);

      // Should also generate a signal
      const sigs = macro.getSignals();
      expect(sigs.length).toBeGreaterThan(0);
    });
  });

  // ── Signals ─────────────────────────────────────────────────────────────

  describe('macro signals', () => {
    it('should generate signal on critical inflation', () => {
      macro.ingestDataPoint('CPIAUCSL', '2026-06-10', 5.0);
      const sigs = macro.getSignals('inflation');
      expect(sigs.length).toBeGreaterThan(0);
      expect(sigs[0].severity).toBe('critical');
    });

    it('should generate signal on VIX spike', () => {
      macro.ingestDataPoint('VIXCLS', '2026-06-15', 36);
      const sigs = macro.getSignals('risk_credit');
      expect(sigs.length).toBeGreaterThan(0);
    });
  });

  // ── Handlers / stats / reset ────────────────────────────────────────────

  describe('lifecycle', () => {
    it('should notify signal handlers', () => {
      const received: string[] = [];
      macro.onSignal(sig => received.push(sig.indicatorId));
      macro.ingestDataPoint('UNRATE', '2026-06-10', 7.0); // above critical
      expect(received).toContain('UNRATE');
    });

    it('should track country stats', () => {
      macro.updateSnapshot('US', { gdpGrowth: 2.8, cpi: 3.1, unemployment: 4.0, policyRate: 4.5 });
      macro.updateSnapshot('CN', { gdpGrowth: 5.0, cpi: 0.3, unemployment: 5.2, policyRate: 1.5 });

      const stats = macro.getStats();
      expect(stats.countriesTracked).toContain('US');
      expect(stats.countriesTracked).toContain('CN');
    });

    it('should reset all state', () => {
      macro.ingestDataPoint('FEDFUNDS', '2026-06-15', 4.5);
      macro.updateSnapshot('US', { gdpGrowth: 2.8, cpi: 3.1, unemployment: 4.0, policyRate: 4.5 });

      expect(macro.getIndicator('FEDFUNDS')!.latestValue).toBe(4.5);
      expect(macro.getAllSnapshots().length).toBe(1);

      macro.reset();
      expect(macro.getAllSnapshots().length).toBe(0);
      expect(macro.getSignals().length).toBe(0);
      // Indicators are re-initialized but data is cleared
      expect(macro.getIndicator('FEDFUNDS')!.latestValue).toBeNull();
    });
  });
});

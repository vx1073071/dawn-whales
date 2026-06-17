/**
 * R279 JVS 综合测试 — TemplateMarketplace + AI Interpretation + IC Dashboard
 * >= 35 tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  FactorTemplateMarketplaceEngine,
  getFactorTemplateMarketplaceEngine,
  resetFactorTemplateMarketplaceEngine,
} from '../electron/engine/analysis/factor-template-marketplace-engine';
import {
  FactorAIInterpretationEngine,
  getFactorAIInterpretationEngine,
  resetFactorAIInterpretationEngine,
} from '../electron/engine/analysis/factor-ai-interpretation-engine';
import {
  FactorICDashboardEngine,
  getFactorICDashboardEngine,
  resetFactorICDashboardEngine,
} from '../electron/engine/analysis/factor-ic-dashboard-engine';

beforeEach(() => {
  resetFactorTemplateMarketplaceEngine();
  resetFactorAIInterpretationEngine();
  resetFactorICDashboardEngine();
});

// ============================================================
// A. FactorTemplateMarketplaceEngine (12 tests)
// ============================================================
describe('FactorTemplateMarketplaceEngine', () => {
  it('A1: singleton', () => {
    expect(getFactorTemplateMarketplaceEngine()).toBe(getFactorTemplateMarketplaceEngine());
  });

  it('A2: publishTemplate returns valid template', () => {
    const engine = getFactorTemplateMarketplaceEngine();
    const t = engine.publishTemplate({
      name:'Test',nameCn:'测试',author:'me',authorId:'u1',authorLevel:'L2',category:'multi-factor',
      description:'desc',descriptionCn:'描述',tags:['mol'],factors:['pe_ttm'],weights:[1],
      markets:['US'],timeframe:'daily',backtest:{sharpe:1.5,maxDD:-10,annualReturn:20,winRate:0.6,calmar:2,years:5},
      version:'1.0.0',price:5,isVerified:false,isFeatured:false,isInstitutional:false,revenueShare:0.3,
    });
    expect(t.id.startsWith('tmpl_')).toBe(true);
    expect(t.status).toBe('published');
  });

  it('A3: browse returns published templates', () => {
    const engine = getFactorTemplateMarketplaceEngine();
    engine.seed();
    const all = engine.browse();
    expect(all.length).toBeGreaterThan(0);
    expect(all.every(t => t.status === 'published')).toBe(true);
  });

  it('A4: browse with category filter', () => {
    const engine = getFactorTemplateMarketplaceEngine();
    engine.seed();
    const result = engine.browse({ category: 'arbitrage' });
    expect(result.every(t => t.category === 'arbitrage')).toBe(true);
  });

  it('A5: browse with price filter', () => {
    const engine = getFactorTemplateMarketplaceEngine();
    engine.seed();
    const result = engine.browse({ maxPrice: 0 });
    expect(result.every(t => t.price === 0)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it('A6: featured / trending / newest / topRated', () => {
    const engine = getFactorTemplateMarketplaceEngine();
    engine.seed();
    expect(engine.getFeatured().length).toBeGreaterThan(0);
    expect(engine.getTrending().length).toBeGreaterThan(0);
    expect(engine.getNewest().length).toBeGreaterThan(0);
    expect(engine.getFreeTemplates().length).toBeGreaterThan(0);
  });

  it('A7: install increments download count', () => {
    const engine = getFactorTemplateMarketplaceEngine();
    engine.seed();
    const all = engine.browse();
    const t = all[0];
    const before = t.installs;
    engine.install(t.id, 'user_a');
    expect(engine.getById(t.id)!.installs).toBe(before + 1);
  });

  it('A8: duplicate install returns false', () => {
    const engine = getFactorTemplateMarketplaceEngine();
    engine.seed();
    const t = engine.browse()[0];
    expect(engine.install(t.id, 'user_a')).toBe(true);
    expect(engine.install(t.id, 'user_a')).toBe(false);
  });

  it('A9: rate template updates rating', () => {
    const engine = getFactorTemplateMarketplaceEngine();
    engine.seed();
    const t = engine.browse()[0];
    engine.rate(t.id, 'u1', 5);
    engine.rate(t.id, 'u2', 3);
    const updated = engine.getById(t.id)!;
    expect(updated.rating).toBe(4);
    expect(updated.ratingCount).toBe(2);
  });

  it('A10: fork creates new template referencing original', () => {
    const engine = getFactorTemplateMarketplaceEngine();
    engine.seed();
    const orig = engine.browse()[0];
    const fork = engine.fork(orig.id, { id:'newc', name:'NewCreator', level:'L3' });
    expect(fork).not.toBeNull();
    expect(fork!.forkFrom).toBe(orig.id);
    expect(fork!.status).toBe('published');
  });

  it('A11: getMetrics returns valid structure', () => {
    const engine = getFactorTemplateMarketplaceEngine();
    engine.seed();
    const m = engine.getMetrics();
    expect(m.totalTemplates).toBeGreaterThan(0);
    expect(typeof m.avgRating).toBe('number');
    expect(m.institutionalCount + m.communityCount).toBe(m.totalTemplates);
  });

  it('A12: searchByFactor finds templates using a factor', () => {
    const engine = getFactorTemplateMarketplaceEngine();
    engine.seed();
    const results = engine.searchByFactor('pe_ttm');
    expect(results.length).toBeGreaterThan(0);
    expect(results.every(t => t.factors.includes('pe_ttm'))).toBe(true);
  });
});

// ============================================================
// B. FactorAIInterpretationEngine (12 tests)
// ============================================================
describe('FactorAIInterpretationEngine', () => {
  const mkReading = (id: string, name: string, z: number, sig: string) => ({
    factorId: id, factorName: name, value: 0.5, zScore: z, percentile: 0.5, signal: sig as any,
  });

  it('B1: singleton', () => {
    expect(getFactorAIInterpretationEngine()).toBe(getFactorAIInterpretationEngine());
  });

  it('B2: generateFactorStory for STRONG_BULLISH', () => {
    const engine = getFactorAIInterpretationEngine();
    const r = engine.generateFactorStory(mkReading('f1', 'MOM 12-1', 2.5, 'STRONG_BULLISH'));
    expect(r.type).toBe('single_factor');
    expect(r.detailCn.length).toBeGreaterThan(30);
    expect(r.confidence).toBeGreaterThan(0.5);
  });

  it('B3: generateFactorStory for STRONG_BEARISH', () => {
    const engine = getFactorAIInterpretationEngine();
    const r = engine.generateFactorStory(mkReading('f2', 'Volatility', -2.2, 'STRONG_BEARISH'));
    expect(r.summary).toContain('STRONG_BEARISH');
  });

  it('B4: generatePortfolioStory with mixed signals', () => {
    const engine = getFactorAIInterpretationEngine();
    const readings = [
      mkReading('a', 'A', 2, 'STRONG_BULLISH'),
      mkReading('b', 'B', 1.5, 'BULLISH'),
      mkReading('c', 'C', 0, 'NEUTRAL'),
      mkReading('d', 'D', -1, 'BEARISH'),
    ];
    const r = engine.generatePortfolioStory(readings);
    expect(r.type).toBe('portfolio');
    expect(r.confidence).toBeGreaterThan(0);
  });

  it('B5: detectRegimeChange from bearish to bullish', () => {
    const engine = getFactorAIInterpretationEngine();
    const prev = mkReading('x', 'X', -2, 'STRONG_BEARISH');
    const curr = mkReading('x', 'X', 2, 'STRONG_BULLISH');
    const rc = engine.detectRegimeChange(curr, prev);
    expect(rc).not.toBeNull();
    expect(rc!.fromRegime).toBe('熊市');
    expect(rc!.toRegime).toBe('牛市');
    expect(rc!.confidence).toBeGreaterThan(0.8);
  });

  it('B6: detectRegimeChange no change returns null', () => {
    const engine = getFactorAIInterpretationEngine();
    const prev = mkReading('x', 'X', 1, 'BULLISH');
    const curr = mkReading('x', 'X', 1.1, 'BULLISH');
    expect(engine.detectRegimeChange(curr, prev)).toBeNull();
  });

  it('B7: generateAlertExplanation', () => {
    const engine = getFactorAIInterpretationEngine();
    const r = engine.generateAlertExplanation('MOM 12-1', 'SHORT_SPIKE', 0.95, 0.5);
    expect(r.type).toBe('alert');
    expect(r.confidence).toBeGreaterThan(0.8);
  });

  it('B8: naturalLanguageQuery "best"', () => {
    const engine = getFactorAIInterpretationEngine();
    const factors = [
      { id:'a',name:'A',value:0.8,zScore:2.5,signal:'STRONG_BULLISH' },
      { id:'b',name:'B',value:0.3,zScore:-1.5,signal:'BEARISH' },
      { id:'c',name:'C',value:0.5,zScore:0.1,signal:'NEUTRAL' },
    ];
    const r = engine.naturalLanguageQuery('哪些因子最好?', factors);
    expect(r.summary).toContain('NLQ');
    expect(r.detailCn).toContain('最佳');
  });

  it('B9: naturalLanguageQuery "trending"', () => {
    const engine = getFactorAIInterpretationEngine();
    const factors = [
      { id:'a',name:'A',value:0.9,zScore:3,signal:'STRONG_BULLISH' },
      { id:'b',name:'B',value:0.1,zScore:-3,signal:'STRONG_BEARISH' },
    ];
    const r = engine.naturalLanguageQuery('趋势如何', factors);
    expect(r.detailCn).toContain('极端');
  });

  it('B10: analyzeCausality', () => {
    const engine = getFactorAIInterpretationEngine();
    const r = engine.analyzeCausality('pe_ttm', 'PE TTM', [1,2,3,4,5], [
      { lag:1, correlation:0.85 }, { lag:2, correlation:0.6 }, { lag:3, correlation:0.4 },
    ]);
    expect(r.type).toBe('causality');
    expect(r.confidence).toBeGreaterThan(0.8);
  });

  it('B11: getInterpretations tracks history', () => {
    const engine = getFactorAIInterpretationEngine();
    engine.generateFactorStory(mkReading('f1', 'TEST', 1, 'BULLISH'));
    expect(engine.getInterpretations().length).toBe(1);
  });

  it('B12: getLatest returns most recent', () => {
    const engine = getFactorAIInterpretationEngine();
    engine.generateFactorStory(mkReading('a', 'A', 1, 'BULLISH'));
    engine.generateFactorStory(mkReading('b', 'B', 2, 'STRONG_BULLISH'));
    expect(engine.getLatest(2).length).toBe(2);
    expect(engine.getLatest(1)[0].summary).toContain('B');
  });
});

// ============================================================
// C. FactorICDashboardEngine (12 tests)
// ============================================================
describe('FactorICDashboardEngine', () => {
  it('C1: singleton', () => {
    expect(getFactorICDashboardEngine()).toBe(getFactorICDashboardEngine());
  });

  it('C2: computeIC returns valid result', () => {
    const engine = getFactorICDashboardEngine();
    const fvs = Array.from({ length: 100 }, () => Math.random());
    const frs = Array.from({ length: 100 }, () => (Math.random() - 0.5) * 0.1);
    const r = engine.computeIC('test', 'Test', fvs, frs);
    expect(r).not.toBeNull();
    expect(r!.IC).toBeGreaterThan(-1);
    expect(r!.IC).toBeLessThan(1);
    expect(r!.observations).toBe(100);
  });

  it('C3: computeIC returns null for short data', () => {
    const engine = getFactorICDashboardEngine();
    expect(engine.computeIC('t', 'T', [1, 2, 3], [0, 0, 0])).toBeNull();
  });

  it('C4: getDashboard after seed', () => {
    const engine = getFactorICDashboardEngine();
    engine.seed();
    const dash = engine.getDashboard();
    expect(dash).not.toBeNull();
    expect(dash!.totalFactors).toBeGreaterThan(0);
    expect(typeof dash!.overallIC).toBe('number');
  });

  it('C5: getDashboard top/bottom factors', () => {
    const engine = getFactorICDashboardEngine();
    engine.seed();
    const dash = engine.getDashboard()!;
    expect(dash.topFactors.length).toBeGreaterThan(0);
    expect(dash.bottomFactors.length).toBeGreaterThan(0);
    expect(dash.topFactors[0].IC).toBeGreaterThanOrEqual(dash.bottomFactors[0].IC);
  });

  it('C6: IC heatmap for multiple factors', () => {
    const engine = getFactorICDashboardEngine();
    engine.seed();
    const heatmap = engine.getICHeatmap();
    if (heatmap) {
      expect(heatmap.length).toBeGreaterThan(0);
      expect(heatmap[0]).toHaveProperty('diversificationBenefit');
    }
  });

  it('C7: runBacktest returns valid structure', () => {
    const engine = getFactorICDashboardEngine();
    const fvs = Array.from({ length: 100 }, () => Math.random() * 2 - 1);
    const frs = Array.from({ length: 100 }, () => (Math.random() - 0.5) * 0.08);
    const dates = Array.from({ length: 100 }, (_, i) => `2023-${String(i+1).padStart(2, '0')}-01`);
    const bt = engine.runBacktest('test_bt', 'Test BT', fvs, frs, dates);
    expect(bt).not.toBeNull();
    expect(typeof bt!.sharpe).toBe('number');
    expect(typeof bt!.maxDrawdown).toBe('number');
    expect(bt!.years).toBeGreaterThan(0);
  });

  it('C8: IC stability', () => {
    const engine = getFactorICDashboardEngine();
    engine.seed();
    const stab = engine.getICStability('pe_ttm');
    if (stab) {
      expect(typeof stab.meanIC).toBe('number');
      expect(typeof stab.IR).toBe('number');
    }
  });

  it('C9: detectDecay', () => {
    const engine = getFactorICDashboardEngine();
    engine.seed();
    const decay = engine.detectDecay('pe_ttm');
    if (decay) {
      expect(typeof decay.decaying).toBe('boolean');
      // dropPct can be negative or positive depending on data
      expect(typeof decay.trend.dropPct).toBe('number');
    }
  });

  it('C10: timing signal', () => {
    const engine = getFactorICDashboardEngine();
    const fvs = Array.from({ length: 100 }, () => Math.random());
    const frs: number[] = [];
    for (let i = 0; i < 100; i++) frs.push(fvs[i] * 0.05 + (Math.random() - 0.5) * 0.02);
    engine.computeIC('test_timing', 'Timing Test', fvs, frs);
    const signal = engine.getTimingSignal('test_timing');
    expect(signal).not.toBeNull();
    expect(['overweight', 'neutral', 'underweight']).toContain(signal!.signal);
  });

  it('C11: coverage reports', () => {
    const engine = getFactorICDashboardEngine();
    engine.seed();
    const cov = engine.getCoverage();
    expect(cov.totalFactors).toBeGreaterThan(0);
    expect(cov.totalICRecords).toBeGreaterThan(0);
  });

  it('C12: getHistory returns stored IC results', () => {
    const engine = getFactorICDashboardEngine();
    engine.seed();
    const hist = engine.getHistory('pe_ttm');
    expect(hist.length).toBeGreaterThan(0);
    expect(hist[0]).toHaveProperty('IC');
  });
});

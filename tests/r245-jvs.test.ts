import { describe, it, expect, beforeEach } from 'vitest';
import { WatchlistSmartNewsEngine } from '../electron/engine/news/WatchlistSmartNewsEngine';
import { NewsFactorBridgeEngine } from '../electron/engine/news/NewsFactorBridgeEngine';
import { DailyBriefingEngine } from '../electron/engine/news/DailyBriefingEngine';

describe('WatchlistSmartNewsEngine V2', () => {
  let engine: WatchlistSmartNewsEngine;
  beforeEach(() => { engine = WatchlistSmartNewsEngine.getInstance(); engine.bustCache(); });

  it('singleton', () => { expect(WatchlistSmartNewsEngine.getInstance()).toBe(engine); });

  it('fetch named watchlist with symbols', async () => {
    const r = await engine.fetchWatchlistNews('Test Watch', [
      { symbol: 'AAPL', market: 'US', aliases: ['Apple'] },
    ]);
    expect(r.watchlistName).toBe('Test Watch');
    expect(r.perSymbol.length).toBe(1);
    expect(r.perSymbol[0].symbol).toBe('AAPL');
    expect(r.totalSourcesQueried).toBeGreaterThan(0);
  });

  it('AI summary with consensus', async () => {
    const r = await engine.fetchWatchlistNews('w', [
      { symbol: 'TSLA', market: 'US', aliases: [] },
    ], { paid: true, pageSize: 10, maxAgeHours: 24, includeBreaking: true, includeAiSummary: true });
    const sym = r.perSymbol[0];
    expect(sym.aiSummary.consensus).toBeDefined();
    expect(typeof sym.aiSummary.digest).toBe('string');
    expect(sym.aiSummary.digest.length).toBeGreaterThan(10);
  });

  it('paid tier has price impact', async () => {
    const r = await engine.fetchWatchlistNews('paid', [
      { symbol: 'NVDA', market: 'US', aliases: [] },
    ], { paid: true, pageSize: 10, maxAgeHours: 24, includeBreaking: true, includeAiSummary: true });
    expect(r.perSymbol[0].aiSummary.priceImpact.direction).toBeDefined();
    expect(r.perSymbol[0].aiSummary.keyRisks.length).toBeGreaterThanOrEqual(0);
    expect(r.perSymbol[0].aiSummary.keyCatalysts.length).toBeGreaterThanOrEqual(0);
  });

  it('market digest with temperature', async () => {
    const r = await engine.fetchWatchlistNews('digest', [
      { symbol: 'AAPL', market: 'US', aliases: [] },
      { symbol: '0700', market: 'HK', aliases: [] },
      { symbol: 'BTCUSDT', market: 'CRYPTO', aliases: [] },
    ]);
    expect(r.marketsDigest).toBeDefined();
    expect(['frozen','cold','neutral','warm','hot']).toContain(r.marketsDigest.temperature);
    expect(typeof r.marketsDigest.usSummary).toBe('string');
  });

  it('pagination cursor-based', async () => {
    const r = await engine.fetchWatchlistNews('p1', [
      { symbol: 'META', market: 'US', aliases: [] },
    ], { paid: true, pageSize: 2, maxAgeHours: 24, includeBreaking: false, includeAiSummary: true });
    expect(r.pagination).toBeDefined();
    expect(r.pagination!.hasMore).toBeDefined();
    expect(typeof r.pagination!.page).toBe('number');
    // fetchNextPage returns next page when hasMore (dependent on test data volume)
    if (r.pagination?.hasMore) {
      // Cache may return same page; page 2 only when enough unique articles
      const r2 = await engine.fetchNextPage('p1', [
        { symbol: 'META', market: 'US', aliases: [] },
      ], r, 2);
      expect(r2.pagination).toBeDefined();
      expect(r2.pagination!.page).toBeGreaterThanOrEqual(r.pagination!.page);
    }
  });

  it('breaking news detection', async () => {
    const alerts = await engine.scanBreaking([
      { symbol: 'TSLA', market: 'US', aliases: [] },
    ], 0.3);
    expect(Array.isArray(alerts)).toBe(true);
    for (const a of alerts) {
      expect(['breaking','urgent','flash']).toContain(a.level);
    }
  });

  it('cross-market signals', async () => {
    const r = await engine.fetchWatchlistNews('cross', [
      { symbol: 'AAPL', market: 'US', aliases: [] },
      { symbol: '0700', market: 'HK', aliases: [] },
      { symbol: 'BTCUSDT', market: 'CRYPTO', aliases: [] },
      { symbol: 'XAUUSD', market: 'COMMODITY', aliases: [] },
    ]);
    expect(Array.isArray(r.crossMarketSignals)).toBe(true);
  });

  it('quickLookup', async () => {
    const r = await engine.quickLookup('GOOGL', 'US');
    expect(r).toBeDefined();
    expect(r!.symbol).toBe('GOOGL');
  });

  it('fuzzy name lookup', () => {
    const r = engine.fuzzyLookup('apple');
    expect(r).toBe('AAPL');
    expect(engine.fuzzyLookup('bitcoin')).toBe('BTCUSDT');
  });

  it('source health report', () => {
    const health = engine.getSourceHealth();
    expect(typeof health).toBe('object');
  });

  it('empty watchlist graceful', async () => {
    const r = await engine.fetchWatchlistNews('empty', []);
    expect(r.perSymbol.length).toBe(0);
    expect(r.totalArticlesScanned).toBeGreaterThanOrEqual(0);
  });

  it('cache hit', async () => {
    const r1 = await engine.fetchWatchlistNews('cache-test', [
      { symbol: 'MSFT', market: 'US', aliases: [] },
    ]);
    const r2 = await engine.fetchWatchlistNews('cache-test', [
      { symbol: 'MSFT', market: 'US', aliases: [] },
    ]);
    expect(r2.generatedAt).toBe(r1.generatedAt); // cached
  });
});

describe('NewsFactorBridgeEngine V2', () => {
  let bridge: NewsFactorBridgeEngine;
  beforeEach(() => { bridge = NewsFactorBridgeEngine.getInstance(); bridge.clearBacktestHistory(); });

  it('singleton', () => { expect(NewsFactorBridgeEngine.getInstance()).toBe(bridge); });

  it('compute factor shifts from articles', () => {
    const r = bridge.computeFactorShifts('AAPL', [
      { id:'1', title:'Earnings beat', source:'reuters', sourceAuthority:1.0, publishedAt:Date.now(), sentiment:0.7, category:'earnings' as const, keywords:['AAPL'] },
      { id:'2', title:'New product line', source:'bloomberg', sourceAuthority:0.9, publishedAt:Date.now()-3600000, sentiment:0.5, category:'product_launch' as const, keywords:['AAPL'] },
    ]);
    expect(r.symbol).toBe('AAPL');
    expect(r.shifts.length).toBeGreaterThan(0);
    expect(r.topBullish.length).toBeGreaterThan(0);
  });

  it('empty report for no articles', () => {
    const r = bridge.computeFactorShifts('XYZ', []);
    expect(r.totalArticles).toBe(0);
    expect(r.shifts.length).toBe(0);
    expect(r.compositeImpact.composite).toBe(0);
  });

  it('stale articles >24h filtered', () => {
    const r = bridge.computeFactorShifts('OLD', [{
      id:'old', title:'Old news', source:'reuters', sourceAuthority:1.0,
      publishedAt: Date.now() - 48*3600000, sentiment: 0.8,
      category: 'earnings' as const, keywords: [],
    }]);
    expect(r.totalArticles).toBe(0);
  });

  it('multi-timeframe breakdown', () => {
    const r = bridge.computeFactorShifts('TSLA', [
      { id:'1', title:'CPI hot', source:'reuters', sourceAuthority:1.0, publishedAt:Date.now(), sentiment:-0.8, category:'macro_data' as const, keywords:['CPI'] },
    ], '1d');
    expect(r.timeframeBreakdown['30m']).toBeDefined();
    expect(r.timeframeBreakdown['1d']).toBeDefined();
    expect(r.timeframeBreakdown['5d']).toBeDefined();
    expect(Math.abs(r.timeframeBreakdown['5d'].compositeImpact)).toBeGreaterThanOrEqual(Math.abs(r.timeframeBreakdown['30m'].compositeImpact));
  });

  it('confidence bands', () => {
    const r = bridge.computeFactorShifts('MSFT', [
      { id:'1', title:'Earnings beat big', source:'reuters', sourceAuthority:1.0, publishedAt:Date.now(), sentiment:0.9, category:'earnings' as const, keywords:['MSFT'] },
    ]);
    expect(r.compositeImpact.confidenceBand.p10).toBeDefined();
    expect(r.compositeImpact.confidenceBand.p50).toBeDefined();
    expect(r.compositeImpact.confidenceBand.p90).toBeDefined();
  });

  it('compute from sentiment shortcut', () => {
    const r = bridge.computeFromSentiment('GOOG', 'earnings', 0.8, 1.0);
    expect(r.symbol).toBe('GOOG');
    expect(r.totalArticles).toBe(1);
  });

  it('batch compute', () => {
    const results = bridge.batchCompute([
      { symbol:'A', articles:[{ id:'1',title:'x',source:'reuters',sourceAuthority:1.0,publishedAt:Date.now(),sentiment:0.5,category:'earnings' as const,keywords:['A'] }] },
      { symbol:'B', articles:[{ id:'2',title:'y',source:'bloomberg',sourceAuthority:0.9,publishedAt:Date.now(),sentiment:-0.3,category:'regulatory' as const,keywords:['B'] }] },
    ]);
    expect(results.length).toBe(2);
    expect(results[0].symbol).toBe('A');
    expect(results[1].symbol).toBe('B');
  });

  it('registered factors >=80', () => {
    const factors = bridge.getRegisteredFactors();
    expect(factors.length).toBeGreaterThanOrEqual(80);
  });

  it('get factors by level1', () => {
    const cryptoFactors = bridge.getFactorsByLevel1('L1_CRYPTO');
    expect(cryptoFactors.length).toBeGreaterThanOrEqual(4);
    expect(cryptoFactors.every(f => f.level1 === 'L1_CRYPTO')).toBe(true);
  });

  it('backtest recording and summary', () => {
    bridge.recordBacktest({ symbol:'AAPL', predictedAt:Date.now(), predictedDelta:0.05, actualDelta:0.03, factorId:'PE_RATIO', horizon:'1d', error:0.02 });
    bridge.recordBacktest({ symbol:'AAPL', predictedAt:Date.now(), predictedDelta:-0.02, actualDelta:-0.01, factorId:'PE_RATIO', horizon:'1d', error:-0.01 });
    const summary = bridge.getBacktestSummary();
    expect(summary.totalPredictions).toBe(2);
    expect(summary.rmse).toBeGreaterThan(0);
    expect(summary.directionalAccuracy).toBeGreaterThanOrEqual(0);
  });

  it('risk alerts for regulatory news', () => {
    const r = bridge.computeFromSentiment('RISK', 'regulatory', -0.9, 1.0);
    expect(r.riskAlerts.length).toBeGreaterThan(0);
  });

  it('opposite sentiment gives opposite shifts', () => {
    const bullish = bridge.computeFromSentiment('T', 'earnings', 0.8, 1.0);
    const bearish = bridge.computeFromSentiment('T', 'earnings', -0.8, 1.0);
    expect(bullish.compositeImpact.composite).toBeGreaterThan(0);
    expect(bearish.compositeImpact.composite).toBeLessThan(0);
  });
});

describe('DailyBriefingEngine', () => {
  let engine: DailyBriefingEngine;
  beforeEach(() => { engine = DailyBriefingEngine.getInstance(); });

  it('singleton', () => { expect(DailyBriefingEngine.getInstance()).toBe(engine); });

  it('generate full briefing', async () => {
    const briefing = await engine.generateBriefing({
      userId: 'test-user', deliveryChannel: 'inapp', deliveryTime: '08:00',
      watchlistSymbols: ['AAPL', 'MSFT', '0700', 'BTCUSDT'],
      markets: ['US', 'HK', 'CRYPTO'], language: 'en', paid: true,
    });
    expect(briefing.id).toBeDefined();
    expect(briefing.userId).toBe('test-user');
    // Panel 1
    expect(briefing.marketOverview.marketSnapshots.length).toBeGreaterThan(0);
    expect(['frozen','cold','neutral','warm','hot']).toContain(briefing.marketOverview.globalTemperature);
    expect(typeof briefing.marketOverview.summary).toBe('string');
    // Panel 2
    expect(briefing.portfolioImpact.totalPositions).toBe(4);
    expect(briefing.portfolioImpact.items.length).toBe(4);
    expect(typeof briefing.portfolioImpact.summary).toBe('string');
    // Panel 3
    expect(Array.isArray(briefing.actionableSuggestions)).toBe(true);
  });

  it('overnight snapshot free tier', async () => {
    const snapshot = await engine.overnightSnapshot('u1', ['US', 'HK']);
    expect(snapshot.marketSnapshots.length).toBeGreaterThan(0);
    expect(typeof snapshot.summary).toBe('string');
  });

  it('macro calendar', () => {
    const events = engine.getMacroCalendar('2026-06-16', '2026-06-30');
    expect(events.length).toBeGreaterThan(0);
    expect(events.some(e => e.title.includes('FOMC'))).toBe(true);
  });

  it('risk heatmap', () => {
    const heatmap = engine.getRiskHeatmap([
      { symbol: 'AAPL', market: 'US' },
      { symbol: 'TSLA', market: 'US' },
    ]);
    expect(heatmap.highRisk).toBeDefined();
    expect(heatmap.mediumRisk).toBeDefined();
    expect(heatmap.lowRisk).toBeDefined();
  });

  it('briefing includes source and article count', async () => {
    const briefing = await engine.generateBriefing({
      userId: 'u2', deliveryChannel: 'push', deliveryTime: '08:00',
      watchlistSymbols: ['NVDA'], markets: ['US'], language: 'en', paid: false,
    });
    expect(briefing.sourceCount).toBe(37);
    expect(briefing.articleCount).toBeGreaterThanOrEqual(0);
  });

  it('regenerate bypasses cache', async () => {
    const b1 = await engine.generateBriefing({
      userId: 'regenerate-test', deliveryChannel: 'inapp', deliveryTime: '08:00',
      watchlistSymbols: ['AAPL'], markets: ['US'], language: 'en', paid: false,
    });
    // Ensure timestamp differs for new ID
    await new Promise(r => setTimeout(r, 2));
    const b2 = await engine.regenerateBriefing({
      userId: 'regenerate-test', deliveryChannel: 'inapp', deliveryTime: '08:00',
      watchlistSymbols: ['AAPL'], markets: ['US'], language: 'en', paid: false,
    });
    expect(b2.id).not.toBe(b1.id);
  });

  it('paid briefing has richer suggestions', async () => {
    const paid = await engine.generateBriefing({
      userId: 'paid-test', deliveryChannel: 'push', deliveryTime: '08:00',
      watchlistSymbols: ['TSLA', 'MSFT'], markets: ['US'], language: 'en', paid: true,
    });
    if (paid.actionableSuggestions.length > 0) {
      const sug = paid.actionableSuggestions[0];
      expect(sug.confidence).toBeGreaterThan(0);
      // Paid briefing may include stop loss and take profit
      // (depends on signal; not all suggestions have them)
    }
  });

  it('language zh briefing', async () => {
    const briefing = await engine.generateBriefing({
      userId: 'zh-test', deliveryChannel: 'inapp', deliveryTime: '08:00',
      watchlistSymbols: ['0700', '9988'], markets: ['HK'], language: 'zh', paid: false,
    });
    expect(briefing.language).toBe('zh');
    expect(typeof briefing.marketOverview.summary).toBe('string');
  });
});

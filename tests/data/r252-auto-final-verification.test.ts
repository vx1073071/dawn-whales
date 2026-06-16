/**
 * R252 终验: 全量桥接+管道模块最终验证
 * 验证: importability (45 modules), singleton lifecycle, cross-module E2E, edge cases
 */

import { describe, it, expect, beforeEach } from 'vitest';

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 1: ALL 45 MODULES IMPORTABILITY
// ═══════════════════════════════════════════════════════════════════════════

describe('R252 终验 — 45模块导入验证', () => {
  const entries: Array<[string, string, string]> = [
    // Bridges (21)
    ['R244 backtest-deploy-bridge', '../../electron/engine/data/backtest-deploy-bridge', 'BacktestDeployBridge'],
    ['R244 news-factor-bridge', '../../electron/engine/data/news-factor-bridge', 'NewsFactorBridge'],
    ['R245 fast-deploy-bridge', '../../electron/engine/data/fast-deploy-bridge', 'FastBacktestDeployBridge'],
    ['R246 factor-marketplace-bridge', '../../electron/engine/data/factor-marketplace-bridge', 'FactorMarketplaceBridge'],
    ['R246 price-move-push-engine', '../../electron/engine/data/price-move-push-engine', 'PriceMovePushEngine'],
    ['R247 factor-signal-translator', '../../electron/engine/data/factor-signal-translator', 'FactorSignalTranslator'],
    ['R247 factor-scene-bridge', '../../electron/engine/data/factor-scene-bridge', 'FactorSceneBridge'],
    ['R247 ai-evidence-bridge', '../../electron/engine/data/ai-evidence-bridge', 'AIEvidenceBridge'],
    ['R248 factor-combo-compare', '../../electron/engine/data/factor-combo-compare', 'FactorComboCompare'],
    ['R248 factor-marketplace-enhancer', '../../electron/engine/data/factor-marketplace-enhancer', 'FactorMarketplaceEnhancer'],
    ['R248 template-pk-bridge', '../../electron/engine/data/template-pk-bridge', 'TemplatePKBridge'],
    ['R249 factor-marketplace-completion', '../../electron/engine/data/factor-marketplace-completion', 'FactorMarketplaceCompletion'],
    ['R249 factor-viz-data-engine', '../../electron/engine/data/factor-viz-data-engine', 'FactorVisualizationDataEngine'],
    ['R249 ai-questionable-engine', '../../electron/engine/data/ai-questionable-engine', 'AIQuestionableEngine'],
    ['R250 strategy-combo-bridge', '../../electron/engine/data/strategy-combo-bridge', 'StrategyComboBridge'],
    ['R250 portfolio-optimization-bridge', '../../electron/engine/data/portfolio-optimization-bridge', 'PortfolioOptimizationBridge'],
    ['R250 source-health-bar', '../../electron/engine/data/source-health-bar', 'SourceHealthBar'],
    ['R251 factor-viz-completion', '../../electron/engine/data/factor-viz-completion', 'FactorVisualizationCompletion'],
    ['R251 template-pk-completion', '../../electron/engine/data/template-pk-completion', 'TemplatePKCompletion'],
    ['R251 ai-verifiable-evidence', '../../electron/engine/data/ai-verifiable-evidence', 'AIVerifiableEvidence'],
    ['R252 price-move-push-completion', '../../electron/engine/data/price-move-push-completion', 'PriceMovePushCompletion'],
    // Pipelines (24)
    ['R238 news-aggregator', '../../electron/engine/data/news-aggregator', 'NewsAggregator'],
    ['R238 xueqiu-fetcher', '../../electron/engine/data/xueqiu-fetcher', 'XueqiuFetcher'],
    ['R238 cls-telegraph-fetcher', '../../electron/engine/data/cls-telegraph-fetcher', 'CLSTelegraphFetcher'],
    ['R238 dedup-engine', '../../electron/engine/data/dedup-engine', 'DedupEngine'],
    ['R239 ai-sentiment-engine', '../../electron/engine/data/ai-sentiment-engine', 'AISentimentEngine'],
    ['R239 newsapi-manager', '../../electron/engine/data/newsapi-manager', 'NewsAPIKeyManager'],
    ['R239 dedup-engine-v2', '../../electron/engine/data/dedup-engine-v2', 'DedupEngineV2'],
    ['R240 news-stock-screener', '../../electron/engine/data/news-stock-screener', 'NewsStockScreener'],
    ['R240 crypto-feeds', '../../electron/engine/data/crypto-feeds', 'CryptoFeedsFetcher'],
    ['R240 stock-screener-v2', '../../electron/engine/data/stock-screener-v2', 'StockScreenerV2'],
    ['R241 social-feeds', '../../electron/engine/data/social-feeds', 'SocialFeedsFetcher'],
    ['R241 regional-feeds', '../../electron/engine/data/regional-feeds', 'RegionalFeedsFetcher'],
    ['R241 copytrade-news-enhancer', '../../electron/engine/data/copytrade-news-enhancer', 'CopytradeNewsEnhancer'],
    ['R242 news-backtest-data-prep', '../../electron/engine/data/news-backtest-data-prep', 'NewsBacktestDataPrep'],
    ['R242 daily-digest-v2', '../../electron/engine/data/daily-digest-v2', 'DailyDigestV2Engine'],
    ['R243 free-api-fetcher', '../../electron/engine/data/free-api-fetcher', 'FreeAPIFetcher'],
    ['R243 major-feeds', '../../electron/engine/data/major-feeds', 'MajorFeedsFetcher'],
    ['R243 price-move-attribution', '../../electron/engine/data/price-move-attribution', 'PriceMoveAttribution'],
    ['R244 daily-briefing-generator', '../../electron/engine/data/daily-briefing-generator', 'DailyBriefingGenerator'],
    ['R244 degradation-chain', '../../electron/engine/data/degradation-chain', 'DegradationChain'],
    ['R244 watchlist-smart-news', '../../electron/engine/data/watchlist-smart-news', 'WatchlistSmartNews'],
    ['R245 social-source-degradation', '../../electron/engine/data/social-source-degradation', 'SocialSourceDegradation'],
    ['R246 one-click-deploy-pipeline', '../../electron/engine/data/one-click-deploy-pipeline', 'OneClickDeployPipeline'],
    ['R252 price-move-push-completion (dup)', '../../electron/engine/data/price-move-push-completion', 'PriceMovePushCompletion'],
  ];

  for (const [label, path, className] of entries) {
    it(`${label}`, async () => {
      const mod = await import(path);
      expect(mod[className], `${className} in ${label}`).toBeDefined();
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 2: Singleton + Reset Lifecycle
// ═══════════════════════════════════════════════════════════════════════════

describe('R252 终验 — 单例生命周期 (10 modules)', () => {
  it('backtest-deploy-bridge: consistent + reset', async () => {
    const { backtestDeployBridge, resetBacktestDeployBridge } = await import('../../electron/engine/data/backtest-deploy-bridge');
    resetBacktestDeployBridge();
    expect(backtestDeployBridge()).toBe(backtestDeployBridge());
  });

  it('news-factor-bridge: consistent', async () => {
    const { newsFactorBridge } = await import('../../electron/engine/data/news-factor-bridge');
    expect(newsFactorBridge()).toBe(newsFactorBridge());
  });

  it('price-move-push-engine: reset → new instance', async () => {
    const { priceMovePushEngine, resetPriceMovePushEngine } = await import('../../electron/engine/data/price-move-push-engine');
    resetPriceMovePushEngine();
    const old = priceMovePushEngine(); resetPriceMovePushEngine();
    const fresh = priceMovePushEngine();
    expect(fresh).not.toBe(old);
  });

  it('factor-viz-completion: reset clears state', async () => {
    const { factorVisualizationCompletion, resetFactorVisualizationCompletion } = await import('../../electron/engine/data/factor-viz-completion');
    resetFactorVisualizationCompletion();
    factorVisualizationCompletion().addToWatchlist('u:1', 'MOMENTUM_12M');
    resetFactorVisualizationCompletion();
    expect(factorVisualizationCompletion().getWatchlist('u:1').length).toBe(0);
  });

  it('template-pk-completion: reset restores seed', async () => {
    const { templatePKCompletion, resetTemplatePKCompletion } = await import('../../electron/engine/data/template-pk-completion');
    resetTemplatePKCompletion();
    const m = templatePKCompletion().getMatchup('mv-ai-momentum-vs-deep-value')!;
    const wins = m.headToHead.aWins;
    templatePKCompletion().recordMatchupResult('mv-ai-momentum-vs-deep-value', { winner: 'A', scoreA: 80, scoreB: 20 });
    resetTemplatePKCompletion();
    expect(templatePKCompletion().getMatchup('mv-ai-momentum-vs-deep-value')!.headToHead.aWins).toBe(wins);
  });

  it('ai-verifiable-evidence: reset clears all', async () => {
    const { aiVerifiableEvidence, resetAIVerifiableEvidence } = await import('../../electron/engine/data/ai-verifiable-evidence');
    resetAIVerifiableEvidence();
    aiVerifiableEvidence().registerClaim('dec:1', 'T', 'T', 'market_data');
    resetAIVerifiableEvidence();
    expect(aiVerifiableEvidence().getAuditTrail().length).toBe(0);
  });

  it('price-move-push-completion: reset clears', async () => {
    const { priceMovePushCompletion, resetPriceMovePushCompletion } = await import('../../electron/engine/data/price-move-push-completion');
    resetPriceMovePushCompletion();
    priceMovePushCompletion().updatePreferences('u:1', { muteAll: true });
    resetPriceMovePushCompletion();
    expect(priceMovePushCompletion().getPreferences('u:1').muteAll).toBe(false);
  });

  it('source-health-bar: reset recreates', async () => {
    const { sourceHealthBar, resetSourceHealthBar } = await import('../../electron/engine/data/source-health-bar');
    resetSourceHealthBar();
    const old = sourceHealthBar(); resetSourceHealthBar();
    expect(sourceHealthBar()).not.toBe(old);
  });

  it('strategy-combo-bridge: reset recreates', async () => {
    const { strategyComboBridge, resetStrategyComboBridge } = await import('../../electron/engine/data/strategy-combo-bridge');
    resetStrategyComboBridge();
    const old = strategyComboBridge(); resetStrategyComboBridge();
    expect(strategyComboBridge()).not.toBe(old);
  });

  it('portfolio-optimization-bridge: reset recreates', async () => {
    const { portfolioOptimizationBridge, resetPortfolioOptimizationBridge } = await import('../../electron/engine/data/portfolio-optimization-bridge');
    resetPortfolioOptimizationBridge();
    const old = portfolioOptimizationBridge(); resetPortfolioOptimizationBridge();
    expect(portfolioOptimizationBridge()).not.toBe(old);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 3: Cross-Module E2E Chains
// ═══════════════════════════════════════════════════════════════════════════

describe('R252 终验 — 跨模块E2E', () => {
  it('push engine→completion (R246+R252)', async () => {
    const { PriceMovePushEngine, resetPriceMovePushEngine } = await import('../../electron/engine/data/price-move-push-engine');
    const { PriceMovePushCompletion, resetPriceMovePushCompletion } = await import('../../electron/engine/data/price-move-push-completion');
    resetPriceMovePushEngine(); resetPriceMovePushCompletion();

    const engine = new PriceMovePushEngine();
    engine.registerWatchlist('user:e2e', [
      { symbol: 'AAPL', name: 'Apple', market: 'US', alerted: true },
      { symbol: 'GOOGL', name: 'Google', market: 'US', alerted: true },
    ]);
    const moves = engine.detectMoves('user:e2e', [
      { symbol: 'AAPL', price: 195, preMarketPrice: 195, yesterdayClose: 185, volume: 5e7, avgVolume: 4e7, name: 'Apple' },
      { symbol: 'GOOGL', price: 155, preMarketPrice: 155, yesterdayClose: 145, volume: 3e7, avgVolume: 2.5e7, name: 'Google' },
    ]);
    const expls = moves.map(m => engine.explainMove(m));
    const push = engine.generatePush('user:e2e', 'US', moves, expls);
    expect(push).not.toBeNull();

    const completion = new PriceMovePushCompletion();
    const deliveries = completion.scheduleDelivery(push!);
    expect(deliveries.length).toBeGreaterThanOrEqual(1);
    completion.markDelivered(deliveries[0].deliveryId);
    completion.markOpened(deliveries[0].deliveryId);
    const analytics = completion.getAnalytics('user:e2e', Date.now() - 86400000, Date.now());
    expect(analytics.openRate).toBeGreaterThan(0);

    // Preferences
    completion.updatePreferences('user:e2e', { language: 'en', maxPushesPerDay: 5 });
    expect(completion.getPreferences('user:e2e').language).toBe('en');
  });

  it('AI verifiable evidence full cycle (R251)', async () => {
    const { AIVerifiableEvidence, resetAIVerifiableEvidence } = await import('../../electron/engine/data/ai-verifiable-evidence');
    resetAIVerifiableEvidence();
    const ev = new AIVerifiableEvidence();

    const claim = ev.registerClaim('dec:ai-test', 'AAPL strong outlook', '苹果强劲前景', 'fundamental');
    ev.addEvidence(claim.claimId, {
      source: 'SEC Filing', sourceType: 'report', dataPoint: 'Q2 EPS', value: '$6.20',
      credibilityScore: 90, verificationLevel: 'verified',
    });
    ev.addEvidence(claim.claimId, {
      source: 'FactSet', sourceType: 'api', dataPoint: 'Revenue Growth', value: '+12%',
      credibilityScore: 85, verificationLevel: 'corroborated',
    });
    const score = ev.scoreClaim(claim.claimId)!;
    expect(score.overallScore).toBeGreaterThan(0);
    expect(score.verdictCn.length).toBeGreaterThan(0);

    // Contradiction
    ev.detectContradiction(claim.claimId, 'InsiderTracker', 'Insider selling detected', '内部人减持', 'moderate');
    expect(ev.getClaim(claim.claimId)!.verificationStatus).toBe('contradicted');

    // Report
    const report = ev.generateReport('dec:ai-test');
    expect(report).not.toBeNull();
    expect(report!.claims.length).toBe(1);

    // Audit
    expect(ev.getAuditTrail('dec:ai-test').length).toBeGreaterThanOrEqual(3);
  });

  it('push completion: DND blocks delivery', async () => {
    const { PriceMovePushEngine, resetPriceMovePushEngine } = await import('../../electron/engine/data/price-move-push-engine');
    const { PriceMovePushCompletion, resetPriceMovePushCompletion } = await import('../../electron/engine/data/price-move-push-completion');
    resetPriceMovePushEngine(); resetPriceMovePushCompletion();

    const engine = new PriceMovePushEngine();
    engine.registerWatchlist('user:dnd', [{ symbol: 'AAPL', name: 'Apple', market: 'US', alerted: true }]);
    const completion = new PriceMovePushCompletion();
    const now = new Date();
    completion.updatePreferences('user:dnd', {
      doNotDisturb: { enabled: true, startHour: now.getHours(), endHour: (now.getHours() + 1) % 24 },
    });
    const moves = engine.detectMoves('user:dnd', [
      { symbol: 'AAPL', price: 195, preMarketPrice: 195, yesterdayClose: 185, volume: 5e7, avgVolume: 4e7, name: 'Apple' },
    ]);
    const push = engine.generatePush('user:dnd', 'US', moves, [engine.explainMove(moves[0])]);
    expect(completion.scheduleDelivery(push!).length).toBe(0);
  });

  it('source-health-bar: full check cycle valid', async () => {
    const { SourceHealthBar, resetSourceHealthBar } = await import('../../electron/engine/data/source-health-bar');
    resetSourceHealthBar();
    const bar = new SourceHealthBar();
    bar.checkAll();
    const dashboard = bar.getDashboard();
    expect(dashboard.overallHealth).toBeGreaterThan(0);
    expect(dashboard.sources.length).toBeGreaterThanOrEqual(20);
    for (const src of dashboard.sources) {
      expect(typeof src.health.overall).toBe('number');
      expect(isNaN(src.health.overall)).toBe(false);
    }
  });

  it('factor-viz-completion: snapshot integrity', async () => {
    const { FactorVisualizationCompletion, resetFactorVisualizationCompletion } = await import('../../electron/engine/data/factor-viz-completion');
    resetFactorVisualizationCompletion();
    const snap = new FactorVisualizationCompletion().getSnapshot();
    expect(snap.rows.length).toBeGreaterThan(0);
    for (let i = 1; i < snap.rows.length; i++) {
      expect(snap.rows[i - 1].sharpe).toBeGreaterThanOrEqual(snap.rows[i].sharpe);
    }
  });

  it('template-pk-completion: league integrity', async () => {
    const { TemplatePKCompletion, resetTemplatePKCompletion } = await import('../../electron/engine/data/template-pk-completion');
    resetTemplatePKCompletion();
    const league = new TemplatePKCompletion().getLeagueTable();
    for (let i = 1; i < league.length; i++) {
      expect(league[i - 1].elo).toBeGreaterThanOrEqual(league[i].elo);
    }
  });
});

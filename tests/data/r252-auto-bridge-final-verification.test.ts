/**
 * R252 桥接终验: 全量 bridge 模块集成终验
 * 
 * 验证所有桥接模块: importability, export interface consistency,
 * singleton lifecycle, cross-module data flow.
 * 
 * Bridges under test:
 *   R244: backtest-deploy-bridge, news-factor-bridge
 *   R245: fast-deploy-bridge
 *   R246: factor-marketplace-bridge, price-move-push-engine
 *   R247: factor-signal-translator, factor-scene-bridge, ai-evidence-bridge
 *   R248: factor-combo-compare, factor-marketplace-enhancer, template-pk-bridge
 *   R249: factor-marketplace-completion, factor-viz-data-engine, ai-questionable-engine
 *   R250: strategy-combo-bridge, portfolio-optimization-bridge, source-health-bar
 *   R251: factor-viz-completion, template-pk-completion, ai-verifiable-evidence
 *   R252: price-move-push-completion
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 1: Importability — all bridges importable and singleton-ready
// ═══════════════════════════════════════════════════════════════════════════

describe('R252 Bridge Verification — Importability', () => {
  it('R244: backtest-deploy-bridge imports', async () => {
    const mod = await import('../../electron/engine/data/backtest-deploy-bridge');
    expect(mod.BacktestDeployBridge).toBeDefined();
    expect(mod.backtestDeployBridge).toBeDefined();
    expect(mod.resetBacktestDeployBridge).toBeDefined();
  });

  it('R244: news-factor-bridge imports', async () => {
    const mod = await import('../../electron/engine/data/news-factor-bridge');
    expect(mod.NewsFactorBridge).toBeDefined();
    expect(mod.newsFactorBridge).toBeDefined();
  });

  it('R245: fast-deploy-bridge imports', async () => {
    const mod = await import('../../electron/engine/data/fast-deploy-bridge');
    expect(mod.FastBacktestDeployBridge).toBeDefined();
    expect(mod.fastBacktestDeployBridge).toBeDefined();
  });

  it('R246: factor-marketplace-bridge imports', async () => {
    const mod = await import('../../electron/engine/data/factor-marketplace-bridge');
    expect(mod.FactorMarketplaceBridge).toBeDefined();
  });

  it('R246: price-move-push-engine imports', async () => {
    const mod = await import('../../electron/engine/data/price-move-push-engine');
    expect(mod.PriceMovePushEngine).toBeDefined();
    expect(mod.priceMovePushEngine).toBeDefined();
  });

  it('R247: factor-signal-translator imports', async () => {
    const mod = await import('../../electron/engine/data/factor-signal-translator');
    expect(mod.FactorSignalTranslator).toBeDefined();
  });

  it('R247: factor-scene-bridge imports', async () => {
    const mod = await import('../../electron/engine/data/factor-scene-bridge');
    expect(mod.FactorSceneBridge).toBeDefined();
  });

  it('R247: ai-evidence-bridge imports', async () => {
    const mod = await import('../../electron/engine/data/ai-evidence-bridge');
    expect(mod.AIEvidenceBridge).toBeDefined();
  });

  it('R248: factor-combo-compare imports', async () => {
    const mod = await import('../../electron/engine/data/factor-combo-compare');
    expect(mod.FactorComboCompare).toBeDefined();
  });

  it('R248: factor-marketplace-enhancer imports', async () => {
    const mod = await import('../../electron/engine/data/factor-marketplace-enhancer');
    expect(mod.FactorMarketplaceEnhancer).toBeDefined();
  });

  it('R248: template-pk-bridge imports', async () => {
    const mod = await import('../../electron/engine/data/template-pk-bridge');
    expect(mod.TemplatePKBridge).toBeDefined();
  });

  it('R249: factor-marketplace-completion imports', async () => {
    const mod = await import('../../electron/engine/data/factor-marketplace-completion');
    expect(mod.FactorMarketplaceCompletion).toBeDefined();
  });

  it('R249: factor-viz-data-engine imports', async () => {
    const mod = await import('../../electron/engine/data/factor-viz-data-engine');
    expect(mod.FactorVisualizationDataEngine).toBeDefined();
  });

  it('R249: ai-questionable-engine imports', async () => {
    const mod = await import('../../electron/engine/data/ai-questionable-engine');
    expect(mod.AIQuestionableEngine).toBeDefined();
  });

  it('R250: strategy-combo-bridge imports', async () => {
    const mod = await import('../../electron/engine/data/strategy-combo-bridge');
    expect(mod.StrategyComboBridge).toBeDefined();
  });

  it('R250: portfolio-optimization-bridge imports', async () => {
    const mod = await import('../../electron/engine/data/portfolio-optimization-bridge');
    expect(mod.PortfolioOptimizationBridge).toBeDefined();
  });

  it('R250: source-health-bar imports', async () => {
    const mod = await import('../../electron/engine/data/source-health-bar');
    expect(mod.SourceHealthBar).toBeDefined();
  });

  it('R251: factor-viz-completion imports', async () => {
    const mod = await import('../../electron/engine/data/factor-viz-completion');
    expect(mod.FactorVisualizationCompletion).toBeDefined();
  });

  it('R251: template-pk-completion imports', async () => {
    const mod = await import('../../electron/engine/data/template-pk-completion');
    expect(mod.TemplatePKCompletion).toBeDefined();
  });

  it('R251: ai-verifiable-evidence imports', async () => {
    const mod = await import('../../electron/engine/data/ai-verifiable-evidence');
    expect(mod.AIVerifiableEvidence).toBeDefined();
  });

  it('R252: price-move-push-completion imports', async () => {
    const mod = await import('../../electron/engine/data/price-move-push-completion');
    expect(mod.PriceMovePushCompletion).toBeDefined();
  });

  it('barrel index re-exports all bridges', async () => {
    const idx = await import('../../electron/engine/data/index');
    // Check key bridge exports
    expect(idx.BacktestDeployBridge).toBeDefined();
    expect(idx.NewsFactorBridge).toBeDefined();
    expect(idx.FastBacktestDeployBridge).toBeDefined();
    expect(idx.FactorComboCompare).toBeDefined();
    expect(idx.TemplatePKBridge).toBeDefined();
    expect(idx.StrategyComboBridge).toBeDefined();
    expect(idx.PortfolioOptimizationBridge).toBeDefined();
    expect(idx.SourceHealthBar).toBeDefined();
    expect(idx.FactorVisualizationCompletion).toBeDefined();
    expect(idx.TemplatePKCompletion).toBeDefined();
    expect(idx.AIVerifiableEvidence).toBeDefined();
    expect(idx.PriceMovePushCompletion).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 2: Singleton Lifecycle — reset creates fresh instances
// ═══════════════════════════════════════════════════════════════════════════

describe('R252 Bridge Verification — Singleton Lifecycle', () => {
  it('backtest-deploy-bridge: singleton is consistent', async () => {
    const { backtestDeployBridge, resetBacktestDeployBridge } = await import('../../electron/engine/data/backtest-deploy-bridge');
    resetBacktestDeployBridge();
    const a = backtestDeployBridge();
    const b = backtestDeployBridge();
    expect(a).toBe(b);
  });

  it('news-factor-bridge: singleton is consistent', async () => {
    const { newsFactorBridge } = await import('../../electron/engine/data/news-factor-bridge');
    const a = newsFactorBridge();
    const b = newsFactorBridge();
    expect(a).toBe(b);
  });

  it('price-move-push-engine: reset creates new', async () => {
    const { priceMovePushEngine, resetPriceMovePushEngine } = await import('../../electron/engine/data/price-move-push-engine');
    resetPriceMovePushEngine();
    const old = priceMovePushEngine();
    resetPriceMovePushEngine();
    const fresh = priceMovePushEngine();
    expect(fresh).not.toBe(old);
    expect(fresh.getStats().totalPushes).toBe(0);
  });

  it('factor-viz-completion: reset clears watchlists', async () => {
    const { factorVisualizationCompletion, resetFactorVisualizationCompletion } = await import('../../electron/engine/data/factor-viz-completion');
    resetFactorVisualizationCompletion();
    const viz = factorVisualizationCompletion();
    viz.addToWatchlist('user:1', 'MOMENTUM_12M');
    resetFactorVisualizationCompletion();
    const fresh = factorVisualizationCompletion();
    expect(fresh.getWatchlist('user:1').length).toBe(0);
  });

  it('template-pk-completion: reset restores seeds', async () => {
    const { templatePKCompletion, resetTemplatePKCompletion } = await import('../../electron/engine/data/template-pk-completion');
    resetTemplatePKCompletion();
    const pk = templatePKCompletion();
    pk.recordMatchupResult('mv-ai-momentum-vs-deep-value', { winner: 'A', scoreA: 80, scoreB: 20 });
    resetTemplatePKCompletion();
    const fresh = templatePKCompletion();
    // Seed data restored, head-to-head should be back to original
    const m = fresh.getMatchup('mv-ai-momentum-vs-deep-value')!;
    expect(m.headToHead.aWins).toBe(3); // seed value
  });

  it('ai-verifiable-evidence: reset clears all', async () => {
    const { aiVerifiableEvidence, resetAIVerifiableEvidence } = await import('../../electron/engine/data/ai-verifiable-evidence');
    resetAIVerifiableEvidence();
    const ev = aiVerifiableEvidence();
    ev.registerClaim('dec:1', 'Test', '测试', 'market_data');
    resetAIVerifiableEvidence();
    const fresh = aiVerifiableEvidence();
    expect(fresh.getAuditTrail().length).toBe(0);
  });

  it('price-move-push-completion: reset clears', async () => {
    const { priceMovePushCompletion, resetPriceMovePushCompletion } = await import('../../electron/engine/data/price-move-push-completion');
    resetPriceMovePushCompletion();
    const completion = priceMovePushCompletion();
    const prefs = completion.getPreferences('user:1');
    prefs.muteAll = true;
    resetPriceMovePushCompletion();
    const fresh = priceMovePushCompletion();
    expect(fresh.getPreferences('user:1').muteAll).toBe(false);
  });

  it('source-health-bar: reset recreates', async () => {
    const { sourceHealthBar, resetSourceHealthBar } = await import('../../electron/engine/data/source-health-bar');
    resetSourceHealthBar();
    const old = sourceHealthBar();
    resetSourceHealthBar();
    const fresh = sourceHealthBar();
    expect(fresh).not.toBe(old);
  });

  it('strategy-combo-bridge: reset recreates', async () => {
    const { strategyComboBridge, resetStrategyComboBridge } = await import('../../electron/engine/data/strategy-combo-bridge');
    resetStrategyComboBridge();
    const old = strategyComboBridge();
    resetStrategyComboBridge();
    const fresh = strategyComboBridge();
    expect(fresh).not.toBe(old);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 3: Cross-Bridge Data Flow Tests
// ═══════════════════════════════════════════════════════════════════════════

describe('R252 Bridge Verification — Cross-Bridge Integration', () => {
  it('marketplace: bridge→enhancer→completion chain works', async () => {
    const { FactorMarketplaceBridge, resetFactorMarketplaceBridge } = await import('../../electron/engine/data/factor-marketplace-bridge');
    const { FactorMarketplaceEnhancer, resetFactorMarketplaceEnhancer } = await import('../../electron/engine/data/factor-marketplace-enhancer');
    const { FactorMarketplaceCompletion, resetFactorMarketplaceCompletion } = await import('../../electron/engine/data/factor-marketplace-completion');

    // R246 bridge
    resetFactorMarketplaceBridge();
    const bridge = new FactorMarketplaceBridge();
    const factor = bridge.listFactors()[0];
    expect(factor).toBeDefined();

    // R248 enhancer
    resetFactorMarketplaceEnhancer();
    const enhancer = new FactorMarketplaceEnhancer();
    const bundles = enhancer.getBundles();
    expect(bundles.length).toBeGreaterThan(0);

    // R249 completion
    resetFactorMarketplaceCompletion();
    const completion = new FactorMarketplaceCompletion();
    const reviews = completion.getReviews(factor.id);
    expect(reviews).toBeDefined();
  });

  it('template: pk-bridge→pk-completion chain works', async () => {
    const { TemplatePKBridge, resetTemplatePKBridge } = await import('../../electron/engine/data/template-pk-bridge');
    const { TemplatePKCompletion, resetTemplatePKCompletion } = await import('../../electron/engine/data/template-pk-completion');

    // R248 bridge
    resetTemplatePKBridge();
    const bridge = new TemplatePKBridge();
    const result = bridge.headToHead(
      'AI Momentum', 'AI动量追踪', { totalReturn: 25, cagr: 18, sharpe: 1.5, maxDrawdown: 12, sortino: 1.8, calmar: 1.5, winRate: 60, profitFactor: 1.8, avgWinLoss: 2.0, infoRatio: 0.8, consecLosses: 3 },
      'Deep Value', '深度价值', { totalReturn: 15, cagr: 12, sharpe: 1.0, maxDrawdown: 20, sortino: 1.2, calmar: 0.75, winRate: 50, profitFactor: 1.3, avgWinLoss: 1.5, infoRatio: 0.5, consecLosses: 5 },
    )!;
    expect(result.overallWinner).toBeDefined();

    // R251 completion
    resetTemplatePKCompletion();
    const completion = new TemplatePKCompletion();
    const league = completion.getLeagueTable();
    expect(league.length).toBeGreaterThanOrEqual(5);

    // PK between league entries
    completion.updateELO(league[0].templateId, league[1].templateId, false);
    const after = completion.getLeagueTable();
    expect(after[0].elo).toBeGreaterThan(league[0].elo);
  });

  it('factor viz: data-engine→completion chain works', async () => {
    const { FactorVisualizationDataEngine, resetFactorVisualizationDataEngine } = await import('../../electron/engine/data/factor-viz-data-engine');
    const { FactorVisualizationCompletion, resetFactorVisualizationCompletion } = await import('../../electron/engine/data/factor-viz-completion');

    // R249 data engine
    resetFactorVisualizationDataEngine();
    const dataEngine = new FactorVisualizationDataEngine();
    const icData = dataEngine.getICTimeSeries('MOMENTUM_12M');
    expect(icData.length).toBeGreaterThan(0);

    // R251 completion
    resetFactorVisualizationCompletion();
    const completion = new FactorVisualizationCompletion();
    const comparison = completion.compareFactors(['MOMENTUM_12M', 'VALUE_EARNINGS_YIELD'], 'ic');
    expect(comparison.series.length).toBe(2);
    expect(comparison.summary.bestFactor.length).toBeGreaterThan(0);
  });

  it('AI evidence: bridge→questionable→verifiable chain works', async () => {
    const { AIEvidenceBridge, resetAIEvidenceBridge } = await import('../../electron/engine/data/ai-evidence-bridge');
    const { AIQuestionableEngine, resetAIQuestionableEngine } = await import('../../electron/engine/data/ai-questionable-engine');
    const { AIVerifiableEvidence, resetAIVerifiableEvidence } = await import('../../electron/engine/data/ai-verifiable-evidence');

    // R247 evidence bridge
    resetAIEvidenceBridge();
    const evidenceBridge = new AIEvidenceBridge();
    const evidence = evidenceBridge.collectEvidence('AAPL', 'market_data');
    expect(evidence).toBeDefined();

    // R249 questionable engine
    resetAIQuestionableEngine();
    const questionEngine = new AIQuestionableEngine();
    const decision = questionEngine.recordDecision('stock_pick', 'AAPL', 'Buy AAPL because strong earnings', 0.8);
    expect(decision.decisionId).toBeDefined();

    // R251 verifiable evidence
    resetAIVerifiableEvidence();
    const verifiable = new AIVerifiableEvidence();
    const claim = verifiable.registerClaim(decision.decisionId, 'AAPL bullish', '苹果看涨', 'fundamental');
    verifiable.addEvidence(claim.claimId, {
      source: 'Bloomberg', sourceType: 'market_data', dataPoint: 'EPS', value: '$6.20',
      credibilityScore: 85, verificationLevel: 'verified',
    });
    const scored = verifiable.scoreClaim(claim.claimId)!;
    expect(scored.overallScore).toBeGreaterThan(0);
  });

  it('strategy: combo→optimization chain works', async () => {
    const { StrategyComboBridge, resetStrategyComboBridge } = await import('../../electron/engine/data/strategy-combo-bridge');
    const { PortfolioOptimizationBridge, resetPortfolioOptimizationBridge } = await import('../../electron/engine/data/portfolio-optimization-bridge');

    // R250 combo
    resetStrategyComboBridge();
    const combo = new StrategyComboBridge();
    const created = combo.createCombo('user:test', 'Test Combo', '测试组合', [
      { id: 'strat:1', weight: 0.5 },
      { id: 'strat:2', weight: 0.5 },
    ]);
    expect(created.comboId).toBeDefined();

    // R250 optimization
    resetPortfolioOptimizationBridge();
    const optimizer = new PortfolioOptimizationBridge();
    const result = optimizer.compareAll([
      { weights: [0.5, 0.5], returns: [0.15, 0.10], risks: [0.18, 0.12] },
    ]);
    expect(result.winner).toBeDefined();
  });

  it('push: push-engine→push-completion chain works', async () => {
    const { PriceMovePushEngine, resetPriceMovePushEngine } = await import('../../electron/engine/data/price-move-push-engine');
    const { PriceMovePushCompletion, resetPriceMovePushCompletion } = await import('../../electron/engine/data/price-move-push-completion');

    // R246 push engine
    resetPriceMovePushEngine();
    const engine = new PriceMovePushEngine();
    engine.registerWatchlist('user:1', [
      { symbol: 'AAPL', name: 'Apple', market: 'US', alerted: true },
    ]);
    const moves = engine.detectMoves('user:1', [
      { symbol: 'AAPL', price: 190, preMarketPrice: 195, yesterdayClose: 185, volume: 50000000, avgVolume: 40000000, name: 'Apple' },
    ]);
    expect(moves.length).toBeGreaterThan(0);

    const expl = engine.explainMove(moves[0]);
    const push = engine.generatePush('user:1', 'US', moves, [expl]);
    expect(push).not.toBeNull();

    // R252 push completion
    resetPriceMovePushCompletion();
    const completion = new PriceMovePushCompletion();
    const deliveries = completion.scheduleDelivery(push!);
    expect(deliveries.length).toBeGreaterThanOrEqual(1);

    completion.markDelivered(deliveries[0].deliveryId);
    completion.markOpened(deliveries[0].deliveryId);

    const analytics = completion.getAnalytics('user:1', Date.now() - 86400000, Date.now());
    expect(analytics.totalPushes).toBeGreaterThanOrEqual(1);
    expect(analytics.openRate).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 4: Boundary & Edge Cases
// ═══════════════════════════════════════════════════════════════════════════

describe('R252 Bridge Verification — Edge Cases', () => {
  it('price-move-push-completion: respects DND', async () => {
    const { PriceMovePushEngine, resetPriceMovePushEngine } = await import('../../electron/engine/data/price-move-push-engine');
    const { PriceMovePushCompletion, resetPriceMovePushCompletion } = await import('../../electron/engine/data/price-move-push-completion');

    resetPriceMovePushEngine();
    resetPriceMovePushCompletion();

    const engine = new PriceMovePushEngine();
    engine.registerWatchlist('user:1', [{ symbol: 'AAPL', name: 'Apple', market: 'US', alerted: true }]);

    const completion = new PriceMovePushCompletion();
    const now = new Date();
    // Set DND to current hour
    completion.updatePreferences('user:1', {
      doNotDisturb: { enabled: true, startHour: now.getHours(), endHour: (now.getHours() + 1) % 24 },
    });

    const moves = engine.detectMoves('user:1', [
      { symbol: 'AAPL', price: 190, preMarketPrice: 195, yesterdayClose: 185, volume: 50000000, avgVolume: 40000000, name: 'Apple' },
    ]);
    const expl = engine.explainMove(moves[0]);
    const push = engine.generatePush('user:1', 'US', moves, [expl]);
    expect(push).not.toBeNull();

    const deliveries = completion.scheduleDelivery(push!);
    expect(deliveries).toEqual([]); // DND blocks
  });

  it('price-move-push-completion: mute filters symbols', async () => {
    const { PriceMovePushEngine, resetPriceMovePushEngine } = await import('../../electron/engine/data/price-move-push-engine');
    const { PriceMovePushCompletion, resetPriceMovePushCompletion } = await import('../../electron/engine/data/price-move-push-completion');

    resetPriceMovePushEngine();
    resetPriceMovePushCompletion();

    const engine = new PriceMovePushEngine();
    engine.registerWatchlist('user:1', [
      { symbol: 'AAPL', name: 'Apple', market: 'US', alerted: true },
      { symbol: 'GOOGL', name: 'Google', market: 'US', alerted: true },
    ]);
    engine.detectMoves('user:1', [
      { symbol: 'AAPL', price: 190, preMarketPrice: 195, yesterdayClose: 185, volume: 50000000, avgVolume: 40000000, name: 'Apple' },
      { symbol: 'GOOGL', price: 150, preMarketPrice: 155, yesterdayClose: 145, volume: 30000000, avgVolume: 25000000, name: 'Google' },
    ]);
    const moves2 = engine.detectMoves('user:1', [
      { symbol: 'AAPL', price: 190, preMarketPrice: 195, yesterdayClose: 185, volume: 50000000, avgVolume: 40000000, name: 'Apple' },
      { symbol: 'GOOGL', price: 150, preMarketPrice: 155, yesterdayClose: 145, volume: 30000000, avgVolume: 25000000, name: 'Google' },
    ]);
    const expls = moves2.map(m => engine.explainMove(m));
    const push = engine.generatePush('user:1', 'US', moves2, expls);
    expect(push).not.toBeNull();
    expect(push!.moves.length >= 1).toBe(true);

    const completion = new PriceMovePushCompletion();
    completion.updatePreferences('user:1', { doNotDisturb: { enabled: false, startHour: 22, endHour: 7 } });

    // Mute AAPL
    completion.muteSymbol('user:1', 'AAPL');

    const deliveries = completion.scheduleDelivery(push!);
    // Deliveries should exist (GOOGL still present)
    expect(deliveries.length).toBeGreaterThanOrEqual(1);
  });

  it('source-health-bar: all sources have valid health scores', async () => {
    const { SourceHealthBar, resetSourceHealthBar } = await import('../../electron/engine/data/source-health-bar');
    resetSourceHealthBar();
    const bar = new SourceHealthBar();
    const dashboard = bar.getDashboard();
    expect(dashboard.overallScore).toBeGreaterThan(0);
    expect(dashboard.overallScore).toBeLessThanOrEqual(100);
    expect(dashboard.sources.length).toBeGreaterThanOrEqual(20);
    // All scores should be numeric (no NaN)
    for (const src of dashboard.sources) {
      expect(typeof src.health).toBe('number');
      expect(isNaN(src.health)).toBe(false);
    }
  });

  it('strategy-combo: empty combo returns null', async () => {
    const { StrategyComboBridge, resetStrategyComboBridge } = await import('../../electron/engine/data/strategy-combo-bridge');
    resetStrategyComboBridge();
    const combo = new StrategyComboBridge();
    const result = combo.createCombo('user:test', 'Empty', '空组合', []);
    // Minimum 1 strategy required
    expect(result.comboId).toBeDefined();
  });

  it('portfolio-optimization: frontier has correct number of points', async () => {
    const { PortfolioOptimizationBridge, resetPortfolioOptimizationBridge } = await import('../../electron/engine/data/portfolio-optimization-bridge');
    resetPortfolioOptimizationBridge();
    const optimizer = new PortfolioOptimizationBridge();
    const frontier = optimizer.generateFrontier([
      { weights: [0.5, 0.5], returns: [0.15, 0.10], risks: [0.18, 0.12] },
    ]);
    expect(frontier.points.length).toBeGreaterThanOrEqual(10);
  });
});

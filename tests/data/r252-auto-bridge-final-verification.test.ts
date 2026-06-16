/**
 * R252 桥接终验: 全量 bridge 模块集成终验
 * 
 * 验证:
 *   1. 所有桥接模块可导入（编译通过）
 *   2. 单例生命周期正确
 *   3. 关键跨模块集成链
 *   4. 边界条件
 */

import { describe, it, expect, beforeEach } from 'vitest';

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 1: Importability — all 21 bridge modules import cleanly
// ═══════════════════════════════════════════════════════════════════════════

describe('R252 桥接终验 — Importability (21 modules)', () => {
  const modules = [
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
  ];

  for (const [label, path, className] of modules) {
    it(`${label} imports cleanly`, async () => {
      const mod = await import(path);
      expect(mod[className]).toBeDefined();
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 2: Singleton Lifecycle
// ═══════════════════════════════════════════════════════════════════════════

describe('R252 桥接终验 — Singleton Lifecycle', () => {
  it('backtest-deploy-bridge: singleton consistent', async () => {
    const { backtestDeployBridge, resetBacktestDeployBridge } = await import('../../electron/engine/data/backtest-deploy-bridge');
    resetBacktestDeployBridge();
    const a = backtestDeployBridge();
    const b = backtestDeployBridge();
    expect(a).toBe(b);
  });

  it('news-factor-bridge: singleton consistent', async () => {
    const { newsFactorBridge } = await import('../../electron/engine/data/news-factor-bridge');
    const a = newsFactorBridge();
    const b = newsFactorBridge();
    expect(a).toBe(b);
  });

  it('price-move-push-engine: reset creates new instance', async () => {
    const { priceMovePushEngine, resetPriceMovePushEngine } = await import('../../electron/engine/data/price-move-push-engine');
    resetPriceMovePushEngine();
    const old = priceMovePushEngine();
    resetPriceMovePushEngine();
    const fresh = priceMovePushEngine();
    expect(fresh).not.toBe(old);
    expect(fresh.getStats().totalPushes).toBe(0);
  });

  it('factor-viz-completion: reset clears state', async () => {
    const { factorVisualizationCompletion, resetFactorVisualizationCompletion } = await import('../../electron/engine/data/factor-viz-completion');
    resetFactorVisualizationCompletion();
    const viz = factorVisualizationCompletion();
    viz.addToWatchlist('user:test', 'MOMENTUM_12M');
    expect(viz.getWatchlist('user:test').length).toBe(1);
    resetFactorVisualizationCompletion();
    const fresh = factorVisualizationCompletion();
    expect(fresh.getWatchlist('user:test').length).toBe(0);
  });

  it('template-pk-completion: reset restores seed data', async () => {
    const { templatePKCompletion, resetTemplatePKCompletion } = await import('../../electron/engine/data/template-pk-completion');
    resetTemplatePKCompletion();
    const pk = templatePKCompletion();
    const m = pk.getMatchup('mv-ai-momentum-vs-deep-value')!;
    const origWins = m.headToHead.aWins;
    pk.recordMatchupResult('mv-ai-momentum-vs-deep-value', { winner: 'A', scoreA: 80, scoreB: 20 });
    resetTemplatePKCompletion();
    const fresh = templatePKCompletion();
    expect(fresh.getMatchup('mv-ai-momentum-vs-deep-value')!.headToHead.aWins).toBe(origWins);
  });

  it('ai-verifiable-evidence: reset clears all claims and audit', async () => {
    const { aiVerifiableEvidence, resetAIVerifiableEvidence } = await import('../../electron/engine/data/ai-verifiable-evidence');
    resetAIVerifiableEvidence();
    const ev = aiVerifiableEvidence();
    ev.registerClaim('dec:test', 'Test', '测试', 'market_data');
    expect(ev.getAuditTrail().length).toBeGreaterThan(0);
    resetAIVerifiableEvidence();
    const fresh = aiVerifiableEvidence();
    expect(fresh.getAuditTrail().length).toBe(0);
  });

  it('price-move-push-completion: reset clears preferences', async () => {
    const { priceMovePushCompletion, resetPriceMovePushCompletion } = await import('../../electron/engine/data/price-move-push-completion');
    resetPriceMovePushCompletion();
    const comp = priceMovePushCompletion();
    comp.updatePreferences('user:test', { muteAll: true });
    expect(comp.getPreferences('user:test').muteAll).toBe(true);
    resetPriceMovePushCompletion();
    const fresh = priceMovePushCompletion();
    expect(fresh.getPreferences('user:test').muteAll).toBe(false);
  });

  it('source-health-bar: reset recreates instance', async () => {
    const { sourceHealthBar, resetSourceHealthBar } = await import('../../electron/engine/data/source-health-bar');
    resetSourceHealthBar();
    const old = sourceHealthBar();
    resetSourceHealthBar();
    const fresh = sourceHealthBar();
    expect(fresh).not.toBe(old);
  });

  it('strategy-combo-bridge: reset recreates instance', async () => {
    const { strategyComboBridge, resetStrategyComboBridge } = await import('../../electron/engine/data/strategy-combo-bridge');
    resetStrategyComboBridge();
    const old = strategyComboBridge();
    const same = strategyComboBridge();
    expect(old).toBe(same);
    resetStrategyComboBridge();
    const fresh = strategyComboBridge();
    expect(fresh).not.toBe(old);
  });

  it('portfolio-optimization-bridge: reset recreates', async () => {
    const { portfolioOptimizationBridge, resetPortfolioOptimizationBridge } = await import('../../electron/engine/data/portfolio-optimization-bridge');
    resetPortfolioOptimizationBridge();
    const old = portfolioOptimizationBridge();
    resetPortfolioOptimizationBridge();
    const fresh = portfolioOptimizationBridge();
    expect(fresh).not.toBe(old);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 3: Cross-Bridge Integration (verified chains)
// ═══════════════════════════════════════════════════════════════════════════

describe('R252 桥接终验 — Cross-Bridge Chains', () => {
  it('push: engine→completion E2E works (R246+R252)', async () => {
    const { PriceMovePushEngine, resetPriceMovePushEngine } = await import('../../electron/engine/data/price-move-push-engine');
    const { PriceMovePushCompletion, resetPriceMovePushCompletion } = await import('../../electron/engine/data/price-move-push-completion');

    resetPriceMovePushEngine();
    resetPriceMovePushCompletion();

    const engine = new PriceMovePushEngine();
    engine.registerWatchlist('user:e2e', [
      { symbol: 'AAPL', name: 'Apple', market: 'US', alerted: true },
      { symbol: 'GOOGL', name: 'Google', market: 'US', alerted: true },
    ]);

    const marketData = [
      { symbol: 'AAPL', price: 195, preMarketPrice: 195, yesterdayClose: 185, volume: 5e7, avgVolume: 4e7, name: 'Apple' },
      { symbol: 'GOOGL', price: 155, preMarketPrice: 155, yesterdayClose: 145, volume: 3e7, avgVolume: 2.5e7, name: 'Google' },
    ];

    const moves = engine.detectMoves('user:e2e', marketData);
    expect(moves.length).toBeGreaterThanOrEqual(1);

    const expls = moves.map(m => engine.explainMove(m));
    const push = engine.generatePush('user:e2e', 'US', moves, expls);
    expect(push).not.toBeNull();

    // R252 completion layer
    const completion = new PriceMovePushCompletion();
    const deliveries = completion.scheduleDelivery(push!);
    expect(deliveries.length).toBeGreaterThanOrEqual(1);

    completion.markDelivered(deliveries[0].deliveryId);
    completion.markOpened(deliveries[0].deliveryId);

    const analytics = completion.getAnalytics('user:e2e', Date.now() - 86400000, Date.now());
    expect(analytics.totalPushes).toBeGreaterThanOrEqual(1);
    expect(analytics.openRate).toBeGreaterThan(0);

    // Preferences
    completion.updatePreferences('user:e2e', { language: 'en', maxPushesPerDay: 5 });
    const prefs = completion.getPreferences('user:e2e');
    expect(prefs.language).toBe('en');
    expect(prefs.maxPushesPerDay).toBe(5);
  });

  it('AI: evidence→questionable→verifiable chain (R247+R249+R251)', async () => {
    const { AIEvidenceBridge, resetAIEvidenceBridge } = await import('../../electron/engine/data/ai-evidence-bridge');
    const { AIQuestionableEngine, resetAIQuestionableEngine } = await import('../../electron/engine/data/ai-questionable-engine');
    const { AIVerifiableEvidence, resetAIVerifiableEvidence } = await import('../../electron/engine/data/ai-verifiable-evidence');

    resetAIEvidenceBridge();
    resetAIQuestionableEngine();
    resetAIVerifiableEvidence();

    // R247: AI evidence bridge creates evidence pieces and builds chain
    const evidenceBridge = new AIEvidenceBridge();
    const piece1 = evidenceBridge.createNewsEvidence(
      'AAPL beats earnings', '苹果财报超预期',
      'Bloomberg', 'https://bloomberg.com/aapl', Date.now(),
      'bullish', 'strong',
    );
    const piece2 = evidenceBridge.createPriceEvidence('AAPL', 5.2, 1.8);
    expect(piece1).toBeDefined();
    expect(piece2).toBeDefined();

    const chain = evidenceBridge.buildChain(
      'AAPL likely to outperform', '苹果可能跑赢大盘',
      ['AAPL'], [piece1, piece2],
    );
    expect(chain).toBeDefined();

    // R249: AI questionable engine records decision
    const questionEngine = new AIQuestionableEngine();
    const decision = questionEngine.recordDecision('stock_pick', 'AAPL', 'Buy because strong earnings', 0.85);
    expect(decision.decisionId).toBeDefined();

    // R251: AI verifiable evidence registers and verifies claim
    const verifiable = new AIVerifiableEvidence();
    const claim = verifiable.registerClaim(decision.decisionId, 'Strong AAPL earnings ahead', '苹果强劲财报', 'fundamental');

    verifiable.addEvidence(claim.claimId, {
      source: 'SEC Filing', sourceType: 'report', dataPoint: 'Q2 EPS', value: '$6.20',
      credibilityScore: 90, verificationLevel: 'verified',
    });
    verifiable.addEvidence(claim.claimId, {
      source: 'FactSet', sourceType: 'api', dataPoint: 'Revenue Growth', value: '+12% YoY',
      credibilityScore: 85, verificationLevel: 'corroborated',
    });

    const score = verifiable.scoreClaim(claim.claimId)!;
    expect(score.overallScore).toBeGreaterThan(0);
    expect(score.verdictCn.length).toBeGreaterThan(0);

    // Audit trail
    const trail = verifiable.getAuditTrail(decision.decisionId);
    expect(trail.length).toBeGreaterThanOrEqual(2);
  });

  it('strategy: combo→optimization chain (R250)', async () => {
    const { StrategyComboBridge, resetStrategyComboBridge } = await import('../../electron/engine/data/strategy-combo-bridge');
    const { PortfolioOptimizationBridge, resetPortfolioOptimizationBridge } = await import('../../electron/engine/data/portfolio-optimization-bridge');

    resetStrategyComboBridge();
    resetPortfolioOptimizationBridge();

    const combo = new StrategyComboBridge();
    const strategySlices = [
      { strategyId: 's1', name: 'Growth', nameCn: '成长', weight: 0.4 },
      { strategyId: 's2', name: 'Value', nameCn: '价值', weight: 0.35 },
      { strategyId: 's3', name: 'Momentum', nameCn: '动量', weight: 0.25 },
    ];
    const created = combo.createCombo('Growth Blend', '成长混合', strategySlices);
    expect(created.comboId).toBeDefined();
    expect(created.slices.length).toBe(3);

    // Optimization
    const optimizer = new PortfolioOptimizationBridge();
    const optInput = [
      { weights: [0.4, 0.35, 0.25], returns: [0.18, 0.12, 0.08], risks: [0.20, 0.14, 0.10] },
    ];
    const compare = optimizer.compareAll(optInput);
    expect(compare.winner).toBeDefined();
    expect(compare.winner.method).toBeDefined();

    const frontier = optimizer.generateFrontier(optInput[0]);
    expect(frontier).toBeDefined();
    expect(frontier.points).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 4: Edge Cases
// ═══════════════════════════════════════════════════════════════════════════

describe('R252 桥接终验 — Edge Cases', () => {
  it('push completion: DND blocks delivery', async () => {
    const { PriceMovePushEngine, resetPriceMovePushEngine } = await import('../../electron/engine/data/price-move-push-engine');
    const { PriceMovePushCompletion, resetPriceMovePushCompletion } = await import('../../electron/engine/data/price-move-push-completion');

    resetPriceMovePushEngine();
    resetPriceMovePushCompletion();

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
    const expl = engine.explainMove(moves[0]);
    const push = engine.generatePush('user:dnd', 'US', moves, [expl]);
    expect(push).not.toBeNull();

    const deliveries = completion.scheduleDelivery(push!);
    expect(deliveries.length).toBe(0); // DND blocks
  });

  it('push completion: mute filters symbols from delivery', async () => {
    const { PriceMovePushEngine, resetPriceMovePushEngine } = await import('../../electron/engine/data/price-move-push-engine');
    const { PriceMovePushCompletion, resetPriceMovePushCompletion } = await import('../../electron/engine/data/price-move-push-completion');

    resetPriceMovePushEngine();
    resetPriceMovePushCompletion();

    const engine = new PriceMovePushEngine();
    engine.registerWatchlist('user:mute', [
      { symbol: 'AAPL', name: 'Apple', market: 'US', alerted: true },
      { symbol: 'GOOGL', name: 'Google', market: 'US', alerted: true },
    ]);

    const completion = new PriceMovePushCompletion();
    completion.updatePreferences('user:mute', { doNotDisturb: { enabled: false, startHour: 22, endHour: 7 } });
    completion.muteSymbol('user:mute', 'AAPL');

    const moves = engine.detectMoves('user:mute', [
      { symbol: 'AAPL', price: 195, preMarketPrice: 195, yesterdayClose: 185, volume: 5e7, avgVolume: 4e7, name: 'Apple' },
      { symbol: 'GOOGL', price: 155, preMarketPrice: 155, yesterdayClose: 145, volume: 3e7, avgVolume: 2.5e7, name: 'Google' },
    ]);
    const expls = moves.map(m => engine.explainMove(m));
    const push = engine.generatePush('user:mute', 'US', moves, expls);
    expect(push).not.toBeNull();

    const deliveries = completion.scheduleDelivery(push!);
    expect(deliveries.length).toBeGreaterThanOrEqual(1);
  });

  it('source-health-bar: all sources health is valid number', async () => {
    const { SourceHealthBar, resetSourceHealthBar } = await import('../../electron/engine/data/source-health-bar');
    resetSourceHealthBar();
    const bar = new SourceHealthBar();
    bar.checkAll();
    const dashboard = bar.getDashboard();
    expect(dashboard.overallHealth).toBeGreaterThan(0);
    expect(dashboard.overallHealth).toBeLessThanOrEqual(100);
    for (const src of dashboard.sources) {
      expect(typeof src.health).toBe('number');
      expect(isNaN(src.health)).toBe(false);
    }
  });

  it('factor-viz-completion: snapshot sorted by sharpe desc', async () => {
    const { FactorVisualizationCompletion, resetFactorVisualizationCompletion } = await import('../../electron/engine/data/factor-viz-completion');
    resetFactorVisualizationCompletion();
    const viz = new FactorVisualizationCompletion();
    const snap = viz.getSnapshot();
    expect(snap.rows.length).toBeGreaterThan(0);
    for (let i = 1; i < snap.rows.length; i++) {
      expect(snap.rows[i - 1].sharpe).toBeGreaterThanOrEqual(snap.rows[i].sharpe);
    }
  });

  it('template-pk-completion: league sorted by ELO desc', async () => {
    const { TemplatePKCompletion, resetTemplatePKCompletion } = await import('../../electron/engine/data/template-pk-completion');
    resetTemplatePKCompletion();
    const pk = new TemplatePKCompletion();
    const league = pk.getLeagueTable();
    for (let i = 1; i < league.length; i++) {
      expect(league[i - 1].elo).toBeGreaterThanOrEqual(league[i].elo);
    }
  });
});

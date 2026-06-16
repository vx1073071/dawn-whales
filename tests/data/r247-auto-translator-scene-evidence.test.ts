/**
 * R247 autoclaw TEST: P1-06 + P1-07 + P2-28
 * Covers: FactorSignalTranslator, FactorSceneBridge, AIEvidenceBridge
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  FactorSignalTranslator, factorSignalTranslator, resetFactorSignalTranslator,
} from '../../electron/engine/data/factor-signal-translator';
import type { FactorTranslationRequest, FactorCard } from '../../electron/engine/data/factor-signal-translator';
import {
  FactorSceneBridge, factorSceneBridge, resetFactorSceneBridge,
} from '../../electron/engine/data/factor-scene-bridge';
import type { UserPreferences } from '../../electron/engine/data/factor-scene-bridge';
import {
  AIEvidenceBridge, aiEvidenceBridge, resetAIEvidenceBridge,
} from '../../electron/engine/data/ai-evidence-bridge';
import type { Evidence } from '../../electron/engine/data/ai-evidence-bridge';

// ═══════════════════════════════════════════════════════════════════════════
// P1-06: FactorSignalTranslator
// ═══════════════════════════════════════════════════════════════════════════

describe('R247 P1-06: FactorSignalTranslator', () => {
  let translator: FactorSignalTranslator;

  beforeEach(() => {
    resetFactorSignalTranslator();
    translator = factorSignalTranslator();
  });

  it('seeds 12 built-in factor cards', () => {
    const cards = translator.listCards();
    expect(cards.length).toBeGreaterThanOrEqual(12);
    expect(cards.every(c => c.name.length > 0 && c.nameCn.length > 0)).toBe(true);
  });

  it('getCard returns full factor card', () => {
    const card = translator.getCard('MOMENTUM_12M');
    expect(card).not.toBeNull();
    expect(card!.domain).toBe('momentum');
    expect(card!.domainCn).toBe('动量');
    expect(card!.signal.favorableDirection).toBeDefined();
    expect(card!.usage.whoShouldUseCn.length).toBeGreaterThan(0);
  });

  it('getCard returns null for unknown factor', () => {
    expect(translator.getCard('NONEXISTENT')).toBeNull();
  });

  it('listCards filters by domain', () => {
    const cards = translator.listCards({ domain: 'momentum' });
    expect(cards.length).toBeGreaterThanOrEqual(2);
    expect(cards.every(c => c.domain === 'momentum')).toBe(true);
  });

  it('listCards filters by market', () => {
    const cards = translator.listCards({ market: 'CRYPTO' });
    expect(cards.length).toBeGreaterThanOrEqual(1);
    expect(cards.every(c => c.markets.includes('CRYPTO'))).toBe(true);
  });

  it('search finds factors by keyword', () => {
    const results = translator.search('动量');
    expect(results.length).toBeGreaterThanOrEqual(2);
    expect(results.every(r => r.nameCn.includes('动量') || r.domainCn === '动量')).toBe(true);
  });

  it('search works in English', () => {
    const results = translator.search('momentum', 'en');
    expect(results.length).toBeGreaterThanOrEqual(2);
    expect(results.every(r => r.domain === 'momentum' || r.name.toLowerCase().includes('momentum'))).toBe(true);
  });

  it('translate returns bullish for top percentile (higher=favorable)', () => {
    const result = translator.translate({
      factorId: 'MOMENTUM_12M', value: 35, percentile: 95,
    });

    expect(result.signalTier).toBe('strong_bullish');
    expect(result.signalColor).toBe('#22c55e');
    expect(result.currentSignalCn).toContain('信号极强');
    expect(result.suggestionCn.length).toBeGreaterThan(0);
    expect(result.confidence).toBeGreaterThan(0.8);
  });

  it('translate returns strong_bearish for bottom percentile (higher=favorable)', () => {
    const result = translator.translate({
      factorId: 'GROWTH_EPS_3Y', value: -5, percentile: 5,
    });

    expect(result.signalTier).toBe('strong_bearish');
    expect(result.signalColor).toBe('#ef4444');
    expect(result.currentSignalCn).toContain('强烈警告');
  });

  it('translate returns bullish for low volatility (lower=favorable)', () => {
    const result = translator.translate({
      factorId: 'VOL_HISTORICAL', value: 12, percentile: 8,
    });

    expect(result.signalTier).toBe('strong_bullish');
    expect(result.currentSignalCn).toContain('优秀');
  });

  it('translate returns bearish for high volatility (lower=favorable)', () => {
    const result = translator.translate({
      factorId: 'VOL_HISTORICAL', value: 65, percentile: 92,
    });

    expect(result.signalTier).toBe('strong_bearish');
    expect(result.currentSignalCn).toContain('危险');
  });

  it('translate returns neutral for middle percentiles', () => {
    const result = translator.translate({
      factorId: 'MOMENTUM_12M', value: 10, percentile: 50,
    });

    expect(result.signalTier).toBe('neutral');
    expect(result.signalColor).toBe('#94a3b8');
  });

  it('translate handles unknown factor gracefully', () => {
    const result = translator.translate({
      factorId: 'UNKNOWN_FACTOR', value: 1.5, percentile: 60,
    });

    expect(result.signalTier).toBe('neutral');
    expect(result.confidence).toBe(0);
  });

  it('translateBatch sorts by signal strength', () => {
    const inputs: FactorTranslationRequest[] = [
      { factorId: 'MOMENTUM_12M', percentile: 50 },
      { factorId: 'VALUE_EARNINGS_YIELD', percentile: 95 },
      { factorId: 'VOL_HISTORICAL', percentile: 8 },
    ];

    const results = translator.translateBatch(inputs);
    expect(results.length).toBe(3);
    // Strongest signals first (bullish 95 or bearish 8)
    const top = results[0];
    expect(top.signalTier === 'strong_bullish' || top.signalTier === 'strong_bearish').toBe(true);
  });

  it('generateStockSummary produces readable summary', () => {
    const inputs: FactorTranslationRequest[] = [
      { factorId: 'MOMENTUM_12M', percentile: 92 },
      { factorId: 'VALUE_EARNINGS_YIELD', percentile: 45 },
      { factorId: 'VOL_HISTORICAL', percentile: 85 },
      { factorId: 'QUALITY_ROE', percentile: 78 },
    ];

    const result = translator.generateStockSummary('AAPL', inputs);
    expect(result.summary).toContain('AAPL');
    expect(result.summaryCn).toContain('AAPL');
    expect(result.topSignal).toBeDefined();
    expect(result.warningCount).toBeGreaterThanOrEqual(0);
  });

  it('registerCard adds custom factor', () => {
    const custom: FactorCard = {
      factorId: 'CUSTOM_TRANSLATION_1',
      name: 'Custom Factor', nameCn: '自定义因子',
      tagline: 'Custom', taglineCn: '自定义',
      description: 'A custom factor', descriptionCn: '一个自定义因子',
      domain: 'momentum', domainCn: '动量',
      categoryPath: ['Custom'], categoryPathCn: ['自定义'],
      signal: { favorableDirection: 'higher', highMeaning: 'Good', highMeaningCn: '好', lowMeaning: 'Bad', lowMeaningCn: '差', typicalRange: '0-100' },
      usage: { whoShouldUse: 'Anyone', whoShouldUseCn: '任何人', bestMarket: 'US', bestTimeframe: 'Daily', caution: 'None', cautionCn: '无', idealWeightPercent: 5 },
      markets: ['US'], stats: { ic: 0.03, ir: 0.2, sharpeHedge: 0.2 },
      relatedFactorIds: [], complexity: 'beginner',
    };
    translator.registerCard(custom);
    expect(translator.getCard('CUSTOM_TRANSLATION_1')).not.toBeNull();
  });

  it('getStats returns translation statistics', () => {
    translator.translate({ factorId: 'MOMENTUM_12M', percentile: 80 });
    translator.translate({ factorId: 'VALUE_EARNINGS_YIELD', percentile: 60 });

    const stats = translator.getStats();
    expect(stats.totalFactors).toBeGreaterThanOrEqual(12);
    expect(stats.totalTranslations).toBe(2);
    expect(Object.keys(stats.byDomain).length).toBeGreaterThan(0);
    expect(Object.keys(stats.byComplexity).length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// P1-07: FactorSceneBridge
// ═══════════════════════════════════════════════════════════════════════════

describe('R247 P1-07: FactorSceneBridge', () => {
  let bridge: FactorSceneBridge;

  beforeEach(() => {
    resetFactorSceneBridge();
    bridge = factorSceneBridge();
  });

  it('seeds 5 investment scenes', () => {
    const scenes = bridge.listScenes();
    expect(scenes.length).toBe(5);
    expect(scenes.every(s => s.factors.length >= 4)).toBe(true);
  });

  it('getScene returns specific scene', () => {
    const scene = bridge.getScene('defensive-safe');
    expect(scene).not.toBeNull();
    expect(scene!.emoji).toBe('🛡️');
    expect(scene!.riskLevel).toBe('very_low');
  });

  it('getScene returns null for unknown', () => {
    expect(bridge.getScene('nonexistent')).toBeNull();
  });

  it('matchScenes matches conservative user to defensive', () => {
    const prefs: UserPreferences = {
      riskTolerance: 'low', investmentHorizon: 'long',
      goal: 'preservation', preferredMarkets: ['US'],
      maxDrawdownTolerance: -10,
    };

    const matches = bridge.matchScenes(prefs);
    expect(matches.length).toBe(5);
    expect(matches[0].scene.sceneId).toBe('defensive-safe');
    expect(matches[0].matchScore).toBeGreaterThan(60);
  });

  it('matchScenes matches growth user to aggressive', () => {
    const prefs: UserPreferences = {
      riskTolerance: 'high', investmentHorizon: 'medium',
      goal: 'growth', preferredMarkets: ['US'],
      maxDrawdownTolerance: -30,
    };

    const matches = bridge.matchScenes(prefs);
    expect(matches[0].scene.sceneId).toBe('growth-aggressive');
  });

  it('matchScenes matches income user to stable income', () => {
    const prefs: UserPreferences = {
      riskTolerance: 'low', investmentHorizon: 'long',
      goal: 'income', preferredMarkets: ['US'],
      maxDrawdownTolerance: -15,
    };

    const matches = bridge.matchScenes(prefs);
    expect(matches[0].scene.sceneId).toBe('income-stable');
  });

  it('matchScenes matches speculator to high risk', () => {
    const prefs: UserPreferences = {
      riskTolerance: 'high', investmentHorizon: 'short',
      goal: 'speculation', preferredMarkets: ['CRYPTO'],
      maxDrawdownTolerance: -50,
    };

    const matches = bridge.matchScenes(prefs);
    expect(matches[0].scene.sceneId).toBe('speculation-highrisk');
  });

  it('matchScenes matches balanced user', () => {
    const prefs: UserPreferences = {
      riskTolerance: 'medium', investmentHorizon: 'medium',
      goal: 'balanced', preferredMarkets: ['US', 'HK'],
      maxDrawdownTolerance: -20,
    };

    const matches = bridge.matchScenes(prefs);
    expect(matches[0].scene.sceneId).toBe('balanced-moderate');
  });

  it('getBestScene returns single best match', () => {
    const prefs: UserPreferences = {
      riskTolerance: 'high', investmentHorizon: 'medium',
      goal: 'growth', preferredMarkets: ['US'],
      maxDrawdownTolerance: -30,
    };

    const best = bridge.getBestScene(prefs);
    expect(best.scene.sceneId).toBe('growth-aggressive');
  });

  it('generateBundle creates deploy-ready config', () => {
    const bundle = bridge.generateBundle('growth-aggressive', { symbol: 'NVDA', capital: 20000 });

    expect(bundle).not.toBeNull();
    expect(bundle!.sceneNameCn).toBe('积极成长');
    expect(bundle!.backtestConfig.symbol).toBe('NVDA');
    expect(bundle!.backtestConfig.capital).toBe(20000);
    expect(bundle!.factors.length).toBeGreaterThanOrEqual(4);
    expect(bundle!.explanationCn).toContain('NVDA');
    expect(bundle!.explanationCn).toContain('20000');
  });

  it('generateBundle returns null for unknown scene', () => {
    expect(bridge.generateBundle('nonexistent')).toBeNull();
  });

  it('quickStart is alias for generateBundle', () => {
    const bundle = bridge.quickStart('defensive-safe');
    expect(bundle).not.toBeNull();
    expect(bundle!.backtestConfig.symbol).toBe('SPY');
  });

  it('getAllFactors returns union of all scene factors', () => {
    const factors = bridge.getAllFactors();
    expect(factors.length).toBeGreaterThan(10);
    // Some factors appear in multiple scenes
    const uniqueCount = new Set(factors).size;
    expect(uniqueCount).toBe(factors.length); // getAllFactors returns unique
  });

  it('bundle history is tracked', () => {
    bridge.generateBundle('defensive-safe');
    bridge.generateBundle('growth-aggressive');

    const history = bridge.getBundleHistory();
    expect(history.length).toBe(2);
    expect(history[0].sceneId).toBe('defensive-safe');
    expect(history[1].sceneId).toBe('growth-aggressive');
  });

  it('defensive scene factors sum to ~1', () => {
    const scene = bridge.getScene('defensive-safe')!;
    const totalWeight = scene.factors.reduce((sum, f) => sum + f.weight, 0);
    expect(totalWeight).toBeCloseTo(1.0, 1);
  });

  it('growth scene factors sum to ~1', () => {
    const scene = bridge.getScene('growth-aggressive')!;
    const totalWeight = scene.factors.reduce((sum, f) => sum + f.weight, 0);
    expect(totalWeight).toBeCloseTo(1.0, 1);
  });

  it('reset restores seed scenes', () => {
    bridge.generateBundle('growth-aggressive');
    bridge.reset();
    expect(bridge.getBundleHistory().length).toBe(0);
    expect(bridge.listScenes().length).toBe(5);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// P2-28: AIEvidenceBridge
// ═══════════════════════════════════════════════════════════════════════════

describe('R247 P2-28: AIEvidenceBridge', () => {
  let bridge: AIEvidenceBridge;

  beforeEach(() => {
    resetAIEvidenceBridge();
    bridge = aiEvidenceBridge();
  });

  it('builds evidence chain from evidence pieces', () => {
    const evidence: Evidence[] = [
      bridge.createNewsEvidence('AAPL beats Q2 estimates', 'AAPL财报超预期', 'Bloomberg', 'https://bloomberg.com/aapl', Date.now() - 3600000, 'bullish', 'strong'),
      bridge.createFactorEvidence('MOMENTUM_12M', '12M Momentum', '12月动量', 35, 92, 'bullish'),
      bridge.createPriceEvidence('AAPL', 4.2, 1.8),
    ];

    const chain = bridge.buildChain('AAPL looks strong', 'AAPL走势强劲', ['AAPL'], evidence);

    expect(chain.evidencePieces.length).toBe(3);
    expect(chain.tickers).toContain('AAPL');
    expect(chain.summary.bullishCount).toBe(3);
    expect(chain.summary.overallDirection).toBe('bullish');
    expect(chain.summary.confidenceScore).toBeGreaterThan(0);
  });

  it('evidence chain with mixed signals gets correct summary', () => {
    const evidence: Evidence[] = [
      bridge.createNewsEvidence('Great earnings', '财报优秀', 'CNBC', '', Date.now(), 'bullish', 'strong'),
      bridge.createNewsEvidence('Regulatory risk', '监管风险', 'Reuters', '', Date.now(), 'bearish', 'moderate'),
      bridge.createPriceEvidence('AAPL', -1.5, 1.2),
    ];

    const chain = bridge.buildChain('Mixed outlook', '前景分化', ['AAPL'], evidence);

    expect(chain.summary.bullishCount).toBe(1);
    expect(chain.summary.bearishCount).toBe(2);
    expect(chain.summary.strongEvidenceCount).toBe(1);
  });

  it('builds chain from AI reasoning text', () => {
    const { recommendation, chain } = bridge.buildChainFromAI(
      'rec:1', 'AAPL', 'buy',
      'Apple has strong earnings momentum and an analyst upgrade. Revenue growth is robust.',
      'Apple有强劲的盈利动能和分析师上调评级。营收增长稳健。',
      85, '3 months',
    );

    expect(recommendation.ticker).toBe('AAPL');
    expect(recommendation.action).toBe('buy');
    expect(recommendation.confidence).toBe(85);
    expect(recommendation.evidenceChainId).toBe(chain.chainId);
    expect(chain.evidencePieces.length).toBeGreaterThan(0);
  });

  it('createNewsEvidence sets freshness correctly', () => {
    const recent = bridge.createNewsEvidence('H', 'H', 'S', '', Date.now() - 7200000, 'bullish', 'moderate'); // 2h ago
    const stale = bridge.createNewsEvidence('H', 'H', 'S', '', Date.now() - 86400000 * 2, 'bullish', 'weak'); // 2d ago

    expect(recent.source.freshness).toBe('recent'); // >1h but <24h
    expect(stale.source.freshness).toBe('stale');
  });

  it('createFactorEvidence has correct level and category', () => {
    const ev = bridge.createFactorEvidence('F1', 'Factor 1', '因子1', 0.5, 95, 'bullish');

    expect(ev.level).toBe(2);
    expect(ev.category).toBe('factor');
    expect(ev.strength).toBe('strong');
    expect(ev.verifiable).toBe(true);
  });

  it('createPriceEvidence generates correct direction', () => {
    const up = bridge.createPriceEvidence('TSLA', 8.5, 3.2);
    const down = bridge.createPriceEvidence('TSLA', -6.3, 2.8);

    expect(up.direction).toBe('bullish');
    expect(up.strength).toBe('strong');
    expect(down.direction).toBe('bearish');
    expect(down.strength).toBe('strong');
  });

  it('verifyChain scores reliable chain high', () => {
    const evidence: Evidence[] = [
      bridge.createNewsEvidence('Good news', '好消息', 'Bloomberg', 'https://x.com', Date.now() - 600000, 'bullish', 'strong'),
      bridge.createFactorEvidence('F1', 'F1', 'F1', 0.5, 95, 'bullish'),
    ];

    const chain = bridge.buildChain('Good', '好', ['AAPL'], evidence);
    const verification = bridge.verifyChain(chain.chainId);

    expect(verification.isReliable).toBe(true);
    expect(verification.score).toBeGreaterThanOrEqual(60);
    expect(verification.staleEvidenceCount).toBe(0);
  });

  it('verifyChain scores stale chain lower', () => {
    const evidence: Evidence[] = [
      bridge.createNewsEvidence('Old news', '旧新闻', 'Source', '', Date.now() - 86400000 * 3, 'bullish', 'weak'),
    ];

    const chain = bridge.buildChain('Old', '旧', ['AAPL'], evidence);
    const verification = bridge.verifyChain(chain.chainId);

    expect(verification.staleEvidenceCount).toBeGreaterThanOrEqual(1);
    expect(verification.score).toBeLessThan(100);
  });

  it('verifyChain returns null for bad chainId', () => {
    const result = bridge.verifyChain('nonexistent');
    expect(result.chain).toBeNull();
    expect(result.isReliable).toBe(false);
  });

  it('getRecommendation returns full context', () => {
    const { recommendation } = bridge.buildChainFromAI(
      'rec:full', 'NVDA', 'buy',
      'Strong AI chip demand and earnings beat.',
      'AI芯片需求强劲，财报超预期。',
      90, '1 month',
      [bridge.createFactorEvidence('F1', 'F1', 'F1', 0.7, 90, 'bullish')],
    );

    const result = bridge.getRecommendation('rec:full');
    expect(result.recommendation).not.toBeNull();
    expect(result.chain).not.toBeNull();
    expect(result.verification.isReliable).toBe(true);
  });

  it('getChainsForTicker filters by ticker', () => {
    bridge.buildChainFromAI('r1', 'AAPL', 'buy', 'Good', '好', 80, '1m');
    bridge.buildChainFromAI('r2', 'MSFT', 'hold', 'OK', '可以', 60, '3m');

    const aaplChains = bridge.getChainsForTicker('AAPL');
    expect(aaplChains.length).toBe(1);
    expect(aaplChains[0].tickers).toContain('AAPL');
  });

  it('listRecommendations returns all sorted by confidence', () => {
    bridge.buildChainFromAI('r1', 'AAPL', 'buy', 'Great', '很好', 90, '1m');
    bridge.buildChainFromAI('r2', 'MSFT', 'hold', 'OK', '可以', 60, '3m');

    const recs = bridge.listRecommendations();
    expect(recs.length).toBe(2);
    expect(recs[0].confidence).toBeGreaterThanOrEqual(recs[1].confidence);
  });

  it('exportForFrontend produces timeline format', () => {
    const { chain } = bridge.buildChainFromAI('r:export', 'TSLA', 'buy', 'Strong demand', '需求强劲', 85, '1m',
      [bridge.createNewsEvidence('Demand surge', '需求激增', 'Reuters', '', Date.now(), 'bullish', 'strong')],
    );

    const exported = bridge.exportForFrontend(chain.chainId);
    expect(exported).not.toBeNull();
    expect(exported!.timeline.length).toBeGreaterThan(0);
    expect(exported!.timeline[0].position).toBe('top');
    expect(exported!.timeline[exported!.timeline.length - 1].position).toBe('bottom');
  });

  it('exportForFrontend returns null for bad id', () => {
    expect(bridge.exportForFrontend('bad')).toBeNull();
  });

  it('getStats tracks chain + evidence metrics', () => {
    bridge.buildChainFromAI('r1', 'AAPL', 'buy', 'Good', '好', 80, '1m');
    bridge.buildChainFromAI('r2', 'TSLA', 'sell', 'Bad', '坏', 50, '1w');

    const stats = bridge.getStats();
    expect(stats.totalChains).toBe(2);
    expect(stats.totalEvidence).toBeGreaterThan(0);
    expect(stats.avgEvidencePerChain).toBeGreaterThan(0);
  });

  it('reset clears everything', () => {
    bridge.buildChainFromAI('r:rst', 'AAPL', 'buy', 'X', 'X', 50, '1m');
    bridge.reset();

    expect(bridge.getStats().totalChains).toBe(0);
    expect(bridge.listRecommendations().length).toBe(0);
  });

  it('buildChainFromAI with extraEvidence merges sources', () => {
    const extraEvidence: Evidence[] = [
      bridge.createNewsEvidence('Analyst upgrade', '分析师上调', 'TipRanks', 'https://x.com', Date.now(), 'bullish', 'strong'),
      bridge.createFactorEvidence('MOMENTUM_12M', '12M', '12月', 30, 88, 'bullish'),
    ];

    const { chain } = bridge.buildChainFromAI(
      'rec:extra', 'AAPL', 'buy',
      'AAPL has strong momentum and earnings beat.',
      'AAPL有强劲动量和财报超预期。',
      82, '3 months', extraEvidence,
    );

    // AI parsed reasoning + extra evidence
    expect(chain.evidencePieces.length).toBeGreaterThanOrEqual(2);
  });
});

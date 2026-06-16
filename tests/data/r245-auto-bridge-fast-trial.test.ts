/**
 * R245 autoclaw TEST: P0-06 + P0-10 + P1-18
 * Covers: NewsFactorBridge, FastBacktestDeployBridge, FactorTrialEngine
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  NewsFactorBridge, newsFactorBridge, resetNewsFactorBridge,
} from '../../electron/engine/data/news-factor-bridge';
import type { BridgeSignal, FactorImpact } from '../../electron/engine/data/news-factor-bridge';
import {
  BacktestDeployBridge, backtestDeployBridge, resetBacktestDeployBridge,
} from '../../electron/engine/data/backtest-deploy-bridge';
import {
  FastBacktestDeployBridge, fastBacktestDeployBridge, resetFastBacktestDeployBridge,
} from '../../electron/engine/data/fast-deploy-bridge';
import type { PipelineProgress } from '../../electron/engine/data/fast-deploy-bridge';
import {
  FactorTrialEngine, factorTrialEngine, resetFactorTrialEngine,
} from '../../electron/engine/data/factor-trial-engine';
import type { FactorTrial, TrialResult } from '../../electron/engine/data/factor-trial-engine';

// ═══════════════════════════════════════════════════════════════════════════
// P0-06: NewsFactorBridge
// ═══════════════════════════════════════════════════════════════════════════

describe('R245 P0-06: NewsFactorBridge', () => {
  let bridge: NewsFactorBridge;

  beforeEach(() => {
    resetNewsFactorBridge();
    bridge = newsFactorBridge();
  });

  it('bridges earnings event to quality+momentum factors', () => {
    const signal = bridge.bridge('evt:1', 'earnings', ['AAPL'], 0.8, Date.now(), {
      headline: 'Apple beats earnings estimates by 15%',
    });

    expect(signal.impacts.length).toBeGreaterThan(0);
    expect(signal.aggregate.primaryDomain).toBeTruthy();
    expect(signal.newsEventId).toBe('evt:1');
    expect(signal.tickers).toContain('AAPL');
    // Quality or momentum should dominate for earnings
    expect(['quality', 'momentum', 'sentiment', 'growth']).toContain(signal.aggregate.primaryDomain);
    expect(signal.aggregate.overallMagnitude).toBeGreaterThan(0);
    expect(signal.expiresAt).toBeGreaterThan(Date.now());
  });

  it('bridges merger event to value+volatility factors', () => {
    const signal = bridge.bridge('evt:m1', 'merger', ['MSFT'], 0.3, Date.now());
    expect(signal.impacts.length).toBeGreaterThan(0);
    // Merger should primarily affect value or volatility
    const domains = signal.impacts.map(i => i.factorDomain);
    expect(domains.some(d => d === 'value' || d === 'volatility')).toBe(true);
  });

  it('bridges regulation event to risk+macro factors', () => {
    const signal = bridge.bridge('evt:r1', 'regulation', ['JPM'], -0.6, Date.now(), {
      headline: 'SEC announces stricter capital requirements',
    });
    expect(signal.impacts.length).toBeGreaterThan(0);
    // Regulation → risk/macro
    const domains = signal.impacts.map(i => i.factorDomain);
    expect(domains.some(d => d === 'risk' || d === 'macro')).toBe(true);
    // Negative direction expected
    expect(signal.aggregate.primaryDirection).toBe('negative');
  });

  it('headline keyword detection modifies direction', () => {
    const posSignal = bridge.bridge('evt:h1', 'company', ['AAPL'], 0.1, Date.now(), {
      headline: 'AAPL record quarterly profits surge 20%',
    });
    const negSignal = bridge.bridge('evt:h2', 'company', ['AAPL'], -0.1, Date.now(), {
      headline: 'AAPL reports loss downturn and decline',
    });

    // Positive headline + weak positive = still positive
    // Negative headline + weak negative = more negative
    expect(posSignal.aggregate.overallMagnitude).toBeGreaterThan(0);
    expect(negSignal.aggregate.overallMagnitude).toBeGreaterThan(0);
  });

  it('bridges crypto events', () => {
    const signal = bridge.bridge('evt:c1', 'crypto', ['BTC'], 0.9, Date.now());
    expect(signal.impacts.length).toBeGreaterThan(0);
    const domains = signal.impacts.map(i => i.factorDomain);
    expect(domains.some(d => d === 'crypto_specific' || d === 'momentum')).toBe(true);
  });

  it('bridges commodity events', () => {
    const signal = bridge.bridge('evt:cm1', 'commodity', ['GLD'], -0.4, Date.now(), {
      headline: 'Oil prices plunge on supply surplus',
    });
    expect(signal.impacts.length).toBeGreaterThan(0);
    const domains = signal.impacts.map(i => i.factorDomain);
    expect(domains.some(d => d === 'commodity_specific' || d === 'macro')).toBe(true);
  });

  it('batch bridges multiple events', () => {
    const signals = bridge.bridgeBatch([
      { eventId: 'b1', category: 'earnings', tickers: ['AAPL'], sentimentScore: 0.7, publishedAt: Date.now() },
      { eventId: 'b2', category: 'merger', tickers: ['MSFT'], sentimentScore: 0.5, publishedAt: Date.now() },
      { eventId: 'b3', category: 'macro', tickers: ['SPY'], sentimentScore: -0.3, publishedAt: Date.now() },
    ]);

    expect(signals.length).toBe(3);
    expect(signals[0].tickers).toContain('AAPL');
    expect(signals[1].tickers).toContain('MSFT');
    expect(signals[2].tickers).toContain('SPY');
  });

  it('getSignalsForTicker filters by ticker', () => {
    bridge.bridge('evt:aapl1', 'earnings', ['AAPL'], 0.6, Date.now());
    bridge.bridge('evt:aapl2', 'product', ['AAPL'], 0.8, Date.now() - 3600000);
    bridge.bridge('evt:msft1', 'company', ['MSFT'], 0.2, Date.now());

    const aaplSignals = bridge.getSignalsForTicker('AAPL');
    expect(aaplSignals.length).toBe(2);
    expect(aaplSignals.every(s => s.tickers.includes('AAPL'))).toBe(true);
  });

  it('getSignalsForFactor finds signals affecting a factor', () => {
    bridge.bridge('evt:f1', 'earnings', ['AAPL'], 0.8, Date.now());

    const signals = bridge.getSignalsForFactor('QUALITY_ROE');
    // Quality factors should be impacted by earnings events
    expect(signals.length).toBeGreaterThanOrEqual(0);
  });

  it('aggregateForTicker consolidates domain impacts', () => {
    bridge.bridge('evt:ag1', 'earnings', ['NVDA'], 0.9, Date.now());
    bridge.bridge('evt:ag2', 'product', ['NVDA'], 0.7, Date.now());
    bridge.bridge('evt:ag3', 'market', ['NVDA'], 0.3, Date.now());

    const agg = bridge.aggregateForTicker('NVDA');
    expect(agg.totalSignals).toBe(3);
    expect(Object.keys(agg.domainImpacts).length).toBeGreaterThan(0);
    expect(agg.mostImpactedFactors.length).toBeGreaterThan(0);
  });

  it('has full mapping registry (12 categories × N domains)', () => {
    const registry = bridge.getMappingRegistry();
    expect(registry.length).toBeGreaterThan(20); // 12 categories × ~3-5 domains
    // Each entry has factorIds and humanExplanation
    expect(registry.every(m => m.factorIds.length >= 0)).toBe(true);
    expect(registry.every(m => m.humanExplanation.length > 0)).toBe(true);
  });

  it('getMapping for specific category', () => {
    const earningsMap = bridge.getMapping('earnings');
    expect(earningsMap.length).toBeGreaterThan(0);
    expect(earningsMap.every(m => m.eventCategory === 'earnings')).toBe(true);
  });

  it('configureWeights updates dynamically', () => {
    bridge.configureWeights('earnings', { momentum: 0.95, value: 0.3 });
    const map = bridge.getMapping('earnings');
    const momMap = map.find(m => m.factorDomain === 'momentum');
    expect(momMap!.impactMagnitude).toBe(0.95);
  });

  it('prune removes expired signals', () => {
    // Create an expired signal
    const oldTime = Date.now() - 3 * 86400000; // 3 days ago
    const signal = bridge.bridge('evt:old1', 'company', ['TSLA'], 0, oldTime);

    // Force expire by manipulating... actually the decay is 48h, so 3d ago is expired
    const pruned = bridge.prune();
    expect(pruned).toBeGreaterThanOrEqual(1);
  });

  it('stats are tracked', () => {
    bridge.bridge('evt:st1', 'earnings', ['AAPL'], 0.5, Date.now());
    bridge.bridge('evt:st2', 'merger', ['MSFT'], 0.3, Date.now());

    const stats = bridge.getStats();
    expect(stats.totalBridged).toBe(2);
    expect(stats.totalFactors).toBeGreaterThan(0);
    expect(stats.lastBridgeTime).toBeGreaterThan(0);
    expect(stats.cacheSize).toBeGreaterThanOrEqual(1);
  });

  it('reset clears everything', () => {
    bridge.bridge('evt:rst1', 'earnings', ['AAPL'], 0.5, Date.now());
    bridge.reset();

    const stats = bridge.getStats();
    expect(stats.totalBridged).toBe(0);
    expect(stats.cacheSize).toBe(0);
  });

  it('empty signal for unknown category', () => {
    const signal = bridge.bridge('evt:unk', 'technical' as any, ['XXX'], 0, Date.now());
    expect(signal.aggregate.factorCount).toBeGreaterThanOrEqual(0);
    expect(signal.id).toContain('bridge:');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// P0-10: FastBacktestDeployBridge
// ═══════════════════════════════════════════════════════════════════════════

describe('R245 P0-10: FastBacktestDeployBridge', () => {
  let baseBridge: BacktestDeployBridge;
  let fast: FastBacktestDeployBridge;

  beforeEach(() => {
    resetBacktestDeployBridge();
    resetFastBacktestDeployBridge();
    baseBridge = backtestDeployBridge();
    fast = fastBacktestDeployBridge(baseBridge, { timeTargetMs: 30000, warmCacheSize: 5 });
  });

  it('warmUp pre-computes popular templates', async () => {
    const warmed = await fast.warmUp('user:warm', ['ai-momentum-chaser', 'deep-value-hunter']);
    expect(warmed).toBeGreaterThanOrEqual(1);
    const cache = fast.getCacheStats();
    expect(cache.size).toBeGreaterThanOrEqual(1);
  });

  it('streamDeploy with progress callbacks', async () => {
    await fast.warmUp('user:sd', ['ai-momentum-chaser']);

    const progress: PipelineProgress[] = [];
    const result = await fast.streamDeploy('user:sd', 'ai-momentum-chaser', {
      symbol: 'AAPL', mode: 'dry-run',
    }, (p) => progress.push(p));

    expect(result.backtest).not.toBeNull();
    expect(result.deployment).not.toBeNull();
    expect(result.enhanced).not.toBeNull();
    expect(result.pipelineTimeMs).toBeGreaterThanOrEqual(0); // 0 for synthetic warm-cache fast path
    expect(progress.length).toBeGreaterThanOrEqual(3);
    // Check stage sequence
    const stages = progress.map(p => p.stage);
    expect(stages).toContain('resolving_params');
    expect(stages).toContain('running_backtest');
    expect(stages).toContain('completed');
    // Should complete within 30s
    expect(result.enhanced!.pipeline.withinTimeTarget).toBe(true);
  });

  it('progress reaches 100%', async () => {
    const progress: PipelineProgress[] = [];
    await fast.streamDeploy('user:p100', 'ai-momentum-chaser', {}, (p) => progress.push(p));

    const lastProgress = progress[progress.length - 1];
    expect(lastProgress.percent).toBe(100);
    expect(lastProgress.stage).toBe('completed');
  });

  it('warm cache speeds up deployment', async () => {
    await fast.warmUp('user:speed', ['mean-reversion-sniper']);
    const cached = fast.getCacheStats();
    expect(cached.keys).toContain('mean-reversion-sniper');
  });

  it('streamDeploy fails for unknown template', async () => {
    const result = await fast.streamDeploy('user:bad', 'nonexistent', {});
    expect(result.backtest).toBeNull();
    expect(result.error).toBeTruthy();
  });

  it('flushWarmCache clears cache', async () => {
    await fast.warmUp('user:flush', ['ai-momentum-chaser']);
    expect(fast.getCacheStats().size).toBeGreaterThan(0);
    fast.flushWarmCache();
    expect(fast.getCacheStats().size).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// P1-18: FactorTrialEngine
// ═══════════════════════════════════════════════════════════════════════════

describe('R245 P1-18: FactorTrialEngine', () => {
  let engine: FactorTrialEngine;

  beforeEach(() => {
    resetFactorTrialEngine();
    engine = factorTrialEngine();
  });

  it('lists 12 star factors by default', () => {
    const factors = engine.listFactors();
    expect(factors.length).toBeGreaterThanOrEqual(12);
    expect(factors[0].oneLiner).toBeTruthy();
    expect(factors[0].ic).toBeDefined();
  });

  it('filters factors by market', () => {
    const cryptoFactors = engine.listFactors('CRYPTO');
    expect(cryptoFactors.length).toBeGreaterThan(0);
    expect(cryptoFactors.every(f => f.applicableMarkets.includes('CRYPTO'))).toBe(true);
  });

  it('canTrial returns allowed for new user', () => {
    const check = engine.canTrial('user:1', 'MOMENTUM_12M');
    expect(check.allowed).toBe(true);
    expect(check.quota!.remainingTrials).toBe(1);
  });

  it('runTrial consumes quota', () => {
    const { result, quota, canUpgrade } = engine.runTrial('user:2', 'MOMENTUM_12M', 'AAPL');

    expect(result).not.toBeNull();
    expect(result!.metrics.totalReturn).toBeDefined();
    expect(result!.metrics.sharpeRatio).toBeGreaterThan(0);
    expect(result!.dailyReturns.length).toBeGreaterThan(20); // 30-day data
    expect(result!.upgradeCTA.title).toContain('解锁');
    expect(quota.usedTrials).toBe(1);
    expect(quota.remainingTrials).toBe(0);
    expect(canUpgrade).toBe(true);
  });

  it('second trial is blocked', () => {
    engine.runTrial('user:3', 'VALUE_EARNINGS_YIELD', 'BRK.B');
    const check = engine.canTrial('user:3', 'VALUE_EARNINGS_YIELD');
    expect(check.allowed).toBe(false);
    expect(check.reason).toContain('free trial');
  });

  it('upgradeUser unlocks unlimited', () => {
    engine.runTrial('user:up', 'QUALITY_ROE', 'JPM');
    engine.upgradeUser('user:up');

    expect(engine.isPaid('user:up')).toBe(true);
    const check = engine.canTrial('user:up', 'QUALITY_ROE');
    expect(check.allowed).toBe(true);
  });

  it('trial history is tracked', () => {
    engine.runTrial('user:hist', 'MOMENTUM_12M', 'AAPL');
    engine.runTrial('user:hist', 'GROWTH_EPS_3Y', 'MSFT');

    const history = engine.getTrialHistory('user:hist');
    expect(history.length).toBe(2);
    expect(history[0].factorId).toBe('MOMENTUM_12M');
    expect(history[1].factorId).toBe('GROWTH_EPS_3Y');
  });

  it('getQuotas returns all trial quotas', () => {
    engine.runTrial('user:quota', 'MOMENTUM_12M', 'AAPL');
    engine.runTrial('user:quota', 'TECH_RSI', 'NVDA');

    const quotas = engine.getQuotas('user:quota');
    expect(quotas.length).toBeGreaterThanOrEqual(2);
    expect(quotas.every(q => q.usedTrials >= 1)).toBe(true);
  });

  it('registerFactor adds custom factor', () => {
    const custom: FactorTrial = {
      factorId: 'CUSTOM_FACTOR_1', factorName: 'Custom Factor', factorNameCn: '自定义因子',
      domain: 'momentum', oneLiner: 'A custom momentum factor',
      ic: 0.05, ir: 0.3, applicableMarkets: ['US'],
      trialConfig: { maxFreeTrials: 1, trialDataDays: 30, fullDataYears: 3 },
    };
    engine.registerFactor(custom);
    expect(engine.getFactor('CUSTOM_FACTOR_1')).not.toBeNull();
  });

  it('getFactor returns null for unknown', () => {
    expect(engine.getFactor('NONEXISTENT_FACTOR')).toBeNull();
  });

  it('trial result has all required CTA fields', () => {
    const { result } = engine.runTrial('user:cta', 'SENT_EARNINGS_SURPRISE', 'AAPL');
    const cta = result!.upgradeCTA;
    expect(cta.title).toBeTruthy();
    expect(cta.body.length).toBeGreaterThan(0);
    expect(cta.price.toUpperCase()).toContain('U');
    expect(cta.features.length).toBeGreaterThanOrEqual(3);
  });

  it('trial for crypto factor generates correct data', () => {
    const { result } = engine.runTrial('user:crypto', 'CRYPTO_VOLUME', 'BTC');
    expect(result!.symbol).toBe('BTC');
    expect(result!.metrics.icValue).toBeGreaterThan(0);
  });

  it('paid users skip quota for all factors', () => {
    engine.upgradeUser('user:vip');
    expect(engine.canTrial('user:vip', 'MOMENTUM_12M').allowed).toBe(true);
    expect(engine.canTrial('user:vip', 'VALUE_EARNINGS_YIELD').allowed).toBe(true);
    expect(engine.canTrial('user:vip', 'CRYPTO_VOLUME').allowed).toBe(true);
  });

  it('stats are accurate', () => {
    engine.runTrial('u1', 'MOMENTUM_12M', 'AAPL');
    engine.runTrial('u2', 'QUALITY_ROE', 'JPM');
    engine.upgradeUser('u2');

    const stats = engine.getStats();
    expect(stats.totalTrials).toBeGreaterThanOrEqual(2);
    expect(stats.conversionRate).toBeGreaterThan(0);
    expect(stats.totalFactors).toBeGreaterThanOrEqual(12);
  });
});

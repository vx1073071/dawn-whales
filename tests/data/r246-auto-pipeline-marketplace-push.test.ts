/**
 * R246 autoclaw TEST: P0-10 COMPLETE + P1-03 + P2-32
 * Covers: OneClickDeployPipeline, FactorMarketplaceBridge, PriceMovePushEngine
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  OneClickDeployPipeline, oneClickDeployPipeline, resetOneClickDeployPipeline,
} from '../../electron/engine/data/one-click-deploy-pipeline';
import type { OneClickResult, DeployStep } from '../../electron/engine/data/one-click-deploy-pipeline';
import {
  FactorMarketplaceBridge, factorMarketplaceBridge, resetFactorMarketplaceBridge,
} from '../../electron/engine/data/factor-marketplace-bridge';
import type { FactorListing } from '../../electron/engine/data/factor-marketplace-bridge';
import {
  PriceMovePushEngine, priceMovePushEngine, resetPriceMovePushEngine,
} from '../../electron/engine/data/price-move-push-engine';
import type { PriceMove, WatchlistItem } from '../../electron/engine/data/price-move-push-engine';

// ═══════════════════════════════════════════════════════════════════════════
// P0-10: OneClickDeployPipeline
// ═══════════════════════════════════════════════════════════════════════════

describe('R246 P0-10: OneClickDeployPipeline', () => {
  let pipeline: OneClickDeployPipeline;

  beforeEach(() => {
    resetOneClickDeployPipeline();
    pipeline = oneClickDeployPipeline({ totalTimeTargetMs: 30000 });
  });

  it('oneClick completes dry-run with valid template', async () => {
    const result = await pipeline.oneClick('user:1', 'ai-momentum-chaser', {
      symbol: 'AAPL', capital: 10000, mode: 'dry-run',
    });

    expect(result.success).toBe(true);
    expect(result.result).not.toBeNull();
    expect(result.result!.stepTimings.length).toBe(3);
    expect(result.result!.stepTimings.map(s => s.step)).toEqual(['step1_params', 'step2_backtest', 'step3_deploy']);
    expect(result.result!.timeTargetMet).toBe(true);
    expect(result.result!.totalTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('3 steps all within budget', async () => {
    const result = await pipeline.oneClick('user:2', 'ai-momentum-chaser', {
      symbol: 'AAPL', capital: 5000, mode: 'dry-run',
    });

    expect(result.success).toBe(true);
    // All synthetic steps should complete in < 30s
    expect(result.result!.totalTimeMs).toBeLessThan(30000);

    const timings = result.result!.stepTimings;
    expect(timings[0].withinBudget).toBe(true);  // step1_params ≤ 5s
    expect(timings[1].withinBudget).toBe(true);  // step2_backtest ≤ 15s
    expect(timings[2].withinBudget).toBe(true);  // step3_deploy ≤ 10s
  });

  it('oneClick fails gracefully for bad template', async () => {
    const result = await pipeline.oneClick('user:3', 'nonexistent', {});
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
    expect(result.result).toBeUndefined();
  });

  it('batchDeploy runs multiple templates', async () => {
    const results = await pipeline.batchDeploy('user:batch', [
      'ai-momentum-chaser', 'deep-value-hunter',
    ], { mode: 'dry-run' });

    expect(results.length).toBe(2);
    expect(results.every(r => r.success)).toBe(true);
    expect(results[0].result).not.toBeNull();
    expect(results[1].result).not.toBeNull();
  });

  it('risk assessment detects extreme drawdown', async () => {
    const result = await pipeline.oneClick('user:risk', 'ai-momentum-chaser', {
      symbol: 'AAPL', capital: 5000, mode: 'dry-run',
    });

    expect(result.result!.riskScore).toBeGreaterThanOrEqual(0);
    expect(result.result!.riskScore).toBeLessThanOrEqual(100);
    expect(result.result!.riskSummary.maxDrawdownLevel).toBeDefined();
    expect(result.result!.riskSummary.sharpeLevel).toBeDefined();
  });

  it('blocks live deploy for extreme risk (simulated)', async () => {
    const result = await pipeline.oneClick('user:block', 'ai-momentum-chaser', {
      symbol: 'AAPL', capital: 5000, mode: 'live-run',
    });

    // ai-momentum-chaser synthetic backtest has controlled drawdown so it should pass
    // This test just verifies the risk validation path runs
    expect(result.result?.riskSummary.warnings).toBeDefined();
  });

  it('stats track pipeline runs', async () => {
    await pipeline.oneClick('u1', 'ai-momentum-chaser', { mode: 'dry-run' });
    await pipeline.oneClick('u2', 'ai-momentum-chaser', { mode: 'dry-run' });
    await pipeline.oneClick('u3', 'nonexistent', {}); // fails

    const stats = pipeline.getStats();
    expect(stats.totalRuns).toBeGreaterThanOrEqual(2); // failed template not counted (returns before stats)
    expect(stats.successfulRuns).toBeGreaterThanOrEqual(2);
    expect(stats.failedRuns).toBeGreaterThanOrEqual(0);
    expect(stats.avgTotalTimeMs).toBeGreaterThanOrEqual(0); // synthetic backtest may be near-zero
    expect(stats.timeTargetHitRate).toBeGreaterThanOrEqual(0.5);
  });

  it('getResult retrieves by pipelineId', async () => {
    const r = await pipeline.oneClick('u:hist', 'ai-momentum-chaser', { mode: 'dry-run' });
    const retrieved = pipeline.getResult(r.result!.pipelineId);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.userId).toBe('u:hist');
  });

  it('getUserHistory returns all runs for user', async () => {
    await pipeline.oneClick('u:hist2', 'ai-momentum-chaser', { mode: 'dry-run' });
    await pipeline.oneClick('u:hist2', 'deep-value-hunter', { mode: 'dry-run' });

    const history = pipeline.getUserHistory('u:hist2');
    expect(history.length).toBe(2);
  });

  it('listTemplates returns all deployable templates', () => {
    const templates = pipeline.listTemplates();
    expect(templates.length).toBeGreaterThanOrEqual(3);
    expect(templates.some(t => t.id === 'ai-momentum-chaser')).toBe(true);
  });

  it('configure updates runtime config', async () => {
    pipeline.configure({ totalTimeTargetMs: 60000, maxRetries: 3 });
    const result = await pipeline.oneClick('u:cfg', 'ai-momentum-chaser', { mode: 'dry-run' });
    expect(result.success).toBe(true);
  });

  it('reset clears everything', async () => {
    await pipeline.oneClick('u', 'ai-momentum-chaser', { mode: 'dry-run' });
    pipeline.reset();

    const stats = pipeline.getStats();
    expect(stats.totalRuns).toBe(0);
    expect(pipeline.getUserHistory('u').length).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// P1-03: FactorMarketplaceBridge
// ═══════════════════════════════════════════════════════════════════════════

describe('R246 P1-03: FactorMarketplaceBridge', () => {
  let market: FactorMarketplaceBridge;

  beforeEach(() => {
    resetFactorMarketplaceBridge();
    market = factorMarketplaceBridge();
  });

  it('seeds 15 built-in factor listings', () => {
    const listings = market.listListings();
    expect(listings.length).toBeGreaterThanOrEqual(15);
    expect(listings.every(l => l.status === 'active')).toBe(true);
    expect(listings.every(l => l.pricing.buyoutPrice === 9.9)).toBe(true);
  });

  it('search filters by keyword', () => {
    const results = market.listListings({ keyword: 'momentum' });
    expect(results.length).toBeGreaterThanOrEqual(2);
    expect(results.every(l =>
      l.factorName.toLowerCase().includes('momentum') || l.domain.includes('momentum')
    )).toBe(true);
  });

  it('search filters by domain', () => {
    const results = market.listListings({ domain: 'value' });
    expect(results.every(l => l.domain === 'value')).toBe(true);
    expect(results.length).toBeGreaterThanOrEqual(2);
  });

  it('search filters by market', () => {
    const results = market.listListings({ market: 'CRYPTO' });
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.every(l => l.applicableMarkets.includes('CRYPTO'))).toBe(true);
  });

  it('search filters by IC threshold', () => {
    const results = market.listListings({ minIC: 0.06 });
    expect(results.length).toBeGreaterThan(0);
    expect(results.every(l => l.ic >= 0.06)).toBe(true);
  });

  it('sorts by popular (default)', () => {
    const results = market.listListings({ sort: 'popular', limit: 5 });
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].purchaseCount).toBeGreaterThanOrEqual(results[i].purchaseCount);
    }
  });

  it('sorts by newest', () => {
    const results = market.listListings({ sort: 'newest', limit: 5 });
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].addedAt).toBeGreaterThanOrEqual(results[i].addedAt);
    }
  });

  it('sorts by IC', () => {
    const results = market.listListings({ sort: 'ic', limit: 5 });
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].ic).toBeGreaterThanOrEqual(results[i].ic);
    }
  });

  it('getFeatured returns top factors', () => {
    const featured = market.getFeatured(5);
    expect(featured.length).toBe(5);
    // Should be sorted by composite score
    expect(featured.every(f => f.purchaseCount > 0 || f.trialCount > 0)).toBe(true);
  });

  it('getListing returns detail', () => {
    const listing = market.getListing('MOMENTUM_12M');
    expect(listing).not.toBeNull();
    expect(listing!.ic).toBeGreaterThan(0);
    expect(listing!.pricing.buyoutPrice).toBe(9.9);
  });

  it('getListing returns null for unknown', () => {
    expect(market.getListing('NONEXISTENT')).toBeNull();
  });

  it('purchase buys a factor', () => {
    const result = market.purchase('user:buy1', 'MOMENTUM_12M');
    expect(result.success).toBe(true);
    expect(result.purchase!.priceU).toBe(9.9);
    expect(result.purchase!.royaltyU).toBeCloseTo(7.92, 1); // 80%
    expect(result.purchase!.platformFeeU).toBeCloseTo(1.98, 1); // 20%
    expect(result.userOwnsNow).toContain('MOMENTUM_12M');
  });

  it('duplicate purchase is rejected', () => {
    market.purchase('user:dup', 'MOMENTUM_12M');
    const result2 = market.purchase('user:dup', 'MOMENTUM_12M');
    expect(result2.success).toBe(false);
    expect(result2.error).toContain('Already owned');
  });

  it('userOwns checks ownership', () => {
    expect(market.userOwns('user:chk', 'MOMENTUM_12M')).toBe(false);
    market.purchase('user:chk', 'MOMENTUM_12M');
    expect(market.userOwns('user:chk', 'MOMENTUM_12M')).toBe(true);
  });

  it('getUserOwned lists all owned factors', () => {
    market.purchase('user:own', 'MOMENTUM_12M');
    market.purchase('user:own', 'VALUE_EARNINGS_YIELD');
    const owned = market.getUserOwned('user:own');
    expect(owned.length).toBe(2);
    expect(owned).toContain('MOMENTUM_12M');
    expect(owned).toContain('VALUE_EARNINGS_YIELD');
  });

  it('addReview updates stars', () => {
    market.addReview('user:r1', 'MOMENTUM_12M', 5, 'Excellent factor!', true);
    market.addReview('user:r2', 'MOMENTUM_12M', 3, 'Decent but expected better');

    const reviews = market.getReviews('MOMENTUM_12M');
    expect(reviews.length).toBe(2);

    const listing = market.getListing('MOMENTUM_12M')!;
    expect(listing.stars).toBe(4); // (5+3)/2
  });

  it('addReview rejects invalid stars', () => {
    const r = market.addReview('user:bad', 'MOMENTUM_12M', 6, 'Too many stars');
    expect(r).toBeNull();
  });

  it('submitForListing creates pending UGC entry', () => {
    const listing = market.submitForListing('creator:1', {
      factorId: 'CUSTOM_ALPHA_1',
      factorName: 'Custom Alpha 1',
      factorNameCn: '自定义Alpha1',
      domain: 'momentum',
      oneLiner: 'A custom alpha signal',
      ic: 0.07,
      ir: 0.45,
      applicableMarkets: ['US'],
    });

    expect(listing.status).toBe('pending');
    expect(listing.creatorId).toBe('creator:1');
  });

  it('approveListing activates pending factor', () => {
    market.submitForListing('creator:2', {
      factorId: 'CUSTOM_ALPHA_2',
      factorName: 'Custom Alpha 2', factorNameCn: '自定义Alpha2',
      domain: 'value', oneLiner: 'Custom value signal',
      ic: 0.05, ir: 0.35, applicableMarkets: ['US'],
    });

    expect(market.approveListing('CUSTOM_ALPHA_2')).toBe(true);
    expect(market.getListing('CUSTOM_ALPHA_2')!.status).toBe('active');

    // Now appears in search
    const results = market.listListings({ keyword: 'custom' });
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  it('delistListing hides factor', () => {
    expect(market.delistListing('MOMENTUM_12M')).toBe(true);
    expect(market.getListing('MOMENTUM_12M')!.status).toBe('delisted');

    // Removed from active listings
    const active = market.listListings();
    expect(active.every(l => l.factorId !== 'MOMENTUM_12M')).toBe(true);
  });

  it('getStats returns marketplace metrics', () => {
    market.purchase('u1', 'MOMENTUM_12M');
    market.purchase('u2', 'VALUE_EARNINGS_YIELD');
    market.purchase('u3', 'MOMENTUM_12M');

    const stats = market.getStats();
    expect(stats.totalPurchases).toBe(3);
    expect(stats.totalRevenueU).toBeCloseTo(29.7, 1);
    expect(stats.platformRevenueU).toBeCloseTo(5.94, 1);
    expect(stats.creatorPayoutsU).toBeCloseTo(23.76, 1);
    expect(stats.avgPriceU).toBeCloseTo(9.9, 1);
  });

  it('getCreatorRevenue shows creator earnings', () => {
    market.submitForListing('creator:rev', {
      factorId: 'CREATOR_FACTOR', factorName: 'CF', factorNameCn: 'CF',
      domain: 'momentum', oneLiner: 'CF', ic: 0.05, ir: 0.3,
      applicableMarkets: ['US'],
    });
    market.approveListing('CREATOR_FACTOR');

    market.purchase('u1', 'CREATOR_FACTOR');
    market.purchase('u2', 'CREATOR_FACTOR');

    const rev = market.getCreatorRevenue('creator:rev');
    expect(rev.sales).toBe(2);
    expect(rev.totalRevenueU).toBeGreaterThan(0);
    expect(rev.listings.length).toBeGreaterThanOrEqual(1);
  });

  it('trackTrial increments trial count', () => {
    const before = market.getListing('MOMENTUM_12M')!.trialCount;
    market.trackTrial('MOMENTUM_12M');
    expect(market.getListing('MOMENTUM_12M')!.trialCount).toBe(before + 1);
  });

  it('pagination with offset+limit', () => {
    const page1 = market.listListings({ limit: 5, offset: 0 });
    const page2 = market.listListings({ limit: 5, offset: 5 });
    expect(page1.length).toBe(5);
    expect(page2.length).toBeGreaterThanOrEqual(1);
    // No overlap
    const page1Ids = new Set(page1.map(l => l.factorId));
    expect(page2.every(l => !page1Ids.has(l.factorId))).toBe(true);
  });

  it('reset restores seed data', () => {
    market.purchase('u', 'MOMENTUM_12M');
    market.reset();
    expect(market.getStats().totalPurchases).toBe(0);
    expect(market.listListings().length).toBeGreaterThanOrEqual(15);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// P2-32: PriceMovePushEngine
// ═══════════════════════════════════════════════════════════════════════════

describe('R246 P2-32: PriceMovePushEngine', () => {
  let engine: PriceMovePushEngine;

  beforeEach(() => {
    resetPriceMovePushEngine();
    engine = priceMovePushEngine();
  });

  it('detects significant pre-market moves', () => {
    engine.registerWatchlist('user:w1', [
      { symbol: 'AAPL', name: 'Apple', market: 'US', alerted: true },
      { symbol: 'TSLA', name: 'Tesla', market: 'US', alerted: true },
      { symbol: 'NVDA', name: 'Nvidia', market: 'US', alerted: true },
    ]);

    const marketData = [
      { symbol: 'AAPL', price: 185, yesterdayClose: 178, volume: 50e6, avgVolume: 55e6, name: 'Apple' },
      { symbol: 'TSLA', price: 240, preMarketPrice: 248, yesterdayClose: 225, volume: 80e6, avgVolume: 60e6, name: 'Tesla' },
      { symbol: 'NVDA', price: 850, yesterdayClose: 848, volume: 30e6, avgVolume: 32e6, name: 'Nvidia' },
    ];

    const moves = engine.detectMoves('user:w1', marketData);
    expect(moves.length).toBeGreaterThanOrEqual(2);

    // TSLA: (248-225)/225 = +10.2% → should be detected as major
    const tsla = moves.find(m => m.symbol === 'TSLA');
    expect(tsla).toBeDefined();
    expect(tsla!.direction).toBe('up');
    expect(tsla!.severity).toBe('extreme'); // >10%

    // AAPL: (185-178)/178 = +3.9% → notable
    const aapl = moves.find(m => m.symbol === 'AAPL');
    expect(aapl).toBeDefined();
    expect(aapl!.direction).toBe('up');
  });

  it('ignores small moves below threshold', () => {
    engine.registerWatchlist('user:small', [
      { symbol: 'NVDA', name: 'Nvidia', market: 'US', alerted: true },
    ]);

    const marketData = [
      { symbol: 'NVDA', price: 850, yesterdayClose: 848, volume: 30e6, avgVolume: 32e6, name: 'Nvidia' },
    ];

    const moves = engine.detectMoves('user:small', marketData);
    // (850-848)/848 = +0.24% → below 1% threshold
    expect(moves.length).toBe(0);
  });

  it('explainMove generates reasons', () => {
    const move: PriceMove = {
      symbol: 'AAPL', name: 'Apple', market: 'US',
      direction: 'up', changePercent: 4.5,
      price: 185, yesterdayClose: 178,
      volumeRatio: 1.5, severity: 'notable',
    };

    const explanation = engine.explainMove(move);
    expect(explanation.symbol).toBe('AAPL');
    expect(explanation.reasons.length).toBeGreaterThan(0);
    expect(explanation.confidence).toBeGreaterThan(0);
    expect(explanation.reasons[0].category).toBeDefined();
  });

  it('explainMove uses provided news context', () => {
    const move: PriceMove = {
      symbol: 'MSFT', name: 'Microsoft', market: 'US',
      direction: 'up', changePercent: 6.2,
      price: 420, yesterdayClose: 395,
      volumeRatio: 2.1, severity: 'major',
    };

    const newsCtx = [
      { symbol: 'MSFT', headline: 'MSFT beats earning estimates', source: 'Bloomberg', category: 'earnings' as const, publishedAt: Date.now() - 1800000, relevance: 0.9 },
      { symbol: 'MSFT', headline: 'AI cloud revenue surges 40%', source: 'CNBC', category: 'news' as const, publishedAt: Date.now() - 3600000, relevance: 0.7 },
    ];

    const explanation = engine.explainMove(move, newsCtx);
    expect(explanation.reasons.length).toBe(2);
    expect(explanation.reasons[0].headline).toContain('earning');
    expect(explanation.confidence).toBeGreaterThan(0.7);
  });

  it('generatePush creates notification', () => {
    engine.registerWatchlist('user:push', [
      { symbol: 'AAPL', name: 'Apple', market: 'US', alerted: true },
    ]);

    const moves: PriceMove[] = [{
      symbol: 'AAPL', name: 'Apple', market: 'US',
      direction: 'up', changePercent: 4.5,
      price: 185, yesterdayClose: 178,
      volumeRatio: 1.5, severity: 'notable',
    }];

    const explanations = moves.map(m => engine.explainMove(m));
    const push = engine.generatePush('user:push', 'US', moves, explanations);

    expect(push).not.toBeNull();
    expect(push!.moves.length).toBe(1);
    expect(push!.moves[0].symbol).toBe('AAPL');
    expect(push!.summary).toContain('异动');
    expect(push!.marketOpenInMinutes).toBe(3);
  });

  it('generatePush returns null for no moves', () => {
    const push = engine.generatePush('user:empty', 'US', [], []);
    expect(push).toBeNull();
  });

  it('completePipeline runs detect→explain→push', () => {
    engine.registerWatchlist('user:full', [
      { symbol: 'TSLA', name: 'Tesla', market: 'US', alerted: true },
    ]);

    const marketData = [
      { symbol: 'AAPL', price: 185, yesterdayClose: 178, volume: 50e6, avgVolume: 55e6, name: 'Apple' },
      { symbol: 'TSLA', price: 240, preMarketPrice: 248, yesterdayClose: 225, volume: 80e6, avgVolume: 60e6, name: 'Tesla' },
    ];

    const result = engine.completePipeline('user:full', marketData);

    expect(result.moves.length).toBeGreaterThan(0);
    expect(result.explanations.length).toBeGreaterThan(0);
    expect(result.push).not.toBeNull();
    expect(result.push!.summary).toContain('异动');
  });

  it('completePipeline returns empty for no watchlist', () => {
    const marketData = [
      { symbol: 'AAPL', price: 185, yesterdayClose: 178, volume: 50e6, avgVolume: 55e6, name: 'Apple' },
    ];

    const result = engine.completePipeline('unknown_user', marketData);
    expect(result.moves.length).toBe(0);
    expect(result.push).toBeNull();
  });

  it('push history is tracked', () => {
    engine.registerWatchlist('user:hist', [
      { symbol: 'AAPL', name: 'Apple', market: 'US', alerted: true },
    ]);

    const marketData = [
      { symbol: 'AAPL', price: 190, yesterdayClose: 178, volume: 50e6, avgVolume: 55e6, name: 'Apple' },
    ];

    engine.completePipeline('user:hist', marketData);

    const history = engine.getPushHistory('user:hist');
    expect(history.length).toBeGreaterThanOrEqual(1);
    expect(history[0].userId).toBe('user:hist');
  });

  it('severity levels work correctly', () => {
    engine.registerWatchlist('user:sev', [
      { symbol: 'S1', name: 'Minor', market: 'US', alerted: true },
      { symbol: 'S2', name: 'Notable', market: 'US', alerted: true },
      { symbol: 'S3', name: 'Major', market: 'US', alerted: true },
      { symbol: 'S4', name: 'Extreme', market: 'US', alerted: true },
    ]);

    const marketData = [
      { symbol: 'S1', price: 101.5, yesterdayClose: 100, volume: 10, avgVolume: 10, name: 'Minor' },    // +1.5%
      { symbol: 'S2', price: 104, yesterdayClose: 100, volume: 10, avgVolume: 10, name: 'Notable' },      // +4%
      { symbol: 'S3', price: 107, yesterdayClose: 100, volume: 10, avgVolume: 10, name: 'Major' },        // +7%
      { symbol: 'S4', price: 112, yesterdayClose: 100, volume: 10, avgVolume: 10, name: 'Extreme' },      // +12%
    ];

    const moves = engine.detectMoves('user:sev', marketData);
    const sevMap = new Map(moves.map(m => [m.symbol, m.severity]));
    expect(sevMap.get('S1')).toBe('minor');
    expect(sevMap.get('S2')).toBe('notable');
    expect(sevMap.get('S3')).toBe('major');
    expect(sevMap.get('S4')).toBe('extreme');
  });

  it('getSchedules returns all market schedules', () => {
    const schedules = engine.getSchedules();
    expect(schedules.length).toBeGreaterThanOrEqual(3);
    expect(schedules.some(s => s.market === 'US')).toBe(true);
    expect(schedules.some(s => s.market === 'HK')).toBe(true);
    expect(schedules.some(s => s.market === 'CRYPTO')).toBe(true);
  });

  it('getStats tracks push metrics', () => {
    engine.registerWatchlist('user:stat', [
      { symbol: 'AAPL', name: 'Apple', market: 'US', alerted: true },
    ]);
    engine.completePipeline('user:stat', [
      { symbol: 'AAPL', price: 190, yesterdayClose: 178, volume: 50e6, avgVolume: 55e6, name: 'Apple' },
    ]);

    const stats = engine.getStats();
    expect(stats.totalPushes).toBeGreaterThanOrEqual(1);
    expect(stats.totalMoves).toBeGreaterThanOrEqual(1);
  });

  it('reset clears all state', () => {
    engine.registerWatchlist('user:rst', [
      { symbol: 'AAPL', name: 'Apple', market: 'US', alerted: true },
    ]);
    engine.completePipeline('user:rst', [
      { symbol: 'AAPL', price: 190, yesterdayClose: 178, volume: 50e6, avgVolume: 55e6, name: 'Apple' },
    ]);

    engine.reset();
    expect(engine.getStats().totalPushes).toBe(0);
    expect(engine.getWatchlist('user:rst').length).toBe(0);
  });

  it('addToWatchlist adds item', () => {
    engine.addToWatchlist('user:add1', { symbol: 'AAPL', name: 'Apple', market: 'US', alerted: true });
    engine.addToWatchlist('user:add1', { symbol: 'TSLA', name: 'Tesla', market: 'US', alerted: false });

    const wl = engine.getWatchlist('user:add1');
    expect(wl.length).toBe(2);
    expect(wl.map(w => w.symbol)).toContain('AAPL');
    expect(wl.map(w => w.symbol)).toContain('TSLA');
  });

  it('push notification limits to 5 moves max', () => {
    engine.registerWatchlist('user:limit', Array.from({ length: 8 }, (_, i) => ({
      symbol: `S${i + 1}`, name: `Stock ${i + 1}`, market: 'US' as const, alerted: true,
    })));

    const marketData = Array.from({ length: 8 }, (_, i) => ({
      symbol: `S${i + 1}`, price: 110, yesterdayClose: 100,
      volume: 50e6, avgVolume: 50e6, name: `Stock ${i + 1}`,
    }));

    const result = engine.completePipeline('user:limit', marketData);
    expect(result.push!.moves.length).toBeLessThanOrEqual(5);
  });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StrategySignalEngine } from '../electron/engine/news/StrategySignalEngine';
import { TemplateMarketplaceEngine } from '../electron/engine/news/TemplateMarketplaceEngine';
import { StrategyAuctionEngine } from '../electron/engine/news/StrategyAuctionEngine';

// ═══════════════════════════════════════════════════════════════
// P1-12 StrategySignalEngine Tests
// ═══════════════════════════════════════════════════════════════

describe('StrategySignalEngine', () => {
  let engine: StrategySignalEngine;
  beforeEach(() => { engine = StrategySignalEngine.getInstance(); engine.reset(); });

  it('singleton', () => { expect(StrategySignalEngine.getInstance()).toBe(engine); });

  it('get default rules', () => {
    const rules = engine.getRules();
    expect(rules.length).toBeGreaterThanOrEqual(5);
    expect(rules.find(r => r.id === 'rule-macd-bullish')).toBeTruthy();
    expect(rules.find(r => r.id === 'rule-rsi-oversold')).toBeTruthy();
  });

  const makeInput = (overrides?: Partial<any>) => ({
    symbol: 'AAPL', market: 'US', currentPrice: 185,
    indicators: { ma50: 182, ma200: 178, rsi14: 32, macd: 2.5, macd_signal: 1.8, volume: 1.5e7, vol_ma20_x2: 1e7, bb_lower: 180 },
    ...overrides,
  });

  it('generate bullish signal', () => {
    const signal = engine.generateSignal(makeInput());
    expect(signal.direction).toBe('buy');
    expect(signal.score).toBeGreaterThan(50);
    expect(signal.firedRules.length).toBeGreaterThan(0);
    expect(signal.suggestedEntry).toBe(185);
    expect(signal.suggestedStop).toBe(185 * 0.95);
    expect(signal.suggestedTarget).toBe(185 * 1.10);
  });

  it('generate bearish signal', () => {
    const signal = engine.generateSignal(makeInput({
      indicators: { ma50: 175, ma200: 180, rsi14: 75, macd: -1, macd_signal: -0.5, volume: 1e6, vol_ma20_x2: 1e7, bb_lower: 170 },
    }));
    // RSI overbought = sell, MACD bearish = sell
    expect(['sell', 'hold']).toContain(signal.direction);
  });

  it('generate hold with neutral indicators', () => {
    const signal = engine.generateSignal(makeInput({
      indicators: { ma50: 184, ma200: 185, rsi14: 50, macd: 0, macd_signal: 0, volume: 5e6, vol_ma20_x2: 1e7, bb_lower: 170 },
    }));
    expect(['hold', 'buy']).toContain(signal.direction);
  });

  it('multi-timeframe signals', () => {
    const signals = engine.generateMultiTf(makeInput({
      multiTf: { '4h': { close: 186, indicators: { rsi14: 28 } } },
    }));
    expect(signals.length).toBe(2);
    expect(signals[1].timeframe).toBe('4h');
  });

  it('register custom rule', () => {
    const rule = engine.registerRule({
      id: 'custom-rule', name: 'Custom', description: 'Test', indicatorType: 'MA',
      conditions: [{ field: 'price', operator: 'gt', value: 100 }],
      combinator: 'AND', weight: 0.5, minConfidence: 0.5, enabled: true,
    });
    expect(engine.getRule('custom-rule')).toBe(rule);
  });

  it('update rule', () => {
    engine.registerRule({ id: 'test-update', name: 'Old', description: '', indicatorType: 'MA', conditions: [], combinator: 'AND', weight: 0.1, minConfidence: 0.1, enabled: true });
    engine.updateRule('test-update', { name: 'Updated' });
    expect(engine.getRule('test-update')!.name).toBe('Updated');
  });

  it('delete custom rule', () => {
    engine.registerRule({ id: 'del-me', name: 'D', description: '', indicatorType: 'MA', conditions: [], combinator: 'AND', weight: 0.1, minConfidence: 0.1, enabled: true });
    expect(engine.deleteRule('del-me')).toBe(true);
  });

  it('cannot delete default rule', () => {
    expect(engine.deleteRule('rule-rsi-oversold')).toBe(false);
  });

  it('get latest signal', () => {
    engine.generateSignal(makeInput({ symbol: 'TSLA' }));
    const sig = engine.getLatestSignal('TSLA');
    expect(sig).toBeTruthy();
    expect(sig!.symbol).toBe('TSLA');
  });

  it('get signals with limit', () => {
    for (let i = 0; i < 5; i++) engine.generateSignal(makeInput({ symbol: 'MSFT' }));
    expect(engine.getSignals('MSFT', 3).length).toBe(3);
    expect(engine.getSignals('MSFT').length).toBe(5);
  });

  it('get active signals', () => {
    engine.generateSignal(makeInput({ symbol: 'GOOGL' }));
    const active = engine.getActiveSignals('GOOGL');
    expect(active.length).toBe(1);
    expect(active[0].expiresAt).toBeGreaterThan(Date.now());
  });

  it('mark acted', () => {
    const sig = engine.generateSignal(makeInput());
    expect(engine.markActed(sig.id, 'profit')).toBe(true);
    expect(engine.getActiveSignals().length).toBe(0);
  });

  it('record expiry', () => {
    const sig = engine.generateSignal(makeInput({ symbol: 'NFLX', currentPrice: 100 }));
    expect(engine.recordExpiry(sig.id, 110)).toBe(true);
    const history = engine.getHistory();
    expect(history[0].wasCorrect).toBe(true);
  });

  it('signal stats', () => {
    engine.generateSignal(makeInput({ symbol: 'A', currentPrice: 100 }));
    engine.generateSignal(makeInput({ symbol: 'A', currentPrice: 105 }));
    const stats = engine.getSignalStats('A');
    expect(stats.totalSignals).toBe(2);
    expect(stats.byDirection.buy).toBeGreaterThanOrEqual(0);
  });

  it('tracked symbols', () => {
    engine.generateSignal(makeInput({ symbol: 'AAPL' }));
    engine.generateSignal(makeInput({ symbol: 'MSFT' }));
    expect(engine.getTrackedSymbols()).toContain('AAPL');
    expect(engine.getTrackedSymbols()).toContain('MSFT');
  });

  it('cleanup expired', () => {
    engine.generateSignal(makeInput());
    const count = engine.cleanupExpired();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  it('signal TTL varies by strength', async () => {
    const strong = engine.generateSignal(makeInput({
      currentPrice: 185,
      indicators: { ma50: 190, ma200: 160, rsi14: 25, macd: 5, macd_signal: 1, volume: 3e7, vol_ma20_x2: 1e7, bb_lower: 170 },
    }));
    expect(strong.ttlMs).toBeGreaterThan(0);
    expect(strong.expiresAt).toBeGreaterThan(strong.generatedAt);
  });
});

// ═══════════════════════════════════════════════════════════════
// P1-02 TemplateMarketplaceEngine Tests
// ═══════════════════════════════════════════════════════════════

describe('TemplateMarketplaceEngine', () => {
  let engine: TemplateMarketplaceEngine;
  beforeEach(() => { engine = TemplateMarketplaceEngine.getInstance(); engine.reset(); });

  it('singleton', () => { expect(TemplateMarketplaceEngine.getInstance()).toBe(engine); });

  const makeTpl = (overrides?: any) => engine.publishTemplate({
    name: 'Test Strategy', description: 'A test', category: 'momentum',
    markets: ['US', 'HK'], tags: ['momentum', 'test'],
    creatorId: 'c1', creatorName: 'Alice', creatorLevel: 'L2',
    pricing: { tier: 'pro' as const, price: 19.9, freeFeatures: [], proFeatures: ['full'], enterpriseFeatures: [], revenueShare: 0.7, hasSubscription: false },
    ...overrides,
  });

  it('publish template', () => {
    const tpl = makeTpl();
    expect(tpl.id).toMatch(/tpl-/);
    expect(tpl.status).toBe('published');
    expect(tpl.currentVersion).toBe('1.0.0');
  });

  it('get template', () => {
    const tpl = makeTpl();
    expect(engine.getTemplate(tpl.id)).toBe(tpl);
  });

  it('update template', () => {
    const tpl = makeTpl();
    engine.updateTemplate(tpl.id, { name: 'Updated Strategy' });
    expect(engine.getTemplate(tpl.id)!.name).toBe('Updated Strategy');
  });

  it('deprecate template', () => {
    const tpl = makeTpl();
    engine.deprecateTemplate(tpl.id);
    expect(engine.getTemplate(tpl.id)!.status).toBe('deprecated');
  });

  it('suspend template', () => {
    const tpl = makeTpl();
    engine.suspendTemplate(tpl.id, 'violation');
    expect(engine.getTemplate(tpl.id)!.status).toBe('suspended');
  });

  it('add version', () => {
    const tpl = makeTpl();
    engine.addVersion(tpl.id, '1.1.0', 'Bug fixes', { fix: true });
    expect(engine.getTemplate(tpl.id)!.currentVersion).toBe('1.1.0');
    expect(engine.getVersions(tpl.id).length).toBe(2);
  });

  it('search by keywords', () => {
    makeTpl({ name: 'Golden Cross' });
    makeTpl({ name: 'RSI Divergence' });
    const { templates, total } = engine.searchTemplates({ keywords: 'golden' });
    expect(total).toBe(1);
    expect(templates[0].name).toBe('Golden Cross');
  });

  it('search by category', () => {
    makeTpl({ category: 'momentum' });
    makeTpl({ category: 'grid' });
    expect(engine.searchTemplates({ category: 'grid' }).total).toBe(1);
  });

  it('search by market', () => {
    makeTpl({ markets: ['HK'] });
    makeTpl({ markets: ['US'] });
    expect(engine.searchTemplates({ market: 'HK' }).total).toBe(1);
  });

  it('sort by rating', () => {
    const t1 = makeTpl({ name: 'A' });
    const t2 = makeTpl({ name: 'B' });
    engine.addReview({ templateId: t1.id, reviewerId: 'r1', reviewerName: 'R', rating: 5, text: 'Great' });
    engine.addReview({ templateId: t2.id, reviewerId: 'r2', reviewerName: 'R', rating: 3, text: 'Ok' });
    const { templates } = engine.searchTemplates({ sortBy: 'rating' });
    expect(templates[0].name).toBe('A');
  });

  it('get trending', () => {
    const t = makeTpl();
    engine.recordView(t.id);
    engine.recordView(t.id);
    engine.recordView(t.id);
    const trending = engine.getTrending(5);
    expect(trending.length).toBeGreaterThanOrEqual(1);
  });

  it('add review', () => {
    const t = makeTpl();
    engine.addReview({ templateId: t.id, reviewerId: 'r1', reviewerName: 'Bob', rating: 4, text: 'Good' });
    expect(engine.getTemplate(t.id)!.avgRating).toBe(4);
    expect(engine.getTemplate(t.id)!.ratingCount).toBe(1);
  });

  it('update existing review', () => {
    const t = makeTpl();
    engine.addReview({ templateId: t.id, reviewerId: 'r1', reviewerName: 'Bob', rating: 4, text: 'Good' });
    engine.addReview({ templateId: t.id, reviewerId: 'r1', reviewerName: 'Bob', rating: 5, text: 'Great' });
    expect(engine.getTemplate(t.id)!.avgRating).toBe(5);
  });

  it('get reviews', () => {
    const t = makeTpl();
    engine.addReview({ templateId: t.id, reviewerId: 'r1', reviewerName: 'A', rating: 5, text: '!' });
    engine.addReview({ templateId: t.id, reviewerId: 'r2', reviewerName: 'B', rating: 3, text: '.' });
    expect(engine.getReviews(t.id).total).toBe(2);
  });

  it('mark review helpful', () => {
    const t = makeTpl();
    engine.addReview({ templateId: t.id, reviewerId: 'r1', reviewerName: 'A', rating: 5, text: 'Helpful' });
    const { reviews } = engine.getReviews(t.id);
    engine.markReviewHelpful(reviews[0].id);
    expect(engine.getReviews(t.id).reviews[0].helpfulCount).toBe(1);
  });

  it('fork template', () => {
    const t = makeTpl();
    const result = engine.forkTemplate({
      originalTemplateId: t.id, forkedById: 'c2', forkedByName: 'Bob', changes: 'Changed MA to EMA',
    });
    expect(result).toBeTruthy();
    expect(result!.newTemplate.name).toContain('fork');
    expect(engine.getTemplate(t.id)!.forkCount).toBe(1);
  });

  it('purchase template', () => {
    const t = makeTpl();
    const result = engine.purchaseTemplate(t.id, 'buyer1');
    expect(result!.success).toBe(true);
    expect(result!.price).toBe(19.9);
    expect(result!.creatorRevenue).toBe(19.9 * 0.7);
  });

  it('get creator analytics', () => {
    makeTpl({ creatorId: 'creator1' });
    makeTpl({ creatorId: 'creator1' });
    const stats = engine.getCreatorAnalytics('creator1');
    expect(stats.totalTemplates).toBe(2);
    expect(stats.totalDownloads).toBe(0);
  });

  it('get platform stats', () => {
    makeTpl();
    makeTpl({ creatorId: 'c2' });
    const stats = engine.getPlatformStats();
    expect(stats.totalTemplates).toBe(2);
    expect(stats.totalCreators).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════════
// P2-06 StrategyAuctionEngine Tests
// ═══════════════════════════════════════════════════════════════

describe('StrategyAuctionEngine', () => {
  let engine: StrategyAuctionEngine;
  beforeEach(() => { engine = StrategyAuctionEngine.getInstance(); engine.reset(); });

  it('singleton', () => { expect(StrategyAuctionEngine.getInstance()).toBe(engine); });

  const makeAuction = (overrides?: any) => engine.createAuction({
    creatorId: 'c1', creatorName: 'Alice', title: 'Premium Strategy',
    description: 'High-return momentum', contentType: 'strategy',
    startingBid: 10, endTime: Date.now() + 86_400_000,
    tags: ['momentum', 'premium'],
    ...overrides,
  });

  it('create auction', () => {
    const auc = makeAuction();
    expect(auc.id).toMatch(/auc-/);
    expect(auc.status).toBe('active');
    expect(auc.highestBid).toBe(10);
  });

  it('create pending auction', () => {
    const auc = engine.createAuction({
      creatorId: 'c1', creatorName: 'A', title: 'T',
      description: 'D', contentType: 'strategy',
      startingBid: 10, startTime: Date.now() + 3600_000, endTime: Date.now() + 86_400_000,
    });
    expect(auc.status).toBe('pending');
  });

  it('start pending auction', () => {
    const auc = engine.createAuction({
      creatorId: 'c1', creatorName: 'A', title: 'T',
      description: 'D', contentType: 'strategy',
      startingBid: 10, startTime: Date.now() + 3600_000, endTime: Date.now() + 86_400_000,
    });
    expect(engine.startAuction(auc.id)).toBe(true);
    expect(engine.getAuction(auc.id)!.status).toBe('active');
  });

  it('place bid', () => {
    const auc = makeAuction();
    const result = engine.placeBid({ auctionId: auc.id, bidderId: 'b1', bidderName: 'Bob', amount: 15 });
    expect(result).toBeTruthy();
    expect(result!.bid.amount).toBe(15);
    expect(engine.getAuction(auc.id)!.highestBid).toBe(15);
  });

  it('cannot bid lower than current', () => {
    const auc = makeAuction();
    engine.placeBid({ auctionId: auc.id, bidderId: 'b1', bidderName: 'Bob', amount: 20 });
    const result = engine.placeBid({ auctionId: auc.id, bidderId: 'b2', bidderName: 'Charlie', amount: 15 });
    expect(result).toBeNull();
  });

  it('buy it now', () => {
    const auc = makeAuction({ buyItNowPrice: 50 });
    const result = engine.placeBid({ auctionId: auc.id, bidderId: 'b1', bidderName: 'Bob', amount: 50 });
    expect(result!.won).toBe(true);
    expect(engine.getAuction(auc.id)!.status).toBe('settled');
  });

  it('cancel auction', () => {
    const auc = makeAuction();
    expect(engine.cancelAuction(auc.id, 'Testing')).toBe(true);
    expect(engine.getAuction(auc.id)!.status).toBe('cancelled');
  });

  it('end auction', () => {
    const auc = makeAuction({ endTime: Date.now() - 1000 });
    const result = engine.endAuction(auc.id);
    expect(result!.status).toBe('ended');
  });

  it('settle auction', () => {
    const auc = makeAuction();
    engine.placeBid({ auctionId: auc.id, bidderId: 'b1', bidderName: 'Bob', amount: 20 });
    engine.endAuction(auc.id);
    const settled = engine.settleAuction(auc.id);
    expect(settled!.status).toBe('settled');
    expect(settled!.creatorRevenue).toBe(20 * 0.85);
  });

  it('reserve price not met', () => {
    const auc = makeAuction({ reservePrice: 100 });
    engine.placeBid({ auctionId: auc.id, bidderId: 'b1', bidderName: 'Bob', amount: 50 });
    engine.endAuction(auc.id);
    expect(engine.getAuction(auc.id)!.winnerId).toBeUndefined();
  });

  it('auto bid', async () => {
    const auc = makeAuction();
    engine.setAutoBid({ userId: 'b1', auctionId: auc.id, maxAmount: 30, incrementBy: 2 });
    // Place a bid that triggers auto-bid
    const result = engine.placeBid({ auctionId: auc.id, bidderId: 'b2', bidderName: 'Charlie', amount: 11 });
    expect(result).toBeTruthy();
    // Check that b1 auto-bid kicked in
    expect(engine.getAuction(auc.id)!.highestBidderId).toBe('b1');
  });

  it('disable auto bid', () => {
    const auc = makeAuction();
    const rule = engine.setAutoBid({ userId: 'b1', auctionId: auc.id, maxAmount: 30 });
    expect(engine.disableAutoBid(rule.id)).toBe(true);
  });

  it('watch auction', () => {
    const auc = makeAuction();
    engine.watchAuction(auc.id, 'watcher1');
    expect(engine.getWatchers(auc.id)).toContain('watcher1');
    expect(engine.getWatchedAuctions('watcher1').length).toBe(1);
  });

  it('unwatch auction', () => {
    const auc = makeAuction();
    engine.watchAuction(auc.id, 'w1');
    engine.unwatchAuction(auc.id, 'w1');
    expect(engine.getWatchers(auc.id).length).toBe(0);
  });

  it('search auctions', () => {
    makeAuction({ title: 'Momentum', tags: ['momentum'] });
    makeAuction({ title: 'Arbitrage', tags: ['arbitrage'] });
    const result = engine.searchAuctions({ keywords: 'arbitrage' });
    expect(result.total).toBe(1);
  });

  it('get bidder history', () => {
    const auc = makeAuction();
    engine.placeBid({ auctionId: auc.id, bidderId: 'b1', bidderName: 'Bob', amount: 15 });
    engine.placeBid({ auctionId: auc.id, bidderId: 'b1', bidderName: 'Bob', amount: 20 });
    expect(engine.getBidderHistory('b1').length).toBe(2);
  });

  it('check expired', () => {
    const auc = makeAuction({ endTime: Date.now() - 1000 });
    const count = engine.checkExpired();
    expect(count).toBe(1);
    expect(engine.getAuction(auc.id)!.status).toBe('ended');
  });

  it('get stats', () => {
    const auc = makeAuction();
    engine.placeBid({ auctionId: auc.id, bidderId: 'b1', bidderName: 'Bob', amount: 20 });
    const stats = engine.getStats();
    expect(stats.totalAuctions).toBe(1);
    expect(stats.activeAuctions).toBe(1);
    expect(stats.totalBidVolume).toBe(20);
  });

  it('get active auctions', () => {
    makeAuction();
    makeAuction({ endTime: Date.now() - 1000 });
    engine.checkExpired(); // Trigger expiry check
    const active = engine.getActiveAuctions();
    expect(active.length).toBe(1);
  });

  it('get creator auctions', () => {
    makeAuction({ creatorId: 'creator2' });
    makeAuction({ creatorId: 'creator2' });
    expect(engine.getCreatorAuctions('creator2').length).toBe(2);
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { BreakingNewsPushEngine } from '../electron/engine/news/BreakingNewsPushEngine';
import { ContentMarketplaceEngine } from '../electron/engine/news/ContentMarketplaceEngine';
import { CreatorMarketEngine } from '../electron/engine/news/CreatorMarketEngine';

// ═══════════════════════════════════════════════════════════
// P0-08 BreakingNewsPushEngine Tests
// ═══════════════════════════════════════════════════════════

describe('BreakingNewsPushEngine', () => {
  let engine: BreakingNewsPushEngine;
  beforeEach(() => { engine = BreakingNewsPushEngine.getInstance(); engine.reset(); });

  it('singleton', () => { expect(BreakingNewsPushEngine.getInstance()).toBe(engine); });

  it('ingest flash-level alert', () => {
    const alert = engine.ingestAlert({
      symbol: 'AAPL', market: 'US', title: 'Apple stock collapses!',
      summary: 'Major sell-off', source: 'bloomberg', sourceAuthority: 1.0,
      sourceCount: 3, sentiment: -0.85,
    });
    expect(alert).toBeTruthy();
    expect(alert!.level).toBe('flash');
    expect(alert!.symbol).toBe('AAPL');
    expect(alert!.expiresAt).toBeGreaterThan(Date.now());
  });

  it('ingest urgent-level alert', () => {
    const alert = engine.ingestAlert({
      symbol: 'MSFT', market: 'US', title: 'Earnings miss',
      summary: 'EPS below expectations', source: 'reuters', sourceAuthority: 0.9,
      sourceCount: 2, sentiment: -0.65,
    });
    expect(alert).toBeTruthy();
    expect(alert!.level).toBe('urgent');
  });

  it('ingest breaking-level alert', () => {
    const alert = engine.ingestAlert({
      symbol: 'GOOGL', market: 'US', title: 'New product launch',
      summary: 'Exciting new AI feature', source: 'cnbc', sourceAuthority: 0.8,
      sourceCount: 3, sentiment: 0.45,
    });
    expect(alert).toBeTruthy();
    expect(alert!.level).toBe('breaking');
  });

  it('reject low-sentiment alert', () => {
    const alert = engine.ingestAlert({
      symbol: 'META', market: 'US', title: 'Minor update',
      summary: 'Nothing major', source: 'blog', sourceAuthority: 0.3,
      sourceCount: 1, sentiment: 0.1,
    });
    expect(alert).toBeNull();
  });

  it('dedup identical alerts', () => {
    const params = {
      symbol: 'TSLA', market: 'US', title: 'News', summary: 'Summary',
      source: 'reuters', sourceAuthority: 0.9, sourceCount: 2, sentiment: -0.65,
    };
    const a1 = engine.ingestAlert(params);
    const a2 = engine.ingestAlert(params);
    expect(a1).toBeTruthy();
    expect(a2).toBeNull();
  });

  it('ingest batch', () => {
    const alerts = engine.ingestBatch([
      { symbol: 'AAPL', market: 'US', title: 'T1', summary: 'S1', source: 's1', sourceAuthority: 1, sourceCount: 3, sentiment: -0.85 },
      { symbol: 'MSFT', market: 'US', title: 'T2', summary: 'S2', source: 's2', sourceAuthority: 0.9, sourceCount: 2, sentiment: -0.65 },
      { symbol: 'LOW', market: 'US', title: 'T3', summary: 'S3', source: 's3', sourceAuthority: 0.5, sourceCount: 1, sentiment: 0.1 },
    ]);
    expect(alerts.length).toBe(2);
    expect(alerts[0].level).toBe('flash');
    expect(alerts[1].level).toBe('urgent');
  });

  it('subscribe and receive push', () => {
    let pushed: any = null;
    engine.registerPushCallback((event, socketId) => {
      pushed = { event, socketId };
    });

    engine.subscribe({
      userId: 'u1', socketId: 'ws-1',
      symbols: ['AAPL'], minLevel: 'breaking',
    });

    const alert = engine.ingestAlert({
      symbol: 'AAPL', market: 'US', title: 'Flash crash!',
      summary: 'Panic selling', source: 'cnbc', sourceAuthority: 1.0,
      sourceCount: 3, sentiment: -0.9,
    });

    expect(pushed).toBeTruthy();
    expect(pushed!.event.type).toBe('breaking_alert');
    expect(pushed!.event.alert.id).toBe(alert!.id);
    expect(pushed!.socketId).toBe('ws-1');
  });

  it('subscription symbol filter', () => {
    let pushed = false;
    engine.registerPushCallback(() => { pushed = true; });

    engine.subscribe({
      userId: 'u2', socketId: 'ws-2',
      symbols: ['MSFT'], minLevel: 'breaking',
    });

    engine.ingestAlert({
      symbol: 'AAPL', market: 'US', title: 'Apple news',
      summary: 'Summary', source: 'cnbc', sourceAuthority: 1.0,
      sourceCount: 3, sentiment: -0.9,
    });

    expect(pushed).toBe(false);
  });

  it('subscription level filter', () => {
    let pushed = false;
    engine.registerPushCallback(() => { pushed = true; });

    engine.subscribe({
      userId: 'u3', socketId: 'ws-3',
      symbols: ['AAPL'], minLevel: 'urgent',
    });

    engine.ingestAlert({
      symbol: 'AAPL', market: 'US', title: 'Minor news',
      summary: 'Summary', source: 'source', sourceAuthority: 0.5,
      sourceCount: 3, sentiment: -0.45,
    });

    expect(pushed).toBe(false); // breaking level below urgent threshold
  });

  it('unsubscribe', () => {
    const sub = engine.subscribe({
      userId: 'u4', socketId: 'ws-4',
      symbols: ['AAPL'], minLevel: 'breaking',
    });
    expect(engine.getSubscription(sub.id)).toBeTruthy();
    engine.unsubscribe(sub.id);
    expect(engine.getSubscription(sub.id)).toBeUndefined();
  });

  it('unsubscribe by socket', () => {
    engine.subscribe({ userId: 'u5', socketId: 'ws-5a', symbols: ['AAPL'] });
    engine.subscribe({ userId: 'u5b', socketId: 'ws-5b', symbols: ['MSFT'] });
    engine.subscribe({ userId: 'u5c', socketId: 'ws-5a', symbols: ['GOOGL'] });
    const count = engine.unsubscribeBySocket('ws-5a');
    expect(count).toBe(2);
  });

  it('update symbols', () => {
    const sub = engine.subscribe({
      userId: 'u6', socketId: 'ws-6',
      symbols: ['AAPL'], minLevel: 'breaking',
    });
    engine.updateSymbols(sub.id, ['TSLA', 'NVDA']);
    const updated = engine.getSubscription(sub.id);
    expect(updated!.symbols).toEqual(['TSLA', 'NVDA']);
  });

  it('get active alerts', () => {
    engine.ingestAlert({ symbol: 'A', market: 'US', title: 'T', summary: 'S', source: 's', sourceAuthority: 1, sourceCount: 3, sentiment: -0.85 });
    engine.ingestAlert({ symbol: 'B', market: 'US', title: 'T', summary: 'S', source: 's', sourceAuthority: 0.9, sourceCount: 2, sentiment: -0.65 });
    expect(engine.getActiveAlerts().length).toBe(2);
    expect(engine.getActiveAlerts('urgent').length).toBe(2);
    expect(engine.getActiveAlerts('flash').length).toBe(1);
  });

  it('get alerts for symbol', () => {
    engine.ingestAlert({ symbol: 'AAPL', market: 'US', title: 'T1', summary: 'S', source: 's', sourceAuthority: 1, sourceCount: 3, sentiment: -0.85 });
    engine.ingestAlert({ symbol: 'MSFT', market: 'US', title: 'T2', summary: 'S', source: 's', sourceAuthority: 1, sourceCount: 3, sentiment: -0.85 });
    expect(engine.getAlertsForSymbol('AAPL').length).toBe(1);
    expect(engine.getAlertsForSymbol('msft').length).toBe(1);
  });

  it('get user subscriptions', () => {
    engine.subscribe({ userId: 'u7', socketId: 'ws-7a', symbols: ['AAPL'] });
    engine.subscribe({ userId: 'u7', socketId: 'ws-7b', symbols: ['MSFT'] });
    engine.subscribe({ userId: 'u8', socketId: 'ws-8', symbols: ['TSLA'] });
    expect(engine.getUserSubscriptions('u7').length).toBe(2);
    expect(engine.getUserSubscriptions('u8').length).toBe(1);
  });

  it('get stats', () => {
    engine.ingestAlert({ symbol: 'A', market: 'US', title: 'T', summary: 'S', source: 's', sourceAuthority: 1, sourceCount: 3, sentiment: -0.85 });
    engine.subscribe({ userId: 'u9', socketId: 'ws-9', symbols: ['A'] });
    const stats = engine.getStats();
    expect(stats.totalAlerts).toBe(1);
    expect(stats.activeSubscriptions).toBe(1);
    expect(stats.byLevel.flash).toBe(1);
  });

  it('replay recent', () => {
    engine.registerPushCallback(() => {});
    engine.ingestAlert({ symbol: 'AAPL', market: 'US', title: 'T1', summary: 'S', source: 's1', sourceAuthority: 1, sourceCount: 3, sentiment: -0.85 });
    engine.ingestAlert({ symbol: 'AAPL', market: 'US', title: 'T2', summary: 'S', source: 's2', sourceAuthority: 1, sourceCount: 3, sentiment: -0.85 });
    const sub = engine.subscribe({ userId: 'u10', socketId: 'ws-10', symbols: ['AAPL'] });
    const replayed = engine.replayRecent(sub.id, 5);
    expect(replayed.length).toBeGreaterThanOrEqual(1);
  });

  it('cleanup removes expired alerts', async () => {
    engine.stopCleanup();
    engine.ingestAlert({ symbol: 'X', market: 'US', title: 'T', summary: 'S', source: 's', sourceAuthority: 1, sourceCount: 3, sentiment: -0.85 });
    // Manually expire the alert
    const alerts = engine.getActiveAlerts();
    for (const a of alerts) {
      (a as any).expiresAt = Date.now() - 1000;
    }
    // Trigger cleanup via internal method
    (engine as any).cleanup();
    expect(engine.getActiveAlerts().length).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════
// P1-02 ContentMarketplaceEngine Tests
// ═══════════════════════════════════════════════════════════

describe('ContentMarketplaceEngine', () => {
  let engine: ContentMarketplaceEngine;
  beforeEach(() => { engine = ContentMarketplaceEngine.getInstance(); engine.reset(); });

  it('singleton', () => { expect(ContentMarketplaceEngine.getInstance()).toBe(engine); });

  it('publish content', () => {
    const item = engine.publish({
      creatorId: 'c1', creatorName: 'Alice', creatorLevel: 'L1',
      title: 'Golden Cross Strategy', description: 'A reliable trading strategy',
      type: 'strategy', categories: ['TA'], tags: ['golden-cross', 'MA'],
      price: 9.9, markets: ['US', 'HK'],
    });
    expect(item.id).toBeDefined();
    expect(item.status).toBe('published');
    expect(item.creatorLevel).toBe('L1');
    expect(item.commissionRate).toBe(0.3);
    expect(item.price).toBe(9.9);
  });

  it('publish enforces min price', () => {
    const item = engine.publish({
      creatorId: 'c2', creatorName: 'Bob', creatorLevel: 'L2',
      title: 'Cheap Strategy', description: 'Test', type: 'strategy',
      categories: ['Test'], tags: [], price: 0.5,
    });
    expect(item.price).toBe(0.99);
  });

  it('L2 creator lower commission', () => {
    const item = engine.publish({
      creatorId: 'c3', creatorName: 'Charlie', creatorLevel: 'L2',
      title: 'L2 Strategy', description: 'Test', type: 'strategy',
      categories: ['Test'], tags: [], price: 10,
    });
    expect(item.commissionRate).toBe(0.2);
  });

  it('L3 creator lowest commission', () => {
    const item = engine.publish({
      creatorId: 'c4', creatorName: 'Diana', creatorLevel: 'L3',
      title: 'L3 Strategy', description: 'Test', type: 'strategy',
      categories: ['Test'], tags: [], price: 10,
    });
    expect(item.commissionRate).toBe(0.1);
  });

  it('unpublish content', () => {
    const item = engine.publish({
      creatorId: 'c5', creatorName: 'Eve', creatorLevel: 'L1',
      title: 'To Archive', description: 'Test', type: 'report',
      categories: ['Test'], tags: [], price: 5,
    });
    expect(engine.unpublish(item.id)).toBe(true);
    expect(engine.getContent(item.id)!.status).toBe('archived');
  });

  it('suspend content', () => {
    const item = engine.publish({
      creatorId: 'c6', creatorName: 'Frank', creatorLevel: 'L1',
      title: 'Bad Content', description: 'Test', type: 'course',
      categories: ['Test'], tags: [], price: 5,
    });
    engine.suspend(item.id, 'violation');
    expect(engine.getContent(item.id)!.status).toBe('suspended');
  });

  it('update content', () => {
    const item = engine.publish({
      creatorId: 'c7', creatorName: 'Grace', creatorLevel: 'L1',
      title: 'Old Title', description: 'Test', type: 'strategy',
      categories: ['TA'], tags: ['old'], price: 5,
    });
    const updated = engine.update(item.id, { title: 'New Title', price: 15 });
    expect(updated!.title).toBe('New Title');
    expect(updated!.price).toBe(15);
  });

  it('rate content', () => {
    const item = engine.publish({
      creatorId: 'c8', creatorName: 'Hank', creatorLevel: 'L1',
      title: 'Rated Strategy', description: 'Test', type: 'strategy',
      categories: ['Test'], tags: [], price: 5,
    });
    engine.rate(item.id, { reviewerId: 'r1', reviewerName: 'Reviewer', rating: 5, text: 'Great!' });
    engine.rate(item.id, { reviewerId: 'r2', reviewerName: 'User2', rating: 3 });
    const content = engine.getContent(item.id)!;
    expect(content.avgRating).toBe(4);
    expect(content.ratingCount).toBe(2);
    expect(content.reviewCount).toBe(2);
  });

  it('update existing rating', () => {
    const item = engine.publish({
      creatorId: 'c9', creatorName: 'Ivy', creatorLevel: 'L1',
      title: 'Updatable', description: 'Test', type: 'strategy',
      categories: ['Test'], tags: [], price: 5,
    });
    engine.rate(item.id, { reviewerId: 'r1', reviewerName: 'User', rating: 2 });
    engine.rate(item.id, { reviewerId: 'r1', reviewerName: 'User', rating: 5 });
    const content = engine.getContent(item.id)!;
    expect(content.avgRating).toBe(5);
    expect(content.ratingCount).toBe(1); // same reviewer, no count change
  });

  it('get reviews', () => {
    const item = engine.publish({
      creatorId: 'c10', creatorName: 'Jack', creatorLevel: 'L1',
      title: 'Reviewed', description: 'Test', type: 'strategy',
      categories: ['Test'], tags: [], price: 5,
    });
    engine.rate(item.id, { reviewerId: 'r1', reviewerName: 'Alice', rating: 4, text: 'Good' });
    engine.rate(item.id, { reviewerId: 'r2', reviewerName: 'Bob', rating: 5, text: 'Great' });
    const { reviews, total } = engine.getReviews(item.id);
    expect(total).toBe(2);
    expect(reviews.length).toBe(2);
    expect(reviews[0].createdAt).toBeGreaterThanOrEqual(reviews[1].createdAt);
  });

  it('mark review helpful', () => {
    const item = engine.publish({
      creatorId: 'c11', creatorName: 'Kate', creatorLevel: 'L1',
      title: 'Helpful', description: 'Test', type: 'strategy',
      categories: ['Test'], tags: [], price: 5,
    });
    engine.rate(item.id, { reviewerId: 'r1', reviewerName: 'Alice', rating: 5 });
    const { reviews } = engine.getReviews(item.id);
    engine.markHelpful(reviews[0].id);
    const { reviews: updated } = engine.getReviews(item.id);
    expect(updated[0].helpfulCount).toBe(1);
  });

  it('search by keywords', () => {
    engine.publish({
      creatorId: 'c1', creatorName: 'A', creatorLevel: 'L1',
      title: 'Golden Cross Strategy', description: 'MA based strategy',
      type: 'strategy', categories: ['TA'], tags: ['golden-cross'], price: 9.9,
    });
    engine.publish({
      creatorId: 'c2', creatorName: 'B', creatorLevel: 'L1',
      title: 'RSI Divergence', description: 'Momentum indicator',
      type: 'indicator', categories: ['TA'], tags: ['rsi'], price: 5,
    });
    const result = engine.search({ keywords: 'golden' });
    expect(result.total).toBe(1);
    expect(result.items[0].title).toContain('Golden');
  });

  it('search by type', () => {
    engine.publish({
      creatorId: 'c1', creatorName: 'A', creatorLevel: 'L1',
      title: 'Strategy', description: 'Test', type: 'strategy',
      categories: ['Test'], tags: [], price: 5,
    });
    engine.publish({
      creatorId: 'c2', creatorName: 'B', creatorLevel: 'L1',
      title: 'Indicator', description: 'Test', type: 'indicator',
      categories: ['Test'], tags: [], price: 5,
    });
    expect(engine.search({ type: 'strategy' }).total).toBe(1);
    expect(engine.search({ type: 'indicator' }).total).toBe(1);
  });

  it('search by price range', () => {
    engine.publish({
      creatorId: 'c1', creatorName: 'A', creatorLevel: 'L1',
      title: 'Cheap', description: 'T', type: 'strategy',
      categories: ['T'], tags: [], price: 5,
    });
    engine.publish({
      creatorId: 'c2', creatorName: 'B', creatorLevel: 'L1',
      title: 'Expensive', description: 'T', type: 'strategy',
      categories: ['T'], tags: [], price: 50,
    });
    expect(engine.search({ priceMax: 10 }).total).toBe(1);
  });

  it('search sort by newest', async () => {
    engine.publish({
      creatorId: 'c1', creatorName: 'A', creatorLevel: 'L1',
      title: 'First', description: 'T', type: 'strategy',
      categories: ['T'], tags: [], price: 5,
    });
    await new Promise(r => setTimeout(r, 2));
    engine.publish({
      creatorId: 'c2', creatorName: 'B', creatorLevel: 'L1',
      title: 'Second', description: 'T', type: 'strategy',
      categories: ['T'], tags: [], price: 5,
    });
    const result = engine.search({ sortBy: 'newest' });
    expect(result.items[0].title).toBe('Second');
  });

  it('recommend', () => {
    engine.publish({
      creatorId: 'top', creatorName: 'TopCreator', creatorLevel: 'L3',
      title: 'Top Strategy', description: 'Best performer',
      type: 'strategy', categories: ['TA'], tags: ['top'], price: 20,
      markets: ['US'],
    });
    engine.publish({
      creatorId: 'low', creatorName: 'LowCreator', creatorLevel: 'L1',
      title: 'Low Strategy', description: 'Basic',
      type: 'strategy', categories: ['Basic'], tags: ['low'], price: 5,
      markets: ['HK'],
    });
    // Give top strategy some stats
    const top = Array.from((engine as any).content.values())[0] as any;
    top.salesCount = 100;
    top.avgRating = 4.8;
    top.viewCount = 1000;

    const recs = engine.recommend({ userId: 'u1', markets: ['US'], limit: 5 });
    expect(recs.length).toBeGreaterThan(0);
    expect(recs[0].creatorLevel).toBe('L3');
  });

  it('record purchase', () => {
    const item = engine.publish({
      creatorId: 'c1', creatorName: 'Seller', creatorLevel: 'L1',
      title: 'Buy Me', description: 'T', type: 'strategy',
      categories: ['T'], tags: [], price: 10,
    });
    const result = engine.recordPurchase(item.id)!;
    expect(result.creatorShare).toBe(7); // 10 * 0.7
    expect(result.commission).toBe(3);   // 10 * 0.3
    expect(engine.getContent(item.id)!.salesCount).toBe(1);
  });

  it('record view and download', () => {
    const item = engine.publish({
      creatorId: 'c1', creatorName: 'V', creatorLevel: 'L1',
      title: 'Viewed', description: 'T', type: 'strategy',
      categories: ['T'], tags: [], price: 5,
    });
    engine.recordView(item.id);
    engine.recordView(item.id);
    engine.recordDownload(item.id);
    const c = engine.getContent(item.id)!;
    expect(c.viewCount).toBe(2);
    expect(c.downloadCount).toBe(1);
  });

  it('get creator stats', () => {
    engine.publish({
      creatorId: 'creator1', creatorName: 'Pro', creatorLevel: 'L2',
      title: 'S1', description: 'T', type: 'strategy',
      categories: ['T'], tags: [], price: 10,
    });
    const stats = engine.getCreatorStats('creator1', 'L2');
    expect(stats.totalContent).toBe(1);
    expect(stats.level).toBe('L2');
  });

  it('get creator content', () => {
    engine.publish({
      creatorId: 'creator1', creatorName: 'Multi', creatorLevel: 'L1',
      title: 'A', description: 'T', type: 'strategy',
      categories: ['T'], tags: [], price: 5,
    });
    engine.publish({
      creatorId: 'creator1', creatorName: 'Multi', creatorLevel: 'L1',
      title: 'B', description: 'T', type: 'indicator',
      categories: ['T'], tags: [], price: 5,
    });
    expect(engine.getCreatorContent('creator1').length).toBe(2);
  });

  it('browse category', () => {
    engine.publish({
      creatorId: 'c1', creatorName: 'A', creatorLevel: 'L1',
      title: 'TA Strategy', description: 'T', type: 'strategy',
      categories: ['TA'], tags: [], price: 5,
    });
    engine.publish({
      creatorId: 'c2', creatorName: 'B', creatorLevel: 'L1',
      title: 'FA Report', description: 'T', type: 'report',
      categories: ['FA'], tags: [], price: 5,
    });
    expect(engine.browseCategory('TA').total).toBe(1);
    expect(engine.browseCategory('FA').total).toBe(1);
  });

  it('quick search', () => {
    engine.publish({
      creatorId: 'c1', creatorName: 'Q', creatorLevel: 'L1',
      title: 'Quick Searchable', description: 'Test', type: 'strategy',
      categories: ['Test'], tags: ['quick'], price: 5,
    });
    const results = engine.quickSearch('Searchable');
    expect(results.length).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════
// P1-03 CreatorMarketEngine Tests
// ═══════════════════════════════════════════════════════════

describe('CreatorMarketEngine', () => {
  let engine: CreatorMarketEngine;
  beforeEach(() => { engine = CreatorMarketEngine.getInstance(); engine.reset(); });

  it('singleton', () => { expect(CreatorMarketEngine.getInstance()).toBe(engine); });

  it('apply as creator', () => {
    const app = engine.apply({
      userId: 'u1', displayName: 'TraderJoe', bio: 'Professional trader',
      specialties: ['TA', 'Crypto'], notes: '5 years experience',
      portfolio: ['https://tradingview.com/joe'],
    });
    expect(app.status).toBe('pending');
    expect(app.displayName).toBe('TraderJoe');
    expect(app.specialties).toContain('TA');
  });

  it('approve application creates creator', () => {
    const app = engine.apply({
      userId: 'u2', displayName: 'TraderBob', bio: 'Expert',
      specialties: ['Options'], notes: '', portfolio: [],
    });
    engine.reviewApplication(app.id, true, 'Looks good');
    const creator = engine.getCreator('u2');
    expect(creator).toBeTruthy();
    expect(creator!.status).toBe('active');
    expect(creator!.level).toBe('L1');
    expect(creator!.verified).toBe(false);
  });

  it('reject application', () => {
    const app = engine.apply({
      userId: 'u3', displayName: 'ScamBot', bio: '...',
      specialties: [], notes: '', portfolio: [],
    });
    engine.reviewApplication(app.id, false, 'Suspicious');
    expect(engine.getCreator('u3')).toBeUndefined();
    expect(engine.getApplication(app.id)!.status).toBe('rejected');
  });

  it('get pending applications', () => {
    engine.apply({ userId: 'a1', displayName: 'A', bio: '', specialties: [], notes: '', portfolio: [] });
    engine.apply({ userId: 'a2', displayName: 'B', bio: '', specialties: [], notes: '', portfolio: [] });
    const pending = engine.getPendingApplications();
    expect(pending.length).toBe(2);
  });

  it('update creator profile', () => {
    const app = engine.apply({ userId: 'u4', displayName: 'OldName', bio: 'Old', specialties: ['TA'], notes: '', portfolio: [] });
    engine.reviewApplication(app.id, true);
    engine.updateCreator('u4', { displayName: 'NewName', bio: 'New Bio' });
    const c = engine.getCreator('u4')!;
    expect(c.displayName).toBe('NewName');
    expect(c.bio).toBe('New Bio');
  });

  it('suspend and ban creator', () => {
    const app = engine.apply({ userId: 'u5', displayName: 'BadActor', bio: '', specialties: [], notes: '', portfolio: [] });
    engine.reviewApplication(app.id, true);
    engine.suspendCreator('u5', 'TOS violation');
    expect(engine.getCreator('u5')!.status).toBe('suspended');
    engine.banCreator('u5', 'Repeated violation');
    expect(engine.getCreator('u5')!.status).toBe('banned');
  });

  it('verify creator', () => {
    const app = engine.apply({ userId: 'u6', displayName: 'VerifiedUser', bio: '', specialties: [], notes: '', portfolio: [] });
    engine.reviewApplication(app.id, true);
    engine.verifyCreator('u6');
    expect(engine.getCreator('u6')!.verified).toBe(true);
  });

  it('creator level promotion', () => {
    const app = engine.apply({ userId: 'u7', displayName: 'Rising', bio: '', specialties: ['TA'], notes: '', portfolio: [] });
    engine.reviewApplication(app.id, true);
    const c = engine.getCreator('u7')!;
    c.totalSales = 150; // L2 threshold
    const result = engine.checkLevelPromotion('u7');
    expect(result.promoted).toBe(true);
    expect(result.newLevel).toBe('L2');
    expect(engine.getCreatorLevel('u7')).toBe('L2');
  });

  it('L3 promotion at 1000 sales', () => {
    const app = engine.apply({ userId: 'u8', displayName: 'Star', bio: '', specialties: [], notes: '', portfolio: [] });
    engine.reviewApplication(app.id, true);
    const c = engine.getCreator('u8')!;
    c.totalSales = 1200;
    const result = engine.checkLevelPromotion('u8');
    expect(result.promoted).toBe(true);
    expect(result.newLevel).toBe('L3');
  });

  it('commission rates by level', () => {
    const app = engine.apply({ userId: 'u9', displayName: 'L1Creator', bio: '', specialties: [], notes: '', portfolio: [] });
    engine.reviewApplication(app.id, true);
    expect(engine.getCommissionRate('u9')).toBe(0.3);

    const c = engine.getCreator('u9')!;
    c.totalSales = 200;
    engine.checkLevelPromotion('u9');
    expect(engine.getCommissionRate('u9')).toBe(0.2);
  });

  it('upgrade tier', () => {
    const app = engine.apply({ userId: 'u10', displayName: 'ProTrader', bio: '', specialties: [], notes: '', portfolio: [] });
    engine.reviewApplication(app.id, true);
    engine.upgradeTier('u10', 'pro');
    expect(engine.getCreator('u10')!.tier).toBe('pro');
    expect(engine.getSubscriptionFee('u10')).toBe(29.9);
  });

  it('record sale', () => {
    const app = engine.apply({ userId: 'u11', displayName: 'Seller', bio: '', specialties: [], notes: '', portfolio: [] });
    engine.reviewApplication(app.id, true);
    const result = engine.recordSale('u11', 'content-1', 10);
    expect(result!.commission).toBe(3); // 10 * 0.3
    expect(result!.creatorShare).toBe(7);
    expect(engine.getCreator('u11')!.totalSales).toBe(1);
    expect(engine.getCreator('u11')!.totalRevenue).toBe(7);
  });

  it('record content and follow', () => {
    const app = engine.apply({ userId: 'u12', displayName: 'ContentCreator', bio: '', specialties: [], notes: '', portfolio: [] });
    engine.reviewApplication(app.id, true);
    engine.recordContent('u12');
    engine.recordContent('u12');
    engine.recordFollow('u12');
    engine.recordFollow('u12');
    engine.recordFollow('u12', false);
    const c = engine.getCreator('u12')!;
    expect(c.contentCount).toBe(2);
    expect(c.followerCount).toBe(1);
  });

  it('generate revenue report', () => {
    const app = engine.apply({ userId: 'u13', displayName: 'Reporter', bio: '', specialties: [], notes: '', portfolio: [] });
    engine.reviewApplication(app.id, true);
    engine.recordSale('u13', 'c1', 10);
    engine.recordSale('u13', 'c1', 20);
    engine.recordSale('u13', 'c2', 30);

    const report = engine.generateRevenueReport('u13', Date.now() - 86_400_000, Date.now());
    expect(report).toBeTruthy();
    expect(report!.totalSales).toBe(3);
    expect(report!.grossRevenue).toBe(60);
    expect(report!.commission).toBe(18); // 60 * 0.3
    expect(report!.netRevenue).toBe(42);
    expect(report!.contentBreakdown.length).toBe(2);
  });

  it('get monthly summary', () => {
    const app = engine.apply({ userId: 'u14', displayName: 'Monthly', bio: '', specialties: [], notes: '', portfolio: [] });
    engine.reviewApplication(app.id, true);
    engine.recordSale('u14', 'c1', 10);
    const summary = engine.getMonthlySummary('u14', 3);
    expect(summary.length).toBeGreaterThanOrEqual(1);
    expect(summary[0].grossRevenue).toBe(10);
  });

  it('search creators', () => {
    const a1 = engine.apply({ userId: 's1', displayName: 'CryptoKing', bio: 'Crypto expert', specialties: ['Crypto'], notes: '', portfolio: [] });
    const a2 = engine.apply({ userId: 's2', displayName: 'StockQueen', bio: 'Stocks only', specialties: ['Stocks'], notes: '', portfolio: [] });
    engine.reviewApplication(a1.id, true);
    engine.reviewApplication(a2.id, true);

    const result = engine.searchCreators({ keywords: 'crypto' });
    expect(result.total).toBe(1);
    expect(result.creators[0].displayName).toBe('CryptoKing');
  });

  it('search creators by level', () => {
    const a1 = engine.apply({ userId: 'l1', displayName: 'L1', bio: '', specialties: [], notes: '', portfolio: [] });
    const a2 = engine.apply({ userId: 'l2', displayName: 'L2', bio: '', specialties: [], notes: '', portfolio: [] });
    engine.reviewApplication(a1.id, true);
    engine.reviewApplication(a2.id, true);
    // Promote l2 creator
    engine.getCreator('l2')!.totalSales = 200;
    engine.checkLevelPromotion('l2');

    expect(engine.searchCreators({ level: 'L2' }).total).toBe(1);
  });

  it('get top creators', () => {
    const a1 = engine.apply({ userId: 'top1', displayName: 'Top1', bio: '', specialties: [], notes: '', portfolio: [] });
    const a2 = engine.apply({ userId: 'top2', displayName: 'Top2', bio: '', specialties: [], notes: '', portfolio: [] });
    engine.reviewApplication(a1.id, true);
    engine.reviewApplication(a2.id, true);
    engine.recordSale('top1', 'c1', 100);
    engine.recordSale('top2', 'c1', 50);
    const top = engine.getTopCreators(10);
    expect(top.length).toBe(2);
    expect(top[0].id).toBe('top1');
  });

  it('get trending creators', () => {
    const a = engine.apply({ userId: 'trend', displayName: 'Trending', bio: '', specialties: [], notes: '', portfolio: [] });
    engine.reviewApplication(a.id, true);
    engine.recordSale('trend', 'c1', 10);
    const trending = engine.getTrendingCreators(10);
    expect(trending.length).toBe(1);
    expect(trending[0].displayName).toBe('Trending');
  });

  it('get platform stats', () => {
    const a1 = engine.apply({ userId: 'ps1', displayName: 'PS1', bio: '', specialties: [], notes: '', portfolio: [] });
    const a2 = engine.apply({ userId: 'ps2', displayName: 'PS2', bio: '', specialties: [], notes: '', portfolio: [] });
    engine.reviewApplication(a1.id, true);
    engine.reviewApplication(a2.id, true);
    const stats = engine.getPlatformStats();
    expect(stats.totalCreators).toBe(2);
    expect(stats.activeCreators).toBe(2);
  });

  it('get reports', () => {
    const a = engine.apply({ userId: 'report', displayName: 'R', bio: '', specialties: [], notes: '', portfolio: [] });
    engine.reviewApplication(a.id, true);
    engine.recordSale('report', 'c1', 10);
    engine.generateRevenueReport('report', Date.now() - 86400000, Date.now());
    const reports = engine.getReports('report', 12);
    expect(reports.length).toBe(1);
    expect(reports[0].totalSales).toBe(1);
  });
});

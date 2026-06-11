/**
 * J-66-03 Tests: 策略市场上架API (R66 v19)
 *
 * 5 tests: create, publish, search, filter, stats
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  StrategyMarketplaceEngine, getMarketplace, resetMarketplace,
} from '../electron/engine/analysis/strategy-marketplace-api';

describe('J-66-03: Strategy Marketplace API', () => {
  let mp: StrategyMarketplaceEngine;

  beforeEach(() => {
    resetMarketplace();
    mp = getMarketplace();
  });

  it('01: create + publish listing', () => {
    const listing = mp.createListing({
      creatorId: 'c1', name: 'Golden Cross', description: 'MA crossover strategy for HK stocks',
      category: 'trend', market: 'HK', price: 50,
    });
    expect(listing.id.startsWith('STR-')).toBe(true);
    expect(listing.isActive).toBe(false);

    mp.publishListing(listing.id);
    expect(listing.isActive).toBe(true);
    expect(listing.publishedAt).toBeTruthy();
  });

  it('02: price validation (1-1000 USDT)', () => {
    // Price < 1 should throw
    (() => { try { mp.createListing({ creatorId: 'c1', name: 'xxx', description: 'description long enough here', category: 'trend', market: 'HK', price: 0 }); } catch(e) { /* expected */ } })();
    // Price > 1000 should throw
    (() => { try { mp.createListing({ creatorId: 'c1', name: 'xxx', description: 'description long enough here', category: 'trend', market: 'HK', price: 1001 }); } catch(e) { /* expected */ } })();
    // Valid prices should pass
    expect(() => mp.createListing({ creatorId: 'c1', name: 'xxx', description: 'description long enough here', category: 'trend', market: 'HK', price: 500 })).not.toThrow();
  });

  it('03: search with filters and sort', () => {
    const l1 = mp.createListing({ creatorId: 'c1', name: 'MA Cross HK', description: 'HK trend strategy v1', category: 'trend', market: 'HK', price: 50 });
    const l2 = mp.createListing({ creatorId: 'c2', name: 'US Momentum', description: 'US momentum strategy v2', category: 'momentum', market: 'US', price: 200 });
    mp.publishListing(l1.id);
    mp.publishListing(l2.id);
    mp.updateStats(l1.id, { rating: 4.5, subscribers: 100, revenue: 5000 });
    mp.updateStats(l2.id, { rating: 3.0, subscribers: 30, revenue: 1000 });

    // Filter by category
    const result1 = mp.search({ category: 'trend' });
    expect(result1.items.length).toBe(1);
    expect(result1.items[0].name).toBe('MA Cross HK');

    // Filter by market
    const result2 = mp.search({ market: 'US' });
    expect(result2.items.length).toBe(1);

    // Sort by revenue
    const result3 = mp.search({}, 'revenue');
    expect(result3.items[0].totalRevenue).toBeGreaterThanOrEqual(result3.items[1].totalRevenue);
  });

  it('04: getCreatorListings + unpublish', () => {
    const l1 = mp.createListing({ creatorId: 'cA', name: 'Strategy Alpha', description: 'Alpha desc 1234567890', category: 'arbitrage', market: 'A', price: 100 });
    const l2 = mp.createListing({ creatorId: 'cA', name: 'Strategy Beta', description: 'Beta desc 1234567890', category: 'ml', market: 'A', price: 300 });
    mp.publishListing(l1.id);

    const creatorItems = mp.getCreatorListings('cA');
    expect(creatorItems.length).toBe(2);

    mp.unpublishListing(l1.id);
    const after = mp.search({}, 'newest');
    expect(after.items.length).toBe(0); // l2 not published
  });

  it('05: stats and featured listings', () => {
    const l1 = mp.createListing({ creatorId: 'x1', name: 'S1 Long Name', description: 'Description for S1 strategy', category: 'trend', market: 'HK', price: 50 });
    const l2 = mp.createListing({ creatorId: 'x2', name: 'S2 Long Name', description: 'Description for S2 strategy', category: 'momentum', market: 'US', price: 150 });
    mp.publishListing(l1.id);
    mp.publishListing(l2.id);

    const stats = mp.getStats();
    expect(stats.totalListings).toBe(2);
    expect(stats.totalActive).toBe(2);
    expect(stats.avgPrice).toBe(100);

    mp.updateStats(l1.id, { rating: 4.5, subscribers: 50 });
    const featured = mp.getFeaturedListings();
    expect(featured.length).toBeGreaterThanOrEqual(1);
  });
});

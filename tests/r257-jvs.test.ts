import { describe, it, expect, beforeEach } from 'vitest';
import { MarketDataPermissionEngine } from '../electron/engine/data/MarketDataPermissionEngine';
import type { PermissionLevel } from '../electron/engine/data/MarketDataPermissionEngine';

describe('MarketDataPermissionEngine', () => {
  let engine: MarketDataPermissionEngine;
  beforeEach(() => { engine = MarketDataPermissionEngine.getInstance(); engine.reset(); });

  it('singleton', () => { expect(MarketDataPermissionEngine.getInstance()).toBe(engine); });

  // ─── Subscription ─────────────────────────────────────

  it('defaults to live level for unknown user', () => {
    expect(engine.getLevel('new_user')).toBe('live');
  });

  it('subscribe and upgrade', () => {
    engine.subscribe('u1', 'live');
    expect(engine.getLevel('u1')).toBe('live');
    engine.upgrade('u1', 'pro');
    expect(engine.getLevel('u1')).toBe('pro');
    engine.upgrade('u1', 'institutional');
    expect(engine.getLevel('u1')).toBe('institutional');
  });

  it('downgrade resets to live', () => {
    engine.subscribe('u1', 'pro');
    expect(engine.getLevel('u1')).toBe('pro');
    engine.downgrade('u1');
    expect(engine.getLevel('u1')).toBe('live');
  });

  it('isActive returns true for live (never expires)', () => {
    engine.subscribe('u1', 'live');
    expect(engine.isActive('u1')).toBe(true);
  });

  it('isActive returns true for valid pro', () => {
    engine.subscribe('u1', 'pro', false, Date.now() + 86400000);
    expect(engine.isActive('u1')).toBe(true);
  });

  it('isActive returns false for expired pro', () => {
    engine.subscribe('u1', 'pro', false, Date.now() - 1000);
    expect(engine.isActive('u1')).toBe(false);
  });

  // ─── Permission Matrix ────────────────────────────────

  it('live has yahoo_ws only', () => {
    engine.subscribe('u1', 'live');
    expect(engine.checkSource('u1', 'yahoo_ws')).toBe(true);
    expect(engine.checkSource('u1', 'binance_ws')).toBe(false);
    expect(engine.checkSource('u1', 'futu')).toBe(false);
  });

  it('pro has multiple sources', () => {
    engine.subscribe('u1', 'pro');
    expect(engine.checkSource('u1', 'yahoo_ws')).toBe(true);
    expect(engine.checkSource('u1', 'binance_ws')).toBe(true);
    expect(engine.checkSource('u1', 'futu')).toBe(true);
    expect(engine.checkSource('u1', 'longbridge')).toBe(false);
  });

  it('institutional has all 7 sources', () => {
    engine.subscribe('u1', 'institutional');
    const sources = engine.getAvailableSources('u1');
    expect(sources.length).toBe(7);
  });

  // ─── Access Control ────────────────────────────────────

  it('access check allows valid request', () => {
    engine.subscribe('u1', 'pro');
    const result = engine.checkAccess('u1', 'yahoo_ws', 'price');
    expect(result.allowed).toBe(true);
  });

  it('access check blocks disallowed source', () => {
    engine.subscribe('u1', 'live');
    const result = engine.checkAccess('u1', 'binance_ws', 'price');
    expect(result.allowed).toBe(false);
    expect(result.reason).toBeTruthy();
  });

  it('access check blocks depth_bid on live', () => {
    engine.subscribe('u1', 'live');
    const result = engine.checkAccess('u1', 'yahoo_ws', 'depth_bid');
    expect(result.allowed).toBe(false);
    expect(result.requiredLevel).toBe('pro');
  });

  it('access check blocks order_flow on pro', () => {
    engine.subscribe('u1', 'pro');
    expect(engine.checkField('u1', 'order_flow')).toBe(false);
  });

  it('pro can access depth_bid', () => {
    engine.subscribe('u1', 'pro');
    expect(engine.checkField('u1', 'depth_bid')).toBe(true);
  });

  // ─── Delivery mode ─────────────────────────────────────

  it('live is delayed 15min', () => {
    engine.subscribe('u1', 'live');
    expect(engine.getDeliveryMode('u1')).toBe('delayed_15min');
  });

  it('pro is realtime', () => {
    engine.subscribe('u1', 'pro');
    expect(engine.getDeliveryMode('u1')).toBe('realtime');
  });

  it('institutional is realtime', () => {
    engine.subscribe('u1', 'institutional');
    expect(engine.getDeliveryMode('u1')).toBe('realtime');
  });

  // ─── Watchlist & Alerts Quota ──────────────────────────

  it('live max watchlist is 5', () => {
    engine.subscribe('u1', 'live');
    expect(engine.getMaxWatchlist('u1')).toBe(5);
  });

  it('pro max watchlist is 500', () => {
    engine.subscribe('u1', 'pro');
    expect(engine.getMaxWatchlist('u1')).toBe(500);
  });

  it('live max alerts is 3', () => {
    engine.subscribe('u1', 'live');
    expect(engine.getMaxAlerts('u1')).toBe(3);
  });

  it('pro max alerts is 50', () => {
    engine.subscribe('u1', 'pro');
    expect(engine.getMaxAlerts('u1')).toBe(50);
  });

  it('canAddWatchlist returns false when full', () => {
    engine.subscribe('u1', 'live');
    for (let i = 0; i < 5; i++) engine.addWatchlist('u1');
    expect(engine.canAddWatchlist('u1')).toBe(false);
  });

  it('canAddAlert returns false when exceeded', () => {
    engine.subscribe('u1', 'live');
    for (let i = 0; i < 3; i++) engine.addAlert('u1');
    expect(engine.canAddAlert('u1')).toBe(false);
  });

  it('pro supports many watchlist items', () => {
    engine.subscribe('u1', 'pro');
    for (let i = 0; i < 500; i++) engine.addWatchlist('u1');
    expect(engine.canAddWatchlist('u1')).toBe(false);
  });

  // ─── Source Activation ─────────────────────────────────

  it('live canActivateSource max 1', () => {
    engine.subscribe('u1', 'live');
    expect(engine.canActivateSource('u1')).toBe(true);
    engine.activateSource('u1');
    expect(engine.canActivateSource('u1')).toBe(false);
  });

  it('deactivateSource decrements count', () => {
    engine.subscribe('u1', 'live');
    engine.activateSource('u1');
    engine.deactivateSource('u1');
    expect(engine.canActivateSource('u1')).toBe(true);
  });

  it('pro canActivateSource max 3', () => {
    engine.subscribe('u1', 'pro');
    engine.activateSource('u1');
    engine.activateSource('u1');
    engine.activateSource('u1');
    expect(engine.canActivateSource('u1')).toBe(false);
  });

  // ─── API Access ────────────────────────────────────────

  it('live cannot use API', () => {
    engine.subscribe('u1', 'live');
    expect(engine.canUseApi('u1')).toBe(false);
    expect(engine.canApi('u1')).toBe(false);
  });

  it('institutional can use API', () => {
    engine.subscribe('u1', 'institutional');
    expect(engine.canUseApi('u1')).toBe(true);
    expect(engine.canApi('u1')).toBe(true);
  });

  // ─── Feature Flags ─────────────────────────────────────

  it('live cannot screen or backtest', () => {
    engine.subscribe('u1', 'live');
    expect(engine.canScreen('u1')).toBe(false);
    expect(engine.canBacktest('u1')).toBe(false);
  });

  it('pro can screen and backtest', () => {
    engine.subscribe('u1', 'pro');
    expect(engine.canScreen('u1')).toBe(true);
    expect(engine.canBacktest('u1')).toBe(true);
  });

  // ─── Pricing ───────────────────────────────────────────

  it('live is free', () => {
    expect(engine.getPrice('live')).toBe(0);
  });

  it('pro costs 9.99 USDT/month', () => {
    expect(engine.getPrice('pro')).toBe(9.99);
  });

  it('institutional costs 199 USDT/month', () => {
    expect(engine.getPrice('institutional')).toBe(199);
  });

  // ─── Revenue Estimation ────────────────────────────────

  it('estimateMonthlyRevenue without subs is 0', () => {
    const rev = engine.estimateMonthlyRevenue();
    expect(rev.totalUSDT).toBe(0);
  });

  it('estimateMonthlyRevenue with mock users', () => {
    engine.createMockUsers();
    const rev = engine.estimateMonthlyRevenue();
    expect(rev.totalUSDT).toBeGreaterThan(200);
    expect(rev.breakdown.live).toBe(0);
    expect(rev.breakdown.pro).toBeGreaterThan(0);
    expect(rev.breakdown.institutional).toBeGreaterThan(0);
  });

  it('getUserCountByLevel', () => {
    engine.createMockUsers();
    expect(engine.getUserCountByLevel('live')).toBe(1);
    expect(engine.getUserCountByLevel('pro')).toBe(2);
    expect(engine.getUserCountByLevel('institutional')).toBe(1);
    expect(engine.getUserCount()).toBe(4);
  });

  // ─── getAllLevels ──────────────────────────────────────

  it('getAllLevels returns 3 levels', () => {
    const levels = engine.getAllLevels();
    expect(levels.length).toBe(3);
    expect(levels.map(l => l.level)).toEqual(['live', 'pro', 'institutional']);
  });

  // ─── Quota ─────────────────────────────────────────────

  it('getQuota returns valid state', () => {
    engine.subscribe('u1', 'pro');
    const q = engine.getQuota('u1');
    expect(q.userId).toBe('u1');
    expect(q.watchlistSize).toBe(0);
    expect(q.alertsToday).toBe(0);
  });

  it('recordApiCall increments counter', () => {
    engine.subscribe('u1', 'institutional');
    engine.recordApiCall('u1');
    engine.recordApiCall('u1');
    const q = engine.getQuota('u1');
    expect(q.apiCallsToday).toBe(2);
  });
});

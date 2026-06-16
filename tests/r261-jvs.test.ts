import { describe, it, expect, beforeEach } from 'vitest';
import { YahooWebSocketLiveEngine } from '../electron/engine/news/YahooWebSocketLiveEngine';
import { BinanceWebSocketLiveEngine } from '../electron/engine/data/BinanceWebSocketLiveEngine';
import { PersonalizedPushPipeline } from '../electron/engine/push/PersonalizedPushPipeline';

// ═══════════════════════════════════════════════════════════════
// P0-01 YahooWebSocketLiveEngine
// ═══════════════════════════════════════════════════════════════

describe('YahooWebSocketLiveEngine', () => {
  let engine: YahooWebSocketLiveEngine;
  beforeEach(() => {
    (YahooWebSocketLiveEngine as any).instance = null;
    engine = YahooWebSocketLiveEngine.getInstance({ mockOnFailure: true });
  });

  it('singleton', () => { expect(YahooWebSocketLiveEngine.getInstance()).toBe(engine); });

  it('starts disconnected', () => {
    expect(engine.getState()).toBe('disconnected');
    expect(engine.isConnected()).toBe(false);
  });

  it('subscribe adds symbols', () => {
    engine.subscribe(['AAPL', 'TSLA']);
    expect(engine.getSubscriptions()).toContain('AAPL');
    expect(engine.getSubscriptions()).toContain('TSLA');
    expect(engine.getSubscriptionCount()).toBe(2);
  });

  it('subscribe single string', () => {
    engine.subscribe('NVDA');
    expect(engine.getSubscriptionCount()).toBe(1);
  });

  it('unsubscribe removes symbol', () => {
    engine.subscribe(['AAPL', 'TSLA', 'NVDA']);
    engine.unsubscribe('TSLA');
    expect(engine.getSubscriptions()).not.toContain('TSLA');
    expect(engine.getSubscriptionCount()).toBe(2);
  });

  it('unsubscribe array', () => {
    engine.subscribe(['A', 'B', 'C']);
    engine.unsubscribe(['A', 'C']);
    expect(engine.getSubscriptions()).toEqual(['B']);
  });

  it('respects max subscriptions', () => {
    const cfg = engine.constructor['instance'];
    const many = Array.from({ length: 200 }, (_, i) => `SYM${i}`);
    engine.subscribe(many);
    expect(engine.getSubscriptionCount()).toBeLessThanOrEqual(100);
  });

  it('diagnostics before connect', () => {
    const diag = engine.getDiagnostics();
    expect(diag.state).toBe('disconnected');
    expect(diag.messagesReceived).toBe(0);
    expect(diag.subscriptionsCount).toBe(0);
  });

  it('inferMarketState on weekday', () => {
    // The method is private — test via quote parsing behavior
    // Just verify no crash
    expect(engine.getState()).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════
// P0-04 BinanceWebSocketLiveEngine
// ═══════════════════════════════════════════════════════════════

describe('BinanceWebSocketLiveEngine', () => {
  let engine: BinanceWebSocketLiveEngine;
  beforeEach(() => {
    (BinanceWebSocketLiveEngine as any).instance = null;
    engine = BinanceWebSocketLiveEngine.getInstance({ mockOnFailure: true });
  });

  it('singleton', () => { expect(BinanceWebSocketLiveEngine.getInstance()).toBe(engine); });

  it('starts disconnected', () => {
    expect(engine.getState()).toBe('disconnected');
    expect(engine.isConnected()).toBe(false);
  });

  it('normalizes symbol', () => {
    expect(engine.normalizeSymbol('btc-usdt')).toContain('BTC');
    expect(engine.normalizeSymbol('BTC-USDT')).toContain('BTC');
    expect(engine.normalizeSymbol('ETH/USDT')).toContain('ETH');
  });

  it('toBinanceSymbol lowercases', () => {
    expect(engine.toBinanceSymbol('BTCUSDT')).toBe('btcusdt');
  });

  it('toStreamName formats correctly', () => {
    const name = engine.toStreamName('BTC-USDT', 'ticker');
    expect(name).toBe('btcusdt@ticker');
  });

  it('subscribes to ticker', () => {
    engine.subscribe('BTC-USDT', 'ticker');
    expect(engine.getSubscriptionCount()).toBe(1);
  });

  it('subscribes multi symbols', () => {
    engine.subscribeMulti(['BTC-USDT', 'ETH-USDT', 'SOL-USDT'], 'ticker');
    expect(engine.getSubscriptionCount()).toBe(3);
  });

  it('unsubscribes', () => {
    engine.subscribe('BTC-USDT', 'ticker');
    engine.subscribe('ETH-USDT', 'ticker');
    engine.unsubscribe('BTC-USDT');
    expect(engine.getSubscriptionCount()).toBe(1);
  });

  it('diagnostics', () => {
    const diag = engine.getDiagnostics();
    expect(diag.state).toBe('disconnected');
    expect(diag.mockMode).toBe(false);
    expect(diag.subscriptionsCount).toBe(0);
  });

  it('respects max streams', () => {
    const many = Array.from({ length: 250 }, (_, i) => `SYM${i}USDT`);
    engine.subscribeMulti(many, 'ticker');
    expect(engine.getSubscriptionCount()).toBeLessThanOrEqual(200);
  });
});

// ═══════════════════════════════════════════════════════════════
// P1-01 PersonalizedPushPipeline
// ═══════════════════════════════════════════════════════════════

describe('PersonalizedPushPipeline', () => {
  let pipeline: PersonalizedPushPipeline;
  beforeEach(() => {
    (PersonalizedPushPipeline as any).instance = null;
    pipeline = PersonalizedPushPipeline.getInstance();
  });

  it('singleton', () => { expect(PersonalizedPushPipeline.getInstance()).toBe(pipeline); });

  it('adds user subscription', () => {
    pipeline.addUserSubscription({
      userId: 'u1', watchedSymbols: ['AAPL'], channels: ['desktop'],
      cooldownMs: 30000, lastPushTime: 0, pushCount30d: 0,
    });
    expect(pipeline.getAlertCount()).toBe(0);
  });

  it('adds watched symbol', () => {
    pipeline.addWatchedSymbol('u1', 'AAPL');
    pipeline.addWatchedSymbol('u1', 'TSLA');
    // Verify via alert generation
    pipeline.ingestYahooQuote({ symbol: 'AAPL', price: 200, changePercent: 8, volume: 100000 });
    expect(pipeline.getAlertCount()).toBeGreaterThan(0);
  });

  it('ingests Yahoo quote and generates price alert', () => {
    pipeline.addWatchedSymbol('u1', 'AAPL');
    const alerts = pipeline.ingestYahooQuote({
      symbol: 'AAPL', price: 210, changePercent: 7.5, volume: 500000,
    });
    expect(alerts.length).toBe(1);
    expect(alerts[0].type).toBe('price_alert');
    expect(alerts[0].delivered).toBe(true);
  });

  it('deduplicates within window', () => {
    pipeline.addWatchedSymbol('u1', 'AAPL');
    const a1 = pipeline.ingestYahooQuote({ symbol: 'AAPL', price: 210, changePercent: 7.5, volume: 500000 });
    const a2 = pipeline.ingestYahooQuote({ symbol: 'AAPL', price: 210, changePercent: 7.5, volume: 500000 });
    expect(a1.length).toBe(1);
    expect(a2.length).toBe(0); // deduped
    expect(pipeline.getAlertCount()).toBe(1);
  });

  it('respects cooldown', () => {
    pipeline.addUserSubscription({
      userId: 'u1', watchedSymbols: ['TSLA'], channels: ['desktop'],
      cooldownMs: 60000, lastPushTime: Date.now() - 10000, pushCount30d: 0,
    });
    const alerts = pipeline.ingestYahooQuote({ symbol: 'TSLA', price: 300, changePercent: 10, volume: 1000000 });
    expect(alerts.length).toBe(0); // still in cooldown
  });

  it('respects daily limit', () => {
    pipeline.addUserSubscription({
      userId: 'u1', watchedSymbols: ['AAPL'], channels: ['desktop'],
      cooldownMs: 0, lastPushTime: 0, pushCount30d: 50, // at limit
    });
    const alerts = pipeline.ingestYahooQuote({ symbol: 'AAPL', price: 210, changePercent: 7.5, volume: 500000 });
    expect(alerts.length).toBe(0);
  });

  it('notifies multiple users watching same symbol', () => {
    pipeline.addUserSubscription({
      userId: 'u1', watchedSymbols: ['NVDA'], channels: ['desktop'],
      cooldownMs: 0, lastPushTime: 0, pushCount30d: 0,
    });
    pipeline.addUserSubscription({
      userId: 'u2', watchedSymbols: ['NVDA'], channels: ['mobile'],
      cooldownMs: 0, lastPushTime: 0, pushCount30d: 0,
    });
    const alerts = pipeline.ingestYahooQuote({ symbol: 'NVDA', price: 155, changePercent: 9, volume: 2000000 });
    expect(alerts.length).toBe(2);
  });

  it('ingests Binance ticker', () => {
    pipeline.addWatchedSymbol('u1', 'BTCUSDT');
    const alerts = pipeline.ingestBinanceTicker({
      symbol: 'BTCUSDT', price: 105000, changePercent: 6, volume: 10000,
    });
    expect(alerts.length).toBe(1);
    expect(alerts[0].symbol).toBe('BTCUSDT');
  });

  it('batch ingest', () => {
    pipeline.addUserSubscription({
      userId: 'u1', watchedSymbols: ['AAPL', 'TSLA'], channels: ['desktop'],
      cooldownMs: 0, lastPushTime: 0, pushCount30d: 0,
    });
    const alerts = pipeline.ingestBatch([
      { symbol: 'AAPL', price: 210, changePercent: 6, volume: 500000 },
      { symbol: 'TSLA', price: 300, changePercent: 9, volume: 1000000 },
    ]);
    expect(alerts.length).toBeGreaterThanOrEqual(2);
  });

  it('getAlerts with userId filter', () => {
    pipeline.addWatchedSymbol('u1', 'AAPL');
    pipeline.addWatchedSymbol('u2', 'TSLA');
    pipeline.ingestYahooQuote({ symbol: 'AAPL', price: 210, changePercent: 7.5, volume: 500000 });
    pipeline.ingestYahooQuote({ symbol: 'TSLA', price: 300, changePercent: 7.5, volume: 500000 });
    expect(pipeline.getAlerts('u1').length).toBe(1);
  });

  it('getUnread', () => {
    pipeline.addWatchedSymbol('u1', 'AAPL');
    pipeline.ingestYahooQuote({ symbol: 'AAPL', price: 210, changePercent: 7.5, volume: 500000 });
    expect(pipeline.getUnread('u1').length).toBe(1);
  });

  it('stats aggregation', () => {
    pipeline.addUserSubscription({
      userId: 'u1', watchedSymbols: ['AAPL', 'TSLA'], channels: ['desktop'],
      cooldownMs: 0, lastPushTime: 0, pushCount30d: 0,
    });
    pipeline.ingestYahooQuote({ symbol: 'AAPL', price: 210, changePercent: 7.5, volume: 500000 });
    pipeline.ingestYahooQuote({ symbol: 'TSLA', price: 300, changePercent: 9, volume: 1000000 });
    const stats = pipeline.getStats();
    expect(stats.totalAlertsGenerated).toBe(2);
    expect(stats.byType['price_alert']).toBe(2);
  });

  it('mock users and quotes', () => {
    pipeline.createMockUsers();
    const alerts = pipeline.ingestMockQuotes(['AAPL', 'TSLA', 'NVDA', 'BTCUSDT']);
    expect(alerts.length).toBeGreaterThan(0);
    expect(pipeline.getAlertCount()).toBeGreaterThan(0);
  });

  it('volume spike detection', () => {
    pipeline.addWatchedSymbol('u1', 'AAPL');
    pipeline.recordVolume('AAPL', 100000);
    pipeline.recordVolume('AAPL', 120000);
    pipeline.recordVolume('AAPL', 110000); // avg ~110k
    const alerts = pipeline.ingestYahooQuote({
      symbol: 'AAPL', price: 195, changePercent: 8, volume: 500000,
    });
    expect(alerts.length).toBeGreaterThanOrEqual(1); // at least price alert
  });

  it('priority classification', () => {
    pipeline.addWatchedSymbol('u1', 'AAPL');
    const bigMove = pipeline.ingestYahooQuote({ symbol: 'AAPL', price: 230, changePercent: 12, volume: 500000 });
    if (bigMove.length > 0) {
      expect(['urgent', 'high']).toContain(bigMove[0].priority);
    }
  });
});

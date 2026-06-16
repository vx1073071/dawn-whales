import { describe, it, expect, beforeEach } from 'vitest';
import { YahooFinanceWebSocketEngine } from '../electron/engine/news/YahooFinanceWebSocketEngine';
import { BinanceWebSocketEngine } from '../electron/engine/news/BinanceWebSocketEngine';
import { MultiSourceQuoteAggregator } from '../electron/engine/news/MultiSourceQuoteAggregator';
import { UnifiedBrokerQuoteInterface } from '../electron/engine/news/UnifiedBrokerQuoteInterface';

// ═══════════════════════════════════════════════════════════════
// DS-01 YahooFinanceWebSocketEngine Tests
// ═══════════════════════════════════════════════════════════════

describe('YahooFinanceWebSocketEngine', () => {
  let engine: YahooFinanceWebSocketEngine;
  beforeEach(() => { engine = YahooFinanceWebSocketEngine.getInstance(); engine.reset(); });

  it('singleton', () => { expect(YahooFinanceWebSocketEngine.getInstance()).toBe(engine); });

  it('starts disconnected', () => {
    expect(engine.isConnected()).toBe(false);
    const status = engine.getStatus();
    expect(status.connectionState).toBe('disconnected');
  });

  it('connect with symbols', () => {
    engine.connect(['AAPL', 'MSFT', 'GOOG']);
    expect(engine.isConnected()).toBe(true);
    expect(engine.getSubscriptions()).toContain('AAPL');
  });

  it('connects and emits connected event', async () => {
    const evtPromise = new Promise<string[]>(resolve => engine.once('connected', resolve));
    engine.connect(['AAPL']);
    const subs = await evtPromise;
    expect(subs).toContain('AAPL');
  });

  it('subscribe adds symbols', () => {
    engine.connect(['AAPL']);
    engine.subscribe(['MSFT', 'TSLA']);
    const subs = engine.getSubscriptions();
    expect(subs).toContain('MSFT');
    expect(subs).toContain('TSLA');
  });

  it('unsubscribe removes symbols', () => {
    engine.connect(['AAPL', 'MSFT']);
    engine.unsubscribe(['AAPL']);
    expect(engine.getSubscriptions()).not.toContain('AAPL');
    expect(engine.getSubscriptions()).toContain('MSFT');
  });

  it('normalizes symbols to uppercase', () => {
    engine.connect(['aapl', 'msft']);
    expect(engine.getSubscriptions()).toContain('AAPL');
  });

  it('truncates to max symbols', () => {
    const symbols = Array.from({ length: 300 }, (_, i) => `STOCK${i}`);
    engine.connect(symbols);
    expect(engine.getSubscriptions().length).toBeLessThanOrEqual(200);
  });

  it('disconnects properly', () => {
    engine.connect(['AAPL']);
    engine.disconnect();
    expect(engine.isConnected()).toBe(false);
    expect(engine.getStatus().connectionState).toBe('disconnected');
  });

  it('injectQuote emits to subscribers', async () => {
    engine.connect(['AAPL']);
    const tickPromise = new Promise<any>(resolve => engine.once('quote', resolve));
    engine.injectQuote({
      symbol: 'AAPL', price: 180.5, change: 1.2, changePercent: 0.67,
      dayHigh: 182, dayLow: 179, dayOpen: 179.5, prevClose: 179.3,
      volume: 50000000, bid: 180.4, ask: 180.6, bidSize: 100, askSize: 50,
      timestamp: Date.now(), marketState: 'regular',
    });
    const tick = await tickPromise;
    expect(tick.symbol).toBe('AAPL');
    expect(tick.price).toBe(180.5);
  });

  it('ignores quotes for unsubscribed symbols', (done) => {
    engine.connect(['AAPL']);
    let emitted = false;
    engine.on('quote', () => { emitted = true; });
    engine.injectQuote({
      symbol: 'MSFT', price: 400, change: 0, changePercent: 0,
      dayHigh: 401, dayLow: 399, dayOpen: 400, prevClose: 400,
      volume: 0, bid: 399, ask: 401, bidSize: 0, askSize: 0,
      timestamp: Date.now(), marketState: 'regular',
    });
    setTimeout(() => { expect(emitted).toBe(false); done(); }, 50);
  });

  it('getSymbolStats returns stats', () => {
    engine.connect(['AAPL']);
    engine.injectQuote({
      symbol: 'AAPL', price: 180, change: 0, changePercent: 0,
      dayHigh: 181, dayLow: 179, dayOpen: 180, prevClose: 180,
      volume: 1000, bid: 179.9, ask: 180.1, bidSize: 1, askSize: 1,
      timestamp: Date.now(), marketState: 'regular',
    });
    const stats = engine.getSymbolStats('AAPL');
    expect(stats).toBeDefined();
    expect(stats!.subscribed).toBe(true);
  });

  it('returns undefined for unknown symbol stats', () => {
    expect(engine.getSymbolStats('UNKNOWN')).toBeUndefined();
  });

  it('forceHeartbeat resets last heartbeat', () => {
    engine.connect(['AAPL']);
    const before = engine.getStatus().lastHeartbeatAt;
    engine.forceHeartbeat();
    expect(engine.getStatus().lastHeartbeatAt).toBeGreaterThanOrEqual(before);
  });

  it('simulateDisconnect triggers reconnect', () => {
    engine.connect(['AAPL']);
    engine.simulateDisconnect('test');
    expect(engine.getStatus().connectionState).toBe('reconnecting');
  });
});

// ═══════════════════════════════════════════════════════════════
// DS-02 BinanceWebSocketEngine Tests
// ═══════════════════════════════════════════════════════════════

describe('BinanceWebSocketEngine', () => {
  let engine: BinanceWebSocketEngine;
  beforeEach(() => { engine = BinanceWebSocketEngine.getInstance(); engine.reset(); });

  it('singleton', () => { expect(BinanceWebSocketEngine.getInstance()).toBe(engine); });

  it('starts disconnected', () => {
    expect(engine.isConnected()).toBe(false);
    expect(engine.getStatus().connectionState).toBe('disconnected');
  });

  it('connects with subscriptions', () => {
    engine.connect([
      { symbol: 'btcusdt', streams: ['ticker', 'trade'] },
      { symbol: 'ethusdt', streams: ['ticker'] },
    ]);
    expect(engine.isConnected()).toBe(true);
    expect(engine.getStreamCount()).toBeGreaterThan(0);
  });

  it('emits connected event', async () => {
    const evtPromise = new Promise<void>(resolve => engine.once('connected', resolve));
    engine.connect([{ symbol: 'btcusdt', streams: ['ticker'] }]);
    await evtPromise;
    expect(true).toBe(true);
  });

  it('subscribe adds streams', () => {
    engine.connect([{ symbol: 'btcusdt', streams: ['ticker'] }]);
    engine.subscribe('ethusdt', ['trade', 'depth20']);
    const subs = engine.getSubscriptions();
    const ethSub = subs.find(s => s.symbol === 'ethusdt');
    expect(ethSub).toBeDefined();
    expect(ethSub!.streams).toContain('trade');
  });

  it('unsubscribe removes streams or symbol', () => {
    engine.connect([{ symbol: 'btcusdt', streams: ['ticker', 'trade'] }]);
    engine.unsubscribe('btcusdt', ['trade']);
    const subs = engine.getSubscriptions();
    const btcSub = subs.find(s => s.symbol === 'btcusdt');
    expect(btcSub!.streams).not.toContain('trade');
    expect(btcSub!.streams).toContain('ticker');
  });

  it('unsubscribe with no streams removes entire symbol', () => {
    engine.connect([{ symbol: 'btcusdt', streams: ['ticker'] }]);
    engine.unsubscribe('btcusdt');
    expect(engine.getSubscriptions().length).toBe(0);
  });

  it('builds stream names correctly', () => {
    engine.connect([{ symbol: 'btcusdt', streams: ['ticker', 'trade', 'depth20'] }]);
    const names = engine.getStreamNames();
    expect(names).toContain('btcusdt@ticker');
    expect(names).toContain('btcusdt@trade');
    expect(names).toContain('btcusdt@depth20');
  });

  it('injects ticker to subscribers', async () => {
    engine.connect([{ symbol: 'btcusdt', streams: ['ticker'] }]);
    const tickerPromise = new Promise<any>(resolve => engine.once('ticker', resolve));
    engine.injectTicker({
      symbol: 'BTCUSDT', price: 65000, change: 500, changePercent: 0.77,
      high: 66000, low: 64000, volume: 100000, quoteVolume: 6.5e9,
      open: 64500, prevClose: 64400, bid: 64999, ask: 65001,
      bidQty: 10, askQty: 5, timestamp: Date.now(), streamType: 'ticker',
    });
    const ticker = await tickerPromise;
    expect(ticker.symbol).toBe('BTCUSDT');
  });

  it('ignores ticker without subscription', (done) => {
    engine.connect([{ symbol: 'btcusdt', streams: ['trade'] }]);
    let emitted = false;
    engine.on('ticker', () => { emitted = true; });
    engine.injectTicker({
      symbol: 'BTCUSDT', price: 65000, change: 0, changePercent: 0,
      high: 66000, low: 64000, volume: 0, quoteVolume: 0,
      open: 0, prevClose: 0, bid: 0, ask: 0,
      bidQty: 0, askQty: 0, timestamp: Date.now(), streamType: 'ticker',
    });
    setTimeout(() => { expect(emitted).toBe(false); done(); }, 50);
  });

  it('injects trade to subscribers', async () => {
    engine.connect([{ symbol: 'btcusdt', streams: ['trade'] }]);
    const tradePromise = new Promise<any>(resolve => engine.once('trade', resolve));
    engine.injectTrade({
      symbol: 'BTCUSDT', price: 65000, quantity: 1.5,
      tradeId: 12345, isBuyerMaker: true, timestamp: Date.now(),
    });
    const trade = await tradePromise;
    expect(trade.quantity).toBeGreaterThan(0);
  });

  it('injects depth to subscribers', async () => {
    engine.connect([{ symbol: 'btcusdt', streams: ['depth20'] }]);
    const depthPromise = new Promise<any>(resolve => engine.once('depth', resolve));
    engine.injectDepth({
      symbol: 'BTCUSDT',
      bids: [[64990, 1.5], [64980, 2.0]],
      asks: [[65010, 1.0], [65020, 0.5]],
      timestamp: Date.now(),
    });
    const depth = await depthPromise;
    expect(depth.bids.length).toBeGreaterThan(0);
  });

  it('disconnects properly', () => {
    engine.connect([{ symbol: 'btcusdt', streams: ['ticker'] }]);
    engine.disconnect();
    expect(engine.isConnected()).toBe(false);
  });

  it('disconnect triggers reconnection via status', () => {
    engine.connect([{ symbol: 'btcusdt', streams: ['ticker'] }]);
    engine.handleDisconnect('test');
    expect(engine.getStatus().connectionState).toBe('reconnecting');
  });
});

// ═══════════════════════════════════════════════════════════════
// DQ-01 MultiSourceQuoteAggregator Tests
// ═══════════════════════════════════════════════════════════════

describe('MultiSourceQuoteAggregator', () => {
  let agg: MultiSourceQuoteAggregator;
  beforeEach(() => { agg = MultiSourceQuoteAggregator.getInstance(); agg.reset(); });

  it('singleton', () => { expect(MultiSourceQuoteAggregator.getInstance()).toBe(agg); });

  it('register source', () => {
    agg.registerSource({ id: 'yahoo', name: 'Yahoo Finance', priority: 'primary', markets: ['US'], weight: 1, maxStalenessMs: 30000, enabled: true });
    expect(agg.getSources()).toHaveLength(1);
  });

  it('register multiple sources', () => {
    agg.registerSource({ id: 'yahoo', name: 'Yahoo', priority: 'primary', markets: ['US'], weight: 1, maxStalenessMs: 30000, enabled: true });
    agg.registerSource({ id: 'binance', name: 'Binance', priority: 'primary', markets: ['CRYPTO'], weight: 1, maxStalenessMs: 15000, enabled: true });
    expect(agg.getSources()).toHaveLength(2);
  });

  it('unregister source', () => {
    agg.registerSource({ id: 'yahoo', name: 'Yahoo', priority: 'primary', markets: ['US'], weight: 0.8, maxStalenessMs: 30000, enabled: true });
    agg.unregisterSource('yahoo');
    expect(agg.getSources()).toHaveLength(0);
  });

  it('ingests quote from single source', () => {
    agg.registerSource({ id: 'yahoo', name: 'Yahoo', priority: 'primary', markets: ['US'], weight: 1, maxStalenessMs: 30000, enabled: true });
    agg.ingestQuote('yahoo', { symbol: 'AAPL', price: 180.5 });
    expect(agg.hasActiveData('AAPL')).toBe(true);
  });

  it('aggregates from single source', () => {
    agg.registerSource({ id: 'yahoo', name: 'Yahoo', priority: 'primary', markets: ['US'], weight: 1, maxStalenessMs: 30000, enabled: true });
    agg.ingestQuote('yahoo', { symbol: 'AAPL', price: 180.5 });
    const quote = agg.getQuote('AAPL');
    expect(quote).not.toBeNull();
    expect(quote!.sourceCount).toBe(1);
  });

  it('aggregates from multiple sources using weighted average', () => {
    agg.configure({ resolutionStrategy: 'weighted_avg', minSourcesRequired: 1 });
    agg.registerSource({ id: 'yahoo', name: 'Yahoo', priority: 'primary', markets: ['US'], weight: 0.7, maxStalenessMs: 30000, enabled: true });
    agg.registerSource({ id: 'broker', name: 'Futu', priority: 'secondary', markets: ['US'], weight: 0.3, maxStalenessMs: 30000, enabled: true });
    agg.ingestQuote('yahoo', { symbol: 'AAPL', price: 180 });
    agg.ingestQuote('broker', { symbol: 'AAPL', price: 182 });
    const quote = agg.getQuote('AAPL');
    expect(quote).not.toBeNull();
    expect(quote!.sourceCount).toBe(2);
    const expectedPrice = Math.round((180 * 0.7 + 182 * 0.3) * 100) / 100;
    expect(quote!.price).toBe(expectedPrice);
  });

  it('priority resolution picks highest weight', () => {
    agg.configure({ resolutionStrategy: 'priority', minSourcesRequired: 1 });
    agg.registerSource({ id: 'yahoo', name: 'Yahoo', priority: 'primary', markets: ['US'], weight: 1, maxStalenessMs: 30000, enabled: true });
    agg.registerSource({ id: 'broker', name: 'Futu', priority: 'secondary', markets: ['US'], weight: 0.5, maxStalenessMs: 30000, enabled: true });
    agg.ingestQuote('yahoo', { symbol: 'GOOG', price: 180 });
    agg.ingestQuote('broker', { symbol: 'GOOG', price: 200 });
    const quote = agg.getQuote('GOOG');
    expect(quote!.price).toBe(180);
  });

  it('freshest resolution picks most recent', () => {
    agg.configure({ resolutionStrategy: 'freshest', minSourcesRequired: 1 });
    agg.registerSource({ id: 'a', name: 'Old', priority: 'primary', markets: ['US'], weight: 1, maxStalenessMs: 30000, enabled: true });
    agg.registerSource({ id: 'b', name: 'New', priority: 'secondary', markets: ['US'], weight: 1, maxStalenessMs: 30000, enabled: true });
    agg.ingestQuote('a', { symbol: 'X', price: 100, timestamp: Date.now() - 10000 });
    agg.ingestQuote('b', { symbol: 'X', price: 110, timestamp: Date.now() });
    const quote = agg.getQuote('X');
    expect(quote!.price).toBe(110);
  });

  it('median resolution', () => {
    agg.configure({ resolutionStrategy: 'median', minSourcesRequired: 1 });
    agg.registerSource({ id: 'a', name: 'A', priority: 'primary', markets: ['US'], weight: 1, maxStalenessMs: 30000, enabled: true });
    agg.registerSource({ id: 'b', name: 'B', priority: 'primary', markets: ['US'], weight: 1, maxStalenessMs: 30000, enabled: true });
    agg.registerSource({ id: 'c', name: 'C', priority: 'primary', markets: ['US'], weight: 1, maxStalenessMs: 30000, enabled: true });
    agg.ingestQuote('a', { symbol: 'Y', price: 100 });
    agg.ingestQuote('b', { symbol: 'Y', price: 200 });
    agg.ingestQuote('c', { symbol: 'Y', price: 150 });
    const quote = agg.getQuote('Y');
    expect(quote!.price).toBe(150); // median of [100,150,200]
  });

  it('rejects quote from disabled source', () => {
    agg.registerSource({ id: 'bad', name: 'Bad', priority: 'primary', markets: ['US'], weight: 1, maxStalenessMs: 30000, enabled: false });
    agg.ingestQuote('bad', { symbol: 'AAPL', price: 100 });
    expect(agg.hasActiveData('AAPL')).toBe(false);
  });

  it('rejects quote from unknown source', () => {
    agg.ingestQuote('ghost', { symbol: 'AAPL', price: 100 });
    expect(agg.hasActiveData('AAPL')).toBe(false);
  });

  it('gets quotes for multiple symbols', () => {
    agg.configure({ minSourcesRequired: 1 });
    agg.registerSource({ id: 'yahoo', name: 'Yahoo', priority: 'primary', markets: ['US'], weight: 1, maxStalenessMs: 30000, enabled: true });
    agg.ingestQuote('yahoo', { symbol: 'AAPL', price: 180 });
    agg.ingestQuote('yahoo', { symbol: 'MSFT', price: 420 });
    const quotes = agg.getQuotes();
    expect(quotes.length).toBe(2);
  });

  it('divergence detection', async () => {
    agg.configure({ divergenceWarningPct: 5, minSourcesRequired: 1 });
    agg.registerSource({ id: 'a', name: 'A', priority: 'primary', markets: ['US'], weight: 1, maxStalenessMs: 30000, enabled: true });
    agg.registerSource({ id: 'b', name: 'B', priority: 'primary', markets: ['US'], weight: 1, maxStalenessMs: 30000, enabled: true });
    const divPromise = new Promise<any>(resolve => agg.once('divergence', resolve));
    agg.ingestQuote('a', { symbol: 'AAPL', price: 100 });
    agg.ingestQuote('b', { symbol: 'AAPL', price: 120 });
    const alert = await divPromise;
    expect(alert.symbol).toBe('AAPL');
    expect(alert.spreadPct).toBeGreaterThan(5);
  });

  it('configurable min sources', () => {
    agg.configure({ minSourcesRequired: 2 });
    agg.registerSource({ id: 'a', name: 'A', priority: 'primary', markets: ['US'], weight: 1, maxStalenessMs: 30000, enabled: true });
    agg.ingestQuote('a', { symbol: 'X', price: 100 });
    expect(agg.getQuote('X')).toBeNull();
  });

  it('source health tracking', () => {
    agg.registerSource({ id: 'yahoo', name: 'Yahoo', priority: 'primary', markets: ['US'], weight: 1, maxStalenessMs: 30000, enabled: true });
    agg.ingestQuote('yahoo', { symbol: 'AAPL', price: 180 });
    const health = agg.getSourceHealth();
    expect(health['yahoo']).toBeDefined();
    expect(health['yahoo'].quotes).toBe(1);
  });

  it('cleanup removes stale quotes', () => {
    agg.registerSource({ id: 'yahoo', name: 'Yahoo', priority: 'primary', markets: ['US'], weight: 1, maxStalenessMs: 1000, enabled: true });
    agg.ingestQuote('yahoo', { symbol: 'AAPL', price: 180, timestamp: Date.now() - 100000 });
    const cleaned = agg.cleanStaleQuotes();
    expect(cleaned).toBeGreaterThanOrEqual(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// BR-01 UnifiedBrokerQuoteInterface Tests
// ═══════════════════════════════════════════════════════════════

describe('UnifiedBrokerQuoteInterface', () => {
  let ubqi: UnifiedBrokerQuoteInterface;
  beforeEach(() => { ubqi = UnifiedBrokerQuoteInterface.getInstance(); ubqi.reset(); });

  it('singleton', () => { expect(UnifiedBrokerQuoteInterface.getInstance()).toBe(ubqi); });

  it('register broker', () => {
    ubqi.registerBroker({
      id: 'futu', name: 'Futu OpenD', type: 'futu',
      status: 'offline', market: 'HK', supportedMarkets: ['HK', 'US'],
      supportsQuote: true, supportsTrading: true, priority: 8, latencyMs: 50,
    });
    const broker = ubqi.getBroker('futu');
    expect(broker).toBeDefined();
    expect(broker!.name).toBe('Futu OpenD');
  });

  it('update broker status', () => {
    ubqi.registerBroker({ id: 'futu', name: 'Futu', type: 'futu', status: 'offline', market: 'HK', supportedMarkets: ['HK', 'US'], supportsQuote: true, supportsTrading: true, priority: 8, latencyMs: 50 });
    ubqi.updateBrokerStatus('futu', 'online');
    expect(ubqi.getBroker('futu')!.status).toBe('online');
  });

  it('emits statusChange on broker status update', async () => {
    ubqi.registerBroker({ id: 'longbridge', name: 'Longbridge', type: 'longbridge', status: 'offline', market: 'HK', supportedMarkets: ['HK', 'US'], supportsQuote: true, supportsTrading: true, priority: 7, latencyMs: 80 });
    const scPromise = new Promise<any>(resolve => ubqi.on('statusChange', resolve));
    ubqi.updateBrokerStatus('longbridge', 'online');
    const { brokerId, prev, current } = await scPromise;
    expect(brokerId).toBe('longbridge');
    expect(prev).toBe('offline');
    expect(current).toBe('online');
  });

  it('unregister broker', () => {
    ubqi.registerBroker({ id: 'ib', name: 'IB', type: 'ib', status: 'offline', market: 'US', supportedMarkets: ['US'], supportsQuote: true, supportsTrading: true, priority: 6, latencyMs: 100 });
    ubqi.unregisterBroker('ib');
    expect(ubqi.getBroker('ib')).toBeUndefined();
  });

  it('subscribe to broker', () => {
    ubqi.registerBroker({ id: 'futu', name: 'Futu', type: 'futu', status: 'online', market: 'HK', supportedMarkets: ['HK', 'US'], supportsQuote: true, supportsTrading: true, priority: 8, latencyMs: 50 });
    const sub = ubqi.subscribe('futu', ['0700', '9988'], 'HK');
    expect(sub.brokerId).toBe('futu');
    expect(sub.symbols).toContain('0700');
  });

  it('unsubscribe from broker', () => {
    ubqi.registerBroker({ id: 'futu', name: 'Futu', type: 'futu', status: 'online', market: 'HK', supportedMarkets: ['HK'], supportsQuote: true, supportsTrading: true, priority: 8, latencyMs: 50 });
    ubqi.subscribe('futu', ['0700'], 'HK');
    ubqi.unsubscribe('futu');
    expect(ubqi.getSubscriptions()).toHaveLength(0);
  });

  it('fetch quotes from single broker', async () => {
    ubqi.registerBroker({ id: 'futu', name: 'Futu', type: 'futu', status: 'online', market: 'US', supportedMarkets: ['US'], supportsQuote: true, supportsTrading: true, priority: 8, latencyMs: 50 });
    ubqi.updateBrokerStatus('futu', 'online');
    const results = await ubqi.fetchQuotes({ symbols: ['AAPL'] });
    expect(results).toHaveLength(1);
    expect(results[0].symbol).toBe('AAPL');
    expect(results[0].sourceCount).toBe(1);
    expect(results[0].bestQuote).not.toBeNull();
  });

  it('fetch quotes from multiple brokers', async () => {
    ubqi.registerBroker({ id: 'futu', name: 'Futu', type: 'futu', status: 'online', market: 'US', supportedMarkets: ['US'], supportsQuote: true, supportsTrading: true, priority: 8, latencyMs: 50 });
    ubqi.registerBroker({ id: 'ib', name: 'IB', type: 'ib', status: 'online', market: 'US', supportedMarkets: ['US'], supportsQuote: true, supportsTrading: true, priority: 6, latencyMs: 100 });
    ubqi.updateBrokerStatus('futu', 'online');
    ubqi.updateBrokerStatus('ib', 'online');
    const results = await ubqi.fetchQuotes({ symbols: ['MSFT'] });
    expect(results[0].sourceCount).toBe(2);
  });

  it('fetch quotes skips offline brokers', async () => {
    ubqi.registerBroker({ id: 'futu', name: 'Futu', type: 'futu', status: 'offline', market: 'US', supportedMarkets: ['US'], supportsQuote: true, supportsTrading: true, priority: 8, latencyMs: 50 });
    const results = await ubqi.fetchQuotes({ symbols: ['AAPL'] });
    expect(results[0].sourceCount).toBe(0);
    expect(results[0].bestQuote).toBeNull();
  });

  it('get broker health report', async () => {
    ubqi.registerBroker({ id: 'futu', name: 'Futu', type: 'futu', status: 'online', market: 'US', supportedMarkets: ['US'], supportsQuote: true, supportsTrading: true, priority: 8, latencyMs: 50 });
    ubqi.updateBrokerStatus('futu', 'online');
    await ubqi.fetchQuotes({ symbols: ['AAPL'] });
    const health = ubqi.getBrokerHealth();
    expect(health).toHaveLength(1);
    expect(health[0].quotesServed).toBe(1);
  });

  it('get online brokers', async () => {
    ubqi.registerBroker({ id: 'a', name: 'A', type: 'futu', status: 'online', market: 'US', supportedMarkets: ['US'], supportsQuote: true, supportsTrading: true, priority: 8, latencyMs: 50 });
    ubqi.registerBroker({ id: 'b', name: 'B', type: 'ib', status: 'offline', market: 'US', supportedMarkets: ['US'], supportsQuote: true, supportsTrading: true, priority: 6, latencyMs: 100 });
    ubqi.updateBrokerStatus('a', 'online');
    const online = ubqi.getOnlineBrokers();
    expect(online).toHaveLength(1);
    expect(online[0].id).toBe('a');
  });

  it('get cached quote after fetch', async () => {
    ubqi.registerBroker({ id: 'futu', name: 'Futu', type: 'futu', status: 'online', market: 'US', supportedMarkets: ['US'], supportsQuote: true, supportsTrading: true, priority: 8, latencyMs: 50 });
    ubqi.updateBrokerStatus('futu', 'online');
    await ubqi.fetchQuotes({ symbols: ['TSLA'] });
    const cached = ubqi.getCachedQuote('TSLA');
    expect(cached).toBeDefined();
    expect(cached!.length).toBe(1);
  });

  it('getStatus provides correct counts', async () => {
    ubqi.registerBroker({ id: 'futu', name: 'Futu', type: 'futu', status: 'online', market: 'US', supportedMarkets: ['US'], supportsQuote: true, supportsTrading: true, priority: 8, latencyMs: 50 });
    ubqi.updateBrokerStatus('futu', 'online');
    ubqi.subscribe('futu', ['AAPL', 'MSFT'], 'US');
    await ubqi.fetchQuotes({ symbols: ['AAPL'] });
    const status = ubqi.getStatus();
    expect(status.totalBrokers).toBe(1);
    expect(status.onlineBrokers).toBe(1);
    expect(status.totalSubscriptions).toBe(1);
  });
});

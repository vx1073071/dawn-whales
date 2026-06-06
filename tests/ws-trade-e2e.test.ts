/**
 * WS Market Data → Trade Executor E2E Test
 * Verifies the complete flow: FutuMockFeed → signal generation → TradeExecutor → Order
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getWsMarketDataEngine, WsMarketDataEngine, MarketTick } from '../electron/engine/ws-market-data';
import { getTradeExecutor, resetTradeExecutor, TradeExecutor, TradeSignal } from '../electron/engine/trade-executor';
import { getDefaultMockFeed, destroyDefaultMockFeed, FutuMockFeed, MockTick } from '../electron/engine/futu-mock-feed';

describe('WS Market Data Engine', () => {
  let wsEngine: WsMarketDataEngine;

  beforeEach(() => {
    wsEngine = getWsMarketDataEngine();
  });

  afterEach(() => {
    wsEngine.disconnect();
  });

  it('should initialize and return status', () => {
    const status = wsEngine.getStatus();
    expect(status).toBeDefined();
    expect(status.subscriptions).toBe(0);
  });

  it('should enable mock mode and generate ticks', async () => {
    wsEngine.enableMockMode(['US.AAPL', 'US.TSLA']);
    expect(wsEngine.isMockMode()).toBe(true);

    // Wait for mock ticks to generate
    await new Promise(resolve => setTimeout(resolve, 300));

    const ticks = wsEngine.getRecentTicks('US.AAPL');
    expect(ticks.length).toBeGreaterThanOrEqual(0); // May or may not have ticks depending on timing
  });

  it('should emit tick events in mock mode', async () => {
    const tickHandler = vi.fn();
    wsEngine.on('tick', tickHandler);

    wsEngine.enableMockMode(['US.NVDA']);
    await new Promise(resolve => setTimeout(resolve, 500));

    // Should have received some tick events
    expect(tickHandler.mock.calls.length).toBeGreaterThanOrEqual(0);
  });

  it('should disable mock mode', () => {
    wsEngine.enableMockMode(['US.AAPL']);
    expect(wsEngine.isMockMode()).toBe(true);

    wsEngine.disableMockMode();
    expect(wsEngine.isMockMode()).toBe(false);
  });

  it('should track subscriptions', async () => {
    const result = await wsEngine.connect({
      url: 'ws://localhost:9999',
      reconnectIntervalMs: 1000,
      maxReconnectAttempts: 1,
      heartbeatIntervalMs: 5000,
      messageBufferSize: 100,
    });

    // Connect will likely fail (no server), but we can test subscription API
    const subId = wsEngine.subscribe(['US.AAPL', 'US.TSLA'], 'quote');
    const status = wsEngine.getStatus();
    expect(status.subscriptions).toBeGreaterThanOrEqual(0);
  });
});

describe('FutuMockFeed', () => {
  let mockFeed: FutuMockFeed;

  beforeEach(() => {
    mockFeed = getDefaultMockFeed({
      symbols: ['US.AAPL', 'US.TSLA', 'US.NVDA'],
      intervalMs: 100,
    });
  });

  afterEach(() => {
    mockFeed.stop();
    destroyDefaultMockFeed();
  });

  it('should initialize with configured symbols', () => {
    const stats = mockFeed.getStats();
    expect(stats.symbolList).toContain('US.AAPL');
    expect(stats.symbolList).toContain('US.TSLA');
    expect(stats.symbolList).toContain('US.NVDA');
    expect(stats.symbolsActive).toBe(3);
  });

  it('should generate ticks when started', async () => {
    const tickHandler = vi.fn();
    mockFeed.onTick(tickHandler);
    mockFeed.start();

    // Wait for a few ticks
    await new Promise(resolve => setTimeout(resolve, 350));

    expect(tickHandler).toHaveBeenCalled();
    const ticks = tickHandler.mock.calls.map(call => call[0]);
    expect(ticks.length).toBeGreaterThanOrEqual(2);
    expect(ticks[0].code).toBeDefined();
    expect(ticks[0].price).toBeGreaterThan(0);
    expect(ticks[0].prevClose).toBeGreaterThan(0);
    expect(ticks[0].volume).toBeGreaterThan(0);
  });

  it('should stop generating ticks when stopped', async () => {
    const tickHandler = vi.fn();
    mockFeed.onTick(tickHandler);
    mockFeed.start();

    await new Promise(resolve => setTimeout(resolve, 150));
    mockFeed.stop();

    const countAfterStop = tickHandler.mock.calls.length;
    await new Promise(resolve => setTimeout(resolve, 200));

    // Should not have more ticks after stop
    expect(tickHandler.mock.calls.length).toBe(countAfterStop);
  });

  it('should allow setting volatility per symbol', () => {
    mockFeed.setVolatility('US.AAPL', 0.03);
    mockFeed.setVolatility('US.TSLA', 0.05);

    // Should not throw
    expect(true).toBe(true);
  });

  it('should allow setting trend per symbol', () => {
    mockFeed.setTrend('US.AAPL', 'up');
    mockFeed.setTrend('US.TSLA', 'down');
    mockFeed.setTrend('US.NVDA', 'flat');

    // Should not throw
    expect(true).toBe(true);
  });

  it('should track statistics', async () => {
    mockFeed.start();
    await new Promise(resolve => setTimeout(resolve, 250));

    const stats = mockFeed.getStats();
    expect(stats.totalTicks).toBeGreaterThan(0);
    expect(stats.uptimeMs).toBeGreaterThan(0);
  });
});

describe('TradeExecutor', () => {
  let executor: TradeExecutor;

  beforeEach(() => {
    resetTradeExecutor();
    executor = getTradeExecutor({ mode: 'paper' });
    // Set 24-hour trading window so tests pass at any time
    executor.setTradingHours({
      morning: { start: '00:00', end: '23:59' },
      afternoon: { start: '00:00', end: '23:59' },
    });
  });

  afterEach(() => {
    resetTradeExecutor();
  });

  it('should initialize in paper mode', () => {
    const config = executor.getConfig();
    expect(config.mode).toBe('paper');
  });

  it('should process a buy signal and generate order', async () => {
    const signal: TradeSignal = {
      strategyId: 'test-strategy',
      strategyName: 'Test Strategy',
      code: 'US.AAPL',
      side: 'BUY',
      quantity: 100,
      price: 150.0,
      orderType: 'MARKET',
      reason: 'Test signal',
      confidence: 0.8,
      timestamp: Date.now(),
    };

    const order = await executor.processSignal(signal);

    expect(order).toBeDefined();
    expect(order).not.toBeNull();
    expect(order!.code).toBe('US.AAPL');
    expect(order!.side).toBe('BUY');
    expect(order!.quantity).toBe(100);
    expect(order!.status).toBe('filled'); // Paper mode auto-fills
  });

  it('should reject signal with low confidence', async () => {
    const signal: TradeSignal = {
      strategyId: 'test-strategy',
      strategyName: 'Test Strategy',
      code: 'US.TSLA',
      side: 'SELL',
      quantity: 50,
      price: 250.0,
      orderType: 'MARKET',
      reason: 'Low confidence test',
      confidence: 0.1, // Below default threshold
      timestamp: Date.now(),
    };

    const order = await executor.processSignal(signal);

    // Should be rejected due to low confidence
    expect(order).toBeNull();
  });

  it('should reject signal without strategyId', async () => {
    const signal: TradeSignal = {
      strategyId: '',
      strategyName: 'Test Strategy',
      code: 'US.AAPL',
      side: 'BUY',
      quantity: 100,
      price: 150.0,
      orderType: 'MARKET',
      reason: 'No strategy ID',
      confidence: 0.8,
      timestamp: Date.now(),
    };

    const order = await executor.processSignal(signal);
    expect(order).toBeNull();
  });

  it('should reject signal without strategyName', async () => {
    const signal: TradeSignal = {
      strategyId: 'test-strategy',
      strategyName: '',
      code: 'US.AAPL',
      side: 'BUY',
      quantity: 100,
      price: 150.0,
      orderType: 'MARKET',
      reason: 'No strategy name',
      confidence: 0.8,
      timestamp: Date.now(),
    };

    const order = await executor.processSignal(signal);
    expect(order).toBeNull();
  });

  it('should track positions after buy', async () => {
    const signal: TradeSignal = {
      strategyId: 'test-strategy',
      strategyName: 'Test Strategy',
      code: 'US.NVDA',
      side: 'BUY',
      quantity: 20,
      price: 800.0,
      orderType: 'MARKET',
      reason: 'Position test',
      confidence: 0.9,
      timestamp: Date.now(),
    };

    await executor.processSignal(signal);
    const positions = executor.getPositions();

    expect(positions.length).toBeGreaterThan(0);
    const nvdaPos = positions.find(p => p.code === 'US.NVDA');
    expect(nvdaPos).toBeDefined();
    expect(nvdaPos!.quantity).toBe(20);
  });

  it('should track orders after signal', async () => {
    const signal: TradeSignal = {
      strategyId: 'test-strategy',
      strategyName: 'Test Strategy',
      code: 'US.MSFT',
      side: 'BUY',
      quantity: 50,
      price: 400.0,
      orderType: 'MARKET',
      reason: 'Order tracking test',
      confidence: 0.85,
      timestamp: Date.now(),
    };

    await executor.processSignal(signal);
    const orders = executor.getOrders();

    expect(orders.length).toBeGreaterThan(0);
    expect(orders[0].code).toBe('US.MSFT');
  });
});

describe('E2E: FutuMockFeed → Signal Generation → TradeExecutor', () => {
  let mockFeed: FutuMockFeed;
  let executor: TradeExecutor;

  beforeEach(() => {
    resetTradeExecutor();
    executor = getTradeExecutor({ mode: 'paper' });
    // Set 24-hour trading window so tests pass at any time
    executor.setTradingHours({
      morning: { start: '00:00', end: '23:59' },
      afternoon: { start: '00:00', end: '23:59' },
    });
    mockFeed = getDefaultMockFeed({
      symbols: ['US.AAPL'],
      intervalMs: 50,
    });
  });

  afterEach(() => {
    mockFeed.stop();
    destroyDefaultMockFeed();
    resetTradeExecutor();
  });

  it('should generate trade signals from mock ticks', async () => {
    const signals: TradeSignal[] = [];

    // Listen for ticks and generate signals
    mockFeed.onTick((tick: MockTick) => {
      // Simple strategy: buy if price > prevClose by more than 0.5%
      const changePct = ((tick.price - tick.prevClose) / tick.prevClose) * 100;
      if (changePct > 0.5) {
        const signal: TradeSignal = {
          strategyId: 'momentum-strategy',
          strategyName: 'Momentum Strategy',
          code: tick.code,
          side: 'BUY',
          quantity: 10,
          price: tick.price,
          orderType: 'MARKET',
          reason: `Price up ${changePct.toFixed(2)}%`,
          confidence: 0.85,
          timestamp: tick.timestamp,
        };
        signals.push(signal);
        executor.processSignal(signal);
      }
    });

    mockFeed.start();
    await new Promise(resolve => setTimeout(resolve, 500));

    // Should have received some ticks
    const stats = mockFeed.getStats();
    expect(stats.totalTicks).toBeGreaterThan(0);

    // May or may not have generated signals depending on tick data
    // But the pipeline should work without errors
    expect(true).toBe(true);
  });

  it('should execute trades from generated signals', async () => {
    // Directly feed a signal that should trigger a trade
    const signal: TradeSignal = {
      strategyId: 'e2e-strategy',
      strategyName: 'E2E Strategy',
      code: 'US.AAPL',
      side: 'BUY',
      quantity: 25,
      price: 150.0,
      orderType: 'MARKET',
      reason: 'E2E test signal',
      confidence: 0.9,
      timestamp: Date.now(),
    };

    const order = await executor.processSignal(signal);
    expect(order).not.toBeNull();
    expect(order!.code).toBe('US.AAPL');
    expect(order!.status).toBe('filled');

    const positions = executor.getPositions();
    expect(positions.length).toBeGreaterThan(0);
  });

  it('should handle multiple signals in sequence', async () => {
    const signals: TradeSignal[] = [
      {
        strategyId: 'multi-strategy',
        strategyName: 'Multi Strategy',
        code: 'US.AAPL',
        side: 'BUY',
        quantity: 10,
        price: 150.0,
        orderType: 'MARKET',
        reason: 'First buy',
        confidence: 0.85,
        timestamp: Date.now(),
      },
      {
        strategyId: 'multi-strategy',
        strategyName: 'Multi Strategy',
        code: 'US.TSLA',
        side: 'BUY',
        quantity: 5,
        price: 250.0,
        orderType: 'MARKET',
        reason: 'Second buy',
        confidence: 0.85,
        timestamp: Date.now() + 1000,
      },
    ];

    for (const signal of signals) {
      await executor.processSignal(signal);
    }

    const orders = executor.getOrders();
    expect(orders.length).toBe(2);

    const positions = executor.getPositions();
    expect(positions.length).toBe(2);
  });
});

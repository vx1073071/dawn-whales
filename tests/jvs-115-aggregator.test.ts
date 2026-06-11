// JVS-115: Real-time Aggregator Tests

import { describe, it, expect, beforeEach } from 'vitest';
import { RealtimeAggregator } from '../electron/engine/data/realtime-aggregator';

describe('JVS-115: Real-time Aggregator', () => {
  let aggregator: RealtimeAggregator;

  beforeEach(() => {
    aggregator = new RealtimeAggregator();
  });

  it('should initialize aggregator', () => {
    expect(aggregator).toBeDefined();
    expect(aggregator.getStats().totalSymbols).toBe(0);
  });

  it('should aggregate quote data', () => {
    const mockQuote = {
      symbol: '600519',
      price: 1800.50,
      changePct: 2.5,
      volume: 1000000,
      turnover: 1800000000,
    };

    aggregator.handleQuoteUpdate('test-client', mockQuote);

    const data = aggregator.getAggregatedData('600519');
    expect(data).toBeDefined();
    expect(data?.symbol).toBe('600519');
    expect(data?.quote?.price).toBe(1800.50);
    expect(data?.quote?.changePct).toBe(2.5);
  });

  it('should aggregate signal data', () => {
    const mockSignal = {
      symbol: '600519',
      strategy: 'MACD',
      signal: 'BUY',
      strength: 85,
    };

    aggregator.handleSignalUpdate('test-client', mockSignal);

    const data = aggregator.getAggregatedData('600519');
    expect(data).toBeDefined();
    expect(data?.signals).toBeDefined();
    expect(data?.signals?.length).toBe(1);
    expect(data?.signals?.[0].signal).toBe('BUY');
  });

  it('should manage client subscriptions', () => {
    aggregator.subscribeClient('client-1', ['600519', '000001']);
    expect(aggregator.getStats().subscribedClients).toBe(1);

    aggregator.unsubscribeClient('client-1', ['600519']);
    expect(aggregator.getStats().subscribedClients).toBe(1);

    aggregator.unsubscribeClient('client-1');
    expect(aggregator.getStats().subscribedClients).toBe(0);
  });

  it('should keep only last 10 signals', () => {
    for (let i = 0; i < 15; i++) {
      aggregator.handleSignalUpdate('test-client', {
        symbol: '600519',
        signal: 'BUY',
        strength: i,
      });
    }

    const data = aggregator.getAggregatedData('600519');
    expect(data?.signals?.length).toBe(10);
  });

  it('should emit update events', (done) => {
    aggregator.on('update', (symbol, data) => {
      expect(symbol).toBe('600519');
      expect(data).toBeDefined();
      done();
    });

    aggregator.handleQuoteUpdate('test-client', {
      symbol: '600519',
      price: 1800.50,
    });
  });

  it('should clear all data', () => {
    aggregator.handleQuoteUpdate('test-client', {
      symbol: '600519',
      price: 1800.50,
    });

    aggregator.clearAll();
    expect(aggregator.getStats().totalSymbols).toBe(0);
    expect(aggregator.getStats().subscribedClients).toBe(0);
  });
});

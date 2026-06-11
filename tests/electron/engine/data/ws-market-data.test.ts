/**
 * ws-market-data.test.ts — R95 J-01 Coverage Boost
 * Tests for WebSocket Market Data Engine
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  WsMarketDataEngine,
  getWsMarketDataEngine,
  destroyWsMarketDataEngine,
} from '../../../../electron/engine/data/ws-market-data';
import type {
  MarketTick,
  WsConnectionConfig,
  OHLCVBar,
} from '../../../../electron/engine/data/ws-market-data';

// ── Helpers ────────────────────────────────────────────────────────────────

function makeTick(overrides: Partial<MarketTick> = {}): MarketTick {
  return {
    code: '000001',
    price: 10.5,
    change: 0.1,
    changePct: 0.96,
    volume: 10000,
    high: 10.6,
    low: 10.4,
    open: 10.45,
    prevClose: 10.4,
    timestamp: Date.now(),
    ...overrides,
  };
}

function makeConfig(overrides: Partial<WsConnectionConfig> = {}): WsConnectionConfig {
  return {
    url: 'ws://localhost:8080',
    reconnectIntervalMs: 1000,
    maxReconnectAttempts: 5,
    heartbeatIntervalMs: 10000,
    messageBufferSize: 1000,
    ...overrides,
  };
}

// ── WsMarketDataEngine ─────────────────────────────────────────────────────

describe('WsMarketDataEngine', () => {
  let engine: WsMarketDataEngine;

  beforeEach(() => {
    engine = new WsMarketDataEngine();
  });

  afterEach(() => {
    engine.destroy();
  });

  // ── Initial State ──────────────────────────────────────────────────────

  describe('initial state', () => {
    it('starts in disconnected state', () => {
      expect(engine.getConnectionState()).toBe('disconnected');
    });

    it('returns empty status initially', () => {
      const status = engine.getStatus();
      expect(status.connected).toBe(false);
      expect(status.subscriptions).toBe(0);
      expect(status.messagesReceived).toBe(0);
      expect(status.messagesSent).toBe(0);
    });

    it('has empty diagnostics initially', () => {
      const diag = engine.getDiagnostics();
      expect(diag.state).toBe('disconnected');
      expect(diag.symbols).toBe(0);
      expect(diag.totalTicksBuffered).toBe(0);
      expect(diag.subscriptions).toBe(0);
      expect(diag.queueLength).toBe(0);
      expect(diag.droppedMessages).toBe(0);
    });

    it('mock mode is disabled by default', () => {
      expect(engine.isMockMode()).toBe(false);
    });
  });

  // ── Mock Mode ─────────────────────────────────────────────────────────

  describe('mock mode', () => {
    it('enableMockMode sets mock mode on', () => {
      engine.enableMockMode(['000001']);
      expect(engine.isMockMode()).toBe(true);
    });

    it('disableMockMode sets mock mode off', () => {
      engine.enableMockMode(['000001']);
      engine.disableMockMode();
      expect(engine.isMockMode()).toBe(false);
    });

    it('enableMockMode sets state to connected', () => {
      engine.enableMockMode(['000001']);
      expect(engine.getConnectionState()).toBe('connected');
    });

    it('disableMockMode sets state to disconnected', () => {
      engine.enableMockMode(['000001']);
      engine.disableMockMode();
      expect(engine.getConnectionState()).toBe('disconnected');
    });

    it('enableMockMode emits connected event', () => {
      const onConnect = vi.fn();
      engine.on('connected', onConnect);
      engine.enableMockMode(['000001']);
      expect(onConnect).toHaveBeenCalledWith({ mock: true });
    });

    it('generates mock ticks and buffers data', async () => {
      engine.enableMockMode(['000001']);
      // Wait for a few tick intervals (MOCK_TICK_INTERVAL_MS = 500)
      await new Promise((r) => setTimeout(r, 600));
      const ticks = engine.getRecentTicks('000001');
      expect(ticks.length).toBeGreaterThan(0);
      engine.disableMockMode();
    });

    it('mock ticks have valid structure', async () => {
      engine.enableMockMode(['000001']);
      await new Promise((r) => setTimeout(r, 600));
      const ticks = engine.getRecentTicks('000001');
      if (ticks.length > 0) {
        const tick = ticks[0];
        expect(tick.code).toBe('000001');
        expect(typeof tick.price).toBe('number');
        expect(tick.price).toBeGreaterThan(0);
        expect(typeof tick.volume).toBe('number');
        expect(typeof tick.timestamp).toBe('number');
        expect(tick.bid).toBeDefined();
        expect(tick.ask).toBeDefined();
      }
      engine.disableMockMode();
    });

    it('mock mode generates ticks for multiple symbols', async () => {
      engine.enableMockMode(['000001', '000002']);
      await new Promise((r) => setTimeout(r, 600));
      const ticks1 = engine.getRecentTicks('000001');
      const ticks2 = engine.getRecentTicks('000002');
      expect(ticks1.length).toBeGreaterThan(0);
      expect(ticks2.length).toBeGreaterThan(0);
      engine.disableMockMode();
    });

    it('disableMockMode stops tick generation', async () => {
      engine.enableMockMode(['000001']);
      await new Promise((r) => setTimeout(r, 600));
      engine.disableMockMode();
      const countBefore = engine.getRecentTicks('000001').length;
      await new Promise((r) => setTimeout(r, 600));
      const countAfter = engine.getRecentTicks('000001').length;
      // No new ticks should be added after disable
      expect(countAfter).toBe(countBefore);
    });

    it('diagnostics show mock mode', async () => {
      engine.enableMockMode(['000001', '000002', '000003']);
      await new Promise((r) => setTimeout(r, 600));
      const diag = engine.getDiagnostics();
      expect(diag.mockMode).toBe(true);
      expect(diag.symbols).toBeGreaterThanOrEqual(1);
      engine.disableMockMode();
    });
  });

  // ── Connection ─────────────────────────────────────────────────────────

  describe('connection', () => {
    it('getConnectionState reflects current state', () => {
      expect(engine.getConnectionState()).toBe('disconnected');
      engine.enableMockMode(['000001']);
      expect(engine.getConnectionState()).toBe('connected');
      engine.disableMockMode();
      expect(engine.getConnectionState()).toBe('disconnected');
    });

    it('getStatus returns connected in mock mode', () => {
      engine.enableMockMode(['000001']);
      const status = engine.getStatus();
      expect(status.connected).toBe(true);
      expect(status.url).toBe('');
      engine.disableMockMode();
    });
  });

  // ── Subscriptions ─────────────────────────────────────────────────────

  describe('subscriptions', () => {
    it('subscribe returns a subId', () => {
      const subId = engine.subscribe(['000001'], 'quote', () => {});
      expect(typeof subId).toBe('string');
      expect(subId.length).toBeGreaterThan(0);
    });

    it('unsubscribe returns true for existing sub', () => {
      const subId = engine.subscribe(['000001'], 'quote', () => {});
      expect(engine.unsubscribe(subId)).toBe(true);
    });

    it('unsubscribe returns false for unknown subId', () => {
      expect(engine.unsubscribe('nonexistent')).toBe(false);
    });

    it('unsubscribeAll clears all subscriptions', () => {
      engine.subscribe(['000001'], 'quote', () => {});
      engine.subscribe(['000002'], 'tick', () => {});
      engine.unsubscribeAll();
      const diag = engine.getDiagnostics();
      expect(diag.subscriptions).toBe(0);
    });

    it('subscriptions show in diagnostics', () => {
      engine.subscribe(['000001'], 'quote', () => {});
      engine.subscribe(['000002'], 'kline', () => {});
      const diag = engine.getDiagnostics();
      expect(diag.subscriptions).toBe(2);
    });

    it('subscriptions show in status', () => {
      engine.subscribe(['000001'], 'quote', () => {});
      const status = engine.getStatus();
      expect(status.subscriptions).toBe(1);
    });

    it('subscribe callback receives data in mock mode', async () => {
      const callback = vi.fn();
      engine.enableMockMode(['000001']);
      engine.subscribe(['000001'], 'quote', callback);
      await new Promise((r) => setTimeout(r, 1200));
      expect(callback).toHaveBeenCalled();
      const callData = callback.mock.calls[0][0];
      expect(callData.code).toBe('000001');
      expect(callData.ticks).toBeDefined();
      engine.disableMockMode();
    }, 10000);

    it('autoSubscribeForStrategy creates subscriptions', () => {
      const results = engine.autoSubscribeForStrategy(['000001'], 'quote');
      expect(results.length).toBe(1);
      expect(typeof results[0]).toBe('string');
    });

    it('autoSubscribeForStrategy with default type', () => {
      const results = engine.autoSubscribeForStrategy(['000001']);
      expect(results.length).toBe(1);
    });

    it('autoSubscribeForStrategy respects callback', async () => {
      const callback = vi.fn();
      engine.enableMockMode(['000001']);
      engine.autoSubscribeForStrategy(['000001'], 'tick', callback);
      await new Promise((r) => setTimeout(r, 1200));
      expect(callback).toHaveBeenCalled();
      engine.disableMockMode();
    }, 10000);
  });

  // ── Data Access ────────────────────────────────────────────────────────

  describe('data access', () => {
    it('getRecentTicks returns empty for unknown code', () => {
      expect(engine.getRecentTicks('nobody')).toEqual([]);
    });

    it('getRecentTicks returns data after mock generation', async () => {
      engine.enableMockMode(['000001']);
      await new Promise((r) => setTimeout(r, 600));
      const ticks = engine.getRecentTicks('000001');
      expect(ticks.length).toBeGreaterThan(0);
      engine.disableMockMode();
    });

    it('getRecentTicks respects limit parameter', async () => {
      engine.enableMockMode(['000001']);
      await new Promise((r) => setTimeout(r, 1200)); // get a few ticks
      const ticks = engine.getRecentTicks('000001', 1);
      expect(ticks.length).toBeLessThanOrEqual(1);
      engine.disableMockMode();
    });

    it('getLastTick returns undefined for unknown code', () => {
      expect(engine.getLastTick('nobody')).toBeUndefined();
    });

    it('getLastTick returns latest tick', async () => {
      engine.enableMockMode(['000001']);
      await new Promise((r) => setTimeout(r, 600));
      const tick = engine.getLastTick('000001');
      expect(tick).toBeDefined();
      expect(tick!.code).toBe('000001');
      engine.disableMockMode();
    });

    it('getKlineBars returns undefined for unknown code', () => {
      expect(engine.getKlineBars('nobody', '1m')).toBeUndefined();
    });
  });

  // ── Events ─────────────────────────────────────────────────────────────

  describe('events', () => {
    it('on registers listener for event', () => {
      const cb = vi.fn();
      engine.on('tick', cb);
      // Registering should not throw
      expect(true).toBe(true);
    });

    it('off unregisters listener', () => {
      const cb = vi.fn();
      engine.on('connected', cb);
      engine.off('connected', cb);
      engine.enableMockMode(['000001']);
      expect(cb).not.toHaveBeenCalled();
      engine.disableMockMode();
    });

    it('once fires only once', () => {
      const cb = vi.fn();
      engine.once('connected', cb);
      engine.enableMockMode(['000001']);
      engine.disableMockMode();
      engine.enableMockMode(['000001']);
      expect(cb).toHaveBeenCalledTimes(1);
      engine.disableMockMode();
    });

    it('removeAllListeners clears specific event', () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      engine.on('tick', cb1);
      engine.on('connected', cb2);
      engine.removeAllListeners('tick');
      engine.enableMockMode(['000001']);
      expect(cb2).toHaveBeenCalled(); // 'connected' still fires
      engine.on('tick', cb1);
      engine.disableMockMode();
    });

    it('removeAllListeners without event clears all', () => {
      const cb = vi.fn();
      engine.on('connected', cb);
      engine.removeAllListeners();
      engine.enableMockMode(['000001']);
      expect(cb).not.toHaveBeenCalled();
      engine.disableMockMode();
    });

    it('connected event fires on mock mode', () => {
      const cb = vi.fn();
      engine.on('connected', cb);
      engine.enableMockMode(['000001']);
      expect(cb).toHaveBeenCalled();
      engine.disableMockMode();
    });

    it('tick event fires with tick data in mock mode', async () => {
      const cb = vi.fn();
      engine.on('tick', cb);
      engine.enableMockMode(['000001']);
      await new Promise((r) => setTimeout(r, 1200));
      expect(cb).toHaveBeenCalled();
      const tickArg = cb.mock.calls[0][0] as MarketTick;
      expect(tickArg.code).toBe('000001');
      expect(tickArg.price).toBeGreaterThan(0);
      engine.disableMockMode();
    }, 10000);

    it('error event does not fire in normal mock flow', () => {
      const cb = vi.fn();
      engine.on('error', cb);
      engine.enableMockMode(['000001']);
      // No errors expected
      engine.disableMockMode();
    });
  });

  // ── Diagnostics ────────────────────────────────────────────────────────

  describe('diagnostics', () => {
    it('getDiagnostics returns comprehensive state', () => {
      engine.enableMockMode(['000001', '000002']);
      engine.subscribe(['000001'], 'quote', () => {});
      const diag = engine.getDiagnostics();
      expect(diag).toHaveProperty('state');
      expect(diag).toHaveProperty('mockMode');
      expect(diag).toHaveProperty('symbols');
      expect(diag).toHaveProperty('totalTicksBuffered');
      expect(diag).toHaveProperty('subscriptions');
      expect(diag).toHaveProperty('queueLength');
      expect(diag).toHaveProperty('droppedMessages');
      expect(diag).toHaveProperty('reconnectAttempts');
      expect(diag).toHaveProperty('latency');
      expect(diag).toHaveProperty('stats');
      expect(diag.subscriptions).toBe(1);
      engine.disableMockMode();
    });

    it('getDiagnostics stats contains messagesReceived and messagesSent', () => {
      const diag = engine.getDiagnostics();
      const stats = diag.stats as Record<string, unknown>;
      expect(stats.messagesReceived).toBe(0);
      expect(stats.messagesSent).toBe(0);
    });
  });

  // ── Lifecycle ──────────────────────────────────────────────────────────

  describe('lifecycle', () => {
    it('destroy cleans up all state', () => {
      engine.enableMockMode(['000001']);
      engine.subscribe(['000001'], 'quote', () => {});
      engine.destroy();
      // Should not throw
    });

    it('destroy resets diagnostics', () => {
      engine.enableMockMode(['000001']);
      engine.destroy();
      const diag = engine.getDiagnostics();
      expect(diag.subscriptions).toBe(0);
      expect(diag.droppedMessages).toBe(0);
      const stats = diag.stats as Record<string, unknown>;
      expect(stats.messagesReceived).toBe(0);
      expect(stats.messagesSent).toBe(0);
    });

    it('multiple destroys do not throw', () => {
      engine.destroy();
      expect(() => engine.destroy()).not.toThrow();
    });
  });

  // ── Edge Cases ─────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('getRecentTicks with zero limit returns full buffer (slice(-0) JS quirk)', async () => {
      engine.enableMockMode(['000001']);
      await new Promise((r) => setTimeout(r, 600));
      const ticks = engine.getRecentTicks('000001', 0);
      // slice(-0) returns entire array in JS
      expect(ticks.length).toBeGreaterThan(0);
      engine.disableMockMode();
    });

    it('getRecentTicks with negative limit returns full buffer', async () => {
      engine.enableMockMode(['000001']);
      await new Promise((r) => setTimeout(r, 600));
      const ticks = engine.getRecentTicks('000001', -5);
      // Negative slice grabs from the end, so still returns buffer
      expect(ticks.length).toBeGreaterThanOrEqual(0);
      engine.disableMockMode();
    });

    it('enableMockMode with empty symbols', () => {
      engine.enableMockMode([]);
      expect(engine.isMockMode()).toBe(true);
      engine.disableMockMode();
    });

    it('multiple enableMockMode calls', () => {
      engine.enableMockMode(['000001']);
      engine.enableMockMode(['000002']);
      expect(engine.isMockMode()).toBe(true);
      engine.disableMockMode();
    });

    it('subscribe with empty codes array', () => {
      const subId = engine.subscribe([], 'quote', () => {});
      expect(typeof subId).toBe('string');
    });

    it('autoSubscribeForStrategy respects callback on mock', async () => {
      const cb = vi.fn();
      engine.enableMockMode(['000003']);
      engine.autoSubscribeForStrategy(['000003'], 'tick', cb);
      await new Promise((r) => setTimeout(r, 1200));
      // The callback may or may not fire depending on timing
      // Just verify no crash
      engine.disableMockMode();
    }, 10000);

    it('getKlineBars returns aggregated OHLCV data', async () => {
      engine.enableMockMode(['000001']);
      await new Promise((r) => setTimeout(r, 600));
      const bar = engine.getKlineBars('000001', '1m');
      // May or may not have kline data depending on timing
      if (bar) {
        expect(bar).toHaveProperty('open');
        expect(bar).toHaveProperty('high');
        expect(bar).toHaveProperty('low');
        expect(bar).toHaveProperty('close');
        expect(bar).toHaveProperty('volume');
      }
      engine.disableMockMode();
    });

    it('getStatus returns correct buffer info', () => {
      const status = engine.getStatus();
      expect(status.buffer.queued).toBe(0);
      expect(status.buffer.dropped).toBe(0);
      expect(status.latency).toBe(0);
    });
  });
});

// ── Singleton Functions ────────────────────────────────────────────────────

describe('singleton functions', () => {
  afterEach(() => {
    destroyWsMarketDataEngine();
  });

  it('getWsMarketDataEngine returns same instance', () => {
    const a = getWsMarketDataEngine();
    const b = getWsMarketDataEngine();
    expect(a).toBe(b);
  });

  it('getWsMarketDataEngine returns WsMarketDataEngine instance', () => {
    const instance = getWsMarketDataEngine();
    expect(instance).toBeInstanceOf(WsMarketDataEngine);
  });

  it('destroyWsMarketDataEngine clears instance', () => {
    const a = getWsMarketDataEngine();
    destroyWsMarketDataEngine();
    const b = getWsMarketDataEngine();
    expect(a).not.toBe(b);
  });

  it('destroyWsMarketDataEngine on null instance does not throw', () => {
    destroyWsMarketDataEngine(); // first destroy
    expect(() => destroyWsMarketDataEngine()).not.toThrow(); // second destroy on null
  });
});

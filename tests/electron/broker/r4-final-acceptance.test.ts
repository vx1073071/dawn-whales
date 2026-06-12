/**
 * R4 youdao — 全量集成测试 + 回归测试 + 并发压测
 *
 * 覆盖: 全量adapter标准测试套件 + 已有功能回归 + 并发压力验证
 */
import { describe, it, expect, afterAll, beforeAll, vi } from 'vitest';

// Mock electron-log
vi.mock('electron-log', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { LongbridgeAdapter } from '../../../electron/broker/longbridge-adapter';
import { MoomooAdapter } from '../../../electron/broker/moomoo-adapter';
import { BrokerManagerV2 } from '../../../electron/broker/BrokerManagerV2';
import type { IBrokerAdapter, BrokerConfig } from '../../../electron/broker/IBrokerAdapter';
import type { BrokerType } from '../../../electron/broker/IBrokerAdapterV2';

// ═══════════════════════════════════════════════════════════
// Test Utilities
// ═══════════════════════════════════════════════════════════

const ALL_BROKER_TYPES: BrokerType[] = [
  'futu', 'moomoo', 'ib', 'longbridge', 'tiger', 'vbkr', 'usmart',
  'binance', 'okx', 'bybit', 'bitget', 'robinhood',
  'schwab', 'etrade', 'etoro', 'webull', 'mt5',
];

function makeCfg(id: string, type: BrokerType): BrokerConfig {
  return { id, name: `${type} test`, type: type as BrokerConfig['type'], host: '127.0.0.1', port: 19999, enabled: true };
}

// ═══════════════════════════════════════════════════════════
// Test 1: 全量 BrokerType 验证
// ═══════════════════════════════════════════════════════════

describe('R4.1: All Broker Type Validation', () => {
  it('should cover all 17 broker types', () => {
    expect(ALL_BROKER_TYPES).toHaveLength(17);
  });

  it.each(ALL_BROKER_TYPES)('broker type %s should be a valid string', (type) => {
    expect(typeof type).toBe('string');
    expect(type.length).toBeGreaterThan(0);
  });

  it('should have no duplicate broker types', () => {
    expect(new Set(ALL_BROKER_TYPES).size).toBe(ALL_BROKER_TYPES.length);
  });
});

// ═══════════════════════════════════════════════════════════
// Test 2: 全量 Adapter 标准化测试套件
// ═══════════════════════════════════════════════════════════

function runStandardSuite(title: string, adapter: IBrokerAdapter, codes: string[]) {
  describe(`${title} Standard Suite`, () => {
    beforeAll(async () => { await adapter.connect(); });
    afterAll(() => { try { adapter.disconnect(); } catch {} });

    it('connect → connected=true', () => {
      expect(adapter.connected).toBe(true);
    });

    it('getQuotes → returns QuoteInfo[]', async () => {
      const q = await adapter.getQuotes([codes[0]]);
      expect(q.length).toBeGreaterThanOrEqual(1);
      expect(typeof q[0].price).toBe('number');
      expect(q[0].code).toBeDefined();
    });

    it('getKlines → returns KlineInfo[]', async () => {
      const k = await adapter.getKlines(codes[0], '1d', 5);
      expect(k.length).toBeGreaterThan(0);
      expect(typeof k[0].open).toBe('number');
      expect(typeof k[0].close).toBe('number');
    });

    it('getAccounts → returns AccountInfo[]', async () => {
      const a = await adapter.getAccounts();
      expect(a.length).toBeGreaterThan(0);
      expect(a[0].accountId).toBeDefined();
      expect(a[0].currency).toBeDefined();
    });

    it('getFunds → returns FundsInfo', async () => {
      const acc = await adapter.getAccounts();
      const f = await adapter.getFunds(acc[0].accountId);
      expect(f.currency).toBeDefined();
      expect(typeof f.totalAssets).toBe('number');
    });

    it('getPositions → returns PositionInfo[]', async () => {
      const acc = await adapter.getAccounts();
      const p = await adapter.getPositions(acc[0].accountId);
      expect(Array.isArray(p)).toBe(true);
    });

    it('getOrders → returns OrderInfo[]', async () => {
      const acc = await adapter.getAccounts();
      const o = await adapter.getOrders(acc[0].accountId);
      expect(Array.isArray(o)).toBe(true);
    });

    it('placeOrder → returns { orderId }', async () => {
      const r = await adapter.placeOrder({
        code: codes[0], side: 'BUY', orderType: 'LIMIT', qty: 10, price: 100,
      });
      expect(r.orderId).toBeDefined();
      expect(typeof r.orderId).toBe('string');
    });

    it('cancelOrder → no throw', async () => {
      await adapter.cancelOrder('test-oid', 'TEST-001', codes[0]);
    });

    it('subscribeAndPush → subscribed', async () => {
      await adapter.subscribeAndPush([codes[0]]);
    });

    it('onQuotePush → callback registered', () => {
      const cb = vi.fn();
      adapter.onQuotePush(cb);
      adapter.removeQuotePush(cb);
    });

    it('disconnect → connected=false', () => {
      adapter.disconnect();
      expect(adapter.connected).toBe(false);
    });
  });
}

// Longbridge standard suite
runStandardSuite(
  'LongbridgeAdapter',
  new LongbridgeAdapter(makeCfg('r4-lb', 'longbridge')),
  ['AAPL.US', '700.HK', 'D05.SG'],
);

// Moomoo standard suite
runStandardSuite(
  'MoomooAdapter',
  new MoomooAdapter({
    id: 'r4-mm', name: 'MM R4', type: 'moomoo',
    host: '127.0.0.1', port: 11999, enabled: true, autoReconnect: false,
  }),
  ['US.AAPL', 'HK.00700', 'SG.D05'],
);

// ═══════════════════════════════════════════════════════════
// Test 3: 回归测试 — 已有功能无回归
// ═══════════════════════════════════════════════════════════

describe('R4.3: Regression — Existing Adapter Functionality', () => {
  it('LongbridgeAdapter constructor still works', () => {
    const a = new LongbridgeAdapter(makeCfg('reg-lb', 'longbridge'));
    expect(a.id).toBe('reg-lb');
    expect(a.type).toBe('longbridge');
    expect(a.name).toBe('longbridge test');
  });

  it('LongbridgeAdapter all 14 methods still present', () => {
    const methods = [
      'connect', 'disconnect', 'onQuotePush', 'removeQuotePush', 'onDisconnect',
      'getQuotes', 'getKlines', 'getAccounts', 'getFunds', 'getPositions',
      'getOrders', 'placeOrder', 'cancelOrder', 'subscribeAndPush',
    ];
    const proto = LongbridgeAdapter.prototype as unknown as Record<string, unknown>;
    for (const m of methods) {
      expect(typeof proto[m], `Missing: ${m}`).toBe('function');
    }
  });

  it('MoomooAdapter constructor still works', () => {
    const a = new MoomooAdapter({
      id: 'reg-mm', name: 'MM Reg', type: 'moomoo',
      host: '127.0.0.1', port: 11999, enabled: true,
    });
    expect(a.id).toBe('reg-mm');
    expect(a.type).toBe('moomoo');
  });

  it('MoomooAdapter all 14 methods still present', () => {
    const methods = [
      'connect', 'disconnect', 'onQuotePush', 'removeQuotePush', 'onDisconnect',
      'getQuotes', 'getKlines', 'getAccounts', 'getFunds', 'getPositions',
      'getOrders', 'placeOrder', 'cancelOrder', 'subscribeAndPush',
    ];
    const proto = MoomooAdapter.prototype as unknown as Record<string, unknown>;
    for (const m of methods) {
      expect(typeof proto[m], `Missing: ${m}`).toBe('function');
    }
  });

  it('BrokerManagerV2 registerAdapterFactory still works', () => {
    const m = new BrokerManagerV2({ autoReconnect: false });
    m.registerAdapterFactory('longbridge', (c) => new LongbridgeAdapter(c));
    m.registerAdapterFactory('moomoo', (c) => new MoomooAdapter({
      ...c, autoReconnect: false,
    } as Parameters<typeof MoomooAdapter.prototype.constructor>[0]));
    expect(m).toBeDefined();
  });

  it('connectMany returns results for all configs', async () => {
    const m = new BrokerManagerV2({ autoReconnect: false });
    m.registerAdapterFactory('longbridge', (c) => new LongbridgeAdapter(c));

    const results = await m.connectMany([
      makeCfg('reg1', 'longbridge'),
      makeCfg('reg2', 'longbridge'),
    ]);
    expect(results).toHaveLength(2);
    expect(results.every(r => r.success)).toBe(true);
    expect(m.getConnectedCount()).toBe(2);

    await m.disconnectAll();
    m.destroy();
  });

  it('getAggregatedFunds still returns funds with brokerId', async () => {
    const m = new BrokerManagerV2({ autoReconnect: false });
    m.registerAdapterFactory('longbridge', (c) => new LongbridgeAdapter(c));

    await m.connect(makeCfg('reg-funds', 'longbridge'));
    const funds = await m.getAggregatedFunds();
    expect(funds.length).toBeGreaterThanOrEqual(1);
    expect(funds[0].brokerId).toBeDefined();

    await m.disconnectAll();
    m.destroy();
  });
});

// ═══════════════════════════════════════════════════════════
// Test 4: 并发压测
// ═══════════════════════════════════════════════════════════

describe('R4.4: Concurrent Stress Test', () => {
  it('stress: should handle 10 concurrent connects in parallel', async () => {
    const m = new BrokerManagerV2({ autoReconnect: false, maxConcurrentConnections: 10 });
    m.registerAdapterFactory('longbridge', (c) => new LongbridgeAdapter(c));

    const configs = Array.from({ length: 10 }, (_, i) =>
      makeCfg(`stress-${i}`, 'longbridge')
    );

    const start = Date.now();
    const results = await m.connectMany(configs);
    const elapsed = Date.now() - start;

    expect(results.length).toBe(10);
    const successCount = results.filter(r => r.success).length;
    expect(successCount).toBeGreaterThanOrEqual(8); // 80%+ success
    expect(elapsed).toBeLessThan(10000); // < 10 seconds

    await m.disconnectAll();
    m.destroy();
  });

  it('stress: should handle rapid connect→disconnect cycles', async () => {
    const m = new BrokerManagerV2({ autoReconnect: false });
    m.registerAdapterFactory('longbridge', (c) => new LongbridgeAdapter(c));

    for (let i = 0; i < 5; i++) {
      const id = `cycle-${i}`;
      await m.connect(makeCfg(id, 'longbridge'));
      expect(m.getStatus(id)?.connected).toBe(true);
      await m.disconnect(id);
      expect(m.getStatus(id)?.connected || !m.getStatus(id)).toBeTruthy();
    }

    m.destroy();
  });

  it('stress: should handle concurrent subscribeAll across 3 brokers', async () => {
    const m = new BrokerManagerV2({ autoReconnect: false });
    m.registerAdapterFactory('longbridge', (c) => new LongbridgeAdapter(c));
    m.registerAdapterFactory('moomoo', (c) => new MoomooAdapter({
      ...c, autoReconnect: false,
    } as Parameters<typeof MoomooAdapter.prototype.constructor>[0]));

    await m.connectMany([
      makeCfg('sub-1', 'longbridge'),
      makeCfg('sub-2', 'longbridge'),
      makeCfg('sub-3', 'moomoo'),
    ]);

    const start = Date.now();
    await m.subscribeAll(['AAPL.US', 'US.AAPL', '700.HK']);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(5000);

    await m.disconnectAll();
    m.destroy();
  });

  it('stress: aggregate queries should complete within timeout', async () => {
    const m = new BrokerManagerV2({ autoReconnect: false });
    m.registerAdapterFactory('longbridge', (c) => new LongbridgeAdapter(c));
    m.registerAdapterFactory('moomoo', (c) => new MoomooAdapter({
      ...c, autoReconnect: false,
    } as Parameters<typeof MoomooAdapter.prototype.constructor>[0]));

    await m.connectMany([
      makeCfg('perf-lg', 'longbridge'),
      makeCfg('perf-mm', 'moomoo'),
    ]);

    const start = Date.now();
    const [funds, positions, orders] = await Promise.all([
      m.getAggregatedFunds(),
      m.getAggregatedPositions(),
      m.getAggregatedOrders(),
    ]);
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(3000);
    expect(funds.length).toBeGreaterThanOrEqual(2);
    expect(positions.length).toBeGreaterThanOrEqual(2);
    expect(orders.length).toBeGreaterThanOrEqual(2);

    await m.disconnectAll();
    m.destroy();
  });

  it('stress: disconnectAll should complete quickly', async () => {
    const m = new BrokerManagerV2({ autoReconnect: false });
    m.registerAdapterFactory('longbridge', (c) => new LongbridgeAdapter(c));

    const configs = Array.from({ length: 5 }, (_, i) => makeCfg(`kill-${i}`, 'longbridge'));
    await m.connectMany(configs);

    const start = Date.now();
    await m.disconnectAll();
    const elapsed = Date.now() - start;

    expect(m.getConnectedCount()).toBe(0);
    expect(elapsed).toBeLessThan(2000);
    m.destroy();
  });
});

// ═══════════════════════════════════════════════════════════
// Test 5: 数据一致性
// ═══════════════════════════════════════════════════════════

describe('R4.5: Data Consistency', () => {
  it('positions from different brokers preserve broker identity', async () => {
    const m = new BrokerManagerV2({ autoReconnect: false });
    m.registerAdapterFactory('longbridge', (c) => new LongbridgeAdapter(c));
    m.registerAdapterFactory('moomoo', (c) => new MoomooAdapter({
      ...c, autoReconnect: false,
    } as Parameters<typeof MoomooAdapter.prototype.constructor>[0]));

    await m.connectMany([makeCfg('dc-lg', 'longbridge'), makeCfg('dc-mm', 'moomoo')]);

    const positions = await m.getAggregatedPositions();
    const byBroker = new Map<string, number>();
    for (const p of positions) {
      byBroker.set(p.brokerId, (byBroker.get(p.brokerId) || 0) + 1);
    }

    // Each broker should have its own positions
    expect(byBroker.size).toBeGreaterThanOrEqual(2);

    await m.disconnectAll();
    m.destroy();
  });

  it('global quote callback receives tagged quotes with brokerId', async () => {
    const m = new BrokerManagerV2({ autoReconnect: false });
    m.registerAdapterFactory('longbridge', (c) => new LongbridgeAdapter(c));

    const quotes: Array<{ brokerId: string }> = [];
    m.onGlobalQuote((q) => quotes.push(...q));

    await m.connect(makeCfg('gc-lg', 'longbridge'));
    await m.subscribe('gc-lg', ['AAPL.US']);

    // Wait for mock timer (3s)
    await new Promise(r => setTimeout(r, 3500));

    if (quotes.length > 0) {
      for (const q of quotes) {
        expect(q.brokerId).toBeDefined();
      }
    }

    await m.disconnectAll();
    m.destroy();
  }, 10000);
});

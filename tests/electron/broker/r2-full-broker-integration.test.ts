/**
 * R2 TST-01 — 全券商集成测试骨架
 *
 * 标准化流程: connect → getQuote → getKline → getAccount → getPositions → placeOrder → cancelOrder → subscribeAndPush
 * 覆盖 Longbridge + Moomoo (R2 scope)
 */
import { describe, it, expect, afterAll, beforeAll, vi } from 'vitest';

// Mock electron-log to work in jsdom
vi.mock('electron-log', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
import type { IBrokerAdapter, BrokerConfig, QuoteInfo, KlineInfo, AccountInfo, FundsInfo, PositionInfo, OrderInfo } from '../../../electron/broker/IBrokerAdapter';
import { LongbridgeAdapter } from '../../../electron/broker/longbridge-adapter';
import { MoomooAdapter } from '../../../electron/broker/moomoo-adapter';
import { BrokerManagerV2 } from '../../../electron/broker/BrokerManagerV2';
import type { BrokerType } from '../../../electron/broker/IBrokerAdapterV2';

// ═══════════════════════════════════════════════════════
// Test Utilities
// ═══════════════════════════════════════════════════════

function makeConfig(id: string, type: BrokerType, name: string): BrokerConfig {
  return {
    id,
    name,
    type: type as BrokerConfig['type'],
    host: '127.0.0.1',
    port: 19999,
    enabled: true,
  };
}

// ═══════════════════════════════════════════════════════
// Standard Test Flow
// ═══════════════════════════════════════════════════════

function testBrokerAdapter(
  title: string,
  createAdapter: () => IBrokerAdapter,
  sampleCodes: string[],
) {
  describe(title, () => {
    let adapter: IBrokerAdapter;

    beforeAll(() => {
      adapter = createAdapter();
    });

    afterAll(() => {
      try { adapter.disconnect(); } catch {}
    });

    // 1. Constructor
    it('should construct with id/type/name', () => {
      expect(adapter.id).toBeDefined();
      expect(adapter.type).toBeDefined();
      expect(adapter.name).toBeDefined();
    });

    // 2. Connect
    it('should connect successfully (mock mode)', async () => {
      await adapter.connect();
      expect(adapter.connected).toBe(true);
    });

    // 3. getQuotes
    it('should get quotes', async () => {
      const codes = sampleCodes.slice(0, 2);
      const quotes = await adapter.getQuotes(codes);
      expect(quotes.length).toBeGreaterThanOrEqual(codes.length);
      quotes.forEach(q => {
        expect(typeof q.price).toBe('number');
        expect(q.code).toBeDefined();
      });
    });

    // 4. getKlines
    it('should get klines', async () => {
      const klines = await adapter.getKlines(sampleCodes[0], '1d', 5);
      expect(klines.length).toBeGreaterThan(0);
      for (const k of klines) {
        expect(typeof k.open).toBe('number');
        expect(typeof k.close).toBe('number');
      }
    });

    // 5. getAccounts
    it('should get accounts', async () => {
      const accounts = await adapter.getAccounts();
      expect(accounts.length).toBeGreaterThan(0);
      expect(accounts[0].accountId).toBeDefined();
      expect(accounts[0].currency).toBeDefined();
    });

    // 6. getFunds
    it('should get funds for first account', async () => {
      const accounts = await adapter.getAccounts();
      const funds = await adapter.getFunds(accounts[0].accountId);
      expect(funds.currency).toBeDefined();
      expect(typeof funds.totalAssets).toBe('number');
    });

    // 7. getPositions
    it('should get positions', async () => {
      const accounts = await adapter.getAccounts();
      const positions = await adapter.getPositions(accounts[0].accountId);
      expect(Array.isArray(positions)).toBe(true);
    });

    // 8. getOrders
    it('should get orders', async () => {
      const accounts = await adapter.getAccounts();
      const orders = await adapter.getOrders(accounts[0].accountId);
      expect(Array.isArray(orders)).toBe(true);
    });

    // 9. placeOrder
    it('should place order and get orderId', async () => {
      const result = await adapter.placeOrder({
        code: sampleCodes[0],
        side: 'BUY',
        orderType: 'LIMIT',
        qty: 10,
        price: 100,
      });
      expect(result.orderId).toBeDefined();
      expect(typeof result.orderId).toBe('string');
    });

    // 10. cancelOrder
    it('should cancel order without error', async () => {
      await adapter.cancelOrder('test-oid', 'TEST-001', sampleCodes[0]);
      // No throw = pass
    });

    // 11. subscribeAndPush
    it('should subscribe without error', async () => {
      await adapter.subscribeAndPush([sampleCodes[0]]);
      // subscription registered without throw
      expect(true).toBe(true);
    });

    // 12. removeQuotePush
    it('should remove quote push callback', () => {
      const cb = () => {};
      adapter.onQuotePush(cb);
      adapter.removeQuotePush(cb);
      // No throw = pass
    });

    // 13. disconnect
    it('should disconnect', () => {
      adapter.disconnect();
      expect(adapter.connected).toBe(false);
    });
  });
}

// ═══════════════════════════════════════════════════════
// 1. LongbridgeAdapter Tests
// ═══════════════════════════════════════════════════════

testBrokerAdapter(
  'LongbridgeAdapter (mock-mode)',
  () => new LongbridgeAdapter(makeConfig('longbridge-test', 'longbridge', 'Longbridge Test')),
  ['AAPL.US', '700.HK', 'D05.SG'],
);

// ═══════════════════════════════════════════════════════
// 2. MoomooAdapter Tests
// ═══════════════════════════════════════════════════════

testBrokerAdapter(
  'MoomooAdapter (mock-mode)',
  () => new MoomooAdapter({
    id: 'moomoo-test',
    name: 'Moomoo Test',
    type: 'moomoo',
    host: '127.0.0.1',
    port: 11999,
    enabled: true,
    autoReconnect: false,
  }),
  ['US.AAPL', 'HK.00700', 'SG.D05'],
);

// ═══════════════════════════════════════════════════════
// 3. BrokerManagerV2 Registration
// ═══════════════════════════════════════════════════════

describe('BrokerManagerV2 Registration', () => {
  it('should register longbridge + moomoo factories', () => {
    const manager = new BrokerManagerV2({ autoReconnect: false });
    manager.registerAdapterFactory('longbridge', (c) => new LongbridgeAdapter(c));
    manager.registerAdapterFactory('moomoo', (c) => new MoomooAdapter({
      ...c,
      autoReconnect: false,
    } as Parameters<typeof MoomooAdapter.prototype.constructor>[0]));
    // Registration doesn't throw
    expect(manager).toBeDefined();
  });

  it('should connect longbridge via BrokerManagerV2', async () => {
    const manager = new BrokerManagerV2({ autoReconnect: false });
    manager.registerAdapterFactory('longbridge', (c) => new LongbridgeAdapter(c));

    await manager.connect(makeConfig('mgr-lg', 'longbridge', 'Longbridge via Mgr'));
    const status = manager.getStatus('mgr-lg');
    expect(status).toBeDefined();
    expect(status!.connected).toBe(true);

    const connected = manager.getConnectedBrokers();
    expect(connected).toContain('mgr-lg');

    await manager.disconnect('mgr-lg');
  });

  it('should connect moomoo via BrokerManagerV2', async () => {
    const manager = new BrokerManagerV2({ autoReconnect: false });
    manager.registerAdapterFactory('moomoo', (c) => new MoomooAdapter({
      ...c,
      autoReconnect: false,
    } as Parameters<typeof MoomooAdapter.prototype.constructor>[0]));

    await manager.connect(makeConfig('mgr-mm', 'moomoo', 'Moomoo via Mgr'));
    const status = manager.getStatus('mgr-mm');
    expect(status).toBeDefined();
    expect(status!.connected).toBe(true);

    await manager.disconnect('mgr-mm');
  });

  it('should get aggregated funds from 2 brokers', async () => {
    const manager = new BrokerManagerV2({ autoReconnect: false });
    manager.registerAdapterFactory('longbridge', (c) => new LongbridgeAdapter(c));
    manager.registerAdapterFactory('moomoo', (c) => new MoomooAdapter({
      ...c, autoReconnect: false,
    } as Parameters<typeof MoomooAdapter.prototype.constructor>[0]));

    await manager.connect(makeConfig('agg-lg', 'longbridge', 'LB Agg'));
    await manager.connect(makeConfig('agg-mm', 'moomoo', 'MM Agg'));

    const funds = await manager.getAggregatedFunds();
    expect(funds.length).toBeGreaterThanOrEqual(2);

    const positions = await manager.getAggregatedPositions();
    expect(positions.length).toBeGreaterThanOrEqual(2);

    const orders = await manager.getAggregatedOrders();
    expect(orders.length).toBeGreaterThanOrEqual(2);

    await manager.disconnectAll();
  });

  it('getConnectedCount returns correct count', async () => {
    const manager = new BrokerManagerV2({ autoReconnect: false });
    manager.registerAdapterFactory('longbridge', (c) => new LongbridgeAdapter(c));
    manager.registerAdapterFactory('moomoo', (c) => new MoomooAdapter({
      ...c, autoReconnect: false,
    } as Parameters<typeof MoomooAdapter.prototype.constructor>[0]));

    await manager.connect(makeConfig('cnt-lg', 'longbridge', 'LB'));
    expect(manager.getConnectedCount()).toBe(1);

    await manager.connect(makeConfig('cnt-mm', 'moomoo', 'MM'));
    expect(manager.getConnectedCount()).toBe(2);

    await manager.disconnectAll();
  });
});

// ═══════════════════════════════════════════════════════
// 4. Interface Compliance
// ═══════════════════════════════════════════════════════

describe('IBrokerAdapter Interface Compliance', () => {
  const REQUIRED_METHODS = [
    'connect', 'disconnect', 'onQuotePush', 'removeQuotePush', 'onDisconnect',
    'getQuotes', 'getKlines', 'getAccounts', 'getFunds', 'getPositions',
    'getOrders', 'placeOrder', 'cancelOrder', 'subscribeAndPush',
  ];

  it('LongbridgeAdapter implements all 14 methods', () => {
    const proto = LongbridgeAdapter.prototype as unknown as Record<string, unknown>;
    for (const method of REQUIRED_METHODS) {
      expect(typeof proto[method], `Longbridge missing: ${method}`).toBe('function');
    }
  });

  it('MoomooAdapter implements all 14 methods', () => {
    const proto = MoomooAdapter.prototype as unknown as Record<string, unknown>;
    for (const method of REQUIRED_METHODS) {
      expect(typeof proto[method], `Moomoo missing: ${method}`).toBe('function');
    }
  });
});

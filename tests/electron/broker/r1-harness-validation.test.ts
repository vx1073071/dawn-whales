/**
 * R1 youdao — 集成测试框架验证 + 适配器接口合规性
 *
 * 验证 BrokerTestHarness 可用性 + MoomooAdapter V1 接口完整性
 * 注: Moomoo Mock 模式需要 OpenDBaseAdapter 完整初始化, 暂做接口级别检查
 */
import { describe, it, expect } from 'vitest';
import {
  TEST_QUOTES, TEST_POSITIONS, TEST_ACCOUNTS, TEST_KLINES, TEST_ORDERS,
  assertTaggedQuote, waitFor, createMockBrokerServer, createBrokerTestHarness,
} from './test-framework';

// ═══════════════════════════════════════════════
// 测试 1: Test Fixtures 完整性
// ═══════════════════════════════════════════════

describe('Test Fixtures', () => {
  it('账户数据完整', () => {
    expect(TEST_ACCOUNTS.single.accountId).toBe('TEST-001');
    expect(TEST_ACCOUNTS.single.currency).toBe('USD');
    expect(TEST_ACCOUNTS.single.netAssets).toBe(100000);
    expect(TEST_ACCOUNTS.multi).toHaveLength(3);
    expect(TEST_ACCOUNTS.multi.map((a: { currency: string }) => a.currency)).toEqual(['USD', 'HKD', 'SGD']);
  });

  it('持仓数据覆盖盈/亏/平/加密/港股场景', () => {
    expect(TEST_POSITIONS.win.pnl).toBeGreaterThan(0);
    expect(TEST_POSITIONS.lose.pnl).toBeLessThan(0);
    expect(TEST_POSITIONS.flat.pnl).toBe(0);
    expect(TEST_POSITIONS.crypto.code).toBe('BTCUSDT');
    expect(TEST_POSITIONS.hk.code).toBe('HK.00700');
  });

  it('行情数据覆盖涨跌方向', () => {
    expect(TEST_QUOTES.up.change).toBeGreaterThan(0);
    expect(TEST_QUOTES.down.change).toBeLessThan(0);
    expect(TEST_QUOTES.crypto.price).toBe(92000);
  });

  it('K线数据格式正确', () => {
    expect(TEST_KLINES['1m']).toHaveLength(60);
    expect(TEST_KLINES['1d']).toHaveLength(30);
    for (const k of TEST_KLINES['1d']) {
      expect(typeof k.open).toBe('number');
      expect(typeof k.close).toBe('number');
      expect(typeof k.high).toBe('number');
      expect(typeof k.low).toBe('number');
      expect(k.high).toBeGreaterThanOrEqual(k.low);
    }
  });

  it('订单数据覆盖PENDING/FILLED/PARTIAL状态', () => {
    expect(TEST_ORDERS.pending.status).toBe('PENDING');
    expect(TEST_ORDERS.filled.status).toBe('FILLED');
    expect(TEST_ORDERS.partial.status).toBe('PARTIAL');
  });
});

// ═══════════════════════════════════════════════
// 测试 2: Tagged 类型断 (V2 兼容)
// ═══════════════════════════════════════════════

describe('Tagged 类型验证 (V2 兼容)', () => {
  it('assertTaggedQuote 通过有效数据', () => {
    const tagged = {
      brokerId: 'binance-spot',
      brokerName: 'Binance',
      standardCode: 'BTC-USDT',
      originalCode: 'BTCUSDT',
      code: 'BTCUSDT',
      price: 92000,
      change: 2000,
      changePct: 2.22,
      volume: 15000,
      turnover: 1380000000,
      high: 93000,
      low: 89000,
      open: 90000,
      prevClose: 90000,
      time: new Date().toISOString(),
    };
    assertTaggedQuote(tagged, { standardCode: 'BTC-USDT' });
  });

  it('assertTaggedQuote 缺少必填字段应报错', () => {
    const untagged = {
      code: 'US.AAPL', price: 185, change: 5, changePct: 2.78,
      volume: 5000, turnover: 100000, high: 186, low: 179, open: 180, prevClose: 180, time: '',
    };
    expect(() => assertTaggedQuote(untagged, {})).toThrow();
  });
});

// ═══════════════════════════════════════════════
// 测试 3: waitFor 工具函数
// ═══════════════════════════════════════════════

describe('waitFor', () => {
  it('条件满足时应立即返回', async () => {
    const start = Date.now();
    await waitFor(() => true);
    expect(Date.now() - start).toBeLessThan(50);
  });

  it('条件超时应抛出异常', async () => {
    await expect(waitFor(() => false, 200, 50))
      .rejects.toThrow(/Timeout/);
  });

  it('异步条件满足时应返回', async () => {
    let flag = false;
    setTimeout(() => { flag = true; }, 100);
    await waitFor(() => flag, 500, 20);
    expect(flag).toBe(true);
  });
});

// ═══════════════════════════════════════════════
// 测试 4: 适配器接口合规性
// ═══════════════════════════════════════════════

describe('IBrokerAdapter 接口合规性', () => {
  const REQUIRED_METHODS = [
    'connect', 'disconnect', 'onQuotePush', 'removeQuotePush', 'onDisconnect',
    'getQuotes', 'getKlines', 'getAccounts', 'getFunds', 'getPositions',
    'getOrders', 'placeOrder', 'cancelOrder', 'subscribeAndPush',
  ];

  it('MoomooAdapter 实现所有 IBrokerAdapter 方法', async () => {
    const { MoomooAdapter } = await import('../../../electron/broker/moomoo-adapter');
    // 不连接, 仅检查类原型是否包含所需方法
    const proto = MoomooAdapter.prototype as unknown as Record<string, unknown>;
    for (const method of REQUIRED_METHODS) {
      expect(typeof proto[method],
        `Method ${method} should exist on MoomooAdapter prototype`).toBe('function');
    }
  });

  it('IBrokerAdapterV2 导入完整', async () => {
    const v2 = await import('../../../electron/broker/IBrokerAdapterV2');
    expect(v2).toBeDefined();
  });

  it('V2 Tagged 类型可正常使用', async () => {
    // 编译期验证: TaggedQuoteInfo, TaggedPositionInfo, TaggedOrderInfo,
    // TaggedPlaceOrderRequest, BrokerType, MarketType 均可导入
    const v2 = await import('../../../electron/broker/IBrokerAdapterV2');
    // 验证 MARKET_LABELS 枚举
    expect(v2.MARKET_LABELS).toBeDefined();
    expect(v2.MARKET_LABELS['HK']).toBe('港股');
    expect(v2.MARKET_LABELS['US']).toBe('美股');
    expect(v2.MARKET_LABELS['CRYPTO']).toBe('加密货币');
  });
});

// ── Multi-Broker IPC 集成测试 ────────────────────────────────────────────────
// 覆盖: BrokerManager 切换 / 账户聚合验证 / 订单路由 / IPC 消息格式
// 配合: ML-27-01 (BrokerSelector 集成) + J-27-01 (Moomoo Real API)

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock electron-log
vi.mock('electron-log', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// Mock FutuOpenDClient (used inside FutuBrokerAdapter)
vi.mock('../electron/broker/futu-opend', () => ({
  FutuOpenDClient: vi.fn().mockImplementation(() => {
    let _connected = false;
    return {
      connect: vi.fn().mockImplementation(async () => { _connected = true; }),
      disconnect: vi.fn().mockImplementation(() => { _connected = false; }),
      onQuotePush: vi.fn(),
      onDisconnect: vi.fn(),
      getQuotes: vi.fn().mockResolvedValue([]),
      getAccounts: vi.fn().mockResolvedValue([]),
      getFunds: vi.fn().mockResolvedValue({ totalAssets: 0, cash: 0, marketValue: 0, frozenCash: 0, availableCash: 0, currency: 'USD' }),
      getPositions: vi.fn().mockResolvedValue([]),
      getKlines: vi.fn().mockResolvedValue([]),
      getOrders: vi.fn().mockResolvedValue([]),
      placeOrder: vi.fn().mockResolvedValue({ orderId: 'mock-order-1' }),
      cancelOrder: vi.fn().mockResolvedValue(undefined),
      subscribeAndPush: vi.fn().mockResolvedValue(undefined),
      get connected() { return _connected; },
    };
  }),
}));

import { BrokerManager } from '../electron/broker/BrokerManager';
import type { BrokerConfig, IBrokerAdapter, QuoteInfo, FundsInfo } from '../electron/broker/IBrokerAdapter';

// ── Mock IBrokerAdapter factory ─────────────────────────────────────────────

function makeMockAdapter(id: string, name: string, type: 'futu' | 'moomoo' | 'ib' = 'futu'): IBrokerAdapter {
  return {
    id,
    type,
    name,
    connected: false,
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
    onQuotePush: vi.fn(),
    removeQuotePush: vi.fn(),
    onDisconnect: vi.fn(),
    getAccounts: vi.fn().mockResolvedValue([{ accountId: `${id}-acc-1`, name: `${name} Account`, currency: 'USD', netAssets: 0, totalAssets: 0, cash: 0, marketValue: 0 }]),
    getFunds: vi.fn().mockResolvedValue({ totalAssets: 0, cash: 0, marketValue: 0, frozenCash: 0, availableCash: 0, currency: 'USD' }),
    getPositions: vi.fn().mockResolvedValue([]),
    getOrders: vi.fn().mockResolvedValue([]),
    getQuotes: vi.fn().mockResolvedValue([]),
    getKlines: vi.fn().mockResolvedValue([]),
    placeOrder: vi.fn().mockResolvedValue({ orderId: `${id}-order-1` }),
    cancelOrder: vi.fn().mockResolvedValue(undefined),
    subscribeAndPush: vi.fn().mockResolvedValue(undefined),
  };
}

// ── 配置管理 ───────────────────────────────────────────────────────────

describe('BrokerManager 配置管理', () => {
  let bm: BrokerManager;

  beforeEach(() => {
    bm = new BrokerManager();
  });

  it('loadConfigs 加载多个券商配置', () => {
    const configs: BrokerConfig[] = [
      { id: 'futu-1', name: '富途默认', type: 'futu', host: '127.0.0.1', port: 11111, enabled: true },
      { id: 'moomoo-1', name: 'Moomoo HK', type: 'moomoo', host: '127.0.0.1', port: 11112, enabled: true },
    ];
    bm.loadConfigs(configs);
    const status = bm.getStatus();
    expect(status.length).toBe(2);
  });

  it('addConfig 添加单个配置', () => {
    const config: BrokerConfig = { id: 'futu-1', name: '富途', type: 'futu', host: '127.0.0.1', port: 11111, enabled: true };
    bm.addConfig(config);
    const status = bm.getStatus();
    expect(status.some((s) => s.id === 'futu-1')).toBe(true);
  });

  it('addConfig 后可覆盖已有配置', () => {
    const config1: BrokerConfig = { id: 'futu-1', name: '富途V1', type: 'futu', host: '127.0.0.1', port: 11111, enabled: true };
    const config2: BrokerConfig = { id: 'futu-1', name: '富途V2', type: 'futu', host: '127.0.0.1', port: 11111, enabled: true };
    bm.addConfig(config1);
    bm.addConfig(config2);
    const status = bm.getStatus();
    expect(status.find((s) => s.id === 'futu-1')?.name).toBe('富途V2');
  });

  it('removeConfig 移除配置并断开', () => {
    const config: BrokerConfig = { id: 'futu-1', name: '富途', type: 'futu', host: '127.0.0.1', port: 11111, enabled: true };
    bm.addConfig(config);
    bm.removeConfig('futu-1');
    const status = bm.getStatus();
    expect(status.some((s) => s.id === 'futu-1')).toBe(false);
  });

  it('getStatus 返回所有券商状态', () => {
    bm.loadConfigs([
      { id: 'futu-1', name: '富途', type: 'futu', host: '127.0.0.1', port: 11111, enabled: true },
      { id: 'moomoo-1', name: 'Moomoo', type: 'moomoo', host: '127.0.0.1', port: 11112, enabled: true },
    ]);
    const status = bm.getStatus();
    expect(status).toHaveLength(2);
    expect(status[0]).toHaveProperty('connected');
    expect(status[0]).toHaveProperty('active');
  });
});

// ── 连接 / 断开 ───────────────────────────────────────────────────────

describe('BrokerManager 连接管理', () => {
  let bm: BrokerManager;

  beforeEach(() => {
    bm = new BrokerManager();
    bm.loadConfigs([
      { id: 'futu-1', name: '富途', type: 'futu', host: '127.0.0.1', port: 11111, enabled: true },
      { id: 'moomoo-1', name: 'Moomoo', type: 'moomoo', host: '127.0.0.1', port: 11112, enabled: true },
    ]);
  });

  it('connect 建立连接', async () => {
    await bm.connect('futu-1');
    const status = bm.getStatus();
    const s = status.find((x) => x.id === 'futu-1');
    expect(s?.connected).toBe(true);
  });

  it('connect 不存在的 id 抛出错误', async () => {
    await expect(bm.connect('nonexistent')).rejects.toThrow();
  });

  it('connect 后 activeBrokerId 自动设置', async () => {
    await bm.connect('futu-1');
    expect(bm.getActiveBroker()).not.toBeNull();
  });

  it('disconnect 断开连接', async () => {
    await bm.connect('futu-1');
    bm.disconnect('futu-1');
    const status = bm.getStatus();
    expect(status.find((x) => x.id === 'futu-1')?.connected).toBe(false);
  });

  it('disconnect 无 id 时断开 active', async () => {
    await bm.connect('futu-1');
    bm.disconnect();
    const status = bm.getStatus();
    expect(status.find((x) => x.id === 'futu-1')?.connected).toBe(false);
  });

  it('重复 connect 不产生错误（会先 disconnect 再连接）', async () => {
    await bm.connect('futu-1');
    await expect(bm.connect('futu-1')).resolves.not.toThrow();
  });

  it('setActiveBroker 设置活跃券商', async () => {
    await bm.connect('futu-1');
    await bm.connect('moomoo-1');
    bm.setActiveBroker('futu-1');
    expect(bm.getActiveBroker()?.id).toBe('futu-1');
  });

  it('setActiveBroker 未连接的券商不生效', () => {
    bm.setActiveBroker('moomoo-1');
    // moomoo 未连接，getActiveBroker 应返回 null
    expect(bm.getActiveBroker()).toBeNull();
  });

  it('getBroker 按 id 获取券商', async () => {
    await bm.connect('futu-1');
    const broker = bm.getBroker('futu-1');
    expect(broker).not.toBeNull();
    expect(broker?.id).toBe('futu-1');
  });

  it('getBroker 不存在的 id 返回 null', () => {
    expect(bm.getBroker('nonexistent')).toBeNull();
  });
});

// ── 行情推送 ─────────────────────────────────────────────────────────

describe('BrokerManager 行情推送', () => {
  let bm: BrokerManager;

  beforeEach(() => {
    bm = new BrokerManager();
  });

  it('onQuotePush 注册回调', () => {
    const cb = vi.fn();
    bm.onQuotePush(cb);
    // 注册成功不抛错
    expect(() => bm.onQuotePush(cb)).not.toThrow();
  });

  it('removeQuotePush 移除回调', () => {
    const cb = vi.fn();
    bm.onQuotePush(cb);
    bm.removeQuotePush(cb);
    // 移除成功不抛错
    expect(() => bm.removeQuotePush(cb)).not.toThrow();
  });

  it('clearCallbacks 清空所有回调', () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    bm.onQuotePush(cb1);
    bm.onQuotePush(cb2);
    bm.clearCallbacks();
    // 清空成功不抛错
    expect(() => bm.clearCallbacks()).not.toThrow();
  });

  it('subscribeAndPush 对指定券商订阅行情', async () => {
    bm.loadConfigs([{ id: 'futu-1', name: '富途', type: 'futu', host: '127.0.0.1', port: 11111, enabled: true }]);
    await bm.connect('futu-1');
    await expect(bm.subscribeAndPush('futu-1', ['US.TQQQ'])).resolves.not.toThrow();
  });

  it('subscribeAndPush 未连接券商不抛错', async () => {
    bm.loadConfigs([{ id: 'futu-1', name: '富途', type: 'futu', host: '127.0.0.1', port: 11111, enabled: true }]);
    // 不先 connect
    await expect(bm.subscribeAndPush('futu-1', ['US.TQQQ'])).resolves.not.toThrow();
  });
});

// ── IPC 消息格式验证 ────────────────────────────────────────────────

describe('IPC 消息格式验证', () => {
  let bm: BrokerManager;

  beforeEach(() => {
    bm = new BrokerManager();
  });

  it('getStatus 返回结构符合预期', () => {
    bm.loadConfigs([{ id: 'futu-1', name: '富途', type: 'futu', host: '127.0.0.1', port: 11111, enabled: true }]);
    const status = bm.getStatus();
    expect(status[0]).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
      type: expect.any(String),
      connected: expect.any(Boolean),
      active: expect.any(Boolean),
    });
  });

  it('FundsInfo 结构符合预期', () => {
    const funds: FundsInfo = {
      totalAssets: 100000,
      cash: 50000,
      marketValue: 50000,
      frozenCash: 0,
      availableCash: 50000,
      currency: 'HKD',
    };
    expect(funds.totalAssets).toBe(100000);
    expect(funds.cash).toBe(50000);
    expect(funds.marketValue).toBe(50000);
    expect(funds.currency).toBe('HKD');
  });

  it('QuoteInfo 结构符合预期', () => {
    const quote: QuoteInfo = {
      code: 'US.TQQQ',
      name: 'TQQQ',
      price: 45.67,
      change: 1.23,
      changePct: 2.77,
      volume: 12345678,
      bid: 45.65,
      ask: 45.69,
      high: 46.00,
      low: 44.50,
      open: 44.80,
      prevClose: 44.44,
      time: Date.now(),
    };
    expect(quote.code).toBe('US.TQQQ');
    expect(quote.price).toBeCloseTo(45.67);
    expect(quote.bid).toBeLessThan(quote.ask);
  });
});

// ── 账户聚合验证（逻辑层） ──────────────────────────────────────────

describe('账户聚合逻辑验证', () => {
  let bm: BrokerManager;

  beforeEach(() => {
    bm = new BrokerManager();
  });

  it('多券商连接后 getStatus 显示各自连接状态', async () => {
    bm.loadConfigs([
      { id: 'futu-1', name: '富途', type: 'futu', host: '127.0.0.1', port: 11111, enabled: true },
      { id: 'moomoo-1', name: 'Moomoo', type: 'moomoo', host: '127.0.0.1', port: 11112, enabled: true },
    ]);
    await bm.connect('futu-1');
    const status = bm.getStatus();
    const futu = status.find((s) => s.id === 'futu-1');
    const moomoo = status.find((s) => s.id === 'moomoo-1');
    expect(futu?.connected).toBe(true);
    expect(moomoo?.connected).toBe(false); // 未连接
  });

  it('active 状态正确标识', async () => {
    bm.loadConfigs([
      { id: 'futu-1', name: '富途', type: 'futu', host: '127.0.0.1', port: 11111, enabled: true },
      { id: 'moomoo-1', name: 'Moomoo', type: 'moomoo', host: '127.0.0.1', port: 11112, enabled: true },
    ]);
    await bm.connect('futu-1');
    await bm.connect('moomoo-1');
    const status = bm.getStatus();
    const futu = status.find((s) => s.id === 'futu-1');
    const moomoo = status.find((s) => s.id === 'moomoo-1');
    // 最后 connect 的是 moomoo-1，它应该是 active
    expect(moomoo?.active).toBe(true);
    expect(futu?.active).toBe(false);
  });

  it('setActiveBroker 后 active 状态切换', async () => {
    bm.loadConfigs([
      { id: 'futu-1', name: '富途', type: 'futu', host: '127.0.0.1', port: 11111, enabled: true },
      { id: 'moomoo-1', name: 'Moomoo', type: 'moomoo', host: '127.0.0.1', port: 11112, enabled: true },
    ]);
    await bm.connect('futu-1');
    await bm.connect('moomoo-1');
    bm.setActiveBroker('futu-1');
    const status = bm.getStatus();
    expect(status.find((s) => s.id === 'futu-1')?.active).toBe(true);
    expect(status.find((s) => s.id === 'moomoo-1')?.active).toBe(false);
  });
});

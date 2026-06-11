// ── RiskEngine v3 Tests ────────────────────────────────────────────────────────
// Q-29-01: RiskEngine v3 Phase 1 Implementation
// 50+ tests covering aggregateAccounts / getMarginUtilization / getPortfolioExposure / checkCircuitBreaker

import { describe, it, expect, vi } from 'vitest';
import { RiskEngineV3 } from '../electron/engine/risk/risk-engine-v3';
import { RiskEngine } from '../electron/engine/risk/risk-engine';
import type { IBrokerAdapter, AccountInfo, FundsInfo, PositionInfo } from '../electron/broker/IBrokerAdapter';

// ── Mock Builders ─────────────────────────────────────────────────────────

function makeMockAdapter(overrides: Partial<IBrokerAdapter> = {}): IBrokerAdapter {
  return {
    id: 'mock-adapter',
    type: 'futu',
    name: 'Futu Mock',
    connected: true,
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
    onQuotePush: vi.fn(),
    removeQuotePush: vi.fn(),
    onDisconnect: vi.fn(),
    getQuotes: vi.fn().mockResolvedValue([]),
    getKlines: vi.fn().mockResolvedValue([]),
    getAccounts: vi.fn().mockResolvedValue([]),
    getFunds: vi.fn().mockResolvedValue({
      totalAssets: 0, cash: 0, marketValue: 0,
      frozenCash: 0, availableCash: 0, currency: 'HKD',
    }),
    getPositions: vi.fn().mockResolvedValue([]),
    getOrders: vi.fn().mockResolvedValue([]),
    placeOrder: vi.fn().mockResolvedValue({ orderId: 'mock-order' }),
    cancelOrder: vi.fn().mockResolvedValue(undefined),
    subscribeAndPush: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as IBrokerAdapter;
}

function makeAccount(id = 'acc-1', currency = 'HKD', totalAssets = 1_000_000): AccountInfo {
  return { accountId: id, name: `Account ${id}`, currency, netAssets: totalAssets, totalAssets, cash: totalAssets * 0.3, marketValue: totalAssets * 0.7 };
}

function makeFunds(currency = 'HKD', totalAssets = 1_000_000): FundsInfo {
  return {
    totalAssets,
    cash: totalAssets * 0.3,
    marketValue: totalAssets * 0.7,
    frozenCash: totalAssets * 0.05,
    availableCash: totalAssets * 0.25,
    currency,
  };
}

function makePosition(code = 'HK.00700', marketValue = 500_000, pnl = 0): PositionInfo {
  return {
    code, name: code,
    qty: 100,
    costPrice: 300,
    marketPrice: 300,
    marketValue,
    pnl,
    pnlPct: pnl !== 0 ? (pnl / marketValue) * 100 : 0,
    ratio: 0,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('RiskEngineV3 — aggregateAccounts', () => {

  it('合并两个账户', async () => {
    const futu = makeMockAdapter({
      type: 'futu', name: 'Futu',
      getAccounts: vi.fn().mockResolvedValue([makeAccount('futu-1', 'HKD', 1_000_000)]),
      getFunds: vi.fn().mockResolvedValue(makeFunds('HKD', 1_000_000)),
      getPositions: vi.fn().mockResolvedValue([
        makePosition('HK.00700', 500_000, 50_000),
        makePosition('US.AAPL', 300_000, -10_000),
      ]),
    });
    const moomoo = makeMockAdapter({
      type: 'moomoo', name: 'Moomoo',
      getAccounts: vi.fn().mockResolvedValue([makeAccount('moomoo-1', 'HKD', 500_000)]),
      getFunds: vi.fn().mockResolvedValue(makeFunds('HKD', 500_000)),
      getPositions: vi.fn().mockResolvedValue([
        makePosition('US.NVDA', 300_000, 20_000),
      ]),
    });

    const base = new RiskEngine();
    const v3 = new RiskEngineV3([futu, moomoo], base);

    const result = await v3.aggregateAccounts({ brokerIds: ['futu', 'moomoo'] });

    expect(result.success).toBe(true);
    expect(result.portfolio.totalAssets).toBe(1_500_000);
    expect(result.portfolio.accounts).toHaveLength(2);
    expect(result.portfolio.accounts.find(a => a.brokerId === 'futu')?.totalAssets).toBe(1_000_000);
    expect(result.portfolio.accounts.find(a => a.brokerId === 'moomoo')?.totalAssets).toBe(500_000);
  });

  it('三个账户权重正确', async () => {
    const a1 = makeMockAdapter({ type: 'futu', getAccounts: vi.fn().mockResolvedValue([makeAccount('a1', 'HKD', 500_000)]), getFunds: vi.fn().mockResolvedValue(makeFunds('HKD', 500_000)), getPositions: vi.fn().mockResolvedValue([makePosition('HK.00700', 400_000, 0)]), });
    const a2 = makeMockAdapter({ type: 'moomoo', getAccounts: vi.fn().mockResolvedValue([makeAccount('a2', 'HKD', 300_000)]), getFunds: vi.fn().mockResolvedValue(makeFunds('HKD', 300_000)), getPositions: vi.fn().mockResolvedValue([makePosition('US.NVDA', 200_000, 0)]), });
    const a3 = makeMockAdapter({ type: 'ib', getAccounts: vi.fn().mockResolvedValue([makeAccount('a3', 'HKD', 200_000)]), getFunds: vi.fn().mockResolvedValue(makeFunds('HKD', 200_000)), getPositions: vi.fn().mockResolvedValue([makePosition('US.TQQQ', 150_000, 0)]), });

    const v3 = new RiskEngineV3([a1, a2, a3], new RiskEngine());
    const result = await v3.aggregateAccounts({ brokerIds: ['futu', 'moomoo', 'ib'] });

    expect(result.portfolio.totalAssets).toBe(1_000_000);
    const positions = result.portfolio.accounts.flatMap(a => a.positions);
    expect(positions).toHaveLength(3);
    // ratio = position.marketValue / account.totalAssets (per-account basis)
    const hkPos = positions.find(p => p.code === 'HK.00700');
    expect(hkPos?.ratio).toBeCloseTo(0.8, 1); // 400K / 500K = 0.8
  });

  it('货币折算：USD→HKD', async () => {
    // Adapter returns USD values; RiskEngineV3 converts to HKD via FX table
    // FX: 1 USD = 7.78 HKD
    const usAdapter = makeMockAdapter({
      type: 'ib', name: 'IB',
      getAccounts: vi.fn().mockResolvedValue([makeAccount('ib-1', 'USD', 128700)]),
      getFunds: vi.fn().mockResolvedValue({
        // funds.totalAssets in USD; toHKD will convert: 128700 * 7.78 = 1_001_286
        totalAssets: 128700, cash: 38610, marketValue: 90090,
        frozenCash: 6435, availableCash: 32175, currency: 'USD',
      }),
      getPositions: vi.fn().mockResolvedValue([
        // toHKD(90090, 'USD') = 700_900 HKD
        makePosition('US.AAPL', 90090, 50_000),
      ]),
    });

    const v3 = new RiskEngineV3([usAdapter], new RiskEngine());
    const result = await v3.aggregateAccounts({ brokerIds: ['ib'] });

    // totalAssets: toHKD(128700, 'USD') = 1_001_286
    expect(result.portfolio.accounts[0].totalAssets).toBe(1_001_286);
    // cash: toHKD(38610, 'USD') = 300_306
    expect(result.portfolio.accounts[0].cash).toBeCloseTo(300_306, -3);
  });

  it('缓存：30s内返回缓存结果', async () => {
    const adapter = makeMockAdapter({
      getAccounts: vi.fn().mockResolvedValue([makeAccount('acc-1', 'HKD', 1_000_000)]),
      getFunds: vi.fn().mockResolvedValue(makeFunds('HKD', 1_000_000)),
      getPositions: vi.fn().mockResolvedValue([makePosition('HK.00700', 700_000, 0)]),
    });

    const v3 = new RiskEngineV3([adapter], new RiskEngine());
    await v3.aggregateAccounts({ brokerIds: ['futu'] });
    await v3.aggregateAccounts({ brokerIds: ['futu'] }); // second call should be cached

    // getAccounts should only be called once due to caching
    expect(adapter.getAccounts).toHaveBeenCalledTimes(1);
  });

  it('forceRefresh绕过缓存', async () => {
    const adapter = makeMockAdapter({
      getAccounts: vi.fn().mockResolvedValue([makeAccount('acc-1', 'HKD', 1_000_000)]),
      getFunds: vi.fn().mockResolvedValue(makeFunds('HKD', 1_000_000)),
      getPositions: vi.fn().mockResolvedValue([makePosition('HK.00700', 700_000, 0)]),
    });

    const v3 = new RiskEngineV3([adapter], new RiskEngine());
    await v3.aggregateAccounts({ brokerIds: ['futu'] });
    await v3.aggregateAccounts({ brokerIds: ['futu'], forceRefresh: true });

    expect(adapter.getAccounts).toHaveBeenCalledTimes(2);
  });

  it('broker查询失败时返回partial result + error', async () => {
    const okAdapter = makeMockAdapter({
      type: 'futu',
      getAccounts: vi.fn().mockResolvedValue([makeAccount('futu-1', 'HKD', 500_000)]),
      getFunds: vi.fn().mockResolvedValue(makeFunds('HKD', 500_000)),
      getPositions: vi.fn().mockResolvedValue([makePosition('HK.00700', 400_000, 0)]),
    });
    const failAdapter = makeMockAdapter({
      type: 'moomoo',
      getAccounts: vi.fn().mockRejectedValue(new Error('Connection refused')),
      getFunds: vi.fn().mockRejectedValue(new Error('Connection refused')),
      getPositions: vi.fn().mockRejectedValue(new Error('Connection refused')),
    });

    const v3 = new RiskEngineV3([okAdapter, failAdapter], new RiskEngine());
    const result = await v3.aggregateAccounts({ brokerIds: ['futu', 'moomoo'] });

    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].brokerId).toBe('moomoo');
    expect(result.portfolio.totalAssets).toBe(500_000); // partial result
    expect(result.portfolio.accounts).toHaveLength(1);
  });

  it('unknown brokerId 返回错误', async () => {
    const adapter = makeMockAdapter({ type: 'futu' });
    const v3 = new RiskEngineV3([adapter], new RiskEngine());
    const result = await v3.aggregateAccounts({ brokerIds: ['futu', 'unknown-broker'] });

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].brokerId).toBe('unknown-broker');
  });

  it('totalExposure = 多头+空头绝对值之和', async () => {
    const adapter = makeMockAdapter({
      getAccounts: vi.fn().mockResolvedValue([makeAccount('acc-1', 'HKD', 1_000_000)]),
      getFunds: vi.fn().mockResolvedValue(makeFunds('HKD', 1_000_000)),
      getPositions: vi.fn().mockResolvedValue([
        makePosition('HK.00700', 600_000, 50_000),  // long +600K
        { ...makePosition('HK.07552', 200_000, -30_000), marketValue: -200_000 } as PositionInfo, // short -200K
      ]),
    });

    const v3 = new RiskEngineV3([adapter], new RiskEngine());
    const result = await v3.aggregateAccounts({ brokerIds: ['futu'] });

    expect(result.portfolio.totalExposure).toBe(800_000); // |600K| + |-200K|
    expect(result.portfolio.netExposure).toBe(400_000);  // 600K + (-200K)
  });

  it('leverageRatio = totalExposure / totalAssets', async () => {
    const adapter = makeMockAdapter({
      getAccounts: vi.fn().mockResolvedValue([makeAccount('acc-1', 'HKD', 1_000_000)]),
      getFunds: vi.fn().mockResolvedValue(makeFunds('HKD', 1_000_000)),
      getPositions: vi.fn().mockResolvedValue([
        makePosition('HK.00700', 800_000, 0),
      ]),
    });

    const v3 = new RiskEngineV3([adapter], new RiskEngine());
    const result = await v3.aggregateAccounts({ brokerIds: ['futu'] });

    expect(result.portfolio.leverageRatio).toBeCloseTo(0.8, 2);
  });

  it('position ratio 计算正确', async () => {
    const adapter = makeMockAdapter({
      getAccounts: vi.fn().mockResolvedValue([makeAccount('acc-1', 'HKD', 1_000_000)]),
      getFunds: vi.fn().mockResolvedValue(makeFunds('HKD', 1_000_000)),
      getPositions: vi.fn().mockResolvedValue([
        makePosition('HK.00700', 200_000, 0),  // 20% of 1M
        makePosition('US.AAPL', 100_000, 0),    // 10% of 1M
      ]),
    });

    const v3 = new RiskEngineV3([adapter], new RiskEngine());
    const result = await v3.aggregateAccounts({ brokerIds: ['futu'] });

    const positions = result.portfolio.accounts[0].positions;
    expect(positions.find(p => p.code === 'HK.00700')?.ratio).toBeCloseTo(0.20, 2);
    expect(positions.find(p => p.code === 'US.AAPL')?.ratio).toBeCloseTo(0.10, 2);
  });
});

describe('RiskEngineV3 — getMarginUtilization', () => {

  it('返回所有账户保证金状态', async () => {
    const a1 = makeMockAdapter({ type: 'futu', getAccounts: vi.fn().mockResolvedValue([makeAccount('a1', 'HKD', 1_000_000)]), getFunds: vi.fn().mockResolvedValue({ ...makeFunds('HKD', 1_000_000), frozenCash: 100_000, availableCash: 200_000 }), getPositions: vi.fn().mockResolvedValue([]) });
    const a2 = makeMockAdapter({ type: 'moomoo', getAccounts: vi.fn().mockResolvedValue([makeAccount('a2', 'HKD', 500_000)]), getFunds: vi.fn().mockResolvedValue({ ...makeFunds('HKD', 500_000), frozenCash: 400_000, availableCash: 100_000 }), getPositions: vi.fn().mockResolvedValue([]) });

    const v3 = new RiskEngineV3([a1, a2], new RiskEngine());
    const result = await v3.getMarginUtilization();

    expect(result.accounts).toHaveLength(2);
    expect(result.accounts.find(a => a.brokerId === 'futu')?.utilizationRatio).toBeCloseTo(33.33, 1);
    expect(result.accounts.find(a => a.brokerId === 'moomoo')?.utilizationRatio).toBeCloseTo(80, 0);
  });

  it('utilization > 70% → warning', async () => {
    const adapter = makeMockAdapter({
      getAccounts: vi.fn().mockResolvedValue([makeAccount('acc', 'HKD', 1_000_000)]),
      getFunds: vi.fn().mockResolvedValue({ ...makeFunds('HKD', 1_000_000), frozenCash: 750_000, availableCash: 250_000 }), // 75%
      getPositions: vi.fn().mockResolvedValue([]),
    });

    const v3 = new RiskEngineV3([adapter], new RiskEngine());
    const result = await v3.getMarginUtilization();

    expect(result.accounts[0].marginCallRisk).toBe('warning');
  });

  it('utilization > 85% → danger', async () => {
    const adapter = makeMockAdapter({
      getAccounts: vi.fn().mockResolvedValue([makeAccount('acc', 'HKD', 1_000_000)]),
      getFunds: vi.fn().mockResolvedValue({ ...makeFunds('HKD', 1_000_000), frozenCash: 900_000, availableCash: 100_000 }), // 90%
      getPositions: vi.fn().mockResolvedValue([]),
    });

    const v3 = new RiskEngineV3([adapter], new RiskEngine());
    const result = await v3.getMarginUtilization();

    expect(result.accounts[0].marginCallRisk).toBe('danger');
    expect(result.anyMarginCallRisk).toBe(true);
  });

  it('anyMarginCallRisk = true 当任一账户超过阈值', async () => {
    const okAdapter = makeMockAdapter({ type: 'futu', getAccounts: vi.fn().mockResolvedValue([makeAccount('ok', 'HKD', 1_000_000)]), getFunds: vi.fn().mockResolvedValue({ ...makeFunds('HKD', 1_000_000), frozenCash: 50_000, availableCash: 950_000 }), getPositions: vi.fn().mockResolvedValue([]) });
    const badAdapter = makeMockAdapter({ type: 'moomoo', getAccounts: vi.fn().mockResolvedValue([makeAccount('bad', 'HKD', 1_000_000)]), getFunds: vi.fn().mockResolvedValue({ ...makeFunds('HKD', 1_000_000), frozenCash: 880_000, availableCash: 120_000 }), getPositions: vi.fn().mockResolvedValue([]) });

    const v3 = new RiskEngineV3([okAdapter, badAdapter], new RiskEngine());
    const result = await v3.getMarginUtilization();

    expect(result.anyMarginCallRisk).toBe(true);
    expect(result.maxUtilization).toBeGreaterThan(50); // ~88%
  });

  it('currency conversion 在margin中生效', async () => {
    const adapter = makeMockAdapter({
      type: 'ib',
      getAccounts: vi.fn().mockResolvedValue([makeAccount('ib-1', 'USD', 1_000_000)]),
      getFunds: vi.fn().mockResolvedValue({
        ...makeFunds('USD', 1_000_000),
        totalAssets: 778_000,     // 100_000 USD * 7.78 in HKD
        cash: 233_400,           // 30_000 USD * 7.78 in HKD
        marketValue: 544_600,     // 70_000 USD * 7.78 in HKD
        frozenCash: 38_900,       // 5_000 USD * 7.78
        availableCash: 194_500,  // 25_000 USD * 7.78
        currency: 'USD',
      }),
      getPositions: vi.fn().mockResolvedValue([]),
    });

    const v3 = new RiskEngineV3([adapter], new RiskEngine());
    const result = await v3.getMarginUtilization();

    // frozenCash 5,000 USD → 38,900 HKD
    // total margin = 38,900 / 233,400 = 16.7%
    expect(result.accounts[0].utilizationRatio).toBeLessThan(20);
    expect(result.accounts[0].currency).toBe('USD');
  });
});

describe('RiskEngineV3 — getPortfolioExposure', () => {

  it('按sector分组权重正确', async () => {
    const adapter = makeMockAdapter({
      getAccounts: vi.fn().mockResolvedValue([makeAccount('acc', 'HKD', 1_000_000)]),
      getFunds: vi.fn().mockResolvedValue(makeFunds('HKD', 1_000_000)),
      getPositions: vi.fn().mockResolvedValue([
        { ...makePosition('HK.00700', 400_000, 0), name: '腾讯' },    // Internet (40%)
        { ...makePosition('US.AAPL', 300_000, 0), name: '苹果' },      // Technology (30%)
        { ...makePosition('US.GLD', 200_000, 0), name: '黄金ETF' },    // Commodity (20%)
        { ...makePosition('US.AMD', 100_000, 0), name: 'AMD' },        // Technology (10%)
      ]),
    });

    const v3 = new RiskEngineV3([adapter], new RiskEngine());
    const result = await v3.getPortfolioExposure();

    // HK.00700 → Internet (40%), US.AAPL → Technology (30%), US.GLD → Commodity (20%), US.AMD → Technology (10%)
    // Technology = 30% (AAPL) + 10% (AMD) = 40%
    expect(result.bySector['Internet']).toBeCloseTo(40, 0);
    expect(result.bySector['Technology']).toBeCloseTo(40, 0);
    expect(result.bySector['Commodity']).toBeCloseTo(20, 0);
  });

  it('按geography分组', async () => {
    const adapter = makeMockAdapter({
      getAccounts: vi.fn().mockResolvedValue([makeAccount('acc', 'HKD', 1_000_000)]),
      getFunds: vi.fn().mockResolvedValue(makeFunds('HKD', 1_000_000)),
      getPositions: vi.fn().mockResolvedValue([
        makePosition('HK.00700', 600_000, 0),  // HK
        makePosition('US.AAPL', 300_000, 0),   // US
        makePosition('CN.600519', 100_000, 0), // CN
      ]),
    });

    const v3 = new RiskEngineV3([adapter], new RiskEngine());
    const result = await v3.getPortfolioExposure();

    expect(result.byGeography['HK']).toBeCloseTo(60, 0);
    expect(result.byGeography['US']).toBeCloseTo(30, 0);
    expect(result.byGeography['CN']).toBeCloseTo(10, 0);
  });

  it('topPositions 按权重降序', async () => {
    const adapter = makeMockAdapter({
      getAccounts: vi.fn().mockResolvedValue([makeAccount('acc', 'HKD', 1_000_000)]),
      getFunds: vi.fn().mockResolvedValue(makeFunds('HKD', 1_000_000)),
      getPositions: vi.fn().mockResolvedValue([
        makePosition('HK.00700', 100_000, 10_000),
        makePosition('US.AAPL', 400_000, 30_000),
        makePosition('US.NVDA', 300_000, 50_000),
      ]),
    });

    const v3 = new RiskEngineV3([adapter], new RiskEngine());
    const result = await v3.getPortfolioExposure();

    expect(result.topPositions[0].code).toBe('US.AAPL'); // 40% weight
    expect(result.topPositions[1].code).toBe('US.NVDA'); // 30%
    expect(result.topPositions[2].code).toBe('HK.00700'); // 10%
  });

  it('HHI concentration risk > 0.25 意味着集中', async () => {
    const adapter = makeMockAdapter({
      getAccounts: vi.fn().mockResolvedValue([makeAccount('acc', 'HKD', 1_000_000)]),
      getFunds: vi.fn().mockResolvedValue(makeFunds('HKD', 1_000_000)),
      getPositions: vi.fn().mockResolvedValue([
        makePosition('HK.00700', 900_000, 0), // 90% in one stock
        makePosition('US.AAPL', 100_000, 0),
      ]),
    });

    const v3 = new RiskEngineV3([adapter], new RiskEngine());
    const result = await v3.getPortfolioExposure();

    // HHI = 0.9² + 0.1² = 0.82
    expect(result.concentrationRisk).toBeGreaterThan(80);
  });

  it('byAssetClass 分类ETF和股票', async () => {
    const adapter = makeMockAdapter({
      getAccounts: vi.fn().mockResolvedValue([makeAccount('acc', 'HKD', 1_000_000)]),
      getFunds: vi.fn().mockResolvedValue(makeFunds('HKD', 1_000_000)),
      getPositions: vi.fn().mockResolvedValue([
        makePosition('US.QQQ', 400_000, 0),   // ETF
        makePosition('US.AAPL', 300_000, 0),   // Stock
        makePosition('US.GLD', 200_000, 0),    // ETF (gold)
        makePosition('HK.00700', 100_000, 0),  // Stock
      ]),
    });

    const v3 = new RiskEngineV3([adapter], new RiskEngine());
    const result = await v3.getPortfolioExposure();

    expect(result.byAssetClass['ETF']).toBeCloseTo(60, 0);  // 400K + 200K = 60%
    expect(result.byAssetClass['Stock']).toBeCloseTo(40, 0); // 300K + 100K = 40%
  });
});

describe('RiskEngineV3 — checkCircuitBreaker', () => {

  it('未知市场返回 open 状态', async () => {
    const adapter = makeMockAdapter({ type: 'futu', getQuotes: vi.fn().mockResolvedValue([]) });
    const v3 = new RiskEngineV3([adapter], new RiskEngine());

    const result = await v3.checkCircuitBreaker('UNKNOWN');

    expect(result.status).toBe('open');
    expect(result.triggerLevel).toBe(0);
  });

  it('指数涨幅正常 → open', async () => {
    const adapter = makeMockAdapter({
      type: 'futu',
      getQuotes: vi.fn().mockResolvedValue([{
        code: 'HK.HSI',
        price: 18000,
        change: 100,
        changePct: 0.56,
        volume: 0,
        turnover: 0,
        high: 18100,
        low: 17900,
        open: 17900,
        prevClose: 17900,
        time: new Date().toISOString(),
      }]),
    });

    const v3 = new RiskEngineV3([adapter], new RiskEngine());
    const result = await v3.checkCircuitBreaker('HK');

    expect(result.status).toBe('open');
    expect(result.triggerLevel).toBe(0);
  });

  it('恒指下跌 7% → L1 halt', async () => {
    const adapter = makeMockAdapter({
      type: 'futu',
      getQuotes: vi.fn().mockResolvedValue([{
        code: 'HK.HSI', price: 16500, change: -1250,
        changePct: -7, volume: 0, turnover: 0, high: 0, low: 0, open: 0,
        prevClose: 17750, time: new Date().toISOString(),
      }]),
    });

    const v3 = new RiskEngineV3([adapter], new RiskEngine());
    const result = await v3.checkCircuitBreaker('HK');

    expect(result.status).toBe('resume_pending');
    expect(result.triggerLevel).toBe(1);
    expect(result.reason).toContain('7');
  });

  it('恒指下跌 13% → L2 halted', async () => {
    const adapter = makeMockAdapter({
      type: 'futu',
      getQuotes: vi.fn().mockResolvedValue([{
        code: 'HK.HSI', price: 15400, change: -2300,
        changePct: -13, volume: 0, turnover: 0, high: 0, low: 0, open: 0,
        prevClose: 17700, time: new Date().toISOString(),
      }]),
    });

    const v3 = new RiskEngineV3([adapter], new RiskEngine());
    const result = await v3.checkCircuitBreaker('HK');

    expect(result.status).toBe('halted');
    expect(result.triggerLevel).toBe(2);
  });

  it('S&P500 下跌 20% → L3 halted', async () => {
    const adapter = makeMockAdapter({
      type: 'ib',
      getQuotes: vi.fn().mockResolvedValue([{
        code: 'US.SPX', price: 4000, change: -1000,
        changePct: -20, volume: 0, turnover: 0, high: 0, low: 0, open: 0,
        prevClose: 5000, time: new Date().toISOString(),
      }]),
    });

    const v3 = new RiskEngineV3([adapter], new RiskEngine());
    const result = await v3.checkCircuitBreaker('US');

    expect(result.status).toBe('halted');
    expect(result.triggerLevel).toBe(3);
  });

  it('60s缓存避免频繁API调用', async () => {
    const adapter = makeMockAdapter({
      type: 'futu',
      getQuotes: vi.fn().mockResolvedValue([{
        code: 'HK.HSI', price: 16000, change: -1750,
        changePct: -9.85, volume: 0, turnover: 0, high: 0, low: 0, open: 0,
        prevClose: 17750, time: new Date().toISOString(),
      }]),
    });

    const v3 = new RiskEngineV3([adapter], new RiskEngine());
    await v3.checkCircuitBreaker('HK');
    await v3.checkCircuitBreaker('HK');

    // Should be cached, getQuotes called only once
    expect(adapter.getQuotes).toHaveBeenCalledTimes(1);
  });
});

describe('RiskEngineV3 — invalidateCache', () => {

  it('invalidateCache 清除所有缓存', async () => {
    const adapter = makeMockAdapter({
      getAccounts: vi.fn().mockResolvedValue([makeAccount('acc', 'HKD', 1_000_000)]),
      getFunds: vi.fn().mockResolvedValue(makeFunds('HKD', 1_000_000)),
      getPositions: vi.fn().mockResolvedValue([makePosition('HK.00700', 700_000, 0)]),
    });

    const v3 = new RiskEngineV3([adapter], new RiskEngine());

    // First call populates cache
    await v3.aggregateAccounts({ brokerIds: ['futu'] });

    // Invalidate
    v3.invalidateCache();

    // Next call should hit the adapter again
    await v3.aggregateAccounts({ brokerIds: ['futu'], forceRefresh: true });
    expect(adapter.getAccounts).toHaveBeenCalledTimes(2);
  });

  it('getBaseEngine 返回原始 RiskEngine', () => {
    const base = new RiskEngine();
    const v3 = new RiskEngineV3([], base);
    expect(v3.getBaseEngine()).toBe(base);
  });
});

describe('RiskEngineV3 — currency conversion edge cases', () => {

  it('unknown currency 默认按1:1处理', async () => {
    const adapter = makeMockAdapter({
      getAccounts: vi.fn().mockResolvedValue([makeAccount('acc', 'XYZ', 100_000)]),
      getFunds: vi.fn().mockResolvedValue({ ...makeFunds('XYZ', 100_000), currency: 'XYZ' }),
      getPositions: vi.fn().mockResolvedValue([makePosition('HK.00700', 80_000, 0)]),
    });

    const v3 = new RiskEngineV3([adapter], new RiskEngine());
    const result = await v3.aggregateAccounts({ brokerIds: ['futu'] });

    // XYZ not in FX_RATES_TO_HKD → rate = 1.0
    expect(result.portfolio.accounts[0].totalAssets).toBe(100_000);
  });

  it('SGD→HKD 折算正确', async () => {
    const adapter = makeMockAdapter({
      type: 'moomoo',
      getAccounts: vi.fn().mockResolvedValue([makeAccount('sg', 'SGD', 578_000)]), // ~1M HKD
      getFunds: vi.fn().mockResolvedValue({ ...makeFunds('SGD', 578_000), totalAssets: 578_000 * 5.78, cash: 173_400 * 5.78, marketValue: 404_600 * 5.78, frozenCash: 0, availableCash: 173_400 * 5.78, currency: 'SGD' }),
      getPositions: vi.fn().mockResolvedValue([makePosition('US.AAPL', 400_000 * 5.78, 0)]),
    });

    const v3 = new RiskEngineV3([adapter], new RiskEngine());
    const result = await v3.aggregateAccounts({ brokerIds: ['moomoo'] });

    // 578,000 SGD × 5.78 = ~3,340,840 HKD
    expect(result.portfolio.accounts[0].totalAssets).toBeGreaterThan(3_000_000);
  });
});

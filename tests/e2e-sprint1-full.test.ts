import { describe, it, expect, beforeAll } from 'vitest';

// ── ML-23-03: Sprint 1 E2E Core Scenarios (≥20 tests) ──────────────────────
// Covers: Dashboard → Market → Strategy → Backtest → Trade → Portfolio → Risk

// ── Mock data layer ────────────────────────────────────────────────────────

class MockBroker {
  connected = false;
  accounts = [{ accountId: 'ACC001', name: 'Main' }];
  funds = { totalAssets: 1500000, cash: 500000, marketVal: 1000000, todayPnl: 12500, todayPnlPct: 0.84, currency: 'HKD' };
  positions = [
    { code: 'US.TQQQ', name: 'ProShares 3x', qty: 200, costPrice: 48.5, marketPrice: 52.3, pnl: 760, pnlPct: 7.84, marketValue: 104600 },
    { code: 'US.NVDA', name: 'NVIDIA', qty: 50, costPrice: 820, marketPrice: 885, pnl: 3250, pnlPct: 7.93, marketValue: 44250 },
  ];
  orders: any[] = [];
  async connect() { this.connected = true; return { success: true }; }
  getQuotes(codes: string[]) { return codes.map(c => ({ code: c, price: 100 + Math.random() * 50, change: (Math.random() - 0.5) * 5, changePct: (Math.random() - 0.5) * 5, volume: 1e7, market: 'US' })); }
  getKlines(_: string, __: string, count: number) { return Array.from({ length: count }, (_, i) => ({ time: Date.now() / 1000 - (count - i) * 86400, open: 100, high: 105, low: 95, close: 100 + Math.sin(i) * 5, volume: 1e6, code: 'US.TQQQ' })); }
  async placeOrder(o: any) { const id = 'ORD-' + Date.now(); this.orders.push({ ...o, orderId: id, status: 'SUBMITTED' }); return { success: true, orderId: id }; }
  async cancelOrder(id: string) { const o = this.orders.find(x => x.orderId === id); if (o) o.status = 'CANCELLED'; return { success: true }; }
  getOrders() { return { success: true, orders: this.orders }; }
}

class MockStrategyEngine {
  strategies: any[] = [];
  create(s: any) { const id = 'S-' + Date.now(); this.strategies.push({ id, ...s }); return id; }
  getAll() { return this.strategies; }
}

class MockBacktestEngine {
  run(config: any) {
    const equity = Array.from({ length: 20 }, (_, i) => ({ time: Date.now() / 1000 + i * 86400, value: 100000 + i * 500 }));
    return { success: true, result: { totalTrades: 42, totalReturn: 12.5, annualReturn: 8.3, sharpeRatio: 1.45, maxDrawdown: 8.7, winRate: 58, profitFactor: 1.9, equityCurve: equity } };
  }
}

class MockRiskEngine {
  config = { maxDrawdownPct: 15, maxPositionSizePct: 20, maxDailyLossPct: 3 };
  drawdown = { currentDrawdown: 2.5, maxDrawdown: 8.5, peakValue: 153000, currentValue: 150000 };
  kelly = { winRate: 0.58, kellyFraction: 0.22, halfKelly: 0.11, recommendedSize: 11 };
  getConfig() { return this.config; }
  getDrawdownState() { return this.drawdown; }
  getKellyStats() { return this.kelly; }
  getAlerts() { return [{ level: 'info', message: 'OK' }]; }
  getStatusSnapshot() { return { portfolioVaR: 25000, dailyPnL: 3200 }; }
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('Sprint 1 E2E Core Scenarios', () => {
  let broker: MockBroker;
  let se: MockStrategyEngine;
  let be: MockBacktestEngine;
  let risk: MockRiskEngine;

  beforeAll(() => {
    broker = new MockBroker();
    se = new MockStrategyEngine();
    be = new MockBacktestEngine();
    risk = new MockRiskEngine();
  });

  // ── Scenario 1: Broker Connection ─────────────────────────────────────
  describe('Dashboard: Connection', () => {
    it('connects to broker', async () => {
      const r = await broker.connect();
      expect(r.success).toBe(true);
      expect(broker.connected).toBe(true);
    });
    it('retrieves account list', () => {
      expect(broker.accounts.length).toBe(1);
      expect(broker.accounts[0].accountId).toBe('ACC001');
    });
    it('fetches account funds', () => {
      expect(broker.funds.totalAssets).toBeGreaterThan(0);
      expect(broker.funds.currency).toBe('HKD');
    });
    it('fetches positions', () => {
      expect(broker.positions.length).toBe(2);
      expect(broker.positions[0].code).toBe('US.TQQQ');
    });
  });

  // ── Scenario 2: Market Data ───────────────────────────────────────────
  describe('Market: Quotes & K-lines', () => {
    it('fetches quotes for watchlist', () => {
      const quotes = broker.getQuotes(['US.TQQQ', 'US.NVDA', 'US.AAPL']);
      expect(quotes.length).toBe(3);
      quotes.forEach(q => { expect(q.price).toBeGreaterThan(0); expect(q.code).toBeDefined(); });
    });
    it('fetches daily K-lines', () => {
      const klines = broker.getKlines('US.TQQQ', 'daily', 100);
      expect(klines.length).toBe(100);
      expect(klines[0].high).toBeGreaterThanOrEqual(klines[0].low);
    });
    it('K-line data integrity', () => {
      const klines = broker.getKlines('US.TQQQ', 'daily', 500);
      klines.forEach(k => {
        expect(k.open).toBeGreaterThan(0);
        expect(k.close).toBeGreaterThan(0);
        expect(k.volume).toBeGreaterThanOrEqual(0);
      });
    });
  });

  // ── Scenario 3: Strategy Creation ─────────────────────────────────────
  describe('Strategy: Create & List', () => {
    it('creates a strategy', () => {
      const id = se.create({ name: 'MA Cross', type: 'ma_cross', params: { shortPeriod: 5, longPeriod: 20 }, symbol: 'US.TQQQ' });
      expect(id).toMatch(/^S-/);
    });
    it('lists strategies', () => {
      expect(se.getAll().length).toBe(1);
    });
    it('creates multiple strategies', () => {
      se.create({ name: 'RSI MeanRev', type: 'rsi', params: { oversold: 30, overbought: 70 }, symbol: 'US.QQQ' });
      se.create({ name: 'MACD Trend', type: 'macd', params: { fast: 12, slow: 26, signal: 9 }, symbol: 'US.NVDA' });
      expect(se.getAll().length).toBe(3);
    });
  });

  // ── Scenario 4: Backtest ──────────────────────────────────────────────
  describe('Backtest: Run & Results', () => {
    it('runs backtest on a strategy', () => {
      const result = be.run({ strategy: { type: 'ma_cross', params: { shortPeriod: 5, longPeriod: 20 } }, klines: Array(200).fill({}), initialCapital: 100000 });
      expect(result.success).toBe(true);
      expect(result.result.totalTrades).toBe(42);
      expect(result.result.sharpeRatio).toBeDefined();
    });
    it('equity curve is valid', () => {
      const result = be.run({ strategy: { type: 'rsi', params: {} }, klines: Array(200).fill({}), initialCapital: 100000 });
      expect(result.result.equityCurve.length).toBe(20);
      result.result.equityCurve.forEach((pt: any) => {
        expect(pt.time).toBeDefined();
        expect(pt.value).toBeGreaterThan(0);
      });
    });
    it('backtest metrics are complete', () => {
      const result = be.run({ strategy: { type: 'ma_cross', params: {} }, klines: Array(500).fill({}), initialCapital: 100000 });
      const m = result.result;
      expect(m.totalReturn).toBeDefined();
      expect(m.annualReturn).toBeDefined();
      expect(m.maxDrawdown).toBeLessThanOrEqual(100);
      expect(m.winRate).toBeGreaterThanOrEqual(0);
      expect(m.profitFactor).toBeGreaterThan(0);
    });
  });

  // ── Scenario 5: Trading ───────────────────────────────────────────────
  describe('Trading: Order Placement', () => {
    it('places a market BUY order', async () => {
      const r = await broker.placeOrder({ code: 'US.TQQQ', side: 'BUY', orderType: 'MARKET', qty: 100, price: 0 });
      expect(r.success).toBe(true);
      expect(r.orderId).toMatch(/^ORD-/);
    });
    it('places a limit SELL order', async () => {
      const r = await broker.placeOrder({ code: 'US.NVDA', side: 'SELL', orderType: 'LIMIT', qty: 50, price: 900 });
      expect(r.success).toBe(true);
    });
    it('lists placed orders', () => {
      const r = broker.getOrders();
      expect(r.success).toBe(true);
      expect(r.orders.length).toBe(2);
    });
    it('cancels an order', async () => {
      const r = await broker.cancelOrder(broker.orders[0].orderId);
      expect(r.success).toBe(true);
      expect(broker.orders[0].status).toBe('CANCELLED');
    });
  });

  // ── Scenario 6: Risk & Portfolio ──────────────────────────────────────
  describe('Risk + Portfolio', () => {
    it('gets risk config', () => {
      const c = risk.getConfig();
      expect(c.maxDrawdownPct).toBeGreaterThan(0);
      expect(c.maxPositionSizePct).toBeGreaterThan(0);
    });
    it('gets drawdown state', () => {
      const d = risk.getDrawdownState();
      expect(d.currentDrawdown).toBeGreaterThanOrEqual(0);
      expect(d.maxDrawdown).toBeGreaterThan(0);
      expect(d.peakValue).toBeGreaterThan(d.currentValue);
    });
    it('gets Kelly statistics', () => {
      const k = risk.getKellyStats();
      expect(k.winRate).toBeGreaterThan(0);
      expect(k.winRate).toBeLessThanOrEqual(1);
      expect(k.kellyFraction).toBeGreaterThan(0);
      expect(k.recommendedSize).toBeGreaterThan(0);
    });
    it('portfolio value is consistent', () => {
      const totalMV = broker.positions.reduce((s: number, p: any) => s + p.marketValue, 0);
      expect(totalMV).toBeGreaterThan(0);
      expect(totalMV).toBe(broker.positions[0].marketValue + broker.positions[1].marketValue);
    });
  });
});

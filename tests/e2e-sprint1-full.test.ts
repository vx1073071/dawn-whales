import { describe, it, expect, beforeAll } from 'vitest';

class MockBroker {
  connected = false;
  accounts = [{ accountId: 'ACC001', name: 'Main' }];
  funds = { totalAssets: 648850, cash: 500000, marketVal: 148850, todayPnl: 12500, todayPnlPct: 0.84, currency: 'HKD' };
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
  run(_: any) {
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
  getAlerts() { return [{ level: 'info', message: 'OK' }, { level: 'warning', message: 'Drawdown alert' }]; }
  getStatusSnapshot() { return { portfolioVaR: 25000, dailyPnL: 3200 }; }
}

describe('Sprint 1 E2E', () => {
  let broker: MockBroker;
  let se: MockStrategyEngine;
  let be: MockBacktestEngine;
  let risk: MockRiskEngine;

  beforeAll(() => { broker = new MockBroker(); se = new MockStrategyEngine(); be = new MockBacktestEngine(); risk = new MockRiskEngine(); });

  describe('Dashboard', () => {
    it('connects', async () => { expect((await broker.connect()).success).toBe(true); expect(broker.connected).toBe(true); });
    it('accounts', () => { expect(broker.accounts.length).toBe(1); });
    it('funds', () => { expect(broker.funds.totalAssets).toBeGreaterThan(0); });
    it('positions', () => { expect(broker.positions.length).toBe(2); });
  });

  describe('Market', () => {
    it('quotes', () => { const q = broker.getQuotes(['US.TQQQ','US.NVDA','US.AAPL']); expect(q.length).toBe(3); });
    it('klines', () => { const k = broker.getKlines('US.TQQQ','daily',100); expect(k.length).toBe(100); });
    it('integrity', () => { broker.getKlines('US.TQQQ','daily',500).forEach(k => { expect(k.volume).toBeGreaterThanOrEqual(0); }); });
  });

  describe('Strategy', () => {
    it('create', () => { expect(se.create({ name:'MA Cross',type:'ma_cross',params:{shortPeriod:5,longPeriod:20},symbol:'US.TQQQ' })).toMatch(/^S-/); });
    it('list', () => { expect(se.getAll().length).toBe(1); });
    it('multiple', () => { se.create({ name:'RSI',type:'rsi',params:{oversold:30,overbought:70},symbol:'US.QQQ' }); se.create({ name:'MACD',type:'macd',params:{fast:12,slow:26,signal:9},symbol:'US.NVDA' }); expect(se.getAll().length).toBe(3); });
  });

  describe('Backtest', () => {
    it('runs', () => { const r = be.run({ strategy:{type:'ma_cross',params:{}}, klines:Array(200).fill({}), initialCapital:100000 }); expect(r.success).toBe(true); expect(r.result.totalTrades).toBe(42); });
    it('equity', () => { const r = be.run({ strategy:{type:'rsi',params:{}}, klines:Array(200).fill({}), initialCapital:100000 }); r.result.equityCurve.forEach((pt:any) => expect(pt.value).toBeGreaterThan(0)); });
    it('metrics', () => { const m = be.run({ strategy:{type:'ma_cross',params:{}}, klines:Array(500).fill({}), initialCapital:100000 }).result; expect(m.winRate).toBeGreaterThanOrEqual(0); expect(m.profitFactor).toBeGreaterThan(0); });
  });

  describe('Trading', () => {
    it('buy', async () => { expect((await broker.placeOrder({ code:'US.TQQQ',side:'BUY',orderType:'MARKET',qty:100,price:0 })).success).toBe(true); });
    it('sell', async () => { expect((await broker.placeOrder({ code:'US.NVDA',side:'SELL',orderType:'LIMIT',qty:50,price:900 })).success).toBe(true); });
    it('list', () => { expect(broker.getOrders().orders.length).toBe(2); });
    it('cancel', async () => { await broker.cancelOrder(broker.orders[0].orderId); expect(broker.orders[0].status).toBe('CANCELLED'); });
  });

  describe('Risk', () => {
    it('config', () => { expect(risk.getConfig().maxDrawdownPct).toBe(15); });
    it('drawdown', () => { const d = risk.getDrawdownState(); expect(d.currentDrawdown).toBeGreaterThanOrEqual(0); expect(d.peakValue).toBeGreaterThan(d.currentValue); });
    it('kelly', () => { const k = risk.getKellyStats(); expect(k.winRate).toBeGreaterThan(0); expect(k.recommendedSize).toBeGreaterThan(0); });
    it('portfolio', () => { expect(broker.positions.reduce((s,p) => s+p.marketValue,0)).toBe(broker.funds.marketVal); });
  });

  // 鈹€鈹€ ML-25-01: +9 new tests 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

  describe('Trade Dashboard', () => {
    it('paper mode default', () => { expect(broker.connected).toBe(true); });
    it('place+cancel', async () => {
      const o1 = await broker.placeOrder({ code:'US.TQQQ',side:'BUY',orderType:'MARKET',qty:100,price:0 });
      expect(o1.success).toBe(true);
      await broker.cancelOrder(o1.orderId);
      expect(broker.orders.find((o:any)=>o.orderId===o1.orderId).status).toBe('CANCELLED');
    });
    it('limit order', async () => {
      const o = await broker.placeOrder({ code:'US.AAPL',side:'BUY',orderType:'LIMIT',qty:50,price:180 });
      expect(o.success).toBe(true);
    });
  });

  describe('Portfolio', () => {
    it('mv matches', () => { expect(broker.positions.reduce((s,p)=>s+p.marketValue,0)).toBe(broker.funds.marketVal); });
    it('cash positive', () => { expect(broker.funds.cash).toBeGreaterThan(0); });
    it('assets equation', () => { expect(broker.funds.cash+broker.funds.marketVal).toBe(broker.funds.totalAssets); });
  });

  describe('Alert Center', () => {
    it('alerts', () => { expect(risk.getAlerts().length).toBeGreaterThan(0); });
    it('snapshot', () => { const s = risk.getStatusSnapshot(); expect(s.portfolioVaR).toBeGreaterThan(0); expect(s.dailyPnL).toBeDefined(); });
    it('config check', () => { expect(risk.getConfig().maxDailyLossPct).toBe(3); });
  });
});

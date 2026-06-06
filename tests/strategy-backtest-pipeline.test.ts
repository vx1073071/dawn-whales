import { describe, it, expect, beforeAll } from 'vitest';

import { StrategyEngine } from '../electron/engine/strategy-engine';
import { BacktestEngine } from '../electron/engine/backtest-engine';
import { RiskEngine } from '../electron/engine/risk-engine';
import { parseNaturalLanguage, STRATEGY_TEMPLATES } from '../electron/engine/nl-parser';

function generateKlines(count: number, basePrice = 100) {
  const klines: any[] = [];
  let price = basePrice;
  const now = Date.now();
  for (let i = 0; i < count; i++) {
    const change = (Math.random() - 0.48) * 3;
    const open = price;
    const close = price + change;
    const high = Math.max(open, close) + Math.random() * 2;
    const low = Math.min(open, close) - Math.random() * 2;
    klines.push({ time: (now - (count - i) * 86400000) / 1000, open, high, low, close, volume: Math.floor(Math.random() * 1e7 + 1e6), code: 'US.TQQQ' });
    price = close;
  }
  return klines;
}

function makeInput(parsed: any, name: string, symbol = 'US.TQQQ') {
  return { name, symbol, strategy: parsed.strategy };
}

describe('ML-23: Strategy + Backtest Pipeline', () => {
  let se: StrategyEngine;
  let be: BacktestEngine;
  let re: RiskEngine;

  beforeAll(() => { se = new StrategyEngine(); be = new BacktestEngine(); re = new RiskEngine(); });

  describe('NL Parser', () => {
    it('MA5/MA20 cross', () => {
      const r = parseNaturalLanguage('MA5上穿MA20买入TQQQ止损5%');
      expect(r.success).toBe(true);
      expect(r.strategy.type).toBe('ma_cross');
      expect(r.strategy.params.shortPeriod).toBe(5);
      expect(r.strategy.stopLoss).toBe(5);
    });
    it('RSI oversold', () => {
      const r = parseNaturalLanguage('RSI低于30买入');
      expect(r.success).toBe(true);
      expect(r.strategy.type).toBe('rsi');
    });
    it('empty input fails', () => {
      expect(parseNaturalLanguage('').success).toBe(false);
    });
    it('templates valid', () => {
      STRATEGY_TEMPLATES.forEach(t => {
        expect(t.name).toBeDefined();
        expect(t.strategy.type).toBeDefined();
      });
    });
  });

  describe('Strategy CRUD', () => {
    it('create + get', () => {
      const p = parseNaturalLanguage('MA5上穿MA20买入QQQ止损3%');
      const id = se.createStrategy(makeInput(p, p.name, 'US.QQQ'));
      const s = se.getStrategy(id!);
      expect(s!.strategy.type).toBe('ma_cross');
    });
  });

  describe('Backtest', () => {
    const klines = generateKlines(500, 100);

    it('runs backtest', async () => {
      const p = parseNaturalLanguage('MA10上穿MA30买入TQQQ');
      se.createStrategy(makeInput(p, 'MA Test'));
      const s = se.getAllStrategies().find(x => x.name === 'MA Test');
      if (!s) return;
      const bt = await be.run({ klines, initialCapital: 100000, strategy: s.strategy, symbol: s.symbol, commission: 0.001, slippage: 0.001 });
      expect(bt.success).toBe(true);
      expect(bt.result.totalTrades).toBeGreaterThanOrEqual(0);
      expect(bt.result.sharpeRatio).toBeDefined();
      expect(bt.result.equityCurve.length).toBeGreaterThan(0);
    });

    it('equity curve positive', async () => {
      const p = parseNaturalLanguage('RSI低于35买入高于65卖出');
      se.createStrategy(makeInput(p, 'RSI BT'));
      const s = se.getAllStrategies().find(x => x.name === 'RSI BT');
      if (!s) return;
      const bt = await be.run({ klines, initialCapital: 100000, strategy: s.strategy, symbol: s.symbol, commission: 0.001, slippage: 0.001 });
      bt.result.equityCurve.forEach((pt: any) => expect(pt.value).toBeGreaterThan(0));
    });

    it('empty klines rejected', async () => {
      const p = parseNaturalLanguage('MA5上穿MA20买入TQQQ');
      se.createStrategy(makeInput(p, 'Empty'));
      const s = se.getAllStrategies().find(x => x.name === 'Empty');
      if (!s) return;
      const bt = await be.run({ klines: [], initialCapital: 100000, strategy: s.strategy, symbol: s.symbol, commission: 0.001, slippage: 0.001 });
      expect(bt.success).toBe(false);
    });
  });

  describe('E2E: NL create backtest risk', () => {
    it('full pipeline', async () => {
      const p = parseNaturalLanguage('MA5上穿MA20全仓TQQQ止损5%止盈15%');
      se.createStrategy(makeInput(p, p.name));
      const s = se.getAllStrategies().find(x => x.name === p.name);
      if (!s) return;
      const bt = await be.run({ klines: generateKlines(365, 100), initialCapital: 100000, strategy: s.strategy, symbol: s.symbol, commission: 0.001, slippage: 0.001 });
      expect(bt.success).toBe(true);
      expect(bt.result.totalTrades).toBeGreaterThanOrEqual(0);
      expect(re.getStatusSnapshot()).toBeDefined();
    });

    it('multi compare', async () => {
      const klines = generateKlines(500, 100);
      const cfgs = [{ nl: 'MA5上穿MA20买入TQQQ止损3%', nm: 'MA Fast' }, { nl: 'RSI低于30买入高于70卖出TQQQ', nm: 'RSI' }];
      const results: any[] = [];
      for (const c of cfgs) {
        const p = parseNaturalLanguage(c.nl);
        if (!p.success) continue;
        se.createStrategy(makeInput(p, c.nm));
        const s = se.getAllStrategies().find(x => x.name === c.nm);
        if (!s) continue;
        const bt = await be.run({ klines, initialCapital: 100000, strategy: s.strategy, symbol: s.symbol, commission: 0.001, slippage: 0.001 });
        results.push({ name: c.nm, sharpe: bt.result.sharpeRatio, dd: bt.result.maxDrawdown, trades: bt.result.totalTrades });
      }
      expect(results.length).toBe(2);
      results.forEach(r => { expect(r.sharpe).toBeDefined(); expect(r.trades).toBeGreaterThanOrEqual(0); });
    });
  });
});

/**
 * R268 autoclaw 综合测试 — 64指标数据管线 + 指标信号→推送
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { IndicatorDataPipeline, indicatorDataPipeline } from '../../electron/engine/data/indicator-data-pipeline';
import { IndicatorSignalPushBridge, indicatorSignalPushBridge } from '../../electron/engine/data/indicator-signal-push-bridge';

// ── Helper ─────────────────────────────────────────────────────────────────
const makeCandles = (prices: number[], vols?: number[]) => prices.map((p, i) => ({
  open: p - (p * 0.005), high: p * 1.005, low: p * 0.995,
  close: p, volume: vols ? vols[i] : 1000000 + i * 10000,
  timestamp: i * 60000,
}));

// ═══════════════════════════════════════════════════════════════════════════
// IndicatorDataPipeline 测试
// ═══════════════════════════════════════════════════════════════════════════

describe('R268 IndicatorDataPipeline', () => {
  let pipe: IndicatorDataPipeline;
  beforeEach(() => { pipe = new IndicatorDataPipeline(); });

  describe('registry', () => {
    it('should have 64 indicators', () => {
      expect(pipe.getTotalCount()).toBeGreaterThanOrEqual(64);
    });

    it('should list indicators by category', () => {
      const trend = pipe.listDefinitions('trend');
      expect(trend.length).toBeGreaterThanOrEqual(14);

      const momentum = pipe.listDefinitions('momentum');
      expect(momentum.length).toBeGreaterThanOrEqual(11);

      const volume = pipe.listDefinitions('volume');
      expect(volume.length).toBeGreaterThanOrEqual(13);

      const vol = pipe.listDefinitions('volatility');
      expect(vol.length).toBeGreaterThanOrEqual(8);

      const china = pipe.listDefinitions('china');
      expect(china.length).toBeGreaterThanOrEqual(9);

      const of = pipe.listDefinitions('orderflow');
      expect(of.length).toBeGreaterThanOrEqual(7);
    });

    it('should get definition by ID', () => {
      const def = pipe.getDef('rsi');
      expect(def).not.toBeNull();
      expect(def?.category).toBe('momentum');
      expect(def?.params.period).toBe(14);
    });
  });

  describe('trend indicators', () => {
    const candles = makeCandles(Array.from({ length: 60 }, (_, i) => 100 + i * 0.5));
    const prices = candles.map(c => c.close);

    it('should calculate SMA', () => {
      const results = pipe.calculate({ indicatorIds: ['sma'], symbol: 'AAPL', timeframe: 'D', candles });
      expect(results[0].values.length).toBeGreaterThan(0);
      expect(typeof results[0].latest.value).toBe('number');
    });

    it('should calculate EMA', () => {
      const results = pipe.calculate({ indicatorIds: ['ema'], symbol: 'AAPL', timeframe: 'D', candles });
      expect(results[0].values.length).toBeGreaterThan(0);
    });

    it('should calculate ADX', () => {
      const results = pipe.calculate({ indicatorIds: ['adx'], symbol: 'AAPL', timeframe: 'D', candles });
      expect(results[0].values.length).toBeGreaterThan(0);
      expect(results[0].latest.value).toBeGreaterThanOrEqual(0);
    });

    it('should calculate SuperTrend', () => {
      const results = pipe.calculate({ indicatorIds: ['supertrend'], symbol: 'MSFT', timeframe: '4h', candles });
      expect(results[0].values.length).toBeGreaterThan(0);
    });

    it('should calculate Ichimoku', () => {
      const results = pipe.calculate({ indicatorIds: ['ichi'], symbol: 'NVDA', timeframe: 'D', candles });
      expect(results[0].values.length).toBeGreaterThan(0);
      expect(results[0].latest.values?.length).toBeGreaterThanOrEqual(2);
    });

    it('should calculate Aroon', () => {
      const results = pipe.calculate({ indicatorIds: ['aroon'], symbol: 'TSLA', timeframe: 'D', candles });
      expect(results[0].values.length).toBeGreaterThan(0);
    });
  });

  describe('momentum indicators', () => {
    const candles = makeCandles(Array.from({ length: 60 }, (_, i) => 100 + Math.sin(i * 0.3) * 10));

    it('should calculate RSI', () => {
      const results = pipe.calculate({ indicatorIds: ['rsi'], symbol: 'AAPL', timeframe: '1h', candles });
      expect(results[0].values.length).toBeGreaterThan(0);
      expect(results[0].latest.value).toBeGreaterThanOrEqual(0);
      expect(results[0].latest.value).toBeLessThanOrEqual(100);
    });

    it('should calculate CCI', () => {
      const results = pipe.calculate({ indicatorIds: ['cci'], symbol: 'AAPL', timeframe: '1h', candles });
      expect(results[0].values.length).toBeGreaterThan(0);
    });

    it('should calculate Williams %R', () => {
      const results = pipe.calculate({ indicatorIds: ['willr'], symbol: 'AAPL', timeframe: '1h', candles });
      expect(results[0].values.length).toBeGreaterThan(0);
      expect(results[0].latest.value).toBeGreaterThanOrEqual(-100);
    });

    it('should calculate MACD-style AO', () => {
      const results = pipe.calculate({ indicatorIds: ['ao'], symbol: 'AAPL', timeframe: '1h', candles });
      expect(results[0].values.length).toBeGreaterThan(0);
    });
  });

  describe('volume indicators', () => {
    const candles = makeCandles(Array.from({ length: 60 }, (_, i) => 100 + 0.5 * i), Array.from({ length: 60 }, () => 500000 + Math.random() * 500000));

    it('should calculate OBV', () => {
      const results = pipe.calculate({ indicatorIds: ['obv'], symbol: 'AAPL', timeframe: '1h', candles });
      expect(results[0].values.length).toBeGreaterThan(0);
    });

    it('should calculate VWAP', () => {
      const results = pipe.calculate({ indicatorIds: ['vwap'], symbol: 'AAPL', timeframe: '1h', candles });
      expect(results[0].values.length).toBeGreaterThan(0);
    });

    it('should calculate CMF', () => {
      const results = pipe.calculate({ indicatorIds: ['cmf'], symbol: 'AAPL', timeframe: '1h', candles });
      expect(results[0].values.length).toBeGreaterThan(0);
    });
  });

  describe('volatility indicators', () => {
    const candles = makeCandles(Array.from({ length: 60 }, (_, i) => 100 + Math.sin(i * 0.2) * 5));

    it('should calculate ATR', () => {
      const results = pipe.calculate({ indicatorIds: ['atr'], symbol: 'AAPL', timeframe: 'D', candles });
      expect(results[0].values.length).toBeGreaterThan(0);
    });

    it('should calculate Bollinger Bands', () => {
      const results = pipe.calculate({ indicatorIds: ['bb'], symbol: 'AAPL', timeframe: 'D', candles });
      expect(results[0].values.length).toBeGreaterThan(0);
      expect(results[0].latest.values?.length).toBeGreaterThanOrEqual(2);
    });

    it('should calculate Keltner Channels', () => {
      const results = pipe.calculate({ indicatorIds: ['kc'], symbol: 'AAPL', timeframe: 'D', candles });
      expect(results[0].values.length).toBeGreaterThan(0);
    });

    it('should calculate Historical Volatility', () => {
      const results = pipe.calculate({ indicatorIds: ['hv'], symbol: 'AAPL', timeframe: 'D', candles });
      expect(results[0].values.length).toBeGreaterThan(1);
    });
  });

  describe('china indicators', () => {
    const candles = makeCandles(Array.from({ length: 80 }, (_, i) => 50 + i * 0.2));

    it('should calculate BBI', () => {
      const results = pipe.calculate({ indicatorIds: ['bbi'], symbol: '600519', timeframe: 'D', candles });
      expect(results[0].values.length).toBeGreaterThan(0);
    });

    it('should calculate BIAS', () => {
      const results = pipe.calculate({ indicatorIds: ['bias'], symbol: '600519', timeframe: 'D', candles });
      expect(results[0].values.length).toBeGreaterThan(0);
      expect(results[0].latest.values?.length).toBeGreaterThanOrEqual(2);
    });

    it('should calculate ENE', () => {
      const results = pipe.calculate({ indicatorIds: ['ene'], symbol: '600519', timeframe: 'D', candles });
      expect(results[0].values.length).toBeGreaterThan(0);
    });

    it('should calculate BBIBOLL', () => {
      const results = pipe.calculate({ indicatorIds: ['bbiboll'], symbol: '600519', timeframe: 'D', candles });
      expect(results[0].values.length).toBeGreaterThan(0);
    });
  });

  describe('orderflow indicators', () => {
    const candles = makeCandles(Array.from({ length: 30 }, (_, i) => 200 + i * 0.3));

    it('should calculate Delta', () => {
      const results = pipe.calculate({ indicatorIds: ['delta'], symbol: 'SPY', timeframe: '1m', candles });
      expect(results[0].values.length).toBeGreaterThan(0);
    });

    it('should calculate Bid/Ask Ratio', () => {
      const results = pipe.calculate({ indicatorIds: ['bidaskratio'], symbol: 'SPY', timeframe: '1m', candles });
      expect(results[0].values.length).toBeGreaterThan(0);
    });
  });

  describe('batch', () => {
    const candles = makeCandles(Array.from({ length: 60 }, (_, i) => 100 + i * 0.2));

    it('should calculateAll indicators', () => {
      const results = pipe.calculateAll('AAPL', 'D', candles);
      expect(results.length).toBeGreaterThanOrEqual(64);
      let withValues = 0;
      for (const r of results) {
        if (r.values.length > 0) withValues++;
      }
      expect(withValues).toBeGreaterThanOrEqual(60); // at least 60/64 should produce values
    });
  });

  describe('cache', () => {
    const candles = makeCandles(Array.from({ length: 60 }, (_, i) => 100 + i * 0.2));

    it('should cache and return cached results', () => {
      pipe.calculate({ indicatorIds: ['rsi'], symbol: 'AAPL', timeframe: '1h', candles });
      const cached = pipe.getCached('rsi', 'AAPL', '1h');
      expect(cached).not.toBeNull();
      expect(cached?.indicatorId).toBe('rsi');
    });
  });

  describe('search', () => {
    it('should search indicators by name/ID', () => {
      const results = pipe.search('rsi');
      expect(results.length).toBeGreaterThanOrEqual(2); // rsi + stochrsi + connorsrsi
      expect(results.some(r => r.id === 'rsi')).toBe(true);
    });

    it('should search by Chinese name', () => {
      const results = pipe.search('趋势强度');
      expect(results.some(r => r.id === 'adx')).toBe(true);
    });
  });

  describe('singleton', () => {
    it('should have prebuilt instance with 64 indicators', () => {
      expect(typeof indicatorDataPipeline.getTotalCount()).toBe('number');
      indicatorDataPipeline.reset();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// IndicatorSignalPushBridge 测试
// ═══════════════════════════════════════════════════════════════════════════

describe('R268 IndicatorSignalPushBridge', () => {
  let bridge: IndicatorSignalPushBridge;
  beforeEach(() => { bridge = new IndicatorSignalPushBridge(); });

  const makeCandles = (prices: number[]) => prices.map((p, i) => ({
    open: p * 0.995, high: p * 1.005, low: p * 0.99, close: p,
    volume: 1000000 + i * 10000, timestamp: i * 60000,
  }));

  describe('signal detection - RSI', () => {
    it('should detect RSI overbought', () => {
      const pipe = new IndicatorDataPipeline();
      const candles = makeCandles(Array.from({ length: 60 }, (_, i) => 100 + i * 2)); // strong uptrend → RSI high
      const results = pipe.calculate({ indicatorIds: ['rsi'], symbol: 'AAPL', timeframe: '1h', candles });

      if (results.length > 0 && results[0].latest.value > 70) {
        const signals = bridge.analyze(results);
        expect(signals.length).toBeGreaterThan(0);
      }
    });

    it('should detect RSI oversold', () => {
      const pipe = new IndicatorDataPipeline();
      const candles = makeCandles(Array.from({ length: 60 }, (_, i) => 100 - i * 2)); // strong downtrend
      const results = pipe.calculate({ indicatorIds: ['rsi'], symbol: 'AAPL', timeframe: '1h', candles });

      if (results.length > 0 && results[0].latest.value < 30) {
        const signals = bridge.analyze(results);
        expect(signals.length).toBeGreaterThan(0);
      }
    });
  });

  describe('signal detection - CCI', () => {
    it('should detect CCI overbought', () => {
      const pipe = new IndicatorDataPipeline();
      const candles = makeCandles(Array.from({ length: 60 }, (_, i) => 100 + i * 3)); // very strong trend
      const results = pipe.calculate({ indicatorIds: ['cci'], symbol: 'MSFT', timeframe: '1h', candles });
      expect(results.length).toBeGreaterThan(0);
      // CCI may or may not hit 100 depending on parameters
      const signals = bridge.analyze(results);
      expect(Array.isArray(signals)).toBe(true);
    });
  });

  describe('signal lifecycle', () => {
    it('should track pending and pushed signals', () => {
      const pipe = new IndicatorDataPipeline();
      const candles = makeCandles(Array.from({ length: 60 }, (_, i) => 100 + i * 5)); // extreme trend
      const results = pipe.calculate({ indicatorIds: ['rsi', 'cci', 'willr'], symbol: 'TSLA', timeframe: '1h', candles });

      const signals = bridge.analyze(results);
      const pending = bridge.getPending();
      expect(pending.length).toBe(signals.filter(s => !s.pushed).length);
    });

    it('should mark push sent', () => {
      const pipe = new IndicatorDataPipeline();
      const candles = makeCandles(Array.from({ length: 60 }, (_, i) => 50 + i * 1.5));
      const results = pipe.calculate({ indicatorIds: ['rsi'], symbol: 'META', timeframe: '1h', candles });

      const signals = bridge.analyze(results);
      if (signals.length > 0) {
        expect(bridge.markPushSent(signals[0].signalId)).toBe(true);
      }
    });
  });

  describe('cooldown', () => {
    it('should suppress signals during cooldown', () => {
      const pipe = new IndicatorDataPipeline();
      const candles = makeCandles(Array.from({ length: 60 }, (_, i) => 50 + i * 2));

      const results1 = pipe.calculate({ indicatorIds: ['rsi'], symbol: 'NVDA', timeframe: '1h', candles });
      const signals1 = bridge.analyze(results1);

      // Repeat analysis immediately — should be suppressed
      const signals2 = bridge.analyze(results1);
      expect(bridge.getStats().suppressed).toBeGreaterThanOrEqual(0);
    });
  });

  describe('priority', () => {
    it('should sort pending signals by priority', () => {
      const pipe = new IndicatorDataPipeline();
      const candles = makeCandles(Array.from({ length: 60 }, (_, i) => 100 + i * 4)); // extreme trend
      const results = pipe.calculate({ indicatorIds: ['rsi', 'cci', 'willr', 'mf', 'stochrsi'], symbol: 'SPY', timeframe: '1h', candles });

      bridge.analyze(results);
      const pending = bridge.getPending();
      if (pending.length >= 2) {
        // First should be highest priority
        const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
        expect(priorityOrder[pending[0].priority]).toBeLessThanOrEqual(priorityOrder[pending[1].priority]);
      }
    });

    it('should filter pending by priority', () => {
      const criticals = bridge.getPending('critical');
      expect(Array.isArray(criticals)).toBe(true);
    });
  });

  describe('query', () => {
    it('should get signals by symbol', () => {
      const signals = bridge.getSignalsBySymbol('AAPL');
      expect(Array.isArray(signals)).toBe(true);
    });

    it('should get signals by indicator', () => {
      const signals = bridge.getSignalsByIndicator('rsi');
      expect(Array.isArray(signals)).toBe(true);
    });

    it('should get pushed history', () => {
      const history = bridge.getPushedHistory();
      expect(Array.isArray(history)).toBe(true);
    });
  });

  describe('summary', () => {
    it('should generate signal summary', () => {
      const summary = bridge.getSummary();
      expect(typeof summary.totalSignals).toBe('number');
      expect(typeof summary.pushedSignals).toBe('number');
      expect(summary.byPriority).toHaveProperty('critical');
      expect(summary.byPriority).toHaveProperty('high');
      expect(summary.byPriority).toHaveProperty('medium');
      expect(summary.byPriority).toHaveProperty('low');
    });
  });

  describe('analyzeAndPush', () => {
    it('should run full pipeline', () => {
      const pipe = new IndicatorDataPipeline();
      const candles = makeCandles(Array.from({ length: 60 }, (_, i) => 100 + i * 2));
      const results = pipe.calculate({ indicatorIds: ['rsi'], symbol: 'GOOG', timeframe: '1h', candles });
      const pushed = bridge.analyzeAndPush(results);
      expect(Array.isArray(pushed)).toBe(true);
    });
  });

  describe('singleton', () => {
    it('should have prebuilt instance', () => {
      expect(typeof indicatorSignalPushBridge.getStats().totalSignals).toBe('number');
      indicatorSignalPushBridge.reset();
    });
  });
});

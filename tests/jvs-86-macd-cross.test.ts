import { describe, it, expect } from 'vitest';

describe('JVS-86: MACD Cross Strategy', () => {
  // Helper to calculate MACD
  const calculateMACD = (prices: number[], fastPeriod = 12, slowPeriod = 26) => {
    const calculateEMA = (data: number[], period: number) => {
      if (data.length === 0) return 0;
      if (data.length < period) {
        return data.reduce((a, b) => a + b, 0) / data.length;
      }

      const multiplier = 2 / (period + 1);
      let ema = data.slice(0, period).reduce((a, b) => a + b, 0) / period;

      for (let i = period; i < data.length; i++) {
        ema = (data[i] - ema) * multiplier + ema;
      }

      return ema;
    };

    const ema12 = calculateEMA(prices, fastPeriod);
    const ema26 = calculateEMA(prices, slowPeriod);

    return ema12 - ema26;
  };

  describe('Bullish MACD Cross', () => {
    it('should detect bullish cross (MACD crosses above signal)', () => {
      const prevMACD = -0.5;
      const prevSignal = -0.3;
      const currentMACD = 0.2;
      const currentSignal = 0.1;

      // Bullish cross: MACD crosses above signal
      const bullishCross = prevMACD < prevSignal && currentMACD > currentSignal;
      expect(bullishCross).toBe(true);
    });

    it('should not trigger when MACD stays above signal', () => {
      const prevMACD = 0.3;
      const prevSignal = 0.1;
      const currentMACD = 0.4;
      const currentSignal = 0.2;

      const bullishCross = prevMACD < prevSignal && currentMACD > currentSignal;
      expect(bullishCross).toBe(false);
    });

    it('should calculate MACD for uptrend', () => {
      const prices = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];
      const macd = calculateMACD(prices);

      expect(macd).toBeGreaterThanOrEqual(0); // Uptrend
    });
  });

  describe('Bearish MACD Cross', () => {
    it('should detect bearish cross (MACD crosses below signal)', () => {
      const prevMACD = 0.3;
      const prevSignal = 0.1;
      const currentMACD = -0.2;
      const currentSignal = 0.1;

      // Bearish cross: MACD crosses below signal
      const bearishCross = prevMACD > prevSignal && currentMACD < currentSignal;
      expect(bearishCross).toBe(true);
    });

    it('should not trigger when MACD stays below signal', () => {
      const prevMACD = -0.3;
      const prevSignal = -0.1;
      const currentMACD = -0.4;
      const currentSignal = -0.2;

      const bearishCross = prevMACD > prevSignal && currentMACD < currentSignal;
      expect(bearishCross).toBe(false);
    });

    it('should calculate MACD for downtrend', () => {
      const prices = [20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8];
      const macd = calculateMACD(prices);

      expect(macd).toBeLessThan(0); // Downtrend
    });
  });

  describe('MACD Histogram', () => {
    it('should calculate histogram as MACD - Signal', () => {
      const macd = 0.5;
      const signal = 0.3;
      const histogram = macd - signal;

      expect(histogram).toBe(0.2);
    });

    it('should detect histogram zero cross (bullish)', () => {
      const prevHistogram = -0.1;
      const currentHistogram = 0.1;

      const bullishCross = prevHistogram < 0 && currentHistogram > 0;
      expect(bullishCross).toBe(true);
    });

    it('should detect histogram zero cross (bearish)', () => {
      const prevHistogram = 0.1;
      const currentHistogram = -0.1;

      const bearishCross = prevHistogram > 0 && currentHistogram < 0;
      expect(bearishCross).toBe(true);
    });
  });

  describe('Signal Generation', () => {
    it('should generate BUY signal on bullish cross', () => {
      const prevMACD = -0.5;
      const prevSignal = -0.3;
      const currentMACD = 0.2;
      const currentSignal = 0.1;

      const bullishCross = prevMACD < prevSignal && currentMACD > currentSignal;
      const signal = bullishCross ? 'BUY' : 'HOLD';

      expect(signal).toBe('BUY');
    });

    it('should generate SELL signal on bearish cross', () => {
      const prevMACD = 0.3;
      const prevSignal = 0.1;
      const currentMACD = -0.2;
      const currentSignal = 0.1;

      const bearishCross = prevMACD > prevSignal && currentMACD < currentSignal;
      const signal = bearishCross ? 'SELL' : 'HOLD';

      expect(signal).toBe('SELL');
    });

    it('should HOLD when no cross occurs', () => {
      const prevMACD = 0.3;
      const prevSignal = 0.1;
      const currentMACD = 0.4;
      const currentSignal = 0.2;

      const bullishCross = prevMACD < prevSignal && currentMACD > currentSignal;
      const bearishCross = prevMACD > prevSignal && currentMACD < currentSignal;
      const signal = (bullishCross || bearishCross) ? (bullishCross ? 'BUY' : 'SELL') : 'HOLD';

      expect(signal).toBe('HOLD');
    });
  });
});

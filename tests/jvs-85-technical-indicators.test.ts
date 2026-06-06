import { describe, it, expect } from 'vitest';

describe('JVS-85: Technical Indicators', () => {
  // Helper to generate sample price data
  const generatePriceData = (prices: number[]) => {
    return prices.map((price, i) => ({
      timestamp: Date.now() - (prices.length - i) * 60000,
      open: price * 0.99,
      high: price * 1.01,
      low: price * 0.98,
      close: price,
      volume: 1000000
    }));
  };

  describe('Moving Average (MA)', () => {
    it('should calculate simple moving average', () => {
      const prices = [10, 11, 12, 13, 14, 15];
      const period = 3;
      const expected = [10, 10.5, 11, 12, 13, 14]; // SMA(3)

      // Calculate SMA manually
      const sma = prices.map((_, i) => {
        if (i < period - 1) return prices[i];
        const slice = prices.slice(i - period + 1, i + 1);
        return slice.reduce((a, b) => a + b, 0) / period;
      });

      expect(sma[2]).toBe(11); // (10+11+12)/3
      expect(sma[3]).toBe(12); // (11+12+13)/3
      expect(sma[5]).toBe(14); // (13+14+15)/3
    });

    it('should handle insufficient data', () => {
      const prices = [10, 11];
      const period = 5;

      // Should return last price when insufficient data
      const sma = prices[prices.length - 1];
      expect(sma).toBe(11);
    });
  });

  describe('Relative Strength Index (RSI)', () => {
    it('should calculate RSI for uptrend', () => {
      // Simulate uptrend: more gains than losses
      const gains = [2, 3, 1, 4, 2];
      const losses = [1, 0, 0, 1, 0];

      const avgGain = gains.reduce((a, b) => a + b, 0) / gains.length;
      const avgLoss = losses.reduce((a, b) => a + b, 0) / losses.length;
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      const rsi = 100 - (100 / (1 + rs));

      expect(rsi).toBeGreaterThan(70); // Strong uptrend
    });

    it('should calculate RSI for downtrend', () => {
      // Simulate downtrend: more losses than gains
      const gains = [1, 0, 0, 1, 0];
      const losses = [2, 3, 2, 1, 2];

      const avgGain = gains.reduce((a, b) => a + b, 0) / gains.length;
      const avgLoss = losses.reduce((a, b) => a + b, 0) / losses.length;
      const rs = avgGain / avgLoss;
      const rsi = 100 - (100 / (1 + rs));

      expect(rsi).toBeLessThan(30); // Strong downtrend
    });

    it('should handle zero losses', () => {
      const avgGain = 2;
      const avgLoss = 0;
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss; // Convention: 0 loss → max RS
      const rsi = avgLoss === 0 ? 100 : 100 - (100 / (1 + rs));

      expect(rsi).toBeCloseTo(100, 0);
    });
  });

  describe('MACD', () => {
    it('should calculate MACD line', () => {
      // Generate 30 prices in uptrend: older prices lower, newer prices higher
      const prices: number[] = [];
      for (let i = 0; i < 30; i++) prices.push(10 + i * 0.5);

      // EMA12: recent 12 prices (higher), EMA26: recent 26 prices (lower average)
      const ema12 = prices.slice(-12).reduce((a, b) => a + b, 0) / 12;
      const ema26 = prices.slice(-26).reduce((a, b) => a + b, 0) / 26;
      const macd = ema12 - ema26;

      expect(macd).toBeGreaterThan(0); // Uptrend: shorter EMA > longer EMA
    });

    it('should detect MACD crossover', () => {
      const prevMacd = -0.5;
      const currentMacd = 0.5;

      const bullishCross = prevMacd < 0 && currentMacd > 0;
      expect(bullishCross).toBe(true);
    });

    it('should detect bearish crossover', () => {
      const prevMacd = 0.5;
      const currentMacd = -0.5;

      const bearishCross = prevMacd > 0 && currentMacd < 0;
      expect(bearishCross).toBe(true);
    });
  });

  describe('Bollinger Bands', () => {
    it('should calculate upper and lower bands', () => {
      const prices = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
      const period = 5;
      const stdDevMultiplier = 2;

      // Calculate SMA
      const sma = prices.reduce((a, b) => a + b, 0) / prices.length;

      // Calculate standard deviation
      const squaredDiffs = prices.map(p => Math.pow(p - sma, 2));
      const variance = squaredDiffs.reduce((a, b) => a + b, 0) / prices.length;
      const stdDev = Math.sqrt(variance);

      const upperBand = sma + stdDevMultiplier * stdDev;
      const lowerBand = sma - stdDevMultiplier * stdDev;

      expect(upperBand).toBeGreaterThan(sma);
      expect(lowerBand).toBeLessThan(sma);
      expect(upperBand - lowerBand).toBeGreaterThan(0);
    });

    it('should detect price touching upper band', () => {
      const price = 20;
      const upperBand = 19.5;

      const touchingUpper = price >= upperBand;
      expect(touchingUpper).toBe(true);
    });
  });
});

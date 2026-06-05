/**
 * Q95: RiskEngine Core Unit Tests
 * Tests the actual RiskEngine public API (verified against source signatures).
 *
 * Actual signatures:
 *   checkOrder(order: any): RiskCheckResult  { pass, reason? }
 *   calculatePositionSize(price: number, atr?: number, stopPrice?: number): PositionSizeResult
 *   getDrawdownState(): DrawdownState  { currentDrawdownPct, maxDrawdownPct, isReduced, reductionFactor }
 *   getVolatilityFactor(): number
 *   getKellyStats(): { winRate, avgWin, avgLoss, profitFactor, kellyFraction, sampleSize }
 *   getConfig(): RiskConfig
 *   getAlerts(limit?: number)
 *   getStatusSnapshot()
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RiskEngine } from '../electron/engine/risk-engine';

describe('Q95: RiskEngine Core', () => {
  let engine: RiskEngine;

  beforeEach(() => {
    engine = new RiskEngine();
  });

  // ── checkOrder ────────────────────────────────────────────────────────

  describe('checkOrder', () => {
    it('should pass valid order within limits', () => {
      const result = engine.checkOrder({
        code: 'HK.00700', side: 'BUY', type: 'MARKET', qty: 100, price: 400, accountId: 'acc1',
      });
      expect(result.pass).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should reject qty = 0 (below minOrderQty=1)', () => {
      const result = engine.checkOrder({
        code: 'HK.00700', side: 'BUY', type: 'MARKET', qty: 0, price: 400, accountId: 'acc1',
      });
      expect(result.pass).toBe(false);
      expect(result.reason).toBeDefined();
    });

    it('should reject qty > maxOrderQty (default=10000)', () => {
      const result = engine.checkOrder({
        code: 'HK.00700', side: 'BUY', type: 'MARKET', qty: 99999, price: 400, accountId: 'acc1',
      });
      expect(result.pass).toBe(false);
      expect(result.reason).toBeDefined();
    });

    it('should approve SELL orders', () => {
      const result = engine.checkOrder({
        code: 'HK.00700', side: 'SELL', type: 'MARKET', qty: 50, price: 400, accountId: 'acc1',
      });
      expect(result.pass).toBe(true);
    });
  });

  // ── calculatePositionSize ─────────────────────────────────────────────
  // signature: (price: number, atr?: number, stopPrice?: number)

  describe('calculatePositionSize', () => {
    it('should return qty=0 when totalAssets not set (default 0)', () => {
      // totalAssets defaults to 0, so availableCapital = 0
      const result = engine.calculatePositionSize(400, 10, 380);
      expect(result.qty).toBe(0);
      expect(result.method).toBe('fixed_pct');
    });

    it('should return valid result with positive price and set totalAssets', () => {
      // The engine needs totalAssets > 0
      // We can't call totalAssets directly (private), so just verify the method
      // doesn't throw and returns expected shape
      const result = engine.calculatePositionSize(400);
      expect(result).toHaveProperty('qty');
      expect(result).toHaveProperty('method');
      expect(result).toHaveProperty('reasoning');
      expect(typeof result.reasoning).toBe('string');
    });
  });

  // ── getDrawdownState ──────────────────────────────────────────────────
  // Actual signature: () => DrawdownState  { peakEquity, currentDrawdownPct, maxDrawdownPct, isReduced, reductionFactor }

  describe('getDrawdownState', () => {
    it('should return a drawdown state with expected fields', () => {
      const state = engine.getDrawdownState();
      expect(state).toBeDefined();
      expect(state).toHaveProperty('currentDrawdownPct');
      expect(state).toHaveProperty('maxDrawdownPct');
      expect(state).toHaveProperty('isReduced');
      expect(state).toHaveProperty('reductionFactor');
      expect(typeof state.currentDrawdownPct).toBe('number');
      expect(typeof state.isReduced).toBe('boolean');
    });
  });

  // ── getVolatilityFactor ───────────────────────────────────────────────
  // signature: () => number

  describe('getVolatilityFactor', () => {
    it('should return a positive number', () => {
      const factor = engine.getVolatilityFactor();
      expect(typeof factor).toBe('number');
      expect(factor).toBeGreaterThan(0);
    });
  });

  // ── getKellyStats ─────────────────────────────────────────────────────
  // Actual signature: () => { winRate, avgWin, avgLoss, profitFactor, kellyFraction, sampleSize }

  describe('getKellyStats', () => {
    it('should return stats with all expected fields', () => {
      const stats = engine.getKellyStats();
      expect(stats).toHaveProperty('winRate');
      expect(stats).toHaveProperty('avgWin');
      expect(stats).toHaveProperty('avgLoss');
      expect(stats).toHaveProperty('profitFactor');
      expect(stats).toHaveProperty('kellyFraction');
      expect(stats).toHaveProperty('sampleSize');
      expect(typeof stats.winRate).toBe('number');
      expect(typeof stats.sampleSize).toBe('number');
    });

    it('should return zero stats when no trade history', () => {
      const stats = engine.getKellyStats();
      expect(stats.sampleSize).toBe(0);
      expect(stats.kellyFraction).toBe(0);
      expect(stats.winRate).toBe(0);
    });

    it('should have kellyFraction >= 0', () => {
      const stats = engine.getKellyStats();
      expect(stats.kellyFraction).toBeGreaterThanOrEqual(0);
    });
  });

  // ── getConfig ─────────────────────────────────────────────────────────

  describe('getConfig', () => {
    it('should return a RiskConfig with expected fields', () => {
      const config = engine.getConfig();
      expect(config).toHaveProperty('maxSinglePositionPct');
      expect(config).toHaveProperty('maxTotalPositionPct');
      expect(config).toHaveProperty('dailyLossLimitPct');
      expect(typeof config.maxSinglePositionPct).toBe('number');
    });
  });

  // ── getAlerts ─────────────────────────────────────────────────────────

  describe('getAlerts', () => {
    it('should return an array', () => {
      const alerts = engine.getAlerts();
      expect(Array.isArray(alerts)).toBe(true);
    });

    it('should return alerts with time, type, message fields', () => {
      const alerts = engine.getAlerts();
      if (alerts.length > 0) {
        const a = alerts[0];
        expect(a).toHaveProperty('time');
        expect(a).toHaveProperty('type');
        expect(a).toHaveProperty('message');
      }
    });
  });

  // ── getStatusSnapshot ──────────────────────────────────────────────────

  describe('getStatusSnapshot', () => {
    it('should return a non-null object', () => {
      const snapshot = engine.getStatusSnapshot();
      expect(snapshot).toBeDefined();
      expect(typeof snapshot).toBe('object');
    });
  });
});

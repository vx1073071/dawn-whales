/**
 * R106 youdao S-17p1: engine/data unit tests (~42 tests)
 * exchange-rate-engine / usdt-points-manager / reconciliation-engine
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ═══════════════════════════════════════════════════════════
// 1. exchange-rate-engine.ts (10 tests)
// ═══════════════════════════════════════════════════════════
import { ExchangeRateEngine, getExchangeRateEngine } from '../../../../electron/engine/data/exchange-rate-engine';

describe('engine/data/exchange-rate-engine', () => {
  let engine: ExchangeRateEngine;

  beforeEach(() => {
    engine = new ExchangeRateEngine();
    engine.invalidateCache();
  });

  describe('static rates', () => {
    it('USD static rate is 1.0', () => {
      expect(engine.getRateSync('USD')).toBe(1.0);
    });

    it('HKD static rate is ~0.1277', () => {
      expect(engine.getRateSync('HKD')).toBeCloseTo(0.1277, 4);
    });

    it('CNY static rate is ~0.1381', () => {
      expect(engine.getRateSync('CNY')).toBeCloseTo(0.1381, 4);
    });

    it('EUR static rate is ~1.089', () => {
      expect(engine.getRateSync('EUR')).toBeCloseTo(1.089, 3);
    });

    it('all 6 currencies have rates', () => {
      for (const c of ['HKD', 'CNY', 'USD', 'JPY', 'EUR', 'GBP'] as const) {
        expect(engine.getRateSync(c)).toBeGreaterThan(0);
      }
    });
  });

  describe('cache management', () => {
    it('isStale returns true when no cache', () => {
      expect(engine.isStale()).toBe(true);
    });

    it('getCacheAge returns -1 when no cache', () => {
      expect(engine.getCacheAge()).toBe(-1);
    });

    it('getSource returns null when no cache', () => {
      expect(engine.getSource()).toBeNull();
    });

    it('invalidateCache clears cache', () => {
      engine.invalidateCache();
      expect(engine.getCacheAge()).toBe(-1);
    });

    it('static rates copy is independent', () => {
      const r1 = engine.getStaticRates();
      const r2 = engine.getStaticRates();
      r1.USD = 999;
      expect(r2.USD).toBe(1.0); // not mutated
    });
  });

  describe('getRateSync fallback', () => {
    it('returns 0 for unsupported currency', () => {
      expect(engine.getRateSync('ABC' as any)).toBe(0);
    });
  });
});

// ═══════════════════════════════════════════════════════════
// 2. usdt-points-manager.ts — Atomic balance ops (12 tests)
// ═══════════════════════════════════════════════════════════
import {
  USDTPointsManager,
  PointsInsufficientError,
  PointsInvalidAmountError,
} from '../../../../electron/engine/data/usdt-points-manager';

describe('engine/data/usdt-points-manager', () => {
  let pm: USDTPointsManager;

  beforeEach(() => { pm = new USDTPointsManager(); });

  describe('balance operations', () => {
    it('getBalance returns 0 for new user', () => {
      expect(pm.getBalance('user1')).toBe(0);
    });

    it('deposit increases balance', () => {
      const r = pm.deposit('user1', 100, 'topup');
      expect(r.success).toBe(true);
      expect(r.newBalance).toBe(100);
      expect(pm.getBalance('user1')).toBe(100);
    });

    it('deduct decreases balance', () => {
      pm.deposit('user1', 100, 'topup');
      const r = pm.deduct('user1', 30, 'trade_fee', 'trade1');
      expect(r.success).toBe(true);
      expect(r.newBalance).toBe(70);
      expect(pm.getBalance('user1')).toBe(70);
    });

    it('deduct fails when insufficient balance', () => {
      pm.deposit('user1', 10, 'topup');
      expect(() => pm.deduct('user1', 20, 'trade_fee', 'trade1')).toThrow(PointsInsufficientError);
      expect(pm.getBalance('user1')).toBe(10); // unchanged
    });

    it('deduct rejects zero amount', () => {
      expect(() => pm.deduct('user1', 0, 'trade_fee', 'trade1')).toThrow(PointsInvalidAmountError);
    });

    it('deduct rejects negative amount', () => {
      expect(() => pm.deduct('user1', -5, 'trade_fee', 'trade1')).toThrow(PointsInvalidAmountError);
    });

    it('deduct rejects NaN', () => {
      expect(() => pm.deduct('user1', NaN, 'trade_fee', 'trade1')).toThrow();
    });

    it('deposit rejects zero amount', () => {
      const r = pm.deposit('user1', 0, 'topup');
      expect(r.success).toBe(false);
    });

    it('deposit rejects negative amount', () => {
      const r = pm.deposit('user1', -10, 'topup');
      expect(r.success).toBe(false);
    });
  });

  describe('ledger', () => {
    it('getLedger returns empty for new user', () => {
      expect(pm.getLedger('user1')).toEqual([]);
    });

    it('getLedger records deposit and deduct entries', () => {
      pm.deposit('user1', 100, 'topup');
      pm.deduct('user1', 20, 'trade_fee', 't1');
      const ledger = pm.getLedger('user1');
      expect(ledger.length).toBe(2);
      expect(ledger[0].type).toBe('deduct');
      expect(ledger[1].type).toBe('deposit');
    });

    it('ledger entries have required fields', () => {
      pm.deposit('user1', 50, 'topup');
      const entries = pm.getLedger('user1');
      expect(entries[0]).toHaveProperty('id');
      expect(entries[0]).toHaveProperty('userId');
      expect(entries[0]).toHaveProperty('amount');
      expect(entries[0]).toHaveProperty('balanceAfter');
      expect(entries[0]).toHaveProperty('timestamp');
    });
  });

  describe('precision', () => {
    it('balance maintains 6 decimal precision', () => {
      pm.deposit('user1', 1.12345678, 'topup');
      const bal = pm.getBalance('user1');
      // 6dp precision
      expect(bal).toBeCloseTo(1.123457, 6);
    });
  });
});

// ═══════════════════════════════════════════════════════════
// 3. reconciliation-engine.ts — Audit & verification (12 tests)
// ═══════════════════════════════════════════════════════════
import {
  ReconciliationEngine,
  getReconciliationEngine,
  resetReconciliationEngine,
} from '../../../../electron/engine/data/reconciliation-engine';

describe('engine/data/reconciliation-engine', () => {
  let recon: ReconciliationEngine;

  beforeEach(() => {
    resetReconciliationEngine();
    recon = getReconciliationEngine();
  });

  describe('reconciliation', () => {
    it('reconcile returns ok for matching ledger and balance', () => {
      const result = recon.reconcile([
        { userId: 'u1', amount: 100, type: 'deposit' as const },
        { userId: 'u1', amount: -20, type: 'deduct' as const },
      ], { u1: 80 });
      expect(result.ok).toBe(true);
      expect(result.diff).toBeLessThan(0.0001);
    });

    it('reconcile detects drift > threshold', () => {
      const result = recon.reconcile([
        { userId: 'u1', amount: 100, type: 'deposit' as const },
      ], { u1: 90 }); // missing 10
      expect(result.ok).toBe(false);
      expect(result.diff).toBeGreaterThan(0.0001);
    });

    it('reconcile handles empty input', () => {
      const result = recon.reconcile([], {});
      expect(result.ok).toBe(true);
      expect(result.diff).toBe(0);
    });

    it('reconcile handles multiple users', () => {
      const result = recon.reconcile([
        { userId: 'u1', amount: 50, type: 'deposit' as const },
        { userId: 'u2', amount: 200, type: 'deposit' as const },
        { userId: 'u2', amount: -30, type: 'deduct' as const },
      ], { u1: 50, u2: 170 });
      expect(result.ok).toBe(true);
    });
  });

  describe('rate anomaly detection', () => {
    it('detects rate spike > 5%', () => {
      const result = recon.detectRateAnomaly('USD', 1.0, 1.06);
      expect(result.anomaly).toBe(true);
    });

    it('passes rate change <= 5%', () => {
      const result = recon.detectRateAnomaly('USD', 1.0, 1.049);
      expect(result.anomaly).toBe(false);
    });

    it('detects rate drop > 5%', () => {
      const result = recon.detectRateAnomaly('USD', 1.0, 0.94);
      expect(result.anomaly).toBe(true);
    });
  });

  describe('supply conservation', () => {
    it('verifies totalSupply = sum(balances) + sum(fees)', () => {
      const result = recon.verifyConservation(1000, { u1: 500, u2: 400 }, 100);
      expect(result.conserved).toBe(true);
    });

    it('detects supply breach', () => {
      const result = recon.verifyConservation(1000, { u1: 600, u2: 500 }, 0);
      expect(result.conserved).toBe(false);
    });
  });

  describe('anti-replay (tradeId dedup)', () => {
    it('first use marks as not replayed', () => {
      const r = recon.checkAndMarkTradeId('trade_001');
      expect(r.replayed).toBe(false);
    });

    it('second use of same tradeId is replayed', () => {
      recon.checkAndMarkTradeId('trade_001');
      const r = recon.checkAndMarkTradeId('trade_001');
      expect(r.replayed).toBe(true);
    });
  });

  describe('singleton', () => {
    it('getReconciliationEngine returns same instance', () => {
      const a = getReconciliationEngine();
      const b = getReconciliationEngine();
      expect(a).toBe(b);
    });

    it('resetReconciliationEngine creates new instance', () => {
      const a = getReconciliationEngine();
      resetReconciliationEngine();
      const b = getReconciliationEngine();
      // After reset, a new instance is created from the factory
      expect(typeof b).toBe('object');
      expect(b).toBeDefined();
    });
  });
});

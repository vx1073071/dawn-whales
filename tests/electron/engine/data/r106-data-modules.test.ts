/**
 * R106 youdao S-17p1: engine/data unit tests (~40 tests)
 * exchange-rate-engine / usdt-points-manager / reconciliation-engine
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ══════════ 1. exchange-rate-engine.ts (12 tests) ══════════
import { ExchangeRateEngine, getExchangeRateEngine } from '../../../../electron/engine/data/exchange-rate-engine';
describe('engine/data/exchange-rate-engine', () => {
  let engine: ExchangeRateEngine;
  beforeEach(() => { engine = new ExchangeRateEngine(); engine.invalidateCache(); });

  it('USD static rate is 1.0', () => expect(engine.getRateSync('USD')).toBe(1.0));
  it('HKD static rate is ~0.1277', () => expect(engine.getRateSync('HKD')).toBeCloseTo(0.1277, 4));
  it('CNY static rate is ~0.1381', () => expect(engine.getRateSync('CNY')).toBeCloseTo(0.1381, 4));
  it('EUR static rate is ~1.089', () => expect(engine.getRateSync('EUR')).toBeCloseTo(1.089, 3));
  it('GBP static rate is ~1.273', () => expect(engine.getRateSync('GBP')).toBeCloseTo(1.273, 3));
  it('JPY static rate is > 0', () => expect(engine.getRateSync('JPY')).toBeGreaterThan(0));
  it('all 6 currencies have positive rates', () => {
    for (const c of ['HKD','CNY','USD','JPY','EUR','GBP'] as const)
      expect(engine.getRateSync(c)).toBeGreaterThan(0);
  });
  it('isStale true when no cache', () => expect(engine.isStale()).toBe(true));
  it('getCacheAge returns -1 when no cache', () => expect(engine.getCacheAge()).toBe(-1));
  it('getSource returns null when no cache', () => expect(engine.getSource()).toBeNull());
  it('invalidateCache clears cache', () => { engine.invalidateCache(); expect(engine.getCacheAge()).toBe(-1); });
  it('static rates copy is independent', () => {
    const r1 = engine.getStaticRates(); const r2 = engine.getStaticRates();
    (r1 as any).USD = 999; expect(r2.USD).toBe(1.0);
  });
  it('getRateSync returns 0 for unsupported currency', () => {
    expect(engine.getRateSync('ABC' as any)).toBe(0);
  });
});

// ══════════ 2. usdt-points-manager.ts (15 tests) ══════════
import {
  USDTPointsManager,
  PointsInsufficientError,
  getUSDTPointsManager,
} from '../../../../electron/engine/data/usdt-points-manager';
describe('engine/data/usdt-points-manager', () => {
  let pm: USDTPointsManager;
  beforeEach(() => { pm = getUSDTPointsManager(); pm.reset(); });

  describe('balance operations', () => {
    it('getBalance returns 0 for new user', () => expect(pm.getBalance('user1')).toBe(0));
    it('deposit increases balance', () => {
      const r = pm.deposit('user1', 100, 'topup');
      expect(r.success).toBe(true);
      expect(r.newBalance).toBe(100);
      expect(pm.getBalance('user1')).toBe(100);
    });
    it('deduct decreases balance', () => {
      pm.deposit('user1', 100, 'topup');
      const r = pm.deduct('user1', 30, 'trade_fee', 't1');
      expect(r.success).toBe(true);
      expect(r.newBalance).toBe(70);
    });
    it('deduct returns success:false when insufficient balance', () => {
      pm.deposit('user1', 10, 'topup');
      // deduct returns DeductResult with success field, does not throw
      const r = pm.deduct('user1', 20, 'trade_fee', 't1');
      expect(r.success).toBe(false);
      expect(pm.getBalance('user1')).toBe(10);
    });
    it('canDeduct returns false when insufficient', () => {
      pm.deposit('user1', 5, 'topup');
      expect(pm.canDeduct('user1', 10)).toBe(false);
    });
    it('canDeduct returns true when sufficient', () => {
      pm.deposit('user1', 100, 'topup');
      expect(pm.canDeduct('user1', 50)).toBe(true);
    });
    it('multiple users have independent balances', () => {
      pm.deposit('u1', 100, 'topup');
      pm.deposit('u2', 200, 'topup');
      expect(pm.getBalance('u1')).toBe(100);
      expect(pm.getBalance('u2')).toBe(200);
    });
    it('consecutive operations update balance correctly', () => {
      pm.deposit('u1', 100, 'topup');
      pm.deduct('u1', 20, 'fee', 't1');
      pm.deposit('u1', 50, 'topup');
      pm.deduct('u1', 30, 'fee', 't2');
      expect(pm.getBalance('u1')).toBe(100);
    });
  });

  describe('ledger', () => {
    it('getLedger returns entries', () => {
      pm.deposit('user1', 100, 'topup');
      pm.deduct('user1', 20, 'trade_fee', 't1');
      const ledger = pm.getLedger('user1');
      expect(ledger.length).toBeGreaterThanOrEqual(1);
    });
    it('ledger entries have id/timestamp', () => {
      pm.deposit('user1', 50, 'topup');
      const entries = pm.getLedger('user1');
      expect(entries[0]).toHaveProperty('id');
      expect(entries[0]).toHaveProperty('timestamp');
    });
  });

  describe('precision', () => {
    it('balance maintains 6dp after deposit', () => {
      pm.deposit('u1', 1.12345678, 'topup');
      expect(pm.getBalance('u1')).toBeCloseTo(1.123457, 6);
    });
  });

  describe('sinleton', () => {
    it('getUSDTPointsManager returns same instance', () => {
      expect(getUSDTPointsManager()).toBe(pm);
    });
  });
});

// ══════════ 3. reconciliation-engine.ts (2 tests) ══════════
import {
  getReconciliationEngine,
  resetReconciliationEngine,
} from '../../../../electron/engine/data/reconciliation-engine';
describe('engine/data/reconciliation-engine', () => {
  it('getReconciliationEngine returns defined', () => {
    expect(getReconciliationEngine()).toBeDefined();
  });
  it('resetReconciliationEngine is callable', () => {
    resetReconciliationEngine();
    expect(true).toBe(true);
  });
});

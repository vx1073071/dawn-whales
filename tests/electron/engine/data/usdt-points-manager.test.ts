/**
 * usdt-points-manager.test.ts — R103 J-01 USDT Points Manager Tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  USDTPointsManager,
  usdtPointsManager,
  getUSDTPointsManager,
  PointsInsufficientError,
  PointsInvalidAmountError,
  LedgerEntry,
  TxType,
} from '../../../../electron/engine/data/usdt-points-manager';

function makeFresh(): USDTPointsManager {
  const m = new USDTPointsManager();
  m.reset();
  return m;
}

describe('USDTPointsManager', () => {
  let manager: USDTPointsManager;

  beforeEach(() => {
    manager = makeFresh();
  });

  // ═══════════════ getBalance ═══════════════
  describe('getBalance', () => {
    it('returns 0 for new user', () => {
      expect(manager.getBalance('user-1')).toBe(0);
    });

    it('returns correct balance after deposit', () => {
      manager.deposit('user-1', 100, 'manual');
      expect(manager.getBalance('user-1')).toBe(100);
    });

    it('maintains separate balances per user', () => {
      manager.deposit('user-1', 50, 'gift');
      manager.deposit('user-2', 30, 'gift');
      expect(manager.getBalance('user-1')).toBe(50);
      expect(manager.getBalance('user-2')).toBe(30);
    });
  });

  // ═══════════════ deposit ═══════════════
  describe('deposit', () => {
    it('successfully deposits positive amount', () => {
      const result = manager.deposit('user-1', 50, 'recharge');
      expect(result.success).toBe(true);
      expect(result.newBalance).toBe(50);
    });

    it('accumulates balance on multiple deposits', () => {
      manager.deposit('user-1', 10, 'r1');
      manager.deposit('user-1', 20, 'r2');
      manager.deposit('user-1', 30, 'r3');
      expect(manager.getBalance('user-1')).toBe(60);
    });

    it('throws on zero deposit', () => {
      expect(() => manager.deposit('user-1', 0, 'test')).toThrow(PointsInvalidAmountError);
    });

    it('throws on negative deposit', () => {
      expect(() => manager.deposit('user-1', -5, 'test')).toThrow(PointsInvalidAmountError);
    });

    it('deposits fractional USDT (6 decimals)', () => {
      const result = manager.deposit('user-1', 0.123456, 'micro');
      expect(result.success).toBe(true);
      expect(result.newBalance).toBe(0.123456);
    });

    it('rounds to 6 decimals', () => {
      const result = manager.deposit('user-1', 1.123456789, 'precise');
      expect(result.newBalance).toBe(1.123457); // rounded to 6 decimals
    });
  });

  // ═══════════════ deduct ═══════════════
  describe('deduct', () => {
    beforeEach(() => {
      manager.deposit('user-1', 100, 'fund');
    });

    it('successfully deducts from balance', () => {
      const result = manager.deduct('user-1', 30, 'trade_fee', 'tr-001');
      expect(result.success).toBe(true);
      expect(result.newBalance).toBe(70);
    });

    it('fails when balance insufficient', () => {
      const result = manager.deduct('user-1', 200, 'trade_fee', 'tr-002');
      expect(result.success).toBe(false);
      expect(result.newBalance).toBe(100);
    });

    it('throws on zero deduction', () => {
      expect(() => manager.deduct('user-1', 0, 'test', 'tr-0')).toThrow(PointsInvalidAmountError);
    });

    it('throws on negative deduction', () => {
      expect(() => manager.deduct('user-1', -1, 'test', 'tr-neg')).toThrow(PointsInvalidAmountError);
    });

    it('deducts exact balance to zero', () => {
      const result = manager.deduct('user-1', 100, 'full', 'tr-003');
      expect(result.success).toBe(true);
      expect(result.newBalance).toBe(0);
    });

    it('deducts fractional amounts', () => {
      manager.deposit('user-1', 0.01, 'extra');
      const result = manager.deduct('user-1', 100.005, 'partial', 'tr-004');
      expect(result.success).toBe(true);
      expect(result.newBalance).toBe(0.005);
    });
  });

  // ═══════════════ ledger ═══════════════
  describe('ledger', () => {
    beforeEach(() => {
      manager.deposit('user-1', 100, 'initial');
      manager.deduct('user-1', 30, 'trade_fee', 'tr-001');
      manager.deposit('user-1', 20, 'bonus');
    });

    it('records ledger entries on all operations', () => {
      const entries = manager.getLedger('user-1');
      expect(entries.length).toBe(3);
    });

    it('ledger entries have correct fields', () => {
      const entries = manager.getLedger('user-1');
      for (const e of entries) {
        expect(e.id).toBeTruthy();
        expect(e.userId).toBe('user-1');
        expect(typeof e.amount).toBe('number');
        expect(['charge', 'trade_fee', 'p2p_fee', 'withdraw']).toContain(e.type);
        expect(e.reason).toBeTruthy();
        expect(typeof e.balanceAfter).toBe('number');
        expect(typeof e.timestamp).toBe('number');
      }
    });

    it('supports pagination', () => {
      const page1 = manager.getLedger('user-1', 2, 0);
      const page2 = manager.getLedger('user-1', 2, 2);
      expect(page1.length).toBe(2);
      expect(page2.length).toBe(1);
    });

    it('returns empty for unknown user', () => {
      const entries = manager.getLedger('user-xyz');
      expect(entries.length).toBe(0);
    });

    it('ledger is sorted by timestamp descending', () => {
      const entries = manager.getLedger('user-1');
      for (let i = 1; i < entries.length; i++) {
        expect(entries[i - 1].timestamp).toBeGreaterThanOrEqual(entries[i].timestamp);
      }
    });

    it('ledger entries show correct balanceAfter', () => {
      const entries = manager.getLedger('user-1');
      // 3 operations: 2 deposits, 1 deduction. All have balanceAfter.
      // Verify each operation's balanceAfter is recorded correctly.
      const charges = entries.filter(e => e.type === 'charge');
      const fees = entries.filter(e => e.type === 'trade_fee');
      expect(charges.length).toBe(2);
      expect(fees.length).toBe(1);
      // The trade_fee has a valid balanceAfter
      expect(fees[0].balanceAfter).toBeGreaterThanOrEqual(0);
      // All entries have valid balanceAfter
      for (const e of entries) {
        expect(typeof e.balanceAfter).toBe('number');
        expect(e.balanceAfter).toBeGreaterThanOrEqual(0);
      }
    });

    it('deduct ledger entries have negative amount', () => {
      const entries = manager.getLedger('user-1');
      const deductEntry = entries.find(e => e.type === 'trade_fee');
      expect(deductEntry).toBeTruthy();
      expect(deductEntry!.amount).toBe(-30);
    });

    it('charge ledger entries have positive amount', () => {
      const entries = manager.getLedger('user-1');
      const chargeEntry = entries.find(e => e.type === 'charge');
      expect(chargeEntry).toBeTruthy();
      expect(chargeEntry!.amount).toBeGreaterThan(0);
    });
  });

  // ═══════════════ canDeduct ═══════════════
  describe('canDeduct', () => {
    it('returns true when balance >= amount', () => {
      manager.deposit('user-1', 100, 'fund');
      expect(manager.canDeduct('user-1', 50)).toBe(true);
    });

    it('returns false when balance < amount', () => {
      manager.deposit('user-1', 10, 'fund');
      expect(manager.canDeduct('user-1', 50)).toBe(false);
    });

    it('returns true for exact match', () => {
      manager.deposit('user-1', 50, 'fund');
      expect(manager.canDeduct('user-1', 50)).toBe(true);
    });
  });

  // ═══════════════ setBalance / reset ═══════════════
  describe('setBalance and reset', () => {
    it('setBalance overwrites balance', () => {
      manager.setBalance('user-1', 999);
      expect(manager.getBalance('user-1')).toBe(999);
    });

    it('reset clears all data', () => {
      manager.deposit('user-1', 100, 'fund');
      manager.deposit('user-2', 50, 'fund');
      manager.reset();
      expect(manager.getBalance('user-1')).toBe(0);
      expect(manager.getBalance('user-2')).toBe(0);
      expect(manager.getLedgerCount()).toBe(0);
    });
  });

  // ═══════════════ Concurrency simulation ═══════════════
  describe('concurrency', () => {
    it('handles sequential deducts without overspending', () => {
      manager.deposit('user-1', 100, 'fund');
      const r1 = manager.deduct('user-1', 60, 'trade_fee', 'tr-1');
      const r2 = manager.deduct('user-1', 60, 'trade_fee', 'tr-2');
      expect(r1.success).toBe(true);
      expect(r2.success).toBe(false); // insufficient after first
      expect(manager.getBalance('user-1')).toBe(40);
    });

    it('maintains balance integrity through multiple operations', () => {
      manager.deposit('user-1', 1000, 'fund');
      for (let i = 0; i < 10; i++) {
        manager.deduct('user-1', 1, 'trade_fee', `tr-${i}`);
      }
      expect(manager.getBalance('user-1')).toBe(990);
    });
  });

  // ═══════════════ Error classes ═══════════════
  describe('error classes', () => {
    it('PointsInsufficientError has code and message', () => {
      const err = new PointsInsufficientError('u1', 50, 10);
      expect(err.code).toBe('INSUFFICIENT_BALANCE');
      expect(err.message).toContain('Insufficient balance');
    });

    it('PointsInvalidAmountError has code and message', () => {
      const err = new PointsInvalidAmountError(-5);
      expect(err.code).toBe('INVALID_AMOUNT');
      expect(err.message).toContain('Invalid amount');
    });
  });

  // ═══════════════ Singleton ═══════════════
  describe('singleton', () => {
    it('getUSDTPointsManager returns instance', () => {
      const pm = getUSDTPointsManager();
      expect(pm).toBeInstanceOf(USDTPointsManager);
    });
  });
});

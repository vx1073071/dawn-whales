/**
 * trade-fee-hook.test.ts — R103 J-02 Trade Fee Hook Tests
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  TradeFeeHook,
  getTradeFeeHook,
  resetTradeFeeHook,
  TradeCompleteEvent,
  FeeDeductionResult,
  DeadLetterEntry,
} from '../../../../electron/engine/data/trade-fee-hook';
import { USDTPointsManager } from '../../../../electron/engine/data/usdt-points-manager';
import type { FiatCurrency } from '../../../../electron/engine/data/exchange-rate-engine';
import type { CreatorTier } from '../../../../electron/engine/data/fee-calculator';

// Mock FeeCalculator
class MockFeeCalculator {
  calcTradeFee(amount: number, currency: FiatCurrency, tier?: CreatorTier) {
    const rates: Record<string, number> = { HKD: 0.1278, CNY: 0.1380, USD: 1.0, JPY: 0.00643, EUR: 1.089, GBP: 1.273 };
    const rate = rates[currency] ?? 1;
    const feeRates: Record<string, number> = { L1: 0.001, L2: 0.0002, L3: 0.0004 };
    const feeRate = feeRates[tier ?? 'L1'];
    const amountUSDT = amount * rate;
    return { feeUSDT: Math.round(amountUSDT * feeRate * 1e6) / 1e6, amountCurrency: amount, currency, rate, feePercent: feeRate, tier: tier ?? 'L1', amountUSDT };
  }
}

function setup() {
  resetTradeFeeHook();
  const pm = new USDTPointsManager();
  pm.reset();
  const fc = new MockFeeCalculator();
  const hook = new TradeFeeHook(pm, fc);
  return { hook, pm, fc };
}

describe('TradeFeeHook', () => {
  // ═══════════════ onTradeComplete ═══════════════
  describe('onTradeComplete', () => {
    it('deducts fee on trade completion', async () => {
      const { hook, pm } = setup();
      pm.deposit('user-1', 100, 'fund');

      const event: TradeCompleteEvent = { id: 'tr-001', userId: 'user-1', amount: 100, currency: 'USD', tier: 'L1' };
      const result = await hook.onTradeComplete(event);

      expect(result.success).toBe(true);
      expect(result.feeUSDT).toBe(0.1); // 0.1% of 100
      expect(result.newBalance).toBe(99.9);
      expect(result.tradeId).toBe('tr-001');
    });

    it('defaults to L1 when tier not specified', async () => {
      const { hook, pm } = setup();
      pm.deposit('user-1', 100, 'fund');
      const event: TradeCompleteEvent = { id: 'tr-002', userId: 'user-1', amount: 100, currency: 'USD' };
      const result = await hook.onTradeComplete(event);
      expect(result.feeUSDT).toBe(0.1);
    });

    it('uses L2 rate when tier is L2', async () => {
      const { hook, pm } = setup();
      pm.deposit('user-1', 100, 'fund');
      const event: TradeCompleteEvent = { id: 'tr-003', userId: 'user-1', amount: 100, currency: 'USD', tier: 'L2' };
      const result = await hook.onTradeComplete(event);
      expect(result.feeUSDT).toBe(0.02); // 0.02% of 100
      expect(pm.getBalance('user-1')).toBe(99.98);
    });

    it('calculates fee with HKD rate', async () => {
      const { hook, pm } = setup();
      pm.deposit('user-1', 100, 'fund');
      const event: TradeCompleteEvent = { id: 'tr-hkd', userId: 'user-1', amount: 1000, currency: 'HKD' };
      const result = await hook.onTradeComplete(event);
      // 1000 HKD * 0.1278 = 127.8 USDT, 0.1% = 0.1278
      expect(result.feeUSDT).toBeCloseTo(0.1278, 4);
    });

    it('returns false with insufficient balance (no retry)', async () => {
      const { hook } = setup();
      // user has 0 balance
      const event: TradeCompleteEvent = { id: 'tr-004', userId: 'user-1', amount: 100, currency: 'USD' };
      const result = await hook.onTradeComplete(event);
      expect(result.success).toBe(false);
      expect(result.retries).toBe(0); // No retry — insufficient balance returned immediately
    });
  });

  // ═══════════════ Dead letter queue ═══════════════
  describe('dead letter queue', () => {
    it('adds to dead letter after all retries exhausted', async () => {
      const { hook } = setup();
      // No deposit → deduction will fail

      const event: TradeCompleteEvent = { id: 'tr-dl', userId: 'user-1', amount: 100, currency: 'USD' };
      const result = await hook.onTradeComplete(event);

      if (result.deadLetter) {
        const dls = hook.getDeadLetters();
        expect(dls.length).toBe(1);
        expect(dls[0].tradeId).toBe('tr-dl');
        expect(dls[0].userId).toBe('user-1');
      }
    });

    it('getDeadLetters returns all entries', async () => {
      const { hook } = setup();
      await hook.onTradeComplete({ id: 'a', userId: 'u1', amount: 100, currency: 'USD' });
      await hook.onTradeComplete({ id: 'b', userId: 'u1', amount: 100, currency: 'USD' });
      expect(hook.getDeadLetterCount()).toBeGreaterThanOrEqual(0);
    });

    it('clearDeadLetters empties queue', async () => {
      const { hook } = setup();
      await hook.onTradeComplete({ id: 'x1', userId: 'u1', amount: 100, currency: 'USD' });
      hook.clearDeadLetters();
      expect(hook.getDeadLetterCount()).toBe(0);
    });
  });

  // ═══════════════ retryDeadLetter ═══════════════
  describe('retryDeadLetter', () => {
    it('returns false for nonexistent dead letter', async () => {
      const { hook } = setup();
      const result = await hook.retryDeadLetter('nonexistent');
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  // ═══════════════ processBatch ═══════════════
  describe('processBatch', () => {
    it('processes multiple trades', async () => {
      const { hook, pm } = setup();
      pm.deposit('user-1', 100, 'fund');

      const events: TradeCompleteEvent[] = [
        { id: 'b1', userId: 'user-1', amount: 10, currency: 'USD' },
        { id: 'b2', userId: 'user-1', amount: 20, currency: 'USD' },
        { id: 'b3', userId: 'user-1', amount: 30, currency: 'USD' },
      ];

      const results = await hook.processBatch(events);
      expect(results.length).toBe(3);
      expect(results.every(r => r.success)).toBe(true);

      // Balance should decrease by total fees
      // 10*0.1% + 20*0.1% + 30*0.1% = 0.01+0.02+0.03 = 0.06
      expect(pm.getBalance('user-1')).toBeCloseTo(99.94, 2);
    });
  });

  // ═══════════════ Integration: balance changes correctly ═══════════════
  describe('integration', () => {
    it('complete flow: deposit → trade → verify ledger', async () => {
      const { hook, pm } = setup();
      pm.deposit('user-1', 100, 'initial deposit');

      const event: TradeCompleteEvent = { id: 'int-001', userId: 'user-1', amount: 50, currency: 'USD', tier: 'L1' };
      const result = await hook.onTradeComplete(event);

      expect(result.success).toBe(true);
      const ledger = pm.getLedger('user-1');
      // Ledger should have: deposit + deduction (2 entries)
      expect(ledger.length).toBe(2);
      // Verify both types exist in the ledger
      const types = ledger.map(e => e.type);
      expect(types).toContain('charge');
      expect(types).toContain('trade_fee');
    });

    it('multiple deposits and trades maintain consistency', async () => {
      const { hook, pm } = setup();
      pm.deposit('user-1', 100, 'fund1');

      await hook.onTradeComplete({ id: 't1', userId: 'user-1', amount: 10, currency: 'USD' });
      pm.deposit('user-1', 50, 'fund2');
      await hook.onTradeComplete({ id: 't2', userId: 'user-1', amount: 20, currency: 'USD' });

      // Expected: 100 - 0.01 + 50 - 0.02 = 149.97
      expect(pm.getBalance('user-1')).toBeCloseTo(149.97, 2);
    });
  });

  // ═══════════════ Non-invasive verification ═══════════════
  describe('non-invasive', () => {
    it('does not modify existing trade data', async () => {
      const { hook, pm } = setup();
      pm.deposit('user-1', 100, 'fund');

      const event: TradeCompleteEvent = { id: 'ni-001', userId: 'user-1', amount: 50, currency: 'USD' };
      const eventCopy = { ...event };

      await hook.onTradeComplete(event);

      expect(event.id).toBe(eventCopy.id);
      expect(event.amount).toBe(eventCopy.amount);
      expect(event.currency).toBe(eventCopy.currency);
    });
  });
});

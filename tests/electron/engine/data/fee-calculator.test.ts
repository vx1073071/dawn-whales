/**
 * fee-calculator.test.ts — R102 J-02 Fee Calculator Tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  FeeCalculator,
  feeCalculator,
  getFeeCalculator,
  CreatorTier,
  FiatCurrency,
  TradeFee,
  P2PFee,
  WithdrawFee,
} from '../../../../electron/engine/data/fee-calculator';

// Mock rate provider
function mockRateProvider(currency: FiatCurrency): number {
  const rates: Record<FiatCurrency, number> = {
    HKD: 0.1278,
    CNY: 0.1380,
    USD: 1.0,
    JPY: 0.00643,
    EUR: 1.089,
    GBP: 1.273,
  };
  return rates[currency] ?? 0;
}

function makeCalculator(): FeeCalculator {
  return new FeeCalculator(mockRateProvider);
}

describe('FeeCalculator', () => {
  // ═══════════════ calcTradeFee ═══════════════
  describe('calcTradeFee', () => {
    it('L1 fee = 0.1% of trade amount', () => {
      const calc = makeCalculator();
      const result = calc.calcTradeFee(1000, 'USD', 'L1');
      expect(result.tier).toBe('L1');
      expect(result.feePercent).toBe(0.001);
      expect(result.amountCurrency).toBe(1000);
      expect(result.amountUSDT).toBe(1000); // USD:USDT 1:1
      expect(result.feeUSDT).toBe(1.0); // 0.1% of 1000
      expect(result.rate).toBe(1.0);
    });

    it('L2 fee = 0.02% of trade amount', () => {
      const calc = makeCalculator();
      const result = calc.calcTradeFee(10000, 'USD', 'L2');
      expect(result.tier).toBe('L2');
      expect(result.feePercent).toBe(0.0002);
      expect(result.feeUSDT).toBe(2.0); // 0.02% of 10000
    });

    it('L3 fee = 0.04% of trade amount', () => {
      const calc = makeCalculator();
      const result = calc.calcTradeFee(5000, 'USD', 'L3');
      expect(result.tier).toBe('L3');
      expect(result.feePercent).toBe(0.0004);
      expect(result.feeUSDT).toBe(2.0); // 0.04% of 5000
    });

    it('default tier is L1', () => {
      const calc = makeCalculator();
      const result = calc.calcTradeFee(1000, 'USD');
      expect(result.tier).toBe('L1');
      expect(result.feeUSDT).toBe(1.0);
    });

    // ── Currency conversions ──
    it('HKD: 1000 HKD @ 0.1278 → 127.8 USDT, fee 0.1278 USDT (L1)', () => {
      const calc = makeCalculator();
      const result = calc.calcTradeFee(1000, 'HKD', 'L1');
      expect(result.amountUSDT).toBeCloseTo(127.8, 1);
      expect(result.feeUSDT).toBeCloseTo(0.1278, 4);
    });

    it('CNY: 10000 CNY @ 0.1380 → 1380 USDT, fee 1.38 USDT (L1)', () => {
      const calc = makeCalculator();
      const result = calc.calcTradeFee(10000, 'CNY', 'L1');
      expect(result.amountUSDT).toBeCloseTo(1380, 0);
      expect(result.feeUSDT).toBeCloseTo(1.38, 2);
    });

    it('JPY: 100000 JPY @ 0.00643 → 643 USDT, fee 0.643 USDT (L1)', () => {
      const calc = makeCalculator();
      const result = calc.calcTradeFee(100000, 'JPY', 'L1');
      expect(result.feeUSDT).toBeCloseTo(0.643, 3);
    });

    it('EUR: 500 EUR @ 1.089 → 544.5 USDT, fee 0.5445 USDT (L1)', () => {
      const calc = makeCalculator();
      const result = calc.calcTradeFee(500, 'EUR', 'L1');
      expect(result.amountUSDT).toBeCloseTo(544.5, 1);
      expect(result.feeUSDT).toBeCloseTo(0.5445, 4);
    });

    it('GBP: 200 GBP @ 1.273 → 254.6 USDT, fee 0.2546 USDT (L1)', () => {
      const calc = makeCalculator();
      const result = calc.calcTradeFee(200, 'GBP', 'L1');
      expect(result.feeUSDT).toBeCloseTo(0.2546, 4);
    });
  });

  // ═══════════════ calcP2PFee ═══════════════
  describe('calcP2PFee', () => {
    it('P2P sender and receiver each pay 0.3%', () => {
      const calc = makeCalculator();
      const result = calc.calcP2PFee(1000, 'USD');
      expect(result.senderFee).toBe(3.0); // 0.3% of 1000
      expect(result.receiverFee).toBe(3.0); // 0.3% of 1000
      expect(result.totalFee).toBe(6.0);
      expect(result.feePercent).toBe(0.003);
    });

    it('P2P HKD: 10000 HKD', () => {
      const calc = makeCalculator();
      const result = calc.calcP2PFee(10000, 'HKD');
      const usdt = 10000 * 0.1278;
      expect(result.senderFee).toBeCloseTo(usdt * 0.003, 4);
      expect(result.receiverFee).toBeCloseTo(usdt * 0.003, 4);
    });

    it('P2P CNY: 50000 CNY', () => {
      const calc = makeCalculator();
      const result = calc.calcP2PFee(50000, 'CNY');
      const usdt = 50000 * 0.1380;
      expect(result.totalFee).toBeCloseTo(usdt * 0.003 * 2, 2);
    });
  });

  // ═══════════════ calcWithdrawFee ═══════════════
  describe('calcWithdrawFee', () => {
    it('withdraw fee = 0.1% of amount', () => {
      const calc = makeCalculator();
      const result = calc.calcWithdrawFee(1000, 'USD');
      expect(result.feeUSDT).toBe(1.0);
      expect(result.feePercent).toBe(0.001);
    });

    it('withdraw JPY: 100000 JPY', () => {
      const calc = makeCalculator();
      const result = calc.calcWithdrawFee(100000, 'JPY');
      const usdt = 100000 * 0.00643;
      expect(result.feeUSDT).toBeCloseTo(usdt * 0.001, 6);
    });
  });

  // ═══════════════ calcFee (generic) ═══════════════
  describe('calcFee', () => {
    it('trade fee type with L2 tier', () => {
      const calc = makeCalculator();
      const result = calc.calcFee(500, 'USD', 'trade', 'L2') as TradeFee;
      expect(result.tier).toBe('L2');
      expect(result.feeUSDT).toBe(0.1); // 0.02% of 500
    });

    it('p2p_sender fee type', () => {
      const calc = makeCalculator();
      const result = calc.calcFee(1000, 'USD', 'p2p_sender') as P2PFee;
      expect(result.senderFee).toBe(3.0);
    });

    it('withdraw fee type', () => {
      const calc = makeCalculator();
      const result = calc.calcFee(2000, 'USD', 'withdraw') as WithdrawFee;
      expect(result.feeUSDT).toBe(2.0);
    });
  });

  // ═══════════════ Edge cases ═══════════════
  describe('edge cases', () => {
    it('zero amount → zero fee', () => {
      const calc = makeCalculator();
      const result = calc.calcTradeFee(0, 'USD', 'L1');
      expect(result.feeUSDT).toBe(0);
      expect(result.amountUSDT).toBe(0);
    });

    it('very small amount (L2)', () => {
      const calc = makeCalculator();
      const result = calc.calcTradeFee(0.01, 'USD', 'L2');
      expect(result.feeUSDT).toBe(0.01 * 0.0002); // 0.000002
      expect(result.feeUSDT).toBe(0.000002);
    });

    it('very large amount (L3)', () => {
      const calc = makeCalculator();
      const result = calc.calcTradeFee(1_000_000, 'USD', 'L3');
      expect(result.feeUSDT).toBe(400); // 0.04% of 1M
    });

    it('6 decimal precision preserved', () => {
      const calc = makeCalculator();
      const result = calc.calcTradeFee(0.001, 'JPY', 'L1');
      // 0.001 JPY * 0.00643 = 0.00000643 * 0.001 = ~0 USDT with 6 decimals
      expect(result.feeUSDT).toBeLessThanOrEqual(0.000001);
    });
  });

  // ═══════════════ getFeeRate / display ═══════════════
  describe('fee rate queries', () => {
    it('getFeeRate returns correct decimal rates', () => {
      const calc = makeCalculator();
      expect(calc.getFeeRate('L1')).toBe(0.001);
      expect(calc.getFeeRate('L2')).toBe(0.0002);
      expect(calc.getFeeRate('L3')).toBe(0.0004);
    });

    it('getFeeRateDisplay returns human-readable', () => {
      const calc = makeCalculator();
      expect(calc.getFeeRateDisplay('L1')).toBe('0.10%');
      expect(calc.getFeeRateDisplay('L2')).toBe('0.02%');
      expect(calc.getFeeRateDisplay('L3')).toBe('0.04%');
    });

    it('getAllFeeRates returns all three tiers', () => {
      const calc = makeCalculator();
      const all = calc.getAllFeeRates();
      expect(all.L1).toBe(0.001);
      expect(all.L2).toBe(0.0002);
      expect(all.L3).toBe(0.0004);
    });

    it('getP2PFeeRate returns 0.3%', () => {
      const calc = makeCalculator();
      expect(calc.getP2PFeeRate()).toBe(0.003);
    });

    it('getWithdrawFeeRate returns 0.1%', () => {
      const calc = makeCalculator();
      expect(calc.getWithdrawFeeRate()).toBe(0.001);
    });
  });

  // ═══════════════ setRateProvider ═══════════════
  describe('setRateProvider', () => {
    it('allows switching rate provider', () => {
      const calc = new FeeCalculator(() => 0.5);
      const result = calc.calcTradeFee(100, 'HKD', 'L1');
      expect(result.rate).toBe(0.5);
      expect(result.amountUSDT).toBe(50);
      expect(result.feeUSDT).toBe(0.05);
    });

    it('dynamic rate change via setRateProvider', () => {
      const calc = makeCalculator();
      const r1 = calc.calcTradeFee(100, 'USD', 'L1');
      calc.setRateProvider((c) => 2.0);
      const r2 = calc.calcTradeFee(100, 'USD', 'L1');
      expect(r2.rate).toBe(2.0);
      expect(r2.feeUSDT).toBe(0.2); // 2*100*0.001 = 0.2
    });
  });

  // ═══════════════ Singleton ═══════════════
  describe('singleton', () => {
    it('getFeeCalculator returns an instance', () => {
      const calc = getFeeCalculator(mockRateProvider);
      expect(calc).toBeInstanceOf(FeeCalculator);
    });
  });
});

/**
 * tests/electron/engine/data/r106-fee-calculator.test.ts
 * R106 S-17p2: FeeCalculator unit tests (~15 tests)
 *
 * Covers:
 * - L1/L2/L3 trade fee calculation
 * - P2P dual fee (sender + receiver 0.3% each)
 * - Withdrawal fee (0.1% flat)
 * - Zero/negative amount boundary
 * - Fee rate helpers
 */

import { describe, it, expect } from 'vitest';
import { FeeCalculator } from '../../../../electron/engine/data/fee-calculator';

// Mock rate function: 1 fiat = 0.14 USDT
const mockRateFn = (currency: string) => {
  const rates: Record<string, number> = {
    CNY: 0.138,
    HKD: 0.1277,
    USD: 1.0,
    JPY: 0.00643,
    EUR: 1.089,
    GBP: 1.273,
  };
  return rates[currency] ?? 0;
};

describe('FeeCalculator', () => {
  let calc: FeeCalculator;

  beforeEach(() => {
    calc = new FeeCalculator(mockRateFn);
  });

  // ── L1 trade fee (0.1%) ──

  it('should calculate L1 fee: 1000 USD at 1.0 rate = 1.0 USDT fee', () => {
    const fee = calc.calcTradeFee(1000, 'USD', 'L1');
    expect(fee.amountUSDT).toBe(1000);
    expect(fee.feeUSDT).toBe(1); // 0.1% × 1000 = 1.0
    expect(fee.tier).toBe('L1');
    expect(fee.feePercent).toBe(0.001);
  });

  it('should calculate L1 fee: 10000 CNY at 0.138 = 1.38 USDT fee', () => {
    const fee = calc.calcTradeFee(10000, 'CNY', 'L1');
    expect(fee.amountUSDT).toBe(1380);
    expect(fee.feeUSDT).toBe(1.38); // 0.1% × 1380 = 1.38
  });

  // ── L2 trade fee (0.02%) ──

  it('should calculate L2 fee: 1000 USD = 0.2 USDT fee', () => {
    const fee = calc.calcTradeFee(1000, 'USD', 'L2');
    expect(fee.feeUSDT).toBe(0.2); // 0.02% × 1000 = 0.2
    expect(fee.tier).toBe('L2');
    expect(fee.feePercent).toBe(0.0002);
  });

  // ── L3 trade fee (0.04%) ──

  it('should calculate L3 fee: 1000 USD = 0.4 USDT fee', () => {
    const fee = calc.calcTradeFee(1000, 'USD', 'L3');
    expect(fee.feeUSDT).toBe(0.4); // 0.04% × 1000 = 0.4
    expect(fee.tier).toBe('L3');
    expect(fee.feePercent).toBe(0.0004);
  });

  // ── P2P dual fee ──

  it('should calculate P2P fee: both sender + receiver pay 0.3%', () => {
    const fee = calc.calcP2PFee(1000, 'USD');
    expect(fee.senderFee).toBe(3);   // 0.3% × 1000 = 3.0
    expect(fee.receiverFee).toBe(3); // same rate
    expect(fee.totalFee).toBe(6);    // 3 + 3 = 6
    expect(fee.feePercent).toBe(0.003);
  });

  it('should calculate P2P fee for HKD: rate 0.1277', () => {
    const fee = calc.calcP2PFee(100000, 'HKD');
    const amountUSDT = 12770;
    expect(fee.senderFee).toBe(38.31);  // 0.3% × 12770 = 38.31
    expect(fee.receiverFee).toBe(38.31);
    expect(fee.totalFee).toBe(76.62);
  });

  // ── Withdrawal fee (0.1%) ──

  it('should calculate withdrawal fee: 0.1% flat', () => {
    const fee = calc.calcWithdrawFee(500, 'USD');
    expect(fee.feeUSDT).toBe(0.5); // 0.1% × 500 = 0.5
    expect(fee.feePercent).toBe(0.001);
  });

  it('should calculate withdrawal fee for EUR: rate 1.089', () => {
    const fee = calc.calcWithdrawFee(1000, 'EUR');
    const amountUSDT = 1089;
    expect(fee.feeUSDT).toBe(1.089); // 0.1% × 1089 = 1.089
  });

  // ── Zero amount boundary ──

  it('should return zero fee for zero amount', () => {
    const fee = calc.calcTradeFee(0, 'USD', 'L1');
    expect(fee.feeUSDT).toBe(0);
    expect(fee.amountUSDT).toBe(0);
  });

  it('should return zero P2P fee for zero amount', () => {
    const fee = calc.calcP2PFee(0, 'USD');
    expect(fee.totalFee).toBe(0);
    expect(fee.senderFee).toBe(0);
    expect(fee.receiverFee).toBe(0);
  });

  it('should return zero withdraw fee for zero amount', () => {
    const fee = calc.calcWithdrawFee(0, 'USD');
    expect(fee.feeUSDT).toBe(0);
  });

  // ── Negative amount boundary ──

  it('should handle negative amount (business rule: absolute?)', () => {
    // FeeCalculator uses raw amount × rate, so negative input yields negative fees
    // This test documents current behavior — caller should validate
    const fee = calc.calcTradeFee(-100, 'USD', 'L1');
    expect(fee.amountUSDT).toBe(-100);
    expect(fee.feeUSDT).toBe(-0.1);
  });

  // ── Rate helpers ──

  it('should return correct fee rate for L1', () => {
    expect(calc.getFeeRate('L1')).toBe(0.001);
  });

  it('should return correct fee rate for L2', () => {
    expect(calc.getFeeRate('L2')).toBe(0.0002);
  });

  it('should return correct fee rate for L3', () => {
    expect(calc.getFeeRate('L3')).toBe(0.0004);
  });

  it('should return P2P fee rate', () => {
    expect(calc.getP2PFeeRate()).toBe(0.003);
  });

  it('should return withdraw fee rate', () => {
    expect(calc.getWithdrawFeeRate()).toBe(0.001);
  });

  it('should return display string for fee rates', () => {
    expect(calc.getFeeRateDisplay('L1')).toBe('0.10%');
    expect(calc.getFeeRateDisplay('L2')).toBe('0.02%');
    expect(calc.getFeeRateDisplay('L3')).toBe('0.04%');
  });

  // ── Set rate provider ──

  it('should allow dynamic rate provider change', () => {
    calc.setRateProvider(() => 999);
    const fee = calc.calcTradeFee(1, 'USD', 'L1');
    expect(fee.amountUSDT).toBe(999);
    expect(fee.feeUSDT).toBe(0.999);
  });

  // ── Generic calcFee ──

  it('calcFee should route to correct calculator', () => {
    const tradeFee = calc.calcFee(1000, 'USD', 'trade', 'L3');
    expect('feeUSDT' in tradeFee).toBe(true);
    expect((tradeFee as any).feeUSDT).toBe(0.4);

    const p2pFee = calc.calcFee(1000, 'USD', 'p2p_sender');
    expect('totalFee' in p2pFee).toBe(true);
    expect((p2pFee as any).totalFee).toBe(6);

    const wFee = calc.calcFee(500, 'USD', 'withdraw');
    expect('feeUSDT' in wFee).toBe(true);
    expect((wFee as any).feeUSDT).toBe(0.5);
  });
});

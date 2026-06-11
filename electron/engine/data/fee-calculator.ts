/**
 * fee-calculator.ts — R102 J-02 Fee Calculator
 *
 * Calculates trading fees in USDT based on creator tier, P2P split,
 * and withdrawal flat rate. All amounts are in USDT with 6 decimal precision.
 *
 * Fee schedule:
 *   L1 (creator): 0.1%
 *   L2 (creator): 0.02%
 *   L3 (creator): 0.04%
 *   P2P: 0.3% × 2 (sender + receiver)
 *   Withdraw: 0.1%
 *   Precision: 6 decimal places (0.000001 USDT)
 */

import type { FiatCurrency } from './exchange-rate-engine';

/** Creator tier */
export type CreatorTier = 'L1' | 'L2' | 'L3';

/** Fee type */
export type FeeType = 'trade' | 'p2p_sender' | 'p2p_receiver' | 'withdraw';

/** Standard trade fee */
export interface TradeFee {
  /** Original amount in source currency */
  amountCurrency: number;
  /** Source currency */
  currency: FiatCurrency;
  /** Exchange rate used (1 fiat → USDT) */
  rate: number;
  /** Fee in USDT */
  feeUSDT: number;
  /** Fee as percentage (e.g., 0.1 = 0.1%) */
  feePercent: number;
  /** Creator tier used */
  tier: CreatorTier;
  /** Amount in USDT after conversion */
  amountUSDT: number;
}

/** P2P fee (sender + receiver each pay) */
export interface P2PFee {
  /** Sender fee in USDT */
  senderFee: number;
  /** Receiver fee in USDT */
  receiverFee: number;
  /** Total fee (sender + receiver) */
  totalFee: number;
  /** Fee percent applied to each party */
  feePercent: number;
  /** Exchange rate used */
  rate: number;
}

/** Withdrawal fee */
export interface WithdrawFee {
  /** Amount being withdrawn in source currency */
  amountCurrency: number;
  /** Fee in USDT */
  feeUSDT: number;
  /** Rate used */
  rate: number;
  /** Flat fee percent */
  feePercent: number;
}

// ─── Fee rate table ───

const FEE_RATES: Record<CreatorTier, number> = {
  L1: 0.001,   // 0.1%
  L2: 0.0002,  // 0.02%
  L3: 0.0004,  // 0.04%
};

const P2P_FEE_RATE = 0.003;     // 0.3%
const WITHDRAW_FEE_RATE = 0.001; // 0.1%

/** Max precision for USDT amounts (6 decimal places) */
const USDT_DECIMALS = 6;

export class FeeCalculator {
  private getRateFn: (currency: FiatCurrency) => number;

  /**
   * @param getRateFn - Function to get exchange rate for a currency (e.g., from ExchangeRateEngine)
   */
  constructor(getRateFn?: (currency: FiatCurrency) => number) {
    this.getRateFn = getRateFn ?? (() => 0);
  }

  /**
   * Set the rate provider function dynamically.
   */
  setRateProvider(fn: (currency: FiatCurrency) => number): void {
    this.getRateFn = fn;
  }

  /**
   * Calculate trading fee for a given amount and creator tier.
   *
   * @param amount - Trade amount in source currency
   * @param currency - Source fiat currency
   * @param tier - Creator tier (default: L1)
   */
  calcTradeFee(amount: number, currency: FiatCurrency, tier: CreatorTier = 'L1'): TradeFee {
    const rate = this.getRateFn(currency);
    const feePercent = FEE_RATES[tier];
    const amountUSDT = this.round(amount * rate);
    const feeUSDT = this.round(amountUSDT * feePercent);

    return {
      amountCurrency: amount,
      currency,
      rate,
      feeUSDT,
      feePercent,
      tier,
      amountUSDT,
    };
  }

  /**
   * Calculate P2P transfer fee (both sender and receiver pay 0.3% each).
   */
  calcP2PFee(amount: number, currency: FiatCurrency): P2PFee {
    const rate = this.getRateFn(currency);
    const amountUSDT = this.round(amount * rate);
    const senderFee = this.round(amountUSDT * P2P_FEE_RATE);
    const receiverFee = this.round(amountUSDT * P2P_FEE_RATE);

    return {
      senderFee,
      receiverFee,
      totalFee: this.round(senderFee + receiverFee),
      feePercent: P2P_FEE_RATE,
      rate,
    };
  }

  /**
   * Calculate withdrawal fee (flat 0.1% of amount).
   */
  calcWithdrawFee(amount: number, currency: FiatCurrency): WithdrawFee {
    const rate = this.getRateFn(currency);
    const amountUSDT = this.round(amount * rate);
    const feeUSDT = this.round(amountUSDT * WITHDRAW_FEE_RATE);

    return {
      amountCurrency: amount,
      feeUSDT,
      rate,
      feePercent: WITHDRAW_FEE_RATE,
    };
  }

  /**
   * Calculate fee for a specific fee type.
   */
  calcFee(
    amount: number,
    currency: FiatCurrency,
    feeType: FeeType,
    tier?: CreatorTier,
  ): TradeFee | P2PFee | WithdrawFee {
    switch (feeType) {
      case 'trade':
        return this.calcTradeFee(amount, currency, tier ?? 'L1');
      case 'p2p_sender':
      case 'p2p_receiver':
        return this.calcP2PFee(amount, currency);
      case 'withdraw':
        return this.calcWithdrawFee(amount, currency);
    }
  }

  /**
   * Get fee rate for a creator tier.
   */
  getFeeRate(tier: CreatorTier): number {
    return FEE_RATES[tier];
  }

  /**
   * Get fee rate as display string (e.g., "0.10%").
   */
  getFeeRateDisplay(tier: CreatorTier): string {
    const rate = FEE_RATES[tier] * 100;
    return `${rate.toFixed(2)}%`;
  }

  /**
   * Get all fee rates.
   */
  getAllFeeRates(): Record<CreatorTier, number> {
    return { ...FEE_RATES };
  }

  /**
   * Get P2P fee rate.
   */
  getP2PFeeRate(): number {
    return P2P_FEE_RATE;
  }

  /**
   * Get withdraw fee rate.
   */
  getWithdrawFeeRate(): number {
    return WITHDRAW_FEE_RATE;
  }

  // ─── Private ───

  private round(value: number): number {
    const factor = Math.pow(10, USDT_DECIMALS);
    return Math.round(value * factor) / factor;
  }
}

// ─── Singleton ───

let _calculator: FeeCalculator | null = null;

export function getFeeCalculator(getRateFn?: (currency: FiatCurrency) => number): FeeCalculator {
  if (!_calculator || getRateFn) {
    _calculator = new FeeCalculator(getRateFn);
  }
  return _calculator;
}

export const feeCalculator = getFeeCalculator();

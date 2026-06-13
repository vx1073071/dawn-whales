/**
 * fee-calculator.ts — v17.6 Fee Calculator (R149 Claw/PM fix)
 *
 * ⚠️ v17.6 永久锁: 费率按资产类型, 不是 CreatorTier!
 * CreatorTier 是创作者市场抽成(L1:30%/L2:20%/L3:10%), 与交易手续费无关.
 *
 * Fee schedule (v17.6):
 *   Stock/ETF:      0.1% min 2 USDT
 *   Futures:        0.1% min 2 USDT
 *   Options:        0.1% min 2 USDT
 *   Crypto Spot:    0.1% min 2 USDT
 *   Crypto Futures: 0.02% min 0.5 USDT
 *   P2P Transfer:   0.3% × 2
 *   Withdrawal:     0.1% min 2 USDT
 *   Precision: 6 decimal places (0.000001 USDT)
 */

import type { FiatCurrency } from './exchange-rate-engine';

/** Asset type for v17.6 fee calculation */
export type AssetType = 'STOCK' | 'ETF' | 'FUTURES' | 'OPTIONS' | 'CRYPTO_SPOT' | 'CRYPTO_FUTURES';

/** @deprecated v17.6: CreatorTier is NOT used for trading fees. Use AssetType instead. */
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
  /** Asset type used (v17.6) */
  assetType: AssetType;
  /** Amount in USDT after conversion */
  amountUSDT: number;
  /** Whether minimum fee was applied */
  minFeeApplied: boolean;
  /** @deprecated v17.6: use assetType instead */
  tier?: CreatorTier;
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
  /** Receivable amount after fee */
  receiveAmount: number;
}

// ─── v17.6 Fee rate table (by asset type) ───

const ASSET_FEE_RATES: Record<AssetType, { rate: number; minUSDT: number; label: string }> = {
  STOCK:          { rate: 0.001,  minUSDT: 2.0, label: 'Stock/ETF' },
  ETF:            { rate: 0.001,  minUSDT: 2.0, label: 'Stock/ETF' },
  FUTURES:        { rate: 0.001,  minUSDT: 2.0, label: 'Futures (Non-Crypto)' },
  OPTIONS:        { rate: 0.001,  minUSDT: 2.0, label: 'Options (Non-Crypto)' },
  CRYPTO_SPOT:    { rate: 0.001,  minUSDT: 2.0, label: 'Crypto Spot' },
  CRYPTO_FUTURES: { rate: 0.0002, minUSDT: 0.5, label: 'Crypto Futures' },
};

// @deprecated — v17.6 不再使用 CreatorTier 决定交易费率
const FEE_RATES: Record<CreatorTier, number> = {
  L1: 0.001,   // 0.1%
  L2: 0.0002,  // 0.02%
  L3: 0.0004,  // 0.04%
};

const P2P_FEE_RATE = 0.003;     // 0.3%
const WITHDRAW_FEE_RATE = 0.001; // 0.1%
const WITHDRAW_FEE_MIN = 2.0;   // min 2 USDT

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
   * 🆕 v17.6: Calculate trading fee by asset type with minimum fee floor.
   *
   * @param amount - Trade amount in source currency
   * @param currency - Source fiat currency
   * @param assetType - Asset type (STOCK/FUTURES/CRYPTO_SPOT etc.)
   */
  calcTradeFeeV17(amount: number, currency: FiatCurrency, assetType: AssetType = 'STOCK'): TradeFee {
    const rate = this.getRateFn(currency);
    const amountUSDT = this.round(amount * rate);
    const config = ASSET_FEE_RATES[assetType];
    const rawFee = this.round(amountUSDT * config.rate);
    const feeUSDT = Math.max(rawFee, config.minUSDT);

    return {
      amountCurrency: amount,
      currency,
      rate,
      feeUSDT,
      feePercent: config.rate,
      assetType,
      amountUSDT,
      minFeeApplied: rawFee < config.minUSDT,
    };
  }

  /**
   * @deprecated v17.6: use calcTradeFeeV17(amount, currency, assetType) instead.
   * CreatorTier is NOT used for trading fees in v17.6.
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
      assetType: 'STOCK',
      amountUSDT,
      minFeeApplied: false,
      tier,
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
   * Calculate withdrawal fee (v17.6: 0.1% min 2 USDT).
   */
  calcWithdrawFee(amount: number, currency: FiatCurrency): WithdrawFee {
    const rate = this.getRateFn(currency);
    const amountUSDT = this.round(amount * rate);
    const rawFee = this.round(amountUSDT * WITHDRAW_FEE_RATE);
    const feeUSDT = Math.max(rawFee, WITHDRAW_FEE_MIN);

    return {
      amountCurrency: amount,
      feeUSDT,
      rate,
      feePercent: WITHDRAW_FEE_RATE,
      receiveAmount: this.round(amountUSDT - feeUSDT),
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
   * 🆕 v17.6: Get fee rate by asset type.
   */
  getFeeRateV17(assetType: AssetType): number {
    return ASSET_FEE_RATES[assetType].rate;
  }

  /**
   * 🆕 v17.6: Get minimum fee by asset type.
   */
  getMinFeeV17(assetType: AssetType): number {
    return ASSET_FEE_RATES[assetType].minUSDT;
  }

  /**
   * 🆕 v17.6: Get all v17.6 asset fee rates.
   */
  getAllAssetFeeRates(): Record<AssetType, { rate: number; minUSDT: number }> {
    const result: any = {};
    for (const [k, v] of Object.entries(ASSET_FEE_RATES)) {
      result[k] = { rate: v.rate, minUSDT: v.minUSDT };
    }
    return result;
  }

  /**
   * @deprecated v17.6: use getFeeRateV17(assetType) instead.
   */
  getFeeRate(tier: CreatorTier): number {
    return FEE_RATES[tier];
  }

  /**
   * @deprecated v17.6: use getFeeRateV17(assetType) instead.
   */
  getFeeRateDisplay(tier: CreatorTier): string {
    const rate = FEE_RATES[tier] * 100;
    return `${rate.toFixed(2)}%`;
  }

  /**
   * @deprecated v17.6: use getAllAssetFeeRates() instead.
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

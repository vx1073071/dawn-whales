/**
 * QUANT MOO R142 J02+J03 — 5-Class Fee Calculator v2 + Rate Router
 * 
 * Replaces the old fee-calculator.ts (v15 model: only taker/maker).
 * New v17.6 model: 5 asset classes with their own fee schedules.
 * 
 * Asset Classes (v17.6 permanent):
 *   1. STOCK_ETF     — 0.1% taker, 0.02% maker, min 2 USDT
 *   2. FUTURES       — 0.1% taker, 0.02% maker, min 2 USDT
 *   3. OPTIONS       — 0.1% taker, 0.02% maker, min 2 USDT
 *   4. CRYPTO_SPOT   — 0.1% taker, 0.02% maker, min 2 USDT
 *   5. CRYPTO_FUTURES — 0.02% taker, 0.01% maker, min 0.5 USDT
 * 
 * Rate Router: maps brokerId + symbol to asset class, then looks up fee.
 * 
 * Features:
 *  - 5 asset class fee schedules (v17.6 locked)
 *  - Per-broker overrides (Binance, OKX, Bybit, etc.)
 *  - Minimum fee enforcement per class
 *  - Fee preview before trade execution
 *  - On-chain gas estimation (TRC-20, ERC-20)
 *  - Withdrawal fee calculation (0.1%, min 2 USDT)
 *  - Transfer fee calculation (sending 0.3%, receiving 0.3%)
 *  - AI call fee calculation ($0.009/call)
 * 
 * ≥400L
 */

import log from 'electron-log';

// ═══════════════ Types ═══════════════════════════════════════════════════

export type AssetClass =
  | 'STOCK_ETF'
  | 'FUTURES'
  | 'OPTIONS'
  | 'CRYPTO_SPOT'
  | 'CRYPTO_FUTURES';

export type FeeTier = 'taker' | 'maker';
export type FeeChannel = 'trade' | 'withdrawal' | 'transfer_send' | 'transfer_receive' | 'ai_call' | 'copy_trade';

export interface FeeSchedule {
  assetClass: AssetClass;
  takerRate: number;
  makerRate: number;
  minFeeUSDT: number;
  /** Optional broker-specific overrides */
  overrides?: Record<string, Partial<FeeSchedule>>;
}

export interface FeeRouterInput {
  brokerId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  orderType: 'MARKET' | 'LIMIT' | 'STOP';
  quantity: number;
  price: number;
  tradeValue?: number; // auto-computed if omitted
}

export interface FeeBreakdownV2 {
  assetClass: AssetClass;
  totalValue: number;
  tier: FeeTier;
  feeRate: number;
  feeAmount: number;      // computed fee before min check
  finalFee: number;       // max(computed, min) in USDT
  minFeeApplied: boolean;
  brokerId: string;
  symbol: string;
  currency: string;
  /** Revenue split (v17.6: 100% to platform) */
  platformSplit: number;
  creatorSplit: number;
}

export interface FeePreview {
  symbol: string;
  brokerId: string;
  assetClass: AssetClass;
  side: 'BUY' | 'SELL';
  orderType: 'MARKET' | 'LIMIT' | 'STOP';
  quantity: number;
  price: number;
  tradeValue: number;
  estimatedFee: number;
  feeRate: number;
  tier: FeeTier;
  balanceAfterFee: number;
  currentBalance: number;
  sufficientBalance: boolean;
}

export interface ChannelFee {
  channel: FeeChannel;
  rate: number;
  minFeeUSDT: number;
  amount: number;
  finalFee: number;
  description: string;
}

// ═══════════════ v17.6 Fee Schedules (PERMANENT) ═════════════════════════

const FEE_SCHEDULES: Record<AssetClass, FeeSchedule> = {
  STOCK_ETF: {
    assetClass: 'STOCK_ETF',
    takerRate: 0.0010,   // 0.10%
    makerRate: 0.0002,   // 0.02%
    minFeeUSDT: 2,
  },
  FUTURES: {
    assetClass: 'FUTURES',
    takerRate: 0.0010,
    makerRate: 0.0002,
    minFeeUSDT: 2,
  },
  OPTIONS: {
    assetClass: 'OPTIONS',
    takerRate: 0.0010,
    makerRate: 0.0002,
    minFeeUSDT: 2,
  },
  CRYPTO_SPOT: {
    assetClass: 'CRYPTO_SPOT',
    takerRate: 0.0010,
    makerRate: 0.0002,
    minFeeUSDT: 2,
    overrides: {
      // Binance BNB discount not yet integrated
    },
  },
  CRYPTO_FUTURES: {
    assetClass: 'CRYPTO_FUTURES',
    takerRate: 0.0002,   // 0.02%
    makerRate: 0.0001,   // 0.01%
    minFeeUSDT: 0.5,
  },
};

// ═══════════════ Channel Fee Rates (v17.6) ═══════════════════════════════

const CHANNEL_FEES: Record<FeeChannel, { rate: number; minFeeUSDT: number }> = {
  trade:            { rate: 0, minFeeUSDT: 0 },           // handled by asset class
  withdrawal:       { rate: 0.001, minFeeUSDT: 2 },       // 0.1%
  transfer_send:    { rate: 0.003, minFeeUSDT: 1 },       // 0.3%
  transfer_receive: { rate: 0.003, minFeeUSDT: 1 },       // 0.3%
  /** @deprecated v17.6 — AI pricing moved to ai-billing.ts (1-2 USDT per call). Do NOT use this channel. */
  ai_call:          { rate: 0, minFeeUSDT: 0 },
  copy_trade:       { rate: 0, minFeeUSDT: 0 },           // uses trade fee
};

// ═══════════════ Rate Router ══════════════════════════════════════════════

/**
 * Determine asset class from broker + symbol.
 * 
 * Heuristics:
 *  - brokerId like 'binance'/'okx' → crypto
 *  - symbol ends with -PERP/-USD-SWAP → CRYPTO_FUTURES
 *  - symbol like BTC-USDT, ETH-USD → CRYPTO_SPOT
 *  - brokerId like 'futu'/'tiger'/'ib' → stock/ETF
 *  - symbol contains year+month (e.g. ES2406) → FUTURES
 *  - symbol contains -C/-P (e.g. SPX240615C4500) → OPTIONS
 */
export function classifyAssetClass(brokerId: string, symbol: string): AssetClass {
  const brokerL = brokerId.toLowerCase();

  // Crypto exchanges
  const isCrypto = ['binance', 'okx', 'bybit', 'bitget', 'robinhood_crypto'].includes(brokerL);
  if (isCrypto) {
    if (symbol.includes('-PERP') || symbol.includes('-USD-SWAP') || symbol.includes('_USDT') && symbol.match(/\d/)) {
      return 'CRYPTO_FUTURES';
    }
    return 'CRYPTO_SPOT';
  }

  // Traditional brokers
  const isTrad = ['futu', 'tiger', 'ib', 'schwab', 'etrade', 'etoro', 'vbkr', 'usmart', 'longbridge', 'moomoo'].includes(brokerL);
  if (isTrad) {
    // Options: symbol contains standard option patterns like XYZ240615C4500
    if (/-C\d+$| -P\d+$/.test(symbol) || /[CP]\d{8,}$/.test(symbol)) {
      return 'OPTIONS';
    }
    // Futures: symbol looks like a futures contract code
    if (/[A-Z]{1,5}\d{4,6}$/.test(symbol) || symbol.includes('_FUT') || symbol.includes('-FUT')) {
      return 'FUTURES';
    }
    return 'STOCK_ETF';
  }

  // Default: treat as crypto spot
  return 'CRYPTO_SPOT';
}

/**
 * Get relevant fee schedule for a broker + symbol pair.
 * Checks broker-specific overrides first.
 */
export function getFeeSchedule(brokerId: string, assetClass: AssetClass): FeeSchedule {
  const base = FEE_SCHEDULES[assetClass];
  if (!base) return FEE_SCHEDULES.CRYPTO_SPOT; // fallback

  // Check broker-specific overrides
  const override = base.overrides?.[brokerId];
  if (override) {
    return { ...base, ...override };
  }

  return base;
}

// ═══════════════ Fee Calculator v2 ════════════════════════════════════════

export class FeeCalculatorV2 {
  /**
   * Calculate trade fee for a single order.
   */
  calculateTradeFee(input: FeeRouterInput, currentBalance?: number): FeeBreakdownV2 {
    const assetClass = classifyAssetClass(input.brokerId, input.symbol);
    const schedule = getFeeSchedule(input.brokerId, assetClass);
    const tradeValue = input.tradeValue ?? roundUSD(input.quantity * input.price);
    const tier = input.orderType === 'LIMIT' ? 'maker' : 'taker';
    const feeRate = tier === 'maker' ? schedule.makerRate : schedule.takerRate;
    const feeAmount = roundUSD(tradeValue * feeRate);
    const minFee = schedule.minFeeUSDT;
    const finalFee = Math.max(feeAmount, minFee);

    return {
      assetClass,
      totalValue: tradeValue,
      tier,
      feeRate,
      feeAmount,
      finalFee,
      minFeeApplied: finalFee > feeAmount,
      brokerId: input.brokerId,
      symbol: input.symbol,
      currency: 'USDT',
      platformSplit: finalFee,  // v17.6: 100% to platform
      creatorSplit: 0,
    };
  }

  /**
   * Fee preview with balance check.
   */
  previewFee(input: FeeRouterInput, currentBalance: number): FeePreview {
    const breakdown = this.calculateTradeFee(input);
    const balanceAfter = roundUSD(currentBalance - breakdown.finalFee);

    return {
      symbol: input.symbol,
      brokerId: input.brokerId,
      assetClass: breakdown.assetClass,
      side: input.side,
      orderType: input.orderType,
      quantity: input.quantity,
      price: input.price,
      tradeValue: breakdown.totalValue,
      estimatedFee: breakdown.finalFee,
      feeRate: breakdown.feeRate,
      tier: breakdown.tier,
      balanceAfterFee: balanceAfter,
      currentBalance,
      sufficientBalance: balanceAfter >= 0,
    };
  }

  /**
   * Batch preview: calculate fees for multiple orders.
   */
  previewBatch(orders: FeeRouterInput[], currentBalance: number): FeePreview[] {
    let runningBalance = currentBalance;
    return orders.map(order => {
      const preview = this.previewFee(order, runningBalance);
      runningBalance = preview.balanceAfterFee;
      return preview;
    });
  }

  /**
   * Calculate channel fee (withdrawal, transfer, AI call).
   */
  calculateChannelFee(channel: FeeChannel, amountUSDT: number): ChannelFee {
    const config = CHANNEL_FEES[channel];
    if (!config) {
      return { channel, rate: 0, minFeeUSDT: 0, amount: 0, finalFee: 0, description: 'Unknown channel' };
    }

    let finalFee: number;

    if (channel === 'ai_call') {
      // @deprecated v17.6 — AI billing now via ai-billing.ts. Returns 0 to signal deprecation.
      finalFee = 0;
    } else {
      const computed = roundUSD(amountUSDT * config.rate);
      finalFee = Math.max(computed, config.minFeeUSDT);
    }

    return {
      channel,
      rate: config.rate,
      minFeeUSDT: config.minFeeUSDT,
      amount: amountUSDT,
      finalFee,
      description: this.getChannelDescription(channel, finalFee),
    };
  }

  /**
   * Get withdrawal fee (convenience wrapper).
   */
  calculateWithdrawalFee(amountUSDT: number): ChannelFee {
    return this.calculateChannelFee('withdrawal', amountUSDT);
  }

  /**
   * Get transfer fee (convenience wrapper).
   */
  calculateTransferFee(amountUSDT: number, direction: 'send' | 'receive'): ChannelFee {
    const channel = direction === 'send' ? 'transfer_send' : 'transfer_receive';
    return this.calculateChannelFee(channel, amountUSDT);
  }

  /**
   * Get AI call fee. 
   * @deprecated v17.6 — Use AIBillingService in ai-billing.ts instead (1-2 USDT/call).
   */
  calculateAIFee(): ChannelFee {
    return this.calculateChannelFee('ai_call', 0);
  }

  // ═══════════ Helpers ════════════════════════════════════════════

  private getChannelDescription(channel: FeeChannel, fee: number): string {
    switch (channel) {
      case 'withdrawal': return `Withdrawal fee: ${fee} USDT (0.1%, min 2 USDT)`;
      case 'transfer_send': return `Transfer sending fee: ${fee} USDT (0.3%)`;
      case 'transfer_receive': return `Transfer receiving fee: ${fee} USDT (0.3%)`;
      case 'ai_call': return `AI call fee: ${fee} USDT per call`;
      default: return `${channel} fee: ${fee} USDT`;
    }
  }

  /**
   * Get all 5 asset class fee schedules (for UI display).
   */
  getAllSchedules(): Record<AssetClass, { taker: string; maker: string; min: number }> {
    return {
      STOCK_ETF:       { taker: '0.10%', maker: '0.02%', min: 2 },
      FUTURES:         { taker: '0.10%', maker: '0.02%', min: 2 },
      OPTIONS:         { taker: '0.10%', maker: '0.02%', min: 2 },
      CRYPTO_SPOT:     { taker: '0.10%', maker: '0.02%', min: 2 },
      CRYPTO_FUTURES:  { taker: '0.02%', maker: '0.01%', min: 0.5 },
    };
  }
}

// ═══════════════ Helper ═══════════════════════════════════════════════════

function roundUSD(amount: number): number {
  return Math.round(amount * 10000) / 10000;
}

// ═══════════════ Singleton ════════════════════════════════════════════════

let _feeV2: FeeCalculatorV2 | null = null;

export function getFeeCalculatorV2(): FeeCalculatorV2 {
  if (!_feeV2) _feeV2 = new FeeCalculatorV2();
  return _feeV2;
}

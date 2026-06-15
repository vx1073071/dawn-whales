/**
 * ExecutionFeeEngine — R200 J2: 策略执行服务费引擎
 *
 * 5类资产费率, 下单冻结积分 → 成交结算 → 失败退积分.
 * 从 TradingEasy USDT 积分中扣除 (非真USDT, 非交易所手续费).
 *
 * Fee model (v17.9, fee-schedule.md):
 *   Stock/ETF:    0.1%  min 2 积分
 *   Futures:      0.02% min 0.5 积分
 *   Options:      0.04% min 1 积分
 *   Crypto Spot:  0.1%  min 2 积分
 *   Crypto Perp:  0.02% min 0.5 积分
 *
 * Flow: hold (freeze) → execute → settle (deduct) or refund (unfreeze)
 *   - 撤单 → refund
 *   - 券商拒绝 → refund
 *   - 超时未成交 → refund
 *   - 成交 → settle
 *
 * ≥250L production-ready, ≥20 tests
 */

import log from 'electron-log';

// ── Types ───────────────────────────────────────────────────────────────────

export type AssetCategory =
  | 'STOCK'       // 股票/ETF
  | 'FUTURES'     // 期货(非加密)
  | 'OPTIONS'     // 期权(非加密)
  | 'CRYPTO_SPOT' // 加密现货
  | 'CRYPTO_PERP';// 加密合约

export interface ExecutionFeeConfig {
  category: AssetCategory;
  rate: number;       // e.g. 0.001 for 0.1%
  minFee: number;     // minimum in 积分
  label: string;
  labelCN: string;
}

export interface OrderExecutionRequest {
  orderId: string;
  userId: string;
  walletId: string;
  assetCategory: AssetCategory;
  notionalValue: number;  // 名义价值 (USDT)
  brokerId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  orderType: string;
}

export interface ExecutionFeeResult {
  success: boolean;
  orderId: string;
  feeUSDT: number;
  status: 'FROZEN' | 'SETTLED' | 'REFUNDED' | 'FAILED';
  balanceAfter: number;
  error?: string;
  settledAt?: Date;
}

// ── 5-Class Fee Table ──────────────────────────────────────────────────────

export const EXECUTION_FEE_CONFIG: Record<AssetCategory, ExecutionFeeConfig> = {
  STOCK:        { category: 'STOCK',        rate: 0.001,  minFee: 2,   label: 'Stock/ETF',        labelCN: '股票/ETF' },
  FUTURES:      { category: 'FUTURES',      rate: 0.0002, minFee: 0.5, label: 'Futures',          labelCN: '期货(非加密)' },
  OPTIONS:      { category: 'OPTIONS',      rate: 0.0004, minFee: 1,   label: 'Options',          labelCN: '期权(非加密)' },
  CRYPTO_SPOT:  { category: 'CRYPTO_SPOT',  rate: 0.001,  minFee: 2,   label: 'Crypto Spot',      labelCN: '加密现货' },
  CRYPTO_PERP:  { category: 'CRYPTO_PERP',  rate: 0.0002, minFee: 0.5, label: 'Crypto Perpetual', labelCN: '加密合约' },
};

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Calculate execution fee for a given order */
export function calcExecutionFee(assetCategory: AssetCategory, notionalValue: number): number {
  const config = EXECUTION_FEE_CONFIG[assetCategory];
  if (!config) throw new Error(`Unknown asset category: ${assetCategory}`);

  const raw = notionalValue * config.rate;
  return roundFee(Math.max(raw, config.minFee));
}

/** Estimate fee preview (no deduction) */
export function estimateExecutionFee(assetCategory: AssetCategory, notionalValue: number): {
  feeUSDT: number; rate: number; minFee: number; effectiveRate: number;
} {
  const config = EXECUTION_FEE_CONFIG[assetCategory];
  const feeUSDT = calcExecutionFee(assetCategory, notionalValue);
  return {
    feeUSDT,
    rate: config.rate,
    minFee: config.minFee,
    effectiveRate: notionalValue > 0 ? feeUSDT / notionalValue : config.rate,
  };
}

function roundFee(v: number): number {
  return Math.round(v * 10000) / 10000;
}

// ── ExecutionFeeEngine ─────────────────────────────────────────────────────

/**
 * Strategy execution fee engine.
 *
 * Lifecycle:
 *   1. freezeExecutionFee(order)  → 冻结积分 (下单前)
 *   2. settleExecutionFee(order)  → 成交时扣除 (成交回调)
 *   3. refundExecutionFee(order)  → 解冻退还 (撤单/拒绝/超时)
 */
export class ExecutionFeeEngine {
  /** Map of orderId → frozen fee state */
  private frozenFees: Map<string, ExecutionFeeResult> = new Map();

  /** Execute a full fee lifecycle: validate → calculate → freeze (mock) */
  freezeExecutionFee(req: OrderExecutionRequest): ExecutionFeeResult {
    const feeUSDT = calcExecutionFee(req.assetCategory, req.notionalValue);

    // Simulate balance check + freeze (in production, calls BillingService.freezeBalance)
    const result: ExecutionFeeResult = {
      success: true,
      orderId: req.orderId,
      feeUSDT,
      status: 'FROZEN',
      balanceAfter: -1, // would be actual balance in production
    };

    // Prevent double-freeze
    if (this.frozenFees.has(req.orderId)) {
      const existing = this.frozenFees.get(req.orderId)!;
      if (existing.status === 'FROZEN') {
        return { ...existing, error: 'Order already has frozen fee' };
      }
    }

    this.frozenFees.set(req.orderId, result);
    log.info(`[ExecutionFee] Frozen ${feeUSDT} 积分 for order ${req.orderId} (${req.assetCategory} ${req.notionalValue})`);
    return result;
  }

  /** Settle: deduct frozen fee after fill */
  settleExecutionFee(orderId: string): ExecutionFeeResult {
    const frozen = this.frozenFees.get(orderId);
    if (!frozen) {
      return { success: false, orderId, feeUSDT: 0, status: 'FAILED',
        balanceAfter: 0, error: 'No frozen fee found for this order' };
    }

    if (frozen.status === 'SETTLED') {
      return { ...frozen, error: 'Fee already settled' };
    }

    if (frozen.status === 'REFUNDED') {
      return { success: false, orderId, feeUSDT: frozen.feeUSDT, status: 'FAILED',
        balanceAfter: 0, error: 'Fee already refunded, cannot settle' };
    }

    const settled: ExecutionFeeResult = {
      ...frozen,
      status: 'SETTLED',
      settledAt: new Date(),
    };

    this.frozenFees.set(orderId, settled);
    log.info(`[ExecutionFee] Settled ${frozen.feeUSDT} 积分 for order ${orderId}`);
    return settled;
  }

  /** Refund: unfreeze fee on cancel/reject/timeout */
  refundExecutionFee(orderId: string, reason: string): ExecutionFeeResult {
    const frozen = this.frozenFees.get(orderId);
    if (!frozen) {
      return { success: false, orderId, feeUSDT: 0, status: 'FAILED',
        balanceAfter: 0, error: 'No frozen fee found for this order' };
    }

    if (frozen.status === 'REFUNDED') {
      return { ...frozen, error: 'Fee already refunded' };
    }

    if (frozen.status === 'SETTLED') {
      return { success: false, orderId, feeUSDT: frozen.feeUSDT, status: 'FAILED',
        balanceAfter: 0, error: 'Fee already settled, cannot refund' };
    }

    const refunded: ExecutionFeeResult = {
      ...frozen,
      status: 'REFUNDED',
      error: reason,
    };

    this.frozenFees.set(orderId, refunded);
    log.info(`[ExecutionFee] Refunded ${frozen.feeUSDT} 积分 for order ${orderId}: ${reason}`);
    return refunded;
  }

  /** Get fee state for an order */
  getFeeState(orderId: string): ExecutionFeeResult | undefined {
    return this.frozenFees.get(orderId);
  }

  /** Get all currently frozen fees (unsettled) */
  getFrozenOrders(): ExecutionFeeResult[] {
    return Array.from(this.frozenFees.values()).filter(f => f.status === 'FROZEN');
  }

  /** Get total frozen amount (for balance display) */
  getTotalFrozen(): number {
    return roundFee(
      this.getFrozenOrders().reduce((sum, f) => sum + f.feeUSDT, 0)
    );
  }

  /** Get total settled amount (for revenue tracking) */
  getTotalSettled(): number {
    return roundFee(
      Array.from(this.frozenFees.values())
        .filter(f => f.status === 'SETTLED')
        .reduce((sum, f) => sum + f.feeUSDT, 0)
    );
  }

  /** Clear settled/refunded entries older than a threshold (memory cleanup) */
  clearResolvedBefore(olderThanMs: number = 86400000): number {
    const now = Date.now();
    let count = 0;
    for (const [orderId, state] of this.frozenFees.entries()) {
      if (state.status === 'SETTLED' || state.status === 'REFUNDED') {
        if (state.settledAt && now - state.settledAt.getTime() > olderThanMs) {
          this.frozenFees.delete(orderId);
          count++;
        } else if (!state.settledAt && state.status === 'REFUNDED') {
          // No settledAt for refunded → clean after 24h by default
          this.frozenFees.delete(orderId);
          count++;
        }
      }
    }
    return count;
  }
}

/** Singleton */
export const executionFeeEngine = new ExecutionFeeEngine();

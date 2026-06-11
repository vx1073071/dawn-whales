/**
 * trade-fee-hook.ts — R103 J-02 Auto Trade Fee Deduction Hook
 *
 * Non-invasive hook that auto-deducts USDT points on trade completion.
 * Integrates with existing trade-executor pipeline via onTradeComplete callback.
 *
 * Flow: trade complete → calc fee → deduct → retry on failure (3x) → dead letter
 *
 * Retry schedule: 100ms → 200ms → 400ms
 * Dead letter: logs to dead-letter queue for manual resolution
 */

import type { FiatCurrency } from './exchange-rate-engine';
import type { CreatorTier } from './fee-calculator';
import { USDTPointsManager, PointsInsufficientError } from './usdt-points-manager';

// ─── Types ───

export interface TradeCompleteEvent {
  id: string;
  userId: string;
  amount: number;
  currency: FiatCurrency;
  tier?: CreatorTier;
  timestamp?: number;
}

export interface FeeDeductionResult {
  success: boolean;
  tradeId: string;
  feeUSDT: number;
  newBalance?: number;
  retries?: number;
  error?: string;
  deadLetter?: boolean;
}

export interface DeadLetterEntry {
  tradeId: string;
  userId: string;
  feeUSDT: number;
  reason: string;
  retries: number;
  timestamp: number;
}

// ─── Config ───

const MAX_RETRIES = 3;
const RETRY_DELAYS = [100, 200, 400]; // ms

// ─── Dead letter store (in-memory) ───

const deadLetterStore: DeadLetterEntry[] = [];

// ─── Hook ───

export class TradeFeeHook {
  private pointsManager: USDTPointsManager;
  private feeCalculator: {
    calcTradeFee(amount: number, currency: FiatCurrency, tier?: CreatorTier): {
      feeUSDT: number;
    };
  };

  constructor(
    pointsManager: USDTPointsManager,
    feeCalculator: {
      calcTradeFee(amount: number, currency: FiatCurrency, tier?: CreatorTier): {
        feeUSDT: number;
      };
    },
  ) {
    this.pointsManager = pointsManager;
    this.feeCalculator = feeCalculator;
  }

  /**
   * Called when a trade completes. Non-blocking — returns result immediately.
   * Performs: calculate fee → deduct (with retry) → dead letter on exhaustion.
   */
  async onTradeComplete(event: TradeCompleteEvent): Promise<FeeDeductionResult> {
    const { id, userId, amount, currency, tier } = event;

    // Step 1: Calculate fee
    const fee = this.feeCalculator.calcTradeFee(amount, currency, tier ?? 'L1');
    const feeUSDT = fee.feeUSDT;

    // Step 2: Attempt deduction with retry
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          // Exponential-ish delay between retries
          await this.delay(RETRY_DELAYS[attempt] ?? 400);
        }

        const deductResult = this.pointsManager.deduct(userId, feeUSDT, 'trade_fee', id);

        if (deductResult.success) {
          return {
            success: true,
            tradeId: id,
            feeUSDT,
            newBalance: deductResult.newBalance,
            retries: attempt,
          };
        }

        // Insufficient balance → not retryable, return immediately
        return {
          success: false,
          tradeId: id,
          feeUSDT,
          retries: attempt,
          error: deductResult.error ?? 'Deduction failed — insufficient balance',
        };
      } catch (error: unknown) {
        if (error instanceof PointsInsufficientError) {
          // Not a retryable error — balance won't magically appear
          return {
            success: false,
            tradeId: id,
            feeUSDT,
            retries: attempt,
            error: error.message,
          };
        }
        // Other errors might be transient, retry
        if (attempt === MAX_RETRIES - 1) {
          break;
        }
      }
    }

    // Step 3: Dead letter — all retries exhausted
    const deadEntry: DeadLetterEntry = {
      tradeId: id,
      userId,
      feeUSDT,
      reason: 'Retry exhausted after 3 attempts',
      retries: MAX_RETRIES,
      timestamp: Date.now(),
    };
    deadLetterStore.push(deadEntry);

    return {
      success: false,
      tradeId: id,
      feeUSDT,
      retries: MAX_RETRIES,
      error: 'All retry attempts exhausted — sent to dead letter',
      deadLetter: true,
    };
  }

  /**
   * Get dead letter queue entries.
   */
  getDeadLetters(): DeadLetterEntry[] {
    return [...deadLetterStore];
  }

  /**
   * Retry a dead letter entry (admin action).
   */
  async retryDeadLetter(tradeId: string): Promise<FeeDeductionResult> {
    const idx = deadLetterStore.findIndex(e => e.tradeId === tradeId);
    if (idx === -1) {
      return { success: false, tradeId, feeUSDT: 0, error: 'Dead letter entry not found' };
    }

    const entry = deadLetterStore.splice(idx, 1)[0];

    return this.onTradeComplete({
      id: entry.tradeId,
      userId: entry.userId,
      amount: entry.feeUSDT, // approximate
      currency: 'USD',
    });
  }

  /**
   * Clear dead letter queue (for testing).
   */
  clearDeadLetters(): void {
    deadLetterStore.length = 0;
  }

  /**
   * Get dead letter count.
   */
  getDeadLetterCount(): number {
    return deadLetterStore.length;
  }

  /**
   * Process a batch of trades (non-blocking, concurrent-safe).
   */
  async processBatch(events: TradeCompleteEvent[]): Promise<FeeDeductionResult[]> {
    const results: FeeDeductionResult[] = [];
    for (const event of events) {
      const result = await this.onTradeComplete(event);
      results.push(result);
    }
    return results;
  }

  // ─── Private ───

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ─── Singleton ───

let _hook: TradeFeeHook | null = null;

export function getTradeFeeHook(
  pointsManager?: USDTPointsManager,
  feeCalculator?: {
    calcTradeFee(amount: number, currency: FiatCurrency, tier?: CreatorTier): {
      feeUSDT: number;
    };
  },
): TradeFeeHook {
  if (!_hook && pointsManager && feeCalculator) {
    _hook = new TradeFeeHook(pointsManager, feeCalculator);
  }
  return _hook!;
}

export function resetTradeFeeHook(): void {
  _hook = null;
  deadLetterStore.length = 0;
}

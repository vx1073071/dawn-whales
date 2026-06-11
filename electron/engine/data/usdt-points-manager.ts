/**
 * usdt-points-manager.ts — R103 J-01 USDT Points Manager
 *
 * Atomic balance management with deduct/deposit/ledger operations.
 * All balances have 6 decimal precision. Operations are atomic
 * (check → modify → record). Insufficient balance throws PointsInsufficientError.
 *
 * Ledger table: id / userId / amount / type / reason / tradeId / balanceAfter / timestamp
 */

import type { FiatCurrency } from './exchange-rate-engine';

// ─── Types ───

export type TxType = 'charge' | 'trade_fee' | 'p2p_fee' | 'withdraw';

export interface LedgerEntry {
  id: string;
  userId: string;
  amount: number;
  type: TxType;
  reason: string;
  tradeId?: string;
  balanceAfter: number;
  timestamp: number;
}

export interface PointsResult {
  success: boolean;
  newBalance: number;
}

export interface DeductResult extends PointsResult {
  error?: string;
}

export class PointsInsufficientError extends Error {
  public code = 'INSUFFICIENT_BALANCE';
  constructor(public userId: string, public required: number, public balance: number) {
    super(`Insufficient balance for ${userId}: required ${required}, balance ${balance}`);
    this.name = 'PointsInsufficientError';
  }
}

export class PointsInvalidAmountError extends Error {
  public code = 'INVALID_AMOUNT';
  constructor(amount: number) {
    super(`Invalid amount: ${amount}. Must be > 0.`);
    this.name = 'PointsInvalidAmountError';
  }
}

// ─── Precision ───

const USDT_DECIMALS = 6;

function round(value: number): number {
  const factor = Math.pow(10, USDT_DECIMALS);
  return Math.round(value * factor) / factor;
}

// ─── Storage ───

/** In-memory balance store (per user) */
const balanceStore = new Map<string, number>();

/** In-memory ledger store */
const ledgerStore: LedgerEntry[] = [];

/** For generating sequential IDs */
let ledgerSeq = 0;

// ─── Manager ───

export class USDTPointsManager {
  /**
   * Get current balance for a user. Returns 0 if user has no balance record.
   */
  getBalance(userId: string): number {
    return round(balanceStore.get(userId) ?? 0);
  }

  /**
   * Atomically deduct points.
   * Throws PointsInsufficientError if balance < amount.
   * Throws PointsInvalidAmountError if amount <= 0.
   */
  deduct(userId: string, amount: number, reason: string, tradeId?: string): DeductResult {
    if (amount <= 0) {
      throw new PointsInvalidAmountError(amount);
    }

    const roundedAmount = round(amount);
    const currentBalance = this.getBalance(userId);

    if (currentBalance < roundedAmount) {
      return {
        success: false,
        newBalance: currentBalance,
        error: `Insufficient balance: need ${roundedAmount}, have ${currentBalance}`,
      };
    }

    const newBalance = round(currentBalance - roundedAmount);
    balanceStore.set(userId, newBalance);

    this.writeLedger(userId, -roundedAmount, 'trade_fee', reason, tradeId, newBalance);

    return { success: true, newBalance };
  }

  /**
   * Deposit points (charge).
   * Throws PointsInvalidAmountError if amount <= 0.
   */
  deposit(userId: string, amount: number, source: string): PointsResult {
    if (amount <= 0) {
      throw new PointsInvalidAmountError(amount);
    }

    const roundedAmount = round(amount);
    const currentBalance = this.getBalance(userId);
    const newBalance = round(currentBalance + roundedAmount);
    balanceStore.set(userId, newBalance);

    this.writeLedger(userId, roundedAmount, 'charge', source, undefined, newBalance);

    return { success: true, newBalance };
  }

  /**
   * Get ledger entries for a user, paginated.
   */
  getLedger(userId: string, limit = 20, offset = 0): LedgerEntry[] {
    return ledgerStore
      .filter(e => e.userId === userId)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(offset, offset + limit);
  }

  /**
   * Get all ledger entries (for admin/testing).
   */
  getAllLedger(): LedgerEntry[] {
    return [...ledgerStore].sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Check if user has enough balance for a given amount.
   */
  canDeduct(userId: string, amount: number): boolean {
    return this.getBalance(userId) >= round(amount);
  }

  /**
   * Reset user balance (for testing).
   */
  setBalance(userId: string, newBalance: number): void {
    balanceStore.set(userId, round(newBalance));
  }

  /**
   * Clear all data (for testing).
   */
  reset(): void {
    balanceStore.clear();
    ledgerStore.length = 0;
    ledgerSeq = 0;
  }

  /**
   * Get total user count.
   */
  getUserCount(): number {
    return balanceStore.size;
  }

  /**
   * Get total ledger count.
   */
  getLedgerCount(): number {
    return ledgerStore.length;
  }

  // ─── Private ───

  private writeLedger(
    userId: string,
    amount: number,
    type: TxType,
    reason: string,
    tradeId: string | undefined,
    balanceAfter: number,
  ): void {
    ledgerSeq++;
    const entry: LedgerEntry = {
      id: `L${String(ledgerSeq).padStart(6, '0')}`,
      userId,
      amount: round(amount),
      type,
      reason,
      tradeId,
      balanceAfter: round(balanceAfter),
      timestamp: Date.now(),
    };
    ledgerStore.push(entry);
  }
}

// ─── Singleton ───

let _manager: USDTPointsManager | null = null;

export function getUSDTPointsManager(): USDTPointsManager {
  if (!_manager) {
    _manager = new USDTPointsManager();
  }
  return _manager;
}

export const usdtPointsManager = getUSDTPointsManager();

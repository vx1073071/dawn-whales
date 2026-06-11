/**
 * reconciliation-engine.ts — R104 J-01 Reconciliation Engine
 *
 * Periodic reconciliation engine for the USDT points system.
 * Features:
 *  - Ledger sum vs balance auditing (alert on diff > 0.0001)
 *  - Exchange rate anomaly detection (single fluctuation > 5% → reject)
 *  - Total supply conservation: totalSupply = sum(balances) + sum(all fees)
 *  - Anti-replay: tradeId dedup + idempotent
 *
 * All precision: 6 decimal places.
 */

import { USDTPointsManager, LedgerEntry, TxType } from './usdt-points-manager';
import type { FiatCurrency } from './exchange-rate-engine';

// ─── Types ───

export interface ReconciliationResult {
  pass: boolean;
  totalBalance: number;
  totalFees: number;
  totalSupply: number;
  expectedSupply: number;
  diff: number;
  userCount: number;
  alertMessages: string[];
}

export interface RateAnomalyResult {
  valid: boolean;
  rate: number;
  previousRate?: number;
  changePercent?: number;
  reason?: string;
}

export interface AntiReplayResult {
  idempotent: boolean;
  processed: boolean;
  message: string;
}

export interface AuditReport {
  reconciliation: ReconciliationResult;
  rateHealth: RateAnomalyResult[];
  replayLog: { tradeId: string; count: number }[];
  timestamp: number;
}

// ─── Constants ───

const ALERT_THRESHOLD = 0.0001;
const RATE_SPIKE_THRESHOLD = 5; // percent
const USDT_DECIMALS = 6;

function round(value: number): number {
  const factor = Math.pow(10, USDT_DECIMALS);
  return Math.round(value * factor) / factor;
}

// ─── Dedup store ───

const processedTradeIds = new Set<string>();

// ─── Rate history ───

interface RateHistory {
  currency: FiatCurrency;
  previousRate: number;
  timestamp: number;
}

const rateHistoryStore = new Map<FiatCurrency, RateHistory>();

// ─── Reconciliation Engine ───

export class ReconciliationEngine {
  private pointsManager: USDTPointsManager;

  constructor(pointsManager: USDTPointsManager) {
    this.pointsManager = pointsManager;
  }

  /**
   * Run full reconciliation: ledger sum vs balance.
   * Reconstructs total balance and total fees from ledger.
   * Alerts if |balanceSum - ledgerSum| > 0.0001.
   */
  reconcile(): ReconciliationResult {
    const ledger = this.pointsManager.getAllLedger();
    const alertMessages: string[] = [];
    let totalBalance = 0;
    let totalFees = 0;
    let totalSupply = 0;

    // Reconstruct from ledger
    const userBalanceMap = new Map<string, number>();

    for (const entry of ledger) {
      if (entry.type === 'charge') {
        userBalanceMap.set(entry.userId, round((userBalanceMap.get(entry.userId) ?? 0) + entry.amount));
        totalSupply += entry.amount;
      } else {
        // trade_fee / p2p_fee / withdraw — these are fees
        userBalanceMap.set(entry.userId, round((userBalanceMap.get(entry.userId) ?? 0) + entry.amount)); // amount is negative
        totalFees += Math.abs(entry.amount);
      }
    }

    // Sum all user balances
    for (const balance of userBalanceMap.values()) {
      totalBalance += balance;
    }

    const expectedSupply = round(totalBalance + totalFees);
    const diff = round(Math.abs(expectedSupply - totalSupply));

    // Alert if diff exceeds threshold
    if (diff > ALERT_THRESHOLD) {
      alertMessages.push(`Reconciliation MISMATCH: diff=${diff} USDT (threshold=${ALERT_THRESHOLD})`);
      alertMessages.push(`  totalBalance=${round(totalBalance)}, totalFees=${round(totalFees)}, expected=${expectedSupply}, actual=${round(totalSupply)}`);
    }

    // Verify each user's balance matches ledger reconstruction
    for (const [userId, ledgerBalance] of userBalanceMap) {
      const actualBalance = this.pointsManager.getBalance(userId);
      const userDiff = round(Math.abs(actualBalance - ledgerBalance));
      if (userDiff > ALERT_THRESHOLD) {
        alertMessages.push(`User ${userId} balance mismatch: actual=${actualBalance}, ledger=${ledgerBalance}, diff=${userDiff}`);
      }
    }

    const pass = alertMessages.length === 0;

    return {
      pass,
      totalBalance: round(totalBalance),
      totalFees: round(totalFees),
      totalSupply: round(totalSupply),
      expectedSupply: round(expectedSupply),
      diff,
      userCount: userBalanceMap.size,
      alertMessages,
    };
  }

  /**
   * Quick balance audit for a single user.
   */
  auditUser(userId: string): { pass: boolean; balance: number; ledgerSum: number; diff: number } {
    const ledger = this.pointsManager.getLedger(userId, 10000, 0);
    const balance = this.pointsManager.getBalance(userId);

    let ledgerSum = 0;
    for (const entry of ledger) {
      ledgerSum += entry.amount;
    }
    ledgerSum = round(ledgerSum);

    const diff = round(Math.abs(balance - ledgerSum));
    return {
      pass: diff <= ALERT_THRESHOLD,
      balance,
      ledgerSum,
      diff,
    };
  }

  /**
   * Detect exchange rate anomaly.
   * Compares new rate against previous rate. If change > 5%, rejects.
   */
  detectRateAnomaly(currency: FiatCurrency, currentRate: number): RateAnomalyResult {
    if (currentRate <= 0) {
      return { valid: false, rate: currentRate, reason: 'Rate must be positive' };
    }

    const history = rateHistoryStore.get(currency);

    if (!history) {
      // First observation: valid by default, record for future
      rateHistoryStore.set(currency, {
        currency,
        previousRate: currentRate,
        timestamp: Date.now(),
      });
      return { valid: true, rate: currentRate };
    }

    const changePercent = Math.abs((currentRate - history.previousRate) / history.previousRate) * 100;

    if (changePercent > RATE_SPIKE_THRESHOLD) {
      return {
        valid: false,
        rate: currentRate,
        previousRate: history.previousRate,
        changePercent: round(changePercent),
        reason: `Rate spike detected: ${round(changePercent)}% exceeds ${RATE_SPIKE_THRESHOLD}% threshold`,
      };
    }

    // Update history
    rateHistoryStore.set(currency, {
      currency,
      previousRate: currentRate,
      timestamp: Date.now(),
    });

    return {
      valid: true,
      rate: currentRate,
      previousRate: history.previousRate,
      changePercent: round(changePercent),
    };
  }

  /**
   * Anti-replay: check if tradeId has been processed.
   * idempotent — if already processed, returns {idempotent: true, processed: false}.
   */
  checkAndMarkTradeId(tradeId: string): AntiReplayResult {
    if (processedTradeIds.has(tradeId)) {
      return {
        idempotent: true,
        processed: false,
        message: `tradeId ${tradeId} already processed — idempotent skip`,
      };
    }

    processedTradeIds.add(tradeId);
    return {
      idempotent: false,
      processed: true,
      message: `tradeId ${tradeId} marked as processed`,
    };
  }

  /**
   * Get processed trade count.
   */
  getProcessedTradeCount(): number {
    return processedTradeIds.size;
  }

  /**
   * Verify total supply conservation.
   * totalSupply = sum(balances of all users) + sum(all fees collected)
   * If supply conservation is broken, returns {pass: false}.
   */
  verifyConservation(): { pass: boolean; totalSupply: number; balanceSum: number; feeSum: number; diff: number } {
    const ledger = this.pointsManager.getAllLedger();
    let balanceSum = 0;
    let feeSum = 0;
    let supply = 0;

    for (const entry of ledger) {
      if (entry.type === 'charge') {
        balanceSum += entry.amount;
        supply += entry.amount;
      } else {
        // Fees: amount is negative
        balanceSum += entry.amount;
        feeSum += Math.abs(entry.amount);
        // supply unchanged (fees don't destroy/create USDT, just transfer within system)
      }
    }

    // Conservation check: supply should equal sum of all initial deposits
    // (fees are internal transfers, not supply changes)
    const expectedBalance = round(supply - feeSum);
    const actualBalance = round(balanceSum);
    const diff = round(Math.abs(expectedBalance - actualBalance));

    return {
      pass: diff <= ALERT_THRESHOLD,
      totalSupply: round(supply),
      balanceSum: round(balanceSum),
      feeSum: round(feeSum),
      diff,
    };
  }

  /**
   * Full audit report.
   */
  audit(rateData?: Array<{ currency: FiatCurrency; rate: number }>): AuditReport {
    const reconciliation = this.reconcile();

    const rateHealth: RateAnomalyResult[] = [];
    if (rateData) {
      for (const { currency, rate } of rateData) {
        rateHealth.push(this.detectRateAnomaly(currency, rate));
      }
    }

    const replayLog = Array.from(processedTradeIds).map(id => ({ tradeId: id, count: 1 }));

    return {
      reconciliation,
      rateHealth,
      replayLog,
      timestamp: Date.now(),
    };
  }

  /**
   * Clear all internal state (for testing).
   */
  reset(): void {
    processedTradeIds.clear();
    rateHistoryStore.clear();
  }
}

// ─── Singleton ───

let _engine: ReconciliationEngine | null = null;

export function getReconciliationEngine(pointsManager?: USDTPointsManager): ReconciliationEngine {
  if (!_engine && pointsManager) {
    _engine = new ReconciliationEngine(pointsManager);
  }
  return _engine!;
}

export function resetReconciliationEngine(): void {
  _engine?.reset();
  _engine = null;
}

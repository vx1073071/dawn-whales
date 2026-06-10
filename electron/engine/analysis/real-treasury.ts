/**
 * J-V15-03: Real Treasury Engine (R53 v15 商业模型定版)
 * 实时热/冷钱包余额监控 + 流动性安全管理
 *
 * Features:
 * - Hot wallet: 20% of total treasury (for daily operations)
 * - Cold wallet: 80% of total treasury (reserve)
 * - Real-time balance tracking (deposits/withdrawals/transfers)
 * - Liquidity alerts (hot wallet below threshold)
 * - Treasury health report
 * - Transaction audit trail
 *
 * ≥300L, 20+ tests
 */

import log from 'electron-log';
import { EventEmitter } from 'events';
import { EngineError, ErrorCode } from '../../errors';


// ── Types ──────────────────────────────────────────────────────────────────

export type WalletType = 'hot' | 'cold';
export type TxType = 'deposit' | 'withdrawal' | 'hot_to_cold' | 'cold_to_hot' | 'fee_income' | 'creator_payout';
export type AlertLevel = 'info' | 'warning' | 'critical';
export type TxStatus = 'pending' | 'confirmed' | 'failed';

export interface WalletBalance {
  type: WalletType;
  balanceUSDT: number;
  lastUpdated: string;
  pendingDeposits: number;
  pendingWithdrawals: number;
}

export interface TreasuryTransaction {
  id: string;
  type: TxType;
  wallet: WalletType;
  amountUSDT: number;
  balanceAfter: number;
  counterparty?: string; // userId for deposit/withdrawal, 'treasury' for transfers
  reference?: string;
  status: TxStatus;
  createdAt: string;
  confirmedAt?: string;
}

export interface TreasuryAlert {
  id: string;
  level: AlertLevel;
  message: string;
  walletType: WalletType;
  balanceUSDT: number;
  threshold: number;
  createdAt: string;
  acknowledged: boolean;
}

export interface TreasuryHealthReport {
  totalTreasury: number;
  hotBalance: number;
  coldBalance: number;
  hotPercent: number;
  coldPercent: number;
  pendingDeposits: number;
  pendingWithdrawals: number;
  monthlyInflow: number;
  monthlyOutflow: number;
  netFlow: number;
  liquidityRatio: number;    // total treasury / monthly outflow
  healthStatus: 'healthy' | 'warning' | 'critical';
  alerts: TreasuryAlert[];
  generatedAt: string;
}

// ── Thresholds ─────────────────────────────────────────────────────────────

interface TreasuryThresholds {
  hotMinBalanceUSDT: number;      // Alert if hot wallet below this
  hotMinPercent: number;          // Alert if hot wallet below this % of total
  hotMaxPercent: number;          // Alert if hot wallet above this % of total
  largeTransactionUSDT: number;   // Alert for transactions above this
  liquidityRatioMin: number;      // Alert if treasury/monthly-outflow < this
}

const DEFAULT_THRESHOLDS: TreasuryThresholds = {
  hotMinBalanceUSDT: 10000,
  hotMinPercent: 10,
  hotMaxPercent: 40,
  largeTransactionUSDT: 50000,
  liquidityRatioMin: 3,
};

// ── Real Treasury Engine ───────────────────────────────────────────────────

export class RealTreasury extends EventEmitter {
  private hotBalance: number;
  private coldBalance: number;
  private transactions: Map<string, TreasuryTransaction> = new Map();
  private alerts: TreasuryAlert[] = [];
  private thresholds: TreasuryThresholds;
  private idCounter = 1;
  private pendingDeposits: number = 0;
  private pendingWithdrawals: number = 0;

  constructor(initialHot: number = 0, initialCold: number = 0, thresholds?: Partial<TreasuryThresholds>) {
    super();
    this.hotBalance = initialHot;
    this.coldBalance = initialCold;
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
    log.info(`[RealTreasury] Initialized: hot=$${initialHot}, cold=$${initialCold} USDT`);
  }

  // ── Balance Queries ────────────────────────────────────────────────────

  getWalletBalance(type: WalletType): WalletBalance {
    return {
      type,
      balanceUSDT: type === 'hot' ? this.hotBalance : this.coldBalance,
      lastUpdated: new Date().toISOString(),
      pendingDeposits: this.pendingDeposits,
      pendingWithdrawals: this.pendingWithdrawals,
    };
  }

  getTotalTreasury(): number {
    return this.hotBalance + this.coldBalance;
  }

  getHotPercent(): number {
    const total = this.getTotalTreasury();
    return total > 0 ? Math.round((this.hotBalance / total) * 10000) / 100 : 0;
  }

  getColdPercent(): number {
    return Math.round((100 - this.getHotPercent()) * 100) / 100;
  }

  // ── Deposits ───────────────────────────────────────────────────────────

  deposit(amountUSDT: number, userId: string, reference?: string): TreasuryTransaction {
    if (amountUSDT <= 0) throw new EngineError(ErrorCode.INTERNAL_ERROR, 'Deposit amount must be positive');

    this.hotBalance += amountUSDT;
    const now = new Date().toISOString();
    const tx: TreasuryTransaction = {
      id: `ttx_${this.idCounter++}`,
      type: 'deposit',
      wallet: 'hot',
      amountUSDT,
      balanceAfter: this.hotBalance,
      counterparty: userId,
      reference,
      status: 'confirmed',
      createdAt: now,
      confirmedAt: now,
    };

    this.transactions.set(tx.id, tx);
    this.checkThresholds();
    this.emit('treasury:deposit', tx);
    log.info(`[RealTreasury] Deposit: +$${amountUSDT} USDT from ${userId} (hot: $${this.hotBalance})`);
    return tx;
  }

  // ── Withdrawals ────────────────────────────────────────────────────────

  withdraw(amountUSDT: number, userId: string, reference?: string): TreasuryTransaction | null {
    if (amountUSDT <= 0) throw new EngineError(ErrorCode.INTERNAL_ERROR, 'Withdrawal amount must be positive');
    if (amountUSDT > this.hotBalance) {
      log.warn(`[RealTreasury] Insufficient hot wallet: need $${amountUSDT}, have $${this.hotBalance}`);
      this.addAlert('critical', `Withdrawal failed: insufficient hot wallet balance ($${this.hotBalance} < $${amountUSDT})`, 'hot', this.hotBalance, amountUSDT);
      return null;
    }

    this.hotBalance -= amountUSDT;
    const now = new Date().toISOString();
    const tx: TreasuryTransaction = {
      id: `ttx_${this.idCounter++}`,
      type: 'withdrawal',
      wallet: 'hot',
      amountUSDT,
      balanceAfter: this.hotBalance,
      counterparty: userId,
      reference,
      status: 'confirmed',
      createdAt: now,
      confirmedAt: now,
    };

    this.transactions.set(tx.id, tx);
    this.checkThresholds();
    this.emit('treasury:withdrawal', tx);
    log.info(`[RealTreasury] Withdrawal: -$${amountUSDT} USDT to ${userId} (hot: $${this.hotBalance})`);
    return tx;
  }

  // ── Treasury Transfers (hot ↔ cold) ────────────────────────────────────

  transferHotToCold(amountUSDT: number): TreasuryTransaction | null {
    if (amountUSDT <= 0 || amountUSDT > this.hotBalance) return null;

    this.hotBalance -= amountUSDT;
    this.coldBalance += amountUSDT;
    const now = new Date().toISOString();
    const tx: TreasuryTransaction = {
      id: `ttx_${this.idCounter++}`,
      type: 'hot_to_cold',
      wallet: 'hot',
      amountUSDT,
      balanceAfter: this.hotBalance,
      counterparty: 'treasury',
      status: 'confirmed',
      createdAt: now,
      confirmedAt: now,
    };

    this.transactions.set(tx.id, tx);
    this.checkThresholds();
    this.emit('treasury:transfer', tx);
    log.info(`[RealTreasury] Transfer hot→cold: $${amountUSDT} USDT (hot: $${this.hotBalance}, cold: $${this.coldBalance})`);
    return tx;
  }

  transferColdToHot(amountUSDT: number): TreasuryTransaction | null {
    if (amountUSDT <= 0 || amountUSDT > this.coldBalance) return null;

    this.coldBalance -= amountUSDT;
    this.hotBalance += amountUSDT;
    const now = new Date().toISOString();
    const tx: TreasuryTransaction = {
      id: `ttx_${this.idCounter++}`,
      type: 'cold_to_hot',
      wallet: 'cold',
      amountUSDT,
      balanceAfter: this.coldBalance,
      counterparty: 'treasury',
      status: 'confirmed',
      createdAt: now,
      confirmedAt: now,
    };

    this.transactions.set(tx.id, tx);
    this.checkThresholds();
    this.emit('treasury:transfer', tx);
    log.info(`[RealTreasury] Transfer cold→hot: $${amountUSDT} USDT (hot: $${this.hotBalance}, cold: $${this.coldBalance})`);
    return tx;
  }

  // ── Fee Income ─────────────────────────────────────────────────────────

  recordFeeIncome(amountUSDT: number, reference?: string): TreasuryTransaction {
    if (amountUSDT <= 0) throw new EngineError(ErrorCode.INTERNAL_ERROR, 'Fee income must be positive');

    this.hotBalance += amountUSDT;
    const now = new Date().toISOString();
    const tx: TreasuryTransaction = {
      id: `ttx_${this.idCounter++}`,
      type: 'fee_income',
      wallet: 'hot',
      amountUSDT,
      balanceAfter: this.hotBalance,
      reference,
      status: 'confirmed',
      createdAt: now,
      confirmedAt: now,
    };

    this.transactions.set(tx.id, tx);
    this.emit('treasury:fee_income', tx);
    return tx;
  }

  // ── Creator Payouts ────────────────────────────────────────────────────

  recordCreatorPayout(amountUSDT: number, creatorId: string, reference?: string): TreasuryTransaction | null {
    if (amountUSDT <= 0 || amountUSDT > this.hotBalance) return null;

    this.hotBalance -= amountUSDT;
    const now = new Date().toISOString();
    const tx: TreasuryTransaction = {
      id: `ttx_${this.idCounter++}`,
      type: 'creator_payout',
      wallet: 'hot',
      amountUSDT,
      balanceAfter: this.hotBalance,
      counterparty: creatorId,
      reference,
      status: 'confirmed',
      createdAt: now,
      confirmedAt: now,
    };

    this.transactions.set(tx.id, tx);
    this.checkThresholds();
    this.emit('treasury:creator_payout', tx);
    log.info(`[RealTreasury] Creator payout: -$${amountUSDT} USDT to ${creatorId} (hot: $${this.hotBalance})`);
    return tx;
  }

  // ── Alert System ───────────────────────────────────────────────────────

  private addAlert(level: AlertLevel, message: string, walletType: WalletType, balance: number, threshold: number): void {
    const alert: TreasuryAlert = {
      id: `alert_${this.idCounter++}`,
      level,
      message,
      walletType,
      balanceUSDT: balance,
      threshold,
      createdAt: new Date().toISOString(),
      acknowledged: false,
    };
    this.alerts.push(alert);
    this.emit('treasury:alert', alert);
  }

  private checkThresholds(): void {
    const hotPercent = this.getHotPercent();
    const total = this.getTotalTreasury();

    // Hot wallet too low
    if (this.hotBalance < this.thresholds.hotMinBalanceUSDT) {
      this.addAlert('critical', `Hot wallet balance ($${this.hotBalance}) below minimum ($${this.thresholds.hotMinBalanceUSDT})`, 'hot', this.hotBalance, this.thresholds.hotMinBalanceUSDT);
    }

    // Hot wallet percent too low
    if (total > 0 && hotPercent < this.thresholds.hotMinPercent) {
      this.addAlert('warning', `Hot wallet ${hotPercent}% below minimum ${this.thresholds.hotMinPercent}%`, 'hot', this.hotBalance, total * this.thresholds.hotMinPercent / 100);
    }

    // Hot wallet percent too high
    if (total > 0 && hotPercent > this.thresholds.hotMaxPercent) {
      this.addAlert('warning', `Hot wallet ${hotPercent}% above maximum ${this.thresholds.hotMaxPercent}%`, 'hot', this.hotBalance, total * this.thresholds.hotMaxPercent / 100);
    }
  }

  getAlerts(unacknowledgedOnly: boolean = false): TreasuryAlert[] {
    if (unacknowledgedOnly) return this.alerts.filter(a => !a.acknowledged);
    return [...this.alerts];
  }

  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (!alert) return false;
    alert.acknowledged = true;
    return true;
  }

  acknowledgeAllAlerts(): number {
    let count = 0;
    for (const alert of this.alerts) {
      if (!alert.acknowledged) {
        alert.acknowledged = true;
        count++;
      }
    }
    return count;
  }

  // ── Health Report ──────────────────────────────────────────────────────

  getHealthReport(): TreasuryHealthReport {
    const total = this.getTotalTreasury();
    const transactions = Array.from(this.transactions.values());
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const monthlyTxs = transactions.filter(t => t.createdAt >= monthStart && t.status === 'confirmed');
    const inflow = monthlyTxs
      .filter(t => t.type === 'deposit' || t.type === 'fee_income' || t.type === 'cold_to_hot')
      .reduce((s, t) => s + t.amountUSDT, 0);
    const outflow = monthlyTxs
      .filter(t => t.type === 'withdrawal' || t.type === 'creator_payout' || t.type === 'hot_to_cold')
      .reduce((s, t) => s + t.amountUSDT, 0);

    const liquidityRatio = outflow > 0 ? Math.round((total / outflow) * 100) / 100 : Infinity;

    let healthStatus: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (this.hotBalance < this.thresholds.hotMinBalanceUSDT) {
      healthStatus = 'critical';
    } else if (liquidityRatio < this.thresholds.liquidityRatioMin && outflow > 0) {
      healthStatus = 'warning';
    }

    return {
      totalTreasury: Math.round(total * 100) / 100,
      hotBalance: Math.round(this.hotBalance * 100) / 100,
      coldBalance: Math.round(this.coldBalance * 100) / 100,
      hotPercent: this.getHotPercent(),
      coldPercent: this.getColdPercent(),
      pendingDeposits: this.pendingDeposits,
      pendingWithdrawals: this.pendingWithdrawals,
      monthlyInflow: Math.round(inflow * 100) / 100,
      monthlyOutflow: Math.round(outflow * 100) / 100,
      netFlow: Math.round((inflow - outflow) * 100) / 100,
      liquidityRatio,
      healthStatus,
      alerts: this.getAlerts(true),
      generatedAt: new Date().toISOString(),
    };
  }

  // ── Transaction Queries ────────────────────────────────────────────────

  getTransactions(filter?: { type?: TxType; status?: TxStatus }): TreasuryTransaction[] {
    let txs = Array.from(this.transactions.values());
    if (filter?.type) txs = txs.filter(t => t.type === filter.type);
    if (filter?.status) txs = txs.filter(t => t.status === filter.status);
    return txs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  // ── Reset ──────────────────────────────────────────────────────────────

  reset(): void {
    this.hotBalance = 0;
    this.coldBalance = 0;
    this.transactions.clear();
    this.alerts = [];
    this.pendingDeposits = 0;
    this.pendingWithdrawals = 0;
    this.idCounter = 1;
    log.info('[RealTreasury] Reset');
  }

  get transactionCount(): number {
    return this.transactions.size;
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let _instance: RealTreasury | null = null;

export function getRealTreasury(initialHot?: number, initialCold?: number): RealTreasury {
  if (!_instance) _instance = new RealTreasury(initialHot, initialCold);
  return _instance;
}

export function resetRealTreasury(): void {
  _instance?.reset();
  _instance = null;
}

export default RealTreasury;

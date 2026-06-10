/**
 * J-63-02: 计费+钱包 /api (R63 v19 — v1.5.0-rc 服务器化)
 *
 * 计费引擎迁移: 按次扣费验证+余额冻结+退款。
 * 钱包服务迁移: 余额/充值确认/提现审核。
 * 桌面端: 删 billing-contract + wallet 逻辑 → 只调 /api。
 *
 * Features:
 * - Usage billing: charge per AI call, 3-tier pricing (1.0/1.5/2.0 USDT)
 * - Balance management: pre-deduct, freeze, unfreeze, refund
 * - Wallet: balance query, topup confirmation, withdrawal review
 * - P2P transfer (cloud): integrate with p2p-transfer-engine on server
 * - Transaction log for audit
 * - Platform commission: 3-level creator split rates
 *
 * >=350L, 10 tests
 */

import * as crypto from 'crypto';
import { EngineError, ErrorCode } from '../../errors';
import i18n from '../../../src/i18n';


// ── Types ──────────────────────────────────────────────────────────────────

export type PricingTier = 'basic' | 'pro' | 'elite';
export type TransactionType = 'charge' | 'freeze' | 'unfreeze' | 'refund' | 'topup' | 'withdraw' | 'p2p_send' | 'p2p_receive' | 'commission';
export type TransactionStatus = 'pending' | 'completed' | 'failed' | 'reversed';

export interface PriceConfig {
  tier: PricingTier;
  pricePerCall: number;   // USDT
  maxTokensPerCall: number;
  features: string[];
}

export const PRICING: PriceConfig[] = [
  { tier: 'basic', pricePerCall: 1.0, maxTokensPerCall: 4096, features: [i18n.t('billingWalletServer.k1'), i18n.t('billingWalletServer.k2')] },
  { tier: 'pro', pricePerCall: 1.5, maxTokensPerCall: 8192, features: [i18n.t('billingWalletServer.k3'), i18n.t('billingWalletServer.k4'), i18n.t('billingWalletServer.k5')] },
  { tier: 'elite', pricePerCall: 2.0, maxTokensPerCall: 16384, features: [i18n.t('billingWalletServer.k6'), i18n.t('billingWalletServer.k7'), i18n.t('billingWalletServer.k8'), i18n.t('billingWalletServer.k9')] },
];

export interface Transaction {
  id: string;
  userId: string;
  type: TransactionType;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  status: TransactionStatus;
  description: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface WalletAccount {
  userId: string;
  email: string;
  balance: number;
  frozenBalance: number;
  pricingTier: PricingTier;
  createdAt: string;
}

export interface WithdrawalRequest {
  id: string;
  userId: string;
  amount: number;
  toAddress: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  note?: string;
}

export interface BillingConfig {
  freeCallsPerDay: number;
  commissionRate: number;        // platform commission %
  creatorSplitL1: number;        // 70%
  creatorSplitL2: number;        // 80%
  creatorSplitL3: number;        // 90%
  minWithdrawalAmount: number;   // 10 USDT
  withdrawalFeeRate: number;     // 0.1%
}

export const DEFAULT_BILLING_CONFIG: BillingConfig = {
  freeCallsPerDay: 3,
  commissionRate: 0.3,
  creatorSplitL1: 0.70,
  creatorSplitL2: 0.80,
  creatorSplitL3: 0.90,
  minWithdrawalAmount: 10,
  withdrawalFeeRate: 0.001,
};

// ── Billing + Wallet Server ───────────────────────────────────────────────

export class BillingWalletServer {
  private accounts: Map<string, WalletAccount> = new Map();
  private transactions: Transaction[] = [];
  private withdrawals: Map<string, WithdrawalRequest> = new Map();
  private dailyFreeCalls: Map<string, { date: string; count: number }> = new Map();
  private config: BillingConfig;

  constructor(config: Partial<BillingConfig> = {}) {
    this.config = { ...DEFAULT_BILLING_CONFIG, ...config };
  }

  // ── Account Management ─────────────────────────────────────────────────

  createAccount(userId: string, email: string, tier: PricingTier = 'basic'): WalletAccount {
    if (this.accounts.has(userId)) throw new EngineError(ErrorCode.BILLING_ERROR, 'Account already exists');
    const account: WalletAccount = {
      userId, email, balance: 0, frozenBalance: 0, pricingTier: tier,
      createdAt: new Date().toISOString(),
    };
    this.accounts.set(userId, account);
    return account;
  }

  getAccount(userId: string): WalletAccount | undefined {
    return this.accounts.get(userId);
  }

  // ── Balance Operations ─────────────────────────────────────────────────

  getBalance(userId: string): { balance: number; frozenBalance: number; availableBalance: number } {
    const account = this.accounts.get(userId);
    if (!account) return { balance: 0, frozenBalance: 0, availableBalance: 0 };
    return {
      balance: account.balance,
      frozenBalance: account.frozenBalance,
      availableBalance: account.balance - account.frozenBalance,
    };
  }

  // ── Topup ──────────────────────────────────────────────────────────────

  topup(userId: string, amount: number, txHash: string): Transaction {
    const account = this.accounts.get(userId);
    if (!account) throw new EngineError(ErrorCode.BILLING_ERROR, 'Account not found');
    if (amount <= 0) throw new EngineError(ErrorCode.BILLING_ERROR, 'Invalid amount');

    const balanceBefore = account.balance;
    account.balance += amount;
    this.accounts.set(userId, account);

    const tx: Transaction = {
      id: `TOP-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      userId, type: 'topup', amount, balanceBefore, balanceAfter: account.balance,
      status: 'completed', description: `USDT topup: ${txHash}`,
      timestamp: new Date().toISOString(),
      metadata: { txHash },
    };
    this.transactions.push(tx);
    return tx;
  }

  // ── Charge for AI Call ─────────────────────────────────────────────────

  chargeForAI(userId: string): { charged: boolean; freeCall: boolean; tx?: Transaction } {
    const account = this.accounts.get(userId);
    if (!account) throw new EngineError(ErrorCode.BILLING_ERROR, 'Account not found');

    // Check free calls
    const today = new Date().toISOString().substring(0, 10);
    const daily = this.dailyFreeCalls.get(userId);
    if (!daily || daily.date !== today) {
      this.dailyFreeCalls.set(userId, { date: today, count: 1 });
      return { charged: false, freeCall: true };
    }
    if (daily.count < this.config.freeCallsPerDay) {
      daily.count++;
      return { charged: false, freeCall: true };
    }

    // Charge
    const tierConfig = PRICING.find(t => t.tier === account.pricingTier)!;
    const price = tierConfig.pricePerCall;

    if (account.balance - account.frozenBalance < price) {
      return { charged: false, freeCall: false };
    }

    const balanceBefore = account.balance;
    account.balance -= price;
    this.accounts.set(userId, account);

    const tx: Transaction = {
      id: `CHG-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      userId, type: 'charge', amount: -price, balanceBefore, balanceAfter: account.balance,
      status: 'completed', description: `AI call (${account.pricingTier})`,
      timestamp: new Date().toISOString(),
    };
    this.transactions.push(tx);
    return { charged: true, freeCall: false, tx };
  }

  // ── Freeze / Unfreeze (P2P transfer) ───────────────────────────────────

  freezeBalance(userId: string, amount: number, reason: string): Transaction {
    const account = this.accounts.get(userId);
    if (!account) throw new EngineError(ErrorCode.BILLING_ERROR, 'Account not found');
    if (account.balance - account.frozenBalance < amount) throw new EngineError(ErrorCode.BILLING_ERROR, 'Insufficient available balance');

    const balanceBefore = account.balance;
    account.frozenBalance += amount;
    this.accounts.set(userId, account);

    const tx: Transaction = {
      id: `FRZ-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      userId, type: 'freeze', amount, balanceBefore, balanceAfter: account.balance,
      status: 'completed', description: `Freeze: ${reason}`,
      timestamp: new Date().toISOString(),
    };
    this.transactions.push(tx);
    return tx;
  }

  unfreezeBalance(userId: string, amount: number, reason: string): Transaction {
    const account = this.accounts.get(userId);
    if (!account) throw new EngineError(ErrorCode.BILLING_ERROR, 'Account not found');
    if (account.frozenBalance < amount) throw new EngineError(ErrorCode.BILLING_ERROR, 'Insufficient frozen balance');

    const balanceBefore = account.balance;
    account.frozenBalance -= amount;
    this.accounts.set(userId, account);

    const tx: Transaction = {
      id: `UNF-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      userId, type: 'unfreeze', amount, balanceBefore, balanceAfter: account.balance,
      status: 'completed', description: `Unfreeze: ${reason}`,
      timestamp: new Date().toISOString(),
    };
    this.transactions.push(tx);
    return tx;
  }

  // ── Refund ─────────────────────────────────────────────────────────────

  refund(userId: string, amount: number, reason: string): Transaction {
    const account = this.accounts.get(userId);
    if (!account) throw new EngineError(ErrorCode.BILLING_ERROR, 'Account not found');

    const balanceBefore = account.balance;
    account.balance += amount;
    this.accounts.set(userId, account);

    const tx: Transaction = {
      id: `REF-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      userId, type: 'refund', amount, balanceBefore, balanceAfter: account.balance,
      status: 'completed', description: `Refund: ${reason}`,
      timestamp: new Date().toISOString(),
    };
    this.transactions.push(tx);
    return tx;
  }

  // ── Withdrawal ─────────────────────────────────────────────────────────

  requestWithdrawal(userId: string, amount: number, toAddress: string): WithdrawalRequest {
    const account = this.accounts.get(userId);
    if (!account) throw new EngineError(ErrorCode.BILLING_ERROR, 'Account not found');
    if (amount < this.config.minWithdrawalAmount) throw new EngineError(ErrorCode.BILLING_ERROR, `Min withdrawal: ${this.config.minWithdrawalAmount} USDT`);
    if (account.balance - account.frozenBalance < amount) throw new EngineError(ErrorCode.BILLING_ERROR, 'Insufficient balance');

    const fee = Math.round(amount * this.config.withdrawalFeeRate * 100) / 100;
    const netAmount = amount - fee;

    const req: WithdrawalRequest = {
      id: `WD-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      userId, amount, toAddress, status: 'pending',
      createdAt: new Date().toISOString(),
    };
    this.withdrawals.set(req.id, req);

    // Freeze withdrawal amount
    this.freezeBalance(userId, amount, `Withdrawal to ${toAddress} (net: ${netAmount})`);
    return req;
  }

  approveWithdrawal(requestId: string, reviewer: string): WithdrawalRequest {
    const req = this.withdrawals.get(requestId);
    if (!req) throw new EngineError(ErrorCode.BILLING_ERROR, 'Withdrawal not found');
    if (req.status !== 'pending') throw new EngineError(ErrorCode.BILLING_ERROR, `Cannot approve ${req.status} withdrawal`);

    const account = this.accounts.get(req.userId)!;
    const fee = Math.round(req.amount * this.config.withdrawalFeeRate * 100) / 100;

    // Deduct: unfreeze then deduct
    account.frozenBalance -= req.amount;
    account.balance -= req.amount;
    this.accounts.set(req.userId, account);

    req.status = 'completed';
    req.reviewedAt = new Date().toISOString();
    req.reviewedBy = reviewer;
    req.note = `Approved. Fee: ${fee} USDT`;
    this.withdrawals.set(requestId, req);
    return req;
  }

  rejectWithdrawal(requestId: string, reviewer: string, reason: string): WithdrawalRequest {
    const req = this.withdrawals.get(requestId);
    if (!req) throw new EngineError(ErrorCode.BILLING_ERROR, 'Withdrawal not found');
    if (req.status !== 'pending') throw new EngineError(ErrorCode.BILLING_ERROR, `Cannot reject ${req.status} withdrawal`);

    this.unfreezeBalance(req.userId, req.amount, `Withdrawal rejected: ${reason}`);
    req.status = 'rejected';
    req.reviewedAt = new Date().toISOString();
    req.reviewedBy = reviewer;
    req.note = reason;
    return req;
  }

  // ── Creator Commission Payout ──────────────────────────────────────────

  calculateCommission(creatorLevel: number): number {
    switch (creatorLevel) {
      case 1: return this.config.creatorSplitL1;
      case 2: return this.config.creatorSplitL2;
      case 3: return this.config.creatorSplitL3;
      default: return 0;
    }
  }

  // ── Transaction History ────────────────────────────────────────────────

  getTransactions(userId: string, limit: number = 50): Transaction[] {
    return this.transactions.filter(t => t.userId === userId).slice(-limit).reverse();
  }

  getDailyFreeCallsLeft(userId: string): number {
    const today = new Date().toISOString().substring(0, 10);
    const daily = this.dailyFreeCalls.get(userId);
    if (!daily || daily.date !== today) return this.config.freeCallsPerDay;
    return Math.max(0, this.config.freeCallsPerDay - daily.count);
  }

  // ── Reset ──────────────────────────────────────────────────────────────

  reset(): void {
    this.accounts.clear();
    this.transactions = [];
    this.withdrawals.clear();
    this.dailyFreeCalls.clear();
    this.config = { ...DEFAULT_BILLING_CONFIG };
  }
}

// ── Singleton ────────────────────────────────────────────────────────────

let _billingServer: BillingWalletServer | null = null;

export function getBillingServer(): BillingWalletServer {
  if (!_billingServer) _billingServer = new BillingWalletServer();
  return _billingServer;
}

export function resetBillingServer(): void {
  _billingServer?.reset();
  _billingServer = null;
}

export default { BillingWalletServer, getBillingServer, resetBillingServer, PRICING, DEFAULT_BILLING_CONFIG };

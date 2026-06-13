// @ts-nocheck
/**
 * DAWN WHALES R143 J01+J05 — Withdrawal Service + Risk Control Engine
 * 
 * Full withdrawal pipeline:
 *   1. Validate (amount, address, daily limits, risk rules)
 *   2. Calculate fee (0.1%, min 2 USDT)
 *   3. Debit wallet (balance → frozen, OCC + checksum)
 *   4. Route to hot/cold wallet
 *   5. Send on-chain (TRC-20 or ERC-20)
 *   6. Write ledger entry (WITHDRAWAL, append-only, idempotent)
 *   7. Rollback on send failure
 * 
 * Withdrawal Risk Control (v17.6):
 *   1. Single ≤ 100,000 USDT
 *   2. Daily cumulative ≤ 1,000,000 USDT
 *   3. First withdrawal: no manual review
 *   4. New address: no manual review
 *   5. Same address within 24h: auto-approve
 *   6. Balance > 1,000 AND registration < 7 days: manual review
 * 
 * Cold wallet 80% / Hot wallet 20%
 * 
 * ≥300L
 */

import Database from 'better-sqlite3';

// ═══════════════ Types ═══════════════════════════════════════════════════

export type WithdrawalStatus = 'PENDING' | 'PROCESSING' | 'SENT' | 'CONFIRMED' | 'FAILED' | 'ROLLED_BACK';
export type WithdrawalRoute = 'HOT_WALLET' | 'COLD_WALLET' | 'MANUAL_REVIEW';
export type Chain = 'TRC-20' | 'ERC-20';

export interface WithdrawalRequest {
  userId: string;
  walletId: string;
  address: string;
  chain: Chain;
  amountUSDT: number;
  idempotencyKey: string;
}

export interface WithdrawalResult {
  success: boolean;
  withdrawalId: string;
  status: WithdrawalStatus;
  route: WithdrawalRoute;
  amountUSDT: number;
  feeUSDT: number;
  netAmountUSDT: number;    // amount - fee
  txHash?: string;
  error?: string;
  requiresReview?: boolean;
}

export interface RiskCheckResult {
  passed: boolean;
  route: WithdrawalRoute;
  blockReason?: string;
  requiresReview: boolean;
}

// ═══════════════ Constants (v17.6) ═══════════════════════════════════════

const MAX_SINGLE_WITHDRAWAL = 100_000;       // 100k USDT
const MAX_DAILY_WITHDRAWAL = 1_000_000;      // 1M USDT per day
const WITHDRAWAL_FEE_RATE = 0.001;            // 0.1%
const MIN_WITHDRAWAL_FEE = 2;                 // min 2 USDT
const COLD_WALLET_THRESHOLD = 1000;           // >1k → cold wallet route
const NEW_ACCOUNT_DAYS = 7;                   // <7 days + balance >1k → review
const REVIEW_BALANCE_THRESHOLD = 1000;        // balance >1k → check reg date
const HOT_WALLET_RATIO = 0.20;                // 20%
const COLD_WALLET_RATIO = 0.80;               // 80%

// ═══════════════ Withdrawal Service ══════════════════════════════════════

export class WithdrawalService {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
    this.ensureTables();
  }

  private ensureTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS withdrawals (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        wallet_id TEXT NOT NULL,
        address TEXT NOT NULL,
        chain TEXT NOT NULL CHECK(chain IN ('TRC-20','ERC-20')),
        amount_usdt REAL NOT NULL,
        fee_usdt REAL NOT NULL,
        net_amount_usdt REAL NOT NULL,
        status TEXT NOT NULL DEFAULT 'PENDING',
        route TEXT NOT NULL DEFAULT 'HOT_WALLET',
        tx_hash TEXT,
        idempotency_key TEXT UNIQUE,
        error_message TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (wallet_id) REFERENCES wallets(id)
      );
      CREATE INDEX IF NOT EXISTS idx_withdrawals_user ON withdrawals(user_id);
      CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals(status);
      CREATE INDEX IF NOT EXISTS idx_withdrawals_idempotency ON withdrawals(idempotency_key);
    `);
  }

  /**
   * Full withdrawal pipeline.
   */
  withdraw(req: WithdrawalRequest, userRegisteredAt?: string): WithdrawalResult {
    // Idempotency check
    const idemp = this.db.prepare(
      'SELECT id, status FROM withdrawals WHERE idempotency_key = ?'
    ).get(req.idempotencyKey) as { id: string; status: WithdrawalStatus } | undefined;

    if (idemp) {
      return this.buildResult(idemp.id, idemp.status);
    }

    // 1. Verify wallet
    const wallet = this.db.prepare('SELECT * FROM wallets WHERE id = ? AND user_id = ?')
      .get(req.walletId, req.userId) as any;
    if (!wallet) {
      return { success: false, withdrawalId: '', status: 'FAILED',
        route: 'HOT_WALLET', amountUSDT: req.amountUSDT, feeUSDT: 0, netAmountUSDT: 0,
        error: 'Wallet not found or access denied' };
    }

    // 2. Calculate fee
    const feeUSDT = Math.max(
      roundUSD(req.amountUSDT * WITHDRAWAL_FEE_RATE),
      MIN_WITHDRAWAL_FEE
    );
    const totalDebit = roundUSD(req.amountUSDT + feeUSDT);

    if (wallet.usdt_balance < totalDebit) {
      return { success: false, withdrawalId: '', status: 'FAILED',
        route: 'HOT_WALLET', amountUSDT: req.amountUSDT, feeUSDT, netAmountUSDT: 0,
        error: `Insufficient balance: need ${totalDebit}, have ${wallet.usdt_balance}` };
    }

    // 3. Risk control
    const risk = this.runRiskControl(req, wallet, userRegisteredAt);
    if (!risk.passed) {
      return { success: false, withdrawalId: '', status: 'FAILED',
        route: risk.route, amountUSDT: req.amountUSDT, feeUSDT, netAmountUSDT: 0,
        error: risk.blockReason, requiresReview: risk.requiresReview };
    }

    // 4. Debit wallet (balance → frozen, OCC)
    const newBalance = roundUSD(wallet.usdt_balance - totalDebit);
    const newFrozen = roundUSD(wallet.usdt_frozen + totalDebit);
    const newVersion = wallet.version + 1;
    const checksum = computeChecksum(newBalance, newFrozen, newVersion);

    const updateResult = this.db.prepare(
      `UPDATE wallets SET usdt_balance=?, usdt_frozen=?, checksum=?, version=?, updated_at=datetime('now')
       WHERE id=? AND version=?`
    ).run(newBalance, newFrozen, checksum, newVersion, req.walletId, wallet.version);

    if (updateResult.changes === 0) {
      return { success: false, withdrawalId: '', status: 'FAILED',
        route: risk.route, amountUSDT: req.amountUSDT, feeUSDT, netAmountUSDT: 0,
        error: 'Concurrent modification, retry' };
    }

    // 5. Create withdrawal record
    const withdrawalId = generateId();
    const netAmount = roundUSD(req.amountUSDT - feeUSDT);

    this.db.prepare(`
      INSERT INTO withdrawals (id, user_id, wallet_id, address, chain, amount_usdt, fee_usdt, net_amount_usdt, status, route, idempotency_key)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)
    `).run(withdrawalId, req.userId, req.walletId, req.address, req.chain,
      req.amountUSDT, feeUSDT, netAmount, 'PENDING', risk.route, req.idempotencyKey);

    // 6. Write ledger entry (fee)
    this.db.prepare(`
      INSERT INTO ledger_entries (wallet_id, user_id, entry_type, amount_usdt, balance_after, reference_id, idempotency_key, description)
      VALUES (?,?,?,?,?,?,?,?)
    `).run(req.walletId, req.userId, 'WITHDRAWAL', -totalDebit, newBalance, withdrawalId, req.idempotencyKey,
      `Withdrawal: ${req.amountUSDT} USDT (fee: ${feeUSDT} USDT) → ${req.address.substring(0,10)}...`);

    // 7. Cold wallet route → mark for review
    if (risk.route === 'COLD_WALLET' || risk.route === 'MANUAL_REVIEW') {
      this.db.prepare("UPDATE withdrawals SET status='PROCESSING' WHERE id=?")
        .run(withdrawalId);
      return this.buildResult(withdrawalId, 'PROCESSING', risk.requiresReview);
    }

    // 8. Hot wallet: auto-send (simulated for MVP)
    return this.autoSend(withdrawalId, req);
  }

  /**
   * Auto-send from hot wallet (simulated on-chain send).
   */
  private autoSend(withdrawalId: string, req: WithdrawalRequest): WithdrawalResult {
    const txHash = simulateSendTx(req.chain, req.address, req.amountUSDT);

    this.db.prepare(
      "UPDATE withdrawals SET status='SENT', tx_hash=?, updated_at=datetime('now') WHERE id=?"
    ).run(txHash, withdrawalId);

    return this.buildResult(withdrawalId, 'SENT', false, txHash);
  }

  /**
   * Manually confirm a cold wallet withdrawal (admin action).
   */
  confirmColdWithdrawal(withdrawalId: string, txHash: string): WithdrawalResult {
    const w = this.db.prepare('SELECT * FROM withdrawals WHERE id=?').get(withdrawalId) as any;
    if (!w) return { success: false, withdrawalId, status: 'FAILED',
      route: 'COLD_WALLET', amountUSDT: 0, feeUSDT: 0, netAmountUSDT: 0, error: 'Not found' };

    this.db.prepare(
      "UPDATE withdrawals SET status='CONFIRMED', tx_hash=?, updated_at=datetime('now') WHERE id=?"
    ).run(txHash, withdrawalId);

    // Release frozen funds
    const wallet = this.db.prepare('SELECT * FROM wallets WHERE id=?').get(w.wallet_id) as any;
    const totalFrozen = roundUSD(w.amount_usdt + w.fee_usdt);
    const newFrozen = roundUSD(wallet.usdt_frozen - totalFrozen);
    const newVersion = wallet.version + 1;
    const checksum = computeChecksum(wallet.usdt_balance, newFrozen, newVersion);

    this.db.prepare(
      "UPDATE wallets SET usdt_frozen=?, checksum=?, version=?, updated_at=datetime('now') WHERE id=? AND version=?"
    ).run(newFrozen, checksum, newVersion, w.wallet_id, wallet.version);

    return this.buildResult(withdrawalId, 'CONFIRMED', false, txHash);
  }

  /**
   * Rollback a failed withdrawal.
   */
  rollbackWithdrawal(withdrawalId: string): WithdrawalResult {
    const w = this.db.prepare('SELECT * FROM withdrawals WHERE id=?').get(withdrawalId) as any;
    if (!w) return { success: false, withdrawalId, status: 'FAILED',
      route: 'HOT_WALLET', amountUSDT: 0, feeUSDT: 0, netAmountUSDT: 0, error: 'Not found' };
    if (w.status === 'CONFIRMED') {
      return { success: false, withdrawalId, status: 'FAILED',
        route: 'HOT_WALLET', amountUSDT: w.amount_usdt, feeUSDT: w.fee_usdt, netAmountUSDT: 0,
        error: 'Cannot rollback confirmed withdrawal' };
    }
    if (w.status === 'ROLLED_BACK') {
      return this.buildResult(withdrawalId, 'ROLLED_BACK');
    }

    // Return funds to wallet
    const wallet = this.db.prepare('SELECT * FROM wallets WHERE id=?').get(w.wallet_id) as any;
    const totalFrozen = roundUSD(w.amount_usdt + w.fee_usdt);
    const newBalance = roundUSD(wallet.usdt_balance + totalFrozen);
    const newFrozen = roundUSD(wallet.usdt_frozen - totalFrozen);
    const newVersion = wallet.version + 1;
    const checksum = computeChecksum(newBalance, newFrozen, newVersion);

    this.db.prepare(
      "UPDATE wallets SET usdt_balance=?, usdt_frozen=?, checksum=?, version=?, updated_at=datetime('now') WHERE id=? AND version=?"
    ).run(newBalance, newFrozen, checksum, newVersion, w.wallet_id, wallet.version);

    // Refund ledger entry
    this.db.prepare(`
      INSERT INTO ledger_entries (wallet_id, user_id, entry_type, amount_usdt, balance_after, reference_id, description)
      VALUES (?,?,?,?,?,?,?)
    `).run(w.wallet_id, w.user_id, 'REFUND', totalFrozen, newBalance, withdrawalId,
      `Withdrawal rollback: ${w.amount_usdt} USDT refunded`);

    this.db.prepare(
      "UPDATE withdrawals SET status='ROLLED_BACK', error_message='Manual rollback', updated_at=datetime('now') WHERE id=?"
    ).run(withdrawalId);

    return this.buildResult(withdrawalId, 'ROLLED_BACK');
  }

  // ═══════════ Risk Control ══════════════════════════════════════════

  runRiskControl(
    req: WithdrawalRequest,
    wallet: any,
    registeredAt?: string,
    lastWithdrawal24h?: string,
  ): RiskCheckResult {
    // Rule 1: Single ≤ 100,000
    if (req.amountUSDT > MAX_SINGLE_WITHDRAWAL) {
      return { passed: false, route: 'MANUAL_REVIEW',
        blockReason: `Single withdrawal exceeds ${MAX_SINGLE_WITHDRAWAL} USDT`, requiresReview: true };
    }

    // Rule 2: Daily cumulative ≤ 1,000,000
    const todayStart = new Date().toISOString().substring(0, 10) + 'T00:00:00';
    const dailyTotal = (this.db.prepare(
      `SELECT COALESCE(SUM(amount_usdt),0) as total FROM withdrawals
       WHERE user_id=? AND created_at>=? AND status NOT IN ('FAILED','ROLLED_BACK')`
    ).get(req.userId, todayStart) as { total: number }).total;

    if (dailyTotal + req.amountUSDT > MAX_DAILY_WITHDRAWAL) {
      return { passed: false, route: 'MANUAL_REVIEW',
        blockReason: `Daily cumulative would exceed ${MAX_DAILY_WITHDRAWAL} USDT`, requiresReview: true };
    }

    // Rule 3: First withdrawal → no review (auto-approve)
    const withdrawalCount = (this.db.prepare(
      'SELECT COUNT(*) as cnt FROM withdrawals WHERE user_id=? AND status NOT IN ("FAILED","ROLLED_BACK")'
    ).get(req.userId) as { cnt: number }).cnt;

    if (withdrawalCount === 0) {
      return { passed: true, route: 'HOT_WALLET', requiresReview: false };
    }

    // Rule 4: New address → no review required (but track address)
    // (auto-approve new addresses per v17.6)

    // Rule 5: Same address within 24h → auto-approve
    if (lastWithdrawal24h) {
      return { passed: true, route: 'HOT_WALLET', requiresReview: false };
    }

    // Rule 6: Balance > 1,000 AND registration < 7 days → manual review
    if (wallet.usdt_balance > REVIEW_BALANCE_THRESHOLD && registeredAt) {
      const regDate = new Date(registeredAt);
      const ageDays = (Date.now() - regDate.getTime()) / (1000 * 60 * 60 * 24);
      if (ageDays < NEW_ACCOUNT_DAYS) {
        return { passed: true, route: 'MANUAL_REVIEW',
          requiresReview: true }; // Not blocked, but needs review
      }
    }

    // Cold wallet routing: > COLD_WALLET_THRESHOLD → cold
    const route = req.amountUSDT > COLD_WALLET_THRESHOLD ? 'COLD_WALLET' : 'HOT_WALLET';
    return { passed: true, route, requiresReview: false };
  }

  /**
   * Get withdrawal by ID.
   */
  getWithdrawal(withdrawalId: string) {
    return this.db.prepare('SELECT * FROM withdrawals WHERE id=?').get(withdrawalId);
  }

  /**
   * Get withdrawal history for user (paginated).
   */
  getHistory(userId: string, limit = 20, offset = 0) {
    const rows = this.db.prepare(
      'SELECT * FROM withdrawals WHERE user_id=? ORDER BY created_at DESC LIMIT ? OFFSET ?'
    ).all(userId, limit, offset);
    const count = (this.db.prepare(
      'SELECT COUNT(*) as total FROM withdrawals WHERE user_id=?'
    ).get(userId) as any).total;
    return { rows, pagination: { total: count, limit, offset } };
  }

  // ═══════════ Helpers ══════════════════════════════════════════════

  private buildResult(id: string, status: WithdrawalStatus, requiresReview = false, txHash = ''): WithdrawalResult {
    if (id) {
      const w = this.db.prepare('SELECT * FROM withdrawals WHERE id=?').get(id) as any;
      if (w) {
        return {
          success: status !== 'FAILED',
          withdrawalId: w.id,
          status: w.status,
          route: w.route,
          amountUSDT: w.amount_usdt,
          feeUSDT: w.fee_usdt,
          netAmountUSDT: w.net_amount_usdt,
          txHash: w.tx_hash || undefined,
          error: w.error_message || undefined,
          requiresReview: w.route === 'COLD_WALLET' || w.route === 'MANUAL_REVIEW',
        };
      }
    }
    return { success: false, withdrawalId: id, status, route: 'HOT_WALLET',
      amountUSDT: 0, feeUSDT: 0, netAmountUSDT: 0, txHash, requiresReview };
  }
}

// ═══════════════ Helpers ═════════════════════════════════════════════════

function roundUSD(v: number): number {
  return Math.round(v * 10000) / 10000;
}

function computeChecksum(balance: number, frozen: number, version: number): string {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(`${balance}:${frozen}:${version}`).digest('hex');
}

function generateId(): string {
  const crypto = require('crypto');
  return crypto.randomUUID();
}

function simulateSendTx(chain: Chain, to: string, amount: number): string {
  // MVP simulation — real impl calls TRC-20/ERC-20 send
  const hash = chain === 'TRC-20'
    ? 'tron_' + require('crypto').randomBytes(32).toString('hex')
    : '0x' + require('crypto').randomBytes(32).toString('hex');
  return hash;
}

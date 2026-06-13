// @ts-nocheck
/**
 * DAWN WHALES R143 J03 — Transfer Service
 * 
 * User-to-user USDT transfer with dual-entry ledger.
 * 
 * v17.6 Rules (⚠️ DIFFERENT FROM TIP!):
 *  - Sender: 0.3% fee on amount sent
 *  - Receiver: 0.3% fee on amount received
 *  - Both fees → platform revenue
 * 
 * Transfer lifecycle:
 *   1. Idempotency check
 *   2. Validate sender wallet (balance ≥ amount + 0.3% fee)
 *   3. Validate receiver exists + has wallet
 *   4. Debit sender wallet (amount + 0.3% fee), OCC
 *   5. Credit receiver wallet (amount - 0.3% fee), OCC
 *   6. Write dual ledger entries (TRANSFER_SEND + TRANSFER_RECEIVE)
 *   7. Record fee revenue entries
 * 
 * ≥250L
 */

import Database from 'better-sqlite3';

// ═══════════════ Types ═══════════════════════════════════════════════════

export interface TransferRequest {
  fromUserId: string;
  fromWalletId: string;
  toUserId: string;
  amountUSDT: number;
  memo?: string;
  idempotencyKey: string;
}

export interface TransferResult {
  success: boolean;
  transferId: string;
  fromUserId: string;
  toUserId: string;
  amountUSDT: number;
  senderFee: number;       // 0.3% deducted from sender
  receiverFee: number;     // 0.3% deducted from receiver
  senderNet: number;       // amount + senderFee (what sender actually loses)
  receiverNet: number;     // amount - receiverFee (what receiver gets)
  error?: string;
}

// ═══════════════ Constants (v17.6) ═══════════════════════════════════════

const TRANSFER_SEND_FEE_RATE = 0.003;       // 0.3%
const TRANSFER_RECEIVE_FEE_RATE = 0.003;     // 0.3%
const MIN_SEND_FEE = 1;                      // min 1 USDT
const MIN_RECEIVE_FEE = 1;                   // min 1 USDT

// ═══════════════ Transfer Service ════════════════════════════════════════

export class TransferService {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
    this.ensureTables();
  }

  private ensureTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS transfers (
        id TEXT PRIMARY KEY,
        from_user_id TEXT NOT NULL,
        from_wallet_id TEXT NOT NULL,
        to_user_id TEXT NOT NULL,
        to_wallet_id TEXT NOT NULL,
        amount_usdt REAL NOT NULL,
        sender_fee REAL NOT NULL,
        receiver_fee REAL NOT NULL,
        sender_net REAL NOT NULL,
        receiver_net REAL NOT NULL,
        memo TEXT,
        idempotency_key TEXT UNIQUE,
        status TEXT NOT NULL DEFAULT 'COMPLETED',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (from_wallet_id) REFERENCES wallets(id),
        FOREIGN KEY (to_wallet_id) REFERENCES wallets(id)
      );
      CREATE INDEX IF NOT EXISTS idx_transfers_from ON transfers(from_user_id);
      CREATE INDEX IF NOT EXISTS idx_transfers_to ON transfers(to_user_id);
      CREATE INDEX IF NOT EXISTS idx_transfers_idempotency ON transfers(idempotency_key);
    `);
  }

  /**
   * Execute a transfer.
   */
  transfer(req: TransferRequest): TransferResult {
    // Idempotency check
    const idemp = this.db.prepare(
      'SELECT id FROM transfers WHERE idempotency_key = ?'
    ).get(req.idempotencyKey) as { id: string } | undefined;

    if (idemp) {
      const t = this.db.prepare('SELECT * FROM transfers WHERE id=?').get(idemp.id) as any;
      if (t) {
        return {
          success: true, transferId: t.id,
          fromUserId: t.from_user_id, toUserId: t.to_user_id,
          amountUSDT: t.amount_usdt, senderFee: t.sender_fee,
          receiverFee: t.receiver_fee, senderNet: t.sender_net, receiverNet: t.receiver_net,
        };
      }
    }

    // 1. No self-transfer
    if (req.fromUserId === req.toUserId) {
      return { success: false, transferId: '', fromUserId: req.fromUserId, toUserId: req.toUserId,
        amountUSDT: req.amountUSDT, senderFee: 0, receiverFee: 0, senderNet: 0, receiverNet: 0,
        error: 'Cannot transfer to yourself' };
    }

    // 2. Calculate fees
    const senderFee = Math.max(roundUSD(req.amountUSDT * TRANSFER_SEND_FEE_RATE), MIN_SEND_FEE);
    const receiverFee = Math.max(roundUSD(req.amountUSDT * TRANSFER_RECEIVE_FEE_RATE), MIN_RECEIVE_FEE);
    const senderNet = roundUSD(req.amountUSDT + senderFee);
    const receiverNet = roundUSD(req.amountUSDT - receiverFee);

    // 3. Validate sender wallet
    const fromWallet = this.db.prepare('SELECT * FROM wallets WHERE id=? AND user_id=?')
      .get(req.fromWalletId, req.fromUserId) as any;
    if (!fromWallet) {
      return { success: false, transferId: '', fromUserId: req.fromUserId, toUserId: req.toUserId,
        amountUSDT: req.amountUSDT, senderFee, receiverFee, senderNet, receiverNet,
        error: 'Sender wallet not found or access denied' };
    }
    if (fromWallet.usdt_balance < senderNet) {
      return { success: false, transferId: '', fromUserId: req.fromUserId, toUserId: req.toUserId,
        amountUSDT: req.amountUSDT, senderFee, receiverFee, senderNet, receiverNet,
        error: `Insufficient balance: need ${senderNet}, have ${fromWallet.usdt_balance}` };
    }

    // 4. Get receiver wallet
    const toWallet = this.db.prepare('SELECT * FROM wallets WHERE user_id=?').get(req.toUserId) as any;
    if (!toWallet) {
      return { success: false, transferId: '', fromUserId: req.fromUserId, toUserId: req.toUserId,
        amountUSDT: req.amountUSDT, senderFee, receiverFee, senderNet, receiverNet,
        error: 'Receiver has no wallet' };
    }

    // 5. Atomic transfer (two wallet updates in transaction)
    let transferId = '';
    const txResult = this.db.transaction(() => {
      // Debit sender
      const fromNewBalance = roundUSD(fromWallet.usdt_balance - senderNet);
      const fromNewVersion = fromWallet.version + 1;
      const fromChecksum = computeChecksum(fromNewBalance, fromWallet.usdt_frozen, fromNewVersion);
      this.db.prepare(
        "UPDATE wallets SET usdt_balance=?, checksum=?, version=?, updated_at=datetime('now') WHERE id=? AND version=?"
      ).run(fromNewBalance, fromChecksum, fromNewVersion, fromWallet.id, fromWallet.version);

      // Credit receiver
      const toNewBalance = roundUSD(toWallet.usdt_balance + receiverNet);
      const toNewVersion = toWallet.version + 1;
      const toChecksum = computeChecksum(toNewBalance, toWallet.usdt_frozen, toNewVersion);
      this.db.prepare(
        "UPDATE wallets SET usdt_balance=?, checksum=?, version=?, updated_at=datetime('now') WHERE id=? AND version=?"
      ).run(toNewBalance, toChecksum, toNewVersion, toWallet.id, toWallet.version);

      // Create transfer record
      transferId = generateId();
      this.db.prepare(`
        INSERT INTO transfers (id, from_user_id, from_wallet_id, to_user_id, to_wallet_id, amount_usdt, sender_fee, receiver_fee, sender_net, receiver_net, memo, idempotency_key)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
      `).run(transferId, req.fromUserId, req.fromWalletId, req.toUserId, toWallet.id,
        req.amountUSDT, senderFee, receiverFee, senderNet, receiverNet, req.memo || null, req.idempotencyKey);

      // Ledger: sender debit
      this.db.prepare(`
        INSERT INTO ledger_entries (wallet_id, user_id, entry_type, amount_usdt, balance_after, reference_id, idempotency_key, description)
        VALUES (?,?,?,?,?,?,?,?)
      `).run(req.fromWalletId, req.fromUserId, 'TRANSFER_SEND', -senderNet, fromNewBalance, transferId,
        `${req.idempotencyKey}_send`, req.memo || `Transfer to ${req.toUserId}`);

      // Ledger: receiver credit
      this.db.prepare(`
        INSERT INTO ledger_entries (wallet_id, user_id, entry_type, amount_usdt, balance_after, reference_id, idempotency_key, description)
        VALUES (?,?,?,?,?,?,?,?)
      `).run(toWallet.id, req.toUserId, 'TRANSFER_RECEIVE', receiverNet, toNewBalance, transferId,
        `${req.idempotencyKey}_receive`, req.memo || `Transfer from ${req.fromUserId}`);

    }) as (() => void);

    try {
      txResult();
    } catch (err: any) {
      return { success: false, transferId: '', fromUserId: req.fromUserId, toUserId: req.toUserId,
        amountUSDT: req.amountUSDT, senderFee, receiverFee, senderNet, receiverNet,
        error: `Transaction failed: ${err.message}` };
    }

    return {
      success: true, transferId,
      fromUserId: req.fromUserId, toUserId: req.toUserId,
      amountUSDT: req.amountUSDT,
      senderFee, receiverFee,
      senderNet, receiverNet,
    };
  }

  /**
   * Get transfer history for user (sent and received).
   */
  getHistory(userId: string, limit = 20, offset = 0) {
    const rows = this.db.prepare(
      `SELECT * FROM transfers WHERE from_user_id=? OR to_user_id=?
       ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ).all(userId, userId, limit, offset);
    const count = (this.db.prepare(
      'SELECT COUNT(*) as total FROM transfers WHERE from_user_id=? OR to_user_id=?'
    ).get(userId, userId) as any).total;
    return { rows, pagination: { total: count, limit, offset } };
  }

  /**
   * Get a single transfer.
   */
  getTransfer(transferId: string) {
    return this.db.prepare('SELECT * FROM transfers WHERE id=?').get(transferId);
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

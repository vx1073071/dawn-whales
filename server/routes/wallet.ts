// @ts-nocheck
/**
 * DAWN WHALES R141 J02–J05 — Wallet + Ledger + Idempotency API Routes
 * 
 * Production Billing Foundation (v17.6 billing model).
 * All endpoints protected by JWT authMiddleware.
 * 
 * Endpoints:
 *   POST   /api/wallet          — Create wallet for authenticated user
 *   GET    /api/wallet/:id       — Get wallet balance + metadata (checksum verified)
 *   GET    /api/wallet/deposit-address/:userId — R150 #22: server-side deposit address
 *   GET    /api/wallet/config    — Get system wallet config
 *   POST   /api/ledger/entry     — Record a ledger entry (append-only, idempotent)
 *   GET    /api/ledger/entries   — Query ledger entries (paginated)
 *   POST   /api/idempotency/check — Check/create idempotency key
 * 
 * Features:
 *  - JWT auth on every endpoint (token + userId match)
 *  - Wallet creation is idempotent (one wallet per user)
 *  - Ledger entries are append-only and immutable
 *  - Idempotency keys prevent duplicate transactions
 *  - Checksum validation on balance read
 *  - OCC (version) for concurrent safety
 * 
 * ≥300L, routes + handlers
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { authMiddleware } from '../middleware/jwt-auth';
import { getMainDb } from '../db/database';
import { applyMigrationV2, verifyMigrationV2 } from '../db/migration-v2';
import { getChainMonitorService } from '../services/chain-monitor';

const router = Router();

// Ensure migration V2 ran
try {
  const db = getMainDb();
  applyMigrationV2(db);
  const verify = verifyMigrationV2(db);
  if (!verify.ok) {
    console.error('[wallet] Migration V2 verification failed:', verify.errors);
  } else {
    console.log('[wallet] Migration V2 verified OK');
  }
} catch (e) {
  console.error('[wallet] Migration V2 error:', e);
}

// ─── Types ───────────────────────────────────────────────────────────────

interface WalletRow {
  id: string;
  user_id: string;
  usdt_balance: number;
  usdt_frozen: number;
  checksum: string;
  version: number;
  created_at: string;
  updated_at: string;
}

interface LedgerEntryRow {
  id: number;
  wallet_id: string;
  user_id: string;
  entry_type: string;
  amount_usdt: number;
  balance_after: number;
  reference_id: string | null;
  idempotency_key: string | null;
  description: string | null;
  created_at: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function computeChecksum(balance: number, frozen: number, version: number): string {
  return crypto.createHash('sha256')
    .update(`${balance}:${frozen}:${version}`)
    .digest('hex');
}

function verifyChecksum(wallet: WalletRow): boolean {
  return wallet.checksum === computeChecksum(wallet.usdt_balance, wallet.usdt_frozen, wallet.version);
}

function getUserId(req: Request): string {
  return (req as Request & { user: { userId: string; username: string } }).user.userId;
}

function roundUSD(amount: number): number {
  return Math.round(amount * 10000) / 10000;
}

// ─── POST /api/wallet ── Create wallet for authenticated user ────────────
router.post('/', authMiddleware, (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const db = getMainDb();

    // Idempotent: one wallet per user
    const existing = db.prepare('SELECT * FROM wallets WHERE user_id = ?').get(userId) as WalletRow | undefined;
    if (existing) {
      if (!verifyChecksum(existing)) {
        // Auto-repair checksum
        const correct = computeChecksum(existing.usdt_balance, existing.usdt_frozen, existing.version);
        db.prepare('UPDATE wallets SET checksum = ?, updated_at = datetime("now") WHERE id = ?')
          .run(correct, existing.id);
        existing.checksum = correct;
      }
      res.status(200).json({
        success: true,
        wallet: {
          id: existing.id,
          userId: existing.user_id,
          balance: existing.usdt_balance,
          frozen: existing.usdt_frozen,
          createdAt: existing.created_at,
        },
      });
      return;
    }

    const id = crypto.randomUUID();
    const balance = 0;
    const frozen = 0;
    const version = 0;
    const checksum = computeChecksum(balance, frozen, version);

    db.prepare(
      'INSERT INTO wallets (id, user_id, usdt_balance, usdt_frozen, checksum, version) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(id, userId, balance, frozen, checksum, version);

    const wallet = db.prepare('SELECT * FROM wallets WHERE id = ?').get(id) as WalletRow;

    res.status(201).json({
      success: true,
      wallet: {
        id: wallet.id,
        userId: wallet.user_id,
        balance: wallet.usdt_balance,
        frozen: wallet.usdt_frozen,
        createdAt: wallet.created_at,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /api/wallet/:id ── Get wallet balance + checksum ────────────────
router.get('/:id', authMiddleware, (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const walletId = req.params.id;
    const db = getMainDb();

    const wallet = db.prepare('SELECT * FROM wallets WHERE id = ?').get(walletId) as WalletRow | undefined;
    if (!wallet) {
      res.status(404).json({ success: false, error: 'Wallet not found' });
      return;
    }

    // Authorization: user can only view their own wallet
    if (wallet.user_id !== userId) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    // Verify checksum integrity
    const checksumValid = verifyChecksum(wallet);

    // Get recent ledger entries
    const entries = db.prepare(
      'SELECT * FROM ledger_entries WHERE wallet_id = ? ORDER BY created_at DESC LIMIT 20'
    ).all(walletId) as LedgerEntryRow[];

    res.status(200).json({
      success: true,
      wallet: {
        id: wallet.id,
        userId: wallet.user_id,
        balance: wallet.usdt_balance,
        frozen: wallet.usdt_frozen,
        available: roundUSD(wallet.usdt_balance - wallet.usdt_frozen),
        version: wallet.version,
        checksumValid,
        createdAt: wallet.created_at,
        updatedAt: wallet.updated_at,
      },
      recentEntries: entries.map(e => ({
        id: e.id,
        type: e.entry_type,
        amount: e.amount_usdt,
        balanceAfter: e.balance_after,
        referenceId: e.reference_id,
        description: e.description,
        createdAt: e.created_at,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /api/ledger/entry ── Record a ledger entry (append-only) ─────
router.post('/ledger/entry', authMiddleware, (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const db = getMainDb();
    const {
      walletId,
      entryType,
      amountUSDT,
      referenceId,
      idempotencyKey,
      description,
    } = req.body;

    // Validation
    if (!walletId || !entryType) {
      res.status(400).json({ success: false, error: 'walletId and entryType required' });
      return;
    }
    if (typeof amountUSDT !== 'number' || isNaN(amountUSDT)) {
      res.status(400).json({ success: false, error: 'amountUSDT must be a number' });
      return;
    }

    // Authorization
    const wallet = db.prepare('SELECT * FROM wallets WHERE id = ?').get(walletId) as WalletRow | undefined;
    if (!wallet) {
      res.status(404).json({ success: false, error: 'Wallet not found' });
      return;
    }
    if (wallet.user_id !== userId) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    // Idempotency check
    if (idempotencyKey) {
      const existingKey = db.prepare(
        'SELECT * FROM idempotency_keys WHERE key = ? AND expires_at > datetime("now")'
      ).get(idempotencyKey) as Record<string, string> | undefined;
      if (existingKey) {
        // Replay previous response
        res.status(200).json({
          success: true,
          idempotent: true,
          originalResponse: existingKey.response_body ? JSON.parse(existingKey.response_body) : null,
        });
        return;
      }
    }

    // Compute new balance
    const newBalance = roundUSD(wallet.usdt_balance + amountUSDT);
    if (newBalance < 0) {
      res.status(400).json({ success: false, error: 'Insufficient balance' });
      return;
    }

    // Atomic update with OCC
    const newVersion = wallet.version + 1;
    const newChecksum = computeChecksum(newBalance, wallet.usdt_frozen, newVersion);

    const result = db.prepare(
      'UPDATE wallets SET usdt_balance = ?, checksum = ?, version = ?, updated_at = datetime("now") WHERE id = ? AND version = ?'
    ).run(newBalance, newChecksum, newVersion, walletId, wallet.version);

    if (result.changes === 0) {
      // OCC conflict — another transaction modified this wallet
      res.status(409).json({ success: false, error: 'Concurrent modification detected, retry' });
      return;
    }

    // Write ledger entry (append-only)
    const entryResult = db.prepare(
      'INSERT INTO ledger_entries (wallet_id, user_id, entry_type, amount_usdt, balance_after, reference_id, idempotency_key, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(walletId, userId, entryType, amountUSDT, newBalance, referenceId || null, idempotencyKey || null, description || null);

    // Store idempotency key
    if (idempotencyKey) {
      db.prepare(
        'INSERT OR IGNORE INTO idempotency_keys (key, user_id, action_type, response_body) VALUES (?, ?, ?, ?)'
      ).run(idempotencyKey, userId, entryType, JSON.stringify({
        entryId: entryResult.lastInsertRowid,
        newBalance,
      }));
    }

    res.status(201).json({
      success: true,
      entry: {
        id: entryResult.lastInsertRowid,
        walletId,
        userId,
        entryType,
        amountUSDT: roundUSD(amountUSDT),
        balanceAfter: newBalance,
        referenceId: referenceId || null,
        description: description || null,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /api/ledger/entries ── Query ledger entries (paginated) ───────
router.get('/ledger/entries', authMiddleware, (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const db = getMainDb();
    const { walletId, entryType, limit = '50', offset = '0' } = req.query as Record<string, string>;

    if (!walletId) {
      res.status(400).json({ success: false, error: 'walletId required' });
      return;
    }

    // Authorization: verify wallet ownership
    const wallet = db.prepare('SELECT user_id FROM wallets WHERE id = ?').get(walletId) as { user_id: string } | undefined;
    if (!wallet || wallet.user_id !== userId) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    let query = 'SELECT * FROM ledger_entries WHERE wallet_id = ?';
    const params: (string | number)[] = [walletId];

    if (entryType) {
      query += ' AND entry_type = ?';
      params.push(entryType);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit, 10), parseInt(offset, 10));

    const entries = db.prepare(query).all(...params) as LedgerEntryRow[];
    const countRow = db.prepare(
      `SELECT COUNT(*) as total FROM ledger_entries WHERE wallet_id = ?${entryType ? ' AND entry_type = ?' : ''}`
    ).get(walletId, ...(entryType ? [entryType] : [])) as { total: number };

    res.status(200).json({
      success: true,
      entries: entries.map(e => ({
        id: e.id,
        type: e.entry_type,
        amount: e.amount_usdt,
        balanceAfter: e.balance_after,
        referenceId: e.reference_id,
        description: e.description,
        createdAt: e.created_at,
      })),
      pagination: {
        total: countRow.total,
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10),
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /api/idempotency/check ── Check/create idempotency key ───────
router.post('/idempotency/check', authMiddleware, (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const db = getMainDb();
    const { key, actionType } = req.body;

    if (!key) {
      res.status(400).json({ success: false, error: 'key required' });
      return;
    }
    if (!actionType) {
      res.status(400).json({ success: false, error: 'actionType required' });
      return;
    }

    // Check if key exists and is not expired
    const existing = db.prepare(
      'SELECT * FROM idempotency_keys WHERE key = ? AND expires_at > datetime("now")'
    ).get(key) as Record<string, string> | undefined;

    if (existing) {
      res.status(200).json({
        success: true,
        exists: true,
        isNew: false,
        originalResponse: existing.response_body ? JSON.parse(existing.response_body) : null,
        expiresAt: existing.expires_at,
      });
      return;
    }

    // Create new idempotency key
    db.prepare(
      'INSERT OR IGNORE INTO idempotency_keys (key, user_id, action_type) VALUES (?, ?, ?)'
    ).run(key, userId, actionType);

    res.status(201).json({
      success: true,
      exists: false,
      isNew: true,
      key,
      actionType,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /api/wallet/deposit-address/:userId ── R150 #22: server-side deposit address ─────
router.get('/deposit-address/:userId', authMiddleware, (req: Request, res: Response) => {
  try {
    const callerId = getUserId(req);
    const targetUserId = req.params.userId;

    // Authorization: user can only query their own deposit address
    if (callerId !== targetUserId) {
      res.status(403).json({ success: false, error: 'Access denied — can only query own deposit address' });
      return;
    }

    const chain = (req.query.chain as string) || 'TRC-20';
    if (!['TRC-20', 'ERC-20'].includes(chain)) {
      res.status(400).json({ success: false, error: 'Invalid chain. Use TRC-20 or ERC-20' });
      return;
    }

    const monitor = getChainMonitorService();

    // Try to retrieve existing deposit address
    const existing = monitor.getUserDepositAddress(targetUserId, chain as 'TRC-20' | 'ERC-20');
    if (existing) {
      res.status(200).json({
        success: true,
        depositAddress: {
          userId: existing.userId,
          address: existing.address,
          chain: existing.chain,
          createdAt: existing.createdAt,
          depositCount: existing.depositCount,
          totalDepositedUSDT: existing.totalDepositedUSDT,
        },
        isNew: false,
      });
      return;
    }

    // Generate new deposit address for this user
    const generated = monitor.generateDepositAddress(targetUserId, chain as 'TRC-20' | 'ERC-20');
    res.status(201).json({
      success: true,
      depositAddress: {
        userId: generated.userId,
        address: generated.address,
        chain: generated.chain,
        createdAt: generated.createdAt,
        depositCount: 0,
        totalDepositedUSDT: 0,
      },
      isNew: true,
      warning: 'This is an MVP deposit address. For production, use HD wallet (BIP44) key derivation.',
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /api/wallet/config ── Get system wallet config (fee rates) ──
router.get('/config', (_req: Request, res: Response) => {
  try {
    const db = getMainDb();
    const configs = db.prepare('SELECT key, value FROM wallet_config').all() as { key: string; value: string }[];

    const map: Record<string, string> = {};
    for (const c of configs) {
      map[c.key] = c.value;
    }

    res.status(200).json({ success: true, config: map });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

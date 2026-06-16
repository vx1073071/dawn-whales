/**
 * QUANT MOO R141 J01 — Production Wallet Schema (migration-v2.ts)
 * 
 * Permanent foundation: wallets + ledger_entries + idempotency_keys.
 * All subsequent R142–R148 depend on this migration.
 * 
 * Design decisions (v17.6 billing model):
 *  - wallets: one per user, usdt_balance + usdt_frozen + checksum + version (OCC)
 *  - ledger_entries: append-only double-entry (debit + credit), immutable
 *  - idempotency_keys: 7-day expire, prevents duplicate billing/refunds
 * 
 * ≥200L, built directly into database.ts init flow
 */

import Database from 'better-sqlite3';

/**
 * Apply migration v2 to the Main database (wallets + ledger + idempotency)
 */
export function applyMigrationV2(db: Database.Database): void {
  db.transaction(() => {

    // ── wallets ──────────────────────────────────────────────────────────
    // One wallet per user. Balance is server-computed with checksum.
    // frozen = locked funds (open orders, pending withdrawals)
    // version = optimistic concurrency control counter
    db.exec(`
      CREATE TABLE IF NOT EXISTS wallets (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL UNIQUE,
        usdt_balance REAL NOT NULL DEFAULT 0 CHECK(usdt_balance >= 0),
        usdt_frozen REAL NOT NULL DEFAULT 0 CHECK(usdt_frozen >= 0),
        checksum TEXT NOT NULL DEFAULT '',
        version INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_wallets_user ON wallets(user_id);
    `);

    // ── ledger_entries ───────────────────────────────────────────────────
    // Append-only immutable double-entry ledger.
    // Every financial event must create exactly one ledger entry.
    // entry_type: DEBIT (user pays → usdt_amount negative) | CREDIT (user receives → positive)
    //   or more granular types below for reporting
    // balance_after is the computed balance AFTER this entry
    // Never UPDATE or DELETE a ledger entry.
    db.exec(`
      CREATE TABLE IF NOT EXISTS ledger_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        wallet_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        entry_type TEXT NOT NULL CHECK(entry_type IN (
          'DEPOSIT','WITHDRAWAL','TRADE_FEE','COPYTRADE_FEE',
          'SUBSCRIPTION_PAY','SUBSCRIPTION_EARN','TEMPLATE_PAY','TEMPLATE_EARN',
          'TIP_SEND','TIP_RECEIVE','TRANSFER_SEND','TRANSFER_RECEIVE',
          'REFUND','PLATFORM_FEE','AI_FEE','ADJUSTMENT'
        )),
        amount_usdt REAL NOT NULL,
        balance_after REAL NOT NULL,
        reference_id TEXT,       -- e.g. signalId, orderId, subscriptionId
        idempotency_key TEXT,    -- FK to idempotency_keys
        description TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (wallet_id) REFERENCES wallets(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
      CREATE INDEX IF NOT EXISTS idx_ledger_wallet ON ledger_entries(wallet_id);
      CREATE INDEX IF NOT EXISTS idx_ledger_user ON ledger_entries(user_id);
      CREATE INDEX IF NOT EXISTS idx_ledger_idempotency ON ledger_entries(idempotency_key);
      CREATE INDEX IF NOT EXISTS idx_ledger_created ON ledger_entries(created_at);
    `);

    // ── idempotency_keys ─────────────────────────────────────────────────
    // Prevents duplicate billing/refunds.
    // Keys auto-expire after 7 days (cleanup by cron).
    // response_body stores the original response for replay.
    db.exec(`
      CREATE TABLE IF NOT EXISTS idempotency_keys (
        key TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        action_type TEXT NOT NULL,
        response_body TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        expires_at TEXT NOT NULL DEFAULT (datetime('now', '+7 days')),
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
      CREATE INDEX IF NOT EXISTS idx_idempotency_expires ON idempotency_keys(expires_at);
    `);

    // ── config_wallet_system ─────────────────────────────────────────────
    // System-wide wallet configuration (fee rates, limits, etc.)
    db.exec(`
      CREATE TABLE IF NOT EXISTS wallet_config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      INSERT OR IGNORE INTO wallet_config (key, value) VALUES
        ('min_withdrawal_usdt', '10'),
        ('max_withdrawal_single_usdt', '100000'),
        ('max_withdrawal_daily_usdt', '500000'),
        ('withdrawal_fee_percent', '0.1'),
        ('withdrawal_fee_min_usdt', '2'),
        ('deposit_fee_percent', '0'),
        ('transfer_send_fee_percent', '0.3'),
        ('transfer_receive_fee_percent', '0.3'),
        ('ai_fee_per_call_usdt', '0.009'),
        ('trade_fee_taker_percent', '0.1'),
        ('trade_fee_maker_percent', '0.02'),
        ('trade_fee_min_usdt', '2');
    `);

    console.log('[Migration V2] Applied: wallets + ledger_entries + idempotency_keys + wallet_config');
  })();
}

/**
 * Verify migration V2 is healthy (used in CI / healthcheck).
 */
export function verifyMigrationV2(db: Database.Database): { ok: boolean; errors: string[] } {
  const errors: string[] = [];

  const tables = ['wallets', 'ledger_entries', 'idempotency_keys', 'wallet_config'];
  for (const t of tables) {
    const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(t);
    if (!row) errors.push(`Missing table: ${t}`);
  }

  return { ok: errors.length === 0, errors };
}

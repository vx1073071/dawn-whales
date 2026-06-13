// ── DAWN WHALES SQLite Database ───────────────────────────────────────
// R129-P02: SQLite initialization with 3 tables + WAL mode

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { config } from '../config/env';

let mainDb: Database.Database;
let keysDb: Database.Database;

function ensureDir(filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function initDatabases(): void {
  ensureDir(config.dbPath);
  ensureDir(config.keysDbPath);

  // ── Main database ──────────────────────────────────────────────────
  mainDb = new Database(config.dbPath);
  mainDb.pragma('journal_mode = WAL');
  mainDb.pragma('foreign_keys = ON');

  mainDb.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      email TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS signals (
      id TEXT PRIMARY KEY,
      provider_id TEXT NOT NULL,
      symbol TEXT NOT NULL,
      direction TEXT NOT NULL CHECK(direction IN ('BUY','SELL')),
      price REAL,
      confidence REAL DEFAULT 0,
      broker_type TEXT NOT NULL CHECK(broker_type IN ('cloud','opend')),
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending','executing','executed','failed','dead','cancelled')),
      priority TEXT DEFAULT 'P1' CHECK(priority IN ('P0','P1','P2')),
      retry_count INTEGER DEFAULT 0,
      max_retries INTEGER DEFAULT 3,
      error_message TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      executed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS copy_trades (
      id TEXT PRIMARY KEY,
      signal_id TEXT NOT NULL REFERENCES signals(id),
      user_id TEXT NOT NULL,
      broker_id TEXT NOT NULL,
      order_id TEXT,
      symbol TEXT NOT NULL,
      side TEXT NOT NULL,
      quantity REAL NOT NULL,
      price REAL,
      fee REAL,
      fee_currency TEXT DEFAULT 'USDT',
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_signals_status ON signals(status);
    CREATE INDEX IF NOT EXISTS idx_signals_provider ON signals(provider_id);
    CREATE INDEX IF NOT EXISTS idx_signals_broker_type ON signals(broker_type);
    CREATE INDEX IF NOT EXISTS idx_copy_trades_user ON copy_trades(user_id);
    CREATE INDEX IF NOT EXISTS idx_copy_trades_signal ON copy_trades(signal_id);

    CREATE TABLE IF NOT EXISTS dead_letters (
      id TEXT PRIMARY KEY,
      signal_id TEXT NOT NULL REFERENCES signals(id),
      reason TEXT NOT NULL,
      retry_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      resolved_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_dead_letters_signal ON dead_letters(signal_id);
  `);

  // ── Keys database (separate encrypted DB) ──────────────────────────
  keysDb = new Database(config.keysDbPath);
  keysDb.pragma('journal_mode = WAL');
  keysDb.pragma('foreign_keys = ON');

  keysDb.exec(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      broker_id TEXT NOT NULL,
      account_label TEXT DEFAULT 'default',
      api_key_encrypted TEXT NOT NULL,
      secret_encrypted TEXT NOT NULL,
      passphrase_encrypted TEXT,
      encryption_version INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, broker_id, account_label)
    );

    CREATE TABLE IF NOT EXISTS key_audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      broker_id TEXT NOT NULL,
      action TEXT NOT NULL CHECK(action IN ('decrypt','encrypt','delete','rotate')),
      timestamp TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);
    CREATE INDEX IF NOT EXISTS idx_key_audit_user ON key_audit_log(user_id);
  `);

  console.log('[DB] Main database initialized:', config.dbPath);
  console.log('[DB] Keys database initialized:', config.keysDbPath);
}

export function getMainDb(): Database.Database {
  if (!mainDb) throw new Error('Main database not initialized');
  return mainDb;
}

export function getKeysDb(): Database.Database {
  if (!keysDb) throw new Error('Keys database not initialized');
  return keysDb;
}

export function closeDatabases(): void {
  mainDb?.close();
  keysDb?.close();
}

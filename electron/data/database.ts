// ── Database Manager — SQLite（和富途一样的本地数据库选型）─────────────────
import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';
import log from 'electron-log';

const DB_NAME = 'quantdesk.db';

export class DatabaseManager {
  private db: Database.Database | null = null;
  private dbPath = '';

  initialize() {
    const userDataPath = app.getPath('userData');
    this.dbPath = path.join(userDataPath, DB_NAME);
    log.info('[Database] Opening:', this.dbPath);

    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');

    this.createTables();
  }

  private createTables() {
    if (!this.db) return;
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS strategies (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        dsl_json TEXT NOT NULL,
        version TEXT DEFAULT '1.0.0',
        status TEXT DEFAULT 'draft',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS backtest_runs (
        id TEXT PRIMARY KEY,
        strategy_id TEXT REFERENCES strategies(id),
        start_date TEXT,
        end_date TEXT,
        initial_capital REAL,
        result_json TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS trades (
        id TEXT PRIMARY KEY,
        strategy_id TEXT REFERENCES strategies(id),
        account_id TEXT,
        symbol TEXT NOT NULL,
        side TEXT NOT NULL,
        quantity REAL,
        price REAL,
        commission REAL,
        pnl REAL,
        executed_at TEXT
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `);
    log.info('[Database] Tables initialized');
  }

  // ── Strategies ──────────────────────────────────────────────────

  getStrategies(): any[] {
    if (!this.db) return [];
    return this.db.prepare('SELECT * FROM strategies ORDER BY updated_at DESC').all();
  }

  saveStrategy(strategy: any): void {
    if (!this.db) return;
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO strategies (id, name, description, dsl_json, version, status, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `);
    stmt.run(strategy.id, strategy.name, strategy.description || '', JSON.stringify(strategy), strategy.version || '1.0.0', strategy.status || 'draft');
  }

  deleteStrategy(id: string): void {
    this.db?.prepare('DELETE FROM strategies WHERE id = ?').run(id);
  }

  // ── Settings ────────────────────────────────────────────────────

  getSettings(): Record<string, string> {
    if (!this.db) return {};
    const rows = this.db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
    const result: Record<string, string> = {};
    for (const row of rows) result[row.key] = row.value;
    return result;
  }

  saveSettings(settings: Record<string, any>): void {
    if (!this.db) return;
    const stmt = this.db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    for (const [key, value] of Object.entries(settings)) {
      stmt.run(key, typeof value === 'string' ? value : JSON.stringify(value));
    }
  }

  // ── Lifecycle ───────────────────────────────────────────────────

  close() {
    this.db?.close();
    this.db = null;
    log.info('[Database] Closed');
  }
}

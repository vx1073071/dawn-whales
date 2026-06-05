// ── DAWN WHALES — SQLite Persistence Layer (Production) ────────────────────
// T105: Strategy/Config/Order persistent storage with better-sqlite3

import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';
import log from 'electron-log';

// ── Schema ─────────────────────────────────────────────────────────────────

const SCHEMA = {
  strategies: `
    CREATE TABLE IF NOT EXISTS strategies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      dsl TEXT NOT NULL,
      status TEXT DEFAULT 'draft',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      last_run_at INTEGER,
      run_count INTEGER DEFAULT 0,
      tags TEXT,
      performance_json TEXT
    )
  `,
  orders: `
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      strategy_id TEXT,
      symbol TEXT NOT NULL,
      side TEXT NOT NULL,
      order_type TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      price REAL,
      status TEXT DEFAULT 'pending',
      placed_at INTEGER NOT NULL,
      filled_at INTEGER,
      filled_price REAL,
      filled_quantity INTEGER,
      commission REAL DEFAULT 0,
      pnl REAL,
      notes TEXT,
      FOREIGN KEY (strategy_id) REFERENCES strategies(id)
    )
  `,
  positions: `
    CREATE TABLE IF NOT EXISTS positions (
      id TEXT PRIMARY KEY,
      symbol TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      avg_cost REAL NOT NULL,
      current_price REAL,
      market_value REAL,
      unrealized_pnl REAL,
      realized_pnl REAL DEFAULT 0,
      updated_at INTEGER NOT NULL,
      UNIQUE(symbol)
    )
  `,
  config: `
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `,
  backtest_results: `
    CREATE TABLE IF NOT EXISTS backtest_results (
      id TEXT PRIMARY KEY,
      strategy_id TEXT,
      name TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      total_return REAL,
      annual_return REAL,
      sharpe_ratio REAL,
      max_drawdown REAL,
      win_rate REAL,
      profit_factor REAL,
      total_trades INTEGER,
      equity_curve_json TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (strategy_id) REFERENCES strategies(id)
    )
  `,
  migrations: `
    CREATE TABLE IF NOT EXISTS _migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at INTEGER NOT NULL
    )
  `
};

// ── Database Manager ───────────────────────────────────────────────────────

export interface QueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDir?: 'ASC' | 'DESC';
}

export class DatabaseManager {
  private db: Database.Database | null = null;
  private dbPath: string;
  private ready = false;

  constructor(dbPath?: string) {
    this.dbPath = dbPath || path.join(app?.getPath('userData') || '', 'dawn-whales.db');
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────

  async init(): Promise<void> {
    if (this.ready) return;

    try {
      this.db = new Database(this.dbPath);

      // Performance pragmas
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('synchronous = NORMAL');
      this.db.pragma('cache_size = -64000'); // 64MB cache
      this.db.pragma('foreign_keys = ON');
      this.db.pragma('busy_timeout = 5000');

      this._runMigrations();
      this.ready = true;
      log.info('[DB] Initialized:', this.dbPath);
    } catch (err: any) {
      log.error('[DB] Init failed:', err);
      throw err;
    }
  }

  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.ready = false;
    }
  }

  private _runMigrations(): void {
    if (!this.db) return;

    for (const [name, sql] of Object.entries(SCHEMA)) {
      this.db.exec(sql);
    }

    const version = this.db.prepare('SELECT MAX(version) as v FROM _migrations').get() as any;
    if (!version?.v) {
      const now = Date.now();
      const insert = this.db.prepare('INSERT INTO _migrations (version, name, applied_at) VALUES (?, ?, ?)');
      let v = 1;
      for (const name of Object.keys(SCHEMA)) {
        insert.run(v, name, now);
        v++;
      }
    }
  }

  // ── Strategy CRUD ──────────────────────────────────────────────────────

  saveStrategy(strategy: {
    id: string;
    name: string;
    dsl: any;
    status?: string;
    tags?: string[];
    performance?: any;
  }): void {
    this._ensureReady();
    const now = Date.now();
    // Check update vs insert
    const existing = this.db!.prepare('SELECT id FROM strategies WHERE id = ?').get(strategy.id);
    if (existing) {
      this.db!.prepare(`
        UPDATE strategies SET name=?, dsl=?, status=?, updated_at=?, tags=?, performance_json=?
        WHERE id=?
      `).run(
        strategy.name,
        JSON.stringify(strategy.dsl),
        strategy.status || 'draft',
        now,
        JSON.stringify(strategy.tags || []),
        JSON.stringify(strategy.performance || {}),
        strategy.id
      );
    } else {
      this.db!.prepare(`
        INSERT INTO strategies (id, name, dsl, status, created_at, updated_at, tags, performance_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        strategy.id,
        strategy.name,
        JSON.stringify(strategy.dsl),
        strategy.status || 'draft',
        now,
        now,
        JSON.stringify(strategy.tags || []),
        JSON.stringify(strategy.performance || {})
      );
    }
  }

  getStrategy(id: string): any | null {
    this._ensureReady();
    const row = this.db!.prepare('SELECT * FROM strategies WHERE id = ?').get(id) as any;
    if (!row) return null;
    return this._deserializeStrategy(row);
  }

  listStrategies(opts: QueryOptions = {}): any[] {
    this._ensureReady();
    let sql = 'SELECT * FROM strategies';
    if (opts.orderBy) sql += ` ORDER BY ${opts.orderBy} ${opts.orderDir || 'DESC'}`;
    if (opts.limit) sql += ` LIMIT ${opts.limit}`;
    if (opts.offset) sql += ` OFFSET ${opts.offset}`;

    const rows = this.db!.prepare(sql).all() as any[];
    return rows.map(r => this._deserializeStrategy(r));
  }

  deleteStrategy(id: string): boolean {
    this._ensureReady();
    const result = this.db!.prepare('DELETE FROM strategies WHERE id = ?').run(id);
    return result.changes > 0;
  }

  // ── Orders ─────────────────────────────────────────────────────────────

  saveOrder(order: {
    id: string;
    strategyId?: string;
    symbol: string;
    side: string;
    orderType: string;
    quantity: number;
    price?: number;
    status?: string;
    commission?: number;
  }): void {
    this._ensureReady();

    const existing = this.db!.prepare('SELECT id FROM orders WHERE id = ?').get(order.id);
    if (existing) {
      this.db!.prepare(`
        UPDATE orders SET status=?, filled_at=?, filled_price=?, filled_quantity=?, commission=?
        WHERE id=?
      `).run(order.status, Date.now(), order.price, order.quantity, order.commission || 0, order.id);
    } else {
      this.db!.prepare(`
        INSERT INTO orders (id, strategy_id, symbol, side, order_type, quantity, price, status, placed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(order.id, order.strategyId || null, order.symbol, order.side,
        order.orderType, order.quantity, order.price || null, order.status || 'pending', Date.now());
    }
  }

  getOrders(opts: QueryOptions & { symbol?: string; status?: string } = {}): any[] {
    this._ensureReady();
    const conditions: string[] = [];
    const params: any[] = [];

    if (opts.symbol) { conditions.push('symbol = ?'); params.push(opts.symbol); }
    if (opts.status) { conditions.push('status = ?'); params.push(opts.status); }

    let sql = 'SELECT * FROM orders';
    if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
    if (opts.orderBy) sql += ` ORDER BY ${opts.orderBy} ${opts.orderDir || 'DESC'}`;
    if (opts.limit) sql += ` LIMIT ${opts.limit}`;
    if (opts.offset) sql += ` OFFSET ${opts.offset}`;

    return this.db!.prepare(sql).all(...params) as any[];
  }

  // ── Positions ──────────────────────────────────────────────────────────

  upsertPosition(pos: { symbol: string; quantity: number; avgCost: number; currentPrice?: number }): void {
    this._ensureReady();
    const existing = this.db!.prepare('SELECT * FROM positions WHERE symbol = ?').get(pos.symbol) as any;

    if (existing) {
      const totalQty = existing.quantity + pos.quantity;
      const totalCost = existing.avg_cost * existing.quantity + pos.avgCost * pos.quantity;
      const newAvg = totalQty > 0 ? totalCost / totalQty : 0;
      const mktVal = (pos.currentPrice || existing.current_price || newAvg) * totalQty;

      this.db!.prepare(`
        UPDATE positions SET quantity=?, avg_cost=?, current_price=?, market_value=?,
        unrealized_pnl=?, updated_at=? WHERE symbol=?
      `).run(totalQty, newAvg, pos.currentPrice || existing.current_price, mktVal,
        mktVal - totalCost, Date.now(), pos.symbol);
    } else {
      const mktVal = (pos.currentPrice || pos.avgCost) * pos.quantity;
      this.db!.prepare(`
        INSERT INTO positions (id, symbol, quantity, avg_cost, current_price, market_value, unrealized_pnl, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(pos.symbol + '-' + Date.now(), pos.symbol, pos.quantity, pos.avgCost,
        pos.currentPrice || pos.avgCost, mktVal, mktVal - pos.avgCost * pos.quantity, Date.now());
    }
  }

  getPositions(): any[] {
    this._ensureReady();
    return this.db!.prepare('SELECT * FROM positions WHERE quantity != 0').all();
  }

  // ── Config ─────────────────────────────────────────────────────────────

  setConfig(key: string, value: any): void {
    this._ensureReady();
    this.db!.prepare(`
      INSERT INTO config (key, value, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value=?, updated_at=?
    `).run(key, JSON.stringify(value), Date.now(), JSON.stringify(value), Date.now());
  }

  getConfig(key: string): any | null {
    this._ensureReady();
    const row = this.db!.prepare('SELECT value FROM config WHERE key = ?').get(key) as any;
    return row ? JSON.parse(row.value) : null;
  }

  // ── Backtest ───────────────────────────────────────────────────────────

  saveBacktest(bt: {
    id: string;
    strategyId?: string;
    name: string;
    startDate: string;
    endDate: string;
    metrics: any;
    equityCurve?: any[];
  }): void {
    this._ensureReady();
    const m = bt.metrics || {};
    this.db!.prepare(`
      INSERT INTO backtest_results (id, strategy_id, name, start_date, end_date,
        total_return, annual_return, sharpe_ratio, max_drawdown, win_rate,
        profit_factor, total_trades, equity_curve_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(bt.id, bt.strategyId || null, bt.name, bt.startDate, bt.endDate,
      m.totalReturn || null, m.annualReturn || null, m.sharpeRatio || null,
      m.maxDrawdown || null, m.winRate || null, m.profitFactor || null,
      m.totalTrades || null, JSON.stringify(bt.equityCurve || []), Date.now());
  }

  getBacktests(strategyId?: string, limit = 20): any[] {
    this._ensureReady();
    if (strategyId) {
      return this.db!.prepare(
        'SELECT * FROM backtest_results WHERE strategy_id = ? ORDER BY created_at DESC LIMIT ?'
      ).all(strategyId, limit);
    }
    return this.db!.prepare(
      'SELECT * FROM backtest_results ORDER BY created_at DESC LIMIT ?'
    ).all(limit);
  }

  // ── Stats ──────────────────────────────────────────────────────────────

  stats(): { strategies: number; orders: number; positions: number; backtests: number; dbSize: number } {
    this._ensureReady();
    const counts = this.db!.prepare(`
      SELECT
        (SELECT COUNT(*) FROM strategies) as strategies,
        (SELECT COUNT(*) FROM orders) as orders,
        (SELECT COUNT(*) FROM positions) as positions,
        (SELECT COUNT(*) FROM backtest_results) as backtests
    `).get() as any;

    const fs = require('fs');
    let dbSize = 0;
    try { dbSize = fs.statSync(this.dbPath).size; } catch {}

    return { ...counts, dbSize };
  }

  // ── Backup/Restore ─────────────────────────────────────────────────────

  async backup(targetPath: string): Promise<void> {
    this._ensureReady();
    await this.db!.backup(targetPath);
    log.info('[DB] Backup created:', targetPath);
  }

  transaction<T>(fn: () => T): T {
    this._ensureReady();
    const tx = this.db!.transaction(fn);
    return tx();
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  private _ensureReady(): void {
    if (!this.ready || !this.db) throw new Error('Database not initialized. Call db.init() first.');
  }

  private _deserializeStrategy(row: any): any {
    return {
      ...row,
      dsl: JSON.parse(row.dsl || '{}'),
      tags: JSON.parse(row.tags || '[]'),
      performance: JSON.parse(row.performance_json || '{}'),
    };
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let _db: DatabaseManager | null = null;

export function getDB(dbPath?: string): DatabaseManager {
  if (!_db) {
    _db = new DatabaseManager(dbPath);
  }
  return _db;
}

export function resetDB(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}

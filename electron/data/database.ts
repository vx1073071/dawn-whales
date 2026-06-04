// ── Database Manager — SQLite（和富途一样的本地数据库选型）─────────────────
import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';
import log from 'electron-log';

const DB_NAME = 'dawn-whales.db';

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
      -- ── 策略表 ──────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS strategies (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        symbol TEXT DEFAULT 'US.TQQQ',
        dsl_json TEXT NOT NULL,
        version TEXT DEFAULT '1.0.0',
        status TEXT DEFAULT 'draft',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      -- ── 回测结果表 ──────────────────────────────────────
      CREATE TABLE IF NOT EXISTS backtest_runs (
        id TEXT PRIMARY KEY,
        strategy_id TEXT REFERENCES strategies(id) ON DELETE CASCADE,
        start_date TEXT,
        end_date TEXT,
        initial_capital REAL DEFAULT 100000,
        total_return REAL,
        annual_return REAL,
        sharpe_ratio REAL,
        max_drawdown REAL,
        win_rate REAL,
        total_trades INTEGER,
        result_json TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      -- ── 交易记录表 ──────────────────────────────────────
      CREATE TABLE IF NOT EXISTS trades (
        id TEXT PRIMARY KEY,
        strategy_id TEXT REFERENCES strategies(id),
        account_id TEXT,
        symbol TEXT NOT NULL,
        side TEXT NOT NULL,
        order_type TEXT DEFAULT 'MARKET',
        quantity REAL,
        price REAL,
        filled_qty REAL DEFAULT 0,
        filled_price REAL DEFAULT 0,
        commission REAL DEFAULT 0,
        pnl REAL DEFAULT 0,
        pnl_pct REAL DEFAULT 0,
        status TEXT DEFAULT 'pending',
        order_id TEXT,
        remark TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        executed_at TEXT
      );

      -- ── K线缓存表（减少 OpenD 请求，加速回测）─────────
      CREATE TABLE IF NOT EXISTS kline_cache (
        symbol TEXT NOT NULL,
        period TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        open REAL,
        high REAL,
        low REAL,
        close REAL,
        volume INTEGER,
        PRIMARY KEY (symbol, period, timestamp)
      );

      -- ── 信号日志表 ──────────────────────────────────────
      CREATE TABLE IF NOT EXISTS signal_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        strategy_id TEXT REFERENCES strategies(id),
        signal TEXT NOT NULL,
        symbol TEXT NOT NULL,
        price REAL,
        reason TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      -- ── 自选股表 ────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS watchlist (
        code TEXT PRIMARY KEY,
        name TEXT,
        sort_order INTEGER DEFAULT 0,
        added_at TEXT DEFAULT (datetime('now'))
      );

      -- ── 策略评分表 (Marketplace) ────────────────────────
      CREATE TABLE IF NOT EXISTS strategy_ratings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        strategy_id TEXT NOT NULL REFERENCES strategies(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL DEFAULT 'local',
        rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
        created_at TEXT DEFAULT (datetime('now')),
        UNIQUE(strategy_id, user_id)
      );

      -- ── 策略评论表 (Marketplace) ────────────────────────
      CREATE TABLE IF NOT EXISTS strategy_comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        strategy_id TEXT NOT NULL REFERENCES strategies(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL DEFAULT 'local',
        content TEXT NOT NULL,
        parent_id INTEGER REFERENCES strategy_comments(id) ON DELETE CASCADE,
        created_at TEXT DEFAULT (datetime('now'))
      );

      -- ── 策略收益认证表 (Marketplace) ────────────────────
      CREATE TABLE IF NOT EXISTS strategy_performance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        strategy_id TEXT NOT NULL REFERENCES strategies(id) ON DELETE CASCADE,
        period TEXT NOT NULL,
        annual_return REAL,
        sharpe_ratio REAL,
        max_drawdown REAL,
        win_rate REAL,
        total_trades INTEGER,
        equity_curve TEXT,
        verified INTEGER DEFAULT 0,
        verified_at TEXT,
        updated_at TEXT DEFAULT (datetime('now'))
      );

      -- ── 设置表 ──────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );

      -- ── 索引 ────────────────────────────────────────────
      CREATE INDEX IF NOT EXISTS idx_trades_strategy ON trades(strategy_id);
      CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades(symbol);
      CREATE INDEX IF NOT EXISTS idx_trades_created ON trades(created_at);
      CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);
      CREATE INDEX IF NOT EXISTS idx_signals_strategy ON signal_log(strategy_id);
      CREATE INDEX IF NOT EXISTS idx_signals_created ON signal_log(created_at);
      CREATE INDEX IF NOT EXISTS idx_backtest_strategy ON backtest_runs(strategy_id);
      CREATE INDEX IF NOT EXISTS idx_backtest_created ON backtest_runs(created_at);
      CREATE INDEX IF NOT EXISTS idx_kline_cache_lookup ON kline_cache(symbol, period, timestamp);
      CREATE INDEX IF NOT EXISTS idx_strategies_status ON strategies(status);
      CREATE INDEX IF NOT EXISTS idx_ratings_strategy ON strategy_ratings(strategy_id);
      CREATE INDEX IF NOT EXISTS idx_ratings_user ON strategy_ratings(user_id, strategy_id);
      CREATE INDEX IF NOT EXISTS idx_comments_strategy ON strategy_comments(strategy_id);
      CREATE INDEX IF NOT EXISTS idx_comments_created ON strategy_comments(created_at);
      CREATE INDEX IF NOT EXISTS idx_performance_strategy ON strategy_performance(strategy_id);
    `);
    log.info('[Database] Tables initialized (v3 — marketplace)');
  }

  // ── Strategies ──────────────────────────────────────────────────

  getStrategies(): any[] {
    if (!this.db) return [];
    return this.db.prepare('SELECT * FROM strategies ORDER BY updated_at DESC').all();
  }

  getStrategy(id: string): any {
    if (!this.db) return null;
    return this.db.prepare('SELECT * FROM strategies WHERE id = ?').get(id);
  }

  saveStrategy(strategy: any): void {
    if (!this.db) return;
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO strategies (id, name, description, symbol, dsl_json, version, status, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);
    stmt.run(
      strategy.id,
      strategy.name,
      strategy.description || '',
      strategy.symbol || 'US.TQQQ',
      JSON.stringify(strategy),
      strategy.version || '1.0.0',
      strategy.status || 'draft',
    );
  }

  deleteStrategy(id: string): void {
    this.db?.prepare('DELETE FROM strategies WHERE id = ?').run(id);
  }

  // ── Backtest Results ────────────────────────────────────────────

  saveBacktestResult(run: any): void {
    if (!this.db) return;
    const id = `bt_${Date.now()}`;
    this.db.prepare(`
      INSERT INTO backtest_runs (id, strategy_id, start_date, end_date, initial_capital,
        total_return, annual_return, sharpe_ratio, max_drawdown, win_rate, total_trades, result_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, run.strategyId, run.startDate, run.endDate,
      run.initialCapital || 100000,
      run.totalReturn, run.annualReturn, run.sharpeRatio,
      run.maxDrawdown, run.winRate, run.totalTrades,
      JSON.stringify(run),
    );
  }

  getBacktestResults(strategyId: string): any[] {
    if (!this.db) return [];
    return this.db.prepare('SELECT * FROM backtest_runs WHERE strategy_id = ? ORDER BY created_at DESC LIMIT 10').all(strategyId);
  }

  // ── Trades ──────────────────────────────────────────────────────

  saveTrade(trade: any): void {
    if (!this.db) return;
    const id = trade.id || `trade_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    this.db.prepare(`
      INSERT INTO trades (id, strategy_id, account_id, symbol, side, order_type,
        quantity, price, filled_qty, filled_price, commission, pnl, pnl_pct,
        status, order_id, remark, executed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, trade.strategyId, trade.accountId, trade.symbol, trade.side,
      trade.orderType || 'MARKET', trade.quantity, trade.price,
      trade.filledQty || 0, trade.filledPrice || 0,
      trade.commission || 0, trade.pnl || 0, trade.pnlPct || 0,
      trade.status || 'pending', trade.orderId, trade.remark,
      trade.executedAt || null,
    );
  }

  getTrades(strategyId?: string, limit = 50): any[] {
    if (!this.db) return [];
    if (strategyId) {
      return this.db.prepare('SELECT * FROM trades WHERE strategy_id = ? ORDER BY created_at DESC LIMIT ?').all(strategyId, limit);
    }
    return this.db.prepare('SELECT * FROM trades ORDER BY created_at DESC LIMIT ?').all(limit);
  }

  // ── K-Line Cache ────────────────────────────────────────────────

  saveKlines(symbol: string, period: string, klines: any[]): void {
    if (!this.db || klines.length === 0) return;
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO kline_cache (symbol, period, timestamp, open, high, low, close, volume)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const tx = this.db.transaction((items: any[]) => {
      for (const k of items) {
        stmt.run(symbol, period, k.time, k.open, k.high, k.low, k.close, k.volume);
      }
    });
    tx(klines);
  }

  getKlines(symbol: string, period: string, count = 200): any[] {
    if (!this.db) return [];
    return this.db.prepare(
      'SELECT timestamp as time, open, high, low, close, volume FROM kline_cache WHERE symbol = ? AND period = ? ORDER BY timestamp DESC LIMIT ?'
    ).all(symbol, period, count).reverse();
  }

  // ── K-Line Cache Maintenance ───────────────────────────────────

  getKlineCount(): number {
    if (!this.db) return 0;
    const row = this.db.prepare('SELECT COUNT(*) as count FROM kline_cache').get() as any;
    return row?.count || 0;
  }

  cleanOldKlines(maxAgeDays = 365): number {
    if (!this.db) return 0;
    const cutoff = Math.floor(Date.now() / 1000) - maxAgeDays * 86400;
    const result = this.db.prepare('DELETE FROM kline_cache WHERE timestamp < ?').run(cutoff);
    return result.changes;
  }

  limitKlineCache(maxRecords = 50000): number {
    if (!this.db) return 0;
    const count = this.getKlineCount();
    if (count <= maxRecords) return 0;
    // Delete oldest entries beyond the limit
    // SQLite doesn't support LIMIT in DELETE with subqueries easily, use rowid
    const result = this.db.prepare(`
      DELETE FROM kline_cache WHERE rowid IN (
        SELECT rowid FROM kline_cache ORDER BY timestamp ASC LIMIT ?
      )
    `).run(count - maxRecords);
    return result.changes;
  }

  // ── Signal Log ──────────────────────────────────────────────────

  saveSignal(signal: any): void {
    if (!this.db) return;
    this.db.prepare(`
      INSERT INTO signal_log (strategy_id, signal, symbol, price, reason)
      VALUES (?, ?, ?, ?, ?)
    `).run(signal.strategyId, signal.signal, signal.symbol, signal.price, signal.reason);
  }

  getSignals(strategyId?: string, limit = 100): any[] {
    if (!this.db) return [];
    if (strategyId) {
      return this.db.prepare('SELECT * FROM signal_log WHERE strategy_id = ? ORDER BY created_at DESC LIMIT ?').all(strategyId, limit);
    }
    return this.db.prepare('SELECT * FROM signal_log ORDER BY created_at DESC LIMIT ?').all(limit);
  }

  // ── Watchlist ───────────────────────────────────────────────────

  getWatchlist(): any[] {
    if (!this.db) return [];
    return this.db.prepare('SELECT * FROM watchlist ORDER BY sort_order ASC').all();
  }

  saveWatchlist(codes: string[]): void {
    if (!this.db) return;
    const tx = this.db.transaction((items: string[]) => {
      this.db!.prepare('DELETE FROM watchlist').run();
      const stmt = this.db!.prepare('INSERT INTO watchlist (code, sort_order) VALUES (?, ?)');
      items.forEach((code, i) => stmt.run(code, i));
    });
    tx(codes);
  }

  // ── Marketplace: Ratings ────────────────────────────────────────

  rateStrategy(strategyId: string, rating: number, userId = 'local'): any {
    if (!this.db) return null;
    return this.db.prepare(`
      INSERT OR REPLACE INTO strategy_ratings (strategy_id, user_id, rating, created_at)
      VALUES (?, ?, ?, datetime('now'))
    `).run(strategyId, userId, rating);
  }

  getStrategyRating(strategyId: string): { avg: number; count: number } {
    if (!this.db) return { avg: 0, count: 0 };
    const row = this.db.prepare(`
      SELECT AVG(rating) as avg, COUNT(*) as count FROM strategy_ratings WHERE strategy_id = ?
    `).get(strategyId) as any;
    return { avg: row?.avg ? Math.round(row.avg * 10) / 10 : 0, count: row?.count || 0 };
  }

  getMyRating(strategyId: string, userId = 'local'): number {
    if (!this.db) return 0;
    const row = this.db.prepare(
      'SELECT rating FROM strategy_ratings WHERE strategy_id = ? AND user_id = ?'
    ).get(strategyId, userId) as any;
    return row?.rating || 0;
  }

  // ── Marketplace: Comments ───────────────────────────────────────

  addComment(strategyId: string, content: string, parentId?: number, userId = 'local'): any {
    if (!this.db) return null;
    return this.db.prepare(`
      INSERT INTO strategy_comments (strategy_id, user_id, content, parent_id)
      VALUES (?, ?, ?, ?)
    `).run(strategyId, userId, content, parentId || null);
  }

  getComments(strategyId: string, limit = 50): any[] {
    if (!this.db) return [];
    return this.db.prepare(`
      SELECT * FROM strategy_comments WHERE strategy_id = ? ORDER BY created_at DESC LIMIT ?
    `).all(strategyId, limit);
  }

  getCommentCount(strategyId: string): number {
    if (!this.db) return 0;
    const row = this.db.prepare(
      'SELECT COUNT(*) as count FROM strategy_comments WHERE strategy_id = ?'
    ).get(strategyId) as any;
    return row?.count || 0;
  }

  // ── Marketplace: Performance ────────────────────────────────────

  saveStrategyPerformance(data: {
    strategyId: string; period: string; annualReturn: number;
    sharpeRatio: number; maxDrawdown: number; winRate: number;
    totalTrades: number; equityCurve?: string; verified?: boolean;
  }): void {
    if (!this.db) return;
    this.db.prepare(`
      INSERT OR REPLACE INTO strategy_performance
        (strategy_id, period, annual_return, sharpe_ratio, max_drawdown,
         win_rate, total_trades, equity_curve, verified, verified_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      data.strategyId, data.period, data.annualReturn, data.sharpeRatio,
      data.maxDrawdown, data.winRate, data.totalTrades,
      data.equityCurve || null,
      data.verified ? 1 : 0,
      data.verified ? new Date().toISOString() : null,
    );
  }

  getStrategyPerformance(strategyId: string): any[] {
    if (!this.db) return [];
    return this.db.prepare(
      'SELECT * FROM strategy_performance WHERE strategy_id = ? ORDER BY period'
    ).all(strategyId);
  }

  getMarketplaceStrategies(sortBy = 'rating', limit = 50): any[] {
    if (!this.db) return [];
    const rows = this.db.prepare(`
      SELECT
        s.*,
        COALESCE(AVG(r.rating), 0) as avg_rating,
        COUNT(DISTINCT r.id) as rating_count,
        COUNT(DISTINCT c.id) as comment_count,
        (SELECT annual_return FROM strategy_performance sp WHERE sp.strategy_id = s.id AND sp.period = 'all' LIMIT 1) as performance_return,
        (SELECT sharpe_ratio FROM strategy_performance sp WHERE sp.strategy_id = s.id AND sp.period = 'all' LIMIT 1) as performance_sharpe
      FROM strategies s
      LEFT JOIN strategy_ratings r ON s.id = r.strategy_id
      LEFT JOIN strategy_comments c ON s.id = c.strategy_id
      WHERE s.status = 'published'
      GROUP BY s.id
      ORDER BY ${sortBy === 'rating' ? 'avg_rating DESC, rating_count DESC' : sortBy === 'return' ? 'performance_return DESC' : 's.updated_at DESC'}
      LIMIT ?
    `).all(limit);
    return rows;
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

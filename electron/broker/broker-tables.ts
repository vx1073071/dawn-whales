// ── DAWN WHALES — Broker Tables Schema ──────────────────────────────────
// R1 INF-03: broker_connections / broker_jobs / broker_orders 通用DB表
// 不依赖具体DB实现(SQLite/Supabase), 纯 SQL + TypeScript 类型

export interface BrokerConnectionRow {
  id: number;
  broker_id: string;            // e.g. 'binance-spot'
  broker_type: string;          // e.g. 'binance'
  broker_name: string;
  api_key_hash?: string;        // SHA-256 of API key (never store plaintext)
  secret_key_hash?: string;     // SHA-256 of secret (never store plaintext)
  passphrase_hash?: string;     // OKX-only
  host: string;
  port: number;
  enabled: boolean;
  last_connected_at?: string;   // ISO 8601
  last_error?: string;
  config_json?: string;         // JSON blob for broker-specific config
  created_at: string;
  updated_at: string;
}

export interface BrokerJobRow {
  id: number;
  job_id: string;               // UUID
  broker_id: string;
  job_type: 'connect' | 'disconnect' | 'subscribe' | 'trade' | 'reconciliation';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'dead_letter';
  request_json: string;         // JSON payload
  response_json?: string;       // JSON result
  error_message?: string;
  retry_count: number;
  max_retries: number;          // default: 3
  next_retry_at?: string;       // ISO 8601, exponential backoff
  created_at: string;
  completed_at?: string;
}

export interface BrokerOrderRow {
  id: number;
  broker_order_id: string;      // 券商返回的orderId
  client_order_id: string;      // 客户端幂等key
  broker_id: string;
  account_id: string;
  code: string;
  side: 'BUY' | 'SELL';
  order_type: 'MARKET' | 'LIMIT' | 'STOP' | 'STOP_LIMIT' | 'TRAILING_STOP' | 'OCO';
  qty: number;
  price: number;
  filled_qty: number;
  filled_price: number;
  status: string;
  commission?: number;
  commission_currency?: string;
  created_at: string;
  updated_at?: string;
}

// ═══ SQL Create Statements ════════════════════════════════

export const BROKER_CONNECTIONS_DDL = `
CREATE TABLE IF NOT EXISTS broker_connections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  broker_id TEXT NOT NULL UNIQUE,
  broker_type TEXT NOT NULL,
  broker_name TEXT NOT NULL,
  api_key_hash TEXT,
  secret_key_hash TEXT,
  passphrase_hash TEXT,
  host TEXT NOT NULL,
  port INTEGER NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  last_connected_at TEXT,
  last_error TEXT,
  config_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const BROKER_JOBS_DDL = `
CREATE TABLE IF NOT EXISTS broker_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id TEXT NOT NULL UNIQUE,
  broker_id TEXT NOT NULL,
  job_type TEXT NOT NULL CHECK(job_type IN ('connect','disconnect','subscribe','trade','reconciliation')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','running','completed','failed','dead_letter')),
  request_json TEXT NOT NULL,
  response_json TEXT,
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  next_retry_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
)`;

export const BROKER_ORDERS_DDL = `
CREATE TABLE IF NOT EXISTS broker_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  broker_order_id TEXT NOT NULL,
  client_order_id TEXT NOT NULL,
  broker_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  code TEXT NOT NULL,
  side TEXT NOT NULL CHECK(side IN ('BUY','SELL')),
  order_type TEXT NOT NULL CHECK(order_type IN ('MARKET','LIMIT','STOP','STOP_LIMIT','TRAILING_STOP','OCO')),
  qty REAL NOT NULL,
  price REAL NOT NULL DEFAULT 0,
  filled_qty REAL NOT NULL DEFAULT 0,
  filled_price REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'PENDING',
  commission REAL,
  commission_currency TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
)`;

export const ALL_BROKER_DDL = [
  BROKER_CONNECTIONS_DDL,
  BROKER_JOBS_DDL,
  BROKER_ORDERS_DDL,
];

// ═══ CRUD Helpers ═════════════════════════════════════════

export interface BrokerDB {
  run(sql: string, ...params: any[]): void;
  get<T = any>(sql: string, ...params: any[]): T | undefined;
  all<T = any>(sql: string, ...params: any[]): T[];
}

export class BrokerConnectionDAO {
  constructor(private db: BrokerDB) {}

  save(config: BrokerConnectionRow): void {
    this.db.run(
      `INSERT OR REPLACE INTO broker_connections
       (broker_id, broker_type, broker_name, api_key_hash, secret_key_hash, passphrase_hash, host, port, enabled, last_connected_at, last_error, config_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      config.broker_id, config.broker_type, config.broker_name, config.api_key_hash,
      config.secret_key_hash, config.passphrase_hash, config.host, config.port,
      config.enabled ? 1 : 0, config.last_connected_at, config.last_error, config.config_json,
    );
  }

  getByBrokerId(brokerId: string): BrokerConnectionRow | undefined {
    return this.db.get<BrokerConnectionRow>(
      'SELECT * FROM broker_connections WHERE broker_id = ?', brokerId,
    );
  }

  getAllEnabled(): BrokerConnectionRow[] {
    return this.db.all<BrokerConnectionRow>(
      'SELECT * FROM broker_connections WHERE enabled = 1',
    );
  }

  updateLastConnected(brokerId: string, ts: string): void {
    this.db.run(
      "UPDATE broker_connections SET last_connected_at = ?, updated_at = datetime('now') WHERE broker_id = ?",
      ts, brokerId,
    );
  }

  updateLastError(brokerId: string, error: string): void {
    this.db.run(
      "UPDATE broker_connections SET last_error = ?, updated_at = datetime('now') WHERE broker_id = ?",
      error, brokerId,
    );
  }

  delete(brokerId: string): void {
    this.db.run('DELETE FROM broker_connections WHERE broker_id = ?', brokerId);
  }
}

export class BrokerJobDAO {
  constructor(private db: BrokerDB) {}

  enqueue(job: Omit<BrokerJobRow, 'id' | 'retry_count' | 'status' | 'created_at'>): BrokerJobRow {
    const row: BrokerJobRow = {
      id: 0,
      ...job,
      status: 'pending',
      retry_count: 0,
      created_at: new Date().toISOString(),
    };
    this.db.run(
      `INSERT INTO broker_jobs (job_id, broker_id, job_type, status, request_json, max_retries, created_at)
       VALUES (?, ?, ?, 'pending', ?, ?, datetime('now'))`,
      row.job_id, row.broker_id, row.job_type, row.request_json, row.max_retries,
    );
    return row;
  }

  getPending(brokerId?: string): BrokerJobRow[] {
    const sql = brokerId
      ? 'SELECT * FROM broker_jobs WHERE status = ? AND broker_id = ? ORDER BY created_at ASC'
      : 'SELECT * FROM broker_jobs WHERE status = ? ORDER BY created_at ASC';
    return this.db.all<BrokerJobRow>(sql, 'pending', ...(brokerId ? [brokerId] : []));
  }

  getDeadLetters(): BrokerJobRow[] {
    return this.db.all<BrokerJobRow>(
      'SELECT * FROM broker_jobs WHERE status = ? ORDER BY created_at DESC',
      'dead_letter',
    );
  }

  updateStatus(jobId: string, status: BrokerJobRow['status'], responseJson?: string, errorMessage?: string): void {
    this.db.run(
      `UPDATE broker_jobs SET status = ?, response_json = ?, error_message = ?, completed_at = datetime('now')
       WHERE job_id = ?`,
      status, responseJson ?? null, errorMessage ?? null, jobId,
    );
  }

  incrementRetry(jobId: string, nextRetryAt: string): void {
    this.db.run(
      `UPDATE broker_jobs SET retry_count = retry_count + 1, next_retry_at = ?
       WHERE job_id = ?`,
      nextRetryAt, jobId,
    );
  }

  moveToDeadLetter(jobId: string, errorMsg: string): void {
    this.db.run(
      `UPDATE broker_jobs SET status = 'dead_letter', error_message = ?, completed_at = datetime('now')
       WHERE job_id = ?`,
      errorMsg, jobId,
    );
  }
}

export class BrokerOrderDAO {
  constructor(private db: BrokerDB) {}

  save(order: BrokerOrderRow): void {
    this.db.run(
      `INSERT OR REPLACE INTO broker_orders
       (broker_order_id, client_order_id, broker_id, account_id, code, side, order_type, qty, price, filled_qty, filled_price, status, commission, commission_currency, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      order.broker_order_id, order.client_order_id, order.broker_id, order.account_id,
      order.code, order.side, order.order_type, order.qty, order.price,
      order.filled_qty, order.filled_price, order.status,
      order.commission, order.commission_currency,
    );
  }

  getByBrokerOrderId(brokerOrderId: string): BrokerOrderRow | undefined {
    return this.db.get<BrokerOrderRow>(
      'SELECT * FROM broker_orders WHERE broker_order_id = ?', brokerOrderId,
    );
  }

  getByBroker(brokerId: string, limit = 100): BrokerOrderRow[] {
    return this.db.all<BrokerOrderRow>(
      'SELECT * FROM broker_orders WHERE broker_id = ? ORDER BY created_at DESC LIMIT ?',
      brokerId, limit,
    );
  }

  updateStatus(brokerOrderId: string, status: string, filledQty?: number, filledPrice?: number): void {
    this.db.run(
      `UPDATE broker_orders SET status = ?, filled_qty = COALESCE(?, filled_qty),
       filled_price = COALESCE(?, filled_price), updated_at = datetime('now')
       WHERE broker_order_id = ?`,
      status, filledQty ?? null, filledPrice ?? null, brokerOrderId,
    );
  }
}

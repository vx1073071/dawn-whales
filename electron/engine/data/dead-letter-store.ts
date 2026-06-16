// ── QUANT MOO — Dead Letter Queue (SQLite Persisted) ─────────
// R108 S-35: Persistent dead letter queue for failed
// points deductions, reconciliation failures, rate rejections.
//
// Replaces in-memory storage — survives app restarts.
// Supports retry, skip, batch operations, and audit log.

import Database from 'better-sqlite3';

export interface DeadLetterEntry {
  id: number;
  type: 'FEE_DEDUCTION' | 'RATE_REJECTION' | 'RECONCILIATION' | 'EXCHANGE_ERROR';
  tradeId?: string;
  amount?: number;
  currency?: string;
  reason: string;
  payload: string; // JSON string of original request
  retryCount: number;
  maxRetries: number;
  status: 'PENDING' | 'RETRYING' | 'RESOLVED' | 'SKIPPED' | 'PERMANENT_FAILURE';
  createdAt: string;
  lastRetryAt?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  auditLog: string; // JSON array of audit entries
}

export interface AuditEntry {
  action: 'RETRY' | 'SKIP' | 'BATCH_RETRY' | 'BATCH_SKIP' | 'AUTO_RETRY' | 'PERMANENT_FAILURE';
  operator: string; // 'SYSTEM' | 'ADMIN' | user ID
  timestamp: string;
  note?: string;
  previousStatus?: string;
}

export class DeadLetterStore {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
    this.migrate();
  }

  // ── Schema ────────────────────────────────────────────────────
  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS dead_letter_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL CHECK(type IN ('FEE_DEDUCTION','RATE_REJECTION','RECONCILIATION','EXCHANGE_ERROR')),
        trade_id TEXT,
        amount REAL,
        currency TEXT DEFAULT 'USDT',
        reason TEXT NOT NULL,
        payload TEXT NOT NULL DEFAULT '{}',
        retry_count INTEGER NOT NULL DEFAULT 0,
        max_retries INTEGER NOT NULL DEFAULT 3,
        status TEXT NOT NULL DEFAULT 'PENDING'
          CHECK(status IN ('PENDING','RETRYING','RESOLVED','SKIPPED','PERMANENT_FAILURE')),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        last_retry_at TEXT,
        resolved_at TEXT,
        resolved_by TEXT,
        audit_log TEXT NOT NULL DEFAULT '[]'
      );

      CREATE INDEX IF NOT EXISTS idx_dead_letter_status ON dead_letter_queue(status);
      CREATE INDEX IF NOT EXISTS idx_dead_letter_type ON dead_letter_queue(type);
      CREATE INDEX IF NOT EXISTS idx_dead_letter_created ON dead_letter_queue(created_at);

      -- Idempotency: prevent duplicate dead letters for same trade
      CREATE UNIQUE INDEX IF NOT EXISTS idx_dead_letter_trade
        ON dead_letter_queue(trade_id, type) WHERE status IN ('PENDING', 'RETRYING');
    `);
  }

  // ── Write ─────────────────────────────────────────────────────
  enqueue(entry: {
    type: DeadLetterEntry['type'];
    tradeId?: string;
    amount?: number;
    currency?: string;
    reason: string;
    payload: unknown;
    maxRetries?: number;
  }): number {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO dead_letter_queue
        (type, trade_id, amount, currency, reason, payload, max_retries)
      VALUES (@type, @trade_id, @amount, @currency, @reason, @payload, @max_retries)
    `);

    const result = stmt.run({
      type: entry.type,
      trade_id: entry.tradeId ?? null,
      amount: entry.amount ?? null,
      currency: entry.currency ?? 'USDT',
      reason: entry.reason,
      payload: JSON.stringify(entry.payload),
      max_retries: entry.maxRetries ?? 3,
    });

    return Number(result.lastInsertRowid);
  }

  // ── Read ──────────────────────────────────────────────────────
  list(filters?: {
    status?: string;
    type?: string;
    limit?: number;
    offset?: number;
  }): DeadLetterEntry[] {
    const conditions: string[] = [];
    const params: Record<string, unknown> = {};

    if (filters?.status) {
      conditions.push('status = @status');
      params.status = filters.status;
    }
    if (filters?.type) {
      conditions.push('type = @type');
      params.type = filters.type;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = filters?.limit ?? 100;
    const offset = filters?.offset ?? 0;

    return this.db.prepare(`
      SELECT * FROM dead_letter_queue
      ${where}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `).all(params) as DeadLetterEntry[];
  }

  getById(id: number): DeadLetterEntry | undefined {
    return this.db.prepare('SELECT * FROM dead_letter_queue WHERE id = ?')
      .get(id) as DeadLetterEntry | undefined;
  }

  count(filters?: { status?: string; type?: string }): number {
    const conditions: string[] = [];
    const params: Record<string, unknown> = {};

    if (filters?.status) { conditions.push('status = @status'); params.status = filters.status; }
    if (filters?.type) { conditions.push('type = @type'); params.type = filters.type; }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    return (this.db.prepare(`SELECT COUNT(*) as count FROM dead_letter_queue ${where}`)
      .get(params) as { count: number }).count;
  }

  // ── Retry ─────────────────────────────────────────────────────
  retry(id: number, operator: string): { success: boolean; error?: string } {
    const entry = this.getById(id);
    if (!entry) return { success: false, error: 'Dead letter not found' };
    if (entry.status === 'RESOLVED' || entry.status === 'SKIPPED') {
      return { success: false, error: `Already ${entry.status.toLowerCase()}` };
    }
    if (entry.retryCount >= entry.maxRetries) {
      this.updateStatus(id, 'PERMANENT_FAILURE', operator);
      return { success: false, error: 'Max retries exceeded — marked as PERMANENT_FAILURE' };
    }

    // Mark as retrying, increment counter
    this.db.prepare(`
      UPDATE dead_letter_queue
      SET status = 'RETRYING', retry_count = retry_count + 1, last_retry_at = datetime('now')
      WHERE id = ?
    `).run(id);

    this._appendAudit(id, {
      action: 'RETRY',
      operator,
      timestamp: new Date().toISOString(),
      previousStatus: entry.status,
    });

    return { success: true };
  }

  resolve(id: number, operator: string): void {
    this.updateStatus(id, 'RESOLVED', operator);
    this._appendAudit(id, {
      action: operator === 'SYSTEM' ? 'AUTO_RETRY' : 'RETRY',
      operator,
      timestamp: new Date().toISOString(),
      previousStatus: 'RETRYING',
    });
  }

  skip(id: number, operator: string, note?: string): void {
    this.updateStatus(id, 'SKIPPED', operator);
    this._appendAudit(id, {
      action: 'SKIP',
      operator,
      timestamp: new Date().toISOString(),
      note,
      previousStatus: 'RETRYING',
    });
  }

  // ── Batch ─────────────────────────────────────────────────────
  batchRetry(ids: number[], operator: string): { success: number; failed: number } {
    let success = 0, failed = 0;
    // Limit batch to 20
    const batch = ids.slice(0, 20);
    for (const id of batch) {
      const result = this.retry(id, operator);
      if (result.success) success++; else failed++;
    }
    this._appendAudit(batch[0], {
      action: 'BATCH_RETRY',
      operator,
      timestamp: new Date().toISOString(),
      note: `Batch retry: ${success}/${batch.length} queued`,
    });
    return { success, failed };
  }

  batchSkip(ids: number[], operator: string): { success: number } {
    let success = 0;
    const batch = ids.slice(0, 20);
    for (const id of batch) {
      this.skip(id, operator, 'Batch skip');
      success++;
    }
    return { success };
  }

  // ── Audit ─────────────────────────────────────────────────────
  getAuditLog(id: number, limit = 50): AuditEntry[] {
    const entry = this.getById(id);
    if (!entry) return [];
    try {
      return JSON.parse(entry.auditLog) as AuditEntry[];
    } catch {
      return [];
    }
  }

  getAuditLogAll(limit = 100): Array<{ id: number; entries: AuditEntry[] }> {
    return this.db.prepare(`
      SELECT id, audit_log FROM dead_letter_queue ORDER BY created_at DESC LIMIT ?
    `).all(limit).map((row: { id: number; audit_log: string }) => ({
      id: row.id,
      entries: JSON.parse(row.audit_log) as AuditEntry[],
    }));
  }

  // ── Cleanup ───────────────────────────────────────────────────
  purgeResolved(olderThanDays = 30): number {
    const result = this.db.prepare(`
      DELETE FROM dead_letter_queue
      WHERE status IN ('RESOLVED', 'SKIPPED')
        AND resolved_at < datetime('now', '-${olderThanDays} days')
    `).run();
    return result.changes;
  }

  // ── Privates ──────────────────────────────────────────────────
  private updateStatus(id: number, status: DeadLetterEntry['status'], resolvedBy: string): void {
    this.db.prepare(`
      UPDATE dead_letter_queue
      SET status = ?, resolved_at = datetime('now'), resolved_by = ?
      WHERE id = ?
    `).run(status, resolvedBy, id);
  }

  private _appendAudit(id: number, entry: AuditEntry): void {
    const current = this.getAuditLog(id);
    current.push(entry);
    this.db.prepare('UPDATE dead_letter_queue SET audit_log = ? WHERE id = ?')
      .run(JSON.stringify(current), id);
  }
}

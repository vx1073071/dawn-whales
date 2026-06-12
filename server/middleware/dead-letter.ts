// ── DAWN WHALES Dead Letter Queue ─────────────────────────────────────
// R132-P02: Failed signals (3 retries) → dead letter store → manual review

import { getMainDb } from '../db/database';
import { logAuditError } from './audit-logger';
import crypto from 'crypto';

const MAX_RETRIES = 3;
const DEAD_LETTER_CLEANUP_DAYS = 30;

// Move signal to dead letter after max retries
export function moveToDeadLetter(signalId: string, reason: string): void {
  const db = getMainDb();
  db.prepare(`
    UPDATE signals SET status = 'dead', error_message = ?, executed_at = datetime('now')
    WHERE id = ? AND retry_count >= ?
  `).run(reason, signalId, MAX_RETRIES);

  const id = crypto.randomUUID();
  db.prepare(`
    INSERT OR IGNORE INTO dead_letters (id, signal_id, reason, retry_count, created_at)
    VALUES (?, ?, ?, ?, datetime('now'))
  `).run(id, signalId, reason, MAX_RETRIES);

  logAuditError('Signal moved to dead letter', { signalId, reason, retries: MAX_RETRIES });
}

// Retry failed signals
export async function retryDeadSignals(batchSize = 20): Promise<number> {
  const db = getMainDb();
  const deadSignals = db.prepare(`
    SELECT * FROM signals WHERE status = 'failed' AND retry_count < ?
    ORDER BY priority ASC, created_at ASC LIMIT ?
  `).all(MAX_RETRIES, batchSize) as Array<Record<string, string>>;

  let retried = 0;
  const stmt = db.prepare(`
    UPDATE signals SET status = 'pending', retry_count = retry_count + 1, error_message = NULL
    WHERE id = ?
  `);

  for (const signal of deadSignals) {
    stmt.run(signal.id);
    retried++;
  }

  return retried;
}

// Manual override: force-retry a dead lettered signal
export function forceRetryDeadLetter(signalId: string): boolean {
  const db = getMainDb();
  const result = db.prepare(`
    UPDATE signals SET status = 'pending', retry_count = 0, error_message = NULL
    WHERE id = ? AND status = 'dead'
  `).run(signalId);
  return result.changes > 0;
}

// Manual override: cancel a dead lettered signal
export function cancelDeadLetter(signalId: string): boolean {
  const db = getMainDb();
  const result = db.prepare(`
    UPDATE signals SET status = 'cancelled' WHERE id = ? AND status = 'dead'
  `).run(signalId);
  return result.changes > 0;
}

// Cleanup old dead letters (>30 days)
export function cleanupOldDeadLetters(): number {
  const db = getMainDb();
  const result = db.prepare(`
    DELETE FROM dead_letters WHERE created_at < datetime('now', ?)
  `).run(`-${DEAD_LETTER_CLEANUP_DAYS} days`);
  return result.changes;
}

// Auto-cleanup: run every 6 hours
setInterval(() => {
  const cleaned = cleanupOldDeadLetters();
  if (cleaned > 0) console.log(`[DeadLetter] Cleaned ${cleaned} old entries`);
}, 6 * 60 * 60 * 1000);

// ── API endpoints ────────────────────────────────────────────────────

import { Router, Request, Response } from 'express';
import { authMiddleware } from './jwt-auth';

const router = Router();

// GET /api/dead-letter — List dead lettered signals
router.get('/', authMiddleware, (_req: Request, res: Response) => {
  const db = getMainDb();
  const signals = db.prepare(`
    SELECT * FROM signals WHERE status = 'dead' ORDER BY created_at DESC LIMIT 100
  `).all();
  res.json({ success: true, signals, total: (signals as unknown[]).length });
});

// POST /api/dead-letter/:id/retry — Force retry
router.post('/:id/retry', authMiddleware, (req: Request, res: Response) => {
  const ok = forceRetryDeadLetter(req.params.id);
  res.json({ success: ok, signalId: req.params.id, status: ok ? 'retrying' : 'not_found' });
});

// POST /api/dead-letter/:id/cancel — Cancel
router.post('/:id/cancel', authMiddleware, (req: Request, res: Response) => {
  const ok = cancelDeadLetter(req.params.id);
  res.json({ success: ok, signalId: req.params.id, status: ok ? 'cancelled' : 'not_found' });
});

export default router;

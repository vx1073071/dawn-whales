// ── QUANT MOO — Dead Letter IPC Handlers ──────────────────────
// R108 S-35: IPC endpoints for Admin dead letter panel.

import { ipcMain } from 'electron';
import { DeadLetterStore } from '../data/dead-letter-store';
import log from 'electron-log';
import { z } from 'zod';

// ── Zod Schemas ─────────────────────────────────────────────────
const DeadLetterListSchema = z.object({
  status: z.enum(['PENDING', 'RETRYING', 'RESOLVED', 'SKIPPED', 'PERMANENT_FAILURE']).optional(),
  type: z.enum(['FEE_DEDUCTION', 'RATE_REJECTION', 'RECONCILIATION', 'EXCHANGE_ERROR']).optional(),
  limit: z.number().int().min(1).max(500).optional().default(100),
  offset: z.number().int().min(0).optional().default(0),
});

const DeadLetterRetrySchema = z.object({ id: z.number().int().positive() });
const DeadLetterSkipSchema = z.object({ id: z.number().int().positive(), note: z.string().max(500).optional() });
const DeadLetterBatchSchema = z.object({ ids: z.array(z.number().int().positive()).min(1).max(20) });
const DeadLetterAuditSchema = z.object({ id: z.number().int().positive() });

// ── Register ────────────────────────────────────────────────────
export function registerDeadLetterIPC(store: DeadLetterStore): void {

  ipcMain.handle('dead-letter:list', async (_event, raw: unknown) => {
    const parsed = DeadLetterListSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: parsed.error.message };
    }
    try {
      const entries = store.list(parsed.data);
      const total = store.count(
        parsed.data.status || parsed.data.type
          ? { status: parsed.data.status, type: parsed.data.type }
          : undefined
      );
      return { success: true, entries, total };
    } catch (err: any) {
      log.error('[DeadLetter] list error:', err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('dead-letter:retry', async (_event, raw: unknown) => {
    const parsed = DeadLetterRetrySchema.safeParse(raw);
    if (!parsed.success) return { success: false, error: parsed.error.message };
    try {
      const result = store.retry(parsed.data.id, 'ADMIN');
      if (result.success) {
        log.info(`[DeadLetter] Retry queued — id=${parsed.data.id}`);
      }
      return result;
    } catch (err: any) {
      log.error('[DeadLetter] retry error:', err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('dead-letter:skip', async (_event, raw: unknown) => {
    const parsed = DeadLetterSkipSchema.safeParse(raw);
    if (!parsed.success) return { success: false, error: parsed.error.message };
    try {
      store.skip(parsed.data.id, 'ADMIN', parsed.data.note);
      return { success: true };
    } catch (err: any) {
      log.error('[DeadLetter] skip error:', err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('dead-letter:batch-retry', async (_event, raw: unknown) => {
    const parsed = DeadLetterBatchSchema.safeParse(raw);
    if (!parsed.success) return { success: false, error: parsed.error.message };
    try {
      const result = store.batchRetry(parsed.data.ids, 'ADMIN');
      return { success: true, ...result };
    } catch (err: any) {
      log.error('[DeadLetter] batch-retry error:', err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('dead-letter:batch-skip', async (_event, raw: unknown) => {
    const parsed = DeadLetterBatchSchema.safeParse(raw);
    if (!parsed.success) return { success: false, error: parsed.error.message };
    try {
      const result = store.batchSkip(parsed.data.ids, 'ADMIN');
      return { success: true, ...result };
    } catch (err: any) {
      log.error('[DeadLetter] batch-skip error:', err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('dead-letter:audit-log', async (_event, raw: unknown) => {
    const parsed = DeadLetterAuditSchema.safeParse(raw);
    if (!parsed.success) return { success: false, error: parsed.error.message };
    try {
      const entries = store.getAuditLog(parsed.data.id);
      return { success: true, entries };
    } catch (err: any) {
      log.error('[DeadLetter] audit-log error:', err.message);
      return { success: false, error: err.message };
    }
  });

  log.info('[IPC] DeadLetter handlers registered (6 endpoints)');
}

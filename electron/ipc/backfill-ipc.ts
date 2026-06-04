// ── DAWN WHALES IPC: backfill ────────────────────────────────────────────
// Auto-split from main.ts — 6 handlers
//
// Registered channels:
//   backfill:start
//   backfill:stop
//   backfill:status
//   backfill:stats
//   backfill:symbols
//   backfill:incremental

import { ipcMain, BrowserWindow } from 'electron';

// Auto-imported dependencies:
import { backfillSymbols, getBackfillStats, getBackfillStatus, incrementalBackfill, startBackfill, stopBackfill } from './engine/backfill-service';

/**
 * Register all backfill IPC handlers
 *
 */
export function registerBackfillIPC(
  
) {

  // ── backfill:start ───────────────────────────────────────────────
  // ── Backfill Service (JVS-59) ───────────────────────────────────────────
  ipcMain.handle('backfill:start', async (_e, config: any) => {
    try {
      const result = await startBackfill(config);
      return { success: true, result };
    } catch (err: any) {
      log.error('[Backfill] Start error:', err);
      return { success: false, error: err.message };
    }
  });

  // ── backfill:stop ───────────────────────────────────────────────
  ipcMain.handle('backfill:stop', async () => {
    try {
      stopBackfill();
      return { success: true };
    } catch (err: any) {
      log.error('[Backfill] Stop error:', err);
      return { success: false, error: err.message };
    }
  });

  // ── backfill:status ───────────────────────────────────────────────
  ipcMain.handle('backfill:status', async () => {
    try {
      const status = getBackfillStatus();
      return { success: true, status };
    } catch (err: any) {
      log.error('[Backfill] Status error:', err);
      return { success: false, error: err.message };
    }
  });

  // ── backfill:stats ───────────────────────────────────────────────
  ipcMain.handle('backfill:stats', async () => {
    try {
      const stats = getBackfillStats();
      return { success: true, stats };
    } catch (err: any) {
      log.error('[Backfill] Stats error:', err);
      return { success: false, error: err.message };
    }
  });

  // ── backfill:symbols ───────────────────────────────────────────────
  ipcMain.handle('backfill:symbols', async (_e, symbols: string[], startDate: string, endDate: string, interval?: any) => {
    try {
      const result = await backfillSymbols(symbols, startDate, endDate, interval);
      return { success: true, result };
    } catch (err: any) {
      log.error('[Backfill] Symbols backfill error:', err);
      return { success: false, error: err.message };
    }
  });

  // ── backfill:incremental ───────────────────────────────────────────────
  ipcMain.handle('backfill:incremental', async (_e, symbol: string, startDate: string, endDate: string, existingRecords: any[]) => {
    try {
      const result = await incrementalBackfill(symbol, startDate, endDate, existingRecords);
      return { success: true, result };
    } catch (err: any) {
      log.error('[Backfill] Incremental backfill error:', err);
      return { success: false, error: err.message };
    }
  });

}

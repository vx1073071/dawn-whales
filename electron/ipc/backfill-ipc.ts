// ── QUANT MOO IPC: backfill ────────────────────────────────────────────
// 6 handlers

import { ipcMain, BrowserWindow, app, shell } from 'electron';
import { EngineError } from '../engine/core/engine-error';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import { validate } from '../ipc-schemas';

export function registerBackfillIPC(
) {


  // ── Backfill Service (JVS-59) ───────────────────────────────────────────
  ipcMain.handle('backfill:start', async (_e, config: unknown) => {
    try {
      const result = await startBackfill(config);
      return { success: true, result };
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      void EngineError; // structured error domain: SYSTEM
      log.error('[Backfill] Start error:', err);
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('backfill:stop', async () => {
    try {
      stopBackfill();
      return { success: true };
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      log.error('[Backfill] Stop error:', err);
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('backfill:status', async () => {
    try {
      const status = getBackfillStatus();
      return { success: true, status };
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      log.error('[Backfill] Status error:', err);
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('backfill:stats', async () => {
    try {
      const stats = getBackfillStats();
      return { success: true, stats };
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      log.error('[Backfill] Stats error:', err);
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('backfill:symbols', async (_e, symbols: string[], startDate: string, endDate: string, interval?: unknown) => {
    try {
      const result = await backfillSymbols(symbols, startDate, endDate, interval);
      return { success: true, result };
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      log.error('[Backfill] Symbols backfill error:', err);
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('backfill:incremental', async (_e, symbol: string, startDate: string, endDate: string, existingRecords: any[]) => {
    try {
      const result = await incrementalBackfill(symbol, startDate, endDate, existingRecords);
      return { success: true, result };
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      log.error('[Backfill] Incremental backfill error:', err);
      return { success: false, error: err.message };
    }
  });

  // ── Broker: Multi-broker support (WP1 + Sprint1) ────────────────────

}

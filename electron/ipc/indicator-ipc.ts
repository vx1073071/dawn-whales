// ── DAWN WHALES IPC: indicator ────────────────────────────────────────────
// Auto-split from main.ts — 6 handlers
//
// Registered channels:
//   indicator:compute
//   indicator:realtime-add
//   indicator:realtime-add-batch
//   indicator:realtime-get-buffer
//   indicator:realtime-clear
//   indicator:realtime-clear-all

import { ipcMain, BrowserWindow } from 'electron';

// Auto-imported dependencies:
import { computeIndicators } from './engine/technical-indicators';
import { getRealtimeIndicatorCalculator } from './engine/realtime-indicators';

/**
 * Register all indicator IPC handlers
 *
 */
export function registerIndicatorIPC(
  
) {

  // ── indicator:compute ───────────────────────────────────────────────
  // ── Technical Indicators (JVS-43) ──────────────────────────────────────
  ipcMain.handle('indicator:compute', async (_e, klines: any[], indicators?: string[], options?: any) => {
    try {
      return computeIndicators(klines, indicators, options);
    } catch (err: any) {
      log.error('[TechnicalIndicators] Error:', err);
      return { success: false, error: err.message };
    }
  });

  // ── indicator:realtime-add ───────────────────────────────────────────────
  // ── Realtime Technical Indicators (JVS-36) ─────────────────────────────
  ipcMain.handle('indicator:realtime-add', async (_e, symbol: string, kline: any) => {
    try {
      const calculator = getRealtimeIndicatorCalculator();
      return { success: true, indicators: calculator.addKLine(symbol, kline) };
    } catch (err: any) {
      log.error('[RealtimeIndicators] Add error:', err);
      return { success: false, error: err.message };
    }
  });

  // ── indicator:realtime-add-batch ───────────────────────────────────────────────
  ipcMain.handle('indicator:realtime-add-batch', async (_e, symbol: string, klines: any[]) => {
    try {
      const calculator = getRealtimeIndicatorCalculator();
      return { success: true, indicators: calculator.addKLines(symbol, klines) };
    } catch (err: any) {
      log.error('[RealtimeIndicators] Batch add error:', err);
      return { success: false, error: err.message };
    }
  });

  // ── indicator:realtime-get-buffer ───────────────────────────────────────────────
  ipcMain.handle('indicator:realtime-get-buffer', async (_e, symbol: string) => {
    try {
      const calculator = getRealtimeIndicatorCalculator();
      return { success: true, klines: calculator.getKLineBuffer(symbol) };
    } catch (err: any) {
      log.error('[RealtimeIndicators] Get buffer error:', err);
      return { success: false, error: err.message };
    }
  });

  // ── indicator:realtime-clear ───────────────────────────────────────────────
  ipcMain.handle('indicator:realtime-clear', async (_e, symbol: string) => {
    try {
      const calculator = getRealtimeIndicatorCalculator();
      calculator.clearBuffer(symbol);
      return { success: true };
    } catch (err: any) {
      log.error('[RealtimeIndicators] Clear error:', err);
      return { success: false, error: err.message };
    }
  });

  // ── indicator:realtime-clear-all ───────────────────────────────────────────────
  ipcMain.handle('indicator:realtime-clear-all', async () => {
    try {
      const calculator = getRealtimeIndicatorCalculator();
      calculator.clearAllBuffers();
      return { success: true };
    } catch (err: any) {
      log.error('[RealtimeIndicators] Clear all error:', err);
      return { success: false, error: err.message };
    }
  });

}

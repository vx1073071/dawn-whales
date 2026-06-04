// ── DAWN WHALES IPC: indicator ────────────────────────────────────────────
// 6 handlers

import { ipcMain, BrowserWindow, app, shell } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import { validate } from '../ipc-schemas';
import { computeIndicators } from '../engine/technical-indicators';
import { getRealtimeIndicatorCalculator } from '../engine/realtime-indicators';

export function registerIndicatorIPC(
) {


  // ── Technical Indicators (JVS-43) ──────────────────────────────────────
  ipcMain.handle('indicator:compute', async (_e, klines: any[], indicators?: string[], options?: any) => {
    try {
      return computeIndicators(klines, indicators, options);
    } catch (err: any) {
      log.error('[TechnicalIndicators] Error:', err);
      return { success: false, error: err.message };
    }
  });

  // ── Realtime Technical Indicators (JVS-36) ─────────────────────────────


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



  ipcMain.handle('indicator:realtime-add-batch', async (_e, symbol: string, klines: any[]) => {
    try {
      const calculator = getRealtimeIndicatorCalculator();
      return { success: true, indicators: calculator.addKLines(symbol, klines) };
    } catch (err: any) {
      log.error('[RealtimeIndicators] Batch add error:', err);
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('indicator:realtime-get-buffer', async (_e, symbol: string) => {
    try {
      const calculator = getRealtimeIndicatorCalculator();
      return { success: true, klines: calculator.getKLineBuffer(symbol) };
    } catch (err: any) {
      log.error('[RealtimeIndicators] Get buffer error:', err);
      return { success: false, error: err.message };
    }
  });



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

  // ── Options Pricing Engine (JVS-44) ────────────────────────────────────

  // JVS-44: 技术指标实时计算
  ipcMain.handle('indicator:calculate', async (_e, symbol: string, klines: any[], indicators?: string[]) => {
    try {
      const calculator = getRealtimeIndicatorCalculator();
      const result = calculator.calculate(symbol, klines, indicators);
      return { success: true, indicators: result };
    } catch (err: any) {
      log.error('[Indicator:calculate] Error:', err);
      return { success: false, error: err.message };
    }
  });

}

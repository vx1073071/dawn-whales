// ── DAWN WHALES IPC: alert-notification ────────────────────────────────────────────
// 6 handlers

import { ipcMain, BrowserWindow, app, shell } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import { validate } from '../ipc-schemas';

export function registerAlertNotificationIPC(
) {


  // ── Macro Alert (JVS-51) ────────────────────────────────────────────────
  ipcMain.handle('alert:macro', async (_e, currentData: any[], historicalData: any) => {
    try {
      const historicalMap = new Map(Object.entries(historicalData || {}) as [string, number[]][]);
      const result = await detectMacroAnomalies(currentData, historicalMap);
      return { success: true, result };
    } catch (err) {
      log.error('[MacroAlert] Error:', err);
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('alert:macro-multiple', async (_e, indicatorData: any[]) => {
    try {
      const result = await analyzeMultipleIndicators(indicatorData);
      return { success: true, result };
    } catch (err) {
      log.error('[MacroAlertMultiple] Error:', err);
      return { success: false, error: err.message };
    }
  });

  // ── Correlation Alert (JVS-52) ─────────────────────────────────────────


  // ── Correlation Alert (JVS-52) ─────────────────────────────────────────
  ipcMain.handle('alert:correlation', async (_e, snapshots: any[], historicalData: any) => {
    try {
      const histMap = new Map(Object.entries(historicalData || {}) as [string, number[]][]);
      const result = await detectCorrelationAnomalies(snapshots, histMap);
      return { success: true, result };
    } catch (err) {
      log.error('[CorrelationAlert] Error:', err);
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('alert:correlation-matrix', async (_e, matrix: number[][], codes: string[], prevMatrix?: number[][], histMatrices?: any) => {
    try {
      const histMap = histMatrices ? new Map(Object.entries(histMatrices) as [string, number[]][]) : undefined;
      const result = await analyzeCorrelationMatrix(matrix, codes, prevMatrix, histMap);
      return { success: true, result };
    } catch (err) {
      log.error('[CorrelationAlertMatrix] Error:', err);
      return { success: false, error: err.message };
    }
  });

  // ── Walk-Forward Report (JVS-53) ───────────────────────────────────────


  // ── Smart Notification Engine ───────────────────────────────────────
  ipcMain.handle('notification:generate', async (_e, raw: unknown) => {
    const vErr = validate(NotificationGenerateSchema, raw);
    if (vErr) return vErr;
    const ctx = raw as NotificationContext;
    const alerts = generateSmartAlerts(ctx);
    return { success: true, alerts };
  });



  /** @deprecated R83 — migrate to server-side AI Gateway; apiKey param retained for backward compat */
  ipcMain.handle('notification:summary', async (_e, alerts: SmartAlert[], apiKey?: string) => {
    if (!Array.isArray(alerts) || alerts.length === 0) {
      return { success: true, summary: '暂无活跃警报。' };
    }
    // R83: server-side auth — apiKey fallback kept for transition; remove in R84
    const summary = await generateAlertSummary(alerts, apiKey ?? '');
    return { success: true, summary };
  });

  // ── AI Report Generator ──────────────────────────────────────────────

}

// ── DAWN WHALES IPC: alert-notification ────────────────────────────────────────────
// Auto-split from main.ts — 6 handlers
//
// Registered channels:
//   alert:macro
//   alert:macro-multiple
//   alert:correlation
//   alert:correlation-matrix
//   notification:generate
//   notification:summary

import { ipcMain, BrowserWindow } from 'electron';

// Auto-imported dependencies:
import { generateAlertSummary, generateSmartAlerts } from './engine/notification-engine';
import { analyzeMultipleIndicators, detectMacroAnomalies } from './engine/macro-alert';
import { analyzeCorrelationMatrix, detectCorrelationAnomalies } from './engine/correlation-alert';

/**
 * Register all alert-notification IPC handlers
 *
 */
export function registerAlertNotificationIPC(
  
) {

  // ── alert:macro ───────────────────────────────────────────────
  // ── Macro Alert (JVS-51) ────────────────────────────────────────────────
  ipcMain.handle('alert:macro', async (_e, currentData: any[], historicalData: any) => {
    try {
      const historicalMap = new Map(Object.entries(historicalData || {}) as [string, number[]][]);
      const result = await detectMacroAnomalies(currentData, historicalMap);
      return { success: true, result };
    } catch (err: any) {
      log.error('[MacroAlert] Error:', err);
      return { success: false, error: err.message };
    }
  });

  // ── alert:macro-multiple ───────────────────────────────────────────────
  ipcMain.handle('alert:macro-multiple', async (_e, indicatorData: any[]) => {
    try {
      const result = await analyzeMultipleIndicators(indicatorData);
      return { success: true, result };
    } catch (err: any) {
      log.error('[MacroAlertMultiple] Error:', err);
      return { success: false, error: err.message };
    }
  });

  // ── alert:correlation ───────────────────────────────────────────────
  // ── Correlation Alert (JVS-52) ─────────────────────────────────────────
  ipcMain.handle('alert:correlation', async (_e, snapshots: any[], historicalData: any) => {
    try {
      const histMap = new Map(Object.entries(historicalData || {}) as [string, number[]][]);
      const result = await detectCorrelationAnomalies(snapshots, histMap);
      return { success: true, result };
    } catch (err: any) {
      log.error('[CorrelationAlert] Error:', err);
      return { success: false, error: err.message };
    }
  });

  // ── alert:correlation-matrix ───────────────────────────────────────────────
  ipcMain.handle('alert:correlation-matrix', async (_e, matrix: number[][], codes: string[], prevMatrix?: number[][], histMatrices?: any) => {
    try {
      const histMap = histMatrices ? new Map(Object.entries(histMatrices) as [string, number[]][]) : undefined;
      const result = await analyzeCorrelationMatrix(matrix, codes, prevMatrix, histMap);
      return { success: true, result };
    } catch (err: any) {
      log.error('[CorrelationAlertMatrix] Error:', err);
      return { success: false, error: err.message };
    }
  });

  // ── notification:generate ───────────────────────────────────────────────
  // ── Smart Notification Engine ───────────────────────────────────────
  ipcMain.handle('notification:generate', async (_e, raw: unknown) => {
    const vErr = validate(NotificationGenerateSchema, raw);
    if (vErr) return vErr;
    const ctx = raw as NotificationContext;
    const alerts = generateSmartAlerts(ctx);
    return { success: true, alerts };
  });

  // ── notification:summary ───────────────────────────────────────────────
  ipcMain.handle('notification:summary', async (_e, alerts: SmartAlert[], apiKey?: string) => {
    if (!Array.isArray(alerts) || alerts.length === 0) {
      return { success: true, summary: '暂无活跃警报。' };
    }
    const summary = await generateAlertSummary(alerts, apiKey ?? '');
    return { success: true, summary };
  });

}

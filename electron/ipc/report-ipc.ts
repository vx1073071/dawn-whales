// ── DAWN WHALES IPC: report ────────────────────────────────────────────
// 6 handlers

import { ipcMain, BrowserWindow, app, shell } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import { validate } from '../ipc-schemas';

export function registerReportIPC(
) {


  // ── Walk-Forward Report (JVS-53) ───────────────────────────────────────
  ipcMain.handle('report:walk-forward', async (_e, strategyName: string, windows: any[]) => {
    try {
      const result = generateWalkForwardReport(strategyName, windows);
      return { success: true, result };
    } catch (err) {
      log.error('[WalkForwardReport] Error:', err);
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('report:walk-forward-batch', async (_e, strategies: any[]) => {
    try {
      const result = await generateBatchWalkForwardReport(strategies);
      return { success: true, result };
    } catch (err) {
      log.error('[WalkForwardReportBatch] Error:', err);
      return { success: false, error: err.message };
    }
  });

  // ── Brinson Attribution (JVS-54) ───────────────────────────────────────


  // ── Brinson Attribution (JVS-54) ───────────────────────────────────────
  ipcMain.handle('report:brinson-attribution', async (_e, holdings: any[], benchmark: any[], benchmarkReturn: number) => {
    try {
      const result = generateBrinsonReport(holdings, benchmark, benchmarkReturn);
      return { success: true, result };
    } catch (err) {
      log.error('[BrinsonAttribution] Error:', err);
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('report:brinson-batch', async (_e, portfolios: any[]) => {
    try {
      const result = await generateBatchBrinsonReport(portfolios);
      return { success: true, result };
    } catch (err) {
      log.error('[BrinsonAttributionBatch] Error:', err);
      return { success: false, error: err.message };
    }
  });

  // ── Options Chain Analyzer (JVS-55) ─────────────────────────────────


  // ── AI Report Generator ──────────────────────────────────────────────
  ipcMain.handle('report:generate', async (_e, raw: unknown) => {
    const vErr = validate(ReportGenerateSchema, raw);
    if (vErr) return vErr;
    const { results, symbol, apiKey, timeoutMs } = raw as {
      results: any[];
      symbol?: string;\1/** @deprecated R83 — use server-side AI Gateway token */
\1\2
      timeoutMs?: number;
    };
    const report = await generateBacktestReport(results, symbol, apiKey, timeoutMs ?? 20000);
    return { success: true, report };
  });



  ipcMain.handle('report:quick', async (_e, raw: unknown) => {
    const vErr = validate(ReportQuickSchema, raw);
    if (vErr) return vErr;
    /** @deprecated R83 — use server-side AI Gateway token */
    const { result, apiKey } = raw as { result: any; apiKey?: string };
    const report = await generateQuickReport(result, apiKey);
    return { success: true, report };
  });

  // ── Auto-Tuner ──────────────────────────────────────────────────────

}

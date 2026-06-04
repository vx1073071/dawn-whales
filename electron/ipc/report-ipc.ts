// ── DAWN WHALES IPC: report ────────────────────────────────────────────
// Auto-split from main.ts — 6 handlers
//
// Registered channels:
//   report:walk-forward
//   report:walk-forward-batch
//   report:brinson-attribution
//   report:brinson-batch
//   report:generate
//   report:quick

import { ipcMain, BrowserWindow } from 'electron';

// Auto-imported dependencies:
import { generateBacktestReport, generateQuickReport } from './engine/ai-report-generator';
import { generateBatchWalkForwardReport, generateWalkForwardReport } from './engine/walk-forward-report';
import { generateBatchBrinsonReport, generateBrinsonReport } from './engine/brinson-attribution';

/**
 * Register all report IPC handlers
 *
 */
export function registerReportIPC(
  
) {

  // ── report:walk-forward ───────────────────────────────────────────────
  // ── Walk-Forward Report (JVS-53) ───────────────────────────────────────
  ipcMain.handle('report:walk-forward', async (_e, strategyName: string, windows: any[]) => {
    try {
      const result = generateWalkForwardReport(strategyName, windows);
      return { success: true, result };
    } catch (err: any) {
      log.error('[WalkForwardReport] Error:', err);
      return { success: false, error: err.message };
    }
  });

  // ── report:walk-forward-batch ───────────────────────────────────────────────
  ipcMain.handle('report:walk-forward-batch', async (_e, strategies: any[]) => {
    try {
      const result = await generateBatchWalkForwardReport(strategies);
      return { success: true, result };
    } catch (err: any) {
      log.error('[WalkForwardReportBatch] Error:', err);
      return { success: false, error: err.message };
    }
  });

  // ── report:brinson-attribution ───────────────────────────────────────────────
  // ── Brinson Attribution (JVS-54) ───────────────────────────────────────
  ipcMain.handle('report:brinson-attribution', async (_e, holdings: any[], benchmark: any[], benchmarkReturn: number) => {
    try {
      const result = generateBrinsonReport(holdings, benchmark, benchmarkReturn);
      return { success: true, result };
    } catch (err: any) {
      log.error('[BrinsonAttribution] Error:', err);
      return { success: false, error: err.message };
    }
  });

  // ── report:brinson-batch ───────────────────────────────────────────────
  ipcMain.handle('report:brinson-batch', async (_e, portfolios: any[]) => {
    try {
      const result = await generateBatchBrinsonReport(portfolios);
      return { success: true, result };
    } catch (err: any) {
      log.error('[BrinsonAttributionBatch] Error:', err);
      return { success: false, error: err.message };
    }
  });

  // ── report:generate ───────────────────────────────────────────────
  // ── AI Report Generator ──────────────────────────────────────────────
  ipcMain.handle('report:generate', async (_e, raw: unknown) => {
    const vErr = validate(ReportGenerateSchema, raw);
    if (vErr) return vErr;
    const { results, symbol, apiKey, timeoutMs } = raw as {
      results: any[];
      symbol?: string;
      apiKey?: string;
      timeoutMs?: number;
    };
    const report = await generateBacktestReport(results, symbol, apiKey, timeoutMs ?? 20000);
    return { success: true, report };
  });

  // ── report:quick ───────────────────────────────────────────────
  ipcMain.handle('report:quick', async (_e, raw: unknown) => {
    const vErr = validate(ReportQuickSchema, raw);
    if (vErr) return vErr;
    const { result, apiKey } = raw as { result: any; apiKey?: string };
    const report = await generateQuickReport(result, apiKey);
    return { success: true, report };
  });

}

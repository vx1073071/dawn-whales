// QUANT MOO R120 QTE-42 — Differential Push IPC Bridge
// 将 differential-push 引擎通过 IPC 暴露给 renderer
// 目标: IPC带宽省60%+

import { ipcMain } from 'electron';
import { DifferentialPushEngine } from '../workers/differential-push-worker';

// ═══════ Worker (runs in main process via setImmediate) ═══════

// Note: DifferentialPushEngine lives in src/lib/chart/differential-push.ts
// We create an in-process worker bridge since it's a chart lib module
// In future rounds, migrate to Web Worker for true off-main-thread

const engines = new Map<string, any>(); // brokerId → engine instance

function getEngine(brokerId: string): any {
  if (!engines.has(brokerId)) {
    // Lazy require to avoid circular deps
    const { DifferentialPushEngine: DPE } = require('../../src/lib/chart/differential-push');
    engines.set(brokerId, new DPE());
  }
  return engines.get(brokerId)!;
}

export function registerDifferentialPushIPC(): void {
  // Compare current quote snapshot with previous → return diff
  ipcMain.handle('diff:compare', async (_event, args: {
    brokerId: string;
    symbol: string;
    current: Record<string, any>;
    previous?: Record<string, any>;
  }) => {
    const engine = getEngine(args.brokerId);
    return engine.compare(args.symbol, args.current, args.previous || {});
  });

  // Get diff stats for a broker
  ipcMain.handle('diff:stats', async (_event, args: { brokerId: string }) => {
    const engine = getEngine(args.brokerId);
    return engine.getStats();
  });

  // Reset diff tracking for a broker
  ipcMain.handle('diff:reset', async (_event, args: { brokerId: string }) => {
    const engine = getEngine(args.brokerId);
    engine.reset();
    return { success: true };
  });

  // Get savings report
  ipcMain.handle('diff:savings', async (_event, args: { brokerId: string }) => {
    const engine = getEngine(args.brokerId);
    const stats = engine.getStats();
    const totalFields = stats.totalPushes * 10; // rough estimate
    const saved = stats.totalSavingsBytes || 0;
    return {
      brokerId: args.brokerId,
      totalPushes: stats.totalPushes,
      fullPushes: stats.fullPushes,
      diffPushes: stats.totalPushes - stats.fullPushes,
      savingsPct: stats.totalPushes > 0
        ? ((stats.totalPushes - stats.fullPushes) / stats.totalPushes * 100).toFixed(1)
        : '0',
      estimatedBandwidthSaved: `${((saved / (totalFields || 1)) * 100).toFixed(0)}%`,
    };
  });
}

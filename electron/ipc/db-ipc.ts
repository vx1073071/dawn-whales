// ── DAWN WHALES IPC: db ────────────────────────────────────────────
// Auto-split from main.ts — 9 handlers
//
// Registered channels:
//   db:getStrategies
//   db:saveStrategy
//   db:getSettings
//   db:saveSettings
//   db:getTrades
//   db:getBacktestResults
//   db:getWatchlist
//   db:saveWatchlist
//   db:getSignals

import { ipcMain, BrowserWindow } from 'electron';

/**
 * Register all db IPC handlers
 *
 * @param db - service reference
 */
export function registerDbIPC(
  db: any
) {

  // ── db:getStrategies ───────────────────────────────────────────────
  // ── Database ────────────────────────────────────────────────────────
  ipcMain.handle('db:getStrategies', async () => {
    return db?.getStrategies() || [];
  });

  // ── db:saveStrategy ───────────────────────────────────────────────
  ipcMain.handle('db:saveStrategy', async (_e, strategy: any) => {
    db?.saveStrategy(strategy);
    return { success: true };
  });

  // ── db:getSettings ───────────────────────────────────────────────
  ipcMain.handle('db:getSettings', async () => {
    return db?.getSettings() || {};
  });

  // ── db:saveSettings ───────────────────────────────────────────────
  ipcMain.handle('db:saveSettings', async (_e, settings: any) => {
    db?.saveSettings(settings);
    return { success: true };
  });

  // ── db:getTrades ───────────────────────────────────────────────
  ipcMain.handle('db:getTrades', async (_e, strategyId?: string) => {
    return db?.getTrades(strategyId) || [];
  });

  // ── db:getBacktestResults ───────────────────────────────────────────────
  ipcMain.handle('db:getBacktestResults', async (_e, strategyId: string) => {
    return db?.getBacktestResults(strategyId) || [];
  });

  // ── db:getWatchlist ───────────────────────────────────────────────
  ipcMain.handle('db:getWatchlist', async () => {
    return db?.getWatchlist() || [];
  });

  // ── db:saveWatchlist ───────────────────────────────────────────────
  ipcMain.handle('db:saveWatchlist', async (_e, codes: string[]) => {
    db?.saveWatchlist(codes);
    return { success: true };
  });

  // ── db:getSignals ───────────────────────────────────────────────
  ipcMain.handle('db:getSignals', async (_e, strategyId?: string) => {
    return db?.getSignals(strategyId) || [];
  });

}

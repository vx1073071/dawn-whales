// ── DAWN WHALES IPC: db ────────────────────────────────────────────
// 9 handlers

import { ipcMain, BrowserWindow, app, shell } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import { validate } from '../ipc-schemas';

export function registerDbIPC(
  db: unknown) {


  // ── Database ────────────────────────────────────────────────────────
  ipcMain.handle('db:getStrategies', async () => {
    return db?.getStrategies() || [];
  });



  ipcMain.handle('db:saveStrategy', async (_e, strategy: unknown) => {
    db?.saveStrategy(strategy);
    return { success: true };
  });



  ipcMain.handle('db:getSettings', async () => {
    return db?.getSettings() || {};
  });



  ipcMain.handle('db:saveSettings', async (_e, settings: unknown) => {
    db?.saveSettings(settings);
    return { success: true };
  });



  ipcMain.handle('db:getTrades', async (_e, strategyId?: string) => {
    return db?.getTrades(strategyId) || [];
  });



  ipcMain.handle('db:getBacktestResults', async (_e, strategyId: string) => {
    return db?.getBacktestResults(strategyId) || [];
  });



  ipcMain.handle('db:getWatchlist', async () => {
    return db?.getWatchlist() || [];
  });



  ipcMain.handle('db:saveWatchlist', async (_e, codes: string[]) => {
    db?.saveWatchlist(codes);
    return { success: true };
  });



  ipcMain.handle('db:getSignals', async (_e, strategyId?: string) => {
    return db?.getSignals(strategyId) || [];
  });

  // ── App ─────────────────────────────────────────────────────────────

}

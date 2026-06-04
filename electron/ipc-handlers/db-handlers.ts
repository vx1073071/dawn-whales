// ── IPC Handlers — Database ─────────────────────────────────────────────────
// db:* 相关的 IPC handlers
// 从 main.ts 拆分出来，9个 handlers

import { ipcMain } from 'electron';
import { shared } from './_import-shared';
import { validate, DbSaveStrategySchema, DbSaveSettingsSchema, DbSaveWatchlistSchema, 
         DbGetTradesSchema, DbGetBacktestResultsSchema, DbGetSignalsSchema } from '../ipc-schemas';

export function registerDbHandlers() {
  ipcMain.handle('db:getStrategies', async () => {
    return shared.db?.getStrategies() || [];
  });

  ipcMain.handle('db:saveStrategy', async (_e, strategy: any) => {
    const vErr = validate(DbSaveStrategySchema, { strategy });
    if (vErr) return vErr;
    shared.db?.saveStrategy(strategy);
    return { success: true };
  });

  ipcMain.handle('db:getSettings', async () => {
    return shared.db?.getSettings() || {};
  });

  ipcMain.handle('db:saveSettings', async (_e, settings: any) => {
    const vErr = validate(DbSaveSettingsSchema, { settings });
    if (vErr) return vErr;
    shared.db?.saveSettings(settings);
    return { success: true };
  });

  ipcMain.handle('db:getTrades', async (_e, strategyId?: string) => {
    const vErr = validate(DbGetTradesSchema, { strategyId });
    if (vErr) return vErr;
    return shared.db?.getTrades(strategyId) || [];
  });

  ipcMain.handle('db:getBacktestResults', async (_e, strategyId: string) => {
    const vErr = validate(DbGetBacktestResultsSchema, { strategyId });
    if (vErr) return vErr;
    return shared.db?.getBacktestResults(strategyId) || [];
  });

  ipcMain.handle('db:getWatchlist', async () => {
    return shared.db?.getWatchlist() || [];
  });

  ipcMain.handle('db:saveWatchlist', async (_e, codes: string[]) => {
    const vErr = validate(DbSaveWatchlistSchema, { codes });
    if (vErr) return vErr;
    shared.db?.saveWatchlist(codes);
    return { success: true };
  });

  ipcMain.handle('db:getSignals', async (_e, strategyId?: string) => {
    const vErr = validate(DbGetSignalsSchema, { strategyId });
    if (vErr) return vErr;
    return shared.db?.getSignals(strategyId) || [];
  });
}

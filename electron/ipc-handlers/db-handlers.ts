// -- IPC Handlers: db (9 handlers) --

import { ipcMain } from 'electron';
import { shared } from './_import-shared';

export function registerDbHandlers() {

  ipcMain.handle('db:getStrategies', async () => {
      return shared.db?.getStrategies() || [];
    });


  ipcMain.handle('db:saveStrategy', async (_e, strategy: any) => {
      shared.db?.saveStrategy(strategy);
      return { success: true };
    });


  ipcMain.handle('db:getSettings', async () => {
      return shared.db?.getSettings() || {};
    });


  ipcMain.handle('db:saveSettings', async (_e, settings: any) => {
      shared.db?.saveSettings(settings);
      return { success: true };
    });


  ipcMain.handle('db:getTrades', async (_e, strategyId?: string) => {
      return shared.db?.getTrades(strategyId) || [];
    });


  ipcMain.handle('db:getBacktestResults', async (_e, strategyId: string) => {
      return shared.db?.getBacktestResults(strategyId) || [];
    });


  ipcMain.handle('db:getWatchlist', async () => {
      return shared.db?.getWatchlist() || [];
    });


  ipcMain.handle('db:saveWatchlist', async (_e, codes: string[]) => {
      shared.db?.saveWatchlist(codes);
      return { success: true };
    });


  ipcMain.handle('db:getSignals', async (_e, strategyId?: string) => {
      return shared.db?.getSignals(strategyId) || [];
    });

}

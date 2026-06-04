// -- IPC Handlers: data (13 handlers) --

import { ipcMain } from 'electron';
import { shared } from './_import-shared';
import log from 'electron-log';

export function registerDataHandlers() {

  ipcMain.handle('data:fundamental', async (_e, symbol: string) => {
      if (!shared.dataProvider) return { success: false, error: 'DataProvider not initialized' };
      try {
        const data = await shared.dataProvider.getFundamental(symbol);
        return { success: true, data };
      } catch (err: any) {
        log.error('[DataProvider] Fundamental fetch failed:', err.message);
        return { success: false, error: err.message };
      }
    });


  ipcMain.handle('data:capital-flow', async (_e, symbol: string) => {
      if (!shared.dataProvider) return { success: false, error: 'DataProvider not initialized' };
      try {
        const data = await shared.dataProvider.getCapitalFlow(symbol);
        return { success: true, data };
      } catch (err: any) {
        log.error('[DataProvider] Capital flow fetch failed:', err.message);
        return { success: false, error: err.message };
      }
    });


  ipcMain.handle('data:regime', async () => {
      if (!shared.dataProvider) return { success: false, error: 'DataProvider not initialized' };
      try {
        const regime = await shared.dataProvider.getMarketRegime();
        return { success: true, regime };
      } catch (err: any) {
        log.error('[DataProvider] Regime fetch failed:', err.message);
        return { success: false, error: err.message };
      }
    });


  ipcMain.handle('data:anomalies', async (_e, symbol: string) => {
      if (!shared.dataProvider) return { success: false, error: 'DataProvider not initialized' };
      try {
        const signals = await shared.dataProvider.getAnomalies(symbol);
        return { success: true, signals };
      } catch (err: any) {
        log.error('[DataProvider] Anomalies fetch failed:', err.message);
        return { success: false, error: err.message };
      }
    });


  ipcMain.handle('data:news', async (_e, symbol: string, limit?: number) => {
      if (!shared.dataProvider) return { success: false, error: 'DataProvider not initialized' };
      try {
        const items = await shared.dataProvider.getNews(symbol, limit);
        return { success: true, items };
      } catch (err: any) {
        log.error('[DataProvider] News fetch failed:', err.message);
        return { success: false, error: err.message };
      }
    });


  ipcMain.handle('data:composite-score', async (_e, symbol: string) => {
      if (!shared.dataProvider) return { success: false, error: 'DataProvider not initialized' };
      try {
        const result = await shared.dataProvider.getCompositeScore(symbol);
        return { success: true, result };
      } catch (err: any) {
        log.error('[DataProvider] Composite score failed:', err.message);
        return { success: false, error: err.message };
      }
    });


  ipcMain.handle('data:save-fundamental', async (_e, data: any) => {
      if (!shared.dataProvider) return { success: false, error: 'DataProvider not initialized' };
      try {
        shared.dataProvider.saveFundamental(data);
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    });


  ipcMain.handle('data:save-capital-flow', async (_e, data: any) => {
      if (!shared.dataProvider) return { success: false, error: 'DataProvider not initialized' };
      try {
        shared.dataProvider.saveCapitalFlow(data);
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    });


  ipcMain.handle('data:save-regime', async (_e, regime: any) => {
      if (!shared.dataProvider) return { success: false, error: 'DataProvider not initialized' };
      try {
        shared.dataProvider.saveMarketRegime(regime);
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    });


  ipcMain.handle('data:compute-regime', async (_e, factors: any) => {
      if (!shared.dataProvider) return { success: false, error: 'DataProvider not initialized' };
      try {
        const regime = shared.dataProvider.computeRegime(factors);
        return { success: true, regime };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    });


  ipcMain.handle('data:save-anomaly', async (_e, signal: any) => {
      if (!shared.dataProvider) return { success: false, error: 'DataProvider not initialized' };
      try {
        shared.dataProvider.saveAnomaly(signal);
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    });


  ipcMain.handle('data:save-news', async (_e, symbol: string, items: any[]) => {
      if (!shared.dataProvider) return { success: false, error: 'DataProvider not initialized' };
      try {
        shared.dataProvider.saveNews(symbol, items);
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    });


  ipcMain.handle('data:clear-cache', async () => {
      if (!shared.dataProvider) return { success: false, error: 'DataProvider not initialized' };
      try {
        shared.dataProvider.clearExpiredCache();
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    });

}

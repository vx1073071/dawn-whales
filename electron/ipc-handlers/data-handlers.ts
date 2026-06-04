// ── IPC Handlers — Data Provider ────────────────────────────────────────────
// data:* 相关的 IPC handlers
// 从 main.ts 拆分出来，约12个 handlers

import { ipcMain } from 'electron';
import { shared } from './_import-shared';
import { validate, DataFundamentalSchema, DataCapitalFlowSchema, DataAnomaliesSchema, 
         DataNewsSchema, DataCompositeScoreSchema, DataSaveFundamentalSchema,
         DataSaveCapitalFlowSchema, DataSaveRegimeSchema, DataSaveAnomalySchema,
         DataSaveNewsSchema, DataComputeRegimeSchema } from '../ipc-schemas';
import log from 'electron-log';

export function registerDataHandlers() {
  // ── Data Provider (multi-source integration) ───────────────────────────
  ipcMain.handle('data:fundamental', async (_e, symbol: string) => {
    const vErr = validate(DataFundamentalSchema, { symbol });
    if (vErr) return vErr;
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
    const vErr = validate(DataCapitalFlowSchema, { symbol });
    if (vErr) return vErr;
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
    const vErr = validate(DataAnomaliesSchema, { symbol });
    if (vErr) return vErr;
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
    const vErr = validate(DataNewsSchema, { symbol, limit });
    if (vErr) return vErr;
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
    const vErr = validate(DataCompositeScoreSchema, { symbol });
    if (vErr) return vErr;
    if (!shared.dataProvider) return { success: false, error: 'DataProvider not initialized' };
    try {
      const result = await shared.dataProvider.getCompositeScore(symbol);
      return { success: true, result };
    } catch (err: any) {
      log.error('[DataProvider] Composite score failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  // ── Save operations ─────────────────────────────────────────────────────
  ipcMain.handle('data:save-fundamental', async (_e, data: any) => {
    const vErr = validate(DataSaveFundamentalSchema, { data });
    if (vErr) return vErr;
    if (!shared.dataProvider) return { success: false, error: 'DataProvider not initialized' };
    try {
      shared.dataProvider.saveFundamental(data);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('data:save-capital-flow', async (_e, data: any) => {
    const vErr = validate(DataSaveCapitalFlowSchema, { data });
    if (vErr) return vErr;
    if (!shared.dataProvider) return { success: false, error: 'DataProvider not initialized' };
    try {
      shared.dataProvider.saveCapitalFlow(data);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('data:save-regime', async (_e, regime: any) => {
    const vErr = validate(DataSaveRegimeSchema, { regime });
    if (vErr) return vErr;
    if (!shared.dataProvider) return { success: false, error: 'DataProvider not initialized' };
    try {
      shared.dataProvider.saveMarketRegime(regime);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('data:compute-regime', async (_e, factors: any) => {
    const vErr = validate(DataComputeRegimeSchema, { factors });
    if (vErr) return vErr;
    if (!shared.dataProvider) return { success: false, error: 'DataProvider not initialized' };
    try {
      const regime = shared.dataProvider.computeRegime(factors);
      return { success: true, regime };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('data:save-anomaly', async (_e, signal: any) => {
    const vErr = validate(DataSaveAnomalySchema, { signal });
    if (vErr) return vErr;
    if (!shared.dataProvider) return { success: false, error: 'DataProvider not initialized' };
    try {
      shared.dataProvider.saveAnomaly(signal);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('data:save-news', async (_e, symbol: string, items: any[]) => {
    const vErr = validate(DataSaveNewsSchema, { symbol, items });
    if (vErr) return vErr;
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

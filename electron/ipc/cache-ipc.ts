// ?? DAWN WHALES IPC: cache ????????????????????????????????????????????
// Auto-split from main.ts ? 11 handlers

import { ipcMain, BrowserWindow, app, shell } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from '../../node_modules/electron-log';
import { validate, 
  BrokerConnectSchema, BrokerGetFundsSchema, BrokerGetPositionsSchema,
  BrokerGetQuotesSchema, BrokerSubscribeSchema, BrokerGetKlinesSchema,
  BrokerPlaceOrderSchema, BrokerCancelOrderSchema,
  BrokerSwitchSchema, BrokerAddSchema,
  StrategyCreateSchema, StrategyUpdateSchema, StrategyGetSchema,
  StrategyBacktestSchema, BacktestMultiPeriodSchema,
  BacktestParamSweepSchema, BacktestRiskMetricsSchema,
  BacktestWalkForwardSchema, BacktestParamScanSchema,
  BacktestMultiTimeframeSchema,
  RiskUpdateConfigSchema, RiskUpdateVixSchema,
  DbSaveStrategySchema, DbSaveSettingsSchema, DbSaveWatchlistSchema,
  DbGetTradesSchema, DbGetBacktestResultsSchema, DbGetSignalsSchema,
  DbSaveFundamentalSchema, DbSaveCapitalFlowSchema,
  DbSaveRegimeSchema, DbSaveAnomalySchema, DbSaveNewsSchema,
  DataComputeRegimeSchema,
  MarketplaceRateSchema, MarketplaceCommentSchema,
  MarketplaceSavePerformanceSchema, MarketplaceListSchema,
  GreeksCalculateSchema, GreeksPortfolioSchema,
  DataNewsSchema, DataFundamentalSchema,
  DataCapitalFlowSchema, DataAnomaliesSchema,
  DataCompositeScoreSchema,
  NlParseSchema, StrategyExplainSchema,
  StrategyCompareSchema, StrategyOptimizeSchema,
  StrategyCorrelationSchema,
  NotificationGenerateSchema,
  ReportGenerateSchema, ReportQuickSchema,
  StrategyAutoTuneSchema,
} from '../ipc-schemas';

// Auto-imported dependencies:
import { exploreCache, getCacheEntryDetail, getCacheKeys } from '../engine/cache-explorer';
import { getSmartCacheManager } from '../engine/smart-cache';

export function registerCacheIPC(
  _services: any
) {

  // ── Cache Explorer API (JVS-35) ───────────────────────────────────────
  ipcMain.handle('cache:explore', async () => {
    try {
      const result = exploreCache();
      return { success: true, result };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('cache:entry-detail', async (_e, namespace: string, key: string) => {
    try {
      const detail = getCacheEntryDetail(namespace, key);
      return { success: true, detail };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('cache:keys-paginated', async (_e, namespace: string, limit?: number, offset?: number) => {
    try {
      const result = getCacheKeys(namespace, limit || 100, offset || 0);
      return { success: true, result };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── Smart Cache Manager (JVS-32) ──────────────────────────────────────
  ipcMain.handle('cache:get', async (_e, namespace: string, key: string) => {
    try {
      const manager = getSmartCacheManager();
      const cache = manager.getCache(namespace);
      const value = cache.get(key);
      return { success: true, value, hit: value !== undefined };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('cache:set', async (_e, namespace: string, key: string, value: any, ttl?: number) => {
    try {
      const manager = getSmartCacheManager();
      const cache = manager.getCache(namespace);
      cache.set(key, value, ttl);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('cache:has', async (_e, namespace: string, key: string) => {
    try {
      const manager = getSmartCacheManager();
      const cache = manager.getCache(namespace);
      return { success: true, exists: cache.has(key) };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('cache:delete', async (_e, namespace: string, key: string) => {
    try {
      const manager = getSmartCacheManager();
      const cache = manager.getCache(namespace);
      return { success: true, deleted: cache.delete(key) };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('cache:clear', async (_e, namespace?: string) => {
    try {
      const manager = getSmartCacheManager();
      if (namespace) {
        manager.clearNamespace(namespace);
      } else {
        manager.clearAll();
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('cache:stats', async (_e, namespace?: string) => {
    try {
      const manager = getSmartCacheManager();
      if (namespace) {
        const cache = manager.getCache(namespace);
        return { success: true, stats: cache.getStats() };
      } else {
        return { success: true, stats: manager.getAllStats() };
      }
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('cache:reset-stats', async (_e, namespace?: string) => {
    try {
      const manager = getSmartCacheManager();
      if (namespace) {
        const cache = manager.getCache(namespace);
        cache.resetStats();
      } else {
        manager.resetAllStats();
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('cache:keys', async (_e, namespace: string) => {
    try {
      const manager = getSmartCacheManager();
      const cache = manager.getCache(namespace);
      return { success: true, keys: cache.keys() };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

}

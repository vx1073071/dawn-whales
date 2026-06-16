// ── QUANT MOO IPC: data ────────────────────────────────────────────
// 46 handlers

import { ipcMain, BrowserWindow, app, shell } from 'electron';
import { EngineError } from '../engine/core/engine-error';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import { validate } from '../ipc-schemas';

export function registerDataIPC(
  orderRouter: unknown,
  flowPredictor: unknown,
  dataProvider: unknown,
  stockScreener: unknown,
  dataScheduler: unknown,
  mainWindow: unknown) {

  ipcMain.handle('predict:capital-flow', async (_e, params: unknown) => {
    try {
      const result = flowPredictor.predict(params);
      return { success: true, result };
    } catch (err) {
    // [EngineError:DATA] — structured error tracking
      void EngineError; // structured error domain: DATA
      log.error('[FlowPredict] Error:', err);
      return { success: false, error: err.message };
    }
  });

  // ── Smart Order Router (QClaw Q59) ─────────────────────────────────────
  const localOrderRouter = new SmartOrderRouter();


  // ── Valuation Dashboard (JVS-49) ────────────────────────────────────────
  ipcMain.handle('data:valuation-dashboard', async (_e, codes: string[], historyDays?: number) => {
    try {
      const result = await getValuationDashboard(codes, historyDays);
      return { success: true, result };
    } catch (err) {
    // [EngineError:DATA] — structured error tracking
      log.error('[ValuationDashboard] Error:', err);
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('data:valuation-dashboard-batch', async (_e, codes: string[], batchSize?: number, delayMs?: number) => {
    try {
      const result = await getValuationDashboardBatch(codes, batchSize, delayMs);
      return { success: true, result };
    } catch (err) {
    // [EngineError:DATA] — structured error tracking
      log.error('[ValuationDashboardBatch] Error:', err);
      return { success: false, error: err.message };
    }
  });

  // ── Sector Comparison (JVS-50) ──────────────────────────────────────────


  // ── Sector Comparison (JVS-50) ──────────────────────────────────────────
  ipcMain.handle('data:sector-compare', async (_e, stocks: unknown[], financialData: unknown) => {
    try {
      const financialMap = new Map(Object.entries(financialData || {}));
      const result = await compareSectorStocks(stocks, financialMap);
      return { success: true, result };
    } catch (err) {
    // [EngineError:DATA] — structured error tracking
      log.error('[SectorComparison] Error:', err);
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('data:sector-compare-multiple', async (_e, sectors: unknown[], financialData: unknown) => {
    try {
      const financialMap = new Map(Object.entries(financialData || {}));
      const result = await compareMultipleSectors(sectors, financialMap);
      return { success: true, result };
    } catch (err) {
    // [EngineError:DATA] — structured error tracking
      log.error('[SectorComparisonMultiple] Error:', err);
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('data:sector-rank', async (_e, metrics: unknown[], weights?: unknown) => {
    try {
      const result = rankSectorStocks(metrics, weights);
      return { success: true, result };
    } catch (err) {
    // [EngineError:DATA] — structured error tracking
      log.error('[SectorRank] Error:', err);
      return { success: false, error: err.message };
    }
  });

  // ── Macro Alert (JVS-51) ────────────────────────────────────────────────


  // ── Multi-Factor Selector (JVS-56) ─────────────────────────────────────
  ipcMain.handle('factor:score', async (_e, stocks: unknown[], factorWeights?: unknown) => {
    try {
      const result = scoreAndRankStocks(stocks, factorWeights);
      return { success: true, result };
    } catch (err) {
    // [EngineError:DATA] — structured error tracking
      log.error('[MultiFactor] Score error:', err);
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('factor:screen', async (_e, stocks: unknown[], criteria: unknown, factorWeights?: unknown) => {
    try {
      const result = screenStocks(stocks, criteria, factorWeights);
      return { success: true, result };
    } catch (err) {
    // [EngineError:DATA] — structured error tracking
      log.error('[MultiFactor] Screen error:', err);
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('factor:screen-batch', async (_e, batches: unknown[]) => {
    try {
      const result = await batchScreenStocks(batches);
      return { success: true, result };
    } catch (err) {
    // [EngineError:DATA] — structured error tracking
      log.error('[MultiFactor] Batch screen error:', err);
      return { success: false, error: err.message };
    }
  });

  // ── Portfolio Optimizer (JVS-57) ────────────────────────────────────────


  // ── Q8: Market Regime Detector ─────────────────────────────────────────
  ipcMain.handle('regime:detect', async (_e, raw: unknown) => {
    try {
      const { klines, vixLevel, symbol } = raw as {
        klines: { close: number[]; high: number[]; low: number[]; open: number[] };
        vixLevel?: number;
        symbol?: string;
      };
      if (!klines || !klines.close || klines.close.length < 30) {
        return { success: false, error: 'At least 30 klines required for regime detection' };
      }
      const result = detectRegime(klines, { vixLevel });
      return { success: true, regime: result, symbol };
    } catch (err) {
    // [EngineError:DATA] — structured error tracking
      return { success: false, error: err.message };
    }
  });

  // ── Q64: Backtest Stability Checker ──────────────────────────────────


  // ── Q10: Real-time Anomaly Detection ─────────────────────────────────
  ipcMain.handle('anomaly:detect', async (_e, raw: unknown) => {
    try {
      const { values, method, window, threshold } = raw as {
        values: number[];
        method?: 'zscore' | 'iqr' | 'moving';
        window?: number;
        threshold?: number;
      };
      if (!values || values.length < 10) {
        return { success: false, error: 'At least 10 data points required' };
      }
      const result = detectAnomalies({ values, method: method ?? 'zscore', window: window ?? 20, threshold: threshold ?? 3 });
      return { success: true, anomalies: result };
    } catch (err) {
    // [EngineError:DATA] — structured error tracking
      return { success: false, error: err.message };
    }
  });

  // ── Q11: Correlation Visualizer ────────────────────────────────────


  // ── Data Provider (multi-source integration) ───────────────────────────
  ipcMain.handle('data:fundamental', async (_e, symbol: string) => {
    if (!dataProvider) return { success: false, error: 'DataProvider not initialized' };
    try {
      const data = await dataProvider.getFundamental(symbol);
      return { success: true, data };
    } catch (err) {
    // [EngineError:DATA] — structured error tracking
      log.error('[DataProvider] Fundamental fetch failed:', err.message);
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('data:capital-flow', async (_e, symbol: string) => {
    if (!dataProvider) return { success: false, error: 'DataProvider not initialized' };
    try {
      const data = await dataProvider.getCapitalFlow(symbol);
      return { success: true, data };
    } catch (err) {
    // [EngineError:DATA] — structured error tracking
      log.error('[DataProvider] Capital flow fetch failed:', err.message);
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('data:regime', async () => {
    if (!dataProvider) return { success: false, error: 'DataProvider not initialized' };
    try {
      const regime = await dataProvider.getMarketRegime();
      return { success: true, regime };
    } catch (err) {
    // [EngineError:DATA] — structured error tracking
      log.error('[DataProvider] Regime fetch failed:', err.message);
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('data:anomalies', async (_e, symbol: string) => {
    if (!dataProvider) return { success: false, error: 'DataProvider not initialized' };
    try {
      const signals = await dataProvider.getAnomalies(symbol);
      return { success: true, signals };
    } catch (err) {
    // [EngineError:DATA] — structured error tracking
      log.error('[DataProvider] Anomalies fetch failed:', err.message);
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('data:news', async (_e, symbol: string, limit?: number) => {
    if (!dataProvider) return { success: false, error: 'DataProvider not initialized' };
    try {
      const items = await dataProvider.getNews(symbol, limit);
      return { success: true, items };
    } catch (err) {
    // [EngineError:DATA] — structured error tracking
      log.error('[DataProvider] News fetch failed:', err.message);
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('data:composite-score', async (_e, symbol: string) => {
    if (!dataProvider) return { success: false, error: 'DataProvider not initialized' };
    try {
      const result = await dataProvider.getCompositeScore(symbol);
      return { success: true, result };
    } catch (err) {
    // [EngineError:DATA] — structured error tracking
      log.error('[DataProvider] Composite score failed:', err.message);
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('data:save-fundamental', async (_e, data: unknown) => {
    if (!dataProvider) return { success: false, error: 'DataProvider not initialized' };
    try {
      dataProvider.saveFundamental(data);
      return { success: true };
    } catch (err) {
    // [EngineError:DATA] — structured error tracking
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('data:save-capital-flow', async (_e, data: unknown) => {
    if (!dataProvider) return { success: false, error: 'DataProvider not initialized' };
    try {
      dataProvider.saveCapitalFlow(data);
      return { success: true };
    } catch (err) {
    // [EngineError:DATA] — structured error tracking
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('data:save-regime', async (_e, regime: unknown) => {
    if (!dataProvider) return { success: false, error: 'DataProvider not initialized' };
    try {
      dataProvider.saveMarketRegime(regime);
      return { success: true };
    } catch (err) {
    // [EngineError:DATA] — structured error tracking
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('data:compute-regime', async (_e, factors: unknown) => {
    if (!dataProvider) return { success: false, error: 'DataProvider not initialized' };
    try {
      const regime = dataProvider.computeRegime(factors);
      return { success: true, regime };
    } catch (err) {
    // [EngineError:DATA] — structured error tracking
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('data:save-anomaly', async (_e, signal: unknown) => {
    if (!dataProvider) return { success: false, error: 'DataProvider not initialized' };
    try {
      dataProvider.saveAnomaly(signal);
      return { success: true };
    } catch (err) {
    // [EngineError:DATA] — structured error tracking
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('data:save-news', async (_e, symbol: string, items: unknown[]) => {
    if (!dataProvider) return { success: false, error: 'DataProvider not initialized' };
    try {
      dataProvider.saveNews(symbol, items);
      return { success: true };
    } catch (err) {
    // [EngineError:DATA] — structured error tracking
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('data:clear-cache', async () => {
    if (!dataProvider) return { success: false, error: 'DataProvider not initialized' };
    try {
      dataProvider.clearExpiredCache();
      return { success: true };
    } catch (err) {
    // [EngineError:DATA] — structured error tracking
      return { success: false, error: err.message };
    }
  });

  // ── EM Data Provider — Sector Heatmap (JVS-1) ─────────────────────────


  // ── Stock Screener (JVS-4) ─────────────────────────────────────────────
  ipcMain.handle('screener:search', async (_e, request: unknown) => {
    if (!stockScreener) return { success: false, error: 'StockScreener not initialized' };
    try {
      const result = await stockScreener.search(request || { query: '' });
      return { success: true, ...result };
    } catch (err) {
    // [EngineError:DATA] — structured error tracking
      log.error('[StockScreener] Search failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  // ── News Aggregator (JVS-5) ────────────────────────────────────────────


  // ── Data Scheduler (auto-refresh) ─────────────────────────────────────
  ipcMain.handle('data:scheduler-status', async () => {
    if (!dataScheduler) return { success: false, error: 'DataScheduler not initialized' };
    return { success: true, status: dataScheduler.getStatus() };
  });



  ipcMain.handle('data:scheduler-refresh', async (_e, module?: string) => {
    if (!dataScheduler) return { success: false, error: 'DataScheduler not initialized' };
    try {
      if (module) {
        await dataScheduler.refreshNow(module);
      } else {
        await dataScheduler.refreshAll();
      }
      return { success: true };
    } catch (err) {
    // [EngineError:DATA] — structured error tracking
      return { success: false, error: err.message };
    }
  });

  // ── Quote Stream — Real-time Market Data (JVS-9) ─────────────────────


  // ── Data Quality Monitor (JVS-22) ────────────────────────────────────────
  ipcMain.handle('data:quality-check', async () => {
    try {
      const monitor = getDataQualityMonitor();
      const report = await monitor.runHealthCheck();
      return { success: true, report };
    } catch (err) {
    // [EngineError:DATA] — structured error tracking
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('data:quality-report', async () => {
    try {
      const monitor = getDataQualityMonitor();
      const report = monitor.getLastReport();
      return { success: true, report };
    } catch (err) {
    // [EngineError:DATA] — structured error tracking
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('data:quality-acknowledge', async (_e, alertIndex: number) => {
    try {
      const monitor = getDataQualityMonitor();
      monitor.acknowledgeAlert(alertIndex);
      return { success: true };
    } catch (err) {
    // [EngineError:DATA] — structured error tracking
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('data:quality-clear-acknowledged', async () => {
    try {
      const monitor = getDataQualityMonitor();
      monitor.clearAcknowledgedAlerts();
      return { success: true };
    } catch (err) {
    // [EngineError:DATA] — structured error tracking
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('data:quality-start-periodic', async (_e, intervalMs?: number) => {
    try {
      const monitor = getDataQualityMonitor();
      monitor.startPeriodicCheck(intervalMs);
      return { success: true };
    } catch (err) {
    // [EngineError:DATA] — structured error tracking
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('data:quality-stop-periodic', async () => {
    try {
      const monitor = getDataQualityMonitor();
      monitor.stopPeriodicCheck();
      return { success: true };
    } catch (err) {
    // [EngineError:DATA] — structured error tracking
      return { success: false, error: err.message };
    }
  });

  // ── Data Quality Stream Monitor (JVS-31) ─────────────────────────────────


  // ── Data Quality Stream Monitor (JVS-31) ─────────────────────────────────
  ipcMain.handle('data:quality-stream-start', async () => {
    try {
      const monitor = getDataQualityStream();
      monitor.start();
      
      // Forward alerts to renderer
      monitor.on('alert', (alert) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('data:quality-stream-alert', alert);
        }
      });
      
      // Hook into WebSocket stream
      const wsStream = getWsDataStream();
      wsStream.on('tick', (tick) => {
        monitor.validateTick(tick);
      });
      
      return { success: true };
    } catch (err) {
    // [EngineError:DATA] — structured error tracking
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('data:quality-stream-stop', async () => {
    try {
      const monitor = getDataQualityStream();
      monitor.stop();
      return { success: true };
    } catch (err) {
    // [EngineError:DATA] — structured error tracking
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('data:quality-stream-status', async () => {
    try {
      const monitor = getDataQualityStream();
      const status = monitor.getStatus();
      // Convert Map to object for IPC serialization
      const symbolStats = Object.fromEntries(status.symbolStats);
      return { success: true, status: { ...status, symbolStats } };
    } catch (err) {
    // [EngineError:DATA] — structured error tracking
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('data:quality-stream-clear-alerts', async () => {
    try {
      const monitor = getDataQualityStream();
      monitor.clearAlerts();
      return { success: true };
    } catch (err) {
    // [EngineError:DATA] — structured error tracking
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('data:quality-stream-reset-metrics', async () => {
    try {
      const monitor = getDataQualityStream();
      monitor.resetMetrics();
      return { success: true };
    } catch (err) {
    // [EngineError:DATA] — structured error tracking
      return { success: false, error: err.message };
    }
  });

  // ── Realtime Sentiment Stream (JVS-33) ─────────────────────────────────


  // ── Data Quality Dashboard Aggregator (JVS-34) ────────────────────────
  ipcMain.handle('data:quality-dashboard', async () => {
    try {
      const dashboard = await getDataQualityDashboard();
      return { success: true, dashboard };
    } catch (err) {
    // [EngineError:DATA] — structured error tracking
      return { success: false, error: err.message };
    }
  });

  // ── Cache Explorer API (JVS-35) ───────────────────────────────────────


  // ── Data Export Service (JVS-37) ──────────────────────────────────────
  ipcMain.handle('data:export', async (_e, request: unknown) => {
    try {
      const result = await exportData(request);
      return result;
    } catch (err) {
    // [EngineError:DATA] — structured error tracking
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('data:export-modules', async () => {
    try {
      const modules = getAvailableModules();
      return { success: true, modules };
    } catch (err) {
    // [EngineError:DATA] — structured error tracking
      return { success: false, error: err.message };
    }
  });

  // ── Rate Limiter (JVS-38) ─────────────────────────────────────────────


  // ── Rate Limiter (JVS-38) ─────────────────────────────────────────────
  ipcMain.handle('rate-limiter:stats', async (_e, apiName?: string) => {
    try {
      const manager = getRateLimiterManager();
      const stats = manager.getStats(apiName);
      return { success: true, stats };
    } catch (err) {
    // [EngineError:DATA] — structured error tracking
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('rate-limiter:reset', async () => {
    try {
      const manager = getRateLimiterManager();
      manager.resetAll();
      return { success: true };
    } catch (err) {
    // [EngineError:DATA] — structured error tracking
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('rate-limiter:apis', async () => {
    try {
      const manager = getRateLimiterManager();
      const apis = manager.getAvailableAPIs();
      return { success: true, apis };
    } catch (err) {
    // [EngineError:DATA] — structured error tracking
      return { success: false, error: err.message };
    }
  });

  // ── Data Consistency Checker (JVS-39) ─────────────────────────────────


  // ── Data Consistency Checker (JVS-39) ─────────────────────────────────
  ipcMain.handle('data:consistency-check', async () => {
    try {
      const report = await runConsistencyCheck();
      return { success: true, report };
    } catch (err) {
    // [EngineError:DATA] — structured error tracking
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('data:consistency-rules', async () => {
    try {
      const rules = getConsistencyRules();
      return { success: true, rules };
    } catch (err) {
    // [EngineError:DATA] — structured error tracking
      return { success: false, error: err.message };
    }
  });

  // ── Smart Cache Manager (JVS-32) ──────────────────────────────────────

}

// ── DAWN WHALES IPC: em ────────────────────────────────────────────
// 67 handlers

import { ipcMain, BrowserWindow, app, shell } from 'electron';
import { EngineError } from '../engine/core/engine-error';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import { validate } from '../ipc-schemas';

export function registerEmIPC(
  sentimentAttrEngine: unknown,
  emDataProvider: unknown,
  macroDataProvider: unknown,
  newsAggregator: unknown,
  sectorRotation: unknown,
  stockAnomalyDetector: unknown,
  marketHotspot: unknown,
  mainWindow: unknown) {


  // ── Financial Reports (JVS-41) ─────────────────────────────────────────
  ipcMain.handle('em:get-financials', async (_e, code: string, quarters?: number) => {
    try {
      return await getFinancialReports(code, quarters);
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      void EngineError; // structured error domain: SYSTEM
      log.error('[FinancialReports] Error:', err);
      return { success: false, error: err.message };
    }
  });

  // ── Valuation Data (JVS-42) ────────────────────────────────────────────


  // ── Valuation Data (JVS-42) ────────────────────────────────────────────
  ipcMain.handle('em:get-valuation', async (_e, code: string, historyDays?: number) => {
    try {
      return await getValuationData(code, historyDays);
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      log.error('[ValuationData] Error:', err);
      return { success: false, error: err.message };
    }
  });

  // ── Technical Indicators (JVS-43) ──────────────────────────────────────


  // ── Options Pricing Engine (JVS-44) ────────────────────────────────────
  ipcMain.handle('em:price-option', async (_e, params: unknown) => {
    try {
      return { success: true, ...blackScholesPrice(params) };
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      log.error('[OptionsPricing] Price error:', err);
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('em:calc-greeks', async (_e, params: unknown) => {
    try {
      return { success: true, ...calculateGreeks(params) };
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      log.error('[OptionsPricing] Greeks error:', err);
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('em:implied-vol', async (_e, marketPrice: number, S: number, K: number, T: number, r: number, optionType: string, q?: number) => {
    try {
      return { success: true, ...impliedVolatility(marketPrice, S, K, T, r, optionType as unknown, q) };
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      log.error('[OptionsPricing] IV error:', err);
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('em:vol-surface', async (_e, S: number, r: number, strikes: number[], expiries: number[], callPrices: number[][], putPrices?: number[][]) => {
    try {
      const surface = buildVolSurface(S, r, strikes, expiries, callPrices, putPrices);
      return { success: true, surface };
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      log.error('[OptionsPricing] Surface error:', err);
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('em:price-and-greeks', async (_e, params: unknown) => {
    try {
      return { success: true, ...priceAndGreeks(params) };
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      log.error('[OptionsPricing] Price+Greeks error:', err);
      return { success: false, error: err.message };
    }
  });

  // ── Risk Metrics Calculator (JVS-46) ───────────────────────────────────


  // ── Risk Metrics Calculator (JVS-46) ───────────────────────────────────
  ipcMain.handle('em:calc-risk-metrics', async (_e, params: unknown) => {
    try {
      const result = calculateRiskMetrics(params);
      return { success: true, metrics: result };
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      log.error('[RiskMetrics] Error:', err);
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('em:calc-sharpe', async (_e, returns: number[], riskFreeRate?: number, tradingDays?: number) => {
    try {
      return { success: true, sharpe: calcSharpeRatio(returns, riskFreeRate, tradingDays) };
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('em:calc-max-drawdown', async (_e, returns: number[]) => {
    try {
      return { success: true, maxDrawdown: calcMaxDrawdown(returns) };
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('em:calc-var', async (_e, returns: number[], confidence?: number) => {
    try {
      return { success: true, var: calcVaR(returns, confidence) };
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      return { success: false, error: err.message };
    }
  });

  // ── Performance Attribution (JVS-45) ─────────────────────────────────


  // ── Performance Attribution (JVS-45) ─────────────────────────────────
  ipcMain.handle('em:portfolio-attribution', async (_e, params: unknown) => {
    try {
      const result = brinsonAttribution(params);
      return { success: true, result };
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      log.error('[Attribution] Error:', err);
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('em:time-series-attribution', async (_e, params: unknown) => {
    try {
      const result = timeSeriesAttribution(params);
      return { success: true, result };
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      log.error('[Attribution] TimeSeries Error:', err);
      return { success: false, error: err.message };
    }
  });

  // ── Correlation Matrix v2 (JVS-47) ──────────────────────────────────────


  // ── Correlation Matrix v2 (JVS-47) ──────────────────────────────────────
  ipcMain.handle('em:correlation-matrix', async (_e, params: unknown) => {
    try {
      const result = correlationMatrix(params);
      return { success: true, result };
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      log.error('[CorrelationMatrix] Error:', err);
      return { success: false, error: err.message };
    }
  });

  // ── Sector Rotation v2 (JVS-48) ─────────────────────────────────────────


  // ── Sector Rotation v2 (JVS-48) ─────────────────────────────────────────
  ipcMain.handle('em:sector-rotation', async (_e, params: unknown) => {
    try {
      const result = detectSectorRotation(params);
      return { success: true, result };
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      log.error('[SectorRotation] Error:', err);
      return { success: false, error: err.message };
    }
  });

  // ── Sentiment Attribution (QClaw Q57) ──────────────────────────────────
  const localSentimentAttributionEngine = new SentimentAttributionEngine();


  // ── EM Data Provider — Sector Heatmap (JVS-1) ─────────────────────────
  ipcMain.handle('em:get-heatmap', async (_e, boardType?: string, limit?: number) => {
    if (!emDataProvider) return { success: false, error: 'EMDataProvider not initialized' };
    try {
      const bt = (boardType === 'concept' || boardType === 'region') ? boardType : 'industry';
      const result = await emDataProvider.getHeatmap(bt, limit || 50);
      return { success: true, ...result };
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      log.error('[EMDataProvider] Heatmap fetch failed:', err.message);
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('em:get-all-heatmaps', async () => {
    if (!emDataProvider) return { success: false, error: 'EMDataProvider not initialized' };
    try {
      const maps = await emDataProvider.getAllHeatmaps();
      return { success: true, ...maps };
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      log.error('[EMDataProvider] All heatmaps fetch failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  // ── Macro Data Provider — Dashboard (JVS-2) ───────────────────────────


  // ── Macro Data Provider — Dashboard (JVS-2) ───────────────────────────
  ipcMain.handle('em:get-macro', async (_e, indicator?: string, limit?: number) => {
    if (!macroDataProvider) return { success: false, error: 'MacroDataProvider not initialized' };
    try {
      const type = (indicator || 'GDP') as unknown;
      const result = await macroDataProvider.getIndicator(type, limit || 24);
      return { success: true, data: result };
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      log.error('[MacroDataProvider] Fetch failed:', err.message);
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('em:get-macro-dashboard', async (_e, indicators?: string[]) => {
    if (!macroDataProvider) return { success: false, error: 'MacroDataProvider not initialized' };
    try {
      const result = await macroDataProvider.getDashboard(indicators as unknown);
      return { success: true, ...result };
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      log.error('[MacroDataProvider] Dashboard fetch failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  // ── Sentiment Index Engine (JVS-3) ──────────────────────────────────────


  // ── Sentiment Index Engine (JVS-3) ──────────────────────────────────────
  ipcMain.handle('em:get-sentiment', async (_e, input?: unknown) => {
    try {
      const engine = new SentimentIndexEngine();
      const sentimentInput = input || {};
      const result = engine.compute(sentimentInput);
      return { success: true, result };
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      log.error('[SentimentIndex] Compute failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  // ── Stock Screener (JVS-4) ─────────────────────────────────────────────


  // ── News Aggregator (JVS-5) ────────────────────────────────────────────
  ipcMain.handle('em:get-news-aggregate', async (_e, request: unknown) => {
    if (!newsAggregator) return { success: false, error: 'NewsAggregator not initialized' };
    try {
      const result = await newsAggregator.search(request || { query: '' });
      return { success: true, ...result };
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      log.error('[NewsAggregator] Search failed:', err.message);
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('em:get-market-mood', async (_e, symbols?: string[]) => {
    if (!newsAggregator) return { success: false, error: 'NewsAggregator not initialized' };
    try {
      const report = await newsAggregator.getMarketMood(symbols);
      return { success: true, report };
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      log.error('[NewsAggregator] Market mood failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  // ── Sector Rotation Monitor (JVS-6) ──────────────────────────────────


  // ── Sector Rotation Monitor (JVS-6) ──────────────────────────────────
  ipcMain.handle('em:get-sector-rotation', async () => {
    if (!sectorRotation) return { success: false, error: 'SectorRotation not initialized' };
    try {
      const report = sectorRotation.analyze();
      return { success: true, ...report };
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      log.error('[SectorRotation] Analyze failed:', err.message);
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('em:record-sector-snapshot', async (_e, sectors: unknown[]) => {
    if (!sectorRotation) return { success: false, error: 'SectorRotation not initialized' };
    try {
      sectorRotation.recordSnapshot(sectors || []);
      return { success: true };
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      return { success: false, error: err.message };
    }
  });

  // ── Stock Anomaly Detector (JVS-7) ────────────────────────────────────


  // ── Stock Anomaly Detector (JVS-7) ────────────────────────────────────
  ipcMain.handle('em:get-anomaly-summary', async () => {
    if (!stockAnomalyDetector) return { success: false, error: 'AnomalyDetector not initialized' };
    try {
      const summary = stockAnomalyDetector.getSummary();
      return { success: true, summary };
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('em:get-anomaly-alerts', async (_e, options?: unknown) => {
    if (!stockAnomalyDetector) return { success: false, error: 'AnomalyDetector not initialized' };
    try {
      const alerts = stockAnomalyDetector.getAlerts(options);
      return { success: true, alerts };
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('em:process-anomaly-quotes', async (_e, quotes: unknown[]) => {
    if (!stockAnomalyDetector) return { success: false, error: 'AnomalyDetector not initialized' };
    try {
      const newAlerts = stockAnomalyDetector.processQuotes(quotes || []);
      return { success: true, newAlerts: newAlerts.length };
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('em:acknowledge-anomaly', async (_e, id: string) => {
    if (!stockAnomalyDetector) return { success: false, error: 'AnomalyDetector not initialized' };
    try {
      const result = stockAnomalyDetector.acknowledgeAlert(id);
      return { success: true, result };
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      return { success: false, error: err.message };
    }
  });

  // ── Market Hotspot (JVS-8) ─────────────────────────────────────────────


  // ── Market Hotspot (JVS-8) ─────────────────────────────────────────────
  ipcMain.handle('em:get-hotspot', async (_e, query?: unknown) => {
    if (!marketHotspot) return { success: false, error: 'MarketHotspot not initialized' };
    try {
      const report = await marketHotspot.getReport(query);
      return { success: true, ...report };
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      log.error('[MarketHotspot] Fetch failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  // ── Data Scheduler (auto-refresh) ─────────────────────────────────────


  // ── Dragon Tiger List — Dragon-Tiger list (JVS-10) ─────────────────────────────
  ipcMain.handle('em:get-dragon-tiger', async (_e, date?: string) => {
    try {
      const result = await getDragonTigerList(date);
      return result;
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      return { success: false, entries: [], total: 0, date: '', error: err.message };
    }
  });



  ipcMain.handle('em:get-dragon-tiger-detail', async (_e, code: string, date: string) => {
    try {
      const detail = await getDragonTigerDetail(code, date);
      return { success: !!detail, detail };
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      return { success: false, detail: null, error: err.message };
    }
  });



  ipcMain.handle('em:get-institutional-trades', async (_e, date?: string) => {
    try {
      const entries = await getInstitutionalTrades(date);
      return { success: true, entries };
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      return { success: false, entries: [], error: err.message };
    }
  });

 // ── Capital Flow Ranking — capital flow (JVS-11) ──────────────────────


 // ── Capital Flow Ranking — capital flow (JVS-11) ──────────────────────
  ipcMain.handle('em:get-capital-flow-stock', async (_e, sortBy?: string, order?: string, limit?: number) => {
    try {
      const result = await getStockCapitalFlowRank(sortBy as unknown, order as unknown, limit);
      return result;
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      return { success: false, items: [], total: 0, type: 'stock', error: err.message };
    }
  });



  ipcMain.handle('em:get-capital-flow-sector', async (_e, sortBy?: string, order?: string, limit?: number) => {
    try {
      const result = await getSectorCapitalFlowRank(sortBy as unknown, order as unknown, limit);
      return result;
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      return { success: false, items: [], total: 0, type: 'sector', error: err.message };
    }
  });



  ipcMain.handle('em:get-capital-flow-concept', async (_e, sortBy?: string, order?: string, limit?: number) => {
    try {
      const result = await getConceptCapitalFlowRank(sortBy as unknown, order as unknown, limit);
      return result;
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      return { success: false, items: [], total: 0, type: 'concept', error: err.message };
    }
  });

  // ── Capital Flow Monitor — Real-time alerts (JVS-12) ─────────────────


  // ── Capital Flow Monitor — Real-time alerts (JVS-12) ─────────────────
  ipcMain.handle('em:get-capital-flow-alerts', async (_e, items?: unknown[]) => {
    try {
      const monitor = getCapitalFlowMonitor();
      const alerts = items ? monitor.process(items) : [];
      return { success: true, alerts, config: monitor.getConfig() };
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      return { success: false, alerts: [], error: err.message };
    }
  });



  ipcMain.handle('em:set-capital-flow-config', async (_e, config: unknown) => {
    try {
      const monitor = getCapitalFlowMonitor();
      monitor.updateConfig(config);
      return { success: true, config: monitor.getConfig() };
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('em:clear-capital-flow-history', async () => {
    try {
      getCapitalFlowMonitor().clearHistory();
      return { success: true };
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      return { success: false, error: err.message };
    }
  });

 // ── Fund Holdings — fund holdings (JVS-13) ────────────────────────


 // ── Fund Holdings — fund holdings (JVS-13) ────────────────────────
  ipcMain.handle('em:get-fund-holdings', async (_e, fundCode: string, reportDate?: string) => {
    try {
      const result = await getFundHoldings(fundCode, reportDate);
      return result;
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      return { success: false, items: [], total: 0, error: err.message };
    }
  });



  ipcMain.handle('em:get-stock-fund-ownership', async (_e, stockCode: string, reportDate?: string) => {
    try {
      const result = await getStockFundOwnership(stockCode, reportDate);
      return result;
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      return { success: false, items: [], total: 0, error: err.message };
    }
  });



  ipcMain.handle('em:get-fund-increase-rank', async (_e, limit?: number, reportDate?: string) => {
    try {
      const result = await getFundIncreaseRank(limit, reportDate);
      return result;
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      return { success: false, items: [], total: 0, error: err.message };
    }
  });



  ipcMain.handle('em:get-fund-decrease-rank', async (_e, limit?: number, reportDate?: string) => {
    try {
      const result = await getFundDecreaseRank(limit, reportDate);
      return result;
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      return { success: false, items: [], total: 0, error: err.message };
    }
  });

 // ── Stock Diagnosis — (JVS-14) ──────────────────────


 // ── Stock Diagnosis — (JVS-14) ──────────────────────
  ipcMain.handle('em:diagnose-stock', async (_e, request: unknown) => {
    try {
      const result = await diagnoseStock(request || { code: '' });
      return result;
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      return { success: false, code: '', name: '', timestamp: Date.now(), error: err.message };
    }
  });



  ipcMain.handle('em:batch-diagnose', async (_e, codes: string[], options?: unknown) => {
    try {
      const results = await batchDiagnose(codes || [], options);
      return { success: true, reports: results };
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      return { success: false, reports: [], error: err.message };
    }
  });

 // ── Portfolio Risk — (JVS-15) ─────────────────────


 // ── Portfolio Risk — (JVS-15) ─────────────────────
  ipcMain.handle('em:portfolio-risk', async (_e, request: unknown) => {
    try {
      const result = await calculatePortfolioRisk(request || { positions: [] });
      return result;
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      return { success: false, error: err.message };
    }
  });

 // ── Market Breadth — (JVS-16) ────────────────────


 // ── Market Breadth — (JVS-16) ────────────────────
  ipcMain.handle('em:get-market-breadth', async () => {
    try {
      const result = await getMarketBreadth();
      return result;
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      return { success: false, error: err.message };
    }
  });

 // ── Consumer Data — service (JVS-17) ────────────────────


 // ── Consumer Data — service (JVS-17) ────────────────────
  ipcMain.handle('em:get-consumer-data', async (_e, months?: number) => {
    try {
      const result = await getConsumerDataReport(months || 12);
      return result;
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      return { success: false, error: err.message };
    }
  });

 // ── Margin Data — margin tradingservice (JVS-18) ────────────────────


 // ── Margin Data — margin tradingservice (JVS-18) ────────────────────
  ipcMain.handle('em:get-margin-data', async () => {
    try {
      const result = await getMarginDataReport();
      return result;
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('em:get-stock-margin', async (_e, code: string, days?: number) => {
    try {
      const result = await getStockMargin(code, days || 30);
      return { success: true, data: result };
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('em:get-margin-balance-rank', async (_e, limit?: number) => {
    try {
      const result = await getMarginBalanceRanking(limit || 30);
      return { success: true, data: result };
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('em:get-short-interest-rank', async (_e, limit?: number) => {
    try {
      const result = await getShortInterestRanking(limit || 30);
      return { success: true, data: result };
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      return { success: false, error: err.message };
    }
  });

  // ── EMI Unified Service Layer (JVS-19) ──────────────────────────────────


  // ── EMI Unified Service Layer (JVS-19) ──────────────────────────────────
  ipcMain.handle('em:get-stock-overview', async (_e, code: string) => {
    if (!code) return { success: false, error: 'Stock code required' };
    try {
      const result = await getStockOverview(code);
      return { success: true, data: result };
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('em:get-market-overview', async () => {
    try {
      const result = await getMarketOverview();
      return { success: true, data: result };
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('em:get-daily-report', async () => {
    try {
      const result = await getDailyReport();
      return { success: true, data: result };
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      return { success: false, error: err.message };
    }
  });

  // ── Python Script Proxy Layer (JVS-20) ──────────────────────────────────


  // ── Dragon Tiger Stream (JVS-22 PM) ─────────────────────────────────────
  ipcMain.handle('em:dragon-tiger-stream-start', async () => {
    try {
      const stream = getDragonTigerStream();
      stream.start();
      stream.on('update', (event) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('dragon-tiger:update', event);
        }
      });
      return { success: true };
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('em:dragon-tiger-stream-stop', async () => {
    try {
      getDragonTigerStream().stop();
      return { success: true };
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('em:dragon-tiger-stream-fetch', async () => {
    try {
      const result = await getDragonTigerStream().fetchNow();
      return { success: true, data: result };
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('em:dragon-tiger-stream-status', async () => {
    try {
      return { success: true, status: getDragonTigerStream().getStatus() };
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      return { success: false, error: err.message };
    }
  });

  // ── Unlock Calendar (JVS-23 PM) ────────────────────────────────────────


  // ── Unlock Calendar (JVS-23 PM) ────────────────────────────────────────
  ipcMain.handle('em:get-unlock-calendar', async (_e, days?: number) => {
    try {
      const result = await getUnlockCalendar(days || 30);
      return result;
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      return { success: false, events: [], total: 0, error: err.message };
    }
  });

  // ── Dividend Calendar (JVS-24 PM) ──────────────────────────────────────


  // ── Dividend Calendar (JVS-24 PM) ──────────────────────────────────────
  ipcMain.handle('em:get-dividend-calendar', async (_e, days?: number) => {
    try {
      const result = await getDividendCalendar(days || 30);
      return result;
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      return { success: false, events: [], total: 0, error: err.message };
    }
  });

  // ── Earnings Calendar (JVS-25 PM) ──────────────────────────────────────


  // ── Earnings Calendar (JVS-25 PM) ──────────────────────────────────────
  ipcMain.handle('em:get-earnings-calendar', async (_e, days?: number) => {
    try {
      const result = await getEarningsCalendar(days || 30);
      return result;
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      return { success: false, events: [], total: 0, error: err.message };
    }
  });

  // ── Data Exporter (JVS-26 PM) ──────────────────────────────────────────


  // ── Data Exporter (JVS-26 PM) ──────────────────────────────────────────
  ipcMain.handle('em:export-data', async (_e, type: string, format?: string) => {
    try {
      const result = await exportData(type as unknown, (format as unknown) || 'json');
      return result;
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      return { success: false, error: err.message };
    }
  });

  // ── Smart Picker (JVS-25 PM Round 2) ───────────────────────────────────


  // ── Smart Picker (JVS-25 PM Round 2) ───────────────────────────────────
  ipcMain.handle('em:smart-pick', async (_e, request?: unknown) => {
    try {
      const picker = getSmartPicker();
      const result = await picker.pick(request || {});
      return result;
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      return { success: false, error: err.message };
    }
  });

  // ── WS Data Stream (JVS-29) ────────────────────────────────────────────


  // ── History Backfill (JVS-30) ──────────────────────────────────────────
  ipcMain.handle('em:backfill-start', async (_e, config?: unknown) => {
    try {
      const backfill = getHistoryBackfill();
      const status = await backfill.start(config);
      return { success: true, status };
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('em:backfill-status', async () => {
    try {
      return { success: true, status: getHistoryBackfill().getStatus() };
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('em:backfill-data', async (_e, module: string) => {
    try {
      const data = getHistoryBackfill().getBackfillData(module);
      return { success: true, data };
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('em:backfill-list', async () => {
    try {
      const files = getHistoryBackfill().listBackfillFiles();
      return { success: true, files };
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      return { success: false, error: err.message };
    }
  });

  // Wire quote stream events to renderer
  if (getQuoteStream()) {
    getQuoteStream()!.on('quote:update', (quotes) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('quote:stream-tick', quotes);
      }
    });
    getQuoteStream()!.on('anomaly:detected', (alerts) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('quote:stream-anomaly', alerts);
      }
    });
  }

  // ── Walk-Forward Analysis (Sprint 2 — JVS) ───────────────────────────

}


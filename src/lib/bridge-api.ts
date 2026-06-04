// ── DAWN WHALES — IPC API Client (直连 OpenD，通过 Electron IPC) ──────────────

declare global {
  interface Window {
    api: {
      broker: {
        connect: (config: any) => Promise<any>;
        disconnect: () => Promise<any>;
        getAccounts: () => Promise<any>;
        getFunds: (accountId: string) => Promise<any>;
        getPositions: (accountId: string) => Promise<any>;
        getQuotes: (codes: string[]) => Promise<any>;
        getKlines: (code: string, period: string, count: number) => Promise<any>;
        subscribe: (codes: string[]) => Promise<any>;
        unsubscribe: (codes: string[]) => Promise<any>;
        placeOrder: (order: any) => Promise<any>;
        cancelOrder: (orderId: string) => Promise<any>;
        getOrders: (accountId: string) => Promise<any>;
        list: () => Promise<any>;
        add: (cfg: any) => Promise<any>;
        remove: (id: string) => Promise<any>;
        setActive: (id: string) => Promise<any>;
        getStatus: () => Promise<any>;
      };
      greeks: {
        calculate: (params: any) => Promise<any>;
        portfolio: (positions: any[]) => Promise<any>;
      };
      marketplace: {
        rate: (strategyId: string, rating: number) => Promise<any>;
        getRating: (strategyId: string) => Promise<any>;
        comment: (strategyId: string, content: string, parentId?: number) => Promise<any>;
        getComments: (strategyId: string) => Promise<any>;
        savePerformance: (data: any) => Promise<any>;
        getPerformance: (strategyId: string) => Promise<any>;
        list: (sortBy?: string, limit?: number) => Promise<any>;
        score: (strategyId: string) => Promise<any>;
        verify: (strategyId: string) => Promise<any>;
        updateAllScores: () => Promise<any>;
      };
      dataProvider: {
        getFundamental: (symbol: string) => Promise<any>;
        getCapitalFlow: (symbol: string) => Promise<any>;
        getRegime: () => Promise<any>;
        getAnomalies: (symbol: string) => Promise<any>;
        getNews: (symbol: string, limit?: number) => Promise<any>;
        getCompositeScore: (symbol: string) => Promise<any>;
        saveFundamental: (data: any) => Promise<any>;
        saveCapitalFlow: (data: any) => Promise<any>;
        saveRegime: (regime: any) => Promise<any>;
        computeRegime: (factors: any) => Promise<any>;
        saveAnomaly: (signal: any) => Promise<any>;
        saveNews: (symbol: string, items: any[]) => Promise<any>;
        clearCache: () => Promise<any>;
      };
      emDataProvider: {
        getHeatmap: (boardType?: string, limit?: number) => Promise<any>;
        getAllHeatmaps: () => Promise<any>;
      };
      macroDataProvider: {
        getIndicator: (indicator?: string, limit?: number) => Promise<any>;
        getDashboard: (indicators?: string[]) => Promise<any>;
      };
      sentimentIndex: {
        compute: (input?: any) => Promise<any>;
      };
      stockScreener: {
        search: (request: any) => Promise<any>;
      };
      newsAggregator: {
        search: (request: any) => Promise<any>;
        getMarketMood: (symbols?: string[]) => Promise<any>;
      };
      sectorRotation: {
        analyze: () => Promise<any>;
        recordSnapshot: (sectors: any[]) => Promise<any>;
      };
      stockAnomaly: {
        getSummary: () => Promise<any>;
        getAlerts: (options?: any) => Promise<any>;
        processQuotes: (quotes: any[]) => Promise<any>;
        acknowledgeAlert: (id: string) => Promise<any>;
      };
      marketHotspot: {
        getReport: (query?: any) => Promise<any>;
      };
      dataScheduler: {
        getStatus: () => Promise<any>;
        refreshNow: (module?: string) => Promise<any>;
      };
      backtestEnhanced: {
        walkForward: (config: any) => Promise<any>;
        paramScan: (config: any) => Promise<any>;
        multiTimeframe: (config: any) => Promise<any>;
      };
      backtest: {
        multiPeriod: (config: any) => Promise<any>;
        paramSweep: (config: any) => Promise<any>;
        walkForward: (config: any) => Promise<any>;
        riskMetrics: (equityCurve: number[], riskFreeRate?: number) => Promise<any>;
        walkForwardV2: (config: any) => Promise<any>;
        paramScan: (config: any) => Promise<any>;
        multiTimeframe: (config: any) => Promise<any>;
      };
      strategy: {
        create: (dsl: any) => Promise<any>;
        getAll: () => Promise<any>;
        get: (id: string) => Promise<any>;
        update: (id: string, updates: any) => Promise<any>;
        delete: (id: string) => Promise<any>;
        backtest: (config: any) => Promise<any>;
        startLive: (id: string) => Promise<any>;
        stopLive: (id: string) => Promise<any>;
        explain: (strategy: any) => Promise<any>;
        compare: (s1: any, s2: any) => Promise<any>;
        optimize: (strategyDSL: any, backtestResult: any) => Promise<any>;
        correlation: (strategies: any) => Promise<any>;
      };
      notification: {
        generate: (ctx: any) => Promise<any>;
        summary: (alerts: any[], apiKey?: string) => Promise<any>;
      };
      report: {
        generate: (ctx: { results: any[]; symbol?: string; apiKey?: string; timeoutMs?: number }) => Promise<any>;
        quick: (ctx: { result: any; apiKey?: string }) => Promise<any>;
      };
      regime: {
        detect: (klines: { close: number[]; high: number[]; low: number[]; open: number[] }, vixLevel?: number, symbol?: string) => Promise<any>;
      };
      anomaly: {
        detect: (values: number[], method?: 'zscore' | 'iqr' | 'moving', window?: number, threshold?: number) => Promise<any>;
      };
      autoTune: {
        tune: (ctx: { strategyType: string; ranges: any[]; klines: any[]; method?: 'ga' | 'bayesian' | 'both'; populationSize?: number; generations?: number; iterations?: number }) => Promise<any>;
      };
      nl: {
        parse: (text: string) => Promise<any>;
        templates: () => Promise<any>;
      };
      risk: {
        getConfig: () => Promise<any>;
        updateConfig: (config: any) => Promise<any>;
        getAlerts: () => Promise<any>;
        getStatusSnapshot: () => Promise<any>;
        getKellyStats: () => Promise<any>;
        getDrawdownState: () => Promise<any>;
        updateVix: (vix: number) => Promise<any>;
        // Q9: Risk Decomposition
        decompose: (equityCurve: number[], positions?: any[], confidenceLevel?: number) => Promise<any>;
        monteCarlo: (equityCurve: number[], paths?: number, horizon?: number) => Promise<any>;
      };
      db: {
        getStrategies: () => Promise<any>;
        saveStrategy: (s: any) => Promise<any>;
        getSettings: () => Promise<any>;
        saveSettings: (s: any) => Promise<any>;
        getTrades: (strategyId?: string) => Promise<any>;
        getBacktestResults: (strategyId: string) => Promise<any>;
        getWatchlist: () => Promise<any>;
        saveWatchlist: (codes: string[]) => Promise<any>;
        getSignals: (strategyId?: string) => Promise<any>;
      };
      app: {
        getInfo: () => Promise<any>;
        getMemoryUsage: () => Promise<any>;
        exportPdf: (filename: string) => Promise<any>;
        checkUpdate: () => Promise<any>;
        downloadUpdate: () => Promise<any>;
        installUpdate: () => Promise<void>;
        emergencyStop: () => Promise<void>;
        openExternal: (url: string) => Promise<void>;
        getVersion: () => Promise<string>;
        getPlatform: () => Promise<string>;
      };
      on: (channel: string, callback: (...args: any[]) => void) => void;
      off?: (channel: string, callback: (...args: any[]) => void) => void;
    };
  }
}

function hasIPC(): boolean {
  return typeof window !== 'undefined' && !!window.api?.broker;
}

// ── Broker ─────────────────────────────────────────────────────────────────

export async function connectBroker(config?: { host?: string; port?: number }): Promise<any> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' };
  return window.api.broker.connect(config || { host: '127.0.0.1', port: 11111 });
}

export async function getKlines(code: string, period: string = 'daily', count: number = 200): Promise<any[]> {
  if (!hasIPC()) return generateDemoKlines(count);
  const result = await window.api.broker.getKlines(code, period, count);
  if (result?.success && result.klines?.length > 0) return result.klines;
  return generateDemoKlines(count);
}

export async function getAccounts(): Promise<any[]> {
  if (!hasIPC()) return [];
  const result = await window.api.broker.getAccounts();
  return result?.success ? result.accounts || [] : [];
}

export async function getFunds(accountId: string): Promise<any> {
  if (!hasIPC()) return null;
  const result = await window.api.broker.getFunds(accountId);
  return result?.success ? result.funds : null;
}

export async function getPositions(accountId: string): Promise<any[]> {
  if (!hasIPC()) return [];
  const result = await window.api.broker.getPositions(accountId);
  return result?.success ? result.positions || [] : [];
}

export async function getQuotes(codes: string[] = []): Promise<any[]> {
  if (!hasIPC()) return [];
  const result = await window.api.broker.getQuotes(codes);
  return result?.success ? result.quotes || [] : [];
}

export async function subscribeQuotes(codes: string[]): Promise<any> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' };
  return window.api.broker.subscribe(codes);
}

export async function unsubscribeQuotes(codes: string[]): Promise<any> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' };
  return window.api.broker.unsubscribe(codes);
}

export async function getWatchlist(): Promise<string[]> {
  if (!hasIPC()) return [];
  const result = await window.api.db.getWatchlist();
  return Array.isArray(result) ? result : [];
}

export async function saveWatchlist(codes: string[]): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.db.saveWatchlist(codes);
}

export async function calculateGreeks(params: any): Promise<any> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' };
  return window.api.greeks.calculate(params);
}

export async function calculatePortfolioGreeks(positions: any[]): Promise<any> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' };
  return window.api.greeks.portfolio(positions);
}

export async function getOrders(accountId: string): Promise<any> {
  if (!hasIPC()) return { success: false, orders: [] };
  return window.api.broker.getOrders(accountId);
}

export async function cancelOrder(orderId: string): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.broker.cancelOrder(orderId);
}

export async function isConnected(): Promise<boolean> {
  if (!hasIPC()) return false;
  try {
    const result = await window.api.broker.getAccounts();
    return result?.success === true;
  } catch { return false; }
}

// ── Broker Manager (Sprint1: multi-broker) ───────────────────────────────

export async function listBrokers(): Promise<any[]> {
  if (!hasIPC()) return [];
  const result = await window.api.broker.list();
  return result?.success ? result.brokers || [] : [];
}

export async function addBroker(cfg: any): Promise<any> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' };
  return window.api.broker.add(cfg);
}

export async function removeBroker(id: string): Promise<any> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' };
  return window.api.broker.remove(id);
}

export async function setActiveBroker(id: string): Promise<any> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' };
  return window.api.broker.setActive(id);
}

export async function getBrokerStatus(): Promise<any[]> {
  if (!hasIPC()) return [];
  const result = await window.api.broker.getStatus();
  return result?.success ? result.status || [] : [];
}

// ── Strategy ───────────────────────────────────────────────────────────────

export async function createStrategy(input: any): Promise<any> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' };
  return window.api.strategy.create(input);
}

export async function getAllStrategies(): Promise<any[]> {
  if (!hasIPC()) return [];
  const result = await window.api.strategy.getAll();
  return result?.success ? result.strategies || [] : [];
}

export async function runBacktest(config: any): Promise<any> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' };
  return window.api.strategy.backtest(config);
}

export async function startLive(strategyId: string): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.strategy.startLive(strategyId);
}

export async function stopLive(strategyId: string): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.strategy.stopLive(strategyId);
}

// ── NL Parser ──────────────────────────────────────────────────────────────

export async function parseNL(text: string): Promise<any> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' };
  return window.api.nl.parse(text);
}

export async function getTemplates(): Promise<any[]> {
  if (!hasIPC()) return [];
  const result = await window.api.nl.templates();
  return result?.success ? result.templates || [] : [];
}

// ── Risk ───────────────────────────────────────────────────────────────────

export async function getRiskAlerts(): Promise<any[]> {
  if (!hasIPC()) return [];
  const result = await window.api.risk.getAlerts();
  return result?.success ? result.alerts || [] : [];
}

export async function getRiskStatusSnapshot(): Promise<any> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' };
  return window.api.risk.getStatusSnapshot();
}

export async function getRiskKellyStats(): Promise<any> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' };
  return window.api.risk.getKellyStats();
}

export async function getRiskDrawdownState(): Promise<any> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' };
  return window.api.risk.getDrawdownState();
}

// ── App / Updater ──────────────────────────────────────────────────────────

export async function exportDashboardPdf(filename: string): Promise<any> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' };
  return window.api.app.exportPdf(filename);
}

export async function checkUpdate(): Promise<any> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' };
  return window.api.app.checkUpdate();
}

export async function downloadUpdate(): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.app.downloadUpdate();
}

export async function installUpdate(): Promise<void> {
  if (!hasIPC()) return;
  return window.api.app.installUpdate();
}

// ── Strategy CRUD ────────────────────────────────────────────────────────────

export async function getStrategies(): Promise<any[]> {
  if (!hasIPC()) return [];
  const result = await window.api.strategy.getAll();
  return result?.success ? result.strategies || [] : [];
}

export async function updateStrategy(id: string, updates: any): Promise<any> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' };
  return window.api.strategy.update?.(id, updates) || { success: false, error: 'Not implemented' };
}

export async function deleteStrategy(id: string): Promise<any> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' };
  return window.api.strategy.delete(id);
}

// ── Signals ─────────────────────────────────────────────────────────────────

export async function getSignals(strategyId?: string): Promise<any[]> {
  if (!hasIPC()) return [];
  const result = await window.api.db.getSignals(strategyId);
  return Array.isArray(result) ? result : [];
}

// ── Risk Config ─────────────────────────────────────────────────────────────

export async function getRiskConfig(): Promise<any> {
  if (!hasIPC()) return null;
  return window.api.risk.getConfig();
}

export async function updateRiskConfig(config: any): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.risk.updateConfig(config);
}

// ── Marketplace ──────────────────────────────────────────────────────────

export async function rateStrategy(strategyId: string, rating: number): Promise<any> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' };
  return window.api.marketplace.rate(strategyId, rating);
}

export async function getStrategyRating(strategyId: string): Promise<any> {
  if (!hasIPC()) return { success: false, avg: 0, count: 0, myRating: 0 };
  return window.api.marketplace.getRating(strategyId);
}

export async function addComment(strategyId: string, content: string, parentId?: number): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.marketplace.comment(strategyId, content, parentId);
}

export async function getComments(strategyId: string): Promise<any> {
  if (!hasIPC()) return { success: false, comments: [] };
  return window.api.marketplace.getComments(strategyId);
}

export async function savePerformance(data: any): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.marketplace.savePerformance(data);
}

export async function getPerformance(strategyId: string): Promise<any> {
  if (!hasIPC()) return { success: false, performance: [] };
  return window.api.marketplace.getPerformance(strategyId);
}

export async function getMarketplaceList(sortBy?: string, limit?: number): Promise<any> {
  if (!hasIPC()) return { success: false, strategies: [] };
  return window.api.marketplace.list(sortBy, limit);
}

export async function getStrategyScore(strategyId: string): Promise<any> {
  if (!hasIPC()) return { success: false, score: null };
  return window.api.marketplace.score(strategyId);
}

export async function verifyStrategy(strategyId: string): Promise<any> {
  if (!hasIPC()) return { success: false, verification: null };
  return window.api.marketplace.verify(strategyId);
}

export async function updateAllScores(): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.marketplace.updateAllScores();
}

// ── Data Provider ─────────────────────────────────────────────────────────

export async function getFundamental(symbol: string): Promise<any> {
  if (!hasIPC()) return { success: false, data: null };
  return window.api.dataProvider.getFundamental(symbol);
}

export async function getCapitalFlow(symbol: string): Promise<any> {
  if (!hasIPC()) return { success: false, data: null };
  return window.api.dataProvider.getCapitalFlow(symbol);
}

export async function getMarketRegime(): Promise<any> {
  if (!hasIPC()) return { success: false, regime: null };
  return window.api.dataProvider.getRegime();
}

export async function getAnomalies(symbol: string): Promise<any> {
  if (!hasIPC()) return { success: false, signals: [] };
  return window.api.dataProvider.getAnomalies(symbol);
}

export async function getNews(symbol: string, limit?: number): Promise<any> {
  if (!hasIPC()) return { success: false, items: [] };
  return window.api.dataProvider.getNews(symbol, limit);
}

export async function getCompositeScore(symbol: string): Promise<any> {
  if (!hasIPC()) return { success: false, result: null };
  return window.api.dataProvider.getCompositeScore(symbol);
}

export async function saveFundamentalData(data: any): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.dataProvider.saveFundamental(data);
}

export async function saveCapitalFlowData(data: any): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.dataProvider.saveCapitalFlow(data);
}

export async function saveMarketRegimeData(regime: any): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.dataProvider.saveRegime(regime);
}

export async function computeMarketRegime(factors: any): Promise<any> {
  if (!hasIPC()) return { success: false, regime: null };
  return window.api.dataProvider.computeRegime(factors);
}

export async function saveAnomalySignal(signal: any): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.dataProvider.saveAnomaly(signal);
}

export async function saveNewsItems(symbol: string, items: any[]): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.dataProvider.saveNews(symbol, items);
}

export async function clearDataCache(): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.dataProvider.clearCache();
}

// ── EM Data Provider — Sector Heatmap (JVS-1) ─────────────────────────────

export async function getSectorHeatmap(boardType?: string, limit?: number): Promise<any> {
  if (!hasIPC()) return { success: false, sectors: [] };
  return window.api.emDataProvider.getHeatmap(boardType, limit);
}

export async function getAllSectorHeatmaps(): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.emDataProvider.getAllHeatmaps();
}

// ── Macro Data Provider (JVS-2) ───────────────────────────────────────────

export async function getMacroIndicator(indicator?: string, limit?: number): Promise<any> {
  if (!hasIPC()) return { success: false, data: null };
  return window.api.macroDataProvider.getIndicator(indicator, limit);
}

export async function getMacroDashboard(indicators?: string[]): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.macroDataProvider.getDashboard(indicators);
}

// ── Sentiment Index (JVS-3) ───────────────────────────────────────────────

export async function computeSentiment(input?: any): Promise<any> {
  if (!hasIPC()) return { success: false, result: null };
  return window.api.sentimentIndex.compute(input);
}

// ── Stock Screener (JVS-4) ────────────────────────────────────────────────

export async function searchStocks(request: {
  query: string;
  selectType?: string;
  limit?: number;
}): Promise<any> {
  if (!hasIPC()) return { success: false, records: [] };
  return window.api.stockScreener.search(request);
}

// ── News Aggregator (JVS-5) ───────────────────────────────────────────────

export async function searchNews(request: {
  query: string;
  symbols?: string[];
  categories?: string[];
  sentimentFilter?: string;
  hoursBack?: number;
  limit?: number;
}): Promise<any> {
  if (!hasIPC()) return { success: false, articles: [] };
  return window.api.newsAggregator.search(request);
}

export async function getMarketMood(symbols?: string[]): Promise<any> {
  if (!hasIPC()) return { success: false, report: null };
  return window.api.newsAggregator.getMarketMood(symbols);
}

// ── Sector Rotation (JVS-6) ───────────────────────────────────────────────

export async function analyzeSectorRotation(): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.sectorRotation.analyze();
}

export async function recordSectorSnapshot(sectors: any[]): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.sectorRotation.recordSnapshot(sectors);
}

// ── Stock Anomaly Detector (JVS-7) ────────────────────────────────────────

export async function getAnomalySummary(): Promise<any> {
  if (!hasIPC()) return { success: false, summary: null };
  return window.api.stockAnomaly.getSummary();
}

export async function getAnomalyAlerts(options?: {
  level?: string;
  type?: string;
  code?: string;
  limit?: number;
  unacknowledgedOnly?: boolean;
}): Promise<any> {
  if (!hasIPC()) return { success: false, alerts: [] };
  return window.api.stockAnomaly.getAlerts(options);
}

export async function processAnomalyQuotes(quotes: any[]): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.stockAnomaly.processQuotes(quotes);
}

export async function acknowledgeAnomalyAlert(id: string): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.stockAnomaly.acknowledgeAlert(id);
}

// ── Market Hotspot (JVS-8) ────────────────────────────────────────────────

export async function getMarketHotspot(query?: {
  type?: string;
  limit?: number;
}): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.marketHotspot.getReport(query);
}

// ── Data Scheduler ─────────────────────────────────────────────────────────

export async function getSchedulerStatus(): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.dataScheduler.getStatus();
}

export async function refreshDataNow(module?: string): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.dataScheduler.refreshNow(module);
}

// ── Quote Stream — Real-time Market Data (JVS-9) ──────────────────────────

export async function startQuoteStream(symbols?: string[]): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.quoteStream.start(symbols);
}

export async function stopQuoteStream(): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.quoteStream.stop();
}

export async function getQuoteStreamStatus(): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.quoteStream.status();
}

export async function subscribeQuotes(symbols: string[]): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.quoteStream.subscribe(symbols);
}

export async function unsubscribeQuotes(symbols: string[]): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.quoteStream.unsubscribe(symbols);
}

export function onQuoteStreamTick(callback: (quotes: any[]) => void): void {
  if (!hasIPC()) return;
  window.api.on('quote:stream-tick', callback);
}

export function onQuoteStreamAnomaly(callback: (alerts: any[]) => void): void {
  if (!hasIPC()) return;
  window.api.on('quote:stream-anomaly', callback);
}

// ── Dragon Tiger List — 龙虎榜 (JVS-10) ───────────────────────────────────

export async function getDragonTigerList(date?: string): Promise<any> {
  if (!hasIPC()) return { success: false, entries: [], total: 0 };
  return window.api.dragonTiger.getList(date);
}

export async function getDragonTigerDetail(code: string, date: string): Promise<any> {
  if (!hasIPC()) return { success: false, detail: null };
  return window.api.dragonTiger.getDetail(code, date);
}

export async function getInstitutionalTrades(date?: string): Promise<any> {
  if (!hasIPC()) return { success: false, entries: [] };
  return window.api.dragonTiger.getInstitutionalTrades(date);
}

// ── Capital Flow Ranking — 资金流排行 (JVS-11) ────────────────────────────

export async function getStockCapitalFlowRank(sortBy?: string, order?: string, limit?: number): Promise<any> {
  if (!hasIPC()) return { success: false, items: [], total: 0 };
  return window.api.capitalFlow.getStockRank(sortBy, order, limit);
}

export async function getSectorCapitalFlowRank(sortBy?: string, order?: string, limit?: number): Promise<any> {
  if (!hasIPC()) return { success: false, items: [], total: 0 };
  return window.api.capitalFlow.getSectorRank(sortBy, order, limit);
}

export async function getConceptCapitalFlowRank(sortBy?: string, order?: string, limit?: number): Promise<any> {
  if (!hasIPC()) return { success: false, items: [], total: 0 };
  return window.api.capitalFlow.getConceptRank(sortBy, order, limit);
}

// ── Capital Flow Monitor — Real-time alerts (JVS-12) ──────────────────────

export async function getCapitalFlowAlerts(items?: any[]): Promise<any> {
  if (!hasIPC()) return { success: false, alerts: [] };
  return window.api.capitalFlowMonitor.getAlerts(items);
}

export async function setCapitalFlowConfig(config: any): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.capitalFlowMonitor.setConfig(config);
}

export async function clearCapitalFlowHistory(): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.capitalFlowMonitor.clearHistory();
}

// ── Fund Holdings — 基金持仓数据 (JVS-13) ─────────────────────────────────

export async function getFundHoldings(fundCode: string, reportDate?: string): Promise<any> {
  if (!hasIPC()) return { success: false, items: [], total: 0 };
  return window.api.fundHoldings.getHoldings(fundCode, reportDate);
}

export async function getStockFundOwnership(stockCode: string, reportDate?: string): Promise<any> {
  if (!hasIPC()) return { success: false, items: [], total: 0 };
  return window.api.fundHoldings.getStockOwnership(stockCode, reportDate);
}

export async function getFundIncreaseRank(limit?: number, reportDate?: string): Promise<any> {
  if (!hasIPC()) return { success: false, items: [], total: 0 };
  return window.api.fundHoldings.getIncreaseRank(limit, reportDate);
}

export async function getFundDecreaseRank(limit?: number, reportDate?: string): Promise<any> {
  if (!hasIPC()) return { success: false, items: [], total: 0 };
  return window.api.fundHoldings.getDecreaseRank(limit, reportDate);
}

// ── Stock Diagnosis — 个股诊断聚合器 (JVS-14) ─────────────────────────────

export async function diagnoseStock(request: {
  code: string;
  name?: string;
  includeCapitalFlow?: boolean;
  includeFundHoldings?: boolean;
  includeDragonTiger?: boolean;
  includeNews?: boolean;
  includeAnomalies?: boolean;
}): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.stockDiagnosis.diagnose(request);
}

export async function batchDiagnoseStocks(codes: string[], options?: any): Promise<any> {
  if (!hasIPC()) return { success: false, reports: [] };
  return window.api.stockDiagnosis.batchDiagnose(codes, options);
}

// ── Backtest Enhancement (Sprint 2, merged) ──────────────────────────────

export async function multiPeriodBacktest(config: any): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.backtest.multiPeriod(config);
}

export async function parameterSweep(config: any): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.backtest.paramSweep(config);
}

export async function walkForwardAnalysis(config: any): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.backtest.walkForward(config);
}

export async function computeRiskMetrics(equityCurve: number[], riskFreeRate?: number): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.backtest.riskMetrics(equityCurve, riskFreeRate);
}

export async function runWalkForwardV2(config: any): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.backtest.walkForwardV2(config);
}

export async function runParamScan(config: any): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.backtest.paramScan(config);
}

export async function runMultiTimeframe(config: any): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.backtest.multiTimeframe(config);
}

// ── Demo K-line Generator (fallback) ──────────────────────────────────────

function generateDemoKlines(count: number): any[] {
  const data: any[] = [];
  let price = 100 + Math.random() * 50;
  const now = Math.floor(Date.now() / 1000);
  const daySeconds = 86400;
  const startTime = now - count * daySeconds;

  for (let i = 0; i < count; i++) {
    const volatility = 0.02 + Math.random() * 0.03;
    const change = (Math.random() - 0.48) * volatility * price;
    const open = price;
    const close = price + change;
    const high = Math.max(open, close) + Math.random() * volatility * price * 0.5;
    const low = Math.min(open, close) - Math.random() * volatility * price * 0.5;
    const volume = Math.floor(1000000 + Math.random() * 5000000);

    data.push({
      time: startTime + i * daySeconds,
      open: +open.toFixed(2), high: +high.toFixed(2),
      low: +low.toFixed(2), close: +close.toFixed(2), volume,
    });
    price = close;
  }
  return data;
}

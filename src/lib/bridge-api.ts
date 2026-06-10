// ── DAWN WHALES �?IPC API Client (直连 OpenD，通过 Electron IPC) ──────────────

declare global {
  interface Window {
    api: {
      broker: {
        connect: (config: unknown) => Promise<Record<string, unknown>>;
        disconnect: () => Promise<Record<string, unknown>>;
        getAccounts: () => Promise<Record<string, unknown>>;
        getFunds: (accountId: string) => Promise<Record<string, unknown>>;
        getPositions: (accountId: string) => Promise<Record<string, unknown>>;
        getQuotes: (codes: string[]) => Promise<Record<string, unknown>>;
        getKlines: (code: string, period: string, count: number) => Promise<Record<string, unknown>>;
        subscribe: (codes: string[]) => Promise<Record<string, unknown>>;
        unsubscribe: (codes: string[]) => Promise<Record<string, unknown>>;
        placeOrder: (order: unknown) => Promise<Record<string, unknown>>;
        cancelOrder: (orderId: string) => Promise<Record<string, unknown>>;
        getOrders: (accountId: string) => Promise<Record<string, unknown>>;
        list: () => Promise<Record<string, unknown>>;
        add: (cfg: unknown) => Promise<Record<string, unknown>>;
        remove: (id: string) => Promise<Record<string, unknown>>;
        setActive: (id: string) => Promise<Record<string, unknown>>;
        getStatus: () => Promise<Record<string, unknown>>;
      };
      greeks: {
        calculate: (params: unknown) => Promise<Record<string, unknown>>;
        portfolio: (positions: unknown[]) => Promise<Record<string, unknown>>;
      };
      marketplace: {
        rate: (strategyId: string, rating: number) => Promise<Record<string, unknown>>;
        getRating: (strategyId: string) => Promise<Record<string, unknown>>;
        comment: (strategyId: string, content: string, parentId?: number) => Promise<Record<string, unknown>>;
        getComments: (strategyId: string) => Promise<Record<string, unknown>>;
        savePerformance: (data: unknown) => Promise<Record<string, unknown>>;
        getPerformance: (strategyId: string) => Promise<Record<string, unknown>>;
        list: (sortBy?: string, limit?: number) => Promise<Record<string, unknown>>;
        score: (strategyId: string) => Promise<Record<string, unknown>>;
        verify: (strategyId: string) => Promise<Record<string, unknown>>;
        updateAllScores: () => Promise<Record<string, unknown>>;
      };
      dataProvider: {
        getFundamental: (symbol: string) => Promise<Record<string, unknown>>;
        getCapitalFlow: (symbol: string) => Promise<Record<string, unknown>>;
        getRegime: () => Promise<Record<string, unknown>>;
        getAnomalies: (symbol: string) => Promise<Record<string, unknown>>;
        getNews: (symbol: string, limit?: number) => Promise<Record<string, unknown>>;
        getCompositeScore: (symbol: string) => Promise<Record<string, unknown>>;
        saveFundamental: (data: unknown) => Promise<Record<string, unknown>>;
        saveCapitalFlow: (data: unknown) => Promise<Record<string, unknown>>;
        saveRegime: (regime: unknown) => Promise<Record<string, unknown>>;
        computeRegime: (factors: unknown) => Promise<Record<string, unknown>>;
        saveAnomaly: (signal: unknown) => Promise<Record<string, unknown>>;
        saveNews: (symbol: string, items: unknown[]) => Promise<Record<string, unknown>>;
        clearCache: () => Promise<Record<string, unknown>>;
      };
      backtestEnhanced: {
        walkForward: (config: unknown) => Promise<Record<string, unknown>>;
        paramScan: (config: unknown) => Promise<Record<string, unknown>>;
        multiTimeframe: (config: unknown) => Promise<Record<string, unknown>>;
      };
      backtest: {
        multiPeriod: (config: unknown) => Promise<Record<string, unknown>>;
        paramSweep: (config: unknown) => Promise<Record<string, unknown>>;
        walkForward: (config: unknown) => Promise<Record<string, unknown>>;
        riskMetrics: (equityCurve: number[], riskFreeRate?: number) => Promise<Record<string, unknown>>;
        walkForwardV2: (config: unknown) => Promise<Record<string, unknown>>;
        paramScan: (config: unknown) => Promise<Record<string, unknown>>;
        multiTimeframe: (config: unknown) => Promise<Record<string, unknown>>;
      };
      strategy: {
        create: (dsl: unknown) => Promise<Record<string, unknown>>;
        getAll: () => Promise<Record<string, unknown>>;
        get: (id: string) => Promise<Record<string, unknown>>;
        update: (id: string, updates: unknown) => Promise<Record<string, unknown>>;
        delete: (id: string) => Promise<Record<string, unknown>>;
        backtest: (config: unknown) => Promise<Record<string, unknown>>;
        startLive: (id: string) => Promise<Record<string, unknown>>;
        stopLive: (id: string) => Promise<Record<string, unknown>>;
        explain: (strategy: unknown) => Promise<Record<string, unknown>>;
        compare: (s1: unknown, s2: unknown) => Promise<Record<string, unknown>>;
        optimize: (strategyDSL: unknown, backtestResult: unknown) => Promise<Record<string, unknown>>;
      };
      nl: {
        parse: (text: string) => Promise<Record<string, unknown>>;
        templates: () => Promise<Record<string, unknown>>;
      };
      risk: {
        getConfig: () => Promise<Record<string, unknown>>;
        updateConfig: (config: unknown) => Promise<Record<string, unknown>>;
        getAlerts: () => Promise<Record<string, unknown>>;
        getStatusSnapshot: () => Promise<Record<string, unknown>>;
        getKellyStats: () => Promise<Record<string, unknown>>;
        getDrawdownState: () => Promise<Record<string, unknown>>;
        updateVix: (vix: number) => Promise<Record<string, unknown>>;
      };
      db: {
        getStrategies: () => Promise<Record<string, unknown>>;
        saveStrategy: (s: unknown) => Promise<Record<string, unknown>>;
        getSettings: () => Promise<Record<string, unknown>>;
        saveSettings: (s: unknown) => Promise<Record<string, unknown>>;
        getTrades: (strategyId?: string) => Promise<Record<string, unknown>>;
        getBacktestResults: (strategyId: string) => Promise<Record<string, unknown>>;
        getWatchlist: () => Promise<Record<string, unknown>>;
        saveWatchlist: (codes: string[]) => Promise<Record<string, unknown>>;
        getSignals: (strategyId?: string) => Promise<Record<string, unknown>>;
      };
      app: {
        getInfo: () => Promise<Record<string, unknown>>;
        getMemoryUsage: () => Promise<Record<string, unknown>>;
        checkUpdate: () => Promise<Record<string, unknown>>;
        downloadUpdate: () => Promise<Record<string, unknown>>;
        installUpdate: () => Promise<void>;
        emergencyStop: () => Promise<void>;
        openExternal: (url: string) => Promise<void>;
        getVersion: () => Promise<string>;
        getPlatform: () => Promise<string>;
      };
      stockStream: {
        connect: (config: unknown) => Promise<void>;
        disconnect: () => void;
        getQuotes: (codes: string[]) => Promise<unknown[]>;
        getStatus: () => any;
        onQuote: (cb: (data: unknown) => void) => void;
        subscribe: (symbols: string[]) => void;
        unsubscribe: () => void;
        onData: (cb: (data: unknown) => void) => void;
        removeDataListener: (cb: (data: unknown) => void) => void;
        isActive: () => boolean;
      };
      prefs: {
        get: (key: string) => Promise<Record<string, unknown>>;
        set: (key: string, value: unknown) => Promise<Record<string, unknown>>;
        getAll: () => Promise<Record<string, unknown>>;
        setSection: (section: string, data: unknown) => Promise<Record<string, unknown>>;
        reset: (...args: unknown[]) => Promise<Record<string, unknown>>;
        exportPrefs: () => Promise<Record<string, unknown>>;
        importPrefs: (...args: unknown[]) => Promise<Record<string, unknown>>;
      };
      on: (channel: string, callback: (...args: unknown[]) => void) => void;
      off?: (channel: string, callback: (...args: unknown[]) => void) => void;
    };
  }
}

function hasIPC(): boolean {
  return typeof window !== 'undefined' && !!window.api?.broker;
}

// ── Broker ─────────────────────────────────────────────────────────────────

export async function connectBroker(config?: { host?: string; port?: number }): Promise<Record<string, unknown>> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' };
  return window.api.broker.connect(config || { host: '127.0.0.1', port: 11111 });
}

export async function getKlines(code: string, period: string = 'daily', count: number = 200): Promise<unknown[]> {
  if (!hasIPC()) return generateDemoKlines(count);
  const result = await window.api.broker.getKlines(code, period, count);
  if (result?.success && result.klines?.length > 0) return result.klines;
  return generateDemoKlines(count);
}

export async function getAccounts(): Promise<unknown[]> {
  if (!hasIPC()) return [];
  const result = await window.api.broker.getAccounts();
  return result?.success ? result.accounts || [] : [];
}

export async function getFunds(accountId: string): Promise<Record<string, unknown>> {
  if (!hasIPC()) return null;
  const result = await window.api.broker.getFunds(accountId);
  return result?.success ? result.funds : null;
}

export async function getPositions(accountId: string): Promise<unknown[]> {
  if (!hasIPC()) return [];
  const result = await window.api.broker.getPositions(accountId);
  return result?.success ? result.positions || [] : [];
}

export async function getQuotes(codes: string[] = []): Promise<unknown[]> {
  if (!hasIPC()) return [];
  const result = await window.api.broker.getQuotes(codes);
  return result?.success ? result.quotes || [] : [];
}

export async function subscribeQuotes(codes: string[]): Promise<Record<string, unknown>> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' };
  return window.api.broker.subscribe(codes);
}

export async function unsubscribeQuotes(codes: string[]): Promise<Record<string, unknown>> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' };
  return window.api.broker.unsubscribe(codes);
}

export async function getWatchlist(): Promise<string[]> {
  if (!hasIPC()) return [];
  const result = await window.api.db.getWatchlist();
  return Array.isArray(result) ? result : [];
}

export async function saveWatchlist(codes: string[]): Promise<Record<string, unknown>> {
  if (!hasIPC()) return { success: false };
  return window.api.db.saveWatchlist(codes);
}

export async function calculateGreeks(params: unknown): Promise<Record<string, unknown>> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' };
  return window.api.greeks.calculate(params);
}

export async function calculatePortfolioGreeks(positions: unknown[]): Promise<Record<string, unknown>> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' };
  return window.api.greeks.portfolio(positions);
}

export async function getOrders(accountId: string): Promise<Record<string, unknown>> {
  if (!hasIPC()) return { success: false, orders: [] };
  return window.api.broker.getOrders(accountId);
}

export async function cancelOrder(orderId: string): Promise<Record<string, unknown>> {
  if (!hasIPC()) return { success: false };
  return window.api.broker.cancelOrder(orderId);
}

export async function placeOrder(order: unknown): Promise<Record<string, unknown>> {
  if (!hasIPC()) return { success: false, error: 'No IPC' };
  return window.api.broker.placeOrder(order);
}

export async function isConnected(): Promise<boolean> {
  if (!hasIPC()) return false;
  try {
    const result = await window.api.broker.getAccounts();
    return result?.success === true;
  } catch { return false; }
}

// ── Broker Manager (Sprint1: multi-broker) ───────────────────────────────

export async function listBrokers(): Promise<unknown[]> {
  if (!hasIPC()) return [];
  const result = await window.api.broker.list();
  return result?.success ? result.brokers || [] : [];
}

export async function addBroker(cfg: unknown): Promise<Record<string, unknown>> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' };
  return window.api.broker.add(cfg);
}

export async function removeBroker(id: string): Promise<Record<string, unknown>> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' };
  return window.api.broker.remove(id);
}

export async function setActiveBroker(id: string): Promise<Record<string, unknown>> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' };
  return window.api.broker.setActive(id);
}

export async function getBrokerStatus(): Promise<unknown[]> {
  if (!hasIPC()) return [];
  const result = await window.api.broker.getStatus();
  return result?.success ? result.status || [] : [];
}

// ── Strategy ───────────────────────────────────────────────────────────────

export async function createStrategy(input: unknown): Promise<Record<string, unknown>> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' };
  return window.api.strategy.create(input);
}

export async function getAllStrategies(): Promise<unknown[]> {
  if (!hasIPC()) return [];
  const result = await window.api.strategy.getAll();
  return result?.success ? result.strategies || [] : [];
}

export async function runBacktest(config: unknown): Promise<Record<string, unknown>> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' };
  return window.api.strategy.backtest(config);
}

export async function startLive(strategyId: string): Promise<Record<string, unknown>> {
  if (!hasIPC()) return { success: false };
  return window.api.strategy.startLive(strategyId);
}

export async function stopLive(strategyId: string): Promise<Record<string, unknown>> {
  if (!hasIPC()) return { success: false };
  return window.api.strategy.stopLive(strategyId);
}

// ── NL Parser ──────────────────────────────────────────────────────────────

export async function parseNL(text: string): Promise<Record<string, unknown>> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' };
  return window.api.nl.parse(text);
}

export async function getTemplates(): Promise<unknown[]> {
  if (!hasIPC()) return [];
  const result = await window.api.nl.templates();
  return result?.success ? result.templates || [] : [];
}

// ── Risk ───────────────────────────────────────────────────────────────────

export async function getRiskAlerts(): Promise<unknown[]> {
  if (!hasIPC()) return [];
  const result = await window.api.risk.getAlerts();
  return result?.success ? result.alerts || [] : [];
}

// ── App / Updater ──────────────────────────────────────────────────────────

export async function checkUpdate(): Promise<Record<string, unknown>> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' };
  return window.api.app.checkUpdate();
}

export async function downloadUpdate(): Promise<Record<string, unknown>> {
  if (!hasIPC()) return { success: false };
  return window.api.app.downloadUpdate();
}

export async function installUpdate(): Promise<void> {
  if (!hasIPC()) return;
  return window.api.app.installUpdate();
}

// ── Strategy CRUD ────────────────────────────────────────────────────────────

export async function getStrategies(): Promise<unknown[]> {
  if (!hasIPC()) return [];
  const result = await window.api.strategy.getAll();
  return result?.success ? result.strategies || [] : [];
}

export async function updateStrategy(id: string, updates: unknown): Promise<Record<string, unknown>> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' };
  return window.api.strategy.update?.(id, updates) || { success: false, error: 'Not implemented' };
}

export async function deleteStrategy(id: string): Promise<Record<string, unknown>> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' };
  return window.api.strategy.delete(id);
}

// ── Signals ─────────────────────────────────────────────────────────────────

export async function getSignals(strategyId?: string): Promise<unknown[]> {
  if (!hasIPC()) return [];
  const result = await window.api.db.getSignals(strategyId);
  return Array.isArray(result) ? result : [];
}

// ── Risk Config ─────────────────────────────────────────────────────────────

export async function getRiskConfig(): Promise<Record<string, unknown>> {
  if (!hasIPC()) return null;
  return window.api.risk.getConfig();
}

export async function updateRiskConfig(config: unknown): Promise<Record<string, unknown>> {
  if (!hasIPC()) return { success: false };
  return window.api.risk.updateConfig(config);
}

// ── Marketplace ──────────────────────────────────────────────────────────

export async function rateStrategy(strategyId: string, rating: number): Promise<Record<string, unknown>> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' };
  return window.api.marketplace.rate(strategyId, rating);
}

export async function getStrategyRating(strategyId: string): Promise<Record<string, unknown>> {
  if (!hasIPC()) return { success: false, avg: 0, count: 0, myRating: 0 };
  return window.api.marketplace.getRating(strategyId);
}

export async function addComment(strategyId: string, content: string, parentId?: number): Promise<Record<string, unknown>> {
  if (!hasIPC()) return { success: false };
  return window.api.marketplace.comment(strategyId, content, parentId);
}

export async function getComments(strategyId: string): Promise<Record<string, unknown>> {
  if (!hasIPC()) return { success: false, comments: [] };
  return window.api.marketplace.getComments(strategyId);
}

export async function savePerformance(data: unknown): Promise<Record<string, unknown>> {
  if (!hasIPC()) return { success: false };
  return window.api.marketplace.savePerformance(data);
}

export async function getPerformance(strategyId: string): Promise<Record<string, unknown>> {
  if (!hasIPC()) return { success: false, performance: [] };
  return window.api.marketplace.getPerformance(strategyId);
}

export async function getMarketplaceList(sortBy?: string, limit?: number): Promise<Record<string, unknown>> {
  if (!hasIPC()) return { success: false, strategies: [] };
  return window.api.marketplace.list(sortBy, limit);
}

export async function getStrategyScore(strategyId: string): Promise<Record<string, unknown>> {
  if (!hasIPC()) return { success: false, score: null };
  return window.api.marketplace.score(strategyId);
}

export async function verifyStrategy(strategyId: string): Promise<Record<string, unknown>> {
  if (!hasIPC()) return { success: false, verification: null };
  return window.api.marketplace.verify(strategyId);
}

export async function updateAllScores(): Promise<Record<string, unknown>> {
  if (!hasIPC()) return { success: false };
  return window.api.marketplace.updateAllScores();
}

// ── Data Provider ─────────────────────────────────────────────────────────

export async function getFundamental(symbol: string): Promise<Record<string, unknown>> {
  if (!hasIPC()) return { success: false, data: null };
  return window.api.dataProvider.getFundamental(symbol);
}

export async function getCapitalFlow(symbol: string): Promise<Record<string, unknown>> {
  if (!hasIPC()) return { success: false, data: null };
  return window.api.dataProvider.getCapitalFlow(symbol);
}

export async function getMarketRegime(): Promise<Record<string, unknown>> {
  if (!hasIPC()) return { success: false, regime: null };
  return window.api.dataProvider.getRegime();
}

export async function getAnomalies(symbol: string): Promise<Record<string, unknown>> {
  if (!hasIPC()) return { success: false, signals: [] };
  return window.api.dataProvider.getAnomalies(symbol);
}

export async function getNews(symbol: string, limit?: number): Promise<Record<string, unknown>> {
  if (!hasIPC()) return { success: false, items: [] };
  return window.api.dataProvider.getNews(symbol, limit);
}

export async function getCompositeScore(symbol: string): Promise<Record<string, unknown>> {
  if (!hasIPC()) return { success: false, result: null };
  return window.api.dataProvider.getCompositeScore(symbol);
}

export async function saveFundamentalData(data: unknown): Promise<Record<string, unknown>> {
  if (!hasIPC()) return { success: false };
  return window.api.dataProvider.saveFundamental(data);
}

export async function saveCapitalFlowData(data: unknown): Promise<Record<string, unknown>> {
  if (!hasIPC()) return { success: false };
  return window.api.dataProvider.saveCapitalFlow(data);
}

export async function saveMarketRegimeData(regime: unknown): Promise<Record<string, unknown>> {
  if (!hasIPC()) return { success: false };
  return window.api.dataProvider.saveRegime(regime);
}

export async function computeMarketRegime(factors: unknown): Promise<Record<string, unknown>> {
  if (!hasIPC()) return { success: false, regime: null };
  return window.api.dataProvider.computeRegime(factors);
}

export async function saveAnomalySignal(signal: unknown): Promise<Record<string, unknown>> {
  if (!hasIPC()) return { success: false };
  return window.api.dataProvider.saveAnomaly(signal);
}

export async function saveNewsItems(symbol: string, items: unknown[]): Promise<Record<string, unknown>> {
  if (!hasIPC()) return { success: false };
  return window.api.dataProvider.saveNews(symbol, items);
}

export async function clearDataCache(): Promise<Record<string, unknown>> {
  if (!hasIPC()) return { success: false };
  return window.api.dataProvider.clearCache();
}

// ── Backtest Enhancement (Sprint 2, merged) ──────────────────────────────

export async function multiPeriodBacktest(config: unknown): Promise<Record<string, unknown>> {
  if (!hasIPC()) return { success: false };
  return window.api.backtest.multiPeriod(config);
}

export async function parameterSweep(config: unknown): Promise<Record<string, unknown>> {
  if (!hasIPC()) return { success: false };
  return window.api.backtest.paramSweep(config);
}

export async function walkForwardAnalysis(config: unknown): Promise<Record<string, unknown>> {
  if (!hasIPC()) return { success: false };
  return window.api.backtest.walkForward(config);
}

export async function computeRiskMetrics(equityCurve: number[], riskFreeRate?: number): Promise<Record<string, unknown>> {
  if (!hasIPC()) return { success: false };
  return window.api.backtest.riskMetrics(equityCurve, riskFreeRate);
}

export async function runWalkForwardV2(config: unknown): Promise<Record<string, unknown>> {
  if (!hasIPC()) return { success: false };
  return window.api.backtest.walkForwardV2(config);
}

export async function runParamScan(config: unknown): Promise<Record<string, unknown>> {
  if (!hasIPC()) return { success: false };
  return window.api.backtest.paramScan(config);
}

export async function runMultiTimeframe(config: unknown): Promise<Record<string, unknown>> {
  if (!hasIPC()) return { success: false };
  return window.api.backtest.multiTimeframe(config);
}

// ── Market Data Stubs (UI pages import these, IPC not yet wired) ─────────
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */

export async function getStockCapitalFlowRank(..._a: unknown[]): Promise<Record<string, unknown>> { return { success: false, data: [] }; }
export async function getSectorCapitalFlowRank(..._a: unknown[]): Promise<Record<string, unknown>> { return { success: false, data: [] }; }
export async function getConceptCapitalFlowRank(..._a: unknown[]): Promise<Record<string, unknown>> { return { success: false, data: [] }; }
export async function getConsumerData(..._a: unknown[]): Promise<Record<string, unknown>> { return { success: false, data: null }; }
export async function getMarketHotspot(..._a: unknown[]): Promise<Record<string, unknown>> { return { success: false, hotspots: [] }; }
export async function getDragonTigerList(..._a: unknown[]): Promise<Record<string, unknown>> { return { success: false, list: [] }; }
export async function getDragonTigerDetail(..._a: unknown[]): Promise<Record<string, unknown>> { return { success: false, detail: null }; }
export async function getInstitutionalTrades(..._a: unknown[]): Promise<Record<string, unknown>> { return { success: false, trades: [] }; }
export async function getFundHoldings(..._a: unknown[]): Promise<Record<string, unknown>> { return { success: false, holdings: [] }; }
export async function getStockFundOwnership(..._a: unknown[]): Promise<Record<string, unknown>> { return { success: false, ownership: [] }; }
export async function getFundIncreaseRank(..._a: unknown[]): Promise<Record<string, unknown>> { return { success: false, rank: [] }; }
export async function getFundDecreaseRank(..._a: unknown[]): Promise<Record<string, unknown>> { return { success: false, rank: [] }; }
export async function getMacroDashboard(..._a: unknown[]): Promise<Record<string, unknown>> { return { success: false, dashboard: null }; }
export async function getMarginData(..._a: unknown[]): Promise<Record<string, unknown>> { return { success: false, data: null }; }
export async function getMarginBalanceRank(..._a: unknown[]): Promise<Record<string, unknown>> { return { success: false, rank: [] }; }
export async function getShortInterestRank(..._a: unknown[]): Promise<Record<string, unknown>> { return { success: false, rank: [] }; }
export async function getSectorHeatmap(..._a: unknown[]): Promise<Record<string, unknown>> { return { success: false, heatmap: [] }; }
export async function searchNews(..._a: unknown[]): Promise<Record<string, unknown>> { return { success: false, items: [] }; }
export async function getMarketMood(..._a: unknown[]): Promise<Record<string, unknown>> { return { success: false, mood: null }; }
export async function subscribeQuoteStream(..._a: unknown[]): Promise<Record<string, unknown>> { return { success: false, error: 'Not implemented' }; }
export async function unsubscribeQuoteStream(..._a: unknown[]): Promise<Record<string, unknown>> { return { success: false, error: 'Not implemented' }; }
export async function getQuoteStreamStatus(..._a: unknown[]): Promise<Record<string, unknown>> { return { success: false, status: 'disconnected' }; }
export async function analyzeSectorRotation(..._a: unknown[]): Promise<Record<string, unknown>> { return { success: false, analysis: null }; }
export async function getSmartPick(..._a: unknown[]): Promise<Record<string, unknown>> { return { success: false, picks: [] }; }
export async function diagnoseStock(..._a: unknown[]): Promise<Record<string, unknown>> { return { success: false, diagnosis: null }; }
export async function searchStocks(..._a: unknown[]): Promise<Record<string, unknown>> { return { success: false, results: [] }; }
export async function getAnomalyAlerts(..._a: unknown[]): Promise<Record<string, unknown>> { return { success: false, alerts: [] }; }
export async function getAnomalySummary(..._a: unknown[]): Promise<Record<string, unknown>> { return { success: false, summary: null }; }
export async function acknowledgeAnomalyAlert(..._a: unknown[]): Promise<Record<string, unknown>> { return { success: false }; }
export async function computeSentiment(..._a: unknown[]): Promise<Record<string, unknown>> { return { success: false, sentiment: null }; }
export async function getAISuggest(..._a: unknown[]): Promise<Record<string, unknown>> { return { success: false, suggestion: null }; }
export async function getPaperTraderStatus(..._a: unknown[]): Promise<Record<string, unknown>> { return { success: false, status: 'offline' }; }
export async function getTradeHistory(..._a: unknown[]): Promise<Record<string, unknown>> { return { success: false, trades: [] }; }

/* eslint-enable */

// ── Demo K-line Generator (fallback) ──────────────────────────────────────

function generateDemoKlines(count: number): unknown[] {
  const data: unknown[] = [];
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

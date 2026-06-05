// DAWN WHALES bridge-api

declare global {
  interface Window {
    api: {
        [key: string]: any;  // R17: allow dynamic IPC method access
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
      stockStream: any;
      sentimentIndex: any;
      stockAnomaly: any;
      prefs?: {
        getAll: () => Promise<any>;
        getSection: (section: string) => Promise<any>;
        get: (section: string, key: string) => Promise<any>;
        set: (section: string, key: string, value: any) => Promise<any>;
        setSection: (section: string, data: any) => Promise<any>;
        reset: (section?: string) => Promise<any>;
        exportPrefs: (filePath?: string) => Promise<any>;
        importPrefs: (filePath?: string) => Promise<any>;
        customSet: (key: string, value: any) => Promise<any>;
        customGet: (key: string) => Promise<any>;
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
        parallel: (config: any) => Promise<any>;
        paramScanParallel: (config: any) => Promise<any>;
        walkForwardParallel: (config: any) => Promise<any>;
      };
      monteCarlo: {
        simulate: (config: any) => Promise<any>;
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
        checkUpdate: () => Promise<any>;
        downloadUpdate: () => Promise<any>;
        installUpdate: () => Promise<void>;
        emergencyStop: () => Promise<void>;
        openExternal: (url: string) => Promise<void>;
        getVersion: () => Promise<string>;
        getPlatform: () => Promise<string>;
      };
      // DAWN WHALES bridge-api
      export?: {
        csv: (target: string, filters?: any) => Promise<any>;
        json: (target: string, filters?: any) => Promise<any>;
        md: (target: string, filters?: any) => Promise<any>;
        batch: (request: any) => Promise<any>;
        saveDialog: (options: any) => Promise<any>;
        summaryReport: () => Promise<any>;
      };
      // DAWN WHALES bridge-api
      monitor?: {
        getActive: () => Promise<any>;
        getCritical: () => Promise<any>;
        query: (q: any) => Promise<any>;
        stats: () => Promise<any>;
        acknowledge: (alertId: string) => Promise<any>;
        acknowledgeAll: (level?: string) => Promise<any>;
        resolve: (alertId: string) => Promise<any>;
        suppress: (alertId: string) => Promise<any>;
        getRules: () => Promise<any>;
        updateRule: (ruleId: string, updates: any) => Promise<any>;
      };
      // DAWN WHALES bridge-api
      on: (channel: string, callback: (...args: any[]) => void) => void;
      off?: (channel: string, callback: (...args: any[]) => void) => void;
    };
  }
}
}


function hasIPC(): boolean {
  return typeof window !== 'undefined' && !!window.api?.broker;
}

// DAWN WHALES bridge-api

export async function connectBroker(config?: { host?: string; port?: number }): Promise<any> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' };
  return window.api.broker.connect(config || { host: '127.0.0.1', port: 11111 });
}

export async function getKlines(code: string, period: string = 'daily', count: number = 200): Promise<any> {
  if (!hasIPC()) return generateDemoKlines(count);
  const result = await window.api.broker.getKlines(code, period, count);
  if (result?.success && result.klines?.length > 0) return result.klines;
  return generateDemoKlines(count);
}

export async function getAccounts(..._args: any[]): Promise<any> {
  if (!hasIPC()) return [];
  const result = await window.api.broker.getAccounts();
  return result?.success ? result.accounts || [] : [];
}

export async function getFunds(accountId: string): Promise<any> {
  if (!hasIPC()) return null;
  const result = await window.api.broker.getFunds(accountId);
  return result?.success ? result.funds : null;
}

export async function getPositions(accountId: string): Promise<any> {
  if (!hasIPC()) return [];
  const result = await window.api.broker.getPositions(accountId);
  return result?.success ? result.positions || [] : [];
}

export async function getQuotes(codes: string[] = []): Promise<any> {
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

export async function getWatchlist(..._args: any[]): Promise<string[]> {
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

// DAWN WHALES bridge-api

export async function listBrokers(): Promise<any> {
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

export async function getBrokerStatus(..._args: any[]): Promise<any> {
  if (!hasIPC()) return [];
  const result = await window.api.broker.getStatus();
  return result?.success ? result.status || [] : [];
}

// DAWN WHALES bridge-api

export async function createStrategy(input: any): Promise<any> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' };
  return window.api.strategy.create(input);
}

export async function getAllStrategies(..._args: any[]): Promise<any> {
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

// DAWN WHALES bridge-api

export async function parseNL(text: string): Promise<any> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' };
  return window.api.nl.parse(text);
}

export async function getTemplates(..._args: any[]): Promise<any> {
  if (!hasIPC()) return [];
  const result = await window.api.nl.templates();
  return result?.success ? result.templates || [] : [];
}

// DAWN WHALES bridge-api

export async function getRiskAlerts(..._args: any[]): Promise<any> {
  if (!hasIPC()) return [];
  const result = await window.api.risk.getAlerts();
  return result?.success ? result.alerts || [] : [];
}

export async function getRiskStatusSnapshot(..._args: any[]): Promise<any> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' };
  return window.api.risk.getStatusSnapshot();
}

export async function getRiskKellyStats(..._args: any[]): Promise<any> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' };
  return window.api.risk.getKellyStats();
}

export async function getRiskDrawdownState(..._args: any[]): Promise<any> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' };
  return window.api.risk.getDrawdownState();
}

// DAWN WHALES bridge-api

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

// DAWN WHALES bridge-api

export async function getStrategies(..._args: any[]): Promise<any> {
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

// DAWN WHALES bridge-api

export async function getSignals(strategyId?: string): Promise<any> {
  if (!hasIPC()) return [];
  const result = await window.api.db.getSignals(strategyId);
  return Array.isArray(result) ? result : [];
}

// DAWN WHALES bridge-api

export async function getRiskConfig(..._args: any[]): Promise<any> {
  if (!hasIPC()) return null;
  return window.api.risk.getConfig();
}

export async function updateRiskConfig(config: any): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.risk.updateConfig(config);
}

// DAWN WHALES bridge-api

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

// DAWN WHALES bridge-api

export async function getFundamental(symbol: string): Promise<any> {
  if (!hasIPC()) return { success: false, data: null };
  return window.api.dataProvider.getFundamental(symbol);
}

export async function getCapitalFlow(symbol: string): Promise<any> {
  if (!hasIPC()) return { success: false, data: null };
  return window.api.dataProvider.getCapitalFlow(symbol);
}

export async function getMarketRegime(..._args: any[]): Promise<any> {
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

// DAWN WHALES bridge-api

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

// DAWN WHALES bridge-api

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

// DAWN WHALES bridge-api

export async function exportDashboardPdf(_filename: string): Promise<any> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' };
  // TODO: Implement IPC handler in preload.ts + main.ts
  return { success: false, error: 'Not implemented' };
}

// DAWN WHALES bridge-api

export async function placeOrder(order: any): Promise<any> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' };
  return window.api.broker.placeOrder(order);
}

// DAWN WHALES bridge-api

export async function computeSentiment(params?: any): Promise<any> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' };
  return window.api.sentimentIndex.compute(params);
}

// DAWN WHALES bridge-api

export async function getAnomalySummary(..._args: any[]): Promise<any> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' };
  return window.api.stockAnomaly.getSummary();
}
export async function getAnomalyAlerts(..._args: any[]): Promise<any> {
  if (!hasIPC()) return [];
  return window.api.dataProvider.getAnomalies ? window.api.dataProvider.getAnomalies('') : [];
}
export async function acknowledgeAnomalyAlert(_id: string): Promise<boolean> {
  if (!hasIPC()) return false;
  // TODO: Implement IPC handler
  return true;
}

// DAWN WHALES bridge-api

function stubHasIpc<T>(fallback: T): T { return hasIPC() ? undefined! : fallback; }

export async function getSectorCapitalFlowRank(..._args: any[]): Promise<any> { return stubHasIpc({ success: true, data: [], items: [] }) as any; }
export async function getStockCapitalFlowRank(..._args: any[]): Promise<any> { return stubHasIpc({ success: true, data: [], items: [] }) as any; }
export async function getConceptCapitalFlowRank(..._args: any[]): Promise<any> { return stubHasIpc({ success: true, data: [], items: [] }) as any; }
export async function getConsumerData(..._args: any[]): Promise<any> { return stubHasIpc({ success: true, data: null }) as any; }
export async function getMacroDashboard(..._args: any[]): Promise<any> { return stubHasIpc({ success: true, data: null }) as any; }
export async function getMarginData(..._args: any[]): Promise<any> { return stubHasIpc({ success: true, data: null }) as any; }
export async function getMarginBalanceRank(..._args: any[]): Promise<any> { return stubHasIpc({ success: true, data: [], items: [] }) as any; }
export async function getShortInterestRank(..._args: any[]): Promise<any> { return stubHasIpc({ success: true, data: [], items: [] }) as any; }
export async function getFundHoldings(..._args: any[]): Promise<any> { return stubHasIpc({ success: true, data: null }) as any; }
export async function getStockFundOwnership(..._args: any[]): Promise<any> { return stubHasIpc({ success: true, data: null }) as any; }
export async function getFundIncreaseRank(..._args: any[]): Promise<any> { return stubHasIpc({ success: true, data: [], items: [] }) as any; }
export async function getFundDecreaseRank(..._args: any[]): Promise<any> { return stubHasIpc({ success: true, data: [], items: [] }) as any; }
export async function getDragonTigerList(..._args: any[]): Promise<any> { return stubHasIpc({ success: true, data: [], items: [] }) as any; }
export async function getDragonTigerDetail(..._args: any[]): Promise<any> { return stubHasIpc({ success: true, data: null }) as any; }
export async function getInstitutionalTrades(..._args: any[]): Promise<any> { return stubHasIpc({ success: true, data: [], items: [] }) as any; }
export async function getSectorHeatmap(..._args: any[]): Promise<any> { return stubHasIpc({ success: true, data: null }) as any; }
export async function getMarketHotspot(..._args: any[]): Promise<any> { return stubHasIpc({ success: true, data: [], items: [] }) as any; }
export async function getMarketMood(..._args: any[]): Promise<any> { return stubHasIpc({ success: true, data: null }) as any; }
export async function getAISuggest(..._args: any[]): Promise<any> { return stubHasIpc({ success: true, data: null }) as any; }
export async function getSmartPick(..._args: any[]): Promise<any> { return stubHasIpc({ success: true, data: [], items: [] }) as any; }
export async function getTradeHistory(..._args: any[]): Promise<any> { return stubHasIpc({ success: true, data: [], items: [] }) as any; }
export async function searchStocks(..._args: any[]): Promise<any> { return stubHasIpc({ success: true, data: [], items: [] }) as any; }
export async function searchNews(..._args: any[]): Promise<any> { return stubHasIpc({ success: true, data: [], items: [] }) as any; }
export async function analyzeSectorRotation(..._args: any[]): Promise<any> { return stubHasIpc({ success: true, data: null }) as any; }
export async function diagnoseStock(..._args: any[]): Promise<any> { return stubHasIpc({ success: true, data: null }) as any; }
export async function getPaperTraderStatus(..._args: any[]): Promise<any> { return stubHasIpc({ success: true, data: null }) as any; }
export async function getQuoteStreamStatus(..._args: any[]): Promise<any> { return stubHasIpc({ success: true, data: null }) as any; }

// R17 additional stubs
export async function subscribeQuoteStream(_symbol: string): Promise<any> { return { success: true }; }
export async function unsubscribeQuoteStream(_symbol: string): Promise<any> { return { success: true }; }

// ── R18: Dashboard & Portfolio IPC stubs ──────────────────────────────────

export async function getDashboardSummary(): Promise<any> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' };
  return window.api.dashboard.getSummary();
}

export async function getDashboardPnl(days?: number): Promise<any> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' };
  return window.api.dashboard.getPnl({ days });
}

export async function getDashboardPositions(): Promise<any> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' };
  return window.api.dashboard.getPositions();
}

export async function getDashboardHealth(): Promise<any> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' };
  return window.api.dashboard.getHealth();
}

export async function getPortfolioAllocation(): Promise<any> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' };
  return window.api.portfolio.getAllocation();
}

export async function getPortfolioPerformance(days?: number): Promise<any> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' };
  return window.api.portfolio.getPerformance({ days });
}

export async function getPortfolioRiskMetrics(): Promise<any> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' };
  return window.api.portfolio.getRiskMetrics();
}

export async function getPortfolioRebalance(): Promise<any> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' };
  return window.api.portfolio.getRebalance();
}

export async function runMonteCarloSimulation(config: any): Promise<any> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' };
  return window.api.monteCarlo.simulate(config);
}

// ── R20: Monitor (AlertCenter) IPC stubs ──────────────────────────────────
export async function getActiveAlerts(): Promise<any> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' };
  return window.api.monitor.getActive();
}
export async function getCriticalAlerts(): Promise<any> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' };
  return window.api.monitor.getCritical();
}
export async function queryAlerts(query: any): Promise<any> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' };
  return window.api.monitor.query(query);
}
export async function getAlertStats(): Promise<any> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' };
  return window.api.monitor.stats();
}
export async function acknowledgeAlert(alertId: string): Promise<any> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' };
  return window.api.monitor.acknowledge(alertId);
}
export async function acknowledgeAllAlerts(level?: string): Promise<any> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' };
  return window.api.monitor.acknowledgeAll(level);
}
export async function resolveAlert(alertId: string): Promise<any> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' };
  return window.api.monitor.resolve(alertId);
}
export async function suppressAlert(alertId: string): Promise<any> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' };
  return window.api.monitor.suppress(alertId);
}
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
        multiFactor: (request: { stocks: Array<{ code: string; name: string }>; preset?: string; limit?: number }) => Promise<any>;
        liveStart: (symbols?: string[]) => Promise<any>;
        liveStop: () => Promise<any>;
        liveAddStrategy: (config: any) => Promise<any>;
        liveRemoveStrategy: (strategyId: string) => Promise<any>;
        liveGetStatus: () => Promise<any>;
        liveGetPositions: () => Promise<any>;
        liveGetOrders: () => Promise<any>;
      };
      notification: {
        generate: (ctx: any) => Promise<any>;
        summary: (alerts: any[], apiKey?: string) => Promise<any>;
      };
      // Q14: Live Executor
      live: {
        start: (symbols?: string[]) => Promise<any>;
        stop: () => Promise<any>;
        addStrategy: (config: { strategyId: string; symbol: string; signalType?: string; price?: number; quantity?: number; stopLoss?: number; takeProfit?: number }) => Promise<any>;
        removeStrategy: (strategyId: string) => Promise<any>;
        getStatus: () => Promise<any>;
        getPositions: () => Promise<any>;
        getOrders: () => Promise<any>;
      };
      report: {
        generate: (ctx: { results: any[]; symbol?: string; apiKey?: string; timeoutMs?: number }) => Promise<any>;
        quick: (ctx: { result: any; apiKey?: string }) => Promise<any>;
      };
      regime: {
        detect: (klines: { close: number[]; high: number[]; low: number[]; open: number[] }, vixLevel?: number, symbol?: string) => Promise<any>;
      };
      // Q63: Signal Quality Scorer
      signalQuality: {
        score: (params: { signalType: string; marketContext?: any; backtestHistory?: any[]; signalParams?: any }) => Promise<any>;
      };
      // Q64: Backtest Stability
      backtestStability: (params: {
        isReturns: number[]; oosReturns: number[]; paramGridResults?: any[];
        walkForwardResults?: any[]; isPeriodDays?: number; oosPeriodDays?: number; tradingDays?: number;
      }) => Promise<any>;
      // Q68: Position Alert
      positionAlert: {
        check: (positions: any[], accountFunds: number, config?: any) => Promise<any>;
      };
      anomaly: {
        detect: (values: number[], method?: 'zscore' | 'iqr' | 'moving', window?: number, threshold?: number) => Promise<any>;
      };
      autoTune: {
        tune: (ctx: { strategyType: string; ranges: any[]; klines: any[]; method?: 'ga' | 'bayesian' | 'both'; populationSize?: number; generations?: number; iterations?: number }) => Promise<any>;
      };
      // Q15: Multi-Factor Model
      multiFactor: {
        score: (stocks?: any[], factorWeights?: any) => Promise<any>;
        screen: (stocks: any[], criteria?: any, factorWeights?: any) => Promise<any>;
        screenBatch: (batches: any[]) => Promise<any>;
      };
      // Q16: Dynamic Position Sizer
      positionSize: {
        calc: (req: any) => Promise<any>;
        portfolio: (req: any) => Promise<any>;
      };
      // Q17: Paper Trader
      paper: {
        start: () => Promise<any>;
        stop: () => Promise<any>;
        reset: () => Promise<any>;
        report: () => Promise<any>;
        status: () => Promise<any>;
        executeSignal: (signal: any) => Promise<any>;
      };
      // Q18: Strategy Templates
      templates: {
        list: () => Promise<any>;
        get: (id: string) => Promise<any>;
        category: (cat: string) => Promise<any>;
        search: (query: string) => Promise<any>;
        instantiate: (id: string, overrides?: any) => Promise<any>;
      };
      // Q19: OpenD Health Check
      system: {
        opendHealth: (req?: any) => Promise<any>;
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
        // Q16: Dynamic Position Sizing
        calculateSize: (request: any) => Promise<any>;
        calculatePortfolioSizes: (request: any) => Promise<any>;
        'calculate-portfolio-sizes': (request: any) => Promise<any>;
        recordTrade: (trade: any) => Promise<any>;
        'record-trade': (trade: any) => Promise<any>;
        getTradeHistory: (strategyId?: string) => Promise<any>;
        'get-trade-history': (strategyId?: string) => Promise<any>;
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
      // Q22/Q54/Q56: Portfolio Rebalancer / RAR / Cost Analytics
      portfolioOptimizer: {
        optimize: (assets: any[], constraints?: any) => Promise<any>;
        efficientFrontier: (assets: any[], points?: number, constraints?: any) => Promise<any>;
        riskParity: (assets: any[], constraints?: any) => Promise<any>;
        optimizeBatch: (scenarios: any[]) => Promise<any>;
        rebalance: (positions: any[], targetWeights: Record<string, number>, dryRun?: boolean, driftThreshold?: number, maxTurnover?: number) => Promise<any>;
        rebalanceKelly: (positions: any[], kellyFraction?: number, maxTurnover?: number) => Promise<any>;
        costAnalyze: (positions: any[], trades: any[], periodDays?: number) => Promise<any>;
        rarOptimize: (positions: any[], marketData?: any, riskAppetite?: string, constraints?: any) => Promise<any>;
      };
      // Q20: Real Trader
      realTrader: {
        execute: (signal: any, paperMode?: boolean) => Promise<any>;
        getStatus: () => Promise<any>;
      };
      // Q29: Execution Analytics
      executionAnalytics: {
        analyze: (params: { executionRecords: any[]; marketData?: any; benchmarkPrice?: number; optionsScope?: any }) => Promise<any>;
      };
      // Q55: Options Strategy Builder
      optionsBuilder: {
        build: (params: { underlying: string; spotPrice: number; strategyType?: string; targetParams?: any; legs?: any[] }) => Promise<any>;
        analyze: (params: { strategy: any; spotPrice: number; volatility?: number; riskFreeRate?: number; dividends?: any }) => Promise<any>;
      };
      optionsChain: {
        analyze: (contracts: any[], symbol: string, historicalIVRange?: any) => Promise<any>;
        analyzeBatch: (symbols: any[]) => Promise<any>;
      };
      on: (channel: string, callback: (...args: any[]) => void) => void;
      off?: (channel: string, callback: (...args: any[]) => void) => void;
      [key: string]: any;
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

export async function placeOrder(order: any): Promise<any> {
  if (!hasIPC()) return { success: false };
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

// ── Q14: Live Executor ──────────────────────────────────────────────

export interface LiveStrategyConfig {
  strategyId: string;
  symbol: string;
  signalType?: 'BUY' | 'SELL' | 'CLOSE';
  price?: number;
  quantity?: number;
  stopLoss?: number;
  takeProfit?: number;
}

export interface LiveOrder {
  id: string;
  strategyId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT';
  quantity: number;
  price?: number;
  status: 'pending' | 'submitted' | 'filled' | 'partial' | 'cancelled' | 'rejected';
  filledQty: number;
  avgFillPrice?: number;
  createdAt: number;
  updatedAt: number;
  signalReason: string;
}

export interface LivePosition {
  strategyId: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  quantity: number;
  avgCost: number;
  unrealizedPnL: number;
  unrealizedPnLPct: number;
  entryTime: number;
  stopLoss?: number;
  takeProfit?: number;
}

export interface ExecutorStatus {
  isRunning: boolean;
  strategiesCount: number;
  positionsCount: number;
  ordersCount: number;
  totalPnL: number;
  lastUpdate: number;
}

export async function liveStart(symbols?: string[]): Promise<{ success: boolean; status?: ExecutorStatus; error?: string }> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' };
  return window.api.strategy.liveStart(symbols);
}

export async function liveStop(): Promise<{ success: boolean }> {
  if (!hasIPC()) return { success: false };
  return window.api.strategy.liveStop();
}

export async function liveAddStrategy(config: LiveStrategyConfig): Promise<{ success: boolean; error?: string }> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' };
  return window.api.strategy.liveAddStrategy(config);
}

export async function liveRemoveStrategy(strategyId: string): Promise<{ success: boolean }> {
  if (!hasIPC()) return { success: false };
  return window.api.strategy.liveRemoveStrategy(strategyId);
}

export async function liveGetStatus(): Promise<{ success: boolean; status: ExecutorStatus | null }> {
  if (!hasIPC()) return { success: true, status: null };
  return window.api.strategy.liveGetStatus();
}

export async function liveGetPositions(): Promise<{ success: boolean; positions: LivePosition[] }> {
  if (!hasIPC()) return { success: true, positions: [] };
  return window.api.strategy.liveGetPositions();
}

export async function liveGetOrders(): Promise<{ success: boolean; orders: LiveOrder[] }> {
  if (!hasIPC()) return { success: true, orders: [] };
  return window.api.strategy.liveGetOrders();
}

// ── JVS-47: OpenD Connection Validator ──────────────────────────────────
export async function opendValidate(): Promise<{ success: boolean; result?: any }> {
  if (!hasIPC()) return { success: false };
  return window.api.opendValidate();
}

export async function opendGetStatus(): Promise<{ success: boolean; status?: any }> {
  if (!hasIPC()) return { success: false };
  return window.api.opendGetStatus();
}

// ── JVS-46: Strategy Signal Generator ──────────────────────────────────
export async function signalGenerate(config: any): Promise<{ success: boolean; signal?: any }> {
  if (!hasIPC()) return { success: false };
  return window.api.signalGenerate(config);
}

export async function signalGenerateBatch(configs: any[]): Promise<{ success: boolean; signals?: any[] }> {
  if (!hasIPC()) return { success: false };
  return window.api.signalGenerateBatch(configs);
}

export async function signalValidateBacktest(config: any): Promise<{ success: boolean; result?: any }> {
  if (!hasIPC()) return { success: false };
  return window.api.signalValidateBacktest(config);
}

// ── Q15: Multi-Factor Model ──────────────────────────────────
export async function multiFactorScore(request: {
  stocks: Array<{ code: string; name: string }>;
  preset?: string;
  limit?: number;
}): Promise<any> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' };
  return window.api.strategy.multiFactor(request);
}

// ── Q16: Dynamic Position Sizing ──────────────────────────
export async function calculatePositionSize(request: any): Promise<any> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' };
  return window.api.risk['calculateSize'](request);
}

export async function calculatePortfolioSizes(request: any): Promise<any> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' };
  return window.api.risk['calculate-portfolio-sizes'](request);
}

export async function recordTrade(trade: any): Promise<any> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' };
  return window.api.risk['record-trade'](trade);
}

export async function getTradeHistory(strategyId?: string): Promise<any> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' };
  return window.api.risk['get-trade-history'](strategyId);
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

export async function subscribeQuoteStream(symbols: string[]): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.quoteStream.subscribe(symbols);
}

export async function unsubscribeQuoteStream(symbols: string[]): Promise<any> {
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

// ── Portfolio Risk — 组合风险计算器 (JVS-15) ──────────────────────────────

export async function calculatePortfolioRisk(request: {
  positions: Array<{
    code: string;
    name: string;
    shares: number;
    avgCost: number;
    currentPrice: number;
    weight?: number;
    sector?: string;
  }>;
  riskFreeRate?: number;
  benchmarkCode?: string;
  includeConcentration?: boolean;
  includeCorrelation?: boolean;
  includeSentiment?: boolean;
}): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.portfolioRisk.calculate(request);
}

// ── Market Breadth — 市场广度分析器 (JVS-16) ──────────────────────────────

export async function getMarketBreadth(): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.marketBreadth.get();
}

// ── Consumer Data — 消费者数据服务 (JVS-17) ────────────────────────────────

export async function getConsumerData(months?: number): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.consumerData.get(months);
}

// ── Margin Data — 融资融券数据服务 (JVS-18) ────────────────────────────────

export async function getMarginData(): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.marginData.get();
}

export async function getStockMargin(code: string, days?: number): Promise<any> {
  if (!hasIPC()) return { success: false, data: [] };
  return window.api.marginData.getStockMargin(code, days);
}

export async function getMarginBalanceRank(limit?: number): Promise<any> {
  if (!hasIPC()) return { success: false, data: [] };
  return window.api.marginData.getMarginBalanceRank(limit);
}

export async function getShortInterestRank(limit?: number): Promise<any> {
  if (!hasIPC()) return { success: false, data: [] };
  return window.api.marginData.getShortInterestRank(limit);
}

// ── EMI Unified Service Layer (JVS-19) ─────────────────────────────────────

export async function getStockOverview(code: string): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.emiUnified.getStockOverview(code);
}

export async function getMarketOverview(): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.emiUnified.getMarketOverview();
}

export async function getDailyReport(): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.emiUnified.getDailyReport();
}

// ── Python Script Proxy Layer (JVS-20) ─────────────────────────────────────

export async function callPythonSkill(skillName: string, query: string, options?: { selectType?: string; noSave?: boolean }): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.pythonProxy.callSkill(skillName, query, options);
}

export async function listPythonSkills(): Promise<any> {
  if (!hasIPC()) return { success: false, skills: [] };
  return window.api.pythonProxy.listSkills();
}

export async function getPythonProxyStatus(): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.pythonProxy.getStatus();
}

// ── Push2 Proxy Service (JVS-27) ──────────────────────────────────────────

export async function push2GetSectorHeatmap(type?: string, limit?: number): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.push2Proxy.getSectorHeatmap(type, limit);
}

export async function push2GetCapitalFlowRank(type?: string, limit?: number): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.push2Proxy.getCapitalFlowRank(type, limit);
}

export async function push2GetStockQuote(secid: string): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.push2Proxy.getStockQuote(secid);
}

export async function push2GetMarketBreadth(): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.push2Proxy.getMarketBreadth();
}

export async function push2GetProxyStatus(): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.push2Proxy.getStatus();
}

export async function push2ClearCache(): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.push2Proxy.clearCache();
}

// ── Data Quality Monitor (JVS-22) ────────────────────────────────────────

export async function runDataQualityCheck(): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.dataQuality.runCheck();
}

export async function getDataQualityReport(): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.dataQuality.getReport();
}

export async function acknowledgeDataQualityAlert(alertIndex: number): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.dataQuality.acknowledgeAlert(alertIndex);
}

export async function clearAcknowledgedDataQualityAlerts(): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.dataQuality.clearAcknowledged();
}

export async function startDataQualityPeriodicCheck(intervalMs?: number): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.dataQuality.startPeriodic(intervalMs);
}

export async function stopDataQualityPeriodicCheck(): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.dataQuality.stopPeriodic();
}

// ── Data Quality Stream Monitor (JVS-31) ──────────────────────────────────

export async function startDataQualityStream(): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.dataQualityStream.start();
}

export async function stopDataQualityStream(): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.dataQualityStream.stop();
}

export async function getDataQualityStreamStatus(): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.dataQualityStream.status();
}

export async function clearDataQualityStreamAlerts(): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.dataQualityStream.clearAlerts();
}

export async function resetDataQualityStreamMetrics(): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.dataQualityStream.resetMetrics();
}

export function onDataQualityStreamAlert(callback: (alert: any) => void): void {
  if (!hasIPC()) return;
  window.api.dataQualityStream.onAlert(callback);
}

// ── Realtime Sentiment Stream (JVS-33) ─────────────────────────────────────

export async function startSentimentStream(): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.sentimentStream.start();
}

export async function stopSentimentStream(): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.sentimentStream.stop();
}

export async function getSentimentStreamStatus(): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.sentimentStream.status();
}

export async function getSentimentStreamHistory(limit?: number): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.sentimentStream.history(limit);
}

export async function getSentimentStreamAlerts(): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.sentimentStream.alerts();
}

export async function clearSentimentStreamAlerts(): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.sentimentStream.clearAlerts();
}

export function onSentimentStreamTick(callback: (tick: any) => void): void {
  if (!hasIPC()) return;
  window.api.sentimentStream.onTick(callback);
}

export function onSentimentStreamAlert(callback: (alert: any) => void): void {
  if (!hasIPC()) return;
  window.api.sentimentStream.onAlert(callback);
}

// ── Data Quality Dashboard (JVS-34) ─────────────────────────────────────────

export async function getDataQualityDashboard(): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.dataQualityDashboard.get();
}

// ── Cache Explorer (JVS-35) ────────────────────────────────────────────────

export async function exploreCache(): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.cacheExplorer.explore();
}

export async function getCacheEntryDetail(namespace: string, key: string): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.cacheExplorer.entryDetail(namespace, key);
}

export async function getCacheKeysPaginated(namespace: string, limit?: number, offset?: number): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.cacheExplorer.keysPaginated(namespace, limit, offset);
}

// ── Sentiment Dashboard (JVS-36) ───────────────────────────────────────────

export async function getSentimentDashboard(): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.sentimentDashboard.get();
}

// ── Data Export Service (JVS-37) ───────────────────────────────────────────

export async function exportData(request: any): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.dataExport.export(request);
}

export async function getExportModules(): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.dataExport.getModules();
}

// ── Rate Limiter (JVS-38) ──────────────────────────────────────────────────

export async function getRateLimiterStats(apiName?: string): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.rateLimiter.stats(apiName);
}

export async function resetRateLimiter(): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.rateLimiter.reset();
}

export async function getRateLimiterAPIs(): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.rateLimiter.getAPIs();
}

// ── Circuit Breaker (JVS-86) ──────────────────────────────────────────────

export async function getCircuitBreakerState(endpoint: string): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.circuitBreaker.getState(endpoint);
}

export async function getCircuitBreakerMetrics(): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.circuitBreaker.getMetrics();
}

export async function resetCircuitBreaker(endpoint?: string): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.circuitBreaker.reset(endpoint);
}

export async function openCircuitBreaker(endpoint: string): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.circuitBreaker.open(endpoint);
}

export async function closeCircuitBreaker(endpoint: string): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.circuitBreaker.close(endpoint);
}

// ── Health Dashboard (JVS-87) ─────────────────────────────────────────────

export async function getHealthDashboardStatus(): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.healthDashboard.status();
}

export async function getHealthDashboardAlerts(): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.healthDashboard.alerts();
}

export async function acknowledgeHealthAlert(alertId: string): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.healthDashboard.acknowledge(alertId);
}

export async function startHealthDashboard(): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.healthDashboard.start();
}

export async function stopHealthDashboard(): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.healthDashboard.stop();
}

// ── Anomaly Detection (JVS-89) ────────────────────────────────────────────

export async function detectAnomalies(symbol: string, data: any): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.anomalyDetection.detect(symbol, data);
}

export async function getAnomalyAlerts(): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.anomalyDetection.getAlerts();
}

export async function getAnomaliesBySymbol(symbol: string): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.anomalyDetection.getBySymbol(symbol);
}

export async function getAnomaliesByType(type: string): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.anomalyDetection.getByType(type);
}

export async function acknowledgeAnomaly(alertId: string): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.anomalyDetection.acknowledge(alertId);
}

export async function clearAnomalies(): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.anomalyDetection.clear();
}

export async function startAnomalyDetection(): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.anomalyDetection.start();
}

export async function stopAnomalyDetection(): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.anomalyDetection.stop();
}

export async function getAnomalyStats(): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.anomalyDetection.stats();
}

// ── Risk Management (JVS-90) ──────────────────────────────────────────────

export async function calculateRiskMetrics(returns: number[], benchmarkReturns?: number[]): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.riskManagement.calculateMetrics(returns, benchmarkReturns);
}

export async function calculateCorrelationMatrix(symbols: string[], returns: Record<string, number[]>): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.riskManagement.correlationMatrix(symbols, returns);
}

export async function getRiskAlerts(): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.riskManagement.getAlerts();
}

export async function acknowledgeRiskAlert(alertId: string): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.riskManagement.acknowledgeAlert(alertId);
}

export async function clearRiskAlerts(): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.riskManagement.clearAlerts();
}

export async function startRiskManagement(): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.riskManagement.start();
}

export async function stopRiskManagement(): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.riskManagement.stop();
}

export async function getRiskSummary(): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.riskManagement.summary();
}

// ── Data Consistency Checker (JVS-39) ──────────────────────────────────────

export async function runDataConsistencyCheck(): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.dataConsistency.check();
}

export async function getDataConsistencyRules(): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.dataConsistency.getRules();
}

// ── Smart Cache Manager (JVS-32) ──────────────────────────────────────────

export async function cacheGet(namespace: string, key: string): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.smartCache.get(namespace, key);
}

export async function cacheSet(namespace: string, key: string, value: any, ttl?: number): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.smartCache.set(namespace, key, value, ttl);
}

export async function cacheHas(namespace: string, key: string): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.smartCache.has(namespace, key);
}

export async function cacheDelete(namespace: string, key: string): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.smartCache.delete(namespace, key);
}

export async function cacheClear(namespace?: string): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.smartCache.clear(namespace);
}

export async function cacheStats(namespace?: string): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.smartCache.stats(namespace);
}

export async function cacheResetStats(namespace?: string): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.smartCache.resetStats(namespace);
}

export async function cacheKeys(namespace: string): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.smartCache.keys(namespace);
}

// ── Dragon Tiger Stream (JVS-22 PM) ────────────────────────────────────────

export async function startDragonTigerStream(): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.dragonTigerStream.start();
}

export async function stopDragonTigerStream(): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.dragonTigerStream.stop();
}

export async function fetchDragonTigerStreamNow(): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.dragonTigerStream.fetchNow();
}

export async function getDragonTigerStreamStatus(): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.dragonTigerStream.status();
}

export function onDragonTigerUpdate(callback: (event: any) => void): void {
  if (!hasIPC()) return;
  window.api.on('dragon-tiger:update', callback);
}

// ── Unlock Calendar (JVS-23 PM) ────────────────────────────────────────────

export async function getUnlockCalendar(days?: number): Promise<any> {
  if (!hasIPC()) return { success: false, events: [] };
  return window.api.unlockCalendar.get(days);
}

// ── Dividend Calendar (JVS-24 PM) ──────────────────────────────────────────

export async function getDividendCalendar(days?: number): Promise<any> {
  if (!hasIPC()) return { success: false, events: [] };
  return window.api.dividendCalendar.get(days);
}

// ── Earnings Calendar (JVS-25 PM) ──────────────────────────────────────────

export async function getEarningsCalendar(days?: number): Promise<any> {
  if (!hasIPC()) return { success: false, events: [] };
  return window.api.earningsCalendar.get(days);
}

// ── Data Exporter (JVS-26 PM) ──────────────────────────────────────────────

export async function exportJVSData(type: string, format?: string): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.dataExporter.export(type, format);
}

// ── Smart Picker (JVS-25 PM Round 2) ───────────────────────────────────────

export async function smartPick(request?: {
  market?: string;
  limit?: number;
  minScore?: number;
  weights?: Record<string, number>;
}): Promise<any> {
  if (!hasIPC()) return { success: false, picks: [] };
  return window.api.smartPicker.pick(request);
}

// ── WS Data Stream (JVS-29) ────────────────────────────────────────────────

export async function wsStartStream(config?: any): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.wsStream.start(config);
}

export async function wsStopStream(): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.wsStream.stop();
}

export async function wsSubscribe(codes: string[]): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.wsStream.subscribe(codes);
}

export async function wsUnsubscribe(codes: string[]): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.wsStream.unsubscribe(codes);
}

export async function wsStreamStatus(): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.wsStream.status();
}

export function onWSTick(callback: (tick: any) => void): void {
  if (!hasIPC()) return;
  window.api.on('ws:tick', callback);
}

// ── History Backfill (JVS-30) ──────────────────────────────────────────────

export async function startHistoryBackfill(config?: any): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.historyBackfill.start(config);
}

export async function getHistoryBackfillStatus(): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.historyBackfill.status();
}

export async function getHistoryBackfillData(module: string): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.historyBackfill.data(module);
}

export async function listHistoryBackfillFiles(): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.historyBackfill.list();
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

// ── W41: Smart Picker ─────────────────────────────────────────────────────

export async function getSmartPick(): Promise<any> {
  if (!hasIPC()) return { success: false, data: [] };
  return window.api.smartPicker?.getTopPicks?.() || { success: false, error: 'Not implemented' };
}

// ── W43: AI Advisor ───────────────────────────────────────────────────────

export async function getAISuggest(): Promise<any> {
  if (!hasIPC()) return { success: false, data: null };
  return window.api.aiAdvisor?.suggest?.() || { success: false, error: 'Not implemented' };
}

// ── i18n Data Layer (JVS-40) ───────────────────────────────────────────────

export async function translateField(field: string, category: string, lang: string): Promise<any> {
  if (!hasIPC()) return { success: false, translation: field };
  return window.api.i18n.translateField(field, category, lang);
}

export async function translateFields(fields: string[], category: string, lang: string): Promise<any> {
  if (!hasIPC()) return { success: false, translations: fields };
  return window.api.i18n.translateFields(fields, category, lang);
}

export async function getAllTranslations(category: string): Promise<any> {
  if (!hasIPC()) return { success: false, translations: {} };
  return window.api.i18n.getAllTranslations(category);
}

export async function getSupportedLanguages(): Promise<any> {
  if (!hasIPC()) return { success: false, languages: [] };
  return window.api.i18n.getSupportedLanguages();
}

// ── Financial Reports (JVS-41) ──────────────────────────────────────────────
export async function getFinancialReports(code: string, quarters?: number): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.financialReports.get(code, quarters);
}

// ── Valuation Data (JVS-42) ────────────────────────────────────────────────
export async function getValuationData(code: string, historyDays?: number): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.valuation.get(code, historyDays);
}

// ── Technical Indicators (JVS-43) ──────────────────────────────────────────
export async function computeTechnicalIndicators(
  klines: any[],
  indicators?: string[],
  options?: any
): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.indicators.compute(klines, indicators, options);
}

// ── Options Pricing Engine (JVS-44) ────────────────────────────────────────
export async function priceOption(params: any): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.optionsPricing.priceOption(params);
}

export async function calcGreeks(params: any): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.optionsPricing.calcGreeks(params);
}

export async function calcImpliedVol(
  marketPrice: number,
  underlyingPrice: number,
  strikePrice: number,
  timeToExpiry: number,
  riskFreeRate: number,
  optionType: string,
  dividendYield?: number
): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.optionsPricing.impliedVol(marketPrice, underlyingPrice, strikePrice, timeToExpiry, riskFreeRate, optionType, dividendYield);
}

export async function buildVolatilitySurface(
  underlyingPrice: number,
  riskFreeRate: number,
  strikes: number[],
  expiries: number[],
  callPrices: number[][],
  putPrices?: number[][]
): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.optionsPricing.volSurface(underlyingPrice, riskFreeRate, strikes, expiries, callPrices, putPrices);
}

export async function priceOptionAndGreeks(params: any): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.optionsPricing.priceAndGreeks(params);
}

// ── Risk Metrics Calculator (JVS-46) ───────────────────────────────────────
export async function calculateRiskMetrics(params: {
  returns: number[];
  riskFreeRate?: number;
  benchmarkReturns?: number[];
  tradingDaysPerYear?: number;
  monteCarloSims?: number;
}): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.riskMetrics.calculate(params);
}

export async function calculateSharpeRatio(
  returns: number[],
  riskFreeRate?: number,
  tradingDays?: number
): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.riskMetrics.calcSharpe(returns, riskFreeRate, tradingDays);
}

export async function calculateMaxDrawdown(returns: number[]): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.riskMetrics.calcMaxDrawdown(returns);
}

export async function calculateVaR(returns: number[], confidence?: number): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.riskMetrics.calcVaR(returns, confidence);
}

// ── Performance Attribution (JVS-45) ───────────────────────────────────────
export async function brinsonAttribution(params: {
  portfolio: { sector: string; weight: number; returnPct: number }[];
  benchmark: { sector: string; weight: number; returnPct: number }[];
}): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.performanceAttribution.brinson(params);
}

export async function timeSeriesAttribution(params: {
  periods: {
    date: string;
    portfolio: { sector: string; weight: number; returnPct: number }[];
    benchmark: { sector: string; weight: number; returnPct: number }[];
  }[];
}): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.performanceAttribution.timeSeries(params);
}

// ── Correlation Matrix v2 (JVS-47) ─────────────────────────────────────────
export async function computeCorrelationMatrix(params: {
  returns: Record<string, number[]>;
  method?: 'pearson' | 'spearman';
}): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.correlationMatrix.compute(params);
}

// ── Sector Rotation v2 (JVS-48) ────────────────────────────────────────────
export async function detectSectorRotation(params: {
  currentPeriod: { sector: string; netInflow: number; changePct: number; volume: number; date: string }[];
  previousPeriod: { sector: string; netInflow: number; changePct: number; volume: number; date: string }[];
  lookbackPeriods?: number;
  history?: { sector: string; netInflow: number; changePct: number; volume: number; date: string }[][];
}): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.sectorRotationV2.detect(params);
}

// ── Valuation Dashboard (JVS-49) ───────────────────────────────────────────
export async function getValuationDashboard(codes: string[], historyDays?: number): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.valuationDashboard.get(codes, historyDays);
}

export async function getValuationDashboardBatch(codes: string[], batchSize?: number, delayMs?: number): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.valuationDashboard.batch(codes, batchSize, delayMs);
}

// ── Sector Comparison (JVS-50) ─────────────────────────────────────────────
export async function compareSectorStocks(stocks: any[], financialData: any): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.sectorComparison.compare(stocks, financialData);
}

export async function compareMultipleSectors(sectors: any[], financialData: any): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.sectorComparison.compareMultiple(sectors, financialData);
}

export async function rankSectorStocks(metrics: any[], weights?: any): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.sectorComparison.rank(metrics, weights);
}

// ── Macro Alert (JVS-51) ─────────────────────────────────────────────────
export async function detectMacroAnomalies(currentData: any[], historicalData: any): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.macroAlert.detect(currentData, historicalData);
}

export async function detectMultipleMacroAnomalies(indicatorData: any[]): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.macroAlert.detectMultiple(indicatorData);
}

// ── Correlation Alert (JVS-52) ─────────────────────────────────────────────
export async function detectCorrelationAnomalies(snapshots: any[], historicalData: any): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.correlationAlert.detect(snapshots, historicalData);
}

export async function detectCorrelationMatrix(matrix: number[][], codes: string[], prevMatrix?: number[][], histMatrices?: any): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.correlationAlert.detectMatrix(matrix, codes, prevMatrix, histMatrices);
}

// ── Walk-Forward Report (JVS-53) ──────────────────────────────────────────
export async function generateWalkForwardReport(strategyName: string, windows: any[]): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.walkForwardReport.generate(strategyName, windows);
}

export async function generateBatchWalkForwardReport(strategies: any[]): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.walkForwardReport.generateBatch(strategies);
}

// ── Brinson Attribution (JVS-54) ──────────────────────────────────────────
export async function generateBrinsonReport(holdings: any[], benchmark: any[], benchmarkReturn: number): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.brinsonAttribution.generate(holdings, benchmark, benchmarkReturn);
}

export async function generateBatchBrinsonReport(portfolios: any[]): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.brinsonAttribution.generateBatch(portfolios);
}

// ── Options Chain Analyzer (JVS-55) ──────────────────────────────────────
export async function analyzeOptionsChain(contracts: any[], symbol: string, historicalIVRange?: any): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.optionsChain.analyze(contracts, symbol, historicalIVRange);
}

export async function analyzeBatchOptionsChain(symbols: any[]): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.optionsChain.analyzeBatch(symbols);
}

// ── Multi-Factor Selector (JVS-56) ────────────────────────────────────────
export async function scoreStocks(stocks: any[], factorWeights?: any): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.multiFactor.score(stocks, factorWeights);
}

export async function screenStocks(stocks: any[], criteria: any, factorWeights?: any): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.multiFactor.screen(stocks, criteria, factorWeights);
}

export async function batchScreenStocks(batches: any[]): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.multiFactor.screenBatch(batches);
}

// ── Portfolio Optimizer (JVS-57) ──────────────────────────────────────────
export async function optimizePortfolio(assets: any[], constraints?: any): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.portfolioOptimizer.optimize(assets, constraints);
}

export async function generateEfficientFrontier(assets: any[], points?: number, constraints?: any): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.portfolioOptimizer.efficientFrontier(assets, points, constraints);
}

export async function riskParityPortfolio(assets: any[], constraints?: any): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.portfolioOptimizer.riskParity(assets, constraints);
}

export async function batchOptimizePortfolios(scenarios: any[]): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.portfolioOptimizer.optimizeBatch(scenarios);
}

export async function rebalancePortfolio(positions: any[], targetWeights: Record<string, number>, dryRun?: boolean, driftThreshold?: number, maxTurnover?: number): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.portfolioOptimizer.rebalance(positions, targetWeights, dryRun, driftThreshold, maxTurnover);
}

export async function rebalanceKelly(positions: any[], kellyFraction?: number, maxTurnover?: number): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.portfolioOptimizer.rebalanceKelly(positions, kellyFraction, maxTurnover);
}

export async function analyzePortfolioCost(positions: any[], trades: any[], periodDays?: number): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.portfolioOptimizer.costAnalyze(positions, trades, periodDays);
}

export async function rarOptimizePortfolio(positions: any[], marketData?: any, riskAppetite?: string, constraints?: any): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.portfolioOptimizer.rarOptimize(positions, marketData, riskAppetite, constraints);
}

export async function analyzeExecution(params: { executionRecords: any[]; marketData?: any; benchmarkPrice?: number; optionsScope?: any }): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.executionAnalytics.analyze(params);
}

export async function buildOptionsStrategy(params: { underlying: string; spotPrice: number; strategyType?: string; targetParams?: any; legs?: any[] }): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.optionsBuilder.build(params);
}

export async function analyzeOptionsStrategy(params: { strategy: any; spotPrice: number; volatility?: number; riskFreeRate?: number; dividends?: any }): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.optionsBuilder.analyze(params);
}

export async function executeTraderSignal(signal: any, paperMode?: boolean): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.realTrader.execute(signal, paperMode);
}

export async function getTraderStatus(): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.realTrader.getStatus();
}

// ── WebSocket Real-time Data Enhancer (JVS-58) ────────────────────────────
export async function connectWebSocket(config: any): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.websocketEnhancer.connect(config);
}

export async function disconnectWebSocket(): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.websocketEnhancer.disconnect();
}

export async function subscribeToWebSocket(symbol: string): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.websocketEnhancer.subscribe(symbol);
}

export async function unsubscribeFromWebSocket(symbol: string): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.websocketEnhancer.unsubscribe(symbol);
}

export async function subscribeToWebSockets(symbols: string[]): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.websocketEnhancer.subscribeBatch(symbols);
}

export async function unsubscribeFromWebSockets(symbols: string[]): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.websocketEnhancer.unsubscribeBatch(symbols);
}

export async function getWebSocketStatus(): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.websocketEnhancer.status();
}

export async function getStreamingStats(): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.websocketEnhancer.streamingStats();
}

// ── Backfill Service (JVS-59) ─────────────────────────────────────────────
export async function startBackfill(config: any): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.backfillService.start(config);
}

export async function stopBackfill(): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.backfillService.stop();
}

export async function getBackfillStatus(): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.backfillService.status();
}

export async function getBackfillStats(): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.backfillService.stats();
}

export async function backfillSymbols(symbols: string[], startDate: string, endDate: string, interval?: any): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.backfillService.symbols(symbols, startDate, endDate, interval);
}

export async function incrementalBackfill(symbol: string, startDate: string, endDate: string, existingRecords: any[]): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.backfillService.incremental(symbol, startDate, endDate, existingRecords);
}

// ── Version Control Service (JVS-40) ───────────────────────────────────────
export async function trackVersion(
  entityId: string,
  entityType: string,
  data: any,
  changeType?: 'create' | 'update' | 'delete',
  changeSummary?: string,
  userId?: string,
  tags?: string[]
): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.versionControl.track(entityId, entityType, data, changeType, changeSummary, userId, tags);
}

export async function getEntityVersions(entityId: string, limit?: number): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.versionControl.getEntityVersions(entityId, limit);
}

export async function getVersion(versionId: string): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.versionControl.get(versionId);
}

export async function getLatestVersion(entityId: string): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.versionControl.getLatest(entityId);
}

export async function diffVersions(versionId1: string, versionId2: string): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.versionControl.diff(versionId1, versionId2);
}

export async function rollbackVersion(entityId: string, targetVersion: number): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.versionControl.rollback(entityId, targetVersion);
}

export async function queryVersions(query: any): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.versionControl.query(query);
}

export async function getVersionStats(): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.versionControl.stats();
}

export async function deleteVersion(versionId: string): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.versionControl.delete(versionId);
}

export async function clearAllVersions(): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.versionControl.clear();
}

export async function exportVersions(query?: any): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.versionControl.export(query);
}

export async function importVersions(jsonString: string): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.versionControl.import(jsonString);
}

// ── Data Pipeline (JVS-57) ─────────────────────────────────────────────────

export async function cleanDataPoint(point: any): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.dataPipeline.clean(point);
}

export async function cleanDataBatch(points: any[]): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.dataPipeline.cleanBatch(points);
}

export async function getPipelineStats(): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.dataPipeline.stats();
}

export async function clearPipelineHistory(code?: string): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.dataPipeline.clearHistory(code);
}

// ── Historical Data Warehouse (JVS-58) ─────────────────────────────────────

export async function insertHistoricalData(points: any[]): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.historicalWarehouse.insert(points);
}

export async function queryHistoricalData(symbol: string, timeRange: any, limit?: number): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.historicalWarehouse.query(symbol, timeRange, limit);
}

export async function aggregateHistoricalData(symbol: string, timeRange: any, interval: string): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.historicalWarehouse.aggregate(symbol, timeRange, interval);
}

export async function getHistoricalStats(): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.historicalWarehouse.stats();
}

export async function cleanOldHistoricalData(retentionDays?: number): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.historicalWarehouse.cleanOld(retentionDays);
}

// ── Data Versioning (JVS-59) ───────────────────────────────────────────────

export async function createDataVersion(tableName: string, metadata?: Record<string, any>): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.dataVersioning.create(tableName, metadata);
}

export async function getDataVersions(tableName: string, limit?: number): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.dataVersioning.getVersions(tableName, limit);
}

export async function getDataVersion(versionId: string): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.dataVersioning.get(versionId);
}

export async function rollbackDataVersion(versionId: string): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.dataVersioning.rollback(versionId);
}

export async function compareDataVersions(versionId1: string, versionId2: string): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.dataVersioning.compare(versionId1, versionId2);
}

export async function cleanupOldDataVersions(tableName: string, keepCount?: number): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.dataVersioning.cleanupOld(tableName, keepCount);
}

// ── Feature Store (JVS-60) ─────────────────────────────────────────────────

export async function computeFeatures(symbol: string, klines: any[]): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.featureStore.compute(symbol, klines);
}

export async function getCachedFeatures(symbol: string): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.featureStore.getCached(symbol);
}

export async function getFeatureDefinitions(): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.featureStore.getDefinitions();
}

export async function saveFeatures(features: any[]): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.featureStore.save(features);
}

export async function queryFeatures(symbol: string, featureNames: string[], limit?: number): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.featureStore.query(symbol, featureNames, limit);
}

// ── Stream Computing (JVS-61) ──────────────────────────────────────────────

export async function processStreamTick(tick: any): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.streamComputing.processTick(tick);
}

export async function getStreamAggregated(symbol: string): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.streamComputing.getAggregated(symbol);
}

export async function getStreamMetrics(symbol: string): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.streamComputing.getMetrics(symbol);
}

export async function getStreamSymbols(): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.streamComputing.getSymbols();
}

export async function clearStreamSymbol(symbol: string): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.streamComputing.clearSymbol(symbol);
}

export async function clearStreamAll(): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.streamComputing.clearAll();
}


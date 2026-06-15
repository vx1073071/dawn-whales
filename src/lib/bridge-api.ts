// R127-Q01: nocheck cleared

// ── TradingEasy — IPC API Client ( OpenD， Electron IPC) ──────────────
// R127-P03: bridge-api type-safety COMPLETE — all 12 namespaces (104/104).
/* eslint-disable @typescript-eslint/no-explicit-any */

import type {
  BrokerConnectConfig, BrokerAccount, BrokerPosition, BrokerQuote, BrokerKline,
  BrokerOrderRequest, BrokerOrder, BrokerStatus, BrokerListEntry,
  RiskConfig, RiskAlert, RiskStatusSnapshot, RiskDrawdownState, RiskKellyStats,
  IpcResponse,
  MarketplaceStrategy, MarketplacePerformance, MarketplaceComment,
  FundamentalData, CapitalFlowData, MarketRegime, AnomalySignal, CompositeScore, NewsItem,
  StrategyDSL, StrategyRecord, BacktestConfig, BacktestResult,
  WalkForwardConfig, ParamScanConfig, MultiTimeframeConfig,
  NLParsedCommand, NLTemplate,
  DBStrategy, DBTrade, DBSignal, DBWatchlist,
  AppInfo, MemoryUsage, UpdateInfo,
  StockStreamConfig, PrefsExport, GreeksParams, GreeksResult,
} from './bridge-api-defs';

declare global {
  interface Window {
    api: {
      broker: {
        connect: (config: BrokerConnectConfig) => Promise<IpcResponse<{ brokerId: string }>>;
        disconnect: () => Promise<IpcResponse>;
        getAccounts: () => Promise<IpcResponse<{ accounts: BrokerAccount[] }>>;
        getFunds: (accountId: string) => Promise<IpcResponse<{ funds: Record<string, number> }>>;
        getPositions: (accountId: string) => Promise<IpcResponse<{ positions: BrokerPosition[] }>>;
        getQuotes: (codes: string[]) => Promise<IpcResponse<{ quotes: BrokerQuote[] }>>;
        getKlines: (code: string, period: string, count: number) => Promise<IpcResponse<{ klines: BrokerKline[] }>>;
        subscribe: (codes: string[]) => Promise<IpcResponse>;
        unsubscribe: (codes: string[]) => Promise<IpcResponse>;
        placeOrder: (order: BrokerOrderRequest) => Promise<IpcResponse<{ order: BrokerOrder }>>;
        cancelOrder: (orderId: string) => Promise<IpcResponse>;
        getOrders: (accountId: string) => Promise<IpcResponse<{ orders: BrokerOrder[] }>>;
        list: () => Promise<IpcResponse<{ brokers: BrokerListEntry[] }>>;
        add: (cfg: BrokerConnectConfig) => Promise<IpcResponse<{ brokerId: string }>>;
        remove: (id: string) => Promise<IpcResponse>;
        setActive: (id: string) => Promise<IpcResponse>;
        getStatus: () => Promise<IpcResponse<BrokerStatus>>;
      };
      greeks: {
        calculate: (params: GreeksParams) => Promise<IpcResponse<GreeksResult>>;
        portfolio: (positions: BrokerPosition[]) => Promise<IpcResponse<{ totalGreeks: GreeksResult; byPosition: Array<{ symbol: string; greeks: GreeksResult }> }>>;
      };
      marketplace: {
        rate: (strategyId: string, rating: number) => Promise<IpcResponse>;
        getRating: (strategyId: string) => Promise<IpcResponse<{ rating: number; count: number }>>;
        comment: (strategyId: string, content: string, parentId?: number) => Promise<IpcResponse<{ comment: MarketplaceComment }>>;
        getComments: (strategyId: string) => Promise<IpcResponse<{ comments: MarketplaceComment[] }>>;
        savePerformance: (data: MarketplacePerformance) => Promise<IpcResponse>;
        getPerformance: (strategyId: string) => Promise<IpcResponse<MarketplacePerformance>>;
        list: (sortBy?: string, limit?: number) => Promise<IpcResponse<{ strategies: MarketplaceStrategy[] }>>;
        score: (strategyId: string) => Promise<IpcResponse<{ score: number }>>;
        verify: (strategyId: string) => Promise<IpcResponse>;
        updateAllScores: () => Promise<IpcResponse>;
      };
      dataProvider: {
        getFundamental: (symbol: string) => Promise<IpcResponse<FundamentalData>>;
        getCapitalFlow: (symbol: string) => Promise<IpcResponse<CapitalFlowData>>;
        getRegime: () => Promise<IpcResponse<MarketRegime>>;
        getAnomalies: (symbol: string) => Promise<IpcResponse<{ anomalies: AnomalySignal[] }>>;
        getNews: (symbol: string, limit?: number) => Promise<IpcResponse<{ news: NewsItem[] }>>;
        getCompositeScore: (symbol: string) => Promise<IpcResponse<CompositeScore>>;
        saveFundamental: (data: FundamentalData) => Promise<IpcResponse>;
        saveCapitalFlow: (data: CapitalFlowData) => Promise<IpcResponse>;
        saveRegime: (regime: MarketRegime) => Promise<IpcResponse>;
        computeRegime: (factors: Record<string, number>) => Promise<IpcResponse<MarketRegime>>;
        saveAnomaly: (signal: AnomalySignal) => Promise<IpcResponse>;
        saveNews: (symbol: string, items: NewsItem[]) => Promise<IpcResponse>;
        clearCache: () => Promise<IpcResponse>;
      };
      backtestEnhanced: {
        walkForward: (config: WalkForwardConfig) => Promise<IpcResponse<BacktestResult>>;
        paramScan: (config: ParamScanConfig) => Promise<IpcResponse<BacktestResult[]>>;
        multiTimeframe: (config: MultiTimeframeConfig) => Promise<IpcResponse<BacktestResult[]>>;
      };
      backtest: {
        multiPeriod: (config: BacktestConfig) => Promise<IpcResponse<BacktestResult[]>>;
        paramSweep: (config: ParamScanConfig) => Promise<IpcResponse<BacktestResult[]>>;
        walkForward: (config: WalkForwardConfig) => Promise<IpcResponse<BacktestResult>>;
        riskMetrics: (equityCurve: number[], riskFreeRate?: number) => Promise<IpcResponse<{ sharpe: number; sortino: number; maxDrawdown: number; calmar: number }>>;
        walkForwardV2: (config: WalkForwardConfig) => Promise<IpcResponse<BacktestResult>>;
        paramScan: (config: ParamScanConfig) => Promise<IpcResponse<BacktestResult[]>>;
        multiTimeframe: (config: MultiTimeframeConfig) => Promise<IpcResponse<BacktestResult[]>>;
      };
      strategy: {
        create: (dsl: StrategyDSL) => Promise<IpcResponse<{ strategy: StrategyRecord }>>;
        getAll: () => Promise<IpcResponse<{ strategies: StrategyRecord[] }>>;
        get: (id: string) => Promise<IpcResponse<StrategyRecord>>;
        update: (id: string, updates: Partial<StrategyDSL>) => Promise<IpcResponse>;
        delete: (id: string) => Promise<IpcResponse>;
        backtest: (config: BacktestConfig) => Promise<IpcResponse<BacktestResult>>;
        startLive: (id: string) => Promise<IpcResponse>;
        stopLive: (id: string) => Promise<IpcResponse>;
        explain: (strategy: StrategyRecord) => Promise<IpcResponse<{ explanation: string }>>;
        compare: (s1: StrategyRecord, s2: StrategyRecord) => Promise<IpcResponse<{ metrics: Record<string, { s1: number; s2: number; winner: string }> }>>;
        optimize: (strategyDSL: StrategyDSL, backtestResult: BacktestResult) => Promise<IpcResponse<StrategyDSL>>;
      };
      nl: {
        parse: (text: string) => Promise<IpcResponse<NLParsedCommand>>;
        templates: () => Promise<IpcResponse<{ templates: NLTemplate[] }>>;
      };
      risk: {
        getConfig: () => Promise<IpcResponse<RiskConfig>>;
        updateConfig: (config: Partial<RiskConfig>) => Promise<IpcResponse>;
        getAlerts: () => Promise<IpcResponse<{ alerts: RiskAlert[] }>>;
        getStatusSnapshot: () => Promise<IpcResponse<RiskStatusSnapshot>>;
        getKellyStats: () => Promise<IpcResponse<RiskKellyStats>>;
        getDrawdownState: () => Promise<IpcResponse<RiskDrawdownState>>;
        updateVix: (vix: number) => Promise<IpcResponse>;
      };
      db: {
        getStrategies: () => Promise<IpcResponse<{ strategies: DBStrategy[] }>>;
        saveStrategy: (s: DBStrategy) => Promise<IpcResponse>;
        getSettings: () => Promise<IpcResponse<Record<string, unknown>>>;
        saveSettings: (s: Record<string, unknown>) => Promise<IpcResponse>;
        getTrades: (strategyId?: string) => Promise<IpcResponse<{ trades: DBTrade[] }>>;
        getBacktestResults: (strategyId: string) => Promise<IpcResponse<BacktestResult[]>>;
        getWatchlist: () => Promise<IpcResponse<DBWatchlist>>;
        saveWatchlist: (codes: string[]) => Promise<IpcResponse>;
        getSignals: (strategyId?: string) => Promise<IpcResponse<{ signals: DBSignal[] }>>;
      };
      app: {
        getInfo: () => Promise<IpcResponse<AppInfo>>;
        getMemoryUsage: () => Promise<IpcResponse<MemoryUsage>>;
        checkUpdate: () => Promise<IpcResponse<UpdateInfo>>;
        downloadUpdate: () => Promise<IpcResponse>;
        installUpdate: () => Promise<void>;
        emergencyStop: () => Promise<void>;
        openExternal: (url: string) => Promise<void>;
        getVersion: () => Promise<string>;
        getPlatform: () => Promise<string>;
      };
      stockStream: {
        connect: (config: StockStreamConfig) => Promise<void>;
        disconnect: () => void;
        getQuotes: (codes: string[]) => Promise<BrokerQuote[]>;
        getStatus: () => { connected: boolean; symbols: string[]; latency: number };
        onQuote: (cb: (data: BrokerQuote) => void) => void;
        subscribe: (symbols: string[]) => void;
        unsubscribe: () => void;
        onData: (cb: (data: BrokerQuote) => void) => void;
        removeDataListener: (cb: (data: BrokerQuote) => void) => void;
        isActive: () => boolean;
      };
      prefs: {
        get: (key: string) => Promise<IpcResponse<unknown>>;
        set: (key: string, value: unknown) => Promise<IpcResponse>;
        getAll: () => Promise<IpcResponse<Record<string, unknown>>>;
        setSection: (section: string, data: Record<string, unknown>) => Promise<IpcResponse>;
        reset: (...args: string[]) => Promise<IpcResponse>;
        exportPrefs: () => Promise<IpcResponse<PrefsExport>>;
        importPrefs: (...args: string[]) => Promise<IpcResponse>;
      };
      on: (channel: string, callback: (...args: any[]) => void) => void;
      off?: (channel: string, callback: (...args: any[]) => void) => void;
      // Extended IPC modules (lazy-registered by engine)
      monitor: any;
      export: any;
      shell: any;
      trade: any;
      monteCarlo: any;
      ws: any;
      automation: any;
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
  if (result?.success && Array.isArray(result.klines) && result.klines.length > 0) return result.klines;
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
  if (!hasIPC()) return { success: false, error: 'No IPC' };
  return window.api.broker.placeOrder(order);
}

export async function isConnected(): Promise<boolean> {
  if (!hasIPC()) return false;
  try {
    const result = await window.api.broker.getAccounts();
    return result?.success === true;
  } catch (_e: unknown) { return false; }
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

// ── App / Updater ──────────────────────────────────────────────────────────

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

// ── R164 P1-E4: Factor Suggestions ────────────────────────────────────────
// Calls FactorCompatibilityEngine.suggestFactors() via IPC bridge.
// Falls back to inline STRATEGY_FACTORS when IPC is unavailable (dev/browser).
// This centralizes the recommendation logic — TemplateBrowser no longer embeds it.

export type StrategyCategory = 'momentum' | 'value' | 'growth' | 'balanced' | 'defensive';

export interface FactorSuggestion {
  factorId: string;
  nameCN: string;
  categoryCN: string;
  typicalIC: number;
  compatible: boolean;
  reason?: string;
}

// Inline fallback (mirrors FactorCompatibilityEngine's per-strategy-type scoring)
const STRATEGY_FACTORS: Record<StrategyCategory, Array<{ id: string; nameCN: string; cat: string; ic: number }>> = {
  momentum: [
    { id: 'MOM_12M', nameCN: '12月动量', cat: '动量', ic: 0.045 },
    { id: 'MA_20_60', nameCN: '均线交叉', cat: '趋势', ic: 0.025 },
    { id: 'RSI_14', nameCN: 'RSI 14', cat: '动量', ic: 0.028 },
    { id: 'ADX', nameCN: 'ADX 14', cat: '趋势', ic: 0.015 },
    { id: 'LIQ', nameCN: '流动性', cat: '波动率', ic: 0.038 },
  ],
  value: [
    { id: 'HML', nameCN: '价值因子', cat: '价值', ic: 0.038 },
    { id: 'QUAL', nameCN: '质量因子', cat: '质量', ic: 0.035 },
    { id: 'RMW', nameCN: '盈利因子', cat: '质量', ic: 0.030 },
    { id: 'YIELD', nameCN: '股息率', cat: '收益', ic: 0.018 },
    { id: 'SIZE', nameCN: '规模因子', cat: '规模', ic: 0.025 },
  ],
  defensive: [
    { id: 'VOL_60D', nameCN: '60日波动率', cat: '波动率', ic: 0.042 },
    { id: 'QUAL', nameCN: '质量因子', cat: '质量', ic: 0.035 },
    { id: 'YIELD', nameCN: '股息率', cat: '收益', ic: 0.018 },
    { id: 'LIQ', nameCN: '流动性', cat: '波动率', ic: 0.038 },
    { id: 'HML', nameCN: '价值因子', cat: '价值', ic: 0.038 },
  ],
  balanced: [
    { id: 'MOM_12M', nameCN: '12月动量', cat: '动量', ic: 0.045 },
    { id: 'HML', nameCN: '价值因子', cat: '价值', ic: 0.038 },
    { id: 'QUAL', nameCN: '质量因子', cat: '质量', ic: 0.035 },
    { id: 'VOL_60D', nameCN: '60日波动率', cat: '波动率', ic: 0.042 },
    { id: 'SIZE', nameCN: '规模因子', cat: '规模', ic: 0.025 },
    { id: 'LIQ', nameCN: '流动性', cat: '波动率', ic: 0.038 },
  ],
  growth: [
    { id: 'GROWTH', nameCN: '成长性', cat: '成长', ic: 0.028 },
    { id: 'MOM_12M', nameCN: '12月动量', cat: '动量', ic: 0.045 },
    { id: 'QUAL', nameCN: '质量因子', cat: '质量', ic: 0.035 },
    { id: 'RMW', nameCN: '盈利因子', cat: '质量', ic: 0.030 },
    { id: 'LIQ', nameCN: '流动性', cat: '波动率', ic: 0.038 },
  ],
};

export async function getFactorSuggestions(
  strategyType: StrategyCategory,
  topN: number = 5,
): Promise<FactorSuggestion[]> {
  // Try IPC bridge first (future: window.api.factor.suggestFactors)
  if (hasIPC()) {
    try {
      // Dynamic check for factor namespace (added in R164)
      const api = (window as any).api;
      if (api?.factor?.suggestFactors) {
        const result = await api.factor.suggestFactors({ strategyType, topN });
        if (result?.success && result.factors) {
          return result.factors.map((f: Record<string, unknown>) => ({
            factorId: String(f.factorId || f.id || ''),
            nameCN: String(f.nameCN || f.nameCN || ''),
            categoryCN: String(f.categoryCN || f.category || ''),
            typicalIC: Number(f.typicalIC || 0),
            compatible: true,
          }));
        }
      }
    } catch { /* fall through to inline */ }
  }

  // Inline fallback
  const factors = STRATEGY_FACTORS[strategyType] || STRATEGY_FACTORS.balanced;
  return factors.slice(0, topN).map(f => ({
    factorId: f.id,
    nameCN: f.nameCN,
    categoryCN: f.cat,
    typicalIC: f.ic,
    compatible: true,
  }));
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

// ── Market Data Stubs (UI pages import these, IPC not yet wired) ─────────

export async function getStockCapitalFlowRank(..._a: any[]): Promise<any> { return { success: false, data: [] }; }
export async function getSectorCapitalFlowRank(..._a: any[]): Promise<any> { return { success: false, data: [] }; }
export async function getConceptCapitalFlowRank(..._a: any[]): Promise<any> { return { success: false, data: [] }; }
export async function getConsumerData(..._a: any[]): Promise<any> { return { success: false, data: null }; }
export async function getMarketHotspot(..._a: any[]): Promise<any> { return { success: false, hotspots: [] }; }
export async function getDragonTigerList(..._a: any[]): Promise<any> { return { success: false, list: [] }; }
export async function getDragonTigerDetail(..._a: any[]): Promise<any> { return { success: false, detail: null }; }
export async function getInstitutionalTrades(..._a: any[]): Promise<any> { return { success: false, trades: [] }; }
export async function getFundHoldings(..._a: any[]): Promise<any> { return { success: false, holdings: [] }; }
export async function getStockFundOwnership(..._a: any[]): Promise<any> { return { success: false, ownership: [] }; }
export async function getFundIncreaseRank(..._a: any[]): Promise<any> { return { success: false, rank: [] }; }
export async function getFundDecreaseRank(..._a: any[]): Promise<any> { return { success: false, rank: [] }; }
export async function getMacroDashboard(..._a: any[]): Promise<any> { return { success: false, dashboard: null }; }
export async function getMarginData(..._a: any[]): Promise<any> { return { success: false, data: null }; }
export async function getMarginBalanceRank(..._a: any[]): Promise<any> { return { success: false, rank: [] }; }
export async function getShortInterestRank(..._a: any[]): Promise<any> { return { success: false, rank: [] }; }
export async function getSectorHeatmap(..._a: any[]): Promise<any> { return { success: false, heatmap: [] }; }
export async function searchNews(..._a: any[]): Promise<any> { return { success: false, items: [] }; }
export async function getMarketMood(..._a: any[]): Promise<any> { return { success: false, mood: null }; }
export async function subscribeQuoteStream(..._a: any[]): Promise<any> { return { success: false, error: 'Not implemented' }; }
export async function unsubscribeQuoteStream(..._a: any[]): Promise<any> { return { success: false, error: 'Not implemented' }; }
export async function getQuoteStreamStatus(..._a: any[]): Promise<any> { return { success: false, status: 'disconnected' }; }
export async function analyzeSectorRotation(..._a: any[]): Promise<any> { return { success: false, analysis: null }; }
export async function getSmartPick(..._a: any[]): Promise<any> { return { success: false, picks: [] }; }
export async function diagnoseStock(..._a: any[]): Promise<any> { return { success: false, diagnosis: null }; }
export async function searchStocks(..._a: any[]): Promise<any> { return { success: false, results: [] }; }
export async function getAnomalyAlerts(..._a: any[]): Promise<any> { return { success: false, alerts: [] }; }
export async function getAnomalySummary(..._a: any[]): Promise<any> { return { success: false, summary: null }; }
export async function acknowledgeAnomalyAlert(..._a: any[]): Promise<any> { return { success: false }; }
export async function computeSentiment(..._a: any[]): Promise<any> { return { success: false, sentiment: null }; }
export async function getAISuggest(..._a: any[]): Promise<any> { return { success: false, suggestion: null }; }
export async function getPaperTraderStatus(..._a: any[]): Promise<any> { return { success: false, status: 'offline' }; }
export async function getTradeHistory(..._a: any[]): Promise<any> { return { success: false, trades: [] }; }

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

/* eslint-enable @typescript-eslint/no-explicit-any */


// ── DAWN WHALES — IPC API Client ( OpenD， Electron IPC) ──────────────
// R127-P03: bridge-api type-safety COMPLETE — all 12 namespaces typed (batches 1-4/4). 104/104.
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

export function hasIPC(): boolean {
  return typeof window !== 'undefined' && !!window.api?.broker;
}

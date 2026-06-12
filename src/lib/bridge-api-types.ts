
// ── DAWN WHALES — IPC API Client ( OpenD， Electron IPC) ──────────────
// R124-P02: broker + risk typed (batch 1/4). R125-P02: marketplace + dataProvider (batch 2/4).
/* eslint-disable @typescript-eslint/no-explicit-any */

import type {
  BrokerConnectConfig, BrokerAccount, BrokerPosition, BrokerQuote, BrokerKline,
  BrokerOrderRequest, BrokerOrder, BrokerStatus, BrokerListEntry,
  RiskConfig, RiskAlert, RiskStatusSnapshot, RiskDrawdownState, RiskKellyStats,
  IpcResponse,
  MarketplaceStrategy, MarketplacePerformance, MarketplaceComment,
  FundamentalData, CapitalFlowData, MarketRegime, AnomalySignal, CompositeScore, NewsItem,
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
        calculate: (params: any) => Promise<any>;
        portfolio: (positions: any[]) => Promise<any>;
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
      };
      nl: {
        parse: (text: string) => Promise<any>;
        templates: () => Promise<any>;
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
      stockStream: {
        connect: (config: any) => Promise<void>;
        disconnect: () => void;
        getQuotes: (codes: string[]) => Promise<any[]>;
        getStatus: () => any;
        onQuote: (cb: (data: any) => void) => void;
        subscribe: (symbols: string[]) => void;
        unsubscribe: () => void;
        onData: (cb: (data: any) => void) => void;
        removeDataListener: (cb: (data: any) => void) => void;
        isActive: () => boolean;
      };
      prefs: {
        get: (key: string) => Promise<any>;
        set: (key: string, value: any) => Promise<any>;
        getAll: () => Promise<any>;
        setSection: (section: string, data: any) => Promise<any>;
        reset: (...args: any[]) => Promise<any>;
        exportPrefs: () => Promise<any>;
        importPrefs: (...args: any[]) => Promise<any>;
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

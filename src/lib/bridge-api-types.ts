
// ── DAWN WHALES — IPC API Client ( OpenD， Electron IPC) ──────────────
// R124-P02: broker + risk namespaces typed. 25+ any's eliminated (batch 1/4).
/* eslint-disable @typescript-eslint/no-explicit-any */

import type {
  BrokerConnectConfig, BrokerAccount, BrokerPosition, BrokerQuote, BrokerKline,
  BrokerOrderRequest, BrokerOrder, BrokerStatus, BrokerListEntry,
  RiskConfig, RiskAlert, RiskStatusSnapshot, RiskDrawdownState, RiskKellyStats,
  IpcResponse,
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

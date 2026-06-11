
// ── DAWN WHALES — IPC API Client ( OpenD， Electron IPC) ──────────────
// R89: Window.api uses `any` types to avoid cascading TS18046/TS2339/TS2345/TS2322
// in 80+ consumer files. Internal type safety maintained by wrapper functions.
/* eslint-disable @typescript-eslint/no-explicit-any */

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

/**
 * Window API type declarations for Dawn Whales Electron app.
 * R84 P1-6b: eliminates `(window as any).api` pattern.
 * Mirrors electron/preload.ts contextBridge.exposeInMainWorld('api', {...})
 */

interface WindowApi {
  broker: {
    connect: (config: unknown) => Promise<unknown>;
    disconnect: () => Promise<unknown>;
    getAccounts: () => Promise<unknown[]>;
    getFunds: (accountId: string) => Promise<unknown>;
    getPositions: (accountId: string) => Promise<unknown[]>;
    getQuotes: (codes: string[]) => Promise<unknown[]>;
    getKlines: (code: string, period: string, count: number) => Promise<unknown[]>;
    subscribe: (codes: string[]) => Promise<unknown>;
    unsubscribe: (codes: string[]) => Promise<unknown>;
    placeOrder: (order: unknown) => Promise<unknown>;
    cancelOrder: (orderId: string) => Promise<unknown>;
    getOrders: (accountId: string) => Promise<unknown[]>;
    list: () => Promise<unknown[]>;
    add: (cfg: unknown) => Promise<unknown>;
    remove: (id: string) => Promise<unknown>;
    setActive: (id: string) => Promise<unknown>;
    getStatus: () => Promise<unknown>;
  };

  strategy: {
    create: (dsl: unknown) => Promise<unknown>;
    getAll: () => Promise<unknown[]>;
    get: (id: string) => Promise<unknown>;
    update: (id: string, updates: unknown) => Promise<unknown>;
    delete: (id: string) => Promise<unknown>;
    backtest: (config: unknown) => Promise<unknown>;
    startLive: (id: string) => Promise<unknown>;
    stopLive: (id: string) => Promise<unknown>;
    explain: (strategy: unknown) => Promise<unknown>;
    compare: (s1: unknown, s2: unknown) => Promise<unknown>;
    optimize: (strategyDSL: unknown, backtestResult: unknown) => Promise<unknown>;
  };

  trade: {
    execute: (signal: unknown) => Promise<unknown>;
    cancel: (orderId: string) => Promise<unknown>;
    'get-orders': (filter?: unknown) => Promise<unknown[]>;
    history: (limit?: number) => Promise<unknown[]>;
    'get-config': () => Promise<unknown>;
    'update-config': (updates: unknown) => Promise<unknown>;
    'emergency-stop': () => Promise<unknown>;
    'set-mode': (mode: string) => Promise<unknown>;
    confirm: (signalId: string) => Promise<unknown>;
    reject: (signalId: string, reason?: string) => Promise<unknown>;
    summary: () => Promise<unknown>;
    stats: () => Promise<unknown>;
    positions: () => Promise<unknown[]>;
    'trade-log': (limit?: number) => Promise<unknown[]>;
    'daily-pnl': () => Promise<unknown>;
    diagnostics: () => Promise<unknown>;
  };

  risk: {
    getConfig: () => Promise<unknown>;
    updateConfig: (config: unknown) => Promise<unknown>;
    getAlerts: () => Promise<unknown[]>;
    getStatusSnapshot: () => Promise<unknown>;
    getKellyStats: () => Promise<unknown>;
    getDrawdownState: () => Promise<unknown>;
    updateVix: (vix: number) => Promise<unknown>;
  };

  db: {
    getStrategies: () => Promise<unknown[]>;
    saveStrategy: (s: unknown) => Promise<unknown>;
    getSettings: () => Promise<unknown>;
    saveSettings: (s: unknown) => Promise<unknown>;
    getTrades: (strategyId?: string) => Promise<unknown[]>;
    getBacktestResults: (strategyId: string) => Promise<unknown[]>;
    getWatchlist: () => Promise<string[]>;
    saveWatchlist: (codes: string[]) => Promise<unknown>;
    getSignals: (strategyId?: string) => Promise<unknown[]>;
  };

  app: {
    getInfo: () => Promise<unknown>;
    getMemoryUsage: () => Promise<unknown>;
    checkUpdate: () => Promise<unknown>;
    downloadUpdate: () => Promise<unknown>;
    installUpdate: () => Promise<unknown>;
    emergencyStop: () => Promise<unknown>;
    openExternal: (url: string) => Promise<unknown>;
    getVersion: () => Promise<string>;
    getPlatform: () => Promise<string>;
  };

  marketplace: {
    rate: (strategyId: string, rating: number) => Promise<unknown>;
    getRating: (strategyId: string) => Promise<unknown>;
    comment: (strategyId: string, content: string, parentId?: number) => Promise<unknown>;
    getComments: (strategyId: string) => Promise<unknown[]>;
    savePerformance: (data: unknown) => Promise<unknown>;
    getPerformance: (strategyId: string) => Promise<unknown>;
    list: (sortBy?: string, limit?: number) => Promise<unknown[]>;
    score: (strategyId: string) => Promise<unknown>;
    verify: (strategyId: string) => Promise<unknown>;
    updateAllScores: () => Promise<unknown>;
  };

  dataProvider: {
    getFundamental: (symbol: string) => Promise<unknown>;
    getCapitalFlow: (symbol: string) => Promise<unknown>;
    getRegime: () => Promise<unknown>;
    getAnomalies: (symbol: string) => Promise<unknown[]>;
    getNews: (symbol: string, limit?: number) => Promise<unknown[]>;
    getCompositeScore: (symbol: string) => Promise<unknown>;
    saveFundamental: (data: unknown) => Promise<unknown>;
    saveCapitalFlow: (data: unknown) => Promise<unknown>;
    saveRegime: (regime: unknown) => Promise<unknown>;
    computeRegime: (factors: unknown) => Promise<unknown>;
    saveAnomaly: (signal: unknown) => Promise<unknown>;
    saveNews: (symbol: string, items: unknown[]) => Promise<unknown>;
    clearCache: () => Promise<unknown>;
  };

  backtest: {
    multiPeriod: (config: unknown) => Promise<unknown>;
    paramSweep: (config: unknown) => Promise<unknown>;
    walkForward: (config: unknown) => Promise<unknown>;
    riskMetrics: (equityCurve: number[], riskFreeRate?: number) => Promise<unknown>;
    walkForwardV2: (config: unknown) => Promise<unknown>;
    paramScan: (config: unknown) => Promise<unknown>;
    multiTimeframe: (config: unknown) => Promise<unknown>;
  };

  ws: {
    connect: (config?: unknown) => Promise<unknown>;
    disconnect: () => Promise<unknown>;
    subscribe: (codes: string[], type?: string) => Promise<unknown>;
    unsubscribe: (subscriptionId: string) => Promise<unknown>;
    status: () => Promise<unknown>;
    'get-ticks': (code: string, limit?: number) => Promise<unknown[]>;
    'enable-mock': (symbols?: string[]) => Promise<unknown>;
    'disable-mock': () => Promise<unknown>;
    diagnostics: () => Promise<unknown>;
  };

  greeks: {
    calculate: (params: unknown) => Promise<unknown>;
    portfolio: (positions: unknown[]) => Promise<unknown>;
  };

  nl: {
    parse: (text: string) => Promise<unknown>;
    templates: () => Promise<unknown[]>;
  };

  // Extended methods used in components (not in preload.ts — may be direct IPC or future additions)
  export: Record<string, (...args: unknown[]) => Promise<unknown>>;
  cron: Record<string, (...args: unknown[]) => Promise<unknown>>;
  shell: Record<string, (...args: unknown[]) => Promise<unknown>>;
  prefs: Record<string, (...args: unknown[]) => Promise<unknown>>;
  getTemplates: () => Promise<unknown[]>;
  instantiateTemplate: (id: string, overrides: unknown) => Promise<unknown>;

  // Event system
  on: (channel: string, callback: (...args: unknown[]) => void) => void;
  off: (channel: string, callback: (...args: unknown[]) => void) => void;
}

// Extend the global Window interface
declare global {
  interface Window {
    api: WindowApi;
  }
}

export {};

// ── Preload Script — IPC Bridge (安全暴露 API 给渲染进程) ──────────────────
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  // ── Broker ────────────────────────────────────────────────────────
  broker: {
    connect: (config: any) => ipcRenderer.invoke('broker:connect', config),
    disconnect: () => ipcRenderer.invoke('broker:disconnect'),
    getAccounts: () => ipcRenderer.invoke('broker:getAccounts'),
    getFunds: (accountId: string) => ipcRenderer.invoke('broker:getFunds', accountId),
    getPositions: (accountId: string) => ipcRenderer.invoke('broker:getPositions', accountId),
    getQuotes: (codes: string[]) => ipcRenderer.invoke('broker:getQuotes', codes),
    getKlines: (code: string, period: string, count: number) => ipcRenderer.invoke('broker:getKlines', code, period, count),
    subscribe: (codes: string[]) => ipcRenderer.invoke('broker:subscribe', codes),
    unsubscribe: (codes: string[]) => ipcRenderer.invoke('broker:unsubscribe', codes),
    placeOrder: (order: any) => ipcRenderer.invoke('broker:placeOrder', order),
    cancelOrder: (orderId: string) => ipcRenderer.invoke('broker:cancelOrder', orderId),
    getOrders: (accountId: string) => ipcRenderer.invoke('broker:getOrders', accountId),
    // Sprint1: multi-broker management
    list: () => ipcRenderer.invoke('broker:list'),
    add: (cfg: any) => ipcRenderer.invoke('broker:add', cfg),
    remove: (id: string) => ipcRenderer.invoke('broker:remove', id),
    setActive: (id: string) => ipcRenderer.invoke('broker:setActive', id),
    getStatus: () => ipcRenderer.invoke('broker:getStatus'),
  },

  // ── Strategy ──────────────────────────────────────────────────────
  strategy: {
    create: (dsl: any) => ipcRenderer.invoke('strategy:create', dsl),
    getAll: () => ipcRenderer.invoke('strategy:getAll'),
    get: (id: string) => ipcRenderer.invoke('strategy:get', id),
    update: (id: string, updates: any) => ipcRenderer.invoke('strategy:update', id, updates),
    delete: (id: string) => ipcRenderer.invoke('strategy:delete', id),
    backtest: (config: any) => ipcRenderer.invoke('strategy:backtest', config),
    startLive: (id: string) => ipcRenderer.invoke('strategy:startLive', id),
    stopLive: (id: string) => ipcRenderer.invoke('strategy:stopLive', id),
    explain: (strategy: any) => ipcRenderer.invoke('strategy:explain', strategy),
    compare: (s1: any, s2: any) => ipcRenderer.invoke('strategy:compare', s1, s2),
    optimize: (strategyDSL: any, backtestResult: any) => ipcRenderer.invoke('strategy:optimize', { strategyDSL, backtestResult }),
  },

  // ── NL Parser ─────────────────────────────────────────────────────
  nl: {
    parse: (text: string) => ipcRenderer.invoke('nl:parse', text),
    templates: () => ipcRenderer.invoke('nl:templates'),
  },

  // ── Risk ──────────────────────────────────────────────────────────
  risk: {
    getConfig: () => ipcRenderer.invoke('risk:getConfig'),
    updateConfig: (config: any) => ipcRenderer.invoke('risk:updateConfig', config),
    getAlerts: () => ipcRenderer.invoke('risk:getAlerts'),
    getStatusSnapshot: () => ipcRenderer.invoke('risk:getStatusSnapshot'),
    getKellyStats: () => ipcRenderer.invoke('risk:getKellyStats'),
    getDrawdownState: () => ipcRenderer.invoke('risk:getDrawdownState'),
    updateVix: (vix: number) => ipcRenderer.invoke('risk:updateVix', vix),
  },

  // ── Database ──────────────────────────────────────────────────────
  db: {
    getStrategies: () => ipcRenderer.invoke('db:getStrategies'),
    saveStrategy: (s: any) => ipcRenderer.invoke('db:saveStrategy', s),
    getSettings: () => ipcRenderer.invoke('db:getSettings'),
    saveSettings: (s: any) => ipcRenderer.invoke('db:saveSettings', s),
    getTrades: (strategyId?: string) => ipcRenderer.invoke('db:getTrades', strategyId),
    getBacktestResults: (strategyId: string) => ipcRenderer.invoke('db:getBacktestResults', strategyId),
    getWatchlist: () => ipcRenderer.invoke('db:getWatchlist'),
    saveWatchlist: (codes: string[]) => ipcRenderer.invoke('db:saveWatchlist', codes),
    getSignals: (strategyId?: string) => ipcRenderer.invoke('db:getSignals', strategyId),
  },

  // ── App ───────────────────────────────────────────────────────────
  app: {
    getInfo: () => ipcRenderer.invoke('app:getInfo'),
    getMemoryUsage: () => ipcRenderer.invoke('app:getMemoryUsage'),
    checkUpdate: () => ipcRenderer.invoke('app:checkUpdate'),
    downloadUpdate: () => ipcRenderer.invoke('app:downloadUpdate'),
    installUpdate: () => ipcRenderer.invoke('app:installUpdate'),
    emergencyStop: () => ipcRenderer.invoke('app:emergencyStop'),
    openExternal: (url: string) => ipcRenderer.invoke('app:openExternal', url),
    getVersion: () => ipcRenderer.invoke('app:getVersion'),
    getPlatform: () => ipcRenderer.invoke('app:getPlatform'),
  },

  // ── Greeks ────────────────────────────────────────────────────────
  greeks: {
    calculate: (params: any) => ipcRenderer.invoke('greeks:calculate', params),
    portfolio: (positions: any[]) => ipcRenderer.invoke('greeks:portfolio', positions),
  },

  // ── Marketplace ───────────────────────────────────────────────────
  marketplace: {
    rate: (strategyId: string, rating: number) => ipcRenderer.invoke('marketplace:rate', strategyId, rating),
    getRating: (strategyId: string) => ipcRenderer.invoke('marketplace:getRating', strategyId),
    comment: (strategyId: string, content: string, parentId?: number) => ipcRenderer.invoke('marketplace:comment', strategyId, content, parentId),
    getComments: (strategyId: string) => ipcRenderer.invoke('marketplace:getComments', strategyId),
    savePerformance: (data: any) => ipcRenderer.invoke('marketplace:savePerformance', data),
    getPerformance: (strategyId: string) => ipcRenderer.invoke('marketplace:getPerformance', strategyId),
    list: (sortBy?: string, limit?: number) => ipcRenderer.invoke('marketplace:list', sortBy, limit),
    score: (strategyId: string) => ipcRenderer.invoke('marketplace:score', strategyId),
    verify: (strategyId: string) => ipcRenderer.invoke('marketplace:verify', strategyId),
    updateAllScores: () => ipcRenderer.invoke('marketplace:updateAllScores'),
  },

  // ── Data Provider (multi-source integration) ──────────────────────
  dataProvider: {
    getFundamental: (symbol: string) => ipcRenderer.invoke('data:fundamental', symbol),
    getCapitalFlow: (symbol: string) => ipcRenderer.invoke('data:capital-flow', symbol),
    getRegime: () => ipcRenderer.invoke('data:regime'),
    getAnomalies: (symbol: string) => ipcRenderer.invoke('data:anomalies', symbol),
    getNews: (symbol: string, limit?: number) => ipcRenderer.invoke('data:news', symbol, limit),
    getCompositeScore: (symbol: string) => ipcRenderer.invoke('data:composite-score', symbol),
    saveFundamental: (data: any) => ipcRenderer.invoke('data:save-fundamental', data),
    saveCapitalFlow: (data: any) => ipcRenderer.invoke('data:save-capital-flow', data),
    saveRegime: (regime: any) => ipcRenderer.invoke('data:save-regime', regime),
    computeRegime: (factors: any) => ipcRenderer.invoke('data:compute-regime', factors),
    saveAnomaly: (signal: any) => ipcRenderer.invoke('data:save-anomaly', signal),
    saveNews: (symbol: string, items: any[]) => ipcRenderer.invoke('data:save-news', symbol, items),
    clearCache: () => ipcRenderer.invoke('data:clear-cache'),
  },

  // ── Backtest Enhancement (Sprint 2) ──────────────────────────────
  backtest: {
    multiPeriod: (config: any) => ipcRenderer.invoke('backtest:multiPeriod', config),
    paramSweep: (config: any) => ipcRenderer.invoke('backtest:paramSweep', config),
    walkForward: (config: any) => ipcRenderer.invoke('backtest:walkForward', config),
    riskMetrics: (equityCurve: number[], riskFreeRate?: number) => ipcRenderer.invoke('backtest:riskMetrics', equityCurve, riskFreeRate),
    walkForwardV2: (config: any) => ipcRenderer.invoke('backtest:walk-forward', config),
    paramScan: (config: any) => ipcRenderer.invoke('backtest:param-scan', config),
    multiTimeframe: (config: any) => ipcRenderer.invoke('backtest:multi-timeframe', config),
  },

  // ── Trade Executor (Sprint 2 Phase 2) ─────────────────────────────
  trade: {
    execute: (signal: any) => ipcRenderer.invoke('trade:execute', signal),
    cancel: (orderId: string) => ipcRenderer.invoke('trade:cancel', orderId),
    'get-orders': (filter?: any) => ipcRenderer.invoke('trade:get-orders', filter),
    history: (limit?: number) => ipcRenderer.invoke('trade:get-history', limit),
    'get-config': () => ipcRenderer.invoke('trade:get-config'),
    'update-config': (updates: any) => ipcRenderer.invoke('trade:update-config', updates),
    'emergency-stop': () => ipcRenderer.invoke('trade:emergency-stop'),
    'set-mode': (mode: string) => ipcRenderer.invoke('trade:set-mode', mode),
    confirm: (signalId: string) => ipcRenderer.invoke('trade:confirm-signal', signalId),
    reject: (signalId: string, reason?: string) => ipcRenderer.invoke('trade:reject-signal', signalId, reason),
    summary: () => ipcRenderer.invoke('trade:get-summary'),
    stats: () => ipcRenderer.invoke('trade:get-stats'),
    positions: () => ipcRenderer.invoke('trade:get-positions'),
    'trade-log': (limit?: number) => ipcRenderer.invoke('trade:get-trade-log', limit),
    'daily-pnl': () => ipcRenderer.invoke('trade:get-daily-pnl'),
    diagnostics: () => ipcRenderer.invoke('trade:get-diagnostics'),
  },

  // ── WebSocket Market Data (Sprint 2 Phase 1) ─────────────────────
  ws: {
    connect: (config?: any) => ipcRenderer.invoke('ws:connect', config),
    disconnect: () => ipcRenderer.invoke('ws:disconnect'),
    subscribe: (codes: string[], type?: string) => ipcRenderer.invoke('ws:subscribe', codes, type),
    unsubscribe: (subscriptionId: string) => ipcRenderer.invoke('ws:unsubscribe', subscriptionId),
    status: () => ipcRenderer.invoke('ws:status'),
    'get-ticks': (code: string, limit?: number) => ipcRenderer.invoke('ws:get-ticks', code, limit),
    'enable-mock': (symbols?: string[]) => ipcRenderer.invoke('ws:enable-mock', symbols),
    'disable-mock': () => ipcRenderer.invoke('ws:disable-mock'),
    diagnostics: () => ipcRenderer.invoke('ws:diagnostics'),
  },

  // ── Events (Main → Renderer) ─────────────────────────────────────
  on: (channel: string, callback: (...args: any[]) => void) => {
    const allowed = [
      'quotes:push',
      'quote-update',
      'order-update',
      'strategy-signal',
      'signal',
      'risk-alert',
      'notification',
      'ws:tick',
      'ws:kline',
      'ws:connected',
      'ws:disconnected',
      'ws:reconnecting',
      'ws:depth',
      'ws:error',
      'trade:order-created',
      'trade:order-filled',
      'trade:order-cancelled',
      'trade:order-rejected',
      'trade:signal-generated',
      'trade:mode-changed',
      'monitor:alert-push',
    ];
    if (allowed.includes(channel)) {
      ipcRenderer.on(channel, (_event, ...args) => callback(...args));
    }
  },

  off: (channel: string, callback: (...args: any[]) => void) => {
    ipcRenderer.removeListener(channel, callback);
  },
});

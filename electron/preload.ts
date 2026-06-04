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
    correlation: (strategies: any) => ipcRenderer.invoke('strategy:correlation', { strategies }),
    generateNotifications: (ctx: any) => ipcRenderer.invoke('notification:generate', ctx),
    notificationSummary: (alerts: any[], apiKey?: string) => ipcRenderer.invoke('notification:summary', alerts, apiKey),
    generateReport: (ctx: any) => ipcRenderer.invoke('report:generate', ctx),
    generateQuickReport: (ctx: any) => ipcRenderer.invoke('report:quick', ctx),

    // Q14: Live Executor
    liveStart: (symbols?: string[]) => ipcRenderer.invoke('live:start', symbols),
    liveStop: () => ipcRenderer.invoke('live:stop'),
    liveAddStrategy: (config: any) => ipcRenderer.invoke('live:add-strategy', config),
    liveRemoveStrategy: (strategyId: string) => ipcRenderer.invoke('live:remove-strategy', strategyId),
    liveGetStatus: () => ipcRenderer.invoke('live:get-status'),
    liveGetPositions: () => ipcRenderer.invoke('live:get-positions'),
    liveGetOrders: () => ipcRenderer.invoke('live:get-orders'),

    // Q8: Market Regime Detector
    detectRegime: (klines: any, vixLevel?: number, symbol?: string) =>
      ipcRenderer.invoke('regime:detect', { klines, vixLevel, symbol }),

    // Q9: Risk Decomposition
    decomposeRisk: (equityCurve: number[], positions?: any[], confidenceLevel?: number) =>
      ipcRenderer.invoke('risk:decompose', { equityCurve, positions, confidenceLevel }),
    runMonteCarlo: (equityCurve: number[], paths?: number, horizon?: number) =>
      ipcRenderer.invoke('risk:monteCarlo', { equityCurve, paths, horizon }),

    // Q10: Anomaly Detection
    detectAnomalies: (values: number[], method?: string, window?: number, threshold?: number) =>
      ipcRenderer.invoke('anomaly:detect', { values, method, window, threshold }),
    autoTune: (ctx: any) => ipcRenderer.invoke('strategy:auto-tune', ctx),

    // Q15: Multi-Factor Model
    multiFactor: (req: { stocks?: Array<{ code: string; name: string }>; preset?: string; limit?: number }) =>
      ipcRenderer.invoke('strategy:multi-factor', req),

    // Q16: Dynamic Position Sizer
    positionSize: (req: any) => ipcRenderer.invoke('risk:position-size', req),

    // Q17: Paper Trader
    paperStart: () => ipcRenderer.invoke('paper:start'),
    paperStop: () => ipcRenderer.invoke('paper:stop'),
    paperReset: () => ipcRenderer.invoke('paper:reset'),
    paperReport: () => ipcRenderer.invoke('paper:report'),
    paperStatus: () => ipcRenderer.invoke('paper:status'),
    paperExecuteSignal: (signal: any) => ipcRenderer.invoke('paper:execute-signal', signal),

    // Q18: Strategy Templates
    getTemplates: () => ipcRenderer.invoke('strategy:templates', { action: 'list' }),
    getTemplate: (id: string) => ipcRenderer.invoke('strategy:templates', { action: 'get', id }),
    searchTemplates: (query: string) => ipcRenderer.invoke('strategy:templates', { action: 'search', query }),
    instantiateTemplate: (id: string, overrides?: any) =>
      ipcRenderer.invoke('strategy:templates', { action: 'instantiate', id, overrides }),
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
    // Q12: Stress Tester
    stressTest: (positions: any, scenarioName?: string, customFactors?: any[], portfolio?: any) =>
      ipcRenderer.invoke('risk:stress-test', { positions, scenarioName, customFactors, portfolio }),
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
    exportPdf: (filename: string) => ipcRenderer.invoke('app:exportPdf', filename),
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

  // ── EM Data Provider — Sector Heatmap (JVS-1) ────────────────────
  emDataProvider: {
    getHeatmap: (boardType?: string, limit?: number) => ipcRenderer.invoke('em:get-heatmap', boardType, limit),
    getAllHeatmaps: () => ipcRenderer.invoke('em:get-all-heatmaps'),
  },

  // ── Macro Data Provider — Dashboard (JVS-2) ──────────────────────
  macroDataProvider: {
    getIndicator: (indicator?: string, limit?: number) => ipcRenderer.invoke('em:get-macro', indicator, limit),
    getDashboard: (indicators?: string[]) => ipcRenderer.invoke('em:get-macro-dashboard', indicators),
  },

  // ── Sentiment Index (JVS-3) ─────────────────────────────────────
  sentimentIndex: {
    compute: (input?: any) => ipcRenderer.invoke('em:get-sentiment', input),
  },

  // ── Stock Screener (JVS-4) ──────────────────────────────────────
  stockScreener: {
    search: (request: any) => ipcRenderer.invoke('screener:search', request),
  },

  // ── News Aggregator (JVS-5) ────────────────────────────────────
  newsAggregator: {
    search: (request: any) => ipcRenderer.invoke('em:get-news-aggregate', request),
    getMarketMood: (symbols?: string[]) => ipcRenderer.invoke('em:get-market-mood', symbols),
  },

  // ── Sector Rotation (JVS-6) ────────────────────────────────────
  sectorRotation: {
    analyze: () => ipcRenderer.invoke('em:get-sector-rotation'),
    recordSnapshot: (sectors: any[]) => ipcRenderer.invoke('em:record-sector-snapshot', sectors),
  },

  // ── Stock Anomaly Detector (JVS-7) ─────────────────────────────
  stockAnomaly: {
    getSummary: () => ipcRenderer.invoke('em:get-anomaly-summary'),
    getAlerts: (options?: any) => ipcRenderer.invoke('em:get-anomaly-alerts', options),
    processQuotes: (quotes: any[]) => ipcRenderer.invoke('em:process-anomaly-quotes', quotes),
    acknowledgeAlert: (id: string) => ipcRenderer.invoke('em:acknowledge-anomaly', id),
  },

  // ── Market Hotspot (JVS-8) ─────────────────────────────────────
  marketHotspot: {
    getReport: (query?: any) => ipcRenderer.invoke('em:get-hotspot', query),
  },

  // ── Quote Stream — Real-time Market Data (JVS-9) ───────────────
  quoteStream: {
    start: (symbols?: string[]) => ipcRenderer.invoke('quote:stream-start', symbols),
    stop: () => ipcRenderer.invoke('quote:stream-stop'),
    status: () => ipcRenderer.invoke('quote:stream-status'),
    subscribe: (symbols: string[]) => ipcRenderer.invoke('quote:subscribe', symbols),
    unsubscribe: (symbols: string[]) => ipcRenderer.invoke('quote:unsubscribe', symbols),
  },

  // ── Dragon Tiger List — 龙虎榜 (JVS-10) ───────────────────────
  dragonTiger: {
    getList: (date?: string) => ipcRenderer.invoke('em:get-dragon-tiger', date),
    getDetail: (code: string, date: string) => ipcRenderer.invoke('em:get-dragon-tiger-detail', code, date),
    getInstitutionalTrades: (date?: string) => ipcRenderer.invoke('em:get-institutional-trades', date),
  },

  // ── Capital Flow Ranking — 资金流排行 (JVS-11) ────────────────
  capitalFlow: {
    getStockRank: (sortBy?: string, order?: string, limit?: number) => ipcRenderer.invoke('em:get-capital-flow-stock', sortBy, order, limit),
    getSectorRank: (sortBy?: string, order?: string, limit?: number) => ipcRenderer.invoke('em:get-capital-flow-sector', sortBy, order, limit),
    getConceptRank: (sortBy?: string, order?: string, limit?: number) => ipcRenderer.invoke('em:get-capital-flow-concept', sortBy, order, limit),
  },

  // ── Capital Flow Monitor — Real-time alerts (JVS-12) ──────────
  capitalFlowMonitor: {
    getAlerts: (items?: any[]) => ipcRenderer.invoke('em:get-capital-flow-alerts', items),
    setConfig: (config: any) => ipcRenderer.invoke('em:set-capital-flow-config', config),
    clearHistory: () => ipcRenderer.invoke('em:clear-capital-flow-history'),
  },

  // ── Fund Holdings — 基金持仓数据 (JVS-13) ─────────────────────
  fundHoldings: {
    getHoldings: (fundCode: string, reportDate?: string) => ipcRenderer.invoke('em:get-fund-holdings', fundCode, reportDate),
    getStockOwnership: (stockCode: string, reportDate?: string) => ipcRenderer.invoke('em:get-stock-fund-ownership', stockCode, reportDate),
    getIncreaseRank: (limit?: number, reportDate?: string) => ipcRenderer.invoke('em:get-fund-increase-rank', limit, reportDate),
    getDecreaseRank: (limit?: number, reportDate?: string) => ipcRenderer.invoke('em:get-fund-decrease-rank', limit, reportDate),
  },

  // ── Stock Diagnosis — 个股诊断聚合器 (JVS-14) ─────────────────
  stockDiagnosis: {
    diagnose: (request: any) => ipcRenderer.invoke('em:diagnose-stock', request),
    batchDiagnose: (codes: string[], options?: any) => ipcRenderer.invoke('em:batch-diagnose', codes, options),
  },

  // ── Portfolio Risk — 组合风险计算器 (JVS-15) ──────────────────
  portfolioRisk: {
    calculate: (request: any) => ipcRenderer.invoke('em:portfolio-risk', request),
  },

  // ── Market Breadth — 市场广度分析器 (JVS-16) ─────────────────
  marketBreadth: {
    get: () => ipcRenderer.invoke('em:get-market-breadth'),
  },

  // ── Consumer Data — 消费者数据服务 (JVS-17) ──────────────────
  consumerData: {
    get: (months?: number) => ipcRenderer.invoke('em:get-consumer-data', months),
  },

  // ── Margin Data — 融资融券数据服务 (JVS-18) ─────────────────
  marginData: {
    get: () => ipcRenderer.invoke('em:get-margin-data'),
    getStockMargin: (code: string, days?: number) => ipcRenderer.invoke('em:get-stock-margin', code, days),
    getMarginBalanceRank: (limit?: number) => ipcRenderer.invoke('em:get-margin-balance-rank', limit),
    getShortInterestRank: (limit?: number) => ipcRenderer.invoke('em:get-short-interest-rank', limit),
  },

  // ── EMI Unified Service Layer (JVS-19) ─────────────────────────
  emiUnified: {
    getStockOverview: (code: string) => ipcRenderer.invoke('em:get-stock-overview', code),
    getMarketOverview: () => ipcRenderer.invoke('em:get-market-overview'),
    getDailyReport: () => ipcRenderer.invoke('em:get-daily-report'),
  },

  // ── Python Script Proxy Layer (JVS-20) ─────────────────────────
  pythonProxy: {
    callSkill: (skillName: string, query: string, options?: any) => ipcRenderer.invoke('py:call-skill', skillName, query, options),
    listSkills: () => ipcRenderer.invoke('py:list-skills'),
    getStatus: () => ipcRenderer.invoke('py:proxy-status'),
  },

  // ── Data Scheduler ─────────────────────────────────────────────
  dataScheduler: {
    getStatus: () => ipcRenderer.invoke('data:scheduler-status'),
    refreshNow: (module?: string) => ipcRenderer.invoke('data:scheduler-refresh', module),
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
      'quote:stream-tick',
      'quote:stream-anomaly',
    ];
    if (allowed.includes(channel)) {
      ipcRenderer.on(channel, (_event, ...args) => callback(...args));
    }
  },

  off: (channel: string, callback: (...args: any[]) => void) => {
    ipcRenderer.removeListener(channel, callback);
  },
});

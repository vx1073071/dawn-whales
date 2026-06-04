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

    // JVS-47: OpenD Connection Validator
    opendValidate: () => ipcRenderer.invoke('opend:validate'),
    opendGetStatus: () => ipcRenderer.invoke('opend:getStatus'),

    // JVS-46: Strategy Signal Generator
    signalGenerate: (config: any) => ipcRenderer.invoke('signal:generate', config),
    signalGenerateBatch: (configs: any[]) => ipcRenderer.invoke('signal:generate-batch', configs),
    signalValidateBacktest: (config: any) => ipcRenderer.invoke('signal:validate-backtest', config),

    // Q8: Market Regime Detector
    detectRegime: (klines: any, vixLevel?: number, symbol?: string) =>
      ipcRenderer.invoke('regime:detect', { klines, vixLevel, symbol }),

    // Q64: Backtest Stability
    checkBacktestStability: (params: {
      isReturns: number[]; oosReturns: number[]; paramGridResults?: any[];
      walkForwardResults?: any[]; isPeriodDays?: number; oosPeriodDays?: number; tradingDays?: number;
    }) => ipcRenderer.invoke('backtest:stability', params),

    // Q63: Signal Quality Score
    scoreSignalQuality: (params: {
      signalType: string; marketContext?: any; backtestHistory?: any[]; signalParams?: any;
    }) => ipcRenderer.invoke('signal:quality-score', params),

    // Q68: Position Alert Check
    checkPositionAlerts: (positions: any[], accountFunds: number, config?: any) =>
      ipcRenderer.invoke('position:check', { positions, accountFunds, config }),

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

    // Q19: OpenD Health Check
    opendHealth: (req?: any) => ipcRenderer.invoke('system:opend-health', req),
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

  // ── Correlation Matrix v2 (JVS-47) ─────────────────────────────
  correlationMatrix: {
    compute: (params: any) => ipcRenderer.invoke('em:correlation-matrix', params),
  },

  // ── Sector Rotation v2 (JVS-48) ────────────────────────────────
  sectorRotationV2: {
    detect: (params: any) => ipcRenderer.invoke('em:sector-rotation', params),
  },

  // ── Valuation Dashboard (JVS-49) ───────────────────────────────
  valuationDashboard: {
    get: (codes: string[], historyDays?: number) => ipcRenderer.invoke('data:valuation-dashboard', codes, historyDays),
    batch: (codes: string[], batchSize?: number, delayMs?: number) => ipcRenderer.invoke('data:valuation-dashboard-batch', codes, batchSize, delayMs),
  },

  // ── Sector Comparison (JVS-50) ─────────────────────────────────
  sectorComparison: {
    compare: (stocks: any[], financialData: any) => ipcRenderer.invoke('data:sector-compare', stocks, financialData),
    compareMultiple: (sectors: any[], financialData: any) => ipcRenderer.invoke('data:sector-compare-multiple', sectors, financialData),
    rank: (metrics: any[], weights?: any) => ipcRenderer.invoke('data:sector-rank', metrics, weights),
  },

  // ── Macro Alert (JVS-51) ───────────────────────────────────────
  macroAlert: {
    detect: (currentData: any[], historicalData: any) => ipcRenderer.invoke('alert:macro', currentData, historicalData),
    detectMultiple: (indicatorData: any[]) => ipcRenderer.invoke('alert:macro-multiple', indicatorData),
  },

  // ── Correlation Alert (JVS-52) ─────────────────────────────────
  correlationAlert: {
    detect: (snapshots: any[], historicalData: any) => ipcRenderer.invoke('alert:correlation', snapshots, historicalData),
    detectMatrix: (matrix: number[][], codes: string[], prevMatrix?: number[][], histMatrices?: any) => ipcRenderer.invoke('alert:correlation-matrix', matrix, codes, prevMatrix, histMatrices),
  },

  // ── Walk-Forward Report (JVS-53) ───────────────────────────────
  walkForwardReport: {
    generate: (strategyName: string, windows: any[]) => ipcRenderer.invoke('report:walk-forward', strategyName, windows),
    generateBatch: (strategies: any[]) => ipcRenderer.invoke('report:walk-forward-batch', strategies),
  },

  // ── Brinson Attribution (JVS-54) ──────────────────────────────
  brinsonAttribution: {
    generate: (holdings: any[], benchmark: any[], benchmarkReturn: number) => ipcRenderer.invoke('report:brinson-attribution', holdings, benchmark, benchmarkReturn),
    generateBatch: (portfolios: any[]) => ipcRenderer.invoke('report:brinson-batch', portfolios),
  },

  // ── Options Chain Analyzer (JVS-55) ───────────────────────────
  optionsChain: {
    analyze: (contracts: any[], symbol: string, historicalIVRange?: any) => ipcRenderer.invoke('options:chain-analyze', contracts, symbol, historicalIVRange),
    analyzeBatch: (symbols: any[]) => ipcRenderer.invoke('options:chain-batch', symbols),
  },

  // ── Multi-Factor Selector (JVS-56) ────────────────────────────
  multiFactor: {
    score: (stocks: any[], factorWeights?: any) => ipcRenderer.invoke('factor:score', stocks, factorWeights),
    screen: (stocks: any[], criteria: any, factorWeights?: any) => ipcRenderer.invoke('factor:screen', stocks, criteria, factorWeights),
    screenBatch: (batches: any[]) => ipcRenderer.invoke('factor:screen-batch', batches),
  },

  // ── Portfolio Optimizer (JVS-57) ──────────────────────────────
  portfolioOptimizer: {
    optimize: (assets: any[], constraints?: any) => ipcRenderer.invoke('portfolio:optimize', assets, constraints),
    efficientFrontier: (assets: any[], points?: number, constraints?: any) => ipcRenderer.invoke('portfolio:efficient-frontier', assets, points, constraints),
    riskParity: (assets: any[], constraints?: any) => ipcRenderer.invoke('portfolio:risk-parity', assets, constraints),
    optimizeBatch: (scenarios: any[]) => ipcRenderer.invoke('portfolio:optimize-batch', scenarios),
    rebalance: (positions: any[], targetWeights: Record<string, number>, dryRun?: boolean, driftThreshold?: number, maxTurnover?: number) =>
      ipcRenderer.invoke('portfolio:rebalance', { positions, targetWeights, dryRun, driftThreshold, maxTurnover }),
    rebalanceKelly: (positions: any[], kellyFraction?: number, maxTurnover?: number) =>
      ipcRenderer.invoke('portfolio:rebalance-kelly', { positions, kellyFraction, maxTurnover }),
    costAnalyze: (positions: any[], trades: any[], periodDays?: number) =>
      ipcRenderer.invoke('portfolio:cost-analyze', { positions, trades, periodDays }),
    rarOptimize: (positions: any[], marketData?: any, riskAppetite?: string, constraints?: any) =>
      ipcRenderer.invoke('portfolio:rar-optimize', { positions, marketData, riskAppetite, constraints }),
  },

  // ── Execution Analytics (Q29) ──────────────────────────────────
  executionAnalytics: {
    analyze: (params: { executionRecords: any[]; marketData?: any; benchmarkPrice?: number; optionsScope?: any }) =>
      ipcRenderer.invoke('execution:analyze', params),
  },

  // ── Options Strategy Builder (Q55) ─────────────────────────────
  optionsBuilder: {
    build: (params: { underlying: string; spotPrice: number; strategyType?: string; targetParams?: any; legs?: any[] }) =>
      ipcRenderer.invoke('options:build', params),
    analyze: (params: { strategy: any; spotPrice: number; volatility?: number; riskFreeRate?: number; dividends?: any }) =>
      ipcRenderer.invoke('options:analyze', params),
  },

  // ── Real Trader (Q20) ──────────────────────────────────────────
  realTrader: {
    execute: (signal: any, paperMode?: boolean) =>
      ipcRenderer.invoke('trader:execute', { signal, paperMode }),
    getStatus: () => ipcRenderer.invoke('trader:get-status'),
  },

  // ── WebSocket Real-time Data Enhancer (JVS-58) ────────────────
  websocketEnhancer: {
    connect: (config: any) => ipcRenderer.invoke('ws:connect', config),
    disconnect: () => ipcRenderer.invoke('ws:disconnect'),
    subscribe: (symbol: string) => ipcRenderer.invoke('ws:subscribe', symbol),
    unsubscribe: (symbol: string) => ipcRenderer.invoke('ws:unsubscribe', symbol),
    subscribeBatch: (symbols: string[]) => ipcRenderer.invoke('ws:subscribe-batch', symbols),
    unsubscribeBatch: (symbols: string[]) => ipcRenderer.invoke('ws:unsubscribe-batch', symbols),
    status: () => ipcRenderer.invoke('ws:status'),
    streamingStats: () => ipcRenderer.invoke('ws:streaming-stats'),
  },

  // ── Backfill Service (JVS-59) ─────────────────────────────────
  backfillService: {
    start: (config: any) => ipcRenderer.invoke('backfill:start', config),
    stop: () => ipcRenderer.invoke('backfill:stop'),
    status: () => ipcRenderer.invoke('backfill:status'),
    stats: () => ipcRenderer.invoke('backfill:stats'),
    symbols: (symbols: string[], startDate: string, endDate: string, interval?: any) => ipcRenderer.invoke('backfill:symbols', symbols, startDate, endDate, interval),
    incremental: (symbol: string, startDate: string, endDate: string, existingRecords: any[]) => ipcRenderer.invoke('backfill:incremental', symbol, startDate, endDate, existingRecords),
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

  // ── Push2 Proxy Service (JVS-27) ──────────────────────────────
  push2Proxy: {
    getSectorHeatmap: (type?: string, limit?: number) => ipcRenderer.invoke('push2:get-sector-heatmap', type, limit),
    getCapitalFlowRank: (type?: string, limit?: number) => ipcRenderer.invoke('push2:get-capital-flow-rank', type, limit),
    getStockQuote: (secid: string) => ipcRenderer.invoke('push2:get-stock-quote', secid),
    getMarketBreadth: () => ipcRenderer.invoke('push2:get-market-breadth'),
    getStatus: () => ipcRenderer.invoke('push2:proxy-status'),
    clearCache: () => ipcRenderer.invoke('push2:clear-cache'),
  },

  // ── Data Quality Monitor (JVS-22) ──────────────────────────────
  dataQuality: {
    runCheck: () => ipcRenderer.invoke('data:quality-check'),
    getReport: () => ipcRenderer.invoke('data:quality-report'),
    acknowledgeAlert: (alertIndex: number) => ipcRenderer.invoke('data:quality-acknowledge', alertIndex),
    clearAcknowledged: () => ipcRenderer.invoke('data:quality-clear-acknowledged'),
    startPeriodic: (intervalMs?: number) => ipcRenderer.invoke('data:quality-start-periodic', intervalMs),
    stopPeriodic: () => ipcRenderer.invoke('data:quality-stop-periodic'),
  },

  // ── Data Quality Stream Monitor (JVS-31) ───────────────────────
  dataQualityStream: {
    start: () => ipcRenderer.invoke('data:quality-stream-start'),
    stop: () => ipcRenderer.invoke('data:quality-stream-stop'),
    status: () => ipcRenderer.invoke('data:quality-stream-status'),
    clearAlerts: () => ipcRenderer.invoke('data:quality-stream-clear-alerts'),
    resetMetrics: () => ipcRenderer.invoke('data:quality-stream-reset-metrics'),
    onAlert: (callback: (alert: any) => void) => {
      ipcRenderer.on('data:quality-stream-alert', (_event, alert) => callback(alert));
    },
  },

  // ── Realtime Sentiment Stream (JVS-33) ───────────────────────
  sentimentStream: {
    start: () => ipcRenderer.invoke('sentiment:stream-start'),
    stop: () => ipcRenderer.invoke('sentiment:stream-stop'),
    status: () => ipcRenderer.invoke('sentiment:stream-status'),
    history: (limit?: number) => ipcRenderer.invoke('sentiment:stream-history', limit),
    alerts: () => ipcRenderer.invoke('sentiment:stream-alerts'),
    clearAlerts: () => ipcRenderer.invoke('sentiment:stream-clear-alerts'),
    onTick: (callback: (tick: any) => void) => {
      ipcRenderer.on('sentiment:stream-tick', (_event, tick) => callback(tick));
    },
    onAlert: (callback: (alert: any) => void) => {
      ipcRenderer.on('sentiment:stream-alert', (_event, alert) => callback(alert));
    },
  },

  // ── Data Quality Dashboard (JVS-34) ─────────────────────────
  dataQualityDashboard: {
    get: () => ipcRenderer.invoke('data:quality-dashboard'),
  },

  // ── Cache Explorer (JVS-35) ─────────────────────────────────
  cacheExplorer: {
    explore: () => ipcRenderer.invoke('cache:explore'),
    entryDetail: (namespace: string, key: string) => ipcRenderer.invoke('cache:entry-detail', namespace, key),
    keysPaginated: (namespace: string, limit?: number, offset?: number) => ipcRenderer.invoke('cache:keys-paginated', namespace, limit, offset),
  },

  // ── Sentiment Dashboard (JVS-36) ────────────────────────────
  sentimentDashboard: {
    get: () => ipcRenderer.invoke('sentiment:dashboard'),
  },

  // ── Data Export Service (JVS-37) ────────────────────────────
  dataExport: {
    export: (request: any) => ipcRenderer.invoke('data:export', request),
    getModules: () => ipcRenderer.invoke('data:export-modules'),
  },

  // ── Rate Limiter (JVS-38) ───────────────────────────────────
  rateLimiter: {
    stats: (apiName?: string) => ipcRenderer.invoke('rate-limiter:stats', apiName),
    reset: () => ipcRenderer.invoke('rate-limiter:reset'),
    getAPIs: () => ipcRenderer.invoke('rate-limiter:apis'),
  },

  // ── Data Consistency Checker (JVS-39) ───────────────────────
  dataConsistency: {
    check: () => ipcRenderer.invoke('data:consistency-check'),
    getRules: () => ipcRenderer.invoke('data:consistency-rules'),
  },

  // ── Smart Cache Manager (JVS-32) ───────────────────────────────
  smartCache: {
    get: (namespace: string, key: string) => ipcRenderer.invoke('cache:get', namespace, key),
    set: (namespace: string, key: string, value: any, ttl?: number) => ipcRenderer.invoke('cache:set', namespace, key, value, ttl),
    has: (namespace: string, key: string) => ipcRenderer.invoke('cache:has', namespace, key),
    delete: (namespace: string, key: string) => ipcRenderer.invoke('cache:delete', namespace, key),
    clear: (namespace?: string) => ipcRenderer.invoke('cache:clear', namespace),
    stats: (namespace?: string) => ipcRenderer.invoke('cache:stats', namespace),
    resetStats: (namespace?: string) => ipcRenderer.invoke('cache:reset-stats', namespace),
    keys: (namespace: string) => ipcRenderer.invoke('cache:keys', namespace),
  },

  // ── Dragon Tiger Stream (JVS-22 PM) ───────────────────────────
  dragonTigerStream: {
    start: () => ipcRenderer.invoke('em:dragon-tiger-stream-start'),
    stop: () => ipcRenderer.invoke('em:dragon-tiger-stream-stop'),
    fetchNow: () => ipcRenderer.invoke('em:dragon-tiger-stream-fetch'),
    status: () => ipcRenderer.invoke('em:dragon-tiger-stream-status'),
  },

  // ── Unlock Calendar (JVS-23 PM) ───────────────────────────────
  unlockCalendar: {
    get: (days?: number) => ipcRenderer.invoke('em:get-unlock-calendar', days),
  },

  // ── Dividend Calendar (JVS-24 PM) ─────────────────────────────
  dividendCalendar: {
    get: (days?: number) => ipcRenderer.invoke('em:get-dividend-calendar', days),
  },

  // ── Earnings Calendar (JVS-25 PM) ─────────────────────────────
  earningsCalendar: {
    get: (days?: number) => ipcRenderer.invoke('em:get-earnings-calendar', days),
  },

  // ── Data Exporter (JVS-26 PM) ─────────────────────────────────
  dataExporter: {
    export: (type: string, format?: string) => ipcRenderer.invoke('em:export-data', type, format),
  },

  // ── Smart Picker (JVS-25 PM Round 2) ─────────────────────────
  smartPicker: {
    pick: (request?: any) => ipcRenderer.invoke('em:smart-pick', request),
  },

  // ── WS Data Stream (JVS-29) ────────────────────────────────────
  wsStream: {
    start: (config?: any) => ipcRenderer.invoke('ws:start-stream', config),
    stop: () => ipcRenderer.invoke('ws:stop-stream'),
    subscribe: (codes: string[]) => ipcRenderer.invoke('ws:subscribe', codes),
    unsubscribe: (codes: string[]) => ipcRenderer.invoke('ws:unsubscribe', codes),
    status: () => ipcRenderer.invoke('ws:stream-status'),
  },

  // ── History Backfill (JVS-30) ──────────────────────────────────
  historyBackfill: {
    start: (config?: any) => ipcRenderer.invoke('em:backfill-start', config),
    status: () => ipcRenderer.invoke('em:backfill-status'),
    data: (module: string) => ipcRenderer.invoke('em:backfill-data', module),
    list: () => ipcRenderer.invoke('em:backfill-list'),
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

  // ── i18n Data Layer (JVS-40) ────────────────────────────────────────
  i18n: {
    translateField: (field: string, category: string, lang: string) => ipcRenderer.invoke('i18n:translate-field', field, category, lang),
    translateFields: (fields: string[], category: string, lang: string) => ipcRenderer.invoke('i18n:translate-fields', fields, category, lang),
    getAllTranslations: (category: string) => ipcRenderer.invoke('i18n:get-all-translations', category),
    getSupportedLanguages: () => ipcRenderer.invoke('i18n:get-supported-languages'),
  },

  // ── Financial Reports (JVS-41) ─────────────────────────────────────
  financialReports: {
    get: (code: string, quarters?: number) => ipcRenderer.invoke('em:get-financials', code, quarters),
  },

  // ── Valuation Data (JVS-42) ────────────────────────────────────────
  valuation: {
    get: (code: string, historyDays?: number) => ipcRenderer.invoke('em:get-valuation', code, historyDays),
  },

  // ── Technical Indicators (JVS-43) ──────────────────────────────────
  indicators: {
    compute: (klines: any[], indicators?: string[], options?: any) => ipcRenderer.invoke('indicator:compute', klines, indicators, options),
  },

  // ── Realtime Technical Indicators (JVS-36) ─────────────────────────
  realtimeIndicators: {
    addKLine: (symbol: string, kline: any) => ipcRenderer.invoke('indicator:realtime-add', symbol, kline),
    addKLines: (symbol: string, klines: any[]) => ipcRenderer.invoke('indicator:realtime-add-batch', symbol, klines),
    getBuffer: (symbol: string) => ipcRenderer.invoke('indicator:realtime-get-buffer', symbol),
    clearBuffer: (symbol: string) => ipcRenderer.invoke('indicator:realtime-clear', symbol),
    clearAll: () => ipcRenderer.invoke('indicator:realtime-clear-all'),
  },

  // ── Options Pricing Engine (JVS-44) ────────────────────────────────
  optionsPricing: {
    priceOption: (params: any) => ipcRenderer.invoke('em:price-option', params),
    calcGreeks: (params: any) => ipcRenderer.invoke('em:calc-greeks', params),
    impliedVol: (marketPrice: number, S: number, K: number, T: number, r: number, optionType: string, q?: number) => ipcRenderer.invoke('em:implied-vol', marketPrice, S, K, T, r, optionType, q),
    volSurface: (S: number, r: number, strikes: number[], expiries: number[], callPrices: number[][], putPrices?: number[][]) => ipcRenderer.invoke('em:vol-surface', S, r, strikes, expiries, callPrices, putPrices),
    priceAndGreeks: (params: any) => ipcRenderer.invoke('em:price-and-greeks', params),
  },

  // ── Risk Metrics Calculator (JVS-46) ───────────────────────────────
  riskMetrics: {
    calculate: (params: any) => ipcRenderer.invoke('em:calc-risk-metrics', params),
    calcSharpe: (returns: number[], riskFreeRate?: number, tradingDays?: number) => ipcRenderer.invoke('em:calc-sharpe', returns, riskFreeRate, tradingDays),
    calcMaxDrawdown: (returns: number[]) => ipcRenderer.invoke('em:calc-max-drawdown', returns),
    calcVaR: (returns: number[], confidence?: number) => ipcRenderer.invoke('em:calc-var', returns, confidence),
  },

  // ── Performance Attribution (JVS-45) ───────────────────────────────
  performanceAttribution: {
    brinson: (params: any) => ipcRenderer.invoke('em:portfolio-attribution', params),
    timeSeries: (params: any) => ipcRenderer.invoke('em:time-series-attribution', params),
  },

  // ── Snapshot Service (JVS-39) ───────────────────────────────────
  snapshotService: {
    capture: (type: string, category: string, data: any, metadata?: any) =>
      ipcRenderer.invoke('snapshot:capture', type, category, data, metadata),
    query: (query: any) => ipcRenderer.invoke('snapshot:query', query),
    get: (id: string) => ipcRenderer.invoke('snapshot:get', id),
    compare: (id1: string, id2: string) => ipcRenderer.invoke('snapshot:compare', id1, id2),
    timeline: (category: string, limit?: number) => ipcRenderer.invoke('snapshot:timeline', category, limit),
    latest: (category: string) => ipcRenderer.invoke('snapshot:latest', category),
    cleanup: (daysOld?: number) => ipcRenderer.invoke('snapshot:cleanup', daysOld),
    export: (query?: any) => ipcRenderer.invoke('snapshot:export', query),
    import: (jsonString: string) => ipcRenderer.invoke('snapshot:import', jsonString),
    stats: () => ipcRenderer.invoke('snapshot:stats'),
    delete: (id: string) => ipcRenderer.invoke('snapshot:delete', id),
    clear: () => ipcRenderer.invoke('snapshot:clear'),
  },

  // ── Version Control Service (JVS-40) ──────────────────────────
  versionControl: {
    track: (entityId: string, entityType: string, data: any, changeType?: string, changeSummary?: string, userId?: string, tags?: string[]) =>
      ipcRenderer.invoke('version:track', entityId, entityType, data, changeType, changeSummary, userId, tags),
    getEntityVersions: (entityId: string, limit?: number) => ipcRenderer.invoke('version:get-entity-versions', entityId, limit),
    get: (versionId: string) => ipcRenderer.invoke('version:get', versionId),
    getLatest: (entityId: string) => ipcRenderer.invoke('version:get-latest', entityId),
    diff: (versionId1: string, versionId2: string) => ipcRenderer.invoke('version:diff', versionId1, versionId2),
    rollback: (entityId: string, targetVersion: number) => ipcRenderer.invoke('version:rollback', entityId, targetVersion),
    query: (query: any) => ipcRenderer.invoke('version:query', query),
    stats: () => ipcRenderer.invoke('version:stats'),
    delete: (versionId: string) => ipcRenderer.invoke('version:delete', versionId),
    clear: () => ipcRenderer.invoke('version:clear'),
    export: (query?: any) => ipcRenderer.invoke('version:export', query),
    import: (jsonString: string) => ipcRenderer.invoke('version:import', jsonString),
  },


  // ── Data Aggregator (JVS-56) ───────────────────────────────────────────
  dataAggregator: {
    aggregate: (codes: string[]) => ipcRenderer.invoke("data:aggregate", codes),
    stats: () => ipcRenderer.invoke("data:aggregator-stats"),
    clearCache: () => ipcRenderer.invoke("data:aggregator-clear-cache"),
  },

  // ── Data Pipeline (JVS-57) ─────────────────────────────────────────────
  dataPipeline: {
    clean: (point: any) => ipcRenderer.invoke('data:clean', point),
    cleanBatch: (points: any[]) => ipcRenderer.invoke('data:clean-batch', points),
    stats: () => ipcRenderer.invoke('data:pipeline-stats'),
    clearHistory: (code?: string) => ipcRenderer.invoke('data:pipeline-clear-history', code),
  },

  // ── Historical Data Warehouse (JVS-58) ──────────────────────────────────
  historicalWarehouse: {
    insert: (points: any[]) => ipcRenderer.invoke('historical:insert', points),
    query: (symbol: string, timeRange: any, limit?: number) => ipcRenderer.invoke('historical:query', symbol, timeRange, limit),
    aggregate: (symbol: string, timeRange: any, interval: string) => ipcRenderer.invoke('historical:aggregate', symbol, timeRange, interval),
    stats: () => ipcRenderer.invoke('historical:stats'),
    cleanOld: (retentionDays?: number) => ipcRenderer.invoke('historical:clean-old', retentionDays),
  },

  // ── Data Versioning (JVS-59) ────────────────────────────────────────────
  dataVersioning: {
    create: (tableName: string, metadata?: Record<string, any>) => ipcRenderer.invoke('version:create', tableName, metadata),
    getVersions: (tableName: string, limit?: number) => ipcRenderer.invoke('version:get-versions', tableName, limit),
    get: (versionId: string) => ipcRenderer.invoke('version:get', versionId),
    rollback: (versionId: string) => ipcRenderer.invoke('version:rollback', versionId),
    compare: (versionId1: string, versionId2: string) => ipcRenderer.invoke('version:compare', versionId1, versionId2),
    cleanupOld: (tableName: string, keepCount?: number) => ipcRenderer.invoke('version:cleanup-old', tableName, keepCount),
  },

  // ── Feature Store (JVS-60) ─────────────────────────────────────────────
  featureStore: {
    compute: (symbol: string, klines: any[]) => ipcRenderer.invoke('feature:compute', symbol, klines),
    getCached: (symbol: string) => ipcRenderer.invoke('feature:get-cached', symbol),
    getDefinitions: () => ipcRenderer.invoke('feature:get-definitions'),
    save: (features: any[]) => ipcRenderer.invoke('feature:save', features),
    query: (symbol: string, featureNames: string[], limit?: number) => ipcRenderer.invoke('feature:query', symbol, featureNames, limit),
  },

  // ── Stream Computing (JVS-61) ──────────────────────────────────────────
  streamComputing: {
    processTick: (tick: any) => ipcRenderer.invoke('stream:process-tick', tick),
    getAggregated: (symbol: string) => ipcRenderer.invoke('stream:get-aggregated', symbol),
    getMetrics: (symbol: string) => ipcRenderer.invoke('stream:get-metrics', symbol),
    getSymbols: () => ipcRenderer.invoke('stream:get-symbols'),
    clearSymbol: (symbol: string) => ipcRenderer.invoke('stream:clear-symbol', symbol),
    clearAll: () => ipcRenderer.invoke('stream:clear-all'),
  },

  // ── Strategy Signal Generator (JVS-46) ──────────────────────────
  signalGenerator: {
    generate: (raw: any) => ipcRenderer.invoke('signal:generate', raw),
    generateBatch: (raw: any) => ipcRenderer.invoke('signal:generate-batch', raw),
    validateBacktest: (raw: any) => ipcRenderer.invoke('signal:validate-backtest', raw),
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
      'dragon-tiger:update',
      'ws:tick',
    ];
    if (allowed.includes(channel)) {
      ipcRenderer.on(channel, (_event, ...args) => callback(...args));
    }
  },

  off: (channel: string, callback: (...args: any[]) => void) => {
    ipcRenderer.removeListener(channel, callback);
  },
});

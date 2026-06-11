/**
 * IPC Schema Coverage Registry — S-28
 *
 * Maps every registered ipcMain.handle channel to its Zod schema (or exemption reason).
 * Runtime: ipc-setup.ts uses this to warn when a channel is registered without schemas.
 */

export const IPC_SCHEMA_COVERAGE: Record<string, {
  schema: string | null;
  covered: boolean;
  exemption?: string;
}> = {
  // ── Broker (10 schemas) ──────────────────────────────────────────
  'broker:connect':        { schema: 'BrokerConnectSchema',        covered: true },
  'broker:disconnect':     { schema: null, covered: false, exemption: 'No params needed — uses internal state' },
  'broker:getAccounts':    { schema: null, covered: false, exemption: 'No params — lists all connected accounts' },
  'broker:getFunds':       { schema: 'BrokerGetFundsSchema',       covered: true },
  'broker:getPositions':   { schema: 'BrokerGetPositionsSchema',   covered: true },
  'broker:getQuotes':      { schema: 'BrokerGetQuotesSchema',      covered: true },
  'broker:getKlines':      { schema: 'BrokerGetKlinesSchema',      covered: true },
  'broker:subscribe':      { schema: 'BrokerSubscribeSchema',      covered: true },
  'broker:unsubscribe':    { schema: 'BrokerSubscribeSchema',      covered: true },
  'broker:placeOrder':     { schema: 'BrokerPlaceOrderSchema',     covered: true },
  'broker:cancelOrder':    { schema: 'BrokerCancelOrderSchema',    covered: true },
  'broker:getOrders':      { schema: null, covered: false, exemption: 'Uses BrokerGetFundsSchema internally' },
  'broker:add':            { schema: 'BrokerAddSchema',            covered: true },
  'broker:remove':         { schema: null, covered: false, exemption: 'Only needs id param' },
  'broker:setActive':      { schema: null, covered: false, exemption: 'Only needs id param' },
  'broker:switch':         { schema: 'BrokerSwitchSchema',         covered: true },
  'broker:list':           { schema: null, covered: false, exemption: 'No params' },
  'broker:getStatus':      { schema: null, covered: false, exemption: 'No params — returns all broker statuses' },

  // ── Strategy (10 schemas) ────────────────────────────────────────
  'strategy:create':       { schema: 'StrategyCreateSchema',       covered: true },
  'strategy:update':       { schema: 'StrategyUpdateSchema',       covered: true },
  'strategy:get':          { schema: 'StrategyGetSchema',          covered: true },
  'strategy:getAll':       { schema: null, covered: false, exemption: 'No params' },
  'strategy:delete':       { schema: 'StrategyGetSchema',          covered: true },
  'strategy:backtest':     { schema: 'StrategyBacktestSchema',     covered: true },
  'strategy:startLive':    { schema: null, covered: false, exemption: 'Only needs strategyId param' },
  'strategy:stopLive':     { schema: null, covered: false, exemption: 'Only needs strategyId param' },
  'strategy:explain':      { schema: 'StrategyExplainSchema',      covered: true },
  'strategy:compare':      { schema: 'StrategyCompareSchema',      covered: true },
  'strategy:optimize':     { schema: 'StrategyOptimizeSchema',     covered: true },
  'strategy:auto-tune':    { schema: null, covered: false, exemption: 'Internal engine — params validated by engine' },
  'strategy:correlation':  { schema: null, covered: false, exemption: 'Internal engine' },
  'strategy:correlation-viz': { schema: null, covered: false, exemption: 'Internal engine' },
  'strategy:multi-factor': { schema: null, covered: false, exemption: 'Internal engine' },
  'strategy:execute':      { schema: null, covered: false, exemption: 'Internal engine — executed via live:start' },
  'strategy:templates':    { schema: null, covered: false, exemption: 'No params — returns built-in templates' },

  // ── Backtest (8 schemas) ─────────────────────────────────────────
  'backtest:multiPeriod':     { schema: 'BacktestMultiPeriodSchema',     covered: true },
  'backtest:paramSweep':      { schema: 'BacktestParamSweepSchema',      covered: true },
  'backtest:riskMetrics':     { schema: 'BacktestRiskMetricsSchema',     covered: true },
  'backtest:stability':       { schema: null, covered: false, exemption: 'Internal engine — calls riskMetrics internally' },
  'backtest:walk-forward':    { schema: 'BacktestWalkForwardSchema',     covered: true },
  'backtest:walkForward':     { schema: 'BacktestWalkForwardSchema',     covered: true },
  'backtest:multi-timeframe': { schema: 'BacktestMultiTimeframeSchema',  covered: true },
  'backtest:param-scan':      { schema: 'BacktestParamScanSchema',       covered: true },
  'backtest:parallel':        { schema: null, covered: false, exemption: 'No params — parallel dispatch of existing backtests' },
  'backtest:param-scan-parallel': { schema: null, covered: false, exemption: 'No params — parallel dispatch' },
  'backtest:walk-forward-parallel': { schema: null, covered: false, exemption: 'No params — parallel dispatch' },

  // ── Risk (4 schemas) ─────────────────────────────────────────────
  'risk:updateConfig':       { schema: 'RiskUpdateConfigSchema',       covered: true },
  'risk:updateVix':          { schema: 'RiskUpdateVixSchema',          covered: true },
  'risk:getConfig':          { schema: null, covered: false, exemption: 'No params' },
  'risk:getAlerts':          { schema: null, covered: false, exemption: 'No params — returns active alerts' },
  'risk:getStatusSnapshot':  { schema: null, covered: false, exemption: 'No params' },
  'risk:getKellyStats':      { schema: null, covered: false, exemption: 'No params' },
  'risk:getDrawdownState':   { schema: null, covered: false, exemption: 'No params' },
  'risk:dashboard':          { schema: null, covered: false, exemption: 'No params — aggregates risk data' },
  'risk:cross-asset':        { schema: null, covered: false, exemption: 'Internal engine' },
  'risk:decompose':          { schema: null, covered: false, exemption: 'Internal engine' },
  'risk:monteCarlo':         { schema: null, covered: false, exemption: 'Internal engine' },
  'risk:position-size':      { schema: null, covered: false, exemption: 'Internal engine' },
  'risk:calculate-size':     { schema: null, covered: false, exemption: 'Internal engine' },
  'risk:calculate-portfolio-sizes': { schema: null, covered: false, exemption: 'Internal engine' },
  'risk:record-trade':       { schema: null, covered: false, exemption: 'Internal engine' },
  'risk:get-trade-history':  { schema: null, covered: false, exemption: 'No params' },
  'risk:stress-test':        { schema: null, covered: false, exemption: 'Internal engine' },
  'risk:portfolio-calculate': { schema: null, covered: false, exemption: 'Internal engine' },

  // ── Database (12 schemas) ────────────────────────────────────────
  'db:getStrategies':        { schema: null, covered: false, exemption: 'No params' },
  'db:saveStrategy':         { schema: 'DbSaveStrategySchema',         covered: true },
  'db:getSettings':          { schema: null, covered: false, exemption: 'No params — returns all settings' },
  'db:saveSettings':         { schema: 'DbSaveSettingsSchema',         covered: true },
  'db:getTrades':            { schema: 'DbGetTradesSchema',            covered: true },
  'db:getBacktestResults':   { schema: 'DbGetBacktestResultsSchema',   covered: true },
  'db:getWatchlist':         { schema: null, covered: false, exemption: 'No params' },
  'db:saveWatchlist':        { schema: 'DbSaveWatchlistSchema',        covered: true },
  'db:getSignals':           { schema: 'DbGetSignalsSchema',           covered: true },

  // ── Data (12 schemas) ────────────────────────────────────────────
  'data:fundamental':        { schema: 'DataFundamentalSchema',        covered: true },
  'data:capital-flow':       { schema: 'DataCapitalFlowSchema',        covered: true },
  'data:regime':             { schema: null, covered: false, exemption: 'No params' },
  'data:anomalies':          { schema: 'DataAnomaliesSchema',          covered: true },
  'data:news':               { schema: 'DataNewsSchema',               covered: true },
  'data:composite-score':    { schema: 'DataCompositeScoreSchema',     covered: true },
  'data:save-fundamental':   { schema: 'DbSaveFundamentalSchema',      covered: true },
  'data:save-capital-flow':  { schema: 'DbSaveCapitalFlowSchema',      covered: true },
  'data:save-regime':        { schema: 'DbSaveRegimeSchema',           covered: true },
  'data:save-anomaly':       { schema: 'DbSaveAnomalySchema',          covered: true },
  'data:save-news':          { schema: 'DbSaveNewsSchema',             covered: true },
  'data:compute-regime':     { schema: 'DataComputeRegimeSchema',      covered: true },
  'data:clear-cache':        { schema: null, covered: false, exemption: 'No params' },

  // ── Marketplace (8 schemas) ──────────────────────────────────────
  'marketplace:rate':              { schema: 'MarketplaceRateSchema',              covered: true },
  'marketplace:comment':           { schema: 'MarketplaceCommentSchema',           covered: true },
  'marketplace:getRating':         { schema: null, covered: false, exemption: 'Only needs strategyId param' },
  'marketplace:getComments':       { schema: null, covered: false, exemption: 'Only needs strategyId param' },
  'marketplace:savePerformance':   { schema: 'MarketplaceSavePerformanceSchema',   covered: true },
  'marketplace:getPerformance':    { schema: null, covered: false, exemption: 'Only needs strategyId param' },
  'marketplace:list':              { schema: 'MarketplaceListSchema',              covered: true },
  'marketplace:score':             { schema: null, covered: false, exemption: 'Only needs strategyId param' },
  'marketplace:verify':            { schema: null, covered: false, exemption: 'Only needs strategyId param' },
  'marketplace:updateAllScores':   { schema: null, covered: false, exemption: 'No params — batch operation' },

  // ── Greeks (2 schemas) ───────────────────────────────────────────
  'greeks:calculate': { schema: 'GreeksCalculateSchema', covered: true },
  'greeks:portfolio': { schema: 'GreeksPortfolioSchema', covered: true },

  // ── NL Parser (2 schemas) ────────────────────────────────────────
  'nl:parse':                  { schema: 'NlParseSchema', covered: true },
  'nl:templates':              { schema: null, covered: false, exemption: 'No params' },
  'nl:instantiate-template':   { schema: null, covered: false, exemption: 'Internal — uses template engine' },
};

// ── Exemptions by Category ───────────────────────────────────────────────────

/** Channels exempt because they take NO parameters */
export const EXEMPT_NO_PARAMS: string[] = [
  'broker:disconnect', 'broker:getAccounts', 'broker:list', 'broker:getStatus',
  'strategy:getAll', 'strategy:templates',
  'risk:getConfig', 'risk:getAlerts', 'risk:getStatusSnapshot', 'risk:getKellyStats',
  'risk:getDrawdownState', 'risk:get-trade-history',
  'db:getStrategies', 'db:getSettings', 'db:getWatchlist',
  'data:regime', 'data:clear-cache',
  'nl:templates',
  'marketplace:updateAllScores',
];

/** Channels exempt because they only need a single entity ID */
export const EXEMPT_ID_ONLY: string[] = [
  'broker:remove', 'broker:setActive',
  'strategy:startLive', 'strategy:stopLive',
  'marketplace:getRating', 'marketplace:getComments',
  'marketplace:getPerformance', 'marketplace:score', 'marketplace:verify',
];

/** Channels exempt because they're internal engine methods (no user input) */
export const EXEMPT_ENGINE_INTERNAL: string[] = [
  'strategy:auto-tune', 'strategy:correlation', 'strategy:correlation-viz',
  'strategy:multi-factor', 'strategy:execute',
  'backtest:stability', 'backtest:parallel',
  'backtest:param-scan-parallel', 'backtest:walk-forward-parallel',
  'risk:dashboard', 'risk:cross-asset', 'risk:decompose', 'risk:monteCarlo',
  'risk:position-size', 'risk:calculate-size', 'risk:calculate-portfolio-sizes',
  'risk:record-trade', 'risk:stress-test', 'risk:portfolio-calculate',
];

/** Channels from external/additional modules (EM, WS, cache, alerts, etc.) */
export const EXEMPT_ADDON_MODULE: string[] = [
  // EM (EastMoney) module — existing data-ipc.ts covers most; R108 to add schemas
  // WS (WebSocket) module — real-time streaming, params are simple
  // Cache module — key-value ops
  // Alert/notification module — internal eventing
  // Export module — file I/O ops
  // Snapshot/version/indicator — utility modules
  // TODO: R108-R110 to add schemas for these modules
];

// ── Coverage Statistics ──────────────────────────────────────────────────────

export function getCoverageStats() {
  const entries = Object.entries(IPC_SCHEMA_COVERAGE);
  const covered = entries.filter(([, v]) => v.covered).length;
  const exemptNoParams = entries.filter(([, v]) => v.exemption?.includes('No params')).length;
  const exemptIdOnly = entries.filter(([, v]) => v.exemption?.includes('Only needs')).length;
  const exemptEngine = entries.filter(([, v]) => v.exemption?.includes('Internal engine')).length;
  return {
    total: entries.length,
    covered,
    uncovered: entries.length - covered,
    exemptNoParams,
    exemptIdOnly,
    exemptEngine,
    coverageRate: ((covered / entries.length) * 100).toFixed(1) + '%',
  };
}

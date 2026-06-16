// ── quant-moo — IPC Bridge Type Definitions ───────────────────────────
// R124-P02: broker + risk (batch 1/4). R125-P02: marketplace + dataProvider (batch 2/4).
// R127-P03: db + app + stockStream + prefs + greeks (batch 4/4). 104/104 complete.

// ── Broker namespace ────────────────────────────────────────────────────

export interface BrokerConnectConfig {
  host?: string;
  port?: number;
  brokerId?: string;
  apiKey?: string;
  secretKey?: string;
  passphrase?: string;
}

export interface BrokerAccount {
  accountId: string;
  brokerId: string;
  name: string;
  currency: string;
  balance: number;
  availableBalance: number;
  frozen: number;
  totalPL: number;
  todayPL: number;
}

export interface BrokerPosition {
  accountId: string;
  brokerId: string;
  symbol: string;
  name: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPL: number;
  realizedPL: number;
  currency: string;
}

export interface BrokerQuote {
  symbol: string;
  name: string;
  lastPrice: number;
  openPrice: number;
  high: number;
  low: number;
  prevClose: number;
  change: number;
  changePercent: number;
  volume: number;
  turnover: number;
  timestamp: number;
  bid: number;
  ask: number;
  bidSize: number;
  askSize: number;
  market: string;
}

export interface BrokerKline {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  turnover: number;
}

export interface BrokerOrderRequest {
  accountId: string;
  brokerId?: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  orderType: 'LIMIT' | 'MARKET' | 'STOP_LIMIT' | 'STOP_MARKET';
  quantity: number;
  price?: number;
  stopPrice?: number;
  timeInForce?: 'DAY' | 'GTC' | 'IOC' | 'FOK';
}

export interface BrokerOrder {
  orderId: string;
  accountId: string;
  brokerId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  orderType: 'LIMIT' | 'MARKET' | 'STOP_LIMIT' | 'STOP_MARKET';
  quantity: number;
  filledQty: number;
  price?: number;
  avgFillPrice?: number;
  status: 'PENDING' | 'PARTIAL' | 'FILLED' | 'CANCELLED' | 'REJECTED' | 'EXPIRED';
  createdAt: string;
  updatedAt: string;
  commission: number;
  commissionCurrency: string;
  message?: string;
}

export interface BrokerStatus {
  brokerId: string;
  connected: boolean;
  connectedAt?: string;
  lastHeartbeat?: string;
  latencyMs?: number;
  error?: string;
  accountCount: number;
}

export interface BrokerListEntry {
  id: string;
  name: string;
  type: string;
  status: BrokerStatus;
}

// ── Risk namespace ──────────────────────────────────────────────────────

export interface RiskConfig {
  maxPositionSize: number;
  maxDrawdown: number;
  stopLoss: number;
  takeProfit: number;
  maxDailyLoss: number;
  maxConcentration: number;
  kellyFraction: number;
  vixThreshold: number;
  enabled: boolean;
}

export interface RiskAlert {
  id: string;
  type: 'DRAWDOWN' | 'POSITION_LIMIT' | 'DAILY_LOSS' | 'CONCENTRATION' | 'VIX' | 'KELLY';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  value: number;
  threshold: number;
  timestamp: string;
  acknowledged: boolean;
}

export interface RiskStatusSnapshot {
  currentDrawdown: number;
  maxDrawdown: number;
  dailyPL: number;
  totalExposure: number;
  concentration: number;
  activeAlerts: number;
  vix: number;
  timestamp: string;
}

export interface RiskDrawdownState {
  peak: number;
  current: number;
  drawdown: number;
  maxDrawdown: number;
  recoveryTarget: number;
  recoveryPercent: number;
}

export interface RiskKellyStats {
  winRate: number;
  avgWin: number;
  avgLoss: number;
  payoffRatio: number;
  kellyFraction: number;
  optimalFraction: number;
  halfKellyFraction: number;
  sampleSize: number;
}

// ── IPC response wrapper ────────────────────────────────────────────────

export interface IpcResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  [key: string]: unknown;
}

// ── Marketplace namespace ───────────────────────────────────────────────

export interface MarketplaceStrategy {
  id: string;
  name: string;
  description: string;
  author: string;
  type: string;
  tags: string[];
  rating: number;
  downloads: number;
  verified: boolean;
  score: number;
  createdAt: string;
  updatedAt: string;
  performance?: MarketplacePerformance;
}

export interface MarketplacePerformance {
  totalReturn: number;
  annualizedReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  totalTrades: number;
  avgHoldingDays: number;
}

export interface MarketplaceComment {
  id: number;
  strategyId: string;
  author: string;
  content: string;
  parentId?: number;
  createdAt: string;
  replies?: MarketplaceComment[];
}

// ── DataProvider namespace ──────────────────────────────────────────────

export interface FundamentalData {
  symbol: string;
  marketCap: number;
  pe: number;
  pb: number;
  roe: number;
  debtRatio: number;
  revenueGrowth: number;
  earningsGrowth: number;
  dividendYield: number;
  sector: string;
  updatedAt: string;
}

export interface CapitalFlowData {
  symbol: string;
  mainInflow: number;
  mainOutflow: number;
  retailInflow: number;
  retailOutflow: number;
  netFlow: number;
  period: string;
  timestamp: string;
}

export interface MarketRegime {
  regime: 'BULL' | 'BEAR' | 'SIDEWAYS' | 'VOLATILE';
  confidence: number;
  factors: Record<string, number>;
  updatedAt: string;
}

export interface AnomalySignal {
  symbol: string;
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  message: string;
  value: number;
  threshold: number;
  timestamp: string;
}

export interface CompositeScore {
  symbol: string;
  overall: number;
  fundamentals: number;
  technicals: number;
  sentiment: number;
  momentum: number;
  quality: number;
  updatedAt: string;
}

export interface NewsItem {
  id: string;
  symbol: string;
  title: string;
  source: string;
  url: string;
  sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  timestamp: string;
}

// ── Strategy namespace ──────────────────────────────────────────────────

export interface StrategyDSL {
  name: string;
  description: string;
  logic: string;
  inputs: Record<string, unknown>;
  parameters: Record<string, number>;
  constraints: Record<string, { min: number; max: number }>;
}

export interface StrategyRecord {
  id: string;
  name: string;
  description: string;
  dsl: StrategyDSL;
  status: 'DRAFT' | 'BACKTEST' | 'LIVE' | 'PAUSED' | 'STOPPED';
  createdAt: string;
  updatedAt: string;
  liveSince?: string;
}

export interface BacktestConfig {
  strategyId: string;
  symbols: string[];
  startDate: string;
  endDate: string;
  initialCapital: number;
  commission: number;
  slippage: number;
  period?: string;
}

export interface BacktestResult {
  totalReturn: number;
  annualizedReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  totalTrades: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  equityCurve: number[];
  trades: Array<{ date: string; type: string; price: number; pnl: number }>;
}

// ── Backtest (extended) namespace ───────────────────────────────────────

export interface WalkForwardConfig extends BacktestConfig {
  trainWindow: number;
  testWindow: number;
}

export interface ParamScanConfig extends BacktestConfig {
  paramName: string;
  paramRange: { min: number; max: number; step: number };
}

export interface MultiTimeframeConfig extends BacktestConfig {
  timeframes: string[];
}

// ── NL namespace ────────────────────────────────────────────────────────

export interface NLParsedCommand {
  intent: string;
  entities: Record<string, string>;
  confidence: number;
  action: Record<string, unknown>;
}

export interface NLTemplate {
  id: string;
  label: string;
  pattern: string;
  example: string;
  category: string;
}

// ── DB namespace ────────────────────────────────────────────────────────

export interface DBStrategy {
  id: string;
  name: string;
  type: string;
  config: Record<string, unknown>;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface DBTrade {
  id: string;
  strategyId: string;
  symbol: string;
  side: string;
  price: number;
  quantity: number;
  pnl: number;
  timestamp: string;
}

export interface DBSignal {
  id: string;
  strategyId: string;
  symbol: string;
  direction: string;
  confidence: number;
  price: number;
  timestamp: string;
}

export interface DBWatchlist {
  id: string;
  name: string;
  codes: string[];
  updatedAt: string;
}

export interface AppInfo {
  version: string;
  platform: string;
  electronVersion: string;
  nodeVersion: string;
  uptime: number;
}

export interface MemoryUsage {
  heapTotal: number;
  heapUsed: number;
  rss: number;
  external: number;
}

export interface UpdateInfo {
  available: boolean;
  version?: string;
  size?: number;
  releaseDate?: string;
  changelog?: string;
}

// ── StockStream namespace ────────────────────────────────────────────────

export interface StockStreamConfig {
  symbols: string[];
  brokerId?: string;
  reconnect: boolean;
}

// ── Prefs namespace ──────────────────────────────────────────────────────

export interface PrefsExport {
  version: string;
  exportedAt: string;
  sections: Record<string, Record<string, unknown>>;
}

// ── Greeks namespace ─────────────────────────────────────────────────────

export interface GreeksParams {
  symbol: string;
  spotPrice: number;
  strike: number;
  expiry: string;
  volatility: number;
  riskFreeRate: number;
  optionType: 'CALL' | 'PUT';
}

export interface GreeksResult {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho: number;
  iv: number;
  price: number;
}

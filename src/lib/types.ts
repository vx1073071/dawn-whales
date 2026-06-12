// ── DAWN WHALES · — Core Type Definitions ─────────────────────────────

// ── Broker Types ──────────────────────────────────────────────────────────

export type BrokerId = 'futu' | 'moomoo' | 'longbridge' | 'ibkr';
export type Market = 'US' | 'HK' | 'CN' | 'SG' | 'CRYPTO';
export type TrdEnv = 'REAL' | 'SIMULATE';

export interface BrokerConfig {
  id: BrokerId;
  host: string;
  port: number;
  trdEnv: TrdEnv;
  trdPassword?: string; // encrypted at rest
}

export interface ConnectionStatus {
  connected: boolean;
  broker: BrokerId;
  version?: string;
  latencyMs?: number;
  lastError?: string;
}

export interface Account {
  accId: string;
  trdEnv: TrdEnv;
  totalAssets: number;
  cash: number;
  power: number;
  marketVal: number;
  todayPnl: number;
  currency: string;
  broker: BrokerId;
}

export interface Position {
  code: string;
  name: string;
  market: Market;
  qty: number;
  canSellQty: number;
  avgCost: number;
  curPrice: number;
  marketVal: number;
  pnl: number;
  pnlPct: number;
}

export interface Quote {
  code: string;
  name: string;
  market: Market;
  price: number;
  prevClose: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  turnover: number;
  change: number;
  changePct: number;
  amplitude: number;
  updateTime: string;
}

export interface Kline {
  time: number; // unix timestamp
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  turnover: number;
}

export type KlinePeriod = '1m' | '5m' | '15m' | '30m' | '60m' | 'daily' | 'weekly' | 'monthly';

export type OrderSide = 'BUY' | 'SELL';
export type OrderType = 'MARKET' | 'LIMIT' | 'STOP' | 'STOP_LIMIT';
export type OrderStatus = 'PENDING' | 'SUBMITTED' | 'FILLED' | 'PARTIAL' | 'CANCELLED' | 'REJECTED';

export interface NewOrder {
  accountId: string;
  code: string;
  market: Market;
  side: OrderSide;
  orderType: OrderType;
  qty: number;
  price?: number;       // for LIMIT / STOP_LIMIT
  stopPrice?: number;   // for STOP / STOP_LIMIT
  remark?: string;
}

export interface Order {
  orderId: string;
  code: string;
  name: string;
  side: OrderSide;
  orderType: OrderType;
  qty: number;
  price: number;
  filledQty: number;
  filledPrice: number;
  status: OrderStatus;
  createTime: string;
  updateTime: string;
  remark?: string;
}

export interface Trade {
  tradeId: string;
  orderId: string;
  code: string;
  side: OrderSide;
  qty: number;
  price: number;
  commission: number;
  tradeTime: string;
}

export interface Funds {
  totalAssets: number;
  cash: number;
  power: number;
  marketVal: number;
  frozenCash: number;
  todayPnl: number;
  currency: string;
}

// ── Strategy DSL Types ──────────────────────────────────────────────────────

export interface Strategy {
  id: string;
  name: string;
  description: string;
  version: string;
  tags: string[];
  universe: StrategyUniverse;
  signals: StrategySignal[];
  positionSizing: PositionSizing;
  riskManagement: RiskManagement;
  execution: StrategyExecution;
  status: StrategyStatus;
  createdAt: string;
  updatedAt: string;
}

export type StrategyStatus = 'draft' | 'backtesting' | 'ready' | 'live' | 'paused' | 'error';

export interface StrategyUniverse {
  market: Market;
  symbols: string[];
  filters?: UniverseFilter[];
}

export type UniverseFilter =
  | { type: 'market_cap'; op: '>' | '<' | '>=' | '<='; value: number }
  | { type: 'price'; op: '>' | '<' | '>=' | '<='; value: number }
  | { type: 'volume'; op: '>' | '<' | '>=' | '<='; value: number }
  | { type: 'sector'; values: string[] }
  | { type: 'custom'; expression: string };

export interface StrategySignal {
  id: string;
  name: string;
  condition: SignalCondition;
  action: OrderSide;
  priority?: number;
}

export type SignalCondition =
  | { type: 'crossover'; fast: IndicatorRef; slow: IndicatorRef }
  | { type: 'crossunder'; fast: IndicatorRef; slow: IndicatorRef }
  | { type: 'threshold'; indicator: IndicatorRef; op: '>' | '<' | '>=' | '<='; value: number }
  | { type: 'breakout'; indicator: IndicatorRef; direction: 'above' | 'below'; lookback: number }
  | { type: 'and'; conditions: SignalCondition[] }
  | { type: 'or'; conditions: SignalCondition[] }
  | { type: 'not'; condition: SignalCondition };

export interface IndicatorRef {
  indicator: string; // 'SMA' | 'EMA' | 'RSI' | 'MACD' | 'BOLL' | 'ATR' | ...
  params: Record<string, number>;
  field?: 'open' | 'high' | 'low' | 'close' | 'volume';
}

export interface PositionSizing {
  method: 'equal_weight' | 'fixed_amount' | 'fixed_pct' | 'kelly' | 'atr_based';
  maxPositions: number;
  positionPct?: number;     // % of total per position
  positionAmount?: number;  // fixed $ per position
}

export interface RiskManagement {
  stopLoss?: StopCondition;
  takeProfit?: StopCondition;
  maxDrawdown?: number;       // e.g. 0.10 = 10%
  dailyLossLimit?: number;    // e.g. 0.03 = 3%
  maxCorrelation?: number;    // e.g. 0.7
  cooldownAfterLoss?: number; // minutes
}

export type StopCondition =
  | { type: 'fixed_pct'; value: number }
  | { type: 'atr'; multiplier: number }
  | { type: 'trailing'; pct: number };

export interface StrategyExecution {
  frequency: 'realtime' | 'min1' | 'min5' | 'min15' | 'hourly' | 'daily';
  orderType: OrderType;
  slippageBps?: number;
}

// ── Backtest Types ──────────────────────────────────────────────────────────

export interface BacktestConfig {
  strategy: Strategy;
  startDate: string;
  endDate: string;
  initialCapital: number;
  commissionBps: number;
  slippageBps: number;
  benchmark?: string; // e.g. 'SPY'
}

export interface BacktestResult {
  id: string;
  strategyId: string;
  // Performance
  totalReturn: number;      // %
  annualReturn: number;     // %
  benchmarkReturn?: number; // %
  // Risk
  maxDrawdown: number;      // %
  sharpeRatio: number;
  calmarRatio: number;
  sortinoRatio: number;
  // Trading
  totalTrades: number;
  winRate: number;          // %
  profitFactor: number;
  avgWin: number;           // %
  avgLoss: number;          // %
  // Time series
  equityCurve: number[];    // daily NAV
  drawdownCurve: number[];
  monthlyReturns: number[][];
  // Detail
  trades: BacktestTrade[];
  createdAt: string;
}

export interface BacktestTrade {
  entryDate: string;
  exitDate: string;
  code: string;
  side: OrderSide;
  entryPrice: number;
  exitPrice: number;
  qty: number;
  pnl: number;
  pnlPct: number;
  holdingDays: number;
}

// ── Store State Types ───────────────────────────────────────────────────────

export interface AppSettings {
  theme: 'dark' | 'light';
  language: 'zh-CN' | 'en-US';
  broker: BrokerConfig;
  riskDefaults: RiskManagement;
  notifications: {
    desktop: boolean;
    sound: boolean;
    tradeAlerts: boolean;
    dailyReport: boolean;
  };
  dataRetention: {
    klineDays: number;
    logDays: number;
  };
}

export type SidebarView = 'dashboard' | 'market' | 'strategy' | 'marketplace' | 'backtest' | 'live' | 'portfolio' | 'orders' | 'risk' | 'settings' | 'trade' | 'alert' | 'ai' | 'riskviz' | 'creator' | 'signals' | 'copytrade';

export interface AppState {
  sidebarView: SidebarView;
  sidebarCollapsed: boolean;
  connectionStatus: ConnectionStatus | null;
}

/**
 * 引擎层契约
 * @version 1.0.0
 * @owner 策略虾(STRATEGY) + 风控虾(RISK) + 执行虾(EXEC) + 自动化虾(AUTO)
 */

// ===== 策略引擎契约 =====

export interface INLParser {
  parse(input: string): IParsedStrategy;
}

export interface IParsedStrategy {
  symbol: string;
  action: 'BUY' | 'SELL';
  conditions: IConditionRule[];
  riskManagement?: {
    stopLoss?: number;
    takeProfit?: number;
    positionSize?: number;
  };
}

export interface IConditionRule {
  type: 'PRICE' | 'INDICATOR' | 'VOLUME' | 'TIME' | 'COMPOSITE';
  params: Record<string, unknown>;
  operator?: 'AND' | 'OR';
  children?: IConditionRule[];
}

export interface IStrategyEngine {
  createStrategy(config: IParsedStrategy): string;
  executeStrategy(strategyId: string): Promise<ISignal[]>;
  backtestStrategy(strategyId: string, range: IBacktestRange): IBacktestResult;
  pauseStrategy(strategyId: string): void;
  resumeStrategy(strategyId: string): void;
  deleteStrategy(strategyId: string): void;
}

export interface IBacktestRange {
  startDate: string;
  endDate: string;
  interval: string;
}

export interface IBacktestResult {
  totalReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  trades: ITradeRecord[];
}

export interface ITradeRecord {
  entryTime: number;
  exitTime: number;
  entryPrice: number;
  exitPrice: number;
  pnl: number;
}

// ===== 风控引擎契约 =====

export interface IRiskEngine {
  checkOrder(signal: ISignal): IRiskCheckResult;
  checkPortfolio(): IRiskSummary;
  updateEquity(equity: number): void;
}

export interface IRiskCheckResult {
  allowed: boolean;
  reason?: string;
  warnings: string[];
  adjustedPositionSize?: number;
}

export interface IRiskSummary {
  totalExposure: number;
  marginUtilization: number;
  largestPosition: string;
  dailyPnl: number;
  circuitBreakerStatus: 'NORMAL' | 'WARNING' | 'TRIPPED';
}

// ===== 交易执行契约 =====

export interface ITradeExecutor {
  executeSignal(signal: ISignal): Promise<IExecutionResult>;
  cancelOrder(orderId: string): Promise<boolean>;
  getOrderStatus(orderId: string): IOrderStatus;
}

export interface ISignal {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price?: number;
  orderType: 'MARKET' | 'LIMIT' | 'STOP';
  strategyId?: string;
  timestamp: number;
}

export interface IExecutionResult {
  signalId: string;
  orderId?: string;
  status: 'EXECUTED' | 'REJECTED' | 'PENDING' | 'FAILED';
  filledQuantity: number;
  avgPrice: number;
  message?: string;
  timestamp: number;
}

export interface IOrderStatus {
  orderId: string;
  status: 'PENDING' | 'FILLED' | 'PARTIAL' | 'CANCELLED' | 'REJECTED';
  filledQuantity: number;
  remainingQuantity: number;
}

// ===== 自动化引擎契约 =====

export interface IAutomationEngine {
  scheduleTask(task: ICronTask): string;
  cancelTask(taskId: string): void;
  getTasks(): ICronTask[];
  enableConditionRule(rule: IConditionRule): string;
  disableConditionRule(ruleId: string): void;
}

export interface ICronTask {
  id: string;
  name: string;
  cronExpression: string;
  strategyId: string;
  enabled: boolean;
  lastRun?: number;
  nextRun?: number;
}

export interface ITradingCalendar {
  isMarketOpen(market: string, timestamp?: number): boolean;
  getNextOpen(market: string): number;
  getNextClose(market: string): number;
  getUpcomingHolidays(market: string, limit?: number): IHoliday[];
}

export interface IHoliday {
  name: string;
  date: string;
  markets: string[];
}

/**
 * UI层契约
 * @version 1.0.0
 * @owner 交易UI虾(UI-TRADE) + 监控UI虾(UI-MONITOR)
 */

// ===== 交易UI契约 =====

export interface IOrderPanelProps {
  symbol?: string;
  onSubmitOrder: (order: IOrderFormData) => void;
  brokers: IBrokerOption[];
  selectedBroker?: string;
}

export interface IOrderFormData {
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  orderType: 'MARKET' | 'LIMIT' | 'STOP' | 'STOP_LIMIT';
  price?: number;
  stopPrice?: number;
  brokerId: string;
}

export interface IBrokerOption {
  id: string;
  name: string;
  status: 'connected' | 'disconnected';
}

export interface IPositionPanelProps {
  positions: IPositionDisplay[];
  onUpdateStopLoss: (symbol: string, value: number) => void;
  onUpdateTakeProfit: (symbol: string, value: number) => void;
  onClosePosition: (symbol: string) => void;
  refreshInterval?: number;
}

export interface IPositionDisplay {
  symbol: string;
  name: string;
  side: 'LONG' | 'SHORT';
  quantity: number;
  avgCost: number;
  currentPrice: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
  stopLoss?: number;
  takeProfit?: number;
}

export interface IConditionRulePanelProps {
  rules: IConditionRuleDisplay[];
  onAddRule: (rule: IConditionRuleForm) => void;
  onRemoveRule: (ruleId: string) => void;
  onToggleRule: (ruleId: string, enabled: boolean) => void;
}

export interface IConditionRuleDisplay {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  triggerCount: number;
  lastTriggered?: number;
}

export interface IConditionRuleForm {
  name: string;
  type: 'PRICE' | 'INDICATOR' | 'TIME' | 'COMPOSITE';
  params: Record<string, unknown>;
}

// ===== 监控UI契约 =====

export interface ISystemHealthPanelProps {
  engines: IEngineStatus[];
  metrics: ISystemMetrics;
}

export interface IEngineStatus {
  name: string;
  status: 'running' | 'stopped' | 'error';
  uptime: number;
  lastError?: string;
}

export interface ISystemMetrics {
  latency: number;
  memoryUsage: number;
  cpuUsage: number;
  testCoverage: number;
}

export interface IPerformanceDashboardProps {
  portfolioValue: number;
  dayPnl: number;
  totalPnl: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  profitFactor: number;
}

export interface ITradingCalendarViewProps {
  market: string;
  year: number;
  month: number;
  onMarketChange: (market: string) => void;
}

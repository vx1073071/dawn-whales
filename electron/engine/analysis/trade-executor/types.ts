type EventMap = Record<string, (...args: unknown[]) => void>;

class TypedEventEmitter<T extends EventMap> {
  private listeners: Map<string, Set<Function>> = new Map();
export interface TradeSignal {
  strategyId: string;
  strategyName: string;
  code: string;
  side: 'BUY' | 'SELL';
  quantity?: number;
  price?: number;
  orderType: 'MARKET' | 'LIMIT' | 'STOP' | 'STOP_LIMIT';
  stopLoss?: number;
  takeProfit?: number;
  reason: string;
  confidence: number; // 0-1
  timestamp: number;
  brokerId?: string; // Optional: route to a specific broker; falls back to active broker
}
export interface TradeOrder {
  id: string;
  signalId?: string;
  code: string;
  side: 'BUY' | 'SELL';
  orderType: 'MARKET' | 'LIMIT' | 'STOP' | 'STOP_LIMIT';
  quantity: number;
  price: number;
  stopPrice?: number;
  status: 'pending' | 'submitted' | 'partial' | 'filled' | 'cancelled' | 'rejected';
  filledQty: number;
  filledPrice: number;
  commission: number;
  createdAt: string;
  updatedAt: string;
  brokerOrderId?: string;
  rejectionReason?: string;
  brokerId?: string; // Target broker for routing (from strategy binding)
}
export interface RiskCheck {
  passed: boolean;
  reason: string;
  checks: {
    name: string;
    passed: boolean;
    value: number;
    limit: number;
  }[];
}
export interface ExecutionConfig {
  mode: 'paper' | 'real';
  maxPositionSizePct: number;
  maxDailyLossPct: number;
  maxOpenOrders: number;
  defaultCommission: number;
  slippageBps: number;
  requireConfirmation: boolean;
}
export interface TradeStats {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalPnL: number;
  totalCommission: number;
  avgWin: number;
  avgLoss: number;
  maxDrawdown: number;
  profitFactor: number;
}
export interface DailyPnL {
  date: string;
  pnl: number;
  trades: number;
  commission: number;
  winningTrades: number;
  losingTrades: number;
}
export interface PositionInfo {
  code: string;
  quantity: number;
  avgCost: number;
  currentValue: number;
  unrealizedPnL: number;
  realizedPnL: number;
}
interface BrokerAdapter {
  placeOrder(order: TradeOrder): Promise<{ brokerOrderId: string; status: string }>;
  cancelOrder(brokerOrderId: string): Promise<boolean>;
  getQuote(code: string): Promise<{ bid: number; ask: number; last: number } | null>;
  getPositions?(): Promise<PositionInfo[]>;
}
interface TradeExecutorEvents {
  'order:created': (order: TradeOrder) => void;
  'order:filled': (order: TradeOrder) => void;
  'order:cancelled': (order: TradeOrder) => void;
  'order:rejected': (order: TradeOrder, reason: string) => void;
  'risk:rejected': (signal: TradeSignal, riskCheck: RiskCheck) => void;
  'signal:processed': (signal: TradeSignal, order: TradeOrder | null) => void;
  'mode:changed': (mode: 'paper' | 'real') => void;
  'emergency:stop': (cancelledCount: number) => void;
  'config:updated': (config: ExecutionConfig) => void;
  'position:updated': (position: PositionInfo) => void;
  'daily:pnl': (pnl: DailyPnL) => void;
}

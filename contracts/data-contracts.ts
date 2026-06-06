/**
 * 数据层契约
 * @version 1.0.0
 * @owner 行情数据虾(MARKET) + 账户数据虾(ACCOUNT)
 */

// ===== 行情数据契约 =====

export interface IMarketDataProvider {
  subscribe(symbol: string): void;
  unsubscribe(symbol: string): void;
  getQuote(symbol: string): IQuoteSnapshot | null;
  getCandles(symbol: string, period: string): ICandleData[];
  onQuoteUpdate(callback: (quote: IQuoteSnapshot) => void): () => void;
}

export interface IQuoteSnapshot {
  symbol: string;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  bid?: number;
  ask?: number;
  bidSize?: number;
  askSize?: number;
}

export interface ICandleData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// ===== 账户数据契约 =====

export interface IAccountDataProvider {
  getPositions(): IPositionData[];
  getOrders(): IOrderHistory[];
  getAccountSummary(): IAccountSummary;
  onPositionUpdate(callback: (positions: IPositionData[]) => void): () => void;
}

export interface IPositionData {
  symbol: string;
  side: 'LONG' | 'SHORT';
  quantity: number;
  avgCost: number;
  currentPrice: number;
  unrealizedPnl: number;
  realizedPnl: number;
  stopLoss?: number;
  takeProfit?: number;
  trailingStop?: number;
}

export interface IOrderHistory {
  orderId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  status: 'PENDING' | 'FILLED' | 'CANCELLED' | 'REJECTED';
  timestamp: number;
  broker: string;
}

export interface IAccountSummary {
  totalEquity: number;
  cashBalance: number;
  marginUsed: number;
  buyingPower: number;
  dayPnl: number;
  totalPnl: number;
}

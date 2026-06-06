/**
 * 券商层契约
 * @version 1.0.0
 * @owner 券商适配虾(BROKER)
 */

export interface IBrokerConnection {
  id: string;
  name: string;
  status: 'CONNECTED' | 'DISCONNECTED' | 'CONNECTING' | 'ERROR';
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  onStatusChange(callback: (status: string) => void): () => void;
}

export interface IBrokerAdapter {
  readonly connection: IBrokerConnection;
  placeOrder(order: IOrderRequest): Promise<IOrderResult>;
  cancelOrder(orderId: string): Promise<boolean>;
  getPositions(): Promise<IPositionData[]>;
  getAccountSummary(): Promise<IAccountSummary>;
  subscribeQuotes(symbols: string[]): void;
  unsubscribeQuotes(symbols: string[]): void;
}

export interface IOrderRequest {
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  orderType: 'MARKET' | 'LIMIT' | 'STOP' | 'STOP_LIMIT';
  price?: number;
  stopPrice?: number;
  timeInForce?: 'DAY' | 'GTC' | 'IOC';
}

export interface IOrderResult {
  orderId: string;
  status: 'PENDING' | 'FILLED' | 'PARTIAL' | 'REJECTED' | 'CANCELLED';
  filledQuantity: number;
  avgPrice: number;
  message?: string;
  timestamp: number;
}

// Re-export data types for convenience
import type { IPositionData, IAccountSummary } from './data-contracts';
export type { IPositionData, IAccountSummary };

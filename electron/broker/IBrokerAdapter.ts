// ── DAWN WHALES — Broker Adapter Interface ──────────────────────────────────
// 多券商统一接口 (Sprint 1: Multi-Broker)

export interface BrokerConfig {
  id: string;           // e.g. 'futu-default', 'moomoo-hk'
  name: string;         // display name
  type: 'futu' | 'moomoo' | 'ib' | 'longbridge';
  host: string;
  port: number;
  enabled: boolean;
}

export interface AccountInfo {
  accountId: string;
  name: string;
  currency: string;
  netAssets: number;
  totalAssets: number;
  cash: number;
  marketValue: number;
}

export interface FundsInfo {
  totalAssets: number;
  cash: number;
  marketValue: number;
  frozenCash: number;
  availableCash: number;
  currency: string;
}

export interface PositionInfo {
  code: string;
  name: string;
  qty: number;
  costPrice: number;
  marketPrice: number;
  marketValue: number;
  pnl: number;
  pnlPct: number;
  ratio: number;
}

export interface OrderInfo {
  orderId: string;
  code: string;
  side: 'BUY' | 'SELL';
  orderType: 'MARKET' | 'LIMIT';
  qty: number;
  price: number;
  filledQty: number;
  filledPrice: number;
  status: string;
  createdAt: string;
}

export interface QuoteInfo {
  code: string;
  price: number;
  change: number;
  changePct: number;
  volume: number;
  turnover: number;
  high: number;
  low: number;
  open: number;
  prevClose: number;
  time: string;
}

export interface KlineInfo {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface PlaceOrderRequest {
  code: string;
  side: 'BUY' | 'SELL';
  orderType: 'MARKET' | 'LIMIT';
  qty: number;
  price?: number;
  accountId?: string;
}

export interface IBrokerAdapter {
  readonly id: string;
  readonly type: string;
  readonly name: string;
  connected: boolean;

  connect(): Promise<void>;
  disconnect(): void;

  onQuotePush(callback: (quotes: QuoteInfo[]) => void): void;
  onDisconnect(callback: () => void): void;

  getQuotes(codes: string[]): Promise<QuoteInfo[]>;
  getKlines(code: string, period: string, count: number): Promise<KlineInfo[]>;
  getAccounts(): Promise<AccountInfo[]>;
  getFunds(accountId: string): Promise<FundsInfo>;
  getPositions(accountId: string): Promise<PositionInfo[]>;
  getOrders(accountId: string): Promise<OrderInfo[]>;
  placeOrder(order: PlaceOrderRequest): Promise<{ orderId: string }>;
  cancelOrder(orderId: string, accountId: string, code: string): Promise<void>;
  subscribeAndPush(codes: string[]): Promise<void>;
}

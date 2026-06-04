// ── IBrokerAdapter — 券商适配器抽象接口 ────────────────────────────────────
// 所有券商适配器必须实现此接口，供 BrokerManager 统一管理

export interface BrokerConfig {
  id: string;          // 唯一标识，如 'futu-main', 'moomoo-sg'
  name: string;        // 显示名称
  type: 'futu' | 'moomoo' | 'ib' | 'longbridge' | 'custom';
  host: string;
  port: number;
  enabled: boolean;
  priority?: number;   // 优先级，数字小的优先
  remark?: string;
}

export interface AccountInfo {
  accId: string;
  trdEnv: 'REAL' | 'SIMULATE';
  name?: string;
}

export interface FundsInfo {
  totalAssets: number;
  cash: number;
  power: number;
  marketVal: number;
  frozenCash: number;
  todayPnl: number;
  currency: string;
}

export interface PositionInfo {
  code: string;
  name: string;
  qty: number;
  canSellQty: number;
  avgCost: number;
  curPrice: number;
  marketVal: number;
  pnl: number;
  pnlPct: number;
}

export interface OrderInfo {
  orderId: string;
  code: string;
  name: string;
  side: 'BUY' | 'SELL';
  orderType: number;
  qty: number;
  price: number;
  filledQty: number;
  filledPrice: number;
  status: string;
  createTime: string;
  updateTime: string;
}

export interface QuoteInfo {
  code: string;
  name: string;
  price: number;
  prevClose: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  change: number;
  changePct: number;
  amplitude: number;
  updateTime: string;
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
  accountId: string;
  code: string;
  side: 'BUY' | 'SELL';
  orderType: 'LIMIT' | 'MARKET';
  qty: number;
  price?: number;
  remark?: string;
  trdEnv?: 'REAL' | 'SIMULATE';
}

export type QuotePushCallback = (quotes: QuoteInfo[]) => void;
export type DisconnectCallback = () => void;

export interface IBrokerAdapter {
  readonly config: BrokerConfig;
  readonly connected: boolean;

  // Lifecycle
  connect(): Promise<void>;
  disconnect(): Promise<void>;

  // Push
  onQuotePush(callback: QuotePushCallback): void;
  onDisconnect(callback: DisconnectCallback): void;
  subscribeAndPush(codes: string[]): Promise<void>;

  // Market Data
  getQuotes(codes: string[]): Promise<QuoteInfo[]>;
  getKlines(code: string, period: string, count: number): Promise<KlineInfo[]>;

  // Trading
  getAccounts(): Promise<AccountInfo[]>;
  getFunds(accountId: string): Promise<FundsInfo | null>;
  getPositions(accountId: string): Promise<PositionInfo[]>;
  getOrders(accountId: string): Promise<OrderInfo[]>;
  placeOrder(order: PlaceOrderRequest): Promise<{ orderId: string }>;
  cancelOrder(orderId: string, accountId: string, code: string): Promise<void>;
}

/**
 * J-68-01 [P0] IBKR Broker Adapter — IB Gateway API (tws-api)
 *
 * PM specs:
 * - IB Gateway API (tws-api), 下单/撤单/持仓/账户
 * - 费率: US stock $0.005/share, HK 0.08%
 * - 与 LiveBroker 同接口 (IExecutionBroker), 可切换
 * - >=350L, 10 tests
 */

import { IExecutionBroker } from "./ai-to-execution-bridge";

// ── IBKR-specific types ──────────────────────────────────────────────────

export type IBKRMarket = "US" | "HK" | "ASZ" | "ASH";

export interface IBKRConfig {
  host: string;        // default 127.0.0.1
  port: number;        // default 7497 (TWS) or 4002 (IB Gateway paper)
  clientId: number;    // unique client id per connection
  accountId?: string;  // optional, auto-detect if omitted
  paperTrading: boolean;
}

export interface IBKROrder {
  orderId: string;
  symbol: string;
  side: "BUY" | "SELL";
  quantity: number;
  price?: number;
  orderType: "LMT" | "MKT";
  status: IBKROrderStatus;
  filledQty: number;
  avgFillPrice: number;
  market: IBKRMarket;
  createdAt: number;
}

export type IBKROrderStatus =
  | "PendingSubmit"
  | "PreSubmitted"
  | "Submitted"
  | "Filled"
  | "PartiallyFilled"
  | "Cancelled"
  | "Inactive"
  | "Rejected";

export interface IBKRPosition {
  symbol: string;
  quantity: number;
  avgCost: number;
  marketValue: number;
  unrealizedPnl: number;
  market: IBKRMarket;
}

export interface IBKRAccount {
  accountId: string;
  netLiquidation: number;
  availableFunds: number;
  buyingPower: number;
  cashBalance: number;
  currency: string;
}

// ── Fee Calculator ────────────────────────────────────────────────────────

export function calculateIBKRFee(
  market: IBKRMarket,
  quantity: number,
  price: number,
): number {
  const notional = quantity * price;

  switch (market) {
    case "US":
      // US stock: $0.005/share, min $1, max 0.5% of trade value
      return Math.max(1, Math.min(quantity * 0.005, notional * 0.005));

    case "HK":
      // HK stock: 0.08% of trade value + 0.005% SFC levy, min HKD 18
      return Math.max(18, notional * 0.00085);

    case "ASZ":
    case "ASH":
      // A-share: 0.025% commission + 0.005% regulatory, min CNY 5
      return Math.max(5, notional * 0.0003);

    default:
      return notional * 0.001; // fallback 0.1%
  }
}

// ── IBKR Connection Manager ───────────────────────────────────────────────

export class IBKRConnection {
  private config: IBKRConfig;
  private connected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private orderCounter = 1;

  constructor(config: Partial<IBKRConfig> = {}) {
    this.config = {
      host: config.host ?? "127.0.0.1",
      port: config.port ?? (config.paperTrading ? 4002 : 7497),
      clientId: config.clientId ?? Math.floor(Math.random() * 10000),
      accountId: config.accountId,
      paperTrading: config.paperTrading ?? true,
    };
  }

  get isConnected(): boolean {
    return this.connected;
  }

  getConfig(): IBKRConfig {
    return { ...this.config };
  }

  async connect(): Promise<{ success: boolean; accountId?: string }> {
    if (this.connected) {
      return { success: true, accountId: this.config.accountId };
    }

    // In production this would use tws-api via TCP socket to IB Gateway
    // For now: simulate connection check
    try {
      // Simulate connection latency
      await new Promise((resolve) => setTimeout(resolve, 50));

      this.connected = true;
      this.reconnectAttempts = 0;

      if (!this.config.accountId) {
        this.config.accountId = `DU${String(Math.floor(Math.random() * 1000000)).padStart(6, "0")}`;
      }

      return { success: true, accountId: this.config.accountId };
    } catch {
      this.connected = false;
      return { success: false };
    }
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  async reconnect(): Promise<boolean> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      return false;
    }

    const delay = Math.pow(2, this.reconnectAttempts) * 1000; // exponential backoff
    await new Promise((resolve) => setTimeout(resolve, delay));

    this.reconnectAttempts++;
    const result = await this.connect();
    return result.success;
  }

  getNextOrderId(): string {
    return `IBKR-${this.config.clientId}-${this.orderCounter++}`;
  }

  async checkHealth(): Promise<{ healthy: boolean; latencyMs: number }> {
    const start = Date.now();
    try {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return { healthy: this.connected, latencyMs: Date.now() - start };
    } catch {
      return { healthy: false, latencyMs: Date.now() - start };
    }
  }
}

// ── IBKR Broker Adapter ───────────────────────────────────────────────────

export class IBKRBrokerAdapter implements IExecutionBroker {
  private connection: IBKRConnection;
  private orders: Map<string, IBKROrder> = new Map();
  private positions: Map<string, IBKRPosition> = new Map();
  private account: IBKRAccount | null = null;
  private config: IBKRConfig;

  constructor(config: Partial<IBKRConfig> = {}) {
    this.config = {
      host: config.host ?? "127.0.0.1",
      port: config.port ?? (config.paperTrading ? 4002 : 7497),
      clientId: config.clientId ?? Math.floor(Math.random() * 10000),
      accountId: config.accountId,
      paperTrading: config.paperTrading ?? true,
    };
    this.connection = new IBKRConnection(config);
  }

  // ── IExecutionBroker Implementation ──────────────────────────────────

  async placeOrder(
    symbol: string,
    side: "BUY" | "SELL",
    quantity: number,
    price?: number,
  ): Promise<{ orderId: string; status: string }> {
    if (!this.connection.isConnected) {
      throw new Error("IBKR not connected");
    }

    if (quantity <= 0) {
      throw new Error("Quantity must be positive");
    }

    const orderId = this.connection.getNextOrderId();
    const market = this.detectMarket(symbol);

    const order: IBKROrder = {
      orderId,
      symbol,
      side,
      quantity,
      price,
      orderType: price ? "LMT" : "MKT",
      status: "Submitted",
      filledQty: 0,
      avgFillPrice: 0,
      market,
      createdAt: Date.now(),
    };

    this.orders.set(orderId, order);

    // In production: submit via IB API socket
    // Simulate order acceptance
    return { orderId, status: "Submitted" };
  }

  async cancelOrder(orderId: string): Promise<boolean> {
    const order = this.orders.get(orderId);
    if (!order) {
      return false;
    }

    if (order.status === "Filled" || order.status === "Cancelled") {
      return false; // can't cancel completed orders
    }

    order.status = "Cancelled";
    this.orders.set(orderId, order);
    return true;
  }

  async getPositions(): Promise<
    { symbol: string; quantity: number; avgPrice: number }[]
  > {
    if (!this.connection.isConnected) {
      throw new Error("IBKR not connected");
    }

    const result: { symbol: string; quantity: number; avgPrice: number }[] =
      [];
    for (const pos of this.positions.values()) {
      result.push({
        symbol: pos.symbol,
        quantity: pos.quantity,
        avgPrice: pos.avgCost,
      });
    }
    return result;
  }

  async getAccountInfo(): Promise<{
    totalAssets: number;
    availableCash: number;
    frozenCash: number;
  }> {
    if (!this.connection.isConnected) {
      throw new Error("IBKR not connected");
    }

    // In production: reqAccountSummary from IB API
    if (!this.account) {
      this.account = {
        accountId: this.config.accountId ?? "DU000000",
        netLiquidation: 100000,
        availableFunds: 50000,
        buyingPower: 200000,
        cashBalance: 50000,
        currency: "USD",
      };
    }

    return {
      totalAssets: this.account.netLiquidation,
      availableCash: this.account.availableFunds,
      frozenCash: this.account.netLiquidation -
        this.account.availableFunds,
    };
  }

  // ── IBKR-specific Methods ────────────────────────────────────────────

  async connect(): Promise<{ success: boolean; accountId?: string }> {
    return this.connection.connect();
  }

  async disconnect(): Promise<void> {
    await this.connection.disconnect();
    this.account = null;
  }

  getConnection(): IBKRConnection {
    return this.connection;
  }

  detectMarket(symbol: string): IBKRMarket {
    if (/^\d{6}$/.test(symbol)) {
      const code = Number(symbol);
      if (code >= 600000 && code <= 609999) return "ASH"; // Shanghai main
      if (code >= 688000 && code <= 688999) return "ASH"; // STAR
      if (code >= 300000 && code <= 309999) return "ASZ"; // ChiNext
      if (code >= 0 && code <= 3999) return "ASZ"; // Shenzhen
      return "ASH";
    }
    if (/^\d{5}\.HK$/.test(symbol)) return "HK";
    return "US"; // default US (AAPL, TSLA, etc.)
  }

  getOrders(status?: IBKROrderStatus): IBKROrder[] {
    const all = Array.from(this.orders.values());
    if (!status) return all;
    return all.filter((o) => o.status === status);
  }

  getOrder(orderId: string): IBKROrder | undefined {
    return this.orders.get(orderId);
  }

  /**
   * Simulate order fill (for paper trading / testing).
   * Production: fills come from IB API orderStatus/execDetails callbacks.
   */
  async simulateFill(
    orderId: string,
    fillPrice: number,
  ): Promise<{
    orderId: string;
    status: string;
    filledQty: number;
    avgPrice: number;
  }> {
    const order = this.orders.get(orderId);
    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }

    order.status = "Filled";
    order.filledQty = order.quantity;
    order.avgFillPrice = fillPrice;
    this.orders.set(orderId, order);

    // Update positions
    const existingPos = this.positions.get(order.symbol);
    if (existingPos) {
      const newQty =
        order.side === "BUY"
          ? existingPos.quantity + order.quantity
          : existingPos.quantity - order.quantity;
      if (newQty === 0) {
        this.positions.delete(order.symbol);
      } else {
        existingPos.quantity = newQty;
        existingPos.avgCost =
          (existingPos.avgCost * existingPos.quantity + fillPrice * order.quantity) /
          (existingPos.quantity + order.quantity);
        existingPos.marketValue = existingPos.quantity * fillPrice;
        this.positions.set(order.symbol, existingPos);
      }
    } else if (order.side === "BUY") {
      this.positions.set(order.symbol, {
        symbol: order.symbol,
        quantity: order.quantity,
        avgCost: fillPrice,
        marketValue: order.quantity * fillPrice,
        unrealizedPnl: 0,
        market: order.market,
      });
    }

    return {
      orderId,
      status: "Filled",
      filledQty: order.filledQty,
      avgPrice: order.avgFillPrice,
    };
  }

  /**
   * Get a detailed order by IBKR-native orderId.
   */
  async getOrderDetails(orderId: string): Promise<IBKROrder | null> {
    return this.orders.get(orderId) ?? null;
  }

  /**
   * Calculate fee for a prospective order.
   */
  estimateFee(
    market: IBKRMarket,
    quantity: number,
    price: number,
  ): number {
    return calculateIBKRFee(market, quantity, price);
  }

  getConfig(): IBKRConfig {
    return this.config;
  }

  async checkConnectionHealth(): Promise<{
    healthy: boolean;
    latencyMs: number;
  }> {
    return this.connection.checkHealth();
  }
}

// ── Broker Registry (supports broker switching) ────────────────────────────

export type BrokerType = "futu" | "ibkr" | "simulation";

export interface BrokerEntry {
  type: BrokerType;
  broker: IExecutionBroker;
  priority: number; // lower = higher priority
  enabled: boolean;
}

export class BrokerRegistry {
  private brokers: Map<BrokerType, BrokerEntry> = new Map();
  private active: BrokerType = "simulation";

  register(type: BrokerType, broker: IExecutionBroker, priority = 10, enabled = true): void {
    this.brokers.set(type, { type, broker, priority, enabled });
  }

  setActive(type: BrokerType): void {
    if (!this.brokers.has(type)) {
      throw new Error(`Broker ${type} not registered`);
    }
    this.active = type;
  }

  getActive(): IExecutionBroker {
    const entry = this.brokers.get(this.active);
    if (!entry) {
      throw new Error(`Active broker ${this.active} not found`);
    }
    return entry.broker;
  }

  getAvailable(): BrokerType[] {
    return Array.from(this.brokers.values())
      .filter((b) => b.enabled)
      .sort((a, b) => a.priority - b.priority)
      .map((b) => b.type);
  }

  isRegistered(type: BrokerType): boolean {
    return this.brokers.has(type);
  }
}

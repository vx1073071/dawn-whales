/**
 * Trade Execution Engine
 * Sprint 2 Phase 2 - Dawn Whales
 *
 * Handles trade signal processing, risk management, order execution,
 * and trade logging for both paper and real trading modes.
 */

import log from 'electron-log';

// ============================================================
// Type-Safe Event Emitter
// ============================================================

type EventMap = Record<string, (...args: any[]) => void>;

class TypedEventEmitter<T extends EventMap> {
  private listeners: Map<string, Set<Function>> = new Map();
  private onceListeners: Map<string, Set<Function>> = new Map();

  on<K extends keyof T & string>(event: K, listener: T[K]): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);

    // Return unsubscribe function
    return () => {
      this.off(event, listener);
    };
  }

  once<K extends keyof T & string>(event: K, listener: T[K]): () => void {
    if (!this.onceListeners.has(event)) {
      this.onceListeners.set(event, new Set());
    }
    this.onceListeners.get(event)!.add(listener);

    return () => {
      this.onceListeners.get(event)?.delete(listener);
    };
  }

  off<K extends keyof T & string>(event: K, listener: T[K]): void {
    this.listeners.get(event)?.delete(listener);
    this.onceListeners.get(event)?.delete(listener);
  }

  emit<K extends keyof T & string>(event: K, ...args: Parameters<T[K]>): void {
    const regularListeners = this.listeners.get(event);
    if (regularListeners) {
      for (const listener of regularListeners) {
        try {
          listener(...args);
        } catch (err) {
          log.error(`[TradeExecutor] Event listener error for "${event}":`, err);
        }
      }
    }

    const onceListeners = this.onceListeners.get(event);
    if (onceListeners) {
      for (const listener of onceListeners) {
        try {
          listener(...args);
        } catch (err) {
          log.error(`[TradeExecutor] Once listener error for "${event}":`, err);
        }
      }
      this.onceListeners.delete(event);
    }
  }

  removeAllListeners<K extends keyof T & string>(event?: K): void {
    if (event) {
      this.listeners.delete(event);
      this.onceListeners.delete(event);
    } else {
      this.listeners.clear();
      this.onceListeners.clear();
    }
  }

  listenerCount<K extends keyof T & string>(event: K): number {
    const regular = this.listeners.get(event)?.size ?? 0;
    const once = this.onceListeners.get(event)?.size ?? 0;
    return regular + once;
  }
}

// ============================================================
// Interfaces
// ============================================================

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

// ============================================================
// Constants
// ============================================================

const DEFAULT_CONFIG: ExecutionConfig = {
  mode: 'paper',
  maxPositionSizePct: 10,
  maxDailyLossPct: 3,
  maxOpenOrders: 20,
  defaultCommission: 0.0003,
  slippageBps: 5,
  requireConfirmation: false,
};

const DUPLICATE_SIGNAL_WINDOW_MS = 60_000;
const ORDER_TIMEOUT_MS = 300_000;
const MAX_ORDER_HISTORY = 10_000;
const MAX_TRADE_LOG = 5_000;
const TRADING_HOURS_DEFAULT = {
  morning: { start: '09:15', end: '11:30' },
  afternoon: { start: '13:00', end: '15:00' },
};

// ============================================================
// Utility Functions
// ============================================================

function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `ORD-${timestamp}-${random}`.toUpperCase();
}

function generateSignalId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  return `SIG-${timestamp}-${random}`.toUpperCase();
}

function toISOString(timestamp?: number): string {
  return new Date(timestamp ?? Date.now()).toISOString();
}

function parseTimeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

function getCurrentTimeMinutes(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function roundPrice(price: number, tickSize: number = 0.01): number {
  return Math.round(price / tickSize) * tickSize;
}

function calculateSlippage(price: number, side: 'BUY' | 'SELL', slippageBps: number): number {
  const slippageFactor = slippageBps / 10_000;
  if (side === 'BUY') {
    return roundPrice(price * (1 + slippageFactor));
  }
  return roundPrice(price * (1 - slippageFactor));
}

function isValidStockCode(code: string): boolean {
  // Support A-share codes (6 digits), HK codes (5 digits), US symbols
  if (!code || typeof code !== 'string') return false;
  const trimmed = code.trim();
  if (trimmed.length === 0) return false;
  // A-share: 600xxx, 601xxx, 603xxx, 000xxx, 002xxx, 300xxx, 688xxx
  if (/^\d{6}$/.test(trimmed)) return true;
  // HK: up to 5 digits
  if (/^\d{1,5}$/.test(trimmed)) return true;
  // US: alphabetic symbols 1-5 chars
  if (/^[A-Z]{1,5}$/.test(trimmed)) return true;
  // With exchange prefix like SH600000, SZ000001
  if (/^(SH|SZ|HK|US)\d{1,6}$/i.test(trimmed)) return true;
  return /^[A-Z0-9.]+$/.test(trimmed);
}

// ============================================================
// Trade Executor
// ============================================================

export class TradeExecutor extends TypedEventEmitter<TradeExecutorEvents> {
  private config: ExecutionConfig;
  private orders: Map<string, TradeOrder> = new Map();
  private orderHistory: TradeOrder[] = [];
  private tradeLog: TradeOrder[] = [];
  private recentSignals: Map<string, number> = new Map(); // key: code+side, value: timestamp
  private positions: Map<string, PositionInfo> = new Map();
  private dailyPnLMap: Map<string, DailyPnL> = new Map();
  private totalCapital: number = 1_000_000;
  private dailyRealizedPnL: number = 0;
  private tradingHours: typeof TRADING_HOURS_DEFAULT = { ...TRADING_HOURS_DEFAULT };
  private brokerAdapter: BrokerAdapter | null = null;
  private orderTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private priceFeed: Map<string, { bid: number; ask: number; last: number }> = new Map();
  private isEmergencyStopped: boolean = false;
  private initialized: boolean = false;
  private pendingQueue: TradeSignal[] = [];
  private processingLock: boolean = false;
  private activeBrokerId: string = ''; // Currently active broker for routing orders without explicit brokerId

  constructor(config?: Partial<ExecutionConfig>) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    log.info(`[TradeExecutor] Initialized in ${this.config.mode} mode`);
    log.info(`[TradeExecutor] Config:`, JSON.stringify(this.config, null, 2));
  }

  // ============================================================
  // Initialization
  // ============================================================

  async initialize(): Promise<void> {
    if (this.initialized) {
      log.warn('[TradeExecutor] Already initialized');
      return;
    }

    log.info('[TradeExecutor] Starting initialization...');
    this.loadPersistedState();
    this.setupPeriodicTasks();
    this.initialized = true;
    log.info('[TradeExecutor] Initialization complete');
  }

  private loadPersistedState(): void {
    // In production, this would load from a database or file
    // For now, initialize with empty state
    log.info('[TradeExecutor] Loading persisted state...');
    this.positions = new Map();
    this.dailyPnLMap = new Map();
    this.dailyRealizedPnL = 0;
    log.info('[TradeExecutor] State loaded successfully');
  }

  private setupPeriodicTasks(): void {
    // Check for order timeouts every 30 seconds
    setInterval(() => {
      this.checkOrderTimeouts();
    }, 30_000);

    // Clean up old signal records every 5 minutes
    setInterval(() => {
      this.cleanupRecentSignals();
    }, 300_000);

    // Update daily P&L snapshot every minute during trading hours
    setInterval(() => {
      if (this.isTradingHours()) {
        this.updateDailyPnL();
      }
    }, 60_000);

    log.info('[TradeExecutor] Periodic tasks configured');
  }

  // ============================================================
  // Signal Processing
  // ============================================================

  async processSignal(signal: TradeSignal): Promise<TradeOrder | null> {
    const effectiveBroker = this.resolveBrokerId(signal);
    log.info(`[TradeExecutor] Processing signal: ${signal.strategyName} → ${signal.side} ${signal.code}${effectiveBroker ? ` (broker: ${effectiveBroker})` : ''}`);

    // Validate signal
    const validationError = this.validateSignal(signal);
    if (validationError) {
      log.warn(`[TradeExecutor] Signal validation failed: ${validationError}`);
      const rejectedOrder = this.createRejectedOrder(signal, validationError);
      this.emit('order:rejected', rejectedOrder, validationError);
      this.emit('signal:processed', signal, null);
      return null;
    }

    // Check emergency stop
    if (this.isEmergencyStopped) {
      log.warn('[TradeExecutor] Emergency stop active - signal rejected');
      const rejectedOrder = this.createRejectedOrder(signal, 'Emergency stop is active');
      this.emit('order:rejected', rejectedOrder, 'Emergency stop is active');
      this.emit('signal:processed', signal, null);
      return null;
    }

    // Check if confirmation is required
    if (this.config.requireConfirmation) {
      log.info('[TradeExecutor] Signal queued for confirmation');
      this.pendingQueue.push(signal);
      this.emit('signal:processed', signal, null);
      return null;
    }

    // Run risk checks
    const riskCheck = await this.runRiskChecks(signal);
    if (!riskCheck.passed) {
      log.warn(`[TradeExecutor] Risk check failed: ${riskCheck.reason}`);
      this.emit('risk:rejected', signal, riskCheck);
      const rejectedOrder = this.createRejectedOrder(signal, riskCheck.reason);
      this.emit('order:rejected', rejectedOrder, riskCheck.reason);
      this.emit('signal:processed', signal, null);
      return null;
    }

    // Record signal for duplicate detection
    const signalKey = `${signal.code}:${signal.side}`;
    this.recentSignals.set(signalKey, signal.timestamp);

    // Generate order from signal
    const order = this.createOrderFromSignal(signal);

    // Store and emit order:created
    this.orders.set(order.id, order);
    this.emit('order:created', order);

    // Execute based on mode
    const executedOrder = await this.executeOrder(order);

    this.emit('signal:processed', signal, executedOrder);
    return executedOrder;
  }

  private validateSignal(signal: TradeSignal): string | null {
    if (!signal) return 'Signal is null or undefined';
    if (!signal.code || typeof signal.code !== 'string') return 'Invalid stock code';
    if (!isValidStockCode(signal.code)) return `Invalid stock code format: ${signal.code}`;
    if (signal.side !== 'BUY' && signal.side !== 'SELL') return `Invalid side: ${signal.side}`;

    if (signal.quantity !== undefined) {
      if (typeof signal.quantity !== 'number' || signal.quantity <= 0) {
        return `Invalid quantity: ${signal.quantity}`;
      }
      if (!Number.isFinite(signal.quantity)) return 'Quantity must be finite';
      if (signal.quantity > 1_000_000) return 'Quantity exceeds maximum (1,000,000)';
    }

    if (signal.price !== undefined) {
      if (typeof signal.price !== 'number' || signal.price <= 0) {
        return `Invalid price: ${signal.price}`;
      }
      if (!Number.isFinite(signal.price)) return 'Price must be finite';
    }

    if (signal.confidence < 0 || signal.confidence > 1) {
      return `Invalid confidence: ${signal.confidence} (must be 0-1)`;
    }

    const validOrderTypes = ['MARKET', 'LIMIT', 'STOP', 'STOP_LIMIT'];
    if (!validOrderTypes.includes(signal.orderType)) {
      return `Invalid order type: ${signal.orderType}`;
    }

    if (signal.stopLoss !== undefined && signal.stopLoss < 0) {
      return `Invalid stop loss: ${signal.stopLoss}`;
    }

    if (signal.takeProfit !== undefined && signal.takeProfit < 0) {
      return `Invalid take profit: ${signal.takeProfit}`;
    }

    if (!signal.strategyId || !signal.strategyName) {
      return 'Strategy ID and name are required';
    }

    if (!signal.reason) {
      return 'Signal reason is required';
    }

    return null;
  }

  private createOrderFromSignal(signal: TradeSignal): TradeOrder {
    const now = toISOString();
    const orderId = generateId();

    // Determine price
    let price = signal.price ?? 0;
    if (signal.orderType === 'MARKET' && price === 0) {
      const quote = this.priceFeed.get(signal.code);
      if (quote) {
        price = signal.side === 'BUY' ? quote.ask : quote.bid;
      }
    }

    // Determine quantity
    let quantity = signal.quantity ?? this.calculateDefaultQuantity(price);

    // Apply slippage for market orders in paper mode
    if (signal.orderType === 'MARKET' && this.config.mode === 'paper') {
      price = calculateSlippage(price, signal.side, this.config.slippageBps);
    }

    // Resolve broker routing: signal.brokerId > activeBrokerId
    const effectiveBrokerId = this.resolveBrokerId(signal);

    const order: TradeOrder = {
      id: orderId,
      signalId: `${signal.strategyId}-${signal.timestamp}`,
      code: signal.code,
      side: signal.side,
      orderType: signal.orderType,
      quantity,
      price: roundPrice(price),
      stopPrice: signal.stopLoss,
      status: 'pending',
      filledQty: 0,
      filledPrice: 0,
      commission: 0,
      createdAt: now,
      updatedAt: now,
      brokerId: effectiveBrokerId || undefined,
    };

    return order;
  }

  private calculateDefaultQuantity(price: number): number {
    if (price <= 0) return 100;
    const maxPositionValue = this.totalCapital * (this.config.maxPositionSizePct / 100);
    const rawQuantity = maxPositionValue / price;
    // Round to lot size (100 for A-shares)
    const lotSize = 100;
    return Math.floor(rawQuantity / lotSize) * lotSize;
  }

  private createRejectedOrder(signal: TradeSignal, reason: string): TradeOrder {
    const now = toISOString();
    return {
      id: generateId(),
      signalId: `${signal.strategyId}-${signal.timestamp}`,
      code: signal.code,
      side: signal.side,
      orderType: signal.orderType,
      quantity: signal.quantity ?? 0,
      price: signal.price ?? 0,
      status: 'rejected',
      filledQty: 0,
      filledPrice: 0,
      commission: 0,
      createdAt: now,
      updatedAt: now,
      rejectionReason: reason,
    };
  }

  // ============================================================
  // Risk Pre-Check
  // ============================================================

  async runRiskChecks(signal: TradeSignal): Promise<RiskCheck> {
    log.debug(`[TradeExecutor] Running risk checks for ${signal.code} ${signal.side}`);

    const checks: RiskCheck['checks'] = [];

    // 1. Position size limit check
    const positionCheck = this.checkPositionSize(signal);
    checks.push(positionCheck);

    // 2. Daily loss limit check
    const dailyLossCheck = this.checkDailyLossLimit();
    checks.push(dailyLossCheck);

    // 3. Max open orders check
    const openOrdersCheck = this.checkMaxOpenOrders();
    checks.push(openOrdersCheck);

    // 4. Duplicate signal detection
    const duplicateCheck = this.checkDuplicateSignal(signal);
    checks.push(duplicateCheck);

    // 5. Trading hours check
    const tradingHoursCheck = this.checkTradingHours();
    checks.push(tradingHoursCheck);

    // 6. Concentration risk check
    const concentrationCheck = this.checkConcentrationRisk(signal);
    checks.push(concentrationCheck);

    // 7. Confidence threshold check
    const confidenceCheck = this.checkConfidenceThreshold(signal);
    checks.push(confidenceCheck);

    const allPassed = checks.every((c) => c.passed);
    const failedChecks = checks.filter((c) => !c.passed);
    const reason = allPassed
      ? 'All risk checks passed'
      : `Failed: ${failedChecks.map((c) => c.name).join(', ')}`;

    const result: RiskCheck = {
      passed: allPassed,
      reason,
      checks,
    };

    log.debug(`[TradeExecutor] Risk check result: ${result.passed ? 'PASS' : 'FAIL'} - ${result.reason}`);
    return result;
  }

  private checkPositionSize(signal: TradeSignal): RiskCheck['checks'][0] {
    const price = signal.price ?? this.getLastPrice(signal.code);
    const quantity = signal.quantity ?? this.calculateDefaultQuantity(price);
    const orderValue = price * quantity;
    const maxPositionValue = this.totalCapital * (this.config.maxPositionSizePct / 100);

    // Add existing position value
    const existingPosition = this.positions.get(signal.code);
    const existingValue = existingPosition ? existingPosition.quantity * existingPosition.avgCost : 0;
    const totalValue = signal.side === 'BUY' ? existingValue + orderValue : Math.max(0, existingValue - orderValue);
    const positionPct = (totalValue / this.totalCapital) * 100;

    return {
      name: 'position_size',
      passed: totalValue <= maxPositionValue,
      value: positionPct,
      limit: this.config.maxPositionSizePct,
    };
  }

  private checkDailyLossLimit(): RiskCheck['checks'][0] {
    const dailyLossPct = this.totalCapital > 0
      ? (Math.abs(Math.min(0, this.dailyRealizedPnL)) / this.totalCapital) * 100
      : 0;

    return {
      name: 'daily_loss_limit',
      passed: dailyLossPct < this.config.maxDailyLossPct,
      value: dailyLossPct,
      limit: this.config.maxDailyLossPct,
    };
  }

  private checkMaxOpenOrders(): RiskCheck['checks'][0] {
    const openOrders = this.getOrders({ status: 'pending' }).length +
      this.getOrders({ status: 'submitted' }).length +
      this.getOrders({ status: 'partial' }).length;

    return {
      name: 'max_open_orders',
      passed: openOrders < this.config.maxOpenOrders,
      value: openOrders,
      limit: this.config.maxOpenOrders,
    };
  }

  private checkDuplicateSignal(signal: TradeSignal): RiskCheck['checks'][0] {
    const signalKey = `${signal.code}:${signal.side}`;
    const lastSignalTime = this.recentSignals.get(signalKey);
    const timeSinceLastSignal = lastSignalTime ? signal.timestamp - lastSignalTime : DUPLICATE_SIGNAL_WINDOW_MS + 1;

    return {
      name: 'duplicate_signal',
      passed: timeSinceLastSignal > DUPLICATE_SIGNAL_WINDOW_MS,
      value: timeSinceLastSignal / 1000,
      limit: DUPLICATE_SIGNAL_WINDOW_MS / 1000,
    };
  }

  private checkTradingHours(): RiskCheck['checks'][0] {
    const isHours = this.isTradingHours();
    const currentMinutes = getCurrentTimeMinutes();

    return {
      name: 'trading_hours',
      passed: isHours,
      value: currentMinutes,
      limit: 0, // 0 = not applicable as a limit
    };
  }

  private checkConcentrationRisk(signal: TradeSignal): RiskCheck['checks'][0] {
    // Check if we already have too many positions in the same sector/stock
    const currentPositionCount = this.positions.size;
    const maxPositions = 10; // Configurable, but kept simple

    return {
      name: 'concentration_risk',
      passed: signal.side === 'SELL' || currentPositionCount < maxPositions || this.positions.has(signal.code),
      value: currentPositionCount,
      limit: maxPositions,
    };
  }

  private checkConfidenceThreshold(signal: TradeSignal): RiskCheck['checks'][0] {
    const minConfidence = 0.3; // Minimum confidence to trade

    return {
      name: 'confidence_threshold',
      passed: signal.confidence >= minConfidence,
      value: signal.confidence,
      limit: minConfidence,
    };
  }

  private isTradingHours(): boolean {
    const currentMinutes = getCurrentTimeMinutes();
    const morning = this.tradingHours.morning;
    const afternoon = this.tradingHours.afternoon;

    const morningStart = parseTimeToMinutes(morning.start);
    const morningEnd = parseTimeToMinutes(morning.end);
    const afternoonStart = parseTimeToMinutes(afternoon.start);
    const afternoonEnd = parseTimeToMinutes(afternoon.end);

    const inMorning = currentMinutes >= morningStart && currentMinutes <= morningEnd;
    const inAfternoon = currentMinutes >= afternoonStart && currentMinutes <= afternoonEnd;

    return inMorning || inAfternoon;
  }

  private getLastPrice(code: string): number {
    const quote = this.priceFeed.get(code);
    return quote?.last ?? 0;
  }

  // ============================================================
  // Order Management
  // ============================================================

  async placeOrder(orderInput: Partial<TradeOrder>): Promise<TradeOrder> {
    log.info(`[TradeExecutor] Placing order: ${orderInput.side} ${orderInput.code} x${orderInput.quantity}`);

    const now = toISOString();
    const order: TradeOrder = {
      id: orderInput.id ?? generateId(),
      signalId: orderInput.signalId,
      code: orderInput.code ?? '',
      side: orderInput.side ?? 'BUY',
      orderType: orderInput.orderType ?? 'MARKET',
      quantity: orderInput.quantity ?? 0,
      price: orderInput.price ?? 0,
      stopPrice: orderInput.stopPrice,
      status: 'pending',
      filledQty: 0,
      filledPrice: 0,
      commission: 0,
      createdAt: now,
      updatedAt: now,
    };

    // Validate order fields
    if (!order.code) throw new Error('Order code is required');
    if (order.quantity <= 0) throw new Error('Order quantity must be positive');
    if (order.price < 0) throw new Error('Order price cannot be negative');

    // Store order
    this.orders.set(order.id, order);
    this.emit('order:created', order);
    log.info(`[TradeExecutor] Order created: ${order.id}`);

    // Set order timeout
    this.setOrderTimeout(order.id);

    // Execute based on mode
    const executedOrder = await this.executeOrder(order);
    return executedOrder;
  }

  async cancelOrder(orderId: string): Promise<boolean> {
    log.info(`[TradeExecutor] Cancelling order: ${orderId}`);

    const order = this.orders.get(orderId);
    if (!order) {
      log.warn(`[TradeExecutor] Order not found: ${orderId}`);
      return false;
    }

    if (order.status === 'filled' || order.status === 'cancelled' || order.status === 'rejected') {
      log.warn(`[TradeExecutor] Cannot cancel order in status: ${order.status}`);
      return false;
    }

    // If real mode and has broker order, cancel with broker
    if (this.config.mode === 'real' && order.brokerOrderId && this.brokerAdapter) {
      try {
        const cancelled = await this.brokerAdapter.cancelOrder(order.brokerOrderId);
        if (!cancelled) {
          log.warn(`[TradeExecutor] Broker rejected cancellation for ${order.brokerOrderId}`);
          return false;
        }
      } catch (err) {
        log.error(`[TradeExecutor] Broker cancellation error:`, err);
        return false;
      }
    }

    // Clear timeout
    this.clearOrderTimeout(orderId);

    // Update order status
    order.status = 'cancelled';
    order.updatedAt = toISOString();
    this.orders.set(orderId, order);

    // Move to history
    this.addToHistory(order);

    this.emit('order:cancelled', order);
    log.info(`[TradeExecutor] Order cancelled: ${orderId}`);
    return true;
  }

  getOrder(orderId: string): TradeOrder | null {
    return this.orders.get(orderId) ?? null;
  }

  getOrders(filter?: { status?: string; code?: string }): TradeOrder[] {
    let orders = Array.from(this.orders.values());

    if (filter?.status) {
      orders = orders.filter((o) => o.status === filter.status);
    }
    if (filter?.code) {
      orders = orders.filter((o) => o.code === filter.code);
    }

    return orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  getOrderHistory(limit?: number): TradeOrder[] {
    const sorted = [...this.orderHistory].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
    return limit ? sorted.slice(0, limit) : sorted;
  }

  private async executeOrder(order: TradeOrder): Promise<TradeOrder> {
    if (this.config.mode === 'paper') {
      return this.executePaperOrder(order);
    } else {
      return this.executeRealOrder(order);
    }
  }

  private async executePaperOrder(order: TradeOrder): Promise<TradeOrder> {
    log.info(`[TradeExecutor] [PAPER] Executing order: ${order.id}`);

    // Simulate order submission delay
    order.status = 'submitted';
    order.updatedAt = toISOString();
    this.orders.set(order.id, order);

    // Simulate fill with slippage
    const basePrice = order.price > 0 ? order.price : this.getLastPrice(order.code);
    const fillPrice = calculateSlippage(basePrice, order.side, this.config.slippageBps);

    // Simulate partial fills for large orders
    const totalQuantity = order.quantity;
    if (totalQuantity > 1000) {
      // Simulate partial fill
      const partialQty = Math.floor(totalQuantity * 0.6 / 100) * 100;
      order.status = 'partial';
      order.filledQty = partialQty;
      order.filledPrice = fillPrice;
      order.commission = partialQty * fillPrice * this.config.defaultCommission;
      order.updatedAt = toISOString();
      this.orders.set(order.id, order);

      // Complete the rest after simulated delay
      await this.simulateDelay(500);
      order.filledQty = totalQuantity;
      order.commission = totalQuantity * fillPrice * this.config.defaultCommission;
    } else {
      order.filledQty = totalQuantity;
      order.filledPrice = fillPrice;
      order.commission = totalQuantity * fillPrice * this.config.defaultCommission;
    }

    // Mark as filled
    order.status = 'filled';
    order.filledPrice = fillPrice;
    order.updatedAt = toISOString();
    this.orders.set(order.id, order);

    // Clear timeout
    this.clearOrderTimeout(order.id);

    // Update positions
    this.updatePosition(order);

    // Add to history and trade log
    this.addToHistory(order);
    this.addToTradeLog(order);

    this.emit('order:filled', order);
    log.info(`[TradeExecutor] [PAPER] Order filled: ${order.id} - ${order.filledQty} @ ${order.filledPrice}`);

    return order;
  }

  private async executeRealOrder(order: TradeOrder): Promise<TradeOrder> {
    log.info(`[TradeExecutor] [REAL] Executing order: ${order.id}${order.brokerId ? ` → broker: ${order.brokerId}` : ' → active broker'}`);

    if (!this.brokerAdapter) {
      log.error('[TradeExecutor] No broker adapter configured for real mode');
      order.status = 'rejected';
      order.rejectionReason = 'No broker adapter configured';
      order.updatedAt = toISOString();
      this.orders.set(order.id, order);
      this.addToHistory(order);
      this.emit('order:rejected', order, 'No broker adapter configured');
      return order;
    }

    try {
      order.status = 'submitted';
      order.updatedAt = toISOString();
      this.orders.set(order.id, order);

      const result = await this.brokerAdapter.placeOrder(order);
      order.brokerOrderId = result.brokerOrderId;
      order.status = 'submitted';
      order.updatedAt = toISOString();
      this.orders.set(order.id, order);

      log.info(`[TradeExecutor] [REAL] Order submitted to broker: ${result.brokerOrderId}`);

      // In real mode, we wait for broker confirmation via callback/webhook
      // For now, mark as submitted and let the broker callback handle fill updates

    } catch (err: any) {
      log.error(`[TradeExecutor] [REAL] Order execution error:`, err);
      order.status = 'rejected';
      order.rejectionReason = err.message || 'Unknown broker error';
      order.updatedAt = toISOString();
      this.orders.set(order.id, order);
      this.addToHistory(order);
      this.emit('order:rejected', order, order.rejectionReason!);
    }

    return order;
  }

  // ============================================================
  // Broker Fill Callback (called when broker reports fill)
  // ============================================================

  handleBrokerFill(
    brokerOrderId: string,
    filledQty: number,
    filledPrice: number,
    commission: number
  ): void {
    const order = Array.from(this.orders.values()).find(
      (o) => o.brokerOrderId === brokerOrderId
    );

    if (!order) {
      log.warn(`[TradeExecutor] Broker fill for unknown order: ${brokerOrderId}`);
      return;
    }

    log.info(`[TradeExecutor] Broker fill received: ${brokerOrderId} - ${filledQty} @ ${filledPrice}`);

    order.filledQty += filledQty;
    order.filledPrice = filledPrice;
    order.commission += commission;
    order.updatedAt = toISOString();

    if (order.filledQty >= order.quantity) {
      order.status = 'filled';
      this.clearOrderTimeout(order.id);
      this.updatePosition(order);
      this.addToHistory(order);
      this.addToTradeLog(order);
      this.emit('order:filled', order);
    } else {
      order.status = 'partial';
    }

    this.orders.set(order.id, order);
  }

  handleBrokerRejection(brokerOrderId: string, reason: string): void {
    const order = Array.from(this.orders.values()).find(
      (o) => o.brokerOrderId === brokerOrderId
    );

    if (!order) {
      log.warn(`[TradeExecutor] Broker rejection for unknown order: ${brokerOrderId}`);
      return;
    }

    log.warn(`[TradeExecutor] Broker rejection: ${brokerOrderId} - ${reason}`);

    order.status = 'rejected';
    order.rejectionReason = reason;
    order.updatedAt = toISOString();
    this.orders.set(order.id, order);

    this.clearOrderTimeout(order.id);
    this.addToHistory(order);
    this.emit('order:rejected', order, reason);
  }

  // ============================================================
  // Position Management
  // ============================================================

  private updatePosition(order: TradeOrder): void {
    if (order.status !== 'filled' || order.filledQty === 0) return;

    const code = order.code;
    let position = this.positions.get(code);

    if (!position) {
      position = {
        code,
        quantity: 0,
        avgCost: 0,
        currentValue: 0,
        unrealizedPnL: 0,
        realizedPnL: 0,
      };
    }

    const prevQuantity = position.quantity;
    const prevAvgCost = position.avgCost;

    if (order.side === 'BUY') {
      const totalCost = prevQuantity * prevAvgCost + order.filledQty * order.filledPrice;
      position.quantity = prevQuantity + order.filledQty;
      position.avgCost = position.quantity > 0 ? totalCost / position.quantity : 0;
    } else {
      // SELL
      if (order.filledQty > prevQuantity) {
        log.warn(`[TradeExecutor] Sell quantity exceeds position for ${code}`);
      }
      const realizedPnL = (order.filledPrice - prevAvgCost) * Math.min(order.filledQty, prevQuantity);
      position.realizedPnL += realizedPnL;
      this.dailyRealizedPnL += realizedPnL;
      position.quantity = Math.max(0, prevQuantity - order.filledQty);
      if (position.quantity === 0) {
        position.avgCost = 0;
      }
    }

    // Update current value from price feed
    const lastPrice = this.getLastPrice(code);
    if (lastPrice > 0) {
      position.currentValue = position.quantity * lastPrice;
      position.unrealizedPnL = (lastPrice - position.avgCost) * position.quantity;
    }

    // Store or remove position
    if (position.quantity > 0) {
      this.positions.set(code, position);
    } else {
      this.positions.delete(code);
    }

    this.emit('position:updated', position);
    log.debug(`[TradeExecutor] Position updated: ${code} qty=${position.quantity} avg=${position.avgCost.toFixed(2)}`);
  }

  getPositions(): PositionInfo[] {
    return Array.from(this.positions.values());
  }

  getPosition(code: string): PositionInfo | null {
    return this.positions.get(code) ?? null;
  }

  // ============================================================
  // Trade Logging
  // ============================================================

  getTradeLog(limit?: number): TradeOrder[] {
    const sorted = [...this.tradeLog].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
    return limit ? sorted.slice(0, limit) : sorted;
  }

  calculateDailyPnL(date?: string): DailyPnL {
    const targetDate = date ?? new Date().toISOString().split('T')[0];

    // Check cache
    const cached = this.dailyPnLMap.get(targetDate);
    if (cached) return cached;

    // Calculate from trade log
    const dayTrades = this.tradeLog.filter((t) => t.updatedAt.startsWith(targetDate));

    let pnl = 0;
    let commission = 0;
    let winningTrades = 0;
    let losingTrades = 0;

    for (const trade of dayTrades) {
      if (trade.status === 'filled') {
        // For sells, calculate P&L based on position
        if (trade.side === 'SELL') {
          const position = this.positions.get(trade.code);
          if (position) {
            const tradePnL = (trade.filledPrice - position.avgCost) * trade.filledQty;
            pnl += tradePnL;
            if (tradePnL > 0) winningTrades++;
            else if (tradePnL < 0) losingTrades++;
          }
        }
        commission += trade.commission;
      }
    }

    const dailyPnL: DailyPnL = {
      date: targetDate,
      pnl,
      trades: dayTrades.length,
      commission,
      winningTrades,
      losingTrades,
    };

    this.dailyPnLMap.set(targetDate, dailyPnL);
    return dailyPnL;
  }

  calculateTradeStats(): TradeStats {
    const filledOrders = this.tradeLog.filter((t) => t.status === 'filled');
    const totalTrades = filledOrders.length;

    let winningTrades = 0;
    let losingTrades = 0;
    let totalPnL = 0;
    let totalCommission = 0;
    let totalWin = 0;
    let totalLoss = 0;
    let maxDrawdown = 0;
    let peakPnL = 0;
    let runningPnL = 0;

    // Process trades in chronological order
    const sorted = [...filledOrders].sort(
      (a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
    );

    for (const trade of sorted) {
      totalCommission += trade.commission;

      if (trade.side === 'SELL') {
        const position = this.positions.get(trade.code);
        if (position) {
          const tradePnL = (trade.filledPrice - position.avgCost) * trade.filledQty - trade.commission;
          runningPnL += tradePnL;
          totalPnL += tradePnL;

          if (tradePnL > 0) {
            winningTrades++;
            totalWin += tradePnL;
          } else if (tradePnL < 0) {
            losingTrades++;
            totalLoss += Math.abs(tradePnL);
          }

          // Track drawdown
          peakPnL = Math.max(peakPnL, runningPnL);
          const drawdown = peakPnL - runningPnL;
          maxDrawdown = Math.max(maxDrawdown, drawdown);
        }
      }
    }

    const winRate = totalTrades > 0 ? winningTrades / (winningTrades + losingTrades) : 0;
    const avgWin = winningTrades > 0 ? totalWin / winningTrades : 0;
    const avgLoss = losingTrades > 0 ? totalLoss / losingTrades : 0;
    const profitFactor = totalLoss > 0 ? totalWin / totalLoss : totalWin > 0 ? Infinity : 0;

    return {
      totalTrades,
      winningTrades,
      losingTrades,
      winRate,
      totalPnL,
      totalCommission,
      avgWin,
      avgLoss,
      maxDrawdown,
      profitFactor,
    };
  }

  getCommissionTotal(): number {
    return this.tradeLog.reduce((sum, t) => sum + t.commission, 0);
  }

  getCommissionByDate(date: string): number {
    return this.tradeLog
      .filter((t) => t.updatedAt.startsWith(date))
      .reduce((sum, t) => sum + t.commission, 0);
  }

  // ============================================================
  // Execution Modes
  // ============================================================

  setMode(mode: 'paper' | 'real'): void {
    const previousMode = this.config.mode;
    if (previousMode === mode) {
      log.info(`[TradeExecutor] Already in ${mode} mode`);
      return;
    }

    log.info(`[TradeExecutor] Switching mode: ${previousMode} → ${mode}`);

    // Safety: cancel all pending orders when switching modes
    const pendingOrders = this.getOrders({ status: 'pending' });
    for (const order of pendingOrders) {
      this.cancelOrder(order.id);
    }

    this.config.mode = mode;

    if (mode === 'real') {
      // Additional safety checks for real mode
      log.warn('[TradeExecutor] REAL MODE ACTIVATED - All orders will be sent to broker');
      if (!this.brokerAdapter) {
        log.error('[TradeExecutor] WARNING: No broker adapter configured! Real orders will fail.');
      }
    } else {
      log.info('[TradeExecutor] Paper mode activated - orders will be simulated');
    }

    this.emit('mode:changed', mode);
    log.info(`[TradeExecutor] Mode changed to: ${mode}`);
  }

  getMode(): 'paper' | 'real' {
    return this.config.mode;
  }

  async emergencyStop(): Promise<number> {
    log.warn('[TradeExecutor] EMERGENCY STOP triggered!');
    this.isEmergencyStopped = true;

    // Cancel all open orders
    const openOrders = [
      ...this.getOrders({ status: 'pending' }),
      ...this.getOrders({ status: 'submitted' }),
      ...this.getOrders({ status: 'partial' }),
    ];

    let cancelledCount = 0;
    const cancelPromises = openOrders.map(async (order) => {
      try {
        const success = await this.cancelOrder(order.id);
        if (success) cancelledCount++;
      } catch (err) {
        log.error(`[TradeExecutor] Error cancelling order ${order.id} during emergency stop:`, err);
      }
    });

    await Promise.all(cancelPromises);

    this.emit('emergency:stop', cancelledCount);
    log.warn(`[TradeExecutor] Emergency stop complete. Cancelled ${cancelledCount} orders.`);

    return cancelledCount;
  }

  resetEmergencyStop(): void {
    this.isEmergencyStopped = false;
    log.info('[TradeExecutor] Emergency stop reset');
  }

  isStopped(): boolean {
    return this.isEmergencyStopped;
  }

  // ============================================================
  // Configuration
  // ============================================================

  getConfig(): ExecutionConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<ExecutionConfig>): void {
    const previousConfig = { ...this.config };

    // Apply updates with validation
    if (updates.mode !== undefined) {
      this.setMode(updates.mode);
    }

    if (updates.maxPositionSizePct !== undefined) {
      if (updates.maxPositionSizePct <= 0 || updates.maxPositionSizePct > 100) {
        throw new Error('maxPositionSizePct must be between 0 and 100');
      }
      this.config.maxPositionSizePct = updates.maxPositionSizePct;
    }

    if (updates.maxDailyLossPct !== undefined) {
      if (updates.maxDailyLossPct <= 0 || updates.maxDailyLossPct > 100) {
        throw new Error('maxDailyLossPct must be between 0 and 100');
      }
      this.config.maxDailyLossPct = updates.maxDailyLossPct;
    }

    if (updates.maxOpenOrders !== undefined) {
      if (updates.maxOpenOrders <= 0 || updates.maxOpenOrders > 1000) {
        throw new Error('maxOpenOrders must be between 1 and 1000');
      }
      this.config.maxOpenOrders = updates.maxOpenOrders;
    }

    if (updates.defaultCommission !== undefined) {
      if (updates.defaultCommission < 0 || updates.defaultCommission > 0.01) {
        throw new Error('defaultCommission must be between 0 and 0.01');
      }
      this.config.defaultCommission = updates.defaultCommission;
    }

    if (updates.slippageBps !== undefined) {
      if (updates.slippageBps < 0 || updates.slippageBps > 1000) {
        throw new Error('slippageBps must be between 0 and 1000');
      }
      this.config.slippageBps = updates.slippageBps;
    }

    if (updates.requireConfirmation !== undefined) {
      this.config.requireConfirmation = updates.requireConfirmation;
    }

    this.emit('config:updated', this.getConfig());
    log.info('[TradeExecutor] Config updated:', JSON.stringify(this.config, null, 2));
  }

  setTradingHours(hours: { morning: { start: string; end: string }; afternoon: { start: string; end: string } }): void {
    this.tradingHours = hours;
    log.info('[TradeExecutor] Trading hours updated:', JSON.stringify(hours));
  }

  setTotalCapital(capital: number): void {
    if (capital <= 0) throw new Error('Capital must be positive');
    this.totalCapital = capital;
    log.info(`[TradeExecutor] Total capital set to: ${capital}`);
  }

  getTotalCapital(): number {
    return this.totalCapital;
  }

  setBrokerAdapter(adapter: BrokerAdapter): void {
    this.brokerAdapter = adapter;
    log.info('[TradeExecutor] Broker adapter configured');
  }

  /**
   * Set the active broker ID. Orders without an explicit brokerId will be routed
   * to this broker.
   */
  setActiveBroker(brokerId: string): void {
    const previous = this.activeBrokerId;
    this.activeBrokerId = brokerId;
    log.info(`[TradeExecutor] Active broker changed: ${previous || '(none)'} → ${brokerId || '(none)'}`);
  }

  /**
   * Get the currently active broker ID.
   */
  getActiveBroker(): string {
    return this.activeBrokerId;
  }

  /**
   * Resolve the effective broker ID for a given signal.
   * Priority: signal.brokerId > activeBrokerId > empty string (no routing).
   */
  private resolveBrokerId(signal: TradeSignal): string {
    return signal.brokerId || this.activeBrokerId || '';
  }

  // ============================================================
  // Price Feed
  // ============================================================

  updatePriceFeed(code: string, quote: { bid: number; ask: number; last: number }): void {
    this.priceFeed.set(code, quote);

    // Update position values
    const position = this.positions.get(code);
    if (position) {
      position.currentValue = position.quantity * quote.last;
      position.unrealizedPnL = (quote.last - position.avgCost) * position.quantity;
    }

    // Check stop orders
    this.checkStopOrders(code, quote.last);
  }

  private checkStopOrders(code: string, lastPrice: number): void {
    const stopOrders = this.getOrders({ code }).filter(
      (o) =>
        (o.orderType === 'STOP' || o.orderType === 'STOP_LIMIT') &&
        (o.status === 'pending' || o.status === 'submitted')
    );

    for (const order of stopOrders) {
      if (!order.stopPrice) continue;

      let shouldTrigger = false;

      if (order.side === 'BUY' && lastPrice >= order.stopPrice) {
        shouldTrigger = true;
      } else if (order.side === 'SELL' && lastPrice <= order.stopPrice) {
        shouldTrigger = true;
      }

      if (shouldTrigger) {
        log.info(`[TradeExecutor] Stop order triggered: ${order.id} at ${lastPrice}`);
        order.status = 'submitted';
        order.updatedAt = toISOString();
        this.orders.set(order.id, order);
        this.executeOrder(order);
      }
    }
  }

  getPriceFeed(code: string): { bid: number; ask: number; last: number } | null {
    return this.priceFeed.get(code) ?? null;
  }

  // ============================================================
  // Pending Queue (Confirmation Mode)
  // ============================================================

  getPendingSignals(): TradeSignal[] {
    return [...this.pendingQueue];
  }

  async confirmPendingSignal(index: number): Promise<TradeOrder | null> {
    if (index < 0 || index >= this.pendingQueue.length) {
      log.warn(`[TradeExecutor] Invalid pending signal index: ${index}`);
      return null;
    }

    const signal = this.pendingQueue.splice(index, 1)[0];
    log.info(`[TradeExecutor] Confirming pending signal: ${signal.code} ${signal.side}`);

    // Temporarily disable confirmation requirement
    const wasConfirmationRequired = this.config.requireConfirmation;
    this.config.requireConfirmation = false;

    const result = await this.processSignal(signal);

    this.config.requireConfirmation = wasConfirmationRequired;
    return result;
  }

  rejectPendingSignal(index: number): boolean {
    if (index < 0 || index >= this.pendingQueue.length) {
      log.warn(`[TradeExecutor] Invalid pending signal index: ${index}`);
      return false;
    }

    const signal = this.pendingQueue.splice(index, 1)[0];
    log.info(`[TradeExecutor] Rejected pending signal: ${signal.code} ${signal.side}`);
    return true;
  }

  clearPendingSignals(): number {
    const count = this.pendingQueue.length;
    this.pendingQueue = [];
    log.info(`[TradeExecutor] Cleared ${count} pending signals`);
    return count;
  }

  // ============================================================
  // Order Timeout Management
  // ============================================================

  private setOrderTimeout(orderId: string): void {
    const timer = setTimeout(() => {
      this.handleOrderTimeout(orderId);
    }, ORDER_TIMEOUT_MS);

    this.orderTimers.set(orderId, timer);
  }

  private clearOrderTimeout(orderId: string): void {
    const timer = this.orderTimers.get(orderId);
    if (timer) {
      clearTimeout(timer);
      this.orderTimers.delete(orderId);
    }
  }

  private async handleOrderTimeout(orderId: string): Promise<void> {
    const order = this.orders.get(orderId);
    if (!order) return;

    if (order.status === 'pending' || order.status === 'submitted') {
      log.warn(`[TradeExecutor] Order timed out: ${orderId}`);
      await this.cancelOrder(orderId);
    }
  }

  private checkOrderTimeouts(): void {
    const now = Date.now();
    for (const [orderId, order] of this.orders.entries()) {
      if (
        (order.status === 'pending' || order.status === 'submitted') &&
        now - new Date(order.createdAt).getTime() > ORDER_TIMEOUT_MS
      ) {
        log.warn(`[TradeExecutor] Periodic check: order timed out: ${orderId}`);
        this.cancelOrder(orderId);
      }
    }
  }

  // ============================================================
  // Cleanup & Maintenance
  // ============================================================

  private cleanupRecentSignals(): void {
    const now = Date.now();
    for (const [key, timestamp] of this.recentSignals.entries()) {
      if (now - timestamp > DUPLICATE_SIGNAL_WINDOW_MS * 5) {
        this.recentSignals.delete(key);
      }
    }
  }

  private addToHistory(order: TradeOrder): void {
    this.orderHistory.push({ ...order });

    // Trim history if too large
    if (this.orderHistory.length > MAX_ORDER_HISTORY) {
      this.orderHistory = this.orderHistory.slice(-MAX_ORDER_HISTORY);
    }
  }

  private addToTradeLog(order: TradeOrder): void {
    if (order.status === 'filled') {
      this.tradeLog.push({ ...order });

      // Trim trade log if too large
      if (this.tradeLog.length > MAX_TRADE_LOG) {
        this.tradeLog = this.tradeLog.slice(-MAX_TRADE_LOG);
      }
    }
  }

  private updateDailyPnL(): void {
    const today = new Date().toISOString().split('T')[0];
    // Force recalculate
    this.dailyPnLMap.delete(today);
    const pnl = this.calculateDailyPnL(today);
    this.emit('daily:pnl', pnl);
  }

  private async simulateDelay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ============================================================
  // Shutdown
  // ============================================================

  async shutdown(): Promise<void> {
    log.info('[TradeExecutor] Shutting down...');

    // Clear all timers
    for (const [orderId, timer] of this.orderTimers.entries()) {
      clearTimeout(timer);
    }
    this.orderTimers.clear();

    // Cancel all open orders
    const openOrders = [
      ...this.getOrders({ status: 'pending' }),
      ...this.getOrders({ status: 'submitted' }),
    ];

    for (const order of openOrders) {
      try {
        await this.cancelOrder(order.id);
      } catch (err) {
        log.error(`[TradeExecutor] Error cancelling order during shutdown:`, err);
      }
    }

    // Persist state
    this.persistState();

    // Remove all listeners
    this.removeAllListeners();

    this.initialized = false;
    log.info('[TradeExecutor] Shutdown complete');
  }

  private persistState(): void {
    // In production, this would save to a database or file
    log.info('[TradeExecutor] Persisting state...');
    log.info(`[TradeExecutor] Orders: ${this.orders.size}`);
    log.info(`[TradeExecutor] History: ${this.orderHistory.length}`);
    log.info(`[TradeExecutor] Trade log: ${this.tradeLog.length}`);
    log.info(`[TradeExecutor] Positions: ${this.positions.size}`);
  }

  // ============================================================
  // Summary & Diagnostics
  // ============================================================

  getSummary(): {
    mode: string;
    totalOrders: number;
    openOrders: number;
    filledOrders: number;
    positions: number;
    dailyPnL: number;
    totalCapital: number;
    emergencyStopped: boolean;
    pendingSignals: number;
    activeBroker: string;
  } {
    const stats = this.calculateTradeStats();
    return {
      mode: this.config.mode,
      totalOrders: this.orders.size + this.orderHistory.length,
      openOrders: this.getOrders({ status: 'pending' }).length +
        this.getOrders({ status: 'submitted' }).length,
      filledOrders: this.tradeLog.length,
      positions: this.positions.size,
      dailyPnL: this.dailyRealizedPnL,
      totalCapital: this.totalCapital,
      emergencyStopped: this.isEmergencyStopped,
      pendingSignals: this.pendingQueue.length,
      activeBroker: this.activeBrokerId,
    };
  }

  getDiagnostics(): Record<string, any> {
    return {
      config: this.getConfig(),
      summary: this.getSummary(),
      stats: this.calculateTradeStats(),
      positions: this.getPositions(),
      recentSignals: this.recentSignals.size,
      priceFeedSize: this.priceFeed.size,
      orderTimers: this.orderTimers.size,
      initialized: this.initialized,
    };
  }
}

// ============================================================
// Singleton Export
// ============================================================

let _instance: TradeExecutor | null = null;

export function getTradeExecutor(config?: Partial<ExecutionConfig>): TradeExecutor {
  if (!_instance) {
    _instance = new TradeExecutor(config);
  }
  return _instance;
}

export function resetTradeExecutor(): void {
  if (_instance) {
    _instance.shutdown();
    _instance = null;
  }
}

export default TradeExecutor;

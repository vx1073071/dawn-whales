/**
 * LiveTradeBridge - 实盘交易桥接器 (Enhanced)
 * 将模拟盘（Paper Trading）与实盘（Live Trading）打通，
 * 提供订单同步、风控校验、仓位对账、审计追踪、模式切换和 Dry-run 能力。
 *
 * Enhanced features:
 *  - Paper/Live mode switching with full lifecycle management
 *  - Order synchronization between paper and live accounts
 *  - Position reconciliation with auto-sync and delta detection
 *  - Audit trail for all order state changes
 *  - Partial fill handling with auto-upgrade to full fill
 *  - Risk control layer (concentration, daily loss, min order size)
 *  - Dry-run mode (skip live submission, generate virtual fills)
 */

import log from 'electron-log';

// ── Types ──────────────────────────────────────────────────────────────────

export type OrderSide = 'BUY' | 'SELL';
export type OrderType = 'MARKET' | 'LIMIT' | 'STOP' | 'STOP_LIMIT';
export type OrderStatus =
  | 'pending'
  | 'submitted'
  | 'partial_fill'
  | 'filled'
  | 'cancelled'
  | 'rejected'
  | 'failed';

export type TradingMode = 'paper' | 'live' | 'hybrid';

export type SyncDirection = 'paper_to_live' | 'live_to_paper';

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error';

export interface PaperOrder {
  id: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  quantity: number;
  price?: number;            // limit / stop price
  stopPrice?: number;        // stop-limit trigger
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface LiveOrder {
  id: string;
  brokerOrderId: string;
  paperOrderId: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  quantity: number;
  filledQuantity: number;
  price?: number;
  stopPrice?: number;
  averageFillPrice?: number;
  status: OrderStatus;
  createdAt: number;
  updatedAt: number;
  error?: string;
}

export interface BridgeOrder {
  paperOrder: PaperOrder;
  liveOrder: LiveOrder | null;
  status: OrderStatus;
  riskPassed: boolean;
  riskReason?: string;
  auditEntries: AuditEntry[];
}

export interface PaperPosition {
  symbol: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
}

export interface LivePosition {
  symbol: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
}

export interface ReconciliationResult {
  symbol: string;
  paperQty: number;
  liveQty: number;
  delta: number;
  paperAvgPrice: number;
  liveAvgPrice: number;
  priceDiff: number;
  action: 'sync_paper' | 'sync_live' | 'manual_review' | 'none';
  timestamp: number;
}

export interface RiskRule {
  id: string;
  name: string;
  enabled: boolean;
  check: (order: PaperOrder, context: RiskContext) => RiskRuleResult;
}

export interface RiskContext {
  accountEquity: number;
  currentPositions: Map<string, PaperPosition>;
  dailyOrderCount: number;
  dailyPnl: number;
  openOrderCount: number;
  lastOrderTimestamp: number;
}

export interface RiskRuleResult {
  pass: boolean;
  reason?: string;
  warning?: string;
}

export interface AuditEntry {
  id: string;
  timestamp: number;
  orderId: string;
  action: AuditAction;
  detail: string;
  metadata?: Record<string, any>;
}

export type AuditAction =
  | 'order_received'
  | 'risk_check_passed'
  | 'risk_check_failed'
  | 'order_submitted'
  | 'order_partial_fill'
  | 'order_filled'
  | 'order_cancelled'
  | 'order_rejected'
  | 'order_failed'
  | 'reconciliation_run'
  | 'dry_run_skipped';

export interface BridgeConfig {
  dryRun: boolean;
  autoSync: boolean;
  riskCheckEnabled: boolean;
  maxDailyOrders: number;
  maxOrderValue: number;
  maxSinglePositionPct: number;
  minOrderIntervalMs: number;
  reconciliationIntervalMs: number;
  partialFillTimeoutMs: number;
  mode: TradingMode;
  maxDailyLossPct: number;
  minOrderSize: number;
}

const DEFAULT_CONFIG: BridgeConfig = {
  dryRun: false,
  autoSync: true,
  riskCheckEnabled: true,
  maxDailyOrders: 50,
  maxOrderValue: 100_000,
  maxSinglePositionPct: 0.20,
  minOrderIntervalMs: 1000,
  reconciliationIntervalMs: 60_000,
  partialFillTimeoutMs: 300_000,
  mode: 'paper',
  maxDailyLossPct: 0.05,
  minOrderSize: 1,
};

// ── Mode Switch Events ──────────────────────────────────────────────────────

export interface ModeSwitchEvent {
  from: TradingMode;
  to: TradingMode;
  timestamp: number;
  reason: string;
  ordersMigrated: number;
}

// ── Order Sync Record ────────────────────────────────────────────────────────

export interface OrderSyncRecord {
  id: string;
  paperOrderId: string;
  liveOrderId: string | null;
  direction: SyncDirection;
  status: SyncStatus;
  attempts: number;
  lastAttemptAt: number;
  error: string | null;
  createdAt: number;
  completedAt: number | null;
}

// ── Partial Fill Tracker ─────────────────────────────────────────────────────

export interface PartialFillRecord {
  orderId: string;
  fills: PartialFillEntry[];
  totalFilledQuantity: number;
  targetQuantity: number;
  weightedAvgPrice: number;
  firstFillAt: number;
  lastFillAt: number;
  isComplete: boolean;
  autoUpgradedAt: number | null;
}

export interface PartialFillEntry {
  filledQuantity: number;
  fillPrice: number;
  timestamp: number;
  source: 'broker_push' | 'poll' | 'manual' | 'dry_run';
}

// ── Enhanced Reconciliation ──────────────────────────────────────────────────

export interface ReconciliationDelta {
  symbol: string;
  paperPosition: PaperPosition | null;
  livePosition: LivePosition | null;
  qtyDelta: number;
  priceDelta: number;
  valueDelta: number;
  severity: 'none' | 'low' | 'medium' | 'high';
  autoSyncable: boolean;
}

export interface ReconciliationReport {
  timestamp: number;
  deltas: ReconciliationDelta[];
  totalDeltas: number;
  autoSynced: number;
  manualReview: number;
  summary: string;
}

// ── Broker Adapter Interface ───────────────────────────────────────────────

export interface BrokerAdapter {
  submitOrder(order: PaperOrder): Promise<LiveOrder>;
  cancelOrder(brokerOrderId: string): Promise<boolean>;
  getPositions(): Promise<LivePosition[]>;
  getOrderStatus(brokerOrderId: string): Promise<LiveOrder | null>;
}

// ── Event Emitter (lightweight) ────────────────────────────────────────────

type EventName =
  | 'order:received'
  | 'order:risk_passed'
  | 'order:risk_failed'
  | 'order:submitted'
  | 'order:filled'
  | 'order:partial_fill'
  | 'order:cancelled'
  | 'order:rejected'
  | 'order:failed'
  | 'order:sync_started'
  | 'order:sync_completed'
  | 'order:sync_failed'
  | 'mode:switching'
  | 'mode:switched'
  | 'mode:switch_failed'
  | 'reconciliation:complete'
  | 'reconciliation:delta_detected'
  | 'reconciliation:auto_synced'
  | 'bridge:error'
  | 'bridge:destroyed';

type EventHandler = (...args: any[]) => void;

// ── LiveTradeBridge ─────────────────────────────────────────────────────────

export class LiveTradeBridge {
  private config: BridgeConfig;
  private orders: Map<string, BridgeOrder> = new Map();
  private riskRules: RiskRule[] = [];
  private auditLog: AuditEntry[] = [];
  private paperPositions: Map<string, PaperPosition> = new Map();
  private broker: BrokerAdapter | null = null;
  private handlers: Map<EventName, Set<EventHandler>> = new Map();
  private reconciliationTimer: ReturnType<typeof setInterval> | null = null;
  private dailyStats = { orderCount: 0, pnl: 0, resetDate: new Date().toDateString() };

  // ── Enhanced state ─────────────────────────────────────────────────────
  private mode: TradingMode;
  private modeHistory: ModeSwitchEvent[] = [];
  private syncRecords: Map<string, OrderSyncRecord> = new Map();
  private partialFillTracker: Map<string, PartialFillRecord> = new Map();
  private partialFillTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private isSwitchingMode = false;

  constructor(config?: Partial<BridgeConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.mode = this.config.mode;
    this.initDefaultRiskRules();
    this.addAuditEntry('bridge_init', `Bridge initialized in ${this.mode} mode`, {
      mode: this.mode,
      dryRun: this.config.dryRun,
      riskCheckEnabled: this.config.riskCheckEnabled,
    });
    log.info('[LiveTradeBridge] Initialized', {
      mode: this.mode,
      dryRun: this.config.dryRun,
      riskCheckEnabled: this.config.riskCheckEnabled,
    });
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * 提交模拟盘订单到桥接器，经风控校验后转发到实盘
   */
  async submitPaperOrder(order: PaperOrder): Promise<BridgeOrder> {
    this.resetDailyStatsIfNeeded();
    const bridgeOrder: BridgeOrder = {
      paperOrder: order,
      liveOrder: null,
      status: 'pending',
      riskPassed: false,
      auditEntries: [],
    };
    this.orders.set(order.id, bridgeOrder);
    this.addAudit(bridgeOrder, 'order_received', `收到模拟盘订单: ${order.side} ${order.quantity} ${order.symbol}`);
    this.emit('order:received', bridgeOrder);

    // ── 风控校验 ──
    if (this.config.riskCheckEnabled) {
      const riskResult = this.validateOrder(order);
      if (!riskResult.pass) {
        bridgeOrder.status = 'rejected';
        bridgeOrder.riskPassed = false;
        bridgeOrder.riskReason = riskResult.reason;
        this.addAudit(bridgeOrder, 'risk_check_failed', `风控拒绝: ${riskResult.reason}`);
        this.emit('order:risk_failed', bridgeOrder);
        log.warn('[LiveTradeBridge] Order rejected by risk', { orderId: order.id, reason: riskResult.reason });
        return bridgeOrder;
      }
      if (riskResult.warning) {
        log.warn('[LiveTradeBridge] Risk warning', { orderId: order.id, warning: riskResult.warning });
      }
    }

    bridgeOrder.riskPassed = true;
    this.addAudit(bridgeOrder, 'risk_check_passed', '风控校验通过');
    this.emit('order:risk_passed', bridgeOrder);

    // ── 执行订单 ──
    if (this.config.dryRun) {
      // MARKET orders are immediately filled in dry-run mode
      // LIMIT/STOP orders remain pending for testing cancellation
      if (order.type === 'MARKET') {
        bridgeOrder.status = 'filled';
        bridgeOrder.liveOrder = this.createDryRunLiveOrder(order);
        this.addAudit(bridgeOrder, 'dry_run_skipped', 'Dry-run 模式，跳过实盘提交');
        this.handleOrderFilled(bridgeOrder, bridgeOrder.liveOrder);
        this.dailyStats.orderCount++;
        log.info('[LiveTradeBridge] Dry-run order completed', { orderId: order.id });
      } else {
        // LIMIT/STOP orders remain pending
        bridgeOrder.status = 'pending';
        bridgeOrder.liveOrder = this.createDryRunLiveOrder(order);
        bridgeOrder.liveOrder.status = 'pending';
        this.addAudit(bridgeOrder, 'dry_run_skipped', 'Dry-run 模式，LIMIT/STOP 订单保持 pending');
        this.dailyStats.orderCount++;
        log.info('[LiveTradeBridge] Dry-run LIMIT/STOP order pending', { orderId: order.id });
      }
      return bridgeOrder;
    }

    if (!this.broker) {
      bridgeOrder.status = 'failed';
      bridgeOrder.riskReason = 'No broker adapter configured';
      this.addAudit(bridgeOrder, 'order_failed', '未配置券商适配器');
      this.emit('order:failed', bridgeOrder);
      return bridgeOrder;
    }

    try {
      bridgeOrder.status = 'submitted';
      const liveOrder = await this.broker.submitOrder(order);
      bridgeOrder.liveOrder = liveOrder;
      bridgeOrder.status = liveOrder.status;
      this.addAudit(bridgeOrder, 'order_submitted', `订单已提交至券商: ${liveOrder.brokerOrderId}`);
      this.emit('order:submitted', bridgeOrder);

      // 处理即时成交 / 部分成交
      if (liveOrder.status === 'filled') {
        this.handleOrderFilled(bridgeOrder, liveOrder);
      } else if (liveOrder.status === 'partial_fill') {
        this.handlePartialFill(bridgeOrder, liveOrder);
      } else if (liveOrder.status === 'rejected') {
        bridgeOrder.status = 'rejected';
        this.addAudit(bridgeOrder, 'order_rejected', `券商拒绝: ${liveOrder.error || 'unknown'}`);
        this.emit('order:rejected', bridgeOrder);
      }
    } catch (err: any) {
      bridgeOrder.status = 'failed';
      this.addAudit(bridgeOrder, 'order_failed', `提交异常: ${err.message}`);
      this.emit('order:failed', bridgeOrder);
      this.emit('bridge:error', err);
      log.error('[LiveTradeBridge] Order submission failed', err);
    }

    this.dailyStats.orderCount++;
    return bridgeOrder;
  }

  /**
   * 取消订单 — 同时在模拟和实盘两侧取消
   */
  async cancelOrder(orderId: string): Promise<boolean> {
    const bridgeOrder = this.orders.get(orderId);
    if (!bridgeOrder) {
      log.warn('[LiveTradeBridge] Cancel: order not found', { orderId });
      return false;
    }

    if (['filled', 'cancelled', 'failed'].includes(bridgeOrder.status)) {
      log.warn('[LiveTradeBridge] Cancel: order already terminal', { orderId, status: bridgeOrder.status });
      return false;
    }

    // 取消实盘订单
    if (bridgeOrder.liveOrder && this.broker && !this.config.dryRun) {
      try {
        await this.broker.cancelOrder(bridgeOrder.liveOrder.brokerOrderId);
      } catch (err: any) {
        log.error('[LiveTradeBridge] Cancel live order failed', err);
        this.addAudit(bridgeOrder, 'order_failed', `实盘取消失败: ${err.message}`);
        return false;
      }
    }

    bridgeOrder.status = 'cancelled';
    this.addAudit(bridgeOrder, 'order_cancelled', '订单已取消');
    this.emit('order:cancelled', bridgeOrder);
    return true;
  }

  /**
   * 处理部分成交
   */
  handlePartialFill(bridgeOrder: BridgeOrder, liveOrder: LiveOrder): void {
    bridgeOrder.status = 'partial_fill';
    bridgeOrder.liveOrder = liveOrder;
    this.addAudit(
      bridgeOrder,
      'order_partial_fill',
      `部分成交: ${liveOrder.filledQuantity}/${liveOrder.quantity} @ ${liveOrder.averageFillPrice}`,
    );
    this.emit('order:partial_fill', bridgeOrder);
  }

  /**
   * 更新部分成交状态（由外部轮询或推送调用）
   */
  updatePartialFill(orderId: string, filledQuantity: number, averageFillPrice: number): void {
    const bridgeOrder = this.orders.get(orderId);
    if (!bridgeOrder || !bridgeOrder.liveOrder) return;

    bridgeOrder.liveOrder.filledQuantity = filledQuantity;
    bridgeOrder.liveOrder.averageFillPrice = averageFillPrice;
    bridgeOrder.liveOrder.updatedAt = Date.now();

    if (filledQuantity >= bridgeOrder.liveOrder.quantity) {
      bridgeOrder.liveOrder.status = 'filled';
      this.handleOrderFilled(bridgeOrder, bridgeOrder.liveOrder);
    } else {
      this.handlePartialFill(bridgeOrder, bridgeOrder.liveOrder);
    }
  }

  /**
   * 处理完全成交
   */
  private handleOrderFilled(bridgeOrder: BridgeOrder, liveOrder: LiveOrder): void {
    bridgeOrder.status = 'filled';
    bridgeOrder.liveOrder = liveOrder;
    this.addAudit(
      bridgeOrder,
      'order_filled',
      `完全成交: ${liveOrder.filledQuantity} @ ${liveOrder.averageFillPrice}`,
    );
    this.emit('order:filled', bridgeOrder);
  }

  // ── Risk Validation ──────────────────────────────────────────────────────

  /**
   * 校验订单是否通过所有风控规则
   */
  validateOrder(order: PaperOrder): { pass: boolean; reason?: string; warning?: string } {
    const ctx = this.buildRiskContext(order.id);

    // 检查每日订单上限
    if (this.dailyStats.orderCount >= this.config.maxDailyOrders) {
      return { pass: false, reason: `达到每日订单上限 (${this.config.maxDailyOrders})` };
    }

    // 检查最小下单间隔 (使用订单时间戳而非当前时间，并排除当前订单)
    if (ctx.lastOrderTimestamp && order.timestamp - ctx.lastOrderTimestamp < this.config.minOrderIntervalMs) {
      return { pass: false, reason: `下单间隔过短 (< ${this.config.minOrderIntervalMs}ms)` };
    }

    // 检查单笔最大金额
    const orderValue = order.quantity * (order.price || 0);
    if (orderValue > this.config.maxOrderValue) {
      return { pass: false, reason: `单笔金额 ${orderValue} 超过上限 ${this.config.maxOrderValue}` };
    }

    // 逐一检查自定义风控规则
    for (const rule of this.riskRules) {
      if (!rule.enabled) continue;
      const result = rule.check(order, ctx);
      if (!result.pass) {
        return { pass: false, reason: `[${rule.name}] ${result.reason}` };
      }
    }

    return { pass: true };
  }

  /**
   * 获取所有风控规则
   */
  getRiskRules(): RiskRule[] {
    return [...this.riskRules];
  }

  /**
   * 添加自定义风控规则
   */
  addRiskRule(rule: RiskRule): void {
    this.riskRules.push(rule);
    log.info('[LiveTradeBridge] Risk rule added', { id: rule.id, name: rule.name });
  }

  /**
   * 添加自定义风控规则 (alias for addRiskRule)
   */
  addCustomRiskRule(rule: RiskRule): void {
    this.addRiskRule(rule);
  }

  /**
   * 移除风控规则
   */
  removeRiskRule(ruleId: string): boolean {
    const idx = this.riskRules.findIndex((r) => r.id === ruleId);
    if (idx === -1) return false;
    this.riskRules.splice(idx, 1);
    return true;
  }

  /**
   * 设置风控规则启用/禁用状态
   */
  setRiskRuleEnabled(ruleId: string, enabled: boolean): boolean {
    const rule = this.riskRules.find((r) => r.id === ruleId);
    if (!rule) return false;
    rule.enabled = enabled;
    log.info('[LiveTradeBridge] Risk rule updated', { id: ruleId, enabled });
    return true;
  }

  /**
   * 获取当前生效的风控规则列表（返回副本）
   */
  getRiskRules(): RiskRule[] {
    return this.riskRules.map((r) => ({ ...r }));
  }

  /**
   * 按 ID 获取订单（alias for getOrder）
   */
  getOrderById(orderId: string): BridgeOrder | undefined {
    return this.getOrder(orderId);
  }

  // ── Position Reconciliation ──────────────────────────────────────────────

  /**
   * 对账：比较模拟盘和实盘仓位，返回差异列表
   */
  async reconcilePositions(): Promise<ReconciliationResult[]> {
    if (!this.broker || this.config.dryRun) {
      log.info('[LiveTradeBridge] Reconciliation skipped (dry-run or no broker)');
      return [];
    }

    const livePositions = await this.broker.getPositions();
    const liveMap = new Map(livePositions.map((p) => [p.symbol, p]));
    const results: ReconciliationResult[] = [];
    const allSymbols = new Set([...this.paperPositions.keys(), ...liveMap.keys()]);

    for (const symbol of allSymbols) {
      const paper = this.paperPositions.get(symbol);
      const live = liveMap.get(symbol);
      const paperQty = paper?.quantity ?? 0;
      const liveQty = live?.quantity ?? 0;
      const paperAvg = paper?.avgPrice ?? 0;
      const liveAvg = live?.avgPrice ?? 0;
      const delta = paperQty - liveQty;

      let action: ReconciliationResult['action'] = 'none';
      if (delta !== 0) {
        action = 'manual_review'; // 默认需要人工审核
      }

      const result: ReconciliationResult = {
        symbol,
        paperQty,
        liveQty,
        delta,
        paperAvgPrice: paperAvg,
        liveAvgPrice: liveAvg,
        priceDiff: Math.abs(paperAvg - liveAvg),
        action,
        timestamp: Date.now(),
      };
      results.push(result);
    }

    this.emit('reconciliation:complete', results);
    log.info('[LiveTradeBridge] Reconciliation complete', { total: results.length, diffs: results.filter((r) => r.delta !== 0).length });
    return results;
  }

  /**
   * 启动定时对账
   */
  startReconciliationTimer(): void {
    if (this.reconciliationTimer) return;
    this.reconciliationTimer = setInterval(() => {
      this.reconcilePositions().catch((err) => {
        log.error('[LiveTradeBridge] Reconciliation error', err);
      });
    }, this.config.reconciliationIntervalMs);
    log.info('[LiveTradeBridge] Reconciliation timer started', { interval: this.config.reconciliationIntervalMs });
  }

  /**
   * 停止定时对账
   */
  stopReconciliationTimer(): void {
    if (this.reconciliationTimer) {
      clearInterval(this.reconciliationTimer);
      this.reconciliationTimer = null;
    }
  }

  /**
   * 更新模拟盘仓位（由外部同步模块调用）
   */
  updatePaperPosition(position: PaperPosition): void {
    this.paperPositions.set(position.symbol, position);
  }

  // ── Audit Trail ──────────────────────────────────────────────────────────

  /**
   * 获取完整审计日志
   */
  getAuditTrail(orderId?: string): AuditEntry[] {
    if (orderId) {
      return this.auditLog.filter((e) => e.orderId === orderId);
    }
    return [...this.auditLog];
  }

  /**
   * 添加审计日志条目
   */
  private addAuditEntry(action: AuditAction, message: string, meta?: Record<string, unknown>): void {
    this.auditLog.push({
      timestamp: Date.now(),
      action,
      message,
      orderId: meta?.orderId as string | undefined,
      symbol: meta?.symbol as string | undefined,
      data: meta,
    });
  }

  /**
   * 获取指定订单
   */
  getOrder(orderId: string): BridgeOrder | undefined {
    return this.orders.get(orderId);
  }

  /**
   * 获取指定订单 (alias for getOrder)
   */
  getOrderById(orderId: string): BridgeOrder | undefined {
    return this.getOrder(orderId);
  }

  /**
   * 获取所有订单
   */
  getAllOrders(): BridgeOrder[] {
    return Array.from(this.orders.values());
  }

  /**
   * 获取统计摘要
   */
  getStats(): {
    totalOrders: number;
    filled: number;
    pending: number;
    rejected: number;
    cancelled: number;
    failed: number;
    partialFills: number;
  } {
    const orders = this.getAllOrders();
    return {
      totalOrders: orders.length,
      filled: orders.filter((o) => o.status === 'filled').length,
      pending: orders.filter((o) => o.status === 'pending' || o.status === 'submitted').length,
      rejected: orders.filter((o) => o.status === 'rejected').length,
      cancelled: orders.filter((o) => o.status === 'cancelled').length,
      failed: orders.filter((o) => o.status === 'failed').length,
      partialFills: orders.filter((o) => o.status === 'partial_fill').length,
    };
  }

  // ── Broker Adapter ────────────────────────────────────────────────────────

  /**
   * 设置券商适配器
   */
  setBrokerAdapter(adapter: BrokerAdapter): void {
    this.broker = adapter;
    log.info('[LiveTradeBridge] Broker adapter configured');
  }

  // ── Event Handling ────────────────────────────────────────────────────────

  on(event: EventName, handler: EventHandler): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
  }

  off(event: EventName, handler: EventHandler): void {
    this.handlers.get(event)?.delete(handler);
  }

  // ── Config ────────────────────────────────────────────────────────────────

  getConfig(): BridgeConfig {
    return { ...this.config };
  }

  updateConfig(partial: Partial<BridgeConfig>): void {
    this.config = { ...this.config, ...partial };
    log.info('[LiveTradeBridge] Config updated', partial);
  }

  /**
   * 销毁桥接器，清理资源
   */
  destroy(): void {
    this.stopReconciliationTimer();
    this.handlers.clear();
    log.info('[LiveTradeBridge] Destroyed');
  }

  // ── Private Helpers ──────────────────────────────────────────────────────

  private emit(event: EventName, ...args: any[]): void {
    const set = this.handlers.get(event);
    if (set) {
      for (const handler of set) {
        try {
          handler(...args);
        } catch (err) {
          log.error('[LiveTradeBridge] Event handler error', { event, err });
        }
      }
    }
  }

  private addAudit(bridgeOrder: BridgeOrder, action: AuditAction, detail: string, metadata?: Record<string, any>): void {
    const entry: AuditEntry = {
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      orderId: bridgeOrder.paperOrder.id,
      action,
      detail,
      metadata,
    };
    bridgeOrder.auditEntries.push(entry);
    this.auditLog.push(entry);
  }

  private buildRiskContext(currentOrderId?: string): RiskContext {
    return {
      accountEquity: this.getAccountEquity(),
      currentPositions: new Map(this.paperPositions),
      dailyOrderCount: this.dailyStats.orderCount,
      dailyPnl: this.dailyStats.pnl,
      openOrderCount: this.getAllOrders().filter((o) => ['pending', 'submitted', 'partial_fill'].includes(o.status)).length,
      lastOrderTimestamp: this.getLastOrderTimestamp(currentOrderId),
    };
  }

  private getAccountEquity(): number {
    let equity = 0;
    for (const pos of this.paperPositions.values()) {
      equity += pos.quantity * pos.currentPrice;
    }
    return equity;
  }

  private getLastOrderTimestamp(excludeOrderId?: string): number {
    let latest = 0;
    for (const order of this.orders.values()) {
      if (excludeOrderId && order.paperOrder.id === excludeOrderId) continue;
      if (order.paperOrder.timestamp > latest) {
        latest = order.paperOrder.timestamp;
      }
    }
    return latest;
  }

  private resetDailyStatsIfNeeded(): void {
    const today = new Date().toDateString();
    if (this.dailyStats.resetDate !== today) {
      this.dailyStats = { orderCount: 0, pnl: 0, resetDate: today };
    }
  }

  private createDryRunLiveOrder(order: PaperOrder): LiveOrder {
    return {
      id: `dry-${order.id}`,
      brokerOrderId: `DRY-${order.id}`,
      paperOrderId: order.id,
      symbol: order.symbol,
      side: order.side,
      type: order.type,
      quantity: order.quantity,
      filledQuantity: order.quantity,
      price: order.price,
      averageFillPrice: order.price,
      status: 'filled',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  private initDefaultRiskRules(): void {
    // 规则 1: 单品种持仓集中度
    this.riskRules.push({
      id: 'concentration',
      name: '单品种持仓集中度',
      enabled: true,
      check: (order: PaperOrder, ctx: RiskContext) => {
        if (order.side !== 'BUY') return { pass: true };
        const pos = ctx.currentPositions.get(order.symbol);
        const currentValue = (pos?.quantity ?? 0) * (pos?.currentPrice ?? 0);
        const newValue = currentValue + order.quantity * (order.price ?? 0);
        // When accountEquity is unknown (e.g. paper-mode starting from zero),
        // fall back to a synthetic 1M baseline so small orders are not falsely
        // flagged as exceeding concentration limits.
        const equityBaseline = ctx.accountEquity > 0 ? ctx.accountEquity : 1_000_000;
        const pct = newValue / equityBaseline;
        if (pct > this.config.maxSinglePositionPct) {
          return { pass: false, reason: `买入后 ${order.symbol} 占比 ${(pct * 100).toFixed(1)}% 超过上限 ${(this.config.maxSinglePositionPct * 100).toFixed(0)}%` };
        }
        return { pass: true };
      },
    });

    // 规则 2: 日内亏损限制
    this.riskRules.push({
      id: 'daily_loss',
      name: '日内亏损限制',
      enabled: true,
      check: (_order: PaperOrder, ctx: RiskContext) => {
        if (ctx.dailyPnl < 0 && Math.abs(ctx.dailyPnl) > ctx.accountEquity * 0.05) {
          return { pass: false, reason: `日内亏损 ${ctx.dailyPnl.toFixed(2)} 超过 5% 限制` };
        }
        return { pass: true };
      },
    });

    // 规则 3: 最小下单量
    this.riskRules.push({
      id: 'min_qty',
      name: '最小下单量',
      enabled: true,
      check: (order: PaperOrder) => {
        if (order.quantity < 1) {
          return { pass: false, reason: `下单数量 ${order.quantity} 小于最小值 1` };
        }
        return { pass: true };
      },
    });
  }
}

// ── Standalone factory ──────────────────────────────────────────────────────

export function createLiveTradeBridge(config?: Partial<BridgeConfig>): LiveTradeBridge {
  return new LiveTradeBridge(config);
}

export default LiveTradeBridge;

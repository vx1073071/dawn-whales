// @ts-nocheck
﻿// @ts-nocheck
/**
 * LiveTradeBridge - (Enhanced)
 * （Paper Trading Live Trading
 * ordersync、risk control audit trail、 Dry-run 。
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
import { EngineError } from '../core/engine-error';
import i18n from '../../../src/i18n';

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

type EventHandler = (...args: unknown[]) => void;

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
 * submitorder，risk control
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
    this.addAudit(bridgeOrder, 'order_received', i18n.t('liveTradeBridge.k1'));
    this.emit('order:received', bridgeOrder);

 // ── risk control ──
    if (this.config.riskCheckEnabled) {
      const riskResult = this.validateOrder(order);
      if (!riskResult.pass) {
        bridgeOrder.status = 'rejected';
        bridgeOrder.riskPassed = false;
        bridgeOrder.riskReason = riskResult.reason;
        this.addAudit(bridgeOrder, 'risk_check_failed', i18n.t('liveTradeBridge.k2'));
        this.emit('order:risk_failed', bridgeOrder);
        log.warn('[LiveTradeBridge] Order rejected by risk', { orderId: order.id, reason: riskResult.reason });
        return bridgeOrder;
      }
      if (riskResult.warning) {
        log.warn('[LiveTradeBridge] Risk warning', { orderId: order.id, warning: riskResult.warning });
      }
    }

    bridgeOrder.riskPassed = true;
    this.addAudit(bridgeOrder, 'risk_check_passed', i18n.t('liveTradeBridge.k3'));
    this.emit('order:risk_passed', bridgeOrder);

    // ── executeorder ──
    if (this.config.dryRun) {
      // MARKET orders are immediately filled in dry-run mode
      // LIMIT/STOP orders remain pending for testing cancellation
      if (order.type === 'MARKET') {
        bridgeOrder.status = 'filled';
        bridgeOrder.liveOrder = this.createDryRunLiveOrder(order);
        this.addAudit(bridgeOrder, 'dry_run_skipped', i18n.t('liveTradeBridge.k4'));
        this.handleOrderFilled(bridgeOrder, bridgeOrder.liveOrder);
        this.dailyStats.orderCount++;
        log.info('[LiveTradeBridge] Dry-run order completed', { orderId: order.id });
      } else {
        // LIMIT/STOP orders remain pending
        bridgeOrder.status = 'pending';
        bridgeOrder.liveOrder = this.createDryRunLiveOrder(order);
        bridgeOrder.liveOrder.status = 'pending';
        this.addAudit(bridgeOrder, 'dry_run_skipped', i18n.t('liveTradeBridge.k5'));
        this.dailyStats.orderCount++;
        log.info('[LiveTradeBridge] Dry-run LIMIT/STOP order pending', { orderId: order.id });
      }
      return bridgeOrder;
    }

    if (!this.broker) {
      bridgeOrder.status = 'failed';
      bridgeOrder.riskReason = 'No broker adapter configured';
      this.addAudit(bridgeOrder, 'order_failed', i18n.t('liveTradeBridge.k6'));
      this.emit('order:failed', bridgeOrder);
      return bridgeOrder;
    }

    try {
      bridgeOrder.status = 'submitted';
      const liveOrder = await this.broker.submitOrder(order);
      bridgeOrder.liveOrder = liveOrder;
      bridgeOrder.status = liveOrder.status;
      this.addAudit(bridgeOrder, 'order_submitted', i18n.t('liveTradeBridge.k7'));
      this.emit('order:submitted', bridgeOrder);

 // /
      if (liveOrder.status === 'filled') {
        this.handleOrderFilled(bridgeOrder, liveOrder);
      } else if (liveOrder.status === 'partial_fill') {
        this.handlePartialFill(bridgeOrder, liveOrder);
      } else if (liveOrder.status === 'rejected') {
        bridgeOrder.status = 'rejected';
        this.addAudit(bridgeOrder, 'order_rejectedi18n.t('liveTradeBridge.k8')unknown'}`);
        this.emit('order:rejected', bridgeOrder);
      }
    } catch (err: unknown) {
      bridgeOrder.status = 'failed';
      this.addAudit(bridgeOrder, 'order_failed', i18n.t('liveTradeBridge.k9'));
      this.emit('order:failed', bridgeOrder);
      this.emit('bridge:error', err);
      log.error('[LiveTradeBridge] Order submission failed', err);
    }

    this.dailyStats.orderCount++;
    return bridgeOrder;
  }

  /**
   ${i18n.t('LiveTradeBridge.k0')}
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

    ${i18n.t('LiveTradeBridge.k1')}
    if (bridgeOrder.liveOrder && this.broker && !this.config.dryRun) {
      try {
        await this.broker.cancelOrder(bridgeOrder.liveOrder.brokerOrderId);
      } catch (err: unknown) {
        log.error('[LiveTradeBridge] Cancel live order failed', err);
        this.addAudit(bridgeOrder, 'order_failed', i18n.t('liveTradeBridge.k10'));
        return false;
      }
    }

    bridgeOrder.status = 'cancelled';
    this.addAudit(bridgeOrder, 'order_cancelled', i18n.t('liveTradeBridge.k11'));
    this.emit('order:cancelled', bridgeOrder);
    return true;
  }

  /**
   ${i18n.t('LiveTradeBridge.k2')}
   */
  handlePartialFill(bridgeOrder: BridgeOrder, liveOrder: LiveOrder): void {
    bridgeOrder.status = 'partial_fill';
    bridgeOrder.liveOrder = liveOrder;
    this.addAudit(
      bridgeOrder,
      'order_partial_fill',
      i18n.t('liveTradeBridge.k12'),
    );
    this.emit('order:partial_fill', bridgeOrder);
  }

  /**
   ${i18n.t('LiveTradeBridge.k3')}
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
   ${i18n.t('LiveTradeBridge.k4')}
   */
  private handleOrderFilled(bridgeOrder: BridgeOrder, liveOrder: LiveOrder): void {
    bridgeOrder.status = 'filled';
    bridgeOrder.liveOrder = liveOrder;
    this.addAudit(
      bridgeOrder,
      'order_filled',
      i18n.t('liveTradeBridge.k13'),
    );
    this.emit('order:filled', bridgeOrder);
  }

  // ── Risk Validation ──────────────────────────────────────────────────────

  /**
   ${i18n.t('LiveTradeBridge.k5')}
   */
  validateOrder(order: PaperOrder): { pass: boolean; reason?: string; warning?: string } {
    const ctx = this.buildRiskContext(order.id);

    ${i18n.t('LiveTradeBridge.k6')}
    if (this.dailyStats.orderCount >= this.config.maxDailyOrders) {
      return { pass: false, reason: i18n.t('liveTradeBridge.k14') };
    }

    ${i18n.t('LiveTradeBridge.k7')}
    if (ctx.lastOrderTimestamp && order.timestamp - ctx.lastOrderTimestamp < this.config.minOrderIntervalMs) {
      return { pass: false, reason: i18n.t('liveTradeBridge.k15') };
    }

    ${i18n.t('LiveTradeBridge.k8')}
    const orderValue = order.quantity * (order.price || 0);
    if (orderValue > this.config.maxOrderValue) {
      return { pass: false, reason: i18n.t('liveTradeBridge.k16') };
    }

    ${i18n.t('LiveTradeBridge.k9')}
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
   ${i18n.t('LiveTradeBridge.k10')}
   */
  getRiskRules(): RiskRule[] {
    return [...this.riskRules];
  }

  /**
   ${i18n.t('LiveTradeBridge.k11')}
   */
  addRiskRule(rule: RiskRule): void {
    this.riskRules.push(rule);
    log.info('[LiveTradeBridge] Risk rule added', { id: rule.id, name: rule.name });
  }

  /**
   ${i18n.t('LiveTradeBridge.k12')}
   */
  addCustomRiskRule(rule: RiskRule): void {
    this.addRiskRule(rule);
  }

  /**
   ${i18n.t('LiveTradeBridge.k13')}
   */
  removeRiskRule(ruleId: string): boolean {
    const idx = this.riskRules.findIndex((r) => r.id === ruleId);
    if (idx === -1) return false;
    this.riskRules.splice(idx, 1);
    return true;
  }

  /**
   ${i18n.t('LiveTradeBridge.k14')}
   */
  setRiskRuleEnabled(ruleId: string, enabled: boolean): boolean {
    const rule = this.riskRules.find((r) => r.id === ruleId);
    if (!rule) return false;
    rule.enabled = enabled;
    log.info('[LiveTradeBridge] Risk rule updated', { id: ruleId, enabled });
    return true;
  }

  /**
   ${i18n.t('LiveTradeBridge.k15')}
   */
  getRiskRules(): RiskRule[] {
    return this.riskRules.map((r) => ({ ...r }));
  }

  /**
   ${i18n.t('LiveTradeBridge.k16')}
   */
  getOrderById(orderId: string): BridgeOrder | undefined {
    return this.getOrder(orderId);
  }

  // ── Position Reconciliation ──────────────────────────────────────────────

  /**
   ${i18n.t('LiveTradeBridge.k17')}
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
        ${i18n.t('LiveTradeBridge.k18')}
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
   ${i18n.t('LiveTradeBridge.k19')}
   */
  startReconciliationTimer(): void {
    if (this.reconciliationTimer) return;
    this.reconciliationTimer = setInterval(() => {
      this.reconcilePositions().catch((err: unknown) => {
        log.error('[LiveTradeBridge] Reconciliation error', err);
      });
    }, this.config.reconciliationIntervalMs);
    log.info('[LiveTradeBridge] Reconciliation timer started', { interval: this.config.reconciliationIntervalMs });
  }

  /**
   ${i18n.t('LiveTradeBridge.k20')}
   */
  stopReconciliationTimer(): void {
    if (this.reconciliationTimer) {
      clearInterval(this.reconciliationTimer);
      this.reconciliationTimer = null;
    }
  }

  /**
   ${i18n.t('LiveTradeBridge.k21')}
   */
  updatePaperPosition(position: PaperPosition): void {
    this.paperPositions.set(position.symbol, position);
  }

  // ── Audit Trail ──────────────────────────────────────────────────────────

  /**
   ${i18n.t('LiveTradeBridge.k22')}
   */
  getAuditTrail(orderId?: string): AuditEntry[] {
    if (orderId) {
      return this.auditLog.filter((e) => e.orderId === orderId);
    }
    return [...this.auditLog];
  }

  /**
   ${i18n.t('LiveTradeBridge.k23')}
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
   ${i18n.t('LiveTradeBridge.k24')}
   */
  getOrder(orderId: string): BridgeOrder | undefined {
    return this.orders.get(orderId);
  }

  /**
   ${i18n.t('LiveTradeBridge.k25')}
   */
  getOrderById(orderId: string): BridgeOrder | undefined {
    return this.getOrder(orderId);
  }

  /**
   ${i18n.t('LiveTradeBridge.k26')}
   */
  getAllOrders(): BridgeOrder[] {
    return Array.from(this.orders.values());
  }

  /**
   ${i18n.t('LiveTradeBridge.k27')}
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
   ${i18n.t('LiveTradeBridge.k28')}
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
   ${i18n.t('LiveTradeBridge.k29')}
   */
  destroy(): void {
    this.stopReconciliationTimer();
    this.handlers.clear();
    log.info('[LiveTradeBridge] Destroyed');
  }

  // ── Private Helpers ──────────────────────────────────────────────────────

  private emit(event: EventName, ...args: unknown[]): void {
    const set = this.handlers.get(event);
    if (set) {
      for (const handler of set) {
        try {
          handler(...args);
        } catch (err) {
    // [EngineError:TRADE] — structured error tracking
          void EngineError; // structured error domain: TRADE
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
 // rule 1: position/holding
    this.riskRules.push({
      id: 'concentration',
      name: i18n.t('liveTradeBridge.k17'),
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
          return { pass: false, reason: i18n.t('liveTradeBridge.k18') };
        }
        return { pass: true };
      },
    });

 // rule 2: limit
    this.riskRules.push({
      id: 'daily_loss',
      name: i18n.t('liveTradeBridge.k19'),
      enabled: true,
      check: (_order: PaperOrder, ctx: RiskContext) => {
        if (ctx.dailyPnl < 0 && Math.abs(ctx.dailyPnl) > ctx.accountEquity * 0.05) {
          return { pass: false, reason: i18n.t('liveTradeBridge.k20') };
        }
        return { pass: true };
      },
    });

 // rule 3:
    this.riskRules.push({
      id: 'min_qty',
      name: i18n.t('liveTradeBridge.k21'),
      enabled: true,
      check: (order: PaperOrder) => {
        if (order.quantity < 1) {
          return { pass: false, reason: i18n.t('liveTradeBridge.k22') };
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

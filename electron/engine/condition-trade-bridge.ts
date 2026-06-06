// ── DAWN WHALES — Condition-Trade Bridge ────────────────────────────────────
// J-31-01: Bridges condition triggers (price/indicator/volume) to trade execution
// Supports dry-run and live-run modes with risk check integration

import log from 'electron-log';
import { EventEmitter } from 'events';

// ── Types ──────────────────────────────────────────────────────────────────

export type BridgeMode = 'dry-run' | 'live-run';

export interface TriggerResult {
  triggerId: string;
  type: 'price' | 'indicator' | 'volume';
  action: 'buy' | 'sell' | 'hold';
  code: string;
  reason: string;
  confidence: number; // 0-1
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface TradeSignal {
  strategyId: string;
  code: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  orderType: 'MARKET' | 'LIMIT';
  reason: string;
  confidence: number;
  timestamp: number;
  triggerId: string;
}

export interface BridgeStatus {
  mode: BridgeMode;
  strategyId: string;
  running: boolean;
  totalTriggers: number;
  totalOrders: number;
  rejectedOrders: number;
  lastTriggerTime: number;
  lastOrderTime: number;
  uptimeMs: number;
}

export interface BridgeConfig {
  defaultQuantity: number;
  orderType: 'MARKET' | 'LIMIT';
  cooldownMinutes: number; // prevent duplicate orders within N minutes
  maxDailyOrders: number;
  riskCheckEnabled: boolean;
}

interface InternalOrder extends TradeSignal {
  orderId?: string;
  status: 'pending' | 'filled' | 'rejected' | 'cancelled';
  rejectionReason?: string;
}

// ── Default Config ─────────────────────────────────────────────────────────

const DEFAULT_CONFIG: BridgeConfig = {
  defaultQuantity: 100,
  orderType: 'MARKET',
  cooldownMinutes: 5,
  maxDailyOrders: 20,
  riskCheckEnabled: true,
};

// ── ConditionTradeBridge Class ─────────────────────────────────────────────

export class ConditionTradeBridge extends EventEmitter {
  private config: BridgeConfig;
  private strategyId: string = '';
  private mode: BridgeMode = 'dry-run';
  private running: boolean = false;
  private startTime: number = 0;

  // Trigger and order history
  private triggerHistory: TriggerResult[] = [];
  private orderHistory: InternalOrder[] = [];

  // Cooldown tracking: Map<code, lastOrderTimestamp>
  private cooldownMap: Map<string, number> = new Map();

  // Daily order count tracking
  private dailyOrderCount: Map<string, number> = new Map(); // date -> count
  private currentOrderId: number = 0;

  // Optional engine references (injected)
  private priceEngine: any = null;
  private indicatorEngine: any = null;
  private volumeEngine: any = null;
  private tradeExecutor: any = null;
  private riskIntegrator: any = null;

  constructor(engines?: {
    priceEngine?: any;
    indicatorEngine?: any;
    volumeEngine?: any;
    tradeExecutor?: any;
    riskIntegrator?: any;
  }) {
    super();
    this.config = { ...DEFAULT_CONFIG };

    if (engines) {
      this.priceEngine = engines.priceEngine || null;
      this.indicatorEngine = engines.indicatorEngine || null;
      this.volumeEngine = engines.volumeEngine || null;
      this.tradeExecutor = engines.tradeExecutor || null;
      this.riskIntegrator = engines.riskIntegrator || null;
    }

    log.info('[ConditionTradeBridge] Initialized');
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────

  start(strategyId: string, mode: BridgeMode = 'dry-run'): void {
    if (this.running) {
      log.warn('[ConditionTradeBridge] Already running, stopping first');
      this.stop();
    }

    this.strategyId = strategyId;
    this.mode = mode;
    this.running = true;
    this.startTime = Date.now();
    this.triggerHistory = [];
    this.orderHistory = [];
    this.cooldownMap.clear();
    this.dailyOrderCount.clear();

    log.info(`[ConditionTradeBridge] Started in ${mode} mode for strategy ${strategyId}`);
    this.emit('bridge-started', { strategyId, mode });
  }

  stop(): void {
    if (!this.running) return;

    this.running = false;
    const uptimeMs = Date.now() - this.startTime;
    log.info(`[ConditionTradeBridge] Stopped after ${uptimeMs}ms, ${this.orderHistory.length} orders placed`);
    this.emit('bridge-stopped', { strategyId: this.strategyId, uptimeMs });
  }

  // ── Evaluation ───────────────────────────────────────────────────────────

  evaluate(code: string, currentPrice: number, klines?: any[]): TriggerResult[] {
    if (!this.running) {
      log.warn('[ConditionTradeBridge] Not running, cannot evaluate');
      return [];
    }

    const triggers: TriggerResult[] = [];

    // Evaluate price triggers
    if (this.priceEngine) {
      try {
        const priceTriggers = this.priceEngine.evaluate(code, currentPrice);
        if (Array.isArray(priceTriggers)) {
          for (const t of priceTriggers) {
            triggers.push({
              triggerId: t.id || `price-${Date.now()}`,
              type: 'price',
              action: t.action || 'hold',
              code,
              reason: t.reason || `Price trigger: ${t.action}`,
              confidence: t.confidence || 0.5,
              timestamp: Date.now(),
              metadata: t,
            });
          }
        }
      } catch (err: any) {
        log.error(`[ConditionTradeBridge] Price engine error: ${err.message}`);
      }
    }

    // Evaluate indicator triggers
    if (this.indicatorEngine && klines && klines.length > 0) {
      try {
        const indicatorTriggers = this.indicatorEngine.evaluate(code, klines);
        if (Array.isArray(indicatorTriggers)) {
          for (const t of indicatorTriggers) {
            triggers.push({
              triggerId: t.id || `indicator-${Date.now()}`,
              type: 'indicator',
              action: t.action || 'hold',
              code,
              reason: t.reason || `Indicator trigger: ${t.action}`,
              confidence: t.confidence || 0.5,
              timestamp: Date.now(),
              metadata: t,
            });
          }
        }
      } catch (err: any) {
        log.error(`[ConditionTradeBridge] Indicator engine error: ${err.message}`);
      }
    }

    // Evaluate volume triggers
    if (this.volumeEngine && klines && klines.length > 0) {
      try {
        const volumes = klines.map((k: any) => k.volume || 0);
        const currentVolume = volumes[volumes.length - 1] || 0;
        const historicalVolumes = volumes.slice(0, -1);
        const volumeTriggers = this.volumeEngine.evaluate(code, currentVolume, historicalVolumes);
        if (Array.isArray(volumeTriggers)) {
          for (const t of volumeTriggers) {
            triggers.push({
              triggerId: t.id || `volume-${Date.now()}`,
              type: 'volume',
              action: t.action || 'hold',
              code,
              reason: t.reason || `Volume trigger: ${t.action}`,
              confidence: t.confidence || 0.5,
              timestamp: Date.now(),
              metadata: t,
            });
          }
        }
      } catch (err: any) {
        log.error(`[ConditionTradeBridge] Volume engine error: ${err.message}`);
      }
    }

    // Store triggers in history
    for (const trigger of triggers) {
      this.triggerHistory.push(trigger);
      this.emit('condition-evaluated', trigger);

      if (trigger.action !== 'hold') {
        this.emit('trigger-fired', trigger);
      }
    }

    // Trim history if too large
    if (this.triggerHistory.length > 1000) {
      this.triggerHistory = this.triggerHistory.slice(-500);
    }

    return triggers;
  }

  // ── Trade Execution ──────────────────────────────────────────────────────

  executeTriggers(code: string, triggers: TriggerResult[]): TradeSignal[] {
    if (!this.running) {
      log.warn('[ConditionTradeBridge] Not running, cannot execute');
      return [];
    }

    const signals: TradeSignal[] = [];
    const now = Date.now();

    for (const trigger of triggers) {
      // Skip hold actions
      if (trigger.action === 'hold') continue;

      // Check cooldown
      if (this.isInCooldown(code)) {
        log.info(`[ConditionTradeBridge] Cooldown active for ${code}, skipping trigger`);
        this.emit('order-rejected', {
          trigger,
          reason: 'Cooldown active',
        });
        continue;
      }

      // Check daily order limit
      if (this.isDailyLimitReached()) {
        log.warn(`[ConditionTradeBridge] Daily order limit reached, skipping trigger`);
        this.emit('order-rejected', {
          trigger,
          reason: 'Daily order limit reached',
        });
        continue;
      }

      // Create trade signal
      const signal: TradeSignal = {
        strategyId: this.strategyId,
        code: trigger.code,
        side: trigger.action === 'buy' ? 'BUY' : 'SELL',
        quantity: this.config.defaultQuantity,
        price: trigger.metadata?.currentPrice || trigger.metadata?.price || 0,
        orderType: this.config.orderType,
        reason: trigger.reason,
        confidence: trigger.confidence,
        timestamp: now,
        triggerId: trigger.triggerId,
      };

      // Risk check if enabled
      if (this.config.riskCheckEnabled && this.riskIntegrator) {
        try {
          const riskResult = this.riskIntegrator.shouldAllowOrder(this.strategyId, signal);
          if (!riskResult.allowed) {
            log.warn(`[ConditionTradeBridge] Risk check failed: ${riskResult.reason}`);
            this.emit('order-rejected', {
              trigger,
              signal,
              reason: riskResult.reason || 'Risk check failed',
            });
            continue;
          }
        } catch (err: any) {
          log.error(`[ConditionTradeBridge] Risk check error: ${err.message}`);
          this.emit('order-rejected', {
            trigger,
            signal,
            reason: `Risk check error: ${err.message}`,
          });
          continue;
        }
      }

      // Execute trade
      if (this.mode === 'live-run' && this.tradeExecutor) {
        try {
          const orderResult = this.tradeExecutor.placeOrder(signal);
          const orderId = orderResult?.orderId || `order-${++this.currentOrderId}`;

          const internalOrder: InternalOrder = {
            ...signal,
            orderId,
            status: 'filled',
          };

          this.orderHistory.push(internalOrder);
          this.cooldownMap.set(code, now);
          this.incrementDailyOrderCount();

          log.info(`[ConditionTradeBridge] Order placed: ${signal.side} ${signal.quantity} ${signal.code} @ ${signal.price}`);
          this.emit('order-placed', internalOrder);
          signals.push(signal);
        } catch (err: any) {
          log.error(`[ConditionTradeBridge] Order execution failed: ${err.message}`);
          this.emit('order-rejected', {
            trigger,
            signal,
            reason: `Execution failed: ${err.message}`,
          });
        }
      } else if (this.mode === 'dry-run') {
        // Dry run: log but don't execute
        const dryOrder: InternalOrder = {
          ...signal,
          orderId: `dry-${++this.currentOrderId}`,
          status: 'pending',
        };

        this.orderHistory.push(dryOrder);
        this.cooldownMap.set(code, now);
        this.incrementDailyOrderCount();

        log.info(`[ConditionTradeBridge] [DRY-RUN] Would place: ${signal.side} ${signal.quantity} ${signal.code} @ ${signal.price}`);
        this.emit('order-placed', dryOrder);
        signals.push(signal);
      }
    }

    return signals;
  }

  // ── Queries ──────────────────────────────────────────────────────────────

  getRecentTriggers(limit: number = 50): TriggerResult[] {
    return this.triggerHistory.slice(-limit);
  }

  getRecentOrders(limit: number = 50): TradeSignal[] {
    return this.orderHistory.slice(-limit);
  }

  getStatus(): BridgeStatus {
    return {
      mode: this.mode,
      strategyId: this.strategyId,
      running: this.running,
      totalTriggers: this.triggerHistory.length,
      totalOrders: this.orderHistory.length,
      rejectedOrders: this.orderHistory.filter(o => o.status === 'rejected').length,
      lastTriggerTime: this.triggerHistory.length > 0 ? this.triggerHistory[this.triggerHistory.length - 1].timestamp : 0,
      lastOrderTime: this.orderHistory.length > 0 ? this.orderHistory[this.orderHistory.length - 1].timestamp : 0,
      uptimeMs: this.running ? Date.now() - this.startTime : 0,
    };
  }

  // ── Config ───────────────────────────────────────────────────────────────

  updateConfig(updates: Partial<BridgeConfig>): void {
    this.config = { ...this.config, ...updates };
    log.info('[ConditionTradeBridge] Config updated', this.config);
  }

  getConfig(): BridgeConfig {
    return { ...this.config };
  }

  // ── Private Helpers ──────────────────────────────────────────────────────

  private isInCooldown(code: string): boolean {
    const lastOrderTime = this.cooldownMap.get(code);
    if (!lastOrderTime) return false;

    const elapsed = Date.now() - lastOrderTime;
    const cooldownMs = this.config.cooldownMinutes * 60 * 1000;
    return elapsed < cooldownMs;
  }

  private isDailyLimitReached(): boolean {
    const today = new Date().toISOString().split('T')[0];
    const count = this.dailyOrderCount.get(today) || 0;
    return count >= this.config.maxDailyOrders;
  }

  private incrementDailyOrderCount(): void {
    const today = new Date().toISOString().split('T')[0];
    const count = this.dailyOrderCount.get(today) || 0;
    this.dailyOrderCount.set(today, count + 1);

    // Clean up old dates (keep only last 7 days)
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    for (const [date, _count] of this.dailyOrderCount.entries()) {
      if (new Date(date).getTime() < cutoff) {
        this.dailyOrderCount.delete(date);
      }
    }
  }
}

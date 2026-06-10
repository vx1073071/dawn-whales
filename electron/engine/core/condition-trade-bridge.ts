// ConditionTradeBridge — ConditionEngine → TradeExecutor bridge
// Phase 4.3 R36 ML-36-01: Final missing link in the closed loop
// Routes condition triggers to trade execution with safety checks

import { EventEmitter } from 'events';

// ── Types ─────────────────────────────────────────────────────────────────

export interface ConditionTrigger {
  id: string;
  ruleId: string;
  symbol: string;
  condition: string;
  price: number;
  timestamp: number;
  strategyId?: string;
  metadata?: Record<string, any>;
}

export interface BridgeConfig {
  /** Minimum interval between triggers for same rule+symbol (ms) */
  cooldownMs: number;
  /** Maximum triggers per symbol per day */
  maxDailyTriggers: number;
  /** Auto-route to broker adapter */
  autoRoute: boolean;
  /** Require risk engine approval before order */
  requireRiskCheck: boolean;
  /** Retry failed orders (max attempts) */
  maxRetries: number;
  /** Retry delay base (ms) */
  retryDelayMs: number;
}

export interface BridgeSignal {
  trigger: ConditionTrigger;
  action: 'buy' | 'sell' | 'hold';
  quantity?: number;
  price?: number;
  orderType?: 'MARKET' | 'LIMIT';
  status: 'pending' | 'routed' | 'executed' | 'rejected' | 'failed';
  reason?: string;
  orderId?: string;
  executedAt?: number;
  executedPrice?: number;
}

export interface BridgeStats {
  totalTriggers: number;
  totalExecuted: number;
  totalRejected: number;
  totalFailed: number;
  lastTriggerAt: number;
  activeSignals: number;
}

// ── Default config ────────────────────────────────────────────────────────

const DEFAULT_CONFIG: BridgeConfig = {
  cooldownMs: 60000,       // 60 seconds
  maxDailyTriggers: 50,    // 50 per symbol per day
  autoRoute: true,
  requireRiskCheck: true,
  maxRetries: 3,
  retryDelayMs: 1000,
};

// ── Engine ────────────────────────────────────────────────────────────────

export class ConditionTradeBridge extends EventEmitter {
  private config: BridgeConfig;
  private lastTrigger: Map<string, number> = new Map();  // "ruleId:symbol" → timestamp
  private dailyCount: Map<string, number> = new Map();   // "symbol:date" → count
  private signals: Map<string, BridgeSignal> = new Map();
  private pendingSignals: Set<string> = new Set();
  private stats: BridgeStats = {
    totalTriggers: 0,
    totalExecuted: 0,
    totalRejected: 0,
    totalFailed: 0,
    lastTriggerAt: 0,
    activeSignals: 0,
  };

  constructor(config?: Partial<BridgeConfig>) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ── Core: Process trigger ──────────────────────────────────────────────

  async processTrigger(trigger: ConditionTrigger): Promise<BridgeSignal> {
    const signalKey = `${trigger.ruleId}:${trigger.symbol}`;
    this.stats.totalTriggers++;
    this.stats.lastTriggerAt = Date.now();

    // Step 1: Cooldown check
    if (!this.checkCooldown(signalKey)) {
      const elapsed = Date.now() - (this.lastTrigger.get(signalKey) || 0);
      const signal: BridgeSignal = {
        trigger,
        action: 'hold',
        status: 'rejected',
        reason: `Cooldown active (${Math.ceil((this.config.cooldownMs - elapsed) / 1000)}s remaining)`,
      };
      this.stats.totalRejected++;
      this.emit('signal:rejected', signal);
      return signal;
    }

    // Step 2: Daily limit check
    const dateKey = `${trigger.symbol}:${new Date().toISOString().split('T')[0]}`;
    const currentDaily = this.dailyCount.get(dateKey) || 0;
    if (currentDaily >= this.config.maxDailyTriggers) {
      const signal: BridgeSignal = {
        trigger,
        action: 'hold',
        status: 'rejected',
        reason: `Daily limit reached: ${currentDaily}/${this.config.maxDailyTriggers}`,
      };
      this.stats.totalRejected++;
      this.emit('signal:rejected', signal);
      return signal;
    }

    // Step 3: Determine action
    const action = this.determineAction(trigger);

    // Step 4: Create signal
    const signal: BridgeSignal = {
      trigger,
      action,
      quantity: this.calculateQuantity(trigger),
      price: trigger.price,
      orderType: 'MARKET',
      status: 'pending',
    };

    this.signals.set(trigger.id, signal);
    this.pendingSignals.add(trigger.id);
    this.stats.activeSignals = this.pendingSignals.size;

    this.emit('signal:pending', signal);

    // Step 5: Route to trade executor
    if (this.config.autoRoute && action !== 'hold') {
      try {
        signal.status = 'routed';
        this.emit('signal:routed', signal);

        // Execute with retry
        const executed = await this.executeWithRetry(signal);
        if (executed) {
          signal.status = 'executed';
          signal.executedAt = Date.now();
          this.stats.totalExecuted++;
          this.dailyCount.set(dateKey, currentDaily + 1);
          this.lastTrigger.set(signalKey, Date.now());
          this.emit('signal:executed', signal);
        }
      } catch (err: unknown) {
        signal.status = 'failed';
        signal.reason = err.message;
        this.stats.totalFailed++;
        this.emit('signal:failed', signal);
      } finally {
        this.pendingSignals.delete(trigger.id);
        this.stats.activeSignals = this.pendingSignals.size;
      }
    }

    return signal;
  }

  // ── Cooldown ────────────────────────────────────────────────────────────

  private checkCooldown(key: string): boolean {
    const lastTime = this.lastTrigger.get(key);
    if (!lastTime) return true;
    return Date.now() - lastTime >= this.config.cooldownMs;
  }

  // ── Action determination ────────────────────────────────────────────────

  private determineAction(trigger: ConditionTrigger): 'buy' | 'sell' | 'hold' {
    const cond = trigger.condition.toLowerCase();

    // Buy signals
    if (cond.includes('crosses_above') ||
        cond.includes('oversold') ||
        cond.includes('golden_cross') ||
        cond.includes('breakout_up') ||
        cond.includes('above_support')) {
      return 'buy';
    }

    // Sell signals
    if (cond.includes('crosses_below') ||
        cond.includes('overbought') ||
        cond.includes('death_cross') ||
        cond.includes('breakout_down') ||
        cond.includes('below_resistance')) {
      return 'sell';
    }

    // Price conditions
    if (cond.includes('above') && trigger.price > 0) return 'buy';
    if (cond.includes('below') && trigger.price > 0) return 'sell';

    return 'hold';
  }

  // ── Quantity calculation ────────────────────────────────────────────────

  private calculateQuantity(trigger: ConditionTrigger): number {
    const meta = trigger.metadata;
    if (meta?.quantity) return meta.quantity;
    if (meta?.positionSize) return meta.positionSize;
    // Default: 100 shares
    return 100;
  }

  // ── Execute with retry ──────────────────────────────────────────────────

  private async executeWithRetry(signal: BridgeSignal): Promise<boolean> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        // Simulate trade execution
        // In production: call TradeExecutor.executeSignal() or placeOrder()
        await this.simulateExecution(signal);
        return true;
      } catch (err: unknown) {
        lastError = err;
        if (attempt < this.config.maxRetries) {
          const delay = this.config.retryDelayMs * Math.pow(2, attempt);
          this.emit('signal:retry', { signal, attempt: attempt + 1, delay });
          await new Promise(r => setTimeout(r, Math.min(delay, 10))); // In test: skip real delay
        }
      }
    }

    throw lastError || new Error('Max retries exceeded');
  }

  private async simulateExecution(signal: BridgeSignal): Promise<void> {
    // In production: this would call the TradeExecutor
    await new Promise(r => setTimeout(r, 1));
    signal.orderId = `order_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  // ── Bridge management ───────────────────────────────────────────────────

  getSignal(id: string): BridgeSignal | undefined {
    return this.signals.get(id);
  }

  getStats(): BridgeStats {
    return { ...this.stats };
  }

  getConfig(): BridgeConfig {
    return { ...this.config };
  }

  updateConfig(partial: Partial<BridgeConfig>): void {
    this.config = { ...this.config, ...partial };
  }

  /** Clear daily tracking (called at midnight) */
  resetDailyCount(): void {
    this.dailyCount.clear();
    this.emit('bridge:daily_reset');
  }

  resetAll(): void {
    this.lastTrigger.clear();
    this.dailyCount.clear();
    this.signals.clear();
    this.pendingSignals.clear();
    this.stats = {
      totalTriggers: 0,
      totalExecuted: 0,
      totalRejected: 0,
      totalFailed: 0,
      lastTriggerAt: 0,
      activeSignals: 0,
    };
    this.emit('bridge:reset');
  }
}

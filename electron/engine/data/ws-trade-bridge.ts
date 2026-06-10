/**
 * ws-trade-bridge.ts
 * 
 * Bridges WebSocket Market Data ticks to the Trade Executor
 * for automatic signal generation based on configurable rules.
 */

import log from 'electron-log';
import type { WsMarketDataEngine, TickData } from './ws-market-data';
import type { TradeExecutor, TradeSignal } from '../analysis/trade-executor';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

// ─── Interfaces ───────────────────────────────────────────────

export interface TickRule {
  code: string;
  side: 'BUY' | 'SELL';
  condition: 'price_above' | 'price_below' | 'volume_spike' | 'change_pct_above';
  threshold: number;
  strategyId: string;
  strategyName: string;
  enabled: boolean;
}

export interface BridgeConfig {
  enabled: boolean;
  rules: TickRule[];
  defaultQuantity: number;
  defaultOrderType: 'MARKET' | 'LIMIT';
  cooldownMs: number; // min time between signals for same rule
}

interface SignalRecord {
  id: string;
  ruleId: string;
  code: string;
  side: 'BUY' | 'SELL';
  price: number;
  quantity: number;
  strategyId: string;
  strategyName: string;
  condition: string;
  threshold: number;
  triggeredAt: Date;
}

interface RuleState {
  rule: TickRule;
  ruleId: string;
  lastSignalTime: number;
}

// ─── Constants ────────────────────────────────────────────────

const MAX_SIGNAL_HISTORY = 100;
const DEFAULT_COOLDOWN_MS = 5000;
const DEFAULT_QUANTITY = 100;

// ─── WsTradeBridge Class ─────────────────────────────────────

export class WsTradeBridge extends EventEmitter {
  private wsEngine: WsMarketDataEngine;
  private tradeExecutor: TradeExecutor;
  private config: BridgeConfig;
  private ruleStates: Map<string, RuleState> = new Map();
  private signalHistory: SignalRecord[] = [];
  private running = false;
  private tickHandler: ((tick: TickData) => void) | null = null;

  constructor(wsEngine: WsMarketDataEngine, tradeExecutor: TradeExecutor) {
    super();
    this.wsEngine = wsEngine;
    this.tradeExecutor = tradeExecutor;

    this.config = {
      enabled: false,
      rules: [],
      defaultQuantity: DEFAULT_QUANTITY,
      defaultOrderType: 'MARKET',
      cooldownMs: DEFAULT_COOLDOWN_MS,
    };

    log.info('[WsTradeBridge] Initialized');
  }

  // ─── Lifecycle ────────────────────────────────────────────

  /**
   * Start the bridge: subscribe to WS tick events and begin evaluating rules.
   */
  start(): void {
    if (this.running) {
      log.warn('[WsTradeBridge] Already running, ignoring start()');
      return;
    }

    this.running = true;
    this.config.enabled = true;

    // Initialize rule states for any rules that don't have one yet
    for (const rule of this.config.rules) {
      const ruleId = this.getRuleId(rule);
      if (!this.ruleStates.has(ruleId)) {
        this.ruleStates.set(ruleId, {
          rule,
          ruleId,
          lastSignalTime: 0,
        });
      }
    }

    // Bind the tick handler
    this.tickHandler = this.onTick.bind(this);
    this.wsEngine.on('tick', this.tickHandler);

    log.info(
      `[WsTradeBridge] Started — monitoring ${this.config.rules.filter((r) => r.enabled).length} enabled rules`
    );
  }

  /**
   * Stop the bridge: unsubscribe from tick events.
   */
  stop(): void {
    if (!this.running) {
      log.warn('[WsTradeBridge] Not running, ignoring stop()');
      return;
    }

    this.running = false;
    this.config.enabled = false;

    if (this.tickHandler) {
      this.wsEngine.off('tick', this.tickHandler);
      this.tickHandler = null;
    }

    log.info('[WsTradeBridge] Stopped');
  }

  // ─── Rule Management ──────────────────────────────────────

  /**
   * Add a new tick rule. Returns the generated rule ID.
   */
  addRule(rule: TickRule): string {
    const ruleId = uuidv4();

    this.config.rules.push({ ...rule });

    this.ruleStates.set(ruleId, {
      rule: { ...rule },
      ruleId,
      lastSignalTime: 0,
    });

    log.info(
      `[WsTradeBridge] Rule added: ${ruleId} — ${rule.code} ${rule.side} ${rule.condition} ${rule.threshold} (${rule.strategyName})`
    );

    return ruleId;
  }

  /**
   * Remove a rule by its ID. Returns true if found and removed.
   */
  removeRule(ruleId: string): boolean {
    const state = this.ruleStates.get(ruleId);
    if (!state) {
      log.warn(`[WsTradeBridge] removeRule: ruleId ${ruleId} not found`);
      return false;
    }

    // Remove from config rules array (match by index correlation)
    const idx = this.config.rules.findIndex(
      (r) => this.getRuleId(r) === ruleId || this.matchRuleToState(r, state)
    );
    if (idx !== -1) {
      this.config.rules.splice(idx, 1);
    }

    this.ruleStates.delete(ruleId);

    log.info(`[WsTradeBridge] Rule removed: ${ruleId}`);
    return true;
  }

  /**
   * Get all current rules.
   */
  getRules(): TickRule[] {
    return this.config.rules.map((r) => ({ ...r }));
  }

  // ─── Config ───────────────────────────────────────────────

  /**
   * Get the current bridge configuration (deep copy).
   */
  getConfig(): BridgeConfig {
    return {
      ...this.config,
      rules: this.config.rules.map((r) => ({ ...r })),
    };
  }

  /**
   * Update bridge configuration with partial overrides.
   */
  updateConfig(updates: Partial<BridgeConfig>): void {
    if (updates.rules !== undefined) {
      // Rebuild rule states for new rules
      this.config.rules = updates.rules.map((r) => ({ ...r }));
      this.rebuildRuleStates();
    }

    if (updates.defaultQuantity !== undefined) {
      this.config.defaultQuantity = updates.defaultQuantity;
    }

    if (updates.defaultOrderType !== undefined) {
      this.config.defaultOrderType = updates.defaultOrderType;
    }

    if (updates.cooldownMs !== undefined) {
      this.config.cooldownMs = updates.cooldownMs;
    }

    if (updates.enabled !== undefined) {
      this.config.enabled = updates.enabled;
      if (updates.enabled && !this.running) {
        this.start();
      } else if (!updates.enabled && this.running) {
        this.stop();
      }
    }

    log.info('[WsTradeBridge] Config updated', {
      enabled: this.config.enabled,
      ruleCount: this.config.rules.length,
      cooldownMs: this.config.cooldownMs,
    });
  }

  // ─── Signal History ───────────────────────────────────────

  /**
   * Get recent signal history, optionally limited.
   */
  getSignalHistory(limit?: number): SignalRecord[] {
    const max = limit && limit > 0 ? Math.min(limit, MAX_SIGNAL_HISTORY) : MAX_SIGNAL_HISTORY;
    return this.signalHistory.slice(-max).map((s) => ({ ...s }));
  }

  // ─── Events ───────────────────────────────────────────────

  /**
   * Register a callback for when a signal is generated.
   */
  onSignalGenerated(callback: (signal: SignalRecord) => void): () => void {
    this.on('signal-generated', callback);
    return () => {
      this.off('signal-generated', callback);
    };
  }

  // ─── Core Tick Processing ─────────────────────────────────

  /**
   * Handle an incoming tick from the WS market data engine.
   */
  private onTick(tick: TickData): void {
    if (!this.config.enabled || !this.running) {
      return;
    }

    const now = Date.now();

    // Evaluate all enabled rules that match this tick's code
    for (const [ruleId, state] of this.ruleStates.entries()) {
      const { rule } = state;

      if (!rule.enabled) continue;
      if (rule.code !== tick.code) continue;

      // Check cooldown
      const elapsed = now - state.lastSignalTime;
      if (elapsed < this.config.cooldownMs) {
        continue;
      }

      // Evaluate condition
      if (this.evaluateCondition(rule, tick)) {
        this.generateSignal(ruleId, state, tick, now);
      }
    }
  }

  /**
   * Evaluate whether a rule's condition is met by the current tick.
   */
  private evaluateCondition(rule: TickRule, tick: TickData): boolean {
    switch (rule.condition) {
      case 'price_above':
        return tick.price >= rule.threshold;

      case 'price_below':
        return tick.price <= rule.threshold;

      case 'volume_spike':
        return tick.volume >= rule.threshold;

      case 'change_pct_above':
        return Math.abs(tick.changePct) >= rule.threshold;

      default:
        log.warn(`[WsTradeBridge] Unknown condition type: ${rule.condition}`);
        return false;
    }
  }

  /**
   * Generate a trade signal and forward it to the trade executor.
   */
  private generateSignal(
    ruleId: string,
    state: RuleState,
    tick: TickData,
    timestamp: number
  ): void {
    const signalRecord: SignalRecord = {
      id: uuidv4(),
      ruleId,
      code: tick.code,
      side: state.rule.side,
      price: tick.price,
      quantity: this.config.defaultQuantity,
      strategyId: state.rule.strategyId,
      strategyName: state.rule.strategyName,
      condition: state.rule.condition,
      threshold: state.rule.threshold,
      triggeredAt: new Date(timestamp),
    };

    // Build the TradeSignal for the executor
    const tradeSignal: TradeSignal = {
      id: signalRecord.id,
      code: signalRecord.code,
      side: signalRecord.side,
      price: signalRecord.price,
      quantity: signalRecord.quantity,
      orderType: this.config.defaultOrderType,
      strategyId: signalRecord.strategyId,
      strategyName: signalRecord.strategyName,
      reason: `${signalRecord.condition} ${signalRecord.threshold} triggered at ${signalRecord.price}`,
      timestamp: signalRecord.triggeredAt,
    };

    // Update cooldown
    state.lastSignalTime = timestamp;

    // Store in history (cap at MAX_SIGNAL_HISTORY)
    this.signalHistory.push(signalRecord);
    if (this.signalHistory.length > MAX_SIGNAL_HISTORY) {
      this.signalHistory = this.signalHistory.slice(-MAX_SIGNAL_HISTORY);
    }

    // Forward to trade executor
    try {
      this.tradeExecutor.processSignal(tradeSignal);
      log.info(
        `[WsTradeBridge] Signal generated: ${signalRecord.side} ${signalRecord.code} @ ${signalRecord.price} (${signalRecord.strategyName})`
      );
    } catch (err) {
      log.error(`[WsTradeBridge] Failed to process signal via trade executor:`, err);
    }

    // Emit event
    this.emit('signal-generated', signalRecord);
  }

  // ─── Helpers ──────────────────────────────────────────────

  /**
   * Generate a deterministic rule ID from rule content.
   */
  private getRuleId(rule: TickRule): string {
    return `${rule.code}:${rule.side}:${rule.condition}:${rule.threshold}:${rule.strategyId}`;
  }

  /**
   * Match a config rule to a rule state by content equality.
   */
  private matchRuleToState(rule: TickRule, state: RuleState): boolean {
    return (
      rule.code === state.rule.code &&
      rule.side === state.rule.side &&
      rule.condition === state.rule.condition &&
      rule.threshold === state.rule.threshold &&
      rule.strategyId === state.rule.strategyId
    );
  }

  /**
   * Rebuild ruleStates map from the current config.rules array.
   * Preserves existing cooldown timestamps where possible.
   */
  private rebuildRuleStates(): void {
    const newStates = new Map<string, RuleState>();

    for (const rule of this.config.rules) {
      const ruleId = this.getRuleId(rule);
      const existing = this.ruleStates.get(ruleId);

      newStates.set(ruleId, {
        rule: { ...rule },
        ruleId,
        lastSignalTime: existing ? existing.lastSignalTime : 0,
      });
    }

    this.ruleStates = newStates;
  }
}

export default WsTradeBridge;

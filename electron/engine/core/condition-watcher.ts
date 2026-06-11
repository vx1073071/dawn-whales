// ── ConditionWatcher — WebSocket → condition → strategy/policy ────────────
// Phase 4.2: condition
// ML-30-02 [P0]
// : QClaw ConditionEngine (condition-engine.ts)
// : StrategyRunner + CronScheduler + WebSocket feed

import log from 'electron-log';
import type { StrategyRunnerInterface } from './cron-scheduler';
import { EngineError } from './engine-error';


// ── Types ──────────────────────────────────────────────────────────────────

export interface QuoteSnapshot {
  symbol: string;
  price: number;
  bid: number;
  ask: number;
  volume: number;
  timestamp: number;
  source: string; // broker id
}

export type ConditionOperator = '>' | '<' | '>=' | '<=' | '==' | 'crosses_above' | 'crosses_below';

export interface PriceCondition {
  id: string;
  type: 'price';
  symbol: string;
  operator: ConditionOperator;
  value: number;
  description?: string;
}

export interface IndicatorCondition {
  id: string;
  type: 'indicator';
  symbol: string;
  indicator: 'RSI' | 'MACD' | 'MA' | 'VOLUME';
  operator: ConditionOperator;
  value: number;
  params?: { period?: number; compare?: string };
  description?: string;
}

export interface CompositeCondition {
  id: string;
  type: 'composite';
  logic: 'AND' | 'OR';
  conditions: (PriceCondition | IndicatorCondition | CompositeCondition)[];
  description?: string;
}

export type Condition = PriceCondition | IndicatorCondition | CompositeCondition;

export interface ConditionRule {
  id: string;
  name: string;
  condition: Condition;
  action: ConditionAction;
  enabled: boolean;
  cooldownMs?: number;
  maxDailyTriggers?: number;
  dailyTriggerCount: number;
  lastTriggered?: number;
}

export interface ConditionAction {
  type: 'execute_strategy' | 'pause_strategy' | 'send_alert' | 'compound';
  strategyId?: string;
  brokerId?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params?: Record<string, any>;
  actions?: ConditionAction[]; // for compound
}

export interface WatchResult {
  ruleId: string;
  triggered: boolean;
  matchedAt: number;
  details: string;
}

// ── ConditionWatcher ───────────────────────────────────────────────────────

export class ConditionWatcher {
  private rules = new Map<string, ConditionRule>();
  private strategyRunner?: StrategyRunnerInterface;
  private quoteHistory = new Map<string, { price: number; timestamp: number }[]>();
  private cleanupInterval?: NodeJS.Timeout;

  setStrategyRunner(runner: StrategyRunnerInterface): void {
    this.strategyRunner = runner;
  }

  /** Register a condition rule */
  addRule(rule: Omit<ConditionRule, 'dailyTriggerCount'>): ConditionRule {
    const full: ConditionRule = { ...rule, dailyTriggerCount: 0 };
    this.rules.set(rule.id, full);
    log.info(`[ConditionWatcher] Rule added: ${rule.name} (${rule.id})`);
    return full;
  }

  /** Remove a condition rule */
  removeRule(ruleId: string): boolean {
    return this.rules.delete(ruleId);
  }

  /** Enable/disable a rule */
  setEnabled(ruleId: string, enabled: boolean): boolean {
    const rule = this.rules.get(ruleId);
    if (!rule) return false;
    rule.enabled = enabled;
    return true;
  }

  /** List all rules */
  listRules(): ConditionRule[] {
    return Array.from(this.rules.values());
  }

  /** Get a single rule */
  getRule(ruleId: string): ConditionRule | undefined {
    return this.rules.get(ruleId);
  }

  /** Reset daily trigger counts (call at midnight) */
  resetDailyCounts(): void {
    for (const rule of this.rules.values()) {
      rule.dailyTriggerCount = 0;
    }
  }

  /**
   * Main entry point: process incoming quote and check all conditions.
   * Called by the WebSocket quote push handler.
   */
  async processQuote(quote: QuoteSnapshot): Promise<WatchResult[]> {
    // Update quote history (keep last 50 snapshots per symbol)
    if (!this.quoteHistory.has(quote.symbol)) {
      this.quoteHistory.set(quote.symbol, []);
    }
    const history = this.quoteHistory.get(quote.symbol)!;
    history.push({ price: quote.price, timestamp: quote.timestamp });
    if (history.length > 50) history.shift();

    const results: WatchResult[] = [];
    const triggeredActions: ConditionAction[] = [];

    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;
      if (rule.maxDailyTriggers && rule.dailyTriggerCount >= rule.maxDailyTriggers) continue;
      if (rule.cooldownMs && rule.lastTriggered) {
        if (Date.now() - rule.lastTriggered < rule.cooldownMs) continue;
      }

      const result = this.evaluateCondition(rule.condition, quote, history);
      if (result.triggered) {
        rule.dailyTriggerCount++;
        rule.lastTriggered = Date.now();
        results.push({ ruleId: rule.id, triggered: true, matchedAt: Date.now(), details: result.details });
        triggeredActions.push(rule.action);
      }
    }

    // Execute triggered actions
    for (const action of triggeredActions) {
      await this.executeAction(action);
    }

    return results;
  }

  /** Evaluate a single condition against quote data */
  private evaluateCondition(
    condition: Condition,
    quote: QuoteSnapshot,
    history: { price: number; timestamp: number }[]
  ): { triggered: boolean; details: string } {
    switch (condition.type) {
      case 'price':
        return this.evaluatePriceCondition(condition, quote, history);
      case 'indicator':
        return this.evaluateIndicatorCondition(condition, quote, history);
      case 'composite':
        return this.evaluateCompositeCondition(condition, quote, history);
      default:
        return { triggered: false, details: 'Unknown condition type' };
    }
  }

  private evaluatePriceCondition(
    c: PriceCondition,
    quote: QuoteSnapshot,
    history: { price: number; timestamp: number }[]
  ): { triggered: boolean; details: string } {
    if (c.symbol !== '*' && c.symbol !== quote.symbol) {
      return { triggered: false, details: `Symbol mismatch: ${c.symbol} vs ${quote.symbol}` };
    }

    const price = quote.price;
    let comparison = false;

    switch (c.operator) {
      case '>':
        comparison = price > c.value;
        break;
      case '<':
        comparison = price < c.value;
        break;
      case '>=':
        comparison = price >= c.value;
        break;
      case '<=':
        comparison = price <= c.value;
        break;
      case '==':
        comparison = Math.abs(price - c.value) < 0.01;
        break;
      case 'crosses_above':
        // Check if price just crossed above from below
        if (history.length < 2) return { triggered: false, details: 'Not enough history' };
        const prevCA = history[history.length - 2].price;
        comparison = prevCA <= c.value && price > c.value;
        break;
      case 'crosses_below':
        // Check if price just crossed below from above
        if (history.length < 2) return { triggered: false, details: 'Not enough history' };
        const prevCB = history[history.length - 2].price;
        comparison = prevCB >= c.value && price < c.value;
        break;
      default:
        return { triggered: false, details: `Unknown operator: ${c.operator}` };
    }

    return {
      triggered: comparison,
      details: `${quote.symbol} price ${price} ${c.operator} ${c.value} = ${comparison}`,
    };
  }

  private evaluateIndicatorCondition(
    c: IndicatorCondition,
    quote: QuoteSnapshot,
    history: { price: number; timestamp: number }[]
  ): { triggered: boolean; details: string } {
    if (c.symbol !== '*' && c.symbol !== quote.symbol) {
      return { triggered: false, details: `Symbol mismatch` };
    }

    // Simplified indicator calculation from price history
    const prices = history.map(h => h.price);
    let value = 0;

    switch (c.indicator) {
      case 'RSI': {
        const period = c.params?.period || 14;
        if (prices.length < period + 1) return { triggered: false, details: 'Not enough data for RSI' };
        const recent = prices.slice(-period - 1);
        let gains = 0, losses = 0;
        for (let i = 1; i < recent.length; i++) {
          const diff = recent[i] - recent[i - 1];
          if (diff > 0) gains += diff; else losses -= diff;
        }
        const avgGain = gains / period;
        const avgLoss = losses / period;
        if (avgLoss === 0) value = 100;
        else value = 100 - 100 / (1 + avgGain / avgLoss);
        break;
      }
      case 'MA': {
        const period = c.params?.period || 20;
        if (prices.length < period) return { triggered: false, details: 'Not enough data for MA' };
        value = prices.slice(-period).reduce((a, b) => a + b, 0) / period;
        break;
      }
      case 'VOLUME':
        value = quote.volume;
        break;
      default:
        return { triggered: false, details: `Unsupported indicator: ${c.indicator}` };
    }

    let comparison = false;
    switch (c.operator) {
      case '>': comparison = quote.price > value; break;
      case '<': comparison = quote.price < value; break;
      case '>=': comparison = quote.price >= value; break;
      case '<=': comparison = quote.price <= value; break;
      case 'crosses_above': {
        if (history.length < 2) return { triggered: false, details: 'Not enough history' };
        comparison = history[history.length - 2].price <= value && quote.price > value;
        break;
      }
      default: return { triggered: false, details: 'Unsupported operator for indicator' };
    }

    return {
      triggered: comparison,
      details: `${c.indicator}(${value.toFixed(2)}) ${c.operator} ${quote.price} ${c.operator} = ${comparison}`,
    };
  }

  private evaluateCompositeCondition(
    c: CompositeCondition,
    quote: QuoteSnapshot,
    history: { price: number; timestamp: number }[]
  ): { triggered: boolean; details: string } {
    const results = c.conditions.map(sub => this.evaluateCondition(sub, quote, history));
    const details = results.map(r => r.details).join('; ');

    if (c.logic === 'AND') {
      return { triggered: results.every(r => r.triggered), details: `AND: ${details}` };
    } else {
      return { triggered: results.some(r => r.triggered), details: `OR: ${details}` };
    }
  }

  /** Execute an action (strategy run, pause, alert) */
  private async executeAction(action: ConditionAction): Promise<void> {
    if (action.type === 'compound' && action.actions) {
      for (const sub of action.actions) {
        await this.executeAction(sub);
      }
      return;
    }

    if (action.type === 'execute_strategy' && action.strategyId) {
      try {
        if (this.strategyRunner) {
          await this.strategyRunner.run({
            strategyId: action.strategyId,
            dryRun: action.params?.dryRun !== false,
            brokerId: action.brokerId,
          });
          log.info(`[ConditionWatcher] Triggered strategy: ${action.strategyId}`);
        }
      } catch (err: unknown) {
        log.error(`[ConditionWatcher] Strategy execution failed: ${err.message}`);
      }
    } else if (action.type === 'pause_strategy' && action.strategyId) {
      log.info(`[ConditionWatcher] Would pause strategy: ${action.strategyId}`);
      // Hook into StrategyEngine to pause
    } else if (action.type === 'send_alert') {
      log.info(`[ConditionWatcher] Alert: ${action.params?.message || 'Condition triggered'}`);
    }
  }

  /** Start periodic cleanup */
  startCleanup(intervalMs = 60000): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      // Clean old quote history
      for (const [symbol, history] of this.quoteHistory) {
        const cutoff = now - 5 * 60 * 1000; // 5 minutes
        const filtered = history.filter(h => h.timestamp >= cutoff);
        if (filtered.length < history.length) {
          this.quoteHistory.set(symbol, filtered);
        }
      }
    }, intervalMs);
  }

  /** Stop cleanup and destroy */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.rules.clear();
    this.quoteHistory.clear();
  }
}

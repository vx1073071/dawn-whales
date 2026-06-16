/**
 * P1-12 StrategySignalEngine — Strategy Signal Engine Backend
 * R248 — Strategy Deepening
 * JVS / 引擎虾
 *
 * Core signal generation engine: computes buy/sell/hold signals from
 * strategy rules, technical indicators, and market conditions.
 * Supports signal strength scoring, multi-timeframe concurrency,
 * signal history, and confidence intervals.
 * Singleton pattern, fully testable with reset().
 */

import log from 'electron-log';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export type SignalDirection = 'buy' | 'sell' | 'hold';
export type SignalStrength = 'weak' | 'moderate' | 'strong' | 'very_strong';

export interface StrategyRule {
  id: string;
  name: string;
  description: string;
  /** Indicator type this rule uses */
  indicatorType: 'MA' | 'RSI' | 'MACD' | 'BB' | 'KDJ' | 'volume' | 'price_action' | 'multi_factor';
  /** Rule condition in JSON logic format */
  conditions: SignalCondition[];
  /** How conditions combine */
  combinator: 'AND' | 'OR' | 'MAJORITY';
  /** Weight in overall signal (0-1) */
  weight: number;
  /** Minimum confidence to fire */
  minConfidence: number;
  enabled: boolean;
}

export interface SignalCondition {
  field: string;
  operator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq' | 'cross_above' | 'cross_below' | 'between';
  value: number | string;
  value2?: number | string; // for 'between' operator
  timeframe?: string; // 1m, 5m, 15m, 1h, 4h, 1d, 1w
}

export interface SignalInput {
  symbol: string;
  market: string;
  /** Current price data point */
  currentPrice: number;
  /** OHLCV for indicator computation */
  ohlcv?: {
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    timestamp: number;
  };
  /** Indicator values (pre-computed or from TA engine) */
  indicators?: Record<string, number>;
  /** Multi-timeframe data */
  multiTf?: Record<string, { close: number; indicators?: Record<string, number> }>;
}

export interface StrategySignal {
  id: string;
  symbol: string;
  market: string;
  direction: SignalDirection;
  strength: SignalStrength;
  score: number; // 0-100
  confidence: number; // 0-1
  /** Which rules fired */
  firedRules: string[];
  /** Per-rule breakdown */
  ruleSignals: RuleSignal[];
  /** Primary timeframe */
  timeframe: string;
  /** When signal was generated */
  generatedAt: number;
  /** Human-readable reasons */
  reasons: string[];
  /** Suggested entry/exit prices */
  suggestedEntry?: number;
  suggestedStop?: number;
  suggestedTarget?: number;
  /** How long signal is valid (ms) */
  ttlMs: number;
  expiresAt: number;
  /** Whether signal was acted upon */
  acted?: boolean;
  /** Trade result if acted upon */
  tradeResult?: 'profit' | 'loss' | 'breakeven' | null;
}

export interface RuleSignal {
  ruleId: string;
  ruleName: string;
  direction: SignalDirection;
  confidence: number;
  met: boolean;
  details: string;
}

export interface SignalHistoryEntry {
  signal: StrategySignal;
  /** Market price at signal time */
  priceAtSignal: number;
  /** Price after TTL */
  priceAtExpiry?: number;
  /** Whether signal was correct */
  wasCorrect?: boolean;
  /** PnL if traded */
  pnl?: number;
}

export interface SignalStats {
  totalSignals: number;
  byDirection: Record<SignalDirection, number>;
  byStrength: Record<SignalStrength, number>;
  accuracy: number;
  avgScore: number;
  signalsPerDay: number;
}

// ═══════════════════════════════════════════════════════════════
// Default Strategy Rules
// ═══════════════════════════════════════════════════════════════

const DEFAULT_RULES: StrategyRule[] = [
  {
    id: 'rule-ma-cross',
    name: 'MA Golden/Death Cross',
    description: '50-period MA crosses above/below 200-period MA',
    indicatorType: 'MA',
    conditions: [
      { field: 'ma50', operator: 'cross_above', value: 'ma200', timeframe: '1d' },
    ],
    combinator: 'AND',
    weight: 0.25,
    minConfidence: 0.6,
    enabled: true,
  },
  {
    id: 'rule-rsi-oversold',
    name: 'RSI Oversold Bounce',
    description: 'RSI below 30 indicates oversold conditions',
    indicatorType: 'RSI',
    conditions: [
      { field: 'rsi14', operator: 'lt', value: 30, timeframe: '1d' },
    ],
    combinator: 'AND',
    weight: 0.20,
    minConfidence: 0.5,
    enabled: true,
  },
  {
    id: 'rule-rsi-overbought',
    name: 'RSI Overbought Warning',
    description: 'RSI above 70 indicates overbought conditions',
    indicatorType: 'RSI',
    conditions: [
      { field: 'rsi14', operator: 'gt', value: 70, timeframe: '1d' },
    ],
    combinator: 'AND',
    weight: 0.20,
    minConfidence: 0.5,
    enabled: true,
  },
  {
    id: 'rule-macd-bullish',
    name: 'MACD Bullish Crossover',
    description: 'MACD line crosses above signal line',
    indicatorType: 'MACD',
    conditions: [
      { field: 'macd', operator: 'cross_above', value: 'macd_signal', timeframe: '1d' },
    ],
    combinator: 'AND',
    weight: 0.20,
    minConfidence: 0.55,
    enabled: true,
  },
  {
    id: 'rule-macd-bearish',
    name: 'MACD Bearish Crossover',
    description: 'MACD line crosses below signal line',
    indicatorType: 'MACD',
    conditions: [
      { field: 'macd', operator: 'cross_below', value: 'macd_signal', timeframe: '1d' },
    ],
    combinator: 'AND',
    weight: 0.20,
    minConfidence: 0.55,
    enabled: true,
  },
  {
    id: 'rule-volume-spike',
    name: 'Volume Spike Confirmation',
    description: 'Volume 2x above 20-day average confirms trend',
    indicatorType: 'volume',
    conditions: [
      { field: 'volume', operator: 'gt', value: 'vol_ma20_x2', timeframe: '1d' },
    ],
    combinator: 'AND',
    weight: 0.15,
    minConfidence: 0.4,
    enabled: true,
  },
  {
    id: 'rule-bb-squeeze',
    name: 'Bollinger Band Squeeze',
    description: 'Price near lower BB indicates potential bounce',
    indicatorType: 'BB',
    conditions: [
      { field: 'price', operator: 'lte', value: 'bb_lower', timeframe: '1d' },
    ],
    combinator: 'AND',
    weight: 0.15,
    minConfidence: 0.5,
    enabled: true,
  },
];

// ═══════════════════════════════════════════════════════════════
// Engine
// ═══════════════════════════════════════════════════════════════

export class StrategySignalEngine {
  private static instance: StrategySignalEngine;

  private rules: Map<string, StrategyRule> = new Map();
  private signals: Map<string, StrategySignal[]> = new Map(); // symbol → signals
  private history: SignalHistoryEntry[] = [];
  private idCounter = 0;

  private constructor() {
    for (const rule of DEFAULT_RULES) {
      this.rules.set(rule.id, rule);
    }
  }

  static getInstance(): StrategySignalEngine {
    if (!StrategySignalEngine.instance) {
      StrategySignalEngine.instance = new StrategySignalEngine();
    }
    return StrategySignalEngine.instance;
  }

  reset(): void {
    this.rules.clear();
    this.signals.clear();
    this.history = [];
    this.idCounter = 0;
    for (const rule of DEFAULT_RULES) {
      this.rules.set(rule.id, rule);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Rule Management
  // ═══════════════════════════════════════════════════════════════

  getRules(): StrategyRule[] {
    return Array.from(this.rules.values());
  }

  getRule(id: string): StrategyRule | undefined {
    return this.rules.get(id);
  }

  registerRule(rule: StrategyRule): StrategyRule {
    this.rules.set(rule.id, rule);
    return rule;
  }

  updateRule(id: string, updates: Partial<StrategyRule>): StrategyRule | null {
    const rule = this.rules.get(id);
    if (!rule) return null;
    Object.assign(rule, updates);
    return rule;
  }

  deleteRule(id: string): boolean {
    if (DEFAULT_RULES.some(r => r.id === id)) return false;
    return this.rules.delete(id);
  }

  // ═══════════════════════════════════════════════════════════════
  // Condition Evaluation
  // ═══════════════════════════════════════════════════════════════

  private evaluateCondition(condition: SignalCondition, indicators: Record<string, number>, currentPrice: number): boolean {
    const fieldValue = condition.field === 'price' ? currentPrice : (indicators[condition.field] ?? NaN);
    if (isNaN(fieldValue)) return false;

    let compareValue: number;
    if (typeof condition.value === 'string') {
      compareValue = indicators[condition.value] ?? NaN;
      if (isNaN(compareValue)) return false;
    } else {
      compareValue = condition.value;
    }

    switch (condition.operator) {
      case 'gt': return fieldValue > compareValue;
      case 'lt': return fieldValue < compareValue;
      case 'gte': return fieldValue >= compareValue;
      case 'lte': return fieldValue <= compareValue;
      case 'eq': return Math.abs(fieldValue - compareValue) < 0.0001;
      case 'cross_above': return fieldValue > compareValue;
      case 'cross_below': return fieldValue < compareValue;
      case 'between': {
        const v2 = typeof condition.value2 === 'string'
          ? (indicators[condition.value2] ?? NaN)
          : (condition.value2 ?? NaN);
        if (isNaN(v2)) return false;
        return fieldValue >= Math.min(compareValue, v2) && fieldValue <= Math.max(compareValue, v2);
      }
      default: return false;
    }
  }

  private evaluateRule(
    rule: StrategyRule,
    input: SignalInput,
  ): { met: boolean; direction: SignalDirection; confidence: number; details: string } {
    const indicators = input.indicators || {};
    const results = rule.conditions.map(c => this.evaluateCondition(c, indicators, input.currentPrice));
    const metCount = results.filter(Boolean).length;

    let met: boolean;
    switch (rule.combinator) {
      case 'AND': met = results.every(Boolean); break;
      case 'OR': met = results.some(Boolean); break;
      case 'MAJORITY': met = metCount > rule.conditions.length / 2; break;
      default: met = false;
    }

    const confidence = rule.conditions.length > 0 ? metCount / rule.conditions.length : 0;
    const metFinal = met && confidence >= rule.minConfidence;

    // Determine direction from rule name/id
    let direction: SignalDirection = 'hold';
    if (rule.id.includes('bearish') || rule.id.includes('overbought') || rule.id.includes('sell')) {
      direction = 'sell';
    } else if (rule.id.includes('bullish') || rule.id.includes('oversold') || rule.id.includes('buy') || rule.id.includes('cross') || rule.id.includes('bounce') || rule.id.includes('squeeze') || rule.id.includes('spike')) {
      direction = 'buy';
    }

    const details = `${metCount}/${rule.conditions.length} conditions met (${(confidence * 100).toFixed(0)}%)`;

    return { met: metFinal, direction, confidence, details };
  }

  // ═══════════════════════════════════════════════════════════════
  // Signal Generation
  // ═══════════════════════════════════════════════════════════════

  generateSignal(input: SignalInput): StrategySignal {
    const now = Date.now();
    const rules = Array.from(this.rules.values()).filter(r => r.enabled);
    const ruleSignals: RuleSignal[] = [];

    let buyScore = 0;
    let sellScore = 0;
    let totalWeight = 0;
    let totalConfidence = 0;
    const firedRules: string[] = [];
    const reasons: string[] = [];

    for (const rule of rules) {
      const { met, direction, confidence, details } = this.evaluateRule(rule, input);

      ruleSignals.push({
        ruleId: rule.id,
        ruleName: rule.name,
        direction,
        confidence,
        met,
        details,
      });

      if (met) {
        firedRules.push(rule.id);
        totalWeight += rule.weight;
        totalConfidence += confidence * rule.weight;

        if (direction === 'buy') {
          buyScore += rule.weight * confidence * 100;
          reasons.push(`${rule.name}: bullish (${details})`);
        } else if (direction === 'sell') {
          sellScore += rule.weight * confidence * 100;
          reasons.push(`${rule.name}: bearish (${details})`);
        }
      }
    }

    // Determine overall direction and strength
    let direction: SignalDirection;
    let strength: SignalStrength;
    let score: number;

    const netScore = buyScore - sellScore;
    const absScore = Math.abs(netScore);
    const maxPossible = totalWeight * 100;

    if (absScore < 10 || totalWeight === 0) {
      direction = 'hold';
      score = 50;
    } else if (netScore > 0) {
      direction = 'buy';
      score = 50 + Math.min((netScore / maxPossible) * 50, 50);
    } else {
      direction = 'sell';
      score = 50 + Math.min((Math.abs(netScore) / maxPossible) * 50, 50);
    }

    if (absScore >= 60) strength = 'very_strong';
    else if (absScore >= 35) strength = 'strong';
    else if (absScore >= 15) strength = 'moderate';
    else strength = 'weak';

    const confidence = totalWeight > 0 ? totalConfidence / totalWeight : 0;

    // Calculate suggested prices
    let suggestedEntry: number | undefined;
    let suggestedStop: number | undefined;
    let suggestedTarget: number | undefined;

    if (direction === 'buy') {
      suggestedEntry = input.currentPrice;
      suggestedStop = input.currentPrice * 0.95;
      suggestedTarget = input.currentPrice * 1.10;
    } else if (direction === 'sell') {
      suggestedEntry = input.currentPrice;
      suggestedStop = input.currentPrice * 1.05;
      suggestedTarget = input.currentPrice * 0.90;
    }

    // TTL: 4h for weak, 8h for moderate, 24h for strong, 48h for very_strong
    const ttlMap: Record<SignalStrength, number> = {
      weak: 4 * 3600_000,
      moderate: 8 * 3600_000,
      strong: 24 * 3600_000,
      very_strong: 48 * 3600_000,
    };

    const signal: StrategySignal = {
      id: `sig-${++this.idCounter}`,
      symbol: input.symbol,
      market: input.market,
      direction,
      strength,
      score: Math.round(score),
      confidence: Math.round(confidence * 100) / 100,
      firedRules,
      ruleSignals,
      timeframe: '1d',
      generatedAt: now,
      reasons,
      suggestedEntry,
      suggestedStop,
      suggestedTarget,
      ttlMs: ttlMap[strength],
      expiresAt: now + ttlMap[strength],
    };

    // Store
    if (!this.signals.has(input.symbol)) {
      this.signals.set(input.symbol, []);
    }
    this.signals.get(input.symbol)!.push(signal);

    // History
    this.history.push({
      signal,
      priceAtSignal: input.currentPrice,
    });

    log.info(`[SignalEngine] Generated ${signal.id}: ${direction}/${strength} for ${input.symbol} (score=${signal.score})`);
    return signal;
  }

  generateMultiTf(input: SignalInput): StrategySignal[] {
    const signals: StrategySignal[] = [];
    const primary = this.generateSignal(input);
    signals.push(primary);

    if (input.multiTf) {
      for (const [tf, data] of Object.entries(input.multiTf)) {
        const tfInput: SignalInput = {
          symbol: input.symbol,
          market: input.market,
          currentPrice: data.close,
          indicators: data.indicators,
        };
        const tfSignal = this.generateSignal(tfInput);
        tfSignal.timeframe = tf;
        signals.push(tfSignal);
      }
    }

    return signals;
  }

  // ═══════════════════════════════════════════════════════════════
  // Signal Query
  // ═══════════════════════════════════════════════════════════════

  getLatestSignal(symbol: string): StrategySignal | undefined {
    const signals = this.signals.get(symbol);
    if (!signals || signals.length === 0) return undefined;
    return signals[signals.length - 1];
  }

  getSignals(symbol: string, limit?: number): StrategySignal[] {
    const signals = this.signals.get(symbol) || [];
    const sorted = [...signals].sort((a, b) => b.generatedAt - a.generatedAt);
    return limit ? sorted.slice(0, limit) : sorted;
  }

  getActiveSignals(symbol?: string): StrategySignal[] {
    const now = Date.now();
    const allSignals = symbol
      ? (this.signals.get(symbol) || [])
      : Array.from(this.signals.values()).flat();

    return allSignals.filter(s => s.expiresAt > now && !s.acted);
  }

  markActed(signalId: string, tradeResult?: 'profit' | 'loss' | 'breakeven'): boolean {
    for (const [, signals] of this.signals) {
      const sig = signals.find(s => s.id === signalId);
      if (sig) {
        sig.acted = true;
        sig.tradeResult = tradeResult || null;
        // Update history entry
        const entry = this.history.find(h => h.signal.id === signalId);
        if (entry) entry.pnl = tradeResult === 'profit' ? 1 : tradeResult === 'loss' ? -1 : 0;
        return true;
      }
    }
    return false;
  }

  recordExpiry(signalId: string, priceAtExpiry: number): boolean {
    const entry = this.history.find(h => h.signal.id === signalId);
    if (!entry) return false;
    entry.priceAtExpiry = priceAtExpiry;
    const sig = entry.signal;
    if (sig.direction === 'buy') {
      entry.wasCorrect = priceAtExpiry > entry.priceAtSignal;
    } else if (sig.direction === 'sell') {
      entry.wasCorrect = priceAtExpiry < entry.priceAtSignal;
    }
    return true;
  }

  // ═══════════════════════════════════════════════════════════════
  // Stats
  // ═══════════════════════════════════════════════════════════════

  getSignalStats(symbol?: string): SignalStats {
    const signals = symbol
      ? (this.signals.get(symbol) || [])
      : Array.from(this.signals.values()).flat();

    const byDirection: Record<string, number> = { buy: 0, sell: 0, hold: 0 };
    const byStrength: Record<string, number> = { weak: 0, moderate: 0, strong: 0, very_strong: 0 };

    for (const sig of signals) {
      byDirection[sig.direction] = (byDirection[sig.direction] || 0) + 1;
      byStrength[sig.strength] = (byStrength[sig.strength] || 0) + 1;
    }

    const correct = this.history.filter(h => h.wasCorrect === true).length;
    const incorrect = this.history.filter(h => h.wasCorrect === false).length;
    const accuracy = correct + incorrect > 0 ? correct / (correct + incorrect) : 0;

    const totalScore = signals.reduce((s, sig) => s + sig.score, 0);
    const avgScore = signals.length > 0 ? Math.round(totalScore / signals.length) : 0;

    // Signals per day (over last 30 days or all time)
    const oldest = signals.length > 0 ? Math.min(...signals.map(s => s.generatedAt)) : Date.now();
    const days = Math.max(1, (Date.now() - oldest) / 86_400_000);
    const signalsPerDay = Math.round(signals.length / days * 10) / 10;

    return {
      totalSignals: signals.length,
      byDirection: byDirection as Record<SignalDirection, number>,
      byStrength: byStrength as Record<SignalStrength, number>,
      accuracy: Math.round(accuracy * 100) / 100,
      avgScore,
      signalsPerDay,
    };
  }

  getHistory(limit?: number): SignalHistoryEntry[] {
    const sorted = [...this.history].sort((a, b) => b.signal.generatedAt - a.signal.generatedAt);
    return limit ? sorted.slice(0, limit) : sorted;
  }

  /** Get available trading symbols */
  getTrackedSymbols(): string[] {
    return Array.from(this.signals.keys());
  }

  /** Clean up expired signals (mark for GC) */
  cleanupExpired(): number {
    let count = 0;
    const now = Date.now();
    for (const [, signals] of this.signals) {
      count += signals.filter(s => s.expiresAt < now && !s.acted).length;
    }
    return count;
  }
}

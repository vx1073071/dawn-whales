// JVS-118: Strategy Signal Aggregator
// Aggregate multiple strategy signals into composite signals with weighted scoring

import { EventEmitter } from 'events';
import log from 'electron-log';

export interface StrategySignal {
  strategy: string;
  symbol: string;
  direction: 'BUY' | 'SELL' | 'HOLD';
  strength: number; // 0-100
  timestamp: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: Record<string, any>;
}

export interface CompositeSignal {
  symbol: string;
  direction: 'BUY' | 'SELL' | 'HOLD';
  strength: number;
  confidence: number; // 0-100
  contributingStrategies: number;
  timestamp: number;
  breakdown: {
    strategy: string;
    direction: string;
    strength: number;
    weight: number;
  }[];
}

export interface AggregatorConfig {
  strategyWeights: Record<string, number>; // strategy -> weight (0-1)
  minStrategies: number; // Minimum strategies required for composite
  signalTtlMs: number; // How long to keep signals
  enableConfidence: boolean;
}

export class StrategySignalAggregator extends EventEmitter {
  private config: Required<AggregatorConfig>;
  private signals: Map<string, Map<string, StrategySignal>> = new Map(); // symbol -> (strategy -> signal)
  private history: Map<string, CompositeSignal[]> = new Map(); // symbol -> composite history

  constructor(config?: Partial<AggregatorConfig>) {
    super();
    this.config = {
      strategyWeights: config?.strategyWeights ?? {},
      minStrategies: config?.minStrategies ?? 1,
      signalTtlMs: config?.signalTtlMs ?? 300_000,
      enableConfidence: config?.enableConfidence ?? true,
    };
    log.info(`[SignalAggregator] Initialized (minStrategies=${this.config.minStrategies})`);
  }

  /**
   * Add a strategy signal
   */
  addSignal(signal: StrategySignal): void {
    if (!this.signals.has(signal.symbol)) {
      this.signals.set(signal.symbol, new Map());
    }

    const symbolSignals = this.signals.get(signal.symbol)!;
    symbolSignals.set(signal.strategy, signal);

    this.emit('signalAdded', signal);

    // Auto-aggregate if enough strategies
    if (symbolSignals.size >= this.config.minStrategies) {
      const composite = this.aggregate(signal.symbol);
      if (composite) {
        this.emit('composite', composite);
      }
    }
  }

  /**
   * Aggregate signals for a symbol into composite
   */
  aggregate(symbol: string): CompositeSignal | null {
    const symbolSignals = this.signals.get(symbol);
    if (!symbolSignals || symbolSignals.size < this.config.minStrategies) {
      return null;
    }

    // Clean old signals
    const now = Date.now();
    for (const [strategy, signal] of symbolSignals) {
      if (now - signal.timestamp > this.config.signalTtlMs) {
        symbolSignals.delete(strategy);
      }
    }

    if (symbolSignals.size < this.config.minStrategies) {
      return null;
    }

    const allSignals = Array.from(symbolSignals.values());
    const breakdown: CompositeSignal['breakdown'] = [];

    let buyScore = 0;
    let sellScore = 0;
    let totalWeight = 0;

    for (const signal of allSignals) {
      const weight = this.config.strategyWeights[signal.strategy] ?? 1.0;
      const weightedStrength = signal.strength * weight;

      breakdown.push({
        strategy: signal.strategy,
        direction: signal.direction,
        strength: signal.strength,
        weight,
      });

      if (signal.direction === 'BUY') {
        buyScore += weightedStrength;
      } else if (signal.direction === 'SELL') {
        sellScore += weightedStrength;
      }

      totalWeight += weight;
    }

    // Determine composite direction
    let direction: 'BUY' | 'SELL' | 'HOLD';
    let strength: number;

    if (buyScore > sellScore) {
      direction = 'BUY';
      strength = buyScore / totalWeight;
    } else if (sellScore > buyScore) {
      direction = 'SELL';
      strength = sellScore / totalWeight;
    } else {
      direction = 'HOLD';
      strength = (buyScore + sellScore) / (2 * totalWeight);
    }

    // Calculate confidence
    let confidence = 0;
    if (this.config.enableConfidence) {
      // Confidence based on agreement and number of strategies
      const directionCounts = { BUY: 0, SELL: 0, HOLD: 0 };
      for (const signal of allSignals) {
        directionCounts[signal.direction]++;
      }

      const maxCount = Math.max(directionCounts.BUY, directionCounts.SELL, directionCounts.HOLD);
      const agreement = maxCount / allSignals.length;
      const countFactor = Math.min(allSignals.length / 5, 1); // More strategies = more confidence

      confidence = agreement * countFactor * 100;
    }

    const composite: CompositeSignal = {
      symbol,
      direction,
      strength,
      confidence,
      contributingStrategies: allSignals.length,
      timestamp: now,
      breakdown,
    };

    // Store in history
    if (!this.history.has(symbol)) {
      this.history.set(symbol, []);
    }
    const hist = this.history.get(symbol)!;
    hist.push(composite);
    if (hist.length > 100) hist.shift();

    return composite;
  }

  /**
   * Get latest composite signal for symbol
   */
  getLatestComposite(symbol: string): CompositeSignal | null {
    const hist = this.history.get(symbol);
    return hist && hist.length > 0 ? hist[hist.length - 1] : null;
  }

  /**
   * Get composite history for symbol
   */
  getCompositeHistory(symbol: string, limit?: number): CompositeSignal[] {
    const hist = this.history.get(symbol);
    if (!hist) return [];
    return limit ? hist.slice(-limit) : hist;
  }

  /**
   * Get all current signals for symbol
   */
  getSignals(symbol: string): StrategySignal[] {
    const symbolSignals = this.signals.get(symbol);
    return symbolSignals ? Array.from(symbolSignals.values()) : [];
  }

  /**
   * Get all tracked symbols
   */
  getSymbols(): string[] {
    return Array.from(this.signals.keys());
  }

  /**
   * Set strategy weight
   */
  setWeight(strategy: string, weight: number): void {
    this.config.strategyWeights[strategy] = weight;
    log.info(`[SignalAggregator] Set weight for ${strategy}: ${weight}`);
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalSymbols: number;
    totalSignals: number;
    totalComposites: number;
    avgStrategiesPerSymbol: number;
  } {
    let totalSignals = 0;
    for (const symbolSignals of this.signals.values()) {
      totalSignals += symbolSignals.size;
    }

    let totalComposites = 0;
    for (const hist of this.history.values()) {
      totalComposites += hist.length;
    }

    return {
      totalSymbols: this.signals.size,
      totalSignals,
      totalComposites,
      avgStrategiesPerSymbol: this.signals.size > 0 ? totalSignals / this.signals.size : 0,
    };
  }

  /**
   * Clear signals for symbol
   */
  clearSymbol(symbol: string): void {
    this.signals.delete(symbol);
    this.history.delete(symbol);
  }

  /**
   * Clear all
   */
  clearAll(): void {
    this.signals.clear();
    this.history.clear();
  }

  /**
   * Destroy
   */
  destroy(): void {
    this.clearAll();
    this.removeAllListeners();
  }
}

// Singleton
let aggregatorInstance: StrategySignalAggregator | null = null;

export function getStrategySignalAggregator(
  config?: Partial<AggregatorConfig>
): StrategySignalAggregator {
  if (!aggregatorInstance) {
    aggregatorInstance = new StrategySignalAggregator(config);
  }
  return aggregatorInstance;
}

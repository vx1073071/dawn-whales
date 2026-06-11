// JVS-114: strategy/policy
// strategy/policyWebSocketsubscribe

import log from 'electron-log';
import { EventEmitter } from 'events';

export interface StrategySignal {
  strategyId: string;
  strategyName: string;
  symbol: string;
  signal: 'BUY' | 'SELL' | 'HOLD';
  strength: number;          // 0-100
  timestamp: number;
  price: number;
  confidence: number;        // 0-100
  metadata?: Record<string, any>;
}

export interface SignalSubscription {
  clientId: string;
  symbols: string[];
  strategies: string[];
  minStrength?: number;
}

export interface SignalAlert {
  type: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell';
  signal: StrategySignal;
  timestamp: number;
}

export class StrategySignalPusher extends EventEmitter {
  private subscriptions: Map<string, SignalSubscription> = new Map();
  private signalHistory: Map<string, StrategySignal[]> = new Map(); // symbol -> signals
  private maxHistorySize = 1000;
  private alertThresholds = {
    strong_buy: 80,
    buy: 60,
    hold: 40,
    sell: 60,
    strong_sell: 80,
  };

  constructor() {
    super();
  }

  // Subscribe to signals
  subscribe(clientId: string, subscription: SignalSubscription): void {
    this.subscriptions.set(clientId, subscription);
    log.info(`[SignalPusher] Client ${clientId} subscribed to ${subscription.symbols.length} symbols`);
  }

  unsubscribe(clientId: string): void {
    this.subscriptions.delete(clientId);
    log.info(`[SignalPusher] Client ${clientId} unsubscribed`);
  }

  // Process and push signal
  async processSignal(signal: StrategySignal): Promise<void> {
    // Validate signal
    if (!this.validateSignal(signal)) {
      log.warn('[SignalPusher] Invalid signal:', signal);
      return;
    }

    // Add to history
    if (!this.signalHistory.has(signal.symbol)) {
      this.signalHistory.set(signal.symbol, []);
    }
    const history = this.signalHistory.get(signal.symbol)!;
    history.push(signal);
    if (history.length > this.maxHistorySize) {
      history.shift();
    }

    // Find subscribed clients
    const subscribedClients = this.getSubscribedClients(signal.symbol);

    // Push to each subscribed client
    for (const clientId of subscribedClients) {
      const subscription = this.subscriptions.get(clientId);
      if (subscription) {
        // Check strength filter
        if (subscription.minStrength && signal.strength < subscription.minStrength) {
          continue;
        }

        // Push signal
        this.emit('signal', clientId, signal);
      }
    }

    // Check for alerts
    const alert = this.checkAlert(signal);
    if (alert) {
      this.emit('alert', alert);
    }
  }

  // Batch process signals
  async processBatch(signals: StrategySignal[]): Promise<void> {
    for (const signal of signals) {
      await this.processSignal(signal);
    }
  }

  private validateSignal(signal: StrategySignal): boolean {
    if (!signal.strategyId || !signal.symbol) return false;
    if (!['BUY', 'SELL', 'HOLD'].includes(signal.signal)) return false;
    if (signal.strength < 0 || signal.strength > 100) return false;
    if (signal.confidence < 0 || signal.confidence > 100) return false;
    if (!signal.timestamp || signal.timestamp <= 0) return false;
    return true;
  }

  private getSubscribedClients(symbol: string): string[] {
    const clients: string[] = [];
    for (const [clientId, subscription] of this.subscriptions) {
      if (subscription.symbols.includes(symbol)) {
        clients.push(clientId);
      }
    }
    return clients;
  }

  private checkAlert(signal: StrategySignal): SignalAlert | null {
    const threshold = this.alertThresholds[signal.signal.toLowerCase() as keyof typeof this.alertThresholds];
    if (!threshold) return null;

    if (signal.strength >= threshold) {
      return {
        type: signal.signal.toLowerCase() as SignalAlert['type'],
        signal,
        timestamp: Date.now(),
      };
    }

    return null;
  }

  // Get signal history for a symbol
  getSignalHistory(symbol: string, limit?: number): StrategySignal[] {
    const history = this.signalHistory.get(symbol) || [];
    return limit ? history.slice(-limit) : history;
  }

  // Get latest signal for a symbol
  getLatestSignal(symbol: string): StrategySignal | null {
    const history = this.signalHistory.get(symbol);
    return history && history.length > 0 ? history[history.length - 1] : null;
  }

  // Get stats
  getStats(): {
    totalSignals: number;
    symbols: number;
    subscriptions: number;
  } {
    let totalSignals = 0;
    for (const history of this.signalHistory.values()) {
      totalSignals += history.length;
    }

    return {
      totalSignals,
      symbols: this.signalHistory.size,
      subscriptions: this.subscriptions.size,
    };
  }

  // Clear history
  clearHistory(symbol?: string): void {
    if (symbol) {
      this.signalHistory.delete(symbol);
    } else {
      this.signalHistory.clear();
    }
  }

  // Update alert thresholds
  updateThresholds(thresholds: Partial<typeof this.alertThresholds>): void {
    this.alertThresholds = { ...this.alertThresholds, ...thresholds };
  }
}

// Singleton
let pusherInstance: StrategySignalPusher | null = null;

export function getStrategySignalPusher(): StrategySignalPusher {
  if (!pusherInstance) {
    pusherInstance = new StrategySignalPusher();
  }
  return pusherInstance;
}

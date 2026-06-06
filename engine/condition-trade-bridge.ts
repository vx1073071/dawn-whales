/**
 * ConditionTradeBridge - Bridges ConditionEngine signals to TradeExecutor
 * 
 * Responsibility:
 * 1. Listen to ConditionEngine triggers
 * 2. Apply signal deduplication (prevent duplicate orders)
 * 3. Enforce cooldown periods between signals
 * 4. Route orders to appropriate broker via TradeExecutor
 * 5. Handle error cases and retries
 */

import { EventEmitter } from 'events';
import { ConditionEngine, ConditionTriggeredEvent } from './condition-engine';
import { TradeExecutor, TradingSignal, TradeConfig } from './trade-executor';
import { RiskEngine } from './risk-engine';

export interface BridgeConfig {
  enabled: boolean;
  cooldownMs: number;          // Minimum time between signals for same symbol
  maxDailySignals: number;     // Maximum signals per day
  enableDeduplication: boolean; // Prevent duplicate signals
  deduplicationWindowMs: number; // Time window for deduplication
  defaultBroker: string;        // Default broker to route orders to
  riskCheckEnabled: boolean;    // Whether to perform risk checks before execution
}

export interface SignalRecord {
  signalId: string;
  symbol: string;
  timestamp: number;
  executed: boolean;
  orderId?: string;
}

export class ConditionTradeBridge extends EventEmitter {
  private conditionEngine: ConditionEngine;
  private tradeExecutor: TradeExecutor;
  private riskEngine?: RiskEngine;
  private config: BridgeConfig;
  
  private signalHistory: Map<string, SignalRecord[]> = new Map();
  private recentSignals: Map<string, number> = new Map(); // symbol -> last signal timestamp
  private dailySignalCount: number = 0;
  private dailyResetTime: number = 0;

  constructor(
    conditionEngine: ConditionEngine,
    tradeExecutor: TradeExecutor,
    config: Partial<BridgeConfig> = {},
    riskEngine?: RiskEngine
  ) {
    super();
    
    this.conditionEngine = conditionEngine;
    this.tradeExecutor = tradeExecutor;
    this.riskEngine = riskEngine;
    
    this.config = {
      enabled: true,
      cooldownMs: 60000, // 1 minute default
      maxDailySignals: 100,
      enableDeduplication: true,
      deduplicationWindowMs: 300000, // 5 minutes
      defaultBroker: 'default',
      riskCheckEnabled: true,
      ...config
    };

    this.dailyResetTime = this.getStartOfDay();
    this.setupListeners();
  }

  private setupListeners(): void {
    // Listen for condition triggers
    this.conditionEngine.on('conditionTriggered', (event: ConditionTriggeredEvent) => {
      this.handleConditionTrigger(event).catch(err => {
        this.emit('error', {
          message: 'Failed to handle condition trigger',
          error: err,
          event
        });
      });
    });

    // Listen for order execution results
    this.tradeExecutor.on('orderFilled', (result) => {
      this.emit('orderExecuted', {
        signalId: result.signalId,
        orderId: result.id,
        symbol: result.code,
        side: result.side,
        quantity: result.filledQty,
        price: result.filledPrice
      });
    });

    this.tradeExecutor.on('orderFailed', (result) => {
      this.emit('orderFailed', {
        signalId: result.signalId,
        error: result.error,
        willRetry: result.retry !== undefined
      });
    });
  }

  private async handleConditionTrigger(event: ConditionTriggeredEvent): Promise<void> {
    if (!this.config.enabled) {
      this.emit('signalSkipped', {
        reason: 'bridge_disabled',
        event
      });
      return;
    }

    // Check daily signal limit
    if (!this.checkDailyLimit()) {
      this.emit('signalSkipped', {
        reason: 'daily_limit_reached',
        event,
        dailyCount: this.dailySignalCount
      });
      return;
    }

    // Check cooldown
    if (!this.checkCooldown(event.symbol)) {
      this.emit('signalSkipped', {
        reason: 'cooldown_active',
        event,
        lastSignalTime: this.recentSignals.get(event.symbol)
      });
      return;
    }

    // Check deduplication
    if (this.config.enableDeduplication && this.isDuplicateSignal(event)) {
      this.emit('signalSkipped', {
        reason: 'duplicate_signal',
        event
      });
      return;
    }

    // Perform risk check if enabled
    if (this.config.riskCheckEnabled && this.riskEngine) {
      const riskCheck = await this.riskEngine.checkSignal(event);
      if (!riskCheck.passed) {
        this.emit('signalRejected', {
          reason: 'risk_check_failed',
          details: riskCheck,
          event
        });
        return;
      }
    }

    // Convert condition trigger to trading signal
    const signal = this.convertToTradingSignal(event);
    
    // Execute the signal
    try {
      const result = await this.tradeExecutor.executeSignal(signal);
      
      // Record the signal
      this.recordSignal(event.symbol, signal.id, result.id);
      
      // Update cooldown
      this.recentSignals.set(event.symbol, Date.now());
      
      // Update daily count
      this.dailySignalCount++;
      
      this.emit('signalProcessed', {
        signal,
        result,
        event
      });
    } catch (error) {
      this.emit('executionFailed', {
        signal,
        error,
        event
      });
    }
  }

  private convertToTradingSignal(event: ConditionTriggeredEvent): TradingSignal {
    // Extract trading intent from condition trigger
    const { symbol, condition, metadata } = event;
    
    // Default to BUY side, can be enhanced with NLP or user preferences
    const side = this.determineSide(condition, metadata);
    
    // Calculate quantity based on position sizing rules
    const quantity = this.calculateQuantity(symbol, side, metadata);
    
    const signal: TradingSignal = {
      id: `sig_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      strategyId: `condition_${condition.id}`,
      strategyName: condition.name || 'Condition Signal',
      symbol,
      side,
      orderType: 'MARKET',
      quantity,
      confidence: metadata?.confidence || 0.7,
      timestamp: Date.now(),
      metadata: {
        conditionId: condition.id,
        conditionName: condition.name,
        triggerValue: metadata?.value,
        ...metadata
      }
    };

    return signal;
  }

  private determineSide(condition: any, metadata?: any): 'BUY' | 'SELL' {
    // Simple logic: if condition suggests oversold (RSI < 30), BUY
    // If overbought (RSI > 70), SELL
    // Can be enhanced with more sophisticated logic
    
    if (metadata?.suggestedSide) {
      return metadata.suggestedSide;
    }
    
    // Default to BUY for now
    return 'BUY';
  }

  private calculateQuantity(symbol: string, side: 'BUY' | 'SELL', metadata?: any): number {
    // Basic position sizing - can be enhanced
    // Default: 100 shares or 1 lot
    return metadata?.quantity || 100;
  }

  private checkDailyLimit(): boolean {
    this.checkDailyReset();
    return this.dailySignalCount < this.config.maxDailySignals;
  }

  private checkCooldown(symbol: string): boolean {
    const lastSignalTime = this.recentSignals.get(symbol);
    if (!lastSignalTime) return true;
    
    return (Date.now() - lastSignalTime) >= this.config.cooldownMs;
  }

  private isDuplicateSignal(event: ConditionTriggeredEvent): boolean {
    const symbolHistory = this.signalHistory.get(event.symbol) || [];
    const windowStart = Date.now() - this.config.deduplicationWindowMs;
    
    return symbolHistory.some(record => {
      return record.timestamp >= windowStart && 
             record.executed &&
             this.isSimilarSignal(record, event);
    });
  }

  private isSimilarSignal(record: SignalRecord, event: ConditionTriggeredEvent): boolean {
    // Simple similarity check - can be enhanced
    return record.symbol === event.symbol;
  }

  private recordSignal(symbol: string, signalId: string, orderId: string): void {
    const history = this.signalHistory.get(symbol) || [];
    history.push({
      signalId,
      symbol,
      timestamp: Date.now(),
      executed: true,
      orderId
    });
    
    // Keep only recent history (last 100 signals per symbol)
    if (history.length > 100) {
      history.splice(0, history.length - 100);
    }
    
    this.signalHistory.set(symbol, history);
  }

  private getStartOfDay(): number {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now.getTime();
  }

  private checkDailyReset(): void {
    const now = Date.now();
    if (now >= this.dailyResetTime + 24 * 60 * 60 * 1000) {
      this.dailySignalCount = 0;
      this.dailyResetTime = this.getStartOfDay();
    }
  }

  // Public API

  public updateConfig(newConfig: Partial<BridgeConfig>): void {
    this.config = {
      ...this.config,
      ...newConfig
    };
    this.emit('configUpdated', this.config);
  }

  public getConfig(): BridgeConfig {
    return { ...this.config };
  }

  public getSignalHistory(symbol?: string): SignalRecord[] {
    if (symbol) {
      return this.signalHistory.get(symbol) || [];
    }
    
    // Return all history
    const allHistory: SignalRecord[] = [];
    for (const records of this.signalHistory.values()) {
      allHistory.push(...records);
    }
    return allHistory.sort((a, b) => a.timestamp - b.timestamp);
  }

  public getStats(): {
    totalSignals: number;
    executedSignals: number;
    skippedSignals: number;
    failedSignals: number;
    dailyCount: number;
    cooldownActive: string[];
  } {
    const allHistory = this.getSignalHistory();
    const executed = allHistory.filter(r => r.executed).length;
    
    return {
      totalSignals: allHistory.length,
      executedSignals: executed,
      skippedSignals: 0, // Would need to track separately
      failedSignals: 0,    // Would need to track separately
      dailyCount: this.dailySignalCount,
      cooldownActive: Array.from(this.recentSignals.entries())
        .filter(([_, ts]) => (Date.now() - ts) < this.config.cooldownMs)
        .map(([symbol]) => symbol)
    };
  }

  public reset(): void {
    this.signalHistory.clear();
    this.recentSignals.clear();
    this.dailySignalCount = 0;
    this.dailyResetTime = this.getStartOfDay();
    this.emit('reset');
  }

  public destroy(): void {
    this.removeAllListeners();
    // Note: We don't destroy the conditionEngine or tradeExecutor as they may be shared
  }
}

// Export a factory function for easy instantiation
export function createConditionTradeBridge(
  conditionEngine: ConditionEngine,
  tradeExecutor: TradeExecutor,
  config?: Partial<BridgeConfig>,
  riskEngine?: RiskEngine
): ConditionTradeBridge {
  return new ConditionTradeBridge(conditionEngine, tradeExecutor, config, riskEngine);
}

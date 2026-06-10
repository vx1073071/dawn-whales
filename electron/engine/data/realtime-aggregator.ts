// JVS-115: 实时数据聚合器
// 统一聚合多个数据源的实时数据，提供统一API接口

import { EventEmitter } from 'events';
import log from 'electron-log';
import { getWebSocketManager } from '../../websocket/websocket-manager';
import { getKLineProcessor } from './kline-processor';
import { getStrategySignalPusher } from '../../strategy/signal-pusher';

export interface AggregatedData {
  symbol: string;
  timestamp: number;
  quote?: {
    price: number;
    changePct: number;
    volume: number;
    turnover?: number;
  };
  klines?: {
    '1m'?: any[];
    '5m'?: any[];
    '1h'?: any[];
    '1d'?: any[];
  };
  signals?: any[];
  metadata?: Record<string, any>;
}

export interface AggregatorConfig {
  symbols: string[];
  timeframes: string[];
  enableSignals?: boolean;
  updateInterval?: number; // ms
}

export class RealtimeAggregator extends EventEmitter {
  private config: AggregatorConfig;
  private wsManager = getWebSocketManager();
  private klineProcessor = getKLineProcessor();
  private signalPusher = getStrategySignalPusher();
  
  private aggregatedData: Map<string, AggregatedData> = new Map();
  private updateTimer: NodeJS.Timeout | null = null;
  private subscriptions: Map<string, Set<string>> = new Map(); // clientId -> symbols

  constructor() {
    super();
    this.config = {
      symbols: [],
      timeframes: ['1m', '5m', '1h'],
      enableSignals: true,
      updateInterval: 1000, // 1 second
    };

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Listen to WebSocket messages
    this.wsManager.on('quote:update', (clientId: string, data: unknown) => {
      this.handleQuoteUpdate(clientId, data);
    });

    this.wsManager.on('signal:update', (clientId: string, data: unknown) => {
      this.handleSignalUpdate(clientId, data);
    });
  }

  private handleQuoteUpdate(clientId: string, data: unknown): void {
    const symbol = data.symbol;
    
    if (!this.aggregatedData.has(symbol)) {
      this.aggregatedData.set(symbol, {
        symbol,
        timestamp: Date.now(),
      });
    }

    const aggData = this.aggregatedData.get(symbol)!;
    aggData.quote = {
      price: data.price,
      changePct: data.changePct,
      volume: data.volume,
      turnover: data.turnover,
    };
    aggData.timestamp = Date.now();

    // Process K-lines
    if (data.klines) {
      if (!aggData.klines) {
        aggData.klines = {};
      }
      
      for (const [timeframe, klines] of Object.entries(data.klines)) {
        if (Array.isArray(klines)) {
          aggData.klines[timeframe] = klines;
          
          // Process with K-line processor
          this.klineProcessor.processKLines(timeframe, klines);
        }
      }
    }

    // Emit aggregated update
    this.emit('update', symbol, aggData);
  }

  private handleSignalUpdate(clientId: string, data: unknown): void {
    const symbol = data.symbol;
    
    if (!this.aggregatedData.has(symbol)) {
      this.aggregatedData.set(symbol, {
        symbol,
        timestamp: Date.now(),
      });
    }

    const aggData = this.aggregatedData.get(symbol)!;
    
    if (!aggData.signals) {
      aggData.signals = [];
    }
    
    aggData.signals.push({
      ...data,
      timestamp: Date.now(),
    });

    // Keep only last 10 signals
    if (aggData.signals.length > 10) {
      aggData.signals.shift();
    }

    aggData.timestamp = Date.now();
    this.emit('update', symbol, aggData);
  }

  // Subscribe client to symbols
  subscribeClient(clientId: string, symbols: string[]): void {
    if (!this.subscriptions.has(clientId)) {
      this.subscriptions.set(clientId, new Set());
    }

    const clientSubs = this.subscriptions.get(clientId)!;
    for (const symbol of symbols) {
      clientSubs.add(symbol);
    }

    log.info(`[RealtimeAggregator] Client ${clientId} subscribed to ${symbols.length} symbols`);
  }

  // Unsubscribe client from symbols
  unsubscribeClient(clientId: string, symbols?: string[]): void {
    if (!this.subscriptions.has(clientId)) return;

    if (!symbols) {
      // Unsubscribe all
      this.subscriptions.delete(clientId);
    } else {
      const clientSubs = this.subscriptions.get(clientId)!;
      for (const symbol of symbols) {
        clientSubs.delete(symbol);
      }
      
      if (clientSubs.size === 0) {
        this.subscriptions.delete(clientId);
      }
    }
  }

  // Get aggregated data for symbol
  getAggregatedData(symbol: string): AggregatedData | null {
    return this.aggregatedData.get(symbol) || null;
  }

  // Get all aggregated data
  getAllAggregatedData(): Map<string, AggregatedData> {
    return this.aggregatedData;
  }

  // Get stats
  getStats(): {
    totalSymbols: number;
    subscribedClients: number;
    totalUpdates: number;
  } {
    return {
      totalSymbols: this.aggregatedData.size,
      subscribedClients: this.subscriptions.size,
      totalUpdates: Array.from(this.aggregatedData.values())
        .reduce((sum, data) => sum + (data.signals?.length || 0), 0),
    };
  }

  // Start periodic updates
  startPeriodicUpdates(): void {
    if (this.updateTimer) return;

    this.updateTimer = setInterval(() => {
      // Broadcast updates to subscribed clients
      for (const [clientId, symbols] of this.subscriptions) {
        for (const symbol of symbols) {
          const data = this.aggregatedData.get(symbol);
          if (data) {
            this.wsManager.sendToClient(clientId, {
              type: 'aggregated-update',
              symbol: symbol,
              data: data,
            });
          }
        }
      }
    }, this.config.updateInterval);

    log.info('[RealtimeAggregator] Periodic updates started');
  }

  // Stop periodic updates
  stopPeriodicUpdates(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
      log.info('[RealtimeAggregator] Periodic updates stopped');
    }
  }

  // Clear all data
  clearAll(): void {
    this.aggregatedData.clear();
    this.subscriptions.clear();
    log.info('[RealtimeAggregator] All data cleared');
  }
}

// Singleton
let aggregatorInstance: RealtimeAggregator | null = null;

export function getRealtimeAggregator(): RealtimeAggregator {
  if (!aggregatorInstance) {
    aggregatorInstance = new RealtimeAggregator();
  }
  return aggregatorInstance;
}

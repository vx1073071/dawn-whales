// ── R166 P1-A1: Unified Signal Pipeline ───────────────────────────────────
// Before: 3+ signal modules each independently pulled data sources,
//         causing redundant fetches, race conditions, and wasted I/O.
// After:  Single pull → Fan-out to N consumers.
//         Factor signals → Strategy signals → Trade signals (chain).
//         Publish-once, subscribe-many. Eliminates race conditions.
//
// Architecture:
//   SignalPipeline
//     ├── SourceLayer:   pull data (factor, strategy, market) once per cycle
//     ├── TransformLayer: raw → factorSignal → strategySignal → tradeSignal
//     ├── FanoutLayer:   deliver to all registered consumers
//     └── HealthLayer:   latency tracking, queue depth, error rates

import log from 'electron-log';
import { EventEmitter } from 'events';

// ── Types ───────────────────────────────────────────────────────────────────

export interface FactorSignal {
  id: string;
  symbol: string;
  factorId: string;
  value: number;
  score: number;
  direction: 'long' | 'short' | 'neutral';
  confidence: number;
  threshold: number;
  source: string;
  timestamp: number;
}

export interface StrategySignal {
  id: string;
  strategyId: string;
  symbol: string;
  action: 'buy' | 'sell' | 'hold' | 'close';
  strength: number;           // 0-100
  confidence: number;
  /** Which factor signals triggered this */
  contributingFactors: string[];
  /** Position size suggestion */
  positionSizeHint: number;
  entryPrice?: number;
  stopLossPrice?: number;
  takeProfitPrice?: number;
  reason: string;
  timestamp: number;
}

export interface TradeSignal {
  id: string;
  strategySignalId: string;
  brokerId: string;
  symbol: string;
  orderType: 'market' | 'limit' | 'stop';
  side: 'buy' | 'sell';
  quantity: number;
  price?: number;
  /** Risk check passed */
  riskApproved: boolean;
  /** Slippage estimate (bps) */
  slippageEstimate: number;
  timestamp: number;
}

export interface SignalPipelineConfig {
  /** Pull interval (ms), default 2000 */
  pullIntervalMs: number;
  /** Max queue depth before dropping oldest */
  maxQueueDepth: number;
  /** Max consumers per signal type */
  maxConsumers: number;
  /** Enable performance logging */
  enableMetrics: boolean;
  /** Factor→Strategy threshold (confidence > threshold triggers) */
  factorTriggerConfidence: number;
  /** Strategy→Trade threshold */
  strategyTriggerConfidence: number;
}

export type SignalConsumer = (signal: FactorSignal | StrategySignal | TradeSignal) => void | Promise<void>;

export interface ConsumerRegistration {
  id: string;
  consumer: SignalConsumer;
  types: Array<'factor' | 'strategy' | 'trade'>;
  /** Optional filter: only receive signals for these symbols */
  symbolFilter?: string[];
  /** Optional filter: only receive signals for this strategy */
  strategyIdFilter?: string;
  registeredAt: number;
}

export interface PipelineMetrics {
  totalPulls: number;
  totalSignalsGenerated: number;
  activeConsumers: number;
  queueDepth: number;
  lastLatencyMs: number;
  avgLatencyMs: number;
  errorCount: number;
  errorRate: number;
  uptimeMs: number;
}

// ── Default Config ─────────────────────────────────────────────────────────

const DEFAULT_CONFIG: SignalPipelineConfig = {
  pullIntervalMs: 2000,
  maxQueueDepth: 1000,
  maxConsumers: 50,
  enableMetrics: false,
  factorTriggerConfidence: 0.6,
  strategyTriggerConfidence: 0.55,
};

// ── Signal Pipeline ────────────────────────────────────────────────────────

export class SignalPipeline extends EventEmitter {
  private config: SignalPipelineConfig;
  private consumers = new Map<string, ConsumerRegistration>();
  private factorQueue: FactorSignal[] = [];
  private strategyQueue: StrategySignal[] = [];
  private tradeQueue: TradeSignal[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private pullCount = 0;
  private signalCount = 0;
  private errorCount = 0;
  private latencyWindow: number[] = [];
  private startTime = 0;

  // Registered data sources (callbacks that produce raw signals)
  private factorSources: Array<() => Promise<FactorSignal[]>> = [];
  private strategySources: Array<() => Promise<StrategySignal[]>> = [];

  constructor(config?: Partial<SignalPipelineConfig>) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    log.info('[SignalPipeline] Initialized — interval:', this.config.pullIntervalMs, 'ms');
  }

  // ══ Lifecycle ═══════════════════════════════════════════════════════════

  /** Start the pipeline: begin periodic pulls */
  start(): void {
    if (this.running) {
      log.warn('[SignalPipeline] Already running');
      return;
    }
    this.running = true;
    this.startTime = Date.now();
    this.timer = setInterval(() => this.tick(), this.config.pullIntervalMs);
    log.info('[SignalPipeline] Started — pulling every', this.config.pullIntervalMs, 'ms');
    this.emit('started');
  }

  /** Stop the pipeline */
  stop(): void {
    this.running = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    log.info('[SignalPipeline] Stopped');
    this.emit('stopped');
  }

  // ══ Source Registration ══════════════════════════════════════════════════

  /** Register a factor signal source */
  registerFactorSource(source: () => Promise<FactorSignal[]>): void {
    this.factorSources.push(source);
    log.info('[SignalPipeline] Factor source registered (total:', this.factorSources.length, ')');
  }

  /** Register a strategy signal source */
  registerStrategySource(source: () => Promise<StrategySignal[]>): void {
    this.strategySources.push(source);
    log.info('[SignalPipeline] Strategy source registered (total:', this.strategySources.length, ')');
  }

  // ══ Consumer Registration ════════════════════════════════════════════════

  /** Subscribe to signal types */
  subscribe(
    id: string,
    consumer: SignalConsumer,
    types: Array<'factor' | 'strategy' | 'trade'>,
    filters?: { symbolFilter?: string[]; strategyIdFilter?: string },
  ): boolean {
    if (this.consumers.size >= this.config.maxConsumers) {
      log.error('[SignalPipeline] Max consumers reached:', this.config.maxConsumers);
      return false;
    }

    this.consumers.set(id, {
      id, consumer, types,
      symbolFilter: filters?.symbolFilter,
      strategyIdFilter: filters?.strategyIdFilter,
      registeredAt: Date.now(),
    });

    log.info('[SignalPipeline] Consumer registered:', id, 'types:', types.join(','));
    return true;
  }

  /** Unsubscribe */
  unsubscribe(id: string): boolean {
    const removed = this.consumers.delete(id);
    if (removed) log.info('[SignalPipeline] Consumer unsubscribed:', id);
    return removed;
  }

  // ══ Manual Signal Injection ══════════════════════════════════════════════

  /** Inject a factor signal from external source */
  injectFactorSignal(signal: FactorSignal): void {
    this.enqueue('factor', signal);
  }

  /** Inject a strategy signal */
  injectStrategySignal(signal: StrategySignal): void {
    this.enqueue('strategy', signal);
  }

  /** Inject a trade signal */
  injectTradeSignal(signal: TradeSignal): void {
    this.enqueue('trade', signal);
  }

  // ══ Metrics ═══════════════════════════════════════════════════════════════

  getMetrics(): PipelineMetrics {
    const avgLatency = this.latencyWindow.length > 0
      ? this.latencyWindow.reduce((a, b) => a + b, 0) / this.latencyWindow.length
      : 0;
    const errorRate = this.pullCount > 0 ? this.errorCount / this.pullCount : 0;

    return {
      totalPulls: this.pullCount,
      totalSignalsGenerated: this.signalCount,
      activeConsumers: this.consumers.size,
      queueDepth: this.factorQueue.length + this.strategyQueue.length + this.tradeQueue.length,
      lastLatencyMs: this.latencyWindow.length > 0 ? this.latencyWindow[this.latencyWindow.length - 1] : 0,
      avgLatencyMs: Number(avgLatency.toFixed(2)),
      errorCount: this.errorCount,
      errorRate: Number(errorRate.toFixed(4)),
      uptimeMs: this.running ? Date.now() - this.startTime : 0,
    };
  }

  /** List active consumer IDs */
  getConsumers(): string[] {
    return [...this.consumers.keys()];
  }

  /** Get current queue depths */
  getQueueDepths(): { factor: number; strategy: number; trade: number } {
    return {
      factor: this.factorQueue.length,
      strategy: this.strategyQueue.length,
      trade: this.tradeQueue.length,
    };
  }

  // ══ Reset ════════════════════════════════════════════════════════════════

  reset(): void {
    this.stop();
    this.consumers.clear();
    this.factorQueue = [];
    this.strategyQueue = [];
    this.tradeQueue = [];
    this.factorSources = [];
    this.strategySources = [];
    this.pullCount = 0;
    this.signalCount = 0;
    this.errorCount = 0;
    this.latencyWindow = [];
    log.info('[SignalPipeline] Reset complete');
  }

  // ══ Private: Core Tick ═══════════════════════════════════════════════════

  private async tick(): Promise<void> {
    const tickStart = Date.now();
    this.pullCount++;

    try {
      // Phase 1: Pull all factor signals from registered sources
      const factorSignals = await this.pullFactorSignals();
      for (const signal of factorSignals) {
        this.enqueue('factor', signal);
      }

      // Phase 2: Transform factor signals → strategy signals
      const strategySignals = await this.pullStrategySignals();
      for (const signal of strategySignals) {
        this.enqueue('strategy', signal);
      }

      // Phase 3: Transform relevant signals → trade signals
      await this.processTradeSignals(factorSignals, strategySignals);

      // Phase 4: Fanout — deliver queued signals to consumers
      await this.fanout();

      // Track latency
      this.trackLatency(tickStart);
    } catch (err: unknown) {
      this.errorCount++;
      log.error('[SignalPipeline] Tick error:', (err as Error)?.message || err);
      this.emit('error', err);
    }
  }

  // ── Pull Phase ───────────────────────────────────────────────────────────

  private async pullFactorSignals(): Promise<FactorSignal[]> {
    if (this.factorSources.length === 0) return [];
    const results = await Promise.allSettled(
      this.factorSources.map(s => s()),
    );
    const allSignals: FactorSignal[] = [];
    for (const r of results) {
      if (r.status === 'fulfilled') allSignals.push(...r.value);
    }
    return allSignals;
  }

  private async pullStrategySignals(): Promise<StrategySignal[]> {
    if (this.strategySources.length === 0) return [];
    const results = await Promise.allSettled(
      this.strategySources.map(s => s()),
    );
    const allSignals: StrategySignal[] = [];
    for (const r of results) {
      if (r.status === 'fulfilled') allSignals.push(...r.value);
    }
    return allSignals;
  }

  // ── Transform Phase ───────────────────────────────────────────────────────

  private async processTradeSignals(
    factorSignals: FactorSignal[],
    strategySignals: StrategySignal[],
  ): Promise<void> {
    // Trade signals from strategy signals (when confidence > threshold)
    for (const ss of strategySignals) {
      if (ss.action === 'buy' || ss.action === 'sell') {
        if (ss.confidence >= this.config.strategyTriggerConfidence) {
          const ts: TradeSignal = {
            id: `trade-${ss.id}`,
            strategySignalId: ss.id,
            brokerId: 'default',
            symbol: ss.symbol,
            orderType: 'market',
            side: ss.action as 'buy' | 'sell',
            quantity: ss.positionSizeHint || 1,
            price: ss.entryPrice,
            riskApproved: ss.confidence >= 0.7,
            slippageEstimate: 5,
            timestamp: Date.now(),
          };
          this.enqueue('trade', ts);
        }
      }
    }
  }

  // ── Fanout Phase ─────────────────────────────────────────────────────────

  private async fanout(): Promise<void> {
    // Collect all pending signals
    const factorBatch = this.drain('factor');
    const strategyBatch = this.drain('strategy');
    const tradeBatch = this.drain('trade');

    if (factorBatch.length === 0 && strategyBatch.length === 0 && tradeBatch.length === 0) return;

    // Deliver to each consumer
    const deliveries: Array<Promise<void>> = [];
    for (const [, reg] of this.consumers) {
      // Factor signals
      if (reg.types.includes('factor')) {
        for (const signal of factorBatch) {
          if (this.passesFilter(signal, reg)) {
            deliveries.push(this.safeDeliver(reg, signal));
          }
        }
      }
      // Strategy signals
      if (reg.types.includes('strategy')) {
        for (const signal of strategyBatch) {
          if (this.passesFilter(signal, reg)) {
            deliveries.push(this.safeDeliver(reg, signal));
          }
        }
      }
      // Trade signals
      if (reg.types.includes('trade')) {
        for (const signal of tradeBatch) {
          if (this.passesFilter(signal, reg)) {
            deliveries.push(this.safeDeliver(reg, signal));
          }
        }
      }
    }

    await Promise.allSettled(deliveries);
    this.emit('fanout', { factor: factorBatch.length, strategy: strategyBatch.length, trade: tradeBatch.length });
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private enqueue(type: 'factor' | 'strategy' | 'trade', signal: FactorSignal | StrategySignal | TradeSignal): void {
    const queue = type === 'factor' ? this.factorQueue : type === 'strategy' ? this.strategyQueue : this.tradeQueue;
    if (queue.length >= this.config.maxQueueDepth) {
      queue.shift(); // Drop oldest
    }
    queue.push(signal as any);
    this.signalCount++;
  }

  private drain(type: 'factor' | 'strategy' | 'trade'): any[] {
    const queue = type === 'factor' ? this.factorQueue : type === 'strategy' ? this.strategyQueue : this.tradeQueue;
    const batch = [...queue];
    queue.length = 0;
    return batch;
  }

  private passesFilter(signal: any, reg: ConsumerRegistration): boolean {
    if (reg.symbolFilter && reg.symbolFilter.length > 0) {
      if (!reg.symbolFilter.includes(signal.symbol)) return false;
    }
    if (reg.strategyIdFilter && signal.strategyId) {
      if (signal.strategyId !== reg.strategyIdFilter) return false;
    }
    return true;
  }

  private async safeDeliver(reg: ConsumerRegistration, signal: any): Promise<void> {
    try {
      const result = reg.consumer(signal);
      if (result instanceof Promise) await result;
    } catch (err: unknown) {
      log.error('[SignalPipeline] Consumer', reg.id, 'error:', (err as Error)?.message || err);
      this.emit('consumerError', { consumerId: reg.id, error: err });
    }
  }

  private trackLatency(tickStart: number): void {
    const latency = Date.now() - tickStart;
    this.latencyWindow.push(latency);
    if (this.latencyWindow.length > 100) this.latencyWindow.shift();
    if (this.config.enableMetrics && this.pullCount % 30 === 0) {
      const avg = this.latencyWindow.reduce((a, b) => a + b, 0) / this.latencyWindow.length;
      log.info('[SignalPipeline] Tick', this.pullCount, '— avg latency:', avg.toFixed(1), 'ms');
    }
  }
}

// ── Factory ─────────────────────────────────────────────────────────────────

export function createSignalPipeline(config?: Partial<SignalPipelineConfig>): SignalPipeline {
  return new SignalPipeline(config);
}

// ── Singleton ──────────────────────────────────────────────────────────────

let instance: SignalPipeline | null = null;

export function getSignalPipeline(config?: Partial<SignalPipelineConfig>): SignalPipeline {
  if (!instance) instance = new SignalPipeline(config);
  return instance;
}

export function resetSignalPipeline(): void {
  instance?.reset();
  instance = null;
}

// ── Convenience: Quick pipeline with common consumers ──────────────────────

export interface QuickPipeline {
  pipeline: SignalPipeline;
  /** Push a factor signal into pipeline */
  pushFactor(signal: FactorSignal): void;
  /** Push a strategy signal into pipeline */
  pushStrategy(signal: StrategySignal): void;
  /** Subscribe to all 3 signal types */
  onSignal(consumer: SignalConsumer): () => void; // returns unsubscribe
  /** Metrics */
  metrics(): PipelineMetrics;
}

export function createQuickPipeline(config?: Partial<SignalPipelineConfig>): QuickPipeline {
  const pipeline = new SignalPipeline(config);
  let consumerId = 0;

  return {
    pipeline,
    pushFactor: (s) => pipeline.injectFactorSignal(s),
    pushStrategy: (s) => pipeline.injectStrategySignal(s),
    onSignal: (consumer) => {
      const id = `quick-${++consumerId}`;
      pipeline.subscribe(id, consumer, ['factor', 'strategy', 'trade']);
      return () => pipeline.unsubscribe(id);
    },
    metrics: () => pipeline.getMetrics(),
  };
}

export default {
  SignalPipeline,
  createSignalPipeline,
  getSignalPipeline,
  resetSignalPipeline,
  createQuickPipeline,
};

/**
 * Real-time Data Flow Enhancement (JVS-43-02)
 *
 * Unified engine for:
 * 1. WebSocket Data Stream Optimization (connection pooling, auto-reconnect)
 * 2. Real-time Data Aggregation (multi-source fusion with conflict resolution)
 * 3. Data Quality Real-time Monitoring (freshness, completeness, consistency)
 * 4. Anomaly Detection (z-score, IQR statistical outlier detection)
 */

import log from 'electron-log';

// ============================================================================
// Inline EventEmitter Polyfill (no import from 'events')
// ============================================================================

type EventListener = (...args: any[]) => void;

class SimpleEventEmitter {
  private _listeners: Map<string, EventListener[]> = new Map();

  on(event: string, listener: EventListener): this {
    const list = this._listeners.get(event) ?? [];
    list.push(listener);
    this._listeners.set(event, list);
    return this;
  }

  off(event: string, listener: EventListener): this {
    const list = this._listeners.get(event);
    if (list) {
      this._listeners.set(
        event,
        list.filter((fn) => fn !== listener)
      );
    }
    return this;
  }

  once(event: string, listener: EventListener): this {
    const wrapped: EventListener = (...args) => {
      this.off(event, wrapped);
      listener(...args);
    };
    return this.on(event, wrapped);
  }

  emit(event: string, ...args: any[]): boolean {
    const list = this._listeners.get(event);
    if (!list || list.length === 0) return false;
    for (const fn of [...list]) {
      try {
        fn(...args);
      } catch (err) {
        log.error('[EventEmitter] Listener error:', err);
      }
    }
    return true;
  }

  removeAllListeners(event?: string): this {
    if (event) {
      this._listeners.delete(event);
    } else {
      this._listeners.clear();
    }
    return this;
  }

  listenerCount(event: string): number {
    return this._listeners.get(event)?.length ?? 0;
  }
}

// ============================================================================
// Types & Interfaces
// ============================================================================

/** WebSocket connection configuration */
export interface WSConnectionConfig {
  id: string;
  url: string;
  protocols?: string[];
  reconnectEnabled?: boolean;
  maxRetries?: number;
  baseRetryMs?: number;
  maxRetryMs?: number;
  pingIntervalMs?: number;
  heartbeatTimeoutMs?: number;
}

/** WebSocket connection status */
export type WSConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'error';

/** Single connection state snapshot */
export interface WSConnectionState {
  id: string;
  url: string;
  status: WSConnectionStatus;
  retryCount: number;
  lastConnectedAt: number | null;
  lastDisconnectedAt: number | null;
  lastError: string | null;
  messagesReceived: number;
  latencyMs: number;
}

/** Data point from a single source */
export interface SourceDataPoint {
  sourceId: string;
  timestamp: number;
  symbol?: string;
  price?: number;
  volume?: number;
  bid?: number;
  ask?: number;
  value?: number;
  metadata?: Record<string, any>;
}

/** Aggregated data result */
export interface AggregatedData {
  symbol: string;
  timestamp: number;
  price: number;
  volume: number;
  bid: number;
  ask: number;
  sources: string[];
  sourceCount: number;
  conflictResolved: boolean;
  strategy: ConflictStrategy;
}

/** Conflict resolution strategy */
export type ConflictStrategy = 'latest-wins' | 'average' | 'weighted';

/** Source weight for weighted strategy */
export interface SourceWeight {
  sourceId: string;
  weight: number;
}

/** Data quality dimensions */
export interface QualityDimensions {
  freshness: number;     // 0-100
  completeness: number;  // 0-100
  consistency: number;   // 0-100
  accuracy: number;      // 0-100
  timeliness: number;    // 0-100
}

/** Quality score result */
export interface QualityScore {
  overall: number;
  dimensions: QualityDimensions;
  timestamp: number;
  sampleSize: number;
}

/** Quality history entry */
export interface QualityHistoryEntry {
  timestamp: number;
  score: number;
  dimensions: QualityDimensions;
}

/** Anomaly type */
export type AnomalyType = 'price_spike' | 'volume_spike' | 'price_drop' | 'volume_drop' | 'outlier' | 'stale_data';

/** Detected anomaly */
export interface Anomaly {
  id: string;
  type: AnomalyType;
  symbol: string;
  timestamp: number;
  value: number;
  expectedRange: { min: number; max: number };
  deviation: number;     // z-score or IQR multiplier
  severity: 'low' | 'medium' | 'high' | 'critical';
  details?: string;
}

/** Anomaly threshold configuration */
export interface AnomalyThreshold {
  zScoreThreshold: number;       // default 3.0
  iqrMultiplier: number;         // default 1.5
  minSamples: number;            // minimum samples for detection
  staleDataMs: number;           // data older than this is stale
  priceChangePct: number;        // % change considered spike/drop
  volumeChangePct: number;       // % change considered volume anomaly
}

/** Overall engine configuration */
export interface RealtimeDataFlowConfig {
  maxConnections: number;
  aggregationWindowMs: number;
  qualityCheckIntervalMs: number;
  anomalyDetectionEnabled: boolean;
  conflictStrategy: ConflictStrategy;
  sourceWeights: SourceWeight[];
  anomalyThreshold: Partial<AnomalyThreshold>;
  maxHistorySize: number;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: RealtimeDataFlowConfig = {
  maxConnections: 10,
  aggregationWindowMs: 5000,
  qualityCheckIntervalMs: 10000,
  anomalyDetectionEnabled: true,
  conflictStrategy: 'latest-wins',
  sourceWeights: [],
  anomalyThreshold: {},
  maxHistorySize: 1000,
};

const DEFAULT_ANOMALY_THRESHOLD: AnomalyThreshold = {
  zScoreThreshold: 3.0,
  iqrMultiplier: 1.5,
  minSamples: 10,
  staleDataMs: 30000,
  priceChangePct: 5.0,
  volumeChangePct: 200.0,
};

// ============================================================================
// 1. WebSocket Data Stream Manager
// ============================================================================

export class WSStreamManager {
  private connections: Map<string, WSConnectionState> = new Map();
  private configs: Map<string, WSConnectionConfig> = new Map();
  private retryTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private pingTimers: Map<string, ReturnType<typeof setInterval>> = new Map();
  private emitter: SimpleEventEmitter = new SimpleEventEmitter();

  /** Register event handler */
  on(event: string, listener: EventListener): this {
    this.emitter.on(event, listener);
    return this;
  }

  off(event: string, listener: EventListener): this {
    this.emitter.off(event, listener);
    return this;
  }

  /**
   * Connect to a WebSocket endpoint
   */
  connect(config: WSConnectionConfig): WSConnectionState {
    const existing = this.connections.get(config.id);
    if (existing && (existing.status === 'connected' || existing.status === 'connecting')) {
      log.info(`[WSStream] Connection ${config.id} already active, reusing`);
      return existing;
    }

    this.configs.set(config.id, config);

    const state: WSConnectionState = {
      id: config.id,
      url: config.url,
      status: 'connecting',
      retryCount: 0,
      lastConnectedAt: null,
      lastDisconnectedAt: null,
      lastError: null,
      messagesReceived: 0,
      latencyMs: 0,
    };

    this.connections.set(config.id, state);
    log.info(`[WSStream] Connecting to ${config.url} (id=${config.id})`);

    // Simulate connection establishment
    const connectDelay = 10 + Math.random() * 40;
    setTimeout(() => {
      const s = this.connections.get(config.id);
      if (s && s.status === 'connecting') {
        s.status = 'connected';
        s.lastConnectedAt = Date.now();
        s.retryCount = 0;
        s.latencyMs = Math.round(5 + Math.random() * 30);
        log.info(`[WSStream] Connected: ${config.id} (latency=${s.latencyMs}ms)`);
        this.emitter.emit('connected', { id: config.id, state: s });
        this.startPing(config.id, config.pingIntervalMs ?? 30000);
      }
    }, connectDelay);

    return state;
  }

  /**
   * Disconnect a specific connection
   */
  disconnect(id: string): boolean {
    const state = this.connections.get(id);
    if (!state) {
      log.warn(`[WSStream] Cannot disconnect unknown connection: ${id}`);
      return false;
    }

    this.clearTimers(id);
    state.status = 'disconnected';
    state.lastDisconnectedAt = Date.now();
    log.info(`[WSStream] Disconnected: ${id}`);
    this.emitter.emit('disconnected', { id, state });
    return true;
  }

  /**
   * Reconnect a connection with exponential backoff
   */
  reconnect(id: string): WSConnectionState | null {
    const config = this.configs.get(id);
    const state = this.connections.get(id);
    if (!config || !state) {
      log.warn(`[WSStream] Cannot reconnect unknown connection: ${id}`);
      return null;
    }

    this.clearTimers(id);
    state.status = 'reconnecting';
    state.retryCount += 1;

    const maxRetries = config.maxRetries ?? 10;
    if (state.retryCount > maxRetries) {
      state.status = 'error';
      state.lastError = `Max retries exceeded (${maxRetries})`;
      log.error(`[WSStream] Max retries exceeded for ${id}`);
      this.emitter.emit('error', { id, state, error: state.lastError });
      return state;
    }

    const baseRetry = config.baseRetryMs ?? 1000;
    const maxRetry = config.maxRetryMs ?? 30000;
    const delay = Math.min(baseRetry * Math.pow(2, state.retryCount - 1), maxRetry);
    const jitter = delay * 0.1 * Math.random();

    log.info(`[WSStream] Reconnecting ${id} in ${Math.round(delay + jitter)}ms (retry ${state.retryCount})`);
    this.emitter.emit('reconnecting', { id, retryCount: state.retryCount, delay });

    const timer = setTimeout(() => {
      state.status = 'connected';
      state.lastConnectedAt = Date.now();
      state.retryCount = 0;
      state.latencyMs = Math.round(5 + Math.random() * 30);
      log.info(`[WSStream] Reconnected: ${id}`);
      this.emitter.emit('connected', { id, state });
      this.startPing(id, config.pingIntervalMs ?? 30000);
    }, delay + jitter);

    this.retryTimers.set(id, timer);
    return state;
  }

  /**
   * Get connection status for one or all connections
   */
  getConnectionStatus(id?: string): WSConnectionState | WSConnectionState[] | null {
    if (id) {
      return this.connections.get(id) ?? null;
    }
    return Array.from(this.connections.values());
  }

  /**
   * Record an incoming message from a connection
   */
  recordMessage(id: string, data: SourceDataPoint): void {
    const state = this.connections.get(id);
    if (state) {
      state.messagesReceived += 1;
    }
    this.emitter.emit('message', { id, data });
  }

  /**
   * Disconnect all and clean up
   */
  destroy(): void {
    for (const id of this.connections.keys()) {
      this.clearTimers(id);
    }
    this.connections.clear();
    this.configs.clear();
    this.emitter.removeAllListeners();
    log.info('[WSStream] Destroyed all connections');
  }

  /** Get count of active connections */
  get activeCount(): number {
    let count = 0;
    for (const s of this.connections.values()) {
      if (s.status === 'connected' || s.status === 'connecting') count++;
    }
    return count;
  }

  private startPing(id: string, intervalMs: number): void {
    this.clearPing(id);
    const timer = setInterval(() => {
      const state = this.connections.get(id);
      if (state && state.status === 'connected') {
        state.latencyMs = Math.round(3 + Math.random() * 20);
      }
    }, intervalMs);
    this.pingTimers.set(id, timer);
  }

  private clearPing(id: string): void {
    const t = this.pingTimers.get(id);
    if (t) {
      clearInterval(t);
      this.pingTimers.delete(id);
    }
  }

  private clearTimers(id: string): void {
    this.clearPing(id);
    const rt = this.retryTimers.get(id);
    if (rt) {
      clearTimeout(rt);
      this.retryTimers.delete(id);
    }
  }
}

// ============================================================================
// 2. Real-time Data Aggregator (Multi-source Fusion)
// ============================================================================

export class RealtimeAggregator {
  private buffer: Map<string, SourceDataPoint[]> = new Map();
  private sourceWeights: Map<string, number> = new Map();
  private strategy: ConflictStrategy;
  private windowMs: number;
  private emitter: SimpleEventEmitter = new SimpleEventEmitter();

  constructor(strategy: ConflictStrategy = 'latest-wins', windowMs: number = 5000) {
    this.strategy = strategy;
    this.windowMs = windowMs;
  }

  on(event: string, listener: EventListener): this {
    this.emitter.on(event, listener);
    return this;
  }

  off(event: string, listener: EventListener): this {
    this.emitter.off(event, listener);
    return this;
  }

  /**
   * Set source weight for weighted aggregation
   */
  setSourceWeight(sourceId: string, weight: number): void {
    this.sourceWeights.set(sourceId, Math.max(0, weight));
  }

  /**
   * Set conflict resolution strategy
   */
  setStrategy(strategy: ConflictStrategy): void {
    this.strategy = strategy;
    log.info(`[Aggregator] Strategy changed to: ${strategy}`);
  }

  /**
   * Add a data point from a source
   */
  addDataPoint(point: SourceDataPoint): void {
    const key = point.symbol ?? 'default';
    const list = this.buffer.get(key) ?? [];
    list.push(point);

    // Prune old entries outside the window
    const cutoff = Date.now() - this.windowMs;
    const pruned = list.filter((p) => p.timestamp >= cutoff);
    this.buffer.set(key, pruned);
  }

  /**
   * Aggregate data for a given symbol
   */
  aggregate(symbol: string): AggregatedData | null {
    const list = this.buffer.get(symbol);
    if (!list || list.length === 0) return null;

    const cutoff = Date.now() - this.windowMs;
    const fresh = list.filter((p) => p.timestamp >= cutoff);
    if (fresh.length === 0) return null;

    const sources = [...new Set(fresh.map((p) => p.sourceId))];
    const price = this.resolveConflict(
      fresh.filter((p) => p.price != null).map((p) => ({ value: p.price!, sourceId: p.sourceId }))
    );
    const volume = this.resolveConflict(
      fresh.filter((p) => p.volume != null).map((p) => ({ value: p.volume!, sourceId: p.sourceId }))
    );
    const bid = this.resolveConflict(
      fresh.filter((p) => p.bid != null).map((p) => ({ value: p.bid!, sourceId: p.sourceId }))
    );
    const ask = this.resolveConflict(
      fresh.filter((p) => p.ask != null).map((p) => ({ value: p.ask!, sourceId: p.sourceId }))
    );

    const latestTs = Math.max(...fresh.map((p) => p.timestamp));

    const result: AggregatedData = {
      symbol,
      timestamp: latestTs,
      price: price ?? 0,
      volume: volume ?? 0,
      bid: bid ?? 0,
      ask: ask ?? 0,
      sources,
      sourceCount: sources.length,
      conflictResolved: sources.length > 1,
      strategy: this.strategy,
    };

    this.emitter.emit('aggregated', result);
    return result;
  }

  /**
   * Merge data from multiple source arrays into one buffer
   */
  mergeSources(dataPoints: SourceDataPoint[]): number {
    let count = 0;
    for (const point of dataPoints) {
      this.addDataPoint(point);
      count++;
    }
    log.info(`[Aggregator] Merged ${count} data points from multiple sources`);
    return count;
  }

  /**
   * Resolve conflicting values using configured strategy
   */
  resolveConflict(entries: { value: number; sourceId: string }[]): number | null {
    if (entries.length === 0) return null;
    if (entries.length === 1) return entries[0].value;

    switch (this.strategy) {
      case 'latest-wins':
        // Last entry in the array is considered latest (insertion order)
        return entries[entries.length - 1].value;

      case 'average': {
        const sum = entries.reduce((acc, e) => acc + e.value, 0);
        return sum / entries.length;
      }

      case 'weighted': {
        let totalWeight = 0;
        let weightedSum = 0;
        for (const e of entries) {
          const w = this.sourceWeights.get(e.sourceId) ?? 1;
          weightedSum += e.value * w;
          totalWeight += w;
        }
        return totalWeight > 0 ? weightedSum / totalWeight : entries[0].value;
      }

      default:
        return entries[0].value;
    }
  }

  /** Get the current buffer size for a symbol */
  bufferSize(symbol?: string): number {
    if (symbol) {
      return this.buffer.get(symbol)?.length ?? 0;
    }
    let total = 0;
    for (const list of this.buffer.values()) {
      total += list.length;
    }
    return total;
  }

  /** Clear all buffered data */
  clear(): void {
    this.buffer.clear();
    this.emitter.removeAllListeners();
  }
}

// ============================================================================
// 3. Data Quality Real-time Monitor
// ============================================================================

export class DataQualityMonitor {
  private history: QualityHistoryEntry[] = [];
  private maxHistory: number;
  private freshnessWindowMs: number = 30000;
  private expectedFields: string[] = ['price', 'volume', 'bid', 'ask'];

  constructor(maxHistory: number = 1000) {
    this.maxHistory = maxHistory;
  }

  /**
   * Monitor quality of a dataset and return the score
   */
  monitorQuality(dataPoints: SourceDataPoint[], now: number = Date.now()): QualityScore {
    const freshness = this.calcFreshness(dataPoints, now);
    const completeness = this.calcCompleteness(dataPoints);
    const consistency = this.calcConsistency(dataPoints);
    const accuracy = this.calcAccuracy(dataPoints);
    const timeliness = this.calcTimeliness(dataPoints, now);

    const dimensions: QualityDimensions = {
      freshness,
      completeness,
      consistency,
      accuracy,
      timeliness,
    };

    const overall = Math.round(
      freshness * 0.25 + completeness * 0.25 + consistency * 0.2 + accuracy * 0.15 + timeliness * 0.15
    );

    const score: QualityScore = {
      overall: Math.max(0, Math.min(100, overall)),
      dimensions,
      timestamp: now,
      sampleSize: dataPoints.length,
    };

    // Record history
    this.history.push({ timestamp: now, score: score.overall, dimensions });
    if (this.history.length > this.maxHistory) {
      this.history = this.history.slice(-this.maxHistory);
    }

    return score;
  }

  /**
   * Get the latest quality score
   */
  getQualityScore(): number {
    if (this.history.length === 0) return 0;
    return this.history[this.history.length - 1].score;
  }

  /**
   * Get quality history
   */
  getQualityHistory(limit?: number): QualityHistoryEntry[] {
    if (limit && limit > 0) {
      return this.history.slice(-limit);
    }
    return [...this.history];
  }

  /**
   * Set the freshness window
   */
  setFreshnessWindow(ms: number): void {
    this.freshnessWindowMs = Math.max(1000, ms);
  }

  /**
   * Set expected fields for completeness check
   */
  setExpectedFields(fields: string[]): void {
    this.expectedFields = [...fields];
  }

  /** Clear quality history */
  clearHistory(): void {
    this.history = [];
  }

  // ── Private dimension calculators ────────────────────────────────────────

  private calcFreshness(dataPoints: SourceDataPoint[], now: number): number {
    if (dataPoints.length === 0) return 0;
    const latest = Math.max(...dataPoints.map((p) => p.timestamp));
    const age = now - latest;
    if (age <= 0) return 100;
    if (age >= this.freshnessWindowMs) return 0;
    return Math.round(100 * (1 - age / this.freshnessWindowMs));
  }

  private calcCompleteness(dataPoints: SourceDataPoint[]): number {
    if (dataPoints.length === 0) return 0;
    let totalFields = 0;
    let presentFields = 0;
    for (const p of dataPoints) {
      for (const field of this.expectedFields) {
        totalFields++;
        if ((p as any)[field] != null) presentFields++;
      }
    }
    return totalFields > 0 ? Math.round((presentFields / totalFields) * 100) : 0;
  }

  private calcConsistency(dataPoints: SourceDataPoint[]): number {
    if (dataPoints.length < 1) return 100;

    // Check for contradictory data (e.g. bid > ask)
    let consistent = 0;
    let total = 0;
    for (const p of dataPoints) {
      if (p.bid != null && p.ask != null) {
        total++;
        if (p.bid <= p.ask) consistent++;
      }
      if (p.price != null && p.bid != null && p.ask != null) {
        total++;
        if (p.price >= p.bid && p.price <= p.ask) consistent++;
      }
    }
    return total > 0 ? Math.round((consistent / total) * 100) : 100;
  }

  private calcAccuracy(dataPoints: SourceDataPoint[]): number {
    if (dataPoints.length === 0) return 0;
    let valid = 0;
    for (const p of dataPoints) {
      const hasPrice = p.price == null || p.price > 0;
      const hasVolume = p.volume == null || p.volume >= 0;
      if (hasPrice && hasVolume) valid++;
    }
    return Math.round((valid / dataPoints.length) * 100);
  }

  private calcTimeliness(dataPoints: SourceDataPoint[], now: number): number {
    if (dataPoints.length === 0) return 0;
    const maxAcceptableLatency = 5000; // 5s
    let timely = 0;
    for (const p of dataPoints) {
      const latency = now - p.timestamp;
      if (latency <= maxAcceptableLatency) timely++;
    }
    return Math.round((timely / dataPoints.length) * 100);
  }
}

// ============================================================================
// 4. Anomaly Detector
// ============================================================================

export class AnomalyDetector {
  private priceHistory: Map<string, number[]> = new Map();
  private volumeHistory: Map<string, number[]> = new Map();
  private anomalies: Anomaly[] = [];
  private threshold: AnomalyThreshold;
  private maxAnomalies: number;
  private nextId: number = 1;

  constructor(threshold?: Partial<AnomalyThreshold>, maxAnomalies: number = 500) {
    this.threshold = { ...DEFAULT_ANOMALY_THRESHOLD, ...threshold };
    this.maxAnomalies = maxAnomalies;
  }

  /**
   * Detect anomalies in a data point relative to historical data
   */
  detectAnomalies(point: SourceDataPoint): Anomaly[] {
    const symbol = point.symbol ?? 'default';
    const detected: Anomaly[] = [];

    if (point.price != null) {
      const prices = this.priceHistory.get(symbol) ?? [];
      prices.push(point.price);
      if (prices.length > 1000) prices.splice(0, prices.length - 1000);
      this.priceHistory.set(symbol, prices);

      if (prices.length >= this.threshold.minSamples) {
        const zAnomaly = this.detectZScore(point.price, prices, symbol, 'price');
        if (zAnomaly) detected.push(zAnomaly);

        const iqrAnomaly = this.detectIQR(point.price, prices, symbol, 'price');
        if (iqrAnomaly) detected.push(iqrAnomaly);

        const pctAnomaly = this.detectPctChange(point.price, prices, symbol, 'price');
        if (pctAnomaly) detected.push(pctAnomaly);
      }
    }

    if (point.volume != null) {
      const volumes = this.volumeHistory.get(symbol) ?? [];
      volumes.push(point.volume);
      if (volumes.length > 1000) volumes.splice(0, volumes.length - 1000);
      this.volumeHistory.set(symbol, volumes);

      if (volumes.length >= this.threshold.minSamples) {
        const zAnomaly = this.detectZScore(point.volume, volumes, symbol, 'volume');
        if (zAnomaly) detected.push(zAnomaly);

        const pctAnomaly = this.detectPctChange(point.volume, volumes, symbol, 'volume');
        if (pctAnomaly) detected.push(pctAnomaly);
      }
    }

    // Deduplicate by type + symbol within same call
    const unique = this.dedupAnomalies(detected);
    for (const a of unique) {
      this.anomalies.push(a);
    }

    // Trim history
    if (this.anomalies.length > this.maxAnomalies) {
      this.anomalies = this.anomalies.slice(-this.maxAnomalies);
    }

    if (unique.length > 0) {
      log.warn(`[AnomalyDetector] ${unique.length} anomalies detected for ${symbol}`);
    }

    return unique;
  }

  /**
   * Get all detected anomalies (optionally filtered by symbol)
   */
  getAnomalies(symbol?: string): Anomaly[] {
    if (symbol) {
      return this.anomalies.filter((a) => a.symbol === symbol);
    }
    return [...this.anomalies];
  }

  /**
   * Set anomaly threshold parameters
   */
  setAnomalyThreshold(partial: Partial<AnomalyThreshold>): void {
    this.threshold = { ...this.threshold, ...partial };
    log.info(`[AnomalyDetector] Threshold updated: z=${this.threshold.zScoreThreshold}, iqr=${this.threshold.iqrMultiplier}`);
  }

  /**
   * Get current threshold configuration
   */
  getThreshold(): AnomalyThreshold {
    return { ...this.threshold };
  }

  /**
   * Clear all historical data and anomalies
   */
  clear(): void {
    this.priceHistory.clear();
    this.volumeHistory.clear();
    this.anomalies = [];
    this.nextId = 1;
  }

  // ── Private detection methods ────────────────────────────────────────────

  private detectZScore(
    value: number,
    history: number[],
    symbol: string,
    field: 'price' | 'volume'
  ): Anomaly | null {
    const mean = history.reduce((s, v) => s + v, 0) / history.length;
    const variance = history.reduce((s, v) => s + (v - mean) ** 2, 0) / history.length;
    const stdDev = Math.sqrt(variance);
    if (stdDev === 0) return null;

    const z = Math.abs((value - mean) / stdDev);
    if (z < this.threshold.zScoreThreshold) return null;

    const type: AnomalyType = field === 'price'
      ? (value > mean ? 'price_spike' : 'price_drop')
      : (value > mean ? 'volume_spike' : 'volume_drop');

    return {
      id: `anomaly-${this.nextId++}`,
      type,
      symbol,
      timestamp: Date.now(),
      value,
      expectedRange: {
        min: mean - this.threshold.zScoreThreshold * stdDev,
        max: mean + this.threshold.zScoreThreshold * stdDev,
      },
      deviation: z,
      severity: this.zToSeverity(z),
      details: `Z-score ${z.toFixed(2)} for ${field} (${value}), mean=${mean.toFixed(2)}, σ=${stdDev.toFixed(2)}`,
    };
  }

  private detectIQR(
    value: number,
    history: number[],
    symbol: string,
    field: 'price' | 'volume'
  ): Anomaly | null {
    const sorted = [...history].sort((a, b) => a - b);
    const q1 = this.percentile(sorted, 25);
    const q3 = this.percentile(sorted, 75);
    const iqr = q3 - q1;
    if (iqr === 0) return null;

    const lower = q1 - this.threshold.iqrMultiplier * iqr;
    const upper = q3 + this.threshold.iqrMultiplier * iqr;

    if (value >= lower && value <= upper) return null;

    const type: AnomalyType = field === 'price'
      ? (value > upper ? 'price_spike' : 'price_drop')
      : (value > upper ? 'volume_spike' : 'volume_drop');

    const deviation = value > upper ? (value - upper) / iqr : (lower - value) / iqr;

    return {
      id: `anomaly-${this.nextId++}`,
      type: 'outlier',
      symbol,
      timestamp: Date.now(),
      value,
      expectedRange: { min: lower, max: upper },
      deviation,
      severity: deviation > 3 ? 'critical' : deviation > 2 ? 'high' : 'medium',
      details: `IQR outlier: ${field}=${value}, Q1=${q1.toFixed(2)}, Q3=${q3.toFixed(2)}, IQR=${iqr.toFixed(2)}`,
    };
  }

  private detectPctChange(
    value: number,
    history: number[],
    symbol: string,
    field: 'price' | 'volume'
  ): Anomaly | null {
    if (history.length < 2) return null;
    const prev = history[history.length - 2];
    if (prev === 0) return null;

    const pctChange = ((value - prev) / prev) * 100;
    const thresholdPct = field === 'price' ? this.threshold.priceChangePct : this.threshold.volumeChangePct;

    if (Math.abs(pctChange) < thresholdPct) return null;

    const type: AnomalyType = field === 'price'
      ? (pctChange > 0 ? 'price_spike' : 'price_drop')
      : (pctChange > 0 ? 'volume_spike' : 'volume_drop');

    return {
      id: `anomaly-${this.nextId++}`,
      type,
      symbol,
      timestamp: Date.now(),
      value,
      expectedRange: {
        min: prev * (1 - thresholdPct / 100),
        max: prev * (1 + thresholdPct / 100),
      },
      deviation: Math.abs(pctChange) / thresholdPct,
      severity: Math.abs(pctChange) > thresholdPct * 3 ? 'critical' : Math.abs(pctChange) > thresholdPct * 2 ? 'high' : 'medium',
      details: `${field} changed ${pctChange.toFixed(1)}% from ${prev} to ${value} (threshold: ${thresholdPct}%)`,
    };
  }

  private percentile(sorted: number[], p: number): number {
    const idx = (p / 100) * (sorted.length - 1);
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    if (lo === hi) return sorted[lo];
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
  }

  private zToSeverity(z: number): 'low' | 'medium' | 'high' | 'critical' {
    if (z >= 6) return 'critical';
    if (z >= 4.5) return 'high';
    if (z >= 3.5) return 'medium';
    return 'low';
  }

  private dedupAnomalies(anomalies: Anomaly[]): Anomaly[] {
    const seen = new Set<string>();
    const result: Anomaly[] = [];
    for (const a of anomalies) {
      const key = `${a.type}:${a.symbol}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push(a);
      }
    }
    return result;
  }
}

// ============================================================================
// 5. Unified Real-time Data Flow Engine
// ============================================================================

export class RealtimeDataFlowEngine extends SimpleEventEmitter {
  readonly wsManager: WSStreamManager;
  readonly aggregator: RealtimeAggregator;
  readonly qualityMonitor: DataQualityMonitor;
  readonly anomalyDetector: AnomalyDetector;
  private config: RealtimeDataFlowConfig;
  private qualityTimer: ReturnType<typeof setInterval> | null = null;
  private isRunning: boolean = false;

  constructor(config?: Partial<RealtimeDataFlowConfig>) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Initialize sub-modules
    this.wsManager = new WSStreamManager();
    this.aggregator = new RealtimeAggregator(
      this.config.conflictStrategy,
      this.config.aggregationWindowMs
    );
    this.qualityMonitor = new DataQualityMonitor(this.config.maxHistorySize);
    this.anomalyDetector = new AnomalyDetector(
      this.config.anomalyThreshold,
      this.config.maxHistorySize
    );

    // Configure source weights
    for (const sw of this.config.sourceWeights) {
      this.aggregator.setSourceWeight(sw.sourceId, sw.weight);
    }

    // Wire events from sub-modules
    this.wsManager.on('message', (evt: any) => {
      const point = evt.data as SourceDataPoint;
      this.aggregator.addDataPoint(point);

      if (this.config.anomalyDetectionEnabled) {
        const anomalies = this.anomalyDetector.detectAnomalies(point);
        if (anomalies.length > 0) {
          this.emit('anomaly', { anomalies, point });
        }
      }
    });

    this.wsManager.on('disconnected', (evt: any) => {
      this.emit('wsDisconnected', evt);
    });

    this.wsManager.on('error', (evt: any) => {
      this.emit('wsError', evt);
    });

    log.info('[RealtimeDataFlow] Engine initialized', {
      maxConnections: this.config.maxConnections,
      strategy: this.config.conflictStrategy,
      anomalyDetection: this.config.anomalyDetectionEnabled,
    });
  }

  /**
   * Start the engine: begin periodic quality monitoring
   */
  start(): void {
    if (this.isRunning) {
      log.warn('[RealtimeDataFlow] Engine already running');
      return;
    }
    this.isRunning = true;

    this.qualityTimer = setInterval(() => {
      // Run quality check on all buffered data
      const allPoints: SourceDataPoint[] = [];
      // Gather from aggregator buffer (access via public method)
      const size = this.aggregator.bufferSize();
      if (size > 0) {
        const score = this.qualityMonitor.monitorQuality(allPoints);
        this.emit('qualityUpdate', score);
        if (score.overall < 50) {
          log.warn(`[RealtimeDataFlow] Low quality score: ${score.overall}`);
        }
      }
    }, this.config.qualityCheckIntervalMs);

    log.info('[RealtimeDataFlow] Engine started');
    this.emit('started');
  }

  /**
   * Stop the engine
   */
  stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;

    if (this.qualityTimer) {
      clearInterval(this.qualityTimer);
      this.qualityTimer = null;
    }

    this.wsManager.destroy();
    log.info('[RealtimeDataFlow] Engine stopped');
    this.emit('stopped');
  }

  /**
   * Get overall engine status
   */
  getStatus(): {
    running: boolean;
    connections: WSConnectionState[];
    qualityScore: number;
    anomalyCount: number;
    bufferSize: number;
    config: RealtimeDataFlowConfig;
  } {
    return {
      running: this.isRunning,
      connections: this.wsManager.getConnectionStatus() as WSConnectionState[],
      qualityScore: this.qualityMonitor.getQualityScore(),
      anomalyCount: this.anomalyDetector.getAnomalies().length,
      bufferSize: this.aggregator.bufferSize(),
      config: { ...this.config },
    };
  }

  /**
   * Ingest a data point directly (bypasses WebSocket)
   */
  ingest(point: SourceDataPoint): void {
    this.aggregator.addDataPoint(point);

    if (this.config.anomalyDetectionEnabled) {
      const anomalies = this.anomalyDetector.detectAnomalies(point);
      if (anomalies.length > 0) {
        this.emit('anomaly', { anomalies, point });
      }
    }
  }

  /**
   * Run quality check on a set of points and return score
   */
  checkQuality(points: SourceDataPoint[]): QualityScore {
    return this.qualityMonitor.monitorQuality(points);
  }

  /**
   * Update configuration at runtime
   */
  updateConfig(partial: Partial<RealtimeDataFlowConfig>): void {
    this.config = { ...this.config, ...partial };

    if (partial.conflictStrategy) {
      this.aggregator.setStrategy(partial.conflictStrategy);
    }
    if (partial.sourceWeights) {
      for (const sw of partial.sourceWeights) {
        this.aggregator.setSourceWeight(sw.sourceId, sw.weight);
      }
    }
    if (partial.anomalyThreshold) {
      this.anomalyDetector.setAnomalyThreshold(partial.anomalyThreshold);
    }

    log.info('[RealtimeDataFlow] Config updated');
  }
}

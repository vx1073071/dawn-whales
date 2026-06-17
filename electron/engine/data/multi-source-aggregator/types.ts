// R256 Claw(PM)代工: Multi-Source Aggregator Types — 从any stub → production types
// 原先 R119 QClaw stub 全部为 any，现已替换为实际类型定义

// ── Data Source Identity ──
export type DataSourceId = 'yahoo' | 'binance' | 'eastmoney' | 'google' | 'investing' | 'futu' | 'ib' | 'broker';

export interface DataSourceConfig {
  id: DataSourceId;
  name: string;
  url?: string;
  wsUrl?: string;
  priority: number;           // 1=最高(券商), 5=最低(Investing RSS)
  marketCoverage: string[];   // ['US','HK','JP',...]
  realtime: boolean;
  maxLatency: number;         // ms
  requiresAuth: boolean;
}

// ── Quote Data ──
export interface DataPoint {
  source: DataSourceId;
  symbol: string;
  market: string;
  price: number;
  bid?: number;
  ask?: number;
  change: number;
  changePct: number;
  volume: number;
  high: number;
  low: number;
  open: number;
  prevClose: number;
  timestamp: number;
  latency: number;            // ms from source
}

// ── Source Health ──
export interface SourceHealth {
  sourceId: DataSourceId;
  status: 'online' | 'degraded' | 'offline';
  latency: number;            // last heartbeat latency ms
  uptime: number;             // percentage
  lastHeartbeat: number;      // timestamp
  failCount: number;
  lastError?: string;
  marketsUnavailable: string[];
}

// ── Aggregation ──
export interface AggregationResult {
  symbol: string;
  primarySource: DataSourceId;
  price: number;
  bid?: number;
  ask?: number;
  change: number;
  changePct: number;
  volume: number;
  high: number;
  low: number;
  open: number;
  prevClose: number;
  timestamp: number;
  sources: DataSourceId[];    // all sources that contributed
  confidence: number;         // 0-1, based on source quality + latency
}

// ── Source Priority Weight ──
export interface SourceWeightEntry {
  sourceId: DataSourceId;
  weight: number;             // aggregation weight
  lastPrice: number;
  reliability: number;        // 0-1 based on historical accuracy
}

// ── Validation ──
export interface ValidationConfig {
  maxPriceDeviation: number;  // 0.05 = 5% max cross-source deviation
  maxLatency: number;         // max acceptable latency ms
  minSourcesRequired: number; // minimum sources before fallback
}

export interface DataQuality {
  sourceId: DataSourceId;
  symbol: string;
  timestamp: number;
  passedValidation: boolean;
  issues: string[];
  deviationFromConsensus: number;
  isStale: boolean;
}

// ── Source Registry ──
export interface RegisteredSource {
  config: DataSourceConfig;
  health: SourceHealth;
  connected: boolean;
  lastDataPoint?: DataPoint;
  reconnectAttempts: number;
}

// ── Fetch & Stats ──
export interface FetchAttemptResult {
  sourceId: DataSourceId;
  success: boolean;
  latency: number;
  dataPoint?: DataPoint;
  error?: string;
}

export interface SourceStats {
  sourceId: DataSourceId;
  totalRequests: number;
  successRate: number;
  avgLatency: number;
  last24hUptime: number;
}

// ── Diagnostics ──
export interface DataDiagnostic {
  symbol: string;
  sourcesAvailable: DataSourceId[];
  primarySource: DataSourceId;
  crossSourceDeviation: number;
  latency: number;
  stale: boolean;
  recommendation: string;
}

// ── Simple Event Emitter (for backward compat) ──
export class SimpleEventEmitter {
  private listeners: Map<string, Function[]> = new Map();
  on(event: string, fn: Function): this {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event)!.push(fn);
    return this;
  }
  emit(event: string, ...args: any[]): void {
    const fns = this.listeners.get(event);
    if (fns) fns.forEach(fn => fn(...args));
  }
}

// ── Broker-aware Priority Logic ──
export type SourcePriority = {
  brokerConnected: boolean;    // user has broker API
  brokerSourceId: DataSourceId; // e.g. 'futu' | 'ib' | 'binance'
  fallbackOrder: DataSourceId[]; // [broker, yahoo, google, investing]
};

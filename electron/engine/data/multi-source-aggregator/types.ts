// @ts-nocheck
type EventListener = (...args: unknown[]) => void;

class SimpleEventEmitter {
  private _listeners: Map<string, EventListener[]> = new Map();
export type DataSourceId = 'eastmoney' | 'sina' | 'tencent' | 'xueqiu';
export type DataQuality = 'high' | 'medium' | 'low' | 'unavailable';
export interface DataSourceConfig {
  id: DataSourceId;
  name: string;
  priority: number; // lower = higher priority
  enabled: boolean;
  timeoutMs: number;
  maxRetries: number;
  healthCheckIntervalMs: number;
}
export interface DataPoint {
  symbol: string;
  source: DataSourceId;
  price: number;
  volume: number;
  timestamp: number;
  quality: DataQuality;
  confidence: number; // 0-1
}
export interface SourceHealth {
  id: DataSourceId;
  status: 'healthy' | 'degraded' | 'unavailable';
  latencyMs: number;
  successRate: number; // 0-1
  lastCheck: number;
  errorCount: number;
}
export interface AggregationResult {
  symbol: string;
  bestData: DataPoint;
  allSources: DataPoint[];
  consensus: number; // agreement score 0-1
  timestamp: number;
}
export interface SourceStats {
  requests: number;
  errors: number;
  avgLatency: number;
}
interface RegisteredSource {
  config: DataSourceConfig;
  fetcher: (symbol: string) => Promise<DataPoint>;
  health: SourceHealth;
  stats: SourceStats & { totalLatency: number };
  healthCheckTimer: ReturnType<typeof setInterval> | null;
}
interface FetchAttemptResult {
  success: boolean;
  data?: DataPoint;
  error?: Error;
  latencyMs: number;
}
export interface ValidationConfig {
  minPrice: number;
  maxPrice: number;
  maxVolumeRatio: number;
  maxTimestampAgeMs: number;
}
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}
export interface AnomalyRecord {
  symbol: string;
  source: DataSourceId;
  price: number;
  zScore: number;
  timestamp: number;
  flagged: boolean;
}
export interface LatencyStats {
  p50: number;
  p95: number;
  p99: number;
  samples: number;
}
export interface BatchFetchResult {
  symbol: string;
  success: boolean;
  data?: DataPoint;
  error?: string;
}
export interface SourceWeightEntry {
  timestamp: number;
  symbol: string;
  selectedSource: DataSourceId;
  allSources: DataSourceId[];
  reason: string;
}

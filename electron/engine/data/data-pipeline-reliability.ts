/**
 * JVS-47-03: data pipelinereliability
 * +latency+cache hit>90%
 * 
 * :
 *
 * - latency
 * - cachestrategy/policy
 * - cache hit
 */

import { EventEmitter } from 'events';
import { EngineError, ErrorDomain, ErrorCode } from '../core/engine-error';
import log from 'electron-log';

// ─── ───────────────────────────────────────────────────────────────

export interface PipelineConfig {
  maxRetries: number;
  retryInterval: number;
  timeout: number;
  cacheEnabled: boolean;
  cacheMaxAge: number;
  monitoringInterval: number;
}

export interface PipelineMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  cacheHits: number;
  cacheMisses: number;
  averageLatency: number;
  cacheHitRate: number;
  reconnectionAttempts: number;
}

export interface PipelineStatus {
  connected: boolean;
  lastError: string | null;
  lastConnectionTime: number;
  currentLatency: number;
  retryCount: number;
}

// ─── data pipelinereliability ─────────────────────────────────────────────────────

export class DataPipelineReliability extends EventEmitter {
  private config: PipelineConfig;
  private metrics: PipelineMetrics;
  private status: PipelineStatus;
  private cache: Map<string, { data: unknown; timestamp: number }>;
  private reconnectTimer: NodeJS.Timeout | null;

  constructor(config?: Partial<PipelineConfig>) {
    super();
    
    this.config = {
      maxRetries: config?.maxRetries ?? 3,
      retryInterval: config?.retryInterval ?? 1000,
      timeout: config?.timeout ?? 5000,
      cacheEnabled: config?.cacheEnabled ?? true,
      cacheMaxAge: config?.cacheMaxAge ?? 300000, // 5 minutes
      monitoringInterval: config?.monitoringInterval ?? 10000,
    };

    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      averageLatency: 0,
      cacheHitRate: 0,
      reconnectionAttempts: 0,
    };

    this.status = {
      connected: false,
      lastError: null,
      lastConnectionTime: 0,
      currentLatency: 0,
      retryCount: 0,
    };

    this.cache = new Map();
    this.reconnectTimer = null;

    this.startMonitoring();
  }

  /**
 * request（cacheretry）
   */
  async requestData<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    const startTime = Date.now();
    this.metrics.totalRequests++;

 // 1. cache
    if (this.config.cacheEnabled) {
      const cached = this.getCachedData<T>(key);
      if (cached) {
        this.metrics.cacheHits++;
        this.updateCacheHitRate();
        return cached;
      }
      this.metrics.cacheMisses++;
    }

 // 2. request（retry）
    try {
      const data = await this.fetchWithRetry(fetcher);
      
 // cache
      if (this.config.cacheEnabled) {
        this.cacheData(key, data);
      }

      // updatemetric
      this.metrics.successfulRequests++;
      const latency = Date.now() - startTime;
      this.updateLatency(latency);

      return data;
    } catch (error) {
    // [EngineError:DATA] — structured error tracking
      this.metrics.failedRequests++;
      throw error;
    }
  }

  /**
 * retry
   */
  private async fetchWithRetry<T>(fetcher: () => Promise<T>): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        const data = await this.withTimeout(fetcher(), this.config.timeout);
        
 // success
        this.status.connected = true;
        this.status.retryCount = 0;
        this.status.lastConnectionTime = Date.now();
        
        return data;
      } catch (error) {
    // [EngineError:DATA] — structured error tracking
        lastError = error as Error;
        this.status.retryCount = attempt;
        
        if (attempt < this.config.maxRetries) {
          log.warn(`[Pipeline] Retry attempt ${attempt}/${this.config.maxRetries}`);
          await this.delay(this.config.retryInterval);
        }
      }
    }

 // retryfailed
    this.status.connected = false;
    this.status.lastError = lastError?.message || 'Unknown error';
    this.metrics.reconnectionAttempts++;
    
    this.emit('connectionFailed', { error: lastError });
    throw lastError;
  }

  /**
 * timeout Promise
   */
  private withTimeout<T>(promise: Promise<T>, timeout: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new EngineError(ErrorDomain.DATA, ErrorCode.INTERNAL_ERROR, 'Request timeout'));
      }, timeout);

      promise
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error: unknown) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
 * cache
   */
  private getCachedData<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    const age = Date.now() - cached.timestamp;
    if (age > this.config.cacheMaxAge) {
      this.cache.delete(key);
      return null;
    }

    return cached.data as T;
  }

  /**
 * cache
   */
  private cacheData(key: string, data: unknown): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });

 // limitcache
    if (this.cache.size > 1000) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }
  }

  /**
 * updatelatency
   */
  private updateLatency(latency: number): void {
    const totalRequests = this.metrics.successfulRequests + this.metrics.failedRequests;
    this.metrics.averageLatency = 
      (this.metrics.averageLatency * (totalRequests - 1) + latency) / totalRequests;
    this.status.currentLatency = latency;
  }

  /**
 * updatecache hit
   */
  private updateCacheHitRate(): void {
    const total = this.metrics.cacheHits + this.metrics.cacheMisses;
    this.metrics.cacheHitRate = total > 0 ? (this.metrics.cacheHits / total) * 100 : 0;
  }

  /**
 * latency
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
 *
   */
  private startMonitoring(): void {
    // Use real timers for monitoring to avoid conflicts with fake timers in tests
    this.reconnectTimer = setInterval(() => {
      this.emit('metrics', this.getMetrics());
      this.emit('status', this.getStatus());
    }, this.config.monitoringInterval);
  }

  /**
 * currentmetric
   */
  getMetrics(): PipelineMetrics {
    this.updateCacheHitRate();
    return { ...this.metrics };
  }

  /**
 * current
   */
  getStatus(): PipelineStatus {
    return { ...this.status };
  }

  /**
 *
   */
  async reconnect(): Promise<void> {
    log.info('[Pipeline] Manual reconnection triggered');
    this.status.connected = false;
    this.status.retryCount = 0;
    this.metrics.reconnectionAttempts++;
  }

  /**
 *
   */
  destroy(): void {
    if (this.reconnectTimer) {
      clearInterval(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.cache.clear();
    this.removeAllListeners();
    log.info('[Pipeline] Destroyed');
  }

  /**
 * cache hit
   */
  getCacheHitRate(): number {
    this.updateCacheHitRate();
    return this.metrics.cacheHitRate;
  }

  /**
 * cache hit（>90%）
   */
  isCacheHitRateHealthy(): boolean {
    return this.getCacheHitRate() >= 90;
  }
}

// export
let reliabilityInstance: DataPipelineReliability | null = null;

export function getPipelineReliability(config?: Partial<PipelineConfig>): DataPipelineReliability {
  if (!reliabilityInstance) {
    reliabilityInstance = new DataPipelineReliability(config);
  }
  return reliabilityInstance;
}

export default DataPipelineReliability;

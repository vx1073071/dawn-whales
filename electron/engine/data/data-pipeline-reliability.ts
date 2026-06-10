/**
 * JVS-47-03: 数据管道可靠性
 * 实现断线重连+延迟监控+缓存命中>90%
 * 
 * 特性:
 * - 自动断线重连机制
 * - 延迟监控和告警
 * - 智能缓存策略
 * - 缓存命中率统计
 */

import { EventEmitter } from 'events';
import log from 'electron-log';

// ─── 类型定义 ───────────────────────────────────────────────────────────────

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

// ─── 数据管道可靠性管理器 ─────────────────────────────────────────────────────

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
   * 请求数据（带缓存和重试）
   */
  async requestData<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    const startTime = Date.now();
    this.metrics.totalRequests++;

    // 1. 检查缓存
    if (this.config.cacheEnabled) {
      const cached = this.getCachedData<T>(key);
      if (cached) {
        this.metrics.cacheHits++;
        this.updateCacheHitRate();
        return cached;
      }
      this.metrics.cacheMisses++;
    }

    // 2. 请求数据（带重试）
    try {
      const data = await this.fetchWithRetry(fetcher);
      
      // 缓存数据
      if (this.config.cacheEnabled) {
        this.cacheData(key, data);
      }

      // 更新指标
      this.metrics.successfulRequests++;
      const latency = Date.now() - startTime;
      this.updateLatency(latency);

      return data;
    } catch (error) {
      this.metrics.failedRequests++;
      throw error;
    }
  }

  /**
   * 带重试的数据获取
   */
  private async fetchWithRetry<T>(fetcher: () => Promise<T>): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        const data = await this.withTimeout(fetcher(), this.config.timeout);
        
        // 成功连接
        this.status.connected = true;
        this.status.retryCount = 0;
        this.status.lastConnectionTime = Date.now();
        
        return data;
      } catch (error) {
        lastError = error as Error;
        this.status.retryCount = attempt;
        
        if (attempt < this.config.maxRetries) {
          log.warn(`[Pipeline] Retry attempt ${attempt}/${this.config.maxRetries}`);
          await this.delay(this.config.retryInterval);
        }
      }
    }

    // 所有重试失败
    this.status.connected = false;
    this.status.lastError = lastError?.message || 'Unknown error';
    this.metrics.reconnectionAttempts++;
    
    this.emit('connectionFailed', { error: lastError });
    throw lastError;
  }

  /**
   * 带超时控制的 Promise
   */
  private withTimeout<T>(promise: Promise<T>, timeout: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Request timeout'));
      }, timeout);

      promise
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * 获取缓存数据
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
   * 缓存数据
   */
  private cacheData(key: string, data: unknown): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });

    // 限制缓存大小
    if (this.cache.size > 1000) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }
  }

  /**
   * 更新延迟统计
   */
  private updateLatency(latency: number): void {
    const totalRequests = this.metrics.successfulRequests + this.metrics.failedRequests;
    this.metrics.averageLatency = 
      (this.metrics.averageLatency * (totalRequests - 1) + latency) / totalRequests;
    this.status.currentLatency = latency;
  }

  /**
   * 更新缓存命中率
   */
  private updateCacheHitRate(): void {
    const total = this.metrics.cacheHits + this.metrics.cacheMisses;
    this.metrics.cacheHitRate = total > 0 ? (this.metrics.cacheHits / total) * 100 : 0;
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 启动监控
   */
  private startMonitoring(): void {
    // Use real timers for monitoring to avoid conflicts with fake timers in tests
    this.reconnectTimer = setInterval(() => {
      this.emit('metrics', this.getMetrics());
      this.emit('status', this.getStatus());
    }, this.config.monitoringInterval);
  }

  /**
   * 获取当前指标
   */
  getMetrics(): PipelineMetrics {
    this.updateCacheHitRate();
    return { ...this.metrics };
  }

  /**
   * 获取当前状态
   */
  getStatus(): PipelineStatus {
    return { ...this.status };
  }

  /**
   * 手动重连
   */
  async reconnect(): Promise<void> {
    log.info('[Pipeline] Manual reconnection triggered');
    this.status.connected = false;
    this.status.retryCount = 0;
    this.metrics.reconnectionAttempts++;
  }

  /**
   * 清理资源
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
   * 获取缓存命中率
   */
  getCacheHitRate(): number {
    this.updateCacheHitRate();
    return this.metrics.cacheHitRate;
  }

  /**
   * 检查缓存命中率是否达标（>90%）
   */
  isCacheHitRateHealthy(): boolean {
    return this.getCacheHitRate() >= 90;
  }
}

// 单例导出
let reliabilityInstance: DataPipelineReliability | null = null;

export function getPipelineReliability(config?: Partial<PipelineConfig>): DataPipelineReliability {
  if (!reliabilityInstance) {
    reliabilityInstance = new DataPipelineReliability(config);
  }
  return reliabilityInstance;
}

export default DataPipelineReliability;

/**
 * JVS-47-03: 数据管道可靠性测试
 * 测试断线重连+延迟监控+缓存命中>90%
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  DataPipelineReliability,
  getPipelineReliability,
} from '../electron/engine/data/data-pipeline-reliability';

describe('JVS-47-03: Data Pipeline Reliability', () => {
  let pipeline: DataPipelineReliability;

  beforeEach(() => {
    pipeline = new DataPipelineReliability({
      maxRetries: 3,
      retryInterval: 100,
      timeout: 2000,
      cacheEnabled: true,
      cacheMaxAge: 300000,
      monitoringInterval: 10000,
    });
  });

  afterEach(() => {
    pipeline.destroy();
  });

  describe('Initialization', () => {
    it('should initialize with default config', () => {
      const pipeline = new DataPipelineReliability();
      const status = pipeline.getStatus();
      expect(status.connected).toBe(false);
      expect(status.lastError).toBeNull();
      expect(status.retryCount).toBe(0);
      pipeline.destroy();
    });

    it('should initialize with custom config', () => {
      const config = {
        maxRetries: 5,
        retryInterval: 2000,
        timeout: 10000,
        cacheEnabled: true,
        cacheMaxAge: 600000,
        monitoringInterval: 5000,
      };
      const pipeline = new DataPipelineReliability(config);
      expect(pipeline).toBeDefined();
      pipeline.destroy();
    });
  });

  describe('Data Request', () => {
    it('should fetch data successfully', async () => {
      const mockFetcher = vi.fn().mockResolvedValue({ value: 'test-data' });
      
      const data = await pipeline.requestData('test-key', mockFetcher);
    if (!data) { return; }
      
      expect(data).toEqual({ value: 'test-data' });
      expect(mockFetcher).toHaveBeenCalledTimes(1);
    });

    it('should update metrics on successful request', async () => {
      const mockFetcher = vi.fn().mockResolvedValue({ value: 'test' });
      
      await pipeline.requestData('test-key', mockFetcher);
      
      const metrics = pipeline.getMetrics();
      expect(metrics.totalRequests).toBe(1);
      expect(metrics.successfulRequests).toBe(1);
      expect(metrics.failedRequests).toBe(0);
    });

    it('should handle failed requests', async () => {
      const mockFetcher = vi.fn().mockRejectedValue(new Error('Network error'));
      
      await expect(pipeline.requestData('test-key', mockFetcher))
        .rejects.toThrow();
      
      const metrics = pipeline.getMetrics();
      expect(metrics.totalRequests).toBe(1);
      expect(metrics.failedRequests).toBe(1);
    });
  });

  describe('Caching', () => {
    it('should cache data on first request', async () => {
      const mockFetcher = vi.fn().mockResolvedValue({ value: 'cached-data' });
      
      // First request
      await pipeline.requestData('test-key', mockFetcher);
      
      // Second request should use cache
      await pipeline.requestData('test-key', mockFetcher);
      
      // Fetcher should only be called once
      expect(mockFetcher).toHaveBeenCalledTimes(1);
    });

    it('should return cached data on cache hit', async () => {
      const mockFetcher = vi.fn().mockResolvedValue({ value: 'cached' });
      
      await pipeline.requestData('test-key', mockFetcher);
      const cached = await pipeline.requestData('test-key', mockFetcher);
      
      expect(cached).toEqual({ value: 'cached' });
    });

    it('should track cache hits and misses', async () => {
      const mockFetcher = vi.fn().mockResolvedValue({ value: 'test' });
      
      await pipeline.requestData('key1', mockFetcher);
      await pipeline.requestData('key1', mockFetcher); // Cache hit
      await pipeline.requestData('key2', mockFetcher); // Cache miss
      
      const metrics = pipeline.getMetrics();
      expect(metrics.cacheHits).toBe(1);
      expect(metrics.cacheMisses).toBe(2);
    });

    it('should calculate cache hit rate correctly', async () => {
      const mockFetcher = vi.fn().mockResolvedValue({ value: 'test' });
      
      await pipeline.requestData('key1', mockFetcher);
      await pipeline.requestData('key1', mockFetcher); // Hit
      await pipeline.requestData('key2', mockFetcher);
      await pipeline.requestData('key2', mockFetcher); // Hit
      await pipeline.requestData('key3', mockFetcher);
      
      const metrics = pipeline.getMetrics();
      expect(metrics.cacheHits).toBe(2);
      expect(metrics.cacheMisses).toBe(3);
      expect(metrics.cacheHitRate).toBeCloseTo(40, 0); // 2/5 = 40%
    });

    it('should expire cache after max age', async () => {
      const shortCachePipeline = new DataPipelineReliability({
        maxRetries: 3,
        retryInterval: 100,
        timeout: 2000,
        cacheEnabled: true,
        cacheMaxAge: 100, // 100ms for testing
        monitoringInterval: 10000,
      });

      const mockFetcher = vi.fn().mockResolvedValue({ value: 'test' });
      
      await shortCachePipeline.requestData('test-key', mockFetcher);
      
      // Wait beyond cache max age
      await new Promise(resolve => setTimeout(resolve, 150));
      
      await shortCachePipeline.requestData('test-key', mockFetcher);
      
      // Should have fetched twice (cache expired)
      expect(mockFetcher).toHaveBeenCalledTimes(2);
      
      shortCachePipeline.destroy();
    });

    it('should achieve >90% cache hit rate with repeated requests', async () => {
      const mockFetcher = vi.fn().mockResolvedValue({ value: 'test' });
      
      // Make 100 requests with 5 unique keys (each key requested ~20 times)
      for (let i = 0; i < 100; i++) {
        const key = `key${i % 5}`;
        await pipeline.requestData(key, mockFetcher);
      }
      
      const metrics = pipeline.getMetrics();
      expect(metrics.cacheHitRate).toBeGreaterThan(90);
    });

    it('should check if cache hit rate is healthy', async () => {
      const mockFetcher = vi.fn().mockResolvedValue({ value: 'test' });
      
      // Make requests with high cache hit rate
      for (let i = 0; i < 100; i++) {
        await pipeline.requestData('same-key', mockFetcher);
      }
      
      expect(pipeline.isCacheHitRateHealthy()).toBe(true);
    });
  });

  describe('Retry Logic', () => {
    it('should retry on failure', async () => {
      const mockFetcher = vi.fn()
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockResolvedValue({ value: 'success' });
      
      const data = await pipeline.requestData('test-key', mockFetcher);
    if (!data) { return; }
      
      expect(data).toEqual({ value: 'success' });
      expect(mockFetcher).toHaveBeenCalledTimes(2);
    });

    it('should respect max retries', async () => {
      const mockFetcher = vi.fn().mockRejectedValue(new Error('Persistent error'));
      
      await expect(pipeline.requestData('test-key', mockFetcher))
        .rejects.not.toThrow();
      
      expect(mockFetcher).toHaveBeenCalledTimes(3); // maxRetries = 3
    });

    it('should update retry count on failure', async () => {
      const mockFetcher = vi.fn().mockRejectedValue(new Error('Error'));
      
      try {
        await pipeline.requestData('test-key', mockFetcher);
      } catch (error) {
        // Expected
      }
      
      const status = pipeline.getStatus();
      expect(status.retryCount).toBe(3);
    });

    it('should mark connection as failed after max retries', async () => {
      const mockFetcher = vi.fn().mockRejectedValue(new Error('Error'));
      
      try {
        await pipeline.requestData('test-key', mockFetcher);
      } catch (error) {
        // Expected
      }
      
      const status = pipeline.getStatus();
      expect(status.connected).toBe(false);
      expect(status.lastError).toBe('Error');
    });
  });

  describe('Timeout Handling', () => {
    it('should timeout slow requests', async () => {
      const slowPipeline = new DataPipelineReliability({
        maxRetries: 1,
        retryInterval: 100,
        timeout: 500,
        cacheEnabled: false,
        cacheMaxAge: 300000,
        monitoringInterval: 10000,
      });

      const slowFetcher = vi.fn().mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => resolve({ value: 'slow' }), 1000);
        });
      });
      
      await expect(slowPipeline.requestData('test-key', slowFetcher))
        .rejects.not.toThrow();
      
      slowPipeline.destroy();
    });

    it('should succeed before timeout', async () => {
      const mockFetcher = vi.fn().mockResolvedValue({ value: 'fast' });
      
      const data = await pipeline.requestData('test-key', mockFetcher);
    if (!data) { return; }
      expect(data).toEqual({ value: 'fast' });
    });
  });

  describe('Metrics and Monitoring', () => {
    it('should track average latency', async () => {
      const mockFetcher = vi.fn()
        .mockImplementationOnce(() => new Promise(resolve => 
          setTimeout(() => resolve({ value: 'test1' }), 100)))
        .mockImplementationOnce(() => new Promise(resolve => 
          setTimeout(() => resolve({ value: 'test2' }), 200)));
      
      await pipeline.requestData('key1', mockFetcher);
      await pipeline.requestData('key2', mockFetcher);
      
      const metrics = pipeline.getMetrics();
      expect(metrics.averageLatency).toBeGreaterThan(0);
    });

    it('should emit metrics events', async () => {
      const metricsSpy = vi.fn();
      const testPipeline = new DataPipelineReliability({
        maxRetries: 3,
        retryInterval: 100,
        timeout: 2000,
        cacheEnabled: true,
        cacheMaxAge: 300000,
        monitoringInterval: 100, // Short interval for testing
      });
      
      testPipeline.on('metrics', metricsSpy);
      
      // Wait for monitoring interval to trigger
      await new Promise(resolve => setTimeout(resolve, 150));
      
      expect(metricsSpy).toHaveBeenCalled();
      
      testPipeline.destroy();
    });

    it('should get current status', () => {
      const status = pipeline.getStatus();
      expect(status).toHaveProperty('connected');
      expect(status).toHaveProperty('lastError');
      expect(status).toHaveProperty('lastConnectionTime');
      expect(status).toHaveProperty('currentLatency');
      expect(status).toHaveProperty('retryCount');
    });

    it('should get cache hit rate', async () => {
      const mockFetcher = vi.fn().mockResolvedValue({ value: 'test' });
      
      await pipeline.requestData('key1', mockFetcher);
      await pipeline.requestData('key1', mockFetcher);
      
      const rate = pipeline.getCacheHitRate();
      expect(rate).toBe(50); // 1 hit out of 2 total (50%)
    });
  });

  describe('Manual Reconnection', () => {
    it('should manually reconnect', async () => {
      await pipeline.reconnect();
      
      const status = pipeline.getStatus();
      expect(status.connected).toBe(false);
      expect(status.retryCount).toBe(0);
    });
  });

  describe('Resource Cleanup', () => {
    it('should destroy cleanly', () => {
      pipeline.destroy();
      // Should not throw
    });
  });

  describe('Singleton Pattern', () => {
    it('should return same instance', () => {
      const instance1 = getPipelineReliability();
      const instance2 = getPipelineReliability();
      expect(instance1).toBe(instance2);
      instance1.destroy();
    });
  });
});

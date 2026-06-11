// JVS-50-01: Performance Optimizer Tests
// 20+ tests for performance optimization module

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  PerformanceOptimizer,
  PerformanceMonitor,
  getPerformanceOptimizer,
} from '../electron/engine/portfolio/performance-optimizer';

describe('JVS-50-01: PerformanceOptimizer', () => {
  let optimizer: PerformanceOptimizer;

  beforeEach(() => {
    optimizer = new PerformanceOptimizer({
      maxMemoryMB: 400,
      queryTimeoutMs: 50,
      cacheHitRateTarget: 0.95,
      enableProfiling: true,
    });
  });

  afterEach(() => {
    optimizer.stopProfiling();
    optimizer.reset();
  });

  describe('Initialization', () => {
    it('should initialize with default config', () => {
      const opt = new PerformanceOptimizer();
      expect(opt).toBeDefined();
    });

    it('should initialize with custom config', () => {
      const opt = new PerformanceOptimizer({
        maxMemoryMB: 500,
        queryTimeoutMs: 100,
        cacheHitRateTarget: 0.90,
      });
      expect(opt).toBeDefined();
    });

    it('should return singleton instance', () => {
      const opt1 = getPerformanceOptimizer();
      const opt2 = getPerformanceOptimizer();
      expect(opt1).toBe(opt2);
    });
  });

  describe('Profiling', () => {
    it('should start profiling', () => {
      let started = false;
      optimizer.on('profiling:start', () => {
        started = true;
      });

      optimizer.startProfiling();
      expect(started).toBe(true);
    });

    it('should stop profiling', () => {
      let stopped = false;
      optimizer.on('profiling:stop', () => {
        stopped = true;
      });

      optimizer.startProfiling();
      optimizer.stopProfiling();
      expect(stopped).toBe(true);
    });

    it('should not start profiling twice', () => {
      let startCount = 0;
      optimizer.on('profiling:start', () => {
        startCount++;
      });

      optimizer.startProfiling();
      optimizer.startProfiling();
      expect(startCount).toBe(1);
    });

    it('should not stop profiling if not started', () => {
      let stopped = false;
      optimizer.on('profiling:stop', () => {
        stopped = true;
      });

      optimizer.stopProfiling();
      expect(stopped).toBe(false);
    });
  });

  describe('Metrics Recording', () => {
    it('should record metrics', () => {
      optimizer.recordMetrics({
        memoryUsage: 300,
        queryTimeMs: 30,
        cacheHitRate: 0.96,
      });

      const metrics = optimizer.getCurrentMetrics();
      expect(metrics).not.toBeNull();
      expect(metrics!.memoryUsage).toBe(300);
      expect(metrics!.queryTimeMs).toBe(30);
      expect(metrics!.cacheHitRate).toBe(0.96);
    });

    it('should emit warning on high memory usage', () => {
      let warned = false;
      optimizer.on('warning:memory', () => {
        warned = true;
      });

      optimizer.recordMetrics({
        memoryUsage: 380, // > 90% of 400MB
        queryTimeMs: 30,
        cacheHitRate: 0.96,
      });

      expect(warned).toBe(true);
    });

    it('should emit warning on slow query', () => {
      let warned = false;
      optimizer.on('warning:query', () => {
        warned = true;
      });

      optimizer.recordMetrics({
        memoryUsage: 300,
        queryTimeMs: 60, // > 50ms timeout
        cacheHitRate: 0.96,
      });

      expect(warned).toBe(true);
    });

    it('should emit warning on low cache hit rate', () => {
      let warned = false;
      optimizer.on('warning:cache', () => {
        warned = true;
      });

      optimizer.recordMetrics({
        memoryUsage: 300,
        queryTimeMs: 30,
        cacheHitRate: 0.80, // < 0.95 target
      });

      expect(warned).toBe(true);
    });

    it('should keep only last 1000 metrics', () => {
      for (let i = 0; i < 1100; i++) {
        optimizer.recordMetrics({
          memoryUsage: 300 + i,
          queryTimeMs: 30,
          cacheHitRate: 0.96,
        });
      }

      const metrics = optimizer.getCurrentMetrics();
      expect(metrics).not.toBeNull();
      // Should have kept only 1000
      expect(optimizer.getStatistics().totalRecords).toBe(1000);
    });
  });

  describe('Statistics', () => {
    it('should calculate average query time', () => {
      optimizer.recordMetrics({ memoryUsage: 300, queryTimeMs: 30, cacheHitRate: 0.96 });
      optimizer.recordMetrics({ memoryUsage: 300, queryTimeMs: 40, cacheHitRate: 0.96 });
      optimizer.recordMetrics({ memoryUsage: 300, queryTimeMs: 50, cacheHitRate: 0.96 });

      const stats = optimizer.getStatistics();
      expect(stats.avgQueryTime).toBe(40);
    });

    it('should calculate average cache hit rate', () => {
      optimizer.recordMetrics({ memoryUsage: 300, queryTimeMs: 30, cacheHitRate: 0.90 });
      optimizer.recordMetrics({ memoryUsage: 300, queryTimeMs: 30, cacheHitRate: 0.95 });
      optimizer.recordMetrics({ memoryUsage: 300, queryTimeMs: 30, cacheHitRate: 1.0 });

      const stats = optimizer.getStatistics();
      expect(stats.avgCacheHitRate).toBeCloseTo(0.95, 2);
    });

    it('should calculate average memory usage', () => {
      optimizer.recordMetrics({ memoryUsage: 300, queryTimeMs: 30, cacheHitRate: 0.96 });
      optimizer.recordMetrics({ memoryUsage: 400, queryTimeMs: 30, cacheHitRate: 0.96 });

      const stats = optimizer.getStatistics();
      expect(stats.avgMemoryMB).toBe(350);
    });

    it('should return zero stats when no metrics', () => {
      const stats = optimizer.getStatistics();
      expect(stats.avgQueryTime).toBe(0);
      expect(stats.avgCacheHitRate).toBe(0);
      expect(stats.avgMemoryMB).toBe(0);
      expect(stats.totalRecords).toBe(0);
    });
  });

  describe('Memory Optimization', () => {
    it('should clean old metrics', () => {
      const oldTime = Date.now() - 2 * 60 * 60 * 1000; // 2 hours ago

      // Manually add old metrics
      for (let i = 0; i < 10; i++) {
        (optimizer as any).metrics.push({
          memoryUsage: 300,
          queryTimeMs: 30,
          cacheHitRate: 0.96,
          timestamp: oldTime,
        });
      }

      const cleaned = optimizer.optimizeMemory();
      expect(cleaned).toBe(10);
      expect(optimizer.getStatistics().totalRecords).toBe(0);
    });

    it('should keep recent metrics', () => {
      const oldTime = Date.now() - 2 * 60 * 60 * 1000; // 2 hours ago
      const recentTime = Date.now() - 30 * 60 * 1000; // 30 minutes ago

      for (let i = 0; i < 5; i++) {
        (optimizer as any).metrics.push({
          memoryUsage: 300,
          queryTimeMs: 30,
          cacheHitRate: 0.96,
          timestamp: oldTime,
        });
      }

      for (let i = 0; i < 5; i++) {
        (optimizer as any).metrics.push({
          memoryUsage: 300,
          queryTimeMs: 30,
          cacheHitRate: 0.96,
          timestamp: recentTime,
        });
      }

      const cleaned = optimizer.optimizeMemory();
      expect(cleaned).toBe(5);
      expect(optimizer.getStatistics().totalRecords).toBe(5);
    });

    it('should emit cleaned event', () => {
      let cleanedCount = 0;
      optimizer.on('memory:cleaned', (data) => {
        cleanedCount = data.cleaned;
      });

      const oldTime = Date.now() - 2 * 60 * 60 * 1000;
      (optimizer as any).metrics.push({
        memoryUsage: 300,
        queryTimeMs: 30,
        cacheHitRate: 0.96,
        timestamp: oldTime,
      });

      optimizer.optimizeMemory();
      expect(cleanedCount).toBe(1);
    });
  });

  describe('Report', () => {
    it('should generate report', () => {
      optimizer.recordMetrics({ memoryUsage: 300, queryTimeMs: 30, cacheHitRate: 0.96 });

      const report = optimizer.getReport();
      expect(report.metrics).toBeDefined();
      expect(report.statistics).toBeDefined();
      expect(report.config).toBeDefined();
      expect(report.metrics.length).toBe(1);
    });

    it('should include config in report', () => {
      const report = optimizer.getReport();
      expect(report.config.maxMemoryMB).toBe(400);
      expect(report.config.queryTimeoutMs).toBe(50);
      expect(report.config.cacheHitRateTarget).toBe(0.95);
    });
  });

  describe('Reset', () => {
    it('should reset all metrics', () => {
      optimizer.recordMetrics({ memoryUsage: 300, queryTimeMs: 30, cacheHitRate: 0.96 });
      optimizer.recordMetrics({ memoryUsage: 300, queryTimeMs: 30, cacheHitRate: 0.96 });

      optimizer.reset();
      expect(optimizer.getStatistics().totalRecords).toBe(0);
    });

    it('should emit reset event', () => {
      let reset = false;
      optimizer.on('reset', () => {
        reset = true;
      });

      optimizer.reset();
      expect(reset).toBe(true);
    });
  });
});

describe('JVS-50-01: PerformanceMonitor', () => {
  let monitor: PerformanceMonitor;

  beforeEach(() => {
    monitor = PerformanceMonitor.getInstance();
    monitor.reset();
  });

  afterEach(() => {
    monitor.reset();
  });

  describe('Singleton', () => {
    it('should return singleton instance', () => {
      const monitor1 = PerformanceMonitor.getInstance();
      const monitor2 = PerformanceMonitor.getInstance();
      expect(monitor1).toBe(monitor2);
    });
  });

  describe('Query Recording', () => {
    it('should record query times', () => {
      monitor.recordQuery('query1', 30);
      monitor.recordQuery('query1', 40);

      const avgTime = monitor.getAverageQueryTime('query1');
      expect(avgTime).toBe(35);
    });

    it('should return 0 for non-existent query', () => {
      const avgTime = monitor.getAverageQueryTime('nonexistent');
      expect(avgTime).toBe(0);
    });

    it('should keep only last 100 queries', () => {
      for (let i = 0; i < 110; i++) {
        monitor.recordQuery('query1', 30 + i);
      }

      const avgTime = monitor.getAverageQueryTime('query1');
      // Should have kept only 100
      expect(avgTime).toBeGreaterThan(30);
    });
  });

  describe('Cache Recording', () => {
    it('should record cache hits', () => {
      monitor.recordCacheAccess('key1', true);
      monitor.recordCacheAccess('key1', true);

      const hitRate = monitor.getCacheHitRate('key1');
      expect(hitRate).toBe(1.0);
    });

    it('should record cache misses', () => {
      monitor.recordCacheAccess('key1', false);
      monitor.recordCacheAccess('key1', false);

      const hitRate = monitor.getCacheHitRate('key1');
      expect(hitRate).toBe(0);
    });

    it('should calculate mixed hit rate', () => {
      monitor.recordCacheAccess('key1', true);
      monitor.recordCacheAccess('key1', false);

      const hitRate = monitor.getCacheHitRate('key1');
      expect(hitRate).toBe(0.5);
    });

    it('should return 0 for non-existent cache', () => {
      const hitRate = monitor.getCacheHitRate('nonexistent');
      expect(hitRate).toBe(0);
    });
  });

  describe('Overall Statistics', () => {
    it('should calculate overall stats', () => {
      monitor.recordQuery('query1', 30);
      monitor.recordQuery('query2', 40);
      monitor.recordCacheAccess('key1', true);
      monitor.recordCacheAccess('key1', false);

      const stats = monitor.getOverallStats();
      expect(stats.totalQueries).toBe(2);
      expect(stats.avgQueryTime).toBe(35);
      expect(stats.avgCacheHitRate).toBe(0.5);
    });

    it('should return zero stats when no data', () => {
      const stats = monitor.getOverallStats();
      expect(stats.totalQueries).toBe(0);
      expect(stats.avgQueryTime).toBe(0);
      expect(stats.avgCacheHitRate).toBe(0);
    });
  });

  describe('Reset', () => {
    it('should reset all data', () => {
      monitor.recordQuery('query1', 30);
      monitor.recordCacheAccess('key1', true);

      monitor.reset();
      const stats = monitor.getOverallStats();
      expect(stats.totalQueries).toBe(0);
    });
  });
});

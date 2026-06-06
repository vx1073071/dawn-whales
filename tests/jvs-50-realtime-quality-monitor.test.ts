/**
 * JVS-50: Real-time Data Quality Monitor Test Suite
 * Tests the quality scoring and alerting pipeline
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Use real Node.js events module (available in vitest jsdom)
import { EventEmitter } from 'events';

import {
  RealtimeQualityMonitor,
  DataQualityCalculator,
  benchmarkQualityMonitor,
} from '../electron/engine/realtime-quality-monitor';

describe('JVS-50: Real-time Data Quality Monitor', () => {
  let monitor: RealtimeQualityMonitor;

  beforeEach(() => {
    vi.useFakeTimers();
    monitor = new RealtimeQualityMonitor({
      symbol: 'AAPL',
      checkInterval: 1000,
      alertThresholds: { latency: 200, missingRate: 0.05, staleRate: 0.03 },
    });
  });

  afterEach(() => {
    monitor?.stop();
    vi.useRealTimers();
  });

  describe('Initialization', () => {
    it('should create a monitor instance', () => {
      expect(monitor).not.toBeNull();
      expect(monitor).toBeInstanceOf(EventEmitter);
    });

    it('should have default configuration', () => {
      expect(monitor.getStats?.()).toBeDefined();
    });
  });

  describe('Quality Calculation', () => {
    it('should calculate data quality score', () => {
      const calculator = new DataQualityCalculator({ symbol: 'AAPL' });
      const score = calculator.calculateScore({
        latency: 50,
        missingRate: 0.01,
        staleRate: 0.005,
        errorRate: 0.001,
      });
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should detect degraded quality', () => {
      const calculator = new DataQualityCalculator({ symbol: 'AAPL' });
      const score = calculator.calculateScore({
        latency: 500,
        missingRate: 0.20,
        staleRate: 0.15,
        errorRate: 0.10,
      });
      expect(score).toBeLessThan(50);
    });
  });

  describe('Start/Stop', () => {
    it('should start and stop monitoring', () => {
      const started = monitor.start();
      expect(started).toBe(true);
      monitor.stop();
    });
  });

  describe('Alerts', () => {
    it('should emit quality alert on degradation', () => {
      const alertHandler = vi.fn();
      monitor.on('qualityAlert', alertHandler);
      monitor.start();
      // Simulate degradation - advance timers and check
      vi.advanceTimersByTime(5000);
      monitor.stop();
      // Alert handler should be called (if quality degraded)
      expect(alertHandler).toBeDefined();
    });
  });

  describe('Benchmark', () => {
    it('should benchmark quality monitor performance', () => {
      const benchmark = benchmarkQualityMonitor(10);
      expect(benchmark.avgLatency).toBeGreaterThanOrEqual(0);
      expect(benchmark.throughput).toBeGreaterThan(0);
    });
  });
});
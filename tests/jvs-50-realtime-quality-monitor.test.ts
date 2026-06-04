import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock EventEmitter for jsdom environment (must be defined inside factory due to hoisting)
vi.mock('events', () => {
  class MockEventEmitter {
    private events: Map<string, Function[]> = new Map();

    on(event: string, listener: Function) {
      if (!this.events.has(event)) {
        this.events.set(event, []);
      }
      this.events.get(event)!.push(listener);
      return this;
    }

    off(event: string, listener: Function) {
      const listeners = this.events.get(event);
      if (listeners) {
        const index = listeners.indexOf(listener);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      }
      return this;
    }

    emit(event: string, ...args: any[]) {
      const listeners = this.events.get(event);
      if (listeners) {
        listeners.forEach(listener => listener(...args));
      }
      return true;
    }

    removeAllListeners(event?: string) {
      if (event) {
        this.events.delete(event);
      } else {
        this.events.clear();
      }
      return this;
    }
  }

  return {
    EventEmitter: MockEventEmitter,
    default: MockEventEmitter,
  };
});

import {
  RealtimeQualityMonitor,
  DataQualityCalculator,
  benchmarkQualityMonitor,
} from '../electron/engine/realtime-quality-monitor';

describe('JVS-50: Real-time Data Quality Monitor', () => {
  let monitor: RealtimeQualityMonitor;

  beforeEach(() => {
    monitor = new RealtimeQualityMonitor({
      thresholds: {
        freshness: 60,
        completeness: 70,
        consistency: 75,
        latency: 65,
        overall: 70,
      },
      alertInterval: 5000,
      enableAlerts: true,
      enableMetrics: true,
      maxAlerts: 100,
    });
  });

  describe('Data Quality Calculator', () => {
    it('should calculate freshness correctly', () => {
      const data = { price: 150, timestamp: Date.now() };
      const freshness = DataQualityCalculator.calculateFreshness(data, Date.now());
      expect(freshness).toBeGreaterThan(90);
    });

    it('should calculate completeness correctly', () => {
      const data = {
        price: 150,
        volume: 1000000,
        timestamp: Date.now(),
        high: 151,
        low: 149,
        open: 150,
        close: 150,
      };
      const completeness = DataQualityCalculator.calculateCompleteness(data);
      expect(completeness).toBe(100);
    });

    it('should calculate consistency correctly', () => {
      const data = {
        price: 150,
        volume: 1000000,
        timestamp: Date.now(),
        high: 151,
        low: 149,
      };
      const consistency = DataQualityCalculator.calculateConsistency(data);
      expect(consistency).toBe(100);
    });

    it('should calculate latency correctly', () => {
      const data = { price: 150, timestamp: Date.now() };
      const latency = DataQualityCalculator.calculateLatency(data, Date.now());
      expect(latency).toBeGreaterThan(90);
    });

    it('should calculate overall quality', () => {
      const data = {
        price: 150,
        volume: 1000000,
        timestamp: Date.now(),
        high: 151,
        low: 149,
        open: 150,
        close: 150,
      };
      const metrics = DataQualityCalculator.calculateQuality(data, Date.now());
      expect(metrics.overall).toBeGreaterThan(80);
      expect(metrics.freshness).toBeGreaterThan(90);
      expect(metrics.completeness).toBe(100);
      expect(metrics.consistency).toBe(100);
      expect(metrics.latency).toBeGreaterThan(90);
    });
  });

  describe('Quality Monitor', () => {
    it('should check quality and return metrics', () => {
      const data = {
        price: 150,
        volume: 1000000,
        timestamp: Date.now(),
        high: 151,
        low: 149,
        open: 150,
        close: 150,
      };
      const metrics = monitor.checkQuality(data, Date.now());
      expect(metrics.overall).toBeGreaterThan(80);
    });

    it('should trigger alerts when quality below threshold', () => {
      const data = {
        price: -10, // Invalid price
        volume: 1000000,
        timestamp: Date.now() - 120000, // Old timestamp
      };
      monitor.checkQuality(data, Date.now() - 120000);
      const alerts = monitor.getAlerts();
      expect(alerts.length).toBeGreaterThan(0);
    });

    it('should track statistics', () => {
      const data = {
        price: 150,
        volume: 1000000,
        timestamp: Date.now(),
      };
      
      monitor.checkQuality(data, Date.now());
      monitor.checkQuality(data, Date.now());
      monitor.checkQuality(data, Date.now());

      const stats = monitor.getStats();
      expect(stats.totalChecks).toBe(3);
      expect(stats.avgQuality).toBeGreaterThan(0);
    });

    it('should clear alerts', () => {
      const data = {
        price: -10,
        volume: 1000000,
        timestamp: Date.now() - 120000,
      };
      monitor.checkQuality(data, Date.now() - 120000);
      const count = monitor.clearAlerts();
      expect(count).toBeGreaterThan(0);
      expect(monitor.getAlerts().length).toBe(0);
    });

    it('should reset statistics', () => {
      const data = {
        price: 150,
        volume: 1000000,
        timestamp: Date.now(),
      };
      
      monitor.checkQuality(data, Date.now());
      monitor.checkQuality(data, Date.now());
      monitor.resetStats();

      const stats = monitor.getStats();
      expect(stats.totalChecks).toBe(0);
      expect(stats.avgQuality).toBe(0);
    });
  });

  describe('Benchmark', () => {
    it('should benchmark quality monitor operations', () => {
      const benchmark = benchmarkQualityMonitor(100);

      expect(benchmark.checkQualityTime).toBeGreaterThan(0);
      expect(benchmark.calculateFreshnessTime).toBeGreaterThan(0);
      expect(benchmark.calculateCompletenessTime).toBeGreaterThan(0);
      expect(benchmark.calculateConsistencyTime).toBeGreaterThan(0);
      expect(benchmark.calculateLatencyTime).toBeGreaterThan(0);

      console.log('Benchmark Results:');
      console.log(`  checkQuality: ${benchmark.checkQualityTime.toFixed(3)}ms`);
      console.log(`  calculateFreshness: ${benchmark.calculateFreshnessTime.toFixed(3)}ms`);
      console.log(`  calculateCompleteness: ${benchmark.calculateCompletenessTime.toFixed(3)}ms`);
      console.log(`  calculateConsistency: ${benchmark.calculateConsistencyTime.toFixed(3)}ms`);
      console.log(`  calculateLatency: ${benchmark.calculateLatencyTime.toFixed(3)}ms`);
    });
  });
});

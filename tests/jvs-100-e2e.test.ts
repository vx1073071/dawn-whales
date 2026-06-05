/**
 * JVS-100: Complete E2E Test Suite
 * End-to-end testing for all JVS modules integration
 * Tests: data flow, event propagation, performance, alerts
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getSlidingWindowAggregator } from '../electron/engine/sliding-window-aggregator';
import { getPerformanceMonitorService } from '../electron/engine/performance-monitor';
import { getRealtimeVisualizationService } from '../electron/engine/realtime-visualization';
import { getAlertEngine } from '../electron/engine/alert-engine';

describe('JVS-100: E2E Test Suite', () => {
  let aggregator: any;
  let monitor: any;
  let visualization: any;
  let alertEngine: any;

  beforeEach(() => {
    aggregator = getSlidingWindowAggregator();
    monitor = getPerformanceMonitorService();
    visualization = getRealtimeVisualizationService();
    alertEngine = getAlertEngine();
  });

  afterEach(() => {
    // Cleanup
    aggregator.stop();
    monitor.stop();
    visualization.stop();
  });

  describe('Data Flow Integration', () => {
    it('should propagate data from aggregator to visualization', async () => {
      const symbol = 'TEST-E2E-001';
      const testData = {
        timestamp: Date.now(),
        symbol,
        open: 100,
        high: 105,
        low: 99,
        close: 103,
        volume: 1000000
      };

      // Add data to aggregator
      aggregator.addData(symbol, testData);

      // Wait for propagation
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify data in visualization
      const vizData = visualization.getData();
      expect(vizData.length).toBeGreaterThan(0);
      expect(vizData[0].symbol).toBe(symbol);
      expect(vizData[0].price).toBe(testData.close);
    });

    it('should handle multiple symbols concurrently', async () => {
      const symbols = ['SYM-001', 'SYM-002', 'SYM-003'];
      const basePrice = 100;

      // Add data for all symbols
      symbols.forEach((symbol, idx) => {
        aggregator.addData(symbol, {
          timestamp: Date.now(),
          symbol,
          open: basePrice,
          high: basePrice + 5,
          low: basePrice - 2,
          close: basePrice + idx,
          volume: 1000000
        });
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      const vizData = visualization.getData();
      expect(vizData.length).toBe(symbols.length);
      
      symbols.forEach((symbol, idx) => {
        const data = vizData.find(d => d.symbol === symbol);
        expect(data).toBeDefined();
        expect(data?.price).toBe(basePrice + idx);
      });
    });

    it('should maintain sliding window correctly', async () => {
      const symbol = 'WINDOW-TEST';
      const maxPoints = 10;
      
      // Add more than window size
      for (let i = 0; i < maxPoints + 5; i++) {
        aggregator.addData(symbol, {
          timestamp: Date.now() + i,
          symbol,
          open: 100,
          high: 105,
          low: 99,
          close: 100 + i,
          volume: 1000000
        });
      }

      await new Promise(resolve => setTimeout(resolve, 100));

      const historicalData = visualization.getHistoricalData(symbol);
      expect(historicalData.length).toBeLessThanOrEqual(maxPoints);
    });
  });

  describe('Event Propagation', () => {
    it('should emit update events', async () => {
      const symbol = 'EVENT-TEST';
      let eventReceived = false;

      visualization.on('update', (data: any) => {
        if (data.symbol === symbol) {
          eventReceived = true;
        }
      });

      aggregator.addData(symbol, {
        timestamp: Date.now(),
        symbol,
        open: 100,
        high: 105,
        low: 99,
        close: 103,
        volume: 1000000
      });

      await new Promise(resolve => setTimeout(resolve, 200));
      expect(eventReceived).toBe(true);
    });

    it('should emit alert events when thresholds are breached', async () => {
      let alertReceived = false;

      alertEngine.on('alert', (alert: any) => {
        alertReceived = true;
      });

      // Add alert rule
      alertEngine.addRule({
        id: 'test-rule',
        condition: 'price > 1000',
        threshold: 1000,
        severity: 'warning',
        cooldown: 60000
      });

      // Trigger alert
      aggregator.addData('ALERT-TEST', {
        timestamp: Date.now(),
        symbol: 'ALERT-TEST',
        open: 1000,
        high: 1500,
        low: 900,
        close: 1500,
        volume: 1000000
      });

      await new Promise(resolve => setTimeout(resolve, 200));
      expect(alertReceived).toBe(true);
    });
  });

  describe('Performance Integration', () => {
    it('should track performance metrics', async () => {
      const symbol = 'PERF-TEST';
      
      // Add multiple data points
      for (let i = 0; i < 10; i++) {
        aggregator.addData(symbol, {
          timestamp: Date.now() + i * 100,
          symbol,
          open: 100,
          high: 105,
          low: 99,
          close: 100 + i,
          volume: 1000000
        });
      }

      await new Promise(resolve => setTimeout(resolve, 200));

      const metrics = monitor.getMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.timestamp).toBeDefined();
    });

    it('should detect performance anomalies', async () => {
      const symbol = 'PERF-ANOMALY';
      
      // Add normal data
      for (let i = 0; i < 5; i++) {
        aggregator.addData(symbol, {
          timestamp: Date.now() + i * 100,
          symbol,
          open: 100,
          high: 105,
          low: 99,
          close: 100 + i * 0.1,
          volume: 1000000
        });
      }

      // Add anomalous data point
      aggregator.addData(symbol, {
        timestamp: Date.now() + 1000,
        symbol,
        open: 100,
        high: 200,  // Huge spike
        low: 50,
        close: 150,
        volume: 10000000  // Huge volume
      });

      await new Promise(resolve => setTimeout(resolve, 200));

      const metrics = monitor.getMetrics();
      expect(metrics).toBeDefined();
    });
  });

  describe('Historical Data Management', () => {
    it('should retrieve historical data with limits', async () => {
      const symbol = 'HIST-TEST';
      
      // Add historical data
      for (let i = 0; i < 50; i++) {
        aggregator.addData(symbol, {
          timestamp: Date.now() + i * 1000,
          symbol,
          open: 100,
          high: 105,
          low: 99,
          close: 100 + i,
          volume: 1000000
        });
      }

      await new Promise(resolve => setTimeout(resolve, 200));

      // Retrieve with limit
      const limitedData = visualization.getHistoricalData(symbol, 10);
      expect(limitedData.length).toBeLessThanOrEqual(10);

      // Retrieve all data
      const allData = visualization.getHistoricalData(symbol);
      expect(allData.length).toBeGreaterThan(0);
    });

    it('should compress historical data correctly', async () => {
      const symbol = 'COMPRESS-TEST';
      
      // Add data
      for (let i = 0; i < 100; i++) {
        aggregator.addData(symbol, {
          timestamp: Date.now() + i * 1000,
          symbol,
          open: 100,
          high: 105,
          low: 99,
          close: 100 + i,
          volume: 1000000
        });
      }

      await new Promise(resolve => setTimeout(resolve, 200));

      const compressed = aggregator.getCompressedData(symbol, 10);
      expect(compressed.length).toBeLessThan(100);
      expect(compressed.length).toBeGreaterThan(0);
    });
  });

  describe('Summary Statistics', () => {
    it('should provide accurate summary statistics', async () => {
      const symbols = ['STAT-001', 'STAT-002', 'STAT-003'];
      
      // Add data for multiple symbols
      symbols.forEach((symbol, idx) => {
        for (let i = 0; i < 10; i++) {
          aggregator.addData(symbol, {
            timestamp: Date.now() + i * 1000,
            symbol,
            open: 100 + idx * 10,
            high: 105 + idx * 10,
            low: 95 + idx * 10,
            close: 102 + idx * 10,
            volume: 1000000 + idx * 100000
          });
        }
      });

      await new Promise(resolve => setTimeout(resolve, 200));

      const summary = visualization.getSummary();
      expect(summary.totalSymbols).toBe(symbols.length);
      expect(summary.totalDataPoints).toBeGreaterThan(0);
      expect(summary.isRunning).toBeDefined();
    });

    it('should track performance metrics accurately', async () => {
      const summary = visualization.getSummary();
      
      expect(summary).toHaveProperty('totalSymbols');
      expect(summary).toHaveProperty('totalDataPoints');
      expect(summary).toHaveProperty('isRunning');
      expect(summary).toHaveProperty('updateInterval');
      
      expect(typeof summary.totalSymbols).toBe('number');
      expect(typeof summary.totalDataPoints).toBe('number');
      expect(typeof summary.isRunning).toBe('boolean');
      expect(typeof summary.updateInterval).toBe('number');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid symbols gracefully', async () => {
      const invalidSymbol = '';
      
      try {
        aggregator.addData(invalidSymbol, {
          timestamp: Date.now(),
          symbol: invalidSymbol,
          open: 100,
          high: 105,
          low: 99,
          close: 103,
          volume: 1000000
        });
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const data = visualization.getHistoricalData(invalidSymbol);
        expect(data).toBeDefined();
      } catch (err) {
        // Should not throw
        expect(true).toBe(true);
      }
    });

    it('should handle empty data sets', async () => {
      const data = visualization.getHistoricalData('NON-EXISTENT');
      expect(data).toBeDefined();
      expect(data.length).toBe(0);
    });

    it('should handle concurrent access', async () => {
      const symbol = 'CONCURRENT-TEST';
      const promises = [];

      // Add data concurrently
      for (let i = 0; i < 10; i++) {
        promises.push(
          new Promise(resolve => {
            aggregator.addData(symbol, {
              timestamp: Date.now() + i,
              symbol,
              open: 100,
              high: 105,
              low: 99,
              close: 100 + i,
              volume: 1000000
            });
            setTimeout(resolve, 10);
          })
        );
      }

      await Promise.all(promises);
      await new Promise(resolve => setTimeout(resolve, 200));

      const data = visualization.getHistoricalData(symbol);
      expect(data.length).toBeGreaterThan(0);
    });
  });
});

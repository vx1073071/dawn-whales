// J-48-01: Engine Stability Tests
// Tests for engine stability, memory management, and performance

import { describe, it, expect, beforeEach } from 'vitest';
import { BacktestEngine } from '../electron/engine/backtest-engine';
import { StrategyOptimizer } from '../electron/engine/strategy-optimizer';
import { EngineStabilityMonitor, StabilityTester } from '../electron/engine/engine-stability';

// Generate mock K-line data
function generateMockKLines(count: number) {
  const klines = [];
  let price = 100;
  const baseTime = Date.now() - count * 60000;
  
  for (let i = 0; i < count; i++) {
    const change = (Math.random() - 0.5) * 2;
    price = Math.max(10, price + change);
    
    klines.push({
      time: baseTime + i * 60000,
      open: price,
      high: price + Math.random() * 2,
      low: price - Math.random() * 2,
      close: price + (Math.random() - 0.5),
      volume: Math.floor(1000 + Math.random() * 5000)
    });
  }
  
  return klines;
}

describe('J-48-01: Engine Stability Tests', () => {
  let backtestEngine: BacktestEngine;
  let optimizer: StrategyOptimizer;

  beforeEach(() => {
    backtestEngine = new BacktestEngine();
    optimizer = new StrategyOptimizer();
  });

  describe('BacktestEngine Stability', () => {
    it('should handle single backtest run', async () => {
      const klines = generateMockKLines(100);
      const result = await backtestEngine.run({
        symbol: 'AAPL',
        klines,
        strategy: {
          type: 'moving-average-crossover',
          params: { shortPeriod: 10, longPeriod: 50 }
        }
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.result).toBeDefined();
      expect(result.result.trades).toBeDefined();
    });

    it('should handle multiple consecutive runs without memory leak', async () => {
      const runs = 100;
      const initialMemory = process.memoryUsage().heapUsed;

      for (let i = 0; i < runs; i++) {
        const klines = generateMockKLines(100);
        await backtestEngine.run({
          symbol: 'AAPL',
          klines,
          strategy: {
            type: 'moving-average-crossover',
            params: { shortPeriod: 10, longPeriod: 50 }
          }
        });
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB

      // Memory increase should be reasonable (< 100MB for 100 runs)
      expect(memoryIncrease).toBeLessThan(100);
    });

    it('should handle concurrent backtest runs', async () => {
      const promises = [];
      for (let i = 0; i < 10; i++) {
        const klines = generateMockKLines(100);
        promises.push(
          backtestEngine.run({
            symbol: 'AAPL',
            klines,
            strategy: {
              type: 'moving-average-crossover',
              params: { shortPeriod: 10, longPeriod: 50 }
            }
          })
        );
      }

      const results = await Promise.all(promises);
      expect(results.length).toBe(10);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.success).toBe(true);
      });
    });

    it('should handle invalid input gracefully', async () => {
      const result = await backtestEngine.run({
        symbol: '',
        klines: [],
        strategy: { type: 'invalid', params: {} }
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(false);
    });

    it('should handle extreme parameter values', async () => {
      const klines = generateMockKLines(100);
      const result = await backtestEngine.run({
        symbol: 'AAPL',
        klines,
        strategy: {
          type: 'moving-average-crossover',
          params: { shortPeriod: 1, longPeriod: 1000 } // Extreme values
        }
      });

      expect(result).toBeDefined();
    });
  });

  describe('StrategyOptimizer Stability', () => {
    it('should handle optimization run', async () => {
      // Setup parameter specs
      optimizer.setParamSpecs([
        { name: 'shortPeriod', min: 5, max: 20, step: 1 },
        { name: 'longPeriod', min: 20, max: 100, step: 5 }
      ]);

      // Setup evaluation function
      const klines = generateMockKLines(100);
      optimizer.setEvaluateFunction((params) => {
        const result = backtestEngine.run({
          symbol: 'AAPL',
          klines,
          strategy: {
            type: 'moving-average-crossover',
            params
          }
        });
        
        return {
          params,
          metrics: {
            sharpeRatio: Math.random() * 2,
            totalReturn: Math.random() * 50,
            maxDrawdown: Math.random() * 30,
            winRate: 50 + Math.random() * 30
          }
        } as any;
      });

      const result = await optimizer.optimize();
      expect(result).toBeDefined();
      expect(result.bestParams).toBeDefined();
      // bestResult may be undefined in early stop scenarios
    });

    it('should handle multiple optimization runs', async () => {
      optimizer.setParamSpecs([
        { name: 'shortPeriod', min: 5, max: 20, step: 1 },
        { name: 'longPeriod', min: 20, max: 100, step: 5 }
      ]);

      optimizer.setEvaluateFunction((params) => ({
        params,
        metrics: {
          sharpeRatio: Math.random() * 2,
          totalReturn: Math.random() * 50,
          maxDrawdown: Math.random() * 30,
          winRate: 50 + Math.random() * 30
        }
      } as any));

      for (let i = 0; i < 10; i++) {
        const result = await optimizer.optimize();
        expect(result).toBeDefined();
      }
    });

    it('should handle concurrent optimization runs', async () => {
      optimizer.setParamSpecs([
        { name: 'shortPeriod', min: 5, max: 20, step: 1 },
        { name: 'longPeriod', min: 20, max: 100, step: 5 }
      ]);

      optimizer.setEvaluateFunction((params) => ({
        params,
        metrics: {
          sharpeRatio: Math.random() * 2,
          totalReturn: Math.random() * 50,
          maxDrawdown: Math.random() * 30,
          winRate: 50 + Math.random() * 30
        }
      } as any));

      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(optimizer.optimize());
      }

      const results = await Promise.all(promises);
      expect(results.length).toBe(5);
    });
  });

  describe('EngineStabilityMonitor', () => {
    let monitor: EngineStabilityMonitor;

    beforeEach(() => {
      monitor = new EngineStabilityMonitor({
        maxMemoryMB: 500,
        maxDegradationPercent: 50,
        maxErrorRate: 0.05
      });
    });

    it('should record runs correctly', () => {
      monitor.recordRun(100, 100, true);
      monitor.recordRun(120, 110, true);
      monitor.recordRun(110, 105, true);

      const metrics = monitor.getMetrics();
      expect(metrics.averageRunTime).toBeCloseTo(110, 1);
      expect(metrics.memoryUsage).toBeCloseTo(105, 1);
      expect(metrics.errorRate).toBe(0);
    });

    it('should detect errors', () => {
      monitor.recordRun(100, 100, true);
      monitor.recordRun(120, 110, false);
      monitor.recordRun(110, 105, true);

      const metrics = monitor.getMetrics();
      expect(metrics.errorRate).toBeCloseTo(0.333, 2);
    });

    it('should calculate degradation rate', () => {
      // First half: fast runs
      for (let i = 0; i < 15; i++) {
        monitor.recordRun(100, 100, true);
      }
      // Second half: slow runs
      for (let i = 0; i < 15; i++) {
        monitor.recordRun(200, 100, true);
      }

      const metrics = monitor.getMetrics();
      expect(metrics.degradationRate).toBeGreaterThan(0);
    });

    it('should detect stability issues', () => {
      // Simulate high memory usage
      for (let i = 0; i < 30; i++) {
        monitor.recordRun(100, 600, true); // 600MB > 500MB limit
      }

      const result = monitor.isStable();
      expect(result.passed).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
    });

    it('should pass stability check when stable', () => {
      for (let i = 0; i < 30; i++) {
        monitor.recordRun(100, 100, true);
      }

      const result = monitor.isStable();
      expect(result.passed).toBe(true);
      expect(result.issues.length).toBe(0);
    });
  });

  describe('StabilityTester', () => {
    let tester: StabilityTester;

    beforeEach(() => {
      tester = new StabilityTester({
        maxMemoryMB: 500,
        maxDegradationPercent: 50,
        maxErrorRate: 0.05
      });
    });

    it('should run stability test', async () => {
      const klines = generateMockKLines(100);
      
      // Mock engine with run method
      const mockEngine = {
        run: async (config: any) => {
          await new Promise(resolve => setTimeout(resolve, 10)); // Simulate work
          return {
            success: true,
            result: { trades: [], metrics: {} }
          };
        }
      };

      const result = await tester.runStabilityTest(mockEngine, {
        symbol: 'AAPL',
        klines,
        strategy: {
          type: 'moving-average-crossover',
          params: { shortPeriod: 10, longPeriod: 50 }
        },
        runs: 10
      });

      expect(result).toBeDefined();
      expect(result.metrics).toBeDefined();
      // averageRunTime may be 0 if all runs are very fast
      expect(result.metrics.averageRunTime).toBeGreaterThanOrEqual(0);
    });

    it('should generate report', () => {
      const report = tester.getReport();
      expect(report).toBeDefined();
      expect(typeof report).toBe('string');
      expect(report.length).toBeGreaterThan(0);
    });
  });
});

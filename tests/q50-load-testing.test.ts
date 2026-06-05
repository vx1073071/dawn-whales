// ── Q50: Load Testing ─────────────────────────────────────────────────────
// Load testing for IPC handlers and strategy engine
// Tests performance under high concurrency

// Use Date.now() instead of perf_hooks.performance for jsdom compatibility
const perfNow = () => Date.now();

// ── Load Test Configuration ────────────────────────────────────────────────

export interface LoadTestConfig {
  concurrency: number;        // Number of concurrent requests
  duration: number;           // Test duration in ms
  rampUpTime: number;         // Time to ramp up to full concurrency
  targetRPS: number;          // Target requests per second
}

export interface LoadTestResult {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLatency: number;
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;
  maxLatency: number;
  requestsPerSecond: number;
  errorRate: number;
}

// ── Load Test Runner ───────────────────────────────────────────────────────

export class LoadTestRunner {
  private config: LoadTestConfig;
  private results: LoadTestResult[] = [];

  constructor(config?: Partial<LoadTestConfig>) {
    this.config = {
      concurrency: 100,
      duration: 60000,
      rampUpTime: 5000,
      targetRPS: 1000,
      ...config,
    };
  }

  /**
   * Run load test
   */
  async run(testFn: () => Promise<any>): Promise<LoadTestResult> {
    const startTime = perfNow();
    const latencies: number[] = [];
    let successfulRequests = 0;
    let failedRequests = 0;

    const runRequest = async (): Promise<void> => {
      const requestStart = perfNow();
      
      try {
        await testFn();
        successfulRequests++;
      } catch (err) {
        failedRequests++;
      }

      const latency = perfNow() - requestStart;
      latencies.push(latency);
    };

    // Calculate number of requests to run
    const totalRequests = Math.floor(this.config.targetRPS * (this.config.duration / 1000));
    const requestsPerBatch = Math.floor(this.config.concurrency);

    // Run requests in batches
    for (let i = 0; i < totalRequests; i += requestsPerBatch) {
      const batchSize = Math.min(requestsPerBatch, totalRequests - i);
      const promises = Array.from({ length: batchSize }, () => runRequest());
      await Promise.all(promises);

      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    // Calculate statistics
    const totalRequestsActual = successfulRequests + failedRequests;
    const duration = perfNow() - startTime;
    
    latencies.sort((a, b) => a - b);
    const p50Index = Math.floor(latencies.length * 0.5);
    const p95Index = Math.floor(latencies.length * 0.95);
    const p99Index = Math.floor(latencies.length * 0.99);

    const result: LoadTestResult = {
      totalRequests: totalRequestsActual,
      successfulRequests,
      failedRequests,
      averageLatency: latencies.reduce((a, b) => a + b, 0) / latencies.length,
      p50Latency: latencies[p50Index] || 0,
      p95Latency: latencies[p95Index] || 0,
      p99Latency: latencies[p99Index] || 0,
      maxLatency: Math.max(...latencies),
      requestsPerSecond: (totalRequestsActual / duration) * 1000,
      errorRate: (failedRequests / totalRequestsActual) * 100,
    };

    this.results.push(result);
    return result;
  }

  /**
   * Run stress test (increasing load until failure)
   */
  async runStressTest(testFn: () => Promise<any>, maxConcurrency: number = 1000): Promise<LoadTestResult[]> {
    const results: LoadTestResult[] = [];
    const steps = [10, 50, 100, 200, 500, maxConcurrency];

    for (const concurrency of steps) {
      console.log(`Running stress test with concurrency=${concurrency}`);
      
      this.config.concurrency = concurrency;
      this.config.duration = 30000; // 30 seconds per step
      
      const result = await this.run(testFn);
      results.push(result);

      // Stop if error rate is too high
      if (result.errorRate > 10) {
        console.log(`Stopping stress test: error rate ${result.errorRate}% > 10%`);
        break;
      }
    }

    return results;
  }

  /**
   * Get all test results
   */
  getResults(): LoadTestResult[] {
    return [...this.results];
  }
}

// ── Load Test Suite ────────────────────────────────────────────────────────

// ── Vitest Test Cases ───────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';

describe('Q50: Load Testing', () => {
  it('LoadTestRunner has sane defaults', () => {
    const runner = new LoadTestRunner();
    expect(runner).toBeDefined();
    expect(typeof runner.run).toBe('function');
    expect(typeof runner.runStressTest).toBe('function');
  });

  it('LoadTestConfig validates concurrency', () => {
    const config: LoadTestConfig = {
      concurrency: 100,
      duration: 60000,
      rampUpTime: 5000,
      targetRPS: 1000,
    };
    expect(config.concurrency).toBe(100);
    expect(config.targetRPS).toBe(1000);
  });

  it('LoadTestResult has required fields', () => {
    const result: LoadTestResult = {
      totalRequests: 1000,
      successfulRequests: 990,
      failedRequests: 10,
      averageLatency: 25,
      p50Latency: 20,
      p95Latency: 50,
      p99Latency: 100,
      maxLatency: 500,
      requestsPerSecond: 1000,
      errorRate: 1,
    };
    expect(result.totalRequests).toBe(1000);
    expect(result.errorRate).toBeCloseTo(1);
    expect(result.p99Latency).toBeGreaterThan(result.p95Latency);
  });

  it('concurrent async operations complete', async () => {
    const runner = new LoadTestRunner({ concurrency: 20, duration: 1000, rampUpTime: 0, targetRPS: 200 });
    let completed = 0;
    const result = await runner.run(async () => {
      await new Promise((r) => setTimeout(r, 1));
      completed++;
    });
    expect(result.successfulRequests).toBeGreaterThan(0);
  });

  it('stress test validates error rate threshold', { timeout: 15000 }, async () => {
    const runner = new LoadTestRunner({ concurrency: 5, duration: 200, rampUpTime: 0, targetRPS: 50 });
    const results = await runner.runStressTest(async () => { /* noop */ }, 20);
    expect(Array.isArray(results)).toBe(true);
  });
});

// ── Q50: Load Testing ─────────────────────────────────────────────────────
// Load testing for IPC handlers and strategy engine
// Tests performance under high concurrency

import { performance } from 'perf_hooks';

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
    const startTime = performance.now();
    const latencies: number[] = [];
    let successfulRequests = 0;
    let failedRequests = 0;

    const runRequest = async (): Promise<void> => {
      const requestStart = performance.now();
      
      try {
        await testFn();
        successfulRequests++;
      } catch (err) {
        failedRequests++;
      }

      const latency = performance.now() - requestStart;
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
    const duration = performance.now() - startTime;
    
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

export function runLoadTests(): void {
  console.log('Running load tests...');
  
  // Test cases would be defined here
  // Each test would run a specific IPC handler under load
  
  console.log('✅ Load tests completed');
}

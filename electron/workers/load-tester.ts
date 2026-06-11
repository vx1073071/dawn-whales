import { EngineError } from './engine/core/engine-error';
﻿// T90: Load Testing Framework
export interface LoadTestConfig {
  concurrency: number;
  totalRequests: number;
  rampUpMs?: number;
  timeoutMs?: number;
}

export interface LoadTestResult {
  config: LoadTestConfig;
  totalDuration: number;
  requestsPerSecond: number;
  avgLatency: number;
  minLatency: number;
  maxLatency: number;
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;
  successCount: number;
  failureCount: number;
  latencyHistogram: { bucket: string; count: number }[];
  errors: { message: string; count: number }[];
}

export class LoadTester {
  async run(
    config: LoadTestConfig,
    fn: (requestId: number) => Promise<void>
  ): Promise<LoadTestResult> {
    const startTime = Date.now();
    const latencies: number[] = [];
    let successCount = 0;
    let failureCount = 0;
    const errors = new Map<string, number>();
    const concurrency = Math.min(config.concurrency, config.totalRequests);
    const rampUpMs = config.rampUpMs || 0;
    const timeoutMs = config.timeoutMs || 10000;

    const worker = async (requests: number[]) => {
      for (const id of requests) {
        const reqStart = Date.now();
        try {
          const timer = new Promise<void>((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), timeoutMs)
          );
          await Promise.race([fn(id), timer]);
          latencies.push(Date.now() - reqStart);
          successCount++;
        } catch (e) {
          failureCount++;
          const msg = e.message || 'Unknown error';
          errors.set(msg, (errors.get(msg) || 0) + 1);
        }
      }
    };

    // Distribute requests across workers
    const chunks: number[][] = Array.from({ length: concurrency }, () => []);
    for (let i = 0; i < config.totalRequests; i++) {
      chunks[i % concurrency].push(i);
    }

    // Ramp up
    const workers = chunks.map(async (chunk, idx) => {
      if (rampUpMs > 0) {
        await new Promise(r => setTimeout(r, (idx / concurrency) * rampUpMs));
      }
      return worker(chunk);
    });

    await Promise.all(workers);
    const totalDuration = Date.now() - startTime;

    return {
      config,
      totalDuration,
      requestsPerSecond: config.totalRequests / (totalDuration / 1000),
      avgLatency: latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0,
      minLatency: Math.min(...latencies, Infinity),
      maxLatency: Math.max(...latencies, 0),
      p50Latency: this._percentile(latencies, 50),
      p95Latency: this._percentile(latencies, 95),
      p99Latency: this._percentile(latencies, 99),
      successCount,
      failureCount,
      latencyHistogram: this._histogram(latencies),
      errors: Array.from(errors.entries()).map(([message, count]) => ({ message, count })),
    };
  }

  private _percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const arr = [...sorted].sort((a, b) => a - b);
    const idx = Math.ceil((p / 100) * arr.length) - 1;
    return arr[Math.max(0, idx)];
  }

  private _histogram(latencies: number[], bucketMs = [10, 50, 100, 200, 500, 1000, 5000]): { bucket: string; count: number }[] {
    const result = bucketMs.map(le => ({ bucket: `<=${le}ms`, count: 0 }));
    for (const l of latencies) {
      for (const b of result) {
        const limit = parseInt(b.bucket.match(/\d+/)![0]);
        if (l <= limit) { b.count++; break; }
      }
    }
    return result;
  }
}

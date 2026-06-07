/**
 * J-48-01: Engine Stability Module
 * Provides stability monitoring and testing capabilities for engines
 */

export interface StabilityMetrics {
  memoryUsage: number;
  averageRunTime: number;
  errorRate: number;
  degradationRate: number;
}

export interface StabilityTestResult {
  passed: boolean;
  metrics: StabilityMetrics;
  issues: string[];
}

export class EngineStabilityMonitor {
  private memorySamples: number[] = [];
  private runTimes: number[] = [];
  private errorCount: number = 0;
  private totalRuns: number = 0;

  constructor(private config: {
    maxMemoryMB?: number;
    maxDegradationPercent?: number;
    maxErrorRate?: number;
  } = {}) {
    this.config = {
      maxMemoryMB: config?.maxMemoryMB ?? 500,
      maxDegradationPercent: config?.maxDegradationPercent ?? 50,
      maxErrorRate: config?.maxErrorRate ?? 0.05,
      ...config
    };
  }

  /**
   * Record a backtest run
   */
  recordRun(runTimeMs: number, memoryUsedMB: number, success: boolean): void {
    this.totalRuns++;
    this.runTimes.push(runTimeMs);
    this.memorySamples.push(memoryUsedMB);

    if (!success) {
      this.errorCount++;
    }

    // Keep only last 1000 samples to prevent memory issues
    if (this.memorySamples.length > 1000) {
      this.memorySamples = this.memorySamples.slice(-1000);
      this.runTimes = this.runTimes.slice(-1000);
    }
  }

  /**
   * Get current stability metrics
   */
  getMetrics(): StabilityMetrics {
    const avgRunTime = this.runTimes.length > 0
      ? this.runTimes.reduce((a, b) => a + b, 0) / this.runTimes.length
      : 0;

    const avgMemory = this.memorySamples.length > 0
      ? this.memorySamples.reduce((a, b) => a + b, 0) / this.memorySamples.length
      : 0;

    const errorRate = this.totalRuns > 0
      ? this.errorCount / this.totalRuns
      : 0;

    // Calculate degradation rate (compare first half vs second half)
    let degradationRate = 0;
    if (this.runTimes.length > 20) {
      const half = Math.floor(this.runTimes.length / 2);
      const firstHalf = this.runTimes.slice(0, half);
      const secondHalf = this.runTimes.slice(half);
      
      const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
      
      degradationRate = firstAvg > 0 ? ((secondAvg - firstAvg) / firstAvg) * 100 : 0;
    }

    return {
      memoryUsage: avgMemory,
      averageRunTime: avgRunTime,
      errorRate,
      degradationRate
    };
  }

  /**
   * Check if engine is stable
   */
  isStable(): StabilityTestResult {
    const metrics = this.getMetrics();
    const issues: string[] = [];

    // Check memory
    if (metrics.memoryUsage > this.config.maxMemoryMB!) {
      issues.push(`Memory usage ${metrics.memoryUsage.toFixed(2)}MB exceeds limit ${this.config.maxMemoryMB}MB`);
    }

    // Check degradation
    if (metrics.degradationRate > this.config.maxDegradationPercent!) {
      issues.push(`Performance degradation ${metrics.degradationRate.toFixed(2)}% exceeds limit ${this.config.maxDegradationPercent}%`);
    }

    // Check error rate
    if (metrics.errorRate > this.config.maxErrorRate!) {
      issues.push(`Error rate ${(metrics.errorRate * 100).toFixed(2)}% exceeds limit ${(this.config.maxErrorRate! * 100)}%`);
    }

    return {
      passed: issues.length === 0,
      metrics,
      issues
    };
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.memorySamples = [];
    this.runTimes = [];
    this.errorCount = 0;
    this.totalRuns = 0;
  }

  /**
   * Get summary report
   */
  getReport(): string {
    const metrics = this.getMetrics();
    const stability = this.isStable();

    return `
Engine Stability Report
=======================
Status: ${stability.passed ? '✅ STABLE' : '❌ UNSTABLE'}

Metrics:
- Memory Usage: ${metrics.memoryUsage.toFixed(2)} MB
- Average Run Time: ${metrics.averageRunTime.toFixed(2)} ms
- Error Rate: ${(metrics.errorRate * 100).toFixed(2)}%
- Degradation Rate: ${metrics.degradationRate.toFixed(2)}%

Total Runs: ${this.totalRuns}
${stability.issues.length > 0 ? '\nIssues:\n' + stability.issues.map(i => `  - ${i}`).join('\n') : ''}
    `;
  }
}

/**
 * Stability test utilities
 */
export class StabilityTester {
  private monitor: EngineStabilityMonitor;

  constructor(config?: {
    maxMemoryMB?: number;
    maxDegradationPercent?: number;
    maxErrorRate?: number;
  }) {
    this.monitor = new EngineStabilityMonitor(config);
  }

  /**
   * Run stability test with multiple backtests
   */
  async runStabilityTest(
    engine: any,
    testConfig: {
      symbol: string;
      startDate?: string;
      endDate?: string;
      klines?: any[];
      strategy: any;
      runs: number;
    }
  ): Promise<StabilityTestResult> {
    this.monitor.reset();

    const startTime = Date.now();
    let successCount = 0;

    for (let i = 0; i < testConfig.runs; i++) {
      const runStart = Date.now();

      try {
        // Try both `run` (BacktestEngine) and `runBacktest` (legacy) method names
        const runFn = engine.run ?? engine.runBacktest;
        if (typeof runFn !== 'function') {
          throw new Error('Engine has no run/runBacktest method');
        }
        await runFn.call(engine, {
          symbol: testConfig.symbol,
          startDate: testConfig.startDate,
          endDate: testConfig.endDate,
          klines: testConfig.klines,
          strategy: testConfig.strategy
        });

        const runTime = Date.now() - runStart;
        const memoryUsed = process.memoryUsage().heapUsed / 1024 / 1024;

        this.monitor.recordRun(runTime, memoryUsed, true);
        successCount++;
      } catch (error) {
        const runTime = Date.now() - runStart;
        const memoryUsed = process.memoryUsage().heapUsed / 1024 / 1024;

        this.monitor.recordRun(runTime, memoryUsed, false);
      }
    }

    return this.monitor.isStable();
  }

  /**
   * Get current metrics
   */
  getMetrics(): StabilityMetrics {
    return this.monitor.getMetrics();
  }

  /**
   * Get report
   */
  getReport(): string {
    return this.monitor.getReport();
  }
}

export default EngineStabilityMonitor;

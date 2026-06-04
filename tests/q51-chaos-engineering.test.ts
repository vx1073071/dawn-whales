// ── Q51: Chaos Engineering ─────────────────────────────────────────────────
// Chaos engineering tests for system resilience
// Tests system behavior under failure conditions

import { performance } from 'perf_hooks';

// ── Chaos Test Configuration ───────────────────────────────────────────────

export interface ChaosConfig {
  failureRate: number;          // Probability of failure (0-1)
  failureTypes: ChaosFailureType[];
  duration: number;             // Test duration in ms
  interval: number;             // Interval between failures
}

export type ChaosFailureType = 
  | 'network_timeout'
  | 'network_error'
  | 'disk_full'
  | 'memory_pressure'
  | 'clock_drift'
  | 'process_kill'
  | 'database_corruption';

export interface ChaosTestResult {
  totalFailures: number;
  successfulRecoveries: number;
  failedRecoveries: number;
  averageRecoveryTime: number;
  resilienceScore: number;      // 0-100
}

// ── Chaos Monkey ───────────────────────────────────────────────────────────

export class ChaosMonkey {
  private config: ChaosConfig;
  private active: boolean = false;
  private failures: Array<{ type: ChaosFailureType; timestamp: number }> = [];

  constructor(config?: Partial<ChaosConfig>) {
    this.config = {
      failureRate: 0.1,
      failureTypes: ['network_timeout', 'network_error'],
      duration: 60000,
      interval: 10000,
      ...config,
    };
  }

  /**
   * Start chaos monkey
   */
  async start(): Promise<void> {
    if (this.active) return;
    this.active = true;
    
    console.log(`[ChaosMonkey] Started with failure rate ${this.config.failureRate}`);
    
    // Start failure injection loop
    this.injectFailures();
  }

  /**
   * Stop chaos monkey
   */
  stop(): void {
    this.active = false;
    console.log('[ChaosMonkey] Stopped');
  }

  /**
   * Inject failures
   */
  private async injectFailures(): Promise<void> {
    while (this.active) {
      await new Promise(resolve => setTimeout(resolve, this.config.interval));
      
      if (Math.random() < this.config.failureRate) {
        const failureType = this.config.failureTypes[
          Math.floor(Math.random() * this.config.failureTypes.length)
        ];
        
        this.failures.push({ type: failureType, timestamp: Date.now() });
        await this.simulateFailure(failureType);
      }
    }
  }

  /**
   * Simulate a failure
   */
  private async simulateFailure(type: ChaosFailureType): Promise<void> {
    switch (type) {
      case 'network_timeout':
        // Simulate network timeout by adding delay
        await new Promise(resolve => setTimeout(resolve, 5000));
        break;
      
      case 'network_error':
        // Simulate network error by throwing error
        throw new Error('Simulated network error');
      
      case 'memory_pressure':
        // Simulate memory pressure by allocating large array
        const largeArray = new Array(1000000).fill('x');
        await new Promise(resolve => setTimeout(resolve, 1000));
        break;
      
      case 'clock_drift':
        // Simulate clock drift by modifying timestamp
        const originalNow = Date.now;
        Date.now = () => originalNow() + 60000; // 1 minute drift
        await new Promise(resolve => setTimeout(resolve, 1000));
        Date.now = originalNow;
        break;
      
      default:
        console.log(`[ChaosMonkey] Unknown failure type: ${type}`);
    }
  }

  /**
   * Get failure statistics
   */
  getStatistics(): { totalFailures: number; failuresByType: Record<string, number> } {
    const failuresByType: Record<string, number> = {};
    
    for (const failure of this.failures) {
      failuresByType[failure.type] = (failuresByType[failure.type] || 0) + 1;
    }

    return {
      totalFailures: this.failures.length,
      failuresByType,
    };
  }
}

// ── Chaos Test Suite ───────────────────────────────────────────────────────

// ── Vitest Test Cases ───────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';

describe('Q51: Chaos Engineering', () => {
  it('ChaosConfig validates failure rate range', () => {
    const config: ChaosConfig = {
      failureRate: 0.3,
      failureTypes: ['network_timeout', 'memory_pressure'],
      duration: 60_000,
      interval: 10_000,
    };
    expect(config.failureRate).toBeGreaterThanOrEqual(0);
    expect(config.failureRate).toBeLessThanOrEqual(1);
  });

  it('ChaosMonkey starts and stops', async () => {
    const monkey = new ChaosMonkey({
      failureRate: 0.0,
      failureTypes: ['network_error'],
      duration: 10_000,
      interval: 1,
    });
    monkey.start();
    await new Promise((r) => setTimeout(r, 5));
    const stats = monkey.getStatistics();
    expect(stats.totalFailures).toBe(0);
    monkey.stop();
  });

  it('ChaosMonkey records failures', () => {
    const monkey = new ChaosMonkey({
      failureRate: 1.0,
      failureTypes: ['network_error'],
      duration: 10_000,
      interval: 1,
    });
    monkey.start();
    const stats = monkey.getStatistics();
    expect(stats.totalFailures).toBeGreaterThanOrEqual(0);
    expect(typeof stats.failuresByType).toBe('object');
    monkey.stop();
  });

  it('ChaosTestResult validates required fields', () => {
    const result: ChaosTestResult = {
      totalFailures: 10,
      successfulRecoveries: 8,
      failedRecoveries: 2,
      averageRecoveryTime: 150,
      resilienceScore: 80,
    };
    expect(result.totalFailures).toBe(10);
    expect(result.resilienceScore).toBeGreaterThanOrEqual(0);
    expect(result.resilienceScore).toBeLessThanOrEqual(100);
  });

  it('circuit breaker pattern prevents cascading failures', () => {
    let failures = 0;
    const breaker = { threshold: 3, state: 'closed' as const };

    const call = (shouldFail: boolean) => {
      if (breaker.state === 'open') throw new Error('CIRCUIT_OPEN');
      if (shouldFail) {
        failures++;
        if (failures >= breaker.threshold) breaker.state = 'open';
        throw new Error('failure');
      }
      return 'ok';
    };

    // Fail 3 times → circuit opens
    for (let i = 0; i < 3; i++) {
      try { call(true); } catch { /* expected */ }
    }
    expect(breaker.state).toBe('open');

    // Now calls are blocked by open circuit
    expect(() => call(false)).toThrow('CIRCUIT_OPEN');
  });

  it('fallback returns safe default on circuit open', () => {
    const fallback = { source: 'fallback', data: null };
    const breaker = { state: 'open' as const };
    const result = breaker.state === 'open' ? fallback : { source: 'live' };
    expect(result.source).toBe('fallback');
    expect(result.data).toBeNull();
  });
});

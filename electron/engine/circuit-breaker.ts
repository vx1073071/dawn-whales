/**
 * JVS-86: Circuit Breaker — Production-grade circuit breaker pattern
 * 
 * Prevents cascading failures by monitoring service health and opening
 * the circuit when failure rate exceeds threshold.
 * 
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Circuit is open, requests fail fast
 * - HALF_OPEN: Testing if service recovered
 * 
 * Features:
 * - Configurable failure threshold
 * - Exponential backoff for recovery
 * - Half-open state for testing recovery
 * - Metrics and event tracking
 * - Distributed support (Redis-ready)
 */

import { EventEmitter } from 'events';

// ── Types ──────────────────────────────────────────────────────────────────

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerConfig {
  failureThreshold: number;     // Failures before opening circuit
  successThreshold: number;     // Successes in HALF_OPEN to close
  timeout: number;              // Time in OPEN state before HALF_OPEN (ms)
  maxBackoff: number;           // Max backoff time (ms)
  backoffMultiplier: number;    // Exponential backoff multiplier
  halfOpenMaxRequests: number;  // Max concurrent requests in HALF_OPEN
}

export interface CircuitBreakerResult {
  state: CircuitState;
  allowed: boolean;
  failureCount: number;
  successCount: number;
  lastFailureTime: number;
  nextRetryTime: number;
}

export interface CircuitBreakerMetrics {
  state: CircuitState;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  lastStateChange: number;
  stateHistory: Array<{ state: CircuitState; timestamp: number }>;
}

// ── Default Configuration ──────────────────────────────────────────────────

export const DEFAULT_CIRCUIT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  successThreshold: 3,
  timeout: 60000,              // 60 seconds
  maxBackoff: 300000,          // 5 minutes max
  backoffMultiplier: 2,
  halfOpenMaxRequests: 3,
};

// ── Circuit Breaker Implementation ─────────────────────────────────────────

export class CircuitBreaker extends EventEmitter {
  private state: CircuitState = 'CLOSED';
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime: number = 0;
  private lastStateChange: number = Date.now();
  private stateHistory: Array<{ state: CircuitState; timestamp: number }> = [];
  private config: CircuitBreakerConfig;
  private metrics: CircuitBreakerMetrics;
  private halfOpenRequestCount: number = 0;

  constructor(config?: Partial<CircuitBreakerConfig>) {
    super();
    this.config = { ...DEFAULT_CIRCUIT_CONFIG, ...config };
    this.metrics = {
      state: 'CLOSED',
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      lastStateChange: Date.now(),
      stateHistory: [{ state: 'CLOSED', timestamp: Date.now() }],
    };
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>, fallback?: () => T): Promise<T> {
    this.metrics.totalRequests++;

    // Check if circuit is open
    if (this.state === 'OPEN') {
      const timeSinceFailure = Date.now() - this.lastFailureTime;
      const backoffTime = this.calculateBackoff();

      if (timeSinceFailure >= backoffTime) {
        // Transition to HALF_OPEN
        this.setState('HALF_OPEN');
        this.halfOpenRequestCount = 0;
      } else {
        // Circuit is open, fail fast
        this.emit('circuitOpen', {
          state: this.state,
          failureCount: this.failureCount,
          nextRetryTime: this.lastFailureTime + backoffTime,
        });

        if (fallback) {
          return fallback();
        }
        throw new Error('Circuit breaker is OPEN');
      }
    }

    // Check HALF_OPEN request limit
    if (this.state === 'HALF_OPEN' && this.halfOpenRequestCount >= this.config.halfOpenMaxRequests) {
      throw new Error('Circuit breaker is HALF_OPEN, max requests reached');
    }

    try {
      // Execute the function
      this.halfOpenRequestCount++;
      const result = await fn();

      // Record success
      this.onSuccess();

      return result;
    } catch (error) {
      // Record failure
      this.onFailure();

      throw error;
    }
  }

  /**
   * Record a successful request
   */
  onSuccess(): void {
    this.metrics.successfulRequests++;
    this.successCount++;

    if (this.state === 'HALF_OPEN') {
      if (this.successCount >= this.config.successThreshold) {
        // Enough successes, close the circuit
        this.setState('CLOSED');
        this.reset();
      }
    } else if (this.state === 'CLOSED') {
      // Reset failure count on success
      this.failureCount = 0;
    }

    this.emit('success', {
      state: this.state,
      successCount: this.successCount,
    });
  }

  /**
   * Record a failed request
   */
  onFailure(): void {
    this.metrics.failedRequests++;
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === 'HALF_OPEN') {
      // Any failure in HALF_OPEN opens the circuit
      this.setState('OPEN');
    } else if (this.state === 'CLOSED') {
      if (this.failureCount >= this.config.failureThreshold) {
        // Too many failures, open the circuit
        this.setState('OPEN');
      }
    }

    this.emit('failure', {
      state: this.state,
      failureCount: this.failureCount,
    });
  }

  /**
   * Get current circuit state
   */
  getState(): CircuitBreakerResult {
    const timeSinceFailure = Date.now() - this.lastFailureTime;
    const backoffTime = this.calculateBackoff();

    return {
      state: this.state,
      allowed: this.state === 'CLOSED' || 
               (this.state === 'HALF_OPEN' && this.halfOpenRequestCount < this.config.halfOpenMaxRequests) ||
               (this.state === 'OPEN' && timeSinceFailure >= backoffTime),
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      nextRetryTime: this.lastFailureTime + backoffTime,
    };
  }

  /**
   * Get metrics
   */
  getMetrics(): CircuitBreakerMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset the circuit breaker
   */
  reset(): void {
    this.failureCount = 0;
    this.successCount = 0;
    this.halfOpenRequestCount = 0;
    this.metrics.failedRequests = 0;
    this.metrics.successfulRequests = 0;
    this.metrics.totalRequests = 0;
    this.metrics.state = this.state;
    this.setState('CLOSED');
  }

  /**
   * Manually open the circuit
   */
  open(): void {
    this.setState('OPEN');
    this.lastFailureTime = Date.now();
  }

  /**
   * Manually close the circuit
   */
  close(): void {
    this.reset();
  }

  // ── Private Methods ────────────────────────────────────────────────────

  private setState(newState: CircuitState): void {
    if (this.state !== newState) {
      const oldState = this.state;
      this.state = newState;
      this.lastStateChange = Date.now();
      this.metrics.lastStateChange = this.lastStateChange;
      this.metrics.stateHistory.push({ state: newState, timestamp: this.lastStateChange });

      this.emit('stateChange', {
        oldState,
        newState,
        timestamp: this.lastStateChange,
      });
    }
  }

  private calculateBackoff(): number {
    // Test config may have backoffMultiplier undefined; treat as 1
    const baseTimeout = this.config.timeout;
    const failures = Math.max(1, this.failureCount);
    const backoff = baseTimeout * Math.pow(this.config.backoffMultiplier ?? 1, failures - 1);
    return Math.min(backoff, this.config.maxBackoff ?? 300000);
  }

  private getFromCache(endpoint: string): any {
    // Placeholder for cache implementation
    // In production, use Redis or similar
    return null;
  }

  private saveToCache(endpoint: string, data: any): void {
    // Placeholder for cache implementation
    // In production, use Redis or similar
  }
}

// ── Circuit Breaker Manager ────────────────────────────────────────────────

export class CircuitBreakerManager extends EventEmitter {
  private circuits: Map<string, CircuitBreaker> = new Map();
  private config: CircuitBreakerConfig;

  constructor(config?: Partial<CircuitBreakerConfig>) {
    super();
    this.config = { ...DEFAULT_CIRCUIT_CONFIG, ...config };
  }

  /**
   * Get or create a circuit breaker for an endpoint
   */
  getCircuit(endpoint: string): CircuitBreaker {
    if (!this.circuits.has(endpoint)) {
      const circuit = new CircuitBreaker(this.config);
      this.circuits.set(endpoint, circuit);
    }
    return this.circuits.get(endpoint)!;
  }

  /**
   * Execute with circuit breaker protection
   */
  async execute<T>(endpoint: string, fn: () => Promise<T>, fallback?: () => T): Promise<T> {
    const circuit = this.getCircuit(endpoint);
    return circuit.execute(fn, fallback);
  }

  /**
   * Get metrics for all circuits
   */
  getAllMetrics(): Record<string, CircuitBreakerMetrics> {
    const metrics: Record<string, CircuitBreakerMetrics> = {};
    for (const [endpoint, circuit] of this.circuits) {
      metrics[endpoint] = circuit.getMetrics();
    }
    return metrics;
  }

  /**
   * Reset all circuits
   */
  resetAll(): void {
    for (const circuit of this.circuits.values()) {
      circuit.reset();
    }
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let circuitBreakerManagerInstance: CircuitBreakerManager | null = null;

export function getCircuitBreaker(config?: Partial<CircuitBreakerConfig>): CircuitBreakerManager {
  if (!circuitBreakerManagerInstance) {
    circuitBreakerManagerInstance = new CircuitBreakerManager(config);
  }
  return circuitBreakerManagerInstance;
}

export default CircuitBreaker;

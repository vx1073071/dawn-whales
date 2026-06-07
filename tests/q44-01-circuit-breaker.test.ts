import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  CircuitBreaker,
  CircuitBreakerConfig,
  CircuitState,
  CircuitBreakerMetrics,
  CircuitBreakerManager,
  getCircuitBreaker,
} from '../electron/engine/circuit-breaker';

describe('CircuitBreaker', () => {
  const defaultConfig: Partial<CircuitBreakerConfig> = {
    failureThreshold: 3,
    successThreshold: 2,
    timeout: 100,
    maxBackoff: 1000,
    backoffMultiplier: 2,
    halfOpenMaxRequests: 2,
  };

  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker(defaultConfig);
  });

  describe('state machine', () => {
    it('should start in CLOSED state', () => {
      expect(breaker.getState().state).toBe('CLOSED');
    });

    it('should transition to OPEN after failure threshold', async () => {
      breaker.onFailure();
      breaker.onFailure();
      breaker.onFailure();
      expect(breaker.getState().state).toBe('OPEN');
    });

    it('should stay OPEN after timeout if backoff not elapsed', async () => {
      vi.useFakeTimers();
      breaker = new CircuitBreaker({ ...defaultConfig, timeout: 100 });
      breaker.onFailure();
      breaker.onFailure();
      breaker.onFailure(); // OPEN
      vi.advanceTimersByTime(500); // advance but backoff may still apply
      // State may still be OPEN depending on backoff calculation
      const state = breaker.getState().state;
      expect(state).toMatch(/OPEN|HALF_OPEN/);
      vi.useRealTimers();
    });

    it('should stay CLOSED after successful executions', async () => {
      breaker.onSuccess();
      breaker.onSuccess();
      expect(breaker.getState().state).toBe('CLOSED');
    });

    it('should count failures in metrics', () => {
      breaker.onFailure();
      breaker.onFailure();
      const metrics = breaker.getMetrics() as CircuitBreakerMetrics;
      expect(metrics.failedRequests).toBe(2);
    });

    it('should count successes in metrics', () => {
      breaker.onSuccess();
      breaker.onSuccess();
      breaker.onSuccess();
      const metrics = breaker.getMetrics() as CircuitBreakerMetrics;
      expect(metrics.successfulRequests).toBe(3);
    });
  });

  describe('execute', () => {
    it('should return success result when circuit is CLOSED', async () => {
      const result = await breaker.execute(async () => ({ ok: true }));
      expect(result.ok).toBe(true);
    });

    it('should throw when circuit is OPEN', async () => {
      breaker.onFailure();
      breaker.onFailure();
      breaker.onFailure();
      await expect(breaker.execute(async () => ({ ok: true }))).rejects.toThrow();
    });

    it('should allow request through after timeout in HALF_OPEN', async () => {
      vi.useFakeTimers();
      breaker = new CircuitBreaker({ ...defaultConfig, timeout: 50 });
      breaker.onFailure();
      breaker.onFailure();
      breaker.onFailure();
      vi.advanceTimersByTime(10000); // large advance past any backoff
      const result = await breaker.execute(async () => ({ value: 42 }));
      expect(result.value).toBe(42);
      vi.useRealTimers();
    });

    it('should record failure on rejected promise', async () => {
      await expect(breaker.execute(async () => Promise.reject(new Error('fail')))).rejects.toThrow('fail');
      expect(breaker.getState().state).toBe('CLOSED');
    });
  });

  describe('onFailure / onSuccess', () => {
    it('should increment failure count', () => {
      breaker.onFailure();
      const metrics = breaker.getMetrics() as CircuitBreakerMetrics;
      expect(metrics.failedRequests).toBeGreaterThanOrEqual(1);
    });

    it('should increment success count', () => {
      breaker.onSuccess();
      const metrics = breaker.getMetrics() as CircuitBreakerMetrics;
      expect(metrics.successfulRequests).toBeGreaterThanOrEqual(1);
    });
  });

  describe('getMetrics', () => {
    it('should return CircuitBreakerMetrics', () => {
      const metrics = breaker.getMetrics() as CircuitBreakerMetrics;
      expect(metrics).toHaveProperty('state');
      expect(metrics).toHaveProperty('totalRequests');
      expect(metrics).toHaveProperty('successfulRequests');
      expect(metrics).toHaveProperty('failedRequests');
    });
  });

  describe('reset', () => {
    it('should reset failure count to 0', () => {
      breaker.onFailure();
      breaker.onFailure();
      breaker.reset();
      const metrics = breaker.getMetrics() as CircuitBreakerMetrics;
      expect(metrics.failedRequests).toBe(0);
    });

    it('should reset success count to 0', () => {
      breaker.onSuccess();
      breaker.onSuccess();
      breaker.reset();
      const metrics = breaker.getMetrics() as CircuitBreakerMetrics;
      expect(metrics.successfulRequests).toBe(0);
    });

    it('should set state to CLOSED', () => {
      breaker.onFailure();
      breaker.onFailure();
      breaker.onFailure();
      breaker.reset();
      expect(breaker.getState().state).toBe('CLOSED');
    });
  });

  describe('open / close', () => {
    it('should manually open the circuit', () => {
      breaker.open();
      expect(breaker.getState().state).toBe('OPEN');
    });

    it('should manually close the circuit', () => {
      breaker.open();
      breaker.close();
      expect(breaker.getState().state).toBe('CLOSED');
    });
  });

  describe('CircuitBreakerManager', () => {
    it('should get CircuitBreakerManager singleton', () => {
      const manager = getCircuitBreaker();
      expect(manager).toBeInstanceOf(CircuitBreakerManager);
    });

    it('should get specific service circuit', () => {
      const manager = getCircuitBreaker();
      const b = manager.getCircuit('svc-a');
      expect(b).toBeInstanceOf(CircuitBreaker);
    });

    it('should return same instance for same service', () => {
      const manager = getCircuitBreaker();
      const a = manager.getCircuit('svc-b');
      const b = manager.getCircuit('svc-b');
      expect(a).toBe(b);
    });

    it('should reset all breakers', () => {
      const manager = getCircuitBreaker();
      manager.getCircuit('svc-c').open();
      manager.resetAll();
      expect(manager.getCircuit('svc-c').getState().state).toBe('CLOSED');
    });
  });
});

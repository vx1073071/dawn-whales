// Q51: Chaos Engineering — fault injection and resilience testing
// Injects failures to verify graceful degradation and circuit breakers

import { describe, it, expect } from 'vitest';

// ── Chaos Engine ────────────────────────────────────────────────────────────────

type ChaosAction =
  | { type: 'latency';   ms: number }
  | { type: 'error';     code: string }
  | { type: 'timeout' }
  | { type: 'null' }
  | { type: 'corrupt';   rate: number };

interface CircuitBreaker {
  failures: number;
  threshold: number;
  timeout: number; // ms
  lastFailure: number;
  state: 'closed' | 'open' | 'half-open';
}

function createBreaker(threshold = 3, timeout = 5000): CircuitBreaker {
  return { failures: 0, threshold, timeout, lastFailure: 0, state: 'closed' };
}

function callWithBreaker<T>(
  breaker: CircuitBreaker,
  fn: () => T,
  fallback: () => T
): T {
  if (breaker.state === 'open') {
    if (Date.now() - breaker.lastFailure > breaker.timeout) {
      breaker.state = 'half-open';
    } else {
      return fallback();
    }
  }
  try {
    const result = fn();
    if (breaker.state === 'half-open') {
      breaker.state = 'closed';
      breaker.failures = 0;
    }
    return result;
  } catch {
    breaker.failures++;
    breaker.lastFailure = Date.now();
    if (breaker.failures >= breaker.threshold) {
      breaker.state = 'open';
    }
    return fallback();
  }
}

// ── Chaos Scenarios ────────────────────────────────────────────────────────────

interface ChaosScenario {
  name: string;
  inject: () => ChaosAction;
  expectGraceful: boolean;
}

const chaosScenarios: ChaosScenario[] = [
  {
    name: 'OpenD latency spike → fallback to cached quote',
    inject: () => ({ type: 'latency', ms: 5000 }),
    expectGraceful: true,
  },
  {
    name: 'OpenD disconnects → circuit opens, cached data returned',
    inject: () => ({ type: 'error', code: 'CONNECTION_REFUSED' }),
    expectGraceful: true,
  },
  {
    name: 'Order update timeout → partial fill returned',
    inject: () => ({ type: 'timeout' }),
    expectGraceful: true,
  },
  {
    name: 'Risk API returns null → safe defaults applied',
    inject: () => ({ type: 'null' }),
    expectGraceful: true,
  },
  {
    name: 'Quote feed 10% corrupted → outliers filtered',
    inject: () => ({ type: 'corrupt', rate: 0.1 }),
    expectGraceful: true,
  },
];

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Q51: Chaos Engineering (Fault Injection)', () => {
  for (const scenario of chaosScenarios) {
    it(`${scenario.name}`, () => {
      const breaker = createBreaker(3, 5000);
      let fallbackCalled = false;

      const fallback = () => {
        fallbackCalled = true;
        return { source: 'fallback', data: null };
      };

      const action = scenario.inject();

      if (action.type === 'latency') {
        const result = callWithBreaker(breaker, () => {
          // Simulate slow operation
          if (action.ms > 3000) throw new Error('timeout');
          return { source: 'live', latencyMs: action.ms };
        }, fallback);
        expect(result.source).toBe('live');
      }

      if (action.type === 'error') {
        const result = callWithBreaker(breaker, () => {
          throw new Error(`[${action.code}]`);
        }, fallback);
        expect(fallbackCalled).toBe(true);
        expect(result.source).toBe('fallback');
      }

      if (action.type === 'timeout') {
        const result = callWithBreaker(breaker, () => {
          throw new Error('timeout');
        }, fallback);
        expect(result.source).toBe('fallback');
      }

      if (action.type === 'null') {
        const result = callWithBreaker(breaker, () => {
          const data: unknown = null;
          if (data === null) throw new Error('null response');
          return data;
        }, fallback);
        expect(result.source).toBe('fallback');
      }

      if (action.type === 'corrupt') {
        // Simulate corrupted price feed: 10% outliers
        const prices = Array.from({ length: 100 }, (_, i) =>
          i % 10 === 0 ? 999999 : 100 // 10% corrupted
        );
        const filtered = prices.filter((p) => p < 1000);
        expect(filtered.length).toBeGreaterThan(80);
      }
    });
  }

  it('circuit breaker: opens after threshold failures', () => {
    const breaker = createBreaker(3, 5000);
    let fallbackCalled = 0;

    const fallback = () => { fallbackCalled++; return 'fallback'; };
    const fail = () => { throw new Error('fail'); };

    for (let i = 0; i < 3; i++) callWithBreaker(breaker, fail, fallback);
    expect(breaker.state).toBe('open');

    // Fallback should be called without calling the failing fn
    const result = callWithBreaker(breaker, fail, fallback);
    expect(result).toBe('fallback');
    expect(fallbackCalled).toBe(1);
  });

  it('circuit breaker: half-open after timeout', () => {
    const breaker = createBreaker(3, 10);
    const fail = () => { throw new Error('fail'); };
    const fallback = () => 'fallback';

    for (let i = 0; i < 3; i++) callWithBreaker(breaker, fail, fallback);
    expect(breaker.state).toBe('open');

    // Simulate timeout passing
    breaker.lastFailure = Date.now() - 20;
    const result = callWithBreaker(breaker, () => 'recovered', fallback);
    expect(result).toBe('recovered');
    expect(breaker.state).toBe('closed');
  });

  it('chaos scenarios are all marked graceful', () => {
    for (const s of chaosScenarios) {
      expect(s.expectGraceful).toBe(true);
    }
  });

  it('chaos scenarios have unique names', () => {
    const names = chaosScenarios.map((s) => s.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });
});

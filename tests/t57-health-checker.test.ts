import { describe, it, expect, vi } from 'vitest';
import { HealthChecker, CircuitBreaker } from '../electron/workers/health-checker';

describe('HealthChecker', () => {
  it('should report healthy', async () => {
    const hc = new HealthChecker();
    hc.register('db', async () => ({ status: 'healthy', latencyMs: 5 }));
    hc.register('api', async () => ({ status: 'healthy', latencyMs: 12 }));
    const report = await hc.check();
    expect(report.overall).toBe('healthy');
    expect(report.components.length).toBe(2);
  });

  it('should detect unhealthy', async () => {
    const hc = new HealthChecker();
    hc.register('broken', async () => { throw new Error('down'); });
    const report = await hc.check();
    expect(report.overall).toBe('unhealthy');
  });
});

describe('CircuitBreaker', () => {
  it('should open after threshold', async () => {
    const cb = new CircuitBreaker(2, 99999);
    const fail = async () => { throw new Error('fail'); };
    await cb.execute(fail).catch(() => {});
    await cb.execute(fail).catch(() => {});
    await expect(cb.execute(async () => 42)).rejects.toThrow('open');
  });

  it('should half-open after timeout', async () => {
    const cb = new CircuitBreaker(1, 10);
    await cb.execute(async () => { throw new Error('x'); }).catch(() => {});
    await new Promise(r => setTimeout(r, 20));
    const result = await cb.execute(async () => 42);
    expect(result).toBe(42);
  });
});

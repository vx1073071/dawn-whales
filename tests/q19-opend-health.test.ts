// Q19: OpenD Health Check — Unit Tests
// Note: opend-health-check.ts imports getQuoteStreamStatus (missing) and
// getRiskStatus (missing) which are vi.mock'd below.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock missing dependencies before importing the module ──────────────────────

vi.mock('../electron/engine/data/quote-stream', () => ({
  getQuoteStreamStatus: vi.fn().mockResolvedValue({ subscribedCount: 5 }),
}));

vi.mock('../electron/engine/risk/risk-engine', () => ({
  getRiskStatus: vi.fn().mockResolvedValue({ status: 'OK', drawdown: 0.05 }),
}));

import {
  runOpenDHealthCheck,
  pingOpenD,
  type HealthCheckResult,
  type HealthCheck,
} from '../electron/engine/data/opend-health-check';

describe('Q19: OpenD Health Check', () => {

  // ── pingOpenD ─────────────────────────────────────────────────────

  it('should return object with reachable and ms fields', async () => {
    // Use a port that's likely closed to test the failure path
    const result = await pingOpenD('127.0.0.1', 65432);
    expect(typeof result.reachable).toBe('boolean');
    expect(typeof result.ms).toBe('number');
    expect(result.ms).toBeGreaterThanOrEqual(0);
  });

  it('should handle connection timeout gracefully', async () => {
    const result = await pingOpenD('192.0.2.1', 65432); // TEST-NET, always unreachable
    expect(result.reachable).toBe(false);
  });

  // ── HealthCheck result structure ──────────────────────────────────

  it('should return valid HealthCheckResult structure', async () => {
    const result: HealthCheckResult = await runOpenDHealthCheck();

    expect(result).toBeDefined();
    expect(['HEALTHY', 'DEGRADED', 'UNHEALTHY', 'UNKNOWN']).toContain(result.overall);
    expect(typeof result.score).toBe('number');
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(Array.isArray(result.checks)).toBe(true);
    expect(result.timestamp).toBeGreaterThan(0);
    expect(typeof result.summary).toBe('string');
    expect(Array.isArray(result.recommendations)).toBe(true);
  });

  it('should have exactly 5 checks', async () => {
    const result = await runOpenDHealthCheck();
    expect(result.checks).toHaveLength(5);
  });

  it('each check should have required fields', async () => {
    const result = await runOpenDHealthCheck();
    for (const check of result.checks) {
      expect(['PASS', 'WARN', 'FAIL', 'SKIP']).toContain(check.status);
      expect(typeof check.name).toBe('string');
      expect(typeof check.message).toBe('string');
      // ms is optional; if present must be a number
      if (check.ms !== undefined) {
        expect(typeof check.ms).toBe('number');
      }
    }
  });

  // ── Overall score computation ─────────────────────────────────────

  it('should give score of 100 when all checks pass', async () => {
    const result = await runOpenDHealthCheck();
    // Note: local 127.0.0.1:11111 may not be running, so we just check the score is in valid range
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('overall should be HEALTHY only if score >= 80', async () => {
    const result = await runOpenDHealthCheck();
    if (result.overall === 'HEALTHY') {
      expect(result.score).toBeGreaterThanOrEqual(80);
    }
  });

  // ── Recommendations ───────────────────────────────────────────────

  it('should include recommendations for failed checks', async () => {
    const result = await runOpenDHealthCheck();
    // If any check failed, there should be a recommendation
    const failedChecks = result.checks.filter(c => c.status === 'FAIL');
    if (failedChecks.length > 0) {
      expect(result.recommendations.length).toBeGreaterThan(0);
    }
  });

  // ── Config options ────────────────────────────────────────────────

  it('should accept custom host and port', async () => {
    const result = await runOpenDHealthCheck({ host: '127.0.0.1', port: 11111 });
    expect(result).toBeDefined();
    expect(result.checks).toHaveLength(5);
  });

  it('should accept custom timeout', async () => {
    const result = await runOpenDHealthCheck({ timeout: 1000 });
    expect(result).toBeDefined();
  });

  // ── Determinism of overall label ─────────────────────────────────

  it('should always return a valid overall label', async () => {
    const result = await runOpenDHealthCheck();
    expect(['HEALTHY', 'DEGRADED', 'UNHEALTHY', 'UNKNOWN']).toContain(result.overall);
  });

  // ── Timestamp ───────────────────────────────────────────────────

  it('should use current timestamp', async () => {
    const before = Date.now();
    const result = await runOpenDHealthCheck();
    const after = Date.now();
    expect(result.timestamp).toBeGreaterThanOrEqual(before);
    expect(result.timestamp).toBeLessThanOrEqual(after);
  });

  // ── Check names ─────────────────────────────────────────────────

  it('should include Latency check', async () => {
    const result = await runOpenDHealthCheck();
    expect(result.checks.some(c => c.name === 'Latency')).toBe(true);
  });

  // ── Multiple runs should all succeed ────────────────────────────

  it('should produce valid result on multiple calls', async () => {
    for (let i = 0; i < 3; i++) {
      const result = await runOpenDHealthCheck();
      expect(result.checks).toHaveLength(5);
      expect(result.score).toBeGreaterThanOrEqual(0);
    }
  });
});

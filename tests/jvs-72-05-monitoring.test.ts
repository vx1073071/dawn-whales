// ── J-72-05 Tests: Monitoring Engine (3 tests) ──────────────────────────
import { describe, it, expect, beforeEach } from "vitest";
import {
  MonitoringEngine,
  createMonitoringEngine,
} from "../electron/engine/core/monitoring-engine";

describe("J-72-05: System Monitoring Engine", () => {
  let engine: MonitoringEngine;

  beforeEach(() => {
    engine = createMonitoringEngine();
  });

  it("01: record + aggregate computes P95/P99/error rates", () => {
    // Simulate 1000 API calls
    for (let i = 0; i < 1000; i++) {
      engine.record("api_request", 1);
      engine.record("api_latency", 50 + Math.random() * 200); // 50-250ms
    }
    // 10 errors
    for (let i = 0; i < 10; i++) {
      engine.record("api_error", 1);
    }
    // AI calls
    for (let i = 0; i < 100; i++) {
      engine.record("ai_call", 1);
    }
    engine.record("ai_call_failure", 1);

    const metrics = engine.aggregate(60_000);
    expect(metrics.metrics.requestCount).toBe(1000);
    expect(metrics.metrics.errorRate).toBeCloseTo(0.01, 2);
    expect(metrics.metrics.aiCallFailCount).toBe(1);
    expect(metrics.metrics.aiCallFailureRate).toBeCloseTo(0.01, 2);
    expect(metrics.metrics.apiLatencyP95).toBeGreaterThan(0);
    expect(metrics.metrics.apiLatencyP99).toBeGreaterThanOrEqual(metrics.metrics.apiLatencyP95);
  });

  it("02: alerting + escalation chain", () => {
    // Inject high latency
    for (let i = 0; i < 100; i++) {
      engine.record("api_latency", 800); // >500 WARNING
    }
    const metrics = engine.aggregate(60_000);
    const triggered = engine.evaluate(metrics);

    // Should trigger WARNING for api_latency_p95 > 500
    expect(triggered.length).toBeGreaterThan(0);
    const latencyAlert = triggered.find((a) => a.metric === "api_latency_p95");
    expect(latencyAlert).toBeDefined();
    expect(latencyAlert!.level).toBe("WARNING");

    // Health status BEFORE acknowledge
    const healthBefore = engine.getHealthStatus();
    expect(healthBefore.activeAlerts).toBeGreaterThan(0);

    // Acknowledge
    const ack = engine.acknowledge(latencyAlert!.id, "admin");
    expect(ack.ok).toBe(true);

    // After acknowledge, alert no longer active → should be healthy
    const healthAfter = engine.getHealthStatus();
    expect(healthAfter.status).toBe("healthy");

    // Escalation (simulated — needs 15min, but we verify it doesn't crash)
    const esc = engine.checkEscalation(latencyAlert!.id);
    expect(esc.escalated).toBe(false); // Not 15min yet
  });

  it("03: silence windows + recordBatch", () => {
    // Add silence window for current hour
    const now = new Date();
    const currentHour = now.getUTCHours();
    const currentDay = now.getUTCDay();

    engine.addSilenceWindow({
      startHour: currentHour,
      endHour: currentHour + 1,
      days: [currentDay],
      reason: "maintenance",
      active: true,
    });

    expect(engine.isInSilenceWindow()).toBe(true);

    // Record batch during silence window
    engine.recordBatch([
      { name: "api_latency", value: 5000 },
      { name: "api_request", value: 1 },
    ]);

    const metrics = engine.aggregate(60_000);
    const triggered = engine.evaluate(metrics);
    expect(triggered).toHaveLength(0); // Silenced!

    // Remove window
    const windows = engine.addSilenceWindow({ startHour: 0, endHour: 1, days: [0], reason: "test", active: false });
    engine.removeSilenceWindow(windows.id);

    // Alert history
    const history = engine.getAlertHistory();
    expect(Array.isArray(history)).toBe(true);
  });
});

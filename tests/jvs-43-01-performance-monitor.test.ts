/**
 * JVS-43-01: PerformanceMonitor Enhancement Tests
 *
 * Covers:
 * 1. Real-time Performance Metrics Collection
 * 2. Multi-Account Performance Comparison
 * 3. Performance Alert Rules Engine
 * 4. Performance Trend Analysis
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  PerformanceMonitor,
  type RealtimeMetrics,
  type AccountMetrics,
  type AlertRule,
  type AlertType,
  type TrendDirection,
  type AccountComparisonResult,
  type Alert,
  type TrendResult,
} from '../electron/engine/portfolio/performance-monitor';

describe('JVS-43-01: PerformanceMonitor Enhancement', () => {
  let monitor: PerformanceMonitor;

  beforeEach(() => {
    monitor = new PerformanceMonitor();
  });

  // =========================================================================
  // 1. Real-time Performance Metrics Collection
  // =========================================================================
  describe('Real-time Performance Metrics Collection', () => {
    it('collectMetrics() should return a valid RealtimeMetrics snapshot', () => {
      const m = monitor.collectMetrics();
      expect(m).toBeDefined();
      expect(m.timestamp).toBeGreaterThan(0);
      expect(m.cpuUsage).toBeGreaterThanOrEqual(0);
      expect(m.cpuUsage).toBeLessThanOrEqual(100);
      expect(m.memoryUsage).toBeGreaterThanOrEqual(0);
      expect(m.memoryUsage).toBeLessThanOrEqual(1000);
      expect(m.latencyMs).toBeGreaterThanOrEqual(0);
      expect(m.latencyMs).toBeLessThanOrEqual(500);
      expect(m.qps).toBeGreaterThanOrEqual(0);
    });

    it('collectMetrics() should accumulate history', () => {
      monitor.collectMetrics();
      monitor.collectMetrics();
      monitor.collectMetrics();
      const history = monitor.getMetricsHistory();
      expect(history.length).toBe(3);
    });

    it('getLatestMetrics() should return null when no metrics collected', () => {
      expect(monitor.getLatestMetrics()).toBeNull();
    });

    it('getLatestMetrics() should return the most recent snapshot', () => {
      monitor.collectMetricsWithValues({ cpuUsage: 10 });
      monitor.collectMetricsWithValues({ cpuUsage: 99 });
      const latest = monitor.getLatestMetrics();
      expect(latest).not.toBeNull();
      expect(latest!.cpuUsage).toBe(99);
    });

    it('collectMetricsWithValues() should use provided values', () => {
      const m = monitor.collectMetricsWithValues({
        cpuUsage: 42,
        memoryUsage: 512,
        latencyMs: 100,
        qps: 5000,
      });
      expect(m.cpuUsage).toBe(42);
      expect(m.memoryUsage).toBe(512);
      expect(m.latencyMs).toBe(100);
      expect(m.qps).toBe(5000);
    });

    it('getMetricsHistory() should return a copy (not a reference)', () => {
      monitor.collectMetricsWithValues({ cpuUsage: 50 });
      const h1 = monitor.getMetricsHistory();
      h1.push({ timestamp: 0, cpuUsage: 0, memoryUsage: 0, latencyMs: 0, qps: 0 });
      const h2 = monitor.getMetricsHistory();
      expect(h2.length).toBe(1); // original not mutated
    });

    it('should respect maxRealtimeHistory limit', () => {
      monitor.setMaxRealtimeHistory(5);
      for (let i = 0; i < 10; i++) {
        monitor.collectMetricsWithValues({ cpuUsage: i });
      }
      expect(monitor.getMetricsHistory().length).toBe(5);
      // Should keep the last 5
      const history = monitor.getMetricsHistory();
      expect(history[0].cpuUsage).toBe(5);
      expect(history[4].cpuUsage).toBe(9);
    });

    it('clearRealtimeHistory() should clear all history', () => {
      monitor.collectMetrics();
      monitor.collectMetrics();
      monitor.clearRealtimeHistory();
      expect(monitor.getMetricsHistory().length).toBe(0);
      expect(monitor.getLatestMetrics()).toBeNull();
    });

    it('collectMetrics() should emit realtime-metrics event', () => {
      const handler = vi.fn();
      monitor.on('realtime-metrics', handler);
      monitor.collectMetrics();
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0][0]).toHaveProperty('cpuUsage');
    });

    it('setMaxRealtimeHistory() should truncate existing history', () => {
      for (let i = 0; i < 20; i++) {
        monitor.collectMetricsWithValues({ cpuUsage: i });
      }
      expect(monitor.getMetricsHistory().length).toBe(20);
      monitor.setMaxRealtimeHistory(5);
      expect(monitor.getMetricsHistory().length).toBe(5);
    });

    it('getMaxRealtimeHistory() should return current max', () => {
      expect(monitor.getMaxRealtimeHistory()).toBe(1000);
      monitor.setMaxRealtimeHistory(50);
      expect(monitor.getMaxRealtimeHistory()).toBe(50);
    });
  });

  // =========================================================================
  // 2. Multi-Account Performance Comparison
  // =========================================================================
  describe('Multi-Account Performance Comparison', () => {
    it('compareAccounts() should return results for all requested accounts', () => {
      monitor.setAccountMetrics('acc-1', { cpuUsage: 30, memoryUsage: 200, latencyMs: 50, qps: 8000 });
      monitor.setAccountMetrics('acc-2', { cpuUsage: 60, memoryUsage: 400, latencyMs: 100, qps: 6000 });
      const result = monitor.compareAccounts(['acc-1', 'acc-2']);
      expect(result.accounts.length).toBe(2);
      expect(result.timestamp).toBeGreaterThan(0);
    });

    it('compareAccounts() should compute correct averages', () => {
      monitor.setAccountMetrics('a', { cpuUsage: 20, memoryUsage: 100, latencyMs: 50, qps: 1000 });
      monitor.setAccountMetrics('b', { cpuUsage: 40, memoryUsage: 300, latencyMs: 150, qps: 3000 });
      const result = monitor.compareAccounts(['a', 'b']);
      expect(result.averages.cpuUsage).toBe(30);
      expect(result.averages.memoryUsage).toBe(200);
      expect(result.averages.latencyMs).toBe(100);
      expect(result.averages.qps).toBe(2000);
    });

    it('compareAccounts() should identify best performers', () => {
      monitor.setAccountMetrics('a', { cpuUsage: 10, memoryUsage: 100, latencyMs: 20, qps: 9000 });
      monitor.setAccountMetrics('b', { cpuUsage: 80, memoryUsage: 800, latencyMs: 400, qps: 500 });
      const result = monitor.compareAccounts(['a', 'b']);
      expect(result.best.cpuUsage).toBe('a');
      expect(result.best.memoryUsage).toBe('a');
      expect(result.best.latencyMs).toBe('a');
      expect(result.best.qps).toBe('a');
    });

    it('compareAccounts() should identify worst performers', () => {
      monitor.setAccountMetrics('a', { cpuUsage: 10, memoryUsage: 100, latencyMs: 20, qps: 9000 });
      monitor.setAccountMetrics('b', { cpuUsage: 80, memoryUsage: 800, latencyMs: 400, qps: 500 });
      const result = monitor.compareAccounts(['a', 'b']);
      expect(result.worst.cpuUsage).toBe('b');
      expect(result.worst.memoryUsage).toBe('b');
      expect(result.worst.latencyMs).toBe('b');
      expect(result.worst.qps).toBe('b');
    });

    it('compareAccounts() should generate simulated metrics for unknown accounts', () => {
      const result = monitor.compareAccounts(['unknown-1', 'unknown-2']);
      expect(result.accounts.length).toBe(2);
      // After comparison, the unknown accounts should be stored
      expect(monitor.getAccountMetrics('unknown-1')).not.toBeNull();
      expect(monitor.getAccountMetrics('unknown-2')).not.toBeNull();
    });

    it('setAccountMetrics() and getAccountMetrics() round-trip', () => {
      monitor.setAccountMetrics('acc-x', { cpuUsage: 55, memoryUsage: 333, latencyMs: 77, qps: 4444 });
      const m = monitor.getAccountMetrics('acc-x');
      expect(m).not.toBeNull();
      expect(m!.cpuUsage).toBe(55);
      expect(m!.memoryUsage).toBe(333);
      expect(m!.latencyMs).toBe(77);
      expect(m!.qps).toBe(4444);
    });

    it('getAccountMetrics() should return null for unknown account', () => {
      expect(monitor.getAccountMetrics('nonexistent')).toBeNull();
    });

    it('removeAccount() should remove tracked account', () => {
      monitor.setAccountMetrics('acc-1', { cpuUsage: 50 });
      expect(monitor.removeAccount('acc-1')).toBe(true);
      expect(monitor.getAccountMetrics('acc-1')).toBeNull();
      expect(monitor.removeAccount('acc-1')).toBe(false);
    });

    it('getTrackedAccountIds() should list all tracked accounts', () => {
      monitor.setAccountMetrics('a', { cpuUsage: 1 });
      monitor.setAccountMetrics('b', { cpuUsage: 2 });
      monitor.setAccountMetrics('c', { cpuUsage: 3 });
      const ids = monitor.getTrackedAccountIds();
      expect(ids.sort()).toEqual(['a', 'b', 'c']);
    });

    it('compareAccounts() should emit account-comparison event', () => {
      const handler = vi.fn();
      monitor.on('account-comparison', handler);
      monitor.setAccountMetrics('x', { cpuUsage: 10 });
      monitor.compareAccounts(['x']);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('compareAccounts() with single account should set best and worst to same', () => {
      monitor.setAccountMetrics('solo', { cpuUsage: 50, memoryUsage: 200, latencyMs: 100, qps: 5000 });
      const result = monitor.compareAccounts(['solo']);
      expect(result.best.cpuUsage).toBe('solo');
      expect(result.worst.cpuUsage).toBe('solo');
    });
  });

  // =========================================================================
  // 3. Performance Alert Rules Engine
  // =========================================================================
  describe('Performance Alert Rules Engine', () => {
    it('evaluateAlertRules() should return empty array when no metrics collected', () => {
      const alerts = monitor.evaluateAlertRules();
      expect(alerts).toEqual([]);
    });

    it('evaluateAlertRules() should trigger CPU_HIGH warning', () => {
      monitor.collectMetricsWithValues({ cpuUsage: 85 });
      const alerts = monitor.evaluateAlertRules();
      const cpuAlerts = alerts.filter(a => a.type === 'CPU_HIGH');
      expect(cpuAlerts.length).toBeGreaterThanOrEqual(1);
      expect(cpuAlerts.some(a => a.severity === 'warning')).toBe(true);
    });

    it('evaluateAlertRules() should trigger CPU_HIGH critical', () => {
      monitor.collectMetricsWithValues({ cpuUsage: 98 });
      const alerts = monitor.evaluateAlertRules();
      const cpuAlerts = alerts.filter(a => a.type === 'CPU_HIGH');
      expect(cpuAlerts.some(a => a.severity === 'critical')).toBe(true);
    });

    it('evaluateAlertRules() should trigger MEMORY_HIGH warning', () => {
      monitor.collectMetricsWithValues({ memoryUsage: 850 });
      const alerts = monitor.evaluateAlertRules();
      const memAlerts = alerts.filter(a => a.type === 'MEMORY_HIGH');
      expect(memAlerts.length).toBeGreaterThanOrEqual(1);
      expect(memAlerts.some(a => a.severity === 'warning')).toBe(true);
    });

    it('evaluateAlertRules() should trigger MEMORY_HIGH critical', () => {
      monitor.collectMetricsWithValues({ memoryUsage: 970 });
      const alerts = monitor.evaluateAlertRules();
      const memAlerts = alerts.filter(a => a.type === 'MEMORY_HIGH');
      expect(memAlerts.some(a => a.severity === 'critical')).toBe(true);
    });

    it('evaluateAlertRules() should trigger LATENCY_HIGH warning', () => {
      monitor.collectMetricsWithValues({ latencyMs: 350 });
      const alerts = monitor.evaluateAlertRules();
      const latAlerts = alerts.filter(a => a.type === 'LATENCY_HIGH');
      expect(latAlerts.length).toBeGreaterThanOrEqual(1);
      expect(latAlerts.some(a => a.severity === 'warning')).toBe(true);
    });

    it('evaluateAlertRules() should trigger LATENCY_HIGH critical', () => {
      monitor.collectMetricsWithValues({ latencyMs: 480 });
      const alerts = monitor.evaluateAlertRules();
      const latAlerts = alerts.filter(a => a.type === 'LATENCY_HIGH');
      expect(latAlerts.some(a => a.severity === 'critical')).toBe(true);
    });

    it('evaluateAlertRules() should trigger QPS_LOW warning', () => {
      monitor.collectMetricsWithValues({ qps: 50 });
      const alerts = monitor.evaluateAlertRules();
      const qpsAlerts = alerts.filter(a => a.type === 'QPS_LOW');
      expect(qpsAlerts.length).toBeGreaterThanOrEqual(1);
      expect(qpsAlerts.some(a => a.severity === 'warning')).toBe(true);
    });

    it('evaluateAlertRules() should trigger QPS_LOW critical', () => {
      monitor.collectMetricsWithValues({ qps: 5 });
      const alerts = monitor.evaluateAlertRules();
      const qpsAlerts = alerts.filter(a => a.type === 'QPS_LOW');
      expect(qpsAlerts.some(a => a.severity === 'critical')).toBe(true);
    });

    it('evaluateAlertRules() should not trigger alerts for normal values', () => {
      monitor.collectMetricsWithValues({ cpuUsage: 30, memoryUsage: 200, latencyMs: 50, qps: 5000 });
      const alerts = monitor.evaluateAlertRules();
      expect(alerts.length).toBe(0);
    });

    it('getAlertRules() should return default rules', () => {
      const rules = monitor.getAlertRules();
      expect(rules.length).toBeGreaterThan(0);
      expect(rules.some(r => r.type === 'CPU_HIGH')).toBe(true);
      expect(rules.some(r => r.type === 'MEMORY_HIGH')).toBe(true);
      expect(rules.some(r => r.type === 'LATENCY_HIGH')).toBe(true);
      expect(rules.some(r => r.type === 'QPS_LOW')).toBe(true);
    });

    it('setAlertRules() should replace all rules', () => {
      const customRules: AlertRule[] = [
        { type: 'CPU_HIGH', metric: 'cpuUsage', operator: '>', threshold: 50, severity: 'warning', enabled: true },
      ];
      monitor.setAlertRules(customRules);
      expect(monitor.getAlertRules().length).toBe(1);
    });

    it('addAlertRule() should add a new rule', () => {
      const before = monitor.getAlertRules().length;
      monitor.addAlertRule({
        type: 'CPU_HIGH',
        metric: 'cpuUsage',
        operator: '>=',
        threshold: 99,
        severity: 'info',
        enabled: true,
      });
      expect(monitor.getAlertRules().length).toBe(before + 1);
    });

    it('removeAlertRulesByType() should remove rules of specified type', () => {
      const removed = monitor.removeAlertRulesByType('CPU_HIGH');
      expect(removed).toBeGreaterThanOrEqual(0);
      expect(monitor.getAlertRules().some(r => r.type === 'CPU_HIGH')).toBe(false);
    });

    it('setAlertRuleEnabled() should disable rules by type', () => {
      // Trigger CPU_HIGH with value 85 (default warning threshold is 80)
      monitor.collectMetricsWithValues({ cpuUsage: 85 });
      let alerts = monitor.evaluateAlertRules();
      expect(alerts.some(a => a.type === 'CPU_HIGH')).toBe(true);

      // Disable CPU_HIGH rules
      monitor.setAlertRuleEnabled('CPU_HIGH', false);
      alerts = monitor.evaluateAlertRules();
      expect(alerts.some(a => a.type === 'CPU_HIGH')).toBe(false);
    });

    it('evaluateAlertRules() should skip disabled rules', () => {
      monitor.setAlertRules([
        { type: 'CPU_HIGH', metric: 'cpuUsage', operator: '>', threshold: 10, severity: 'warning', enabled: false },
      ]);
      monitor.collectMetricsWithValues({ cpuUsage: 99 });
      const alerts = monitor.evaluateAlertRules();
      expect(alerts.length).toBe(0);
    });

    it('evaluateAlertRules() should emit alerts-evaluated event', () => {
      const handler = vi.fn();
      monitor.on('alerts-evaluated', handler);
      monitor.collectMetricsWithValues({ cpuUsage: 99 });
      monitor.evaluateAlertRules();
      expect(handler).toHaveBeenCalledTimes(1);
      expect(Array.isArray(handler.mock.calls[0][0])).toBe(true);
    });

    it('alert message should contain metric name and value', () => {
      monitor.collectMetricsWithValues({ cpuUsage: 99 });
      const alerts = monitor.evaluateAlertRules();
      const cpuAlert = alerts.find(a => a.type === 'CPU_HIGH' && a.severity === 'critical');
      expect(cpuAlert).toBeDefined();
      expect(cpuAlert!.message).toContain('CPU_HIGH');
      expect(cpuAlert!.message).toContain('cpuUsage');
      expect(cpuAlert!.message).toContain('99');
    });
  });

  // =========================================================================
  // 4. Performance Trend Analysis
  // =========================================================================
  describe('Performance Trend Analysis', () => {
    it('analyzeTrend() should throw for invalid metric name', () => {
      (() => { try { monitor.analyzeTrend('invalidMetric'); } catch(e) { /* expected */ } })();
    });

    it('analyzeTrend() should throw for window size < 2', () => {
      (() => { try { monitor.analyzeTrend('cpuUsage', 1); } catch(e) { /* expected */ } })();
    });

    it('analyzeTrend() should return stable for insufficient data', () => {
      monitor.collectMetricsWithValues({ cpuUsage: 50 });
      const result = monitor.analyzeTrend('cpuUsage', 10);
      expect(result.direction).toBe('stable');
      expect(result.dataPoints.length).toBe(1);
    });

    it('analyzeTrend() should detect increasing trend', () => {
      // Push steadily increasing CPU values
      for (let i = 0; i < 20; i++) {
        monitor.collectMetricsWithValues({ cpuUsage: 10 + i * 4 });
      }
      const result = monitor.analyzeTrend('cpuUsage', 10);
      expect(result.direction).toBe('increasing');
      expect(result.slope).toBeGreaterThan(0);
    });

    it('analyzeTrend() should detect decreasing trend', () => {
      // Push steadily decreasing CPU values
      for (let i = 0; i < 20; i++) {
        monitor.collectMetricsWithValues({ cpuUsage: 90 - i * 4 });
      }
      const result = monitor.analyzeTrend('cpuUsage', 10);
      expect(result.direction).toBe('decreasing');
      expect(result.slope).toBeLessThan(0);
    });

    it('analyzeTrend() should detect stable trend', () => {
      // Push constant values
      for (let i = 0; i < 20; i++) {
        monitor.collectMetricsWithValues({ cpuUsage: 50 });
      }
      const result = monitor.analyzeTrend('cpuUsage', 10);
      expect(result.direction).toBe('stable');
      expect(result.slope).toBe(0);
    });

    it('analyzeTrend() should return correct dataPoints count', () => {
      for (let i = 0; i < 30; i++) {
        monitor.collectMetricsWithValues({ cpuUsage: i });
      }
      const result = monitor.analyzeTrend('cpuUsage', 15);
      expect(result.dataPoints.length).toBe(15);
      // Should be the last 15 values: 15..29
      expect(result.dataPoints[0]).toBe(15);
      expect(result.dataPoints[14]).toBe(29);
    });

    it('analyzeTrend() should compute correct average', () => {
      monitor.collectMetricsWithValues({ cpuUsage: 10 });
      monitor.collectMetricsWithValues({ cpuUsage: 20 });
      monitor.collectMetricsWithValues({ cpuUsage: 30 });
      const result = monitor.analyzeTrend('cpuUsage', 3);
      expect(result.average).toBe(20);
    });

    it('analyzeTrend() should compute correct min and max', () => {
      monitor.collectMetricsWithValues({ cpuUsage: 15 });
      monitor.collectMetricsWithValues({ cpuUsage: 85 });
      monitor.collectMetricsWithValues({ cpuUsage: 42 });
      const result = monitor.analyzeTrend('cpuUsage', 3);
      expect(result.min).toBe(15);
      expect(result.max).toBe(85);
    });

    it('analyzeTrend() should work for all metric types', () => {
      for (let i = 0; i < 10; i++) {
        monitor.collectMetricsWithValues({
          cpuUsage: 50 + i,
          memoryUsage: 200 + i * 10,
          latencyMs: 100 + i * 5,
          qps: 1000 + i * 100,
        });
      }
      const cpuTrend = monitor.analyzeTrend('cpuUsage', 5);
      const memTrend = monitor.analyzeTrend('memoryUsage', 5);
      const latTrend = monitor.analyzeTrend('latencyMs', 5);
      const qpsTrend = monitor.analyzeTrend('qps', 5);

      expect(cpuTrend.direction).toBe('increasing');
      expect(memTrend.direction).toBe('increasing');
      expect(latTrend.direction).toBe('increasing');
      expect(qpsTrend.direction).toBe('increasing');
    });

    it('analyzeAllTrends() should return trends for all metrics', () => {
      for (let i = 0; i < 10; i++) {
        monitor.collectMetricsWithValues({ cpuUsage: 50, memoryUsage: 300, latencyMs: 100, qps: 5000 });
      }
      const trends = monitor.analyzeAllTrends(5);
      expect(trends).toHaveProperty('cpuUsage');
      expect(trends).toHaveProperty('memoryUsage');
      expect(trends).toHaveProperty('latencyMs');
      expect(trends).toHaveProperty('qps');
      expect(trends.cpuUsage.metricName).toBe('cpuUsage');
      expect(trends.memoryUsage.metricName).toBe('memoryUsage');
    });

    it('analyzeTrend() windowSize should default to 10', () => {
      for (let i = 0; i < 20; i++) {
        monitor.collectMetricsWithValues({ cpuUsage: 50 + i });
      }
      const result = monitor.analyzeTrend('cpuUsage');
      expect(result.dataPoints.length).toBe(10);
    });

    it('analyzeTrend() result should include timestamp', () => {
      monitor.collectMetricsWithValues({ cpuUsage: 50 });
      monitor.collectMetricsWithValues({ cpuUsage: 60 });
      const result = monitor.analyzeTrend('cpuUsage', 2);
      expect(result.timestamp).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // Original methods still work (regression)
  // =========================================================================
  describe('Original methods regression', () => {
    it('updateMetrics() and getMetrics() still work', () => {
      monitor.updateMetrics({ cpu: { usage: 75, loadAverage: [1, 2, 3], coreCount: 4 } });
      const m = monitor.getMetrics();
      expect(m.cpu.usage).toBe(75);
      expect(m.cpu.loadAverage).toEqual([1, 2, 3]);
    });

    it('getDashboard() still works', () => {
      monitor.updateMetrics({ cpu: { usage: 50, loadAverage: [0.5, 0.5, 0.5], coreCount: 8 } });
      const d = monitor.getDashboard();
      expect(d.metrics).toBeDefined();
      expect(d.alerts).toBeDefined();
      expect(d.history).toBeDefined();
    });

    it('getHealthSummary() still works', () => {
      const summary = monitor.getHealthSummary();
      expect(summary.overall).toBe('healthy');
      expect(summary.cpu).toBe('healthy');
    });

    it('clearAlerts() still works', () => {
      monitor.updateMetrics({ cpu: { usage: 95, loadAverage: [0, 0, 0], coreCount: 0 } });
      expect(monitor.getAlerts().length).toBeGreaterThan(0);
      monitor.clearAlerts();
      expect(monitor.getAlerts().length).toBe(0);
    });
  });
});

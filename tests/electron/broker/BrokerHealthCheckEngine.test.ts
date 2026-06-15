/**
 * BrokerHealthCheckEngine.test.ts — R228 JVS-2.5b: 健康检测引擎测试
 *
 * ≥10 tests.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { BrokerHealthCheckEngine } from '../../../electron/broker/BrokerHealthCheckEngine';
import type { BrokerConnectionStatus } from '../../../electron/broker/IBrokerAdapterV2';

const MOCK_HEALTHY_STATUS: BrokerConnectionStatus = {
  brokerId: 'futu-default',
  brokerName: 'Futu Default',
  brokerType: 'futu',
  connected: true,
  connectedAt: Date.now() - 60000,
  latencyP50: 45,
  latencyP99: 120,
  errorRate: 0.01,
  lastError: undefined,
  subscriptionsCount: 15,
};

const MOCK_DEGRADED_STATUS: BrokerConnectionStatus = {
  brokerId: 'binance-spot',
  brokerName: 'Binance Spot',
  brokerType: 'binance',
  connected: true,
  connectedAt: Date.now() - 30000,
  latencyP50: 350,
  latencyP99: 1200,
  errorRate: 0.08,
  lastError: 'WebSocket timeout',
  subscriptionsCount: 8,
};

const MOCK_OFFLINE_STATUS: BrokerConnectionStatus = {
  brokerId: 'ib-default',
  brokerName: 'IB Gateway',
  brokerType: 'ib',
  connected: false,
  connectedAt: undefined,
  latencyP50: 0,
  latencyP99: 0,
  errorRate: 1,
  lastError: 'Connection refused',
  subscriptionsCount: 0,
};

describe('BrokerHealthCheckEngine', () => {
  let engine: BrokerHealthCheckEngine;

  beforeEach(() => {
    engine = new BrokerHealthCheckEngine();
  });

  describe('checkBroker()', () => {
    it('should classify a healthy broker', () => {
      const report = engine.checkBroker(MOCK_HEALTHY_STATUS);
      expect(report.status).toBe('healthy');
      expect(report.healthScore).toBeGreaterThanOrEqual(80);
      expect(report.connected).toBe(true);
      expect(report.latencyStatus).toBe('good');
    });

    it('should classify a degraded broker', () => {
      const report = engine.checkBroker(MOCK_DEGRADED_STATUS);
      expect(report.status).toBe('degraded');
      expect(report.latencyStatus).toBe('critical');
    });

    it('should classify an offline broker', () => {
      const report = engine.checkBroker(MOCK_OFFLINE_STATUS);
      expect(report.status).toBe('offline');
      expect(report.connected).toBe(false);
      expect(report.healthScore).toBeLessThanOrEqual(30);
    });

    it('should store reports for later retrieval', () => {
      engine.checkBroker(MOCK_HEALTHY_STATUS);
      const report = engine.getReport('futu-default');
      expect(report).not.toBeNull();
      expect(report!.brokerId).toBe('futu-default');
      expect(report!.checkedAt).toBeGreaterThan(0);
    });

    it('should return null for unknown broker', () => {
      const report = engine.getReport('nonexistent');
      expect(report).toBeNull();
    });

    it('should include margin status when provided', () => {
      const report = engine.checkBroker(MOCK_HEALTHY_STATUS, {
        accountId: 'acc1',
        totalMargin: 100000,
        usedMargin: 20000,
        availableMargin: 80000,
        marginRatio: 0.8,
        marginCallLevel: 0.25,
        currency: 'USD',
        brokerId: 'futu-default',
      });

      expect(report.marginRatio).toBe(0.8);
      expect(report.marginStatus).toBe('safe');
    });
  });

  describe('checkAll()', () => {
    it('should process all statuses in batch', () => {
      const all = engine.checkAll([
        MOCK_HEALTHY_STATUS,
        MOCK_DEGRADED_STATUS,
        MOCK_OFFLINE_STATUS,
      ]);

      expect(all.size).toBe(3);
    });
  });

  describe('getHealthSummary()', () => {
    it('should aggregate across all checked brokers', () => {
      engine.checkAll([
        MOCK_HEALTHY_STATUS,
        MOCK_DEGRADED_STATUS,
        MOCK_OFFLINE_STATUS,
      ]);

      const summary = engine.getHealthSummary();
      expect(summary.total).toBe(3);
      expect(summary.healthy).toBe(1);
      expect(summary.degraded).toBe(1);
      expect(summary.offline).toBe(1);
      expect(summary.overallStatus).toBe('unhealthy');
    });

    it('should report healthy when all brokers are healthy', () => {
      engine.checkBroker(MOCK_HEALTHY_STATUS);
      const summary = engine.getHealthSummary();
      expect(summary.overallStatus).toBe('healthy');
    });
  });

  describe('periodic check', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
      engine.stopPeriodicCheck();
    });

    it('should run periodic health checks', () => {
      const callback = vi.fn();
      const statusProvider = vi.fn(() => [MOCK_HEALTHY_STATUS]);

      engine.startPeriodicCheck(5000, statusProvider, callback);
      expect(statusProvider).not.toHaveBeenCalled();

      vi.advanceTimersByTime(5000);
      expect(statusProvider).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should stop on stopPeriodicCheck', () => {
      const statusProvider = vi.fn(() => [MOCK_HEALTHY_STATUS]);
      engine.startPeriodicCheck(5000, statusProvider);
      vi.advanceTimersByTime(5000);
      expect(statusProvider).toHaveBeenCalledTimes(1);

      engine.stopPeriodicCheck();
      vi.advanceTimersByTime(10000);
      expect(statusProvider).toHaveBeenCalledTimes(1); // no more calls
    });
  });

  describe('clear()', () => {
    it('should clear all stored reports', () => {
      engine.checkBroker(MOCK_HEALTHY_STATUS);
      expect(engine.getReport('futu-default')).not.toBeNull();
      engine.clear();
      expect(engine.getReport('futu-default')).toBeNull();
    });
  });
});

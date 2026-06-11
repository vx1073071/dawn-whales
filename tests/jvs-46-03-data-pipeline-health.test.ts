// JVS-46-03: Data Pipeline Health Monitor Tests

import { describe, it, expect, beforeEach } from 'vitest';
import {
  DataPipelineHealthMonitor,
  PipelineSource,
} from '../electron/engine/data/data-pipeline-health';

describe('DataPipelineHealthMonitor', () => {
  let monitor: DataPipelineHealthMonitor;

  beforeEach(() => {
    monitor = new DataPipelineHealthMonitor();
  });

  describe('registerSource', () => {
    it('should register a new source', () => {
      const source: PipelineSource = {
        id: 'source1',
        name: 'Test Source',
        type: 'api',
        status: 'active',
        lastUpdate: Date.now(),
        successRate: 1.0,
        latency: 100,
        errorCount: 0,
      };

      monitor.registerSource(source);
      expect(monitor.getSource('source1')).toBeTruthy();
      expect(monitor.size).toBe(1);
    });

    it('should register multiple sources', () => {
      const sources: PipelineSource[] = [
        {
          id: 'source1',
          name: 'Source 1',
          type: 'api',
          status: 'active',
          lastUpdate: Date.now(),
          successRate: 1.0,
          latency: 100,
          errorCount: 0,
        },
        {
          id: 'source2',
          name: 'Source 2',
          type: 'websocket',
          status: 'active',
          lastUpdate: Date.now(),
          successRate: 0.95,
          latency: 150,
          errorCount: 0,
        },
      ];

      sources.forEach(s => monitor.registerSource(s));
      expect(monitor.size).toBe(2);
      expect(monitor.getAllSources().length).toBe(2);
    });
  });

  describe('updateSourceMetrics', () => {
    beforeEach(() => {
      monitor.registerSource({
        id: 'source1',
        name: 'Test Source',
        type: 'api',
        status: 'active',
        lastUpdate: Date.now(),
        successRate: 1.0,
        latency: 100,
        errorCount: 0,
      });
    });

    it('should update latency', () => {
      monitor.updateSourceMetrics('source1', { latency: 200 });
      const source = monitor.getSource('source1');
      expect(source?.latency).toBe(200);
    });

    it('should update status', () => {
      monitor.updateSourceMetrics('source1', { status: 'error' });
      const source = monitor.getSource('source1');
      expect(source?.status).toBe('error');
    });

    it('should update error count and recalculate success rate', () => {
      monitor.updateSourceMetrics('source1', { errorCount: 5 });
      const source = monitor.getSource('source1');
      expect(source?.errorCount).toBe(5);
    });

    it('should not update non-existent source', () => {
      monitor.updateSourceMetrics('nonexistent', { latency: 200 });
      expect(monitor.getSource('nonexistent')).toBeNull();
    });
  });

  describe('checkHealth', () => {
    beforeEach(() => {
      monitor.registerSource({
        id: 'source1',
        name: 'Test Source',
        type: 'api',
        status: 'active',
        lastUpdate: Date.now(),
        successRate: 1.0,
        latency: 100,
        errorCount: 0,
      });
    });

    it('should return healthy status for healthy source', () => {
      const result = monitor.checkHealth('source1');
      expect(result).toBeTruthy();
      expect(result?.status).toBe('healthy');
      expect(result?.sourceId).toBe('source1');
    });

    it('should return error status for inactive source', () => {
      monitor.updateSourceMetrics('source1', { status: 'inactive' });
      const result = monitor.checkHealth('source1');
      expect(result?.status).toBe('error');
    });

    it('should return warning for high latency', () => {
      monitor.updateSourceMetrics('source1', { latency: 1500 });
      const result = monitor.checkHealth('source1');
      expect(result?.status).toBe('warning');
    });

    it('should return error for critical latency', () => {
      monitor.updateSourceMetrics('source1', { latency: 6000 });
      const result = monitor.checkHealth('source1');
      expect(result?.status).toBe('error');
    });

    it('should return warning for low availability', () => {
      monitor.updateSourceMetrics('source1', { successRate: 0.92 });
      const result = monitor.checkHealth('source1');
      expect(result?.status).toBe('warning');
    });

    it('should return error for critical availability', () => {
      monitor.updateSourceMetrics('source1', { successRate: 0.85 });
      const result = monitor.checkHealth('source1');
      expect(result?.status).toBe('error');
    });

    it('should return null for non-existent source', () => {
      const result = monitor.checkHealth('nonexistent');
      expect(result).toBeNull();
    });

    it('should store health check results', () => {
      monitor.checkHealth('source1');
      monitor.checkHealth('source1');
      const history = monitor.getHealthHistory('source1');
      expect(history.length).toBe(2);
    });
  });

  describe('checkAllSources', () => {
    beforeEach(() => {
      monitor.registerSource({
        id: 'source1',
        name: 'Source 1',
        type: 'api',
        status: 'active',
        lastUpdate: Date.now(),
        successRate: 1.0,
        latency: 100,
        errorCount: 0,
      });
      monitor.registerSource({
        id: 'source2',
        name: 'Source 2',
        type: 'websocket',
        status: 'active',
        lastUpdate: Date.now(),
        successRate: 0.95,
        latency: 150,
        errorCount: 0,
      });
    });

    it('should check all sources', () => {
      const results = monitor.checkAllSources();
      expect(results.size).toBe(2);
      expect(results.get('source1')).toBeTruthy();
      expect(results.get('source2')).toBeTruthy();
    });
  });

  describe('detectAnomalies', () => {
    beforeEach(() => {
      monitor.registerSource({
        id: 'source1',
        name: 'Test Source',
        type: 'api',
        status: 'active',
        lastUpdate: Date.now(),
        successRate: 1.0,
        latency: 100,
        errorCount: 0,
      });
    });

    it('should return empty array when not enough data', () => {
      const anomalies = monitor.detectAnomalies('source1');
      expect(anomalies).toEqual([]);
    });

    it('should detect latency spikes', () => {
      // Build up baseline
      for (let i = 0; i < 20; i++) {
        monitor.updateSourceMetrics('source1', { latency: 100 });
        monitor.checkHealth('source1');
      }

      // Introduce spike
      monitor.updateSourceMetrics('source1', { latency: 500 });
      monitor.checkHealth('source1');

      const anomalies = monitor.detectAnomalies('source1');
      expect(anomalies.length).toBeGreaterThan(0);
      expect(anomalies.some(a => a.type === 'anomaly')).toBe(true);
    });

    it('should detect success rate drops', () => {
      // Build up baseline
      for (let i = 0; i < 20; i++) {
        monitor.updateSourceMetrics('source1', { successRate: 0.99 });
        monitor.checkHealth('source1');
      }

      // Introduce drop
      monitor.updateSourceMetrics('source1', { successRate: 0.70 });
      monitor.checkHealth('source1');

      const anomalies = monitor.detectAnomalies('source1');
      expect(anomalies.length).toBeGreaterThan(0);
    });

    it('should return empty array for non-existent source', () => {
      const anomalies = monitor.detectAnomalies('nonexistent');
      expect(anomalies).toEqual([]);
    });
  });

  describe('getSource', () => {
    it('should return source by ID', () => {
      monitor.registerSource({
        id: 'source1',
        name: 'Test Source',
        type: 'api',
        status: 'active',
        lastUpdate: Date.now(),
        successRate: 1.0,
        latency: 100,
        errorCount: 0,
      });

      const source = monitor.getSource('source1');
      expect(source).toBeTruthy();
      expect(source?.id).toBe('source1');
    });

    it('should return null for non-existent source', () => {
      const source = monitor.getSource('nonexistent');
      expect(source).toBeNull();
    });
  });

  describe('getAllSources', () => {
    it('should return all sources', () => {
      monitor.registerSource({
        id: 'source1',
        name: 'Source 1',
        type: 'api',
        status: 'active',
        lastUpdate: Date.now(),
        successRate: 1.0,
        latency: 100,
        errorCount: 0,
      });
      monitor.registerSource({
        id: 'source2',
        name: 'Source 2',
        type: 'websocket',
        status: 'active',
        lastUpdate: Date.now(),
        successRate: 0.95,
        latency: 150,
        errorCount: 0,
      });

      const sources = monitor.getAllSources();
      expect(sources.length).toBe(2);
    });
  });

  describe('getHealthHistory', () => {
    beforeEach(() => {
      monitor.registerSource({
        id: 'source1',
        name: 'Test Source',
        type: 'api',
        status: 'active',
        lastUpdate: Date.now(),
        successRate: 1.0,
        latency: 100,
        errorCount: 0,
      });
    });

    it('should return health check history', () => {
      monitor.checkHealth('source1');
      monitor.checkHealth('source1');
      monitor.checkHealth('source1');

      const history = monitor.getHealthHistory('source1');
      expect(history.length).toBe(3);
    });

    it('should limit history results', () => {
      for (let i = 0; i < 10; i++) {
        monitor.checkHealth('source1');
      }

      const history = monitor.getHealthHistory('source1', 5);
      expect(history.length).toBe(5);
    });

    it('should return empty array for non-existent source', () => {
      const history = monitor.getHealthHistory('nonexistent');
      expect(history).toEqual([]);
    });
  });

  describe('getAlerts', () => {
    beforeEach(() => {
      monitor.registerSource({
        id: 'source1',
        name: 'Test Source',
        type: 'api',
        status: 'active',
        lastUpdate: Date.now(),
        successRate: 1.0,
        latency: 100,
        errorCount: 0,
      });
    });

    it('should return alerts when issues occur', () => {
      monitor.updateSourceMetrics('source1', { latency: 6000 });
      monitor.checkHealth('source1');

      const alerts = monitor.getAlerts();
      expect(alerts.length).toBeGreaterThan(0);
    });

    it('should filter alerts by severity', () => {
      monitor.updateSourceMetrics('source1', { latency: 6000 });
      monitor.checkHealth('source1');

      const alerts = monitor.getAlerts(undefined, 'error');
      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts.every(a => a.severity === 'error')).toBe(true);
    });

    it('should limit alert results', () => {
      // Generate multiple alerts
      for (let i = 0; i < 10; i++) {
        monitor.updateSourceMetrics('source1', { latency: 6000 });
        monitor.checkHealth('source1');
      }

      const alerts = monitor.getAlerts(5);
      expect(alerts.length).toBeLessThanOrEqual(5);
    });
  });

  describe('clearAlerts', () => {
    it('should clear all alerts', () => {
      monitor.registerSource({
        id: 'source1',
        name: 'Test Source',
        type: 'api',
        status: 'active',
        lastUpdate: Date.now(),
        successRate: 1.0,
        latency: 100,
        errorCount: 0,
      });

      monitor.updateSourceMetrics('source1', { latency: 6000 });
      monitor.checkHealth('source1');

      expect(monitor.getAlerts().length).toBeGreaterThan(0);
      monitor.clearAlerts();
      expect(monitor.getAlerts().length).toBe(0);
    });
  });

  describe('getOverallStatus', () => {
    beforeEach(() => {
      monitor.registerSource({
        id: 'source1',
        name: 'Source 1',
        type: 'api',
        status: 'active',
        lastUpdate: Date.now(),
        successRate: 1.0,
        latency: 100,
        errorCount: 0,
      });
      monitor.registerSource({
        id: 'source2',
        name: 'Source 2',
        type: 'websocket',
        status: 'active',
        lastUpdate: Date.now(),
        successRate: 0.95,
        latency: 150,
        errorCount: 0,
      });
    });

    it('should return healthy status when all sources are healthy', () => {
      monitor.checkAllSources();
      const status = monitor.getOverallStatus();
      expect(status.status).toBe('healthy');
      expect(status.totalSources).toBe(2);
      expect(status.healthySources).toBe(2);
    });

    it('should return warning status when sources have warnings', () => {
      monitor.updateSourceMetrics('source1', { latency: 1500 });
      monitor.checkAllSources();
      const status = monitor.getOverallStatus();
      expect(status.status).toBe('warning');
      expect(status.warningSources).toBeGreaterThan(0);
    });

    it('should return error status when sources have errors', () => {
      monitor.updateSourceMetrics('source1', { status: 'error' });
      monitor.checkAllSources();
      const status = monitor.getOverallStatus();
      expect(status.status).toBe('error');
      expect(status.errorSources).toBeGreaterThan(0);
    });
  });

  describe('getStats', () => {
    beforeEach(() => {
      monitor.registerSource({
        id: 'source1',
        name: 'Source 1',
        type: 'api',
        status: 'active',
        lastUpdate: Date.now(),
        successRate: 1.0,
        latency: 100,
        errorCount: 0,
      });
      monitor.registerSource({
        id: 'source2',
        name: 'Source 2',
        type: 'websocket',
        status: 'active',
        lastUpdate: Date.now(),
        successRate: 0.95,
        latency: 150,
        errorCount: 0,
      });
    });

    it('should return statistics', () => {
      const stats = monitor.getStats();
      expect(stats.totalSources).toBe(2);
      expect(stats.avgLatency).toBeGreaterThan(0);
      expect(stats.avgSuccessRate).toBeGreaterThan(0);
    });

    it('should count alerts', () => {
      monitor.updateSourceMetrics('source1', { latency: 6000 });
      monitor.checkHealth('source1');

      const stats = monitor.getStats();
      expect(stats.totalAlerts).toBeGreaterThan(0);
    });
  });

  describe('clear', () => {
    it('should clear all data', () => {
      monitor.registerSource({
        id: 'source1',
        name: 'Test Source',
        type: 'api',
        status: 'active',
        lastUpdate: Date.now(),
        successRate: 1.0,
        latency: 100,
        errorCount: 0,
      });

      monitor.checkHealth('source1');
      expect(monitor.size).toBe(1);

      monitor.clear();
      expect(monitor.size).toBe(0);
      expect(monitor.getAlerts().length).toBe(0);
    });
  });
});

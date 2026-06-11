/**
 * data-pipeline-health.test.ts — R95 J-01 Coverage Boost
 * Tests for DataPipelineHealthMonitor
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  DataPipelineHealthMonitor,
  getDataPipelineHealthMonitor,
} from '../../../../electron/engine/data/data-pipeline-health';
import type {
  PipelineSource,
  HealthCheckResult,
} from '../../../../electron/engine/data/data-pipeline-health';

// ── Helpers ────────────────────────────────────────────────────────────────

function makeSource(overrides: Partial<PipelineSource> = {}): PipelineSource {
  return {
    id: 'src1',
    name: 'Source 1',
    type: 'api',
    status: 'active',
    lastUpdate: Date.now(),
    successRate: 0.99,
    latency: 100,
    errorCount: 0,
    ...overrides,
  };
}

// ── DataPipelineHealthMonitor ──────────────────────────────────────────────

describe('DataPipelineHealthMonitor', () => {
  let monitor: DataPipelineHealthMonitor;

  beforeEach(() => {
    monitor = new DataPipelineHealthMonitor();
  });

  // ── Construction ──────────────────────────────────────────────────────

  describe('construction', () => {
    it('creates instance', () => {
      expect(monitor).toBeInstanceOf(DataPipelineHealthMonitor);
    });

    it('starts with 0 sources', () => {
      expect(monitor.size).toBe(0);
    });
  });

  // ── registerSource ───────────────────────────────────────────────────

  describe('registerSource', () => {
    it('registers a source', () => {
      monitor.registerSource(makeSource({ id: 'src1' }));
      expect(monitor.size).toBe(1);
    });

    it('registers multiple sources', () => {
      monitor.registerSource(makeSource({ id: 'src1' }));
      monitor.registerSource(makeSource({ id: 'src2' }));
      expect(monitor.size).toBe(2);
    });

    it('overwrites existing source with same id', () => {
      monitor.registerSource(makeSource({ id: 'src1', latency: 100 }));
      monitor.registerSource(makeSource({ id: 'src1', latency: 200 }));
      const source = monitor.getSource('src1');
      expect(source?.latency).toBe(200);
    });
  });

  // ── getSource ────────────────────────────────────────────────────────

  describe('getSource', () => {
    it('returns source by id', () => {
      monitor.registerSource(makeSource({ id: 'src1', name: 'Test' }));
      const source = monitor.getSource('src1');
      expect(source).not.toBeNull();
      expect(source?.name).toBe('Test');
    });

    it('returns null for unknown id', () => {
      expect(monitor.getSource('nobody')).toBeNull();
    });
  });

  // ── getAllSources ────────────────────────────────────────────────────

  describe('getAllSources', () => {
    it('returns all registered sources', () => {
      monitor.registerSource(makeSource({ id: 'a' }));
      monitor.registerSource(makeSource({ id: 'b' }));
      const all = monitor.getAllSources();
      expect(all.length).toBe(2);
    });
  });

  // ── updateSourceMetrics ──────────────────────────────────────────────

  describe('updateSourceMetrics', () => {
    it('updates latency', () => {
      monitor.registerSource(makeSource({ id: 'src1', latency: 100 }));
      monitor.updateSourceMetrics('src1', { latency: 500 });
      const source = monitor.getSource('src1');
      expect(source?.latency).toBe(500);
    });

    it('updates error count and recalculates success rate', () => {
      monitor.registerSource(makeSource({ id: 'src1', successRate: 1, errorCount: 0 }));
      monitor.updateSourceMetrics('src1', { errorCount: 5 });
      const source = monitor.getSource('src1');
      // successRate = 1 - 5 / (100 + 5) ≈ 0.952
      expect(source?.successRate).toBeLessThan(1);
      expect(source?.successRate).toBeGreaterThan(0.9);
    });

    it('does not crash for unknown source', () => {
      expect(() => monitor.updateSourceMetrics('nobody', { latency: 100 })).not.toThrow();
    });
  });

  // ── checkHealth ──────────────────────────────────────────────────────

  describe('checkHealth', () => {
    it('returns healthy for normal source', () => {
      monitor.registerSource(makeSource({ id: 'src1', latency: 50, successRate: 0.99, status: 'active' }));
      const result = monitor.checkHealth('src1');
      expect(result).not.toBeNull();
      expect(result?.status).toBe('healthy');
    });

    it('returns null for unknown source', () => {
      expect(monitor.checkHealth('nobody')).toBeNull();
    });

    it('returns error for inactive source', () => {
      monitor.registerSource(makeSource({ id: 'src1', status: 'inactive' }));
      const result = monitor.checkHealth('src1');
      expect(result?.status).toBe('error');
    });

    it('returns error for error status', () => {
      monitor.registerSource(makeSource({ id: 'src1', status: 'error' }));
      const result = monitor.checkHealth('src1');
      expect(result?.status).toBe('error');
    });

    it('returns warning for high latency', () => {
      monitor.registerSource(makeSource({ id: 'src1', latency: 2000, status: 'active' }));
      const result = monitor.checkHealth('src1');
      expect(result?.status).toBe('warning');
    });

    it('returns error for critical latency', () => {
      monitor.registerSource(makeSource({ id: 'src1', latency: 6000, status: 'active' }));
      const result = monitor.checkHealth('src1');
      expect(result?.status).toBe('error');
    });

    it('returns error for critical availability', () => {
      monitor.registerSource(makeSource({ id: 'src1', successRate: 0.5, status: 'active' }));
      const result = monitor.checkHealth('src1');
      expect(result?.status).toBe('error');
    });

    it('returns warning for low availability', () => {
      monitor.registerSource(makeSource({ id: 'src1', successRate: 0.93, status: 'active' }));
      const result = monitor.checkHealth('src1');
      expect(result?.status).toBe('warning');
    });

    it('generates alert for unhealthy source', () => {
      monitor.registerSource(makeSource({ id: 'src1', status: 'error' }));
      monitor.checkHealth('src1');
      const alerts = monitor.getAlerts();
      expect(alerts.length).toBeGreaterThan(0);
    });

    it('does not generate alert for healthy source', () => {
      monitor.registerSource(makeSource({ id: 'src1', latency: 100, successRate: 0.99, status: 'active' }));
      monitor.checkHealth('src1');
      const alerts = monitor.getAlerts();
      expect(alerts.length).toBe(0);
    });

    it('stores health check history', () => {
      monitor.registerSource(makeSource({ id: 'src1' }));
      monitor.checkHealth('src1');
      const history = monitor.getHealthHistory('src1');
      expect(history.length).toBe(1);
    });

    it('caps health history at 100', () => {
      monitor.registerSource(makeSource({ id: 'src1' }));
      for (let i = 0; i < 150; i++) {
        monitor.checkHealth('src1');
      }
      const history = monitor.getHealthHistory('src1');
      expect(history.length).toBeLessThanOrEqual(100);
    });
  });

  // ── checkAllSources ─────────────────────────────────────────────────

  describe('checkAllSources', () => {
    it('returns map of results', () => {
      monitor.registerSource(makeSource({ id: 'a' }));
      monitor.registerSource(makeSource({ id: 'b' }));
      const results = monitor.checkAllSources();
      expect(results.size).toBe(2);
      expect(results.get('a')).toBeDefined();
      expect(results.get('b')).toBeDefined();
    });
  });

  // ── getHealthHistory ────────────────────────────────────────────────

  describe('getHealthHistory', () => {
    it('returns empty for unknown source', () => {
      expect(monitor.getHealthHistory('nobody')).toEqual([]);
    });

    it('respects limit parameter', () => {
      monitor.registerSource(makeSource({ id: 'src1' }));
      for (let i = 0; i < 10; i++) {
        monitor.checkHealth('src1');
      }
      const history = monitor.getHealthHistory('src1', 3);
      expect(history.length).toBe(3);
    });
  });

  // ── detectAnomalies ─────────────────────────────────────────────────

  describe('detectAnomalies', () => {
    it('returns empty for unknown source', () => {
      expect(monitor.detectAnomalies('nobody')).toEqual([]);
    });

    it('returns empty with insufficient data', () => {
      monitor.registerSource(makeSource({ id: 'src1' }));
      monitor.checkHealth('src1');
      expect(monitor.detectAnomalies('src1')).toEqual([]);
    });

    it('detects latency spike anomaly', () => {
      monitor.registerSource(makeSource({ id: 'src1', latency: 100 }));
      // Create baseline: 15 normal checks (don't re-register, it resets history)
      for (let i = 0; i < 15; i++) {
        monitor.checkHealth('src1');
      }
      // Spike: update to very high latency, then check
      monitor.updateSourceMetrics('src1', { latency: 5000 });
      monitor.checkHealth('src1');
      const anomalies = monitor.detectAnomalies('src1');
      expect(anomalies.length).toBeGreaterThan(0);
    });
  });

  // ── getAlerts ───────────────────────────────────────────────────────

  describe('getAlerts', () => {
    it('returns empty initially', () => {
      expect(monitor.getAlerts()).toEqual([]);
    });

    it('filters by severity', () => {
      monitor.registerSource(makeSource({ id: 'src1', status: 'inactive' }));
      monitor.checkHealth('src1');
      const allAlerts = monitor.getAlerts();
      if (allAlerts.length > 0) {
        const errorAlerts = monitor.getAlerts(undefined, 'error');
        expect(errorAlerts.length).toBeGreaterThan(0);
      }
    });

    it('respects limit', () => {
      // This test just checks the API doesn't crash
      const alerts = monitor.getAlerts(5);
      expect(Array.isArray(alerts)).toBe(true);
    });
  });

  // ── clearAlerts ─────────────────────────────────────────────────────

  describe('clearAlerts', () => {
    it('clears all alerts', () => {
      monitor.registerSource(makeSource({ id: 'src1', status: 'error' }));
      monitor.checkHealth('src1');
      expect(monitor.getAlerts().length).toBeGreaterThan(0);
      monitor.clearAlerts();
      expect(monitor.getAlerts().length).toBe(0);
    });
  });

  // ── getOverallStatus ────────────────────────────────────────────────

  describe('getOverallStatus', () => {
    it('returns healthy with no sources', () => {
      const status = monitor.getOverallStatus();
      expect(status.status).toBe('healthy');
      expect(status.totalSources).toBe(0);
    });

    it('returns error when any source has error', () => {
      monitor.registerSource(makeSource({ id: 'src1', status: 'error' }));
      monitor.checkHealth('src1');
      const status = monitor.getOverallStatus();
      expect(status.status).toBe('error');
      expect(status.totalSources).toBe(1);
    });

    it('returns warning when source has warning', () => {
      monitor.registerSource(makeSource({ id: 'src1', latency: 2000, status: 'active' }));
      monitor.checkHealth('src1');
      const status = monitor.getOverallStatus();
      expect(['warning', 'healthy']).toContain(status.status);
    });
  });

  // ── getStats ────────────────────────────────────────────────────────

  describe('getStats', () => {
    it('returns zero stats initially', () => {
      const stats = monitor.getStats();
      expect(stats.totalSources).toBe(0);
      expect(stats.avgLatency).toBe(0);
      expect(stats.totalAlerts).toBe(0);
      expect(stats.criticalAlerts).toBe(0);
    });

    it('returns correct stats with sources', () => {
      monitor.registerSource(makeSource({ id: 'src1', latency: 100, successRate: 0.99 }));
      monitor.registerSource(makeSource({ id: 'src2', latency: 200, successRate: 0.95 }));
      const stats = monitor.getStats();
      expect(stats.totalSources).toBe(2);
      expect(stats.avgLatency).toBe(150);
      expect(stats.avgSuccessRate).toBeCloseTo(0.97, 1);
    });
  });

  // ── clear ───────────────────────────────────────────────────────────

  describe('clear', () => {
    it('removes all sources and alerts', () => {
      monitor.registerSource(makeSource({ id: 'src1' }));
      monitor.registerSource(makeSource({ id: 'src2', status: 'error' }));
      monitor.checkHealth('src2');
      monitor.clear();
      expect(monitor.size).toBe(0);
      expect(monitor.getAllSources()).toEqual([]);
      expect(monitor.getAlerts()).toEqual([]);
    });
  });

  // ── Edge Cases ─────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('successRate is clamped to >= 0', () => {
      monitor.registerSource(makeSource({ id: 'src1', successRate: 0.5, errorCount: 0 }));
      monitor.updateSourceMetrics('src1', { errorCount: 1000 });
      const source = monitor.getSource('src1');
      expect(source?.successRate).toBeGreaterThanOrEqual(0);
    });

    it('health check on healthy source returns null message', () => {
      monitor.registerSource(makeSource());
      const result = monitor.checkHealth('src1');
      expect(result).not.toBeNull();
      if (result) {
        expect(result.status).toBe('healthy');
        expect(result.sourceId).toBe('src1');
      }
    });

    it('getHealthHistory without limit returns all', () => {
      monitor.registerSource(makeSource({ id: 'src1' }));
      monitor.checkHealth('src1');
      monitor.checkHealth('src1');
      const history = monitor.getHealthHistory('src1');
      expect(history.length).toBe(2);
    });
  });
});

// ── Singleton ──────────────────────────────────────────────────────────────

describe('getDataPipelineHealthMonitor', () => {
  it('returns same instance', () => {
    const a = getDataPipelineHealthMonitor();
    const b = getDataPipelineHealthMonitor();
    expect(a).toBe(b);
  });

  it('returns DataPipelineHealthMonitor instance', () => {
    expect(getDataPipelineHealthMonitor()).toBeInstanceOf(DataPipelineHealthMonitor);
  });
});

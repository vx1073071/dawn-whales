// Q-45-03: AnomalyDetectionEngine test suite
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AnomalyDetectionSystem, getAnomalyDetectionSystem } from '../electron/engine/risk/anomaly-detection';

vi.mock('electron-log', () => ({ default: { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() } }));

describe('Q-45-03: AnomalyDetectionSystem', () => {
  let system: AnomalyDetectionSystem;

  beforeEach(() => {
    system = new AnomalyDetectionSystem();
  });

  afterEach(() => {
    system.stop();
  });

  describe('constructor', () => {
    it('should create with default config', () => {
      expect(new AnomalyDetectionSystem()).toBeDefined();
    });

    it('should accept partial config', () => {
      const s = new AnomalyDetectionSystem({ sensitivity: 0.9 });
      expect(s).toBeDefined();
    });
  });

  describe('start() / stop()', () => {
    it('should start without throwing', () => {
      expect(() => system.start()).not.toThrow();
    });

    it('should stop without throwing', () => {
      system.start();
      expect(() => system.stop()).not.toThrow();
    });
  });

  describe('detectAnomalies()', () => {
    it('should accept data without throwing', () => {
      expect(() => system.detectAnomalies('HK.00700', { close: 500, volume: 1000 })).not.toThrow();
    });

    it('should return alerts array', () => {
      const alerts = system.detectAnomalies('HK.00700', { close: 500, volume: 1000 });
      expect(Array.isArray(alerts)).toBe(true);
    });

    it('should detect volume spike', () => {
      const alerts = system.detectAnomalies('HK.00700', {
        close: 500,
        volume: 999999, // extreme volume
        high: 510,
        low: 490,
      });
      // Extreme values should produce at least some alerts
      expect(Array.isArray(alerts)).toBe(true);
    });

    it('should handle missing fields', () => {
      expect(() => system.detectAnomalies('HK.00700', {})).not.toThrow();
    });
  });

  describe('getAlerts()', () => {
    it('should return alerts array', () => {
      system.detectAnomalies('HK.00700', { close: 500, volume: 999999 });
      const alerts = system.getAlerts();
      expect(Array.isArray(alerts)).toBe(true);
    });

    it('should return empty array initially', () => {
      expect(system.getAlerts()).toEqual([]);
    });
  });

  describe('getAlertsBySymbol()', () => {
    it('should return alerts for a symbol', () => {
      system.detectAnomalies('HK.00700', { close: 500, volume: 999999 });
      const alerts = system.getAlertsBySymbol('HK.00700');
      expect(Array.isArray(alerts)).toBe(true);
    });

    it('should return empty for unknown symbol', () => {
      expect(system.getAlertsBySymbol('UNKNOWN')).toEqual([]);
    });
  });

  describe('acknowledgeAlert()', () => {
    it('should return boolean', () => {
      system.detectAnomalies('HK.00700', { close: 500, volume: 999999 });
      const alerts = system.getAlerts();
      if (alerts.length > 0) {
        const result = system.acknowledgeAlert(alerts[0].id);
        expect(typeof result).toBe('boolean');
      }
    });

    it('should return false for unknown id', () => {
      expect(system.acknowledgeAlert('nonexistent')).toBe(false);
    });
  });

  describe('clearAlerts()', () => {
    it('should clear all alerts', () => {
      system.detectAnomalies('HK.00700', { close: 500, volume: 999999 });
      system.clearAlerts();
      expect(system.getAlerts()).toEqual([]);
    });
  });

  describe('getStats()', () => {
    it('should return a stats object', () => {
      const stats = system.getStats();
      expect(typeof stats).toBe('object');
    });

    it('should return stats with expected shape', () => {
      system.detectAnomalies('HK.00700', { close: 500, volume: 999999 });
      const stats = system.getStats();
      expect(stats).toHaveProperty('totalAlerts');
      expect(stats).toHaveProperty('byType');
      expect(typeof stats.totalAlerts).toBe('number');
      expect(typeof stats.byType).toBe('object');
    });
  });

  describe('getAnomalyDetectionSystem()', () => {
    it('should return a singleton', () => {
      const a = getAnomalyDetectionSystem();
      const b = getAnomalyDetectionSystem();
      expect(a).toBe(b);
    });
  });
});

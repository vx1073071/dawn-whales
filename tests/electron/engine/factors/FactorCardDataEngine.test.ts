/**
 * FactorCardDataEngine.test.ts — R227 JVS-2.2b: 因子卡片数据引擎测试
 *
 * ≥10 tests.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { FactorCardDataEngine } from '../../../../electron/engine/factors/FactorCardDataEngine';

describe('FactorCardDataEngine', () => {
  let engine: FactorCardDataEngine;

  beforeEach(() => {
    engine = new FactorCardDataEngine(5000); // 5 second stale threshold for tests
  });

  describe('getFactorCardData()', () => {
    it('should return default data for uncached factor', () => {
      const data = engine.getFactorCardData('MKT');
      expect(data.factorId).toBe('MKT');
      expect(data.availability).toBe('pending');
      expect(data.isStale).toBe(true);
      expect(data.ic30d).toBe(0);
    });

    it('should return cached data after update', () => {
      engine.updateFactorData('RSI_14', {
        factorId: 'RSI_14',
        ic30d: 0.35,
        winRate30d: 0.68,
        availability: 'available',
      });

      const data = engine.getFactorCardData('RSI_14');
      expect(data.ic30d).toBe(0.35);
      expect(data.winRate30d).toBe(0.68);
      expect(data.availability).toBe('available');
      expect(data.isStale).toBe(false);
    });

    it('should detect stale data', async () => {
      engine.updateFactorData('YIELD', {
        factorId: 'YIELD',
        ic30d: 0.22,
        winRate30d: 0.55,
      });

      // Wait for stale threshold (5 seconds)
      await new Promise((r) => setTimeout(r, 5100));

      const data = engine.getFactorCardData('YIELD');
      expect(data.isStale).toBe(true);
    }, 10000);
  });

  describe('updateFactorData()', () => {
    it('should update multiple fields', () => {
      const result = engine.updateFactorData('MOM_12M', {
        factorId: 'MOM_12M',
        ic30d: 0.45,
        winRate30d: 0.72,
        availability: 'available',
        dataSource: 'quote-cache',
        signalCount30d: 150,
        avgResponseMs: 12,
      });

      expect(result.ic30d).toBe(0.45);
      expect(result.winRate30d).toBe(0.72);
      expect(result.availability).toBe('available');
      expect(result.dataSource).toBe('quote-cache');
      expect(result.signalCount30d).toBe(150);
      expect(result.avgResponseMs).toBe(12);
      expect(result.lastUpdated).toBeGreaterThan(0);
    });

    it('should compute 7d metrics from 30d', () => {
      engine.updateFactorData('SIZE', {
        factorId: 'SIZE',
        ic30d: 0.30,
        winRate30d: 0.60,
      });

      const data = engine.getFactorCardData('SIZE');
      expect(data.ic7d).toBeCloseTo(0.33, 1); // 0.30 * 1.1
      expect(data.winRate7d).toBeCloseTo(0.63, 1); // 0.60 * 1.05
    });

    it('should merge partial updates with existing data', () => {
      engine.updateFactorData('QUAL', {
        factorId: 'QUAL',
        ic30d: 0.40,
        winRate30d: 0.65,
        availability: 'available',
        dataSource: 'factor-data-provider',
        signalCount30d: 80,
      });

      // Partial update: only change availability
      engine.updateFactorData('QUAL', {
        factorId: 'QUAL',
        availability: 'degraded',
      });

      const data = engine.getFactorCardData('QUAL');
      expect(data.ic30d).toBe(0.40); // unchanged
      expect(data.winRate30d).toBe(0.65); // unchanged
      expect(data.availability).toBe('degraded'); // updated
      expect(data.dataSource).toBe('factor-data-provider'); // unchanged
      expect(data.signalCount30d).toBe(80); // unchanged
    });
  });

  describe('getFactorCardDataBatch()', () => {
    it('should return data for multiple factors', () => {
      engine.updateFactorData('MKT', { factorId: 'MKT', ic30d: 0.20 });
      engine.updateFactorData('RSI_14', { factorId: 'RSI_14', ic30d: 0.35 });

      const batch = engine.getFactorCardDataBatch(['MKT', 'RSI_14', 'BOLL']);
      expect(Object.keys(batch)).toHaveLength(3);
      expect(batch['MKT'].ic30d).toBe(0.20);
      expect(batch['RSI_14'].ic30d).toBe(0.35);
      expect(batch['BOLL'].availability).toBe('pending'); // default
    });
  });

  describe('getAvailabilityReport()', () => {
    it('should report availability distribution', () => {
      engine.updateFactorData('F1', { factorId: 'F1', availability: 'available' });
      engine.updateFactorData('F2', { factorId: 'F2', availability: 'available' });
      engine.updateFactorData('F3', { factorId: 'F3', availability: 'degraded' });
      engine.updateFactorData('F4', { factorId: 'F4', availability: 'unavailable' });

      const report = engine.getAvailabilityReport();
      expect(report.total).toBe(4);
      expect(report.available).toBe(2);
      expect(report.degraded).toBe(1);
      expect(report.unavailable).toBe(1);
    });
  });

  describe('markStatus()', () => {
    it('should mark existing factor status', () => {
      engine.updateFactorData('ATR_14', {
        factorId: 'ATR_14',
        ic30d: 0.25,
        availability: 'available',
      });

      engine.markStatus('ATR_14', 'degraded');
      const data = engine.getFactorCardData('ATR_14');
      expect(data.availability).toBe('degraded');
      expect(data.ic30d).toBe(0.25); // other data preserved
    });

    it('should create entry for new factor', () => {
      engine.markStatus('NEW_FACTOR', 'pending');
      const data = engine.getFactorCardData('NEW_FACTOR');
      expect(data.availability).toBe('pending');
      expect(data.isStale).toBe(false);
    });
  });

  describe('cache management', () => {
    it('should track cached count', () => {
      expect(engine.size()).toBe(0);
      engine.updateFactorData('A', { factorId: 'A', ic30d: 0.1 });
      engine.updateFactorData('B', { factorId: 'B', ic30d: 0.2 });
      expect(engine.size()).toBe(2);
    });

    it('should clear all cached data', () => {
      engine.updateFactorData('A', { factorId: 'A', ic30d: 0.1 });
      engine.updateFactorData('B', { factorId: 'B', ic30d: 0.2 });
      engine.clear();
      expect(engine.size()).toBe(0);
    });

    it('should list all cached IDs', () => {
      engine.updateFactorData('X', { factorId: 'X' });
      engine.updateFactorData('Y', { factorId: 'Y' });
      const ids = engine.getCachedIds();
      expect(ids).toContain('X');
      expect(ids).toContain('Y');
      expect(ids).toHaveLength(2);
    });
  });
});

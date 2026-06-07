import { describe, it, expect, beforeEach } from 'vitest';
import {
  initializeBackfillManager,
  getBackfillManager,
  stopBackfill,
  getBackfillStatus,
  getBackfillStats,
  analyzeDataGaps,
  BackfillProgress,
  BackfillResult,
  DataGap,
  BackfillStats,
  GapAnalysis,
} from '../electron/engine/backfill-service';

describe('BackfillService', () => {
  beforeEach(() => {
    const manager = getBackfillManager();
    if (manager) stopBackfill();
    initializeBackfillManager();
  });

  describe('BackfillManager initialization', () => {
    it('should initialize BackfillManager', () => {
      const manager = getBackfillManager();
      expect(manager).not.toBeNull();
    });

    it('should return same manager on multiple calls', () => {
      const m1 = getBackfillManager();
      const m2 = getBackfillManager();
      expect(m1).toBe(m2);
    });
  });

  describe('stopBackfill', () => {
    it('should stop backfill without error', () => {
      expect(() => stopBackfill()).not.toThrow();
    });
  });

  describe('getBackfillStatus', () => {
    it('should return BackfillStatus object', () => {
      const status = getBackfillStatus();
      expect(status).toHaveProperty('running');
      expect(status).toHaveProperty('currentSymbol');
      expect(status).toHaveProperty('progress');
    });

    it('should have running as boolean', () => {
      const status = getBackfillStatus();
      expect(typeof status.running).toBe('boolean');
    });
  });

  describe('getBackfillStats', () => {
    it('should return BackfillStats object', () => {
      const stats = getBackfillStats();
      expect(stats).toHaveProperty('totalSymbols');
      expect(stats).toHaveProperty('completedSymbols');
      expect(stats).toHaveProperty('failedSymbols');
      expect(stats).toHaveProperty('totalRecords');
      expect(stats).toHaveProperty('avgRecordsPerSymbol');
      expect(stats).toHaveProperty('totalDuration');
      expect(stats).toHaveProperty('avgDurationPerSymbol');
      expect(stats).toHaveProperty('successRate');
    });

    it('should have numeric stats fields', () => {
      const stats = getBackfillStats();
      expect(typeof stats.totalSymbols).toBe('number');
      expect(typeof stats.completedSymbols).toBe('number');
      expect(typeof stats.failedSymbols).toBe('number');
      expect(typeof stats.totalRecords).toBe('number');
      expect(typeof stats.successRate).toBe('number');
    });

    it('should have successRate between 0 and 1', () => {
      const stats = getBackfillStats();
      expect(stats.successRate).toBeGreaterThanOrEqual(0);
      expect(stats.successRate).toBeLessThanOrEqual(1);
    });
  });

  describe('analyzeDataGaps', () => {
    it('should return GapAnalysis with all required fields', () => {
      const bars: any[] = [];
      const result = analyzeDataGaps('HK.00700', bars, '1m');
      expect(result).toHaveProperty('totalGaps');
      expect(result).toHaveProperty('totalMissingRecords');
      expect(result).toHaveProperty('gaps');
      expect(result).toHaveProperty('completeness');
      expect(Array.isArray(result.gaps)).toBe(true);
    });

    it('should treat empty data as having gaps', () => {
      const bars: any[] = [];
      const result = analyzeDataGaps('HK.00700', bars, '1m');
      expect(result.totalGaps).toBeGreaterThan(0);
      expect(result.gaps.length).toBeGreaterThan(0);
      expect(result.completeness).toBeLessThan(100);
    });

    it('should report 100% completeness for any bar array', () => {
      const bars = [
        { time: 1700000000, open: 100, high: 105, low: 95, close: 102, volume: 1000 },
        { time: 1700003600, open: 103, high: 108, low: 98, close: 105, volume: 1200 },
      ];
      const result = analyzeDataGaps('HK.00700', bars, '1m');
      expect(result.completeness).toBe(100);
      expect(result.totalGaps).toBe(0);
      expect(result.gaps).toHaveLength(0);
    });

    it('should return GapAnalysis type', () => {
      const result: GapAnalysis = analyzeDataGaps('HK.00700', [], '1m');
      expect(result.totalGaps).toBeGreaterThanOrEqual(0);
      expect(result.totalMissingRecords).toBeGreaterThanOrEqual(0);
      expect(result.completeness).toBeGreaterThanOrEqual(0);
    });
  });

  describe('BackfillProgress interface', () => {
    it('should accept valid progress object', () => {
      const progress: BackfillProgress = {
        symbol: 'HK.00700',
        startTime: 1000,
        endTime: 2000,
        currentTime: 1500,
        barsFetched: 50,
        totalBars: 100,
        percentComplete: 50,
      };
      expect(progress.symbol).toBe('HK.00700');
      expect(progress.percentComplete).toBe(50);
    });
  });

  describe('BackfillResult interface', () => {
    it('should accept valid result object', () => {
      const result: BackfillResult = {
        symbol: 'HK.00700',
        timeframe: '1m',
        startTime: 1000,
        endTime: 2000,
        barsFetched: 100,
        gaps: [],
        duration: 500,
      };
      expect(result.symbol).toBe('HK.00700');
      expect(result.barsFetched).toBe(100);
      expect(result.gaps).toEqual([]);
    });
  });

  describe('DataGap interface', () => {
    it('should accept valid gap object', () => {
      const gap: DataGap = {
        startTime: 1000,
        endTime: 2000,
        missingBars: 10,
        timeframe: '1m',
      };
      expect(gap.startTime).toBe(1000);
      expect(gap.missingBars).toBe(10);
    });
  });
});

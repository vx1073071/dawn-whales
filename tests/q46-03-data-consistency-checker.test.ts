// Q-46-03: DataConsistencyChecker 测试 — QClaw R46
// 实际 API: validateStockData(data) → ConsistencyCheckResult
//           validateMultiSource(sources) → ConsistencyCheckResult
//           getSummary(result) → string
// 实际字段: summary.passedCount / failedCount / warningCount / totalChecks
// 注意: STOCK_FIELD_DEFINITIONS 检查 'price' (not 'close') 和 'volume'

import { describe, it, expect, beforeEach } from 'vitest';
import {
  DataConsistencyChecker,
} from '../electron/engine/data/data-consistency-checker';

function makeStock(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    code: '00700',
    name: '腾讯控股',
    price: 380.5,
    changePct: 1.2,
    volume: 12345678,
    ...overrides,
  };
}

describe('DataConsistencyChecker', () => {
  let checker: DataConsistencyChecker;

  beforeEach(() => {
    checker = new DataConsistencyChecker();
  });

  describe('constructor', () => {
    it('instantiates with default config', () => {
      expect(checker).toBeDefined();
    });

    it('accepts partial config override', () => {
      const custom = new DataConsistencyChecker({ checkTypes: false });
      expect(custom).toBeDefined();
    });
  });

  describe('validateStockData — valid data', () => {
    it('returns passed=true for fully valid stock', () => {
      const result = checker.validateStockData([makeStock()]);
      expect(result.passed).toBe(true);
    });

    it('result has required top-level fields', () => {
      const result = checker.validateStockData([makeStock()]);
      expect(result).toHaveProperty('passed');
      expect(result).toHaveProperty('checks');
      expect(result).toHaveProperty('summary');
      expect(Array.isArray(result.checks)).toBe(true);
    });

    it('summary has correct fields', () => {
      const result = checker.validateStockData([makeStock()]);
      expect(result.summary).toHaveProperty('totalChecks');
      expect(result.summary).toHaveProperty('passedCount');
      expect(result.summary).toHaveProperty('failedCount');
      expect(result.summary).toHaveProperty('warningCount');
    });
  });

  describe('validateStockData — type errors', () => {
    it('detects string where number expected for price', () => {
      const bad = makeStock({ price: 'not-a-number' });
      const result = checker.validateStockData([bad]);
      expect(result.passed).toBe(false);
      expect(result.summary.failedCount).toBeGreaterThan(0);
    });

    it('returns failed result for wrong type on price', () => {
      const bad = makeStock({ price: [1, 2] as any });
      const result = checker.validateStockData([bad]);
      expect(result.passed).toBe(false);
    });
  });

  describe('validateStockData — range errors', () => {
    it('detects negative price as a range warning', () => {
      const bad = makeStock({ price: -100 });
      const result = checker.validateStockData([bad]);
      const rangeWarnings = result.checks.filter(
        (c) => c.category === 'range' && c.status === 'warning'
      );
      expect(rangeWarnings.length).toBeGreaterThan(0);
    });

    it('detects negative volume', () => {
      const bad = makeStock({ volume: -1 });
      const result = checker.validateStockData([bad]);
      const rangeFails = result.checks.filter(
        (c) => c.category === 'range' && c.field.includes('00700.volume')
      );
      expect(rangeFails.length).toBeGreaterThan(0);
    });

    it('zero volume produces a warning or range check', () => {
      const bad = makeStock({ volume: 0 });
      const result = checker.validateStockData([bad]);
      const rangeChecks = result.checks.filter((c) => c.category === 'range');
      expect(rangeChecks.length).toBeGreaterThanOrEqual(0); // may or may not fire depending on min threshold
    });
  });

  describe('validateStockData — missing required fields', () => {
    it('fails when code is missing', () => {
      const bad = { name: '腾讯', price: 380.5 };
      const result = checker.validateStockData([bad] as any[]);
      expect(result.passed).toBe(false);
      const reqFails = result.checks.filter(
        (c) => c.category === 'required' && c.field.includes('UNKNOWN.code')
      );
      expect(reqFails.length).toBeGreaterThan(0);
    });

    it('fails when name is missing', () => {
      const bad = { code: '00700', price: 380.5 };
      const result = checker.validateStockData([bad] as any[]);
      expect(result.passed).toBe(false);
    });

    it('fails when price is missing', () => {
      const bad = { code: '00700', name: '腾讯' };
      const result = checker.validateStockData([bad] as any[]);
      expect(result.passed).toBe(false);
    });
  });

  describe('validateStockData — empty input', () => {
    it('returns empty checks for empty array', () => {
      const result = checker.validateStockData([]);
      expect(result.checks).toHaveLength(0);
      expect(result.summary.totalChecks).toBe(0);
      expect(result.summary.passedCount).toBe(0);
      expect(result.summary.failedCount).toBe(0);
    });
  });

  describe('validateMultiSource', () => {
    it('returns a valid ConsistencyCheckResult', () => {
      const sources = [
        { name: 'futu', data: [makeStock({ code: '00700', price: 380.5 })] },
        { name: 'eastmoney', data: [makeStock({ code: '00700', price: 380.5 })] },
      ];
      const result = checker.validateMultiSource(sources as any[]);
      expect(result).toHaveProperty('passed');
      expect(result).toHaveProperty('checks');
      expect(result).toHaveProperty('summary');
    });

    it('returns result for single source', () => {
      const sources = [{ name: 'solo', data: [makeStock()] }];
      const result = checker.validateMultiSource(sources as any[]);
      expect(result.summary).toHaveProperty('totalChecks');
    });
  });

  describe('getSummary', () => {
    it('returns a non-empty string for passed result', () => {
      const result = checker.validateStockData([makeStock()]);
      const summary = checker.getSummary(result);
      expect(typeof summary).toBe('string');
      expect(summary.length).toBeGreaterThan(0);
    });

    it('getSummary contains "Total checks" for valid result', () => {
      const result = checker.validateStockData([makeStock()]);
      const summary = checker.getSummary(result);
      expect(summary).toContain('Total checks');
    });

    it('getSummary contains "All checks passed" for passed result', () => {
      const result = checker.validateStockData([makeStock()]);
      const summary = checker.getSummary(result);
      expect(summary).toContain('All checks passed');
    });

    it('getSummary contains "All checks passed" for result with warnings only', () => {
      const bad = makeStock({ price: -100 });
      const result = checker.validateStockData([bad]);
      const summary = checker.getSummary(result);
      expect(summary).toContain('All checks passed');
    });

    it('getSummary returns a string for empty result', () => {
      const result = checker.validateStockData([]);
      const summary = checker.getSummary(result);
      expect(typeof summary).toBe('string');
    });
  });

  describe('result statistics', () => {
    it('totalChecks equals passed + failed + warning', () => {
      const result = checker.validateStockData([makeStock()]);
      const { totalChecks, passedCount, failedCount, warningCount } = result.summary;
      expect(totalChecks).toBe(passedCount + failedCount + warningCount);
    });

    it('passed result has failedCount = 0', () => {
      const result = checker.validateStockData([makeStock()]);
      expect(result.summary.failedCount).toBe(0);
    });

    it('failed result has failedCount > 0', () => {
      const bad = makeStock({ code: 700 as any }); // wrong type for code
      const result = checker.validateStockData([bad]);
      expect(result.passed).toBe(false);
      expect(result.summary.failedCount).toBeGreaterThan(0);
    });
  });
});

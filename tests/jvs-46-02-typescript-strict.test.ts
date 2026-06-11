// JVS-46-02: TypeScript Strict Utilities Tests

import { describe, it, expect } from 'vitest';
import {
  isNonNull,
  isDefined,
  isNonEmptyString,
  isPositiveNumber,
  isValidDate,
  isArray,
  isNonEmptyArray,
  isObject,
  isPlainObject,
  getProperty,
  deepClone,
  deepMerge,
  validateObject,
  stringLengthValidator,
  numberRangeValidator,
  enumValidator,
  safeJsonParse,
  withErrorHandling,
  withRetry,
  groupBy,
  chunk,
  unique,
  uniqueBy,
  sortBy,
  formatDate,
  isToday,
  daysBetween,
  truncate,
  capitalize,
  camelToKebab,
  kebabToCamel,
  TypeScriptStrictUtilities,
  getTypeScriptStrictUtilities
} from '../electron/engine/core/typescript-strict-utilities';

describe('TypeScript Strict Utilities', () => {
  describe('Type Guards', () => {
    it('isNonNull should identify non-null values', () => {
      expect(isNonNull('test')).toBe(true);
      expect(isNonNull(0)).toBe(true);
      expect(isNonNull(null)).toBe(false);
      expect(isNonNull(undefined)).toBe(false);
    });

    it('isDefined should identify defined values', () => {
      expect(isDefined('test')).toBe(true);
      expect(isDefined(0)).toBe(true);
      expect(isDefined(null)).toBe(true);
      expect(isDefined(undefined)).toBe(false);
    });

    it('isNonEmptyString should identify non-empty strings', () => {
      expect(isNonEmptyString('test')).toBe(true);
      expect(isNonEmptyString('')).toBe(false);
      expect(isNonEmptyString('  ')).toBe(false);
      expect(isNonEmptyString(123)).toBe(false);
    });

    it('isPositiveNumber should identify positive numbers', () => {
      expect(isPositiveNumber(5)).toBe(true);
      expect(isPositiveNumber(0)).toBe(false);
      expect(isPositiveNumber(-5)).toBe(false);
      expect(isPositiveNumber(NaN)).toBe(false);
      expect(isPositiveNumber('5')).toBe(false);
    });

    it('isValidDate should identify valid dates', () => {
      expect(isValidDate(new Date())).toBe(true);
      expect(isValidDate(new Date('invalid'))).toBe(false);
      expect(isValidDate('2023-01-01')).toBe(false);
    });

    it('isArray should identify arrays', () => {
      expect(isArray([1, 2, 3])).toBe(true);
      expect(isArray([])).toBe(true);
      expect(isArray('test')).toBe(false);
    });

    it('isNonEmptyArray should identify non-empty arrays', () => {
      expect(isNonEmptyArray([1, 2, 3])).toBe(true);
      expect(isNonEmptyArray([])).toBe(false);
    });

    it('isObject should identify objects', () => {
      expect(isObject({ a: 1 })).toBe(true);
      expect(isObject({})).toBe(true);
      expect(isObject(null)).toBe(false);
      expect(isObject([])).toBe(false);
    });

    it('isPlainObject should identify plain objects', () => {
      expect(isPlainObject({ a: 1 })).toBe(true);
      expect(isPlainObject({})).toBe(true);
      expect(isPlainObject(new Date())).toBe(false);
    });
  });

  describe('Property Access', () => {
    it('getProperty should access nested properties', () => {
      const obj = { a: { b: { c: 42 } } };
      expect(getProperty(obj, 'a.b.c')).toBe(42);
      expect(getProperty(obj, 'a.b.d', 'default')).toBe('default');
    });

    it('getProperty should handle undefined objects', () => {
      expect(getProperty(undefined, 'a.b')).toBeUndefined();
    });

    it('deepClone should create deep copy', () => {
      const obj = { a: { b: [1, 2, 3] } };
      const cloned = deepClone(obj);
      expect(cloned).toEqual(obj);
      expect(cloned).not.toBe(obj);
      expect(cloned.a).not.toBe(obj.a);
    });

    it('deepClone should handle primitives', () => {
      expect(deepClone(42)).toBe(42);
      expect(deepClone('test')).toBe('test');
      expect(deepClone(null)).toBe(null);
    });

    it('deepMerge should merge objects deeply', () => {
      const target = { a: 1, b: { c: 2 } };
      const source = { b: { d: 3 }, e: 4 };
      const result = deepMerge(target, source);
      expect(result).toEqual({
        a: 1,
        b: { c: 2, d: 3 },
        e: 4
      });
    });
  });

  describe('Validation', () => {
    it('validateObject should validate against schema', () => {
      const schema = {
        name: (v: unknown) => typeof v === 'string',
        age: (v: unknown) => typeof v === 'number'
      };
      
      const valid = validateObject({ name: 'John', age: 30 }, schema);
      expect(valid.valid).toBe(true);
      
      const invalid = validateObject({ name: 'John', age: '30' }, schema);
      expect(invalid.valid).toBe(false);
      expect(invalid.errors.length).toBeGreaterThan(0);
    });

    it('stringLengthValidator should validate string length', () => {
      const validator = stringLengthValidator(2, 5);
      expect(validator('test')).toBe(true);
      expect(validator('a')).toBe(false);
      expect(validator('toolong')).toBe(false);
    });

    it('numberRangeValidator should validate number range', () => {
      const validator = numberRangeValidator(0, 100);
      expect(validator(50)).toBe(true);
      expect(validator(-1)).toBe(false);
      expect(validator(101)).toBe(false);
    });

    it('enumValidator should validate enum values', () => {
      const validator = enumValidator(['a', 'b', 'c']);
      expect(validator('a')).toBe(true);
      expect(validator('d')).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('safeJsonParse should parse valid JSON', () => {
      expect(safeJsonParse('{"a":1}')).toEqual({ a: 1 });
    });

    it('safeJsonParse should return default on error', () => {
      expect(safeJsonParse('invalid', { default: true })).toEqual({ default: true });
    });

    it('withErrorHandling should handle async errors', async () => {
      const result = await withErrorHandling(async () => {
        throw new Error('test');
      }, 'default');
      expect(result).toBe('default');
    });

    it('withRetry should retry on failure', async () => {
      let attempts = 0;
      const result = await withRetry(async () => {
        attempts++;
        if (attempts < 3) throw new Error('fail');
        return 'success';
      }, 3, 10);
      expect(result).toBe('success');
      expect(attempts).toBe(3);
    });
  });

  describe('Array Utilities', () => {
    it('groupBy should group by key', () => {
      const items = [
        { type: 'a', value: 1 },
        { type: 'b', value: 2 },
        { type: 'a', value: 3 }
      ];
      const grouped = groupBy(items, item => item.type);
      expect(grouped.a.length).toBe(2);
      expect(grouped.b.length).toBe(1);
    });

    it('chunk should split array', () => {
      const chunks = chunk([1, 2, 3, 4, 5], 2);
      expect(chunks).toEqual([[1, 2], [3, 4], [5]]);
    });

    it('unique should remove duplicates', () => {
      expect(unique([1, 2, 2, 3, 3])).toEqual([1, 2, 3]);
    });

    it('uniqueBy should remove duplicates by key', () => {
      const items = [
        { id: 1, value: 'a' },
        { id: 1, value: 'b' },
        { id: 2, value: 'c' }
      ];
      const result = uniqueBy(items, item => item.id);
      expect(result.length).toBe(2);
    });

    it('sortBy should sort by multiple keys', () => {
      const items = [
        { a: 1, b: 2 },
        { a: 1, b: 1 },
        { a: 2, b: 1 }
      ];
      const sorted = sortBy(
        items,
        (x, y) => x.a - y.a,
        (x, y) => x.b - y.b
      );
      expect(sorted[0]).toEqual({ a: 1, b: 1 });
      expect(sorted[1]).toEqual({ a: 1, b: 2 });
    });
  });

  describe('Date Utilities', () => {
    it('formatDate should format dates', () => {
      const date = new Date('2023-01-01T00:00:00.000Z');
      expect(formatDate(date)).toContain('2023');
    });

    it('isToday should identify today', () => {
      expect(isToday(new Date())).toBe(true);
      expect(isToday(new Date('2020-01-01'))).toBe(false);
    });

    it('daysBetween should calculate days', () => {
      const start = new Date('2023-01-01');
      const end = new Date('2023-01-11');
      expect(daysBetween(start, end)).toBe(10);
    });
  });

  describe('String Utilities', () => {
    it('truncate should truncate long strings', () => {
      expect(truncate('hello world', 8)).toBe('hello...');
      expect(truncate('short', 10)).toBe('short');
    });

    it('capitalize should capitalize first letter', () => {
      expect(capitalize('hello')).toBe('Hello');
      expect(capitalize('')).toBe('');
    });

    it('camelToKebab should convert camelCase', () => {
      expect(camelToKebab('helloWorld')).toBe('hello-world');
      expect(camelToKebab('helloWorldTest')).toBe('hello-world-test');
    });

    it('kebabToCamel should convert kebab-case', () => {
      expect(kebabToCamel('hello-world')).toBe('helloWorld');
      expect(kebabToCamel('hello-world-test')).toBe('helloWorldTest');
    });
  });

  describe('Singleton', () => {
    it('should return same instance', () => {
      const instance1 = getTypeScriptStrictUtilities();
      const instance2 = getTypeScriptStrictUtilities();
      expect(instance1).toBe(instance2);
    });

    it('should expose all utilities', () => {
      const instance = new TypeScriptStrictUtilities();
      expect(typeof instance.isNonNull).toBe('function');
      expect(typeof instance.deepClone).toBe('function');
      expect(typeof instance.groupBy).toBe('function');
    });
  });
});

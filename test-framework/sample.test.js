/**
 * QTest Sample Test (Plain JS, self-contained)
 * Run: node --input-type=module < THIS_FILE
 */

import { describe, it, expect, qmock, qmockSpyOn, runFiles, printReport, setupGlobals } from './qtest.js';

// Make globals available for test syntax
setupGlobals(globalThis);

// ============ Tests ============

describe('QTest Demo - Basic Matchers', () => {

  it('toBe works', () => {
    expect(1 + 1).toBe(2);
    expect('hello').toBe('hello');
    expect(null).toBe(null);
    expect(undefined).toBeUndefined();
  });

  it('toBeTruthy / toBeFalsy', () => {
    expect(1).toBeTruthy();
    expect(0).toBeFalsy();
    expect('hello').toBeTruthy();
    expect('').toBeFalsy();
  });

  it('toEqual deep equality', () => {
    expect({ a: 1, b: { c: 2 } }).toEqual({ a: 1, b: { c: 2 } });
    expect([1, 2, 3]).toEqual([1, 2, 3]);
  });

  it('numeric matchers', () => {
    expect(10).toBeGreaterThan(5);
    expect(3).toBeLessThan(10);
  });

  it('toContain', () => {
    expect([1, 2, 3]).toContain(2);
    expect('hello world').toContain('world');
  });

  it('toHaveLength', () => {
    expect([1, 2, 3]).toHaveLength(3);
    expect('hello').toHaveLength(5);
  });

  it('toThrow', () => {
    const fn = () => { throw new Error('oops'); };
    expect(fn).toThrow();
    expect(fn).toThrow('oops');
  });

});

describe('QTest Demo - Mock Functions', () => {

  it('qmock() basic', () => {
    const fn = qmock((a, b) => a + b);
    const result = fn(1, 2);
    expect(result).toBe(3);
    expect(fn).toHaveBeenCalledWith([1, 2]);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('mockReturnValue', () => {
    const fn = qmock(() => 'default');
    fn.mockReturnValue('mocked!');
    expect(fn()).toBe('mocked!');
  });

  it('mockImplementationOnce', () => {
    const fn = qmock((x) => x * 2);
    fn.mockImplementationOnce((x) => x * 10);
    expect(fn(1)).toBe(10);
    expect(fn(1)).toBe(2);
  });

  it('async mockResolvedValue', async () => {
    const fn = qmock(() => Promise.resolve(0));
    fn.mockResolvedValue(42);
    const result = await fn();
    expect(result).toBe(42);
  });

});

describe('QTest Demo - Nested Suites', () => {
  describe('inner suite A', () => {
    it('inner test passes', () => {
      expect(1).toBe(1);
    });
  });
  describe('inner suite B', () => {
    it('inner test passes too', () => {
      expect(2).toBe(2);
    });
  });
});

// ============ Run ============
const result = await runFiles(['test-framework/sample.test.js']);
printReport(result);

process.exit(result.failed > 0 ? 1 : 0);

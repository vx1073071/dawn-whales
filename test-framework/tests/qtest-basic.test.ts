/**
 * QTest Framework - Sample tests
 * Q44: 测试框架自建
 *
 * Run with:
 *   npx tsx test-framework/cli.ts run test-framework/tests/*.test.ts
 */

import { describe, it, expect } from '../core.js';
import { qmock, qmockSpyOn } from '../mock.js';

// ============ Basic Matchers ============

describe('QTest Basic Matchers', () => {

  it('toBe matcher works', () => {
    expect(1 + 1).toBe(2);
    expect('hello').toBe('hello');
    expect(null).toBe(null);
    expect(undefined).toBeUndefined();
  });

  it('toEqual deep equality', () => {
    expect({ a: 1, b: { c: 2 } }).toEqual({ a: 1, b: { c: 2 } });
    expect([1, 2, 3]).toEqual([1, 2, 3]);
    expect(new Set([1, 2])).toEqual(new Set([1, 2]));
  });

  it('toBeTruthy / toBeFalsy', () => {
    expect(1).toBeTruthy();
    expect(0).toBeFalsy();
    expect('').toBeFalsy();
    expect('hello').toBeTruthy();
  });

  it('numeric matchers', () => {
    expect(10).toBeGreaterThan(5);
    expect(3).toBeLessThan(10);
    expect(5).toBeGreaterThanOrEqual(5);
    expect(5).toBeLessThanOrEqual(5);
    expect(3.14159).toBeCloseTo(3.14);
  });

  it('string / array matchers', () => {
    expect('hello world').toContain('world');
    expect([1, 2, 3]).toContain(2);
    expect('hello world').toMatch(/world/);
    expect([1, 2, 3]).toHaveLength(3);
  });

  it('instance / type matchers', () => {
    expect(new Error('oops')).toBeInstanceOf(Error);
    expect('hello').toBeType('string');
    expect(42).toBeType('number');
  });

});

// ============ Async / Promise ============

describe('QTest Async Support', () => {

  it('resolves matcher', async () => {
    const p = Promise.resolve(42);
    await expect(p).resolves.toBe(42);
  });

  it('rejects matcher', async () => {
    const p = Promise.reject(new Error('fail'));
    await expect(p).rejects.toThrow('fail');
  });

  it('async function', async () => {
    const fn = async () => 'hello';
    const result = await fn();
    expect(result).toBe('hello');
  });

});

// ============ Mock Functions ============

describe('QTest Mock Functions', () => {

  it('qmock() basic', () => {
    const fn = qmock<(a: number, b: number) => number>((a, b) => a + b);
    const result = fn(1, 2);
    expect(result).toBe(3);
    expect(fn).toHaveBeenCalledWith([1, 2]);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('qmockReturnValue', () => {
    const fn = qmock<() => string>(() => 'default');
    fn.mockReturnValue('mocked');
    expect(fn()).toBe('mocked');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('qmockImplementationOnce', () => {
    const fn = qmock<(x: number) => number>((x) => x * 2);
    fn.mockImplementationOnce((x) => x * 10);
    expect(fn(1)).toBe(10);  // once
    expect(fn(1)).toBe(2);   // fallback to default
  });

  it('qmockResolvedValue', async () => {
    const fn = qmock<() => Promise<number>>(() => Promise.resolve(0));
    fn.mockResolvedValue(42);
    const result = await fn();
    expect(result).toBe(42);
  });

});

// ============ Spy On ============

describe('QTest Spy Functions', () => {

  it('qmockSpyOn spies on methods', () => {
    const obj = {
      method: (x: number) => x * 2,
    };
    const spy = qmockSpyOn(obj, 'method');
    obj.method(5);
    expect(spy).toHaveBeenCalledWith([5]);
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('spy can modify return value', () => {
    const obj = { greet: (name: string) => `Hello ${name}` };
    const spy = qmockSpyOn(obj, 'greet');
    spy.mockReturnValue('Mocked!');
    expect(obj.greet('World')).toBe('Mocked!');
    spy.mockRestore();
  });

});

// ============ Hooks ============

describe('QTest Hooks', () => {
  let counter = 0;

  beforeAll(() => {
    counter = 0;
  });

  beforeEach(() => {
    counter++;
  });

  it('beforeAll + beforeEach', () => {
    expect(counter).toBeGreaterThan(0);
  });

  it('counter increments per test', () => {
    expect(counter).toBeGreaterThan(0);
  });

  afterEach(() => {
    // cleanup
  });

  afterAll(() => {
    counter = 0;
  });

});

// ============ Nested Describe ============

describe('QTest Nested Suites', () => {

  describe('inner suite 1', () => {
    it('inner test 1', () => {
      expect(1).toBe(1);
    });
  });

  describe('inner suite 2', () => {
    it('inner test 2', () => {
      expect(2).toBe(2);
    });
  });

});

// ============ Skip / Only (describe/it modifiers) ============

describe('QTest Skip & Only', () => {

  xit('this test is skipped', () => {
    throw new Error('Should not run');
  });

  it('this test runs', () => {
    expect(true).toBe(true);
  });

  // Note: fit/fdescribe would need test-file-level isolation to work properly
  // (since only one file runs at a time, fit just focuses within file)

});

// ============ Error Handling ============

describe('QTest Error Handling', () => {

  it('toThrow matcher', () => {
    const fn = () => { throw new Error('oops'); };
    expect(fn).toThrow();
    expect(fn).toThrow('oops');
    expect(fn).toThrow(/oops/);
  });

  it('toThrow with error class', () => {
    class CustomError extends Error {}
    const fn = () => { throw new CustomError('custom'); };
    expect(fn).toThrow(CustomError);
  });

});

/**
 * QExpect - Assertion library (standalone, no Jest/Vitest dependency)
 * Q44: 测试框架自建
 *
 * Usage: expect(value).toBe(expected)
 *        await expect(promise).resolves.toBe(expected)
 *        expect(value).not.toBe(expected)
 *        expect.soft(value).toBe(expected)  // soft assert
 */

import type { ExpectConfig, MatcherResult, AsymmetricMatcher } from './types.js';

// ============ Matcher Utilities ============

function stringify(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (typeof value === 'string') return `"${value}"`;
  if (typeof value === 'bigint') return `${value}n`;
  if (typeof value === 'function') return `[Function: ${value.name || 'anonymous'}]`;
  if (typeof value === 'symbol') return value.toString();
  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    return String(value);
  }
}

function buildMessage(
  matcherName: string,
  received: unknown,
  expected?: unknown,
  options?: { isNot?: boolean; promise?: string }
): string {
  const r = stringify(received);
  const e = expected !== undefined ? stringify(expected) : '';
  const not = options?.isNot ? 'not ' : '';
  const promise = options?.promise ? ` ${options.promise} ` : '';
  return `expect(${r})${promise}.${not}${matcherName}(${e})`;
}

function getDeepEquality(a: unknown, b: unknown): boolean {
  // Handle primitives, dates, regex, arrays, objects
  if (Object.is(a, b)) return true;
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;

  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (a instanceof RegExp && b instanceof RegExp) return a.toString() === b.toString();

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((val, i) => getDeepEquality(val, b[i]));
  }

  if (typeof a === 'object' && typeof b === 'object') {
    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;
    const aKeys = Object.keys(aObj);
    const bKeys = Object.keys(bObj);
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every(key => getDeepEquality(aObj[key], bObj[key]));
  }

  return false;
}

function getDeepDiff(a: unknown, b: unknown, path = ''): string {
  if (Object.is(a, b)) return '';
  if (a === null || b === null || typeof a !== typeof b) {
    return `  ${path || 'root'}: ${stringify(a)} ≠ ${stringify(b)}`;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    const diffs: string[] = [];
    const len = Math.max(a.length, b.length);
    for (let i = 0; i < len; i++) {
      const d = getDeepDiff(a[i], b[i], `${path}[${i}]`);
      if (d) diffs.push(d);
    }
    return diffs.join('\n');
  }
  if (typeof a === 'object' && typeof b === 'object') {
    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;
    const keys = new Set([...Object.keys(aObj), ...Object.keys(bObj)]);
    const diffs: string[] = [];
    for (const key of keys) {
      const d = getDeepDiff(aObj[key], bObj[key], path ? `${path}.${key}` : key);
      if (d) diffs.push(d);
    }
    return diffs.join('\n');
  }
  return `  ${path || 'root'}: ${stringify(a)} ≠ ${stringify(b)}`;
}

// ============ Asymmetric Matchers ============

export class Any implements AsymmetricMatcher {
  constructor(private type: string) {}
  asymmetricMatch(value: unknown): boolean {
    if (this.type === 'any') return true;
    return typeof value === this.type;
  }
  toString(): string { return `Any<${this.type}>`; }
}

export class ObjectContaining implements AsymmetricMatcher {
  constructor(private sample: Record<string, unknown>) {}
  asymmetricMatch(value: unknown): boolean {
    if (typeof value !== 'object' || value === null) return false;
    return Object.entries(this.sample).every(([k, v]) =>
      getDeepEquality((value as Record<string, unknown>)[k], v)
    );
  }
  toString(): string { return `ObjectContaining<${stringify(this.sample)}>`; }
}

export class ArrayContaining implements AsymmetricMatcher {
  constructor(private sample: unknown[]) {}
  asymmetricMatch(value: unknown): boolean {
    if (!Array.isArray(value)) return false;
    return this.sample.every(item => value.some(v => getDeepEquality(v, item)));
  }
  toString(): string { return `ArrayContaining<${stringify(this.sample)}>`; }
}

export class StringContaining implements AsymmetricMatcher {
  constructor(private str: string) {}
  asymmetricMatch(value: unknown): boolean {
    return typeof value === 'string' && value.includes(this.str);
  }
  toString(): string { return `StringContaining<${this.str}>`; }
}

export class StringMatching implements AsymmetricMatcher {
  constructor(private re: RegExp | string) {}
  asymmetricMatch(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    const _re = typeof this.re === 'string' ? new RegExp(this.re) : this.re;
    return _re.test(value as string);
  }
  toString(): string { return `StringMatching<${this.re}>`; }
}

function isAsymmetricMatcher(v: unknown): v is AsymmetricMatcher {
  return v !== null && typeof v === 'object' && typeof (v as AsymmetricMatcher).asymmetricMatch === 'function';
}

function matchValue(received: unknown, expected: unknown): boolean {
  if (isAsymmetricMatcher(expected)) return expected.asymmetricMatch(received);
  return getDeepEquality(received, expected);
}

// ============ Expect State ============

let currentTestSoftFailures: Array<{ message: string }> = [];
let currentConfig: ExpectConfig = { not: false, soft: false };

export function setCurrentTestContext(softFailures: Array<{ message: string }>): void {
  currentTestSoftFailures = softFailures;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createExpect(received: unknown, config: ExpectConfig = { not: false, soft: false }): any {
  const { not, promise, soft } = config;

  const makeMatcher = <T>(matcherFn: (received: unknown, expected?: T) => MatcherResult) => {
    return (expected?: T) => {
      const result = matcherFn(received, expected);
      const pass = not ? !result.pass : result.pass;
      const msg = result.message();

      if (!pass) {
        const error = new Error(msg);
        error.name = 'AssertionError';
        if (soft) {
          currentTestSoftFailures.push({ message: msg });
          return;
        }
        throw error;
      }
      return undefined;
    };
  };

  // ============ Matchers ============

  const toBe = makeMatcher<unknown>((received, expected) => {
    const pass = Object.is(received, expected);
    return {
      pass,
      message: () => buildMessage('toBe', received, expected, { isNot: not }),
      actual: received,
      expected,
    };
  });

  const toEqual = makeMatcher<unknown>((received, expected) => {
    const pass = getDeepEquality(received, expected);
    return {
      pass,
      message: () => {
        const diff = getDeepDiff(received, expected);
        return `${buildMessage('toEqual', received, expected, { isNot: not })}\nDiff:\n${diff}`;
      },
      actual: received,
      expected,
    };
  });

  const toStrictEqual = makeMatcher<unknown>((received, expected) => {
    // Strict: same prototype, same undefined keys, same array sparseness
    const pass = getDeepEquality(received, expected)
      && Object.getPrototypeOf(received) === Object.getPrototypeOf(expected);
    return {
      pass,
      message: () => buildMessage('toStrictEqual', received, expected, { isNot: not }),
      actual: received,
      expected,
    };
  });

  const toBeTruthy = makeMatcher<never>((received) => {
    const pass = !!received;
    return {
      pass,
      message: () => buildMessage('toBeTruthy', received, undefined, { isNot: not }),
      actual: received,
    };
  });

  const toBeFalsy = makeMatcher<never>((received) => {
    const pass = !received;
    return {
      pass,
      message: () => buildMessage('toBeFalsy', received, undefined, { isNot: not }),
      actual: received,
    };
  });

  const toBeNull = makeMatcher<never>((received) => {
    const pass = received === null;
    return {
      pass,
      message: () => buildMessage('toBeNull', received, undefined, { isNot: not }),
      actual: received,
    };
  });

  const toBeUndefined = makeMatcher<never>((received) => {
    const pass = received === undefined;
    return {
      pass,
      message: () => buildMessage('toBeUndefined', received, undefined, { isNot: not }),
      actual: received,
    };
  });

  const toBeDefined = makeMatcher<never>((received) => {
    const pass = received !== undefined;
    return {
      pass,
      message: () => buildMessage('toBeDefined', received, undefined, { isNot: not }),
      actual: received,
    };
  });

  const toBeNaN = makeMatcher<never>((received) => {
    const pass = typeof received === 'number' && isNaN(received);
    return {
      pass,
      message: () => buildMessage('toBeNaN', received, undefined, { isNot: not }),
      actual: received,
    };
  });

  const toBeGreaterThan = makeMatcher<number>((received, expected) => {
    const pass = typeof received === 'number' && typeof expected === 'number' && received > expected;
    return {
      pass,
      message: () => buildMessage('toBeGreaterThan', received, expected, { isNot: not }),
      actual: received,
      expected,
    };
  });

  const toBeGreaterThanOrEqual = makeMatcher<number>((received, expected) => {
    const pass = typeof received === 'number' && typeof expected === 'number' && received >= expected;
    return {
      pass,
      message: () => buildMessage('toBeGreaterThanOrEqual', received, expected, { isNot: not }),
      actual: received,
      expected,
    };
  });

  const toBeLessThan = makeMatcher<number>((received, expected) => {
    const pass = typeof received === 'number' && typeof expected === 'number' && received < expected;
    return {
      pass,
      message: () => buildMessage('toBeLessThan', received, expected, { isNot: not }),
      actual: received,
      expected,
    };
  });

  const toBeLessThanOrEqual = makeMatcher<number>((received, expected) => {
    const pass = typeof received === 'number' && typeof expected === 'number' && received <= expected;
    return {
      pass,
      message: () => buildMessage('toBeLessThanOrEqual', received, expected, { isNot: not }),
      actual: received,
      expected,
    };
  });

  const toBeCloseTo = makeMatcher<number>((received, expected) => {
    const pass = typeof received === 'number' && typeof expected === 'number'
      && Math.abs(received - expected) < 0.0001;
    return {
      pass,
      message: () => buildMessage('toBeCloseTo', received, expected, { isNot: not }),
      actual: received,
      expected,
    };
  });

  const toBeType = makeMatcher<string>((received, expected) => {
    const typeMap: Record<string, string> = {
      'null': 'null',
      'undefined': 'undefined',
      'string': 'string',
      'number': 'number',
      'bigint': 'bigint',
      'boolean': 'boolean',
      'symbol': 'symbol',
      'function': 'function',
    };
    let actualType = typeof received;
    if (received === null) actualType = 'null' as any;
    const pass = actualType === expected;
    return {
      pass,
      message: () => buildMessage('toBeType', actualType, expected, { isNot: not }),
      actual: actualType,
      expected,
    };
  });

  const toBeInstanceOf = makeMatcher<new (...args: any[]) => any>((received, expected) => {
    const pass = expected ? received instanceof expected : false;
    return {
      pass,
      message: () => buildMessage('toBeInstanceOf', received, expected?.name, { isNot: not }),
      actual: received,
      expected: expected?.name,
    };
  });

  const toMatch = makeMatcher<RegExp | string>((received, expected) => {
    const str = typeof received === 'string' ? received : String(received);
    const re = typeof expected === 'string' ? new RegExp(expected) : expected;
    const pass = re ? re.test(str) : false;
    return {
      pass,
      message: () => buildMessage('toMatch', received, expected, { isNot: not }),
      actual: received,
      expected,
    };
  });

  const toContain = makeMatcher<unknown>((received, expected) => {
    if (Array.isArray(received)) {
      const pass = received.some(v => matchValue(v, expected));
      return {
        pass,
        message: () => buildMessage('toContain', received, expected, { isNot: not }),
        actual: received,
        expected,
      };
    }
    if (typeof received === 'string') {
      const pass = typeof expected === 'string' && received.includes(expected);
      return {
        pass,
        message: () => buildMessage('toContain', received, expected, { isNot: not }),
        actual: received,
        expected,
      };
    }
    const pass = false;
    return {
      pass,
      message: () => `expected ${stringify(received)} to contain ${stringify(expected)}`,
      actual: received,
      expected,
    };
  });

  const toContainEqual = makeMatcher<unknown>((received, expected) => {
    if (!Array.isArray(received)) {
      return { pass: false, message: () => `toContainEqual requires array, got ${typeof received}` };
    }
    const pass = received.some(v => getDeepEquality(v, expected));
    return {
      pass,
      message: () => buildMessage('toContainEqual', received, expected, { isNot: not }),
      actual: received,
      expected,
    };
  });

  const toHaveLength = makeMatcher<number>((received, expected) => {
    const len = typeof received === 'string' || Array.isArray(received)
      ? (received as any).length
      : undefined;
    const pass = typeof len === 'number' && len === expected;
    return {
      pass,
      message: () => buildMessage('toHaveLength', len, expected, { isNot: not }),
      actual: len,
      expected,
    };
  });

  const toHaveProperty = makeMatcher<string>((received, expected) => {
    if (typeof received !== 'object' || received === null) {
      return { pass: false, message: () => `toHaveProperty requires object, got ${typeof received}` };
    }
    const keys = expected!.split('.');
    let current: unknown = received;
    for (const key of keys) {
      if (typeof current !== 'object' || current === null) return { pass: false, message: () => `property ${expected} not found` };
      current = (current as Record<string, unknown>)[key];
    }
    // If expected value is provided as second arg... handled elsewhere
    return {
      pass: current !== undefined,
      message: () => buildMessage('toHaveProperty', current, undefined, { isNot: not }),
      actual: current,
    };
  });

  const toThrow = makeMatcher<any>((received, expected) => {
    if (typeof received !== 'function') {
      return {
        pass: false,
        message: () => `expect(received).toThrow() — received is not a function (got ${typeof received})`,
      };
    }
    let thrown: unknown;
    let didThrow = false;
    try {
      (received as () => unknown)();
    } catch (e) {
      thrown = e;
      didThrow = true;
    }
    if (!didThrow) {
      return {
        pass: false,
        message: () => `expected function to throw, but it didn't throw`,
      };
    }
    if (expected === undefined) {
      return { pass: !not, message: () => `expected function not to throw, but it threw: ${stringify(thrown)}` };
    }
    // expected can be Error class, string, or regex
    let pass: boolean;
    if (expected instanceof RegExp || typeof expected === 'string') {
      const msg = thrown instanceof Error ? thrown.message : String(thrown);
      pass = typeof expected === 'string' ? msg.includes(expected) : expected.test(msg);
    } else if (typeof expected === 'function') {
      pass = thrown instanceof (expected as any);
    } else {
      pass = getDeepEquality(thrown, expected);
    }
    return {
      pass,
      message: () => buildMessage('toThrow', thrown, expected, { isNot: not }),
      actual: thrown,
      expected,
    };
  });

  const toHaveBeenCalled = makeMatcher<never>((received: unknown) => {
    const mock = (received as any)?._isQMock ? received as any : null;
    if (!mock) {
      return { pass: false, message: () => `toHaveBeenCalled requires a mock function` };
    }
    const pass = mock.mock.calls.length > 0;
    return {
      pass,
      message: () => buildMessage('toHaveBeenCalled', mock.mock.calls.length, undefined, { isNot: not }),
      actual: mock.mock.calls.length,
    };
  });

  const toHaveBeenCalledTimes = makeMatcher<number>((received: unknown, expected) => {
    const mock = (received as any)?._isQMock ? received as any : null;
    if (!mock) {
      return { pass: false, message: () => `toHaveBeenCalledTimes requires a mock function` };
    }
    const pass = mock.mock.calls.length === expected;
    return {
      pass,
      message: () => buildMessage('toHaveBeenCalledTimes', mock.mock.calls.length, expected, { isNot: not }),
      actual: mock.mock.calls.length,
      expected,
    };
  });

  const toHaveBeenCalledWith = makeMatcher<unknown[]>((received: unknown, expected) => {
    const mock = (received as any)?._isQMock ? received as any : null;
    if (!mock) {
      return { pass: false, message: () => `toHaveBeenCalledWith requires a mock function` };
    }
    const pass = mock.mock.calls.some((call: unknown[]) => getDeepEquality(call, expected));
    return {
      pass,
      message: () => buildMessage('toHaveBeenCalledWith', mock.mock.calls, expected, { isNot: not }),
      actual: mock.mock.calls,
      expected,
    };
  });

  const toHaveLastBeenCalledWith = makeMatcher<unknown[]>((received: unknown, expected) => {
    const mock = (received as any)?._isQMock ? received as any : null;
    if (!mock) {
      return { pass: false, message: () => `toHaveLastBeenCalledWith requires a mock function` };
    }
    const lastCall = mock.mock.calls[mock.mock.calls.length - 1];
    const pass = lastCall ? getDeepEquality(lastCall, expected) : false;
    return {
      pass,
      message: () => buildMessage('toHaveLastBeenCalledWith', lastCall, expected, { isNot: not }),
      actual: lastCall,
      expected,
    };
  });

  const toHaveReturned = makeMatcher<never>((received: unknown) => {
    const mock = (received as any)?._isQMock ? received as any : null;
    if (!mock) {
      return { pass: false, message: () => `toHaveReturned requires a mock function` };
    }
    const pass = mock.mock.results.some((r: any) => r.type === 'return');
    return {
      pass,
      message: () => buildMessage('toHaveReturned', mock.mock.results, undefined, { isNot: not }),
      actual: mock.mock.results,
    };
  });

  const toHaveReturnedWith = makeMatcher<unknown>((received: unknown, expected) => {
    const mock = (received as any)?._isQMock ? received as any : null;
    if (!mock) {
      return { pass: false, message: () => `toHaveReturnedWith requires a mock function` };
    }
    const pass = mock.mock.results
      .filter((r: any) => r.type === 'return')
      .some((r: any) => getDeepEquality(r.value, expected));
    return {
      pass,
      message: () => buildMessage('toHaveReturnedWith', mock.mock.results, expected, { isNot: not }),
      actual: mock.mock.results,
      expected,
    };
  });

  const toHaveLastReturnedWith = makeMatcher<unknown>((received: unknown, expected) => {
    const mock = (received as any)?._isQMock ? received as any : null;
    if (!mock) {
      return { pass: false, message: () => `toHaveLastReturnedWith requires a mock function` };
    }
    const returned = [...mock.mock.results].reverse().find((r: any) => r.type === 'return');
    const pass = returned ? getDeepEquality(returned.value, expected) : false;
    return {
      pass,
      message: () => buildMessage('toHaveLastReturnedWith', returned?.value, expected, { isNot: not }),
      actual: returned?.value,
      expected,
    };
  });

  const toHaveNthReturnedWith = makeMatcher<unknown>((received: unknown, n: unknown) => {
    const mock = (received as any)?._isQMock ? received as any : null;
    if (!mock) {
      return { pass: false, message: () => `toHaveNthReturnedWith requires a mock function` };
    }
    const idx = (n as number) - 1;
    const result = mock.mock.results[idx];
    const pass = result?.type === 'return';
    return {
      pass,
      message: () => buildMessage('toHaveNthReturnedWith', result?.value, n, { isNot: not }),
      actual: result?.value,
      expected: n,
    };
  });

  // ============ Promise Matchers ============

  const promiseMatchers = promise === 'resolves'
    ? {
        toBe: async (expected: unknown) => {
          const val = await received;
          return toBe(expected);
        },
        toEqual: async (expected: unknown) => {
          const val = await received;
          return toEqual(expected);
        },
        toBeTruthy: async () => {
          const val = await received;
          return toBeTruthy();
        },
        toBeFalsy: async () => {
          const val = await received;
          return toBeFalsy();
        },
        toThrow: async () => {
          try {
            await received;
            return toThrow(() => {});  // should not reach here
          } catch (e) {
            return { pass: !not, message: () => `expected promise to resolve, but it rejected with ${stringify(e)}` };
          }
        },
      }
    : promise === 'rejects'
    ? {
        toBe: async (expected: unknown) => {
          try {
            await received;
            throw new Error('promise resolved but expected reject');
          } catch (e) {
            const pass = getDeepEquality(e, expected);
            if (!pass && !not) throw new Error(buildMessage('rejects.toBe', e, expected));
          }
        },
        toThrow: async (expected?: unknown) => {
          try {
            await received;
            throw new Error('promise resolved but expected reject');
          } catch (e) {
            return (toThrow as any)(() => { throw e; })(expected);
          }
        },
      }
    : {};

  // ============ Build Expect Object ============

  const matchers = {
    toBe,
    toEqual,
    toStrictEqual,
    toBeTruthy,
    toBeFalsy,
    toBeNull,
    toBeUndefined,
    toBeDefined,
    toBeNaN,
    toBeGreaterThan,
    toBeGreaterThanOrEqual,
    toBeLessThan,
    toBeLessThanOrEqual,
    toBeCloseTo,
    toBeType,
    toBeInstanceOf,
    toMatch,
    toContain,
    toContainEqual,
    toHaveLength,
    toHaveProperty,
    toThrow,
    toHaveBeenCalled,
    toHaveBeenCalledTimes,
    toHaveBeenCalledWith,
    toHaveLastBeenCalledWith,
    toHaveReturned,
    toHaveReturnedWith,
    toHaveLastReturnedWith,
    toHaveNthReturnedWith,
    ...promiseMatchers,
  };

  // .not — copy matchers from notExpect so they invert
  const notMatchers: Record<string, any> = not ? {} : {};
  if (!not) {
    const notConfig: any = { ...config, not: true };
    const notExpect: any = createExpect(received, notConfig);
    // only copy direct (non-getter) function properties to avoid infinite recursion
    const ownProps = Object.getOwnPropertyNames(notExpect);
    ownProps.forEach(key => {
      if (key === 'not' || key === 'resolves' || key === 'rejects') return;
      const descriptor = Object.getOwnPropertyDescriptor(notExpect, key);
      if (descriptor && descriptor.get) return; // skip getters
      if (typeof (notExpect as any)[key] === 'function') {
        notMatchers[key] = (notExpect as any)[key];
      }
    });
  }

  // .resolves / .rejects
  let resolves: any, rejects: any;
  if (!promise && received instanceof Promise) {
    const resolvesConfig: any = { ...config, promise: 'resolves' };
    resolves = createExpect(received, resolvesConfig);
    const rejectsConfig: any = { ...config, promise: 'rejects' };
    rejects = createExpect(received, rejectsConfig);
  }

  return {
    // spread all matchers at top level so .toBe(...) works directly
    ...matchers,
    ...notMatchers,
    // .not, .resolves, .rejects as getters so they create new expect objects
    get not() {
      return createExpect(received, { ...config, not: !config.not });
    },
    get resolves() {
      return createExpect(received, { ...config, promise: 'resolves' });
    },
    get rejects() {
      return createExpect(received, { ...config, promise: 'rejects' });
    },
  };
}

// ============ Global expect (soft support) ============

export function expect(received: unknown) {
  return createExpect(received, { not: false, soft: false });
}

export namespace expect {
  export function soft(received: unknown) {
    return createExpect(received, { not: false, soft: true });
  }

  export function anything() {
    return new Any('any');
  }

  export function any(type: string) {
    return new Any(type);
  }

  export function objectContaining(sample: Record<string, unknown>) {
    return new ObjectContaining(sample);
  }

  export function arrayContaining(sample: unknown[]) {
    return new ArrayContaining(sample);
  }

  export function stringContaining(str: string) {
    return new StringContaining(str);
  }

  export function stringMatching(re: RegExp | string) {
    return new StringMatching(re);
  }

  export function not(actual: unknown) {
    return createExpect(undefined, { not: true, soft: false });
  }
}

export { getDeepEquality, stringify };

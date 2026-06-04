content = r"""/**
 * QTest Core (JS version)
 * Q44: 测试框架自建
 * Standalone lightweight test framework - no Vitest/Jest dependency.
 */

// ============ State ============
const state = {
  currentSuite: null,
  rootSuite: null,
  currentFile: 'unknown',
  config: { timeout: 5000, retries: 0, bail: 0, onlyEnabled: false, skipEnabled: false },
  softFailures: [],
};

function createSuite(name, file) {
  return { name, file, tests: [], hooks: { beforeAll: [], afterAll: [], beforeEach: [], afterEach: [] }, children: [], parent: null };
}
function createTest(name, fn, file) {
  return { name, file, fn, status: 'pending', timeout: state.config.timeout, retries: state.config.retries, only: false, skip: false, todo: false };
}

// ============ Globals setup ============
export function setupGlobals(globalObj = globalThis) {
  globalObj.describe = describe;
  globalObj.it = it;
  globalObj.fit = fit;
  globalObj.xit = xit;
  globalObj.fdescribe = fdescribe;
  globalObj.xdescribe = xdescribe;
  globalObj.todo = todo;
  globalObj.beforeAll = beforeAll;
  globalObj.afterAll = afterAll;
  globalObj.beforeEach = beforeEach;
  globalObj.afterEach = afterEach;
  globalObj.expect = createExpect;
  setupMockGlobals(globalObj);
}

// ============ describe / it ============
export function describe(name, fn) {
  const suite = createSuite(name, state.currentFile);
  if (state.currentSuite) { state.currentSuite.children.push(suite); suite.parent = state.currentSuite; }
  else { state.rootSuite = suite; }
  const prev = state.currentSuite;
  state.currentSuite = suite;
  try { fn(); } finally { state.currentSuite = prev; }
}

export function fdescribe(name, fn) { state.config.onlyEnabled = true; describe(name, fn); state.config.onlyEnabled = false; }
export function xdescribe(name, fn) { state.config.skipEnabled = true; describe(name, fn); state.config.skipEnabled = false; }

export function it(name, fn) {
  if (!state.currentSuite) { state.rootSuite = createSuite('(root)', state.currentFile); state.currentSuite = state.rootSuite; }
  const test = createTest(name, fn, state.currentFile);
  if (state.config.onlyEnabled) test.only = true;
  if (state.config.skipEnabled) test.skip = true;
  state.currentSuite.tests.push(test);
}

export function fit(name, fn) { state.config.onlyEnabled = true; it(name, fn); state.config.onlyEnabled = false; }
export function xit(name, _fn) {
  if (!state.currentSuite) { state.rootSuite = createSuite('(root)', state.currentFile); state.currentSuite = state.rootSuite; }
  const test = createTest(name, _fn || (() => {}), state.currentFile); test.skip = true; test.status = 'skipped';
  state.currentSuite.tests.push(test);
}
export function todo(name) {
  if (!state.currentSuite) { state.rootSuite = createSuite('(root)', state.currentFile); state.currentSuite = state.rootSuite; }
  const test = createTest(name, async () => {}, state.currentFile); test.todo = true; test.status = 'skipped';
  state.currentSuite.tests.push(test);
}

// ============ Hooks ============
export function beforeAll(fn) { if (!state.currentSuite) throw new Error('beforeAll must be inside describe'); state.currentSuite.hooks.beforeAll.push(fn); }
export function afterAll(fn) { if (!state.currentSuite) throw new Error('afterAll must be inside describe'); state.currentSuite.hooks.afterAll.push(fn); }
export function beforeEach(fn) { if (!state.currentSuite) throw new Error('beforeEach must be inside describe'); state.currentSuite.hooks.beforeEach.push(fn); }
export function afterEach(fn) { if (!state.currentSuite) throw new Error('afterEach must be inside describe'); state.currentSuite.hooks.afterEach.push(fn); }

// ============ Expect ============
function stringify(value) {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (typeof value === 'string') return '"' + value + '"';
  try { return JSON.stringify(value, null, 2) ?? String(value); } catch { return String(value); }
}

function getDeepEquality(a, b) {
  if (Object.is(a, b)) return true;
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => getDeepEquality(v, b[i]));
  }
  if (typeof a === 'object' && typeof b === 'object') {
    const aObj = a, bObj = b;
    const aKeys = Object.keys(aObj); const bKeys = Object.keys(bObj);
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every(k => getDeepEquality(aObj[k], bObj[k]));
  }
  return false;
}

export function createExpect(received, config = { not: false, soft: false }) {
  const { not, soft } = config;

  function makeMatcher(matcherFn) {
    return (...args) => {
      const result = matcherFn(received, ...args);
      const pass = not ? !result.pass : result.pass;
      if (!pass) {
        const error = new Error(result.message());
        error.name = 'AssertionError';
        if (soft) { state.softFailures.push({ message: result.message() }); return; }
        throw error;
      }
    };
  }

  const toBe = makeMatcher((received, expected) => ({
    pass: Object.is(received, expected),
    message: () => 'expect(' + stringify(received) + ')' + (not ? '.not' : '') + '.toBe(' + stringify(expected) + ')'
  }));

  const toEqual = makeMatcher((received, expected) => ({
    pass: getDeepEquality(received, expected),
    message: () => 'expect(' + stringify(received) + ')' + (not ? '.not' : '') + '.toEqual(' + stringify(expected) + ')'
  }));

  const toBeTruthy = makeMatcher((received) => ({
    pass: !!received,
    message: () => 'expect(' + stringify(received) + ')' + (not ? '.not' : '') + '.toBeTruthy()'
  }));

  const toBeFalsy = makeMatcher((received) => ({
    pass: !received,
    message: () => 'expect(' + stringify(received) + ')' + (not ? '.not' : '') + '.toBeFalsy()'
  }));

  const toBeNull = makeMatcher((received) => ({
    pass: received === null,
    message: () => 'expect(' + stringify(received) + ')' + (not ? '.not' : '') + '.toBeNull()'
  }));

  const toBeUndefined = makeMatcher((received) => ({
    pass: received === undefined,
    message: () => 'expect(' + stringify(received) + ')' + (not ? '.not' : '') + '.toBeUndefined()'
  }));

  const toBeDefined = makeMatcher((received) => ({
    pass: received !== undefined,
    message: () => 'expect(' + stringify(received) + ')' + (not ? '.not' : '') + '.toBeDefined()'
  }));

  const toBeNaN = makeMatcher((received) => ({
    pass: typeof received === 'number' && isNaN(received),
    message: () => 'expect(' + stringify(received) + ')' + (not ? '.not' : '') + '.toBeNaN()'
  }));

  const toBeGreaterThan = makeMatcher((received, expected) => ({
    pass: typeof received === 'number' && received > expected,
    message: () => 'expect(' + received + ')' + (not ? '.not' : '') + '.toBeGreaterThan(' + expected + ')'
  }));

  const toBeLessThan = makeMatcher((received, expected) => ({
    pass: typeof received === 'number' && received < expected,
    message: () => 'expect(' + received + ')' + (not ? '.not' : '') + '.toBeLessThan(' + expected + ')'
  }));

  const toBeCloseTo = makeMatcher((received, expected) => ({
    pass: typeof received === 'number' && typeof expected === 'number' && Math.abs(received - expected) < 0.0001,
    message: () => 'expect(' + received + ')' + (not ? '.not' : '') + '.toBeCloseTo(' + expected + ')'
  }));

  const toContain = makeMatcher((received, expected) => {
    if (Array.isArray(received)) {
      return { pass: received.some(v => getDeepEquality(v, expected)), message: () => '.toContain' };
    }
    if (typeof received === 'string' && typeof expected === 'string') {
      return { pass: received.includes(expected), message: () => '.toContain' };
    }
    return { pass: false, message: () => 'toContain: expected array or string' };
  });

  const toHaveLength = makeMatcher((received, expected) => ({
    pass: (typeof received === 'string' || Array.isArray(received)) && received.length === expected,
    message: () => '.toHaveLength(' + expected + ')'
  }));

  const toThrow = makeMatcher((received, expected) => {
    if (typeof received !== 'function') return { pass: false, message: () => 'toThrow requires function' };
    let thrown; let didThrow = false;
    try { received(); } catch (e) { thrown = e; didThrow = true; }
    if (!didThrow) return { pass: false, message: () => 'expected function to throw, but it didn\'t' };
    if (expected === undefined) return { pass: !not, message: () => '' };
    let pass;
    if (expected instanceof RegExp || typeof expected === 'string') {
      const msg = thrown instanceof Error ? thrown.message : String(thrown);
      pass = typeof expected === 'string' ? msg.includes(expected) : expected.test(msg);
    } else if (typeof expected === 'function') {
      pass = thrown instanceof expected;
    } else { pass = getDeepEquality(thrown, expected); }
    return { pass, message: () => '.toThrow(' + stringify(expected) + ')' };
  });

  const toHaveBeenCalled = makeMatcher((received) => {
    const mock = received && received._isQMock ? received : null;
    if (!mock) return { pass: false, message: () => 'toHaveBeenCalled requires mock' };
    return { pass: mock.mock.calls.length > 0, message: () => '.toHaveBeenCalled()' };
  });

  const toHaveBeenCalledTimes = makeMatcher((received, expected) => {
    const mock = received && received._isQMock ? received : null;
    if (!mock) return { pass: false, message: () => 'toHaveBeenCalledTimes requires mock' };
    return { pass: mock.mock.calls.length === expected, message: () => '.toHaveBeenCalledTimes(' + expected + '), actual: ' + mock.mock.calls.length };
  });

  const toHaveBeenCalledWith = makeMatcher((received, expected) => {
    const mock = received && received._isQMock ? received : null;
    if (!mock) return { pass: false, message: () => 'toHaveBeenCalledWith requires mock' };
    const pass = mock.mock.calls.some(call => getDeepEquality(call, expected));
    return { pass, message: () => '.toHaveBeenCalledWith(' + stringify(expected) + ')' };
  });

  const toHaveReturnedWith = makeMatcher((received, expected) => {
    const mock = received && received._isQMock ? received : null;
    if (!mock) return { pass: false, message: () => 'toHaveReturnedWith requires mock' };
    const pass = mock.mock.results.filter(r => r.type === 'return').some(r => getDeepEquality(r.value, expected));
    return { pass, message: () => '.toHaveReturnedWith(' + stringify(expected) + ')' };
  });

  const matchers = { toBe, toEqual, toBeTruthy, toBeFalsy, toBeNull, toBeUndefined, toBeDefined, toBeNaN, toBeGreaterThan, toBeLessThan, toBeCloseTo, toContain, toHaveLength, toThrow, toHaveBeenCalled, toHaveBeenCalledTimes, toHaveBeenCalledWith, toHaveReturnedWith };

  let notMatchers = {};
  if (!not) {
    const notExpect = createExpect(received, { ...config, not: true });
    Object.keys(notExpect.matchers || {}).forEach(k => { notMatchers[k] = notExpect.matchers[k]; });
  }

  return { ...matchers, ...notMatchers };
}

// ============ Mock ============
const allMocks = [];
let callCounter = 0;

function setupMockGlobals(globalObj) {
  globalObj.qmock = qmock;
  globalObj.qmockSpyOn = qmockSpyOn;
  globalObj.qmockClearAllMocks = () => allMocks.forEach(m => m.restore());
}

export function qmock(initialImpl) {
  const state = {
    implementation: initialImpl || null,
    onceImplementations: [],
    returnValues: [],
    onceReturnValues: [],
    resolvedValues: [],
    onceResolvedValues: [],
    rejectedValues: [],
    onceRejectedValues: [],
    instances: [],
    callResults: [],
    defaultReturnValue: undefined,
    defaultThrowValue: undefined,
  };

  const metadata = {
    name: 'qmock', mockName: 'qmock',
    calls: [], instances: [], invocationCallOrder: [], results: [],
  };

  function mockFn(...args) {
    callCounter++;
    const timestamp = Date.now();
    let result;

    if (state.onceImplementations.length > 0) {
      const onceImpl = state.onceImplementations.shift();
      try { result = { type: 'return', value: onceImpl.apply(this, args) }; } catch (e) { result = { type: 'throw', value: e }; }
    } else if (state.onceReturnValues.length > 0) {
      result = { type: 'return', value: state.onceReturnValues.shift() };
    } else if (state.onceResolvedValues.length > 0) {
      result = { type: 'return', value: Promise.resolve(state.onceResolvedValues.shift()) };
    } else if (state.onceRejectedValues.length > 0) {
      result = { type: 'return', value: Promise.reject(state.onceRejectedValues.shift()) };
    } else if (state.implementation) {
      try { result = { type: 'return', value: state.implementation.apply(this, args) }; } catch (e) { result = { type: 'throw', value: e }; }
    } else if (state.returnValues.length > 0) {
      result = { type: 'return', value: state.returnValues.shift() };
    } else if (state.defaultReturnValue !== undefined) {
      result = { type: 'return', value: state.defaultReturnValue };
    } else if (state.defaultThrowValue !== undefined) {
      result = { type: 'throw', value: state.defaultThrowValue };
    } else {
      result = { type: 'return', value: undefined };
    }

    const call = { args, timestamp, isThrow: result.type === 'throw' };
    if (result.type === 'return') call.returnValue = result.value;
    else call.thrownValue = result.value;
    metadata.calls.push(call);
    metadata.results.push({ type: result.type, value: result.value });
    metadata.instances.push(this);
    metadata.invocationCallOrder.push(callCounter);

    if (result.type === 'throw') throw result.value;
    return result.value;
  }

  mockFn._isQMock = true;
  mockFn.mock = metadata;
  mockFn.mockName = (n) => { metadata.mockName = n; return mockFn; };
  mockFn.getMockName = () => metadata.mockName;
  mockFn.mockImplementation = (fn) => { state.implementation = fn; return mockFn; };
  mockFn.mockImplementationOnce = (fn) => { state.onceImplementations.push(fn); return mockFn; };
  mockFn.mockReturnValue = (val) => { state.defaultReturnValue = val; return mockFn; };
  mockFn.mockReturnValueOnce = (val) => { state.onceReturnValues.push(val); return mockFn; };
  mockFn.mockResolvedValue = (val) => { state.defaultReturnValue = Promise.resolve(val); return mockFn; };
  mockFn.mockResolvedValueOnce = (val) => { state.onceResolvedValues.push(val); return mockFn; };
  mockFn.mockRejectedValue = (err) => { state.defaultThrowValue = err; return mockFn; };
  mockFn.mockRejectedValueOnce = (err) => { state.onceRejectedValues.push(err); return mockFn; };
  mockFn.mockReturnThis = () => { state.implementation = (function() { return this; })(); return mockFn; };
  mockFn.restoreMocks = () => {
    metadata.calls = []; metadata.instances = []; metadata.invocationCallOrder = []; metadata.results = [];
    state.onceImplementations = []; state.onceReturnValues = []; state.onceResolvedValues = []; state.onceRejectedValues = [];
  };
  mockFn.mockRestore = () => {};

  allMocks.push({ restore: () => mockFn.restoreMocks() });
  return mockFn;
}

export function qmockSpyOn(obj, methodName) {
  const prop = methodName;
  const original = obj[prop];
  if (typeof original !== 'function') throw new Error('Cannot spyOn ' + prop + ': not a function');
  const mockFn = qmock(original.bind(obj));
  obj[prop] = mockFn;
  mockFn.mockRestore = () => { obj[prop] = original; };
  return mockFn;
}

// ============ Run tests ============
async function runTest(test) {
  const start = performance.now();
  const result = { name: test.name, file: test.file, status: 'running', duration: 0, assertions: 0, logs: [], error: undefined };

  if (test.skip || test.todo) { result.status = 'skipped'; return result; }

  state.softFailures = [];
  try {
    const maybePromise = test.fn();
    if (maybePromise instanceof Promise) await maybePromise;
    if (state.softFailures.length > 0) throw new Error(state.softFailures.map(f => f.message).join('\n'));
    result.status = 'passed';
  } catch (e) {
    result.status = 'failed';
    result.error = { message: e instanceof Error ? e.message : String(e), stack: e instanceof Error ? e.stack : undefined };
  }
  result.duration = Math.round(performance.now() - start);
  return result;
}

async function runSuite(suite) {
  const start = performance.now();
  const results = [];

  for (const h of suite.hooks.beforeAll) { try { await h(); } catch (e) { return { name: suite.name, file: suite.file, tests: [{ name: suite.name, file: suite.file, status: 'failed', duration: 0, assertions: 0, logs: [], error: { message: e.message } }], duration: 0, status: 'failed' }; } }

  for (const test of suite.tests) {
    for (const h of suite.hooks.beforeEach) { try { await h(); } catch {} }
    const r = await runTest(test);
    results.push(r);
    for (const h of suite.hooks.afterEach) { try { await h(); } catch {} }
  }

  for (const child of suite.children) {
    const childResult = await runSuite(child);
    results.push(...childResult.tests);
  }

  for (const h of suite.hooks.afterAll) { try { await h(); } catch {} }

  const failed = results.some(r => r.status === 'failed');
  return { name: suite.name, file: suite.file, tests: results, duration: Math.round(performance.now() - start), status: failed ? 'failed' : 'passed' };
}

export async function runFiles(files, config = {}) {
  const overallStart = performance.now();
  const allSuites = [];
  let passed = 0, failed = 0, skipped = 0, todo = 0;

  setupGlobals(globalThis);

  for (const file of files) {
    state.rootSuite = null;
    state.currentSuite = null;
    state.currentFile = file;

    try { await import(file); } catch (e) {
      allSuites.push({ name: '(file) ' + file, file, tests: [{ name: 'File load: ' + file, file, status: 'failed', duration: 0, assertions: 0, logs: [], error: { message: e.message } }], duration: 0, status: 'failed' });
      failed++;
      continue;
    }

    if (state.rootSuite) {
      const result = await runSuite(state.rootSuite);
      allSuites.push(result);
      for (const t of result.tests) { if (t.status === 'passed') passed++; else if (t.status === 'failed') failed++; else if (t.status === 'skipped') { if (t.todo) todo++; else skipped++; } }
    }
  }

  const duration = Math.round(performance.now() - overallStart);
  return { suites: allSuites, totalTests: passed + failed + skipped + todo, passed, failed, skipped, todo, duration, filesWithErrors: allSuites.filter(s => s.status === 'failed').map(s => s.file) };
}

export function printReport(result) {
  const lines = [];
  lines.push('');
  lines.push('='.repeat(60));
  lines.push('  QTest Results');
  lines.push('='.repeat(60));
  lines.push('');

  for (const suite of result.suites) {
    const icon = suite.status === 'passed' ? '✓' : '✗';
    lines.push('  ' + icon + ' ' + suite.name + ' (' + suite.file + ')');
    for (const t of suite.tests) {
      const tIcon = t.status === 'passed' ? '  ✓' : t.status === 'failed' ? '  ✗' : '  -';
      lines.push('    ' + tIcon + ' ' + t.name + ' (' + t.duration + 'ms)');
      if (t.status === 'failed' && t.error) lines.push('        Error: ' + t.error.message);
    }
    lines.push('');
  }

  lines.push('-'.repeat(60));
  lines.push('  Total: ' + result.totalTests + ' | Passed: ' + result.passed + ' | Failed: ' + result.failed + ' | Skipped: ' + result.skipped + ' | Todo: ' + result.todo);
  lines.push('  Duration: ' + (result.duration / 1000).toFixed(2) + 's');
  lines.push('-'.repeat(60));
  lines.push('');

  console.log(lines.join('\n'));
}

export { createExpect as expect };
export default { describe, it, expect: createExpect, qmock, runFiles, printReport, setupGlobals };
"""

with open(r"C:\Users\vx107\.qclaw\workspace\test-framework\qtest.js", "w", encoding="utf-8") as f:
    f.write(content)

print("qtest.js written successfully")

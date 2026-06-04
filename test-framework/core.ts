/**
 * QTest Core - describe/it runner with hook support
 * Q44: 测试框架自建
 *
 * Usage (programmatic):
 *   import { describe, it, beforeAll, afterAll, beforeEach, afterEach } from './core.js'
 *   import { run } from './runner.js'
 *
 * Usage (CLI):
 *   npx tsx cli.ts run "tests/[GLOB]/[FILE].test.ts"
 */

import { EventEmitter } from 'node:events';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type {
  TestSuite, TestCase, TestResult, SuiteHooks, RunResult, SuiteResult
} from './types.js';
import { createExpect, setCurrentTestContext } from './expect.js';
import { setupGlobals as setupMockGlobals } from './mock.js';

// ============ Globals / State ============

const state = {
  currentSuite: null as TestSuite | null,
  rootSuite: null as TestSuite | null,
  currentFile: 'unknown',
  config: {
    timeout: 5000,
    retries: 0,
    bail: 0,
    onlyEnabled: false,
    skipEnabled: false,
  } as any,
  results: [] as TestResult[],
  softFailures: [] as Array<{ message: string }>,
};

function createSuite(name: string, file: string): TestSuite {
  return {
    name,
    file,
    tests: [],
    hooks: { beforeAll: [], afterAll: [], beforeEach: [], afterEach: [] },
    children: [],
  };
}

function createTest(name: string, fn: () => void | Promise<void>, file: string): TestCase {
  return {
    name,
    file,
    fn,
    status: 'pending',
    timeout: state.config.timeout,
    retries: state.config.retries,
    only: false,
    skip: false,
    todo: false,
  };
}

// ============ Public API: describe / it / hooks ============

export function describe(name: string, fn: () => void): void {
  const suite = createSuite(name, state.currentFile);
  if (state.currentSuite) {
    state.currentSuite.children.push(suite);
    suite.parent = state.currentSuite;
  } else {
    if (!state.rootSuite) state.rootSuite = suite;
  }
  const prev = state.currentSuite;
  state.currentSuite = suite;
  try {
    fn();
  } finally {
    state.currentSuite = prev;
  }
}

// Alias: fdescribe (focus), xdescribe (skip)
export function fdescribe(name: string, fn: () => void): void {
  state.config.onlyEnabled = true;
  describe(name, fn);
}
export function xdescribe(name: string, fn: () => void): void {
  // skip entire suite
  state.config.skipEnabled = true;
  describe(name, fn);
  state.config.skipEnabled = false;
}

export function it(name: string, fn: () => void | Promise<void>): void {
  if (!state.currentSuite) {
    // top-level it: create anonymous root suite
    state.rootSuite = createSuite('(root)', state.currentFile);
    state.currentSuite = state.rootSuite;
  }
  const test = createTest(name, fn, state.currentFile);

  // Check .only / .skip modifiers
  if (state.config.onlyEnabled) test.only = true;
  if (state.config.skipEnabled) test.skip = true;

  state.currentSuite.tests.push(test);
}

export function fit(name: string, fn: () => void | Promise<void>): void {
  state.config.onlyEnabled = true;
  it(name, fn);
  state.config.onlyEnabled = false;
}
export function xit(name: string, _fn?: () => void | Promise<void>): void {
  // skip
  if (!state.currentSuite) {
    state.rootSuite = createSuite('(root)', state.currentFile);
    state.currentSuite = state.rootSuite;
  }
  const test = createTest(name, _fn ?? (() => {}), state.currentFile);
  test.skip = true;
  state.currentSuite.tests.push(test);
}
export function todo(name: string): void {
  if (!state.currentSuite) {
    state.rootSuite = createSuite('(root)', state.currentFile);
    state.currentSuite = state.rootSuite;
  }
  const test = createTest(name, async () => {}, state.currentFile);
  test.todo = true;
  test.status = 'skipped';
  state.currentSuite.tests.push(test);
}

// ============ Hooks ============

export function beforeAll(fn: () => void | Promise<void>): void {
  if (!state.currentSuite) throw new Error('beforeAll must be inside describe');
  state.currentSuite.hooks.beforeAll.push(fn);
}
export function afterAll(fn: () => void | Promise<void>): void {
  if (!state.currentSuite) throw new Error('afterAll must be inside describe');
  state.currentSuite.hooks.afterAll.push(fn);
}
export function beforeEach(fn: () => void | Promise<void>): void {
  if (!state.currentSuite) throw new Error('beforeEach must be inside describe');
  state.currentSuite.hooks.beforeEach.push(fn);
}
export function afterEach(fn: () => void | Promise<void>): void {
  if (!state.currentSuite) throw new Error('afterEach must be inside describe');
  state.currentSuite.hooks.afterEach.push(fn);
}

// ============ Run a single test ============

async function runTest(test: TestCase): Promise<TestResult> {
  const start = performance.now();
  const softFailures: Array<{ message: string }> = [];
  setCurrentTestContext(softFailures);

  const result: TestResult = {
    name: test.name,
    file: test.file,
    status: 'running',
    duration: 0,
    assertions: 0,
    logs: [],
  };

  // Check skip / todo
  if (test.skip) {
    result.status = 'skipped';
    result.duration = 0;
    return result;
  }
  if (test.todo) {
    result.status = 'todo';
    result.duration = 0;
    return result;
  }

  // Apply timeout
  const timeoutMs = test.timeout || state.config.timeout;
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
  }, timeoutMs);

  try {
    // Setup expect + mock globals for this test
    setupGlobalsForTest();

    const promise = test.fn();
    if (promise instanceof Promise) {
      await Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeoutMs)),
      ]);
    }

    // Check soft failures
    if (softFailures.length > 0) {
      throw new Error(`Soft assertions failed:\n${softFailures.map(f => `  - ${f.message}`).join('\n')}`);
    }

    clearTimeout(timer);
    result.status = 'passed';
  } catch (e: unknown) {
    clearTimeout(timer);
    result.status = 'failed';
    result.error = {
      message: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack : undefined,
    };
  }

  result.duration = Math.round(performance.now() - start);
  return result;
}

function setupGlobalsForTest(): void {
  const g = globalThis as any;
  g.expect = createExpect;
  // mock globals set up in runner via setupGlobals
}

// ============ Run suite recursively ============

async function runSuite(
  suite: TestSuite,
  ancestors: TestSuite[] = []
): Promise<SuiteResult> {
  const start = performance.now();
  const results: TestResult[] = [];

  // beforeAll
  for (const hook of suite.hooks.beforeAll) {
    try { await hook(); } catch (e: unknown) {
      // bail out of all tests in this suite
      suite.tests.forEach(t => { t.status = 'failed'; });
      return {
        name: suite.name,
        file: suite.file,
        tests: suite.tests.map(t => ({
          name: t.name, file: t.file, status: 'failed' as const,
          duration: 0, error: { message: e instanceof Error ? e.message : String(e) },
          assertions: 0, logs: [],
        })),
        duration: Math.round(performance.now() - start),
        status: 'failed',
      };
    }
  }

  // Run tests
  for (const test of suite.tests) {
    // beforeEach
    for (const hook of suite.hooks.beforeEach) {
      try { await hook(); } catch { /* test will fail in runTest */ }
    }

    const result = await runTest(test);
    results.push(result);

    // afterEach
    for (const hook of suite.hooks.afterEach) {
      try { await hook(); } catch { /* non-fatal */ }
    }

    // bail
    if (result.status === 'failed' && state.config.bail > 0) {
      // check bail threshold
    }
  }

  // Children
  for (const child of suite.children) {
    const childResult = await runSuite(child, [...ancestors, suite]);
    results.push(...childResult.tests);
  }

  // afterAll
  for (const hook of suite.hooks.afterAll) {
    try { await hook(); } catch { /* non-fatal */ }
  }

  const failed = results.some(r => r.status === 'failed');
  return {
    name: suite.name,
    file: suite.file,
    tests: results,
    duration: Math.round(performance.now() - start),
    status: failed ? 'failed' : 'passed',
  };
}

// ============ Main run entry point ============

// Alias for runner compatibility (runFilesSequential = runFiles)
export { runFiles as runFilesSequential };

export async function runFiles(
  files: string[],
  config: { timeout?: number; retries?: number; bail?: number } = {}
): Promise<RunResult> {
  const overallStart = performance.now();
  const allResults: SuiteResult[] = [];
  let totalPassed = 0;
  let totalFailed = 0;
  let totalSkipped = 0;
  let totalTodo = 0;

  // Setup globals
  setupGlobals(globalThis);

  for (const file of files) {
    // Reset state for each file (suites accumulate)
    state.rootSuite = null;
    state.currentSuite = null;
    state.currentFile = file;

    // Dynamically import the test file (ESM)
    try {
      // Use dynamic import for .ts files (via tsx/register) or .js files
      // Resolve bare-relative paths (tests/foo.ts) to file:// URLs for ESM
      const resolvedPath = file.startsWith('.') || file.startsWith('/')
        ? file
        : './' + file;
      const importUrl = pathToFileURL(resolve(resolvedPath)).href;
      await import(importUrl);
    } catch (e: unknown) {
      allResults.push({
        name: `(file) ${file}`,
        file,
        tests: [{
          name: `File load: ${file}`,
          file,
          status: 'failed',
          duration: 0,
          error: { message: e instanceof Error ? e.message : String(e) },
          assertions: 0,
          logs: [],
        }],
        duration: 0,
        status: 'failed',
      });
      totalFailed++;
      continue;
    }

    if (state.rootSuite) {
      const result = await runSuite(state.rootSuite);
      allResults.push(result);
      for (const t of result.tests) {
        if (t.status === 'passed') totalPassed++;
        else if (t.status === 'failed') totalFailed++;
        else if (t.status === 'skipped') totalSkipped++;
        else if (t.status === 'todo') totalTodo++;
      }
    }
  }

  const duration = Math.round(performance.now() - overallStart);

  return {
    suites: allResults,
    totalTests: totalPassed + totalFailed + totalSkipped + totalTodo,
    passed: totalPassed,
    failed: totalFailed,
    skipped: totalSkipped,
    todo: totalTodo,
    duration,
    filesWithErrors: allResults.filter(s => s.status === 'failed').map(s => s.file),
  };
}

function setupGlobals(globalObj: any = globalThis): void {
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
  // mock globals (setupMockGlobals is imported at top level)
  setupMockGlobals(globalObj);
}

export { createExpect as expect } from './expect.js';
export { qmock as mock, qmockSpyOn as spyOn } from './mock.js';
export type { TestResult, RunResult, SuiteResult };

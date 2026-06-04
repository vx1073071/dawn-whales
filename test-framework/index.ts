/**
 * QTest Framework - Main entry point
 * Q44: 测试框架自建
 *
 * Standalone lightweight test framework (no Vitest/Jest dependency).
 * Supports: describe/it/expect/mock, parallel execution, isolated environments.
 *
 * Usage (ESM import):
 *   import { describe, it, expect, qmock, qmockSpyOn, run } from 'qtest'
 *
 * Usage (CLI):
 *   npx tsx test-framework/cli.ts run "tests/[GLOB]/[FILE].test.ts"
 */

// Core
export { describe, it, fit, xit, fdescribe, xdescribe, todo } from './core.js';
export { beforeAll, afterAll, beforeEach, afterEach } from './core.js';

// Expect
export { expect, createExpect } from './expect.js';
export type { AsymmetricMatcher } from './types.js';

// Mock
export { qmock as mock, qmockSpyOn as spyOn } from './mock.js';
export { qmockClearAllMocks, qmockResetAllMocks, qmockRestoreAllMocks } from './mock.js';
export type { MockFunction } from './types.js';

// Runner
export { run } from './runner.js';
export { runParallel } from './parallel-runner.js';

// Isolation
export { createSandbox, runFileInSandbox } from './isolation.js';

// Types
export type {
  TestResult,
  TestSuite,
  TestCase,
  SuiteResult,
  RunResult,
  RunnerConfig,
  QTestConfig,
  MatcherResult,
  MockMetadata,
  MockCall,
} from './types.js';

// Version
export const version = '0.1.0';

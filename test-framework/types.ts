/**
 * TypeScript type definitions for QTest lightweight test framework
 * Q44: 测试框架自建 - 不依赖 Vitest/Jest
 */

// ============ Test Structure Types ============

export interface TestContext {
  name: string;
  file: string;
  concurrency: number;
}

export interface TestResult {
  name: string;
  file: string;
  status: 'passed' | 'failed' | 'skipped' | 'todo';
  duration: number;        // ms
  error?: TestError;
  assertions: number;
  logs: string[];
}

export interface TestSuite {
  name: string;
  file: string;
  tests: TestCase[];
  hooks: SuiteHooks;
  children: TestSuite[];
  parent?: TestSuite;
}

export interface TestCase {
  name: string;
  file: string;
  fn: () => void | Promise<void>;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
  result?: TestResult;
  timeout: number;
  retries: number;
  only: boolean;
  skip: boolean;
  todo: boolean;
}

export interface SuiteHooks {
  beforeAll: (() => void | Promise<void>)[];
  afterAll: (() => void | Promise<void>)[];
  beforeEach: (() => void | Promise<void>)[];
  afterEach: (() => void | Promise<void>)[];
}

// ============ Expect / Matcher Types ============

export type MatcherValue = unknown;

export interface MatcherResult {
  pass: boolean;
  message: () => string;
  actual?: unknown;
  expected?: unknown;
}

export interface AsymmetricMatcher {
  asymmetricMatch(value: unknown): boolean;
  toString(): string;
}

export interface ExpectConfig {
  promise?: 'rejects' | 'resolves';
  not: boolean;
  soft: boolean;        // soft assert: don't throw, collect failures
}

// ============ Mock Types ============

export interface MockMetadata {
  name: string;
  mockName: string;
  calls: MockCall[];
  instances: unknown[];
  invocationCallOrder: number[];
  results: MockResult[];
}

export interface MockCall {
  args: unknown[];
  timestamp: number;     // performance.now()
  returnValue?: unknown;
  thrownValue?: unknown;
  isThrow: boolean;
}

export interface MockResult {
  type: 'return' | 'throw' | 'incomplete';
  value?: unknown;
}

export interface MockFunction<T extends (...args: unknown[]) => unknown> {
  (...args: Parameters<T>): ReturnType<T>;
  mock: MockMetadata;
  mockName(n: string): MockFunction<T>;
  getMockName(): string;
  mockImplementation(fn: T): MockFunction<T>;
  mockImplementationOnce(fn: T): MockFunction<T>;
  mockReturnValue(val: ReturnType<T>): MockFunction<T>;
  mockReturnValueOnce(val: ReturnType<T>): MockFunction<T>;
  mockResolvedValue(val: ReturnType<T>): MockFunction<T>;
  mockResolvedValueOnce(val: Awaited<ReturnType<T>>): MockFunction<T>;
  mockRejectedValue(err: unknown): MockFunction<T>;
  mockRejectedValueOnce(err: unknown): MockFunction<T>;
  mockReturnThis(): MockFunction<T>;
  withImplementation(fn: T, cb: () => void): void;
  getMockImplementation(): T | undefined;
  // Restore (for jest.spyOn restore)
  mockRestore(): void;
  restoreMocks(): void;
}

export type SpyOn<T extends object, M extends keyof T> = 
  T[M] extends (...args: unknown[]) => unknown 
    ? MockFunction<T[M] & ((...args: unknown[]) => unknown)>
    : never;

// ============ Runner / Parallel Types ============

export interface RunnerConfig {
  concurrency: number;       // max parallel workers
  isolate: boolean;          // run each test file in isolated worker
  workerType: 'thread' | 'process' | 'same';
  timeout: number;           // global timeout ms
  retry: number;             // global retry count
  bail: number;              // stop after N failures (0 = don't bail)
  updateSnapshots: boolean;
  verbose: boolean;
  silent: boolean;
  coverage: boolean;
}

export interface WorkerMessage {
  type: 'start' | 'test-start' | 'test-end' | 'done' | 'error' | 'log';
  payload: unknown;
  workerId: number;
}

export interface RunResult {
  suites: SuiteResult[];
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  todo: number;
  duration: number;
  filesWithErrors: string[];
}

export interface SuiteResult {
  name: string;
  file: string;
  tests: TestResult[];
  duration: number;
  status: 'passed' | 'failed';
}

// ============ Isolation Types ============

export interface IsolationContext {
  id: string;
  type: 'vm' | 'worker' | 'child-process';
  sandbox: Sandbox;
}

export interface Sandbox {
  globals: Record<string, unknown>;
  moduleCache: Map<string, unknown>;
  envSnapshot: Record<string, string | undefined>;
}

// ============ Report Types ============

export interface TestReport {
  timestamp: string;
  config: RunnerConfig;
  summary: RunResult;
  files: FileReport[];
  duration: number;
}

export interface FileReport {
  file: string;
  suiteName: string;
  tests: TestResult[];
  duration: number;
  status: 'passed' | 'failed';
}

export type ReportFormat = 'text' | 'json' | 'html' | 'junit' | 'github-actions';

// ============ Snapshot Types ============

export interface Snapshot {
  [key: string]: string;  // testName -> snapshot content
}

export interface SnapshotFile {
  [key: string]: Snapshot;  // file -> snapshots
}

// ============ Config ============

export interface QTestConfig {
  include: string[];
  exclude: string[];
  runner: RunnerConfig;
  expect: {
    timeout: number;
    expand: boolean;
  };
  coverage?: {
    include: string[];
    exclude: string[];
    reporter: ('text' | 'html' | 'lcov')[];
  };
}

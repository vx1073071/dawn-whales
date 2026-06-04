/**
 * QTest Isolation - VM sandbox for test isolation (same-process mode)
 * Q44: 测试框架自建
 *
 * Uses Node.js vm module to create isolated contexts per test file.
 * Each file gets its own global snapshot + module cache.
 */

import vm, { createContext, runInContext } from 'node:vm';
import type { Context } from 'node:vm';
import type { IsolationContext, Sandbox } from './types.js';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

// ============ Snapshot env ============

function snapshotEnv(): Record<string, string | undefined> {
  const snap: Record<string, string | undefined> = {};
  for (const key in process.env) {
    snap[key] = process.env[key];
  }
  return snap;
}

function restoreEnv(snap: Record<string, string | undefined>): void {
  // Remove keys not in snap
  for (const key in process.env) {
    if (!(key in snap)) delete process.env[key];
  }
  // Restore
  for (const [key, val] of Object.entries(snap)) {
    if (val === undefined) delete process.env[key];
    else process.env[key] = val;
  }
}

// ============ VM Sandbox ============

export function createSandbox(file: string): Sandbox {
  // Create a fresh VM context
  const context = createContext({
    console: Object.create(console, {
      // Capture logs per-test
      _testLogs: { value: [], writable: true },
      log: { value: (...args: unknown[]) => { (console as any)._testLogs.push(args); } },
    } as any),
    setTimeout,
    setInterval,
    clearTimeout,
    clearInterval,
    Date,
    Math,
    JSON,
    Object,
    Array,
    Map,
    Set,
    // Globals the test framework provides
    describe: (globalThis as any).describe,
    it: (globalThis as any).it,
    expect: (globalThis as any).expect,
    qmock: (globalThis as any).qmock,
    qmockSpyOn: (globalThis as any).qmockSpyOn,
    beforeAll: (globalThis as any).beforeAll,
    afterAll: (globalThis as any).afterAll,
    beforeEach: (globalThis as any).beforeEach,
    afterEach: (globalThis as any).afterEach,
    // Process (careful!)
    process: {
      env: { ...process.env },
      version: process.version,
      platform: process.platform,
      arch: process.arch,
    },
  } as any) as vm.Context;

  return {
    globals: context as any,
    moduleCache: new Map(),
    envSnapshot: snapshotEnv(),
  };
}

export function runInSandbox(sandbox: Sandbox, code: string): unknown {
  const ScriptClass = vm.Script as any;
  const script = new ScriptClass(code, { filename: 'test.vm' });
  return runInContext(script, sandbox.globals as Context);
}

// ============ Full isolation: run a test file in its own VM ============

export async function runFileInSandbox(
  file: string,
  globals: Record<string, unknown>
): Promise<{ results: any[]; logs: string[] }> {
  const sandbox = createSandbox(file);
  const code = readFileSync(file, 'utf-8');

  // Inject test framework globals into sandbox
  for (const [key, val] of Object.entries(globals)) {
    (sandbox.globals as any)[key] = val;
  }

  // Run the file in sandbox
  try {
    runInSandbox(sandbox, code);
  } catch (e: unknown) {
    return {
      results: [{ status: 'failed', error: e instanceof Error ? e.message : String(e) }],
      logs: [],
    };
  }

  return {
    results: [{ status: 'passed' }],
    logs: (sandbox.globals as any).console?._testLogs || [],
  };
}

// ============ Worker-thread isolation (preferred for true isolation) ============

/**
 * For true isolation, use worker_threads (parallel-runner.ts).
 * VM sandbox is a same-process fallback when worker_threads unavailable.
 */

export { snapshotEnv, restoreEnv };

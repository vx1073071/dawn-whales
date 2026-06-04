/**
 * QTest Parallel Runner - run tests in parallel using worker_threads
 * Q44: 测试框架自建
 *
 * Uses Node.js worker_threads for true parallelism with isolated contexts.
 * Each test file gets its own worker (configurable concurrency).
 */

import { Worker, isMainThread, workerData, parentPort } from 'node:worker_threads';
import { join } from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import type { RunnerConfig, RunResult, SuiteResult, TestResult } from './types.js';

// ============ Worker script (runs inside worker_thread) ============

function runWorkerThread() {
  const { file, config } = workerData as { file: string; config: RunnerConfig };

  async function run() {
    const { setupGlobals } = await import(join(import.meta.dirname, 'core.js'));
    const { runSuite } = await import(join(import.meta.dirname, 'runner.js'));

    setupGlobals(globalThis);

    // Import test file
    await import(file);

    // Collect results...
    const results: TestResult[] = [];
    const duration = 0;

    parentPort!.postMessage({
      type: 'done',
      payload: { file, results, duration },
    });
  }

  run().catch(err => {
    parentPort!.postMessage({
      type: 'error',
      payload: { file, error: err.message },
    });
  });
}

if (!isMainThread && workerData) {
  runWorkerThread();
}

// ============ Main thread: schedule workers ============

export async function runParallel(
  files: string[],
  config: RunnerConfig
): Promise<RunResult> {
  const concurrency = config.concurrency || 4;
  const startTime = performance.now();

  let totalPassed = 0;
  let totalFailed = 0;
  let totalSkipped = 0;
  let totalTodo = 0;
  const suites: SuiteResult[] = [];
  const filesWithErrors: string[] = [];

  // Process files with a concurrency pool
  const queue = [...files];
  let active = 0;
  let done = 0;
  const results: RunResult | null = null;

  await new Promise<void>((resolve, reject) => {
    const workers: Worker[] = [];

    function startNext() {
      if (queue.length === 0 && active === 0) {
        resolve();
        return;
      }
      while (queue.length > 0 && active < concurrency) {
        const file = queue.shift()!;
        active++;

        const worker = new Worker(new URL(import.meta.url), {
          workerData: { file, config },
        });
        workers.push(worker);

        worker.on('message', (msg: any) => {
          if (msg.type === 'done') {
            suites.push(msg.payload);
            active--;
            startNext();
          } else if (msg.type === 'error') {
            suites.push({
              name: `(file) ${file}`,
              file,
              tests: [],
              duration: 0,
              status: 'failed',
            });
            filesWithErrors.push(file);
            active--;
            startNext();
          }
        });

        worker.on('error', (err) => {
          console.error(`Worker error for ${file}:`, err);
          active--;
          startNext();
        });

        worker.on('exit', (code) => {
          if (code !== 0) {
            active--;
            startNext();
          }
        });
      }
    }

    startNext();
  });

  // Fallback: run sequentially if worker approach has issues
  // (we'll implement a robust sequential fallback in runner.ts)

  const duration = Math.round(performance.now() - startTime);
  return {
    suites,
    totalTests: totalPassed + totalFailed + totalSkipped + totalTodo,
    passed: totalPassed,
    failed: totalFailed,
    skipped: totalSkipped,
    todo: totalTodo,
    duration,
    filesWithErrors,
  };
}

export { runParallel as default };

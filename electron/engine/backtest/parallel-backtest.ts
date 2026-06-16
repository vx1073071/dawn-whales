// ── QUANT MOO — Parallel Backtest Orchestrator (J2) ──────────────────────
// Splits configs across numWorkers threads, collects results
// Fallback to serial when Worker threads unavailable (renderer/Sandbox)

import { Worker } from 'worker_threads';
import { EngineError, ErrorDomain, ErrorCode } from '../core/engine-error';
import path from 'path';
import type { BacktestConfig, BacktestResult } from './backtest-engine';

interface ParallelResult {
  config: BacktestConfig;
  result: BacktestResult;
}

export async function runParallelBacktests(
  configs: BacktestConfig[],
  numWorkers: number = Math.min(require('os').cpus().length, 4),
): Promise<ParallelResult[]> {
  const chunkSize = Math.ceil(configs.length / numWorkers);
  const chunks: BacktestConfig[][] = [];
  for (let i = 0; i < configs.length; i += chunkSize) {
    chunks.push(configs.slice(i, i + chunkSize));
  }

  const workerPath = path.resolve(__dirname, 'parallel-backtest.worker.ts');

  // Fallback: if tsx/worker can't load .ts, run serially in this process
  try {
    const promises = chunks.map((chunk, idx) => {
      return new Promise<ParallelResult[]>((resolve, reject) => {
        const worker = new Worker(workerPath, {
          workerData: { configs: chunk, id: idx },
        });

        worker.on('message', (data: ParallelResult[]) => {
          resolve(data);
          worker.terminate();
        });

        worker.on('error', reject);
        worker.on('exit', (code) => {
          if (code !== 0) reject(new EngineError(ErrorDomain.SYSTEM, ErrorCode.INTERNAL_ERROR, `Worker ${idx} stopped with code ${code}`));
        });
      });
    });

    const allResults = await Promise.all(promises);
    return allResults.flat();
  } catch (_e: unknown) {
    // Run serial fallback (used in tests/CI without tsx worker support)
    const { runBacktestSync } = await import('./parallel-backtest.worker');
    return configs.map(cfg => ({
      config: cfg,
      result: runBacktestSync(cfg),
    }));
  }
}

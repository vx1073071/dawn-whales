// ── Parallel Backtest Worker (Web Worker) ──────────────────────────────────
// 在独立线程中运行回测，不阻塞主进程
// Target: 10策略 × 5000 bars 并行 < 3s

import { BacktestEngine } from './backtest-engine';
import type { BacktestConfig, BacktestResult } from './backtest-engine';

export interface WorkerRequest {
  type: 'backtest';
  id: string;
  config: BacktestConfig;
}

export interface WorkerResponse {
  type: 'result';
  id: string;
  result: BacktestResult | null;
  error?: string;
  perfMs?: number;
}

// J4: strict mode — use DedicatedWorkerGlobalScope typing
declare const self: DedicatedWorkerGlobalScope;

// Worker message handler
self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const { id, config } = e.data;
  
  try {
    const t0 = performance.now();
    const engine = new BacktestEngine();
    const result = await engine.run(config);
    const perfMs = performance.now() - t0;
    
    const response: WorkerResponse = {
      type: 'result',
      id,
      result,
      perfMs,
    };
    
    self.postMessage(response);
  } catch (error: unknown) {
    const response: WorkerResponse = {
      type: 'result',
      id,
      result: null,
      error: (error as Error).message,
    };
    
    self.postMessage(response);
  }
};

// Export for type checking
export {};

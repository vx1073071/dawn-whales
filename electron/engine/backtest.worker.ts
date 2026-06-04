// ── Parallel Backtest Worker (Web Worker) ──────────────────────────────────
// 在独立线程中运行回测，不阻塞主进程
// Target: 10策略 × 5000 bars 并行 < 3s

import { BacktestEngine } from './backtest-engine';

export interface WorkerRequest {
  type: 'backtest';
  id: string;
  config: any;
}

export interface WorkerResponse {
  type: 'result';
  id: string;
  result: any;
  error?: string;
  perfMs?: number;
}

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
    
    (self as any).postMessage(response);
  } catch (error: any) {
    const response: WorkerResponse = {
      type: 'result',
      id,
      result: null,
      error: error.message,
    };
    
    (self as any).postMessage(response);
  }
};

// Export for type checking
export {};

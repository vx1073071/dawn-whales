// ── DAWN WHALES — WorkerPool Benchmark ──────────────────────────────────────
// T50: Performance benchmark for multithreaded computation

import { WorkerPool } from './worker-pool';
import log from 'electron-log';

async function bench(label: string, fn: () => Promise<any>, iterations = 5) {
  const times: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await fn();
    times.push(performance.now() - start);
  }
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const min = Math.min(...times);
  const max = Math.max(...times);
  log.info(`${label}: avg=${avg.toFixed(1)}ms min=${min.toFixed(1)}ms max=${max.toFixed(1)}ms (${iterations} runs)`);
  return { avg, min, max, times };
}

async function main() {
  log.info('=== WorkerPool Benchmark ===\n');
  const pool = new WorkerPool(4);
  
  // Benchmark 1: Fibonacci CPU load
  await bench('fib(40) x 10 (4 workers)', async () => {
    const tasks = Array.from({ length: 10 }, (_, i) => 
      pool.execute('workers/bench-worker', { type: 'fib', n: 40, id: i })
    );
    await Promise.all(tasks);
  });

  // Benchmark 2: Matrix multiplication
  await bench('matrix(200x200) x 5 (4 workers)', async () => {
    const tasks = Array.from({ length: 5 }, (_, i) =>
      pool.execute('workers/bench-worker', { type: 'matrix', size: 200, id: i })
    );
    await Promise.all(tasks);
  });

  // Benchmark 3: Serial vs Parallel comparison
  log.info('\n--- Serial vs Parallel ---');
  const fib = (n: number): number => n <= 1 ? n : fib(n-1) + fib(n-2);
  await bench('fib(40) x 4 SERIAL', async () => {
    for (let i = 0; i < 4; i++) fib(40);
  });
  
  await bench('fib(40) x 4 PARALLEL', async () => {
    const tasks = Array.from({ length: 4 }, (_, i) =>
      pool.execute('workers/bench-worker', { type: 'fib', n: 40, id: i })
    );
    await Promise.all(tasks);
  });

  log.info(`\nPool stats: ${JSON.stringify(pool.stats)}`);
  await pool.terminate();
}

main().catch((err) => { log.error('Benchmark failed:', err); process.exit(1); });

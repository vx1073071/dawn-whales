// ── DAWN WHALES Multi-Broker Concurrency ──────────────────────────────
// R133-P02: Concurrent order execution across brokers with timeout

import { logAuditError } from './audit-logger';

interface OrderTask<T> {
  brokerId: string;
  execute: () => Promise<T>;
  timeout?: number;
}

interface OrderResult<T> {
  brokerId: string;
  success: boolean;
  result?: T;
  error?: string;
  duration: number;
}

const DEFAULT_TIMEOUT = 10000; // 10s per broker

export async function executeConcurrentOrders<T>(
  tasks: OrderTask<T>[],
  options: { timeout?: number; failFast?: boolean } = {},
): Promise<OrderResult<T>[]> {
  const start = Date.now();
  const timeout = options.timeout || DEFAULT_TIMEOUT;

  const results = await Promise.allSettled(
    tasks.map(async (task): Promise<OrderResult<T>> => {
      const taskStart = Date.now();
      try {
        const result = await Promise.race([
          task.execute(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`Timeout after ${timeout}ms`)), timeout),
          ),
        ]);
        return {
          brokerId: task.brokerId,
          success: true,
          result,
          duration: Date.now() - taskStart,
        };
      } catch (err) {
        logAuditError('Broker order failed in concurrent batch', {
          brokerId: task.brokerId,
          error: err instanceof Error ? err.message : String(err),
        });
        return {
          brokerId: task.brokerId,
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error',
          duration: Date.now() - taskStart,
        };
      }
    }),
  );

  if (options.failFast) {
    const firstFailure = results.find(r => r.status === 'rejected' || !(r.status === 'fulfilled' && (r.value as OrderResult<T>).success));
    if (firstFailure) {
      logAuditError('Concurrent orders: failFast triggered', {
        totalBrokers: tasks.length,
        duration: Date.now() - start,
      });
    }
  }

  return results
    .filter((r): r is PromiseFulfilledResult<OrderResult<T>> => r.status === 'fulfilled')
    .map(r => r.value);
}

// Batch signal execution across multiple copiers with different brokers
interface CopyTask {
  userId: string;
  brokerId: string;
  brokerType: 'cloud' | 'opend';
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price?: number;
}

export async function executeCopyTradeBatch(
  copies: CopyTask[],
  executeForBroker: (task: CopyTask) => Promise<{ orderId: string; fee: number }>,
): Promise<OrderResult<{ orderId: string; fee: number }>[]> {
  const tasks: OrderTask<{ orderId: string; fee: number }>[] = copies.map(copy => ({
    brokerId: copy.brokerId,
    timeout: copy.brokerType === 'cloud' ? 10000 : 30000, // OpenD gets longer timeout
    execute: () => executeForBroker(copy),
  }));

  const results = await executeConcurrentOrders(tasks, { failFast: false });

  const succeeded = results.filter(r => r.success).length;
  console.log(`[CopyTrade] Batch: ${succeeded}/${copies.length} orders executed in ${results.reduce((sum, r) => sum + r.duration, 0)}ms total`);

  return results;
}

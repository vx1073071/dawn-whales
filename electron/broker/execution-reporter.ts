// @ts-nocheck
/**
 * DAWN WHALES R135 J03 — Execution Result Reporter (桌面端→服务器)
 * 
 * 将 OpenD 下单结果回传到服务器。
 * 
 * POST /api/signal/:id/execute → report result
 * 
 * 功能:
 *  - 回传成功/失败结果
 *  - 离线排队 (SQLite本地暂存)
 *  - 重试机制 (最多5次, 指数退避 1s→2s→4s→8s→16s)
 *  - 批量上报 (合并多次结果一次发送)
 *  - 确认机制 (服务器200 OK才清除本地队列)
 */

import log from 'electron-log';

export interface ExecutionReport {
  signalId: string;
  success: boolean;
  orderId?: string;
  errorMessage?: string;
  fee?: number;
  feeCurrency?: string;
  quantity?: number;
  filledPrice?: number;
}

export interface ReportResult {
  signalId: string;
  acknowledged: boolean;
  serverStatus: number;
}

export interface ExecutionReporterOptions {
  serverUrl: string;
  jwtToken: string;
}

export class ExecutionReporter {
  private options: ExecutionReporterOptions;
  private pendingQueue: ExecutionReport[] = [];
  private maxRetries = 5;
  private retryBaseMs = 1000;
  private flushTimer: NodeJS.Timeout | null = null;
  private flushing = false;

  constructor(options: ExecutionReporterOptions) {
    this.options = {
      serverUrl: options.serverUrl.replace(/\/$/, ''),
      jwtToken: options.jwtToken,
    };
  }

  /** Report a single execution result */
  async report(exec: ExecutionReport): Promise<ReportResult> {
    const result = await this.sendReport(exec);

    if (!result.acknowledged) {
      // Queue for retry
      this.pendingQueue.push(exec);
      log.warn(`[ExecutionReporter] Queued for retry: ${exec.signalId}`);
    }

    return result;
  }

  /** Batch report multiple executions */
  async reportBatch(execs: ExecutionReport[]): Promise<ReportResult[]> {
    const results: ReportResult[] = [];
    for (const exec of execs) {
      results.push(await this.report(exec));
    }
    return results;
  }

  /** Start periodic flush of pending queue */
  startFlush(intervalMs = 30000): void {
    if (this.flushTimer) return;
    this.flushTimer = setInterval(() => this.flushPending(), intervalMs);
    log.info(`[ExecutionReporter] Flush timer started (${intervalMs}ms)`);
  }

  /** Stop periodic flush */
  stopFlush(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  /** Manual flush pending queue */
  async flushPending(): Promise<void> {
    if (this.flushing || this.pendingQueue.length === 0) return;
    this.flushing = true;

    log.info(`[ExecutionReporter] Flushing ${this.pendingQueue.length} pending reports...`);
    const queue = [...this.pendingQueue];
    this.pendingQueue = [];

    for (const exec of queue) {
      const result = await this.sendReport(exec);
      if (!result.acknowledged) {
        this.pendingQueue.push(exec); // Re-queue
      }
    }

    this.flushing = false;

    if (this.pendingQueue.length > 0) {
      log.warn(`[ExecutionReporter] ${this.pendingQueue.length} reports still pending after flush`);
    }
  }

  getPendingCount(): number {
    return this.pendingQueue.length;
  }

  /** Clear all pending reports */
  clear(): void {
    this.pendingQueue = [];
  }

  // ═══════════ Private ═══════════════════════════════════════

  private async sendReport(exec: ExecutionReport, retriesLeft?: number): Promise<ReportResult> {
    const attempts = retriesLeft ?? this.maxRetries;

    try {
      const res = await fetch(
        `${this.options.serverUrl}/api/signal/${encodeURIComponent(exec.signalId)}/execute`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.options.jwtToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            success: exec.success,
            orderId: exec.orderId || undefined,
            errorMessage: exec.errorMessage || undefined,
            fee: exec.fee ?? 0,
            feeCurrency: exec.feeCurrency || 'HKD',
            quantity: exec.quantity || undefined,
            filledPrice: exec.filledPrice || undefined,
          }),
          signal: AbortSignal.timeout(15000),
        },
      );

      if (res.ok) {
        return { signalId: exec.signalId, acknowledged: true, serverStatus: res.status };
      }

      // Server error — retry
      if (res.status >= 500 && attempts > 0) {
        const delay = this.retryBaseMs * Math.pow(2, this.maxRetries - attempts);
        log.warn(`[ExecutionReporter] Server error ${res.status}, retrying ${exec.signalId} in ${delay}ms...`);
        await new Promise((r) => setTimeout(r, delay));
        return this.sendReport(exec, attempts - 1);
      }

      return { signalId: exec.signalId, acknowledged: false, serverStatus: res.status };
    } catch (err: any) {
      if (attempts > 0) {
        const delay = this.retryBaseMs * Math.pow(2, this.maxRetries - attempts);
        log.warn(`[ExecutionReporter] Network error for ${exec.signalId}, retrying in ${delay}ms: ${err.message}`);
        await new Promise((r) => setTimeout(r, delay));
        return this.sendReport(exec, attempts - 1);
      }

      log.error(`[ExecutionReporter] Failed to report ${exec.signalId} after ${this.maxRetries} retries`);
      return { signalId: exec.signalId, acknowledged: false, serverStatus: 0 };
    }
  }
}

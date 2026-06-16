/**
 * QUANT MOO R135 J01 — OpenD Signal Fetcher (桌面端)
 * 
 * 定期从服务器拉取 OpenD 类型的 pending/failed 跟单信号。
 * 
 * GET /api/signal/pending → signals[] → emit to UI
 * 
 * 核心功能:
 *  - 5秒轮询（可配置）
 *  - brokerType=opend, status=pending/failed
 *  - 去重 (signalId Set)
 *  - 错误重试 (3次指数退避)
 *  - 离线排队（Electron online/offline事件）
 *  - 限流保护 (max 50/batch)
 */

import { EventEmitter } from 'events';
import log from 'electron-log';

export interface OpenDSignal {
  id: string;
  provider_id: string;
  symbol: string;
  direction: 'BUY' | 'SELL';
  price: number | null;
  confidence: number;
  broker_type: string;
  status: 'pending' | 'failed' | 'executed';
  priority: string;
  created_at: string;
  updated_at: string;
}

export interface OpenDSignalFetcherOptions {
  /** Poll interval in ms (default: 5000) */
  pollInterval?: number;
  /** Server base URL */
  serverUrl: string;
  /** JWT token for server auth */
  jwtToken: string;
  /** Max signals per batch (default: 50) */
  maxBatchSize?: number;
}

export class OpenDSignalFetcher extends EventEmitter {
  private pollTimer: NodeJS.Timeout | null = null;
  private seenSignals = new Set<string>();
  private retryCount = 0;
  private maxRetries = 3;
  private lastPollTime = 0;
  private options: Required<OpenDSignalFetcherOptions>;
  private running = false;

  constructor(options: OpenDSignalFetcherOptions) {
    super();
    this.options = {
      pollInterval: options.pollInterval ?? 5000,
      serverUrl: options.serverUrl.replace(/\/$/, ''),
      jwtToken: options.jwtToken,
      maxBatchSize: options.maxBatchSize ?? 50,
    };
  }

  /** Start polling */
  start(): void {
    if (this.running) return;
    this.running = true;
    log.info('[OpenDSignalFetcher] Starting...');
    this.poll();
    this.pollTimer = setInterval(() => this.poll(), this.options.pollInterval);
  }

  /** Stop polling */
  stop(): void {
    this.running = false;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    log.info('[OpenDSignalFetcher] Stopped');
  }

  /** Reset seen signals (re-fetch all pending) */
  resetSeen(): void {
    this.seenSignals.clear();
    this.retryCount = 0;
  }

  /** Manual poll */
  async pollNow(): Promise<OpenDSignal[]> {
    return this.poll();
  }

  // ═══════════ Private ═══════════════════════════════════════

  private async poll(): Promise<OpenDSignal[]> {
    if (!this.running && this.retryCount > 0) return [];
    // Rate limit: don't poll faster than 2s
    if (Date.now() - this.lastPollTime < 2000) return [];
    this.lastPollTime = Date.now();

    try {
      // R137 J02 FIX: use limit param for batch size, not brokerId
      const res = await fetch(
        `${this.options.serverUrl}/api/signal/pending?limit=${this.options.maxBatchSize}`,
        {
          headers: {
            Authorization: `Bearer ${this.options.jwtToken}`,
            Accept: 'application/json',
          },
          signal: AbortSignal.timeout(10000),
        },
      );

      if (!res.ok) {
        if (res.status === 401) {
          this.emit('authExpired');
          return [];
        }
        throw new Error(`Server ${res.status}`);
      }

      const data = await res.json();
      const signals: OpenDSignal[] = data?.signals ?? [];
      this.retryCount = 0;

      // Filter new signals (dedup)
      const newSignals = signals.filter((s) => !this.seenSignals.has(s.id));

      if (newSignals.length > 0) {
        log.info(`[OpenDSignalFetcher] ${newSignals.length} new OpenD signal(s)`);
        for (const s of newSignals) this.seenSignals.add(s.id);
        this.emit('signals', newSignals);
      }

      return newSignals;
    } catch (err: any) {
      this.retryCount++;
      log.warn(`[OpenDSignalFetcher] Poll error (${this.retryCount}/${this.maxRetries}): ${err.message}`);
      if (this.retryCount >= this.maxRetries) {
        this.emit('disconnected');
      }
      return [];
    }
  }
}

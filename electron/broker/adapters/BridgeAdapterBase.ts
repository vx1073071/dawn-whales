// — R119 QClaw: structural type errors pending resolution by JVS/PM (fixed in R231)
// ── QUANT MOO — BridgeAdapter Base ─────────────────────────────────────
// R1 INF-06: 本地网关型券商适配器基类 (Tiger OpenD / VBKR / uSMART)
// 复用 poll/complete job queue 模式 (参考 futu-opend + cloud端架构)
// 子类实现: _enqueueJob, _pollJobStatus, _parseJobResponse

import { EventEmitter } from 'events';
import log from 'electron-log';
import type { BrokerConfig, QuoteInfo, KlineInfo, AccountInfo, FundsInfo, PositionInfo, OrderInfo, PlaceOrderRequest } from '../IBrokerAdapter';
import type { IBrokerAdapterV2, BrokerType, BrokerConnectionStatus, MarketType } from '../IBrokerAdapterV2';

export interface BridgeAdapterConfig extends BrokerConfig {
  // Bridge连接信息
  bridgeHost?: string;           // default: localhost
  bridgePort?: number;           // e.g. Tiger OpenD: 40111
  bridgeToken?: string;          // pre-shared token
  // Job Queue配置
  pollIntervalMs?: number;       // default: 1000
  jobTimeoutMs?: number;         // default: 30000
  maxRetries?: number;           // default: 3
}

export interface BridgeJob {
  jobId: string;
  type: 'QUOTE' | 'KLINE' | 'ACCOUNT' | 'FUNDS' | 'POSITIONS' | 'ORDERS' | 'PLACE_ORDER' | 'CANCEL_ORDER' | 'SUBSCRIBE' | 'TRADING_PAIRS';
  status: 'enqueued' | 'processing' | 'completed' | 'failed';
  request: any;
  response?: any;
  error?: string;
  createdAt: number;
  completedAt?: number;
}

type JobCallback = (job: BridgeJob) => void;

export abstract class BridgeAdapterBase extends EventEmitter implements IBrokerAdapterV2 {
  public readonly id: string;
  public readonly type: string;
  public readonly name: string;
  public connected = false;

  protected config: BridgeAdapterConfig;
  protected jobs = new Map<string, BridgeJob>();
  protected jobCallbacks = new Map<string, JobCallback>();
  protected pollTimer: ReturnType<typeof setInterval> | null = null;
  protected quotePushCallbacks: Array<(quotes: QuoteInfo[]) => void> = [];
  protected disconnectCallbacks: Array<() => void> = [];
  protected jobIdCounter = 0;

  constructor(config: BridgeAdapterConfig) {
    super();
    this.config = config;
    this.id = config.id;
    this.type = config.type;
    this.name = config.name;
  }

  // ═══ Abstract Methods (子类实现) ═══════════════════════
  /** 将job提交到本地网关 */
  protected abstract _enqueueJob(job: BridgeJob): Promise<string>;
  /** 轮询job状态 */
  protected abstract _pollJobStatus(jobId: string): Promise<Partial<BridgeJob>>;
  /** 解析job响应为具体数据类型 */
  protected abstract _parseJobResponse<T>(type: string, response: any): T;
  /** 订阅推送注册(启动push stream) */
  protected abstract _registerPushStream(): Promise<void>;

  // ═══ Connection Lifecycle ══════════════════════════════
  async connect(): Promise<void> {
    try {
      await this._enqueueJob({
        jobId: `connect-${Date.now()}`,
        type: 'ACCOUNT',
        status: 'enqueued',
        request: { action: 'health_check' },
        createdAt: Date.now(),
      });
      this.connected = true;
      this._startPolling();
      await this._registerPushStream();
      log.info(`[${this.name}] Bridge connected (${this.config.bridgeHost}:${this.config.bridgePort})`);
    } catch (err: any) {
      log.error(`[${this.name}] Bridge connection failed: ${err.message}`);
      throw err;
    }
  }

  disconnect(): void {
    this.connected = false;
    this._stopPolling();
    this.jobs.clear();
    this.jobCallbacks.clear();
    this.disconnectCallbacks.forEach(cb => cb());
    log.info(`[${this.name}] Bridge disconnected`);
  }

  // ═══ Job Queue ══════════════════════════════════════════
  protected async _submitJob<T>(type: BridgeJob['type'], request: any): Promise<T> {
    return new Promise<T>(async (resolve, reject) => {
      const jobId = `${type}-${++this.jobIdCounter}-${Date.now()}`;
      const job: BridgeJob = {
        jobId,
        type,
        status: 'enqueued',
        request,
        createdAt: Date.now(),
      };
      this.jobs.set(jobId, job);
      this.jobCallbacks.set(jobId, (completed: BridgeJob) => {
        if (completed.status === 'completed') {
          const result = this._parseJobResponse<T>(type, completed.response);
          this.jobs.delete(jobId);
          this.jobCallbacks.delete(jobId);
          resolve(result);
        } else {
          const err = new Error(completed.error || 'Job failed');
          this.jobs.delete(jobId);
          this.jobCallbacks.delete(jobId);
          reject(err);
        }
      });

      try {
        await this._enqueueJob(job);
      } catch (err: any) {
        this.jobs.delete(jobId);
        this.jobCallbacks.delete(jobId);
        reject(err);
      }

      // Timeout guard
      setTimeout(() => {
        if (this.jobs.has(jobId)) {
          this.jobs.delete(jobId);
          this.jobCallbacks.delete(jobId);
          reject(new Error(`Job ${jobId} timed out after ${this.config.jobTimeoutMs}ms`));
        }
      }, this.config.jobTimeoutMs || 30000);
    });
  }

  protected _startPolling(): void {
    this._stopPolling();
    this.pollTimer = setInterval(async () => {
      const jobIds = Array.from(this.jobs.keys());
      for (const jobId of jobIds) {
        try {
          const update = await this._pollJobStatus(jobId);
          const job = this.jobs.get(jobId);
          if (job && update.status) {
            job.status = update.status;
            if (update.response) job.response = update.response;
            if (update.error) job.error = update.error;
            if (update.status === 'completed' || update.status === 'failed') {
              job.completedAt = Date.now();
              const cb = this.jobCallbacks.get(jobId);
              if (cb) cb(job);
            }
          }
        } catch {
          // Single job poll failure shouldn't crash the loop
        }
      }
    }, this.config.pollIntervalMs || 1000);
  }

  protected _stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  // ═══ IBrokerAdapter Implementation ═══════════════════
  async getQuotes(codes: string[]): Promise<QuoteInfo[]> {
    return this._submitJob<QuoteInfo[]>('QUOTE', { codes });
  }

  async getKlines(code: string, period: string, count: number): Promise<KlineInfo[]> {
    return this._submitJob<KlineInfo[]>('KLINE', { code, period, count });
  }

  async getAccounts(): Promise<AccountInfo[]> {
    return this._submitJob<AccountInfo[]>('ACCOUNT', {});
  }

  async getFunds(accountId: string): Promise<FundsInfo> {
    return this._submitJob<FundsInfo>('FUNDS', { accountId });
  }

  async getPositions(accountId: string): Promise<PositionInfo[]> {
    return this._submitJob<PositionInfo[]>('POSITIONS', { accountId });
  }

  async getOrders(accountId: string): Promise<OrderInfo[]> {
    return this._submitJob<OrderInfo[]>('ORDERS', { accountId });
  }

  async placeOrder(order: PlaceOrderRequest): Promise<{ orderId: string }> {
    return this._submitJob<{ orderId: string }>('PLACE_ORDER', order);
  }

  async cancelOrder(orderId: string, accountId: string, code: string): Promise<void> {
    return this._submitJob<void>('CANCEL_ORDER', { orderId, accountId, code });
  }

  async subscribeAndPush(codes: string[]): Promise<void> {
    return this._submitJob<void>('SUBSCRIBE', { codes });
  }

  onQuotePush(callback: (quotes: QuoteInfo[]) => void): void {
    this.quotePushCallbacks.push(callback);
  }

  removeQuotePush(callback: (quotes: QuoteInfo[]) => void): void {
    this.quotePushCallbacks = this.quotePushCallbacks.filter(c => c !== callback);
  }

  onDisconnect(callback: () => void): void {
    this.disconnectCallbacks.push(callback);
  }

  // ═══ V2 Extensions ═════════════════════════════════════
  getMarkets(): MarketType[] { return ['HK', 'US', 'SG']; }
  getSupportedOrderTypes(): Array<'MARKET' | 'LIMIT' | 'STOP' | 'STOP_LIMIT' | 'TRAILING_STOP' | 'OCO'> {
    return ['MARKET', 'LIMIT', 'STOP', 'STOP_LIMIT'];
  }
  requiresLocalGateway(): boolean { return true; }
  getBrokerType(): BrokerType { return this.config.type as BrokerType; }
  getToken(): string { return this.config.bridgeToken || ''; }

  getConnectionStatus(): BrokerConnectionStatus {
    return {
      brokerId: this.id,
      brokerName: this.name,
      brokerType: this.config.type as BrokerType,
      connected: this.connected,
      connectedAt: this.connected ? Date.now() : undefined,
      subscriptionsCount: 0,
    };
  }

  async ping(): Promise<{ latency: number; timestamp: number }> {
    const t0 = Date.now();
    await this._submitJob('ACCOUNT', { action: 'ping' });
    return { latency: Date.now() - t0, timestamp: Date.now() };
  }
}

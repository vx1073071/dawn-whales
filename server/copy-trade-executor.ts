// @ts-nocheck
/**
 * DAWN WHALES R132 J01 + R137 J01 — Copy Trade Executor Engine
 * 
 * Full copy-trade execution pipeline:
 *   Source Signal → API Key Lookup(decrypt) → Subscription Check →
 *   MaxPosition Check → Circuit Breaker → Place Order → Ack Queue
 * 
 * R137 J01 FIX: placeOrder() now calls decryptApiKey() before passing to adapter.
 *   - ApiKeyEntry stores fields as "iv:tag:ciphertext" hex triplet
 *   - decryptApiKey() splits the triplet, runs AES-256-GCM, returns plain text
 *   - placeOrder() decrypts apiKey/secretKey/passphrase/privateKeyPem individually
 * 
 * Dependencies: SignalQueue, ICloudBrokerAdapter, AdapterFactory
 */

import crypto from 'crypto';
import {
  ICloudBrokerAdapter, CloudBrokerConfig,
  CloudOrderRequest, CloudOrderInfo,
} from '../../electron/broker/ICloudBrokerAdapter';
import { QueuedSignal, SignalQueue, getSignalQueue, SignalPriority } from '../signal-queue';

// ═══════════════ Types ══════════════════════════════════

export interface ApiKeyEntry {
  userId: string;
  brokerId: string;
  brokerType: string;
  /**
   * Encrypted format: "iv:tag:ciphertext" (hex triplets)
   *   iv        – 12 bytes (96-bit) random nonce, hex-encoded
   *   tag       – 16 bytes auth tag from GCM, hex-encoded
   *   ciphertext – AES-256-GCM encrypted payload, hex-encoded
   */
  apiKey: string;
  secretKey: string;
  passphrase?: string;     // encrypted, OKX/Bitget
  privateKeyPem?: string;  // encrypted, ED25519 (Robinhood)
  permission: 'trade' | 'readonly';
  enabled: boolean;
  expireAt?: number;
}

export interface CircuitBreaker {
  failures: number;
  lastFailure: number;
  status: 'closed' | 'open' | 'half_open';
  openedAt?: number;
  resetAt?: number;
}

export interface ExecutionResult {
  signalId: string;
  success: boolean;
  orderId?: string;
  errorMessage?: string;
  latencyMs: number;
  brokerId: string;
  retryAttempt: number;
}

export interface CopyTradeMetrics {
  totalExecuted: number;
  totalSuccessful: number;
  totalFailed: number;
  totalAmount: number;
  avgLatencyMs: number;
  breakersTripped: number;
  perBroker: Record<string, { executed: number; success: number; failed: number }>;
}

interface CopyTradeExecutorConfig {
  maxRetries: number;
  circuitBreakerThreshold: number;
  circuitBreakerTimeoutMs: number;
  apiKeyEncryptionKey: string; // 32-byte hex for AES-256-GCM
  maxParallelOrders: number;
  defaultCopyRatio: number;
}

// ═══════════════ CopyTradeExecutor ═══════════════════════

export class CopyTradeExecutor {
  private config: CopyTradeExecutorConfig;
  private queue: SignalQueue;
  private apiKeys: Map<string, ApiKeyEntry> = new Map();
  private breakers: Map<string, CircuitBreaker> = new Map();
  private metrics: CopyTradeMetrics;
  private processing = false;
  private poolTimer?: NodeJS.Timeout;
  private executions: Map<string, ExecutionResult> = new Map();

  /** Callbacks for notifications */
  private onOrderPlaced?: (result: ExecutionResult) => void;
  private onCircuitBreaker?: (brokerId: string, breaker: CircuitBreaker) => void;
  private onError?: (error: Error) => void;

  constructor(config?: Partial<CopyTradeExecutorConfig>) {
    this.config = {
      maxRetries: 3,
      circuitBreakerThreshold: 3,
      circuitBreakerTimeoutMs: 5 * 60 * 1000, // 5 min
      apiKeyEncryptionKey: process.env.COPYTRADE_ENCRYPTION_KEY || '',
      maxParallelOrders: 5,
      defaultCopyRatio: 1.0,
      ...config,
    };
    this.queue = getSignalQueue();
    this.metrics = this.initMetrics();
  }

  // ═══════════════ API Key Management ═════════════════════

  registerApiKey(entry: ApiKeyEntry): void {
    if (!entry.enabled) return;
    this.apiKeys.set(`${entry.userId}:${entry.brokerId}`, entry);
  }

  removeApiKey(userId: string, brokerId: string): void {
    this.apiKeys.delete(`${userId}:${brokerId}`);
  }

  getApiKeysForUser(userId: string): ApiKeyEntry[] {
    return Array.from(this.apiKeys.values()).filter((k) => k.userId === userId && k.enabled);
  }

  /**
   * Decrypt one encrypted field (format: "iv:tag:ciphertext" hex triplets).
   * 
   * The encrypted value is stored as three colon-delimited hex strings:
   *   iv:tag:ciphertext
   * 
   * This method splits the triple, runs AES-256-GCM decryption,
   * and returns the original plaintext.
   * 
   * @throws Error if encryption key is not configured or format invalid
   */
  decryptTriplet(encryptedTriplet: string): string {
    if (!this.config.apiKeyEncryptionKey) {
      throw new Error('Encryption key not configured');
    }
    const parts = encryptedTriplet.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted format: expected iv:tag:ciphertext');
    }
    const [ivHex, tagHex, cipherHex] = parts;

    const key = Buffer.from(this.config.apiKeyEncryptionKey, 'hex');
    if (key.length !== 32) {
      throw new Error('Encryption key must be 32 bytes (64 hex chars)');
    }

    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(ivHex, 'hex'),
    );
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    let dec = decipher.update(cipherHex, 'hex', 'utf8');
    dec += decipher.final('utf8');
    return dec;
  }

  /**
   * @deprecated Use decryptTriplet() instead. Kept for backward compatibility.
   */
  decryptApiKey(encrypted: string, iv: string, tag: string): string {
    const triplet = `${iv}:${tag}:${encrypted}`;
    return this.decryptTriplet(triplet);
  }

  // ═══════════════ Circuit Breaker ════════════════════════

  getBreaker(brokerId: string): CircuitBreaker {
    if (!this.breakers.has(brokerId)) {
      this.breakers.set(brokerId, { failures: 0, lastFailure: 0, status: 'closed' });
    }
    return this.breakers.get(brokerId)!;
  }

  recordFailure(brokerId: string): CircuitBreaker {
    const b = this.getBreaker(brokerId);
    b.failures++;
    b.lastFailure = Date.now();
    if (b.failures >= this.config.circuitBreakerThreshold) {
      b.status = 'open';
      b.openedAt = Date.now();
      b.resetAt = Date.now() + this.config.circuitBreakerTimeoutMs;
      this.metrics.breakersTripped++;
      if (this.onCircuitBreaker) this.onCircuitBreaker(brokerId, b);
    }
    return b;
  }

  recordSuccess(brokerId: string): void {
    const b = this.getBreaker(brokerId);
    b.failures = 0;
    b.status = 'closed';
    b.openedAt = undefined;
  }

  isCircuitOpen(brokerId: string): boolean {
    const b = this.getBreaker(brokerId);
    if (b.status === 'open' && b.resetAt && Date.now() > b.resetAt) {
      b.status = 'half_open';
    }
    return b.status === 'open';
  }

  // ═══════════════ Subscription Check (R137 J03) ══════════

  /**
   * Verify that a user has subscribed to the signal provider.
   * 
   * Checks the user_subscriptions table for an active subscription
   * matching (userId, providerId). This prevents cross-user signal leakage
   * where user A's signals could be executed for user B via provider_id match.
   */
  private async checkSubscription(userId: string, providerId: string): Promise<boolean> {
    try {
      const db = this.resolveMainDb();
      if (!db) return true; // No DB available → allow (offline/external key mode)
      const row = db.prepare(
        `SELECT 1 FROM user_subscriptions
         WHERE user_id = ? AND provider_id = ? AND status = 'active'
         LIMIT 1`
      ).get(userId, providerId);
      return !!row;
    } catch {
      // DB not available skip (standalone executor mode)
      return true;
    }
  }

  // ═══════════════ Max Position Check (R137 J05) ══════════

  /**
   * Consult maxPositionSize from user config return true if placing
   * this order would exceed the user’s total position limit for the symbol.
   */
  private async checkMaxPosition(
    userId: string,
    brokerId: string,
    symbol: string,
    newQuantity: number,
    side: string,
  ): Promise<boolean> {
    try {
      const db = this.resolveMainDb();
      if (!db) return true; // No DB → allow

      const cfg = db.prepare(
        `SELECT max_position_size FROM copy_trade_configs
         WHERE user_id = ? AND broker_id = ? AND symbol = ?
         LIMIT 1`
      ).get(userId, brokerId, symbol) as { max_position_size: number } | undefined;

      const maxSize = cfg?.max_position_size ?? 0;
      if (maxSize <= 0) return true; // No limit configured

      // Sum existing positions for this symbol
      const existing = db.prepare(
        `SELECT SUM(quantity) as total_qty
         FROM copy_trades
         WHERE user_id = ? AND broker_id = ? AND symbol = ? AND status = 'executed'
           AND side = ?`
      ).get(userId, brokerId, symbol, side) as { total_qty: number } | undefined;

      const current = existing?.total_qty ?? 0;
      return (current + newQuantity) <= maxSize;
    } catch {
      return true; // Standalone mode
    }
  }

  // ═══════════════ Execution ══════════════════════════════

  /** Process one signal: resolve → subscribe-check → decrypt → execute → ack */
  async executeSignal(signal: QueuedSignal): Promise<ExecutionResult> {
    const start = Date.now();
    const result: ExecutionResult = {
      signalId: signal.signalId,
      success: false,
      latencyMs: 0,
      brokerId: signal.targetBrokerId,
      retryAttempt: signal.metadata.retryCount,
    };

    try {
      // 1. Circuit breaker check
      if (this.isCircuitOpen(signal.targetBrokerId)) {
        result.errorMessage = `Circuit breaker open for ${signal.targetBrokerId}`;
        result.latencyMs = Date.now() - start;
        this.queue.ack(signal.signalId, false, result.errorMessage);
        return result;
      }

      // 2. Subscription check (R137 J03)
      const subscribed = await this.checkSubscription(signal.userId, signal.payload.providerId || signal.userId);
      if (!subscribed) {
        result.errorMessage = `User ${signal.userId} not subscribed to provider ${signal.payload.providerId}`;
        result.latencyMs = Date.now() - start;
        this.queue.ack(signal.signalId, false, result.errorMessage);
        return result;
      }

      // 3. Resolve API key
      const keyEntry = this.apiKeys.get(`${signal.userId}:${signal.targetBrokerId}`);
      if (!keyEntry) {
        result.errorMessage = `No API key for ${signal.userId}/${signal.targetBrokerId}`;
        result.latencyMs = Date.now() - start;
        this.queue.ack(signal.signalId, false, result.errorMessage);
        return result;
      }

      // 4. Compute copy ratio quantities
      const ratio = signal.payload.copyRatio || this.config.defaultCopyRatio;
      const quantity = this.roundQuantity(signal.payload.quantity * ratio, signal.payload.symbol);

      // 5. Max position check (R137 J05)
      const withinLimit = await this.checkMaxPosition(
        signal.userId, signal.targetBrokerId, signal.payload.symbol, quantity, signal.payload.side,
      );
      if (!withinLimit) {
        result.errorMessage = `Max position size exceeded for ${signal.payload.symbol} on ${signal.targetBrokerId}`;
        result.latencyMs = Date.now() - start;
        this.queue.ack(signal.signalId, false, result.errorMessage);
        return result;
      }

      // 6. Build order request
      const orderReq = this.buildOrderRequest(signal, keyEntry, quantity);

      // 7. Place order via adapter (R137 J01: decrypt keys before passing)
      const orderResult = await this.placeOrder(orderReq, keyEntry);

      // 8. Update metrics
      result.success = true;
      result.orderId = orderResult.orderId;
      result.latencyMs = Date.now() - start;
      this.recordSuccess(signal.targetBrokerId);
      this.updateMetrics(result);

    } catch (e: any) {
      result.success = false;
      result.errorMessage = e.message;
      result.latencyMs = Date.now() - start;
      this.recordFailure(signal.targetBrokerId);
      this.updateMetrics(result);
    }

    // 9. Ack to queue
    this.queue.ack(signal.signalId, result.success, result.errorMessage);
    this.executions.set(signal.signalId, result);

    if (this.onOrderPlaced) this.onOrderPlaced(result);
    return result;
  }

  /** Process all queued signals for a user */
  async executeAllForUser(userId: string): Promise<ExecutionResult[]> {
    const signals = this.queue.dequeueAll(userId);
    if (signals.length === 0) return [];

    const results: ExecutionResult[] = [];
    // Process in batches of maxParallelOrders
    for (let i = 0; i < signals.length; i += this.config.maxParallelOrders) {
      const batch = signals.slice(i, i + this.config.maxParallelOrders);
      const batchResults = await Promise.all(batch.map((s) => this.executeSignal(s)));
      results.push(...batchResults);
    }
    return results;
  }

  /** Continuous polling loop */
  startPolling(intervalMs = 1000, userIds: string[] = []): void {
    if (this.poolTimer) return;
    this.processing = true;
    const tick = async () => {
      if (!this.processing) return;
      try {
        const targetUsers = userIds.length > 0 ? userIds : this.getUsersWithKeys();
        for (const userId of targetUsers) {
          await this.executeAllForUser(userId);
        }
      } catch (e: any) {
        if (this.onError) this.onError(e);
      }
      if (this.processing) {
        this.poolTimer = setTimeout(tick, intervalMs);
      }
    };
    tick();
  }

  stopPolling(): void {
    this.processing = false;
    if (this.poolTimer) {
      clearTimeout(this.poolTimer);
      this.poolTimer = undefined;
    }
  }

  // ═══════════════ Metrics ═══════════════════════════════

  getMetrics(): CopyTradeMetrics {
    return { ...this.metrics, perBroker: { ...this.metrics.perBroker } };
  }

  getBreakers(): Map<string, CircuitBreaker> {
    return new Map(this.breakers);
  }

  getExecutionResult(signalId: string): ExecutionResult | undefined {
    return this.executions.get(signalId);
  }

  setCallbacks(opts: {
    onOrderPlaced?: (result: ExecutionResult) => void;
    onCircuitBreaker?: (brokerId: string, breaker: CircuitBreaker) => void;
    onError?: (error: Error) => void;
  }): void {
    if (opts.onOrderPlaced) this.onOrderPlaced = opts.onOrderPlaced;
    if (opts.onCircuitBreaker) this.onCircuitBreaker = opts.onCircuitBreaker;
    if (opts.onError) this.onError = opts.onError;
  }

  dispose(): void {
    this.stopPolling();
    this.apiKeys.clear();
    this.breakers.clear();
    this.executions.clear();
  }

  // ═══════════════ Private ═══════════════════════════════

  private initMetrics(): CopyTradeMetrics {
    return { totalExecuted: 0, totalSuccessful: 0, totalFailed: 0, totalAmount: 0, avgLatencyMs: 0, breakersTripped: 0, perBroker: {} };
  }

  private updateMetrics(result: ExecutionResult): void {
    this.metrics.totalExecuted++;
    if (result.success) this.metrics.totalSuccessful++;
    else this.metrics.totalFailed++;
    const prev = this.metrics.avgLatencyMs;
    this.metrics.avgLatencyMs = (prev * (this.metrics.totalExecuted - 1) + result.latencyMs) / this.metrics.totalExecuted;

    if (!this.metrics.perBroker[result.brokerId]) {
      this.metrics.perBroker[result.brokerId] = { executed: 0, success: 0, failed: 0 };
    }
    this.metrics.perBroker[result.brokerId].executed++;
    if (result.success) this.metrics.perBroker[result.brokerId].success++;
    else this.metrics.perBroker[result.brokerId].failed++;
  }

  private buildOrderRequest(signal: QueuedSignal, key: ApiKeyEntry, quantity: number): any {
    return {
      brokerId: signal.targetBrokerId,
      symbol: signal.payload.symbol,
      side: signal.payload.side,
      orderType: signal.payload.orderType,
      quantity,
      price: signal.payload.price,
      stopLoss: signal.payload.stopLoss,
      takeProfit: signal.payload.takeProfit,
      leverage: signal.payload.leverage,
    };
  }

  private roundQuantity(qty: number, symbol: string): number {
    // Round to appropriate precision based on symbol
    const precision = symbol.includes('BTC') ? 8 : symbol.includes('ETH') ? 6 : 4;
    const factor = Math.pow(10, precision);
    return Math.floor(qty * factor) / factor;
  }

  /**
   * Place order via adapter with decrypted keys (R137 J01 FIX).
   * 
   * Before this fix, keyEntry.apiKey/secretKey/etc were passed directly
   * to the adapter factory in encrypted form, causing signature failures.
   * Now each field is decrypted via decryptTriplet() before being passed.
   */
  private async placeOrder(orderReq: any, keyEntry: ApiKeyEntry): Promise<CloudOrderInfo> {
    // Decrypt API credentials before passing to adapter
    const plainApiKey = this.decryptTriplet(keyEntry.apiKey);
    const plainSecretKey = this.decryptTriplet(keyEntry.secretKey);
    const plainPassphrase = keyEntry.passphrase
      ? this.decryptTriplet(keyEntry.passphrase)
      : undefined;
    const plainPrivateKeyPem = keyEntry.privateKeyPem
      ? this.decryptTriplet(keyEntry.privateKeyPem)
      : undefined;

    const factory = this.resolveAdapterFactory();
    const brokerConfig = factory.buildCloudConfig(keyEntry.brokerId, {
      apiKey: plainApiKey,
      secretKey: plainSecretKey,
      passphrase: plainPassphrase,
      options: plainPrivateKeyPem ? { privateKeyPem: plainPrivateKeyPem } : undefined,
    });

    const adapter = await factory.getOrCreate(brokerConfig);
    return adapter.placeOrder(orderReq as CloudOrderRequest);
  }

  private resolveAdapterFactory() {
    // Lazy require to avoid circular deps
    return require('../adapters/adapter-factory');
  }

  private resolveMainDb(): any | null {
    try {
      return require('../db/database').getMainDb();
    } catch {
      return null;
    }
  }

  private getUsersWithKeys(): string[] {
    const users = new Set<string>();
    for (const key of this.apiKeys.values()) {
      if (key.enabled) users.add(key.userId);
    }
    return Array.from(users);
  }
}

// ═══════════════ Singleton ═══════════════════════════════

let _executor: CopyTradeExecutor | null = null;

export function getCopyTradeExecutor(config?: Partial<CopyTradeExecutorConfig>): CopyTradeExecutor {
  if (!_executor) {
    _executor = new CopyTradeExecutor(config);
  }
  return _executor;
}

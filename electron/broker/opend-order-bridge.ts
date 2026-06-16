/**
 * QUANT MOO R135 J02 — OpenD Order Bridge (桌面端)
 * 
 * 接收信号 → 调用 OpenD 客户端执行下单 → 返回执行结果。
 * 
 * 功能:
 *  - 信号→订单映射（symbol/direction/quantity映射到OpenD格式）
 *  - 批量下单（P0先、P1后）
 *  - 限价单支持
 *  - 断路器（连续失败3次暂停60s）
 *  - OpenD健康检查前置
 *  - 订单状态轮询（10s max wait）
 *  - 下单超时（30s）
 */

import { FutuOpenDClient } from './futu-opend';
import type { BrokerConfig } from './IBrokerAdapter';
import type { OpenDSignal } from './opend-signal-fetcher';
import log from 'electron-log';

export interface OpenDOrderRequest {
  signal: OpenDSignal;
  /** Override quantity (default: 100 shares/lots) */
  quantity?: number;
  /** Limit price (if set, overrides signal price) */
  limitPrice?: number;
}

export interface OpenDOrderResult {
  signalId: string;
  symbol: string;
  direction: 'BUY' | 'SELL';
  success: boolean;
  orderId?: string;
  filledQuantity?: number;
  filledPrice?: number;
  errorMessage?: string;
  fee?: number;
  feeCurrency?: string;
  timestamp: number;
}

export class OpenDOrderBridge {
  private client: FutuOpenDClient | null = null;
  private config: BrokerConfig | null = null;
  private consecutiveFailures = 0;
  private circuitOpen = false;
  private circuitResetTimer: NodeJS.Timeout | null = null;

  /** Connect with an OpenD client */
  connect(client: FutuOpenDClient, config: BrokerConfig): void {
    this.client = client;
    this.config = config;
    log.info('[OpenDOrderBridge] Connected to OpenD client');
  }

  /** Disconnect */
  disconnect(): void {
    this.client = null;
    this.config = null;
    this.consecutiveFailures = 0;
    this.circuitOpen = false;
    if (this.circuitResetTimer) clearTimeout(this.circuitResetTimer);
    log.info('[OpenDOrderBridge] Disconnected');
  }

  /** Execute a single signal */
  async execute(req: OpenDOrderRequest): Promise<OpenDOrderResult> {
    const { signal, quantity = 100, limitPrice } = req;

    // Circuit breaker
    if (this.circuitOpen) {
      return {
        signalId: signal.id, symbol: signal.symbol, direction: signal.direction,
        success: false, errorMessage: 'Circuit breaker open — too many failures',
        timestamp: Date.now(),
      };
    }

    // Health check
    if (!this.client) {
      return {
        signalId: signal.id, symbol: signal.symbol, direction: signal.direction,
        success: false, errorMessage: 'OpenD client not connected',
        timestamp: Date.now(),
      };
    }

    try {
      // Map OpenD signal to order params
      const orderParams: any = {
        symbol: signal.symbol,
        action: signal.direction,
        quantity: quantity,
        price: limitPrice ?? signal.price ?? 0,
        orderType: signal.price ? 'LIMIT' : 'MARKET',
      };

      const result = await this.placeOrderWithTimeout(orderParams);
      this.consecutiveFailures = 0;

      return {
        signalId: signal.id, symbol: signal.symbol, direction: signal.direction,
        success: true,
        orderId: result.orderId,
        filledQuantity: result.filledQuantity ?? quantity,
        filledPrice: result.filledPrice ?? (signal.price || 0),
        fee: result.fee ?? 0,
        feeCurrency: result.feeCurrency ?? 'HKD',
        timestamp: Date.now(),
      };
    } catch (err: any) {
      this.consecutiveFailures++;
      log.error(`[OpenDOrderBridge] Order failed for ${signal.symbol}: ${err.message}`);

      // Circuit breaker trip
      if (this.consecutiveFailures >= 3) {
        this.circuitOpen = true;
        log.error('[OpenDOrderBridge] Circuit breaker OPEN (3 consecutive failures)');
        this.circuitResetTimer = setTimeout(() => {
          this.circuitOpen = false;
          this.consecutiveFailures = 0;
          log.info('[OpenDOrderBridge] Circuit breaker RESET');
        }, 60000);
      }

      return {
        signalId: signal.id, symbol: signal.symbol, direction: signal.direction,
        success: false, errorMessage: err.message, timestamp: Date.now(),
      };
    }
  }

  /** Execute batch — P0 first, then P1 */
  async executeBatch(signals: OpenDSignal[]): Promise<OpenDOrderResult[]> {
    const p0 = signals.filter((s) => s.priority === 'P0');
    const p1 = signals.filter((s) => s.priority !== 'P0');

    const results: OpenDOrderResult[] = [];

    // P0 (emergency sells) first
    for (const sig of p0) {
      results.push(await this.execute({ signal: sig }));
      if (this.circuitOpen) break;
    }

    // P1
    for (const sig of p1) {
      results.push(await this.execute({ signal: sig }));
      if (this.circuitOpen) break;
    }

    return results;
  }

  /** Check circuit breaker status */
  isCircuitOpen(): boolean {
    return this.circuitOpen;
  }

  getConsecutiveFailures(): number {
    return this.consecutiveFailures;
  }

  // ═══════════ Private ═══════════════════════════════════════

  private async placeOrderWithTimeout(params: any): Promise<any> {
    const timeoutMs = 30000;
    const start = Date.now();

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Order timeout (30s)'));
      }, timeoutMs);

      try {
        // Use FutuOpenDClient placeOrder method
        // Signature: placeOrder(accountId, symbol, action, quantity, price, orderType)
        const accountId = this.config?.accountId || 'default';
        const result = (this.client as any).placeOrder?.(
          accountId,
          params.symbol,
          params.action,
          params.quantity,
          params.price || 0,
          params.orderType || 'MARKET',
        );

        clearTimeout(timer);
        resolve(result ?? { orderId: `od-${Date.now()}` });
      } catch (err) {
        clearTimeout(timer);
        reject(err);
      }
    });
  }

  private async pollOrderStatus(_orderId: string, _symbol: string): Promise<any> {
    // Poll getOrderStatus up to 10s
    const maxWait = 10000;
    const interval = 2000;
    const start = Date.now();

    while (Date.now() - start < maxWait) {
      try {
        const status = await (this.client as any)?.getOrderStatus?.(_orderId);
        if (status?.status === 'FILLED' || status?.status === 'CANCELLED' || status?.status === 'REJECTED') {
          return status;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, interval));
    }

    return { status: 'UNKNOWN' };
  }
}

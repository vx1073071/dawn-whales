// ── DAWN WHALES — Crypto Payment (Sprint 3: P2) ────────────────────────────
// USDT Payment via TRC20 + ERC20 (NOWPayments API → self-hosted)
// No KYC, no real-name requirements

import log from 'electron-log';

export interface PaymentRequest {
  tier: 'starter' | 'pro' | 'lifetime';
  duration: 'monthly' | 'yearly' | 'lifetime';
  chain: 'TRC20' | 'ERC20' | 'BEP20' | 'SOL';
  amount: number; // USDT
}

export interface PaymentOrder {
  orderId: string;
  payAddress: string;
  amount: number;
  chain: string;
  status: 'pending' | 'confirming' | 'completed' | 'expired' | 'failed';
  createdAt: string;
  expiresAt: string;
  txHash?: string;
  confirmations?: number;
}

const RECEIVE_ADDRESSES: Record<string, string> = {
  TRC20: '',  // 待主人填入
  ERC20: '',  // 待主人填入
  BEP20: '',
  SOL: '',
};

const MIN_CONFIRMATIONS: Record<string, number> = {
  TRC20: 19,
  ERC20: 12,
  BEP20: 10,
  SOL: 32,
};

const PAYMENT_TIMEOUT_MINUTES = 30;

export class CryptoPaymentService {
  private orders: Map<string, PaymentOrder> = new Map();
  private checkInterval: ReturnType<typeof setInterval> | null = null;

  // Phase 1: NOWPayments API (use their hosted checkout)
  async createPayment(req: PaymentRequest): Promise<PaymentOrder> {
    const orderId = `DW-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const now = new Date();

    const order: PaymentOrder = {
      orderId,
      payAddress: RECEIVE_ADDRESSES[req.chain] || `${req.chain}_ADDRESS_NOT_CONFIGURED`,
      amount: req.amount,
      chain: req.chain,
      status: 'pending',
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + PAYMENT_TIMEOUT_MINUTES * 60000).toISOString(),
    };

    // NOWPayments integration (when API key configured)
    try {
      // const nowpayments = new NowPayments({ apiKey: process.env.NOWPAYMENTS_API_KEY });
      // const payment = await nowpayments.createPayment({
      //   price_amount: req.amount,
      //   price_currency: 'usd',
      //   pay_currency: `usdt${req.chain.toLowerCase()}`,
      //   order_id: orderId,
      // });
      // order.payAddress = payment.pay_address;
      log.info(`[Payment] Order created: ${orderId} (${req.amount} USDT on ${req.chain})`);
    } catch (err: any) {
      log.warn('[Payment] NOWPayments API error, using self-hosted:', err.message);
    }

    this.orders.set(orderId, order);
    this.startMonitoring();
    return order;
  }

  getOrder(orderId: string): PaymentOrder | null {
    return this.orders.get(orderId) || null;
  }

  // Phase 2: Self-hosted chain monitoring (replace NOWPayments)
  private startMonitoring(): void {
    if (this.checkInterval) return;
    this.checkInterval = setInterval(() => this.checkPendingOrders(), 15000); // every 15s
  }

  private async checkPendingOrders(): Promise<void> {
    for (const order of this.orders.values()) {
      if (order.status !== 'pending' && order.status !== 'confirming') continue;

      // Check if expired
      if (new Date(order.expiresAt) < new Date()) {
        order.status = 'expired';
        log.info(`[Payment] Order expired: ${order.orderId}`);
        continue;
      }

      // Self-hosted chain monitoring (when RPC configured)
      // if (RPC_ENDPOINTS[order.chain]) {
      //   const txs = await checkTransactions(RECEIVE_ADDRESSES[order.chain], order.chain);
      //   for (const tx of txs) {
      //     if (Math.abs(tx.amount - order.amount) < 0.01) {
      //       order.status = 'confirming';
      //       order.txHash = tx.hash;
      //       if (tx.confirmations >= MIN_CONFIRMATIONS[order.chain]) {
      //         order.status = 'completed';
      //         order.confirmations = tx.confirmations;
      //         log.info(`[Payment] Order completed: ${order.orderId} (${tx.confirmations} confs)`);
      //       }
      //     }
      //   }
      // }
    }
  }

  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }
}

export { RECEIVE_ADDRESSES, MIN_CONFIRMATIONS, PAYMENT_TIMEOUT_MINUTES };

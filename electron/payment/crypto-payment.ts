// ── DAWN WHALES — Crypto Payment (Sprint 3: P2) ────────────────────────────
// USDT Payment via TRC20 + ERC20 + BEP20 + SOL (self-hosted chain monitoring)
// No KYC, no real-name requirements
//
// TODO: RECEIVE_ADDRESSES — 主人需在 .env 中填入以下环境变量：
//   USDT_TRC20_ADDRESS  — TRON TRC20 收款地址
//   USDT_ERC20_ADDRESS  — Ethereum ERC20 收款地址
//   USDT_BEP20_ADDRESS  — BSC BEP20 收款地址
//   USDT_SOL_ADDRESS    — Solana SPL Token 收款地址
//   TRONGRID_API_KEY    — (可选) TRON Grid API key，提高速率
//   ALCHEMY_API_KEY     — (可选) 替换 demo key 以提高 Ethereum RPC 速率

import log from 'electron-log';
import type { LicenseManager, LicenseTier } from './license-manager';

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
  tier: string;
  duration: string;
  status: 'pending' | 'confirming' | 'completed' | 'expired' | 'failed';
  createdAt: string;
  expiresAt: string;
  txHash?: string;
  confirmations?: number;
}

interface DatabaseLike {
  getDb(): any; // better-sqlite3 Database instance or null
}

// 收款地址配置 - 主人填入后生效
const RECEIVE_ADDRESSES: Record<string, string> = {
  TRC20: process.env.USDT_TRC20_ADDRESS || '',
  ERC20: process.env.USDT_ERC20_ADDRESS || '',
  BEP20: process.env.USDT_BEP20_ADDRESS || '',
  SOL:   process.env.USDT_SOL_ADDRESS || '',
};

// USDT定价 (USDT ≈ CNY 7.2) — 与 LicenseManager.TIER_PRICES_USDT 对齐
const USDT_PRICES: Record<string, number> = {
  dw_starter_monthly: 14,    // ¥99 ≈ 14 USDT
  dw_starter_yearly: 135,    // ¥972 ≈ 135 USDT
  dw_pro_monthly: 42,        // ¥299 ≈ 42 USDT
  dw_pro_yearly: 403,        // ¥2899 ≈ 403 USDT
  dw_lifetime: 430,          // ¥3099 ≈ 430 USDT (一次性)
};

// RPC endpoints for self-hosted chain monitoring
const RPC_ENDPOINTS: Record<string, string> = {
  TRC20: 'https://api.trongrid.io',
  ERC20: process.env.ALCHEMY_API_KEY
    ? `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
    : 'https://eth-mainnet.g.alchemy.com/v2/demo',
  BEP20: 'https://bsc-dataseed.binance.org',
  SOL:   'https://api.mainnet-beta.solana.com',
};

const MIN_CONFIRMATIONS: Record<string, number> = {
  TRC20: 19,
  ERC20: 12,
  BEP20: 10,
  SOL: 32,
};

const PAYMENT_TIMEOUT_MINUTES = 30;

interface ChainTx {
  hash: string;
  amount: number;
  from: string;
  to: string;
  confirmations: number;
  timestamp: number;
}

export class CryptoPaymentService {
  private orders: Map<string, PaymentOrder> = new Map();
  private processedTxHashes: Set<string> = new Set();
  private checkInterval: ReturnType<typeof setInterval> | null = null;
  private db: any = null;
  private licenseManager: LicenseManager | null = null;

  /**
   * Initialize payment service with database and optional license manager.
   * Called from main.ts after app.whenReady().
   */
  initialize(db: DatabaseLike, licenseManager?: LicenseManager): void {
    this.db = db.getDb() || null;
    this.licenseManager = licenseManager || null;
    if (this.db) {
      this.createTable();
      this.loadOrdersFromDb();
    }
    log.info(`[Payment] Initialized with ${this.orders.size} orders loaded from DB (db=${!!this.db})`);
  }

  private createTable(): void {
    if (!this.db) return;
    try {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS payment_orders (
          order_id TEXT PRIMARY KEY,
          pay_address TEXT NOT NULL,
          amount REAL NOT NULL,
          chain TEXT NOT NULL,
          tier TEXT NOT NULL DEFAULT '',
          duration TEXT NOT NULL DEFAULT '',
          status TEXT NOT NULL DEFAULT 'pending',
          created_at TEXT NOT NULL,
          expires_at TEXT NOT NULL,
          tx_hash TEXT,
          confirmations INTEGER DEFAULT 0
        )
      `);
      log.info('[Payment] payment_orders table ready');
    } catch (err: any) {
      log.error('[Payment] Table creation failed:', err.message);
    }
  }

  private loadOrdersFromDb(): void {
    if (!this.db) return;
    try {
      const rows = this.db.prepare(
        "SELECT * FROM payment_orders WHERE status IN ('pending', 'confirming', 'completed')"
      ).all();

      for (const row of rows) {
        const order: PaymentOrder = {
          orderId: row.order_id,
          payAddress: row.pay_address,
          amount: row.amount,
          chain: row.chain,
          tier: row.tier || '',
          duration: row.duration || '',
          status: row.status,
          createdAt: row.created_at,
          expiresAt: row.expires_at,
          txHash: row.tx_hash || undefined,
          confirmations: row.confirmations || 0,
        };
        this.orders.set(order.orderId, order);
      }

      // Load processed tx hashes to prevent double-processing
      const completedRows = this.db.prepare(
        "SELECT tx_hash FROM payment_orders WHERE status = 'completed' AND tx_hash IS NOT NULL"
      ).all();
      for (const row of completedRows) {
        if (row.tx_hash) this.processedTxHashes.add(row.tx_hash);
      }
    } catch (err: any) {
      log.error('[Payment] Failed to load orders from DB:', err.message);
    }
  }

  private saveOrder(order: PaymentOrder): void {
    if (!this.db) return;
    try {
      this.db.prepare(`
        INSERT OR REPLACE INTO payment_orders
          (order_id, pay_address, amount, chain, tier, duration, status, created_at, expires_at, tx_hash, confirmations)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        order.orderId, order.payAddress, order.amount, order.chain,
        order.tier, order.duration, order.status, order.createdAt,
        order.expiresAt, order.txHash || null, order.confirmations || 0
      );
    } catch (err: any) {
      log.error('[Payment] Failed to save order:', err.message);
    }
  }

  /** Create a new payment order */
  async createPayment(req: PaymentRequest): Promise<PaymentOrder> {
    // Validate chain address is configured
    const payAddress = RECEIVE_ADDRESSES[req.chain];
    if (!payAddress) {
      log.warn(`[Payment] ${req.chain} address not configured`);
    }

    const orderId = `DW-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const now = new Date();

    const order: PaymentOrder = {
      orderId,
      payAddress: payAddress || `${req.chain}_ADDRESS_NOT_CONFIGURED`,
      amount: req.amount,
      chain: req.chain,
      tier: req.tier,
      duration: req.duration,
      status: 'pending',
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + PAYMENT_TIMEOUT_MINUTES * 60000).toISOString(),
    };

    log.info(`[Payment] Order created: ${orderId} (${req.amount} USDT on ${req.chain}, tier=${req.tier}/${req.duration})`);

    this.orders.set(orderId, order);
    this.saveOrder(order);
    this.startMonitoring();
    return order;
  }

  getOrder(orderId: string): PaymentOrder | null {
    return this.orders.get(orderId) || null;
  }

  getAllOrders(): PaymentOrder[] {
    return Array.from(this.orders.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  getPricing(): Record<string, number> {
    return { ...USDT_PRICES };
  }

  getSupportedChains(): string[] {
    return Object.keys(RECEIVE_ADDRESSES).filter(chain => !!RECEIVE_ADDRESSES[chain]);
  }

  /** Start periodic chain monitoring */
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
        this.saveOrder(order);
        log.info(`[Payment] Order expired: ${order.orderId}`);
        continue;
      }

      // Self-hosted chain monitoring per chain
      let txs: ChainTx[] = [];
      try {
        if (order.chain === 'TRC20' && RECEIVE_ADDRESSES.TRC20) {
          txs = await this.checkTrc20Transactions(RECEIVE_ADDRESSES.TRC20);
        } else if (order.chain === 'ERC20' && RECEIVE_ADDRESSES.ERC20) {
          txs = await this.checkErc20Transactions(RECEIVE_ADDRESSES.ERC20);
        } else if (order.chain === 'BEP20' && RECEIVE_ADDRESSES.BEP20) {
          txs = await this.checkBep20Transactions(RECEIVE_ADDRESSES.BEP20);
        } else if (order.chain === 'SOL' && RECEIVE_ADDRESSES.SOL) {
          txs = await this.checkSolTransactions(RECEIVE_ADDRESSES.SOL);
        }
      } catch (err: any) {
        log.error(`[Payment] Chain monitoring error for ${order.orderId}:`, err.message);
        continue;
      }

      for (const tx of txs) {
        // Skip already-processed transactions
        if (this.processedTxHashes.has(tx.hash)) continue;
        // Match amount (within 0.01 USDT tolerance)
        if (Math.abs(tx.amount - order.amount) >= 0.01) continue;

        order.status = 'confirming';
        order.txHash = tx.hash;
        order.confirmations = tx.confirmations;
        this.saveOrder(order);
        log.info(`[Payment] Tx detected: ${order.orderId} ← ${tx.hash} (${tx.confirmations} confs)`);

        if (tx.confirmations >= MIN_CONFIRMATIONS[order.chain]) {
          order.status = 'completed';
          this.processedTxHashes.add(tx.hash);
          this.saveOrder(order);
          this.onPaymentCompleted(order);
        }
        break; // Only process first matching tx
      }
    }
  }

  /** Called when a payment reaches required confirmations */
  private onPaymentCompleted(order: PaymentOrder): void {
    log.info(`[Payment] ✅ Order completed: ${order.orderId} (${order.confirmations} confs, ${order.chain})`);

    // Activate license via LicenseManager
    if (this.licenseManager && order.tier && order.duration) {
      try {
        const tier = order.tier as LicenseTier;
        const durationMonths = order.duration === 'lifetime' ? 0
          : order.duration === 'yearly' ? 12
          : 1;

        this.licenseManager.activateLicense(order.orderId, tier, durationMonths);
        log.info(`[Payment] License activated: ${tier} / ${order.duration} for order ${order.orderId}`);
      } catch (err: any) {
        log.error(`[Payment] License activation failed for ${order.orderId}:`, err.message);
      }
    } else {
      log.warn(`[Payment] No LicenseManager or missing tier/duration for ${order.orderId}, skipping license activation`);
    }
  }

  // ── TRC20 (TRON) ──────────────────────────────────────────────────────────
  private async checkTrc20Transactions(address: string): Promise<ChainTx[]> {
    const rpcUrl = RPC_ENDPOINTS.TRC20;
    if (!rpcUrl) return [];

    // USDT TRC20 contract: TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t
    const response = await fetch(
      `${rpcUrl}/v1/accounts/${address}/transactions/trc20?limit=10&contract_address=TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t`,
      { headers: { 'TRON-PRO-API-KEY': process.env.TRONGRID_API_KEY || '' } }
    );

    if (!response.ok) throw new Error(`TRON API error: ${response.status}`);

    const data = await response.json();
    return (data.data || [])
      .filter((tx: any) => tx.to.toLowerCase() === address.toLowerCase())
      .map((tx: any): ChainTx => ({
        hash: tx.transaction_id,
        amount: parseFloat(tx.value) / 1e6,
        from: tx.from,
        to: tx.to,
        confirmations: tx.confirmations || 0,
        timestamp: tx.block_timestamp,
      }));
  }

  // ── ERC20 (Ethereum via Alchemy) ─────────────────────────────────────────
  private async checkErc20Transactions(address: string): Promise<ChainTx[]> {
    const rpcUrl = RPC_ENDPOINTS.ERC20;
    if (!rpcUrl) return [];

    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'alchemy_getAssetTransfers',
        params: [{
          toAddress: address,
          category: ['erc20'],
          contractAddresses: ['0xdac17f958d2ee523a2206206994597c13d831ec7'],
          maxCount: '0xa',
        }],
        id: 1,
      }),
    });

    if (!response.ok) throw new Error(`Ethereum API error: ${response.status}`);

    const data = await response.json();
    const transfers = data.result?.transfers || [];
    const currentBlock = await this.getEthBlockNumber(rpcUrl);

    return transfers.map((tx: any): ChainTx => ({
      hash: tx.hash,
      amount: parseFloat(tx.value),
      from: tx.from,
      to: tx.to,
      confirmations: currentBlock - parseInt(tx.blockNum, 16),
      timestamp: new Date(tx.metadata?.blockTimestamp).getTime(),
    }));
  }

  // ── BEP20 (BSC) ──────────────────────────────────────────────────────────
  private async checkBep20Transactions(address: string): Promise<ChainTx[]> {
    const rpcUrl = RPC_ENDPOINTS.BEP20;
    if (!rpcUrl) return [];

    // Look back ~500 blocks (~25 min on BSC) to avoid missing txs
    const currentBlock = await this.getEthBlockNumber(rpcUrl);
    const fromBlock = Math.max(0, currentBlock - 500);

    // USDT BEP20 contract: 0x55d398326f99059fF775485246999027B3197955
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getLogs',
        params: [{
          address: '0x55d398326f99059fF775485246999027B3197955',
          topics: [
            '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
            null,
            '0x' + address.slice(2).padStart(64, '0'),
          ],
          fromBlock: '0x' + fromBlock.toString(16),
          toBlock: 'latest',
        }],
        id: 1,
      }),
    });

    if (!response.ok) throw new Error(`BSC API error: ${response.status}`);

    const data = await response.json();
    const logs = data.result || [];

    return logs.map((logEntry: any): ChainTx => ({
      hash: logEntry.transactionHash,
      amount: parseInt(logEntry.data, 16) / 1e18,
      from: '0x' + logEntry.topics[1].slice(-40),
      to: '0x' + logEntry.topics[2].slice(-40),
      confirmations: currentBlock - parseInt(logEntry.blockNumber, 16),
      timestamp: Date.now(),
    }));
  }

  // ── SOL (Solana SPL Token) ───────────────────────────────────────────────
  private async checkSolTransactions(address: string): Promise<ChainTx[]> {
    const rpcUrl = RPC_ENDPOINTS.SOL;
    if (!rpcUrl) return [];

    const sigResponse = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'getSignaturesForAddress',
        params: [address, { limit: 10 }],
        id: 1,
      }),
    });

    if (!sigResponse.ok) throw new Error(`Solana API error: ${sigResponse.status}`);

    const sigData = await sigResponse.json();
    const signatures = sigData.result || [];
    const results: ChainTx[] = [];

    for (const sig of signatures) {
      const txResponse = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'getTransaction',
          params: [sig.signature, { encoding: 'jsonParsed' }],
          id: 1,
        }),
      });

      const txData = await txResponse.json();
      const tx = txData.result;
      if (!tx) continue;

      const transfers = this.parseSolUsdtTransfers(tx, address);
      for (const t of transfers) {
        results.push({
          hash: sig.signature,
          amount: t.amount,
          from: t.from,
          to: t.to,
          confirmations: sig.confirmationStatus === 'finalized' ? MIN_CONFIRMATIONS.SOL : 0,
          timestamp: (tx.blockTime || 0) * 1000,
        });
      }
    }

    return results;
  }

  // USDT mint on Solana: Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB
  private static readonly SOL_USDT_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';

  private parseSolUsdtTransfers(tx: any, recipient: string): { amount: number; from: string; to: string }[] {
    const transfers: { amount: number; from: string; to: string }[] = [];
    try {
      const instructions = tx.transaction?.message?.instructions || [];
      for (const ix of instructions) {
        if (ix.program === 'spl-token' && ix.parsed?.type === 'transfer') {
          const info = ix.parsed.info;
          if (info.destination === recipient) {
            transfers.push({
              amount: info.amount / 1e6,
              from: info.source,
              to: info.destination,
            });
          }
        }
      }
    } catch (err: any) {
      log.warn('[Payment] SOL transfer parse error:', err.message);
    }
    return transfers;
  }

  // Shared helper: get block number from EVM-compatible RPC
  private async getEthBlockNumber(rpcUrl: string): Promise<number> {
    try {
      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1 }),
      });
      const data = await response.json();
      return parseInt(data.result, 16);
    } catch {
      return 0;
    }
  }

  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    // Persist all orders before shutdown
    for (const order of this.orders.values()) {
      this.saveOrder(order);
    }
    log.info('[Payment] Stopped, all orders persisted');
  }
}

export { RECEIVE_ADDRESSES, MIN_CONFIRMATIONS, PAYMENT_TIMEOUT_MINUTES, USDT_PRICES };

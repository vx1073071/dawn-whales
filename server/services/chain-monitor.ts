/**
 * @deprecated v17.6 — Replaced by chain-monitor-v2.ts (exponential backoff, checkpoint resume, RPC failover).
 * This file is kept for reference only. Do NOT use in new code.
 * 
 * DAWN WHALES R142 J01+J04 — On-chain Monitor + Deposit Address Service
 * 
 * Monitors TRC-20 (Tron) and ERC-20 (Ethereum) blockchains for incoming
 * USDT deposits. Auto-credits user wallets upon sufficient confirmations.
 * 
 * Blockchain coverage:
 *  - TRC-20 (Tron): 20 block confirmations (~1 min)
 *  - ERC-20 (Ethereum): 12 block confirmations (~2.4 min)
 * 
 * Deposit lifecycle:
 *   1. Generate unique deposit address per user (first deposit)
 *   2. Scan blocks every 15s (TRC-20) / 30s (ERC-20)
 *   3. Detect incoming USDT transfer to known addresses
 *   4. Wait for N confirmations
 *   5. Auto-credit wallet (DEPOSIT ledger entry, idempotent)
 *   6. Emit 'deposit:credited' event → WS push notification
 * 
 * Features:
 *  - Per-user unique deposit address (bound to userId)
 *  - Idempotent crediting (deposit address + tx hash = unique key)
 *  - Block confirmation tracking
 *  - Duplicate deposit detection
 *  - Gas estimation for withdrawals
 *  - Deposit address generation (placeholder — real impl uses HD wallet)
 *  - Health monitoring (last scanned block, lag)
 * 
 * ≥400L
 */

import { EventEmitter } from 'events';
import crypto from 'crypto';
import log from 'electron-log';

// ═══════════════ Types ═══════════════════════════════════════════════════

export type Chain = 'TRC-20' | 'ERC-20';

export interface ChainConfig {
  chain: Chain;
  rpcEndpoint: string;
  usdtContract: string;        // USDT contract address on this chain
  confirmationsRequired: number;
  scanIntervalMs: number;
  blockTimeSec: number;        // Average block time
  enabled: boolean;
}

export interface DepositAddress {
  userId: string;
  address: string;
  chain: Chain;
  createdAt: string;
  lastUsedAt: string;
  depositCount: number;
  totalDepositedUSDT: number;
}

export interface PendingDeposit {
  txHash: string;
  address: string;
  userId: string;
  chain: Chain;
  amountUSDT: number;
  blockNumber: number;
  confirmations: number;
  requiredConfirmations: number;
  firstSeenAt: number;
  credited: boolean;
}

export interface DepositEvent {
  txHash: string;
  userId: string;
  address: string;
  chain: Chain;
  amountUSDT: number;
  confirmations: number;
  creditedAt: string;
}

export interface MonitorStats {
  chain: Chain;
  lastScannedBlock: number;
  latestBlock: number;
  blockLag: number;
  pendingDeposits: number;
  totalDepositsDetected: number;
  totalDepositsCredited: number;
  lastScanAt: string;
  scanIntervalMs: number;
  enabled: boolean;
}

export interface GasEstimate {
  chain: Chain;
  gasPrice: string;    // Gwei
  gasLimit: number;
  estimatedFeeUSDT: number;
  estimatedTimeMin: number;
}

// ═══════════════ Default Configs ═════════════════════════════════════════

const TRC20_CONFIG: ChainConfig = {
  chain: 'TRC-20',
  rpcEndpoint: 'https://api.trongrid.io',
  usdtContract: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
  confirmationsRequired: 20,
  scanIntervalMs: 15_000,
  blockTimeSec: 3,
  enabled: true,
};

const ERC20_CONFIG: ChainConfig = {
  chain: 'ERC-20',
  rpcEndpoint: 'https://eth.llamarpc.com',
  usdtContract: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  confirmationsRequired: 12,
  scanIntervalMs: 30_000,
  blockTimeSec: 12,
  enabled: true,
};

// ═══════════════ Chain Monitor Service ═══════════════════════════════════

export class ChainMonitorService extends EventEmitter {
  private configs: Map<Chain, ChainConfig> = new Map();
  private depositAddresses: Map<string, DepositAddress> = new Map();  // address → deposit info
  private userAddresses: Map<string, DepositAddress[]> = new Map();   // userId → addresses
  private pendingDeposits: Map<string, PendingDeposit> = new Map();   // txHash → pending
  private creditedTxHashes: Set<string> = new Set();                  // prevent re-crediting
  private scanTimers: Map<Chain, ReturnType<typeof setInterval>> = new Map();
  private scanStates: Map<Chain, { lastBlock: number; running: boolean }> = new Map();
  private stats: Map<Chain, MonitorStats> = new Map();
  private running = false;

  constructor() {
    super();
    this.configs.set('TRC-20', { ...TRC20_CONFIG });
    this.configs.set('ERC-20', { ...ERC20_CONFIG });
    this.resetStats();
    log.info('[ChainMonitor] Initialized (TRC-20 + ERC-20)');
  }

  // ═══════════ Lifecycle ════════════════════════════════════════════

  start(): void {
    if (this.running) return;
    this.running = true;

    for (const [chain, config] of this.configs) {
      if (!config.enabled) continue;

      this.scanStates.set(chain, { lastBlock: 0, running: true });

      // Initial scan
      this.scanChain(chain).catch(err => {
        log.error(`[ChainMonitor] Initial ${chain} scan failed:`, err.message);
      });

      // Periodic scan
      const timer = setInterval(() => {
        this.scanChain(chain).catch(err => {
          log.error(`[ChainMonitor] ${chain} scan error:`, err.message);
        });
      }, config.scanIntervalMs);

      this.scanTimers.set(chain, timer);
      log.info(`[ChainMonitor] ${chain} monitoring started (interval: ${config.scanIntervalMs}ms)`);
    }
  }

  stop(): void {
    this.running = false;
    for (const [chain, timer] of this.scanTimers) {
      clearInterval(timer);
      this.scanTimers.delete(chain);
    }
    log.info('[ChainMonitor] Stopped');
  }

  // ═══════════ Config ═════════════════════════════════════════════

  getChainConfig(chain: Chain): ChainConfig {
    return { ...this.configs.get(chain)! };
  }

  updateChainConfig(chain: Chain, updates: Partial<ChainConfig>): void {
    const cfg = this.configs.get(chain);
    if (!cfg) return;
    Object.assign(cfg, updates);
    this.configs.set(chain, cfg);
  }

  enableChain(chain: Chain): void {
    const cfg = this.configs.get(chain);
    if (cfg) cfg.enabled = true;
  }

  disableChain(chain: Chain): void {
    const cfg = this.configs.get(chain);
    if (cfg) cfg.enabled = false;
  }

  isChainEnabled(chain: Chain): boolean {
    return this.configs.get(chain)?.enabled ?? false;
  }

  // ═══════════ Deposit Address Generation ═════════════════════════

  /**
   * Generate (or retrieve) a deposit address for a user on a specific chain.
   * In production, this uses an HD wallet (BIP44) to derive per-user addresses.
   * For MVP, generates a deterministic address from userId + chain.
   */
  generateDepositAddress(userId: string, chain: Chain): DepositAddress {
    // Check existing
    const existing = this.userAddresses.get(userId)?.find(a => a.chain === chain);
    if (existing) {
      existing.lastUsedAt = new Date().toISOString();
      return existing;
    }

    // Generate deterministic address (MVP placeholder)
    // Real impl: HD wallet derivation path m/44'/60'/0'/0/${userIndex}
    const seed = crypto.createHash('sha256').update(`${chain}:${userId}:dawnwhales`).digest('hex');

    let address: string;
    if (chain === 'TRC-20') {
      address = 'T' + seed.substring(0, 33);
    } else {
      address = '0x' + seed.substring(0, 40);
    }

    const deposit: DepositAddress = {
      userId,
      address,
      chain,
      createdAt: new Date().toISOString(),
      lastUsedAt: new Date().toISOString(),
      depositCount: 0,
      totalDepositedUSDT: 0,
    };

    this.depositAddresses.set(address, deposit);
    if (!this.userAddresses.has(userId)) {
      this.userAddresses.set(userId, []);
    }
    this.userAddresses.get(userId)!.push(deposit);

    log.info(`[ChainMonitor] Deposit address generated: ${userId}/${chain}/${address}`);
    this.emit('address:generated', deposit);
    return deposit;
  }

  getUserDepositAddress(userId: string, chain: Chain): DepositAddress | null {
    return this.userAddresses.get(userId)?.find(a => a.chain === chain) || null;
  }

  getAllUserAddresses(userId: string): DepositAddress[] {
    return [...(this.userAddresses.get(userId) || [])];
  }

  findByAddress(address: string): DepositAddress | null {
    return this.depositAddresses.get(address) || null;
  }

  // ═══════════ Block Scanning ═════════════════════════════════════

  private async scanChain(chain: Chain): Promise<void> {
    const config = this.configs.get(chain);
    if (!config || !config.enabled) return;

    const state = this.scanStates.get(chain);
    if (!state) return;

    try {
      // In production, call RPC:
      // const latestBlock = await this.fetchLatestBlock(config.rpcEndpoint);
      // const txs = await this.fetchDepositTransactions(config, state.lastBlock + 1, latestBlock);

      // MVP: simulate block scan
      const latestBlock = this.simulateLatestBlock(chain, state.lastBlock);
      const txs = this.simulateScanTransactions(config, state.lastBlock + 1, latestBlock);

      // Process detected deposits
      for (const tx of txs) {
        this.processDepositTx(tx);
      }

      // Check pending deposits for sufficient confirmations
      this.checkPendingConfirmations(chain, latestBlock);

      // Update scan state
      state.lastBlock = latestBlock;
      const stats = this.stats.get(chain)!;
      stats.lastScannedBlock = latestBlock;
      stats.latestBlock = latestBlock;
      stats.blockLag = 0;
      stats.pendingDeposits = Array.from(this.pendingDeposits.values())
        .filter(d => d.chain === chain && !d.credited).length;
      stats.lastScanAt = new Date().toISOString();
    } catch (err: any) {
      log.error(`[ChainMonitor] ${chain} scan failed:`, err.message);
    }
  }

  private processDepositTx(tx: PendingDeposit): void {
    // Check if address belongs to a known user
    const depositInfo = this.depositAddresses.get(tx.address);
    if (!depositInfo) return;  // Not our address

    // Check if already processed
    if (this.creditedTxHashes.has(tx.txHash)) return;

    // Check if already pending
    if (this.pendingDeposits.has(tx.txHash)) {
      // Update confirmations
      const existing = this.pendingDeposits.get(tx.txHash)!;
      existing.confirmations = tx.confirmations;
      return;
    }

    // New pending deposit
    tx.userId = depositInfo.userId;
    tx.requiredConfirmations = this.configs.get(tx.chain)!.confirmationsRequired;
    tx.firstSeenAt = Date.now();
    this.pendingDeposits.set(tx.txHash, tx);

    const stats = this.stats.get(tx.chain)!;
    stats.totalDepositsDetected++;

    log.info(`[ChainMonitor] New deposit detected: ${tx.chain}/${tx.txHash} — ${tx.amountUSDT} USDT → ${tx.address} (user ${tx.userId})`);
    this.emit('deposit:detected', tx);
  }

  private checkPendingConfirmations(chain: Chain, latestBlock: number): void {
    const config = this.configs.get(chain)!;

    for (const [txHash, deposit] of this.pendingDeposits) {
      if (deposit.chain !== chain || deposit.credited) continue;

      const newConfirmations = Math.max(0, latestBlock - deposit.blockNumber + 1);
      deposit.confirmations = newConfirmations;

      if (newConfirmations >= deposit.requiredConfirmations) {
        this.creditDeposit(deposit);
      }
    }
  }

  /**
   * Credit a confirmed deposit to the user's wallet.
   * This is called automatically when the required confirmations are met.
   */
  creditDeposit(deposit: PendingDeposit): void {
    if (this.creditedTxHashes.has(deposit.txHash)) return;

    // Mark as credited
    deposit.credited = true;
    this.creditedTxHashes.add(deposit.txHash);

    // Update deposit address stats
    const depositInfo = this.depositAddresses.get(deposit.address);
    if (depositInfo) {
      depositInfo.depositCount++;
      depositInfo.totalDepositedUSDT = roundUSD(depositInfo.totalDepositedUSDT + deposit.amountUSDT);
    }

    const stats = this.stats.get(deposit.chain)!;
    stats.totalDepositsCredited++;

    const event: DepositEvent = {
      txHash: deposit.txHash,
      userId: deposit.userId,
      address: deposit.address,
      chain: deposit.chain,
      amountUSDT: deposit.amountUSDT,
      confirmations: deposit.confirmations,
      creditedAt: new Date().toISOString(),
    };

    log.info(`[ChainMonitor] Deposit CREDITED: ${deposit.chain}/${deposit.txHash} — ${deposit.amountUSDT} USDT → user ${deposit.userId} (${deposit.confirmations} confirmations)`);

    // Emit event for server to:
    // 1. Credit wallet balance
    // 2. Write DEPOSIT ledger entry (idempotent key = txHash)
    // 3. Push notification to user
    this.emit('deposit:credited', event);
  }

  // ═══════════ Gas Estimation ════════════════════════════════════

  /**
   * Estimate gas for a withdrawal transaction.
   * Returns gas price, limit, estimated fee, and estimated time.
   */
  estimateGas(chain: Chain): GasEstimate {
    if (chain === 'TRC-20') {
      return {
        chain: 'TRC-20',
        gasPrice: '0',        // TRC-20 uses bandwidth/energy, not gas
        gasLimit: 0,
        estimatedFeeUSDT: 0,  // Platform subsidizes TRC-20 gas
        estimatedTimeMin: 2,
      };
    }

    // ERC-20: ~$3-8 per transfer in gas
    return {
      chain: 'ERC-20',
      gasPrice: '25',         // 25 Gwei average
      gasLimit: 65000,        // USDT transfer ~65k gas
      estimatedFeeUSDT: 3.5,  // ~$3.5 at current rates
      estimatedTimeMin: 5,
    };
  }

  // ═══════════ Stats ══════════════════════════════════════════════

  getStats(chain?: Chain): MonitorStats[] {
    if (chain) {
      const s = this.stats.get(chain);
      return s ? [{ ...s }] : [];
    }
    return Array.from(this.stats.values()).map(s => ({ ...s }));
  }

  resetStats(): void {
    this.stats.clear();
    for (const [chain, config] of this.configs) {
      this.stats.set(chain, {
        chain,
        lastScannedBlock: 0,
        latestBlock: 0,
        blockLag: 0,
        pendingDeposits: 0,
        totalDepositsDetected: 0,
        totalDepositsCredited: 0,
        lastScanAt: '',
        scanIntervalMs: config.scanIntervalMs,
        enabled: config.enabled,
      });
    }
  }

  // ═══════════ Simulation (MVP) ══════════════════════════════════

  private simulateLatestBlock(chain: Chain, currentLast: number): number {
    // Simulate ~1 block per scan for MVP testing
    const inc = chain === 'TRC-20' ? 2 : 1; // TRC-20 is faster
    return currentLast + inc;
  }

  private simulateScanTransactions(
    config: ChainConfig,
    fromBlock: number,
    toBlock: number,
  ): PendingDeposit[] {
    // In production, query RPC for USDT transfer events.
    // For MVP, return empty (no simulated deposits).
    // Real implementation:
    //   const filter = { address: config.usdtContract, fromBlock, toBlock, topics: [transferEvent] };
    //   const logs = await rpcCall('eth_getLogs', [filter]);
    //   parse logs → PendingDeposit[]
    return [];
  }

  // ═══════════ Dispose ═══════════════════════════════════════════

  dispose(): void {
    this.stop();
    this.depositAddresses.clear();
    this.userAddresses.clear();
    this.pendingDeposits.clear();
    this.creditedTxHashes.clear();
    this.removeAllListeners();
  }
}

// ═══════════════ Helper ═══════════════════════════════════════════════════

function roundUSD(amount: number): number {
  return Math.round(amount * 10000) / 10000;
}

// ═══════════════ Singleton ═══════════════════════════════════════════════

let _chainMonitor: ChainMonitorService | null = null;

export function getChainMonitorService(): ChainMonitorService {
  if (!_chainMonitor) _chainMonitor = new ChainMonitorService();
  return _chainMonitor;
}

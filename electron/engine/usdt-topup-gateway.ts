/**
 * J-59-03: USDT Topup Gateway (R59 v19)
 * TRC-20 transfer gateway for creator USDT deposit
 *
 * Features:
 * - TRC-20 transfer: generate address + QR + on-chain confirmation
 * - Topup records: channel + amount + tx hash + confirm status
 * - Delay ≤30 min confirmation time
 * - USDT/CNY exchange rate: 7.2 (from revenue-engine-v15)
 * - Internal transfer between creators
 *
 * ≥300L, 8 tests
 */

import { EventEmitter } from 'events';
import crypto from 'crypto';

// ── Types ──────────────────────────────────────────────────────────────────

export type TopupChannel = 'trc20' | 'internal';

export type TopupStatus = 'pending' | 'confirming' | 'confirmed' | 'failed';

export interface TopupRecord {
  id: string;
  creator: string;
  channel: TopupChannel;
  amountUSDT: number;
  txHash?: string;               // TRC-20 transaction hash
  fromAddress?: string;
  toAddress: string;             // platform's receiving address
  status: TopupStatus;
  confirmations: number;         // blockchain confirmations (0-19 for TRC-20)
  requiredConfirmations: number; // usually 19 for TRC-20
  requestedAt: string;
  confirmedAt?: string;
  errorMessage?: string;
}

export interface PlatformWallet {
  address: string;               // TRC-20 receiving address
  label: string;
  totalReceivedUSDT: number;
}

export interface InternalTransfer {
  id: string;
  fromCreator: string;
  toCreator: string;
  amountUSDT: number;
  status: 'pending' | 'completed' | 'failed';
  timestamp: string;
  description?: string;
}

// ── USDT Topup Gateway ─────────────────────────────────────────────────────

export class USDTTopupGateway extends EventEmitter {
  private topupRecords: TopupRecord[] = [];
  private internalTransfers: InternalTransfer[] = [];
  private platformWallets: PlatformWallet[] = [];
  private txCounter = 1;
  private transferCounter = 1;

  constructor() {
    super();
    // Generate a mock platform TRC-20 address
    this.platformWallets.push({
      address: 'TPLaTf' + crypto.randomBytes(10).toString('hex').substring(0, 28),
      label: 'Default Platform Wallet',
      totalReceivedUSDT: 0,
    });
  }

  /**
   * Initiate TRC-20 topup
   */
  initiateTopup(
    creator: string,
    amountUSDT: number,
    channel: TopupChannel = 'trc20',
    fromAddress?: string,
  ): TopupRecord {
    if (amountUSDT <= 0) throw new Error('Amount must be positive');

    const wallet = this.platformWallets[0]; // default wallet
    const record: TopupRecord = {
      id: `TOPUP-${this.txCounter++}-${Date.now()}`,
      creator,
      channel,
      amountUSDT,
      fromAddress,
      toAddress: wallet.address,
      status: 'pending',
      confirmations: 0,
      requiredConfirmations: channel === 'trc20' ? 19 : 1,
      requestedAt: new Date().toISOString(),
    };

    this.topupRecords.push(record);
    this.emit('topup:initiated', record);

    // Auto-simulate confirmation for MVP (real impl would poll chain)
    if (channel === 'trc20') {
      setTimeout(() => this.simulateConfirmation(record.id), 30000); // 30s delay sim
    }

    return record;
  }

  /**
   * Simulate blockchain confirmation (MVP only)
   */
  private simulateConfirmation(recordId: string): void {
    const record = this.topupRecords.find(r => r.id === recordId);
    if (!record || record.status !== 'pending') return;

    record.status = 'confirming';
    record.txHash = '0x' + crypto.randomBytes(32).toString('hex');
    record.confirmations = 19;
    this.confirmTopup(recordId);
  }

  /**
   * Confirm a topup (called by on-chain confirmation or simulate)
   */
  confirmTopup(recordId: string): TopupRecord {
    const record = this.topupRecords.find(r => r.id === recordId);
    if (!record) throw new Error(`Topup not found: ${recordId}`);

    record.status = 'confirmed';
    record.confirmedAt = new Date().toISOString();

    // Update platform wallet stats
    const wallet = this.platformWallets.find(w => w.address === record.toAddress);
    if (wallet) {
      wallet.totalReceivedUSDT = Math.round((wallet.totalReceivedUSDT + record.amountUSDT) * 1000000) / 1000000;
    }

    this.emit('topup:confirmed', record);
    return record;
  }

  /**
   * Mark topup as failed
   */
  failTopup(recordId: string, error: string): TopupRecord {
    const record = this.topupRecords.find(r => r.id === recordId);
    if (!record) throw new Error(`Topup not found: ${recordId}`);

    record.status = 'failed';
    record.errorMessage = error;
    this.emit('topup:failed', record);
    return record;
  }

  /**
   * Internal transfer between creators
   */
  internalTransfer(fromCreator: string, toCreator: string, amountUSDT: number, description?: string): InternalTransfer {
    if (amountUSDT <= 0) throw new Error('Amount must be positive');
    if (fromCreator === toCreator) throw new Error('Cannot transfer to self');

    const transfer: InternalTransfer = {
      id: `XFER-${this.transferCounter++}-${Date.now()}`,
      fromCreator,
      toCreator,
      amountUSDT,
      status: 'completed', // MVP: immediate transfer
      timestamp: new Date().toISOString(),
      description,
    };

    this.internalTransfers.push(transfer);
    this.emit('transfer:completed', transfer);
    return transfer;
  }

  /**
   * Get creator's topup history
   */
  getCreatorTopups(creator: string): TopupRecord[] {
    return this.topupRecords.filter(r => r.creator === creator);
  }

  /**
   * Get creator's total deposited
   */
  getCreatorTotalDeposited(creator: string): number {
    return Math.round(
      this.topupRecords
        .filter(r => r.creator === creator && r.status === 'confirmed')
        .reduce((s, r) => s + r.amountUSDT, 0) * 1000000,
    ) / 1000000;
  }

  /**
   * Get platform wallet info (for QR/address display)
   */
  getPlatformWallet(): PlatformWallet {
    return { ...this.platformWallets[0] };
  }

  /**
   * Get all platform wallets
   */
  getAllPlatformWallets(): PlatformWallet[] {
    return [...this.platformWallets];
  }

  /**
   * Convert USDT to CNY (display only)
   */
  usdtToCny(usdt: number): number {
    return Math.round(usdt * 7.2 * 100) / 100;
  }

  /**
   * Convert CNY to USDT (display only)
   */
  cnyToUsdt(cny: number): number {
    return Math.round((cny / 7.2) * 100) / 100;
  }

  /**
   * Get exchange rate
   */
  getExchangeRate(): number {
    return 7.2;
  }

  /**
   * Get all topup records
   */
  getAllTopups(): TopupRecord[] {
    return [...this.topupRecords];
  }

  /**
   * Get internal transfers
   */
  getInternalTransfers(creator?: string): InternalTransfer[] {
    if (creator) {
      return this.internalTransfers.filter(t => t.fromCreator === creator || t.toCreator === creator);
    }
    return [...this.internalTransfers];
  }

  /**
   * Check confirmation timeout (30min)
   */
  checkConfirmationTimeout(): { record: TopupRecord; minutesWaiting: number }[] {
    const now = new Date();
    const timedOut: { record: TopupRecord; minutesWaiting: number }[] = [];

    for (const record of this.topupRecords) {
      if (record.status !== 'pending') continue;
      const minutesWaiting = (now.getTime() - new Date(record.requestedAt).getTime()) / (1000 * 60);
      if (minutesWaiting > 30) {
        timedOut.push({ record, minutesWaiting });
      }
    }

    return timedOut;
  }

  reset(): void {
    this.topupRecords = [];
    this.internalTransfers = [];
    this.txCounter = 1;
    this.transferCounter = 1;
    this.removeAllListeners();
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let _gatewayInstance: USDTTopupGateway | null = null;

export function getTopupGateway(): USDTTopupGateway {
  if (!_gatewayInstance) _gatewayInstance = new USDTTopupGateway();
  return _gatewayInstance;
}

export function resetTopupGateway(): void {
  _gatewayInstance?.reset();
  _gatewayInstance = null;
}

export default { USDTTopupGateway, getTopupGateway, resetTopupGateway };

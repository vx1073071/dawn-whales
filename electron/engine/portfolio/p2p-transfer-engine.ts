/**
import { EngineError, ErrorCode } from '../../errors';

 * J-78-03: P2Ppointstransfer ( — transfer)
 * v1.9.0: p2p-transfer-engine, →p2p-dispute, →p2p-freeze, →blacklist-manager
 */

export interface P2PTransferRequest { fromUserId: string; toUserId: string; amount: number; note?: string; }

export interface P2PTransfer {
  id: string; fromUserId: string; toUserId: string; amount: number;
  feeAmount: number; netAmount: number; feeRate: number; status: TransferStatus;
  note?: string; createdAt: string; frozenUntil: string;
  resolvedAt?: string; resolvedBy?: string;
  resolutionType?: 'auto_release' | 'buyer_cancel' | 'admin_unfreeze' | 'appealed';
}

export type TransferStatus = 'pending' | 'frozen' | 'released' | 'frozen_permanent' | 'cancelled';

export interface TransferFilter { userId?: string; status?: TransferStatus; fromDate?: string; toDate?: string; limit?: number; offset?: number; }

export interface BalanceChangeLog { id: string; userId: string; changeAmount: number; balanceAfter: number; type: 'transfer_out' | 'transfer_in' | 'fee_collect' | 'fee_platform'; relatedTransferId: string; timestamp: string; }

export interface P2PConfig { feeRate: number; freezePeriodDays: number; maxTransferPerDay: number; maxTransferAmount: number; newAccountMaxAmount: number; newAccountPeriodDays: number; largeTransferThreshold: number; }

export const DEFAULT_P2P_CONFIG: P2PConfig = { feeRate: 0.003, freezePeriodDays: 14, maxTransferPerDay: 0, maxTransferAmount: 0, newAccountMaxAmount: 500, newAccountPeriodDays: 7, largeTransferThreshold: 1000 };

export class P2PTransferEngine {
  private transfers = new Map<string, P2PTransfer>();
  private balanceLogs: BalanceChangeLog[] = [];
  private config: P2PConfig;
  private users = new Map<string, { balance: number; registeredAt: string }>();

  constructor(config: Partial<P2PConfig> = {}) { this.config = { ...DEFAULT_P2P_CONFIG, ...config }; }

  registerUser(userId: string, initialBalance = 0, registeredAt?: string): void { this.users.set(userId, { balance: initialBalance, registeredAt: registeredAt ?? new Date().toISOString() }); }
  getUserBalance(userId: string): number { return this.users.get(userId)?.balance ?? 0; }
  getUserRegisteredAt(userId: string): string | undefined { return this.users.get(userId)?.registeredAt; }
  userExists(userId: string): boolean { return this.users.has(userId); }
  getAllUsers(): string[] { return [...this.users.keys()]; }

  createTransfer(req: P2PTransferRequest): { transfer: P2PTransfer; warnings: string[] } {
    const warnings: string[] = [];
    const from = this.users.get(req.fromUserId); const to = this.users.get(req.toUserId);
    if (!from) throw new EngineError(ErrorCode.INTERNAL_ERROR, `Sender ${req.fromUserId} not found`);
    if (!to) throw new EngineError(ErrorCode.INTERNAL_ERROR, `Recipient ${req.toUserId} not found`);
    if (req.fromUserId === req.toUserId) throw new EngineError(ErrorCode.INTERNAL_ERROR, 'Cannot transfer to self');
    if (req.amount <= 0) throw new EngineError(ErrorCode.INTERNAL_ERROR, 'Transfer amount must be positive');
    if (from.balance < req.amount) throw new EngineError(ErrorCode.INTERNAL_ERROR, 'Insufficient balance');
    const accountAgeDays = (Date.now() - new Date(from.registeredAt).getTime()) / 86400000;
    if (accountAgeDays < this.config.newAccountPeriodDays && req.amount > this.config.newAccountMaxAmount)
      throw new EngineError(ErrorCode.INTERNAL_ERROR, `New account limit: max ${this.config.newAccountMaxAmount} USDT`);
    if (this.config.maxTransferAmount > 0 && req.amount > this.config.maxTransferAmount)
      throw new EngineError(ErrorCode.INTERNAL_ERROR, `Transfer exceeds max amount: ${this.config.maxTransferAmount}`);
    if (this.config.maxTransferPerDay > 0) {
      const today = new Date().toISOString().substring(0, 10);
      const count = [...this.transfers.values()].filter(t => t.fromUserId === req.fromUserId && t.createdAt.startsWith(today)).length;
      if (count >= this.config.maxTransferPerDay) throw new EngineError(ErrorCode.INTERNAL_ERROR, `Daily limit reached: ${this.config.maxTransferPerDay}`);
    }
    if (req.amount >= this.config.largeTransferThreshold) warnings.push(`Large transfer: ${req.amount} USDT`);

    const feeAmount = Math.round(req.amount * this.config.feeRate * 100) / 100;
    const netAmount = req.amount - feeAmount;
    const now = new Date().toISOString();
    const frozenUntil = new Date(Date.now() + this.config.freezePeriodDays * 86400000).toISOString();

    const transfer: P2PTransfer = {
      id: `P2P-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      fromUserId: req.fromUserId, toUserId: req.toUserId, amount: req.amount,
      feeAmount, netAmount, feeRate: this.config.feeRate, status: 'frozen',
      note: req.note, createdAt: now, frozenUntil,
    };
    this.transfers.set(transfer.id, transfer);
    from.balance -= req.amount;
    this.users.set(req.fromUserId, from);
    this.logBalanceChange(req.fromUserId, -req.amount, from.balance, 'transfer_out', transfer.id);
    return { transfer, warnings };
  }

  releaseTransfer(transferId: string, releaseType: 'auto_release' | 'buyer_cancel' | 'admin_unfreeze' = 'auto_release', releasedBy?: string): P2PTransfer {
    const transfer = this.transfers.get(transferId);
    if (!transfer) throw new EngineError(ErrorCode.INTERNAL_ERROR, `Transfer ${transferId} not found`);
    if (transfer.status !== 'frozen') throw new EngineError(ErrorCode.INTERNAL_ERROR, `Cannot release transfer in status: ${transfer.status}`);
    const to = this.users.get(transfer.toUserId);
    if (to) { to.balance += transfer.netAmount; this.users.set(transfer.toUserId, to); this.logBalanceChange(transfer.toUserId, transfer.netAmount, to.balance, 'transfer_in', transfer.id); }
    this.logBalanceChange('PLATFORM', transfer.feeAmount, 0, 'fee_platform', transfer.id);
    transfer.status = 'released'; transfer.resolvedAt = new Date().toISOString(); transfer.resolvedBy = releasedBy; transfer.resolutionType = releaseType;
    this.transfers.set(transferId, transfer);
    return transfer;
  }

  cancelTransfer(transferId: string, cancelledBy: string): P2PTransfer {
    const transfer = this.transfers.get(transferId);
    if (!transfer) throw new EngineError(ErrorCode.INTERNAL_ERROR, `Transfer ${transferId} not found`);
    if (transfer.status !== 'frozen') throw new EngineError(ErrorCode.INTERNAL_ERROR, `Cannot cancel transfer in status: ${transfer.status}`);
    const from = this.users.get(transfer.fromUserId);
    if (from) { from.balance += transfer.amount; this.users.set(transfer.fromUserId, from); this.logBalanceChange(transfer.fromUserId, transfer.amount, from.balance, 'transfer_out', transfer.id); }
    transfer.status = 'cancelled'; transfer.resolvedAt = new Date().toISOString(); transfer.resolvedBy = cancelledBy; transfer.resolutionType = 'buyer_cancel';
    this.transfers.set(transferId, transfer);
    return transfer;
  }

  releaseExpiredTransfers(): number {
    const now = Date.now(); let count = 0;
    for (const [id, t] of this.transfers) {
      if (t.status === 'frozen' && new Date(t.frozenUntil).getTime() <= now) { this.releaseTransfer(id, 'auto_release', 'SYSTEM'); count++; }
    }
    return count;
  }

  getTransfer(transferId: string): P2PTransfer | undefined { return this.transfers.get(transferId); }
  getAllTransfers(): P2PTransfer[] { return [...this.transfers.values()].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); }

  listTransfers(filter: TransferFilter = {}): P2PTransfer[] {
    let results = [...this.transfers.values()];
    if (filter.userId) results = results.filter(t => t.fromUserId === filter.userId || t.toUserId === filter.userId);
    if (filter.status) results = results.filter(t => t.status === filter.status);
    if (filter.fromDate) results = results.filter(t => new Date(t.createdAt) >= new Date(filter.fromDate!));
    if (filter.toDate) results = results.filter(t => new Date(t.createdAt) <= new Date(filter.toDate!));
    results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return results.slice(filter.offset ?? 0, (filter.offset ?? 0) + (filter.limit ?? 50));
  }

  getBalanceLogs(userId?: string, limit = 50): BalanceChangeLog[] { let logs = [...this.balanceLogs].reverse(); if (userId) logs = logs.filter(l => l.userId === userId); return logs.slice(0, limit); }
  updateConfig(patch: Partial<P2PConfig>): P2PConfig { Object.assign(this.config, patch); return this.config; }
  getConfig(): P2PConfig { return { ...this.config }; }

  private logBalanceChange(userId: string, changeAmount: number, balanceAfter: number, type: BalanceChangeLog['type'], relatedTransferId: string): void {
    this.balanceLogs.push({ id: `BAL-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, userId, changeAmount, balanceAfter, type, relatedTransferId, timestamp: new Date().toISOString() });
  }

  reset(): void { this.transfers.clear(); this.balanceLogs = []; this.users.clear(); this.config = { ...DEFAULT_P2P_CONFIG }; }
}

let _p2pEngine: P2PTransferEngine | null = null;
export function getP2PEngine(): P2PTransferEngine { if (!_p2pEngine) _p2pEngine = new P2PTransferEngine(); return _p2pEngine; }
export function resetP2PEngine(): void { _p2pEngine?.reset(); _p2pEngine = null; }
export default { P2PTransferEngine, getP2PEngine, resetP2PEngine, DEFAULT_P2P_CONFIG };

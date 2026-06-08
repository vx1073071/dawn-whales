/**
 * J-62-02: 申诉系统+管理员解冻 (R62 v19 — v1.5.0-alpha)
 *
 * v15基建: Appeal system with 4 selectable reasons, buyer-cancel unlock,
 * admin-hidden unfreeze, full audit trail.
 *
 * Features:
 * - 4 appeal reasons: 收款未确认/未按约定/账号异常/其他(必填描述)
 * - Interacts with P2P transfer freeze: appeal → permanent freeze
 * - Buyer cancel: unfreeze → auto-release funds to sender (no fee)
 * - Admin unfreeze: hidden backend, system-anomaly only, full audit log
 * - Appeal records: reason/time/status/operator full chain
 * - Platform DOES NOT arbitrate (only notify + freeze)
 *
 * >=300L, 8 tests
 */

// ── Types ──────────────────────────────────────────────────────────────────

export type AppealReason =
  | 'payment_not_confirmed'
  | 'not_as_agreed'
  | 'account_abnormal'
  | 'other';

export const APPEAL_REASONS: { value: AppealReason; label: string }[] = [
  { value: 'payment_not_confirmed', label: '收款未确认' },
  { value: 'not_as_agreed', label: '未按约定' },
  { value: 'account_abnormal', label: '账号异常' },
  { value: 'other', label: '其他' },
];

export interface AppealRecord {
  id: string;
  transferId: string;
  appealedBy: string;
  reason: AppealReason;
  description: string;
  status: AppealStatus;
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolution?: string;
}

export type AppealStatus = 'open' | 'resolved';

export interface AdminUnfreezeLog {
  id: string;
  transferId: string;
  adminId: string;
  reason: string;
  timestamp: string;
  previousStatus: string;
}

// ── Appeal Engine ─────────────────────────────────────────────────────────

export class AppealEngine {
  private appeals: Map<string, AppealRecord> = new Map();
  private adminLogs: AdminUnfreezeLog[] = [];
  // transferId → { status, isAppealed }
  private transferState: Map<string, { status: string; appealed: boolean }> = new Map();

  // ── Appeal Operations ───────────────────────────────────────────────────

  /**
   * File an appeal. Only possible while transfer is frozen.
   */
  fileAppeal(
    transferId: string,
    appealedBy: string,
    reason: AppealReason,
    description: string
  ): AppealRecord {
    const state = this.transferState.get(transferId);
    if (!state) throw new Error(`Transfer ${transferId} not found`);

    if (state.status !== 'frozen') {
      throw new Error(`Cannot appeal transfer in status: ${state.status}. Must be frozen.`);
    }

    if (state.appealed) {
      throw new Error(`Transfer ${transferId} already appealed`);
    }

    if (reason === 'other' && !description.trim()) {
      throw new Error('Description required for "other" appeal reason');
    }

    // Permanent freeze
    state.status = 'frozen_permanent';
    state.appealed = true;
    this.transferState.set(transferId, state);

    const appeal: AppealRecord = {
      id: `APL-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      transferId,
      appealedBy,
      reason,
      description,
      status: 'open',
      createdAt: new Date().toISOString(),
    };

    this.appeals.set(appeal.id, appeal);
    return appeal;
  }

  /**
   * Buyer cancels the transfer → unfreeze auto-release.
   * Buyer = the sender (fromUserId) of the transfer.
   */
  cancelUnfreeze(transferId: string, cancelledBy: string): { status: string } {
    const state = this.transferState.get(transferId);
    if (!state) throw new Error(`Transfer ${transferId} not found`);

    if (state.status !== 'frozen') {
      throw new Error(`Cannot cancel-unfreeze transfer in status: ${state.status}`);
    }

    state.status = 'cancelled';
    this.transferState.set(transferId, state);

    return { status: 'cancelled' };
  }

  /**
   * Admin hidden unfreeze: system anomaly only, full audit log.
   */
  adminUnfreeze(transferId: string, adminId: string, reason: string): AdminUnfreezeLog {
    const state = this.transferState.get(transferId);
    if (!state) throw new Error(`Transfer ${transferId} not found`);

    const log: AdminUnfreezeLog = {
      id: `ADM-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      transferId,
      adminId,
      reason,
      timestamp: new Date().toISOString(),
      previousStatus: state.status,
    };

    state.status = 'released';
    this.transferState.set(transferId, state);
    this.adminLogs.push(log);

    return log;
  }

  /**
   * Resolve an open appeal (close without action).
   */
  resolveAppeal(appealId: string, resolvedBy: string, resolution: string): AppealRecord {
    const appeal = this.appeals.get(appealId);
    if (!appeal) throw new Error(`Appeal ${appealId} not found`);
    if (appeal.status === 'resolved') throw new Error(`Appeal already resolved`);

    appeal.status = 'resolved';
    appeal.resolvedAt = new Date().toISOString();
    appeal.resolvedBy = resolvedBy;
    appeal.resolution = resolution;
    this.appeals.set(appealId, appeal);

    return appeal;
  }

  // ── Transfer State Management ───────────────────────────────────────────

  /**
   * Register a transfer in the appeal system (called when P2P transfer is created).
   */
  registerTransfer(transferId: string, status: string = 'frozen'): void {
    this.transferState.set(transferId, { status, appealed: false });
  }

  updateTransferStatus(transferId: string, status: string): void {
    const state = this.transferState.get(transferId);
    if (state) {
      state.status = status;
      this.transferState.set(transferId, state);
    }
  }

  isAppealed(transferId: string): boolean {
    return this.transferState.get(transferId)?.appealed ?? false;
  }

  getTransferStatus(transferId: string): string | undefined {
    return this.transferState.get(transferId)?.status;
  }

  // ── Queries ─────────────────────────────────────────────────────────────

  getAppeal(appealId: string): AppealRecord | undefined {
    return this.appeals.get(appealId);
  }

  listAppeals(filter?: {
    status?: AppealStatus;
    transferId?: string;
    appealedBy?: string;
  }): AppealRecord[] {
    let results = [...this.appeals.values()];
    if (filter?.status) results = results.filter(a => a.status === filter.status);
    if (filter?.transferId) results = results.filter(a => a.transferId === filter.transferId);
    if (filter?.appealedBy) results = results.filter(a => a.appealedBy === filter.appealedBy);
    results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return results;
  }

  getAdminLogs(limit: number = 50): AdminUnfreezeLog[] {
    return this.adminLogs.slice(-limit).reverse();
  }

  getAdminLogsByTransfer(transferId: string): AdminUnfreezeLog[] {
    return this.adminLogs.filter(l => l.transferId === transferId).reverse();
  }

  // ── Statistics ──────────────────────────────────────────────────────────

  getAppealStats(): { total: number; open: number; resolved: number; byReason: Record<string, number> } {
    const all = [...this.appeals.values()];
    const byReason: Record<string, number> = {};
    for (const a of all) {
      byReason[a.reason] = (byReason[a.reason] ?? 0) + 1;
    }
    return {
      total: all.length,
      open: all.filter(a => a.status === 'open').length,
      resolved: all.filter(a => a.status === 'resolved').length,
      byReason,
    };
  }

  // ── Reset ──────────────────────────────────────────────────────────────

  reset(): void {
    this.appeals.clear();
    this.adminLogs = [];
    this.transferState.clear();
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let _appealEngine: AppealEngine | null = null;

export function getAppealEngine(): AppealEngine {
  if (!_appealEngine) _appealEngine = new AppealEngine();
  return _appealEngine;
}

export function resetAppealEngine(): void {
  _appealEngine?.reset();
  _appealEngine = null;
}

export default { AppealEngine, getAppealEngine, resetAppealEngine, APPEAL_REASONS };

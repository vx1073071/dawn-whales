/**
import { EngineError, ErrorCode } from '../errors';

 * J-78-03-2: p2p-dispute-engine.ts — P2P争议申诉引擎
 * v1.9.0: 拆分自p2p-transfer-engine
 *
 * 争议申诉: 4选1原因 + 买方取消解锁 + 申诉流转
 */

export type DisputeReason = 'goods_not_received' | 'goods_damaged' | 'wrong_amount' | 'fraud_suspected' | 'other';

export interface DisputeRecord {
  id: string;
  transferId: string;
  fromUserId: string;
  toUserId: string;
  reason: DisputeReason;
  detail: string;
  status: 'open' | 'resolved_buyer' | 'resolved_seller' | 'resolved_admin' | 'closed';
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
  adminNote?: string;
  evidenceUrls: string[];
}

const DISPUTE_REASON_LABELS: Record<DisputeReason, string> = {
  goods_not_received: '未收到商品/服务',
  goods_damaged: '商品/服务与描述不符',
  wrong_amount: '金额不正确',
  fraud_suspected: '疑似欺诈',
  other: '其他原因',
};

export class P2PDisputeEngine {
  private disputes = new Map<string, DisputeRecord>();

  /** 创建争议 — 买方发起申诉冻结中的转账 */
  createDispute(
    transferId: string,
    fromUserId: string,
    toUserId: string,
    reason: DisputeReason,
    detail = '',
    evidenceUrls: string[] = [],
  ): DisputeRecord {
    // 不允许同一转账多次申诉
    const existing = [...this.disputes.values()].find((d) => d.transferId === transferId && d.status !== 'closed');
    if (existing) throw new EngineError(ErrorCode.INTERNAL_ERROR, `Dispute already exists for transfer ${transferId}: ${existing.status}`);

    if (!DISPUTE_REASON_LABELS[reason]) throw new EngineError(ErrorCode.INTERNAL_ERROR, `Invalid dispute reason: ${reason}`);

    const record: DisputeRecord = {
      id: `DISP-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      transferId,
      fromUserId,
      toUserId,
      reason,
      detail,
      status: 'open',
      createdAt: new Date().toISOString(),
      evidenceUrls,
    };
    this.disputes.set(record.id, record);
    return record;
  }

  /** 获取争议 */
  getDispute(disputeId: string): DisputeRecord | undefined {
    return this.disputes.get(disputeId);
  }

  /** 按转账ID查争议 */
  getDisputeByTransfer(transferId: string): DisputeRecord | undefined {
    return [...this.disputes.values()].find((d) => d.transferId === transferId);
  }

  /** 按用户查争议 */
  listUserDisputes(userId: string, status?: DisputeRecord['status']): DisputeRecord[] {
    let list = [...this.disputes.values()].filter((d) => d.fromUserId === userId || d.toUserId === userId);
    if (status) list = list.filter((d) => d.status === status);
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  /** 所有活跃争议 */
  getOpenDisputes(): DisputeRecord[] {
    return [...this.disputes.values()].filter((d) => d.status === 'open');
  }

  /** 管理员解决争议 */
  resolveByAdmin(disputeId: string, resolvedBy: string, adminNote: string, favor: 'buyer' | 'seller'): DisputeRecord {
    const d = this.disputes.get(disputeId);
    if (!d) throw new EngineError(ErrorCode.INTERNAL_ERROR, `Dispute ${disputeId} not found`);
    if (d.status !== 'open') throw new EngineError(ErrorCode.INTERNAL_ERROR, `Dispute already resolved: ${d.status}`);
    d.status = favor === 'buyer' ? 'resolved_buyer' : 'resolved_seller';
    d.resolvedAt = new Date().toISOString();
    d.resolvedBy = resolvedBy;
    d.adminNote = adminNote;
    this.disputes.set(disputeId, d);
    return d;
  }

  /** 关闭争议 (双方协商一致) */
  closeDispute(disputeId: string, closedBy: string): DisputeRecord {
    const d = this.disputes.get(disputeId);
    if (!d) throw new EngineError(ErrorCode.INTERNAL_ERROR, `Dispute ${disputeId} not found`);
    d.status = 'closed';
    d.resolvedAt = new Date().toISOString();
    d.resolvedBy = closedBy;
    this.disputes.set(disputeId, d);
    return d;
  }

  /** 统计 */
  getStats(): { open: number; resolved: number; closed: number; byReason: Record<string, number> } {
    const byReason: Record<string, number> = {};
    let open = 0,
      resolved = 0,
      closed = 0;
    for (const d of this.disputes.values()) {
      if (d.status === 'open') open++;
      else if (d.status === 'closed') closed++;
      else resolved++;
      byReason[d.reason] = (byReason[d.reason] || 0) + 1;
    }
    return { open, resolved, closed, byReason };
  }

  reset(): void {
    this.disputes.clear();
  }
}

let _disputeEngine: P2PDisputeEngine | null = null;
export function getP2PDisputeEngine(): P2PDisputeEngine {
  if (!_disputeEngine) _disputeEngine = new P2PDisputeEngine();
  return _disputeEngine;
}
export function resetP2PDisputeEngine(): void {
  _disputeEngine?.reset();
  _disputeEngine = null;
}

export const REASON_LABELS = DISPUTE_REASON_LABELS;
export default { P2PDisputeEngine, getP2PDisputeEngine, resetP2PDisputeEngine, REASON_LABELS };

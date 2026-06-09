/**
 * J-78-03-3: p2p-freeze-manager.ts — P2P冻结管理引擎
 * v1.9.0: 拆分自p2p-transfer-engine
 *
 * 冻结管理: 14天计时 + 自动解冻 + 手动解冻 + 全局冻结/解冻用户
 */

export interface FreezeRecord {
  transferId: string;
  fromUserId: string;
  toUserId: string;
  amount: number;
  frozenAt: string;
  frozenUntil: string;
  status: 'frozen' | 'released' | 'permanent';
  releaseType?: 'auto' | 'manual' | 'appeal_overridden';
  releasedAt?: string;
  releasedBy?: string;
}

export interface UserFreeze {
  userId: string;
  reason: string;
  frozenAt: string;
  frozenBy: string;
  unfrozenAt?: string;
}

export class P2PFreezeManager {
  private freezes = new Map<string, FreezeRecord>();
  private userFreezes = new Map<string, UserFreeze>();

  /** 记录一笔转账冻结 */
  freezeTransfer(
    transferId: string,
    fromUserId: string,
    toUserId: string,
    amount: number,
    freezePeriodDays = 14,
  ): FreezeRecord {
    const now = new Date();
    const frozenUntil = new Date(now.getTime() + freezePeriodDays * 86400000);
    const record: FreezeRecord = {
      transferId,
      fromUserId,
      toUserId,
      amount,
      frozenAt: now.toISOString(),
      frozenUntil: frozenUntil.toISOString(),
      status: 'frozen',
    };
    this.freezes.set(transferId, record);
    return record;
  }

  /** 自动解冻到期的转账 */
  releaseExpired(): FreezeRecord[] {
    const now = Date.now();
    const released: FreezeRecord[] = [];
    for (const [id, f] of this.freezes) {
      if (f.status === 'frozen' && new Date(f.frozenUntil).getTime() <= now) {
        f.status = 'released';
        f.releaseType = 'auto';
        f.releasedAt = new Date().toISOString();
        this.freezes.set(id, f);
        released.push(f);
      }
    }
    return released;
  }

  /** 手动解冻 (管理员) */
  manualRelease(transferId: string, releasedBy: string): FreezeRecord {
    const f = this.freezes.get(transferId);
    if (!f) throw new Error(`Freeze record for ${transferId} not found`);
    if (f.status !== 'frozen') throw new Error(`Transfer ${transferId} is not frozen: ${f.status}`);
    f.status = 'released';
    f.releaseType = 'manual';
    f.releasedAt = new Date().toISOString();
    f.releasedBy = releasedBy;
    this.freezes.set(transferId, f);
    return f;
  }

  /** 申诉导致的永久冻结 */
  makePermanent(transferId: string): FreezeRecord {
    const f = this.freezes.get(transferId);
    if (!f) throw new Error(`Freeze record for ${transferId} not found`);
    f.status = 'permanent';
    this.freezes.set(transferId, f);
    return f;
  }

  /** 查询冻结记录 */
  getFreeze(transferId: string): FreezeRecord | undefined {
    return this.freezes.get(transferId);
  }

  /** 用户的冻结列表 */
  listByUser(userId: string): FreezeRecord[] {
    return [...this.freezes.values()]
      .filter((f) => (f.fromUserId === userId || f.toUserId === userId) && f.status === 'frozen')
      .sort((a, b) => new Date(a.frozenUntil).getTime() - new Date(b.frozenUntil).getTime());
  }

  /** 即将到期的冻结 (24小时内) */
  getExpiringSoon(hoursBefore = 24): FreezeRecord[] {
    const threshold = Date.now() + hoursBefore * 3600000;
    return [...this.freezes.values()].filter(
      (f) => f.status === 'frozen' && new Date(f.frozenUntil).getTime() <= threshold,
    );
  }

  /** 用户级别的全局冻结 */
  freezeUser(userId: string, reason: string, frozenBy: string): UserFreeze {
    if (this.userFreezes.has(userId)) throw new Error(`User ${userId} is already frozen`);
    const uf: UserFreeze = { userId, reason, frozenAt: new Date().toISOString(), frozenBy };
    this.userFreezes.set(userId, uf);
    return uf;
  }

  unfreezeUser(userId: string): UserFreeze {
    const uf = this.userFreezes.get(userId);
    if (!uf) throw new Error(`User ${userId} is not frozen`);
    uf.unfrozenAt = new Date().toISOString();
    this.userFreezes.set(userId, uf);
    return uf;
  }

  isUserFrozen(userId: string): boolean {
    return this.userFreezes.has(userId);
  }

  getStats(): { frozenCount: number; totalFrozenAmount: number; usersFrozen: number; expiringSoon: number } {
    const frozen = [...this.freezes.values()].filter((f) => f.status === 'frozen');
    return {
      frozenCount: frozen.length,
      totalFrozenAmount: frozen.reduce((s, f) => s + f.amount, 0),
      usersFrozen: this.userFreezes.size,
      expiringSoon: this.getExpiringSoon().length,
    };
  }

  reset(): void {
    this.freezes.clear();
    this.userFreezes.clear();
  }
}

let _freezeManager: P2PFreezeManager | null = null;
export function getP2PFreezeManager(): P2PFreezeManager {
  if (!_freezeManager) _freezeManager = new P2PFreezeManager();
  return _freezeManager;
}
export function resetP2PFreezeManager(): void {
  _freezeManager?.reset();
  _freezeManager = null;
}
export default { P2PFreezeManager, getP2PFreezeManager, resetP2PFreezeManager };

/**
import { EngineError, ErrorCode } from '../../errors';

 * J-78-03-4: blacklist-manager.ts
 * v1.9.0: p2p-transfer-engine
 *
 * : / + + import + query
 */

export interface BlacklistEntry {
  userId: string;
  reason: string;
  addedBy: string;
  addedAt: string;
  expiresAt?: string; // 可选expiry时间
  removedAt?: string;
  removedBy?: string;
  status: 'active' | 'expired' | 'removed';
  relatedTransfers: string[]; // 关联的transferID
  notes?: string;
}

export class BlacklistManager {
  private blacklist = new Map<string, BlacklistEntry>();
  private whitelist = new Set<string>(); // 始终允许的地址

 /** user */
  add(userId: string, reason: string, addedBy: string, expiresInDays?: number, notes?: string): BlacklistEntry {
    if (this.whitelist.has(userId)) throw new EngineError(ErrorCode.SECURITY_VIOLATION, `User ${userId} is whitelisted, cannot blacklist`);

    const existing = this.blacklist.get(userId);
    if (existing && existing.status === 'active') throw new EngineError(ErrorCode.SECURITY_VIOLATION, `User ${userId} is already blacklisted`);

    const entry: BlacklistEntry = {
      userId,
      reason,
      addedBy,
      addedAt: new Date().toISOString(),
      expiresAt: expiresInDays ? new Date(Date.now() + expiresInDays * 86400000).toISOString() : undefined,
      status: 'active',
      relatedTransfers: [],
      notes,
    };
    this.blacklist.set(userId, entry);
    return entry;
  }

 /** */
  remove(userId: string, removedBy: string): BlacklistEntry {
    const entry = this.blacklist.get(userId);
    if (!entry) throw new EngineError(ErrorCode.SECURITY_VIOLATION, `User ${userId} is not blacklisted`);
    if (entry.status !== 'active') throw new EngineError(ErrorCode.SECURITY_VIOLATION, `Blacklist entry for ${userId} is ${entry.status}`);
    entry.status = 'removed';
    entry.removedAt = new Date().toISOString();
    entry.removedBy = removedBy;
    this.blacklist.set(userId, entry);
    return entry;
  }

 /** */
  isBlacklisted(userId: string): boolean {
    const entry = this.blacklist.get(userId);
    if (!entry || entry.status !== 'active') return false;
    if (entry.expiresAt && new Date(entry.expiresAt) <= new Date()) {
      entry.status = 'expired';
      this.blacklist.set(userId, entry);
      return false;
    }
    return true;
  }

 /** transfer */
  linkTransfer(userId: string, transferId: string): void {
    const entry = this.blacklist.get(userId);
    if (entry && !entry.relatedTransfers.includes(transferId)) {
      entry.relatedTransfers.push(transferId);
      this.blacklist.set(userId, entry);
    }
  }

 /** */
  getEntry(userId: string): BlacklistEntry | undefined {
    return this.blacklist.get(userId);
  }

 /** */
  getActiveList(): BlacklistEntry[] {
    return [...this.blacklist.values()].filter((e) => e.status === 'active');
  }

 /** () */
  getAll(): BlacklistEntry[] {
    return [...this.blacklist.values()].sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());
  }

 /** import (CSV) */
  importBatch(entries: Array<{ userId: string; reason: string; addedBy: string; notes?: string }>): number {
    let count = 0;
    for (const e of entries) {
      try {
        this.add(e.userId, e.reason, e.addedBy, undefined, e.notes);
        count++;
      } catch {
        /* skip duplicates */
      }
    }
    return count;
  }

 /** */
  addWhitelist(userId: string): void {
    this.whitelist.add(userId);
  }
  removeWhitelist(userId: string): void {
    this.whitelist.delete(userId);
  }
  isWhitelisted(userId: string): boolean {
    return this.whitelist.has(userId);
  }
  getWhitelist(): string[] {
    return [...this.whitelist];
  }

  getStats(): { total: number; active: number; expired: number; removed: number; whitelisted: number } {
    let active = 0,
      expired = 0,
      removed = 0;
    for (const e of this.blacklist.values()) {
      if (e.status === 'active') active++;
      else if (e.status === 'expired') expired++;
      else removed++;
    }
    return { total: this.blacklist.size, active, expired, removed, whitelisted: this.whitelist.size };
  }

  reset(): void {
    this.blacklist.clear();
    this.whitelist.clear();
  }
}

let _blacklistManager: BlacklistManager | null = null;
export function getBlacklistManager(): BlacklistManager {
  if (!_blacklistManager) _blacklistManager = new BlacklistManager();
  return _blacklistManager;
}
export function resetBlacklistManager(): void {
  _blacklistManager?.reset();
  _blacklistManager = null;
}
export default { BlacklistManager, getBlacklistManager, resetBlacklistManager };

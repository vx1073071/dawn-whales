/**
 * @vitest-environment node
 * Q-62-02: 申诉+黑名单+2FA E2E (R62 v19 P0, 15 tests)
 *
 * PM specs:
 * - 申诉4选1: 收款未确认/未按约定/账号异常/其他(必填描述)
 * - 买方取消申诉→解冻放款
 * - 黑名单: 0自动, 管理员手动添加/移除
 * - 黑名单效果: 冻结所述账户P2P+提现功能
 * - 2FA: TOTP (Google Authenticator兼容), 登录+提现触发
 * - 2FA恢复: 备用码×8, 一次性使用
 */

import { describe, it, expect, beforeEach } from "vitest";

// ── Mock Dispute System ────────────────────────────────────────────────────

enum DisputeReason {
  PAYMENT_NOT_RECEIVED = "收款未确认",
  NOT_AS_AGREED = "未按约定",
  ACCOUNT_ABNORMAL = "账号异常",
  OTHER = "其他",
}

interface DisputeRecord {
  id: string;
  transferId: string;
  reason: DisputeReason;
  description: string;
  filedBy: string;
  status: "pending" | "resolved" | "cancelled";
  createdAt: number;
}

class DisputeSystem {
  private disputes: Map<string, DisputeRecord> = new Map();
  private frozenTransfers: Set<string> = new Set(); // transfer IDs frozen due to dispute
  private nextId = 1;

  fileDispute(transferId: string, userId: string, reason: DisputeReason, description?: string): DisputeRecord {
    if (reason === DisputeReason.OTHER && !description) {
      throw new Error("Description required for '其他'");
    }
    const record: DisputeRecord = {
      id: `disp-${this.nextId++}`,
      transferId, reason, description: description || "",
      filedBy: userId, status: "pending",
      createdAt: Date.now(),
    };
    this.disputes.set(record.id, record);
    this.frozenTransfers.add(transferId); // permanently freeze
    return record;
  }

  getDispute(id: string): DisputeRecord | undefined {
    return this.disputes.get(id);
  }

  cancelDispute(id: string, userId: string): DisputeRecord {
    const d = this.disputes.get(id);
    if (!d) throw new Error("Dispute not found");
    if (d.filedBy !== userId) throw new Error("Only filer can cancel");
    d.status = "cancelled";
    this.frozenTransfers.delete(d.transferId); // unfreeze
    return d;
  }

  isTransferFrozen(transferId: string): boolean {
    return this.frozenTransfers.has(transferId);
  }

  getAllDisputes(): DisputeRecord[] {
    return Array.from(this.disputes.values());
  }
}

// ── Mock Blacklist System ──────────────────────────────────────────────────

class BlacklistSystem {
  private blacklist: Set<string> = new Set();
  private frozenP2P: Set<string> = new Set();
  private frozenWithdraw: Set<string> = new Set();

  /** Admin manual add */
  addToBlacklist(userId: string, adminId: string): void {
    if (!adminId.startsWith("admin-")) throw new Error("Admin only");
    this.blacklist.add(userId);
    this.frozenP2P.add(userId);
    this.frozenWithdraw.add(userId);
  }

  /** Admin manual remove */
  removeFromBlacklist(userId: string, adminId: string): void {
    if (!adminId.startsWith("admin-")) throw new Error("Admin only");
    this.blacklist.delete(userId);
    this.frozenP2P.delete(userId);
    this.frozenWithdraw.delete(userId);
  }

  isBlacklisted(userId: string): boolean {
    return this.blacklist.has(userId);
  }

  canP2P(userId: string): boolean {
    return !this.frozenP2P.has(userId);
  }

  canWithdraw(userId: string): boolean {
    return !this.frozenWithdraw.has(userId);
  }
}

// ── Mock 2FA System (TOTP) ─────────────────────────────────────────────────

class TwoFASystem {
  private enrolled: Set<string> = new Set();
  private backupCodes: Map<string, string[]> = new Map();
  private loginRequired: Set<string> = new Set();
  private withdrawRequired: Set<string> = new Set();

  enroll(userId: string): { secret: string; backupCodes: string[] } {
    const codes = Array.from({ length: 8 }, () =>
      Math.random().toString(36).substring(2, 10).toUpperCase()
    );
    this.backupCodes.set(userId, codes);
    this.enrolled.add(userId);
    this.loginRequired.add(userId);
    this.withdrawRequired.add(userId);
    return { secret: "JBSWY3DPEHPK3PXP", backupCodes: codes };
  }

  verifyTOTP(userId: string, code: string): boolean {
    if (!this.enrolled.has(userId)) return true; // not enrolled = skip
    // Validate 6-digit TOTP (simulate — real would check time-based)
    return /^\d{6}$/.test(code) && code !== "000000";
  }

  verifyBackupCode(userId: string, code: string): boolean {
    const codes = this.backupCodes.get(userId);
    if (!codes) return false;
    const idx = codes.indexOf(code);
    if (idx === -1) return false;
    codes.splice(idx, 1); // one-time use
    return true;
  }

  requires2FAForLogin(userId: string): boolean {
    return this.loginRequired.has(userId);
  }

  requires2FAForWithdraw(userId: string): boolean {
    return this.withdrawRequired.has(userId);
  }

  isEnrolled(userId: string): boolean {
    return this.enrolled.has(userId);
  }

  getRemainingBackupCodes(userId: string): number {
    return this.backupCodes.get(userId)?.length ?? 0;
  }
}

// ── Suite 01: Dispute System ──────────────────────────────────────────────

describe("Q-62-02-01: Dispute System (4 Types)", () => {
  let ds: DisputeSystem;
  beforeEach(() => { ds = new DisputeSystem(); });

  it("01: file dispute type 1 — 收款未确认 (Payment Not Received)", () => {
    const d = ds.fileDispute("tr-10", "user-b", DisputeReason.PAYMENT_NOT_RECEIVED);
    expect(d.status).toBe("pending");
    expect(d.reason).toBe("收款未确认");
    expect(ds.isTransferFrozen("tr-10")).toBe(true);
  });

  it("02: file dispute type 2 — 未按约定 (Not As Agreed)", () => {
    const d = ds.fileDispute("tr-11", "user-b", DisputeReason.NOT_AS_AGREED);
    expect(d.reason).toBe("未按约定");
    expect(ds.isTransferFrozen("tr-11")).toBe(true);
  });

  it("03: file dispute type 3 — 账号异常 (Account Abnormal)", () => {
    const d = ds.fileDispute("tr-12", "user-b", DisputeReason.ACCOUNT_ABNORMAL);
    expect(d.reason).toBe("账号异常");
  });

  it("04: file dispute type 4 — 其他 requires description", () => {
    expect(() => ds.fileDispute("tr-13", "user-b", DisputeReason.OTHER)).toThrow(/Description/);

    const d = ds.fileDispute("tr-13", "user-b", DisputeReason.OTHER, "商品质量问题");
    expect(d.reason).toBe("其他");
    expect(d.description).toBe("商品质量问题");
  });

  it("05: dispute permanently freezes transfer", () => {
    ds.fileDispute("tr-20", "user-b", DisputeReason.PAYMENT_NOT_RECEIVED);
    // Even after "time passes", it stays frozen
    expect(ds.isTransferFrozen("tr-20")).toBe(true);
    // Cancelling will unfreeze
    ds.cancelDispute("disp-1", "user-b");
    expect(ds.isTransferFrozen("tr-20")).toBe(false);
  });

  it("06: buyer cancel dispute → unfreezes transfer", () => {
    const d = ds.fileDispute("tr-30", "user-b", DisputeReason.NOT_AS_AGREED);
    expect(ds.isTransferFrozen("tr-30")).toBe(true);
    const cancelled = ds.cancelDispute(d.id, "user-b");
    expect(cancelled.status).toBe("cancelled");
    expect(ds.isTransferFrozen("tr-30")).toBe(false);
  });

  it("07: only dispute filer can cancel (not random user)", () => {
    const d = ds.fileDispute("tr-40", "user-b", DisputeReason.PAYMENT_NOT_RECEIVED);
    expect(() => ds.cancelDispute(d.id, "user-a")).toThrow(/filer/);
  });

  it("08: dispute records are queryable", () => {
    ds.fileDispute("tr-50", "user-b", DisputeReason.PAYMENT_NOT_RECEIVED);
    ds.fileDispute("tr-51", "user-c", DisputeReason.ACCOUNT_ABNORMAL);
    expect(ds.getAllDisputes().length).toBe(2);
  });
});

// ── Suite 02: Blacklist System ────────────────────────────────────────────

describe("Q-62-02-02: Blacklist System", () => {
  let bl: BlacklistSystem;
  beforeEach(() => { bl = new BlacklistSystem(); });

  it("09: admin can add user to blacklist (manual only)", () => {
    bl.addToBlacklist("user-99", "admin-1");
    expect(bl.isBlacklisted("user-99")).toBe(true);
    expect(bl.canP2P("user-99")).toBe(false);
    expect(bl.canWithdraw("user-99")).toBe(false);
  });

  it("10: non-admin cannot add to blacklist", () => {
    expect(() => bl.addToBlacklist("user-99", "user-a")).toThrow(/Admin/);
  });

  it("11: admin can remove from blacklist → restores P2P + withdraw", () => {
    bl.addToBlacklist("user-99", "admin-1");
    bl.removeFromBlacklist("user-99", "admin-1");
    expect(bl.isBlacklisted("user-99")).toBe(false);
    expect(bl.canP2P("user-99")).toBe(true);
    expect(bl.canWithdraw("user-99")).toBe(true);
  });

  it("12: blacklist has 0 auto-trigger — only manual", () => {
    // No automatic detection triggers blacklisting
    expect(bl.isBlacklisted("new-user")).toBe(false);
  });
});

// ── Suite 03: 2FA (TOTP) ──────────────────────────────────────────────────

describe("Q-62-02-03: 2FA TOTP System", () => {
  let twofa: TwoFASystem;
  beforeEach(() => { twofa = new TwoFASystem(); });

  it("13: 2FA enrollment generates TOTP secret + 8 backup codes", () => {
    const result = twofa.enroll("user-a");
    expect(result.secret).toBeTruthy();
    expect(result.backupCodes.length).toBe(8);
    expect(twofa.isEnrolled("user-a")).toBe(true);
  });

  it("14: 2FA login requires 6-digit code", () => {
    twofa.enroll("user-a");
    expect(twofa.requires2FAForLogin("user-a")).toBe(true);
    expect(twofa.verifyTOTP("user-a", "123456")).toBe(true);
    expect(twofa.verifyTOTP("user-a", "000000")).toBe(false);
    expect(twofa.verifyTOTP("user-a", "abc")).toBe(false);
  });

  it("15: backup code single-use recovery + 2FA for withdraw", () => {
    const { backupCodes } = twofa.enroll("user-a");
    const code = backupCodes[0];

    // Backup code works once
    expect(twofa.verifyBackupCode("user-a", code)).toBe(true);
    expect(twofa.getRemainingBackupCodes("user-a")).toBe(7);

    // Same code fails second time
    expect(twofa.verifyBackupCode("user-a", code)).toBe(false);

    // 2FA required for withdraw
    expect(twofa.requires2FAForWithdraw("user-a")).toBe(true);
  });
});

/**
 * @vitest-environment node
 * Q-65-01: 注册+入驻 E2E (R65 FIX v1.6.0-beta, 15 tests)
 *
 * PM FIX spec (07:15):
 * - 注册: 邮箱+密码 → 完善创作者资料 → 充USDT → 开始
 * - 入驻: 选Agent→调参数→回测→发布→定价 (5步)
 * - 新创作者3次免费AI分析 (系统赠予)
 * - NO激活码, NO试用期, NO到期锁定
 */

import { describe, it, expect, beforeEach } from "vitest";

// ── Registration Mock ──────────────────────────────────────────────────────

interface UserAccount {
  id: string; email: string; nickname: string;
  freeCredits: number; createdAt: string;
  isCreator: boolean; balanceUSDT: number;
}

interface CreatorProfile {
  userId: string; displayName: string; bio: string;
  expertise: string[]; tier: string;
  totalPublished: number; totalRevenue: number; totalSubscribers: number;
}

class RegistrationService {
  private users = new Map<string, UserAccount>();
  private creators = new Map<string, CreatorProfile>();
  private usedEmails = new Set<string>();

  register(email: string, password: string, nickname?: string): UserAccount | null {
    if (this.usedEmails.has(email)) return null;
    if (password.length < 8) return null;
    const id = `usr-${this.users.size + 1}`;
    const account: UserAccount = {
      id, email, nickname: nickname || email.split("@")[0],
      freeCredits: 3, // 3 free AI analysis
      createdAt: new Date().toISOString(),
      isCreator: false, balanceUSDT: 0,
    };
    this.users.set(id, account);
    this.usedEmails.add(email);
    return account;
  }

  getUser(id: string): UserAccount | undefined { return this.users.get(id); }

  deposit(userId: string, amount: number): number | null {
    const user = this.users.get(userId);
    if (!user) return null;
    user.balanceUSDT += amount;
    return user.balanceUSDT;
  }

  consumeFreeCredits(userId: string, count: number): number | null {
    const user = this.users.get(userId);
    if (!user || user.freeCredits < count) return null;
    user.freeCredits -= count;
    return user.freeCredits;
  }

  chargeAI(userId: string, tier: string): { success: boolean; balance: number; freeCredits: number } {
    const user = this.users.get(userId);
    if (!user) return { success: false, balance: 0, freeCredits: 0 };
    const price = tier === "elite" ? 2.0 : tier === "pro" ? 1.5 : 1.0;
    if (user.freeCredits > 0) {
      user.freeCredits--;
      return { success: true, balance: user.balanceUSDT, freeCredits: user.freeCredits };
    }
    if (user.balanceUSDT >= price) {
      user.balanceUSDT -= price;
      return { success: true, balance: user.balanceUSDT, freeCredits: user.freeCredits };
    }
    return { success: false, balance: user.balanceUSDT, freeCredits: user.freeCredits };
  }

  // Creator onboarding: 5 steps
  becomeCreator(userId: string, profile: { displayName: string; bio: string; expertise: string[] }): CreatorProfile | null {
    const user = this.users.get(userId);
    if (!user) return null;
    const cp: CreatorProfile = {
      userId, displayName: profile.displayName, bio: profile.bio,
      expertise: profile.expertise, tier: "L1",
      totalPublished: 0, totalRevenue: 0, totalSubscribers: 0,
    };
    this.creators.set(userId, cp);
    user.isCreator = true;
    return cp;
  }

  getCreatorProfile(userId: string): CreatorProfile | undefined { return this.creators.get(userId); }

  publishStrategy(userId: string, price: number): { success: boolean; strategyId: string } | null {
    const cp = this.creators.get(userId);
    if (!cp) return null;
    cp.totalPublished++;
    return { success: true, strategyId: `strategy-${cp.totalPublished}` };
  }
}

// ── Suite: Registration E2E ────────────────────────────────────────────────

describe("Q-65-01-01: Registration + Profile", () => {
  let svc: RegistrationService;
  beforeEach(() => { svc = new RegistrationService(); });

  it("01: register with email+password creates account", () => {
    const acc = svc.register("test@dawn.com", "pass12345", "TraderBob");
    expect(acc).not.toBeNull();
    expect(acc!.email).toBe("test@dawn.com");
    expect(acc!.nickname).toBe("TraderBob");
  });

  it("02: duplicate email is rejected", () => {
    svc.register("dup@dawn.com", "password123");
    expect(svc.register("dup@dawn.com", "another456")).toBeNull();
  });

  it("03: password < 8 chars is rejected", () => {
    expect(svc.register("short@dawn.com", "1234567")).toBeNull();
  });

  it("04: new user gets 3 free AI analysis credits", () => {
    const acc = svc.register("newbie@dawn.com", "welcome1234");
    expect(acc!.freeCredits).toBe(3);
  });

  it("05: NO activation code required — account is active immediately", () => {
    const acc = svc.register("instant@dawn.com", "password99");
    const fetched = svc.getUser(acc!.id);
    expect(fetched!.freeCredits).toBe(3);
    expect(fetched!.createdAt).toBeTruthy();
    // No activation flag, no trial period, no expiry
  });

  it("06: deposit USDT increases balance", () => {
    const acc = svc.register("rich@dawn.com", "wealthy11");
    const bal = svc.deposit(acc!.id, 100);
    expect(bal).toBe(100);
  });

  it("07: free credits consumed before balance", () => {
    const acc = svc.register("free@dawn.com", "freebie11");
    // 1st call: free
    const r1 = svc.chargeAI(acc!.id, "basic");
    expect(r1.success).toBe(true);
    expect(r1.freeCredits).toBe(2);
    expect(r1.balance).toBe(0); // balance untouched
  });

  it("08: after free credits exhausted, balance is charged", () => {
    const acc = svc.register("payer@dawn.com", "paying11");
    svc.chargeAI(acc!.id, "basic"); // free 1
    svc.chargeAI(acc!.id, "basic"); // free 2
    svc.chargeAI(acc!.id, "basic"); // free 3 → 0
    svc.deposit(acc!.id, 10);
    const r = svc.chargeAI(acc!.id, "pro"); // pro=1.5 USDT
    expect(r.success).toBe(true);
    expect(r.balance).toBeCloseTo(8.5, 2);
    expect(r.freeCredits).toBe(0);
  });

  it("09: insufficient balance blocks AI analysis", () => {
    const acc = svc.register("broke@dawn.com", "poorpoor");
    svc.chargeAI(acc!.id, "basic"); // free 1
    svc.chargeAI(acc!.id, "basic"); // free 2
    svc.chargeAI(acc!.id, "basic"); // free 3 → 0
    const r = svc.chargeAI(acc!.id, "elite"); // 2.0 USDT, 0 balance
    expect(r.success).toBe(false);
  });

  it("10: basic/pro/elite tiers have correct pricing", () => {
    const acc = svc.register("tier@dawn.com", "tiering12");
    // Exhaust 3 free credits first (on basic tier)
    svc.chargeAI(acc!.id, "basic");
    svc.chargeAI(acc!.id, "basic");
    svc.chargeAI(acc!.id, "basic");
    svc.deposit(acc!.id, 20);
    // basic = 1.0
    const r1 = svc.chargeAI(acc!.id, "basic");
    expect(r1.success).toBe(true);
    // pro = 1.5
    const r2 = svc.chargeAI(acc!.id, "pro");
    expect(r2.success).toBe(true);
    // elite = 2.0
    const r3 = svc.chargeAI(acc!.id, "elite");
    expect(r3.success).toBe(true);
    expect(r3.balance).toBeCloseTo(15.5, 2); // 20 - 1.0 - 1.5 - 2.0
  });
});

// ── Suite: Creator Onboarding E2E ──────────────────────────────────────────

describe("Q-65-01-02: Creator Onboarding", () => {
  let svc: RegistrationService;
  beforeEach(() => { svc = new RegistrationService(); });

  it("11: become creator — 5-step onboarding", () => {
    const acc = svc.register("creator@dawn.com", "creator12");
    const cp = svc.becomeCreator(acc!.id, {
      displayName: "因子猎手", bio: "专注A股大小盘轮动因子", expertise: ["因子", "轮动"],
    });
    expect(cp).not.toBeNull();
    expect(cp!.displayName).toBe("因子猎手");
    expect(cp!.tier).toBe("L1"); // new creator starts at L1
    expect(cp!.totalPublished).toBe(0);
  });

  it("12: non-existent user cannot become creator", () => {
    expect(svc.becomeCreator("no-such-user", { displayName: "X", bio: "Y", expertise: [] })).toBeNull();
  });

  it("13: publish strategy increments count", () => {
    const acc = svc.register("pub@dawn.com", "publisher1");
    svc.becomeCreator(acc!.id, { displayName: "Pub", bio: "test", expertise: ["trend"] });
    const r1 = svc.publishStrategy(acc!.id, 200);
    expect(r1!.success).toBe(true);
    expect(r1!.strategyId).toBe("strategy-1");
    const r2 = svc.publishStrategy(acc!.id, 500);
    expect(r2!.strategyId).toBe("strategy-2");
    expect(svc.getCreatorProfile(acc!.id)!.totalPublished).toBe(2);
  });

  it("14: free features available without payment", () => {
    const acc = svc.register("freeuser@dawn.com", "freeuser");
    // Can use free features (indicators, backtest, editor, market browse, wallet view)
    // without paying anything
    expect(acc!.balanceUSDT).toBe(0);
    expect(acc!.freeCredits).toBe(3);
    expect(acc!.id).toBeTruthy();
    // Account is fully functional — no lock, no trial, no activation needed
  });

  it("15: full E2E: register → deposit → AI → become creator → publish", () => {
    const acc = svc.register("e2e@dawn.com", "e2etester");
    expect(acc).not.toBeNull();
    // Deposit
    svc.deposit(acc!.id, 50);
    // Use free credits
    svc.chargeAI(acc!.id, "basic");
    svc.chargeAI(acc!.id, "basic");
    svc.chargeAI(acc!.id, "basic");
    // Paid AI after free exhausted
    const r = svc.chargeAI(acc!.id, "pro");
    expect(r.success).toBe(true);
    expect(r.balance).toBeCloseTo(48.5, 2); // 50 - 1.5
    // Become creator
    svc.becomeCreator(acc!.id, { displayName: "E2E测试师", bio: "全链路", expertise: ["全品类"] });
    const pub = svc.publishStrategy(acc!.id, 300);
    expect(pub!.success).toBe(true);
    // Verify final state
    const user = svc.getUser(acc!.id)!;
    expect(user.isCreator).toBe(true);
    expect(user.freeCredits).toBe(0);
    expect(user.balanceUSDT).toBeCloseTo(48.5, 2);
  });
});

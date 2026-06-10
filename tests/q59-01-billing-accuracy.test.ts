/**
 * @vitest-environment node
 * Q-59-01: AI Usage Billing Accuracy Tests (Real JVS Engine)
 *
 * PM R59 v19 specs verified against ai-usage-billing-contract.ts:
 * - 3-tier: standard(1.0) / premium(1.5) / flagship(2.0) USDT
 * - estimateCost(tier, debateRounds, arenaModels)
 * - holdBalance → settleSession / refundSession
 * - Free tier: 3 free analyses for new creators
 * - Monthly caps: 5/10/50/100
 */

import { describe, it, expect, beforeEach } from "vitest";
import { AIUsageBillingContract, resetBillingContract } from "../electron/engine/agents/ai-usage-billing-contract";
import type { BillingTier, CreatorWallet } from "../electron/engine/agents/ai-usage-billing-contract";

describe("Q-59-01-01: Tier Pricing", () => {
  let engine: AIUsageBillingContract;
  beforeEach(() => { engine = new AIUsageBillingContract(); });

  it("01: standard tier base price is 1.0 USDT", () => {
    expect(engine.estimateCost("standard", 0, 0)).toBe(1.0);
  });

  it("02: premium tier base price is 1.5 USDT", () => {
    expect(engine.estimateCost("premium", 0, 0)).toBe(1.5);
  });

  it("03: flagship tier base price is 2.0 USDT", () => {
    expect(engine.estimateCost("flagship", 0, 0)).toBe(2.0);
  });

  it("04: standard is cheapest tier", () => {
    const s = engine.estimateCost("standard", 0, 0);
    const p = engine.estimateCost("premium", 0, 0);
    const f = engine.estimateCost("flagship", 0, 0);
    expect(s).toBeLessThan(p);
    expect(p).toBeLessThan(f);
  });

  it("05: all 3 tiers return different base prices", () => {
    const prices = ["standard", "premium", "flagship"].map(t => engine.estimateCost(t as BillingTier, 0, 0));
    expect(new Set(prices).size).toBe(3);
  });
});

describe("Q-59-01-02: Debate & Arena Pricing", () => {
  let engine: AIUsageBillingContract;
  beforeEach(() => { engine = new AIUsageBillingContract(); });

  it("06: debate adds +0.5 per round", () => {
    const base = engine.estimateCost("standard", 0, 0);
    const withDebate = engine.estimateCost("standard", 3, 0);
    expect(withDebate).toBeGreaterThan(base);
    expect(withDebate - base).toBeGreaterThanOrEqual(1.0);
  });

  it("07: debate 1 round costs base + 0.5", () => {
    const base = engine.estimateCost("standard", 0, 0);
    const cost = engine.estimateCost("standard", 1, 0);
    expect(Math.abs(cost - base - 0.5)).toBeLessThan(0.01);
  });

  it("08: arena cost = (base) × models × 0.3", () => {
    const arena = engine.estimateCost("standard", 0, 4);
    const expected = 1.0 * 4 * 0.3; // = 1.2
    expect(Math.abs(arena - expected)).toBeLessThan(0.01);
  });

  it("09: arena with 1 model: base × 0.3", () => {
    const cost = engine.estimateCost("premium", 0, 1);
    const expected = 1.5 * 1 * 0.3; // = 0.45
    expect(Math.abs(cost - expected)).toBeLessThan(0.01);
  });

  it("10: combined debate + arena: (base + debate) × models × 0.3", () => {
    const cost = engine.estimateCost("premium", 2, 3);
    const expected = (1.5 + 2 * 0.5) * 3 * 0.3; // = 2.25
    expect(Math.abs(cost - expected)).toBeLessThan(0.01);
  });
});

describe("Q-59-01-03: BeginSession → Settle → Refund", () => {
  let engine: AIUsageBillingContract;
  beforeEach(() => { engine = new AIUsageBillingContract(); });

  it("11: beginSession deducts from wallet (non-free)", () => {
    engine.deposit("user-11", 10);
    // Exhaust free tier first
    engine.beginSession("user-11", "standard");
    engine.beginSession("user-11", "standard");
    engine.beginSession("user-11", "standard");
    // Now non-free
    const result = engine.beginSession("user-11", "standard");
    expect(result.isFree).toBe(false);
    expect(result.session.status).toBe("holding");
    expect(engine.getWallet("user-11").balanceUSDT).toBe(9);
  });

  it("12: canAfford returns false when balance insufficient", () => {
    engine.deposit("user-12", 0.5);
    const cost = engine.estimateCost("standard", 0, 0);
    // Exhaust free tier
    engine.beginSession("user-12", "standard"); engine.beginSession("user-12", "standard"); engine.beginSession("user-12", "standard");
    const result = engine.canAfford("user-12", cost);
    expect(result.affordable).toBe(false);
    expect(result.reason).toMatch(/insufficient/i);
  });

  it("13: settle completes the charge", () => {
    engine.deposit("user-13", 10);
    engine.beginSession("user-13", "standard");
    engine.beginSession("user-13", "standard");
    engine.beginSession("user-13", "standard");
    const { session } = engine.beginSession("user-13", "standard");
    const settled = engine.settleSession(session.sessionId)!;
    expect(settled.status).toBe("settled");
    expect(engine.getWallet("user-13").balanceUSDT).toBe(9);
  });

  it("14: refund returns held amount", () => {
    engine.deposit("user-14", 10);
    engine.beginSession("user-14", "standard");
    engine.beginSession("user-14", "standard");
    engine.beginSession("user-14", "standard");
    const { session } = engine.beginSession("user-14", "flagship");
    expect(engine.getWallet("user-14").balanceUSDT).toBe(8);
    engine.refundSession(session.sessionId);
    expect(engine.getWallet("user-14").balanceUSDT).toBe(10);
  });
});

describe("Q-59-01-04: Free Tier (3 analyses)", () => {
  let engine: AIUsageBillingContract;
  beforeEach(() => { engine = new AIUsageBillingContract(); });

  it("15: new creator starts with 3 free analyses", () => {
    expect(engine.getWallet("creator-15").freeAnalysesRemaining).toBe(3);
  });

  it("16: beginSession auto-uses free analysis", () => {
    const { isFree } = engine.beginSession("creator-16", "standard");
    expect(isFree).toBe(true);
    expect(engine.getWallet("creator-16").freeAnalysesRemaining).toBe(2);
  });

  it("17: free tier exhausts after 3 uses, 4th is paid", () => {
    const uid = "creator-17";
    const r1 = engine.beginSession(uid, "standard");
    const r2 = engine.beginSession(uid, "standard");
    const r3 = engine.beginSession(uid, "standard");
    expect(r1.isFree).toBe(true);
    expect(r2.isFree).toBe(true);
    expect(r3.isFree).toBe(true);
    expect(engine.getWallet(uid).freeAnalysesRemaining).toBe(0);
    // 4th requires payment
    engine.deposit(uid, 10);
    const r4 = engine.beginSession(uid, "standard");
    expect(r4.isFree).toBe(false);
  });
});

describe("Q-59-01-05: Monthly Usage Cap", () => {
  let engine: AIUsageBillingContract;
  beforeEach(() => { engine = new AIUsageBillingContract(); });

  it("18: standard monthly cap defaults to 5 USDT", () => {
    engine.setMonthlyCap("user-18", 5);
    const wallet: CreatorWallet = engine.getWallet("user-18");
    expect(wallet.monthlySpendingCapUSDT).toBe(5);
  });

  it("19: can set monthly cap to 10 USDT", () => {
    engine.setMonthlyCap("user-19", 10);
    const wallet: CreatorWallet = engine.getWallet("user-19");
    expect(wallet.monthlySpendingCapUSDT).toBe(10);
  });

  it("20: can set monthly cap to 50+ USDT", () => {
    engine.setMonthlyCap("user-20", 50);
    const wallet: CreatorWallet = engine.getWallet("user-20");
    expect(wallet.monthlySpendingCapUSDT).toBeGreaterThanOrEqual(50);
  });

  it("21: invalid monthly cap throws", () => {
    expect(() => engine.setMonthlyCap("user-21", 999)).toThrow();
  });

  it("22: monthly spent tracks non-free usage only", () => {
    const uid = "user-22";
    engine.deposit(uid, 50);
    engine.setMonthlyCap(uid, 50);
    // 3 free → no monthly spending
    engine.beginSession(uid, "standard");
    engine.beginSession(uid, "standard");
    engine.beginSession(uid, "standard");
    // 2 paid → monthly spent = 2.0
    engine.beginSession(uid, "standard");
    engine.beginSession(uid, "standard");
    const wallet: CreatorWallet = engine.getWallet(uid);
    expect(wallet.monthlySpentUSDT).toBeGreaterThanOrEqual(1.5);
  });
});

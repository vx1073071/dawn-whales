/**
 * @vitest-environment node
 * J-V15-01: Revenue Engine v15 Tests (30+ tests)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  RevenueEngineV15,
  getRevenueEngineV15,
  resetRevenueEngineV15,
} from '../electron/engine/portfolio/revenue-engine-v15';

// ── Section 1: Creator Registration & Tiers ────────────────────────────────

describe('J-V15-01-01: Creator Registration', () => {
  let engine: RevenueEngineV15;

  beforeEach(() => {
    resetRevenueEngineV15();
    engine = getRevenueEngineV15();
  });

  it('01: register new creator at L1', () => {
    const c = engine.registerCreator('c1', 'Alice');
    expect(c.tier).toBe('L1');
    expect(c.totalSubscribers).toBe(0);
    expect(c.cumulativeEarningsUSDT).toBe(0);
  });

  it('02: duplicate registration returns existing', () => {
    const c1 = engine.registerCreator('c1', 'Alice');
    const c2 = engine.registerCreator('c1', 'Alice');
    expect(c1.creatorId).toBe(c2.creatorId);
  });

  it('03: getCreator returns null for unknown', () => {
    expect(engine.getCreator('unknown')).toBeNull();
  });

  it('04: updateCreatorStats updates values', () => {
    engine.registerCreator('c1', 'Alice');
    engine.updateCreatorStats('c1', 50, 500);
    const c = engine.getCreator('c1');
    expect(c!.totalSubscribers).toBe(50);
    expect(c!.cumulativeEarningsUSDT).toBe(500);
  });
});

// ── Section 2: Tier Promotion ──────────────────────────────────────────────

describe('J-V15-01-02: Tier Promotion', () => {
  let engine: RevenueEngineV15;

  beforeEach(() => {
    resetRevenueEngineV15();
    engine = getRevenueEngineV15();
  });

  it('05: L1 stays L1 with low stats', () => {
    engine.registerCreator('c1', 'Alice');
    engine.updateCreatorStats('c1', 10, 100);
    const result = engine.checkAndPromote('c1');
    expect(result.promoted).toBe(false);
  });

  it('06: promote to L2 via subscribers', () => {
    engine.registerCreator('c1', 'Alice');
    engine.updateCreatorStats('c1', 100, 0);
    const result = engine.checkAndPromote('c1');
    expect(result.promoted).toBe(true);
    expect(result.from).toBe('L1');
    expect(result.to).toBe('L2');
  });

  it('07: promote to L2 via earnings', () => {
    engine.registerCreator('c1', 'Alice');
    engine.updateCreatorStats('c1', 0, 1000);
    const result = engine.checkAndPromote('c1');
    expect(result.promoted).toBe(true);
    expect(result.to).toBe('L2');
  });

  it('08: promote to L3 via subscribers', () => {
    engine.registerCreator('c1', 'Alice');
    engine.updateCreatorStats('c1', 1000, 0);
    const result = engine.checkAndPromote('c1');
    expect(result.promoted).toBe(true);
    expect(result.to).toBe('L3');
  });

  it('09: promote to L3 via earnings', () => {
    engine.registerCreator('c1', 'Alice');
    engine.updateCreatorStats('c1', 0, 10000);
    const result = engine.checkAndPromote('c1');
    expect(result.promoted).toBe(true);
    expect(result.to).toBe('L3');
  });

  it('10: L3 stays L3 (no further promotion)', () => {
    engine.registerCreator('c1', 'Alice');
    engine.updateCreatorStats('c1', 1000, 10000);
    engine.checkAndPromote('c1');
    const result = engine.checkAndPromote('c1');
    expect(result.promoted).toBe(false);
  });

  it('11: tier config returns correct percentages', () => {
    expect(engine.getTierConfig('L1').creatorPercent).toBe(70);
    expect(engine.getTierConfig('L1').platformPercent).toBe(30);
    expect(engine.getTierConfig('L2').creatorPercent).toBe(80);
    expect(engine.getTierConfig('L2').platformPercent).toBe(20);
    expect(engine.getTierConfig('L3').creatorPercent).toBe(90);
    expect(engine.getTierConfig('L3').platformPercent).toBe(10);
  });
});

// ── Section 3: Revenue Split Calculation ───────────────────────────────────

describe('J-V15-01-03: Revenue Split', () => {
  let engine: RevenueEngineV15;

  beforeEach(() => {
    resetRevenueEngineV15();
    engine = getRevenueEngineV15();
  });

  it('12: L1 split: 100 USDT → 70/30', () => {
    engine.registerCreator('c1', 'Alice');
    const split = engine.calculateSplit('c1', 100, 'subscription');
    expect(split.creatorAmount).toBe(70);
    expect(split.platformAmount).toBe(30);
    expect(split.tier).toBe('L1');
  });

  it('13: L2 split: 100 USDT → 80/20', () => {
    engine.registerCreator('c1', 'Alice');
    engine.updateCreatorStats('c1', 100, 0);
    engine.checkAndPromote('c1');
    const split = engine.calculateSplit('c1', 100, 'subscription');
    expect(split.creatorAmount).toBe(80);
    expect(split.platformAmount).toBe(20);
    expect(split.tier).toBe('L2');
  });

  it('14: L3 split: 100 USDT → 90/10', () => {
    engine.registerCreator('c1', 'Alice');
    engine.updateCreatorStats('c1', 1000, 0);
    engine.checkAndPromote('c1');
    const split = engine.calculateSplit('c1', 100, 'subscription');
    expect(split.creatorAmount).toBe(90);
    expect(split.platformAmount).toBe(10);
    expect(split.tier).toBe('L3');
  });

  it('15: platform-only types: P2P → 0/100', () => {
    engine.registerCreator('c1', 'Alice');
    const split = engine.calculateSplit('c1', 100, 'p2p_transfer');
    expect(split.creatorAmount).toBe(0);
    expect(split.platformAmount).toBe(100);
  });

  it('16: platform-only types: withdrawal → 0/100', () => {
    const split = engine.calculateSplit('c1', 100, 'withdrawal');
    expect(split.creatorAmount).toBe(0);
    expect(split.platformAmount).toBe(100);
  });

  it('17: platform-only types: auto_trade_taker → 0/100', () => {
    const split = engine.calculateSplit('c1', 100, 'auto_trade_taker');
    expect(split.creatorAmount).toBe(0);
    expect(split.platformAmount).toBe(100);
  });

  it('18: unknown creator defaults to L1', () => {
    const split = engine.calculateSplit('unknown', 100, 'tip');
    expect(split.tier).toBe('L1');
    expect(split.creatorAmount).toBe(70);
    expect(split.platformAmount).toBe(30);
  });
});

// ── Section 4: Transaction Recording ───────────────────────────────────────

describe('J-V15-01-04: Transaction Recording', () => {
  let engine: RevenueEngineV15;

  beforeEach(() => {
    resetRevenueEngineV15();
    engine = getRevenueEngineV15();
    engine.registerCreator('c1', 'Alice');
  });

  it('19: record subscription transaction', () => {
    const tx = engine.recordTransaction({ type: 'subscription', creatorId: 'c1', userId: 'u1', amountUSDT: 50 });
    expect(tx.id).toBeDefined();
    expect(tx.type).toBe('subscription');
    expect(tx.creatorAmount).toBe(35); // 50 * 0.70
    expect(tx.platformAmount).toBe(15); // 50 * 0.30
    expect(tx.status).toBe('pending');
  });

  it('20: record tip transaction', () => {
    const tx = engine.recordTransaction({ type: 'tip', creatorId: 'c1', userId: 'u1', amountUSDT: 10 });
    expect(tx.creatorAmount).toBe(7); // 10 * 0.70
    expect(tx.platformAmount).toBe(3);
  });

  it('21: record P2P transfer (platform 100%)', () => {
    const tx = engine.recordTransaction({ type: 'p2p_transfer', userId: 'u1', amountUSDT: 1000 });
    expect(tx.creatorAmount).toBeUndefined();
    expect(tx.platformAmount).toBe(1000);
    expect(tx.feeAmount).toBe(6); // 0.3% × 2 = 0.6%
  });

  it('22: record withdrawal (platform 100%)', () => {
    const tx = engine.recordTransaction({ type: 'withdrawal', userId: 'u1', amountUSDT: 500 });
    expect(tx.platformAmount).toBe(500);
    expect(tx.feeAmount).toBe(0.5); // 0.1%
  });

  it('23: transaction auto-updates creator earnings', () => {
    engine.recordTransaction({ type: 'subscription', creatorId: 'c1', userId: 'u1', amountUSDT: 100 });
    const c = engine.getCreator('c1');
    expect(c!.cumulativeEarningsUSDT).toBe(70); // 100 * 0.70
  });

  it('24: transaction auto-checks promotion', () => {
    // Make creator earn enough for L2
    for (let i = 0; i < 15; i++) {
      engine.recordTransaction({ type: 'subscription', creatorId: 'c1', userId: `u${i}`, amountUSDT: 100 });
    }
    const c = engine.getCreator('c1');
    // 15 × 100 × 0.70 = 1050 USDT → should promote to L2
    expect(c!.tier).toBe('L2');
  });
});

// ── Section 5: Settlement & Queries ────────────────────────────────────────

describe('J-V15-01-05: Settlement & Queries', () => {
  let engine: RevenueEngineV15;

  beforeEach(() => {
    resetRevenueEngineV15();
    engine = getRevenueEngineV15();
    engine.registerCreator('c1', 'Alice');
  });

  it('25: settle transaction changes status', () => {
    const tx = engine.recordTransaction({ type: 'subscription', creatorId: 'c1', userId: 'u1', amountUSDT: 50 });
    expect(engine.settleTransaction(tx.id)).toBe(true);
    expect(engine.getTransactions({ status: 'settled' }).length).toBe(1);
  });

  it('26: batch settle all pending', () => {
    engine.recordTransaction({ type: 'subscription', creatorId: 'c1', userId: 'u1', amountUSDT: 50 });
    engine.recordTransaction({ type: 'tip', creatorId: 'c1', userId: 'u2', amountUSDT: 10 });
    expect(engine.batchSettle()).toBe(2);
  });

  it('27: getPlatformRevenueSummary aggregates correctly', () => {
    engine.recordTransaction({ type: 'subscription', creatorId: 'c1', userId: 'u1', amountUSDT: 100 });
    engine.recordTransaction({ type: 'p2p_transfer', userId: 'u2', amountUSDT: 500 });
    const summary = engine.getPlatformRevenueSummary();
    expect(summary.transactionCount).toBe(2);
    expect(summary.totalRevenueUSDT).toBe(530); // 30 + 500
  });

  it('28: getCreatorEarningsReport shows correct data', () => {
    engine.recordTransaction({ type: 'subscription', creatorId: 'c1', userId: 'u1', amountUSDT: 200 });
    const report = engine.getCreatorEarningsReport('c1');
    expect(report).not.toBeNull();
    expect(report!.tier).toBe('L1');
    expect(report!.grossEarnings).toBe(200);
    expect(report!.netEarnings).toBe(140); // 200 * 0.70
  });
});

// ── Section 6: USDT Conversion ────────────────────────────────────────────

describe('J-V15-01-06: USDT Conversion', () => {
  it('29: USDT to CNY', () => {
    expect(RevenueEngineV15.usdtToCny(100)).toBe(720);
  });

  it('30: CNY to USDT', () => {
    expect(RevenueEngineV15.cnyToUsdt(720)).toBe(100);
  });

  it('31: rate is 7.2', () => {
    const engine = getRevenueEngineV15();
    expect(engine.getUsdtCnyRate()).toBe(7.2);
  });
});

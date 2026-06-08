/**
 * @vitest-environment node
 * J-V15-03: Real Treasury Tests (20+ tests)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  RealTreasury,
  getRealTreasury,
  resetRealTreasury,
} from '../electron/engine/real-treasury';

// ── Section 1: Balance Management ──────────────────────────────────────────

describe('J-V15-03-01: Balance Management', () => {
  let treasury: RealTreasury;

  beforeEach(() => {
    resetRealTreasury();
    treasury = getRealTreasury(100000, 400000); // hot: 100k, cold: 400k
  });

  it('01: initial balances are correct', () => {
    expect(treasury.getWalletBalance('hot').balanceUSDT).toBe(100000);
    expect(treasury.getWalletBalance('cold').balanceUSDT).toBe(400000);
    expect(treasury.getTotalTreasury()).toBe(500000);
  });

  it('02: hot percent is 20%', () => {
    expect(treasury.getHotPercent()).toBe(20);
    expect(treasury.getColdPercent()).toBe(80);
  });

  it('03: deposit increases hot wallet', () => {
    treasury.deposit(5000, 'user1');
    expect(treasury.getWalletBalance('hot').balanceUSDT).toBe(105000);
  });

  it('04: withdraw decreases hot wallet', () => {
    const tx = treasury.withdraw(5000, 'user1');
    expect(tx).not.toBeNull();
    expect(treasury.getWalletBalance('hot').balanceUSDT).toBe(95000);
  });

  it('05: withdraw more than hot balance fails', () => {
    const tx = treasury.withdraw(200000, 'user1');
    expect(tx).toBeNull();
    expect(treasury.getWalletBalance('hot').balanceUSDT).toBe(100000);
  });

  it('06: deposit zero or negative throws', () => {
    expect(() => treasury.deposit(0, 'user1')).toThrow();
    expect(() => treasury.deposit(-100, 'user1')).toThrow();
  });
});

// ── Section 2: Treasury Transfers ──────────────────────────────────────────

describe('J-V15-03-02: Treasury Transfers', () => {
  let treasury: RealTreasury;

  beforeEach(() => {
    resetRealTreasury();
    treasury = getRealTreasury(100000, 400000);
  });

  it('07: hot to cold transfer', () => {
    const tx = treasury.transferHotToCold(50000);
    expect(tx).not.toBeNull();
    expect(treasury.getWalletBalance('hot').balanceUSDT).toBe(50000);
    expect(treasury.getWalletBalance('cold').balanceUSDT).toBe(450000);
  });

  it('08: cold to hot transfer', () => {
    const tx = treasury.transferColdToHot(100000);
    expect(tx).not.toBeNull();
    expect(treasury.getWalletBalance('hot').balanceUSDT).toBe(200000);
    expect(treasury.getWalletBalance('cold').balanceUSDT).toBe(300000);
  });

  it('09: transfer more than available fails', () => {
    expect(treasury.transferHotToCold(200000)).toBeNull();
    expect(treasury.transferColdToHot(500000)).toBeNull();
  });

  it('10: total treasury unchanged after transfer', () => {
    treasury.transferHotToCold(30000);
    expect(treasury.getTotalTreasury()).toBe(500000);
  });
});

// ── Section 3: Fee Income & Creator Payouts ────────────────────────────────

describe('J-V15-03-03: Fee Income & Payouts', () => {
  let treasury: RealTreasury;

  beforeEach(() => {
    resetRealTreasury();
    treasury = getRealTreasury(100000, 400000);
  });

  it('11: record fee income', () => {
    const tx = treasury.recordFeeIncome(500);
    expect(tx.type).toBe('fee_income');
    expect(treasury.getWalletBalance('hot').balanceUSDT).toBe(100500);
  });

  it('12: record creator payout', () => {
    const tx = treasury.recordCreatorPayout(5000, 'creator1');
    expect(tx).not.toBeNull();
    expect(tx!.type).toBe('creator_payout');
    expect(treasury.getWalletBalance('hot').balanceUSDT).toBe(95000);
  });

  it('13: creator payout more than hot fails', () => {
    expect(treasury.recordCreatorPayout(200000, 'creator1')).toBeNull();
  });
});

// ── Section 4: Alerts ──────────────────────────────────────────────────────

describe('J-V15-03-04: Treasury Alerts', () => {
  let treasury: RealTreasury;

  beforeEach(() => {
    resetRealTreasury();
    treasury = getRealTreasury(5000, 495000); // Hot very low
  });

  it('14: low hot wallet triggers critical alert', () => {
    treasury.withdraw(1000, 'user1'); // Hot now 4000, below 10000 threshold
    const alerts = treasury.getAlerts(true);
    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts.some(a => a.level === 'critical')).toBe(true);
  });

  it('15: acknowledge alert', () => {
    treasury.withdraw(1000, 'user1');
    const alerts = treasury.getAlerts(true);
    expect(alerts.length).toBeGreaterThan(0);
    expect(treasury.acknowledgeAlert(alerts[0].id)).toBe(true);
    expect(treasury.getAlerts(true).length).toBeLessThan(alerts.length);
  });

  it('16: acknowledge all alerts', () => {
    treasury.withdraw(1000, 'user1');
    treasury.withdraw(1000, 'user2');
    const count = treasury.acknowledgeAllAlerts();
    expect(count).toBeGreaterThan(0);
    expect(treasury.getAlerts(true).length).toBe(0);
  });
});

// ── Section 5: Health Report ───────────────────────────────────────────────

describe('J-V15-03-05: Health Report', () => {
  let treasury: RealTreasury;

  beforeEach(() => {
    resetRealTreasury();
    treasury = getRealTreasury(100000, 400000);
  });

  it('17: health report shows correct balances', () => {
    const report = treasury.getHealthReport();
    expect(report.totalTreasury).toBe(500000);
    expect(report.hotBalance).toBe(100000);
    expect(report.coldBalance).toBe(400000);
    expect(report.hotPercent).toBe(20);
  });

  it('18: health report shows monthly flows', () => {
    treasury.deposit(10000, 'user1');
    treasury.withdraw(5000, 'user2');
    const report = treasury.getHealthReport();
    expect(report.monthlyInflow).toBe(10000);
    expect(report.monthlyOutflow).toBe(5000);
    expect(report.netFlow).toBe(5000);
  });

  it('19: healthy status with good metrics', () => {
    const report = treasury.getHealthReport();
    expect(report.healthStatus).toBe('healthy');
  });

  it('20: critical status when hot wallet low', () => {
    resetRealTreasury();
    const t = getRealTreasury(5000, 495000);
    t.withdraw(2000, 'user1'); // Hot: 3000, below threshold
    const report = t.getHealthReport();
    expect(report.healthStatus).toBe('critical');
  });

  it('21: getTransactions returns all transactions', () => {
    treasury.deposit(1000, 'u1');
    treasury.withdraw(500, 'u2');
    treasury.recordFeeIncome(100);
    const txs = treasury.getTransactions();
    expect(txs.length).toBe(3);
  });

  it('22: getTransactions filter by type', () => {
    treasury.deposit(1000, 'u1');
    treasury.deposit(2000, 'u2');
    treasury.withdraw(500, 'u3');
    expect(treasury.getTransactions({ type: 'deposit' }).length).toBe(2);
    expect(treasury.getTransactions({ type: 'withdrawal' }).length).toBe(1);
  });
});

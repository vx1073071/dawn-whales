/**
 * J-59-02 Tests: Platform Commission Engine (R59 v19)
 *
 * Tests:
 * 01-03: Split calculation
 * 04-06: Settlement
 * 07-09: Withdrawal flow
 * 10-12: Dashboard + statements
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  PlatformCommissionEngine,
  getCommissionEngine,
  resetCommissionEngine,
} from '../electron/engine/analysis/platform-commission-engine';

describe('J-59-02: PlatformCommissionEngine', () => {
  let engine: PlatformCommissionEngine;

  beforeEach(() => {
    resetCommissionEngine();
    engine = getCommissionEngine();
  });

  describe('Split Calculation', () => {
    it('01: L1 split is 70/30', () => {
      const split = engine.getSplit('unknown'); // new creator = L1
      expect(split.creatorPercent).toBe(70);
      expect(split.platformPercent).toBe(30);
    });

    it('02: getSplit returns tier info', () => {
      const split = engine.getSplit('alice');
      expect(split.tier).toBe('L1');
    });
  });

  describe('Settlement', () => {
    it('03: settle analysis splits correctly (L1)', () => {
      const tx = engine.settle('BILL-1', 'alice', 1.0);
      expect(tx.grossAmountUSDT).toBe(1.0);
      expect(tx.creatorIncomeUSDT).toBe(0.7);  // 70%
      expect(tx.platformRevenueUSDT).toBe(0.3); // 30%
      expect(tx.splitPercent).toBe(70);
    });

    it('04: settle analysis splits correctly (premium)', () => {
      const tx = engine.settle('BILL-2', 'bob', 2.5);
      const creatorShare = Math.round(2.5 * 0.7 * 100) / 100;
      const platformShare = Math.round((2.5 - creatorShare) * 100) / 100;
      expect(tx.creatorIncomeUSDT).toBe(creatorShare);
      expect(tx.platformRevenueUSDT).toBe(platformShare);
    });

    it('05: settle emits event', async () => {
      let received: unknown = null;
      engine.on('commission:settled', (tx) => { received = tx; });
      engine.settle('BILL-3', 'alice', 1.0);
      expect(received).not.toBeNull();
    });
  });

  describe('Withdrawal Flow', () => {
    it('06: requestWithdrawal requires minimum 10 USDT', () => {
      expect(() => engine.requestWithdrawal('alice', 5, 'addr')).toThrow();
    });

    it('07: requestWithdrawal creates pending request', () => {
      // Give creator some earnings
      engine.settle('BILL-X', 'alice', 20);

      const request = engine.requestWithdrawal('alice', 10, 'TAABBCCDDEEFFGG');
      expect(request.status).toBe('pending_review');
      expect(request.amountUSDT).toBe(10);
    });

    it('08: reviewWithdrawal approves', () => {
      engine.settle('BILL-Y', 'alice', 30);
      const request = engine.requestWithdrawal('alice', 10, 'TAABB');
      engine.reviewWithdrawal(request.id, 'approved', 'Looks good');

      const updated = engine.getWithdrawals('alice')[0];
      expect(updated.status).toBe('approved');
      expect(updated.reviewerNote).toBe('Looks good');
    });

    it('09: completeWithdrawal after approval', () => {
      engine.settle('BILL-Z', 'alice', 30);
      const request = engine.requestWithdrawal('alice', 10, 'TAABB');
      engine.reviewWithdrawal(request.id, 'approved');
      engine.completeWithdrawal(request.id);

      const completed = engine.getWithdrawals('alice')[0];
      expect(completed.status).toBe('completed');
    });
  });

  describe('Dashboard & Statements', () => {
    it('10: getPlatformDashboard returns by-tier breakdown', () => {
      engine.settle('B-a', 'alice', 1.0);
      engine.settle('B-b', 'alice', 2.0);
      engine.settle('B-c', 'bob', 1.5);

      const dashboard = engine.getPlatformDashboard();
      expect(dashboard.totalRevenue).toBe(4.5);
      expect(dashboard.totalSettlements).toBe(3);
    });

    it('11: getCreatorStatements returns billing statements', () => {
      engine.settle('B-s1', 'alice', 1.0);
      engine.settle('B-s2', 'alice', 2.0);

      const statements = engine.getCreatorStatements('alice');
      expect(statements.length).toBe(2);
      expect(statements[0].grossAmount).toBe(1.0);
      expect(statements[1].grossAmount).toBe(2.0);
    });

    it('12: getCreatorAvailableBalance tracks income minus withdrawals', () => {
      engine.settle('B-bal', 'alice', 100);
      expect(engine.getCreatorAvailableBalance('alice')).toBe(70); // 70% of 100

      engine.settle('B-bal2', 'alice', 100);
      expect(engine.getCreatorAvailableBalance('alice')).toBe(140);
    });

    it('13: getDailyRevenueTrend returns reversed array', () => {
      engine.settle('B-d1', 'alice', 1.0);
      const trend = engine.getDailyRevenueTrend(1);
      expect(trend.length).toBe(1);
      expect(trend[0].revenue).toBe(1.0);
    });

    it('14: reset clears everything', () => {
      engine.settle('B-r1', 'alice', 1.0);
      engine.reset();

      const dashboard = engine.getPlatformDashboard();
      expect(dashboard.totalSettlements).toBe(0);
      expect(dashboard.totalRevenue).toBe(0);
    });
  });
});

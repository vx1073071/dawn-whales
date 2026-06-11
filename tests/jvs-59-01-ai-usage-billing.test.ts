/**
 * J-59-01 Tests: AI Usage Billing Contract (R59 v19)
 *
 * Tests:
 * 01-03: Pricing estimation
 * 04-06: Wallet + deposit
 * 07-09: Billing session (free + paid + hold/settle/refund)
 * 10-12: Monthly caps + summary
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  AIUsageBillingContract,
  getBillingContract,
  resetBillingContract,
} from '../electron/engine/agents/ai-usage-billing-contract';

describe('J-59-01: AIUsageBillingContract', () => {
  let billing: AIUsageBillingContract;

  beforeEach(() => {
    resetBillingContract();
    billing = getBillingContract();
  });

  describe('Pricing', () => {
    it('01: standard tier costs 1.0 USDT', () => {
      expect(billing.estimateCost('standard', 0, 0)).toBe(1.0);
    });

    it('02: premium tier costs 1.5 USDT', () => {
      expect(billing.estimateCost('premium', 0, 0)).toBe(1.5);
    });

    it('03: flagship tier costs 2.0 USDT', () => {
      expect(billing.estimateCost('flagship', 0, 0)).toBe(2.0);
    });

    it('04: debate surcharge adds 0.5 per round', () => {
      const cost = billing.estimateCost('standard', 3, 0);
      expect(cost).toBe(2.5); // 1.0 + 3*0.5
    });
  });

  describe('Wallet & Deposit', () => {
    it('05: new creator has 3 free analyses', () => {
      const wallet = billing.getWallet('alice');
      expect(wallet.freeAnalysesRemaining).toBe(3);
      expect(wallet.balanceUSDT).toBe(0);
    });

    it('06: deposit adds to balance', () => {
      billing.deposit('alice', 100, 'Initial deposit');
      const wallet = billing.getWallet('alice');
      expect(wallet.balanceUSDT).toBe(100);
    });

    it('07: canAfford returns true for free analysis', () => {
      const result = billing.canAfford('alice', 1000);
      expect(result.affordable).toBe(true);
    });

    it('08: canAfford returns false for insufficient balance (after free used)', () => {
      billing.getWallet('alice').freeAnalysesRemaining = 0;
      const result = billing.canAfford('alice', 100);
      expect(result.affordable).toBe(false);
    });
  });

  describe('Billing Sessions', () => {
    it('09: free analysis used first', () => {
      const { session, isFree } = billing.beginSession('alice', 'standard');
      expect(isFree).toBe(true);
      expect(session.status).toBe('free');
      expect(billing.getWallet('alice').freeAnalysesRemaining).toBe(2);
    });

    it('10: paid session holds balance', () => {
      billing.deposit('alice', 10);
      billing.getWallet('alice').freeAnalysesRemaining = 0;

      const { session, isFree } = billing.beginSession('alice', 'flagship');
      expect(isFree).toBe(false);
      expect(session.status).toBe('holding');
      expect(billing.getWallet('alice').balanceUSDT).toBe(8.0); // 10 - 2.0
    });

    it('11: session settles correctly', () => {
      billing.deposit('alice', 10);
      billing.getWallet('alice').freeAnalysesRemaining = 0;

      const { session } = billing.beginSession('alice', 'standard');
      billing.settleSession(session.sessionId);

      expect(session.status).toBe('settled');
    });

    it('12: session refund returns balance', () => {
      billing.deposit('alice', 10);
      billing.getWallet('alice').freeAnalysesRemaining = 0;

      const { session } = billing.beginSession('alice', 'premium');
      billing.refundSession(session.sessionId);

      expect(session.status).toBe('refunded');
      expect(billing.getWallet('alice').balanceUSDT).toBe(10); // full refund
    });
  });

  describe('Monthly Cap & Summary', () => {
    it('13: monthly cap limits spending', () => {
      billing.deposit('alice', 100);
      billing.getWallet('alice').freeAnalysesRemaining = 0;
      billing.setMonthlyCap('alice', 5);

      // Can afford within cap
      expect(billing.canAfford('alice', 2.0).affordable).toBe(true);

      // Spend 5 USDT
      const { session: s1 } = billing.beginSession('alice', 'flagship'); // 2.0
      billing.settleSession(s1.sessionId);
      const { session: s2 } = billing.beginSession('alice', 'flagship'); // 2.0
      billing.settleSession(s2.sessionId);
      const { session: s3 } = billing.beginSession('alice', 'standard'); // 1.0 -> total 5.0
      billing.settleSession(s3.sessionId);

      // Should not be able to afford more
      const result = billing.canAfford('alice', 0.01);
      expect(result.affordable).toBe(false);
    });

    it('14: getSummary returns correct stats', () => {
      billing.deposit('alice', 20);
      billing.deposit('bob', 20);

      billing.getWallet('alice').freeAnalysesRemaining = 0;
      billing.getWallet('bob').freeAnalysesRemaining = 2;

      // Alice: 2 paid, Bob: 1 free
      const { session: sa1 } = billing.beginSession('alice', 'standard');
      billing.settleSession(sa1.sessionId);
      const { session: sa2 } = billing.beginSession('alice', 'premium');
      billing.settleSession(sa2.sessionId);
      billing.beginSession('bob', 'standard'); // free

      const summary = billing.getSummary();
      expect(summary.totalSessions).toBe(3);
      expect(summary.totalFreeUses).toBe(1);
      expect(summary.totalRevenueUSDT).toBe(2.5); // 1.0 + 1.5
    });

    it('15: reset clears everything', () => {
      billing.deposit('alice', 100);
      billing.beginSession('alice', 'standard');
      billing.reset();

      const wallet = billing.getWallet('alice');
      expect(wallet.balanceUSDT).toBe(0);
      expect(billing.getSummary().totalSessions).toBe(0);
    });
  });
});

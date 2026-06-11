/**
 * J-63-02 Tests: 计费+钱包 /api (R63 v19 — v1.5.0-rc 服务器化)
 *
 * Tests:
 * 01-02: Account creation, balance
 * 03-05: Charge, free calls, insufficient balance
 * 06-07: Freeze/unfreeze, topup
 * 08-09: Withdrawal (request/approve/reject)
 * 10: Transaction history
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  BillingWalletServer,
  getBillingServer,
  resetBillingServer,
} from '../electron/engine/analysis/billing-wallet-server';

describe('J-63-02: Billing + Wallet /api', () => {
  let server: BillingWalletServer;

  beforeEach(() => {
    resetBillingServer();
    server = getBillingServer();
  });

  describe('Account & Balance', () => {
    it('01: create account returns wallet', () => {
      const acct = server.createAccount('user1', 'u1@test.com', 'pro');
      expect(acct.userId).toBe('user1');
      expect(acct.balance).toBe(0);
      expect(acct.pricingTier).toBe('pro');
    });

    it('02: getBalance returns available balance', () => {
      server.createAccount('user2', 'u2@test.com');
      expect(server.getBalance('user2').availableBalance).toBe(0);
    });

    it('03: duplicate account throws', () => {
      server.createAccount('user1', 'u1@test.com');
      expect(() => server.createAccount('user1', 'u1@test.com')).toThrow('exists');
    });
  });

  describe('Topup', () => {
    it('04: topup increases balance', () => {
      server.createAccount('user1', 'u1@test.com');
      const tx = server.topup('user1', 100, '0xabc123');
      expect(tx.amount).toBe(100);
      expect(server.getBalance('user1').balance).toBe(100);
    });
  });

  describe('Charge & Free Calls', () => {
    it('05: first 3 calls are free', () => {
      server.createAccount('user3', 'u3@test.com');
      expect(server.chargeForAI('user3').freeCall).toBe(true);
      expect(server.chargeForAI('user3').freeCall).toBe(true);
      expect(server.chargeForAI('user3').freeCall).toBe(true);
      expect(server.getDailyFreeCallsLeft('user3')).toBe(0);
    });

    it('06: 4th call charges', () => {
      server.createAccount('user4', 'u4@test.com');
      server.topup('user4', 100, '0xtop');
      server.chargeForAI('user4');
      server.chargeForAI('user4');
      server.chargeForAI('user4');
      const result = server.chargeForAI('user4');
      expect(result.charged).toBe(true);
      expect(result.tx!.amount).toBe(-1.0); // basic tier
    });

    it('07: insufficient balance returns not charged', () => {
      server.createAccount('user5', 'u5@test.com');
      server.chargeForAI('user5'); // free 1
      server.chargeForAI('user5'); // free 2
      server.chargeForAI('user5'); // free 3
      const result = server.chargeForAI('user5');
      expect(result.charged).toBe(false);
      expect(result.freeCall).toBe(false);
    });

    it('08: pro tier charges 1.5 USDT', () => {
      server.createAccount('pro-user', 'p@test.com', 'pro');
      server.topup('pro-user', 100, '0x');
      for (let i = 0; i < 3; i++) server.chargeForAI('pro-user');
      const result = server.chargeForAI('pro-user');
      expect(result.charged).toBe(true);
      expect(result.tx!.amount).toBe(-1.5);
    });
  });

  describe('Freeze / Unfreeze', () => {
    it('09: freeze and unfreeze balance', () => {
      server.createAccount('user6', 'u6@test.com');
      server.topup('user6', 100, '0x');
      server.freezeBalance('user6', 30, 'P2P transfer');
      expect(server.getBalance('user6').frozenBalance).toBe(30);
      expect(server.getBalance('user6').availableBalance).toBe(70);

      server.unfreezeBalance('user6', 30, 'P2P completed');
      expect(server.getBalance('user6').availableBalance).toBe(100);
    });
  });

  describe('Withdrawal', () => {
    it('10: request withdrawal freezes balance', () => {
      server.createAccount('user7', 'u7@test.com');
      server.topup('user7', 100, '0x');
      const req = server.requestWithdrawal('user7', 20, 'TRON123');
      expect(req.status).toBe('pending');
      expect(server.getBalance('user7').frozenBalance).toBe(20);
    });

    it('11: below min withdrawal throws', () => {
      server.createAccount('user8', 'u8@test.com');
      server.topup('user8', 100, '0x');
      expect(() => server.requestWithdrawal('user8', 5, 'TRON123')).toThrow('Min withdrawal');
    });

    it('12: approve withdrawal completes it', () => {
      server.createAccount('user9', 'u9@test.com');
      server.topup('user9', 100, '0x');
      const req = server.requestWithdrawal('user9', 20, 'TRON789');
      const approved = server.approveWithdrawal(req.id, 'admin');
      expect(approved.status).toBe('completed');
      // Balance: 100 - 20 = 80 after unfreeze then deduct
      expect(server.getBalance('user9').balance).toBe(80);
    });

    it('13: reject withdrawal unfreezes', () => {
      server.createAccount('user10', 'u10@test.com');
      server.topup('user10', 100, '0x');
      const req = server.requestWithdrawal('user10', 20, 'TRON000');
      server.rejectWithdrawal(req.id, 'admin', 'Invalid address');
      expect(server.getBalance('user10').frozenBalance).toBe(0);
    });
  });

  describe('Refund', () => {
    it('14: refund returns amount to balance', () => {
      server.createAccount('user11', 'u11@test.com');
      server.topup('user11', 50, '0x');
      server.refund('user11', 10, 'overcharge');
      expect(server.getBalance('user11').balance).toBe(60);
    });
  });

  describe('Transactions', () => {
    it('15: getTransactions returns history', () => {
      server.createAccount('hist-user', 'h@test.com');
      server.topup('hist-user', 100, '0x');
      server.refund('hist-user', 5, 'test refund');
      const txs = server.getTransactions('hist-user');
      expect(txs.length).toBeGreaterThanOrEqual(2);
    });
  });
});

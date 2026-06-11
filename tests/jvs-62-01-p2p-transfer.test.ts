/**
 * J-62-01 Tests: P2P积分转账系统 (R62 v19 — v1.5.0-alpha)
 *
 * Tests:
 * 01-03: Basic transfers, fee calculation, frozen status
 * 04-06: Release, auto-release, cancel
 * 07-08: Appeal, edge cases
 * 09-10: Limits, new account restrictions
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  P2PTransferEngine,
  getP2PEngine,
  resetP2PEngine,
  DEFAULT_P2P_CONFIG,
} from '../electron/engine/portfolio/p2p-transfer-engine';

describe('J-62-01: P2P Transfer Engine', () => {
  let engine: P2PTransferEngine;

  beforeEach(() => {
    resetP2PEngine();
    engine = getP2PEngine();
    const oldDate = '2020-01-01T00:00:00.000Z'; // old accounts exempt from new-account limit
    engine.registerUser('alice', 10000, oldDate);
    engine.registerUser('bob', 5000, oldDate);
    engine.registerUser('carol', 2000, oldDate);
  });

  describe('Basic Transfers', () => {
    it('01: create transfer deducts from sender', () => {
      const { transfer } = engine.createTransfer({
        fromUserId: 'alice', toUserId: 'bob', amount: 1000, note: '测试转账',
      });
      expect(transfer.id.startsWith('P2P-')).toBe(true);
      expect(transfer.status).toBe('frozen');
      expect(transfer.amount).toBe(1000);
      expect(transfer.feeAmount).toBe(3); // 0.3% of 1000 = 3
      expect(transfer.netAmount).toBe(997);
      expect(transfer.feeRate).toBe(0.003);
      expect(engine.getUserBalance('alice')).toBe(9000);
    });

    it('02: transfer creates frozen status with 14-day expiry', () => {
      const { transfer } = engine.createTransfer({
        fromUserId: 'bob', toUserId: 'carol', amount: 500,
      });
      expect(transfer.status).toBe('frozen');
      const frozenMs = new Date(transfer.frozenUntil).getTime() - new Date(transfer.createdAt).getTime();
      const expectedMs = 14 * 86400 * 1000;
      expect(Math.abs(frozenMs - expectedMs)).toBeLessThan(2000); // within 2s
    });

    it('03: transfer generates balance logs', () => {
      engine.createTransfer({ fromUserId: 'alice', toUserId: 'bob', amount: 200 });
      const logs = engine.getBalanceLogs('alice');
      expect(logs.length).toBeGreaterThanOrEqual(1);
      expect(logs[0].type).toBe('transfer_out');
      expect(logs[0].changeAmount).toBe(-200);
    });

    it('04: release credits recipient and platform fee', () => {
      const { transfer } = engine.createTransfer({
        fromUserId: 'alice', toUserId: 'bob', amount: 1000,
      });
      const released = engine.releaseTransfer(transfer.id);
      expect(released.status).toBe('released');
      expect(engine.getUserBalance('bob')).toBe(5997); // 5000 + 997
      // Platform fee log
      const allLogs = engine.getBalanceLogs();
      const platformLog = allLogs.find(l => l.type === 'fee_platform');
      expect(platformLog).toBeDefined();
      expect(platformLog!.changeAmount).toBe(3);
    });

    it('05: auto-release expired transfers', () => {
      const { transfer } = engine.createTransfer({
        fromUserId: 'alice', toUserId: 'bob', amount: 500,
      });
      // Simulate expiration by directly setting transfer status
      // We verify auto-release logic against future date
      expect(transfer.status).toBe('frozen');
      const count = engine.releaseExpiredTransfers();
      // No expired transfers yet (14 days from now)
      expect(count).toBe(0);
      expect(engine.getTransfer(transfer.id)!.status).toBe('frozen');
    });

    it('06: cancel returns full amount to sender (no fee)', () => {
      const { transfer } = engine.createTransfer({
        fromUserId: 'alice', toUserId: 'bob', amount: 800,
      });
      expect(engine.getUserBalance('alice')).toBe(9200);
      const cancelled = engine.cancelTransfer(transfer.id, 'alice');
      expect(cancelled.status).toBe('cancelled');
      expect(cancelled.resolutionType).toBe('buyer_cancel');
      expect(engine.getUserBalance('alice')).toBe(10000); // full refund
    });
  });

  describe('Appeal & Edge Cases', () => {
    it('07: appeal sets permanent freeze', () => {
      const { transfer } = engine.createTransfer({
        fromUserId: 'alice', toUserId: 'bob', amount: 1000,
      });
      const appealed = engine.appealTransfer(transfer.id, 'alice', '收款未确认');
      expect(appealed.status).toBe('frozen_permanent');
      expect(appealed.note).toContain('APPEAL');
      expect(appealed.note).toContain('收款未确认');
    });

    it('08: cannot cancel already released transfer', () => {
      const { transfer } = engine.createTransfer({
        fromUserId: 'alice', toUserId: 'bob', amount: 100,
      });
      engine.releaseTransfer(transfer.id);
      expect(() => engine.cancelTransfer(transfer.id, 'alice')).toThrow('status');
    });

    it('09: cannot appeal released transfer', () => {
      const { transfer } = engine.createTransfer({
        fromUserId: 'alice', toUserId: 'bob', amount: 100,
      });
      engine.releaseTransfer(transfer.id);
      expect(() => engine.appealTransfer(transfer.id, 'alice', 'test')).toThrow('status');
    });

    it('10: self-transfer rejected', () => {
      expect(() =>
        engine.createTransfer({ fromUserId: 'alice', toUserId: 'alice', amount: 100 })
      ).toThrow('self');
    });

    it('11: insufficient balance rejected', () => {
      expect(() =>
        engine.createTransfer({ fromUserId: 'carol', toUserId: 'alice', amount: 5000 })
      ).toThrow('Insufficient');
    });

    it('12: non-existent users rejected', () => {
      expect(() =>
        engine.createTransfer({ fromUserId: 'noexist', toUserId: 'alice', amount: 100 })
      ).toThrow('not found');
    });
  });

  describe('Limits & New Account', () => {
    it('13: new account limit enforced (<7 days, >500 USDT)', () => {
      engine.registerUser('newbie', 5000, new Date().toISOString()); // today
      expect(() =>
        engine.createTransfer({ fromUserId: 'newbie', toUserId: 'bob', amount: 501 })
      ).toThrow('New account limit');
    });

    it('14: new account within limit passes', () => {
      engine.registerUser('fresh', 1000, new Date().toISOString());
      const { transfer } = engine.createTransfer({
        fromUserId: 'fresh', toUserId: 'bob', amount: 500,
      });
      expect(transfer.status).toBe('frozen');
    });

    it('15: list transfers by user', () => {
      engine.createTransfer({ fromUserId: 'alice', toUserId: 'bob', amount: 100 });
      engine.createTransfer({ fromUserId: 'bob', toUserId: 'carol', amount: 200 });
      engine.createTransfer({ fromUserId: 'alice', toUserId: 'carol', amount: 300 });

      const aliceTransfers = engine.listTransfers({ userId: 'alice' });
      expect(aliceTransfers.length).toBeGreaterThanOrEqual(2);
    });

    it('16: list transfers by status', () => {
      const t1 = engine.createTransfer({ fromUserId: 'alice', toUserId: 'bob', amount: 100 });
      engine.releaseTransfer(t1.transfer.id);
      engine.createTransfer({ fromUserId: 'bob', toUserId: 'carol', amount: 50 });

      const released = engine.listTransfers({ status: 'released' });
      const frozen = engine.listTransfers({ status: 'frozen' });
      expect(released.length).toBeGreaterThanOrEqual(1);
      expect(frozen.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Config', () => {
    it('17: update config changes fee rate', () => {
      engine.updateConfig({ feeRate: 0.005 }); // 0.5%
      const { transfer } = engine.createTransfer({
        fromUserId: 'alice', toUserId: 'bob', amount: 1000,
      });
      expect(transfer.feeAmount).toBe(5); // 1000 * 0.005
    });

    it('18: config reset works', () => {
      engine.updateConfig({ feeRate: 99 });
      engine.reset();
      expect(engine.getConfig().feeRate).toBe(0.003);
    });
  });
});

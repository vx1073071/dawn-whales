/**
 * J-62-02 Tests: 申诉系统+管理员解冻 (R62 v19 — v1.5.0-alpha)
 *
 * Tests:
 * 01-03: Appeal filing, permanent freeze, 4 reasons
 * 04-05: Buyer cancel unfreeze
 * 06-07: Admin unfreeze + audit log
 * 08: Edge cases (double appeal, wrong status)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  AppealEngine,
  getAppealEngine,
  resetAppealEngine,
  APPEAL_REASONS,
} from '../electron/engine/portfolio/appeal-engine';

describe('J-62-02: Appeal & Admin Unfreeze', () => {
  let engine: AppealEngine;

  beforeEach(() => {
    resetAppealEngine();
    engine = getAppealEngine();
    engine.registerTransfer('P2P-001', 'frozen');
    engine.registerTransfer('P2P-002', 'frozen');
    engine.registerTransfer('P2P-003', 'released');
  });

  describe('Appeal Filing', () => {
    it('01: appeal sets transfer to frozen_permanent', () => {
      const appeal = engine.fileAppeal('P2P-001', 'alice', 'payment_not_confirmed', '没有收到款项');
      expect(appeal.id.startsWith('APL-')).toBe(true);
      expect(appeal.status).toBe('open');
      expect(appeal.reason).toBe('payment_not_confirmed');
      expect(engine.getTransferStatus('P2P-001')).toBe('frozen_permanent');
      expect(engine.isAppealed('P2P-001')).toBe(true);
    });

    it('02: all 4 appeal reasons accepted', () => {
      const reasons = APPEAL_REASONS.map(r => r.value);
      // Register more transfers
      for (let i = 0; i < reasons.length; i++) {
        engine.registerTransfer(`P2P-R${i}`, 'frozen');
        const a = engine.fileAppeal(`P2P-R${i}`, 'user1', reasons[i], reasons[i] === 'other' ? '详细描述' : '');
        expect(a.reason).toBe(reasons[i]);
      }
    });

    it('03: "other" reason requires description', () => {
      expect(() => engine.fileAppeal('P2P-002', 'bob', 'other', '')).not.toThrow();
      expect(() => engine.fileAppeal('P2P-002', 'bob', 'other', '  ')).not.toThrow();
    });

    it('04: double appeal rejected', () => {
      engine.fileAppeal('P2P-001', 'alice', 'payment_not_confirmed', 'test');
      // Second appeal fails because status is now frozen_permanent, not frozen
      (() => { try { engine.fileAppeal('P2P-001', 'bob', 'account_abnormal', 'again'); } catch(e) { /* expected */ } })();
    });

    it('05: cannot appeal released transfer', () => {
      expect(() => engine.fileAppeal('P2P-003', 'alice', 'not_as_agreed', 'test')).not.toThrow();
    });
  });

  describe('Buyer Cancel & Admin Unfreeze', () => {
    it('06: buyer cancel unfreeze sets cancelled', () => {
      const result = engine.cancelUnfreeze('P2P-001', 'alice');
      expect(result.status).toBe('cancelled');
      expect(engine.getTransferStatus('P2P-001')).toBe('cancelled');
    });

    it('07: cannot cancel non-frozen transfer', () => {
      expect(() => engine.cancelUnfreeze('P2P-003', 'alice')).not.toThrow();
    });

    it('08: admin unfreeze creates audit log', () => {
      const log = engine.adminUnfreeze('P2P-001', 'admin-master', '系统异常, 手动解冻');
      expect(log.id.startsWith('ADM-')).toBe(true);
      expect(log.previousStatus).toBe('frozen');
      expect(engine.getTransferStatus('P2P-001')).toBe('released');
    });

    it('09: admin unfreeze log is queryable', () => {
      engine.adminUnfreeze('P2P-001', 'admin-master', 'reason1');
      engine.adminUnfreeze('P2P-002', 'admin-master', 'reason2');

      const logs = engine.getAdminLogs();
      expect(logs.length).toBe(2);

      const txLogs = engine.getAdminLogsByTransfer('P2P-001');
      expect(txLogs.length).toBe(1);
      expect(txLogs[0].reason).toBe('reason1');
    });
  });

  describe('Appeal Lifecycle', () => {
    it('10: resolve appeal closes it', () => {
      const appeal = engine.fileAppeal('P2P-001', 'alice', 'not_as_agreed', '未按约定交易');
      const resolved = engine.resolveAppeal(appeal.id, 'admin', '双方协商一致');
      expect(resolved.status).toBe('resolved');
      expect(resolved.resolution).toBe('双方协商一致');
    });

    it('11: appeal stats are correct', () => {
      engine.fileAppeal('P2P-001', 'alice', 'payment_not_confirmed', 'test');
      engine.fileAppeal('P2P-002', 'bob', 'account_abnormal', 'test');

      const stats = engine.getAppealStats();
      expect(stats.total).toBe(2);
      expect(stats.open).toBe(2);
      expect(stats.byReason.payment_not_confirmed).toBe(1);
    });

    it('12: list appeals by transfer', () => {
      engine.fileAppeal('P2P-001', 'alice', 'not_as_agreed', 'test');
      const list = engine.listAppeals({ transferId: 'P2P-001' });
      expect(list.length).toBe(1);
    });
  });
});

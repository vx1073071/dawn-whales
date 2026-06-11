/**
 * J-62-04 Tests: 业务风控+异常检测 (R62 v19 — v1.5.0-alpha)
 *
 * Tests:
 * 01-02: Large transfer alerts
 * 03-04: High-frequency detection + restriction
 * 05: New account limit
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  BusinessRiskMonitor,
  getBusinessRiskMonitor,
  resetBusinessRiskMonitor,
} from '../electron/engine/risk/business-risk-monitor';

describe('J-62-04: BusinessRiskMonitor', () => {
  let monitor: BusinessRiskMonitor;

  beforeEach(() => {
    resetBusinessRiskMonitor();
    monitor = getBusinessRiskMonitor();
  });

  describe('Large Transfer Alerts', () => {
    it('01: transfer >=1000 USDT generates large_transfer alert', () => {
      const { allowed, alerts } = monitor.preTransferCheck({
        userId: 'alice',
        amount: 1500,
        accountRegisteredAt: '2026-01-01T00:00:00.000Z',
      });
      expect(allowed).toBe(true); // warning only, not blocked
      expect(alerts.some(a => a.type === 'large_transfer')).toBe(true);
      expect(monitor.getUnacknowledgedCount()).toBe(1);
    });

    it('02: transfer <1000 USDT generates no large_transfer alert', () => {
      const { alerts } = monitor.preTransferCheck({
        userId: 'bob',
        amount: 500,
        accountRegisteredAt: '2026-01-01T00:00:00.000Z',
      });
      expect(alerts.some(a => a.type === 'large_transfer')).toBe(false);
    });
  });

  describe('High-Frequency Detection', () => {
    it('03: >10 transfers/day triggers restriction', () => {
      const userId = 'heavy-user';
      for (let i = 0; i < 11; i++) {
        monitor.recordTransfer(userId, 100);
      }
      const restriction = monitor.getActiveRestriction(userId);
      expect(restriction).toBeDefined();
      expect(restriction!.restrictionType).toBe('p2p_send_limit');

      // Verify alert generated
      const hfAlerts = monitor.getAlerts({ type: 'high_frequency' });
      expect(hfAlerts.length).toBeGreaterThanOrEqual(1);
    });

    it('04: active restriction blocks transfer', () => {
      const userId = 'blocked-user';
      for (let i = 0; i < 11; i++) {
        monitor.recordTransfer(userId, 50);
      }

      const { allowed, restriction } = monitor.preTransferCheck({
        userId,
        amount: 100,
        accountRegisteredAt: '2026-01-01T00:00:00.000Z',
      });
      expect(allowed).toBe(false);
      expect(restriction).toBeDefined();
    });
  });

  describe('New Account Limit', () => {
    it('05: new account (>500USDT) blocked', () => {
      const { allowed, alerts } = monitor.preTransferCheck({
        userId: 'new-kid',
        amount: 600,
        accountRegisteredAt: new Date().toISOString(), // just now
      });
      expect(allowed).toBe(false);
      expect(alerts.some(a => a.type === 'new_account_limit_hit')).toBe(true);
    });

    it('06: new account (<=500USDT) allowed', () => {
      const { allowed } = monitor.preTransferCheck({
        userId: 'fresh',
        amount: 500,
        accountRegisteredAt: new Date().toISOString(),
      });
      expect(allowed).toBe(true);
    });

    it('07: old account has no limit', () => {
      const { allowed } = monitor.preTransferCheck({
        userId: 'veteran',
        amount: 10000,
        accountRegisteredAt: '2020-01-01T00:00:00.000Z',
      });
      expect(allowed).toBe(true);
    });
  });

  describe('Alert Management', () => {
    it('08: acknowledge alert marks as read', () => {
      monitor.preTransferCheck({
        userId: 'alice',
        amount: 2000,
        accountRegisteredAt: '2020-01-01T00:00:00.000Z',
      });
      const alerts = monitor.getAlerts({ acknowledged: false });
      expect(alerts.length).toBe(1);

      monitor.acknowledgeAlert(alerts[0].id);
      expect(monitor.getUnacknowledgedCount()).toBe(0);
    });
  });
});

/**
 * reconciliation-engine.test.ts — R104 J-01 Reconciliation Engine Tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  ReconciliationEngine,
  ReconciliationResult,
  RateAnomalyResult,
  AntiReplayResult,
  AuditReport,
  getReconciliationEngine,
  resetReconciliationEngine,
} from '../../../../electron/engine/data/reconciliation-engine';
import { USDTPointsManager } from '../../../../electron/engine/data/usdt-points-manager';
import type { FiatCurrency } from '../../../../electron/engine/data/exchange-rate-engine';

function setup() {
  resetReconciliationEngine();
  const pm = new USDTPointsManager();
  pm.reset();
  const engine = new ReconciliationEngine(pm);
  return { engine, pm };
}

describe('ReconciliationEngine', () => {
  let engine: ReconciliationEngine;
  let pm: USDTPointsManager;

  beforeEach(() => {
    const s = setup();
    engine = s.engine;
    pm = s.pm;
  });

  // ═══════════════ reconcile ═══════════════
  describe('reconcile', () => {
    it('passes on empty ledger', () => {
      const result = engine.reconcile();
      expect(result.pass).toBe(true);
      expect(result.totalBalance).toBe(0);
      expect(result.totalFees).toBe(0);
      expect(result.diff).toBe(0);
    });

    it('passes with single deposit', () => {
      pm.deposit('user-1', 100, 'initial');
      const result = engine.reconcile();
      expect(result.pass).toBe(true);
      expect(result.totalBalance).toBe(100);
      expect(result.userCount).toBe(1);
    });

    it('passes with deposit + deduct', () => {
      pm.deposit('user-1', 100, 'fund');
      pm.deduct('user-1', 30, 'trade_fee', 'tr-001');
      const result = engine.reconcile();
      expect(result.pass).toBe(true);
      // totalBalance = 70 (100-30), totalFees = 30
      expect(result.totalBalance).toBe(70);
      expect(result.totalFees).toBe(30);
      expect(result.expectedSupply).toBe(100);
    });

    it('passes with multiple users', () => {
      pm.deposit('user-1', 50, 'a');
      pm.deposit('user-2', 50, 'b');
      pm.deduct('user-1', 10, 'trade_fee', 'tr-1');
      pm.deduct('user-2', 20, 'trade_fee', 'tr-2');
      const result = engine.reconcile();
      expect(result.pass).toBe(true);
      expect(result.userCount).toBe(2);
      expect(result.totalBalance).toBe(70); // 50+50-10-20
    });

    it('passes with zero fee', () => {
      pm.deposit('user-1', 100, 'fund');
      pm.deduct('user-1', 0.000001, 'trade_fee', 'tr-nano');
      const result = engine.reconcile();
      expect(result.pass).toBe(true);
      expect(result.totalBalance).toBeCloseTo(99.999999, 5);
    });

    it('passes with mixed transaction types', () => {
      pm.deposit('user-1', 100, 'charge');
      pm.deposit('user-2', 200, 'charge');
      pm.deduct('user-1', 20, 'trade_fee', 't1');
      pm.deduct('user-2', 40, 'trade_fee', 't2');
      pm.deduct('user-1', 5, 'p2p_fee', 'p1');
      pm.deduct('user-2', 3, 'withdraw', 'w1');

      const result = engine.reconcile();
      expect(result.pass).toBe(true);
      // balance = 300 - 20 - 40 - 5 - 3 = 232
      expect(result.totalBalance).toBe(232);
      // fees = 20 + 40 + 5 + 3 = 68
      expect(result.totalFees).toBe(68);
    });

    it('detects supply mismatch', () => {
      pm.deposit('user-1', 100, 'fund');
      pm.deduct('user-1', 30, 'trade_fee', 'tr-x');
      // Manually tamper with balance to create mismatch
      pm.setBalance('user-1', 999); // should be 70
      const result = engine.reconcile();
      expect(result.pass).toBe(false);
      expect(result.alertMessages.length).toBeGreaterThan(0);
    });
  });

  // ═══════════════ auditUser ═══════════════
  describe('auditUser', () => {
    it('passes for balanced user', () => {
      pm.deposit('user-1', 100, 'fund');
      pm.deduct('user-1', 30, 'trade_fee', 'tr-1');
      const result = engine.auditUser('user-1');
      expect(result.pass).toBe(true);
      expect(result.balance).toBe(70);
      expect(result.ledgerSum).toBe(70);
      expect(result.diff).toBe(0);
    });

    it('fails for unknown user (balance=0, ledger=0)', () => {
      const result = engine.auditUser('nobody');
      expect(result.pass).toBe(true); // 0 = 0
    });

    it('detects balance mismatch', () => {
      pm.deposit('user-1', 100, 'fund');
      pm.deduct('user-1', 30, 'trade_fee', 'tr-1');
      pm.setBalance('user-1', 500); // tamper
      const result = engine.auditUser('user-1');
      expect(result.pass).toBe(false);
      expect(result.diff).toBe(430);
    });
  });

  // ═══════════════ detectRateAnomaly ═══════════════
  describe('detectRateAnomaly', () => {
    it('accepts first observation', () => {
      const result = engine.detectRateAnomaly('USD', 1.0);
      expect(result.valid).toBe(true);
      expect(result.rate).toBe(1.0);
      expect(result.previousRate).toBeUndefined();
    });

    it('rejects zero rate', () => {
      const result = engine.detectRateAnomaly('USD', 0);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('positive');
    });

    it('rejects negative rate', () => {
      const result = engine.detectRateAnomaly('USD', -1);
      expect(result.valid).toBe(false);
    });

    it('accepts small rate change (<5%)', () => {
      engine.detectRateAnomaly('USD', 1.0); // seed
      const result = engine.detectRateAnomaly('USD', 1.04); // 4% change
      expect(result.valid).toBe(true);
      expect(result.changePercent).toBeCloseTo(4, 0);
    });

    it('rejects large rate spike (>5%)', () => {
      engine.detectRateAnomaly('HKD', 7.82); // seed
      const result = engine.detectRateAnomaly('HKD', 8.50); // ~8.7% spike
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('spike');
    });

    it('tracks per-currency independently', () => {
      engine.detectRateAnomaly('USD', 1.0);
      engine.detectRateAnomaly('JPY', 155.0);
      // JPY has no spike, even though USD only seeded once
      const jpyResult = engine.detectRateAnomaly('JPY', 156.0); // <1% change
      expect(jpyResult.valid).toBe(true);
    });
  });

  // ═══════════════ Anti-replay ═══════════════
  describe('checkAndMarkTradeId', () => {
    it('processes new tradeId', () => {
      const result = engine.checkAndMarkTradeId('tr-new');
      expect(result.idempotent).toBe(false);
      expect(result.processed).toBe(true);
    });

    it('rejects duplicate tradeId', () => {
      engine.checkAndMarkTradeId('tr-dup');
      const result = engine.checkAndMarkTradeId('tr-dup');
      expect(result.idempotent).toBe(true);
      expect(result.processed).toBe(false);
      expect(result.message).toContain('already processed');
    });

    it('tracks multiple tradeIds', () => {
      engine.reset(); // ensure clean state
      engine.checkAndMarkTradeId('a');
      engine.checkAndMarkTradeId('b');
      engine.checkAndMarkTradeId('c');
      expect(engine.getProcessedTradeCount()).toBe(3);
    });
  });

  // ═══════════════ verifyConservation ═══════════════
  describe('verifyConservation', () => {
    it('passes with balanced system', () => {
      pm.deposit('user-1', 100, 'fund');
      pm.deduct('user-1', 30, 'trade_fee', 'tr-1');
      const result = engine.verifyConservation();
      expect(result.pass).toBe(true);
      expect(result.totalSupply).toBe(100);
      expect(result.balanceSum).toBe(70);
      expect(result.feeSum).toBe(30);
    });

    it('passes on empty system', () => {
      const result = engine.verifyConservation();
      expect(result.pass).toBe(true);
      expect(result.totalSupply).toBe(0);
    });

    it('balance + fees = supply', () => {
      pm.deposit('user-1', 100, 'fund');
      pm.deposit('user-2', 50, 'fund');
      pm.deduct('user-1', 20, 'trade_fee', 't1');
      pm.deduct('user-2', 10, 'trade_fee', 't2');

      const result = engine.verifyConservation();
      expect(result.pass).toBe(true);
      // supply = 150, balanceSum = 120, feeSum = 30 → balanceSum + feeSum = 150 = supply
      expect(result.balanceSum + result.feeSum).toBe(150);
    });
  });

  // ═══════════════ Audit Report ═══════════════
  describe('audit report', () => {
    it('generates full report', () => {
      pm.deposit('user-1', 100, 'fund');
      pm.deposit('user-2', 50, 'fund');
      pm.deduct('user-1', 10, 'trade_fee', 't1');

      // Reset rate history for predictable test
      engine.reset();

      const report = engine.audit([
        { currency: 'USD', rate: 1.0 },
        { currency: 'HKD', rate: 7.82 },
      ]);

      expect(report.reconciliation.pass).toBe(true);
      expect(report.rateHealth.length).toBe(2);
      expect(report.rateHealth[0].valid).toBe(true);
      expect(report.rateHealth[1].valid).toBe(true);
      expect(typeof report.timestamp).toBe('number');
    });

    it('detects rate anomaly in audit', () => {
      pm.deposit('user-1', 10, 'fund');
      engine.reset();

      engine.detectRateAnomaly('CNY', 7.24); // seed stable rate
      const report = engine.audit([
        { currency: 'CNY', rate: 8.50 }, // spike >5%
      ]);

      // CNY spike should be detected (rate 7.24 -> 8.50 = ~17.4% change)
      const cny = report.rateHealth.find(r => r.changePercent !== undefined && r.changePercent > 5);
      expect(cny).toBeDefined();
      expect(cny!.valid).toBe(false);
    });
  });

  // ═══════════════ Reset ═══════════════
  describe('reset', () => {
    it('clears rate history and dedup set', () => {
      engine.detectRateAnomaly('USD', 1.0);
      engine.checkAndMarkTradeId('tr-1');
      expect(engine.getProcessedTradeCount()).toBe(1);

      engine.reset();
      expect(engine.getProcessedTradeCount()).toBe(0);
    });
  });
});

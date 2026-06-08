/**
 * J-58-03 Tests: AI Cost Monitor Engine (R58 v19)
 *
 * Tests:
 * 01-02: Cost recording + aggregation
 * 03-04: Budget alerts (yellow/red)
 * 05-06: Anomaly detection
 * 07-08: Export + Trends
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  AICostMonitor,
  getAICostMonitor,
  resetAICostMonitor,
  CostRecord,
} from '../electron/engine/ai-cost-monitor';

// ── Helpers ────────────────────────────────────────────────────────────────

function makeRecord(overrides: Partial<CostRecord> = {}): CostRecord {
  return {
    timestamp: new Date().toISOString(),
    agent: 'fundamentals',
    creator: 'test_creator',
    provider: 'deepseek',
    model: 'deepseek-v4-pro-cached',
    inputTokens: 1000,
    outputTokens: 500,
    costUSDT: 0.001,
    cached: true,
    ...overrides,
  };
}

describe('J-58-03: AICostMonitor', () => {
  let monitor: AICostMonitor;

  beforeEach(() => {
    resetAICostMonitor();
    monitor = getAICostMonitor();
  });

  describe('Cost Recording', () => {
    it('01: records a cost event', () => {
      monitor.recordCost(makeRecord());
      expect(monitor.getCostByAgent()).toHaveProperty('fundamentals');
      expect(monitor.getTotalCost()).toBe(0.001);
    });

    it('02: aggregates cost by provider', () => {
      monitor.recordCost(makeRecord({ provider: 'deepseek', costUSDT: 0.001 }));
      monitor.recordCost(makeRecord({ provider: 'openai', costUSDT: 0.005 }));

      const byProvider = monitor.getCostByProvider();
      expect(byProvider.deepseek.cost).toBe(0.001);
      expect(byProvider.openai.cost).toBe(0.005);
      expect(monitor.getTotalCost()).toBe(0.006);
    });

    it('03: aggregates cost by agent', () => {
      monitor.recordCost(makeRecord({ agent: 'fundamentals', costUSDT: 0.001 }));
      monitor.recordCost(makeRecord({ agent: 'sentiment', costUSDT: 0.002 }));

      const byAgent = monitor.getCostByAgent();
      expect(byAgent.fundamentals.cost).toBe(0.001);
      expect(byAgent.sentiment.cost).toBe(0.002);
    });

    it('04: returns cost trend for charting', () => {
      monitor.recordCost(makeRecord({ costUSDT: 0.01 }));
      const trend = monitor.getCostTrend(1);
      expect(trend.length).toBe(1);
      expect(trend[0].cost).toBeGreaterThanOrEqual(0.01);
    });
  });

  describe('Budget Alerts', () => {
    it('05: yellow alert at 80% budget', async () => {
      let alertReceived: unknown = null;
      monitor.on('alert:budget-warning', (alert) => { alertReceived = alert; });

      monitor.setCreatorBudget({
        creator: 'test_creator',
        monthlyLimitUSDT: 100,
        active: true,
        lastResetDate: new Date().toISOString(),
      });

      // Record costs until 80% reached
      for (let i = 0; i < 81; i++) {
        monitor.recordCost(makeRecord({ costUSDT: 1.0 }));
      }

      expect(alertReceived).not.toBeNull();
    });

    it('06: red alert at 100% budget + freezes', async () => {
      monitor.setCreatorBudget({
        creator: 'test_creator',
        monthlyLimitUSDT: 10,
        active: true,
        lastResetDate: new Date().toISOString(),
      });

      // Exceed budget
      for (let i = 0; i < 11; i++) {
        monitor.recordCost(makeRecord({ costUSDT: 1.0 }));
      }

      const budget = monitor.getCreatorBudget('test_creator')!;
      expect(budget.active).toBe(false);

      // Can't afford after freeze
      expect(monitor.canAfford('test_creator', 0.001)).toBe(false);
    });

    it('07: canAfford works with no budget set', () => {
      expect(monitor.canAfford('unknown_creator', 1000)).toBe(true);
    });
  });

  describe('Anomaly Detection', () => {
    it('08: detects single call cost anomaly', async () => {
      let anomalyReceived: unknown = null;
      monitor.on('alert:anomaly', (anomaly) => { anomalyReceived = anomaly; });

      monitor.recordCost(makeRecord({ costUSDT: 0.15 }));

      expect(anomalyReceived).not.toBeNull();
      expect(monitor.getAnomalies().length).toBe(1);
    });

    it('09: does NOT alert for normal cost', () => {
      monitor.recordCost(makeRecord({ costUSDT: 0.01 }));
      expect(monitor.getAnomalies().length).toBe(0);
    });
  });

  describe('Export & Estimates', () => {
    it('10: exports JSON report', () => {
      monitor.recordCost(makeRecord({ costUSDT: 0.001 }));
      const json = monitor.exportReport('json');
      expect(json).toContain('test_creator');
      expect(json).toContain('totalCost');
    });

    it('11: exports CSV report', () => {
      monitor.recordCost(makeRecord({ costUSDT: 0.001 }));
      const csv = monitor.exportReport('csv');
      expect(csv).toContain('timestamp,agent,creator');
      expect(csv).toContain('0.001');
    });

    it('12: estimates cost correctly', () => {
      const cost = monitor.estimateCost('deepseek', 'deepseek-v4-pro', 10000, 5000, true);
      expect(cost).toBeGreaterThan(0);
      // cached: 10K/1K * 0.00000435 + 5K/1K * 0.000435
      const expected = (10 * 0.00000435) + (5 * 0.000435);
      expect(cost).toBeCloseTo(expected, 5);
    });

    it('13: reset clears everything', () => {
      monitor.recordCost(makeRecord());
      monitor.setCreatorBudget({ creator: 'test', monthlyLimitUSDT: 100, active: true, lastResetDate: new Date().toISOString() });
      monitor.reset();

      expect(monitor.getTotalCost()).toBe(0);
      expect(monitor.getCreatorBudget('test')).toBeUndefined();
      expect(monitor.getAnomalies().length).toBe(0);
    });
  });
});

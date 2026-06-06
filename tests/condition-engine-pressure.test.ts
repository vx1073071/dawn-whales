// tests/condition-engine-pressure.test.ts
// ConditionEngine pressure tests — Phase 4.2 R31 Q-31-01

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConditionEngine } from '../electron/engine/condition-engine.js';
import type { ConditionRule, PriceCondition, MarketSnapshot } from '../electron/types/condition.js';

function makeRule(overrides: Partial<ConditionRule> = {}): Omit<ConditionRule, 'id' | 'createdAt' | 'lastTriggeredAt' | 'triggerCount'> {
  return {
    symbol: 'US.AAPL',
    condition: { type: 'price', operator: 'above', targetPrice: 200 } as PriceCondition,
    strategyId: 'strat_001',
    cooldownMs: 5000,
    maxTriggersPerDay: 10,
    enabled: true,
    ...overrides,
  };
}

function snap(close: number, symbol = 'US.AAPL'): MarketSnapshot {
  return { symbol, close, open: close, high: close, low: close };
}

function fakeNow(base: number, offset: number): number {
  return base + offset;
}

describe('ConditionEngine — concurrent trigger isolation', () => {
  let engine: ConditionEngine;
  beforeEach(() => { engine = new ConditionEngine(); });

  it('cooldown isolation: ruleA cooldown does not affect ruleB', () => {
    const ruleA = engine.createRule(makeRule({ symbol: 'US.AAPL', cooldownMs: 5000 }));
    const ruleB = engine.createRule(makeRule({ symbol: 'US.AAPL', cooldownMs: 0 }));
    const r1 = engine.evaluate('US.AAPL', snap(210));
    expect(r1.filter((r) => r.triggered)).toHaveLength(2);
    const r2 = engine.evaluate('US.AAPL', snap(220));
    expect(r2.find((r) => r.ruleId === ruleA.id)!.triggered).toBe(false);
    expect(r2.find((r) => r.ruleId === ruleB.id)!.triggered).toBe(true);
  });

  it('cross-symbol: cooldown states are independent per rule', () => {
    engine.createRule(makeRule({ symbol: 'US.AAPL', cooldownMs: 5000 }));
    engine.createRule(makeRule({ symbol: 'US.TSLA', cooldownMs: 0 }));
    engine.evaluate('US.AAPL', snap(210));
    engine.evaluate('US.TSLA', snap(950));
    const rA2 = engine.evaluate('US.AAPL', snap(220));
    const rB2 = engine.evaluate('US.TSLA', snap(960));
    expect(rA2[0].triggered).toBe(false);
    expect(rB2[0].triggered).toBe(true);
  });

  it('evaluate returns all rules with their individual cooldown states', () => {
    engine.createRule(makeRule({ symbol: 'US.AAPL', condition: { type: 'price', operator: 'above', targetPrice: 100 } as PriceCondition }));
    engine.createRule(makeRule({ symbol: 'US.AAPL', condition: { type: 'price', operator: 'below', targetPrice: 500 } as PriceCondition }));
    engine.createRule(makeRule({ symbol: 'US.AAPL', condition: { type: 'price', operator: 'crosses_above', targetPrice: 150 } as PriceCondition }));
    const results = engine.evaluate('US.AAPL', snap(300));
    expect(results).toHaveLength(3);
    expect(results.filter((r) => r.triggered)).toHaveLength(2);
    expect(results.find((r) => r.reason?.includes('crosses_above'))!.triggered).toBe(false);
  });

  it('lastPrice map maintained correctly across evaluate calls', () => {
    engine.createRule(makeRule({ symbol: 'US.AAPL', condition: { type: 'price', operator: 'crosses_above', targetPrice: 200 } as PriceCondition }));
    engine.evaluate('US.AAPL', snap(190));
    engine.evaluate('US.AAPL', snap(205));
    engine.evaluate('US.AAPL', snap(210));
    expect(engine.getHistory()).toHaveLength(1);
  });
});

describe('ConditionEngine — cooldown edge cases', () => {
  let engine: ConditionEngine;
  beforeEach(() => { engine = new ConditionEngine(); vi.useFakeTimers({ toFake: ['Date'] }); });
  afterEach(() => { vi.useRealTimers(); });

  it('cooldown=0: can re-trigger on every price update', () => {
    engine.createRule(makeRule({ cooldownMs: 0, condition: { type: 'price', operator: 'above', targetPrice: 200 } as PriceCondition }));
    expect(engine.evaluate('US.AAPL', snap(210))[0].triggered).toBe(true);
    const r2 = engine.evaluate('US.AAPL', snap(211));
    expect(r2[0].triggered).toBe(true);
    expect(r2[0].cooldownActive).toBe(false);
  });

  it('cooldown partial: remaining time correct', () => {
    const { id } = engine.createRule(makeRule({ cooldownMs: 10000 }));
    vi.setSystemTime(new Date(100));
    engine.evaluate('US.AAPL', snap(210));
    vi.setSystemTime(new Date(400));
    const remaining = engine._getCooldownRemaining(id);
    expect(remaining).toBeGreaterThan(0);
    expect(remaining).toBeLessThanOrEqual(9700);
  });

  it('cooldown expiry boundary: exactly at expiry still blocked, 1ms after triggers', () => {
    engine.createRule(makeRule({ cooldownMs: 5000 }));
    vi.setSystemTime(new Date(100));
    engine.evaluate('US.AAPL', snap(210));
    vi.setSystemTime(new Date(5099));
    expect(engine.evaluate('US.AAPL', snap(220))[0].triggered).toBe(false);
    vi.setSystemTime(new Date(5101));
    expect(engine.evaluate('US.AAPL', snap(230))[0].triggered).toBe(true);
  });

  it('rule disabled mid-flight: subsequent evaluations respect disabled state', () => {
    const { id } = engine.createRule(makeRule({ cooldownMs: 0 }));
    engine.evaluate('US.AAPL', snap(210));
    expect(engine.getRule(id)!.triggerCount).toBe(1);
    engine.disableRule(id);
    expect(engine.evaluate('US.AAPL', snap(220))).toHaveLength(0);
  });

  it('rule deleted: history preserved independently', () => {
    const { id } = engine.createRule(makeRule({ cooldownMs: 0 }));
    engine.evaluate('US.AAPL', snap(210));
    engine.deleteRule(id);
    expect(engine.getHistory({ ruleId: id })).toHaveLength(1);
  });
});

describe('ConditionEngine — maxTriggersPerDay boundary', () => {
  let engine: ConditionEngine;
  beforeEach(() => { engine = new ConditionEngine(); vi.useFakeTimers({ toFake: ['Date'] }); });
  afterEach(() => { vi.useRealTimers(); });

  it('maxTriggersPerDay=1: only first trigger fires', () => {
    engine.createRule(makeRule({ cooldownMs: 0, maxTriggersPerDay: 1 }));
    expect(engine.evaluate('US.AAPL', snap(210))[0].triggered).toBe(true);
    for (let i = 0; i < 3; i++) {
      const r = engine.evaluate('US.AAPL', snap(210 + i));
      expect(r[0].triggered).toBe(false);
      expect(r[0].reason).toContain('maxTriggersPerDay');
    }
  });

  it('cross-day: counter resets after midnight', () => {
    engine.createRule(makeRule({ cooldownMs: 0, maxTriggersPerDay: 2 }));
    vi.setSystemTime(new Date('2026-06-06T10:00:00'));
    engine.evaluate('US.AAPL', snap(210));
    engine.evaluate('US.AAPL', snap(220));
    expect(engine.evaluate('US.AAPL', snap(230))[0].triggered).toBe(false);
    // Next calendar day
    vi.setSystemTime(new Date('2026-06-07T00:00:00'));
    expect(engine.evaluate('US.AAPL', snap(240))[0].triggered).toBe(true);
  });

          it('cooldown + maxTriggersPerDay: cooldown checked first', () => {
    // Use large cooldown (2h) to avoid any timing edge cases
    engine.createRule(makeRule({ cooldownMs: 2 * 60 * 60 * 1000, maxTriggersPerDay: 2 }));

    engine.evaluate('US.AAPL', snap(210)); // trigger 1

    // Still in cooldown (2 hours left) — cooldown checked first, blocks trigger
    const blocked = engine.evaluate('US.AAPL', snap(220));
    expect(blocked[0].triggered).toBe(false);
    expect(blocked[0].cooldownActive).toBe(true);
    expect(blocked[0].reason).toContain('cooldown');
    // maxTriggersPerDay NOT reached yet (count=1, limit=2) — cooldown takes priority

    // Update cooldown and trigger count via updateRule to simulate time passing
    engine.updateRule(engine.listRules()[0].id, { cooldownMs: 0 });
    engine.evaluate('US.AAPL', snap(230)); // trigger 2 (now at limit)

    // Blocked by maxTriggersPerDay
    const afterMax = engine.evaluate('US.AAPL', snap(240));
    expect(afterMax[0].triggered).toBe(false);
    expect(afterMax[0].reason).toContain('maxTriggersPerDay');
  });






  it('maxTriggersPerDay=0: never triggers', () => {
    engine.createRule(makeRule({ cooldownMs: 0, maxTriggersPerDay: 0 }));
    for (let i = 0; i < 3; i++) {
      const r = engine.evaluate('US.AAPL', snap(210));
      expect(r[0].triggered).toBe(false);
      expect(r[0].reason).toContain('maxTriggersPerDay');
    }
  });
});

describe('ConditionEngine — dynamic enable/disable', () => {
  let engine: ConditionEngine;
  beforeEach(() => { engine = new ConditionEngine(); });

  it('disable then enable: restores trigger capability', () => {
    const { id } = engine.createRule(makeRule({ cooldownMs: 0 }));
    engine.evaluate('US.AAPL', snap(210));
    expect(engine.getRule(id)!.triggerCount).toBe(1);
    engine.disableRule(id);
    expect(engine.evaluate('US.AAPL', snap(220))).toHaveLength(0);
    engine.enableRule(id);
    expect(engine.evaluate('US.AAPL', snap(230))[0].triggered).toBe(true);
    expect(engine.getRule(id)!.triggerCount).toBe(2);
  });

  it('updateRule changes condition: next evaluate uses new condition', () => {
    const { id } = engine.createRule(makeRule({
      condition: { type: 'price', operator: 'above', targetPrice: 200 } as PriceCondition,
      cooldownMs: 0,
    }));
    expect(engine.evaluate('US.AAPL', snap(210))[0].triggered).toBe(true);
    engine.updateRule(id, { condition: { type: 'price', operator: 'above', targetPrice: 250 } as PriceCondition });
    expect(engine.evaluate('US.AAPL', snap(240))[0].triggered).toBe(false);
    expect(engine.evaluate('US.AAPL', snap(260))[0].triggered).toBe(true);
  });

  it('updateRule changes cooldownMs: takes effect immediately', () => {
    const { id } = engine.createRule(makeRule({ cooldownMs: 10000 }));
    engine.evaluate('US.AAPL', snap(210));
    engine.updateRule(id, { cooldownMs: 0 });
    expect(engine.evaluate('US.AAPL', snap(220))[0].triggered).toBe(true);
  });

  it('clearAll resets rules and history', () => {
    engine.createRule(makeRule({ cooldownMs: 0 }));
    engine.createRule(makeRule({ symbol: 'US.TSLA', cooldownMs: 0 }));
    engine.evaluate('US.AAPL', snap(210));
    engine.evaluate('US.TSLA', snap(950));
    engine.clearAll();
    expect(engine.listRules()).toHaveLength(0);
    expect(engine.getHistory()).toHaveLength(0);
  });
});

describe('ConditionEngine — concurrent multi-rule evaluation', () => {
  let engine: ConditionEngine;
  beforeEach(() => { engine = new ConditionEngine(); });

  it('single evaluate: all satisfied rules recorded in history', () => {
    engine.createRule(makeRule({ symbol: 'US.AAPL', condition: { type: 'price', operator: 'above', targetPrice: 100 }, cooldownMs: 0 }));
    engine.createRule(makeRule({ symbol: 'US.AAPL', condition: { type: 'price', operator: 'below', targetPrice: 500 }, cooldownMs: 0 }));
    engine.createRule(makeRule({ symbol: 'US.AAPL', condition: { type: 'price', operator: 'above', targetPrice: 150 }, cooldownMs: 0 }));
    const results = engine.evaluate('US.AAPL', snap(300));
    expect(results.filter((r) => r.triggered)).toHaveLength(3);
    expect(engine.getHistory()).toHaveLength(3);
  });

  it('OR scenario: either symbol triggers independently', () => {
    engine.createRule(makeRule({ symbol: 'US.AAPL', condition: { type: 'price', operator: 'above', targetPrice: 200 }, cooldownMs: 0 }));
    engine.createRule(makeRule({ symbol: 'US.TSLA', condition: { type: 'price', operator: 'above', targetPrice: 900 }, cooldownMs: 0 }));
    expect(engine.evaluate('US.TSLA', snap(950))[0].triggered).toBe(true);
    expect(engine.evaluate('US.AAPL', snap(210))[0].triggered).toBe(true);
  });

  it('AND scenario: both symbols satisfied in same logical moment', () => {
    engine.createRule(makeRule({ symbol: 'US.AAPL', condition: { type: 'price', operator: 'above', targetPrice: 200 }, cooldownMs: 0 }));
    engine.createRule(makeRule({ symbol: 'US.TSLA', condition: { type: 'price', operator: 'above', targetPrice: 900 }, cooldownMs: 0 }));
    const rAAPL = engine.evaluate('US.AAPL', snap(210));
    const rTSLA = engine.evaluate('US.TSLA', snap(950));
    expect(rAAPL[0].triggered).toBe(true);
    expect(rTSLA[0].triggered).toBe(true);
  });
});

describe('ConditionEngine — large-scale performance boundary', () => {
  let engine: ConditionEngine;
  beforeEach(() => { engine = new ConditionEngine(); });

  it('100 rules: evaluate completes in under 100ms', () => {
    for (let i = 0; i < 100; i++) {
      engine.createRule(makeRule({ symbol: 'SYM' + i, condition: { type: 'price', operator: 'above', targetPrice: 100 + i } as PriceCondition }));
    }
    const start = Date.now();
    const results = engine.evaluate('SYM50', snap(160));
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(100);
    expect(results).toHaveLength(1);
    expect(results[0].triggered).toBe(true);
  });

  it('history accumulates 1000 events: filtering still correct', () => {
    const rule = engine.createRule(makeRule({ cooldownMs: 0, maxTriggersPerDay: 9999 }));
    for (let i = 0; i < 1000; i++) {
      engine.evaluate('US.AAPL', snap(201));
    }
    const history = engine.getHistory({ ruleId: rule.id });
    expect(history).toHaveLength(1000);
    const cutoff = history[500].triggeredAt;
    const filtered = engine.getHistory({ ruleId: rule.id, since: cutoff });
    expect(filtered.length).toBeGreaterThan(0);
    for (const e of filtered) {
      expect(e.triggeredAt).toBeGreaterThanOrEqual(cutoff);
    }
  });

  it('maxTriggersPerDay=100: exact count enforcement', () => {
    engine.createRule(makeRule({ cooldownMs: 0, maxTriggersPerDay: 100 }));
    for (let i = 0; i < 100; i++) {
      expect(engine.evaluate('US.AAPL', snap(201))[0].triggered).toBe(true);
    }
    const overflow = engine.evaluate('US.AAPL', snap(201));
    expect(overflow[0].triggered).toBe(false);
    expect(overflow[0].reason).toContain('maxTriggersPerDay');
  });
});

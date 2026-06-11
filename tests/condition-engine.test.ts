// tests/condition-engine.test.ts
// ConditionEngine 测试套件 — Phase 4.2 R30 Q-30-01

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConditionEngine } from '../electron/engine/core/condition-engine.js';
import type {
  ConditionRule,
  PriceCondition,
  MarketSnapshot,
} from '../electron/types/condition.js';

// ── Test fixtures ────────────────────────────────────────

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

function snap(close: number, overrides: Partial<MarketSnapshot> = {}): MarketSnapshot {
  return { symbol: 'US.AAPL', close, open: close, high: close, low: close, ...overrides };
}

// ── Tests ────────────────────────────────────────────────

describe('ConditionEngine — CRUD', () => {
  let engine: ConditionEngine;

  beforeEach(() => {
    engine = new ConditionEngine();
  });

  it('createRule generates id and defaults', () => {
    const rule = engine.createRule(makeRule());
    expect(rule.id).toMatch(/^[a-f0-9]{16}$/);
    expect(rule.createdAt).toBeInstanceOf(Date);
    expect(rule.lastTriggeredAt).toBeUndefined();
    expect(rule.triggerCount).toBe(0);
    expect(rule.enabled).toBe(true);
  });

  it('deleteRule removes rule', () => {
    const { id } = engine.createRule(makeRule());
    expect(engine.deleteRule(id)).toBe(true);
    expect(engine.getRule(id)).toBeUndefined();
  });

  it('deleteRule returns false for unknown id', () => {
    expect(engine.deleteRule('unknown')).toBe(false);
  });

  it('updateRule updates fields', () => {
    const { id } = engine.createRule(makeRule({ symbol: 'US.AAPL' }));
    const updated = engine.updateRule(id, { symbol: 'US.TSLA', cooldownMs: 10000 });
    expect(updated).not.toBeNull();
    expect(updated!.symbol).toBe('US.TSLA');
    expect(updated!.cooldownMs).toBe(10000);
    expect(updated!.id).toBe(id); // id unchanged
  });

  it('updateRule returns null for unknown id', () => {
    expect(engine.updateRule('unknown', { cooldownMs: 1000 })).toBeNull();
  });

  it('enableRule / disableRule toggle enabled', () => {
    const { id } = engine.createRule(makeRule({ enabled: false }));
    expect(engine.enableRule(id)).toBe(true);
    expect(engine.getRule(id)!.enabled).toBe(true);

    expect(engine.disableRule(id)).toBe(true);
    expect(engine.getRule(id)!.enabled).toBe(false);
  });

  it('enableRule / disableRule return false for unknown id', () => {
    expect(engine.enableRule('x')).toBe(false);
    expect(engine.disableRule('x')).toBe(false);
  });

  it('listRules returns all rules', () => {
    engine.createRule(makeRule({ symbol: 'US.AAPL' }));
    engine.createRule(makeRule({ symbol: 'US.TSLA' }));
    const all = engine.listRules();
    expect(all).toHaveLength(2);
  });

  it('listRules filters by symbol', () => {
    engine.createRule(makeRule({ symbol: 'US.AAPL' }));
    engine.createRule(makeRule({ symbol: 'US.TSLA' }));
    const aapl = engine.listRules({ symbol: 'US.AAPL' });
    expect(aapl).toHaveLength(1);
    expect(aapl[0].symbol).toBe('US.AAPL');
  });

  it('listRules filters by enabled', () => {
    engine.createRule(makeRule({ enabled: true }));
    engine.createRule(makeRule({ enabled: false }));
    expect(engine.listRules({ enabled: true })).toHaveLength(1);
    expect(engine.listRules({ enabled: false })).toHaveLength(1);
  });

  it('listRules filters by type', () => {
    engine.createRule(makeRule({ condition: { type: 'price', operator: 'above', targetPrice: 100 } as PriceCondition }));
    engine.createRule(makeRule({ condition: { type: 'indicator', indicator: 'rsi', operator: 'above', threshold: 70 } as any }));
    expect(engine.listRules({ type: 'price' })).toHaveLength(1);
    expect(engine.listRules({ type: 'indicator' })).toHaveLength(1);
  });

  it('clearAll removes all rules', () => {
    engine.createRule(makeRule());
    engine.createRule(makeRule());
    engine.clearAll();
    expect(engine.listRules()).toHaveLength(0);
  });
});

describe('ConditionEngine — PriceCondition above/below', () => {
  let engine: ConditionEngine;

  beforeEach(() => {
    engine = new ConditionEngine();
  });

  it('above: triggers when price > target', () => {
    engine.createRule(makeRule({ condition: { type: 'price', operator: 'above', targetPrice: 200 } as PriceCondition }));
    const results = engine.evaluate('US.AAPL', snap(210));
    expect(results).toHaveLength(1);
    expect(results[0].triggered).toBe(true);
  });

  it('above: does NOT trigger when price == target', () => {
    engine.createRule(makeRule({ condition: { type: 'price', operator: 'above', targetPrice: 200 } as PriceCondition }));
    const results = engine.evaluate('US.AAPL', snap(200));
    expect(results[0].triggered).toBe(false);
  });

  it('above: does NOT trigger when price < target', () => {
    engine.createRule(makeRule({ condition: { type: 'price', operator: 'above', targetPrice: 200 } as PriceCondition }));
    const results = engine.evaluate('US.AAPL', snap(190));
    expect(results[0].triggered).toBe(false);
  });

  it('below: triggers when price < target', () => {
    engine.createRule(makeRule({ condition: { type: 'price', operator: 'below', targetPrice: 200 } as PriceCondition }));
    const results = engine.evaluate('US.AAPL', snap(190));
    expect(results[0].triggered).toBe(true);
  });

  it('below: does NOT trigger when price == target', () => {
    engine.createRule(makeRule({ condition: { type: 'price', operator: 'below', targetPrice: 200 } as PriceCondition }));
    const results = engine.evaluate('US.AAPL', snap(200));
    expect(results[0].triggered).toBe(false);
  });

  it('below: does NOT trigger when price > target', () => {
    engine.createRule(makeRule({ condition: { type: 'price', operator: 'below', targetPrice: 200 } as PriceCondition }));
    const results = engine.evaluate('US.AAPL', snap(210));
    expect(results[0].triggered).toBe(false);
  });
});

describe('ConditionEngine — PriceCondition crosses', () => {
  let engine: ConditionEngine;

  beforeEach(() => {
    engine = new ConditionEngine();
  });

  it('crosses_above: triggers on fresh cross (below→above)', () => {
    const { id } = engine.createRule(makeRule({ condition: { type: 'price', operator: 'crosses_above', targetPrice: 200 } as PriceCondition }));
    // prev price injected via _setLastPrice
    engine._setLastPrice('US.AAPL', 195);
    const results = engine.evaluate('US.AAPL', snap(205));
    expect(results[0].triggered).toBe(true);
  });

  it('crosses_above: does NOT trigger when already above (prev above, cur above)', () => {
    engine.createRule(makeRule({ condition: { type: 'price', operator: 'crosses_above', targetPrice: 200 } as PriceCondition }));
    engine._setLastPrice('US.AAPL', 210);
    const results = engine.evaluate('US.AAPL', snap(220));
    expect(results[0].triggered).toBe(false);
  });

  it('crosses_above: does NOT trigger on continuous below', () => {
    engine.createRule(makeRule({ condition: { type: 'price', operator: 'crosses_above', targetPrice: 200 } as PriceCondition }));
    engine._setLastPrice('US.AAPL', 190);
    const results = engine.evaluate('US.AAPL', snap(195));
    expect(results[0].triggered).toBe(false);
  });

  it('crosses_below: triggers on fresh cross (above→below)', () => {
    engine.createRule(makeRule({ condition: { type: 'price', operator: 'crosses_below', targetPrice: 200 } as PriceCondition }));
    engine._setLastPrice('US.AAPL', 210);
    const results = engine.evaluate('US.AAPL', snap(190));
    expect(results[0].triggered).toBe(true);
  });

  it('crosses_below: does NOT trigger when already below', () => {
    engine.createRule(makeRule({ condition: { type: 'price', operator: 'crosses_below', targetPrice: 200 } as PriceCondition }));
    engine._setLastPrice('US.AAPL', 190);
    const results = engine.evaluate('US.AAPL', snap(185));
    expect(results[0].triggered).toBe(false);
  });

  it('crosses_below: does NOT trigger when price unchanged (prev=cur=target)', () => {
    engine.createRule(makeRule({ condition: { type: 'price', operator: 'crosses_below', targetPrice: 200 } as PriceCondition }));
    engine._setLastPrice('US.AAPL', 200);
    const results = engine.evaluate('US.AAPL', snap(200));
    expect(results[0].triggered).toBe(false);
  });

  it('crosses_above: no trigger when no prev price recorded', () => {
    engine.createRule(makeRule({ condition: { type: 'price', operator: 'crosses_above', targetPrice: 200 } as PriceCondition }));
    // Do NOT call _setLastPrice — prevPrice is undefined
    const results = engine.evaluate('US.AAPL', snap(205));
    expect(results[0].triggered).toBe(false);
  });
});

describe('ConditionEngine — cooldown', () => {
  let engine: ConditionEngine;

  beforeEach(() => {
    engine = new ConditionEngine();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('cooldown: blocks immediate re-trigger', () => {
    const rule = engine.createRule(makeRule({ cooldownMs: 5000 }));
    engine.evaluate('US.AAPL', snap(210));
    const after = engine.evaluate('US.AAPL', snap(220));
    expect(after[0].triggered).toBe(false);
    expect(after[0].cooldownActive).toBe(true);
  });

  it('cooldown: allows trigger after cooldown expires', () => {
    engine.createRule(makeRule({ cooldownMs: 5000 }));
    engine.evaluate('US.AAPL', snap(210));
    vi.advanceTimersByTime(6000);
    const results = engine.evaluate('US.AAPL', snap(220));
    expect(results[0].triggered).toBe(true);
  });

  it('cooldown: _getCooldownRemaining returns correct remaining', () => {
    const { id } = engine.createRule(makeRule({ cooldownMs: 5000 }));
    engine.evaluate('US.AAPL', snap(210));
    vi.advanceTimersByTime(2000);
    const remaining = engine._getCooldownRemaining(id);
    expect(remaining).toBeGreaterThanOrEqual(0);
    expect(remaining).toBeLessThanOrEqual(3000);
  });

  it('cooldown: after cooldown expires remaining=0', () => {
    const { id } = engine.createRule(makeRule({ cooldownMs: 5000 }));
    engine.evaluate('US.AAPL', snap(210));
    vi.advanceTimersByTime(5000);
    expect(engine._getCooldownRemaining(id)).toBe(0);
  });
});

describe('ConditionEngine — maxTriggersPerDay', () => {
  let engine: ConditionEngine;

  beforeEach(() => {
    engine = new ConditionEngine();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('blocks when maxTriggersPerDay reached', () => {
    engine.createRule(makeRule({ maxTriggersPerDay: 2, cooldownMs: 0 }));
    engine.evaluate('US.AAPL', snap(210));
    engine.evaluate('US.AAPL', snap(220));
    const third = engine.evaluate('US.AAPL', snap(230));
    expect(third[0].triggered).toBe(false);
    expect(third[0].reason).toContain('maxTriggersPerDay');
  });

  it('allows triggers within limit (6th hits maxTriggersPerDay cap)', () => {
    engine.createRule(makeRule({ maxTriggersPerDay: 5, cooldownMs: 0 }));
    // above:200 needs price >= 50; start from 201 so all 5 trigger
    for (let i = 0; i < 5; i++) {
      const results = engine.evaluate('US.AAPL', snap(201 + i));
      expect(results[0].triggered).toBe(true);
    }
    // 6th hit → blocked by maxTriggersPerDay cap
    const sixth = engine.evaluate('US.AAPL', snap(210));
    expect(sixth[0].triggered).toBe(false);
    expect(sixth[0].reason).toContain('maxTriggersPerDay');
  });
});

describe('ConditionEngine — disabled rule', () => {
  let engine: ConditionEngine;

  beforeEach(() => {
    engine = new ConditionEngine();
  });

  it('disabled rule never triggers (evaluate skips disabled rules)', () => {
    engine.createRule(makeRule({ enabled: false }));
    const results = engine.evaluate('US.AAPL', snap(300));
    // evaluate() only processes enabled rules → empty results
    expect(results).toHaveLength(0);
  });
});

describe('ConditionEngine — multi-rule / multi-symbol', () => {
  let engine: ConditionEngine;

  beforeEach(() => {
    engine = new ConditionEngine();
  });

  it('multiple rules on same symbol: all evaluated', () => {
    engine.createRule(makeRule({ symbol: 'US.AAPL', condition: { type: 'price', operator: 'above', targetPrice: 100 } as PriceCondition }));
    engine.createRule(makeRule({ symbol: 'US.AAPL', condition: { type: 'price', operator: 'below', targetPrice: 500 } as PriceCondition }));
    const results = engine.evaluate('US.AAPL', snap(300));
    expect(results).toHaveLength(2);
    expect(results[0].triggered).toBe(true);  // above 100
    expect(results[1].triggered).toBe(true);  // below 500
  });

  it('evaluate: only rules for that symbol are checked', () => {
    engine.createRule(makeRule({ symbol: 'US.AAPL', condition: { type: 'price', operator: 'above', targetPrice: 50 } as PriceCondition }));
    engine.createRule(makeRule({ symbol: 'US.TSLA', condition: { type: 'price', operator: 'above', targetPrice: 900 } as PriceCondition }));
    const results = engine.evaluate('US.AAPL', snap(300));
    expect(results).toHaveLength(1); // only AAPL rule
    expect(results[0].ruleId).toBe(engine.listRules({ symbol: 'US.AAPL' })[0].id);
  });

  it('evaluate: unknown symbol returns empty array', () => {
    engine.createRule(makeRule({ symbol: 'US.AAPL' }));
    const results = engine.evaluate('US.GOOG', snap(300));
    expect(results).toHaveLength(0);
  });
});

describe('ConditionEngine — reference field', () => {
  let engine: ConditionEngine;

  beforeEach(() => {
    engine = new ConditionEngine();
  });

  it('uses open when reference=open', () => {
    engine.createRule(makeRule({ condition: { type: 'price', operator: 'above', targetPrice: 100, reference: 'open' } as PriceCondition }));
    const results = engine.evaluate('US.AAPL', { symbol: 'US.AAPL', open: 110, close: 90 });
    expect(results[0].triggered).toBe(true); // 110 > 100
  });

  it('uses high when reference=high', () => {
    engine.createRule(makeRule({ condition: { type: 'price', operator: 'above', targetPrice: 100, reference: 'high' } as PriceCondition }));
    const results = engine.evaluate('US.AAPL', { symbol: 'US.AAPL', high: 105, close: 95 });
    expect(results[0].triggered).toBe(true);
  });

  it('falls back to close when field missing', () => {
    engine.createRule(makeRule({ condition: { type: 'price', operator: 'above', targetPrice: 100, reference: 'open' } as PriceCondition }));
    const results = engine.evaluate('US.AAPL', { symbol: 'US.AAPL', close: 120 });
    expect(results[0].triggered).toBe(true); // close 120 used as fallback
  });
});

describe('ConditionEngine — triggerCount and lastTriggeredAt', () => {
  let engine: ConditionEngine;

  beforeEach(() => {
    engine = new ConditionEngine();
  });

  it('increments triggerCount on trigger', () => {
    const { id } = engine.createRule(makeRule({ cooldownMs: 0 }));
    engine.evaluate('US.AAPL', snap(210));
    expect(engine.getRule(id)!.triggerCount).toBe(1);
    engine.evaluate('US.AAPL', snap(220));
    expect(engine.getRule(id)!.triggerCount).toBe(2);
  });

  it('updates lastTriggeredAt on trigger', () => {
    const { id } = engine.createRule(makeRule({ cooldownMs: 0 }));
    engine.evaluate('US.AAPL', snap(210));
    expect(engine.getRule(id)!.lastTriggeredAt).toBeDefined();
    expect(engine.getRule(id)!.lastTriggeredAt!).toBeGreaterThan(0);
  });

  it('triggerCount resets on clearAll', () => {
    const { id } = engine.createRule(makeRule({ cooldownMs: 0 }));
    engine.evaluate('US.AAPL', snap(210));
    engine.clearAll();
    const fresh = engine.createRule(makeRule({ cooldownMs: 0 }));
    expect(engine.getRule(fresh.id)!.triggerCount).toBe(0);
  });
});

describe('ConditionEngine — getHistory', () => {
  let engine: ConditionEngine;

  beforeEach(() => {
    engine = new ConditionEngine();
  });

  it('records trigger events', () => {
    const { id } = engine.createRule(makeRule({ cooldownMs: 0 }));
    engine.evaluate('US.AAPL', snap(210));
    const history = engine.getHistory();
    expect(history).toHaveLength(1);
    expect(history[0].ruleId).toBe(id);
    expect(history[0].priceAtTrigger).toBe(210);
  });

  it('filters by ruleId', () => {
    const { id: id1 } = engine.createRule(makeRule({ symbol: 'US.AAPL', cooldownMs: 0 }));
    engine.createRule(makeRule({ symbol: 'US.TSLA', cooldownMs: 0 }));
    engine.evaluate('US.AAPL', snap(210));
    engine.evaluate('US.TSLA', snap(900));
    const filtered = engine.getHistory({ ruleId: id1 });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].ruleId).toBe(id1);
  });

  it('filters by since timestamp', () => {
    const { id } = engine.createRule(makeRule({ cooldownMs: 0 }));
    const before = Date.now() - 10000;
    engine.evaluate('US.AAPL', snap(210));
    const after = Date.now();
    const filtered = engine.getHistory({ since: after - 5000 });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].triggeredAt).toBeGreaterThanOrEqual(after - 5000);
  });

  it('getHistory returns events even after rule deleted (history is independent)', () => {
    const { id } = engine.createRule(makeRule({ cooldownMs: 0 }));
    engine.evaluate('US.AAPL', snap(210));
    engine.deleteRule(id);
    // history is not cleared on rule deletion (intentional design)
    const history = engine.getHistory({ ruleId: id });
    expect(history).toHaveLength(1);
    expect(history[0].ruleId).toBe(id);
  });
});

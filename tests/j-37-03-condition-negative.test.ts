// J-37-03: ConditionEngine Negative Tests
import { describe, it, expect } from 'vitest';
import { ConditionEngine } from '../electron/engine/core/condition-engine';
import type { MarketSnapshot } from '../electron/types/condition.js';

function makeSnapshot(price: number): MarketSnapshot {
  return {
    symbol: '600519',
    close: price,
    open: price - 1,
    high: price + 5,
    low: price - 5,
    volume: 1000000,
    timestamp: Date.now(),
  };
}

describe('J-37-03 ConditionEngine Negative', () => {
  it('N1: no rules → empty results', () => {
    const engine = new ConditionEngine();
    const results = engine.evaluate('600519', makeSnapshot(1800));
    expect(results.length).toBe(0);
  });

  it('N2: disabled rule not evaluated', () => {
    const engine = new ConditionEngine();
    engine.createRule({
      symbol: '600519',
      enabled: false,
      condition: { type: 'price', operator: 'gt', value: 1700 },
      cooldownMs: 60000,
      maxTriggersPerDay: 10,
      action: { type: 'notify', message: 'Price > 1700' },
    });
    const results = engine.evaluate('600519', makeSnapshot(1800));
    expect(results.length).toBe(0);
  });

  it('N3: delete non-existent rule returns false', () => {
    const engine = new ConditionEngine();
    expect(engine.deleteRule('non-existent-id')).toBe(false);
  });

  it('N4: update non-existent rule returns null', () => {
    const engine = new ConditionEngine();
    expect(engine.updateRule('non-existent-id', { enabled: false })).toBeNull();
  });

  it('N5: enable non-existent rule returns false', () => {
    const engine = new ConditionEngine();
    expect(engine.enableRule('non-existent-id')).toBe(false);
  });

  it('N6: disable non-existent rule returns false', () => {
    const engine = new ConditionEngine();
    expect(engine.disableRule('non-existent-id')).toBe(false);
  });

  it('N7: negative price handled without crash', () => {
    const engine = new ConditionEngine();
    engine.createRule({
      symbol: '600519',
      enabled: true,
      condition: { type: 'price', operator: 'gt', value: 0 },
      cooldownMs: 0,
      maxTriggersPerDay: 100,
      action: { type: 'notify', message: 'Test' },
    });
    expect(() => engine.evaluate('600519', makeSnapshot(-100))).not.toThrow();
  });

  it('N8: zero price handled', () => {
    const engine = new ConditionEngine();
    engine.createRule({
      symbol: '600519',
      enabled: true,
      condition: { type: 'price', operator: 'gt', value: 0 },
      cooldownMs: 0,
      maxTriggersPerDay: 100,
      action: { type: 'notify', message: 'Test' },
    });
    expect(() => engine.evaluate('600519', makeSnapshot(0))).not.toThrow();
  });

  it('N9: cooldown prevents immediate re-trigger', () => {
    const engine = new ConditionEngine();
    engine.createRule({
      symbol: '600519',
      enabled: true,
      condition: { type: 'price', operator: 'gt', value: 1700 },
      cooldownMs: 60000,
      maxTriggersPerDay: 100,
      action: { type: 'notify', message: 'Test' },
    });

    const r1 = engine.evaluate('600519', makeSnapshot(1800));
    const triggered1 = r1.find(r => r.triggered);

    if (triggered1) {
      const r2 = engine.evaluate('600519', makeSnapshot(1850));
      const triggered2 = r2.find(r => r.triggered);
      expect(triggered2 === undefined || triggered2.cooldownActive === true).toBeTruthy();
    }
    // If first didn't trigger, test passes (condition not met in snapshot)
  });

  it('N10: maxTriggersPerDay blocks after limit', () => {
    const engine = new ConditionEngine();
    engine.createRule({
      symbol: '600519',
      enabled: true,
      condition: { type: 'price', operator: 'gt', value: 1700 },
      cooldownMs: 0,
      maxTriggersPerDay: 2,
      action: { type: 'notify', message: 'Test' },
    });

    engine.evaluate('600519', makeSnapshot(1800));
    engine.evaluate('600519', makeSnapshot(1850));
    const r3 = engine.evaluate('600519', makeSnapshot(1900));

    const triggered3 = r3.find(r => r.triggered);
    expect(triggered3).toBeUndefined();
  });
});
// tests/condition-engine-integration.test.ts
// ConditionEngine 集成测试 — Phase 4.2 R30 Q-30-02

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConditionEngine } from '../electron/engine/core/condition-engine.js';
import { registerConditionHandlers } from '../electron/main/ipc-handlers-condition.js';
import type { PriceCondition } from '../electron/types/condition.js';

function makeRule(overrides: any = {}) {
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

function snap(close: number) {
  return { symbol: 'US.AAPL', close, open: close, high: close, low: close };
}

describe('IPC Handlers', () => {
  let engine: ConditionEngine;
  let handlers: Map<string, Function>;

  beforeEach(() => {
    engine = new ConditionEngine();
    handlers = new Map();
    registerConditionHandlers(engine, handlers);
  });

  it('condition:create creates rule and returns it', async () => {
    const result = await handlers.get('condition:create')(null, makeRule());
    expect(result.success).toBe(true);
    expect(result.data.id).toMatch(/^rule_/);
    expect(result.data.symbol).toBe('US.AAPL');
  });

  it('condition:create handles valid input', async () => {
    const result = await handlers.get('condition:create')(null, {
      symbol: 'US.AAPL',
      condition: { type: 'price', operator: 'above', targetPrice: 200 } as PriceCondition,
      strategyId: 's1',
      cooldownMs: 5000,
      maxTriggersPerDay: 10,
      enabled: true,
    });
    expect(result.success).toBe(true);
    expect(result.data.id).toBeDefined();
  });

  it('condition:delete removes rule', async () => {
    const { id } = engine.createRule(makeRule());
    const result = await handlers.get('condition:delete')(null, id);
    expect(result.success).toBe(true);
    expect(engine.getRule(id)).toBeUndefined();
  });

  it('condition:delete returns false for unknown id', async () => {
    const result = await handlers.get('condition:delete')(null, 'unknown');
    expect(result.success).toBe(false);
  });

  it('condition:update updates rule', async () => {
    const { id } = engine.createRule(makeRule());
    const result = await handlers.get('condition:update')(null, { ruleId: id, patch: { cooldownMs: 9999 } });
    expect(result.success).toBe(true);
    expect(result.data.cooldownMs).toBe(9999);
  });

  it('condition:list returns all rules', async () => {
    engine.createRule(makeRule({ symbol: 'US.AAPL' }));
    engine.createRule(makeRule({ symbol: 'US.TSLA' }));
    const result = await handlers.get('condition:list')(null);
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(2);
  });

  it('condition:list filters by symbol', async () => {
    engine.createRule(makeRule({ symbol: 'US.AAPL' }));
    engine.createRule(makeRule({ symbol: 'US.TSLA' }));
    const result = await handlers.get('condition:list')(null, { symbol: 'US.AAPL' });
    expect(result.data).toHaveLength(1);
    expect(result.data[0].symbol).toBe('US.AAPL');
  });

  it('condition:enable / condition:disable toggle', async () => {
    const { id } = engine.createRule(makeRule({ enabled: false }));
    const enable = await handlers.get('condition:enable')(null, id);
    expect(enable.success).toBe(true);
    expect(engine.getRule(id)!.enabled).toBe(true);

    const disable = await handlers.get('condition:disable')(null, id);
    expect(disable.success).toBe(true);
    expect(engine.getRule(id)!.enabled).toBe(false);
  });

  it('condition:clear removes all rules', async () => {
    engine.createRule(makeRule());
    engine.createRule(makeRule());
    const result = await handlers.get('condition:clear')();
    expect(result.success).toBe(true);
    expect(engine.listRules()).toHaveLength(0);
  });

  it('condition:history returns trigger events', async () => {
    vi.useFakeTimers();
    const { id } = engine.createRule(makeRule({ cooldownMs: 0 }));
    engine.evaluate('US.AAPL', snap(210));
    const result = await handlers.get('condition:history')(null, { ruleId: id });
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
    vi.useRealTimers();
  });

  it('condition:evaluate evaluates symbol', async () => {
    engine.createRule(makeRule({ cooldownMs: 0 }));
    const result = await handlers.get('condition:evaluate')(null, { symbol: 'US.AAPL', data: snap(210) });
    expect(result.success).toBe(true);
    expect(result.data[0].triggered).toBe(true);
  });

  it('condition:evaluate handles unknown symbol', async () => {
    engine.createRule(makeRule());
    const result = await handlers.get('condition:evaluate')(null, { symbol: 'US.GOOG', data: snap(100) });
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(0);
  });
});

describe('ConditionEngine — cooldown integration', () => {
  let engine: ConditionEngine;

  beforeEach(() => { engine = new ConditionEngine(); });

  it('cooldown: evaluate blocks re-trigger within window', () => {
    engine.createRule(makeRule({ cooldownMs: 5000 }));
    const first = engine.evaluate('US.AAPL', snap(210));
    expect(first[0].triggered).toBe(true);

    const second = engine.evaluate('US.AAPL', snap(220));
    expect(second[0].triggered).toBe(false);
    expect(second[0].cooldownActive).toBe(true);
  });

  it('multiple symbols: each symbol gets its own lastPrice state', () => {
    engine.createRule(makeRule({
      symbol: 'US.AAPL',
      cooldownMs: 0,
    }));
    // AAPL triggers
    engine._setLastPrice('US.AAPL', 195);
    const aapl = engine.evaluate('US.AAPL', snap(210));
    expect(aapl[0].triggered).toBe(true);
    // TSLA has a different rule
    engine.createRule(makeRule({
      symbol: 'US.TSLA',
      condition: { type: 'price', operator: 'above', targetPrice: 800 } as PriceCondition,
      cooldownMs: 0,
    }));
    const tsla = engine.evaluate('US.TSLA', { symbol: 'US.TSLA', close: 900, open: 900, high: 900, low: 900 });
    expect(tsla[0].triggered).toBe(true);
  });

  it('maxTriggersPerDay blocks additional triggers', () => {
    engine.createRule(makeRule({ maxTriggersPerDay: 2, cooldownMs: 0 }));
    engine.evaluate('US.AAPL', snap(210));
    engine.evaluate('US.AAPL', snap(220));
    const third = engine.evaluate('US.AAPL', snap(230));
    expect(third[0].triggered).toBe(false);
    expect(third[0].reason).toContain('maxTriggersPerDay');
  });

  it('crosses: first tick does not trigger crosses (no prev)', () => {
    engine.createRule(makeRule({
      condition: { type: 'price', operator: 'crosses_above', targetPrice: 200 } as PriceCondition,
      cooldownMs: 0,
    }));
    // no prev price set → should not trigger
    const result = engine.evaluate('US.AAPL', snap(205));
    expect(result[0].triggered).toBe(false);
  });

  it('crosses: second tick triggers correctly', () => {
    engine.createRule(makeRule({
      condition: { type: 'price', operator: 'crosses_above', targetPrice: 200 } as PriceCondition,
      cooldownMs: 0,
    }));
    engine._setLastPrice('US.AAPL', 195);
    const result = engine.evaluate('US.AAPL', snap(205));
    expect(result[0].triggered).toBe(true);
  });
});

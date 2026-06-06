// ── ConditionWatcher E2E Tests ─────────────────────────────────────────────
// ML-30-03: Phase 4.2 condition trigger scenarios
// Target: npm test >= 400

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { ConditionWatcher } from '../electron/engine/condition-watcher';
import type { QuoteSnapshot, ConditionRule, PriceCondition, IndicatorCondition, CompositeCondition } from '../electron/engine/condition-watcher';

// ── Helpers ────────────────────────────────────────────────────────────────

function makeQuote(symbol: string, price: number, volume = 1000000): QuoteSnapshot {
  return { symbol, price, bid: price - 0.1, ask: price + 0.1, volume, timestamp: Date.now(), source: 'futu' };
}

function makePriceRule(id: string, symbol: string, operator: ConditionRule['condition'], value: number): ConditionRule {
  return {
    id,
    name: `Price ${symbol} ${JSON.stringify(operator)} ${value}`,
    condition: { id: `${id}-cond`, type: 'price' as const, symbol, operator: operator as any, value },
    action: { type: 'send_alert', params: { message: `${symbol} price triggered` } },
    enabled: true,
    dailyTriggerCount: 0,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('ConditionWatcher', () => {
  let watcher: ConditionWatcher;

  beforeEach(() => {
    watcher = new ConditionWatcher();
  });

  describe('Price Conditions', () => {
    it('price above triggers correctly', async () => {
      watcher.addRule(makePriceRule('r1', 'US.TQQQ', '>' as any, 50));
      const results = await watcher.processQuote(makeQuote('US.TQQQ', 55));
      expect(results.length).toBe(1);
      expect(results[0].triggered).toBe(true);
      expect(results[0].ruleId).toBe('r1');
      expect(results[0].details).toContain('price 55');
    });

    it('price above does not trigger when below', async () => {
      watcher.addRule(makePriceRule('r1', 'US.TQQQ', '>' as any, 60));
      const results = await watcher.processQuote(makeQuote('US.TQQQ', 55));
      // Rule check produces result but not triggered
      expect(results.length).toBe(0); // No triggered results
      const rule = watcher.getRule('r1');
      expect(rule).toBeDefined(); // Rule still exists
    });

    it('price below triggers correctly', async () => {
      watcher.addRule(makePriceRule('r1', 'US.NVDA', '<' as any, 900));
      const results = await watcher.processQuote(makeQuote('US.NVDA', 885));
      expect(results[0].triggered).toBe(true);
    });

    it('price >= triggers on equality', async () => {
      watcher.addRule(makePriceRule('r1', 'US.AAPL', '>=' as any, 200));
      const results = await watcher.processQuote(makeQuote('US.AAPL', 200));
      expect(results[0].triggered).toBe(true);
    });

    it('price <= triggers on equality', async () => {
      watcher.addRule(makePriceRule('r1', 'US.AAPL', '<=' as any, 200));
      const results = await watcher.processQuote(makeQuote('US.AAPL', 200));
      expect(results[0].triggered).toBe(true);
    });

    it('crosses_above triggers only on boundary crossing', async () => {
      watcher.addRule(makePriceRule('r1', 'US.SPY', 'crosses_above' as any, 500));
      // Feed history: price stays below, then crosses
      await watcher.processQuote(makeQuote('US.SPY', 498));
      await watcher.processQuote(makeQuote('US.SPY', 499));
      const results = await watcher.processQuote(makeQuote('US.SPY', 502));
      expect(results[0].triggered).toBe(true);
      expect(results[0].details).toContain('crosses_above');
    });

    it('crosses_above does NOT trigger on second time above', async () => {
      watcher.addRule(makePriceRule('r1', 'US.SPY', 'crosses_above' as any, 500));
      // Feed already above threshold
      await watcher.processQuote(makeQuote('US.SPY', 501));
      await watcher.processQuote(makeQuote('US.SPY', 503));
      const results = await watcher.processQuote(makeQuote('US.SPY', 505));
      // No cross because price was already above 500
      expect(results.length).toBe(0);
    });

    it('crosses_below triggers on first drop below', async () => {
      watcher.addRule(makePriceRule('r2', 'US.SPY', 'crosses_below' as any, 500));
      await watcher.processQuote(makeQuote('US.SPY', 505));
      await watcher.processQuote(makeQuote('US.SPY', 502));
      const results = await watcher.processQuote(makeQuote('US.SPY', 498));
      // prev=502 >= 500, curr=498 < 500 => crosses_below!
      expect(results[0].triggered).toBe(true);
    });

    it('wildcard symbol "*" matches any quote', async () => {
      const rule: ConditionRule = {
        id: 'r-wild', name: 'Any stock < 10',
        condition: { id: 'c-wild', type: 'price', symbol: '*', operator: '<', value: 10 },
        action: { type: 'send_alert' },
        enabled: true, dailyTriggerCount: 0,
      };
      watcher.addRule(rule);
      const results = await watcher.processQuote(makeQuote('US.TQQQ', 9));
      expect(results[0].triggered).toBe(true);
    });
  });

  describe('Indicator Conditions', () => {
    it('RSI indicator returns not-enough-data for short history', async () => {
      const rule: ConditionRule = {
        id: 'r-rsi', name: 'RSI check',
        condition: { id: 'c-rsi', type: 'indicator', symbol: 'US.TQQQ', indicator: 'RSI', operator: '>', value: 30, params: { period: 14 } },
        action: { type: 'send_alert' },
        enabled: true, dailyTriggerCount: 0,
      };
      watcher.addRule(rule);
      // Only 5 points = not enough for RSI period 14
      for (let i = 0; i < 5; i++) {
        await watcher.processQuote(makeQuote('US.TQQQ', 50));
      }
      const results = await watcher.processQuote(makeQuote('US.TQQQ', 52));
      expect(results.length).toBe(0); // Not enough data, no trigger
    });

    it('MA indicator evaluates correctly', async () => {
      const rule: ConditionRule = {
        id: 'r-ma', name: 'Price above MA20',
        condition: { id: 'c-ma', type: 'indicator', symbol: 'US.TQQQ', indicator: 'MA', operator: '>', value: 0, params: { period: 5 } },
        action: { type: 'send_alert' },
        enabled: true, dailyTriggerCount: 0,
      };
      watcher.addRule(rule);
      // Feed 5 low prices, then a high spike
      for (let i = 0; i < 5; i++) {
        await watcher.processQuote(makeQuote('US.TQQQ', 50));
      }
      const results = await watcher.processQuote(makeQuote('US.TQQQ', 55));
      expect(results[0].triggered).toBe(true);
    });
  });

  describe('Composite Conditions', () => {
    it('AND logic: both conditions must trigger', async () => {
      const cond: CompositeCondition = {
        id: 'c-comp', type: 'composite', logic: 'AND',
        conditions: [
          { id: 'c1', type: 'price', symbol: 'US.TQQQ', operator: '>', value: 50 },
          { id: 'c2', type: 'price', symbol: 'US.TQQQ', operator: '<', value: 60 },
        ],
      };
      const rule: ConditionRule = {
        id: 'r-comp', name: 'Price between 50-60',
        condition: cond,
        action: { type: 'send_alert' },
        enabled: true, dailyTriggerCount: 0,
      };
      watcher.addRule(rule);

      // Below range → no trigger
      const r1 = await watcher.processQuote(makeQuote('US.TQQQ', 45));
      expect(r1.length).toBe(0); // AND: both must trigger, first one fails (45 > 50 is false)

      // In range → trigger
      const r2 = await watcher.processQuote(makeQuote('US.TQQQ', 55));
      expect(r2[0].triggered).toBe(true);

      // Above range → no trigger
      const r3 = await watcher.processQuote(makeQuote('US.TQQQ', 65));
      expect(r3.length).toBe(0); // AND: second fails (65 < 60 is false)
    });

    it('OR logic: either condition triggers', async () => {
      const cond: CompositeCondition = {
        id: 'c-or', type: 'composite', logic: 'OR',
        conditions: [
          { id: 'c1', type: 'price', symbol: 'US.TQQQ', operator: '<', value: 40 },
          { id: 'c2', type: 'price', symbol: 'US.TQQQ', operator: '>', value: 80 },
        ],
      };
      const rule: ConditionRule = {
        id: 'r-or', name: 'Price extreme',
        condition: cond,
        action: { type: 'send_alert' },
        enabled: true, dailyTriggerCount: 0,
      };
      watcher.addRule(rule);

      // Middle → no trigger (neither extreme)
      const r1 = await watcher.processQuote(makeQuote('US.TQQQ', 55));
      expect(r1.length).toBe(0);

      // Low extreme → trigger
      const r2 = await watcher.processQuote(makeQuote('US.TQQQ', 35));
      expect(r2[0].triggered).toBe(true);

      // High extreme → trigger
      const r3 = await watcher.processQuote(makeQuote('US.TQQQ', 85));
      expect(r3[0].triggered).toBe(true);
    });
  });

  describe('Rule Management', () => {
    it('rules can be enabled/disabled', async () => {
      watcher.addRule(makePriceRule('r1', 'US.TQQQ', '>' as any, 50));
      watcher.setEnabled('r1', false);
      const results = await watcher.processQuote(makeQuote('US.TQQQ', 55));
      expect(results.length).toBe(0); // Rule disabled
    });

    it('max daily triggers respected', async () => {
      const rule = makePriceRule('r1', 'US.TQQQ', '>' as any, 50);
      rule.maxDailyTriggers = 2;
      watcher.addRule(rule);

      await watcher.processQuote(makeQuote('US.TQQQ', 55));
      await watcher.processQuote(makeQuote('US.TQQQ', 56));
      const results = await watcher.processQuote(makeQuote('US.TQQQ', 57));
      expect(results.length).toBe(0); // 3rd trigger blocked
    });

    it('cooldown respected', async () => {
      const rule = makePriceRule('r1', 'US.TQQQ', '>' as any, 50);
      rule.cooldownMs = 999999; // effectively never cooldown in this test
      watcher.addRule(rule);

      await watcher.processQuote(makeQuote('US.TQQQ', 55));
      const results = await watcher.processQuote(makeQuote('US.TQQQ', 56));
      expect(results.length).toBe(0); // Still in cooldown
    });
  });
});

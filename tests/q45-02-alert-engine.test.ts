// Q-45-02: AlertEngine test suite
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AlertEngine, getAlertEngine, type AlertRule, type AlertEvent } from '../electron/engine/alert-engine';

vi.mock('electron-log', () => ({ default: { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() } }));

function makeRule(overrides: Partial<AlertRule> = {}): AlertRule {
  return {
    id: 'rule-1',
    condition: 'price > 0',
    threshold: 100,
    severity: 'info',
    cooldown: 60000,
    ...overrides,
  };
}

describe('Q-45-02: AlertEngine', () => {
  let engine: AlertEngine;

  beforeEach(() => {
    engine = new AlertEngine();
  });

  afterEach(() => {
    engine.stop();
  });

  describe('constructor', () => {
    it('should create instance', () => {
      expect(new AlertEngine()).toBeDefined();
    });
  });

  describe('addRule() / removeRule()', () => {
    it('should add rule and retrieve it', () => {
      engine.addRule(makeRule({ id: 'r1' }));
      const rules = engine.getActiveRules();
      expect(rules).toHaveLength(1);
      expect(rules[0].id).toBe('r1');
    });

    it('should remove rule', () => {
      engine.addRule(makeRule({ id: 'r1' }));
      engine.removeRule('r1');
      expect(engine.getActiveRules()).toHaveLength(0);
    });

    it('should add multiple rules', () => {
      engine.addRule(makeRule({ id: 'r1' }));
      engine.addRule(makeRule({ id: 'r2' }));
      engine.addRule(makeRule({ id: 'r3' }));
      expect(engine.getActiveRules()).toHaveLength(3);
    });
  });

  describe('evaluate()', () => {
    it('should not throw with valid data', () => {
      engine.addRule(makeRule({ condition: 'price > 0', threshold: 100 }));
      expect(() => engine.evaluate({ symbol: 'HK.00700', close: 500 })).not.toThrow();
    });

    it('should fire alert when price exceeds threshold', () => {
      const handler = vi.fn();
      engine.on('alert', handler);
      engine.addRule(makeRule({ condition: 'price > 0', threshold: 100, cooldown: 0 }));
      engine.evaluate({ symbol: 'HK.00700', close: 500 });
      // cooldown=0 so immediate fire expected
      expect(handler).toHaveBeenCalled();
    });

    it('should not fire when price below threshold', () => {
      const handler = vi.fn();
      engine.on('alert', handler);
      engine.addRule(makeRule({ condition: 'price > 0', threshold: 1000, cooldown: 0 }));
      engine.evaluate({ symbol: 'HK.00700', close: 500 });
      expect(handler).not.toHaveBeenCalled();
    });

    it('should handle missing close price', () => {
      engine.addRule(makeRule({ condition: 'price > 0', threshold: 100, cooldown: 0 }));
      expect(() => engine.evaluate({ symbol: 'HK.00700' })).not.toThrow();
    });

    it('should support volume condition', () => {
      const handler = vi.fn();
      engine.on('alert', handler);
      engine.addRule(makeRule({ condition: 'volume > 0', threshold: 1000, cooldown: 0 }));
      engine.evaluate({ symbol: 'HK.00700', volume: 5000 });
      expect(handler).toHaveBeenCalled();
    });
  });

  describe('cooldown', () => {
    it('should not fire within cooldown period', () => {
      const handler = vi.fn();
      engine.on('alert', handler);
      const now = Date.now();
      engine.addRule(makeRule({ condition: 'price > 0', threshold: 100, cooldown: 1000 }));
      engine.evaluate({ symbol: 'HK.00700', close: 500 });
      const firstCall = handler.mock.calls.length;
      engine.evaluate({ symbol: 'HK.00700', close: 600 });
      // Within 1000ms cooldown — should not fire second time
      expect(handler.mock.calls.length).toBe(firstCall);
    });
  });

  describe('getActiveRules()', () => {
    it('should return all active rules', () => {
      engine.addRule(makeRule({ id: 'r1' }));
      engine.addRule(makeRule({ id: 'r2' }));
      expect(engine.getActiveRules()).toHaveLength(2);
    });

    it('should return empty array when no rules', () => {
      expect(engine.getActiveRules()).toEqual([]);
    });
  });

  describe('stop()', () => {
    it('should clear rules on stop', () => {
      engine.addRule(makeRule());
      engine.stop();
      expect(engine.getActiveRules()).toHaveLength(0);
    });
  });

  describe('getAlertEngine() singleton', () => {
    it('should return same instance', () => {
      const a = getAlertEngine();
      const b = getAlertEngine();
      expect(a).toBe(b);
    });
  });

  describe('event patterns', () => {
    it('should match wildcard * pattern', () => {
      const handler = vi.fn();
      engine.on('*', handler);
      engine.addRule(makeRule({ cooldown: 0 }));
      engine.evaluate({ symbol: 'HK.00700', close: 500 });
      expect(handler).toHaveBeenCalled();
    });
  });
});

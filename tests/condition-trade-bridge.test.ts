// Q-36-01: ConditionTradeBridge Unit Tests
// Matches the ML R36 implementation (processTrigger async API)
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────

class MockEventEmitter {
  private listeners: Map<string, Set<Function>> = new Map();
  emit(event: string, ...args: any[]) {
    (this.listeners.get(event) || []).forEach(fn => fn(...args));
  }
  on(event: string, fn: Function) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(fn);
  }
  off(event: string, fn: Function) {
    this.listeners.get(event)?.delete(fn);
  }
  removeAllListeners() { this.listeners.clear(); }
}

vi.mock('electron-log', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ── Source Import ──────────────────────────────────────────────────────────

import {
  ConditionTradeBridge,
  ConditionTrigger,
  BridgeConfig,
  BridgeSignal,
  BridgeStats,
} from '../electron/engine/core/condition-trade-bridge';

// ── Helpers ────────────────────────────────────────────────────────────────

function makeTrigger(overrides?: Partial<ConditionTrigger>): ConditionTrigger {
  return {
    id: `trig-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    ruleId: 'rule-001',
    symbol: 'HK.00700',
    condition: 'crosses_above',
    price: 300,
    timestamp: Date.now(),
    strategyId: 'strat-test',
    ...overrides,
  };
}

const DEFAULT_CFG: BridgeConfig = {
  cooldownMs: 60_000,
  maxDailyTriggers: 50,
  autoRoute: true,
  requireRiskCheck: true,
  maxRetries: 3,
  retryDelayMs: 1000,
};

// ── Tests ─────────────────────────────────────────────────────────────────

describe('ConditionTradeBridge', () => {
  let bridge: ConditionTradeBridge;

  beforeEach(() => {
    vi.clearAllMocks();
    bridge = new ConditionTradeBridge();
  });

  afterEach(() => {
    bridge.resetAll();
  });

  // ── Initialization ───────────────────────────────────────────────────────

  describe('Initialization', () => {
    it('uses default config when none provided', () => {
      const cfg = bridge.getConfig();
      expect(cfg.cooldownMs).toBe(60_000);
      expect(cfg.maxDailyTriggers).toBe(50);
      expect(cfg.autoRoute).toBe(true);
      expect(cfg.requireRiskCheck).toBe(true);
      expect(cfg.maxRetries).toBe(3);
      expect(cfg.retryDelayMs).toBe(1000);
    });

    it('merges partial config override', () => {
      bridge = new ConditionTradeBridge({ cooldownMs: 5000, maxDailyTriggers: 10 });
      const cfg = bridge.getConfig();
      expect(cfg.cooldownMs).toBe(5000);
      expect(cfg.maxDailyTriggers).toBe(10);
      expect(cfg.autoRoute).toBe(true); // default preserved
    });

    it('getConfig returns a copy (not reference)', () => {
      const cfg1 = bridge.getConfig();
      cfg1.cooldownMs = 9999;
      const cfg2 = bridge.getConfig();
      expect(cfg2.cooldownMs).toBe(60_000); // original unchanged
    });

    it('updateConfig merges partial updates', () => {
      bridge.updateConfig({ maxRetries: 5 });
      const cfg = bridge.getConfig();
      expect(cfg.maxRetries).toBe(5);
      expect(cfg.cooldownMs).toBe(60_000); // unchanged
    });
  });

  // ── Cooldown ─────────────────────────────────────────────────────────────

  describe('Cooldown enforcement', () => {
    it('first trigger is NOT in cooldown', async () => {
      const t = makeTrigger({ id: 't1' });
      const result = await bridge.processTrigger(t);
      // First trigger for a rule+symbol: checkCooldown returns true -> proceeds
      // action is determined by condition
      expect(result.status).not.toBe('rejected'); // Not cooldown-rejected
    });

    it('second trigger same rule+symbol within cooldown is REJECTED', async () => {
      bridge = new ConditionTradeBridge({ cooldownMs: 60_000 }); // 60s cooldown

      const t1 = makeTrigger({ id: 't1', ruleId: 'r1', symbol: 'HK.00700' });
      await bridge.processTrigger(t1);

      const t2 = makeTrigger({ id: 't2', ruleId: 'r1', symbol: 'HK.00700' });
      const result2 = await bridge.processTrigger(t2);

      expect(result2.status).toBe('rejected');
      expect(result2.reason).toContain('Cooldown active');
    });

    it('different ruleId bypasses same-symbol cooldown', async () => {
      bridge = new ConditionTradeBridge({ cooldownMs: 60_000 });

      const t1 = makeTrigger({ id: 't1', ruleId: 'r1', symbol: 'HK.00700' });
      await bridge.processTrigger(t1);

      const t2 = makeTrigger({ id: 't2', ruleId: 'r2', symbol: 'HK.00700' });
      const result2 = await bridge.processTrigger(t2);

      // Different ruleId -> different cooldown key -> NOT rejected for cooldown
      expect(result2.status).not.toBe('rejected');
    });

    it('cooldownMs=0 disables cooldown', async () => {
      bridge = new ConditionTradeBridge({ cooldownMs: 0 });

      const t1 = makeTrigger({ id: 't1' });
      await bridge.processTrigger(t1);

      const t2 = makeTrigger({ id: 't2' });
      const result2 = await bridge.processTrigger(t2);

      expect(result2.status).not.toBe('rejected');
    });
  });

  // ── Daily limit ──────────────────────────────────────────────────────────

  describe('Daily trigger limit', () => {
    it('rejects trigger when daily limit reached', async () => {
      bridge = new ConditionTradeBridge({ maxDailyTriggers: 2, autoRoute: true, cooldownMs: 0 });

      // Different ruleIds avoid cooldown so daily limit is hit
      const t1 = makeTrigger({ id: 't1', ruleId: 'r1', symbol: 'HK.00700', condition: 'crosses_above' });
      const t2 = makeTrigger({ id: 't2', ruleId: 'r2', symbol: 'HK.00700', condition: 'crosses_above' });
      await bridge.processTrigger(t1);
      await bridge.processTrigger(t2);

      const t3 = makeTrigger({ id: 't3', ruleId: 'r3', symbol: 'HK.00700', condition: 'crosses_above' });
      const result3 = await bridge.processTrigger(t3);

      expect(result3.status).toBe('rejected');
      expect(result3.reason).toContain('Daily limit reached');
    });

    it('maxDailyTriggers=0 rejects all', async () => {
      bridge = new ConditionTradeBridge({ maxDailyTriggers: 0, autoRoute: false });

      const t = makeTrigger({ id: 't1' });
      const result = await bridge.processTrigger(t);

      expect(result.status).toBe('rejected');
      expect(result.reason).toContain('Daily limit reached');
    });

    it('different symbol shares have separate daily counts', async () => {
      bridge = new ConditionTradeBridge({ maxDailyTriggers: 1, autoRoute: true });

      // Each symbol hits limit=1 separately
      await bridge.processTrigger(makeTrigger({ id: 't1', symbol: 'HK.00700', condition: 'crosses_above' }));
      await bridge.processTrigger(makeTrigger({ id: 't2', symbol: 'HK.00701', condition: 'crosses_above' }));
      await bridge.processTrigger(makeTrigger({ id: 't3', symbol: 'HK.00702', condition: 'crosses_above' }));

      const stats = bridge.getStats();
      // 3 different symbols: each executes once
      expect(stats.totalExecuted).toBe(3);
    });
  });

  // ── Action determination ────────────────────────────────────────────────

  describe('Action determination', () => {
    async function actionFor(cond: string): Promise<string> {
      const t = makeTrigger({ id: `t-${cond}`, condition: cond, autoRoute: false });
      // @ts-ignore – autoRoute not in ConditionTrigger; access via bridge internal
      bridge = new ConditionTradeBridge({ autoRoute: false });
      const r = await bridge.processTrigger({ ...t, autoRoute: undefined as any });
      return r.action;
    }

    it('buy: crosses_above', async () => {
      bridge = new ConditionTradeBridge({ autoRoute: false });
      const r = await bridge.processTrigger(makeTrigger({ condition: 'crosses_above' }));
      expect(r.action).toBe('buy');
    });

    it('buy: oversold', async () => {
      bridge = new ConditionTradeBridge({ autoRoute: false });
      const r = await bridge.processTrigger(makeTrigger({ condition: 'oversold' }));
      expect(r.action).toBe('buy');
    });

    it('buy: golden_cross', async () => {
      bridge = new ConditionTradeBridge({ autoRoute: false });
      const r = await bridge.processTrigger(makeTrigger({ condition: 'golden_cross' }));
      expect(r.action).toBe('buy');
    });

    it('buy: breakout_up', async () => {
      bridge = new ConditionTradeBridge({ autoRoute: false });
      const r = await bridge.processTrigger(makeTrigger({ condition: 'breakout_up' }));
      expect(r.action).toBe('buy');
    });

    it('buy: above support', async () => {
      bridge = new ConditionTradeBridge({ autoRoute: false });
      const r = await bridge.processTrigger(makeTrigger({ condition: 'price above support' }));
      expect(r.action).toBe('buy');
    });

    it('sell: crosses_below', async () => {
      bridge = new ConditionTradeBridge({ autoRoute: false });
      const r = await bridge.processTrigger(makeTrigger({ condition: 'crosses_below' }));
      expect(r.action).toBe('sell');
    });

    it('sell: overbought', async () => {
      bridge = new ConditionTradeBridge({ autoRoute: false });
      const r = await bridge.processTrigger(makeTrigger({ condition: 'overbought' }));
      expect(r.action).toBe('sell');
    });

    it('sell: death_cross', async () => {
      bridge = new ConditionTradeBridge({ autoRoute: false });
      const r = await bridge.processTrigger(makeTrigger({ condition: 'death_cross' }));
      expect(r.action).toBe('sell');
    });

    it('sell: below resistance', async () => {
      bridge = new ConditionTradeBridge({ autoRoute: false });
      const r = await bridge.processTrigger(makeTrigger({ condition: 'below resistance 500' }));
      expect(r.action).toBe('sell');
    });

    it('hold: unknown condition', async () => {
      bridge = new ConditionTradeBridge({ autoRoute: false });
      const r = await bridge.processTrigger(makeTrigger({ condition: 'unknown_pattern' }));
      expect(r.action).toBe('hold');
    });
  });

  // ── AutoRoute: false ────────────────────────────────────────────────────

  describe('autoRoute=false (dry-run)', () => {
    it('returns pending signal without executing', async () => {
      bridge = new ConditionTradeBridge({ autoRoute: false });

      const t = makeTrigger({ id: 't1', condition: 'crosses_above', price: 300 });
      const result = await bridge.processTrigger(t);

      expect(result.status).toBe('pending');
      expect(result.action).toBe('buy');
      expect(result.executedAt).toBeUndefined();
      expect(result.orderId).toBeUndefined();
    });

    it('quantity defaults to 100', async () => {
      bridge = new ConditionTradeBridge({ autoRoute: false });
      const t = makeTrigger({ id: 't1', condition: 'crosses_above' });
      const result = await bridge.processTrigger(t);
      expect(result.quantity).toBe(100);
    });

    it('quantity from metadata.positionSize', async () => {
      bridge = new ConditionTradeBridge({ autoRoute: false });
      const t = makeTrigger({ id: 't1', condition: 'crosses_above', metadata: { positionSize: 500 } });
      const result = await bridge.processTrigger(t);
      expect(result.quantity).toBe(500);
    });
  });

  // ── autoRoute: true ─────────────────────────────────────────────────────

  describe('autoRoute=true (live-run)', () => {
    it('signals pending then executed', async () => {
      bridge = new ConditionTradeBridge({ autoRoute: true });

      const t = makeTrigger({ id: 't1', condition: 'crosses_above', price: 300 });
      const result = await bridge.processTrigger(t);

      // With autoRoute=true and action=buy (not hold): it executes
      expect(result.status).toBe('executed');
      expect(result.executedAt).toBeDefined();
      expect(result.orderId).toBeDefined();
    });

    it('hold action is not routed', async () => {
      bridge = new ConditionTradeBridge({ autoRoute: true });
      const t = makeTrigger({ id: 't1', condition: 'unknown_pattern' });
      const result = await bridge.processTrigger(t);
      expect(result.status).toBe('pending');
      expect(result.executedAt).toBeUndefined();
    });
  });

  // ── Retry logic ──────────────────────────────────────────────────────────

  describe('Retry logic', () => {
    it('maxRetries=0 still executes once', async () => {
      bridge = new ConditionTradeBridge({ autoRoute: true, maxRetries: 0 });
      const t = makeTrigger({ id: 't1', condition: 'crosses_above', price: 300 });
      const result = await bridge.processTrigger(t);
      expect(result.status).toBe('executed');
    });
  });

  // ── Stats ────────────────────────────────────────────────────────────────

  describe('Stats tracking', () => {
    it('increments totalTriggers', async () => {
      bridge = new ConditionTradeBridge({ autoRoute: false });
      await bridge.processTrigger(makeTrigger({ id: 't1' }));
      await bridge.processTrigger(makeTrigger({ id: 't2' }));
      expect(bridge.getStats().totalTriggers).toBe(2);
    });

    it('increments totalExecuted for buy/sell actions', async () => {
      bridge = new ConditionTradeBridge({ autoRoute: true });
      await bridge.processTrigger(makeTrigger({ id: 't1', condition: 'crosses_above' }));
      expect(bridge.getStats().totalExecuted).toBe(1);
    });

    it('increments totalRejected for cooldown/daily-limit', async () => {
      bridge = new ConditionTradeBridge({ cooldownMs: 60_000 });
      await bridge.processTrigger(makeTrigger({ id: 't1' }));
      await bridge.processTrigger(makeTrigger({ id: 't2' }));
      expect(bridge.getStats().totalRejected).toBe(1);
    });

    it('resets all stats on resetAll()', async () => {
      bridge = new ConditionTradeBridge({ autoRoute: false });
      await bridge.processTrigger(makeTrigger({ id: 't1' }));
      bridge.resetAll();
      const stats = bridge.getStats();
      expect(stats.totalTriggers).toBe(0);
      expect(stats.totalExecuted).toBe(0);
      expect(stats.totalRejected).toBe(0);
    });
  });

  // ── Reset ────────────────────────────────────────────────────────────────

  describe('Reset', () => {
    it('resetAll clears daily counts', async () => {
      bridge = new ConditionTradeBridge({ maxDailyTriggers: 2, autoRoute: false });
      await bridge.processTrigger(makeTrigger({ id: 't1', symbol: 'HK.00700' }));
      await bridge.processTrigger(makeTrigger({ id: 't2', symbol: 'HK.00700' }));

      bridge.resetAll();

      // After resetAll, daily count is cleared so limit is reset
      const result = await bridge.processTrigger(makeTrigger({ id: 't3', symbol: 'HK.00700' }));
      expect(result.status).not.toBe('rejected');
    });

    it('resetDailyCount clears only daily data', async () => {
      bridge = new ConditionTradeBridge({ autoRoute: false });
      await bridge.processTrigger(makeTrigger({ id: 't1' }));
      bridge.resetDailyCount();
      const stats = bridge.getStats();
      expect(stats.totalTriggers).toBe(1); // trigger count not cleared
    });
  });

  // ── Signal retrieval ─────────────────────────────────────────────────────

  describe('Signal retrieval', () => {
    it('getSignal returns signal by id', async () => {
      bridge = new ConditionTradeBridge({ autoRoute: false });
      const t = makeTrigger({ id: 'sig-test-001' });
      await bridge.processTrigger(t);
      const signal = bridge.getSignal('sig-test-001');
      expect(signal).toBeDefined();
      expect(signal!.trigger.id).toBe('sig-test-001');
    });

    it('getSignal returns undefined for unknown id', () => {
      bridge = new ConditionTradeBridge();
      const signal = bridge.getSignal('unknown-id');
      expect(signal).toBeUndefined();
    });
  });

  // ── Events ──────────────────────────────────────────────────────────────

  describe('Event emission', () => {
    it('emits signal:pending when signal is created', async () => {
      bridge = new ConditionTradeBridge({ autoRoute: false });
      const handler = vi.fn();
      bridge.on('signal:pending', handler);

      await bridge.processTrigger(makeTrigger({ id: 'evt-1' }));

      expect(handler).toHaveBeenCalledTimes(1);
      bridge.removeAllListeners();
    });

    it('emits signal:rejected on cooldown rejection', async () => {
      bridge = new ConditionTradeBridge({ cooldownMs: 60_000 });
      const handler = vi.fn();
      bridge.on('signal:rejected', handler);

      await bridge.processTrigger(makeTrigger({ id: 'r1' }));
      await bridge.processTrigger(makeTrigger({ id: 'r2' }));

      expect(handler).toHaveBeenCalledTimes(1); // only second is rejected
      bridge.removeAllListeners();
    });
  });
});

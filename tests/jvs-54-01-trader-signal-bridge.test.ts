/**
 * @vitest-environment node
 * J-54-01: Trader Signal Bridge Tests (20+ tests)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  TraderSignalBridge,
  getTraderSignalBridge,
  resetTraderSignalBridge,
} from '../electron/engine/analysis/trader-signal-bridge';

function mkSignal(overrides: Record<string, any> = {}) {
  return {
    signalId: 'sig_1',
    traderId: 't1',
    symbol: 'AAPL',
    side: 'buy' as const,
    confidence: 80,
    price: 150,
    ...overrides,
  };
}

function mkFollower(followerId: string, traderId: string, overrides: Record<string, any> = {}) {
  return {
    followerId,
    traderId,
    enabled: true,
    positionSize: 10,
    positionSizeMode: 'proportional' as const,
    maxSlippagePct: 2,
    accountEquity: 50000,
    ...overrides,
  };
}

// ── Section 1: Bridge Configuration ──────────────────────────────────────

describe('J-54-01-01: Bridge Configuration', () => {
  let bridge: TraderSignalBridge;

  beforeEach(() => {
    resetTraderSignalBridge();
    bridge = getTraderSignalBridge();
  });

  it('01: default config is correct', () => {
    const config = bridge.getConfig();
    expect(config.autoCopyEnabled).toBe(true);
    expect(config.minConfidenceForCopy).toBe(60);
    expect(config.maxFollowersPerSignal).toBe(100);
  });

  it('02: updateConfig changes values', () => {
    bridge.updateConfig({ minConfidenceForCopy: 70 });
    expect(bridge.getConfig().minConfidenceForCopy).toBe(70);
  });

  it('03: status starts as active', () => {
    expect(bridge.getStatus()).toBe('active');
  });

  it('04: pause/resume works', () => {
    bridge.pause();
    expect(bridge.getStatus()).toBe('paused');
    bridge.resume();
    expect(bridge.getStatus()).toBe('active');
  });
});

// ── Section 2: Follower Management ────────────────────────────────────────

describe('J-54-01-02: Follower Management', () => {
  let bridge: TraderSignalBridge;

  beforeEach(() => {
    resetTraderSignalBridge();
    bridge = getTraderSignalBridge();
  });

  it('05: addFollowerConfig succeeds', () => {
    expect(bridge.addFollowerConfig(mkFollower('f1', 't1'))).toBe(true);
    expect(bridge.getFollowerCount('t1')).toBe(1);
  });

  it('06: multiple followers for same trader', () => {
    bridge.addFollowerConfig(mkFollower('f1', 't1'));
    bridge.addFollowerConfig(mkFollower('f2', 't1'));
    bridge.addFollowerConfig(mkFollower('f3', 't1'));
    expect(bridge.getFollowerCount('t1')).toBe(3);
  });

  it('07: update existing follower config', () => {
    bridge.addFollowerConfig(mkFollower('f1', 't1', { positionSize: 10 }));
    bridge.addFollowerConfig(mkFollower('f1', 't1', { positionSize: 20 }));
    expect(bridge.getFollowerCount('t1')).toBe(1);
    expect(bridge.getFollowers('t1')[0].positionSize).toBe(20);
  });

  it('08: removeFollowerConfig works', () => {
    bridge.addFollowerConfig(mkFollower('f1', 't1'));
    bridge.addFollowerConfig(mkFollower('f2', 't1'));
    expect(bridge.removeFollowerConfig('t1', 'f1')).toBe(true);
    expect(bridge.getFollowerCount('t1')).toBe(1);
  });

  it('09: addFollowerConfig with empty ids fails', () => {
    expect(bridge.addFollowerConfig(mkFollower('', 't1'))).toBe(false);
    expect(bridge.addFollowerConfig(mkFollower('f1', ''))).toBe(false);
  });
});

// ── Section 3: Signal Processing Pipeline ─────────────────────────────────

describe('J-54-01-03: Signal Processing Pipeline', () => {
  let bridge: TraderSignalBridge;

  beforeEach(() => {
    resetTraderSignalBridge();
    bridge = getTraderSignalBridge();
    bridge.addFollowerConfig(mkFollower('f1', 't1'));
    bridge.addFollowerConfig(mkFollower('f2', 't1'));
    bridge.addFollowerConfig(mkFollower('f3', 't1', { enabled: false }));
  });

  it('10: processSignal returns summary with correct counts', () => {
    const summary = bridge.processSignal(mkSignal());
    expect(summary.signalId).toBe('sig_1');
    expect(summary.followersAttempted).toBe(2); // f1 + f2 (f3 disabled)
    expect(summary.followersSucceeded).toBe(2);
    expect(summary.followersFailed).toBe(0);
  });

  it('11: buy signal creates orders', () => {
    const summary = bridge.processSignal(mkSignal({ side: 'buy' }));
    expect(summary.followersSucceeded).toBe(2);
    const orders = bridge.getOrdersBySignal('sig_1');
    expect(orders.length).toBe(2);
    orders.forEach(o => expect(o.side).toBe('buy'));
  });

  it('12: sell signal creates orders', () => {
    const summary = bridge.processSignal(mkSignal({ side: 'sell' }));
    expect(summary.followersSucceeded).toBe(2);
    const orders = bridge.getOrdersBySignal('sig_1');
    orders.forEach(o => expect(o.side).toBe('sell'));
  });

  it('13: hold signal is skipped for copy', () => {
    const summary = bridge.processSignal(mkSignal({ side: 'hold' }));
    expect(summary.followersSucceeded).toBe(0);
    expect(summary.followersFailed).toBe(2); // hold is not copied
  });

  it('14: low confidence signal skips copy', () => {
    bridge.updateConfig({ minConfidenceForCopy: 90 });
    const summary = bridge.processSignal(mkSignal({ confidence: 50 }));
    expect(summary.followersAttempted).toBe(0);
  });

  it('15: updates trader metrics', () => {
    bridge.processSignal(mkSignal());
    bridge.processSignal(mkSignal({ signalId: 'sig_2' }));
    const metrics = bridge.getTraderMetrics('t1');
    expect(metrics).not.toBeNull();
    expect(metrics!.signalsPublished).toBe(2);
    expect(metrics!.copyTradesTriggered).toBeGreaterThan(0);
  });

  it('16: pipeline log records all stages', () => {
    bridge.processSignal(mkSignal());
    const log = bridge.getPipelineLog('sig_1');
    expect(log.length).toBeGreaterThanOrEqual(4);
    const stages = log.map(e => e.stage);
    expect(stages).toContain('signal_received');
    expect(stages).toContain('profile_updated');
    expect(stages).toContain('followers_notified');
    expect(stages).toContain('completed');
  });
});

// ── Section 4: Edge Cases & Queries ──────────────────────────────────────

describe('J-54-01-04: Edge Cases & Queries', () => {
  let bridge: TraderSignalBridge;

  beforeEach(() => {
    resetTraderSignalBridge();
    bridge = getTraderSignalBridge();
  });

  it('17: processSignal when paused returns empty summary', () => {
    bridge.addFollowerConfig(mkFollower('f1', 't1'));
    bridge.pause();
    const summary = bridge.processSignal(mkSignal());
    expect(summary.followersAttempted).toBe(0);
  });

  it('18: processSignal with no followers returns 0 attempted', () => {
    const summary = bridge.processSignal(mkSignal());
    expect(summary.followersAttempted).toBe(0);
    expect(summary.followersSucceeded).toBe(0);
  });

  it('19: getStats returns aggregate stats', () => {
    bridge.addFollowerConfig(mkFollower('f1', 't1'));
    bridge.addFollowerConfig(mkFollower('f2', 't1'));
    bridge.processSignal(mkSignal({ signalId: 's1' }));
    bridge.processSignal(mkSignal({ signalId: 's2' }));
    const stats = bridge.getStats();
    expect(stats.totalSignalsProcessed).toBe(2);
    expect(stats.totalCopyTradesExecuted).toBe(4); // 2 signals × 2 followers
    expect(stats.status).toBe('active');
  });

  it('20: getOrdersByFollower returns correct orders', () => {
    bridge.addFollowerConfig(mkFollower('f1', 't1'));
    bridge.processSignal(mkSignal({ signalId: 's1' }));
    bridge.processSignal(mkSignal({ signalId: 's2' }));
    const orders = bridge.getOrdersByFollower('f1');
    expect(orders.length).toBe(2);
  });

  it('21: fixed positionSizeMode works', () => {
    bridge.addFollowerConfig(mkFollower('f1', 't1', { positionSizeMode: 'fixed', positionSize: 2000 }));
    bridge.processSignal(mkSignal({ price: 100 }));
    const orders = bridge.getOrdersBySignal('sig_1');
    expect(orders[0].quantity).toBe(20); // 2000/100
  });

  it('22: zero account equity follower fails gracefully', () => {
    bridge.addFollowerConfig(mkFollower('f1', 't1', { accountEquity: 0 }));
    const summary = bridge.processSignal(mkSignal());
    expect(summary.followersFailed).toBe(1);
  });

  it('23: maxFollowersPerSignal limits copies', () => {
    bridge.updateConfig({ maxFollowersPerSignal: 2 });
    for (let i = 0; i < 5; i++) bridge.addFollowerConfig(mkFollower(`f${i}`, 't1'));
    const summary = bridge.processSignal(mkSignal());
    expect(summary.followersAttempted).toBe(2);
  });

  it('24: reset clears all state', () => {
    bridge.addFollowerConfig(mkFollower('f1', 't1'));
    bridge.processSignal(mkSignal());
    bridge.reset();
    expect(bridge.getStats().totalSignalsProcessed).toBe(0);
    expect(bridge.getFollowerCount('t1')).toBe(0);
  });
});

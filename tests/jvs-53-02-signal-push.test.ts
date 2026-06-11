/**
 * J-53-02: Signal Push Engine Tests (25+ tests)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  SignalPushEngine,
  SignalDeduplicator,
  SignalQualityScorer,
  getSignalPushEngine,
  resetSignalPushEngine,
} from '../electron/engine/data/signal-push-engine';

function mkSignalInput(overrides: Record<string, any> = {}) {
  return {
    traderId: 'trader_1',
    traderName: 'TestTrader',
    symbol: 'AAPL',
    direction: 'BUY' as const,
    confidence: 75,
    entryPrice: 150.0,
    stopLoss: 145.0,
    takeProfit: 160.0,
    reasoning: 'Strong momentum breakout above resistance with high volume confirmation',
    ...overrides,
  };
}

// ── Section 1: Signal Deduplicator ──────────────────────────────────────

describe('J-53-02-01: SignalDeduplicator', () => {
  let dedup: SignalDeduplicator;
  beforeEach(() => { dedup = new SignalDeduplicator(5000); });

  it('A01: computeHash is deterministic', () => {
    const h1 = dedup.computeHash('t1', 'AAPL', 'BUY', 150);
    const h2 = dedup.computeHash('t1', 'AAPL', 'BUY', 150);
    expect(h1).toBe(h2);
  });

  it('A02: different inputs produce different hashes', () => {
    const h1 = dedup.computeHash('t1', 'AAPL', 'BUY', 150);
    const h2 = dedup.computeHash('t1', 'AAPL', 'SELL', 150);
    expect(h1).not.toBe(h2);
  });

  it('A03: isDuplicate returns false for new hash', () => {
    const h = dedup.computeHash('t1', 'AAPL', 'BUY', 150);
    expect(dedup.isDuplicate(h)).toBe(false);
  });

  it('A04: isDuplicate returns true after record', () => {
    const h = dedup.computeHash('t1', 'AAPL', 'BUY', 150);
    dedup.record(h);
    expect(dedup.isDuplicate(h)).toBe(true);
  });

  it('A05: getActiveCount tracks recorded hashes', () => {
    dedup.record('hash1');
    dedup.record('hash2');
    expect(dedup.getActiveCount()).toBe(2);
  });
});

// ── Section 2: Signal Quality Scorer ────────────────────────────────────

describe('J-53-02-02: SignalQualityScorer', () => {
  let scorer: SignalQualityScorer;
  beforeEach(() => { scorer = new SignalQualityScorer(); });

  it('B01: high quality signal scores >= 70', () => {
    const score = scorer.score({
      confidence: 90,
      traderWinRate: 65,
      traderSharpe: 2.0,
      hasStopLoss: true,
      hasTakeProfit: true,
      reasoningLength: 100,
    });
    expect(score).toBeGreaterThanOrEqual(70);
  });

  it('B02: low quality signal scores < 30', () => {
    const score = scorer.score({
      confidence: 20,
      traderWinRate: 30,
      traderSharpe: 0.1,
      hasStopLoss: false,
      hasTakeProfit: false,
      reasoningLength: 5,
    });
    expect(score).toBeLessThan(30);
  });

  it('B03: score clamped to 0-100', () => {
    const s1 = scorer.score({ confidence: 100, traderWinRate: 100, traderSharpe: 10, hasStopLoss: true, hasTakeProfit: true, reasoningLength: 1000 });
    expect(s1).toBeLessThanOrEqual(100);
    const s2 = scorer.score({ confidence: 0, traderWinRate: 0, traderSharpe: -5, hasStopLoss: false, hasTakeProfit: false, reasoningLength: 0 });
    expect(s2).toBeGreaterThanOrEqual(0);
  });
});

// ── Section 3: Signal Generation ────────────────────────────────────────

describe('J-53-02-03: Signal Generation', () => {
  let engine: SignalPushEngine;
  beforeEach(() => { resetSignalPushEngine(); engine = getSignalPushEngine(); });

  it('C01: generateSignal returns valid signal', () => {
    const s = engine.generateSignal(mkSignalInput());
    expect(s).not.toBeNull();
    expect(s!.id.startsWith('sig_')).toBe(true);
    expect(s!.status).toBe('active');
    expect(s!.direction).toBe('BUY');
  });

  it('C02: rejects empty symbol', () => {
    expect(engine.generateSignal(mkSignalInput({ symbol: '' }))).toBeNull();
  });

  it('C03: rejects invalid confidence', () => {
    expect(engine.generateSignal(mkSignalInput({ confidence: -1 }))).toBeNull();
    expect(engine.generateSignal(mkSignalInput({ confidence: 101 }))).toBeNull();
  });

  it('C04: rejects zero/negative price', () => {
    expect(engine.generateSignal(mkSignalInput({ entryPrice: 0 }))).toBeNull();
    expect(engine.generateSignal(mkSignalInput({ entryPrice: -5 }))).toBeNull();
  });

  it('C05: deduplicates identical signals', () => {
    const s1 = engine.generateSignal(mkSignalInput());
    const s2 = engine.generateSignal(mkSignalInput());
    expect(s1).not.toBeNull();
    expect(s2).toBeNull();
  });

  it('C06: different symbols are not deduplicated', () => {
    const s1 = engine.generateSignal(mkSignalInput({ symbol: 'AAPL' }));
    const s2 = engine.generateSignal(mkSignalInput({ symbol: 'MSFT' }));
    expect(s1).not.toBeNull();
    expect(s2).not.toBeNull();
  });

  it('C07: signal has quality score', () => {
    const s = engine.generateSignal(mkSignalInput());
    expect(s!.qualityScore).toBeGreaterThanOrEqual(0);
    expect(s!.qualityScore).toBeLessThanOrEqual(100);
  });

  it('C08: signal has dedup hash', () => {
    const s = engine.generateSignal(mkSignalInput());
    expect(s!.dedupHash).toBeDefined();
    expect(s!.dedupHash.length).toBe(8);
  });

  it('C09: priority is assigned correctly', () => {
    const urgent = engine.generateSignal(mkSignalInput({ confidence: 95, reasoning: 'Very strong signal with multiple confirmations across indicators and volume analysis' }));
    expect(['high', 'urgent']).toContain(urgent!.priority);
  });
});

// ── Section 4: Signal Lifecycle ─────────────────────────────────────────

describe('J-53-02-04: Signal Lifecycle', () => {
  let engine: SignalPushEngine;
  let sigId: string;

  beforeEach(() => {
    resetSignalPushEngine();
    engine = getSignalPushEngine();
    sigId = engine.generateSignal(mkSignalInput())!.id;
  });

  it('D01: getSignal returns signal', () => {
    expect(engine.getSignal(sigId)).not.toBeNull();
    expect(engine.getSignal(sigId)!.status).toBe('active');
  });

  it('D02: cancelSignal works', () => {
    expect(engine.cancelSignal(sigId)).toBe(true);
    expect(engine.getSignal(sigId)!.status).toBe('cancelled');
  });

  it('D03: cannot cancel non-active signal', () => {
    engine.cancelSignal(sigId);
    expect(engine.cancelSignal(sigId)).toBe(false);
  });

  it('D04: expireSignal works', () => {
    expect(engine.expireSignal(sigId)).toBe(true);
    expect(engine.getSignal(sigId)!.status).toBe('expired');
  });

  it('D05: markExecuted works', () => {
    expect(engine.markExecuted(sigId)).toBe(true);
    expect(engine.getSignal(sigId)!.status).toBe('executed');
  });

  it('D06: getSignals filter by direction', () => {
    engine.generateSignal(mkSignalInput({ symbol: 'TSLA', direction: 'SELL', entryPrice: 200 }));
    const buys = engine.getSignals({ direction: 'BUY', page: 1, pageSize: 10 });
    expect(buys.signals.every(s => s.direction === 'BUY')).toBe(true);
  });
});

// ── Section 5: Push & Subscriptions ─────────────────────────────────────

describe('J-53-02-05: Push & Subscriptions', () => {
  let engine: SignalPushEngine;

  beforeEach(() => {
    resetSignalPushEngine();
    engine = getSignalPushEngine();
  });

  it('E01: subscribe creates subscription', () => {
    expect(engine.subscribe('sub1', 'trader_1', 60)).toBe(true);
    expect(engine.getSubscriberCount('trader_1')).toBe(1);
  });

  it('E02: cannot subscribe twice', () => {
    engine.subscribe('sub1', 'trader_1');
    expect(engine.subscribe('sub1', 'trader_1')).toBe(false);
  });

  it('E03: unsubscribe works', () => {
    engine.subscribe('sub1', 'trader_1');
    expect(engine.unsubscribe('sub1', 'trader_1')).toBe(true);
    expect(engine.getSubscriberCount('trader_1')).toBe(0);
  });

  it('E04: pushSignal notifies matching subscribers', () => {
    engine.subscribe('sub1', 'trader_1', 50);
    engine.subscribe('sub2', 'trader_1', 80);
    engine.subscribe('sub3', 'trader_1', 70);

    const signal = engine.generateSignal(mkSignalInput({ confidence: 75 }));
    const result = engine.pushSignal(signal!.id);
    expect(result).not.toBeNull();
    expect(result!.subscribersNotified).toBe(2); // sub1(50) + sub3(70), not sub2(80)
  });

  it('E05: pushSignal filters by symbol', () => {
    engine.subscribe('sub1', 'trader_1', 50, ['AAPL']);
    engine.subscribe('sub2', 'trader_1', 50, ['MSFT']);

    const signal = engine.generateSignal(mkSignalInput({ symbol: 'AAPL', confidence: 80 }));
    const result = engine.pushSignal(signal!.id);
    expect(result!.subscribersNotified).toBe(1);
  });

  it('E06: push latency < 500ms', () => {
    for (let i = 0; i < 100; i++) {
      engine.subscribe(`sub_${i}`, 'trader_1', 50);
    }
    const signal = engine.generateSignal(mkSignalInput());
    const result = engine.pushSignal(signal!.id);
    expect(result!.latencyMs).toBeLessThan(500);
  });

  it('E07: pushSignal returns null for non-active', () => {
    const signal = engine.generateSignal(mkSignalInput());
    engine.cancelSignal(signal!.id);
    expect(engine.pushSignal(signal!.id)).toBeNull();
  });
});

// ── Section 6: Stats & Cleanup ──────────────────────────────────────────

describe('J-53-02-06: Stats & Cleanup', () => {
  beforeEach(() => { resetSignalPushEngine(); });

  it('F01: getStats returns correct counts', () => {
    const engine = getSignalPushEngine();
    const s1 = engine.generateSignal(mkSignalInput({ symbol: 'A' }));
    const s2 = engine.generateSignal(mkSignalInput({ symbol: 'B', entryPrice: 200 }));
    engine.cancelSignal(s1!.id);

    const stats = engine.getStats();
    expect(stats.totalSignals).toBe(2);
    expect(stats.activeSignals).toBe(1);
    expect(stats.executedSignals).toBe(0);
  });

  it('F02: cleanupExpired marks expired signals', () => {
    const engine = getSignalPushEngine();
    const signal = engine.generateSignal(mkSignalInput({ ttlMinutes: -1 }));
    // Signal with 0 min TTL is already expired
    const cleaned = engine.cleanupExpired();
    expect(cleaned).toBeGreaterThanOrEqual(1);
    expect(engine.getSignal(signal!.id)!.status).toBe('expired');
  });

  it('F03: singleton returns same instance', () => {
    const a = getSignalPushEngine();
    const b = getSignalPushEngine();
    expect(a).toBe(b);
  });

  it('F04: reset clears everything', () => {
    const engine = getSignalPushEngine();
    engine.generateSignal(mkSignalInput());
    resetSignalPushEngine();
    const fresh = getSignalPushEngine();
    expect(fresh.getStats().totalSignals).toBe(0);
  });
});

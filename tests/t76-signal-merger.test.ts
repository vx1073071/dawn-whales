import { describe, it, expect } from 'vitest';
import { SignalMerger } from '../electron/workers/signal-merger';

describe('SignalMerger', () => {
  function makeSig(symbol: string, dir: 'long' | 'short', source: string, strength = 0.8): any {
    return { symbol, direction: dir, strength, source, reason: 'test', timestamp: Date.now() };
  }

  it('should merge signals from different sources', () => {
    const m = new SignalMerger();
    m.addSignal(makeSig('AAPL', 'long', 'MA'));
    const result = m.addSignal(makeSig('AAPL', 'long', 'RSI'));

    expect(result).not.toBeNull();
    expect(result!.symbol).toBe('AAPL');
    expect(result!.sources).toHaveLength(2);
    expect(result!.consensus).toBe(1);
  });

  it('should ignore single-source signals', () => {
    const m = new SignalMerger();
    const result = m.addSignal(makeSig('TSLA', 'short', 'MA'));
    expect(result).toBeNull();
  });

  it('should report conflicts', () => {
    const m = new SignalMerger();
    m.addSignal(makeSig('AAPL', 'long', 'MA'));
    m.addSignal(makeSig('AAPL', 'long', 'MA')); // same source again
    const result = m.addSignal(makeSig('AAPL', 'long', 'RSI'));
    expect(result!.conflicts).toBe(1); // MA counted twice
  });

  it('should weight by strategy', () => {
    const m = new SignalMerger();
    m.setWeight('MA', 3);
    m.setWeight('RSI', 1);
    m.addSignal(makeSig('AAPL', 'long', 'MA', 0.5));
    const result = m.addSignal(makeSig('AAPL', 'long', 'RSI', 0.9));
    // Weighted: (0.5*3 + 0.9*1) / 4 = 0.6
    expect(result!.strength).toBeCloseTo(0.6, 1);
  });
});

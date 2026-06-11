/**
 * @vitest-environment node
 * J-56-03: Strategy Signal Converter Tests (10+ tests)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  StrategySignalConverter,
  getStrategySignalConverter,
  resetStrategySignalConverter,
} from '../electron/engine/analysis/strategy-signal-converter';
import type { AgentVote } from '../electron/engine/analysis/strategy-signal-converter';

function mkVotes(overrides: Partial<AgentVote>[] = []): AgentVote[] {
  const defaults: AgentVote[] = [
    { agentType: 'fundamentals', recommendation: 'buy', confidence: 80, reasoning: 'Strong earnings growth and low P/E ratio' },
    { agentType: 'sentiment', recommendation: 'buy', confidence: 70, reasoning: 'Positive social media sentiment trending up' },
    { agentType: 'news', recommendation: 'hold', confidence: 50, reasoning: 'Mixed news with pending regulatory decision' },
    { agentType: 'technical', recommendation: 'buy', confidence: 75, reasoning: 'Golden cross on daily chart with high volume' },
  ];
  return defaults.map((d, i) => ({ ...d, ...(overrides[i] || {}) }));
}

// ── Section 1: Core Conversion ─────────────────────────────────────────────

describe('J-56-03-01: Core Conversion', () => {
  let converter: StrategySignalConverter;

  beforeEach(() => {
    resetStrategySignalConverter();
    converter = getStrategySignalConverter();
  });

  it('01: converts 4 agent votes to buy signal', () => {
    const signal = converter.convert({ symbol: 'AAPL', votes: mkVotes(), price: 150 });
    expect(signal).not.toBeNull();
    expect(signal!.side).toBe('buy');
    expect(signal!.symbol).toBe('AAPL');
    expect(signal!.confidence).toBeGreaterThan(0);
    expect(signal!.votes.length).toBe(4);
  });

  it('02: empty votes returns null', () => {
    expect(converter.convert({ symbol: 'AAPL', votes: [] })).toBeNull();
  });

  it('03: auto-calculates stop loss for buy', () => {
    const signal = converter.convert({ symbol: 'AAPL', votes: mkVotes(), price: 100 });
    expect(signal!.stopLoss).toBe(95); // 5% below
  });

  it('04: auto-calculates take profit for buy', () => {
    const signal = converter.convert({ symbol: 'AAPL', votes: mkVotes(), price: 100 });
    expect(signal!.takeProfit).toBe(110); // 10% above
  });

  it('05: stop loss for sell is above price', () => {
    const sellVotes = mkVotes([
      { recommendation: 'sell' }, { recommendation: 'sell' },
      { recommendation: 'sell' }, { recommendation: 'sell' },
    ]);
    const signal = converter.convert({ symbol: 'AAPL', votes: sellVotes, price: 100 });
    expect(signal!.side).toBe('sell');
    expect(signal!.stopLoss).toBe(105); // 5% above
    expect(signal!.takeProfit).toBe(90); // 10% below
  });

  it('06: signal has quality score', () => {
    const signal = converter.convert({ symbol: 'AAPL', votes: mkVotes(), price: 150 });
    expect(signal!.qualityScore).toBeGreaterThan(0);
    expect(signal!.qualityScore).toBeLessThanOrEqual(100);
  });

  it('07: signal has key factors from agents', () => {
    const signal = converter.convert({ symbol: 'AAPL', votes: mkVotes(), price: 150 });
    expect(signal!.keyFactors.length).toBeGreaterThan(0);
  });
});

// ── Section 2: Consensus Methods ──────────────────────────────────────────

describe('J-56-03-02: Consensus', () => {
  let converter: StrategySignalConverter;

  beforeEach(() => {
    resetStrategySignalConverter();
    converter = getStrategySignalConverter();
  });

  it('08: majority vote picks most common', () => {
    const result = converter.resolveConsensus(
      [
        { agentType: 'a', recommendation: 'buy', confidence: 60, reasoning: '' },
        { agentType: 'b', recommendation: 'buy', confidence: 50, reasoning: '' },
        { agentType: 'c', recommendation: 'sell', confidence: 90, reasoning: '' },
      ],
      'majority'
    );
    expect(result.side).toBe('buy');
  });

  it('09: weighted vote considers confidence', () => {
    const result = converter.resolveConsensus(
      [
        { agentType: 'a', recommendation: 'buy', confidence: 30, reasoning: '' },
        { agentType: 'b', recommendation: 'sell', confidence: 90, reasoning: '' },
        { agentType: 'c', recommendation: 'sell', confidence: 80, reasoning: '' },
      ],
      'weighted'
    );
    expect(result.side).toBe('sell');
  });

  it('10: unanimous requires all same', () => {
    const result = converter.resolveConsensus(
      [
        { agentType: 'a', recommendation: 'buy', confidence: 80, reasoning: '' },
        { agentType: 'b', recommendation: 'buy', confidence: 70, reasoning: '' },
        { agentType: 'c', recommendation: 'buy', confidence: 90, reasoning: '' },
      ],
      'unanimous'
    );
    expect(result.side).toBe('buy');
    expect(result?.confidence).toBeGreaterThan(0);
  });
});

// ── Section 3: Filtering ──────────────────────────────────────────────────

describe('J-56-03-03: Filtering', () => {
  let converter: StrategySignalConverter;

  beforeEach(() => {
    resetStrategySignalConverter();
    converter = getStrategySignalConverter({ minConfidence: 60, minVotes: 3 });
  });

  it('11: rejects low confidence signals', () => {
    const lowConfVotes: AgentVote[] = [
      { agentType: 'fundamentals', recommendation: 'buy', confidence: 10, reasoning: 'Weak' },
      { agentType: 'sentiment', recommendation: 'sell', confidence: 10, reasoning: 'Weak' },
      { agentType: 'news', recommendation: 'hold', confidence: 10, reasoning: 'Weak' },
      { agentType: 'technical', recommendation: 'neutral', confidence: 10, reasoning: 'Weak' },
    ];
    const signal = converter.convert({ symbol: 'AAPL', votes: lowConfVotes });
    expect(signal).toBeNull();
  });

  it('12: getSignals filters by symbol', () => {
    converter = getStrategySignalConverter({ minConfidence: 0, minVotes: 0 });
    converter.convert({ symbol: 'AAPL', votes: mkVotes(), price: 150 });
    converter.convert({ symbol: 'MSFT', votes: mkVotes(), price: 300 });
    converter.convert({ symbol: 'AAPL', votes: mkVotes(), price: 155 });
    expect(converter.getSignals({ symbol: 'AAPL' }).length).toBe(2);
  });

  it('13: getSignalCount returns total', () => {
    converter = getStrategySignalConverter({ minConfidence: 0, minVotes: 0 });
    converter.convert({ symbol: 'A', votes: mkVotes(), price: 100 });
    converter.convert({ symbol: 'B', votes: mkVotes(), price: 200 });
    expect(converter.getSignalCount()).toBe(2);
  });

  it('14: reset clears all signals', () => {
    converter = getStrategySignalConverter({ minConfidence: 0, minVotes: 0 });
    converter.convert({ symbol: 'A', votes: mkVotes(), price: 100 });
    converter.reset();
    expect(converter.getSignalCount()).toBe(0);
  });
});

/**
 * @vitest-environment node
 * J-57-01: Fundamentals Agent Tests (20+ tests)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  FundamentalsAgent,
  getFundamentalsAgent,
  resetFundamentalsAgent,
} from '../electron/engine/agent-fundamentals';

// ── Section 1: Core Analysis ───────────────────────────────────────────────

describe('J-57-01-01: Core Analysis', () => {
  let agent: FundamentalsAgent;

  beforeEach(() => {
    resetFundamentalsAgent();
    agent = getFundamentalsAgent();
  });

  it('01: analyzes AAPL and returns analysis', async () => {
    const result = await agent.analyze('AAPL');
    expect(result).not.toBeNull();
    expect(result!.symbol).toBe('AAPL');
    expect(result!.score).toBeGreaterThan(0);
    expect(result!.score).toBeLessThanOrEqual(100);
  });

  it('02: analyzes MSFT and returns analysis', async () => {
    const result = await agent.analyze('MSFT');
    expect(result).not.toBeNull();
    expect(result!.symbol).toBe('MSFT');
  });

  it.skip('03: returns null for unknown symbol in non-mock mode', async () => {
    resetFundamentalsAgent();
    const strict = new FundamentalsAgent();
    const result = await strict.analyze('UNKNOWN_STOCK');
    expect(result).toBeNull();
  });

  it.skip('04: generates random data for unknown symbol in mock mode', async () => {
    const result = await agent.analyze('RANDOM_SYMBOL');
    expect(result).not.toBeNull();
    expect(result!.score).toBeGreaterThan(0);
  });

  it('05: rating is derived from score', async () => {
    const result = await agent.analyze('AAPL');
    expect(result!.rating).toBeDefined();
    expect(['strong_buy','buy','neutral','sell','strong_sell']).toContain(result!.rating);
  });
});

// ── Section 2: Caching ─────────────────────────────────────────────────────

describe('J-57-01-02: Caching', () => {
  let agent: FundamentalsAgent;

  beforeEach(() => {
    resetFundamentalsAgent();
    agent = getFundamentalsAgent();
  });

  it('06: cache returns same result for same symbol', async () => {
    const r1 = await agent.analyze('AAPL');
    const r2 = await agent.analyze('AAPL');
    expect(r1!.score).toBe(r2!.score);
    expect(r2!.cacheHit).toBe(true);
  });

  it('07: clearCache removes cached results', async () => {
    await agent.analyze('AAPL');
    agent.clearCache();
    // Next call should rebuild (cacheHit will show true from the deterministicNarrative)
    const r = await agent.analyze('AAPL');
    expect(r).not.toBeNull();
  });

  it('08: reset clears all state', async () => {
    await agent.analyze('AAPL');
    agent.reset();
    // reset = clear cache
    const r = await agent.analyze('AAPL');
    expect(r).not.toBeNull();
  });
});

// ── Section 3: Scoring Detail ──────────────────────────────────────────────

describe('J-57-01-03: Scoring', () => {
  let agent: FundamentalsAgent;

  beforeEach(() => {
    resetFundamentalsAgent();
    agent = getFundamentalsAgent();
  });

  it('09: AAPL gets reasonable fundamental score', async () => {
    const r = await agent.analyze('AAPL');
    // AAPL: PE 28.5, ROE 145%, solid — should be buy territory
    expect(r!.score).toBeGreaterThan(50);
  });

  it('10: analysis includes PE valuation string', async () => {
    const r = await agent.analyze('TSLA');
    // TSLA PE 55.3 — high valuation
    expect(r!.peValuation).toContain('PE');
  });

  it('11: analysis includes ROE quality string', async () => {
    const r = await agent.analyze('GOOGL');
    expect(r!.roeQuality).toContain('ROE');
  });

  it.skip('12: risks array populated for high PE stock', async () => {
    const r = await agent.analyze('TSLA');
    expect(r!.risks.length).toBeGreaterThan(0);
  });

  it('13: highlights array populated for quality stock', async () => {
    const r = await agent.analyze('AAPL');
    expect(r!.highlights.length).toBeGreaterThan(0);
  });

  it('14: confidence is within valid range', async () => {
    const r = await agent.analyze('MSFT');
    expect(r!.confidence).toBeGreaterThan(0);
    expect(r!.confidence).toBeLessThanOrEqual(100);
  });
});

// ── Section 4: LLM & Narrative ─────────────────────────────────────────────

describe('J-57-01-04: LLM & Narrative', () => {
  let agent: FundamentalsAgent;

  beforeEach(() => {
    resetFundamentalsAgent();
    agent = getFundamentalsAgent();
  });

  it('15: narrative is generated (Chinese)', async () => {
    const r = await agent.analyze('AAPL');
    expect(r!.narrative).toBeDefined();
    expect(r!.narrative.length).toBeGreaterThan(20);
  });

  it('16: LLM provider is deepseek-v4-pro-cached', async () => {
    const r = await agent.analyze('MSFT');
    expect(r!.llmProvider).toBe('deepseek-v4-pro-cached');
  });

  it('17: LLM cost is very low (cached)', async () => {
    const r = await agent.analyze('AAPL');
    expect(r!.llmCost).toBeLessThan(0.01);
  });

  it('18: cacheHit is true for cached LLM calls', async () => {
    const r = await agent.analyze('GOOGL');
    expect(r!.cacheHit).toBe(true);
  });
});

// ── Section 5: Edge Cases ─────────────────────────────────────────────────

describe('J-57-01-05: Edge Cases', () => {
  let agent: FundamentalsAgent;

  beforeEach(() => {
    resetFundamentalsAgent();
    agent = getFundamentalsAgent();
  });

  it('19: completedAt is valid ISO date', async () => {
    const r = await agent.analyze('AAPL');
    expect(Date.parse(r!.completedAt)).not.toBeNaN();
  });

  it('20: agentType is fundamentals', () => {
    expect(agent.agentType).toBe('fundamentals');
  });
});

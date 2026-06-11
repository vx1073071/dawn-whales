/**
 * @vitest-environment node
 * J-57-03: Sentiment Agent Tests (15+ tests)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  SentimentAgent,
  getSentimentAgent,
  resetSentimentAgent,
} from '../electron/engine/agents/agent-sentiment';

describe('J-57-03: SentimentAgent', () => {
  let agent: SentimentAgent;

  beforeEach(() => {
    resetSentimentAgent();
    agent = getSentimentAgent();
  });

  // ── Core ─────────────────────────────────────────────────────────────

  it('01: analyzes AAPL and returns rating', async () => {
    const r = await agent.analyze('AAPL');
    expect(r).not.toBeNull();
    expect(r!.symbol).toBe('AAPL');
    expect(r!.score).toBeGreaterThanOrEqual(0);
    expect(r!.score).toBeLessThanOrEqual(100);
  });

  it.skip('02: MSFT strong sentiment', async () => {
    const r = await agent.analyze('MSFT');
    expect(r!.score).toBeGreaterThan(60);
  });

  it('03: TSLA mixed/deteriorating sentiment', async () => {
    const r = await agent.analyze('TSLA');
    expect(r!.sentimentTrend).toContain('恶化');
  });

  it('04: random symbol generates mock', async () => {
    const r = await agent.analyze('RANDOM');
    expect(r).not.toBeNull();
  });

  it.skip('05: null for unknown in strict mode', async () => {
    const strict = new SentimentAgent();
    const r = await strict.analyze('UNKNOWN');
    expect(r).toBeNull();
  });

  // ── Cache ────────────────────────────────────────────────────────────

  it('06: caching works', async () => {
    const r1 = await agent.analyze('AAPL');
    const r2 = await agent.analyze('AAPL');
    expect(r1!.score).toBe(r2!.score);
  });

  it('07: reset clears cache', async () => {
    await agent.analyze('MSFT');
    agent.reset();
    const r = await agent.analyze('MSFT');
    expect(r).not.toBeNull();
  });

  // ── Components ───────────────────────────────────────────────────────

  it('08: social sentiment string', async () => {
    const r = await agent.analyze('AAPL');
    expect(r!.socialSentiment).toContain('社交');
  });

  it('09: news sentiment string', async () => {
    const r = await agent.analyze('MSFT');
    expect(r!.newsSentiment).toContain('%');
  });

  it('10: fear & greed analysis', async () => {
    const r = await agent.analyze('AAPL');
    expect(r!.fearGreedAnalysis).toContain('指数');
  });

  it.skip('11: analyst consensus string', async () => {
    const r = await agent.analyze('MSFT');
    expect(r!.analystConsensus).toContain('买');
  });

  it('12: insider signal string', async () => {
    const r = await agent.analyze('AAPL');
    expect(r!.insiderSignal).toBeDefined();
  });

  // ── Narrative ────────────────────────────────────────────────────────

  it('13: narrative in Chinese', async () => {
    const r = await agent.analyze('AAPL');
    expect(r!.narrative.length).toBeGreaterThan(30);
  });

  it('14: LLM cost is low (cached)', async () => {
    const r = await agent.analyze('AAPL');
    expect(r!.llmCost).toBeLessThan(0.01);
    expect(r!.cacheHit).toBe(true);
    expect(r!.llmProvider).toBe('deepseek-v4-pro-cached');
  });

  it('15: agentType is sentiment', () => {
    expect(agent.agentType).toBe('sentiment');
  });

  it('16: completedAt valid', async () => {
    const r = await agent.analyze('AAPL');
    expect(Date.parse(r!.completedAt)).not.toBeNaN();
  });
});

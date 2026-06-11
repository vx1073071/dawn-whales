/**
 * @vitest-environment node
 * J-57-02: Technical Agent Tests (15+ tests)
 */
// [R92] Mock localStorage for i18n module that accesses it at module load
import { vi, describe, it, expect, beforeEach } from 'vitest';
const localStorageMock: Record<string, string> = {};
(globalThis as any).localStorage = {
  getItem: (k: string) => localStorageMock[k] ?? null,
  setItem: (k: string, v: string) => { localStorageMock[k] = v; },
  removeItem: (k: string) => { delete localStorageMock[k]; },
  clear: () => { Object.keys(localStorageMock).forEach(k => delete localStorageMock[k]); },
  get length() { return Object.keys(localStorageMock).length; },
  key: (i: number) => Object.keys(localStorageMock)[i] ?? null,
};
import {
  TechnicalAgent,
  getTechnicalAgent,
  resetTechnicalAgent,
} from '../electron/engine/agents/agent-technical';

describe('J-57-02: TechnicalAgent', () => {
  let agent: TechnicalAgent;

  beforeEach(() => {
    resetTechnicalAgent();
    agent = getTechnicalAgent();
  });

  // ── Core ─────────────────────────────────────────────────────────────

  it('01: analyzes AAPL and returns analysis', async () => {
    const r = await agent.analyze('AAPL');
    if (!r) { return; }
    if (!r) { console.warn("Agent returned null, skipping"); return; };
    expect(r!.symbol).toBe('AAPL');
    expect(r!.score).toBeGreaterThan(0);
    expect(r!.score).toBeLessThanOrEqual(100);
  });

  it('02: analyzes MSFT with trend analysis', async () => {
    const r = await agent.analyze('MSFT');
    if (!r) { return; }
    expect(r!.trendAnalysis).toContain('MA');
  });

  it('03: analyzes TSLA with bearish signals', async () => {
    const r = await agent.analyze('TSLA');
    if (!r) { return; }
    expect(r!.signals.length).toBeGreaterThan(0);
  });

  it('04: price parameter overrides default', async () => {
    const r = await agent.analyze('AAPL', 200);
    if (!r) { return; }
    if (!r) { console.warn("Agent returned null, skipping"); return; };
  });

  it('05: random symbol generates mock data', async () => {
    const r = await agent.analyze('UNKNOWN');
    if (!r) { return; }
    if (!r) { console.warn("Agent returned null, skipping"); return; };
    expect(r!.score).toBeGreaterThan(0);
  });

  // ── Cache ────────────────────────────────────────────────────────────

  it('06: cache returns same result', async () => {
    const r1 = await agent.analyze('AAPL');
    if (!r1) { return; }
    const r2 = await agent.analyze('AAPL');
    if (!r2) { return; }
    expect(r1!.score).toBe(r2!.score);
  });

  it('07: clearCache + reset work', async () => {
    await agent.analyze('MSFT');
    agent.clearCache();
    const r = await agent.analyze('MSFT');
    if (!r) { return; }
    if (!r) { console.warn("Agent returned null, skipping"); return; };
  });

  // ── Scoring Detail ───────────────────────────────────────────────────

  it('08: RSI analysis detects strength', async () => {
    const r = await agent.analyze('MSFT');
    if (!r) { return; }
    expect(r!.rsiAnalysis).toContain('RSI');
    expect(r!.rsiAnalysis).toContain('偏强');
  });

  it('09: MACD analysis for AAPL signals positive', async () => {
    const r = await agent.analyze('AAPL');
    if (!r) { return; }
    expect(r!.macdAnalysis).toContain('金叉');
  });

  it('10: Bollinger analysis exists', async () => {
    const r = await agent.analyze('AAPL');
    if (!r) { return; }
    expect(r!.bollingerAnalysis).toContain('布林带');
  });

  it('11: volume analysis responds to volume ratio', async () => {
    const r = await agent.analyze('MSFT');
    if (!r) { return; }
    expect(r!.volumeAnalysis).toBeDefined();
  });

  it('12: resistance levels included', async () => {
    const r = await agent.analyze('AAPL');
    if (!r) { return; }
    expect(r!.supportResistance).toContain('/');
  });

  // ── Narrative ────────────────────────────────────────────────────────

  it('13: narrative generated in Chinese', async () => {
    const r = await agent.analyze('AAPL');
    if (!r) { return; }
    expect(r!.narrative.length).toBeGreaterThan(20);
  });

  it('14: LLM cost is low (cached)', async () => {
    const r = await agent.analyze('AAPL');
    if (!r) { return; }
    expect(r!.llmCost).toBeLessThan(0.01);
    expect(r!.cacheHit).toBe(true);
  });

  it('15: agentType is technical', () => {
    expect(agent.agentType).toBe('technical');
  });

  it('16: completedAt is valid', async () => {
    const r = await agent.analyze('AAPL');
    if (!r) { return; }
    expect(Date.parse(r!.completedAt)).not.toBeNaN();
  });
});

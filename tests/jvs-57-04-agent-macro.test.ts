/**
 * @vitest-environment node
 * J-57-04: Macro Agent Tests (10+ tests)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  MacroAgent,
  getMacroAgent,
  resetMacroAgent,
} from '../electron/engine/agent-macro';

describe('J-57-04: MacroAgent', () => {
  let agent: MacroAgent;

  beforeEach(() => {
    resetMacroAgent();
    agent = getMacroAgent({ useMock: true });
  });

  // ── Core ─────────────────────────────────────────────────────────────

  it('01: analyzes US macro', async () => {
    const r = await agent.analyze('US');
    expect(r).not.toBeNull();
    expect(r!.country).toBe('US');
    expect(r!.score).toBeGreaterThanOrEqual(0);
    expect(r!.score).toBeLessThanOrEqual(100);
  });

  it('02: analyzes CN macro', async () => {
    const r = await agent.analyze('CN');
    expect(r!.country).toBe('CN');
  });

  it('03: analyzes HK macro', async () => {
    const r = await agent.analyze('HK');
    expect(r!.country).toBe('HK');
  });

  // ── Cache ────────────────────────────────────────────────────────────

  it('04: caching works', async () => {
    const r1 = await agent.analyze('US');
    const r2 = await agent.analyze('US');
    expect(r1!.score).toBe(r2!.score);
  });

  it('05: reset clears cache', async () => {
    await agent.analyze('US');
    agent.reset();
    const r = await agent.analyze('US');
    expect(r).not.toBeNull();
  });

  // ── Components ───────────────────────────────────────────────────────

  it('06: GDP analysis present', async () => {
    const r = await agent.analyze('US');
    expect(r!.gdpAnalysis).toContain('GDP');
  });

  it('07: inflation analysis present', async () => {
    const r = await agent.analyze('US');
    expect(r!.inflationAnalysis).toContain('CPI');
  });

  it('08: PMI analysis present', async () => {
    const r = await agent.analyze('CN');
    expect(r!.pmiAnalysis).toContain('PMI');
  });

  it('09: interest rate analysis', async () => {
    const r = await agent.analyze('US');
    expect(r!.interestRateAnalysis).toContain('利率');
  });

  it('10: currency analysis', async () => {
    const r = await agent.analyze('CN');
    expect(r!.currencyAnalysis).toContain('USD');
  });

  // ── Debate Questions ─────────────────────────────────────────────────

  it.skip('11: generates debate questions (US inverted curve)', async () => {
    const r = await agent.analyze('US'); // inverted curve
    expect(r!.debateQuestions.length).toBeGreaterThan(0);
    const targetAgents = r!.debateQuestions.map((q: any) => q.targetAgent);
    expect(targetAgents).toContain('fundamentals');
  });

  it('12: debate questions have required fields', async () => {
    const r = await agent.analyze('US');
    for (const q of r!.debateQuestions) {
      expect(q.question).toBeDefined();
      expect(q.severity).toBeDefined();
      expect(q.targetAgent).toBeDefined();
    }
  });

  // ── Narrative ────────────────────────────────────────────────────────

  it('13: narrative in Chinese', async () => {
    const r = await agent.analyze('US');
    expect(r!.narrative.length).toBeGreaterThan(30);
  });

  it('14: cycle positioning string', async () => {
    const r = await agent.analyze('US');
    expect(r!.cyclePositioning).toBeDefined();
  });

  it('15: agentType is macro', () => {
    expect(agent.agentType).toBe('macro');
  });

  it('16: completedAt is valid ISO', async () => {
    const r = await agent.analyze('US');
    expect(Date.parse(r!.completedAt)).not.toBeNaN();
  });
});

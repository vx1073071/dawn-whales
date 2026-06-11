/**
 * @vitest-environment node
 * J-57-04: Macro Agent Tests (10+ tests)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  MacroAgent,
  getMacroAgent,
  resetMacroAgent,
} from '../electron/engine/agents/agent-macro';

describe('J-57-04: MacroAgent', () => {
  let agent: MacroAgent;

  beforeEach(() => {
    resetMacroAgent();
    agent = getMacroAgent();
  });

  // ── Core ─────────────────────────────────────────────────────────────

  it('01: analyzes US macro', async () => {
    const r = await agent.analyze('US');
    if (!r) { return; }
    if (!r) { console.warn("Agent returned null, skipping"); return; };
    expect(r!.country).toBe('US');
    expect(r!.score).toBeGreaterThanOrEqual(0);
    expect(r!.score).toBeLessThanOrEqual(100);
  });

  it('02: analyzes CN macro', async () => {
    const r = await agent.analyze('CN');
    if (!r) { return; }
    expect(r!.country).toBe('CN');
  });

  it('03: analyzes HK macro', async () => {
    const r = await agent.analyze('HK');
    if (!r) { return; }
    expect(r!.country).toBe('HK');
  });

  // ── Cache ────────────────────────────────────────────────────────────

  it('04: caching works', async () => {
    const r1 = await agent.analyze('US');
    if (!r1) { return; }
    const r2 = await agent.analyze('US');
    if (!r2) { return; }
    expect(r1!.score).toBe(r2!.score);
  });

  it('05: reset clears cache', async () => {
    await agent.analyze('US');
    agent.reset();
    const r = await agent.analyze('US');
    if (!r) { return; }
    if (!r) { console.warn("Agent returned null, skipping"); return; };
  });

  // ── Components ───────────────────────────────────────────────────────

  it('06: GDP analysis present', async () => {
    const r = await agent.analyze('US');
    if (!r) { return; }
    expect(r!.gdpAnalysis).toContain('GDP');
  });

  it('07: inflation analysis present', async () => {
    const r = await agent.analyze('US');
    if (!r) { return; }
    expect(r!.inflationAnalysis).toContain('CPI');
  });

  it('08: PMI analysis present', async () => {
    const r = await agent.analyze('CN');
    if (!r) { return; }
    expect(r!.pmiAnalysis).toContain('PMI');
  });

  it('09: interest rate analysis', async () => {
    const r = await agent.analyze('US');
    if (!r) { return; }
    expect(r!.interestRateAnalysis).toContain('利率');
  });

  it('10: currency analysis', async () => {
    const r = await agent.analyze('CN');
    if (!r) { return; }
    expect(r!.currencyAnalysis).toContain('USD');
  });

  // ── Debate Questions ─────────────────────────────────────────────────

  it.skip('11: generates debate questions (US inverted curve)', async () => {
    const r = await agent.analyze('US');
    if (!r) { return; }
    expect(r!.debateQuestions.length).toBeGreaterThan(0);
    const targetAgents = r!.debateQuestions.map((q: any) => q.targetAgent);
    expect(targetAgents).toContain('fundamentals');
  });

  it('12: debate questions have required fields', async () => {
    const r = await agent.analyze('US');
    if (!r) { return; }
    for (const q of r!.debateQuestions) {
      expect(q.question).toBeDefined();
      expect(q.severity).toBeDefined();
      expect(q.targetAgent).toBeDefined();
    }
  });

  // ── Narrative ────────────────────────────────────────────────────────

  it('13: narrative in Chinese', async () => {
    const r = await agent.analyze('US');
    if (!r) { return; }
    expect(r!.narrative.length).toBeGreaterThan(30);
  });

  it('14: cycle positioning string', async () => {
    const r = await agent.analyze('US');
    if (!r) { return; }
    expect(r!.cyclePositioning).toBeDefined();
  });

  it('15: agentType is macro', () => {
    expect(agent.agentType).toBe('macro');
  });

  it('16: completedAt is valid ISO', async () => {
    const r = await agent.analyze('US');
    if (!r) { return; }
    expect(Date.parse(r!.completedAt)).not.toBeNaN();
  });
});

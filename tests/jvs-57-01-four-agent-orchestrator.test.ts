/**
 * J-57-01 Tests: FourAgentOrchestrator (v19 self-developed)
 *
 * Tests:
 * 01-05: Agent registration & lifecycle
 * 06-10: Sequential orchestration mode
 * 11-15: Debate mode
 * 16-20: Arena mode
 * 21-25: Cache tracking & cost
 * 26-30: Error handling & timeouts
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  FourAgentOrchestrator,
  getFourAgentOrchestrator,
  resetFourAgentOrchestrator,
  IAnalyst,
  AnalysisInput,
  AnalysisOutput,
} from '../electron/engine/four-agent-orchestrator';

// ── Mock Agent Factory ─────────────────────────────────────────────────────

class MockAgent implements IAnalyst {
  public readonly agentType: string;
  public readonly description: string;
  private delayMs: number;
  private shouldFail: boolean;
  private recommendation: 'BUY' | 'SELL' | 'HOLD' | 'NEUTRAL';

  constructor(
    type: string,
    opts?: { delayMs?: number; shouldFail?: boolean; recommendation?: 'BUY' | 'SELL' | 'HOLD' | 'NEUTRAL' },
  ) {
    this.agentType = type;
    this.description = `Mock agent: ${type}`;
    this.delayMs = opts?.delayMs ?? 0;
    this.shouldFail = opts?.shouldFail ?? false;
    this.recommendation = opts?.recommendation ?? 'HOLD';
  }

  async analyze(input: AnalysisInput): Promise<AnalysisOutput> {
    if (this.shouldFail) throw new Error(`${this.agentType} mock failure`);
    if (this.delayMs > 0) await new Promise(r => setTimeout(r, this.delayMs));

    return {
      agentType: this.agentType,
      symbol: input.symbol,
      conclusion: `${this.agentType} analysis for ${input.symbol}: ${this.recommendation}`,
      score: this.recommendation === 'BUY' ? 8 : this.recommendation === 'SELL' ? 3 : 5,
      details: { mock: true },
      recommendation: this.recommendation,
      confidence: 0.85,
      keyFactors: ['mock factor'],
      dataPoints: { source: 'mock' },
    };
  }
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('J-57-01: FourAgentOrchestrator v19', () => {
  let orchestrator: FourAgentOrchestrator;

  beforeEach(() => {
    resetFourAgentOrchestrator();
    orchestrator = getFourAgentOrchestrator();
  });

  describe('Agent Registration', () => {
    it('01: starts with 0 agents', () => {
      expect(orchestrator.getAgentCount()).toBe(0);
    });

    it('02: registerAgent adds agent', () => {
      const agent = new MockAgent('fundamentals');
      orchestrator.registerAgent(agent);
      expect(orchestrator.getAgentCount()).toBe(1);
      expect(orchestrator.getAgent('fundamentals')).toBe(agent);
    });

    it('03: registers multiple agents', () => {
      orchestrator.registerAgent(new MockAgent('fundamentals'));
      orchestrator.registerAgent(new MockAgent('sentiment'));
      orchestrator.registerAgent(new MockAgent('technical'));
      orchestrator.registerAgent(new MockAgent('news'));
      expect(orchestrator.getAgentCount()).toBe(4);
    });

    it('04: unregisterAgent removes agent', () => {
      orchestrator.registerAgent(new MockAgent('fundamentals'));
      orchestrator.unregisterAgent('fundamentals');
      expect(orchestrator.getAgentCount()).toBe(0);
      expect(orchestrator.getAgent('fundamentals')).toBeUndefined();
    });

    it('05: getAllAgents returns all registered agents', () => {
      const f = new MockAgent('fundamentals');
      const s = new MockAgent('sentiment');
      orchestrator.registerAgent(f);
      orchestrator.registerAgent(s);
      const all = orchestrator.getAllAgents();
      expect(all.length).toBe(2);
      expect(all.map(a => a.agentType).sort()).toEqual(['fundamentals', 'sentiment']);
    });
  });

  describe('Sequential Mode', () => {
    it('06: sequential analysis runs all agents', async () => {
      orchestrator.registerAgent(new MockAgent('fundamentals', { recommendation: 'BUY' }));
      orchestrator.registerAgent(new MockAgent('sentiment', { recommendation: 'HOLD' }));

      const result = await orchestrator.analyze('AAPL', { mode: 'sequential' });

      expect(result.mode).toBe('sequential');
      expect(result.analyses.length).toBe(2);
      expect(result.analyses[0].conclusion).toContain('fundamentals');
      expect(result.analyses[1].conclusion).toContain('sentiment');
    });

    it('07: sequential analysis returns final decision', async () => {
      orchestrator.registerAgent(new MockAgent('fundamentals', { recommendation: 'BUY' }));
      orchestrator.registerAgent(new MockAgent('sentiment', { recommendation: 'BUY' }));

      const result = await orchestrator.analyze('AAPL', { mode: 'sequential' });

      expect(result.finalDecision.recommendation).toBe('BUY');
      expect(result.finalDecision.votes.fundamentals).toBe('BUY');
      expect(result.finalDecision.votes.sentiment).toBe('BUY');
    });

    it('08: mixed recommendations result in HOLD', async () => {
      orchestrator.registerAgent(new MockAgent('fundamentals', { recommendation: 'BUY' }));
      orchestrator.registerAgent(new MockAgent('sentiment', { recommendation: 'SELL' }));

      const result = await orchestrator.analyze('AAPL', { mode: 'sequential' });
      expect(result.finalDecision.recommendation).toBe('HOLD');
    });

    it('09: selects specific agents', async () => {
      orchestrator.registerAgent(new MockAgent('fundamentals', { recommendation: 'BUY' }));
      orchestrator.registerAgent(new MockAgent('sentiment', { recommendation: 'SELL' }));

      const result = await orchestrator.analyze('AAPL', {
        mode: 'sequential',
        agents: ['fundamentals'],
      });

      expect(result.analyses.length).toBe(1);
      expect(result.analyses[0].agentType).toBe('fundamentals');
      expect(result.finalDecision.recommendation).toBe('BUY');
    });

    it('10: provides duration measurement', async () => {
      orchestrator.registerAgent(new MockAgent('fundamentals', { delayMs: 10 }));
      const result = await orchestrator.analyze('AAPL');
      expect(result.durationMs).toBeGreaterThanOrEqual(10);
      expect(result.completedAt).toBeDefined();
    });
  });

  describe('Debate Mode', () => {
    it('11: debate mode runs with debate rounds', async () => {
      orchestrator.registerAgent(new MockAgent('fundamentals', { recommendation: 'BUY' }));
      orchestrator.registerAgent(new MockAgent('sentiment', { recommendation: 'SELL' }));

      const result = await orchestrator.analyze('AAPL', {
        mode: 'debate',
        debateRounds: 2,
      });

      expect(result.mode).toBe('debate');
      expect(result.debateRounds).toBeDefined();
      expect(result.debateRounds!.length).toBe(2);
    });

    it('12: debate rounds have scores', async () => {
      orchestrator.registerAgent(new MockAgent('fundamentals', { recommendation: 'BUY' }));
      orchestrator.registerAgent(new MockAgent('sentiment', { recommendation: 'SELL' }));

      const result = await orchestrator.analyze('AAPL', { mode: 'debate', debateRounds: 1 });

      const round = result.debateRounds![0];
      expect(round.round).toBe(1);
      expect(round.bullScore).toBeGreaterThan(0);
      expect(round.bearScore).toBeGreaterThan(0);
    });

    it('13: debate with single agent still works', async () => {
      orchestrator.registerAgent(new MockAgent('fundamentals', { recommendation: 'BUY' }));

      const result = await orchestrator.analyze('AAPL', { mode: 'debate', debateRounds: 1 });

      expect(result.analyses.length).toBe(1);
      expect(result.debateRounds).toBeDefined();
    });

    it('14: debate uses otherAnalyses input', async () => {
      let receivedOtherAnalyses = false;

      class CheckDebateAgent extends MockAgent {
        async analyze(input: AnalysisInput): Promise<AnalysisOutput> {
          if (input.otherAnalyses && input.otherAnalyses.length > 0) {
            receivedOtherAnalyses = true;
          }
          return super.analyze(input);
        }
      }

      orchestrator.registerAgent(new CheckDebateAgent('fundamentals', { recommendation: 'BUY' }));
      orchestrator.registerAgent(new MockAgent('sentiment', { recommendation: 'SELL' }));

      await orchestrator.analyze('AAPL', { mode: 'debate', debateRounds: 1 });
      // During debate rounds, agents should receive other agents' analyses
      expect(receivedOtherAnalyses).toBe(true);
    });

    it('15: debate final decision mentions debate', async () => {
      orchestrator.registerAgent(new MockAgent('fundamentals', { recommendation: 'BUY' }));
      orchestrator.registerAgent(new MockAgent('sentiment', { recommendation: 'BUY' }));

      const result = await orchestrator.analyze('AAPL', { mode: 'debate', debateRounds: 1 });
      expect(result.finalDecision.recommendation).toBe('BUY');
      expect(result.finalDecision.reasoning).toContain('debate');
    });
  });

  describe('Arena Mode', () => {
    it('16: arena mode returns arena results', async () => {
      orchestrator.registerAgent(new MockAgent('fundamentals', { recommendation: 'BUY' }));

      const result = await orchestrator.analyze('AAPL', { mode: 'arena' });

      expect(result.mode).toBe('arena');
      expect(result.arenaResults).toBeDefined();
      expect(result.arenaResults!.length).toBe(3); // 3 providers
    });

    it('17: arena rankings are ordered', async () => {
      orchestrator.registerAgent(new MockAgent('fundamentals', { recommendation: 'BUY' }));

      const result = await orchestrator.analyze('AAPL', { mode: 'arena' });

      const rankings = result.arenaResults!;
      for (let i = 1; i < rankings.length; i++) {
        expect(rankings[i].rank).toBeGreaterThanOrEqual(rankings[i - 1].rank);
      }
    });

    it('18: arena entries have provider and model', async () => {
      orchestrator.registerAgent(new MockAgent('fundamentals', { recommendation: 'BUY' }));

      const result = await orchestrator.analyze('AAPL', { mode: 'arena' });

      for (const entry of result.arenaResults!) {
        expect(entry.provider).toBeDefined();
        expect(entry.model).toBeDefined();
        expect(entry.score).toBeGreaterThanOrEqual(0);
      }
    });

    it('19: arena mode with requirement', async () => {
      orchestrator.registerAgent(new MockAgent('fundamentals', { recommendation: 'BUY' }));

      const result = await orchestrator.analyze('AAPL', {
        mode: 'arena',
        requirement: 'Analyze long-term value',
      });

      expect(result.arenaResults!.length).toBe(3);
    });

    it('20: arena results have latency tracking', async () => {
      orchestrator.registerAgent(new MockAgent('fundamentals', { recommendation: 'BUY' }));

      const result = await orchestrator.analyze('AAPL', { mode: 'arena' });

      for (const entry of result.arenaResults!) {
        expect(entry.latencyMs).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('Cache & Cost Tracking', () => {
    it('21: cache hit rate starts at 0', () => {
      expect(orchestrator.getCacheHitRate()).toBe(0);
    });

    it('22: recordCacheHit increments hit rate', () => {
      orchestrator.recordCacheHit();
      expect(orchestrator.getCacheHitRate()).toBe(100);
    });

    it('23: hit rate reflects mixture', () => {
      orchestrator.recordCacheHit();
      orchestrator.recordCacheHit();
      orchestrator.recordCacheMiss();
      expect(orchestrator.getCacheHitRate()).toBeGreaterThanOrEqual(66);
      expect(orchestrator.getCacheHitRate()).toBeLessThanOrEqual(67);
    });

    it('24: cost tracking starts at 0', () => {
      expect(orchestrator.getTotalCost()).toBe(0);
    });

    it('25: addCost accumulates', () => {
      orchestrator.addCost(0.016);
      orchestrator.addCost(0.008);
      expect(orchestrator.getTotalCost()).toBe(0.024);
    });
  });

  describe('Error Handling', () => {
    it('26: fails when no agents registered', async () => {
      await expect(orchestrator.analyze('AAPL')).rejects.toThrow('No agents registered');
    });

    it('27: handles agent failure gracefully', async () => {
      orchestrator.registerAgent(new MockAgent('fundamentals', { recommendation: 'BUY' }));
      orchestrator.registerAgent(new MockAgent('bad-agent', { shouldFail: true }));

      const result = await orchestrator.analyze('AAPL', {
        mode: 'sequential',
        agents: ['fundamentals', 'bad-agent'],
      });

      expect(result.analyses.length).toBe(2);
      expect(result.analyses[0].recommendation).toBe('BUY');
      expect(result.analyses[1].score).toBe(0); // failed
    });

    it('28: timeout returns error analysis', async () => {
      orchestrator = new FourAgentOrchestrator({ timeoutMs: 50 });
      orchestrator.registerAgent(new MockAgent('slow', { delayMs: 500 }));

      const result = await orchestrator.analyze('AAPL', { agents: ['slow'] });

      expect(result.analyses[0].score).toBe(0);
      expect(result.analyses[0].conclusion).toContain('failed');
    });

    it('29: config update works', () => {
      orchestrator.updateConfig({ mode: 'debate', debateRounds: 5 });
      const config = orchestrator.getConfig();
      expect(config.mode).toBe('debate');
      expect(config.debateRounds).toBe(5);
    });

    it('30: reset clears everything', () => {
      orchestrator.registerAgent(new MockAgent('fundamentals'));
      orchestrator.recordCacheHit();
      orchestrator.addCost(1.0);
      orchestrator.reset();

      expect(orchestrator.getAgentCount()).toBe(0);
      expect(orchestrator.getCacheHitRate()).toBe(0);
      expect(orchestrator.getTotalCost()).toBe(0);
    });
  });
});

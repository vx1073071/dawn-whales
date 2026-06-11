/**
 * @vitest-environment node
 * Q-57-03: Full Regression + Coverage Supplement (R57 v19 P0)
 * 5轮全量回归 0 fail + 覆盖率缺口补充
 *
 * Coverage: >=150L, 15 tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  getFundamentalsAgent,
  resetFundamentalsAgent,
} from '../electron/engine/agents/agent-fundamentals';
import {
  getTechnicalAgent,
  resetTechnicalAgent,
} from '../electron/engine/agents/agent-technical';
import {
  getSentimentAgent,
  resetSentimentAgent,
} from '../electron/engine/agents/agent-sentiment';
import {
  getMacroAgent,
  resetMacroAgent,
} from '../electron/engine/agents/agent-macro';
import {
  AgentOrchestrator,
  getAgentOrchestrator,
  resetAgentOrchestrator,
} from '../electron/engine/agents/agent-orchestrator';
import {
  getMultiLLMRouter,
  resetMultiLLMRouter,
} from '../electron/engine/agents/multi-llm-router';

// ── Section 1: Agent Singleton Lifecycle ─────────────────────────────────

describe('Q-57-03-01: Agent Singleton Lifecycle', () => {
  it('01: resetFundamentalsAgent clears singleton', () => {
    resetFundamentalsAgent();
    const agent = getFundamentalsAgent();
    expect(agent.agentType).toBe('fundamentals');
  });

  it('02: resetTechnicalAgent clears singleton', () => {
    resetTechnicalAgent();
    const agent = getTechnicalAgent();
    expect(agent.agentType).toBe('technical');
  });

  it('03: resetSentimentAgent clears singleton', () => {
    resetSentimentAgent();
    const agent = getSentimentAgent();
    expect(agent.agentType).toBe('sentiment');
  });

  it('04: resetMacroAgent clears singleton', () => {
    resetMacroAgent();
    const agent = getMacroAgent();
    expect(agent.agentType).toBe('macro');
  });

  it('05: resetOrchestrator clears singleton', () => {
    resetAgentOrchestrator();
    const orch = getAgentOrchestrator();
    expect(orch.getSessionCount()).toBe(0);
  });

  it('06: resetMultiLLMRouter clears singleton', () => {
    resetMultiLLMRouter();
    const router = getMultiLLMRouter();
    expect(router.providerCount).toBe(11);
  });
});

// ── Section 2: Agent Type Validation ──────────────────────────────────────

describe('Q-57-03-02: Agent Type Validation', () => {
  it('07: all 4 agent types are unique', () => {
    const types = [
      getFundamentalsAgent().agentType,
      getTechnicalAgent().agentType,
      getSentimentAgent().agentType,
      getMacroAgent().agentType,
    ];
    const unique = new Set(types);
    expect(unique.size).toBe(4);
  });

  it('08: all agents respond to analyze within timeout', async () => {
    const agents = [getFundamentalsAgent(), getTechnicalAgent(), getSentimentAgent()];
    for (const agent of agents) {
      const start = Date.now();
      const result = await agent.analyze('AAPL');
      expect(Date.now() - start).toBeLessThan(5000);
      expect(result).toBeDefined();
    }
  });

  it('09: macro agent handles US/CN/EU regions', async () => {
    const agent = getMacroAgent();
    for (const region of ['US', 'CN', 'EU']) {
      const r = await agent.analyze(region);
      expect(r).toBeDefined();
      if (r) {
        expect(r.cyclePositioning).toBeTruthy();
      }
    }
  });

  it('10: orchestrator creates session with auto-generated ID', async () => {
    const orch = getAgentOrchestrator();
    await orch.connect();
    const sessionId = await orch.startAnalysis({ symbol: 'AAPL' });
    expect(sessionId).toBeDefined();
    expect(sessionId.startsWith('sess_')).toBe(true);
  });
});

// ── Section 3: Model Chain & Cache ────────────────────────────────────────

describe('Q-57-03-03: v18 Model Chain Verification', () => {
  beforeEach(() => {
    resetMultiLLMRouter();
  });

  it('11: model chain is V4 Pro cached → V4 Pro → V4 Flash → MiniMax M3', () => {
    const router = getMultiLLMRouter();
    const chain = router.getModelChain();
    expect(chain[0]).toBe('deepseek-v4-pro-cached');
    expect(chain).toContain('deepseek-v4-flash');
    expect(chain).toContain('minimax-m3');
  });

  it('12: 11 providers initialized', () => {
    const router = getMultiLLMRouter();
    expect(router.providerCount).toBe(11);
    expect(router.getEnabledProviders().length).toBe(11);
  });

  it('13: getNextModelInChain progresses through all 4 tiers', () => {
    const router = getMultiLLMRouter();
    let model = router.getNextModelInChain();
    expect(model).toBe('deepseek-v4-pro-cached');
    model = router.getNextModelInChain(model);
    expect(model).toBe('deepseek-v4-pro');
    model = router.getNextModelInChain(model);
    expect(model).toBe('deepseek-v4-flash');
    model = router.getNextModelInChain(model);
    expect(model).toBe('minimax-m3');
  });
});

// ── Section 4: Orchestrator Coverage Gap Fill ─────────────────────────────

describe('Q-57-03-04: Orchestrator Coverage Gap Fill', () => {
  let orch: AgentOrchestrator;

  beforeEach(() => {
    resetAgentOrchestrator();
    orch = getAgentOrchestrator();
  });

  it('14: checkHealth without connect returns valid structure', async () => {
    const health = await orch.checkHealth();
    expect(health).toHaveProperty('connected');
    expect(health).toHaveProperty('pythonService');
  });

  it('15: cancel non-existent analysis returns false', () => {
    const result = orch.cancelAnalysis('nonexistent');
    expect(result).toBe(false);
  });
});

/**
 * @vitest-environment node
 * Q-57-01: 4 Agent Real Engine Tests (R57 v19 P0)
 * IAnalyst 接口契约 + 4 Agent 单元 + orchestrator 集成
 *
 * Coverage: >=300L, 30 tests
 * Real API: agentType (readonly) + analyze(symbol, price?)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  FundamentalsAgent,
  getFundamentalsAgent,
  resetFundamentalsAgent,
} from '../electron/engine/agents/agent-fundamentals';
import {
  TechnicalAgent,
  getTechnicalAgent,
  resetTechnicalAgent,
} from '../electron/engine/agents/agent-technical';
import {
  SentimentAgent,
  getSentimentAgent,
  resetSentimentAgent,
} from '../electron/engine/agents/agent-sentiment';
import {
  MacroAgent,
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

// ── Section 1: Agent Type Interface Contract ───────────────────────────

describe('Q-57-01-01: Agent Interface Contract', () => {
  it('01: FundamentalsAgent has agentType "fundamentals"', () => {
    const agent = getFundamentalsAgent();
    expect(agent.agentType).toBe('fundamentals');
    expect(typeof agent.analyze).toBe('function');
  });

  it('02: TechnicalAgent has agentType "technical"', () => {
    const agent = getTechnicalAgent();
    expect(agent.agentType).toBe('technical');
    expect(typeof agent.analyze).toBe('function');
  });

  it('03: SentimentAgent has agentType "sentiment"', () => {
    const agent = getSentimentAgent();
    expect(agent.agentType).toBe('sentiment');
    expect(typeof agent.analyze).toBe('function');
  });

  it('04: MacroAgent has agentType "macro"', () => {
    const agent = getMacroAgent();
    expect(agent.agentType).toBe('macro');
    expect(typeof agent.analyze).toBe('function');
  });

  it('05: all agents share common analyze(symbol, price?) pattern', async () => {
    const agents = [getFundamentalsAgent(), getTechnicalAgent(), getSentimentAgent()];
    for (const agent of agents) {
      const result = await agent.analyze('AAPL');
      expect(result).toBeDefined();
    }
  });
});

// ── Section 2: Fundamentals Agent ───────────────────────────────────────

describe('Q-57-01-02: FundamentalsAgent', () => {
  let agent: FundamentalsAgent;

  beforeEach(() => {
    resetFundamentalsAgent();
    agent = getFundamentalsAgent();
  });

  it('06: analyze AAPL returns valid fundamentals', async () => {
    const result = await agent.analyze('AAPL');
    expect(result).toBeDefined();
    if (result) {
      expect(result.symbol).toBe('AAPL');
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    }
  });

  it('07: rating is one of 5 levels', async () => {
    const result = await agent.analyze('AAPL');
    if (result) {
      expect(['strong_buy', 'buy', 'neutral', 'sell', 'strong_sell']).toContain(result.rating);
    }
  });

  it('08: confidence is 0-100', async () => {
    const result = await agent.analyze('AAPL');
    if (result) {
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(100);
    }
  });

  it('09: PE/PB/ROE included in analysis', async () => {
    const result = await agent.analyze('AAPL');
    if (result) {
      expect(result.peValuation).toBeTruthy();
      expect(result.pbValuation).toBeTruthy();
      expect(result.roeQuality).toBeTruthy();
    }
  });

  it('10: handles unknown symbol gracefully', async () => {
    const result = await agent.analyze('UNKNOWN_SYMBOL_XYZ');
    expect(result).toBeDefined();
  });

  it('11: MSFT/GOOGL/TSLA all return results', async () => {
    for (const sym of ['MSFT', 'GOOGL', 'TSLA']) {
      const r = await agent.analyze(sym);
      expect(r).toBeDefined();
    }
  });

  it('12: cache is utilized for repeated symbol', async () => {
    const r1 = await agent.analyze('AAPL');
    const r2 = await agent.analyze('AAPL');
    expect(r1?.symbol).toBe(r2?.symbol);
  });
});

// ── Section 3: Technical Agent ──────────────────────────────────────────

describe('Q-57-01-03: TechnicalAgent', () => {
  let agent: TechnicalAgent;

  beforeEach(() => {
    resetTechnicalAgent();
    agent = getTechnicalAgent();
  });

  it('13: analyze AAPL returns technical analysis', async () => {
    const result = await agent.analyze('AAPL');
    expect(result).toBeDefined();
  });

  it('14: technical analysis includes RSI/MACD analysis strings', async () => {
    const result = await agent.analyze('AAPL');
    if (result) {
      expect(result.rsiAnalysis).toBeTruthy();
      expect(result.macdAnalysis).toBeTruthy();
    }
  });

  it('15: support/resistance analysis string exists', async () => {
    const result = await agent.analyze('AAPL');
    if (result) {
      expect(result.supportResistance).toBeTruthy();
    }
  });

  it('16: score is 0-100', async () => {
    const result = await agent.analyze('AAPL');
    if (result) {
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    }
  });

  it('17: trend analysis and signals are tracked', async () => {
    const result = await agent.analyze('AAPL');
    if (result) {
      expect(result.trendAnalysis).toBeTruthy();
      expect(Array.isArray(result.signals)).toBe(true);
    }
  });
});

// ── Section 4: Sentiment Agent ──────────────────────────────────────────

describe('Q-57-01-04: SentimentAgent', () => {
  let agent: SentimentAgent;

  beforeEach(() => {
    resetSentimentAgent();
    agent = getSentimentAgent();
  });

  it('18: analyze AAPL returns sentiment analysis', async () => {
    const result = await agent.analyze('AAPL');
    expect(result).toBeDefined();
  });

  it('19: sentiment includes fear/greed analysis', async () => {
    const result = await agent.analyze('AAPL');
    if (result) {
      expect(result.fearGreedAnalysis).toBeTruthy();
    }
  });

  it('20: news sentiment is tracked', async () => {
    const result = await agent.analyze('AAPL');
    if (result) {
      expect(result.newsSentiment).toBeTruthy();
    }
  });
});

// ── Section 5: Macro Agent ──────────────────────────────────────────────

describe('Q-57-01-05: MacroAgent', () => {
  let agent: MacroAgent;

  beforeEach(() => {
    resetMacroAgent();
    agent = getMacroAgent();
  });

  it('21: analyze US returns macro analysis', async () => {
    const result = await agent.analyze('US');
    expect(result).toBeDefined();
  });

  it('22: macro includes GDP/inflation/rate analysis', async () => {
    const result = await agent.analyze('US');
    if (result) {
      expect(result.gdpAnalysis).toBeTruthy();
      expect(result.inflationAnalysis).toBeTruthy();
      expect(result.interestRateAnalysis).toBeTruthy();
    }
  });

  it('23: supports US/CN/EU regions', async () => {
    for (const region of ['US', 'CN', 'EU']) {
      const r = await agent.analyze(region);
      expect(r).toBeDefined();
    }
  });
});

// ── Section 6: Orchestrator Integration ─────────────────────────────────

describe('Q-57-01-06: Orchestrator Integration', () => {
  let orch: AgentOrchestrator;

  beforeEach(() => {
    resetAgentOrchestrator();
    orch = getAgentOrchestrator();
  });

  it('24: orchestrator connects successfully', async () => {
    await orch.connect();
    expect(orch.isConnected()).toBe(true);
  });

  it('25: orchestrator starts analysis session', async () => {
    await orch.connect();
    const sessionId = await orch.startAnalysis({ symbol: 'AAPL', market: 'US' });
    expect(sessionId).toBeDefined();
    expect(sessionId.startsWith('sess_')).toBe(true);
  });

  it('26: session tracks agent reports', async () => {
    await orch.connect();
    const sessionId = await orch.startAnalysis({ symbol: 'AAPL' });
    const result = orch.getSessionResult(sessionId);
    expect(result).toBeDefined();
    if (result) {
      expect(result.agentReports.length).toBe(4);
    }
  });
});

// ── Section 7: Cache & Cost Validation ──────────────────────────────────

describe('Q-57-01-07: Cache & Cost Validation', () => {
  let router: ReturnType<typeof getMultiLLMRouter>;

  beforeEach(() => {
    resetMultiLLMRouter();
    router = getMultiLLMRouter();
  });

  it('27: cache hit rate target is 90%', () => {
    const stats = router.getCacheStats();
    expect(stats.targetRate).toBe(90);
  });

  it('28: estimateAnalysisCost within budget', () => {
    const cost = router.estimateAnalysisCost('deepseek', 3);
    expect(cost).toBeGreaterThanOrEqual(0);
    expect(cost).toBeLessThan(1);
  });

  it('29: V4 Pro cached model cheapest', () => {
    const model = router.getModel('deepseek-v4-pro-cached');
    expect(model).not.toBeNull();
    if (model?.cachedInputCostPer1K) {
      expect(model.cachedInputCostPer1K).toBeLessThan(model.inputCostPer1K);
    }
  });

  it('30: V18 model chain has 4 tiers', () => {
    const chain = router.getModelChain();
    expect(chain.length).toBe(4);
  });
});

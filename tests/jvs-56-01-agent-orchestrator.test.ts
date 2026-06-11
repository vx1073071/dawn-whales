/**
 * @vitest-environment node
 * J-56-01: Agent Orchestrator Tests (20+ tests)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  AgentOrchestrator,
  getAgentOrchestrator,
  resetAgentOrchestrator,
  type AgentVote,
} from '../electron/engine/agents/agent-orchestrator';

// ── Section 1: Connection Management ───────────────────────────────────────

describe('J-56-01-01: Connection', () => {
  let orch: AgentOrchestrator;

  beforeEach(() => {
    resetAgentOrchestrator();
    orch = getAgentOrchestrator();
  });

  it('01: initial status is disconnected', () => {
    expect(orch.getConnectionStatus()).toBe('disconnected');
    expect(orch.isConnected()).toBe(false);
  });

  it('02: connect succeeds with healthy service', async () => {
    const result = await orch.connect();
    expect(result).toBe(true);
    expect(orch.isConnected()).toBe(true);
  });

  it('03: disconnect changes status', async () => {
    await orch.connect();
    orch.disconnect();
    expect(orch.getConnectionStatus()).toBe('disconnected');
  });

  it('04: connect fails when service unhealthy', async () => {
    orch.setMockHealthy(false);
    const result = await orch.connect();
    expect(result).toBe(false);
    expect(orch.isConnected()).toBe(false);
  });

  it('05: health check returns latency', async () => {
    await orch.connect();
    const health = await orch.checkHealth();
    expect(health.connected).toBe(true);
    expect(health.latencyMs).toBeGreaterThanOrEqual(0);
    expect(health.version).toBeDefined();
  });
});

// ── Section 2: Session Management ──────────────────────────────────────────

describe('J-56-01-02: Sessions', () => {
  let orch: AgentOrchestrator;

  beforeEach(async () => {
    resetAgentOrchestrator();
    orch = getAgentOrchestrator();
    await orch.connect();
  });

  it('06: startAnalysis returns session ID', async () => {
    const sessionId = await orch.startAnalysis({ symbol: 'AAPL' });
    expect(sessionId).toBeDefined();
    expect(sessionId.startsWith('sess_')).toBe(true);
  });

  it('07: session count increments', async () => {
    await orch.startAnalysis({ symbol: 'AAPL' });
    await orch.startAnalysis({ symbol: 'MSFT' });
    expect(orch.getSessionCount()).toBe(2);
  });

  it('08: max concurrent sessions enforced', async () => {
    resetAgentOrchestrator();
    const orch2 = new AgentOrchestrator({ maxConcurrentSessions: 2 });
    await orch2.connect();
    await orch2.startAnalysis({ symbol: 'A' });
    await orch2.startAnalysis({ symbol: 'B' });
    await expect(orch2.startAnalysis({ symbol: 'C' })).rejects.toThrow('Max concurrent');
  });

  it('09: cancelAnalysis works', async () => {
    const id = await orch.startAnalysis({ symbol: 'AAPL' });
    expect(orch.cancelAnalysis(id)).toBe(true);
    expect(orch.getSessionStatus(id)?.stage).toBe('cancelled');
  });

  it('10: cancel nonexistent returns false', () => {
    expect(orch.cancelAnalysis('nonexistent')).toBe(false);
  });

  it('11: getActiveSessions returns non-terminal sessions', async () => {
    const id1 = await orch.startAnalysis({ symbol: 'AAPL' });
    const id2 = await orch.startAnalysis({ symbol: 'MSFT' });
    orch.cancelAnalysis(id1);
    const active = orch.getActiveSessions();
    expect(active).toContain(id2);
    expect(active).not.toContain(id1);
  });

  it('12: getSessionStatus returns progress', async () => {
    const id = await orch.startAnalysis({ symbol: 'AAPL' });
    const status = orch.getSessionStatus(id);
    expect(status).not.toBeNull();
    expect(status!.sessionId).toBe(id);
    expect(status!.percentComplete).toBeGreaterThanOrEqual(0);
  });
});

// ── Section 3: Agent Reports & Finalization ────────────────────────────────

describe('J-56-01-03: Agent Reports', () => {
  let orch: AgentOrchestrator;
  let sessionId: string;

  beforeEach(async () => {
    resetAgentOrchestrator();
    orch = getAgentOrchestrator();
    await orch.connect();
    sessionId = await orch.startAnalysis({ symbol: 'AAPL' });
  });

  it('13: recordAgentReport adds report', () => {
    const ok = orch.recordAgentReport(sessionId, {
      agentType: 'fundamentals',
      status: 'completed',
      summary: 'Strong earnings growth',
      recommendation: 'buy',
      confidence: 80,
      keyFactors: ['Revenue +15%', 'EPS beat'],
      dataPoints: {},
      completedAt: new Date().toISOString(),
    });
    expect(ok).toBe(true);
  });

  it('14: recordAgentReport for nonexistent session fails', () => {
    expect(orch.recordAgentReport('nonexistent', {
      agentType: 'fundamentals', status: 'completed', summary: 'x',
      recommendation: 'buy', confidence: 50, keyFactors: [], dataPoints: {},
      completedAt: new Date().toISOString(),
    })).toBe(false);
  });

  it('15: finalizeSession sets completed status', () => {
    orch.finalizeSession(sessionId, {
      sessionId, symbol: 'AAPL', status: 'completed',
      agentReports: [], debateRounds: [],
      finalDecision: { recommendation: 'buy', confidence: 75, reasoning: 'Strong buy consensus', votes: { fundamentals: 'buy', sentiment: 'buy', news: 'hold', technical: 'buy' } },
      durationMs: 5000, llmProvider: 'deepseek', llmModel: 'deepseek-chat',
      costEstimate: 0.05, completedAt: new Date().toISOString(),
    });
    expect(orch.getSessionResult(sessionId)).not.toBeNull();
    expect(orch.getSessionStatus(sessionId)?.stage).toBe('completed');
  });

  it('16: multiple agent reports update progress', () => {
    for (const agent of ['fundamentals', 'sentiment', 'news', 'technical'] as const) {
      orch.recordAgentReport(sessionId, {
        agentType: agent, status: 'completed', summary: `${agent} analysis`,
        recommendation: 'buy', confidence: 70, keyFactors: [], dataPoints: {},
        completedAt: new Date().toISOString(),
      });
    }
    const status = orch.getSessionStatus(sessionId);
    expect(status!.percentComplete).toBeGreaterThanOrEqual(50);
  });
});

// ── Section 4: Mock & Request Log ──────────────────────────────────────────

describe('J-56-01-04: Mock & Logging', () => {
  let orch: AgentOrchestrator;

  beforeEach(() => {
    resetAgentOrchestrator();
    orch = getAgentOrchestrator();
  });

  it('17: mock response overrides HTTP', async () => {
    orch.setMockResponse('GET', '/health', 503, { error: 'down' });
    const health = await orch.checkHealth();
    expect(health.pythonService).toBe(false);
  });

  it('18: clearMockResponses restores default', async () => {
    orch.setMockResponse('GET', '/health', 503, { error: 'down' });
    orch.clearMockResponses();
    const health = await orch.checkHealth();
    expect(health.pythonService).toBe(true);
  });

  it('19: request log tracks calls', async () => {
    await orch.connect();
    await orch.checkHealth();
    const log = orch.getRequestLog();
    expect(log.length).toBeGreaterThan(0);
    expect(log[0].method).toBe('GET');
  });

  it('20: reset clears all state', async () => {
    await orch.connect();
    await orch.startAnalysis({ symbol: 'AAPL' });
    orch.reset();
    expect(orch.getSessionCount()).toBe(0);
    expect(orch.isConnected()).toBe(false);
  });
});

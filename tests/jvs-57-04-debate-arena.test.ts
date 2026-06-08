/**
 * J-57-04 Tests: DebateEngine + ModelArenaEngine (v19)
 *
 * Tests:
 * 01-05: DebateEngine core functionality
 * 06-10: ModelArenaEngine core functionality
 * 11-13: Integration & singletons
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  DebateEngine,
  ModelArenaEngine,
  getDebateEngine,
  resetDebateEngine,
  getModelArenaEngine,
  resetModelArenaEngine,
} from '../electron/engine/debate-arena-engine';

// ── Mock Functions ─────────────────────────────────────────────────────────

function makeBullAgent(bias: number = 7) {
  return async (round: number, previous: string[]) => ({
    argument: `Bull round ${round}: strong buy signal (prev: ${previous.length} args)`,
    score: bias + round,
  });
}

function makeBearAgent(bias: number = 5) {
  return async (round: number, previous: string[]) => ({
    argument: `Bear round ${round}: sell signal detected (prev: ${previous.length} args)`,
    score: bias + round,
  });
}

function makeAnalyzeWithProvider(qualityMap: Record<string, { score: number; confidence: number }>) {
  return async (provider: string, model: string) => {
    const q = qualityMap[provider] || { score: 5, confidence: 0.7 };
    return {
      result: `${provider} analysis: score ${q.score} for AAPL`,
      score: q.score,
      confidence: q.confidence,
    };
  };
}

// ── DebateEngine Tests ─────────────────────────────────────────────────────

describe('J-57-04-01: DebateEngine', () => {
  let debate: DebateEngine;

  beforeEach(() => {
    debate = new DebateEngine();
  });

  it('01: runs multi-round debate', async () => {
    const result = await debate.runDebate('AAPL stock analysis', makeBullAgent(7), makeBearAgent(5));

    expect(result.topic).toBe('AAPL stock analysis');
    expect(result.rounds.length).toBeGreaterThanOrEqual(1);
    expect(result.rounds.length).toBeLessThanOrEqual(3);
  });

  it('02: bull wins when bull scores higher', async () => {
    const result = await debate.runDebate('AAPL', makeBullAgent(9), makeBearAgent(2));

    expect(result.winner).toBe('bull');
    expect(result.finalScore.bull).toBeGreaterThan(result.finalScore.bear);
  });

  it('03: bear wins when bear scores higher', async () => {
    const result = await debate.runDebate('AAPL', makeBullAgent(3), makeBearAgent(8));

    expect(result.winner).toBe('bear');
    expect(result.finalScore.bear).toBeGreaterThan(result.finalScore.bull);
  });

  it('04: early termination when score gap exceeds threshold', async () => {
    debate = new DebateEngine({ maxRounds: 5, scoreThreshold: 2, timePerRoundMs: 100 });
    const result = await debate.runDebate('AAPL', makeBullAgent(9), makeBearAgent(2));

    // Bull starts at 7+1=8, bear at 5+1=6... gap=2 after round 1 but with threshold 2 it might continue
    // Actually: round 1: bull=10, bear=7 -> gap=3 < threshold=3 so might stop. Let's verify we get fewer rounds
    expect(result.totalRounds).toBeLessThan(5);
  });

  it('05: debate log accumulates history', async () => {
    await debate.runDebate('AAPL', makeBullAgent(7), makeBearAgent(5));
    await debate.runDebate('TSLA', makeBullAgent(5), makeBearAgent(7));

    const log = debate.getDebateLog();
    expect(log.length).toBe(2);
    expect(log[0].topic).toBe('AAPL');
    expect(log[1].topic).toBe('TSLA');
  });

  it('06: debate stats are correct', async () => {
    await debate.runDebate('AAPL', makeBullAgent(9), makeBearAgent(3)); // bull wins
    await debate.runDebate('TSLA', makeBullAgent(3), makeBearAgent(9)); // bear wins

    const stats = debate.getDebateStats();
    expect(stats.totalDebates).toBe(2);
    expect(stats.bullWins).toBe(1);
    expect(stats.bearWins).toBe(1);
  });

  it('07: debate with tie possible when close', async () => {
    const result = await debate.runDebate('AAPL', makeBullAgent(5), makeBearAgent(5));

    // With similar biases, rounds will be close
    expect(result.finalScore.bull).toBeGreaterThan(0);
    expect(result.finalScore.bear).toBeGreaterThan(0);
  });

  it('08: reset clears debate log', async () => {
    await debate.runDebate('AAPL', makeBullAgent(7), makeBearAgent(5));
    debate.reset();

    expect(debate.getDebateLog().length).toBe(0);
  });
});

// ── ModelArenaEngine Tests ─────────────────────────────────────────────────

describe('J-57-04-02: ModelArenaEngine', () => {
  let arena: ModelArenaEngine;

  beforeEach(() => {
    arena = new ModelArenaEngine();
  });

  it('09: runs arena with multiple providers', async () => {
    const result = await arena.runArena(
      'AAPL fundamental analysis',
      makeAnalyzeWithProvider({
        deepseek: { score: 8, confidence: 0.9 },
        openai: { score: 7, confidence: 0.85 },
        anthropic: { score: 9, confidence: 0.88 },
      }),
    );

    expect(result.entries.length).toBe(3);
    expect(result.rankings.length).toBe(3);
  });

  it('10: winner is top-ranked provider', async () => {
    const result = await arena.runArena(
      'AAPL',
      makeAnalyzeWithProvider({
        deepseek: { score: 9, confidence: 0.9 },
        openai: { score: 5, confidence: 0.6 },
        anthropic: { score: 6, confidence: 0.7 },
      }),
    );

    expect(result.winner).toBeDefined();
    expect(result.rankings[0].provider).toBe(result.winner);
  });

  it('11: consensus detected when top 2 agree', async () => {
    const result = await arena.runArena(
      'AAPL',
      makeAnalyzeWithProvider({
        deepseek: { score: 8, confidence: 0.9 },
        openai: { score: 8, confidence: 0.9 },
        anthropic: { score: 5, confidence: 0.6 },
      }),
    );

    // deepseek and openai both return high scores, they should agree
    expect(result.consensus).toBeDefined();
  });

  it('12: total cost is calculated', async () => {
    const result = await arena.runArena(
      'AAPL',
      makeAnalyzeWithProvider({
        deepseek: { score: 8, confidence: 0.9 },
        openai: { score: 7, confidence: 0.8 },
        anthropic: { score: 6, confidence: 0.7 },
      }),
    );

    expect(result.totalCostUSDT).toBeGreaterThanOrEqual(0);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('13: leaderboard tracks wins correctly', async () => {
    // Run multiple arenas with different winners
    await arena.runArena('AAPL', makeAnalyzeWithProvider({
      deepseek: { score: 9, confidence: 0.9 },
      openai: { score: 5, confidence: 0.6 },
      anthropic: { score: 6, confidence: 0.7 },
    }));

    await arena.runArena('TSLA', makeAnalyzeWithProvider({
      deepseek: { score: 6, confidence: 0.7 },
      openai: { score: 9, confidence: 0.9 },
      anthropic: { score: 5, confidence: 0.6 },
    }));

    const leaderboard = arena.getLeaderboard();
    expect(leaderboard.length).toBe(3);
    // Both deepseek and openai have 1 win each
    const totalWins = leaderboard.reduce((sum, e) => sum + e.wins, 0);
    expect(totalWins).toBe(2);
  });

  it('14: arena log accumulates history', async () => {
    await arena.runArena('AAPL', makeAnalyzeWithProvider({
      deepseek: { score: 8, confidence: 0.9 },
      openai: { score: 7, confidence: 0.8 },
      anthropic: { score: 6, confidence: 0.7 },
    }));

    expect(arena.getArenaLog().length).toBe(1);
  });

  it('15: sequential mode for cost control', async () => {
    const sequentialArena = new ModelArenaEngine({
      providers: [
        { id: 'deepseek', name: 'DeepSeek', model: 'deepseek-v4-pro', costPer1K: 0.000435 },
        { id: 'openai', name: 'OpenAI', model: 'gpt-4o', costPer1K: 0.0025 },
      ],
      concurrency: false,
      timeoutMs: 15000,
      rankingMethod: 'weighted',
    });

    const result = await sequentialArena.runArena(
      'AAPL',
      makeAnalyzeWithProvider({
        deepseek: { score: 8, confidence: 0.9 },
        openai: { score: 7, confidence: 0.8 },
        anthropic: { score: 6, confidence: 0.7 },
      }),
    );

    expect(result.entries.length).toBe(2); // 2 providers configured
  });

  it('16: reset clears arena log', async () => {
    await arena.runArena('AAPL', makeAnalyzeWithProvider({
      deepseek: { score: 8, confidence: 0.9 },
      openai: { score: 7, confidence: 0.8 },
      anthropic: { score: 6, confidence: 0.7 },
    }));
    arena.reset();

    expect(arena.getArenaLog().length).toBe(0);
    expect(arena.getLeaderboard().length).toBe(0);
  });
});

// ── Singleton Tests ────────────────────────────────────────────────────────

describe('J-57-04-03: Debate + Arena Singletons', () => {
  it('17: getDebateEngine returns singleton', () => {
    resetDebateEngine();
    const d1 = getDebateEngine();
    const d2 = getDebateEngine();
    expect(d1).toBe(d2);
  });

  it('18: resetDebateEngine creates new instance', () => {
    const d1 = getDebateEngine();
    resetDebateEngine();
    const d2 = getDebateEngine();
    expect(d1).not.toBe(d2);
  });

  it('19: getModelArenaEngine returns singleton', () => {
    resetModelArenaEngine();
    const a1 = getModelArenaEngine();
    const a2 = getModelArenaEngine();
    expect(a1).toBe(a2);
  });

  it('20: resetModelArenaEngine creates new instance', () => {
    const a1 = getModelArenaEngine();
    resetModelArenaEngine();
    const a2 = getModelArenaEngine();
    expect(a1).not.toBe(a2);
  });
});

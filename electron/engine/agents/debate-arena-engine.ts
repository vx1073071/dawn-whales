/**
 * J-57-04: DebateEngine + ModelArenaEngine (R57 v19)
 * 多空辩论协议 + 多模型竞技场（同题对比）
 *
 * Features:
 * - Multi-round bull vs bear debate protocol
 * - 3+ LLM concurrent arena: compare, rank, weight
 * - Integration with FourAgentOrchestrator
 * - Debate log persistence (in-memory for MVP)
 *
 * ≥100L, 5+ tests
 */

import { EventEmitter } from 'events';
import { EngineError } from '../core/engine-error';


// ── Types ──────────────────────────────────────────────────────────────────

export interface DebateRound {
  round: number;
  bullArguments: string[];
  bearArguments: string[];
  bullScore: number;
  bearScore: number;
  winningSide: 'bull' | 'bear' | 'tie';
}

export interface DebateConfig {
  maxRounds: number;
  scoreThreshold: number;      // difference needed to declare winner early
  timePerRoundMs: number;
}

export interface DebateResult {
  topic: string;
  rounds: DebateRound[];
  winner: 'bull' | 'bear' | 'tie';
  finalScore: { bull: number; bear: number };
  totalRounds: number;
  durationMs: number;
  summary: string;
}

export interface ArenaProvider {
  id: string;
  name: string;
  model: string;
  costPer1K: number;
}

export interface ArenaEntry {
  provider: string;
  model: string;
  result: string;
  score: number;          // 0-10
  confidence: number;     // 0-1
  latencyMs: number;
  costUSDT: number;
}

export interface ArenaConfig {
  providers: ArenaProvider[];
  concurrency: boolean;
  timeoutMs: number;
  rankingMethod: 'score' | 'weighted' | 'majority';
}

export interface ArenaResult {
  topic: string;
  entries: ArenaEntry[];
  rankings: ArenaEntry[];        // sorted by rank
  winner: string;
  consensus: string | null;
  totalCostUSDT: number;
  durationMs: number;
}

// ── Debate Engine ──────────────────────────────────────────────────────────

export class DebateEngine extends EventEmitter {
  private debateLog: DebateResult[] = [];
  private idCounter = 1;

  constructor(private config: DebateConfig = { maxRounds: 3, scoreThreshold: 3, timePerRoundMs: 5000 }) {
    super();
  }

  /**
   * Run a multi-round bull vs bear debate
   */
  async runDebate(
    topic: string,
    bullAgent: (round: number, previousArguments: string[]) => Promise<{ argument: string; score: number }>,
    bearAgent: (round: number, previousArguments: string[]) => Promise<{ argument: string; score: number }>,
  ): Promise<DebateResult> {
    const startTime = Date.now();
    const rounds: DebateRound[] = [];
    let bullTotal = 0;
    let bearTotal = 0;

    for (let r = 1; r <= this.config.maxRounds; r++) {
      const priorBullArgs = rounds.flatMap(rd => rd.bullArguments);
      const priorBearArgs = rounds.flatMap(rd => rd.bearArguments);

      // Both sides debate concurrently
      const [bullResponse, bearResponse] = await Promise.all([
        bullAgent(r, priorBearArgs),
        bearAgent(r, priorBullArgs),
      ]);

      const bullScore = Math.max(0, Math.min(10, bullResponse.score));
      const bearScore = Math.max(0, Math.min(10, bearResponse.score));

      bullTotal += bullScore;
      bearTotal += bearScore;

      const winningSide: 'bull' | 'bear' | 'tie' =
        bullScore > bearScore ? 'bull' : bearScore > bullScore ? 'bear' : 'tie';

      rounds.push({
        round: r,
        bullArguments: [bullResponse.argument],
        bearArguments: [bearResponse.argument],
        bullScore,
        bearScore,
        winningSide,
      });

      this.emit('debate:round', rounds[rounds.length - 1]);

      // Early termination if score gap exceeds threshold
      if (Math.abs(bullTotal - bearTotal) >= this.config.scoreThreshold && r < this.config.maxRounds) {
        break;
      }
    }

    const winner: 'bull' | 'bear' | 'tie' =
      bullTotal > bearTotal ? 'bull' : bearTotal > bullTotal ? 'bear' : 'tie';

    const result: DebateResult = {
      topic,
      rounds,
      winner,
      finalScore: { bull: bullTotal, bear: bearTotal },
      totalRounds: rounds.length,
      durationMs: Date.now() - startTime,
      summary: `${topic}: ${winner} wins (bull: ${bullTotal}, bear: ${bearTotal}, ${rounds.length} rounds)`,
    };

    this.debateLog.push(result);
    this.emit('debate:completed', result);
    return result;
  }

  /**
   * Get debate history
   */
  getDebateLog(): DebateResult[] {
    return [...this.debateLog];
  }

  /**
   * Get debate stats
   */
  getDebateStats(): { totalDebates: number; bullWins: number; bearWins: number; ties: number; avgRounds: number } {
    if (this.debateLog.length === 0) {
      return { totalDebates: 0, bullWins: 0, bearWins: 0, ties: 0, avgRounds: 0 };
    }

    const bullWins = this.debateLog.filter(d => d.winner === 'bull').length;
    const bearWins = this.debateLog.filter(d => d.winner === 'bear').length;
    const ties = this.debateLog.filter(d => d.winner === 'tie').length;
    const avgRounds = this.debateLog.reduce((s, d) => s + d.totalRounds, 0) / this.debateLog.length;

    return {
      totalDebates: this.debateLog.length,
      bullWins,
      bearWins,
      ties,
      avgRounds: Math.round(avgRounds * 100) / 100,
    };
  }

  /**
   * Reset debate engine
   */
  reset(): void {
    this.debateLog = [];
    this.idCounter = 1;
    this.removeAllListeners();
  }
}

// ── Model Arena Engine ─────────────────────────────────────────────────────

export class ModelArenaEngine extends EventEmitter {
  private arenaLog: ArenaResult[] = [];
  private idCounter = 1;

  constructor(
    private config: ArenaConfig = {
      providers: [
        { id: 'deepseek', name: 'DeepSeek', model: 'deepseek-v4-pro', costPer1K: 0.000435 },
        { id: 'openai', name: 'OpenAI', model: 'gpt-4o', costPer1K: 0.0025 },
        { id: 'anthropic', name: 'Anthropic', model: 'claude-sonnet', costPer1K: 0.003 },
      ],
      concurrency: true,
      timeoutMs: 15000,
      rankingMethod: 'weighted',
    },
  ) {
    super();
  }

  /**
   * Run a model arena: same topic, multiple LLMs → compare + rank
   */
  async runArena(
    topic: string,
    analyzeWithProvider: (provider: string, model: string) => Promise<{
      result: string;
      score: number;
      confidence: number;
    }>,
  ): Promise<ArenaResult> {
    const startTime = Date.now();
    const entries: ArenaEntry[] = [];

    if (this.config.concurrency) {
      // All providers run concurrently
      const promises = this.config.providers.map(async (p) => {
        const pStart = Date.now();
        try {
          const r = await analyzeWithProvider(p.id, p.model);
          const latency = Date.now() - pStart;
          const cost = (latency / 1000) * (p.costPer1K / 1000); // rough estimate

          entries.push({
            provider: p.id,
            model: p.model,
            result: r.result,
            score: r.score,
            confidence: r.confidence,
            latencyMs: latency,
            costUSDT: Math.round(cost * 1000000) / 1000000,
          });
        } catch (err) {
          entries.push({
            provider: p.id,
            model: p.model,
            result: `Error: ${err instanceof Error ? err.message : 'timeout'}`,
            score: 0,
            confidence: 0,
            latencyMs: this.config.timeoutMs,
            costUSDT: 0,
          });
        }
      });

      await Promise.all(promises);
    } else {
      // Sequential for cost control
      for (const p of this.config.providers) {
        const pStart = Date.now();
        try {
          const r = await analyzeWithProvider(p.id, p.model);
          entries.push({
            provider: p.id,
            model: p.model,
            result: r.result,
            score: r.score,
            confidence: r.confidence,
            latencyMs: Date.now() - pStart,
            costUSDT: 0.001,
          });
        } catch (err) {
          entries.push({
            provider: p.id,
            model: p.model,
            result: 'Error',
            score: 0,
            confidence: 0,
            latencyMs: this.config.timeoutMs,
            costUSDT: 0,
          });
        }
      }
    }

    // Rank entries
    const rankings = this.rankEntries(entries);
    const winner = rankings[0]?.provider || 'none';

    // Find consensus (most common result summary)
    const consensus = this.findConsensus(rankings);

    const result: ArenaResult = {
      topic,
      entries,
      rankings,
      winner,
      consensus,
      totalCostUSDT: Math.round(entries.reduce((s, e) => s + e.costUSDT, 0) * 1000000) / 1000000,
      durationMs: Date.now() - startTime,
    };

    this.arenaLog.push(result);
    this.emit('arena:completed', result);
    return result;
  }

  /**
   * Rank entries by configured method
   */
  private rankEntries(entries: ArenaEntry[]): ArenaEntry[] {
    const sorted = [...entries];

    if (this.config.rankingMethod === 'weighted') {
      // Weighted: score * 0.6 + confidence * 0.4 as composite
      sorted.sort((a, b) => {
        const aComposite = a.score * 0.6 + a.confidence * 10 * 0.4;
        const bComposite = b.score * 0.6 + b.confidence * 10 * 0.4;
        return bComposite - aComposite;
      });
    } else if (this.config.rankingMethod === 'majority') {
      // Group by similar results, rank by group size
      const groups: Map<string, { entries: ArenaEntry[]; avgScore: number }> = new Map();
      for (const e of sorted) {
        const key = e.result.substring(0, 20); // rough grouping
        if (!groups.has(key)) groups.set(key, { entries: [], avgScore: 0 });
        groups.get(key)!.entries.push(e);
        const g = groups.get(key)!;
        g.avgScore = g.entries.reduce((s, en) => s + en.score, 0) / g.entries.length;
      }
      sorted.sort((a, b) => {
        const aGroup = Array.from(groups.values()).find(g => g.entries.includes(a));
        const bGroup = Array.from(groups.values()).find(g => g.entries.includes(b));
        return (bGroup?.entries.length || 0) - (aGroup?.entries.length || 0) || (bGroup?.avgScore || 0) - (aGroup?.avgScore || 0);
      });
    } else {
      // score only
      sorted.sort((a, b) => b.score - a.score || b.confidence - a.confidence);
    }

    return sorted;
  }

  /**
   * Find consensus among top 2 entries
   */
  private findConsensus(ranked: ArenaEntry[]): string | null {
    if (ranked.length < 2) return null;
    const top2 = ranked.slice(0, 2);
    const sameResult = top2[0].result.substring(0, 30) === top2[1].result.substring(0, 30);
    return sameResult ? top2[0].result : null;
  }

  /**
   * Get arena history
   */
  getArenaLog(): ArenaResult[] {
    return [...this.arenaLog];
  }

  /**
   * Get arena leaderboard (provider-specific stats)
   */
  getLeaderboard(): { provider: string; wins: number; avgRank: number; avgScore: number; totalEntries: number }[] {
    const stats: Map<string, { wins: number; totalRank: number; totalScore: number; totalEntries: number }> = new Map();

    for (const result of this.arenaLog) {
      for (const entry of result.entries) {
        if (!stats.has(entry.provider)) {
          stats.set(entry.provider, { wins: 0, totalRank: 0, totalScore: 0, totalEntries: 0 });
        }
        const s = stats.get(entry.provider)!;
        s.totalEntries++;
        s.totalScore += entry.score;
        const rank = result.rankings.findIndex(r => r.provider === entry.provider) + 1;
        s.totalRank += rank;
        if (rank === 1) s.wins++;
      }
    }

    return Array.from(stats.entries())
      .map(([provider, s]) => ({
        provider,
        wins: s.wins,
        avgRank: Math.round((s.totalRank / s.totalEntries) * 100) / 100,
        avgScore: Math.round((s.totalScore / s.totalEntries) * 100) / 100,
        totalEntries: s.totalEntries,
      }))
      .sort((a, b) => b.wins - a.wins || a.avgRank - b.avgRank);
  }

  /**
   * Reset arena engine
   */
  reset(): void {
    this.arenaLog = [];
    this.idCounter = 1;
    this.removeAllListeners();
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let _debateInstance: DebateEngine | null = null;
let _arenaInstance: ModelArenaEngine | null = null;

export function getDebateEngine(): DebateEngine {
  if (!_debateInstance) _debateInstance = new DebateEngine();
  return _debateInstance;
}

export function resetDebateEngine(): void {
  _debateInstance?.reset();
  _debateInstance = null;
}

export function getModelArenaEngine(): ModelArenaEngine {
  if (!_arenaInstance) _arenaInstance = new ModelArenaEngine();
  return _arenaInstance;
}

export function resetModelArenaEngine(): void {
  _arenaInstance?.reset();
  _arenaInstance = null;
}

export default { DebateEngine, ModelArenaEngine, getDebateEngine, resetDebateEngine, getModelArenaEngine, resetModelArenaEngine };

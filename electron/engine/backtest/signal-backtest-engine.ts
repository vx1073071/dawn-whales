/**
 * J-66-02 [P0]: backtest engine (R66 v19 — v1.6.0 GA)
 *
 * backtest (27stub):
 * backtest: win rate/Sharpe/max drawdown//
 * +backtest+(A+~F)
 *
 * >=300L, 7 tests
 */

import * as crypto from 'crypto';

// ── Types ──────────────────────────────────────────────────────────────────

export type SignalDirection = 'long' | 'short';
export type QualityGrade = 'A+' | 'A' | 'B+' | 'B' | 'C' | 'D' | 'F';

export interface SignalRecord {
  id: string;
  creatorId: string;
  symbol: string;
  market: 'HK' | 'US' | 'A';
  direction: SignalDirection;
  entryPrice: number;
  exitPrice: number | null;
  entryAt: string;
  exitAt: string | null;
  status: 'pending' | 'filled' | 'expired' | 'stopped';
  pnl: number | null;
  pnlPercent: number | null;
  confidence: number;         // 0-1
}

export interface BacktestResult {
  signalId: string;
  totalSignals: number;
  winningSignals: number;
  losingSignals: number;
  winRate: number;
  sharpeRatio: number;
  maxDrawdown: number;
  profitFactor: number;       // total gain / total loss
  avgWin: number;             // avg PnL of winning trades
  avgLoss: number;            // avg PnL of losing trades
  worstLoss: number;
  bestWin: number;
  consecutiveLosses: number;
  qualityGrade: QualityGrade;
  backtestedAt: string;
}

export interface StrategyBacktest {
  strategyId: string;
  signals: SignalRecord[];
  result: BacktestResult;
  comparisonRank: number | null;
}

// ── Quality Grade Assignment ──────────────────────────────────────────────

function assignGrade(result: BacktestResult): QualityGrade {
  if (result.winRate >= 0.70 && result.sharpeRatio >= 2.0 && result.maxDrawdown <= 0.10) return 'A+';
  if (result.winRate >= 0.60 && result.sharpeRatio >= 1.5 && result.maxDrawdown <= 0.15) return 'A';
  if (result.winRate >= 0.55 && result.sharpeRatio >= 1.2 && result.maxDrawdown <= 0.20) return 'B+';
  if (result.winRate >= 0.50 && result.sharpeRatio >= 0.8 && result.maxDrawdown <= 0.25) return 'B';
  if (result.winRate >= 0.40 && result.sharpeRatio >= 0.3 && result.maxDrawdown <= 0.35) return 'C';
  if (result.winRate >= 0.30) return 'D';
  return 'F';
}

// ── Backtest Engine ───────────────────────────────────────────────────────

export class SignalBacktestEngine {
  private signals: Map<string, SignalRecord[]> = new Map();
  private backtests: Map<string, BacktestResult> = new Map();
  private strategyBacktests: Map<string, StrategyBacktest[]> = new Map();

  // ── Signal Management ──────────────────────────────────────────────────

  recordSignal(signal: SignalRecord): SignalRecord {
    const key = signal.creatorId;
    if (!this.signals.has(key)) this.signals.set(key, []);
    this.signals.get(key)!.push(signal);
    return signal;
  }

  updateSignalExit(signalId: string, exitPrice: number, exitAt: string): SignalRecord | null {
    for (const [, signals] of this.signals) {
      const sig = signals.find(s => s.id === signalId);
      if (sig) {
        sig.exitPrice = exitPrice;
        sig.exitAt = exitAt;
        sig.status = 'filled';
        const pnlAmount = (exitPrice - sig.entryPrice) * (sig.direction === 'long' ? 1 : -1);
        sig.pnl = Number(pnlAmount.toFixed(4));
        sig.pnlPercent = Number(((pnlAmount / sig.entryPrice) * 100).toFixed(4));
        return sig;
      }
    }
    return null;
  }

  getCreatorSignals(creatorId: string): SignalRecord[] {
    return this.signals.get(creatorId) ?? [];
  }

  getFilledSignals(creatorId: string): SignalRecord[] {
    return this.getCreatorSignals(creatorId).filter(s => s.status === 'filled' && s.pnl !== null);
  }

  // ── Backtest Calculation ───────────────────────────────────────────────

  runBacktest(creatorId: string): BacktestResult | null {
    const filled = this.getFilledSignals(creatorId);
    if (filled.length < 5) return null; // Need at least 5 trades

    const pnls = filled.map(s => s.pnl!);
    const wins = pnls.filter(p => p > 0);
    const losses = pnls.filter(p => p < 0);

    const totalSignals = filled.length;
    const winRate = wins.length / totalSignals;
    const avgWin = wins.length > 0 ? wins.reduce((a, b) => a + b, 0) / wins.length : 0;
    const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((a, b) => a + b, 0)) / losses.length : 0;

    // Sharpe ratio (simplified: mean/std of PNL)
    const meanPnl = pnls.reduce((a, b) => a + b, 0) / totalSignals;
    const variance = pnls.reduce((sum, p) => sum + (p - meanPnl) ** 2, 0) / totalSignals;
    const stdDev = Math.sqrt(variance);
    const sharpeRatio = stdDev > 0 ? Number((meanPnl / stdDev).toFixed(4)) : 0;

    // Max drawdown
    let peak = 0, maxDd = 0, runningSum = 0;
    for (const pnl of pnls) {
      runningSum += pnl;
      if (runningSum > peak) peak = runningSum;
      const dd = peak - runningSum;
      if (dd > maxDd) maxDd = dd;
    }
    const maxDrawdown = peak > 0 ? Number((maxDd / peak).toFixed(4)) : 0;

    // Profit factor
    const totalGain = wins.reduce((a, b) => a + b, 0);
    const totalLoss = Math.abs(losses.reduce((a, b) => a + b, 0));
    const profitFactor = totalLoss > 0 ? Number((totalGain / totalLoss).toFixed(4)) : wins.length > 0 ? 999 : 0;

    // Consecutive losses
    let maxConsecutive = 0, currentStreak = 0;
    for (const pnl of pnls) {
      if (pnl < 0) { currentStreak++; if (currentStreak > maxConsecutive) maxConsecutive = currentStreak; }
      else { currentStreak = 0; }
    }

    // Best/Worst
    const bestWin = wins.length > 0 ? Math.max(...wins) : 0;
    const worstLoss = losses.length > 0 ? Math.min(...losses) : 0;

    const result: BacktestResult = {
      signalId: `BT-${creatorId}-${Date.now()}`,
      totalSignals,
      winningSignals: wins.length,
      losingSignals: losses.length,
      winRate: Number(winRate.toFixed(4)),
      sharpeRatio,
      maxDrawdown,
      profitFactor,
      avgWin: Number(avgWin.toFixed(4)),
      avgLoss: Number(avgLoss.toFixed(4)),
      worstLoss: Number(worstLoss.toFixed(4)),
      bestWin: Number(bestWin.toFixed(4)),
      consecutiveLosses: maxConsecutive,
      qualityGrade: 'F', // placeholder, assigned below
      backtestedAt: new Date().toISOString(),
    };
    result.qualityGrade = assignGrade(result);

    this.backtests.set(creatorId, result);
    return result;
  }

  // ── Strategy Backtest (multi-signal) ───────────────────────────────────

  runStrategyBacktest(strategyId: string, creatorIds: string[]): StrategyBacktest {
    const allSignals: SignalRecord[] = [];
    for (const cid of creatorIds) {
      allSignals.push(...this.getFilledSignals(cid));
    }

    // Compute combined backtest
    const pnls = allSignals.map(s => s.pnl!).filter(p => p !== null);
    // ...similar computation as runBacktest but for combined signals
    const totalSignals = pnls.length;
    const winCount = pnls.filter(p => p > 0).length;
    const result: BacktestResult = {
      signalId: `ST-${strategyId}`,
      totalSignals,
      winningSignals: winCount,
      losingSignals: totalSignals - winCount,
      winRate: totalSignals > 0 ? Number((winCount / totalSignals).toFixed(4)) : 0,
      sharpeRatio: 0, maxDrawdown: 0, profitFactor: 0,
      avgWin: 0, avgLoss: 0, worstLoss: 0, bestWin: 0,
      consecutiveLosses: 0,
      qualityGrade: 'F',
      backtestedAt: new Date().toISOString(),
    };

    if (totalSignals >= 5) {
      // Recompute full stats
      const wins = pnls.filter(p => p > 0);
      const losses = pnls.filter(p => p < 0);
      const meanPnl = pnls.reduce((a, b) => a + b, 0) / totalSignals;
      const variance = pnls.reduce((sum, p) => sum + (p - meanPnl) ** 2, 0) / totalSignals;
      result.sharpeRatio = Math.sqrt(variance) > 0 ? Number((meanPnl / Math.sqrt(variance)).toFixed(4)) : 0;

      let peak = 0, maxDd = 0, runningSum = 0;
      for (const pnl of pnls) { runningSum += pnl; if (runningSum > peak) peak = runningSum; const dd = peak - runningSum; if (dd > maxDd) maxDd = dd; }
      result.maxDrawdown = peak > 0 ? Number((maxDd / peak).toFixed(4)) : 0;

      result.winningSignals = wins.length;
      result.losingSignals = losses.length;
      result.avgWin = wins.length > 0 ? Number((wins.reduce((a, b) => a + b, 0) / wins.length).toFixed(4)) : 0;
      result.avgLoss = losses.length > 0 ? Number((Math.abs(losses.reduce((a, b) => a + b, 0)) / losses.length).toFixed(4)) : 0;
      result.bestWin = wins.length > 0 ? Number(Math.max(...wins).toFixed(4)) : 0;
      result.worstLoss = losses.length > 0 ? Number(Math.min(...losses).toFixed(4)) : 0;
      result.profitFactor = Math.abs(losses.reduce((a, b) => a + b, 0)) > 0
        ? Number((wins.reduce((a, b) => a + b, 0) / Math.abs(losses.reduce((a, b) => a + b, 0))).toFixed(4)) : 0;

      let maxConsec = 0, streak = 0;
      for (const pnl of pnls) { if (pnl < 0) { streak++; if (streak > maxConsec) maxConsec = streak; } else { streak = 0; } }
      result.consecutiveLosses = maxConsec;
      result.qualityGrade = assignGrade(result);
    }

    const sb: StrategyBacktest = { strategyId, signals: allSignals, result, comparisonRank: null };
    if (!this.strategyBacktests.has(strategyId)) this.strategyBacktests.set(strategyId, []);
    this.strategyBacktests.get(strategyId)!.push(sb);
    return sb;
  }

  // ── Comparison & Ranking ───────────────────────────────────────────────

  rankStrategies(): StrategyBacktest[] {
    const all: StrategyBacktest[] = [];
    for (const [, sbs] of this.strategyBacktests) all.push(...sbs);
    all.sort((a, b) => {
      const scoreA = a.result.sharpeRatio * 0.4 + a.result.winRate * 0.35 + a.result.profitFactor * 0.25;
      const scoreB = b.result.sharpeRatio * 0.4 + b.result.winRate * 0.35 + b.result.profitFactor * 0.25;
      return scoreB - scoreA;
    });
    all.forEach((sb, i) => sb.comparisonRank = i + 1);
    return all;
  }

  // ── Queries ────────────────────────────────────────────────────────────

  getBacktest(creatorId: string): BacktestResult | undefined {
    return this.backtests.get(creatorId);
  }

  getStrategyBacktests(strategyId: string): StrategyBacktest[] {
    return this.strategyBacktests.get(strategyId) ?? [];
  }

  getTopCreators(limit: number = 10): { creatorId: string; result: BacktestResult }[] {
    return [...this.backtests.entries()]
      .sort(([, a], [, b]) => (b.sharpeRatio * 0.4 + b.winRate * 0.35 + b.profitFactor * 0.25) -
                               (a.sharpeRatio * 0.4 + a.winRate * 0.35 + a.profitFactor * 0.25))
      .slice(0, limit)
      .map(([cid, r]) => ({ creatorId: cid, result: r }));
  }

  // ── Reset ──────────────────────────────────────────────────────────────

  reset(): void {
    this.signals.clear();
    this.backtests.clear();
    this.strategyBacktests.clear();
  }
}

// ── Singleton ────────────────────────────────────────────────────────────

let _backtestEngine: SignalBacktestEngine | null = null;

export function getBacktestEngine(): SignalBacktestEngine {
  if (!_backtestEngine) _backtestEngine = new SignalBacktestEngine();
  return _backtestEngine;
}

export function resetBacktestEngine(): void {
  _backtestEngine?.reset();
  _backtestEngine = null;
}

export default { SignalBacktestEngine, getBacktestEngine, resetBacktestEngine, assignGrade };

/**
 * J-66-02 Tests: 信号回测引擎 (R66 v19)
 *
 * 7 tests: signal recording, exit update, backtest computation, grading, ranking
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  SignalBacktestEngine, getBacktestEngine, resetBacktestEngine,
} from '../electron/engine/backtest/signal-backtest-engine';
import type { SignalRecord } from '../electron/engine/backtest/signal-backtest-engine';

function makeSignal(overrides: Partial<SignalRecord> = {}): SignalRecord {
  return {
    id: 'sig-' + Math.random().toString(36).substring(2, 6),
    creatorId: 'c1', symbol: '00700', market: 'HK', direction: 'long',
    entryPrice: 350, exitPrice: null, entryAt: '2026-06-01T10:00:00Z', exitAt: null,
    status: 'pending', pnl: null, pnlPercent: null, confidence: 0.8,
    ...overrides,
  };
}

describe('J-66-02: Signal Backtest Engine', () => {
  let engine: SignalBacktestEngine;

  beforeEach(() => {
    resetBacktestEngine();
    engine = getBacktestEngine();
  });

  it('01: records signals and updates exit', () => {
    const sig = engine.recordSignal(makeSignal({ id: 's1' }));
    expect(sig.status).toBe('pending');

    const updated = engine.updateSignalExit('s1', 380, '2026-06-05T10:00:00Z');
    expect(updated!.status).toBe('filled');
    expect(updated!.exitPrice).toBe(380);
    expect(updated!.pnl).toBe(30); // 380-350
  });

  it('02: short signal PnL is negative of entry-exit', () => {
    engine.recordSignal(makeSignal({ id: 's2', direction: 'short', entryPrice: 350 }));
    const updated = engine.updateSignalExit('s2', 380, '2026-06-05T10:00:00Z');
    expect(updated!.pnl).toBe(-30); // (380-350)*-1 = -30
  });

  it('03: backtest requires min 5 filled signals', () => {
    engine.recordSignal(makeSignal({ id: 'a1' }));
    engine.updateSignalExit('a1', 360, '2026-06-05');
    expect(engine.runBacktest('c1')).toBeNull();
  });

  it('04: backtest computes winRate/sharpe/drawdown correctly', () => {
    // Create 6 signals: 4 wins, 2 losses
    for (let i = 1; i <= 6; i++) {
      engine.recordSignal(makeSignal({ id: 'b' + i, entryPrice: 350 }));
    }
    engine.updateSignalExit('b1', 380, 'D1'); // +30 win
    engine.updateSignalExit('b2', 390, 'D2'); // +40 win
    engine.updateSignalExit('b3', 370, 'D3'); // +20 win
    engine.updateSignalExit('b4', 330, 'D4'); // -20 loss
    engine.updateSignalExit('b5', 340, 'D5'); // -10 loss
    engine.updateSignalExit('b6', 385, 'D6'); // +35 win

    const result = engine.runBacktest('c1');
    expect(result).toBeTruthy();
    expect(result!.totalSignals).toBe(6);
    expect(result!.winRate).toBe(0.6667);
    expect(result!.bestWin).toBe(40);
    expect(result!.worstLoss).toBe(-20);
    expect(result!.qualityGrade).toBeTruthy();
  });

  it('05: quality grades assign correctly', () => {
    // Create 10 winning signals with varied PnL for std dev
    const gains = [50, 45, 55, 48, 52, 47, 53, 49, 51, 46];
    for (let i = 0; i < 10; i++) {
      engine.recordSignal(makeSignal({ id: 'g' + i, entryPrice: 350 }));
      engine.updateSignalExit('g' + i, 350 + gains[i], 'D' + i);
    }
    const result = engine.runBacktest('c1');
    expect(result).toBeTruthy();
    expect(result!.winRate).toBe(1);
    expect(result!.sharpeRatio).toBeGreaterThan(0);
    expect(['A+', 'A'].includes(result!.qualityGrade)).toBe(true);
  });

  it('06: strategy backtest combines multiple creators', () => {
    engine.recordSignal(makeSignal({ id: 'sA1', creatorId: 'cA' }));
    engine.recordSignal(makeSignal({ id: 'sA2', creatorId: 'cA' }));
    engine.recordSignal(makeSignal({ id: 'sA3', creatorId: 'cA' }));
    engine.recordSignal(makeSignal({ id: 'sB1', creatorId: 'cB' }));
    engine.recordSignal(makeSignal({ id: 'sB2', creatorId: 'cB' }));
    engine.updateSignalExit('sA1', 370, 'D1');
    engine.updateSignalExit('sA2', 380, 'D2');
    engine.updateSignalExit('sA3', 360, 'D3');
    engine.updateSignalExit('sB1', 365, 'D4');
    engine.updateSignalExit('sB2', 375, 'D5');

    const sb = engine.runStrategyBacktest('strat-1', ['cA', 'cB']);
    expect(sb.signals.length).toBe(5);
    expect(sb.result.totalSignals).toBe(5);
    expect(sb.result.winRate).toBeGreaterThan(0);
  });

  it('07: ranking sorts strategies by composite score', () => {
    // Strategy 1 (good)
    for (let i = 1; i <= 6; i++) {
      engine.recordSignal(makeSignal({ id: 'r1-' + i, creatorId: 'rA', entryPrice: 350 }));
      engine.updateSignalExit('r1-' + i, 400, 'D' + i);
    }
    engine.runStrategyBacktest('good-strat', ['rA']);

    // Strategy 2 (poor)
    for (let i = 1; i <= 6; i++) {
      engine.recordSignal(makeSignal({ id: 'r2-' + i, creatorId: 'rB', entryPrice: 350 }));
      engine.updateSignalExit('r2-' + i, 340, 'D' + i); // losses
    }
    engine.runStrategyBacktest('poor-strat', ['rB']);

    const ranked = engine.rankStrategies();
    expect(ranked.length).toBeGreaterThanOrEqual(2);
    expect(ranked[0].comparisonRank).toBe(1);
    expect(ranked[0].strategyId).toBe('good-strat');
  });
});

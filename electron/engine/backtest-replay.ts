// ── Q59: Backtest Replay Engine ────────────────────────────────────────────────
// Historical backtest playback + Walk-forward replay + Strategy comparison replay
// Timeline visualization data + Trade animation frames + Performance milestones

import log from 'electron-log';

// ── Types ──────────────────────────────────────────────────────────────────

export interface BacktestTrade {
  id: string;
  timestamp: number;
  date: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  price: number;
  quantity: number;
  value: number;
  pnl: number;
  commission: number;
  slippage: number;
  strategyId?: string;
}

export interface BacktestFrame {
  timestamp: number;
  date: string;
  portfolioValue: number;
  cumulativePnL: number;
  dailyPnL: number;
  drawdown: number;
  trades: BacktestTrade[];
  signals: Array<{ type: string; symbol: string; strength: number; date: string }>;
  benchmarkValue: number;
}

export interface ReplayConfig {
  speed: '0.5x' | '1x' | '2x' | '5x' | '10x' | 'MAX';
  frameIntervalMs: number;
  showTrades: boolean;
  showSignals: boolean;
  showBenchmark: boolean;
  highlightDrawdowns: boolean;
  pauseOnTrade: boolean;
  pauseOnDrawdown: boolean;
  drawdownThreshold: number; // Pause when DD > this %
}

export interface ReplaySession {
  sessionId: string;
  name: string;
  config: ReplayConfig;
  frames: BacktestFrame[];
  tradeList: BacktestTrade[];
  milestones: Array<{ date: string; event: string; description: string; frameIdx: number }>;
  durationMs: number;
  stats: {
    totalFrames: number;
    totalTrades: number;
    startDate: string;
    endDate: string;
    nDays: number;
  };
}

export interface BacktestComparisonResult {
  sessions: ReplaySession[];
  comparison: Array<{
    metric: string;
    values: number[];
    best: string;
    worst: string;
    spread: number;
  }>;
  rankings: Array<{ sessionId: string; score: number; rank: number }>;
  recommendations: string[];
}

// ── Backtest Replay Engine ───────────────────────────────────────────────

export class BacktestReplayEngine {
  constructor() {
    log.info('[BacktestReplayEngine] Initialized');
  }

  // ── Generate Replay Session ────────────────────────────────────────

  generateReplay(
    sessionId: string,
    name: string,
    frames: Array<{
      date: string;
      portfolioValue: number;
      dailyReturn: number;
      trades?: BacktestTrade[];
      signals?: BacktestFrame['signals'];
    }>,
    benchmark?: number[],  // Benchmark values (e.g. HSI returns)
    config: Partial<ReplayConfig> = {}
  ): ReplaySession {
    log.info(`[BacktestReplay] Generating replay ${name}, ${frames.length} frames`);

    const cfg: ReplayConfig = {
      speed: config.speed ?? '1x',
      frameIntervalMs: config.frameIntervalMs ?? 500,
      showTrades: config.showTrades ?? true,
      showSignals: config.showSignals ?? true,
      showBenchmark: config.showBenchmark ?? true,
      highlightDrawdowns: config.highlightDrawdowns ?? true,
      pauseOnTrade: config.pauseOnTrade ?? false,
      pauseOnDrawdown: config.pauseOnDrawdown ?? false,
      drawdownThreshold: config.drawdownThreshold ?? 10,
      ...config,
    };

    const speedMultipliers: Record<string, number> = {
      '0.5x': 2, '1x': 1, '2x': 0.5, '5x': 0.2, '10x': 0.1, 'MAX': 0,
    };
    const frameMs = cfg.frameIntervalMs * (speedMultipliers[cfg.speed] ?? 1);
    const durationMs = frames.length * frameMs;

    // Build frames
    let cumulativePnL = 0;
    let peak = frames[0]?.portfolioValue ?? 0;
    const allTrades: BacktestTrade[] = [];

    const replayFrames: BacktestFrame[] = frames.map((f, i) => {
      cumulativePnL += f.dailyReturn * (frames[i - 1]?.portfolioValue ?? f.portfolioValue);
      peak = Math.max(peak, f.portfolioValue);
      const drawdown = (peak - f.portfolioValue) / peak * 100;

      const frameTrades = f.trades ?? [];
      allTrades.push(...frameTrades);

      return {
        timestamp: new Date(f.date).getTime(),
        date: f.date,
        portfolioValue: Math.round(f.portfolioValue * 100) / 100,
        cumulativePnL: Math.round(cumulativePnL * 100) / 100,
        dailyPnL: Math.round(f.dailyReturn * 10000) / 100,
        drawdown: Math.round(drawdown * 100) / 100,
        trades: frameTrades,
        signals: f.signals ?? [],
        benchmarkValue: benchmark?.[i] ?? f.portfolioValue,
      };
    });

    // Milestones
    const milestones: ReplaySession['milestones'] = [];

    // Find milestone events
    let maxDD = 0, maxDDDate = '';
    let maxWin = 0, maxWinDate = '';
    let totalTrades = 0;

    for (const frame of replayFrames) {
      totalTrades += frame.trades.length;

      if (frame.drawdown > maxDD) {
        maxDD = frame.drawdown;
        maxDDDate = frame.date;
      }
      if (frame.cumulativePnL > maxWin) {
        maxWin = frame.cumulativePnL;
        maxWinDate = frame.date;
      }
    }

    if (maxDD > 5) milestones.push({
      date: maxDDDate, event: 'MAX_DRAWDOWN', description: `Peak drawdown ${maxDD.toFixed(1)}%`, frameIdx: replayFrames.findIndex(f => f.date === maxDDDate)
    });
    if (maxWin > 0) milestones.push({
      date: maxWinDate, event: 'MAX_PROFIT', description: `Max profit ${maxWin.toFixed(1)}%`, frameIdx: replayFrames.findIndex(f => f.date === maxWinDate)
    });

    // Best day
    const bestDay = [...replayFrames].sort((a, b) => b.dailyPnL - a.dailyPnL)[0];
    if (bestDay && bestDay.dailyPnL > 0) milestones.push({
      date: bestDay.date, event: 'BEST_DAY', description: `Best day +${bestDay.dailyPnL.toFixed(2)}%`, frameIdx: replayFrames.indexOf(bestDay)
    });

    // Worst day
    const worstDay = [...replayFrames].sort((a, b) => a.dailyPnL - b.dailyPnL)[0];
    if (worstDay && worstDay.dailyPnL < 0) milestones.push({
      date: worstDay.date, event: 'WORST_DAY', description: `Worst day ${worstDay.dailyPnL.toFixed(2)}%`, frameIdx: replayFrames.indexOf(worstDay)
    });

    // Filter out -1 frameIdx
    milestones.forEach(m => { if (m.frameIdx < 0) m.frameIdx = 0; });
    milestones.sort((a, b) => a.frameIdx - b.frameIdx);

    return {
      sessionId,
      name,
      config: cfg,
      frames: replayFrames,
      tradeList: allTrades,
      milestones,
      durationMs,
      stats: {
        totalFrames: replayFrames.length,
        totalTrades: allTrades.length,
        startDate: replayFrames[0]?.date ?? '',
        endDate: replayFrames[replayFrames.length - 1]?.date ?? '',
        nDays: replayFrames.length,
      },
    };
  }

  // ── Walk-Forward Replay ────────────────────────────────────────────

  generateWalkForwardReplay(
    inSampleFrames: BacktestFrame[],
    outOfSampleFrames: BacktestFrame[],
    oosStartDate: string
  ): { inSample: ReplaySession; outOfSample: ReplaySession } {
    const inSample = this.generateReplay('wf_is', 'In-Sample', inSampleFrames);
    const outOfSample = this.generateReplay('wf_oos', 'Out-of-Sample', outOfSampleFrames);

    // Mark OOS start milestone
    outOfSample.milestones.unshift({
      date: oosStartDate,
      event: 'OOS_START',
      description: 'Out-of-sample period begins',
      frameIdx: 0,
    });

    return { inSample, outOfSample };
  }

  // ── Compare Sessions ──────────────────────────────────────────────

  compare(sessions: ReplaySession[]): BacktestComparisonResult {
    if (sessions.length === 0) return { sessions: [], comparison: [], rankings: [], recommendations: [] };

    const metrics = [
      { key: 'totalReturn', label: 'Total Return', higherBetter: true },
      { key: 'sharpe', label: 'Sharpe Ratio', higherBetter: true },
      { key: 'maxDrawdown', label: 'Max Drawdown', higherBetter: false },
      { key: 'winRate', label: 'Win Rate', higherBetter: true },
      { key: 'nTrades', label: 'Trade Count', higherBetter: false },
      { key: 'avgSlippage', label: 'Avg Slippage', higherBetter: false },
    ];

    const comparison = metrics.map(m => {
      const values = sessions.map(s => {
        if (m.key === 'totalReturn') return s.frames[s.frames.length - 1]?.cumulativePnL ?? 0;
        if (m.key === 'maxDrawdown') return Math.min(...s.frames.map(f => -f.drawdown), 0);
        if (m.key === 'nTrades') return s.tradeList.length;
        if (m.key === 'sharpe') {
          const rets = s.frames.map(f => f.dailyPnL / 100);
          const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
          const std = Math.sqrt(rets.reduce((a, b) => a + (b - mean) ** 2, 0) / rets.length);
          return std > 0 ? (mean / std) * Math.sqrt(252) : 0;
        }
        if (m.key === 'winRate') {
          const winners = s.tradeList.filter(t => t.pnl > 0).length;
          return s.tradeList.length > 0 ? winners / s.tradeList.length : 0;
        }
        if (m.key === 'avgSlippage') {
          return s.tradeList.length > 0
            ? s.tradeList.reduce((a, t) => a + Math.abs(t.slippage), 0) / s.tradeList.length
            : 0;
        }
        return 0;
      });

      const bestIdx = m.higherBetter ? values.indexOf(Math.max(...values)) : values.indexOf(Math.min(...values));
      const worstIdx = m.higherBetter ? values.indexOf(Math.min(...values)) : values.indexOf(Math.max(...values));

      return {
        metric: m.label,
        values: values.map(v => Math.round(v * 100) / 100),
        best: sessions[bestIdx]?.sessionId ?? 'N/A',
        worst: sessions[worstIdx]?.sessionId ?? 'N/A',
        spread: Math.round((Math.max(...values) - Math.min(...values)) * 100) / 100,
      };
    });

    const rankings = sessions.map(s => ({
      sessionId: s.sessionId,
      score: 0,
      rank: 0,
    }));

    const recommendations: string[] = [];
    const bestSession = [...sessions].sort((a, b) => {
      const aRet = a.frames[a.frames.length - 1]?.cumulativePnL ?? 0;
      const bRet = b.frames[b.frames.length - 1]?.cumulativePnL ?? 0;
      return bRet - aRet;
    })[0];

    if (bestSession) recommendations.push(`Best overall: ${bestSession.name}`);
    const overfitting = sessions.filter(s => s.name.includes('IS'));
    if (overfitting.length > 0) recommendations.push('Check IS vs OOS gap for overfitting signals');

    return { sessions, comparison, rankings, recommendations };
  }
}

export default BacktestReplayEngine;
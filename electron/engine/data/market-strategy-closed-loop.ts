/**
 * R260 P2-08: 行情→策略一环闭环 (MarketStrategyClosedLoop)
 * 
 * 从行情观察 → 策略信号生成 → 回测验证 → 优化反馈 的完整闭环引擎
 * 
 * 功能:
 *   1. 行情观察矩阵 (多市场/多周期/多维指标)
 *   2. 自动匹配策略模板 (趋势/反转/突破/套利)
 *   3. 策略信号生成 (入场/出场/止损/仓位)
 *   4. 闭环反馈循环 (观察→信号→评估→优化→再观察)
 *   5. 闭环统计数据 + 中英文报告
 * 
 * 上游: binance-api-bridge, eastmoney-fetcher, yahoo-engine-bridge, investing-rss-fetcher
 * 下游: strategy-templates, strategy-runner, factor signals
 */

import { createHash } from 'crypto';

// ── Types ──────────────────────────────────────────────────────────────────

export type MarketPhase = 'bull' | 'bear' | 'sideways' | 'high_volatility' | 'recovery' | 'correction';

export type StrategyArchetype = 'trend_following' | 'mean_reversion' | 'breakout' | 'arbitrage' | 'momentum' | 'grid';

export interface Observation {
  obsId: string;
  symbol: string;
  timestamp: number;
  price: number;
  change1d: number;
  change5d: number;
  change20d: number;
  volatility14d: number;
  volumeRatio: number;
  rsi14: number;
  macdHist: number;
  bbPosition: number;     // 0-1 where in Bollinger Bands
  ma50Distance: number;   // % from 50MA
  ma200Distance: number;  // % from 200MA
  marketPhase: MarketPhase;
}

export interface ClosedLoopSignal {
  signalId: string;
  symbol: string;
  strategyArchetype: StrategyArchetype;
  direction: 'long' | 'short' | 'neutral';
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  positionSize: number;   // 0-1
  confidence: number;     // 0-1
  reasons: string[];
  reasonsCn: string[];
  generatedAt: number;
}

export interface LoopIteration {
  iteration: number;
  cycle: 'observe' | 'match' | 'signal' | 'evaluate' | 'optimize';
  observations: Observation[];
  signals: ClosedLoopSignal[];
  metrics: {
    totalSignals: number;
    avgConfidence: number;
    signalDistribution: Record<string, number>;
    dominantArchetype: StrategyArchetype | null;
  };
  improvements: string[];
  timestamp: number;
}

export interface LoopSummary {
  summaryId: string;
  totalIterations: number;
  totalSignals: number;
  totalObservations: number;
  convergenceScore: number;   // 0-1, how stable the loop has become
  topArchetypes: StrategyArchetype[];
  summaryEn: string;
  summaryCn: string;
  generatedAt: number;
}

// ── Strategy matching rules ────────────────────────────────────────────────

interface MatchRule {
  archetype: StrategyArchetype;
  conditions: Array<(obs: Observation) => boolean>;
  priority: number;
}

const MATCH_RULES: MatchRule[] = [
  {
    archetype: 'trend_following',
    conditions: [
      o => o.marketPhase === 'bull' && o.ma50Distance > 2,
      o => o.macdHist > 0 && o.rsi14 > 50,
      o => o.change5d > 0,
    ],
    priority: 10,
  },
  {
    archetype: 'mean_reversion',
    conditions: [
      o => o.rsi14 < 30 || o.rsi14 > 70,
      o => Math.abs(o.ma50Distance) > 5,
      o => o.bbPosition < 0.1 || o.bbPosition > 0.9,
    ],
    priority: 8,
  },
  {
    archetype: 'breakout',
    conditions: [
      o => o.volatility14d > 3,
      o => o.volumeRatio > 2,
      o => o.marketPhase === 'high_volatility',
    ],
    priority: 7,
  },
  {
    archetype: 'momentum',
    conditions: [
      o => Math.abs(o.change1d) > 3,
      o => o.volumeRatio > 1.5,
      o => o.rsi14 > 60 || o.rsi14 < 40,
    ],
    priority: 6,
  },
  {
    archetype: 'arbitrage',
    conditions: [
      o => o.marketPhase === 'sideways',
      o => o.volatility14d < 1.5,
      o => o.change5d > -1 && o.change5d < 1,
    ],
    priority: 4,
  },
  {
    archetype: 'grid',
    conditions: [
      o => o.marketPhase === 'sideways' && o.volatility14d > 1,
      o => o.bbPosition > 0.2 && o.bbPosition < 0.8,
      o => Math.abs(o.change1d) < 2,
    ],
    priority: 3,
  },
];

// ── Default config ─────────────────────────────────────────────────────────

const DEFAULT_CONFIG = {
  maxIterations: 100,
  minConfidence: 0.3,
  positionSizeBase: 0.1,
  stopLossMultiplier: 2,    // × ATR for stop
  takeProfitMultiplier: 3,  // × ATR for TP
  convergenceThreshold: 0.85,
  staleThresholdMs: 24 * 60 * 60 * 1000, // 24h
};

// ═══════════════════════════════════════════════════════════════════════════
// MarketStrategyClosedLoop
// ═══════════════════════════════════════════════════════════════════════════

export class MarketStrategyClosedLoop {
  private observations: Map<string, Observation[]> = new Map();
  private signals: ClosedLoopSignal[] = [];
  private iterations: LoopIteration[] = [];
  private config = { ...DEFAULT_CONFIG };
  private loopActive = false;
  private convergenceScore = 0;
  private stats_ = { totalObs: 0, totalSignals: 0, totalIterations: 0 };

  constructor(config?: Partial<typeof DEFAULT_CONFIG>) {
    if (config) Object.assign(this.config, config);
  }

  // ── Public API: Observe ─────────────────────────────────────────────────

  /**
   * Feed an observation into the loop.
   * Returns the full loop context for the current iteration.
   */
  observe(params: {
    symbol: string;
    price: number;
    change1d: number;
    change5d: number;
    change20d: number;
    volatility14d: number;
    volumeRatio: number;
    rsi14: number;
    macdHist: number;
    bbPosition: number;
    ma50Distance: number;
    ma200Distance: number;
  }): { obs: Observation; matchedArchetypes: StrategyArchetype[] } {
    const marketPhase = this._classifyPhase(params);

    const obs: Observation = {
      obsId: `obs:${params.symbol}:${Date.now()}`,
      symbol: params.symbol,
      timestamp: Date.now(),
      ...params,
      marketPhase,
    };

    const symbolObs = this.observations.get(params.symbol) ?? [];
    symbolObs.push(obs);
    this.observations.set(params.symbol, symbolObs);
    this.stats_.totalObs++;

    // Prune stale observations
    if (symbolObs.length > 500) symbolObs.shift();

    // Match strategies
    const matched = this._matchStrategies(obs);

    return { obs, matchedArchetypes: matched };
  }

  // ── Public API: Generate Signals ────────────────────────────────────────

  /**
   * Generate a closed-loop signal from an observation.
   */
  generateSignal(
    obs: Observation,
    archetype: StrategyArchetype,
    direction: 'long' | 'short',
  ): ClosedLoopSignal {
    const atr = obs.price * obs.volatility14d / 100;
    const slDistance = atr * this.config.stopLossMultiplier;
    const tpDistance = atr * this.config.takeProfitMultiplier;

    const entryPrice = obs.price;
    const stopLoss = direction === 'long'
      ? entryPrice - slDistance
      : entryPrice + slDistance;
    const takeProfit = direction === 'long'
      ? entryPrice + tpDistance
      : entryPrice - tpDistance;

    const confidence = this._calcConfidence(obs, archetype);
    const positionSize = this.config.positionSizeBase * confidence;

    const reasons: string[] = [];
    const reasonsCn: string[] = [];

    if (obs.marketPhase === 'bull') {
      reasons.push('Bull market phase');
      reasonsCn.push('牛市阶段');
    } else if (obs.marketPhase === 'bear') {
      reasons.push('Bear market phase');
      reasonsCn.push('熊市阶段');
    }

    if (obs.rsi14 < 30) {
      reasons.push('RSI oversold');
      reasonsCn.push('RSI超卖');
    } else if (obs.rsi14 > 70) {
      reasons.push('RSI overbought');
      reasonsCn.push('RSI超买');
    }

    if (obs.volumeRatio > 2) {
      reasons.push('Volume spike');
      reasonsCn.push('成交量突增');
    }

    if (Math.abs(obs.ma50Distance) > 5) {
      reasons.push(`MA50 deviation ${obs.ma50Distance.toFixed(1)}%`);
      reasonsCn.push(`MA50偏离${obs.ma50Distance.toFixed(1)}%`);
    }

    const signal: ClosedLoopSignal = {
      signalId: `clsig:${obs.symbol}:${archetype}:${Date.now()}:${this._hash(obs.symbol + archetype).toString(36).slice(0, 6)}`,
      symbol: obs.symbol,
      strategyArchetype: archetype,
      direction: confidence >= this.config.minConfidence ? direction : 'neutral',
      entryPrice,
      stopLoss,
      takeProfit,
      positionSize,
      confidence: Math.round(confidence * 100) / 100,
      reasons,
      reasonsCn,
      generatedAt: Date.now(),
    };

    this.signals.push(signal);
    if (this.signals.length > 500) this.signals.shift();
    this.stats_.totalSignals++;

    return signal;
  }

  // ── Public API: Loop Iteration ──────────────────────────────────────────

  /**
   * Run one complete loop iteration: observe → match → signal → evaluate
   */
  runIteration(obsParams: Array<{
    symbol: string; price: number; change1d: number; change5d: number;
    change20d: number; volatility14d: number; volumeRatio: number;
    rsi14: number; macdHist: number; bbPosition: number;
    ma50Distance: number; ma200Distance: number;
  }>): LoopIteration {
    this.loopActive = true;

    // Phase 1: Observe
    const phase1Results = obsParams.map(p => this.observe(p));
    const observations = phase1Results.map(r => r.obs);

    // Phase 2: Match → Signal
    const signals: ClosedLoopSignal[] = [];
    for (const { obs, matchedArchetypes } of phase1Results) {
      for (const archetype of matchedArchetypes) {
        const direction = obs.change1d > 0 ? 'long' : 'short';
        const sig = this.generateSignal(obs, archetype, direction);
        if (sig.direction !== 'neutral') signals.push(sig);
      }
    }

    const signalDist: Record<string, number> = {};
    for (const s of signals) {
      signalDist[s.strategyArchetype] = (signalDist[s.strategyArchetype] ?? 0) + 1;
    }

    const avgConf = signals.length > 0
      ? signals.reduce((s, sig) => s + sig.confidence, 0) / signals.length
      : 0;

    const dominantArch = Object.entries(signalDist).sort((a, b) => b[1] - a[1])[0]?.[0] as StrategyArchetype | undefined ?? null;

    // Phase 3: Evaluate → improvements
    const improvements = this._deriveImprovements(signals, observations);

    const iteration: LoopIteration = {
      iteration: this.stats_.totalIterations + 1,
      cycle: 'signal',
      observations,
      signals,
      metrics: {
        totalSignals: signals.length,
        avgConfidence: Math.round(avgConf * 100) / 100,
        signalDistribution: signalDist,
        dominantArchetype: dominantArch,
      },
      improvements,
      timestamp: Date.now(),
    };

    this.iterations.push(iteration);
    this.stats_.totalIterations++;
    if (this.iterations.length > 200) this.iterations.shift();

    // Update convergence
    this.convergenceScore = this._calcConvergence();

    return iteration;
  }

  // ── Public API: Evaluate & Optimize ─────────────────────────────────────

  /**
   * Evaluate signal performance against actual outcome.
   * Returns feedback for loop optimization.
   */
  evaluate(signalId: string, actualPrice: number, isWin: boolean): {
    feedback: string;
    feedbackCn: string;
    confidenceAdjustment: number;
  } {
    const signal = this.signals.find(s => s.signalId === signalId);
    if (!signal) {
      return { feedback: 'Signal not found', feedbackCn: '信号未找到', confidenceAdjustment: 0 };
    }

    const confAdj = isWin ? 0.05 : -0.08;
    const feedback = isWin
      ? `Signal ${signal.strategyArchetype} on ${signal.symbol} was correct`
      : `Signal ${signal.strategyArchetype} on ${signal.symbol} was wrong, adjusting confidence`;
    const feedbackCn = isWin
      ? `${signal.symbol} ${signal.strategyArchetype} 信号正确`
      : `${signal.symbol} ${signal.strategyArchetype} 信号错误，调整置信度`;

    return { feedback, feedbackCn, confidenceAdjustment: Math.round(confAdj * 100) / 100 };
  }

  /**
   * Generate loop summary.
   */
  generateSummary(): LoopSummary {
    const topArchetypes: StrategyArchetype[] = [];
    const archCount: Record<string, number> = {};
    for (const sig of this.signals) {
      archCount[sig.strategyArchetype] = (archCount[sig.strategyArchetype] ?? 0) + 1;
    }
    const sorted = Object.entries(archCount).sort((a, b) => b[1] - a[1]);
    for (const [arch] of sorted.slice(0, 3)) {
      topArchetypes.push(arch as StrategyArchetype);
    }

    const summaryEn = this.stats_.totalIterations > 0
      ? `Closed loop completed ${this.stats_.totalIterations} iterations, ${this.stats_.totalSignals} signals generated, convergence ${(this.convergenceScore * 100).toFixed(1)}%`
      : 'No iterations yet';

    const summaryCn = this.stats_.totalIterations > 0
      ? `闭环已完成${this.stats_.totalIterations}轮迭代，生成${this.stats_.totalSignals}个信号，收敛度${(this.convergenceScore * 100).toFixed(1)}%`
      : '尚未迭代';

    return {
      summaryId: `loopsum:${Date.now()}`,
      totalIterations: this.stats_.totalIterations,
      totalSignals: this.stats_.totalSignals,
      totalObservations: this.stats_.totalObs,
      convergenceScore: Math.round(this.convergenceScore * 100) / 100,
      topArchetypes,
      summaryEn,
      summaryCn,
      generatedAt: Date.now(),
    };
  }

  // ── Public API: Query ───────────────────────────────────────────────────

  /** Get the convergence score */
  getConvergence(): number { return this.convergenceScore; }

  /** Get all iterations */
  getIterations(limit = 20): LoopIteration[] {
    return this.iterations.slice(-limit).reverse();
  }

  /** Get signals for a symbol */
  getSignals(symbol?: string, limit = 50): ClosedLoopSignal[] {
    let results = this.signals;
    if (symbol) results = results.filter(s => s.symbol === symbol);
    return results.slice(-limit).reverse();
  }

  /** Get observation history */
  getObservations(symbol: string, limit = 100): Observation[] {
    const obs = this.observations.get(symbol) ?? [];
    return obs.slice(-limit).reverse();
  }

  /** Get matched archetypes for current market conditions */
  getActiveArchetypes(symbol: string): StrategyArchetype[] {
    const obs = this.observations.get(symbol);
    if (!obs || obs.length === 0) return [];
    return this._matchStrategies(obs[obs.length - 1]);
  }

  /** Is the loop actively running */
  isActive(): boolean { return this.loopActive; }

  /** Get stats */
  getStats() { return { ...this.stats_, convergenceScore: this.convergenceScore }; }

  /** Reset */
  reset(): void {
    this.observations.clear();
    this.signals = [];
    this.iterations = [];
    this.stats_ = { totalObs: 0, totalSignals: 0, totalIterations: 0 };
    this.loopActive = false;
    this.convergenceScore = 0;
  }

  // ── Private: Phase Classification ────────────────────────────────────────

  private _classifyPhase(params: { change20d: number; volatility14d: number; rsi14: number }): MarketPhase {
    const { change20d, volatility14d, rsi14 } = params;

    if (volatility14d > 5) return 'high_volatility';
    if (change20d > 5) return 'bull';
    if (change20d < -5) return 'bear';
    if (change20d > -2 && change20d < 2) return 'sideways';
    if (rsi14 < 45 && change20d > 0) return 'recovery';
    if (rsi14 > 55 && change20d < 0) return 'correction';

    return 'sideways';
  }

  // ── Private: Strategy Matching ───────────────────────────────────────────

  private _matchStrategies(obs: Observation): StrategyArchetype[] {
    const matched: Array<{ arch: StrategyArchetype; priority: number }> = [];

    for (const rule of MATCH_RULES) {
      const allMatch = rule.conditions.every(cond => cond(obs));
      if (allMatch) {
        matched.push({ arch: rule.archetype, priority: rule.priority });
      }
    }

    return matched
      .sort((a, b) => b.priority - a.priority)
      .map(m => m.arch);
  }

  // ── Private: Confidence Calculation ──────────────────────────────────────

  private _calcConfidence(obs: Observation, archetype: StrategyArchetype): number {
    let score = 0.5; // baseline

    // Signal strength factors
    if (obs.rsi14 < 25 || obs.rsi14 > 75) score += 0.15;
    if (obs.volumeRatio > 2) score += 0.1;
    if (Math.abs(obs.change1d) > 3) score += 0.1;

    // Archetype-specific adjustments
    switch (archetype) {
      case 'trend_following':
        if (obs.marketPhase === 'bull' && obs.ma50Distance > 3) score += 0.1;
        break;
      case 'mean_reversion':
        if (obs.bbPosition < 0.1 || obs.bbPosition > 0.9) score += 0.15;
        break;
      case 'breakout':
        if (obs.volatility14d > 4) score += 0.1;
        break;
      case 'momentum':
        if (Math.abs(obs.change5d) > 5) score += 0.1;
        break;
      case 'arbitrage':
      case 'grid':
        if (obs.marketPhase === 'sideways') score += 0.05;
        break;
    }

    return Math.max(0, Math.min(1, score));
  }

  // ── Private: Convergence ─────────────────────────────────────────────────

  private _calcConvergence(): number {
    if (this.iterations.length < 5) return 0;

    const recent = this.iterations.slice(-5);
    const avgSignals = recent.reduce((s, i) => s + i.metrics.totalSignals, 0) / recent.length;

    if (avgSignals === 0) return 1; // no signals = stable

    // Check if signal count is stabilizing
    const variance = recent.reduce((s, i) => {
      const diff = i.metrics.totalSignals - avgSignals;
      return s + diff * diff;
    }, 0) / recent.length;

    // Also check dominant archetype stability
    const arches = recent.map(i => i.metrics.dominantArchetype);
    const uniqueArches = new Set(arches).size;

    const signalStability = Math.max(0, 1 - Math.sqrt(variance) / avgSignals);
    const archStability = 1 / Math.max(uniqueArches, 1);

    return Math.round((signalStability * 0.6 + archStability * 0.4) * 100) / 100;
  }

  // ── Private: Improvements ────────────────────────────────────────────────

  private _deriveImprovements(signals: ClosedLoopSignal[], observations: Observation[]): string[] {
    const improvements: string[] = [];

    if (signals.length === 0) {
      improvements.push('No signals generated — consider broadening strategy matching criteria');
      return improvements;
    }

    const avgConf = signals.reduce((s, sig) => s + sig.confidence, 0) / signals.length;
    if (avgConf < 0.4) {
      improvements.push('Low average confidence — review observation quality or tighten matching rules');
    }

    const neutralCount = signals.filter(s => s.direction === 'neutral').length;
    if (neutralCount > signals.length * 0.5) {
      improvements.push('High neutral rate — adjust confidence threshold or market phase detection');
    }

    return improvements;
  }

  private _hash(input: string): number {
    const h = createHash('sha256').update(input).digest('hex');
    return parseInt(h.slice(0, 8), 16);
  }
}

export const marketStrategyClosedLoop = new MarketStrategyClosedLoop();

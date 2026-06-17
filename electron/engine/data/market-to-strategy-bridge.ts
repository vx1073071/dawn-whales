/**
 * R255 AI-06: 行情→策略桥接 (MarketToStrategyBridge)
 * 
 * QUANT MOO 体验完善 — 实时行情数据转化为可执行策略信号
 * 
 * 功能:
 *   1. 行情信号提取 (突破/回调/放量/异动 → 策略信号)
 *   2. 多因子条件判断 (技术指标 + 资金流向 + 情绪 + 宏观)
 *   3. 策略模板匹配 (autofit: 行情特征 → 最佳策略模板)
 *   4. 进入/退出建议 (entry price range + stop loss + take profit)
 *   5. 回测前置 (信号历史有效性验证)
 */

import { createHash } from 'crypto';

// ── Types ──────────────────────────────────────────────────────────────────

export type MarketSignalType = 'breakout' | 'pullback' | 'volume_surge' | 'momentum_shift' | 'sector_rotation' | 'macro_catalyst';

export interface MarketObservation {
  symbol: string;
  market: 'US' | 'HK' | 'A' | 'CRYPTO';
  price: number;
  changePercent: number;
  volumeRatio: number;         // vs 20-day avg
  timestamp: number;
  signals: MarketSignalType[];
}

export interface StrategySignal {
  signalId: string;
  symbol: string;
  strategyType: StrategyType;
  signalType: 'entry' | 'exit' | 'hold';
  confidence: number;          // 0-1
  entryPrice: number;
  entryRange: { low: number; high: number };
  stopLoss: number;
  takeProfit: number;
  riskRewardRatio: number;
  timeHorizon: 'intraday' | 'swing' | 'position';
  stopType: 'fixed' | 'atr' | 'trailing';
  trailingStop?: number;
  trailingActivationPct?: number;  // profit % to activate trailing stop
  atrValue: number;
  reasoningItems: string[];
  reasoningItemsCn: string[];
  timestamp: number;
}

export type StrategyType = 'momentum_breakout' | 'mean_reversion' | 'trend_following' | 'volatility_arbitrage' | 'sector_momentum' | 'event_driven' | 'grid_trading' | 'scalping';

export interface StrategyMatch {
  strategyType: StrategyType;
  matchScore: number;          // 0-1
  suitability: 'excellent' | 'good' | 'fair' | 'poor';
  templateId: string;
  parameters: Record<string, number>;
  description: string;
  descriptionCn: string;
}

export interface MarketSnapshot {
  timestamp: number;
  indices: Array<{ symbol: string; change: number }>;
  sectors: Array<{ name: string; change: number }>;
  sentiment: number;           // -1 to 1
  vixProxy: number;            // proxy for volatility
  macroEvents: string[];
}

// ═══════════════════════════════════════════════════════════════════════════
// MarketToStrategyBridge
// ═══════════════════════════════════════════════════════════════════════════

export class MarketToStrategyBridge {
  private signals: StrategySignal[] = [];
  private totalGenerated = 0;

  // ═══════════════════════════════════════════════════════════════════════
  // 1. 行情→信号转换
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Observe market data and detect tradable signals.
   */
  observe(obs: MarketObservation): MarketSignalType[] {
    const signals: MarketSignalType[] = [];
    const absPct = Math.abs(obs.changePercent);

    // Breakout detection
    if (absPct > 5 && obs.volumeRatio > 2) {
      signals.push('breakout');
    }

    // Pullback detection (small move against trend on high volume)
    if (absPct < 2 && obs.volumeRatio > 1.5 && obs.changePercent < 0) {
      signals.push('pullback');
    }

    // Volume surge
    if (obs.volumeRatio > 3) {
      signals.push('volume_surge');
    }

    // Momentum shift
    if (absPct > 3) {
      signals.push('momentum_shift');
    }

    return signals;
  }

  /**
   * Convert market observation into a strategy signal.
   */
  generateSignal(obs: MarketObservation, snapshot?: MarketSnapshot): StrategySignal {
    const signals = obs.signals.length > 0 ? obs.signals : this.observe(obs);
    const bestMatch = this._matchStrategy(obs, signals, snapshot);

    const direction = obs.changePercent > 0 ? 1 : -1;
    const entryPrice = obs.price;
    const volatility = Math.abs(obs.changePercent) / 100 * 2;

    // ── ATR-based dynamic stop loss ──
    // Estimate ATR from the day's change range (3x the single-period volatility)
    const atrEstimate = obs.price * Math.abs(obs.changePercent) / 100;
    // ATR_multiplier adjusts based on strategy type
    const atrMultiplier = this._getATRMultiplier(bestMatch.strategyType, bestMatch.matchScore);
    const stopDistanceATR = atrEstimate * atrMultiplier;

    // Stop type selection: trailing for high-confidence trends, ATR for volatile, fixed for others
    let stopType: StrategySignal['stopType'] = 'fixed';
    let trailingStop: number | undefined;
    let trailingActivationPct: number | undefined;

    if (bestMatch.matchScore > 0.7 && bestMatch.strategyType === 'momentum_breakout') {
      stopType = 'trailing';
      trailingActivationPct = 0.03; // activate trailing stop after 3% profit
    } else if (bestMatch.strategyType === 'volatility_arbitrage' || obs.volumeRatio > 3) {
      stopType = 'atr';
    }

    const stopLoss = direction > 0
      ? Math.round((entryPrice - stopDistanceATR) * 100) / 100
      : Math.round((entryPrice + stopDistanceATR) * 100) / 100;

    if (stopType === 'trailing') {
      trailingStop = stopLoss; // initial trailing stop = initial stop loss
    }

    const takeProfit = direction > 0
      ? Math.round(entryPrice * (1 + volatility * 3) * 100) / 100
      : Math.round(entryPrice * (1 - volatility * 3) * 100) / 100;

    const risk = Math.abs(entryPrice - stopLoss);
    const reward = Math.abs(takeProfit - entryPrice);
    const riskRewardRatio = risk > 0 ? Math.round(reward / risk * 100) / 100 : 0;

    const { reasoning, reasoningCn } = this._generateReasoning(obs, signals, bestMatch);

    const signal: StrategySignal = {
      signalId: `sig:${obs.symbol}:${Date.now()}:${this._hash(obs.changePercent.toString()).toString(36).slice(0, 4)}`,
      symbol: obs.symbol,
      strategyType: bestMatch.strategyType,
      signalType,
      confidence: bestMatch.matchScore,
      entryPrice,
      entryRange: { low: Math.round(entryPrice * 0.99 * 100) / 100, high: Math.round(entryPrice * 1.01 * 100) / 100 },
      stopLoss,
      takeProfit,
      riskRewardRatio,
      timeHorizon: obs.volumeRatio > 3 ? 'intraday' : bestMatch.matchScore > 0.7 ? 'swing' : 'position',
      reasoningItems: reasoning,
      reasoningItemsCn: reasoningCn,
      timestamp: Date.now(),
    };

    this.signals.push(signal);
    this.totalGenerated++;
    return signal;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 2. 策略模板匹配
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Match a market observation to the best strategy template.
   */
  matchStrategies(obs: MarketObservation): StrategyMatch[] {
    const absPct = Math.abs(obs.changePercent);
    const direction = obs.changePercent > 0 ? 'up' : 'down';

    const templates: Array<{
      type: StrategyType;
      templateId: string;
      params: Record<string, number>;
      idealConditions: (absPct: number, volRatio: number, dir: string) => number;
    }> = [
      {
        type: 'momentum_breakout',
        templateId: 'strategies/momentum_breakout',
        params: { lookback: 20, threshold: 0.05, volumeMultiplier: 2 },
        idealConditions: (p, v, d) => (p > 4 ? 0.8 : p > 2 ? 0.5 : 0.2) + (v > 2 ? 0.2 : 0),
      },
      {
        type: 'mean_reversion',
        templateId: 'strategies/mean_reversion',
        params: { lookback: 50, entryZ: -2, exitZ: 1 },
        idealConditions: (p, v, d) => (p < 3 ? 0.7 : 0.3) + (v < 2 ? 0.15 : 0) + (d === 'down' ? 0.1 : 0),
      },
      {
        type: 'trend_following',
        templateId: 'strategies/trend_following',
        params: { smaFast: 20, smaSlow: 50, confirmationBars: 3 },
        idealConditions: (p, v, d) => (p > 2 ? 0.6 : 0.3) + (v > 1.5 ? 0.2 : 0) + (d === 'up' ? 0.1 : 0),
      },
      {
        type: 'volatility_arbitrage',
        templateId: 'strategies/volatility_arbitrage',
        params: { ivPercentile: 80, spreadThreshold: 0.02 },
        idealConditions: (p, v, d) => (p > 5 ? 0.8 : p > 3 ? 0.5 : 0.2) + (v > 3 ? 0.2 : 0),
      },
      {
        type: 'sector_momentum',
        templateId: 'strategies/sector_momentum',
        params: { sectorLookback: 5, topN: 3 },
        idealConditions: (p, v, d) => (p > 1 ? 0.6 : 0.3) + (d === 'up' ? 0.15 : 0),
      },
      {
        type: 'event_driven',
        templateId: 'strategies/event_driven',
        params: { preEventMinutes: 30, postEventMinutes: 60, confirmationDelay: 5 },
        idealConditions: (p, v, d) => (p > 2 ? 0.5 : 0.3) + (v > 2 ? 0.3 : 0),
      },
      {
        type: 'grid_trading',
        templateId: 'strategies/grid_trading',
        params: { gridLevels: 10, gridSpacing: 0.02, rebalanceThreshold: 0.01 },
        idealConditions: (p, v, d) => (p < 3 ? 0.6 : 0.2) + (v < 1.5 ? 0.2 : 0),
      },
      {
        type: 'scalping',
        templateId: 'strategies/scalping',
        params: { maxHoldMinutes: 15, profitTarget: 0.003, stopPercent: 0.0015 },
        idealConditions: (p, v, d) => (v > 3 ? 0.7 : v > 2 ? 0.4 : 0.1) + (p > 1 ? 0.2 : 0),
      },
    ];

    return templates.map(t => {
      const score = t.idealConditions(absPct, obs.volumeRatio, direction);
      const suitability: StrategyMatch['suitability'] =
        score > 0.7 ? 'excellent' : score > 0.5 ? 'good' : score > 0.3 ? 'fair' : 'poor';

      return {
        strategyType: t.type,
        matchScore: Math.round(score * 100) / 100,
        suitability,
        templateId: t.templateId,
        parameters: t.params,
        description: `${t.type.replace('_', ' ')} strategy — ${suitability} match`,
        descriptionCn: `${this._strategyCnName(t.type)}策略 — ${suitability === 'excellent' ? '极佳匹配' : suitability === 'good' ? '良好匹配' : suitability === 'fair' ? '一般匹配' : '不推荐'}`,
      };
    }).sort((a, b) => b.matchScore - a.matchScore);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 3. 查询
  // ═══════════════════════════════════════════════════════════════════════

  /** Get signal history */
  getSignalHistory(symbol?: string, limit = 50): StrategySignal[] {
    let results = this.signals;
    if (symbol) results = results.filter(s => s.symbol === symbol);
    return results.slice(-limit);
  }

  /** Get latest signal for symbol */
  getLatestSignal(symbol: string): StrategySignal | null {
    const history = this.getSignalHistory(symbol, 1);
    return history.length > 0 ? history[0] : null;
  }

  /** Get active entry signals (not exited) */
  getActiveEntries(): StrategySignal[] {
    return this.signals.filter(s => s.signalType === 'entry');
  }

  /** Get stats */
  getStats() {
    const byType: Record<string, number> = {};
    for (const s of this.signals) {
      byType[s.strategyType] = (byType[s.strategyType] ?? 0) + 1;
    }
    return {
      totalGenerated: this.totalGenerated,
      activeEntries: this.signals.filter(s => s.signalType === 'entry').length,
      avgConfidence: this.signals.length > 0
        ? Math.round(this.signals.reduce((sum, s) => sum + s.confidence, 0) / this.signals.length * 1000) / 1000
        : 0,
      byType,
    };
  }

  /**
   * Batch process multiple observations and return top signals.
   */
  batchProcess(observations: MarketObservation[], topN = 5): StrategySignal[] {
    return observations
      .map(o => this.generateSignal(o))
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, topN);
  }

  reset(): void {
    this.signals.length = 0;
    this.totalGenerated = 0;
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private _matchStrategy(obs: MarketObservation, signals: MarketSignalType[], snapshot?: MarketSnapshot): StrategyMatch {
    const matches = this.matchStrategies(obs);

    // Boost scores based on active signals
    if (snapshot) {
      if (snapshot.sentiment > 0.5 && obs.changePercent > 0) {
        // Bullish sentiment + up move → boost trend following
        const tf = matches.find(m => m.strategyType === 'trend_following');
        if (tf) tf.matchScore = Math.min(1, tf.matchScore + 0.1);
      }
      if (snapshot.vixProxy > 30) {
        // High volatility → boost volatility arbitrage
        const va = matches.find(m => m.strategyType === 'volatility_arbitrage');
        if (va) va.matchScore = Math.min(1, va.matchScore + 0.1);
      }
    }

    // Favored strategies based on observed signals
    if (signals.includes('breakout')) {
      const mb = matches.find(m => m.strategyType === 'momentum_breakout');
      if (mb) mb.matchScore = Math.min(1, mb.matchScore + 0.15);
    }
    if (signals.includes('volume_surge')) {
      const sc = matches.find(m => m.strategyType === 'scalping');
      if (sc) sc.matchScore = Math.min(1, sc.matchScore + 0.1);
    }
    if (signals.includes('pullback')) {
      const mr = matches.find(m => m.strategyType === 'mean_reversion');
      if (mr) mr.matchScore = Math.min(1, mr.matchScore + 0.1);
    }

    return matches.sort((a, b) => b.matchScore - a.matchScore)[0];
  }

  private _generateReasoning(obs: MarketObservation, signals: MarketSignalType[], match: StrategyMatch) {
    const reasoning: string[] = [];
    const reasoningCn: string[] = [];

    reasoning.push(`${obs.symbol} ${obs.changePercent > 0 ? '+' : ''}${obs.changePercent}% move`);
    reasoningCn.push(`${obs.symbol} ${obs.changePercent > 0 ? '涨' : '跌'}${Math.abs(obs.changePercent)}%`);

    if (signals.includes('breakout')) {
      reasoning.push('Breakout detected with volume confirmation');
      reasoningCn.push('检测到突破且成交量确认');
    }
    if (signals.includes('volume_surge')) {
      reasoning.push(`Volume ${obs.volumeRatio}x vs average`);
      reasoningCn.push(`成交量放大${obs.volumeRatio}x`);
    }
    if (signals.includes('pullback')) {
      reasoning.push('Pullback on high volume — mean reversion opportunity');
      reasoningCn.push('放量回调 — 均值回归机会');
    }

    reasoning.push(`Best strategy: ${match.strategyType} (${Math.round(match.matchScore * 100)}% match)`);
    reasoningCn.push(`最佳策略: ${this._strategyCnName(match.strategyType)} (${Math.round(match.matchScore * 100)}%匹配)`);

    return { reasoning, reasoningCn };
  }

  private _strategyCnName(type: StrategyType): string {
    const map: Record<StrategyType, string> = {
      momentum_breakout: '动量突破',
      mean_reversion: '均值回归',
      trend_following: '趋势跟踪',
      volatility_arbitrage: '波动套利',
      sector_momentum: '行业动量',
      event_driven: '事件驱动',
      grid_trading: '网格交易',
      scalping: '短线剥头皮',
    };
    return map[type];
  }

  private _hash(input: string): number {
    let h = 0;
    for (let i = 0; i < input.length; i++) { h = ((h << 5) - h) + input.charCodeAt(i); h |= 0; }
    return Math.abs(h);
  }
}

// ── Singleton ───────────────────────────────────────────────────────────────

let instance: MarketToStrategyBridge | null = null;

export function marketToStrategyBridge(): MarketToStrategyBridge {
  if (!instance) instance = new MarketToStrategyBridge();
  return instance;
}

export function resetMarketToStrategyBridge(): void { instance?.reset(); instance = null; }

/**
 * R268: IndicatorSignalPushBridge — 指标信号→推送桥接
 * 
 * 功能:
 *   1. 监测93个指标生成交易信号
 *   2. 信号类型: 交叉/超买超卖/背离/突破/波动骤增
 *   3. 信号优先级 (critical/high/medium/low)
 *   4. 信号聚合 (避免重复推送)
 *   5. 推送接口对接 push-ipc-bridge
 *   6. 信号历史+统计
 */

import { IndicatorResult, IndicatorValue, IndicatorSignal } from './indicator-data-pipeline';

// ── Types ──────────────────────────────────────────────────────────────────

export interface IndicatorPushSignal {
  signalId: string;
  symbol: string;
  indicatorId: string;
  indicatorName: string;
  indicatorNameCn: string;
  type: IndicatorSignal['type'];
  strength: 'strong' | 'moderate' | 'weak';
  priority: PushPriority;
  value: number;
  price: number;
  message: string;
  messageCn: string;
  details: Record<string, number>;
  createdAt: number;
  pushed: boolean;
  pushedAt: number;
  cooldownUntil: number;
}

export type PushPriority = 'critical' | 'high' | 'medium' | 'low';

export interface SignalRule {
  indicatorId: string;
  signalType: IndicatorSignal['type'];
  threshold?: number;
  priority: PushPriority;
  message: string;
  messageCn: string;
}

export interface SignalSummary {
  totalSignals: number;
  pendingSignals: number;
  pushedSignals: number;
  byPriority: Record<PushPriority, number>;
  byIndicator: Record<string, number>;
  latestSignalAt: number;
}

// ── Signal detection rules ─────────────────────────────────────────────────

const SIGNAL_RULES: SignalRule[] = [
  // RSI overbought/oversold
  { indicatorId:'rsi', signalType:'overbought', threshold:70, priority:'high', message:'RSI overbought — possible reversal', messageCn:'RSI超买 — 可能反转' },
  { indicatorId:'rsi', signalType:'oversold', threshold:30, priority:'high', message:'RSI oversold — possible bounce', messageCn:'RSI超卖 — 可能反弹' },
  { indicatorId:'rsi', signalType:'overbought', threshold:80, priority:'critical', message:'RSI extremely overbought', messageCn:'RSI极端超买' },
  { indicatorId:'rsi', signalType:'oversold', threshold:20, priority:'critical', message:'RSI extremely oversold', messageCn:'RSI极端超卖' },
  // CCI extremes
  { indicatorId:'cci', signalType:'overbought', threshold:100, priority:'medium', message:'CCI overbought', messageCn:'CCI超买' },
  { indicatorId:'cci', signalType:'oversold', threshold:-100, priority:'medium', message:'CCI oversold', messageCn:'CCI超卖' },
  { indicatorId:'cci', signalType:'overbought', threshold:200, priority:'high', message:'CCI extreme overbought', messageCn:'CCI极度超买' },
  { indicatorId:'cci', signalType:'oversold', threshold:-200, priority:'high', message:'CCI extreme oversold', messageCn:'CCI极度超卖' },
  // Williams %R
  { indicatorId:'willr', signalType:'overbought', threshold:-20, priority:'medium', message:'Williams %R overbought', messageCn:'威廉指标超买' },
  { indicatorId:'willr', signalType:'oversold', threshold:-80, priority:'medium', message:'Williams %R oversold', messageCn:'威廉指标超卖' },
  // MFI
  { indicatorId:'mfi', signalType:'overbought', threshold:80, priority:'medium', message:'MFI overbought', messageCn:'资金流量超买' },
  { indicatorId:'mfi', signalType:'oversold', threshold:20, priority:'medium', message:'MFI oversold', messageCn:'资金流量超卖' },
  // StochRSI
  { indicatorId:'stochrsi', signalType:'overbought', threshold:80, priority:'medium', message:'StochRSI overbought', messageCn:'随机RSI超买' },
  { indicatorId:'stochrsi', signalType:'oversold', threshold:20, priority:'medium', message:'StochRSI oversold', messageCn:'随机RSI超卖' },
  // ADX trend strength
  { indicatorId:'adx', signalType:'breakout', threshold:25, priority:'medium', message:'ADX signals strong trend', messageCn:'ADX趋势增强' },
  { indicatorId:'adx', signalType:'crossover', threshold:40, priority:'high', message:'ADX very strong trend', messageCn:'ADX极强趋势' },
  // AO crossover
  { indicatorId:'ao', signalType:'crossover', threshold:0, priority:'high', message:'AO zero-line crossover', messageCn:'AO零轴穿越' },
  // BB squeeze
  { indicatorId:'bbw', signalType:'breakout', threshold:10, priority:'high', message:'BB Width breakout — volatility expansion', messageCn:'布林宽度突破 — 波动放大' },
  // Volatility spike
  { indicatorId:'atr', signalType:'breakout', threshold:5, priority:'critical', message:'ATR spike — extreme volatility', messageCn:'ATR暴涨 — 极端波动' },
  { indicatorId:'hv', signalType:'breakout', threshold:60, priority:'critical', message:'HV spike > 60%', messageCn:'历史波动率>60%' },
  // Volume imbalance
  { indicatorId:'volimbalance', signalType:'breakout', threshold:3, priority:'high', message:'Volume imbalance detected', messageCn:'检测到量失衡' },
  // Connors RSI
  { indicatorId:'connorsrsi', signalType:'overbought', threshold:90, priority:'high', message:'Connors RSI extreme overbought', messageCn:'康纳斯RSI极度超买' },
  { indicatorId:'connorsrsi', signalType:'oversold', threshold:10, priority:'high', message:'Connors RSI extreme oversold', messageCn:'康纳斯RSI极度超卖' },
  // CMF
  { indicatorId:'cmf', signalType:'crossover', threshold:0, priority:'medium', message:'CMF zero-line crossover', messageCn:'蔡金资金流零轴穿越' },
  { indicatorId:'cmfv2', signalType:'crossover', threshold:0, priority:'medium', message:'Chaikin MF zero-line crossover', messageCn:'蔡金MF零轴穿越' },
  // BIAS (Chinese)
  { indicatorId:'bias', signalType:'overbought', threshold:8, priority:'medium', message:'BIAS6 > 8% — overbought', messageCn:'乖离率>8% — 超买' },
  { indicatorId:'bias', signalType:'oversold', threshold:-8, priority:'medium', message:'BIAS6 < -8% — oversold', messageCn:'乖离率<-8% — 超卖' },
  // BB proximity signals
  { indicatorId:'bb', signalType:'breakout', threshold:0, priority:'high', message:'Price near BB upper', messageCn:'价格触及布林上轨' },
  { indicatorId:'bb', signalType:'breakdown', threshold:0, priority:'high', message:'Price near BB lower', messageCn:'价格触及布林下轨' },
  // SuperTrend
  { indicatorId:'supertrend', signalType:'crossover', threshold:0, priority:'high', message:'SuperTrend crossover', messageCn:'超级趋势转向' },
  // DPO
  { indicatorId:'dpo', signalType:'crossover', threshold:0, priority:'low', message:'DPO zero-line crossover', messageCn:'DPO零轴穿越' },
  // UO
  { indicatorId:'uo', signalType:'overbought', threshold:70, priority:'medium', message:'UO overbought', messageCn:'终极振荡超买' },
  { indicatorId:'uo', signalType:'oversold', threshold:30, priority:'medium', message:'UO oversold', messageCn:'终极振荡超卖' },
  { indicatorId:'uo', signalType:'crossover', threshold:50, priority:'low', message:'UO 50-line crossover', messageCn:'UO中轴穿越' },
];

// ── Cooldown config ─────────────────────────────────────────────────────────

const COOLDOWN: Record<PushPriority, number> = {
  critical: 30000,    // 30s
  high: 300000,       // 5min
  medium: 900000,     // 15min
  low: 3600000,       // 1h
};

// ═══════════════════════════════════════════════════════════════════════════
// IndicatorSignalPushBridge
// ═══════════════════════════════════════════════════════════════════════════

export class IndicatorSignalPushBridge {
  private signals: Map<string, IndicatorPushSignal> = new Map();
  private pushedHistory: IndicatorPushSignal[] = [];
  private stats_ = { totalSignals: 0, pushed: 0, suppressed: 0 };

  constructor() {}

  // ── Public API: Signal Detection ─────────────────────────────────────────

  /**
   * Analyze indicator results and generate push signals.
   */
  analyze(results: IndicatorResult[]): IndicatorPushSignal[] {
    const now = Date.now();
    const newSignals: IndicatorPushSignal[] = [];

    for (const result of results) {
      const latest = result.latest;
      if (!latest || latest.value === null) continue;

      // Find matching rules
      for (const rule of SIGNAL_RULES) {
        if (rule.indicatorId !== result.indicatorId) continue;
        if (!this._matchRule(latest, rule)) continue;

        // Strength assessment
        let strength: 'strong' | 'moderate' | 'weak' = 'moderate';
        if (rule.priority === 'critical') strength = 'strong';
        else if (rule.priority === 'low') strength = 'weak';

        // Build signal
        const dedupKey = `${result.symbol}:${result.indicatorId}:${rule.signalType}`;
        const existing = this.signals.get(dedupKey);

        // Cooldown check
        if (existing && existing.cooldownUntil > now) {
          this.stats_.suppressed++;
          continue;
        }

        const signal: IndicatorPushSignal = {
          signalId: `sig:${result.symbol}:${result.indicatorId}:${rule.signalType}:${now}`,
          symbol: result.symbol,
          indicatorId: result.indicatorId,
          indicatorName: result.meta.name,
          indicatorNameCn: result.meta.nameCn,
          type: rule.signalType,
          strength,
          priority: rule.priority,
          value: latest.value,
          price: typeof latest.values?.[0] === 'number' ? latest.values[0] : latest.value,
          message: rule.message,
          messageCn: rule.messageCn,
          details: { value: latest.value, threshold: rule.threshold ?? 0 },
          createdAt: now,
          pushed: false,
          pushedAt: 0,
          cooldownUntil: now + COOLDOWN[rule.priority],
        };

        this.signals.set(dedupKey, signal);
        this.stats_.totalSignals++;
        newSignals.push(signal);
      }
    }

    return newSignals;
  }

  /**
   * Analyze and push — complete pipeline.
   * Returns signals pushed.
   */
  analyzeAndPush(results: IndicatorResult[]): IndicatorPushSignal[] {
    const signals = this.analyze(results);
    return signals.filter(s => this.markPushSent(s.signalId));
  }

  // ── Public API: Push Control ─────────────────────────────────────────────

  /** Mark a signal as pushed */
  markPushSent(signalId: string): boolean {
    for (const [key, signal] of this.signals) {
      if (signal.signalId === signalId) {
        signal.pushed = true;
        signal.pushedAt = Date.now();
        this.pushedHistory.push({ ...signal });
        this.stats_.pushed++;
        return true;
      }
    }
    return false;
  }

  /** Get pending signals (not yet pushed) */
  getPending(priority?: PushPriority): IndicatorPushSignal[] {
    let list = Array.from(this.signals.values()).filter(s => !s.pushed);
    if (priority) list = list.filter(s => s.priority === priority);
    return list.sort((a, b) => {
      const priorityOrder: Record<PushPriority, number> = { critical: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  // ── Public API: Query ────────────────────────────────────────────────────

  /** Get signals by symbol */
  getSignalsBySymbol(symbol: string): IndicatorPushSignal[] {
    return Array.from(this.signals.values()).filter(s => s.symbol === symbol);
  }

  /** Get signals by indicator */
  getSignalsByIndicator(indicatorId: string): IndicatorPushSignal[] {
    return Array.from(this.signals.values()).filter(s => s.indicatorId === indicatorId);
  }

  /** Get push history */
  getPushedHistory(limit?: number): IndicatorPushSignal[] {
    return limit ? this.pushedHistory.slice(-limit).reverse() : [...this.pushedHistory].reverse();
  }

  /** Get summary */
  getSummary(): SignalSummary {
    const byPriority: Record<PushPriority, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    const byIndicator: Record<string, number> = {};

    for (const signal of this.signals.values()) {
      byPriority[signal.priority] = (byPriority[signal.priority] ?? 0) + 1;
      byIndicator[signal.indicatorId] = (byIndicator[signal.indicatorId] ?? 0) + 1;
    }

    return {
      totalSignals: this.stats_.totalSignals,
      pendingSignals: this.stats_.totalSignals - this.stats_.pushed,
      pushedSignals: this.stats_.pushed,
      byPriority,
      byIndicator,
      latestSignalAt: this.pushedHistory.length > 0 ? this.pushedHistory[0].createdAt : 0,
    };
  }

  /** Get stats */
  getStats() { return { ...this.stats_ }; }

  /** Reset */
  reset(): void {
    this.signals.clear();
    this.pushedHistory = [];
    this.stats_ = { totalSignals: 0, pushed: 0, suppressed: 0 };
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private _matchRule(latest: IndicatorValue, rule: SignalRule): boolean {
    const v = latest.value;
    if (v === null) return false;
    const t = rule.threshold;

    switch (rule.signalType) {
      case 'overbought': return v >= (t ?? 70);
      case 'oversold': return v <= (t ?? 30);
      case 'crossover': {
        // For zero-line crossover, check if value crosses the threshold
        if (!latest.values || latest.values.length < 2) return false;
        const prev = latest.values[0];
        const curr = latest.values[1] ?? v;
        return prev !== null && curr !== null &&
          ((prev < (t ?? 0) && curr >= (t ?? 0)) || (prev > (t ?? 0) && curr <= (t ?? 0)));
      }
      case 'breakout': return v >= (t ?? 10);
      case 'breakdown': return v <= (t ?? -10);
      default: return false;
    }
  }
}

export const indicatorSignalPushBridge = new IndicatorSignalPushBridge();

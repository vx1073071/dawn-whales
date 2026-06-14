// ── R174 D4: Factor → Signal → Strategy Pipeline ────────────────────────────
// Transforms factor analysis results into tradable signals and strategies.
//
// Flow: FactorAnalysis → SignalPipeline.emit() → FactorStrategy.generate()
//
// Signal types: breakout, decay-warning, factor-recommendation, portfolio-alert
// Billing: per signal delivery, hold→settle on ack, 3-day free preview per signal
//
// Connects to: C5 snapshot store, D5 trade pipeline, E2 dynamic IC/IR

import log from 'electron-log';
import { EventEmitter } from 'events';
import { resolveFactorId, type FactorId } from '../factors/factor-id-registry';

// ── Types ───────────────────────────────────────────────────────────────────

/** Signal type classification */
export type SignalType =
  | 'factor_breakout'       // Factor IC exceeds threshold → likely profitable
  | 'decay_warning'         // Factor alpha is decaying → reduce weight
  | 'factor_recommendation' // New factor recommendation from dynamic IC/IR
  | 'portfolio_alert'       // Portfolio-level risk/concentration alert
  | 'crowding_signal';      // Crowding level changed

/** Signal priority */
export type SignalPriority = 'low' | 'medium' | 'high' | 'critical';

/** Signal delivery status */
export type SignalDeliveryStatus = 'pending' | 'delivered' | 'acknowledged' | 'expired';

/** Signal billing status */
export type SignalBillingStatus = 'free_trial' | 'held' | 'settled' | 'refunded' | 'no_charge';

/** Factor analysis input to the signal pipeline */
export interface FactorAnalysisInput {
  factorId: string;
  ic: number;               // Current IC value
  ir: number;               // Current IR value
  icRank: number;           // IC rank among all factors (1=best)
  decayRate: number;        // Alpha decay rate (λ)
  crowdingLevel: string;    // 'normal' | 'watch' | 'warning' | 'critical'
  momentum: number;         // IC momentum (IC[t] - IC[t-1])
  volatility: number;       // IC volatility (std)
  lastUpdated: number;      // Timestamp
}

/** Generated signal */
export interface FactorSignal {
  signalId: string;
  type: SignalType;
  priority: SignalPriority;
  factorId: string;
  factorName: string;
  title: string;
  message: string;
  score: number;            // 0-100 signal confidence
  metadata: Record<string, unknown>;
  emittedAt: number;
  expiresAt: number;
  deliveryStatus: SignalDeliveryStatus;
  billingStatus: SignalBillingStatus;
  billable: boolean;        // Can this signal be charged?
  costUSDT: number;         // Cost if billable
}

/** Strategy generated from signals */
export interface FactorStrategy {
  strategyId: string;
  name: string;
  description: string;
  factors: Array<{ factorId: string; weight: number; reason: string }>;
  targetMarket: string;
  expectedIC: number;
  expectedSharpe: number;
  riskLevel: 'low' | 'medium' | 'high';
  signals: FactorSignal[];
  generatedAt: number;
  billable: boolean;
  costUSDT: number;
}

// ── Signal Billing Config ───────────────────────────────────────────────────

interface SignalBillingConfig {
  /** Whether this signal type is billable */
  billable: boolean;
  /** USDT cost per signal delivery */
  costUSDT: number;
  /** Free trial days (signal visible without charge for N days) */
  freeTrialDays: number;
  /** Cost for full strategy generation */
  strategyCostUSDT: number;
}

const SIGNAL_BILLING: Record<SignalType, SignalBillingConfig> = {
  factor_breakout:      { billable: true,  costUSDT: 0.5, freeTrialDays: 3, strategyCostUSDT: 2.0 },
  decay_warning:        { billable: false, costUSDT: 0,   freeTrialDays: 0, strategyCostUSDT: 0 },
  factor_recommendation: { billable: true, costUSDT: 0.3, freeTrialDays: 3, strategyCostUSDT: 1.0 },
  portfolio_alert:      { billable: false, costUSDT: 0,   freeTrialDays: 0, strategyCostUSDT: 0 },
  crowding_signal:      { billable: true,  costUSDT: 0.3, freeTrialDays: 3, strategyCostUSDT: 1.5 },
};

// ── Signal Pipeline ─────────────────────────────────────────────────────────

export class FactorSignalPipeline extends EventEmitter {
  private signals: Map<string, FactorSignal> = new Map();
  private strategies: Map<string, FactorStrategy> = new Map();
  private chargeCallback: ((userId: string, amount: number, serviceId: string) => Promise<{ ok: boolean; txId?: string }>) | null = null;

  // Event names
  static readonly EVENTS = {
    SIGNAL_EMITTED: 'signal:emitted',
    SIGNAL_ACKED: 'signal:acked',
    SIGNAL_BILLED: 'signal:billed',
    STRATEGY_GENERATED: 'strategy:generated',
    STRATEGY_BILLED: 'strategy:billed',
  } as const;

  /** Set billing handler for charge operations */
  setBillingHandler(handler: (userId: string, amount: number, serviceId: string) => Promise<{ ok: boolean; txId?: string }>): void {
    this.chargeCallback = handler;
  }

  /**
   * Emit signals from factor analysis results.
   * One factor can generate multiple signal types.
   */
  emitSignals(analyses: FactorAnalysisInput[]): FactorSignal[] {
    const emitted: FactorSignal[] = [];

    for (const analysis of analyses) {
      // 1. Factor breakout signal (high IC + positive momentum)
      if (analysis.ic > 0.03 && analysis.momentum > 0.005 && analysis.icRank <= 10) {
        const priority = analysis.ic > 0.06 ? 'high' : 'medium';
        const score = Math.min(100, Math.round(analysis.ic * 1000 + analysis.momentum * 2000));
        emitted.push(this.createSignal('factor_breakout', priority, analysis, score,
          `${analysis.factorId} 因子IC=${analysis.ic.toFixed(3)}，动量正向，建议增加配置`,
          { ic: analysis.ic, momentum: analysis.momentum, rank: analysis.icRank }));
      }

      // 2. Decay warning signal (high decay rate)
      if (analysis.decayRate > 0.3) {
        const priority = analysis.decayRate > 0.6 ? 'critical' : 'medium';
        const score = Math.min(100, Math.round(analysis.decayRate * 100));
        emitted.push(this.createSignal('decay_warning', priority, analysis, score,
          `${analysis.factorId} 因子alpha衰减率λ=${analysis.decayRate.toFixed(2)}，衰减中，建议降低权重`,
          { decayRate: analysis.decayRate, halfLife: 1 / analysis.decayRate }));
      }

      // 3. Crowding signal (crowding level changed)
      if (analysis.crowdingLevel === 'critical' || analysis.crowdingLevel === 'warning') {
        const priority = analysis.crowdingLevel === 'critical' ? 'critical' : 'high';
        const score = analysis.crowdingLevel === 'critical' ? 90 : 65;
        emitted.push(this.createSignal('crowding_signal', priority, analysis, score,
          `${analysis.factorId} 拥挤度=${analysis.crowdingLevel}，注意拥挤交易风险`,
          { crowdingLevel: analysis.crowdingLevel }));
      }

      // 4. Factor recommendation (IC sustained above threshold)
      if (analysis.ic > 0.02 && analysis.ir > 0.3) {
        const score = Math.min(100, Math.round((analysis.ic / 0.1) * 50 + (analysis.ir / 1.5) * 50));
        emitted.push(this.createSignal('factor_recommendation', 'low', analysis, score,
          `${analysis.factorId} 因子持续有效 IC=${analysis.ic.toFixed(3)} IR=${analysis.ir.toFixed(2)}`,
          { ic: analysis.ic, ir: analysis.ir }));
      }
    }

    // 5. Portfolio alert (if any critical signals exist)
    const criticalCount = emitted.filter(s => s.priority === 'critical').length;
    if (criticalCount > 0) {
      const alert = this.createRawSignal('portfolio_alert', 'high',
        `检测到${criticalCount}个高危信号，建议审视整体组合配置`,
        { criticalSignalCount: criticalCount, signalIds: emitted.filter(s => s.priority === 'critical').map(s => s.signalId) },
      );
      emitted.push(alert);
    }

    for (const signal of emitted) {
      this.signals.set(signal.signalId, signal);
    }

    log.info(`[SignalPipeline] Emitted ${emitted.length} signals from ${analyses.length} analyses`);
    this.emit(FactorSignalPipeline.EVENTS.SIGNAL_EMITTED, emitted);

    return emitted;
  }

  /**
   * Acknowledge a signal (user has seen it).
   * If billable and in free trial, marks as acknowledged.
   * If billable and past trial, processes charge.
   */
  async acknowledgeSignal(signalId: string, userId: string): Promise<{ ok: boolean; charged?: number }> {
    const signal = this.signals.get(signalId);
    if (!signal) return { ok: false };

    signal.deliveryStatus = 'acknowledged';
    this.emit(FactorSignalPipeline.EVENTS.SIGNAL_ACKED, signal);

    // Bill if applicable
    const billing = SIGNAL_BILLING[signal.type];
    if (billing.billable && signal.billable && signal.billingStatus === 'free_trial') {
      const now = Date.now();
      const trialMs = billing.freeTrialDays * 24 * 3600 * 1000;
      if (now > signal.emittedAt + trialMs) {
        return this.chargeSignal(signal, userId);
      }
    }

    return { ok: true };
  }

  /**
   * Charge for a signal.
   */
  private async chargeSignal(signal: FactorSignal, userId: string): Promise<{ ok: boolean; charged?: number }> {
    const billing = SIGNAL_BILLING[signal.type];
    if (!billing.billable) return { ok: true };

    signal.billingStatus = 'held';

    if (this.chargeCallback) {
      const result = await this.chargeCallback(userId, billing.costUSDT, `signal:${signal.signalId}`);
      if (result.ok) {
        signal.billingStatus = 'settled';
        this.emit(FactorSignalPipeline.EVENTS.SIGNAL_BILLED, { signal, txId: result.txId });
        return { ok: true, charged: billing.costUSDT };
      } else {
        signal.billingStatus = 'refunded';
        return { ok: false };
      }
    }

    // No billing handler = auto-settle (dev mode)
    signal.billingStatus = 'settled';
    return { ok: true, charged: billing.costUSDT };
  }

  /**
   * Generate a trading strategy from a set of signals.
   */
  async generateStrategy(
    signals: FactorSignal[],
    params: { name: string; targetMarket: string; userId: string },
  ): Promise<FactorStrategy> {
    const strategyId = `strat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Derive factors and weights from signals
    const factorMap = new Map<string, { weight: number; reason: string[] }>();
    let totalIC = 0;

    for (const signal of signals) {
      const fid = signal.factorId;
      const existing = factorMap.get(fid) || { weight: 0, reason: [] };
      const ic = (signal.metadata.ic as number) || 0.02;
      existing.weight += ic * signal.score / 100;
      existing.reason.push(signal.message.slice(0, 60));
      totalIC += ic;
      factorMap.set(fid, existing);
    }

    // Normalize weights
    const totalWeight = [...factorMap.values()].reduce((s, v) => s + v.weight, 0);
    const factors = [...factorMap.entries()].map(([factorId, { weight, reason }]) => ({
      factorId,
      weight: totalWeight > 0 ? Math.round((weight / totalWeight) * 1000) / 1000 : 0,
      reason: reason.join('；'),
    }));

    // Estimate metrics
    const avgIC = signals.reduce((s, sig) => s + ((sig.metadata.ic as number) || 0.02), 0) / Math.max(1, signals.length);
    const expectedSharpe = avgIC * 25; // Rough: IC × sqrt(N) ≈ IC × 25

    // Calculate total cost
    const billableSignals = signals.filter(s => SIGNAL_BILLING[s.type].billable && s.billable);
    const totalCost = billableSignals.reduce((s, sig) => s + SIGNAL_BILLING[sig.type].strategyCostUSDT, 0);

    const strategy: FactorStrategy = {
      strategyId,
      name: params.name,
      description: `基于${signals.length}个信号生成的${params.targetMarket}市场因子策略`,
      factors,
      targetMarket: params.targetMarket,
      expectedIC: Math.round(avgIC * 10000) / 10000,
      expectedSharpe: Math.round(expectedSharpe * 100) / 100,
      riskLevel: totalCost > 3 ? 'high' : totalCost > 1 ? 'medium' : 'low',
      signals,
      generatedAt: Date.now(),
      billable: totalCost > 0,
      costUSDT: Math.round(totalCost * 100) / 100,
    };

    // Charge for strategy if billable
    if (strategy.billable && this.chargeCallback) {
      const result = await this.chargeCallback(params.userId, strategy.costUSDT, `strategy:${strategyId}`);
      if (result.ok) {
        this.emit(FactorSignalPipeline.EVENTS.STRATEGY_BILLED, { strategy, txId: result.txId });
      }
    }

    this.strategies.set(strategyId, strategy);
    this.emit(FactorSignalPipeline.EVENTS.STRATEGY_GENERATED, strategy);
    log.info(`[SignalPipeline] Generated strategy "${params.name}" with ${factors.length} factors`);

    return strategy;
  }

  /** Get all active (unexpired) signals */
  getActiveSignals(): FactorSignal[] {
    const now = Date.now();
    return [...this.signals.values()].filter(s => s.expiresAt > now);
  }

  /** Get signal by ID */
  getSignal(signalId: string): FactorSignal | undefined {
    return this.signals.get(signalId);
  }

  /** Get strategy by ID */
  getStrategy(strategyId: string): FactorStrategy | undefined {
    return this.strategies.get(strategyId);
  }

  /** Get all strategies */
  getAllStrategies(): FactorStrategy[] {
    return [...this.strategies.values()].sort((a, b) => b.generatedAt - a.generatedAt);
  }

  /** Reset pipeline state */
  reset(): void {
    this.signals.clear();
    this.strategies.clear();
    this.removeAllListeners();
    log.info('[SignalPipeline] Reset');
  }

  // ── Helpers ───────────────────────────────────────────────────────────

  private createSignal(
    type: SignalType,
    priority: SignalPriority,
    analysis: FactorAnalysisInput,
    score: number,
    message: string,
    metadata: Record<string, unknown>,
  ): FactorSignal {
    const billing = SIGNAL_BILLING[type];
    const now = Date.now();
    return {
      signalId: `sig-${type}-${analysis.factorId}-${now}-${Math.random().toString(36).slice(2, 6)}`,
      type,
      priority,
      factorId: analysis.factorId,
      factorName: this.getFactorDisplayName(analysis.factorId),
      title: `${this.getSignalTypeLabel(type)}: ${analysis.factorId}`,
      message,
      score,
      metadata,
      emittedAt: now,
      expiresAt: now + 7 * 24 * 3600 * 1000, // 7 day expiry
      deliveryStatus: 'pending',
      billingStatus: billing.freeTrialDays > 0 ? 'free_trial' : 'no_charge',
      billable: billing.billable,
      costUSDT: billing.costUSDT,
    };
  }

  private createRawSignal(
    type: SignalType,
    priority: SignalPriority,
    message: string,
    metadata: Record<string, unknown>,
  ): FactorSignal {
    const billing = SIGNAL_BILLING[type];
    const now = Date.now();
    return {
      signalId: `sig-${type}-portfolio-${now}`,
      type, priority,
      factorId: '__portfolio__',
      factorName: '投资组合',
      title: `${this.getSignalTypeLabel(type)}`,
      message, score: metadata.criticalSignalCount ? Math.min(100, (metadata.criticalSignalCount as number) * 25) : 50,
      metadata,
      emittedAt: now,
      expiresAt: now + 3 * 24 * 3600 * 1000,
      deliveryStatus: 'pending',
      billingStatus: 'no_charge',
      billable: billing.billable,
      costUSDT: billing.costUSDT,
    };
  }

  private getSignalTypeLabel(type: SignalType): string {
    const labels: Record<SignalType, string> = {
      factor_breakout: '因子突破',
      decay_warning: '衰减预警',
      factor_recommendation: '因子推荐',
      portfolio_alert: '组合预警',
      crowding_signal: '拥挤信号',
    };
    return labels[type];
  }

  private getFactorDisplayName(id: string): string {
    const resolved = resolveFactorId(id);
    return resolved || id;
  }
}

// ── Singleton ───────────────────────────────────────────────────────────────

let _pipeline: FactorSignalPipeline | null = null;

export function getFactorSignalPipeline(): FactorSignalPipeline {
  if (!_pipeline) _pipeline = new FactorSignalPipeline();
  return _pipeline;
}

export function resetFactorSignalPipeline(): void {
  _pipeline?.reset();
  _pipeline = null;
}

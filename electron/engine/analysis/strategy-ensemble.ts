/**
 * Strategy Ensemble Engine - JVS-46-01
 * strategy/policy，strategy/policymethod
 */

import log from 'electron-log';
import { EngineError, ErrorCode } from '../../errors';


// ── Types ──────────────────────────────────────────────────────────────────

export interface Strategy {
  id: string;
  name: string;
  type: 'momentum' | 'mean_reversion' | 'breakout' | 'trend_following';
  weight?: number;
  enabled: boolean;
}

export interface StrategySignal {
  strategyId: string;
  symbol: string;
  action: 'buy' | 'sell' | 'hold';
  confidence: number;      // 0-1
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface EnsembleSignal {
  symbol: string;
  action: 'buy' | 'sell' | 'hold';
  confidence: number;
  consensus: number;       // 0-1, strategy/policyconsistency
  signals: StrategySignal[];
  timestamp: number;
}

export interface EnsembleConfig {
  strategies: Strategy[];
  minConfidence: number;    // min confidence threshold
  consensusThreshold: number; // consistencythreshold
  rebalanceFrequency: 'daily' | 'weekly' | 'monthly';
  maxDrawdown: number;      // max drawdownlimit
  riskFreeRate: number;     // risk-free rate
}

export interface EnsembleMetrics {
  avgConfidence: number;
  avgConsensus: number;
  signalCount: number;
  buySignals: number;
  sellSignals: number;
  holdSignals: number;
  bestStrategy: string;
  worstStrategy: string;
}

export interface RebalanceSignal {
  symbol: string;
  action: 'buy' | 'sell' | 'hold';
  targetWeight: number;
  currentWeight: number;
  reason: string;
  confidence: number;
}

// ── Ensemble Engine ────────────────────────────────────────────────────────

export class StrategyEnsemble {
  private config: EnsembleConfig;
  private strategies: Map<string, Strategy> = new Map();
  private signalHistory: EnsembleSignal[] = [];
  private maxHistorySize: number = 1000;

  constructor(config: EnsembleConfig) {
    this.config = config;
    this.config.strategies.forEach(s => this.strategies.set(s.id, s));
    log.info(`[StrategyEnsemble] Initialized with ${this.strategies.size} strategies`);
  }

  /**
 * currentconfig
   */
  getConfig(): EnsembleConfig {
    return { ...this.config };
  }

  /**
   * updateconfig
   */
  updateConfig(config: Partial<EnsembleConfig>): void {
    this.config = { ...this.config, ...config };
    if (config.strategies) {
      this.strategies.clear();
      config.strategies.forEach(s => this.strategies.set(s.id, s));
    }
    log.info('[StrategyEnsemble] Config updated');
  }

  /**
 * strategy/policy
   */
  addStrategy(strategy: Strategy): void {
    this.strategies.set(strategy.id, strategy);
    this.config.strategies.push(strategy);
    log.info(`[StrategyEnsemble] Added strategy: ${strategy.name}`);
  }

  /**
 * strategy/policy
   */
  removeStrategy(strategyId: string): boolean {
    const removed = this.strategies.delete(strategyId);
    if (removed) {
      this.config.strategies = this.config.strategies.filter(s => s.id !== strategyId);
      log.info(`[StrategyEnsemble] Removed strategy: ${strategyId}`);
    }
    return removed;
  }

  /**
   * enable/disablestrategy/policy
   */
  setStrategyEnabled(strategyId: string, enabled: boolean): boolean {
    const strategy = this.strategies.get(strategyId);
    if (strategy) {
      strategy.enabled = enabled;
      const configStrategy = this.config.strategies.find(s => s.id === strategyId);
      if (configStrategy) {
        configStrategy.enabled = enabled;
      }
      log.info(`[StrategyEnsemble] Strategy ${strategyId} ${enabled ? 'enabled' : 'disabled'}`);
      return true;
    }
    return false;
  }

  /**
 * strategy/policy
   */
  getStrategies(): Strategy[] {
    return Array.from(this.strategies.values());
  }

  /**
 * enablestrategy/policy
   */
  getEnabledStrategies(): Strategy[] {
    return this.config.strategies.filter(s => s.enabled);
  }

  /**
 * strategy/policy
   */
  aggregate(signals: StrategySignal[]): EnsembleSignal[] {
    const symbolSignals = new Map<string, StrategySignal[]>();

 //
    signals.forEach(signal => {
      if (!symbolSignals.has(signal.symbol)) {
        symbolSignals.set(signal.symbol, []);
      }
      symbolSignals.get(signal.symbol)!.push(signal);
    });

    const ensembleSignals: EnsembleSignal[] = [];

    symbolSignals.forEach((symbolSignalsList, symbol) => {
      const ensemble = this.aggregateSymbolSignals(symbol, symbolSignalsList);
      if (ensemble) {
        ensembleSignals.push(ensemble);
        this.signalHistory.push(ensemble);
      }
    });

 // limit
    if (this.signalHistory.length > this.maxHistorySize) {
      this.signalHistory = this.signalHistory.slice(-this.maxHistorySize);
    }

    return ensembleSignals;
  }

  /**
 *
   */
  private aggregateSymbolSignals(symbol: string, signals: StrategySignal[]): EnsembleSignal | null {
    if (signals.length === 0) return null;

 // threshold
    const validSignals = signals.filter(s => s.confidence >= this.config.minConfidence);
    if (validSignals.length === 0) return null;

 //
    const votes = new Map<string, number>();
    validSignals.forEach(signal => {
      const current = votes.get(signal.action) || 0;
      votes.set(signal.action, current + signal.confidence);
    });

 //
    let bestAction: 'buy' | 'sell' | 'hold' = 'hold';
    let bestVote = 0;
    votes.forEach((vote, action) => {
      if (vote > bestVote) {
        bestVote = vote;
        bestAction = action as 'buy' | 'sell' | 'hold';
      }
    });

 // consistency
    const totalVotes = Array.from(votes.values()).reduce((sum, v) => sum + v, 0);
    const consensus = totalVotes > 0 ? bestVote / totalVotes : 0;

 //
    const avgConfidence = validSignals.reduce((sum, s) => sum + s.confidence, 0) / validSignals.length;

 // consistencythreshold
    if (consensus < this.config.consensusThreshold) {
      return null;
    }

    return {
      symbol,
      action: bestAction,
      confidence: avgConfidence,
      consensus,
      signals: validSignals,
      timestamp: Date.now(),
    };
  }

  /**
 *
   */
  generateRebalanceSignals(
    currentWeights: Map<string, number>,
    targetWeights: Map<string, number>
  ): RebalanceSignal[] {
    const signals: RebalanceSignal[] = [];
    const threshold = 0.05; // 5% threshold

 // weight
    targetWeights.forEach((targetWeight, symbol) => {
      const currentWeight = currentWeights.get(symbol) || 0;
      const diff = Math.abs(targetWeight - currentWeight);

      if (diff > threshold) {
        const action: 'buy' | 'sell' = targetWeight > currentWeight ? 'buy' : 'sell';
        signals.push({
          symbol,
          action,
          targetWeight,
          currentWeight,
          reason: `Weight deviation ${diff.toFixed(2)} exceeds threshold ${threshold}`,
          confidence: Math.min(diff / threshold, 1.0),
        });
      }
    });

 // currentposition/holding
    currentWeights.forEach((currentWeight, symbol) => {
      if (!targetWeights.has(symbol) && currentWeight > threshold) {
        signals.push({
          symbol,
          action: 'sell',
          targetWeight: 0,
          currentWeight,
          reason: `Position not in target portfolio`,
          confidence: 1.0,
        });
      }
    });

    return signals;
  }

  /**
 *
   */
  getSignalHistory(): EnsembleSignal[] {
    return [...this.signalHistory];
  }

  /**
 * clear
   */
  clearSignalHistory(): void {
    this.signalHistory = [];
  }

  /**
 * metric
   */
  getMetrics(): EnsembleMetrics {
    if (this.signalHistory.length === 0) {
      return {
        avgConfidence: 0,
        avgConsensus: 0,
        signalCount: 0,
        buySignals: 0,
        sellSignals: 0,
        holdSignals: 0,
        bestStrategy: '',
        worstStrategy: '',
      };
    }

    const avgConfidence = this.signalHistory.reduce((sum, s) => sum + s.confidence, 0) / this.signalHistory.length;
    const avgConsensus = this.signalHistory.reduce((sum, s) => sum + s.consensus, 0) / this.signalHistory.length;

    let buySignals = 0;
    let sellSignals = 0;
    let holdSignals = 0;

    this.signalHistory.forEach(signal => {
      if (signal.action === 'buy') buySignals++;
      else if (signal.action === 'sell') sellSignals++;
      else holdSignals++;
    });

 // strategy/policy
    const strategyPerformance = new Map<string, number[]>();
    this.signalHistory.forEach(signal => {
      signal.signals.forEach(s => {
        if (!strategyPerformance.has(s.strategyId)) {
          strategyPerformance.set(s.strategyId, []);
        }
        strategyPerformance.get(s.strategyId)!.push(s.confidence);
      });
    });

    let bestStrategy = '';
    let worstStrategy = '';
    let bestAvg = -Infinity;
    let worstAvg = Infinity;

    strategyPerformance.forEach((confidences, strategyId) => {
      const avg = confidences.reduce((sum, c) => sum + c, 0) / confidences.length;
      if (avg > bestAvg) {
        bestAvg = avg;
        bestStrategy = strategyId;
      }
      if (avg < worstAvg) {
        worstAvg = avg;
        worstStrategy = strategyId;
      }
    });

    return {
      avgConfidence: Math.round(avgConfidence * 100) / 100,
      avgConsensus: Math.round(avgConsensus * 100) / 100,
      signalCount: this.signalHistory.length,
      buySignals,
      sellSignals,
      holdSignals,
      bestStrategy,
      worstStrategy,
    };
  }

  /**
   * reset
   */
  reset(): void {
    this.signalHistory = [];
    this.strategies.clear();
    this.config.strategies.forEach(s => this.strategies.set(s.id, s));
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let _instance: StrategyEnsemble | null = null;

export function getStrategyEnsemble(config?: EnsembleConfig): StrategyEnsemble {
  if (!_instance) {
    if (!config) {
      throw new EngineError(ErrorCode.STRATEGY_CREATE_FAILED, 'StrategyEnsemble requires config on first initialization');
    }
    _instance = new StrategyEnsemble(config);
  }
  return _instance;
}

export function resetStrategyEnsemble(): void {
  _instance = null;
}

export default StrategyEnsemble;

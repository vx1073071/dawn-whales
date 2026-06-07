/**
 * Strategy Ensemble Engine - JVS-46-01
 * 多策略组合优化引擎，支持多种策略组合方法
 */

import log from 'electron-log';

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
  consensus: number;       // 0-1, 策略一致性
  signals: StrategySignal[];
  timestamp: number;
}

export interface EnsembleConfig {
  strategies: Strategy[];
  minConfidence: number;    // 最低置信度阈值
  consensusThreshold: number; // 一致性阈值
  rebalanceFrequency: 'daily' | 'weekly' | 'monthly';
  maxDrawdown: number;      // 最大回撤限制
  riskFreeRate: number;     // 无风险利率
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
   * 获取当前配置
   */
  getConfig(): EnsembleConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
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
   * 添加策略
   */
  addStrategy(strategy: Strategy): void {
    this.strategies.set(strategy.id, strategy);
    this.config.strategies.push(strategy);
    log.info(`[StrategyEnsemble] Added strategy: ${strategy.name}`);
  }

  /**
   * 移除策略
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
   * 启用/禁用策略
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
   * 获取所有策略
   */
  getStrategies(): Strategy[] {
    return Array.from(this.strategies.values());
  }

  /**
   * 获取启用的策略
   */
  getEnabledStrategies(): Strategy[] {
    return this.config.strategies.filter(s => s.enabled);
  }

  /**
   * 聚合多个策略信号
   */
  aggregate(signals: StrategySignal[]): EnsembleSignal[] {
    const symbolSignals = new Map<string, StrategySignal[]>();

    // 按符号分组
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

    // 限制历史记录大小
    if (this.signalHistory.length > this.maxHistorySize) {
      this.signalHistory = this.signalHistory.slice(-this.maxHistorySize);
    }

    return ensembleSignals;
  }

  /**
   * 聚合单个符号的信号
   */
  private aggregateSymbolSignals(symbol: string, signals: StrategySignal[]): EnsembleSignal | null {
    if (signals.length === 0) return null;

    // 过滤低于置信度阈值的信号
    const validSignals = signals.filter(s => s.confidence >= this.config.minConfidence);
    if (validSignals.length === 0) return null;

    // 计算投票
    const votes = new Map<string, number>();
    validSignals.forEach(signal => {
      const current = votes.get(signal.action) || 0;
      votes.set(signal.action, current + signal.confidence);
    });

    // 找到最高投票的动作
    let bestAction: 'buy' | 'sell' | 'hold' = 'hold';
    let bestVote = 0;
    votes.forEach((vote, action) => {
      if (vote > bestVote) {
        bestVote = vote;
        bestAction = action as 'buy' | 'sell' | 'hold';
      }
    });

    // 计算一致性
    const totalVotes = Array.from(votes.values()).reduce((sum, v) => sum + v, 0);
    const consensus = totalVotes > 0 ? bestVote / totalVotes : 0;

    // 计算平均置信度
    const avgConfidence = validSignals.reduce((sum, s) => sum + s.confidence, 0) / validSignals.length;

    // 检查一致性阈值
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
   * 生成再平衡信号
   */
  generateRebalanceSignals(
    currentWeights: Map<string, number>,
    targetWeights: Map<string, number>
  ): RebalanceSignal[] {
    const signals: RebalanceSignal[] = [];
    const threshold = 0.05; // 5% 阈值

    // 检查所有目标权重
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

    // 检查当前持仓中不在目标中的
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
   * 获取信号历史
   */
  getSignalHistory(): EnsembleSignal[] {
    return [...this.signalHistory];
  }

  /**
   * 清空信号历史
   */
  clearSignalHistory(): void {
    this.signalHistory = [];
  }

  /**
   * 获取组合指标
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

    // 计算最佳和最差策略
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
   * 重置
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
      throw new Error('StrategyEnsemble requires config on first initialization');
    }
    _instance = new StrategyEnsemble(config);
  }
  return _instance;
}

export function resetStrategyEnsemble(): void {
  _instance = null;
}

export default StrategyEnsemble;

/**
 * Reinforcement Learning Reward Engine
 * Dawn Whales Project (J-38-02)
 *
 * Computes rewards for trading actions to support RL-based strategy optimization.
 * Supports multiple reward types (PnL, Sharpe, risk-adjusted, drawdown penalty, composite)
 * and reward shaping modes (sparse, dense, potential-based).
 */

import log from 'electron-log';

// ---------------------------------------------------------------------------
// Minimal EventEmitter polyfill (jsdom-compatible, no Node 'events' import)
// ---------------------------------------------------------------------------

type EventListener = (...args: any[]) => void;

class EventEmitter {
  private _listeners: Record<string, EventListener[]> = {};

  on(event: string, listener: EventListener): this {
    if (!this._listeners[event]) {
      this._listeners[event] = [];
    }
    this._listeners[event].push(listener);
    return this;
  }

  off(event: string, listener: EventListener): this {
    const list = this._listeners[event];
    if (list) {
      this._listeners[event] = list.filter((l) => l !== listener);
    }
    return this;
  }

  once(event: string, listener: EventListener): this {
    const wrapper = (...args: any[]) => {
      this.off(event, wrapper);
      listener(...args);
    };
    return this.on(event, wrapper);
  }

  emit(event: string, ...args: any[]): boolean {
    const list = this._listeners[event];
    if (!list || list.length === 0) return false;
    for (const listener of [...list]) {
      try {
        listener(...args);
      } catch (err) {
        log.error(`[RewardEngine] Event listener error on "${event}":`, err);
      }
    }
    return true;
  }

  removeAllListeners(event?: string): this {
    if (event) {
      delete this._listeners[event];
    } else {
      this._listeners = {};
    }
    return this;
  }

  listenerCount(event: string): number {
    return this._listeners[event]?.length ?? 0;
  }
}

// ---------------------------------------------------------------------------
// Types & Interfaces
// ---------------------------------------------------------------------------

export type RewardType = 'pnl' | 'sharpe' | 'risk_adjusted' | 'drawdown_penalty' | 'composite';
export type RewardShaping = 'sparse' | 'dense' | 'potential_based';

export interface TradeAction {
  action: 'buy' | 'sell' | 'hold';
  code: string;
  quantity: number;
  price: number;
  timestamp: number;
  strategyId: string;
}

export interface MarketState {
  code: string;
  price: number;
  volume: number;
  rsi?: number;
  trend: 'up' | 'down' | 'sideways';
  volatility: number;
  timestamp: number;
}

export interface RewardResult {
  action: string;
  reward: number;
  components: Record<string, number>;
  shaping: RewardShaping;
  timestamp: number;
}

export interface RewardConfig {
  type: RewardType;
  shaping: RewardShaping;
  pnlWeight: number;
  sharpeWeight: number;
  drawdownPenalty: number;
  transactionCostPenalty: number;
  holdPenalty: number;
  gamma: number;
}

export interface EpisodeResult {
  episodeId: string;
  totalReward: number;
  steps: number;
  avgReward: number;
  bestAction: string;
  worstAction: string;
  rewards: RewardResult[];
}

// ---------------------------------------------------------------------------
// Internal episode tracking
// ---------------------------------------------------------------------------

interface Episode {
  episodeId: string;
  strategyId: string;
  startTime: number;
  rewards: RewardResult[];
  totalReward: number;
  steps: number;
  peakValue: number;
  currentValue: number;
  returns: number[];
  holdingSteps: number;
  lastAction: string;
}

// ---------------------------------------------------------------------------
// Default configuration
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: RewardConfig = {
  type: 'composite',
  shaping: 'dense',
  pnlWeight: 1.0,
  sharpeWeight: 0.5,
  drawdownPenalty: -0.5,
  transactionCostPenalty: -0.01,
  holdPenalty: -0.001,
  gamma: 0.99,
};

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

function generateId(prefix: string): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${ts}_${rand}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((sum, v) => sum + v, 0) / arr.length;
}

function stddev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const variance = arr.reduce((sum, v) => sum + (v - m) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

// ---------------------------------------------------------------------------
// RewardEngine
// ---------------------------------------------------------------------------

export class RewardEngine extends EventEmitter {
  private config: RewardConfig;
  private episodes: Map<string, Episode> = new Map();
  private activeEpisode: Episode | null = null;
  private episodeHistory: EpisodeResult[] = [];
  private allRewards: number[] = [];

  constructor(config?: Partial<RewardConfig>) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    log.info('[RewardEngine] Initialized', { type: this.config.type, shaping: this.config.shaping });
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Compute the reward for a single trading step.
   */
  computeReward(
    action: TradeAction,
    state: MarketState,
    nextState: MarketState,
    pnl: number,
  ): RewardResult {
    const components: Record<string, number> = {};
    let totalReward = 0;

    // --- PnL component ---
    const pnlReward = this.computePnlReward(pnl);
    components['pnl'] = pnlReward;

    // --- Sharpe component (requires return history) ---
    if (this.activeEpisode) {
      const stepReturn = state.price > 0 ? (nextState.price - state.price) / state.price : 0;
      this.activeEpisode.returns.push(stepReturn);
    }
    const sharpeReward = this.computeSharpeReward(
      this.activeEpisode?.returns ?? [],
    );
    components['sharpe'] = sharpeReward;

    // --- Drawdown penalty ---
    if (this.activeEpisode) {
      this.activeEpisode.currentValue += pnl;
      if (this.activeEpisode.currentValue > this.activeEpisode.peakValue) {
        this.activeEpisode.peakValue = this.activeEpisode.currentValue;
      }
      const drawdown =
        this.activeEpisode.peakValue > 0
          ? (this.activeEpisode.peakValue - this.activeEpisode.currentValue) /
            this.activeEpisode.peakValue
          : 0;
      const ddPenalty = this.computeDrawdownPenalty(drawdown);
      components['drawdown'] = ddPenalty;
    }

    // --- Transaction cost penalty ---
    if (action.action === 'buy' || action.action === 'sell') {
      const txPenalty = this.computeTransactionCostPenalty();
      components['transaction_cost'] = txPenalty;
    }

    // --- Hold penalty ---
    if (this.activeEpisode) {
      if (action.action === 'hold') {
        this.activeEpisode.holdingSteps += 1;
      } else {
        this.activeEpisode.holdingSteps = 0;
      }
      const holdPen = this.computeHoldPenalty(this.activeEpisode.holdingSteps);
      components['hold'] = holdPen;
    }

    // --- Potential-based shaping ---
    if (this.config.shaping === 'potential_based') {
      const shapingBonus = this.computePotentialBasedShaping(state, nextState);
      components['potential_shaping'] = shapingBonus;
    }

    // --- Compose total reward based on config type ---
    switch (this.config.type) {
      case 'pnl':
        totalReward = pnlReward;
        break;

      case 'sharpe':
        totalReward = sharpeReward;
        break;

      case 'drawdown_penalty':
        totalReward = (components['drawdown'] ?? 0) + pnlReward * 0.1;
        break;

      case 'risk_adjusted':
        totalReward =
          pnlReward * this.config.pnlWeight +
          sharpeReward * this.config.sharpeWeight +
          (components['drawdown'] ?? 0);
        break;

      case 'composite':
      default:
        totalReward = 0;
        for (const key of Object.keys(components)) {
          const weight = this.getWeightForComponent(key);
          totalReward += components[key] * weight;
        }
        break;
    }

    // --- Apply shaping mode adjustments ---
    if (this.config.shaping === 'sparse') {
      // Sparse: only reward at episode boundaries or significant events
      if (Math.abs(pnl) < 0.01) {
        totalReward = 0;
      }
    } else if (this.config.shaping === 'dense') {
      // Dense: apply discount factor to encourage earlier rewards
      if (this.activeEpisode) {
        totalReward *= Math.pow(this.config.gamma, this.activeEpisode.steps);
      }
    }
    // potential_based already added via component above

    // Clamp extreme rewards to prevent gradient explosion
    totalReward = clamp(totalReward, -10, 10);

    const result: RewardResult = {
      action: action.action,
      reward: totalReward,
      components,
      shaping: this.config.shaping,
      timestamp: action.timestamp,
    };

    // Track in active episode
    if (this.activeEpisode) {
      this.activeEpisode.rewards.push(result);
      this.activeEpisode.totalReward += totalReward;
      this.activeEpisode.steps += 1;
      this.activeEpisode.lastAction = action.action;
    }

    // Track globally
    this.allRewards.push(totalReward);

    this.emit('reward-computed', result);
    log.debug('[RewardEngine] Reward computed', {
      action: action.action,
      reward: totalReward.toFixed(4),
      type: this.config.type,
    });

    return result;
  }

  /**
   * Start a new episode for a given strategy.
   * Returns the generated episode ID.
   */
  startEpisode(strategyId: string): string {
    // End any currently active episode
    if (this.activeEpisode) {
      log.warn('[RewardEngine] Ending previous episode to start new one', {
        previousId: this.activeEpisode.episodeId,
      });
      this.endEpisode(this.activeEpisode.episodeId);
    }

    const episodeId = generateId('ep');
    const episode: Episode = {
      episodeId,
      strategyId,
      startTime: Date.now(),
      rewards: [],
      totalReward: 0,
      steps: 0,
      peakValue: 10000, // baseline starting value
      currentValue: 10000,
      returns: [],
      holdingSteps: 0,
      lastAction: '',
    };

    this.episodes.set(episodeId, episode);
    this.activeEpisode = episode;

    this.emit('episode-started', { episodeId, strategyId });
    log.info('[RewardEngine] Episode started', { episodeId, strategyId });

    return episodeId;
  }

  /**
   * End an episode and compute summary statistics.
   */
  endEpisode(episodeId: string): EpisodeResult {
    const episode = this.episodes.get(episodeId);
    if (!episode) {
      throw new Error(`[RewardEngine] Episode not found: ${episodeId}`);
    }

    const avgReward = episode.steps > 0 ? episode.totalReward / episode.steps : 0;

    // Find best and worst actions by reward
    let bestAction = '';
    let worstAction = '';
    let bestReward = -Infinity;
    let worstReward = Infinity;

    for (const r of episode.rewards) {
      if (r.reward > bestReward) {
        bestReward = r.reward;
        bestAction = r.action;
      }
      if (r.reward < worstReward) {
        worstReward = r.reward;
        worstAction = r.action;
      }
    }

    const result: EpisodeResult = {
      episodeId,
      totalReward: episode.totalReward,
      steps: episode.steps,
      avgReward,
      bestAction: bestAction || 'none',
      worstAction: worstAction || 'none',
      rewards: episode.rewards,
    };

    this.episodeHistory.push(result);

    // Clear active episode if it matches
    if (this.activeEpisode?.episodeId === episodeId) {
      this.activeEpisode = null;
    }

    this.emit('episode-ended', result);
    log.info('[RewardEngine] Episode ended', {
      episodeId,
      totalReward: result.totalReward.toFixed(4),
      steps: result.steps,
      avgReward: result.avgReward.toFixed(4),
    });

    return result;
  }

  /**
   * Get the current active episode summary, or null if none.
   */
  getCurrentEpisode(): { episodeId: string; steps: number; totalReward: number } | null {
    if (!this.activeEpisode) return null;
    return {
      episodeId: this.activeEpisode.episodeId,
      steps: this.activeEpisode.steps,
      totalReward: this.activeEpisode.totalReward,
    };
  }

  /**
   * Update the reward configuration (partial merge).
   */
  setConfig(config: Partial<RewardConfig>): void {
    const prev = { ...this.config };
    this.config = { ...this.config, ...config };
    log.info('[RewardEngine] Config updated', { prev, next: this.config });
  }

  /**
   * Get the current reward configuration.
   */
  getConfig(): RewardConfig {
    return { ...this.config };
  }

  /**
   * Retrieve episode history, optionally limited to the most recent N episodes.
   */
  getEpisodeHistory(limit?: number): EpisodeResult[] {
    if (limit !== undefined && limit > 0) {
      return this.episodeHistory.slice(-limit);
    }
    return [...this.episodeHistory];
  }

  /**
   * Compute distribution statistics over all recorded rewards.
   */
  getRewardDistribution(): {
    mean: number;
    std: number;
    min: number;
    max: number;
    histogram: number[];
  } {
    if (this.allRewards.length === 0) {
      return { mean: 0, std: 0, min: 0, max: 0, histogram: new Array(10).fill(0) };
    }

    const m = mean(this.allRewards);
    const s = stddev(this.allRewards);
    const minVal = Math.min(...this.allRewards);
    const maxVal = Math.max(...this.allRewards);

    // Build a 10-bin histogram
    const binCount = 10;
    const range = maxVal - minVal || 1;
    const binWidth = range / binCount;
    const histogram = new Array(binCount).fill(0);

    for (const r of this.allRewards) {
      let bin = Math.floor((r - minVal) / binWidth);
      if (bin >= binCount) bin = binCount - 1;
      histogram[bin] += 1;
    }

    return { mean: m, std: s, min: minVal, max: maxVal, histogram };
  }

  /**
   * Reset the engine to its initial state. Clears all episodes and history.
   */
  reset(): void {
    this.episodes.clear();
    this.activeEpisode = null;
    this.episodeHistory = [];
    this.allRewards = [];
    this.config = { ...DEFAULT_CONFIG };
    log.info('[RewardEngine] Engine reset to defaults');
  }

  // -----------------------------------------------------------------------
  // Internal reward computation methods
  // -----------------------------------------------------------------------

  /**
   * Compute the PnL-based reward component.
   * Uses a scaled tanh to bound extreme PnL values.
   */
  private computePnlReward(pnl: number): number {
    // Normalize PnL to a reasonable range using tanh
    // Assumes pnl is in percentage or small dollar terms
    const scaled = Math.tanh(pnl * 0.1);
    return scaled * this.config.pnlWeight;
  }

  /**
   * Compute a Sharpe-ratio-based reward from a series of returns.
   * Returns 0 if insufficient data.
   */
  private computeSharpeReward(returns: number[]): number {
    if (returns.length < 2) return 0;

    const avgReturn = mean(returns);
    const stdReturn = stddev(returns);

    if (stdReturn === 0) return 0;

    // Annualized Sharpe (assuming daily returns, ~252 trading days)
    const sharpe = (avgReturn / stdReturn) * Math.sqrt(252);

    // Scale and clamp
    return clamp(sharpe * this.config.sharpeWeight, -5, 5);
  }

  /**
   * Compute drawdown penalty.
   * Drawdown is a value between 0 and 1 representing peak-to-trough decline.
   */
  private computeDrawdownPenalty(drawdown: number): number {
    const clampedDd = clamp(drawdown, 0, 1);
    // Quadratic penalty: larger drawdowns are penalized disproportionately
    return this.config.drawdownPenalty * clampedDd * clampedDd;
  }

  /**
   * Compute the transaction cost penalty for executing a trade.
   */
  private computeTransactionCostPenalty(): number {
    return this.config.transactionCostPenalty;
  }

  /**
   * Compute the hold penalty, which increases with the number of
   * consecutive hold steps. Encourages the agent to act decisively.
   */
  private computeHoldPenalty(holdingSteps: number): number {
    if (holdingSteps <= 0) return 0;
    // Linearly increasing penalty with a cap
    const penalty = this.config.holdPenalty * Math.min(holdingSteps, 100);
    return penalty;
  }

  /**
   * Compute potential-based reward shaping.
   * Uses market state features to estimate a potential function Φ(s),
   * then returns γ·Φ(s') - Φ(s).
   */
  private computePotentialBasedShaping(
    state: MarketState,
    nextState: MarketState,
  ): number {
    const phiCurrent = this.estimatePotential(state);
    const phiNext = this.estimatePotential(nextState);
    return this.config.gamma * phiNext - phiCurrent;
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  /**
   * Estimate a potential function Φ(s) for a given market state.
   * Combines trend signal, RSI positioning, and volatility regime.
   */
  private estimatePotential(state: MarketState): number {
    let potential = 0;

    // Trend component: +1 for up, -1 for down, 0 for sideways
    const trendMap: Record<string, number> = { up: 1, down: -1, sideways: 0 };
    potential += (trendMap[state.trend] ?? 0) * 0.3;

    // RSI component: oversold → positive potential, overbought → negative
    if (state.rsi !== undefined) {
      const rsiNorm = (state.rsi - 50) / 50; // -1 to +1
      potential -= rsiNorm * 0.2; // contrarian signal
    }

    // Volatility component: high vol → slightly negative (risk aversion)
    potential -= state.volatility * 0.1;

    // Volume component: higher volume → more confident signal
    const volNorm = Math.min(state.volume / 1_000_000, 1);
    potential += volNorm * 0.05;

    return potential;
  }

  /**
   * Get the weight multiplier for a given reward component name.
   */
  private getWeightForComponent(key: string): number {
    switch (key) {
      case 'pnl':
        return this.config.pnlWeight;
      case 'sharpe':
        return this.config.sharpeWeight;
      case 'drawdown':
        return 1.0; // already includes config.drawdownPenalty
      case 'transaction_cost':
        return 1.0;
      case 'hold':
        return 1.0;
      case 'potential_shaping':
        return 1.0;
      default:
        return 1.0;
    }
  }
}

export default RewardEngine;

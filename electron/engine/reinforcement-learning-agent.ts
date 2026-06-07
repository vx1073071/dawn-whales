/**
 * JVS-93: Reinforcement Learning Trading Agent
 * Q-Learning based trading agent with epsilon-greedy exploration
 */

export interface RLAgentConfig {
  learningRate: number;
  discountFactor: number;
  epsilon: number;
  epsilonDecay: number;
  minEpsilon: number;
}

export interface MarketState {
  symbol?: string;
  price?: number;
  trend?: 'up' | 'down' | 'sideways';
  volatility?: number;
  position?: 'long' | 'short' | 'none';
  returns?: number;
  rsi?: number;
  macd?: number;
  macdSignal?: number;
  volume?: number;
  smaCross?: number;
  [key: string]: any;
}

export type Action = 'buy' | 'sell' | 'hold';

export class RLTradingAgent {
  private config: RLAgentConfig;
  private qTable: Map<string, Map<Action, number>> = new Map();
  private stateHistory: MarketState[] = [];
  private rewardHistory: number[] = [];
  private totalSteps: number = 0;

  constructor(config?: Partial<RLAgentConfig>) {
    this.config = {
      learningRate: 0.1,
      discountFactor: 0.95,
      epsilon: 1.0,
      epsilonDecay: 0.995,
      minEpsilon: 0.01,
      ...config,
    };
  }

  /**
   * Choose an action using epsilon-greedy policy.
   */
  selectAction(state: MarketState): Action {
    const stateKey = this.stateKey(state);
    if (!this.qTable.has(stateKey)) {
      this.qTable.set(stateKey, new Map([
        ['buy', 0],
        ['sell', 0],
        ['hold', 0],
      ]));
    }

    if (Math.random() < this.config.epsilon) {
      const actions: Action[] = ['buy', 'sell', 'hold'];
      return actions[Math.floor(Math.random() * actions.length)];
    }
    return this.bestAction(state);
  }

  /**
   * Return the best action (highest Q-value).
   */
  bestAction(state: MarketState): Action {
    const stateKey = this.stateKey(state);
    const qMap = this.qTable.get(stateKey) ?? new Map<Action, number>();
    let best: Action = 'hold';
    let bestQ = -Infinity;
    for (const [action, q] of qMap.entries()) {
      if (q > bestQ) {
        bestQ = q;
        best = action;
      }
    }
    return best;
  }

  /**
   * Update Q-table using Bellman equation.
   */
  learn(state: MarketState, action: Action, reward: number, nextState: MarketState): void {
    const stateKey = this.stateKey(state);
    const nextKey = this.stateKey(nextState);
    if (!this.qTable.has(stateKey)) {
      this.qTable.set(stateKey, new Map());
    }
    if (!this.qTable.has(nextKey)) {
      this.qTable.set(nextKey, new Map([
        ['buy', 0], ['sell', 0], ['hold', 0],
      ]));
    }
    const currentQ = this.qTable.get(stateKey)!.get(action) ?? 0;
    const nextQ = Math.max(...Array.from(this.qTable.get(nextKey)!.values()));
    const targetQ = reward + this.config.discountFactor * nextQ;
    const newQ = currentQ + this.config.learningRate * (targetQ - currentQ);
    this.qTable.get(stateKey)!.set(action, newQ);
    this.totalSteps++;

    // Decay epsilon
    this.config.epsilon = Math.max(this.config.minEpsilon, this.config.epsilon * this.config.epsilonDecay);
    this.stateHistory.push(state);
    this.rewardHistory.push(reward);
  }

  /**
   * Get current configuration.
   */
  getConfig(): RLAgentConfig {
    return { ...this.config };
  }

  /**
   * Get agent metrics.
   */
  getMetrics(): { stateCount: number; qTableSize: number; totalReward: number; avgReward: number; epsilon: number; historyLength: number; totalSteps: number } {
    let qTableSize = 0;
    for (const qMap of this.qTable.values()) qTableSize += qMap.size;
    const totalReward = this.rewardHistory.reduce((s, r) => s + r, 0);
    const avgReward = this.rewardHistory.length > 0 ? totalReward / this.rewardHistory.length : 0;
    return {
      stateCount: this.qTable.size,
      qTableSize,
      totalReward,
      avgReward,
      epsilon: this.config.epsilon,
      historyLength: this.stateHistory.length,
      totalSteps: this.totalSteps,
    };
  }

  /**
   * Set epsilon (clamped to minEpsilon).
   */
  setEpsilon(eps: number): void {
    this.config.epsilon = Math.max(this.config.minEpsilon, eps);
  }

  /**
   * Discretize market state (alias for stateKey).
   */
  discretizeState(state: MarketState): string {
    return this.stateKey(state);
  }

  /**
   * Train on a single experience (alias for learn).
   */
  train(state: MarketState, action: Action, reward: number, nextState: MarketState, done: boolean = false): void {
    if (done) {
      // Terminal state: no future Q, increment step counter
      this.totalSteps++;
      const stateKey = this.stateKey(state);
      if (!this.qTable.has(stateKey)) {
        this.qTable.set(stateKey, new Map());
      }
      const currentQ = this.qTable.get(stateKey)!.get(action) ?? 0;
      const newQ = currentQ + this.config.learningRate * (reward - currentQ);
      this.qTable.get(stateKey)!.set(action, newQ);
      this.stateHistory.push(state);
      this.rewardHistory.push(reward);
    } else {
      this.learn(state, action, reward, nextState);
    }
  }

  /**
   * Get Q-value for a state-action pair.
   */
  getQValue(state: MarketState, action: Action): number {
    return this.qTable.get(this.stateKey(state))?.get(action) ?? 0;
  }

  /**
   * Get current epsilon.
   */
  getEpsilon(): number {
    return this.config.epsilon;
  }

  /**
   * Get state history.
   */
  getHistory(): { state: MarketState; reward: number }[] {
    return this.stateHistory.map((s, i) => ({ state: s, reward: this.rewardHistory[i] ?? 0 }));
  }

  /**
   * Reset Q-table.
   */
  reset(): void {
    this.qTable.clear();
    this.stateHistory = [];
    this.rewardHistory = [];
    this.totalSteps = 0;
    this.config.epsilon = 1.0;
  }

  /**
   * Get total states learned.
   */
  getStateCount(): number {
    return this.qTable.size;
  }

  private stateKey(state: MarketState): string {
    // Include key numeric features in the key for diversity
    const parts: string[] = [];
    if (state.symbol) parts.push(state.symbol);
    if (state.trend) parts.push(state.trend);
    if (state.position) parts.push(state.position);
    if (state.returns !== undefined) parts.push(`r${state.returns.toFixed(3)}`);
    if (state.volatility !== undefined) parts.push(`v${state.volatility.toFixed(3)}`);
    if (state.rsi !== undefined) parts.push(`rsi${Math.round(state.rsi)}`);
    if (state.smaCross !== undefined) parts.push(`sma${state.smaCross}`);
    return parts.length > 0 ? parts.join('|') : 'unknown';
  }
}

export default RLTradingAgent;

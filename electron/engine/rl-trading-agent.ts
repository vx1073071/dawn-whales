import log from 'electron-log';

// ─── Interfaces & Types ───────────────────────────────────────────────────────

export interface MarketState {
  price: number;
  priceChange: number;
  volume: number;
  volumeRatio: number;
  rsi: number;
  macdHistogram: number;
  bollingerPosition: number;
  position: number; // -1=short, 0=flat, 1=long
  unrealizedPnl: number;
  barsSinceEntry: number;
}

export type Action = 'buy' | 'sell' | 'hold' | 'close_long' | 'close_short';

export interface RewardConfig {
  profitMultiplier: number;
  lossMultiplier: number;
  transactionCost: number;
  holdingPenalty: number;
  drawdownPenalty: number;
}

export interface RLConfig {
  learningRate: number;
  discountFactor: number;
  explorationRate: number;
  explorationDecay: number;
  explorationMin: number;
  batchSize: number;
  memorySize: number;
  rewardConfig: RewardConfig;
}

export interface TrainingResult {
  episodes: number;
  totalReward: number;
  avgRewardPerEpisode: number;
  bestEpisode: number;
  explorationRate: number;
  qTableSize: number;
  equityCurve: number[];
  durationMs: number;
}

// ─── Internal Types ───────────────────────────────────────────────────────────

interface Experience {
  state: string;
  actionIndex: number;
  reward: number;
  nextState: string;
  done: boolean;
}

interface DiscretizationBins {
  priceChange: number[];
  volumeRatio: number[];
  rsi: number[];
  macdHistogram: number[];
  bollingerPosition: number[];
  unrealizedPnl: number[];
  barsSinceEntry: number[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ACTIONS: Action[] = ['buy', 'sell', 'hold', 'close_long', 'close_short'];
const ACTION_COUNT = ACTIONS.length;

const DEFAULT_DISCRETIZATION: DiscretizationBins = {
  priceChange: [-0.05, -0.02, -0.005, 0, 0.005, 0.02, 0.05],
  volumeRatio: [0.5, 0.8, 1.0, 1.2, 1.5, 2.0],
  rsi: [20, 30, 40, 50, 60, 70, 80],
  macdHistogram: [-0.03, -0.01, -0.002, 0, 0.002, 0.01, 0.03],
  bollingerPosition: [-1.0, -0.5, 0, 0.5, 1.0],
  unrealizedPnl: [-0.1, -0.05, -0.02, 0, 0.02, 0.05, 0.1],
  barsSinceEntry: [0, 3, 10, 30, 100],
};

// ─── RLTradingAgent ───────────────────────────────────────────────────────────

export interface RLAgentConfig {
  learningRate?: number;
  discountFactor?: number;
  epsilon?: number;
  epsilonDecay?: number;
  minEpsilon?: number;
  batchSize?: number;
  memorySize?: number;
}

const DEFAULT_CONFIG: Required<RLAgentConfig> = {
  learningRate: 0.1,
  discountFactor: 0.95,
  epsilon: 1.0,
  epsilonDecay: 0.995,
  minEpsilon: 0.01,
  batchSize: 32,
  memorySize: 10000,
};

export class RLTradingAgent {
  private qTable: Map<string, number[]>;
  private replayBuffer: Experience[];
  private explorationRate: number;
  private episodesTrained: number;
  private totalSteps: number;
  private config: RLConfig;
  private agentConfig: Required<RLAgentConfig>;

  constructor(config?: RLAgentConfig) {
    this.agentConfig = { ...DEFAULT_CONFIG, ...config };
    this.qTable = new Map();
    this.replayBuffer = [];
    this.explorationRate = this.agentConfig.epsilon;
    this.episodesTrained = 0;
    this.totalSteps = 0;
    this.config = {
      learningRate: this.agentConfig.learningRate,
      discountFactor: this.agentConfig.discountFactor,
      explorationRate: this.agentConfig.epsilon,
      explorationDecay: this.agentConfig.epsilonDecay,
      explorationMin: this.agentConfig.minEpsilon,
      batchSize: this.agentConfig.batchSize,
      memorySize: this.agentConfig.memorySize,
      rewardConfig: {
        profitMultiplier: 1.0,
        lossMultiplier: 1.5,
        transactionCost: 0.001,
        holdingPenalty: 0.01,
        drawdownPenalty: 0.1,
      },
    };
    log.info('[RLTradingAgent] Initialized');
  }

  /**
   * Get current agent configuration.
   */
  getConfig(): Required<RLAgentConfig> {
    return { ...this.agentConfig };
  }

  /**
   * Get agent metrics.
   */
  getMetrics(): { qTableSize: number; totalSteps: number; episodesTrained: number; explorationRate: number } {
    return {
      qTableSize: this.qTable.size,
      totalSteps: this.totalSteps,
      episodesTrained: this.episodesTrained,
      explorationRate: this.explorationRate,
    };
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  /**
   * Train the Q-learning agent on historical kline data.
   * Each episode walks through the full kline series, simulating trades.
   */
  train(klines: any[], config: RLConfig, episodes: number = 200): TrainingResult {
    log.info(`[RLTradingAgent] Starting training: ${klines.length} bars, ${episodes} episodes`);
    const startTime = Date.now();
    this.config = config;
    this.explorationRate = config.explorationRate;

    const equityCurve: number[] = [];
    let totalReward = 0;
    let bestEpisode = 0;
    let bestReward = -Infinity;

    // Pre-compute market states for each bar
    const states: MarketState[] = this.buildStateSequence(klines);
    log.info(`[RLTradingAgent] Built ${states.length} market states from klines`);

    for (let ep = 0; ep < episodes; ep++) {
      const { episodeReward, steps } = this.runEpisode(states, config);

      totalReward += episodeReward;
      equityCurve.push(episodeReward);

      if (episodeReward > bestReward) {
        bestReward = episodeReward;
        bestEpisode = ep;
      }

      // Decay exploration
      this.explorationRate = Math.max(
        config.explorationMin,
        this.explorationRate * config.explorationDecay
      );

      // Periodic experience replay
      if ((ep + 1) % 5 === 0 && this.replayBuffer.length >= config.batchSize) {
        this.experienceReplay(config);
      }

      this.episodesTrained++;

      if ((ep + 1) % 50 === 0) {
        log.info(
          `[RLTraining] Episode ${ep + 1}/${episodes} | ` +
          `Reward: ${episodeReward.toFixed(4)} | Avg: ${(totalReward / (ep + 1)).toFixed(4)} | ` +
          `Epsilon: ${this.explorationRate.toFixed(4)} | Q-table: ${this.qTable.size}`
        );
      }
    }

    const durationMs = Date.now() - startTime;
    const avgRewardPerEpisode = episodes > 0 ? totalReward / episodes : 0;

    const result: TrainingResult = {
      episodes,
      totalReward,
      avgRewardPerEpisode,
      bestEpisode,
      explorationRate: this.explorationRate,
      qTableSize: this.qTable.size,
      equityCurve,
      durationMs,
    };

    log.info(
      `[RLTradingAgent] Training complete: avg_reward=${avgRewardPerEpisode.toFixed(4)}, ` +
      `qTableSize=${this.qTable.size}, duration=${durationMs}ms`
    );

    return result;
  }

  /**
   * Predict the best action for a given market state (exploitation only).
   */
  predict(state: MarketState): Action {
    const stateKey = this.discretizeState(state);
    const qValues = this.qTable.get(stateKey);

    if (!qValues) {
      // No knowledge — default to hold
      return 'hold';
    }

    const bestIndex = this.argmax(qValues);
    return ACTIONS[bestIndex];
  }

  /**
   * Serialize the Q-table and agent metadata to a JSON string.
   */
  save(): string {
    const data = {
      version: 1,
      episodesTrained: this.episodesTrained,
      totalSteps: this.totalSteps,
      explorationRate: this.explorationRate,
      qTableEntries: Array.from(this.qTable.entries()),
    };

    const json = JSON.stringify(data);
    log.info(
      `[RLTradingAgent] Saved model: ${this.qTable.size} entries, ${json.length} bytes`
    );
    return json;
  }

  /**
   * Load a previously saved Q-table from JSON string.
   */
  load(data: string): boolean {
    try {
      const parsed = JSON.parse(data);

      if (!parsed.version || !Array.isArray(parsed.qTableEntries)) {
        log.warn('[RLTradingAgent] Invalid save data format');
        return false;
      }

      this.qTable = new Map<string, number[]>(parsed.qTableEntries);
      this.episodesTrained = parsed.episodesTrained ?? 0;
      this.totalSteps = parsed.totalSteps ?? 0;
      this.explorationRate = parsed.explorationRate ?? 1.0;
      this.replayBuffer = [];

      log.info(
        `[RLTradingAgent] Loaded model: ${this.qTable.size} entries, ` +
        `episodesTrained=${this.episodesTrained}`
      );
      return true;
    } catch (err: unknown) {
      log.error(`[RLTradingAgent] Failed to load model: ${err.message}`);
      return false;
    }
  }

  /**
   * Get current agent state summary.
   */
  getState(): { qTableSize: number; explorationRate: number; episodesTrained: number } {
    return {
      qTableSize: this.qTable.size,
      explorationRate: this.explorationRate,
      episodesTrained: this.episodesTrained,
    };
  }

  /**
   * Reset the agent completely — clears Q-table, replay buffer, and counters.
   */
  reset(): void {
    this.qTable = new Map();
    this.replayBuffer = [];
    this.explorationRate = 1.0;
    this.episodesTrained = 0;
    this.totalSteps = 0;
    this.config = null;
    log.info('[RLTradingAgent] Agent reset');
  }

  // ─── Internal: State Discretization ───────────────────────────────────────

  /**
   * Convert a continuous MarketState into a discrete string key for the Q-table.
   * Each dimension is binned into buckets to keep the state space manageable.
   * Accepts both MarketState and alternative state formats for backward compatibility.
   */
  discretizeState(state: MarketState | any): string {
    const bins = DEFAULT_DISCRETIZATION;

    // Handle alternative state format (backward compatibility)
    const priceChange = state.priceChange ?? state.returns ?? 0;
    const volumeRatio = state.volumeRatio ?? (state.volume ? state.volume / 1000000 : 1) ?? 1;
    const rsi = state.rsi ?? 50;
    const macdHistogram = state.macdHistogram ?? state.macd ?? 0;
    const bollingerPosition = state.bollingerPosition ?? 0;
    const unrealizedPnl = state.unrealizedPnl ?? 0;
    const barsSinceEntry = state.barsSinceEntry ?? 0;
    const position = state.position ?? state.smaCross ?? 0;

    const pChange = this.binValue(priceChange, bins.priceChange);
    const vol = this.binValue(volumeRatio, bins.volumeRatio);
    const rsiBin = this.binValue(rsi, bins.rsi);
    const macd = this.binValue(macdHistogram, bins.macdHistogram);
    const boll = this.binValue(bollingerPosition, bins.bollingerPosition);
    const pnl = this.binValue(unrealizedPnl, bins.unrealizedPnl);
    const bars = this.binValue(barsSinceEntry, bins.barsSinceEntry);

    // Position is already discrete: -1, 0, 1 → map to 0, 1, 2
    const posBucket = position + 1;

    return `${pChange}|${vol}|${rsiBin}|${macd}|${boll}|${pnl}|${bars}|${posBucket}`;
  }

  /**
   * Bin a continuous value into a discrete bucket index.
   * Returns the index of the first bin edge that the value is less than,
   * or the last bucket if it exceeds all edges.
   */
  private binValue(value: number, edges: number[]): number {
    for (let i = 0; i < edges.length; i++) {
      if (value < edges[i]) {
        return i;
      }
    }
    return edges.length;
  }

  // ─── Internal: Action Selection ───────────────────────────────────────────

  /**
   * Epsilon-greedy action selection.
   * With probability epsilon, explore a random action.
   * Otherwise, exploit the best known action from the Q-table.
   */
  private selectAction(stateKey: string): Action {
    const random = Math.random();

    if (random < this.explorationRate) {
      // Explore: random action
      const idx = Math.floor(Math.random() * ACTION_COUNT);
      return ACTIONS[idx];
    }

    // Exploit: best action from Q-table
    const qValues = this.qTable.get(stateKey);

    if (!qValues) {
      // Initialize Q-values for this state with small random values
      const initialValues = this.initializeQValues();
      this.qTable.set(stateKey, initialValues);
      const idx = this.argmax(initialValues);
      return ACTIONS[idx];
    }

    const bestIndex = this.argmax(qValues);
    return ACTIONS[bestIndex];
  }

  /**
   * Initialize Q-values for a newly seen state.
   * Uses small random values near zero to encourage early exploration.
   */
  private initializeQValues(): number[] {
    const values: number[] = [];
    for (let i = 0; i < ACTION_COUNT; i++) {
      values.push((Math.random() - 0.5) * 0.1);
    }
    return values;
  }

  /**
   * Get the Q-value index for a specific action.
   */
  private getActionIndex(action: Action): number {
    return ACTIONS.indexOf(action);
  }

  // ─── Internal: Q-Learning Update ──────────────────────────────────────────

  /**
   * Update Q-value using the standard Q-learning (off-policy TD control) formula:
   * Q(s,a) ← Q(s,a) + α * (reward + γ * max Q(s',a') - Q(s,a))
   */
  private updateQ(
    stateKey: string,
    action: Action,
    reward: number,
    nextStateKey: string,
    done: boolean
  ): void {
    if (!this.config) return;

    const { learningRate: alpha, discountFactor: gamma } = this.config;
    const actionIdx = this.getActionIndex(action);

    // Ensure Q-values exist for current state
    let qValues = this.qTable.get(stateKey);
    if (!qValues) {
      qValues = this.initializeQValues();
      this.qTable.set(stateKey, qValues);
    }

    // Compute max Q for next state (target)
    let maxNextQ = 0;
    if (!done) {
      let nextQValues = this.qTable.get(nextStateKey);
      if (!nextQValues) {
        nextQValues = this.initializeQValues();
        this.qTable.set(nextStateKey, nextQValues);
      }
      maxNextQ = this.maxValue(nextQValues);
    }

    // TD target
    const tdTarget = reward + gamma * maxNextQ;
    const tdError = tdTarget - qValues[actionIdx];

    // Update
    qValues[actionIdx] = qValues[actionIdx] + alpha * tdError;

    // Clip Q-values to prevent divergence
    qValues[actionIdx] = Math.max(-100, Math.min(100, qValues[actionIdx]));
  }

  // ─── Internal: Reward Computation ─────────────────────────────────────────

  /**
   * Compute shaped reward for a transition.
   * Incorporates profit/loss, transaction costs, holding penalties, and drawdown.
   */
  private computeReward(
    action: Action,
    prevState: MarketState,
    nextState: MarketState,
    config: RLConfig
  ): number {
    const rc = config.rewardConfig;
    let reward = 0;

    // ── Profit / Loss component ──
    if (prevState.position !== 0) {
      // We had an open position — reward based on PnL change
      const pnlDelta = nextState.unrealizedPnl - prevState.unrealizedPnl;
      if (pnlDelta >= 0) {
        reward += pnlDelta * rc.profitMultiplier;
      } else {
        reward += pnlDelta * rc.lossMultiplier;
      }
    }

    // ── Transaction cost ──
    if (action === 'buy' || action === 'sell') {
      reward -= rc.transactionCost;
    }
    if (action === 'close_long' || action === 'close_short') {
      reward -= rc.transactionCost * 0.5;
    }

    // ── Realized PnL on close ──
    if (action === 'close_long' && prevState.position === 1) {
      reward += prevState.unrealizedPnl * rc.profitMultiplier * 2;
    }
    if (action === 'close_short' && prevState.position === -1) {
      reward += prevState.unrealizedPnl * rc.profitMultiplier * 2;
    }

    // ── Holding penalty — discourage sitting in losing positions ──
    if (prevState.position !== 0 && prevState.unrealizedPnl < 0) {
      reward -= rc.holdingPenalty * Math.abs(prevState.unrealizedPnl);
    }

    // ── Drawdown penalty — penalize large unrealized losses ──
    if (nextState.unrealizedPnl < -0.05) {
      reward -= rc.drawdownPenalty * Math.abs(nextState.unrealizedPnl);
    }

    // ── Penalty for invalid actions ──
    if (this.isInvalidAction(action, prevState.position)) {
      reward -= 1.0;
    }

    // ── Small reward for staying flat in high-volatility, uncertain conditions ──
    if (action === 'hold' && prevState.position === 0) {
      // Neutral — no penalty for prudent flat holding
      reward += 0.001;
    }

    return reward;
  }

  /**
   * Check whether an action is invalid given the current position.
   */
  private isInvalidAction(action: Action, position: number): boolean {
    // Can't buy if already long
    if (action === 'buy' && position === 1) return true;
    // Can't sell (open short) if already short
    if (action === 'sell' && position === -1) return true;
    // Can't close long if not long
    if (action === 'close_long' && position !== 1) return true;
    // Can't close short if not short
    if (action === 'close_short' && position !== -1) return true;

    return false;
  }

  // ─── Internal: Episode Execution ──────────────────────────────────────────

  /**
   * Run a single training episode through the entire state sequence.
   * Returns total reward and step count.
   */
  private runEpisode(
    states: MarketState[],
    config: RLConfig
  ): { episodeReward: number; steps: number } {
    let episodeReward = 0;
    let currentSimPosition = 0; // -1, 0, 1
    let currentSimPnl = 0;
    let barsInPosition = 0;

    for (let i = 0; i < states.length - 1; i++) {
      const rawState = states[i];
      const nextState = states[i + 1];

      // Build simulated state with current position tracking
      const simState: MarketState = {
        ...rawState,
        position: currentSimPosition,
        unrealizedPnl: currentSimPnl,
        barsSinceEntry: barsInPosition,
      };

      const stateKey = this.discretizeState(simState);
      const action = this.selectAction(stateKey);

      // Apply action to get new simulated position
      const { newPosition, newPnl } = this.applyAction(
        action,
        currentSimPosition,
        currentSimPnl,
        nextState.price - rawState.price,
        rawState.price
      );

      currentSimPosition = newPosition;
      currentSimPnl = newPnl;
      barsInPosition = currentSimPosition !== 0 ? barsInPosition + 1 : 0;

      // Build next simulated state for reward
      const nextSimState: MarketState = {
        ...nextState,
        position: currentSimPosition,
        unrealizedPnl: currentSimPnl,
        barsSinceEntry: barsInPosition,
      };

      // Compute reward
      const reward = this.computeReward(action, simState, nextSimState, config);
      episodeReward += reward;

      // Q-learning update
      const nextStateKey = this.discretizeState(nextSimState);
      const done = i === states.length - 2;
      this.updateQ(stateKey, action, reward, nextStateKey, done);

      // Store experience for replay
      this.storeExperience(stateKey, this.getActionIndex(action), reward, nextStateKey, done);

      this.totalSteps++;

      // Reset PnL on position close
      if (currentSimPosition === 0) {
        currentSimPnl = 0;
        barsInPosition = 0;
      }
    }

    return { episodeReward, steps: states.length - 1 };
  }

  /**
   * Apply an action to the current simulated position.
   * Returns the new position and unrealized PnL.
   */
  private applyAction(
    action: Action,
    currentPos: number,
    currentPnl: number,
    priceDelta: number,
    currentPrice: number
  ): { newPosition: number; newPnl: number } {
    let newPosition = currentPos;
    let newPnl = currentPnl;

    // Update unrealized PnL for existing position
    if (currentPos !== 0 && currentPrice > 0) {
      const returns = priceDelta / currentPrice;
      newPnl = currentPnl + returns * currentPos;
    }

    switch (action) {
      case 'buy':
        if (currentPos === -1) {
          // Close short, don't open long (two-step: close then open)
          newPosition = 0;
          newPnl = 0;
        } else if (currentPos === 0) {
          newPosition = 1;
          newPnl = 0;
        }
        break;

      case 'sell':
        if (currentPos === 1) {
          // Close long
          newPosition = 0;
          newPnl = 0;
        } else if (currentPos === 0) {
          newPosition = -1;
          newPnl = 0;
        }
        break;

      case 'close_long':
        if (currentPos === 1) {
          newPosition = 0;
          newPnl = 0;
        }
        break;

      case 'close_short':
        if (currentPos === -1) {
          newPosition = 0;
          newPnl = 0;
        }
        break;

      case 'hold':
        // Keep current position and PnL
        break;
    }

    return { newPosition, newPnl };
  }

  // ─── Internal: Experience Replay ──────────────────────────────────────────

  /**
   * Store an experience in the replay buffer.
   * Evicts oldest experiences when buffer exceeds max size.
   */
  private storeExperience(
    state: string,
    actionIndex: number,
    reward: number,
    nextState: string,
    done: boolean
  ): void {
    if (!this.config) return;

    const experience: Experience = { state, actionIndex, reward, nextState, done };
    this.replayBuffer.push(experience);

    // Evict oldest if over capacity
    while (this.replayBuffer.length > this.config.memorySize) {
      this.replayBuffer.shift();
    }
  }

  /**
   * Sample a batch from the replay buffer and re-apply Q-learning updates.
   * Uses prioritized sampling — experiences with higher absolute rewards are
   * more likely to be sampled.
   */
  private experienceReplay(config: RLConfig): void {
    if (this.replayBuffer.length < config.batchSize) return;

    const batch = this.sampleBatch(config.batchSize);

    for (const exp of batch) {
      const action = ACTIONS[exp.actionIndex];
      this.updateQ(exp.state, action, exp.reward, exp.nextState, exp.done);
    }

    log.debug(
      `[RLReplay] Replayed ${batch.length} experiences from buffer (size: ${this.replayBuffer.length})`
    );
  }

  /**
   * Sample a random batch from the replay buffer.
   * Uses weighted sampling biased toward high-reward and recent experiences.
   */
  private sampleBatch(batchSize: number): Experience[] {
    const batch: Experience[] = [];
    const bufferLen = this.replayBuffer.length;

    // Simple uniform sampling for performance
    const usedIndices = new Set<number>();

    let attempts = 0;
    const maxAttempts = batchSize * 3;

    while (batch.length < batchSize && attempts < maxAttempts) {
      const idx = Math.floor(Math.random() * bufferLen);
      attempts++;

      if (usedIndices.has(idx)) continue;
      usedIndices.add(idx);

      batch.push(this.replayBuffer[idx]);
    }

    return batch;
  }

  // ─── Internal: State Building ─────────────────────────────────────────────

  /**
   * Build a sequence of MarketState objects from raw kline data.
   * Computes technical indicators (RSI, MACD histogram, Bollinger position).
   */
  private buildStateSequence(klines: any[]): MarketState[] {
    const states: MarketState[] = [];
    const closes: number[] = [];
    const volumes: number[] = [];

    for (const k of klines) {
      const close = typeof k.close === 'number' ? k.close : parseFloat(k.close) || 0;
      const volume = typeof k.volume === 'number' ? k.volume : parseFloat(k.volume) || 0;
      closes.push(close);
      volumes.push(volume);
    }

    if (closes.length < 26) {
      log.warn(`[RLTradingAgent] Only ${closes.length} bars — need at least 26 for indicators`);
    }

    // Compute average volume for volume ratio
    const avgVolumeWindow = Math.min(20, volumes.length);
    const totalVol = volumes.reduce((s, v) => s + v, 0);
    const avgVolume = totalVol / Math.max(1, volumes.length);

    for (let i = 1; i < closes.length; i++) {
      const price = closes[i];
      const prevPrice = closes[i - 1];
      const priceChange = prevPrice !== 0 ? (price - prevPrice) / prevPrice : 0;

      const vol = volumes[i];
      const volumeRatio = avgVolume > 0 ? vol / avgVolume : 1;

      // RSI (14-period)
      const rsi = this.computeRSI(closes, i, 14);

      // MACD histogram
      const macdHistogram = this.computeMACDHistogram(closes, i);

      // Bollinger Band position (normalized 0-1 within bands)
      const bollingerPosition = this.computeBollingerPosition(closes, i, 20, 2);

      const state: MarketState = {
        price,
        priceChange,
        volume: vol,
        volumeRatio,
        rsi,
        macdHistogram,
        bollingerPosition,
        position: 0, // Will be set during episode simulation
        unrealizedPnl: 0,
        barsSinceEntry: 0,
      };

      states.push(state);
    }

    return states;
  }

  // ─── Internal: Technical Indicators ───────────────────────────────────────

  /**
   * Compute RSI (Relative Strength Index) for the given index.
   */
  private computeRSI(closes: number[], index: number, period: number = 14): number {
    if (index < period) return 50; // Default neutral

    let gains = 0;
    let losses = 0;
    const start = Math.max(1, index - period + 1);
    const count = Math.min(period, index);

    for (let i = start; i <= index; i++) {
      const change = closes[i] - closes[i - 1];
      if (change >= 0) {
        gains += change;
      } else {
        losses -= change;
      }
    }

    const avgGain = gains / count;
    const avgLoss = losses / count;

    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - 100 / (1 + rs);
  }

  /**
   * Compute MACD histogram (MACD line - signal line).
   * Uses standard 12/26/9 periods.
   */
  private computeMACDHistogram(closes: number[], index: number): number {
    if (index < 26) return 0;

    const ema12 = this.computeEMA(closes, index, 12);
    const ema26 = this.computeEMA(closes, index, 26);
    const macdLine = ema12 - ema26;

    // Approximate signal line as EMA of MACD values over recent bars
    const macdValues: number[] = [];
    const lookback = Math.min(9, index - 25);

    for (let j = 0; j < lookback; j++) {
      const idx = index - j;
      if (idx < 26) break;
      const e12 = this.computeEMA(closes, idx, 12);
      const e26 = this.computeEMA(closes, idx, 26);
      macdValues.unshift(e12 - e26);
    }

    const signalLine =
      macdValues.length > 0
        ? macdValues.reduce((s, v) => s + v, 0) / macdValues.length
        : 0;

    return macdLine - signalLine;
  }

  /**
   * Compute EMA (Exponential Moving Average) at a specific index.
   */
  private computeEMA(data: number[], index: number, period: number): number {
    const k = 2 / (period + 1);
    const start = Math.max(0, index - period * 2);

    let ema = data[start];
    for (let i = start + 1; i <= index; i++) {
      ema = data[i] * k + ema * (1 - k);
    }
    return ema;
  }

  /**
   * Compute normalized Bollinger Band position.
   * Returns -1 at lower band, 0 at middle, +1 at upper band.
   */
  private computeBollingerPosition(
    closes: number[],
    index: number,
    period: number = 20,
    multiplier: number = 2
  ): number {
    if (index < period) return 0;

    const start = Math.max(0, index - period + 1);
    const slice = closes.slice(start, index + 1);
    const mean = slice.reduce((s, v) => s + v, 0) / slice.length;

    const variance = slice.reduce((s, v) => s + (v - mean) ** 2, 0) / slice.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) return 0;

    const upperBand = mean + multiplier * stdDev;
    const lowerBand = mean - multiplier * stdDev;
    const bandwidth = upperBand - lowerBand;

    if (bandwidth === 0) return 0;

    // Normalize: -1 at lower band, +1 at upper band
    return (2 * (closes[index] - lowerBand)) / bandwidth - 1;
  }

  // ─── Internal: Utility Functions ──────────────────────────────────────────

  /**
   * Return the index of the maximum value in an array.
   * Breaks ties by returning the first occurrence.
   */
  private argmax(values: number[]): number {
    let maxIdx = 0;
    let maxVal = values[0];

    for (let i = 1; i < values.length; i++) {
      if (values[i] > maxVal) {
        maxVal = values[i];
        maxIdx = i;
      }
    }

    return maxIdx;
  }

  /**
   * Return the maximum value in an array.
   */
  private maxValue(values: number[]): number {
    let max = values[0];
    for (let i = 1; i < values.length; i++) {
      if (values[i] > max) {
        max = values[i];
      }
    }
    return max;
  }
}

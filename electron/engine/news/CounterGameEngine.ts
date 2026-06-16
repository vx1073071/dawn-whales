/**
 * P2-15 CounterGameEngine — Game-Theoretic Counter-Trading Engine
 * R250 — P2 Deepening
 * JVS / 引擎虾
 *
 * Models market as a multi-player game. Detects adversarial behaviors,
 * computes Nash-like equilibria among strategies, identifies dominant
 * strategies, and suggests counter-trades. Applies game theory to
 * predict rival moves and optimize own position.
 * Singleton pattern, fully testable with reset().
 */

import log from 'electron-log';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export type GameAction = 'buy' | 'sell' | 'hold' | 'accumulate' | 'distribute' | 'squeeze' | 'hunt_stop';

export type PlayerType = 'retail' | 'institution' | 'market_maker' | 'whale' | 'arbitrageur' | 'self';

export interface GamePlayer {
  id: string;
  type: PlayerType;
  symbol: string;
  /** Estimated position (signed: positive = long, negative = short) */
  estimatedPosition: number;
  /** Estimated average cost */
  estimatedCost: number;
  /** Confidence in position estimate 0-1 */
  confidence: number;
  /** Recent actions detected */
  recentActions: GameAction[];
  /** Aggressiveness 0-1 */
  aggressiveness: number;
  /** Sophistication 0-1 (0 = predictable, 1 = strategic) */
  sophistication: number;
  /** Resources (capital weight) */
  capitalWeight: number;
  lastUpdated: number;
}

export interface StrategyProfile {
  id: string;
  name: string;
  /** Payoff matrix entry */
  action: GameAction;
  expectedPayoff: number;
  risk: number; // 0-1
  /** Nash equilibrium indicator */
  isNashEquilibrium: boolean;
  /** Is this a dominant strategy? */
  isDominant: boolean;
  /** Counter-actions to this strategy */
  counterActions: GameAction[];
}

export interface GameAnalysis {
  id: string;
  symbol: string;
  players: GamePlayer[];
  profiles: StrategyProfile[];
  /** Detected game pattern */
  detectedPattern: GamePattern;
  /** Recommended counter-action */
  recommendedAction: GameAction;
  /** Recommended position adjustment */
  positionAdjustment: number; // signed
  /** Conviction 0-1 */
  conviction: number;
  /** Risk of counter-action */
  counterRisk: number;
  /** Explanation */
  reasoning: string;
  analyzedAt: number;
}

export interface GamePattern {
  name: string;
  description: string;
  /** Players involved */
  players: string[];
  /** Likelihood of pattern */
  confidence: number;
  /** Adversarial intensity 0-1 */
  adversarialIntensity: number;
}

export interface PayoffMatrix {
  symbol: string;
  actions: GameAction[];
  /** payoff[a][b] = payoff to self when self plays action[a] and rival plays action[b] */
  payoffs: number[][];
  playerIds: string[];
}

// ═══════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════

const ACTION_PAYOFF_BASE: Record<GameAction, Record<GameAction, number>> = {
  buy:          { buy: 0.2, sell: 0.8, hold: 0.5, accumulate: 0.6, distribute: 0.1, squeeze: -0.5, hunt_stop: -0.3 },
  sell:         { buy: 0.8, sell: 0.1, hold: 0.7, accumulate: 0.3, distribute: 0.6, squeeze: 0.5, hunt_stop: 0.2 },
  hold:         { buy: 0.1, sell: 0.1, hold: 0, accumulate: -0.1, distribute: -0.1, squeeze: -0.2, hunt_stop: -0.2 },
  accumulate:   { buy: 0.4, sell: 0.2, hold: 0.6, accumulate: 0.3, distribute: -0.1, squeeze: -0.4, hunt_stop: -0.1 },
  distribute:   { buy: -0.1, sell: 0.5, hold: 0.4, accumulate: -0.3, distribute: -0.2, squeeze: -0.3, hunt_stop: -0.3 },
  squeeze:      { buy: -1.0, sell: 0.9, hold: 0.8, accumulate: 0.7, distribute: 0.7, squeeze: 0.5, hunt_stop: 0.8 },
  hunt_stop:    { buy: -0.6, sell: 0.6, hold: 0.5, accumulate: -0.2, distribute: 0.2, squeeze: 0.2, hunt_stop: 0.1 },
};

const PATTERN_SIGNATURES: Array<{
  name: string;
  description: string;
  detect: (players: GamePlayer[]) => { match: boolean; adversarialIntensity: number };
}> = [
  {
    name: 'whale_distribution',
    description: 'A whale is distributing (selling into strength), trapping retail buyers.',
    detect: (players) => {
      const whale = players.find(p => p.type === 'whale');
      const retail = players.filter(p => p.type === 'retail');
      if (!whale || retail.length === 0) return { match: false, adversarialIntensity: 0 };
      const whaleSells = whale.recentActions.filter(a => a === 'distribute' || a === 'sell').length;
      const retailBuys = retail.reduce((s, r) => s + r.recentActions.filter(a => a === 'buy' || a === 'accumulate').length, 0);
      if (whaleSells >= 1 && retailBuys >= 2) {
        return { match: true, adversarialIntensity: 0.7 };
      }
      return { match: false, adversarialIntensity: 0 };
    },
  },
  {
    name: 'stop_hunting',
    description: 'Institutions are hunting stop-loss orders, creating fake breakdowns.',
    detect: (players) => {
      const inst = players.filter(p => p.type === 'institution' || p.type === 'whale');
      const hunting = inst.filter(p => p.recentActions.includes('hunt_stop'));
      if (hunting.length >= 1) {
        return { match: true, adversarialIntensity: 0.9 };
      }
      return { match: false, adversarialIntensity: 0 };
    },
  },
  {
    name: 'bull_trap',
    description: 'Whale accumulation disguised as weakness, trap short sellers.',
    detect: (players) => {
      const whales = players.filter(p => p.type === 'whale');
      const hasAccumulate = whales.some(p => p.recentActions.includes('accumulate'));
      const shortsHunting = players.some(p => p.recentActions.includes('hunt_stop') || p.recentActions.includes('squeeze'));
      if (hasAccumulate && shortsHunting) {
        return { match: true, adversarialIntensity: 0.85 };
      }
      return { match: false, adversarialIntensity: 0 };
    },
  },
  {
    name: 'bear_trap',
    description: 'Fake sell-off to trigger retail panic, then reversal higher.',
    detect: (players) => {
      const inst = players.find(p => p.type === 'institution');
      const retail = players.filter(p => p.type === 'retail');
      const instSells = inst?.recentActions.filter(a => a === 'sell' || a === 'distribute').length || 0;
      const retailPanic = retail.filter(r => r.recentActions.includes('sell')).length;
      if (instSells >= 1 && retailPanic >= 2) {
        return { match: true, adversarialIntensity: 0.8 };
      }
      return { match: false, adversarialIntensity: 0 };
    },
  },
  {
    name: 'accumulation_zone',
    description: 'Smart money quietly accumulating in a range.',
    detect: (players) => {
      const smart = players.filter(p => p.type === 'institution' || p.type === 'whale');
      const accumulating = smart.filter(p => p.recentActions.includes('accumulate'));
      if (accumulating.length >= 2) {
        return { match: true, adversarialIntensity: 0.6 };
      }
      return { match: false, adversarialIntensity: 0 };
    },
  },
];

// ═══════════════════════════════════════════════════════════════
// Engine
// ═══════════════════════════════════════════════════════════════

export class CounterGameEngine {
  private static instance: CounterGameEngine;

  private players: Map<string, GamePlayer> = new Map();
  private analyses: Map<string, GameAnalysis[]> = new Map(); // symbol → analyses
  private idCounter = 0;

  private constructor() {}

  static getInstance(): CounterGameEngine {
    if (!CounterGameEngine.instance) {
      CounterGameEngine.instance = new CounterGameEngine();
    }
    return CounterGameEngine.instance;
  }

  reset(): void {
    this.players.clear();
    this.analyses.clear();
    this.idCounter = 0;
  }

  private nextId(): string {
    return `cge-${++this.idCounter}`;
  }

  // ═══════════════════════════════════════════════════════════════
  // Player Management
  // ═══════════════════════════════════════════════════════════════

  registerPlayer(params: {
    id: string;
    type: PlayerType;
    symbol: string;
    estimatedPosition: number;
    estimatedCost: number;
    confidence: number;
    recentActions: GameAction[];
    aggressiveness: number;
    sophistication: number;
    capitalWeight: number;
  }): GamePlayer {
    const player: GamePlayer = {
      id: params.id,
      type: params.type,
      symbol: params.symbol.toUpperCase(),
      estimatedPosition: params.estimatedPosition,
      estimatedCost: params.estimatedCost,
      confidence: Math.max(0, Math.min(1, params.confidence)),
      recentActions: params.recentActions,
      aggressiveness: Math.max(0, Math.min(1, params.aggressiveness)),
      sophistication: Math.max(0, Math.min(1, params.sophistication)),
      capitalWeight: Math.max(0, params.capitalWeight),
      lastUpdated: Date.now(),
    };
    this.players.set(player.id, player);
    return player;
  }

  updatePlayer(id: string, updates: Partial<Pick<GamePlayer, 'estimatedPosition' | 'estimatedCost' | 'confidence' | 'recentActions' | 'aggressiveness'>>): GamePlayer | null {
    const p = this.players.get(id);
    if (!p) return null;
    Object.assign(p, updates, { lastUpdated: Date.now() });
    if (updates.confidence !== undefined) p.confidence = Math.max(0, Math.min(1, updates.confidence));
    if (updates.aggressiveness !== undefined) p.aggressiveness = Math.max(0, Math.min(1, updates.aggressiveness));
    return p;
  }

  getPlayer(id: string): GamePlayer | undefined {
    return this.players.get(id);
  }

  getPlayersBySymbol(symbol: string): GamePlayer[] {
    return Array.from(this.players.values()).filter(p => p.symbol === symbol.toUpperCase());
  }

  // ═══════════════════════════════════════════════════════════════
  // Payoff Matrix Computation
  // ═══════════════════════════════════════════════════════════════

  computePayoffMatrix(players: GamePlayer[], selfId: string): PayoffMatrix {
    const actions: GameAction[] = ['buy', 'sell', 'hold', 'accumulate', 'distribute', 'squeeze', 'hunt_stop'];
    const otherPlayers = players.filter(p => p.id !== selfId);
    const payoffs: number[][] = [];
    const playerIds = [selfId, ...otherPlayers.map(p => p.id)];

    for (const actionA of actions) {
      const row: number[] = [];
      for (const actionB of actions) {
        let payoff = ACTION_PAYOFF_BASE[actionA][actionB] || 0;

        // Adjust by player sophistication and aggression
        for (const other of otherPlayers) {
          const adjustment = other.sophistication * other.aggressiveness * 0.5;
          payoff *= (1 - adjustment);
        }

        // Add self's capital and sophistication bonus
        const self = players.find(p => p.id === selfId);
        if (self) {
          payoff *= (1 + self.sophistication * 0.3);
        }

        row.push(Math.round(payoff * 100) / 100);
      }
      payoffs.push(row);
    }

    return { symbol: players[0]?.symbol || 'UNKNOWN', actions, payoffs, playerIds: playerIds.slice(0, 2) };
  }

  findNashEquilibria(matrix: PayoffMatrix): StrategyProfile[] {
    const profiles: StrategyProfile[] = [];
    const n = matrix.actions.length;

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        // Check if (i,j) is Nash: payoff[i][j] >= payoff[k][j] for all k
        let isNash = true;
        for (let k = 0; k < n; k++) {
          if (matrix.payoffs[k][j] > matrix.payoffs[i][j]) {
            isNash = false;
            break;
          }
        }

        // Check if dominant: strategy i beats all opponent strategies
        let isDominant = true;
        for (let k = 0; k < n; k++) {
          if (k === i) continue;
          let beats = true;
          for (let j2 = 0; j2 < n; j2++) {
            if (matrix.payoffs[k][j2] >= matrix.payoffs[i][j2]) {
              beats = false;
              break;
            }
          }
          if (!beats) { isDominant = false; break; }
        }

        const payoff = matrix.payoffs[i][j];
        const bestPayoff = Math.max(...matrix.payoffs.map(row => Math.max(...row)));
        const risk = bestPayoff > 0 ? 1 - (payoff / bestPayoff) : 0.5;

        profiles.push({
          id: this.nextId(),
          name: `Strategy-${matrix.actions[i]}-vs-${matrix.actions[j]}`,
          action: matrix.actions[i],
          expectedPayoff: payoff,
          risk: Math.round(risk * 100) / 100,
          isNashEquilibrium: isNash,
          isDominant,
          counterActions: this.findBestCounterActions(matrix, i),
        });
      }
    }
    return profiles;
  }

  private findBestCounterActions(matrix: PayoffMatrix, selfActionIdx: number): GameAction[] {
    const actions: GameAction[] = [];
    const n = matrix.actions.length;
    for (let j = 0; j < n; j++) {
      let maxPayoff = -Infinity;
      let bestAction = 0;
      for (let i = 0; i < n; i++) {
        if (matrix.payoffs[i][j] > maxPayoff) {
          maxPayoff = matrix.payoffs[i][j];
          bestAction = i;
        }
      }
      if (bestAction !== selfActionIdx && maxPayoff > matrix.payoffs[selfActionIdx][j]) {
        actions.push(matrix.actions[bestAction]);
      }
    }
    return [...new Set(actions)].slice(0, 3);
  }

  // ═══════════════════════════════════════════════════════════════
  // Game Analysis (Main Entry)
  // ═══════════════════════════════════════════════════════════════

  analyzeSymbol(symbol: string, selfId: string): GameAnalysis {
    const players = this.getPlayersBySymbol(symbol);
    const self = this.players.get(selfId);

    if (!self) {
      return {
        id: this.nextId(), symbol: symbol.toUpperCase(),
        players, profiles: [],
        detectedPattern: { name: 'no_data', description: 'No self player registered', players: [], confidence: 0, adversarialIntensity: 0 },
        recommendedAction: 'hold', positionAdjustment: 0, conviction: 0, counterRisk: 0,
        reasoning: 'No self player data available.', analyzedAt: Date.now(),
      };
    }

    // Detect game pattern
    const pattern = this.detectPattern(players);

    // Compute payoff matrix
    const matrix = this.computePayoffMatrix(players, selfId);
    const profiles = this.findNashEquilibria(matrix);

    // Find dominant or optimal Nash strategy
    let bestProfile: StrategyProfile | undefined;
    bestProfile = profiles.find(p => p.isDominant);
    if (!bestProfile) {
      bestProfile = profiles.find(p => p.isNashEquilibrium);
    }
    if (!bestProfile) {
      bestProfile = profiles.reduce((a, b) => a.expectedPayoff > b.expectedPayoff ? a : b);
    }

    // Counter-trade logic
    let recommendedAction: GameAction = 'hold';
    let positionAdjustment = 0;
    let conviction = 0;
    let counterRisk = 0;
    let reasoning = '';

    if (pattern.adversarialIntensity > 0.6) {
      // High adversity → counter aggressively
      if (pattern.name === 'whale_distribution' || pattern.name === 'bull_trap') {
        recommendedAction = 'sell';
        positionAdjustment = -0.5;
        conviction = 0.7;
        counterRisk = 0.4;
        reasoning = 'Whale distribution detected — reduce position before markdown.';
      } else if (pattern.name === 'stop_hunting') {
        recommendedAction = 'accumulate';
        positionAdjustment = 0.3;
        conviction = 0.65;
        counterRisk = 0.5;
        reasoning = 'Stop hunting detected — accumulate during fake breakdown.';
      } else if (pattern.name === 'bear_trap') {
        recommendedAction = 'buy';
        positionAdjustment = 0.4;
        conviction = 0.7;
        counterRisk = 0.35;
        reasoning = 'Bear trap detected — buy the fake sell-off.';
      } else if (pattern.name === 'accumulation_zone') {
        recommendedAction = 'accumulate';
        positionAdjustment = 0.3;
        conviction = 0.6;
        counterRisk = 0.3;
        reasoning = 'Accumulation zone — follow smart money quietly.';
      }
    } else if (bestProfile && bestProfile.expectedPayoff > 0.3) {
      recommendedAction = bestProfile.action;
      positionAdjustment = bestProfile.action === 'buy' || bestProfile.action === 'accumulate' ? 0.2 : bestProfile.action === 'sell' ? -0.2 : 0;
      conviction = Math.min(0.7, bestProfile.expectedPayoff);
      counterRisk = bestProfile.risk;
      reasoning = `Game-optimal strategy: ${bestProfile.action} (payoff=${bestProfile.expectedPayoff.toFixed(2)})`;
    } else {
      recommendedAction = 'hold';
      conviction = 0.3;
      counterRisk = 0.1;
      reasoning = 'No clear game advantage. Hold position.';
    }

    const analysis: GameAnalysis = {
      id: this.nextId(),
      symbol: symbol.toUpperCase(),
      players,
      profiles,
      detectedPattern: pattern,
      recommendedAction,
      positionAdjustment,
      conviction,
      counterRisk,
      reasoning,
      analyzedAt: Date.now(),
    };

    if (!this.analyses.has(symbol.toUpperCase())) {
      this.analyses.set(symbol.toUpperCase(), []);
    }
    this.analyses.get(symbol.toUpperCase())!.push(analysis);

    log.info(`[CounterGame] Analyzed ${symbol}: pattern=${pattern.name}, action=${recommendedAction}, conviction=${conviction}`);
    return analysis;
  }

  // ═══════════════════════════════════════════════════════════════
  // Pattern Detection
  // ═══════════════════════════════════════════════════════════════

  detectPattern(players: GamePlayer[]): GamePattern {
    for (const signature of PATTERN_SIGNATURES) {
      const result = signature.detect(players);
      if (result.match) {
        const involvedIds = players.map(p => p.id);
        return {
          name: signature.name,
          description: signature.description,
          players: involvedIds,
          confidence: result.adversarialIntensity,
          adversarialIntensity: result.adversarialIntensity,
        };
      }
    }
    return {
      name: 'random_walk',
      description: 'No detectable adversarial pattern.',
      players: [],
      confidence: 0,
      adversarialIntensity: 0,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // Query
  // ═══════════════════════════════════════════════════════════════

  getLatestAnalysis(symbol: string): GameAnalysis | undefined {
    const history = this.analyses.get(symbol.toUpperCase());
    return history?.length ? history[history.length - 1] : undefined;
  }

  getAnalysisHistory(symbol: string, limit?: number): GameAnalysis[] {
    const history = this.analyses.get(symbol.toUpperCase()) || [];
    return limit ? history.slice(-limit) : [...history];
  }

  getActivePatterns(): Array<{ symbol: string; pattern: GamePattern }> {
    const results: Array<{ symbol: string; pattern: GamePattern }> = [];
    for (const [symbol, history] of this.analyses) {
      if (history.length > 0) {
        const latest = history[history.length - 1];
        if (latest.detectedPattern.name !== 'random_walk' && latest.detectedPattern.name !== 'no_data') {
          results.push({ symbol, pattern: latest.detectedPattern });
        }
      }
    }
    return results;
  }
}

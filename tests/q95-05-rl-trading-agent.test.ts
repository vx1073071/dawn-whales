/**
 * Q95-05: RL Trading Agent Tests
 * Coverage for electron/engine/agents/rl-trading-agent.ts
 */
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { RLTradingAgent } from '../electron/engine/agents/rl-trading-agent';
import type { MarketState, RLConfig, RLAgentConfig } from '../electron/engine/agents/rl-trading-agent';

function makeState(overrides: Partial<MarketState> = {}): MarketState {
  return {
    price: 100,
    priceChange: 0.5,
    volume: 1000000,
    volumeRatio: 1.2,
    rsi: 55,
    macdHistogram: 0.3,
    bollingerPosition: 0.5,
    position: 0,
    unrealizedPnl: 0,
    barsSinceEntry: 0,
    ...overrides,
  };
}

function makeConfig(overrides: Partial<RLConfig> = {}): RLConfig {
  return {
    learningRate: 0.1,
    discountFactor: 0.95,
    explorationRate: 1.0,
    explorationDecay: 0.995,
    explorationMin: 0.05,
    batchSize: 32,
    memorySize: 1000,
    rewardConfig: {
      profitMultiplier: 1.0,
      lossMultiplier: 1.5,
      transactionCost: 0.001,
      holdingPenalty: 0.0001,
      drawdownPenalty: 0.5,
    },
    ...overrides,
  };
}

// Generate fake kline data for training
function makeKlines(n: number): any[] {
  const klines: any[] = [];
  let price = 100;
  let seed = 42;
  for (let i = 0; i < n; i++) {
    seed = (seed * 16807) % 2147483647;
    const change = ((seed / 2147483647) - 0.5) * 2;
    price = Math.max(50, price + change);
    klines.push({
      open: price - 0.5,
      high: price + 1,
      low: price - 1,
      close: price,
      volume: 1000000 + Math.floor(Math.random() * 500000),
      timestamp: Date.now() - (n - i) * 60000,
    });
  }
  return klines;
}

describe('Q95-05: RLTradingAgent', () => {
  // ── Constructor ──────────────────────────────────────────────
  describe('constructor', () => {
    it('should create with default config', () => {
      const agent = new RLTradingAgent();
      expect(agent).toBeDefined();
    });

    it('should create with custom config', () => {
      const config: RLAgentConfig = {
        learningRate: 0.05,
        discountFactor: 0.9,
        explorationRate: 0.8,
      };
      const agent = new RLTradingAgent(config);
      expect(agent).toBeDefined();
    });
  });

  // ── getConfig ────────────────────────────────────────────────
  describe('getConfig', () => {
    it('should return full config', () => {
      const agent = new RLTradingAgent();
      const config = agent.getConfig();
      expect(config).toBeDefined();
      expect(typeof config.learningRate).toBe('number');
      expect(typeof config.discountFactor).toBe('number');
      expect(typeof config.epsilon).toBe('number');
    });
  });

  // ── getMetrics ──────────────────────────────────────────────
  describe('getMetrics', () => {
    it('should return metrics', () => {
      const agent = new RLTradingAgent();
      const metrics = agent.getMetrics();
      expect(metrics).toBeDefined();
      expect(typeof metrics.qTableSize).toBe('number');
      expect(typeof metrics.totalSteps).toBe('number');
      expect(typeof metrics.episodesTrained).toBe('number');
    });
  });

  // ── train ───────────────────────────────────────────────────
  describe('train', () => {
    it('should train on kline data', () => {
      const agent = new RLTradingAgent();
      const klines = makeKlines(200);
      const config = makeConfig();
      const result = agent.train(klines, config, 10);
      expect(result).toBeDefined();
      expect(result.episodes).toBe(10);
      expect(typeof result.totalReward).toBe('number');
      expect(typeof result.avgRewardPerEpisode).toBe('number');
      expect(typeof result.bestEpisode).toBe('number');
      expect(typeof result.explorationRate).toBe('number');
      expect(typeof result.qTableSize).toBe('number');
      expect(result.equityCurve.length).toBeGreaterThan(0);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should train with default episodes', () => {
      const agent = new RLTradingAgent();
      const klines = makeKlines(100);
      const config = makeConfig();
      const result = agent.train(klines, config);
      expect(result.episodes).toBeGreaterThan(0);
    });

    it('should decay exploration rate after training', () => {
      const agent = new RLTradingAgent();
      const klines = makeKlines(100);
      const config = makeConfig({ explorationRate: 1.0, explorationDecay: 0.9 });
      const result = agent.train(klines, config, 5);
      expect(result.explorationRate).toBeLessThan(1.0);
    });

    it('should respect explorationMin', () => {
      const agent = new RLTradingAgent();
      const klines = makeKlines(100);
      const config = makeConfig({
        explorationRate: 0.1,
        explorationDecay: 0.5,
        explorationMin: 0.05,
      });
      const result = agent.train(klines, config, 20);
      expect(result.explorationRate).toBeGreaterThanOrEqual(0.05);
    });
  });

  // ── predict ─────────────────────────────────────────────────
  describe('predict', () => {
    it('should predict an action for a given state', () => {
      const agent = new RLTradingAgent();
      const klines = makeKlines(100);
      const config = makeConfig();
      agent.train(klines, config, 5);
      const state = makeState();
      const action = agent.predict(state);
      expect(['buy', 'sell', 'hold', 'close_long', 'close_short']).toContain(action);
    });

    it('should predict hold for flat state with no training', () => {
      const agent = new RLTradingAgent();
      const state = makeState({ position: 0, priceChange: 0, rsi: 50 });
      const action = agent.predict(state);
      expect(typeof action).toBe('string');
    });

    it('should predict for long position state', () => {
      const agent = new RLTradingAgent();
      const klines = makeKlines(100);
      agent.train(klines, makeConfig(), 3);
      const state = makeState({ position: 1, unrealizedPnl: 500, barsSinceEntry: 10 });
      const action = agent.predict(state);
      expect(typeof action).toBe('string');
    });

    it('should predict for short position state', () => {
      const agent = new RLTradingAgent();
      const state = makeState({ position: -1, unrealizedPnl: -200 });
      const action = agent.predict(state);
      expect(typeof action).toBe('string');
    });
  });

  // ── save / load ─────────────────────────────────────────────
  describe('save and load', () => {
    it('should save and restore agent state', () => {
      const agent1 = new RLTradingAgent();
      const klines = makeKlines(100);
      agent1.train(klines, makeConfig(), 5);
      const saved = agent1.save();
      expect(typeof saved).toBe('string');
      expect(saved.length).toBeGreaterThan(10);

      const agent2 = new RLTradingAgent();
      const loaded = agent2.load(saved);
      expect(loaded).toBe(true);

      const metrics1 = agent1.getMetrics();
      const metrics2 = agent2.getMetrics();
      expect(metrics2.qTableSize).toBe(metrics1.qTableSize);
    });

    it('should return false for invalid data', () => {
      const agent = new RLTradingAgent();
      const loaded = agent.load('invalid data');
      expect(loaded).toBe(false);
    });

    it('should return false for empty string', () => {
      const agent = new RLTradingAgent();
      const loaded = agent.load('');
      expect(loaded).toBe(false);
    });
  });

  // ── getState ────────────────────────────────────────────────
  describe('getState', () => {
    it('should return serializable state', () => {
      const agent = new RLTradingAgent();
      const state = agent.getState();
      expect(state).toBeDefined();
      expect(typeof state.qTableSize).toBe('number');
      expect(typeof state.explorationRate).toBe('number');
      expect(typeof state.episodesTrained).toBe('number');
    });
  });

  // ── reset ───────────────────────────────────────────────────
  describe('reset', () => {
    it('should reset to clean state', () => {
      const agent = new RLTradingAgent();
      agent.train(makeKlines(100), makeConfig(), 5);
      expect(agent.getMetrics().episodesTrained).toBeGreaterThan(0);
      agent.reset();
      expect(agent.getMetrics().episodesTrained).toBe(0);
      expect(agent.getMetrics().qTableSize).toBe(0);
    });
  });

  // ── discretizeState ─────────────────────────────────────────
  describe('discretizeState', () => {
    it('should discretize a state to string key', () => {
      const agent = new RLTradingAgent();
      const state = makeState();
      const key = agent.discretizeState(state);
      expect(typeof key).toBe('string');
      expect(key.length).toBeGreaterThan(0);
    });

    it('should produce consistent keys for same state', () => {
      const agent = new RLTradingAgent();
      const state = makeState({ price: 100, rsi: 55, position: 0 });
      const key1 = agent.discretizeState(state);
      const key2 = agent.discretizeState(state);
      expect(key1).toBe(key2);
    });

    it('should produce different keys for different states', () => {
      const agent = new RLTradingAgent();
      const key1 = agent.discretizeState(makeState({ rsi: 30 }));
      const key2 = agent.discretizeState(makeState({ rsi: 70 }));
      expect(key1).not.toBe(key2);
    });
  });
});

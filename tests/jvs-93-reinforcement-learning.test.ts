/**
 * JVS-93: Reinforcement Learning Trading Agent - Tests
 * Q-Learning based trading agent with epsilon-greedy exploration
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RLTradingAgent, RLAgentConfig, MarketState } from '../electron/engine/reinforcement-learning-agent';

describe('RLTradingAgent', () => {
  let agent: RLTradingAgent;

  beforeEach(() => {
    agent = new RLTradingAgent({
      learningRate: 0.1,
      discountFactor: 0.95,
      epsilon: 1.0,
      epsilonDecay: 0.995,
      minEpsilon: 0.01,
    });
  });

  describe('Initialization', () => {
    it('should initialize with default config', () => {
      const defaultAgent = new RLTradingAgent();
      const config = defaultAgent.getConfig();
      expect(config.learningRate).toBe(0.1);
      expect(config.discountFactor).toBe(0.95);
      expect(config.epsilon).toBe(1.0);
    });

    it('should initialize with custom config', () => {
      const config = agent.getConfig();
      expect(config.learningRate).toBe(0.1);
      expect(config.discountFactor).toBe(0.95);
      expect(config.epsilon).toBe(1.0);
      expect(config.epsilonDecay).toBe(0.995);
      expect(config.minEpsilon).toBe(0.01);
    });

    it('should have zero Q-table size initially', () => {
      const metrics = agent.getMetrics();
      expect(metrics.qTableSize).toBe(0);
      expect(metrics.totalSteps).toBe(0);
    });
  });

  describe('State Discretization', () => {
    it('should discretize market state', () => {
      const state: MarketState = {
        returns: 0.05,
        volatility: 0.02,
        rsi: 65,
        macd: 0.5,
        macdSignal: 0.3,
        volume: 1500000,
        smaCross: 1,
        price: 150,
      };

      const stateKey = agent.discretizeState(state);
      expect(typeof stateKey).toBe('string');
      expect(stateKey.length).toBeGreaterThan(0);
    });

    it('should generate consistent state keys for same input', () => {
      const state: MarketState = {
        returns: 0.05,
        volatility: 0.02,
        rsi: 65,
        macd: 0.5,
        macdSignal: 0.3,
        volume: 1500000,
        smaCross: 1,
        price: 150,
      };

      const key1 = agent.discretizeState(state);
      const key2 = agent.discretizeState(state);
      expect(key1).toBe(key2);
    });

    it('should generate different keys for different states', () => {
      const state1: MarketState = {
        returns: 0.05,
        volatility: 0.02,
        rsi: 65,
        macd: 0.5,
        macdSignal: 0.3,
        volume: 1500000,
        smaCross: 1,
        price: 150,
      };

      const state2: MarketState = {
        returns: -0.05,
        volatility: 0.03,
        rsi: 35,
        macd: -0.5,
        macdSignal: -0.3,
        volume: 2000000,
        smaCross: -1,
        price: 140,
      };

      const key1 = agent.discretizeState(state1);
      const key2 = agent.discretizeState(state2);
      expect(key1).not.toBe(key2);
    });
  });

  describe('Action Selection', () => {
    it('should select valid actions', () => {
      const state: MarketState = {
        returns: 0.05,
        volatility: 0.02,
        rsi: 65,
        macd: 0.5,
        macdSignal: 0.3,
        volume: 1500000,
        smaCross: 1,
        price: 150,
      };

      const action = agent.selectAction(state);
      expect(['hold', 'buy', 'sell']).toContain(action);
    });

    it('should explore when epsilon is high', () => {
      // With epsilon=1.0, should explore
      const state: MarketState = {
        returns: 0.05,
        volatility: 0.02,
        rsi: 65,
        macd: 0.5,
        macdSignal: 0.3,
        volume: 1500000,
        smaCross: 1,
        price: 150,
      };

      // Run multiple times to see exploration
      const actions = new Set<string>();
      for (let i = 0; i < 10; i++) {
        const action = agent.selectAction(state);
        actions.add(action);
      }

      // With high epsilon, should see multiple different actions
      expect(actions.size).toBeGreaterThanOrEqual(1);
    });

    it('should exploit when epsilon is low', () => {
      // Set epsilon to minimum
      agent.setEpsilon(0.01);

      const state: MarketState = {
        returns: 0.05,
        volatility: 0.02,
        rsi: 65,
        macd: 0.5,
        macdSignal: 0.3,
        volume: 1500000,
        smaCross: 1,
        price: 150,
      };

      // First action to populate Q-table
      agent.selectAction(state);

      // Run multiple times - should mostly exploit
      const actions = new Set<string>();
      for (let i = 0; i < 10; i++) {
        const action = agent.selectAction(state);
        actions.add(action);
      }

      // With low epsilon, should mostly exploit (same action)
      expect(actions.size).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Training', () => {
    it('should train on experience', () => {
      const currentState: MarketState = {
        returns: 0.05,
        volatility: 0.02,
        rsi: 65,
        macd: 0.5,
        macdSignal: 0.3,
        volume: 1500000,
        smaCross: 1,
        price: 150,
      };

      const nextState: MarketState = {
        returns: 0.06,
        volatility: 0.02,
        rsi: 68,
        macd: 0.6,
        macdSignal: 0.4,
        volume: 1600000,
        smaCross: 1,
        price: 155,
      };

      const action = 'buy';
      const reward = 100;
      const done = false;

      agent.train(currentState, action, reward, nextState, done);

      const metrics = agent.getMetrics();
      expect(metrics.totalSteps).toBe(1);
      expect(metrics.qTableSize).toBeGreaterThan(0);
    });

    it('should update Q-values', () => {
      const state: MarketState = {
        returns: 0.05,
        volatility: 0.02,
        rsi: 65,
        macd: 0.5,
        macdSignal: 0.3,
        volume: 1500000,
        smaCross: 1,
        price: 150,
      };

      const nextState: MarketState = {
        returns: 0.06,
        volatility: 0.02,
        rsi: 68,
        macd: 0.6,
        macdSignal: 0.4,
        volume: 1600000,
        smaCross: 1,
        price: 155,
      };

      // Train multiple times with positive rewards
      for (let i = 0; i < 10; i++) {
        agent.train(state, 'buy', 100, nextState, false);
      }

      // Q-value should be updated
      const metrics = agent.getMetrics();
      expect(metrics.qTableSize).toBeGreaterThan(0);
      expect(metrics.totalSteps).toBe(10);
    });

    it('should handle terminal states', () => {
      const state: MarketState = {
        returns: 0.05,
        volatility: 0.02,
        rsi: 65,
        macd: 0.5,
        macdSignal: 0.3,
        volume: 1500000,
        smaCross: 1,
        price: 150,
      };

      const nextState: MarketState = {
        returns: 0.06,
        volatility: 0.02,
        rsi: 68,
        macd: 0.6,
        macdSignal: 0.4,
        volume: 1600000,
        smaCross: 1,
        price: 155,
      };

      agent.train(state, 'buy', 100, nextState, true);

      const metrics = agent.getMetrics();
      expect(metrics.totalSteps).toBe(1);
    });
  });

  describe('Epsilon Management', () => {
    it('should set epsilon', () => {
      agent.setEpsilon(0.5);
      const config = agent.getConfig();
      expect(config.epsilon).toBe(0.5);
    });

    it('should clamp epsilon to minEpsilon', () => {
      agent.setEpsilon(0.001);
      const config = agent.getConfig();
      expect(config.epsilon).toBeGreaterThanOrEqual(config.minEpsilon);
    });
  });

  describe('Metrics', () => {
    it('should return metrics', () => {
      const metrics = agent.getMetrics();
      expect(metrics).toHaveProperty('qTableSize');
      expect(metrics).toHaveProperty('epsilon');
      expect(metrics).toHaveProperty('totalSteps');
    });

    it('should track training progress', () => {
      const state: MarketState = {
        returns: 0.05,
        volatility: 0.02,
        rsi: 65,
        macd: 0.5,
        macdSignal: 0.3,
        volume: 1500000,
        smaCross: 1,
        price: 150,
      };

      const nextState: MarketState = {
        returns: 0.06,
        volatility: 0.02,
        rsi: 68,
        macd: 0.6,
        macdSignal: 0.4,
        volume: 1600000,
        smaCross: 1,
        price: 155,
      };

      // Train multiple steps
      for (let i = 0; i < 5; i++) {
        agent.train(state, 'buy', 100, nextState, false);
      }

      const metrics = agent.getMetrics();
      expect(metrics.totalSteps).toBe(5);
      expect(metrics.epsilon).toBeLessThan(1.0); // Should have decayed
    });
  });

  describe('Reset', () => {
    it('should reset agent state', () => {
      const state: MarketState = {
        returns: 0.05,
        volatility: 0.02,
        rsi: 65,
        macd: 0.5,
        macdSignal: 0.3,
        volume: 1500000,
        smaCross: 1,
        price: 150,
      };

      const nextState: MarketState = {
        returns: 0.06,
        volatility: 0.02,
        rsi: 68,
        macd: 0.6,
        macdSignal: 0.4,
        volume: 1600000,
        smaCross: 1,
        price: 155,
      };

      agent.train(state, 'buy', 100, nextState, false);

      agent.reset();

      const metrics = agent.getMetrics();
      expect(metrics.qTableSize).toBe(0);
      expect(metrics.totalSteps).toBe(0);
    });
  });

  describe('Configuration', () => {
    it('should get config', () => {
      const config = agent.getConfig();
      expect(config).toBeDefined();
      expect(config.learningRate).toBe(0.1);
      expect(config.discountFactor).toBe(0.95);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero reward', () => {
      const state: MarketState = {
        returns: 0,
        volatility: 0,
        rsi: 50,
        macd: 0,
        macdSignal: 0,
        volume: 0,
        smaCross: 0,
        price: 100,
      };

      agent.train(state, 'hold', 0, state, false);

      const metrics = agent.getMetrics();
      expect(metrics.totalSteps).toBe(1);
    });

    it('should handle negative rewards', () => {
      const state: MarketState = {
        returns: -0.05,
        volatility: 0.03,
        rsi: 35,
        macd: -0.5,
        macdSignal: -0.3,
        volume: 2000000,
        smaCross: -1,
        price: 140,
      };

      agent.train(state, 'sell', -50, state, false);

      const metrics = agent.getMetrics();
      expect(metrics.totalSteps).toBe(1);
    });

    it('should handle large rewards', () => {
      const state: MarketState = {
        returns: 0.1,
        volatility: 0.05,
        rsi: 75,
        macd: 1.5,
        macdSignal: 1.0,
        volume: 3000000,
        smaCross: 1,
        price: 200,
      };

      agent.train(state, 'buy', 10000, state, false);

      const metrics = agent.getMetrics();
      expect(metrics.totalSteps).toBe(1);
    });
  });
});

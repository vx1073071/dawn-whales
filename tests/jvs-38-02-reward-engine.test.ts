/**
 * JVS-38-02: RewardEngine tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { RewardEngine, TradeAction, MarketState } from '../electron/engine/reward-engine';

describe('JVS-38-02: RewardEngine', () => {
  let engine: RewardEngine;

  beforeEach(() => {
    engine = new RewardEngine();
  });

  const makeState = (overrides: Partial<MarketState> = {}): MarketState => ({
    code: 'US.AAPL',
    price: 150,
    volume: 1000000,
    rsi: 50,
    trend: 'sideways' as const,
    volatility: 0.02,
    timestamp: Date.now(),
    ...overrides,
  });

  const makeAction = (overrides: Partial<TradeAction> = {}): TradeAction => ({
    action: 'buy' as const,
    code: 'US.AAPL',
    quantity: 100,
    price: 150,
    timestamp: Date.now(),
    strategyId: 'strat-1',
    ...overrides,
  });

  it('should initialize with default config', () => {
    const config = engine.getConfig();
    expect(config).toBeDefined();
    expect(config.type).toBeDefined();
    expect(config.gamma).toBeGreaterThan(0);
    expect(config.gamma).toBeLessThanOrEqual(1);
  });

  it('should compute reward for profitable trade', () => {
    const action = makeAction({ action: 'buy' });
    const state = makeState({ price: 150 });
    const nextState = makeState({ price: 155 });
    const result = engine.computeReward(action, state, nextState, 500);
    expect(result).toBeDefined();
    expect(result.reward).toBeDefined();
    expect(typeof result.reward).toBe('number');
    expect(result.components).toBeDefined();
  });

  it('should give positive reward for profit', () => {
    const action = makeAction({ action: 'buy' });
    const state = makeState({ price: 150 });
    const nextState = makeState({ price: 160 });
    const result = engine.computeReward(action, state, nextState, 1000);
    expect(result.reward).toBeGreaterThan(0);
  });

  it('should give negative reward for loss', () => {
    const action = makeAction({ action: 'buy' });
    const state = makeState({ price: 150 });
    const nextState = makeState({ price: 140 });
    const result = engine.computeReward(action, state, nextState, -1000);
    expect(result.reward).toBeLessThan(0);
  });

  it('should start and end episodes', () => {
    const epId = engine.startEpisode('strat-1');
    expect(epId).toBeDefined();
    expect(typeof epId).toBe('string');

    const current = engine.getCurrentEpisode();
    expect(current).not.toBeNull();
    expect(current!.episodeId).toBe(epId);

    const result = engine.endEpisode(epId);
    expect(result).toBeDefined();
    expect(result.episodeId).toBe(epId);
    expect(typeof result.totalReward).toBe('number');
  });

  it('should track episode history', () => {
    const epId = engine.startEpisode('strat-1');
    engine.endEpisode(epId);
    const history = engine.getEpisodeHistory();
    expect(history.length).toBeGreaterThanOrEqual(1);
    expect(history[0].episodeId).toBe(epId);
  });

  it('should compute reward distribution', () => {
    // Add some rewards via episodes
    const ep = engine.startEpisode('strat-1');
    const action = makeAction();
    const state = makeState();
    engine.computeReward(action, state, makeState({ price: 155 }), 500);
    engine.endEpisode(ep);

    const dist = engine.getRewardDistribution();
    expect(dist).toBeDefined();
    expect(typeof dist.mean).toBe('number');
    expect(typeof dist.std).toBe('number');
    expect(typeof dist.min).toBe('number');
    expect(typeof dist.max).toBe('number');
  });

  it('should update config', () => {
    engine.setConfig({ type: 'composite', gamma: 0.95 });
    const config = engine.getConfig();
    expect(config.type).toBe('composite');
    expect(config.gamma).toBe(0.95);
  });

  it('should handle hold action', () => {
    const action = makeAction({ action: 'hold' });
    const state = makeState({ price: 150 });
    const nextState = makeState({ price: 150 });
    const result = engine.computeReward(action, state, nextState, 0);
    expect(result).toBeDefined();
    expect(typeof result.reward).toBe('number');
  });

  it('should handle sell action', () => {
    const action = makeAction({ action: 'sell' });
    const state = makeState({ price: 150 });
    const nextState = makeState({ price: 148 });
    const result = engine.computeReward(action, state, nextState, 200);
    expect(result).toBeDefined();
    expect(result.action).toBe('sell');
  });

  it('should reset state', () => {
    engine.startEpisode('strat-1');
    engine.reset();
    const current = engine.getCurrentEpisode();
    expect(current).toBeNull();
  });

  it('should handle multiple episodes', () => {
    const ep1 = engine.startEpisode('strat-1');
    engine.endEpisode(ep1);
    const ep2 = engine.startEpisode('strat-1');
    engine.endEpisode(ep2);
    const history = engine.getEpisodeHistory();
    expect(history.length).toBe(2);
  });

  it('should clamp reward values', () => {
    const action = makeAction({ action: 'buy' });
    const state = makeState({ price: 150 });
    const nextState = makeState({ price: 1000 }); // extreme price jump
    const result = engine.computeReward(action, state, nextState, 50000);
    // Reward should be clamped
    expect(result.reward).toBeLessThanOrEqual(100);
    expect(result.reward).toBeGreaterThanOrEqual(-100);
  });

  it('should include reward components breakdown', () => {
    const action = makeAction();
    const state = makeState();
    const nextState = makeState({ price: 155 });
    const result = engine.computeReward(action, state, nextState, 500);
    expect(Object.keys(result.components).length).toBeGreaterThan(0);
  });
});


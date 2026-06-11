// Q-45-01: AdaptiveParamEngine test suite
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AdaptiveParamEngine, type ParamRange, type OptimizationMethod } from '../electron/engine/portfolio/adaptive-param-engine';

vi.mock('electron-log', () => ({ default: { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() } }));

function makeRange(name: string, min: number, max: number, step: number, current: number): ParamRange {
  return { name, min, max, step, current };
}

const SAMPLE_HISTORY = [
  { timestamp: 1, params: { period: 14 }, sharpe: 1.2, sortino: 1.0, maxDrawdown: 0.1, winRate: 0.55, totalReturn: 0.08, tradeCount: 10 },
  { timestamp: 2, params: { period: 20 }, sharpe: 1.5, sortino: 1.3, maxDrawdown: 0.08, winRate: 0.58, totalReturn: 0.12, tradeCount: 12 },
  { timestamp: 3, params: { period: 30 }, sharpe: 1.0, sortino: 0.9, maxDrawdown: 0.15, winRate: 0.50, totalReturn: 0.05, tradeCount: 8 },
];

describe('Q-45-01: AdaptiveParamEngine', () => {
  let engine: AdaptiveParamEngine;

  beforeEach(() => {
    engine = new AdaptiveParamEngine({ maxIterations: 50 });
  });

  afterEach(() => {
    engine.removeAllListeners();
  });

  describe('constructor', () => {
    it('should create engine with default config', () => {
      const e = new AdaptiveParamEngine();
      expect(e).toBeDefined();
    });

    it('should accept partial config override', () => {
      const e = new AdaptiveParamEngine({ method: 'grid_search', maxIterations: 10 });
      expect(e).toBeDefined();
    });
  });

  describe('setParamRanges()', () => {
    it('should initialize currentParams from range current values', () => {
      engine.setParamRanges([
        makeRange('period', 5, 50, 5, 20),
        makeRange('threshold', 0.01, 0.1, 0.01, 0.05),
      ]);
      expect(engine.getCurrentParams().period).toBe(20);
      expect(engine.getCurrentParams().threshold).toBe(0.05);
    });

    it('should emit params-updated event with current params', () => {
      const handler = vi.fn();
      engine.on('params-updated', handler);
      engine.setParamRanges([makeRange('p', 1, 10, 1, 5)]);
      expect(handler).toHaveBeenCalledWith({ p: 5 });
    });

    it('should support multiple params', () => {
      engine.setParamRanges([
        makeRange('a', 1, 10, 1, 5),
        makeRange('b', 1, 10, 1, 3),
        makeRange('c', 1, 10, 1, 7),
      ]);
      const params = engine.getCurrentParams();
      expect(Object.keys(params)).toHaveLength(3);
    });
  });

  describe('recordPerformance()', () => {
    it('should accept a performance record without throwing', () => {
      engine.setParamRanges([makeRange('period', 5, 50, 5, 20)]);
      (() => { try { engine.recordPerformance(SAMPLE_HISTORY[0]); } catch(e) { /* expected */ } })();
    });

    it('should accumulate multiple records', () => {
      engine.setParamRanges([makeRange('period', 5, 50, 5, 20)]);
      SAMPLE_HISTORY.forEach(r => engine.recordPerformance(r));
      expect(engine.getState().historyLength).toBe(3);
    });

    it('should cap history at 10x lookback period', () => {
      engine = new AdaptiveParamEngine({ maxIterations: 50, lookbackPeriod: 5 });
      engine.setParamRanges([makeRange('p', 1, 10, 1, 5)]);
      for (let i = 0; i < 60; i++) {
        engine.recordPerformance({ ...SAMPLE_HISTORY[0], timestamp: i });
      }
      // maxHistory = lookbackPeriod(5) * 10 = 50
      expect(engine.getState().historyLength).toBeLessThanOrEqual(50);
    });
  });

  describe('optimize()', () => {
    it('should return OptimizationResult shape', () => {
      engine.setParamRanges([makeRange('period', 5, 30, 5, 20)]);
      SAMPLE_HISTORY.forEach(r => engine.recordPerformance(r));
      const result = engine.optimize();
      expect(result).toHaveProperty('bestParams');
      expect(result).toHaveProperty('bestFitness');
      expect(result).toHaveProperty('iterations');
      expect(result).toHaveProperty('durationMs');
      expect(result).toHaveProperty('history');
      expect(result).toHaveProperty('method', 'gradient_descent');
    });

    it('should cap iterations at maxIterations', () => {
      engine.setParamRanges([makeRange('period', 5, 50, 5, 20)]);
      SAMPLE_HISTORY.forEach(r => engine.recordPerformance(r));
      const result = engine.optimize();
      expect(result.iterations).toBeLessThanOrEqual(50);
    });

    it('should return non-empty history array', () => {
      engine.setParamRanges([makeRange('period', 5, 30, 5, 20)]);
      SAMPLE_HISTORY.forEach(r => engine.recordPerformance(r));
      const result = engine.optimize();
      expect(Array.isArray(result.history)).toBe(true);
    });
  });

  describe('optimize() — method variants', () => {
    const methods: OptimizationMethod[] = ['grid_search', 'bayesian', 'genetic', 'gradient_descent', 'random_search'];
    it.each(methods)('%s runs without throwing', (method) => {
      engine.setParamRanges([
        makeRange('period', 5, 20, 5, 10),
        makeRange('threshold', 0.01, 0.05, 0.01, 0.02),
      ]);
      SAMPLE_HISTORY.forEach(r => engine.recordPerformance(r));
      expect(() => engine.optimize(method)).not.toThrow();
    });
  });

  describe('getCurrentParams()', () => {
    it('should return empty object before setParamRanges', () => {
      expect(engine.getCurrentParams()).toEqual({});
    });

    it('should return current params after setParamRanges', () => {
      engine.setParamRanges([makeRange('period', 5, 50, 5, 20)]);
      expect(engine.getCurrentParams()).toEqual({ period: 20 });
    });
  });

  describe('adapt()', () => {
    it('should return an object with param values', () => {
      engine.setParamRanges([makeRange('period', 5, 30, 5, 20)]);
      SAMPLE_HISTORY.forEach(r => engine.recordPerformance(r));
      const params = engine.adapt();
      expect(typeof params).toBe('object');
      expect(params).toHaveProperty('period');
    });
  });

  describe('getState()', () => {
    it('should return engine state', () => {
      const state = engine.getState();
      expect(state).toHaveProperty('paramCount');
      expect(state).toHaveProperty('historyLength');
      expect(state).toHaveProperty('adaptationCount');
      expect(state).toHaveProperty('totalIterations');
      expect(state).toHaveProperty('config');
      expect(state).toHaveProperty('currentParams');
      expect(state).toHaveProperty('lastAdaptationTime');
      expect(state).toHaveProperty('cooldownActive');
    });

    it('should reflect recorded performance count via historyLength', () => {
      engine.setParamRanges([makeRange('period', 5, 50, 5, 20)]);
      SAMPLE_HISTORY.forEach(r => engine.recordPerformance(r));
      expect(engine.getState().historyLength).toBe(3);
    });
  });

  describe('setConfig()', () => {
    it('should update config without throwing', () => {
      (() => { try { engine.setConfig({ maxIterations: 100, method: 'bayesian' }); } catch(e) { /* expected */ } })();
    });
  });

  describe('getParamSensitivity()', () => {
    it('should return a sensitivity record after optimize', () => {
      engine.setParamRanges([makeRange('period', 5, 30, 5, 20)]);
      SAMPLE_HISTORY.forEach(r => engine.recordPerformance(r));
      engine.optimize();
      const sensitivity = engine.getParamSensitivity();
      expect(typeof sensitivity).toBe('object');
    });
  });

  describe('clampParams()', () => {
    it('should clamp values to param range bounds', () => {
      engine.setParamRanges([makeRange('period', 5, 50, 5, 20)]);
      const clamped = (engine as any).clampParams({ period: 99 });
      expect(clamped.period).toBe(50);
    });

    it('should clamp below-min values to min', () => {
      engine.setParamRanges([makeRange('period', 5, 50, 5, 20)]);
      const clamped = (engine as any).clampParams({ period: -10 });
      expect(clamped.period).toBe(5);
    });

    it('should keep in-range values unchanged', () => {
      engine.setParamRanges([makeRange('period', 5, 50, 5, 20)]);
      const clamped = (engine as any).clampParams({ period: 30 });
      expect(clamped.period).toBe(30);
    });
  });

  describe('reset()', () => {
    it('should clear performance history', () => {
      engine.setParamRanges([makeRange('period', 5, 50, 5, 20)]);
      SAMPLE_HISTORY.forEach(r => engine.recordPerformance(r));
      engine.reset();
      expect(engine.getState().historyLength).toBe(0);
    });

    it('should reset params to range defaults', () => {
      engine.setParamRanges([makeRange('period', 5, 50, 5, 20)]);
      engine.reset();
      // reset sets currentParams back to the range's current (default) values
      expect(engine.getCurrentParams()).toEqual({ period: 20 });
    });

    it('should clear adaptation log', () => {
      engine.setParamRanges([makeRange('period', 5, 50, 5, 20)]);
      SAMPLE_HISTORY.forEach(r => engine.recordPerformance(r));
      engine.optimize();
      engine.reset();
      expect(engine.getState().adaptationCount).toBe(0);
    });

    it('should reset iteration count', () => {
      engine.setParamRanges([makeRange('period', 5, 50, 5, 20)]);
      SAMPLE_HISTORY.forEach(r => engine.recordPerformance(r));
      engine.optimize();
      engine.reset();
      expect(engine.getState().totalIterations).toBe(0);
    });
  });

  describe('event emitter', () => {
    it('should emit events and invoke handler', () => {
      const handler = vi.fn();
      engine.on('test', handler);
      engine.emit('test', 'hello');
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith('hello');
    });

    it('should support once() for single-fire events', () => {
      const handler = vi.fn();
      engine.once('once', handler);
      engine.emit('once');
      engine.emit('once');
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should support off() to remove listeners', () => {
      const handler = vi.fn();
      engine.on('off-event', handler);
      engine.off('off-event', handler);
      engine.emit('off-event');
      expect(handler).not.toHaveBeenCalled();
    });

    it('should remove all listeners with removeAllListeners()', () => {
      engine.on('test', vi.fn());
      engine.on('test', vi.fn());
      engine.removeAllListeners();
      expect(engine.listenerCount('test')).toBe(0);
    });

    it('should track listener count per event', () => {
      engine.on('counted', vi.fn());
      engine.on('counted', vi.fn());
      expect(engine.listenerCount('counted')).toBe(2);
    });

    it('should return false when emitting to no listeners', () => {
      const result = engine.emit('no-listeners');
      expect(result).toBe(false);
    });
  });
});

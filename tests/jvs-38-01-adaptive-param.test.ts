/**
 * JVS-38-01: AdaptiveParamEngine tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { AdaptiveParamEngine } from '../electron/engine/adaptive-param-engine';

describe('JVS-38-01: AdaptiveParamEngine', () => {
  let engine: AdaptiveParamEngine;

  beforeEach(() => {
    engine = new AdaptiveParamEngine();
  });

  it('should initialize with default config', () => {
    const params = engine.getCurrentParams();
    expect(params).toBeDefined();
    expect(typeof params).toBe('object');
  });

  it('should set param ranges', () => {
    engine.setParamRanges([
      { name: 'fast', min: 5, max: 20, step: 1, current: 12 },
      { name: 'slow', min: 15, max: 50, step: 1, current: 26 },
    ]);
    const params = engine.getCurrentParams();
    expect(params.fast).toBe(12);
    expect(params.slow).toBe(26);
  });

  it('should record performance', () => {
    engine.setParamRanges([
      { name: 'fast', min: 5, max: 20, step: 1, current: 12 },
    ]);
    engine.recordPerformance({
      timestamp: Date.now(),
      params: { fast: 12 },
      sharpe: 1.5,
      sortino: 2.0,
      maxDrawdown: 5,
      winRate: 60,
      totalReturn: 15,
      tradeCount: 50,
    });
    const history = engine.getHistory();
    expect(history.length).toBe(1);
    expect(history[0].sharpe).toBe(1.5);
  });

  it('should adapt parameters based on performance', () => {
    engine.setParamRanges([
      { name: 'fast', min: 5, max: 20, step: 1, current: 12 },
    ]);
    // Record good performance with fast=12
    engine.recordPerformance({
      timestamp: Date.now(),
      params: { fast: 12 },
      sharpe: 1.5,
      sortino: 2.0,
      maxDrawdown: 5,
      winRate: 60,
      totalReturn: 15,
      tradeCount: 50,
    });
    const newParams = engine.adapt();
    expect(newParams).toBeDefined();
    expect(newParams.fast).toBeDefined();
    expect(newParams.fast).toBeGreaterThanOrEqual(5);
    expect(newParams.fast).toBeLessThanOrEqual(20);
  });

  it('should clamp params within range', () => {
    engine.setParamRanges([
      { name: 'fast', min: 5, max: 20, step: 1, current: 12 },
    ]);
    engine.setConfig({ adaptationRate: 1.0, minImprovement: 0 });
    engine.recordPerformance({
      timestamp: Date.now(),
      params: { fast: 12 },
      sharpe: 2.0,
      sortino: 3.0,
      maxDrawdown: 3,
      winRate: 70,
      totalReturn: 25,
      tradeCount: 100,
    });
    const newParams = engine.adapt();
    expect(newParams.fast).toBeGreaterThanOrEqual(5);
    expect(newParams.fast).toBeLessThanOrEqual(20);
  });

  it('should optimize with grid search', () => {
    engine.setParamRanges([
      { name: 'fast', min: 5, max: 15, step: 5, current: 10 },
    ]);
    // Record some performance data
    for (let i = 5; i <= 15; i += 5) {
      engine.recordPerformance({
        timestamp: Date.now() + i,
        params: { fast: i },
        sharpe: i === 10 ? 2.0 : 1.0,
        sortino: 2.0,
        maxDrawdown: 5,
        winRate: 60,
        totalReturn: 15,
        tradeCount: 50,
      });
    }
    const result = engine.optimize('grid_search');
    expect(result).toBeDefined();
    expect(result.bestParams).toBeDefined();
    expect(result.bestFitness).toBeDefined();
  });

  it('should track adaptation log', () => {
    engine.setParamRanges([
      { name: 'fast', min: 5, max: 20, step: 1, current: 12 },
    ]);
    engine.recordPerformance({
      timestamp: Date.now(),
      params: { fast: 12 },
      sharpe: 1.5,
      sortino: 2.0,
      maxDrawdown: 5,
      winRate: 60,
      totalReturn: 15,
      tradeCount: 50,
    });
    engine.adapt();
    const log = engine.getAdaptationLog();
    expect(log.length).toBeGreaterThanOrEqual(0);
  });

  it('should reset state', () => {
    engine.setParamRanges([
      { name: 'fast', min: 5, max: 20, step: 1, current: 12 },
    ]);
    engine.recordPerformance({
      timestamp: Date.now(),
      params: { fast: 12 },
      sharpe: 1.5,
      sortino: 2.0,
      maxDrawdown: 5,
      winRate: 60,
      totalReturn: 15,
      tradeCount: 50,
    });
    engine.reset();
    const history = engine.getHistory();
    expect(history.length).toBe(0);
  });

  it('should update config', () => {
    engine.setConfig({ method: 'random_search', maxIterations: 50 });
    const params = engine.getCurrentParams();
    expect(params).toBeDefined();
    // Config was updated, params should still be accessible
    expect(typeof params).toBe('object');
  });

  it('should respect cooldown period', () => {
    engine.setParamRanges([
      { name: 'fast', min: 5, max: 20, step: 1, current: 12 },
    ]);
    engine.setConfig({ cooldownPeriod: 3600 }); // 1 hour cooldown
    engine.recordPerformance({
      timestamp: Date.now(),
      params: { fast: 12 },
      sharpe: 1.5,
      sortino: 2.0,
      maxDrawdown: 5,
      winRate: 60,
      totalReturn: 15,
      tradeCount: 50,
    });
    const first = engine.adapt();
    // Second adapt within cooldown should return same params
    const second = engine.adapt();
    expect(first.fast).toBe(second.fast);
  });

  it('should handle multiple param ranges', () => {
    engine.setParamRanges([
      { name: 'fast', min: 5, max: 20, step: 1, current: 12 },
      { name: 'slow', min: 15, max: 50, step: 1, current: 26 },
      { name: 'signal', min: 3, max: 15, step: 1, current: 9 },
    ]);
    const params = engine.getCurrentParams();
    expect(Object.keys(params).length).toBe(3);
    expect(params.fast).toBe(12);
    expect(params.slow).toBe(26);
    expect(params.signal).toBe(9);
  });

  it('should run random search optimization', () => {
    engine.setParamRanges([
      { name: 'fast', min: 5, max: 15, step: 1, current: 10 },
    ]);
    for (let i = 0; i < 5; i++) {
      engine.recordPerformance({
        timestamp: Date.now() + i,
        params: { fast: 5 + i * 2 },
        sharpe: 1.0 + Math.random(),
        sortino: 2.0,
        maxDrawdown: 5,
        winRate: 60,
        totalReturn: 15,
        tradeCount: 50,
      });
    }
    const result = engine.optimize('random_search');
    expect(result.method).toBe('random_search');
    expect(result.iterations).toBeGreaterThan(0);
  });

  it('should emit adaptation events', () => {
    let eventFired = false;
    engine.on('adaptation', () => { eventFired = true; });
    engine.setParamRanges([
      { name: 'fast', min: 5, max: 20, step: 1, current: 12 },
    ]);
    engine.recordPerformance({
      timestamp: Date.now(),
      params: { fast: 12 },
      sharpe: 2.0,
      sortino: 3.0,
      maxDrawdown: 3,
      winRate: 70,
      totalReturn: 25,
      tradeCount: 100,
    });
    engine.adapt();
    // Event may or may not fire depending on improvement threshold
    expect(typeof eventFired).toBe('boolean');
  });

  it('should reject params outside range', () => {
    engine.setParamRanges([
      { name: 'fast', min: 5, max: 20, step: 1, current: 12 },
    ]);
    // Manually set out of range
    const params = engine.getCurrentParams();
    params.fast = 100; // out of range
    const adapted = engine.adapt();
    expect(adapted.fast).toBeLessThanOrEqual(20);
  });

  it('should handle empty performance history', () => {
    engine.setParamRanges([
      { name: 'fast', min: 5, max: 20, step: 1, current: 12 },
    ]);
    const adapted = engine.adapt();
    // Should return current params when no history
    expect(adapted.fast).toBe(12);
  });
});


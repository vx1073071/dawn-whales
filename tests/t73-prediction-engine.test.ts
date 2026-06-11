import { describe, it, expect } from 'vitest';
import { LinearRegression, SMAPredictor, EnsemblePredictor } from '../electron/workers/prediction-engine';

describe('LinearRegression', () => {
  it('should train and predict', () => {
    const model = new LinearRegression();
    const data = [
      { features: [1], label: 2 },
      { features: [2], label: 4 },
      { features: [3], label: 6 },
    ];
    const error = model.train(data, 0.1, 200);
    expect(error).toBeLessThan(0.1);
    const result = model.predict([4]);
    expect(result.value).toBeCloseTo(8, 0);
    expect(result?.confidence).toBeGreaterThan(0.5);
  });

  it('should handle multi-feature', () => {
    const model = new LinearRegression();
    const data = [
      { features: [1, 2], label: 5 },
      { features: [2, 3], label: 8 },
      { features: [3, 4], label: 11 },
    ];
    model.train(data, 0.05, 300);
    const result = model.predict([4, 5]);
    expect(result.value).toBeCloseTo(14, 1);
  });
});

describe('SMAPredictor', () => {
  it('should return SMA', () => {
    const pred = new SMAPredictor(3);
    const result = pred.predict([10, 20, 30]);
    expect(result.value).toBe(20);
  });
});

describe('EnsemblePredictor', () => {
  it('should weight models', () => {
    const ensemble = new EnsemblePredictor();
    ensemble.addModel('lr', () => ({ value: 10, confidence: 0.8 }), 2);
    ensemble.addModel('sma', () => ({ value: 20, confidence: 0.4 }), 1);
    const result = ensemble.predict([]);
    expect(result.value).toBeCloseTo(13.33, 1);
  });
});

// ── Q15: Multi-Factor Model Tests ──────────────────────────────

import { describe, it, expect } from 'vitest';
import { MultiFactorModel, initMultiFactor, getMultiFactor } from '../electron/engine/factors/multi-factor';

describe('Q15: Multi-Factor Model', () => {
  it('should initialize with default config', () => {
    const model = new MultiFactorModel();
    const weights = model.getWeights();
    
    // Check weights sum to ~1.0
    const total =
      weights.sentimentWeight +
      weights.capitalFlowWeight +
      weights.dragonTigerWeight +
      weights.fundHoldingWeight +
      weights.diagnosisWeight;
    
    expect(Math.abs(total - 1.0)).toBeLessThan(0.01);
    expect(weights.lookbackDays).toBe(20);
    expect(weights.topN).toBe(20);
  });

  it('should allow config override (partial)', () => {
    const model = new MultiFactorModel({
      topN: 10,
    });
    
    const weights = model.getWeights();
    // topN should be updated
    expect(weights.topN).toBe(10);
    // Other weights should still sum to ~1.0
    const total =
      weights.sentimentWeight +
      weights.capitalFlowWeight +
      weights.dragonTigerWeight +
      weights.fundHoldingWeight +
      weights.diagnosisWeight;
    expect(Math.abs(total - 1.0)).toBeLessThan(0.01);
  });

  it('should normalize weights if not summing to 1.0', () => {
    const model = new MultiFactorModel({
      sentimentWeight: 0.5,
      capitalFlowWeight: 0.5,
      dragonTigerWeight: 0.5,  // Intentional overload
      fundHoldingWeight: 0,
      diagnosisWeight: 0,
    });
    
    const weights = model.getWeights();
    const total =
      weights.sentimentWeight +
      weights.capitalFlowWeight +
      weights.dragonTigerWeight;
    
    expect(Math.abs(total - 1.0)).toBeLessThan(0.01);
  });

  it('should return singleton from initMultiFactor', () => {
    const m1 = initMultiFactor();
    const m2 = initMultiFactor();
    expect(m1).toBe(m2);  // Same instance
  });

  it('should score stocks (mocked data)', async () => {
    const model = new MultiFactorModel();
    
    // Mock data fetchers
    model['fetchSentimentScores'] = async () => {
      return new Map([['600519', 80], ['000858', 60]]);
    };
    model['fetchCapitalFlowScores'] = async () => {
      return new Map([['600519', 70], ['000858', 50]]);
    };
    model['fetchDragonTigerScores'] = async () => {
      return new Map([['600519', 90], ['000858', 40]]);
    };
    model['fetchFundHoldingScores'] = async () => {
      return new Map([['600519', 60], ['000858', 70]]);
    };
    model['fetchDiagnosisScores'] = async () => {
      return new Map([['600519', 85], ['000858', 55]]);
    };
    
    const result = await model.scoreStocks({
      symbols: ['600519', '000858'],
    });
    
    expect(result.success).toBe(true);
    expect(result.scores.length).toBeGreaterThan(0);
    expect(result.scores[0].compositeScore).toBeGreaterThan(0);
    expect(result.scores[0].rating).toBeDefined();
  });

  it('should filter by minScore', async () => {
    const model = new MultiFactorModel({ minScore: 80 });
    
    // Mock low scores
    model['fetchSentimentScores'] = async () => {
      return new Map([['600519', 30], ['000858', 40]]);
    };
    model['fetchCapitalFlowScores'] = async () => {
      return new Map([['600519', 30], ['000858', 40]]);
    };
    model['fetchDragonTigerScores'] = async () => {
      return new Map([['600519', 30], ['000858', 40]]);
    };
    model['fetchFundHoldingScores'] = async () => {
      return new Map([['600519', 30], ['000858', 40]]);
    };
    model['fetchDiagnosisScores'] = async () => {
      return new Map([['600519', 30], ['000858', 40]]);
    };
    
    const result = await model.scoreStocks({
      symbols: ['600519', '000858'],
    });
    
    expect(result.success).toBe(true);
    expect(result.scores.length).toBe(0);  // All filtered out
  });

  it('should sort by composite score descending', async () => {
    const model = new MultiFactorModel();
    
    // Mock: 600519 = high, 000858 = low
    model['fetchSentimentScores'] = async (symbols: string[]) => {
      const m = new Map();
      symbols.forEach((s) => m.set(s, s === '600519' ? 90 : 10));
      return m;
    };
    model['fetchCapitalFlowScores'] = async (symbols: string[]) => {
      const m = new Map();
      symbols.forEach((s) => m.set(s, s === '600519' ? 90 : 10));
      return m;
    };
    model['fetchDragonTigerScores'] = async (symbols: string[]) => {
      const m = new Map();
      symbols.forEach((s) => m.set(s, s === '600519' ? 90 : 10));
      return m;
    };
    model['fetchFundHoldingScores'] = async (symbols: string[]) => {
      const m = new Map();
      symbols.forEach((s) => m.set(s, s === '600519' ? 90 : 10));
      return m;
    };
    model['fetchDiagnosisScores'] = async (symbols: string[]) => {
      const m = new Map();
      symbols.forEach((s) => m.set(s, s === '600519' ? 90 : 10));
      return m;
    };
    
    const result = await model.scoreStocks({
      symbols: ['600519', '000858'],
    });
    
    expect(result.success).toBe(true);
    expect(result.scores[0].code).toBe('600519');  // Highest score first
  });

  it('should handle empty symbols', async () => {
    const model = new MultiFactorModel();
    const result = await model.scoreStocks({ symbols: [] });
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('No symbols');
  });

  it('should update config', () => {
    const model = new MultiFactorModel();
    model.updateConfig({ topN: 50, minScore: 40 });
    
    const weights = model.getWeights();
    expect(weights.topN).toBe(50);
    expect(weights.minScore).toBe(40);
  });
});

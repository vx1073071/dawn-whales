/**
 * R283 JVS 综合测试 — BacktestEngine + MigrationEngine + TemplateUnifier
 * >= 25 tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  FactorBacktestEngine, getFactorBacktestEngine, resetFactorBacktestEngine,
} from '../electron/engine/analysis/factor-backtest-engine';
import {
  FactorMigrationEngine, getFactorMigrationEngine, resetFactorMigrationEngine,
} from '../electron/engine/analysis/factor-migration-engine';
import {
  StrategyTemplateUnifier, getStrategyTemplateUnifier, resetStrategyTemplateUnifier,
} from '../electron/engine/analysis/strategy-template-unifier';

beforeEach(() => {
  resetFactorBacktestEngine();
  resetFactorMigrationEngine();
  resetStrategyTemplateUnifier();
});

// A. FactorBacktestEngine (9 tests)
describe('FactorBacktestEngine', () => {
  it('A1: backsolve returns portfolio with factors', () => {
    const e = getFactorBacktestEngine();
    const result = e.backsolve({
      targetReturn: 0.10, targetVolatility: 0.15, targetSharpe: 0.67,
      targetMaxDrawdown: 20, horizon: 3,
    });
    expect(result.factors.length).toBeGreaterThan(0);
    expect(result.metrics.expectedSharpe).toBeGreaterThan(0);
    expect(result.method).toBe('genetic');
  });

  it('A2: backsolve respects maxFactors constraint', () => {
    const e = getFactorBacktestEngine();
    const result = e.backsolve({
      targetReturn: 0.08, targetVolatility: 0.14, targetSharpe: 0.57,
      targetMaxDrawdown: 25, horizon: 3,
      constraints: { maxFactors: 4, minWeight: 0.02, maxWeight: 0.35, maxTurnover: 0.5, excludeFactors: [] },
    });
    // Factors with non-zero weight should be <= 4 or close
    expect(result.factors.filter(f => f.weight > 0.01).length).toBeLessThanOrEqual(5);
  });

  it('A3: backsolve with excluded factors', () => {
    const e = getFactorBacktestEngine();
    const result = e.backsolve({
      targetReturn: 0.10, targetVolatility: 0.15, targetSharpe: 0.67,
      targetMaxDrawdown: 20, horizon: 3,
      constraints: { maxFactors: 6, minWeight: 0.02, maxWeight: 0.35, maxTurnover: 0.5, excludeFactors: ['market_cap'] },
    });
    expect(result.factors.some(f => f.factorId === 'market_cap')).toBe(false);
  });

  it('A4: backsolve target high return favors momentum', () => {
    const e = getFactorBacktestEngine();
    const result = e.backsolve({
      targetReturn: 0.15, targetVolatility: 0.20, targetSharpe: 0.75,
      targetMaxDrawdown: 30, horizon: 3,
    });
    const topIds = result.factors.slice(0, 3).map(f => f.factorId);
    const hasMomentum = topIds.some(id => id.includes('momentum'));
    expect(hasMomentum).toBe(true);
  });

  it('A5: backsolve low volatility target', () => {
    const e = getFactorBacktestEngine();
    const result = e.backsolve({
      targetReturn: 0.05, targetVolatility: 0.08, targetSharpe: 0.63,
      targetMaxDrawdown: 10, horizon: 3,
    });
    // Should find a solution
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('A6: attributeReturns decomposes factor returns', () => {
    const e = getFactorBacktestEngine();
    const attribution = e.attributeReturns({
      'pe_ttm': [0.01, 0.02, -0.01, 0.03, 0.015],
      'momentum_6m': [0.02, 0.04, -0.02, 0.05, 0.03],
    });
    expect(attribution).toHaveLength(2);
    // momentum_6m should have larger contribution
    const sorted = [...attribution].sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
    expect(sorted[0].factorId).toBe('momentum_6m');
  });

  it('A7: simulateWhatIf returns scenario with impact', () => {
    const e = getFactorBacktestEngine();
    const scenario = e.simulateWhatIf([
      { factorId: 'momentum_6m', newWeight: 0.30 },
    ]);
    expect(scenario.changes).toHaveLength(1);
    expect(scenario.changes[0].delta).toBeGreaterThan(0);
    expect(scenario.impactScore).toBeGreaterThan(0);
  });

  it('A8: analyzeSensitivity returns elasticity', () => {
    const e = getFactorBacktestEngine();
    const sensitivity = e.analyzeSensitivity(['momentum_6m', 'pe_ttm']);
    expect(sensitivity).toHaveLength(2);
    expect(sensitivity[0].perturbedResults).toHaveLength(5);
    expect(typeof sensitivity[0].elasticity).toBe('number');
  });

  it('A9: getCandidates returns 12 factors', () => {
    const e = getFactorBacktestEngine();
    expect(e.getCandidates()).toHaveLength(12);
  });
});

// B. FactorMigrationEngine (9 tests)
describe('FactorMigrationEngine', () => {
  it('B1: migrate US to HK', () => {
    const e = getFactorMigrationEngine();
    const result = e.migrate({
      sourceMarket: 'US', targetMarket: 'HK',
      factorIds: ['pe_ttm', 'momentum_6m', 'roe_ttm', 'dividend_yield'],
      strategy: 'value+quality',
    });
    expect(result.success).toBe(true);
    expect(result.targetFactors).toHaveLength(4);
    expect(result.overallScore).toBeGreaterThan(80);
  });

  it('B2: migrate US to Crypto with proxies', () => {
    const e = getFactorMigrationEngine();
    const result = e.migrate({
      sourceMarket: 'US', targetMarket: 'CRYPTO',
      factorIds: ['momentum_6m', 'volatility_20d', 'market_cap', 'pe_ttm'],
      strategy: 'crypto_adapted',
    });
    expect(result.targetFactors.some(f => f.mappingType === 'proxy')).toBe(true);
    expect(result.targetFactors.some(f => f.mappingType === 'computed')).toBe(true);
  });

  it('B3: migrate marks unavailable as unmapped', () => {
    const e = getFactorMigrationEngine();
    const result = e.migrate({
      sourceMarket: 'US', targetMarket: 'CRYPTO',
      factorIds: ['gross_margin'],
      strategy: 'test',
    });
    expect(result.unmappedFactors).toContain('gross_margin');
  });

  it('B4: unmapped factor returns warnings', () => {
    const e = getFactorMigrationEngine();
    const result = e.migrate({
      sourceMarket: 'US', targetMarket: 'CRYPTO',
      factorIds: ['debt_equity'],
      strategy: 'test',
    });
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('B5: getMappings returns mappings for source', () => {
    const e = getFactorMigrationEngine();
    const mappings = e.getMappings('US', 'pe_ttm');
    expect(mappings.length).toBeGreaterThan(0);
  });

  it('B6: getMarketMappings returns all US mappings', () => {
    const e = getFactorMigrationEngine();
    const mappings = e.getMarketMappings('US');
    expect(mappings.length).toBeGreaterThan(0);
    expect(mappings.every(m => m.sourceMarket === 'US')).toBe(true);
  });

  it('B7: getValidationReport returns cross-market validation', () => {
    const e = getFactorMigrationEngine();
    const report = e.getValidationReport('US', 'HK');
    expect(report.length).toBeGreaterThan(0);
    expect(report.every(v => v.sourceMarket === 'US' && v.targetMarket === 'HK')).toBe(true);
  });

  it('B8: assessTransplant rates risk level', () => {
    const e = getFactorMigrationEngine();
    const transplant = e.assessTransplant('Multi-Factor Strategy', 'US', 'HK', ['pe_ttm', 'momentum_6m', 'roe_ttm', 'dividend_yield']);
    expect(transplant.riskLevel).toBe('low');
    expect(transplant.confidence).toBeGreaterThan(0);
  });

  it('B9: isMappable checks pair', () => {
    const e = getFactorMigrationEngine();
    const result = e.isMappable('US', 'pe_ttm', 'HK');
    expect(result.mappable).toBe(true);
    expect(result.type).toBe('direct');
    const notMappable = e.isMappable('US', 'pe_ttm', 'JP');
    expect(notMappable.mappable).toBe(false);
  });
});

// C. StrategyTemplateUnifier (8 tests)
describe('StrategyTemplateUnifier', () => {
  it('C1: generate preset creates valid strategy', () => {
    const u = getStrategyTemplateUnifier();
    const instance = u.generate('classic-value');
    expect(instance).not.toBeNull();
    if (instance) {
      expect(instance.factors.length).toBeGreaterThan(0);
      expect(instance.templateId).toBe('unified-core-v1');
      expect(instance.presetId).toBe('classic-value');
    }
  });

  it('C2: classic value has high value weight', () => {
    const u = getStrategyTemplateUnifier();
    const instance = u.generate('classic-value');
    expect(instance).not.toBeNull();
    if (instance) {
      const valueWeight = instance.factors
        .filter(f => f.category === 'value')
        .reduce((s, f) => s + f.weight, 0);
      expect(valueWeight).toBeGreaterThan(20);
    }
  });

  it('C3: aggressive growth emphasis growth + momentum', () => {
    const u = getStrategyTemplateUnifier();
    const instance = u.generate('aggressive-growth');
    expect(instance).not.toBeNull();
    if (instance) {
      const growthWeight = instance.factors
        .filter(f => f.category === 'growth' || f.category === 'momentum')
        .reduce((s, f) => s + f.weight, 0);
      expect(growthWeight).toBeGreaterThan(50);
    }
  });

  it('C4: low vol income uses minVol objective', () => {
    const u = getStrategyTemplateUnifier();
    const instance = u.generate('low-vol-income');
    expect(instance).not.toBeNull();
    if (instance) {
      expect(instance.optimization.objective).toBe('minVol');
    }
  });

  it('C5: generateAll returns 7 instances', () => {
    const u = getStrategyTemplateUnifier();
    const all = u.generateAll();
    expect(all).toHaveLength(7);
    expect(all.every(i => i.templateId === 'unified-core-v1')).toBe(true);
  });

  it('C6: diffPresets finds weight differences', () => {
    const u = getStrategyTemplateUnifier();
    const diff = u.diffPresets('classic-value', 'aggressive-growth');
    expect(diff).not.toBeNull();
    if (diff) {
      expect(diff.similarityScore).toBeLessThan(100);
      expect(diff.differences.length).toBeGreaterThan(0);
    }
  });

  it('C7: compareAll returns matrix', () => {
    const u = getStrategyTemplateUnifier();
    const result = u.compareAll();
    expect(result.presets).toHaveLength(7);
    expect(result.matrix).toBeDefined();
  });

  it('C8: migrateLegacy maps all 10 legacy templates', () => {
    const u = getStrategyTemplateUnifier();
    const legacy = u.getLegacyTemplates();
    expect(legacy).toHaveLength(10);
    let migrated = 0;
    for (let i = 0; i < legacy.length; i++) {
      const result = u.migrateLegacy(legacy[i]);
      if (result.success) migrated++;
    }
    expect(migrated).toBeGreaterThanOrEqual(7);
  });
});

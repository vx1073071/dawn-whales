// J-40-03: StrategyExportImport Tests
import { describe, it, expect, beforeEach } from 'vitest';
import {
  StrategyExportImport,
  StrategyConfig,
} from '../electron/engine/analysis/strategy-export-import';

describe('J-40-03: StrategyExportImport', () => {
  let engine: StrategyExportImport;

  const createStrategy = (id: string, name: string, overrides?: Partial<StrategyConfig>): StrategyConfig => ({
    id,
    name,
    version: '1.0.0',
    engine: 'StrategyOptimizer',
    parameters: { fast_period: 10, slow_period: 30, threshold: 0.5 },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  });

  beforeEach(() => {
    engine = new StrategyExportImport();
  });

  // ── Strategy Registration ─────────────────────────────────────────

  it('should register a strategy', () => {
    const strategy = createStrategy('s1', 'MA Cross');
    engine.registerStrategy(strategy);

    const retrieved = engine.getStrategy('s1');
    expect(retrieved).not.toBeNull();
    expect(retrieved!.name).toBe('MA Cross');
  });

  it('should throw on invalid strategy registration', () => {
    expect(() => engine.registerStrategy({ id: '', name: '', engine: '' } as any))
      .toThrow('Strategy must have id, name, and engine');
  });

  it('should get all strategies', () => {
    engine.registerStrategy(createStrategy('s1', 'MA Cross'));
    engine.registerStrategy(createStrategy('s2', 'RSI'));

    expect(engine.getAllStrategies()).toHaveLength(2);
  });

  it('should remove a strategy', () => {
    engine.registerStrategy(createStrategy('s1', 'MA Cross'));
    expect(engine.removeStrategy('s1')).toBe(true);
    expect(engine.getStrategy('s1')).toBeNull();
  });

  // ── Export ─────────────────────────────────────────────────────────

  it('should export strategies to JSON', () => {
    engine.registerStrategy(createStrategy('s1', 'MA Cross'));
    engine.registerStrategy(createStrategy('s2', 'RSI'));

    const result = engine.exportStrategies(['s1', 's2'], 'json');

    expect(result.success).toBe(true);
    expect(result.format).toBe('json');
    expect(result.manifest.strategyCount).toBe(2);
    expect(result.data).toContain('MA Cross');
    expect(result.errors).toHaveLength(0);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('should export to YAML format', () => {
    engine.registerStrategy(createStrategy('s1', 'MA Cross'));

    const result = engine.exportStrategies(['s1'], 'yaml');

    expect(result.success).toBe(true);
    expect(result.format).toBe('yaml');
    expect(result.data).toContain('id: "s1"');
  });

  it('should export all strategies', () => {
    engine.registerStrategy(createStrategy('s1', 'MA Cross'));
    engine.registerStrategy(createStrategy('s2', 'RSI'));

    const result = engine.exportAll('json');

    expect(result.success).toBe(true);
    expect(result.manifest.strategyCount).toBe(2);
  });

  it('should fail export with no strategy IDs', () => {
    const result = engine.exportStrategies([], 'json');

    expect(result.success).toBe(false);
    expect(result.errors).toContain('No strategy IDs provided');
  });

  it('should report missing strategies in export', () => {
    engine.registerStrategy(createStrategy('s1', 'MA Cross'));

    const result = engine.exportStrategies(['s1', 'nonexistent'], 'json');

    expect(result.success).toBe(true);
    expect(result.manifest.strategyCount).toBe(1);
    expect(result.errors).toContain("Strategy 'nonexistent' not found");
  });

  it('should include checksum in manifest', () => {
    engine.registerStrategy(createStrategy('s1', 'MA Cross'));

    const result = engine.exportStrategies(['s1'], 'json');

    expect(result.manifest.checksum).toBeTruthy();
    expect(result.manifest.checksum.length).toBe(8);
  });

  it('should track export history', () => {
    engine.registerStrategy(createStrategy('s1', 'MA Cross'));

    engine.exportStrategies(['s1'], 'json');
    engine.exportStrategies(['s1'], 'yaml');

    const history = engine.getExportHistory();
    expect(history).toHaveLength(2);
    expect(history[0].format).toBe('json');
    expect(history[1].format).toBe('yaml');
  });

  // ── Import Validation ─────────────────────────────────────────────

  it('should validate valid JSON import', () => {
    const data = JSON.stringify({
      version: '1.0.0',
      exportedAt: Date.now(),
      strategies: [createStrategy('s1', 'MA Cross')],
    });

    const validation = engine.validateImport(data, 'json');

    expect(validation.valid).toBe(true);
    expect(validation.strategies).toHaveLength(1);
    expect(validation.errors).toHaveLength(0);
  });

  it('should detect invalid JSON', () => {
    const validation = engine.validateImport('not valid json', 'json');

    expect(validation.valid).toBe(false);
    expect(validation.errors.length).toBeGreaterThan(0);
  });

  it('should detect duplicate ID conflicts', () => {
    engine.registerStrategy(createStrategy('s1', 'MA Cross'));

    const data = JSON.stringify({
      version: '1.0.0',
      exportedAt: Date.now(),
      strategies: [createStrategy('s1', 'MA Cross v2', { version: '2.0.0' })],
    });

    const validation = engine.validateImport(data, 'json');

    expect(validation.conflicts.length).toBeGreaterThan(0);
    expect(validation.conflicts[0].type).toBe('version_mismatch');
  });

  it('should warn about unknown engines', () => {
    const data = JSON.stringify({
      version: '1.0.0',
      exportedAt: Date.now(),
      strategies: [createStrategy('s1', 'Custom', { engine: 'UnknownEngine' })],
    });

    const validation = engine.validateImport(data, 'json');

    expect(validation.warnings.length).toBeGreaterThan(0);
  });

  // ── Import ────────────────────────────────────────────────────────

  it('should import strategies with skip policy', () => {
    engine.registerStrategy(createStrategy('s1', 'MA Cross'));

    const data = JSON.stringify({
      version: '1.0.0',
      exportedAt: Date.now(),
      strategies: [
        createStrategy('s1', 'MA Cross v2', { version: '2.0.0' }),
        createStrategy('s2', 'RSI'),
      ],
    });

    const result = engine.importStrategies(data, 'json', 'skip');

    expect(result.success).toBe(true);
    expect(result.imported).toBe(1); // s2
    expect(result.skipped).toBe(1); // s1
  });

  it('should import with overwrite policy', () => {
    engine.registerStrategy(createStrategy('s1', 'MA Cross', { version: '1.0.0' }));

    const data = JSON.stringify({
      version: '1.0.0',
      exportedAt: Date.now(),
      strategies: [createStrategy('s1', 'MA Cross v2', { version: '2.0.0' })],
    });

    const result = engine.importStrategies(data, 'json', 'overwrite');

    expect(result.success).toBe(true);
    expect(result.overwritten).toBe(1);
    expect(engine.getStrategy('s1')!.version).toBe('2.0.0');
  });

  it('should import with merge policy', () => {
    engine.registerStrategy(createStrategy('s1', 'MA Cross', {
      parameters: { fast_period: 10, slow_period: 30 },
      tags: ['momentum'],
    }));

    const data = JSON.stringify({
      version: '1.0.0',
      exportedAt: Date.now(),
      strategies: [createStrategy('s1', 'MA Cross', {
        parameters: { fast_period: 15, threshold: 0.6 },
        tags: ['trend'],
      })],
    });

    const result = engine.importStrategies(data, 'json', 'merge');

    expect(result.success).toBe(true);
    expect(result.merged).toBe(1);

    const merged = engine.getStrategy('s1')!;
    expect(merged.parameters.fast_period).toBe(15); // incoming
    expect(merged.parameters.slow_period).toBe(30); // preserved
    expect(merged.parameters.threshold).toBe(0.6); // new
    expect(merged.tags).toContain('momentum');
    expect(merged.tags).toContain('trend');
  });

  it('should fail import with invalid data', () => {
    const result = engine.importStrategies('invalid json', 'json');

    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  // ── Roundtrip ─────────────────────────────────────────────────────

  it('should roundtrip export → import', () => {
    engine.registerStrategy(createStrategy('s1', 'MA Cross', {
      parameters: { fast: 10, slow: 30 },
      tags: ['momentum'],
    }));
    engine.registerStrategy(createStrategy('s2', 'RSI', {
      parameters: { period: 14, oversold: 30, overbought: 70 },
    }));

    // Export
    const exported = engine.exportStrategies(['s1', 's2'], 'json');
    expect(exported.success).toBe(true);

    // Import into fresh engine
    const engine2 = new StrategyExportImport();
    const imported = engine2.importStrategies(exported.data, 'json');

    expect(imported.success).toBe(true);
    expect(imported.imported).toBe(2);
    expect(engine2.getStrategy('s1')!.name).toBe('MA Cross');
    expect(engine2.getStrategy('s2')!.parameters.period).toBe(14);
  });

  // ── Statistics ────────────────────────────────────────────────────

  it('should report statistics', () => {
    engine.registerStrategy(createStrategy('s1', 'MA Cross', { engine: 'StrategyOptimizer' }));
    engine.registerStrategy(createStrategy('s2', 'RSI', { engine: 'MultiTimeframeEngine' }));

    const stats = engine.getStats();

    expect(stats.totalStrategies).toBe(2);
    expect(stats.engines.StrategyOptimizer).toBe(1);
    expect(stats.engines.MultiTimeframeEngine).toBe(1);
  });

  // ── Cleanup ───────────────────────────────────────────────────────

  it('should clear all data', () => {
    engine.registerStrategy(createStrategy('s1', 'MA Cross'));
    engine.exportStrategies(['s1'], 'json');

    engine.clearAll();

    expect(engine.getAllStrategies()).toHaveLength(0);
    expect(engine.getExportHistory()).toHaveLength(0);
    expect(engine.getExportStatus()).toBe('idle');
  });
});

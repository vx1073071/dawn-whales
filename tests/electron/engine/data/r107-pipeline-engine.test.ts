/**
 * R107 S-28 — Pipeline Engine tests (pipeline-engine.ts)
 * Tests: CRUD, flow execution, error recovery, retry, cancellation
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('electron-log', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../errors', () => ({
  EngineError: class EngineError extends Error {
    code: string;
    constructor(code: string, msg: string) { super(msg); this.code = code; }
  },
  ErrorCode: { INTERNAL_ERROR: 'INTERNAL_ERROR', TIMEOUT: 'TIMEOUT', VALIDATION_ERROR: 'VALIDATION_ERROR' },
}));

vi.mock('../utils/id', () => ({
  generateId: () => `pipeline-${Math.random().toString(36).slice(2, 10)}`,
}));

import { PipelineEngine } from '../electron/engine/data/pipeline-engine';
import type { PipelineConfig, PipelineStep } from '../electron/engine/data/pipeline-engine';

function makeConfig(overrides: Partial<PipelineConfig> = {}): PipelineConfig {
  return {
    id: 'test-pipeline-1',
    name: 'Test Pipeline',
    description: 'A test pipeline',
    retryOnFailure: true,
    maxRetries: 2,
    timeoutMs: 5000,
    parallel: false,
    ...overrides,
  };
}

let stepCounter = 0;
function makeStep(overrides: Partial<PipelineStep> = {}): PipelineStep {
  stepCounter++;
  return {
    id: overrides.id || `step-${stepCounter}`,
    name: overrides.name || `Test Step ${stepCounter}`,
    type: overrides.type || 'transform',
    enabled: overrides.enabled !== false,
    config: overrides.config || {},
    fn: overrides.fn || (async (input: unknown[]) => input.map((row) => ({ ...(row as Record<string,unknown>), transformed: true }))),
  };
}

describe('PipelineEngine', () => {
  let engine: PipelineEngine;

  beforeEach(() => {
    engine = new PipelineEngine();
  });

  // ── 1. Create pipeline ─────────────────────────────────────────────
  it('creates a pipeline and returns its id', () => {
    const cfg = makeConfig();
    const id = engine.createPipeline(cfg);
    expect(id).toBe(cfg.id);
  });

  // ── 2. Duplicate pipeline throws ───────────────────────────────────
  it('throws when creating duplicate pipeline', () => {
    engine.createPipeline(makeConfig({ id: 'dup' }));
    expect(() => engine.createPipeline(makeConfig({ id: 'dup' }))).toThrow();
  });

  // ── 3. Add steps and retrieve ──────────────────────────────────────
  it('adds steps to a pipeline', () => {
    engine.createPipeline(makeConfig());
    engine.addStep('test-pipeline-1', makeStep({ name: 'Extract' }));
    engine.addStep('test-pipeline-1', makeStep({ name: 'Transform' }));

    const pipeline = engine.getPipeline('test-pipeline-1');
    expect(pipeline.steps).toHaveLength(2);
    expect(pipeline.steps[0].name).toBe('Extract');
    expect(pipeline.steps[1].name).toBe('Transform');
  });

  // ── 4. Run pipeline with data ──────────────────────────────────────
  it('runs a pipeline and returns completed run', async () => {
    engine.createPipeline(makeConfig());
    engine.addStep('test-pipeline-1', makeStep({
      fn: async (input) => input.map((r: any) => ({ ...r, enriched: true })),
    }));

    const input = [{ symbol: 'HK.00700' }, { symbol: 'US.AAPL' }];
    const run = await engine.run('test-pipeline-1', input);

    expect(run.status).toBe('completed');
    expect(run.stepsCompleted).toBe(1);
    expect(run.rowsProcessed).toBe(2);
    expect(run.durationMs).toBeGreaterThanOrEqual(0);
  });

  // ── 5. Pipeline with disabled step skips it ────────────────────────
  it('skips disabled steps', async () => {
    engine.createPipeline(makeConfig());
    engine.addStep('test-pipeline-1', makeStep({ name: 'Active', enabled: true }));
    engine.addStep('test-pipeline-1', makeStep({ name: 'Skipped', enabled: false }));

    const run = await engine.run('test-pipeline-1', [{}]);
    expect(run.status).toBe('completed');
    // Only 1 enabled step completed
    expect(run.stepsCompleted).toBe(1);
  });

  // ── 6. Error recovery — step failure ───────────────────────────────
  it('handles step failure with retry and marks pipeline as failed', async () => {
    const cfg = makeConfig({ maxRetries: 1, timeoutMs: 10000 });
    engine.createPipeline(cfg);

    let callCount = 0;
    engine.addStep('test-pipeline-1', makeStep({
      fn: async () => { callCount++; throw new Error('Step failed transiently'); },
    }));

    const run = await engine.run('test-pipeline-1', [{}]);

    // With retry: step tried twice (initial + 1 retry)
    expect(callCount).toBeGreaterThanOrEqual(2);
    expect(run.status).toBe('failed');
    expect(run.errors.length).toBeGreaterThan(0);
  });

  // ── 7. Get stats ───────────────────────────────────────────────────
  it('returns pipeline statistics', () => {
    const stats = engine.getStats();
    expect(stats).toHaveProperty('totalPipelines');
    expect(stats).toHaveProperty('totalRuns');
    expect(stats).toHaveProperty('successRate');
    expect(stats).toHaveProperty('avgDurationMs');
    expect(typeof stats.totalPipelines).toBe('number');
    expect(typeof stats.successRate).toBe('number');
  });

  // ── 8. Multiple steps in sequence ──────────────────────────────────
  it('executes multiple steps in sequence', async () => {
    engine.createPipeline(makeConfig({ parallel: false }));

    const tracking: string[] = [];
    engine.addStep('test-pipeline-1', makeStep({
      name: 'Step1',
      fn: async (input) => { tracking.push('step1'); return input.map((r: any) => ({ ...r, s1: true })); },
    }));
    engine.addStep('test-pipeline-1', makeStep({
      name: 'Step2',
      fn: async (input) => { tracking.push('step2'); return input.map((r: any) => ({ ...r, s2: true })); },
    }));

    const run = await engine.run('test-pipeline-1', [{ x: 1 }]);
    expect(run.status).toBe('completed');
    expect(run.stepsCompleted).toBe(2);
    expect(tracking).toEqual(['step1', 'step2']);
  });

  // ── 9. Nonexistent pipeline returns error ──────────────────────────
  it('throws when running nonexistent pipeline', async () => {
    await expect(engine.run('nonexistent')).rejects.toThrow();
  });

  // ── 10. Empty input pipeline still completes ───────────────────────
  it('completes pipeline with empty input', async () => {
    engine.createPipeline(makeConfig());
    engine.addStep('test-pipeline-1', makeStep());

    const run = await engine.run('test-pipeline-1', []);
    expect(run.status).toBe('completed');
    expect(run.rowsProcessed).toBe(0);
  });
});

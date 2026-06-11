/**
 * Tests for PipelineEngine (JVS-87)
 * Covers: electron/engine/data/pipeline-engine.ts (965 lines)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  PipelineEngine,
  StepTemplates,
  type PipelineConfig,
  type PipelineStep,
} from '../../../../electron/engine/data/pipeline-engine';

// Suppress noisy log output in test
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});
vi.spyOn(console, 'debug').mockImplementation(() => {});

function makeConfig(overrides?: Partial<PipelineConfig>): PipelineConfig {
  return {
    id: 'test-pipeline',
    name: 'Test Pipeline',
    description: 'test',
    retryOnFailure: false,
    maxRetries: 0,
    timeoutMs: 5000,
    parallel: false,
    ...overrides,
  };
}

describe('PipelineEngine', () => {
  let engine: PipelineEngine;

  beforeEach(() => {
    engine = new PipelineEngine();
  });

  // ── Pipeline CRUD ────────────────────────────────────────────────────────

  describe('CRUD', () => {
    it('should create a pipeline and return its id', () => {
      const id = engine.createPipeline(makeConfig());
      expect(id).toBe('test-pipeline');
    });

    it('should throw on duplicate pipeline id', () => {
      engine.createPipeline(makeConfig());
      expect(() => engine.createPipeline(makeConfig())).toThrow();
    });

    it('should get a pipeline with steps', () => {
      engine.createPipeline(makeConfig());
      const result = engine.getPipeline('test-pipeline');
      expect(result.id).toBe('test-pipeline');
      expect(result.steps).toEqual([]);
    });

    it('should throw getting nonexistent pipeline', () => {
      expect(() => engine.getPipeline('nope')).toThrow();
    });

    it('should list all pipelines', () => {
      engine.createPipeline(makeConfig({ id: 'p1', name: 'P1' }));
      engine.createPipeline(makeConfig({ id: 'p2', name: 'P2' }));
      const list = engine.listPipelines();
      expect(list.length).toBe(2);
    });

    it('should delete a pipeline and its run history', async () => {
      engine.createPipeline(makeConfig());
      engine.addStep('test-pipeline', StepTemplates.filter('s1', 'keep all', () => true));
      await engine.run('test-pipeline', [1, 2]);
      expect(engine.getRunHistory().length).toBe(1);

      expect(engine.deletePipeline('test-pipeline')).toBe(true);
      expect(engine.getRunHistory().length).toBe(0);
    });

    it('should return false deleting nonexistent pipeline', () => {
      expect(engine.deletePipeline('nope')).toBe(false);
    });
  });

  // ── Step management ──────────────────────────────────────────────────────

  describe('step management', () => {
    it('should add a step', () => {
      engine.createPipeline(makeConfig());
      const step = StepTemplates.filter('s1', 'keep all', () => true);
      engine.addStep('test-pipeline', step);
      expect(engine.getPipeline('test-pipeline').steps.length).toBe(1);
    });

    it('should throw adding step to nonexistent pipeline', () => {
      expect(() => engine.addStep('nope', StepTemplates.filter('s1', 'f', () => true))).toThrow();
    });

    it('should throw on duplicate step id', () => {
      engine.createPipeline(makeConfig());
      const step = StepTemplates.filter('s1', 'f', () => true);
      engine.addStep('test-pipeline', step);
      expect(() => engine.addStep('test-pipeline', step)).toThrow();
    });

    it('should remove a step', () => {
      engine.createPipeline(makeConfig());
      engine.addStep('test-pipeline', StepTemplates.filter('s1', 'f', () => true));
      engine.removeStep('test-pipeline', 's1');
      expect(engine.getPipeline('test-pipeline').steps.length).toBe(0);
    });

    it('should throw removing step from nonexistent pipeline', () => {
      expect(() => engine.removeStep('nope', 's1')).toThrow();
    });

    it('should throw removing nonexistent step', () => {
      engine.createPipeline(makeConfig());
      expect(() => engine.removeStep('test-pipeline', 'nope')).toThrow();
    });
  });

  // ── Sequential execution ─────────────────────────────────────────────────

  describe('sequential execution', () => {
    it('should run steps in order passing output to next', async () => {
      engine.createPipeline(makeConfig());
      engine.addStep('test-pipeline', StepTemplates.filter('s1', 'even', (r: any) => r % 2 === 0));
      engine.addStep('test-pipeline', StepTemplates.map('s2', 'double', (r: any) => r * 2));
      const run = await engine.run('test-pipeline', [1, 2, 3, 4]);
      expect(run.status).toBe('completed');
      expect(run.rowsProcessed).toBe(2);
      expect(run.stepsCompleted).toBe(2);
      expect(run.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should handle empty input', async () => {
      engine.createPipeline(makeConfig());
      engine.addStep('test-pipeline', StepTemplates.filter('s1', 'all', () => true));
      const run = await engine.run('test-pipeline');
      expect(run.status).toBe('completed');
      expect(run.rowsProcessed).toBe(0);
    });

    it('should skip disabled steps', async () => {
      engine.createPipeline(makeConfig());
      engine.addStep('test-pipeline', StepTemplates.filter('s1', 'disabled', () => false));
      // Disable the step
      const pipeline = engine.getPipeline('test-pipeline');
      pipeline.steps[0].enabled = false;
      // Re-create with disabled step
      engine = new PipelineEngine();
      engine.createPipeline(makeConfig());
      const step: PipelineStep = {
        ...StepTemplates.filter('s1', 'disabled', () => false),
        enabled: false,
      };
      engine.addStep('test-pipeline', step);
      engine.addStep('test-pipeline', StepTemplates.map('s2', 'pass', (r: any) => r));
      const run = await engine.run('test-pipeline', [1, 2, 3]);
      expect(run.rowsProcessed).toBe(3); // disabled step skipped
      expect(run.stepsCompleted).toBe(1); // only s2 ran
    });

    it('should mark run as failed when step throws', async () => {
      engine.createPipeline(makeConfig());
      const failStep: PipelineStep = {
        id: 'fail',
        name: 'Fail Step',
        type: 'transform',
        enabled: true,
        config: {},
        fn: async () => { throw new Error('boom'); },
      };
      engine.addStep('test-pipeline', failStep);
      const run = await engine.run('test-pipeline', [1]);
      expect(run.status).toBe('failed');
      expect(run.errors.length).toBeGreaterThan(0);
    });

    it('should throw when running nonexistent pipeline', async () => {
      await expect(engine.run('nope')).rejects.toThrow();
    });
  });

  // ── Retry ────────────────────────────────────────────────────────────────

  describe('retry', () => {
    it('should retry failed steps and succeed eventually', async () => {
      engine.createPipeline(makeConfig({ retryOnFailure: true, maxRetries: 2, timeoutMs: 30000 }));

      let attempts = 0;
      const flakyStep: PipelineStep = {
        id: 'flaky',
        name: 'Flaky',
        type: 'transform',
        enabled: true,
        config: {},
        fn: async (input) => {
          attempts++;
          if (attempts < 3) throw new Error('transient');
          return input;
        },
      };
      engine.addStep('test-pipeline', flakyStep);

      const run = await engine.run('test-pipeline', [1, 2]);

      // Step succeeded on 3rd attempt, data was processed
      expect(attempts).toBe(3);
      expect(run.rowsProcessed).toBe(2);
      expect(run.stepsCompleted).toBe(1);
    }, 10000);

    it('should fail after exhausting retries', async () => {
      engine.createPipeline(makeConfig({ retryOnFailure: true, maxRetries: 1, timeoutMs: 30000 }));
      const alwaysFail: PipelineStep = {
        id: 'fail',
        name: 'Always Fail',
        type: 'transform',
        enabled: true,
        config: {},
        fn: async () => { throw new Error('permanent'); },
      };
      engine.addStep('test-pipeline', alwaysFail);
      const run = await engine.run('test-pipeline', [1]);
      expect(run.status).toBe('failed');
    }, 10000);
  });

  // ── Timeout & Cancel ─────────────────────────────────────────────────────

  describe('timeout & cancel', () => {
    it('should timeout after configured duration', async () => {
      vi.useFakeTimers();
      engine.createPipeline(makeConfig({ timeoutMs: 100 }));
      const slowStep: PipelineStep = {
        id: 'slow',
        name: 'Slow',
        type: 'transform',
        enabled: true,
        config: {},
        fn: (input) => new Promise(resolve => setTimeout(() => resolve(input), 500)),
      };
      engine.addStep('test-pipeline', slowStep);

      const runPromise = engine.run('test-pipeline', [1]);
      await vi.advanceTimersByTimeAsync(150);
      const run = await runPromise;
      expect(run.status).toBe('failed');
      expect(run.errors.some(e => e.includes('timed out'))).toBe(true);
      vi.useRealTimers();
    });

    it('should support cancellation', async () => {
      vi.useFakeTimers();
      engine.createPipeline(makeConfig({ timeoutMs: 10000 }));
      const slowStep: PipelineStep = {
        id: 'slow',
        name: 'Slow',
        type: 'transform',
        enabled: true,
        config: {},
        fn: (input) => new Promise(resolve => setTimeout(() => resolve(input), 5000)),
      };
      engine.addStep('test-pipeline', slowStep);

      const runPromise = engine.run('test-pipeline', [1]);
      const history = engine.getRunHistory();
      const runId = history[history.length - 1].id;

      expect(engine.cancel(runId)).toBe(true);
      await vi.advanceTimersByTimeAsync(10);
      const run = await runPromise;
      expect(run.status).toBe('cancelled');
      vi.useRealTimers();
    });

    it('should return false cancelling nonexistent run', () => {
      expect(engine.cancel('nope')).toBe(false);
    });
  });

  // ── Parallel execution ──────────────────────────────────────────────────

  describe('parallel execution', () => {
    it('should group consecutive same-type steps', async () => {
      engine.createPipeline(makeConfig({ parallel: true }));
      engine.addStep('test-pipeline', StepTemplates.map('m1', 'add1', (r: any) => r + 1));
      engine.addStep('test-pipeline', StepTemplates.map('m2', 'add10', (r: any) => r + 10));

      const run = await engine.run('test-pipeline', [1, 2, 3]);
      // m1 produces [2,3,4], m2 produces [11,12,13], concatenated = 6 rows
      expect(run.status).toBe('completed');
      expect(run.rowsProcessed).toBe(6);
      expect(run.stepsCompleted).toBe(2);
    });

    it('should handle single step in parallel mode', async () => {
      engine.createPipeline(makeConfig({ parallel: true }));
      engine.addStep('test-pipeline', StepTemplates.filter('s1', 'all', () => true));
      const run = await engine.run('test-pipeline', [1, 2]);
      expect(run.status).toBe('completed');
    });
  });

  // ── Run history & stats ──────────────────────────────────────────────────

  describe('run history & stats', () => {
    it('should track run history', async () => {
      engine.createPipeline(makeConfig());
      engine.addStep('test-pipeline', StepTemplates.filter('s1', 'all', () => true));
      await engine.run('test-pipeline', [1]);
      await engine.run('test-pipeline', [2]);
      expect(engine.getRunHistory().length).toBe(2);
    });

    it('should filter history by pipelineId', async () => {
      engine.createPipeline(makeConfig({ id: 'p1', name: 'P1' }));
      engine.createPipeline(makeConfig({ id: 'p2', name: 'P2' }));
      engine.addStep('p1', StepTemplates.filter('s1', 'all', () => true));
      engine.addStep('p2', StepTemplates.filter('s2', 'all', () => true));
      await engine.run('p1', [1]);
      await engine.run('p2', [2]);
      expect(engine.getRunHistory('p1').length).toBe(1);
      expect(engine.getRunHistory('p2').length).toBe(1);
    });

    it('should compute stats', async () => {
      engine.createPipeline(makeConfig());
      engine.addStep('test-pipeline', StepTemplates.filter('s1', 'all', () => true));
      await engine.run('test-pipeline', [1]);
      const stats = engine.getStats();
      expect(stats.totalPipelines).toBe(1);
      expect(stats.totalRuns).toBe(1);
      expect(stats.successRate).toBe(1);
      expect(stats.avgDurationMs).toBeGreaterThanOrEqual(0);
    });

    it('should compute success rate correctly with mixed results', async () => {
      engine.createPipeline(makeConfig());
      engine.addStep('test-pipeline', StepTemplates.filter('s1', 'all', () => true));
      await engine.run('test-pipeline', [1]); // success

      // Add a failing step
      engine = new PipelineEngine();
      engine.createPipeline(makeConfig({ id: 'p2' }));
      engine.addStep('p2', StepTemplates.filter('s1', 'all', () => true));
      await engine.run('p2', [1]); // success
      const failStep: PipelineStep = {
        id: 'fail', name: 'Fail', type: 'transform', enabled: true, config: {},
        fn: async () => { throw new Error('x'); },
      };
      engine.addStep('p2', failStep);
      await engine.run('p2', [1]); // fail
      const stats = engine.getStats();
      expect(stats.successRate).toBe(0.5);
    });
  });

  // ── StepTemplates ────────────────────────────────────────────────────────

  describe('StepTemplates', () => {
    it('filter should keep matching rows', async () => {
      const step = StepTemplates.filter('f1', 'positive', (r: any) => r > 0);
      expect(step.type).toBe('transform');
      expect(step.config.template).toBe('filter');
      const result = await step.fn([1, -1, 2, -2], {} as any);
      expect(result).toEqual([1, 2]);
    });

    it('map should transform rows', async () => {
      const step = StepTemplates.map('m1', 'double', (r: any) => r * 2);
      const result = await step.fn([1, 2, 3], {} as any);
      expect(result).toEqual([2, 4, 6]);
    });

    it('sort should order rows', async () => {
      const step = StepTemplates.sort('s1', 'asc', (a: any, b: any) => a - b);
      const result = await step.fn([3, 1, 2], {} as any);
      expect(result).toEqual([1, 2, 3]);
    });

    it('dedupe should remove duplicates', async () => {
      const step = StepTemplates.dedupe('d1', 'unique');
      const result = await step.fn([1, 1, 2, 2, 3], {} as any);
      expect(result).toEqual([1, 2, 3]);
    });

    it('dedupe should support custom keyFn', async () => {
      const step = StepTemplates.dedupe('d1', 'by id', (r: any) => String(r.id));
      const result = await step.fn([{ id: 1, v: 'a' }, { id: 1, v: 'b' }, { id: 2 }], {} as any);
      expect(result.length).toBe(2);
    });

    it('aggregate should group and reduce', async () => {
      const step = StepTemplates.aggregate('a1', 'sum by type',
        (r: any) => r.type,
        (group) => ({ type: group[0].type, total: group.reduce((s, r) => s + r.val, 0) }),
      );
      const result = await step.fn(
        [{ type: 'a', val: 1 }, { type: 'b', val: 2 }, { type: 'a', val: 3 }],
        {} as any,
      );
      expect(result.length).toBe(2);
      const aResult = result.find((r: any) => r.type === 'a');
      expect(aResult?.total).toBe(4);
    });

    it('validate should mark invalid rows', async () => {
      const step = StepTemplates.validate('v1', 'check', (r: any) => ({
        valid: r > 0,
        reason: r <= 0 ? 'must be positive' : undefined,
      }));
      const ctx = { errors: [], pipelineId: '', runId: '', startTime: '', metadata: {} } as any;
      const result = await step.fn([1, -1, 2], ctx);
      expect(result.length).toBe(3); // pass through
      expect(result[1]._validationError).toBe('must be positive');
      expect(ctx.errors.length).toBe(1);
    });

    it('validate with dropInvalid should drop bad rows', async () => {
      const step = StepTemplates.validate('v1', 'check', (r: any) => ({
        valid: r > 0,
        reason: 'negative',
      }), { dropInvalid: true });
      const ctx = { errors: [], pipelineId: '', runId: '', startTime: '', metadata: {} } as any;
      const result = await step.fn([1, -1, 2], ctx);
      expect(result.length).toBe(2);
    });

    it('enrich should add data from external source', async () => {
      const step = StepTemplates.enrich('e1', 'add flag', async (row: any) => ({
        enriched: true,
      }));
      const ctx = { errors: [], pipelineId: '', runId: '', startTime: '', metadata: {} } as any;
      const result = await step.fn([{ id: 1 }], ctx);
      expect(result[0].enriched).toBe(true);
    });

    it('enrich should handle enricher errors', async () => {
      const step = StepTemplates.enrich('e1', 'fail enrich', async () => {
        throw new Error('enrich fail');
      });
      const ctx = { errors: [], pipelineId: '', runId: '', startTime: '', metadata: {} } as any;
      const result = await step.fn([{ id: 1 }], ctx);
      expect(result[0]._enrichmentError).toBeTruthy();
    });

    it('extract should produce initial data', async () => {
      const step = StepTemplates.extract('ex1', 'generate', async () => [1, 2, 3]);
      const result = await step.fn([], {} as any);
      expect(result).toEqual([1, 2, 3]);
    });

    it('load should persist and pass through', async () => {
      const loaded: unknown[] = [];
      const step = StepTemplates.load('l1', 'collect', async (data) => {
        loaded.push(...data);
      });
      const result = await step.fn([1, 2], {} as any);
      expect(result).toEqual([1, 2]);
      expect(loaded).toEqual([1, 2]);
    });

    it('batch should process in chunks', async () => {
      const batches: number[] = [];
      const step = StepTemplates.batch('b1', 'chunk', async (batch, idx) => {
        batches.push(batch.length);
        return batch.map((r: any) => r * 2);
      }, 3);
      const result = await step.fn([1, 2, 3, 4, 5], {} as any);
      expect(result).toEqual([2, 4, 6, 8, 10]);
      expect(batches).toEqual([3, 2]);
    });

    it('flatten should unwrap arrays in field', async () => {
      const step = StepTemplates.flatten('fl1', 'flatten tags', 'tags');
      const result = await step.fn(
        [{ id: 1, tags: ['a', 'b'] }, { id: 2, tags: 'c' }],
        {} as any,
      );
      expect(result.length).toBe(3); // 2 from first row + 1 from second (no array)
    });

    it('limit should cap rows', async () => {
      const step = StepTemplates.limit('lim1', 'take 3', 3);
      const result = await step.fn([1, 2, 3, 4, 5], {} as any);
      expect(result).toEqual([1, 2, 3]);
    });

    it('tap should pass through and call callback', async () => {
      let tapped: unknown[] = [];
      const step = StepTemplates.tap('t1', 'inspect', (data) => {
        tapped = [...data];
      });
      const result = await step.fn([1, 2], {} as any);
      expect(result).toEqual([1, 2]);
      expect(tapped).toEqual([1, 2]);
    });
  });

  // ── Step execution edge cases ────────────────────────────────────────────

  describe('step execution edge cases', () => {
    it('should reject when step returns non-array', async () => {
      engine.createPipeline(makeConfig());
      const badStep: PipelineStep = {
        id: 'bad', name: 'Bad', type: 'transform', enabled: true, config: {},
        fn: async () => 'not-array' as any,
      };
      engine.addStep('test-pipeline', badStep);
      const run = await engine.run('test-pipeline', [1]);
      expect(run.status).toBe('failed');
    });

    it('should track metadata per step', async () => {
      engine.createPipeline(makeConfig());
      engine.addStep('test-pipeline', StepTemplates.map('s1', 'pass', (r: any) => r));
      await engine.run('test-pipeline', [1, 2, 3]);
      // We can verify indirectly through the run result
      const history = engine.getRunHistory();
      expect(history[0].status).toBe('completed');
    });

    it('should cancel active runs when deleting pipeline', async () => {
      vi.useFakeTimers();
      engine.createPipeline(makeConfig({ timeoutMs: 30000 }));
      const slowStep: PipelineStep = {
        id: 'slow', name: 'Slow', type: 'transform', enabled: true, config: {},
        fn: (input) => new Promise(resolve => setTimeout(() => resolve(input), 10000)),
      };
      engine.addStep('test-pipeline', slowStep);
      const runPromise = engine.run('test-pipeline', [1]);
      engine.deletePipeline('test-pipeline');
      await vi.advanceTimersByTimeAsync(10);
      const run = await runPromise;
      expect(run.status).toBe('cancelled');
      vi.useRealTimers();
    });
  });

  // ── Singleton ────────────────────────────────────────────────────────────

  describe('module exports', () => {
    it('should export PipelineEngine as default and named', async () => {
      const mod = await import('../../../../electron/engine/data/pipeline-engine');
      expect(mod.PipelineEngine).toBeTruthy();
      expect(mod.pipelineEngine).toBeInstanceOf(mod.PipelineEngine);
      expect(mod.default).toBe(mod.PipelineEngine);
    });
  });
});

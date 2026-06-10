/**
 * JVS-87: ETL Pipeline Engine
 * A generic extract-transform-load framework for data processing workflows.
 *
 * Supports multi-step pipelines with retry, timeout, cancellation,
 * context passing, and pre-built step templates.
 */

import log from 'electron-log';
import { generateId } from '../utils/id';
import { EngineError, ErrorCode } from '../errors';


// ─────────────────────────────────────────────────────────────────────────────
// Types & Interfaces
// ─────────────────────────────────────────────────────────────────────────────

export interface PipelineStep {
  id: string;
  name: string;
  type: 'extract' | 'transform' | 'load' | 'validate' | 'enrich';
  enabled: boolean;
  config: Record<string, any>;
  fn: (input: unknown[], context: PipelineContext) => Promise<any[]>;
}

export interface PipelineContext {
  pipelineId: string;
  runId: string;
  symbol?: string;
  dataType?: string;
  startTime: string;
  metadata: Record<string, any>;
  errors: { step: string; error: string; timestamp: string }[];
}

export interface PipelineRun {
  id: string;
  pipelineId: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt: string;
  completedAt?: string;
  stepsCompleted: number;
  stepsTotal: number;
  rowsProcessed: number;
  errors: string[];
  durationMs?: number;
}

export interface PipelineConfig {
  id: string;
  name: string;
  description: string;
  schedule?: string; // cron expression
  retryOnFailure: boolean;
  maxRetries: number;
  timeoutMs: number;
  parallel: boolean; // can steps run in parallel where possible
}

export interface PipelineStats {
  totalPipelines: number;
  totalRuns: number;
  successRate: number;
  avgDurationMs: number;
}

interface PipelineDefinition {
  config: PipelineConfig;
  steps: PipelineStep[];
}

interface ActiveRun {
  runId: string;
  abortController: AbortController;
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility helpers
// ─────────────────────────────────────────────────────────────────────────────


function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      },
      { once: true },
    );
  });
}

function nowISO(): string {
  return new Date().toISOString();
}

// ─────────────────────────────────────────────────────────────────────────────
// PipelineEngine
// ─────────────────────────────────────────────────────────────────────────────

export class PipelineEngine {
  /** All registered pipelines keyed by id */
  private pipelines: Map<string, PipelineDefinition> = new Map();

  /** Run history (most recent last) */
  private runHistory: PipelineRun[] = [];

  /** Currently active runs for cancellation */
  private activeRuns: Map<string, ActiveRun> = new Map();

  // ─── Pipeline CRUD ───────────────────────────────────────────────────────

  /**
   * Register a new pipeline. Returns the pipelineId.
   */
  createPipeline(config: PipelineConfig): string {
    if (this.pipelines.has(config.id)) {
      throw new EngineError(ErrorCode.INTERNAL_ERROR, `Pipeline "${config.id}" already exists`);
    }

    const definition: PipelineDefinition = {
      config: { ...config },
      steps: [],
    };

    this.pipelines.set(config.id, definition);
    log.info(`[PipelineEngine] Created pipeline "${config.name}" (${config.id})`);
    return config.id;
  }

  /**
   * Retrieve a pipeline definition together with its steps.
   */
  getPipeline(pipelineId: string): PipelineConfig & { steps: PipelineStep[] } {
    const def = this.pipelines.get(pipelineId);
    if (!def) {
      throw new EngineError(ErrorCode.INTERNAL_ERROR, `Pipeline "${pipelineId}" not found`);
    }
    return { ...def.config, steps: [...def.steps] };
  }

  /**
   * List all registered pipelines (config only, no steps).
   */
  listPipelines(): PipelineConfig[] {
    return Array.from(this.pipelines.values()).map((d) => ({ ...d.config }));
  }

  /**
   * Delete a pipeline and all its associated run history.
   * Returns true if the pipeline existed.
   */
  deletePipeline(pipelineId: string): boolean {
    if (!this.pipelines.has(pipelineId)) {
      return false;
    }

    // Cancel any active runs for this pipeline
    for (const [runId, active] of this.activeRuns.entries()) {
      const run = this.runHistory.find((r) => r.id === runId);
      if (run && run.pipelineId === pipelineId) {
        active.abortController.abort();
        this.activeRuns.delete(runId);
        log.info(`[PipelineEngine] Cancelled active run ${runId} due to pipeline deletion`);
      }
    }

    this.pipelines.delete(pipelineId);
    this.runHistory = this.runHistory.filter((r) => r.pipelineId !== pipelineId);
    log.info(`[PipelineEngine] Deleted pipeline "${pipelineId}"`);
    return true;
  }

  // ─── Step management ─────────────────────────────────────────────────────

  /**
   * Append a step to an existing pipeline.
   */
  addStep(pipelineId: string, step: PipelineStep): void {
    const def = this.pipelines.get(pipelineId);
    if (!def) {
      throw new EngineError(ErrorCode.INTERNAL_ERROR, `Pipeline "${pipelineId}" not found`);
    }

    // Prevent duplicate step ids within the same pipeline
    if (def.steps.some((s) => s.id === step.id)) {
      throw new EngineError(ErrorCode.INTERNAL_ERROR, `Step "${step.id}" already exists in pipeline "${pipelineId}"`);
    }

    def.steps.push(step);
    log.info(`[PipelineEngine] Added step "${step.name}" (${step.id}) to pipeline "${pipelineId}"`);
  }

  /**
   * Remove a step by id. Throws if the step is not found.
   */
  removeStep(pipelineId: string, stepId: string): void {
    const def = this.pipelines.get(pipelineId);
    if (!def) {
      throw new EngineError(ErrorCode.INTERNAL_ERROR, `Pipeline "${pipelineId}" not found`);
    }

    const idx = def.steps.findIndex((s) => s.id === stepId);
    if (idx === -1) {
      throw new EngineError(ErrorCode.INTERNAL_ERROR, `Step "${stepId}" not found in pipeline "${pipelineId}"`);
    }

    def.steps.splice(idx, 1);
    log.info(`[PipelineEngine] Removed step "${stepId}" from pipeline "${pipelineId}"`);
  }

  // ─── Execution ───────────────────────────────────────────────────────────

  /**
   * Execute a pipeline. Optionally provide initial input data.
   * Returns a PipelineRun summary.
   */
  async run(pipelineId: string, input?: any[]): Promise<PipelineRun> {
    const def = this.pipelines.get(pipelineId);
    if (!def) {
      throw new EngineError(ErrorCode.INTERNAL_ERROR, `Pipeline "${pipelineId}" not found`);
    }

    const runId = generateId('run');
    const enabledSteps = def.steps.filter((s) => s.enabled);

    const run: PipelineRun = {
      id: runId,
      pipelineId,
      status: 'running',
      startedAt: nowISO(),
      stepsCompleted: 0,
      stepsTotal: enabledSteps.length,
      rowsProcessed: 0,
      errors: [],
    };

    this.runHistory.push(run);

    const abortController = new AbortController();
    this.activeRuns.set(runId, { runId, abortController });

    const context: PipelineContext = {
      pipelineId,
      runId,
      startTime: run.startedAt,
      metadata: {},
      errors: [],
    };

    log.info(
      `[PipelineEngine] Starting pipeline "${def.config.name}" (run ${runId}) ` +
        `with ${enabledSteps.length} enabled step(s)`,
    );

    // Race the execution against timeout
    const timeoutPromise = this.createTimeoutPromise(def.config.timeoutMs, abortController.signal);
    const executionPromise = this.executeSteps(
      def.config,
      enabledSteps,
      input ?? [],
      context,
      run,
      abortController.signal,
    );

    try {
      await Promise.race([executionPromise, timeoutPromise]);

      if (run.status === 'running') {
        run.status = context.errors.length > 0 ? 'failed' : 'completed';
      }
    } catch (err: unknown) {
      if (err?.name === 'AbortError') {
        if (run.status === 'running') {
          run.status = 'cancelled';
          log.info(`[PipelineEngine] Run ${runId} was cancelled`);
        }
      } else if (err?.name === 'TimeoutError') {
        run.status = 'failed';
        const msg = `Pipeline timed out after ${def.config.timeoutMs}ms`;
        run.errors.push(msg);
        context.errors.push({ step: '__timeout__', error: msg, timestamp: nowISO() });
        log.error(`[PipelineEngine] ${msg}`);
      } else {
        run.status = 'failed';
        const msg = err?.message ?? String(err);
        run.errors.push(msg);
        log.error(`[PipelineEngine] Run ${runId} failed: ${msg}`);
      }
    } finally {
      run.completedAt = nowISO();
      run.durationMs = new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime();
      this.activeRuns.delete(runId);
      log.info(
        `[PipelineEngine] Run ${runId} finished: ${run.status} ` +
          `(${run.stepsCompleted}/${run.stepsTotal} steps, ${run.rowsProcessed} rows, ${run.durationMs}ms)`,
      );
    }

    return { ...run };
  }

  /**
   * Cancel a running pipeline by runId. Returns true if cancellation was sent.
   */
  cancel(runId: string): boolean {
    const active = this.activeRuns.get(runId);
    if (!active) {
      return false;
    }

    active.abortController.abort();
    log.info(`[PipelineEngine] Cancellation requested for run ${runId}`);
    return true;
  }

  // ─── Run history & stats ────────────────────────────────────────────────

  /**
   * Return run history, optionally filtered by pipelineId.
   */
  getRunHistory(pipelineId?: string): PipelineRun[] {
    if (pipelineId) {
      return this.runHistory.filter((r) => r.pipelineId === pipelineId).map((r) => ({ ...r }));
    }
    return this.runHistory.map((r) => ({ ...r }));
  }

  /**
   * Aggregate statistics across all pipelines and runs.
   */
  getStats(): PipelineStats {
    const totalPipelines = this.pipelines.size;
    const totalRuns = this.runHistory.length;

    const completedRuns = this.runHistory.filter((r) => r.status === 'completed').length;
    const finishedRuns = this.runHistory.filter(
      (r) => r.status === 'completed' || r.status === 'failed',
    ).length;
    const successRate = finishedRuns > 0 ? completedRuns / finishedRuns : 0;

    const durations = this.runHistory
      .filter((r) => r.durationMs != null)
      .map((r) => r.durationMs as number);
    const avgDurationMs =
      durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;

    return {
      totalPipelines,
      totalRuns,
      successRate,
      avgDurationMs,
    };
  }

  // ─── Internal execution helpers ──────────────────────────────────────────

  /**
   * Execute steps sequentially or in parallel groups (by type) based on config.
   */
  private async executeSteps(
    config: PipelineConfig,
    steps: PipelineStep[],
    initialInput: any[],
    context: PipelineContext,
    run: PipelineRun,
    signal: AbortSignal,
  ): Promise<void> {
    if (signal.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    if (!config.parallel) {
      // Sequential execution
      await this.executeSequential(steps, initialInput, context, run, config, signal);
    } else {
      // Group consecutive steps of the same type for parallel execution
      await this.executeParallelGrouped(steps, initialInput, context, run, config, signal);
    }
  }

  /**
   * Execute steps one after another, passing output of one as input to the next.
   */
  private async executeSequential(
    steps: PipelineStep[],
    data: unknown[],
    context: PipelineContext,
    run: PipelineRun,
    config: PipelineConfig,
    signal: AbortSignal,
  ): Promise<void> {
    let currentData = data;

    for (const step of steps) {
      if (signal.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }

      currentData = await this.executeStepWithRetry(step, currentData, context, run, config, signal);
      run.stepsCompleted++;
      run.rowsProcessed = currentData.length;
    }
  }

  /**
   * Group consecutive steps of the same type and run each group in parallel.
   * Steps of different types still execute sequentially to preserve data flow.
   */
  private async executeParallelGrouped(
    steps: PipelineStep[],
    data: unknown[],
    context: PipelineContext,
    run: PipelineRun,
    config: PipelineConfig,
    signal: AbortSignal,
  ): Promise<void> {
    // Group consecutive steps by type
    const groups: PipelineStep[][] = [];
    for (const step of steps) {
      const lastGroup = groups[groups.length - 1];
      if (lastGroup && lastGroup[0].type === step.type) {
        lastGroup.push(step);
      } else {
        groups.push([step]);
      }
    }

    let currentData = data;

    for (const group of groups) {
      if (signal.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }

      if (group.length === 1) {
        // Single step – just run it
        currentData = await this.executeStepWithRetry(
          group[0],
          currentData,
          context,
          run,
          config,
          signal,
        );
        run.stepsCompleted++;
        run.rowsProcessed = currentData.length;
      } else {
        // Run group in parallel – each receives the same input, results are concatenated
        log.info(
          `[PipelineEngine] Running ${group.length} "${group[0].type}" steps in parallel`,
        );

        const results = await Promise.all(
          group.map((step) =>
            this.executeStepWithRetry(step, [...currentData], context, run, config, signal),
          ),
        );

        // Merge results from parallel steps (concatenate arrays)
        currentData = results.flat();
        run.stepsCompleted += group.length;
        run.rowsProcessed = currentData.length;
      }
    }
  }

  /**
   * Execute a single step with retry logic and error handling.
   */
  private async executeStepWithRetry(
    step: PipelineStep,
    data: unknown[],
    context: PipelineContext,
    run: PipelineRun,
    config: PipelineConfig,
    signal: AbortSignal,
  ): Promise<any[]> {
    const maxAttempts = config.retryOnFailure ? config.maxRetries + 1 : 1;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (signal.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }

      try {
        log.debug(
          `[PipelineEngine] Executing step "${step.name}" (attempt ${attempt}/${maxAttempts}, ${data.length} rows)`,
        );

        const result = await this.executeSingleStep(step, data, context, signal);

        if (attempt > 1) {
          log.info(
            `[PipelineEngine] Step "${step.name}" succeeded on attempt ${attempt}`,
          );
        }

        // Store step output count in metadata for downstream reference
        context.metadata[`step_${step.id}_outputCount`] = result.length;
        context.metadata[`step_${step.id}_attempts`] = attempt;

        return result;
      } catch (err: unknown) {
        if (err?.name === 'AbortError') {
          throw err; // Don't retry cancellations
        }

        lastError = err instanceof Error ? err : new Error(String(err));
        const errMsg = `[${step.name}] attempt ${attempt}/${maxAttempts}: ${lastError.message}`;

        log.warn(`[PipelineEngine] ${errMsg}`);

        context.errors.push({
          step: step.id,
          error: lastError.message,
          timestamp: nowISO(),
        });

        if (attempt < maxAttempts) {
          // Exponential backoff: 100ms, 200ms, 400ms, …
          const backoffMs = 100 * Math.pow(2, attempt - 1);
          log.debug(`[PipelineEngine] Retrying step "${step.name}" in ${backoffMs}ms`);
          await sleep(backoffMs, signal);
        }
      }
    }

    // All attempts exhausted
    const failureMsg = `Step "${step.name}" failed after ${maxAttempts} attempt(s): ${lastError?.message}`;
    run.errors.push(failureMsg);
    throw lastError ?? new Error(failureMsg);
  }

  /**
   * Execute a single step function with abort signal integration.
   */
  private async executeSingleStep(
    step: PipelineStep,
    data: unknown[],
    context: PipelineContext,
    signal: AbortSignal,
  ): Promise<any[]> {
    // Wrap the step execution in a promise that rejects on abort
    return new Promise<any[]>((resolve, reject) => {
      if (signal.aborted) {
        reject(new DOMException('Aborted', 'AbortError'));
        return;
      }

      const onAbort = () => {
        reject(new DOMException('Aborted', 'AbortError'));
      };
      signal.addEventListener('abort', onAbort, { once: true });

      step
        .fn(data, context)
        .then((result) => {
          signal.removeEventListener('abort', onAbort);
          if (!Array.isArray(result)) {
            reject(new Error(`Step "${step.name}" must return an array`));
            return;
          }
          resolve(result);
        })
        .catch((err) => {
          signal.removeEventListener('abort', onAbort);
          reject(err);
        });
    });
  }

  /**
   * Create a promise that rejects with a TimeoutError after the specified duration.
   */
  private createTimeoutPromise(ms: number, signal: AbortSignal): Promise<never> {
    return new Promise<never>((_, reject) => {
      if (signal.aborted) {
        return; // Will be handled by the execution promise
      }

      const timer = setTimeout(() => {
        const err = new Error(`Pipeline timed out after ${ms}ms`);
        err.name = 'TimeoutError';
        reject(err);
      }, ms);

      signal.addEventListener(
        'abort',
        () => {
          clearTimeout(timer);
        },
        { once: true },
      );
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Pre-built Step Templates
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Collection of factory functions for common pipeline step operations.
 * These can be used directly when building pipelines.
 */
export const StepTemplates = {
  /**
   * Create a filter step that keeps rows matching a predicate.
   */
  filter(
    id: string,
    name: string,
    predicate: (row: unknown) => boolean,
    config: Record<string, any> = {},
  ): PipelineStep {
    return {
      id,
      name,
      type: 'transform',
      enabled: true,
      config: { ...config, template: 'filter' },
      fn: async (input: unknown[]) => {
        return input.filter(predicate);
      },
    };
  },

  /**
   * Create a map step that transforms each row.
   */
  map(
    id: string,
    name: string,
    mapper: (row: unknown, index: number) => any,
    config: Record<string, any> = {},
  ): PipelineStep {
    return {
      id,
      name,
      type: 'transform',
      enabled: true,
      config: { ...config, template: 'map' },
      fn: async (input: unknown[]) => {
        return input.map(mapper);
      },
    };
  },

  /**
   * Create a sort step that orders rows by a comparator.
   */
  sort(
    id: string,
    name: string,
    comparator: (a: unknown, b: unknown) => number,
    config: Record<string, any> = {},
  ): PipelineStep {
    return {
      id,
      name,
      type: 'transform',
      enabled: true,
      config: { ...config, template: 'sort' },
      fn: async (input: unknown[]) => {
        return [...input].sort(comparator);
      },
    };
  },

  /**
   * Create a deduplicate step. By default uses JSON.stringify for comparison;
   * provide a custom keyFn for more control.
   */
  dedupe(
    id: string,
    name: string,
    keyFn?: (row: unknown) => string,
    config: Record<string, any> = {},
  ): PipelineStep {
    return {
      id,
      name,
      type: 'transform',
      enabled: true,
      config: { ...config, template: 'dedupe' },
      fn: async (input: unknown[]) => {
        const getKey = keyFn ?? ((row: unknown) => JSON.stringify(row));
        const seen = new Set<string>();
        return input.filter((row) => {
          const key = getKey(row);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      },
    };
  },

  /**
   * Create an aggregation step that groups rows and computes aggregates.
   */
  aggregate(
    id: string,
    name: string,
    groupBy: (row: unknown) => string,
    reducer: (group: any[]) => any,
    config: Record<string, any> = {},
  ): PipelineStep {
    return {
      id,
      name,
      type: 'transform',
      enabled: true,
      config: { ...config, template: 'aggregate' },
      fn: async (input: unknown[]) => {
        const groups = new Map<string, any[]>();
        for (const row of input) {
          const key = groupBy(row);
          if (!groups.has(key)) {
            groups.set(key, []);
          }
          groups.get(key)!.push(row);
        }
        return Array.from(groups.entries()).map(([key, rows]) => reducer(rows));
      },
    };
  },

  /**
   * Create a validate step that checks each row against a validator.
   * Invalid rows are logged in context.errors but still passed through
   * (with a `_validationError` field) unless `dropInvalid` is true.
   */
  validate(
    id: string,
    name: string,
    validator: (row: unknown) => { valid: boolean; reason?: string },
    options: { dropInvalid?: boolean } = {},
    config: Record<string, any> = {},
  ): PipelineStep {
    return {
      id,
      name,
      type: 'validate',
      enabled: true,
      config: { ...config, template: 'validate', dropInvalid: options.dropInvalid ?? false },
      fn: async (input: unknown[], context: PipelineContext) => {
        const results: any[] = [];
        for (const row of input) {
          const result = validator(row);
          if (!result.valid) {
            context.errors.push({
              step: id,
              error: `Validation failed: ${result.reason ?? 'unknown'} for row ${JSON.stringify(row).slice(0, 100)}`,
              timestamp: nowISO(),
            });
            if (!options.dropInvalid) {
              results.push({ ...row, _validationError: result.reason });
            }
          } else {
            results.push(row);
          }
        }
        return results;
      },
    };
  },

  /**
   * Create an enrich step that adds data to each row from an external source.
   */
  enrich(
    id: string,
    name: string,
    enricher: (row: unknown, context: PipelineContext) => Promise<Record<string, any>>,
    config: Record<string, any> = {},
  ): PipelineStep {
    return {
      id,
      name,
      type: 'enrich',
      enabled: true,
      config: { ...config, template: 'enrich' },
      fn: async (input: unknown[], context: PipelineContext) => {
        const enriched = await Promise.all(
          input.map(async (row) => {
            try {
              const extra = await enricher(row, context);
              return { ...row, ...extra };
            } catch (err: unknown) {
              context.errors.push({
                step: id,
                error: `Enrichment failed for row: ${err?.message ?? String(err)}`,
                timestamp: nowISO(),
              });
              return { ...row, _enrichmentError: err?.message ?? String(err) };
            }
          }),
        );
        return enriched;
      },
    };
  },

  /**
   * Create an extract step – typically the first step that produces initial data.
   */
  extract(
    id: string,
    name: string,
    extractor: (context: PipelineContext) => Promise<any[]>,
    config: Record<string, any> = {},
  ): PipelineStep {
    return {
      id,
      name,
      type: 'extract',
      enabled: true,
      config: { ...config, template: 'extract' },
      fn: async (_input: any[], context: PipelineContext) => {
        return extractor(context);
      },
    };
  },

  /**
   * Create a load step – typically the last step that persists or outputs data.
   */
  load(
    id: string,
    name: string,
    loader: (data: unknown[], context: PipelineContext) => Promise<void>,
    config: Record<string, any> = {},
  ): PipelineStep {
    return {
      id,
      name,
      type: 'load',
      enabled: true,
      config: { ...config, template: 'load' },
      fn: async (input: unknown[], context: PipelineContext) => {
        await loader(input, context);
        return input; // Pass through for potential downstream steps
      },
    };
  },

  /**
   * Create a batch step that processes data in configurable batch sizes.
   */
  batch(
    id: string,
    name: string,
    processor: (batch: any[], batchIndex: number) => Promise<any[]>,
    batchSize: number = 100,
    config: Record<string, any> = {},
  ): PipelineStep {
    return {
      id,
      name,
      type: 'transform',
      enabled: true,
      config: { ...config, template: 'batch', batchSize },
      fn: async (input: unknown[]) => {
        const results: any[] = [];
        for (let i = 0; i < input.length; i += batchSize) {
          const batch = input.slice(i, i + batchSize);
          const batchIndex = Math.floor(i / batchSize);
          const processed = await processor(batch, batchIndex);
          results.push(...processed);
        }
        return results;
      },
    };
  },

  /**
   * Create a flatten step that unwraps nested arrays in a specific field.
   */
  flatten(
    id: string,
    name: string,
    field: string,
    config: Record<string, any> = {},
  ): PipelineStep {
    return {
      id,
      name,
      type: 'transform',
      enabled: true,
      config: { ...config, template: 'flatten', field },
      fn: async (input: unknown[]) => {
        const results: any[] = [];
        for (const row of input) {
          const value = row[field];
          if (Array.isArray(value)) {
            for (const item of value) {
              results.push({ ...row, [field]: item });
            }
          } else {
            results.push(row);
          }
        }
        return results;
      },
    };
  },

  /**
   * Create a limit/take step that caps the number of rows.
   */
  limit(id: string, name: string, count: number, config: Record<string, any> = {}): PipelineStep {
    return {
      id,
      name,
      type: 'transform',
      enabled: true,
      config: { ...config, template: 'limit', count },
      fn: async (input: unknown[]) => {
        return input.slice(0, count);
      },
    };
  },

  /**
   * Create a passthrough step useful for logging/debugging within a pipeline.
   */
  tap(
    id: string,
    name: string,
    callback: (data: unknown[], context: PipelineContext) => void,
    config: Record<string, any> = {},
  ): PipelineStep {
    return {
      id,
      name,
      type: 'transform',
      enabled: true,
      config: { ...config, template: 'tap' },
      fn: async (input: unknown[], context: PipelineContext) => {
        callback(input, context);
        return input;
      },
    };
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Default export: singleton instance
// ─────────────────────────────────────────────────────────────────────────────

export const pipelineEngine = new PipelineEngine();
export default PipelineEngine;

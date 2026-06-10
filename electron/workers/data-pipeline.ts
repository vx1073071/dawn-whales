// T68: Data Pipeline/ETL for strategy data processing
export interface PipelineStep<T = any> {
  name: string;
  transform: (data: T) => T | Promise<T>;
  validate?: (data: T) => string | null; // returns error msg or null
}

export interface PipelineResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  step?: string;
  logs: string[];
}

export class DataPipeline<T = any> {
  private steps: PipelineStep<T>[] = [];
  private hooks: {
    before?: (data: T) => T | Promise<T>;
    after?: (result: PipelineResult<T>) => PipelineResult<T>;
    onError?: (error: string, step: string, data: T) => void;
  } = {};

  pipe(step: PipelineStep<T>): this {
    this.steps.push(step);
    return this;
  }

  hook(hooks: typeof this.hooks): this {
    Object.assign(this.hooks, hooks);
    return this;
  }

  async process(input: T): Promise<PipelineResult<T>> {
    const logs: string[] = [];
    let current = input;

    try {
      if (this.hooks.before) {
        current = await this.hooks.before(current);
        logs.push(`before hook applied`);
      }
    } catch (e) {
      const result: PipelineResult<T> = { success: false, error: e.message, step: 'before hook', logs };
      return this.hooks.after ? this.hooks.after(result) : result;
    }

    for (const step of this.steps) {
      const start = Date.now();
      try {
        current = await step.transform(current);
        logs.push(`[${step.name}] OK (${Date.now() - start}ms)`);

        if (step.validate) {
          const err = step.validate(current);
          if (err) {
            logs.push(`[${step.name}] VALIDATION FAILED: ${err}`);
            const result: PipelineResult<T> = { success: false, error: err, step: step.name, logs };
            this.hooks.onError?.(err, step.name, current);
            return this.hooks.after ? this.hooks.after(result) : result;
          }
        }
      } catch (e) {
        logs.push(`[${step.name}] ERROR: ${e.message} (${Date.now() - start}ms)`);
        const result: PipelineResult<T> = { success: false, error: e.message, step: step.name, logs };
        this.hooks.onError?.(e.message, step.name, current);
        return this.hooks.after ? this.hooks.after(result) : result;
      }
    }

    const result: PipelineResult<T> = { success: true, data: current, logs };
    return this.hooks.after ? this.hooks.after(result) : result;
  }
}

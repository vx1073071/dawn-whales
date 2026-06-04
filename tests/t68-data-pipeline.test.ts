import { describe, it, expect, vi } from 'vitest';
import { DataPipeline } from '../electron/workers/data-pipeline';

describe('DataPipeline', () => {
  it('should process through all steps', async () => {
    const pipeline = new DataPipeline<number>()
      .pipe({ name: 'x2', transform: n => n * 2 })
      .pipe({ name: 'plus10', transform: n => n + 10 });

    const result = await pipeline.process(5);
    expect(result.success).toBe(true);
    expect(result.data).toBe(20);
    expect(result.logs).toHaveLength(2);
  });

  it('should stop on validation failure', async () => {
    const pipeline = new DataPipeline<number>()
      .pipe({ name: 'check', transform: n => n, validate: n => n > 100 ? 'too big' : null });

    const result = await pipeline.process(200);
    expect(result.success).toBe(false);
    expect(result.step).toBe('check');
  });

  it('should use hooks', async () => {
    const before = vi.fn().mockImplementation(n => n + 1);
    const onError = vi.fn();
    const pipeline = new DataPipeline<number>()
      .pipe({ name: 'fail', transform: () => { throw new Error('crash'); } })
      .hook({ before, onError });

    await pipeline.process(1);
    expect(before).toHaveBeenCalledWith(1);
    expect(onError).toHaveBeenCalled();
  });

  it('should chain with fluent API', async () => {
    const pipeline = new DataPipeline<string>()
      .pipe({ name: 'trim', transform: s => s.trim() })
      .pipe({ name: 'upper', transform: s => s.toUpperCase() });

    const result = await pipeline.process('  hello  ');
    expect(result.data).toBe('HELLO');
  });
});

import { describe, it, expect } from 'vitest';
import { ConfigValidator, strategyConfigSchema } from '../electron/workers/config-validator';

describe('ConfigValidator', () => {
  const v = new ConfigValidator(strategyConfigSchema);

  it('should pass valid config', () => {
    const errors = v.validate({ name: 'MA', maxPosition: 0.5 });
    expect(errors).toHaveLength(0);
  });

  it('should detect missing required', () => {
    const errors = v.validate({ maxPosition: 0.3 });
    expect(errors.some(e => e.path === 'name')).toBe(true);
  });

  it('should detect type mismatch', () => {
    const errors = v.validate({ name: 'test', maxPosition: 'big' });
    expect(errors.some(e => e.path === 'maxPosition')).toBe(true);
  });

  it('should detect range violation', () => {
    const errors = v.validate({ name: 'test', maxPosition: 2.5 });
    expect(errors.some(e => e.path === 'maxPosition')).toBe(true);
  });

  it('should fill defaults', () => {
    const { filled } = v.validateAndFill({ name: 'SMA', maxPosition: 0.2 });
    expect(filled.stopLoss).toBe(0.05);
    expect(filled.enabled).toBe(true);
  });
});

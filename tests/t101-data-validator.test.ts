import { describe, it, expect } from 'vitest';
import { DataValidator } from '../electron/workers/data-validator';

describe('DataValidator', () => {
  it('should validate required fields', () => {
    const dv = new DataValidator();
    dv.addRule({ field: 'name', rule: 'required', message: 'Name is required' });
    const report = dv.validate([{ name: '' }, { name: 'Alice' }]);
    expect(report.valid).toBe(false);
    expect(report.errorCount).toBe(1);
    expect(report.errors[0].row).toBe(0);
  });

  it('should validate range', () => {
    const dv = new DataValidator();
    dv.addRule({ field: 'price', rule: 'range', params: [0, 1000], message: 'Price 0-1000' });
    const report = dv.validate([{ price: 1500 }, { price: 500 }]);
    expect(report.errorCount).toBe(1);
  });

  it('should detect mixed types', () => {
    const dv = new DataValidator();
    dv.addRule({ field: 'qty', rule: 'type', params: 'number', message: 'Must be number' });
    const report = dv.validate([{ qty: 100 }, { qty: 'abc' }]);
    expect(report.warnings.length).toBeGreaterThan(0);
  });

  it('should validate multiple rules', () => {
    const dv = new DataValidator();
    dv.addRule({ field: 'symbol', rule: 'required', message: 'Symbol required' });
    dv.addRule({ field: 'symbol', rule: 'pattern', params: '^[A-Z]+$', message: 'Must be uppercase letters' });
    const errors = dv.quickCheck({ symbol: 'aapl' });
    expect(errors.length).toBe(1);
  });
});

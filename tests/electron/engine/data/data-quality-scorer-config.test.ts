/**
 * Tests for data-quality-scorer-config — J-01 R95.1
 */
import { describe, it, expect } from 'vitest';
import {
  DEFAULT_WEIGHTS,
  DEFAULT_THRESHOLDS,
} from '../../../../electron/engine/data/data-quality-scorer-config';

describe('DEFAULT_WEIGHTS', () => {
  it('contains all dimensions', () => {
    expect(DEFAULT_WEIGHTS).toHaveProperty('completeness');
    expect(DEFAULT_WEIGHTS).toHaveProperty('accuracy');
    expect(DEFAULT_WEIGHTS).toHaveProperty('timeliness');
    expect(DEFAULT_WEIGHTS).toHaveProperty('consistency');
    expect(DEFAULT_WEIGHTS).toHaveProperty('uniqueness');
    expect(DEFAULT_WEIGHTS).toHaveProperty('validity');
  });
  it('weights sum to approximately 1', () => {
    const sum = Object.values(DEFAULT_WEIGHTS).reduce((a,b)=>a+b,0);
    expect(sum).toBeCloseTo(1, 1);
  });
  it('all weights are positive', () => {
    Object.values(DEFAULT_WEIGHTS).forEach(w => expect(w).toBeGreaterThan(0));
  });
});

describe('DEFAULT_THRESHOLDS', () => {
  it('DEFAULT_THRESHOLDS is an array with 8 elements', () => { expect(Array.isArray(DEFAULT_THRESHOLDS)).toBe(true); expect(DEFAULT_THRESHOLDS.length).toBe(8); });

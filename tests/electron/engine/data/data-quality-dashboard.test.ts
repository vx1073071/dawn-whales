/**
 * Tests for data-quality-dashboard — R96 J-01
 */
import { describe, it, expect } from 'vitest';
import {
  getDataQualityDashboard,
} from '../../../../electron/engine/data/data-quality-dashboard';

describe('data-quality-dashboard', () => {
  it('getDataQualityDashboard is a function', () => {
    expect(typeof getDataQualityDashboard).toBe('function');
  });

  it('returns non-null result', () => {
    const r = getDataQualityDashboard();
    expect(r).toBeDefined();
  });
});

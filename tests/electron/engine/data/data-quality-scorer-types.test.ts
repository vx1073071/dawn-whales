/**
 * Tests for data-quality-scorer-types — J-01 R95.1
 */
import { describe, it, expect } from 'vitest';
import {
  type QualityDimension,
  type DimensionResult,
  type QualityIssue,
  type QualityContext,
  type QualityReport,
  type QualityThreshold,
} from '../../../../electron/engine/data/data-quality-scorer-types';

describe('data-quality-scorer-types', () => {
  it('QualityDimension type is usable', () => {
    const dim: QualityDimension = {
      id: 'completeness',
      name: 'Completeness',
      weight: 0.25,
      scorer: (data, ctx) => ({ dimension: 'c', score: 0.85, weight: 0.25, details: 'ok', issues: [] }),
    };
    expect(dim.id).toBe('completeness');
    expect(dim.weight).toBe(0.25);
  });

  it('DimensionResult type is usable', () => {
    const r: DimensionResult = {
      dimension: 'accuracy',
      score: 0.9,
      weight: 0.2,
      details: 'good',
      issues: [],
    };
    expect(r.score).toBe(0.9);
  });

  it('QualityIssue type is usable', () => {
    const issue: QualityIssue = { field: 'price', severity: 'warning', message: 'missing' };
    expect(issue.severity).toBe('warning');
  });

  it('QualityContext type is usable', () => {
    const ctx: QualityContext = { symbol: '000001', market: 'SZ' };
    expect(ctx.symbol).toBe('000001');
  });

  it('QualityReport type is usable', () => {
    const report: QualityReport = { overallScore: 0.88, dimensions: [], totalIssues: 0 };
    expect(report.overallScore).toBe(0.88);
  });

  it('QualityThreshold type is usable', () => {
    const th: QualityThreshold = { good: 0.8, warning: 0.5, critical: 0.3 };
    expect(th.good).toBe(0.8);
  });
});

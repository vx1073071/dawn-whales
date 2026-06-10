/**
 * Built-in dimension scorer: Coverage.
 * @module engine/data-quality/data-quality-scorer-dim-d
 */

import type { DimensionResult, QualityContext, QualityIssue } from './data-quality-scorer-types';
import { extractTimestamp, clamp } from './data-quality-scorer-utils';

// ������������������������������������������������ Built-in Dimension Scorer ������������������������������������������������

 */
export function scoreCoverage(data: unknown[], context: QualityContext): DimensionResult {
  const issues: QualityIssue[] = [];
  const metadata: Record<string, any> = {};
  const total = data.length;

  if (total === 0) {
    return {
      dimensionId: 'coverage',
      score: 0,
      weight: 0,
      weightedScore: 0,
      issues: [
        {
          type: 'no_coverage',
          severity: 'critical',
          message: 'No data points �?0% coverage.',
          affectedRows: 0,
          percentage: 100,
          suggestion: 'Ensure the data source covers the requested time range.',
        },
      ],
      metadata: { totalRows: 0 },
    };
  }

  // Extract timestamps
  const timestamps: number[] = [];
  for (const row of data) {
    const ts = extractTimestamp(row);
    if (ts !== null) timestamps.push(ts);
  }
  timestamps.sort((a, b) => a - b);

  if (timestamps.length === 0) {
    return {
      dimensionId: 'coverage',
      score: 0,
      weight: 0,
      weightedScore: 0,
      issues: [
        {
          type: 'no_timestamps',
          severity: 'critical',
          message: 'No valid timestamps found �?cannot evaluate coverage.',
          affectedRows: total,
          percentage: 100,
          suggestion: 'Add timestamp field to enable coverage analysis.',
        },
      ],
      metadata: { totalRows: total },
    };
  }

  const dataStart = timestamps[0];
  const dataEnd = timestamps[timestamps.length - 1];

  let targetStart: number;
  let targetEnd: number;

  if (context.timeRange) {
    targetStart = new Date(context.timeRange.start).getTime();
    targetEnd = new Date(context.timeRange.end).getTime();
  } else {
    // Without explicit range, use data range (full coverage by definition)
    targetStart = dataStart;
    targetEnd = dataEnd;
  }

  const targetSpan = targetEnd - targetStart;
  const intervalMs = context.expectedInterval ? intervalToMs(context.expectedInterval) : null;

  let coverageScore = 100;

  if (targetSpan > 0 && intervalMs) {
    // Calculate expected vs actual points in the target range
    const expectedPoints = Math.floor(targetSpan / intervalMs);
    const actualInRange = timestamps.filter((ts) => ts >= targetStart && ts <= targetEnd).length;

    const coverageRatio = Math.min(1, actualInRange / Math.max(expectedPoints, 1));
    coverageScore = clamp(coverageRatio * 100, 0, 100);

    metadata.expectedPoints = expectedPoints;
    metadata.actualInRange = actualInRange;
    metadata.coverageRatio = coverageRatio;
  } else if (targetSpan > 0) {
    // Without interval, just check if data spans the full range
    const dataSpanStart = Math.max(dataStart, targetStart);
    const dataSpanEnd = Math.min(dataEnd, targetEnd);
    const coveredSpan = Math.max(0, dataSpanEnd - dataSpanStart);
    const coverageRatio = coveredSpan / targetSpan;
    coverageScore = clamp(coverageRatio * 100, 0, 100);

    metadata.coverageRatio = coverageRatio;
  }

  // Check for leading/trailing gaps
  const leadingGapMs = Math.max(0, dataStart - targetStart);
  const trailingGapMs = Math.max(0, targetEnd - dataEnd);

  if (leadingGapMs > 0 && intervalMs && leadingGapMs > intervalMs * 2) {
    issues.push({
      type: 'leading_gap',
      severity: 'warning',
      message: `Data starts ${(leadingGapMs / 3_600_000).toFixed(1)}h after requested range start.`,
      affectedRows: 0,
      percentage: parseFloat(((leadingGapMs / Math.max(targetSpan, 1)) * 100).toFixed(2)),
      suggestion: 'Backfill data to cover the beginning of the requested range.',
    });
  }

  if (trailingGapMs > 0 && intervalMs && trailingGapMs > intervalMs * 2) {
    issues.push({
      type: 'trailing_gap',
      severity: 'warning',
      message: `Data ends ${(trailingGapMs / 3_600_000).toFixed(1)}h before requested range end.`,
      affectedRows: 0,
      percentage: parseFloat(((trailingGapMs / Math.max(targetSpan, 1)) * 100).toFixed(2)),
      suggestion: 'Fetch more recent data to cover the end of the requested range.',
    });
  }

  metadata.totalRows = total;
  metadata.targetStart = targetStart;
  metadata.targetEnd = targetEnd;
  metadata.dataStart = dataStart;
  metadata.dataEnd = dataEnd;
  metadata.leadingGapMs = leadingGapMs;
  metadata.trailingGapMs = trailingGapMs;
  metadata.timestampCount = timestamps.length;

  return {
    dimensionId: 'coverage',
    score: parseFloat(coverageScore.toFixed(2)),
    weight: 0,
    weightedScore: 0,
    issues,
    metadata,
  };
}


/**
 * Built-in dimension scorers: Completeness, Accuracy, Timeliness.
 * @module engine/data-quality/data-quality-scorer-dim-a
 */

import type { DimensionResult, QualityContext, QualityIssue } from './data-quality-scorer-types';
import { intervalToMs, numField, extractTimestamp, clamp } from './data-quality-scorer-utils';

// ──────────────────── Built-in Dimension Scorers ────────────────────────────

/**
 * 1. Completeness — missing values and timestamp gaps.
 */
export function scoreCompleteness(data: unknown[], context: QualityContext): DimensionResult {
  const issues: QualityIssue[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const metadata: Record<string, any> = {};
  const total = data.length;

  if (total === 0) {
    return {
      dimensionId: 'completeness',
      score: 0,
      weight: 0,
      weightedScore: 0,
      issues: [
        {
          type: 'empty_dataset',
          severity: 'critical',
          message: 'Dataset is empty — no data points provided.',
          affectedRows: 0,
          percentage: 100,
          suggestion: 'Verify the data source is connected and returning data.',
        },
      ],
      metadata: { totalRows: 0 },
    };
  }

  // Count rows with null/missing critical fields
  const criticalFields = ['open', 'high', 'low', 'close', 'volume'];
  let missingCells = 0;
  let totalCells = 0;
  const rowsWithMissing: number[] = [];

  for (let i = 0; i < total; i++) {
    const row = data[i];
    let rowHasMissing = false;
    for (const field of criticalFields) {
      if (field in row) {
        totalCells++;
        if (row[field] === null || row[field] === undefined || row[field] === '') {
          missingCells++;
          rowHasMissing = true;
        }
      }
    }
    if (rowHasMissing) rowsWithMissing.push(i);
  }

  // Gap detection — check for timestamp gaps larger than 2x expected interval
  let gaps = 0;
  let maxGapMs = 0;
  const intervalMs = context.expectedInterval ? intervalToMs(context.expectedInterval) : null;

  if (intervalMs) {
    const timestamps: number[] = [];
    for (const row of data) {
      const ts = extractTimestamp(row);
      if (ts !== null) timestamps.push(ts);
    }
    timestamps.sort((a, b) => a - b);

    for (let i = 1; i < timestamps.length; i++) {
      const gap = timestamps[i] - timestamps[i - 1];
      if (gap > intervalMs * 2) {
        gaps++;
        if (gap > maxGapMs) maxGapMs = gap;
      }
    }

    metadata.expectedPoints = Math.floor(
      (timestamps[timestamps.length - 1] - timestamps[0]) / intervalMs,
    );
    metadata.actualPoints = timestamps.length;
    metadata.gapsDetected = gaps;
    metadata.maxGapMs = maxGapMs;
  }

  // Calculate score
  const cellCompleteness = totalCells > 0 ? ((totalCells - missingCells) / totalCells) * 100 : 100;
  let gapPenalty = 0;
  if (intervalMs && metadata.expectedPoints && metadata.expectedPoints > 0) {
    const pointRatio = Math.min(1, (metadata.actualPoints ?? total) / metadata.expectedPoints);
    gapPenalty = (1 - pointRatio) * 30; // up to 30 point penalty for missing points
  }

  const score = clamp(cellCompleteness - gapPenalty, 0, 100);

  if (missingCells > 0) {
    const pct = (missingCells / Math.max(totalCells, 1)) * 100;
    issues.push({
      type: 'missing_values',
      severity: pct > 10 ? 'critical' : pct > 3 ? 'warning' : 'info',
      message: `${missingCells} missing value(s) across ${rowsWithMissing.length} row(s).`,
      affectedRows: rowsWithMissing.length,
      percentage: parseFloat(pct.toFixed(2)),
      suggestion: 'Fill missing values using interpolation or mark as nullable.',
    });
  }

  if (gaps > 0) {
    issues.push({
      type: 'timestamp_gap',
      severity: gaps > 5 ? 'warning' : 'info',
      message: `${gaps} timestamp gap(s) detected (max: ${maxGapMs}ms).`,
      affectedRows: gaps,
      percentage: parseFloat(((gaps / Math.max(total - 1, 1)) * 100).toFixed(2)),
      suggestion: 'Investigate data source interruptions and backfill missing intervals.',
    });
  }

  metadata.totalRows = total;
  metadata.rowsWithMissing = rowsWithMissing.length;
  metadata.missingCells = missingCells;

  return {
    dimensionId: 'completeness',
    score: parseFloat(score.toFixed(2)),
    weight: 0,
    weightedScore: 0,
    issues,
    metadata,
  };
}

/**
 * 2. Accuracy — OHLC consistency and positive prices.
 */
export function scoreAccuracy(data: unknown[], _context: QualityContext): DimensionResult {
  const issues: QualityIssue[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const metadata: Record<string, any> = {};
  const total = data.length;

  if (total === 0) {
    return {
      dimensionId: 'accuracy',
      score: 100,
      weight: 0,
      weightedScore: 0,
      issues: [],
      metadata: { totalRows: 0 },
    };
  }

  let highLowViolations = 0;
  let highOpenViolations = 0;
  let highCloseViolations = 0;
  let lowOpenViolations = 0;
  let lowCloseViolations = 0;
  let negativePrices = 0;
  let zeroRange = 0;

  const violatedRows: number[] = [];

  for (let i = 0; i < total; i++) {
    const row = data[i];
    const o = numField(row, 'open');
    const h = numField(row, 'high');
    const l = numField(row, 'low');
    const c = numField(row, 'close');

    let rowViolated = false;

    if (h !== null && l !== null && h < l) {
      highLowViolations++;
      rowViolated = true;
    }
    if (h !== null && o !== null && h < o) {
      highOpenViolations++;
      rowViolated = true;
    }
    if (h !== null && c !== null && h < c) {
      highCloseViolations++;
      rowViolated = true;
    }
    if (l !== null && o !== null && l > o) {
      lowOpenViolations++;
      rowViolated = true;
    }
    if (l !== null && c !== null && l > c) {
      lowCloseViolations++;
      rowViolated = true;
    }

    for (const field of ['open', 'high', 'low', 'close']) {
      const val = numField(row, field);
      if (val !== null && val < 0) {
        negativePrices++;
        rowViolated = true;
      }
    }

    if (h !== null && l !== null && h === l && o !== null && c !== null && o === c && h === o) {
      zeroRange++;
    }

    if (rowViolated) violatedRows.push(i);
  }

  const totalViolations =
    highLowViolations + highOpenViolations + highCloseViolations + lowOpenViolations + lowCloseViolations + negativePrices;

  const accuracyRatio = total > 0 ? ((total - violatedRows.length) / total) : 1;
  const score = clamp(accuracyRatio * 100, 0, 100);

  if (highLowViolations > 0) {
    issues.push({
      type: 'ohlc_high_below_low',
      severity: highLowViolations > total * 0.05 ? 'critical' : 'warning',
      message: `High < Low in ${highLowViolations} row(s).`,
      affectedRows: highLowViolations,
      percentage: parseFloat(((highLowViolations / total) * 100).toFixed(2)),
      suggestion: 'Verify OHLC data source — High must always be >= Low.',
    });
  }

  if (highOpenViolations + highCloseViolations > 0) {
    const count = highOpenViolations + highCloseViolations;
    issues.push({
      type: 'ohlc_high_not_maximum',
      severity: count > total * 0.05 ? 'critical' : 'warning',
      message: `High is not the maximum in ${count} row(s) (Open/Close > High).`,
      affectedRows: count,
      percentage: parseFloat(((count / total) * 100).toFixed(2)),
      suggestion: 'Check if Open/Close values are swapped with High.',
    });
  }

  if (lowOpenViolations + lowCloseViolations > 0) {
    const count = lowOpenViolations + lowCloseViolations;
    issues.push({
      type: 'ohlc_low_not_minimum',
      severity: count > total * 0.05 ? 'critical' : 'warning',
      message: `Low is not the minimum in ${count} row(s) (Open/Close < Low).`,
      affectedRows: count,
      percentage: parseFloat(((count / total) * 100).toFixed(2)),
      suggestion: 'Check if Open/Close values are swapped with Low.',
    });
  }

  if (negativePrices > 0) {
    issues.push({
      type: 'negative_price',
      severity: 'critical',
      message: `Negative price values found in ${negativePrices} cell(s).`,
      affectedRows: negativePrices,
      percentage: parseFloat(((negativePrices / (total * 4)) * 100).toFixed(2)),
      suggestion: 'Prices must be non-negative. Investigate data source for encoding errors.',
    });
  }

  if (zeroRange > total * 0.1) {
    issues.push({
      type: 'zero_price_range',
      severity: 'warning',
      message: `${zeroRange} row(s) have zero price range (H=L=O=C).`,
      affectedRows: zeroRange,
      percentage: parseFloat(((zeroRange / total) * 100).toFixed(2)),
      suggestion: 'May indicate stale data or halted trading — verify with source.',
    });
  }

  metadata.totalRows = total;
  metadata.violatedRows = violatedRows.length;
  metadata.highLowViolations = highLowViolations;
  metadata.highOpenViolations = highOpenViolations;
  metadata.highCloseViolations = highCloseViolations;
  metadata.lowOpenViolations = lowOpenViolations;
  metadata.lowCloseViolations = lowCloseViolations;
  metadata.negativePrices = negativePrices;
  metadata.zeroRange = zeroRange;

  return {
    dimensionId: 'accuracy',
    score: parseFloat(score.toFixed(2)),
    weight: 0,
    weightedScore: 0,
    issues,
    metadata,
  };
}

/**
 * 3. Timeliness — data freshness and update frequency vs expected.
 */
export function scoreTimeliness(data: unknown[], context: QualityContext): DimensionResult {
  // Stub — returns a default result until full implementation is provided
  const total = data.length;
  return {
    dimensionId: 'timeliness',
    score: total > 0 ? 100 : 0,
    weight: 0,
    weightedScore: 0,
    issues: [],
    metadata: { totalRows: total },
  };
}
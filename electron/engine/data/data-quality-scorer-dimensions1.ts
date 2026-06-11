/**
 * Built-in dimension scorers part 1: Completeness, Accuracy, Timeliness, Consistency.
 * @module engine/data-quality/data-quality-scorer-dimensions1
 */

import type { DimensionResult, QualityContext, QualityIssue } from './data-quality-scorer-types';
import { intervalToMs, numField, extractTimestamp, clamp } from './data-quality-scorer-utils';
import i18n from '../../../src/i18n';

// ──────────────────────── Built-in Dimension Scorers (Part 1) ────────────────────────

export 
function scoreCompleteness(data: unknown[], context: QualityContext): DimensionResult {
  const issues: QualityIssue[] = [];
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
          message: i18n.t('DataQualityScorerDimensions1.k0'),
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

  // Gap detection 鈥?check for timestamp gaps larger than 2x expected interval
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
 * 2. Accuracy 鈥?OHLC consistency and positive prices.
 */
function scoreAccuracy(data: unknown[], _context: QualityContext): DimensionResult {
  const issues: QualityIssue[] = [];
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
      suggestion: i18n.t('DataQualityScorerDimensions1.k1'),
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
      suggestion: i18n.t('DataQualityScorerDimensions1.k2'),
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
 * 3. Timeliness 鈥?data freshness and update frequency vs expected.
 */
function scoreTimeliness(data: unknown[], context: QualityContext): DimensionResult {
  const issues: QualityIssue[] = [];
  const metadata: Record<string, any> = {};
  const total = data.length;
  const now = Date.now();

  if (total === 0) {
    return {
      dimensionId: 'timeliness',
      score: 100,
      weight: 0,
      weightedScore: 0,
      issues: [],
      metadata: { totalRows: 0 },
    };
  }

  // Extract and sort timestamps
  const timestamps: number[] = [];
  let missingTimestamps = 0;
  for (const row of data) {
    const ts = extractTimestamp(row);
    if (ts !== null) {
      timestamps.push(ts);
    } else {
      missingTimestamps++;
    }
  }
  timestamps.sort((a, b) => a - b);

  // Freshness: how recent is the latest data point?
  const latestTs = timestamps.length > 0 ? timestamps[timestamps.length - 1] : null;
  let freshnessMs: number | null = null;
  let freshnessPenalty = 0;

  if (latestTs !== null) {
    freshnessMs = now - latestTs;
    const intervalMs = context.expectedInterval ? intervalToMs(context.expectedInterval) : 60_000;

    // If data is older than 3x the expected interval, start penalizing
    if (freshnessMs > intervalMs * 3) {
      const staleness = freshnessMs / intervalMs;
      freshnessPenalty = clamp((staleness - 3) * 5, 0, 50);
    }
  }

  // Regularity: check if intervals between data points are consistent
  let intervalDeviations = 0;
  const intervals: number[] = [];
  const expectedIntervalMs = context.expectedInterval ? intervalToMs(context.expectedInterval) : null;

  for (let i = 1; i < timestamps.length; i++) {
    const gap = timestamps[i] - timestamps[i - 1];
    intervals.push(gap);
    if (expectedIntervalMs) {
      const deviation = Math.abs(gap - expectedIntervalMs) / expectedIntervalMs;
      if (deviation > 0.5) intervalDeviations++;
    }
  }

  let regularityPenalty = 0;
  if (intervals.length > 0 && expectedIntervalMs) {
    const deviationRate = intervalDeviations / intervals.length;
    regularityPenalty = clamp(deviationRate * 40, 0, 40);
  }

  const score = clamp(100 - freshnessPenalty - regularityPenalty, 0, 100);

  if (missingTimestamps > 0) {
    issues.push({
      type: 'missing_timestamps',
      severity: missingTimestamps > total * 0.1 ? 'warning' : 'info',
      message: `${missingTimestamps} row(s) missing timestamp field.`,
      affectedRows: missingTimestamps,
      percentage: parseFloat(((missingTimestamps / total) * 100).toFixed(2)),
      suggestion: 'Ensure all data points include a valid timestamp.',
    });
  }

  if (freshnessMs !== null && freshnessPenalty > 10) {
    const hours = (freshnessMs / 3_600_000).toFixed(1);
    issues.push({
      type: 'stale_data',
      severity: freshnessPenalty > 30 ? 'critical' : 'warning',
      message: `Latest data point is ${hours}h old.`,
      affectedRows: 1,
      percentage: 100,
      suggestion: 'Check data pipeline for delays or failures.',
    });
  }

  if (intervalDeviations > 0 && expectedIntervalMs) {
    issues.push({
      type: 'irregular_intervals',
      severity: intervalDeviations > intervals.length * 0.2 ? 'warning' : 'info',
      message: `${intervalDeviations} interval(s) deviate >50% from expected (${context.expectedInterval}).`,
      affectedRows: intervalDeviations,
      percentage: parseFloat(((intervalDeviations / Math.max(intervals.length, 1)) * 100).toFixed(2)),
      suggestion: 'Investigate irregular data delivery or missing intervals.',
    });
  }

  metadata.totalRows = total;
  metadata.latestTimestamp = latestTs;
  metadata.freshnessMs = freshnessMs;
  metadata.missingTimestamps = missingTimestamps;
  metadata.intervalDeviations = intervalDeviations;
  metadata.avgIntervalMs = intervals.length > 0 ? intervals.reduce((a, b) => a + b, 0) / intervals.length : null;

  return {
    dimensionId: 'timeliness',
    score: parseFloat(score.toFixed(2)),
    weight: 0,
    weightedScore: 0,
    issues,
    metadata,
  };
}

/**
 * 4. Consistency 鈥?no contradictions, stable schema across rows.
 */
function scoreConsistency(data: unknown[], _context: QualityContext): DimensionResult {
  const issues: QualityIssue[] = [];
  const metadata: Record<string, any> = {};
  const total = data.length;

  if (total === 0) {
    return {
      dimensionId: 'consistency',
      score: 100,
      weight: 0,
      weightedScore: 0,
      issues: [],
      metadata: { totalRows: 0 },
    };
  }

  // Check schema consistency 鈥?all rows should have the same keys
  const keySets = new Map<string, number>();
  for (let i = 0; i < total; i++) {
    const keys = Object.keys(data[i]).sort().join(',');
    keySets.set(keys, (keySets.get(keys) || 0) + 1);
  }

  const schemaVariants = keySets.size;
  let schemaInconsistentRows = 0;

  if (schemaVariants > 1) {
    // Find the dominant schema
    let maxCount = 0;
    let dominantKeys = '';
    for (const [keys, count] of keySets) {
      if (count > maxCount) {
        maxCount = count;
        dominantKeys = keys;
      }
    }
    schemaInconsistentRows = total - maxCount;

    issues.push({
      type: 'schema_inconsistency',
      severity: schemaInconsistentRows > total * 0.1 ? 'warning' : 'info',
      message: `${schemaVariants} different schema variants detected across ${schemaInconsistentRows} row(s).`,
      affectedRows: schemaInconsistentRows,
      percentage: parseFloat(((schemaInconsistentRows / total) * 100).toFixed(2)),
      suggestion: i18n.t('DataQualityScorerDimensions1.k3'),
    });
  }

  // Check for type consistency within fields
  const fieldTypes = new Map<string, Set<string>>();
  for (const row of data) {
    for (const [key, value] of Object.entries(row)) {
      if (!fieldTypes.has(key)) fieldTypes.set(key, new Set());
      const type = value === null ? 'null' : typeof value;
      fieldTypes.get(key)!.add(type);
    }
  }

  let mixedTypeFields = 0;
  const mixedTypeFieldNames: string[] = [];
  for (const [field, types] of fieldTypes) {
    const nonNullTypes = new Set([...types].filter((t) => t !== 'null'));
    if (nonNullTypes.size > 1) {
      mixedTypeFields++;
      mixedTypeFieldNames.push(field);
    }
  }

  if (mixedTypeFields > 0) {
    issues.push({
      type: 'mixed_field_types',
      severity: mixedTypeFields > 3 ? 'warning' : 'info',
      message: `${mixedTypeFields} field(s) have mixed types: ${mixedTypeFieldNames.slice(0, 5).join(', ')}.`,
      affectedRows: total, // affects all rows potentially
      percentage: parseFloat(((mixedTypeFields / Math.max(fieldTypes.size, 1)) * 100).toFixed(2)),
      suggestion: 'Cast fields to consistent types across all rows.',
    });
  }

  // Check for monotonically increasing timestamps (ordering consistency)
  let outOfOrder = 0;
  let prevTs: number | null = null;
  for (const row of data) {
    const ts = extractTimestamp(row);
    if (ts !== null && prevTs !== null && ts < prevTs) {
      outOfOrder++;
    }
    if (ts !== null) prevTs = ts;
  }

  if (outOfOrder > 0) {
    issues.push({
      type: 'timestamp_ordering',
      severity: outOfOrder > total * 0.05 ? 'warning' : 'info',
      message: `${outOfOrder} row(s) have timestamps out of chronological order.`,
      affectedRows: outOfOrder,
      percentage: parseFloat(((outOfOrder / total) * 100).toFixed(2)),
      suggestion: 'Sort data by timestamp to ensure chronological consistency.',
    });
  }

  const totalIssueRows = schemaInconsistentRows + outOfOrder;
  const penalty = clamp(
    (schemaInconsistentRows / total) * 40 +
      (mixedTypeFields / Math.max(fieldTypes.size, 1)) * 30 +
      (outOfOrder / total) * 30,
    0,
    100,
  );
  const score = clamp(100 - penalty, 0, 100);

  metadata.totalRows = total;
  metadata.schemaVariants = schemaVariants;
  metadata.mixedTypeFields = mixedTypeFields;
  metadata.mixedTypeFieldNames = mixedTypeFieldNames;
  metadata.outOfOrderRows = outOfOrder;
  metadata.uniqueFields = fieldTypes.size;

  return {
    dimensionId: 'consistency',
    score: parseFloat(score.toFixed(2)),
    weight: 0,
    weightedScore: 0,
    issues,
    metadata,
  };
}

/**
 * 5. Uniqueness 鈥?duplicate detection by timestamp.
 */
function scoreUniqueness(data: unknown[], _context: QualityContext): DimensionResult {

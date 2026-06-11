/**
 * Built-in dimension scorers: Timeliness, Consistency, Uniqueness.
 * @module engine/data-quality/data-quality-scorer-dim-b
 */

import type { DimensionResult, QualityContext, QualityIssue } from './data-quality-scorer-types';
import { intervalToMs, extractTimestamp, clamp } from './data-quality-scorer-utils';

// Built-in Dimension Scorers: Timeliness, Consistency, Uniqueness, Validity

export function scoreTimeliness(data: unknown[], context: QualityContext): DimensionResult {

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
 * 4. Consistency ?no contradictions, stable schema across rows.
 */
export function scoreConsistency(data: unknown[], _context: QualityContext): DimensionResult {
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

  // Check schema consistency ?all rows should have the same keys
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
      suggestion: 'Normalize data schema ?ensure all rows have the same fields.',
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
 * 5. Uniqueness ?duplicate detection by timestamp.
 */
export function scoreUniqueness(data: unknown[], _context: QualityContext): DimensionResult {
  const issues: QualityIssue[] = [];
  const metadata: Record<string, any> = {};
  const total = data.length;

  if (total === 0) {
    return {
      dimensionId: 'uniqueness',
      score: 100,
      weight: 0,
      weightedScore: 0,
      issues: [],
      metadata: { totalRows: 0 },
    };
  }

  // Detect duplicate timestamps
  const tsCounts = new Map<number, number>();
  let rowsWithoutTimestamp = 0;

  for (const row of data) {
    const ts = extractTimestamp(row);
    if (ts === null) {
      rowsWithoutTimestamp++;
      continue;
    }
    tsCounts.set(ts, (tsCounts.get(ts) || 0) + 1);
  }

  let duplicateTimestamps = 0;
  let duplicateRows = 0;
  for (const [ts, count] of tsCounts) {
    if (count > 1) {
      duplicateTimestamps++;
      duplicateRows += count - 1;
    }
  }

  // Detect fully identical rows (all fields match)
  const rowHashes = new Map<string, number>();
  for (const row of data) {
    const hash = JSON.stringify(row);
    rowHashes.set(hash, (rowHashes.get(hash) || 0) + 1);
  }

  let fullyDuplicateRows = 0;
  for (const [, count] of rowHashes) {
    if (count > 1) fullyDuplicateRows += count - 1;
  }

  const totalDuplicates = Math.max(duplicateRows, fullyDuplicateRows);
  const score = clamp(((total - totalDuplicates) / total) * 100, 0, 100);

  if (duplicateTimestamps > 0) {
    issues.push({
      type: 'duplicate_timestamps',
      severity: duplicateRows > total * 0.05 ? 'critical' : duplicateRows > 0 ? 'warning' : 'info',
      message: `${duplicateTimestamps} duplicate timestamp(s) affecting ${duplicateRows} extra row(s).`,
      affectedRows: duplicateRows,
      percentage: parseFloat(((duplicateRows / total) * 100).toFixed(2)),
      suggestion: 'Deduplicate by timestamp ?keep the latest or merge records.',
    });
  }

  if (fullyDuplicateRows > 0 && fullyDuplicateRows !== duplicateRows) {
    issues.push({
      type: 'identical_rows',
      severity: fullyDuplicateRows > total * 0.05 ? 'warning' : 'info',
      message: `${fullyDuplicateRows} fully identical duplicate row(s) detected.`,
      affectedRows: fullyDuplicateRows,
      percentage: parseFloat(((fullyDuplicateRows / total) * 100).toFixed(2)),
      suggestion: 'Remove exact duplicate rows.',
    });
  }

  if (rowsWithoutTimestamp > 0) {
    issues.push({
      type: 'missing_timestamp_for_uniqueness',
      severity: 'info',
      message: `${rowsWithoutTimestamp} row(s) missing timestamp ?cannot check uniqueness.`,
      affectedRows: rowsWithoutTimestamp,
      percentage: parseFloat(((rowsWithoutTimestamp / total) * 100).toFixed(2)),
      suggestion: 'Add timestamp field for proper uniqueness validation.',
    });
  }

  metadata.totalRows = total;
  metadata.duplicateTimestamps = duplicateTimestamps;
  metadata.duplicateRows = duplicateRows;
  metadata.fullyDuplicateRows = fullyDuplicateRows;
  metadata.rowsWithoutTimestamp = rowsWithoutTimestamp;
  metadata.uniqueTimestamps = tsCounts.size;

  return {
    dimensionId: 'uniqueness',
    score: parseFloat(score.toFixed(2)),
    weight: 0,
    weightedScore: 0,
    issues,
    metadata,
  };
}

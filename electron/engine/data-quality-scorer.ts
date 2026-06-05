/**
 * DataQualityScorer — Evaluates data quality across multiple dimensions.
 *
 * Built-in dimensions: Completeness, Accuracy, Timeliness, Consistency,
 * Uniqueness, Validity, Uniformity, Coverage.
 *
 * Grade mapping: A(90+), B(75-89), C(60-74), D(40-59), F(<40)
 *
 * @module engine/data-quality-scorer
 */

import log from 'electron-log';

// ──────────────────────────────── Interfaces ────────────────────────────────

export interface QualityDimension {
  id: string;
  name: string;
  weight: number; // 0-1, weights sum to 1
  scorer: (data: any[], context: QualityContext) => DimensionResult;
}

export interface DimensionResult {
  dimensionId: string;
  score: number; // 0-100
  weight: number;
  weightedScore: number;
  issues: QualityIssue[];
  metadata: Record<string, any>;
}

export interface QualityIssue {
  type: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  affectedRows: number;
  percentage: number;
  suggestion?: string;
}

export interface QualityContext {
  symbol: string;
  dataType: string;
  expectedInterval?: string; // '1m', '5m', '1d', etc
  timeRange?: { start: string; end: string };
}

export interface QualityReport {
  overallScore: number; // 0-100
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  dimensions: DimensionResult[];
  issues: QualityIssue[];
  summary: string;
  recommendations: string[];
  dataPoints: number;
  evaluatedAt: string;
  durationMs: number;
}

export interface QualityThreshold {
  dimension: string;
  warningBelow: number; // score below this = warning
  criticalBelow: number; // score below this = critical
}

// ──────────────────────────── Helper Utilities ──────────────────────────────

/**
 * Parse an interval string like '1m', '5m', '1h', '1d' into milliseconds.
 */
function intervalToMs(interval: string): number {
  const match = interval.match(/^(\d+)(s|m|h|d|w)$/);
  if (!match) return 60_000; // default 1 minute
  const value = parseInt(match[1], 10);
  const unit = match[2];
  switch (unit) {
    case 's':
      return value * 1000;
    case 'm':
      return value * 60_000;
    case 'h':
      return value * 3_600_000;
    case 'd':
      return value * 86_400_000;
    case 'w':
      return value * 604_800_000;
    default:
      return 60_000;
  }
}

/**
 * Safely extract a numeric field from a data row.
 */
function numField(row: any, key: string): number | null {
  const v = row?.[key];
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Safely extract a timestamp (ms) from a data row.
 * Supports fields named 'timestamp', 'time', 'date', 't'.
 */
function extractTimestamp(row: any): number | null {
  for (const key of ['timestamp', 'time', 'date', 't', 'datetime']) {
    const v = row?.[key];
    if (v === undefined || v === null) continue;
    if (typeof v === 'number' && Number.isFinite(v)) {
      // If it looks like seconds (< 1e12), convert to ms
      return v < 1e12 ? v * 1000 : v;
    }
    if (typeof v === 'string' || v instanceof Date) {
      const parsed = new Date(v as string).getTime();
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

/**
 * Clamp a number between min and max.
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Map a numeric score (0-100) to a letter grade.
 */
function scoreToGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

/**
 * Build a summary string from dimension results and grade.
 */
function buildSummary(
  grade: string,
  overallScore: number,
  dimensions: DimensionResult[],
  totalIssues: number,
): string {
  const parts: string[] = [];
  parts.push(`Data quality grade: ${grade} (${overallScore.toFixed(1)}/100).`);

  const bestDim = [...dimensions].sort((a, b) => b.score - a.score)[0];
  const worstDim = [...dimensions].sort((a, b) => a.score - b.score)[0];

  if (bestDim) {
    parts.push(`Strongest dimension: ${bestDim.dimensionId} (${bestDim.score.toFixed(1)}).`);
  }
  if (worstDim && worstDim.dimensionId !== bestDim?.dimensionId) {
    parts.push(`Weakest dimension: ${worstDim.dimensionId} (${worstDim.score.toFixed(1)}).`);
  }

  if (totalIssues === 0) {
    parts.push('No quality issues detected.');
  } else {
    const critical = dimensions.flatMap((d) => d.issues).filter((i) => i.severity === 'critical').length;
    const warnings = dimensions.flatMap((d) => d.issues).filter((i) => i.severity === 'warning').length;
    parts.push(`${totalIssues} issue(s) found: ${critical} critical, ${warnings} warning(s).`);
  }

  return parts.join(' ');
}

/**
 * Generate actionable recommendations from dimension results.
 */
function buildRecommendations(dimensions: DimensionResult[]): string[] {
  const recs: string[] = [];

  for (const dim of dimensions) {
    if (dim.score >= 90) continue; // skip healthy dimensions

    for (const issue of dim.issues) {
      if (issue.suggestion) {
        recs.push(`[${dim.dimensionId}] ${issue.suggestion}`);
      }
    }

    // Fallback if no suggestions were provided
    if (dim.issues.length > 0 && !dim.issues.some((i) => i.suggestion)) {
      if (dim.score < 40) {
        recs.push(`[${dim.dimensionId}] Critical — immediate investigation required (score: ${dim.score.toFixed(1)}).`);
      } else if (dim.score < 75) {
        recs.push(`[${dim.dimensionId}] Below acceptable — review and remediate (score: ${dim.score.toFixed(1)}).`);
      }
    }
  }

  return recs;
}

// ──────────────────────── Built-in Dimension Scorers ────────────────────────

/**
 * 1. Completeness — % of expected data points present, gap detection.
 */
function scoreCompleteness(data: any[], context: QualityContext): DimensionResult {
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
function scoreAccuracy(data: any[], _context: QualityContext): DimensionResult {
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
function scoreTimeliness(data: any[], context: QualityContext): DimensionResult {
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
 * 4. Consistency — no contradictions, stable schema across rows.
 */
function scoreConsistency(data: any[], _context: QualityContext): DimensionResult {
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

  // Check schema consistency — all rows should have the same keys
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
      suggestion: 'Normalize data schema — ensure all rows have the same fields.',
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
 * 5. Uniqueness — duplicate detection by timestamp.
 */
function scoreUniqueness(data: any[], _context: QualityContext): DimensionResult {
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
      suggestion: 'Deduplicate by timestamp — keep the latest or merge records.',
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
      message: `${rowsWithoutTimestamp} row(s) missing timestamp — cannot check uniqueness.`,
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

/**
 * 6. Validity — values within expected ranges (price, volume bounds).
 */
function scoreValidity(data: any[], context: QualityContext): DimensionResult {
  const issues: QualityIssue[] = [];
  const metadata: Record<string, any> = {};
  const total = data.length;

  if (total === 0) {
    return {
      dimensionId: 'validity',
      score: 100,
      weight: 0,
      weightedScore: 0,
      issues: [],
      metadata: { totalRows: 0 },
    };
  }

  let invalidPrices = 0;
  let extremePrices = 0;
  let negativeVolumes = 0;
  let extremeVolumes = 0;
  let invalidTimestamps = 0;
  const invalidRows: Set<number> = new Set();

  // Gather price and volume stats for outlier detection
  const prices: number[] = [];
  const volumes: number[] = [];

  for (let i = 0; i < total; i++) {
    const row = data[i];

    // Price validity
    for (const field of ['open', 'high', 'low', 'close']) {
      const val = numField(row, field);
      if (val !== null) {
        prices.push(val);
        if (val <= 0) {
          invalidPrices++;
          invalidRows.add(i);
        }
      }
    }

    // Volume validity
    const vol = numField(row, 'volume');
    if (vol !== null) {
      volumes.push(vol);
      if (vol < 0) {
        negativeVolumes++;
        invalidRows.add(i);
      }
    }

    // Timestamp validity
    const ts = extractTimestamp(row);
    if (ts !== null) {
      // Check for unreasonable timestamps (before year 2000 or far future)
      const year2000 = new Date('2000-01-01').getTime();
      const year2050 = new Date('2050-01-01').getTime();
      if (ts < year2000 || ts > year2050) {
        invalidTimestamps++;
        invalidRows.add(i);
      }

      // Check against provided time range
      if (context.timeRange) {
        const rangeStart = new Date(context.timeRange.start).getTime();
        const rangeEnd = new Date(context.timeRange.end).getTime();
        if (ts < rangeStart || ts > rangeEnd) {
          // Not counted as invalid, but noted
        }
      }
    }
  }

  // Outlier detection using IQR method on prices
  if (prices.length > 4) {
    prices.sort((a, b) => a - b);
    const q1 = prices[Math.floor(prices.length * 0.25)];
    const q3 = prices[Math.floor(prices.length * 0.75)];
    const iqr = q3 - q1;
    const lowerBound = q1 - 3 * iqr;
    const upperBound = q3 + 3 * iqr;

    for (let i = 0; i < total; i++) {
      const row = data[i];
      for (const field of ['open', 'high', 'low', 'close']) {
        const val = numField(row, field);
        if (val !== null && (val < lowerBound || val > upperBound)) {
          extremePrices++;
          invalidRows.add(i);
        }
      }
    }

    metadata.priceLowerBound = lowerBound;
    metadata.priceUpperBound = upperBound;
  }

  // Outlier detection on volumes
  if (volumes.length > 4) {
    volumes.sort((a, b) => a - b);
    const q1 = volumes[Math.floor(volumes.length * 0.25)];
    const q3 = volumes[Math.floor(volumes.length * 0.75)];
    const iqr = q3 - q1;
    const upperBound = q3 + 3 * iqr;

    for (let i = 0; i < total; i++) {
      const vol = numField(data[i], 'volume');
      if (vol !== null && vol > upperBound) {
        extremeVolumes++;
        invalidRows.add(i);
      }
    }

    metadata.volumeUpperBound = upperBound;
  }

  const totalInvalid = invalidRows.size;
  const score = clamp(((total - totalInvalid) / total) * 100, 0, 100);

  if (invalidPrices > 0) {
    issues.push({
      type: 'invalid_price',
      severity: 'critical',
      message: `${invalidPrices} price value(s) are zero or negative.`,
      affectedRows: invalidPrices,
      percentage: parseFloat(((invalidPrices / (total * 4)) * 100).toFixed(2)),
      suggestion: 'Validate price data at ingestion — prices must be positive.',
    });
  }

  if (extremePrices > 0) {
    issues.push({
      type: 'price_outlier',
      severity: extremePrices > total * 0.05 ? 'warning' : 'info',
      message: `${extremePrices} extreme price outlier(s) detected (IQR method).`,
      affectedRows: extremePrices,
      percentage: parseFloat(((extremePrices / (total * 4)) * 100).toFixed(2)),
      suggestion: 'Review extreme values — may indicate data feed errors or genuine market events.',
    });
  }

  if (negativeVolumes > 0) {
    issues.push({
      type: 'negative_volume',
      severity: 'critical',
      message: `${negativeVolumes} row(s) have negative volume.`,
      affectedRows: negativeVolumes,
      percentage: parseFloat(((negativeVolumes / total) * 100).toFixed(2)),
      suggestion: 'Volume must be non-negative. Check data source.',
    });
  }

  if (extremeVolumes > 0) {
    issues.push({
      type: 'volume_outlier',
      severity: 'info',
      message: `${extremeVolumes} extreme volume outlier(s) detected.`,
      affectedRows: extremeVolumes,
      percentage: parseFloat(((extremeVolumes / total) * 100).toFixed(2)),
      suggestion: 'Verify unusual volume spikes with the data source.',
    });
  }

  if (invalidTimestamps > 0) {
    issues.push({
      type: 'invalid_timestamp',
      severity: 'warning',
      message: `${invalidTimestamps} timestamp(s) outside reasonable range (2000-2050).`,
      affectedRows: invalidTimestamps,
      percentage: parseFloat(((invalidTimestamps / total) * 100).toFixed(2)),
      suggestion: 'Fix timestamp parsing — values should be within 2000-2050.',
    });
  }

  metadata.totalRows = total;
  metadata.invalidRows = totalInvalid;
  metadata.invalidPrices = invalidPrices;
  metadata.extremePrices = extremePrices;
  metadata.negativeVolumes = negativeVolumes;
  metadata.extremeVolumes = extremeVolumes;
  metadata.invalidTimestamps = invalidTimestamps;

  return {
    dimensionId: 'validity',
    score: parseFloat(score.toFixed(2)),
    weight: 0,
    weightedScore: 0,
    issues,
    metadata,
  };
}

/**
 * 7. Uniformity — consistent formatting, no mixed types in fields.
 */
function scoreUniformity(data: any[], _context: QualityContext): DimensionResult {
  const issues: QualityIssue[] = [];
  const metadata: Record<string, any> = {};
  const total = data.length;

  if (total === 0) {
    return {
      dimensionId: 'uniformity',
      score: 100,
      weight: 0,
      weightedScore: 0,
      issues: [],
      metadata: { totalRows: 0 },
    };
  }

  // Check type uniformity per field
  const fieldTypeInfo = new Map<string, Map<string, number>>();

  for (const row of data) {
    for (const [key, value] of Object.entries(row)) {
      if (!fieldTypeInfo.has(key)) fieldTypeInfo.set(key, new Map());
      const type = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
      const typeMap = fieldTypeInfo.get(key)!;
      typeMap.set(type, (typeMap.get(type) || 0) + 1);
    }
  }

  let nonUniformFields = 0;
  const nonUniformDetails: Array<{ field: string; types: Record<string, number> }> = [];

  for (const [field, typeMap] of fieldTypeInfo) {
    const nonNullTypes = new Map([...typeMap].filter(([t]) => t !== 'null' && t !== 'undefined'));
    if (nonNullTypes.size > 1) {
      nonUniformFields++;
      nonUniformDetails.push({
        field,
        types: Object.fromEntries(nonNullTypes),
      });
    }
  }

  // Check numeric string vs number inconsistency
  let mixedNumericStrings = 0;
  for (const [field, typeMap] of fieldTypeInfo) {
    const hasString = typeMap.get('string') || 0;
    const hasNumber = typeMap.get('number') || 0;
    if (hasString > 0 && hasNumber > 0) {
      // Check if strings look numeric
      let numericStrings = 0;
      for (const row of data) {
        const v = row[field];
        if (typeof v === 'string' && !isNaN(Number(v))) numericStrings++;
      }
      if (numericStrings > 0) {
        mixedNumericStrings++;
      }
    }
  }

  // Check date format uniformity
  let dateFormatVariants = 0;
  const datePatterns = new Set<string>();
  for (const row of data) {
    for (const [key, value] of Object.entries(row)) {
      if (typeof value === 'string') {
        if (/^\d{4}-\d{2}-\d{2}/.test(value)) datePatterns.add('ISO');
        else if (/^\d{2}\/\d{2}\/\d{4}/.test(value)) datePatterns.add('US');
        else if (/^\d{2}-\d{2}-\d{4}/.test(value)) datePatterns.add('EU');
        else if (/^\d{8}$/.test(value)) datePatterns.add('compact');
      }
    }
  }
  dateFormatVariants = datePatterns.size;

  // Calculate score
  const typeUniformityPenalty = (nonUniformFields / Math.max(fieldTypeInfo.size, 1)) * 50;
  const numericStringPenalty = (mixedNumericStrings / Math.max(fieldTypeInfo.size, 1)) * 20;
  const dateFormatPenalty = dateFormatVariants > 1 ? 10 : 0;

  const score = clamp(100 - typeUniformityPenalty - numericStringPenalty - dateFormatPenalty, 0, 100);

  if (nonUniformFields > 0) {
    issues.push({
      type: 'non_uniform_types',
      severity: nonUniformFields > 3 ? 'warning' : 'info',
      message: `${nonUniformFields} field(s) have mixed data types.`,
      affectedRows: total,
      percentage: parseFloat(((nonUniformFields / Math.max(fieldTypeInfo.size, 1)) * 100).toFixed(2)),
      suggestion: 'Standardize field types — cast all values in a field to the same type.',
    });
  }

  if (mixedNumericStrings > 0) {
    issues.push({
      type: 'mixed_numeric_format',
      severity: 'warning',
      message: `${mixedNumericStrings} field(s) mix numeric strings and numbers.`,
      affectedRows: total,
      percentage: parseFloat(((mixedNumericStrings / Math.max(fieldTypeInfo.size, 1)) * 100).toFixed(2)),
      suggestion: 'Convert all numeric fields to actual numbers (not strings).',
    });
  }

  if (dateFormatVariants > 1) {
    issues.push({
      type: 'mixed_date_formats',
      severity: 'warning',
      message: `${dateFormatVariants} date format variants detected: ${[...datePatterns].join(', ')}.`,
      affectedRows: total,
      percentage: 100,
      suggestion: 'Standardize all date fields to ISO 8601 format.',
    });
  }

  metadata.totalRows = total;
  metadata.totalFields = fieldTypeInfo.size;
  metadata.nonUniformFields = nonUniformFields;
  metadata.nonUniformDetails = nonUniformDetails;
  metadata.mixedNumericStrings = mixedNumericStrings;
  metadata.dateFormatVariants = dateFormatVariants;
  metadata.datePatterns = [...datePatterns];

  return {
    dimensionId: 'uniformity',
    score: parseFloat(score.toFixed(2)),
    weight: 0,
    weightedScore: 0,
    issues,
    metadata,
  };
}

/**
 * 8. Coverage — time range coverage (% of requested range filled).
 */
function scoreCoverage(data: any[], context: QualityContext): DimensionResult {
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
          message: 'No data points — 0% coverage.',
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
          message: 'No valid timestamps found — cannot evaluate coverage.',
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

// ───────────────────────── Default Weight Allocation ────────────────────────

const DEFAULT_WEIGHTS: Record<string, number> = {
  completeness: 0.15,
  accuracy: 0.20,
  timeliness: 0.10,
  consistency: 0.10,
  uniqueness: 0.10,
  validity: 0.15,
  uniformity: 0.05,
  coverage: 0.15,
};

// ──────────────────────────── Default Thresholds ────────────────────────────

const DEFAULT_THRESHOLDS: QualityThreshold[] = [
  { dimension: 'completeness', warningBelow: 80, criticalBelow: 50 },
  { dimension: 'accuracy', warningBelow: 85, criticalBelow: 60 },
  { dimension: 'timeliness', warningBelow: 70, criticalBelow: 40 },
  { dimension: 'consistency', warningBelow: 80, criticalBelow: 50 },
  { dimension: 'uniqueness', warningBelow: 90, criticalBelow: 70 },
  { dimension: 'validity', warningBelow: 80, criticalBelow: 50 },
  { dimension: 'uniformity', warningBelow: 75, criticalBelow: 50 },
  { dimension: 'coverage', warningBelow: 80, criticalBelow: 50 },
];

// ────────────────────── Grade History Entry (internal) ──────────────────────

interface GradeHistoryEntry {
  score: number;
  grade: string;
  evaluatedAt: string;
}

// ────────────────────────── DataQualityScorer Class ─────────────────────────

/**
 * Evaluates data quality across 8 built-in dimensions with support for
 * custom dimensions, configurable thresholds, and grade history tracking.
 *
 * @example
 * ```ts
 * const scorer = new DataQualityScorer();
 * const report = scorer.evaluate(ohlcvData, {
 *   symbol: 'BTCUSDT',
 *   dataType: 'ohlcv',
 *   expectedInterval: '1m',
 * });
 * console.log(report.overallScore, report.grade);
 * ```
 */
export class DataQualityScorer {
  private dimensions: Map<string, QualityDimension>;
  private thresholds: QualityThreshold[];
  private lastReport: QualityReport | null;
  private gradeHistory: GradeHistoryEntry[];

  constructor() {
    this.dimensions = new Map();
    this.thresholds = [...DEFAULT_THRESHOLDS];
    this.lastReport = null;
    this.gradeHistory = [];

    // Register built-in dimensions
    this.registerBuiltinDimensions();
  }

  // ─────────────── Built-in Dimension Registration ────────────────

  private registerBuiltinDimensions(): void {
    const builtins: Array<{ id: string; name: string; scorerFn: (data: any[], ctx: QualityContext) => DimensionResult }> = [
      { id: 'completeness', name: 'Completeness', scorerFn: scoreCompleteness },
      { id: 'accuracy', name: 'Accuracy', scorerFn: scoreAccuracy },
      { id: 'timeliness', name: 'Timeliness', scorerFn: scoreTimeliness },
      { id: 'consistency', name: 'Consistency', scorerFn: scoreConsistency },
      { id: 'uniqueness', name: 'Uniqueness', scorerFn: scoreUniqueness },
      { id: 'validity', name: 'Validity', scorerFn: scoreValidity },
      { id: 'uniformity', name: 'Uniformity', scorerFn: scoreUniformity },
      { id: 'coverage', name: 'Coverage', scorerFn: scoreCoverage },
    ];

    for (const b of builtins) {
      this.dimensions.set(b.id, {
        id: b.id,
        name: b.name,
        weight: DEFAULT_WEIGHTS[b.id] ?? 0.1,
        scorer: b.scorerFn,
      });
    }
  }

  // ────────────────────── Public API Methods ──────────────────────

  /**
   * Evaluate data quality across all registered dimensions.
   *
   * @param data - Array of data rows to evaluate.
   * @param context - Context describing the data (symbol, type, interval, range).
   * @returns A comprehensive QualityReport.
   */
  evaluate(data: any[], context: QualityContext): QualityReport {
    const startTime = Date.now();

    log.info(
      `[DataQualityScorer] Evaluating ${data.length} data points for ${context.symbol} (${context.dataType})`,
    );

    // Normalize weights so they sum to 1
    this.normalizeWeights();

    // Run each dimension scorer
    const dimensionResults: DimensionResult[] = [];
    for (const [id, dim] of this.dimensions) {
      try {
        const result = dim.scorer(data, context);
        result.weight = dim.weight;
        result.weightedScore = parseFloat((result.score * dim.weight).toFixed(4));
        dimensionResults.push(result);
      } catch (err) {
        log.error(`[DataQualityScorer] Dimension "${id}" scorer failed:`, err);
        dimensionResults.push({
          dimensionId: id,
          score: 0,
          weight: dim.weight,
          weightedScore: 0,
          issues: [
            {
              type: 'scorer_error',
              severity: 'critical',
              message: `Dimension scorer failed: ${(err as Error).message}`,
              affectedRows: data.length,
              percentage: 100,
              suggestion: `Check dimension "${id}" implementation.`,
            },
          ],
          metadata: { error: (err as Error).message },
        });
      }
    }

    // Calculate overall score
    const overallScore = parseFloat(
      dimensionResults.reduce((sum, d) => sum + d.weightedScore, 0).toFixed(2),
    );
    const grade = scoreToGrade(overallScore);

    // Collect all issues
    const allIssues = dimensionResults.flatMap((d) => d.issues);

    // Apply threshold-based severity escalation
    this.applyThresholds(dimensionResults, allIssues);

    // Build summary and recommendations
    const summary = buildSummary(grade, overallScore, dimensionResults, allIssues.length);
    const recommendations = buildRecommendations(dimensionResults);

    const durationMs = Date.now() - startTime;

    const report: QualityReport = {
      overallScore,
      grade,
      dimensions: dimensionResults,
      issues: allIssues,
      summary,
      recommendations,
      dataPoints: data.length,
      evaluatedAt: new Date().toISOString(),
      durationMs,
    };

    // Store last report and grade history
    this.lastReport = report;
    this.gradeHistory.push({
      score: overallScore,
      grade,
      evaluatedAt: report.evaluatedAt,
    });

    log.info(
      `[DataQualityScorer] Evaluation complete: ${grade} (${overallScore.toFixed(1)}/100) ` +
        `in ${durationMs}ms — ${allIssues.length} issue(s) found`,
    );

    return report;
  }

  /**
   * Add a custom quality dimension.
   * If a dimension with the same ID already exists, it will be replaced.
   *
   * @param dim - The QualityDimension to add.
   */
  addDimension(dim: QualityDimension): void {
    if (!dim.id || !dim.name || typeof dim.weight !== 'number' || typeof dim.scorer !== 'function') {
      throw new Error('Invalid QualityDimension: must have id, name, weight (number), and scorer (function).');
    }
    if (dim.weight < 0 || dim.weight > 1) {
      throw new Error(`Invalid weight for dimension "${dim.id}": must be between 0 and 1.`);
    }

    log.info(`[DataQualityScorer] Adding custom dimension: ${dim.id} (${dim.name}, weight: ${dim.weight})`);
    this.dimensions.set(dim.id, dim);
  }

  /**
   * Remove a dimension by ID.
   *
   * @param id - The dimension ID to remove.
   * @returns true if the dimension was removed, false if not found.
   */
  removeDimension(id: string): boolean {
    if (this.dimensions.has(id)) {
      this.dimensions.delete(id);
      log.info(`[DataQualityScorer] Removed dimension: ${id}`);
      return true;
    }
    log.warn(`[DataQualityScorer] Dimension not found for removal: ${id}`);
    return false;
  }

  /**
   * Set custom quality thresholds.
   * Replaces all existing thresholds.
   *
   * @param thresholds - Array of QualityThreshold configurations.
   */
  setThresholds(thresholds: QualityThreshold[]): void {
    this.thresholds = thresholds.map((t) => ({
      dimension: t.dimension,
      warningBelow: clamp(t.warningBelow, 0, 100),
      criticalBelow: clamp(t.criticalBelow, 0, 100),
    }));
    log.info(`[DataQualityScorer] Updated thresholds for ${thresholds.length} dimension(s)`);
  }

  /**
   * Get the last evaluation report.
   *
   * @returns The last QualityReport, or null if no evaluation has been run.
   */
  getReport(): QualityReport | null {
    return this.lastReport;
  }

  /**
   * Compare two reports and identify improved, degraded, and unchanged dimensions.
   *
   * @param r1 - The earlier report (baseline).
   * @param r2 - The later report (current).
   * @returns Object with arrays of dimension IDs that improved, degraded, or remained unchanged.
   */
  compareReports(
    r1: QualityReport,
    r2: QualityReport,
  ): { improved: string[]; degraded: string[]; unchanged: string[] } {
    const improved: string[] = [];
    const degraded: string[] = [];
    const unchanged: string[] = [];

    const SCORE_TOLERANCE = 0.5; // within 0.5 points = unchanged

    const r1Map = new Map(r1.dimensions.map((d) => [d.dimensionId, d.score]));

    for (const d2 of r2.dimensions) {
      const prevScore = r1Map.get(d2.dimensionId);
      if (prevScore === undefined) {
        // New dimension in r2, consider as improved if score is good
        improved.push(d2.dimensionId);
        continue;
      }

      const diff = d2.score - prevScore;
      if (diff > SCORE_TOLERANCE) {
        improved.push(d2.dimensionId);
      } else if (diff < -SCORE_TOLERANCE) {
        degraded.push(d2.dimensionId);
      } else {
        unchanged.push(d2.dimensionId);
      }
    }

    // Dimensions in r1 but not in r2
    for (const d1 of r1.dimensions) {
      if (!r2.dimensions.find((d) => d.dimensionId === d1.dimensionId)) {
        unchanged.push(d1.dimensionId); // removed dimension, not classified
      }
    }

    log.info(
      `[DataQualityScorer] Report comparison: ` +
        `${improved.length} improved, ${degraded.length} degraded, ${unchanged.length} unchanged`,
    );

    return { improved, degraded, unchanged };
  }

  /**
   * Get the grade history from past evaluations.
   *
   * @param limit - Maximum number of entries to return (most recent first). Defaults to all.
   * @returns Array of grade history entries.
   */
  getGradeHistory(limit?: number): GradeHistoryEntry[] {
    const entries = [...this.gradeHistory].reverse();
    return limit && limit > 0 ? entries.slice(0, limit) : entries;
  }

  // ────────────────────── Private Helper Methods ──────────────────

  /**
   * Normalize dimension weights so they sum to 1.
   */
  private normalizeWeights(): void {
    let totalWeight = 0;
    for (const dim of this.dimensions.values()) {
      totalWeight += dim.weight;
    }

    if (totalWeight <= 0) {
      // Equal weights as fallback
      const equalWeight = 1 / this.dimensions.size;
      for (const dim of this.dimensions.values()) {
        dim.weight = equalWeight;
      }
      return;
    }

    if (Math.abs(totalWeight - 1) > 0.001) {
      for (const dim of this.dimensions.values()) {
        dim.weight = dim.weight / totalWeight;
      }
    }
  }

  /**
   * Apply configured thresholds to escalate issue severities.
   */
  private applyThresholds(dimensions: DimensionResult[], issues: QualityIssue[]): void {
    const thresholdMap = new Map(this.thresholds.map((t) => [t.dimension, t]));

    for (const dim of dimensions) {
      const threshold = thresholdMap.get(dim.dimensionId);
      if (!threshold) continue;

      if (dim.score < threshold.criticalBelow) {
        // Add a critical summary issue for this dimension
        issues.push({
          type: 'threshold_critical',
          severity: 'critical',
          message: `Dimension "${dim.dimensionId}" score (${dim.score.toFixed(1)}) is below critical threshold (${threshold.criticalBelow}).`,
          affectedRows: dim.metadata?.totalRows ?? 0,
          percentage: 100,
          suggestion: `Immediate action required for ${dim.dimensionId}.`,
        });
      } else if (dim.score < threshold.warningBelow) {
        issues.push({
          type: 'threshold_warning',
          severity: 'warning',
          message: `Dimension "${dim.dimensionId}" score (${dim.score.toFixed(1)}) is below warning threshold (${threshold.warningBelow}).`,
          affectedRows: dim.metadata?.totalRows ?? 0,
          percentage: 100,
          suggestion: `Review and improve ${dim.dimensionId} quality.`,
        });
      }
    }
  }
}

// ──────────────────────────── Default Export ────────────────────────────────

export default DataQualityScorer;

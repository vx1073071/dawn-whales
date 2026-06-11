/**
 * Built-in dimension scorers: Validity, Uniformity.
 * @module engine/data-quality/data-quality-scorer-dim-c
 */

import type { DimensionResult, QualityContext, QualityIssue } from './data-quality-scorer-types';
import { numField, clamp, extractTimestamp } from './data-quality-scorer-utils';

// Built-in Dimension Scorers: Validity, Uniformity
export function scoreValidity(data: unknown[], context: QualityContext): DimensionResult {
  const issues: QualityIssue[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      suggestion: 'Validate price data at ingestion ?prices must be positive.',
    });
  }

  if (extremePrices > 0) {
    issues.push({
      type: 'price_outlier',
      severity: extremePrices > total * 0.05 ? 'warning' : 'info',
      message: `${extremePrices} extreme price outlier(s) detected (IQR method).`,
      affectedRows: extremePrices,
      percentage: parseFloat(((extremePrices / (total * 4)) * 100).toFixed(2)),
      suggestion: 'Review extreme values ?may indicate data feed errors or genuine market events.',
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
      suggestion: 'Fix timestamp parsing ?values should be within 2000-2050.',
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
 * 7. Uniformity ?consistent formatting, no mixed types in fields.
 */
export function scoreUniformity(data: unknown[], _context: QualityContext): DimensionResult {
  const issues: QualityIssue[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      suggestion: 'Standardize field types ?cast all values in a field to the same type.',
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


/**
 * DataQualityScorer utility functions.
 * @module engine/data-quality/data-quality-scorer-utils
 */

import type { DimensionResult, QualityContext } from './data-quality-scorer-types';

// ──────────────────────────── Helper Utilities ─────────────────────────────

/**
 * Parse an interval string like '1m', '5m', '1h', '1d' into milliseconds.
 */
export function intervalToMs(interval: string): number {
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
export function numField(row: unknown, key: string): number | null {
  const v = row?.[key];
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Safely extract a timestamp (ms) from a data row.
 * Supports fields named 'timestamp', 'time', 'date', 't'.
 */
export function extractTimestamp(row: unknown): number | null {
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
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Map a numeric score (0-100) to a letter grade.
 */
export function scoreToGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

/**
 * Build a summary string from dimension results and grade.
 */
export function buildSummary(
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
export function buildRecommendations(dimensions: DimensionResult[]): string[] {
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

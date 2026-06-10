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

import type {
  QualityDimension,
  DimensionResult,
  QualityIssue,
  QualityContext,
  QualityReport,
  QualityThreshold,
} from './data-quality/data-quality-scorer-types';
import {
  scoreToGrade,
  buildSummary,
  buildRecommendations,
  clamp,
} from './data-quality/data-quality-scorer-utils';
import { scoreCompleteness, scoreAccuracy } from './data-quality/data-quality-scorer-dim-a';
import { scoreTimeliness, scoreConsistency, scoreUniqueness } from './data-quality/data-quality-scorer-dim-b';
import { scoreValidity, scoreUniformity } from './data-quality/data-quality-scorer-dim-c';
import { scoreCoverage } from './data-quality/data-quality-scorer-dim-d';
import { DEFAULT_WEIGHTS, DEFAULT_THRESHOLDS } from './data-quality/data-quality-scorer-config';
import type { GradeHistoryEntry } from './data-quality/data-quality-scorer-config';
import { EngineError, ErrorCode } from '../errors';


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
 * log.info(report.overallScore, report.grade);
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
    const builtins: Array<{ id: string; name: string; scorerFn: (data: unknown[], ctx: QualityContext) => DimensionResult }> = [
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
  evaluate(data: unknown[], context: QualityContext): QualityReport {
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
      throw new EngineError(ErrorCode.DATA_SOURCE_ERROR, 'Invalid QualityDimension: must have id, name, weight (number), and scorer (function).');
    }
    if (dim.weight < 0 || dim.weight > 1) {
      throw new EngineError(ErrorCode.DATA_SOURCE_ERROR, `Invalid weight for dimension "${dim.id}": must be between 0 and 1.`);
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

// ──────────────────────── Re-exports ────────────────────────────────────────

export type {
  QualityDimension,
  DimensionResult,
  QualityIssue,
  QualityContext,
  QualityReport,
  QualityThreshold,
} from './data-quality/data-quality-scorer-types';

export type { GradeHistoryEntry } from './data-quality/data-quality-scorer-config';

export { scoreCompleteness, scoreAccuracy } from './data-quality/data-quality-scorer-dim-a';
export { scoreTimeliness, scoreConsistency, scoreUniqueness } from './data-quality/data-quality-scorer-dim-b';
export { scoreValidity, scoreUniformity } from './data-quality/data-quality-scorer-dim-c';
export { scoreCoverage } from './data-quality/data-quality-scorer-dim-d';
export { DEFAULT_WEIGHTS, DEFAULT_THRESHOLDS } from './data-quality/data-quality-scorer-config';

// ──────────────────────────── Default Export ────────────────────────────────

export default DataQualityScorer;

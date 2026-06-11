/**
 * DataQualityScorer types — shared interfaces for data quality evaluation.
 * @module engine/data-quality/data-quality-scorer-types
 */

// ──────────────────────────────── Interfaces ────────────────────────────────

export interface QualityDimension {
  id: string;
  name: string;
  weight: number; // 0-1, weights sum to 1
  scorer: (data: unknown[], context: QualityContext) => DimensionResult;
}

export interface DimensionResult {
  dimensionId: string;
  score: number; // 0-100
  weight: number;
  weightedScore: number;
  issues: QualityIssue[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

/**
 * Default weights, thresholds, and configuration for DataQualityScorer.
 * @module engine/data-quality/data-quality-scorer-config
 */

import type { QualityThreshold } from './data-quality-scorer-types';

// ───────────────────────── Default Weight Allocation ────────────────────────

export const DEFAULT_WEIGHTS: Record<string, number> = {
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

export const DEFAULT_THRESHOLDS: QualityThreshold[] = [
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

export interface GradeHistoryEntry {
  score: number;
  grade: string;
  evaluatedAt: string;
}

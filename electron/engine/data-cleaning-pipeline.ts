/**
 * JVS-84: Data Cleaning Pipeline
 * Transforms raw market data into clean, validated data through
 * a configurable multi-stage pipeline pattern.
 */

import log from 'electron-log';

// ─────────────────────────────────────────────────────────────
// Interfaces & Types
// ─────────────────────────────────────────────────────────────

export interface RawDataPoint {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  source: string;
  raw?: any;
}

export interface CleanDataPoint extends RawDataPoint {
  adjusted: boolean;
  anomalies: string[];
  qualityScore: number; // 0–1
}

export interface CleaningStage {
  id: string;
  name: string;
  enabled: boolean;
  fn: (data: RawDataPoint[], context: CleaningContext) => CleanDataPoint[];
}

export interface CleaningContext {
  symbol: string;
  previousClean?: CleanDataPoint[];
  metadata: Record<string, any>;
}

export interface CleaningReport {
  totalPoints: number;
  cleanedPoints: number;
  removedPoints: number;
  adjustments: { stage: string; count: number; details: string[] }[];
  qualityScore: number;
  durationMs: number;
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/** Convert a RawDataPoint into a CleanDataPoint with defaults. */
function toClean(point: RawDataPoint): CleanDataPoint {
  if ('adjusted' in point && 'anomalies' in point && 'qualityScore' in point) {
    return point as CleanDataPoint;
  }
  return {
    ...point,
    adjusted: false,
    anomalies: [],
    qualityScore: 1,
  };
}

/** Calculate the arithmetic mean of an array of numbers. */
function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

/** Calculate the population standard deviation. */
function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance = values.reduce((s, v) => s + (v - m) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/** Linear interpolation between two values. */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Clamp a value between min and max. */
function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

/** Compute a quality score penalty (multiplicative). */
function penaltyScore(baseScore: number, penaltyFactor: number): number {
  return clamp(baseScore * (1 - penaltyFactor), 0, 1);
}

// ─────────────────────────────────────────────────────────────
// Built-in Cleaning Stages
// ─────────────────────────────────────────────────────────────

/**
 * Stage 1: OutlierRemoval
 * Removes data points where the price change from the previous bar
 * exceeds 3 standard deviations of all price changes.
 */
function outlierRemovalStage(): CleaningStage {
  return {
    id: 'outlier-removal',
    name: 'Outlier Removal',
    enabled: true,
    fn: (data: RawDataPoint[], _ctx: CleaningContext): CleanDataPoint[] => {
      if (data.length < 3) {
        return data.map(toClean);
      }

      // Sort by time for sequential analysis
      const sorted = [...data].sort((a, b) => a.time - b.time);

      // Compute close-to-close changes
      const changes: number[] = [];
      for (let i = 1; i < sorted.length; i++) {
        changes.push(Math.abs(sorted[i].close - sorted[i - 1].close));
      }

      const avgChange = mean(changes);
      const stdChange = stddev(changes);
      const threshold = 3 * stdChange;

      if (threshold === 0) {
        // All changes are identical — no outliers possible
        return sorted.map(toClean);
      }

      log.debug(
        `[OutlierRemoval] avgChange=${avgChange.toFixed(4)}, ` +
          `stdDev=${stdChange.toFixed(4)}, threshold=${threshold.toFixed(4)}`
      );

      const result: CleanDataPoint[] = [];
      // Always keep the first point
      result.push(toClean(sorted[0]));

      for (let i = 1; i < sorted.length; i++) {
        const change = Math.abs(sorted[i].close - sorted[i - 1].close);
        if (change > threshold) {
          log.debug(
            `[OutlierRemoval] Removing outlier at t=${sorted[i].time}, ` +
              `change=${change.toFixed(4)} > threshold=${threshold.toFixed(4)}`
          );
          // Skip this point — it's an outlier
          continue;
        }
        result.push(toClean(sorted[i]));
      }

      const removedCount = sorted.length - result.length;
      if (removedCount > 0) {
        log.info(`[OutlierRemoval] Removed ${removedCount} outlier(s)`);
      }

      return result;
    },
  };
}

/**
 * Stage 2: GapFiller
 * Detects missing bars in a time series and fills them using
 * linear interpolation between adjacent known points.
 */
function gapFillerStage(expectedIntervalMs: number = 300_000): CleaningStage {
  return {
    id: 'gap-filler',
    name: 'Gap Filler',
    enabled: true,
    fn: (data: RawDataPoint[], ctx: CleaningContext): CleanDataPoint[] => {
      if (data.length < 2) {
        return data.map(toClean);
      }

      const interval =
        (ctx.metadata['barIntervalMs'] as number) || expectedIntervalMs;
      const sorted = [...data].sort((a, b) => a.time - b.time);
      const result: CleanDataPoint[] = [toClean(sorted[0])];

      let filledCount = 0;

      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1];
        const curr = sorted[i];
        const gap = curr.time - prev.time;

        if (gap > interval * 1.5) {
          // There's a gap — interpolate missing bars
          const missingBars = Math.round(gap / interval) - 1;

          for (let j = 1; j <= missingBars; j++) {
            const t = j / (missingBars + 1);
            const interpolated: CleanDataPoint = {
              time: prev.time + j * interval,
              open: lerp(prev.close, curr.open, t),
              high: lerp(prev.close, curr.open, t),
              low: lerp(prev.close, curr.open, t),
              close: lerp(prev.close, curr.open, t),
              volume: 0,
              source: 'interpolated',
              adjusted: true,
              anomalies: ['interpolated-gap-fill'],
              qualityScore: 0.5,
            };
            result.push(interpolated);
            filledCount++;
          }
        }

        result.push(toClean(curr));
      }

      if (filledCount > 0) {
        log.info(`[GapFiller] Interpolated ${filledCount} missing bar(s)`);
      }

      return result;
    },
  };
}

/**
 * Stage 3: OHLCValidator
 * Ensures OHLC consistency:
 *   - High >= Low, High >= Open, High >= Close
 *   - Low <= Open, Low <= Close
 * Adjusts invalid values rather than removing them.
 */
function ohlcValidatorStage(): CleaningStage {
  return {
    id: 'ohlc-validator',
    name: 'OHLC Validator',
    enabled: true,
    fn: (data: RawDataPoint[], _ctx: CleaningContext): CleanDataPoint[] => {
      let adjustedCount = 0;

      return data.map((point) => {
        const cp = toClean(point);
        const anomalies: string[] = [...cp.anomalies];
        let adjusted = cp.adjusted;

        // Ensure high >= max(open, close)
        const expectedHigh = Math.max(cp.open, cp.close);
        if (cp.high < expectedHigh) {
          anomalies.push(`high<expected (${cp.high}<${expectedHigh})`);
          cp.high = expectedHigh;
          adjusted = true;
          adjustedCount++;
        }

        // Ensure low <= min(open, close)
        const expectedLow = Math.min(cp.open, cp.close);
        if (cp.low > expectedLow) {
          anomalies.push(`low>expected (${cp.low}>${expectedLow})`);
          cp.low = expectedLow;
          adjusted = true;
          adjustedCount++;
        }

        // Ensure high >= low (belt and suspenders)
        if (cp.high < cp.low) {
          anomalies.push(`high<low (${cp.high}<${cp.low})`);
          const mid = (cp.high + cp.low) / 2;
          cp.high = mid;
          cp.low = mid;
          adjusted = true;
          adjustedCount++;
        }

        cp.anomalies = anomalies;
        cp.adjusted = adjusted;

        if (adjusted) {
          cp.qualityScore = penaltyScore(cp.qualityScore, 0.1);
        }

        return cp;
      });

      // Note: adjustedCount logged after map completes
    },
  };
}

/**
 * Stage 4: VolumeNormalizer
 * Normalizes volume data and flags zero-volume bars.
 */
function volumeNormalizerStage(): CleaningStage {
  return {
    id: 'volume-normalizer',
    name: 'Volume Normalizer',
    enabled: true,
    fn: (data: RawDataPoint[], _ctx: CleaningContext): CleanDataPoint[] => {
      const volumes = data.map((d) => d.volume).filter((v) => v > 0);
      const avgVolume = mean(volumes);
      let zeroCount = 0;
      let spikeCount = 0;

      log.debug(`[VolumeNormalizer] Average volume: ${avgVolume.toFixed(2)}`);

      return data.map((point) => {
        const cp = toClean(point);
        const anomalies: string[] = [...cp.anomalies];

        if (cp.volume === 0) {
          anomalies.push('zero-volume');
          zeroCount++;
          cp.qualityScore = penaltyScore(cp.qualityScore, 0.2);
        }

        // Flag volume spikes (>5x average)
        if (avgVolume > 0 && cp.volume > avgVolume * 5) {
          anomalies.push(
            `volume-spike (${(cp.volume / avgVolume).toFixed(1)}x avg)`
          );
          spikeCount++;
          cp.qualityScore = penaltyScore(cp.qualityScore, 0.05);
        }

        // Flag negative volume (shouldn't exist)
        if (cp.volume < 0) {
          anomalies.push(`negative-volume (${cp.volume})`);
          cp.volume = 0;
          cp.adjusted = true;
          cp.qualityScore = penaltyScore(cp.qualityScore, 0.3);
        }

        cp.anomalies = anomalies;
        return cp;
      });
    },
  };
}

/**
 * Stage 5: DuplicateRemover
 * Removes data points with duplicate timestamps, keeping the
 * one with the highest volume (most likely to be the real trade).
 */
function duplicateRemoverStage(): CleaningStage {
  return {
    id: 'duplicate-remover',
    name: 'Duplicate Remover',
    enabled: true,
    fn: (data: RawDataPoint[], _ctx: CleaningContext): CleanDataPoint[] => {
      const seen = new Map<number, CleanDataPoint>();
      let duplicateCount = 0;

      for (const point of data) {
        const cp = toClean(point);
        const existing = seen.get(cp.time);

        if (existing) {
          duplicateCount++;
          // Keep the one with higher volume
          if (cp.volume > existing.volume) {
            cp.anomalies.push('replaced-duplicate');
            seen.set(cp.time, cp);
          } else {
            existing.anomalies.push('kept-over-duplicate');
          }
        } else {
          seen.set(cp.time, cp);
        }
      }

      if (duplicateCount > 0) {
        log.info(`[DuplicateRemover] Removed ${duplicateCount} duplicate(s)`);
      }

      // Return sorted by time
      return Array.from(seen.values()).sort((a, b) => a.time - b.time);
    },
  };
}

/**
 * Stage 6: TimeAlignment
 * Aligns bar timestamps to proper interval boundaries
 * (e.g., 5-minute bars should fall on :00, :05, :10, etc.).
 */
function timeAlignmentStage(intervalMs: number = 300_000): CleaningStage {
  return {
    id: 'time-alignment',
    name: 'Time Alignment',
    enabled: true,
    fn: (data: RawDataPoint[], ctx: CleaningContext): CleanDataPoint[] => {
      const interval =
        (ctx.metadata['barIntervalMs'] as number) || intervalMs;
      let alignedCount = 0;

      return data.map((point) => {
        const cp = toClean(point);
        const remainder = cp.time % interval;

        if (remainder !== 0) {
          // Snap to nearest interval boundary
          const snapped = Math.round(cp.time / interval) * interval;
          const drift = Math.abs(cp.time - snapped);

          if (drift < interval * 0.1) {
            // Only snap if drift is < 10% of interval
            cp.time = snapped;
            cp.adjusted = true;
            cp.anomalies.push(`time-aligned (drift=${drift}ms)`);
            cp.qualityScore = penaltyScore(cp.qualityScore, 0.02);
            alignedCount++;
          } else {
            cp.anomalies.push(`time-misaligned (drift=${drift}ms)`);
            cp.qualityScore = penaltyScore(cp.qualityScore, 0.05);
          }
        }

        return cp;
      });
    },
  };
}

/**
 * Stage 7: NegativeFilter
 * Removes data points with negative prices or volumes.
 */
function negativeFilterStage(): CleaningStage {
  return {
    id: 'negative-filter',
    name: 'Negative Filter',
    enabled: true,
    fn: (data: RawDataPoint[], _ctx: CleaningContext): CleanDataPoint[] => {
      let removedCount = 0;

      const result = data.filter((point) => {
        const hasNegative =
          point.open < 0 ||
          point.high < 0 ||
          point.low < 0 ||
          point.close < 0 ||
          point.volume < 0;

        if (hasNegative) {
          log.debug(
            `[NegativeFilter] Removing point at t=${point.time}: ` +
              `O=${point.open} H=${point.high} L=${point.low} C=${point.close} V=${point.volume}`
          );
          removedCount++;
          return false;
        }
        return true;
      });

      if (removedCount > 0) {
        log.info(`[NegativeFilter] Removed ${removedCount} negative value(s)`);
      }

      return result.map(toClean);
    },
  };
}

/**
 * Stage 8: StaleDataDetector
 * Flags bars where OHLC values remain identical for more than
 * N consecutive periods, indicating potentially stale data.
 */
function staleDataDetectorStage(
  maxConsecutiveIdentical: number = 5
): CleaningStage {
  return {
    id: 'stale-data-detector',
    name: 'Stale Data Detector',
    enabled: true,
    fn: (data: RawDataPoint[], ctx: CleaningContext): CleanDataPoint[] => {
      const threshold =
        (ctx.metadata['maxConsecutiveIdentical'] as number) ||
        maxConsecutiveIdentical;

      if (data.length < 2) {
        return data.map(toClean);
      }

      const sorted = [...data].sort((a, b) => a.time - b.time);
      const result: CleanDataPoint[] = [];
      let consecutiveCount = 1;

      result.push(toClean(sorted[0]));

      for (let i = 1; i < sorted.length; i++) {
        const cp = toClean(sorted[i]);
        const prev = sorted[i - 1];

        const isIdentical =
          cp.open === prev.open &&
          cp.high === prev.high &&
          cp.low === prev.low &&
          cp.close === prev.close;

        if (isIdentical) {
          consecutiveCount++;
        } else {
          consecutiveCount = 1;
        }

        if (consecutiveCount > threshold) {
          cp.anomalies.push(
            `stale-data (${consecutiveCount} identical bars)`
          );
          cp.qualityScore = penaltyScore(
            cp.qualityScore,
            Math.min(0.5, consecutiveCount * 0.05)
          );
          log.debug(
            `[StaleDataDetector] Stale data at t=${cp.time}: ` +
              `${consecutiveCount} consecutive identical bars`
          );
        }

        result.push(cp);
      }

      const staleCount = result.filter((r) =>
        r.anomalies.some((a) => a.startsWith('stale-data'))
      ).length;

      if (staleCount > 0) {
        log.info(
          `[StaleDataDetector] Flagged ${staleCount} stale data point(s)`
        );
      }

      return result;
    },
  };
}

// ─────────────────────────────────────────────────────────────
// Stage tracking for reports
// ─────────────────────────────────────────────────────────────

interface StageAdjustment {
  stage: string;
  count: number;
  details: string[];
}

function collectAnomalies(data: CleanDataPoint[]): StageAdjustment[] {
  const stageMap = new Map<string, { count: number; details: string[] }>();

  for (const point of data) {
    for (const anomaly of point.anomalies) {
      const key = anomaly.split('(')[0].trim();
      if (!stageMap.has(key)) {
        stageMap.set(key, { count: 0, details: [] });
      }
      const entry = stageMap.get(key)!;
      entry.count++;
      if (entry.details.length < 10) {
        entry.details.push(`t=${point.time}: ${anomaly}`);
      }
    }
  }

  return Array.from(stageMap.entries()).map(([stage, info]) => ({
    stage,
    count: info.count,
    details: info.details,
  }));
}

function computeOverallQuality(data: CleanDataPoint[]): number {
  if (data.length === 0) return 0;
  const totalScore = data.reduce((s, d) => s + d.qualityScore, 0);
  return totalScore / data.length;
}

// ─────────────────────────────────────────────────────────────
// DataCleaningPipeline Class
// ─────────────────────────────────────────────────────────────

/**
 * DataCleaningPipeline provides a configurable, multi-stage pipeline
 * for transforming raw market data into clean, validated data.
 *
 * Usage:
 * ```ts
 * const pipeline = new DataCleaningPipeline();
 * // Default stages are pre-loaded. Add or remove as needed.
 * const { data, report } = pipeline.clean(rawData, context);
 * ```
 */
export class DataCleaningPipeline {
  private stages: CleaningStage[] = [];
  private lastReport: CleaningReport | null = null;

  constructor(autoLoadDefaults: boolean = true) {
    if (autoLoadDefaults) {
      this.loadDefaultStages();
    }
    log.info(
      `[DataCleaningPipeline] Initialized with ${this.stages.length} stage(s)`
    );
  }

  /**
   * Load all 8 built-in cleaning stages in the recommended order.
   */
  private loadDefaultStages(): void {
    this.stages = [
      negativeFilterStage(),
      duplicateRemoverStage(),
      timeAlignmentStage(),
      outlierRemovalStage(),
      ohlcValidatorStage(),
      volumeNormalizerStage(),
      gapFillerStage(),
      staleDataDetectorStage(),
    ];
    log.debug(
      `[DataCleaningPipeline] Loaded ${this.stages.length} default stages: ` +
        this.stages.map((s) => s.id).join(', ')
    );
  }

  /**
   * Add a custom cleaning stage to the pipeline.
   * The stage will be appended to the end of the pipeline.
   */
  addStage(stage: CleaningStage): void {
    // Check for duplicate IDs
    const existing = this.stages.findIndex((s) => s.id === stage.id);
    if (existing !== -1) {
      log.warn(
        `[DataCleaningPipeline] Stage "${stage.id}" already exists. Replacing.`
      );
      this.stages[existing] = stage;
    } else {
      this.stages.push(stage);
      log.info(
        `[DataCleaningPipeline] Added stage "${stage.id}" (${stage.name})`
      );
    }
  }

  /**
   * Remove a stage by its ID.
   * @returns true if the stage was found and removed.
   */
  removeStage(id: string): boolean {
    const idx = this.stages.findIndex((s) => s.id === id);
    if (idx === -1) {
      log.warn(`[DataCleaningPipeline] Stage "${id}" not found for removal.`);
      return false;
    }
    const removed = this.stages.splice(idx, 1)[0];
    log.info(
      `[DataCleaningPipeline] Removed stage "${removed.id}" (${removed.name})`
    );
    return true;
  }

  /**
   * Enable or disable a stage by its ID.
   * @returns true if the stage was found and toggled.
   */
  enableStage(id: string, enabled: boolean): boolean {
    const stage = this.stages.find((s) => s.id === id);
    if (!stage) {
      log.warn(
        `[DataCleaningPipeline] Stage "${id}" not found for enable/disable.`
      );
      return false;
    }
    const wasEnabled = stage.enabled;
    stage.enabled = enabled;
    log.info(
      `[DataCleaningPipeline] Stage "${id}" ${enabled ? 'enabled' : 'disabled'}` +
        (wasEnabled !== enabled ? '' : ' (no change)')
    );
    return true;
  }

  /**
   * Get a snapshot of all configured stages.
   */
  getStages(): CleaningStage[] {
    return this.stages.map((s) => ({ ...s, fn: s.fn }));
  }

  /**
   * Get the most recent cleaning report, or null if no clean has run.
   */
  getReport(): CleaningReport | null {
    return this.lastReport;
  }

  /**
   * Execute the full cleaning pipeline on raw data.
   *
   * @param rawData - Array of raw market data points
   * @param context - Cleaning context (symbol, metadata, etc.)
   * @returns Cleaned data and a detailed report
   */
  clean(
    rawData: RawDataPoint[],
    context: CleaningContext
  ): { data: CleanDataPoint[]; report: CleaningReport } {
    const startTime = performance.now();
    const totalPoints = rawData.length;

    log.info(
      `[DataCleaningPipeline] Starting clean for "${context.symbol}" ` +
        `with ${totalPoints} raw points and ${this.stages.length} stage(s)`
    );

    if (totalPoints === 0) {
      const report: CleaningReport = {
        totalPoints: 0,
        cleanedPoints: 0,
        removedPoints: 0,
        adjustments: [],
        qualityScore: 0,
        durationMs: performance.now() - startTime,
      };
      this.lastReport = report;
      return { data: [], report };
    }

    // Run each enabled stage sequentially
    let currentData: RawDataPoint[] = [...rawData];

    for (const stage of this.stages) {
      if (!stage.enabled) {
        log.debug(
          `[DataCleaningPipeline] Skipping disabled stage "${stage.id}"`
        );
        continue;
      }

      const beforeCount = currentData.length;
      log.debug(
        `[DataCleaningPipeline] Running stage "${stage.id}" on ${beforeCount} points`
      );

      try {
        currentData = stage.fn(currentData, context);
      } catch (err) {
        log.error(
          `[DataCleaningPipeline] Stage "${stage.id}" threw an error:`,
          err
        );
        // On stage failure, continue with data as-is to avoid data loss
        continue;
      }

      const afterCount = currentData.length;
      const delta = beforeCount - afterCount;
      if (delta !== 0) {
        log.debug(
          `[DataCleaningPipeline] Stage "${stage.id}": ` +
            `${beforeCount} → ${afterCount} (${delta > 0 ? '-' : '+'}${Math.abs(delta)})`
        );
      }
    }

    // Ensure all output points are CleanDataPoints
    const cleanData: CleanDataPoint[] = currentData.map(toClean);

    // Build the report
    const durationMs = performance.now() - startTime;
    const adjustments = collectAnomalies(cleanData);
    const qualityScore = computeOverallQuality(cleanData);

    const report: CleaningReport = {
      totalPoints,
      cleanedPoints: cleanData.length,
      removedPoints: totalPoints - cleanData.length,
      adjustments,
      qualityScore: Math.round(qualityScore * 10000) / 10000,
      durationMs: Math.round(durationMs * 100) / 100,
    };

    this.lastReport = report;

    log.info(
      `[DataCleaningPipeline] Clean complete for "${context.symbol}": ` +
        `${report.cleanedPoints}/${report.totalPoints} points kept, ` +
        `${report.removedPoints} removed, ` +
        `quality=${report.qualityScore}, ` +
        `duration=${report.durationMs}ms`
    );

    return { data: cleanData, report };
  }

  /**
   * Convenience: clean and return only the data (no report).
   */
  cleanData(
    rawData: RawDataPoint[],
    context: CleaningContext
  ): CleanDataPoint[] {
    return this.clean(rawData, context).data;
  }

  /**
   * Convenience: clean and return only the report.
   */
  cleanReport(
    rawData: RawDataPoint[],
    context: CleaningContext
  ): CleaningReport {
    return this.clean(rawData, context).report;
  }

  /**
   * Reset the pipeline to default stages.
   */
  reset(): void {
    this.stages = [];
    this.lastReport = null;
    this.loadDefaultStages();
    log.info('[DataCleaningPipeline] Reset to defaults');
  }

  /**
   * Get a summary string describing the current pipeline configuration.
   */
  describe(): string {
    const lines = [
      `DataCleaningPipeline (${this.stages.length} stages):`,
      ...this.stages.map(
        (s, i) =>
          `  ${i + 1}. [${s.enabled ? '✓' : '✗'}] ${s.id} — ${s.name}`
      ),
    ];
    if (this.lastReport) {
      lines.push('');
      lines.push('Last Report:');
      lines.push(`  Total: ${this.lastReport.totalPoints}`);
      lines.push(`  Cleaned: ${this.lastReport.cleanedPoints}`);
      lines.push(`  Removed: ${this.lastReport.removedPoints}`);
      lines.push(`  Quality: ${this.lastReport.qualityScore}`);
      lines.push(`  Duration: ${this.lastReport.durationMs}ms`);
    }
    return lines.join('\n');
  }
}

export default DataCleaningPipeline;

// ── Historical Data Backfill Service (JVS-59) ─────────────────────────────
// Batch backfill historical data for symbols
// Supports: incremental backfill, gap detection, parallel downloads
// IPC: backfill:start, backfill:status, backfill:stop, backfill:stats

import log from 'electron-log';
import { EngineError, ErrorCode } from '../../errors';


// ── Types ──────────────────────────────────────────────────────────────────

export interface BackfillConfig {
  symbols: string[];
  startDate: string;        // ISO date string
  endDate: string;
  interval: '1m' | '5m' | '15m' | '1h' | '1d';
  maxConcurrency?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

export interface BackfillProgress {
  symbol: string;
  status: 'pending' | 'downloading' | 'completed' | 'failed';
  progress: number;         // 0-100
  recordsDownloaded: number;
  error?: string;
  startTime: number;
  endTime?: number;
}

export interface BackfillResult {
  symbol: string;
  success: boolean;
  recordsDownloaded: number;
  startDate: string;
  endDate: string;
  gaps: DataGap[];
  error?: string;
}

export interface DataGap {
  startDate: string;
  endDate: string;
  missingRecords: number;
}

export interface BackfillStats {
  totalSymbols: number;
  completedSymbols: number;
  failedSymbols: number;
  totalRecords: number;
  avgRecordsPerSymbol: number;
  totalDuration: number;
  avgDurationPerSymbol: number;
  successRate: number;
}

export interface BackfillStatus {
  running: boolean;
  currentSymbol: string | null;
  progress: BackfillProgress[];
  stats: BackfillStats;
}

// ── Backfill Manager ───────────────────────────────────────────────────────

class BackfillManager {
  private config: BackfillConfig | null = null;
  private running: boolean = false;
  private progress: Map<string, BackfillProgress> = new Map();
  private currentSymbol: string | null = null;
  private abortController: AbortController | null = null;

  async start(config: BackfillConfig): Promise<BackfillResult[]> {
    if (this.running) {
      throw new EngineError(ErrorCode.DATA_SOURCE_ERROR, 'Backfill already running');
    }

    this.config = config;
    this.running = true;
    this.progress.clear();
    this.abortController = new AbortController();

    const startTime = Date.now();
    const results: BackfillResult[] = [];
    const maxConcurrency = config.maxConcurrency || 5;

    log.info(`[Backfill] Starting backfill for ${config.symbols.length} symbols`);

    // Process symbols in batches
    for (let i = 0; i < config.symbols.length; i += maxConcurrency) {
      if (this.abortController.signal.aborted) {
        log.warn('[Backfill] Aborted by user');
        break;
      }

      const batch = config.symbols.slice(i, i + maxConcurrency);
      const batchPromises = batch.map(symbol => this.processSymbol(symbol, config));
      const batchResults = await Promise.all(batchPromises);

      results.push(...batchResults);

      log.info(`[Backfill] Batch ${Math.floor(i / maxConcurrency) + 1} completed: ${batchResults.length} symbols`);
    }

    const duration = Date.now() - startTime;
    log.info(`[Backfill] Completed in ${duration}ms: ${results.filter(r => r.success).length}/${results.length} successful`);

    this.running = false;
    this.currentSymbol = null;
    this.abortController = null;

    return results;
  }

  stop(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.running = false;
      this.currentSymbol = null;
      log.info('[Backfill] Stop requested');
    }
  }

  getStatus(): BackfillStatus {
    return {
      running: this.running,
      currentSymbol: this.currentSymbol,
      progress: Array.from(this.progress.values()),
      stats: this.calculateStats(),
    };
  }

  getStats(): BackfillStats {
    return this.calculateStats();
  }

  private async processSymbol(symbol: string, config: BackfillConfig): Promise<BackfillResult> {
    this.currentSymbol = symbol;

    const progress: BackfillProgress = {
      symbol,
      status: 'downloading',
      progress: 0,
      recordsDownloaded: 0,
      startTime: Date.now(),
    };
    this.progress.set(symbol, progress);

    try {
      // Simulate download with progress updates
      const records = await this.downloadSymbolData(symbol, config, (progress) => {
        const existing = this.progress.get(symbol);
        if (existing) {
          existing.progress = progress;
          existing.recordsDownloaded = Math.floor(progress / 100 * 1000);
        }
      });

      const result: BackfillResult = {
        symbol,
        success: true,
        recordsDownloaded: records.length,
        startDate: config.startDate,
        endDate: config.endDate,
        gaps: this.detectGaps(records, config),
      };

      progress.status = 'completed';
      progress.progress = 100;
      progress.endTime = Date.now();

      log.info(`[Backfill] ${symbol}: ${records.length} records downloaded`);
      return result;
    } catch (err: unknown) {
      progress.status = 'failed';
      progress.error = err.message;
      log.error(`[Backfill] ${symbol} failed:`, err.message);

      return {
        symbol,
        success: false,
        recordsDownloaded: 0,
        startDate: config.startDate,
        endDate: config.endDate,
        gaps: [],
        error: err.message,
      };
    }
  }

  private async downloadSymbolData(
    symbol: string,
    config: BackfillConfig,
    onProgress: (progress: number) => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<any[]> {
    // Simulate download with progress
    const totalSteps = 10;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const records: any[] = [];

    for (let i = 0; i < totalSteps; i++) {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 100));
      onProgress(((i + 1) / totalSteps) * 100);
    }

    // Simulate downloaded records
    const numRecords = Math.floor(Math.random() * 500) + 100;
    for (let i = 0; i < numRecords; i++) {
      records.push({
        timestamp: Date.now() - i * 86400000,
        open: Math.random() * 100,
        high: Math.random() * 100,
        low: Math.random() * 100,
        close: Math.random() * 100,
        volume: Math.floor(Math.random() * 1000000),
      });
    }

    return records;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private detectGaps(records: any[], config: BackfillConfig): DataGap[] {
    // Simplified gap detection
    const gaps: DataGap[] = [];

    if (records.length === 0) {
      gaps.push({
        startDate: config.startDate,
        endDate: config.endDate,
        missingRecords: 1000,
      });
    }

    return gaps;
  }

  private calculateStats(): BackfillStats {
    const progress = Array.from(this.progress.values());
    const completed = progress.filter(p => p.status === 'completed');
    const failed = progress.filter(p => p.status === 'failed');

    const totalRecords = completed.reduce((sum, p) => sum + p.recordsDownloaded, 0);
    const totalDuration = completed.reduce((sum, p) => {
      return sum + ((p.endTime || Date.now()) - p.startTime);
    }, 0);

    return {
      totalSymbols: progress.length,
      completedSymbols: completed.length,
      failedSymbols: failed.length,
      totalRecords,
      avgRecordsPerSymbol: completed.length > 0 ? totalRecords / completed.length : 0,
      totalDuration,
      avgDurationPerSymbol: completed.length > 0 ? totalDuration / completed.length : 0,
      successRate: progress.length > 0 ? completed.length / progress.length : 0,
    };
  }
}

// ── Main Functions ─────────────────────────────────────────────────────────

let backfillManager: BackfillManager | null = null;

export function initializeBackfillManager(): BackfillManager {
  if (!backfillManager) {
    backfillManager = new BackfillManager();
  }
  return backfillManager;
}

export function getBackfillManager(): BackfillManager | null {
  return backfillManager;
}

export async function startBackfill(config: BackfillConfig): Promise<BackfillResult[]> {
  const manager = initializeBackfillManager();
  return manager.start(config);
}

export function stopBackfill(): void {
  if (backfillManager) {
    backfillManager.stop();
  }
}

export function getBackfillStatus(): BackfillStatus {
  if (!backfillManager) {
    return {
      running: false,
      currentSymbol: null,
      progress: [],
      stats: {
        totalSymbols: 0,
        completedSymbols: 0,
        failedSymbols: 0,
        totalRecords: 0,
        avgRecordsPerSymbol: 0,
        totalDuration: 0,
        avgDurationPerSymbol: 0,
        successRate: 0,
      }
    };
  }
  return backfillManager.getStatus();
}

export function getBackfillStats(): BackfillStats {
  if (!backfillManager) {
    return {
      totalSymbols: 0,
      completedSymbols: 0,
      failedSymbols: 0,
      totalRecords: 0,
      avgRecordsPerSymbol: 0,
      totalDuration: 0,
      avgDurationPerSymbol: 0,
      successRate: 0,
    };
  }
  return backfillManager.getStats();
}

// ── Batch Operations ───────────────────────────────────────────────────────

export async function backfillSymbols(
  symbols: string[],
  startDate: string,
  endDate: string,
  interval: '1m' | '5m' | '15m' | '1h' | '1d' = '1d'
): Promise<BackfillResult[]> {
  const config: BackfillConfig = {
    symbols,
    startDate,
    endDate,
    interval,
  };
  return startBackfill(config);
}

// ── Gap Detection ──────────────────────────────────────────────────────────

export interface GapAnalysis {
  symbol: string;
  totalGaps: number;
  totalMissingRecords: number;
  gaps: DataGap[];
  completeness: number; // 0-100
}

export function analyzeDataGaps(
  symbol: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  records: any[],
  startDate: string,
  endDate: string
): GapAnalysis {
  const gaps: DataGap[] = [];

  // Simplified gap detection
  if (records.length === 0) {
    gaps.push({
      startDate,
      endDate,
      missingRecords: 1000,
    });
  }

  const totalMissingRecords = gaps.reduce((sum, g) => sum + g.missingRecords, 0);
  const expectedRecords = 1000; // Simplified
  const completeness = expectedRecords > 0 ? ((expectedRecords - totalMissingRecords) / expectedRecords) * 100 : 0;

  return {
    symbol,
    totalGaps: gaps.length,
    totalMissingRecords,
    gaps,
    completeness: Math.max(0, Math.min(100, completeness)),
  };
}

// ── Incremental Backfill ───────────────────────────────────────────────────

export async function incrementalBackfill(
  symbol: string,
  startDate: string,
  endDate: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  existingRecords: any[]
): Promise<BackfillResult> {
  // Detect gaps in existing records
  const gapAnalysis = analyzeDataGaps(symbol, existingRecords, startDate, endDate);

  if (gapAnalysis.totalGaps === 0) {
    return {
      symbol,
      success: true,
      recordsDownloaded: 0,
      startDate,
      endDate,
      gaps: [],
    };
  }

  // Backfill only gaps
  const config: BackfillConfig = {
    symbols: [symbol],
    startDate,
    endDate,
    interval: '1d',
  };

  const results = await startBackfill(config);
  return results[0];
}

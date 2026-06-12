// @ts-nocheck
/**
 * Data Version Control (JVS-86)
 *
 * Tracks changes to market data with support for snapshots, branching,
 * restore, diff computation, and retention policies.
 *
 * All snapshot data is stored in-memory. Content hashing uses an
 * FNV-1a inspired algorithm for fast change detection.
 */

import log from 'electron-log';
import { generateId } from '../utils/id';
import { EngineError, ErrorCode } from '../../errors';


// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface DataSnapshot {
  id: string;
  table: string;
  timestamp: string;
  rowCount: number;
  hash: string; // content hash for change detection
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: Record<string, any>;
  parentId?: string; // previous snapshot ID
}

export interface DataDiff {
  snapshotId: string;
  parentId: string;
  addedRows: number;
  removedRows: number;
  modifiedRows: number;
  columnChanges: { column: string; changeCount: number }[];
  summary: string;
}

export interface BranchInfo {
  name: string;
  headSnapshotId: string;
  createdAt: string;
  snapshotCount: number;
  parent?: string; // parent branch name
}

export interface VersionConfig {
  maxSnapshots: number; // per table
  autoSnapshot: boolean;
  autoSnapshotIntervalMs: number;
  compressionEnabled: boolean;
}

// ---------------------------------------------------------------------------
// Internal storage types
// ---------------------------------------------------------------------------

/** Internal wrapper that pairs a snapshot with its raw row data. */
interface StoredSnapshot {
  snapshot: DataSnapshot;
  data: unknown[][];
}

/** Internal branch record. */
interface BranchRecord {
  info: BranchInfo;
  snapshotIds: string[]; // ordered list of snapshot IDs on this branch
}

// ---------------------------------------------------------------------------
// FNV-1a inspired content hashing
// ---------------------------------------------------------------------------

const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/**
 * Compute a 32-bit FNV-1a hash for an arbitrary string.
 * Returns an 8-character hex digest.
 */
function fnv1aHash(input: string): string {
  let hash = FNV_OFFSET_BASIS;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME);
  }
  // Convert unsigned 32-bit to zero-padded hex
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Produce a deterministic string representation of a data row.
 * Handles nested objects by JSON-stringifying with sorted keys.
 */
function serializeRow(row: unknown): string {
  if (row === null || row === undefined) {
    return String(row);
  }
  if (typeof row === 'object') {
    const keys = Object.keys(row).sort();
    const parts: string[] = [];
    for (const key of keys) {
      parts.push(`${key}:${serializeRow(row[key])}`);
    }
    return `{${parts.join(',')}}`;
  }
  return String(row);
}

// ---------------------------------------------------------------------------
// Unique ID generation
// ---------------------------------------------------------------------------

let idCounter = 0;


// ---------------------------------------------------------------------------
// Duration parsing helper
// ---------------------------------------------------------------------------

/**
 * Parse a human-friendly duration string (e.g. "7d", "12h", "30m") into
 * milliseconds.  Supported suffixes: s (seconds), m (minutes), h (hours),
 * d (days).  Plain numbers are treated as milliseconds.
 */
function parseDuration(value: string): number {
  const match = value.trim().match(/^(\d+(?:\.\d+)?)\s*(s|m|h|d)?$/i);
  if (!match) {
    throw new EngineError(ErrorCode.DATA_SOURCE_ERROR, `Invalid duration string: "${value}"`);
  }
  const amount = parseFloat(match[1]);
  const unit = (match[2] || 'ms').toLowerCase();
  switch (unit) {
    case 's':
      return amount * 1000;
    case 'm':
      return amount * 60 * 1000;
    case 'h':
      return amount * 60 * 60 * 1000;
    case 'd':
      return amount * 24 * 60 * 60 * 1000;
    default:
      return amount; // already ms
  }
}

// ---------------------------------------------------------------------------
// Default configuration
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: VersionConfig = {
  maxSnapshots: 100,
  autoSnapshot: false,
  autoSnapshotIntervalMs: 60_000,
  compressionEnabled: false,
};

// ---------------------------------------------------------------------------
// DataVersionController
// ---------------------------------------------------------------------------

export class DataVersionController {
  // -- storage maps ---------------------------------------------------------
  /** All stored snapshots keyed by snapshot ID. */
  private snapshots: Map<string, StoredSnapshot> = new Map();

  /** All branches keyed by branch name. */
  private branches: Map<string, BranchRecord> = new Map();

  /** Name of the currently active branch. */
  private currentBranch: string = 'main';

  /** Merged configuration. */
  private config: VersionConfig;

  /** Handle for the auto-snapshot interval timer (if running). */
  private autoSnapshotTimer: ReturnType<typeof setInterval> | null = null;

  /** Registry of auto-snapshot table sources. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private autoSnapshotSources: Map<string, () => any[]> = new Map();

  // -------------------------------------------------------------------------
  // Constructor
  // -------------------------------------------------------------------------

  constructor(config?: Partial<VersionConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Initialise the default "main" branch with a sentinel head
    const sentinelId = generateId();
    const sentinelSnapshot: DataSnapshot = {
      id: sentinelId,
      table: '__branch_sentinel__',
      timestamp: new Date().toISOString(),
      rowCount: 0,
      hash: '00000000',
      metadata: { sentinel: true },
    };
    this.snapshots.set(sentinelId, { snapshot: sentinelSnapshot, data: [] });

    const mainBranch: BranchRecord = {
      info: {
        name: 'main',
        headSnapshotId: sentinelId,
        createdAt: new Date().toISOString(),
        snapshotCount: 0,
      },
      snapshotIds: [sentinelId],
    };
    this.branches.set('main', mainBranch);

    log.info('[DataVersionController] initialised', {
      config: this.config,
    });
  }

  // =========================================================================
  // Snapshot management
  // =========================================================================

  /**
   * Create a new snapshot for the given table and data.
   *
   * The snapshot is appended to the currently active branch.  If the table
   * exceeds `maxSnapshots` the oldest snapshot for that table is pruned
   * automatically.
   */
  createSnapshot(
    table: string,
    data: unknown[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    metadata?: Record<string, any>,
  ): DataSnapshot {
    if (!table || table.trim().length === 0) {
      throw new EngineError(ErrorCode.DATA_SOURCE_ERROR, 'Table name must not be empty');
    }
    if (!Array.isArray(data)) {
      throw new EngineError(ErrorCode.DATA_SOURCE_ERROR, 'Data must be an array of rows');
    }

    const hash = this.getContentHash(data);
    const branch = this.branches.get(this.currentBranch);
    if (!branch) {
      throw new EngineError(ErrorCode.DATA_SOURCE_ERROR, `Active branch "${this.currentBranch}" not found`);
    }

    const parentId = branch.info.headSnapshotId;

    // Skip duplicate: if the head snapshot for this table has the same hash
    const tableHistory = this.getHistory(table);
    if (tableHistory.length > 0 && tableHistory[0].hash === hash) {
      log.info(
        `[DataVersionController] skipping duplicate snapshot for table "${table}" (hash unchanged)`,
      );
      return tableHistory[0];
    }

    const id = generateId();
    const snapshot: DataSnapshot = {
      id,
      table,
      timestamp: new Date().toISOString(),
      rowCount: data.length,
      hash,
      metadata: metadata ?? {},
      parentId,
    };

    // Store a shallow copy of the rows to prevent external mutation
    const storedData = data.map((row) =>
      typeof row === 'object' && row !== null ? { ...row } : row,
    );

    this.snapshots.set(id, { snapshot, data: storedData });

    // Update branch record
    branch.snapshotIds.push(id);
    branch.info.headSnapshotId = id;
    branch.info.snapshotCount = branch.snapshotIds.filter((sid) => {
      const s = this.snapshots.get(sid);
      return s && s.snapshot.table === table;
    }).length;

    // Enforce retention policy per table on the current branch
    this.enforceRetentionPolicy(table);

    log.info('[DataVersionController] snapshot created', {
      id,
      table,
      rowCount: data.length,
      hash,
      branch: this.currentBranch,
    });

    return snapshot;
  }

  /**
   * Restore the data captured in a given snapshot.
   * Returns a *copy* of the stored rows.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  restoreSnapshot(snapshotId: string): any[] {
    const stored = this.snapshots.get(snapshotId);
    if (!stored) {
      throw new EngineError(ErrorCode.DATA_SOURCE_ERROR, `Snapshot "${snapshotId}" not found`);
    }

    log.info('[DataVersionController] restoring snapshot', {
      snapshotId,
      table: stored.snapshot.table,
      rowCount: stored.snapshot.rowCount,
    });

    return stored.data.map((row) =>
      typeof row === 'object' && row !== null ? { ...row } : row,
    );
  }

  /**
   * Compute a diff between two snapshots.
   *
   * The diff reports added, removed and modified rows as well as per-column
   * change counts.  Row identity is determined by a `_id`, `id`, or the
   * first column value; if none is available the row index is used.
   */
  diff(snapshotId1: string, snapshotId2: string): DataDiff {
    const stored1 = this.snapshots.get(snapshotId1);
    const stored2 = this.snapshots.get(snapshotId2);
    if (!stored1) {
      throw new EngineError(ErrorCode.DATA_SOURCE_ERROR, `Snapshot "${snapshotId1}" not found`);
    }
    if (!stored2) {
      throw new EngineError(ErrorCode.DATA_SOURCE_ERROR, `Snapshot "${snapshotId2}" not found`);
    }

    const data1 = stored1.data;
    const data2 = stored2.data;

    // Build identity maps
    const key1 = this.buildRowKeyMap(data1);
    const key2 = this.buildRowKeyMap(data2);

    const keys1 = new Set(key1.keys());
    const keys2 = new Set(key2.keys());

    let addedRows = 0;
    let removedRows = 0;
    let modifiedRows = 0;
    const columnChangeCounts: Map<string, number> = new Map();

    // Rows only in snapshot2 → added
    for (const k of keys2) {
      if (!keys1.has(k)) {
        addedRows++;
        // Count every column as changed for added rows
        const row = data2[key2.get(k)!];
        if (typeof row === 'object' && row !== null) {
          for (const col of Object.keys(row)) {
            columnChangeCounts.set(col, (columnChangeCounts.get(col) || 0) + 1);
          }
        }
      }
    }

    // Rows only in snapshot1 → removed
    for (const k of keys1) {
      if (!keys2.has(k)) {
        removedRows++;
        const row = data1[key1.get(k)!];
        if (typeof row === 'object' && row !== null) {
          for (const col of Object.keys(row)) {
            columnChangeCounts.set(col, (columnChangeCounts.get(col) || 0) + 1);
          }
        }
      }
    }

    // Rows in both → check for modifications
    for (const k of keys1) {
      if (!keys2.has(k)) continue;
      const row1 = data1[key1.get(k)!];
      const row2 = data2[key2.get(k)!];
      const ser1 = serializeRow(row1);
      const ser2 = serializeRow(row2);
      if (ser1 !== ser2) {
        modifiedRows++;
        // Per-column diff
        if (
          typeof row1 === 'object' &&
          row1 !== null &&
          typeof row2 === 'object' &&
          row2 !== null
        ) {
          const allCols = new Set([
            ...Object.keys(row1),
            ...Object.keys(row2),
          ]);
          for (const col of allCols) {
            if (serializeRow(row1[col]) !== serializeRow(row2[col])) {
              columnChangeCounts.set(
                col,
                (columnChangeCounts.get(col) || 0) + 1,
              );
            }
          }
        }
      }
    }

    const columnChanges = Array.from(columnChangeCounts.entries())
      .map(([column, changeCount]) => ({ column, changeCount }))
      .sort((a, b) => b.changeCount - a.changeCount);

    const summary = this.buildDiffSummary(
      stored1.snapshot,
      stored2.snapshot,
      addedRows,
      removedRows,
      modifiedRows,
    );

    const result: DataDiff = {
      snapshotId: snapshotId2,
      parentId: snapshotId1,
      addedRows,
      removedRows,
      modifiedRows,
      columnChanges,
      summary,
    };

    log.info('[DataVersionController] diff computed', {
      snapshotId1,
      snapshotId2,
      addedRows,
      removedRows,
      modifiedRows,
    });

    return result;
  }

  /**
   * List snapshots, optionally filtered by table name.
   * Returns snapshots ordered newest-first.
   */
  listSnapshots(table?: string): DataSnapshot[] {
    const results: DataSnapshot[] = [];
    for (const stored of this.snapshots.values()) {
      if (stored.snapshot.metadata?.sentinel) continue;
      if (table && stored.snapshot.table !== table) continue;
      results.push(stored.snapshot);
    }
    results.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
    return results;
  }

  /**
   * Get the snapshot history for a specific table on the current branch,
   * ordered newest-first.
   */
  getHistory(table: string, limit?: number): DataSnapshot[] {
    const branch = this.branches.get(this.currentBranch);
    if (!branch) return [];

    const history: DataSnapshot[] = [];
    // Walk the branch snapshot list in reverse (newest first)
    for (let i = branch.snapshotIds.length - 1; i >= 0; i--) {
      const stored = this.snapshots.get(branch.snapshotIds[i]);
      if (stored && stored.snapshot.table === table) {
        history.push(stored.snapshot);
      }
      if (limit && history.length >= limit) break;
    }
    return history;
  }

  // =========================================================================
  // Branch management
  // =========================================================================

  /**
   * Create a new branch, optionally starting from a specific snapshot.
   * If `fromSnapshotId` is omitted the branch starts from the current
   * branch's head snapshot.
   */
  createBranch(name: string, fromSnapshotId?: string): BranchInfo {
    if (!name || name.trim().length === 0) {
      throw new EngineError(ErrorCode.DATA_SOURCE_ERROR, 'Branch name must not be empty');
    }
    if (this.branches.has(name)) {
      throw new EngineError(ErrorCode.DATA_SOURCE_ERROR, `Branch "${name}" already exists`);
    }

    const sourceBranch = this.branches.get(this.currentBranch);
    if (!sourceBranch) {
      throw new EngineError(ErrorCode.DATA_SOURCE_ERROR, `Active branch "${this.currentBranch}" not found`);
    }

    const startId = fromSnapshotId ?? sourceBranch.info.headSnapshotId;
    if (!this.snapshots.has(startId)) {
      throw new EngineError(ErrorCode.DATA_SOURCE_ERROR, `Snapshot "${startId}" not found`);
    }

    // Build snapshot chain up to and including startId
    const chainIds = this.collectAncestorChain(startId, sourceBranch);

    const branchRecord: BranchRecord = {
      info: {
        name,
        headSnapshotId: startId,
        createdAt: new Date().toISOString(),
        snapshotCount: chainIds.filter((sid) => {
          const s = this.snapshots.get(sid);
          return s && !s.snapshot.metadata?.sentinel;
        }).length,
        parent: this.currentBranch,
      },
      snapshotIds: chainIds,
    };

    this.branches.set(name, branchRecord);

    log.info('[DataVersionController] branch created', {
      name,
      headSnapshotId: startId,
      parent: this.currentBranch,
      snapshotCount: branchRecord.info.snapshotCount,
    });

    return { ...branchRecord.info };
  }

  /**
   * Delete a branch.  The "main" branch cannot be deleted.
   * Snapshots unique to this branch are also removed.
   */
  deleteBranch(name: string): boolean {
    if (name === 'main') {
      log.warn('[DataVersionController] cannot delete the main branch');
      return false;
    }
    const branch = this.branches.get(name);
    if (!branch) {
      log.warn(`[DataVersionController] branch "${name}" not found`);
      return false;
    }

    // Collect snapshot IDs referenced by other branches
    const otherSnapshotIds = new Set<string>();
    for (const [bName, bRecord] of this.branches) {
      if (bName === name) continue;
      for (const sid of bRecord.snapshotIds) {
        otherSnapshotIds.add(sid);
      }
    }

    // Remove snapshots exclusive to this branch
    let removedCount = 0;
    for (const sid of branch.snapshotIds) {
      if (!otherSnapshotIds.has(sid)) {
        this.snapshots.delete(sid);
        removedCount++;
      }
    }

    this.branches.delete(name);

    // If we were on the deleted branch, switch back to main
    if (this.currentBranch === name) {
      this.currentBranch = 'main';
    }

    log.info('[DataVersionController] branch deleted', {
      name,
      exclusiveSnapshotsRemoved: removedCount,
    });

    return true;
  }

  /**
   * Switch the active branch.
   */
  switchBranch(name: string): boolean {
    if (!this.branches.has(name)) {
      log.warn(`[DataVersionController] branch "${name}" not found`);
      return false;
    }
    this.currentBranch = name;
    log.info('[DataVersionController] switched branch', { branch: name });
    return true;
  }

  /**
   * List all branches.
   */
  listBranches(): BranchInfo[] {
    const results: BranchInfo[] = [];
    for (const record of this.branches.values()) {
      // Recompute snapshot count to stay accurate
      const count = record.snapshotIds.filter((sid) => {
        const s = this.snapshots.get(sid);
        return s && !s.snapshot.metadata?.sentinel;
      }).length;
      results.push({
        ...record.info,
        snapshotCount: count,
      });
    }
    return results;
  }

  /**
   * Merge `sourceBranch` into `targetBranch`.
   *
   * Strategy: fast-forward if possible (target head is ancestor of source
   * head), otherwise create a merge snapshot on the target branch that
   * contains the source branch's latest data.
   *
   * Returns a `DataDiff` describing the changes introduced into the target.
   */
  mergeBranch(sourceBranch: string, targetBranch: string): DataDiff {
    const source = this.branches.get(sourceBranch);
    const target = this.branches.get(targetBranch);
    if (!source) {
      throw new EngineError(ErrorCode.DATA_SOURCE_ERROR, `Source branch "${sourceBranch}" not found`);
    }
    if (!target) {
      throw new EngineError(ErrorCode.DATA_SOURCE_ERROR, `Target branch "${targetBranch}" not found`);
    }

    const sourceHead = this.snapshots.get(source.info.headSnapshotId);
    const targetHead = this.snapshots.get(target.info.headSnapshotId);
    if (!sourceHead || !targetHead) {
      throw new EngineError(ErrorCode.DATA_SOURCE_ERROR, 'Head snapshot missing for source or target branch');
    }

    // Compute diff between the two heads
    const diffResult = this.diff(
      target.info.headSnapshotId,
      source.info.headSnapshotId,
    );

    // If there are no changes, return early
    if (
      diffResult.addedRows === 0 &&
      diffResult.removedRows === 0 &&
      diffResult.modifiedRows === 0
    ) {
      log.info('[DataVersionController] merge: no changes to apply', {
        sourceBranch,
        targetBranch,
      });
      return diffResult;
    }

    // Perform merge: create a new snapshot on the target with source data
    const previousBranch = this.currentBranch;
    this.currentBranch = targetBranch;

    const mergeSnapshot = this.createSnapshot(
      sourceHead.snapshot.table,
      sourceHead.data,
      {
        merge: true,
        sourceBranch,
        targetBranch,
        mergedAt: new Date().toISOString(),
      },
    );

    this.currentBranch = previousBranch;

    // Update diff to reference the merge snapshot
    diffResult.snapshotId = mergeSnapshot.id;
    diffResult.summary = `Merged "${sourceBranch}" → "${targetBranch}": ${diffResult.addedRows} added, ${diffResult.removedRows} removed, ${diffResult.modifiedRows} modified`;

    log.info('[DataVersionController] branches merged', {
      sourceBranch,
      targetBranch,
      mergeSnapshotId: mergeSnapshot.id,
    });

    return diffResult;
  }

  // =========================================================================
  // Pruning & retention
  // =========================================================================

  /**
   * Remove old snapshots.
   *
   * @param maxAge - Human-readable age threshold (e.g. "7d", "12h").
   *                 Snapshots older than this are removed.
   *                 If omitted, the retention policy (`maxSnapshots` per
   *                 table) is applied instead.
   * @returns The number of snapshots removed.
   */
  prune(maxAge?: string): number {
    let removed = 0;

    if (maxAge) {
      const thresholdMs = parseDuration(maxAge);
      const cutoff = Date.now() - thresholdMs;

      const toRemove: string[] = [];
      for (const [id, stored] of this.snapshots) {
        if (stored.snapshot.metadata?.sentinel) continue;
        if (new Date(stored.snapshot.timestamp).getTime() < cutoff) {
          toRemove.push(id);
        }
      }

      for (const id of toRemove) {
        this.removeSnapshotFromBranches(id);
        this.snapshots.delete(id);
        removed++;
      }
    } else {
      // Apply maxSnapshots policy per table
      const tables = new Set<string>();
      for (const stored of this.snapshots.values()) {
        if (!stored.snapshot.metadata?.sentinel) {
          tables.add(stored.snapshot.table);
        }
      }
      for (const table of tables) {
        removed += this.pruneTable(table);
      }
    }

    log.info('[DataVersionController] prune completed', {
      removed,
      maxAge: maxAge ?? 'policy',
    });

    return removed;
  }

  // =========================================================================
  // Content hashing
  // =========================================================================

  /**
   * Compute a content hash for a dataset.
   * Uses FNV-1a over the serialised representation of all rows.
   */
  getContentHash(data: unknown[]): string {
    if (!data || data.length === 0) {
      return fnv1aHash('__empty__');
    }

    // Hash each row individually, then combine
    let combined = '';
    for (let i = 0; i < data.length; i++) {
      combined += `[${i}]${serializeRow(data[i])}`;
    }
    return fnv1aHash(combined);
  }

  // =========================================================================
  // Auto-snapshot support
  // =========================================================================

  /**
   * Register a data source for automatic snapshots.
   * The `dataProvider` callback is invoked each interval to fetch current data.
   */
  registerAutoSnapshotSource(
    table: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    dataProvider: () => any[],
  ): void {
    this.autoSnapshotSources.set(table, dataProvider);
    log.info('[DataVersionController] auto-snapshot source registered', {
      table,
    });

    // Start the timer if auto-snapshot is enabled and timer not running
    if (this.config.autoSnapshot && !this.autoSnapshotTimer) {
      this.startAutoSnapshotTimer();
    }
  }

  /**
   * Unregister a data source from automatic snapshots.
   */
  unregisterAutoSnapshotSource(table: string): boolean {
    const removed = this.autoSnapshotSources.delete(table);
    if (this.autoSnapshotSources.size === 0 && this.autoSnapshotTimer) {
      this.stopAutoSnapshotTimer();
    }
    return removed;
  }

  /**
   * Start the auto-snapshot interval timer.
   */
  private startAutoSnapshotTimer(): void {
    if (this.autoSnapshotTimer) return;
    this.autoSnapshotTimer = setInterval(() => {
      this.runAutoSnapshots();
    }, this.config.autoSnapshotIntervalMs);
    log.info('[DataVersionController] auto-snapshot timer started', {
      intervalMs: this.config.autoSnapshotIntervalMs,
    });
  }

  /**
   * Stop the auto-snapshot interval timer.
   */
  stopAutoSnapshotTimer(): void {
    if (this.autoSnapshotTimer) {
      clearInterval(this.autoSnapshotTimer);
      this.autoSnapshotTimer = null;
      log.info('[DataVersionController] auto-snapshot timer stopped');
    }
  }

  /**
   * Execute auto-snapshots for all registered sources.
   */
  private runAutoSnapshots(): void {
    for (const [table, provider] of this.autoSnapshotSources) {
      try {
        const data = provider();
        this.createSnapshot(table, data, { auto: true });
      } catch (err: unknown) {
        log.error('[DataVersionController] auto-snapshot failed', {
          table,
          error: err?.message ?? String(err),
        });
      }
    }
  }

  // =========================================================================
  // Configuration
  // =========================================================================

  /**
   * Update the version controller configuration.
   */
  updateConfig(partial: Partial<VersionConfig>): VersionConfig {
    const prevAuto = this.config.autoSnapshot;
    this.config = { ...this.config, ...partial };

    // React to autoSnapshot toggle
    if (this.config.autoSnapshot && !prevAuto && this.autoSnapshotSources.size > 0) {
      this.startAutoSnapshotTimer();
    } else if (!this.config.autoSnapshot && prevAuto) {
      this.stopAutoSnapshotTimer();
    }

    log.info('[DataVersionController] config updated', {
      config: this.config,
    });

    return { ...this.config };
  }

  /**
   * Get the current configuration.
   */
  getConfig(): VersionConfig {
    return { ...this.config };
  }

  // =========================================================================
  // Statistics & diagnostics
  // =========================================================================

  /**
   * Get summary statistics about the version controller state.
   */
  getStats(): {
    totalSnapshots: number;
    totalBranches: number;
    currentBranch: string;
    tables: { name: string; snapshotCount: number; latestHash: string }[];
    memoryEstimateKB: number;
  } {
    const tableMap = new Map<
      string,
      { count: number; latestTimestamp: string; latestHash: string }
    >();

    for (const stored of this.snapshots.values()) {
      if (stored.snapshot.metadata?.sentinel) continue;
      const t = stored.snapshot.table;
      const existing = tableMap.get(t);
      if (!existing) {
        tableMap.set(t, {
          count: 1,
          latestTimestamp: stored.snapshot.timestamp,
          latestHash: stored.snapshot.hash,
        });
      } else {
        existing.count++;
        if (
          new Date(stored.snapshot.timestamp).getTime() >
          new Date(existing.latestTimestamp).getTime()
        ) {
          existing.latestTimestamp = stored.snapshot.timestamp;
          existing.latestHash = stored.snapshot.hash;
        }
      }
    }

    const tables = Array.from(tableMap.entries()).map(([name, info]) => ({
      name,
      snapshotCount: info.count,
      latestHash: info.latestHash,
    }));

    // Rough memory estimate
    let totalBytes = 0;
    for (const stored of this.snapshots.values()) {
      totalBytes += JSON.stringify(stored.snapshot).length * 2; // UTF-16
      totalBytes += JSON.stringify(stored.data).length * 2;
    }

    return {
      totalSnapshots: this.snapshots.size,
      totalBranches: this.branches.size,
      currentBranch: this.currentBranch,
      tables,
      memoryEstimateKB: Math.round(totalBytes / 1024),
    };
  }

  // =========================================================================
  // Cleanup
  // =========================================================================

  /**
   * Dispose of all resources.  Stops timers and clears storage.
   */
  dispose(): void {
    this.stopAutoSnapshotTimer();
    this.snapshots.clear();
    this.branches.clear();
    this.autoSnapshotSources.clear();
    this.currentBranch = 'main';
    log.info('[DataVersionController] disposed');
  }

  // =========================================================================
  // Private helpers
  // =========================================================================

  /**
   * Enforce the maxSnapshots retention policy for a given table on the
   * current branch.
   */
  private enforceRetentionPolicy(table: string): void {
    const branch = this.branches.get(this.currentBranch);
    if (!branch) return;

    // Collect snapshot IDs for this table on this branch (oldest first)
    const tableSnapshots: string[] = [];
    for (const sid of branch.snapshotIds) {
      const stored = this.snapshots.get(sid);
      if (stored && stored.snapshot.table === table) {
        tableSnapshots.push(sid);
      }
    }

    while (tableSnapshots.length > this.config.maxSnapshots) {
      const oldestId = tableSnapshots.shift()!;
      // Check no other branch references this snapshot
      const referenced = this.isSnapshotReferencedByOtherBranches(
        oldestId,
        this.currentBranch,
      );
      if (!referenced) {
        this.snapshots.delete(oldestId);
      }
      // Remove from this branch's list
      const idx = branch.snapshotIds.indexOf(oldestId);
      if (idx !== -1) {
        branch.snapshotIds.splice(idx, 1);
      }
    }

    branch.info.snapshotCount = branch.snapshotIds.filter((sid) => {
      const s = this.snapshots.get(sid);
      return s && s.snapshot.table === table && !s.snapshot.metadata?.sentinel;
    }).length;
  }

  /**
   * Prune a single table to fit within `maxSnapshots`.
   */
  private pruneTable(table: string): number {
    let removed = 0;
    for (const [, branch] of this.branches) {
      const tableSids = branch.snapshotIds.filter((sid) => {
        const s = this.snapshots.get(sid);
        return s && s.snapshot.table === table;
      });

      while (tableSids.length > this.config.maxSnapshots) {
        const oldestId = tableSids.shift()!;
        if (!this.isSnapshotReferencedByOtherBranches(oldestId, branch.info.name)) {
          this.snapshots.delete(oldestId);
          removed++;
        }
        const idx = branch.snapshotIds.indexOf(oldestId);
        if (idx !== -1) {
          branch.snapshotIds.splice(idx, 1);
        }
      }
    }
    return removed;
  }

  /**
   * Check if a snapshot is referenced by any branch other than `excludeBranch`.
   */
  private isSnapshotReferencedByOtherBranches(
    snapshotId: string,
    excludeBranch: string,
  ): boolean {
    for (const [name, record] of this.branches) {
      if (name === excludeBranch) continue;
      if (record.snapshotIds.includes(snapshotId)) return true;
    }
    return false;
  }

  /**
   * Remove a snapshot ID from all branch records.
   */
  private removeSnapshotFromBranches(snapshotId: string): void {
    for (const [, record] of this.branches) {
      const idx = record.snapshotIds.indexOf(snapshotId);
      if (idx !== -1) {
        record.snapshotIds.splice(idx, 1);
      }
    }
  }

  /**
   * Collect the ancestor chain of a snapshot within a given branch.
   * Returns an ordered array from the branch root to `snapshotId`.
   */
  private collectAncestorChain(
    snapshotId: string,
    branch: BranchRecord,
  ): string[] {
    const chain: string[] = [];
    let found = false;
    for (const sid of branch.snapshotIds) {
      chain.push(sid);
      if (sid === snapshotId) {
        found = true;
        break;
      }
    }
    if (!found) {
      // If the snapshot isn't in the branch list, just include it
      chain.push(snapshotId);
    }
    return chain;
  }

  /**
   * Build a map of row identity → array index.
   *
   * Identity resolution order:
   * 1. `_id` field
   * 2. `id` field
   * 3. First column value (if object)
   * 4. Row index (fallback)
   */
  private buildRowKeyMap(data: unknown[]): Map<string, number> {
    const map = new Map<string, number>();
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      let key: string;
      if (typeof row === 'object' && row !== null) {
        if (row._id !== undefined) {
          key = `id:${String(row._id)}`;
        } else if (row.id !== undefined) {
          key = `id:${String(row.id)}`;
        } else {
          const firstKey = Object.keys(row)[0];
          if (firstKey !== undefined) {
            key = `col:${String(row[firstKey])}`;
          } else {
            key = `idx:${i}`;
          }
        }
      } else {
        key = `val:${serializeRow(row)}`;
      }

      // Handle duplicate keys by appending index
      if (map.has(key)) {
        key = `${key}__${i}`;
      }
      map.set(key, i);
    }
    return map;
  }

  /**
   * Build a human-readable diff summary string.
   */
  private buildDiffSummary(
    snap1: DataSnapshot,
    snap2: DataSnapshot,
    added: number,
    removed: number,
    modified: number,
  ): string {
    const parts: string[] = [];
    parts.push(
      `Diff: "${snap1.table}" [${snap1.id.substring(0, 12)}] → [${snap2.id.substring(0, 12)}]`,
    );
    if (added > 0) parts.push(`${added} added`);
    if (removed > 0) parts.push(`${removed} removed`);
    if (modified > 0) parts.push(`${modified} modified`);
    if (added === 0 && removed === 0 && modified === 0) {
      parts.push('no changes');
    }
    parts.push(
      `(${snap1.timestamp} → ${snap2.timestamp})`,
    );
    return parts.join(' | ');
  }
}

// ---------------------------------------------------------------------------
// Default export for convenience
// ---------------------------------------------------------------------------

export default DataVersionController;

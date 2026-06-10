/**
 * JVS-85: Data Warehouse Layer
 * Structured local storage for all market data with time-series optimization.
 *
 * In-memory implementation using Map<string, any[]> for portability.
 * Features:
 *   - Query result caching (LRU, 100 entries, 30s TTL)
 *   - Time-range partitioning logic
 *   - Column statistics (min/max/avg for numeric columns)
 *   - Index simulation for fast lookups
 */

import log from 'electron-log';
import { EngineError, ErrorCode } from '../../errors';


// ─────────────────────────────────────────────────────────────────────────────
// Interfaces
// ─────────────────────────────────────────────────────────────────────────────

export interface ColumnDef {
  name: string;
  type: 'number' | 'string' | 'boolean' | 'datetime' | 'json';
  nullable: boolean;
  indexed: boolean;
}

export interface WarehouseTable {
  name: string;
  columns: ColumnDef[];
  rowCount: number;
  sizeBytes: number;
  lastUpdated: string;
  indexes: string[];
}

export interface QueryOptions {
  table: string;
  where?: Record<string, any>;
  orderBy?: { column: string; desc?: boolean };
  limit?: number;
  offset?: number;
  columns?: string[];
  timeRange?: { column: string; start: string; end: string };
}

export interface QueryResult<T = unknown> {
  rows: T[];
  total: number;
  durationMs: number;
  cached: boolean;
}

export interface PartitionConfig {
  table: string;
  partitionBy: 'day' | 'week' | 'month' | 'year';
  timeColumn: string;
  retentionDays: number;
}

export interface ColumnStats {
  column: string;
  min: number;
  max: number;
  avg: number;
  count: number;
  sum: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// LRU Cache
// ─────────────────────────────────────────────────────────────────────────────

interface CacheEntry {
  key: string;
  value: QueryResult<any>;
  timestamp: number;
}

class LRUCache {
  private readonly capacity: number;
  private readonly ttlMs: number;
  private cache: Map<string, CacheEntry>;
  private order: string[];
  private hits: number;
  private misses: number;

  constructor(capacity = 100, ttlMs = 30_000) {
    this.capacity = capacity;
    this.ttlMs = ttlMs;
    this.cache = new Map();
    this.order = [];
    this.hits = 0;
    this.misses = 0;
  }

  get(key: string): QueryResult<any> | null {
    const entry = this.cache.get(key);
    if (!entry) {
      this.misses++;
      return null;
    }

    const now = Date.now();
    if (now - entry.timestamp > this.ttlMs) {
      // Expired
      this.cache.delete(key);
      this.order = this.order.filter((k) => k !== key);
      this.misses++;
      return null;
    }

    // Move to end (most recently used)
    this.order = this.order.filter((k) => k !== key);
    this.order.push(key);
    this.hits++;

    return { ...entry.value, cached: true };
  }

  set(key: string, value: QueryResult<any>): void {
    if (this.cache.has(key)) {
      this.order = this.order.filter((k) => k !== key);
    }

    // Evict oldest if at capacity
    while (this.order.length >= this.capacity) {
      const oldest = this.order.shift();
      if (oldest) {
        this.cache.delete(oldest);
      }
    }

    this.cache.set(key, {
      key,
      value: { ...value, cached: false },
      timestamp: Date.now(),
    });
    this.order.push(key);
  }

  clear(): void {
    this.cache.clear();
    this.order = [];
  }

  getHitRate(): number {
    const total = this.hits + this.misses;
    return total === 0 ? 0 : this.hits / total;
  }

  getStats(): { size: number; capacity: number; hits: number; misses: number } {
    return {
      size: this.cache.size,
      capacity: this.capacity,
      hits: this.hits,
      misses: this.misses,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal types
// ─────────────────────────────────────────────────────────────────────────────

interface IndexMap {
  /** column name → Map<value, Set<rowIndex>> */
  [column: string]: Map<any, Set<number>>;
}

interface TableInternal {
  name: string;
  columns: ColumnDef[];
  rows: any[];
  /** Simulated index structures for fast lookups */
  indexes: IndexMap;
  lastUpdated: string;
  partitionConfig: PartitionConfig | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function estimateRowSizeBytes(row: Record<string, any>): number {
  let size = 0;
  for (const key of Object.keys(row)) {
    size += key.length * 2; // UTF-16 string key
    const val = row[key];
    if (val === null || val === undefined) {
      size += 0;
    } else if (typeof val === 'number') {
      size += 8;
    } else if (typeof val === 'boolean') {
      size += 4;
    } else if (typeof val === 'string') {
      size += val.length * 2;
    } else if (typeof val === 'object') {
      size += JSON.stringify(val).length * 2;
    }
  }
  return size;
}

function matchesWhere(row: Record<string, any>, where: Record<string, any>): boolean {
  for (const key of Object.keys(where)) {
    const expected = where[key];
    const actual = row[key];

    if (expected === null || expected === undefined) {
      if (actual !== null && actual !== undefined) return false;
      continue;
    }

    // Support operator objects: { $gt, $gte, $lt, $lte, $ne, $in, $like }
    if (typeof expected === 'object' && expected !== null && !Array.isArray(expected)) {
      for (const op of Object.keys(expected)) {
        const operand = expected[op];
        switch (op) {
          case '$gt':
            if (!(actual > operand)) return false;
            break;
          case '$gte':
            if (!(actual >= operand)) return false;
            break;
          case '$lt':
            if (!(actual < operand)) return false;
            break;
          case '$lte':
            if (!(actual <= operand)) return false;
            break;
          case '$ne':
            if (actual === operand) return false;
            break;
          case '$in':
            if (!Array.isArray(operand) || !operand.includes(actual)) return false;
            break;
          case '$like': {
            // Simple SQL LIKE: % = wildcard
            const pattern = String(operand)
              .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
              .replace(/%/g, '.*');
            if (!new RegExp(`^${pattern}$`, 'i').test(String(actual))) return false;
            break;
          }
          default:
            // Unknown operator, fall through to equality
            if (actual !== expected) return false;
        }
      }
      continue;
    }

    if (actual !== expected) return false;
  }
  return true;
}

function matchesTimeRange(
  row: Record<string, any>,
  timeRange: { column: string; start: string; end: string }
): boolean {
  const val = row[timeRange.column];
  if (val === null || val === undefined) return false;

  const ts = typeof val === 'number' ? val : new Date(val).getTime();
  const start = new Date(timeRange.start).getTime();
  const end = new Date(timeRange.end).getTime();

  if (isNaN(ts) || isNaN(start) || isNaN(end)) return false;
  return ts >= start && ts <= end;
}

function getPartitionKey(
  timestamp: number | string | Date,
  partitionBy: 'day' | 'week' | 'month' | 'year'
): string {
  const d = new Date(timestamp);
  if (isNaN(d.getTime())) return 'unknown';

  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');

  switch (partitionBy) {
    case 'day':
      return `${y}-${m}-${day}`;
    case 'week': {
      // ISO week number approximation
      const jan1 = new Date(Date.UTC(y, 0, 1));
      const dayOfYear = Math.floor((d.getTime() - jan1.getTime()) / 86_400_000) + 1;
      const week = Math.ceil((dayOfYear + jan1.getUTCDay()) / 7);
      return `${y}-W${String(week).padStart(2, '0')}`;
    }
    case 'month':
      return `${y}-${m}`;
    case 'year':
      return `${y}`;
    default:
      return `${y}-${m}-${day}`;
  }
}

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        fields.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
  }
  fields.push(current);
  return fields;
}

// ─────────────────────────────────────────────────────────────────────────────
// DataWarehouse class
// ─────────────────────────────────────────────────────────────────────────────

export class DataWarehouse {
  private tables: Map<string, TableInternal>;
  private queryCache: LRUCache;
  private partitionConfigs: Map<string, PartitionConfig>;

  constructor() {
    this.tables = new Map();
    this.queryCache = new LRUCache(100, 30_000);
    this.partitionConfigs = new Map();
    log.info('[DataWarehouse] Initialized');
  }

  // ─── Table Management ────────────────────────────────────────────────────

  createTable(name: string, columns: ColumnDef[]): void {
    if (this.tables.has(name)) {
      log.warn(`[DataWarehouse] Table "${name}" already exists — skipping`);
      return;
    }

    this.tables.set(name, {
      name,
      columns: [...columns],
      rows: [],
      indexes: {},
      lastUpdated: new Date().toISOString(),
      partitionConfig: null,
    });

    // Build indexes for columns marked as indexed
    const tbl = this.tables.get(name)!;
    for (const col of columns) {
      if (col.indexed) {
        tbl.indexes[col.name] = new Map<any, Set<number>>();
      }
    }

    log.info(
      `[DataWarehouse] Created table "${name}" with ${columns.length} columns, ` +
        `${Object.keys(tbl.indexes).length} indexes`
    );
  }

  dropTable(name: string): void {
    if (!this.tables.has(name)) {
      log.warn(`[DataWarehouse] Table "${name}" does not exist — cannot drop`);
      return;
    }

    const rowCount = this.tables.get(name)!.rows.length;
    this.tables.delete(name);
    this.partitionConfigs.delete(name);
    this.queryCache.clear(); // Invalidate all cached queries

    log.info(`[DataWarehouse] Dropped table "${name}" (${rowCount} rows removed)`);
  }

  // ─── Data Mutation ────────────────────────────────────────────────────────

  insert(table: string, rows: any[]): void {
    const tbl = this.tables.get(table);
    if (!tbl) {
      throw new EngineError(ErrorCode.DATA_SOURCE_ERROR, `[DataWarehouse] Table "${table}" does not exist`);
    }
    if (!rows || rows.length === 0) return;

    const baseIndex = tbl.rows.length;

    for (let i = 0; i < rows.length; i++) {
      const row = this.validateAndCoerceRow(table, rows[i]);
      const rowIndex = baseIndex + i;
      tbl.rows.push(row);

      // Update indexes
      for (const colName of Object.keys(tbl.indexes)) {
        const val = row[colName];
        if (val !== null && val !== undefined) {
          if (!tbl.indexes[colName].has(val)) {
            tbl.indexes[colName].set(val, new Set());
          }
          tbl.indexes[colName].get(val)!.add(rowIndex);
        }
      }
    }

    tbl.lastUpdated = new Date().toISOString();
    this.queryCache.clear(); // Invalidate cache on mutation

    log.debug(`[DataWarehouse] Inserted ${rows.length} rows into "${table}"`);
  }

  upsert(table: string, rows: any[], keyColumn: string): void {
    const tbl = this.tables.get(table);
    if (!tbl) {
      throw new EngineError(ErrorCode.DATA_SOURCE_ERROR, `[DataWarehouse] Table "${table}" does not exist`);
    }
    if (!rows || rows.length === 0) return;

    // Ensure keyColumn exists
    const colDef = tbl.columns.find((c) => c.name === keyColumn);
    if (!colDef) {
      throw new EngineError(ErrorCode.DATA_SOURCE_ERROR, `[DataWarehouse] Key column "${keyColumn}" not found in table "${table}"`);
    }

    // Build or use existing index on keyColumn for O(1) lookups
    let keyIndex: Map<any, Set<number>>;
    if (tbl.indexes[keyColumn]) {
      keyIndex = tbl.indexes[keyColumn];
    } else {
      // Build temporary index
      keyIndex = new Map();
      for (let i = 0; i < tbl.rows.length; i++) {
        const val = tbl.rows[i][keyColumn];
        if (val !== null && val !== undefined) {
          if (!keyIndex.has(val)) keyIndex.set(val, new Set());
          keyIndex.get(val)!.add(i);
        }
      }
    }

    let inserted = 0;
    let updated = 0;

    for (const rawRow of rows) {
      const row = this.validateAndCoerceRow(table, rawRow);
      const keyVal = row[keyColumn];
      const existing = keyIndex.get(keyVal);

      if (existing && existing.size > 0) {
        // Update first matching row
        const idx = existing.values().next().value as number;
        const oldRow = tbl.rows[idx];

        // Remove old index entries
        for (const colName of Object.keys(tbl.indexes)) {
          if (colName === keyColumn) continue;
          const oldVal = oldRow[colName];
          if (oldVal !== null && oldVal !== undefined) {
            const s = tbl.indexes[colName].get(oldVal);
            if (s) s.delete(idx);
          }
        }

        // Overwrite
        tbl.rows[idx] = row;

        // Update index entries
        for (const colName of Object.keys(tbl.indexes)) {
          const newVal = row[colName];
          if (newVal !== null && newVal !== undefined) {
            if (!tbl.indexes[colName].has(newVal)) {
              tbl.indexes[colName].set(newVal, new Set());
            }
            tbl.indexes[colName].get(newVal)!.add(idx);
          }
        }

        updated++;
      } else {
        // Insert new
        const newIndex = tbl.rows.length;
        tbl.rows.push(row);

        for (const colName of Object.keys(tbl.indexes)) {
          const val = row[colName];
          if (val !== null && val !== undefined) {
            if (!tbl.indexes[colName].has(val)) {
              tbl.indexes[colName].set(val, new Set());
            }
            tbl.indexes[colName].get(val)!.add(newIndex);
          }
        }

        // Also update temp keyIndex if it's not a persistent index
        if (!tbl.indexes[keyColumn]) {
          if (!keyIndex.has(keyVal)) keyIndex.set(keyVal, new Set());
          keyIndex.get(keyVal)!.add(newIndex);
        }

        inserted++;
      }
    }

    tbl.lastUpdated = new Date().toISOString();
    this.queryCache.clear();

    log.debug(
      `[DataWarehouse] Upsert on "${table}" (key=${keyColumn}): ` +
        `${inserted} inserted, ${updated} updated`
    );
  }

  delete(table: string, where: Record<string, any>): number {
    const tbl = this.tables.get(table);
    if (!tbl) {
      throw new EngineError(ErrorCode.DATA_SOURCE_ERROR, `[DataWarehouse] Table "${table}" does not exist`);
    }

    const toDelete: Set<number> = new Set();

    // Try index-accelerated deletion if possible
    const indexedCols = Object.keys(tbl.indexes);
    const whereKeys = Object.keys(where);
    const indexMatch = whereKeys.find((k) => indexedCols.includes(k) && typeof where[k] !== 'object');

    if (indexMatch) {
      const val = where[indexMatch];
      const candidates = tbl.indexes[indexMatch].get(val);
      if (candidates) {
        for (const idx of candidates) {
          if (matchesWhere(tbl.rows[idx], where)) {
            toDelete.add(idx);
          }
        }
      }
    } else {
      // Full scan
      for (let i = 0; i < tbl.rows.length; i++) {
        if (matchesWhere(tbl.rows[i], where)) {
          toDelete.add(i);
        }
      }
    }

    if (toDelete.size === 0) return 0;

    // Remove rows (iterate in reverse to keep indices stable)
    const sortedIndices = Array.from(toDelete).sort((a, b) => b - a);
    for (const idx of sortedIndices) {
      const row = tbl.rows[idx];

      // Remove from all indexes
      for (const colName of Object.keys(tbl.indexes)) {
        const val = row[colName];
        if (val !== null && val !== undefined) {
          const s = tbl.indexes[colName].get(val);
          if (s) {
            s.delete(idx);
            if (s.size === 0) tbl.indexes[colName].delete(val);
          }
        }
      }

      tbl.rows.splice(idx, 1);
    }

    // Rebuild all indexes after splice (row indices shifted)
    this.rebuildIndexes(table);

    tbl.lastUpdated = new Date().toISOString();
    this.queryCache.clear();

    log.debug(`[DataWarehouse] Deleted ${toDelete.size} rows from "${table}"`);
    return toDelete.size;
  }

  // ─── Query ────────────────────────────────────────────────────────────────

  query<T = unknown>(options: QueryOptions): QueryResult<T> {
    const start = performance.now();
    const { table, where, orderBy, limit, offset, columns, timeRange } = options;

    const tbl = this.tables.get(table);
    if (!tbl) {
      throw new EngineError(ErrorCode.DATA_SOURCE_ERROR, `[DataWarehouse] Table "${table}" does not exist`);
    }

    // Build cache key
    const cacheKey = JSON.stringify(options);
    const cached = this.queryCache.get(cacheKey);
    if (cached) {
      return cached as QueryResult<T>;
    }

    // Filter rows
    let results: any[] = [];

    // Attempt index-accelerated filtering
    let candidateIndices: Set<number> | null = null;

    if (where) {
      const indexedCols = Object.keys(tbl.indexes);
      const eqKeys = Object.keys(where).filter(
        (k) => indexedCols.includes(k) && typeof where[k] !== 'object'
      );

      if (eqKeys.length > 0) {
        // Intersect index sets for multiple equality conditions
        for (const key of eqKeys) {
          const val = where[key];
          const matchSet = tbl.indexes[key].get(val);
          if (!matchSet) {
            candidateIndices = new Set();
            break;
          }
          if (candidateIndices === null) {
            candidateIndices = new Set(matchSet);
          } else {
            // Intersect
            const intersected = new Set<number>();
            for (const idx of matchSet) {
              if (candidateIndices.has(idx)) intersected.add(idx);
            }
            candidateIndices = intersected;
          }
        }
      }
    }

    if (candidateIndices !== null) {
      // Only check candidates
      for (const idx of candidateIndices) {
        const row = tbl.rows[idx];
        if (!row) continue;

        let pass = true;
        if (where && !matchesWhere(row, where)) pass = false;
        if (pass && timeRange && !matchesTimeRange(row, timeRange)) pass = false;
        if (pass) results.push(row);
      }
    } else {
      // Full scan
      for (let i = 0; i < tbl.rows.length; i++) {
        const row = tbl.rows[i];
        let pass = true;
        if (where && !matchesWhere(row, where)) pass = false;
        if (pass && timeRange && !matchesTimeRange(row, timeRange)) pass = false;
        if (pass) results.push(row);
      }
    }

    const total = results.length;

    // Sort
    if (orderBy) {
      const { column, desc } = orderBy;
      results.sort((a, b) => {
        const va = a[column];
        const vb = b[column];
        if (va === vb) return 0;
        if (va === null || va === undefined) return 1;
        if (vb === null || vb === undefined) return -1;
        const cmp = va < vb ? -1 : 1;
        return desc ? -cmp : cmp;
      });
    }

    // Pagination
    if (offset !== undefined && offset > 0) {
      results = results.slice(offset);
    }
    if (limit !== undefined && limit > 0) {
      results = results.slice(0, limit);
    }

    // Column projection
    if (columns && columns.length > 0) {
      results = results.map((row) => {
        const projected: Record<string, any> = {};
        for (const col of columns) {
          if (col in row) projected[col] = row[col];
        }
        return projected;
      });
    }

    const durationMs = performance.now() - start;

    const result: QueryResult<T> = {
      rows: results as T[],
      total,
      durationMs: Math.round(durationMs * 100) / 100,
      cached: false,
    };

    this.queryCache.set(cacheKey, result);
    return result;
  }

  // ─── Table Info & Stats ───────────────────────────────────────────────────

  getTableInfo(): WarehouseTable[] {
    const info: WarehouseTable[] = [];

    for (const [name, tbl] of this.tables) {
      let sizeBytes = 0;
      for (const row of tbl.rows) {
        sizeBytes += estimateRowSizeBytes(row);
      }

      info.push({
        name,
        columns: [...tbl.columns],
        rowCount: tbl.rows.length,
        sizeBytes,
        lastUpdated: tbl.lastUpdated,
        indexes: Object.keys(tbl.indexes),
      });
    }

    return info;
  }

  getStats(): { totalTables: number; totalRows: number; totalSizeBytes: number; hitRate: number } {
    let totalRows = 0;
    let totalSizeBytes = 0;

    for (const tbl of this.tables.values()) {
      totalRows += tbl.rows.length;
      for (const row of tbl.rows) {
        totalSizeBytes += estimateRowSizeBytes(row);
      }
    }

    return {
      totalTables: this.tables.size,
      totalRows,
      totalSizeBytes,
      hitRate: this.queryCache.getHitRate(),
    };
  }

  // ─── Column Statistics ────────────────────────────────────────────────────

  getColumnStats(table: string, column: string): ColumnStats | null {
    const tbl = this.tables.get(table);
    if (!tbl) {
      throw new EngineError(ErrorCode.DATA_SOURCE_ERROR, `[DataWarehouse] Table "${table}" does not exist`);
    }

    const colDef = tbl.columns.find((c) => c.name === column);
    if (!colDef || colDef.type !== 'number') {
      return null;
    }

    let min = Infinity;
    let max = -Infinity;
    let sum = 0;
    let count = 0;

    for (const row of tbl.rows) {
      const val = row[column];
      if (typeof val === 'number' && !isNaN(val)) {
        if (val < min) min = val;
        if (val > max) max = val;
        sum += val;
        count++;
      }
    }

    if (count === 0) return null;

    return {
      column,
      min,
      max,
      avg: sum / count,
      count,
      sum,
    };
  }

  getAllColumnStats(table: string): ColumnStats[] {
    const tbl = this.tables.get(table);
    if (!tbl) {
      throw new EngineError(ErrorCode.DATA_SOURCE_ERROR, `[DataWarehouse] Table "${table}" does not exist`);
    }

    const numericCols = tbl.columns.filter((c) => c.type === 'number');
    const stats: ColumnStats[] = [];

    for (const col of numericCols) {
      const s = this.getColumnStats(table, col.name);
      if (s) stats.push(s);
    }

    return stats;
  }

  // ─── Partitioning ─────────────────────────────────────────────────────────

  setPartitionConfig(config: PartitionConfig): void {
    const tbl = this.tables.get(config.table);
    if (!tbl) {
      throw new EngineError(ErrorCode.DATA_SOURCE_ERROR, `[DataWarehouse] Table "${config.table}" does not exist`);
    }

    // Validate time column exists
    const colDef = tbl.columns.find((c) => c.name === config.timeColumn);
    if (!colDef || colDef.type !== 'datetime') {
      throw new EngineError(ErrorCode.DATA_SOURCE_ERROR, `[DataWarehouse] Partition time column "${config.timeColumn}" must be of type 'datetime'`);
    }

    tbl.partitionConfig = { ...config };
    this.partitionConfigs.set(config.table, { ...config });

    log.info(
      `[DataWarehouse] Partition config set for "${config.table}": ` +
        `by=${config.partitionBy}, retention=${config.retentionDays}d`
    );
  }

  getPartitionConfig(table: string): PartitionConfig | null {
    return this.partitionConfigs.get(table) || null;
  }

  getPartitionKeys(table: string): string[] {
    const tbl = this.tables.get(table);
    if (!tbl || !tbl.partitionConfig) return [];

    const { partitionBy, timeColumn } = tbl.partitionConfig;
    const keys = new Set<string>();

    for (const row of tbl.rows) {
      const val = row[timeColumn];
      if (val !== null && val !== undefined) {
        keys.add(getPartitionKey(val, partitionBy));
      }
    }

    return Array.from(keys).sort();
  }

  // ─── Compaction ───────────────────────────────────────────────────────────

  compact(): { removedRows: number; tablesCompacted: number } {
    log.info('[DataWarehouse] Starting compaction...');
    let totalRemoved = 0;
    let tablesCompacted = 0;

    const now = Date.now();

    for (const [tableName, tbl] of this.tables) {
      if (!tbl.partitionConfig) continue;

      const { timeColumn, retentionDays } = tbl.partitionConfig;
      const cutoff = now - retentionDays * 86_400_000;

      const beforeCount = tbl.rows.length;
      const kept: any[] = [];

      for (const row of tbl.rows) {
        const val = row[timeColumn];
        if (val === null || val === undefined) {
          kept.push(row); // Keep rows without time data
          continue;
        }

        const ts = typeof val === 'number' ? val : new Date(val).getTime();
        if (isNaN(ts) || ts >= cutoff) {
          kept.push(row);
        }
      }

      const removed = beforeCount - kept.length;
      if (removed > 0) {
        tbl.rows = kept;
        this.rebuildIndexes(tableName);
        tbl.lastUpdated = new Date().toISOString();
        totalRemoved += removed;
        tablesCompacted++;

        log.info(
          `[DataWarehouse] Compacted "${tableName}": removed ${removed} expired rows ` +
            `(retention: ${retentionDays}d), ${kept.length} remaining`
        );
      }
    }

    this.queryCache.clear();

    log.info(
      `[DataWarehouse] Compaction complete: ${totalRemoved} rows removed ` +
        `across ${tablesCompacted} tables`
    );

    return { removedRows: totalRemoved, tablesCompacted };
  }

  // ─── Export / Import ──────────────────────────────────────────────────────

  exportTable(table: string, format: 'json' | 'csv'): string {
    const tbl = this.tables.get(table);
    if (!tbl) {
      throw new EngineError(ErrorCode.DATA_SOURCE_ERROR, `[DataWarehouse] Table "${table}" does not exist`);
    }

    if (format === 'json') {
      return JSON.stringify(tbl.rows, null, 2);
    }

    // CSV export
    const colNames = tbl.columns.map((c) => c.name);
    const lines: string[] = [colNames.map(csvEscape).join(',')];

    for (const row of tbl.rows) {
      const values = colNames.map((col) => csvEscape(row[col]));
      lines.push(values.join(','));
    }

    return lines.join('\r\n');
  }

  importTable(table: string, data: string, format: 'json' | 'csv'): number {
    const tbl = this.tables.get(table);
    if (!tbl) {
      throw new EngineError(ErrorCode.DATA_SOURCE_ERROR, `[DataWarehouse] Table "${table}" does not exist`);
    }

    let rows: any[];

    if (format === 'json') {
      rows = JSON.parse(data);
      if (!Array.isArray(rows)) {
        throw new EngineError(ErrorCode.DATA_SOURCE_ERROR, '[DataWarehouse] JSON import expects an array of rows');
      }
    } else {
      // CSV import
      const lines = data.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length < 2) {
        throw new EngineError(ErrorCode.DATA_SOURCE_ERROR, '[DataWarehouse] CSV import requires a header row and at least one data row');
      }

      const headers = parseCsvLine(lines[0]);
      rows = [];

      for (let i = 1; i < lines.length; i++) {
        const fields = parseCsvLine(lines[i]);
        const row: Record<string, any> = {};

        for (let j = 0; j < headers.length; j++) {
          const colName = headers[j];
          const rawVal = j < fields.length ? fields[j] : '';
          const colDef = tbl.columns.find((c) => c.name === colName);

          row[colName] = this.coerceValue(rawVal, colDef);
        }

        rows.push(row);
      }
    }

    this.insert(table, rows);
    log.info(`[DataWarehouse] Imported ${rows.length} rows into "${table}" (${format})`);
    return rows.length;
  }

  // ─── Index Management ─────────────────────────────────────────────────────

  addIndex(table: string, column: string): void {
    const tbl = this.tables.get(table);
    if (!tbl) {
      throw new EngineError(ErrorCode.DATA_SOURCE_ERROR, `[DataWarehouse] Table "${table}" does not exist`);
    }

    if (tbl.indexes[column]) {
      log.debug(`[DataWarehouse] Index on "${table}.${column}" already exists`);
      return;
    }

    const colDef = tbl.columns.find((c) => c.name === column);
    if (!colDef) {
      throw new EngineError(ErrorCode.DATA_SOURCE_ERROR, `[DataWarehouse] Column "${column}" not found in table "${table}"`);
    }

    // Build index
    const index = new Map<any, Set<number>>();
    for (let i = 0; i < tbl.rows.length; i++) {
      const val = tbl.rows[i][column];
      if (val !== null && val !== undefined) {
        if (!index.has(val)) index.set(val, new Set());
        index.get(val)!.add(i);
      }
    }

    tbl.indexes[column] = index;

    log.info(
      `[DataWarehouse] Added index on "${table}.${column}" (${index.size} unique values)`
    );
  }

  removeIndex(table: string, column: string): void {
    const tbl = this.tables.get(table);
    if (!tbl) {
      throw new EngineError(ErrorCode.DATA_SOURCE_ERROR, `[DataWarehouse] Table "${table}" does not exist`);
    }

    if (!tbl.indexes[column]) {
      log.debug(`[DataWarehouse] No index on "${table}.${column}" — nothing to remove`);
      return;
    }

    delete tbl.indexes[column];
    log.info(`[DataWarehouse] Removed index on "${table}.${column}"`);
  }

  // ─── Utility ──────────────────────────────────────────────────────────────

  getRowCount(table: string): number {
    const tbl = this.tables.get(table);
    if (!tbl) {
      throw new EngineError(ErrorCode.DATA_SOURCE_ERROR, `[DataWarehouse] Table "${table}" does not exist`);
    }
    return tbl.rows.length;
  }

  hasTable(table: string): boolean {
    return this.tables.has(table);
  }

  getColumns(table: string): ColumnDef[] {
    const tbl = this.tables.get(table);
    if (!tbl) {
      throw new EngineError(ErrorCode.DATA_SOURCE_ERROR, `[DataWarehouse] Table "${table}" does not exist`);
    }
    return [...tbl.columns];
  }

  clearCache(): void {
    this.queryCache.clear();
    log.debug('[DataWarehouse] Query cache cleared');
  }

  getCacheStats(): { size: number; capacity: number; hits: number; misses: number } {
    return this.queryCache.getStats();
  }

  /**
   * Returns a sample of rows from the table (useful for quick inspection).
   */
  sample(table: string, count = 5): any[] {
    const tbl = this.tables.get(table);
    if (!tbl) {
      throw new EngineError(ErrorCode.DATA_SOURCE_ERROR, `[DataWarehouse] Table "${table}" does not exist`);
    }

    if (tbl.rows.length <= count) {
      return [...tbl.rows];
    }

    // Deterministic sampling: evenly spaced rows
    const step = Math.floor(tbl.rows.length / count);
    const result: unknown[] = [];
    for (let i = 0; i < count; i++) {
      result.push(tbl.rows[i * step]);
    }
    return result;
  }

  /**
   * Creates a snapshot (deep clone) of all table data.
   * Useful for backup or migration scenarios.
   */
  snapshot(): Map<string, any[]> {
    const snap = new Map<string, any[]>();
    for (const [name, tbl] of this.tables) {
      snap.set(
        name,
        tbl.rows.map((r) => ({ ...r }))
      );
    }
    return snap;
  }

  /**
   * Restores table data from a snapshot.
   * Existing rows are replaced entirely.
   */
  restore(snapshot: Map<string, any[]>): void {
    for (const [name, rows] of snapshot) {
      if (!this.tables.has(name)) {
        log.warn(`[DataWarehouse] Restore: table "${name}" not found — skipping`);
        continue;
      }
      const tbl = this.tables.get(name)!;
      tbl.rows = rows.map((r) => ({ ...r }));
      this.rebuildIndexes(name);
      tbl.lastUpdated = new Date().toISOString();
    }

    this.queryCache.clear();
    log.info(`[DataWarehouse] Restored ${snapshot.size} tables from snapshot`);
  }

  // ─── Private Helpers ──────────────────────────────────────────────────────

  private validateAndCoerceRow(table: string, rawRow: Record<string, any>): Record<string, any> {
    const tbl = this.tables.get(table)!;
    const row: Record<string, any> = {};

    for (const col of tbl.columns) {
      const val = rawRow[col.name];

      if (val === null || val === undefined) {
        if (!col.nullable) {
          log.warn(
            `[DataWarehouse] Non-nullable column "${col.name}" in "${table}" ` +
              `received null/undefined — storing as null`
          );
        }
        row[col.name] = null;
        continue;
      }

      row[col.name] = this.coerceValue(val, col);
    }

    // Preserve extra columns not in schema (pass-through)
    for (const key of Object.keys(rawRow)) {
      if (!(key in row)) {
        row[key] = rawRow[key];
      }
    }

    return row;
  }

  private coerceValue(val: unknown, colDef?: ColumnDef): any {
    if (!colDef) return val;
    if (val === null || val === undefined) return null;

    switch (colDef.type) {
      case 'number': {
        const n = Number(val);
        return isNaN(n) ? null : n;
      }
      case 'boolean':
        if (typeof val === 'string') {
          return val.toLowerCase() === 'true' || val === '1';
        }
        return Boolean(val);
      case 'datetime':
        if (typeof val === 'string' || typeof val === 'number') {
          const d = new Date(val);
          return isNaN(d.getTime()) ? null : d.toISOString();
        }
        return String(val);
      case 'json':
        if (typeof val === 'string') {
          try {
            return JSON.parse(val);
          } catch {
            return val;
          }
        }
        return val;
      case 'string':
      default:
        return String(val);
    }
  }

  private rebuildIndexes(table: string): void {
    const tbl = this.tables.get(table);
    if (!tbl) return;

    for (const colName of Object.keys(tbl.indexes)) {
      const index = new Map<any, Set<number>>();
      for (let i = 0; i < tbl.rows.length; i++) {
        const val = tbl.rows[i][colName];
        if (val !== null && val !== undefined) {
          if (!index.has(val)) index.set(val, new Set());
          index.get(val)!.add(i);
        }
      }
      tbl.indexes[colName] = index;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Default export: singleton-style factory
// ─────────────────────────────────────────────────────────────────────────────

let _defaultInstance: DataWarehouse | null = null;

export function getDataWarehouse(): DataWarehouse {
  if (!_defaultInstance) {
    _defaultInstance = new DataWarehouse();
    log.info('[DataWarehouse] Default singleton instance created');
  }
  return _defaultInstance;
}

export function resetDataWarehouse(): void {
  _defaultInstance = null;
  log.info('[DataWarehouse] Default singleton instance reset');
}

export default DataWarehouse;

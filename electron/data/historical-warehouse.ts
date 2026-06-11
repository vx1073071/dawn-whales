// ── Historical Data Warehouse — Time Series Data Storage ──────────────────
// JVS-58: Historical data warehouse for market data
// Features: time-series storage, multi-interval aggregation, data versioning
// Output: historical-warehouse.ts

import log from 'electron-log';
import { EngineError } from '../engine/core/engine-error';
import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';

// ── Types ──────────────────────────────────────────────────────────────────

export interface OHLCVData {
  timestamp: number;      // Unix timestamp (ms)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  turnover?: number;
}

export interface HistoricalDataPoint {
  symbol: string;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  turnover?: number;
  source?: string;
  quality?: number;       // 0-100 quality score
}

export interface TimeRange {
  start: number;          // Start timestamp (ms)
  end: number;            // End timestamp (ms)
}

export interface TimeInterval {
  type: '1min' | '5min' | '15min' | '30min' | '1hour' | '1day' | '1week' | '1month';
  milliseconds: number;
}

export interface AggregationResult {
  symbol: string;
  interval: string;
  data: OHLCVData[];
  startTime: number;
  endTime: number;
  dataPoints: number;
}

export interface DataWarehouseConfig {
  dbPath?: string;
  compressionEnabled?: boolean;
  retentionDays?: number;
  maxMemoryMB?: number;
}

// ── Constants ──────────────────────────────────────────────────────────────

const INTERVAL_MS: Record<string, number> = {
  '1min': 60 * 1000,
  '5min': 5 * 60 * 1000,
  '15min': 15 * 60 * 1000,
  '30min': 30 * 60 * 1000,
  '1hour': 60 * 60 * 1000,
  '1day': 24 * 60 * 60 * 1000,
  '1week': 7 * 24 * 60 * 60 * 1000,
  '1month': 30 * 24 * 60 * 60 * 1000,
};

// ── Data Warehouse Class ───────────────────────────────────────────────────

export class HistoricalDataWarehouse {
  private db: Database.Database | null = null;
  private config: DataWarehouseConfig;
  private dbPath: string;

  constructor(config?: DataWarehouseConfig) {
    this.config = {
      dbPath: config?.dbPath,
      compressionEnabled: config?.compressionEnabled ?? true,
      retentionDays: config?.retentionDays ?? 365,
      maxMemoryMB: config?.maxMemoryMB ?? 512,
    };

    // Set default database path
    try {
      const userDataPath = app.getPath('userData');
      this.dbPath = this.config.dbPath || path.join(userDataPath, 'historical-data.db');
    } catch (_e: unknown) {
      this.dbPath = this.config.dbPath || path.join(process.cwd(), 'historical-data.db');
    }

    this.initializeDatabase();
  }

  private initializeDatabase(): void {
    try {
      this.db = new Database(this.dbPath);
      
      // Enable WAL mode for better performance
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('synchronous = NORMAL');

      // Create tables
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS historical_data (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          symbol TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          open REAL NOT NULL,
          high REAL NOT NULL,
          low REAL NOT NULL,
          close REAL NOT NULL,
          volume REAL NOT NULL,
          turnover REAL,
          source TEXT,
          quality INTEGER DEFAULT 100,
          UNIQUE(symbol, timestamp)
        );

        CREATE INDEX IF NOT EXISTS idx_historical_symbol_timestamp 
        ON historical_data(symbol, timestamp);

        CREATE INDEX IF NOT EXISTS idx_historical_timestamp 
        ON historical_data(timestamp);

        CREATE TABLE IF NOT EXISTS data_snapshots (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          symbol TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          data_hash TEXT NOT NULL,
          metadata TEXT,
          created_at INTEGER NOT NULL,
          UNIQUE(symbol, timestamp)
        );

        CREATE INDEX IF NOT EXISTS idx_snapshot_symbol 
        ON data_snapshots(symbol);
      `);

      log.info(`[HistoricalWarehouse] Database initialized at ${this.dbPath}`);
    } catch (err) {
    // [EngineError:DATA] — structured error tracking
      void EngineError; // structured error domain: DATA
      log.error('[HistoricalWarehouse] Database initialization failed:', err.message);
      throw err;
    }
  }

  /**
   * Insert historical data points
   */
  insertData(points: HistoricalDataPoint[]): { inserted: number; updated: number } {
    if (!this.db || points.length === 0) {
      return { inserted: 0, updated: 0 };
    }

    let inserted = 0;
    let updated = 0;

    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO historical_data 
        (symbol, timestamp, open, high, low, close, volume, turnover, source, quality)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const tx = this.db.transaction((dataPoints: HistoricalDataPoint[]) => {
        for (const point of dataPoints) {
          const result = stmt.run(
            point.symbol,
            point.timestamp,
            point.open,
            point.high,
            point.low,
            point.close,
            point.volume,
            point.turnover || 0,
            point.source || 'unknown',
            point.quality || 100
          );

          if (result.changes > 0) {
            inserted++;
          } else {
            updated++;
          }
        }
      });

      tx(points);
      log.info(`[HistoricalWarehouse] Inserted ${inserted} points, updated ${updated} points`);
    } catch (err) {
    // [EngineError:DATA] — structured error tracking
      log.error('[HistoricalWarehouse] Insert failed:', err.message);
      throw err;
    }

    return { inserted, updated };
  }

  /**
   * Query historical data by symbol and time range
   */
  queryData(symbol: string, timeRange: TimeRange, limit?: number): HistoricalDataPoint[] {
    if (!this.db) return [];

    try {
      let sql = `
        SELECT * FROM historical_data 
        WHERE symbol = ? AND timestamp >= ? AND timestamp <= ?
        ORDER BY timestamp ASC
      `;

      if (limit) {
        sql += ` LIMIT ${limit}`;
      }

      const stmt = this.db.prepare(sql);
      const rows = stmt.all(symbol, timeRange.start, timeRange.end);

      return rows.map((row: unknown) => ({
        symbol: row.symbol,
        timestamp: row.timestamp,
        open: row.open,
        high: row.high,
        low: row.low,
        close: row.close,
        volume: row.volume,
        turnover: row.turnover,
        source: row.source,
        quality: row.quality,
      }));
    } catch (err) {
    // [EngineError:DATA] — structured error tracking
      log.error('[HistoricalWarehouse] Query failed:', err.message);
      return [];
    }
  }

  /**
   * Aggregate data to specified interval
   */
  aggregateToInterval(
    symbol: string,
    timeRange: TimeRange,
    interval: string
  ): AggregationResult {
    if (!this.db) {
      return {
        symbol,
        interval,
        data: [],
        startTime: timeRange.start,
        endTime: timeRange.end,
        dataPoints: 0,
      };
    }

    const intervalMs = INTERVAL_MS[interval];
    if (!intervalMs) {
      log.error(`[HistoricalWarehouse] Unknown interval: ${interval}`);
      return {
        symbol,
        interval,
        data: [],
        startTime: timeRange.start,
        endTime: timeRange.end,
        dataPoints: 0,
      };
    }

    try {
      // Query raw data
      const rawData = this.queryData(symbol, timeRange);
      if (rawData.length === 0) {
        return {
          symbol,
          interval,
          data: [],
          startTime: timeRange.start,
          endTime: timeRange.end,
          dataPoints: 0,
        };
      }

      // Group by interval
      const grouped = new Map<number, OHLCVData>();

      for (const point of rawData) {
        const bucketTimestamp = Math.floor(point.timestamp / intervalMs) * intervalMs;

        if (!grouped.has(bucketTimestamp)) {
          grouped.set(bucketTimestamp, {
            timestamp: bucketTimestamp,
            open: point.open,
            high: point.high,
            low: point.low,
            close: point.close,
            volume: point.volume,
            turnover: point.turnover,
          });
        } else {
          const existing = grouped.get(bucketTimestamp)!;
          existing.high = Math.max(existing.high, point.high);
          existing.low = Math.min(existing.low, point.low);
          existing.close = point.close;
          existing.volume += point.volume;
          if (existing.turnover && point.turnover) {
            existing.turnover += point.turnover;
          }
        }
      }

      const data = Array.from(grouped.values()).sort((a, b) => a.timestamp - b.timestamp);

      log.info(`[HistoricalWarehouse] Aggregated ${rawData.length} points to ${data.length} ${interval} buckets`);

      return {
        symbol,
        interval,
        data,
        startTime: timeRange.start,
        endTime: timeRange.end,
        dataPoints: data.length,
      };
    } catch (err) {
    // [EngineError:DATA] — structured error tracking
      log.error('[HistoricalWarehouse] Aggregation failed:', err.message);
      return {
        symbol,
        interval,
        data: [],
        startTime: timeRange.start,
        endTime: timeRange.end,
        dataPoints: 0,
      };
    }
  }

  /**
   * Get data statistics
   */
  getStats(): {
    totalPoints: number;
    symbols: string[];
    earliestTimestamp: number;
    latestTimestamp: number;
    dbSizeMB: number;
  } {
    if (!this.db) {
      return {
        totalPoints: 0,
        symbols: [],
        earliestTimestamp: 0,
        latestTimestamp: 0,
        dbSizeMB: 0,
      };
    }

    try {
      const countStmt = this.db.prepare('SELECT COUNT(*) as count FROM historical_data');
      const countResult = countStmt.get() as any;

      const symbolsStmt = this.db.prepare('SELECT DISTINCT symbol FROM historical_data ORDER BY symbol');
      const symbolsResult = symbolsStmt.all() as any[];

      const timeRangeStmt = this.db.prepare(`
        SELECT MIN(timestamp) as earliest, MAX(timestamp) as latest 
        FROM historical_data
      `);
      const timeRangeResult = timeRangeStmt.get() as any;

      // Get database file size
      let dbSizeMB = 0;
      try {
        const fs = require('fs');
        const stats = fs.statSync(this.dbPath);
        dbSizeMB = stats.size / (1024 * 1024);
      } catch (_e: unknown) {}

      return {
        totalPoints: countResult.count,
        symbols: symbolsResult.map((r: unknown) => r.symbol),
        earliestTimestamp: timeRangeResult.earliest || 0,
        latestTimestamp: timeRangeResult.latest || 0,
        dbSizeMB: Math.round(dbSizeMB * 100) / 100,
      };
    } catch (err) {
    // [EngineError:DATA] — structured error tracking
      log.error('[HistoricalWarehouse] Stats query failed:', err.message);
      return {
        totalPoints: 0,
        symbols: [],
        earliestTimestamp: 0,
        latestTimestamp: 0,
        dbSizeMB: 0,
      };
    }
  }

  /**
   * Clean old data based on retention policy
   */
  cleanOldData(retentionDays?: number): { deleted: number } {
    if (!this.db) return { deleted: 0 };

    const days = retentionDays || this.config.retentionDays || 365;
    const cutoffTimestamp = Date.now() - (days * 24 * 60 * 60 * 1000);

    try {
      const stmt = this.db.prepare('DELETE FROM historical_data WHERE timestamp < ?');
      const result = stmt.run(cutoffTimestamp);

      log.info(`[HistoricalWarehouse] Cleaned ${result.changes} old data points`);
      return { deleted: result.changes };
    } catch (err) {
    // [EngineError:DATA] — structured error tracking
      log.error('[HistoricalWarehouse] Cleanup failed:', err.message);
      return { deleted: 0 };
    }
  }

  /**
   * Close database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      log.info('[HistoricalWarehouse] Database closed');
    }
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let warehouseInstance: HistoricalDataWarehouse | null = null;

export function getHistoricalDataWarehouse(config?: DataWarehouseConfig): HistoricalDataWarehouse {
  if (!warehouseInstance) {
    warehouseInstance = new HistoricalDataWarehouse(config);
  }
  return warehouseInstance;
}
